import { IconBriefcase, IconCalendarTime, IconEdit, IconFingerprint, IconUser } from "@tabler/icons-react";
import { useEffect, useMemo, useState, type FormEvent, type ReactElement, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams } from "react-router-dom";
import {
  createEmployee,
  getEmployee,
  listEmployeeStaffGroupOptions,
  updateEmployee,
  type EmployeeDetail,
  type EmployeeGender,
  type EmployeePayload,
  type EmployeeRole,
  type EmployeeStaffGroupOption,
  type EmployeeStatus,
} from "../../api/employees";
import { enrollDevice, listDevices, suggestDeviceUserId, type Device } from "../../api/devices";
import { useAuth } from "../../auth/AuthContext";
import { FingerIdPicker } from "../../components/device/FingerIdPicker";
import { DropdownSelect } from "../../components/ui/DropdownSelect";
import { PageHeader } from "../../components/ui/PageHeader";
import { ErrorState } from "../../components/ui/StatePanel";
import { rtlLanguages } from "../../i18n/config";
import { getEmployeeCopy } from "./employeeCopy";

const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];
const ROLES: EmployeeRole[] = ["EMPLOYEE", "MANAGER", "OWNER", "ADMIN", "COACH", "RECEPTION", "OTHER"];
const wizardButtonSecondaryClass = "btn-cancel inline-flex min-h-8 items-center justify-center rounded-lg border border-[color:var(--card-border)] bg-[var(--bg-card)] px-2.5 py-1 text-[10px] font-semibold text-[var(--text-secondary)] transition hover:border-brand-500/40 hover:bg-brand-500/10 hover:text-[var(--text-primary)]";
const wizardButtonPrimaryClass = "inline-flex min-h-8 items-center justify-center rounded-lg border border-brand-500/50 bg-brand-500/85 px-3 py-1 text-[10px] font-semibold text-white transition hover:bg-brand-500 disabled:cursor-not-allowed disabled:opacity-60";
const wizardButtonSuccessClass = "inline-flex min-h-8 items-center justify-center gap-1.5 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-1 text-[10px] font-semibold text-emerald-300 transition hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-55";
type DayRanges = Record<number, { from: string; to: string }>;

type FormState = {
  code: string; firstName: string; lastName: string; fatherName: string; phone: string; email: string;
  gender: EmployeeGender; birthDate: string; nationalId: string; status: EmployeeStatus; roleType: EmployeeRole;
  customTitle: string; position: string; department: string; systemRole: string; notes: string; staffGroupId: string;
  allowedDays: number[]; dayRanges: DayRanges; allowOvertime: boolean; maxOvertimePerDay: string; useCustomShift: boolean;
  shiftName: string; shiftStart: string; shiftEnd: string; graceMinutes: string; earlyAccessMinutes: string;
  retainedCustomShifts: EmployeePayload["shifts"]; extraShifts: EmployeePayload["extraShifts"];
};
type SetFormValue = <K extends keyof FormState>(key: K, value: FormState[K]) => void;

const defaultRanges = Object.fromEntries(ALL_DAYS.map((day) => [day, { from: "00:00", to: "23:59" }])) as DayRanges;
const initialState: FormState = {
  code: "", firstName: "", lastName: "", fatherName: "", phone: "", email: "", gender: "MALE", birthDate: "",
  nationalId: "", status: "ACTIVE", roleType: "EMPLOYEE", customTitle: "", position: "", department: "", systemRole: "",
  notes: "", staffGroupId: "", allowedDays: [...ALL_DAYS], dayRanges: defaultRanges, allowOvertime: false,
  maxOvertimePerDay: "", useCustomShift: false, shiftName: "", shiftStart: "08:00", shiftEnd: "16:00",
  graceMinutes: "0", earlyAccessMinutes: "15",
  retainedCustomShifts: [], extraShifts: [],
};

export function AddEmployee() {
  return <EmployeeForm mode="add" />;
}

export function EditEmployee() {
  return <EmployeeForm mode="edit" />;
}

