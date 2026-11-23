import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { listPlans, createPlan, updatePlan } from "../../api/membershipPlans";
import type { MembershipPlanDTO, MembershipPlanInput, PlanDurationUnit } from "../../shared/membershipTypes";
import { rtlLanguages } from "../../i18n/config";
import { useToast } from "../../components/ToastContext";
import { useAuth } from "../../auth/AuthContext";

const DURATION_UNITS: PlanDurationUnit[] = ["DAYS", "MONTHS"];

export function MembershipPlans() {
  const { t, i18n } = useTranslation();
  const { push } = useToast();
  const { hasPermission } = useAuth();
  const canManage = hasPermission("SYSTEM_SETTINGS_MANAGE");
  const isRtl = rtlLanguages.includes(i18n.language.split("-")[0]);
  const [plans, setPlans] = useState<MembershipPlanDTO[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<MembershipPlanDTO | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await listPlans(true);
      setPlans(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("membershipPlans.errors.load"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (error) {
      push({ kind: "error", title: error });
    }
  }, [error, push]);

  const handleSave = async (payload: MembershipPlanInput) => {
    setSubmitting(true);
    try {
      if (editing) {
        const { data } = await updatePlan(editing.id, payload);
        setPlans((prev) => prev.map((p) => (p.id === editing.id ? (data as MembershipPlanDTO) : p)));
      } else {
        const { data } = await createPlan(payload);
        setPlans((prev) => [data as MembershipPlanDTO, ...prev]);
      }
      setEditing(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("membershipPlans.errors.save"));
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleActive = async (plan: MembershipPlanDTO, nextActive: boolean) => {
    setSubmitting(true);
    try {
      const payload: MembershipPlanInput = {
        name: plan.name,
        description: plan.description ?? "",
        durationValue: plan.durationValue,
        durationUnit: plan.durationUnit,
        basePrice: plan.basePrice,
        isActive: nextActive,
      };
      const { data } = await updatePlan(plan.id, payload);
      setPlans((prev) => prev.map((p) => (p.id === plan.id ? (data as MembershipPlanDTO) : p)));
    } catch (err) {
      setError(err instanceof Error ? err.message : t("membershipPlans.errors.status"));
    } finally {
      setSubmitting(false);
    }
  };

  const rows = useMemo(
    () => [...plans].sort((a, b) => b.createdAt?.localeCompare(a.createdAt ?? "") ?? 0),
    [plans]
  );
  const formatNumber = (value: number) => value.toLocaleString(i18n.language);

  return (
    <div className="settings-compact membership-plans-compact space-y-4" dir={isRtl ? "rtl" : "ltr"}>
      <div className="rounded-2xl border border-slate-800/80 bg-slate-950/70 p-3 shadow-inner shadow-slate-950/60">
        <h2 className="text-sm font-semibold text-white">{t("membershipPlans.title")}</h2>
        <p className="text-[11px] text-slate-400">{t("membershipPlans.subtitle")}</p>
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        <div className="space-y-3 lg:col-span-2">
          {loading ? (
            <div className="grid gap-2.5 sm:grid-cols-2">
              <SkeletonPlanCard />
              <SkeletonPlanCard />
            </div>
          ) : rows.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-800/80 bg-slate-950/40 p-3 text-[11px] text-slate-300">
              {t("membershipPlans.empty")}
            </div>
          ) : (
            <div className="grid gap-2.5 sm:grid-cols-2">
              {rows.map((plan) => (
                <article
                  key={plan.id}
                  className="rounded-2xl border border-slate-800/80 bg-slate-950/60 p-3 shadow-inner shadow-slate-950/60 transition-all duration-200 hover:-translate-y-0.5 hover:border-brand-500/40 hover:shadow-lg hover:shadow-slate-950/50"
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-semibold leading-tight text-white">{plan.name}</p>
                    <span
                      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase ${
                        plan.isActive
                          ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-200"
                          : "border-slate-700 bg-slate-800 text-slate-300"
                      }`}
                    >
                      {plan.isActive ? t("common.status.active") : t("common.status.inactive")}
                    </span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <span className="inline-flex items-center gap-1 rounded-full border border-slate-700 bg-slate-900/60 px-2 py-0.5 text-[10px] text-slate-300">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} className="h-3 w-3">
                        <path d="M12 7v5l3 2" strokeLinecap="round" strokeLinejoin="round" />
                        <circle cx="12" cy="12" r="8.5" />
                      </svg>
                      {plan.durationValue} {t(`membershipPlans.duration.${plan.durationUnit.toLowerCase()}`)}
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-full border border-slate-700 bg-slate-900/60 px-2 py-0.5 text-[10px] text-slate-300">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} className="h-3 w-3">
                        <path d="M3 10h18" strokeLinecap="round" strokeLinejoin="round" />
                        <path d="M6 6h12a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2z" />
                      </svg>
                      {t("membershipPlans.form.basePrice")}: {formatNumber(plan.basePrice)}
                    </span>
                  </div>
                  {plan.description ? <p className="mt-1.5 text-[11px] leading-5 text-slate-400">{plan.description}</p> : null}
                  {canManage ? <div className="mt-2.5 flex items-center justify-end gap-2 border-t border-slate-700 pt-2">
                    <button
                      type="button"
                      onClick={() => setEditing(plan)}
                      title={t("common.actions.edit")}
                      aria-label={t("common.actions.edit")}
                      className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-slate-700 bg-slate-900/40 text-slate-100 transition-colors hover:border-brand-400 hover:bg-slate-900/70 hover:text-white"
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} className="h-3.5 w-3.5">
                        <path d="M12 20h9" strokeLinecap="round" strokeLinejoin="round" />
                        <path
                          d="M16.5 3.5a2.12 2.12 0 1 1 3 3L7 19l-4 1 1-4 12.5-12.5z"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </button>
                    <button
                      type="button"
                      onClick={() => (plan.isActive ? handleToggleActive(plan, false) : handleToggleActive(plan, true))}
                      title={plan.isActive ? t("membershipPlans.actions.deactivate") : t("membershipPlans.actions.activate")}
                      aria-label={plan.isActive ? t("membershipPlans.actions.deactivate") : t("membershipPlans.actions.activate")}
                      className={`inline-flex h-7 w-7 items-center justify-center rounded-lg transition-colors ${
                        plan.isActive
                          ? "border border-rose-500/50 bg-rose-500/10 text-rose-100 hover:bg-rose-500/20 hover:border-rose-400"
                          : "border border-emerald-500/40 bg-emerald-500/10 text-emerald-200 hover:bg-emerald-500/20 hover:border-emerald-400"
                      }`}
                      disabled={submitting}
                    >
                      {plan.isActive ? (
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} className="h-3.5 w-3.5">
                          <path d="M12 3v7" strokeLinecap="round" strokeLinejoin="round" />
                          <path d="M6.4 6.6a8 8 0 1 0 11.2 0" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      ) : (
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} className="h-3.5 w-3.5">
                          <circle cx="12" cy="12" r="8.5" />
                          <path d="m8.7 12 2.2 2.2 4.4-4.4" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </button>
                  </div> : null}
                </article>
              ))}
            </div>
          )}
        </div>
        {canManage ? <div className="rounded-2xl border border-slate-800/80 bg-slate-950/70 p-3 shadow-xl shadow-slate-950/60">
          <div className="mb-2.5 flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-white">
                {editing ? t("membershipPlans.actions.edit") : t("membershipPlans.actions.create")}
              </p>
              <p className="text-[11px] text-slate-400">{t("membershipPlans.hints.form")}</p>
            </div>
            {editing ? (
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="rounded-lg border border-slate-800 bg-slate-900 px-2.5 py-1 text-[11px] text-slate-200"
              >
                {t("membershipPlans.actions.new")}
              </button>
            ) : null}
          </div>
          <PlanForm
            key={editing?.id ?? "new"}
            initial={editing ?? undefined}
            submitting={submitting}
            onSubmit={handleSave}
            onCancel={() => setEditing(null)}
          />
        </div> : null}
      </div>
    </div>
  );
}

function SkeletonPlanCard() {
  return (
    <div className="rounded-2xl border border-slate-800/80 bg-slate-950/60 p-3 shadow-inner shadow-slate-950/60">
      <div className="flex items-start justify-between gap-2">
        <div className="h-4 w-32 animate-pulse rounded-full bg-slate-800/80" />
        <div className="h-5 w-16 animate-pulse rounded-full bg-slate-800/80" />
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        <div className="h-5 w-20 animate-pulse rounded-full bg-slate-900/80" />
        <div className="h-5 w-28 animate-pulse rounded-full bg-slate-900/80" />
      </div>
      <div className="mt-3 space-y-1.5">
        <div className="h-3 w-full animate-pulse rounded-full bg-slate-900/80" />
        <div className="h-3 w-2/3 animate-pulse rounded-full bg-slate-900/80" />
      </div>
    </div>
  );
}

function PlanForm({
  initial,
  submitting,
  onSubmit,
  onCancel,
}: {
  initial?: MembershipPlanDTO;
  submitting: boolean;
  onSubmit: (payload: MembershipPlanInput) => void;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const [form, setForm] = useState<MembershipPlanInput>({
    name: initial?.name ?? "",
    description: initial?.description ?? "",
    durationValue: initial?.durationValue ?? 1,
    durationUnit: initial?.durationUnit ?? "MONTHS",
    basePrice: initial?.basePrice ?? 0,
    isActive: initial?.isActive ?? true,
  });

  const handleChange = <K extends keyof MembershipPlanInput>(key: K, value: MembershipPlanInput[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <form
      className="space-y-2.5"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(form);
      }}
    >
      <div>
        <Label>{t("membershipPlans.form.name")}</Label>
        <input className="form-input" value={form.name} onChange={(e) => handleChange("name", e.target.value)} required />
      </div>
      <div>
        <Label>{t("membershipPlans.form.description")}</Label>
        <textarea className="form-input" value={form.description ?? ""} onChange={(e) => handleChange("description", e.target.value)} rows={2} />
      </div>
      <div className="grid gap-2.5 md:grid-cols-2">
        <div>
          <Label>{t("membershipPlans.form.durationValue")}</Label>
          <input
            type="number"
            min={1}
            className="form-input"
            value={form.durationValue}
            onChange={(e) => handleChange("durationValue", Number(e.target.value))}
            required
          />
        </div>
        <div>
          <Label>{t("membershipPlans.form.durationUnit")}</Label>
          <select className="form-input" value={form.durationUnit} onChange={(e) => handleChange("durationUnit", e.target.value as PlanDurationUnit)}>
            {DURATION_UNITS.map((unit) => (
              <option key={unit} value={unit}>
                {t(`membershipPlans.duration.${unit.toLowerCase()}`)}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div>
        <Label>{t("membershipPlans.form.basePrice")}</Label>
        <input
          type="number"
          min={0}
          className="form-input"
          value={form.basePrice}
          onChange={(e) => handleChange("basePrice", Number(e.target.value))}
          required
        />
      </div>
      <label className="flex items-center gap-2 text-[11px] text-slate-300">
        <input type="checkbox" checked={form.isActive ?? true} onChange={(e) => handleChange("isActive", e.target.checked)} className="h-3 w-3 accent-brand-500" />
        {t("common.status.active")}
      </label>
      <div className="flex items-center gap-2">
        <button
          type="submit"
          disabled={submitting}
          className="rounded-lg border border-brand-500/40 bg-brand-500/80 px-3 py-1.5 text-[11px] font-semibold !text-white"
        >
          {submitting ? t("common.actions.saving") : initial ? t("membershipPlans.actions.update") : t("membershipPlans.actions.create")}
        </button>
        <button type="button" onClick={onCancel} className="btn-cancel rounded-lg border border-slate-700 px-3 py-1.5 text-[11px] text-slate-200">
          {t("common.actions.cancel")}
        </button>
      </div>
    </form>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <p className="text-[11px] font-semibold text-slate-300">{children}</p>;
}
