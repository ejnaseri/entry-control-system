import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import {
  IconClock,
  IconEdit,
  IconKey,
  IconPower,
  IconRefresh,
  IconShieldCheck,
  IconShieldLock,
  IconUserCheck,
  IconUserOff,
  IconUserPlus,
} from "@tabler/icons-react";
import {
  activateVendorMaintenance,
  createAdminUser,
  deactivateAdminUser,
  deactivateVendorMaintenance,
  getVendorMaintenanceStatus,
  listAdminUsers,
  reactivateAdminUser,
  resetAdminUserPassword,
  updateAdminUser,
  type ManagedAdminUser,
  type VendorMaintenanceStatus,
} from "../../api/adminUsers";
import type { AdminRole } from "../../api/auth";
import { useAuth } from "../../auth/AuthContext";
import { useToast } from "../../components/ToastContext";
import {
  DataTable,
  DataTableBody,
  DataTableCell,
  DataTableHead,
  DataTableHeaderCell,
  DataTableRow,
  DataTableShell,
} from "../../components/ui/DataTable";
import { rtlLanguages } from "../../i18n/config";

type FormState = {
  username: string;
  fullName: string;
  email: string;
  role: AdminRole;
  password: string;
};

const roleLabels: Record<AdminRole, string> = {
  VENDOR_OWNER: "Vendor maintenance",
  GYM_OWNER: "Gym owner",
  ADMIN: "Admin",
  MANAGER: "Manager",
  RECEPTION: "Reception",
  ACCOUNTANT: "Accountant",
  DEVICE_OPERATOR: "Device operator",
  READ_ONLY_AUDITOR: "Read-only auditor",
  STAFF: "Staff",
  SUPER_ADMIN: "Legacy super admin",
  OPERATOR: "Legacy operator",
};

const roleDescriptions: Partial<Record<AdminRole, string>> = {
  GYM_OWNER: "Full business owner access except vendor-only maintenance actions.",
  ADMIN: "Trusted administrator for users, settings, members, and reports.",
  MANAGER: "Daily operations, members, payments, reports, and device diagnostics.",
  RECEPTION: "Front desk work: members, memberships, payments, attendance, and basic devices.",
  ACCOUNTANT: "Financial reports, payments, expenses, payroll, and exports.",
  DEVICE_OPERATOR: "K40 diagnostics, user sync, enrollment, and door operations.",
  READ_ONLY_AUDITOR: "Read-only review across members, reports, attendance, and devices.",
  STAFF: "Limited staff-facing access.",
};

const fallbackRole: AdminRole = "RECEPTION";

function createEmptyForm(defaultRole: AdminRole): FormState {
  return {
    username: "",
    fullName: "",
    email: "",
    role: defaultRole,
    password: "",
  };
}

function formFromUser(user: ManagedAdminUser): FormState {
  return {
    username: user.username,
    fullName: user.fullName ?? "",
    email: user.email ?? "",
    role: user.role,
    password: "",
  };
}

