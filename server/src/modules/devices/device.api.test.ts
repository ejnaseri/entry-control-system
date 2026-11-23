import assert from "node:assert/strict";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import express from "express";
import {
  AdminPermission,
  AdminRole,
  AttendanceSource,
  AttendanceType,
  DeviceConnectionType,
  DeviceStatus,
  DeviceType,
  MemberType,
} from "@prisma/client";
import { errorHandler, HttpError } from "../../middlewares/error-handler";
import {
  createDeviceCoreRouter,
  type DeviceCoreRouterApi,
} from "./device-core.router";
import { DEVICE_DATA_SCOPES, type DeviceDataScope } from "./device-edition-scope";

type Call = {
  operation: string;
  args: unknown[];
  scope?: DeviceDataScope;
};

type AuditCall = {
  action: string;
  failed: boolean;
  failureMetadata?: Record<string, unknown>;
  summary?: { success: boolean; metadata?: Record<string, unknown> };
};

const calls: Call[] = [];
const auditCalls: AuditCall[] = [];
const eventQueries: any[] = [];
let recentEventReads = 0;
let strictRecentEventReads = 0;
let legacySubscriptions = 0;
let strictSubscriptions = 0;
let serveLegacyBufferedEvent = true;

const deviceId = "cmdevice00000000000000001";
const historicalDeviceId = "cmhistoricaldevice000000001";

function capture(operation: string, args: unknown[], scope?: DeviceDataScope) {
  calls.push({ operation, args, ...(scope ? { scope } : {}) });
}

function targetStatus(userId: unknown): never | void {
  if (["customer", "staff-false", "customer-true", "unknown", "inactive"].includes(String(userId))) {
    throw new HttpError(404, "Employee not found");
  }
}

const fakeManager = {
  getDeviceStatuses() {
    capture("statuses", []);
    return [];
  },
  getRuntimeStatus(id: string) {
    capture("runtime", [id]);
    return null;
  },
  async startDevice(id: string, scope: DeviceDataScope) {
    capture("start", [id], scope);
  },
  async restartDevice(id: string, scope: DeviceDataScope) {
    capture("restart", [id], scope);
  },
  async stopDevice(id: string) {
    capture("stop", [id]);
  },
  async testDeviceConnection(id: string, scope: DeviceDataScope) {
    capture("test", [id], scope);
    return { ok: true, status: DeviceStatus.ONLINE };
  },
  async enrollDevice(
    id: string,
    payload: { userId: string; fingerId?: number; name?: string },
    scope: DeviceDataScope
  ) {
    targetStatus(payload.userId);
    capture("enroll", [id, payload], scope);
    return {
      ok: true,
      mode: "test" as const,
      ...(scope === DEVICE_DATA_SCOPES.STRICT_STAFF ? { employeeId: "employee-101" } : {}),
    };
  },
  async listDeviceUsers(id: string, scope: DeviceDataScope) {
    capture("list-users", [id], scope);
    return { items: [], mode: "test" as const };
  },
  async syncDeviceUsers(id: string, scope: DeviceDataScope) {
    capture("sync-users", [id], scope);
    return { total: 1, synced: 1, skipped: 0, mode: "test" as const };
  },
  async upsertDeviceUser(
    id: string,
    payload: { userId: string | number; name: string },
    scope: DeviceDataScope
  ) {
    targetStatus(payload.userId);
    capture("upsert-user", [id, payload], scope);
    return {
      ok: true,
      mode: "test" as const,
      ...(scope === DEVICE_DATA_SCOPES.STRICT_STAFF ? { employeeId: "employee-101" } : {}),
    };
  },
  async deleteDeviceUser(
    id: string,
    payload: { userId?: string | number; uid?: number },
    scope: DeviceDataScope
  ) {
    targetStatus(payload.userId);
    capture("delete-user", [id, payload], scope);
    return {
      ok: true,
      mode: "test" as const,
      ...(scope === DEVICE_DATA_SCOPES.STRICT_STAFF ? { employeeId: "employee-101" } : {}),
    };
  },
  async getDeviceTime(id: string, scope: DeviceDataScope) {
    capture("get-time", [id], scope);
    return { time: new Date("2026-08-11T08:30:00.000Z"), mode: "test" as const };
  },
  async setDeviceTime(id: string, timestamp: Date, scope: DeviceDataScope) {
    capture("set-time", [id, timestamp], scope);
    return { time: timestamp, mode: "test" as const };
  },
  async suggestDeviceUserId(id: string, scope: DeviceDataScope) {
    capture("suggest-user", [id], scope);
    return { userId: "102" };
  },
} as any;

