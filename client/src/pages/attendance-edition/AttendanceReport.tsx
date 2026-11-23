import { IconAlertTriangle } from "@tabler/icons-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  downloadAttendanceReportCsv,
  downloadAttendanceReportPdf,
  downloadAttendanceReportXlsx,
  downloadAttendanceMonthlyTimecard,
  getAttendanceMonthlyTimecard,
  getAttendanceReportDaily,
  getAttendanceReportEmployees,
  getAttendanceReportEvidence,
  getAttendanceReportOptions,
  getAttendanceReportSummary,
  type AttendanceReportReadFilters,
  type MonthlyTimecardItem,
} from "../../api/attendanceReports";
import { useAuth } from "../../auth/AuthContext";
import { useToast } from "../../components/ToastContext";
import { ErrorState } from "../../components/ui/StatePanel";
import type { AttendanceReportMembersSortBy } from "../../api/reportsAttendance";
import { getLocalizedDatePresetRange } from "../../shared/datePresets";
import { rtlLanguages } from "../../i18n/config";
import { DailySummaryTable } from "../reports/attendance-report/DailySummaryTable";
import { EvidenceTable } from "../reports/attendance-report/EvidenceTable";
import { FiltersPanel, type MemberFilterOption } from "../reports/attendance-report/FiltersPanel";
import { KpiGrid } from "../reports/attendance-report/KpiGrid";
import { MembersTable } from "../reports/attendance-report/MembersTable";
import { TrendPanel } from "../reports/attendance-report/TrendPanel";
import {
  EMPTY_KPIS,
  EMPTY_PAGE,
  type AttendanceReportFilters,
  type DailyItem,
  type DatePreset,
  type EvidenceItem,
  type ExportKind,
  type Kpis,
  type MemberItem,
  type ReportTab,
} from "../reports/attendance-report/types";
import { getAttendanceEditionReportCopy } from "./attendanceReportCopy";
import { MonthlyTimecardTable } from "./MonthlyTimecardTable";

const SURFACE_CARD =
  "rounded-2xl border border-slate-200/90 bg-white/90 p-3 shadow-sm dark:border-slate-800/90 dark:bg-slate-950/70";

