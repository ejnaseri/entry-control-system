import { useCallback, useEffect, useMemo, useRef, useState, type SVGProps } from "react";
import {
  Controller,
  useFieldArray,
  useForm,
  type Control,
  type DefaultValues,
  type FieldPath,
  type UseFormRegisterReturn,
  type UseFormReturn,
} from "react-hook-form";
import { useTranslation } from "react-i18next";
import { rtlLanguages } from "../../i18n/config";
import { listPlans as getMembershipPlans } from "../../api/membershipPlans";
import { enrollDevice as enrollDeviceApi, listDevices, suggestDeviceUserId, type Device } from "../../api/devices";
import { getStaffGroups } from "../../api/staffGroups";
import { getShiftTemplates } from "../../api/shifts";
import { FingerIdPicker } from "../device/FingerIdPicker";
import { ShamsiDateInput } from "../ui/ShamsiDateInput";
import { formatDateInputValue, parseDateInputValue } from "../../shared/dateInputValue";
import { useAuth } from "../../auth/AuthContext";
import type {
  DayAccess,
  MemberType,
  MemberWizardPayload,
  MemberExtraShiftInput,
  OvertimeRateType,
  RoleType,
  CustomerFormPayload,
  SalaryType,
  MemberShiftInput,
  TimeRange,
} from "../../shared/memberTypes";
import type { StaffGroup } from "../../api/staffGroups";
import type { ShiftTemplate } from "../../api/shifts";

type MembershipPlan = { id: string; name: string; durationValue: number; durationUnit: string; basePrice: number; isActive: boolean };

type WizardFormValues = MemberWizardPayload & {
  membership?: CustomerFormPayload["membership"];
  customerAccess?: CustomerFormPayload["customerAccess"];
  totalPaidAmount?: number;
  totalDebtAmount?: number;
};

type WizardFieldPath = FieldPath<WizardFormValues>;
type WizardDateFieldName = "birthDate" | "membership.startDate" | "membership.endDate";

type Props = {
  defaultValues?: Partial<MemberWizardPayload & CustomerFormPayload>;
  onSubmit: (payload: MemberWizardPayload | CustomerFormPayload) => Promise<void> | void;
  onCancel: () => void;
  submitting: boolean;
};

const MEMBER_TYPES: MemberType[] = ["STAFF", "CUSTOMER"];
const ROLE_TYPES: RoleType[] = ["EMPLOYEE", "MANAGER", "OWNER", "ADMIN", "COACH", "RECEPTION", "OTHER"];
const OVERTIME_RATE_TYPES: OvertimeRateType[] = ["PER_HOUR", "PERCENTAGE"];
const SALARY_TYPES: SalaryType[] = ["MONTHLY", "HOURLY", "PER_SHIFT"];
const GENDERS = ["MALE", "FEMALE", "OTHER"] as const;
const WEEKDAY_KEYS = [
  "weekdays.short.sat",
  "weekdays.short.sun",
  "weekdays.short.mon",
  "weekdays.short.tue",
  "weekdays.short.wed",
  "weekdays.short.thu",
  "weekdays.short.fri",
];
const STAFF_STEP_KEYS = [
  "members.wizard.steps.type",
  "members.wizard.steps.basicInfo",
  "members.wizard.steps.role",
  "members.wizard.steps.group",
  "members.wizard.steps.access",
  "members.wizard.steps.overtime",
  "members.wizard.steps.review",
];
const CUSTOMER_STEP_KEYS = [
  "members.wizard.steps.type",
  "members.wizard.steps.basicInfo",
  "members.wizard.steps.membership",
  "members.wizard.steps.access",
  "members.wizard.steps.review",
];
const ALL_WEEKDAYS = [0, 1, 2, 3, 4, 5, 6];
const fieldBaseClass =
  "form-input min-h-8 rounded-lg px-2.5 py-1 text-[10px] transition-colors focus:border-brand-400 focus:ring-2 focus:ring-brand-500/30";
const fieldErrorClass = "border-rose-500/70 ring-1 ring-rose-500/30 bg-rose-500/5 focus:border-rose-400 focus:ring-rose-500/30";
const wizardInnerPanelClass =
  "rounded-xl border border-[color:var(--card-border)] bg-[var(--bg-panel)] p-2.5 shadow-sm";
const wizardSoftPanelClass =
  "rounded-xl border border-[color:var(--card-border)] bg-[var(--input-bg)] p-2.5";
const wizardSectionTitleClass = "text-[11px] font-semibold text-[var(--text-primary)]";
const wizardSubTitleClass = "text-[10px] font-semibold text-[var(--text-primary)]";
const wizardMutedTextClass = "text-[10px] text-[var(--text-secondary)]";
const wizardButtonSecondaryClass =
  "btn-cancel inline-flex min-h-8 items-center justify-center rounded-lg border border-[color:var(--card-border)] bg-[var(--bg-card)] px-2.5 py-1 text-[10px] font-semibold text-[var(--text-secondary)] transition hover:border-brand-500/40 hover:bg-brand-500/10 hover:text-[var(--text-primary)]";
const wizardButtonPrimaryClass =
  "inline-flex min-h-8 items-center justify-center rounded-lg border border-brand-500/50 bg-brand-500/85 px-3 py-1 text-[10px] font-semibold text-white transition hover:bg-brand-500 disabled:cursor-not-allowed disabled:opacity-60";
const wizardButtonAccentClass =
  "inline-flex min-h-8 items-center justify-center gap-1.5 rounded-lg border border-brand-500/40 bg-brand-500/10 px-2.5 py-1 text-[10px] font-semibold text-[var(--color-primary)] transition hover:bg-brand-500/20 disabled:cursor-not-allowed disabled:opacity-55";
const wizardButtonSuccessClass =
  "inline-flex min-h-8 items-center justify-center gap-1.5 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-1 text-[10px] font-semibold text-emerald-300 transition hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-55";
const wizardIconDangerClass =
  "inline-flex h-7 w-7 items-center justify-center rounded-lg border border-rose-500/35 bg-rose-500/10 text-rose-300 transition hover:bg-rose-500/20";

