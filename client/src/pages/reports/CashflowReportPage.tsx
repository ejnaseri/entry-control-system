import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { IconFileExport, IconFileSpreadsheet } from "@tabler/icons-react";
import {
  downloadCashflowCsv,
  downloadCashflowXlsx,
  getCashflowReport,
  type CashflowGroupBy,
  type CashflowQuery,
  type CashflowReportResponse,
} from "../../api/cashflowReport";
import {
  ReportFiltersPanel,
  REPORT_FILTER_ACTION_CLASS,
  REPORT_FILTER_FIELD_CLASS,
  REPORT_FILTER_LABEL_CLASS,
  REPORT_FILTER_PANEL_CLASS,
} from "../../components/reports/ReportFiltersPanel";
import { useToast } from "../../components/ToastContext";
import { useGlobalLoading } from "../../components/GlobalLoadingContext";
import { DropdownSelect } from "../../components/ui/DropdownSelect";
import { ShamsiDateInput } from "../../components/ui/ShamsiDateInput";
import {
  DataTable,
  DataTableBody,
  DataTableCell,
  DataTableEmptyRow,
  DataTableHead,
  DataTableHeaderCell,
  DataTableRow,
  DataTableShell,
} from "../../components/ui/DataTable";

type Filters = {
  from: string;
  to: string;
  groupBy: CashflowGroupBy;
  includePayroll: boolean;
};

const CARD_CLASS = "rounded-2xl border border-slate-200/80 bg-white/90 p-3 shadow-sm dark:border-slate-800/80 dark:bg-slate-950/70";
const FILTER_CARD_CLASS = REPORT_FILTER_PANEL_CLASS;
const INPUT_CLASS = REPORT_FILTER_FIELD_CLASS;
const LABEL_CLASS = REPORT_FILTER_LABEL_CLASS;

const EMPTY_REPORT: CashflowReportResponse = {
  generatedAt: new Date(0).toISOString(),
  filters: {
    from: dateInput(new Date()),
    to: dateInput(new Date()),
    groupBy: "day",
    includePayroll: true,
  },
  summary: {
    membershipInflow: 0,
    membershipRefunds: 0,
    membershipNet: 0,
    expenseGrossOutflow: 0,
    expenseAdjustments: 0,
    expenseNetOutflow: 0,
    payrollOutflow: 0,
    totalOutflow: 0,
    netCash: 0,
    transactionCounts: {
      membershipPayments: 0,
      expenseEntries: 0,
      payrollPayments: 0,
    },
  },
  charts: {
    trend: [],
    expenseByCategory: [],
  },
};

function createDefaultFilters(): Filters {
  return {
    from: firstDayOfMonthInput(),
    to: dateInput(new Date()),
    groupBy: "day",
    includePayroll: true,
  };
}

function areFiltersEqual(left: Filters, right: Filters) {
  return (
    left.from === right.from &&
    left.to === right.to &&
    left.groupBy === right.groupBy &&
    left.includePayroll === right.includePayroll
  );
}

