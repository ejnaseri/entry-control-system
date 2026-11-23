import { createServer, type Server } from "http";
import { isFeatureEnabled, type Capability } from "./config/capabilities";
import { currentServerBuildIdentity } from "./config/build-identity";
import { env, runtimeOptionalFeatureFlags, type AppEdition } from "./config/env";
import { logger } from "./config/logger";
import { getDeviceDataScope } from "./modules/devices/device-edition-scope";
import { registerRestoreMaintenanceRuntime } from "./shared/restore-maintenance-runtime";

type AppModule = Pick<typeof import("./app"), "createApp">;
type BackupModule = Pick<typeof import("./modules/backups/backup.service"), "startBackupScheduler">;
type RestoreMaintenanceModule = Pick<typeof import("./modules/backups/backup.service"), "getRestoreMaintenanceStatus">;
type DeviceManagerModule = Pick<typeof import("./modules/devices/deviceManager"), "startAllActiveDevices" | "stopAllActiveDevices">;
type InboxJobsModule = Pick<typeof import("./modules/inbox/inbox.jobs"), "startInboxScheduler">;
type InboxWebsocketModule = Pick<typeof import("./modules/inbox/inbox.ws"), "attachInboxWebsocket">;
type RuntimeStop = () => void | Promise<void>;

export const STARTUP_CONSUMER_CAPABILITIES = Object.freeze({
  deviceManager: "DEVICES",
  inboxScheduler: "INBOX",
  inboxWebsocket: "INBOX",
  backupScheduler: "BACKUPS",
} as const satisfies Record<string, Capability>);

export type RuntimeDependencies = Readonly<{
  loadApp: () => Promise<AppModule>;
  loadRestoreMaintenance: () => Promise<RestoreMaintenanceModule>;
  loadBackupScheduler: () => Promise<BackupModule>;
  loadDeviceManager: () => Promise<DeviceManagerModule>;
  loadInboxJobs: () => Promise<InboxJobsModule>;
  loadInboxWebsocket: () => Promise<InboxWebsocketModule>;
  createHttpServer: (app: ReturnType<AppModule["createApp"]>) => Server;
  listen: (server: Server, port: number, onListening: () => void) => void;
}>;

export type RuntimeStarter = (edition: AppEdition) => void | Promise<void>;

const DEFAULT_RUNTIME_DEPENDENCIES: RuntimeDependencies = Object.freeze({
  loadApp: () => import("./app"),
  loadRestoreMaintenance: () => import("./modules/backups/backup.service"),
  loadBackupScheduler: () => import("./modules/backups/backup.service"),
  loadDeviceManager: () => import("./modules/devices/deviceManager"),
  loadInboxJobs: () => import("./modules/inbox/inbox.jobs"),
  loadInboxWebsocket: () => import("./modules/inbox/inbox.ws"),
  createHttpServer: (app) => createServer(app),
  listen: (server, port, onListening) => {
    server.listen(port, onListening);
  },
});

export async function startCurrentRuntime(
  edition: AppEdition,
  dependencies: RuntimeDependencies = DEFAULT_RUNTIME_DEPENDENCIES
): Promise<void> {
  const devicesEnabled = isFeatureEnabled(edition, STARTUP_CONSUMER_CAPABILITIES.deviceManager, runtimeOptionalFeatureFlags);
  const inboxSchedulerEnabled = isFeatureEnabled(edition, STARTUP_CONSUMER_CAPABILITIES.inboxScheduler, runtimeOptionalFeatureFlags);
  const inboxWebsocketEnabled = isFeatureEnabled(edition, STARTUP_CONSUMER_CAPABILITIES.inboxWebsocket, runtimeOptionalFeatureFlags);
  const backupsEnabled = isFeatureEnabled(edition, STARTUP_CONSUMER_CAPABILITIES.backupScheduler, runtimeOptionalFeatureFlags);

  // Maintenance is a system-level admission gate, independent of Edition capabilities.
  const appModule = await dependencies.loadApp();
  const maintenanceModule = await dependencies.loadRestoreMaintenance();
  const maintenance = await maintenanceModule.getRestoreMaintenanceStatus();

  let backupScheduler: BackupModule | null = null;
  let deviceManager: DeviceManagerModule | null = null;
  let inboxJobs: InboxJobsModule | null = null;
  let inboxWebsocket: InboxWebsocketModule | null = null;
  let stopBackupScheduler: RuntimeStop | null = null;
  let stopInboxScheduler: RuntimeStop | null = null;
  let stopInboxWebsocket: RuntimeStop | null = null;
  let deviceStart: Promise<void> | null = null;
  let paused = maintenance.enabled;

  const loadEnabledConsumers = async () => {
    // Preserve the relative legacy FULL load order while keeping disabled modules lazy.
    backupScheduler ??= backupsEnabled ? await dependencies.loadBackupScheduler() : null;
    deviceManager ??= devicesEnabled ? await dependencies.loadDeviceManager() : null;
    inboxJobs ??= inboxSchedulerEnabled ? await dependencies.loadInboxJobs() : null;
    inboxWebsocket ??= inboxWebsocketEnabled ? await dependencies.loadInboxWebsocket() : null;
  };

  if (!maintenance.enabled) await loadEnabledConsumers();

  const app = appModule.createApp();
  const server = dependencies.createHttpServer(app);

  const attachRealtimeConsumer = () => {
    if (!inboxWebsocket || stopInboxWebsocket) return;
    stopInboxWebsocket = inboxWebsocket.attachInboxWebsocket(server, edition) ?? null;
  };

  const startBackgroundConsumers = () => {
    if (deviceManager && !deviceStart) {
      deviceStart = deviceManager.startAllActiveDevices(getDeviceDataScope(edition))
        .catch((error) => {
          logger.error("Failed to start device polling", { message: error.message, stack: error.stack });
        })
        .finally(() => {
          deviceStart = null;
        });
    }
    if (inboxJobs && !stopInboxScheduler) stopInboxScheduler = inboxJobs.startInboxScheduler(edition);
    if (backupScheduler && !stopBackupScheduler) stopBackupScheduler = backupScheduler.startBackupScheduler();
  };

  registerRestoreMaintenanceRuntime({
    pause: async () => {
      if (paused) return;
      await deviceStart;
      if (deviceManager) await deviceManager.stopAllActiveDevices();
      const stops = [stopInboxScheduler, stopBackupScheduler, stopInboxWebsocket].filter(
        (stop): stop is RuntimeStop => Boolean(stop)
      );
      await Promise.all(stops.map((stop) => stop()));
      stopInboxScheduler = null;
      stopBackupScheduler = null;
      stopInboxWebsocket = null;
      paused = true;
    },
    resume: async () => {
      if (!paused) return;
      await loadEnabledConsumers();
      attachRealtimeConsumer();
      startBackgroundConsumers();
      await deviceStart;
      paused = false;
    },
  }, maintenance.enabled);

  if (!maintenance.enabled) attachRealtimeConsumer();
  dependencies.listen(server, env.PORT, () => {
    logger.info("ECS server running", { port: env.PORT, env: env.NODE_ENV });
  });
  if (!maintenance.enabled) startBackgroundConsumers();
}

export async function bootstrap(startRuntime: RuntimeStarter = startCurrentRuntime): Promise<void> {
  currentServerBuildIdentity(env.APP_EDITION);
  await startRuntime(env.APP_EDITION);
}
