
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { listDevices, type Device } from "../../api/devices";
import { getMembers, type Member } from "../../api/members";
import {
  downloadAttendanceReportCsv,
  downloadAttendanceReportPdf,
  downloadAttendanceReportXlsx,
  getAttendanceReportDaily,
  getAttendanceReportEvidence,
  getAttendanceReportMembers,
  getAttendanceReportSummary,
  type AttendanceReportFilterParams,
  type AttendanceReportMembersSortBy,
} from "../../api/reportsAttendance";
import { getShiftTemplates, type ShiftTemplate } from "../../api/shifts";
import { getStaffGroups, type StaffGroup } from "../../api/staffGroups";
import { useToast } from "../../components/ToastContext";
import { useGlobalLoading } from "../../components/GlobalLoadingContext";
import { DailySummaryTable } from "./attendance-report/DailySummaryTable";
import { EvidenceTable } from "./attendance-report/EvidenceTable";
import { FiltersPanel, type MemberFilterOption } from "./attendance-report/FiltersPanel";
import { KpiGrid } from "./attendance-report/KpiGrid";
import { MembersTable } from "./attendance-report/MembersTable";
import { TrendPanel } from "./attendance-report/TrendPanel";
import { CloseIconButton } from "../../components/CloseIconButton";
import {
  DataTable,
  DataTableBody,
  DataTableCell,
  DataTableHead,
  DataTableHeaderCell,
  DataTableRow,
  DataTableShell,
} from "../../components/ui/DataTable";
import { resolveDateLocale } from "../../shared/dateLocale";
import { getLocalizedDatePresetRange } from "../../shared/datePresets";
import { rtlLanguages } from "../../i18n/config";
import {
  DRAWER_PAGE_SIZE,
  EMPTY_KPIS,
  EMPTY_PAGE,
  type AttendanceReportFilters,
  type DatePreset,
  type DailyItem,
  type EvidenceItem,
  type ExportKind,
  type MemberItem,
  type ReportTab,
} from "./attendance-report/types";

const SURFACE_CARD =
  "rounded-2xl border border-slate-200/90 bg-white/90 p-3 shadow-sm dark:border-slate-800/90 dark:bg-slate-950/70";

