import { createContext, useContext } from "react";
import type { AdminPermission, AuthState, LoginInput, SetupOwnerInput, SetupStatus } from "../api/auth";
import type { Capability, PublicApiIdentity } from "./authState";

export type AuthStatus =
  | "checking"
  | "setup-required"
  | "authenticated"
  | "unauthenticated"
  | "incompatible"
  | "unavailable";

export type AuthContextValue = {
  status: AuthStatus;
  auth: AuthState | null;
  identity: PublicApiIdentity | null;
  setupStatus: SetupStatus | null;
  error: string | null;
  refresh: () => Promise<void>;
  login: (input: LoginInput) => Promise<void>;
  setupOwner: (input: SetupOwnerInput) => Promise<void>;
  logout: () => Promise<void>;
  hasFeature: (feature: Capability) => boolean;
  hasPermission: (permission: AdminPermission) => boolean;
  hasAnyPermission: (permissions: readonly AdminPermission[]) => boolean;
};

export const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider");
  }
  return context;
}
