import { MemberStatus, MemberType, MembershipStatus, Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { getReportExportLabels } from "../reports/shared/report-export.i18n";
import { buildCsv, buildFilenameStamp, buildXlsxBuffer, formatDateKey } from "../reports/shared/report-export.utils";
import type {
  CustomerActivityExportQuery,
  CustomerActivityInactiveMembersQuery,
  CustomerActivityLowEngagementQuery,
  CustomerActivitySummaryQuery,
  CustomerActivityVisitedTodayQuery,
} from "./reports-customer-activity.schemas";

type PageInfo = {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
};

type CustomerActivityFilters = {
  search: string | null;
  inactiveDays: number;
  engagementWindowDays: number;
  lowEngagementMaxVisits: number;
};

type CustomerActivitySummaryResponse = {
  generatedAt: string;
  filters: CustomerActivityFilters;
  kpis: {
    activeCustomers: number;
    visitedToday: number;
    inactive7Days: number;
    inactive30Days: number;
    lowEngagement: number;
  };
  tabs: {
    visitedToday: number;
    inactiveMembers: number;
    lowEngagement: number;
  };
};

type CustomerActivityMemberBase = {
  memberId: string;
  memberCode: string;
  memberName: string;
  memberPhone: string | null;
  planName: string | null;
  membershipEndDate: string;
  daysUntilExpiry: number;
};

export type CustomerActivityVisitedTodayItem = CustomerActivityMemberBase & {
  firstVisitAt: string;
  lastVisitAt: string;
  visitEvents: number;
};

export type CustomerActivityInactiveMemberItem = CustomerActivityMemberBase & {
  lastVisitAt: string | null;
  daysSinceLastVisit: number | null;
  state: "NEVER" | "INACTIVE";
};

export type CustomerActivityLowEngagementItem = CustomerActivityMemberBase & {
  lastVisitAt: string | null;
  daysSinceLastVisit: number | null;
  visitDays: number;
};

export type CustomerActivityVisitedTodayResponse = {
  items: CustomerActivityVisitedTodayItem[];
  pageInfo: PageInfo;
};

export type CustomerActivityInactiveMembersResponse = {
  items: CustomerActivityInactiveMemberItem[];
  pageInfo: PageInfo;
};

export type CustomerActivityLowEngagementResponse = {
  items: CustomerActivityLowEngagementItem[];
  pageInfo: PageInfo;
};

type CustomerActivityDataset = {
  generatedAt: string;
  filters: CustomerActivityFilters;
  summary: CustomerActivitySummaryResponse;
  visitedToday: CustomerActivityVisitedTodayItem[];
  inactiveMembers: CustomerActivityInactiveMemberItem[];
  lowEngagement: CustomerActivityLowEngagementItem[];
};

type ActiveCustomerMembershipRow = Prisma.MembershipGetPayload<{
  include: {
    member: { select: { id: true; code: true; firstName: true; lastName: true; phone: true } };
    plan: { select: { name: true } };
  };
}>;

const ACTIVE_MEMBERSHIP_STATUSES = [MembershipStatus.ACTIVE, MembershipStatus.PENDING];

export async function getCustomerActivitySummary(
  query: CustomerActivitySummaryQuery
): Promise<CustomerActivitySummaryResponse> {
  const dataset = await buildCustomerActivityDataset(query);
  return dataset.summary;
}

export async function getCustomerActivityVisitedToday(
  query: CustomerActivityVisitedTodayQuery
): Promise<CustomerActivityVisitedTodayResponse> {
  const dataset = await buildCustomerActivityDataset(query);
  return paginate(dataset.visitedToday, query.page, query.pageSize);
}

export async function getCustomerActivityInactiveMembers(
  query: CustomerActivityInactiveMembersQuery
): Promise<CustomerActivityInactiveMembersResponse> {
  const dataset = await buildCustomerActivityDataset(query);
  return paginate(dataset.inactiveMembers, query.page, query.pageSize);
}

export async function getCustomerActivityLowEngagement(
  query: CustomerActivityLowEngagementQuery
): Promise<CustomerActivityLowEngagementResponse> {
  const dataset = await buildCustomerActivityDataset(query);
  return paginate(dataset.lowEngagement, query.page, query.pageSize);
}

export async function getCustomerActivityCsv(
  query: CustomerActivityExportQuery
): Promise<{ csv: string; filename: string; rowCount: number }> {
  const dataset = await buildCustomerActivityDataset(query);
  const labels = getReportExportLabels(query.lang);
  const t = labels.t;

  if (query.tab === "visitedToday") {
    const rows = dataset.visitedToday.map((item) => [
      formatMemberExportLabel(item),
      item.memberPhone ?? "",
      item.planName ?? "",
      item.membershipEndDate.slice(0, 10),
      item.firstVisitAt,
      item.lastVisitAt,
      item.visitEvents,
    ]);
    return {
      csv: buildCsv(
        [t("member"), t("phone"), t("plan"), t("membershipEnd"), t("firstVisit"), t("lastVisit"), t("authorizedEvents")],
        rows
      ),
      filename: `customer-activity-visited-today-${buildFilenameStamp(new Date())}.csv`,
      rowCount: rows.length,
    };
  }

  if (query.tab === "inactiveMembers") {
    const rows = dataset.inactiveMembers.map((item) => [
      formatMemberExportLabel(item),
      item.memberPhone ?? "",
      item.planName ?? "",
      item.membershipEndDate.slice(0, 10),
      item.lastVisitAt ? item.lastVisitAt.slice(0, 19) : "",
      item.daysSinceLastVisit ?? "",
      labels.customerActivityState(item.state),
    ]);
    return {
      csv: buildCsv(
        [t("member"), t("phone"), t("plan"), t("membershipEnd"), t("lastVisit"), t("daysSinceLastVisit"), t("state")],
        rows
      ),
      filename: `customer-activity-inactive-members-${buildFilenameStamp(new Date())}.csv`,
      rowCount: rows.length,
    };
  }

  const rows = dataset.lowEngagement.map((item) => [
    formatMemberExportLabel(item),
    item.memberPhone ?? "",
    item.planName ?? "",
    item.membershipEndDate.slice(0, 10),
    item.visitDays,
    item.lastVisitAt ? item.lastVisitAt.slice(0, 19) : "",
    item.daysSinceLastVisit ?? "",
  ]);
  return {
    csv: buildCsv(
      [t("member"), t("phone"), t("plan"), t("membershipEnd"), t("visitDays"), t("lastVisit"), t("daysSinceLastVisit")],
      rows
    ),
    filename: `customer-activity-low-engagement-${buildFilenameStamp(new Date())}.csv`,
    rowCount: rows.length,
  };
}

export async function getCustomerActivityXlsx(
  query: CustomerActivityExportQuery
): Promise<{ buffer: Buffer; filename: string; contentType: string; rowCount: number }> {
  const dataset = await buildCustomerActivityDataset(query);
  const labels = getReportExportLabels(query.lang);
  const t = labels.t;
  const summaryRows: Array<Array<string | number>> = [
    [t("metric"), t("value")],
    [t("activeCustomers"), dataset.summary.kpis.activeCustomers],
    [t("visitedToday"), dataset.summary.kpis.visitedToday],
    [t("inactive7Days"), dataset.summary.kpis.inactive7Days],
    [t("inactive30Days"), dataset.summary.kpis.inactive30Days],
    [t("lowEngagement"), dataset.summary.kpis.lowEngagement],
    [t("inactiveThreshold"), dataset.filters.inactiveDays],
    [t("engagementWindow"), dataset.filters.engagementWindowDays],
    [t("lowEngagementMaxVisits"), dataset.filters.lowEngagementMaxVisits],
    [t("search"), dataset.filters.search ?? ""],
  ];

  const tableRows =
    query.tab === "visitedToday"
      ? [
          [t("member"), t("phone"), t("plan"), t("membershipEnd"), t("firstVisit"), t("lastVisit"), t("authorizedEvents")],
          ...dataset.visitedToday.map((item) => [
            formatMemberExportLabel(item),
            item.memberPhone ?? "",
            item.planName ?? "",
            item.membershipEndDate.slice(0, 10),
            item.firstVisitAt,
            item.lastVisitAt,
            item.visitEvents,
          ]),
        ]
      : query.tab === "inactiveMembers"
        ? [
            [t("member"), t("phone"), t("plan"), t("membershipEnd"), t("lastVisit"), t("daysSinceLastVisit"), t("state")],
            ...dataset.inactiveMembers.map((item) => [
              formatMemberExportLabel(item),
              item.memberPhone ?? "",
              item.planName ?? "",
              item.membershipEndDate.slice(0, 10),
              item.lastVisitAt ? item.lastVisitAt.slice(0, 19) : "",
              item.daysSinceLastVisit ?? "",
              labels.customerActivityState(item.state),
            ]),
          ]
        : [
            [t("member"), t("phone"), t("plan"), t("membershipEnd"), t("visitDays"), t("lastVisit"), t("daysSinceLastVisit")],
            ...dataset.lowEngagement.map((item) => [
              formatMemberExportLabel(item),
              item.memberPhone ?? "",
              item.planName ?? "",
              item.membershipEndDate.slice(0, 10),
              item.visitDays,
              item.lastVisitAt ? item.lastVisitAt.slice(0, 19) : "",
              item.daysSinceLastVisit ?? "",
            ]),
          ];

  const buffer = buildXlsxBuffer([
    { name: t("summary"), rows: summaryRows },
    {
      name:
        query.tab === "visitedToday"
          ? t("visitedToday")
          : query.tab === "inactiveMembers"
            ? t("inactiveMembers")
            : t("lowEngagement"),
      rows: tableRows,
    },
  ]);

  return {
    buffer,
    filename: `customer-activity-${query.tab}-${buildFilenameStamp(new Date())}.xlsx`,
    contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    rowCount: tableRows.length - 1,
  };
}

async function buildCustomerActivityDataset(
  query:
    | CustomerActivitySummaryQuery
    | CustomerActivityVisitedTodayQuery
    | CustomerActivityInactiveMembersQuery
    | CustomerActivityLowEngagementQuery
    | CustomerActivityExportQuery
): Promise<CustomerActivityDataset> {
  const now = new Date();
  const todayStart = startOfDay(now);
  const tomorrowStart = addDays(todayStart, 1);
  const todayKey = formatDateKey(todayStart);
  const search = query.search?.trim() || null;
  const currentMemberships = await loadCurrentCustomerMemberships(search, now);

  if (!currentMemberships.length) {
    return {
      generatedAt: now.toISOString(),
      filters: {
        search,
        inactiveDays: query.inactiveDays,
        engagementWindowDays: query.engagementWindowDays,
        lowEngagementMaxVisits: query.lowEngagementMaxVisits,
      },
      summary: {
        generatedAt: now.toISOString(),
        filters: {
          search,
          inactiveDays: query.inactiveDays,
          engagementWindowDays: query.engagementWindowDays,
          lowEngagementMaxVisits: query.lowEngagementMaxVisits,
        },
        kpis: {
          activeCustomers: 0,
          visitedToday: 0,
          inactive7Days: 0,
          inactive30Days: 0,
          lowEngagement: 0,
        },
        tabs: {
          visitedToday: 0,
          inactiveMembers: 0,
          lowEngagement: 0,
        },
      },
      visitedToday: [],
      inactiveMembers: [],
      lowEngagement: [],
    };
  }

  const memberIds = currentMemberships.map((item) => item.memberId);
  const engagementWindowStart = addDays(todayStart, -(query.engagementWindowDays - 1));

  const [lastAttendanceRows, recentAuthorizedLogs] = await Promise.all([
    prisma.attendanceLog.groupBy({
      by: ["memberId"],
      where: {
        memberId: { in: memberIds },
        isAuthorized: true,
      },
      _max: { recordedAt: true },
    }),
    prisma.attendanceLog.findMany({
      where: {
        memberId: { in: memberIds },
        isAuthorized: true,
        recordedAt: { gte: engagementWindowStart, lt: tomorrowStart },
      },
      select: {
        memberId: true,
        recordedAt: true,
      },
      orderBy: { recordedAt: "asc" },
    }),
  ]);

  const lastAttendanceByMember = new Map<string, Date>();
  lastAttendanceRows.forEach((row) => {
    if (row.memberId && row._max.recordedAt) {
      lastAttendanceByMember.set(row.memberId, row._max.recordedAt);
    }
  });

  const recentActivityByMember = new Map<
    string,
    {
      visitDays: Set<string>;
      todayEvents: Date[];
    }
  >();

  recentAuthorizedLogs.forEach((row) => {
    if (!row.memberId) return;
    const existing = recentActivityByMember.get(row.memberId) ?? { visitDays: new Set<string>(), todayEvents: [] };
    const dayKey = formatDateKey(row.recordedAt);
    existing.visitDays.add(dayKey);
    if (dayKey === todayKey) {
      existing.todayEvents.push(row.recordedAt);
    }
    recentActivityByMember.set(row.memberId, existing);
  });

  const visitedToday: CustomerActivityVisitedTodayItem[] = [];
  const inactiveMembers: CustomerActivityInactiveMemberItem[] = [];
  const lowEngagement: CustomerActivityLowEngagementItem[] = [];

  currentMemberships.forEach((item) => {
    const lastVisitAt = lastAttendanceByMember.get(item.memberId) ?? null;
    const recentActivity = recentActivityByMember.get(item.memberId);
    const visitDays = recentActivity?.visitDays.size ?? 0;

    if (recentActivity?.todayEvents.length) {
      const firstVisitAt = recentActivity.todayEvents[0]!;
      const lastTodayEvent = recentActivity.todayEvents[recentActivity.todayEvents.length - 1]!;
      visitedToday.push({
        ...item,
        firstVisitAt: firstVisitAt.toISOString(),
        lastVisitAt: lastTodayEvent.toISOString(),
        visitEvents: recentActivity.todayEvents.length,
      });
    }

    if (isInactive(lastVisitAt, todayStart, query.inactiveDays)) {
      inactiveMembers.push({
        ...item,
        lastVisitAt: lastVisitAt ? lastVisitAt.toISOString() : null,
        daysSinceLastVisit: lastVisitAt ? diffDays(todayStart, startOfDay(lastVisitAt)) : null,
        state: lastVisitAt ? "INACTIVE" : "NEVER",
      });
    }

    if (visitDays <= query.lowEngagementMaxVisits) {
      lowEngagement.push({
        ...item,
        lastVisitAt: lastVisitAt ? lastVisitAt.toISOString() : null,
        daysSinceLastVisit: lastVisitAt ? diffDays(todayStart, startOfDay(lastVisitAt)) : null,
        visitDays,
      });
    }
  });

  visitedToday.sort((left, right) => compareDateDesc(left.lastVisitAt, right.lastVisitAt) || compareName(left.memberName, right.memberName));
  inactiveMembers.sort((left, right) => compareNullableNumberDesc(left.daysSinceLastVisit, right.daysSinceLastVisit) || compareName(left.memberName, right.memberName));
  lowEngagement.sort(
    (left, right) =>
      left.visitDays - right.visitDays ||
      compareNullableNumberDesc(left.daysSinceLastVisit, right.daysSinceLastVisit) ||
      compareName(left.memberName, right.memberName)
  );

  const filters: CustomerActivityFilters = {
    search,
    inactiveDays: query.inactiveDays,
    engagementWindowDays: query.engagementWindowDays,
    lowEngagementMaxVisits: query.lowEngagementMaxVisits,
  };

  const summary: CustomerActivitySummaryResponse = {
    generatedAt: now.toISOString(),
    filters,
    kpis: {
      activeCustomers: currentMemberships.length,
      visitedToday: visitedToday.length,
      inactive7Days: currentMemberships.filter((item) =>
        isInactive(lastAttendanceByMember.get(item.memberId) ?? null, todayStart, 7)
      ).length,
      inactive30Days: currentMemberships.filter((item) =>
        isInactive(lastAttendanceByMember.get(item.memberId) ?? null, todayStart, 30)
      ).length,
      lowEngagement: lowEngagement.length,
    },
    tabs: {
      visitedToday: visitedToday.length,
      inactiveMembers: inactiveMembers.length,
      lowEngagement: lowEngagement.length,
    },
  };

  return {
    generatedAt: now.toISOString(),
    filters,
    summary,
    visitedToday,
    inactiveMembers,
    lowEngagement,
  };
}

async function loadCurrentCustomerMemberships(search: string | null, now: Date): Promise<CustomerActivityMemberBase[]> {
  const rows = await prisma.membership.findMany({
    where: {
      status: { in: ACTIVE_MEMBERSHIP_STATUSES },
      endDate: { gte: now },
      member: {
        memberType: MemberType.CUSTOMER,
        isStaff: false,
        archivedAt: null,
        status: MemberStatus.ACTIVE,
        ...(search
          ? {
              OR: [
                { code: { contains: search, mode: "insensitive" } },
                { firstName: { contains: search, mode: "insensitive" } },
                { lastName: { contains: search, mode: "insensitive" } },
                { phone: { contains: search, mode: "insensitive" } },
              ],
            }
          : {}),
      },
    },
    include: {
      member: {
        select: {
          id: true,
          code: true,
          firstName: true,
          lastName: true,
          phone: true,
        },
      },
      plan: {
        select: {
          name: true,
        },
      },
    },
    orderBy: [{ memberId: "asc" }, { endDate: "desc" }, { createdAt: "desc" }],
  });

  const uniqueRows = new Map<string, ActiveCustomerMembershipRow>();
  rows.forEach((row) => {
    if (!uniqueRows.has(row.memberId)) {
      uniqueRows.set(row.memberId, row);
    }
  });

  return [...uniqueRows.values()].map((row) => ({
    memberId: row.member.id,
    memberCode: row.member.code,
    memberName: formatMemberName(row.member.firstName, row.member.lastName),
    memberPhone: row.member.phone ?? null,
    planName: row.plan?.name ?? null,
    membershipEndDate: row.endDate.toISOString(),
    daysUntilExpiry: Math.max(0, diffDays(startOfDay(row.endDate), startOfDay(now))),
  }));
}

function paginate<T>(items: T[], page: number, pageSize: number) {
  const totalItems = items.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const start = (safePage - 1) * pageSize;
  return {
    items: items.slice(start, start + pageSize),
    pageInfo: {
      page: safePage,
      pageSize,
      totalItems,
      totalPages,
    },
  };
}

function isInactive(lastVisitAt: Date | null, todayStart: Date, days: number) {
  if (!lastVisitAt) return true;
  const cutoff = addDays(todayStart, -(days - 1));
  return startOfDay(lastVisitAt) < cutoff;
}

function formatMemberName(firstName: string, lastName?: string | null) {
  return `${firstName} ${lastName ?? ""}`.trim();
}

function formatMemberExportLabel(item: CustomerActivityMemberBase) {
  return `${item.memberName} (#${item.memberCode})`;
}

function compareName(left: string, right: string) {
  return left.localeCompare(right, undefined, { sensitivity: "base" });
}

function compareDateDesc(left: string, right: string) {
  return new Date(right).getTime() - new Date(left).getTime();
}

function compareNullableNumberDesc(left: number | null, right: number | null) {
  const leftValue = left ?? Number.POSITIVE_INFINITY;
  const rightValue = right ?? Number.POSITIVE_INFINITY;
  return rightValue - leftValue;
}

function startOfDay(date: Date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function diffDays(later: Date, earlier: Date) {
  return Math.max(0, Math.floor((later.getTime() - earlier.getTime()) / 86_400_000));
}
