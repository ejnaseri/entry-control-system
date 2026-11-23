import { Router } from "express";
import type { Request } from "express";
import { AdminPermission } from "@prisma/client";
import { requirePermission } from "../../middlewares/auth";
import { HttpError } from "../../middlewares/error-handler";
import {
  createStaffGroup,
  getStaffGroup,
  listStaffGroups,
  removeStaffGroup,
  updateStaffGroup,
  type StaffGroupActionContext,
} from "./staff-group.service";
import { staffGroupCreateSchema, staffGroupIdParamSchema, staffGroupUpdateSchema } from "./staff-group.schemas";

export const staffGroupRouter = Router();

staffGroupRouter.get("/", async (_req, res, next) => {
  try {
    const groups = await listStaffGroups();
    res.json(groups);
  } catch (error) {
    next(error);
  }
});

staffGroupRouter.post("/", requirePermission(AdminPermission.SYSTEM_SETTINGS_MANAGE), async (req, res, next) => {
  try {
    const payload = staffGroupCreateSchema.parse(req.body);
    const group = await createStaffGroup(payload, getStaffGroupActionContext(req));
    res.status(201).json(group);
  } catch (error) {
    next(error);
  }
});

staffGroupRouter.get("/:id", async (req, res, next) => {
  try {
    const { id } = staffGroupIdParamSchema.parse(req.params);
    const group = await getStaffGroup(id);
    res.json(group);
  } catch (error) {
    next(error);
  }
});

staffGroupRouter.put("/:id", requirePermission(AdminPermission.SYSTEM_SETTINGS_MANAGE), async (req, res, next) => {
  try {
    const { id } = staffGroupIdParamSchema.parse(req.params);
    const payload = staffGroupUpdateSchema.parse(req.body);
    const group = await updateStaffGroup(id, payload, getStaffGroupActionContext(req));
    res.json(group);
  } catch (error) {
    next(error);
  }
});

staffGroupRouter.delete("/:id", requirePermission(AdminPermission.SYSTEM_SETTINGS_MANAGE), async (req, res, next) => {
  try {
    const { id } = staffGroupIdParamSchema.parse(req.params);
    await removeStaffGroup(id, getStaffGroupActionContext(req));
    res.status(204).send();
  } catch (error) {
    if (error instanceof HttpError && error.status === 404) {
      return res.status(404).json({ message: "Staff group not found" });
    }
    next(error);
  }
});

function getStaffGroupActionContext(req: Request): StaffGroupActionContext {
  const auth = req.auth;
  if (!auth) {
    throw new HttpError(401, "Authentication required");
  }

  const meta: StaffGroupActionContext["meta"] = {};
  if (req.ip) meta.ipAddress = req.ip;
  const userAgent = req.get("user-agent");
  if (userAgent) meta.userAgent = userAgent;

  return {
    actor: {
      id: auth.user.id,
      role: auth.user.role,
      sessionId: auth.session.id,
    },
    meta,
  };
}
