import { prisma } from "../../lib/prisma";
import { ATTENDANCE_DATA_SCOPES, buildStrictStaffMemberWhere } from "../attendance/attendance-edition-scope";
import {
  getAttendanceReportDaily,
  getAttendanceReportEvidence,
  getAuditedAttendanceReportExport,
  getAttendanceReportMembers,
  getAttendanceReportSummary,
  type AttendanceReportExportContext,
} from "./reports-attendance.service";
import type {
  AttendanceEditionReportCsvExportQuery,
  AttendanceEditionReportDailyQuery,
  AttendanceEditionReportEvidenceQuery,
  AttendanceEditionReportExportQuery,
  AttendanceEditionReportMembersQuery,
  AttendanceEditionReportSummaryQuery,
} from "./attendance-report.schemas";

const STRICT_STAFF = ATTENDANCE_DATA_SCOPES.STRICT_STAFF;

export type AttendanceReportOptions = Readonly<{
  employees: readonly Readonly<{ id: string; code: string; name: string }>[];
  groups: readonly Readonly<{ id: string; name: string }>[];
  shifts: readonly Readonly<{ id: string; name: string; start: string; end: string }>[];
  devices: readonly Readonly<{ id: string; name: string }>[];
}>;

type OptionsDatabase = Pick<typeof prisma, "member" | "memberShift" | "device">;

export function createAttendanceReportOptionsLoader(database: OptionsDatabase = prisma) {
  return async (): Promise<AttendanceReportOptions> => {
    const staffWhere = {
      ...buildStrictStaffMemberWhere(),
      archivedAt: null,
    };
    const [employees, shiftRows, devices] = await Promise.all([
      database.member.findMany({
        where: staffWhere,
        orderBy: [{ firstName: "asc" }, { lastName: "asc" }, { code: "asc" }],
        select: {
          id: true,
          code: true,
          firstName: true,
          lastName: true,
          staffGroup: { select: { id: true, name: true } },
        },
      }),
      database.memberShift.findMany({
        where: {
          isActive: true,
          shiftId: { not: null },
          member: staffWhere,
        },
        orderBy: [{ shiftName: "asc" }, { shiftStart: "asc" }],
        select: {
          shiftId: true,
          shiftName: true,
          shiftStart: true,
          shiftEnd: true,
        },
      }),
      database.device.findMany({
        orderBy: { name: "asc" },
        select: { id: true, name: true },
      }),
    ]);

    const groups = new Map<string, { id: string; name: string }>();
    for (const employee of employees) {
      if (employee.staffGroup) groups.set(employee.staffGroup.id, employee.staffGroup);
    }
    const shifts = new Map<string, { id: string; name: string; start: string; end: string }>();
    for (const shift of shiftRows) {
      if (!shift.shiftId || shifts.has(shift.shiftId)) continue;
      shifts.set(shift.shiftId, {
        id: shift.shiftId,
        name: shift.shiftName,
        start: shift.shiftStart,
        end: shift.shiftEnd,
      });
    }

    return Object.freeze({
      employees: Object.freeze(employees.map((employee) => Object.freeze({
        id: employee.id,
        code: employee.code,
        name: `${employee.firstName} ${employee.lastName ?? ""}`.trim(),
      }))),
      groups: Object.freeze([...groups.values()].sort((left, right) => left.name.localeCompare(right.name))),
      shifts: Object.freeze([...shifts.values()]),
      devices: Object.freeze(devices.map((device) => Object.freeze(device))),
    });
  };
}

export const getAttendanceReportOptions = createAttendanceReportOptionsLoader();

export const getAttendanceEditionReportSummary = (query: AttendanceEditionReportSummaryQuery) =>
  getAttendanceReportSummary(query, STRICT_STAFF);

export const getAttendanceEditionReportDaily = (query: AttendanceEditionReportDailyQuery) =>
  getAttendanceReportDaily(query, STRICT_STAFF);

export const getAttendanceEditionReportMembers = (query: AttendanceEditionReportMembersQuery) =>
  getAttendanceReportMembers(query, STRICT_STAFF);

export const getAttendanceEditionReportEvidence = (query: AttendanceEditionReportEvidenceQuery) =>
  getAttendanceReportEvidence(query, STRICT_STAFF);

export const getAttendanceEditionReportExport = (
  query: AttendanceEditionReportExportQuery | AttendanceEditionReportCsvExportQuery,
  format: "CSV" | "XLSX" | "PDF",
  context: AttendanceReportExportContext
) => getAuditedAttendanceReportExport(query, format, context, STRICT_STAFF);
