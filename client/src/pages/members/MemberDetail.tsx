import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import {
  IconCalendar,
  IconCalendarCheck,
  IconCalendarEvent,
  IconCashBanknote,
  IconCircleCheck,
  IconCircleDashed,
  IconClock,
  IconCreditCard,
  IconDeviceMobile,
  IconFilter,
  IconInfoCircle,
  IconIdBadge,
  IconLockAccess,
  IconLogin,
  IconLogout,
  IconShieldLock,
  IconShieldX,
  IconSun,
  IconUser,
  IconWallet,
  IconShieldCheck,
} from "@tabler/icons-react";
import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { createMemberPayment, deleteMember, getMemberFull } from "../../api/members";
import type { FullMemberProfile } from "../../shared/memberTypes";
import { MemberStatusBadge } from "../../components/members/MemberStatusBadge";
import { MemberTypeBadge } from "../../components/members/MemberTypeBadge";
import { rtlLanguages } from "../../i18n/config";
import { DeleteMemberModal } from "../../components/members/DeleteMemberModal";
import { useModalDismiss } from "../../hooks/useModalDismiss";
import { useToast } from "../../components/ToastContext";
import { resolveDateLocale } from "../../shared/dateLocale";
import { localDateTimeInputToIso } from "../../shared/dateInputValue";
import { formatAccessReason } from "../../utils/accessReasons";
import { useGlobalLoading } from "../../components/GlobalLoadingContext";
import { CloseIconButton } from "../../components/CloseIconButton";
import { LocalizedDateTimeInput } from "../../components/ui/LocalizedDateTimeInput";
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
import { PaginationControls } from "../../components/ui/PaginationControls";
import { useAuth } from "../../auth/AuthContext";

type TabKey = "overview" | "attendance" | "payments" | "shifts" | "access" | "membership";
type ProfileMember = FullMemberProfile["member"];
type ProfileShift = NonNullable<FullMemberProfile["shifts"]>[number];
type ProfileAttendanceLog = FullMemberProfile["attendanceLogs"][number];
type AttendanceLogFilter = "ALL" | "AUTHORIZED" | "REJECTED" | "IN" | "OUT";

const FINGER_LABEL_KEYS: Record<number, string> = {
  0: "finger.leftPinky",
  1: "finger.leftRing",
  2: "finger.leftMiddle",
  3: "finger.leftIndex",
  4: "finger.leftThumb",
  5: "finger.rightThumb",
  6: "finger.rightIndex",
  7: "finger.rightMiddle",
  8: "finger.rightRing",
  9: "finger.rightPinky",
};

const WEEKDAY_KEYS = ["sat", "sun", "mon", "tue", "wed", "thu", "fri"] as const;

