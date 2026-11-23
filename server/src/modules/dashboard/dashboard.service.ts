import { AttendanceType, MemberType, MembershipStatus, PaymentStatus } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { getLocalDateBoundaries } from "../../utils/dateBoundaries";

export type DashboardRange = "24h" | "7d";

export type DashboardSummary = {
  activeMembers: { value: number; deltaPct: number | null };
  insideNow: { value: number; deltaPct: number | null };
  expiringSoon: { value: number; deltaPct: number | null };
  debtors: { value: number; deltaPct: number | null };
  revenueToday: { value: number; deltaPct: number | null; currency: string };
  todaysEntries: { value: number; deltaPct: number | null };
  deniedReasonsToday: Array<{ reason: string; count: number; pct: number }>;
  peakHoursToday: Array<{ label: string; total: number }>;
  entriesSeries: {
    range: DashboardRange;
    points: Array<{ label: string; authorized: number; denied: number; total: number }>;
  };
};

export type ReportsDashboardSummary = {
  activeMembers: number;
  totalPaidThisMonth: number;
  expiringThisWeek: number;
  staffPresentToday: number;
  generatedAt: string;
};

export type DashboardDetailType = "activeMembers" | "insideNow" | "expiringSoon" | "debtors" | "revenueToday" | "todaysEntries";

export type DashboardActiveMemberDetail = {
  memberId: string;
  code: string;
  fullName: string;
  phone: string | null;
  planName: string | null;
  endDate: string;
};

export type DashboardExpiringMemberDetail = {
  memberId: string;
  code: string;
  fullName: string;
  phone: string | null;
  planName: string | null;
  endDate: string;
  daysLeft: number;
};

export type DashboardDebtorDetail = {
  memberId: string;
  code: string;
  fullName: string;
  phone: string | null;
  debtAmount: number;
};

export type DashboardEntryDetail = {
  id: string;
  recordedAt: string;
  entryType: string;
  memberId: string | null;
  memberCode: string | null;
  memberName: string | null;
  externalUserId: number | null;
};

export type DashboardRevenueDetail = {
  id: string;
  paidAt: string | null;
  createdAt: string;
  memberId: string;
  memberCode: string;
  memberName: string;
  amount: number;
  currency: string;
  method: string;
  reference: string | null;
};

export type DashboardDetails =
  | { type: "activeMembers"; total: number; items: DashboardActiveMemberDetail[] }
  | { type: "insideNow"; total: number; items: DashboardEntryDetail[] }
  | { type: "expiringSoon"; total: number; items: DashboardExpiringMemberDetail[] }
  | { type: "debtors"; total: number; items: DashboardDebtorDetail[] }
  | { type: "revenueToday"; total: number; items: DashboardRevenueDetail[] }
  | { type: "todaysEntries"; total: number; items: DashboardEntryDetail[] };

const EXPIRING_SOON_DAYS = Number(process.env["DASHBOARD_EXPIRING_SOON_DAYS"] ?? 7);

export async function getReportsDashboardSummary(now = new Date()): Promise<ReportsDashboardSummary> {
  const { todayStart, tomorrowStart, weekEndExclusive, monthStart, nextMonthStart } = getLocalDateBoundaries(now);

  const customerFilter = {
    memberType: MemberType.CUSTOMER,
    isStaff: false,
    archivedAt: null,
  };

  const [activeMembers, monthPayments, expiringThisWeek, presentRows] = await Promise.all([
    prisma.member.count({
      where: {
        ...customerFilter,
        memberships: {
          some: {
            status: MembershipStatus.ACTIVE,
            endDate: { gte: now },
          },
        },
      },
    }),
    prisma.payment.aggregate({
      where: {
        status: PaymentStatus.PAID,
        paidAt: { gte: monthStart, lt: nextMonthStart },
      },
      _sum: { amount: true },
    }),
    prisma.member.count({
      where: {
        ...customerFilter,
        memberships: {
          some: {
            status: MembershipStatus.ACTIVE,
            endDate: { gte: todayStart, lt: weekEndExclusive },
          },
        },
      },
    }),
    prisma.$queryRaw<Array<{ count: number }>>`
      SELECT COUNT(DISTINCT a."memberId")::int AS "count"
      FROM "AttendanceLog" a
      INNER JOIN "Member" m ON m."id" = a."memberId"
      WHERE a."memberId" IS NOT NULL
        AND a."isAuthorized" = true
        AND a."entryType" = 'IN'
        AND a."recordedAt" >= ${todayStart}
        AND a."recordedAt" < ${tomorrowStart}
        AND (m."memberType" = 'STAFF' OR m."isStaff" = true)
        AND m."archivedAt" IS NULL
    `,
  ]);

  return {
    activeMembers,
    totalPaidThisMonth: asAmount(monthPayments._sum.amount),
    expiringThisWeek,
    staffPresentToday: presentRows[0]?.count ?? 0,
    generatedAt: now.toISOString(),
  };
}

