import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { IconFileExport, IconFileSpreadsheet } from "@tabler/icons-react";
import { getMembers, type Member } from "../../api/members";
import {
  downloadPayrollVarianceCsv,
  downloadPayrollVarianceXlsx,
  getPayrollVarianceReport,
  type PayrollVarianceItem,
  type PayrollVarianceQuery,
  type PayrollVarianceReportResponse,
} from "../../api/payrollVarianceReport";
import { getStaffGroups, type StaffGroup } from "../../api/staffGroups";
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
import { CloseIconButton } from "../../components/CloseIconButton";
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
import { LocalizedMonthInput } from "../../components/ui/LocalizedMonthInput";
import { resolveGregorianMonthLocale } from "../../shared/dateLocale";

type Filters = {
  monthValue: string;
  memberId: string;
  staffGroupId: string;
  search: string;
  sortBy: NonNullable<PayrollVarianceQuery["sortBy"]>;
  sortDir: NonNullable<PayrollVarianceQuery["sortDir"]>;
  smallThreshold: number;
  mediumThreshold: number;
  page: number;
};

const CARD_CLASS = "rounded-2xl border border-slate-200/80 bg-white/90 p-3 shadow-sm dark:border-slate-800/80 dark:bg-slate-950/70";
const FILTER_CARD_CLASS = REPORT_FILTER_PANEL_CLASS;
const INPUT_CLASS = REPORT_FILTER_FIELD_CLASS;
const LABEL_CLASS = REPORT_FILTER_LABEL_CLASS;
const PAGE_SIZE = 20;

const EMPTY_REPORT: PayrollVarianceReportResponse = {
  generatedAt: new Date(0).toISOString(),
  filters: {
    year: 2000,
    month: 1,
    memberId: null,
    staffGroupId: null,
    search: null,
    sortBy: "absoluteVariance",
    sortDir: "desc",
    smallThreshold: 1000,
    mediumThreshold: 5000,
  },
  kpis: {
    totalSuggested: 0,
    totalPaid: 0,
    totalVariance: 0,
    varianceRate: 0,
    topVarianceEmployees: [],
  },
  charts: {
    suggestedVsPaid: [],
    varianceBuckets: { zero: 0, small: 0, medium: 0, large: 0 },
  },
  items: [],
  pageInfo: { page: 1, pageSize: PAGE_SIZE, totalItems: 0, totalPages: 1 },
};

function createDefaultFilters(): Filters {
  return {
    monthValue: toMonthInputValue(new Date()),
    memberId: "",
    staffGroupId: "",
    search: "",
    sortBy: "absoluteVariance",
    sortDir: "desc",
    smallThreshold: 1000,
    mediumThreshold: 5000,
    page: 1,
  };
}

function areFiltersEqual(left: Filters, right: Filters) {
  return (
    left.monthValue === right.monthValue &&
    left.memberId === right.memberId &&
    left.staffGroupId === right.staffGroupId &&
    left.search === right.search &&
    left.sortBy === right.sortBy &&
    left.sortDir === right.sortDir &&
    left.smallThreshold === right.smallThreshold &&
    left.mediumThreshold === right.mediumThreshold &&
    left.page === right.page
  );
}