export function MemberDetail() {
  const { id } = useParams<{ id: string }>();
  const { t, i18n } = useTranslation();
  const { push } = useToast();
  const { hasPermission } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<FullMemberProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<TabKey>("overview");
  const [modalOpen, setModalOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [paymentSubmitting, setPaymentSubmitting] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const isRtl = rtlLanguages.includes(i18n.language.split("-")[0]);
  const blockingLoad = loading && !profile;

  useGlobalLoading(blockingLoad, {
    message: t("common.messages.loading"),
    subtitle: t("nav.members"),
  });

  const loadProfile = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const { data } = await getMemberFull(id);
      setProfile(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("memberDetail.errors.loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [id, t]);

  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

  useEffect(() => {
    if (error) {
      push({ kind: "error", title: error });
    }
  }, [error, push]);

  useEffect(() => {
    if (paymentError) {
      push({ kind: "error", title: paymentError });
    }
  }, [paymentError, push]);

  const member = profile?.member;
  const stats = useMemo(() => {
    if (!profile) return null;
    const items: { label: string; value: number | string }[] = [
      { label: t("memberDetail.stats.paymentsApplied"), value: profile.aggregates.totalPaid ?? 0 },
      { label: t("memberDetail.stats.outstanding"), value: profile.aggregates.outstandingBalance ?? 0 },
      { label: t("memberDetail.stats.attendanceDays"), value: profile.aggregates.attendanceDays ?? 0 },
    ];
    if (profile.member.memberType !== "STAFF") {
      items.unshift({ label: t("memberDetail.stats.creditBalance"), value: profile.aggregates.creditBalance ?? 0 });
      items.unshift({ label: t("memberDetail.stats.memberships"), value: profile.memberships?.length ?? 0 });
    }
    return items;
  }, [profile, t]);
  const canRecordPayment = Boolean(
    hasPermission("PAYMENTS_RECORD") && profile && profile.member.memberType !== "STAFF" && !profile.member.isStaff
  );

  const handleRecordPayment = async (payload: { amount: number; paidAt?: string; notes?: string }) => {
    if (!id) return;
    setPaymentSubmitting(true);
    setPaymentError(null);
    try {
      const membershipId = profile?.memberships?.[0]?.id;
      await createMemberPayment(id, {
        ...payload,
        ...(membershipId ? { membershipId } : {}),
      });
      setPaymentModalOpen(false);
      await loadProfile();
    } catch (err) {
      setPaymentError(err instanceof Error ? err.message : t("memberDetail.errors.paymentFailed"));
    } finally {
      setPaymentSubmitting(false);
    }
  };

  if (blockingLoad) {
    return (
      <div className="space-y-3 rounded-2xl border border-slate-800/80 bg-slate-950/70 p-4" dir={isRtl ? "rtl" : "ltr"}>
        <div className="h-6 w-48 animate-pulse rounded-full bg-slate-800" />
        <div className="h-32 w-full animate-pulse rounded-2xl bg-slate-900/80" />
      </div>
    );
  }

  if (error || !member || !profile) {
    return (
      <div className="rounded-2xl border border-slate-800/80 bg-slate-950/70 p-4 text-[11px] text-slate-200" dir={isRtl ? "rtl" : "ltr"}>
        {error ?? t("memberDetail.errors.notFound")}
        <button type="button" onClick={() => navigate("/members")} className="mt-3 rounded-full border border-slate-700 px-3 py-1 text-[11px] text-slate-200">
          {t("common.actions.back")}
        </button>
      </div>
    );
  }

  return (
    <div className="member-detail-page entry-logs-compact space-y-4" dir={isRtl ? "rtl" : "ltr"}>
      <Header
        member={member}
        stats={stats}
        onEdit={hasPermission("MEMBERS_WRITE") ? () => navigate(`/members/${member.id}/edit`) : undefined}
        onDelete={hasPermission("MEMBERS_DELETE") ? () => setModalOpen(true) : undefined}
      />

      <div className="rounded-2xl border border-slate-800/80 bg-slate-950/70">
        <div className="flex flex-wrap gap-2 border-b border-slate-800/70 px-3 py-2 text-[11px] text-slate-300">
          <TabButton label={t("memberDetail.tabs.overview")} active={tab === "overview"} onClick={() => setTab("overview")} />
          <TabButton label={t("memberDetail.tabs.attendance")} active={tab === "attendance"} onClick={() => setTab("attendance")} />
          <TabButton label={t("memberDetail.tabs.payments")} active={tab === "payments"} onClick={() => setTab("payments")} />
          {member.memberType === "STAFF" ? (
            <>
              <TabButton label={t("memberDetail.tabs.shiftsSalary")} active={tab === "shifts"} onClick={() => setTab("shifts")} />
              <TabButton label={t("memberDetail.tabs.accessDevices")} active={tab === "access"} onClick={() => setTab("access")} />
            </>
          ) : (
            <TabButton label={t("memberDetail.tabs.memberships")} active={tab === "membership"} onClick={() => setTab("membership" as TabKey)} />
          )}
        </div>
        <div className="p-4">
          {tab === "overview" && <OverviewTab profile={profile} />}
          {tab === "attendance" && <AttendanceTab profile={profile} />}
          {tab === "payments" && (
            <PaymentsTab
              profile={profile}
              canRecord={canRecordPayment}
              onRecordPayment={() => {
                setPaymentError(null);
                setPaymentModalOpen(true);
              }}
            />
          )}
          {tab === "shifts" && member.memberType === "STAFF" && <ShiftsTab profile={profile} />}
          {tab === "access" && member.memberType === "STAFF" && <AccessTab profile={profile} />}
          {tab === "membership" && member.memberType !== "STAFF" && <MembershipTab profile={profile} />}
        </div>
      </div>
      <DeleteMemberModal
        open={hasPermission("MEMBERS_DELETE") && modalOpen}
        onClose={() => setModalOpen(false)}
        onConfirm={async () => {
          if (!member.id) return;
          setDeleting(true);
          try {
            await deleteMember(member.id);
            navigate("/members");
          } finally {
            setDeleting(false);
            setModalOpen(false);
          }
        }}
        loading={deleting}
      />
      {hasPermission("PAYMENTS_RECORD") && paymentModalOpen ? (
        <RecordPaymentModal
          open
          onClose={() => setPaymentModalOpen(false)}
          onSubmit={handleRecordPayment}
          submitting={paymentSubmitting}
          error={paymentError}
        />
      ) : null}
    </div>
  );
}

function Header({
  member,
  stats,
  onEdit,
  onDelete,
}: {
  member: ProfileMember;
  stats: { label: string; value: number | string }[] | null;
  onEdit?: () => void;
  onDelete?: () => void;
}) {
  const { t } = useTranslation();
  const memberType = member.memberType ?? (member.isStaff ? "STAFF" : "CUSTOMER");
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-slate-800/80 bg-slate-950/70 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="member-avatar flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-900 text-base font-semibold text-white">
          {member.firstName.at(0)}
        </div>
        <div>
          <h2 className="text-sm font-semibold text-white">
            {[member.firstName, member.lastName].filter(Boolean).join(" ")} • {member.code}
          </h2>
          <p className="text-[11px] text-slate-400">{member.phone ?? "-"}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <MemberStatusBadge status={member.status} />
            <MemberTypeBadge type={memberType} />
            {member.roleType ? (
              <span className="member-chip rounded-full border border-slate-700 px-2 py-0.5 text-[10px] text-slate-200">{member.roleType}</span>
            ) : null}
            {member.staffGroup?.name ? (
              <span className="member-chip rounded-full border border-slate-700 px-2 py-0.5 text-[10px] text-slate-200">{member.staffGroup.name}</span>
            ) : null}
          </div>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        {stats?.map((stat) => (
          <div key={stat.label} className="member-stat rounded-xl border border-slate-800 bg-slate-900/60 px-3 py-2 text-[11px] text-slate-200">
            <p className="text-[10px] text-slate-400">{stat.label}</p>
            <p className="text-sm font-semibold text-white">{stat.value}</p>
          </div>
        ))}
        {onEdit ? <button
          type="button"
          onClick={onEdit}
          title={t("members.actions.edit")}
          aria-label={t("members.actions.edit")}
          className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-slate-700 bg-slate-900/50 text-slate-100 transition-colors hover:border-brand-400 hover:text-white"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} className="h-4 w-4">
            <path d="M12 20h9" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M16.5 3.5a2.12 2.12 0 1 1 3 3L7 19l-4 1 1-4 12.5-12.5z" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button> : null}
        {onDelete ? <button
          type="button"
          onClick={onDelete}
          title={t("members.actions.delete")}
          aria-label={t("members.actions.delete")}
          className="member-delete-btn inline-flex h-8 w-8 items-center justify-center rounded-xl border border-rose-500/40 bg-rose-500/10 text-rose-100 transition-colors hover:border-rose-400 hover:bg-rose-500/20"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} className="h-4 w-4">
            <path d="M3 6h18" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M8 6V4h8v2M7 6l1 14h8l1-14" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button> : null}
      </div>
    </div>
  );
}

function OverviewTab({ profile }: { profile: FullMemberProfile }) {
  const { t, i18n } = useTranslation();
  const member = profile.member;
  const currentMembership = profile.member.memberType === "STAFF" ? null : profile.memberships?.[0];
  return (
    <div className="space-y-3">
      <div className="grid gap-3 xl:grid-cols-2">
        <OverviewPanel
          title={t("memberDetail.sections.basicInfo")}
          icon={<IconUser className="h-5 w-5" stroke={1.8} />}
          tone="brand"
        >
          <OverviewInfoRow label={t("common.labels.name")} value={[member.firstName, member.lastName].filter(Boolean).join(" ")} />
          <OverviewInfoRow label={t("common.labels.phone")} value={member.phone ?? "-"} />
          <OverviewInfoRow label={t("common.labels.email")} value={member.email ?? "-"} />
          <OverviewInfoRow label={t("common.labels.gender")} value={member.gender ?? "-"} />
          <OverviewInfoRow label={t("common.labels.birthDate")} value={formatLocalizedDate(member.birthDate, i18n.language)} />
          <OverviewInfoRow label={t("common.labels.fingerId")} value={formatFingerLabel(member.fingerId ?? null, t)} />
          <OverviewInfoRow label={t("common.labels.status")} value={<MemberStatusBadge status={member.status} />} />
        </OverviewPanel>
        <OverviewPanel
          title={t("memberDetail.sections.roleGroup")}
          icon={<IconShieldLock className="h-5 w-5" stroke={1.8} />}
          tone="violet"
        >
          <OverviewInfoRow label={t("common.labels.role")} value={member.roleType ? <OverviewPill tone="violet">{member.roleType}</OverviewPill> : "-"} />
          <OverviewInfoRow label={t("common.labels.staffGroup")} value={member.staffGroup?.name ? <OverviewPill tone="brand">{member.staffGroup.name}</OverviewPill> : "-"} />
          <OverviewInfoRow label={t("common.labels.customTitle")} value={member.customTitle ?? "-"} />
          <OverviewInfoRow label={t("common.labels.notes")} value={member.notes ?? "-"} />
        </OverviewPanel>
      </div>
      {member.memberType !== "STAFF" && (
        <OverviewPanel
          title={t("memberDetail.sections.currentMembership")}
          icon={<IconIdBadge className="h-5 w-5" stroke={1.8} />}
          tone="amber"
        >
          {currentMembership ? (
            <>
              <OverviewInfoRow label={t("common.labels.plan")} value={currentMembership.plan?.name ?? currentMembership.planId} />
              <OverviewInfoRow
                label={t("common.labels.dates")}
                value={`${formatLocalizedDate(currentMembership.startDate, i18n.language)} - ${formatLocalizedDate(currentMembership.endDate, i18n.language)}`}
              />
              <OverviewInfoRow label={t("common.labels.status")} value={<OverviewPill tone="amber">{currentMembership.status}</OverviewPill>} />
              <OverviewInfoRow label={t("common.labels.activated")} value={currentMembership.activatedAt ? t("common.values.yes") : t("common.values.no")} />
              {currentMembership.activatedAt ? (
                <OverviewInfoRow label={t("common.labels.activatedAt")} value={formatLocalizedDateTime(currentMembership.activatedAt, i18n.language)} />
              ) : null}
            </>
          ) : (
            <p className="text-[11px] text-slate-400">{t("memberDetail.messages.noMembership")}</p>
          )}
        </OverviewPanel>
      )}
      <OverviewSummary profile={profile} locale={i18n.language} />
    </div>
  );
}

type OverviewTone = "brand" | "violet" | "emerald" | "amber";

const overviewToneStyles: Record<OverviewTone, { icon: string; pill: string }> = {
  brand: {
    icon: "border-brand-200 bg-brand-50 text-brand-600 dark:border-brand-500/30 dark:bg-brand-500/10 dark:text-brand-200",
    pill: "border-brand-200 bg-brand-50 text-brand-700 dark:border-brand-500/30 dark:bg-brand-500/10 dark:text-brand-100",
  },
  violet: {
    icon: "border-violet-200 bg-violet-50 text-violet-600 dark:border-violet-500/30 dark:bg-violet-500/10 dark:text-violet-200",
    pill: "border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-500/30 dark:bg-violet-500/10 dark:text-violet-100",
  },
  emerald: {
    icon: "border-emerald-200 bg-emerald-50 text-emerald-600 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200",
    pill: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-100",
  },
  amber: {
    icon: "border-amber-200 bg-amber-50 text-amber-600 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200",
    pill: "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100",
  },
};

function OverviewPanel({
  title,
  icon,
  tone,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  tone: OverviewTone;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white/80 p-3 shadow-sm dark:border-slate-800/80 dark:bg-slate-900/50 sm:p-4">
      <div className="mb-4 flex items-center gap-3">
        <span className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${overviewToneStyles[tone].icon}`}>
          {icon}
        </span>
        <h3 className="text-sm font-semibold text-slate-950 dark:text-white">{title}</h3>
      </div>
      <div className="divide-y divide-slate-200/80 dark:divide-slate-800/80">{children}</div>
    </section>
  );
}

function OverviewInfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1 py-2.5 text-[11px] sm:flex-row sm:items-center sm:justify-between sm:gap-3">
      <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</span>
      <span className="min-w-0 text-start font-medium text-slate-950 dark:text-white sm:text-end">{value ?? "-"}</span>
    </div>
  );
}

function OverviewPill({ tone, children }: { tone: OverviewTone; children: React.ReactNode }) {
  return (
    <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-[10px] font-semibold ${overviewToneStyles[tone].pill}`}>
      {children}
    </span>
  );
}

function OverviewSummary({ profile, locale }: { profile: FullMemberProfile; locale: string }) {
  const { t } = useTranslation();
  const metrics = [
    {
      label: t("common.labels.totalPaid"),
      value: formatLocalizedNumber(profile.aggregates.totalPaid ?? 0, locale),
      icon: <IconCashBanknote className="h-5 w-5" stroke={1.8} />,
      tone: "brand" as const,
    },
    {
      label: t("common.labels.outstanding"),
      value: formatLocalizedNumber(profile.aggregates.outstandingBalance ?? 0, locale),
      icon: <IconWallet className="h-5 w-5" stroke={1.8} />,
      tone: "amber" as const,
    },
    {
      label: t("common.labels.creditBalance"),
      value: formatLocalizedNumber(profile.aggregates.creditBalance ?? 0, locale),
      icon: <IconCreditCard className="h-5 w-5" stroke={1.8} />,
      tone: "violet" as const,
    },
    {
      label: t("common.labels.attendanceDays"),
      value: formatLocalizedNumber(profile.aggregates.attendanceDays ?? 0, locale),
      icon: <IconCalendarCheck className="h-5 w-5" stroke={1.8} />,
      tone: "emerald" as const,
    },
  ];

  return (
    <section className="rounded-2xl border border-slate-200 bg-white/80 p-3 shadow-sm dark:border-slate-800/80 dark:bg-slate-900/50 sm:p-4">
      <div className="mb-4 flex items-center gap-3">
        <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-600 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200">
          <IconCalendarCheck className="h-5 w-5" stroke={1.8} />
        </span>
        <h3 className="text-sm font-semibold text-slate-950 dark:text-white">{t("memberDetail.sections.summary")}</h3>
      </div>
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric) => (
          <OverviewMetric key={metric.label} {...metric} />
        ))}
      </div>
    </section>
  );
}

