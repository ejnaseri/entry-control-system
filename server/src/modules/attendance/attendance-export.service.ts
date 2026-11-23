import type { Prisma } from "@prisma/client";
import type { AttendanceDataScope } from "./attendance-edition-scope";
import type { AttendanceEntryLogsExportQuery } from "./attendance.schemas";
import { exportAttendanceEntryLogs } from "./attendance.service";
import {
  generateAuditedReportExport,
  toSafeReportExportFilters,
  type ReportExportContext,
} from "../reports/shared/report-export.audit";

export function createAuditedAttendanceEntryLogsExporter(
  generate = exportAttendanceEntryLogs,
  audit = generateAuditedReportExport
) {
  return async (
    query: AttendanceEntryLogsExportQuery,
    format: "CSV" | "XLSX",
    scope: AttendanceDataScope,
    context: ReportExportContext
  ) => audit({
    context,
    action: "report.entry_logs.exported",
    targetType: "EntryLogsReport",
    targetId: "entry-logs-report",
    format,
    filters: {
      ...toSafeReportExportFilters(query as unknown as Record<string, unknown>),
      memberType: "staff",
      language: query.lang,
      generation: "SERVER",
    } satisfies Prisma.InputJsonObject,
    generate: async () => {
      const file = await generate(query, format, scope);
      return { ...file, body: file.buffer };
    },
  });
}

export const exportAuditedAttendanceEntryLogs = createAuditedAttendanceEntryLogsExporter();
