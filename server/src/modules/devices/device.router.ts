import { Router } from "express";
import { FULL_DEVICE_DATA_SCOPE } from "./device-edition-scope";
import { createDeviceCoreRouterForScope } from "./device-core.router";
import { createDeviceDiagnosticsRouterForScope } from "./device-diagnostics.router";
import { createDeviceDoorControlRouterForScope } from "./device-door-control.router";

// FULL-only compatibility aggregator for legacy callers and integration tests.
// Capability-owned registrations must import the three physical Router modules
// directly so disabled optional surfaces are never loaded or constructed.
export const deviceRouter = Router();
deviceRouter.use((req, res, next) => {
  const { devicePushRouter } = require("./device-push.router") as typeof import("./device-push.router");
  devicePushRouter(req, res, next);
});
deviceRouter.use(createDeviceDiagnosticsRouterForScope(FULL_DEVICE_DATA_SCOPE));
deviceRouter.use(createDeviceDoorControlRouterForScope(FULL_DEVICE_DATA_SCOPE));
deviceRouter.use(createDeviceCoreRouterForScope(FULL_DEVICE_DATA_SCOPE));
