import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { IconArrowLeft, IconFileExport, IconFileSpreadsheet } from "@tabler/icons-react";
import {
  downloadCustomerActivityCsv,
  downloadCustomerActivityXlsx,
  getCustomerActivityInactiveMembers,
  getCustomerActivityLowEngagement,
  getCustomerActivitySummary,
  getCustomerActivityVisitedToday,
  type CustomerActivityInactiveMemberItem,
  type CustomerActivityInactiveMembersResponse,
  type CustomerActivityLowEngagementItem,
  type CustomerActivityLowEngagementResponse,
  type CustomerActivityReportFilters,
  type CustomerActivityReportPageInfo,
  type CustomerActivitySummaryResponse,
  type CustomerActivityVisitedTodayItem,
  type CustomerActivityVisitedTodayResponse,
} from "../../api/customerActivityReport";
import { useToast } from "../../components/ToastContext";
import { useGlobalLoading } from "../../components/GlobalLoadingContext";
import { resolveDateLocale } from "../../shared/dateLocale";
import {
  ReportFiltersPanel,
  REPORT_FILTER_ACTION_CLASS,
  REPORT_FILTER_FIELD_CLASS,
  REPORT_FILTER_LABEL_CLASS,
  REPORT_FILTER_PANEL_CLASS,
} from "../../components/reports/ReportFiltersPanel";
import { ReportPager } from "../../components/reports/ReportPager";
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
import { rtlLanguages } from "../../i18n/config";

type TabKey = "visitedToday" | "inactiveMembers" | "lowEngagement";

type Filters = {
  search: string;
  inactiveDays: number;
  engagementWindowDays: number;
  lowEngagementMaxVisits: number;
};

type SelectOption = {
  value: string;
  label: string;
};

const CARD_CLASS = "rounded-2xl border border-slate-200/80 bg-white/90 p-3 shadow-sm dark:border-slate-800/80 dark:bg-slate-950/70";
const FILTER_CARD_CLASS = REPORT_FILTER_PANEL_CLASS;
const INPUT_CLASS = REPORT_FILTER_FIELD_CLASS;
const LABEL_CLASS = REPORT_FILTER_LABEL_CLASS;
const PAGE_SIZE = 20;
const EMPTY_PAGE: CustomerActivityReportPageInfo = { page: 1, pageSize: PAGE_SIZE, totalItems: 0, totalPages: 1 };
const EMPTY_SUMMARY: CustomerActivitySummaryResponse = {
  generatedAt: "",
  filters: { search: null, inactiveDays: 7, engagementWindowDays: 30, lowEngagementMaxVisits: 3 },
  kpis: { activeCustomers: 0, visitedToday: 0, inactive7Days: 0, inactive30Days: 0, lowEngagement: 0 },
  tabs: { visitedToday: 0, inactiveMembers: 0, lowEngagement: 0 },
};
const EMPTY_VISITED: CustomerActivityVisitedTodayResponse = { items: [], pageInfo: EMPTY_PAGE };
const EMPTY_INACTIVE: CustomerActivityInactiveMembersResponse = { items: [], pageInfo: EMPTY_PAGE };
const EMPTY_LOW: CustomerActivityLowEngagementResponse = { items: [], pageInfo: EMPTY_PAGE };

function createDefaultFilters(): Filters {
  return { search: "", inactiveDays: 7, engagementWindowDays: 30, lowEngagementMaxVisits: 3 };
}

function areFiltersEqual(left: Filters, right: Filters) {
  return (
    left.search === right.search &&
    left.inactiveDays === right.inactiveDays &&
    left.engagementWindowDays === right.engagementWindowDays &&
    left.lowEngagementMaxVisits === right.lowEngagementMaxVisits
  );
}

