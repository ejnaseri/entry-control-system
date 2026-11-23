import { Router } from "express";
import type { Request } from "express";
import { z } from "zod";
import { AdminPermission } from "@prisma/client";
import { requirePermission } from "../../middlewares/auth";
import { HttpError } from "../../middlewares/error-handler";
import {
  createMembershipPlan,
  getPlans,
  softDeletePlan,
  updateMembershipPlan,
  type PlanActionContext,
} from "./plan.service";

const planSchema = z.object({
  name: z.string().min(2),
  description: z.string().optional(),
  durationValue: z.number().int().min(1),
  durationUnit: z.enum(["DAYS", "MONTHS"]),
  basePrice: z.number().int().nonnegative(),
  isActive: z.boolean().optional(),
});

const planIdSchema = z.object({ id: z.string().cuid("Invalid plan id") });

export const planRouter = Router();

function buildPlanPayload(raw: z.infer<typeof planSchema>) {
  return {
    name: raw.name,
    durationValue: raw.durationValue,
    durationUnit: raw.durationUnit,
    basePrice: raw.basePrice,
    ...(raw.description !== undefined ? { description: raw.description } : {}),
    ...(raw.isActive !== undefined ? { isActive: raw.isActive } : {}),
  };
}

planRouter.get("/", async (req, res, next) => {
  try {
    const includeInactive = req.query["includeInactive"] === "true";
    const plans = await getPlans(includeInactive);
    res.json(plans);
  } catch (error) {
    next(error);
  }
});

planRouter.post("/", requirePermission(AdminPermission.SYSTEM_SETTINGS_MANAGE), async (req, res, next) => {
  try {
    const payload = buildPlanPayload(planSchema.parse(req.body));
    const plan = await createMembershipPlan(payload, getPlanActionContext(req));
    res.status(201).json(plan);
  } catch (error) {
    next(error);
  }
});

planRouter.put("/:id", requirePermission(AdminPermission.SYSTEM_SETTINGS_MANAGE), async (req, res, next) => {
  try {
    const { id } = planIdSchema.parse(req.params);
    const payload = buildPlanPayload(planSchema.parse(req.body));
    const plan = await updateMembershipPlan(id, payload, getPlanActionContext(req));
    res.json(plan);
  } catch (error) {
    next(error);
  }
});

planRouter.delete("/:id", requirePermission(AdminPermission.SYSTEM_SETTINGS_MANAGE), async (req, res, next) => {
  try {
    const { id } = planIdSchema.parse(req.params);
    const plan = await softDeletePlan(id, getPlanActionContext(req));
    res.json(plan);
  } catch (error) {
    next(error);
  }
});

function getPlanActionContext(req: Request): PlanActionContext {
  const auth = req.auth;
  if (!auth) {
    throw new HttpError(401, "Authentication required");
  }

  const meta: PlanActionContext["meta"] = {};
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
