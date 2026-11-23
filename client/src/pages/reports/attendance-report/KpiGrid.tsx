import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import type { DailyItem, Kpis } from "./types";

type KpiTone = "health" | "discipline" | "risk";
type KpiConfig = { key: keyof Kpis; tone: KpiTone };

const KPI_CONFIG: KpiConfig[] = [
  { key: "presentDays", tone: "health" },
  { key: "absentDays", tone: "health" },
  { key: "lateCount", tone: "discipline" },
  { key: "lateMinutes", tone: "discipline" },
  { key: "deniedCount", tone: "risk" },
  { key: "noCheckoutCount", tone: "risk" },
];

const STAFF_KPI_CONFIG: KpiConfig[] = [
  { key: "presentDays", tone: "health" }, { key: "absentDays", tone: "health" },
  { key: "lateCount", tone: "discipline" }, { key: "lateMinutes", tone: "discipline" },
  { key: "earlyLeaveCount", tone: "discipline" }, { key: "earlyLeaveMinutes", tone: "discipline" },
  { key: "overtimeMinutes", tone: "health" }, { key: "justifiedCount", tone: "health" },
  { key: "unscheduledPresentCount", tone: "discipline" }, { key: "deniedCount", tone: "risk" },
  { key: "noCheckoutCount", tone: "risk" },
];

export function KpiGrid({ kpis, trendData, loading, staffLabels }: { kpis: Kpis; trendData: DailyItem[]; loading: boolean; staffLabels?: Partial<Record<keyof Kpis, string>> }) {
  const { t, i18n } = useTranslation();
  const items = useMemo(
    () =>
      (staffLabels ? STAFF_KPI_CONFIG : KPI_CONFIG).map((item) => ({
        ...item,
        label: staffLabels?.[item.key] ?? resolveKpiLabel(item.key, t),
        value: kpis[item.key],
        spark: trendData.map((row) => Number(resolveSeriesValue(row, item.key))),
      })),
    [kpis, staffLabels, t, trendData]
  );

  const totalPresence = Math.max(1, kpis.presentDays + kpis.absentDays);

  return (
    <section className="report-kpi-grid grid gap-2.5 lg:grid-cols-2 xl:grid-cols-6">
      {items.map((item) => {
        const ratio =
          item.key === "presentDays"
            ? `${Math.round((kpis.presentDays / totalPresence) * 100)}%`
            : item.key === "absentDays"
              ? `${Math.round((kpis.absentDays / totalPresence) * 100)}%`
              : undefined;
        const toneClass =
          item.tone === "risk"
            ? "report-kpi-card--rose"
            : item.tone === "discipline"
              ? "report-kpi-card--amber"
              : "report-kpi-card--emerald";

        return (
          <article key={item.key} className={`report-kpi-card attendance-kpi-card ${toneClass}`}>
            {loading ? (
              <div className="animate-pulse space-y-2">
                <div className="h-2.5 w-20 rounded bg-slate-200 dark:bg-slate-700" />
                <div className="h-4 w-14 rounded bg-slate-200 dark:bg-slate-700" />
                <div className="h-7 w-full rounded bg-slate-200 dark:bg-slate-700" />
              </div>
            ) : (
              <>
                <p className="report-kpi-card__label">{item.label}</p>
                <div className="mt-1 flex items-end justify-between gap-2">
                  <p className="report-kpi-card__value">{formatNumber(item.value, i18n.language)}</p>
                  {ratio ? <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400">{ratio}</span> : null}
                </div>
                <div className="mt-1.5 h-7">
                  <Sparkline data={item.spark} tone={item.tone} />
                </div>
              </>
            )}
          </article>
        );
      })}
    </section>
  );
}

function resolveSeriesValue(row: DailyItem, key: keyof Kpis) {
  if (key === "presentDays") return row.presentCount;
  if (key === "absentDays") return row.absentCount;
  if (key === "lateCount") return row.lateCount;
  if (key === "lateMinutes") return row.lateMinutes;
  if (key === "deniedCount") return row.deniedCount;
  if (key === "noCheckoutCount") return row.noCheckoutCount;
  if (key === "earlyLeaveCount") return row.earlyLeaveCount;
  if (key === "earlyLeaveMinutes") return row.earlyLeaveMinutes;
  if (key === "overtimeMinutes") return row.overtimeMinutes;
  if (key === "justifiedCount") return row.justifiedCount;
  if (key === "unscheduledPresentCount") return row.unscheduledPresentCount;
  return 0;
}

function resolveKpiLabel(key: keyof Kpis, t: (value: string) => string) {
  if (key === "presentDays") return t("attendanceReport.kpis.presentDays");
  if (key === "absentDays") return t("attendanceReport.kpis.absentDays");
  if (key === "lateCount") return t("attendanceReport.kpis.lateCount");
  if (key === "lateMinutes") return t("attendanceReport.kpis.lateMinutes");
  if (key === "deniedCount") return t("attendanceReport.kpis.deniedAttempts");
  if (key === "noCheckoutCount") return t("attendanceReport.kpis.noCheckout");
  return key;
}

function Sparkline({ data, tone }: { data: number[]; tone: KpiTone }) {
  const safe = data.length ? data : [0, 0];
  const width = 120;
  const height = 28;
  const min = Math.min(...safe);
  const max = Math.max(...safe);
  const range = Math.max(1, max - min);

  const points = safe
    .map((value, index) => {
      const x = (index / Math.max(1, safe.length - 1)) * width;
      const y = height - ((value - min) / range) * height;
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");

  const lineColor = tone === "risk" ? "#e11d48" : tone === "discipline" ? "#d97706" : "#059669";
  const fillColor = tone === "risk" ? "rgba(225,29,72,0.15)" : tone === "discipline" ? "rgba(217,119,6,0.15)" : "rgba(5,150,105,0.15)";

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-full w-full">
      <polyline points={`0,${height} ${points} ${width},${height}`} fill={fillColor} stroke="none" />
      <polyline points={points} fill="none" stroke={lineColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function formatNumber(value: number, locale = "en") {
  return new Intl.NumberFormat(locale).format(value);
}