const persistedDevice = {
  id: deviceId,
  name: "Attendance K40",
  type: DeviceType.FINGERPRINT,
  connectionType: DeviceConnectionType.NETWORK,
  status: DeviceStatus.ONLINE,
  enabled: true,
  config: {
    ip: "127.0.0.1",
    port: 4370,
    password: "device-secret",
    accessToken: "legacy-access-token",
    clientSecret: "legacy-client-secret",
    apiKey: "legacy-api-key",
    nested: { authorization: "legacy-nested-authorization" },
    eventMode: "PUSH",
    pushEnabled: true,
  },
};

const fakeService = {
  async listDevices(filters: unknown) {
    capture("list-devices", [filters]);
    return [persistedDevice];
  },
  async getDevice(id: string) {
    capture("get-device", [id]);
    return persistedDevice;
  },
  async createDevice(payload: unknown, _context: unknown, scope: DeviceDataScope) {
    capture("create-device", [payload, scope]);
    return { ...persistedDevice, ...(payload as Record<string, unknown>) };
  },
  async updateDevice(id: string, payload: unknown, _context: unknown, scope: DeviceDataScope) {
    capture("update-device", [id, payload, scope]);
    return { ...persistedDevice, ...(payload as Record<string, unknown>) };
  },
  async setDeviceEnabled(id: string, enabled: boolean, _context: unknown, scope: DeviceDataScope) {
    capture("set-enabled", [id, enabled, scope]);
    return { ...persistedDevice, enabled };
  },
} as any;

const fakePrisma = {
  device: {
    async findMany() {
      return [];
    },
    async findUnique() {
      return null;
    },
  },
  attendanceLog: {
    async findMany(args: any) {
      eventQueries.push(args);
      return [
        {
          id: "attendance-staff-1",
          deviceUserId: "device-user-staff-1",
          recordedAt: new Date("2026-08-11T08:00:00.000Z"),
          entryType: AttendanceType.IN,
          isAuthorized: false,
          reason: "TIME_NOT_ALLOWED",
          deviceUser: { externalId: 999, deviceId: "customer-device" },
          rawLog: {
            deviceId: historicalDeviceId,
            payload: { externalUserId: "101", raw: { secret: "must-not-leak" } },
          },
          member: {
            id: "employee-101",
            code: "101",
            firstName: "Active",
            lastName: "Employee",
            memberType: MemberType.STAFF,
          },
        },
      ];
    },
  },
} as any;

const fakeApi = {
  loadManager: () => fakeManager,
  loadService: () => fakeService,
  prisma: fakePrisma,
  getRecentEvents: () => {
    recentEventReads += 1;
    return serveLegacyBufferedEvent ? [
      {
        deviceId,
        externalUserId: "legacy-customer-7",
        timestamp: new Date("2026-08-11T07:00:00.000Z"),
        eventType: "CHECK_IN",
        authorized: true,
      },
    ] : [];
  },
  getRecentStrictStaffEvents: () => {
    strictRecentEventReads += 1;
    return [];
  },
  subscribeSse: (res: express.Response) => {
    legacySubscriptions += 1;
    res.end();
  },
  subscribeStrictStaffSse: (res: express.Response) => {
    strictSubscriptions += 1;
    res.end();
  },
  runAuditedDeviceCommand: async (input: {
    action: string;
    execute: () => unknown | Promise<unknown>;
    summarize: (result: any) => { success: boolean; metadata?: Record<string, unknown> };
    failureMetadata?: Record<string, unknown>;
  }) => {
    try {
      const result = await input.execute();
      auditCalls.push({
        action: input.action,
        failed: false,
        ...(input.failureMetadata ? { failureMetadata: input.failureMetadata } : {}),
        summary: input.summarize(result),
      });
      return result;
    } catch (error) {
      auditCalls.push({
        action: input.action,
        failed: true,
        ...(input.failureMetadata ? { failureMetadata: input.failureMetadata } : {}),
      });
      throw error;
    }
  },
} as unknown as Partial<DeviceCoreRouterApi>;

