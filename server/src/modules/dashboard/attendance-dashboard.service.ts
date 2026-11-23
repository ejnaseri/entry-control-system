import { AttendanceSource, DeviceStatus, MemberStatus } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { ATTENDANCE_DATA_SCOPES, buildStrictStaffMemberWhere } from "../attendance/attendance-edition-scope";
import { listDailyAttendance } from "../attendance/attendance.service";

type DailyAttendance = Awaited<ReturnType<typeof listDailyAttendance>>;

export type AttendanceDashboardDevice = Readonly<{
  id: string;
  name: string;
  enabled: boolean;
  status: DeviceStatus;
  lastSuccessfulPollAt: Date | null;
  lastEventReceivedAt: Date | null;
}>;

export type AttendanceDashboardDataSource = Readonly<{
  countActiveEmployees(): Promise<number>;
  listActiveEmployees(limit: number): Promise<AttendanceDashboardActiveEmployee[]>;
  getDaily(date: string): Promise<DailyAttendance>;
  countPunches(start: Date, end: Date): Promise<number>;
  countUnknownIds(start: Date, end: Date): Promise<number>;
  listDevices(): Promise<AttendanceDashboardDevice[]>;
}>;

export type AttendanceDashboardDetailType = "active-employees" | "present" | "inside-now" | "late" | "absent";

export type AttendanceDashboardActiveEmployee = Readonly<{
  id: string;
  code: string;
  firstName: string;
  lastName: string | null;
  phone: string | null;
  roleType: string | null;
  customTitle: string | null;
  staffGroup: Readonly<{ name: string }> | null;
  shifts: readonly Readonly<{ shiftName: string; shiftStart: string; shiftEnd: string }>[];
}>;

export type AttendanceDashboardDetailItem = Readonly<{
  memberId: string;
  memberCode: string;
  memberName: string;
  memberPhone: string | null;
  staffGroupName: string | null;
  shiftName: string | null;
  shiftTime: string | null;
  role: string | null;
  checkInAt: string | null;
  checkOutAt: string | null;
  status: "ACTIVE" | "PRESENT" | "INSIDE" | "LATE" | "ABSENT";
  lateMinutes: number | null;
}>;

export type AttendanceDashboardDetails = Readonly<{
  type: AttendanceDashboardDetailType;
  date: string;
  total: number;
  items: readonly AttendanceDashboardDetailItem[];
}>;

export type AttendanceDashboardSummary = Readonly<{
  date: string;
  generatedAt: string;
  employees: Readonly<{ active: number; scheduledToday: number }>;
  attendance: Readonly<{
    present: number;
    onTime: number;
    late: number;
    absent: number;
    justified: number;
    insideNow: number;
    openSessions: number;
  }>;
  warnings: Readonly<{ missingCheckout: number; multipleEvents: number; noShift: number }>;
  punches: Readonly<{ total: number; denied: number; unknownIds: number }>;
  devices: Readonly<{
    total: number;
    enabled: number;
    online: number;
    offline: number;
    lastSyncAt: string | null;
    lastEventAt: string | null;
  }>;
  trend: readonly Readonly<{
    date: string;
    scheduled: number;
    present: number;
    late: number;
    absent: number;
    justified: number;
    exceptions: number;
  }>[];
}>;

type DashboardDatabase = Pick<typeof prisma, "member" | "attendanceLog" | "deviceRawLog" | "device">;

