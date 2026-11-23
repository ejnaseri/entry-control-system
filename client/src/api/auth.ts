import {
  normalizeAuthPayload,
  type AuthPayload,
  type AuthState,
  type AuthUser,
  type AdminPermission,
  type AdminRole,
  type AppEdition,
  type AuthSession,
  type Capability,
} from "../auth/authState";
import { api, authBootstrapApi } from "./client";

export type {
  AdminPermission,
  AdminRole,
  AppEdition,
  AuthPayload,
  AuthSession,
  AuthState,
  AuthUser,
  Capability,
};

export type SetupStatus = {
  setupRequired: boolean;
  activeAdminCount: number;
  hasGymOwner: boolean;
  hasVendorOwner: boolean;
};

export type LoginInput = {
  username: string;
  password: string;
};

export type SetupOwnerInput = LoginInput & {
  fullName?: string;
  email?: string;
};

export async function getSetupStatus(signal?: AbortSignal) {
  const res = await authBootstrapApi.get<SetupStatus>("/api/v1/auth/setup-status", { signal });
  return res.data;
}

export async function getCurrentAuth(signal?: AbortSignal) {
  const res = await authBootstrapApi.get<AuthPayload>("/api/v1/auth/me", { signal });
  return normalizeAuthPayload(res.data);
}

export async function loginAdmin(payload: LoginInput) {
  const res = await api.post<AuthPayload>("/api/v1/auth/login", payload);
  return normalizeAuthPayload(res.data);
}

export async function setupGymOwner(payload: SetupOwnerInput) {
  const res = await api.post<AuthPayload>("/api/v1/auth/setup", payload);
  return normalizeAuthPayload(res.data);
}

export async function logoutAdmin() {
  await api.post("/api/v1/auth/logout");
}
