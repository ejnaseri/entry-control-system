import {
  IconAlertTriangle,
  IconClock,
  IconFingerprint,
  IconLogin,
  IconRefresh,
  IconUserCheck,
  IconUsersGroup,
  IconUserX,
} from "@tabler/icons-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  getAttendanceDashboard,
  getAttendanceDashboardDetails,
  type AttendanceDashboardDetails,
  type AttendanceDashboardDetailType,
  type AttendanceDashboardSummary,
} from "../../api/attendanceDashboard";
import { CloseIconButton } from "../../components/CloseIconButton";
import { Button } from "../../components/ui/Button";
import {
  DataTable,
  DataTableBody,
  DataTableCell,
  DataTableHead,
  DataTableHeaderCell,
  DataTableRow,
  DataTableShell,
} from "../../components/ui/DataTable";
import { ErrorState } from "../../components/ui/StatePanel";
import { useModalDismiss } from "../../hooks/useModalDismiss";
import { getAttendanceDashboardCopy } from "./attendanceDashboardCopy";

type StatTone = "blue" | "green" | "purple" | "orange" | "red";
type Copy = ReturnType<typeof getAttendanceDashboardCopy>;
type DashboardSectionProps = { copy: Copy; summary: AttendanceDashboardSummary };
type DashboardStat = {
  key: AttendanceDashboardDetailType;
  icon: typeof IconUsersGroup;
  label: string;
  value: number;
  helper: string;
  tone: StatTone;
};

export function AttendanceDashboard() {
  const { i18n } = useTranslation();
  const copy = getAttendanceDashboardCopy(i18n.language);
  const [summary, setSummary] = useState<AttendanceDashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedStat, setSelectedStat] = useState<DashboardStat | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await getAttendanceDashboard();
      setSummary(response.data);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : copy.loadFailed);
    } finally {
      setLoading(false);
    }
  }, [copy.loadFailed]);

  useEffect(() => { void load(); }, [load]);

  const stats = useMemo<DashboardStat[]>(() => summary ? [
    {
      key: "active-employees", icon: IconUsersGroup, label: copy.activeEmployees, value: summary.employees.active,
      helper: `${copy.scheduledToday}: ${summary.employees.scheduledToday}`, tone: "blue",
    },
    {
      key: "present", icon: IconUserCheck, label: copy.present, value: summary.attendance.present,
      helper: `${copy.onTime}: ${summary.attendance.onTime}`, tone: "green",
    },
    {
      key: "inside-now", icon: IconLogin, label: copy.insideNow, value: summary.attendance.insideNow,
      helper: `${copy.openSessions}: ${summary.attendance.openSessions}`, tone: "purple",
    },
    {
      key: "late", icon: IconClock, label: copy.late, value: summary.attendance.late,
      helper: `${copy.justified}: ${summary.attendance.justified}`, tone: "orange",
    },
    {
      key: "absent", icon: IconUserX, label: copy.absent, value: summary.attendance.absent,
      helper: `${copy.scheduledToday}: ${summary.employees.scheduledToday}`, tone: "red",
    },
  ] : [], [copy, summary]);

  if (loading && !summary) {
    return (
      <div className="dashboard-v2 attendance-dashboard-v2" data-testid="attendance-dashboard-loading">
        <section className="dashboard-v2-kpis attendance-dashboard-v2__loading" aria-hidden="true">
          {Array.from({ length: 5 }).map((_, index) => <div className="attendance-dashboard-metric-skeleton" key={index} />)}
        </section>
      </div>
    );
  }

  return (
    <div className="dashboard-v2 attendance-dashboard-v2" data-testid="attendance-dashboard">
      {error ? (
        <div className="dashboard-v2-panel">
          <ErrorState
            data-testid="attendance-dashboard-error"
            icon={<IconAlertTriangle className="h-5 w-5" stroke={1.8} />}
            title={copy.loadFailed}
            description={error === copy.loadFailed ? undefined : error}
            action={<Button onClick={() => void load()} startIcon={<IconRefresh className="h-4 w-4" stroke={1.8} />}>{copy.refresh}</Button>}
          />
        </div>
      ) : null}

      {summary ? (
        <>
          <section className="dashboard-v2-kpis" data-testid="attendance-dashboard-metrics" aria-label={copy.title}>
            {stats.map((card) => {
              const Icon = card.icon;
              return <div
                className={`dashboard-v2-stat dashboard-v2-stat--${card.tone} is-clickable`}
                data-testid={`attendance-metric-${card.key}`}
                key={card.key}
                onClick={() => setSelectedStat(card)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    setSelectedStat(card);
                  }
                }}
                role="button"
                tabIndex={0}
              >
                <span className="dashboard-v2-stat-icon" aria-hidden><Icon className="h-6 w-6" stroke={1.8} /></span>
                <span className="dashboard-v2-stat-copy">
                  <span className="dashboard-v2-stat-label">{card.label}</span>
                  <strong>{card.value}</strong>
                  <small>{card.helper}</small>
                </span>
              </div>;
            })}
          </section>

          {selectedStat ? <AttendanceStatModal copy={copy} stat={selectedStat} onClose={() => setSelectedStat(null)} /> : null}

          <section className="dashboard-v2-main">
            <TodaySummary summary={summary} copy={copy} language={i18n.language} />
            <WarningsPanel summary={summary} copy={copy} />
            <DevicePanel summary={summary} copy={copy} language={i18n.language} />
          </section>

          <section className="dashboard-v2-secondary">
            <WeeklyAttendance summary={summary} copy={copy} language={i18n.language} />
            <PunchSummary summary={summary} copy={copy} />
            <AttendanceTrend summary={summary} copy={copy} language={i18n.language} />
          </section>
        </>
      ) : null}
    </div>
  );
}

