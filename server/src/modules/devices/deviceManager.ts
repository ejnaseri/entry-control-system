import {
  Device,
  DeviceConnectionType,
  DeviceStatus,
  DeviceType,
  InboxCategory,
  InboxEntityType,
  InboxItemType,
  InboxScope,
  InboxSeverity,
  MemberStatus,
  MemberType,
} from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { logger } from "../../config/logger";
import type { DeviceClient } from "../../shared/devices.types";
import { ZktecoK40Client } from "./zktecoK40.client";
import { processDeviceEvents } from "./zktecoK40.service";
import { HttpError } from "../../middlewares/error-handler";
import { getConfiguredEventMode, isAutoPushActive, isPushEnabled, type DeviceEventMode } from "./deviceEventMode";
import { formatDeviceError } from "./deviceError";
import {
  buildStrictStaffDeviceMemberWhere,
  FULL_DEVICE_DATA_SCOPE,
  isAttendanceK40PullDevice,
  isStrictStaffDeviceScope,
  normalizeCanonicalPhysicalDeviceExternalId,
  normalizeDeviceExternalId,
  type DeviceDataScope,
} from "./device-edition-scope";

type ManagedDeviceState = {
  deviceId: string;
  deviceName?: string;
  client: DeviceClient;
  pollTimer?: NodeJS.Timeout;
  pollIntervalMs: number;
  backoffMs: number;
  connected: boolean;
  pushActive: boolean;
  lastPollAt?: Date;
  lastEventAt?: Date;
  lastEventProcessedAt?: Date;
  lastError?: string | undefined;
  lastErrorAt?: Date;
  signature: string;
  mode: DeviceEventMode;
  pushEnabled: boolean;
  scope: DeviceDataScope;
};

const deviceStates = new Map<string, ManagedDeviceState>();
const deviceOpQueues = new Map<string, Promise<void>>();
const DEFAULT_POLL_INTERVAL_MS = Number(process.env["ZKTECO_POLL_INTERVAL_MS"] ?? 5000);
const DEFAULT_UNLOCK_SECONDS = 3;
const MAX_BACKOFF_MS = 60000;
const DISCONNECT_DEDUPE_MINUTES = Number(process.env["INBOX_DEVICE_DISCONNECT_WINDOW_MINUTES"] ?? 10);

async function recordLegacyDisconnectInbox(state: ManagedDeviceState, deviceId: string): Promise<void> {
  const { buildDedupeKey, createInboxItem, formatWindowKey } = await import("../inbox/inbox.service");
  const now = new Date();
  const dedupeKey = buildDedupeKey({
    type: InboxItemType.DEVICE_DISCONNECTED,
    entityType: InboxEntityType.DEVICE,
    entityId: deviceId,
    window: formatWindowKey(now, DISCONNECT_DEDUPE_MINUTES),
  });
  await createInboxItem({
    scope: InboxScope.FULL,
    category: InboxCategory.ALERT,
    type: InboxItemType.DEVICE_DISCONNECTED,
    severity: InboxSeverity.CRITICAL,
    title: `Device disconnected: ${state.deviceName ?? deviceId}`,
    ...(state.lastError ? { body: `Error: ${state.lastError}` } : {}),
    createdAt: now,
    entityType: InboxEntityType.DEVICE,
    entityId: deviceId,
    actionPath: "/devices",
    dedupeKey,
    deviceId,
  });
}

function isZktecoConnectionType(
  connectionType: DeviceConnectionType
): connectionType is "NETWORK" | "ZKTECO_PULL_SDK" {
  return connectionType === DeviceConnectionType.NETWORK || connectionType === DeviceConnectionType.ZKTECO_PULL_SDK;
}

function buildSignature(device: Device, scope: DeviceDataScope) {
  return JSON.stringify({ scope, connectionType: device.connectionType, enabled: device.enabled, config: device.config });
}

function resolvePollInterval(config: any): number {
  const value = Number(config?.pollIntervalMs ?? config?.poll_interval_ms);
  if (Number.isFinite(value) && value >= 500) return value;
  return DEFAULT_POLL_INTERVAL_MS;
}

export function createClientForDevice(device: Device): DeviceClient {
  const cfg: any = device.config ?? {};
  switch (device.connectionType) {
    case DeviceConnectionType.NETWORK:
    case DeviceConnectionType.ZKTECO_PULL_SDK: {
      const host = cfg.ip ?? cfg.host;
      const port = Number(cfg.port ?? 0);
      const password = cfg.password ?? cfg.pass ?? cfg.commKey;
      if (!host || !port) {
        throw new Error("Device IP/port missing in config");
      }
      return new ZktecoK40Client({
        id: device.id,
        host,
        port,
        password,
        timeoutMs: cfg.timeoutMs,
      });
    }
    default:
      throw new Error(`Unsupported connection type: ${device.connectionType}`);
  }
}

function assertDeviceAllowedForScope(
  device: Pick<Device, "type" | "connectionType">,
  scope: DeviceDataScope
): void {
  if (isStrictStaffDeviceScope(scope) && !isAttendanceK40PullDevice(device)) {
    throw new HttpError(404, "Device not found");
  }
}

