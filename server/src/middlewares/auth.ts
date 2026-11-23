import type { NextFunction, Request, Response } from "express";
import type { AdminPermission } from "@prisma/client";
import { getAuthSessionToken } from "../modules/auth/auth.cookies";
import { getCurrentAuth } from "../modules/auth/auth.service";

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

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  resolveAuth(req)
    .then((auth) => {
      if (!auth) {
        res.status(401).json({ message: "Authentication required" });
        return;
      }
      next();
    })
    .catch(next);
}

export function requirePermission(permission: AdminPermission) {
  return (req: Request, res: Response, next: NextFunction) => {
    resolveAuth(req)
      .then((auth) => {
        if (!auth) {
          res.status(401).json({ message: "Authentication required" });
          return;
        }
        if (!auth.permissions.includes(permission)) {
          res.status(403).json({ message: "Permission denied", requiredPermission: permission });
          return;
        }
        next();
      })
      .catch(next);
  };
}

export function requireAnyPermission(permissions: AdminPermission[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    resolveAuth(req)
      .then((auth) => {
        if (!auth) {
          res.status(401).json({ message: "Authentication required" });
          return;
        }
        if (!permissions.some((permission) => auth.permissions.includes(permission))) {
          res.status(403).json({ message: "Permission denied", requiredPermissions: permissions });
          return;
        }
        next();
      })
      .catch(next);
  };
}