export async function getDashboardSummary(range: DashboardRange): Promise<DashboardSummary> {
  const now = new Date();
  const startOfToday = startOfDay(now);
  const startOfTomorrow = addDays(startOfToday, 1);
  const startOfYesterday = addDays(startOfToday, -1);
  const expiringSoonEnd = addDays(now, EXPIRING_SOON_DAYS);
  const expiringSoonPrevStart = addDays(now, -EXPIRING_SOON_DAYS);

  const memberFilter = { memberType: MemberType.CUSTOMER, isStaff: false };

  const [
    activeMembers,
    expiringSoon,
    expiringSoonPrev,
    debtors,
    todaysEntries,
    yesterdayEntries,
    todayPayments,
    yesterdayPayments,
    todayAuthorizedLogs,
    deniedReasonRows,
  ] = await Promise.all([
    prisma.member.count({
      where: {
        ...memberFilter,
        memberships: {
          some: {
            status: MembershipStatus.ACTIVE,
            endDate: { gte: now },
          },
        },
      },
    }),
    prisma.member.count({
      where: {
        ...memberFilter,
        memberships: {
          some: {
            status: MembershipStatus.ACTIVE,
            endDate: { gt: now, lte: expiringSoonEnd },
          },
        },
      },
    }),
    prisma.member.count({
      where: {
        ...memberFilter,
        memberships: {
          some: {
            status: MembershipStatus.ACTIVE,
            endDate: { gt: expiringSoonPrevStart, lte: now },
          },
        },
      },
    }),
    prisma.member.count({
      where: {
        ...memberFilter,
        customerProfile: { totalDebtAmount: { gt: 0 } },
      },
    }),
    prisma.attendanceLog.count({
      where: {
        recordedAt: { gte: startOfToday, lt: startOfTomorrow },
        isAuthorized: true,
      },
    }),
    prisma.attendanceLog.count({
      where: {
        recordedAt: { gte: startOfYesterday, lt: startOfToday },
        isAuthorized: true,
      },
    }),
    prisma.payment.aggregate({
      where: {
        status: PaymentStatus.PAID,
        paidAt: { gte: startOfToday, lt: startOfTomorrow },
      },
      _sum: { amount: true },
    }),
    prisma.payment.aggregate({
      where: {
        status: PaymentStatus.PAID,
        paidAt: { gte: startOfYesterday, lt: startOfToday },
      },
      _sum: { amount: true },
    }),
    prisma.attendanceLog.findMany({
      where: {
        recordedAt: { gte: startOfToday, lt: startOfTomorrow },
        isAuthorized: true,
        memberId: { not: null },
      },
      orderBy: { recordedAt: "asc" },
      select: { memberId: true, entryType: true },
    }),
    prisma.attendanceLog.groupBy({
      by: ["reason"],
      where: {
        recordedAt: { gte: startOfToday, lt: startOfTomorrow },
        isAuthorized: false,
      },
      _count: { _all: true },
    }),
  ]);

  const [entriesSeries, peakHoursToday] = await Promise.all([
    range === "24h" ? buildHourlySeries(now) : buildDailySeries(startOfToday),
    buildTodayPeakHours(startOfToday, now),
  ]);
  const latestEntryByMember = new Map<string, AttendanceType>();
  for (const log of todayAuthorizedLogs) {
    if (log.memberId) {
      latestEntryByMember.set(log.memberId, log.entryType);
    }
  }
  const insideNow = Array.from(latestEntryByMember.values()).filter((entryType) => entryType === AttendanceType.IN).length;
  const revenueToday = asAmount(todayPayments._sum.amount);
  const revenueYesterday = asAmount(yesterdayPayments._sum.amount);
  const deniedTotal = deniedReasonRows.reduce((sum, row) => sum + row._count._all, 0);
  const deniedReasonsToday = deniedReasonRows
    .map((row) => ({
      reason: row.reason ?? "UNKNOWN",
      count: row._count._all,
      pct: deniedTotal > 0 ? Math.round((row._count._all / deniedTotal) * 100) : 0,
    }))
    .sort((left, right) => right.count - left.count)
    .slice(0, 4);

  return {
    activeMembers: { value: activeMembers, deltaPct: null },
    insideNow: { value: insideNow, deltaPct: null },
    expiringSoon: { value: expiringSoon, deltaPct: calcDeltaPct(expiringSoon, expiringSoonPrev) },
    debtors: { value: debtors, deltaPct: null },
    revenueToday: { value: revenueToday, deltaPct: calcDeltaPct(revenueToday, revenueYesterday), currency: "AFN" },
    todaysEntries: { value: todaysEntries, deltaPct: calcDeltaPct(todaysEntries, yesterdayEntries) },
    deniedReasonsToday,
    peakHoursToday,
    entriesSeries: {
      range,
      points: entriesSeries,
    },
  };
}

