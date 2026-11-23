import {
  IconArchive,
  IconArrowLeft,
  IconBriefcase,
  IconCalendarTime,
  IconClock,
  IconEdit,
  IconRestore,
  IconShieldLock,
  IconUser,
} from "@tabler/icons-react";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams } from "react-router-dom";
import { getEmployee, listEmployeeAttendance, setEmployeeArchived, type EmployeeAttendance, type EmployeeDetail as Employee } from "../../api/employees";
import { useAuth } from "../../auth/AuthContext";
import { Button } from "../../components/ui/Button";
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
import { ErrorState } from "../../components/ui/StatePanel";
import { StatusBadge } from "../../components/ui/StatusBadge";
import { getEmployeeCopy, type EmployeeCopy } from "./employeeCopy";

type DetailTab = "overview" | "attendance" | "schedule" | "access";

export function EmployeeDetail() {
  const { id } = useParams<{ id: string }>();
  const { i18n } = useTranslation();
  const copy = getEmployeeCopy(i18n.language);
  const navigate = useNavigate();
  const { hasPermission } = useAuth();
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [attendance, setAttendance] = useState<EmployeeAttendance[]>([]);
  const [tab, setTab] = useState<DetailTab>("overview");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isRtl = ["fa", "ps", "ar"].includes(i18n.language.split("-")[0]);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true); setError(null);
    try {
      const [employeeResponse, attendanceResponse] = await Promise.all([getEmployee(id), listEmployeeAttendance(id)]);
      setEmployee(employeeResponse.data); setAttendance(attendanceResponse.data);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : copy.loadFailed);
    } finally { setLoading(false); }
  }, [copy.loadFailed, id]);

  useEffect(() => { void load(); }, [load]);

  async function toggleArchived() {
    if (!employee) return;
    setBusy(true); setError(null);
    try { const response = await setEmployeeArchived(employee.id, employee.active); setEmployee(response.data); }
    catch (archiveError) { setError(archiveError instanceof Error ? archiveError.message : copy.saveFailed); }
    finally { setBusy(false); }
  }

  if (loading) {
    return (
      <div className="member-detail-page space-y-3 rounded-2xl border border-slate-800/80 bg-slate-950/70 p-4" data-testid="employee-detail-loading" dir={isRtl ? "rtl" : "ltr"}>
        <div className="h-6 w-48 animate-pulse rounded-full bg-slate-800" />
        <div className="h-32 w-full animate-pulse rounded-2xl bg-slate-900/80" />
      </div>
    );
  }

  if (!employee) {
    return (
      <div className="member-detail-page" data-testid="employee-detail-error" dir={isRtl ? "rtl" : "ltr"}>
        <ErrorState
          title={copy.loadFailed}
          description={error === copy.loadFailed ? undefined : error ?? undefined}
          action={<Button onClick={() => navigate("/employees")} startIcon={<IconArrowLeft className="h-4 w-4" stroke={1.8} />}>{copy.cancel}</Button>}
        />
      </div>
    );
  }

  const archived = !employee.active;
  return (
    <div className="member-detail-page entry-logs-compact space-y-4" data-testid="employee-detail" dir={isRtl ? "rtl" : "ltr"}>
      <EmployeeHeader
        archived={archived}
        attendanceCount={attendance.length}
        busy={busy}
        copy={copy}
        employee={employee}
        onArchive={hasPermission("MEMBERS_WRITE") ? () => void toggleArchived() : undefined}
        onEdit={hasPermission("MEMBERS_WRITE") ? () => navigate(`/employees/${employee.id}/edit`) : undefined}
      />

      {error ? <ErrorState className="employees-inline-state" title={copy.saveFailed} description={error === copy.saveFailed ? undefined : error} /> : null}

      <div className="rounded-2xl border border-slate-800/80 bg-slate-950/70">
        <div className="flex flex-wrap gap-2 border-b border-slate-800/70 px-3 py-2 text-[11px] text-slate-300" role="tablist" aria-label={copy.employeeDetails}>
          <TabButton label={copy.overview} active={tab === "overview"} onClick={() => setTab("overview")} />
          <TabButton label={copy.attendance} active={tab === "attendance"} onClick={() => setTab("attendance")} />
          <TabButton label={copy.schedule} active={tab === "schedule"} onClick={() => setTab("schedule")} />
          <TabButton label={copy.access} active={tab === "access"} onClick={() => setTab("access")} />
        </div>
        <div className="p-4">
          {tab === "overview" ? <OverviewTab copy={copy} employee={employee} /> : null}
          {tab === "attendance" ? <AttendanceTab attendance={attendance} copy={copy} language={i18n.language} /> : null}
          {tab === "schedule" ? <ScheduleTab copy={copy} employee={employee} /> : null}
          {tab === "access" ? <AccessTab copy={copy} employee={employee} /> : null}
        </div>
      </div>
    </div>
  );
}

