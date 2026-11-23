import { AuditActor, type AdminRole, type MembershipPlan, type Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { HttpError } from "../../middlewares/error-handler";
import { createPlan, findPlanById, listPlans, updatePlan } from "./plan.repository";
import type { MembershipPlanInput } from "../../shared/membership.types";

export type PlanActionContext = {
  actor: {
    id: string;
    role: AdminRole;
    sessionId?: string;
  };
  meta: {
    ipAddress?: string;
    userAgent?: string;
  };
};

type PlanAuditInput = {
  action: "membership_plan.created" | "membership_plan.updated" | "membership_plan.deleted";
  targetId: string;
  beforeData?: Prisma.InputJsonObject;
  afterData?: Prisma.InputJsonObject;
  metadata?: Prisma.InputJsonObject;
};

export async function getPlans(includeInactive = false) {
  return listPlans(includeInactive);
}

export async function createMembershipPlan(input: MembershipPlanInput, context: PlanActionContext) {
  return prisma.$transaction(async (tx) => {
    const created = await createPlan(
      {
        name: input.name,
        description: input.description ?? null,
        durationValue: input.durationValue,
        durationUnit: input.durationUnit,
        basePrice: input.basePrice,
        price: input.basePrice,
        durationDays: input.durationUnit === "MONTHS" ? input.durationValue * 30 : input.durationValue,
        isActive: input.isActive ?? true,
        currency: "AFN",
        slug: `${input.name}-${Date.now()}`,
      },
      tx
    );
    await tx.auditLog.create({
      data: buildPlanAuditData(context, {
        action: "membership_plan.created",
        targetId: created.id,
        afterData: toPlanAuditJson(created),
      }),
    });
    return created;
  });
}

export async function updateMembershipPlan(id: string, input: MembershipPlanInput, context: PlanActionContext) {
  return prisma.$transaction(async (tx) => {
    const exists = await findPlanById(id, tx);
    if (!exists) {
      throw new HttpError(404, "Plan not found");
    }
    const updated = await updatePlan(
      id,
      {
        name: input.name,
        description: input.description ?? null,
        durationValue: input.durationValue,
        durationUnit: input.durationUnit,
        basePrice: input.basePrice,
        price: input.basePrice,
        durationDays: input.durationUnit === "MONTHS" ? input.durationValue * 30 : input.durationValue,
        isActive: input.isActive ?? exists.isActive,
      },
      tx
    );
    await tx.auditLog.create({
      data: buildPlanAuditData(context, {
        action: "membership_plan.updated",
        targetId: updated.id,
        beforeData: toPlanAuditJson(exists),
        afterData: toPlanAuditJson(updated),
        metadata: { changedFields: getPlanChangedFields(exists, updated) },
      }),
    });
    return updated;
  });
}

export async function softDeletePlan(id: string, context: PlanActionContext) {
  return prisma.$transaction(async (tx) => {
    const exists = await findPlanById(id, tx);
    if (!exists) {
      throw new HttpError(404, "Plan not found");
    }
    const alreadyInactive = !exists.isActive;
    const updated = alreadyInactive ? exists : await updatePlan(id, { isActive: false }, tx);
    const linkedMembershipCount = await tx.membership.count({ where: { planId: id } });
    await tx.auditLog.create({
      data: buildPlanAuditData(context, {
        action: "membership_plan.deleted",
        targetId: updated.id,
        beforeData: toPlanAuditJson(exists),
        afterData: toPlanAuditJson(updated),
        metadata: {
          mode: "SOFT_DELETE",
          alreadyInactive,
          linkedMembershipCount,
        },
      }),
    });
    return updated;
  });
}

function buildPlanAuditData(
  context: PlanActionContext,
  input: PlanAuditInput
): Prisma.AuditLogUncheckedCreateInput {
  const data: Prisma.AuditLogUncheckedCreateInput = {
    actorType: AuditActor.ADMIN,
    actorId: context.actor.id,
    actorRole: context.actor.role,
    action: input.action,
    targetType: "MembershipPlan",
    targetId: input.targetId,
    success: true,
  };
  if (context.actor.sessionId) data.sessionId = context.actor.sessionId;
  if (context.meta.ipAddress) data.ipAddress = context.meta.ipAddress;
  if (context.meta.userAgent) data.userAgent = context.meta.userAgent;
  if (input.beforeData) data.beforeData = input.beforeData;
  if (input.afterData) data.afterData = input.afterData;
  if (input.metadata) data.metadata = input.metadata;
  return data;
}

function toPlanAuditJson(plan: MembershipPlan): Prisma.InputJsonObject {
  return {
    id: plan.id,
    name: plan.name,
    durationValue: plan.durationValue,
    durationUnit: plan.durationUnit,
    durationDays: plan.durationDays,
    basePrice: plan.basePrice,
    price: Number(plan.price),
    currency: plan.currency,
    visitLimit: plan.visitLimit ?? "",
    gracePeriodDays: plan.gracePeriodDays ?? "",
    isActive: plan.isActive,
    color: plan.color ?? "",
  };
}

function getPlanChangedFields(before: MembershipPlan, after: MembershipPlan) {
  const values: Array<[string, unknown, unknown]> = [
    ["name", before.name, after.name],
    ["description", before.description, after.description],
    ["durationValue", before.durationValue, after.durationValue],
    ["durationUnit", before.durationUnit, after.durationUnit],
    ["durationDays", before.durationDays, after.durationDays],
    ["basePrice", before.basePrice, after.basePrice],
    ["price", Number(before.price), Number(after.price)],
    ["currency", before.currency, after.currency],
    ["visitLimit", before.visitLimit, after.visitLimit],
    ["gracePeriodDays", before.gracePeriodDays, after.gracePeriodDays],
    ["isActive", before.isActive, after.isActive],
    ["color", before.color, after.color],
  ];
  return values
    .filter(([, beforeValue, afterValue]) => JSON.stringify(beforeValue) !== JSON.stringify(afterValue))
    .map(([field]) => field);
}
