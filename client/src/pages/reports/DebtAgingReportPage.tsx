import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { IconFileExport, IconFileSpreadsheet } from "@tabler/icons-react";
import {
  downloadDebtAgingCsv,
  downloadDebtAgingXlsx,
  getDebtAgingReport,
  type DebtAgingQuery,
  type DebtAgingReportItem,
  type DebtAgingReportResponse,
} from "../../api/debtAgingReport";
import { getMembers, type Member } from "../../api/members";
import { listPlans } from "../../api/membershipPlans";
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
import type { MembershipPlanDTO } from "../../shared/membershipTypes";

type Filters = {
  dateField: NonNullable<DebtAgingQuery["dateField"]>;
  from: string;
  to: string;
  status: "" | NonNullable<DebtAgingQuery["status"]>;
  planId: string;
  memberType: NonNullable<DebtAgingQuery["memberType"]>;
  staffGroupId: string;
  search: string;
  bucket1: number;
  bucket2: number;
  bucket3: number;
  sortBy: NonNullable<DebtAgingQuery["sortBy"]>;
  sortDir: NonNullable<DebtAgingQuery["sortDir"]>;
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

const EMPTY_REPORT: DebtAgingReportResponse = {
  generatedAt: new Date(0).toISOString(),
  filters: {
    dateField: "END_DATE",
    from: null,
    to: null,
    status: null,
    planId: null,
    memberType: "all",
    staffGroupId: null,
    search: null,
    bucket1: 30,
    bucket2: 60,
    bucket3: 90,
    sortBy: "remaining",
    sortDir: "desc",
  },
  kpis: { totalOutstanding: 0, countDebtors: 0, avgDebt: 0, largestDebt: 0, collectionRate: 0 },
  charts: { bucketTotals: [], monthlyTrend: [] },
  items: [],
  pageInfo: { page: 1, pageSize: PAGE_SIZE, totalItems: 0, totalPages: 1 },
};

function createDefaultFilters(): Filters {
  return {
    dateField: "END_DATE",
    from: dateOffsetInput(-90),
    to: dateInput(new Date()),
    status: "",
    planId: "",
    memberType: "all",
    staffGroupId: "",
    search: "",
    bucket1: 30,
    bucket2: 60,
    bucket3: 90,
    sortBy: "remaining",
    sortDir: "desc",
    page: 1,
  };
}

function areFiltersEqual(left: Filters, right: Filters) {
  return (
    left.dateField === right.dateField &&
    left.from === right.from &&
    left.to === right.to &&
    left.status === right.status &&
    left.planId === right.planId &&
    left.memberType === right.memberType &&
    left.staffGroupId === right.staffGroupId &&
    left.search === right.search &&
    left.bucket1 === right.bucket1 &&
    left.bucket2 === right.bucket2 &&
    left.bucket3 === right.bucket3 &&
    left.sortBy === right.sortBy &&
    left.sortDir === right.sortDir &&
    left.page === right.page
  );
}

export function DebtAgingReportPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { push } = useToast();
  const numberLocale = useMemo(() => resolveNumberLocale(i18n.language), [i18n.language]);

  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState<"csv" | "xlsx" | null>(null);
  const [report, setReport] = useState<DebtAgingReportResponse>(EMPTY_REPORT);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [plans, setPlans] = useState<MembershipPlanDTO[]>([]);
  const [groups, setGroups] = useState<StaffGroup[]>([]);
  const [members, setMembers] = useState<MemberFilterOption[]>([]);
  const [filters, setFilters] = useState<Filters>(() => createDefaultFilters());
  const [appliedFilters, setAppliedFilters] = useState<Filters>(() => createDefaultFilters());

  useEffect(() => {
    let mounted = true;
    Promise.all([listPlans(), getStaffGroups(), loadMemberFilterOptions()])
      .then(([plansRes, groupsRes, memberOptions]) => {
        if (!mounted) return;
        setPlans(plansRes.data ?? []);
        setGroups(groupsRes.data ?? []);
        setMembers(memberOptions);
      })
      .catch(() => {
        if (!mounted) return;
        setPlans([]);
        setGroups([]);
        setMembers([]);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const query = useMemo<DebtAgingQuery>(
    () => ({
      dateField: appliedFilters.dateField,
      from: appliedFilters.from,
      to: appliedFilters.to,
      status: appliedFilters.status || undefined,
      planId: appliedFilters.planId || undefined,
      memberType: appliedFilters.memberType,
      staffGroupId: appliedFilters.staffGroupId || undefined,
      search: appliedFilters.search.trim() || undefined,
      bucket1: appliedFilters.bucket1,
      bucket2: appliedFilters.bucket2,
      bucket3: appliedFilters.bucket3,
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
    getDebtAgingReport(query)
      .then(({ data }) => {
        if (!mounted) return;
        setReport(data);
      })
      .catch((error) => {
        if (!mounted) return;
        setReport(EMPTY_REPORT);
        push({ kind: "error", title: error instanceof Error ? error.message : t("debtAgingReport.toast.loadFailed") });
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
      dateField: appliedFilters.dateField,
      from: appliedFilters.from,
      to: appliedFilters.to,
      status: appliedFilters.status || undefined,
      planId: appliedFilters.planId || undefined,
      memberType: appliedFilters.memberType,
      staffGroupId: appliedFilters.staffGroupId || undefined,
      search: appliedFilters.search.trim() || undefined,
      bucket1: appliedFilters.bucket1,
      bucket2: appliedFilters.bucket2,
      bucket3: appliedFilters.bucket3,
      sortBy: appliedFilters.sortBy,
      sortDir: appliedFilters.sortDir,
    }),
    [appliedFilters]
  );

  const handleExport = async (kind: "csv" | "xlsx") => {
    setExporting(kind);
    try {
      if (kind === "csv") {
        const { data } = await downloadDebtAgingCsv(exportParams);
        saveBlob(data, `debt-aging-${appliedFilters.from}-to-${appliedFilters.to}.csv`);
      } else {
        const { data } = await downloadDebtAgingXlsx(exportParams);
        saveBlob(data, `debt-aging-${appliedFilters.from}-to-${appliedFilters.to}.xlsx`);
      }
      push({ kind: "success", title: t("debtAgingReport.toast.exportCompleted") });
    } catch (error) {
      push({ kind: "error", title: error instanceof Error ? error.message : t("debtAgingReport.toast.exportFailed") });
    } finally {
      setExporting(null);
    }
  };

  const bucketMax = Math.max(1, ...report.charts.bucketTotals.map((item) => item.totalOutstanding));
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
    subtitle: t("debtAgingReport.header.title"),
  });

  return (
    <>
      <div className="reports-page space-y-4">
      <section className={CARD_CLASS}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{t("debtAgingReport.header.title")}</h2>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">{t("debtAgingReport.header.subtitle")}</p>
          </div>
          <button
            type="button"
            onClick={() => navigate("/reports")}
            className="report-back-btn rounded-lg px-2.5 py-1 text-[11px] font-semibold transition"
          >
            {t("debtAgingReport.header.backToReports")}
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
              onClick={() => handleExport("csv")}
              disabled={exporting !== null}
              className={`${REPORT_FILTER_ACTION_CLASS} financial-export-action h-8 min-w-24 px-2.5 text-[11px]`}
            >
              <span className="inline-flex items-center gap-1.5">
                <IconFileExport className="h-3.5 w-3.5" stroke={1.8} />
                {exporting === "csv" ? t("debtAgingReport.filters.exporting") : t("debtAgingReport.filters.exportCsv")}
              </span>
            </button>
            <button
              type="button"
              onClick={() => handleExport("xlsx")}
              disabled={exporting !== null}
              className="attendance-export-btn inline-flex h-8 min-w-24 items-center justify-center gap-1.5 rounded-lg border border-brand-500 bg-brand-500 px-2.5 text-[11px] font-semibold text-white transition hover:bg-brand-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/30 disabled:opacity-45"
            >
              <IconFileSpreadsheet className="h-3.5 w-3.5" stroke={1.8} />
              {exporting === "xlsx" ? t("debtAgingReport.filters.exporting") : t("debtAgingReport.filters.exportXlsx")}
            </button>
          </div>
        }
      >
          <label className="flex flex-col gap-1">
            <span className={LABEL_CLASS}>{t("debtAgingReport.filters.dateField")}</span>
            <DropdownSelect
              buttonClassName={INPUT_CLASS}
              value={filters.dateField}
              onChange={(value) => setFilters((prev) => ({ ...prev, dateField: value as Filters["dateField"], page: 1 }))}
              options={[
                { value: "END_DATE", label: t("debtAgingReport.filters.dateFieldEndDate") },
                { value: "CREATED_AT", label: t("debtAgingReport.filters.dateFieldCreatedAt") },
                { value: "START_DATE", label: t("debtAgingReport.filters.dateFieldStartDate") },
                { value: "ACTIVATED_AT", label: t("debtAgingReport.filters.dateFieldActivatedAt") },
              ]}
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className={LABEL_CLASS}>{t("debtAgingReport.filters.from")}</span>
            <ShamsiDateInput
              value={filters.from}
              onChange={(value) => setFilters((prev) => ({ ...prev, from: value, page: 1 }))}
              locale={i18n.language}
              inputClassName={INPUT_CLASS}
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className={LABEL_CLASS}>{t("debtAgingReport.filters.to")}</span>
            <ShamsiDateInput
              value={filters.to}
              onChange={(value) => setFilters((prev) => ({ ...prev, to: value, page: 1 }))}
              locale={i18n.language}
              inputClassName={INPUT_CLASS}
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className={LABEL_CLASS}>{t("debtAgingReport.filters.status")}</span>
            <DropdownSelect
              buttonClassName={INPUT_CLASS}
              value={filters.status}
              onChange={(value) => setFilters((prev) => ({ ...prev, status: value as Filters["status"], page: 1 }))}
              options={[
                { value: "", label: t("debtAgingReport.filters.allStatuses") },
                { value: "ACTIVE", label: t("debtAgingReport.status.active") },
                { value: "PENDING", label: t("debtAgingReport.status.pending") },
                { value: "EXPIRED", label: t("debtAgingReport.status.expired") },
                { value: "SUSPENDED", label: t("debtAgingReport.status.suspended") },
                { value: "CANCELLED", label: t("debtAgingReport.status.cancelled") },
              ]}
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className={LABEL_CLASS}>{t("debtAgingReport.filters.plan")}</span>
            <DropdownSelect
              buttonClassName={INPUT_CLASS}
              value={filters.planId}
              onChange={(value) => setFilters((prev) => ({ ...prev, planId: value, page: 1 }))}
              options={[
                { value: "", label: t("debtAgingReport.filters.allPlans") },
                ...plans.map((plan) => ({ value: plan.id, label: plan.name })),
              ]}
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className={LABEL_CLASS}>{t("debtAgingReport.filters.memberType")}</span>
            <DropdownSelect
              buttonClassName={INPUT_CLASS}
              value={filters.memberType}
              onChange={(value) => setFilters((prev) => ({ ...prev, memberType: value as Filters["memberType"], page: 1 }))}
              options={[
                { value: "all", label: t("debtAgingReport.filters.memberTypeAll") },
                { value: "customer", label: t("debtAgingReport.filters.memberTypeCustomer") },
                { value: "staff", label: t("debtAgingReport.filters.memberTypeStaff") },
              ]}
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className={LABEL_CLASS}>{t("debtAgingReport.filters.group")}</span>
            <DropdownSelect
              buttonClassName={INPUT_CLASS}
              value={filters.staffGroupId}
              onChange={(value) => setFilters((prev) => ({ ...prev, staffGroupId: value, page: 1 }))}
              options={[
                { value: "", label: t("debtAgingReport.filters.allGroups") },
                ...groups.map((group) => ({ value: group.id, label: group.name })),
              ]}
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className={LABEL_CLASS}>{t("debtAgingReport.filters.search")}</span>
            <DropdownSelect
              buttonClassName={INPUT_CLASS}
              value={filters.search}
              onChange={(value) => setFilters((prev) => ({ ...prev, search: value, page: 1 }))}
              options={[
                { value: "", label: t("debtAgingReport.filters.searchPlaceholder") },
                ...members.map((member) => ({
                  value: member.code,
                  label: member.label,
                })),
              ]}
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className={LABEL_CLASS}>{t("debtAgingReport.filters.bucket1")}</span>
            <input
              type="number"
              min={1}
              value={filters.bucket1}
              onChange={(event) => setFilters((prev) => ({ ...prev, bucket1: Number(event.target.value || 30), page: 1 }))}
              className={INPUT_CLASS}
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className={LABEL_CLASS}>{t("debtAgingReport.filters.bucket2")}</span>
            <input
              type="number"
              min={2}
              value={filters.bucket2}
              onChange={(event) => setFilters((prev) => ({ ...prev, bucket2: Number(event.target.value || 60), page: 1 }))}
              className={INPUT_CLASS}
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className={LABEL_CLASS}>{t("debtAgingReport.filters.bucket3")}</span>
            <input
              type="number"
              min={3}
              value={filters.bucket3}
              onChange={(event) => setFilters((prev) => ({ ...prev, bucket3: Number(event.target.value || 90), page: 1 }))}
              className={INPUT_CLASS}
            />
          </label>

          <div className="flex h-full items-end justify-end">
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
        <MetricCard label={t("debtAgingReport.kpis.totalOutstanding")} value={formatAmount(report.kpis.totalOutstanding, numberLocale)} tone="rose" />
        <MetricCard label={t("debtAgingReport.kpis.debtors")} value={formatCount(report.kpis.countDebtors, numberLocale)} tone="slate" />
        <MetricCard label={t("debtAgingReport.kpis.avgDebt")} value={formatAmount(report.kpis.avgDebt, numberLocale)} tone="amber" />
        <MetricCard label={t("debtAgingReport.kpis.largestDebt")} value={formatAmount(report.kpis.largestDebt, numberLocale)} tone="rose" />
        <MetricCard label={t("debtAgingReport.kpis.collectionRate")} value={`${formatPercent(report.kpis.collectionRate, numberLocale)}%`} tone="emerald" />
      </section>

      <section className={CARD_CLASS}>
        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{t("debtAgingReport.bucketTotals.title")}</h3>
        {report.charts.bucketTotals.length ? (
          <div className="mt-2.5 space-y-2">
            {report.charts.bucketTotals.map((item) => (
              <div key={item.bucket} className="space-y-1">
                <div className="flex items-center justify-between text-[11px] text-slate-600 dark:text-slate-300">
                  <span>{item.label}</span>
                  <span>
                    {formatAmount(item.totalOutstanding, numberLocale)} / {formatCount(item.count, numberLocale)}
                  </span>
                </div>
                <div className="h-2 rounded-full bg-slate-200/80 dark:bg-slate-800/70">
                  <div className="h-2 rounded-full bg-rose-500/80" style={{ width: `${Math.max(2, Math.round((item.totalOutstanding / bucketMax) * 100))}%` }} />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-2.5 text-[11px] text-slate-500 dark:text-slate-400">{t("debtAgingReport.bucketTotals.empty")}</p>
        )}
      </section>

      <section className={CARD_CLASS}>
        <DataTableShell>
          <DataTable variant="report" minWidth="980px">
            <DataTableHead>
              <DataTableRow>
                <DataTableHeaderCell>{t("debtAgingReport.table.member")}</DataTableHeaderCell>
                <DataTableHeaderCell>{t("debtAgingReport.table.type")}</DataTableHeaderCell>
                <DataTableHeaderCell>{t("debtAgingReport.table.plan")}</DataTableHeaderCell>
                <DataTableHeaderCell>{t("debtAgingReport.table.status")}</DataTableHeaderCell>
                <DataTableHeaderCell align="end">{t("debtAgingReport.table.due")}</DataTableHeaderCell>
                <DataTableHeaderCell align="end">{t("debtAgingReport.table.paid")}</DataTableHeaderCell>
                <DataTableHeaderCell align="end">{t("debtAgingReport.table.remaining")}</DataTableHeaderCell>
                <DataTableHeaderCell align="end">{t("debtAgingReport.table.daysPastDue")}</DataTableHeaderCell>
                <DataTableHeaderCell>{t("debtAgingReport.table.bucket")}</DataTableHeaderCell>
                <DataTableHeaderCell>{t("debtAgingReport.table.lastPayment")}</DataTableHeaderCell>
              </DataTableRow>
            </DataTableHead>
            <DataTableBody>
              {loading ? (
                <DataTableEmptyRow colSpan={10}>{t("debtAgingReport.table.loading")}</DataTableEmptyRow>
              ) : report.items.length === 0 ? (
                <DataTableEmptyRow colSpan={10}>{t("debtAgingReport.table.empty")}</DataTableEmptyRow>
              ) : (
                report.items.map((item) => (
                  <DataTableRow key={item.membershipId}>
                    <DataTableCell>
                      <div className="font-semibold text-slate-900 dark:text-slate-100">{item.memberName}</div>
                      <div className="text-[10px] text-slate-500">#{item.memberCode}</div>
                    </DataTableCell>
                    <DataTableCell>{formatMemberType(item.memberType, t)}</DataTableCell>
                    <DataTableCell>{item.planName ?? "-"}</DataTableCell>
                    <DataTableCell>{formatStatus(item.status, t)}</DataTableCell>
                    <DataTableCell align="end">{formatAmount(item.due, numberLocale)}</DataTableCell>
                    <DataTableCell align="end">{formatAmount(item.paid, numberLocale)}</DataTableCell>
                    <DataTableCell align="end" className="font-semibold text-rose-600 dark:text-rose-300">
                      {formatAmount(item.remaining, numberLocale)}
                    </DataTableCell>
                    <DataTableCell align="end">{formatCount(item.daysPastDue, numberLocale)}</DataTableCell>
                    <DataTableCell>{item.bucket}</DataTableCell>
                    <DataTableCell>{item.lastPaymentDate ? item.lastPaymentDate.slice(0, 10) : "-"}</DataTableCell>
                  </DataTableRow>
                ))
              )}
            </DataTableBody>
          </DataTable>
        </DataTableShell>

        <ReportPager
          rangeLabel={t("debtAgingReport.table.rangeOfTotal", {
            start: formatCount(rangeStart, numberLocale),
            end: formatCount(rangeEnd, numberLocale),
            total: formatCount(report.pageInfo.totalItems, numberLocale),
          })}
          pageLabel={`${formatCount(report.pageInfo.page, numberLocale)} / ${formatCount(report.pageInfo.totalPages, numberLocale)}`}
          previousLabel={t("debtAgingReport.table.prev")}
          nextLabel={t("debtAgingReport.table.next")}
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

function MetricCard({ label, value, tone }: { label: string; value: string; tone: "slate" | "rose" | "amber" | "emerald" }) {
  const toneClass =
    tone === "rose"
      ? "report-kpi-card--rose"
      : tone === "amber"
        ? "report-kpi-card--amber"
        : tone === "emerald"
          ? "report-kpi-card--emerald"
          : "report-kpi-card--slate";
  return (
    <article className={`report-kpi-card ${toneClass}`}>
      <p className="report-kpi-card__label">{label}</p>
      <p className="report-kpi-card__value">{value}</p>
      <span className="report-kpi-card__glow" aria-hidden="true" />
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

function formatPercent(value: number, locale: string) {
  return new Intl.NumberFormat(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
}

function formatStatus(status: string, t: (key: string) => string) {
  const normalized = status.toUpperCase();
  if (normalized === "ACTIVE") return t("debtAgingReport.status.active");
  if (normalized === "PENDING") return t("debtAgingReport.status.pending");
  if (normalized === "EXPIRED") return t("debtAgingReport.status.expired");
  if (normalized === "SUSPENDED") return t("debtAgingReport.status.suspended");
  if (normalized === "CANCELLED") return t("debtAgingReport.status.cancelled");
  return status;
}

function formatMemberType(memberType: DebtAgingReportItem["memberType"], t: (key: string) => string) {
  if (memberType === "STAFF") return t("debtAgingReport.memberType.staff");
  return t("debtAgingReport.memberType.customer");
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

function dateOffsetInput(daysOffset: number) {
  const date = new Date();
  date.setDate(date.getDate() + daysOffset);
  return dateInput(date);
}

function dateInput(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
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


