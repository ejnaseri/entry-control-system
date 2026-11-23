import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { IconFileExport } from "@tabler/icons-react";
import {
  downloadMembershipReportCsv,
  getMembershipReport,
  type MembershipReportItem,
  type MembershipReportQuery,
  type MembershipReportResponse,
} from "../../api/membershipReport";
import { getMembers, type Member } from "../../api/members";
import { listPlans } from "../../api/membershipPlans";
import { useToast } from "../../components/ToastContext";
import {
  ReportFilterField,
  ReportFiltersPanel,
  REPORT_FILTER_ACTION_CLASS,
  REPORT_FILTER_FIELD_CLASS,
} from "../../components/reports/ReportFiltersPanel";
import { ReportPager } from "../../components/reports/ReportPager";
import { useGlobalLoading } from "../../components/GlobalLoadingContext";
import { resolveDateLocale } from "../../shared/dateLocale";
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

const CARD_CLASS =
  "rounded-2xl border border-slate-200/80 bg-white/80 p-3 text-slate-900 shadow-sm dark:border-slate-800/80 dark:bg-slate-950/70 dark:text-slate-100";
const FILTER_GRID_CLASS = "attendance-report-filters__grid mt-1 grid gap-2.5 rounded-xl p-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5";
const PAGE_SIZE = 20;
const MEMBER_FILTER_PAGE_SIZE = 100;
const MEMBER_FILTER_LIMIT = 5000;

type RemainingFilter = "ALL" | "WITH_DEBT" | "SETTLED";
type PresetFilter = "LAST_30_DAYS" | "LAST_90_DAYS" | "THIS_MONTH" | "LAST_MONTH" | "THIS_YEAR" | "ALL";
type DateFieldFilter = "CREATED_AT" | "START_DATE" | "END_DATE" | "ACTIVATED_AT";
type StatusFilter = "" | "PENDING" | "ACTIVE" | "EXPIRED" | "SUSPENDED" | "CANCELLED";
type SortByFilter = "END_DATE" | "CREATED_AT" | "START_DATE" | "REMAINING" | "TOTAL_DUE" | "TOTAL_PAID" | "DAYS_LEFT";
type AutoRenewFilter = "ALL" | "YES" | "NO";
type ExpiringFilter = "ALL" | "7" | "30" | "60";
type MemberFilterOption = {
  id: string;
  label: string;
};
type MembershipFiltersState = {
  preset: PresetFilter;
  dateField: DateFieldFilter;
  fromDate: string;
  toDate: string;
  status: StatusFilter;
  remaining: RemainingFilter;
  planId: string;
  memberId: string;
  sortBy: SortByFilter;
  sortDir: "asc" | "desc";
  autoRenew: AutoRenewFilter;
  expiring: ExpiringFilter;
};

const DEFAULT_MEMBERSHIP_FILTERS: MembershipFiltersState = {
  preset: "LAST_90_DAYS",
  dateField: "CREATED_AT",
  fromDate: "",
  toDate: "",
  status: "",
  remaining: "ALL",
  planId: "",
  memberId: "",
  sortBy: "END_DATE",
  sortDir: "desc",
  autoRenew: "ALL",
  expiring: "ALL",
};