function EmployeeHeader({ archived, attendanceCount, busy, copy, employee, onArchive, onEdit }: {
  archived: boolean;
  attendanceCount: number;
  busy: boolean;
  copy: EmployeeCopy;
  employee: Employee;
  onArchive?: () => void;
  onEdit?: () => void;
}) {
  const fullName = [employee.firstName, employee.lastName].filter(Boolean).join(" ");
  const stats = useMemo(() => [
    { label: copy.assignedShifts, value: employee.shifts.length },
    { label: copy.allowedDays, value: employee.access?.allowedDays.length ?? 0 },
    { label: copy.recentEvents, value: attendanceCount },
  ], [attendanceCount, copy.allowedDays, copy.assignedShifts, copy.recentEvents, employee.access?.allowedDays.length, employee.shifts.length]);

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-slate-800/80 bg-slate-950/70 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="member-avatar flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-900 text-base font-semibold text-white">
          {employee.photoUrl ? <img src={employee.photoUrl} alt="" className="h-full w-full rounded-2xl object-cover" /> : employee.firstName.at(0)}
        </div>
        <div>
          <h2 className="text-sm font-semibold text-white">{fullName} • {employee.code}</h2>
          <p className="text-[11px] text-slate-400">{employee.phone ?? "—"}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <StatusBadge tone={archived ? "neutral" : employee.status === "ACTIVE" ? "success" : "danger"}>{archived ? copy.archived : employee.status === "ACTIVE" ? copy.active : copy.blocked}</StatusBadge>
            <span className="member-chip rounded-full border border-slate-700 px-2 py-0.5 text-[10px] text-slate-200">{copy.employee}</span>
            {employee.roleType ? <span className="member-chip rounded-full border border-slate-700 px-2 py-0.5 text-[10px] text-slate-200">{employee.roleType}</span> : null}
            {employee.staffGroup?.name ? <span className="member-chip rounded-full border border-slate-700 px-2 py-0.5 text-[10px] text-slate-200">{employee.staffGroup.name}</span> : null}
          </div>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        {stats.map((stat) => (
          <div key={stat.label} className="member-stat rounded-xl border border-slate-800 bg-slate-900/60 px-3 py-2 text-[11px] text-slate-200">
            <p className="text-[10px] text-slate-400">{stat.label}</p>
            <p className="text-sm font-semibold text-white">{stat.value}</p>
          </div>
        ))}
        {onEdit ? (
          <button type="button" onClick={onEdit} title={copy.edit} aria-label={copy.edit} className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-slate-700 bg-slate-900/50 text-slate-100 transition-colors hover:border-brand-400 hover:text-white">
            <IconEdit className="h-4 w-4" stroke={1.7} />
          </button>
        ) : null}
        {onArchive ? (
          <button
            type="button"
            onClick={onArchive}
            disabled={busy}
            title={archived ? copy.restore : copy.archive}
            aria-label={archived ? copy.restore : copy.archive}
            className="member-delete-btn inline-flex h-8 w-8 items-center justify-center rounded-xl border border-rose-500/40 bg-rose-500/10 text-rose-100 transition-colors hover:border-rose-400 hover:bg-rose-500/20 disabled:cursor-wait disabled:opacity-60"
          >
            {archived ? <IconRestore className="h-4 w-4" stroke={1.7} /> : <IconArchive className="h-4 w-4" stroke={1.7} />}
          </button>
        ) : null}
      </div>
    </div>
  );
}

function TabButton({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`rounded-full px-3 py-1.5 text-[11px] font-medium transition ${active ? "bg-brand-500 text-white" : "text-slate-300 hover:bg-slate-900/80 hover:text-white"}`}
    >
      {label}
    </button>
  );
}