export function AttendanceReport() {
  const { i18n } = useTranslation();
  const { hasPermission } = useAuth();
  const { push } = useToast();
  const copy = getAttendanceEditionReportCopy(i18n.language);
  const [searchParams, setSearchParams] = useSearchParams();
  const [filters, setFilters] = useState<AttendanceReportFilters>(() => readFilters(searchParams, i18n.language));
  const [appliedFilters, setAppliedFilters] = useState(filters);
  const [tab, setTab] = useState<ReportTab>(() => readTab(searchParams));
  const [dailyPage, setDailyPage] = useState(1);
  const [employeesPage, setEmployeesPage] = useState(1);
  const [evidencePage, setEvidencePage] = useState(1);
  const [timecardPage, setTimecardPage] = useState(1);
  const [timecardMonth, setTimecardMonth] = useState(() => searchParams.get("month") || filters.from.slice(0, 7));
  const [sortBy, setSortBy] = useState<AttendanceReportMembersSortBy>("memberName");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const [busyExport, setBusyExport] = useState<ExportKind | null>(null);
  const [kpis, setKpis] = useState<Kpis>(EMPTY_KPIS);
  const [trend, setTrend] = useState<DailyItem[]>([]);
  const [daily, setDaily] = useState<DailyItem[]>([]);
  const [dailyInfo, setDailyInfo] = useState(EMPTY_PAGE);
  const [employees, setEmployees] = useState<MemberItem[]>([]);
  const [employeesInfo, setEmployeesInfo] = useState(EMPTY_PAGE);
  const [evidence, setEvidence] = useState<EvidenceItem[]>([]);
  const [evidenceInfo, setEvidenceInfo] = useState(EMPTY_PAGE);
  const [timecards, setTimecards] = useState<MonthlyTimecardItem[]>([]);
  const [timecardInfo, setTimecardInfo] = useState(EMPTY_PAGE);
  const [busyTimecardExport, setBusyTimecardExport] = useState<"csv" | "xlsx" | "pdf" | null>(null);
  const [options, setOptions] = useState({
    shifts: [] as Array<{ id: string; shiftName: string; shiftStart: string; shiftEnd: string }>,
    groups: [] as Array<{ id: string; name: string }>,
    devices: [] as Array<{ id: string; name: string }>,
    employees: [] as MemberFilterOption[],
  });
  const [loadingSummary, setLoadingSummary] = useState(true);
  const [loadingTab, setLoadingTab] = useState(true);
  const [loadingTrend, setLoadingTrend] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const isRtl = rtlLanguages.includes(i18n.language.split("-")[0]);
  const invalidRange = Boolean(filters.from && filters.to && filters.from > filters.to);
  const canExport = hasPermission("ATTENDANCE_EXPORT");

  const apiFilters = useMemo<AttendanceReportReadFilters>(() => ({
    from: appliedFilters.from,
    to: appliedFilters.to,
    shiftMode: appliedFilters.shiftMode,
    eventType: appliedFilters.eventType,
    onlyAnomalies: appliedFilters.onlyAnomalies,
    ...(appliedFilters.memberId ? { memberId: appliedFilters.memberId } : {}),
    ...(appliedFilters.shiftId ? { shiftId: appliedFilters.shiftId } : {}),
    ...(appliedFilters.staffGroupId ? { staffGroupId: appliedFilters.staffGroupId } : {}),
    ...(appliedFilters.deviceId ? { deviceId: appliedFilters.deviceId } : {}),
  }), [appliedFilters]);

  const applyPreset = useCallback((preset: DatePreset) => {
    const range = getLocalizedDatePresetRange(preset, i18n.language);
    setFilters((current) => ({ ...current, preset, from: range.from, to: range.to }));
  }, [i18n.language]);

  const toggleAnomalies = useCallback(() => {
    setFilters((current) => ({ ...current, onlyAnomalies: !current.onlyAnomalies }));
    setAppliedFilters((current) => ({ ...current, onlyAnomalies: !current.onlyAnomalies }));
  }, []);

  useEffect(() => {
    void getAttendanceReportOptions().then(({ data }) => setOptions({
      shifts: data.shifts.map((shift) => ({ id: shift.id, shiftName: shift.name, shiftStart: shift.start, shiftEnd: shift.end })),
      groups: data.groups,
      devices: data.devices,
      employees: data.employees.map((employee) => ({ id: employee.id, label: `${employee.name} (#${employee.code})` })),
    })).catch(() => setOptions({ shifts: [], groups: [], devices: [], employees: [] }));
  }, []);

  useEffect(() => {
    const query = new URLSearchParams({
      tab,
      preset: appliedFilters.preset,
      from: appliedFilters.from,
      to: appliedFilters.to,
      eventType: appliedFilters.eventType,
      shiftMode: appliedFilters.shiftMode,
    });
    if (appliedFilters.memberId) query.set("memberId", appliedFilters.memberId);
    if (appliedFilters.shiftId) query.set("shiftId", appliedFilters.shiftId);
    if (appliedFilters.staffGroupId) query.set("staffGroupId", appliedFilters.staffGroupId);
    if (appliedFilters.deviceId) query.set("deviceId", appliedFilters.deviceId);
    if (appliedFilters.onlyAnomalies) query.set("onlyAnomalies", "true");
    if (tab === "timecard") query.set("month", timecardMonth);
    setSearchParams(query, { replace: true });
  }, [appliedFilters, setSearchParams, tab, timecardMonth]);

  useEffect(() => {
    setDailyPage(1); setEmployeesPage(1); setEvidencePage(1); setTimecardPage(1); setError(null);
    setLoadingSummary(true);
    void getAttendanceReportSummary(apiFilters)
      .then(({ data }) => setKpis(data.kpis))
      .catch((loadError) => { setKpis(EMPTY_KPIS); setError(messageFor(loadError, copy.loadFailed)); })
      .finally(() => setLoadingSummary(false));
    setLoadingTrend(true);
    void loadTrend(apiFilters)
      .then(setTrend)
      .catch(() => setTrend([]))
      .finally(() => setLoadingTrend(false));
  }, [apiFilters, copy.loadFailed]);

  useEffect(() => {
    setLoadingTab(true);
    const request = tab === "daily"
      ? getAttendanceReportDaily(apiFilters, dailyPage, 20).then(({ data }) => { setDaily(data.items); setDailyInfo(data.pageInfo); })
      : tab === "members"
        ? getAttendanceReportEmployees(apiFilters, { page: employeesPage, pageSize: 20, sortBy, sortDir }).then(({ data }) => { setEmployees(data.items); setEmployeesInfo(data.pageInfo); })
        : tab === "evidence"
          ? getAttendanceReportEvidence(apiFilters, { page: evidencePage, pageSize: 20 }).then(({ data }) => { setEvidence(data.items); setEvidenceInfo(data.pageInfo); })
          : getAttendanceMonthlyTimecard({
              month: timecardMonth,
              page: timecardPage,
              pageSize: 20,
              ...(appliedFilters.memberId ? { memberId: appliedFilters.memberId } : {}),
              ...(appliedFilters.staffGroupId ? { staffGroupId: appliedFilters.staffGroupId } : {}),
            }).then(({ data }) => { setTimecards(data.items); setTimecardInfo(data.pageInfo); });
    void request.catch((loadError) => setError(messageFor(loadError, copy.loadFailed))).finally(() => setLoadingTab(false));
  }, [apiFilters, appliedFilters.memberId, appliedFilters.staffGroupId, copy.loadFailed, dailyPage, employeesPage, evidencePage, sortBy, sortDir, tab, timecardMonth, timecardPage]);

  const handleExport = useCallback(async (kind: ExportKind) => {
    setExportMenuOpen(false);
    setBusyExport(kind);
    const language = resolveExportLanguage(i18n.language);
    try {
      if (kind === "xlsx") {
        const { data } = await downloadAttendanceReportXlsx(apiFilters, language);
        saveBlob(data, `entry-control-attendance-report-${appliedFilters.from}-to-${appliedFilters.to}.xlsx`);
      } else if (kind === "pdf") {
        const { data } = await downloadAttendanceReportPdf(apiFilters, language);
        saveBlob(data, `entry-control-attendance-report-${appliedFilters.from}-to-${appliedFilters.to}.pdf`);
      } else {
        const variant = kind === "csvDaily" ? "daily" : kind === "csvMembers" ? "members" : "evidence";
        const { data } = await downloadAttendanceReportCsv(apiFilters, variant, language, sortBy, sortDir);
        saveBlob(data, `entry-control-attendance-${variant}-${appliedFilters.from}-to-${appliedFilters.to}.csv`);
      }
      push({ kind: "success", title: copy.exportCompleted });
    } catch (exportError) {
      push({ kind: "error", title: messageFor(exportError, copy.exportFailed) });
    } finally {
      setBusyExport(null);
    }
  }, [apiFilters, appliedFilters.from, appliedFilters.to, copy.exportCompleted, copy.exportFailed, i18n.language, push, sortBy, sortDir]);

  const handleTimecardExport = useCallback(async (format: "csv" | "xlsx" | "pdf") => {
    setBusyTimecardExport(format);
    try {
      const { data } = await downloadAttendanceMonthlyTimecard(format, {
        month: timecardMonth,
        lang: resolveExportLanguage(i18n.language),
        ...(appliedFilters.memberId ? { memberId: appliedFilters.memberId } : {}),
        ...(appliedFilters.staffGroupId ? { staffGroupId: appliedFilters.staffGroupId } : {}),
      });
      saveBlob(data, `entry-control-attendance-monthly-timecard-${timecardMonth}.${format}`);
      push({ kind: "success", title: copy.exportCompleted });
    } catch (exportError) {
      push({ kind: "error", title: messageFor(exportError, copy.exportFailed) });
    } finally {
      setBusyTimecardExport(null);
    }
  }, [appliedFilters.memberId, appliedFilters.staffGroupId, copy.exportCompleted, copy.exportFailed, i18n.language, push, timecardMonth]);

  const tabStyle = (target: ReportTab) =>
    `attendance-tab-btn rounded-full px-2.5 py-1 text-[11px] font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/30 ${
      tab === target
        ? "is-active bg-brand-500 text-white shadow"
        : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
    }`;

  return <section className="reports-page space-y-4" data-testid="attendance-report" dir={isRtl ? "rtl" : "ltr"}>
    <section className={SURFACE_CARD}>
      <div>
        <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{copy.title}</h2>
        <p className="text-[11px] text-slate-500 dark:text-slate-400">{copy.subtitle}</p>
      </div>
    </section>
    {error ? (
      <ErrorState
        data-testid="attendance-report-error"
        icon={<IconAlertTriangle className="h-5 w-5" stroke={1.8} />}
        title={error}
      />
    ) : null}
    <FiltersPanel
      filters={filters} onChange={(patch) => setFilters((current) => ({ ...current, ...patch, memberType: "staff" }))}
      onApplyPreset={applyPreset} onApplyFilters={() => { if (!invalidRange) setAppliedFilters({ ...filters, memberType: "staff" }); }}
      canApplyFilters={JSON.stringify(filters) !== JSON.stringify(appliedFilters) && !invalidRange} invalidDateRange={invalidRange}
      loading={loadingSummary || loadingTab} shifts={options.shifts} groups={options.groups} devices={options.devices} members={options.employees}
      filtersOpen={filtersOpen} onToggleFilters={() => setFiltersOpen((value) => !value)}
      exportMenuOpen={exportMenuOpen} onToggleExportMenu={() => setExportMenuOpen((value) => !value)} onExport={handleExport} busyExport={busyExport}
      staffOnly allowExport={canExport} exportPermission="attendance"
    />
    <KpiGrid kpis={kpis} trendData={trend} loading={loadingSummary} staffLabels={copy.kpis} />
    <TrendPanel dailySeries={trend} loading={loadingTrend} />
    <section className={`${SURFACE_CARD} space-y-2.5 staff-attendance-report-workspace`}>
      <div className="flex flex-wrap gap-2" role="tablist" aria-label={copy.title}>
        <ReportTabButton active={tab === "daily"} className={tabStyle("daily")} testId="attendance-report-tab-daily" onClick={() => setTab("daily")}>{copy.daily}</ReportTabButton>
        <ReportTabButton active={tab === "members"} className={tabStyle("members")} testId="attendance-report-tab-employees" onClick={() => setTab("members")}>{copy.employees}</ReportTabButton>
        <ReportTabButton active={tab === "evidence"} className={tabStyle("evidence")} testId="attendance-report-tab-evidence" onClick={() => setTab("evidence")}>{copy.evidence}</ReportTabButton>
        <ReportTabButton active={tab === "timecard"} className={tabStyle("timecard")} testId="attendance-report-tab-timecard" onClick={() => setTab("timecard")}>{copy.monthlyTimecard}</ReportTabButton>
      </div>
      {tab === "daily" && <DailySummaryTable items={daily} loading={loadingTab} page={dailyPage} pageInfo={dailyInfo} onPageChange={setDailyPage} onlyAnomalies={filters.onlyAnomalies} onToggleOnlyAnomalies={toggleAnomalies} />}
      {tab === "members" && <MembersTable items={employees} loading={loadingTab} page={employeesPage} pageInfo={employeesInfo} onPageChange={setEmployeesPage} sortBy={sortBy} sortDir={sortDir} onSortByChange={setSortBy} onSortDirToggle={() => setSortDir((value) => value === "asc" ? "desc" : "asc")} onlyAnomalies={filters.onlyAnomalies} onToggleOnlyAnomalies={toggleAnomalies} staffOnly />}
      {tab === "evidence" && <EvidenceTable items={evidence} loading={loadingTab} page={evidencePage} pageInfo={evidenceInfo} onPageChange={setEvidencePage} onlyAnomalies={filters.onlyAnomalies} onToggleOnlyAnomalies={toggleAnomalies} staffOnly />}
      {tab === "timecard" && <MonthlyTimecardTable copy={copy.timecard} items={timecards} loading={loadingTab} month={timecardMonth} onMonthChange={(value) => { if (/^\d{4}-\d{2}$/u.test(value)) { setTimecardMonth(value); setTimecardPage(1); } }} page={timecardPage} pageInfo={timecardInfo} onPageChange={setTimecardPage} canExport={canExport} busyExport={busyTimecardExport} onExport={(format) => void handleTimecardExport(format)} />}
    </section>
  </section>;
}