export function MembershipReportTab() {
  const { t, i18n } = useTranslation();
  const { push } = useToast();
  const locale = i18n.language;

  const [preset, setPreset] = useState<PresetFilter>(DEFAULT_MEMBERSHIP_FILTERS.preset);
  const [dateField, setDateField] = useState<DateFieldFilter>(DEFAULT_MEMBERSHIP_FILTERS.dateField);
  const [fromDate, setFromDate] = useState(DEFAULT_MEMBERSHIP_FILTERS.fromDate);
  const [toDate, setToDate] = useState(DEFAULT_MEMBERSHIP_FILTERS.toDate);
  const [status, setStatus] = useState<StatusFilter>(DEFAULT_MEMBERSHIP_FILTERS.status);
  const [remaining, setRemaining] = useState<RemainingFilter>(DEFAULT_MEMBERSHIP_FILTERS.remaining);
  const [planId, setPlanId] = useState(DEFAULT_MEMBERSHIP_FILTERS.planId);
  const [memberId, setMemberId] = useState(DEFAULT_MEMBERSHIP_FILTERS.memberId);
  const [sortBy, setSortBy] = useState<SortByFilter>(DEFAULT_MEMBERSHIP_FILTERS.sortBy);
  const [sortDir, setSortDir] = useState<"asc" | "desc">(DEFAULT_MEMBERSHIP_FILTERS.sortDir);
  const [autoRenew, setAutoRenew] = useState<AutoRenewFilter>(DEFAULT_MEMBERSHIP_FILTERS.autoRenew);
  const [expiring, setExpiring] = useState<ExpiringFilter>(DEFAULT_MEMBERSHIP_FILTERS.expiring);
  const [filtersExpanded, setFiltersExpanded] = useState(false);
  const [page, setPage] = useState(0);
  const [refreshKey, setRefreshKey] = useState(0);

  const [report, setReport] = useState<MembershipReportResponse | null>(null);
  const [plans, setPlans] = useState<Array<{ id: string; name: string }>>([]);
  const [members, setMembers] = useState<MemberFilterOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [plansLoading, setPlansLoading] = useState(false);
  const [membersLoading, setMembersLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [appliedFilters, setAppliedFilters] = useState<MembershipFiltersState>(() => DEFAULT_MEMBERSHIP_FILTERS);

  useGlobalLoading(loading, {
    delayMs: 0,
    message: t("common.messages.loading"),
    subtitle: t("reportsPage.membership.title"),
  });

  const currentFilters = useMemo<MembershipFiltersState>(
    () => ({
      preset,
      dateField,
      fromDate,
      toDate,
      status,
      remaining,
      planId,
      memberId,
      sortBy,
      sortDir,
      autoRenew,
      expiring,
    }),
    [preset, dateField, fromDate, toDate, status, remaining, planId, memberId, sortBy, sortDir, autoRenew, expiring]
  );

  const queryBase = useMemo<MembershipReportQuery>(() => buildMembershipQuery(appliedFilters), [appliedFilters]);
  const isDateRangeInvalid = Boolean(fromDate) && Boolean(toDate) && fromDate > toDate;
  const hasPendingFilterChanges = useMemo(() => !areMembershipFiltersEqual(currentFilters, appliedFilters), [appliedFilters, currentFilters]);
  const applyFilters = () => {
    if (isDateRangeInvalid) return;
    setAppliedFilters(currentFilters);
    setPage(0);
  };

  useEffect(() => {
    setPlansLoading(true);
    listPlans(true)
      .then(({ data }) => {
        setPlans(data.map((plan) => ({ id: plan.id, name: plan.name })));
      })
      .catch((err) => {
        push({ kind: "error", title: err instanceof Error ? err.message : t("reportsPage.membership.errors.loadPlans") });
      })
      .finally(() => setPlansLoading(false));
  }, [push, t]);

  useEffect(() => {
    setMembersLoading(true);
    loadMemberFilterOptions()
      .then((options) => {
        setMembers(options);
      })
      .catch(() => {
        setMembers([]);
      })
      .finally(() => setMembersLoading(false));
  }, []);

  useEffect(() => {
    setPage(0);
  }, [queryBase]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    const handle = setTimeout(() => {
      getMembershipReport({
        ...queryBase,
        skip: page * PAGE_SIZE,
        take: PAGE_SIZE,
      })
        .then(({ data }) => {
          if (!active) return;
          setReport(data);
        })
        .catch((err) => {
          if (!active) return;
          const message = err instanceof Error ? err.message : t("reportsPage.membership.errors.loadReport");
          setError(message);
          setReport(null);
        })
        .finally(() => {
          if (!active) return;
          setLoading(false);
        });
    }, 300);

    return () => {
      active = false;
      clearTimeout(handle);
    };
  }, [queryBase, page, refreshKey, t]);

  useEffect(() => {
    if (error) {
      push({ kind: "error", title: error });
    }
  }, [error, push]);

  const total = report?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const from = total ? page * PAGE_SIZE + 1 : 0;
  const to = total ? Math.min(total, (page + 1) * PAGE_SIZE) : 0;

  const statusCounts = useMemo(() => {
    const map = new Map<string, number>();
    report?.charts.statusSplit.forEach((row) => {
      map.set(row.status, row.count);
    });
    const activeCount = map.get("ACTIVE") ?? 0;
    const pendingCount = map.get("PENDING") ?? 0;
    const expiredCount = map.get("EXPIRED") ?? 0;
    const suspendedCount = map.get("SUSPENDED") ?? 0;
    const cancelledCount = map.get("CANCELLED") ?? 0;
    const totalCount = activeCount + pendingCount + expiredCount + suspendedCount + cancelledCount;
    return { activeCount, pendingCount, expiredCount, suspendedCount, cancelledCount, totalCount };
  }, [report]);
  const toggleLabel = filtersExpanded ? t("common.actions.hideFilters") : t("common.actions.showFilters");
  const activeFiltersCount = [
    preset !== "LAST_90_DAYS",
    dateField !== "CREATED_AT",
    Boolean(fromDate),
    Boolean(toDate),
    Boolean(status),
    remaining !== "ALL",
    Boolean(planId),
    Boolean(memberId),
    autoRenew !== "ALL",
    expiring !== "ALL",
    sortBy !== "END_DATE",
    sortDir !== "desc",
  ].filter(Boolean).length;

  const resetFilters = () => {
    setPreset(DEFAULT_MEMBERSHIP_FILTERS.preset);
    setDateField(DEFAULT_MEMBERSHIP_FILTERS.dateField);
    setFromDate(DEFAULT_MEMBERSHIP_FILTERS.fromDate);
    setToDate(DEFAULT_MEMBERSHIP_FILTERS.toDate);
    setStatus(DEFAULT_MEMBERSHIP_FILTERS.status);
    setRemaining(DEFAULT_MEMBERSHIP_FILTERS.remaining);
    setPlanId(DEFAULT_MEMBERSHIP_FILTERS.planId);
    setMemberId(DEFAULT_MEMBERSHIP_FILTERS.memberId);
    setSortBy(DEFAULT_MEMBERSHIP_FILTERS.sortBy);
    setSortDir(DEFAULT_MEMBERSHIP_FILTERS.sortDir);
    setAutoRenew(DEFAULT_MEMBERSHIP_FILTERS.autoRenew);
    setExpiring(DEFAULT_MEMBERSHIP_FILTERS.expiring);
    setPage(0);
  };

  const refreshReport = () => {
    setRefreshKey((prev) => prev + 1);
  };

  const exportCsv = async () => {
    setExporting(true);
    try {
      const { data } = await downloadMembershipReportCsv({
        ...queryBase,
        lang: resolveExportLanguage(i18n.language),
      });
      downloadBlob(data, `membership-report-${new Date().toISOString().slice(0, 10)}.csv`);
      push({ kind: "success", title: t("reportsPage.membership.actions.exportSuccess") });
    } catch (err) {
      push({
        kind: "error",
        title: err instanceof Error ? err.message : t("reportsPage.membership.actions.exportFailed"),
      });
    } finally {
      setExporting(false);
    }
  };

  return (
    <>
      <div className="space-y-4" data-testid="membership-report-tab">
      <ReportFiltersPanel
        open={filtersExpanded}
        onToggle={() => setFiltersExpanded((prev) => !prev)}
        toggleLabel={toggleLabel}
        activeFiltersCount={activeFiltersCount}
        gridClassName={FILTER_GRID_CLASS}
        actions={
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={refreshReport} disabled={loading} className={REPORT_FILTER_ACTION_CLASS}>
              {t("reportsPage.membership.actions.refresh")}
            </button>
            <button type="button" onClick={resetFilters} disabled={loading} className={REPORT_FILTER_ACTION_CLASS}>
              {t("reportsPage.membership.actions.clearFilters")}
            </button>
            <button
              type="button"
              data-testid="membership-report-export-csv"
              onClick={exportCsv}
              disabled={loading || exporting}
              className="attendance-export-btn inline-flex h-8 min-w-24 items-center justify-center gap-1.5 rounded-lg border border-brand-500 bg-brand-500 px-2.5 text-[11px] font-semibold text-white transition hover:bg-brand-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/30 disabled:opacity-45"
            >
              <IconFileExport className="h-3.5 w-3.5" stroke={1.8} />
              {exporting ? t("reportsPage.membership.actions.exporting") : t("reportsPage.membership.actions.exportCsv")}
            </button>
          </div>
        }
      >
        <ReportFilterField label={t("reportsPage.membership.filters.period")}>
          <DropdownSelect
            buttonClassName={REPORT_FILTER_FIELD_CLASS}
            value={preset}
            onChange={(value) => setPreset(value as PresetFilter)}
            options={[
              { value: "LAST_30_DAYS", label: t("reportsPage.membership.period.last30Days") },
              { value: "LAST_90_DAYS", label: t("reportsPage.membership.period.last90Days") },
              { value: "THIS_MONTH", label: t("reportsPage.membership.period.thisMonth") },
              { value: "LAST_MONTH", label: t("reportsPage.membership.period.lastMonth") },
              { value: "THIS_YEAR", label: t("reportsPage.membership.period.thisYear") },
              { value: "ALL", label: t("reportsPage.membership.period.allTime") },
            ]}
          />
        </ReportFilterField>

        <ReportFilterField label={t("reportsPage.membership.filters.dateField")}>
          <DropdownSelect
            buttonClassName={REPORT_FILTER_FIELD_CLASS}
            value={dateField}
            onChange={(value) => setDateField(value as DateFieldFilter)}
            options={[
              { value: "CREATED_AT", label: t("reportsPage.membership.filters.dateFieldCreatedAt") },
              { value: "START_DATE", label: t("reportsPage.membership.filters.dateFieldStartDate") },
              { value: "END_DATE", label: t("reportsPage.membership.filters.dateFieldEndDate") },
              { value: "ACTIVATED_AT", label: t("reportsPage.membership.filters.dateFieldActivatedAt") },
            ]}
          />
        </ReportFilterField>

        <ReportFilterField label={t("reportsPage.membership.filters.fromDate")}>
          <div data-testid="membership-report-date-from">
            <ShamsiDateInput value={fromDate} onChange={setFromDate} locale={locale} inputClassName={REPORT_FILTER_FIELD_CLASS} />
          </div>
        </ReportFilterField>

        <ReportFilterField label={t("reportsPage.membership.filters.toDate")}>
          <div data-testid="membership-report-date-to">
            <ShamsiDateInput value={toDate} onChange={setToDate} locale={locale} inputClassName={REPORT_FILTER_FIELD_CLASS} />
          </div>
        </ReportFilterField>

        {isDateRangeInvalid ? (
          <p
            className="self-end text-[11px] font-semibold text-rose-600 dark:text-rose-300"
            data-testid="membership-report-date-error"
          >
            {t("reportsPage.membership.filters.fromDate")} ≤ {t("reportsPage.membership.filters.toDate")}
          </p>
        ) : null}

        <ReportFilterField label={t("reportsPage.membership.filters.status")}>
          <DropdownSelect
            buttonClassName={REPORT_FILTER_FIELD_CLASS}
            value={status}
            onChange={(value) => setStatus(value as StatusFilter)}
            options={[
              { value: "", label: t("reportsPage.membership.filters.allStatuses") },
              { value: "ACTIVE", label: t("reportsPage.membership.status.active") },
              { value: "PENDING", label: t("reportsPage.membership.status.pending") },
              { value: "EXPIRED", label: t("reportsPage.membership.status.expired") },
              { value: "SUSPENDED", label: t("reportsPage.membership.status.suspended") },
              { value: "CANCELLED", label: t("reportsPage.membership.status.cancelled") },
            ]}
          />
        </ReportFilterField>

        <ReportFilterField label={t("reportsPage.membership.filters.remaining")}>
          <DropdownSelect
            buttonClassName={REPORT_FILTER_FIELD_CLASS}
            value={remaining}
            onChange={(value) => setRemaining(value as RemainingFilter)}
            options={[
              { value: "ALL", label: t("reportsPage.membership.filters.remainingAll") },
              { value: "WITH_DEBT", label: t("reportsPage.membership.filters.remainingWithDebt") },
              { value: "SETTLED", label: t("reportsPage.membership.filters.remainingSettled") },
            ]}
          />
        </ReportFilterField>

        <ReportFilterField label={t("reportsPage.membership.filters.plan")}>
          <DropdownSelect
            buttonClassName={REPORT_FILTER_FIELD_CLASS}
            value={planId}
            onChange={setPlanId}
            disabled={plansLoading}
            options={[
              { value: "", label: t("reportsPage.membership.filters.allPlans") },
              ...plans.map((plan) => ({ value: plan.id, label: plan.name })),
            ]}
          />
        </ReportFilterField>

        <ReportFilterField label={t("reportsPage.membership.filters.search")}>
          <DropdownSelect
            buttonClassName={REPORT_FILTER_FIELD_CLASS}
            value={memberId}
            onChange={setMemberId}
            disabled={membersLoading}
            searchable
            searchPlaceholder={t("reportsPage.membership.filters.searchPlaceholder")}
            options={[
              { value: "", label: t("reportsPage.membership.filters.searchPlaceholder") },
              ...members.map((member) => ({ value: member.id, label: member.label })),
            ]}
          />
        </ReportFilterField>

        <ReportFilterField label={t("reportsPage.membership.filters.autoRenew")}>
          <DropdownSelect
            buttonClassName={REPORT_FILTER_FIELD_CLASS}
            value={autoRenew}
            onChange={(value) => setAutoRenew(value as AutoRenewFilter)}
            options={[
              { value: "ALL", label: t("reportsPage.membership.filters.autoRenewAll") },
              { value: "YES", label: t("reportsPage.membership.filters.autoRenewEnabled") },
              { value: "NO", label: t("reportsPage.membership.filters.autoRenewDisabled") },
            ]}
          />
        </ReportFilterField>

        <ReportFilterField label={t("reportsPage.membership.filters.expiring")}>
          <DropdownSelect
            buttonClassName={REPORT_FILTER_FIELD_CLASS}
            value={expiring}
            onChange={(value) => setExpiring(value as ExpiringFilter)}
            options={[
              { value: "ALL", label: t("reportsPage.membership.filters.expiringAll") },
              { value: "7", label: t("reportsPage.membership.filters.expiring7") },
              { value: "30", label: t("reportsPage.membership.filters.expiring30") },
              { value: "60", label: t("reportsPage.membership.filters.expiring60") },
            ]}
          />
        </ReportFilterField>

        <ReportFilterField label={t("reportsPage.membership.filters.sortBy")}>
          <div className="flex items-center gap-2">
            <DropdownSelect
              buttonClassName={`${REPORT_FILTER_FIELD_CLASS} flex-1`}
              containerClassName="flex-1"
              value={sortBy}
              onChange={(value) => setSortBy(value as SortByFilter)}
              options={[
                { value: "END_DATE", label: t("reportsPage.membership.sort.endDate") },
                { value: "CREATED_AT", label: t("reportsPage.membership.sort.createdAt") },
                { value: "START_DATE", label: t("reportsPage.membership.sort.startDate") },
                { value: "REMAINING", label: t("reportsPage.membership.sort.remaining") },
                { value: "TOTAL_DUE", label: t("reportsPage.membership.sort.totalDue") },
                { value: "TOTAL_PAID", label: t("reportsPage.membership.sort.totalPaid") },
                { value: "DAYS_LEFT", label: t("reportsPage.membership.sort.daysLeft") },
              ]}
            />
            <button type="button" className={REPORT_FILTER_ACTION_CLASS} onClick={() => setSortDir((prev) => (prev === "asc" ? "desc" : "asc"))}>
              {sortDir === "asc" ? t("reportsPage.membership.sort.asc") : t("reportsPage.membership.sort.desc")}
            </button>
          </div>
        </ReportFilterField>

        <div className="flex items-end justify-end lg:col-span-3 xl:col-span-4">
          <button
            type="button"
            data-testid="membership-report-apply-filters"
            onClick={applyFilters}
            disabled={loading || !hasPendingFilterChanges || isDateRangeInvalid}
            className="attendance-export-btn inline-flex h-8 min-w-24 items-center justify-center gap-1.5 rounded-lg border border-brand-500 bg-brand-500 px-2.5 text-[11px] font-semibold text-white transition hover:bg-brand-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/30 disabled:opacity-45"
          >
            {t("common.actions.applyFilters")}
          </button>
        </div>

      </ReportFiltersPanel>

      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryChip label={t("reportsPage.membership.summary.totalMemberships")} value={formatAmount(report?.summary.totalMemberships ?? 0, locale)} />
        <SummaryChip label={t("reportsPage.membership.summary.active")} value={formatAmount(report?.summary.active ?? 0, locale)} tone="emerald" />
        <SummaryChip label={t("reportsPage.membership.summary.debtors")} value={formatAmount(report?.summary.debtors ?? 0, locale)} tone="rose" />
        <SummaryChip label={t("reportsPage.membership.summary.expiringSoon")} value={formatAmount(report?.summary.expiringSoon ?? 0, locale)} tone="amber" />
        <SummaryChip
          label={t("reportsPage.membership.summary.collectionRate")}
          value={`${formatAmount(report?.summary.collectionRatePct ?? 0, locale)}%`}
          tone="sky"
        />
        <SummaryChip label={t("reportsPage.membership.summary.autoRenewEnabled")} value={formatAmount(report?.summary.autoRenewEnabled ?? 0, locale)} tone="sky" />
        <SummaryChip label={t("reportsPage.membership.summary.renewals")} value={formatAmount(report?.summary.renewals ?? 0, locale)} tone="emerald" />
        <SummaryChip label={t("reportsPage.membership.summary.firstTimers")} value={formatAmount(report?.summary.firstTimers ?? 0, locale)} />
        <SummaryChip label={t("reportsPage.membership.summary.totalDue")} value={formatAmount(report?.summary.totalDue ?? 0, locale)} />
        <SummaryChip label={t("reportsPage.membership.summary.totalPaid")} value={formatAmount(report?.summary.totalPaid ?? 0, locale)} tone="emerald" />
        <SummaryChip label={t("reportsPage.membership.summary.totalRemaining")} value={formatAmount(report?.summary.totalRemaining ?? 0, locale)} tone="rose" />
        <SummaryChip
          label={t("reportsPage.membership.summary.averageDue")}
          value={formatAmount(report?.summary.averageDuePerMembership ?? 0, locale)}
          tone="amber"
        />
      </div>

      <div className="grid gap-3 xl:grid-cols-4">
        <MiniChartCard title={t("reportsPage.membership.charts.statusSplit")} subtitle={t("reportsPage.membership.charts.statusHint")}>
          <MembershipStatusDonut
            counts={statusCounts}
            labels={{
              active: t("reportsPage.membership.status.active"),
              pending: t("reportsPage.membership.status.pending"),
              expired: t("reportsPage.membership.status.expired"),
              suspended: t("reportsPage.membership.status.suspended"),
              cancelled: t("reportsPage.membership.status.cancelled"),
            }}
          />
        </MiniChartCard>
        <MiniChartCard title={t("reportsPage.membership.charts.lifecycleSplit")} subtitle={t("reportsPage.membership.charts.lifecycleHint")}>
          <LifecycleBars
            rows={report?.charts.lifecycleSplit ?? []}
            labels={{
              FIRST_TIME: t("reportsPage.membership.lifecycle.firstTime"),
              RENEWAL: t("reportsPage.membership.lifecycle.renewal"),
            }}
            locale={locale}
          />
        </MiniChartCard>
        <MiniChartCard title={t("reportsPage.membership.charts.monthlyTrend")} subtitle={t("reportsPage.membership.charts.monthlyHint")}>
          <TrendBars values={report?.charts.monthlyTrend.map((point) => point.memberships) ?? []} labels={report?.charts.monthlyTrend.map((point) => point.label) ?? []} />
        </MiniChartCard>
        <MiniChartCard title={t("reportsPage.membership.charts.expiringBuckets")} subtitle={t("reportsPage.membership.charts.expiringHint")}>
          <ExpiringBucketList
            rows={report?.charts.expiringBuckets ?? []}
            labels={{
              "0-7": t("reportsPage.membership.buckets.0_7"),
              "8-30": t("reportsPage.membership.buckets.8_30"),
              "31-60": t("reportsPage.membership.buckets.31_60"),
              "61+": t("reportsPage.membership.buckets.61_plus"),
            }}
            locale={locale}
          />
        </MiniChartCard>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <SectionCard title={t("reportsPage.membership.topDebtors.title")} hint={t("reportsPage.membership.topDebtors.hint")}>
          <TopDebtorsList items={report?.charts.topDebtors ?? []} locale={locale} t={t} />
        </SectionCard>

        <SectionCard title={t("reportsPage.membership.topPlans.title")} hint={t("reportsPage.membership.topPlans.hint")}>
          <TopPlansTable
            rows={report?.charts.topPlans ?? []}
            locale={locale}
            labels={{
              plan: t("reportsPage.membership.topPlans.columns.plan"),
              members: t("reportsPage.membership.topPlans.columns.members"),
              due: t("reportsPage.membership.topPlans.columns.due"),
              paid: t("reportsPage.membership.topPlans.columns.paid"),
              debt: t("reportsPage.membership.topPlans.columns.debt"),
            }}
          />
        </SectionCard>
      </div>

      <div className={CARD_CLASS}>
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-xs font-semibold text-slate-900 dark:text-white">{t("reportsPage.membership.table.title")}</h3>
          <div className="text-end text-[11px] text-slate-500 dark:text-slate-400">
            <p>
              {from}-{to} / {formatAmount(total, locale)}
            </p>
            <p>{t("reportsPage.membership.table.generatedAt", { date: formatDateTime(report?.generatedAt, locale) })}</p>
          </div>
        </div>
        <DataTableShell className="mt-3">
          <DataTable variant="report" minWidth="1100px">
            <DataTableHead>
              <DataTableRow>
                <DataTableHeaderCell>{t("reportsPage.membership.table.member")}</DataTableHeaderCell>
                <DataTableHeaderCell>{t("reportsPage.membership.table.plan")}</DataTableHeaderCell>
                <DataTableHeaderCell>{t("reportsPage.membership.table.status")}</DataTableHeaderCell>
                <DataTableHeaderCell>{t("reportsPage.membership.table.period")}</DataTableHeaderCell>
                <DataTableHeaderCell align="end">{t("reportsPage.membership.table.due")}</DataTableHeaderCell>
                <DataTableHeaderCell align="end">{t("reportsPage.membership.table.paid")}</DataTableHeaderCell>
                <DataTableHeaderCell align="end">{t("reportsPage.membership.table.remaining")}</DataTableHeaderCell>
                <DataTableHeaderCell>{t("reportsPage.membership.table.daysLeft")}</DataTableHeaderCell>
                <DataTableHeaderCell>{t("reportsPage.membership.table.lifecycle")}</DataTableHeaderCell>
                <DataTableHeaderCell>{t("reportsPage.membership.table.autoRenew")}</DataTableHeaderCell>
              </DataTableRow>
            </DataTableHead>
            <DataTableBody>
              {loading ? (
                <DataTableEmptyRow colSpan={10}>{t("common.messages.loading")}</DataTableEmptyRow>
              ) : !report || report.items.length === 0 ? (
                <DataTableEmptyRow colSpan={10}>{t("reportsPage.membership.table.empty")}</DataTableEmptyRow>
              ) : (
                report.items.map((item) => (
                  <DataTableRow key={item.id}>
                    <DataTableCell>
                      <div className="flex flex-col">
                        <span className="text-slate-900 dark:text-white">{item.member.fullName}</span>
                        <span className="text-[10px] text-slate-500 dark:text-slate-400">#{item.member.code}</span>
                      </div>
                    </DataTableCell>
                    <DataTableCell>{item.plan?.name ?? "-"}</DataTableCell>
                    <DataTableCell>
                      <StatusBadge status={item.status} label={formatMembershipStatus(item.status, t)} />
                    </DataTableCell>
                    <DataTableCell>
                      {formatDate(item.startDate, locale)} - {formatDate(item.endDate, locale)}
                    </DataTableCell>
                    <DataTableCell align="end">{formatAmount(item.totalDue, locale)}</DataTableCell>
                    <DataTableCell align="end">{formatAmount(item.totalPaid, locale)}</DataTableCell>
                    <DataTableCell align="end">
                      <span className={item.remaining > 0 ? "text-rose-600 dark:text-rose-300" : ""}>{formatAmount(item.remaining, locale)}</span>
                    </DataTableCell>
                    <DataTableCell>{formatDaysLeft(item.daysLeft, t)}</DataTableCell>
                    <DataTableCell>{item.lifecycle === "RENEWAL" ? t("reportsPage.membership.lifecycle.renewal") : t("reportsPage.membership.lifecycle.firstTime")}</DataTableCell>
                    <DataTableCell>{item.autoRenew ? t("common.values.yes") : t("common.values.no")}</DataTableCell>
                  </DataTableRow>
                ))
              )}
            </DataTableBody>
          </DataTable>
        </DataTableShell>
        <ReportPager
          rangeLabel={`${formatAmount(from, locale)}-${formatAmount(to, locale)} / ${formatAmount(total, locale)}`}
          pageLabel={`${formatAmount(page + 1, locale)} / ${formatAmount(totalPages, locale)}`}
          previousLabel={t("common.actions.prev")}
          nextLabel={t("common.actions.next")}
          canPrevious={page > 0}
          canNext={page + 1 < totalPages}
          onPrevious={() => setPage((prev) => Math.max(0, prev - 1))}
          onNext={() => setPage((prev) => Math.min(totalPages - 1, prev + 1))}
        />
      </div>
      </div>
    </>
  );
}