async function buildDailySeries(startOfToday: Date) {
  const start = addDays(startOfToday, -6);
  const points = await Promise.all(
    Array.from({ length: 7 }, async (_, idx) => {
      const dayStart = addDays(start, idx);
      const dayEnd = addDays(dayStart, 1);
      const [authorized, denied] = await Promise.all([
        prisma.attendanceLog.count({
          where: {
            recordedAt: { gte: dayStart, lt: dayEnd },
            isAuthorized: true,
          },
        }),
        prisma.attendanceLog.count({
          where: {
            recordedAt: { gte: dayStart, lt: dayEnd },
            isAuthorized: false,
          },
        }),
      ]);
      return {
        label: formatDayLabel(dayStart),
        authorized,
        denied,
        total: authorized + denied,
      };
    })
  );
  return points;
}

async function buildHourlySeries(now: Date) {
  const startHour = startOfHour(now);
  const start = addHours(startHour, -23);
  const points = await Promise.all(
    Array.from({ length: 24 }, async (_, idx) => {
      const hourStart = addHours(start, idx);
      const hourEnd = addHours(hourStart, 1);
      const [authorized, denied] = await Promise.all([
        prisma.attendanceLog.count({
          where: {
            recordedAt: { gte: hourStart, lt: hourEnd },
            isAuthorized: true,
          },
        }),
        prisma.attendanceLog.count({
          where: {
            recordedAt: { gte: hourStart, lt: hourEnd },
            isAuthorized: false,
          },
        }),
      ]);
      return {
        label: formatHourLabel(hourStart),
        authorized,
        denied,
        total: authorized + denied,
      };
    })
  );
  return points;
}

async function buildTodayPeakHours(startOfToday: Date, now: Date) {
  const elapsedHours = Math.floor((now.getTime() - startOfToday.getTime()) / 3600000);
  const currentHourIndex = Math.min(23, Math.max(0, elapsedHours));
  const points = await Promise.all(
    Array.from({ length: currentHourIndex + 1 }, async (_, idx) => {
      const hourStart = addHours(startOfToday, idx);
      const hourEnd = idx === currentHourIndex ? now : addHours(hourStart, 1);
      const total = await prisma.attendanceLog.count({
        where: {
          recordedAt: { gte: hourStart, lt: hourEnd },
        },
      });
      return {
        label: formatHourLabel(hourStart),
        total,
      };
    })
  );
  return points;
}

