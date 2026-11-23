import { AdminRole, AttendanceSource, AttendanceType, AuditActor, MemberType, Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { HttpError } from "../../middlewares/error-handler";
import { ATTENDANCE_AUDIT_SCOPE_MARKER } from "../audit-logs/audit-log-edition-policy";
import type {
  AttendanceDailyQuery,
  AttendanceEntryLogsExportQuery,
  AttendanceJustificationInput,
  AttendanceListQuery,
  AttendanceManualCreateInput,
} from "./attendance.schemas";
import { getReportExportLabels } from "../reports/shared/report-export.i18n";
import { buildCsv, buildXlsxBuffer } from "../reports/shared/report-export.utils";
import { ATTENDANCE_EXPORT_BRAND, ATTENDANCE_EXPORT_FILENAME_PREFIX } from "../reports-attendance/attendance-export.brand";
import {
  buildStrictStaffMemberWhere,
  isStrictStaffAttendanceScope,
  type AttendanceDataScope,
} from "./attendance-edition-scope";

const attendanceMemberSafeSelect = Prisma.validator<Prisma.MemberSelect>()({
  id: true,
  code: true,
  firstName: true,
  lastName: true,
  phone: true,
  memberType: true,
  isStaff: true,
  status: true,
  roleType: true,
  customTitle: true,
  staffProfile: { select: { position: true, department: true } },
});

const attendanceMemberFullSelect = Prisma.validator<Prisma.MemberSelect>()({
  ...attendanceMemberSafeSelect,
  memberships: { select: { id: true, status: true }, orderBy: { createdAt: "desc" }, take: 1 },
});

const attendanceLogBaseSelect = Prisma.validator<Prisma.AttendanceLogSelect>()({
  id: true,
  createdAt: true,
  recordedAt: true,
  memberId: true,
  entryType: true,
  source: true,
  isAuthorized: true,
  reason: true,
  deviceUser: { select: { deviceId: true } },
});

const attendanceSafeSelect = Prisma.validator<Prisma.AttendanceLogSelect>()({
  ...attendanceLogBaseSelect,
  member: { select: attendanceMemberSafeSelect },
});

const attendanceFullSelect = Prisma.validator<Prisma.AttendanceLogSelect>()({
  ...attendanceLogBaseSelect,
  member: { select: attendanceMemberFullSelect },
});

type SafeAttendanceRow = Prisma.AttendanceLogGetPayload<{ select: typeof attendanceSafeSelect }>;
type FullAttendanceRow = Prisma.AttendanceLogGetPayload<{ select: typeof attendanceFullSelect }>;
type AttendanceRow = SafeAttendanceRow | FullAttendanceRow;

const dailyMemberSelect = Prisma.validator<Prisma.MemberSelect>()({
  id: true,
  code: true,
  firstName: true,
  lastName: true,
  phone: true,
  memberType: true,
  isStaff: true,
  staffGroup: { select: { id: true, name: true } },
});

const dailyLogSelect = Prisma.validator<Prisma.AttendanceLogSelect>()({
  id: true,
  memberId: true,
  entryType: true,
  recordedAt: true,
  isAuthorized: true,
  deviceUser: { select: { deviceId: true } },
  member: { select: dailyMemberSelect },
});

const dailyShiftSelect = Prisma.validator<Prisma.MemberShiftSelect>()({
  memberId: true,
  shiftId: true,
  shiftName: true,
  shiftStart: true,
  shiftEnd: true,
  graceMinutes: true,
  member: { select: dailyMemberSelect },
});

type DailyLogRow = Prisma.AttendanceLogGetPayload<{ select: typeof dailyLogSelect }>;
type ShiftRow = Prisma.MemberShiftGetPayload<{ select: typeof dailyShiftSelect }>;

type AttendanceItem = {
  id: string;
  createdAt: Date;
  recordedAt: Date;
  memberId: string;
  memberCode: string;
  memberFullName: string;
  memberType: "CUSTOMER" | "STAFF";
  memberStatus?: string | null;
  memberPhone?: string | null;
  memberRole?: string | null;
  memberTitle?: string | null;
  membershipId?: string | null;
  membershipStatus?: string | null;
  deviceId?: string | null;
  deviceName?: string | null;
  eventType: AttendanceType;
  source: AttendanceSource;
  isAuthorized: boolean;
  reason?: string | null;
};

type AttendanceSummary = {
  totalIn: number;
  totalOut: number;
  uniqueVisitors: number;
  deniedAttempts: number;
};

type DailyAttendanceStatus = "ABSENT" | "LATE" | "PRESENT" | "INSIDE";

type DailyAttendanceWarning = "NO_CHECKOUT" | "NO_SHIFT" | "MULTIPLE_EVENTS";

type DailyAttendanceRow = {
  memberId: string;
  memberCode: string;
  memberFullName: string;
  memberPhone?: string | null;
  staffGroupId?: string | null;
  staffGroupName?: string | null;
  shiftId?: string | null;
  shiftName: string;
  shiftStart: string;
  shiftEnd: string;
  graceMinutes: number;
  status: DailyAttendanceStatus;
  checkInAt?: Date | null;
  checkOutAt?: Date | null;
  lateMinutes?: number | null;
  earlyMinutes?: number | null;
  earlyLeaveMinutes?: number | null;
  overtimeMinutes?: number | null;
  durationMinutes?: number | null;
  confirmedDurationMinutes: number;
  pairedSessionCount: number;
  hasOpenSession: boolean;
  openSessionSince: Date | null;
  liveDurationMinutes: number | null;
  lastEventType?: AttendanceType | null;
  deviceName?: string | null;
  warnings: DailyAttendanceWarning[];
  isJustified: boolean;
  justificationReason?: string | null;
  hasShift: boolean;
};

type DailyAttendanceSummary = {
  present: number;
  absent: number;
  late: number;
  inside: number;
  justified: number;
  unscheduledPresentCount: number;
  deniedCount: number;
};

type DailyAttendanceWarningsSummary = {
  noCheckout: number;
  noShift: number;
  multipleEvents: number;
};

export type AttendanceActionContext = {
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

type AttendanceAuditInput = {
  action: string;
  targetType: string;
  targetId: string;
  beforeData?: Prisma.InputJsonObject;
  afterData?: Prisma.InputJsonObject;
  metadata?: Prisma.InputJsonObject;
};

export async function listAttendance(
  query: AttendanceListQuery,
  scope: AttendanceDataScope
) {
  const baseWhere = buildAttendanceWhere(query, scope);
  const eventType = query.eventType === "ALL" ? null : query.eventType;
  const itemWhere = eventType
    ? {
        ...baseWhere,
        entryType: eventType as AttendanceType,
        ...(query.result === "ALL" ? { isAuthorized: true } : {}),
      }
    : baseWhere;

  const skip = (query.page - 1) * query.pageSize;
  const take = query.pageSize;

  const rowQuery = isStrictStaffAttendanceScope(scope)
    ? prisma.attendanceLog.findMany({
        where: itemWhere,
        orderBy: { recordedAt: "desc" },
        skip,
        take,
        select: attendanceSafeSelect,
      })
    : prisma.attendanceLog.findMany({
      where: itemWhere,
      orderBy: { recordedAt: "desc" },
      skip,
      take,
      select: attendanceFullSelect,
    });
  const [loadedRows, total] = await prisma.$transaction([
    rowQuery,
    prisma.attendanceLog.count({ where: itemWhere }),
  ]);
  const rows = loadedRows as AttendanceRow[];

  const deviceIds = rows
    .map((row) => row.deviceUser?.deviceId)
    .filter((id): id is string => typeof id === "string" && id.length > 0);
  const deviceRecords = deviceIds.length
    ? await prisma.device.findMany({ where: { id: { in: deviceIds } }, select: { id: true, name: true } })
    : [];
  const deviceMap = new Map(deviceRecords.map((device) => [device.id, device.name]));

  const items = rows.map((row) => formatAttendanceRow(row, deviceMap, scope));
  const summary = await buildSummary(baseWhere, itemWhere, eventType);

  return {
    items,
    page: query.page,
    pageSize: query.pageSize,
    total,
    summary,
  };
}

export async function createManualAttendance(
  input: AttendanceManualCreateInput,
  context: AttendanceActionContext,
  scope: AttendanceDataScope
) {
  const recordedAt = input.occurredAt ? new Date(input.occurredAt) : new Date();
  if (Number.isNaN(recordedAt.getTime())) {
    throw new HttpError(400, "Invalid occurredAt timestamp", { occurredAt: input.occurredAt });
  }

  const notes = input.notes?.trim() || null;
  const entryType = input.eventType === "OUT" ? AttendanceType.OUT : AttendanceType.IN;

  const row = await runAttendanceMutation(scope, async (tx) => {
    const member = isStrictStaffAttendanceScope(scope)
      ? await tx.member.findFirst({
          where: { id: input.memberId, ...buildStrictStaffMemberWhere() },
          select: { id: true },
        })
      : await tx.member.findUnique({ where: { id: input.memberId } });
    if (!member) {
      throw isStrictStaffAttendanceScope(scope)
        ? new HttpError(404, "Employee not found")
        : new HttpError(404, "Member not found", { memberId: input.memberId });
    }

    const createData: Prisma.AttendanceLogUncheckedCreateInput = {
      memberId: member.id,
      entryType,
      recordedAt,
      source: AttendanceSource.MANUAL,
      isAuthorized: true,
      reason: notes,
    };
    const created = (isStrictStaffAttendanceScope(scope)
      ? await tx.attendanceLog.create({ data: createData, select: attendanceSafeSelect })
      : await tx.attendanceLog.create({ data: createData, select: attendanceFullSelect })) as AttendanceRow;
    if (
      isStrictStaffAttendanceScope(scope) &&
      (!created.member || created.member.memberType !== MemberType.STAFF || !created.member.isStaff)
    ) {
      throw new HttpError(404, "Employee not found");
    }

    await tx.auditLog.create({
      data: buildAttendanceAuditData(context, {
        action: "attendance.manual.created",
        targetType: "AttendanceLog",
        targetId: created.id,
        afterData: toManualAttendanceAuditJson(created),
        metadata: {
          memberId: member.id,
          ...(isStrictStaffAttendanceScope(scope)
            ? { editionScope: ATTENDANCE_AUDIT_SCOPE_MARKER, memberType: "STAFF", isStaff: true }
            : {}),
        },
      }),
    });

    return created;
  });

  return formatAttendanceRow(row, new Map(), scope);
}

const ENTRY_LOG_EXPORT_BATCH_SIZE = 200;
const ENTRY_LOG_EXPORT_MAX_ROWS = 50_000;

export function createAttendanceEntryLogsExporter(loader = listAttendance) {
  return async (
    query: AttendanceEntryLogsExportQuery,
    format: "CSV" | "XLSX",
    scope: AttendanceDataScope
  ) => {
  const items: AttendanceItem[] = [];
  let page = 1;
  let total = 0;

  do {
    const result = await loader(
      {
        ...query,
        memberType: "ALL",
        page,
        pageSize: ENTRY_LOG_EXPORT_BATCH_SIZE,
      },
      scope
    );
    total = result.total;
    if (total > ENTRY_LOG_EXPORT_MAX_ROWS) {
      throw new HttpError(413, "Entry Logs export is too large. Narrow filters and try again.", {
        maxRows: ENTRY_LOG_EXPORT_MAX_ROWS,
        total,
      });
    }
    items.push(...result.items);
    page += 1;
  } while (items.length < total);

  const labels = getReportExportLabels(query.lang);
  const t = labels.t;
  const headers = [
    t("timestamp"),
    t("employee"),
    t("memberCode"),
    t("eventType"),
    t("source"),
    t("device"),
    t("result"),
    t("reason"),
  ];
  const rows = items.map((item) => [
    item.recordedAt.toISOString(),
    item.memberFullName,
    item.memberCode,
    labels.attendanceEvent(item.eventType),
    labels.attendanceSource(item.source),
    item.deviceName ?? "",
    labels.attendanceResult(item.isAuthorized ? "authorized" : "denied"),
    item.reason ?? "",
  ]);
  const stamp = buildEntryLogExportStamp(query.from, query.to);

  if (format === "CSV") {
    return {
      buffer: Buffer.from(`\uFEFF${buildCsv(headers, rows)}`, "utf8"),
      filename: `${ATTENDANCE_EXPORT_FILENAME_PREFIX}-entry-logs-${stamp}.csv`,
      contentType: "text/csv; charset=utf-8",
      rowCount: items.length,
    };
  }
  return {
    buffer: buildXlsxBuffer([{
      name: t("entryLogs"),
      rows: [[ATTENDANCE_EXPORT_BRAND], [t("entryLogs")], [], headers, ...rows],
    }]),
    filename: `${ATTENDANCE_EXPORT_FILENAME_PREFIX}-entry-logs-${stamp}.xlsx`,
    contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    rowCount: items.length,
  };
  };
}

export const exportAttendanceEntryLogs = createAttendanceEntryLogsExporter();

export async function listAttendanceDeviceOptions() {
  return prisma.device.findMany({
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
}

const SHIFT_MATCH_BUFFER_MINUTES = 120;

export async function listDailyAttendance(
  query: AttendanceDailyQuery,
  scope: AttendanceDataScope
) {
  const mode = query.mode ?? "primary";
  const targetDate = query.date ? parseLocalDate(query.date) : new Date();
  const dayStart = startOfDay(targetDate);
  const dayEnd = addDays(dayStart, 1);
  const weekday = toScheduleWeekday(dayStart);

  const memberFilters: Prisma.MemberWhereInput[] = [
    isStrictStaffAttendanceScope(scope)
      ? buildStrictStaffMemberWhere()
      : { OR: [{ memberType: MemberType.STAFF }, { isStaff: true }] },
  ];
  if (query.staffGroupId) {
    memberFilters.push({ staffGroupId: query.staffGroupId });
  }
  if (query.memberId) {
    memberFilters.push({ id: query.memberId });
  }
  const search = query.search?.trim();
  if (search) {
    memberFilters.push({
      OR: [
        { code: { contains: search, mode: "insensitive" } },
        { firstName: { contains: search, mode: "insensitive" } },
        { lastName: { contains: search, mode: "insensitive" } },
        { phone: { contains: search, mode: "insensitive" } },
      ],
    });
  }

  const shiftWhere: Prisma.MemberShiftWhereInput = {
    isActive: true,
    weekdays: { has: weekday },
    member: { AND: memberFilters },
  };
  if (query.shiftId) {
    shiftWhere.shiftId = query.shiftId;
  }

  const shiftRows = await prisma.memberShift.findMany({
    where: shiftWhere,
    select: dailyShiftSelect,
    orderBy: [{ shiftStart: "asc" }, { shiftName: "asc" }],
  });

  const selectedShifts = mode === "all" ? shiftRows : selectDailyShifts(shiftRows, query.shiftId);
  const expectedMemberIds = Array.from(new Set(selectedShifts.map((shift) => shift.memberId)));
  const hasOvernightShift = selectedShifts.some((shift) => isCrossMidnight(shift.shiftStart, shift.shiftEnd));
  const logWindowEnd = hasOvernightShift ? addDays(dayEnd, 1) : dayEnd;

  const logs = await prisma.attendanceLog.findMany({
    where: {
      recordedAt: { gte: dayStart, lt: logWindowEnd },
      isAuthorized: true,
      member: { AND: memberFilters },
    },
    orderBy: { recordedAt: "asc" },
    select: dailyLogSelect,
  });

  const deviceIds = logs
    .map((log) => log.deviceUser?.deviceId)
    .filter((id): id is string => typeof id === "string" && id.length > 0);
  const deviceRecords = deviceIds.length
    ? await prisma.device.findMany({ where: { id: { in: deviceIds } }, select: { id: true, name: true } })
    : [];
  const deviceMap = new Map(deviceRecords.map((device) => [device.id, device.name]));

  const logsByMember = groupLogsByMember(logs);
  const logsByMemberForDay = groupLogsByMember(logs.filter((log) => log.recordedAt < dayEnd));
  const now = new Date();

  const justifications = expectedMemberIds.length
    ? await prisma.attendanceJustification.findMany({
        where: {
          memberId: { in: expectedMemberIds },
          date: { gte: dayStart, lt: dayEnd },
          ...(isStrictStaffAttendanceScope(scope)
            ? { member: buildStrictStaffMemberWhere() }
            : {}),
        },
      })
    : [];
  const justificationMap = new Map(justifications.map((record) => [record.memberId, record]));

  const expectedRows = selectedShifts.map((shift) =>
    buildRowForShift({
      shift,
      dayStart,
      mode,
      logs: logsByMember.get(shift.memberId) ?? [],
      deviceMap,
      justification: justificationMap.get(shift.memberId) ?? null,
      now,
    })
  );

  const expectedSet = new Set(expectedMemberIds);
  const unscheduledRows = Array.from(logsByMemberForDay.entries())
    .filter(([memberId, memberLogs]) => memberId && !expectedSet.has(memberId) && memberLogs.length > 0)
    .map(([, memberLogs]) => buildRowForUnscheduled({ dayStart, logs: memberLogs, deviceMap, now }));

  const deniedCount = await prisma.attendanceLog.count({
    where: {
      recordedAt: { gte: dayStart, lt: logWindowEnd },
      isAuthorized: false,
      member: { AND: memberFilters },
    },
  });

  const summary = expectedRows.reduce<DailyAttendanceSummary>(
    (acc, row) => {
      if (row.isJustified && row.status === "ABSENT") {
        acc.justified += 1;
        return acc;
      }
      if (row.status === "PRESENT") acc.present += 1;
      else if (row.status === "ABSENT") acc.absent += 1;
      else if (row.status === "LATE") acc.late += 1;
      else if (row.status === "INSIDE") acc.inside += 1;
      return acc;
    },
    { present: 0, absent: 0, late: 0, inside: 0, justified: 0, unscheduledPresentCount: 0, deniedCount }
  );
  summary.unscheduledPresentCount = unscheduledRows.length;

  const warnings = [...expectedRows, ...unscheduledRows].reduce<DailyAttendanceWarningsSummary>(
    (acc, row) => {
      if (row.warnings.includes("NO_CHECKOUT")) acc.noCheckout += 1;
      if (row.warnings.includes("NO_SHIFT")) acc.noShift += 1;
      if (row.warnings.includes("MULTIPLE_EVENTS")) acc.multipleEvents += 1;
      return acc;
    },
    { noCheckout: 0, noShift: 0, multipleEvents: 0 }
  );

  const rows = [...expectedRows, ...unscheduledRows].sort((a, b) => {
    if (a.hasShift !== b.hasShift) return a.hasShift ? -1 : 1;
    const aMinutes = timeToMinutes(a.shiftStart || "99:99");
    const bMinutes = timeToMinutes(b.shiftStart || "99:99");
    if (aMinutes !== bMinutes) return aMinutes - bMinutes;
    return a.memberFullName.localeCompare(b.memberFullName);
  });

  return {
    date: formatDateKey(dayStart),
    summary,
    warnings,
    rows,
  };
}

export async function upsertAttendanceJustification(
  input: AttendanceJustificationInput,
  context: AttendanceActionContext,
  scope: AttendanceDataScope
) {
  const dayStart = startOfDay(parseLocalDate(input.date));
  return runAttendanceMutation(scope, async (tx) => {
    await assertStrictStaffTarget(tx, input.memberId, scope);
    const existing = await tx.attendanceJustification.findUnique({
      where: { memberId_date: { memberId: input.memberId, date: dayStart } },
    });
    const record = await tx.attendanceJustification.upsert({
      where: { memberId_date: { memberId: input.memberId, date: dayStart } },
      update: { reason: input.reason ?? null },
      create: { memberId: input.memberId, date: dayStart, reason: input.reason ?? null },
    });
    await assertStrictStaffTarget(tx, input.memberId, scope);

    const auditInput: AttendanceAuditInput = {
      action: existing ? "attendance.justification.updated" : "attendance.justification.created",
      targetType: "AttendanceJustification",
      targetId: record.id,
      afterData: toJustificationAuditJson(record),
      metadata: {
        memberId: input.memberId,
        date: input.date,
        ...(isStrictStaffAttendanceScope(scope)
          ? { editionScope: ATTENDANCE_AUDIT_SCOPE_MARKER, memberType: "STAFF", isStaff: true }
          : {}),
      },
    };
    if (existing) {
      auditInput.beforeData = toJustificationAuditJson(existing);
    }
    await tx.auditLog.create({ data: buildAttendanceAuditData(context, auditInput) });

    return record;
  });
}

export async function removeAttendanceJustification(
  input: Pick<AttendanceJustificationInput, "memberId" | "date">,
  context: AttendanceActionContext,
  scope: AttendanceDataScope
) {
  const dayStart = startOfDay(parseLocalDate(input.date));
  return runAttendanceMutation(scope, async (tx) => {
    await assertStrictStaffTarget(tx, input.memberId, scope);
    const existing = await tx.attendanceJustification.findUnique({
      where: { memberId_date: { memberId: input.memberId, date: dayStart } },
    });
    if (!existing) {
      return false;
    }

    await tx.attendanceJustification.delete({ where: { id: existing.id } });
    await assertStrictStaffTarget(tx, input.memberId, scope);
    await tx.auditLog.create({
      data: buildAttendanceAuditData(context, {
        action: "attendance.justification.deleted",
        targetType: "AttendanceJustification",
        targetId: existing.id,
        beforeData: toJustificationAuditJson(existing),
        metadata: {
          memberId: input.memberId,
          date: input.date,
          ...(isStrictStaffAttendanceScope(scope)
            ? { editionScope: ATTENDANCE_AUDIT_SCOPE_MARKER, memberType: "STAFF", isStaff: true }
            : {}),
        },
      }),
    });
    return true;
  });
}

async function assertStrictStaffTarget(
  tx: Prisma.TransactionClient,
  memberId: string,
  scope: AttendanceDataScope
) {
  if (!isStrictStaffAttendanceScope(scope)) return;
  const employee = await tx.member.findFirst({
    where: { id: memberId, ...buildStrictStaffMemberWhere() },
    select: { id: true },
  });
  if (!employee) {
    throw new HttpError(404, "Employee not found");
  }
}

async function runAttendanceMutation<T>(
  scope: AttendanceDataScope,
  operation: (tx: Prisma.TransactionClient) => Promise<T>
): Promise<T> {
  if (!isStrictStaffAttendanceScope(scope)) {
    return prisma.$transaction(operation);
  }

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await prisma.$transaction(operation, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      });
    } catch (error) {
      if (!isSerializableWriteConflict(error) || attempt === 2) throw error;
    }
  }
  throw new Error("Unreachable Attendance transaction retry state");
}

function isSerializableWriteConflict(error: unknown): boolean {
  return Boolean(error && typeof error === "object" && "code" in error && error.code === "P2034");
}

function buildAttendanceAuditData(
  context: AttendanceActionContext,
  input: AttendanceAuditInput
): Prisma.AuditLogUncheckedCreateInput {
  const data: Prisma.AuditLogUncheckedCreateInput = {
    actorType: AuditActor.ADMIN,
    actorId: context.actor.id,
    actorRole: context.actor.role,
    action: input.action,
    targetType: input.targetType,
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

function toManualAttendanceAuditJson(row: {
  id: string;
  memberId: string | null;
  entryType: AttendanceType;
  recordedAt: Date;
  source: AttendanceSource;
  isAuthorized: boolean;
  reason: string | null;
}) {
  return {
    id: row.id,
    entryType: row.entryType,
    recordedAt: row.recordedAt.toISOString(),
    source: row.source,
    isAuthorized: row.isAuthorized,
    ...(row.memberId ? { memberId: row.memberId } : {}),
    ...(row.reason ? { reason: row.reason } : {}),
  } satisfies Prisma.InputJsonObject;
}

function toJustificationAuditJson(row: {
  id: string;
  memberId: string;
  date: Date;
  reason: string | null;
}) {
  return {
    id: row.id,
    memberId: row.memberId,
    date: row.date.toISOString(),
    ...(row.reason ? { reason: row.reason } : {}),
  } satisfies Prisma.InputJsonObject;
}

function buildAttendanceWhere(
  query: AttendanceListQuery,
  scope: AttendanceDataScope
): Prisma.AttendanceLogWhereInput {
  const where: Prisma.AttendanceLogWhereInput = {
    memberId: { not: null },
  };

  if (query.memberId) {
    where.memberId = query.memberId;
  }

  if (query.deviceId) {
    where.deviceUser = { deviceId: query.deviceId };
  }

  if (query.source && query.source !== "ALL") {
    where.source = query.source as AttendanceSource;
  }

  if (query.result && query.result !== "ALL") {
    where.isAuthorized = query.result === "AUTHORIZED";
  }

  if (query.from || query.to) {
    where.recordedAt = {};
    if (query.from) {
      where.recordedAt.gte = parseDate(query.from, "from");
    }
    if (query.to) {
      where.recordedAt.lte = parseDate(query.to, "to");
    }
    if (where.recordedAt.gte && where.recordedAt.lte && where.recordedAt.gte > where.recordedAt.lte) {
      throw new HttpError(400, "Invalid date range", { from: query.from, to: query.to });
    }
  }

  const memberFilters: Prisma.MemberWhereInput[] = isStrictStaffAttendanceScope(scope)
    ? [buildStrictStaffMemberWhere()]
    : [];
  if (!isStrictStaffAttendanceScope(scope) && query.memberType === "CUSTOMER") {
    memberFilters.push({ memberType: MemberType.CUSTOMER, isStaff: false });
  } else if (!isStrictStaffAttendanceScope(scope) && query.memberType === "STAFF") {
    memberFilters.push({ OR: [{ memberType: MemberType.STAFF }, { isStaff: true }] });
  }

  const search = query.search?.trim();
  if (search) {
    memberFilters.push({
      OR: [
        { code: { contains: search, mode: "insensitive" } },
        { firstName: { contains: search, mode: "insensitive" } },
        { lastName: { contains: search, mode: "insensitive" } },
        { phone: { contains: search, mode: "insensitive" } },
      ],
    });
  }

  if (memberFilters.length > 0) {
    where.member = { AND: memberFilters };
  }

  return where;
}

async function buildSummary(
  baseWhere: Prisma.AttendanceLogWhereInput,
  itemWhere: Prisma.AttendanceLogWhereInput,
  eventType: AttendanceListQuery["eventType"] | null
): Promise<AttendanceSummary> {
  const totalIn =
    eventType && eventType !== "IN"
      ? 0
      : await prisma.attendanceLog.count({ where: { ...baseWhere, entryType: AttendanceType.IN, isAuthorized: true } });
  const totalOut =
    eventType && eventType !== "OUT"
      ? 0
      : await prisma.attendanceLog.count({ where: { ...baseWhere, entryType: AttendanceType.OUT, isAuthorized: true } });

  const uniqueMembers = await prisma.attendanceLog.findMany({
    where: itemWhere,
    distinct: ["memberId"],
    select: { memberId: true },
  });
  const uniqueVisitors = uniqueMembers.length;

  const deniedAttempts = await prisma.attendanceLog.count({
    where: { ...itemWhere, isAuthorized: false },
  });

  return { totalIn, totalOut, uniqueVisitors, deniedAttempts };
}

function formatAttendanceRow(
  row: AttendanceRow,
  deviceMap: Map<string, string>,
  scope: AttendanceDataScope
): AttendanceItem {
  const member = row.member;
  const memberType = isStrictStaffAttendanceScope(scope)
    ? "STAFF"
    : member && (member.memberType === MemberType.STAFF || member.isStaff)
      ? "STAFF"
      : "CUSTOMER";
  const fullName = member ? `${member.firstName ?? ""} ${member.lastName ?? ""}`.trim() : "";
  const fullMember = !isStrictStaffAttendanceScope(scope) ? (member as FullAttendanceRow["member"]) : null;
  const membership = fullMember?.memberships?.[0];
  const deviceId = row.deviceUser?.deviceId ?? null;

  return {
    id: row.id,
    createdAt: row.createdAt,
    recordedAt: row.recordedAt,
    memberId: row.memberId ?? "",
    memberCode: member?.code ?? "",
    memberFullName: fullName || "Unknown",
    memberType,
    memberStatus: member?.status ?? null,
    memberPhone: member?.phone ?? null,
    memberRole: member?.roleType ?? null,
    memberTitle: member?.customTitle ?? member?.staffProfile?.position ?? null,
    ...(!isStrictStaffAttendanceScope(scope)
      ? {
          membershipId: membership?.id ?? null,
          membershipStatus: membership?.status ?? null,
        }
      : {}),
    deviceId,
    deviceName: deviceId ? deviceMap.get(deviceId) ?? null : null,
    eventType: row.entryType,
    source: row.source,
    isAuthorized: row.isAuthorized,
    reason: row.reason ?? null,
  };
}

function buildRowForShift(params: {
  shift: ShiftRow;
  dayStart: Date;
  mode: AttendanceDailyQuery["mode"];
  logs: DailyLogRow[];
  deviceMap: Map<string, string>;
  justification: { id: string; reason: string | null } | null;
  now: Date;
}): DailyAttendanceRow {
  const { shift, dayStart, mode, logs, deviceMap, justification, now } = params;
  const member = shift.member;
  const memberName = member ? `${member.firstName ?? ""} ${member.lastName ?? ""}`.trim() : "";
  const shiftLogs = filterLogsForShift(logs, shift, dayStart);
  const metrics = computeAttendanceMetrics({
    logs: shiftLogs,
    dayStart,
    hasShift: true,
    shiftStart: shift.shiftStart,
    shiftEnd: shift.shiftEnd,
    graceMinutes: shift.graceMinutes ?? 0,
    now,
  });
  const warnings = buildWarnings({
    logs: shiftLogs,
    hasShift: true,
    checkInAt: metrics.checkInAt,
    checkOutAt: metrics.checkOutAt,
    lastEventType: metrics.lastEventType,
    hasUnpairedIn: metrics.hasUnpairedIn,
    hasUnpairedOut: metrics.hasUnpairedOut,
  });
  const lastEvent = shiftLogs.length ? shiftLogs[shiftLogs.length - 1] : null;
  const deviceId = lastEvent?.deviceUser?.deviceId ?? null;

  return {
    memberId: shift.memberId,
    memberCode: member?.code ?? "",
    memberFullName: memberName || "Unknown",
    memberPhone: member?.phone ?? null,
    staffGroupId: member?.staffGroup?.id ?? null,
    staffGroupName: member?.staffGroup?.name ?? null,
    shiftId: shift.shiftId ?? null,
    shiftName: shift.shiftName,
    shiftStart: shift.shiftStart,
    shiftEnd: shift.shiftEnd,
    graceMinutes: shift.graceMinutes ?? 0,
    status: metrics.status,
    checkInAt: metrics.checkInAt,
    checkOutAt: metrics.checkOutAt,
    lateMinutes: metrics.lateMinutes,
    earlyMinutes: metrics.earlyMinutes,
    earlyLeaveMinutes: metrics.earlyLeaveMinutes,
    overtimeMinutes: metrics.overtimeMinutes,
    durationMinutes: metrics.durationMinutes,
    confirmedDurationMinutes: metrics.confirmedDurationMinutes,
    pairedSessionCount: metrics.pairedSessionCount,
    hasOpenSession: metrics.hasOpenSession,
    openSessionSince: metrics.openSessionSince,
    liveDurationMinutes: metrics.liveDurationMinutes,
    lastEventType: metrics.lastEventType,
    deviceName: deviceId ? deviceMap.get(deviceId) ?? null : null,
    warnings,
    isJustified: Boolean(justification),
    justificationReason: justification?.reason ?? null,
    hasShift: true,
  };
}

function buildRowForUnscheduled(params: {
  dayStart: Date;
  logs: DailyLogRow[];
  deviceMap: Map<string, string>;
  now: Date;
}): DailyAttendanceRow {
  const { dayStart, logs, deviceMap, now } = params;
  const first = logs[0];
  const member = first?.member;
  const memberName = member ? `${member.firstName ?? ""} ${member.lastName ?? ""}`.trim() : "";
  const metrics = computeAttendanceMetrics({ logs, dayStart, hasShift: false, now });
  const warnings = buildWarnings({
    logs,
    hasShift: false,
    checkInAt: metrics.checkInAt,
    checkOutAt: metrics.checkOutAt,
    lastEventType: metrics.lastEventType,
    hasUnpairedIn: metrics.hasUnpairedIn,
    hasUnpairedOut: metrics.hasUnpairedOut,
  });
  const lastEvent = logs.length ? logs[logs.length - 1] : null;
  const deviceId = lastEvent?.deviceUser?.deviceId ?? null;

  return {
    memberId: member?.id ?? "",
    memberCode: member?.code ?? "",
    memberFullName: memberName || "Unknown",
    memberPhone: member?.phone ?? null,
    staffGroupId: member?.staffGroup?.id ?? null,
    staffGroupName: member?.staffGroup?.name ?? null,
    shiftId: null,
    shiftName: "",
    shiftStart: "",
    shiftEnd: "",
    graceMinutes: 0,
    status: metrics.status,
    checkInAt: metrics.checkInAt,
    checkOutAt: metrics.checkOutAt,
    lateMinutes: null,
    earlyMinutes: null,
    earlyLeaveMinutes: null,
    overtimeMinutes: null,
    durationMinutes: metrics.durationMinutes,
    confirmedDurationMinutes: metrics.confirmedDurationMinutes,
    pairedSessionCount: metrics.pairedSessionCount,
    hasOpenSession: metrics.hasOpenSession,
    openSessionSince: metrics.openSessionSince,
    liveDurationMinutes: metrics.liveDurationMinutes,
    lastEventType: metrics.lastEventType,
    deviceName: deviceId ? deviceMap.get(deviceId) ?? null : null,
    warnings,
    isJustified: false,
    justificationReason: null,
    hasShift: false,
  };
}

function groupLogsByMember(logs: DailyLogRow[]) {
  const map = new Map<string, DailyLogRow[]>();
  logs.forEach((log) => {
    if (!log.memberId) return;
    const list = map.get(log.memberId) ?? [];
    list.push(log);
    map.set(log.memberId, list);
  });
  return map;
}

function filterLogsForShift(logs: DailyLogRow[], shift: { shiftStart: string; shiftEnd: string }, dayStart: Date) {
  if (logs.length === 0) return [];
  const window = computeShiftWindow(dayStart, shift.shiftStart, shift.shiftEnd);
  const windowStart = addMinutes(window.startAt, -SHIFT_MATCH_BUFFER_MINUTES);
  const windowEnd = addMinutes(window.endAt, SHIFT_MATCH_BUFFER_MINUTES);
  const inWindowLogs = logs.filter((log) => log.recordedAt >= windowStart && log.recordedAt <= windowEnd);
  if (!computeSessionDuration(inWindowLogs).hasOpenSession) {
    return inWindowLogs;
  }

  const closingOut = logs.find((log) => log.recordedAt > windowEnd && log.entryType === AttendanceType.OUT);
  return closingOut ? [...inWindowLogs, closingOut] : inWindowLogs;
}

function computeAttendanceMetrics(params: {
  logs: DailyLogRow[];
  dayStart: Date;
  hasShift: boolean;
  shiftStart?: string;
  shiftEnd?: string;
  graceMinutes?: number;
  now: Date;
}) {
  const { logs, dayStart, hasShift, shiftStart, shiftEnd, graceMinutes = 0, now } = params;
  const checkInAt = logs.find((log) => log.entryType === AttendanceType.IN)?.recordedAt ?? null;
  const checkOutAt = [...logs].reverse().find((log) => log.entryType === AttendanceType.OUT)?.recordedAt ?? null;
  const lastEventType = logs.at(-1)?.entryType ?? null;
  const inside = Boolean(checkInAt && (!checkOutAt || lastEventType === AttendanceType.IN));
  const durationResult = computeSessionDuration(logs);

  let lateMinutes: number | null = null;
  let earlyMinutes: number | null = null;
  let earlyLeaveMinutes: number | null = null;
  let overtimeMinutes: number | null = null;

  if (hasShift && shiftStart && shiftEnd) {
    const window = computeShiftWindow(dayStart, shiftStart, shiftEnd);
    const shiftStartAt = window.startAt;
    const shiftEndAt = window.endAt;
    if (checkInAt) {
      const lateThreshold = addMinutes(shiftStartAt, graceMinutes);
      lateMinutes = Math.max(0, minutesBetween(checkInAt, lateThreshold));
      earlyMinutes = checkInAt < shiftStartAt ? Math.max(0, minutesBetween(shiftStartAt, checkInAt)) : 0;
    }
    if (checkOutAt) {
      earlyLeaveMinutes = checkOutAt < shiftEndAt ? Math.max(0, minutesBetween(shiftEndAt, checkOutAt)) : 0;
      overtimeMinutes = checkOutAt > shiftEndAt ? Math.max(0, minutesBetween(checkOutAt, shiftEndAt)) : 0;
    }
  }

  const status: DailyAttendanceStatus = !checkInAt
    ? "ABSENT"
    : inside
      ? "INSIDE"
      : lateMinutes && lateMinutes > 0
        ? "LATE"
        : "PRESENT";

  const durationMinutes = durationResult.confirmedDurationMinutes;
  const liveDurationMinutes = durationResult.hasOpenSession && durationResult.openSessionSince
    ? Math.max(0, durationResult.confirmedDurationMinutes + minutesBetween(now, durationResult.openSessionSince))
    : null;

  return {
    checkInAt,
    checkOutAt,
    lastEventType,
    lateMinutes,
    earlyMinutes,
    earlyLeaveMinutes,
    overtimeMinutes,
    durationMinutes,
    confirmedDurationMinutes: durationResult.confirmedDurationMinutes,
    pairedSessionCount: durationResult.pairedSessionCount,
    hasOpenSession: durationResult.hasOpenSession,
    openSessionSince: durationResult.openSessionSince,
    liveDurationMinutes,
    status,
    hasUnpairedIn: durationResult.hasUnpairedIn,
    hasUnpairedOut: durationResult.hasUnpairedOut,
  };
}

function buildWarnings(params: {
  logs: DailyLogRow[];
  hasShift: boolean;
  checkInAt: Date | null;
  checkOutAt: Date | null;
  lastEventType: AttendanceType | null;
  hasUnpairedIn: boolean;
  hasUnpairedOut: boolean;
}): DailyAttendanceWarning[] {
  const { logs, hasShift, checkInAt, checkOutAt, lastEventType, hasUnpairedIn, hasUnpairedOut } = params;
  const warnings: DailyAttendanceWarning[] = [];

  if (!hasShift) {
    warnings.push("NO_SHIFT");
  }

  if (checkInAt && (!checkOutAt || lastEventType === AttendanceType.IN)) {
    warnings.push("NO_CHECKOUT");
  }
  if (hasUnpairedIn) {
    warnings.push("NO_CHECKOUT");
  }

  if (hasUnpairedOut) {
    warnings.push("MULTIPLE_EVENTS");
  }

  if (hasMultipleEvents(logs)) {
    warnings.push("MULTIPLE_EVENTS");
  }

  return Array.from(new Set<DailyAttendanceWarning>(warnings));
}

function hasMultipleEvents(logs: DailyLogRow[]) {
  if (logs.length <= 2) return false;
  let repeated = false;
  for (let i = 1; i < logs.length; i += 1) {
    const current = logs[i];
    const previous = logs[i - 1];
    if (!current || !previous) continue;
    if (current.entryType === previous.entryType) {
      repeated = true;
      break;
    }
  }
  const inCount = logs.filter((log) => log.entryType === AttendanceType.IN).length;
  const outCount = logs.filter((log) => log.entryType === AttendanceType.OUT).length;
  return repeated || inCount > 1 || outCount > 1;
}

function minutesBetween(later: Date, earlier: Date) {
  return Math.floor((later.getTime() - earlier.getTime()) / 60000);
}

function parseDate(value: string, field: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new HttpError(400, `Invalid ${field} date`, { value });
  }
  return parsed;
}

function buildEntryLogExportStamp(from?: string, to?: string) {
  const safe = (value: string) => value.replace(/[^0-9A-Za-z_-]/g, "-").slice(0, 32);
  if (from || to) return `${safe(from ?? "start")}-to-${safe(to ?? "now")}`;
  return new Date().toISOString().slice(0, 10);
}

function parseLocalDate(value: string) {
  const parts = value.split("-").map(Number);
  if (parts.length !== 3) {
    throw new HttpError(400, "Invalid date", { value });
  }
  const [year, month, day] = parts;
  if (
    year === undefined ||
    month === undefined ||
    day === undefined ||
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    !Number.isInteger(day)
  ) {
    throw new HttpError(400, "Invalid date", { value });
  }
  const parsed = new Date(year, month - 1, day);
  if (
    Number.isNaN(parsed.getTime()) ||
    parsed.getFullYear() !== year ||
    parsed.getMonth() !== month - 1 ||
    parsed.getDate() !== day
  ) {
    throw new HttpError(400, "Invalid date", { value });
  }
  return parsed;
}

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function addMinutes(date: Date, minutes: number): Date {
  const d = new Date(date);
  d.setMinutes(d.getMinutes() + minutes);
  return d;
}

function formatDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function computeShiftWindow(dayStart: Date, shiftStart: string, shiftEnd: string) {
  const startAt = applyTime(dayStart, shiftStart);
  let endAt = applyTime(dayStart, shiftEnd);
  if (isCrossMidnight(shiftStart, shiftEnd)) {
    endAt = addDays(endAt, 1);
  }
  if (endAt < startAt) {
    endAt = addDays(endAt, 1);
  }
  return { startAt, endAt };
}

function isCrossMidnight(shiftStart: string, shiftEnd: string) {
  return timeToMinutes(shiftEnd) <= timeToMinutes(shiftStart);
}

function applyTime(base: Date, time: string): Date {
  const [hours, minutes] = time.split(":").map(Number);
  const next = new Date(base);
  next.setHours(hours ?? 0, minutes ?? 0, 0, 0);
  return next;
}

function toScheduleWeekday(date: Date) {
  return (date.getDay() + 1) % 7;
}

function selectDailyShifts<T extends { memberId: string; shiftStart: string; shiftName: string }>(shifts: T[], shiftId?: string) {
  if (shiftId) {
    return shifts;
  }

  const byMember = new Map<string, T[]>();
  shifts.forEach((shift) => {
    const list = byMember.get(shift.memberId) ?? [];
    list.push(shift);
    byMember.set(shift.memberId, list);
  });

  const selected: T[] = [];
  byMember.forEach((memberShifts) => {
    const sorted = [...memberShifts].sort((a, b) => {
      const aMinutes = timeToMinutes(a.shiftStart);
      const bMinutes = timeToMinutes(b.shiftStart);
      if (aMinutes === bMinutes) {
        return a.shiftName.localeCompare(b.shiftName);
      }
      return aMinutes - bMinutes;
    });
    const first = sorted[0];
    if (first) {
      selected.push(first);
    }
  });
  return selected;
}

function timeToMinutes(value: string) {
  const [hoursPart = "0", minutesPart = "0"] = value.split(":");
  const hours = Number(hoursPart);
  const minutes = Number(minutesPart);
  return hours * 60 + minutes;
}

function computeSessionDuration(logs: DailyLogRow[]) {
  if (!logs.length) {
    return {
      confirmedDurationMinutes: 0,
      pairedSessionCount: 0,
      hasUnpairedIn: false,
      hasUnpairedOut: false,
      hasOpenSession: false,
      openSessionSince: null as Date | null,
    };
  }

  let confirmedDurationMinutes = 0;
  let pairedSessionCount = 0;
  let currentIn: Date | null = null;
  let hasUnpairedIn = false;
  let hasUnpairedOut = false;

  logs.forEach((log) => {
    if (log.entryType === AttendanceType.IN) {
      if (currentIn) {
        hasUnpairedIn = true;
      }
      currentIn = log.recordedAt;
      return;
    }

    if (log.entryType === AttendanceType.OUT) {
      if (!currentIn) {
        hasUnpairedOut = true;
        return;
      }
      confirmedDurationMinutes += Math.max(0, minutesBetween(log.recordedAt, currentIn));
      pairedSessionCount += 1;
      currentIn = null;
    }
  });

  if (currentIn) {
    hasUnpairedIn = true;
  }

  return {
    confirmedDurationMinutes,
    pairedSessionCount,
    hasUnpairedIn,
    hasUnpairedOut,
    hasOpenSession: Boolean(currentIn),
    openSessionSince: currentIn,
  };
}

export const __testing = {
  computeAttendanceMetrics,
  filterLogsForShift,
};
