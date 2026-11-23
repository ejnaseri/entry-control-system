import { Router } from "express";
import type { Request } from "express";
import { AdminPermission } from "@prisma/client";
import type { AppEdition } from "../../config/env";
import { requirePermission } from "../../middlewares/auth";
import {
  activateVendorMaintenance,
  createAdminUser,
  deactivateAdminUser,
  deactivateVendorMaintenance,
  getVendorMaintenanceStatus,
  listAdminRoles,
  listAdminUsers,
  reactivateAdminUser,
  resetAdminUserPassword,
  updateAdminUser,
} from "./admin-user.service";
import {
  adminUserCreateSchema,
  attendanceAdminUserCreateSchema,
  adminUserIdParamSchema,
  adminUserResetPasswordSchema,
  adminUserUpdateSchema,
  attendanceAdminUserUpdateSchema,
  vendorMaintenanceActivateSchema,
  vendorMaintenanceDeactivateSchema,
} from "./admin-user.schemas";

export function createAdminUserRouter(edition: AppEdition) {
const adminUserRouter = Router();
const createSchema = edition === "ATTENDANCE" ? attendanceAdminUserCreateSchema : adminUserCreateSchema;
const updateSchema = edition === "ATTENDANCE" ? attendanceAdminUserUpdateSchema : adminUserUpdateSchema;

adminUserRouter.use(requirePermission(AdminPermission.ADMIN_USERS_MANAGE));

function getRequestMeta(req: Request) {
  const meta: { ipAddress?: string; userAgent?: string } = {};
  if (req.ip) meta.ipAddress = req.ip;
  const userAgent = req.get("user-agent");
  if (userAgent) meta.userAgent = userAgent;
  return meta;
}

function getContext(req: Request) {
  const auth = req.auth;
  if (!auth) {
    throw new Error("Admin auth context was not resolved");
  }
  return {
    actor: {
      id: auth.user.id,
      role: auth.user.role,
      sessionId: auth.session.id,
    },
    meta: getRequestMeta(req),
  };
}

adminUserRouter.get("/", async (_req, res, next) => {
  try {
    const result = await listAdminUsers(edition);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

adminUserRouter.get("/roles", (_req, res) => {
  res.json({ roles: listAdminRoles(edition) });
});

adminUserRouter.get("/vendor-maintenance", async (_req, res, next) => {
  try {
    res.json(await getVendorMaintenanceStatus());
  } catch (error) {
    next(error);
  }
});

adminUserRouter.post("/vendor-maintenance/activate", async (req, res, next) => {
  try {
    const payload = vendorMaintenanceActivateSchema.parse(req.body);
    res.json(await activateVendorMaintenance(payload, getContext(req)));
  } catch (error) {
    next(error);
  }
});

adminUserRouter.post("/vendor-maintenance/deactivate", async (req, res, next) => {
  try {
    const payload = vendorMaintenanceDeactivateSchema.parse(req.body ?? {});
    res.json(await deactivateVendorMaintenance(payload, getContext(req)));
  } catch (error) {
    next(error);
  }
});

adminUserRouter.post("/", async (req, res, next) => {
  try {
    const payload = createSchema.parse(req.body);
    const user = await createAdminUser(payload, getContext(req), edition);
    res.status(201).json(user);
  } catch (error) {
    next(error);
  }
});

adminUserRouter.put("/:id", async (req, res, next) => {
  try {
    const { id } = adminUserIdParamSchema.parse(req.params);
    const payload = updateSchema.parse(req.body);
    const user = await updateAdminUser(id, payload, getContext(req), edition);
    res.json(user);
  } catch (error) {
    next(error);
  }
});

adminUserRouter.post("/:id/reset-password", async (req, res, next) => {
  try {
    const { id } = adminUserIdParamSchema.parse(req.params);
    const { password } = adminUserResetPasswordSchema.parse(req.body);
    const user = await resetAdminUserPassword(id, password, getContext(req));
    res.json(user);
  } catch (error) {
    next(error);
  }
});

adminUserRouter.post("/:id/deactivate", async (req, res, next) => {
  try {
    const { id } = adminUserIdParamSchema.parse(req.params);
    const user = await deactivateAdminUser(id, getContext(req));
    res.json(user);
  } catch (error) {
    next(error);
  }
});

adminUserRouter.post("/:id/reactivate", async (req, res, next) => {
  try {
    const { id } = adminUserIdParamSchema.parse(req.params);
    const user = await reactivateAdminUser(id, getContext(req));
    res.json(user);
  } catch (error) {
    next(error);
  }
});

return adminUserRouter;
}
