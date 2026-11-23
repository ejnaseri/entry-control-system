import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  IconAdjustmentsHorizontal,
  IconArrowDownLeft,
  IconArrowUpRight,
  IconCheck,
  IconChevronDown,
  IconChevronUp,
  IconDotsVertical,
  IconFileExport,
  IconFilter,
  IconPlus,
  IconRefresh,
  IconShieldX,
  IconUsersGroup,
} from "@tabler/icons-react";
import { useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { createManualAttendance, listAttendance, type AttendanceItem, type AttendanceSummary } from "../api/attendance";
import { listDevices, type Device } from "../api/devices";
import { getMember, getMemberFull, getMembers, type Member } from "../api/members";
import type { FullMemberProfile } from "../shared/memberTypes";
import { rtlLanguages } from "../i18n/config";
import { useToast } from "../components/ToastContext";
import { CloseIconButton } from "../components/CloseIconButton";
import { useModalDismiss } from "../hooks/useModalDismiss";
import { ShamsiDateInput } from "../components/ui/ShamsiDateInput";
import { LocalizedDateTimeInput } from "../components/ui/LocalizedDateTimeInput";
import { PaginationControls } from "../components/ui/PaginationControls";
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
} from "../components/ui/DataTable";
import { resolveDateLocale } from "../shared/dateLocale";
import { localDateTimeInputToIso } from "../shared/dateInputValue";
import { formatAccessReason } from "../utils/accessReasons";
import { downloadCsv } from "../utils/csvDownload";
import { recordAttendanceClientCsvExport } from "../api/reportsAttendance";
import { useAuth } from "../auth/AuthContext";

const PAGE_SIZE = 20;
const MEMBER_TYPES = ["ALL", "CUSTOMER", "STAFF"] as const;

type MemberTypeFilter = (typeof MEMBER_TYPES)[number];
type EventTypeFilter = "ALL" | "IN" | "OUT";
type SourceFilter = "ALL" | "DEVICE" | "MANUAL" | "API";
type RangePreset = "today" | "last7" | "custom";
type IconComponent = typeof IconArrowDownLeft;
type SummaryTone = "emerald" | "blue" | "violet" | "amber";