function OverviewTab({ copy, employee }: { copy: EmployeeCopy; employee: Employee }) {
  const archived = !employee.active;
  const gender = employee.gender === "MALE" ? copy.male : employee.gender === "FEMALE" ? copy.female : employee.gender === "OTHER" ? copy.other : "—";
  return (
    <div className="space-y-3" data-testid="employee-overview">
      <div className="grid gap-3 xl:grid-cols-2">
        <OverviewPanel icon={<IconUser className="h-5 w-5" stroke={1.8} />} title={copy.personal} tone="brand">
          <OverviewInfoRow label={copy.status} value={<StatusBadge tone={archived ? "neutral" : employee.status === "ACTIVE" ? "success" : "danger"}>{archived ? copy.archived : employee.status === "ACTIVE" ? copy.active : copy.blocked}</StatusBadge>} />
          <OverviewInfoRow label={copy.phone} value={employee.phone ?? "—"} />
          <OverviewInfoRow label={copy.email} value={employee.email ?? "—"} />
          <OverviewInfoRow label={copy.fatherName} value={employee.fatherName ?? "—"} />
          <OverviewInfoRow label={copy.gender} value={gender} />
          <OverviewInfoRow label={copy.nationalId} value={employee.nationalId ?? "—"} />
          <OverviewInfoRow label={copy.notes} value={employee.notes ?? "—"} />
        </OverviewPanel>
        <OverviewPanel icon={<IconBriefcase className="h-5 w-5" stroke={1.8} />} title={copy.work} tone="violet">
          <OverviewInfoRow label={copy.group} value={employee.staffGroup?.name ? <OverviewPill tone="brand">{employee.staffGroup.name}</OverviewPill> : "—"} />
          <OverviewInfoRow label={copy.role} value={employee.roleType ? <OverviewPill tone="violet">{employee.roleType}</OverviewPill> : "—"} />
          <OverviewInfoRow label={copy.customTitle} value={employee.customTitle ?? "—"} />
          <OverviewInfoRow label={copy.position} value={employee.profile?.position ?? "—"} />
          <OverviewInfoRow label={copy.department} value={employee.profile?.department ?? "—"} />
          <OverviewInfoRow label={copy.systemRole} value={employee.profile?.systemRole ?? "—"} />
          <OverviewInfoRow label={copy.overtime} value={employee.overtime?.allowOvertime ? `${copy.active}${employee.overtime.maxOvertimePerDay ? ` — ${employee.overtime.maxOvertimePerDay} min` : ""}` : copy.blocked} />
        </OverviewPanel>
      </div>
    </div>
  );
}

function AttendanceTab({ attendance, copy, language }: { attendance: EmployeeAttendance[]; copy: EmployeeCopy; language: string }) {
  return (
    <section data-testid="employee-attendance">
      <SectionHeading icon={<IconClock />} title={copy.attendance} />
      <DataTableShell className="employee-detail-table-shell">
        <DataTable minWidth="38rem" variant="compact">
          <DataTableHead><DataTableRow>
            <DataTableHeaderCell>{copy.event}</DataTableHeaderCell>
            <DataTableHeaderCell>{copy.eventTime}</DataTableHeaderCell>
            <DataTableHeaderCell>{copy.source}</DataTableHeaderCell>
            <DataTableHeaderCell>{copy.result}</DataTableHeaderCell>
          </DataTableRow></DataTableHead>
          <DataTableBody>
            {attendance.length === 0 ? <DataTableEmptyRow colSpan={4}>{copy.noAttendance}</DataTableEmptyRow> : attendance.map((event) => (
              <DataTableRow key={event.id}>
                <DataTableCell><StatusBadge tone={event.entryType === "IN" ? "success" : "info"}>{event.entryType === "IN" ? copy.in : copy.out}</StatusBadge></DataTableCell>
                <DataTableCell>{new Intl.DateTimeFormat(language, { dateStyle: "medium", timeStyle: "short" }).format(new Date(event.recordedAt))}</DataTableCell>
                <DataTableCell>{event.source}</DataTableCell>
                <DataTableCell><StatusBadge tone={event.isAuthorized ? "success" : "danger"}>{event.isAuthorized ? copy.authorized : copy.denied}</StatusBadge></DataTableCell>
              </DataTableRow>
            ))}
          </DataTableBody>
        </DataTable>
      </DataTableShell>
    </section>
  );
}

function ScheduleTab({ copy, employee }: { copy: EmployeeCopy; employee: Employee }) {
  return (
    <section data-testid="employee-schedule">
      <SectionHeading icon={<IconCalendarTime />} title={copy.schedule} />
      <DataTableShell className="employee-detail-table-shell">
        <DataTable minWidth="45rem" variant="compact">
          <DataTableHead><DataTableRow>
            <DataTableHeaderCell>{copy.shiftName}</DataTableHeaderCell>
            <DataTableHeaderCell>{copy.shiftStart}</DataTableHeaderCell>
            <DataTableHeaderCell>{copy.shiftEnd}</DataTableHeaderCell>
            <DataTableHeaderCell>{copy.grace}</DataTableHeaderCell>
            <DataTableHeaderCell>{copy.earlyAccess}</DataTableHeaderCell>
            <DataTableHeaderCell>{copy.allowedDays}</DataTableHeaderCell>
          </DataTableRow></DataTableHead>
          <DataTableBody>
            {employee.shifts.length === 0 ? <DataTableEmptyRow colSpan={6}>{copy.noShifts}</DataTableEmptyRow> : employee.shifts.map((shift) => (
              <DataTableRow key={shift.id}>
                <DataTableCell><span className="employee-name">{shift.shiftName}</span></DataTableCell>
                <DataTableCell>{shift.shiftStart}</DataTableCell>
                <DataTableCell>{shift.shiftEnd}</DataTableCell>
                <DataTableCell>{shift.graceMinutes}</DataTableCell>
                <DataTableCell>{shift.earlyAccessMinutes}</DataTableCell>
                <DataTableCell>{shift.weekdays.map((day) => copy.days[day]).join(", ")}</DataTableCell>
              </DataTableRow>
            ))}
          </DataTableBody>
        </DataTable>
      </DataTableShell>
    </section>
  );
}

