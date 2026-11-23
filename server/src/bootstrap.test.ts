import assert from "node:assert/strict";
import type { Server } from "node:http";
import path from "node:path";
import type { RuntimeDependencies } from "./bootstrap";

type TestApp = ReturnType<(typeof import("./app"))["createApp"]>;

const TEST_DATABASE_URL = "postgresql://startup_test:startup_test@127.0.0.1:1/startup_test";
const missingDotenvPath = path.join(__dirname, `.bootstrap-test-missing-${process.pid}.env`);

process.env["NODE_ENV"] = "test";
process.env["APP_EDITION"] = "FULL";
process.env["PORT"] = "4000";
process.env["DATABASE_URL"] = TEST_DATABASE_URL;
process.env["DOTENV_CONFIG_PATH"] = missingDotenvPath;
process.env["DOTENV_CONFIG_QUIET"] = "true";

const OPTIONAL_ATTENDANCE_ENV_FLAGS = [
  "APP_FEATURE_ATTENDANCE_COMPLIANCE",
  "APP_FEATURE_INBOX",
  "APP_FEATURE_SOUNDS",
  "APP_FEATURE_DEVICE_DIAGNOSTICS",
  "APP_FEATURE_DOOR_CONTROL",
] as const;

for (const flag of OPTIONAL_ATTENDANCE_ENV_FLAGS) {
  process.env[flag] = "1";
}

type CounterName =
  | "loadApp"
  | "loadRestoreMaintenance"
  | "getRestoreMaintenanceStatus"
  | "createApp"
  | "createHttpServer"
  | "listen"
  | "loadDeviceManager"
  | "startDeviceManager"
  | "stopDeviceManager"
  | "loadInboxJobs"
  | "startInboxScheduler"
  | "stopInboxScheduler"
  | "loadInboxWebsocket"
  | "attachInboxWebsocket"
  | "stopInboxWebsocket"
  | "loadBackupScheduler"
  | "startBackupScheduler"
  | "stopBackupScheduler";

type Counters = Record<CounterName, number>;

const counterNames: readonly CounterName[] = [
  "loadApp",
  "loadRestoreMaintenance",
  "getRestoreMaintenanceStatus",
  "createApp",
  "createHttpServer",
  "listen",
  "loadDeviceManager",
  "startDeviceManager",
  "stopDeviceManager",
  "loadInboxJobs",
  "startInboxScheduler",
  "stopInboxScheduler",
  "loadInboxWebsocket",
  "attachInboxWebsocket",
  "stopInboxWebsocket",
  "loadBackupScheduler",
  "startBackupScheduler",
  "stopBackupScheduler",
];

function createCounters(): Counters {
  return Object.fromEntries(counterNames.map((name) => [name, 0])) as Counters;
}

function increment(counters: Counters, name: CounterName): void {
  counters[name] += 1;
}