export function createAttendanceDashboardDataSource(
  database: DashboardDatabase = prisma,
  dailyLoader: typeof listDailyAttendance = listDailyAttendance
): AttendanceDashboardDataSource {
  const strictStaff = buildStrictStaffMemberWhere();

  return Object.freeze({
    countActiveEmployees: () => database.member.count({
      where: { ...strictStaff, status: MemberStatus.ACTIVE, archivedAt: null },
    }),
    listActiveEmployees: (limit) => database.member.findMany({
      where: { ...strictStaff, status: MemberStatus.ACTIVE, archivedAt: null },
      orderBy: [{ firstName: "asc" }, { lastName: "asc" }, { code: "asc" }],
      take: limit,
      select: {
        id: true,
        code: true,
        firstName: true,
        lastName: true,
        phone: true,
        roleType: true,
        customTitle: true,
        staffGroup: { select: { name: true } },
        shifts: {
          where: { isActive: true },
          orderBy: { shiftStart: "asc" },
          take: 1,
          select: { shiftName: true, shiftStart: true, shiftEnd: true },
        },
      },
    }),
    getDaily: (date) => dailyLoader({ date, mode: "primary" }, ATTENDANCE_DATA_SCOPES.STRICT_STAFF),
    countPunches: (start, end) => database.attendanceLog.count({
      where: {
        recordedAt: { gte: start, lt: end },
        OR: [
          { member: { ...strictStaff, archivedAt: null } },
          { memberId: null, source: AttendanceSource.DEVICE },
        ],
      },
    }),
    countUnknownIds: (start, end) => database.deviceRawLog.count({
      where: {
        recordedAt: { gte: start, lt: end },
        processError: "DEVICE_USER_NOT_FOUND",
      },
    }),
    listDevices: () => database.device.findMany({
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        enabled: true,
        status: true,
        lastSuccessfulPollAt: true,
        lastEventReceivedAt: true,
      },
    }),
  });
}

export async function getAttendanceDashboardDetails(
  type: AttendanceDashboardDetailType,
  limit = 100,
  now = new Date(),
  dataSource: AttendanceDashboardDataSource = defaultDataSource
): Promise<AttendanceDashboardDetails> {
  const date = formatDateKey(startOfDay(now));

  if (type === "active-employees") {
    const [total, employees] = await Promise.all([
      dataSource.countActiveEmployees(),
      dataSource.listActiveEmployees(limit),
    ]);
    return Object.freeze({
      type,
      date,
      total,
      items: Object.freeze(employees.map((employee) => {
        const shift = employee.shifts[0] ?? null;
        return Object.freeze({
          memberId: employee.id,
          memberCode: employee.code,
          memberName: `${employee.firstName} ${employee.lastName ?? ""}`.trim(),
          memberPhone: employee.phone,
          staffGroupName: employee.staffGroup?.name ?? null,
          shiftName: shift?.shiftName ?? null,
          shiftTime: shift ? `${shift.shiftStart}–${shift.shiftEnd}` : null,
          role: employee.customTitle ?? employee.roleType,
          checkInAt: null,
          checkOutAt: null,
          status: "ACTIVE" as const,
          lateMinutes: null,
        });
      })),
    });
  }

  const daily = await dataSource.getDaily(date);
  const matchingRows = daily.rows.filter((row) => {
    if (type === "present") return row.checkInAt != null;
    if (type === "inside-now") return row.hasOpenSession;
    if (type === "late") return row.hasShift && row.checkInAt != null && (row.lateMinutes ?? 0) > 0;
    return row.hasShift && row.checkInAt == null && !row.isJustified;
  });

  return Object.freeze({
    type,
    date,
    total: matchingRows.length,
    items: Object.freeze(matchingRows.slice(0, limit).map((row) => Object.freeze({
      memberId: row.memberId,
      memberCode: row.memberCode,
      memberName: row.memberFullName,
      memberPhone: row.memberPhone ?? null,
      staffGroupName: row.staffGroupName ?? null,
      shiftName: row.shiftName || null,
      shiftTime: row.shiftStart && row.shiftEnd ? `${row.shiftStart}–${row.shiftEnd}` : null,
      role: null,
      checkInAt: row.checkInAt?.toISOString() ?? null,
      checkOutAt: row.checkOutAt?.toISOString() ?? null,
      status: type === "inside-now" ? "INSIDE" as const : type === "late" ? "LATE" as const : type === "absent" ? "ABSENT" as const : "PRESENT" as const,
      lateMinutes: row.lateMinutes ?? null,
    }))),
  });
}

const defaultDataSource = createAttendanceDashboardDataSource();