function OverviewMetric({
  label,
  value,
  icon,
  tone,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  tone: OverviewTone;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-3 dark:border-slate-800 dark:bg-slate-950/40">
      <span className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${overviewToneStyles[tone].icon}`}>
        {icon}
      </span>
      <div>
        <p className="text-base font-semibold text-slate-950 dark:text-white">{value}</p>
        <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</p>
      </div>
    </div>
  );
}

function AttendanceTab({ profile }: { profile: FullMemberProfile }) {
  const { t, i18n } = useTranslation();
  const [filter, setFilter] = useState<AttendanceLogFilter>("ALL");
  const [page, setPage] = useState(1);
  const pageSize = 10;
  const logs = profile.attendanceLogs;
  const filteredLogs = useMemo(() => {
    if (filter === "AUTHORIZED") return logs.filter((log) => log.isAuthorized);
    if (filter === "REJECTED") return logs.filter((log) => !log.isAuthorized);
    if (filter === "IN") return logs.filter((log) => log.entryType === "IN");
    if (filter === "OUT") return logs.filter((log) => log.entryType === "OUT");
    return logs;
  }, [filter, logs]);
  const totalPages = Math.max(1, Math.ceil(filteredLogs.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageStart = (currentPage - 1) * pageSize;
  const visibleLogs = filteredLogs.slice(pageStart, pageStart + pageSize);

  return (
    <section className="rounded-2xl border border-slate-200 bg-white/80 p-3 shadow-sm dark:border-slate-800/80 dark:bg-slate-900/50 sm:p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-start gap-3">
          <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-brand-200 bg-brand-50 text-brand-600 dark:border-brand-500/30 dark:bg-brand-500/10 dark:text-brand-200">
            <IconCalendar className="h-5 w-5" stroke={1.8} />
          </span>
          <div>
            <h3 className="text-sm font-semibold text-slate-950 dark:text-white">
              {t("memberDetail.attendance.logsTitle", { defaultValue: "Attendance logs" })}
            </h3>
            <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
              {t("memberDetail.attendance.logsSubtitle", { defaultValue: "View member check-in and check-out history" })}
            </p>
          </div>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="inline-flex h-9 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-[11px] font-medium text-slate-700 shadow-sm dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-200">
            <IconCalendar className="h-4 w-4 text-brand-500" stroke={1.8} />
            <span>{formatAttendanceRangeLabel(logs, i18n.language, t)}</span>
          </div>
          <label className="inline-flex h-9 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-[11px] font-medium text-slate-700 shadow-sm dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-200">
            <IconFilter className="h-4 w-4 text-brand-500" stroke={1.8} />
            <select
              value={filter}
              onChange={(event) => {
                setFilter(event.target.value as AttendanceLogFilter);
                setPage(1);
              }}
              className="min-w-24 bg-transparent text-[11px] font-semibold text-slate-700 outline-none dark:text-slate-100"
              aria-label={t("memberDetail.attendance.filterLabel", { defaultValue: "Filter attendance logs" })}
            >
              <option value="ALL">{t("memberDetail.attendance.allLogs", { defaultValue: "All logs" })}</option>
              <option value="AUTHORIZED">{t("attendance.badges.authorized")}</option>
              <option value="REJECTED">{t("attendance.badges.denied")}</option>
              <option value="IN">{t("attendance.badges.in")}</option>
              <option value="OUT">{t("attendance.badges.out")}</option>
            </select>
          </label>
        </div>
      </div>

      <DataTableShell className="mt-4">
        <DataTable variant="compact" minWidth="920px">
          <DataTableHead>
            <DataTableRow>
              <DataTableHeaderCell>{t("memberDetail.attendance.columns.dateTime", { defaultValue: "Date & Time" })}</DataTableHeaderCell>
              <DataTableHeaderCell>{t("attendance.table.type")}</DataTableHeaderCell>
              <DataTableHeaderCell>{t("attendance.filters.source")}</DataTableHeaderCell>
              <DataTableHeaderCell>{t("attendance.badges.authorized")}</DataTableHeaderCell>
              <DataTableHeaderCell>{t("common.labels.status")}</DataTableHeaderCell>
              <DataTableHeaderCell>{t("memberDetail.attendance.columns.remarks", { defaultValue: "Remarks" })}</DataTableHeaderCell>
            </DataTableRow>
          </DataTableHead>
          <DataTableBody>
            {visibleLogs.length === 0 ? (
              <DataTableEmptyRow colSpan={6}>{t("memberDetail.attendance.empty")}</DataTableEmptyRow>
            ) : (
              visibleLogs.map((log) => (
                <DataTableRow key={log.id}>
                  <DataTableCell>
                    <div className="flex items-center gap-2">
                      <IconCalendar className="h-4 w-4 shrink-0 text-brand-400" stroke={1.7} />
                      <div>
                        <p className="text-[11px] font-semibold text-slate-950 dark:text-white">{formatLocalizedDate(log.recordedAt, i18n.language)}</p>
                        <p className="mt-0.5 text-[10px] text-slate-500 dark:text-slate-400">{formatLocalizedTime(log.recordedAt, i18n.language)}</p>
                      </div>
                    </div>
                  </DataTableCell>
                  <DataTableCell>
                    <AttendanceEventBadge log={log} />
                  </DataTableCell>
                  <DataTableCell>
                    <div className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase text-slate-600 dark:text-slate-300">
                      <IconDeviceMobile className="h-4 w-4 text-slate-400" stroke={1.7} />
                      {formatSourceLabel(log.source, t)}
                    </div>
                  </DataTableCell>
                  <DataTableCell>
                    <div className={`inline-flex items-center gap-1.5 text-[11px] font-semibold ${log.isAuthorized ? "text-emerald-700 dark:text-emerald-200" : "text-rose-700 dark:text-rose-200"}`}>
                      <IconShieldCheck className="h-4 w-4" stroke={1.8} />
                      {log.isAuthorized ? t("common.values.yes") : t("common.values.no")}
                    </div>
                  </DataTableCell>
                  <DataTableCell>
                    <AttendanceStatusBadge log={log} />
                  </DataTableCell>
                  <DataTableCell>
                    <span className="text-[11px] text-slate-600 dark:text-slate-300">
                      {log.reason ? formatAccessReason(log.reason, t) : "-"}
                    </span>
                  </DataTableCell>
                </DataTableRow>
              ))
            )}
          </DataTableBody>
        </DataTable>
      </DataTableShell>

      <PaginationControls
        className="mt-3"
        page={currentPage}
        pageSize={pageSize}
        showFirstLast
        showPageSize
        totalItems={filteredLogs.length}
        totalPages={totalPages}
        onPageChange={setPage}
      />
    </section>
  );
}

function AttendanceEventBadge({ log }: { log: ProfileAttendanceLog }) {
  const { t } = useTranslation();
  const isOut = log.entryType === "OUT";
  const isIn = log.entryType === "IN";
  const label = isIn ? t("attendance.badges.in") : isOut ? t("attendance.badges.out") : log.entryType;
  const Icon = isOut ? IconLogout : IconLogin;
  const tone = isOut
    ? "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200"
    : "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200";
  return (
    <span className={`inline-flex items-center gap-2 rounded-full border px-2 py-1 text-[11px] font-semibold ${tone}`}>
      <Icon className="h-4 w-4" stroke={1.7} />
      {label}
    </span>
  );
}

function AttendanceStatusBadge({ log }: { log: ProfileAttendanceLog }) {
  const { t } = useTranslation();
  const authorized = log.isAuthorized;
  const label = authorized ? t("attendance.badges.authorized") : t("attendance.badges.denied");
  const Icon = authorized ? IconCircleCheck : IconCircleDashed;
  const tone = authorized
    ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200"
    : "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200";
  return (
    <span className={`inline-flex items-center gap-2 rounded-full border px-2 py-1 text-[11px] font-semibold ${tone}`}>
      <Icon className="h-4 w-4" stroke={1.7} />
      {label}
    </span>
  );
}

function PaymentsTab({
  profile,
  canRecord,
  onRecordPayment,
}: {
  profile: FullMemberProfile;
  canRecord: boolean;
  onRecordPayment: () => void;
}) {
  const { t, i18n } = useTranslation();
  const payments = profile.payments;
  const totalPaid = profile.aggregates.totalPaid ?? payments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
  const creditBalance = profile.aggregates.creditBalance ?? 0;
  const outstanding = profile.aggregates.outstandingBalance ?? 0;

  return (
    <section className="rounded-2xl border border-slate-200 bg-white/80 p-3 shadow-sm dark:border-slate-800/80 dark:bg-slate-900/50 sm:p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-start gap-3">
          <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-600 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200">
            <IconCashBanknote className="h-5 w-5" stroke={1.8} />
          </span>
          <div>
            <h3 className="text-sm font-semibold text-slate-950 dark:text-white">{t("memberDetail.tabs.payments")}</h3>
            <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">{t("memberDetail.payments.ledger")}</p>
          </div>
        </div>
        {canRecord ? (
          <button
            type="button"
            onClick={onRecordPayment}
            className="inline-flex h-9 items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 text-[11px] font-semibold text-emerald-700 transition hover:border-emerald-300 hover:bg-emerald-100 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-100 dark:hover:bg-emerald-500/20"
          >
            <IconCashBanknote className="h-4 w-4" stroke={1.8} />
            {t("memberDetail.payments.record")}
          </button>
        ) : null}
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <PaymentMetric
          icon={<IconWallet className="h-4 w-4" stroke={1.8} />}
          label={t("memberDetail.stats.paymentsApplied")}
          value={`${formatLocalizedNumber(totalPaid, i18n.language)} AFN`}
          tone="brand"
        />
        <PaymentMetric
          icon={<IconCreditCard className="h-4 w-4" stroke={1.8} />}
          label={t("memberDetail.stats.outstanding")}
          value={`${formatLocalizedNumber(outstanding, i18n.language)} AFN`}
          tone="amber"
        />
        <PaymentMetric
          icon={<IconCashBanknote className="h-4 w-4" stroke={1.8} />}
          label={t("memberDetail.stats.creditBalance")}
          value={`${formatLocalizedNumber(creditBalance, i18n.language)} AFN`}
          tone="emerald"
        />
        <PaymentMetric
          icon={<IconCalendarCheck className="h-4 w-4" stroke={1.8} />}
          label={t("memberDetail.payments.receiptsCount", { defaultValue: "Receipts" })}
          value={formatLocalizedNumber(payments.length, i18n.language)}
          tone="violet"
        />
      </div>

      <DataTableShell className="mt-4">
        <DataTable variant="compact" minWidth="880px">
          <DataTableHead>
            <DataTableRow>
              <DataTableHeaderCell>{t("memberDetail.payments.columns.date", { defaultValue: "Date" })}</DataTableHeaderCell>
              <DataTableHeaderCell>{t("memberDetail.payments.columns.amount", { defaultValue: "Amount" })}</DataTableHeaderCell>
              <DataTableHeaderCell>{t("memberDetail.payments.columns.method", { defaultValue: "Method" })}</DataTableHeaderCell>
              <DataTableHeaderCell>{t("common.labels.status")}</DataTableHeaderCell>
              <DataTableHeaderCell>{t("memberDetail.payments.columns.type", { defaultValue: "Type" })}</DataTableHeaderCell>
              <DataTableHeaderCell>{t("memberDetail.payments.columns.reference", { defaultValue: "Reference / notes" })}</DataTableHeaderCell>
            </DataTableRow>
          </DataTableHead>
          <DataTableBody>
            {payments.length === 0 ? (
              <DataTableEmptyRow colSpan={6}>{t("memberDetail.payments.empty")}</DataTableEmptyRow>
            ) : (
              payments.map((payment) => (
                <DataTableRow key={payment.id}>
                  <DataTableCell>
                    <div className="flex items-center gap-2">
                      <IconCalendar className="h-4 w-4 shrink-0 text-brand-400" stroke={1.7} />
                      <div>
                        <p className="text-[11px] font-semibold text-slate-950 dark:text-white">
                          {formatLocalizedDate(payment.paidAt ?? payment.createdAt, i18n.language)}
                        </p>
                        <p className="mt-0.5 text-[10px] text-slate-500 dark:text-slate-400">
                          {formatLocalizedTime(payment.paidAt ?? payment.createdAt, i18n.language)}
                        </p>
                      </div>
                    </div>
                  </DataTableCell>
                  <DataTableCell className="font-semibold text-slate-950 dark:text-white">
                    {formatLocalizedNumber(payment.amount, i18n.language)} {payment.currency}
                  </DataTableCell>
                  <DataTableCell>
                    <span className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase text-slate-600 dark:text-slate-300">
                      <IconCreditCard className="h-4 w-4 text-slate-400" stroke={1.7} />
                      {payment.method}
                    </span>
                  </DataTableCell>
                  <DataTableCell>
                    <PaymentStatusBadge status={payment.status} />
                  </DataTableCell>
                  <DataTableCell>
                    <PaymentTypeBadge applied={Boolean(payment.membershipId)} />
                  </DataTableCell>
                  <DataTableCell>
                    <div className="max-w-sm text-[11px] text-slate-600 dark:text-slate-300">
                      {payment.reference ? <p className="font-semibold">{t("memberDetail.payments.receipt", { reference: payment.reference })}</p> : null}
                      <p className="mt-0.5 truncate">{payment.notes?.trim() || "-"}</p>
                    </div>
                  </DataTableCell>
                </DataTableRow>
              ))
            )}
          </DataTableBody>
        </DataTable>
      </DataTableShell>
    </section>
  );
}

function PaymentMetric({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  tone: "brand" | "emerald" | "amber" | "violet";
}) {
  const tones = {
    brand: "border-brand-200 bg-brand-50 text-brand-600 dark:border-brand-500/30 dark:bg-brand-500/10 dark:text-brand-200",
    emerald: "border-emerald-200 bg-emerald-50 text-emerald-600 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200",
    amber: "border-amber-200 bg-amber-50 text-amber-600 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200",
    violet: "border-violet-200 bg-violet-50 text-violet-600 dark:border-violet-500/30 dark:bg-violet-500/10 dark:text-violet-200",
  };
  return (
    <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-3 dark:border-slate-800 dark:bg-slate-950/40">
      <span className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${tones[tone]}`}>{icon}</span>
      <div>
        <p className="text-sm font-semibold text-slate-950 dark:text-white">{value}</p>
        <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</p>
      </div>
    </div>
  );
}