export function CustomerActivityReportPage() {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const { push } = useToast();
  const isRtl = rtlLanguages.includes(i18n.language.split("-")[0]);

  const [filters, setFilters] = useState<Filters>(() => createDefaultFilters());
  const [appliedFilters, setAppliedFilters] = useState<Filters>(() => createDefaultFilters());
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [tab, setTab] = useState<TabKey>("visitedToday");
  const [pages, setPages] = useState<Record<TabKey, number>>({ visitedToday: 1, inactiveMembers: 1, lowEngagement: 1 });
  const [summary, setSummary] = useState(EMPTY_SUMMARY);
  const [visited, setVisited] = useState(EMPTY_VISITED);
  const [inactive, setInactive] = useState(EMPTY_INACTIVE);
  const [low, setLow] = useState(EMPTY_LOW);
  const [loadingSummary, setLoadingSummary] = useState(true);
  const [loadingTab, setLoadingTab] = useState(true);
  const [exporting, setExporting] = useState<"csv" | "xlsx" | null>(null);

  const apiFilters = useMemo<CustomerActivityReportFilters>(
    () => ({
      search: appliedFilters.search.trim() || undefined,
      inactiveDays: appliedFilters.inactiveDays,
      engagementWindowDays: appliedFilters.engagementWindowDays,
      lowEngagementMaxVisits: appliedFilters.lowEngagementMaxVisits,
    }),
    [appliedFilters]
  );

  const toggleLabel = filtersOpen ? t("common.actions.hideFilters") : t("common.actions.showFilters");
  const hasPendingFilterChanges = useMemo(() => !areFiltersEqual(filters, appliedFilters), [appliedFilters, filters]);
  const activeFiltersCount = useMemo(() => {
    const defaults = createDefaultFilters();
    return Number(Boolean(filters.search.trim()))
      + Number(filters.inactiveDays !== defaults.inactiveDays)
      + Number(filters.engagementWindowDays !== defaults.engagementWindowDays)
      + Number(filters.lowEngagementMaxVisits !== defaults.lowEngagementMaxVisits);
  }, [filters]);
  const activePage = pages[tab];

  const inactiveDayOptions: SelectOption[] = useMemo(
    () => [
      { value: "7", label: t("customerActivityReport.filters.inactive7") },
      { value: "14", label: t("customerActivityReport.filters.inactive14") },
      { value: "30", label: t("customerActivityReport.filters.inactive30") },
      { value: "60", label: t("customerActivityReport.filters.inactive60") },
    ],
    [t]
  );

  const engagementWindowOptions: SelectOption[] = useMemo(
    () => [
      { value: "14", label: t("customerActivityReport.filters.window14") },
      { value: "30", label: t("customerActivityReport.filters.window30") },
      { value: "60", label: t("customerActivityReport.filters.window60") },
      { value: "90", label: t("customerActivityReport.filters.window90") },
    ],
    [t]
  );

  const lowEngagementLimitOptions: SelectOption[] = useMemo(
    () => [
      { value: "1", label: t("customerActivityReport.filters.limit1") },
      { value: "2", label: t("customerActivityReport.filters.limit2") },
      { value: "3", label: t("customerActivityReport.filters.limit3") },
      { value: "5", label: t("customerActivityReport.filters.limit5") },
    ],
    [t]
  );

  useEffect(() => {
    let mounted = true;
    setLoadingSummary(true);
    getCustomerActivitySummary(apiFilters)
      .then(({ data }) => {
        if (mounted) setSummary(data);
      })
      .catch((error) => {
        if (!mounted) return;
        setSummary(EMPTY_SUMMARY);
        push({
          kind: "error",
          title: error instanceof Error ? error.message : t("customerActivityReport.toast.summaryLoadFailed"),
        });
      })
      .finally(() => {
        if (mounted) setLoadingSummary(false);
      });

    return () => {
      mounted = false;
    };
  }, [apiFilters, push, t]);

  useEffect(() => {
    let mounted = true;
    setLoadingTab(true);

    const request =
      tab === "visitedToday"
        ? getCustomerActivityVisitedToday(apiFilters, activePage, PAGE_SIZE).then(({ data }) => mounted && setVisited(data))
        : tab === "inactiveMembers"
          ? getCustomerActivityInactiveMembers(apiFilters, activePage, PAGE_SIZE).then(({ data }) => mounted && setInactive(data))
          : getCustomerActivityLowEngagement(apiFilters, activePage, PAGE_SIZE).then(({ data }) => mounted && setLow(data));

    request
      .catch((error) => {
        if (!mounted) return;
        if (tab === "visitedToday") setVisited(EMPTY_VISITED);
        if (tab === "inactiveMembers") setInactive(EMPTY_INACTIVE);
        if (tab === "lowEngagement") setLow(EMPTY_LOW);
        push({
          kind: "error",
          title: error instanceof Error ? error.message : t("customerActivityReport.toast.tableLoadFailed"),
        });
      })
      .finally(() => {
        if (mounted) setLoadingTab(false);
      });

    return () => {
      mounted = false;
    };
  }, [activePage, apiFilters, push, t, tab]);

  const handleExport = async (kind: "csv" | "xlsx") => {
    setExporting(kind);
    try {
      const payload = { ...apiFilters, tab };
      if (kind === "csv") {
        const { data } = await downloadCustomerActivityCsv(payload);
        saveBlob(data, `customer-activity-${tab}.csv`);
      } else {
        const { data } = await downloadCustomerActivityXlsx(payload);
        saveBlob(data, `customer-activity-${tab}.xlsx`);
      }
      push({ kind: "success", title: t("customerActivityReport.toast.exportCompleted") });
    } catch (error) {
      push({
        kind: "error",
        title: error instanceof Error ? error.message : t("customerActivityReport.toast.exportFailed"),
      });
    } finally {
      setExporting(null);
    }
  };

  const currentPageInfo = tab === "visitedToday" ? visited.pageInfo : tab === "inactiveMembers" ? inactive.pageInfo : low.pageInfo;
  const rangeStart = currentPageInfo.totalItems ? (currentPageInfo.page - 1) * currentPageInfo.pageSize + 1 : 0;
  const rangeEnd = currentPageInfo.totalItems ? Math.min(currentPageInfo.totalItems, currentPageInfo.page * currentPageInfo.pageSize) : 0;

  const activeTitle = t(`customerActivityReport.tabs.${tab}`);
  const activeSubtitle =
    tab === "visitedToday"
      ? t("customerActivityReport.sections.visitedTodayHint")
      : tab === "inactiveMembers"
        ? t("customerActivityReport.sections.inactiveMembersHint", { days: appliedFilters.inactiveDays })
        : t("customerActivityReport.sections.lowEngagementHint", {
            maxVisits: appliedFilters.lowEngagementMaxVisits,
            windowDays: appliedFilters.engagementWindowDays,
          });
  const blockingSummaryLoad = loadingSummary && !summary.generatedAt;

  useGlobalLoading(blockingSummaryLoad, {
    delayMs: 0,
    message: t("common.messages.loading"),
    subtitle: t("customerActivityReport.header.title"),
  });

  return (
    <>
      <div className="reports-page space-y-4" dir={isRtl ? "rtl" : "ltr"}>
        <section className={CARD_CLASS}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                {t("customerActivityReport.header.title")}
              </h2>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                {t("customerActivityReport.header.subtitle")}
              </p>
            </div>
            <button
              type="button"
              onClick={() => navigate("/reports")}
              className="report-back-btn inline-flex items-center gap-2 rounded-lg px-2.5 py-1 text-[11px] font-semibold transition"
            >
              <span className={isRtl ? "rotate-180" : ""}>
                <IconArrowLeft className="h-3.5 w-3.5" stroke={1.9} />
              </span>
              {t("customerActivityReport.header.backToReports")}
            </button>
          </div>
        </section>

        <ReportFiltersPanel
          open={filtersOpen}
          onToggle={() => setFiltersOpen((value) => !value)}
          toggleLabel={toggleLabel}
          activeFiltersCount={activeFiltersCount}
          className={FILTER_CARD_CLASS}
          gridClassName="attendance-report-filters__grid grid gap-2.5 rounded-xl p-3 sm:grid-cols-2 xl:grid-cols-4"
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  const defaults = createDefaultFilters();
                  setFilters(defaults);
                  setAppliedFilters(defaults);
                  setPages({ visitedToday: 1, inactiveMembers: 1, lowEngagement: 1 });
                }}
                className={`${REPORT_FILTER_ACTION_CLASS} h-8 px-2.5 text-[11px]`}
              >
                {t("common.actions.clear")}
              </button>
              <button
                type="button"
                onClick={() => {
                  setAppliedFilters(filters);
                  setPages({ visitedToday: 1, inactiveMembers: 1, lowEngagement: 1 });
                }}
                disabled={!hasPendingFilterChanges}
                className="attendance-export-btn inline-flex h-8 items-center justify-center rounded-lg border border-brand-500 bg-brand-500 px-2.5 text-[11px] font-semibold text-white transition hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-45"
              >
                {t("common.actions.applyFilters")}
              </button>
              <button
                type="button"
                onClick={() => void handleExport("csv")}
                disabled={exporting !== null}
                className={`${REPORT_FILTER_ACTION_CLASS} financial-export-action h-8 min-w-24 px-2.5 text-[11px]`}
              >
                <span className="inline-flex items-center gap-1.5">
                  <IconFileExport className="h-3.5 w-3.5" stroke={1.8} />
                  {exporting === "csv"
                    ? t("customerActivityReport.filters.exporting")
                    : t("customerActivityReport.filters.exportCsv")}
                </span>
              </button>
              <button
                type="button"
                onClick={() => void handleExport("xlsx")}
                disabled={exporting !== null}
                className="attendance-export-btn inline-flex h-8 min-w-24 items-center justify-center gap-1.5 rounded-lg border border-brand-500 bg-brand-500 px-2.5 text-[11px] font-semibold text-white transition hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-45"
              >
                <IconFileSpreadsheet className="h-3.5 w-3.5" stroke={1.8} />
                {exporting === "xlsx"
                  ? t("customerActivityReport.filters.exporting")
                  : t("customerActivityReport.filters.exportXlsx")}
              </button>
            </div>
          }
        >
          <label className="flex flex-col gap-1">
            <span className={LABEL_CLASS}>{t("customerActivityReport.filters.searchLabel")}</span>
            <input
              type="text"
              value={filters.search}
              onChange={(event) => setFilters((prev) => ({ ...prev, search: event.target.value }))}
              placeholder={t("customerActivityReport.filters.searchPlaceholder")}
              className={INPUT_CLASS}
            />
          </label>
          <FilterSelect
            label={t("customerActivityReport.filters.inactiveDays")}
            value={String(filters.inactiveDays)}
            onChange={(value) => setFilters((prev) => ({ ...prev, inactiveDays: Number(value) }))}
            options={inactiveDayOptions}
          />
          <FilterSelect
            label={t("customerActivityReport.filters.engagementWindow")}
            value={String(filters.engagementWindowDays)}
            onChange={(value) => setFilters((prev) => ({ ...prev, engagementWindowDays: Number(value) }))}
            options={engagementWindowOptions}
          />
          <FilterSelect
            label={t("customerActivityReport.filters.lowEngagementLimit")}
            value={String(filters.lowEngagementMaxVisits)}
            onChange={(value) => setFilters((prev) => ({ ...prev, lowEngagementMaxVisits: Number(value) }))}
            options={lowEngagementLimitOptions}
          />
        </ReportFiltersPanel>

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard label={t("customerActivityReport.kpis.activeCustomers")} value={summary.kpis.activeCustomers} locale={i18n.language} tone="sky" />
          <MetricCard label={t("customerActivityReport.kpis.visitedToday")} value={summary.kpis.visitedToday} locale={i18n.language} tone="emerald" />
          <MetricCard label={t("customerActivityReport.kpis.inactive30Days")} value={summary.kpis.inactive30Days} locale={i18n.language} tone="amber" />
          <MetricCard label={t("customerActivityReport.kpis.lowEngagement")} value={summary.kpis.lowEngagement} locale={i18n.language} tone="rose" />
        </section>

        <section className={CARD_CLASS}>
          <div className="flex flex-wrap items-center gap-2">
            <TabButton active={tab === "visitedToday"} label={t("customerActivityReport.tabs.visitedToday")} count={summary.tabs.visitedToday} onClick={() => setTab("visitedToday")} />
            <TabButton active={tab === "inactiveMembers"} label={t("customerActivityReport.tabs.inactiveMembers")} count={summary.tabs.inactiveMembers} onClick={() => setTab("inactiveMembers")} />
            <TabButton active={tab === "lowEngagement"} label={t("customerActivityReport.tabs.lowEngagement")} count={summary.tabs.lowEngagement} onClick={() => setTab("lowEngagement")} />
          </div>

          <div className="mt-3 flex flex-wrap items-end justify-between gap-2">
            <div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{activeTitle}</h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">{activeSubtitle}</p>
            </div>
          </div>

          <div className="mt-3">
            {tab === "visitedToday" ? (
              <VisitedTable
                items={visited.items}
                locale={i18n.language}
                loading={loadingTab}
                emptyLabel={t("customerActivityReport.table.empty")}
              />
            ) : null}
            {tab === "inactiveMembers" ? (
              <InactiveTable
                items={inactive.items}
                locale={i18n.language}
                loading={loadingTab}
                emptyLabel={t("customerActivityReport.table.empty")}
              />
            ) : null}
            {tab === "lowEngagement" ? (
              <LowTable
                items={low.items}
                locale={i18n.language}
                engagementWindowDays={appliedFilters.engagementWindowDays}
                loading={loadingTab}
                emptyLabel={t("customerActivityReport.table.empty")}
              />
            ) : null}
          </div>

          <ReportPager
            rangeLabel={t("customerActivityReport.table.range", {
              from: formatCount(rangeStart, i18n.language),
              to: formatCount(rangeEnd, i18n.language),
              total: formatCount(currentPageInfo.totalItems, i18n.language),
            })}
            pageLabel={t("customerActivityReport.pagination.pageOf", {
              page: formatCount(currentPageInfo.page, i18n.language),
              total: formatCount(currentPageInfo.totalPages, i18n.language),
            })}
            previousLabel={t("customerActivityReport.pagination.prev")}
            nextLabel={t("customerActivityReport.pagination.next")}
            canPrevious={currentPageInfo.page > 1}
            canNext={currentPageInfo.page < currentPageInfo.totalPages}
            onPrevious={() => setPages((prev) => ({ ...prev, [tab]: Math.max(1, prev[tab] - 1) }))}
            onNext={() => setPages((prev) => ({ ...prev, [tab]: Math.min(currentPageInfo.totalPages, prev[tab] + 1) }))}
          />
        </section>
      </div>
    </>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className={LABEL_CLASS}>{label}</span>
      <DropdownSelect buttonClassName={INPUT_CLASS} value={value} onChange={onChange} options={options} />
    </label>
  );
}

