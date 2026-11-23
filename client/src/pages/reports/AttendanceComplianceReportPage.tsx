import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { IconFileExport, IconFileSpreadsheet } from "@tabler/icons-react";
import {
  downloadAttendanceComplianceCsv,
  downloadAttendanceComplianceXlsx,
  getAttendanceComplianceReport,
  type AttendanceComplianceItem,
  type AttendanceComplianceQuery,
  type AttendanceComplianceReportResponse,
} from "../../api/attendanceComplianceReport";
import { listDevices, type Device } from "../../api/devices";
import { getMembers, type Member } from "../../api/members";
import {
  getAttendanceReportDaily,
  getAttendanceReportEvidence,
  type AttendanceReportDailyItem,
  type AttendanceReportEvidenceItem,
} from "../../api/reportsAttendance";
import { getShiftTemplates, type ShiftTemplate } from "../../api/shifts";
import { getStaffGroups, type StaffGroup } from "../../api/staffGroups";
import { resolveDateLocale } from "../../shared/dateLocale";
import { getLocalizedDatePresetRange } from "../../shared/datePresets";
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

type Preset = "today" | "thisWeek" | "thisMonth" | "custom";
type Filters = {
  preset: Preset;
  from: string;
  to: string;
  memberType: NonNullable<AttendanceComplianceQuery["memberType"]>;
  shiftMode: NonNullable<AttendanceComplianceQuery["shiftMode"]>;
  shiftId: string;
  staffGroupId: string;
  deviceId: string;
  eventType: NonNullable<AttendanceComplianceQuery["eventType"]>;
  memberId: string;
  onlyAnomalies: boolean;
  viewBy: NonNullable<AttendanceComplianceQuery["viewBy"]>;
  lateMinutesWeight: number;
  lateCountWeight: number;
  absentWeight: number;
  noCheckoutWeight: number;
  deniedWeight: number;
  page: number;
};
type MemberFilterOption = {
  id: string;
  label: string;
};

const PAGE_SIZE = 20;
const MEMBER_FILTER_PAGE_SIZE = 100;
const MEMBER_FILTER_LIMIT = 5000;
const INPUT = REPORT_FILTER_FIELD_CLASS;
const CARD = "rounded-2xl border border-slate-200/80 bg-white/90 p-3 shadow-sm dark:border-slate-800/80 dark:bg-slate-950/70";
const FILTER_CARD = REPORT_FILTER_PANEL_CLASS;
const LABEL = REPORT_FILTER_LABEL_CLASS;

const EMPTY_REPORT: AttendanceComplianceReportResponse = {
  generatedAt: new Date(0).toISOString(),
  filters: {
    from: "",
    to: "",
    memberType: "both",
    shiftMode: "primary",
    shiftId: null,
    staffGroupId: null,
    deviceId: null,
    eventType: "all",
    search: null,
    onlyAnomalies: false,
    viewBy: "member",
    sortBy: "score",
    sortDir: "asc",
    weights: {
      lateMinutesWeight: 0.05,
      lateCountWeight: 1,
      absentWeight: 8,
      noCheckoutWeight: 4,
      deniedWeight: 6,
    },
  },
  kpis: {
    averageScore: 0,
    bestScore: 0,
    worstScore: 0,
    evaluatedCount: 0,
  },
  charts: {
    distribution: [],
    topLowScores: [],
  },
  items: [],
  pageInfo: {
    page: 1,
    pageSize: PAGE_SIZE,
    totalItems: 0,
    totalPages: 1,
  },
};

function createDefaultFilters(locale = "en"): Filters {
  const range = getLocalizedDatePresetRange("thisMonth", locale);
  return {
    preset: "thisMonth",
    from: range.from,
    to: range.to,
    memberType: "both",
    shiftMode: "primary",
    shiftId: "",
    staffGroupId: "",
    deviceId: "",
    eventType: "all",
    memberId: "",
    onlyAnomalies: false,
    viewBy: "member",
    lateMinutesWeight: 0.05,
    lateCountWeight: 1,
    absentWeight: 8,
    noCheckoutWeight: 4,
    deniedWeight: 6,
    page: 1,
  };
}

