import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import type { DailyItem } from "./types";
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

const LATE_WARNING_THRESHOLD = 15;

type Props = {
  items: DailyItem[];
  loading: boolean;
  page: number;
  pageInfo: { page: number; pageSize: number; totalItems: number; totalPages: number };
  onPageChange: (page: number) => void;
  onlyAnomalies: boolean;
  onToggleOnlyAnomalies: () => void;
  onSelectDay?: (item: DailyItem) => void;
};

export function DailySummaryTable({
  items,
  loading,
  page,
  pageInfo,
  onPageChange,
  onlyAnomalies,
  onToggleOnlyAnomalies,
  onSelectDay,
}: Props) {
  const { t, i18n } = useTranslation();
  const minuteShort = t("attendanceReport.common.minuteShort");

  return (
    <section className="space-y-2.5">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{t("attendanceReport.daily.title")}</h3>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">{t("attendanceReport.daily.subtitle")}</p>
        </div>
        <button
          type="button"
          onClick={onToggleOnlyAnomalies}
          className={`rounded-lg border px-2.5 py-1 text-[11px] font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/30 ${
            onlyAnomalies
              ? "border-rose-300 bg-rose-100 text-rose-700 dark:border-rose-800 dark:bg-rose-900/30 dark:text-rose-200"
              : "border-slate-300 bg-white text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
          }`}
        >
          {onlyAnomalies ? t("attendanceReport.daily.showingAnomaliesOnly") : t("attendanceReport.daily.showOnlyAnomalies")}
        </button>
      </header>

      <DataTableShell>
        <DataTable variant="report" minWidth="980px">
          <DataTableHead>
            <DataTableRow>
              <DataTableHeaderCell>{t("attendanceReport.daily.date")}</DataTableHeaderCell>
              <DataTableHeaderCell align="end">{t("attendanceReport.daily.present")}</DataTableHeaderCell>
              <DataTableHeaderCell align="end">{t("attendanceReport.daily.absent")}</DataTableHeaderCell>
              <DataTableHeaderCell align="end">{t("attendanceReport.daily.late")}</DataTableHeaderCell>
              <DataTableHeaderCell align="end">{t("attendanceReport.daily.lateMin")}</DataTableHeaderCell>
              <DataTableHeaderCell align="end">{t("attendanceReport.daily.earlyLeave")}</DataTableHeaderCell>
              <DataTableHeaderCell align="end">{t("attendanceReport.daily.overtime")}</DataTableHeaderCell>
              <DataTableHeaderCell align="end">{t("attendanceReport.daily.denied")}</DataTableHeaderCell>
              <DataTableHeaderCell align="end">{t("attendanceReport.daily.noCheckout")}</DataTableHeaderCell>
              <DataTableHeaderCell>{t("attendanceReport.daily.status")}</DataTableHeaderCell>
            </DataTableRow>
          </DataTableHead>
          <DataTableBody>
            {loading ? (
              <DataTableSkeletonRows columns={10} rows={8} />
            ) : items.length === 0 ? (
              <DataTableEmptyRow colSpan={10}>{t("attendanceReport.daily.empty")}</DataTableEmptyRow>
            ) : (
              items.map((item) => {
                const risk = item.deniedCount > 0 || item.noCheckoutCount > 0;
                const warning = item.absentCount > 0 || item.lateCount > 0 || item.earlyLeaveCount > 0;

                return (
                  <DataTableRow
                    key={item.date}
                    clickable={Boolean(onSelectDay)}
                    onClick={onSelectDay ? () => onSelectDay(item) : undefined}
                    onKeyDown={onSelectDay ? (event) => { if (event.key === "Enter") onSelectDay(item); } : undefined}
                    tabIndex={onSelectDay ? 0 : undefined}
                  >
                    <DataTableCell className="font-medium text-slate-800 dark:text-slate-100">{item.date}</DataTableCell>
                    <DataTableCell align="end">{formatNumber(item.presentCount, i18n.language)}</DataTableCell>
                    <DataTableCell align="end">{formatNumber(item.absentCount, i18n.language)}</DataTableCell>
                    <DataTableCell align="end">{formatNumber(item.lateCount, i18n.language)}</DataTableCell>
                    <DataTableCell align="end">
                      {item.lateMinutes > LATE_WARNING_THRESHOLD ? <Chip tone="warning">{formatMinutes(item.lateMinutes, i18n.language, minuteShort)}</Chip> : formatMinutes(item.lateMinutes, i18n.language, minuteShort)}
                    </DataTableCell>
                    <DataTableCell align="end">{formatNumber(item.earlyLeaveCount, i18n.language)}</DataTableCell>
                    <DataTableCell align="end">{formatMinutes(item.overtimeMinutes, i18n.language, minuteShort)}</DataTableCell>
                    <DataTableCell align="end">{item.deniedCount > 0 ? <Chip tone="risk">{formatNumber(item.deniedCount, i18n.language)}</Chip> : 0}</DataTableCell>
                    <DataTableCell align="end">{item.noCheckoutCount > 0 ? <Chip tone="risk">{formatNumber(item.noCheckoutCount, i18n.language)}</Chip> : 0}</DataTableCell>
                    <DataTableCell>
                      {risk ? <Chip tone="risk">{t("attendanceReport.daily.statusRisk")}</Chip> : warning ? <Chip tone="warning">{t("attendanceReport.daily.statusWarning")}</Chip> : <Chip tone="good">{t("attendanceReport.daily.statusHealthy")}</Chip>}
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