function EmployeeForm({ mode }: { mode: "add" | "edit" }) {
  const { id } = useParams<{ id: string }>();
  const { i18n } = useTranslation();
  const copy = getEmployeeCopy(i18n.language);
  const navigate = useNavigate();
  const { hasPermission } = useAuth();
  const canEnrollDevices = hasPermission("DEVICES_ENROLL");
  const [form, setForm] = useState<FormState>(initialState);
  const [groups, setGroups] = useState<EmployeeStaffGroupOption[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState("");
  const [fingerId, setFingerId] = useState<number | null>(null);
  const [enrollmentQueued, setEnrollmentQueued] = useState(false);
  const [enrolling, setEnrolling] = useState(false);
  const [suggestingId, setSuggestingId] = useState(false);
  const [enrollmentMessage, setEnrollmentMessage] = useState<string | null>(null);
  const [persistedEmployeeId, setPersistedEmployeeId] = useState<string | null>(null);
  const [loading, setLoading] = useState(mode === "edit");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState(0);
  const isRtl = rtlLanguages.includes(i18n.language.split("-")[0]);
  const addSteps = [copy.employees, copy.personal, copy.work, copy.group, copy.schedule, copy.overtime, copy.employeeDetails];

  useEffect(() => {
    void listEmployeeStaffGroupOptions().then((response) => setGroups(response.data)).catch(() => setGroups([]));
  }, []);

  useEffect(() => {
    if (!canEnrollDevices) return;
    void listDevices({ type: "FINGERPRINT", enabled: true })
      .then((response) => setDevices(response.data.filter((device) => device.type === "FINGERPRINT" && (device.connectionType === "NETWORK" || device.connectionType === "ZKTECO_PULL_SDK"))))
      .catch(() => setDevices([]));
  }, [canEnrollDevices]);

  useEffect(() => {
    if (!selectedDeviceId && devices.length) setSelectedDeviceId(devices[0]!.id);
  }, [devices, selectedDeviceId]);

  useEffect(() => {
    if (mode !== "edit" || !id) return;
    void getEmployee(id)
      .then((response) => setForm(fromEmployee(response.data)))
      .catch((loadError) => setError(loadError instanceof Error ? loadError.message : copy.loadFailed))
      .finally(() => setLoading(false));
  }, [copy.loadFailed, id, mode]);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((current) => ({ ...current, [key]: value }));
  const scheduleValid = Boolean(form.staffGroupId || form.extraShifts.length || (form.useCustomShift && form.shiftName.trim()));
  const valid = Boolean(form.code.match(/^\d+$/u) && form.firstName.trim() && form.allowedDays.length && scheduleValid);

  const payload = useMemo<EmployeePayload>(() => ({
    code: form.code.trim(), firstName: form.firstName.trim(), lastName: optional(form.lastName), fatherName: optional(form.fatherName),
    phone: optional(form.phone), email: optional(form.email), gender: form.gender, birthDate: optional(form.birthDate),
    nationalId: optional(form.nationalId), status: form.status, notes: optional(form.notes),
    role: { roleType: form.roleType, customTitle: optional(form.customTitle) },
    profile: { position: optional(form.position), department: optional(form.department), systemRole: optional(form.systemRole) },
    access: {
      allowedDays: [...form.allowedDays].sort((a, b) => a - b),
      allowedTimeRanges: form.allowedDays.map((weekday) => ({ weekday, ranges: [form.dayRanges[weekday] ?? { from: "00:00", to: "23:59" }] })),
    },
    overtime: { allowOvertime: form.allowOvertime, ...(form.allowOvertime && form.maxOvertimePerDay !== "" ? { maxOvertimePerDay: Number(form.maxOvertimePerDay) } : {}) },
    staffGroupId: optional(form.staffGroupId),
    shifts: form.useCustomShift ? [{
      shiftName: form.shiftName.trim(), shiftStart: form.shiftStart, shiftEnd: form.shiftEnd,
      weekdays: [...form.allowedDays].sort((a, b) => a - b), graceMinutes: Number(form.graceMinutes || 0),
      earlyAccessMinutes: Number(form.earlyAccessMinutes || 0), isActive: true,
    }, ...form.retainedCustomShifts] : [],
    extraShifts: form.extraShifts,
  }), [form]);

  function validateEnrollment() {
    if (!selectedDeviceId) { setError(copy.selectEnrollmentDevice); return false; }
    if (!form.code.match(/^\d+$/u)) { setError(copy.enrollmentCodeRequired); return false; }
    if (!form.firstName.trim()) { setError(copy.enrollmentNameRequired); return false; }
    if (fingerId === null || fingerId < 0 || fingerId > 9) { setError(copy.selectFinger); return false; }
    return true;
  }

  async function suggestCode() {
    if (!selectedDeviceId) { setError(copy.selectEnrollmentDevice); return; }
    setSuggestingId(true); setError(null);
    try {
      const response = await suggestDeviceUserId(selectedDeviceId);
      set("code", response.data.userId);
    } catch (suggestError) {
      setError(suggestError instanceof Error ? suggestError.message : copy.suggestCodeFailed);
    } finally { setSuggestingId(false); }
  }

  async function requestEnrollment() {
    setError(null); setEnrollmentMessage(null);
    if (!validateEnrollment()) return;
    if (!persistedEmployeeId) {
      setEnrollmentQueued(true);
      setEnrollmentMessage(copy.enrollmentQueued);
      return;
    }
    setEnrolling(true);
    try {
      await enrollDevice(selectedDeviceId, {
        userId: form.code.trim(),
        name: [form.firstName, form.lastName].filter(Boolean).join(" ").trim(),
        fingerId: fingerId!,
      });
      setEnrollmentQueued(false);
      navigate(`/employees/${persistedEmployeeId}`);
    } catch (enrollError) {
      setError(enrollError instanceof Error ? enrollError.message : copy.enrollmentFailed);
    } finally { setEnrolling(false); }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!valid) { setError(copy.required); return; }
    setSubmitting(true); setError(null);
    try {
      const employeeId = persistedEmployeeId ?? (mode === "edit" ? id : null);
      const response = employeeId ? await updateEmployee(employeeId, payload) : await createEmployee(payload);
      setPersistedEmployeeId(response.data.id);
      if (enrollmentQueued) {
        setEnrolling(true);
        try {
          await enrollDevice(selectedDeviceId, {
            userId: form.code.trim(),
            name: [form.firstName, form.lastName].filter(Boolean).join(" ").trim(),
            fingerId: fingerId!,
          });
        } catch (enrollError) {
          setStep(1);
          setEnrollmentQueued(false);
          setEnrollmentMessage(null);
          setError(`${copy.employeeSavedEnrollmentFailed} ${enrollError instanceof Error ? enrollError.message : copy.enrollmentFailed}`);
          setSubmitting(false); setEnrolling(false);
          return;
        }
      }
      navigate(`/employees/${response.data.id}`);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : copy.saveFailed);
      setSubmitting(false);
    }
  }

  function advanceAddWizard() {
    setError(null);
    if (step === 1 && (!form.code.match(/^\d+$/u) || !form.firstName.trim())) {
      setError(copy.required);
      return;
    }
    if (step === 3 && !scheduleValid) {
      setError(copy.required);
      return;
    }
    if (step === 4 && form.allowedDays.length === 0) {
      setError(copy.required);
      return;
    }
    setStep((current) => Math.min(addSteps.length - 1, current + 1));
  }

  if (loading) {
    return (
      <section className="employee-form-page" data-testid="employee-form-loading">
        <PageHeader icon={<IconEdit className="h-5 w-5" stroke={1.8} />} title={copy.editEmployee} description={copy.employeeOnly} />
        <div className="employee-form-loading" role="status">{copy.loading}</div>
      </section>
    );
  }


  return (
      <form className="entry-logs-compact space-y-2.5" data-testid={`employee-form-${mode}`} dir={isRtl ? "rtl" : "ltr"} onSubmit={submit}>
        <div className="rounded-xl border border-[color:var(--card-border)] bg-[var(--bg-card)] p-2.5">
          <h2 className="text-[13px] font-semibold text-[var(--text-primary)]">{mode === "add" ? copy.addEmployee : copy.editEmployee}</h2>
          <p className="mt-1 text-[11px] text-[var(--text-secondary)]">{copy.employeeOnly}</p>
        </div>

        <div className="rounded-xl border border-[color:var(--card-border)] bg-[var(--bg-card)] p-2.5">
          <div className="member-wizard-compact space-y-2">
            <StepIndicator currentStep={step} steps={addSteps} />
            {error ? <ErrorState className="employees-inline-state" title={error} /> : null}

            {step === 0 ? (
              <div className="member-type-card">
                <h3 className="member-type-card__title">{copy.employees}</h3>
                <p className="member-type-card__description">{copy.employeeOnly}</p>
                <div className="member-type-card__options">
                  <label className="member-type-option member-type-option--active">
                    <input checked className="member-type-option__radio" name="employeeType" readOnly type="radio" />
                    {copy.employee}
                  </label>
                </div>
              </div>
            ) : null}

            {step === 1 ? (
              <>
              <FormSection icon={<IconUser />} title={copy.personal}>
                <Field label={copy.code} required><input inputMode="numeric" pattern="[0-9]+" value={form.code} onChange={(e) => set("code", e.target.value)} /></Field>
                <Field label={copy.firstName} required><input value={form.firstName} onChange={(e) => set("firstName", e.target.value)} /></Field>
                <Field label={copy.lastName}><input value={form.lastName} onChange={(e) => set("lastName", e.target.value)} /></Field>
                <Field label={copy.fatherName}><input value={form.fatherName} onChange={(e) => set("fatherName", e.target.value)} /></Field>
                <Field label={copy.phone}><input value={form.phone} onChange={(e) => set("phone", e.target.value)} /></Field>
                <Field label={copy.email}><input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} /></Field>
                <Field label={copy.gender}><DropdownSelect ariaLabel={copy.gender} buttonClassName="employee-form-control" value={form.gender} onChange={(value) => set("gender", value as EmployeeGender)} options={[{ value: "MALE", label: copy.male }, { value: "FEMALE", label: copy.female }, { value: "OTHER", label: copy.other }]} /></Field>
                <Field label={copy.birthDate}><input type="date" value={form.birthDate} onChange={(e) => set("birthDate", e.target.value)} /></Field>
                <Field label={copy.nationalId}><input value={form.nationalId} onChange={(e) => set("nationalId", e.target.value)} /></Field>
                <Field label={copy.status}><DropdownSelect ariaLabel={copy.status} buttonClassName="employee-form-control" value={form.status} onChange={(value) => set("status", value as EmployeeStatus)} options={[{ value: "ACTIVE", label: copy.active }, { value: "BLOCKED", label: copy.blocked }]} /></Field>
              </FormSection>
              {canEnrollDevices ? (
                <DeviceEnrollmentPanel
                  copy={copy}
                  devices={devices}
                  enrolling={enrolling}
                  fingerId={fingerId}
                  message={enrollmentMessage}
                  onEnroll={() => void requestEnrollment()}
                  onFingerIdChange={(value) => { setFingerId(value); setEnrollmentQueued(false); setEnrollmentMessage(null); }}
                  onSelectDevice={(value) => { setSelectedDeviceId(value); setEnrollmentQueued(false); setEnrollmentMessage(null); }}
                  onSuggest={() => void suggestCode()}
                  queued={enrollmentQueued}
                  selectedDeviceId={selectedDeviceId}
                  suggesting={suggestingId}
                />
              ) : null}
              </>
            ) : null}

            {step === 2 ? (
              <FormSection icon={<IconBriefcase />} title={copy.work}>
                <Field label={copy.role}><DropdownSelect ariaLabel={copy.role} buttonClassName="employee-form-control" value={form.roleType} onChange={(value) => set("roleType", value as EmployeeRole)} options={ROLES.map((role) => ({ value: role, label: role }))} /></Field>
                <Field label={copy.customTitle}><input value={form.customTitle} onChange={(e) => set("customTitle", e.target.value)} /></Field>
                <Field label={copy.position}><input value={form.position} onChange={(e) => set("position", e.target.value)} /></Field>
                <Field label={copy.department}><input value={form.department} onChange={(e) => set("department", e.target.value)} /></Field>
                <Field label={copy.systemRole}><input value={form.systemRole} onChange={(e) => set("systemRole", e.target.value)} /></Field>
              </FormSection>
            ) : null}

            {step === 3 ? (
              <FormSection icon={<IconBriefcase />} title={copy.group}>
                <Field label={copy.group}><DropdownSelect ariaLabel={copy.group} buttonClassName="employee-form-control" value={form.staffGroupId} onChange={(value) => set("staffGroupId", value)} options={[{ value: "", label: copy.selectGroup }, ...groups.map((group) => ({ value: group.id, label: group.name }))]} /></Field>
                <label className="employee-form-check employee-form-wide"><input checked={form.useCustomShift} onChange={(e) => set("useCustomShift", e.target.checked)} type="checkbox" /><span>{copy.customShift}</span></label>
                {form.useCustomShift ? <>
                  <Field label={copy.shiftName} required><input value={form.shiftName} onChange={(e) => set("shiftName", e.target.value)} /></Field>
                  <Field label={copy.shiftStart}><input type="time" value={form.shiftStart} onChange={(e) => set("shiftStart", e.target.value)} /></Field>
                  <Field label={copy.shiftEnd}><input type="time" value={form.shiftEnd} onChange={(e) => set("shiftEnd", e.target.value)} /></Field>
                  <Field label={copy.grace}><input min="0" type="number" value={form.graceMinutes} onChange={(e) => set("graceMinutes", e.target.value)} /></Field>
                  <Field label={copy.earlyAccess}><input max="120" min="0" type="number" value={form.earlyAccessMinutes} onChange={(e) => set("earlyAccessMinutes", e.target.value)} /></Field>
                </> : null}
              </FormSection>
            ) : null}

            {step === 4 ? (
              <FormSection icon={<IconCalendarTime />} title={copy.schedule}>
                <DayAccessFields copy={copy} form={form} set={set} />
              </FormSection>
            ) : null}

            {step === 5 ? (
              <FormSection icon={<IconCalendarTime />} title={copy.overtime}>
                <label className="employee-form-check"><input checked={form.allowOvertime} onChange={(e) => set("allowOvertime", e.target.checked)} type="checkbox" /><span>{copy.overtime}</span></label>
                {form.allowOvertime ? <Field label={copy.maxOvertime}><input min="0" type="number" value={form.maxOvertimePerDay} onChange={(e) => set("maxOvertimePerDay", e.target.value)} /></Field> : null}
                <Field label={copy.notes} wide><textarea rows={3} value={form.notes} onChange={(e) => set("notes", e.target.value)} /></Field>
              </FormSection>
            ) : null}

            {step === 6 ? <EmployeeReview copy={copy} form={form} groups={groups} /> : null}

            <div className="flex items-center gap-1.5">
              <button className={wizardButtonSecondaryClass} onClick={() => navigate(-1)} type="button">{copy.cancel}</button>
              {step > 0 ? <button className={wizardButtonSecondaryClass} onClick={() => { setError(null); setStep((current) => current - 1); }} type="button">{copy.previous}</button> : null}
              {step < addSteps.length - 1 ? (
                <button
                  className={wizardButtonPrimaryClass}
                  data-testid="employee-wizard-primary"
                  onClick={(event) => { event.preventDefault(); advanceAddWizard(); }}
                  type="button"
                >
                  {copy.next}
                </button>
              ) : (
                <button className={wizardButtonPrimaryClass} data-testid="employee-wizard-primary" disabled={submitting} type="submit">{submitting ? copy.loading : copy.save}</button>
              )}
            </div>
          </div>
        </div>
      </form>
    );
}