function createRuntimeHarness(options: {
  deviceStartError?: Error;
  deviceStopFailures?: number;
  maintenanceEnabled?: boolean;
  maintenanceStatusError?: Error;
} = {}): {
  counters: Counters;
  order: string[];
  inboxSchedulerEditions: string[];
  inboxWebsocketEditions: string[];
  dependencies: RuntimeDependencies;
  server: Server;
} {
  const { restoreMaintenanceRuntimeTestHooks } = require("./shared/restore-maintenance-runtime") as typeof import("./shared/restore-maintenance-runtime");
  restoreMaintenanceRuntimeTestHooks.reset();
  const counters = createCounters();
  const order: string[] = [];
  const inboxSchedulerEditions: string[] = [];
  const inboxWebsocketEditions: string[] = [];
  const server = {} as Server;
  const app = (() => undefined) as unknown as TestApp;
  let remainingDeviceStopFailures = options.deviceStopFailures ?? 0;

  const dependencies = {
    loadApp: async () => {
      increment(counters, "loadApp");
      order.push("loadApp");
      return {
        createApp: () => {
          increment(counters, "createApp");
          order.push("createApp");
          return app;
        },
      };
    },
    loadRestoreMaintenance: async () => {
      increment(counters, "loadRestoreMaintenance");
      order.push("loadRestoreMaintenance");
      return {
        getRestoreMaintenanceStatus: async () => {
          increment(counters, "getRestoreMaintenanceStatus");
          order.push("getRestoreMaintenanceStatus");
          if (options.maintenanceStatusError) throw options.maintenanceStatusError;
          return {
            enabled: options.maintenanceEnabled === true,
            restoreJobId: options.maintenanceEnabled ? "restore-job-test" : null,
            startedAt: options.maintenanceEnabled ? "2026-08-24T12:00:00.000Z" : null,
            startedById: null,
            startedByRole: null,
            reason: null,
            selectedBackupFolderName: null,
            selectedBackupPath: null,
            emergencyBackupPath: null,
            handoffPath: null,
            updatedAt: null,
          };
        },
      };
    },
    loadDeviceManager: async () => {
      increment(counters, "loadDeviceManager");
      order.push("loadDeviceManager");
      return {
        startAllActiveDevices: async () => {
          increment(counters, "startDeviceManager");
          order.push("startDeviceManager");
          if (options.deviceStartError) {
            throw options.deviceStartError;
          }
        },
        stopAllActiveDevices: async () => {
          increment(counters, "stopDeviceManager");
          order.push("stopDeviceManager");
          if (remainingDeviceStopFailures > 0) {
            remainingDeviceStopFailures -= 1;
            throw new Error("device stop failed");
          }
        },
      };
    },
    loadInboxJobs: async () => {
      increment(counters, "loadInboxJobs");
      order.push("loadInboxJobs");
      return {
        startInboxScheduler: (edition) => {
          increment(counters, "startInboxScheduler");
          order.push("startInboxScheduler");
          inboxSchedulerEditions.push(edition ?? "MISSING");
          return async () => {
            increment(counters, "stopInboxScheduler");
            order.push("stopInboxScheduler");
          };
        },
      };
    },
    loadInboxWebsocket: async () => {
      increment(counters, "loadInboxWebsocket");
      order.push("loadInboxWebsocket");
      return {
        attachInboxWebsocket: (attachedServer: Server, edition) => {
          assert.equal(attachedServer, server);
          inboxWebsocketEditions.push(edition ?? "MISSING");
          increment(counters, "attachInboxWebsocket");
          order.push("attachInboxWebsocket");
          return async () => {
            increment(counters, "stopInboxWebsocket");
            order.push("stopInboxWebsocket");
          };
        },
      };
    },
    loadBackupScheduler: async () => {
      increment(counters, "loadBackupScheduler");
      order.push("loadBackupScheduler");
      return {
        startBackupScheduler: () => {
          increment(counters, "startBackupScheduler");
          order.push("startBackupScheduler");
          return async () => {
            increment(counters, "stopBackupScheduler");
            order.push("stopBackupScheduler");
          };
        },
      };
    },
    createHttpServer: (createdApp: TestApp) => {
      assert.equal(createdApp, app);
      increment(counters, "createHttpServer");
      order.push("createHttpServer");
      return server;
    },
    listen: (listeningServer: Server, port: number, onListening: () => void) => {
      assert.equal(listeningServer, server);
      assert.equal(port, 4000);
      increment(counters, "listen");
      order.push("listen");
      onListening();
    },
  } satisfies RuntimeDependencies;

  return { counters, order, inboxSchedulerEditions, inboxWebsocketEditions, dependencies, server };
}

function assertBaseRuntimeStartedOnce(counters: Counters): void {
  for (const name of ["loadApp", "createApp", "createHttpServer", "listen"] as const) {
    assert.equal(counters[name], 1, `${name} should run exactly once`);
  }
  assert.equal(counters.loadRestoreMaintenance, 1);
  assert.equal(counters.getRestoreMaintenanceStatus, 1);
}

function assertDisabledInboxRuntimeModulesNotLoaded(): void {
  const modulePaths = [
    path.resolve(__dirname, "modules/inbox/inbox.jobs.js"),
    path.resolve(__dirname, "modules/inbox/inbox.ws.js"),
  ];

  for (const modulePath of modulePaths) {
    assert.equal(require.cache[modulePath], undefined, `Disabled runtime module should not load: ${modulePath}`);
  }
}