function AccessTab({ copy, employee }: { copy: EmployeeCopy; employee: Employee }) {
  const access = employee.access;
  return (
    <div className="grid gap-3 xl:grid-cols-2" data-testid="employee-access">
      <OverviewPanel icon={<IconShieldLock className="h-5 w-5" stroke={1.8} />} title={copy.allowedDays} tone="emerald">
        <div className="flex flex-wrap gap-2 py-3">
          {access?.allowedDays.length ? access.allowedDays.map((day) => <OverviewPill key={day} tone="emerald">{copy.days[day]}</OverviewPill>) : <span className="text-[11px] text-slate-400">—</span>}
        </div>
        <OverviewInfoRow label={copy.maxEntries} value={access?.maxEntriesPerDay ?? copy.unlimited} />
      </OverviewPanel>
      <OverviewPanel icon={<IconClock className="h-5 w-5" stroke={1.8} />} title={copy.accessTime} tone="amber">
        {access?.allowedTimeRanges.length ? access.allowedTimeRanges.map((item) => (
          <OverviewInfoRow
            key={item.weekday}
            label={copy.days[item.weekday]}
            value={item.ranges.length ? item.ranges.map((range) => `${range.from}–${range.to}`).join(", ") : copy.unlimited}
          />
        )) : <p className="py-3 text-[11px] text-slate-400">{copy.noAccessRanges}</p>}
      </OverviewPanel>
    </div>
  );
}

type OverviewTone = "brand" | "violet" | "emerald" | "amber";

const toneStyles: Record<OverviewTone, { icon: string; pill: string }> = {
  brand: { icon: "border-brand-200 bg-brand-50 text-brand-600 dark:border-brand-500/30 dark:bg-brand-500/10 dark:text-brand-200", pill: "border-brand-200 bg-brand-50 text-brand-700 dark:border-brand-500/30 dark:bg-brand-500/10 dark:text-brand-100" },
  violet: { icon: "border-violet-200 bg-violet-50 text-violet-600 dark:border-violet-500/30 dark:bg-violet-500/10 dark:text-violet-200", pill: "border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-500/30 dark:bg-violet-500/10 dark:text-violet-100" },
  emerald: { icon: "border-emerald-200 bg-emerald-50 text-emerald-600 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200", pill: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-100" },
  amber: { icon: "border-amber-200 bg-amber-50 text-amber-600 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200", pill: "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100" },
};

function OverviewPanel({ children, icon, title, tone }: { children: ReactNode; icon: ReactNode; title: string; tone: OverviewTone }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white/80 p-3 shadow-sm dark:border-slate-800/80 dark:bg-slate-900/50 sm:p-4">
      <div className="mb-4 flex items-center gap-3">
        <span className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${toneStyles[tone].icon}`}>{icon}</span>
        <h3 className="text-sm font-semibold text-slate-950 dark:text-white">{title}</h3>
      </div>
      <div className="divide-y divide-slate-200/80 dark:divide-slate-800/80">{children}</div>
    </section>
  );
}

function OverviewInfoRow({ label, value }: { label: string; value: ReactNode }) {
  return <div className="grid gap-1 py-2.5 text-[11px] sm:grid-cols-[minmax(8rem,0.7fr)_minmax(0,1.3fr)] sm:items-center"><span className="text-slate-500 dark:text-slate-400">{label}</span><span className="min-w-0 break-words font-medium text-slate-900 dark:text-slate-100">{value}</span></div>;
}

function OverviewPill({ children, tone }: { children: ReactNode; tone: OverviewTone }) {
  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-semibold ${toneStyles[tone].pill}`}>{children}</span>;
}

function SectionHeading({ icon, title }: { icon: ReactNode; title: string }) {
  return <div className="mb-4 flex items-center gap-3"><span className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-brand-200 bg-brand-50 text-brand-600 dark:border-brand-500/30 dark:bg-brand-500/10 dark:text-brand-200">{icon}</span><h3 className="text-sm font-semibold text-slate-950 dark:text-white">{title}</h3></div>;
}