async function assertSingleAttendanceK40Device(deviceId: string, scope: DeviceDataScope): Promise<void> {
  if (!isStrictStaffDeviceScope(scope)) return;
  const conflictingDevice = await prisma.device.findFirst({
    where: {
      id: { not: deviceId },
      enabled: true,
      type: DeviceType.FINGERPRINT,
      connectionType: { in: [DeviceConnectionType.NETWORK, DeviceConnectionType.ZKTECO_PULL_SDK] },
    },
    select: { id: true },
  });
  if (conflictingDevice) {
    throw new HttpError(409, "Attendance Edition supports one enabled K40 Pull device");
  }
}

function queueDeviceOperation<T>(deviceId: string, operation: () => Promise<T>): Promise<T> {
  const previous = deviceOpQueues.get(deviceId) ?? Promise.resolve();
  const next = previous
    .catch(() => {})
    .then(operation);
  deviceOpQueues.set(
    deviceId,
    next.then(
      () => undefined,
      () => undefined
    )
  );
  return next;
}

async function pollOnce(state: ManagedDeviceState) {
  const deviceId = state.deviceId;
  const wasConnected = state.connected;
  if (deviceStates.get(deviceId) !== state) {
    return;
  }
  const scheduleNext = () => {
    if (deviceStates.get(deviceId) !== state) {
      return;
    }
    const delay = state.connected ? state.pollIntervalMs : state.backoffMs || state.pollIntervalMs;
    if (state.pollTimer) clearTimeout(state.pollTimer);
    state.pollTimer = setTimeout(() => {
      queueDeviceOperation(deviceId, () => pollOnce(state)).catch((error) => {
        logger.error("Device poll failed", { device: deviceId, message: formatDeviceError(error) });
      });
    }, delay);
  };

  try {
    if (!isStrictStaffDeviceScope(state.scope) && state.mode === "AUTO" && state.pushEnabled) {
      const device = await prisma.device.findUnique({ where: { id: deviceId }, select: { lastPushAt: true } });
      if (device?.lastPushAt && isAutoPushActive(state.mode, state.pushEnabled, device.lastPushAt)) {
        if (state.connected) {
          await state.client.disconnect();
          state.connected = false;
        }
        state.pushActive = true;
        state.lastError = undefined;
        state.backoffMs = state.pollIntervalMs;
        scheduleNext();
        return;
      }
    }

    state.pushActive = false;

    if (!state.connected) {
      await state.client.connect();
      state.connected = true;
      state.lastError = undefined;
    }

    const events = await state.client.fetchNewEvents();
    const now = new Date();
    state.lastPollAt = now;
    state.lastError = undefined;
    if (events.length > 0) {
      state.lastEventAt = now;
    }
    state.backoffMs = state.pollIntervalMs;

    await prisma.device
      .update({
        where: { id: deviceId },
        data: {
          status: DeviceStatus.ONLINE,
          lastSeenAt: now,
          lastSuccessfulPollAt: now,
          ...(events.length > 0 ? { lastEventReceivedAt: now } : {}),
        },
      })
      .catch(() => {});

    if (events.length > 0) {
      const summary = await processDeviceEvents(events, {
        scope: state.scope,
        stopOnError: true,
        ...(!isStrictStaffDeviceScope(state.scope) && state.client instanceof ZktecoK40Client
          ? { unlockClient: state.client }
          : {}),
      });
      const processedAt = new Date();
      state.lastEventProcessedAt = processedAt;
      const updateCursor: Record<string, unknown> = {};
      if (summary.maxRecordId !== undefined) updateCursor["lastAttendanceRecordId"] = summary.maxRecordId;
      if (summary.maxTimestamp) updateCursor["lastAttendanceAt"] = summary.maxTimestamp;
      updateCursor["lastEventProcessedAt"] = processedAt;
      if (Object.keys(updateCursor).length > 0) {
        try {
          await prisma.device.update({ where: { id: deviceId }, data: updateCursor });
          if (state.client instanceof ZktecoK40Client) {
            state.client.setCursor({
              ...(summary.maxRecordId !== undefined ? { lastRecordId: summary.maxRecordId } : {}),
              ...(summary.maxTimestamp ? { lastTimestamp: summary.maxTimestamp } : {}),
            });
          }
        } catch {
          // Leave the in-memory cursor unchanged so a persistence failure is
          // retried on the next Pull cycle.
        }
      }
    }
  } catch (error) {
    state.connected = false;
    state.pushActive = false;
    state.lastError = formatDeviceError(error, "Device poll failed without details");
    state.lastErrorAt = new Date();
    state.backoffMs = Math.min((state.backoffMs || state.pollIntervalMs) * 2, MAX_BACKOFF_MS);

    await prisma.device
      .update({
        where: { id: deviceId },
        data: {
          status: DeviceStatus.ERROR,
          lastErrorAt: state.lastErrorAt,
          lastErrorMessage: state.lastError,
        },
      })
      .catch(() => {});

    if (wasConnected && !isStrictStaffDeviceScope(state.scope)) {
      try {
        await recordLegacyDisconnectInbox(state, deviceId);
      } catch {
        // ignore inbox failures
      }
    }

    try {
      await state.client.disconnect();
    } catch (disconnectError) {
      logger.warn("Failed to disconnect device", { device: deviceId, message: (disconnectError as Error).message });
    }
  } finally {
    scheduleNext();
  }
}