function PaymentStatusBadge({ status }: { status: string }) {
  const normalized = status.toLowerCase();
  const isPosted = normalized === "posted" || normalized === "paid" || normalized === "completed";
  const tone = isPosted
    ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200"
    : "border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-200";
  return <span className={`inline-flex rounded-full border px-2 py-1 text-[10px] font-semibold uppercase ${tone}`}>{status || "-"}</span>;
}

function PaymentTypeBadge({ applied }: { applied: boolean }) {
  const { t } = useTranslation();
  const tone = applied
    ? "border-brand-200 bg-brand-50 text-brand-700 dark:border-brand-500/30 dark:bg-brand-500/10 dark:text-brand-200"
    : "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200";
  return (
    <span className={`inline-flex rounded-full border px-2 py-1 text-[10px] font-semibold uppercase ${tone}`}>
      {applied ? t("memberDetail.payments.applied") : t("memberDetail.payments.credit")}
    </span>
  );
}

function RecordPaymentModal({
  open,
  onClose,
  onSubmit,
  submitting,
  error,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (payload: { amount: number; paidAt?: string; notes?: string }) => Promise<void> | void;
  submitting: boolean;
  error: string | null;
}) {
  const { t, i18n } = useTranslation();
  const { push } = useToast();
  const [amount, setAmount] = useState("");
  const [paidAt, setPaidAt] = useState("");
  const [notes, setNotes] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);

  useModalDismiss(onClose, open);

  useEffect(() => {
    if (open && localError) {
      push({ kind: "error", title: localError });
    }
  }, [localError, open, push]);

  useEffect(() => {
    if (open && error) {
      push({ kind: "error", title: error });
    }
  }, [error, open, push]);

  if (!open) return null;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLocalError(null);
    const parsedAmount = Number(amount);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setLocalError(t("memberDetail.payments.errors.amount"));
      return;
    }
    let paidAtValue: string | undefined;
    if (paidAt) {
      const paidAtIso = localDateTimeInputToIso(paidAt);
      if (!paidAtIso) {
        setLocalError(t("memberDetail.payments.errors.paidAt"));
        return;
      }
      paidAtValue = paidAtIso;
    }
    const trimmedNotes = notes.trim();
    await onSubmit({
      amount: parsedAmount,
      ...(paidAtValue ? { paidAt: paidAtValue } : {}),
      ...(trimmedNotes ? { notes: trimmedNotes } : {}),
    });
  };

  return (
    <div className="modal-overlay fixed inset-0 z-40 flex items-center justify-center bg-black/60 p-4 sm:p-6" onClick={onClose}>
      <div className="w-full max-w-xl rounded-2xl border border-slate-800/80 bg-slate-950 p-4 sm:p-5 shadow-2xl shadow-black/40" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-white">{t("memberDetail.payments.record")}</h3>
            <p className="text-xs text-slate-400">{t("memberDetail.payments.recordHint")}</p>
          </div>
          <CloseIconButton label={t("common.actions.close")} onClick={onClose} />
        </div>
        <form onSubmit={handleSubmit} className="mt-3 space-y-3">
          <div>
            <label className="text-xs font-semibold text-slate-300">{t("memberDetail.payments.fields.amount")}</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              className="form-input"
              placeholder={t("memberDetail.payments.placeholders.amount")}
              required
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-300">{t("memberDetail.payments.fields.paidAt")}</label>
            <LocalizedDateTimeInput value={paidAt} onChange={setPaidAt} locale={i18n.language} inputClassName="form-input" />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-300">{t("memberDetail.payments.fields.notes")}</label>
            <textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              className="form-input min-h-[72px]"
              placeholder={t("memberDetail.payments.placeholders.notes")}
            />
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="btn-cancel rounded-lg border border-slate-700 px-3 py-1.5 text-[11px] font-semibold text-slate-200"
              disabled={submitting}
            >
              {t("common.actions.cancel")}
            </button>
            <button
              type="submit"
              className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-1.5 text-[11px] font-semibold text-emerald-100 hover:bg-emerald-500/20"
              disabled={submitting}
            >
              {submitting ? t("common.actions.saving") : t("memberDetail.payments.save")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ShiftsTab({ profile }: { profile: FullMemberProfile }) {
  const { t, i18n } = useTranslation();
  const groupShifts = (profile.shifts ?? []).filter((s) => s.isFromGroup);
  const extraShifts = (profile.shifts ?? []).filter((s) => !s.isFromGroup);
  const overtime = profile.overtimePolicy;
  return (
    <div className="space-y-3">
      <div className="grid gap-3 xl:grid-cols-2">
        <ShiftPanel
          title={t("memberDetail.shifts.groupTitle")}
          icon={<IconCalendar className="h-5 w-5" stroke={1.8} />}
          tone="brand"
        >
          {groupShifts.length === 0 ? (
            <ShiftEmptyState
              title={t("memberDetail.shifts.emptyGroup")}
              description={t("memberDetail.shifts.emptyGroupHint", { defaultValue: "Assigned group shifts will appear here." })}
            />
          ) : (
            <div className="space-y-2">
              {groupShifts.map((shift) => (
                <ShiftCard key={shift.id} shift={shift} tone="brand" />
              ))}
            </div>
          )}
        </ShiftPanel>
        <ShiftPanel
          title={t("memberDetail.shifts.extraTitle")}
          icon={<IconCalendarEvent className="h-5 w-5" stroke={1.8} />}
          tone="emerald"
        >
          {extraShifts.length === 0 ? (
            <ShiftEmptyState
              title={t("memberDetail.shifts.emptyExtra")}
              description={t("memberDetail.shifts.emptyExtraHint", { defaultValue: "Extra or custom shifts will appear here." })}
            />
          ) : (
            <div className="space-y-2">
              {extraShifts.map((shift) => (
                <ShiftCard key={shift.id} shift={shift} tone="emerald" />
              ))}
            </div>
          )}
        </ShiftPanel>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white/80 p-3 shadow-sm dark:border-slate-800/80 dark:bg-slate-900/50 sm:p-4">
        <div className="mb-4 flex items-center gap-3">
          <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-brand-200 bg-brand-50 text-brand-600 dark:border-brand-500/30 dark:bg-brand-500/10 dark:text-brand-200">
            <IconClock className="h-5 w-5" stroke={1.8} />
          </span>
          <h3 className="text-sm font-semibold text-slate-950 dark:text-white">
            {t("memberDetail.shifts.overtimeDetailsTitle", { defaultValue: "Overtime & rate details" })}
          </h3>
        </div>
        {overtime ? (
          <>
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
              <ShiftMetric
                label={t("common.labels.allowed")}
                value={overtime.allowOvertime ? t("common.values.yes") : t("common.values.no")}
                icon={<IconShieldCheck className="h-5 w-5" stroke={1.8} />}
                tone={overtime.allowOvertime ? "emerald" : "slate"}
              />
              <ShiftMetric
                label={t("common.labels.rateType")}
                value={overtime.overtimeRateType ? t(`salary.types.${overtime.overtimeRateType.toLowerCase()}`) : "-"}
                icon={<IconIdBadge className="h-5 w-5" stroke={1.8} />}
                tone="amber"
              />
              <ShiftMetric
                label={t("common.labels.amount")}
                value={formatLocalizedNumber(overtime.overtimeAmount ?? 0, i18n.language)}
                icon={<IconCashBanknote className="h-5 w-5" stroke={1.8} />}
                tone="brand"
              />
              <ShiftMetric
                label={t("common.labels.maxPerDay")}
                value={formatLocalizedNumber(overtime.maxOvertimePerDay ?? 0, i18n.language)}
                icon={<IconCalendarEvent className="h-5 w-5" stroke={1.8} />}
                tone="violet"
              />
            </div>
            <div className="mt-3 flex items-start gap-2 rounded-xl border border-brand-200 bg-brand-50/70 px-3 py-2 text-[11px] text-slate-600 dark:border-brand-500/20 dark:bg-brand-500/10 dark:text-slate-300">
              <IconInfoCircle className="mt-0.5 h-4 w-4 shrink-0 text-brand-500 dark:text-brand-200" stroke={1.8} />
              <span>
                {t("memberDetail.shifts.overtimeHint", {
                  defaultValue:
                    "Overtime is calculated based on the defined rate type and amount. The system will apply the rules automatically during payroll processing.",
                })}
              </span>
            </div>
          </>
        ) : (
          <ShiftEmptyState
            title={t("memberDetail.shifts.noOvertime")}
            description={t("memberDetail.shifts.noOvertimeHint", { defaultValue: "Overtime rules will appear here after they are configured." })}
          />
        )}
      </section>
    </div>
  );
}

type ShiftTone = OverviewTone | "slate";

const shiftToneStyles: Record<ShiftTone, { icon: string; card: string; badge: string }> = {
  brand: {
    icon: overviewToneStyles.brand.icon,
    card: "border-brand-200 bg-brand-50/60 dark:border-brand-500/25 dark:bg-brand-500/10",
    badge: overviewToneStyles.brand.pill,
  },
  violet: {
    icon: overviewToneStyles.violet.icon,
    card: "border-violet-200 bg-violet-50/60 dark:border-violet-500/25 dark:bg-violet-500/10",
    badge: overviewToneStyles.violet.pill,
  },
  emerald: {
    icon: overviewToneStyles.emerald.icon,
    card: "border-emerald-200 bg-emerald-50/60 dark:border-emerald-500/25 dark:bg-emerald-500/10",
    badge: overviewToneStyles.emerald.pill,
  },
  amber: {
    icon: overviewToneStyles.amber.icon,
    card: "border-amber-200 bg-amber-50/60 dark:border-amber-500/25 dark:bg-amber-500/10",
    badge: overviewToneStyles.amber.pill,
  },
  slate: {
    icon: "border-slate-200 bg-slate-100 text-slate-600 dark:border-slate-700 dark:bg-slate-800/70 dark:text-slate-200",
    card: "border-slate-200 bg-slate-50/80 dark:border-slate-800 dark:bg-slate-950/40",
    badge: "border-slate-200 bg-slate-100 text-slate-600 dark:border-slate-700 dark:bg-slate-800/70 dark:text-slate-200",
  },
};

function ShiftPanel({
  title,
  icon,
  tone,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  tone: ShiftTone;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white/80 p-3 shadow-sm dark:border-slate-800/80 dark:bg-slate-900/50 sm:p-4">
      <div className="mb-4 flex items-center gap-3">
        <span className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${shiftToneStyles[tone].icon}`}>
          {icon}
        </span>
        <h3 className="text-sm font-semibold text-slate-950 dark:text-white">{title}</h3>
      </div>
      {children}
    </section>
  );
}

function ShiftCard({ shift, tone }: { shift: ProfileShift; tone: ShiftTone }) {
  const { t, i18n } = useTranslation();
  const rate = shift.rateOverride ?? shift.salaryAmount;
  return (
    <div className={`rounded-2xl border p-3 ${shiftToneStyles[tone].card}`}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <span className={`inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border ${shiftToneStyles[tone].icon}`}>
            <IconSun className="h-5 w-5" stroke={1.8} />
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-slate-950 dark:text-white">{shift.shiftName}</p>
            <p className="mt-1 text-[11px] text-slate-600 dark:text-slate-300">
              {shift.shiftStart} - {shift.shiftEnd} | {shift.isFromGroup ? t("memberDetail.shifts.group") : t("memberDetail.shifts.extra")}
            </p>
            <p className="mt-1 text-[11px] font-semibold text-brand-600 dark:text-brand-200">
              {t("memberDetail.shifts.rate", { rate: formatLocalizedNumber(rate, i18n.language) })}
            </p>
          </div>
        </div>
        <span className={`inline-flex w-fit rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase ${shiftToneStyles[tone].badge}`}>
          {t(`salary.types.${shift.salaryType.toLowerCase()}`)}
        </span>
      </div>
    </div>
  );
}

function ShiftEmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="flex min-h-36 flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50/60 px-4 py-6 text-center dark:border-slate-700 dark:bg-slate-950/30">
      <span className="inline-flex h-12 w-12 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-400 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-400">
        <IconCalendarCheck className="h-6 w-6" stroke={1.7} />
      </span>
      <p className="mt-3 text-sm font-semibold text-slate-950 dark:text-white">{title}</p>
      <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">{description}</p>
    </div>
  );
}

function ShiftMetric({
  label,
  value,
  icon,
  tone,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  tone: ShiftTone;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-3 dark:border-slate-800 dark:bg-slate-950/40">
      <span className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${shiftToneStyles[tone].icon}`}>
        {icon}
      </span>
      <div className="min-w-0">
        <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">{label}</p>
        <p className="mt-0.5 truncate text-sm font-semibold text-slate-950 dark:text-white">{value}</p>
      </div>
    </div>
  );
}

function AccessTab({ profile }: { profile: FullMemberProfile }) {
  const { t, i18n } = useTranslation();
  const access = profile.accessPolicy;
  const device = profile.deviceUser;
  const accessRules = access ? [...access.rules].sort((a, b) => a.weekday - b.weekday || a.fromTime.localeCompare(b.fromTime)) : [];
  return (
    <div className="space-y-3">
      <div className="grid gap-3 xl:grid-cols-[1.05fr_0.95fr]">
        <ShiftPanel title={t("memberDetail.access.title")} icon={<IconShieldLock className="h-5 w-5" stroke={1.8} />} tone="brand">
          {access ? (
            <div className="space-y-3">
              <div className="rounded-2xl border border-brand-200 bg-brand-50/60 px-3 py-3 dark:border-brand-500/25 dark:bg-brand-500/10">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{t("common.labels.allowedDays")}</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {formatAllowedDays(access.allowedDays, t).map((day) => (
                    <span key={day} className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-semibold ${shiftToneStyles.brand.badge}`}>
                      {day}
                    </span>
                  ))}
                </div>
              </div>
              {accessRules.length > 0 ? (
                <div className="grid gap-2 sm:grid-cols-2">
                  {accessRules.map((rule) => (
                    <AccessRuleCard key={rule.id} day={formatWeekday(rule.weekday, t)} from={rule.fromTime} to={rule.toTime} />
                  ))}
                </div>
              ) : (
                <ShiftEmptyState title={t("memberDetail.access.empty")} description={t("memberDetail.access.empty")} />
              )}
            </div>
          ) : (
            <ShiftEmptyState title={t("memberDetail.access.empty")} description={t("memberDetail.access.empty")} />
          )}
        </ShiftPanel>

        <ShiftPanel title={t("memberDetail.access.devicesTitle")} icon={<IconDeviceMobile className="h-5 w-5" stroke={1.8} />} tone="violet">
          {device ? (
            <div className="grid gap-2 sm:grid-cols-2">
              <ShiftMetric label={t("common.labels.deviceUserId")} value={device.id} icon={<IconIdBadge className="h-5 w-5" stroke={1.8} />} tone="brand" />
              <ShiftMetric label={t("common.labels.externalId")} value={formatLocalizedNumber(device.externalId, i18n.language)} icon={<IconDeviceMobile className="h-5 w-5" stroke={1.8} />} tone="violet" />
              <ShiftMetric label={t("common.labels.card")} value={device.cardNumber ?? "-"} icon={<IconCreditCard className="h-5 w-5" stroke={1.8} />} tone="emerald" />
              <ShiftMetric label={t("common.labels.pin")} value={device.pin ?? "-"} icon={<IconLockAccess className="h-5 w-5" stroke={1.8} />} tone="amber" />
            </div>
          ) : (
            <ShiftEmptyState title={t("memberDetail.access.noDevice")} description={t("memberDetail.access.noDevice")} />
          )}
        </ShiftPanel>
      </div>

      <div className="grid gap-3 xl:grid-cols-2">
        <ShiftPanel title={t("memberDetail.access.violationsTitle")} icon={<IconShieldX className="h-5 w-5" stroke={1.8} />} tone="amber">
          {profile.accessViolations.length > 0 ? (
            <div className="space-y-2">
              {profile.accessViolations.map((violation) => (
                <div
                  key={violation.id}
                  className="rounded-2xl border border-rose-200 bg-rose-50/70 px-3 py-3 text-[11px] text-rose-900 dark:border-rose-500/25 dark:bg-rose-500/10 dark:text-rose-100"
                >
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                    <p className="font-semibold">{formatAccessReason(violation.reason, t)}</p>
                    <p className="text-[10px] font-medium text-rose-700 dark:text-rose-200">{formatLocalizedDateTime(violation.occurredAt, i18n.language)}</p>
                  </div>
                  {violation.notes ? <p className="mt-2 text-[10px] text-rose-700 dark:text-rose-200">{violation.notes}</p> : null}
                </div>
              ))}
            </div>
          ) : (
            <ShiftEmptyState title={t("memberDetail.access.violationsTitle")} description={t("common.values.none")} />
          )}
        </ShiftPanel>

        <ShiftPanel title={t("memberDetail.access.doorEventsTitle")} icon={<IconLogin className="h-5 w-5" stroke={1.8} />} tone="emerald">
          {profile.doorEvents.length > 0 ? (
            <div className="space-y-2">
              {profile.doorEvents.map((event) => (
                <div key={event.id} className="rounded-2xl border border-slate-200 bg-slate-50/80 px-3 py-3 dark:border-slate-800 dark:bg-slate-950/40">
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                    <p className="text-[11px] font-semibold text-slate-950 dark:text-white">{event.action}</p>
                    <OverviewPill tone={event.success ? "emerald" : "amber"}>{event.triggerType}</OverviewPill>
                  </div>
                  <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">{formatLocalizedDateTime(event.requestedAt, i18n.language)}</p>
                  {event.notes ? <p className="mt-1 text-[10px] text-slate-500 dark:text-slate-400">{event.notes}</p> : null}
                </div>
              ))}
            </div>
          ) : (
            <ShiftEmptyState title={t("memberDetail.access.doorEventsTitle")} description={t("common.values.none")} />
          )}
        </ShiftPanel>
      </div>
    </div>
  );
}

function MembershipTab({ profile }: { profile: FullMemberProfile }) {
  const { t, i18n } = useTranslation();
  if (!profile.memberships || profile.memberships.length === 0) {
    return <ShiftEmptyState title={t("memberDetail.memberships.empty")} description={t("memberDetail.memberships.empty")} />;
  }
  return (
    <div className="grid gap-3 lg:grid-cols-2">
      {profile.memberships.map((m) => (
        <section key={m.id} className="rounded-2xl border border-slate-200 bg-white/80 p-3 shadow-sm dark:border-slate-800/80 dark:bg-slate-900/50 sm:p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex min-w-0 items-start gap-3">
              <span className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${shiftToneStyles.brand.icon}`}>
                <IconIdBadge className="h-5 w-5" stroke={1.8} />
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-slate-950 dark:text-white">{m.plan?.name ?? m.planId}</p>
                <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                  {formatLocalizedDate(m.startDate, i18n.language)} - {formatLocalizedDate(m.endDate, i18n.language)}
                </p>
              </div>
            </div>
            <MembershipStatusPill status={m.status} />
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            <MembershipMetric label={t("membershipPlans.form.basePrice")} value={formatLocalizedNumber(m.basePrice, i18n.language)} tone="brand" />
            <MembershipMetric label={t("common.labels.totalPaid")} value={formatLocalizedNumber(m.totalPaid, i18n.language)} tone="emerald" />
            <MembershipMetric label={t("common.labels.outstanding")} value={formatLocalizedNumber(Math.max(0, m.totalDue - m.totalPaid), i18n.language)} tone="amber" />
          </div>
          {m.activatedAt ? <p className="mt-3 text-[11px] text-slate-500 dark:text-slate-400">{formatLocalizedDateTime(m.activatedAt, i18n.language)}</p> : null}
        </section>
      ))}
    </div>
  );
}

function AccessRuleCard({ day, from, to }: { day: string; from: string; to: string }) {
  return (
    <div className={`rounded-2xl border px-3 py-3 ${shiftToneStyles.slate.card}`}>
      <div className="flex items-center gap-3">
        <span className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border ${shiftToneStyles.brand.icon}`}>
          <IconCalendar className="h-4.5 w-4.5" stroke={1.8} />
        </span>
        <div className="min-w-0">
          <p className="text-[11px] font-semibold text-slate-950 dark:text-white">{day}</p>
          <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
            {from} - {to}
          </p>
        </div>
      </div>
    </div>
  );
}

function MembershipMetric({ label, value, tone }: { label: string; value: string; tone: ShiftTone }) {
  return (
    <div className={`rounded-xl border px-3 py-2.5 ${shiftToneStyles[tone].card}`}>
      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</p>
      <p className="mt-1 text-sm font-semibold text-slate-950 dark:text-white">{value}</p>
    </div>
  );
}

function MembershipStatusPill({ status }: { status: string }) {
  const { t } = useTranslation();
  const tone: ShiftTone = status === "ACTIVE" ? "emerald" : status === "DEBTOR" || status === "PENDING" ? "amber" : status === "EXPIRED" ? "slate" : "violet";
  return <span className={`inline-flex w-fit rounded-full border px-2.5 py-1 text-[10px] font-semibold ${shiftToneStyles[tone].badge}`}>{formatMembershipStatusLabel(status, t)}</span>;
}

function formatMembershipStatusLabel(status: string, t: (key: string) => string) {
  const normalized = status.toLowerCase();
  if (["active", "pending", "expired", "cancelled", "debtor"].includes(normalized)) {
    return t(`paymentsPage.membershipStatus.${normalized}`);
  }
  return status;
}

function formatFingerLabel(fingerId: number | null, t: (key: string, options?: Record<string, unknown>) => string) {
  if (fingerId === null || fingerId === undefined) return t("common.values.none");
  const key = FINGER_LABEL_KEYS[fingerId];
  const label = key ? t(key) : t("finger.generic", { id: fingerId });
  return t("finger.labelWithId", { label, id: fingerId });
}

function formatWeekday(weekday: number, t: (key: string) => string) {
  const key = WEEKDAY_KEYS[weekday];
  return key ? t(`weekdays.short.${key}`) : String(weekday);
}

function formatAllowedDays(days: number[], t: (key: string) => string) {
  const normalized = Array.from(new Set(days)).sort((a, b) => a - b);
  const hasEveryDay = WEEKDAY_KEYS.every((_, weekday) => normalized.includes(weekday));
  if (hasEveryDay) return [t("common.labels.everyDay")];
  if (normalized.length === 0) return ["-"];
  return normalized.map((day) => formatWeekday(day, t));
}

function formatLocalizedNumber(value: number | string | null | undefined, locale = "en") {
  const numeric = typeof value === "number" ? value : Number(value ?? 0);
  if (Number.isNaN(numeric)) return String(value ?? "-");
  return numeric.toLocaleString(resolveDateLocale(locale));
}

function TabButton({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-2.5 py-1 text-[11px] font-semibold transition ${active ? "bg-brand-500/30 text-white" : "text-slate-400 hover:text-white"}`}
    >
      {label}
    </button>
  );
}

function formatLocalizedDate(value: string | Date | null | undefined, locale = "en") {
  if (!value) return "-";
  const parsed = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(parsed.getTime())) return "-";
  return parsed.toLocaleDateString(resolveDateLocale(locale));
}