export async function getDashboardDetails(type: DashboardDetailType, limit: number): Promise<DashboardDetails> {
  const now = new Date();
  const startOfToday = startOfDay(now);
  const startOfTomorrow = addDays(startOfToday, 1);
  const expiringSoonEnd = addDays(now, EXPIRING_SOON_DAYS);

  const memberFilter = { memberType: MemberType.CUSTOMER, isStaff: false };

  if (type === "activeMembers") {
    const where = {
      status: MembershipStatus.ACTIVE,
      endDate: { gte: now },
      member: memberFilter,
    };
    const [total, memberships] = await Promise.all([
      prisma.membership.count({ where }),
      prisma.membership.findMany({
        where,
        orderBy: { endDate: "asc" },
        take: limit,
        include: {
          member: { select: { id: true, code: true, firstName: true, lastName: true, phone: true } },
          plan: { select: { name: true } },
        },
      }),
    ]);
    const items = memberships.map((membership) => ({
      memberId: membership.memberId,
      code: membership.member.code,
      fullName: formatMemberName(membership.member.firstName, membership.member.lastName),
      phone: membership.member.phone ?? null,
      planName: membership.plan?.name ?? null,
      endDate: membership.endDate.toISOString(),
    }));
    return { type, total, items };
  }

  if (type === "expiringSoon") {
    const where = {
      status: MembershipStatus.ACTIVE,
      endDate: { gt: now, lte: expiringSoonEnd },
      member: memberFilter,
    };
    const [total, memberships] = await Promise.all([
      prisma.membership.count({ where }),
      prisma.membership.findMany({
        where,
        orderBy: { endDate: "asc" },
        take: limit,
        include: {
          member: { select: { id: true, code: true, firstName: true, lastName: true, phone: true } },
          plan: { select: { name: true } },
        },
      }),
    ]);
    const items = memberships.map((membership) => {
      const daysLeft = Math.max(0, Math.ceil((membership.endDate.getTime() - now.getTime()) / 86400000));
      return {
        memberId: membership.memberId,
        code: membership.member.code,
        fullName: formatMemberName(membership.member.firstName, membership.member.lastName),
        phone: membership.member.phone ?? null,
        planName: membership.plan?.name ?? null,
        endDate: membership.endDate.toISOString(),
        daysLeft,
      };
    });
    return { type, total, items };
  }

  if (type === "debtors") {
    const where = {
      ...memberFilter,
      customerProfile: { totalDebtAmount: { gt: 0 } },
    };
    const [total, members] = await Promise.all([
      prisma.member.count({ where }),
      prisma.member.findMany({
        where,
        orderBy: { customerProfile: { totalDebtAmount: "desc" } },
        take: limit,
        include: { customerProfile: { select: { totalDebtAmount: true } } },
      }),
    ]);
    const items = members.map((member) => ({
      memberId: member.id,
      code: member.code,
      fullName: formatMemberName(member.firstName, member.lastName),
      phone: member.phone ?? null,
      debtAmount: member.customerProfile?.totalDebtAmount ?? 0,
    }));
    return { type, total, items };
  }

  if (type === "insideNow") {
    const logs = await prisma.attendanceLog.findMany({
      where: {
        recordedAt: { gte: startOfToday, lt: startOfTomorrow },
        isAuthorized: true,
        memberId: { not: null },
      },
      orderBy: { recordedAt: "asc" },
      include: {
        member: { select: { id: true, code: true, firstName: true, lastName: true } },
        deviceUser: { select: { externalId: true } },
      },
    });
    const latestByMember = new Map<string, (typeof logs)[number]>();
    for (const log of logs) {
      if (log.memberId) latestByMember.set(log.memberId, log);
    }
    const insideRows = Array.from(latestByMember.values())
      .filter((log) => log.entryType === AttendanceType.IN)
      .sort((left, right) => right.recordedAt.getTime() - left.recordedAt.getTime());
    const items = insideRows.slice(0, limit).map((log) => ({
      id: log.id,
      recordedAt: log.recordedAt.toISOString(),
      entryType: log.entryType,
      memberId: log.member?.id ?? null,
      memberCode: log.member?.code ?? null,
      memberName: log.member ? formatMemberName(log.member.firstName, log.member.lastName) : null,
      externalUserId: log.deviceUser?.externalId ?? null,
    }));
    return { type, total: insideRows.length, items };
  }

  if (type === "revenueToday") {
    const where = {
      status: PaymentStatus.PAID,
      paidAt: { gte: startOfToday, lt: startOfTomorrow },
    };
    const [total, payments] = await Promise.all([
      prisma.payment.count({ where }),
      prisma.payment.findMany({
        where,
        orderBy: { paidAt: "desc" },
        take: limit,
        include: {
          member: { select: { id: true, code: true, firstName: true, lastName: true } },
        },
      }),
    ]);
    const items = payments.map((payment) => ({
      id: payment.id,
      paidAt: payment.paidAt?.toISOString() ?? null,
      createdAt: payment.createdAt.toISOString(),
      memberId: payment.memberId,
      memberCode: payment.member.code,
      memberName: formatMemberName(payment.member.firstName, payment.member.lastName),
      amount: asAmount(payment.amount),
      currency: payment.currency,
      method: payment.method,
      reference: payment.reference ?? null,
    }));
    return { type, total, items };
  }

  const where = {
    recordedAt: { gte: startOfToday, lt: startOfTomorrow },
    isAuthorized: true,
  };
  const [total, logs] = await Promise.all([
    prisma.attendanceLog.count({ where }),
    prisma.attendanceLog.findMany({
      where,
      orderBy: { recordedAt: "desc" },
      take: limit,
      include: {
        member: { select: { id: true, code: true, firstName: true, lastName: true } },
        deviceUser: { select: { externalId: true } },
      },
    }),
  ]);
  const items = logs.map((log) => ({
    id: log.id,
    recordedAt: log.recordedAt.toISOString(),
    entryType: log.entryType,
    memberId: log.member?.id ?? null,
    memberCode: log.member?.code ?? null,
    memberName: log.member ? formatMemberName(log.member.firstName, log.member.lastName) : null,
    externalUserId: log.deviceUser?.externalId ?? null,
  }));
  return { type: "todaysEntries", total, items };
}

function calcDeltaPct(current: number, previous: number): number | null {
  if (!Number.isFinite(previous) || previous <= 0) {
    return null;
  }
  const delta = ((current - previous) / previous) * 100;
  return Math.round(delta * 10) / 10;
}

function formatMemberName(firstName: string, lastName?: string | null) {
  return [firstName, lastName].filter(Boolean).join(" ");
}

function asAmount(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function startOfHour(date: Date): Date {
  const d = new Date(date);
  d.setMinutes(0, 0, 0);
  return d;
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function addHours(date: Date, hours: number): Date {
  const d = new Date(date);
  d.setHours(d.getHours() + hours);
  return d;
}

function formatDayLabel(date: Date) {
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatHourLabel(date: Date) {
  return date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false });
}