export async function startDevice(deviceId: string, scope: DeviceDataScope): Promise<void> {
  const device = await prisma.device.findUnique({ where: { id: deviceId } });
  if (!device) {
    await stopDevice(deviceId);
    return;
  }

  if (!device.enabled) {
    await stopDevice(deviceId);
    await prisma.device
      .update({ where: { id: deviceId }, data: { status: DeviceStatus.OFFLINE } })
      .catch(() => {});
    return;
  }

  if (isStrictStaffDeviceScope(scope) && !isAttendanceK40PullDevice(device)) {
    await stopDevice(deviceId);
    logger.warn("Skipped device outside Attendance K40 Pull allowlist", {
      device: device.id,
      type: device.type,
      connectionType: device.connectionType,
    });
    return;
  }
  await assertSingleAttendanceK40Device(device.id, scope);

  const mode = isStrictStaffDeviceScope(scope) ? ("PULL" as const) : getConfiguredEventMode(device.config);
  const pushEnabled = isStrictStaffDeviceScope(scope) ? false : isPushEnabled(device.config);
  if (mode === "PUSH") {
    await stopDevice(deviceId);
    logger.info("Device configured for PUSH mode; polling disabled", { device: device.id });
    return;
  }

  const signature = buildSignature(device, scope);
  const existing = deviceStates.get(deviceId);
  if (existing && existing.signature === signature) {
    return;
  }

  await stopDevice(deviceId);

  let client: DeviceClient;
  try {
    client = createClientForDevice(device);
  } catch (error) {
    const message = formatDeviceError(error, "Unable to create the device client");
    logger.error("Failed to create device client", { device: deviceId, message });
    const failedAt = new Date();
    await prisma.device
      .update({
        where: { id: deviceId },
        data: {
          status: DeviceStatus.ERROR,
          lastErrorAt: failedAt,
          lastErrorMessage: message,
        },
      })
      .catch(() => {});
    return;
  }

  const pollIntervalMs = resolvePollInterval(device.config);
  const state: ManagedDeviceState = {
    deviceId: device.id,
    deviceName: device.name,
    client,
    pollIntervalMs,
    backoffMs: pollIntervalMs,
    connected: false,
    pushActive: false,
    signature,
    mode,
    pushEnabled,
    scope,
  };

  if (client instanceof ZktecoK40Client) {
    client.setCursor({
      ...(device.lastAttendanceRecordId != null ? { lastRecordId: device.lastAttendanceRecordId } : {}),
      ...(device.lastAttendanceAt != null ? { lastTimestamp: device.lastAttendanceAt } : {}),
    });
  }

  deviceStates.set(device.id, state);
  logger.info("Started polling device", { device: device.id, everyMs: pollIntervalMs });
  await queueDeviceOperation(device.id, () => pollOnce(state));
}

export async function stopDevice(deviceId: string): Promise<void> {
  const state = deviceStates.get(deviceId);
  if (state?.pollTimer) {
    clearTimeout(state.pollTimer);
  }

  if (state) {
    deviceStates.delete(deviceId);
    await queueDeviceOperation(deviceId, async () => {
      try {
        await state.client.disconnect();
      } catch (error) {
        logger.warn("Failed to disconnect device", { device: deviceId, message: formatDeviceError(error) });
      }
    });
  }
}

export async function restartDevice(deviceId: string, scope: DeviceDataScope): Promise<void> {
  await stopDevice(deviceId);
  await startDevice(deviceId, scope);
}

export async function startAllActiveDevices(scope: DeviceDataScope): Promise<void> {
  const devices = await loadActiveDevicesFromDB(scope);
  for (const device of devices) {
    await startDevice(device.id, scope);
  }
}

export async function stopAllActiveDevices(): Promise<void> {
  const deviceIds = [...deviceStates.keys()];
  await Promise.all(deviceIds.map((deviceId) => stopDevice(deviceId)));
}

export async function loadActiveDevicesFromDB(scope: DeviceDataScope): Promise<Device[]> {
  const devices = await prisma.device.findMany({
    where: {
      enabled: true,
      ...(isStrictStaffDeviceScope(scope)
        ? {
            type: DeviceType.FINGERPRINT,
            connectionType: { in: [DeviceConnectionType.NETWORK, DeviceConnectionType.ZKTECO_PULL_SDK] },
          }
        : {}),
    },
  });
  if (isStrictStaffDeviceScope(scope) && devices.length > 1) {
    throw new HttpError(409, "Attendance Edition supports one enabled K40 Pull device");
  }
  return devices;
}

