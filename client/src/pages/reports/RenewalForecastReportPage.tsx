import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { IconFileExport, IconFileSpreadsheet, IconFileTypePdf } from "@tabler/icons-react";
import { getMembers, type Member } from "../../api/members";
import { listPlans } from "../../api/membershipPlans";
import {
  downloadRenewalForecastCsv,
  downloadRenewalForecastPdf,
  downloadRenewalForecastXlsx,
  getRenewalForecastReport,
  type RenewalForecastItem,
  type RenewalForecastQuery,
  type RenewalForecastReportResponse,
} from "../../api/renewalForecastReport";
import {
  ReportFiltersPanel,
  REPORT_FILTER_ACTION_CLASS,
  REPORT_FILTER_FIELD_CLASS,
  REPORT_FILTER_LABEL_CLASS,
  REPORT_FILTER_PANEL_CLASS,
} from "../../components/reports/ReportFiltersPanel";
import { ReportPager } from "../../components/reports/ReportPager";
import { useToast } from "../../components/ToastContext";
import { useGlobalLoading } from "../../components/GlobalLoadingContext";
import { DropdownSelect } from "../../components/ui/DropdownSelect";
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
import type { MembershipPlanDTO } from "../../shared/membershipTypes";

type Filters = {
  horizonDays: number;
  includeExpired: boolean;
  showOnlyDebtors: boolean;
  planId: string;
  status: "" | NonNullable<RenewalForecastQuery["status"]>;
  memberType: NonNullable<RenewalForecastQuery["memberType"]>;
  search: string;
  sortBy: NonNullable<RenewalForecastQuery["sortBy"]>;
  sortDir: NonNullable<RenewalForecastQuery["sortDir"]>;
  page: number;
};
type MemberFilterOption = {
  code: string;
  label: string;
};

const CARD_CLASS = "rounded-2xl border border-slate-200/80 bg-white/90 p-3 shadow-sm dark:border-slate-800/80 dark:bg-slate-950/70";
const FILTER_CARD_CLASS = REPORT_FILTER_PANEL_CLASS;
const INPUT_CLASS = REPORT_FILTER_FIELD_CLASS;
const LABEL_CLASS = REPORT_FILTER_LABEL_CLASS;
const PAGE_SIZE = 20;
const MEMBER_FILTER_PAGE_SIZE = 100;
const MEMBER_FILTER_LIMIT = 5000;

const EMPTY_REPORT: RenewalForecastReportResponse = {
  generatedAt: new Date(0).toISOString(),
  filters: {
    horizonDays: 30,
    includeExpired: false,
    showOnlyDebtors: false,
    planId: null,
    status: null,
    memberType: "customer",
    search: null,
    sortBy: "daysLeft",
    sortDir: "asc",
  },
  kpis: {
    expiringCount: 0,
    expiringRevenueAtRisk: 0,
    expectedRenewals: 0,
    renewalRatePct: 0,
    debtAtRisk: 0,
  },
  charts: {
    expirationsTimeline: [],
    byPlan: [],
  },
  items: [],
  pageInfo: { page: 1, pageSize: PAGE_SIZE, totalItems: 0, totalPages: 1 },
};

function createDefaultFilters(): Filters {
  return {
    horizonDays: 30,
    includeExpired: false,
    showOnlyDebtors: false,
    planId: "",
    status: "",
    memberType: "customer",
    search: "",
    sortBy: "daysLeft",
    sortDir: "asc",
    page: 1,
  };
}

function areFiltersEqual(left: Filters, right: Filters) {
  return (
    left.horizonDays === right.horizonDays &&
    left.includeExpired === right.includeExpired &&
    left.showOnlyDebtors === right.showOnlyDebtors &&
    left.planId === right.planId &&
    left.status === right.status &&
    left.memberType === right.memberType &&
    left.search === right.search &&
    left.sortBy === right.sortBy &&
    left.sortDir === right.sortDir &&
    left.page === right.page
  );
}

