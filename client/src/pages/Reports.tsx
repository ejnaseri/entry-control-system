import { useCallback, useEffect, useMemo, useRef, useState, type Ref, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import {
  IconArrowLeft,
  IconArrowUpRight,
  IconArrowsDiff,
  IconCalendarClock,
  IconCalendarDue,
  IconChartLine,
  IconClockDollar,
  IconCreditCardPay,
  IconIdBadge,
  IconShieldCheck,
  IconUserCheck,
  IconUsersGroup,
  IconWallet,
} from "@tabler/icons-react";
import { getReportsDashboardSummary } from "../api/dashboard";
import { getMembers, type Member } from "../api/members";
import { getPayrollReport, type PayrollReportItem } from "../api/payroll";
import { resolveDateLocale, resolveGregorianMonthLocale } from "../shared/dateLocale";
import { MemberStatusBadge } from "../components/members/MemberStatusBadge";
import { useToast } from "../components/ToastContext";
import { useGlobalLoading, useGlobalLoadingController } from "../components/GlobalLoadingContext";
import { CloseIconButton } from "../components/CloseIconButton";
import { rtlLanguages } from "../i18n/config";
import { MembershipReportTab } from "./reports/MembershipReportTab";
import { ReportPager } from "../components/reports/ReportPager";
import { LocalizedMonthInput } from "../components/ui/LocalizedMonthInput";
import { useAuth } from "../auth/AuthContext";
import {
  DataTable,
  DataTableBody,
  DataTableCell,
  DataTableEmptyRow,
  DataTableHead,
  DataTableHeaderCell,
  DataTableRow,
  DataTableShell,
} from "../components/ui/DataTable";

const CARD_CLASS =
  "rounded-2xl border border-slate-200/80 bg-white/80 p-3 text-slate-900 shadow-sm dark:border-slate-800/80 dark:bg-slate-950/70 dark:text-slate-100";
const INPUT_CLASS =
  "form-input h-9 rounded-lg border border-slate-200 bg-white/90 px-3 text-[11px] text-slate-900 placeholder:text-slate-400 dark:border-slate-700/60 dark:bg-slate-900/70 dark:text-slate-100 dark:placeholder:text-slate-500";
const LABEL_CLASS = "text-xs font-semibold text-slate-600 dark:text-slate-300";

const PAGE_SIZE = 20;
const SUMMARY_PLACEHOLDER = "-";
type ReportAccent = "emerald" | "sky" | "amber" | "violet" | "rose" | "cyan" | "indigo";
type ReportSummaryTone = "sky" | "emerald" | "amber" | "indigo";

const REPORT_ACCENT_CLASS: Record<ReportAccent, string> = {
  emerald: "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-200",
  sky: "border-sky-500/30 bg-sky-500/10 text-sky-600 dark:text-sky-200",
  amber: "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-200",
  violet: "border-cyan-500/40 bg-cyan-500/12 text-cyan-700 dark:border-cyan-300/60 dark:bg-cyan-500/22 dark:text-cyan-100",
  rose: "border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-200",
  cyan: "border-cyan-500/30 bg-cyan-500/10 text-cyan-600 dark:text-cyan-200",
  indigo: "border-teal-500/40 bg-teal-500/12 text-teal-700 dark:border-teal-300/60 dark:bg-teal-500/22 dark:text-teal-100",
};

const REPORT_SUMMARY_TONE_CLASS: Record<
  ReportSummaryTone,
  {
    icon: string;
    accent: string;
  }
> = {
  sky: {
    icon: "border-sky-500/30 bg-sky-500/10 text-sky-600 dark:text-sky-200",
    accent: "bg-sky-400/70 dark:bg-sky-300/70",
  },
  emerald: {
    icon: "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-200",
    accent: "bg-emerald-400/70 dark:bg-emerald-300/70",
  },
  amber: {
    icon: "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-200",
    accent: "bg-amber-400/70 dark:bg-amber-300/70",
  },
  indigo: {
    icon: "border-teal-500/45 bg-teal-500/15 text-teal-700 dark:border-teal-300/65 dark:bg-teal-500/25 dark:text-teal-100",
    accent: "bg-teal-500/80 dark:bg-teal-300/90",
  },
};

export function Reports() {
  const { t, i18n } = useTranslation();
  const { hasPermission } = useAuth();
  const navigate = useNavigate();
  const canViewAttendance = hasPermission("ATTENDANCE_VIEW");
  const canViewMembers = hasPermission("MEMBERS_VIEW");
  const canViewFinancial = hasPermission("FINANCIAL_REPORTS_VIEW");
  const canManagePayroll = hasPermission("PAYROLL_MANAGE");
  const { startLoading, stopLoading } = useGlobalLoadingController();
  const isRtl = rtlLanguages.includes(i18n.language.split("-")[0]);
  const [activeReport, setActiveReport] = useState<"payroll" | "membership" | null>(null);
  const transientLoadingIdsRef = useRef<string[]>([]);
  const {
    data: reportsSummary,
    isLoading: reportsSummaryLoading,
    isError: reportsSummaryError,
    isFetching: reportsSummaryRefreshing,
    refetch: refetchReportsSummary,
  } = useQuery({
    queryKey: ["reportsDashboardSummary"],
    queryFn: () => getReportsDashboardSummary(),
    staleTime: 60_000,
    enabled: canViewFinancial,
  });

  const reportsSummaryUpdatedAt = reportsSummary?.generatedAt ? formatTime(reportsSummary.generatedAt, i18n.language) : null;
  const startReportTransitionLoading = useCallback(
    (subtitle: string) => {
      const id = startLoading({
        delayMs: 0,
        message: t("common.messages.loading"),
        minDurationMs: 260,
        subtitle,
      });
      transientLoadingIdsRef.current.push(id);

      window.setTimeout(() => {
        stopLoading(id);
        transientLoadingIdsRef.current = transientLoadingIdsRef.current.filter((currentId) => currentId !== id);
      }, 650);
    },
    [startLoading, stopLoading, t]
  );

  useEffect(
    () => () => {
      transientLoadingIdsRef.current.forEach((id) => stopLoading(id));
      transientLoadingIdsRef.current = [];
    },
    [stopLoading]
  );

  const openRouteReport = useCallback(
    (to: string, subtitle: string) => {
      startReportTransitionLoading(subtitle);
      navigate(to);
    },
    [navigate, startReportTransitionLoading]
  );

  const openInlineReport = useCallback(
    (report: "payroll" | "membership", subtitle: string) => {
      startReportTransitionLoading(subtitle);
      setActiveReport(report);
    },
    [startReportTransitionLoading]
  );

  return (
    <div className="reports-page space-y-4" dir={isRtl ? "rtl" : "ltr"} data-testid="reports-page">
      {activeReport ? (
        <div className={CARD_CLASS}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-slate-900 dark:text-white">{t("reportsPage.title")}</h2>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">{t("reportsPage.subtitle")}</p>
            </div>
            <button
              type="button"
              data-testid="reports-back"
              onClick={() => setActiveReport(null)}
              className="report-back-btn inline-flex items-center gap-2 rounded-full px-3 py-1 text-[11px] font-semibold shadow-sm transition"
            >
              <span className={`${isRtl ? "rotate-180" : ""}`}>
                <IconArrowLeft className="h-3.5 w-3.5" stroke={1.9} />
              </span>
              {t("reportsPage.backButton")}
            </button>
          </div>
        </div>
      ) : null}

      {!activeReport && canViewFinancial ? (
        <section className="rounded-2xl border border-slate-200/80 bg-white/95 p-2.5 shadow-sm dark:border-slate-800/80 dark:bg-slate-950/70">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">{t("reports.summary.title")}</h3>
            {reportsSummaryUpdatedAt ? (
              <p className="inline-flex items-center gap-1 text-[10px] text-slate-500 dark:text-slate-400">
                {t("reports.summary.updatedAt", { time: reportsSummaryUpdatedAt })}
                {reportsSummaryRefreshing ? <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> : null}
              </p>
            ) : null}
          </div>

          {reportsSummaryError ? (
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-[11px] text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-300">
              <span>{t("reports.summary.loadError")}</span>
              <button
                type="button"
                onClick={() => void refetchReportsSummary()}
                disabled={reportsSummaryRefreshing}
                className="rounded-lg border border-rose-300 bg-white px-2.5 py-1 text-[10px] font-semibold text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-200 dark:hover:bg-rose-900/40"
              >
                {t("reports.summary.retry")}
              </button>
            </div>
          ) : null}

          <div className="mt-2.5 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
            <ManagementSummaryCard
              label={t("reports.summary.activeMembers")}
              value={reportsSummaryLoading && !reportsSummary ? SUMMARY_PLACEHOLDER : formatCount(reportsSummary?.activeMembers ?? 0, i18n.language)}
              hint={t("reports.summary.today")}
              tone="sky"
              icon={<IconUsersGroup className="h-5 w-5" stroke={1.8} />}
            />
            <ManagementSummaryCard
              label={t("reports.summary.totalPaidThisMonth")}
              value={reportsSummaryLoading && !reportsSummary ? SUMMARY_PLACEHOLDER : formatMoney(reportsSummary?.totalPaidThisMonth ?? 0, i18n.language)}
              hint={t("reports.summary.thisMonth")}
              tone="emerald"
              icon={<IconCreditCardPay className="h-5 w-5" stroke={1.8} />}
            />
            <ManagementSummaryCard
              label={t("reports.summary.expiringThisWeek")}
              value={reportsSummaryLoading && !reportsSummary ? SUMMARY_PLACEHOLDER : formatCount(reportsSummary?.expiringThisWeek ?? 0, i18n.language)}
              hint={t("reports.summary.thisWeek")}
              tone="amber"
              icon={<IconCalendarDue className="h-5 w-5" stroke={1.8} />}
            />
            <ManagementSummaryCard
              label={t("reports.summary.staffPresentToday")}
              value={reportsSummaryLoading && !reportsSummary ? SUMMARY_PLACEHOLDER : formatCount(reportsSummary?.staffPresentToday ?? 0, i18n.language)}
              hint={t("reports.summary.today")}
              tone="indigo"
              icon={<IconUserCheck className="h-5 w-5" stroke={1.8} />}
            />
          </div>
        </section>
      ) : null}

      {activeReport ? (
        <div className="rounded-2xl border border-slate-200/80 bg-white/80 dark:border-slate-800/80 dark:bg-slate-950/70">
          <div className="p-3">
            {activeReport === "payroll" ? <PayrollReportTab /> : null}
            {activeReport === "membership" ? <MembershipReportTab /> : null}
          </div>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {canViewAttendance ? <ReportCard
            title={t("reportsPage.cards.attendance.title")}
            description={t("reportsPage.cards.attendance.description")}
            onClick={() => openRouteReport("/reports/attendance", t("reportsPage.cards.attendance.title"))}
            icon={<IconCalendarClock className="h-5 w-5" stroke={1.8} />}
            accent="sky"
          /> : null}
          {canViewMembers ? <ReportCard
            title={t("reportsPage.cards.customerActivity.title")}
            description={t("reportsPage.cards.customerActivity.description")}
            onClick={() => openRouteReport("/reports/customer-activity", t("reportsPage.cards.customerActivity.title"))}
            icon={<IconUsersGroup className="h-5 w-5" stroke={1.8} />}
            accent="indigo"
          /> : null}
          {canViewFinancial ? <ReportCard
            title={t("reportsPage.cards.membership.title")}
            description={t("reportsPage.cards.membership.description")}
            onClick={() => openInlineReport("membership", t("reportsPage.cards.membership.title"))}
            icon={<IconIdBadge className="h-5 w-5" stroke={1.8} />}
            accent="violet"
            testId="reports-open-membership"
          /> : null}
          {canViewFinancial ? <ReportCard
            title={t("reportsPage.cards.renewalForecast.title")}
            description={t("reportsPage.cards.renewalForecast.description")}
            onClick={() => openRouteReport("/reports/renewal-forecast", t("reportsPage.cards.renewalForecast.title"))}
            icon={<IconChartLine className="h-5 w-5" stroke={1.8} />}
            accent="cyan"
          /> : null}
          {canViewFinancial ? <ReportCard
            title={t("reportsPage.cards.debtAging.title")}
            description={t("reportsPage.cards.debtAging.description")}
            onClick={() => openRouteReport("/reports/debt-aging", t("reportsPage.cards.debtAging.title"))}
            icon={<IconClockDollar className="h-5 w-5" stroke={1.8} />}
            accent="amber"
          /> : null}
          {canManagePayroll ? <ReportCard
            title={t("reportsPage.cards.payroll.title")}
            description={t("reportsPage.cards.payroll.description")}
            onClick={() => openInlineReport("payroll", t("reportsPage.cards.payroll.title"))}
            icon={<IconWallet className="h-5 w-5" stroke={1.8} />}
            accent="emerald"
            testId="reports-open-payroll"
          /> : null}
          {canManagePayroll ? <ReportCard
            title={t("reportsPage.cards.payrollVariance.title")}
            description={t("reportsPage.cards.payrollVariance.description")}
            onClick={() => openRouteReport("/reports/payroll-variance", t("reportsPage.cards.payrollVariance.title"))}
            icon={<IconArrowsDiff className="h-5 w-5" stroke={1.8} />}
            accent="rose"
          /> : null}
          {canViewFinancial ? <ReportCard
            title={t("reportsPage.cards.cashflow.title")}
            description={t("reportsPage.cards.cashflow.description")}
            onClick={() => openRouteReport("/reports/cashflow", t("reportsPage.cards.cashflow.title"))}
            icon={<IconChartLine className="h-5 w-5" stroke={1.8} />}
            accent="emerald"
          /> : null}
          {canViewAttendance ? <ReportCard
            title={t("reportsPage.cards.attendanceCompliance.title")}
            description={t("reportsPage.cards.attendanceCompliance.description")}
            onClick={() => openRouteReport("/reports/attendance-compliance", t("reportsPage.cards.attendanceCompliance.title"))}
            icon={<IconShieldCheck className="h-5 w-5" stroke={1.8} />}
            accent="indigo"
          /> : null}
        </div>
      )}
    </div>
  );
}

function ReportCard({
  title,
  description,
  icon,
  accent,
  disabled,
  onClick,
  testId,
}: {
  title: string;
  description: string;
  icon: ReactNode;
  accent: ReportAccent;
  disabled?: boolean;
  onClick?: () => void;
  testId?: string;
}) {
  const accentClass = REPORT_ACCENT_CLASS[accent];

  return (
    <button
      type="button"
      data-testid={testId}
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      className={`group relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white/80 p-4 text-start shadow-sm transition-all duration-200 ease-out ${
        disabled
          ? "cursor-not-allowed text-slate-400 dark:text-slate-500"
          : "text-slate-900 hover:-translate-y-1 hover:border-slate-300 hover:shadow-xl hover:ring-1 hover:ring-brand-500/20 dark:text-white dark:hover:shadow-[0_18px_45px_rgba(0,0,0,0.6)]"
      } dark:border-slate-800/80 dark:bg-slate-950/70`}
    >
      <div className="absolute -right-6 -top-6 h-20 w-20 rounded-full bg-brand-500/10 blur-2xl transition-transform duration-300 group-hover:scale-110" />
      <div className="relative flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className={`grid h-10 w-10 place-items-center rounded-2xl border transition-transform duration-200 group-hover:scale-105 ${accentClass}`}>
            {icon}
          </span>
          <div>
            <p className="text-sm font-semibold">{title}</p>
            <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">{description}</p>
          </div>
        </div>
        {!disabled ? (
          <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-brand-500/40 bg-brand-500/80 text-[#fff] transition group-hover:translate-x-0.5 group-hover:bg-brand-500">
            <IconArrowUpRight className="h-[18px] w-[18px]" stroke={1.9} />
          </span>
        ) : null}
      </div>
    </button>
  );
}

function ManagementSummaryCard({
  label,
  value,
  hint,
  tone,
  icon,
}: {
  label: string;
  value: string;
  hint: string;
  tone: ReportSummaryTone;
  icon: ReactNode;
}) {
  const toneClass = REPORT_SUMMARY_TONE_CLASS[tone];
  return (
    <div className="rounded-xl border border-slate-200/80 bg-white/80 p-2.5 dark:border-slate-800/70 dark:bg-slate-950/60">
      <div className="flex items-start justify-between gap-2">
        <p className="text-[11px] font-medium text-slate-700 dark:text-slate-300">{label}</p>
        <span className={`grid h-10 w-10 place-items-center rounded-2xl border ${toneClass.icon}`}>{icon}</span>
      </div>
      <p className="mt-1.5 text-sm font-semibold tracking-tight text-slate-900 dark:text-white">{value}</p>
      <p className="mt-1 text-[10px] uppercase tracking-wide text-slate-500 dark:text-slate-400">{hint}</p>
      <div className={`mt-2 h-0.5 w-12 rounded-full ${toneClass.accent}`} />
    </div>
  );
}

function MemberSelectModal({
  open,
  title,
  placeholder,
  query,
  members,
  loading,
  onQueryChange,
  onSelect,
  onSelectAll,
  onClose,
  inputRef,
  emptyLabel,
  allLabel,
}: {
  open: boolean;
  title: string;
  placeholder: string;
  query: string;
  members: Member[];
  loading: boolean;
  onQueryChange: (value: string) => void;
  onSelect: (member: Member) => void;
  onSelectAll?: () => void;
  onClose: () => void;
  inputRef?: Ref<HTMLInputElement>;
  emptyLabel: string;
  allLabel?: string;
}) {
  const { t } = useTranslation();
  if (!open) return null;
  return (
    <div className="modal-overlay fixed inset-0 z-40 flex items-center justify-center bg-black/60 p-4 sm:p-6" onClick={onClose}>
      <div
        className="w-full max-w-3xl rounded-2xl border border-slate-200/80 bg-white p-4 text-slate-900 shadow-2xl shadow-black/20 dark:border-slate-800/80 dark:bg-slate-950 dark:text-slate-100 dark:shadow-black/40"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-xs font-semibold text-slate-900 dark:text-white">{title}</h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">{placeholder}</p>
          </div>
          <CloseIconButton label={t("common.actions.close")} size="sm" onClick={onClose} />
        </div>

        <div className="mt-3 space-y-3">
          {onSelectAll && allLabel ? (
            <button
              type="button"
              onClick={() => {
                onSelectAll();
                onClose();
              }}
              className="flex w-full items-center justify-between rounded-xl border border-slate-200/80 bg-white/80 px-3 py-2 text-[11px] font-semibold text-slate-800 transition hover:border-slate-300 hover:bg-slate-50 dark:border-slate-800/70 dark:bg-slate-950/60 dark:text-slate-200 dark:hover:border-slate-700 dark:hover:bg-slate-900/50"
            >
              <span>{allLabel}</span>
              <span className="text-slate-400">✓</span>
            </button>
          ) : null}
          <input
            type="search"
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder={placeholder}
            className={INPUT_CLASS}
            ref={inputRef}
          />
          {loading ? (
            <p className="text-[11px] text-slate-500 dark:text-slate-400">...</p>
          ) : members.length === 0 ? (
            <p className="text-[11px] text-slate-500 dark:text-slate-400">{emptyLabel}</p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {members.map((member) => (
                <button
                  key={member.id}
                  type="button"
                  onClick={() => onSelect(member)}
                  className="rounded-xl border border-slate-200/80 bg-white/80 p-3 text-start text-[11px] text-slate-800 transition hover:border-slate-300 hover:bg-slate-50 dark:border-slate-800/70 dark:bg-slate-950/60 dark:text-slate-200 dark:hover:border-slate-700 dark:hover:bg-slate-900/50"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-xs font-semibold text-slate-900 dark:text-white">{formatMemberName(member)}</p>
                      {member.customTitle || member.roleType ? (
                        <p className="mt-0.5 text-[10px] text-slate-500 dark:text-slate-400">{member.customTitle ?? member.roleType}</p>
                      ) : null}
                    </div>
                    <MemberStatusBadge status={member.status} />
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2 text-[10px] text-slate-500 dark:text-slate-400">
                    <span>#{member.code}</span>
                    {member.phone ? <span>{member.phone}</span> : null}
                    {member.email ? <span className="truncate">{member.email}</span> : null}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function PayrollReportTab() {
  const { t, i18n } = useTranslation();
  const { push } = useToast();
  const locale = i18n.language;
  const [memberQuery, setMemberQuery] = useState("");
  const [members, setMembers] = useState<Member[]>([]);
  const [membersLoading, setMembersLoading] = useState(true);
  const [membersError, setMembersError] = useState<string | null>(null);
  const [memberId, setMemberId] = useState("");
  const [memberModalOpen, setMemberModalOpen] = useState(false);
  const [monthValue, setMonthValue] = useState(() => toMonthInputValue(new Date()));
  const [reportItems, setReportItems] = useState<PayrollReportItem[]>([]);
  const [reportTotal, setReportTotal] = useState(0);
  const [totalPaid, setTotalPaid] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [detailItem, setDetailItem] = useState<PayrollReportItem | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const parsedMonth = useMemo(() => parseMonthInput(monthValue), [monthValue]);

  useGlobalLoading(loading, {
    delayMs: 0,
    message: t("common.messages.loading"),
    subtitle: t("reportsPage.cards.payroll.title"),
  });

  useEffect(() => {
    let active = true;
    const handle = setTimeout(() => {
      getMembers({
        search: memberQuery.trim() || undefined,
        take: 20,
        memberType: "STAFF",
      })
        .then(({ data }) => {
          if (!active) return;
          setMembers(data.items);
        })
        .catch((err) => {
          if (!active) return;
          setMembersError(err instanceof Error ? err.message : t("members.errors.loadFailed"));
        })
        .finally(() => {
          if (!active) return;
          setMembersLoading(false);
        });
    }, 300);
    return () => {
      active = false;
      clearTimeout(handle);
    };
  }, [memberQuery, t]);

  const selectedMember = useMemo(() => members.find((member) => member.id === memberId) ?? null, [memberId, members]);

  const updateMemberQuery = (value: string) => {
    setMemberQuery(value);
    setMembersLoading(true);
    setMembersError(null);
  };

  const updateSelectedMember = (value: string) => {
    setLoading(true);
    setError(null);
    setMemberId(value);
    setPage(0);
  };

  const updateMonthValue = (value: string) => {
    setMonthValue(value);
    setPage(0);
    if (parseMonthInput(value)) {
      setLoading(true);
      setError(null);
    } else {
      setLoading(false);
      setError(null);
      setReportItems([]);
      setReportTotal(0);
      setTotalPaid(0);
    }
  };

  useEffect(() => {
    if (!parsedMonth) return;
    let active = true;
    getPayrollReport({
      year: parsedMonth.year,
      month: parsedMonth.month,
      memberId: memberId || undefined,
      skip: page * PAGE_SIZE,
      take: PAGE_SIZE,
    })
      .then(({ data }) => {
        if (!active) return;
        setReportItems(data.items);
        setReportTotal(data.total);
        setTotalPaid(data.summary.totalPaid);
      })
      .catch((err) => {
        if (!active) return;
        setError(err instanceof Error ? err.message : t("reportsPage.payroll.error"));
        setReportItems([]);
      })
      .finally(() => {
        if (!active) return;
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [memberId, monthValue, page, t, parsedMonth]);

  useEffect(() => {
    if (error) {
      push({ kind: "error", title: error });
    }
  }, [error, push]);

  useEffect(() => {
    if (membersError) {
      push({ kind: "error", title: membersError });
    }
  }, [membersError, push]);

  useEffect(() => {
    if (!memberModalOpen) return;
    const handle = setTimeout(() => {
      searchInputRef.current?.focus();
    }, 0);
    return () => clearTimeout(handle);
  }, [memberModalOpen]);

  useEffect(() => {
    if (!detailItem) return;
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setDetailItem(null);
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [detailItem]);

  const staffList = useMemo(() => {
    const trimmed = memberQuery.trim().toLowerCase();
    if (!trimmed) return members;
    return members.filter((member) => buildMemberSearchText(member).includes(trimmed));
  }, [memberQuery, members]);

  const totalPages = useMemo(() => Math.max(1, Math.ceil(reportTotal / PAGE_SIZE)), [reportTotal]);

  const daysInMonth = useMemo(() => {
    if (!parsedMonth) return 30;
    return new Date(parsedMonth.year, parsedMonth.month, 0).getDate();
  }, [parsedMonth]);

  const dailyTotals = useMemo(() => {
    const totals = Array.from({ length: daysInMonth }, () => 0);
    reportItems.forEach((item) => {
      const date = toDate(item.paidAt ?? item.createdAt);
      if (!date) return;
      const dayIndex = date.getDate() - 1;
      if (dayIndex >= 0 && dayIndex < totals.length) totals[dayIndex] += item.amount || 0;
    });
    return totals;
  }, [reportItems, daysInMonth]);

  const statusCounts = useMemo(() => {
    const counts = { PAID: 0, PENDING: 0, FAILED: 0, REFUNDED: 0 };
    reportItems.forEach((item) => {
      if (item.status in counts) counts[item.status as keyof typeof counts] += 1;
    });
    const total = Object.values(counts).reduce((sum, value) => sum + value, 0);
    return { ...counts, total };
  }, [reportItems]);

  const topStaffTotals = useMemo(() => {
    const map = new Map<string, { name: string; total: number }>();
    reportItems.forEach((item) => {
      const key = item.member?.id ?? item.id;
      const name = item.member ? formatMemberName(item.member) : "-";
      const prev = map.get(key);
      map.set(key, { name, total: (prev?.total ?? 0) + (item.amount || 0) });
    });
    return Array.from(map.values())
      .sort((a, b) => b.total - a.total)
      .slice(0, 3);
  }, [reportItems]);

  return (
    <>
      <div className="space-y-4" data-testid="payroll-report-tab">
      <div className={CARD_CLASS}>
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div className="grid gap-3 md:grid-cols-[minmax(180px,1fr)_minmax(200px,1fr)]">
            <div data-testid="payroll-report-month">
              <label className={LABEL_CLASS}>{t("reportsPage.payroll.monthLabel")}</label>
              <LocalizedMonthInput
                value={monthValue}
                onChange={updateMonthValue}
                locale={locale}
                inputClassName={INPUT_CLASS}
              />
            </div>
            <div>
              <label className={LABEL_CLASS}>{t("reportsPage.payroll.staffLabel")}</label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setMemberModalOpen(true)}
                  className="flex h-9 flex-1 items-center justify-between rounded-lg border border-slate-200 bg-white/90 px-3 text-[11px] text-slate-700 shadow-sm transition hover:border-slate-300 dark:border-slate-700/60 dark:bg-slate-900/70 dark:text-slate-100"
                >
                  <span>
                    {selectedMember
                      ? buildMemberLabel(selectedMember)
                      : t("reportsPage.payroll.allStaff")}
                  </span>
                  <span className="text-slate-400">▾</span>
                </button>
                {memberId ? (
                  <button
                    type="button"
                    onClick={() => updateSelectedMember("")}
                    className="rounded-lg border border-slate-200 px-3 py-1.5 text-[10px] text-slate-600 hover:border-slate-300 dark:border-slate-700/70 dark:text-slate-200"
                  >
                    {t("reportsPage.payroll.clearStaff")}
                  </button>
                ) : null}
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <SummaryChip label={t("reportsPage.payroll.totalPaidLabel")} value={formatAmount(totalPaid, locale)} />
            <SummaryChip label={t("reportsPage.payroll.totalCountLabel")} value={`${reportTotal}`} />
          </div>
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        <MiniChartCard
          title={t("reportsPage.payroll.charts.dailyPaid")}
          subtitle={
            parsedMonth
              ? `${t("reportsPage.payroll.charts.monthLabel")} ${formatMonthLabel(`${parsedMonth.year}-${String(parsedMonth.month).padStart(2, "0")}`, locale)}`
              : ""
          }
        >
          <SparkBars values={dailyTotals} />
        </MiniChartCard>
        <MiniChartCard
          title={t("reportsPage.payroll.charts.statusSplit")}
          subtitle={t("reportsPage.payroll.charts.statusHint")}
        >
          <StatusDonut counts={statusCounts} t={t} />
        </MiniChartCard>
        <MiniChartCard
          title={t("reportsPage.payroll.charts.topStaff")}
          subtitle={t("reportsPage.payroll.charts.topStaffHint")}
        >
          <TopStaffList items={topStaffTotals} locale={locale} />
        </MiniChartCard>
      </div>

      <div className={CARD_CLASS}>
        <DataTableShell>
          <DataTable variant="report" minWidth="860px">
            <DataTableHead>
              <DataTableRow>
                <DataTableHeaderCell>{t("reportsPage.payroll.table.staff")}</DataTableHeaderCell>
                <DataTableHeaderCell>{t("reportsPage.payroll.table.period")}</DataTableHeaderCell>
                <DataTableHeaderCell>{t("reportsPage.payroll.table.amount")}</DataTableHeaderCell>
                <DataTableHeaderCell>{t("reportsPage.payroll.table.paidAt")}</DataTableHeaderCell>
                <DataTableHeaderCell>{t("reportsPage.payroll.table.status")}</DataTableHeaderCell>
                <DataTableHeaderCell>{t("reportsPage.payroll.table.notes")}</DataTableHeaderCell>
                <DataTableHeaderCell align="end">{t("reportsPage.payroll.table.actions")}</DataTableHeaderCell>
              </DataTableRow>
            </DataTableHead>
            <DataTableBody>
              {loading ? (
                <DataTableEmptyRow colSpan={7}>...</DataTableEmptyRow>
              ) : reportItems.length === 0 ? (
                <DataTableEmptyRow colSpan={7}>{t("reportsPage.payroll.empty")}</DataTableEmptyRow>
              ) : (
                reportItems.map((item) => (
                  <DataTableRow key={item.id}>
                    <DataTableCell>
                      <div className="text-xs font-semibold text-slate-900 dark:text-white">{formatMemberName(item.member)}</div>
                      <div className="text-[10px] text-slate-500 dark:text-slate-400">#{item.member.code}</div>
                    </DataTableCell>
                    <DataTableCell>{formatMonthLabel(`${item.period.year}-${String(item.period.month).padStart(2, "0")}`, locale)}</DataTableCell>
                    <DataTableCell className="font-semibold text-slate-900 dark:text-white">{formatAmount(item.amount, locale)}</DataTableCell>
                    <DataTableCell>{formatDate(item.paidAt ?? item.createdAt, locale)}</DataTableCell>
                    <DataTableCell>
                      <span className="rounded-full border border-slate-300 px-2 py-0.5 text-[10px] text-slate-600 dark:border-slate-700 dark:text-slate-200">
                        {formatPaymentStatus(item.status, t)}
                      </span>
                    </DataTableCell>
                    <DataTableCell className="text-[10px] text-slate-500 dark:text-slate-400">
                      {item.notes || "-"}
                    </DataTableCell>
                    <DataTableCell align="end">
                      <button
                        type="button"
                        onClick={() => setDetailItem(item)}
                        className="rounded-lg border border-brand-500/40 px-2 py-1 text-[10px] text-brand-600 hover:bg-brand-500/10 dark:text-brand-300"
                      >
                        {t("reportsPage.payroll.table.view")}
                      </button>
                    </DataTableCell>
                  </DataTableRow>
                ))
              )}
            </DataTableBody>
          </DataTable>
        </DataTableShell>

        <ReportPager
          rangeLabel={`${reportItems.length ? `${page * PAGE_SIZE + 1} - ${Math.min(reportTotal, (page + 1) * PAGE_SIZE)}` : "0"} / ${reportTotal}`}
          pageLabel={`${page + 1} / ${totalPages}`}
          previousLabel={t("reportsPage.payroll.prev")}
          nextLabel={t("reportsPage.payroll.next")}
          canPrevious={page > 0}
          canNext={page + 1 < totalPages}
          onPrevious={() => {
            setLoading(true);
            setError(null);
            setPage((prev) => Math.max(0, prev - 1));
          }}
          onNext={() => {
            setLoading(true);
            setError(null);
            setPage((prev) => Math.min(totalPages - 1, prev + 1));
          }}
        />
      </div>

      <MemberSelectModal
        open={memberModalOpen}
        title={t("reportsPage.payroll.staffLabel")}
        placeholder={t("reportsPage.payroll.staffSearch")}
        query={memberQuery}
        members={staffList}
        loading={membersLoading}
        onQueryChange={updateMemberQuery}
        onSelect={(member) => {
          updateSelectedMember(member.id);
          setMemberModalOpen(false);
        }}
        onSelectAll={() => updateSelectedMember("")}
        onClose={() => setMemberModalOpen(false)}
        inputRef={searchInputRef}
        emptyLabel={t("reportsPage.payroll.staffEmpty")}
        allLabel={t("reportsPage.payroll.allStaffOption")}
      />

      <PayrollReportDetailModal
        open={Boolean(detailItem)}
        item={detailItem}
        locale={locale}
        onClose={() => setDetailItem(null)}
      />
      </div>
    </>
  );
}

function PayrollReportDetailModal({
  open,
  item,
  locale,
  onClose,
}: {
  open: boolean;
  item: PayrollReportItem | null;
  locale: string;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  if (!open || !item) return null;
  const breakdown = item.breakdown;
  const issueDays = breakdown?.daily.filter(
    (day) =>
      day.absentShifts > 0 ||
      day.lateMinutes > 0 ||
      day.earlyLeaveMinutes > 0 ||
      day.overtimeMinutes > 0 ||
      day.justified
  ) ?? [];

  return (
    <div className="modal-overlay fixed inset-0 z-40 flex items-center justify-center bg-black/60 p-4 sm:p-6" onClick={onClose}>
      <div
        className="flex w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white text-slate-900 shadow-2xl shadow-black/20 dark:border-slate-800/80 dark:bg-slate-950 dark:text-slate-100 dark:shadow-black/40"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between gap-2 border-b border-slate-200/80 bg-white/90 px-4 py-3 backdrop-blur dark:border-slate-800/80 dark:bg-slate-950/90">
          <div>
            <h3 className="text-xs font-semibold text-slate-900 dark:text-white">{t("reportsPage.payroll.detailTitle")}</h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              {formatMemberName(item.member)} | {formatMonthLabel(`${item.period.year}-${String(item.period.month).padStart(2, "0")}`, locale)}
            </p>
          </div>
          <CloseIconButton label={t("common.actions.close")} size="sm" onClick={onClose} />
        </div>

        <div className="max-h-[75vh] overflow-y-auto px-4 py-4">
          {!breakdown ? (
            <p className="text-xs text-slate-500 dark:text-slate-400">{t("reportsPage.payroll.detailEmpty")}</p>
          ) : (
            <div className="space-y-4">
              <SectionCard
                title={t("reportsPage.payroll.detail.summaryTitle")}
                hint={t("reportsPage.payroll.detail.summaryHint")}
              >
                <div className="grid gap-4 lg:grid-cols-2">
                  <div>
                    <p className="text-[11px] font-semibold text-slate-700 dark:text-slate-200">
                      {t("reportsPage.payroll.detail.financeTitle")}
                    </p>
                    <div className="mt-2 grid gap-2 sm:grid-cols-2">
                      <SummaryChip label={t("reportsPage.payroll.detail.baseAmount")} value={formatAmount(breakdown.baseAmount, locale)} tone="indigo" />
                      <SummaryChip label={t("reportsPage.payroll.detail.deductions")} value={formatAmount(breakdown.deductions, locale)} tone="rose" />
                      <SummaryChip label={t("reportsPage.payroll.detail.additions")} value={formatAmount(breakdown.additions, locale)} tone="emerald" />
                      <SummaryChip label={t("reportsPage.payroll.detail.adjustment")} value={formatAmount(breakdown.totalAdjustment, locale)} tone="amber" />
                      <SummaryChip label={t("reportsPage.payroll.detail.suggestedPay")} value={formatAmount(breakdown.suggestedPay, locale)} tone="sky" />
                    </div>
                  </div>
                  <div>
                    <p className="text-[11px] font-semibold text-slate-700 dark:text-slate-200">
                      {t("reportsPage.payroll.detail.attendanceTitle")}
                    </p>
                    <div className="mt-2 grid gap-2 sm:grid-cols-2">
                      <SummaryChip label={t("reportsPage.payroll.detail.expectedShifts")} value={`${breakdown.expectedShifts}`} tone="slate" />
                      <SummaryChip label={t("reportsPage.payroll.detail.expectedMinutes")} value={formatMinutesWithHours(breakdown.expectedMinutes, locale, t)} tone="slate" />
                      <SummaryChip label={t("reportsPage.payroll.detail.absentDays")} value={`${breakdown.absentDays}`} tone="rose" />
                      <SummaryChip label={t("reportsPage.payroll.detail.absentMinutes")} value={formatMinutesWithHours(breakdown.absentMinutes, locale, t)} tone="rose" />
                      <SummaryChip label={t("reportsPage.payroll.detail.lateMinutes")} value={formatMinutesWithHours(breakdown.lateMinutes, locale, t)} tone="amber" />
                      <SummaryChip label={t("reportsPage.payroll.detail.earlyLeaveMinutes")} value={formatMinutesWithHours(breakdown.earlyLeaveMinutes, locale, t)} tone="amber" />
                      <SummaryChip label={t("reportsPage.payroll.detail.overtimeMinutes")} value={formatMinutesWithHours(breakdown.overtimeMinutes, locale, t)} tone="emerald" />
                      <SummaryChip label={t("reportsPage.payroll.detail.justifiedDays")} value={`${breakdown.justifiedDays}`} tone="sky" />
                    </div>
                  </div>
                </div>
              </SectionCard>

              <SectionCard
                title={t("reportsPage.payroll.detail.policyTitle")}
                hint={t("reportsPage.payroll.detail.policyHint")}
              >
                {breakdown.policy ? (
                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    <div>{t("reportsPage.payroll.detail.policyScope")}: {breakdown.policy.scope}</div>
                    <div>{t("reportsPage.payroll.detail.policyDeductions")}: {breakdown.policy.allowAttendanceDeductions ? t("common.values.yes") : t("common.values.no")}</div>
                    <div>{t("reportsPage.payroll.detail.policyLateIgnore")}: {breakdown.policy.lateIgnoreMinutes}</div>
                    <div>{t("reportsPage.payroll.detail.policyEarlyIgnore")}: {breakdown.policy.earlyLeaveIgnoreMinutes}</div>
                  </div>
                ) : (
                  <p className="mt-2 text-[11px] text-slate-500 dark:text-slate-400">{t("reportsPage.payroll.detail.policyEmpty")}</p>
                )}
              </SectionCard>

              <SectionCard
                title={t("reportsPage.payroll.detail.dailyTitle")}
                hint={t("reportsPage.payroll.detail.dailyHint")}
              >
                {issueDays.length === 0 ? (
                  <p className="mt-2 text-[11px] text-slate-500 dark:text-slate-400">{t("reportsPage.payroll.detail.dailyEmpty")}</p>
                ) : (
                  <>
                    <div className="mt-2 space-y-2 md:hidden">
                      {issueDays.map((day) => (
                        <div
                          key={day.date}
                          className="rounded-xl border border-slate-200/70 bg-white/80 p-3 text-[11px] text-slate-700 shadow-sm dark:border-slate-800/70 dark:bg-slate-950/60 dark:text-slate-200"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold text-slate-900 dark:text-white">{formatDate(day.date, locale)}</span>
                            <BadgeTone
                              tone={day.justified ? "emerald" : "slate"}
                              label={day.justified ? t("common.values.yes") : t("common.values.no")}
                            />
                          </div>
                          <div className="mt-2 grid grid-cols-2 gap-2">
                            <MiniStat label={t("reportsPage.payroll.detail.dailyAbsent")} value={formatAbsentValue(day.absentShifts || 0, locale, t)} tone={day.absentShifts ? "rose" : "slate"} />
                            <MiniStat label={t("reportsPage.payroll.detail.dailyLate")} value={formatMinutesWithHours(day.lateMinutes || 0, locale, t)} tone={day.lateMinutes ? "amber" : "slate"} />
                            <MiniStat label={t("reportsPage.payroll.detail.dailyEarly")} value={formatMinutesWithHours(day.earlyLeaveMinutes || 0, locale, t)} tone={day.earlyLeaveMinutes ? "amber" : "slate"} />
                            <MiniStat label={t("reportsPage.payroll.detail.dailyOvertime")} value={formatMinutesWithHours(day.overtimeMinutes || 0, locale, t)} tone={day.overtimeMinutes ? "emerald" : "slate"} />
                          </div>
                        </div>
                      ))}
                    </div>
                    <DataTableShell className="mt-2 hidden md:block">
                      <DataTable variant="report" minWidth="640px">
                        <DataTableHead>
                          <DataTableRow>
                            <DataTableHeaderCell>{t("reportsPage.payroll.detail.dailyDate")}</DataTableHeaderCell>
                            <DataTableHeaderCell>{t("reportsPage.payroll.detail.dailyAbsent")}</DataTableHeaderCell>
                            <DataTableHeaderCell>{t("reportsPage.payroll.detail.dailyLate")}</DataTableHeaderCell>
                            <DataTableHeaderCell>{t("reportsPage.payroll.detail.dailyEarly")}</DataTableHeaderCell>
                            <DataTableHeaderCell>{t("reportsPage.payroll.detail.dailyOvertime")}</DataTableHeaderCell>
                            <DataTableHeaderCell>{t("reportsPage.payroll.detail.dailyJustified")}</DataTableHeaderCell>
                          </DataTableRow>
                        </DataTableHead>
                        <DataTableBody>
                          {issueDays.map((day) => (
                            <DataTableRow key={day.date}>
                              <DataTableCell>{formatDate(day.date, locale)}</DataTableCell>
                              <DataTableCell>
                                <BadgeTone tone={day.absentShifts ? "rose" : "slate"} label={formatAbsentValue(day.absentShifts || 0, locale, t)} />
                              </DataTableCell>
                              <DataTableCell>
                                <BadgeTone tone={day.lateMinutes ? "amber" : "slate"} label={formatMinutesWithHours(day.lateMinutes || 0, locale, t)} />
                              </DataTableCell>
                              <DataTableCell>
                                <BadgeTone tone={day.earlyLeaveMinutes ? "amber" : "slate"} label={formatMinutesWithHours(day.earlyLeaveMinutes || 0, locale, t)} />
                              </DataTableCell>
                              <DataTableCell>
                                <BadgeTone tone={day.overtimeMinutes ? "emerald" : "slate"} label={formatMinutesWithHours(day.overtimeMinutes || 0, locale, t)} />
                              </DataTableCell>
                              <DataTableCell>
                                <BadgeTone tone={day.justified ? "emerald" : "slate"} label={day.justified ? t("common.values.yes") : t("common.values.no")} />
                              </DataTableCell>
                            </DataTableRow>
                          ))}
                        </DataTableBody>
                      </DataTable>
                    </DataTableShell>
                  </>
                )}
              </SectionCard>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function SummaryChip({ label, value, tone = "slate" }: { label: string; value: string; tone?: SummaryTone }) {
  return (
    <div className={`rounded-xl border px-3 py-2 text-[11px] ${summaryToneClass[tone]}`}>
      <p className="text-[10px] uppercase tracking-wide text-slate-600 dark:text-slate-300">{label}</p>
      <p className="text-xs font-semibold text-slate-900 dark:text-white">{value}</p>
    </div>
  );
}

type SummaryTone = "slate" | "indigo" | "rose" | "emerald" | "amber" | "sky";

const summaryToneClass: Record<SummaryTone, string> = {
  slate: "border-slate-200/80 bg-white/80 text-slate-700",
  indigo: "border-indigo-500/30 bg-indigo-500/10 text-slate-700",
  rose: "border-rose-500/30 bg-rose-500/10 text-slate-700",
  emerald: "border-emerald-500/30 bg-emerald-500/10 text-slate-700",
  amber: "border-amber-500/30 bg-amber-500/10 text-slate-700",
  sky: "border-sky-500/30 bg-sky-500/10 text-slate-700",
};

function SectionCard({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-slate-200/80 bg-white/80 p-3 text-[11px] text-slate-700 dark:border-slate-800/70 dark:bg-slate-950/60 dark:text-slate-200">
      <div className="flex flex-col gap-1">
        <p className="text-xs font-semibold text-slate-900 dark:text-white">{title}</p>
        {hint ? <p className="text-[10px] text-slate-500 dark:text-slate-400">{hint}</p> : null}
      </div>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function MiniStat({ label, value, tone = "slate" }: { label: string; value: string; tone?: Tone }) {
  return (
    <div className="rounded-lg border border-slate-200/70 bg-white/70 px-2 py-1 text-[10px] text-slate-600 dark:border-slate-800/70 dark:bg-slate-950/60 dark:text-slate-300">
      <span className="block text-[9px] uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</span>
      <span className={`text-[11px] font-semibold ${toneValueClass[tone]}`}>{value}</span>
    </div>
  );
}

type Tone = "slate" | "amber" | "rose" | "emerald";

const toneValueClass: Record<Tone, string> = {
  slate: "text-slate-900 dark:text-white",
  amber: "text-amber-700 dark:text-amber-200",
  rose: "text-rose-700 dark:text-rose-200",
  emerald: "text-emerald-700 dark:text-emerald-200",
};

const badgeToneClass: Record<Tone, string> = {
  slate: "border-emerald-500/35 bg-emerald-500/12 text-emerald-700 dark:border-emerald-400/40 dark:bg-emerald-500/15 dark:text-emerald-200",
  amber: "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-200",
  rose: "border-rose-500/55 bg-rose-500/15 text-rose-700 dark:border-rose-400/60 dark:bg-rose-500/25 dark:text-rose-100",
  emerald: "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:border-emerald-400/40 dark:bg-emerald-500/15 dark:text-emerald-200",
};

function BadgeTone({ tone, label }: { tone: Tone; label: string }) {
  return (
    <span className={`inline-flex min-w-[28px] items-center justify-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${badgeToneClass[tone]}`}>
      {label}
    </span>
  );
}

function MiniChartCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white/80 p-3 text-slate-900 shadow-sm dark:border-slate-800/80 dark:bg-slate-950/70 dark:text-slate-100">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xs font-semibold text-slate-800 dark:text-white">{title}</p>
          {subtitle ? <p className="mt-0.5 text-[10px] text-slate-500 dark:text-slate-400">{subtitle}</p> : null}
        </div>
      </div>
      <div className="mt-3">{children}</div>
    </div>
  );
}

function SparkBars({ values }: { values: number[] }) {
  const max = Math.max(1, ...values);
  return (
    <div className="flex items-end gap-1">
      {values.map((value, index) => {
        const height = Math.max(4, Math.round((value / max) * 46));
        return (
          <div
            key={`${index}-${value}`}
            className="w-2.5 rounded-full bg-brand-500/40 dark:bg-brand-400/60"
            style={{ height }}
          />
        );
      })}
    </div>
  );
}

function StatusDonut({
  counts,
  t,
}: {
  counts: { PAID: number; PENDING: number; FAILED: number; REFUNDED: number; total: number };
  t: (key: string) => string;
}) {
  const total = counts.total || 1;
  const paidPercent = (counts.PAID / total) * 100;
  const pendingPercent = (counts.PENDING / total) * 100;
  const failedPercent = (counts.FAILED / total) * 100;
  const gradient = `conic-gradient(#22c55e 0 ${paidPercent}%, #f59e0b ${paidPercent}% ${paidPercent + pendingPercent}%, #ef4444 ${paidPercent + pendingPercent}% ${paidPercent + pendingPercent + failedPercent}%, #60a5fa ${paidPercent + pendingPercent + failedPercent}% 100%)`;

  return (
    <div className="flex items-center gap-3">
      <div className="relative grid h-14 w-14 place-items-center rounded-full" style={{ background: gradient }}>
        <div className="h-8 w-8 rounded-full bg-white dark:bg-slate-950" />
      </div>
      <div className="space-y-1 text-[10px] text-slate-600 dark:text-slate-300">
        <LegendItem color="bg-emerald-500" label={t("reportsPage.payroll.status.paid")} value={counts.PAID} />
        <LegendItem color="bg-amber-500" label={t("reportsPage.payroll.status.pending")} value={counts.PENDING} />
        <LegendItem color="bg-rose-500" label={t("reportsPage.payroll.status.failed")} value={counts.FAILED} />
        <LegendItem color="bg-sky-500" label={t("reportsPage.payroll.status.refunded")} value={counts.REFUNDED} />
      </div>
    </div>
  );
}

function LegendItem({ color, label, value }: { color: string; label: string; value: number }) {
  return (
    <div className="flex items-center gap-2">
      <span className={`h-2 w-2 rounded-full ${color}`} />
      <span className="min-w-[60px]">{label}</span>
      <span className="text-[10px] font-semibold text-slate-700 dark:text-slate-100">{value}</span>
    </div>
  );
}

function TopStaffList({ items, locale }: { items: { name: string; total: number }[]; locale: string }) {
  if (!items.length) {
    return <p className="text-[11px] text-slate-500 dark:text-slate-400">-</p>;
  }
  const max = Math.max(1, ...items.map((item) => item.total));
  return (
    <div className="space-y-2">
      {items.map((item) => (
        <div key={item.name} className="flex items-center gap-2 text-[11px]">
          <div className="flex-1">
            <div className="flex items-center justify-between">
              <span className="text-slate-700 dark:text-slate-200">{item.name}</span>
              <span className="text-[10px] font-semibold text-slate-900 dark:text-white">{formatAmount(item.total, locale)}</span>
            </div>
            <div className="mt-1 h-1.5 w-full rounded-full bg-slate-200/80 dark:bg-slate-800/80">
              <div
                className="h-1.5 rounded-full bg-brand-500/60 dark:bg-brand-400/70"
                style={{ width: `${Math.round((item.total / max) * 100)}%` }}
              />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function buildMemberLabel(member: { code: string; firstName: string; lastName?: string | null; phone?: string | null }) {
  const base = `${formatMemberName(member)} - #${member.code}`;
  return member.phone ? `${base} | ${member.phone}` : base;
}

function buildMemberSearchText(member: {
  id: string;
  code: string;
  firstName: string;
  lastName?: string | null;
  fatherName?: string | null;
  phone?: string | null;
  email?: string | null;
}) {
  return [member.id, member.code, member.firstName, member.lastName, member.fatherName, member.phone, member.email]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function formatMemberName(member: { firstName: string; lastName?: string | null }) {
  return [member.firstName, member.lastName].filter(Boolean).join(" ");
}

function formatDate(value: Date | string | null | undefined, locale = "en") {
  if (!value) return "-";
  const date = toDate(value);
  if (!date) return "-";
  return date.toLocaleDateString(resolveDateLocale(locale));
}

function formatAmount(value: number, locale = "en") {
  const safe = Number.isFinite(value) ? value : 0;
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(safe);
}

function formatMoney(value: number, locale = "en") {
  const safe = Number.isFinite(value) ? value : 0;
  return new Intl.NumberFormat(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(safe);
}

function formatCount(value: number, locale = "en") {
  const safe = Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(safe);
}

function formatTime(value: Date | string | null | undefined, locale = "en") {
  const date = toDate(value);
  if (!date) return "-";
  return date.toLocaleTimeString(resolveDateLocale(locale), { hour: "2-digit", minute: "2-digit" });
}

function formatPaymentStatus(status: string, t: (key: string) => string) {
  if (status === "PAID") return t("reportsPage.payroll.status.paid");
  if (status === "PENDING") return t("reportsPage.payroll.status.pending");
  if (status === "FAILED") return t("reportsPage.payroll.status.failed");
  if (status === "REFUNDED") return t("reportsPage.payroll.status.refunded");
  return status;
}

function formatMinutesWithHours(minutes: number, locale: string, t: (key: string) => string) {
  const safe = Math.max(0, Math.floor(minutes || 0));
  const hours = Math.floor(safe / 60);
  const mins = safe % 60;
  const hourLabel = t("reportsPage.payroll.detail.hourShort");
  const minuteLabel = t("reportsPage.payroll.detail.minuteShort");
  const hoursLabelled = `${formatCount(hours, locale)}${hourLabel}`;
  const minutesLabelled = `${formatCount(mins, locale)}${minuteLabel}`;
  if (hours === 0) return minutesLabelled;
  if (mins === 0) return hoursLabelled;
  return `${hoursLabelled}:${minutesLabelled}`;
}

function formatAbsentValue(value: number, _locale: string, t: (key: string) => string) {
  const count = Math.max(0, Math.floor(value || 0));
  if (count === 0) return t("reportsPage.payroll.detail.dailyAbsentPresent");
  return t("reportsPage.payroll.detail.dailyAbsentAbsent");
}

function toDate(value: Date | string | null | undefined) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function toMonthInputValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

function parseMonthInput(value: string) {
  const [year, month] = value.split("-").map(Number);
  if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) {
    return null;
  }
  return { year, month };
}

function formatMonthLabel(value: string, locale = "en") {
  const parsed = parseMonthInput(value);
  if (!parsed) return value;
  const date = new Date(parsed.year, parsed.month - 1, 1);
  return date.toLocaleString(resolveGregorianMonthLocale(locale), { month: "long", year: "numeric" });
}