function MetricCard({
  label,
  value,
  locale,
  tone,
}: {
  label: string;
  value: number;
  locale: string;
  tone: "sky" | "emerald" | "amber" | "rose";
}) {
  const toneClass =
    tone === "sky"
      ? "bg-sky-400/70"
      : tone === "emerald"
        ? "bg-emerald-400/70"
        : tone === "amber"
          ? "bg-amber-400/70"
          : "bg-rose-400/70";

  return (
    <div className={CARD_CLASS}>
      <p className="text-[11px] font-medium text-slate-600 dark:text-slate-300">{label}</p>
      <p className="mt-1 text-xl font-semibold text-slate-900 dark:text-slate-100">{formatCount(value, locale)}</p>
      <div className={`mt-2 h-0.5 w-14 rounded-full ${toneClass}`} />
    </div>
  );
}

function TabButton({
  active,
  label,
  count,
  onClick,
}: {
  active: boolean;
  label: string;
  count: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[11px] font-semibold transition ${
        active
          ? "bg-brand-500 text-white shadow-sm"
          : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
      }`}
    >
      <span>{label}</span>
      <span
        className={`inline-flex min-w-5 items-center justify-center rounded-full px-1.5 text-[10px] ${
          active ? "bg-white/20 text-white" : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
        }`}
      >
        {count}
      </span>
    </button>
  );
}

function VisitedTable({
  items,
  locale,
  loading,
  emptyLabel,
}: {
  items: CustomerActivityVisitedTodayItem[];
  locale: string;
  loading: boolean;
  emptyLabel: string;
}) {
  const { t } = useTranslation();
  return (
    <BaseTable
      empty={items.length === 0}
      emptyLabel={emptyLabel}
      headers={[
        t("customerActivityReport.table.customer"),
        t("customerActivityReport.table.phone"),
        t("customerActivityReport.table.plan"),
        t("customerActivityReport.table.firstVisit"),
        t("customerActivityReport.table.lastVisit"),
        t("customerActivityReport.table.events"),
        t("customerActivityReport.table.membershipEnds"),
      ]}
      loading={loading}
      loadingLabel={t("customerActivityReport.table.loading")}
    >
      {items.map((item) => (
        <DataTableRow key={item.memberId}>
          <MemberCell item={item} />
          <DataTableCell>{item.memberPhone ?? "-"}</DataTableCell>
          <DataTableCell>{item.planName ?? "-"}</DataTableCell>
          <DataTableCell>{formatDateTime(item.firstVisitAt, locale)}</DataTableCell>
          <DataTableCell>{formatDateTime(item.lastVisitAt, locale)}</DataTableCell>
          <DataTableCell>{formatCount(item.visitEvents, locale)}</DataTableCell>
          <DataTableCell>{formatMembershipEnd(item.membershipEndDate, item.daysUntilExpiry, locale, t)}</DataTableCell>
        </DataTableRow>
      ))}
    </BaseTable>
  );
}

function InactiveTable({
  items,
  locale,
  loading,
  emptyLabel,
}: {
  items: CustomerActivityInactiveMemberItem[];
  locale: string;
  loading: boolean;
  emptyLabel: string;
}) {
  const { t } = useTranslation();
  return (
    <BaseTable
      empty={items.length === 0}
      emptyLabel={emptyLabel}
      headers={[
        t("customerActivityReport.table.customer"),
        t("customerActivityReport.table.phone"),
        t("customerActivityReport.table.plan"),
        t("customerActivityReport.table.lastVisitAt"),
        t("customerActivityReport.table.daysInactive"),
        t("customerActivityReport.table.membershipEnds"),
        t("customerActivityReport.table.state"),
      ]}
      loading={loading}
      loadingLabel={t("customerActivityReport.table.loading")}
    >
      {items.map((item) => (
        <DataTableRow key={item.memberId}>
          <MemberCell item={item} />
          <DataTableCell>{item.memberPhone ?? "-"}</DataTableCell>
          <DataTableCell>{item.planName ?? "-"}</DataTableCell>
          <DataTableCell>
            {item.lastVisitAt ? formatDateTime(item.lastVisitAt, locale) : t("customerActivityReport.table.neverVisited")}
          </DataTableCell>
          <DataTableCell>
            {item.daysSinceLastVisit == null ? t("customerActivityReport.table.neverVisited") : formatCount(item.daysSinceLastVisit, locale)}
          </DataTableCell>
          <DataTableCell>{formatMembershipEnd(item.membershipEndDate, item.daysUntilExpiry, locale, t)}</DataTableCell>
          <DataTableCell>
            <span
              className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                item.state === "NEVER"
                  ? "bg-rose-500/10 text-rose-700 dark:text-rose-200"
                  : "bg-amber-500/10 text-amber-700 dark:text-amber-200"
              }`}
            >
              {item.state === "NEVER"
                ? t("customerActivityReport.table.stateNever")
                : t("customerActivityReport.table.stateInactive")}
            </span>
          </DataTableCell>
        </DataTableRow>
      ))}
    </BaseTable>
  );
}