async function testAttendanceStartsDeviceAndBackupConsumers(): Promise<void> {
  const { startCurrentRuntime, STARTUP_CONSUMER_CAPABILITIES } = require("./bootstrap") as typeof import("./bootstrap");
  const { getEffectiveFeatures } = require("./config/capabilities") as typeof import("./config/capabilities");
  const { runtimeOptionalFeatureFlags } = require("./config/env") as typeof import("./config/env");
  const harness = createRuntimeHarness();

  for (const flag of OPTIONAL_ATTENDANCE_ENV_FLAGS) {
    assert.equal(process.env[flag], "1", `${flag} poison value was not present at startup`);
  }
  assert.deepEqual(getEffectiveFeatures("ATTENDANCE"), ["ADMIN_USERS", "ATTENDANCE_DAILY", "ATTENDANCE_DASHBOARD", "ATTENDANCE_EXPORT", "ATTENDANCE_REPORTS", "AUDIT_LOGS", "AUTH", "BACKUPS", "DEVICES", "EMPLOYEES", "ENTRY_LOGS"]);
  assert.equal(runtimeOptionalFeatureFlags.APP_FEATURE_INBOX, true);
  assert.equal(getEffectiveFeatures("ATTENDANCE", runtimeOptionalFeatureFlags).includes("INBOX"), false);
  assert.deepEqual(STARTUP_CONSUMER_CAPABILITIES, {
    deviceManager: "DEVICES",
    inboxScheduler: "INBOX",
    inboxWebsocket: "INBOX",
    backupScheduler: "BACKUPS",
  });
  assert.equal(Object.isFrozen(STARTUP_CONSUMER_CAPABILITIES), true);

  await startCurrentRuntime("ATTENDANCE", harness.dependencies);

  assertBaseRuntimeStartedOnce(harness.counters);
  for (const name of [
    "loadInboxJobs",
    "startInboxScheduler",
    "loadInboxWebsocket",
    "attachInboxWebsocket",
  ] as const) {
    assert.equal(harness.counters[name], 0, `${name} must have no ATTENDANCE startup side effect`);
  }
  assert.equal(harness.counters.loadDeviceManager, 1);
  assert.equal(harness.counters.startDeviceManager, 1);
  assert.equal(harness.counters.loadBackupScheduler, 1);
  assert.equal(harness.counters.startBackupScheduler, 1);
  assert.deepEqual(harness.order, [
    "loadApp",
    "loadRestoreMaintenance",
    "getRestoreMaintenanceStatus",
    "loadBackupScheduler",
    "loadDeviceManager",
    "createApp",
    "createHttpServer",
    "listen",
    "startDeviceManager",
    "startBackupScheduler",
  ]);
  assertDisabledInboxRuntimeModulesNotLoaded();
}

async function testFullPreservesEveryStartupConsumer(): Promise<void> {
  const { startCurrentRuntime } = require("./bootstrap") as typeof import("./bootstrap");
  const harness = createRuntimeHarness();

  await startCurrentRuntime("FULL", harness.dependencies);

  assertBaseRuntimeStartedOnce(harness.counters);
  for (const name of [
    "loadDeviceManager",
    "startDeviceManager",
    "loadInboxJobs",
    "startInboxScheduler",
    "loadInboxWebsocket",
    "attachInboxWebsocket",
    "loadBackupScheduler",
    "startBackupScheduler",
  ] as const) {
    assert.equal(harness.counters[name], 1, `${name} should run exactly once in FULL`);
  }
  assert.deepEqual(harness.order, [
    "loadApp",
    "loadRestoreMaintenance",
    "getRestoreMaintenanceStatus",
    "loadBackupScheduler",
    "loadDeviceManager",
    "loadInboxJobs",
    "loadInboxWebsocket",
    "createApp",
    "createHttpServer",
    "attachInboxWebsocket",
    "listen",
    "startDeviceManager",
    "startInboxScheduler",
    "startBackupScheduler",
  ]);
  assert.deepEqual(harness.inboxSchedulerEditions, ["FULL"]);
  assert.deepEqual(harness.inboxWebsocketEditions, ["FULL"]);
}

async function testFullLoaderFailureRemainsSequentialAndFailFast(): Promise<void> {
  const { startCurrentRuntime } = require("./bootstrap") as typeof import("./bootstrap");
  const harness = createRuntimeHarness();
  const expectedError = new Error("backup module failed to load");
  const dependencies: RuntimeDependencies = {
    ...harness.dependencies,
    loadBackupScheduler: async () => {
      increment(harness.counters, "loadBackupScheduler");
      harness.order.push("loadBackupScheduler");
      throw expectedError;
    },
  };

  await assert.rejects(startCurrentRuntime("FULL", dependencies), (error: unknown) => error === expectedError);
  assert.deepEqual(harness.order, [
    "loadApp",
    "loadRestoreMaintenance",
    "getRestoreMaintenanceStatus",
    "loadBackupScheduler",
  ]);
  assert.equal(harness.counters.loadDeviceManager, 0);
  assert.equal(harness.counters.loadInboxJobs, 0);
  assert.equal(harness.counters.loadInboxWebsocket, 0);
  assert.equal(harness.counters.createApp, 0);
  assert.equal(harness.counters.listen, 0);
}