export function getDeviceStatuses() {
  return Array.from(deviceStates.values()).map((state) => ({
    id: state.deviceId,
    connected: state.connected || state.pushActive,
    lastPollAt: state.lastPollAt,
    lastEventAt: state.lastEventAt,
    lastEventProcessedAt: state.lastEventProcessedAt,
    lastError: state.lastError,
    lastErrorAt: state.lastErrorAt,
  }));
}

export function getRuntimeStatus(deviceId: string) {
  const state = deviceStates.get(deviceId);
  if (!state) return null;
  return {
    id: state.deviceId,
    connected: state.connected || state.pushActive,
    lastPollAt: state.lastPollAt,
    lastEventAt: state.lastEventAt,
    lastEventProcessedAt: state.lastEventProcessedAt,
    lastError: state.lastError,
    lastErrorAt: state.lastErrorAt,
  };
}

export async function testDeviceConnection(deviceId: string, scope: DeviceDataScope) {
  return queueDeviceOperation(deviceId, async () => {
    const device = await prisma.device.findUnique({ where: { id: deviceId } });
    if (!device) {
      if (isStrictStaffDeviceScope(scope)) throw new HttpError(404, "Device not found");
      throw new Error("Device not found");
    }
    assertDeviceAllowedForScope(device, scope);
    await assertSingleAttendanceK40Device(device.id, scope);

    let client: DeviceClient;
    try {
      client = createClientForDevice(device);
    } catch (error) {
      const failedAt = new Date();
      const message = formatDeviceError(error, "Unable to create the device client");
      await prisma.device
        .update({
          where: { id: deviceId },
          data: {
            status: DeviceStatus.ERROR,
            lastErrorAt: failedAt,
            lastErrorMessage: message,
          },
        })
        .catch(() => {});
      return { ok: false, status: DeviceStatus.ERROR, message };
    }

    try {
      await client.connect();
      await prisma.device
        .update({ where: { id: deviceId }, data: { status: DeviceStatus.ONLINE, lastSeenAt: new Date() } })
        .catch(() => {});
      return { ok: true, status: DeviceStatus.ONLINE };
    } catch (error) {
      const failedAt = new Date();
      const message = formatDeviceError(error, "Device connection failed without details");
      await prisma.device
        .update({
          where: { id: deviceId },
          data: {
            status: DeviceStatus.ERROR,
            lastErrorAt: failedAt,
            lastErrorMessage: message,
          },
        })
        .catch(() => {});
      return { ok: false, status: DeviceStatus.ERROR, message };
    } finally {
      try {
        await client.disconnect();
      } catch (disconnectError) {
        logger.warn("Failed to disconnect test client", { device: deviceId, message: (disconnectError as Error).message });
      }
    }
  });
}

type StrictStaffDeviceTarget = {
  id: string;
  code: string;
  firstName: string;
  lastName: string | null;
  externalId: number;
};

function resolvePhysicalDeviceUserId(
  rawUserId: string | number,
  strictTarget: StrictStaffDeviceTarget | null
): string | number {
  return strictTarget ? String(strictTarget.externalId) : rawUserId;
}

function normalizeLegacyDeviceExternalId(value: string | number): number | null {
  const externalId = Number(value);
  return Number.isInteger(externalId) && externalId > 0 ? externalId : null;
}

async function resolveStrictStaffDeviceTarget(rawUserId: string | number): Promise<StrictStaffDeviceTarget> {
  const externalId = normalizeDeviceExternalId(rawUserId);
  if (externalId === null) {
    throw new HttpError(404, "Employee not found");
  }

  const employee = await prisma.member.findFirst({
    where: {
      ...buildStrictStaffDeviceMemberWhere(),
      status: MemberStatus.ACTIVE,
      OR: [{ code: String(externalId) }, { deviceUser: { externalId } }],
    },
    select: {
      id: true,
      code: true,
      firstName: true,
      lastName: true,
    },
  });

  if (!employee) {
    throw new HttpError(404, "Employee not found");
  }

  return { ...employee, externalId };
}

