import { IconChevronDown, IconFileExport } from "@tabler/icons-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { MonthlyTimecardItem } from "../../api/attendanceReports";
import { Button } from "../../components/ui/Button";
import {
  DataTable,
  DataTableBody,
  DataTableCell,
  DataTableEmptyRow,
  DataTableHead,
  DataTableHeaderCell,
  DataTableRow,
  DataTableShell,
  DataTableSkeletonRows,
} from "../../components/ui/DataTable";
import { LocalizedMonthInput } from "../../components/ui/LocalizedMonthInput";
import { PaginationControls } from "../../components/ui/PaginationControls";
import { StatusBadge, type StatusBadgeTone } from "../../components/ui/StatusBadge";
import type { AttendanceEditionReportCopy } from "./attendanceReportCopy";

type Props = {
  copy: AttendanceEditionReportCopy["timecard"];
  items: MonthlyTimecardItem[];
  loading: boolean;
  month: string;
  onMonthChange: (month: string) => void;
  page: number;
  pageInfo: { totalPages: number };
  onPageChange: (page: number) => void;
  canExport: boolean;
  busyExport: "csv" | "xlsx" | "pdf" | null;
  onExport: (format: "csv" | "xlsx" | "pdf") => void;
};

export function MonthlyTimecardTable(props: Props) {
  const { copy, items, loading, month, onMonthChange, page, pageInfo, onPageChange, canExport, busyExport, onExport } = props;
  const { i18n } = useTranslation();

  return (
    <div className="staff-timecard" data-testid="monthly-timecard">
      <div className="staff-timecard-toolbar">
        <label className="staff-timecard-month-field">
          <span>{copy.month}</span>
          <div data-testid="monthly-timecard-month">
            <LocalizedMonthInput
              value={month}
              onChange={onMonthChange}
              locale={i18n.language}
              inputClassName="staff-timecard-month-control"
            />
          </div>
        </label>
        {canExport ? (
          <div className="staff-timecard-export-actions">
            <TimecardExportButton copy={copy.exportCsv} format="csv" busyExport={busyExport} loadingLabel={copy.loading} onExport={onExport} />
            <TimecardExportButton copy={copy.exportXlsx} format="xlsx" busyExport={busyExport} loadingLabel={copy.loading} onExport={onExport} />
            <TimecardExportButton copy={copy.exportPdf} format="pdf" busyExport={busyExport} loadingLabel={copy.loading} onExport={onExport} />
          </div>
        ) : null}
      </div>

      <DataTableShell className="staff-timecard-table-shell" data-testid="monthly-timecard-table">
        <DataTable minWidth="90rem" variant="report">
          <DataTableHead>
            <DataTableRow>
              {[
                copy.employee,
                copy.group,
                copy.scheduled,
                copy.actual,
                copy.sessions,
                copy.present,
                copy.absent,
                copy.justified,
                copy.late,
                copy.earlyLeave,
                copy.overtime,
                copy.missing,
                copy.invalid,
              ].map((label) => <DataTableHeaderCell key={label}>{label}</DataTableHeaderCell>)}
            </DataTableRow>
          </DataTableHead>
          <DataTableBody>
            {loading ? (
              <DataTableSkeletonRows columns={13} rows={5} />
            ) : items.length === 0 ? (
              <DataTableEmptyRow colSpan={13}>{copy.noRows}</DataTableEmptyRow>
            ) : (
              items.map((item) => <TimecardRow copy={copy} item={item} key={item.memberId} />)
            )}
          </DataTableBody>
        </DataTable>
      </DataTableShell>

      <PaginationControls
        buttonVariant="text"
        disabled={loading}
        nextLabel={copy.next}
        onPageChange={onPageChange}
        page={page}
        previousLabel={copy.previous}
        totalPages={pageInfo.totalPages}
      />
    </div>
  );
}

function TimecardExportButton({ copy, format, busyExport, loadingLabel, onExport }: {
  copy: string;
  format: "csv" | "xlsx" | "pdf";
  busyExport: Props["busyExport"];
  loadingLabel: string;
  onExport: Props["onExport"];
}) {
  return (
    <Button
      data-testid={`timecard-export-${format}`}
      disabled={busyExport !== null}
      loading={busyExport === format}
      loadingLabel={loadingLabel}
      onClick={() => onExport(format)}
      size="sm"
      startIcon={<IconFileExport className="h-4 w-4" stroke={1.8} />}
      variant="secondary"
    >
      {copy}
    </Button>
  );
}

function TimecardRow({ copy, item }: { copy: Props["copy"]; item: MonthlyTimecardItem }) {
  const total = item.totals;
  const [expanded, setExpanded] = useState(false);

  return (
    <>
      <DataTableRow data-testid="monthly-timecard-row">
        <DataTableCell className="staff-timecard-employee-cell">
          <button
            aria-expanded={expanded}
            className="staff-timecard-employee-summary"
            data-testid="monthly-timecard-expand"
            onClick={() => setExpanded((current) => !current)}
            type="button"
          >
            <span className="staff-timecard-employee-name">{item.memberName} <span>#{item.memberCode}</span></span>
            <IconChevronDown className={expanded ? "is-expanded" : undefined} stroke={1.8} />
          </button>
        </DataTableCell>
        <DataTableCell>{item.staffGroupName || "—"}</DataTableCell>
        <Metric value={minutes(total.scheduledMinutes, copy)} />
        <Metric value={minutes(total.actualMinutes, copy)} />
        <Metric value={total.pairedSessionCount} />
        <Metric value={total.presentDays} />
        <Metric value={total.absentDays} />
        <Metric value={total.justifiedDays} />
        <Metric value={minutes(total.lateMinutes, copy)} />
        <Metric value={minutes(total.earlyLeaveMinutes, copy)} />
        <Metric value={minutes(total.overtimeMinutes, copy)} />
        <Metric value={total.missingPunchDays} />
        <Metric value={total.invalidPunchDays} />
      </DataTableRow>
      {expanded ? (
        <DataTableRow className="staff-timecard-details-row" data-testid="monthly-timecard-details">
          <DataTableCell colSpan={13}>
          <div className="staff-timecard-days">
            <div className="staff-timecard-days__title">{copy.dailyDetails}</div>
            {item.days.map((day) => (
              <div className="staff-timecard-day" key={day.date}>
                <span className="staff-timecard-day__date">{day.date}</span>
                <StatusBadge tone={statusTone(day.status)}>{copy.statuses[day.status]}</StatusBadge>
                <span>{day.shiftName || "—"}</span>
                <span>{copy.scheduled}: {minutes(day.scheduledMinutes, copy)}</span>
                <span>{copy.actual}: {minutes(day.actualMinutes, copy)}</span>
                <span>{copy.sessions}: {day.pairedSessionCount}</span>
                <span className="staff-timecard-day__warning">{day.missingPunch ? copy.missing : day.invalidPunch ? copy.invalid : ""}</span>
              </div>
            ))}
          </div>
          </DataTableCell>
        </DataTableRow>
      ) : null}
    </>
  );
}

function Metric({ value }: { value: string | number }) {
  return <DataTableCell className="staff-timecard-metric">{value}</DataTableCell>;
}

function statusTone(status: MonthlyTimecardItem["days"][number]["status"]): StatusBadgeTone {
  if (status === "ABSENT") return "danger";
  if (status === "LATE") return "warning";
  if (status === "PRESENT") return "success";
  if (status === "INSIDE") return "info";
  return "brand";
}

function minutes(value: number, copy: Props["copy"]) {
  return `${Math.floor(value / 60)}${copy.hoursShort} ${value % 60}${copy.minutesShort}`;
}
