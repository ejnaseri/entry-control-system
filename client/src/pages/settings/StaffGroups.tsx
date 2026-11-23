import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { rtlLanguages } from "../../i18n/config";
import { useToast } from "../../components/ToastContext";
import {
  createStaffGroup,
  deleteStaffGroup,
  getStaffGroups,
  updateStaffGroup,
  type StaffGroup,
  type StaffGroupPayload,
} from "../../api/staffGroups";
import { StaffGroupForm } from "../../components/staff-groups/StaffGroupForm";
import { useAuth } from "../../auth/AuthContext";

export function StaffGroups() {
  const { t, i18n } = useTranslation();
  const { push } = useToast();
  const { hasPermission } = useAuth();
  const canManage = hasPermission("SYSTEM_SETTINGS_MANAGE");
  const isRtl = rtlLanguages.includes(i18n.language.split("-")[0]);
  const [groups, setGroups] = useState<StaffGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<StaffGroup | null>(null);

  const loadGroups = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await getStaffGroups();
      setGroups(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("staffGroups.errors.load"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void loadGroups();
  }, [loadGroups]);

  useEffect(() => {
    if (error) {
      push({ kind: "error", title: error });
    }
  }, [error, push]);

  const handleSave = async (payload: StaffGroupPayload) => {
    if (!payload.shifts.length) {
      setError(t("staffGroups.errors.needShift"));
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      if (editing) {
        const { data } = await updateStaffGroup(editing.id, payload);
        setGroups((prev) => prev.map((g) => (g.id === editing.id ? (data as StaffGroup) : g)));
      } else {
        const { data } = await createStaffGroup(payload);
        setGroups((prev) => [data as StaffGroup, ...prev]);
      }
      setEditing(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("staffGroups.errors.save"));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm(t("staffGroups.confirm.delete"))) return;
    setSubmitting(true);
    try {
      await deleteStaffGroup(id);
      setGroups((prev) => prev.filter((g) => g.id !== id));
      if (editing?.id === id) setEditing(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("staffGroups.errors.delete"));
    } finally {
      setSubmitting(false);
    }
  };

  const sortedGroups = useMemo(() => [...groups].sort((a, b) => a.name.localeCompare(b.name)), [groups]);

  return (
    <div className="settings-compact staff-groups-compact space-y-4" dir={isRtl ? "rtl" : "ltr"}>
      <div className="rounded-2xl border border-slate-800/80 bg-slate-950/70 p-3 shadow-inner shadow-slate-950/60">
        <h2 className="text-sm font-semibold text-white">{t("staffGroups.title")}</h2>
        <p className="text-[11px] text-slate-400">{t("staffGroups.subtitle")}</p>
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        <div className="space-y-3 lg:col-span-2">
          {loading ? (
            <div className="space-y-3">
              <SkeletonCard />
              <SkeletonCard />
            </div>
          ) : sortedGroups.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-800/80 bg-slate-950/40 p-3 text-[11px] text-slate-300">
              {t("staffGroups.empty")}
            </div>
          ) : (
            <div className="grid gap-2 xl:grid-cols-2">
              {sortedGroups.map((group) => (
                <GroupCard key={group.id} group={group} onEdit={canManage ? setEditing : undefined} onDelete={canManage ? handleDelete : undefined} />
              ))}
            </div>
          )}
        </div>

        {canManage ? <div className="rounded-2xl border border-slate-800/80 bg-slate-950/70 p-3 shadow-xl shadow-slate-950/60 lg:sticky lg:top-20 lg:self-start">
          <div className="mb-2.5 flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-white">
                {editing ? t("staffGroups.actions.editGroup") : t("staffGroups.actions.createGroup")}
              </p>
            </div>
            {editing ? (
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="rounded-lg border border-slate-800 bg-slate-900 px-2.5 py-1 text-[11px] text-slate-200"
              >
                {t("staffGroups.actions.new")}
              </button>
            ) : null}
          </div>
          <StaffGroupForm
            key={editing?.id ?? "new"}
            initial={editing}
            submitting={submitting}
            onSubmit={handleSave}
            onCancel={() => setEditing(null)}
          />
        </div> : null}
      </div>
    </div>
  );
}

