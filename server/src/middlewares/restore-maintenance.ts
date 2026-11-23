import type { NextFunction, Request, Response } from "express";
import { AdminRole } from "@prisma/client";
import { getAuthSessionToken } from "../modules/auth/auth.cookies";
import { getCurrentAuth } from "../modules/auth/auth.service";
import { getRestoreMaintenanceStatus } from "../modules/backups/backup.service";

function getRequestMeta(req: Request) {
  const meta: { ipAddress?: string; userAgent?: string } = {};
  if (req.ip) {
    meta.ipAddress = req.ip;
  }
  const userAgent = req.get("user-agent");
  if (userAgent) {
    meta.userAgent = userAgent;
  }
  return meta;
}

async function resolveAuth(req: Request) {
  if (req.auth) {
    return req.auth;
  }
  const auth = await getCurrentAuth(getAuthSessionToken(req), getRequestMeta(req));
  if (auth) {
    req.auth = auth;
  }
  return auth;
}

function isBackupControlPath(pathname: string) {
  return pathname === "/backups"
    || pathname.startsWith("/backups/")
    || pathname === "/api/v1/backups"
    || pathname.startsWith("/api/v1/backups/");
}

function canUseBackupControls(role: AdminRole) {
  return role === AdminRole.GYM_OWNER || role === AdminRole.VENDOR_OWNER;
}

export function restoreMaintenanceMiddleware(req: Request, res: Response, next: NextFunction) {
  getRestoreMaintenanceStatus()
    .then(async (maintenance) => {
      if (!maintenance.enabled) {
        next();
        return;
      }

      const auth = await resolveAuth(req);
      if (isBackupControlPath(req.path)) {
        if (!auth || canUseBackupControls(auth.user.role)) {
          next();
          return;
        }
      }

      res.status(503).json({
        message: "System is in restore maintenance mode",
        maintenance: {
          enabled: true,
          restoreJobId: maintenance.restoreJobId,
          startedAt: maintenance.startedAt,
          selectedBackupFolderName: maintenance.selectedBackupFolderName,
        },
      });
    })
    .catch(next);
}
