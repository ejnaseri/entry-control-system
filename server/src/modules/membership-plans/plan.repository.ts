import type { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma";

type PlanDb = Pick<Prisma.TransactionClient, "membershipPlan">;

export function listPlans(includeInactive = false) {
  return prisma.membershipPlan.findMany({
    where: includeInactive ? {} : { isActive: true },
    orderBy: { createdAt: "desc" },
  });
}

export function findPlanById(id: string, db: PlanDb = prisma) {
  return db.membershipPlan.findUnique({ where: { id } });
}

export function createPlan(data: Prisma.MembershipPlanCreateInput, db: PlanDb = prisma) {
  return db.membershipPlan.create({ data });
}

export function updatePlan(id: string, data: Prisma.MembershipPlanUpdateInput, db: PlanDb = prisma) {
  return db.membershipPlan.update({ where: { id }, data });
}
