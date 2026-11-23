import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import type { DailyItem } from "./types";

export function TrendPanel({ dailySeries, loading }: { dailySeries: DailyItem[]; loading: boolean }) {
  const { t, i18n } = useTranslation();
  const lateSeries = useMemo(
    () => dailySeries.map((item) => ({ label: item.date.slice(5), date: item.date, value: item.lateMinutes })),
    [dailySeries]
  );
  const riskSeries = useMemo(() => dailySeries.map((item) => ({ label: item.date.slice(5), value: item.deniedCount })), [dailySeries]);
  const presentSeries = useMemo(
    () => dailySeries.map((item) => ({ label: item.date.slice(5), date: item.date, present: item.presentCount, absent: item.absentCount })),
    [dailySeries]
  );

  return (
    <section className="grid gap-2.5 lg:grid-cols-2">
      <article className="rounded-2xl border border-slate-200/90 bg-white/90 p-3 shadow-sm dark:border-slate-800/90 dark:bg-slate-950/70">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{t("attendanceReport.trend.lateMinutesOverTime")}</h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">{t("attendanceReport.trend.lateMinutesHint")}</p>
          </div>
          {!loading ? <Badge value={t("attendanceReport.trend.totalMinutes", { value: formatNumber(sum(lateSeries.map((item) => item.value)), i18n.language) })} tone="warning" /> : null}
        </div>
        <div className="mt-2.5">
          {loading ? (
            <SkeletonChart />
          ) : (
            <LineSpark
              data={lateSeries}
              color="#d97706"
              noDataLabel={t("attendanceReport.trend.noTrendData")}
              valueSuffix={t("attendanceReport.common.minuteShort")}
              locale={i18n.language}
            />
          )}
        </div>
      </article>

      <article className="rounded-2xl border border-slate-200/90 bg-white/90 p-3 shadow-sm dark:border-slate-800/90 dark:bg-slate-950/70">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{t("attendanceReport.trend.presentVsAbsent")}</h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">{t("attendanceReport.trend.presentVsAbsentHint")}</p>
          </div>
          {!loading ? <Badge value={t("attendanceReport.trend.deniedTotal", { value: formatNumber(sum(riskSeries.map((item) => item.value)), i18n.language) })} tone="risk" /> : null}
        </div>
        <div className="mt-2.5">
          {loading ? (
            <SkeletonChart />
          ) : (
            <StackedBars
              data={presentSeries}
              noDataLabel={t("attendanceReport.trend.noTrendData")}
              locale={i18n.language}
            />
          )}
        </div>
      </article>
    </section>
  );
}

function LineSpark({
  data,
  color,
  noDataLabel,
  valueSuffix,
  locale,
}: {
  data: Array<{ label: string; date?: string; value: number }>;
  color: string;
  noDataLabel: string;
  valueSuffix?: string;
  locale?: string;
}) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  if (!data.length) return <EmptyTrend label={noDataLabel} />;

  const width = 520;
  const height = 130;
  const values = data.map((item) => item.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = Math.max(1, max - min);

  const pointsData = data
    .map((item, index) => {
      const x = (index / Math.max(1, data.length - 1)) * width;
      const y = height - ((item.value - min) / range) * (height - 20) - 10;
      return { ...item, x, y };
    });
  const points = pointsData
    .map((item) => `${item.x.toFixed(1)},${item.y.toFixed(1)}`)
    .join(" ");
  const hovered = hoveredIndex !== null ? pointsData[hoveredIndex] : null;
  const tooltipX = hovered ? Math.min(width - 72, Math.max(72, hovered.x)) : null;

  return (
    <div className="space-y-2">
      <div className="relative">
        {hovered && tooltipX !== null ? (
          <div
            className="pointer-events-none absolute z-10 rounded-lg border border-slate-200/90 bg-white/95 px-2 py-1 text-[10px] shadow-lg dark:border-slate-700 dark:bg-slate-900/95"
            style={{ left: `${(tooltipX / width) * 100}%`, top: 0, transform: "translate(-50%, -100%)" }}
          >
            <div className="font-semibold text-slate-700 dark:text-slate-200">{hovered.date ?? hovered.label}</div>
            <div className="text-slate-500 dark:text-slate-300">
              {formatNumber(hovered.value, locale)} {valueSuffix ?? ""}
            </div>
          </div>
        ) : null}
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="h-28 w-full"
          onMouseLeave={() => setHoveredIndex(null)}
        >
          <defs>
            <linearGradient id="late-fill" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity="0.32" />
              <stop offset="100%" stopColor={color} stopOpacity="0.04" />
            </linearGradient>
          </defs>
          {hovered ? (
            <line
              x1={hovered.x}
              y1={8}
              x2={hovered.x}
              y2={height}
              stroke={color}
              strokeOpacity={0.22}
              strokeWidth={1}
              strokeDasharray="3 3"
            />
          ) : null}
          <polyline points={`0,${height} ${points} ${width},${height}`} fill="url(#late-fill)" />
          <polyline points={points} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          {hovered ? <circle cx={hovered.x} cy={hovered.y} r={3.5} fill={color} stroke="white" strokeWidth={1.25} /> : null}
          {pointsData.map((point, index) => {
            const previous = pointsData[index - 1];
            const next = pointsData[index + 1];
            const left = previous ? (previous.x + point.x) / 2 : 0;
            const right = next ? (point.x + next.x) / 2 : width;
            return (
              <rect
                key={`${point.label}-${index}`}
                x={left}
                y={0}
                width={Math.max(1, right - left)}
                height={height}
                fill="transparent"
                onMouseEnter={() => setHoveredIndex(index)}
                onMouseMove={() => setHoveredIndex(index)}
              />
            );
          })}
        </svg>
      </div>
      <div className="flex items-center justify-between text-[10px] text-slate-500 dark:text-slate-400">
        <span>{data[0]?.label}</span>
        <span>{data[data.length - 1]?.label}</span>
      </div>
    </div>
  );
}