export function AttendanceReportPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { push } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  const [filters, setFilters] = useState<AttendanceReportFilters>(() => readFilters(searchParams, i18n.language));
  const [appliedFilters, setAppliedFilters] = useState<AttendanceReportFilters>(() => readFilters(searchParams, i18n.language));
  const [tab, setTab] = useState<ReportTab>(() => readTab(searchParams));

  const [dailyPage, setDailyPage] = useState(1);
  const [membersPage, setMembersPage] = useState(1);
  const [evidencePage, setEvidencePage] = useState(1);
  const [membersSortBy, setMembersSortBy] = useState<AttendanceReportMembersSortBy>("memberName");
  const [membersSortDir, setMembersSortDir] = useState<"asc" | "desc">("asc");

  const [filtersOpen, setFiltersOpen] = useState(false);
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const [busyExport, setBusyExport] = useState<ExportKind | null>(null);

  const [kpis, setKpis] = useState(EMPTY_KPIS);
  const [trendItems, setTrendItems] = useState<DailyItem[]>([]);

  const [dailyItems, setDailyItems] = useState<DailyItem[]>([]);
  const [dailyInfo, setDailyInfo] = useState(EMPTY_PAGE);
  const [memberItems, setMemberItems] = useState<MemberItem[]>([]);
  const [memberInfo, setMemberInfo] = useState(EMPTY_PAGE);
  const [evidenceItems, setEvidenceItems] = useState<EvidenceItem[]>([]);
  const [evidenceInfo, setEvidenceInfo] = useState(EMPTY_PAGE);

  const [loadingSummary, setLoadingSummary] = useState(false);
  const [loadingTrend, setLoadingTrend] = useState(false);
  const [loadingTab, setLoadingTab] = useState(false);
  const [reportLoading, setReportLoading] = useState(true);
  const loadCycleStartedRef = useRef(false);

  const [selectedDay, setSelectedDay] = useState<DailyItem | null>(null);
  const [selectedMember, setSelectedMember] = useState<MemberItem | null>(null);
  const [drawerEvidence, setDrawerEvidence] = useState<EvidenceItem[]>([]);
  const [drawerLoading, setDrawerLoading] = useState(false);
  const [memberDailyItems, setMemberDailyItems] = useState<DailyItem[]>([]);

  const [shifts, setShifts] = useState<ShiftTemplate[]>([]);
  const [groups, setGroups] = useState<StaffGroup[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [members, setMembers] = useState<MemberFilterOption[]>([]);
  const isRtl = rtlLanguages.includes(i18n.language.split("-")[0]);
  const isDateRangeInvalid = Boolean(filters.from) && Boolean(filters.to) && filters.from > filters.to;

  const apiFilters = useMemo<AttendanceReportFilterParams>(
    () => ({
      from: appliedFilters.from,
      to: appliedFilters.to,
      memberId: appliedFilters.memberId || undefined,
      memberType: appliedFilters.memberType,
      eventType: appliedFilters.eventType,
      shiftMode: appliedFilters.shiftMode,
      shiftId: appliedFilters.shiftId || undefined,
      staffGroupId: appliedFilters.staffGroupId || undefined,
      deviceId: appliedFilters.deviceId || undefined,
      onlyAnomalies: appliedFilters.onlyAnomalies,
    }),
    [appliedFilters]
  );

  const filterKey = useMemo(() => JSON.stringify(apiFilters), [apiFilters]);

  const patchFilters = useCallback((patch: Partial<AttendanceReportFilters>) => {
    setFilters((previous) => ({ ...previous, ...patch }));
  }, []);

  const applyPreset = useCallback((preset: DatePreset) => {
    const range = getLocalizedDatePresetRange(preset, i18n.language);
    setFilters((previous) => ({ ...previous, preset, from: range.from, to: range.to }));
  }, [i18n.language]);

  const toggleOnlyAnomalies = useCallback(() => {
    setFilters((previous) => ({ ...previous, onlyAnomalies: !previous.onlyAnomalies }));
    setAppliedFilters((previous) => ({ ...previous, onlyAnomalies: !previous.onlyAnomalies }));
  }, []);

  const applyFilters = useCallback(() => {
    if (isDateRangeInvalid) return;
    setAppliedFilters(filters);
  }, [filters, isDateRangeInvalid]);

  const hasPendingFilterChanges = useMemo(() => !areFiltersEqual(filters, appliedFilters), [appliedFilters, filters]);
  const pageLoading = reportLoading;

  useGlobalLoading(pageLoading, {
    delayMs: 0,
    message: t("common.messages.loading"),
    subtitle: t("attendanceReport.header.title"),
  });

  useEffect(() => {
    const query = new URLSearchParams();
    query.set("tab", tab);
    query.set("preset", appliedFilters.preset);
    query.set("from", appliedFilters.from);
    query.set("to", appliedFilters.to);
    if (appliedFilters.memberId) query.set("memberId", appliedFilters.memberId);
    query.set("memberType", appliedFilters.memberType);
    query.set("eventType", appliedFilters.eventType);
    query.set("shiftMode", appliedFilters.shiftMode);
    if (appliedFilters.shiftId) query.set("shiftId", appliedFilters.shiftId);
    if (appliedFilters.staffGroupId) query.set("staffGroupId", appliedFilters.staffGroupId);
    if (appliedFilters.deviceId) query.set("deviceId", appliedFilters.deviceId);
    if (appliedFilters.onlyAnomalies) query.set("onlyAnomalies", "true");
    setSearchParams(query, { replace: true });
  }, [appliedFilters, setSearchParams, tab]);

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
    setDailyPage(1);
    setMembersPage(1);
    setEvidencePage(1);
    setSelectedDay(null);
    setSelectedMember(null);
    setTrendItems([]);
    setReportLoading(true);
    loadCycleStartedRef.current = false;
  }, [filterKey]);

  useEffect(() => {
    if (!reportLoading) return;
    if (loadingSummary || loadingTab) {
      loadCycleStartedRef.current = true;
      return;
    }
    if (!loadCycleStartedRef.current) return;
    if (!loadingSummary && !loadingTab) {
      setReportLoading(false);
    }
  }, [loadingSummary, loadingTab, reportLoading]);

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

  useEffect(() => {
    let mounted = true;
    setLoadingSummary(true);
    getAttendanceReportSummary(apiFilters)
      .then(({ data }) => {
        if (!mounted) return;
        setKpis(data.kpis ?? EMPTY_KPIS);
      })
      .catch((error) => {
        if (!mounted) return;
        setKpis(EMPTY_KPIS);
        push({ kind: "error", title: error instanceof Error ? error.message : t("attendanceReport.toast.summaryLoadFailed") });
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
    setLoadingTrend(true);
    const timer = window.setTimeout(() => {
      loadAllDailyForTrend(apiFilters)
        .then((items) => {
          if (!mounted) return;
          setTrendItems(items);
        })
        .catch(() => {
          if (!mounted) return;
          setTrendItems([]);
        })
        .finally(() => {
          if (mounted) setLoadingTrend(false);
        });
    }, 60);

    return () => {
      mounted = false;
      window.clearTimeout(timer);
    };
  }, [apiFilters]);
  useEffect(() => {
    let mounted = true;
    setLoadingTab(true);

    const request =
      tab === "daily"
        ? getAttendanceReportDaily(apiFilters, dailyPage, 20).then(({ data }) => {
            if (!mounted) return;
            setDailyItems(data.items ?? []);
            setDailyInfo(data.pageInfo ?? EMPTY_PAGE);
          })
        : tab === "members"
          ? getAttendanceReportMembers(apiFilters, {
              page: membersPage,
              pageSize: 20,
              sortBy: membersSortBy,
              sortDir: membersSortDir,
            }).then(({ data }) => {
              if (!mounted) return;
              setMemberItems(data.items ?? []);
              setMemberInfo(data.pageInfo ?? EMPTY_PAGE);
            })
          : getAttendanceReportEvidence(apiFilters, {
              page: evidencePage,
              pageSize: 20,
              sortDir: "desc",
            }).then(({ data }) => {
              if (!mounted) return;
              setEvidenceItems(data.items ?? []);
              setEvidenceInfo(data.pageInfo ?? EMPTY_PAGE);
            });

    request
      .catch((error) => {
        if (!mounted) return;
        push({ kind: "error", title: error instanceof Error ? error.message : t("attendanceReport.toast.tableLoadFailed") });
        if (tab === "daily") {
          setDailyItems([]);
          setDailyInfo(EMPTY_PAGE);
        } else if (tab === "members") {
          setMemberItems([]);
          setMemberInfo(EMPTY_PAGE);
        } else {
          setEvidenceItems([]);
          setEvidenceInfo(EMPTY_PAGE);
        }
      })
      .finally(() => {
        if (mounted) setLoadingTab(false);
      });

    return () => {
      mounted = false;
    };
  }, [apiFilters, dailyPage, evidencePage, membersPage, membersSortBy, membersSortDir, push, t, tab]);

  useEffect(() => {
    if (!selectedDay && !selectedMember) {
      setDrawerEvidence([]);
      return;
    }

    let mounted = true;
    setDrawerLoading(true);

    getAttendanceReportEvidence(
      {
        ...apiFilters,
        from: selectedDay?.date ?? apiFilters.from,
        to: selectedDay?.date ?? apiFilters.to,
        memberId: selectedMember?.memberId,
      },
      { page: 1, pageSize: DRAWER_PAGE_SIZE, sortDir: "desc" }
    )
      .then(({ data }) => {
        if (!mounted) return;
        setDrawerEvidence(data.items ?? []);
      })
      .catch(() => {
        if (!mounted) return;
        setDrawerEvidence([]);
      })
      .finally(() => {
        if (mounted) setDrawerLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [apiFilters, selectedDay, selectedMember]);

  useEffect(() => {
    if (!selectedMember) {
      setMemberDailyItems([]);
      return;
    }

    let mounted = true;
    getAttendanceReportDaily({ ...apiFilters, memberId: selectedMember.memberId }, 1, 100)
      .then(({ data }) => {
        if (!mounted) return;
        setMemberDailyItems(data.items ?? []);
      })
      .catch(() => {
        if (!mounted) return;
        setMemberDailyItems([]);
      });

    return () => {
      mounted = false;
    };
  }, [apiFilters, selectedMember]);

  const handleExport = useCallback(
    async (kind: ExportKind) => {
      setExportMenuOpen(false);
      setBusyExport(kind);
      try {
        if (kind === "xlsx") {
          const { data } = await downloadAttendanceReportXlsx({ ...apiFilters, lang: resolveExportLanguage(i18n.language) });
          saveBlob(data, `attendance-${appliedFilters.from}-to-${appliedFilters.to}.xlsx`);
        } else if (kind === "pdf") {
          const { data } = await downloadAttendanceReportPdf({ ...apiFilters, lang: resolveExportLanguage(i18n.language) });
          saveBlob(data, `attendance-${appliedFilters.from}-to-${appliedFilters.to}.pdf`);
        } else if (kind === "csvDaily") {
          const { data } = await downloadAttendanceReportCsv(apiFilters, "daily", resolveExportLanguage(i18n.language));
          saveBlob(data, `attendance-daily-${appliedFilters.from}-to-${appliedFilters.to}.csv`);
        } else if (kind === "csvMembers") {
          const { data } = await downloadAttendanceReportCsv(
            apiFilters, "members", resolveExportLanguage(i18n.language), membersSortBy, membersSortDir
          );
          saveBlob(data, `attendance-members-${appliedFilters.from}-to-${appliedFilters.to}.csv`);
        } else {
          const { data } = await downloadAttendanceReportCsv(apiFilters, "evidence", resolveExportLanguage(i18n.language));
          saveBlob(data, `attendance-evidence-${appliedFilters.from}-to-${appliedFilters.to}.csv`);
        }
        push({ kind: "success", title: t("attendanceReport.toast.exportCompleted") });
      } catch (error) {
        push({ kind: "error", title: error instanceof Error ? error.message : t("attendanceReport.toast.exportFailed") });
      } finally {
        setBusyExport(null);
      }
    },
    [apiFilters, appliedFilters.from, appliedFilters.to, i18n.language, membersSortBy, membersSortDir, push, t]
  );

  const tabStyle = (target: ReportTab) =>
    `attendance-tab-btn rounded-full px-2.5 py-1 text-[11px] font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/30 ${
      tab === target
        ? "is-active bg-brand-500 text-white shadow"
        : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
    }`;

  return (
    <>
      <div
        className="reports-page space-y-4"
        dir={isRtl ? "rtl" : "ltr"}
        data-testid="attendance-report-page"
      >
      <section className={SURFACE_CARD}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{t("attendanceReport.header.title")}</h2>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">{t("attendanceReport.header.subtitle")}</p>
          </div>
          <button
            type="button"
            onClick={() => navigate("/reports")}
            className="report-back-btn rounded-lg px-2.5 py-1 text-[11px] font-semibold transition"
          >
            {t("attendanceReport.header.backToReports")}
          </button>
        </div>
      </section>

      <FiltersPanel
        filters={filters}
        onChange={patchFilters}
        onApplyPreset={applyPreset}
        onApplyFilters={applyFilters}
        canApplyFilters={hasPendingFilterChanges && !isDateRangeInvalid}
        invalidDateRange={isDateRangeInvalid}
        loading={pageLoading}
        shifts={shifts}
        groups={groups}
        devices={devices}
        members={members}
        filtersOpen={filtersOpen}
        onToggleFilters={() => setFiltersOpen((value) => !value)}
        exportMenuOpen={exportMenuOpen}
        onToggleExportMenu={() => setExportMenuOpen((value) => !value)}
        onExport={handleExport}
        busyExport={busyExport}
      />

      <KpiGrid kpis={kpis} trendData={trendItems} loading={loadingSummary} />

      <TrendPanel dailySeries={trendItems} loading={loadingTrend} />

      <section className={`${SURFACE_CARD} space-y-2.5`}>
        <div className="flex flex-wrap gap-2">
          <button type="button" data-testid="attendance-report-tab-daily" className={tabStyle("daily")} onClick={() => setTab("daily")}>
            {t("attendanceReport.tabs.daily")}
          </button>
          <button type="button" data-testid="attendance-report-tab-members" className={tabStyle("members")} onClick={() => setTab("members")}>
            {t("attendanceReport.tabs.members")}
          </button>
          <button type="button" data-testid="attendance-report-tab-evidence" className={tabStyle("evidence")} onClick={() => setTab("evidence")}>
            {t("attendanceReport.tabs.evidence")}
          </button>
        </div>

        {tab === "daily" ? (
          <DailySummaryTable
            items={dailyItems}
            loading={loadingTab}
            page={dailyPage}
            pageInfo={dailyInfo}
            onPageChange={setDailyPage}
            onlyAnomalies={filters.onlyAnomalies}
            onToggleOnlyAnomalies={toggleOnlyAnomalies}
            onSelectDay={setSelectedDay}
          />
        ) : null}

        {tab === "members" ? (
          <MembersTable
            items={memberItems}
            loading={loadingTab}
            page={membersPage}
            pageInfo={memberInfo}
            onPageChange={setMembersPage}
            sortBy={membersSortBy}
            sortDir={membersSortDir}
            onSortByChange={setMembersSortBy}
            onSortDirToggle={() => setMembersSortDir((value) => (value === "asc" ? "desc" : "asc"))}
            onlyAnomalies={filters.onlyAnomalies}
            onToggleOnlyAnomalies={toggleOnlyAnomalies}
            onSelectMember={setSelectedMember}
          />
        ) : null}

        {tab === "evidence" ? (
          <EvidenceTable
            items={evidenceItems}
            loading={loadingTab}
            page={evidencePage}
            pageInfo={evidenceInfo}
            onPageChange={setEvidencePage}
            onlyAnomalies={filters.onlyAnomalies}
            onToggleOnlyAnomalies={toggleOnlyAnomalies}
          />
        ) : null}
      </section>
      <DetailDrawer open={Boolean(selectedDay)} title={selectedDay ? t("attendanceReport.drawer.dayDetails", { date: selectedDay.date }) : t("attendanceReport.drawer.dayDetailsTitle")} onClose={() => setSelectedDay(null)}>
        {selectedDay ? (
          <div className="space-y-4">
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
              <Metric label={t("attendanceReport.drawer.present")} value={selectedDay.presentCount} />
              <Metric label={t("attendanceReport.drawer.absent")} value={selectedDay.absentCount} />
              <Metric label={t("attendanceReport.drawer.late")} value={selectedDay.lateCount} />
              <Metric label={t("attendanceReport.drawer.lateMinutes")} value={selectedDay.lateMinutes} />
              <Metric label={t("attendanceReport.drawer.earlyLeave")} value={selectedDay.earlyLeaveCount} />
              <Metric label={t("attendanceReport.drawer.denied")} value={selectedDay.deniedCount} />
              <Metric label={t("attendanceReport.drawer.noCheckout")} value={selectedDay.noCheckoutCount} />
              <Metric label={t("attendanceReport.drawer.justified")} value={selectedDay.justifiedCount} />
              <Metric label={t("attendanceReport.drawer.unscheduled")} value={selectedDay.unscheduledPresentCount} />
            </div>
            <EvidenceList rows={drawerEvidence} loading={drawerLoading} />
          </div>
        ) : null}
      </DetailDrawer>

      <DetailDrawer open={Boolean(selectedMember)} title={selectedMember ? t("attendanceReport.drawer.memberDetails", { name: selectedMember.memberName }) : t("attendanceReport.drawer.memberDetailsTitle")} onClose={() => setSelectedMember(null)}>
        {selectedMember ? (
          <div className="space-y-4">
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
              <Metric label={t("attendanceReport.drawer.expectedShifts")} value={selectedMember.expectedShifts} />
              <Metric label={t("attendanceReport.drawer.present")} value={selectedMember.presentDays} />
              <Metric label={t("attendanceReport.drawer.absent")} value={selectedMember.absentDays} />
              <Metric label={t("attendanceReport.drawer.late")} value={selectedMember.lateCount} />
              <Metric label={t("attendanceReport.drawer.lateMinutes")} value={selectedMember.lateMinutes} />
              <Metric label={t("attendanceReport.drawer.denied")} value={selectedMember.deniedCount} />
              <Metric label={t("attendanceReport.drawer.noCheckout")} value={selectedMember.noCheckoutCount} />
            </div>

            <div className="rounded-2xl border border-slate-200/90 p-2.5 dark:border-slate-800/90">
              <h4 className="mb-2 text-[11px] font-semibold text-slate-700 dark:text-slate-200">{t("attendanceReport.drawer.perDaySnapshot")}</h4>
              {memberDailyItems.length ? (
                <DataTableShell className="max-h-64">
                  <DataTable variant="report" minWidth="540px">
                    <DataTableHead>
                      <DataTableRow>
                        <DataTableHeaderCell>{t("attendanceReport.drawer.date")}</DataTableHeaderCell>
                        <DataTableHeaderCell align="end">{t("attendanceReport.drawer.present")}</DataTableHeaderCell>
                        <DataTableHeaderCell align="end">{t("attendanceReport.drawer.absent")}</DataTableHeaderCell>
                        <DataTableHeaderCell align="end">{t("attendanceReport.drawer.late")}</DataTableHeaderCell>
                        <DataTableHeaderCell align="end">{t("attendanceReport.drawer.denied")}</DataTableHeaderCell>
                      </DataTableRow>
                    </DataTableHead>
                    <DataTableBody>
                      {memberDailyItems.map((row) => (
                        <DataTableRow key={row.date}>
                          <DataTableCell>{row.date}</DataTableCell>
                          <DataTableCell align="end">{formatNumber(row.presentCount, i18n.language)}</DataTableCell>
                          <DataTableCell align="end">{formatNumber(row.absentCount, i18n.language)}</DataTableCell>
                          <DataTableCell align="end">{formatNumber(row.lateCount, i18n.language)}</DataTableCell>
                          <DataTableCell align="end">{formatNumber(row.deniedCount, i18n.language)}</DataTableCell>
                        </DataTableRow>
                      ))}
                    </DataTableBody>
                  </DataTable>
                </DataTableShell>
              ) : (
                <p className="text-[11px] text-slate-500 dark:text-slate-400">{t("attendanceReport.drawer.noDailyData")}</p>
              )}
            </div>

            <EvidenceList rows={drawerEvidence} loading={drawerLoading} />
          </div>
        ) : null}
      </DetailDrawer>
      </div>
    </>
  );
}

function areFiltersEqual(left: AttendanceReportFilters, right: AttendanceReportFilters) {
  return (
    left.preset === right.preset &&
    left.from === right.from &&
    left.to === right.to &&
    left.memberId === right.memberId &&
    left.memberType === right.memberType &&
    left.eventType === right.eventType &&
    left.shiftMode === right.shiftMode &&
    left.shiftId === right.shiftId &&
    left.staffGroupId === right.staffGroupId &&
    left.deviceId === right.deviceId &&
    left.onlyAnomalies === right.onlyAnomalies
  );
}

function DetailDrawer({ open, title, onClose, children }: { open: boolean; title: string; onClose: () => void; children: ReactNode }) {
  const { t } = useTranslation();
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/45 p-4" onClick={onClose}>
      <div
        className="h-full w-full max-w-3xl overflow-auto rounded-2xl border border-slate-200 bg-white p-3 shadow-2xl dark:border-slate-700 dark:bg-slate-950"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{title}</h3>
          <CloseIconButton label={t("attendanceReport.drawer.close")} onClick={onClose} />
        </div>
        {children}
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  const { i18n } = useTranslation();
  return (
    <div className="rounded-xl border border-slate-200/90 bg-slate-50/80 p-2.5 dark:border-slate-800/90 dark:bg-slate-900/40">
      <p className="text-[10px] uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</p>
      <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{formatNumber(value, i18n.language)}</p>
    </div>
  );
}

function EvidenceList({ rows, loading }: { rows: EvidenceItem[]; loading: boolean }) {
  const { t, i18n } = useTranslation();
  if (loading) {
    return <div className="h-28 animate-pulse rounded-2xl bg-slate-200/70 dark:bg-slate-800/70" />;
  }
  if (!rows.length) {
    return <p className="text-[11px] text-slate-500 dark:text-slate-400">{t("attendanceReport.drawer.noEvidenceRecords")}</p>;
  }

  return (
    <div className="max-h-[44vh] space-y-2 overflow-auto">
      {rows.map((row) => (
        <div key={row.id} className="rounded-xl border border-slate-200/90 bg-white/80 p-2.5 text-[11px] dark:border-slate-800/90 dark:bg-slate-900/40">
          <div className="flex items-center justify-between gap-2 text-slate-600 dark:text-slate-300">
            <span>{new Date(row.timestamp).toLocaleString(resolveDateLocale(i18n.language))}</span>
            <span className="rounded-full border border-slate-300 px-2 py-0.5 text-[10px] dark:border-slate-700">{formatEventType(row.eventType, t)}</span>
          </div>
          <p className="mt-1 font-semibold text-slate-900 dark:text-slate-100">{row.memberName}</p>
          <p className="text-slate-500 dark:text-slate-400">{formatResult(row.result, t)}{row.denyReason ? ` | ${row.denyReason}` : ""}</p>
        </div>
      ))}
    </div>
  );
}

function readTab(searchParams: URLSearchParams): ReportTab {
  const value = searchParams.get("tab");
  if (value === "daily" || value === "members" || value === "evidence") return value;
  return "daily";
}

function readFilters(searchParams: URLSearchParams, locale: string): AttendanceReportFilters {
  const preset = parseEnum(searchParams.get("preset"), ["today", "thisWeek", "thisMonth", "custom"]) ?? "thisMonth";
  const base = getLocalizedDatePresetRange(preset, locale);
  return {
    preset,
    from: preset === "custom" ? searchParams.get("from") || base.from : base.from,
    to: preset === "custom" ? searchParams.get("to") || base.to : base.to,
    memberId: searchParams.get("memberId") || "",
    memberType: parseEnum(searchParams.get("memberType"), ["both", "staff", "customer"]) ?? "both",
    eventType: parseEnum(searchParams.get("eventType"), ["all", "in", "out", "denied"]) ?? "all",
    shiftMode: parseEnum(searchParams.get("shiftMode"), ["primary", "all", "ignoreShifts"]) ?? "primary",
    shiftId: searchParams.get("shiftId") || "",
    staffGroupId: searchParams.get("staffGroupId") || "",
    deviceId: searchParams.get("deviceId") || "",
    onlyAnomalies: searchParams.get("onlyAnomalies") === "true",
  };
}

function parseEnum<T extends string>(value: string | null, options: readonly T[]): T | null {
  if (!value) return null;
  return options.includes(value as T) ? (value as T) : null;
}

async function loadMemberFilterOptions() {
  const take = 100;
  let skip = 0;
  let total = 0;
  const options: MemberFilterOption[] = [];

  do {
    const { data } = await getMembers({ take, skip });
    const items = data.items ?? [];
    total = Number(data.total ?? 0);
    options.push(...items.map((member) => ({
      id: member.id,
      label: formatMemberFilterLabel(member),
    })));
    skip += items.length;
    if (!items.length) break;
  } while (skip < total && skip < 5000);

  const unique = new Map(options.map((option) => [option.id, option]));
  return [...unique.values()].sort((left, right) => left.label.localeCompare(right.label, undefined, { sensitivity: "base" }));
}

function formatMemberFilterLabel(member: Pick<Member, "code" | "firstName" | "lastName">) {
  const fullName = `${member.firstName ?? ""} ${member.lastName ?? ""}`.trim();
  if (fullName) return `${fullName} (#${member.code})`;
  return `#${member.code}`;
}

async function loadAllDailyForTrend(filters: AttendanceReportFilterParams) {
  const items: DailyItem[] = [];
  let page = 1;
  while (true) {
    const { data } = await getAttendanceReportDaily(filters, page, 200);
    items.push(...(data.items ?? []));
    if (page >= (data.pageInfo?.totalPages ?? 1)) break;
    page += 1;
  }
  return items;
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

function formatNumber(value: number, locale = "en") {
  return new Intl.NumberFormat(locale).format(value);
}

function formatEventType(eventType: EvidenceItem["eventType"], t: (key: string) => string) {
  if (eventType === "IN") return t("attendance.badges.in");
  if (eventType === "OUT") return t("attendance.badges.out");
  return t("attendance.badges.denied");
}

function formatResult(result: EvidenceItem["result"], t: (key: string) => string) {
  return result === "denied" ? t("attendance.badges.denied") : t("attendance.badges.authorized");
}