function buildMembershipQuery(filters: MembershipFiltersState): MembershipReportQuery {
  const payload: MembershipReportQuery = {
    preset: filters.preset,
    dateField: filters.dateField,
    remaining: filters.remaining,
    sortBy: filters.sortBy,
    sortDir: filters.sortDir,
  };

  if (filters.fromDate) payload.from = filters.fromDate;
  if (filters.toDate) payload.to = filters.toDate;
  if (filters.status) payload.status = filters.status;
  if (filters.planId) payload.planId = filters.planId;
  if (filters.memberId) payload.memberId = filters.memberId;
  if (filters.autoRenew !== "ALL") payload.autoRenew = filters.autoRenew === "YES";
  if (filters.expiring !== "ALL") payload.expiringInDays = Number(filters.expiring);

  return payload;
}

function resolveExportLanguage(language: string): NonNullable<MembershipReportQuery["lang"]> {
  const baseLanguage = language.split("-")[0];
  return baseLanguage === "fa" || baseLanguage === "ps" ? baseLanguage : "en";
}

function areMembershipFiltersEqual(left: MembershipFiltersState, right: MembershipFiltersState) {
  return (
    left.preset === right.preset &&
    left.dateField === right.dateField &&
    left.fromDate === right.fromDate &&
    left.toDate === right.toDate &&
    left.status === right.status &&
    left.remaining === right.remaining &&
    left.planId === right.planId &&
    left.memberId === right.memberId &&
    left.sortBy === right.sortBy &&
    left.sortDir === right.sortDir &&
    left.autoRenew === right.autoRenew &&
    left.expiring === right.expiring
  );
}