function DeviceEnrollmentPanel({ copy, devices, enrolling, fingerId, message, onEnroll, onFingerIdChange, onSelectDevice, onSuggest, queued, selectedDeviceId, suggesting }: {
  copy: ReturnType<typeof getEmployeeCopy>;
  devices: Device[];
  enrolling: boolean;
  fingerId: number | null;
  message: string | null;
  onEnroll: () => void;
  onFingerIdChange: (value: number | null) => void;
  onSelectDevice: (value: string) => void;
  onSuggest: () => void;
  queued: boolean;
  selectedDeviceId: string;
  suggesting: boolean;
}) {
  const { t } = useTranslation();
  return (
    <section className="employee-form-section mt-3" data-testid="employee-device-enrollment">
      <div className="employee-form-section__header"><span aria-hidden="true"><IconFingerprint /></span><h2>{t("members.wizard.device.title")}</h2></div>
      {devices.length ? (
        <div className="space-y-3">
          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
            <Field label={t("members.wizard.device.deviceLabel")}>
              <DropdownSelect ariaLabel={t("members.wizard.device.deviceLabel")} buttonClassName="employee-form-control" value={selectedDeviceId} onChange={onSelectDevice} options={devices.map((device) => ({ value: device.id, label: `${device.name} (${device.connectionType})` }))} />
            </Field>
            <div>
              <span className="employee-form-days__label">{t("members.wizard.device.fingerLabel")}</span>
              <FingerIdPicker value={fingerId} onChange={onFingerIdChange} disabled={enrolling} />
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button className={wizardButtonSecondaryClass} disabled={suggesting || enrolling} onClick={onSuggest} type="button">
              {suggesting ? t("members.wizard.device.suggesting") : t("members.wizard.device.suggestId")}
            </button>
            <button className={wizardButtonSuccessClass} disabled={queued || enrolling} onClick={onEnroll} type="button">
              {enrolling ? t("members.wizard.device.enrolling") : queued ? copy.enrollmentQueued : copy.enrollOnSave}
            </button>
          </div>
          {message ? <p className="text-[11px] text-emerald-300" role="status">{message}</p> : null}
        </div>
      ) : <p className="text-[10px] text-[var(--text-secondary)]">{t("members.wizard.device.noDevices")}</p>}
    </section>
  );
}

