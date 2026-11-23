import { useId, type ReactNode, type SVGProps } from "react";

export const REPORT_FILTER_FIELD_CLASS =
  "attendance-report-filter-control h-9 w-full rounded-xl px-2.5 text-[12px] outline-none transition duration-200";
export const REPORT_FILTER_LABEL_CLASS = "attendance-report-filter-label text-[11px] font-semibold tracking-[0.02em]";
export const REPORT_FILTER_ACTION_CLASS =
  "attendance-report-filter-control inline-flex h-9 items-center justify-center rounded-lg px-3 text-[11px] font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/25 disabled:cursor-not-allowed disabled:opacity-45";
export const REPORT_FILTER_PANEL_CLASS =
  "attendance-report-filters rounded-2xl border border-slate-200/90 bg-white/90 p-3 shadow-sm dark:border-slate-800/90 dark:bg-slate-950/70";
export const REPORT_FILTER_GRID_CLASS = "attendance-report-filters__grid mt-1 grid gap-2.5 rounded-xl p-3";

const REPORT_FILTER_TOGGLE_CLASS =
  "attendance-report-filter-toggle inline-flex h-8 items-center gap-1.5 rounded-full px-2.5 text-[11px] font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/25";

type ReportFiltersPanelProps = {
  open: boolean;
  onToggle: () => void;
  toggleLabel: string;
  activeFiltersCount?: number;
  actions?: ReactNode;
  children?: ReactNode;
  className?: string;
  gridClassName?: string;
  panelId?: string;
};

const DEFAULT_PANEL_CLASS = REPORT_FILTER_PANEL_CLASS;
const DEFAULT_TOOLBAR_CLASS = "attendance-report-filters__toolbar flex flex-wrap items-center justify-between gap-2 pb-2";
const DEFAULT_GRID_CLASS = `${REPORT_FILTER_GRID_CLASS} sm:grid-cols-2 xl:grid-cols-6`;

export function ReportFiltersPanel({
  open,
  onToggle,
  toggleLabel,
  activeFiltersCount = 0,
  actions,
  children,
  className,
  gridClassName,
  panelId,
}: ReportFiltersPanelProps) {
  const generatedId = useId();
  const contentId = panelId ?? `report-filters-${generatedId.replace(/:/gu, "")}`;

  return (
    <section className={`${DEFAULT_PANEL_CLASS} ${className ?? ""}`.trim()}>
      <div className={DEFAULT_TOOLBAR_CLASS}>
        <button
          type="button"
          className={`${REPORT_FILTER_TOGGLE_CLASS} ${open ? "is-open" : ""}`}
          onClick={onToggle}
          aria-expanded={open}
          aria-controls={contentId}
        >
          <span className="attendance-report-filter-toggle__icon" aria-hidden="true">
            <FiltersToggleIcon className="h-3 w-3" />
          </span>
          <span>{toggleLabel}</span>
          {activeFiltersCount ? (
            <span className="attendance-report-filter-count inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-semibold">
              {activeFiltersCount}
            </span>
          ) : null}
        </button>

        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>

      {open ? <div id={contentId} className={gridClassName ?? DEFAULT_GRID_CLASS}>{children}</div> : null}
    </section>
  );
}

export function ReportFilterField({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <label className={`flex min-w-0 flex-col gap-1 ${className ?? ""}`}>
      <span className={REPORT_FILTER_LABEL_CLASS}>{label}</span>
      {children}
    </label>
  );
}

function FiltersToggleIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} {...props}>
      <path d="M4 6h16l-6.5 7.2v4.9l-3 1.7v-6.6L4 6Z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