export function Attendance() {
  const { t, i18n } = useTranslation();
  const { push } = useToast();
  const { hasPermission } = useAuth();
  const [searchParams] = useSearchParams();
  const isRtl = rtlLanguages.includes(i18n.language.split("-")[0]);
  const [items, setItems] = useState<AttendanceItem[]>([]);
  const [summary, setSummary] = useState<AttendanceSummary | null>(null);
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [memberType, setMemberType] = useState<MemberTypeFilter>("ALL");
  const [eventType, setEventType] = useState<EventTypeFilter>("ALL");
  const [source, setSource] = useState<SourceFilter>("ALL");
  const [deviceId, setDeviceId] = useState("");
  const [search, setSearch] = useState("");
  const [rangePreset, setRangePreset] = useState<RangePreset>("today");
  const [customFrom, setCustomFrom] = useState(() => formatDateInput(new Date()));
  const [customTo, setCustomTo] = useState(() => formatDateInput(new Date()));
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [memberIdFilter, setMemberIdFilter] = useState("");
  const [memberProfile, setMemberProfile] = useState<FullMemberProfile | null>(null);
  const [selectedRow, setSelectedRow] = useState<AttendanceItem | null>(null);
  const [manualModalOpen, setManualModalOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / PAGE_SIZE)), [total]);
  const isCustomRangeInvalid =
    rangePreset === "custom" && Boolean(customFrom) && Boolean(customTo) && customFrom > customTo;
  const resolvedRange = useMemo(() => resolveRange(rangePreset, customFrom, customTo), [rangePreset, customFrom, customTo]);
  const summaryData = useMemo(() => summary ?? buildSummaryFromItems(items), [summary, items]);
  const lastMemberEntry = useMemo(() => (selectedMember ? items[0]?.recordedAt : null), [items, selectedMember]);
  const selectedIsStaff = selectedMember ? selectedMember.memberType === "STAFF" || selectedMember.isStaff : false;
  const selectedStaffTitle = selectedMember?.customTitle ?? selectedMember?.roleType ?? "-";

  useEffect(() => {
    const memberIdParam = searchParams.get("memberId") ?? "";
    const memberTypeParam = searchParams.get("memberType");
    const fromParam = parseDateInput(searchParams.get("from"));
    const toParam = parseDateInput(searchParams.get("to"));

    if (memberTypeParam === "STAFF" || memberTypeParam === "CUSTOMER" || memberTypeParam === "ALL") {
      setMemberType(memberTypeParam);
    }
    if (memberIdParam) {
      setMemberIdFilter(memberIdParam);
    }
    if (fromParam || toParam) {
      setRangePreset("custom");
      if (fromParam) setCustomFrom(fromParam);
      if (toParam) setCustomTo(toParam);
    }
  }, [searchParams]);

  useEffect(() => {
    listDevices()
      .then(({ data }) => setDevices(data))
      .catch(() => setDevices([]));
  }, []);

  useEffect(() => {
    if (!selectedMember) {
      setMemberProfile(null);
      return;
    }
    let active = true;
    getMemberFull(selectedMember.id)
      .then(({ data }) => {
        if (active) setMemberProfile(data);
      })
      .catch(() => {
        if (active) setMemberProfile(null);
      });
    return () => {
      active = false;
    };
  }, [selectedMember]);

  useEffect(() => {
    if (!memberIdFilter) {
      if (selectedMember) setSelectedMember(null);
      return;
    }
    if (selectedMember?.id === memberIdFilter) return;
    let active = true;
    getMember(memberIdFilter)
      .then(({ data }) => {
        if (active) setSelectedMember(data);
      })
      .catch(() => {
        if (active) setSelectedMember(null);
      });
    return () => {
      active = false;
    };
  }, [memberIdFilter, selectedMember]);

  useEffect(() => {
    setPage(1);
  }, [memberType, eventType, source, deviceId, search, rangePreset, customFrom, customTo, memberIdFilter]);

  const loadAttendance = useCallback(async () => {
    if (isCustomRangeInvalid) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const params: Record<string, unknown> = {
        page,
        pageSize: PAGE_SIZE,
      };
      if (memberType !== "ALL") params.memberType = memberType;
      if (eventType !== "ALL") params.eventType = eventType;
      if (source !== "ALL") params.source = source;
      if (deviceId) params.deviceId = deviceId;
      if (search.trim()) params.search = search.trim();
      if (memberIdFilter) params.memberId = memberIdFilter;
      if (resolvedRange.from) params.from = resolvedRange.from;
      if (resolvedRange.to) params.to = resolvedRange.to;

      const { data } = await listAttendance(params);
      setItems(data.items);
      setTotal(data.total);
      setSummary(data.summary ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("attendance.table.empty"));
    } finally {
      setLoading(false);
    }
  }, [page, memberType, eventType, source, deviceId, search, memberIdFilter, resolvedRange, isCustomRangeInvalid, t]);

  useEffect(() => {
    loadAttendance();
  }, [loadAttendance]);

  useEffect(() => {
    if (error) {
      push({ kind: "error", title: error });
    }
  }, [error, push]);

  const clearFilters = () => {
    setMemberType("ALL");
    setEventType("ALL");
    setSource("ALL");
    setDeviceId("");
    setSearch("");
    setRangePreset("today");
    setCustomFrom(formatDateInput(new Date()));
    setCustomTo(formatDateInput(new Date()));
    setSelectedMember(null);
    setMemberIdFilter("");
  };

  const exportCsv = async () => {
    if (!items.length) return;
    const headers = [
      t("attendance.table.time"),
      t("attendance.table.member"),
      t("members.table.code"),
      t("attendance.table.type"),
      t("attendance.table.event"),
      t("attendance.table.device"),
      t("attendance.filters.source"),
      t("attendance.badges.authorized"),
      t("attendance.table.notes"),
    ];
    const rows = items.map((item) => [
      formatLocalizedDateTime(item.recordedAt, i18n.language),
      item.memberFullName,
      item.memberCode,
      t(`attendance.badges.${item.memberType === "STAFF" ? "staff" : "customer"}`),
      item.isAuthorized ? t(`attendance.badges.${item.eventType === "IN" ? "in" : "out"}`) : t("attendance.badges.denied"),
      item.deviceName ?? formatSourceLabel(item.source, t),
      formatSourceLabel(item.source, t),
      item.isAuthorized ? t("attendance.badges.authorized") : t("attendance.badges.denied"),
      formatAccessReason(item.reason, t),
    ]);
    const csv = [headers, ...rows].map((row) => row.map(escapeCsv).join(",")).join("\n");
    try {
      await recordAttendanceClientCsvExport({
        variant: "entry-logs",
        rowCount: items.length,
        lang: resolveExportLanguage(i18n.language),
        filters: {
          from: resolvedRange.from,
          to: resolvedRange.to,
          memberType,
          eventType,
          source,
          deviceId: deviceId || undefined,
          memberId: memberIdFilter || undefined,
          searchApplied: Boolean(search.trim()),
        },
      });
      downloadCsv(csv, `entry-logs-${formatDateInput(new Date())}.csv`);
    } catch (exportError) {
      push({ kind: "error", title: exportError instanceof Error ? exportError.message : "CSV export audit failed" });
    }
  };

  const handleManualEntry = async (payload: { memberId: string; eventType: "IN" | "OUT"; occurredAt?: string; notes?: string }) => {
    await createManualAttendance(payload);
    await loadAttendance();
  };

  const handleMemberFilterSelect = (member: Member | null) => {
    setSelectedMember(member);
    setMemberIdFilter(member?.id ?? "");
    if (member) {
      setSearch("");
    }
  };

  const applyFilters = () => {
    if (page !== 1) {
      setPage(1);
      return;
    }
    void loadAttendance();
  };

  return (
    <div
      className="entry-logs-compact entry-logs-page space-y-4"
      dir={isRtl ? "rtl" : "ltr"}
      data-testid="entry-logs-page"
    >
      <section className="rounded-2xl border border-slate-200/80 bg-white/80 p-3 text-slate-900 shadow-sm dark:border-slate-800/80 dark:bg-slate-950/70 dark:text-slate-100">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">{t("attendance.title")}</h2>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">{t("attendance.subtitle")}</p>
          </div>
          <div className="flex flex-wrap gap-2">
          {hasPermission("FINANCIAL_EXPORT") ? <button
            type="button"
            data-testid="entry-logs-export-csv"
            onClick={exportCsv}
            disabled={!items.length}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-brand-300 bg-white px-2.5 text-[11px] font-semibold text-brand-700 shadow-sm transition hover:border-brand-400 hover:bg-brand-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-brand-500/40 dark:bg-slate-950/70 dark:text-brand-100 dark:hover:bg-brand-500/10"
          >
            <IconFileExport className="h-3.5 w-3.5" stroke={1.8} aria-hidden="true" />
            <span>{t("attendance.actions.exportCsv")}</span>
          </button> : null}
          {hasPermission("ATTENDANCE_MANUAL") ? <button
            type="button"
            data-testid="entry-logs-manual-open"
            onClick={() => setManualModalOpen(true)}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-brand-600 bg-brand-600 px-2.5 text-[11px] font-semibold text-[#fff] shadow-sm shadow-brand-600/20 transition hover:bg-brand-700 dark:border-brand-500 dark:bg-brand-500 dark:hover:bg-brand-600"
          >
            <IconPlus className="h-3.5 w-3.5" stroke={1.9} aria-hidden="true" />
            <span>{t("attendance.actions.manualEntry")}</span>
          </button> : null}
          </div>
        </div>
      </section>

      <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          label={t("attendance.summary.totalIn")}
          value={summaryData.totalIn}
          helper={getEntryLogsTerm("entries", i18n.language)}
          icon={IconArrowDownLeft}
          tone="emerald"
        />
        <SummaryCard
          label={t("attendance.summary.totalOut")}
          value={summaryData.totalOut}
          helper={getEntryLogsTerm("entries", i18n.language)}
          icon={IconArrowUpRight}
          tone="blue"
        />
        <SummaryCard
          label={t("attendance.summary.uniqueVisitors")}
          value={summaryData.uniqueVisitors}
          helper={getEntryLogsTerm("members", i18n.language)}
          icon={IconUsersGroup}
          tone="violet"
        />
        <SummaryCard
          label={t("attendance.summary.deniedAttempts")}
          value={summaryData.deniedAttempts}
          helper={getEntryLogsTerm("attempts", i18n.language)}
          icon={IconShieldX}
          tone="amber"
        />
      </div>

      {selectedMember && (
        <div className="rounded-2xl border border-slate-200/90 bg-white/80 p-3 shadow-sm dark:border-slate-800/80 dark:bg-slate-950/70">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{t("attendance.memberSummary.title")}</p>
              <p className="text-xs font-semibold text-slate-950 dark:text-slate-100">
                {selectedMember.firstName} {selectedMember.lastName ?? ""}{" "}
                <span className="text-[11px] text-slate-500 dark:text-slate-400">#{selectedMember.code}</span>
              </p>
            </div>
            <CloseIconButton label={t("attendance.actions.close")} size="sm" onClick={() => setSelectedMember(null)} />
          </div>
          <div className="mt-3 grid gap-2 md:grid-cols-3">
            {selectedIsStaff ? (
              <SummaryMini label={t("attendance.details.roleTitle")} value={selectedStaffTitle} />
            ) : (
              <SummaryMini label={t("attendance.memberSummary.membershipStatus")} value={memberProfile?.memberships?.[0]?.status ?? "-"} />
            )}
            {selectedIsStaff ? (
              <SummaryMini label={t("attendance.filters.memberType")} value={t("attendance.badges.staff")} />
            ) : (
              <SummaryMini label={t("attendance.memberSummary.outstandingBalance")} value={memberProfile?.aggregates?.outstandingBalance ?? 0} />
            )}
            <SummaryMini label={t("attendance.memberSummary.lastEntry")} value={lastMemberEntry ? formatLocalizedDateTime(lastMemberEntry, i18n.language) : "-"} />
          </div>
        </div>
      )}

      <section className="overflow-visible rounded-2xl border border-slate-200/90 bg-white/80 shadow-sm dark:border-slate-800/80 dark:bg-slate-950/70">
        <div className="flex items-center justify-between gap-3 border-b border-slate-200/80 px-3 py-2.5 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <IconAdjustmentsHorizontal className="h-3.5 w-3.5 text-brand-600 dark:text-brand-300" stroke={1.9} aria-hidden="true" />
            <h3 className="text-xs font-semibold text-slate-900 dark:text-slate-100">
              {getEntryLogsTerm("filtersTitle", i18n.language)}
            </h3>
          </div>
          <button
            type="button"
            data-testid="entry-logs-filter-toggle"
            onClick={() => setFiltersOpen((prev) => !prev)}
            className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-[10px] font-semibold text-brand-600 transition hover:bg-brand-50 dark:text-brand-200 dark:hover:bg-brand-500/10"
          >
            <span>{filtersOpen ? t("common.actions.hideFilters") : t("common.actions.showFilters")}</span>
            <IconChevronUp className={`h-3 w-3 transition ${filtersOpen ? "" : "rotate-180"}`} stroke={1.9} aria-hidden="true" />
          </button>
        </div>

        {filtersOpen ? (
          <div className="p-3">
            <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
              <div className="min-w-0 space-y-2">
                <p className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">{t("attendance.filters.memberType")}</p>
                <div className="flex flex-wrap gap-2">
                  {MEMBER_TYPES.map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setMemberType(type)}
                      className={`rounded-full border px-2.5 py-0.5 text-[10px] font-semibold transition ${
                        memberType === type
                          ? "border-brand-300 bg-brand-100 text-brand-700 dark:border-brand-500/40 dark:bg-brand-500/20 dark:text-brand-100"
                          : "border-slate-200 bg-white text-slate-600 hover:border-brand-200 hover:text-brand-700 dark:border-slate-800 dark:bg-slate-900/50 dark:text-slate-300 dark:hover:border-brand-500/40 dark:hover:text-brand-100"
                      }`}
                    >
                      {t(`attendance.filters.${type === "ALL" ? "all" : type === "CUSTOMER" ? "customers" : "staff"}`)}
                    </button>
                  ))}
                </div>
              </div>

              <Field label={t("attendance.filters.dateRange")} className="min-w-0">
                <FilterSelectMenu
                  value={rangePreset}
                  onChange={(value) => setRangePreset(value as RangePreset)}
                  buttonClassName="form-input h-8"
                  testId="entry-logs-range-preset"
                  options={[
                    { value: "today", label: t("attendance.filters.today") },
                    { value: "last7", label: t("attendance.filters.last7") },
                    { value: "custom", label: t("attendance.filters.custom") },
                  ]}
                />
              </Field>

              <Field label={t("attendance.filters.eventType")} className="min-w-0">
                <FilterSelectMenu
                  value={eventType}
                  onChange={(value) => setEventType(value as EventTypeFilter)}
                  buttonClassName="form-input h-8"
                  options={[
                    { value: "ALL", label: t("attendance.filters.all") },
                    { value: "IN", label: t("attendance.badges.in") },
                    { value: "OUT", label: t("attendance.badges.out") },
                  ]}
                />
              </Field>

              <Field label={t("attendance.filters.searchPlaceholder")} className="min-w-0">
                <input
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={t("attendance.filters.searchPlaceholder")}
                  className="form-input h-8"
                />
              </Field>

              {rangePreset === "custom" && (
                <>
                  <Field label={t("attendance.filters.from")} className="min-w-0">
                    <div data-testid="entry-logs-date-from">
                      <ShamsiDateInput
                        value={customFrom}
                        onChange={setCustomFrom}
                        locale={i18n.language}
                        inputClassName="form-input h-8"
                      />
                    </div>
                  </Field>
                  <Field label={t("attendance.filters.to")} className="min-w-0">
                    <div data-testid="entry-logs-date-to">
                      <ShamsiDateInput
                        value={customTo}
                        onChange={setCustomTo}
                        locale={i18n.language}
                        inputClassName="form-input h-8"
                      />
                    </div>
                  </Field>
                  {isCustomRangeInvalid ? (
                    <p
                      className="text-[11px] font-semibold text-rose-600 dark:text-rose-300"
                      data-testid="entry-logs-range-error"
                    >
                      {t("attendance.filters.from")} ≤ {t("attendance.filters.to")}
                    </p>
                  ) : null}
                </>
              )}

              <Field label={t("attendance.filters.source")} className="min-w-0">
                <FilterSelectMenu
                  value={source}
                  onChange={(value) => setSource(value as SourceFilter)}
                  buttonClassName="form-input h-8"
                  options={[
                    { value: "ALL", label: t("attendance.filters.all") },
                    { value: "DEVICE", label: t("attendance.badges.device") },
                    { value: "MANUAL", label: t("attendance.badges.manual") },
                    { value: "API", label: t("attendance.badges.api") },
                  ]}
                />
              </Field>
              <Field label={t("attendance.filters.device")} className="min-w-0">
                <FilterSelectMenu
                  value={deviceId}
                  onChange={setDeviceId}
                  buttonClassName="form-input h-8"
                  options={[
                    { value: "", label: t("attendance.filters.all") },
                    ...devices.map((device) => ({
                      value: device.id,
                      label: device.name,
                    })),
                  ]}
                />
              </Field>

              <div className="min-w-0">
                <MemberSearchSelect
                  label={t("attendance.filters.member")}
                  placeholder={t("attendance.modal.selectMember")}
                  selected={selectedMember}
                  onSelect={handleMemberFilterSelect}
                />
              </div>
              <div className="flex min-w-0 flex-wrap items-end justify-end gap-2 self-end">
                <button
                  type="button"
                  onClick={clearFilters}
                  className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-2.5 text-[11px] font-semibold text-slate-600 transition hover:border-brand-300 hover:text-brand-700 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-200 dark:hover:border-brand-500/40"
                >
                  <IconRefresh className="h-3.5 w-3.5" stroke={1.8} aria-hidden="true" />
                  <span>{t("attendance.filters.clear")}</span>
                </button>
                <button
                  type="button"
                  data-testid="entry-logs-apply-filters"
                  onClick={applyFilters}
                  disabled={isCustomRangeInvalid}
                  className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-brand-600 bg-brand-600 px-3 text-[11px] font-semibold text-[#fff] shadow-sm shadow-brand-600/20 transition hover:bg-brand-700 dark:border-brand-500 dark:bg-brand-500 dark:hover:bg-brand-600"
                >
                  <IconFilter className="h-3.5 w-3.5" stroke={1.8} aria-hidden="true" />
                  <span>{t("common.actions.applyFilters")}</span>
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </section>

      <AttendanceTable
        items={items}
        loading={loading}
        onRowClick={(item) => setSelectedRow(item)}
        emptyLabel={t("attendance.table.empty")}
      />

      <PaginationControls
        disabled={loading}
        page={page}
        pageSize={PAGE_SIZE}
        totalItems={total}
        totalPages={totalPages}
        onPageChange={setPage}
      />

      <AttendanceDrawer item={selectedRow} onClose={() => setSelectedRow(null)} />
      <ManualEntryModal
        open={hasPermission("ATTENDANCE_MANUAL") && manualModalOpen}
        onClose={() => setManualModalOpen(false)}
        onSubmit={handleManualEntry}
        onSuccess={() => setManualModalOpen(false)}
      />
    </div>
  );
}

