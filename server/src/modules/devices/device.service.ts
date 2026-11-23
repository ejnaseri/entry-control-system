import {
  AuditActor,
  DeviceConnectionType,
  DeviceStatus,
  Prisma,
  type AdminRole,
  type Device,
} from "@prisma/client";
import { isDeepStrictEqual } from "node:util";
import { prisma } from "../../lib/prisma";
import { HttpError } from "../../middlewares/error-handler";
import {
  type DeviceCreateInput,
  type DeviceFilterInput,
  type DeviceUpdateInput,
  sanitizeConfig,
} from "./device.schemas";
import {
  FULL_DEVICE_DATA_SCOPE,
  isAttendanceK40PullDevice,
  isAttendanceK40PullDeviceInput,
  isStrictStaffDeviceScope,
  type DeviceDataScope,
} from "./device-edition-scope";

export type DeviceActionContext = {
  actor: {
    id: string;
    role: AdminRole;
    sessionId?: string;
  };
  meta: {
    ipAddress?: string;
    userAgent?: string;
  };
};

type DeviceAuditAction = "device.created" | "device.updated" | "device.enabled" | "device.disabled";

type DeviceAuditInput = {
  action: DeviceAuditAction;
  targetId: string;
  beforeData?: Prisma.InputJsonObject;
  afterData?: Prisma.InputJsonObject;
  metadata?: Prisma.InputJsonObject;
};

export async function listDevices(filters: DeviceFilterInput) {
  const where: Prisma.DeviceWhereInput = {};
  if (filters.type) where.type = filters.type;
  if (filters.connectionType) where.connectionType = filters.connectionType;
  if (filters.status) where.status = filters.status;
  if (typeof filters.enabled === "boolean") where.enabled = filters.enabled;
  if (filters.search) {
    where.name = { contains: filters.search, mode: "insensitive" };
  }

  return prisma.device.findMany({
    where,
    orderBy: { updatedAt: "desc" },
  });
}

export async function getDevice(id: string) {
  const device = await prisma.device.findUnique({ where: { id } });
  if (!device) {
    throw new HttpError(404, "Device not found");
  }
  return device;
}

const ATTENDANCE_K40_PILOT_ADVISORY_LOCK_ID = 2_023_081_101;

async function assertStrictPilotSlotAvailableInTransaction(
  tx: Prisma.TransactionClient,
  candidateId?: string
) {
  // The HTTP preflight is only an early error. This transaction-scoped lock is
  // the authoritative guard against concurrent enabled K40 mutations.
  // PostgreSQL exposes pg_advisory_xact_lock as a void-returning function.
  // Prisma 7 cannot deserialize that void column through $queryRaw, while
  // $executeRaw still executes the SELECT and keeps the lock transaction-scoped.
  await tx.$executeRaw(Prisma.sql`SELECT pg_advisory_xact_lock(${ATTENDANCE_K40_PILOT_ADVISORY_LOCK_ID})`);
  const existing = await tx.device.findFirst({
    where: {
      enabled: true,
      type: "FINGERPRINT",
      connectionType: { in: ["NETWORK", "ZKTECO_PULL_SDK"] },
      ...(candidateId ? { id: { not: candidateId } } : {}),
    },
    select: { id: true },
  });
  if (existing) {
    throw new HttpError(409, "Attendance Edition supports one enabled K40 Pull device");
  }
}

function assertStrictDeviceInput(input: DeviceCreateInput | DeviceUpdateInput, scope: DeviceDataScope) {
  if (isStrictStaffDeviceScope(scope) && !isAttendanceK40PullDeviceInput(input)) {
    throw new HttpError(400, "Attendance Edition supports fingerprint K40 Pull devices only");
  }
}

export async function createDevice(
  input: DeviceCreateInput,
  context: DeviceActionContext,
  scope: DeviceDataScope = FULL_DEVICE_DATA_SCOPE
) {
  assertStrictDeviceInput(input, scope);
  const normalizedConfig = sanitizeConfig(input.connectionType, input.config);

  return prisma.$transaction(async (tx) => {
    if (isStrictStaffDeviceScope(scope) && input.enabled) {
      await assertStrictPilotSlotAvailableInTransaction(tx);
    }
    const created = await tx.device.create({
      data: {
        name: input.name,
        type: input.type,
        connectionType: input.connectionType,
        enabled: input.enabled,
        status: DeviceStatus.UNKNOWN,
        lastSeenAt: null,
        config: normalizedConfig as Prisma.InputJsonValue,
        model: input.model ?? null,
        serialNumber: input.serialNumber ?? null,
      },
    });
    await tx.auditLog.create({
      data: buildDeviceAuditData(context, {
        action: "device.created",
        targetId: created.id,
        afterData: toDeviceAuditJson(created),
      }),
    });
    return created;
  });
}