function FormSection({ title, icon, children }: { title: string; icon: ReactNode; children: ReactNode }) {
  return <section className="employee-form-section"><div className="employee-form-section__header"><span aria-hidden="true">{icon}</span><h2>{title}</h2></div><div className="employee-form-grid">{children}</div></section>;
}

function StepIndicator({ steps, currentStep }: { steps: string[]; currentStep: number }) {
  return <div className="step-indicator">{steps.map((label, index) => {
    const state = index === currentStep ? "active" : index < currentStep ? "done" : "idle";
    return <div className="step-indicator__item" data-state={state} key={`${index}-${label}`}>
      <span className="step-indicator__badge">{index + 1}</span><span className="step-indicator__label">{label}</span>
    </div>;
  })}</div>;
}

function DayAccessFields({ copy, form, set }: { copy: ReturnType<typeof getEmployeeCopy>; form: FormState; set: SetFormValue }) {
  return <div className="employee-form-wide"><span className="employee-form-days__label">{copy.allowedDays} *</span>
    <div className="employee-form-days">{ALL_DAYS.map((day) => {
      const selected = form.allowedDays.includes(day); const range = form.dayRanges[day] ?? defaultRanges[day];
      return <div className={`employee-form-day${selected ? " is-selected" : ""}`} key={day}>
        <label className="employee-form-check"><input checked={selected} onChange={() => set("allowedDays", selected ? form.allowedDays.filter((value) => value !== day) : [...form.allowedDays, day])} type="checkbox" /><span>{copy.days[day]}</span></label>
        {selected ? <div className="employee-form-day__times">
          <input aria-label={`${copy.from} ${copy.days[day]}`} className="employee-form-control" type="time" value={range?.from} onChange={(event) => set("dayRanges", { ...form.dayRanges, [day]: { from: event.target.value, to: range?.to ?? "23:59" } })} />
          <input aria-label={`${copy.to} ${copy.days[day]}`} className="employee-form-control" type="time" value={range?.to} onChange={(event) => set("dayRanges", { ...form.dayRanges, [day]: { from: range?.from ?? "00:00", to: event.target.value } })} />
        </div> : null}
      </div>;
    })}</div>
  </div>;
}