function SummaryChip({ label, value, tone = "slate" }: { label: string; value: string; tone?: "slate" | "emerald" | "rose" | "amber" | "sky" }) {
  const toneClass =
    tone === "emerald"
      ? "border-emerald-500/30 bg-emerald-500/10"
      : tone === "rose"
        ? "border-rose-500/30 bg-rose-500/10"
        : tone === "amber"
          ? "border-amber-500/30 bg-amber-500/10"
          : tone === "sky"
            ? "border-sky-500/30 bg-sky-500/10"
            : "border-slate-200/80 bg-white/80";
  return (
    <div className={`rounded-xl border px-3 py-2 text-[11px] text-slate-700 dark:text-slate-200 ${toneClass}`}>
      <p className="text-[10px] uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</p>
      <p className="text-xs font-semibold text-slate-900 dark:text-white">{value}</p>
    </div>
  );
}

function MiniChartCard({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white/80 p-3 text-slate-900 shadow-sm dark:border-slate-800/80 dark:bg-slate-950/70 dark:text-slate-100">
      <div>
        <p className="text-xs font-semibold text-slate-800 dark:text-white">{title}</p>
        {subtitle ? <p className="mt-0.5 text-[10px] text-slate-500 dark:text-slate-400">{subtitle}</p> : null}
      </div>
      <div className="mt-3">{children}</div>
    </div>
  );
}