function formatLocalizedTime(value: string | Date | null | undefined, locale = "en") {
  if (!value) return "-";
  const parsed = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(parsed.getTime())) return "-";
  return parsed.toLocaleTimeString(resolveDateLocale(locale), { hour: "2-digit", minute: "2-digit" });
}

function formatLocalizedDateTime(value: string | Date | null | undefined, locale = "en") {
  if (!value) return "-";
  const parsed = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(parsed.getTime())) return "-";
  return parsed.toLocaleString(resolveDateLocale(locale));
}

function formatAttendanceRangeLabel(
  logs: ProfileAttendanceLog[],
  locale: string,
  t: (key: string, options?: Record<string, unknown>) => string,
) {
  const dates = logs
    .map((log) => (log.recordedAt instanceof Date ? log.recordedAt : new Date(log.recordedAt)))
    .filter((date) => !Number.isNaN(date.getTime()))
    .sort((a, b) => a.getTime() - b.getTime());
  if (!dates.length) return t("memberDetail.attendance.allDates", { defaultValue: "All dates" });
  const first = dates[0];
  const last = dates[dates.length - 1];
  const firstLabel = formatLocalizedDate(first, locale);
  const lastLabel = formatLocalizedDate(last, locale);
  if (firstLabel === lastLabel) return firstLabel;
  return `${firstLabel} - ${lastLabel}`;
}

function formatSourceLabel(source: string, t: (key: string) => string) {
  if (source === "MANUAL") return t("attendance.badges.manual");
  if (source === "API") return t("attendance.badges.api");
  return t("attendance.badges.device");
}

