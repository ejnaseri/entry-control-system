import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import type { TFunction } from "i18next";
import {
  IconCalendarClock,
  IconCash,
  IconDoorEnter,
  IconFingerprint,
  IconLogin,
  IconLogout,
  IconUsersGroup,
  IconWalk,
} from "@tabler/icons-react";
import { getDashboardDetails, getDashboardSummary, type DashboardDetailType, type DashboardDetails } from "../api/dashboard";
import { createDeviceEventStream, getDeviceEvents, getDeviceStatus, type DeviceEventItem, type DeviceHeartbeat } from "../api/devices";
import { useModalDismiss } from "../hooks/useModalDismiss";
import { useInbox } from "../components/inbox/InboxContext";
import { useToast } from "../components/ToastContext";
import { CloseIconButton } from "../components/CloseIconButton";
import {
  DataTable,
  DataTableBody,
  DataTableCell,
  DataTableHead,
  DataTableHeaderCell,
  DataTableRow,
  DataTableShell,
} from "../components/ui/DataTable";
import { formatAccessReason } from "../utils/accessReasons";
import { useAuth } from "../auth/AuthContext";

const DASHBOARD_SUMMARY_REFRESH_MS = 10000;
const DASHBOARD_DETAILS_REFRESH_MS = 15000;
const DEVICE_STATUS_REFRESH_MS = 5000;
const DEVICE_EVENT_REFRESH_DELAY_MS = 750;