function SectionCard({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-slate-200/80 bg-white/80 p-3 text-[11px] text-slate-700 dark:border-slate-800/70 dark:bg-slate-950/60 dark:text-slate-200">
      <div className="flex flex-col gap-1">
        <p className="text-xs font-semibold text-slate-900 dark:text-white">{title}</p>
        {hint ? <p className="text-[10px] text-slate-500 dark:text-slate-400">{hint}</p> : null}
      </div>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function MembershipStatusDonut({
  counts,
  labels,
}: {
  counts: { activeCount: number; pendingCount: number; expiredCount: number; suspendedCount: number; cancelledCount: number; totalCount: number };
  labels: { active: string; pending: string; expired: string; suspended: string; cancelled: string };
}) {
  const total = counts.totalCount || 1;
  const activePct = (counts.activeCount / total) * 100;
  const pendingPct = (counts.pendingCount / total) * 100;
  const expiredPct = (counts.expiredCount / total) * 100;
  const suspendedPct = (counts.suspendedCount / total) * 100;
  const gradient = `conic-gradient(#22c55e 0 ${activePct}%, #f59e0b ${activePct}% ${activePct + pendingPct}%, #ef4444 ${activePct + pendingPct}% ${activePct + pendingPct + expiredPct}%, #6366f1 ${activePct + pendingPct + expiredPct}% ${activePct + pendingPct + expiredPct + suspendedPct}%, #64748b ${activePct + pendingPct + expiredPct + suspendedPct}% 100%)`;
  return (
    <div className="flex items-center gap-3">
      <div className="relative grid h-14 w-14 place-items-center rounded-full" style={{ background: gradient }}>
        <div className="h-8 w-8 rounded-full bg-white dark:bg-slate-950" />
      </div>
      <div className="space-y-1 text-[10px] text-slate-600 dark:text-slate-300">
        <LegendItem color="bg-emerald-500" label={labels.active} value={counts.activeCount} />
        <LegendItem color="bg-amber-500" label={labels.pending} value={counts.pendingCount} />
        <LegendItem color="bg-rose-500" label={labels.expired} value={counts.expiredCount} />
        <LegendItem color="bg-indigo-500" label={labels.suspended} value={counts.suspendedCount} />
        <LegendItem color="bg-slate-500" label={labels.cancelled} value={counts.cancelledCount} />
      </div>
    </div>
  );
}

function LifecycleBars({
  rows,
  labels,
  locale,
}: {
  rows: Array<{ type: "FIRST_TIME" | "RENEWAL"; count: number }>;
  labels: Record<"FIRST_TIME" | "RENEWAL", string>;
  locale: string;
}) {
  const max = Math.max(1, ...rows.map((row) => row.count));
  return (
    <div className="space-y-2">
      {rows.map((row) => (
        <div key={row.type} className="space-y-1">
          <div className="flex items-center justify-between text-[10px] text-slate-600 dark:text-slate-300">
            <span>{labels[row.type]}</span>
            <span className="font-semibold">{formatAmount(row.count, locale)}</span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-slate-200/80 dark:bg-slate-800/80">
            <div className="h-1.5 rounded-full bg-sky-500/70 dark:bg-sky-400/80" style={{ width: `${Math.round((row.count / max) * 100)}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function LegendItem({ color, label, value }: { color: string; label: string; value: number }) {
  return (
    <div className="flex items-center gap-2">
      <span className={`h-2 w-2 rounded-full ${color}`} />
      <span className="min-w-[64px]">{label}</span>
      <span className="text-[10px] font-semibold text-slate-700 dark:text-slate-100">{value}</span>
    </div>
  );
}

function TrendBars({ values, labels }: { values: number[]; labels: string[] }) {
  if (!values.length) {
    return <p className="text-[11px] text-slate-500 dark:text-slate-400">-</p>;
  }
  const max = Math.max(1, ...values);
  return (
    <div className="space-y-2">
      <div className="flex items-end gap-1">
        {values.map((value, index) => (
          <div key={`${labels[index]}-${value}`} className="flex-1">
            <div
              className="w-full rounded-t-md bg-brand-500/50 dark:bg-brand-400/70"
              style={{ height: `${Math.max(6, Math.round((value / max) * 52))}px` }}
              title={`${labels[index]}: ${value}`}
            />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-3 gap-1 text-[9px] text-slate-500 dark:text-slate-400">
        <span>{labels[0] ?? "-"}</span>
        <span className="text-center">{labels[Math.floor(labels.length / 2)] ?? "-"}</span>
        <span className="text-end">{labels[labels.length - 1] ?? "-"}</span>
      </div>
    </div>
  );
}

function ExpiringBucketList({
  rows,
  labels,
  locale,
}: {
  rows: Array<{ bucket: "0-7" | "8-30" | "31-60" | "61+"; count: number }>;
  labels: Record<"0-7" | "8-30" | "31-60" | "61+", string>;
  locale: string;
}) {
  const max = Math.max(1, ...rows.map((row) => row.count));
  return (
    <div className="space-y-2">
      {rows.map((row) => (
        <div key={row.bucket} className="space-y-1">
          <div className="flex items-center justify-between text-[10px] text-slate-600 dark:text-slate-300">
            <span>{labels[row.bucket]}</span>
            <span className="font-semibold">{formatAmount(row.count, locale)}</span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-slate-200/80 dark:bg-slate-800/80">
            <div className="h-1.5 rounded-full bg-amber-500/70 dark:bg-amber-400/80" style={{ width: `${Math.round((row.count / max) * 100)}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function TopDebtorsList({
  items,
  locale,
  t,
}: {
  items: Array<{
    membershipId: string;
    memberId: string;
    memberName: string;
    planName: string | null;
    remaining: number;
    endDate: string;
    daysLeft: number | null;
  }>;
  locale: string;
  t: (key: string, options?: Record<string, unknown>) => string;
}) {
  if (!items.length) {
    return <p className="text-[11px] text-slate-500 dark:text-slate-400">-</p>;
  }
  return (
    <div className="space-y-2">
      {items.map((item) => (
        <div key={item.membershipId} className="rounded-lg border border-slate-200/70 bg-white/70 p-2 dark:border-slate-800/70 dark:bg-slate-950/60">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-slate-900 dark:text-white">{item.memberName}</p>
            <p className="text-xs font-semibold text-rose-600 dark:text-rose-300">{formatAmount(item.remaining, locale)}</p>
          </div>
          <p className="mt-1 text-[10px] text-slate-500 dark:text-slate-400">
            {item.planName ?? "-"} | {formatDate(item.endDate, locale)} | {t("reportsPage.membership.topDebtors.daysLeft")}: {formatDaysLeft(item.daysLeft, t)}
          </p>
        </div>
      ))}
    </div>
  );
}

function TopPlansTable({
  rows,
  locale,
  labels,
}: {
  rows: Array<{
    planId: string;
    planName: string;
    memberships: number;
    active: number;
    totalDue: number;
    totalPaid: number;
    totalRemaining: number;
  }>;
  locale: string;
  labels: { plan: string; members: string; due: string; paid: string; debt: string };
}) {
  if (!rows.length) {
    return <p className="text-[11px] text-slate-500 dark:text-slate-400">-</p>;
  }
  return (
    <DataTableShell>
      <DataTable variant="report" minWidth="560px">
        <DataTableHead>
          <DataTableRow>
            <DataTableHeaderCell>{labels.plan}</DataTableHeaderCell>
            <DataTableHeaderCell align="end">{labels.members}</DataTableHeaderCell>
            <DataTableHeaderCell align="end">{labels.due}</DataTableHeaderCell>
            <DataTableHeaderCell align="end">{labels.paid}</DataTableHeaderCell>
            <DataTableHeaderCell align="end">{labels.debt}</DataTableHeaderCell>
          </DataTableRow>
        </DataTableHead>
        <DataTableBody>
          {rows.map((row) => (
            <DataTableRow key={row.planId || row.planName}>
              <DataTableCell>{row.planName}</DataTableCell>
              <DataTableCell align="end">{formatAmount(row.memberships, locale)}</DataTableCell>
              <DataTableCell align="end">{formatAmount(row.totalDue, locale)}</DataTableCell>
              <DataTableCell align="end">{formatAmount(row.totalPaid, locale)}</DataTableCell>
              <DataTableCell align="end" className="text-rose-600 dark:text-rose-300">{formatAmount(row.totalRemaining, locale)}</DataTableCell>
            </DataTableRow>
          ))}
        </DataTableBody>
      </DataTable>
    </DataTableShell>
  );
}

function StatusBadge({ status, label }: { status: MembershipReportItem["status"]; label: string }) {
  const className =
    status === "ACTIVE"
      ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-200"
      : status === "PENDING"
        ? "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-200"
        : status === "EXPIRED"
          ? "border-rose-500/40 bg-rose-500/10 text-rose-700 dark:text-rose-200"
          : status === "SUSPENDED"
            ? "border-indigo-500/40 bg-indigo-500/10 text-indigo-700 dark:text-indigo-200"
            : "border-slate-500/40 bg-slate-500/10 text-slate-700 dark:text-slate-200";
  return <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold ${className}`}>{label}</span>;
}

function formatMembershipStatus(status: MembershipReportItem["status"], t: (key: string) => string) {
  if (status === "ACTIVE") return t("reportsPage.membership.status.active");
  if (status === "PENDING") return t("reportsPage.membership.status.pending");
  if (status === "EXPIRED") return t("reportsPage.membership.status.expired");
  if (status === "SUSPENDED") return t("reportsPage.membership.status.suspended");
  if (status === "CANCELLED") return t("reportsPage.membership.status.cancelled");
  return status;
}

function formatDaysLeft(value: number | null, t: (key: string, options?: Record<string, unknown>) => string) {
  if (value === null) return "-";
  if (value < 0) return t("reportsPage.membership.days.expired", { count: Math.abs(value) });
  if (value === 0) return t("reportsPage.membership.days.today");
  return t("reportsPage.membership.days.left", { count: value });
}

function formatDate(value: string | Date | null | undefined, locale = "en") {
  if (!value) return "-";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString(resolveDateLocale(locale));
}

function formatDateTime(value: string | Date | null | undefined, locale = "en") {
  if (!value) return "-";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString(resolveDateLocale(locale), { dateStyle: "medium", timeStyle: "short" });
}

function formatAmount(value: number, locale = "en") {
  const safe = Number.isFinite(value) ? value : 0;
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(safe);
}

function downloadBlob(blob: Blob, filename: string) {
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
    options.push(...items.map((member) => ({ id: member.id, label: formatMemberFilterLabel(member) })));
    skip += items.length;
    if (!items.length) break;
  } while (skip < total && skip < MEMBER_FILTER_LIMIT);

  const unique = new Map(options.map((option) => [option.id, option]));
  return [...unique.values()].sort((left, right) => left.label.localeCompare(right.label, undefined, { sensitivity: "base" }));
}

function formatMemberFilterLabel(member: Pick<Member, "code" | "firstName" | "lastName">) {
  const fullName = `${member.firstName ?? ""} ${member.lastName ?? ""}`.trim();
  if (fullName) return `${fullName} (#${member.code})`;
  return `#${member.code}`;
}