function EmployeeReview({ copy, form, groups }: { copy: ReturnType<typeof getEmployeeCopy>; form: FormState; groups: EmployeeStaffGroupOption[] }) {
  const group = groups.find((item) => item.id === form.staffGroupId);
  const fallback = "—";
  const name = [form.firstName, form.lastName].filter(Boolean).join(" ") || fallback;
  const schedule = group?.name ?? (form.useCustomShift ? form.shiftName : copy.noShifts);
  return <section className="employee-form-section">
    <div className="employee-form-section__header"><span aria-hidden="true"><IconUser /></span><h2>{copy.employeeDetails}</h2></div>
    <div className="employee-detail-panel__content">
      <ReviewItem label={copy.name} value={name} />
      <ReviewItem label={copy.code} value={form.code || fallback} />
      <ReviewItem label={copy.role} value={form.customTitle || form.roleType} />
      <ReviewItem label={copy.group} value={schedule || fallback} />
      <ReviewItem label={copy.allowedDays} value={form.allowedDays.map((day) => copy.days[day]).join(", ") || fallback} wide />
      <ReviewItem label={copy.overtime} value={form.allowOvertime ? copy.active : copy.blocked} />
      <ReviewItem label={copy.notes} value={form.notes || fallback} wide />
    </div>
  </section>;
}