function areFiltersEqual(left: Filters, right: Filters) {
  return (
    left.preset === right.preset &&
    left.from === right.from &&
    left.to === right.to &&
    left.memberType === right.memberType &&
    left.shiftMode === right.shiftMode &&
    left.shiftId === right.shiftId &&
    left.staffGroupId === right.staffGroupId &&
    left.deviceId === right.deviceId &&
    left.eventType === right.eventType &&
    left.memberId === right.memberId &&
    left.onlyAnomalies === right.onlyAnomalies &&
    left.viewBy === right.viewBy &&
    left.lateMinutesWeight === right.lateMinutesWeight &&
    left.lateCountWeight === right.lateCountWeight &&
    left.absentWeight === right.absentWeight &&
    left.noCheckoutWeight === right.noCheckoutWeight &&
    left.deniedWeight === right.deniedWeight &&
    left.page === right.page
  );
}

export function AttendanceComplianceReportPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { push } = useToast();
  const numberLocale = useMemo(() => resolveNumberLocale(i18n.language), [i18n.language]);

  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState<"csv" | "xlsx" | null>(null);
  const [report, setReport] = useState<AttendanceComplianceReportResponse>(EMPTY_REPORT);
  const [shifts, setShifts] = useState<ShiftTemplate[]>([]);
  const [groups, setGroups] = useState<StaffGroup[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [members, setMembers] = useState<MemberFilterOption[]>([]);
  const [selected, setSelected] = useState<AttendanceComplianceItem | null>(null);
  const [daily, setDaily] = useState<AttendanceReportDailyItem[]>([]);
  const [evidence, setEvidence] = useState<AttendanceReportEvidenceItem[]>([]);
  const [drawerLoading, setDrawerLoading] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filters, setFilters] = useState<Filters>(() => createDefaultFilters(i18n.language));
  const [appliedFilters, setAppliedFilters] = useState<Filters>(() => createDefaultFilters(i18n.language));

  useEffect(() => {
    setFilters((previous) => {
      if (previous.preset === "custom") return previous;
      const range = getLocalizedDatePresetRange(previous.preset, i18n.language);
      if (previous.from === range.from && previous.to === range.to) return previous;
      return { ...previous, from: range.from, to: range.to };
    });

    setAppliedFilters((previous) => {
      if (previous.preset === "custom") return previous;
      const range = getLocalizedDatePresetRange(previous.preset, i18n.language);
      if (previous.from === range.from && previous.to === range.to) return previous;
      return { ...previous, from: range.from, to: range.to };
    });
  }, [i18n.language]);

  useEffect(() => {
    let mounted = true;
    Promise.all([getShiftTemplates(), getStaffGroups(), listDevices(), loadMemberFilterOptions()])
      .then(([shiftRes, groupRes, deviceRes, memberOptions]) => {
        if (!mounted) return;
        setShifts(shiftRes.data ?? []);
        setGroups(groupRes.data ?? []);
        setDevices(deviceRes.data ?? []);
        setMembers(memberOptions);
      })
      .catch(() => {
        if (!mounted) return;
        setShifts([]);
        setGroups([]);
        setDevices([]);
        setMembers([]);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const query = useMemo<AttendanceComplianceQuery>(
    () => ({
      from: appliedFilters.from,
      to: appliedFilters.to,
      memberType: appliedFilters.memberType,
      shiftMode: appliedFilters.shiftMode,
      shiftId: appliedFilters.shiftId || undefined,
      staffGroupId: appliedFilters.staffGroupId || undefined,
      deviceId: appliedFilters.deviceId || undefined,
      eventType: appliedFilters.eventType,
      memberId: appliedFilters.memberId || undefined,
      onlyAnomalies: appliedFilters.onlyAnomalies,
      viewBy: appliedFilters.viewBy,
      sortBy: "score",
      sortDir: "asc",
      lateMinutesWeight: appliedFilters.lateMinutesWeight,
      lateCountWeight: appliedFilters.lateCountWeight,
      absentWeight: appliedFilters.absentWeight,
      noCheckoutWeight: appliedFilters.noCheckoutWeight,
      deniedWeight: appliedFilters.deniedWeight,
      page: appliedFilters.page,
      pageSize: PAGE_SIZE,
    }),
    [appliedFilters]
  );

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    getAttendanceComplianceReport(query)
      .then(({ data }) => {
        if (!mounted) return;
        setReport(data);
      })
      .catch((error) => {
        if (!mounted) return;
        setReport(EMPTY_REPORT);
        push({ kind: "error", title: error instanceof Error ? error.message : t("attendanceComplianceReport.toast.loadFailed") });
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [push, query, t]);

  useEffect(() => {
    if (!selected || selected.entityType !== "member") return;
    let mounted = true;
    setDrawerLoading(true);
    Promise.all([
      getAttendanceReportDaily(
        { from: appliedFilters.from, to: appliedFilters.to, memberId: selected.id, memberType: appliedFilters.memberType },
        1,
        80
      ),
      getAttendanceReportEvidence(
        { from: appliedFilters.from, to: appliedFilters.to, memberId: selected.id, memberType: appliedFilters.memberType },
        { page: 1, pageSize: 80 }
      ),
    ])
      .then(([dailyRes, evidenceRes]) => {
        if (!mounted) return;
        setDaily(dailyRes.data.items ?? []);
        setEvidence(evidenceRes.data.items ?? []);
      })
      .catch(() => {
        if (!mounted) return;
        setDaily([]);
        setEvidence([]);
      })
      .finally(() => {
        if (mounted) setDrawerLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [appliedFilters.from, appliedFilters.memberType, appliedFilters.to, selected]);

  const onExport = async (kind: "csv" | "xlsx") => {
    setExporting(kind);
    try {
      if (kind === "csv") {
        const { data } = await downloadAttendanceComplianceCsv(query);
        saveBlob(data, `attendance-compliance-${appliedFilters.from}-to-${appliedFilters.to}.csv`);
      } else {
        const { data } = await downloadAttendanceComplianceXlsx(query);
        saveBlob(data, `attendance-compliance-${appliedFilters.from}-to-${appliedFilters.to}.xlsx`);
      }
      push({ kind: "success", title: t("attendanceComplianceReport.toast.exportCompleted") });
    } catch (error) {
      push({ kind: "error", title: error instanceof Error ? error.message : t("attendanceComplianceReport.toast.exportFailed") });
    } finally {
      setExporting(null);
    }
  };

  const hasPendingFilterChanges = useMemo(() => !areFiltersEqual(filters, appliedFilters), [appliedFilters, filters]);
  const rangeStart = report.pageInfo.totalItems ? (report.pageInfo.page - 1) * report.pageInfo.pageSize + 1 : 0;
  const rangeEnd = report.pageInfo.totalItems ? Math.min(report.pageInfo.totalItems, report.pageInfo.page * report.pageInfo.pageSize) : 0;
  const toggleLabel = filtersOpen ? t("common.actions.hideFilters") : t("common.actions.showFilters");
  const applyFilters = () => {
    setSelected(null);
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
    subtitle: t("attendanceComplianceReport.table.loading"),
  });

  return (
    <>
      <div className="reports-page space-y-4">
      <section className={CARD}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{t("attendanceComplianceReport.header.title")}</h2>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">{t("attendanceComplianceReport.header.subtitle")}</p>
          </div>
          <button
            type="button"
            className="report-back-btn rounded-lg px-2.5 py-1 text-[11px] font-semibold transition"
            onClick={() => navigate("/reports")}
          >
            {t("attendanceComplianceReport.header.backToReports")}
          </button>
        </div>
      </section>

      <ReportFiltersPanel
        open={filtersOpen}
        onToggle={() => setFiltersOpen((value) => !value)}
        toggleLabel={toggleLabel}
        className={FILTER_CARD}
        gridClassName="attendance-report-filters__grid grid gap-2.5 rounded-xl p-3 md:grid-cols-2 xl:grid-cols-6"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <button className={`${REPORT_FILTER_ACTION_CLASS} financial-export-action h-8 min-w-24 px-2.5 text-[11px]`} disabled={Boolean(exporting)} onClick={() => onExport("csv")}>
              <span className="inline-flex items-center gap-1.5">
                <IconFileExport className="h-3.5 w-3.5" stroke={1.8} />
                {exporting === "csv" ? t("attendanceComplianceReport.filters.exporting") : t("attendanceComplianceReport.filters.exportCsv")}
              </span>
            </button>
            <button className="attendance-export-btn inline-flex h-8 min-w-24 items-center justify-center gap-1.5 rounded-lg border border-brand-500 bg-brand-500 px-2.5 text-[11px] font-semibold text-white transition hover:bg-brand-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/30 disabled:opacity-45" disabled={Boolean(exporting)} onClick={() => onExport("xlsx")}>
              <IconFileSpreadsheet className="h-3.5 w-3.5" stroke={1.8} />
              {exporting === "xlsx" ? t("attendanceComplianceReport.filters.exporting") : t("attendanceComplianceReport.filters.exportXlsx")}
            </button>
          </div>
        }
      >
          <label className="flex flex-col gap-1">
            <span className={LABEL}>{t("attendanceComplianceReport.filters.period")}</span>
            <DropdownSelect
              buttonClassName={INPUT}
              value={filters.preset}
              onChange={(value) => {
                const preset = value as Preset;
                const range = getLocalizedDatePresetRange(preset, i18n.language);
                setFilters((prev) => ({ ...prev, preset, from: range.from, to: range.to, page: 1 }));
              }}
              options={[
                { value: "today", label: t("attendanceComplianceReport.filters.periodToday") },
                { value: "thisWeek", label: t("attendanceComplianceReport.filters.periodThisWeek") },
                { value: "thisMonth", label: t("attendanceComplianceReport.filters.periodThisMonth") },
                { value: "custom", label: t("attendanceComplianceReport.filters.periodCustom") },
              ]}
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className={LABEL}>{t("attendanceComplianceReport.filters.from")}</span>
            <ShamsiDateInput
              value={filters.from}
              onChange={(value) => setFilters((prev) => ({ ...prev, preset: "custom", from: value, page: 1 }))}
              locale={i18n.language}
              inputClassName={INPUT}
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className={LABEL}>{t("attendanceComplianceReport.filters.to")}</span>
            <ShamsiDateInput
              value={filters.to}
              onChange={(value) => setFilters((prev) => ({ ...prev, preset: "custom", to: value, page: 1 }))}
              locale={i18n.language}
              inputClassName={INPUT}
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className={LABEL}>{t("attendanceComplianceReport.filters.memberType")}</span>
            <DropdownSelect
              buttonClassName={INPUT}
              value={filters.memberType}
              onChange={(value) => setFilters((prev) => ({ ...prev, memberType: value as Filters["memberType"], page: 1 }))}
              options={[
                { value: "both", label: t("attendanceComplianceReport.filters.memberTypeBoth") },
                { value: "staff", label: t("attendanceComplianceReport.filters.memberTypeStaff") },
                { value: "customer", label: t("attendanceComplianceReport.filters.memberTypeCustomer") },
              ]}
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className={LABEL}>{t("attendanceComplianceReport.filters.viewBy")}</span>
            <DropdownSelect
              buttonClassName={INPUT}
              value={filters.viewBy}
              onChange={(value) => setFilters((prev) => ({ ...prev, viewBy: value as Filters["viewBy"], page: 1 }))}
              options={[
                { value: "member", label: t("attendanceComplianceReport.filters.viewByMember") },
                { value: "group", label: t("attendanceComplianceReport.filters.viewByGroup") },
              ]}
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className={LABEL}>{t("attendanceComplianceReport.filters.shiftMode")}</span>
            <DropdownSelect
              buttonClassName={INPUT}
              value={filters.shiftMode}
              onChange={(value) => setFilters((prev) => ({ ...prev, shiftMode: value as Filters["shiftMode"], page: 1 }))}
              options={[
                { value: "primary", label: t("attendanceComplianceReport.filters.shiftPrimary") },
                { value: "all", label: t("attendanceComplianceReport.filters.shiftAll") },
                { value: "ignoreShifts", label: t("attendanceComplianceReport.filters.shiftIgnore") },
              ]}
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className={LABEL}>{t("attendanceComplianceReport.filters.shift")}</span>
            <DropdownSelect
              buttonClassName={INPUT}
              value={filters.shiftId}
              onChange={(value) => setFilters((prev) => ({ ...prev, shiftId: value, page: 1 }))}
              options={[
                { value: "", label: t("attendanceComplianceReport.filters.allShifts") },
                ...shifts.map((shift) => ({ value: shift.id, label: shift.shiftName })),
              ]}
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className={LABEL}>{t("attendanceComplianceReport.filters.group")}</span>
            <DropdownSelect
              buttonClassName={INPUT}
              value={filters.staffGroupId}
              onChange={(value) => setFilters((prev) => ({ ...prev, staffGroupId: value, page: 1 }))}
              options={[
                { value: "", label: t("attendanceComplianceReport.filters.allGroups") },
                ...groups.map((group) => ({ value: group.id, label: group.name })),
              ]}
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className={LABEL}>{t("attendanceComplianceReport.filters.device")}</span>
            <DropdownSelect
              buttonClassName={INPUT}
              value={filters.deviceId}
              onChange={(value) => setFilters((prev) => ({ ...prev, deviceId: value, page: 1 }))}
              options={[
                { value: "", label: t("attendanceComplianceReport.filters.allDevices") },
                ...devices.map((device) => ({ value: device.id, label: device.name })),
              ]}
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className={LABEL}>{t("attendanceComplianceReport.filters.search")}</span>
            <DropdownSelect
              buttonClassName={INPUT}
              value={filters.memberId}
              onChange={(value) => setFilters((prev) => ({ ...prev, memberId: value, page: 1 }))}
              options={[
                { value: "", label: t("attendanceComplianceReport.filters.searchPlaceholder") },
                ...members.map((member) => ({
                  value: member.id,
                  label: member.label,
                })),
              ]}
            />
          </label>

          <label className="flex flex-col gap-1 xl:col-start-1">
            <span className={LABEL}>{t("attendanceComplianceReport.filters.lateMinutesWeight")}</span>
            <input className={INPUT} type="number" step="0.01" min={0} value={filters.lateMinutesWeight} onChange={(event) => setFilters((prev) => ({ ...prev, lateMinutesWeight: Number(event.target.value), page: 1 }))} />
          </label>

          <label className="flex flex-col gap-1">
            <span className={LABEL}>{t("attendanceComplianceReport.filters.lateCountWeight")}</span>
            <input className={INPUT} type="number" step="0.1" min={0} value={filters.lateCountWeight} onChange={(event) => setFilters((prev) => ({ ...prev, lateCountWeight: Number(event.target.value), page: 1 }))} />
          </label>

          <label className="flex flex-col gap-1">
            <span className={LABEL}>{t("attendanceComplianceReport.filters.absentWeight")}</span>
            <input className={INPUT} type="number" step="0.5" min={0} value={filters.absentWeight} onChange={(event) => setFilters((prev) => ({ ...prev, absentWeight: Number(event.target.value), page: 1 }))} />
          </label>

          <label className="flex flex-col gap-1">
            <span className={LABEL}>{t("attendanceComplianceReport.filters.noCheckoutWeight")}</span>
            <input className={INPUT} type="number" step="0.5" min={0} value={filters.noCheckoutWeight} onChange={(event) => setFilters((prev) => ({ ...prev, noCheckoutWeight: Number(event.target.value), page: 1 }))} />
          </label>

          <label className="flex flex-col gap-1">
            <span className={LABEL}>{t("attendanceComplianceReport.filters.deniedWeight")}</span>
            <input className={INPUT} type="number" step="0.5" min={0} value={filters.deniedWeight} onChange={(event) => setFilters((prev) => ({ ...prev, deniedWeight: Number(event.target.value), page: 1 }))} />
          </label>

          <div className="flex h-full items-end xl:col-start-5 xl:row-start-2">
            <label className="report-inline-toggle">
              <input
                type="checkbox"
                checked={filters.onlyAnomalies}
                onChange={(event) => setFilters((prev) => ({ ...prev, onlyAnomalies: event.target.checked, page: 1 }))}
                className="report-inline-toggle__input"
              />
              <span className="report-inline-toggle__text">{t("attendanceComplianceReport.filters.onlyAnomalies")}</span>
            </label>
          </div>

          <div className="flex h-full items-end justify-end md:col-span-2 xl:col-span-1 xl:col-start-6 xl:row-start-3">
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

      <section className={CARD}>
        <div className="report-kpi-grid grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          <Stat label={t("attendanceComplianceReport.kpis.averageScore")} value={formatDecimal(report.kpis.averageScore, numberLocale)} tone="sky" />
          <Stat label={t("attendanceComplianceReport.kpis.bestScore")} value={formatDecimal(report.kpis.bestScore, numberLocale)} tone="emerald" />
          <Stat label={t("attendanceComplianceReport.kpis.worstScore")} value={formatDecimal(report.kpis.worstScore, numberLocale)} tone="rose" />
          <Stat label={t("attendanceComplianceReport.kpis.evaluated")} value={formatInteger(report.kpis.evaluatedCount, numberLocale)} tone="slate" />
        </div>
      </section>

      <section className={CARD}>
        <DataTableShell>
          <DataTable variant="report" minWidth="900px">
            <DataTableHead>
              <DataTableRow>
                <DataTableHeaderCell>{t("attendanceComplianceReport.table.entity")}</DataTableHeaderCell>
                <DataTableHeaderCell align="end">{t("attendanceComplianceReport.table.score")}</DataTableHeaderCell>
                <DataTableHeaderCell align="end">{t("attendanceComplianceReport.table.lateCount")}</DataTableHeaderCell>
                <DataTableHeaderCell align="end">{t("attendanceComplianceReport.table.lateMinutes")}</DataTableHeaderCell>
                <DataTableHeaderCell align="end">{t("attendanceComplianceReport.table.absentDays")}</DataTableHeaderCell>
                <DataTableHeaderCell align="end">{t("attendanceComplianceReport.table.earlyLeave")}</DataTableHeaderCell>
                <DataTableHeaderCell align="end">{t("attendanceComplianceReport.table.overtime")}</DataTableHeaderCell>
                <DataTableHeaderCell align="end">{t("attendanceComplianceReport.table.denied")}</DataTableHeaderCell>
                <DataTableHeaderCell align="end">{t("attendanceComplianceReport.table.noCheckout")}</DataTableHeaderCell>
              </DataTableRow>
            </DataTableHead>
            <DataTableBody>
              {report.items.length === 0 ? (
                <DataTableEmptyRow colSpan={9}>{t("attendanceComplianceReport.table.empty")}</DataTableEmptyRow>
              ) : (
                report.items.map((item) => (
                  <DataTableRow
                    key={item.id}
                    clickable={item.entityType === "member"}
                    onClick={() => (item.entityType === "member" ? setSelected(item) : undefined)}
                  >
                    <DataTableCell>
                      <div className="font-semibold text-slate-900 dark:text-slate-100">{item.name}</div>
                      <div className="text-[10px] text-slate-500">
                        {item.entityType === "member"
                          ? t("attendanceComplianceReport.table.memberHint")
                          : t("attendanceComplianceReport.table.groupMembers", { count: item.memberCount })}
                      </div>
                    </DataTableCell>
                    <DataTableCell align="end">{formatDecimal(item.score, numberLocale)}</DataTableCell>
                    <DataTableCell align="end">{formatInteger(item.lateCount, numberLocale)}</DataTableCell>
                    <DataTableCell align="end">{formatInteger(item.lateMinutes, numberLocale)}</DataTableCell>
                    <DataTableCell align="end">{formatInteger(item.absentDays, numberLocale)}</DataTableCell>
                    <DataTableCell align="end">{formatInteger(item.earlyLeaveCount, numberLocale)}</DataTableCell>
                    <DataTableCell align="end">{formatInteger(item.overtimeMinutes, numberLocale)}</DataTableCell>
                    <DataTableCell align="end">{formatInteger(item.deniedCount, numberLocale)}</DataTableCell>
                    <DataTableCell align="end">{formatInteger(item.noCheckoutCount, numberLocale)}</DataTableCell>
                  </DataTableRow>
                ))
              )}
            </DataTableBody>
          </DataTable>
        </DataTableShell>
        <ReportPager
          rangeLabel={t("attendanceComplianceReport.table.rangeOfTotal", {
            start: formatInteger(rangeStart, numberLocale),
            end: formatInteger(rangeEnd, numberLocale),
            total: formatInteger(report.pageInfo.totalItems, numberLocale),
          })}
          pageLabel={`${formatInteger(report.pageInfo.page, numberLocale)} / ${formatInteger(report.pageInfo.totalPages, numberLocale)}`}
          previousLabel={t("attendanceComplianceReport.table.prev")}
          nextLabel={t("attendanceComplianceReport.table.next")}
          canPrevious={report.pageInfo.page > 1}
          canNext={report.pageInfo.page < report.pageInfo.totalPages}
          onPrevious={() => goToPage(Math.max(1, report.pageInfo.page - 1))}
          onNext={() => goToPage(Math.min(report.pageInfo.totalPages, report.pageInfo.page + 1))}
        />
      </section>

      {selected ? (
        <div className="fixed inset-0 z-50 bg-black/45 p-4" onClick={() => setSelected(null)}>
          <div className="ml-auto h-full w-full max-w-3xl overflow-auto rounded-2xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-950" onClick={(event) => event.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{t("attendanceComplianceReport.drawer.title", { name: selected.name })}</h3>
              <CloseIconButton label={t("attendanceComplianceReport.drawer.close")} onClick={() => setSelected(null)} />
            </div>

            {drawerLoading ? (
              <p className="text-[11px] text-slate-500">{t("attendanceComplianceReport.drawer.loading")}</p>
            ) : (
              <div className="space-y-3">
                <div className={CARD}>
                  <h4 className="text-[11px] font-semibold text-slate-900 dark:text-slate-100">{t("attendanceComplianceReport.drawer.dailyTitle")}</h4>
                  {daily.length ? (
                    <DataTableShell className="mt-2">
                      <DataTable variant="report" minWidth="520px">
                        <DataTableHead>
                          <DataTableRow>
                            <DataTableHeaderCell>{t("attendanceComplianceReport.drawer.date")}</DataTableHeaderCell>
                            <DataTableHeaderCell align="end">{t("attendanceComplianceReport.drawer.present")}</DataTableHeaderCell>
                            <DataTableHeaderCell align="end">{t("attendanceComplianceReport.drawer.absent")}</DataTableHeaderCell>
                            <DataTableHeaderCell align="end">{t("attendanceComplianceReport.drawer.late")}</DataTableHeaderCell>
                            <DataTableHeaderCell align="end">{t("attendanceComplianceReport.drawer.denied")}</DataTableHeaderCell>
                          </DataTableRow>
                        </DataTableHead>
                        <DataTableBody>
                          {daily.map((day) => (
                            <DataTableRow key={day.date}>
                              <DataTableCell>{day.date}</DataTableCell>
                              <DataTableCell align="end">{formatInteger(day.presentCount, numberLocale)}</DataTableCell>
                              <DataTableCell align="end">{formatInteger(day.absentCount, numberLocale)}</DataTableCell>
                              <DataTableCell align="end">{formatInteger(day.lateCount, numberLocale)}</DataTableCell>
                              <DataTableCell align="end">{formatInteger(day.deniedCount, numberLocale)}</DataTableCell>
                            </DataTableRow>
                          ))}
                        </DataTableBody>
                      </DataTable>
                    </DataTableShell>
                  ) : (
                    <p className="mt-2 text-[11px] text-slate-500">{t("attendanceComplianceReport.drawer.dailyEmpty")}</p>
                  )}
                </div>

                <div className={CARD}>
                  <h4 className="text-[11px] font-semibold text-slate-900 dark:text-slate-100">{t("attendanceComplianceReport.drawer.evidenceTitle")}</h4>
                  {evidence.length ? (
                    <div className="mt-2 space-y-2">
                      {evidence.map((row) => (
                        <div key={row.id} className="rounded-lg border border-slate-200/70 p-2 text-[11px] dark:border-slate-800/70">
                          <div className="flex items-center justify-between gap-2 text-slate-600 dark:text-slate-300">
                            <span>{new Date(row.timestamp).toLocaleString(resolveDateLocale(numberLocale))}</span>
                            <span>{formatEventType(row.eventType, t)}</span>
                          </div>
                          <div className="mt-1 text-slate-500 dark:text-slate-400">
                            {formatResult(row.result, t)}
                            {row.denyReason ? ` | ${row.denyReason}` : ""}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-2 text-[11px] text-slate-500">{t("attendanceComplianceReport.drawer.evidenceEmpty")}</p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      ) : null}
      </div>
    </>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone: "slate" | "rose" | "emerald" | "sky" }) {
  const toneClass =
    tone === "rose"
      ? "report-kpi-card--rose"
      : tone === "emerald"
        ? "report-kpi-card--emerald"
        : tone === "sky"
          ? "report-kpi-card--sky"
          : "report-kpi-card--slate";
  return (
    <div className={`report-kpi-card ${toneClass}`}>
      <p className="report-kpi-card__label">{label}</p>
      <p className="report-kpi-card__value">{value}</p>
      <span className="report-kpi-card__glow" aria-hidden="true" />
    </div>
  );
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

function resolveNumberLocale(language: string) {
  const base = language.split("-")[0];
  if (base === "fa") return "fa-AF";
  if (base === "ps") return "ps-AF";
  return "en-US";
}

function formatInteger(value: number, locale: string) {
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(value);
}

function formatDecimal(value: number, locale: string) {
  return new Intl.NumberFormat(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
}

function formatEventType(eventType: AttendanceReportEvidenceItem["eventType"], t: (key: string) => string) {
  if (eventType === "IN") return t("attendance.badges.in");
  if (eventType === "OUT") return t("attendance.badges.out");
  return t("attendance.badges.denied");
}

function formatResult(result: AttendanceReportEvidenceItem["result"], t: (key: string) => string) {
  return result === "denied" ? t("attendance.badges.denied") : t("attendance.badges.authorized");
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