export async function getAttendanceDashboardSummary(
  now = new Date(),
  dataSource: AttendanceDashboardDataSource = defaultDataSource
): Promise<AttendanceDashboardSummary> {
  const todayStart = startOfDay(now);
  const tomorrowStart = addDays(todayStart, 1);
  const todayKey = formatDateKey(todayStart);
  const trendDates = Array.from({ length: 7 }, (_, index) => formatDateKey(addDays(todayStart, index - 6)));

  const [activeEmployees, today, punches, unknownIds, devices] = await Promise.all([
    dataSource.countActiveEmployees(),
    dataSource.getDaily(todayKey),
    dataSource.countPunches(todayStart, tomorrowStart),
    dataSource.countUnknownIds(todayStart, tomorrowStart),
    dataSource.listDevices(),
  ]);

  const dailySnapshots = await Promise.all(
    trendDates.map((date) => date === todayKey ? Promise.resolve(today) : dataSource.getDaily(date))
  );
  const todayMetrics = summarizeDaily(today);
  const enabledDevices = devices.filter((device) => device.enabled);

  return Object.freeze({
    date: todayKey,
    generatedAt: now.toISOString(),
    employees: Object.freeze({ active: activeEmployees, scheduledToday: todayMetrics.scheduled }),
    attendance: Object.freeze({
      present: todayMetrics.present,
      onTime: todayMetrics.onTime,
      late: todayMetrics.late,
      absent: todayMetrics.absent,
      justified: todayMetrics.justified,
      insideNow: todayMetrics.inside,
      openSessions: todayMetrics.openSessions,
    }),
    warnings: Object.freeze({
      missingCheckout: today.warnings.noCheckout,
      multipleEvents: today.warnings.multipleEvents,
      noShift: today.warnings.noShift,
    }),
    punches: Object.freeze({ total: punches, denied: today.summary.deniedCount, unknownIds }),
    devices: Object.freeze({
      total: devices.length,
      enabled: enabledDevices.length,
      online: enabledDevices.filter((device) => device.status === DeviceStatus.ONLINE).length,
      offline: enabledDevices.filter((device) => device.status !== DeviceStatus.ONLINE).length,
      lastSyncAt: latestDate(devices.map((device) => device.lastSuccessfulPollAt)),
      lastEventAt: latestDate(devices.map((device) => device.lastEventReceivedAt)),
    }),
    trend: Object.freeze(dailySnapshots.map((snapshot, index) => {
      const metrics = summarizeDaily(snapshot);
      return Object.freeze({
        date: trendDates[index]!,
        scheduled: metrics.scheduled,
        present: metrics.present,
        late: metrics.late,
        absent: metrics.absent,
        justified: metrics.justified,
        exceptions:
          snapshot.warnings.noCheckout
          + snapshot.warnings.multipleEvents
          + snapshot.warnings.noShift
          + snapshot.summary.deniedCount,
      });
    })),
  });
}

function summarizeDaily(daily: DailyAttendance) {
  const scheduledRows = daily.rows.filter((row) => row.hasShift);
  const presentRows = daily.rows.filter((row) => row.checkInAt != null);
  const scheduledPresentRows = scheduledRows.filter((row) => row.checkInAt != null);
  const lateRows = scheduledPresentRows.filter((row) => (row.lateMinutes ?? 0) > 0);
  const justifiedRows = scheduledRows.filter((row) => row.checkInAt == null && row.isJustified);
  const absentRows = scheduledRows.filter((row) => row.checkInAt == null && !row.isJustified);
  const openRows = presentRows.filter((row) => row.hasOpenSession);

  return {
    scheduled: scheduledRows.length,
    present: presentRows.length,
    onTime: scheduledPresentRows.length - lateRows.length,
    late: lateRows.length,
    absent: absentRows.length,
    justified: justifiedRows.length,
    inside: openRows.length,
    openSessions: openRows.length,
  };
}

function startOfDay(date: Date) {
  const value = new Date(date);
  value.setHours(0, 0, 0, 0);
  return value;
}

function addDays(date: Date, days: number) {
  const value = new Date(date);
  value.setDate(value.getDate() + days);
  return value;
}

function formatDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function latestDate(values: readonly (Date | null)[]) {
  const timestamps = values.filter((value): value is Date => value instanceof Date).map((value) => value.getTime());
  return timestamps.length > 0 ? new Date(Math.max(...timestamps)).toISOString() : null;
}

export const attendanceDashboardTestHooks = Object.freeze({ summarizeDaily });
