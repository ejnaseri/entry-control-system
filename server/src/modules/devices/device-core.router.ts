import { AdminPermission, AttendanceSource, DeviceStatus, MemberType } from "@prisma/client";
import { Router } from "express";
import type { AppEdition } from "../../shared/app-identity";
import { requirePermission } from "../../middlewares/auth";
import { HttpError } from "../../middlewares/error-handler";
import { prisma } from "../../lib/prisma";
import {
  getRecentEvents as getDefaultRecentEvents,
  getRecentStrictStaffEvents as getDefaultRecentStrictStaffEvents,
  subscribeSse as subscribeDefaultSse,
  subscribeStrictStaffSse as subscribeDefaultStrictStaffSse,
} from "./device.events";
import {
  deviceCreateSchema,
  deviceEnrollSchema,
  deviceFilterSchema,
  deviceIdParamSchema,
  deviceTimeUpdateSchema,
  deviceUpdateSchema,
  deviceUserDeleteSchema,
  strictDeviceUserDeleteSchema,
  deviceUserUpsertSchema,
} from "./device.schemas";
import { runAuditedDeviceCommand as runDefaultAuditedDeviceCommand } from "./deviceCommandAudit.service";
import {
  getDeviceActionContext,
  summarizeConnectionTestAudit,
  toSafeDeviceDto,
  toRuntimeSnapshot,
  type DeviceRuntimeSnapshot,
} from "./device-router.shared";
import {
  getDeviceDataScope,
  isAttendanceK40PullDevice,
  isAttendanceK40PullDeviceInput,
  isStrictStaffDeviceScope,
  normalizeCanonicalPhysicalDeviceExternalId,
  type DeviceDataScope,
} from "./device-edition-scope";

type DeviceManagerModule = typeof import("./deviceManager");
type DeviceServiceModule = typeof import("./device.service");

function loadDefaultDeviceManager(): DeviceManagerModule {
  return require("./deviceManager") as DeviceManagerModule;
}

function loadDefaultDeviceService(): DeviceServiceModule {
  return require("./device.service") as DeviceServiceModule;
}

function readStrictHistoricalExternalUserId(payload: unknown): string {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return "";
  const value = (payload as Record<string, unknown>)["externalUserId"];
  if (typeof value !== "string" && typeof value !== "number") return "";
  const externalId = normalizeCanonicalPhysicalDeviceExternalId(value);
  return externalId === null ? "" : String(externalId);
}

export type DeviceCoreRouterApi = Readonly<{
  loadManager: () => DeviceManagerModule;
  loadService: () => DeviceServiceModule;
  prisma: Pick<typeof prisma, "attendanceLog" | "device">;
  getRecentEvents: typeof getDefaultRecentEvents;
  getRecentStrictStaffEvents: typeof getDefaultRecentStrictStaffEvents;
  subscribeSse: typeof subscribeDefaultSse;
  subscribeStrictStaffSse: typeof subscribeDefaultStrictStaffSse;
  runAuditedDeviceCommand: typeof runDefaultAuditedDeviceCommand;
}>;

const defaultDeviceCoreRouterApi: DeviceCoreRouterApi = Object.freeze({
  loadManager: loadDefaultDeviceManager,
  loadService: loadDefaultDeviceService,
  prisma,
  getRecentEvents: getDefaultRecentEvents,
  getRecentStrictStaffEvents: getDefaultRecentStrictStaffEvents,
  subscribeSse: subscribeDefaultSse,
  subscribeStrictStaffSse: subscribeDefaultStrictStaffSse,
  runAuditedDeviceCommand: runDefaultAuditedDeviceCommand,
});

export function createDeviceCoreRouter(edition: AppEdition, api: Partial<DeviceCoreRouterApi> = {}) {
  return createDeviceCoreRouterForScope(getDeviceDataScope(edition), api);
}