export function RenewalForecastReportPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { push } = useToast();
  const numberLocale = useMemo(() => resolveNumberLocale(i18n.language), [i18n.language]);

  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState<"csv" | "xlsx" | "pdf" | null>(null);
  const [plans, setPlans] = useState<MembershipPlanDTO[]>([]);
  const [members, setMembers] = useState<MemberFilterOption[]>([]);
  const [report, setReport] = useState<RenewalForecastReportResponse>(EMPTY_REPORT);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filters, setFilters] = useState<Filters>(() => createDefaultFilters());
  const [appliedFilters, setAppliedFilters] = useState<Filters>(() => createDefaultFilters());

  useEffect(() => {
    let mounted = true;
    Promise.all([listPlans(), loadMemberFilterOptions()])
      .then(([plansRes, memberOptions]) => {
        if (!mounted) return;
        setPlans(plansRes.data ?? []);
        setMembers(memberOptions);
      })
      .catch(() => {
        if (!mounted) return;
        setPlans([]);
        setMembers([]);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const query = useMemo<RenewalForecastQuery>(
    () => ({
      horizonDays: appliedFilters.horizonDays,
      includeExpired: appliedFilters.includeExpired,
      showOnlyDebtors: appliedFilters.showOnlyDebtors,
      planId: appliedFilters.planId || undefined,
      status: appliedFilters.status || undefined,
      memberType: appliedFilters.memberType,
      search: appliedFilters.search.trim() || undefined,
      sortBy: appliedFilters.sortBy,
      sortDir: appliedFilters.sortDir,
      page: appliedFilters.page,
      pageSize: PAGE_SIZE,
    }),
    [appliedFilters]
  );

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    getRenewalForecastReport(query)
      .then(({ data }) => {
        if (!mounted) return;
        setReport(data);
      })
      .catch((error) => {
        if (!mounted) return;
        setReport(EMPTY_REPORT);
        push({ kind: "error", title: error instanceof Error ? error.message : t("renewalForecastReport.toast.loadFailed") });
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [push, query, t]);

  const exportParams = useMemo(
    () => ({
      horizonDays: appliedFilters.horizonDays,
      includeExpired: appliedFilters.includeExpired,
      showOnlyDebtors: appliedFilters.showOnlyDebtors,
      planId: appliedFilters.planId || undefined,
      status: appliedFilters.status || undefined,
      memberType: appliedFilters.memberType,
      search: appliedFilters.search.trim() || undefined,
      sortBy: appliedFilters.sortBy,
      sortDir: appliedFilters.sortDir,
    }),
    [appliedFilters]
  );

  const handleExport = async (kind: "csv" | "xlsx" | "pdf") => {
    setExporting(kind);
    try {
      if (kind === "csv") {
        const { data } = await downloadRenewalForecastCsv(exportParams);
        saveBlob(data, `renewal-forecast-${appliedFilters.horizonDays}d.csv`);
      } else if (kind === "xlsx") {
        const { data } = await downloadRenewalForecastXlsx(exportParams);
        saveBlob(data, `renewal-forecast-${appliedFilters.horizonDays}d.xlsx`);
      } else {
        const { data } = await downloadRenewalForecastPdf(exportParams);
        saveBlob(base64ToBlob(data.data, data.contentType), data.filename);
      }
      push({ kind: "success", title: t("renewalForecastReport.toast.exportCompleted") });
    } catch (error) {
      push({ kind: "error", title: error instanceof Error ? error.message : t("renewalForecastReport.toast.exportFailed") });
    } finally {
      setExporting(null);
    }
  };

  const timelinePoints = report.charts.expirationsTimeline;
  const hasTimelineActivity = report.charts.expirationsTimeline.some(
    (row) => Number(row.count) > 0 || Number(row.totalDue) > 0 || Number(row.totalRemaining) > 0
  );
  const timelineDueValues = timelinePoints.map((row) => Math.max(0, Number(row.totalDue) || 0));
  const timelineScale = buildTimelineScale(timelineDueValues);
  const timelineScaleMax = timelineScale.cap;
  const timelineExpiringTotal = timelinePoints.reduce((sum, row) => sum + (Number(row.count) || 0), 0);
  const timelineDueTotal = timelinePoints.reduce((sum, row) => sum + (Number(row.totalDue) || 0), 0);
  const timelineRemainingTotal = timelinePoints.reduce((sum, row) => sum + (Number(row.totalRemaining) || 0), 0);
  const timelineAxisTicks = buildTimelineAmountTicks(timelineScaleMax);
  const timelineLabelStep = resolveTimelineLabelStep(timelinePoints.length);

  const byPlanMaxCount = Math.max(1, ...report.charts.byPlan.map((row) => Number(row.count) || 0));
  const byPlanMaxDue = Math.max(1, ...report.charts.byPlan.map((row) => Number(row.totalDue) || 0));
  const byPlanMaxRemaining = Math.max(1, ...report.charts.byPlan.map((row) => Number(row.totalRemaining) || 0));
  const rangeStart = report.pageInfo.totalItems ? (report.pageInfo.page - 1) * report.pageInfo.pageSize + 1 : 0;
  const rangeEnd = report.pageInfo.totalItems ? Math.min(report.pageInfo.totalItems, report.pageInfo.page * report.pageInfo.pageSize) : 0;
  const toggleLabel = filtersOpen ? t("common.actions.hideFilters") : t("common.actions.showFilters");
  const hasPendingFilterChanges = useMemo(() => !areFiltersEqual(filters, appliedFilters), [appliedFilters, filters]);
  const applyFilters = () => {
    setAppliedFilters({ ...filters, page: 1 });
    setFilters((prev) => ({ ...prev, page: 1 }));
  };
  const goToPage = (nextPage: number) => {
    setAppliedFilters((prev) => ({ ...prev, page: nextPage }));
    setFilters((prev) => ({ ...prev, page: nextPage }));
  };

  useGlobalLoading(loading, {
    delayMs: 0,
    message: t("common.messages.loading"),
    subtitle: t("renewalForecastReport.header.title"),
  });

  return (
    <>
      <div className="reports-page space-y-4">
      <section className={CARD_CLASS}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{t("renewalForecastReport.header.title")}</h2>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">{t("renewalForecastReport.header.subtitle")}</p>
          </div>
          <button
            type="button"
            onClick={() => navigate("/reports")}
            className="report-back-btn rounded-lg px-2.5 py-1 text-[11px] font-semibold transition"
          >
            {t("renewalForecastReport.header.backToReports")}
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
              disabled={exporting !== null}
              onClick={() => handleExport("csv")}
              className={`${REPORT_FILTER_ACTION_CLASS} financial-export-action h-8 min-w-24 px-2.5 text-[11px]`}
            >
              <span className="inline-flex items-center gap-1.5">
                <IconFileExport className="h-3.5 w-3.5" stroke={1.8} />
                {exporting === "csv" ? t("renewalForecastReport.filters.exporting") : t("renewalForecastReport.filters.exportCsv")}
              </span>
            </button>
            <button
              type="button"
              disabled={exporting !== null}
              onClick={() => handleExport("xlsx")}
              className="renewal-export-btn attendance-export-btn inline-flex h-8 min-w-24 items-center justify-center gap-1.5 rounded-lg border border-brand-500 bg-brand-500 px-2.5 text-[11px] font-semibold text-white transition hover:bg-brand-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/30 disabled:opacity-45"
            >
              <IconFileSpreadsheet className="h-3.5 w-3.5" stroke={1.8} />
              {exporting === "xlsx" ? t("renewalForecastReport.filters.exporting") : t("renewalForecastReport.filters.exportXlsx")}
            </button>
            <button
              type="button"
              disabled={exporting !== null}
              onClick={() => handleExport("pdf")}
              className="renewal-export-btn inline-flex h-8 min-w-24 items-center justify-center gap-1.5 rounded-lg border border-sky-500/60 bg-sky-500 px-2.5 text-[11px] font-semibold text-white transition hover:bg-sky-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/30 disabled:opacity-45"
            >
              <IconFileTypePdf className="h-3.5 w-3.5" stroke={1.8} />
              {exporting === "pdf" ? t("renewalForecastReport.filters.exporting") : t("renewalForecastReport.filters.exportPdf")}
            </button>
          </div>
        }
      >
          <label className="flex flex-col gap-1">
            <span className={LABEL_CLASS}>{t("renewalForecastReport.filters.horizonDays")}</span>
            <DropdownSelect
              buttonClassName={INPUT_CLASS}
              value={String(filters.horizonDays)}
              onChange={(value) => setFilters((prev) => ({ ...prev, horizonDays: Number(value), page: 1 }))}
              options={[
                { value: "7", label: "7" },
                { value: "30", label: "30" },
                { value: "60", label: "60" },
                { value: "90", label: "90" },
              ]}
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className={LABEL_CLASS}>{t("renewalForecastReport.filters.status")}</span>
            <DropdownSelect
              buttonClassName={INPUT_CLASS}
              value={filters.status}
              onChange={(value) => setFilters((prev) => ({ ...prev, status: value as Filters["status"], page: 1 }))}
              options={[
                { value: "", label: t("renewalForecastReport.filters.allStatuses") },
                { value: "ACTIVE", label: t("renewalForecastReport.status.active") },
                { value: "PENDING", label: t("renewalForecastReport.status.pending") },
                { value: "EXPIRED", label: t("renewalForecastReport.status.expired") },
                { value: "SUSPENDED", label: t("renewalForecastReport.status.suspended") },
                { value: "CANCELLED", label: t("renewalForecastReport.status.cancelled") },
              ]}
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className={LABEL_CLASS}>{t("renewalForecastReport.filters.plan")}</span>
            <DropdownSelect
              buttonClassName={INPUT_CLASS}
              value={filters.planId}
              onChange={(value) => setFilters((prev) => ({ ...prev, planId: value, page: 1 }))}
              options={[
                { value: "", label: t("renewalForecastReport.filters.allPlans") },
                ...plans.map((plan) => ({ value: plan.id, label: plan.name })),
              ]}
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className={LABEL_CLASS}>{t("renewalForecastReport.filters.memberType")}</span>
            <DropdownSelect
              buttonClassName={INPUT_CLASS}
              value={filters.memberType}
              onChange={(value) => setFilters((prev) => ({ ...prev, memberType: value as Filters["memberType"], page: 1 }))}
              options={[
                { value: "customer", label: t("renewalForecastReport.filters.memberTypeCustomer") },
                { value: "staff", label: t("renewalForecastReport.filters.memberTypeStaff") },
                { value: "all", label: t("renewalForecastReport.filters.memberTypeAll") },
              ]}
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className={LABEL_CLASS}>{t("renewalForecastReport.filters.search")}</span>
            <DropdownSelect
              buttonClassName={INPUT_CLASS}
              value={filters.search}
              onChange={(value) => setFilters((prev) => ({ ...prev, search: value, page: 1 }))}
              options={[
                { value: "", label: t("renewalForecastReport.filters.searchPlaceholder") },
                ...members.map((member) => ({
                  value: member.code,
                  label: member.label,
                })),
              ]}
            />
          </label>

          <div className="flex h-full items-end">
            <label className="report-inline-toggle">
              <input
                type="checkbox"
                checked={filters.includeExpired}
                onChange={(event) => setFilters((prev) => ({ ...prev, includeExpired: event.target.checked, page: 1 }))}
                className="report-inline-toggle__input"
              />
              <span className="report-inline-toggle__text">{t("renewalForecastReport.filters.includeExpired")}</span>
            </label>
          </div>

          <div className="flex h-full items-end">
            <label className="report-inline-toggle">
              <input
                type="checkbox"
                checked={filters.showOnlyDebtors}
                onChange={(event) => setFilters((prev) => ({ ...prev, showOnlyDebtors: event.target.checked, page: 1 }))}
                className="report-inline-toggle__input"
              />
              <span className="report-inline-toggle__text">{t("renewalForecastReport.filters.onlyDebtors")}</span>
            </label>
          </div>

          <div className="flex h-full items-end justify-end lg:col-span-5">
            <button
              type="button"
              className="renewal-export-btn attendance-export-btn inline-flex h-8 min-w-24 items-center justify-center gap-1.5 rounded-lg border border-brand-500 bg-brand-500 px-2.5 text-[11px] font-semibold text-white transition hover:bg-brand-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/30 disabled:opacity-45"
              disabled={!hasPendingFilterChanges || loading}
              onClick={applyFilters}
            >
              {t("common.actions.applyFilters")}
            </button>
          </div>

      </ReportFiltersPanel>

      <section className="renewal-kpi-grid grid gap-2.5 sm:grid-cols-2 xl:grid-cols-5">
        <MetricCard label={t("renewalForecastReport.kpis.expiringCount")} value={formatCount(report.kpis.expiringCount, numberLocale)} tone="cyan" />
        <MetricCard label={t("renewalForecastReport.kpis.revenueAtRisk")} value={formatAmount(report.kpis.expiringRevenueAtRisk, numberLocale)} tone="amber" />
        <MetricCard label={t("renewalForecastReport.kpis.expectedRenewals")} value={formatCount(report.kpis.expectedRenewals, numberLocale)} tone="emerald" />
        <MetricCard label={t("renewalForecastReport.kpis.debtAtRisk")} value={formatAmount(report.kpis.debtAtRisk, numberLocale)} tone="rose" />
        <MetricCard label={t("renewalForecastReport.kpis.renewalRate")} value={`${report.kpis.renewalRatePct.toFixed(2)}%`} tone="sky" />
      </section>

      <section className={`${CARD_CLASS} renewal-card renewal-card--timeline`}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{t("renewalForecastReport.timeline.title")}</h3>
          {hasTimelineActivity ? (
            <div className="renewal-timeline-summary">
              <span className="renewal-timeline-pill">
                {t("renewalForecastReport.filters.horizonDays")}: {formatCount(report.filters.horizonDays ?? filters.horizonDays, numberLocale)}
              </span>
              <span className="renewal-timeline-pill">
                {t("renewalForecastReport.kpis.expiringCount")}: {formatCount(timelineExpiringTotal, numberLocale)}
              </span>
              <span className="renewal-timeline-pill">
                {t("renewalForecastReport.table.due")}: {formatAmount(timelineDueTotal, numberLocale)}
              </span>
              <span className="renewal-timeline-pill">
                {t("renewalForecastReport.table.remaining")}: {formatAmount(timelineRemainingTotal, numberLocale)}
              </span>
            </div>
          ) : null}
        </div>
        {hasTimelineActivity ? (
          <div className="renewal-timeline-chart mt-2.5">
            <div className="renewal-timeline-legend">
              <span className="renewal-timeline-legend__item">
                <span className="renewal-timeline-legend__dot renewal-timeline-legend__dot--due" />
                {t("renewalForecastReport.table.due")}
              </span>
              <span className="renewal-timeline-legend__item">
                <span className="renewal-timeline-legend__dot renewal-timeline-legend__dot--remaining" />
                {t("renewalForecastReport.table.remaining")}
              </span>
              {timelineScale.compressed ? (
                <span className="renewal-timeline-legend__badge">
                  {t("renewalForecastReport.table.due")} ▲ {formatAmount(timelineScale.peak, numberLocale)}
                </span>
              ) : null}
            </div>
            <div className="renewal-timeline-axis" aria-hidden="true">
              <span className="renewal-timeline-axis__unit">{resolveCurrencyLabel(numberLocale)}</span>
              {timelineAxisTicks.map((tick, index) => (
                <span key={`${tick}-${index}`} className="renewal-timeline-axis__tick">
                  {formatAmountAxis(tick, numberLocale)}
                </span>
              ))}
            </div>
            <div className="renewal-timeline-main">
              <div className="renewal-timeline-grid" aria-hidden="true" />
              <div className={`renewal-timeline-bars ${timelinePoints.length > 24 ? "is-dense" : ""}`}>
            {timelinePoints.map((point, index) => {
              const count = Number(point.count) || 0;
              const totalDue = Number(point.totalDue) || 0;
              const totalRemaining = Number(point.totalRemaining) || 0;
              const displayedDue = timelineScaleMax > 0 ? Math.min(totalDue, timelineScaleMax) : totalDue;
              const computedHeight = timelineScaleMax > 0 ? Math.round((displayedDue / timelineScaleMax) * 100) : 0;
              const barHeight = Math.max(totalDue > 0 ? 10 : 3, computedHeight);
              const remainingRatio = totalDue > 0 ? Math.min(1, Math.max(0, totalRemaining / totalDue)) : 0;
              const isCapped = timelineScale.compressed && totalDue > timelineScaleMax;
              const showLabel = index % timelineLabelStep === 0 || index === timelinePoints.length - 1;
              const tooltipPlacementClass =
                index < 2 ? "is-start" : index >= timelinePoints.length - 2 ? "is-end" : "";
              return (
                <div key={point.key} className="renewal-timeline-point">
                  <div className={`renewal-timeline-bar-wrap group ${count > 0 || totalDue > 0 ? "is-active" : ""}`}>
                    <div className={`renewal-timeline-tooltip ${tooltipPlacementClass}`} role="tooltip">
                      <p className="renewal-timeline-tooltip__title">{point.key}</p>
                      <p>
                        {t("renewalForecastReport.kpis.expiringCount")}: {formatCount(count, numberLocale)}
                      </p>
                      <p>
                        {t("renewalForecastReport.table.due")}: {formatAmount(totalDue, numberLocale)}
                      </p>
                      <p>
                        {t("renewalForecastReport.table.remaining")}: {formatAmount(totalRemaining, numberLocale)}
                      </p>
                    </div>
                    <div
                      className={`renewal-timeline-bar rounded-t-sm ${totalDue <= 0 ? "is-empty" : ""} ${isCapped ? "is-capped" : ""}`}
                      style={{ height: `${barHeight}%` }}
                    >
                      {totalDue > 0 ? (
                        <span className="renewal-timeline-bar__remaining" style={{ height: `${Math.round(remainingRatio * 100)}%` }} />
                      ) : null}
                      {isCapped ? <span className="renewal-timeline-bar__cap" aria-hidden="true" /> : null}
                    </div>
                  </div>
                  <span className={`renewal-timeline-label ${showLabel ? "" : "is-muted"}`}>{showLabel ? point.label : "·"}</span>
                </div>
              );
            })}
              </div>
            </div>
          </div>
        ) : (
          <div className="mt-2.5 grid h-28 place-items-center rounded-xl border border-dashed border-slate-300 text-[11px] text-slate-500 dark:border-slate-700 dark:text-slate-400">
            {t("renewalForecastReport.timeline.empty")}
          </div>
        )}
      </section>

      <section className={`${CARD_CLASS} renewal-card renewal-card--plan`}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{t("renewalForecastReport.byPlan.title")}</h3>
          {report.charts.byPlan.length ? (
            <p className="text-[10px] text-slate-500 dark:text-slate-400">
              {t("renewalForecastReport.table.plan")}: {formatCount(report.charts.byPlan.length, numberLocale)}
            </p>
          ) : null}
        </div>
        {report.charts.byPlan.length ? (
          <div className="renewal-plan-grid mt-2.5">
            {report.charts.byPlan.map((plan) => {
              const planCount = Math.max(0, Number(plan.count) || 0);
              const planDue = Math.max(0, Number(plan.totalDue) || 0);
              const planRemaining = Math.max(0, Number(plan.totalRemaining) || 0);
              const countWidth = planCount > 0 ? Math.max(6, Math.round((planCount / byPlanMaxCount) * 100)) : 0;
              const dueWidth = planDue > 0 ? Math.max(6, Math.round((planDue / byPlanMaxDue) * 100)) : 0;
              const remainingWidth = planRemaining > 0 ? Math.max(6, Math.round((planRemaining / byPlanMaxRemaining) * 100)) : 0;

              return (
                <article key={plan.planId || plan.planName} className="renewal-plan-card">
                  <div className="renewal-plan-card__head">
                    <h4 className="renewal-plan-card__title">{plan.planName}</h4>
                    <span className="renewal-plan-card__chip">{formatCount(planCount, numberLocale)}</span>
                  </div>

                  <div className="renewal-plan-card__stats">
                    <div>
                      <span>{t("renewalForecastReport.kpis.expiringCount")}</span>
                      <strong>{formatCount(planCount, numberLocale)}</strong>
                    </div>
                    <div>
                      <span>{t("renewalForecastReport.table.due")}</span>
                      <strong>{formatAmount(planDue, numberLocale)}</strong>
                    </div>
                    <div>
                      <span>{t("renewalForecastReport.table.remaining")}</span>
                      <strong>{formatAmount(planRemaining, numberLocale)}</strong>
                    </div>
                  </div>

                  <div className="renewal-plan-row">
                    <span className="renewal-plan-row__label">{t("renewalForecastReport.kpis.expiringCount")}</span>
                    <div className="renewal-plan-track group">
                      <div className="renewal-plan-track__tooltip" role="tooltip">
                        {t("renewalForecastReport.kpis.expiringCount")}: {formatCount(planCount, numberLocale)}
                      </div>
                      <div className="renewal-plan-track__fill renewal-plan-track__fill--count" style={{ width: `${countWidth}%` }} />
                    </div>
                    <span className="renewal-plan-row__value">{formatCount(planCount, numberLocale)}</span>
                  </div>

                  <div className="renewal-plan-row">
                    <span className="renewal-plan-row__label">{t("renewalForecastReport.table.due")}</span>
                    <div className="renewal-plan-track group">
                      <div className="renewal-plan-track__tooltip" role="tooltip">
                        {t("renewalForecastReport.table.due")}: {formatAmount(planDue, numberLocale)}
                      </div>
                      <div className="renewal-plan-track__fill renewal-plan-track__fill--due" style={{ width: `${dueWidth}%` }} />
                    </div>
                    <span className="renewal-plan-row__value">{formatAmount(planDue, numberLocale)}</span>
                  </div>

                  <div className="renewal-plan-row">
                    <span className="renewal-plan-row__label">{t("renewalForecastReport.table.remaining")}</span>
                    <div className="renewal-plan-track group">
                      <div className="renewal-plan-track__tooltip" role="tooltip">
                        {t("renewalForecastReport.table.remaining")}: {formatAmount(planRemaining, numberLocale)}
                      </div>
                      <div className="renewal-plan-track__fill renewal-plan-track__fill--remaining" style={{ width: `${remainingWidth}%` }} />
                    </div>
                    <span className="renewal-plan-row__value">{formatAmount(planRemaining, numberLocale)}</span>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <p className="mt-2.5 text-[11px] text-slate-500 dark:text-slate-400">{t("renewalForecastReport.byPlan.empty")}</p>
        )}
      </section>

      <section className={CARD_CLASS}>
        <DataTableShell>
          <DataTable variant="report" minWidth="1100px">
            <DataTableHead>
              <DataTableRow>
                <DataTableHeaderCell>{t("renewalForecastReport.table.member")}</DataTableHeaderCell>
                <DataTableHeaderCell>{t("renewalForecastReport.table.plan")}</DataTableHeaderCell>
                <DataTableHeaderCell>{t("renewalForecastReport.table.status")}</DataTableHeaderCell>
                <DataTableHeaderCell>{t("renewalForecastReport.table.expireDate")}</DataTableHeaderCell>
                <DataTableHeaderCell align="end">{t("renewalForecastReport.table.daysLeft")}</DataTableHeaderCell>
                <DataTableHeaderCell align="end">{t("renewalForecastReport.table.due")}</DataTableHeaderCell>
                <DataTableHeaderCell align="end">{t("renewalForecastReport.table.paid")}</DataTableHeaderCell>
                <DataTableHeaderCell align="end">{t("renewalForecastReport.table.remaining")}</DataTableHeaderCell>
                <DataTableHeaderCell>{t("renewalForecastReport.table.autoRenew")}</DataTableHeaderCell>
                <DataTableHeaderCell>{t("renewalForecastReport.table.suggestedAction")}</DataTableHeaderCell>
              </DataTableRow>
            </DataTableHead>
            <DataTableBody>
              {loading ? (
                <DataTableEmptyRow colSpan={10}>{t("renewalForecastReport.table.loading")}</DataTableEmptyRow>
              ) : report.items.length === 0 ? (
                <DataTableEmptyRow colSpan={10}>{t("renewalForecastReport.table.empty")}</DataTableEmptyRow>
              ) : (
                report.items.map((item) => (
                  <DataTableRow key={item.membershipId}>
                    <DataTableCell>
                      <div className="font-semibold text-slate-900 dark:text-slate-100">{item.memberName}</div>
                      <div className="text-[10px] text-slate-500">#{item.memberCode}</div>
                    </DataTableCell>
                    <DataTableCell>{item.planName ?? "-"}</DataTableCell>
                    <DataTableCell>{formatMembershipStatus(item.currentStatus, t)}</DataTableCell>
                    <DataTableCell>{item.expireDate.slice(0, 10)}</DataTableCell>
                    <DataTableCell align="end">{formatCount(item.daysLeft, numberLocale)}</DataTableCell>
                    <DataTableCell align="end">{formatAmount(item.due, numberLocale)}</DataTableCell>
                    <DataTableCell align="end">{formatAmount(item.paid, numberLocale)}</DataTableCell>
                    <DataTableCell align="end" className="font-semibold text-rose-600 dark:text-rose-300">
                      {formatAmount(item.remaining, numberLocale)}
                    </DataTableCell>
                    <DataTableCell>{item.autoRenew ? t("common.values.yes") : t("common.values.no")}</DataTableCell>
                    <DataTableCell>{formatSuggestedAction(item, t)}</DataTableCell>
                  </DataTableRow>
                ))
              )}
            </DataTableBody>
          </DataTable>
        </DataTableShell>
        <ReportPager
          rangeLabel={t("renewalForecastReport.table.rangeOfTotal", {
            start: formatCount(rangeStart, numberLocale),
            end: formatCount(rangeEnd, numberLocale),
            total: formatCount(report.pageInfo.totalItems, numberLocale),
          })}
          pageLabel={`${formatCount(report.pageInfo.page, numberLocale)} / ${formatCount(report.pageInfo.totalPages, numberLocale)}`}
          previousLabel={t("renewalForecastReport.table.prev")}
          nextLabel={t("renewalForecastReport.table.next")}
          canPrevious={report.pageInfo.page > 1}
          canNext={report.pageInfo.page < report.pageInfo.totalPages}
          onPrevious={() => goToPage(Math.max(1, report.pageInfo.page - 1))}
          onNext={() => goToPage(Math.min(report.pageInfo.totalPages, report.pageInfo.page + 1))}
        />
      </section>
      </div>
    </>
  );
}

function MetricCard({ label, value, tone }: { label: string; value: string; tone: "slate" | "rose" | "amber" | "emerald" | "sky" | "cyan" }) {
  const toneClass =
    tone === "rose"
      ? "renewal-kpi-card--rose"
      : tone === "amber"
        ? "renewal-kpi-card--amber"
        : tone === "emerald"
          ? "renewal-kpi-card--emerald"
          : tone === "sky"
            ? "renewal-kpi-card--sky"
            : tone === "cyan"
              ? "renewal-kpi-card--cyan"
              : "renewal-kpi-card--slate";
  return (
    <article className={`renewal-kpi-card ${toneClass}`}>
      <p className="renewal-kpi-card__label">{label}</p>
      <p className="renewal-kpi-card__value">{value}</p>
      <span className="renewal-kpi-card__glow" aria-hidden="true" />
    </article>
  );
}

function formatAmount(value: number, locale: string) {
  const safe = Number.isFinite(value) ? value : 0;
  const formatted = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(safe);
  return `${formatted} ${resolveCurrencyLabel(locale)}`;
}

function formatCount(value: number, locale: string) {
  return new Intl.NumberFormat(locale).format(value);
}

function formatAmountAxis(value: number, locale: string) {
  const safe = Number.isFinite(value) ? Math.max(0, value) : 0;
  return new Intl.NumberFormat(locale, {
    maximumFractionDigits: 0,
    notation: safe >= 10_000 ? "compact" : "standard",
  }).format(safe);
}

function buildTimelineAmountTicks(maxValue: number) {
  const safeMax = Number.isFinite(maxValue) && maxValue > 0 ? maxValue : 0;
  const factors = [1, 0.75, 0.5, 0.25, 0];
  return factors.map((factor) => Math.round(safeMax * factor));
}

function buildTimelineScale(values: number[]) {
  const positiveValues = values
    .map((value) => (Number.isFinite(value) ? Math.max(0, value) : 0))
    .filter((value) => value > 0)
    .sort((a, b) => a - b);
  const peak = positiveValues.length ? positiveValues[positiveValues.length - 1] : 0;
  if (peak <= 0) return { peak: 0, cap: 0, compressed: false };

  const percentile90 = percentileFromSorted(positiveValues, 0.9);
  const compressed = percentile90 > 0 && peak / percentile90 >= 1.65;
  const cap = compressed ? percentile90 : peak;
  return { peak, cap: Math.max(1, cap), compressed };
}

function percentileFromSorted(values: number[], percentile: number) {
  if (!values.length) return 0;
  const boundedPercentile = Math.min(1, Math.max(0, percentile));
  const rawIndex = boundedPercentile * (values.length - 1);
  const lowerIndex = Math.floor(rawIndex);
  const upperIndex = Math.ceil(rawIndex);
  if (lowerIndex === upperIndex) return values[lowerIndex];
  const interpolation = rawIndex - lowerIndex;
  return values[lowerIndex] + (values[upperIndex] - values[lowerIndex]) * interpolation;
}

function resolveTimelineLabelStep(pointCount: number) {
  if (pointCount <= 12) return 1;
  if (pointCount <= 20) return 2;
  if (pointCount <= 32) return 3;
  return 4;
}

function formatMembershipStatus(status: string, t: (key: string) => string) {
  const normalized = status.toUpperCase();
  if (normalized === "ACTIVE") return t("renewalForecastReport.status.active");
  if (normalized === "PENDING") return t("renewalForecastReport.status.pending");
  if (normalized === "EXPIRED") return t("renewalForecastReport.status.expired");
  if (normalized === "SUSPENDED") return t("renewalForecastReport.status.suspended");
  if (normalized === "CANCELLED") return t("renewalForecastReport.status.cancelled");
  return status;
}

function formatSuggestedAction(item: RenewalForecastItem, t: (key: string) => string) {
  if (item.suggestedAction === "Call") return t("renewalForecastReport.actions.call");
  if (item.suggestedAction === "SMS") return t("renewalForecastReport.actions.sms");
  if (item.suggestedAction === "Visit") return t("renewalForecastReport.actions.visit");
  return item.suggestedAction;
}

function resolveNumberLocale(language: string) {
  const base = language.split("-")[0];
  if (base === "fa") return "fa-AF";
  if (base === "ps") return "ps-AF";
  return "en-US";
}

function resolveCurrencyLabel(locale: string) {
  if (locale.startsWith("fa")) return "افغانی";
  if (locale.startsWith("ps")) return "افغانۍ";
  return "AFN";
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

function base64ToBlob(value: string, contentType: string) {
  const binary = window.atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return new Blob([bytes], { type: contentType || "application/pdf" });
}

async function loadMemberFilterOptions() {
  let skip = 0;
  let total = 0;
  const options: MemberFilterOption[] = [];

  do {
    const { data } = await getMembers({ take: MEMBER_FILTER_PAGE_SIZE, skip });
    const items = data.items ?? [];
    total = Number(data.total ?? 0);
    options.push(
      ...items.map((member) => ({
        code: String(member.code ?? ""),
        label: formatMemberFilterLabel(member),
      }))
    );
    skip += items.length;
    if (!items.length) break;
  } while (skip < total && skip < MEMBER_FILTER_LIMIT);

  const unique = new Map(options.map((option) => [option.code, option]));
  return [...unique.values()].sort((left, right) => left.label.localeCompare(right.label, undefined, { sensitivity: "base" }));
}

function formatMemberFilterLabel(member: Pick<Member, "code" | "firstName" | "lastName">) {
  const fullName = `${member.firstName ?? ""} ${member.lastName ?? ""}`.trim();
  if (fullName) return `${fullName} (#${member.code})`;
  return `#${member.code}`;
}