async function testDeviceStartupFailureRemainsNonFatal(): Promise<void> {
  const { startCurrentRuntime } = require("./bootstrap") as typeof import("./bootstrap");
  const { logger } = require("./config/logger") as typeof import("./config/logger");
  const expectedError = new Error("device startup failed");
  const harness = createRuntimeHarness({ deviceStartError: expectedError });
  const originalLoggerError = logger.error;
  const errorLogs: Array<{ message: string; meta?: Record<string, unknown> }> = [];

  logger.error = (message: string, meta?: Record<string, unknown>) => {
    errorLogs.push({ message, ...(meta ? { meta } : {}) });
  };

  try {
    await startCurrentRuntime("FULL", harness.dependencies);
    await new Promise<void>((resolve) => setImmediate(resolve));
  } finally {
    logger.error = originalLoggerError;
  }

  assert.equal(harness.counters.startDeviceManager, 1);
  assert.equal(harness.counters.startInboxScheduler, 1);
  assert.equal(harness.counters.startBackupScheduler, 1);
  assert.equal(errorLogs.length, 1);
  assert.equal(errorLogs[0]?.message, "Failed to start device polling");
  assert.equal(errorLogs[0]?.meta?.["message"], expectedError.message);
}

async function testMaintenanceStatusFailureStopsBeforeRuntimeSideEffects(): Promise<void> {
  const { startCurrentRuntime } = require("./bootstrap") as typeof import("./bootstrap");
  const expectedError = new Error("maintenance status unavailable");
  const harness = createRuntimeHarness({ maintenanceStatusError: expectedError });

  await assert.rejects(startCurrentRuntime("FULL", harness.dependencies), (error: unknown) => error === expectedError);
  assert.deepEqual(harness.order, ["loadApp", "loadRestoreMaintenance", "getRestoreMaintenanceStatus"]);
  for (const name of [
    "loadBackupScheduler",
    "loadDeviceManager",
    "loadInboxJobs",
    "loadInboxWebsocket",
    "createApp",
    "createHttpServer",
    "listen",
  ] as const) {
    assert.equal(harness.counters[name], 0, `${name} must stay stopped when maintenance admission fails`);
  }
}

async function testFullMaintenanceStartsHttpOnlyThenResumesAndPausesConsumers(): Promise<void> {
  const { startCurrentRuntime } = require("./bootstrap") as typeof import("./bootstrap");
  const {
    resumeRuntimeAfterRestoreMaintenance,
    suspendRuntimeForRestoreMaintenance,
  } = require("./shared/restore-maintenance-runtime") as typeof import("./shared/restore-maintenance-runtime");
  const harness = createRuntimeHarness({ maintenanceEnabled: true });

  await startCurrentRuntime("FULL", harness.dependencies);
  assertBaseRuntimeStartedOnce(harness.counters);
  assert.deepEqual(harness.order, [
    "loadApp",
    "loadRestoreMaintenance",
    "getRestoreMaintenanceStatus",
    "createApp",
    "createHttpServer",
    "listen",
  ]);
  for (const name of [
    "loadBackupScheduler",
    "loadDeviceManager",
    "loadInboxJobs",
    "loadInboxWebsocket",
    "startDeviceManager",
    "startInboxScheduler",
    "attachInboxWebsocket",
    "startBackupScheduler",
  ] as const) {
    assert.equal(harness.counters[name], 0, `${name} must not run while startup maintenance is active`);
  }

  await resumeRuntimeAfterRestoreMaintenance();
  for (const name of [
    "loadBackupScheduler",
    "loadDeviceManager",
    "loadInboxJobs",
    "loadInboxWebsocket",
    "startDeviceManager",
    "startInboxScheduler",
    "attachInboxWebsocket",
    "startBackupScheduler",
  ] as const) {
    assert.equal(harness.counters[name], 1, `${name} should resume exactly once after maintenance clears`);
  }

  await suspendRuntimeForRestoreMaintenance();
  for (const name of [
    "stopDeviceManager",
    "stopInboxScheduler",
    "stopInboxWebsocket",
    "stopBackupScheduler",
  ] as const) {
    assert.equal(harness.counters[name], 1, `${name} should quiesce exactly once when maintenance starts`);
  }
  await suspendRuntimeForRestoreMaintenance();
  assert.equal(harness.counters.stopDeviceManager, 1, "Repeated maintenance activation must be idempotent");
}

