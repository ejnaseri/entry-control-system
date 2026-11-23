import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import type { AttendanceReportMembersSortBy } from "../../../api/reportsAttendance";
import { DropdownSelect } from "../../../components/ui/DropdownSelect";
import { getEmployeeCopy } from "../../employees/employeeCopy";
import type { MemberItem } from "./types";
import { TablePager } from "./TablePager";
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
} from "../../../components/ui/DataTable";

const LATE_MIN_WARNING_THRESHOLD = 30;

type Props = {
  items: MemberItem[];
  loading: boolean;
  page: number;
  pageInfo: { page: number; pageSize: number; totalItems: number; totalPages: number };
  onPageChange: (page: number) => void;
  sortBy: AttendanceReportMembersSortBy;
  sortDir: "asc" | "desc";
  onSortByChange: (value: AttendanceReportMembersSortBy) => void;
  onSortDirToggle: () => void;
  onlyAnomalies: boolean;
  onToggleOnlyAnomalies: () => void;
  onSelectMember?: (item: MemberItem) => void;
  staffOnly?: boolean;
};

export function MembersTable({
  items,
  loading,
  page,
  pageInfo,
  onPageChange,
  sortBy,
  sortDir,
  onSortByChange,
  onSortDirToggle,
  onlyAnomalies,
  onToggleOnlyAnomalies,
  onSelectMember,
  staffOnly = false,
}: Props) {
  const { t, i18n } = useTranslation();
  const employeeCopy = getEmployeeCopy(i18n.language);
  const minuteShort = t("attendanceReport.common.minuteShort");

  return (
    <section className="space-y-2.5">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{staffOnly ? employeeCopy.employees : t("attendanceReport.members.title")}</h3>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">{staffOnly ? employeeCopy.employeeOnly : t("attendanceReport.members.subtitle")}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <DropdownSelect
            buttonClassName="h-8 rounded-lg border border-slate-300 bg-white px-2.5 text-[11px] text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/30 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
            value={sortBy}
            onChange={(value) => onSortByChange(value as AttendanceReportMembersSortBy)}
            options={[
              { value: "memberName", label: t("attendanceReport.members.memberNameSort") },
              { value: "lateMinutes", label: t("attendanceReport.members.lateMinutesSort") },
              { value: "absentDays", label: t("attendanceReport.members.absentDaysSort") },
              { value: "deniedCount", label: t("attendanceReport.members.deniedAttemptsSort") },
              { value: "noCheckoutCount", label: t("attendanceReport.members.noCheckoutCountSort") },
            ]}
          />
          <button
            type="button"
            onClick={onSortDirToggle}
            className="h-8 rounded-lg border border-slate-300 bg-white px-2.5 text-[11px] font-semibold text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/30 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
          >
            {sortDir === "asc" ? t("attendanceReport.members.asc") : t("attendanceReport.members.desc")}
          </button>
          <button
            type="button"
            onClick={onToggleOnlyAnomalies}
            className={`h-8 rounded-lg border px-2.5 text-[11px] font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/30 ${
              onlyAnomalies
                ? "border-rose-300 bg-rose-100 text-rose-700 dark:border-rose-800 dark:bg-rose-900/30 dark:text-rose-200"
                : "border-slate-300 bg-white text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
            }`}
          >
            {onlyAnomalies ? t("attendanceReport.members.showingAnomaliesOnly") : t("attendanceReport.members.showOnlyAnomalies")}
          </button>
        </div>
      </header>

      <DataTableShell>
        <DataTable variant="report" minWidth="980px">
          <DataTableHead>
            <DataTableRow>
              <DataTableHeaderCell>{t("attendanceReport.members.member")}</DataTableHeaderCell>
              {!staffOnly && <DataTableHeaderCell>{t("attendanceReport.members.type")}</DataTableHeaderCell>}
              <DataTableHeaderCell align="end">{t("attendanceReport.members.expected")}</DataTableHeaderCell>
              <DataTableHeaderCell align="end">{t("attendanceReport.members.present")}</DataTableHeaderCell>
              <DataTableHeaderCell align="end">{t("attendanceReport.members.absent")}</DataTableHeaderCell>
              <DataTableHeaderCell align="end">{t("attendanceReport.members.lateMin")}</DataTableHeaderCell>
              <DataTableHeaderCell align="end">{t("attendanceReport.members.denied")}</DataTableHeaderCell>
              <DataTableHeaderCell align="end">{t("attendanceReport.members.noCheckout")}</DataTableHeaderCell>
              <DataTableHeaderCell>{t("attendanceReport.members.status")}</DataTableHeaderCell>
            </DataTableRow>
          </DataTableHead>
          <DataTableBody>
            {loading ? (
              <DataTableSkeletonRows columns={staffOnly ? 8 : 9} rows={8} />
            ) : items.length === 0 ? (
              <DataTableEmptyRow colSpan={staffOnly ? 8 : 9}>{t("attendanceReport.members.empty")}</DataTableEmptyRow>
            ) : (
              items.map((item) => {
                const risk = item.deniedCount > 0 || item.noCheckoutCount > 0;
                const warning = item.absentDays > 0 || item.lateMinutes > LATE_MIN_WARNING_THRESHOLD;
                return (
                  <DataTableRow
                    key={item.memberId}
                    clickable={Boolean(onSelectMember)}
                    onClick={onSelectMember ? () => onSelectMember(item) : undefined}
                    onKeyDown={onSelectMember ? (event) => { if (event.key === "Enter") onSelectMember(item); } : undefined}
                    tabIndex={onSelectMember ? 0 : undefined}
                  >
                    <DataTableCell>
                      <p className="font-semibold text-slate-900 dark:text-slate-100">{item.memberName}</p>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400">#{item.memberCode}</p>
                    </DataTableCell>
                    {!staffOnly && <DataTableCell>{item.memberType === "STAFF" ? t("attendanceReport.members.staff") : t("attendanceReport.members.customer")}</DataTableCell>}
                    <DataTableCell align="end">{formatNumber(item.expectedShifts, i18n.language)}</DataTableCell>
                    <DataTableCell align="end">{formatNumber(item.presentDays, i18n.language)}</DataTableCell>
                    <DataTableCell align="end">{formatNumber(item.absentDays, i18n.language)}</DataTableCell>
                    <DataTableCell align="end">
                      {item.lateMinutes > LATE_MIN_WARNING_THRESHOLD ? <Chip tone="warning">{formatMinutes(item.lateMinutes, i18n.language, minuteShort)}</Chip> : formatMinutes(item.lateMinutes, i18n.language, minuteShort)}
                    </DataTableCell>
                    <DataTableCell align="end">{item.deniedCount > 0 ? <Chip tone="risk">{formatNumber(item.deniedCount, i18n.language)}</Chip> : 0}</DataTableCell>
                    <DataTableCell align="end">{item.noCheckoutCount > 0 ? <Chip tone="risk">{formatNumber(item.noCheckoutCount, i18n.language)}</Chip> : 0}</DataTableCell>
                    <DataTableCell>
                      {risk ? <Chip tone="risk">{t("attendanceReport.members.statusRisk")}</Chip> : warning ? <Chip tone="warning">{t("attendanceReport.members.statusWatch")}</Chip> : <Chip tone="good">{t("attendanceReport.members.statusHealthy")}</Chip>}
                    </DataTableCell>
                  </DataTableRow>
                );
              })
            )}
          </DataTableBody>
        </DataTable>
      </DataTableShell>

      <TablePager pageInfo={pageInfo} page={page} onPageChange={onPageChange} />
    </section>
  );
}

function Chip({ children, tone }: { children: ReactNode; tone: "risk" | "warning" | "good" }) {
  const classes =
    tone === "risk"
      ? "border-rose-300 bg-rose-100 text-rose-700 dark:border-rose-800 dark:bg-rose-900/30 dark:text-rose-200"
      : tone === "warning"
        ? "border-amber-300 bg-amber-100 text-amber-700 dark:border-amber-800 dark:bg-amber-900/30 dark:text-amber-200"
        : "border-emerald-300 bg-emerald-100 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-200";
  return <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${classes}`}>{children}</span>;
}

function formatNumber(value: number, locale = "en") {
  return new Intl.NumberFormat(locale).format(value);
}

function formatMinutes(value: number, locale = "en", minuteShort = "m") {
  return `${formatNumber(value, locale)}${minuteShort}`;
}