async function ensureStrictStaffDeviceUserLink(
  deviceId: string,
  target: StrictStaffDeviceTarget
): Promise<void> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      await prisma.$transaction(
        async (tx) => {
          const currentEmployee = await tx.member.findFirst({
            where: {
              id: target.id,
              code: target.code,
              ...buildStrictStaffDeviceMemberWhere(),
              status: MemberStatus.ACTIVE,
            },
            select: { id: true },
          });
          if (!currentEmployee) {
            throw new HttpError(404, "Employee not found");
          }

          const [byExternalId, byMember] = await Promise.all([
            tx.deviceUser.findUnique({
              where: { externalId: target.externalId },
              select: { id: true, externalId: true, memberId: true, deviceId: true, lastSyncedAt: true },
            }),
            tx.deviceUser.findUnique({
              where: { memberId: target.id },
              select: { id: true, externalId: true, memberId: true, deviceId: true, lastSyncedAt: true },
            }),
          ]);

          if (byExternalId?.memberId && byExternalId.memberId !== target.id) {
            throw new HttpError(409, "Device user ID is already assigned");
          }
          if (byMember && byMember.externalId !== target.externalId) {
            throw new HttpError(409, "Employee is already assigned to another device user ID");
          }
          if (
            (byExternalId?.deviceId && byExternalId.deviceId !== deviceId) ||
            (byMember?.deviceId && byMember.deviceId !== deviceId)
          ) {
            throw new HttpError(409, "Employee is already assigned to another device");
          }

          if (byExternalId) {
            const unchangedConfirmedLink =
              byExternalId.memberId === target.id && byExternalId.deviceId === deviceId;
            const claimed = await tx.deviceUser.updateMany({
              where: {
                id: byExternalId.id,
                externalId: byExternalId.externalId,
                memberId: byExternalId.memberId,
                deviceId: byExternalId.deviceId,
              },
              data: {
                memberId: target.id,
                deviceId,
                ...(!unchangedConfirmedLink ? { lastSyncedAt: null } : {}),
              },
            });
            if (claimed.count !== 1) {
              throw new HttpError(409, "Device user mapping changed during synchronization");
            }
            return;
          }

          await tx.deviceUser.create({
            data: {
              externalId: target.externalId,
              memberId: target.id,
              deviceId,
              lastSyncedAt: null,
            },
          });
        },
        { isolationLevel: "Serializable" }
      );
      return;
    } catch (error) {
      lastError = error;
      const code = (error as { code?: string })?.code;
      if (code === "P2034" && attempt < 3) continue;
      if (code === "P2002" || code === "P2034") {
        throw new HttpError(409, "Device user mapping changed during synchronization");
      }
      throw error;
    }
  }
  throw lastError;
}

async function requireStrictStaffDeviceUserLink(
  deviceId: string,
  target: StrictStaffDeviceTarget
): Promise<void> {
  const mapping = await prisma.deviceUser.findFirst({
    where: {
      externalId: target.externalId,
      memberId: target.id,
      deviceId,
      lastSyncedAt: { not: null },
      member: {
        is: {
          ...buildStrictStaffDeviceMemberWhere(),
          status: MemberStatus.ACTIVE,
        },
      },
    },
    select: { id: true },
  });
  if (!mapping) {
    throw new HttpError(404, "Employee not found");
  }
}

async function clearStrictStaffDeviceUserBinding(
  deviceId: string,
  target: StrictStaffDeviceTarget
): Promise<void> {
  const cleared = await prisma.deviceUser.updateMany({
    where: {
      externalId: target.externalId,
      memberId: target.id,
      deviceId,
      lastSyncedAt: { not: null },
      member: {
        is: {
          ...buildStrictStaffDeviceMemberWhere(),
          status: MemberStatus.ACTIVE,
        },
      },
    },
    data: { deviceId: null, lastSyncedAt: null },
  });
  if (cleared.count !== 1) {
    throw new HttpError(404, "Employee not found");
  }
}

async function markStrictStaffDeviceUserSynced(target: StrictStaffDeviceTarget, deviceId: string): Promise<void> {
  const updated = await prisma.deviceUser.updateMany({
    where: {
      externalId: target.externalId,
      memberId: target.id,
      deviceId,
      member: buildStrictStaffDeviceMemberWhere(),
    },
    data: { lastSyncedAt: new Date() },
  });
  if (updated.count !== 1) {
    throw new HttpError(409, "Employee device mapping changed during synchronization");
  }
}

export async function enrollDevice(
  deviceId: string,
  payload: { userId: string; fingerId?: number; name?: string },
  scope: DeviceDataScope
) {
  return queueDeviceOperation(deviceId, async () => {
    const device = await prisma.device.findUnique({ where: { id: deviceId } });
    if (!device) {
      throw new HttpError(404, "Device not found");
    }

    assertDeviceAllowedForScope(device, scope);
    await assertSingleAttendanceK40Device(device.id, scope);

    if (device.type !== DeviceType.FINGERPRINT) {
      throw new HttpError(400, "Enrollment is only supported for fingerprint devices");
    }

    if (!isZktecoConnectionType(device.connectionType)) {
      throw new HttpError(400, "Enrollment is only supported for ZKTeco devices");
    }
    const strictTarget = isStrictStaffDeviceScope(scope)
      ? await resolveStrictStaffDeviceTarget(payload.userId)
      : null;
    if (strictTarget) {
      await ensureStrictStaffDeviceUserLink(deviceId, strictTarget);
    }

    const canonicalName = strictTarget
      ? `${strictTarget.firstName} ${strictTarget.lastName ?? ""}`.trim()
      : payload.name;
    const cleanedName = canonicalName?.trim() ? canonicalName.trim().slice(0, 24) : undefined;
    const physicalUserId = resolvePhysicalDeviceUserId(payload.userId, strictTarget);
    const state = deviceStates.get(deviceId);
    if (state?.client instanceof ZktecoK40Client) {
      if (cleanedName) {
        await state.client.upsertUser({ userId: physicalUserId, name: cleanedName });
      }
      await state.client.enrollFingerprint({
        userId: physicalUserId,
        ...(payload.fingerId !== undefined ? { fingerId: payload.fingerId } : {}),
      });
      if (strictTarget) {
        await markStrictStaffDeviceUserSynced(strictTarget, device.id);
      } else {
        await upsertDeviceUserLink(device.id, payload.userId);
      }
      return { ok: true, mode: "active", ...(strictTarget ? { employeeId: strictTarget.id } : {}) };
    }

    const client = createClientForDevice(device);
    if (!(client instanceof ZktecoK40Client)) {
      throw new HttpError(400, "Enrollment is not supported for this device");
    }

    try {
      await client.connect();
      if (cleanedName) {
        await client.upsertUser({ userId: physicalUserId, name: cleanedName });
      }
      await client.enrollFingerprint({
        userId: physicalUserId,
        ...(payload.fingerId !== undefined ? { fingerId: payload.fingerId } : {}),
      });
      if (strictTarget) {
        await markStrictStaffDeviceUserSynced(strictTarget, device.id);
      } else {
        await upsertDeviceUserLink(device.id, payload.userId);
      }
      return { ok: true, mode: "temporary", ...(strictTarget ? { employeeId: strictTarget.id } : {}) };
    } finally {
      await client.disconnect();
    }
  });
}

