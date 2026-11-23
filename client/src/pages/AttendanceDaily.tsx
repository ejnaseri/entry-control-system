import { type ComponentType, type ReactNode, useCallback, useEffect, useMemo, useRef, useState, type SVGProps } from "react";
import { IconUserCheck, IconUserPause, IconUserX } from "@tabler/icons-react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  createAttendanceJustification,
  deleteAttendanceJustification,
  listAttendance,
  listDailyAttendance,
  type AttendanceItem,
  type DailyAttendanceRow,
  type DailyAttendanceStatus,
} from "../api/attendance";
import { getShiftTemplates, type ShiftTemplate } from "../api/shifts";
import { rtlLanguages } from "../i18n/config";
import { useModalDismiss } from "../hooks/useModalDismiss";
import { useToast } from "../components/ToastContext";
import { useAuth } from "../auth/AuthContext";
import { CloseIconButton } from "../components/CloseIconButton";
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
import { ShamsiDateInput } from "../components/ui/ShamsiDateInput";
import { formatLocalizedLongDate, resolveDateLocale } from "../shared/dateLocale";
import { formatAccessReason } from "../utils/accessReasons";
import { downloadCsv } from "../utils/csvDownload";
import { recordAttendanceClientCsvExport } from "../api/reportsAttendance";

type DatePreset = "today" | "yesterday" | "custom";
type ViewMode = "rows" | "cards";
type ShiftMode = "primary" | "all";
type DailyMetricKey =
  | "onTime"
  | "lateClockIn"
  | "earlyClockIn"
  | "absent"
  | "noClockIn"
  | "noClockOut"
  | "invalid"
  | "dayOff"
  | "timeOff";
type SummaryCardId = "present" | "notPresent" | "away";
type SummaryFilter =
  | { type: "card"; cardId: SummaryCardId }
  | { type: "metric"; cardId: SummaryCardId; metricKey: DailyMetricKey };
const COMPACT_INPUT_CLASS = "attendance-input";
const REFRESH_INTERVAL_MS = 15000;
const SUMMARY_CARD_METRICS: Record<SummaryCardId, DailyMetricKey[]> = {
  present: ["onTime", "lateClockIn", "earlyClockIn"],
  notPresent: ["absent", "noClockIn", "noClockOut", "invalid"],
  away: ["dayOff", "timeOff"],
};

const STATUS_STYLES: Record<DailyAttendanceStatus, string> = {
  PRESENT: "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:border-emerald-500/50 dark:bg-emerald-500/10 dark:text-emerald-200",
  ABSENT: "border-rose-500/40 bg-rose-500/10 text-rose-700 dark:border-rose-500/50 dark:bg-rose-500/10 dark:text-rose-200",
  LATE: "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:border-amber-500/50 dark:bg-amber-500/10 dark:text-amber-200",
  INSIDE: "border-sky-500/40 bg-sky-500/10 text-sky-700 dark:border-sky-500/50 dark:bg-sky-500/10 dark:text-sky-200",
};