function ReportTabButton({ active, children, className, onClick, testId }: { active: boolean; children: string; className: string; onClick: () => void; testId: string }) {
  return (
    <button
      aria-selected={active}
      className={className}
      data-testid={testId}
      onClick={onClick}
      role="tab"
      type="button"
    >
      {children}
    </button>
  );
}

function readTab(search: URLSearchParams): ReportTab {
  const tab = search.get("tab");
  return tab === "members" || tab === "evidence" || tab === "timecard" ? tab : "daily";
}

function readFilters(search: URLSearchParams, language: string): AttendanceReportFilters {
  const preset = parsePreset(search.get("preset"));
  const range = getLocalizedDatePresetRange(preset, language);
  return {
    preset, from: search.get("from") || range.from, to: search.get("to") || range.to,
    memberId: search.get("memberId") || "", memberType: "staff",
    eventType: parseValue(search.get("eventType"), ["all", "in", "out", "denied"], "all"),
    shiftMode: parseValue(search.get("shiftMode"), ["primary", "all", "ignoreShifts"], "primary"),
    shiftId: search.get("shiftId") || "", staffGroupId: search.get("staffGroupId") || "",
    deviceId: search.get("deviceId") || "", onlyAnomalies: search.get("onlyAnomalies") === "true",
  };
}

function parsePreset(value: string | null): DatePreset {
  return parseValue(value, ["today", "thisWeek", "thisMonth", "custom"], "thisMonth");
}

function parseValue<T extends string>(value: string | null, values: readonly T[], fallback: T): T {
  return value && values.includes(value as T) ? value as T : fallback;
}

async function loadTrend(filters: AttendanceReportReadFilters) {
  const items: DailyItem[] = [];
  for (let page = 1; ; page += 1) {
    const { data } = await getAttendanceReportDaily(filters, page, 200);
    items.push(...data.items);
    if (page >= data.pageInfo.totalPages) return items;
  }
}

function messageFor(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
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

function resolveExportLanguage(language: string): "en" | "fa" | "ps" {
  const normalized = language.trim().toLowerCase();
  if (normalized === "fa" || normalized.startsWith("fa-") || normalized === "dr" || normalized.startsWith("dr-")) return "fa";
  if (normalized === "ps" || normalized.startsWith("ps-")) return "ps";
  return "en";
}