async function loadZktecoDeviceForOperation(deviceId: string, scope: DeviceDataScope): Promise<Device> {
  const device = await prisma.device.findUnique({ where: { id: deviceId } });
  if (!device) {
    throw new HttpError(404, "Device not found");
  }

  assertDeviceAllowedForScope(device, scope);
  await assertSingleAttendanceK40Device(device.id, scope);

  if (device.type !== DeviceType.FINGERPRINT) {
    throw new HttpError(400, "Operation is only supported for fingerprint devices");
  }

  if (!isZktecoConnectionType(device.connectionType)) {
    throw new HttpError(400, "Operation is only supported for ZKTeco devices");
  }
  return device;
}

async function resolveZktecoClient(
  deviceId: string,
  scope: DeviceDataScope,
  prevalidatedDevice?: Device
) {
  const device = prevalidatedDevice ?? (await loadZktecoDeviceForOperation(deviceId, scope));
  const state = deviceStates.get(deviceId);
  if (state?.client instanceof ZktecoK40Client) {
    return { device, client: state.client, mode: "active" as const };
  }

  const client = createClientForDevice(device);
  if (!(client instanceof ZktecoK40Client)) {
    throw new HttpError(400, "Operation is not supported for this device");
  }

  await client.connect();
  return {
    device,
    client,
    mode: "temporary" as const,
    disconnect: async () => {
      await client.disconnect();
    },
  };
}

export async function deleteDeviceUser(
  deviceId: string,
  payload: { userId?: string | number; uid?: number },
  scope: DeviceDataScope
) {
  if (payload.userId === undefined && payload.uid === undefined) {
    throw new HttpError(400, "User ID is required for deletion");
  }

  return queueDeviceOperation(deviceId, async () => {
    let strictTarget: StrictStaffDeviceTarget | null = null;
    let strictDevice: Device | undefined;
    if (isStrictStaffDeviceScope(scope)) {
      strictDevice = await loadZktecoDeviceForOperation(deviceId, scope);
      strictTarget = await resolveStrictStaffDeviceTarget(payload.userId ?? "");
      await requireStrictStaffDeviceUserLink(deviceId, strictTarget);
      // Fail closed before physical I/O: a failed delete leaves the mapping
      // untrusted, so subsequent punches cannot impersonate the Employee.
      await clearStrictStaffDeviceUserBinding(deviceId, strictTarget);
    }

    const { client, mode, disconnect } = await resolveZktecoClient(deviceId, scope, strictDevice);
    try {
      await client.deleteUser({
        ...(strictTarget
          ? { userId: String(strictTarget.externalId) }
          : payload.userId !== undefined
            ? { userId: payload.userId }
            : {}),
        ...(payload.uid !== undefined ? { uid: payload.uid } : {}),
      });
      return { ok: true, mode, ...(strictTarget ? { employeeId: strictTarget.id } : {}) };
    } finally {
      if (disconnect) {
        await disconnect();
      }
    }
  });
}

export async function listDeviceUsers(deviceId: string, scope: DeviceDataScope) {
  return queueDeviceOperation(deviceId, async () => {
    const { client, mode, disconnect } = await resolveZktecoClient(deviceId, scope);
    try {
      const users = await client.listUsers();
      if (isStrictStaffDeviceScope(scope)) {
        const externalIds = Array.from(
          new Set(
            users
              .map((user) => normalizeCanonicalPhysicalDeviceExternalId(user.userId))
              .filter((value): value is number => value !== null)
          )
        );
        const mappings = await prisma.deviceUser.findMany({
          where: {
            externalId: { in: externalIds },
            deviceId,
            lastSyncedAt: { not: null },
            memberId: { not: null },
            member: {
              is: {
                ...buildStrictStaffDeviceMemberWhere(),
                status: MemberStatus.ACTIVE,
              },
            },
          },
          select: {
            externalId: true,
            member: {
              select: {
                firstName: true,
                lastName: true,
              },
            },
          },
        });
        const byExternalId = new Map(mappings.map((mapping) => [mapping.externalId, mapping.member]));
        const items = users.flatMap((user) => {
          const externalId = normalizeCanonicalPhysicalDeviceExternalId(user.userId);
          if (externalId === null) return [];
          const employee = byExternalId.get(externalId);
          if (!employee) return [];
          return [
            {
              uid: user.uid,
              userId: String(externalId),
              name: `${employee.firstName} ${employee.lastName ?? ""}`.trim(),
            },
          ];
        });
        return { items, mode };
      }

      const items = users.map((user) => ({ uid: user.uid, userId: user.userId, name: user.name }));
      return { items, mode };
    } finally {
      if (disconnect) {
        await disconnect();
      }
    }
  });
}