export function createDeviceCoreRouterForScope(
  scope: DeviceDataScope,
  overrides: Partial<DeviceCoreRouterApi> = {}
) {
  const router = Router();
  const api: DeviceCoreRouterApi = { ...defaultDeviceCoreRouterApi, ...overrides };
  const strictStaff = isStrictStaffDeviceScope(scope);
  const connectionCommandPermission = strictStaff
    ? []
    : [requirePermission(AdminPermission.DEVICES_DIAGNOSTICS)];
  const timeUpdatePermission = strictStaff
    ? [requirePermission(AdminPermission.SYSTEM_SETTINGS_MANAGE)]
    : [requirePermission(AdminPermission.DEVICES_DIAGNOSTICS)];
  const enrollSchema = strictStaff ? deviceEnrollSchema.strict() : deviceEnrollSchema;
  const userUpsertSchema = strictStaff ? deviceUserUpsertSchema.strict() : deviceUserUpsertSchema;
  const userDeleteSchema = strictStaff ? strictDeviceUserDeleteSchema : deviceUserDeleteSchema;
  const timeSchema = strictStaff ? deviceTimeUpdateSchema.strict() : deviceTimeUpdateSchema;
  const requireStrictDevice = <T extends Parameters<typeof isAttendanceK40PullDevice>[0]>(device: T): T => {
    if (strictStaff && !isAttendanceK40PullDevice(device)) {
      throw new HttpError(404, "Device not found");
    }
    return device;
  };
  const forcePullConfig = (config: unknown): Record<string, unknown> => ({
    ...(config && typeof config === "object" && !Array.isArray(config)
      ? (config as Record<string, unknown>)
      : {}),
    eventMode: "PULL",
    pushEnabled: false,
  });
  const normalizeStrictConfig = (config: unknown): Record<string, unknown> => {
    const source = config && typeof config === "object" && !Array.isArray(config)
      ? config as Record<string, unknown>
      : {};
    const safeConfig: Record<string, unknown> = {};
    for (const key of [
      "ip",
      "port",
      "dns",
      "gateway",
      "subnet",
      "timeoutMs",
      "pollIntervalMs",
      "protocol",
      "password",
    ] as const) {
      if (source[key] !== undefined) safeConfig[key] = source[key];
    }
    return forcePullConfig(safeConfig);
  };
  const normalizeStrictWrite = <T extends { config: unknown }>(input: T): T =>
    strictStaff ? ({ ...input, config: normalizeStrictConfig(input.config) } as T) : input;
  const assertStrictPullWrite = <T extends { config: unknown }>(input: T): T => {
    if (!strictStaff || !input.config || typeof input.config !== "object" || Array.isArray(input.config)) {
      return input;
    }
    const config = input.config as Record<string, unknown>;
    if ((config["eventMode"] !== undefined && config["eventMode"] !== "PULL") || config["pushEnabled"] === true) {
      throw new HttpError(400, "Attendance Edition supports K40 Pull mode only");
    }
    return input;
  };
  const formatDevice = <T extends { config: unknown }>(device: T) => {
    if (!strictStaff) return device;
    const safe = toSafeDeviceDto(device);
    return { ...safe, config: forcePullConfig(safe.config) };
  };
  const assertStrictPilotSlotAvailable = async (candidateId?: string) => {
    if (!strictStaff) return;
    const existing = await api.prisma.device.findMany({
      where: {
        enabled: true,
        type: "FINGERPRINT",
        connectionType: { in: ["NETWORK", "ZKTECO_PULL_SDK"] },
        ...(candidateId ? { id: { not: candidateId } } : {}),
      },
      select: { id: true },
      take: 1,
    });
    if (existing.length > 0) {
      throw new HttpError(409, "Attendance Edition supports one enabled K40 Pull device");
    }
  };

  router.get("/status", requirePermission(AdminPermission.DEVICES_VIEW), async (_req, res, next) => {
    try {
      const runtime = api.loadManager().getDeviceStatuses();
      const persisted = await api.prisma.device.findMany({
        select: {
          id: true,
          status: true,
          lastSeenAt: true,
          lastSuccessfulPollAt: true,
          lastEventReceivedAt: true,
          lastEventProcessedAt: true,
          lastErrorAt: true,
          lastErrorMessage: true,
          enabled: true,
          type: true,
          connectionType: true,
        },
      });
      const visiblePersisted = strictStaff ? persisted.filter(isAttendanceK40PullDevice) : persisted;
      const visibleDeviceIds = new Set(visiblePersisted.map((device) => device.id));
      const combined: DeviceRuntimeSnapshot[] = visiblePersisted.map((device) =>
        toRuntimeSnapshot({
          id: device.id,
          connected: device.status === "ONLINE",
          lastPollAt: device.lastSuccessfulPollAt ?? device.lastSeenAt ?? null,
          lastEventAt: device.lastEventReceivedAt ?? null,
          lastEventProcessedAt: device.lastEventProcessedAt ?? null,
          lastError: device.lastErrorMessage ?? (device.status === "ERROR" ? "Device marked as error" : null),
          lastErrorAt: device.lastErrorAt ?? null,
        })
      );
      runtime.filter((entry) => !strictStaff || visibleDeviceIds.has(entry.id)).forEach((entry) => {
        const snapshot = toRuntimeSnapshot(entry);
        const index = combined.findIndex((device) => device.id === entry.id);
        if (index >= 0) combined[index] = { ...combined[index], ...snapshot };
        else combined.push(snapshot);
      });
      res.json({ devices: combined });
    } catch (error) {
      next(error);
    }
  });

  router.get("/events", requirePermission(AdminPermission.DEVICES_VIEW), async (req, res, next) => {
    try {
      const take = Math.min(Number(req.query["limit"]) || 20, 100);
      // STRICT never serves a cached identity snapshot: a Staff record may have
      // been reclassified after the event was emitted. Re-read through the
      // current strict-both relation predicate instead.
      const buffered = strictStaff ? [] : api.getRecentEvents(take);
      if (buffered.length > 0) {
        res.json({ items: buffered });
        return;
      }

      if (!strictStaff) {
        // Preserve the legacy FULL fallback contract exactly. Its two device
        // identity fields historically contain AttendanceLog.deviceUserId.
        const events = await api.prisma.attendanceLog.findMany({
          orderBy: { recordedAt: "desc" },
          take,
          include: {
            member: {
              select: { id: true, code: true, firstName: true, lastName: true, memberType: true },
            },
          },
        });
        res.json({
          items: events.map((event) => ({
            id: event.id,
            deviceId: event.deviceUserId ?? "",
            externalUserId: event.deviceUserId ?? "",
            timestamp: event.recordedAt,
            authorized: event.isAuthorized,
            reason: event.reason,
            entryType: event.entryType,
            memberName: event.member
              ? `${event.member.firstName ?? ""} ${event.member.lastName ?? ""}`.trim()
              : undefined,
            memberCode: event.member?.code,
            doorOpened: false,
          })),
        });
        return;
      }

      const events = await api.prisma.attendanceLog.findMany({
        where: {
          source: AttendanceSource.DEVICE,
          deviceUserId: { not: null },
          member: {
            is: { memberType: MemberType.STAFF, isStaff: true, archivedAt: null },
          },
        },
        orderBy: { recordedAt: "desc" },
        take,
        include: {
          rawLog: { select: { deviceId: true, payload: true } },
          member: {
            select: { id: true, code: true, firstName: true, lastName: true, memberType: true },
          },
        },
      });

      res.json({
        items: events.map((event) => ({
          id: event.id,
          deviceId: event.rawLog?.deviceId ?? "",
          externalUserId: readStrictHistoricalExternalUserId(event.rawLog?.payload),
          timestamp: event.recordedAt,
          // Row existence is the durable TIME_CLOCK decision. Preserve the
          // persisted legacy authorization fields for restored historical
          // evidence instead of rewriting them at read time.
          authorized: event.isAuthorized,
          attendanceRecorded: true,
          doorAllowed: false,
          reason: event.reason,
          entryType: event.entryType,
          memberName: event.member
            ? `${event.member.firstName ?? ""} ${event.member.lastName ?? ""}`.trim()
            : undefined,
          memberCode: event.member?.code,
          doorOpened: false,
        })),
      });
    } catch (error) {
      next(error);
    }
  });

  router.get("/events/stream", requirePermission(AdminPermission.DEVICES_VIEW), (req, res) => {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();
    res.write("retry: 2000\n\n");
    if (strictStaff) api.subscribeStrictStaffSse(res);
    else api.subscribeSse(res);
  });

  router.get("/", requirePermission(AdminPermission.DEVICES_VIEW), async (req, res, next) => {
    try {
      const filters = deviceFilterSchema.parse(req.query);
      const devices = await api.loadService().listDevices(filters);
      res.json(
        strictStaff
          ? devices.filter(isAttendanceK40PullDevice).map((device) => formatDevice(device))
          : devices
      );
    } catch (error) {
      next(error);
    }
  });

  router.post(
    "/",
    requirePermission(AdminPermission.DEVICES_VIEW),
    requirePermission(AdminPermission.SYSTEM_SETTINGS_MANAGE),
    async (req, res, next) => {
      try {
        const payload = normalizeStrictWrite(assertStrictPullWrite(deviceCreateSchema.parse(req.body)));
        if (strictStaff && !isAttendanceK40PullDeviceInput(payload)) {
          throw new HttpError(400, "Attendance Edition supports fingerprint K40 Pull devices only");
        }
        if (payload.enabled) await assertStrictPilotSlotAvailable();
        const device = await api.loadService().createDevice(payload, getDeviceActionContext(req), scope);
        if (device.enabled) await api.loadManager().startDevice(device.id, scope);
        res.status(201).json(formatDevice(device));
      } catch (error) {
        next(error);
      }
    }
  );

  router.get("/:id", requirePermission(AdminPermission.DEVICES_VIEW), async (req, res, next) => {
    try {
      const { id } = deviceIdParamSchema.parse(req.params);
      const device = requireStrictDevice(await api.loadService().getDevice(id));
      res.json(formatDevice(device));
    } catch (error) {
      next(error);
    }
  });

  router.put(
    "/:id",
    requirePermission(AdminPermission.DEVICES_VIEW),
    requirePermission(AdminPermission.SYSTEM_SETTINGS_MANAGE),
    async (req, res, next) => {
      try {
        const { id } = deviceIdParamSchema.parse(req.params);
        const strictPayload = strictStaff
          ? normalizeStrictWrite(assertStrictPullWrite(deviceUpdateSchema.parse(req.body)))
          : null;
        if (strictPayload && !isAttendanceK40PullDeviceInput(strictPayload)) {
          throw new HttpError(400, "Attendance Edition supports fingerprint K40 Pull devices only");
        }
        const service = api.loadService();
        const existing = requireStrictDevice(await service.getDevice(id));
        const payload = strictPayload
          ? {
              ...strictPayload,
              config: {
                ...(existing.config && typeof existing.config === "object" && !Array.isArray(existing.config)
                  ? existing.config
                  : {}),
                ...(strictPayload.config as Record<string, unknown>),
              },
            }
          : deviceUpdateSchema.parse(req.body);
        if (payload.enabled) await assertStrictPilotSlotAvailable(id);
        const device = await service.updateDevice(id, payload, getDeviceActionContext(req), scope);
        const configChanged =
          existing.connectionType !== device.connectionType ||
          !require("node:util").isDeepStrictEqual(existing.config ?? {}, device.config ?? {});
        const manager = api.loadManager();
        if (device.enabled) {
          await (configChanged
            ? manager.restartDevice(device.id, scope)
            : manager.startDevice(device.id, scope));
        } else {
          await manager.stopDevice(device.id);
        }
        res.json(formatDevice(device));
      } catch (error) {
        next(error);
      }
    }
  );

  for (const [path, action] of [
    ["/:id/test", "device.tested"],
    ["/:id/test-connection", "device.connection_tested"],
  ] as const) {
    router.post(
      path,
      requirePermission(AdminPermission.DEVICES_VIEW),
      ...connectionCommandPermission,
      async (req, res, next) => {
        try {
          const { id } = deviceIdParamSchema.parse(req.params);
          const result = await api.runAuditedDeviceCommand({
            action,
            targetId: id,
            context: getDeviceActionContext(req),
            execute: () => api.loadManager().testDeviceConnection(id, scope),
            summarize: summarizeConnectionTestAudit,
          });
          res.json(result);
        } catch (error) {
          next(error);
        }
      }
    );
  }

  router.post(
    "/:id/enroll",
    requirePermission(AdminPermission.DEVICES_VIEW),
    requirePermission(AdminPermission.DEVICES_ENROLL),
    async (req, res, next) => {
      try {
        const { id } = deviceIdParamSchema.parse(req.params);
        const parsedPayload = enrollSchema.parse(req.body);
        const payload = {
          userId: parsedPayload.userId,
          ...(parsedPayload.fingerId !== undefined ? { fingerId: parsedPayload.fingerId } : {}),
          ...(parsedPayload.name !== undefined ? { name: parsedPayload.name } : {}),
        };
        const result = await api.runAuditedDeviceCommand({
          action: "device.enrollment.started",
          targetId: id,
          context: getDeviceActionContext(req),
          ...(!strictStaff
            ? {
                failureMetadata: {
                  externalUserId: payload.userId,
                  ...(payload.fingerId !== undefined ? { fingerId: payload.fingerId } : {}),
                },
              }
            : {}),
          execute: () => api.loadManager().enrollDevice(id, payload, scope),
          summarize: (commandResult) => ({
            success: commandResult.ok,
            metadata: strictStaff
              ? {
                  outcome: commandResult.ok ? "STARTED" : "FAILED",
                  domain: "EMPLOYEE",
                  memberType: MemberType.STAFF,
                  employeeId: commandResult.employeeId,
                  ...(payload.fingerId !== undefined ? { fingerId: payload.fingerId } : {}),
                  mode: commandResult.mode,
                }
              : {
                  outcome: commandResult.ok ? "STARTED" : "FAILED",
                  externalUserId: payload.userId,
                  ...(payload.fingerId !== undefined ? { fingerId: payload.fingerId } : {}),
                  mode: commandResult.mode,
                },
          }),
        });
        res.json(result);
      } catch (error) {
        next(error);
      }
    }
  );

  router.get(
    "/:id/users",
    requirePermission(AdminPermission.DEVICES_VIEW),
    requirePermission(AdminPermission.DEVICES_USER_SYNC),
    async (req, res, next) => {
      try {
        const { id } = deviceIdParamSchema.parse(req.params);
        res.json(await api.loadManager().listDeviceUsers(id, scope));
      } catch (error) {
        next(error);
      }
    }
  );

  router.post(
    "/:id/users/sync",
    requirePermission(AdminPermission.DEVICES_VIEW),
    requirePermission(AdminPermission.DEVICES_USER_SYNC),
    async (req, res, next) => {
      try {
        const { id } = deviceIdParamSchema.parse(req.params);
        const result = await api.runAuditedDeviceCommand({
          action: "device.users.synced",
          targetId: id,
          context: getDeviceActionContext(req),
          execute: () => api.loadManager().syncDeviceUsers(id, scope),
          summarize: (commandResult) => ({
            success: true,
            metadata: {
              outcome: "COMPLETED",
              ...(strictStaff ? { domain: "EMPLOYEE", memberType: MemberType.STAFF } : {}),
              mode: commandResult.mode,
              totalUsers: commandResult.total,
              syncedUsers: commandResult.synced,
              skippedUsers: commandResult.skipped,
            },
          }),
        });
        res.json(result);
      } catch (error) {
        next(error);
      }
    }
  );

  router.post(
    "/:id/users/upsert",
    requirePermission(AdminPermission.DEVICES_VIEW),
    requirePermission(AdminPermission.DEVICES_USER_SYNC),
    async (req, res, next) => {
      try {
        const { id } = deviceIdParamSchema.parse(req.params);
        const payload = userUpsertSchema.parse(req.body);
        const result = await api.runAuditedDeviceCommand({
          action: "device.user.upserted",
          targetId: id,
          context: getDeviceActionContext(req),
          ...(!strictStaff ? { failureMetadata: { externalUserId: payload.userId } } : {}),
          execute: () => api.loadManager().upsertDeviceUser(id, payload, scope),
          summarize: (commandResult) => ({
            success: commandResult.ok,
            metadata: strictStaff
              ? {
                  outcome: commandResult.ok ? "COMPLETED" : "FAILED",
                  domain: "EMPLOYEE",
                  memberType: MemberType.STAFF,
                  employeeId: commandResult.employeeId,
                  mode: commandResult.mode,
                }
              : {
                  outcome: commandResult.ok ? "COMPLETED" : "FAILED",
                  externalUserId: payload.userId,
                  mode: commandResult.mode,
                },
          }),
        });
        res.json(result);
      } catch (error) {
        next(error);
      }
    }
  );

  router.post(
    "/:id/users/delete",
    requirePermission(AdminPermission.DEVICES_VIEW),
    requirePermission(AdminPermission.DEVICES_USER_SYNC),
    async (req, res, next) => {
      try {
        const { id } = deviceIdParamSchema.parse(req.params);
        const payload = userDeleteSchema.parse(req.body);
        const result = await api.runAuditedDeviceCommand({
          action: "device.user.deleted",
          targetId: id,
          context: getDeviceActionContext(req),
          ...(!strictStaff ? { failureMetadata: { externalUserId: payload.userId } } : {}),
          execute: () => api.loadManager().deleteDeviceUser(id, payload, scope),
          summarize: (commandResult) => ({
            success: commandResult.ok,
            metadata: strictStaff
              ? {
                  outcome: commandResult.ok ? "COMPLETED" : "FAILED",
                  domain: "EMPLOYEE",
                  memberType: MemberType.STAFF,
                  employeeId: commandResult.employeeId,
                  mode: commandResult.mode,
                }
              : {
                  outcome: commandResult.ok ? "COMPLETED" : "FAILED",
                  externalUserId: payload.userId,
                  mode: commandResult.mode,
                },
          }),
        });
        res.json(result);
      } catch (error) {
        next(error);
      }
    }
  );

  router.get("/:id/time", requirePermission(AdminPermission.DEVICES_VIEW), async (req, res, next) => {
    try {
      const { id } = deviceIdParamSchema.parse(req.params);
      const result = await api.loadManager().getDeviceTime(id, scope);
      res.json({ ...result, time: result.time.toISOString() });
    } catch (error) {
      next(error);
    }
  });

  router.post(
    "/:id/time",
    requirePermission(AdminPermission.DEVICES_VIEW),
    ...timeUpdatePermission,
    async (req, res, next) => {
      try {
        const { id } = deviceIdParamSchema.parse(req.params);
        const payload = timeSchema.optional().parse(req.body ?? {});
        const timestamp = payload?.timestamp ? new Date(payload.timestamp) : new Date();
        const result = await api.runAuditedDeviceCommand({
          action: "device.time.updated",
          targetId: id,
          context: getDeviceActionContext(req),
          failureMetadata: { requestedTime: timestamp.toISOString() },
          execute: () => api.loadManager().setDeviceTime(id, timestamp, scope),
          summarize: (commandResult) => ({
            success: true,
            metadata: {
              outcome: "COMPLETED",
              deviceTime: commandResult.time.toISOString(),
              mode: commandResult.mode,
            },
          }),
        });
        res.json({ ...result, time: result.time.toISOString() });
      } catch (error) {
        next(error);
      }
    }
  );

  router.get(
    "/:id/suggest-user-id",
    requirePermission(AdminPermission.DEVICES_VIEW),
    requirePermission(AdminPermission.DEVICES_USER_SYNC),
    async (req, res, next) => {
      try {
        const { id } = deviceIdParamSchema.parse(req.params);
        res.json(await api.loadManager().suggestDeviceUserId(id, scope));
      } catch (error) {
        next(error);
      }
    }
  );

  router.post(
    "/:id/enable",
    requirePermission(AdminPermission.DEVICES_VIEW),
    requirePermission(AdminPermission.SYSTEM_SETTINGS_MANAGE),
    async (req, res, next) => {
      try {
        const { id } = deviceIdParamSchema.parse(req.params);
        const service = api.loadService();
        requireStrictDevice(await service.getDevice(id));
        await assertStrictPilotSlotAvailable(id);
        const device = await service.setDeviceEnabled(id, true, getDeviceActionContext(req), scope);
        await api.loadManager().startDevice(id, scope);
        res.json(formatDevice(device));
      } catch (error) {
        next(error);
      }
    }
  );

  router.post(
    "/:id/disable",
    requirePermission(AdminPermission.DEVICES_VIEW),
    requirePermission(AdminPermission.SYSTEM_SETTINGS_MANAGE),
    async (req, res, next) => {
      try {
        const { id } = deviceIdParamSchema.parse(req.params);
        const service = api.loadService();
        requireStrictDevice(await service.getDevice(id));
        const device = await service.setDeviceEnabled(id, false, getDeviceActionContext(req), scope);
        await api.loadManager().stopDevice(id);
        res.json(formatDevice(device));
      } catch (error) {
        next(error);
      }
    }
  );

  router.get("/:id/runtime-status", requirePermission(AdminPermission.DEVICES_VIEW), async (req, res, next) => {
    try {
      const { id } = deviceIdParamSchema.parse(req.params);
      const legacyRuntime = strictStaff ? null : api.loadManager().getRuntimeStatus(id);
      if (legacyRuntime) {
        res.json(legacyRuntime);
        return;
      }
      const persisted = await api.prisma.device.findUnique({
        where: { id },
        select: {
          id: true,
          status: true,
          lastSeenAt: true,
          lastSuccessfulPollAt: true,
          lastEventReceivedAt: true,
          lastEventProcessedAt: true,
          lastErrorAt: true,
          lastErrorMessage: true,
          type: true,
          connectionType: true,
        },
      });
      if (strictStaff && (!persisted || !isAttendanceK40PullDevice(persisted))) {
        throw new HttpError(404, "Device not found");
      }
      const strictRuntime = strictStaff ? api.loadManager().getRuntimeStatus(id) : null;
      if (strictRuntime) {
        res.json(strictRuntime);
        return;
      }
      res.json(
        persisted
          ? toRuntimeSnapshot({
              id: persisted.id,
              connected: persisted.status === DeviceStatus.ONLINE,
              lastPollAt: persisted.lastSuccessfulPollAt ?? persisted.lastSeenAt,
              lastEventAt: persisted.lastEventReceivedAt,
              lastEventProcessedAt: persisted.lastEventProcessedAt,
              lastError: persisted.lastErrorMessage,
              lastErrorAt: persisted.lastErrorAt,
            })
          : { id, connected: false }
      );
    } catch (error) {
      next(error);
    }
  });

  return router;
}
