import { AdminPermission } from "@prisma/client";
import { Router } from "express";
import type { AppEdition } from "../../shared/app-identity";
import { requirePermission } from "../../middlewares/auth";
import { deviceIdParamSchema, deviceUnlockSchema } from "./device.schemas";
import { runAuditedDeviceCommand } from "./deviceCommandAudit.service";
import { getDeviceActionContext } from "./device-router.shared";
import {
  getDeviceDataScope,
  type DeviceDataScope,
} from "./device-edition-scope";

type DeviceManagerModule = typeof import("./deviceManager");

function loadDeviceManager(): DeviceManagerModule {
  return require("./deviceManager") as DeviceManagerModule;
}

export function createDeviceDoorControlRouter(edition: AppEdition) {
  return createDeviceDoorControlRouterForScope(getDeviceDataScope(edition));
}

export function createDeviceDoorControlRouterForScope(scope: DeviceDataScope) {
  const router = Router();

  router.post(
    "/:id/unlock",
    requirePermission(AdminPermission.DEVICES_VIEW),
    requirePermission(AdminPermission.DOOR_UNLOCK),
    async (req, res, next) => {
      try {
        const { id } = deviceIdParamSchema.parse(req.params);
        const payload = deviceUnlockSchema.parse(req.body ?? {});
        const result = await runAuditedDeviceCommand({
          action: "device.door.unlocked",
          targetId: id,
          context: getDeviceActionContext(req),
          ...(payload.seconds !== undefined
            ? { failureMetadata: { requestedDurationSeconds: payload.seconds } }
            : {}),
          execute: () => loadDeviceManager().unlockDeviceDoor(id, payload.seconds, scope),
          summarize: (commandResult) => ({
            success: commandResult.ok,
            metadata: {
              outcome: commandResult.ok ? "COMPLETED" : "FAILED",
              durationSeconds: commandResult.seconds,
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

  return router;
}