export async function upsertDeviceUser(
  deviceId: string,
  payload: { userId: string | number; name: string },
  scope: DeviceDataScope
) {
  const strictTarget = isStrictStaffDeviceScope(scope)
    ? await resolveStrictStaffDeviceTarget(payload.userId)
    : null;
  const trimmedName = strictTarget
    ? `${strictTarget.firstName} ${strictTarget.lastName ?? ""}`.trim().slice(0, 24)
    : payload.name.trim();
  if (!trimmedName) {
    throw new HttpError(400, "User name is required");
  }
  return queueDeviceOperation(deviceId, async () => {
    const strictDevice = strictTarget
      ? await loadZktecoDeviceForOperation(deviceId, scope)
      : undefined;
    if (strictTarget) {
      await ensureStrictStaffDeviceUserLink(deviceId, strictTarget);
    }
    const { client, mode, disconnect } = await resolveZktecoClient(deviceId, scope, strictDevice);
    try {
      await client.upsertUser({
        userId: strictTarget ? String(strictTarget.externalId) : payload.userId,
        name: trimmedName,
      });
      if (strictTarget) {
        await markStrictStaffDeviceUserSynced(strictTarget, deviceId);
      } else {
        await upsertDeviceUserLink(deviceId, payload.userId);
      }
      return { ok: true, mode, ...(strictTarget ? { employeeId: strictTarget.id } : {}) };
    } finally {
      if (disconnect) {
        await disconnect();
      }
    }
  });
}

export async function syncDeviceUsers(deviceId: string, scope: DeviceDataScope) {
  return queueDeviceOperation(deviceId, async () => {
    const { client, mode, disconnect } = await resolveZktecoClient(deviceId, scope);
    try {
      const users = await client.listUsers();
      let synced = 0;
      let skipped = 0;
      for (const user of users) {
        if (isStrictStaffDeviceScope(scope)) {
          const externalId = normalizeCanonicalPhysicalDeviceExternalId(user.userId);
          if (externalId === null) {
            skipped += 1;
            continue;
          }
          try {
            const target = await resolveStrictStaffDeviceTarget(externalId);
            await ensureStrictStaffDeviceUserLink(deviceId, target);
            await markStrictStaffDeviceUserSynced(target, deviceId);
          } catch (error) {
            if (error instanceof HttpError && (error.status === 404 || error.status === 409)) {
              skipped += 1;
              continue;
            }
            throw error;
          }
        } else {
          // Preserve FULL's legacy numeric coercion. Attendance uses the
          // canonical digit-only/Prisma-Int parser above.
          const externalId = normalizeLegacyDeviceExternalId(user.userId);
          if (externalId === null) {
            skipped += 1;
            continue;
          }
          await prisma.deviceUser.upsert({
            where: { externalId },
            create: { externalId, deviceId },
            update: { deviceId },
          });
        }
        synced += 1;
      }
      return { total: users.length, synced, skipped, mode };
    } finally {
      if (disconnect) {
        await disconnect();
      }
    }
  });
}

export async function getDeviceTime(deviceId: string, scope: DeviceDataScope) {
  return queueDeviceOperation(deviceId, async () => {
    const { client, mode, disconnect } = await resolveZktecoClient(deviceId, scope);
    try {
      const time = await client.getDeviceTime();
      return { time, mode };
    } finally {
      if (disconnect) {
        await disconnect();
      }
    }
  });
}

export async function setDeviceTime(deviceId: string, timestamp: Date, scope: DeviceDataScope) {
  return queueDeviceOperation(deviceId, async () => {
    const { client, mode, disconnect } = await resolveZktecoClient(deviceId, scope);
    try {
      await client.setDeviceTime(timestamp);
      return { time: timestamp, mode };
    } finally {
      if (disconnect) {
        await disconnect();
      }
    }
  });
}

export async function unlockDeviceDoor(deviceId: string, seconds: number | undefined, scope: DeviceDataScope) {
  if (isStrictStaffDeviceScope(scope)) {
    throw new HttpError(404, "Not Found");
  }
  return queueDeviceOperation(deviceId, async () => {
    const { client, mode, disconnect } = await resolveZktecoClient(deviceId, scope);
    const duration = typeof seconds === "number" ? seconds : DEFAULT_UNLOCK_SECONDS;
    try {
      await client.unlockDoor(duration);
      return { ok: true, seconds: duration, mode };
    } finally {
      if (disconnect) {
        await disconnect();
      }
    }
  });
}

