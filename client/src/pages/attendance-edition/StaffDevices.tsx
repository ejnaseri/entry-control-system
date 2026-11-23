import {
  IconAlertTriangle,
  IconDeviceDesktop,
  IconPlus,
  IconRefresh,
  IconSettings,
  IconTool,
} from "@tabler/icons-react";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import {
  createStaffDevice,
  deleteStaffDeviceUser,
  disableStaffDevice,
  enableStaffDevice,
  enrollStaffDeviceEmployee,
  getStaffDeviceStatuses,
  getStaffDeviceTime,
  listStaffDeviceEvents,
  listStaffDevices,
  listStaffDeviceUsers,
  setStaffDeviceTime,
  syncStaffDeviceUsers,
  testStaffDevice,
  updateStaffDevice,
  upsertStaffDeviceUser,
  type StaffDevice,
  type StaffDeviceEvent,
  type StaffDevicePayload,
  type StaffDeviceRuntime,
  type StaffDeviceStatus,
  type StaffDeviceUser,
} from "../../api/deviceEdition";
import { listEmployees, type EmployeeSummary } from "../../api/employees";
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
import { Modal } from "../../components/ui/Modal";
import { DropdownSelect } from "../../components/ui/DropdownSelect";
import { EmptyState, ErrorState } from "../../components/ui/StatePanel";
import { StatusBadge } from "../../components/ui/StatusBadge";
import { getDeviceCopy, type DeviceCopy } from "./deviceCopy";

type DeviceForm = {
  name: string;
  ip: string;
  port: string;
  timeoutMs: string;
  pollIntervalMs: string;
  model: string;
  serialNumber: string;
  enabled: boolean;
};

const blankForm: DeviceForm = {
  name: "K40",
  ip: "192.168.1.200",
  port: "4370",
  timeoutMs: "3000",
  pollIntervalMs: "1000",
  model: "K40",
  serialNumber: "",
  enabled: true,
};