export function MemberWizard({ defaultValues, onSubmit, onCancel, submitting }: Props) {
  const { t, i18n } = useTranslation();
  const { hasPermission } = useAuth();
  const canEnrollDevices = hasPermission("DEVICES_ENROLL");
  const isRtl = rtlLanguages.includes(i18n.language.split("-")[0]);
  const [memberType, setMemberType] = useState<MemberType>(defaultValues?.memberType ?? "STAFF");
  const [step, setStep] = useState(0);
  const [plans, setPlans] = useState<MembershipPlan[]>([]);
  const [loadingPlans, setLoadingPlans] = useState(false);
  const [staffGroups, setStaffGroups] = useState<StaffGroup[]>([]);
  const [loadingGroups, setLoadingGroups] = useState(false);
  const [shiftTemplates, setShiftTemplates] = useState<ShiftTemplate[]>([]);
  const [loadingShifts, setLoadingShifts] = useState(false);
  const [devices, setDevices] = useState<Device[]>([]);
  const [loadingDevices, setLoadingDevices] = useState(false);
  const [deviceError, setDeviceError] = useState<string | null>(null);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>("");
  const [suggestingId, setSuggestingId] = useState(false);
  const [enrolling, setEnrolling] = useState(false);
  const [autoSuggested, setAutoSuggested] = useState(false);
  const steps = (memberType === "STAFF" ? STAFF_STEP_KEYS : CUSTOMER_STEP_KEYS).map((key) => t(key));
  const memberTypeLabels: Record<MemberType, string> = {
    STAFF: t("members.wizard.memberType.staff"),
    CUSTOMER: t("members.wizard.memberType.customer"),
  };
  const isLast = step === steps.length - 1;

  const staffDefaults = useMemo<DefaultValues<WizardFormValues>>(() => {
    return {
      memberType: "STAFF",
      code: "",
      firstName: "",
      lastName: "",
      fatherName: "",
      phone: "",
      email: "",
      gender: "MALE",
      birthDate: "",
      nationalId: "",
      notes: "",
      photoUrl: "",
      fingerId: null,
      role: { roleType: "EMPLOYEE" as RoleType, isStaff: true, customTitle: "" },
      access: { allowedDays: [0, 1, 2, 3, 4, 5, 6], allowedTimeRanges: [] as DayAccess[] },
      overtime: { allowOvertime: false, overtimeRateType: undefined, overtimeAmount: undefined, maxOvertimePerDay: undefined },
      staffGroupId: "",
      shifts: [] as MemberShiftInput[],
      extraShifts: [] as MemberExtraShiftInput[],
      ...defaultValues,
    };
  }, [defaultValues]);

  const customerDefaults = useMemo<DefaultValues<WizardFormValues>>(() => {
    const today = formatDateInputValue(new Date());
    return {
      memberType: "CUSTOMER",
      code: "",
      firstName: "",
      lastName: "",
      fatherName: "",
      phone: "",
      email: "",
      gender: "MALE",
      birthDate: "",
      nationalId: "",
      notes: "",
      photoUrl: "",
      fingerId: null,
      role: { roleType: "OTHER" as RoleType, isStaff: false, customTitle: "" },
      membership: {
        planId: "",
        startDate: today,
        endDate: today,
        price: 0,
        discount: 0,
        paidAmount: 0,
        status: "ACTIVE",
      },
      customerAccess: { allowedDays: [0, 1, 2, 3, 4, 5, 6], allowedTimeRanges: [] as DayAccess[], maxEntriesPerDay: undefined },
      totalPaidAmount: 0,
      totalDebtAmount: 0,
      overtime: { allowOvertime: false },
      extraShifts: [],
      staffGroupId: "",
      ...defaultValues,
    };
  }, [defaultValues]);

  const staffForm = useForm<WizardFormValues>({
    defaultValues: staffDefaults,
    mode: "onBlur",
  });
  const customerForm = useForm<WizardFormValues>({
    defaultValues: customerDefaults,
    mode: "onBlur",
  });

  const activeForm = memberType === "STAFF" ? staffForm : customerForm;

  useEffect(() => {
    setAutoSuggested(false);
  }, [memberType]);

  const handleSuggestId = useCallback(async () => {
    if (!selectedDeviceId) {
      setDeviceError(t("members.wizard.device.errors.selectDevice"));
      return;
    }
    setSuggestingId(true);
    setDeviceError(null);
    try {
      const { data } = await suggestDeviceUserId(selectedDeviceId);
      activeForm.setValue("code", data.userId, { shouldDirty: true, shouldValidate: true });
    } catch (err) {
      setDeviceError(err instanceof Error ? err.message : t("members.wizard.device.errors.suggestFailed"));
    } finally {
      setSuggestingId(false);
    }
  }, [activeForm, selectedDeviceId, t]);

  const handleEnroll = async () => {
    if (!selectedDeviceId) {
      setDeviceError(t("members.wizard.device.errors.selectDevice"));
      return;
    }

    const code = String(activeForm.getValues("code") ?? "").trim();
    if (!code) {
      setDeviceError(t("members.wizard.device.errors.enterUserId"));
      return;
    }
    if (!/^\d+$/.test(code)) {
      setDeviceError(t("members.validation.deviceUserIdNumeric"));
      return;
    }

    const firstName = String(activeForm.getValues("firstName") ?? "").trim();
    const lastName = String(activeForm.getValues("lastName") ?? "").trim();
    const fullName = [firstName, lastName].filter(Boolean).join(" ").trim();
    if (!fullName) {
      setDeviceError(t("members.wizard.device.errors.enterName"));
      return;
    }

    let fingerId: number | undefined;
    const fingerValue = activeForm.getValues("fingerId");
    if (fingerValue !== null && fingerValue !== undefined) {
      const parsed = Number(fingerValue);
      if (!Number.isInteger(parsed) || parsed < 0 || parsed > 9) {
        setDeviceError(t("members.wizard.device.errors.fingerRange"));
        return;
      }
      fingerId = parsed;
    }

    setEnrolling(true);
    setDeviceError(null);
    try {
      await enrollDeviceApi(selectedDeviceId, {
        userId: code,
        name: fullName,
        ...(fingerId !== undefined ? { fingerId } : {}),
      });
    } catch (err) {
      setDeviceError(err instanceof Error ? err.message : t("members.wizard.device.errors.enrollFailed"));
    } finally {
      setEnrolling(false);
    }
  };

  useEffect(() => {
    if (autoSuggested) return;
    if (!selectedDeviceId || loadingDevices) return;
    const currentCode = String(activeForm.getValues("code") ?? "").trim();
    if (currentCode) {
      setAutoSuggested(true);
      return;
    }
    void handleSuggestId().finally(() => setAutoSuggested(true));
  }, [activeForm, autoSuggested, handleSuggestId, loadingDevices, selectedDeviceId]);

  useEffect(() => {
    setStep(0);
  }, [memberType]);

  useEffect(() => {
    if (memberType === "CUSTOMER") {
      setLoadingPlans(true);
      getMembershipPlans()
        .then(({ data }) => setPlans(data as MembershipPlan[]))
        .finally(() => setLoadingPlans(false));
    }
  }, [memberType]);

  useEffect(() => {
    if (memberType !== "STAFF") return;
    setLoadingGroups(true);
    getStaffGroups()
      .then(({ data }) => setStaffGroups(data as StaffGroup[]))
      .catch(() => setStaffGroups([]))
      .finally(() => setLoadingGroups(false));
    setLoadingShifts(true);
    getShiftTemplates()
      .then(({ data }) => setShiftTemplates(data as ShiftTemplate[]))
      .catch(() => setShiftTemplates([]))
      .finally(() => setLoadingShifts(false));
  }, [memberType]);

  useEffect(() => {
    setLoadingDevices(true);
    listDevices({ type: "FINGERPRINT" })
      .then(({ data }) => setDevices(data as Device[]))
      .catch(() => setDevices([]))
      .finally(() => setLoadingDevices(false));
  }, []);

  const enrollableDevices = useMemo(() => {
    return devices.filter(
      (device) =>
        device.type === "FINGERPRINT" &&
        (device.connectionType === "ZKTECO_PULL_SDK" || device.connectionType === "NETWORK")
    );
  }, [devices]);

  useEffect(() => {
    if (!selectedDeviceId && enrollableDevices.length > 0) {
      setSelectedDeviceId(enrollableDevices[0].id);
    }
  }, [enrollableDevices, selectedDeviceId]);

  const submit = activeForm.handleSubmit(async (values) => {
    if (memberType === "STAFF") {
      const staffGroupId = values.staffGroupId || undefined;
      const payload: MemberWizardPayload = {
        ...values,
        staffGroupId,
        role: { ...values.role, customTitle: values.role.customTitle || undefined },
        access: normalizeAccess(values.access),
        overtime: {
          allowOvertime: values.overtime.allowOvertime,
          overtimeRateType: values.overtime.overtimeRateType || undefined,
          overtimeAmount: values.overtime.overtimeAmount || undefined,
          maxOvertimePerDay: values.overtime.maxOvertimePerDay || undefined,
        },
        extraShifts: (values.extraShifts || []).map((s: MemberExtraShiftInput) => ({
          shiftId: s.shiftId,
          rateOverride: s.rateOverride ?? undefined,
          isActive: s.isActive ?? true,
        })),
        shifts: staffGroupId ? [] : (values.shifts || []).map((s: MemberShiftInput) => ({ ...s, isActive: s.isActive ?? true })),
      };
      await onSubmit(payload);
    } else {
      if (!values.membership || !values.customerAccess) return;
      const payload: CustomerFormPayload = {
        ...values,
        role: { ...values.role, customTitle: values.role.customTitle || undefined },
        access: normalizeAccess(values.customerAccess),
        customerAccess: normalizeAccess(values.customerAccess),
        overtime: { allowOvertime: false },
        shifts: [],
        membership: {
          ...values.membership,
          discount: values.membership.discount ?? 0,
          paidAmount: values.membership.paidAmount ?? 0,
          status: "ACTIVE",
        },
        totalPaidAmount: values.membership.paidAmount ?? 0,
        totalDebtAmount: Math.max(0, (values.membership.price ?? 0) - (values.membership.discount ?? 0) - (values.membership.paidAmount ?? 0)),
      };
      await onSubmit(payload);
    }
  });

  const stepValidation: Record<MemberType, WizardFieldPath[][]> = {
    STAFF: [
      [],
      ["firstName", "phone", "code"],
      ["role.roleType"],
      [],
      [],
      [],
      [],
    ],
    CUSTOMER: [
      [],
      ["firstName", "phone", "code"],
      ["membership.planId", "membership.startDate"],
      [],
    ],
  };

  const formRef = useRef<HTMLFormElement | null>(null);
  const scrollToFirstInvalid = (fields: WizardFieldPath[]) => {
    if (!fields.length) return;
    const root = formRef.current ?? document;
    const escapeName = (value: string) => {
      if (typeof CSS !== "undefined" && typeof CSS.escape === "function") {
        return CSS.escape(value);
      }
      return value.replace(/["\\]/g, "\\$&");
    };
    for (const name of fields) {
      const state = activeForm.getFieldState(name);
      if (!state.invalid) continue;
      const el = root.querySelector<HTMLElement>(`[name="${escapeName(name)}"]`);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        el.focus({ preventScroll: true });
        return;
      }
    }
    const fallback = root.querySelector<HTMLElement>("[aria-invalid='true']");
    if (fallback) {
      fallback.scrollIntoView({ behavior: "smooth", block: "center" });
      fallback.focus({ preventScroll: true });
    }
  };

  const goNext = async () => {
    const fields = stepValidation[memberType][step] ?? [];
    if (fields.length > 0) {
      const valid = await activeForm.trigger(fields, { shouldFocus: false });
      if (!valid) {
        scrollToFirstInvalid(fields);
        return;
      }
    }
    if (isLast) {
      await submit();
    } else {
      setStep((s) => s + 1);
    }
  };

  const goBack = () => setStep((s) => Math.max(0, s - 1));

  const devicePanel = canEnrollDevices ? (
    <Controller
      control={activeForm.control}
      name="fingerId"
      render={({ field }) => (
        <DeviceEnrollmentPanel
          devices={enrollableDevices}
          selectedDeviceId={selectedDeviceId}
          onSelectDevice={setSelectedDeviceId}
          onSuggestId={handleSuggestId}
          onEnroll={handleEnroll}
          loadingDevices={loadingDevices}
          suggesting={suggestingId}
          enrolling={enrolling}
          error={deviceError}
          fingerId={typeof field.value === "number" ? field.value : null}
          onFingerIdChange={(value) => field.onChange(value)}
        />
      )}
    />
  ) : null;

  return (
    <div data-testid="member-wizard" className="member-wizard-compact space-y-2" dir={isRtl ? "rtl" : "ltr"}>
      <StepIndicator steps={steps} currentStep={step} />

      <form
        ref={formRef}
        onSubmit={(e) => {
          e.preventDefault();
          void goNext();
        }}
        className="space-y-2"
      >
        {step === 0 ? (
          <div className="member-type-card">
            <h3 className="member-type-card__title">{t("members.wizard.memberType.title")}</h3>
            <p className="member-type-card__description">{t("members.wizard.memberType.description")}</p>
            <div className="member-type-card__options">
              {MEMBER_TYPES.map((type) => (
                <label
                  key={type}
                  className={`member-type-option ${memberType === type ? "member-type-option--active" : ""}`}
                >
                  <input
                    data-testid={`member-wizard-type-${type.toLowerCase()}`}
                    type="radio"
                    name="memberType"
                    value={type}
                    checked={memberType === type}
                    onChange={() => setMemberType(type)}
                    className="member-type-option__radio"
                  />
                  {memberTypeLabels[type]}
                </label>
              ))}
            </div>
          </div>
        ) : memberType === "STAFF" ? (
          <StaffForm
            form={staffForm}
            step={step}
            staffGroups={staffGroups}
            loadingGroups={loadingGroups}
            shiftTemplates={shiftTemplates}
            loadingShifts={loadingShifts}
            devicePanel={devicePanel}
          />
        ) : (
          <CustomerForm
            form={customerForm}
            step={step}
            plans={plans}
            loadingPlans={loadingPlans}
            setPlanDefaults={(plan) => {
              customerForm.setValue("membership.planId", plan.id);
              customerForm.setValue("membership.price", Number(plan.basePrice ?? 0));
              const start = customerForm.getValues("membership.startDate") || formatDateInputValue(new Date());
              const end = computeMembershipEndDate(start, plan);
              customerForm.setValue("membership.endDate", end);
            }}
            devicePanel={devicePanel}
          />
        )}

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={onCancel}
            className={wizardButtonSecondaryClass}
          >
            {t("common.actions.cancel")}
          </button>
          {step > 0 && (
            <button
              type="button"
              onClick={goBack}
              className={wizardButtonSecondaryClass}
            >
              {t("common.actions.back")}
            </button>
          )}
          <button
            data-testid="member-wizard-primary"
            type="submit"
            disabled={submitting}
            className={wizardButtonPrimaryClass}
          >
            {submitting
              ? t("common.actions.saving")
              : isLast
                ? memberType === "STAFF"
                  ? t("members.wizard.actions.saveMember")
                  : t("members.wizard.actions.saveCustomer")
                : t("common.actions.next")}
          </button>
        </div>
      </form>
    </div>
  );
}

function StepIndicator({ steps, currentStep }: { steps: string[]; currentStep: number }) {
  return (
    <div className="step-indicator">
      {steps.map((label, idx) => {
        const active = idx === currentStep;
        const done = idx < currentStep;
        const state = active ? "active" : done ? "done" : "idle";
        return (
          <div key={label} className="step-indicator__item" data-state={state}>
            <span className="step-indicator__badge">
              {idx + 1}
            </span>
            <span className="step-indicator__label">{label}</span>
          </div>
        );
      })}
    </div>
  );
}

function StaffForm({
  form,
  step,
  staffGroups,
  loadingGroups,
  shiftTemplates,
  loadingShifts,
  devicePanel,
}: {
  form: UseFormReturn<WizardFormValues>;
  step: number;
  staffGroups: StaffGroup[];
  loadingGroups: boolean;
  shiftTemplates: ShiftTemplate[];
  loadingShifts: boolean;
  devicePanel?: React.ReactNode;
}) {
  const { t, i18n } = useTranslation();
  const { register, control, watch, formState } = form;
  const { fields: shiftFields, append: appendShift, remove: removeShift } = useFieldArray({ control, name: "shifts" as const });
  const {
    fields: extraShiftFields,
    append: appendExtraShift,
    remove: removeExtraShift,
  } = useFieldArray({ control, name: "extraShifts" as const });
  const access = watch("access") as MemberWizardPayload["access"];
  const overtime = watch("overtime") as MemberWizardPayload["overtime"];
  const selectedGroupId = watch("staffGroupId") as string | undefined;
  const selectedGroup = staffGroups.find((g) => g.id === selectedGroupId);
  const lastSyncedGroupId = useRef<string | null>(null);
  const [selectedExtraId, setSelectedExtraId] = useState<string>("");
  const [groupSearch, setGroupSearch] = useState("");
  const extraShifts = watch("extraShifts") as MemberExtraShiftInput[];
  const groupShiftIds = new Set(selectedGroup?.shifts?.map((s) => s.id) ?? []);
  const extraShiftIds = new Set((extraShifts ?? []).map((s) => s.shiftId));
  const roleLabels: Record<RoleType, string> = {
    EMPLOYEE: t("members.wizard.roles.employee"),
    MANAGER: t("members.wizard.roles.manager"),
    OWNER: t("members.wizard.roles.owner"),
    ADMIN: t("members.wizard.roles.admin"),
    COACH: t("members.wizard.roles.coach"),
    RECEPTION: t("members.wizard.roles.reception"),
    OTHER: t("members.wizard.roles.other"),
  };
  const overtimeRateLabels: Record<OvertimeRateType, string> = {
    PER_HOUR: t("members.wizard.overtime.rateTypes.perHour"),
    PERCENTAGE: t("members.wizard.overtime.rateTypes.percentage"),
  };
  const salaryTypeLabels: Record<SalaryType, string> = {
    MONTHLY: t("salary.types.monthly"),
    HOURLY: t("salary.types.hourly"),
    PER_SHIFT: t("salary.types.per_shift"),
  };
  const roleType = watch("role.roleType") as RoleType | undefined;
  const formatSalaryType = (value?: SalaryType) => (value ? salaryTypeLabels[value] ?? value : t("members.wizard.review.notAvailable"));
  const filteredStaffGroups = useMemo(() => {
    const query = groupSearch.trim().toLowerCase();
    if (!query) return staffGroups;
    return staffGroups.filter((group) =>
      [group.name, group.description, group.accessLevel].some((value) => (value ?? "").toLowerCase().includes(query))
    );
  }, [groupSearch, staffGroups]);
  const primaryGroupShift = selectedGroup?.shifts?.[0];
  const selectStaffGroup = (groupId: string) => {
    form.setValue("staffGroupId", groupId, { shouldDirty: true, shouldValidate: true });
  };
  useEffect(() => {
    if (!selectedGroup) {
      lastSyncedGroupId.current = null;
      return;
    }
    if (lastSyncedGroupId.current === selectedGroup.id) return;
    const groupDays = new Set<number>();
    selectedGroup.shifts?.forEach((shift) => {
      const shiftDays = shift.weekdays?.length ? shift.weekdays : ALL_WEEKDAYS;
      shiftDays.forEach((day) => groupDays.add(day));
    });
    const groupAllowedDays = Array.from(groupDays).sort((a, b) => a - b);
    const currentDays = Array.from(new Set(access.allowedDays ?? [])).sort((a, b) => a - b);
    const isAllDays = currentDays.length === ALL_WEEKDAYS.length && ALL_WEEKDAYS.every((day) => currentDays.includes(day));
    const sameDays =
      currentDays.length === groupAllowedDays.length && currentDays.every((day, idx) => day === groupAllowedDays[idx]);
    const hasCustomDays = currentDays.length > 0 && !isAllDays && !sameDays;
    if (lastSyncedGroupId.current === null && hasCustomDays) {
      lastSyncedGroupId.current = selectedGroup.id;
      return;
    }
    const nextDays = groupAllowedDays.length ? groupAllowedDays : ALL_WEEKDAYS;
    form.setValue("access.allowedDays", nextDays);
    const ranges = (access.allowedTimeRanges ?? []).filter((entry) => nextDays.includes(entry.weekday));
    form.setValue("access.allowedTimeRanges", ranges);
    lastSyncedGroupId.current = selectedGroup.id;
  }, [access.allowedDays, access.allowedTimeRanges, form, selectedGroup]);

  const addRange = (weekday: number) => {
    const ranges: DayAccess[] = access.allowedTimeRanges ?? [];
    const existing = ranges.find((r: DayAccess) => r.weekday === weekday);
    const newRange = { from: "06:00", to: "08:00" };
    const updated = existing
      ? ranges.map((entry) => (entry.weekday === weekday ? { ...entry, ranges: [...entry.ranges, newRange] } : entry))
      : [...ranges, { weekday, ranges: [newRange] }];
    form.setValue("access.allowedTimeRanges", updated);
  };

  const updateRange = (weekday: number, index: number, field: "from" | "to", value: string) => {
    const ranges: DayAccess[] = access.allowedTimeRanges ?? [];
    const updated = ranges.map((entry) =>
      entry.weekday === weekday
        ? { ...entry, ranges: entry.ranges.map((range, i) => (i === index ? { ...range, [field]: value } : range)) }
        : entry
    );
    form.setValue("access.allowedTimeRanges", updated);
  };

  const removeRange = (weekday: number, index: number) => {
    const ranges: DayAccess[] = access.allowedTimeRanges ?? [];
    const updated = ranges
      .map((entry) => (entry.weekday === weekday ? { ...entry, ranges: entry.ranges.filter((_, i) => i !== index) } : entry))
      .filter((entry) => entry.ranges.length > 0);
    form.setValue("access.allowedTimeRanges", updated);
  };

  const toggleDay = (weekday: number) => {
    const days = new Set(access.allowedDays ?? []);
    const wasActive = days.has(weekday);
    if (wasActive) {
      days.delete(weekday);
    } else {
      days.add(weekday);
    }
    const nextDays = (Array.from(days) as number[]).sort((a: number, b: number) => a - b);
    form.setValue("access.allowedDays", nextDays);
    const filtered = (access.allowedTimeRanges ?? []).filter((entry: DayAccess) => days.has(entry.weekday));
    const hasRange = filtered.some((entry: DayAccess) => entry.weekday === weekday);
    const nextRanges = !wasActive && !hasRange ? [...filtered, { weekday, ranges: [{ from: "06:00", to: "08:00" }] }] : filtered;
    form.setValue("access.allowedTimeRanges", nextRanges);
  };

  return (
    <div className="space-y-3">
      {step === 1 && (
        <Section title={t("members.wizard.sections.basicInfo")}>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            <Input
              label={t("members.form.firstName")}
              required
              register={register("firstName", { required: t("members.validation.firstName") })}
              error={toError(formState.errors.firstName?.message)}
            />
            <Input label={t("members.form.lastName")} register={register("lastName")} error={toError(formState.errors.lastName?.message)} />
            <Input label={t("members.form.fatherName")} register={register("fatherName")} />
            <Input
              label={t("members.form.phone")}
              required
              register={register("phone", { required: t("members.validation.phone") })}
              error={toError(formState.errors.phone?.message)}
            />
            <Input label={t("members.form.email")} register={register("email")} />
            <div>
              <Label>{t("members.form.gender")}</Label>
              <Controller
                control={control}
                name="gender"
                render={({ field }) => (
                  <FilterSelectMenu
                    name={field.name}
                    value={field.value ?? ""}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                    options={GENDERS.map((g) => ({
                      value: g,
                      label: t(`gender.${g.toLowerCase()}`),
                    }))}
                    buttonClassName={fieldBaseClass}
                  />
                )}
              />
            </div>
            <DateField
              label={t("members.form.birthDate")}
              control={control}
              name="birthDate"
              locale={i18n.language}
            />
            <Input label={t("members.form.nationalId")} register={register("nationalId")} />
            <Input label={t("members.form.photoUrl")} register={register("photoUrl")} />
            <Input
              label={t("members.form.deviceUserId")}
              required
              register={register("code", {
                required: t("members.validation.deviceUserId"),
                pattern: { value: /^\d+$/, message: t("members.validation.deviceUserIdNumeric") },
              })}
              error={toError(formState.errors.code?.message)}
            />
          </div>
          {devicePanel}
          <div>
            <Label>{t("members.form.notes")}</Label>
            <textarea {...register("notes")} className={fieldBaseClass} rows={3} />
          </div>
        </Section>
      )}

      {step === 2 && (
        <Section title={t("members.wizard.sections.role")}>
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <Label>{t("members.wizard.role.roleType")}</Label>
              <Controller
                control={control}
                name="role.roleType"
                render={({ field }) => (
                  <FilterSelectMenu
                    name={field.name}
                    value={field.value ?? ""}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                    options={ROLE_TYPES.map((r: RoleType) => ({
                      value: r,
                      label: roleLabels[r],
                    }))}
                    buttonClassName={fieldBaseClass}
                  />
                )}
              />
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" {...register("role.isStaff")} className="h-4 w-4 accent-brand-500" />
              <Label>{t("members.wizard.role.isStaff")}</Label>
            </div>
            <Input label={t("common.labels.customTitle")} register={register("role.customTitle")} />
          </div>
        </Section>
      )}

      {step === 4 && (
        <Section title={t("members.wizard.sections.accessPolicy")}>
          <p className={wizardMutedTextClass}>{t("members.wizard.access.hint")}</p>
          <div className="grid gap-2 md:grid-cols-3">
            {WEEKDAY_KEYS.map((key, idx) => {
              const active = access.allowedDays?.includes(idx);
              const ranges = access.allowedTimeRanges?.find((r: DayAccess) => r.weekday === idx)?.ranges ?? [];
              return (
                <div
                  key={key}
                  className={`rounded-xl border p-3 transition ${
                    active
                      ? "border-brand-400/60 bg-brand-500/10 shadow-sm"
                      : "border-[color:var(--card-border)] bg-[var(--bg-panel)]"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-[var(--text-primary)]">{t(key)}</span>
                    <input type="checkbox" checked={!!active} onChange={() => toggleDay(idx)} className="h-4 w-4 accent-brand-500" />
                  </div>
                  {active && (
                    <div className="mt-2 space-y-2 text-xs text-[var(--text-secondary)]">
                      {ranges.map((r: TimeRange, i: number) => (
                        <div
                          key={i}
                          className="flex flex-wrap items-center gap-2 rounded-lg border border-[color:var(--card-border)] bg-[var(--input-bg)] px-2 py-2"
                        >
                          <input
                            type="time"
                            value={r.from}
                            onChange={(e) => updateRange(idx, i, "from", e.target.value)}
                            className={`${fieldBaseClass} h-9 flex-1`}
                          />
                          <span className="text-[var(--text-secondary)]">-</span>
                          <input
                            type="time"
                            value={r.to}
                            onChange={(e) => updateRange(idx, i, "to", e.target.value)}
                            className={`${fieldBaseClass} h-9 flex-1`}
                          />
                          <button
                            type="button"
                            onClick={() => removeRange(idx, i)}
                            className="text-xs font-semibold text-rose-400 hover:text-rose-300"
                          >
                            {t("members.wizard.access.removeRange")}
                          </button>
                        </div>
                      ))}
                      <button
                        type="button"
                        onClick={() => addRange(idx)}
                        className="rounded-lg border border-brand-500/40 bg-brand-500/10 px-3 py-1.5 text-xs font-semibold text-[var(--color-primary)] transition hover:bg-brand-500/20"
                      >
                        {t("members.wizard.access.addRange")}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </Section>
      )}

      {step === 5 && (
        <Section title={t("members.wizard.sections.overtime")}>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="flex items-center gap-2">
              <input type="checkbox" {...register("overtime.allowOvertime")} className="h-4 w-4 accent-brand-500" />
              <Label>{t("members.wizard.overtime.allow")}</Label>
            </div>
            <div>
              <Label>{t("common.labels.rateType")}</Label>
              <Controller
                control={control}
                name="overtime.overtimeRateType"
                render={({ field }) => (
                  <FilterSelectMenu
                    name={field.name}
                    value={field.value ?? ""}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                    options={[
                      { value: "", label: t("members.wizard.overtime.select") },
                      ...OVERTIME_RATE_TYPES.map((r: OvertimeRateType) => ({
                        value: r,
                        label: overtimeRateLabels[r],
                      })),
                    ]}
                    buttonClassName={fieldBaseClass}
                    disabled={!overtime?.allowOvertime}
                  />
                )}
              />
            </div>
            <Input
              label={t("common.labels.amount")}
              type="number"
              step="0.01"
              register={register("overtime.overtimeAmount", { valueAsNumber: true })}
              disabled={!overtime?.allowOvertime}
            />
            <Input
              label={t("common.labels.maxPerDay")}
              type="number"
              step="0.5"
              register={register("overtime.maxOvertimePerDay", { valueAsNumber: true })}
              disabled={!overtime?.allowOvertime}
            />
          </div>
        </Section>
      )}

      {step === 3 && (
        <Section title={t("members.wizard.sections.staffGroup")}>
          <div className="space-y-3">
            <div className="grid gap-3 xl:grid-cols-[minmax(320px,0.95fr)_minmax(420px,1.35fr)]">
              <div className={`${wizardInnerPanelClass} space-y-3`}>
                <div>
                  <div className="flex items-center gap-2">
                    <StepBadge>1</StepBadge>
                    <p className={wizardSubTitleClass}>Select staff group</p>
                  </div>
                  <p className="mt-1 text-xs text-[var(--text-secondary)]">{t("members.wizard.group.selectionHint")}</p>
                </div>

                <div className="relative">
                  <input
                    type="search"
                    value={groupSearch}
                    onChange={(event) => setGroupSearch(event.target.value)}
                    className={`${fieldBaseClass} h-9 rounded-xl pe-10 text-[11px]`}
                    placeholder="Search groups..."
                  />
                  <SearchIcon className="pointer-events-none absolute end-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-secondary)]" />
                </div>

                <div className="space-y-2">
                  {loadingGroups ? <p className={wizardMutedTextClass}>{t("members.wizard.group.loading")}</p> : null}
                  {!loadingGroups && filteredStaffGroups.length === 0 ? <p className={wizardMutedTextClass}>No matching groups.</p> : null}
                  {filteredStaffGroups.map((group) => {
                    const isSelected = group.id === selectedGroupId;
                    const defaultShift = group.shifts?.[0];
                    return (
                      <button
                        key={group.id}
                        type="button"
                        onClick={() => selectStaffGroup(group.id)}
                        className={`w-full rounded-2xl border p-2.5 text-start transition ${
                          isSelected
                            ? "border-brand-500/75 bg-brand-500/10 shadow-[0_14px_28px_rgba(37,99,235,0.16)]"
                            : "border-[color:var(--card-border)] bg-[var(--bg-card)] hover:border-brand-500/35 hover:bg-brand-500/10"
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <span
                            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border ${
                              isSelected
                                ? "border-brand-500/55 bg-brand-500/20 text-[var(--color-primary)]"
                                : "border-[color:var(--card-border)] bg-[var(--input-bg)] text-[var(--text-secondary)]"
                            }`}
                          >
                            <UsersIcon className="h-4 w-4" />
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="truncate text-xs font-semibold text-[var(--text-primary)]">{group.name}</p>
                              {group.accessLevel ? (
                                <span className="rounded-full border border-[color:var(--card-border)] bg-[var(--input-bg)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
                                  {group.accessLevel}
                                </span>
                              ) : null}
                            </div>
                            <p className="mt-1 line-clamp-1 text-xs text-[var(--text-secondary)]">
                              {group.description || t("members.wizard.group.autoAssignHint")}
                            </p>
                            <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-[var(--text-secondary)]">
                              <span className="inline-flex items-center gap-1">
                                <ClockIcon className="h-3.5 w-3.5" />
                                {defaultShift ? `${defaultShift.shiftStart} - ${defaultShift.shiftEnd}` : t("members.wizard.group.noShifts")}
                              </span>
                              <span className="inline-flex items-center gap-1">
                                <MoneyIcon className="h-3.5 w-3.5" />
                                {defaultShift
                                  ? `${formatSalaryType(defaultShift.salaryType)} ${defaultShift.salaryAmount}`
                                  : t("members.wizard.review.notAvailable")}
                              </span>
                            </div>
                          </div>
                          <span
                            className={`mt-2 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border ${
                              isSelected
                                ? "border-brand-500 bg-brand-500 text-white"
                                : "border-[color:var(--card-border)] bg-[var(--input-bg)] text-transparent"
                            }`}
                          >
                            <CheckIcon className="h-3.5 w-3.5" />
                          </span>
                        </div>
                      </button>
                    );
                  })}

                  <button
                    type="button"
                    onClick={() => selectStaffGroup("")}
                    className={`w-full rounded-2xl border border-dashed p-2.5 text-start transition ${
                      selectedGroupId
                        ? "border-[color:var(--card-border)] bg-[var(--bg-card)] text-[var(--text-secondary)] hover:border-brand-500/35 hover:bg-brand-500/10"
                        : "border-brand-500/55 bg-brand-500/10 text-[var(--text-primary)]"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-xs font-semibold">{t("members.wizard.group.customShifts")}</p>
                        <p className="mt-1 text-xs text-[var(--text-secondary)]">{t("members.wizard.group.noGroupHint")}</p>
                      </div>
                      {!selectedGroupId ? <CheckIcon className="h-4 w-4 text-[var(--color-primary)]" /> : null}
                    </div>
                  </button>
                </div>
              </div>

              <div className="space-y-3">
                <div className={`${wizardInnerPanelClass} space-y-3`}>
                  <div>
                    <div className="flex items-center gap-2">
                      <StepBadge>2</StepBadge>
                      <p className={wizardSubTitleClass}>Group preview</p>
                    </div>
                    <p className="mt-1 text-xs text-[var(--text-secondary)]">{t("members.wizard.group.autoAssignHint")}</p>
                  </div>

                  {selectedGroup ? (
                    <div
                      className="rounded-2xl border border-brand-500/30 p-3"
                      style={{
                        background:
                          "linear-gradient(135deg, color-mix(in srgb, var(--color-primary) 18%, var(--bg-card)), color-mix(in srgb, #14b8a6 9%, var(--bg-card)))",
                      }}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-3">
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-brand-500 text-white shadow-lg shadow-brand-500/20">
                            <UsersIcon className="h-5 w-5" />
                          </span>
                          <div className="min-w-0">
                            <p className="truncate text-xs font-semibold text-[var(--text-primary)]">{selectedGroup.name}</p>
                            <p className="mt-1 text-xs text-[var(--text-secondary)]">
                              {selectedGroup.description || t("members.wizard.group.autoAssignHint")}
                            </p>
                          </div>
                        </div>
                        {selectedGroup.accessLevel ? (
                          <span className="rounded-full border border-[color:var(--card-border)] bg-[var(--input-bg)] px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
                            {selectedGroup.accessLevel}
                          </span>
                        ) : null}
                      </div>
                      <div className="mt-3 grid gap-2 md:grid-cols-3">
                        <GroupMetric
                          icon={<ClockIcon className="h-4 w-4" />}
                          label="Default shift"
                          value={primaryGroupShift ? `${primaryGroupShift.shiftStart} - ${primaryGroupShift.shiftEnd}` : "-"}
                        />
                        <GroupMetric
                          icon={<CalendarIcon className="h-4 w-4" />}
                          label={t("members.wizard.group.fields.salaryType")}
                          value={formatSalaryType(primaryGroupShift?.salaryType)}
                        />
                        <GroupMetric
                          icon={<MoneyIcon className="h-4 w-4" />}
                          label="Base salary"
                          value={primaryGroupShift ? `${primaryGroupShift.salaryAmount} AFN` : "-"}
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-dashed border-[color:var(--card-border)] bg-[var(--input-bg)] p-3">
                      <p className={wizardSubTitleClass}>{t("members.wizard.group.noGroupTitle")}</p>
                      <p className="mt-1 text-xs text-[var(--text-secondary)]">{t("members.wizard.group.noGroupHint")}</p>
                    </div>
                  )}
                </div>

                <div className={`${wizardInnerPanelClass} space-y-3`}>
                  <div>
                    <div className="flex items-center gap-2">
                      <StepBadge>3</StepBadge>
                      <p className={wizardSubTitleClass}>Assigned shifts</p>
                    </div>
                    <p className="mt-1 text-xs text-[var(--text-secondary)]">{t("members.wizard.group.selectionHint")}</p>
                  </div>

                  <div className="space-y-2">
                    {selectedGroup?.shifts?.map((shift) => (
                      <div key={shift.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[color:var(--card-border)] bg-[var(--bg-card)] p-2.5">
                        <div className="flex min-w-0 items-center gap-3">
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-500/15 text-[var(--color-primary)]">
                            <ClockIcon className="h-4 w-4" />
                          </span>
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="truncate text-xs font-semibold text-[var(--text-primary)]">{shift.shiftName}</p>
                              <span className="rounded-full bg-[var(--input-bg)] px-2 py-0.5 text-[10px] font-semibold text-[var(--text-secondary)]">Default</span>
                            </div>
                            <p className="mt-1 text-xs text-[var(--text-secondary)]">
                              {shift.shiftStart} - {shift.shiftEnd}
                            </p>
                          </div>
                        </div>
                        <span className="rounded-full border border-[color:var(--card-border)] bg-[var(--input-bg)] px-3 py-1 text-xs font-semibold text-[var(--text-secondary)]">
                          {formatSalaryType(shift.salaryType)}: {shift.salaryAmount}
                        </span>
                      </div>
                    ))}

                    {selectedGroup && (selectedGroup.shifts?.length ?? 0) === 0 ? (
                      <p className="rounded-xl border border-amber-400/35 bg-amber-400/10 px-3 py-2 text-xs text-amber-300">{t("members.wizard.group.noShifts")}</p>
                    ) : null}

                    {extraShiftFields.map((field, idx) => {
                      const mappedShiftId = (extraShifts?.[idx]?.shiftId as string | undefined) ?? "";
                      const template = shiftTemplates.find((t) => t.id === mappedShiftId);
                      return (
                        <div key={field.id} className="rounded-2xl border border-brand-500/25 bg-brand-500/10 p-2.5">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div className="flex min-w-0 items-center gap-3">
                              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-500/20 text-[var(--color-primary)]">
                                <CalendarIcon className="h-4 w-4" />
                              </span>
                              <div className="min-w-0">
                                <p className="truncate text-xs font-semibold text-[var(--text-primary)]">{template?.shiftName ?? t("members.wizard.group.shiftFallback")}</p>
                                <p className="mt-1 text-xs text-[var(--text-secondary)]">
                                  {template?.shiftStart} - {template?.shiftEnd}
                                  {template?.staffGroup ? ` - ${template.staffGroup.name}` : ""}
                                </p>
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => removeExtraShift(idx)}
                              className={wizardIconDangerClass}
                              aria-label={t("members.wizard.group.remove")}
                            >
                              <TrashIcon className="h-4 w-4" />
                            </button>
                          </div>
                          <div className="mt-3 grid gap-3 md:grid-cols-[minmax(140px,1fr)_minmax(140px,1fr)_auto]">
                            <div>
                              <Label>{t("members.wizard.group.baseRate")}</Label>
                              <div className="h-9 rounded-xl border border-[color:var(--card-border)] bg-[var(--bg-card)] px-3 py-1.5 text-[11px] text-[var(--text-secondary)]">
                                {template ? `${formatSalaryType(template.salaryType)} - ${template.salaryAmount}` : t("members.wizard.review.notAvailable")}
                              </div>
                            </div>
                            <div>
                              <Label>{t("members.wizard.group.overrideAmount")}</Label>
                              <input
                                type="number"
                                step="0.01"
                                className={`${fieldBaseClass} h-9 rounded-xl text-[11px]`}
                                {...register(`extraShifts.${idx}.rateOverride` as const, { valueAsNumber: true })}
                              />
                            </div>
                            <label className="mt-5 flex items-center gap-2 text-xs text-[var(--text-secondary)]">
                              <input type="checkbox" {...register(`extraShifts.${idx}.isActive` as const)} className="h-4 w-4 accent-brand-500" defaultChecked />
                              {t("common.status.active")}
                            </label>
                          </div>
                        </div>
                      );
                    })}

                    {!selectedGroup && extraShiftFields.length === 0 && shiftFields.length === 0 ? (
                      <p className="rounded-xl border border-dashed border-[color:var(--card-border)] bg-[var(--input-bg)] px-3 py-2 text-xs text-[var(--text-secondary)]">
                        {t("members.wizard.group.extraEmpty")}
                      </p>
                    ) : null}
                  </div>

                  <div className="grid items-end gap-2 lg:grid-cols-[minmax(240px,1fr)_auto_auto]">
                    <div>
                      <Label>{t("members.wizard.group.addExtraShift")}</Label>
                      <FilterSelectMenu
                        value={selectedExtraId}
                        onChange={setSelectedExtraId}
                        options={[
                          { value: "", label: t("members.wizard.group.selectTemplate") },
                          ...shiftTemplates.map((shift) => ({
                            value: shift.id,
                            label: `${shift.shiftName} (${shift.shiftStart}-${shift.shiftEnd})${shift.staffGroup?.name ? ` - ${shift.staffGroup.name}` : ""}`,
                            disabled: groupShiftIds.has(shift.id) || extraShiftIds.has(shift.id),
                          })),
                        ]}
                        buttonClassName={`${fieldBaseClass} h-9 rounded-xl text-[11px]`}
                        disabled={loadingShifts || shiftTemplates.length === 0}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        if (!selectedExtraId) return;
                        if (groupShiftIds.has(selectedExtraId) || extraShiftIds.has(selectedExtraId)) {
                          setSelectedExtraId("");
                          return;
                        }
                        const template = shiftTemplates.find((s) => s.id === selectedExtraId);
                        if (!template) return;
                        appendExtraShift({
                          shiftId: template.id,
                          rateOverride: template.salaryAmount,
                          isActive: template.isActive,
                        });
                        setSelectedExtraId("");
                      }}
                      className={wizardButtonAccentClass}
                      disabled={loadingShifts || !selectedExtraId}
                    >
                      <PlusIcon className="h-4 w-4" />
                      {t("members.wizard.group.addExtraShift")}
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        appendShift({
                          shiftName: t("members.wizard.group.newShift"),
                          shiftStart: "08:00",
                          shiftEnd: "16:00",
                          earlyAccessMinutes: 15,
                          salaryType: "MONTHLY",
                          salaryAmount: 0,
                          isActive: true,
                        })
                      }
                      className={wizardButtonSuccessClass}
                    >
                      <PlusIcon className="h-4 w-4" />
                      {t("members.wizard.group.addCustomShift")}
                    </button>
                  </div>

                  {shiftFields.length > 0 ? (
                    <div className="space-y-2">
                      {shiftFields.map((field, idx) => (
                        <div key={field.id} className={wizardSoftPanelClass}>
                          <div className="grid gap-2 md:grid-cols-3 xl:grid-cols-6">
                            <Input label={t("common.labels.name")} register={register(`shifts.${idx}.shiftName` as const, { required: true })} />
                            <Input label={t("members.wizard.group.fields.start")} type="time" register={register(`shifts.${idx}.shiftStart` as const, { required: true })} />
                            <Input label={t("members.wizard.group.fields.end")} type="time" register={register(`shifts.${idx}.shiftEnd` as const, { required: true })} />
                            <div>
                              <Label>{t("members.wizard.group.fields.salaryType")}</Label>
                              <Controller
                                control={control}
                                name={`shifts.${idx}.salaryType` as const}
                                render={({ field }) => (
                                  <FilterSelectMenu
                                    name={field.name}
                                    value={field.value ?? ""}
                                    onChange={field.onChange}
                                    onBlur={field.onBlur}
                                    options={SALARY_TYPES.map((s: SalaryType) => ({
                                      value: s,
                                      label: salaryTypeLabels[s],
                                    }))}
                                    buttonClassName={fieldBaseClass}
                                  />
                                )}
                              />
                            </div>
                            <Input
                              label={t("common.labels.amount")}
                              type="number"
                              step="0.01"
                              register={register(`shifts.${idx}.salaryAmount` as const, { valueAsNumber: true })}
                            />
                            <div className="flex items-end justify-between gap-2">
                              <label className="mb-2 flex items-center gap-2 text-xs text-[var(--text-secondary)]">
                                <input type="checkbox" {...register(`shifts.${idx}.isActive` as const)} className="h-4 w-4 accent-brand-500" defaultChecked />
                                {t("common.status.active")}
                              </label>
                              <button
                                type="button"
                                onClick={() => removeShift(idx)}
                                className={wizardIconDangerClass}
                                aria-label={t("common.actions.delete")}
                              >
                                <TrashIcon className="h-4 w-4" />
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-[var(--text-secondary)]">{t("members.wizard.group.customHint")}</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </Section>
      )}

      {step === 6 && (
        <Section title={t("members.wizard.sections.review")}>
          <p className={wizardMutedTextClass}>{t("members.wizard.review.staffHint")}</p>
          <div className="grid gap-2 text-xs text-[var(--text-secondary)] md:grid-cols-2">
            <span>
              {t("members.wizard.review.name", {
                firstName: watch("firstName"),
                lastName: watch("lastName"),
              })}
            </span>
            <span>{t("members.wizard.review.phone", { phone: watch("phone") })}</span>
            <span>
              {t("members.wizard.review.role", {
                role: roleType ? (roleLabels[roleType] ?? roleType) : t("members.wizard.review.notAvailable"),
              })}
            </span>
            <span>
              {t("members.wizard.review.overtime", {
                status: watch("overtime.allowOvertime") ? t("members.wizard.review.allowed") : t("members.wizard.review.notAllowed"),
              })}
            </span>
            <span>
              {t("members.wizard.review.shifts", {
                count: (selectedGroup?.shifts?.length ?? 0) + extraShiftFields.length + shiftFields.length,
              })}
            </span>
          </div>
        </Section>
      )}
    </div>
  );
}

function CustomerForm({
  form,
  step,
  plans,
  loadingPlans,
  setPlanDefaults,
  devicePanel,
}: {
  form: UseFormReturn<WizardFormValues>;
  step: number;
  plans: MembershipPlan[];
  loadingPlans: boolean;
  setPlanDefaults: (plan: MembershipPlan) => void;
  devicePanel?: React.ReactNode;
}) {
  const { t } = useTranslation();
  const { register, watch, formState, control } = form;
  const access = watch("customerAccess") as CustomerFormPayload["customerAccess"];
  const price = Number(watch("membership.price") ?? 0);
  const discount = Number(watch("membership.discount") ?? 0);
  const paid = Number(watch("membership.paidAmount") ?? 0);
  const totalDue = Math.max(0, price - discount);
  const debt = Math.max(0, totalDue - paid);
  const paymentStatus =
    paid >= totalDue
      ? t("members.wizard.membership.paymentStatus.paid")
      : paid > 0
        ? t("members.wizard.membership.paymentStatus.partial")
        : t("members.wizard.membership.paymentStatus.unpaid");
  const membershipErrors = formState.errors.membership as { planId?: { message?: unknown } } | undefined;
  const planError = toError(membershipErrors?.planId?.message);

  const toggleDay = (weekday: number) => {
    const days = new Set(access.allowedDays ?? []);
    const wasActive = days.has(weekday);
    if (wasActive) {
      days.delete(weekday);
    } else {
      days.add(weekday);
    }
    const nextDays = (Array.from(days) as number[]).sort((a: number, b: number) => a - b);
    form.setValue("customerAccess.allowedDays", nextDays);
    const filtered = (access.allowedTimeRanges ?? []).filter((entry: DayAccess) => days.has(entry.weekday));
    const hasRange = filtered.some((entry: DayAccess) => entry.weekday === weekday);
    const nextRanges = !wasActive && !hasRange ? [...filtered, { weekday, ranges: [{ from: "06:00", to: "22:00" }] }] : filtered;
    form.setValue("customerAccess.allowedTimeRanges", nextRanges);
  };

  const addRange = (weekday: number) => {
    const ranges: DayAccess[] = access.allowedTimeRanges ?? [];
    const existing = ranges.find((r: DayAccess) => r.weekday === weekday);
    const newRange = { from: "06:00", to: "22:00" };
    const updated = existing
      ? ranges.map((entry) => (entry.weekday === weekday ? { ...entry, ranges: [...entry.ranges, newRange] } : entry))
      : [...ranges, { weekday, ranges: [newRange] }];
    form.setValue("customerAccess.allowedTimeRanges", updated);
  };

  const updateRange = (weekday: number, index: number, field: "from" | "to", value: string) => {
    const ranges: DayAccess[] = access.allowedTimeRanges ?? [];
    const updated = ranges.map((entry) =>
      entry.weekday === weekday
        ? { ...entry, ranges: entry.ranges.map((range, i) => (i === index ? { ...range, [field]: value } : range)) }
        : entry
    );
    form.setValue("customerAccess.allowedTimeRanges", updated);
  };

  const removeRange = (weekday: number, index: number) => {
    const ranges: DayAccess[] = access.allowedTimeRanges ?? [];
    const updated = ranges
      .map((entry) => (entry.weekday === weekday ? { ...entry, ranges: entry.ranges.filter((_, i) => i !== index) } : entry))
      .filter((entry) => entry.ranges.length > 0);
    form.setValue("customerAccess.allowedTimeRanges", updated);
  };

  return (
    <div className="space-y-3">
      {step === 1 && (
        <Section title={t("members.wizard.sections.basicInfo")}>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            <Input
              label={t("members.form.firstName")}
              required
              register={register("firstName", { required: t("members.validation.firstName") })}
              error={toError(formState.errors.firstName?.message)}
            />
            <Input label={t("members.form.lastName")} register={register("lastName")} />
            <Input
              label={t("members.form.phone")}
              required
              register={register("phone", { required: t("members.validation.phone") })}
              error={toError(formState.errors.phone?.message)}
            />
            <Input
              label={t("members.form.deviceUserId")}
              required
              register={register("code", {
                required: t("members.validation.deviceUserId"),
                pattern: { value: /^\d+$/, message: t("members.validation.deviceUserIdNumeric") },
              })}
              error={toError(formState.errors.code?.message)}
            />
            <div>
              <Label>{t("members.form.gender")}</Label>
              <Controller
                control={control}
                name="gender"
                render={({ field }) => (
                  <FilterSelectMenu
                    name={field.name}
                    value={field.value ?? ""}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                    options={GENDERS.map((g) => ({
                      value: g,
                      label: t(`gender.${g.toLowerCase()}`),
                    }))}
                    buttonClassName={fieldBaseClass}
                  />
                )}
              />
            </div>
          </div>
          {devicePanel}
        </Section>
      )}

      {step === 2 && (
        <Section title={t("members.wizard.sections.membership")}>
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <Label required>{t("members.wizard.membership.plan")}</Label>
              <Controller
                control={control}
                name="membership.planId"
                rules={{ required: t("members.validation.plan") }}
                render={({ field }) => (
                  <FilterSelectMenu
                    name={field.name}
                    value={field.value ?? ""}
                    onChange={(value) => {
                      field.onChange(value);
                      const plan = plans.find((p) => p.id === value);
                      if (plan) {
                        setPlanDefaults(plan);
                        const start = form.getValues("membership.startDate") || formatDateInputValue(new Date());
                        const end = computeMembershipEndDate(start, plan);
                        form.setValue("membership.endDate", end);
                        form.setValue("membership.status", "ACTIVE");
                      }
                    }}
                    onBlur={field.onBlur}
                    options={[
                      { value: "", label: t("members.wizard.membership.selectPlan") },
                      ...plans.map((plan) => ({
                        value: plan.id,
                        label: `${plan.name} (${plan.durationValue} ${plan.durationUnit?.toLowerCase()})`,
                      })),
                    ]}
                    buttonClassName={`${fieldBaseClass} ${planError ? fieldErrorClass : ""}`}
                    ariaInvalid={Boolean(planError)}
                    disabled={loadingPlans}
                  />
                )}
              />
              {planError ? (
                <p className="mt-1 text-xs text-rose-300">{planError}</p>
              ) : (
                <p className={wizardMutedTextClass}>{t("members.wizard.membership.autoDates")}</p>
              )}
            </div>
            <Input label={t("members.wizard.membership.price")} type="number" step="0.01" register={register("membership.price", { valueAsNumber: true })} />
            <Input label={t("members.wizard.membership.discount")} type="number" step="0.01" register={register("membership.discount", { valueAsNumber: true })} />
            <Input label={t("members.wizard.membership.paidAmount")} type="number" step="0.01" register={register("membership.paidAmount", { valueAsNumber: true })} />
          </div>
          <div className="grid gap-3 md:grid-cols-3 mt-3">
            <div className={wizardSoftPanelClass}>
              <p className={wizardSubTitleClass}>{t("members.wizard.membership.totalDue")}</p>
              <p className="mt-1 text-xs font-semibold text-[var(--text-primary)]">{totalDue}</p>
            </div>
            <div className={wizardSoftPanelClass}>
              <p className={wizardSubTitleClass}>{t("members.wizard.membership.paid")}</p>
              <p className="mt-1 text-xs font-semibold text-[var(--text-primary)]">{paid}</p>
            </div>
            <div className={wizardSoftPanelClass}>
              <p className={wizardSubTitleClass}>{t("members.wizard.membership.debt")}</p>
              <p className="mt-1 text-xs font-semibold text-[var(--text-primary)]">{debt}</p>
            </div>
          </div>
          <div className="mt-3 flex items-center gap-2 text-xs">
            <span className="rounded-full border border-[color:var(--card-border)] bg-[var(--input-bg)] px-3 py-1 font-semibold text-[var(--text-primary)]">
              {t("members.wizard.membership.paymentStatusLabel", { status: paymentStatus })}
            </span>
          </div>
        </Section>
      )}

      {step === 3 && (
        <Section title={t("members.wizard.sections.accessPolicy")}>
          <div className="grid gap-2 md:grid-cols-3">
            {WEEKDAY_KEYS.map((key, idx) => {
              const active = access.allowedDays?.includes(idx);
              const ranges = access.allowedTimeRanges?.find((r) => r.weekday === idx)?.ranges ?? [];
              return (
                <div
                  key={key}
                  className={`rounded-xl border p-3 transition ${
                    active
                      ? "border-brand-400/60 bg-brand-500/10 shadow-sm"
                      : "border-[color:var(--card-border)] bg-[var(--bg-panel)]"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-[var(--text-primary)]">{t(key)}</span>
                    <input type="checkbox" checked={!!active} onChange={() => toggleDay(idx)} className="h-4 w-4 accent-brand-500" />
                  </div>
                  {active && (
                    <div className="mt-2 space-y-2 text-xs text-[var(--text-secondary)]">
                      {ranges.map((r: TimeRange, i: number) => (
                        <div
                          key={i}
                          className="flex flex-wrap items-center gap-2 rounded-lg border border-[color:var(--card-border)] bg-[var(--input-bg)] px-2 py-2"
                        >
                          <input
                            type="time"
                            value={r.from}
                            onChange={(e) => updateRange(idx, i, "from", e.target.value)}
                            className={`${fieldBaseClass} h-9 flex-1`}
                          />
                          <span className="text-[var(--text-secondary)]">-</span>
                          <input
                            type="time"
                            value={r.to}
                            onChange={(e) => updateRange(idx, i, "to", e.target.value)}
                            className={`${fieldBaseClass} h-9 flex-1`}
                          />
                          <button
                            type="button"
                            onClick={() => removeRange(idx, i)}
                            className="text-xs font-semibold text-rose-400 hover:text-rose-300"
                          >
                            {t("members.wizard.access.removeRange")}
                          </button>
                        </div>
                      ))}
                      <button
                        type="button"
                        onClick={() => addRange(idx)}
                        className="rounded-lg border border-brand-500/40 bg-brand-500/10 px-3 py-1.5 text-xs font-semibold text-[var(--color-primary)] transition hover:bg-brand-500/20"
                      >
                        {t("members.wizard.access.addRange")}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <Input label={t("members.wizard.access.maxEntries")} type="number" register={register("customerAccess.maxEntriesPerDay", { valueAsNumber: true })} />
        </Section>
      )}

      {step === 4 && (
        <Section title={t("members.wizard.sections.review")}>
          <p className={wizardMutedTextClass}>{t("members.wizard.review.customerHint")}</p>
          <div className="grid gap-2 text-xs text-[var(--text-secondary)] md:grid-cols-2">
            <span>
              {t("members.wizard.review.name", {
                firstName: watch("firstName"),
                lastName: watch("lastName"),
              })}
            </span>
            <span>{t("members.wizard.review.phone", { phone: watch("phone") })}</span>
            <span>
              {t("members.wizard.review.plan", {
                plan: plans.find((p) => p.id === watch("membership.planId"))?.name || t("members.wizard.review.notAvailable"),
              })}
            </span>
            <span>{t("members.wizard.review.status", { status: watch("membership.status") })}</span>
            <span>{t("members.wizard.review.price", { price: watch("membership.price") })}</span>
            <span>{t("members.wizard.review.paid", { paid: watch("membership.paidAmount") })}</span>
            <span>{t("members.wizard.review.paymentStatus", { status: paymentStatus })}</span>
            <span>{t("members.wizard.review.debt", { debt })}</span>
          </div>
        </Section>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-[color:var(--card-border)] bg-[var(--bg-card)] p-2.5">
      <h4 className={wizardSectionTitleClass}>{title}</h4>
      <div className="mt-2 space-y-2">{children}</div>
    </div>
  );
}

function Label({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <p className="mb-0.5 text-[10px] font-semibold text-[var(--text-secondary)]">
      <span className="inline-flex items-center gap-1">
        <span>{children}</span>
        {required ? <span className="h-1.5 w-1.5 rounded-full bg-rose-400" /> : null}
      </span>
    </p>
  );
}

function StepBadge({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-brand-500/45 bg-brand-500/15 text-[9px] font-semibold text-[var(--color-primary)]">
      {children}
    </span>
  );
}

function GroupMetric({ icon, label, value }: { icon: React.ReactNode; label: React.ReactNode; value: React.ReactNode }) {
  return (
    <div className="flex min-w-0 items-center gap-1.5 rounded-lg border border-[color:var(--card-border)] bg-[var(--input-bg)] px-2 py-1.5">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-brand-500/15 text-[var(--color-primary)]">{icon}</span>
      <div className="min-w-0">
        <p className="truncate text-[10px] text-[var(--text-secondary)]">{label}</p>
        <p className="truncate text-[11px] font-semibold text-[var(--text-primary)]">{value}</p>
      </div>
    </div>
  );
}

function Input({
  label,
  type = "text",
  register,
  error,
  disabled,
  step,
  required,
}: {
  label: string;
  type?: string;
  register: UseFormRegisterReturn;
  error?: string;
  disabled?: boolean;
  step?: string;
  required?: boolean;
}) {
  const hasError = Boolean(error);
  return (
    <div>
      <Label required={required}>{label}</Label>
      <input
        type={type}
        step={step}
        {...register}
        disabled={disabled}
        aria-invalid={hasError}
        className={`${fieldBaseClass} ${hasError ? fieldErrorClass : ""}`}
      />
      {hasError ? <p className="mt-1 text-[10px] text-rose-300">{error}</p> : null}
    </div>
  );
}

function DateField({
  label,
  control,
  name,
  locale,
  error,
  disabled,
  required,
}: {
  label: string;
  control: Control<WizardFormValues>;
  name: WizardDateFieldName;
  locale: string;
  error?: string;
  disabled?: boolean;
  required?: boolean;
}) {
  const hasError = Boolean(error);

  return (
    <div>
      <Label required={required}>{label}</Label>
      <Controller
        control={control}
        name={name}
        render={({ field }) => (
          <ShamsiDateInput
            value={field.value ?? ""}
            onChange={field.onChange}
            locale={locale}
            disabled={disabled}
            inputClassName={`${fieldBaseClass} ${hasError ? fieldErrorClass : ""}`}
          />
        )}
      />
      {hasError ? <p className="mt-1 text-[10px] text-rose-300">{error}</p> : null}
    </div>
  );
}

type SelectOption = {
  value: string;
  label: string;
  disabled?: boolean;
};

function FilterSelectMenu({
  name,
  value,
  options,
  onChange,
  onBlur,
  buttonClassName = "",
  containerClassName = "",
  disabled = false,
  ariaInvalid = false,
}: {
  name?: string;
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  onBlur?: () => void;
  buttonClassName?: string;
  containerClassName?: string;
  disabled?: boolean;
  ariaInvalid?: boolean;
}) {
  const isDisabled = Boolean(disabled);
  const [open, setOpen] = useState(false);
  const [disabledSnapshot, setDisabledSnapshot] = useState(isDisabled);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const selectedOption = options.find((option) => option.value === value);
  const displayLabel = selectedOption?.label ?? options[0]?.label ?? "";
  if (disabledSnapshot !== isDisabled) {
    setDisabledSnapshot(isDisabled);
    if (isDisabled && open) setOpen(false);
  }

  useEffect(() => {
    if (!open) return;
    const handleClick = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className={`relative ${containerClassName}`}>
      <button
        name={name}
        type="button"
        className={`${buttonClassName} flex w-full items-center justify-between gap-2 text-start ${
          isDisabled ? "cursor-not-allowed opacity-60" : "cursor-pointer hover:bg-brand-500/10"
        }`}
        onClick={() => {
          if (!isDisabled) {
            setOpen((prev) => !prev);
          }
        }}
        onBlur={onBlur}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-invalid={ariaInvalid || undefined}
        aria-disabled={isDisabled || undefined}
        disabled={isDisabled}
      >
        <span className="truncate">{displayLabel}</span>
        <ChevronDownIcon
          className={`h-3.5 w-3.5 shrink-0 text-[var(--text-secondary)] transition ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && !isDisabled ? (
        <div className="submenu-panel absolute z-50 mt-1 w-full overflow-hidden rounded-xl border backdrop-blur">
          <div role="listbox" className="max-h-56 overflow-auto">
            {options.map((option, index) => {
              const isSelected = option.value === value;
              const isOptionDisabled = Boolean(option.disabled);
              const optionKey = option.value === "" ? `empty-${index}` : option.value;
              return (
                <button
                  key={optionKey}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  aria-disabled={isOptionDisabled || undefined}
                  disabled={isOptionDisabled}
                  className={`submenu-option flex w-full items-center justify-between rounded-lg text-start transition ${
                    isSelected ? "is-selected" : ""
                  } ${isOptionDisabled ? "is-disabled" : ""}`}
                  onClick={() => {
                    if (isOptionDisabled) return;
                    if (option.value !== value) {
                      onChange(option.value);
                    }
                    setOpen(false);
                  }}
                >
                  <span className="truncate">{option.label}</span>
                  {isSelected ? <CheckIcon className="submenu-check h-3 w-3" /> : null}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function DeviceEnrollmentPanel({
  devices,
  selectedDeviceId,
  onSelectDevice,
  onSuggestId,
  onEnroll,
  loadingDevices,
  suggesting,
  enrolling,
  error,
  fingerId,
  onFingerIdChange,
}: {
  devices: Device[];
  selectedDeviceId: string;
  onSelectDevice: (id: string) => void;
  onSuggestId: () => void;
  onEnroll: () => void;
  loadingDevices: boolean;
  suggesting: boolean;
  enrolling: boolean;
  error: string | null;
  fingerId: number | null;
  onFingerIdChange: (value: number | null) => void;
}) {
  const { t } = useTranslation();
  const hasDevices = devices.length > 0;

  return (
    <div className={`${wizardInnerPanelClass} mt-3`}>
      <p className={wizardSubTitleClass}>{t("members.wizard.device.title")}</p>
      {hasDevices ? (
        <div className="mt-2 space-y-3">
          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
            <div>
              <Label>{t("members.wizard.device.deviceLabel")}</Label>
              <FilterSelectMenu
                value={selectedDeviceId}
                onChange={onSelectDevice}
                options={devices.map((device) => ({
                  value: device.id,
                  label: `${device.name} (${device.connectionType})`,
                }))}
                buttonClassName={fieldBaseClass}
                disabled={loadingDevices}
              />
            </div>
            <div>
              <Label>{t("members.wizard.device.fingerLabel")}</Label>
              <FingerIdPicker value={fingerId} onChange={onFingerIdChange} disabled={loadingDevices || enrolling} />
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={onSuggestId}
              className={wizardButtonSecondaryClass}
              disabled={suggesting || loadingDevices}
            >
              {suggesting ? t("members.wizard.device.suggesting") : t("members.wizard.device.suggestId")}
            </button>
            <button
              type="button"
              onClick={onEnroll}
              className={wizardButtonSuccessClass}
              disabled={enrolling || loadingDevices}
            >
              {enrolling ? t("members.wizard.device.enrolling") : t("members.wizard.device.enroll")}
            </button>
          </div>
        </div>
      ) : (
        <p className={wizardMutedTextClass}>{t("members.wizard.device.noDevices")}</p>
      )}
      {error ? <p className="mt-2 text-xs text-rose-300">{error}</p> : null}
    </div>
  );
}

function normalizeAccess(access: { allowedDays: number[]; allowedTimeRanges: DayAccess[]; maxEntriesPerDay?: number | null }) {
  const allowedDays = Array.from(new Set(access.allowedDays ?? [])).sort((a: number, b: number) => a - b);
  const allowedSet = new Set(allowedDays);
  const allowedTimeRanges = (access.allowedTimeRanges ?? [])
    .filter((entry: DayAccess) => allowedSet.has(entry.weekday))
    .map((entry: DayAccess) => {
      const ranges = (entry.ranges ?? []).filter((r: TimeRange) => r.from && r.to);
      return { weekday: entry.weekday, ranges: ranges.map((r: TimeRange) => ({ from: r.from, to: r.to })) };
    })
    .filter((entry) => entry.ranges.length > 0);
  const maxEntries = typeof access.maxEntriesPerDay === "number" && !Number.isNaN(access.maxEntriesPerDay) ? access.maxEntriesPerDay : undefined;
  return maxEntries !== undefined ? { allowedDays, allowedTimeRanges, maxEntriesPerDay: maxEntries } : { allowedDays, allowedTimeRanges };
}

function addDays(date: Date, days: number) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function addPlanDuration(start: Date, durationValue: number, durationUnit?: string) {
  const total = Math.max(1, Number(durationValue) || 0);
  const totalDays = durationUnit === "MONTHS" ? total * 30 : total;
  return addDays(start, totalDays);
}

function computeMembershipEndDate(start: string, plan: MembershipPlan) {
  const startDate = parseDateInputValue(start);
  if (!startDate) {
    return start;
  }
  const endDate = addPlanDuration(startDate, plan.durationValue ?? 0, plan.durationUnit);
  return formatDateInputValue(endDate);
}

function toError(message: unknown): string | undefined {
  if (!message) return undefined;
  if (typeof message === "string") return message;
  if (typeof message === "object" && "message" in message) {
    const nestedMessage = (message as { message?: unknown }).message;
    if (typeof nestedMessage === "string") return nestedMessage;
  }
  return String(message);
}

function ChevronDownIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

function CheckIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M20 6l-11 11-5-5" />
    </svg>
  );
}

function UsersIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function SearchIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  );
}

function ClockIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 6v6l4 2" />
    </svg>
  );
}

function MoneyIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M12 2v20" />
      <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7H14a3.5 3.5 0 0 1 0 7H6" />
    </svg>
  );
}

function CalendarIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M8 2v4" />
      <path d="M16 2v4" />
      <rect width="18" height="18" x="3" y="4" rx="2" />
      <path d="M3 10h18" />
    </svg>
  );
}

function PlusIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </svg>
  );
}

function TrashIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M3 6h18" />
      <path d="M8 6V4h8v2" />
      <path d="M19 6l-1 14H6L5 6" />
      <path d="M10 11v5" />
      <path d="M14 11v5" />
    </svg>
  );
}
