import { useCallback, useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  deleteMember,
  getMember,
  getMemberAttendance,
  getMemberMemberships,
  getMemberPayments,
  type Member,
} from "../../api/members";
import { MemberStatusBadge } from "../../components/members/MemberStatusBadge";
import { DeleteMemberModal } from "../../components/members/DeleteMemberModal";
import { useToast } from "../../components/ToastContext";
import { rtlLanguages } from "../../i18n/config";

type Tab = "info" | "memberships" | "payments" | "attendance";

export function MemberProfile() {
  const { id } = useParams<{ id: string }>();
  const { t, i18n } = useTranslation();
  const { push } = useToast();
  const navigate = useNavigate();
  const [member, setMember] = useState<Member | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("info");
  const [membershipRows, setMembershipRows] = useState<unknown[]>([]);
  const [paymentRows, setPaymentRows] = useState<unknown[]>([]);
  const [attendanceRows, setAttendanceRows] = useState<unknown[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const isRtl = rtlLanguages.includes(i18n.language.split("-")[0]);

  const loadMember = useCallback(() => {
    if (!id) return;
    void getMember(id)
      .then(({ data }) => setMember(data))
      .catch((err) => setError(err instanceof Error ? err.message : "خطا"))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    loadMember();
  }, [loadMember]);

  useEffect(() => {
    if (error) {
      push({ kind: "error", title: error });
    }
  }, [error, push]);

  useEffect(() => {
    if (!id) return;
    const fetchTabData = async () => {
      try {
        if (tab === "memberships" && membershipRows.length === 0) {
          const { data } = await getMemberMemberships(id);
          setMembershipRows(data);
        }
        if (tab === "payments" && paymentRows.length === 0) {
          const { data } = await getMemberPayments(id);
          setPaymentRows(data);
        }
        if (tab === "attendance" && attendanceRows.length === 0) {
          const { data } = await getMemberAttendance(id);
          setAttendanceRows(data);
        }
      } catch {
        // swallow and show placeholder
      }
    };
    fetchTabData();
  }, [attendanceRows.length, id, membershipRows.length, paymentRows.length, tab]);

  const handleDelete = async () => {
    if (!id) return;
    setDeleting(true);
    try {
      await deleteMember(id);
      navigate("/members");
    } catch {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4 rounded-3xl border border-slate-800/80 bg-slate-950/70 p-6" dir={isRtl ? "rtl" : "ltr"}>
        <div className="h-8 w-60 animate-pulse rounded-full bg-slate-800" />
        <div className="h-40 w-full animate-pulse rounded-3xl bg-slate-900/80" />
      </div>
    );
  }

  if (error || !member) {
    return (
      <div className="rounded-3xl border border-slate-800/80 bg-slate-950/70 p-6 text-slate-200" dir={isRtl ? "rtl" : "ltr"}>
        {error ?? "عضو یافت نشد"}
        <button type="button" onClick={() => navigate("/members")} className="btn-cancel mt-4 rounded-full border border-slate-700 px-4 py-1 text-sm text-slate-200">
          {t("members.actions.cancel")}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6" dir={isRtl ? "rtl" : "ltr"}>
      <div className="flex flex-col gap-4 rounded-3xl border border-slate-800/80 bg-slate-950/70 p-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="member-avatar flex h-20 w-20 items-center justify-center rounded-3xl bg-slate-900 text-xl font-semibold text-white">
            {member.firstName.at(0)}
          </div>
          <div>
            <h2 className="text-2xl font-semibold text-white">
              {[member.firstName, member.lastName].filter(Boolean).join(" ")}
            </h2>
            <p className="text-sm text-slate-400">{member.phone ?? "-"}</p>
            <div className="mt-2">
              <MemberStatusBadge status={member.status} />
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link
            to={`/members/${member.id}/edit`}
            className="btn-cancel rounded-2xl border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-200"
          >
            {t("members.actions.edit")}
          </Link>
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="member-delete-btn rounded-2xl border border-rose-500/40 bg-rose-500/10 px-4 py-2 text-sm font-semibold text-rose-100"
          >
            {t("members.actions.delete")}
          </button>
        </div>
      </div>

      <div className="rounded-3xl border border-slate-800/80 bg-slate-950/70">
        <div className="flex flex-wrap gap-2 border-b border-slate-800/70 px-4 py-3 text-sm text-slate-300">
          <TabButton label={t("members.profile.info")} active={tab === "info"} onClick={() => setTab("info")} />
          <TabButton label={t("members.profile.memberships")} active={tab === "memberships"} onClick={() => setTab("memberships")} />
          <TabButton label={t("members.profile.payments")} active={tab === "payments"} onClick={() => setTab("payments")} />
          <TabButton label={t("members.profile.attendance")} active={tab === "attendance"} onClick={() => setTab("attendance")} />
        </div>
        <div className="p-6">
          {tab === "info" && <InfoSection member={member} />}
          {tab === "memberships" && <ListSection rows={membershipRows} emptyLabel={t("members.profile.memberships")} />}
          {tab === "payments" && <ListSection rows={paymentRows} emptyLabel={t("members.profile.payments")} />}
          {tab === "attendance" && <ListSection rows={attendanceRows} emptyLabel={t("members.profile.attendance")} />}
        </div>
      </div>

  <DeleteMemberModal open={modalOpen} onClose={() => setModalOpen(false)} onConfirm={handleDelete} loading={deleting} />
    </div>
  );
}

function InfoSection({ member }: { member: Member }) {
  const infoRows = [
    { label: "کد", value: member.code },
    { label: "نام پدر", value: member.fatherName ?? "-" },
    { label: "ایمیل", value: member.email ?? "-" },
    { label: "جنسیت", value: member.gender ?? "-" },
    { label: "تاریخ انقضا", value: member.expiresAt ? new Date(member.expiresAt).toLocaleDateString() : "-" },
    { label: "آخرین حضور", value: member.lastAttendance ? new Date(member.lastAttendance).toLocaleString() : "-" },
  ];

  return (
    <dl className="grid gap-4 sm:grid-cols-2">
      {infoRows.map((row) => (
        <div key={row.label} className="rounded-2xl border border-slate-900/70 bg-slate-900/30 p-4">
          <dt className="text-xs uppercase tracking-wide text-slate-500">{row.label}</dt>
          <dd className="mt-1 text-sm text-slate-100">{row.value}</dd>
        </div>
      ))}
      <div className="sm:col-span-2">
        <dt className="text-xs uppercase tracking-wide text-slate-500">یادداشت</dt>
        <dd className="mt-2 rounded-2xl border border-slate-900/70 bg-slate-900/30 p-4 text-sm text-slate-200">{member.notes ?? "-"}</dd>
      </div>
    </dl>
  );
}

function ListSection({ rows, emptyLabel }: { rows: unknown[]; emptyLabel: string }) {
  if (!rows || rows.length === 0) {
    return <p className="text-sm text-slate-400">{emptyLabel}</p>;
  }

  return (
    <div className="space-y-3">
      {rows.map((row, index) => (
        <div key={rowKey(row, index)} className="rounded-2xl border border-slate-900/70 bg-slate-900/30 p-4 text-sm text-slate-200">
          <pre className="whitespace-pre-wrap text-xs text-slate-300">{JSON.stringify(row, null, 2)}</pre>
        </div>
      ))}
    </div>
  );
}

function rowKey(row: unknown, index: number) {
  if (row && typeof row === "object" && "id" in row) {
    const id = (row as { id?: unknown }).id;
    if (typeof id === "string" || typeof id === "number") return id;
  }
  return index;
}

function TabButton({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
        active ? "bg-brand-500/30 text-white" : "text-slate-400 hover:text-white"
      }`}
    >
      {label}
    </button>
  );
}