export function DashboardHome() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { hasPermission } = useAuth();
  const queryClient = useQueryClient();
  const { push } = useToast();
  const { openInbox } = useInbox();
  const [statuses, setStatuses] = useState<DeviceHeartbeat[]>([]);
  const [liveEvents, setLiveEvents] = useState<DeviceEventItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detailsType, setDetailsType] = useState<DashboardDetailType | null>(null);
  const [activePeakIndex, setActivePeakIndex] = useState<number | null>(null);
  const detailsTypeRef = useRef<DashboardDetailType | null>(null);
  const eventRefreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const canViewDevices = hasPermission("DEVICES_VIEW");
  const canViewMembers = hasPermission("MEMBERS_VIEW");
  const canViewFinancial = hasPermission("FINANCIAL_REPORTS_VIEW");
  const canLoadDetails =
    detailsType === null ||
    detailsType === "insideNow" ||
    detailsType === "todaysEntries" ||
    ((detailsType === "activeMembers" || detailsType === "expiringSoon") && canViewMembers) ||
    ((detailsType === "debtors" || detailsType === "revenueToday") && canViewFinancial);

  const {
    data: summary,
    isLoading: summaryLoading,
    error: summaryError,
  } = useQuery({
    queryKey: ["dashboardSummary", "7d"],
    queryFn: () => getDashboardSummary("7d"),
    refetchInterval: DASHBOARD_SUMMARY_REFRESH_MS,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
    staleTime: 5000,
  });

  const {
    data: details,
    isLoading: detailsLoading,
    error: detailsError,
  } = useQuery({
    queryKey: ["dashboardDetails", detailsType],
    queryFn: () => getDashboardDetails(detailsType!, 20),
    enabled: Boolean(detailsType) && canLoadDetails,
    refetchInterval: detailsType ? DASHBOARD_DETAILS_REFRESH_MS : false,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
    staleTime: 5000,
  });

  const stats = useMemo(
    () => [
      {
        key: "activeMembers",
        label: t("stats.activeMembers"),
        value: formatValue(summary?.activeMembers.value),
        helper: t("dashboard.cards.activeMembersHelper", { defaultValue: "Active memberships" }),
        tone: "blue",
        icon: IconUsersGroup,
        detailType: "activeMembers" as DashboardDetailType,
      },
      {
        key: "insideNow",
        label: t("dashboard.cards.insideNow", { defaultValue: "Inside Now" }),
        value: formatValue(summary?.insideNow?.value),
        helper: t("dashboard.cards.realtime", { defaultValue: "Real-time" }),
        tone: "green",
        icon: IconWalk,
        detailType: "insideNow" as DashboardDetailType,
      },
      {
        key: "todaysEntries",
        label: t("stats.dailyAttendance"),
        value: formatValue((summary?.entriesSeries.points ?? []).at(-1)?.total ?? summary?.todaysEntries.value),
        helper: formatDeltaLabel(summary?.todaysEntries.deltaPct, t("dashboard.cards.vsYesterday", { defaultValue: "vs yesterday" })),
        tone: "purple",
        icon: IconDoorEnter,
        detailType: "todaysEntries" as DashboardDetailType,
      },
      {
        key: "revenueToday",
        label: t("dashboard.cards.revenueToday", { defaultValue: "Revenue Today" }),
        value: formatCurrency(summary?.revenueToday?.value, summary?.revenueToday?.currency),
        helper: formatDeltaLabel(summary?.revenueToday?.deltaPct, t("dashboard.cards.vsYesterday", { defaultValue: "vs yesterday" })),
        tone: "orange",
        icon: IconCash,
        detailType: "revenueToday" as DashboardDetailType,
      },
      {
        key: "expiringSoon",
        label: t("stats.expiringSoon"),
        value: formatValue(summary?.expiringSoon.value),
        helper: t("dashboard.cards.nextSevenDays", { defaultValue: "In next 7 days" }),
        tone: "red",
        icon: IconCalendarClock,
        detailType: "expiringSoon" as DashboardDetailType,
      },
    ].filter((card) => {
      if (card.key === "activeMembers" || card.key === "expiringSoon") return canViewMembers;
      if (card.key === "revenueToday") return canViewFinancial;
      return true;
    }),
    [canViewFinancial, canViewMembers, summary, t]
  );

  const series = summary?.entriesSeries.points ?? [];
  const chartSeries = [...series].reverse();
  const maxSeriesTotal = series.reduce((max, point) => (point.total > max ? point.total : max), 0);
  const peakDay = series.reduce<(typeof series)[number] | null>(
    (peak, point) => (!peak || point.total > peak.total ? point : peak),
    null
  );
  const todayPoint = series.length > 0 ? series[series.length - 1] ?? null : null;
  const todayAuthorized = todayPoint?.authorized ?? summary?.todaysEntries.value ?? 0;
  const todayDenied = todayPoint?.denied ?? 0;
  const todayTotal = todayPoint?.total ?? todayAuthorized + todayDenied;
  const todayAuthorizedPct = todayTotal > 0 ? Math.round((todayAuthorized / todayTotal) * 100) : 0;
  const todayDeniedPct = todayTotal > 0 ? 100 - todayAuthorizedPct : 0;
  const deniedReasons = summary?.deniedReasonsToday ?? [];
  const deniedTotal = deniedReasons.reduce((sum, item) => sum + item.count, 0);
  const deniedReasonGradient = buildConicGradient(
    deniedReasons.map((item) => item.pct),
    ["#ef4444", "#fb923c", "#facc15", "#94a3b8"],
    "rgba(148, 163, 184, 0.22)"
  );
  const peakHours = summary?.peakHoursToday ?? [];
  const peakHourMax = peakHours.reduce((max, point) => Math.max(max, point.total), 0);
  const peakLine = buildLineChartPath(peakHours, peakHourMax);
  const peakAxisLabels = buildPeakAxisLabels(peakHours);
  const activePeakPoint = activePeakIndex === null ? null : peakLine.points[activePeakIndex] ?? null;
  const onlineDevices = statuses.filter((device) => device.connected).length;

  const primaryDevice = useMemo(() => {
    if (statuses.length === 0) return null;
    return [...statuses].sort((a, b) => {
      if (a.connected !== b.connected) {
        return a.connected ? -1 : 1;
      }
      const aTime = a.lastPollAt ? new Date(a.lastPollAt).getTime() : 0;
      const bTime = b.lastPollAt ? new Date(b.lastPollAt).getTime() : 0;
      return bTime - aTime;
    })[0];
  }, [statuses]);

  useEffect(() => {
    detailsTypeRef.current = detailsType;
  }, [detailsType]);

  useEffect(() => {
    if (detailsType && !canLoadDetails) {
      setDetailsType(null);
    }
  }, [canLoadDetails, detailsType]);

  useEffect(() => {
    if (!canViewDevices) {
      setStatuses([]);
      setLiveEvents([]);
      setLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;

    const loadStatus = async () => {
      try {
        const s = await getDeviceStatus();
        if (!cancelled) setStatuses(s);
      } catch (err) {
        if (!cancelled) setError((err as Error).message);
      }
    };

    const loadInitialEvents = async () => {
      setLoading(true);
      setError(null);
      try {
        const ev = await getDeviceEvents(5);
        if (!cancelled) setLiveEvents(ev);
      } catch (err) {
        if (!cancelled) setError((err as Error).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    loadStatus();
    loadInitialEvents();
    const statusId = setInterval(loadStatus, DEVICE_STATUS_REFRESH_MS);
    const unsubscribe = createDeviceEventStream((ev) => {
      if (cancelled) return;
      setLiveEvents((prev) => [ev, ...prev].slice(0, 5));
      if (!eventRefreshTimerRef.current) {
        eventRefreshTimerRef.current = setTimeout(() => {
          eventRefreshTimerRef.current = null;
          void queryClient.invalidateQueries({ queryKey: ["dashboardSummary", "7d"] });
          const currentDetailsType = detailsTypeRef.current;
          if (currentDetailsType) {
            void queryClient.invalidateQueries({ queryKey: ["dashboardDetails", currentDetailsType] });
          }
        }, DEVICE_EVENT_REFRESH_DELAY_MS);
      }
    });

    return () => {
      cancelled = true;
      clearInterval(statusId);
      if (eventRefreshTimerRef.current) {
        clearTimeout(eventRefreshTimerRef.current);
        eventRefreshTimerRef.current = null;
      }
      unsubscribe();
    };
  }, [canViewDevices, queryClient]);

  useEffect(() => {
    if (error) {
      push({ kind: "error", title: error });
    }
  }, [error, push]);

  useEffect(() => {
    if (summaryError) {
      const message = summaryError instanceof Error ? summaryError.message : String(summaryError);
      push({ kind: "error", title: message });
    }
  }, [summaryError, push]);

  useEffect(() => {
    if (detailsError) {
      const message = detailsError instanceof Error ? detailsError.message : String(detailsError);
      push({ kind: "error", title: message });
    }
  }, [detailsError, push]);

  return (
    <div className="dashboard-v2">
      <section className="dashboard-v2-header">
        <div>
          <h1>{t("dashboard.overview.title", { defaultValue: "Dashboard" })}</h1>
          <p>{t("dashboard.overview.subtitle", { defaultValue: "Overview of today's activity" })}</p>
        </div>
      </section>

      <section className="dashboard-v2-kpis" aria-label={t("dashboard.overview.title", { defaultValue: "Dashboard" })}>
        {stats.map((card) => {
          const Icon = card.icon;
          const isClickable = Boolean(card.detailType);
          return (
            <div
              key={card.key}
              className={`dashboard-v2-stat dashboard-v2-stat--${card.tone} ${isClickable ? "is-clickable" : ""}`}
              role={isClickable ? "button" : undefined}
              tabIndex={isClickable ? 0 : undefined}
              onClick={card.detailType ? () => setDetailsType(card.detailType) : undefined}
              onKeyDown={(event) => {
                if (!card.detailType) return;
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  setDetailsType(card.detailType);
                }
              }}
            >
              <span className="dashboard-v2-stat-icon" aria-hidden>
                <Icon className="h-6 w-6" stroke={1.8} />
              </span>
              <span className="dashboard-v2-stat-copy">
                <span className="dashboard-v2-stat-label">{card.label}</span>
                <strong>{card.value}</strong>
                <small>{card.helper}</small>
              </span>
            </div>
          );
        })}
      </section>

      {detailsType ? (
        <DashboardDetailsModal
          type={detailsType}
          details={details}
          loading={detailsLoading}
          error={detailsError}
          onClose={() => setDetailsType(null)}
        />
      ) : null}

      <section className="dashboard-v2-main">
        <article className="dashboard-v2-panel dashboard-v2-summary">
          <PanelHeader title={t("dashboard.panels.todaySummary", { defaultValue: "Today's Summary" })} action={t("dashboard.panels.today", { defaultValue: "Today" })} />
          {summaryLoading || summaryError ? (
            <EmptyPanelMessage text={summaryLoading ? t("dashboard.chart.loading") : t("dashboard.chart.empty")} />
          ) : (
            <div className="dashboard-v2-summary-grid">
              <div
                className="dashboard-v2-donut dashboard-v2-donut--summary"
                style={{
                  background:
                    todayTotal > 0
                      ? `conic-gradient(#10b981 0 ${todayAuthorizedPct}%, #ef4444 ${todayAuthorizedPct}% 100%)`
                      : "conic-gradient(rgba(148, 163, 184, 0.22), rgba(148, 163, 184, 0.22))",
                }}
              >
                <span>
                  <strong>{formatValue(todayTotal)}</strong>
                  <small>{t("dashboard.panels.totalEntries", { defaultValue: "Total Entries" })}</small>
                </span>
              </div>
              <div className="dashboard-v2-summary-metrics">
                <MetricRow
                  label={t("dashboard.chart.authorized")}
                  value={formatValue(todayAuthorized)}
                  subValue={`${todayAuthorizedPct}%`}
                  tone="green"
                />
                <MetricRow label={t("dashboard.chart.denied")} value={formatValue(todayDenied)} subValue={`${todayDeniedPct}%`} tone="red" />
                <div className="dashboard-v2-inside-now">
                  <span className="dashboard-v2-inline-icon">
                    <IconUsersGroup className="h-5 w-5" stroke={1.8} />
                  </span>
                  <span>
                    <small>{t("dashboard.cards.insideNow", { defaultValue: "Currently Inside" })}</small>
                    <strong>{formatValue(summary?.insideNow?.value)}</strong>
                  </span>
                </div>
              </div>
            </div>
          )}
        </article>

        {canViewDevices ? <article className="dashboard-v2-panel dashboard-v2-live">
          <PanelHeader
            title={t("dashboard.liveEvents.title")}
            action={t("activity.viewAll")}
            onAction={() => openInbox("deviceFeed")}
            busy={loading ? t("dashboard.liveEvents.updating") : undefined}
          />
          <div className="dashboard-v2-event-list">
            {liveEvents.length > 0 ? (
              liveEvents.slice(0, 5).map((event, index) => {
                const tone = getEventTone(event);
                const EventIcon = event.authorized ? (event.entryType === "OUT" ? IconLogout : IconLogin) : IconFingerprint;
                return (
                  <div className="dashboard-v2-event" key={event.id ?? `${event.externalUserId ?? "unknown"}-${index}`}>
                    <span className="dashboard-v2-avatar">{getInitials(event.memberName, event.memberCode, event.externalUserId)}</span>
                    <span className={`dashboard-v2-event-icon dashboard-v2-event-icon--${tone}`}>
                      <EventIcon className="h-4 w-4" stroke={1.9} />
                    </span>
                    <span className="dashboard-v2-event-copy">
                      <strong>
                        {event.memberName ||
                          (event.memberCode
                            ? t("dashboard.liveEvents.userLabel", { code: event.memberCode })
                            : t("dashboard.liveEvents.unknownUser"))}
                      </strong>
                      <small>
                        {event.authorized
                          ? event.entryType === "OUT"
                            ? t("dashboard.events.exit", { defaultValue: "Exit" })
                            : t("dashboard.events.entry", { defaultValue: "Entry" })
                          : formatAccessReason(event.reason ?? "UNKNOWN", t)}
                      </small>
                    </span>
                    <span className={`dashboard-v2-event-badge dashboard-v2-event-badge--${tone}`}>{getEventBadge(event, t)}</span>
                    <time>{formatRelativeTime(event.timestamp || event.recordedAt, t)}</time>
                  </div>
                );
              })
            ) : (
              <EmptyPanelMessage text={t("dashboard.liveEvents.empty")} />
            )}
          </div>
        </article> : null}

        {canViewDevices ? <article className="dashboard-v2-panel dashboard-v2-device">
          <PanelHeader
            title={t("dashboard.deviceMonitor.title", { defaultValue: "Device Status" })}
            action={canViewDevices ? t("activity.viewAll") : undefined}
            onAction={canViewDevices ? () => navigate("/devices") : undefined}
          />
          {primaryDevice ? (
            <>
              <div className="dashboard-v2-device-card">
                <span className="dashboard-v2-device-icon">
                  <IconFingerprint className="h-6 w-6" stroke={1.8} />
                </span>
                <div className="dashboard-v2-device-title">
                  <strong>{t("dashboard.deviceMonitor.mainEntrance", { defaultValue: "Main Entrance" })}</strong>
                  <small>{t("dashboard.deviceMonitor.deviceId")}: {primaryDevice.id}</small>
                </div>
                <span className={`dashboard-v2-status ${primaryDevice.connected ? "is-online" : "is-offline"}`}>
                  {primaryDevice.connected ? t("dashboard.deviceMonitor.connected") : t("dashboard.deviceMonitor.disconnected")}
                </span>
              </div>
              <dl className="dashboard-v2-device-meta">
                <div>
                  <dt>{t("dashboard.deviceMonitor.lastSeen")}</dt>
                  <dd>{formatRelativeTime(primaryDevice.lastPollAt, t)}</dd>
                </div>
                <div>
                  <dt>{t("dashboard.deviceMonitor.lastEvent")}</dt>
                  <dd>{formatRelativeTime(primaryDevice.lastEventAt, t)}</dd>
                </div>
              </dl>
              {primaryDevice.lastError ? (
                <p className="dashboard-v2-device-error">
                  {t("dashboard.deviceMonitor.errorLabel")}: {primaryDevice.lastError}
                </p>
              ) : null}
              <div className="dashboard-v2-device-online">
                <span>
                  <strong>{t("dashboard.deviceMonitor.otherDevices", { defaultValue: "All Other Devices" })}</strong>
                  <small>
                    {t("dashboard.deviceMonitor.onlineSummary", {
                      defaultValue: "{{online}} of {{total}} devices are online",
                      online: onlineDevices,
                      total: statuses.length,
                    })}
                  </small>
                </span>
                <span>{primaryDevice.connected ? t("dashboard.deviceMonitor.online", { defaultValue: "Online" }) : t("dashboard.deviceMonitor.disconnected")}</span>
              </div>
            </>
          ) : (
            <EmptyPanelMessage text={t("dashboard.deviceMonitor.noDevice")} />
          )}
        </article> : null}
      </section>

      <section className="dashboard-v2-secondary">
        <article className="dashboard-v2-panel">
          <PanelHeader title={t("dashboard.panels.weeklyAttendance", { defaultValue: "Weekly Attendance" })} />
          <div className="dashboard-v2-bars-legend">
            <span><i className="is-green" />{t("dashboard.chart.authorized")}</span>
            <span><i className="is-red" />{t("dashboard.chart.denied")}</span>
          </div>
          <div className="dashboard-v2-bars">
            {chartSeries.map((point) => {
              const authorizedHeight = maxSeriesTotal > 0 ? Math.max(4, Math.round((point.authorized / maxSeriesTotal) * 90)) : 0;
              const deniedHeight = maxSeriesTotal > 0 ? Math.max(4, Math.round((point.denied / maxSeriesTotal) * 90)) : 0;
              const isPeak = peakDay?.label === point.label && point.total > 0;
              return (
                <div className={`dashboard-v2-bar-group ${isPeak ? "is-peak" : ""}`} key={point.label}>
                  <div className="dashboard-v2-bar-pair">
                    <span className="dashboard-v2-bar is-green" style={{ height: authorizedHeight }} />
                    <span className="dashboard-v2-bar is-red" style={{ height: deniedHeight }} />
                  </div>
                  <small>{point.label}</small>
                </div>
              );
            })}
          </div>
        </article>

        <article className="dashboard-v2-panel">
          <PanelHeader title={t("dashboard.panels.deniedReasons", { defaultValue: "Denied Access Reasons" })} />
          <div className="dashboard-v2-reasons">
            <div className="dashboard-v2-donut dashboard-v2-donut--reasons" style={{ background: deniedReasonGradient }}>
              <span>
                <strong>{formatValue(deniedTotal)}</strong>
                <small>{t("dashboard.panels.total", { defaultValue: "Total" })}</small>
              </span>
            </div>
            <div className="dashboard-v2-reason-list">
              {deniedReasons.length > 0 ? (
                deniedReasons.map((reason, index) => (
                  <div className="dashboard-v2-reason" key={`${reason.reason}-${index}`}>
                    <span><i style={{ background: DENIED_REASON_COLORS[index] ?? "#94a3b8" }} />{formatAccessReason(reason.reason, t)}</span>
                    <strong>{formatValue(reason.count)} ({reason.pct}%)</strong>
                  </div>
                ))
              ) : (
                <EmptyPanelMessage text={t("dashboard.panels.noDeniedReasons", { defaultValue: "No denied access today." })} />
              )}
            </div>
          </div>
        </article>

        <article className="dashboard-v2-panel">
          <PanelHeader title={t("dashboard.panels.peakHours", { defaultValue: "Peak Hours" })} />
          <div className="dashboard-v2-line-chart">
            <svg
              viewBox="0 0 420 160"
              role="img"
              aria-label={t("dashboard.panels.peakHours", { defaultValue: "Peak Hours" })}
              onPointerMove={(event) => {
                if (peakLine.points.length === 0) return;
                const rect = event.currentTarget.getBoundingClientRect();
                const x = ((event.clientX - rect.left) / rect.width) * 420;
                const nearestIndex = getNearestPeakPointIndex(peakLine.points, x);
                setActivePeakIndex((current) => (current === nearestIndex ? current : nearestIndex));
              }}
              onPointerLeave={() => setActivePeakIndex(null)}
            >
              <path className="dashboard-v2-line-grid" d="M0 32H420M0 72H420M0 112H420" />
              {peakLine.area ? <path className="dashboard-v2-line-area" d={peakLine.area} /> : null}
              {peakLine.line ? <path className="dashboard-v2-line-path" d={peakLine.line} /> : null}
              <rect className="dashboard-v2-line-hover-zone" x="0" y="0" width="420" height="150" />
              {peakLine.points.map((point, index) => {
                const entriesLabel = t("dashboard.panels.entries", { defaultValue: "Entries" });
                const isActive = activePeakIndex === index;
                return (
                  <g
                    key={`${point.label}-${point.total}`}
                    className={`dashboard-v2-peak-point ${point.total > 0 ? "has-value" : ""} ${isActive ? "is-active" : ""}`}
                    tabIndex={0}
                    aria-label={`${point.label}, ${entriesLabel}: ${formatValue(point.total)}`}
                    onFocus={() => setActivePeakIndex(index)}
                    onBlur={() => setActivePeakIndex(null)}
                  >
                    <circle className="dashboard-v2-peak-point-hit" cx={point.x} cy={point.y} r="13" />
                    <circle className="dashboard-v2-peak-point-dot" cx={point.x} cy={point.y} r="3.4" />
                  </g>
                );
              })}
              {activePeakPoint ? (
                <g className="dashboard-v2-peak-tooltip is-visible" aria-hidden="true">
                  {(() => {
                    const tooltip = getPeakTooltipBox(activePeakPoint);
                    const entriesLabel = t("dashboard.panels.entries", { defaultValue: "Entries" });
                    return (
                      <>
                        <rect x={tooltip.x} y={tooltip.y} width={tooltip.width} height={tooltip.height} rx="10" />
                        <text x={tooltip.x + 12} y={tooltip.y + 19}>
                          <tspan className="dashboard-v2-peak-tooltip-title">{activePeakPoint.label}</tspan>
                          <tspan className="dashboard-v2-peak-tooltip-value" x={tooltip.x + 12} dy="18">
                            {entriesLabel}: {formatValue(activePeakPoint.total)}
                          </tspan>
                        </text>
                      </>
                    );
                  })()}
                </g>
              ) : null}
            </svg>
            <div className="dashboard-v2-line-labels">
              {peakAxisLabels.map((label) => (
                <span key={label}>{label}</span>
              ))}
            </div>
          </div>
        </article>
      </section>
    </div>
  );
}

const DENIED_REASON_COLORS = ["#ef4444", "#fb923c", "#facc15", "#94a3b8"];

function PanelHeader({
  title,
  action,
  busy,
  onAction,
}: {
  title: string;
  action?: string;
  busy?: string;
  onAction?: () => void;
}) {
  return (
    <div className="dashboard-v2-panel-header">
      <h2>{title}</h2>
      <span className="dashboard-v2-panel-actions">
        {busy ? <small>{busy}</small> : null}
        {action ? (
          onAction ? (
            <button type="button" onClick={onAction}>
              {action}
            </button>
          ) : (
            <span className="dashboard-v2-panel-chip">{action}</span>
          )
        ) : null}
      </span>
    </div>
  );
}

function EmptyPanelMessage({ text }: { text: string }) {
  return <div className="dashboard-v2-empty">{text}</div>;
}

function MetricRow({ label, value, subValue, tone }: { label: string; value: string; subValue: string; tone: "green" | "red" }) {
  return (
    <div className="dashboard-v2-metric-row">
      <span>
        <i className={`is-${tone}`} />
        {label}
      </span>
      <strong>{value}</strong>
      <small>{subValue}</small>
    </div>
  );
}

function DashboardDetailsModal({
  type,
  details,
  loading,
  error,
  onClose,
}: {
  type: DashboardDetailType;
  details?: DashboardDetails;
  loading: boolean;
  error: unknown;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const titleMap: Record<DashboardDetailType, string> = {
    activeMembers: t("stats.activeMembers"),
    insideNow: t("dashboard.cards.insideNow", { defaultValue: "Inside Now" }),
    expiringSoon: t("stats.expiringSoon"),
    debtors: t("stats.debtors"),
    revenueToday: t("dashboard.cards.revenueToday", { defaultValue: "Revenue Today" }),
    todaysEntries: t("stats.dailyAttendance"),
  };
  const total = details?.total ?? 0;
  const showing = details?.items?.length ?? 0;
  const emptyMessage = getDashboardEmptyMessage(type, total, t);
  const summaryLabel = showing
    ? t("dashboard.details.summaryWithShowing", { total, showing })
    : t("dashboard.details.summary", { total });
  useModalDismiss(onClose);

  return (
    <div className="modal-overlay fixed inset-0 z-40 flex items-start justify-center bg-slate-950/45 p-4 backdrop-blur-[2px] sm:p-6" onClick={onClose}>
      <div
        className="dashboard-details-modal flex w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-slate-800/80 bg-slate-950/90 bg-[radial-gradient(1200px_circle_at_top_right,_rgba(42,116,255,0.12),_transparent_55%)] p-4 shadow-2xl shadow-black/40 backdrop-blur-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-white">{titleMap[type]}</p>
            <p className="text-[11px] text-slate-400">{summaryLabel}</p>
          </div>
          <CloseIconButton label={t("common.actions.close")} onClick={onClose} />
        </div>

        <div className="mt-3 min-h-[120px] flex-1 overflow-y-auto pr-1">
          {loading ? (
            <div className="rounded-xl border border-slate-800/80 bg-slate-900/40 p-3 text-[11px] text-slate-300">
              {t("common.messages.loading")}
            </div>
          ) : error || !details || showing === 0 ? (
            <div className="rounded-xl border border-slate-800/80 bg-slate-900/40 p-3 text-[11px] text-slate-300">{emptyMessage}</div>
          ) : details.type === "activeMembers" ? (
            <DataTableShell>
              <DataTable variant="compact" minWidth="660px">
                <DataTableHead>
                  <DataTableRow>
                    <DataTableHeaderCell>{t("attendance.table.member")}</DataTableHeaderCell>
                    <DataTableHeaderCell>{t("members.table.code")}</DataTableHeaderCell>
                    <DataTableHeaderCell>{t("members.table.phone")}</DataTableHeaderCell>
                    <DataTableHeaderCell>{t("common.labels.plan")}</DataTableHeaderCell>
                    <DataTableHeaderCell>{t("members.table.expireDate")}</DataTableHeaderCell>
                  </DataTableRow>
                </DataTableHead>
                <DataTableBody>
                  {details.items.map((item) => (
                    <DataTableRow key={item.memberId}>
                      <DataTableCell className="font-semibold">{item.fullName}</DataTableCell>
                      <DataTableCell>{item.code}</DataTableCell>
                      <DataTableCell>{item.phone ?? "-"}</DataTableCell>
                      <DataTableCell>{item.planName ?? "-"}</DataTableCell>
                      <DataTableCell>{formatShortDate(item.endDate)}</DataTableCell>
                    </DataTableRow>
                  ))}
                </DataTableBody>
              </DataTable>
            </DataTableShell>
          ) : details.type === "expiringSoon" ? (
            <DataTableShell>
              <DataTable variant="compact" minWidth="760px">
                <DataTableHead>
                  <DataTableRow>
                    <DataTableHeaderCell>{t("attendance.table.member")}</DataTableHeaderCell>
                    <DataTableHeaderCell>{t("members.table.code")}</DataTableHeaderCell>
                    <DataTableHeaderCell>{t("members.table.phone")}</DataTableHeaderCell>
                    <DataTableHeaderCell>{t("common.labels.plan")}</DataTableHeaderCell>
                    <DataTableHeaderCell>{t("members.table.expireDate")}</DataTableHeaderCell>
                    <DataTableHeaderCell align="end">{t("common.labels.daysLeft")}</DataTableHeaderCell>
                  </DataTableRow>
                </DataTableHead>
                <DataTableBody>
                  {details.items.map((item) => (
                    <DataTableRow key={item.memberId}>
                      <DataTableCell className="font-semibold">{item.fullName}</DataTableCell>
                      <DataTableCell>{item.code}</DataTableCell>
                      <DataTableCell>{item.phone ?? "-"}</DataTableCell>
                      <DataTableCell>{item.planName ?? "-"}</DataTableCell>
                      <DataTableCell>{formatShortDate(item.endDate)}</DataTableCell>
                      <DataTableCell align="end">{item.daysLeft}</DataTableCell>
                    </DataTableRow>
                  ))}
                </DataTableBody>
              </DataTable>
            </DataTableShell>
          ) : details.type === "debtors" ? (
            <DataTableShell>
              <DataTable variant="compact" minWidth="560px">
                <DataTableHead>
                  <DataTableRow>
                    <DataTableHeaderCell>{t("attendance.table.member")}</DataTableHeaderCell>
                    <DataTableHeaderCell>{t("members.table.code")}</DataTableHeaderCell>
                    <DataTableHeaderCell>{t("members.table.phone")}</DataTableHeaderCell>
                    <DataTableHeaderCell align="end">{t("common.labels.debt")}</DataTableHeaderCell>
                  </DataTableRow>
                </DataTableHead>
                <DataTableBody>
                  {details.items.map((item) => (
                    <DataTableRow key={item.memberId}>
                      <DataTableCell className="font-semibold">{item.fullName}</DataTableCell>
                      <DataTableCell>{item.code}</DataTableCell>
                      <DataTableCell>{item.phone ?? "-"}</DataTableCell>
                      <DataTableCell align="end">{item.debtAmount.toLocaleString()}</DataTableCell>
                    </DataTableRow>
                  ))}
                </DataTableBody>
              </DataTable>
            </DataTableShell>
          ) : details.type === "revenueToday" ? (
            <DataTableShell>
              <DataTable variant="compact" minWidth="760px">
                <DataTableHead>
                  <DataTableRow>
                    <DataTableHeaderCell>{t("attendance.table.member")}</DataTableHeaderCell>
                    <DataTableHeaderCell>{t("members.table.code")}</DataTableHeaderCell>
                    <DataTableHeaderCell>{t("attendance.table.time")}</DataTableHeaderCell>
                    <DataTableHeaderCell align="end">{t("common.labels.amount", { defaultValue: "Amount" })}</DataTableHeaderCell>
                    <DataTableHeaderCell>{t("common.labels.method", { defaultValue: "Method" })}</DataTableHeaderCell>
                    <DataTableHeaderCell>{t("common.labels.reference", { defaultValue: "Reference" })}</DataTableHeaderCell>
                  </DataTableRow>
                </DataTableHead>
                <DataTableBody>
                  {details.items.map((item) => (
                    <DataTableRow key={item.id}>
                      <DataTableCell className="font-semibold">{item.memberName}</DataTableCell>
                      <DataTableCell>{item.memberCode}</DataTableCell>
                      <DataTableCell>{formatShortTime(item.paidAt ?? item.createdAt)}</DataTableCell>
                      <DataTableCell align="end">{formatCurrency(item.amount, item.currency)}</DataTableCell>
                      <DataTableCell>{item.method}</DataTableCell>
                      <DataTableCell>{item.reference ?? "-"}</DataTableCell>
                    </DataTableRow>
                  ))}
                </DataTableBody>
              </DataTable>
            </DataTableShell>
          ) : (
            <DataTableShell>
              <DataTable variant="compact" minWidth="560px">
                <DataTableHead>
                  <DataTableRow>
                    <DataTableHeaderCell>{t("attendance.table.member")}</DataTableHeaderCell>
                    <DataTableHeaderCell>{t("members.table.code")}</DataTableHeaderCell>
                    <DataTableHeaderCell>{t("attendance.table.time")}</DataTableHeaderCell>
                    <DataTableHeaderCell>{t("attendance.table.type")}</DataTableHeaderCell>
                  </DataTableRow>
                </DataTableHead>
                <DataTableBody>
                  {details.items.map((item) => (
                    <DataTableRow key={item.id}>
                      <DataTableCell className="font-semibold">
                        {item.memberName ??
                          (item.memberCode
                            ? t("dashboard.details.userLabel", { code: item.memberCode })
                            : item.externalUserId
                              ? t("dashboard.details.deviceLabel", { id: item.externalUserId })
                              : t("common.labels.unknown"))}
                      </DataTableCell>
                      <DataTableCell>{item.memberCode ?? item.externalUserId ?? "-"}</DataTableCell>
                      <DataTableCell>{formatShortTime(item.recordedAt)}</DataTableCell>
                      <DataTableCell>{formatDashboardEntryType(item.entryType, t)}</DataTableCell>
                    </DataTableRow>
                  ))}
                </DataTableBody>
              </DataTable>
            </DataTableShell>
          )}
        </div>
      </div>
    </div>
  );
}

function formatValue(value?: number) {
  if (value === undefined || value === null) {
    return "-";
  }
  return value.toLocaleString();
}

function formatCurrency(value?: number, currency = "AFN") {
  if (value === undefined || value === null) return "-";
  return `${value.toLocaleString()} ${currency}`;
}

function formatDeltaLabel(deltaPct: number | null | undefined, context: string) {
  if (deltaPct === undefined || deltaPct === null) return context;
  const sign = deltaPct > 0 ? "+" : "";
  return `${sign}${deltaPct.toFixed(1)}% ${context}`;
}

function buildConicGradient(percentages: number[], colors: string[], fallback: string) {
  if (percentages.length === 0 || percentages.every((value) => value <= 0)) {
    return `conic-gradient(${fallback}, ${fallback})`;
  }
  let cursor = 0;
  const stops = percentages.map((value, index) => {
    const start = cursor;
    const end = index === percentages.length - 1 ? 100 : Math.min(100, cursor + value);
    cursor = end;
    return `${colors[index] ?? fallback} ${start}% ${end}%`;
  });
  return `conic-gradient(${stops.join(", ")})`;
}

function buildLineChartPath(points: Array<{ label: string; total: number }>, maxValue: number) {
  if (points.length === 0) return { line: "", area: "", points: [] as Array<{ label: string; total: number; x: number; y: number }> };
  const width = 420;
  const height = 150;
  const top = 14;
  const bottom = 132;
  const step = points.length > 1 ? width / (points.length - 1) : width;
  const coords = points.map((point, index) => {
    const x = Math.round(index * step * 10) / 10;
    const ratio = maxValue > 0 ? Math.min(1, point.total / maxValue) : 0;
    const y = Math.round((bottom - ratio * (bottom - top)) * 10) / 10;
    return { ...point, x, y };
  });
  const line = maxValue > 0 ? coords.map((point, index) => `${index === 0 ? "M" : "L"}${point.x} ${point.y}`).join(" ") : "";
  const first = coords[0];
  const last = coords[coords.length - 1];
  const area = maxValue > 0 && first && last ? `${line} L${last.x} ${height} L${first.x} ${height} Z` : "";
  return { line, area, points: coords };
}

function buildPeakAxisLabels(points: Array<{ label: string }>) {
  if (points.length <= 3) {
    return points.map((point) => point.label);
  }
  return points
    .filter((_, index) => index === 0 || index === points.length - 1 || index % 6 === 0)
    .map((point) => point.label);
}

function getPeakTooltipBox(point: { x: number; y: number }) {
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

function getNearestPeakPointIndex(points: Array<{ x: number }>, x: number) {
  return points.reduce((nearestIndex, point, index) => {
    const currentDistance = Math.abs(point.x - x);
    const nearestX = points[nearestIndex]?.x ?? 0;
    const nearestDistance = Math.abs(nearestX - x);
    return currentDistance < nearestDistance ? index : nearestIndex;
  }, 0);
}

function getEventTone(event: DeviceEventItem) {
  if (!event.authorized) return "denied";
  return event.entryType === "OUT" ? "exit" : "entry";
}

function getEventBadge(event: DeviceEventItem, t: TFunction) {
  if (!event.authorized) return t("dashboard.liveEvents.denied");
  if (event.entryType === "OUT") return t("dashboard.events.exit", { defaultValue: "Exit" });
  return t("dashboard.events.entry", { defaultValue: "Entry" });
}

function getInitials(name?: string, code?: string, externalId?: string) {
  if (name) {
    const initials = name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0])
      .join("");
    return initials || name.slice(0, 1);
  }
  if (code) return code.slice(0, 2).toUpperCase();
  if (externalId) return String(externalId).slice(0, 2).toUpperCase();
  return "?";
}

function formatDashboardEntryType(entryType: string, t: TFunction) {
  return entryType === "OUT"
    ? t("dashboard.events.exit", { defaultValue: "Exit" })
    : t("dashboard.events.entry", { defaultValue: "Entry" });
}

function formatRelativeTime(value: string | undefined, t: TFunction) {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "-";
  const diffMs = Date.now() - parsed.getTime();
  if (diffMs < 0) return parsed.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const seconds = Math.floor(diffMs / 1000);
  if (seconds < 60) return t("dashboard.relative.secondsAgo", { count: seconds, defaultValue: "{{count}}s ago" });
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return t("dashboard.relative.minutesAgo", { count: minutes, defaultValue: "{{count}}m ago" });
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return t("dashboard.relative.hoursAgo", { count: hours, defaultValue: "{{count}}h ago" });
  return parsed.toLocaleDateString();
}

function formatShortDate(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "-";
  return parsed.toLocaleDateString();
}

function formatShortTime(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "-";
  return parsed.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function getDashboardEmptyMessage(
  type: DashboardDetailType,
  total: number,
  t: (key: string, options?: Record<string, unknown>) => string
) {
  if (total > 0) return t("dashboard.details.empty");
  if (type === "activeMembers") return t("dashboard.details.noActiveMembers");
  if (type === "insideNow") return t("dashboard.details.noInsideNow", { defaultValue: "No one is inside right now." });
  if (type === "expiringSoon") return t("dashboard.details.noExpiring");
  if (type === "debtors") return t("dashboard.details.noDebtors");
  if (type === "revenueToday") return t("dashboard.details.noRevenueToday", { defaultValue: "No revenue recorded today." });
  return t("dashboard.details.noEntries");
}