function assertCoreDidNotLoadPhysicalModules() {
  const forbidden = [
    "./deviceManager",
    "./device.service",
    "./zktecoK40.service",
    "./deviceDiagnostics",
    "./deviceSupportBundle.service",
    "./device-push.router",
    "./device-diagnostics.router",
    "./device-door-control.router",
    "../door/door.service",
    "../inbox/inbox.device",
  ];
  for (const request of forbidden) {
    const resolved = require.resolve(request);
    assert.equal(require.cache[resolved], undefined, `Core router construction imported optional module ${request}`);
  }
}

function permissionsFor(access: string): AdminPermission[] {
  const permissions: AdminPermission[] = [AdminPermission.SIGN_IN];
  if (access !== "signin") permissions.push(AdminPermission.DEVICES_VIEW);
  if (["sync", "all"].includes(access)) permissions.push(AdminPermission.DEVICES_USER_SYNC);
  if (["enroll", "all"].includes(access)) permissions.push(AdminPermission.DEVICES_ENROLL);
  if (["settings", "all"].includes(access)) permissions.push(AdminPermission.SYSTEM_SETTINGS_MANAGE);
  if (["diagnostics", "all"].includes(access)) permissions.push(AdminPermission.DEVICES_DIAGNOSTICS);
  return permissions;
}