function ReviewItem({ label, value, wide = false }: { label: string; value: string; wide?: boolean }) {
  return <dl className={`employee-detail-info${wide ? " employee-detail-info--wide" : ""}`}><dt>{label}</dt><dd>{value}</dd></dl>;
}

function Field({ label, required, wide, children }: { label: string; required?: boolean; wide?: boolean; children: ReactElement }) {
  return <label className={`employee-form-field${wide ? " employee-form-wide" : ""}`}><span>{label}{required ? " *" : ""}</span>
    <span className="employee-form-field__control">{children}</span></label>;
}

function optional(value: string): string | undefined { const normalized = value.trim(); return normalized || undefined; }

function fromEmployee(employee: EmployeeDetail): FormState {
  const customShifts = employee.shifts.filter((shift) => !shift.isFromGroup && !shift.shiftId);
  const customShift = customShifts[0];
  const dayRanges: DayRanges = { ...defaultRanges };
  employee.access?.allowedTimeRanges.forEach((entry) => {
    const first = entry.ranges[0]; if (first) dayRanges[entry.weekday] = { from: first.from, to: first.to };
  });
  return {
    ...initialState, code: employee.code, firstName: employee.firstName, lastName: employee.lastName ?? "", fatherName: employee.fatherName ?? "",
    phone: employee.phone ?? "", email: employee.email ?? "", gender: employee.gender ?? "MALE", birthDate: employee.birthDate?.slice(0, 10) ?? "",
    nationalId: employee.nationalId ?? "", status: employee.status, roleType: employee.roleType ?? "EMPLOYEE", customTitle: employee.customTitle ?? "",
    position: employee.profile?.position ?? "", department: employee.profile?.department ?? "", systemRole: employee.profile?.systemRole ?? "",
    notes: employee.notes ?? "", staffGroupId: employee.staffGroupId ?? "", allowedDays: employee.access?.allowedDays.length ? employee.access.allowedDays : [...ALL_DAYS],
    dayRanges, allowOvertime: employee.overtime?.allowOvertime ?? false, maxOvertimePerDay: employee.overtime?.maxOvertimePerDay?.toString() ?? "",
    useCustomShift: Boolean(customShift), shiftName: customShift?.shiftName ?? "", shiftStart: customShift?.shiftStart ?? "08:00",
    shiftEnd: customShift?.shiftEnd ?? "16:00", graceMinutes: customShift?.graceMinutes.toString() ?? "0", earlyAccessMinutes: customShift?.earlyAccessMinutes.toString() ?? "15",
    retainedCustomShifts: customShifts.slice(1).map(({ shiftName, shiftStart, shiftEnd, weekdays, graceMinutes, earlyAccessMinutes, isActive }) =>
      ({ shiftName, shiftStart, shiftEnd, weekdays, graceMinutes, earlyAccessMinutes, isActive })),
    extraShifts: employee.shifts.filter((shift) => !shift.isFromGroup && shift.shiftId).map((shift) => ({ shiftId: shift.shiftId!, isActive: shift.isActive })),
  };
}
