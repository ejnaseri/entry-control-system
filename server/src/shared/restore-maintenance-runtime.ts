export type RestoreMaintenanceRuntimeController = Readonly<{
  pause: () => Promise<void>;
  resume: () => Promise<void>;
}>;

let controller: RestoreMaintenanceRuntimeController | null = null;
let maintenanceActive = false;
let transition: Promise<void> = Promise.resolve();

export function registerRestoreMaintenanceRuntime(
  nextController: RestoreMaintenanceRuntimeController,
  initialMaintenanceActive: boolean
) {
  controller = nextController;
  maintenanceActive = initialMaintenanceActive;
  return () => {
    if (controller === nextController) controller = null;
  };
}

export function suspendRuntimeForRestoreMaintenance() {
  maintenanceActive = true;
  return enqueueTransition(async () => {
    await controller?.pause();
  });
}

export function resumeRuntimeAfterRestoreMaintenance() {
  maintenanceActive = false;
  return enqueueTransition(async () => {
    await controller?.resume();
  });
}

export function isRestoreMaintenanceRuntimeActive() {
  return maintenanceActive;
}

function enqueueTransition(operation: () => Promise<void>) {
  const next = transition.catch(() => undefined).then(operation);
  transition = next;
  return next;
}

export const restoreMaintenanceRuntimeTestHooks = Object.freeze({
  reset() {
    controller = null;
    maintenanceActive = false;
    transition = Promise.resolve();
  },
});