function LowTable({
  items,
  locale,
  engagementWindowDays,
  loading,
  emptyLabel,
}: {
  items: CustomerActivityLowEngagementItem[];
  locale: string;
  engagementWindowDays: number;
  loading: boolean;
  emptyLabel: string;
}) {
  const { t } = useTranslation();
  return (
    <BaseTable
      empty={items.length === 0}
      emptyLabel={emptyLabel}
      headers={[
        t("customerActivityReport.table.customer"),
        t("customerActivityReport.table.phone"),
        t("customerActivityReport.table.plan"),
        t("customerActivityReport.table.visitDays"),
        t("customerActivityReport.table.lastVisitAt"),
        t("customerActivityReport.table.daysInactive"),
        t("customerActivityReport.table.membershipEnds"),
      ]}
      loading={loading}
      loadingLabel={t("customerActivityReport.table.loading")}
    >
      {items.map((item) => (
        <DataTableRow key={item.memberId}>
          <MemberCell item={item} />
          <DataTableCell>{item.memberPhone ?? "-"}</DataTableCell>
          <DataTableCell>{item.planName ?? "-"}</DataTableCell>
          <DataTableCell>
            {t("customerActivityReport.table.visitDaysValue", {
              count: item.visitDays,
              window: formatCount(engagementWindowDays, locale),
            })}
          </DataTableCell>
          <DataTableCell>
            {item.lastVisitAt ? formatDateTime(item.lastVisitAt, locale) : t("customerActivityReport.table.neverVisited")}
          </DataTableCell>
          <DataTableCell>
            {item.daysSinceLastVisit == null ? t("customerActivityReport.table.neverVisited") : formatCount(item.daysSinceLastVisit, locale)}
          </DataTableCell>
          <DataTableCell>{formatMembershipEnd(item.membershipEndDate, item.daysUntilExpiry, locale, t)}</DataTableCell>
        </DataTableRow>
      ))}
    </BaseTable>
  );
}