export async function updateDevice(
  id: string,
  input: DeviceUpdateInput,
  context: DeviceActionContext,
  scope: DeviceDataScope = FULL_DEVICE_DATA_SCOPE
) {
  assertStrictDeviceInput(input, scope);
  const normalizedConfig = sanitizeConfig(input.connectionType, input.config);
  return prisma.$transaction(async (tx) => {
    const existing = await tx.device.findUnique({ where: { id } });
    if (!existing) {
      throw new HttpError(404, "Device not found");
    }
    if (isStrictStaffDeviceScope(scope) && input.enabled) {
      await assertStrictPilotSlotAvailableInTransaction(tx, id);
    }

    const configChanged = !isDeepStrictEqual(existing.config ?? {}, normalizedConfig ?? {});
    const connectionChanged = existing.connectionType !== input.connectionType;
    const updated = await tx.device.update({
      where: { id },
      data: {
        name: input.name,
        type: input.type,
        connectionType: input.connectionType,
        enabled: input.enabled,
        config: normalizedConfig as Prisma.InputJsonValue,
        model: input.model ?? null,
        serialNumber: input.serialNumber ?? null,
        status: input.status ?? (connectionChanged || configChanged ? DeviceStatus.UNKNOWN : existing.status),
        // Reset lastSeenAt only when we know the device is online again (handled in test)
      },
    });
    await tx.auditLog.create({
      data: buildDeviceAuditData(context, {
        action: "device.updated",
        targetId: updated.id,
        beforeData: toDeviceAuditJson(existing),
        afterData: toDeviceAuditJson(updated),
        metadata: { changedFields: getDeviceChangedFields(existing, updated) },
      }),
    });
    if (existing.enabled !== updated.enabled) {
      await tx.auditLog.create({
        data: buildDeviceAuditData(context, {
          action: updated.enabled ? "device.enabled" : "device.disabled",
          targetId: updated.id,
          beforeData: toDeviceAuditJson(existing),
          afterData: toDeviceAuditJson(updated),
          metadata: { source: "DEVICE_UPDATE", alreadyInRequestedState: false },
        }),
      });
    }
    return updated;
  });
}

export async function setDeviceEnabled(
  id: string,
  enabled: boolean,
  context: DeviceActionContext,
  scope: DeviceDataScope = FULL_DEVICE_DATA_SCOPE
) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.device.findUnique({ where: { id } });
    if (!existing) {
      throw new HttpError(404, "Device not found");
    }
    if (isStrictStaffDeviceScope(scope)) {
      if (!isAttendanceK40PullDevice(existing)) {
        throw new HttpError(404, "Device not found");
      }
      if (enabled) {
        await assertStrictPilotSlotAvailableInTransaction(tx, id);
      }
    }
    const updated = await tx.device.update({
      where: { id },
      data: {
        enabled,
        status: enabled ? DeviceStatus.UNKNOWN : DeviceStatus.OFFLINE,
      },
    });
    await tx.auditLog.create({
      data: buildDeviceAuditData(context, {
        action: enabled ? "device.enabled" : "device.disabled",
        targetId: updated.id,
        beforeData: toDeviceAuditJson(existing),
        afterData: toDeviceAuditJson(updated),
        metadata: {
          source: "ENABLE_DISABLE_ENDPOINT",
          alreadyInRequestedState: existing.enabled === enabled,
          changedFields: getDeviceChangedFields(existing, updated),
        },
      }),
    });
    return updated;
  });
}

export const deviceServiceTestHooks = Object.freeze({
  assertStrictPilotSlotAvailableInTransaction,
});

function buildDeviceAuditData(
  context: DeviceActionContext,
  input: DeviceAuditInput
): Prisma.AuditLogUncheckedCreateInput {
  const data: Prisma.AuditLogUncheckedCreateInput = {
    actorType: AuditActor.ADMIN,
    actorId: context.actor.id,
    actorRole: context.actor.role,
    action: input.action,
    targetType: "Device",
    targetId: input.targetId,
    success: true,
  };
  if (context.actor.sessionId) data.sessionId = context.actor.sessionId;
  if (context.meta.ipAddress) data.ipAddress = context.meta.ipAddress;
  if (context.meta.userAgent) data.userAgent = context.meta.userAgent;
  if (input.beforeData) data.beforeData = input.beforeData;
  if (input.afterData) data.afterData = input.afterData;
  if (input.metadata) data.metadata = input.metadata;
  return data;
}

function toDeviceAuditJson(device: Device): Prisma.InputJsonObject {
  return {
    id: device.id,
    name: device.name,
    type: device.type,
    connectionType: device.connectionType,
    enabled: device.enabled,
    status: device.status,
    model: device.model ?? "",
    serialNumber: device.serialNumber ?? "",
    config: toSafeDeviceConfig(device.connectionType, device.config),
  };
}

function toSafeDeviceConfig(
  connectionType: DeviceConnectionType,
  config: Prisma.JsonValue
): Prisma.InputJsonObject {
  if (!config || typeof config !== "object" || Array.isArray(config)) return {};
  const source = config as Prisma.JsonObject;
  const allowedKeys: Record<DeviceConnectionType, readonly string[]> = {
    [DeviceConnectionType.NETWORK]: [
      "ip", "port", "dns", "gateway", "subnet", "timeoutMs", "pollIntervalMs", "protocol", "eventMode", "pushEnabled",
    ],
    [DeviceConnectionType.ZKTECO_PULL_SDK]: [
      "ip", "port", "dns", "gateway", "subnet", "timeoutMs", "pollIntervalMs", "protocol", "eventMode", "pushEnabled",
    ],
    [DeviceConnectionType.USB]: ["vendorId", "productId", "driver", "timeoutMs"],
    [DeviceConnectionType.SERIAL]: ["comPort", "baudRate", "parity", "stopBits", "dataBits", "timeoutMs"],
  };
  const safe: Record<string, string | number | boolean> = {};
  for (const key of allowedKeys[connectionType]) {
    const value = source[key];
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
      safe[key] = value;
    }
  }
  return safe;
}

function getDeviceChangedFields(before: Device, after: Device) {
  const values: Array<[string, unknown, unknown]> = [
    ["name", before.name, after.name],
    ["type", before.type, after.type],
    ["connectionType", before.connectionType, after.connectionType],
    ["enabled", before.enabled, after.enabled],
    ["status", before.status, after.status],
    ["model", before.model, after.model],
    ["serialNumber", before.serialNumber, after.serialNumber],
    ["config", before.config, after.config],
  ];
  return values
    .filter(([, beforeValue, afterValue]) => !isDeepStrictEqual(beforeValue, afterValue))
    .map(([field]) => field);
}