function AttendanceStatModal({ copy, onClose, stat }: { copy: Copy; onClose: () => void; stat: DashboardStat }) {
  const { t, i18n } = useTranslation();
  const Icon = stat.icon;
  const [details, setDetails] = useState<AttendanceDashboardDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  useModalDismiss(onClose);

  useEffect(() => {
    let active = true;
    void getAttendanceDashboardDetails(stat.key)
      .then((response) => { if (active) setDetails(response.data); })
      .catch((loadError) => { if (active) setError(loadError instanceof Error ? loadError.message : copy.loadFailed); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [copy.loadFailed, stat.key]);

  const showing = details?.items.length ?? 0;
  const summary = copy.showingDetails.replace("{{showing}}", String(showing)).replace("{{total}}", String(details?.total ?? 0));

  return (
    <div className="modal-overlay fixed inset-0 z-40 flex items-start justify-center bg-slate-950/45 p-4 backdrop-blur-[2px] sm:p-6" onClick={onClose}>
      <div
        aria-labelledby="attendance-stat-modal-title"
        aria-modal="true"
        className="dashboard-details-modal flex max-h-[calc(100vh-3rem)] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-slate-800/80 bg-slate-950/90 bg-[radial-gradient(1200px_circle_at_top_right,_rgba(42,116,255,0.12),_transparent_55%)] p-4 shadow-2xl shadow-black/40 backdrop-blur-xl"
        data-testid="attendance-stat-modal"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className={`dashboard-v2-stat-icon dashboard-v2-stat--${stat.tone}`} aria-hidden><Icon className="h-6 w-6" stroke={1.8} /></span>
            <div>
              <p className="text-sm font-semibold text-white" id="attendance-stat-modal-title">{stat.label}</p>
              <p className="text-[11px] text-slate-400">{loading ? copy.loading : summary}</p>
            </div>
          </div>
          <CloseIconButton label={t("common.actions.close")} onClick={onClose} />
        </div>
        <div className="mt-3 min-h-[150px] flex-1 overflow-y-auto pr-1">
          {loading ? (
            <div className="rounded-xl border border-slate-800/80 bg-slate-900/40 p-3 text-[11px] text-slate-300">{copy.loading}</div>
          ) : error ? (
            <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-[11px] text-rose-200">{error}</div>
          ) : !details || details.items.length === 0 ? (
            <div className="rounded-xl border border-slate-800/80 bg-slate-900/40 p-3 text-[11px] text-slate-300">{copy.noDetails}</div>
          ) : (
            <DataTableShell>
              <DataTable minWidth="820px" variant="compact">
                <DataTableHead><DataTableRow>
                  <DataTableHeaderCell>{copy.employee}</DataTableHeaderCell>
                  <DataTableHeaderCell>{copy.code}</DataTableHeaderCell>
                  <DataTableHeaderCell>{copy.group}</DataTableHeaderCell>
                  <DataTableHeaderCell>{copy.shift}</DataTableHeaderCell>
                  <DataTableHeaderCell>{copy.checkIn}</DataTableHeaderCell>
                  <DataTableHeaderCell>{copy.checkOut}</DataTableHeaderCell>
                  <DataTableHeaderCell>{copy.status}</DataTableHeaderCell>
                </DataTableRow></DataTableHead>
                <DataTableBody>{details.items.map((item) => (
                  <DataTableRow key={item.memberId}>
                    <DataTableCell className="font-semibold">{item.memberName}<small className="mt-0.5 block font-normal text-slate-400">{item.memberPhone ?? copy.none}</small></DataTableCell>
                    <DataTableCell>{item.memberCode}</DataTableCell>
                    <DataTableCell>{item.staffGroupName ?? copy.none}</DataTableCell>
                    <DataTableCell>{item.shiftName ?? item.role ?? copy.none}<small className="mt-0.5 block text-slate-400">{item.shiftTime ?? (item.shiftName ? item.role : null) ?? ""}</small></DataTableCell>
                    <DataTableCell>{formatDateTime(item.checkInAt, i18n.language, copy.none)}</DataTableCell>
                    <DataTableCell>{formatDateTime(item.checkOutAt, i18n.language, copy.none)}</DataTableCell>
                    <DataTableCell>{detailStatusLabel(item.status, item.lateMinutes, copy)}</DataTableCell>
                  </DataTableRow>
                ))}</DataTableBody>
              </DataTable>
            </DataTableShell>
          )}
        </div>
      </div>
    </div>
  );
}

function detailStatusLabel(status: AttendanceDashboardDetails["items"][number]["status"], lateMinutes: number | null, copy: Copy) {
  if (status === "ACTIVE") return copy.activeEmployees;
  if (status === "INSIDE") return copy.insideNow;
  if (status === "LATE") return lateMinutes ? `${copy.late} (${lateMinutes}m)` : copy.late;
  if (status === "ABSENT") return copy.absent;
  return copy.present;
}

function TodaySummary({ copy, language, summary }: DashboardSectionProps & { language: string }) {
  const scheduled = summary.employees.scheduledToday;
  const presentPct = scheduled > 0 ? Math.round((summary.attendance.present / scheduled) * 100) : 0;
  const absentPct = scheduled > 0 ? Math.round((summary.attendance.absent / scheduled) * 100) : 0;
  const presentSlice = Math.min(100, presentPct);
  return (
    <article className="dashboard-v2-panel dashboard-v2-summary">
      <PanelHeader title={copy.todaySummary} action={`${copy.today}: ${formatDate(summary.date, language)}`} />
      <div className="dashboard-v2-summary-grid">
        <div className="dashboard-v2-donut dashboard-v2-donut--summary" style={{ background: scheduled > 0 ? `conic-gradient(#10b981 0 ${presentSlice}%, #ef4444 ${presentSlice}% 100%)` : emptyDonut }}>
          <span><strong>{scheduled}</strong><small>{copy.scheduledToday}</small></span>
        </div>
        <div className="dashboard-v2-summary-metrics">
          <MetricRow label={copy.present} value={summary.attendance.present} subValue={`${presentPct}%`} tone="green" />
          <MetricRow label={copy.absent} value={summary.attendance.absent} subValue={`${absentPct}%`} tone="red" />
          <div className="dashboard-v2-inside-now">
            <span className="dashboard-v2-inline-icon"><IconUsersGroup className="h-5 w-5" stroke={1.8} /></span>
            <span><small>{copy.insideNow}</small><strong>{summary.attendance.insideNow}</strong></span>
          </div>
        </div>
      </div>
    </article>
  );
}

function WarningsPanel({ copy, summary }: DashboardSectionProps) {
  return (
    <article className="dashboard-v2-panel" data-testid="attendance-dashboard-warnings">
      <PanelHeader title={copy.warnings} action={`${copy.exceptions}: ${summary.trend.at(-1)?.exceptions ?? 0}`} />
      <div className="dashboard-v2-summary-metrics">
        <MetricRow label={copy.missingCheckout} value={summary.warnings.missingCheckout} tone={summary.warnings.missingCheckout ? "red" : "green"} />
        <MetricRow label={copy.multipleEvents} value={summary.warnings.multipleEvents} tone={summary.warnings.multipleEvents ? "red" : "green"} />
        <MetricRow label={copy.noShift} value={summary.warnings.noShift} tone={summary.warnings.noShift ? "red" : "green"} />
        <MetricRow label={copy.openSessions} value={summary.attendance.openSessions} tone="green" />
      </div>
    </article>
  );
}

function DevicePanel({ copy, language, summary }: DashboardSectionProps & { language: string }) {
  const online = summary.devices.online > 0;
  return (
    <article className="dashboard-v2-panel dashboard-v2-device" data-testid="attendance-dashboard-devices">
      <PanelHeader title={copy.devices} action={`${summary.devices.online}/${summary.devices.enabled} ${copy.online}`} />
      <div className="dashboard-v2-device-card">
        <span className="dashboard-v2-device-icon"><IconFingerprint className="h-6 w-6" stroke={1.8} /></span>
        <div className="dashboard-v2-device-title"><strong>{copy.devices}</strong><small>{copy.enabled}: {summary.devices.enabled}</small></div>
        <span className={`dashboard-v2-status ${online ? "is-online" : "is-offline"}`}>{online ? copy.online : copy.offline}</span>
      </div>
      <dl className="dashboard-v2-device-meta">
        <div><dt>{copy.lastSync}</dt><dd>{formatDateTime(summary.devices.lastSyncAt, language, copy.none)}</dd></div>
        <div><dt>{copy.lastEvent}</dt><dd>{formatDateTime(summary.devices.lastEventAt, language, copy.none)}</dd></div>
      </dl>
      <div className="dashboard-v2-device-online">
        <span><strong>{copy.devices}</strong><small>{copy.enabled}: {summary.devices.enabled}</small></span>
        <span>{online ? copy.online : copy.offline}</span>
      </div>
    </article>
  );
}

function WeeklyAttendance({ copy, language, summary }: DashboardSectionProps & { language: string }) {
  const points = [...summary.trend].reverse();
  const max = points.reduce((value, point) => Math.max(value, point.scheduled, point.present, point.absent), 0);
  return (
    <article className="dashboard-v2-panel" data-testid="attendance-dashboard-trend">
      <PanelHeader title={copy.trend} />
      {points.length ? <>
        <div className="dashboard-v2-bars-legend"><span><i className="is-green" />{copy.present}</span><span><i className="is-red" />{copy.absent}</span></div>
        <div className="dashboard-v2-bars">
          {points.map((point) => (
            <div className="dashboard-v2-bar-group" key={point.date} title={`${copy.present}: ${point.present}, ${copy.absent}: ${point.absent}`}>
              <div className="dashboard-v2-bar-pair">
                <span className="dashboard-v2-bar is-green" style={{ height: barHeight(point.present, max) }} />
                <span className="dashboard-v2-bar is-red" style={{ height: barHeight(point.absent, max) }} />
              </div>
              <small>{formatShortDate(point.date, language)}</small>
            </div>
          ))}
        </div>
      </> : <EmptyPanel text={copy.none} />}
    </article>
  );
}

function PunchSummary({ copy, summary }: DashboardSectionProps) {
  const accepted = Math.max(0, summary.punches.total - summary.punches.denied);
  const acceptedPct = summary.punches.total > 0 ? Math.round((accepted / summary.punches.total) * 100) : 0;
  return (
    <article className="dashboard-v2-panel" data-testid="attendance-dashboard-punches">
      <PanelHeader title={copy.punches} />
      <div className="dashboard-v2-reasons">
        <div className="dashboard-v2-donut dashboard-v2-donut--reasons" style={{ background: summary.punches.total > 0 ? `conic-gradient(#10b981 0 ${acceptedPct}%, #ef4444 ${acceptedPct}% 100%)` : emptyDonut }}>
          <span><strong>{summary.punches.total}</strong><small>{copy.totalPunches}</small></span>
        </div>
        <div className="dashboard-v2-reason-list">
          <ReasonRow color="#10b981" label={copy.accepted} value={accepted} />
          <ReasonRow color="#ef4444" label={copy.denied} value={summary.punches.denied} />
          <ReasonRow color="#f59e0b" label={copy.unknownIds} value={summary.punches.unknownIds} />
        </div>
      </div>
    </article>
  );
}

function AttendanceTrend({ copy, language, summary }: DashboardSectionProps & { language: string }) {
  const [activePointIndex, setActivePointIndex] = useState<number | null>(null);
  const points = [...summary.trend].reverse();
  const line = buildLine(points.map((point) => point.present));
  const activePoint = activePointIndex === null ? null : line.points[activePointIndex] ?? null;
  const activeTrendPoint = activePointIndex === null ? null : points[activePointIndex] ?? null;
  return (
    <article className="dashboard-v2-panel">
      <PanelHeader title={copy.attendanceTrend} action={`${copy.onTime}: ${summary.attendance.onTime}`} />
      {points.length ? <div className="dashboard-v2-line-chart">
        <svg
          viewBox="0 0 420 160"
          role="img"
          aria-label={copy.trend}
          onPointerMove={(event) => {
            if (line.points.length === 0) return;
            const rect = event.currentTarget.getBoundingClientRect();
            const x = ((event.clientX - rect.left) / rect.width) * 420;
            const nearestIndex = getNearestLinePointIndex(line.points, x);
            setActivePointIndex((current) => current === nearestIndex ? current : nearestIndex);
          }}
          onPointerLeave={() => setActivePointIndex(null)}
        >
          <path className="dashboard-v2-line-grid" d="M0 32H420M0 72H420M0 112H420" />
          {line.area ? <path className="dashboard-v2-line-area" d={line.area} /> : null}
          {line.path ? <path className="dashboard-v2-line-path" d={line.path} /> : null}
          <rect className="dashboard-v2-line-hover-zone" x="0" y="0" width="420" height="150" />
          {line.points.map((point, index) => {
            const trendPoint = points[index];
            const isActive = activePointIndex === index;
            return (
              <g
                aria-label={`${formatShortDate(trendPoint?.date ?? "", language)}, ${copy.present}: ${trendPoint?.present ?? 0}`}
                className={`dashboard-v2-peak-point has-value ${isActive ? "is-active" : ""}`}
                data-testid={`attendance-trend-point-${index}`}
                key={trendPoint?.date ?? index}
                onBlur={() => setActivePointIndex(null)}
                onFocus={() => setActivePointIndex(index)}
                tabIndex={0}
              >
                <circle className="dashboard-v2-peak-point-hit" cx={point.x} cy={point.y} r="13" />
                <circle className="dashboard-v2-peak-point-dot" cx={point.x} cy={point.y} r="3.4" />
              </g>
            );
          })}
          {activePoint && activeTrendPoint ? (
            <g className="dashboard-v2-peak-tooltip is-visible" data-testid="attendance-trend-tooltip" aria-hidden="true">
              {(() => {
                const tooltip = getLineTooltipBox(activePoint);
                return (
                  <>
                    <rect x={tooltip.x} y={tooltip.y} width={tooltip.width} height={tooltip.height} rx="10" />
                    <text x={tooltip.x + 12} y={tooltip.y + 19}>
                      <tspan className="dashboard-v2-peak-tooltip-title">{formatShortDate(activeTrendPoint.date, language)}</tspan>
                      <tspan className="dashboard-v2-peak-tooltip-value" x={tooltip.x + 12} dy="18">
                        {copy.present}: {activeTrendPoint.present}
                      </tspan>
                    </text>
                  </>
                );
              })()}
            </g>
          ) : null}
        </svg>
        <div className="dashboard-v2-line-labels">{points.map((point) => <span key={point.date}>{formatShortDate(point.date, language)}</span>)}</div>
      </div> : <EmptyPanel text={copy.none} />}
    </article>
  );
}

function PanelHeader({ action, title }: { action?: string; title: string }) {
  return <div className="dashboard-v2-panel-header"><h2>{title}</h2>{action ? <span className="dashboard-v2-panel-actions"><span className="dashboard-v2-panel-chip">{action}</span></span> : null}</div>;
}

function MetricRow({ label, subValue, tone, value }: { label: string; subValue?: string; tone: "green" | "red"; value: number }) {
  return <div className="dashboard-v2-metric-row"><span><i className={`is-${tone}`} />{label}</span><strong>{value}</strong>{subValue ? <small>{subValue}</small> : null}</div>;
}

function ReasonRow({ color, label, value }: { color: string; label: string; value: number }) {
  return <div className="dashboard-v2-reason"><span><i style={{ background: color }} />{label}</span><strong>{value}</strong></div>;
}

function EmptyPanel({ text }: { text: string }) { return <div className="dashboard-v2-empty">{text}</div>; }

function barHeight(value: number, max: number) { return max > 0 ? Math.max(4, Math.round((value / max) * 90)) : 0; }

function buildLine(values: number[]) {
  if (!values.length) return { area: "", path: "", points: [] as Array<{ x: number; y: number }> };
  const max = Math.max(...values, 1);
  const points = values.map((value, index) => ({ x: values.length === 1 ? 210 : (index / (values.length - 1)) * 420, y: 136 - (value / max) * 104 }));
  const path = points.map((point, index) => `${index ? "L" : "M"}${point.x.toFixed(2)} ${point.y.toFixed(2)}`).join(" ");
  return { area: `${path} L${points.at(-1)?.x ?? 0} 136 L${points[0]?.x ?? 0} 136 Z`, path, points };
}

function getLineTooltipBox(point: { x: number; y: number }) {
  const width = 112;
  const height = 48;
  const padding = 6;
  return {
    width,
    height,
    x: Math.min(420 - width - padding, Math.max(padding, point.x - width / 2)),
    y: Math.max(padding, point.y - height - 10),
  };
}

function getNearestLinePointIndex(points: Array<{ x: number }>, x: number) {
  return points.reduce((nearestIndex, point, index) => {
    const currentDistance = Math.abs(point.x - x);
    const nearestX = points[nearestIndex]?.x ?? 0;
    return currentDistance < Math.abs(nearestX - x) ? index : nearestIndex;
  }, 0);
}

function formatDate(value: string, language: string) {
  return new Intl.DateTimeFormat(language, { dateStyle: "medium", timeZone: "UTC" }).format(new Date(`${value}T00:00:00.000Z`));
}

function formatShortDate(value: string, language: string) {
  return new Intl.DateTimeFormat(language, { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${value}T00:00:00.000Z`));
}

function formatDateTime(value: string | null, language: string, fallback: string) {
  if (!value) return fallback;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? fallback : new Intl.DateTimeFormat(language, { dateStyle: "short", timeStyle: "short" }).format(date);
}

const emptyDonut = "conic-gradient(rgba(148, 163, 184, 0.22), rgba(148, 163, 184, 0.22))";