export async function fetchDeviceAttendanceLogs(deviceId: string, limit: number | undefined, scope: DeviceDataScope) {
  return queueDeviceOperation(deviceId, async () => {
    const { client, mode, disconnect } = await resolveZktecoClient(deviceId, scope);
    try {
      const events = await client.fetchAttendanceLogs();
      const items = events.map((event) => ({
        externalUserId: event.externalUserId,
        timestamp: event.timestamp,
        eventType: event.eventType,
        recordId: event.recordId,
      }));
      const bounded = typeof limit === "number" ? items.slice(-limit) : items;
      return { count: items.length, items: bounded, mode };
    } finally {
      if (disconnect) {
        await disconnect();
      }
    }
  });
}

export async function clearDeviceAttendanceLogs(deviceId: string, scope: DeviceDataScope) {
  return queueDeviceOperation(deviceId, async () => {
    const { client, mode, disconnect } = await resolveZktecoClient(deviceId, scope);
    try {
      await client.clearAttendanceLogs();
      return { ok: true, mode };
    } finally {
      if (disconnect) {
        await disconnect();
      }
    }
  });
}

export async function suggestDeviceUserId(deviceId: string, scope: DeviceDataScope) {
  return queueDeviceOperation(deviceId, async () => {
    const device = await prisma.device.findUnique({ where: { id: deviceId } });
    if (!device) {
      throw new HttpError(404, "Device not found");
    }

    assertDeviceAllowedForScope(device, scope);
    await assertSingleAttendanceK40Device(device.id, scope);

    if (device.type !== DeviceType.FINGERPRINT) {
      throw new HttpError(400, "User IDs are only supported for fingerprint devices");
    }

    if (!isZktecoConnectionType(device.connectionType)) {
      throw new HttpError(400, "User IDs are only supported for ZKTeco devices");
    }
    const dbUsers = await prisma.deviceUser.findMany({ select: { externalId: true } });
    const usedIds = new Set<number>(dbUsers.map((u) => u.externalId));

    const state = deviceStates.get(deviceId);
    if (state?.client instanceof ZktecoK40Client) {
      if (!state.connected) {
        await state.client.connect();
        state.connected = true;
      }
      const users = await state.client.listUsers();
      users.forEach((user) => {
        const userId = Number(user.userId);
        if (Number.isInteger(userId)) usedIds.add(userId);
        if (Number.isInteger(user.uid)) usedIds.add(user.uid);
      });
    } else {
      const client = createClientForDevice(device);
      if (!(client instanceof ZktecoK40Client)) {
        throw new HttpError(400, "User IDs are not supported for this device");
      }
      try {
        await client.connect();
        const users = await client.listUsers();
        users.forEach((user) => {
          const userId = Number(user.userId);
          if (Number.isInteger(userId)) usedIds.add(userId);
          if (Number.isInteger(user.uid)) usedIds.add(user.uid);
        });
      } finally {
        await client.disconnect();
      }
    }

    for (let candidate = 1; candidate <= 3000; candidate += 1) {
      if (!usedIds.has(candidate)) {
        return { userId: String(candidate) };
      }
    }

    throw new HttpError(409, "No available user IDs found");
  });
}

export const deviceManagerTestHooks = Object.freeze({
  resolveStrictStaffDeviceTarget,
  ensureStrictStaffDeviceUserLink,
  requireStrictStaffDeviceUserLink,
  clearStrictStaffDeviceUserBinding,
  loadZktecoDeviceForOperation,
  assertDeviceAllowedForScope,
  assertSingleAttendanceK40Device,
  resolvePhysicalDeviceUserId,
  normalizeLegacyDeviceExternalId,
  normalizeCanonicalPhysicalDeviceExternalId,
  installManagedK40Client(
    deviceId: string,
    client: ZktecoK40Client,
    scope: DeviceDataScope
  ): () => void {
    const previous = deviceStates.get(deviceId);
    deviceStates.set(deviceId, {
      deviceId,
      deviceName: "Test K40",
      client,
      pollIntervalMs: DEFAULT_POLL_INTERVAL_MS,
      backoffMs: DEFAULT_POLL_INTERVAL_MS,
      connected: true,
      pushActive: false,
      signature: "test-managed-k40",
      mode: "PULL",
      pushEnabled: false,
      scope,
    });
    return () => {
      if (previous) deviceStates.set(deviceId, previous);
      else deviceStates.delete(deviceId);
    };
  },
});

async function upsertDeviceUserLink(deviceId: string, rawUserId: string | number) {
  const externalId = Number(rawUserId);
  if (!Number.isInteger(externalId)) {
    return;
  }

  try {
    await prisma.deviceUser.upsert({
      where: { externalId },
      create: { externalId, deviceId },
      update: { deviceId },
    });
  } catch (error) {
    logger.warn("Failed to link device user after enrollment", {
      deviceId,
      externalId,
      message: formatDeviceError(error),
    });
  }
}