function StackedBars({
  data,
  noDataLabel,
  locale,
}: {
  data: Array<{ label: string; date?: string; present: number; absent: number }>;
  noDataLabel: string;
  locale?: string;
}) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  if (!data.length) return <EmptyTrend label={noDataLabel} />;

  const max = Math.max(1, ...data.map((item) => item.present + item.absent));
  const hovered = hoveredIndex !== null ? data[hoveredIndex] : null;
  const tooltipX = hoveredIndex !== null ? Math.min(data.length - 1, Math.max(0, hoveredIndex)) : null;

  return (
    <div className="space-y-2">
      <div className="relative">
        {hovered && tooltipX !== null ? (
          <div
            className="pointer-events-none absolute z-10 rounded-lg border border-slate-200/90 bg-white/95 px-2 py-1 text-[10px] shadow-lg dark:border-slate-700 dark:bg-slate-900/95"
            style={{ left: `${((tooltipX + 0.5) / data.length) * 100}%`, top: 0, transform: "translate(-50%, -100%)" }}
          >
            <div className="font-semibold text-slate-700 dark:text-slate-200">{hovered.date ?? hovered.label}</div>
            <div className="text-emerald-600 dark:text-emerald-300">Present: {formatNumber(hovered.present, locale)}</div>
            <div className="text-rose-600 dark:text-rose-300">Absent: {formatNumber(hovered.absent, locale)}</div>
          </div>
        ) : null}
        <div
          className="grid h-28 items-stretch gap-px"
          style={{ gridTemplateColumns: `repeat(${data.length}, minmax(0, 1fr))` }}
          onMouseLeave={() => setHoveredIndex(null)}
        >
          {data.map((item, index) => {
            const presentHeight = item.present > 0 ? Math.max(3, (item.present / max) * 100) : 0;
            const absentHeight = item.absent > 0 ? Math.max(3, (item.absent / max) * 100) : 0;
            return (
              <div
                key={`${item.label}-${index}`}
                className={`flex h-full min-h-0 cursor-pointer flex-col justify-end transition-opacity ${
                  hoveredIndex === null || hoveredIndex === index ? "opacity-100" : "opacity-60"
                }`}
                onMouseEnter={() => setHoveredIndex(index)}
                onMouseMove={() => setHoveredIndex(index)}
              >
                <div className="w-full rounded-t-sm bg-rose-400/60" style={{ height: `${absentHeight}%` }} />
                <div className="w-full rounded-t-sm bg-emerald-500/70" style={{ height: `${presentHeight}%` }} />
              </div>
            );
          })}
        </div>
      </div>
      <div className="flex items-center justify-between text-[10px] text-slate-500 dark:text-slate-400">
        <span>{data[0]?.label}</span>
        <span>{data[data.length - 1]?.label}</span>
      </div>
    </div>
  );
}

function Badge({ value, tone }: { value: string; tone: "warning" | "risk" }) {
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
        tone === "risk"
          ? "border border-rose-300 bg-rose-100 text-rose-700 dark:border-rose-800 dark:bg-rose-900/30 dark:text-rose-200"
          : "border border-amber-300 bg-amber-100 text-amber-700 dark:border-amber-800 dark:bg-amber-900/30 dark:text-amber-200"
      }`}
    >
      {value}
    </span>
  );
}

function SkeletonChart() {
  return <div className="h-28 animate-pulse rounded-xl bg-slate-200/70 dark:bg-slate-800/70" />;
}

function EmptyTrend({ label }: { label: string }) {
  return <div className="grid h-28 place-items-center rounded-xl border border-dashed border-slate-300 text-[11px] text-slate-500 dark:border-slate-700 dark:text-slate-400">{label}</div>;
}

function sum(values: number[]) {
  return values.reduce((total, value) => total + value, 0);
}

function formatNumber(value: number, locale = "en") {
  return new Intl.NumberFormat(locale).format(value);
}
