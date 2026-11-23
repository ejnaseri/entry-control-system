import type { Member, MemberStatus, MemberType, MembershipStatus, Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma";

export type MemberListArgs = {
  status?: MemberStatus | undefined;
  memberType?: MemberType | undefined;
  search?: string | undefined;
  skip: number;
  take: number;
};

export const memberDetailsInclude = {
  accessPolicy: { include: { rules: true } },
  overtimePolicy: true,
  shifts: {
    include: {
      template: {
        select: {
          id: true,
          shiftName: true,
          shiftStart: true,
          shiftEnd: true,
          weekdays: true,
          graceMinutes: true,
          earlyAccessMinutes: true,
          salaryType: true,
          salaryAmount: true,
          staffGroupId: true,
        },
      },
    },
  },
  customerProfile: true,
  staffProfile: true,
  staffGroup: { include: { shifts: { orderBy: { createdAt: "asc" } } } },
  deviceUser: true,
} satisfies Prisma.MemberInclude;

export const memberFullInclude = {
  accessPolicy: { include: { rules: true } },
  overtimePolicy: true,
  shifts: {
    include: {
      template: {
        select: {
          id: true,
          shiftName: true,
          shiftStart: true,
          shiftEnd: true,
          weekdays: true,
          graceMinutes: true,
          earlyAccessMinutes: true,
          salaryType: true,
          salaryAmount: true,
          staffGroupId: true,
        },
      },
    },
  },
  staffProfile: true,
  staffGroup: { include: { shifts: true } },
  memberships: {
    include: {
      plan: { select: { id: true, name: true, durationDays: true } },
    },
    orderBy: { createdAt: "desc" },
  },
  payments: { orderBy: { createdAt: "desc" } },
  attendanceLogs: { orderBy: { recordedAt: "desc" }, take: 200 },
  deviceUser: true,
  accessWarnings: { orderBy: { occurredAt: "desc" }, take: 50 },
  doorEvents: { orderBy: { requestedAt: "desc" }, take: 50 },
} satisfies Prisma.MemberInclude;

export async function findMembers(args: MemberListArgs) {
  const where = buildWhere(args);

  const [items, total] = await prisma.$transaction([
    prisma.member.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: args.skip,
      take: args.take,
      include: {
        staffGroup: {
          select: {
            id: true,
            name: true,
          },
        },
        memberships: {
          select: {
            id: true,
            endDate: true,
            status: true,
          },
          orderBy: { endDate: "desc" },
          take: 5,
        },
      },
    }),
    prisma.member.count({ where }),
  ]);

  return { items, total };
}

export async function findMemberByContact(email?: string, phone?: string) {
  const filters: Prisma.MemberWhereInput[] = [];
  if (email) filters.push({ email });
  if (phone) filters.push({ phone });

  if (filters.length === 0) {
    return null;
  }

  return prisma.member.findFirst({
    where: { OR: filters },
  });
}

export function findMemberByCode(code: string) {
  return prisma.member.findUnique({ where: { code } });
}

export function createMemberRecord(data: Prisma.MemberCreateInput): Promise<Member> {
  return prisma.member.create({ data });
}

export function findMemberById(id: string) {
  return prisma.member.findUnique({ where: { id } });
}

export function findMemberWithDetails(id: string) {
  return prisma.member.findUnique({
    where: { id },
    include: memberDetailsInclude,
  });
}

export function findMemberFull(id: string) {
  return prisma.member.findUnique({
    where: { id },
    include: memberFullInclude,
  });
}

export function findMembershipPlan(planId: string) {
  return prisma.membershipPlan.findUnique({ where: { id: planId, isActive: true } });
}

export function updateMemberRecord(id: string, data: Prisma.MemberUpdateInput): Promise<Member> {
  return prisma.member.update({ where: { id }, data });
}

export function deleteMemberRecord(id: string) {
  return prisma.member.delete({ where: { id } });
}

export function findMembershipsByMember(memberId: string) {
  return prisma.membership.findMany({
    where: { memberId },
    include: {
      plan: {
        select: {
          id: true,
          name: true,
          durationDays: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });
}

export function findPaymentsByMember(memberId: string) {
  return prisma.payment.findMany({
    where: { memberId },
    include: {
      membership: {
        select: {
          id: true,
          planId: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });
}

export function findAttendanceLogsByMember(memberId: string) {
  return prisma.attendanceLog.findMany({
    where: { memberId },
    orderBy: { recordedAt: "desc" },
    take: 50,
  });
}

function buildWhere(args: MemberListArgs): Prisma.MemberWhereInput {
  const filters: Prisma.MemberWhereInput[] = [];

  const statusWhere = buildStatusWhere(args.status);
  if (statusWhere) {
    filters.push(statusWhere);
  }

  if (args.memberType) {
    filters.push({ memberType: args.memberType });
  }

  if (args.search) {
    const contains = args.search.trim();
    filters.push({
      OR: [
        { firstName: { contains, mode: "insensitive" } },
        { lastName: { contains, mode: "insensitive" } },
        { phone: { contains, mode: "insensitive" } },
        { code: { contains, mode: "insensitive" } },
      ],
    });
  }

  if (filters.length === 0) {
    return {};
  }

  if (filters.length === 1) {
    return filters[0]!;
  }

  return { AND: filters };
}

function buildStatusWhere(status?: MemberStatus): Prisma.MemberWhereInput | undefined {
  if (!status) {
    return undefined;
  }

  const now = new Date();
  const activeMembershipStatuses: MembershipStatus[] = [ "ACTIVE", "PENDING" ];

  if (status === "ACTIVE") {
    return {
      OR: [
        {
          status: "ACTIVE",
          memberType: "STAFF",
        },
        {
          status: "ACTIVE",
          memberType: "CUSTOMER",
          OR: [
            { memberships: { none: {} } },
            {
              memberships: {
                some: {
                  status: { in: activeMembershipStatuses },
                  endDate: { gte: now },
                },
              },
            },
          ],
        },
      ],
    };
  }

  if (status === "BLOCKED") {
    return {
      OR: [
        { status: { in: ["BLOCKED", "DEBTOR", "EXPIRED"] } },
        {
          status: "ACTIVE",
          memberType: "CUSTOMER",
          memberships: { some: {} },
          NOT: {
            memberships: {
              some: {
                status: { in: activeMembershipStatuses },
                endDate: { gte: now },
              },
            },
          },
        },
      ],
    };
  }

  return { status };
}
