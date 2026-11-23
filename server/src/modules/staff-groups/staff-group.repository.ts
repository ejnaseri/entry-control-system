import type { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma";

type StaffGroupDb = Pick<Prisma.TransactionClient, "staffGroup">;

export const staffGroupInclude = {
  shifts: { orderBy: { createdAt: "asc" } },
} satisfies Prisma.StaffGroupInclude;

export function listStaffGroups() {
  return prisma.staffGroup.findMany({
    include: staffGroupInclude,
    orderBy: { createdAt: "desc" },
  });
}

export function findStaffGroupWithShifts(id: string, db: StaffGroupDb = prisma) {
  return db.staffGroup.findUnique({
    where: { id },
    include: staffGroupInclude,
  });
}

export function findStaffGroupShiftsByIds(ids: string[]) {
  if (ids.length === 0) return Promise.resolve([]);
  return prisma.staffGroupShift.findMany({
    where: { id: { in: ids } },
    include: { staffGroup: { select: { id: true, name: true } } },
    orderBy: { createdAt: "asc" },
  });
}

export function deleteStaffGroupRecord(id: string, db: StaffGroupDb = prisma) {
  return db.staffGroup.delete({ where: { id } });
}