function AttendanceTable({
  items,
  loading,
  onRowClick,
  emptyLabel,
}: {
  items: AttendanceItem[];
  loading: boolean;
  onRowClick: (item: AttendanceItem) => void;
  emptyLabel: string;
}) {
  const { t, i18n } = useTranslation();

  return (
    <DataTableShell>
      <DataTable minWidth="820px">
        <DataTableHead>
          <DataTableRow>
            <DataTableHeaderCell>{t("attendance.table.time")}</DataTableHeaderCell>
            <DataTableHeaderCell>{t("attendance.table.member")}</DataTableHeaderCell>
            <DataTableHeaderCell>{t("attendance.table.type")}</DataTableHeaderCell>
            <DataTableHeaderCell>{t("attendance.table.event")}</DataTableHeaderCell>
            <DataTableHeaderCell>{t("attendance.table.device")}</DataTableHeaderCell>
            <DataTableHeaderCell>{t("attendance.table.notes")}</DataTableHeaderCell>
            <DataTableHeaderCell className="w-10" aria-label={t("common.actions.open")} />
          </DataTableRow>
        </DataTableHead>
        <DataTableBody>
          {loading ? (
            <DataTableSkeletonRows rows={6} columns={7} />
          ) : items.length === 0 ? (
            <DataTableEmptyRow colSpan={7}>{emptyLabel}</DataTableEmptyRow>
          ) : (
            items.map((item) => (
              <DataTableRow key={item.id} clickable onClick={() => onRowClick(item)}>
                <DataTableCell className="whitespace-nowrap text-slate-700 dark:text-slate-300">
                  {formatLocalizedDateTime(item.recordedAt, i18n.language)}
                </DataTableCell>
                <DataTableCell>
                  <div className="flex flex-wrap items-baseline gap-1.5">
                    <span className="font-semibold text-slate-950 dark:text-slate-100">{item.memberFullName}</span>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400">#{item.memberCode}</span>
                  </div>
                </DataTableCell>
                <DataTableCell>
                  <span className="rounded-full border border-slate-300 bg-slate-50 px-2 py-0.5 text-[10px] font-semibold uppercase text-slate-700 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-200">
                    {t(`attendance.badges.${item.memberType === "STAFF" ? "staff" : "customer"}`)}
                  </span>
                </DataTableCell>
                <DataTableCell>
                  {item.isAuthorized ? (
                    <span
                      className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase ${
                        item.eventType === "IN"
                          ? "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-500/50 dark:bg-emerald-500/10 dark:text-emerald-200"
                          : "border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-500/50 dark:bg-amber-500/10 dark:text-amber-200"
                      }`}
                    >
                      {t(`attendance.badges.${item.eventType === "IN" ? "in" : "out"}`)}
                    </span>
                  ) : (
                    <span className="rounded-full border border-rose-300 bg-rose-50 px-2 py-0.5 text-[10px] font-semibold uppercase text-rose-700 dark:border-rose-500/50 dark:bg-rose-500/10 dark:text-rose-200">
                      {t("attendance.badges.denied")}
                    </span>
                  )}
                </DataTableCell>
                <DataTableCell className="text-slate-700 dark:text-slate-300">
                  {item.deviceName ?? formatSourceLabel(item.source, t)}
                </DataTableCell>
                <DataTableCell className="max-w-[240px] truncate text-slate-600 dark:text-slate-300">
                  {formatAccessReason(item.reason, t) || "-"}
                </DataTableCell>
                <DataTableCell className="w-10 px-2" align="center">
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      onRowClick(item);
                    }}
                    className="inline-flex h-7 w-7 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:text-slate-500 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                    aria-label={t("common.actions.open")}
                  >
                    <IconDotsVertical className="h-3.5 w-3.5" stroke={1.9} aria-hidden="true" />
                  </button>
                </DataTableCell>
              </DataTableRow>
            ))
          )}
        </DataTableBody>
      </DataTable>
    </DataTableShell>
  );
}

function AttendanceDrawer({ item, onClose }: { item: AttendanceItem | null; onClose: () => void }) {
  const { t, i18n } = useTranslation();
  const isOpen = Boolean(item);
  useModalDismiss(onClose, isOpen);
  if (!item) return null;

  return (
    <div className="modal-overlay fixed inset-0 z-40 flex justify-end bg-black/60 p-4 sm:p-6" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl border border-slate-800/80 bg-slate-950 p-4 shadow-2xl shadow-black/40" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-500">{t("attendance.table.member")}</p>
            <p className="text-sm font-semibold text-white">
              {item.memberFullName} <span className="text-[10px] text-slate-400">#{item.memberCode}</span>
            </p>
          </div>
          <CloseIconButton label={t("attendance.actions.close")} onClick={onClose} />
        </div>

        <div className="mt-3 space-y-2.5 text-xs text-slate-200">
          <DetailRow label={t("attendance.table.time")} value={formatLocalizedDateTime(item.recordedAt, i18n.language)} />
          <DetailRow label={t("attendance.table.type")} value={t(`attendance.badges.${item.memberType === "STAFF" ? "staff" : "customer"}`)} />
          <DetailRow
            label={t("attendance.table.event")}
            value={item.isAuthorized ? t(`attendance.badges.${item.eventType === "IN" ? "in" : "out"}`) : "-"}
          />
          <DetailRow label={t("attendance.table.device")} value={item.deviceName ?? formatSourceLabel(item.source, t)} />
          <DetailRow label={t("attendance.filters.source")} value={formatSourceLabel(item.source, t)} />
          <DetailRow label={t("attendance.badges.authorized")} value={item.isAuthorized ? t("attendance.badges.authorized") : t("attendance.badges.denied")} />
          {item.membershipId ? (
            <DetailRow label={t("attendance.memberSummary.membershipStatus")} value={item.membershipStatus ?? "-"} />
          ) : null}
          {item.memberTitle ? <DetailRow label={t("attendance.details.roleTitle")} value={item.memberTitle} /> : null}
          <DetailRow label={t("attendance.table.notes")} value={formatAccessReason(item.reason, t) || "-"} />
        </div>
      </div>
    </div>
  );
}

function ManualEntryModal({
  open,
  onClose,
  onSubmit,
  onSuccess,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (payload: { memberId: string; eventType: "IN" | "OUT"; occurredAt?: string; notes?: string }) => Promise<void>;
  onSuccess: () => void;
}) {
  const { t, i18n } = useTranslation();
  const { push } = useToast();
  const [member, setMember] = useState<Member | null>(null);
  const [eventType, setEventType] = useState<"IN" | "OUT">("IN");
  const [occurredAt, setOccurredAt] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setMember(null);
    setEventType("IN");
    setOccurredAt("");
    setNotes("");
    setError(null);
  }, [open]);

  useEffect(() => {
    if (error) {
      push({ kind: "error", title: error });
    }
  }, [error, push]);

  useModalDismiss(onClose, open);
  if (!open) return null;

  const handleSubmit = async () => {
    if (!member) {
      setError(t("attendance.modal.selectMember"));
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const payload: { memberId: string; eventType: "IN" | "OUT"; occurredAt?: string; notes?: string } = {
        memberId: member.id,
        eventType,
      };
      if (occurredAt) {
        const occurredAtIso = localDateTimeInputToIso(occurredAt);
        if (!occurredAtIso) {
          setError(t("attendance.filters.dateRange"));
          setSubmitting(false);
          return;
        }
        payload.occurredAt = occurredAtIso;
      }
      const trimmedNotes = notes.trim();
      if (trimmedNotes) payload.notes = trimmedNotes;
      await onSubmit(payload);
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("attendance.table.empty"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div data-testid="entry-logs-manual-modal" className="modal-overlay fixed inset-0 z-40 flex items-center justify-center bg-black/60 p-4 sm:p-6" onClick={onClose}>
      <div className="w-full max-w-xl rounded-2xl border border-slate-800/80 bg-slate-950 p-4 sm:p-5 shadow-2xl shadow-black/40" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-white">{t("attendance.modal.title")}</h3>
            <p className="text-xs text-slate-400">{t("attendance.modal.description")}</p>
          </div>
          <CloseIconButton label={t("attendance.actions.close")} onClick={onClose} />
        </div>

        <div className="mt-3 space-y-3">
          <MemberSearchSelect label={t("attendance.modal.member")} placeholder={t("attendance.modal.selectMember")} selected={member} onSelect={setMember} />

          <div>
            <p className="text-xs font-semibold text-slate-300">{t("attendance.modal.eventType")}</p>
            <FilterSelectMenu
              value={eventType}
              onChange={(value) => setEventType(value as "IN" | "OUT")}
              buttonClassName="form-input"
              options={[
                { value: "IN", label: t("attendance.badges.in") },
                { value: "OUT", label: t("attendance.badges.out") },
              ]}
            />
          </div>

          <div>
            <p className="text-xs font-semibold text-slate-300">{t("attendance.modal.occurredAt")}</p>
            <LocalizedDateTimeInput value={occurredAt} onChange={setOccurredAt} locale={i18n.language} inputClassName="form-input" />
          </div>

          <div>
            <p className="text-xs font-semibold text-slate-300">{t("attendance.modal.notes")}</p>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="form-input min-h-[72px]" />
          </div>
        </div>

        <div className="mt-3 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="btn-cancel rounded-lg border border-slate-700 px-3 py-1.5 text-[11px] font-semibold text-slate-200"
            disabled={submitting}
          >
            {t("attendance.modal.cancel")}
          </button>
          <button
            type="button"
            data-testid="entry-logs-manual-submit"
            onClick={handleSubmit}
            className="btn-success rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-1.5 text-[11px] font-semibold text-emerald-100 hover:bg-emerald-500/20"
            disabled={submitting}
          >
            {t("attendance.modal.submit")}
          </button>
        </div>
      </div>
    </div>
  );
}

type SelectOption = {
  value: string;
  label: string;
};

function Field({ label, children, className = "" }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div className={className}>
      <p className="mb-1.5 text-[11px] font-semibold text-slate-600 dark:text-slate-300">{label}</p>
      {children}
    </div>
  );
}

function FilterSelectMenu({
  value,
  options,
  onChange,
  buttonClassName = "",
  containerClassName = "",
  testId,
}: {
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  buttonClassName?: string;
  containerClassName?: string;
  testId?: string;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const selectedOption = options.find((option) => option.value === value);
  const fallbackLabel = value || options[0]?.label || "";
  const displayLabel = selectedOption?.label ?? fallbackLabel;

  useEffect(() => {
    if (!open) return;
    const handleClick = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className={`relative ${containerClassName}`}>
      <button
        type="button"
        data-testid={testId}
        className={`${buttonClassName} flex w-full cursor-pointer items-center justify-between gap-2 text-start hover:bg-brand-500/10`}
        onClick={() => setOpen((prev) => !prev)}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="truncate">{displayLabel}</span>
        <IconChevronDown
          className={`h-3.5 w-3.5 shrink-0 text-slate-400 transition dark:text-slate-300/90 ${open ? "rotate-180" : ""}`}
          stroke={2}
        />
      </button>
      {open ? (
        <div className="submenu-panel absolute z-50 mt-1 w-full overflow-hidden rounded-xl border backdrop-blur">
          <div role="listbox" className="max-h-56 overflow-auto">
            {options.map((option) => {
              const isSelected = option.value === value;
              const optionKey = option.value === "" ? "all" : option.value;
              return (
                <button
                  key={optionKey}
                  type="button"
                  data-value={option.value}
                  role="option"
                  aria-selected={isSelected}
                  className={`submenu-option flex w-full items-center justify-between rounded-lg text-start transition ${
                    isSelected ? "is-selected" : ""
                  }`}
                  onClick={() => {
                    if (option.value !== value) {
                      onChange(option.value);
                    }
                    setOpen(false);
                  }}
                >
                  <span className="truncate">{option.label}</span>
                  {isSelected ? <IconCheck className="submenu-check h-3 w-3" stroke={2} /> : null}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function MemberSearchSelect({
  label,
  placeholder,
  selected,
  onSelect,
}: {
  label: string;
  placeholder: string;
  selected: Member | null;
  onSelect: (member: Member | null) => void;
}) {
  const { t } = useTranslation();
  const [query, setQuery] = useState(selected ? formatMemberLabel(selected) : "");
  const [options, setOptions] = useState<Member[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setQuery(selected ? formatMemberLabel(selected) : "");
  }, [selected]);

  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed || (selected && trimmed === formatMemberLabel(selected))) {
      setOptions([]);
      return;
    }
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const { data } = await getMembers({ search: trimmed, take: 6, skip: 0 });
        setOptions(data.items ?? []);
      } catch {
        setOptions([]);
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [query, selected]);

  const handleChange = (value: string) => {
    setQuery(value);
    if (selected && value !== formatMemberLabel(selected)) {
      onSelect(null);
    }
  };

  return (
    <div className="relative">
      <p className="mb-1.5 text-[11px] font-semibold text-slate-600 dark:text-slate-300">{label}</p>
      <div className="relative">
        <input
          type="search"
          data-testid="entry-logs-manual-member-search"
          value={query}
          onChange={(e) => handleChange(e.target.value)}
          placeholder={placeholder}
          className="form-input h-8"
        />
      </div>
      {selected ? (
        <button
          type="button"
          onClick={() => onSelect(null)}
          className="absolute end-2 top-7 rounded-full border border-slate-300 bg-white px-2 py-0.5 text-[10px] text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
        >
          x
        </button>
      ) : null}
      {!selected && query.trim() && (
        <div className="absolute z-20 mt-1 w-full rounded-xl border border-slate-200 bg-white/95 p-1.5 text-xs text-slate-700 shadow-xl backdrop-blur dark:border-slate-800 dark:bg-slate-950/95 dark:text-slate-200">
          {loading ? (
            <p className="px-2 py-1 text-xs text-slate-400">...</p>
          ) : options.length === 0 ? (
            <p className="px-2 py-1 text-xs text-slate-400">-</p>
          ) : (
            options.map((member) => (
              <button
                key={member.id}
                type="button"
                data-testid={`entry-logs-manual-member-${member.id}`}
                onClick={() => onSelect(member)}
                className="flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-start hover:bg-slate-100 dark:hover:bg-slate-900/70"
              >
                <span>
                  {member.firstName} {member.lastName ?? ""} <span className="text-[10px] text-slate-500 dark:text-slate-400">#{member.code}</span>
                </span>
                <span className="text-[10px] uppercase text-slate-500 dark:text-slate-400">
                  {t(`attendance.badges.${member.memberType === "STAFF" ? "staff" : "customer"}`)}
                </span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

function SummaryCard({
  label,
  value,
  helper,
  icon: Icon,
  tone,
}: {
  label: string;
  value: number;
  helper: string;
  icon: IconComponent;
  tone: SummaryTone;
}) {
  const { i18n } = useTranslation();
  const toneClass: Record<SummaryTone, { iconWrap: string; icon: string }> = {
    emerald: {
      iconWrap: "bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-200",
      icon: "text-emerald-600 dark:text-emerald-200",
    },
    blue: {
      iconWrap: "bg-blue-100 text-blue-600 dark:bg-blue-500/15 dark:text-blue-200",
      icon: "text-blue-600 dark:text-blue-200",
    },
    violet: {
      iconWrap: "bg-violet-100 text-violet-600 dark:bg-violet-500/15 dark:text-violet-200",
      icon: "text-violet-600 dark:text-violet-200",
    },
    amber: {
      iconWrap: "bg-amber-100 text-amber-600 dark:bg-amber-500/15 dark:text-amber-200",
      icon: "text-amber-600 dark:text-amber-200",
    },
  };
  const classes = toneClass[tone];
  return (
    <div className="flex min-h-[74px] items-center gap-2.5 rounded-xl border border-slate-200/90 bg-white/80 p-2.5 shadow-sm dark:border-slate-800/80 dark:bg-slate-950/70">
      <span className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${classes.iconWrap}`}>
        <Icon className={`h-4 w-4 ${classes.icon}`} stroke={1.9} aria-hidden="true" />
      </span>
      <div className="min-w-0">
        <p className="text-[9px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</p>
        <p className="mt-0.5 text-base font-bold leading-none text-slate-950 dark:text-slate-100">{formatNumber(value, i18n.language)}</p>
        <p className="mt-0.5 text-[10px] text-slate-500 dark:text-slate-400">{helper}</p>
      </div>
    </div>
  );
}

function SummaryMini({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white/70 p-2.5 text-xs text-slate-700 dark:border-slate-800 dark:bg-slate-900/40 dark:text-slate-200">
      <p className="text-[10px] uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-xs font-semibold text-slate-950 dark:text-slate-100">{value}</p>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-[11px] uppercase tracking-wide text-slate-500">{label}</span>
      <span className="text-xs text-slate-200">{value}</span>
    </div>
  );
}

function resolveRange(preset: RangePreset, fromValue: string, toValue: string) {
  const now = new Date();
  if (preset === "today") {
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    const end = new Date(now);
    end.setHours(23, 59, 59, 999);
    return { from: start.toISOString(), to: end.toISOString() };
  }
  if (preset === "last7") {
    const end = new Date(now);
    end.setHours(23, 59, 59, 999);
    const start = new Date(now);
    start.setDate(start.getDate() - 6);
    start.setHours(0, 0, 0, 0);
    return { from: start.toISOString(), to: end.toISOString() };
  }
  const from = fromValue ? new Date(`${fromValue}T00:00:00`) : null;
  const to = toValue ? new Date(`${toValue}T23:59:59.999`) : null;
  return {
    from: from && !Number.isNaN(from.getTime()) ? from.toISOString() : undefined,
    to: to && !Number.isNaN(to.getTime()) ? to.toISOString() : undefined,
  };
}

function formatDateInput(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseDateInput(value: string | null) {
  if (!value) return "";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  return formatDateInput(parsed);
}

function formatLocalizedDateTime(value: string | null | undefined, locale = "en") {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "-";
  return parsed.toLocaleString(resolveDateLocale(locale));
}

function formatNumber(value: number, locale = "en") {
  return new Intl.NumberFormat(resolveDateLocale(locale)).format(value);
}

function escapeCsv(value: string | number | null | undefined) {
  const raw = value === null || value === undefined ? "" : String(value);
  if (/[",\n]/.test(raw)) {
    return `"${raw.replace(/"/g, "\"\"")}"`;
  }
  return raw;
}

function resolveExportLanguage(language: string): "en" | "fa" | "ps" {
  const normalized = language.trim().toLowerCase();
  if (normalized === "fa" || normalized.startsWith("fa-") || normalized === "dr" || normalized.startsWith("dr-")) return "fa";
  if (normalized === "ps" || normalized.startsWith("ps-")) return "ps";
  return "en";
}

function buildSummaryFromItems(items: AttendanceItem[]): AttendanceSummary {
  const totalIn = items.filter((item) => item.isAuthorized && item.eventType === "IN").length;
  const totalOut = items.filter((item) => item.isAuthorized && item.eventType === "OUT").length;
  const deniedAttempts = items.filter((item) => !item.isAuthorized).length;
  const uniqueVisitors = new Set(items.map((item) => item.memberId)).size;
  return { totalIn, totalOut, uniqueVisitors, deniedAttempts };
}

function formatMemberLabel(member: Member) {
  return `${member.firstName ?? ""} ${member.lastName ?? ""} #${member.code}`.trim();
}

function formatSourceLabel(source: string, t: (key: string) => string) {
  if (source === "MANUAL") return t("attendance.badges.manual");
  if (source === "API") return t("attendance.badges.api");
  return t("attendance.badges.device");
}

function getEntryLogsTerm(key: "filtersTitle" | "entries" | "members" | "attempts", locale = "en") {
  const language = locale.split("-")[0];
  const terms = language === "ps"
    ? {
        filtersTitle: "فلټرونه",
        entries: "ثبتونه",
        members: "غړي",
        attempts: "هڅې",
      }
    : language === "fa" || language === "prs"
      ? {
          filtersTitle: "فیلترها",
          entries: "مورد",
          members: "عضو",
          attempts: "تلاش",
        }
      : {
          filtersTitle: "Filters",
          entries: "entries",
          members: "members",
          attempts: "attempts",
        };
  return terms[key];
}