export function AttendanceDaily() {
  const { t, i18n } = useTranslation();
  const { push } = useToast();
  const isRtl = rtlLanguages.includes(i18n.language.split("-")[0]);
  const [rows, setRows] = useState<DailyAttendanceRow[]>([]);
  const [comparisonMetrics, setComparisonMetrics] = useState<DailyMetrics | null>(null);
  const [shifts, setShifts] = useState<ShiftTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [datePreset, setDatePreset] = useState<DatePreset>("today");
  const [customDate, setCustomDate] = useState(() => formatDateInput(new Date()));
  const [shiftMode, setShiftMode] = useState<ShiftMode>("primary");
  const [shiftId, setShiftId] = useState("");
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("rows");
  const [selectedRowKey, setSelectedRowKey] = useState<string | null>(null);
  const [summaryFilter, setSummaryFilter] = useState<SummaryFilter | null>(null);

  const resolvedDate = useMemo(() => resolveDate(datePreset, customDate), [datePreset, customDate]);
  const selectedRow = useMemo(
    () => (selectedRowKey ? rows.find((row) => getRowKey(row) === selectedRowKey) ?? null : null),
    [rows, selectedRowKey]
  );
  const displayDate = useMemo(
    () => formatLocalizedLongDate(resolvedDate, i18n.language),
    [resolvedDate, i18n.language]
  );
  const currentMetrics = useMemo(() => buildDailyMetrics(rows), [rows]);
  const metricDeltas = useMemo(
    () => buildMetricDeltas(currentMetrics, comparisonMetrics),
    [currentMetrics, comparisonMetrics]
  );
  const todayDate = formatDateInput(new Date());
  const canGoForward = resolvedDate < todayDate;

  useEffect(() => {
    getShiftTemplates()
      .then(({ data }) => setShifts(data))
      .catch(() => setShifts([]));
  }, []);

  useEffect(() => {
    if (shiftMode === "primary") {
      setShiftId("");
    }
  }, [shiftMode]);

  const loadAttendance = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params: Record<string, string> = {};
      if (resolvedDate) params.date = resolvedDate;
      if (shiftId) params.shiftId = shiftId;
      if (search.trim()) params.search = search.trim();
      params.mode = shiftMode;
      const { data } = await listDailyAttendance(params);
      const nextRows = data.rows ?? [];
      setRows(nextRows);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("attendanceDaily.table.empty"));
    } finally {
      setLoading(false);
    }
  }, [resolvedDate, shiftId, search, shiftMode, t]);

  const loadComparison = useCallback(async () => {
    const previousDate = getPreviousDate(resolvedDate);
    if (!previousDate) {
      setComparisonMetrics(null);
      return;
    }
    try {
      const params: Record<string, string> = { date: previousDate };
      if (shiftId) params.shiftId = shiftId;
      if (search.trim()) params.search = search.trim();
      params.mode = shiftMode;
      const { data } = await listDailyAttendance(params);
      setComparisonMetrics(buildDailyMetrics(data.rows ?? []));
    } catch {
      setComparisonMetrics(null);
    }
  }, [resolvedDate, shiftId, search, shiftMode]);

  useEffect(() => {
    loadAttendance();
  }, [loadAttendance]);

  useEffect(() => {
    void loadComparison();
  }, [loadComparison]);

  useEffect(() => {
    const intervalId = setInterval(() => {
      void loadAttendance();
    }, REFRESH_INTERVAL_MS);
    return () => clearInterval(intervalId);
  }, [loadAttendance]);

  const summaryCards = useMemo<SummaryCardData[]>(
    () => [
      {
        id: "present",
        title: t("attendanceDaily.summaryCards.presentSummary"),
        icon: IconUserCheck,
        metrics: [
          {
            key: "onTime",
            label: t("attendanceDaily.summaryItems.onTime"),
            value: currentMetrics.onTime,
            delta: metricDeltas.onTime,
            upIsGood: true,
          },
          {
            key: "lateClockIn",
            label: t("attendanceDaily.summaryItems.lateClockIn"),
            value: currentMetrics.lateClockIn,
            delta: metricDeltas.lateClockIn,
            upIsGood: false,
          },
          {
            key: "earlyClockIn",
            label: t("attendanceDaily.summaryItems.earlyClockIn"),
            value: currentMetrics.earlyClockIn,
            delta: metricDeltas.earlyClockIn,
            upIsGood: false,
          },
        ],
      },
      {
        id: "notPresent",
        title: t("attendanceDaily.summaryCards.notPresentSummary"),
        icon: IconUserX,
        metrics: [
          {
            key: "absent",
            label: t("attendanceDaily.summaryItems.absent"),
            value: currentMetrics.absent,
            delta: metricDeltas.absent,
            upIsGood: false,
          },
          {
            key: "noClockIn",
            label: t("attendanceDaily.summaryItems.noClockIn"),
            value: currentMetrics.noClockIn,
            delta: metricDeltas.noClockIn,
            upIsGood: false,
          },
          {
            key: "noClockOut",
            label: t("attendanceDaily.summaryItems.noClockOut"),
            value: currentMetrics.noClockOut,
            delta: metricDeltas.noClockOut,
            upIsGood: false,
          },
          {
            key: "invalid",
            label: t("attendanceDaily.summaryItems.invalid"),
            value: currentMetrics.invalid,
            delta: metricDeltas.invalid,
            upIsGood: false,
          },
        ],
      },
      {
        id: "away",
        title: t("attendanceDaily.summaryCards.awaySummary"),
        icon: IconUserPause,
        metrics: [
          {
            key: "dayOff",
            label: t("attendanceDaily.summaryItems.dayOff"),
            value: currentMetrics.dayOff,
            delta: metricDeltas.dayOff,
            upIsGood: true,
          },
          {
            key: "timeOff",
            label: t("attendanceDaily.summaryItems.timeOff"),
            value: currentMetrics.timeOff,
            delta: metricDeltas.timeOff,
            upIsGood: true,
          },
        ],
      },
    ],
    [t, currentMetrics, metricDeltas]
  );

  const filteredRows = useMemo(() => {
    if (!summaryFilter) return rows;
    if (summaryFilter.type === "card") {
      return rows.filter((row) => rowMatchesSummaryCard(row, summaryFilter.cardId));
    }
    return rows.filter((row) => rowMatchesMetric(row, summaryFilter.metricKey));
  }, [rows, summaryFilter]);

  const cardRowsById = useMemo<Record<SummaryCardId, DailyAttendanceRow[]>>(() => ({
    present: rows.filter((row) => rowMatchesSummaryCard(row, "present")),
    notPresent: rows.filter((row) => rowMatchesSummaryCard(row, "notPresent")),
    away: rows.filter((row) => rowMatchesSummaryCard(row, "away")),
  }), [rows]);

  const activeSummaryFilterLabel = useMemo(() => {
    if (!summaryFilter) return "";
    const card = summaryCards.find((item) => item.id === summaryFilter.cardId);
    if (!card) return "";
    if (summaryFilter.type === "card") return card.title;
    const metric = card.metrics.find((item) => item.key === summaryFilter.metricKey);
    return metric?.label ?? card.title;
  }, [summaryCards, summaryFilter]);

  const stepDate = useCallback(
    (offset: number) => {
      const next = shiftDateBy(resolvedDate, offset);
      if (!next) return;
      if (offset > 0 && next > todayDate) return;
      setCustomDate(next);
      setDatePreset("custom");
    },
    [resolvedDate, todayDate]
  );

  const exportCsv = useCallback(async (sourceRows: DailyAttendanceRow[] = filteredRows, filenameTag = "") => {
    if (!sourceRows.length) return;
    const headers = [
      t("attendanceDaily.table.employeeName"),
      t("attendanceDaily.table.clock"),
      t("attendanceDaily.table.status"),
      t("attendanceDaily.table.overtime"),
      t("attendanceDaily.table.shift"),
      t("attendanceDaily.table.note"),
    ];
    const dataRows = sourceRows.map((row) => {
      const durationLabel = getRowDuration(row);
      const clockLabel = `${formatTime(row.checkInAt, i18n.language)} - ${formatTime(row.checkOutAt, i18n.language)} (${durationLabel})`;
      const overtimeLabel =
        row.overtimeMinutes !== null && row.overtimeMinutes !== undefined
          ? formatDurationShort(row.overtimeMinutes)
          : "-";
      const shiftLabel = row.hasShift ? row.shiftName : t("attendanceDaily.labels.noShift");
      const statusLabel = t(`attendanceDaily.badges.${row.status.toLowerCase()}`);
      const noteLabel = row.justificationReason ?? "-";
      const nameLabel = `${row.memberFullName} #${row.memberCode}${row.memberPhone ? ` | ${row.memberPhone}` : ""}`;
      return [nameLabel, clockLabel, statusLabel, overtimeLabel, shiftLabel, noteLabel];
    });
    const csv = [headers, ...dataRows].map((row) => row.map(escapeCsv).join(",")).join("\n");
    const safeTag = sanitizeFilenameSegment(filenameTag);
    try {
      await recordAttendanceClientCsvExport({
        variant: "daily-attendance",
        rowCount: sourceRows.length,
        lang: resolveExportLanguage(i18n.language),
        filters: {
          date: resolvedDate,
          summaryFilterApplied: Boolean(summaryFilter || filenameTag),
        },
      });
      downloadCsv(csv, `attendance-${resolvedDate || formatDateInput(new Date())}${safeTag ? `-${safeTag}` : ""}.csv`);
    } catch (exportError) {
      push({ kind: "error", title: exportError instanceof Error ? exportError.message : "CSV export audit failed" });
    }
  }, [filteredRows, i18n.language, push, resolvedDate, summaryFilter, t]);

  const emptyLabel = error ?? (summaryFilter ? t("attendanceDaily.monitor.emptyList") : t("attendanceDaily.table.empty"));

  return (
    <div
      className="attendance-clean space-y-4"
      dir={isRtl ? "rtl" : "ltr"}
      data-testid="attendance-daily-page"
    >
      <header className="attendance-clean__header">
        <h2 className="attendance-clean__title">{t("attendanceDaily.title")}</h2>
        <div className="attendance-clean__date">
          <button type="button" onClick={() => stepDate(-1)} aria-label={t("common.actions.prev")}>
            {isRtl ? (
              <ChevronRightIcon className="attendance-clean__date-icon" />
            ) : (
              <ChevronLeftIcon className="attendance-clean__date-icon" />
            )}
          </button>
          <span data-testid="attendance-daily-display-date">{displayDate}</span>
          <button
            type="button"
            onClick={() => stepDate(1)}
            aria-label={t("common.actions.next")}
            disabled={!canGoForward}
          >
            {isRtl ? (
              <ChevronLeftIcon className="attendance-clean__date-icon" />
            ) : (
              <ChevronRightIcon className="attendance-clean__date-icon" />
            )}
          </button>
        </div>
        <div className="attendance-clean__actions">
          <button
            type="button"
            data-testid="attendance-daily-export-csv"
            onClick={() => exportCsv()}
            className="attendance-clean__btn financial-export-action"
          >
            <ReportIcon className="attendance-clean__btn-icon" />
            {t("attendanceDaily.actions.report")}
          </button>
        </div>
      </header>

      <div className="attendance-summary-grid">
        {summaryCards.map((card) => (
          <SummaryCard
            key={card.id}
            title={card.title}
            icon={card.icon}
            metrics={card.metrics}
            cardCount={cardRowsById[card.id].length}
            activeFilter={summaryFilter}
            onSelectCard={() => setSummaryFilter({ type: "card", cardId: card.id })}
            onSelectMetric={(metricKey) => setSummaryFilter({ type: "metric", cardId: card.id, metricKey })}
            onClearFilter={() => setSummaryFilter(null)}
            onExport={() => {
              const rowsToExport =
                summaryFilter && summaryFilter.cardId === card.id ? filteredRows : cardRowsById[card.id];
              exportCsv(rowsToExport, `${card.id}-summary`);
            }}
            cardId={card.id}
          />
        ))}
      </div>

      <div className="attendance-filterbar">
        <div className="attendance-search">
          <SearchIcon className="attendance-icon" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("attendanceDaily.filters.searchEmployee")}
          />
        </div>
        <div className="attendance-select" data-testid="attendance-daily-date-filter">
          <CalendarIcon className="attendance-icon" />
          <FilterSelectMenu
            value={datePreset}
            onChange={(value) => setDatePreset(value as DatePreset)}
            containerClassName="flex-1"
            testId="attendance-daily-date-preset"
            options={[
              { value: "today", label: t("attendanceDaily.filters.today") },
              { value: "yesterday", label: t("attendanceDaily.filters.yesterday") },
              { value: "custom", label: t("attendanceDaily.filters.custom") },
            ]}
          />
          {datePreset === "custom" ? (
            <ShamsiDateInput
              value={customDate}
              onChange={setCustomDate}
              locale={i18n.language}
              inputClassName={COMPACT_INPUT_CLASS}
            />
          ) : null}
        </div>
        <div className="attendance-select">
          <ShiftIcon className="attendance-icon" />
          <FilterSelectMenu
            value={shiftMode}
            onChange={(value) => setShiftMode(value as ShiftMode)}
            options={[
              { value: "primary", label: t("attendanceDaily.filters.primaryShift") },
              { value: "all", label: t("attendanceDaily.filters.allShifts") },
            ]}
          />
        </div>
        {shiftMode === "all" ? (
          <div className="attendance-select">
            <ShiftIcon className="attendance-icon" />
            <FilterSelectMenu
              value={shiftId}
              onChange={setShiftId}
              options={[
                { value: "", label: t("attendanceDaily.filters.allShifts") },
                ...shifts.map((shift) => ({
                  value: shift.id,
                  label: `${shift.shiftName} (${shift.shiftStart}-${shift.shiftEnd})`,
                })),
              ]}
            />
          </div>
        ) : null}
        {activeSummaryFilterLabel ? (
          <button type="button" className="attendance-summary-filter-chip" onClick={() => setSummaryFilter(null)}>
            <SummaryIcon className="attendance-icon" />
            <span className="truncate">{activeSummaryFilterLabel}</span>
            <span className="attendance-summary-filter-chip__clear">x</span>
          </button>
        ) : null}
        <div className="attendance-view-toggle">
          <button
            type="button"
            className={`attendance-view-btn ${viewMode === "cards" ? "is-active" : ""}`}
            onClick={() => setViewMode("cards")}
            aria-pressed={viewMode === "cards"}
            aria-label="Card view"
          >
            <CardsViewIcon className="attendance-icon" />
          </button>
          <button
            type="button"
            className={`attendance-view-btn ${viewMode === "rows" ? "is-active" : ""}`}
            onClick={() => setViewMode("rows")}
            aria-pressed={viewMode === "rows"}
            aria-label="Row view"
          >
            <RowsViewIcon className="attendance-icon" />
          </button>
        </div>
      </div>

      {viewMode === "rows" ? (
        <DataTableShell>
          <DataTable minWidth="840px">
            <DataTableHead>
              <DataTableRow>
                <DataTableHeaderCell>{t("attendanceDaily.table.employeeName")}</DataTableHeaderCell>
                <DataTableHeaderCell>{t("attendanceDaily.table.clock")}</DataTableHeaderCell>
                <DataTableHeaderCell>{t("attendanceDaily.table.status")}</DataTableHeaderCell>
                <DataTableHeaderCell>{t("attendanceDaily.table.overtime")}</DataTableHeaderCell>
                <DataTableHeaderCell>{t("attendanceDaily.table.shift")}</DataTableHeaderCell>
                <DataTableHeaderCell>{t("attendanceDaily.table.note")}</DataTableHeaderCell>
              </DataTableRow>
            </DataTableHead>
            <DataTableBody>
              {loading && rows.length === 0 ? (
                <DataTableSkeletonRows rows={8} columns={6} />
              ) : filteredRows.length === 0 ? (
                <DataTableEmptyRow colSpan={6}>{emptyLabel}</DataTableEmptyRow>
              ) : (
                filteredRows.map((row) => {
                  const durationLabel = getRowDuration(row);
                  const overtimeLabel = row.overtimeMinutes !== null && row.overtimeMinutes !== undefined
                    ? formatDurationShort(row.overtimeMinutes)
                    : "-";
                  const shiftLabel = row.hasShift ? row.shiftName : t("attendanceDaily.labels.noShift");
                  const statusLabel = t(`attendanceDaily.badges.${row.status.toLowerCase()}`);
                  const noteLabel = row.justificationReason ?? "-";
                  const avatar = getInitials(row.memberFullName);
                  const avatarColor = getAvatarColor(row.memberFullName);
                  return (
                    <DataTableRow key={getRowKey(row)} clickable onClick={() => setSelectedRowKey(getRowKey(row))}>
                      <DataTableCell>
                        <div className="attendance-employee">
                          <span className="attendance-avatar" style={{ backgroundColor: avatarColor }}>
                            {avatar}
                          </span>
                          <div>
                            <p className="attendance-employee__name">{row.memberFullName}</p>
                            <p className="attendance-employee__meta">
                              {row.memberCode}
                              {row.memberPhone ? ` | ${row.memberPhone}` : ""}
                            </p>
                          </div>
                        </div>
                      </DataTableCell>
                      <DataTableCell>
                        <div className="attendance-clock">
                          <span className="attendance-time attendance-time--in">{formatTime(row.checkInAt, i18n.language)}</span>
                          <span className="attendance-clock__dot" />
                          <span className="attendance-clock__duration">{durationLabel}</span>
                          <span className="attendance-clock__dot" />
                          <span className="attendance-time attendance-time--out">{formatTime(row.checkOutAt, i18n.language)}</span>
                        </div>
                      </DataTableCell>
                      <DataTableCell>
                        <span className={`attendance-status ${STATUS_STYLES[row.status]}`}>{statusLabel}</span>
                      </DataTableCell>
                      <DataTableCell>{overtimeLabel}</DataTableCell>
                      <DataTableCell>
                        <span className="attendance-pill">
                          <ShiftIcon className="attendance-icon" />
                          <span className="attendance-pill__label">{shiftLabel}</span>
                        </span>
                      </DataTableCell>
                      <DataTableCell className="attendance-note">{noteLabel}</DataTableCell>
                    </DataTableRow>
                  );
                })
              )}
            </DataTableBody>
          </DataTable>
        </DataTableShell>
      ) : (
        <div className="attendance-cards-grid">
          {loading && rows.length === 0 ? (
            [...Array(8)].map((_, index) => (
              <div key={`card-loading-${index}`} className="attendance-card">
                <div className="attendance-skeleton" />
                <div className="attendance-skeleton" />
                <div className="attendance-skeleton" />
              </div>
            ))
          ) : filteredRows.length === 0 ? (
            <div className="attendance-cards-empty">{emptyLabel}</div>
          ) : (
            filteredRows.map((row) => {
              const durationLabel = getRowDuration(row);
              const overtimeLabel = row.overtimeMinutes !== null && row.overtimeMinutes !== undefined
                ? formatDurationShort(row.overtimeMinutes)
                : "-";
              const shiftLabel = row.hasShift ? row.shiftName : t("attendanceDaily.labels.noShift");
              const statusLabel = t(`attendanceDaily.badges.${row.status.toLowerCase()}`);
              const noteLabel = row.justificationReason ?? "-";
              const avatar = getInitials(row.memberFullName);
              const avatarColor = getAvatarColor(row.memberFullName);
              const clockLabel = `${formatTime(row.checkInAt, i18n.language)} - ${formatTime(row.checkOutAt, i18n.language)} (${durationLabel})`;

              return (
                <button
                  key={getRowKey(row)}
                  type="button"
                  className="attendance-card"
                  onClick={() => setSelectedRowKey(getRowKey(row))}
                >
                  <div className="attendance-card__head">
                    <div className="attendance-employee">
                      <span className="attendance-avatar" style={{ backgroundColor: avatarColor }}>
                        {avatar}
                      </span>
                      <div>
                        <p className="attendance-employee__name">{row.memberFullName}</p>
                        <p className="attendance-employee__meta">
                          {row.memberCode}
                          {row.memberPhone ? ` | ${row.memberPhone}` : ""}
                        </p>
                      </div>
                    </div>
                    <span className={`attendance-status ${STATUS_STYLES[row.status]}`}>{statusLabel}</span>
                  </div>

                  <div className="attendance-card__meta">
                    <div className="attendance-card__item">
                      <span className="attendance-card__label">{t("attendanceDaily.table.clock")}</span>
                      <span className="attendance-card__value">{clockLabel}</span>
                    </div>
                    <div className="attendance-card__item">
                      <span className="attendance-card__label">{t("attendanceDaily.table.overtime")}</span>
                      <span className="attendance-card__value">{overtimeLabel}</span>
                    </div>
                    <div className="attendance-card__item">
                      <span className="attendance-card__label">{t("attendanceDaily.table.shift")}</span>
                      <span className="attendance-pill">
                        <ShiftIcon className="attendance-icon" />
                        <span className="attendance-pill__label">{shiftLabel}</span>
                      </span>
                    </div>
                    <div className="attendance-card__item">
                      <span className="attendance-card__label">{t("attendanceDaily.table.note")}</span>
                      <span className="attendance-note">{noteLabel}</span>
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>
      )}

      <AttendanceDailyDrawer
        row={selectedRow}
        date={resolvedDate}
        onClose={() => setSelectedRowKey(null)}
        onRefresh={loadAttendance}
      />
    </div>
  );
}

type SelectOption = {
  value: string;
  label: string;
};

type SummaryMetric = {
  key: DailyMetricKey;
  label: string;
  value: number;
  delta: number;
  upIsGood?: boolean;
};

type SummaryCardData = {
  id: SummaryCardId;
  title: string;
  metrics: SummaryMetric[];
  icon: ComponentType<SVGProps<SVGSVGElement>>;
};

type DailyMetrics = Record<DailyMetricKey, number>;

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
        className={`${buttonClassName} attendance-select__button flex w-full cursor-pointer items-center justify-between gap-2 text-start`}
        onClick={() => setOpen((prev) => !prev)}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="truncate">{displayLabel}</span>
        <ChevronDownIcon
          className={`attendance-select__chevron h-3.5 w-3.5 shrink-0 transition ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open ? (
        <div className="attendance-select__menu attendance-select__menu--end absolute z-50 mt-1 w-full overflow-hidden rounded-xl border p-2 shadow-2xl shadow-black/30 backdrop-blur">
          <div role="listbox" className="max-h-72 overflow-auto">
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
                  className={`attendance-select__option flex w-full items-center justify-between rounded-lg px-3 py-2 text-[12px] text-start transition ${
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
                  {isSelected ? <CheckIcon className="attendance-select__check h-3 w-3" /> : null}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function SummaryCard({
  cardId,
  title,
  icon: Icon,
  metrics,
  cardCount,
  activeFilter,
  onSelectCard,
  onSelectMetric,
  onClearFilter,
  onExport,
}: {
  cardId: SummaryCardId;
  title: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  metrics: SummaryMetric[];
  cardCount: number;
  activeFilter: SummaryFilter | null;
  onSelectCard: () => void;
  onSelectMetric: (metricKey: DailyMetricKey) => void;
  onClearFilter: () => void;
  onExport: () => void;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const isCardSelected = activeFilter?.type === "card" && activeFilter.cardId === cardId;

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
    <div className="attendance-summary-card">
      <div className="attendance-summary-card__header">
        <div className="attendance-summary-card__title">
          <span className="attendance-summary-card__icon">
            <Icon className="h-5 w-5" stroke="1.8" />
          </span>
          <span>{title}</span>
        </div>
        <div ref={rootRef} className="attendance-summary-card__menu-wrap">
          <button
            type="button"
            className="attendance-summary-card__menu"
            aria-label={t("attendanceDaily.actions.more")}
            aria-haspopup="menu"
            aria-expanded={open}
            onClick={() => setOpen((prev) => !prev)}
          >
            <DotsIcon />
          </button>
          {open ? (
            <div className="attendance-summary-card__menu-panel" role="menu">
              <button
                type="button"
                className={`attendance-summary-card__menu-item ${isCardSelected ? "is-selected" : ""}`}
                onClick={() => {
                  onSelectCard();
                  setOpen(false);
                }}
              >
                <span className="truncate">{title}</span>
                {isCardSelected ? (
                  <CheckIcon className="attendance-summary-card__menu-check h-3.5 w-3.5" />
                ) : (
                  <span className="attendance-summary-card__menu-count">{cardCount}</span>
                )}
              </button>
              <div className="attendance-summary-card__menu-separator" />
              {metrics.map((metric) => {
                const isMetricSelected =
                  activeFilter?.type === "metric" &&
                  activeFilter.cardId === cardId &&
                  activeFilter.metricKey === metric.key;
                return (
                  <button
                    key={metric.key}
                    type="button"
                    className={`attendance-summary-card__menu-item ${isMetricSelected ? "is-selected" : ""}`}
                    onClick={() => {
                      onSelectMetric(metric.key);
                      setOpen(false);
                    }}
                  >
                    <span className="truncate">{metric.label}</span>
                    {isMetricSelected ? (
                      <CheckIcon className="attendance-summary-card__menu-check h-3.5 w-3.5" />
                    ) : (
                      <span className="attendance-summary-card__menu-count">{metric.value}</span>
                    )}
                  </button>
                );
              })}
              <div className="attendance-summary-card__menu-separator" />
              <button
                type="button"
                className="attendance-summary-card__menu-item attendance-summary-card__menu-item--action financial-export-action"
                onClick={() => {
                  onExport();
                  setOpen(false);
                }}
              >
                <span className="inline-flex items-center gap-2">
                  <ReportIcon className="h-3.5 w-3.5" />
                  <span>{t("attendanceDaily.actions.exportCsv")}</span>
                </span>
              </button>
              <button
                type="button"
                className="attendance-summary-card__menu-item attendance-summary-card__menu-item--action"
                onClick={() => {
                  onClearFilter();
                  setOpen(false);
                }}
              >
                <span>{t("attendanceDaily.filters.clear")}</span>
              </button>
            </div>
          ) : null}
        </div>
      </div>
      <div
        className="attendance-summary-card__metrics"
        style={{ gridTemplateColumns: `repeat(${metrics.length}, minmax(0, 1fr))` }}
      >
        {metrics.map((metric) => {
          const delta = formatDelta(metric.delta, t, metric.upIsGood ?? true);
          return (
            <div key={metric.label} className="summary-metric">
              <p className="summary-metric__label">{metric.label}</p>
              <p className="summary-metric__value">{metric.value}</p>
              <p className={`summary-metric__delta ${delta.tone}`}>{delta.text}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function formatDelta(value: number, t: (key: string) => string, upIsGood: boolean) {
  const positiveTone = upIsGood ? "positive" : "negative";
  const negativeTone = upIsGood ? "negative" : "positive";
  if (value > 0) {
    return { text: `+ ${value} ${t("attendanceDaily.labels.vsYesterday")}`, tone: positiveTone };
  }
  if (value < 0) {
    return { text: `- ${Math.abs(value)} ${t("attendanceDaily.labels.vsYesterday")}`, tone: negativeTone };
  }
  return { text: `0 ${t("attendanceDaily.labels.vsYesterday")}`, tone: "neutral" };
}

function AttendanceDailyDrawer({
  row,
  date,
  onClose,
  onRefresh,
}: {
  row: DailyAttendanceRow | null;
  date: string;
  onClose: () => void;
  onRefresh: () => Promise<void>;
}) {
  const { t, i18n } = useTranslation();
  const { push } = useToast();
  const { hasPermission } = useAuth();
  const [items, setItems] = useState<AttendanceItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [justificationNote, setJustificationNote] = useState("");
  const [justificationError, setJustificationError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState(false);
  const isOpen = Boolean(row);
  useModalDismiss(onClose, isOpen);

  useEffect(() => {
    if (!row) return;
    setJustificationNote(row.justificationReason ?? "");
    setJustificationError(null);
  }, [row]);

  useEffect(() => {
    if (!row) return;
    let active = true;
    const range = buildDayRange(date);
    setLoading(true);
    setError(null);
    listAttendance({
      memberId: row.memberId,
      memberType: "STAFF",
      from: range.from,
      to: range.to,
      page: 1,
      pageSize: 200,
    })
      .then(({ data }) => {
        if (!active) return;
        const sorted = [...(data.items ?? [])].sort(
          (a, b) => new Date(a.recordedAt).getTime() - new Date(b.recordedAt).getTime()
        );
        setItems(sorted);
      })
      .catch((err) => {
        if (active) setError(err instanceof Error ? err.message : t("attendanceDaily.table.empty"));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [row, date, t]);

  useEffect(() => {
    if (error) {
      push({ kind: "error", title: error });
    }
  }, [error, push]);

  useEffect(() => {
    if (justificationError) {
      push({ kind: "error", title: justificationError });
    }
  }, [justificationError, push]);

  if (!row) return null;

  const entryLogsLink = buildEntryLogsLink(row.memberId, date);
  const showJustification = hasPermission("ATTENDANCE_JUSTIFY") && row.status === "ABSENT" && row.hasShift;

  const handleSaveJustification = async () => {
    if (!row) return;
    setSaving(true);
    setJustificationError(null);
    try {
      const reason = justificationNote.trim();
      await createAttendanceJustification({
        memberId: row.memberId,
        date,
        reason: reason ? reason : undefined,
      });
      await onRefresh();
    } catch (err) {
      setJustificationError(err instanceof Error ? err.message : t("attendanceDaily.table.empty"));
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveJustification = async () => {
    if (!row) return;
    setRemoving(true);
    setJustificationError(null);
    try {
      await deleteAttendanceJustification({ memberId: row.memberId, date });
      setJustificationNote("");
      await onRefresh();
    } catch (err) {
      setJustificationError(err instanceof Error ? err.message : t("attendanceDaily.table.empty"));
    } finally {
      setRemoving(false);
    }
  };

  return (
    <div className="modal-overlay fixed inset-0 z-40 flex justify-end bg-black/60 p-4 sm:p-6" onClick={onClose}>
      <div className="flex h-full w-full max-w-2xl flex-col overflow-y-auto rounded-2xl border border-slate-800/80 bg-slate-950 p-4 shadow-2xl shadow-black/40" onClick={(event) => event.stopPropagation()}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[11px] uppercase tracking-wide text-slate-500">{t("attendanceDaily.table.staff")}</p>
            <p className="text-sm font-semibold text-white">
              {row.memberFullName} <span className="text-[10px] text-slate-400">#{row.memberCode}</span>
            </p>
            {row.staffGroupName ? <p className="text-[10px] text-slate-500">{row.staffGroupName}</p> : null}
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              to={entryLogsLink}
              className="btn-action rounded-full border border-slate-700 px-2.5 py-0.5 text-[11px] text-slate-200 hover:border-slate-500"
            >
              {t("attendanceDaily.actions.openEntryLogs")}
            </Link>
            <CloseIconButton label={t("attendanceDaily.actions.close")} onClick={onClose} />
          </div>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <DetailCard
            label={t("attendanceDaily.table.shift")}
            value={row.hasShift ? `${row.shiftName} (${row.shiftStart}-${row.shiftEnd})` : t("attendanceDaily.labels.noShift")}
          />
          <DetailCard
            label={t("attendanceDaily.table.status")}
            value={
              <div className="flex flex-wrap gap-2">
                <span className={`rounded-full border px-2 py-0.5 text-[10px] uppercase ${STATUS_STYLES[row.status]}`}>
                  {t(`attendanceDaily.badges.${row.status.toLowerCase()}`)}
                </span>
                {row.isJustified && row.status === "ABSENT" ? (
                  <span className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-[10px] uppercase text-emerald-700 dark:text-emerald-200">
                    {t("attendanceDaily.badges.justified")}
                  </span>
                ) : null}
              </div>
            }
          />
          <DetailCard label={t("attendanceDaily.table.checkIn")} value={formatTime(row.checkInAt, i18n.language)} />
          <DetailCard label={t("attendanceDaily.table.checkOut")} value={formatTime(row.checkOutAt, i18n.language)} />
          <DetailCard label={t("attendanceDaily.table.late")} value={formatMinutesForDisplay(row.lateMinutes)} />
          <DetailCard label={t("attendanceDaily.table.early")} value={formatMinutesForDisplay(row.earlyMinutes, { showZero: false })} />
          <DetailCard
            label={t("attendanceDaily.table.earlyLeave")}
            value={formatMinutesForDisplay(row.earlyLeaveMinutes, { showZero: false })}
          />
          <DetailCard
            label={t("attendanceDaily.table.overtime")}
            value={formatMinutesForDisplay(row.overtimeMinutes, { showZero: false })}
          />
          <DetailCard
            label={t("attendanceDaily.table.duration")}
            value={
              <div className="space-y-1">
                <div>{formatMinutesLive(row.confirmedDurationMinutes, t("attendanceDaily.labels.confirmed"))}</div>
                {row.hasOpenSession && row.liveDurationMinutes !== null ? (
                  <div className="text-[10px] text-slate-400">
                    {formatMinutesLive(row.liveDurationMinutes, t("attendanceDaily.labels.live"))}{" "}
                    {row.openSessionSince ? t("attendanceDaily.labels.since", { time: formatTime(row.openSessionSince, i18n.language) }) : ""}
                  </div>
                ) : null}
              </div>
            }
          />
          <DetailCard label={t("attendanceDaily.table.device")} value={row.deviceName ?? "-"} />
        </div>

        {showJustification ? (
          <div className="mt-5 rounded-2xl border border-slate-800/80 bg-slate-900/40 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-[11px] uppercase tracking-wide text-slate-400">{t("attendanceDaily.drawer.justificationTitle")}</p>
              {row.isJustified ? (
                <span className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-[10px] uppercase text-emerald-700 dark:text-emerald-200">
                  {t("attendanceDaily.badges.justified")}
                </span>
              ) : null}
            </div>
            <textarea
              value={justificationNote}
              onChange={(e) => setJustificationNote(e.target.value)}
              placeholder={t("attendanceDaily.drawer.justificationPlaceholder")}
              className="mt-3 min-h-[72px] w-full rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-2 text-xs text-slate-100 outline-none focus:border-brand-500/60"
            />
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleSaveJustification}
                className="btn-success rounded-full border border-emerald-500/40 bg-emerald-500/10 px-3 py-1.5 text-[11px] font-semibold text-emerald-100 hover:bg-emerald-500/20"
                disabled={saving}
              >
                {row.isJustified ? t("attendanceDaily.drawer.updateJustification") : t("attendanceDaily.drawer.saveJustification")}
              </button>
              {row.isJustified ? (
                <button
                  type="button"
                  onClick={handleRemoveJustification}
                  className="rounded-full border border-rose-500/40 bg-rose-500/10 px-3 py-1.5 text-[11px] font-semibold text-rose-100 hover:bg-rose-500/20"
                  disabled={removing}
                >
                  {t("attendanceDaily.drawer.removeJustification")}
                </button>
              ) : null}
            </div>
          </div>
        ) : null}

        <div className="mt-5">
          <div className="flex items-center justify-between">
            <h4 className="text-[11px] font-semibold text-slate-200">{t("attendanceDaily.drawer.events")}</h4>
            <span className="text-[10px] text-slate-500">{items.length}</span>
          </div>
          {loading ? (
            <div className="mt-3 space-y-2">
              {[...Array(3)].map((_, index) => (
                <div key={`event-skeleton-${index}`} className="h-12 animate-pulse rounded-xl bg-slate-800/60" />
              ))}
            </div>
          ) : items.length === 0 ? (
            <p className="mt-3 text-[11px] text-slate-400">{t("attendanceDaily.drawer.noEvents")}</p>
          ) : (
            <div className="mt-3 space-y-2">
              {items.map((item) => (
                <div key={item.id} className="rounded-xl border border-slate-800 bg-slate-900/40 p-2.5 text-[11px] text-slate-200">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-white">{formatDateTime(item.recordedAt, i18n.language)}</span>
                    <div className="flex flex-wrap gap-2">
                      {item.isAuthorized ? (
                        <span
                          className={`rounded-full border px-2 py-0.5 text-[10px] uppercase ${
                            item.eventType === "IN"
                              ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:border-emerald-500/50 dark:bg-emerald-500/10 dark:text-emerald-200"
                              : "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:border-amber-500/50 dark:bg-amber-500/10 dark:text-amber-200"
                          }`}
                        >
                          {t(`attendance.badges.${item.eventType === "IN" ? "in" : "out"}`)}
                        </span>
                      ) : (
                        <span className="rounded-full border border-rose-500/40 bg-rose-500/10 px-2 py-0.5 text-[10px] uppercase text-rose-700 dark:border-rose-500/50 dark:bg-rose-500/10 dark:text-rose-200">
                          {t("attendance.badges.denied")}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="mt-1 text-[11px] text-slate-400">
                    {item.deviceName ?? formatSourceLabel(item.source, t)}
                  </div>
                  {item.reason ? <div className="mt-1 text-[10px] text-slate-500">{formatAccessReason(item.reason, t)}</div> : null}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function DetailCard({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-2.5 text-[11px] text-slate-200">
      <p className="text-[10px] uppercase tracking-wide text-slate-500">{label}</p>
      <div className="mt-1 text-white">{value}</div>
    </div>
  );
}

function resolveDate(preset: DatePreset, customValue: string) {
  const now = new Date();
  if (preset === "today") return formatDateInput(now);
  if (preset === "yesterday") {
    const prev = new Date(now);
    prev.setDate(prev.getDate() - 1);
    return formatDateInput(prev);
  }
  return customValue || formatDateInput(now);
}

function formatDateInput(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function buildDayRange(date: string) {
  const start = new Date(`${date}T00:00:00`);
  const end = new Date(`${date}T23:59:59`);
  return {
    from: start.toISOString(),
    to: end.toISOString(),
  };
}

function buildEntryLogsLink(memberId: string, date: string) {
  const range = buildDayRange(date);
  const params = new URLSearchParams({
    memberId,
    from: range.from,
    to: range.to,
    memberType: "STAFF",
  });
  return `/entry-logs?${params.toString()}`;
}

function getRowKey(row: DailyAttendanceRow) {
  return `${row.memberId}-${row.shiftId ?? row.shiftName}-${row.shiftStart || "shiftless"}`;
}

function createEmptyMetrics(): DailyMetrics {
  return {
    onTime: 0,
    lateClockIn: 0,
    earlyClockIn: 0,
    absent: 0,
    noClockIn: 0,
    noClockOut: 0,
    invalid: 0,
    dayOff: 0,
    timeOff: 0,
  };
}

function buildDailyMetrics(rows: DailyAttendanceRow[]): DailyMetrics {
  const metrics = createEmptyMetrics();
  rows.forEach((row) => {
    const hasCheckIn = Boolean(row.checkInAt);
    const isLate = (row.lateMinutes ?? 0) > 0 || row.status === "LATE";
    const isEarly = (row.earlyMinutes ?? 0) > 0;
    if (row.status === "ABSENT") metrics.absent += 1;
    if (!hasCheckIn) metrics.noClockIn += 1;
    if (row.hasOpenSession || row.warnings.includes("NO_CHECKOUT") || (hasCheckIn && !row.checkOutAt)) {
      metrics.noClockOut += 1;
    }
    if (row.warnings.includes("MULTIPLE_EVENTS")) metrics.invalid += 1;
    if (row.warnings.includes("NO_SHIFT") || !row.hasShift) metrics.dayOff += 1;
    if (row.isJustified) metrics.timeOff += 1;
    if (hasCheckIn && !isLate && row.status !== "ABSENT") metrics.onTime += 1;
    if (isLate) metrics.lateClockIn += 1;
    if (isEarly) metrics.earlyClockIn += 1;
  });
  return metrics;
}

function buildMetricDeltas(current: DailyMetrics, previous: DailyMetrics | null): DailyMetrics {
  const base = previous ?? createEmptyMetrics();
  const deltas = createEmptyMetrics();
  (Object.keys(deltas) as (keyof DailyMetrics)[]).forEach((key) => {
    deltas[key] = current[key] - base[key];
  });
  return deltas;
}

function rowMatchesSummaryCard(row: DailyAttendanceRow, cardId: SummaryCardId) {
  return SUMMARY_CARD_METRICS[cardId].some((metricKey) => rowMatchesMetric(row, metricKey));
}

function rowMatchesMetric(row: DailyAttendanceRow, metricKey: DailyMetricKey) {
  const hasCheckIn = Boolean(row.checkInAt);
  const isLate = (row.lateMinutes ?? 0) > 0 || row.status === "LATE";
  const isEarly = (row.earlyMinutes ?? 0) > 0;

  if (metricKey === "onTime") return hasCheckIn && !isLate && row.status !== "ABSENT";
  if (metricKey === "lateClockIn") return isLate;
  if (metricKey === "earlyClockIn") return isEarly;
  if (metricKey === "absent") return row.status === "ABSENT";
  if (metricKey === "noClockIn") return !hasCheckIn;
  if (metricKey === "noClockOut") {
    return row.hasOpenSession || row.warnings.includes("NO_CHECKOUT") || (hasCheckIn && !row.checkOutAt);
  }
  if (metricKey === "invalid") return row.warnings.includes("MULTIPLE_EVENTS");
  if (metricKey === "dayOff") return row.warnings.includes("NO_SHIFT") || !row.hasShift;
  if (metricKey === "timeOff") return row.isJustified;
  return false;
}

function getPreviousDate(value: string) {
  return shiftDateBy(value, -1);
}

function shiftDateBy(value: string, offset: number) {
  if (!value) return null;
  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return null;
  parsed.setDate(parsed.getDate() + offset);
  return formatDateInput(parsed);
}

function getRowDuration(row: DailyAttendanceRow) {
  if (!row.checkInAt) return "-";
  const minutes = row.hasOpenSession && row.liveDurationMinutes !== null ? row.liveDurationMinutes : row.confirmedDurationMinutes;
  return formatDurationShort(minutes);
}

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  const initials = parts.slice(0, 2).map((part) => part[0]).join("");
  return initials.toUpperCase();
}

const AVATAR_COLORS = ["#4f46e5", "#0ea5e9", "#14b8a6", "#f97316", "#a855f7", "#ef4444"];

function getAvatarColor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) {
    hash = (hash << 5) - hash + name.charCodeAt(i);
    hash |= 0;
  }
  const index = Math.abs(hash) % AVATAR_COLORS.length;
  return AVATAR_COLORS[index];
}

function formatTime(value?: string | null, locale = "en") {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "-";
  return parsed.toLocaleTimeString(resolveDateLocale(locale), { hour: "2-digit", minute: "2-digit" });
}

function formatDateTime(value?: string | null, locale = "en") {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "-";
  return parsed.toLocaleString(resolveDateLocale(locale));
}

function formatMinutesPair(value?: number | null) {
  if (value === null || value === undefined) return null;
  const total = Math.max(0, Math.floor(value));
  const hours = Math.floor(total / 60);
  const minutes = total % 60;
  const hh = String(hours).padStart(2, "0");
  const mm = String(minutes).padStart(2, "0");
  return { total, hhmm: `${hh}:${mm}` };
}

function formatDurationShort(value?: number | null) {
  const pair = formatMinutesPair(value);
  if (!pair) return "-";
  const hours = Math.floor(pair.total / 60);
  const minutes = pair.total % 60;
  if (hours === 0) return `${minutes}m`;
  if (minutes === 0) return `${hours}h`;
  return `${hours}h ${minutes}m`;
}

function formatMinutesForDisplay(value?: number | null, options?: { showZero?: boolean }) {
  const showZero = options?.showZero ?? true;
  const pair = formatMinutesPair(value);
  if (!pair || (!showZero && pair.total === 0)) return "-";
  return (
    <span className="inline-flex items-baseline gap-2">
      <span>{pair.hhmm}</span>
      <span className="text-[10px] text-slate-500">{pair.total}m</span>
    </span>
  );
}

function formatMinutesLive(value: number | null | undefined, label: string) {
  if (value === null || value === undefined) return "-";
  const minutes = Math.max(0, Math.floor(value));
  return label ? `${label}: ${minutes}m` : `${minutes}m`;
}

function formatSourceLabel(source: string, t: (key: string) => string) {
  if (source === "MANUAL") return t("attendance.badges.manual");
  if (source === "API") return t("attendance.badges.api");
  return t("attendance.badges.device");
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

function sanitizeFilenameSegment(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
}

function SummaryIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M8 3h6l5 5v13a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z" />
      <path d="M14 3v5h5" />
      <path d="M9 13h6" />
      <path d="M9 17h6" />
    </svg>
  );
}

function DotsIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <circle cx="5" cy="12" r="1.6" />
      <circle cx="12" cy="12" r="1.6" />
      <circle cx="19" cy="12" r="1.6" />
    </svg>
  );
}

function SearchIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-3.5-3.5" />
    </svg>
  );
}

function CalendarIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M16 3v4M8 3v4M3 11h18" />
    </svg>
  );
}

function CardsViewIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <rect x="3" y="4" width="8" height="7" rx="1.5" />
      <rect x="13" y="4" width="8" height="7" rx="1.5" />
      <rect x="3" y="13" width="8" height="7" rx="1.5" />
      <rect x="13" y="13" width="8" height="7" rx="1.5" />
    </svg>
  );
}

function RowsViewIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <rect x="3" y="5" width="4" height="4" rx="1" />
      <rect x="3" y="15" width="4" height="4" rx="1" />
      <path d="M10 7h11" />
      <path d="M10 17h11" />
    </svg>
  );
}

function ReportIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M8 3h6l5 5v13a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z" />
      <path d="M14 3v5h5" />
      <path d="M9 14h6" />
      <path d="M9 18h6" />
    </svg>
  );
}

function ShiftIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}

function ChevronLeftIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M15 18l-6-6 6-6" />
    </svg>
  );
}

function ChevronRightIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M9 18l6-6-6-6" />
    </svg>
  );
}

function ChevronDownIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

function CheckIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M20 6l-11 11-5-5" />
    </svg>
  );
}