export function StaffDevices() {
  const { i18n } = useTranslation();
  const copy = getDeviceCopy(i18n.language);
  const { hasPermission } = useAuth();
  const canManage = hasPermission("SYSTEM_SETTINGS_MANAGE");
  const canSync = hasPermission("DEVICES_USER_SYNC");
  const canEnroll = hasPermission("DEVICES_ENROLL");
  const [devices, setDevices] = useState<StaffDevice[]>([]);
  const [runtime, setRuntime] = useState<Record<string, StaffDeviceRuntime>>({});
  const [events, setEvents] = useState<StaffDeviceEvent[]>([]);
  const [employees, setEmployees] = useState<EmployeeSummary[]>([]);
  const [searchDraft, setSearchDraft] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<StaffDeviceStatus | "">("");
  const [enabled, setEnabled] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [editing, setEditing] = useState<StaffDevice | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<DeviceForm>(blankForm);
  const [saving, setSaving] = useState(false);
  const [toolsDevice, setToolsDevice] = useState<StaffDevice | null>(null);
  const [users, setUsers] = useState<StaffDeviceUser[]>([]);
  const [employeeId, setEmployeeId] = useState("");
  const [fingerId, setFingerId] = useState("0");
  const [deviceTime, setDeviceTime] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [list, statuses, recent] = await Promise.all([
        listStaffDevices({
          ...(search ? { search } : {}),
          ...(status ? { status } : {}),
          ...(enabled ? { enabled: enabled === "true" } : {}),
        }),
        getStaffDeviceStatuses(),
        listStaffDeviceEvents(10),
      ]);
      setDevices(list.data);
      setRuntime(Object.fromEntries(statuses.data.devices.map((item) => [item.id, item])));
      setEvents(recent.data.items);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : copy.loadFailed);
    } finally {
      setLoading(false);
    }
  }, [copy.loadFailed, enabled, search, status]);

  useEffect(() => {
    void listEmployees({ status: "ACTIVE", take: 100, skip: 0 })
      .then((response) => setEmployees(response.data.items))
      .catch(() => setEmployees([]));
  }, []);
  useEffect(() => { void load(); }, [load]);

  const selectedEmployee = useMemo(
    () => employees.find((item) => item.id === employeeId) ?? null,
    [employeeId, employees],
  );
  const openCreate = () => {
    setEditing(null);
    setForm(blankForm);
    setFormOpen(true);
  };

  const openEdit = (device: StaffDevice) => {
    setEditing(device);
    setForm({
      name: device.name,
      ip: device.config.ip ?? "",
      port: String(device.config.port ?? 4370),
      timeoutMs: String(device.config.timeoutMs ?? 3000),
      pollIntervalMs: String(device.config.pollIntervalMs ?? 1000),
      model: device.model ?? "",
      serialNumber: device.serialNumber ?? "",
      enabled: device.enabled,
    });
    setFormOpen(true);
  };

  const payload = (): StaffDevicePayload => ({
    name: form.name.trim(),
    type: "FINGERPRINT",
    connectionType: "NETWORK",
    enabled: form.enabled,
    ...(form.model.trim() ? { model: form.model.trim() } : {}),
    ...(form.serialNumber.trim() ? { serialNumber: form.serialNumber.trim() } : {}),
    config: {
      ip: form.ip.trim(),
      port: Number(form.port),
      timeoutMs: Number(form.timeoutMs),
      pollIntervalMs: Number(form.pollIntervalMs),
      eventMode: "PULL",
      pushEnabled: false,
    },
  });

  const save = async () => {
    const value = payload();
    if (value.name.length < 2 || !value.config.ip || !Number.isInteger(value.config.port)) {
      setError(copy.required);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      if (editing) await updateStaffDevice(editing.id, value);
      else await createStaffDevice(value);
      setFormOpen(false);
      await load();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : copy.saveFailed);
    } finally {
      setSaving(false);
    }
  };

  const run = async (operation: () => Promise<unknown>, reload = true) => {
    setError(null);
    setNotice(null);
    try {
      await operation();
      setNotice(copy.success);
      if (reload) await load();
    } catch (operationError) {
      setError(operationError instanceof Error ? operationError.message : copy.saveFailed);
    }
  };

  const openTools = async (device: StaffDevice) => {
    setToolsDevice(device);
    setUsers([]);
    setEmployeeId("");
    setDeviceTime("");
    if (canSync) {
      await run(async () => {
        const response = await listStaffDeviceUsers(device.id);
        setUsers(response.data.items);
      }, false);
    }
  };

  const employeeCommand = async (kind: "upsert" | "delete" | "enroll") => {
    if (!toolsDevice || !selectedEmployee) {
      setError(copy.required);
      return;
    }
    const userId = selectedEmployee.code;
    const name = `${selectedEmployee.firstName} ${selectedEmployee.lastName ?? ""}`.trim().slice(0, 24);
    if (kind === "delete" && !window.confirm(copy.confirmDelete)) return;
    await run(
      () => kind === "upsert"
        ? upsertStaffDeviceUser(toolsDevice.id, { userId, name })
        : kind === "delete"
          ? deleteStaffDeviceUser(toolsDevice.id, userId)
          : enrollStaffDeviceEmployee(toolsDevice.id, { userId, name, fingerId: Number(fingerId) }),
      false,
    );
    if (canSync) {
      const response = await listStaffDeviceUsers(toolsDevice.id);
      setUsers(response.data.items);
    }
  };

  const closeForm = () => { if (!saving) setFormOpen(false); };

  return (
    <section className="devices-compact space-y-4" data-testid="staff-devices">
      <div className="rounded-2xl border border-slate-800/80 bg-slate-950/70 p-3 shadow-inner shadow-slate-950/60">
        <div className="flex flex-col gap-2.5 md:flex-row md:items-center md:justify-between">
          <div><h2 className="text-sm font-semibold text-white">{copy.devices}</h2><p className="text-[11px] text-slate-400">{copy.subtitle}</p></div>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => void load()} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 px-2.5 py-1 text-[11px] font-semibold text-slate-200 transition hover:border-brand-400 hover:text-white"><IconRefresh className="h-3.5 w-3.5" stroke={1.8} />{copy.refresh}</button>
            {canManage ? <button type="button" onClick={openCreate} className="inline-flex items-center gap-1 rounded-lg border border-brand-500/40 bg-brand-500/80 px-2.5 py-1 text-[11px] font-semibold text-white shadow-lg shadow-brand-900/40 transition hover:bg-brand-500"><IconPlus className="h-3.5 w-3.5" />{copy.add}</button> : null}
          </div>
        </div>
      </div>

      <form onSubmit={(event) => { event.preventDefault(); setSearch(searchDraft.trim()); }} className="rounded-2xl border border-slate-800/80 bg-slate-950/70 p-3 shadow-inner shadow-slate-950/60">
        <div className="grid gap-2 md:grid-cols-4">
          <label className="md:col-span-2"><span className="text-xs font-semibold text-slate-300">{copy.search}</span><input type="search" aria-label={copy.search} className="form-input" onChange={(event) => setSearchDraft(event.target.value)} placeholder={copy.search} value={searchDraft} /></label>
          <label><span className="text-xs font-semibold text-slate-300">{copy.status}</span><DropdownSelect ariaLabel={copy.status} buttonClassName="form-input" onChange={(value) => setStatus(value as StaffDeviceStatus | "")} value={status} options={[{ value: "", label: copy.all }, { value: "ONLINE", label: copy.online }, { value: "OFFLINE", label: copy.offline }, { value: "ERROR", label: copy.error }, { value: "UNKNOWN", label: copy.unknown }]} /></label>
          <label><span className="text-xs font-semibold text-slate-300">{copy.enabled}</span><DropdownSelect ariaLabel={copy.enabled} buttonClassName="form-input" onChange={setEnabled} value={enabled} options={[{ value: "", label: copy.all }, { value: "true", label: copy.enabled }, { value: "false", label: copy.disabled }]} /></label>
          <div className="flex items-end gap-2 md:col-span-4">
            <button type="submit" className="rounded-lg border border-slate-700 px-2.5 py-1 text-[11px] text-slate-100 hover:border-brand-400">{copy.search}</button>
            <button type="button" onClick={() => { setSearchDraft(""); setSearch(""); setStatus(""); setEnabled(""); }} className="rounded-lg border border-slate-700 px-2.5 py-1 text-[11px] text-slate-300 hover:border-slate-500">{copy.all}</button>
          </div>
        </div>
      </form>

      {error ? (
        <ErrorState
          action={<Button onClick={() => void load()} size="sm" variant="secondary">{copy.retry}</Button>}
          data-testid="staff-devices-error"
          icon={<IconAlertTriangle className="h-5 w-5" stroke={1.8} />}
          title={error}
        />
      ) : null}
      {notice ? <div className="staff-devices-notice" role="status">{notice}</div> : null}

      {loading ? (
        <DeviceRowsSkeleton />
      ) : devices.length === 0 && !error ? (
        <EmptyState
          data-testid="staff-devices-empty"
          icon={<IconDeviceDesktop className="h-5 w-5" stroke={1.8} />}
          title={copy.noDevices}
        />
      ) : devices.length > 0 ? (
        <div className="space-y-3">
          {devices.map((device) => {
            const state = runtime[device.id];
            const displayStatus: StaffDeviceStatus = state ? (state.connected ? "ONLINE" : "OFFLINE") : device.status;
            return (
              <article className="rounded-2xl border border-slate-800/80 bg-slate-950/70 p-3 shadow-inner shadow-slate-950/50" data-testid="device-card" key={device.id}>
                <div className="flex flex-col gap-2.5 md:flex-row md:items-center md:justify-between">
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-2"><p className="text-sm font-semibold text-white">{device.name}</p><span className="rounded-full border border-slate-700 px-2 py-0.5 text-[9px] uppercase text-slate-200">{device.model || "K40"}</span><DeviceStatusPill status={displayStatus} label={statusLabel(displayStatus, copy)} /></div>
                    <p className="text-[11px] text-slate-300">{copy.pullOnly} - {device.config.ip}:{device.config.port}</p>
                    <p className="text-[10px] text-slate-400">{copy.lastPoll}: {formatDate(state?.lastPollAt ?? device.lastSuccessfulPollAt, i18n.language)} · {copy.lastEvent}: {formatDate(state?.lastEventAt ?? device.lastEventReceivedAt, i18n.language)}</p>
                    {(state?.lastError || device.lastErrorMessage) ? <p className="text-[10px] text-rose-300">{copy.lastError}: {state?.lastError || device.lastErrorMessage}</p> : null}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {canManage ? <label className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-900/60 px-2 py-1 text-[10px] text-slate-200"><input type="checkbox" checked={device.enabled} onChange={() => void run(() => device.enabled ? disableStaffDevice(device.id) : enableStaffDevice(device.id))} className="h-3 w-3 accent-brand-500" />{copy.enabled}</label> : null}
                    <CompactDeviceButton onClick={() => void run(() => testStaffDevice(device.id))}>{copy.test}</CompactDeviceButton>
                    {canManage ? <CompactDeviceButton onClick={() => openEdit(device)}>{copy.edit}</CompactDeviceButton> : null}
                    {(canSync || canEnroll || canManage) ? <CompactDeviceButton onClick={() => void openTools(device)} icon={<IconTool />}>{copy.tools}</CompactDeviceButton> : null}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      ) : null}

      <section className="staff-device-events">
        <div className="staff-device-events__header">
          <span className="staff-device-events__icon" aria-hidden="true"><IconSettings stroke={1.8} /></span>
          <h2>{copy.recentEvents}</h2>
        </div>
        <DataTableShell className="staff-device-events__table" data-testid="staff-devices-events-table">
          <DataTable minWidth="38rem" variant="compact">
            <DataTableHead>
              <DataTableRow>
                {[copy.employee, copy.code, copy.event, copy.result].map((label) => <DataTableHeaderCell key={label}>{label}</DataTableHeaderCell>)}
              </DataTableRow>
            </DataTableHead>
            <DataTableBody>
              {events.length === 0 ? (
                <DataTableEmptyRow colSpan={4}>{copy.noEvents}</DataTableEmptyRow>
              ) : events.map((item, index) => {
                const accepted = Boolean(item.attendanceRecorded || item.authorized);
                return (
                  <DataTableRow key={item.id ?? index}>
                    <DataTableCell className="staff-device-event__employee">{item.memberName || "—"}</DataTableCell>
                    <DataTableCell className="staff-device-event__code">{item.memberCode || "—"}</DataTableCell>
                    <DataTableCell>{item.entryType || "—"}</DataTableCell>
                    <DataTableCell><StatusBadge tone={accepted ? "success" : "danger"}>{accepted ? copy.accepted : copy.denied}</StatusBadge></DataTableCell>
                  </DataTableRow>
                );
              })}
            </DataTableBody>
          </DataTable>
        </DataTableShell>
      </section>

      <Modal
        closeLabel={copy.cancel}
        footer={(
          <>
            <Button disabled={saving} onClick={closeForm} variant="ghost">{copy.cancel}</Button>
            <Button loading={saving} loadingLabel={copy.loading} onClick={() => void save()} variant="primary">{copy.save}</Button>
          </>
        )}
        onClose={closeForm}
        open={formOpen}
        size="lg"
        testId="staff-device-form-modal"
        title={editing ? copy.edit : copy.add}
      >
        <div className="staff-device-form">
          {([
            ["name", copy.name], ["ip", copy.ip], ["port", copy.port], ["timeoutMs", copy.timeout],
            ["pollIntervalMs", copy.poll], ["model", copy.model], ["serialNumber", copy.serial],
          ] as const).map(([key, label]) => (
            <label className="staff-device-field" key={key}>
              <span>{label}</span>
              <input
                aria-label={label}
                className="staff-device-control"
                onChange={(event) => setForm((value) => ({ ...value, [key]: event.target.value }))}
                type={["port", "timeoutMs", "pollIntervalMs"].includes(key) ? "number" : "text"}
                value={form[key]}
              />
            </label>
          ))}
          <label className="staff-device-checkbox">
            <input checked={form.enabled} onChange={(event) => setForm((value) => ({ ...value, enabled: event.target.checked }))} type="checkbox" />
            <span>{copy.enabled}</span>
          </label>
        </div>
      </Modal>

      <Modal
        closeLabel={copy.cancel}
        description={toolsDevice?.name}
        footer={<Button onClick={() => setToolsDevice(null)} variant="ghost">{copy.cancel}</Button>}
        onClose={() => setToolsDevice(null)}
        open={Boolean(toolsDevice)}
        size="lg"
        testId="staff-device-tools-modal"
        title={copy.tools}
      >
        {toolsDevice ? (
          <div className="staff-device-tools">
            {(canSync || canEnroll) ? (
              <>
                <label className="staff-device-field">
                  <span>{copy.selectEmployee}</span>
                  <DropdownSelect ariaLabel={copy.selectEmployee} buttonClassName="staff-device-control" searchable onChange={setEmployeeId} value={employeeId} options={[{ value: "", label: copy.selectEmployee }, ...employees.map((employee) => ({ value: employee.id, label: `${employee.code} — ${employee.firstName} ${employee.lastName}` }))]} />
                </label>
                <div className="staff-device-tools__actions">
                  {canSync ? (
                    <>
                      <Button onClick={() => void employeeCommand("upsert")} size="sm" variant="secondary">{copy.upsertUser}</Button>
                      <Button onClick={() => void employeeCommand("delete")} size="sm" variant="danger">{copy.deleteUser}</Button>
                      <Button onClick={() => void run(async () => {
                        const response = await syncStaffDeviceUsers(toolsDevice.id);
                        setNotice(`${copy.success} ${response.data.synced}/${response.data.total}`);
                      }, false)} size="sm" variant="secondary">{copy.syncUsers}</Button>
                    </>
                  ) : null}
                  {canEnroll ? (
                    <>
                      <DropdownSelect ariaLabel={copy.finger} buttonClassName="staff-device-control staff-device-finger" onChange={setFingerId} value={fingerId} options={Array.from({ length: 10 }, (_, index) => ({ value: String(index), label: `${copy.finger} ${index}` }))} />
                      <Button onClick={() => void employeeCommand("enroll")} size="sm" variant="secondary">{copy.enroll}</Button>
                    </>
                  ) : null}
                </div>
              </>
            ) : null}
            {canManage ? (
              <div className="staff-device-time-tools">
                <Button onClick={() => void run(async () => {
                  const response = await getStaffDeviceTime(toolsDevice.id);
                  setDeviceTime(response.data.time);
                }, false)} size="sm" variant="ghost">{copy.readTime}</Button>
                <Button onClick={() => void run(async () => {
                  const response = await setStaffDeviceTime(toolsDevice.id, new Date().toISOString());
                  setDeviceTime(response.data.time);
                }, false)} size="sm" variant="ghost">{copy.syncTime}</Button>
                <span>{deviceTime ? formatDate(deviceTime, i18n.language) : "—"}</span>
              </div>
            ) : null}
            {canSync ? (
              <section className="staff-device-users">
                <h3>{copy.users}</h3>
                {users.length === 0 ? <p>{copy.noUsers}</p> : users.map((user) => (
                  <div className="staff-device-user" key={user.userId}>
                    <span>{user.name || "—"}</span>
                    <strong>{user.userId}</strong>
                  </div>
                ))}
              </section>
            ) : null}
          </div>
        ) : null}
      </Modal>
    </section>
  );
}

function DeviceRowsSkeleton() {
  return (
    <div className="space-y-3" data-testid="staff-devices-loading" aria-hidden="true">
      {[1, 2].map((item) => <div key={item} className="rounded-2xl border border-slate-800/80 bg-slate-950/60 p-3"><div className="h-4 w-40 animate-pulse rounded-full bg-slate-800" /><div className="mt-2.5 h-3.5 w-64 animate-pulse rounded-full bg-slate-900" /><div className="mt-3 grid gap-2 md:grid-cols-3"><span className="h-9 animate-pulse rounded-2xl bg-slate-900/80" /><span className="h-9 animate-pulse rounded-2xl bg-slate-900/80" /><span className="h-9 animate-pulse rounded-2xl bg-slate-900/80" /></div></div>)}
    </div>
  );
}

function DeviceStatusPill({ label, status }: { label: string; status: StaffDeviceStatus }) {
  const styles: Record<StaffDeviceStatus, string> = {
    UNKNOWN: "border-slate-700 bg-slate-900/60 text-slate-200",
    ONLINE: "border-emerald-500/50 bg-emerald-500/10 text-emerald-100",
    OFFLINE: "border-amber-500/50 bg-amber-500/10 text-amber-100",
    ERROR: "border-rose-500/50 bg-rose-500/10 text-rose-100",
  };
  return <span className={`rounded-full border px-2 py-0.5 text-[9px] uppercase ${styles[status]}`}>{label}</span>;
}

function CompactDeviceButton({ children, icon, onClick }: { children: ReactNode; icon?: ReactNode; onClick: () => void }) {
  return <button type="button" onClick={onClick} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 px-2.5 py-1 text-[11px] text-slate-100 hover:border-brand-400 [&>svg]:h-3.5 [&>svg]:w-3.5">{icon}{children}</button>;
}

function statusLabel(status: StaffDeviceStatus, copy: DeviceCopy) {
  return status === "ONLINE" ? copy.online : status === "OFFLINE" ? copy.offline : status === "ERROR" ? copy.error : copy.unknown;
}

function formatDate(value: string | null | undefined, language: string) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : new Intl.DateTimeFormat(language, { dateStyle: "short", timeStyle: "short" }).format(date);
}
