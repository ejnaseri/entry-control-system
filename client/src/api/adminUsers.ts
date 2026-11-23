import { api } from "./client";
import type { AdminRole, AuthUser } from "./auth";

export type ManagedAdminUser = AuthUser & {
  deactivatedAt: string | null;
};

export type VendorMaintenanceStatus = {
  active: boolean;
  username: string;
  user: ManagedAdminUser | null;
  activatedAt: string | null;
  expiresAt: string | null;
  reason: string | null;
  activatedById: string | null;
  remainingSeconds: number | null;
};

export type AdminUsersResponse = {
  items: ManagedAdminUser[];
  roles: AdminRole[];
};

export type AdminUserCreateInput = {
  username: string;
  password: string;
  fullName?: string | null;
  email?: string | null;
  role: AdminRole;
};

export type AdminUserUpdateInput = {
  username?: string;
  fullName?: string | null;
  email?: string | null;
  role?: AdminRole;
};

export async function listAdminUsers() {
  const res = await api.get<AdminUsersResponse>("/api/v1/admin-users");
  return res.data;
}

export async function getVendorMaintenanceStatus() {
  const res = await api.get<VendorMaintenanceStatus>("/api/v1/admin-users/vendor-maintenance");
  return res.data;
}

export async function activateVendorMaintenance(payload: { password: string; durationMinutes: number; reason: string }) {
  const res = await api.post<VendorMaintenanceStatus>("/api/v1/admin-users/vendor-maintenance/activate", payload);
  return res.data;
}

export async function deactivateVendorMaintenance(payload: { reason?: string } = {}) {
  const res = await api.post<VendorMaintenanceStatus>("/api/v1/admin-users/vendor-maintenance/deactivate", payload);
  return res.data;
}

export async function createAdminUser(payload: AdminUserCreateInput) {
  const res = await api.post<ManagedAdminUser>("/api/v1/admin-users", payload);
  return res.data;
}

export async function updateAdminUser(id: string, payload: AdminUserUpdateInput) {
  const res = await api.put<ManagedAdminUser>(`/api/v1/admin-users/${id}`, payload);
  return res.data;
}

export async function resetAdminUserPassword(id: string, password: string) {
  const res = await api.post<ManagedAdminUser>(`/api/v1/admin-users/${id}/reset-password`, { password });
  return res.data;
}

export async function deactivateAdminUser(id: string) {
  const res = await api.post<ManagedAdminUser>(`/api/v1/admin-users/${id}/deactivate`);
  return res.data;
}

export async function reactivateAdminUser(id: string) {
  const res = await api.post<ManagedAdminUser>(`/api/v1/admin-users/${id}/reactivate`);
  return res.data;
}