function BaseTable({
  empty,
  emptyLabel,
  headers,
  children,
  loading,
  loadingLabel,
}: {
  empty: boolean;
  emptyLabel: string;
  headers: string[];
  children: ReactNode;
  loading: boolean;
  loadingLabel: string;
}) {
  return (
    <DataTableShell>
      <DataTable variant="report" minWidth="860px">
        <DataTableHead>
          <DataTableRow>
          {headers.map((header) => (
            <DataTableHeaderCell key={header}>
              {header}
            </DataTableHeaderCell>
          ))}
          </DataTableRow>
        </DataTableHead>
        <DataTableBody>
          {loading ? (
            <DataTableEmptyRow colSpan={headers.length}>{loadingLabel}</DataTableEmptyRow>
          ) : empty ? (
            <DataTableEmptyRow colSpan={headers.length}>{emptyLabel}</DataTableEmptyRow>
          ) : (
            children
          )}
        </DataTableBody>
      </DataTable>
    </DataTableShell>
  );
}

function MemberCell({ item }: { item: { memberName: string; memberCode: string } }) {
  return (
    <DataTableCell>
      <div className="font-semibold text-slate-900 dark:text-slate-100">{item.memberName}</div>
      <div className="text-[11px] text-slate-500 dark:text-slate-400">#{item.memberCode}</div>
    </DataTableCell>
  );
}

function formatMembershipEnd(
  value: string,
  daysUntilExpiry: number,
  locale: string,
  t: (key: string, options?: Record<string, unknown>) => string
) {
  const dateLabel = formatDate(value, locale);
  return daysUntilExpiry <= 7
    ? `${dateLabel} (${t("customerActivityReport.table.daysLeft", { count: daysUntilExpiry })})`
    : dateLabel;
}

function formatDate(value: string, locale: string) {
  return new Intl.DateTimeFormat(resolveDateLocale(locale), {
    year: "numeric",
    month: "short",
    day: "2-digit",
  }).format(new Date(value));
}

function formatDateTime(value: string, locale: string) {
  return new Intl.DateTimeFormat(resolveDateLocale(locale), {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatCount(value: number, locale: string) {
  return new Intl.NumberFormat(locale).format(value);
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
