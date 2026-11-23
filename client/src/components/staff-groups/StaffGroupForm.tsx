import { useEffect, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { useFieldArray, useForm, useWatch } from "react-hook-form";
import type { StaffGroup, StaffGroupPayload } from "../../api/staffGroups";
import type { SalaryType } from "../../shared/memberTypes";

const SALARY_TYPES: SalaryType[] = ["MONTHLY", "HOURLY", "PER_SHIFT"];
const WEEKDAYS = ["sat", "sun", "mon", "tue", "wed", "thu", "fri"] as const;
const DEFAULT_WEEKDAYS = [0, 1, 2, 3, 4, 5, 6];

type Props = {
  initial?: StaffGroup | null;
  submitting: boolean;
  onSubmit: (payload: StaffGroupPayload) => Promise<void> | void;
  onCancel: () => void;
};

const createDefaultShift = (t: (key: string) => string) => ({
  shiftName: t("staffGroups.defaults.shiftName"),
  shiftStart: "08:00",
  shiftEnd: "16:00",
  weekdays: [...DEFAULT_WEEKDAYS],
  earlyAccessMinutes: 15,
  salaryType: "MONTHLY" as SalaryType,
  salaryAmount: 0,
  isActive: true,
});

export function StaffGroupForm({ initial, submitting, onSubmit, onCancel }: Props) {
  const { t } = useTranslation();
  const form = useForm<StaffGroupPayload>({
    defaultValues: initial
      ? mapInitial(initial)
      : {
          name: "",
          description: "",
          accessLevel: "",
          shifts: [{ ...createDefaultShift(t) }],
        },
  });
  const { register, handleSubmit, control, reset, setValue } = form;
  const { fields, append, remove } = useFieldArray({ control, name: "shifts" });
  const watchedShifts = useWatch({ control, name: "shifts" }) ?? [];

  useEffect(() => {
    reset(initial ? mapInitial(initial) : { name: "", description: "", accessLevel: "", shifts: [{ ...createDefaultShift(t) }] });
  }, [initial, reset, t]);

  const submit = handleSubmit(async (values) => {
    const payload: StaffGroupPayload = {
      ...values,
      description: values.description || null,
      accessLevel: values.accessLevel || null,
      shifts: values.shifts.map((shift) => ({
        ...shift,
        earlyAccessMinutes: Number(shift.earlyAccessMinutes ?? 15),
        salaryAmount: Number(shift.salaryAmount ?? 0),
        isActive: shift.isActive ?? true,
      })),
    };
    await onSubmit(payload);
  });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
      className="space-y-3"
    >
      <div className="grid gap-2.5 md:grid-cols-2">
        <div>
          <Label>{t("staffGroups.form.groupName")}</Label>
          <input {...register("name", { required: true })} className="form-input" placeholder={t("staffGroups.placeholders.groupName")} />
        </div>
        <div>
          <Label>{t("staffGroups.form.accessLevel")}</Label>
          <input {...register("accessLevel")} className="form-input" placeholder={t("staffGroups.placeholders.accessLevel")} />
        </div>
      </div>
      <div>
        <Label>{t("staffGroups.form.description")}</Label>
        <textarea {...register("description")} className="form-input" rows={2} placeholder={t("staffGroups.placeholders.description")} />
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>{t("staffGroups.form.shiftTemplates")}</Label>
          <button
            type="button"
            onClick={() => append({ ...createDefaultShift(t), shiftName: t("staffGroups.defaults.newShift") })}
            className="inline-flex items-center gap-1 rounded-lg border border-brand-500/40 bg-brand-500/10 px-2.5 py-1 text-[11px] !text-white transition-colors hover:border-brand-400 hover:bg-brand-500/20"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-3.5 w-3.5">
              <path d="M12 5v14M5 12h14" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            {t("staffGroups.actions.addShift")}
          </button>
        </div>
        {fields.length === 0 ? <p className="text-[11px] text-amber-200">{t("staffGroups.validation.needShift")}</p> : null}
        {fields.map((field, idx) => (
          <div key={field.id} className="rounded-xl border border-slate-800 bg-slate-900/60 p-2.5 shadow-inner shadow-slate-950/40">
            <div className="mb-2 flex items-center justify-between border-b border-slate-800/80 pb-2">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                {t("staffGroups.form.shiftName")} #{idx + 1}
              </p>
              <button
                type="button"
                onClick={() => remove(idx)}
                className="inline-flex items-center gap-1 rounded-md border border-rose-500/40 bg-rose-500/10 px-2 py-0.5 text-[10px] text-rose-200 transition-colors hover:border-rose-400 hover:bg-rose-500/20"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} className="h-3 w-3">
                  <path d="M3 6h18" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M8 6V4h8v2M7 6l1 14h8l1-14" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                {t("staffGroups.actions.removeShift")}
              </button>
            </div>
            <div className="space-y-2.5">
              <div className="md:col-span-2">
                <Label>{t("staffGroups.form.shiftName")}</Label>
                <input {...register(`shifts.${idx}.shiftName` as const, { required: true })} className="form-input w-full" />
              </div>
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                <div>
                  <Label>{t("staffGroups.form.start")}</Label>
                  <input type="time" {...register(`shifts.${idx}.shiftStart` as const, { required: true })} className="form-input w-full" />
                </div>
                <div>
                  <Label>{t("staffGroups.form.end")}</Label>
                  <input type="time" {...register(`shifts.${idx}.shiftEnd` as const, { required: true })} className="form-input w-full" />
                </div>
              </div>
              <div className="max-w-[220px]">
                <Label>{t("staffGroups.form.earlyAccessMinutes")}</Label>
                <input
                  type="number"
                  min={0}
                  max={120}
                  step={1}
                  {...register(`shifts.${idx}.earlyAccessMinutes` as const, { valueAsNumber: true })}
                  className="form-input w-full"
                />
              </div>
              {isOvernightShift(watchedShifts?.[idx]?.shiftStart, watchedShifts?.[idx]?.shiftEnd) ? (
                <div className="rounded-full border border-slate-700 bg-slate-900/70 px-2 py-0.5 text-[10px] text-slate-300">
                  Overnight shift (ends next day)
                </div>
              ) : null}
              <div>
                <Label>{t("staffGroups.form.weekdays")}</Label>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {WEEKDAYS.map((label, weekday) => {
                    const selected = watchedShifts?.[idx]?.weekdays ?? DEFAULT_WEEKDAYS;
                    const active = selected.includes(weekday);
                    return (
                      <button
                        key={label}
                        type="button"
                        onClick={() => {
                          const next = active ? selected.filter((day) => day !== weekday) : [...selected, weekday].sort((a, b) => a - b);
                          if (next.length === 0) return;
                          setValue(`shifts.${idx}.weekdays`, next, { shouldDirty: true });
                        }}
                        className={`rounded-full border px-2.5 py-1 text-[11px] transition ${
                          active ? "border-brand-400/60 bg-brand-500/10 text-white" : "border-slate-800 bg-slate-900/60 text-slate-300"
                        }`}
                      >
                        {t(`weekdays.short.${label}`)}
                      </button>
                    );
                  })}
                </div>
                {watchedShifts?.[idx]?.weekdays?.length === 0 ? (
                  <p className="mt-1 text-[11px] text-rose-200">{t("staffGroups.validation.needWeekday")}</p>
                ) : null}
              </div>
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                <div>
                  <Label>{t("staffGroups.form.salaryType")}</Label>
                  <select {...register(`shifts.${idx}.salaryType` as const)} className="form-input w-full">
                    {SALARY_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {t(`salary.types.${type.toLowerCase()}`)}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label>{t("staffGroups.form.amount")}</Label>
                  <input
                    type="number"
                    step="0.01"
                    {...register(`shifts.${idx}.salaryAmount` as const, { valueAsNumber: true })}
                    className="form-input w-full"
                  />
                </div>
              </div>
              <label className="flex items-center gap-2 text-[11px] text-slate-300">
                <input type="checkbox" {...register(`shifts.${idx}.isActive` as const)} className="h-3 w-3 accent-brand-500" defaultChecked />
                {t("staffGroups.form.active")}
              </label>
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2 border-t border-slate-800/80 pt-2">
        <button
          type="submit"
          disabled={submitting}
          className="rounded-lg border border-brand-500/40 bg-brand-500/80 px-3 py-1.5 text-[11px] font-semibold !text-white transition-colors hover:bg-brand-500"
        >
          {submitting ? t("common.actions.saving") : initial ? t("staffGroups.actions.updateGroup") : t("staffGroups.actions.createGroup")}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="btn-cancel rounded-lg border border-slate-700 bg-slate-900/50 px-3 py-1.5 text-[11px] text-slate-200"
        >
          {t("common.actions.cancel")}
        </button>
      </div>
    </form>
  );
}

function Label({ children }: { children: ReactNode }) {
  return <p className="text-[11px] font-semibold text-slate-300">{children}</p>;
}

function isOvernightShift(start?: string, end?: string) {
  if (!start || !end) return false;
  const startMinutes = toMinutes(start);
  const endMinutes = toMinutes(end);
  return endMinutes < startMinutes;
}

function toMinutes(value: string) {
  const [hours, minutes] = value.split(":").map(Number);
  return (hours ?? 0) * 60 + (minutes ?? 0);
}

function mapInitial(initial: StaffGroup): StaffGroupPayload {
  return {
    name: initial.name,
    description: initial.description ?? "",
    accessLevel: initial.accessLevel ?? "",
    shifts:
      initial.shifts?.map((shift) => ({
        shiftName: shift.shiftName,
        shiftStart: shift.shiftStart,
        shiftEnd: shift.shiftEnd,
        weekdays: shift.weekdays?.length ? [...shift.weekdays] : [...DEFAULT_WEEKDAYS],
        earlyAccessMinutes: shift.earlyAccessMinutes ?? 15,
        salaryType: shift.salaryType,
        salaryAmount: Number(shift.salaryAmount),
        isActive: shift.isActive,
      })) ?? [],
  };
}
