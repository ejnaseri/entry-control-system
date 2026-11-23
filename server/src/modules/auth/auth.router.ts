import { Router } from "express";
import type { Request } from "express";
import { getAuthSessionToken, setAuthSessionCookie, clearAuthSessionCookie } from "./auth.cookies";
import { getCurrentAuth, getSetupStatus, login, logout, setupGymOwner } from "./auth.service";
import { loginSchema, setupOwnerSchema } from "./auth.schemas";

export const authRouter = Router();

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

authRouter.get("/setup-status", async (_req, res, next) => {
  try {
    const status = await getSetupStatus();
    res.json(status);
  } catch (error) {
    next(error);
  }
});

authRouter.post("/setup", async (req, res, next) => {
  try {
    const payload = setupOwnerSchema.parse(req.body);
    const result = await setupGymOwner(payload, getRequestMeta(req));
    setAuthSessionCookie(res, result.sessionToken, result.auth.expiresAt);
    res.status(201).json(result.auth);
  } catch (error) {
    next(error);
  }
});

authRouter.post("/login", async (req, res, next) => {
  try {
    const payload = loginSchema.parse(req.body);
    const result = await login(payload, getRequestMeta(req));
    setAuthSessionCookie(res, result.sessionToken, result.auth.expiresAt);
    res.json(result.auth);
  } catch (error) {
    next(error);
  }
});

authRouter.post("/logout", async (req, res, next) => {
  try {
    await logout(getAuthSessionToken(req), getRequestMeta(req));
    clearAuthSessionCookie(res);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

authRouter.get("/me", async (req, res, next) => {
  try {
    const auth = await getCurrentAuth(getAuthSessionToken(req), getRequestMeta(req));
    if (!auth) {
      res.status(401).json({ message: "Authentication required" });
      return;
    }
    res.json(auth);
  } catch (error) {
    next(error);
  }
});