async function testAttendanceMaintenanceResumesDeviceAndBackupConsumers(): Promise<void> {
  const { startCurrentRuntime } = require("./bootstrap") as typeof import("./bootstrap");
  const {
    resumeRuntimeAfterRestoreMaintenance,
    suspendRuntimeForRestoreMaintenance,
  } = require("./shared/restore-maintenance-runtime") as typeof import("./shared/restore-maintenance-runtime");
  const harness = createRuntimeHarness({ maintenanceEnabled: true });

  await startCurrentRuntime("ATTENDANCE", harness.dependencies);
  assertBaseRuntimeStartedOnce(harness.counters);
  await resumeRuntimeAfterRestoreMaintenance();
  assert.equal(harness.counters.loadDeviceManager, 1);
  assert.equal(harness.counters.startDeviceManager, 1);
  assert.equal(harness.counters.loadBackupScheduler, 1);
  assert.equal(harness.counters.startBackupScheduler, 1);
  for (const name of [
    "loadInboxJobs",
    "loadInboxWebsocket",
    "startInboxScheduler",
    "attachInboxWebsocket",
  ] as const) {
    assert.equal(harness.counters[name], 0, `${name} must remain capability-disabled in Attendance`);
  }
  await suspendRuntimeForRestoreMaintenance();
  assert.equal(harness.counters.stopDeviceManager, 1);
  assert.equal(harness.counters.stopInboxScheduler, 0);
  assert.equal(harness.counters.stopInboxWebsocket, 0);
  assert.equal(harness.counters.stopBackupScheduler, 1);
}

async function testMaintenancePauseFailureCanBeRetried(): Promise<void> {
  const { startCurrentRuntime } = require("./bootstrap") as typeof import("./bootstrap");
  const {
    resumeRuntimeAfterRestoreMaintenance,
    suspendRuntimeForRestoreMaintenance,
  } = require("./shared/restore-maintenance-runtime") as typeof import("./shared/restore-maintenance-runtime");
  const harness = createRuntimeHarness({ deviceStopFailures: 1 });

  await startCurrentRuntime("FULL", harness.dependencies);
  await assert.rejects(suspendRuntimeForRestoreMaintenance(), /device stop failed/);
  assert.equal(harness.counters.stopDeviceManager, 1);
  assert.equal(harness.counters.stopInboxScheduler, 0);
  assert.equal(harness.counters.stopBackupScheduler, 0);
  assert.equal(harness.counters.stopInboxWebsocket, 0);

  await suspendRuntimeForRestoreMaintenance();
  assert.equal(harness.counters.stopDeviceManager, 2, "A failed pause must remain retryable");
  assert.equal(harness.counters.stopInboxScheduler, 1);
  assert.equal(harness.counters.stopBackupScheduler, 1);
  assert.equal(harness.counters.stopInboxWebsocket, 1);

  await resumeRuntimeAfterRestoreMaintenance();
  assert.equal(harness.counters.startDeviceManager, 2);
  assert.equal(harness.counters.startInboxScheduler, 2);
  assert.equal(harness.counters.startBackupScheduler, 2);
  assert.equal(harness.counters.attachInboxWebsocket, 2);
}

async function main(): Promise<void> {
  await testAttendanceStartsDeviceAndBackupConsumers();
  await testFullPreservesEveryStartupConsumer();
  await testFullLoaderFailureRemainsSequentialAndFailFast();
  await testDeviceStartupFailureRemainsNonFatal();
  await testMaintenanceStatusFailureStopsBeforeRuntimeSideEffects();
  await testFullMaintenanceStartsHttpOnlyThenResumesAndPausesConsumers();
  await testAttendanceMaintenanceResumesDeviceAndBackupConsumers();
  await testMaintenancePauseFailureCanBeRetried();
  console.log("ok - edition-gated and restore-maintenance-gated startup consumers");
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
