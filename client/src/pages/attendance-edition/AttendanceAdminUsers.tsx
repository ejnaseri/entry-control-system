import { IconAlertTriangle, IconRefresh } from "@tabler/icons-react";
import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import {
  createAdminUser,
  deactivateAdminUser,
  listAdminUsers,
  reactivateAdminUser,
  resetAdminUserPassword,
  updateAdminUser,
  type ManagedAdminUser,
} from "../../api/adminUsers";
import type { AdminRole } from "../../api/auth";
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
  DataTableSkeletonRows,
} from "../../components/ui/DataTable";
import { ErrorState } from "../../components/ui/StatePanel";
import { DropdownSelect } from "../../components/ui/DropdownSelect";
import { StatusBadge } from "../../components/ui/StatusBadge";
import { getAdminUserCopy, getAttendanceRoleLabel } from "./adminUserCopy";

type FormState = { username: string; fullName: string; email: string; password: string; role: AdminRole };
const fallbackRole: AdminRole = "OPERATOR";
const emptyForm = (role: AdminRole): FormState => ({ username: "", fullName: "", email: "", password: "", role });

export function AttendanceAdminUsers() {
  const { i18n } = useTranslation();
  const copy = getAdminUserCopy(i18n.language);
  const { auth } = useAuth();
  const [users, setUsers] = useState<ManagedAdminUser[]>([]);
  const [roles, setRoles] = useState<AdminRole[]>([]);
  const [editing, setEditing] = useState<ManagedAdminUser | null>(null);
  const [form, setForm] = useState<FormState>(() => emptyForm(fallbackRole));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const assignableRoles = useMemo(
    () => roles.filter((role) => role !== "GYM_OWNER" || auth?.user.role === "GYM_OWNER" || auth?.user.role === "VENDOR_OWNER"),
    [auth?.user.role, roles],
  );
  const activeCount = users.filter((user) => user.isActive).length;
  const ownerCount = users.filter((user) => user.role === "GYM_OWNER" && user.isActive).length;

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await listAdminUsers();
      setUsers(result.items);
      setRoles(result.roles);
      setForm((value) => ({
        ...value,
        role: result.roles.includes(value.role) ? value.role : result.roles[0] ?? fallbackRole,
      }));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : copy.failed);
    } finally {
      setLoading(false);
    }
  }, [copy.failed]);

  useEffect(() => { void load(); }, [load]);

  const reset = () => {
    setEditing(null);
    setForm(emptyForm(assignableRoles[0] ?? fallbackRole));
  };

  const edit = (user: ManagedAdminUser) => {
    setEditing(user);
    setForm({
      username: user.username,
      fullName: user.fullName ?? "",
      email: user.email ?? "",
      password: "",
      role: assignableRoles.includes(user.role) ? user.role : assignableRoles[0] ?? fallbackRole,
    });
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      if (editing) {
        await updateAdminUser(editing.id, {
          username: form.username,
          fullName: form.fullName || null,
          email: form.email || null,
          role: form.role,
        });
        if (form.password) await resetAdminUserPassword(editing.id, form.password);
      } else {
        await createAdminUser({
          username: form.username,
          fullName: form.fullName || null,
          email: form.email || null,
          password: form.password,
          role: form.role,
        });
      }
      reset();
      setMessage(copy.success);
      await load();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : copy.failed);
    } finally {
      setSaving(false);
    }
  };

  const toggle = async (user: ManagedAdminUser) => {
    setSaving(true);
    setError(null);
    try {
      await (user.isActive ? deactivateAdminUser(user.id) : reactivateAdminUser(user.id));
      setMessage(copy.success);
      await load();
    } catch (toggleError) {
      setError(toggleError instanceof Error ? toggleError.message : copy.failed);
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="settings-compact space-y-4" data-testid="attendance-admin-users">
      <div className="rounded-2xl border border-slate-800/80 bg-slate-950/70 p-3 shadow-inner shadow-slate-950/60">
        <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
          <div><h2 className="text-sm font-semibold text-white">{copy.title}</h2><p className="text-[11px] text-slate-400">{copy.subtitle}</p></div>
          <div className="grid grid-cols-2 gap-2 text-[10px] text-slate-300">
            <AdminStat label={copy.active} value={activeCount} />
            <AdminStat label={getAttendanceRoleLabel("GYM_OWNER", i18n.language, copy.legacy)} value={ownerCount} />
          </div>
        </div>
      </div>

      {error ? (
        <ErrorState
          action={<Button onClick={() => void load()} size="sm" variant="secondary">{copy.retry}</Button>}
          data-testid="attendance-admin-users-error"
          icon={<IconAlertTriangle className="h-5 w-5" stroke={1.8} />}
          title={error}
        />
      ) : null}
      {message ? <div className="attendance-admin-users-notice" role="status">{message}</div> : null}

      <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_24rem]">
        <div className="min-w-0 rounded-2xl border border-slate-800/80 bg-slate-950/60 p-3 shadow-inner shadow-slate-950/60">
          <DataTableShell data-testid="attendance-admin-users-table">
            <DataTable minWidth="760px" variant="compact">
              <DataTableHead><DataTableRow><DataTableHeaderCell>{copy.username}</DataTableHeaderCell><DataTableHeaderCell>{copy.role}</DataTableHeaderCell><DataTableHeaderCell>{copy.status}</DataTableHeaderCell><DataTableHeaderCell align="end">{copy.actions}</DataTableHeaderCell></DataTableRow></DataTableHead>
              <DataTableBody>
                {loading ? <DataTableSkeletonRows columns={4} rows={4} /> : users.length === 0 ? <DataTableEmptyRow colSpan={4}>{copy.noUsers}</DataTableEmptyRow> : users.map((user) => (
                  <DataTableRow key={user.id}>
                    <DataTableCell><div className="flex min-w-0 items-center gap-2"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-brand-500/30 bg-brand-500/10 text-[10px] font-bold text-brand-200">{initials(user.fullName || user.username)}</span><div className="min-w-0"><p className="truncate text-xs font-semibold text-white">{user.fullName || user.username}</p><p className="truncate text-[10px] text-slate-400">@{user.username}{user.email ? ` · ${user.email}` : ""}</p></div></div></DataTableCell>
                    <DataTableCell><span className="rounded-full border border-brand-500/30 bg-brand-500/10 px-2 py-0.5 text-[10px] font-semibold text-brand-200">{getAttendanceRoleLabel(user.role, i18n.language, copy.legacy)}</span></DataTableCell>
                    <DataTableCell><StatusBadge tone={user.isActive ? "success" : "neutral"}>{user.isActive ? copy.active : copy.inactive}</StatusBadge></DataTableCell>
                    <DataTableCell align="end"><div className="flex justify-end gap-1.5"><Button disabled={user.isProtected} onClick={() => edit(user)} size="sm" variant="ghost">{copy.edit}</Button><Button disabled={saving || user.isProtected || user.id === auth?.user.id} onClick={() => void toggle(user)} size="sm" variant="ghost">{user.isActive ? copy.deactivate : copy.reactivate}</Button></div></DataTableCell>
                  </DataTableRow>
                ))}
              </DataTableBody>
            </DataTable>
          </DataTableShell>
        </div>

        <form onSubmit={(event) => void submit(event)} className="rounded-2xl border border-slate-800/80 bg-slate-950/70 p-3 shadow-xl shadow-slate-950/60 xl:sticky xl:top-20 xl:self-start">
          <div className="mb-3 flex items-center justify-between gap-2"><div><p className="text-sm font-semibold text-white">{editing ? copy.edit : copy.add}</p><p className="text-[11px] text-slate-400">{editing ? copy.passwordHint : copy.subtitle}</p></div><button type="button" onClick={reset} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900/60 px-2.5 text-[11px] text-slate-200 transition hover:border-brand-400"><IconRefresh className="h-3.5 w-3.5" stroke={1.8} />{copy.add}</button></div>
          <div className="space-y-2.5">
            <AdminField label={copy.username}><input aria-label={copy.username} className="form-input" minLength={3} onChange={(event) => setForm((value) => ({ ...value, username: event.target.value }))} required value={form.username} /></AdminField>
            <AdminField label={copy.fullName}><input aria-label={copy.fullName} className="form-input" onChange={(event) => setForm((value) => ({ ...value, fullName: event.target.value }))} value={form.fullName} /></AdminField>
            <AdminField label={copy.email}><input aria-label={copy.email} className="form-input" onChange={(event) => setForm((value) => ({ ...value, email: event.target.value }))} type="email" value={form.email} /></AdminField>
            <AdminField label={copy.role}><DropdownSelect ariaLabel={copy.role} buttonClassName="form-input" value={form.role} onChange={(role) => setForm((value) => ({ ...value, role: role as AdminRole }))} options={assignableRoles.map((role) => ({ value: role, label: getAttendanceRoleLabel(role, i18n.language, copy.legacy) }))} /></AdminField>
            <AdminField label={copy.password}><input aria-label={copy.password} className="form-input" minLength={form.password || !editing ? 10 : undefined} onChange={(event) => setForm((value) => ({ ...value, password: event.target.value }))} required={!editing} type="password" value={form.password} /></AdminField>
          </div>
          <div className="mt-3 flex justify-end gap-2">{editing ? <Button disabled={saving} onClick={reset} variant="ghost">{copy.cancel}</Button> : null}<Button loading={saving} loadingLabel={copy.loading} type="submit" variant="primary">{copy.save}</Button></div>
        </form>
      </div>
    </section>
  );
}

function AdminField({ children, label }: { children: ReactNode; label: string }) { return <label className="block"><span className="mb-1 block text-[11px] font-semibold text-slate-300">{label}</span>{children}</label>; }
function AdminStat({ label, value }: { label: string; value: number }) { return <div className="rounded-lg border border-slate-800 bg-slate-900/60 px-2.5 py-1.5"><span className="block text-slate-500">{label}</span><strong className="text-sm text-white">{value}</strong></div>; }
function initials(value: string) { return value.split(/\s+/u).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "?"; }
