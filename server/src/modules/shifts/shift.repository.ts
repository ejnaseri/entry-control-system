import { prisma } from "../../lib/prisma";

export function listShiftTemplates() {
  return prisma.staffGroupShift.findMany({
    include: {
      staffGroup: {
        select: { id: true, name: true, accessLevel: true },
      },
    },
    orderBy: [{ staffGroup: { name: "asc" } }, { shiftName: "asc" }],
  });
}