async function run() {
  assertCoreDidNotLoadPhysicalModules();

  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    const access = req.get("x-test-access");
    if (access) {
      (req as any).auth = {
        user: { id: "device-api-admin", role: AdminRole.GYM_OWNER },
        session: { id: "device-api-session" },
        permissions: permissionsFor(access),
      };
    }
    next();
  });
  app.use("/strict", createDeviceCoreRouter("ATTENDANCE", fakeApi));
  app.use("/full", createDeviceCoreRouter("FULL", fakeApi));
  app.use(errorHandler);

  const server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const address = server.address() as AddressInfo;
    const baseUrl = `http://127.0.0.1:${address.port}`;

    await assertStatus(`${baseUrl}/strict/status`, 401);
    await assertStatus(`${baseUrl}/strict/status`, 403, "signin");
    assert.equal(calls.length, 0, "401/403 requests must not enter Device services");

    await assertStatus(`${baseUrl}/strict/status`, 200, "view");
    assert.equal(countCalls("statuses"), 1);

    const strictList = await assertStatus(`${baseUrl}/strict/`, 200, "view");
    const strictListBody = (await strictList.json()) as Array<{ config: Record<string, unknown> }>;
    assert.deepEqual(strictListBody[0]?.config, {
      ip: "127.0.0.1",
      port: 4370,
      eventMode: "PULL",
      pushEnabled: false,
    });
    for (const secret of [
      "device-secret",
      "legacy-access-token",
      "legacy-client-secret",
      "legacy-api-key",
      "legacy-nested-authorization",
    ]) {
      assert.equal(JSON.stringify(strictListBody).includes(secret), false, `strict list leaked config secret ${secret}`);
    }

    const fullList = await assertStatus(`${baseUrl}/full/`, 200, "view");
    const fullListBody = (await fullList.json()) as Array<{ config: Record<string, unknown> }>;
    assert.deepEqual(fullListBody[0]?.config, persistedDevice.config, "FULL list must retain the legacy raw config");

    const strictDetail = await assertStatus(`${baseUrl}/strict/${deviceId}`, 200, "view");
    const strictDetailBody = (await strictDetail.json()) as { config: Record<string, unknown> };
    assert.deepEqual(strictDetailBody.config, strictListBody[0]?.config);

    const fullDetail = await assertStatus(`${baseUrl}/full/${deviceId}`, 200, "view");
    const fullDetailBody = (await fullDetail.json()) as { config: Record<string, unknown> };
    assert.deepEqual(fullDetailBody.config, persistedDevice.config, "FULL get must retain the legacy raw config");

    const safeStrictPayload = {
      name: "Attendance K40",
      type: DeviceType.FINGERPRINT,
      connectionType: DeviceConnectionType.NETWORK,
      enabled: true,
      config: {
        ip: "127.0.0.1",
        port: 4370,
        eventMode: "PULL",
        pushEnabled: false,
        accessToken: "attempted-client-token",
        clientSecret: "attempted-client-secret",
      },
    };
    await assertStatus(`${baseUrl}/strict/`, 201, "settings", "POST", JSON.stringify(safeStrictPayload), {
      "content-type": "application/json",
    });
    assert.equal(assertLatestCall("create-device").args[1], DEVICE_DATA_SCOPES.STRICT_STAFF);
    const strictUpdate = await assertStatus(
      `${baseUrl}/strict/${deviceId}`,
      200,
      "settings",
      "PUT",
      JSON.stringify(safeStrictPayload),
      { "content-type": "application/json" }
    );
    assert.equal(assertLatestCall("update-device").args[2], DEVICE_DATA_SCOPES.STRICT_STAFF);
    const strictUpdateConfig = (assertLatestCall("update-device").args[1] as any).config;
    assert.equal(strictUpdateConfig.password, "device-secret", "strict update must preserve the stored device password");
    assert.equal(strictUpdateConfig.accessToken, "legacy-access-token");
    assert.equal(strictUpdateConfig.clientSecret, "legacy-client-secret");
    assert.equal(
      JSON.stringify(strictUpdateConfig).includes("attempted-client"),
      false,
      "strict update accepted hidden client config"
    );
    assert.equal(
      JSON.stringify(await strictUpdate.json()).includes("device-secret"),
      false,
      "strict update response leaked the device password"
    );
    await assertStatus(`${baseUrl}/strict/${deviceId}/enable`, 200, "settings", "POST");
    assert.equal(assertLatestCall("set-enabled").args[2], DEVICE_DATA_SCOPES.STRICT_STAFF);

    for (const eventMode of ["PUSH", "AUTO"] as const) {
      const unsafeDevicePayload = {
        name: `Unsafe ${eventMode}`,
        type: DeviceType.FINGERPRINT,
        connectionType: DeviceConnectionType.NETWORK,
        enabled: true,
        config: {
          ip: "127.0.0.1",
          port: 4370,
          password: "new-device-secret",
          eventMode,
          pushEnabled: true,
        },
      };

      for (const method of ["POST", "PUT"] as const) {
        const target = method === "POST" ? "/strict/" : `/strict/${deviceId}`;
        const callsBeforeStrictWrite: number = calls.length;
        await assertStatus(
          `${baseUrl}${target}`,
          400,
          "settings",
          method,
          JSON.stringify(unsafeDevicePayload),
          { "content-type": "application/json" }
        );
        assert.equal(
          calls.length,
          callsBeforeStrictWrite,
          `strict ${method} ${eventMode} must fail before service or manager invocation`
        );
      }

      await assertStatus(
        `${baseUrl}/full/`,
        201,
        "settings",
        "POST",
        JSON.stringify(unsafeDevicePayload),
        { "content-type": "application/json" }
      );
      assert.equal(
        (assertLatestCall("create-device").args[0] as any).config.eventMode,
        eventMode,
        "FULL create must preserve the legacy event mode"
      );
      assertScopedCall("start", DEVICE_DATA_SCOPES.FULL_LEGACY);

      await assertStatus(
        `${baseUrl}/full/${deviceId}`,
        200,
        "settings",
        "PUT",
        JSON.stringify(unsafeDevicePayload),
        { "content-type": "application/json" }
      );
      assert.equal(
        (assertLatestCall("update-device").args[1] as any).config.eventMode,
        eventMode,
        "FULL update must preserve the legacy event mode"
      );
      const fullWriteManagerCall = [...calls]
        .reverse()
        .find((call) => call.operation === "start" || call.operation === "restart");
      assert.equal(fullWriteManagerCall?.scope, DEVICE_DATA_SCOPES.FULL_LEGACY);
    }

    await assertStatus(`${baseUrl}/strict/${deviceId}/test`, 200, "view", "POST");
    assertScopedCall("test", DEVICE_DATA_SCOPES.STRICT_STAFF);

    const testsBeforeFullPermission = countCalls("test");
    await assertStatus(`${baseUrl}/full/${deviceId}/test`, 403, "view", "POST");
    assert.equal(countCalls("test"), testsBeforeFullPermission);
    await assertStatus(`${baseUrl}/full/${deviceId}/test`, 200, "diagnostics", "POST");
    assertScopedCall("test", DEVICE_DATA_SCOPES.FULL_LEGACY);

    await assertJsonStatus(
      `${baseUrl}/strict/${deviceId}/enroll`,
      { userId: "101", fingerId: 2, name: "ignored client name" },
      403,
      "view"
    );
    await assertJsonStatus(
      `${baseUrl}/strict/${deviceId}/enroll`,
      { userId: "101", fingerId: 2, name: "ignored client name" },
      200,
      "enroll"
    );
    assertScopedCall("enroll", DEVICE_DATA_SCOPES.STRICT_STAFF);

    await assertStatus(`${baseUrl}/strict/${deviceId}/users`, 403, "view");
    await assertStatus(`${baseUrl}/strict/${deviceId}/users`, 200, "sync");
    assertScopedCall("list-users", DEVICE_DATA_SCOPES.STRICT_STAFF);
    await assertJsonStatus(`${baseUrl}/strict/${deviceId}/users/sync`, {}, 200, "sync");
    assertScopedCall("sync-users", DEVICE_DATA_SCOPES.STRICT_STAFF);
    await assertJsonStatus(
      `${baseUrl}/strict/${deviceId}/users/upsert`,
      { userId: "101", name: "ignored client name" },
      200,
      "sync"
    );
    assertScopedCall("upsert-user", DEVICE_DATA_SCOPES.STRICT_STAFF);
    const strictSuccessAudit = assertLatestAudit("device.user.upserted", false);
    assert.equal(strictSuccessAudit.summary?.metadata?.["domain"], "EMPLOYEE");
    assert.equal(strictSuccessAudit.summary?.metadata?.["memberType"], MemberType.STAFF);
    assert.equal(
      Object.hasOwn(strictSuccessAudit.summary?.metadata ?? {}, "externalUserId"),
      false,
      "strict success Audit metadata must not persist the raw device user ID"
    );
    const deletesBeforeConfirmation = countCalls("delete-user");
    await assertJsonStatus(
      `${baseUrl}/strict/${deviceId}/users/delete`,
      { userId: "101" },
      400,
      "sync"
    );
    assert.equal(countCalls("delete-user"), deletesBeforeConfirmation);
    await assertJsonStatus(
      `${baseUrl}/strict/${deviceId}/users/delete`,
      { userId: "101", confirm: true },
      200,
      "sync"
    );
    assertScopedCall("delete-user", DEVICE_DATA_SCOPES.STRICT_STAFF);
    const strictDeleteAudit = assertLatestAudit("device.user.deleted", false);
    assert.equal(strictDeleteAudit.summary?.metadata?.["employeeId"], "employee-101");
    assert.equal(Object.hasOwn(strictDeleteAudit.summary?.metadata ?? {}, "externalUserId"), false);

    for (const rejectedTarget of ["customer", "staff-false", "customer-true", "unknown", "inactive"]) {
      const response = await assertJsonStatus(
        `${baseUrl}/strict/${deviceId}/users/upsert`,
        { userId: rejectedTarget, name: "blocked target" },
        404,
        "sync"
      );
      assert.deepEqual(await response.json(), { message: "Employee not found" });
    }
    const strictFailureAudits = auditCalls.filter(
      (call) => call.action === "device.user.upserted" && call.failed
    );
    assert.equal(strictFailureAudits.length, 5);
    for (const audit of strictFailureAudits) {
      assert.equal(
        Object.hasOwn(audit.failureMetadata ?? {}, "externalUserId"),
        false,
        "strict failed-command Audit metadata must not persist the rejected raw ID"
      );
    }

    await assertJsonStatus(
      `${baseUrl}/full/${deviceId}/users/upsert`,
      { userId: "legacy-customer-7", name: "Legacy Customer" },
      200,
      "sync"
    );
    assertScopedCall("upsert-user", DEVICE_DATA_SCOPES.FULL_LEGACY);
    const fullSuccessAudit = assertLatestAudit("device.user.upserted", false);
    assert.equal(fullSuccessAudit.failureMetadata?.["externalUserId"], "legacy-customer-7");
    assert.equal(fullSuccessAudit.summary?.metadata?.["externalUserId"], "legacy-customer-7");

    await assertStatus(`${baseUrl}/strict/${deviceId}/time`, 200, "view");
    assertScopedCall("get-time", DEVICE_DATA_SCOPES.STRICT_STAFF);
    await assertJsonStatus(
      `${baseUrl}/strict/${deviceId}/time`,
      { timestamp: "2026-08-11T09:00:00.000Z" },
      403,
      "view"
    );
    await assertJsonStatus(
      `${baseUrl}/strict/${deviceId}/time`,
      { timestamp: "2026-08-11T09:00:00.000Z" },
      200,
      "settings"
    );
    assertScopedCall("set-time", DEVICE_DATA_SCOPES.STRICT_STAFF);
    await assertStatus(`${baseUrl}/strict/${deviceId}/suggest-user-id`, 200, "sync");
    assertScopedCall("suggest-user", DEVICE_DATA_SCOPES.STRICT_STAFF);

    const strictEvents = await assertStatus(`${baseUrl}/strict/events?limit=10`, 200, "view");
    const strictBody = (await strictEvents.json()) as { items: Array<Record<string, unknown>> };
    assert.equal(recentEventReads, 0, "strict Event API must not expose the unscoped legacy buffer");
    assert.equal(
      strictRecentEventReads,
      0,
      "strict Event API must revalidate current Staff identity instead of serving a cached snapshot"
    );
    assert.deepEqual(eventQueries.at(-1)?.where, {
      source: AttendanceSource.DEVICE,
      deviceUserId: { not: null },
      member: { is: { memberType: MemberType.STAFF, isStaff: true, archivedAt: null } },
    });
    assert.deepEqual(eventQueries.at(-1)?.include?.rawLog, { select: { deviceId: true, payload: true } });
    assert.equal(eventQueries.at(-1)?.include?.deviceUser, undefined);
    assert.equal(strictBody.items.length, 1);
    assert.equal(strictBody.items[0]?.["memberCode"], "101");
    assert.equal(strictBody.items[0]?.["deviceId"], historicalDeviceId);
    assert.equal(strictBody.items[0]?.["externalUserId"], "101");
    assert.equal(strictBody.items[0]?.["authorized"], false);
    assert.equal(strictBody.items[0]?.["attendanceRecorded"], true);
    assert.equal(strictBody.items[0]?.["doorAllowed"], false);
    assert.equal(strictBody.items[0]?.["doorOpened"], false);
    assert.equal(strictBody.items[0]?.["reason"], "TIME_NOT_ALLOWED");
    assert.equal(JSON.stringify(strictBody).includes("must-not-leak"), false);
    assert.equal(JSON.stringify(strictBody).includes("999"), false);
    assert.equal(JSON.stringify(strictBody).includes("device-user-staff-1"), false);
    assert.equal(JSON.stringify(strictBody).includes("legacy-customer"), false);

    const queriesBeforeFullEvents = eventQueries.length;
    const fullEvents = await assertStatus(`${baseUrl}/full/events?limit=10`, 200, "view");
    const fullBody = await fullEvents.json();
    assert.equal(recentEventReads, 1, "FULL keeps the legacy buffered event path");
    assert.equal(eventQueries.length, queriesBeforeFullEvents);
    assert.equal(JSON.stringify(fullBody).includes("legacy-customer-7"), true);
    assert.equal(JSON.stringify(fullBody).includes("attendanceRecorded"), false);
    assert.equal(JSON.stringify(fullBody).includes("doorAllowed"), false);

    serveLegacyBufferedEvent = false;
    const fullFallback = await assertStatus(`${baseUrl}/full/events?limit=10`, 200, "view");
    const fullFallbackBody = (await fullFallback.json()) as { items: Array<Record<string, unknown>> };
    assert.equal(recentEventReads, 2);
    assert.equal(eventQueries.length, queriesBeforeFullEvents + 1);
    const fullFallbackQuery = eventQueries.at(-1);
    assert.equal(fullFallbackQuery?.where, undefined, "FULL fallback must keep the unscoped legacy query");
    assert.deepEqual(fullFallbackQuery?.include, {
      member: {
        select: { id: true, code: true, firstName: true, lastName: true, memberType: true },
      },
    });
    assert.equal(fullFallbackBody.items[0]?.["deviceId"], "device-user-staff-1");
    assert.equal(fullFallbackBody.items[0]?.["externalUserId"], "device-user-staff-1");
    assert.equal(fullFallbackBody.items[0]?.["authorized"], false);
    assert.equal(fullFallbackBody.items[0]?.["reason"], "TIME_NOT_ALLOWED");
    assert.equal(Object.hasOwn(fullFallbackBody.items[0] ?? {}, "attendanceRecorded"), false);
    assert.equal(Object.hasOwn(fullFallbackBody.items[0] ?? {}, "doorAllowed"), false);

    await assertStatus(`${baseUrl}/strict/events/stream`, 401);
    assert.equal(strictSubscriptions, 0);
    assert.equal(legacySubscriptions, 0);
    const strictStream = await assertStatus(`${baseUrl}/strict/events/stream`, 200, "view");
    await strictStream.text();
    assert.equal(strictSubscriptions, 1);
    assert.equal(legacySubscriptions, 0, "strict stream must never subscribe to the legacy emitter");
    const fullStream = await assertStatus(`${baseUrl}/full/events/stream`, 200, "view");
    await fullStream.text();
    assert.equal(legacySubscriptions, 1);

    const callsBeforePhysicalRoutes = calls.length;
    await assertStatus(`${baseUrl}/strict/${deviceId}/unlock`, 404, "all", "POST");
    await assertStatus(`${baseUrl}/strict/scan/test-scan`, 404, "all");
    assert.equal(calls.length, callsBeforePhysicalRoutes, "Core must not construct Door or Diagnostics handlers");

    console.log("ok - Device Core binds permissions/scopes, keeps events Staff-safe, and stays physically isolated");
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve()))
    );
  }
}