export function CashflowReportPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { push } = useToast();
  const numberLocale = useMemo(() => resolveNumberLocale(i18n.language), [i18n.language]);

  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState<"csv" | "xlsx" | null>(null);
  const [report, setReport] = useState<CashflowReportResponse>(EMPTY_REPORT);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filters, setFilters] = useState<Filters>(() => createDefaultFilters());
  const [appliedFilters, setAppliedFilters] = useState<Filters>(() => createDefaultFilters());

  const query = useMemo<CashflowQuery>(
    () => ({
      from: appliedFilters.from,
      to: appliedFilters.to,
      groupBy: appliedFilters.groupBy,
      includePayroll: appliedFilters.includePayroll,
    }),
    [appliedFilters]
  );

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    getCashflowReport(query)
      .then(({ data }) => {
        if (!mounted) return;
        setReport(data);
      })
      .catch((error) => {
        if (!mounted) return;
        setReport(EMPTY_REPORT);
        push({ kind: "error", title: error instanceof Error ? error.message : t("cashflowReport.toast.loadFailed") });
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [push, query, t]);

  const handleExport = async (kind: "csv" | "xlsx") => {
    setExporting(kind);
    try {
      if (kind === "csv") {
        const { data } = await downloadCashflowCsv(query);
        saveBlob(data, `cashflow-${appliedFilters.from}-to-${appliedFilters.to}.csv`);
      } else {
        const { data } = await downloadCashflowXlsx(query);
        saveBlob(data, `cashflow-${appliedFilters.from}-to-${appliedFilters.to}.xlsx`);
      }
      push({ kind: "success", title: t("cashflowReport.toast.exportCompleted") });
    } catch (error) {
      push({ kind: "error", title: error instanceof Error ? error.message : t("cashflowReport.toast.exportFailed") });
    } finally {
      setExporting(null);
    }
  };

  const maxTrendAbs = Math.max(1, ...report.charts.trend.map((item) => Math.abs(item.netCash)));
  const toggleLabel = filtersOpen ? t("common.actions.hideFilters") : t("common.actions.showFilters");
  const hasPendingFilterChanges = useMemo(() => !areFiltersEqual(filters, appliedFilters), [appliedFilters, filters]);
  const applyFilters = () => {
    setAppliedFilters(filters);
  };

  useGlobalLoading(loading, {
    delayMs: 0,
    message: t("common.messages.loading"),
    subtitle: t("cashflowReport.header.title"),
  });

  return (
    <>
      <div className="reports-page space-y-4">
      <section className={CARD_CLASS}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{t("cashflowReport.header.title")}</h2>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">{t("cashflowReport.header.subtitle")}</p>
          </div>
          <button
            type="button"
            onClick={() => navigate("/reports")}
            className="report-back-btn rounded-lg px-2.5 py-1 text-[11px] font-semibold transition"
          >
            {t("cashflowReport.header.backToReports")}
          </button>
        </div>
      </section>

      <ReportFiltersPanel
        open={filtersOpen}
        onToggle={() => setFiltersOpen((value) => !value)}
        toggleLabel={toggleLabel}
        className={FILTER_CARD_CLASS}
        gridClassName="attendance-report-filters__grid grid gap-2.5 rounded-xl p-3 lg:grid-cols-6"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => void handleExport("csv")}
              disabled={exporting !== null}
              className={`${REPORT_FILTER_ACTION_CLASS} financial-export-action h-8 min-w-24 whitespace-nowrap px-2.5 text-[11px]`}
            >
              <span className="inline-flex items-center gap-1.5">
                <IconFileExport className="h-3.5 w-3.5" stroke={1.8} />
                {exporting === "csv" ? t("cashflowReport.filters.exporting") : t("cashflowReport.filters.exportCsv")}
              </span>
            </button>
            <button
              type="button"
              onClick={() => void handleExport("xlsx")}
              disabled={exporting !== null}
              className="attendance-export-btn inline-flex h-8 min-w-24 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg border border-brand-500 bg-brand-500 px-2.5 text-[11px] font-semibold text-white transition hover:bg-brand-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/30 disabled:opacity-45"
            >
              <IconFileSpreadsheet className="h-3.5 w-3.5" stroke={1.8} />
              {exporting === "xlsx" ? t("cashflowReport.filters.exporting") : t("cashflowReport.filters.exportXlsx")}
            </button>
          </div>
        }
      >
          <label className="flex flex-col gap-1">
            <span className={LABEL_CLASS}>{t("cashflowReport.filters.from")}</span>
            <ShamsiDateInput
              value={filters.from}
              onChange={(value) => setFilters((prev) => ({ ...prev, from: value }))}
              locale={i18n.language}
              inputClassName={INPUT_CLASS}
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className={LABEL_CLASS}>{t("cashflowReport.filters.to")}</span>
            <ShamsiDateInput
              value={filters.to}
              onChange={(value) => setFilters((prev) => ({ ...prev, to: value }))}
              locale={i18n.language}
              inputClassName={INPUT_CLASS}
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className={LABEL_CLASS}>{t("cashflowReport.filters.groupBy")}</span>
            <DropdownSelect
              buttonClassName={INPUT_CLASS}
              value={filters.groupBy}
              onChange={(value) => setFilters((prev) => ({ ...prev, groupBy: value as CashflowGroupBy }))}
              options={[
                { value: "day", label: t("cashflowReport.filters.groupByDay") },
                { value: "week", label: t("cashflowReport.filters.groupByWeek") },
                { value: "month", label: t("cashflowReport.filters.groupByMonth") },
              ]}
            />
          </label>

          <div className="flex h-full items-end">
            <label className="report-inline-toggle">
              <input
                type="checkbox"
                checked={filters.includePayroll}
                onChange={(event) => setFilters((prev) => ({ ...prev, includePayroll: event.target.checked }))}
                className="report-inline-toggle__input"
              />
              <span className="report-inline-toggle__text">{t("cashflowReport.filters.includePayroll")}</span>
            </label>
          </div>

          <div className="flex items-end justify-end lg:col-start-6 lg:row-start-1">
            <button
              type="button"
              className="attendance-export-btn inline-flex h-8 min-w-24 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg border border-brand-500 bg-brand-500 px-2.5 text-[11px] font-semibold text-white transition hover:bg-brand-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/30 disabled:opacity-45"
              disabled={!hasPendingFilterChanges || loading}
              onClick={applyFilters}
            >
              {t("common.actions.applyFilters")}
            </button>
          </div>

      </ReportFiltersPanel>

      <section className="report-kpi-grid grid gap-2.5 sm:grid-cols-2 xl:grid-cols-5">
        <MetricCard label={t("cashflowReport.summary.inflow")} value={formatAmount(report.summary.membershipInflow, numberLocale)} tone="emerald" />
        <MetricCard label={t("cashflowReport.summary.refunds")} value={formatAmount(report.summary.membershipRefunds, numberLocale)} tone="amber" />
        <MetricCard label={t("cashflowReport.summary.expenseNet")} value={formatAmount(report.summary.expenseNetOutflow, numberLocale)} tone="rose" />
        <MetricCard label={t("cashflowReport.summary.payrollOutflow")} value={formatAmount(report.summary.payrollOutflow, numberLocale)} tone="indigo" />
        <MetricCard label={t("cashflowReport.summary.netCash")} value={formatAmount(report.summary.netCash, numberLocale)} tone="slate" />
      </section>

      <section className={CARD_CLASS}>
        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{t("cashflowReport.trend.title")}</h3>
        {!report.charts.trend.length && !loading ? (
          <p className="mt-2.5 text-[11px] text-slate-500 dark:text-slate-400">{t("cashflowReport.trend.empty")}</p>
        ) : (
          <div className="mt-2.5 space-y-2">
            {report.charts.trend.map((item) => {
              const width = Math.max(2, Math.round((Math.abs(item.netCash) / maxTrendAbs) * 100));
              const barClass = item.netCash >= 0 ? "bg-emerald-500/70" : "bg-rose-500/70";
              return (
                <div key={item.periodKey} className="space-y-1">
                  <div className="flex items-center justify-between text-[11px] text-slate-600 dark:text-slate-300">
                    <span>{item.label}</span>
                    <span>{formatAmount(item.netCash, numberLocale)}</span>
                  </div>
                  <div className="h-2 rounded-full bg-slate-200/80 dark:bg-slate-800/70">
                    <div className={`h-2 rounded-full ${barClass}`} style={{ width: `${width}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section className={CARD_CLASS}>
        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{t("cashflowReport.categories.title")}</h3>
        {!report.charts.expenseByCategory.length && !loading ? (
          <p className="mt-2.5 text-[11px] text-slate-500 dark:text-slate-400">{t("cashflowReport.categories.empty")}</p>
        ) : (
          <div className="mt-2.5 space-y-2">
            {report.charts.expenseByCategory.map((item) => (
              <div key={item.categoryId} className="space-y-1">
                <div className="flex items-center justify-between text-[11px] text-slate-600 dark:text-slate-300">
                  <span>{item.categoryName}</span>
                  <span>{formatAmount(item.netOutflow, numberLocale)}</span>
                </div>
                <div className="h-2 rounded-full bg-slate-200/80 dark:bg-slate-800/70">
                  <div
                    className="h-2 rounded-full bg-amber-500/70"
                    style={{ width: `${Math.max(2, Math.round(item.sharePct || 0))}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className={CARD_CLASS}>
        <DataTableShell>
          <DataTable variant="report" minWidth="760px">
            <DataTableHead>
              <DataTableRow>
                <DataTableHeaderCell>{t("cashflowReport.table.period")}</DataTableHeaderCell>
                <DataTableHeaderCell align="end">{t("cashflowReport.table.inflow")}</DataTableHeaderCell>
                <DataTableHeaderCell align="end">{t("cashflowReport.table.refunds")}</DataTableHeaderCell>
                <DataTableHeaderCell align="end">{t("cashflowReport.table.expenseNet")}</DataTableHeaderCell>
                <DataTableHeaderCell align="end">{t("cashflowReport.table.payrollOutflow")}</DataTableHeaderCell>
                <DataTableHeaderCell align="end">{t("cashflowReport.table.totalOutflow")}</DataTableHeaderCell>
                <DataTableHeaderCell align="end">{t("cashflowReport.table.netCash")}</DataTableHeaderCell>
              </DataTableRow>
            </DataTableHead>
            <DataTableBody>
              {loading ? (
                <DataTableEmptyRow colSpan={7}>{t("cashflowReport.table.loading")}</DataTableEmptyRow>
              ) : report.charts.trend.length === 0 ? (
                <DataTableEmptyRow colSpan={7}>{t("cashflowReport.table.empty")}</DataTableEmptyRow>
              ) : (
                report.charts.trend.map((item) => (
                  <DataTableRow key={item.periodKey}>
                    <DataTableCell>{item.label}</DataTableCell>
                    <DataTableCell align="end">{formatAmount(item.inflow, numberLocale)}</DataTableCell>
                    <DataTableCell align="end">{formatAmount(item.refunds, numberLocale)}</DataTableCell>
                    <DataTableCell align="end">{formatAmount(item.expenseNetOutflow, numberLocale)}</DataTableCell>
                    <DataTableCell align="end">{formatAmount(item.payrollOutflow, numberLocale)}</DataTableCell>
                    <DataTableCell align="end">{formatAmount(item.totalOutflow, numberLocale)}</DataTableCell>
                    <DataTableCell
                      align="end"
                      className={`font-semibold ${
                        item.netCash >= 0 ? "text-emerald-700 dark:text-emerald-300" : "text-rose-700 dark:text-rose-300"
                      }`}
                    >
                      {formatAmount(item.netCash, numberLocale)}
                    </DataTableCell>
                  </DataTableRow>
                ))
              )}
            </DataTableBody>
          </DataTable>
        </DataTableShell>
      </section>
      </div>
    </>
  );
}

function MetricCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "emerald" | "amber" | "rose" | "indigo" | "slate";
}) {
  const toneClass =
    tone === "emerald"
      ? "report-kpi-card--emerald"
      : tone === "amber"
        ? "report-kpi-card--amber"
        : tone === "rose"
          ? "report-kpi-card--rose"
          : tone === "indigo"
            ? "report-kpi-card--indigo"
            : "report-kpi-card--slate";

  return (
    <article className={`report-kpi-card ${toneClass}`}>
      <p className="report-kpi-card__label">{label}</p>
      <p className="report-kpi-card__value">{value}</p>
      <span className="report-kpi-card__glow" aria-hidden="true" />
    </article>
  );
}

function resolveNumberLocale(language: string) {
  const base = language.split("-")[0];
  if (base === "fa") return "fa-AF";
  if (base === "ps") return "ps-AF";
  return "en-US";
}

function formatAmount(value: number, locale: string) {
  const safe = Number.isFinite(value) ? value : 0;
  const formatted = new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(safe);
  return `${formatted} ${resolveCurrencyLabel(locale)}`;
}

function resolveCurrencyLabel(locale: string) {
  if (locale.startsWith("fa")) return "افغانی";
  if (locale.startsWith("ps")) return "افغانۍ";
  return "AFN";
}

function dateInput(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function firstDayOfMonthInput() {
  const now = new Date();
  return dateInput(new Date(now.getFullYear(), now.getMonth(), 1));
}

function saveBlob(blob: Blob, filename: string) {
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.URL.revokeObjectURL(url);
}