export function AdminUsersPage() {
  const { t, i18n } = useTranslation();
  const { auth } = useAuth();
  const { push } = useToast();
  const isRtl = rtlLanguages.includes(i18n.language.split("-")[0]);
  const [users, setUsers] = useState<ManagedAdminUser[]>([]);
  const [roles, setRoles] = useState<AdminRole[]>(["ADMIN", "MANAGER", "RECEPTION", "ACCOUNTANT", "DEVICE_OPERATOR", "READ_ONLY_AUDITOR", "STAFF"]);
  const [editing, setEditing] = useState<ManagedAdminUser | null>(null);
  const [form, setForm] = useState<FormState>(() => createEmptyForm("RECEPTION"));
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [vendorStatus, setVendorStatus] = useState<VendorMaintenanceStatus | null>(null);
  const [vendorPassword, setVendorPassword] = useState("");
  const [vendorReason, setVendorReason] = useState("");
  const [vendorDurationMinutes, setVendorDurationMinutes] = useState(60);
  const [vendorSubmitting, setVendorSubmitting] = useState(false);

  const roleOptions = useMemo<AdminRole[]>(() => {
    const filtered = roles.filter((role) => {
      if (role === "VENDOR_OWNER" || role === "SUPER_ADMIN" || role === "OPERATOR") return false;
      if (role === "GYM_OWNER" && auth?.user.role !== "GYM_OWNER" && auth?.user.role !== "VENDOR_OWNER") return false;
      return true;
    });
    return filtered.length ? filtered : [fallbackRole];
  }, [auth?.user.role, roles]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [result, vendor] = await Promise.all([listAdminUsers(), getVendorMaintenanceStatus()]);
      setUsers(result.items);
      setRoles(result.roles);
      setVendorStatus(vendor);
    } catch (error) {
      push({ kind: "error", title: error instanceof Error ? error.message : "Failed to load admin users" });
    } finally {
      setLoading(false);
    }
  }, [push]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!editing && !roleOptions.includes(form.role)) {
      setForm((prev) => ({ ...prev, role: roleOptions[0] ?? fallbackRole }));
    }
  }, [editing, form.role, roleOptions]);

  const resetForm = () => {
    setEditing(null);
    setForm(createEmptyForm(roleOptions[0] ?? fallbackRole));
  };

  const updateUserInList = (next: ManagedAdminUser) => {
    setUsers((prev) => prev.map((user) => (user.id === next.id ? next : user)));
    setEditing((prev) => (prev?.id === next.id ? next : prev));
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    try {
      if (editing) {
        let next = await updateAdminUser(editing.id, {
          username: form.username,
          fullName: form.fullName.trim() || null,
          email: form.email.trim() || null,
          role: form.role,
        });
        if (form.password.trim()) {
          next = await resetAdminUserPassword(editing.id, form.password);
          push({ kind: "warning", title: "Password reset. Existing sessions for this user were revoked." });
        }
        updateUserInList(next);
        setForm(formFromUser(next));
        push({ kind: "success", title: "Admin user updated" });
      } else {
        const created = await createAdminUser({
          username: form.username,
          password: form.password,
          fullName: form.fullName.trim() || null,
          email: form.email.trim() || null,
          role: form.role,
        });
        setUsers((prev) => [created, ...prev]);
        resetForm();
        push({ kind: "success", title: "Admin user created" });
      }
    } catch (error) {
      push({ kind: "error", title: error instanceof Error ? error.message : "Admin user save failed" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleActive = async (user: ManagedAdminUser) => {
    if (user.id === auth?.user.id || user.isProtected) return;
    setSubmitting(true);
    try {
      const next = user.isActive ? await deactivateAdminUser(user.id) : await reactivateAdminUser(user.id);
      updateUserInList(next);
      push({ kind: "success", title: user.isActive ? "Admin user deactivated" : "Admin user reactivated" });
    } catch (error) {
      push({ kind: "error", title: error instanceof Error ? error.message : "Status change failed" });
    } finally {
      setSubmitting(false);
    }
  };

  const mergeVendorUser = (status: VendorMaintenanceStatus) => {
    setVendorStatus(status);
    const vendorUser = status.user;
    if (!vendorUser) return;
    setUsers((prev) => {
      const exists = prev.some((user) => user.id === vendorUser.id);
      if (exists) {
        return prev.map((user) => (user.id === vendorUser.id ? vendorUser : user));
      }
      return [vendorUser, ...prev];
    });
  };

  const handleActivateVendor = async (event: FormEvent) => {
    event.preventDefault();
    setVendorSubmitting(true);
    try {
      const status = await activateVendorMaintenance({
        password: vendorPassword,
        durationMinutes: vendorDurationMinutes,
        reason: vendorReason,
      });
      mergeVendorUser(status);
      setVendorPassword("");
      push({ kind: "success", title: "Vendor maintenance access activated" });
    } catch (error) {
      push({ kind: "error", title: error instanceof Error ? error.message : "Vendor maintenance activation failed" });
    } finally {
      setVendorSubmitting(false);
    }
  };

  const handleDeactivateVendor = async () => {
    setVendorSubmitting(true);
    try {
      const status = await deactivateVendorMaintenance({ reason: vendorReason.trim() || undefined });
      mergeVendorUser(status);
      push({ kind: "success", title: "Vendor maintenance access deactivated" });
    } catch (error) {
      push({ kind: "error", title: error instanceof Error ? error.message : "Vendor maintenance deactivation failed" });
    } finally {
      setVendorSubmitting(false);
    }
  };

  const sortedUsers = useMemo(
    () =>
      [...users].sort((a, b) => {
        if (a.isProtected !== b.isProtected) return Number(a.isProtected) - Number(b.isProtected);
        if (a.isActive !== b.isActive) return Number(b.isActive) - Number(a.isActive);
        return a.username.localeCompare(b.username);
      }),
    [users]
  );

  const activeCount = users.filter((user) => user.isActive).length;
  const ownerCount = users.filter((user) => user.role === "GYM_OWNER" && user.isActive).length;
  const canActivateVendor = auth?.user.role === "GYM_OWNER";
  const canDeactivateVendor = Boolean(vendorStatus?.active && (auth?.user.role === "GYM_OWNER" || auth?.user.role === "VENDOR_OWNER"));

  return (
    <div className="settings-compact space-y-4" dir={isRtl ? "rtl" : "ltr"}>
      <div className="rounded-2xl border border-slate-800/80 bg-slate-950/70 p-3 shadow-inner shadow-slate-950/60">
        <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
          <div>
            <h2 className="text-sm font-semibold text-white">{t("settings.adminUsers.title", { defaultValue: "Admin users" })}</h2>
            <p className="text-[11px] text-slate-400">
              {t("settings.adminUsers.subtitle", { defaultValue: "Create staff logins, assign roles, reset passwords, and deactivate access." })}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2 text-[10px] text-slate-300">
            <Stat label="Active" value={activeCount} />
            <Stat label="Owners" value={ownerCount} />
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-800/80 bg-slate-950/70 p-3 shadow-xl shadow-slate-950/50">
        <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_28rem]">
          <div className="flex min-w-0 gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-200">
              <IconShieldCheck className="h-5 w-5" stroke={1.8} />
            </span>
            <div className="min-w-0 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-sm font-semibold text-white">Vendor maintenance</h3>
                <StatusBadge active={Boolean(vendorStatus?.active)} />
                <TinyBadge tone="amber">{vendorStatus?.username ?? "vendor-maintenance"}</TinyBadge>
              </div>
              <div className="flex flex-wrap gap-2 text-[10px] text-slate-300">
                <span className="inline-flex items-center gap-1 rounded-lg border border-slate-800 bg-slate-900/70 px-2 py-1">
                  <IconClock className="h-3.5 w-3.5" stroke={1.8} />
                  Expires: {formatDateTime(vendorStatus?.expiresAt ?? null, i18n.language)}
                </span>
                <span className="inline-flex rounded-lg border border-slate-800 bg-slate-900/70 px-2 py-1">
                  Remaining: {formatRemaining(vendorStatus?.remainingSeconds ?? null)}
                </span>
                {vendorStatus?.reason ? (
                  <span className="inline-flex max-w-full rounded-lg border border-slate-800 bg-slate-900/70 px-2 py-1">
                    <span className="truncate">Reason: {vendorStatus.reason}</span>
                  </span>
                ) : null}
              </div>
            </div>
          </div>

          {canActivateVendor || canDeactivateVendor ? (
            <form onSubmit={handleActivateVendor} className="grid gap-2 md:grid-cols-2 xl:grid-cols-1">
              <Field label="Reason">
                <input
                  value={vendorReason}
                  onChange={(event) => setVendorReason(event.target.value)}
                  className="form-input"
                  minLength={canActivateVendor ? 5 : undefined}
                  maxLength={500}
                  required={canActivateVendor}
                  autoComplete="off"
                  placeholder="Owner-approved maintenance reason"
                />
              </Field>
              {canActivateVendor ? (
                <>
                  <Field label="Temporary password">
                    <input
                      value={vendorPassword}
                      onChange={(event) => setVendorPassword(event.target.value)}
                      className="form-input"
                      type="password"
                      minLength={14}
                      maxLength={256}
                      required
                      autoComplete="new-password"
                    />
                  </Field>
                  <Field label="Duration">
                    <select
                      value={vendorDurationMinutes}
                      onChange={(event) => setVendorDurationMinutes(Number(event.target.value))}
                      className="form-input"
                    >
                      <option value={15}>15 minutes</option>
                      <option value={30}>30 minutes</option>
                      <option value={60}>1 hour</option>
                      <option value={120}>2 hours</option>
                      <option value={240}>4 hours</option>
                    </select>
                  </Field>
                  <button
                    type="submit"
                    disabled={vendorSubmitting}
                    className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-emerald-500/40 bg-emerald-500/80 text-xs font-semibold !text-white shadow-lg shadow-emerald-950/30 transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <IconShieldCheck className="h-4 w-4" stroke={1.8} />
                    {vendorSubmitting ? "Working..." : "Activate maintenance"}
                  </button>
                </>
              ) : null}
              {canDeactivateVendor ? (
                <button
                  type="button"
                  onClick={() => void handleDeactivateVendor()}
                  disabled={vendorSubmitting}
                  className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-rose-500/40 bg-rose-500/15 text-xs font-semibold text-rose-100 transition hover:bg-rose-500/25 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <IconPower className="h-4 w-4" stroke={1.8} />
                  Deactivate now
                </button>
              ) : null}
            </form>
          ) : (
            <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-3 text-[11px] leading-5 text-slate-400">
              Only a gym owner can activate vendor maintenance access.
            </div>
          )}
        </div>
      </div>

      <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_24rem]">
        <div className="rounded-2xl border border-slate-800/80 bg-slate-950/60 p-3 shadow-inner shadow-slate-950/60">
          {loading ? (
            <div className="space-y-2">
              <SkeletonRow />
              <SkeletonRow />
              <SkeletonRow />
            </div>
          ) : sortedUsers.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-800 bg-slate-900/40 p-4 text-sm text-slate-300">No admin users found.</div>
          ) : (
            <DataTableShell>
              <DataTable variant="compact" minWidth="760px">
                <DataTableHead>
                  <DataTableRow>
                    <DataTableHeaderCell>User</DataTableHeaderCell>
                    <DataTableHeaderCell>Role</DataTableHeaderCell>
                    <DataTableHeaderCell>Status</DataTableHeaderCell>
                    <DataTableHeaderCell>Last login</DataTableHeaderCell>
                    <DataTableHeaderCell align="end">Actions</DataTableHeaderCell>
                  </DataTableRow>
                </DataTableHead>
                <DataTableBody>
                  {sortedUsers.map((user) => {
                    const isSelf = user.id === auth?.user.id;
                    const locked = user.isProtected || user.role === "VENDOR_OWNER";
                    return (
                      <DataTableRow key={user.id}>
                        <DataTableCell>
                          <div className="flex min-w-0 items-center gap-2">
                            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-brand-500/30 bg-brand-500/10 text-[10px] font-bold text-brand-200">
                              {getInitials(user.fullName || user.username)}
                            </span>
                            <div className="min-w-0">
                              <p className="truncate text-xs font-semibold text-white">{user.fullName || user.username}</p>
                              <p className="truncate text-[10px] text-slate-400">
                                @{user.username}
                                {user.email ? ` · ${user.email}` : ""}
                              </p>
                            </div>
                          </div>
                        </DataTableCell>
                        <DataTableCell>
                          <RoleBadge role={user.role} />
                        </DataTableCell>
                        <DataTableCell>
                          <div className="flex flex-wrap gap-1">
                            <StatusBadge active={user.isActive} />
                            {isSelf ? <TinyBadge tone="brand">Current</TinyBadge> : null}
                            {locked ? <TinyBadge tone="amber">Protected</TinyBadge> : null}
                          </div>
                        </DataTableCell>
                        <DataTableCell className="text-slate-400">{formatDateTime(user.lastLoginAt, i18n.language)}</DataTableCell>
                        <DataTableCell align="end">
                          <div className="flex justify-end gap-1.5">
                            <IconButton
                              label="Edit"
                              disabled={locked}
                              onClick={() => {
                                setEditing(user);
                                setForm(formFromUser(user));
                              }}
                            >
                              <IconEdit className="h-3.5 w-3.5" stroke={1.8} />
                            </IconButton>
                            <IconButton
                              label={user.isActive ? "Deactivate" : "Reactivate"}
                              disabled={locked || isSelf || submitting}
                              danger={user.isActive}
                              onClick={() => void handleToggleActive(user)}
                            >
                              {user.isActive ? <IconUserOff className="h-3.5 w-3.5" stroke={1.8} /> : <IconUserCheck className="h-3.5 w-3.5" stroke={1.8} />}
                            </IconButton>
                          </div>
                        </DataTableCell>
                      </DataTableRow>
                    );
                  })}
                </DataTableBody>
              </DataTable>
            </DataTableShell>
          )}
        </div>

        <form onSubmit={handleSubmit} className="rounded-2xl border border-slate-800/80 bg-slate-950/70 p-3 shadow-xl shadow-slate-950/60 xl:sticky xl:top-20 xl:self-start">
          <div className="mb-3 flex items-center justify-between gap-2">
            <div>
              <p className="text-sm font-semibold text-white">{editing ? "Edit admin user" : "Create admin user"}</p>
              <p className="text-[11px] text-slate-400">
                {editing ? "Leave password empty unless you want to reset it." : "The first password must be shared securely with the user."}
              </p>
            </div>
            <button
              type="button"
              onClick={resetForm}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900/60 px-2.5 text-[11px] text-slate-200 transition hover:border-brand-400"
            >
              <IconRefresh className="h-3.5 w-3.5" stroke={1.8} />
              New
            </button>
          </div>

          <div className="space-y-2.5">
            <Field label="Username">
              <input
                value={form.username}
                onChange={(event) => setForm((prev) => ({ ...prev, username: event.target.value }))}
                className="form-input"
                required
                minLength={3}
                maxLength={50}
                autoComplete="off"
              />
            </Field>
            <Field label="Full name">
              <input
                value={form.fullName}
                onChange={(event) => setForm((prev) => ({ ...prev, fullName: event.target.value }))}
                className="form-input"
                maxLength={120}
                autoComplete="off"
              />
            </Field>
            <Field label="Email">
              <input
                value={form.email}
                onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
                className="form-input"
                type="email"
                maxLength={254}
                autoComplete="off"
              />
            </Field>
            <Field label="Role">
              <select
                value={form.role}
                onChange={(event) => setForm((prev) => ({ ...prev, role: event.target.value as AdminRole }))}
                className="form-input"
                disabled={editing?.id === auth?.user.id}
              >
                {roleOptions.map((role) => (
                  <option key={role} value={role}>
                    {roleLabels[role] ?? role}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-[10px] leading-4 text-slate-500">{roleDescriptions[form.role]}</p>
            </Field>
            <Field label={editing ? "New password" : "Initial password"}>
              <input
                value={form.password}
                onChange={(event) => setForm((prev) => ({ ...prev, password: event.target.value }))}
                className="form-input"
                type="password"
                minLength={editing ? undefined : 10}
                maxLength={256}
                required={!editing}
                autoComplete="new-password"
              />
            </Field>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="mt-4 inline-flex h-9 w-full items-center justify-center gap-2 rounded-lg border border-brand-500/40 bg-brand-500/85 text-xs font-semibold !text-white shadow-lg shadow-brand-900/30 transition hover:bg-brand-500 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {editing ? <IconKey className="h-4 w-4" stroke={1.8} /> : <IconUserPlus className="h-4 w-4" stroke={1.8} />}
            {submitting ? "Saving..." : editing ? "Save changes" : "Create user"}
          </button>
        </form>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-1.5">
      <p className="text-[9px] uppercase tracking-wide text-slate-500">{label}</p>
      <p className="text-sm font-bold text-white">{value}</p>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-semibold text-slate-300">{label}</span>
      {children}
    </label>
  );
}

function RoleBadge({ role }: { role: AdminRole }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-sky-500/35 bg-sky-500/10 px-2 py-0.5 text-[10px] font-semibold text-sky-200">
      <IconShieldLock className="h-3 w-3" stroke={1.8} />
      {roleLabels[role] ?? role}
    </span>
  );
}

function StatusBadge({ active }: { active: boolean }) {
  return (
    <span
      className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
        active ? "border-emerald-500/35 bg-emerald-500/10 text-emerald-200" : "border-slate-700 bg-slate-800/80 text-slate-300"
      }`}
    >
      {active ? "Active" : "Inactive"}
    </span>
  );
}

function TinyBadge({ children, tone }: { children: React.ReactNode; tone: "brand" | "amber" }) {
  const toneClass =
    tone === "brand"
      ? "border-brand-500/35 bg-brand-500/10 text-brand-200"
      : "border-amber-500/35 bg-amber-500/10 text-amber-200";
  return <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold ${toneClass}`}>{children}</span>;
}

function IconButton({
  label,
  children,
  onClick,
  disabled,
  danger,
}: {
  label: string;
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      className={`inline-flex h-7 w-7 items-center justify-center rounded-lg border transition disabled:cursor-not-allowed disabled:opacity-35 ${
        danger
          ? "border-rose-500/40 bg-rose-500/10 text-rose-100 hover:bg-rose-500/20"
          : "border-slate-700 bg-slate-900/50 text-slate-100 hover:border-brand-400 hover:text-white"
      }`}
    >
      {children}
    </button>
  );
}

function SkeletonRow() {
  return (
    <div className="h-14 animate-pulse rounded-xl border border-slate-800 bg-slate-900/60" />
  );
}

function getInitials(value: string) {
  const parts = value.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "AD";
  if (parts.length === 1) return parts[0]?.slice(0, 2).toUpperCase() ?? "AD";
  return `${parts[0]?.[0] ?? ""}${parts[1]?.[0] ?? ""}`.toUpperCase();
}

function formatDateTime(value: string | null, locale: string) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat(locale, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function formatRemaining(value: number | null) {
  if (value === null) return "-";
  if (value <= 0) return "Expired";
  const hours = Math.floor(value / 3600);
  const minutes = Math.ceil((value % 3600) / 60);
  if (hours <= 0) return `${minutes}m`;
  if (minutes === 0) return `${hours}h`;
  return `${hours}h ${minutes}m`;
}