function countCalls(operation: string) {
  return calls.filter((call) => call.operation === operation).length;
}

function assertScopedCall(operation: string, scope: DeviceDataScope) {
  const call = assertLatestCall(operation);
  assert.equal(call.scope, scope, `${operation} must receive the Edition-owned scope`);
  return call;
}

function assertLatestCall(operation: string) {
  const call = [...calls].reverse().find((item) => item.operation === operation);
  assert.ok(call, `Missing ${operation} call`);
  return call;
}

function assertLatestAudit(action: string, failed: boolean) {
  const call = [...auditCalls]
    .reverse()
    .find((item) => item.action === action && item.failed === failed);
  assert.ok(call, `Missing ${failed ? "failed" : "successful"} ${action} Audit call`);
  return call;
}

async function assertJsonStatus(
  url: string,
  body: unknown,
  expectedStatus: number,
  access: string
) {
  return assertStatus(url, expectedStatus, access, "POST", JSON.stringify(body), {
    "content-type": "application/json",
  });
}

async function assertStatus(
  url: string,
  expectedStatus: number,
  access?: string,
  method = "GET",
  body?: string,
  extraHeaders: Record<string, string> = {}
) {
  const headers = { ...extraHeaders, ...(access ? { "x-test-access": access } : {}) };
  const response = await fetch(url, {
    method,
    headers,
    ...(body === undefined ? {} : { body }),
  });
  assert.equal(response.status, expectedStatus, `${method} ${url}`);
  return response;
}

void run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