export function PayrollVarianceReportPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { push } = useToast();
  const numberLocale = useMemo(() => resolveNumberLocale(i18n.language), [i18n.language]);

  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState<"csv" | "xlsx" | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [groups, setGroups] = useState<StaffGroup[]>([]);
  const [detailItem, setDetailItem] = useState<PayrollVarianceItem | null>(null);
  const [report, setReport] = useState<PayrollVarianceReportResponse>(EMPTY_REPORT);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filters, setFilters] = useState<Filters>(() => createDefaultFilters());
  const [appliedFilters, setAppliedFilters] = useState<Filters>(() => createDefaultFilters());

  useEffect(() => {
    let mounted = true;
    Promise.all([getMembers({ memberType: "STAFF", take: 100 }), getStaffGroups()])
      .then(([membersRes, groupsRes]) => {
        if (!mounted) return;
        setMembers(membersRes.data.items ?? []);
        setGroups(groupsRes.data ?? []);
      })
      .catch(() => {
        if (!mounted) return;
        setMembers([]);
        setGroups([]);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const parsedMonth = useMemo(() => parseMonthInput(appliedFilters.monthValue), [appliedFilters.monthValue]);

  const query = useMemo<PayrollVarianceQuery>(
    () => ({
      year: parsedMonth.year,
      month: parsedMonth.month,
      memberId: appliedFilters.memberId || undefined,
      staffGroupId: appliedFilters.staffGroupId || undefined,
      search: appliedFilters.search.trim() || undefined,
      sortBy: appliedFilters.sortBy,
      sortDir: appliedFilters.sortDir,
      smallThreshold: appliedFilters.smallThreshold,
      mediumThreshold: appliedFilters.mediumThreshold,
      page: appliedFilters.page,
      pageSize: PAGE_SIZE,
    }),
    [appliedFilters, parsedMonth]
  );

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    getPayrollVarianceReport(query)
      .then(({ data }) => {
        if (!mounted) return;
        setReport(data);
      })
      .catch((error) => {
        if (!mounted) return;
        setReport(EMPTY_REPORT);
        push({ kind: "error", title: error instanceof Error ? error.message : t("payrollVarianceReport.toast.loadFailed") });
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
      year: parsedMonth.year,
      month: parsedMonth.month,
      memberId: appliedFilters.memberId || undefined,
      staffGroupId: appliedFilters.staffGroupId || undefined,
      search: appliedFilters.search.trim() || undefined,
      sortBy: appliedFilters.sortBy,
      sortDir: appliedFilters.sortDir,
      smallThreshold: appliedFilters.smallThreshold,
      mediumThreshold: appliedFilters.mediumThreshold,
    }),
    [appliedFilters, parsedMonth]
  );

  const handleExport = async (kind: "csv" | "xlsx") => {
    setExporting(kind);
    try {
      if (kind === "csv") {
        const { data } = await downloadPayrollVarianceCsv(exportParams);
        saveBlob(data, `payroll-variance-${appliedFilters.monthValue}.csv`);
      } else {
        const { data } = await downloadPayrollVarianceXlsx(exportParams);
        saveBlob(data, `payroll-variance-${appliedFilters.monthValue}.xlsx`);
      }
      push({ kind: "success", title: t("payrollVarianceReport.toast.exportCompleted") });
    } catch (error) {
      push({ kind: "error", title: error instanceof Error ? error.message : t("payrollVarianceReport.toast.exportFailed") });
    } finally {
      setExporting(null);
    }
  };

  const chartMax = Math.max(1, ...report.charts.suggestedVsPaid.flatMap((row) => [Math.abs(row.suggested), Math.abs(row.paid)]));
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
    subtitle: t("payrollVarianceReport.header.title"),
  });

  return (
    <>
      <div className="reports-page space-y-4">
      <section className={CARD_CLASS}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{t("payrollVarianceReport.header.title")}</h2>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">{t("payrollVarianceReport.header.subtitle")}</p>
          </div>
          <button
            type="button"
            onClick={() => navigate("/reports")}
            className="report-back-btn rounded-lg px-2.5 py-1 text-[11px] font-semibold transition"
          >
            {t("payrollVarianceReport.header.backToReports")}
          </button>
        </div>
      </section>

      <ReportFiltersPanel
        open={filtersOpen}
        onToggle={() => setFiltersOpen((value) => !value)}
        toggleLabel={toggleLabel}
        className={FILTER_CARD_CLASS}
        gridClassName="attendance-report-filters__grid grid gap-2.5 rounded-xl p-3 lg:grid-cols-7"
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
                {exporting === "csv" ? t("payrollVarianceReport.filters.exporting") : t("payrollVarianceReport.filters.exportCsv")}
              </span>
            </button>
            <button
              type="button"
              disabled={exporting !== null}
              onClick={() => handleExport("xlsx")}
              className="attendance-export-btn inline-flex h-8 min-w-24 items-center justify-center gap-1.5 rounded-lg border border-brand-500 bg-brand-500 px-2.5 text-[11px] font-semibold text-white transition hover:bg-brand-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/30 disabled:opacity-45"
            >
              <IconFileSpreadsheet className="h-3.5 w-3.5" stroke={1.8} />
              {exporting === "xlsx" ? t("payrollVarianceReport.filters.exporting") : t("payrollVarianceReport.filters.exportXlsx")}
            </button>
          </div>
        }
      >
          <label className="flex flex-col gap-1">
            <span className={LABEL_CLASS}>{t("payrollVarianceReport.filters.month")}</span>
            <LocalizedMonthInput
              value={filters.monthValue}
              onChange={(value) => setFilters((prev) => ({ ...prev, monthValue: value, page: 1 }))}
              locale={i18n.language}
              inputClassName={INPUT_CLASS}
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className={LABEL_CLASS}>{t("payrollVarianceReport.filters.staff")}</span>
            <DropdownSelect
              buttonClassName={INPUT_CLASS}
              value={filters.memberId}
              onChange={(value) => setFilters((prev) => ({ ...prev, memberId: value, page: 1 }))}
              options={[
                { value: "", label: t("payrollVarianceReport.filters.allStaff") },
                ...members.map((member) => ({
                  value: member.id,
                  label: `${member.firstName} ${member.lastName ?? ""} (#${member.code})`,
                })),
              ]}
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className={LABEL_CLASS}>{t("payrollVarianceReport.filters.group")}</span>
            <DropdownSelect
              buttonClassName={INPUT_CLASS}
              value={filters.staffGroupId}
              onChange={(value) => setFilters((prev) => ({ ...prev, staffGroupId: value, page: 1 }))}
              options={[
                { value: "", label: t("payrollVarianceReport.filters.allGroups") },
                ...groups.map((group) => ({ value: group.id, label: group.name })),
              ]}
            />
          </label>

          <label className="flex flex-col gap-1 lg:col-span-2 lg:max-w-[20rem]">
            <span className={LABEL_CLASS}>{t("payrollVarianceReport.filters.search")}</span>
            <DropdownSelect
              buttonClassName={`${INPUT_CLASS} h-8 text-[11px]`}
              value={filters.search}
              onChange={(value) => setFilters((prev) => ({ ...prev, search: value, page: 1 }))}
              options={[
                { value: "", label: t("payrollVarianceReport.filters.searchPlaceholder") },
                ...members.map((member) => ({
                  value: member.code,
                  label: `${member.firstName} ${member.lastName ?? ""}`.trim()
                    ? `${`${member.firstName} ${member.lastName ?? ""}`.trim()} (#${member.code})`
                    : `#${member.code}`,
                })),
              ]}
            />
          </label>

          <div className="flex items-end justify-end lg:col-start-7 lg:row-start-1">
            <button
              type="button"
              className="attendance-export-btn inline-flex h-8 min-w-24 items-center justify-center gap-1.5 rounded-lg border border-brand-500 bg-brand-500 px-2.5 text-[11px] font-semibold text-white transition hover:bg-brand-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/30 disabled:opacity-45"
              disabled={!hasPendingFilterChanges || loading}
              onClick={applyFilters}
            >
              {t("common.actions.applyFilters")}
            </button>
          </div>

      </ReportFiltersPanel>

      <section className="report-kpi-grid grid gap-2.5 sm:grid-cols-2 xl:grid-cols-5">
        <MetricCard label={t("payrollVarianceReport.kpis.totalSuggested")} value={formatAmount(report.kpis.totalSuggested, numberLocale)} tone="amber" />
        <MetricCard label={t("payrollVarianceReport.kpis.totalPaid")} value={formatAmount(report.kpis.totalPaid, numberLocale)} tone="emerald" />
        <MetricCard label={t("payrollVarianceReport.kpis.totalVariance")} value={formatAmount(report.kpis.totalVariance, numberLocale)} tone="rose" />
        <MetricCard label={t("payrollVarianceReport.kpis.varianceRate")} value={`${formatPercent(report.kpis.varianceRate, numberLocale)}%`} tone="sky" />
        <MetricCard label={t("payrollVarianceReport.kpis.topVarianceStaff")} value={formatCount(report.kpis.topVarianceEmployees.length, numberLocale)} tone="slate" />
      </section>

      <section className={CARD_CLASS}>
        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{t("payrollVarianceReport.trend.title")}</h3>
        {report.charts.suggestedVsPaid.length ? (
          <div className="mt-2.5 grid gap-2">
            {report.charts.suggestedVsPaid.map((row) => (
              <div key={row.label} className="space-y-1">
                <div className="flex items-center justify-between text-[11px] text-slate-600 dark:text-slate-300">
                  <span>{row.label}</span>
                  <span>{formatAmount(row.variance, numberLocale)}</span>
                </div>
                <div className="grid grid-cols-2 gap-1">
                  <div className="h-2 rounded-full bg-amber-500/30">
                    <div className="h-2 rounded-full bg-amber-500/80" style={{ width: `${Math.max(2, Math.round((Math.abs(row.suggested) / chartMax) * 100))}%` }} />
                  </div>
                  <div className="h-2 rounded-full bg-emerald-500/30">
                    <div className="h-2 rounded-full bg-emerald-500/80" style={{ width: `${Math.max(2, Math.round((Math.abs(row.paid) / chartMax) * 100))}%` }} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-2.5 text-[11px] text-slate-500 dark:text-slate-400">{t("payrollVarianceReport.trend.empty")}</p>
        )}
      </section>

      <section className={CARD_CLASS}>
        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{t("payrollVarianceReport.buckets.title")}</h3>
        <div className="mt-2.5 grid grid-cols-4 gap-2 text-center text-[11px]">
          <BucketCard label={t("payrollVarianceReport.buckets.zero")} value={report.charts.varianceBuckets.zero} tone="emerald" />
          <BucketCard label={t("payrollVarianceReport.buckets.small")} value={report.charts.varianceBuckets.small} tone="amber" />
          <BucketCard label={t("payrollVarianceReport.buckets.medium")} value={report.charts.varianceBuckets.medium} tone="rose" />
          <BucketCard label={t("payrollVarianceReport.buckets.large")} value={report.charts.varianceBuckets.large} tone="slate" />
        </div>
      </section>

      <section className={CARD_CLASS}>
        <DataTableShell>
          <DataTable variant="report" minWidth="940px">
            <DataTableHead>
              <DataTableRow>
                <DataTableHeaderCell>{t("payrollVarianceReport.table.employee")}</DataTableHeaderCell>
                <DataTableHeaderCell>{t("payrollVarianceReport.table.period")}</DataTableHeaderCell>
                <DataTableHeaderCell align="end">{t("payrollVarianceReport.table.suggested")}</DataTableHeaderCell>
                <DataTableHeaderCell align="end">{t("payrollVarianceReport.table.actualPaid")}</DataTableHeaderCell>
                <DataTableHeaderCell align="end">{t("payrollVarianceReport.table.variance")}</DataTableHeaderCell>
                <DataTableHeaderCell>{t("payrollVarianceReport.table.varianceReason")}</DataTableHeaderCell>
                <DataTableHeaderCell>{t("payrollVarianceReport.table.paymentStatus")}</DataTableHeaderCell>
                <DataTableHeaderCell align="end">{t("payrollVarianceReport.table.actions")}</DataTableHeaderCell>
              </DataTableRow>
            </DataTableHead>
            <DataTableBody>
              {loading ? (
                <DataTableEmptyRow colSpan={8}>{t("payrollVarianceReport.table.loading")}</DataTableEmptyRow>
              ) : report.items.length === 0 ? (
                <DataTableEmptyRow colSpan={8}>{t("payrollVarianceReport.table.empty")}</DataTableEmptyRow>
              ) : (
                report.items.map((item) => (
                  <DataTableRow key={item.memberId}>
                    <DataTableCell>
                      <div className="font-semibold text-slate-900 dark:text-slate-100">{item.memberName}</div>
                      <div className="text-[10px] text-slate-500">#{item.memberCode}</div>
                    </DataTableCell>
                    <DataTableCell>
                      {formatMonthLabel(item.period.year, item.period.month, i18n.language)}
                    </DataTableCell>
                    <DataTableCell align="end">{formatAmount(item.suggestedPay, numberLocale)}</DataTableCell>
                    <DataTableCell align="end">{formatAmount(item.actualPaid, numberLocale)}</DataTableCell>
                    <DataTableCell align="end" className={`font-semibold ${item.variance < 0 ? "text-rose-600 dark:text-rose-300" : "text-emerald-600 dark:text-emerald-300"}`}>
                      {formatAmount(item.variance, numberLocale)}
                    </DataTableCell>
                    <DataTableCell>{item.varianceReason || "-"}</DataTableCell>
                    <DataTableCell>{formatPaymentStatus(item.paymentStatus, t)}</DataTableCell>
                    <DataTableCell align="end">
                      <button
                        type="button"
                        onClick={() => setDetailItem(item)}
                        className="rounded-lg border border-brand-500/40 px-2 py-0.5 text-[10px] text-brand-600 dark:text-brand-300"
                      >
                        {t("payrollVarianceReport.table.view")}
                      </button>
                    </DataTableCell>
                  </DataTableRow>
                ))
              )}
            </DataTableBody>
          </DataTable>
        </DataTableShell>
        <ReportPager
          rangeLabel={t("payrollVarianceReport.table.rangeOfTotal", {
            start: formatCount(rangeStart, numberLocale),
            end: formatCount(rangeEnd, numberLocale),
            total: formatCount(report.pageInfo.totalItems, numberLocale),
          })}
          pageLabel={`${formatCount(report.pageInfo.page, numberLocale)} / ${formatCount(report.pageInfo.totalPages, numberLocale)}`}
          previousLabel={t("payrollVarianceReport.table.prev")}
          nextLabel={t("payrollVarianceReport.table.next")}
          canPrevious={report.pageInfo.page > 1}
          canNext={report.pageInfo.page < report.pageInfo.totalPages}
          onPrevious={() => goToPage(Math.max(1, report.pageInfo.page - 1))}
          onNext={() => goToPage(Math.min(report.pageInfo.totalPages, report.pageInfo.page + 1))}
        />
      </section>

      {detailItem ? (
        <VarianceDetailModal item={detailItem} locale={numberLocale} onClose={() => setDetailItem(null)} />
      ) : null}
      </div>
    </>
  );
}

function VarianceDetailModal({ item, locale, onClose }: { item: PayrollVarianceItem; locale: string; onClose: () => void }) {
  const { t } = useTranslation();
  const breakdown = item.breakdown;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="w-full max-w-4xl rounded-2xl border border-slate-200 bg-white p-3 shadow-2xl dark:border-slate-800 dark:bg-slate-950"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            {item.memberName} | {formatMonthLabel(item.period.year, item.period.month, locale)}
          </h3>
          <CloseIconButton label={t("payrollVarianceReport.detail.close")} onClick={onClose} />
        </div>

        {breakdown ? (
          <div className="mt-2.5 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
            <MetricCard label={t("payrollVarianceReport.detail.base")} value={formatAmount(breakdown.baseAmount, locale)} tone="slate" />
            <MetricCard label={t("payrollVarianceReport.detail.deductions")} value={formatAmount(breakdown.deductions, locale)} tone="rose" />
            <MetricCard label={t("payrollVarianceReport.detail.additions")} value={formatAmount(breakdown.additions, locale)} tone="emerald" />
            <MetricCard label={t("payrollVarianceReport.detail.adjustment")} value={formatAmount(breakdown.totalAdjustment, locale)} tone="amber" />
            <MetricCard label={t("payrollVarianceReport.detail.suggested")} value={formatAmount(breakdown.suggestedPay, locale)} tone="sky" />
          </div>
        ) : (
          <p className="mt-2.5 text-[11px] text-slate-500">{t("payrollVarianceReport.detail.noBreakdown")}</p>
        )}

        <DataTableShell className="mt-3">
          <DataTable variant="report" minWidth="560px">
            <DataTableHead>
              <DataTableRow>
                <DataTableHeaderCell>{t("payrollVarianceReport.detail.amount")}</DataTableHeaderCell>
                <DataTableHeaderCell>{t("payrollVarianceReport.detail.status")}</DataTableHeaderCell>
                <DataTableHeaderCell>{t("payrollVarianceReport.detail.paidAt")}</DataTableHeaderCell>
                <DataTableHeaderCell>{t("payrollVarianceReport.detail.notes")}</DataTableHeaderCell>
              </DataTableRow>
            </DataTableHead>
            <DataTableBody>
              {item.payments.length === 0 ? (
                <DataTableEmptyRow colSpan={4}>{t("payrollVarianceReport.detail.noPayments")}</DataTableEmptyRow>
              ) : (
                item.payments.map((payment) => (
                  <DataTableRow key={payment.id}>
                    <DataTableCell>{formatAmount(payment.amount, locale)}</DataTableCell>
                    <DataTableCell>{formatPaymentStatus(payment.status, t)}</DataTableCell>
                    <DataTableCell>{payment.paidAt ? payment.paidAt.slice(0, 10) : "-"}</DataTableCell>
                    <DataTableCell>{payment.notes || "-"}</DataTableCell>
                  </DataTableRow>
                ))
              )}
            </DataTableBody>
          </DataTable>
        </DataTableShell>
      </div>
    </div>
  );
}

function MetricCard({ label, value, tone }: { label: string; value: string; tone: "slate" | "rose" | "amber" | "emerald" | "sky" }) {
  const toneClass =
    tone === "rose"
      ? "report-kpi-card--rose"
      : tone === "amber"
        ? "report-kpi-card--amber"
        : tone === "emerald"
          ? "report-kpi-card--emerald"
          : tone === "sky"
            ? "report-kpi-card--sky"
            : "report-kpi-card--slate";
  return (
    <article className={`report-kpi-card ${toneClass}`}>
      <p className="report-kpi-card__label">{label}</p>
      <p className="report-kpi-card__value">{value}</p>
      <span className="report-kpi-card__glow" aria-hidden="true" />
    </article>
  );
}

function BucketCard({ label, value, tone }: { label: string; value: number; tone: "slate" | "rose" | "amber" | "emerald" }) {
  const toneClass =
    tone === "rose"
      ? "border-rose-200/80 bg-rose-50/70 dark:border-rose-900/50 dark:bg-rose-950/30"
      : tone === "amber"
        ? "border-amber-200/80 bg-amber-50/70 dark:border-amber-900/50 dark:bg-amber-950/30"
        : tone === "emerald"
          ? "border-emerald-200/80 bg-emerald-50/70 dark:border-emerald-900/50 dark:bg-emerald-950/30"
          : "border-slate-200/80 bg-slate-50/70 dark:border-slate-800/80 dark:bg-slate-900/40";
  return (
    <div className={`rounded-xl border p-2.5 ${toneClass}`}>
      <p className="text-[11px] text-slate-500">{label}</p>
      <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-slate-100">{value}</p>
    </div>
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

function formatPercent(value: number, locale: string) {
  return new Intl.NumberFormat(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
}

function formatPaymentStatus(status: string, t: (key: string) => string) {
  const normalized = status.toUpperCase();
  if (normalized === "PAID") return t("payrollVarianceReport.paymentStatus.paid");
  if (normalized === "PENDING") return t("payrollVarianceReport.paymentStatus.pending");
  if (normalized === "FAILED") return t("payrollVarianceReport.paymentStatus.failed");
  if (normalized === "REFUNDED") return t("payrollVarianceReport.paymentStatus.refunded");
  return status;
}

function parseMonthInput(value: string) {
  const [yearText = "", monthText = ""] = value.split("-");
  const year = Number(yearText);
  const month = Number(monthText);
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() + 1 };
  }
  return { year, month };
}

function toMonthInputValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

function formatMonthLabel(year: number, month: number, locale: string) {
  const date = new Date(year, month - 1, 1);
  return date.toLocaleString(resolveGregorianMonthLocale(locale), { month: "long", year: "numeric" });
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