function GroupCard({ group, onEdit, onDelete }: { group: StaffGroup; onEdit?: (group: StaffGroup) => void; onDelete?: (id: string) => void }) {
  const { t } = useTranslation();
  const activeShifts = group.shifts.filter((shift) => shift.isActive).length;
  const preview = group.shifts.slice(0, 3);
  return (
    <div className="rounded-2xl border border-slate-800/80 bg-slate-950/60 p-2.5 shadow-inner shadow-slate-950/60 transition-colors hover:border-brand-500/40">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-white">{group.name}</p>
          <p className="mt-0.5 truncate text-[10px] text-slate-400" title={group.description || t("staffGroups.labels.noDescription")}>
            {group.description || t("staffGroups.labels.noDescription")}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {onEdit ? <button
            type="button"
            onClick={() => onEdit(group)}
            title={t("common.actions.edit")}
            aria-label={t("common.actions.edit")}
            className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-slate-700 bg-slate-900/40 text-slate-100 transition-colors hover:border-brand-400 hover:text-white"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} className="h-3 w-3">
              <path d="M12 20h9" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M16.5 3.5a2.12 2.12 0 1 1 3 3L7 19l-4 1 1-4 12.5-12.5z" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button> : null}
          {onDelete ? <button
            type="button"
            onClick={() => onDelete(group.id)}
            title={t("common.actions.delete")}
            aria-label={t("common.actions.delete")}
            className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-rose-500/40 bg-rose-500/10 text-rose-100 transition-colors hover:border-rose-400 hover:bg-rose-500/20"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} className="h-3 w-3">
              <path d="M3 6h18" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M8 6V4h8v2M7 6l1 14h8l1-14" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button> : null}
        </div>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <span className="inline-flex items-center rounded-full border border-slate-700 bg-slate-900/60 px-2 py-0.5 text-[9px] text-slate-300">
          {t("staffGroups.form.shiftTemplates")}: {group.shifts.length}
        </span>
        <span className="inline-flex items-center rounded-full border border-emerald-500/35 bg-emerald-500/10 px-2 py-0.5 text-[9px] text-emerald-200">
          {t("common.status.active")}: {activeShifts}
        </span>
        {group.accessLevel ? (
          <span className="inline-flex items-center rounded-full border border-brand-500/35 bg-brand-500/10 px-2 py-0.5 text-[9px] uppercase text-brand-200">
            {group.accessLevel}
          </span>
        ) : null}
      </div>

      <div className="mt-2.5 overflow-hidden rounded-lg border border-slate-800 bg-slate-900/45">
        {preview.length === 0 ? (
          <p className="px-2.5 py-2 text-[10px] text-slate-400">{t("staffGroups.validation.needShift")}</p>
        ) : (
          preview.map((shift, index) => (
            <div
              key={shift.id}
              className={`grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-2 px-2 py-1.5 text-[10px] ${
                index > 0 ? "border-t border-slate-800/80" : ""
              }`}
            >
              <div className="min-w-0">
                <p className="truncate font-semibold text-slate-100">{shift.shiftName}</p>
                <p className="truncate text-[9px] text-slate-400">
                  {shift.shiftStart} - {shift.shiftEnd}
                </p>
              </div>
              <span className="whitespace-nowrap rounded-full border border-slate-700 px-1.5 py-0.5 text-[8px] uppercase text-slate-300">
                {t(`salary.types.${shift.salaryType.toLowerCase()}`)}
              </span>
              <span className="whitespace-nowrap text-[9px] text-brand-200">{t("staffGroups.labels.amount", { amount: shift.salaryAmount })}</span>
            </div>
          ))
        )}
      </div>
      {group.shifts.length > preview.length ? (
        <p className="mt-1 text-[9px] text-slate-400">
          +{group.shifts.length - preview.length}
        </p>
      ) : null}
      {!activeShifts && group.shifts.length > 0 ? (
        <p className="mt-1 text-[9px] text-amber-300">{t("staffGroups.labels.inactive")}</p>
      ) : null}
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="rounded-2xl border border-slate-800/80 bg-slate-950/60 p-2.5">
      <div className="h-4 w-36 animate-pulse rounded-full bg-slate-800" />
      <div className="mt-2 h-3 w-52 animate-pulse rounded-full bg-slate-900" />
      <div className="mt-2 flex gap-1.5">
        <div className="h-5 w-20 animate-pulse rounded-full bg-slate-900/80" />
        <div className="h-5 w-20 animate-pulse rounded-full bg-slate-900/80" />
      </div>
      <div className="mt-2.5 rounded-lg border border-slate-800 bg-slate-900/45 p-2">
        <div className="h-3 w-full animate-pulse rounded-full bg-slate-900/80" />
        <div className="mt-1.5 h-3 w-2/3 animate-pulse rounded-full bg-slate-900/80" />
      </div>
    </div>
  );
}

