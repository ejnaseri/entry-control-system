import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import type { AuthState } from "../src/api/auth";
import { AuthContext, type AuthContextValue } from "../src/auth/AuthContext";
import { AttendanceAdminUsers } from "../src/pages/attendance-edition/AttendanceAdminUsers";
import "../src/i18n/config";
import "../src/index.css";

const features = ["ADMIN_USERS", "ATTENDANCE_DAILY", "AUTH", "DEVICES", "EMPLOYEES", "ENTRY_LOGS"] as const;
const permissions = ["SIGN_IN", "ADMIN_USERS_MANAGE", "ROLES_MANAGE"] as const;
const auth = { edition: "ATTENDANCE", features, permissions, user: { id: "owner-1", username: "owner", fullName: "Owner", role: "GYM_OWNER" } } as unknown as AuthState;
const context: AuthContextValue = {
  status: "authenticated", auth, identity: null, setupStatus: null, error: null,
  refresh: async () => {}, login: async () => {}, setupOwner: async () => {}, logout: async () => {},
  hasFeature: (feature) => features.includes(feature as never),
  hasPermission: (permission) => permissions.includes(permission as never),
  hasAnyPermission: (required) => required.some((permission) => permissions.includes(permission as never)),
};

createRoot(document.getElementById("root") as HTMLElement).render(
  <StrictMode><AuthContext.Provider value={context}><MemoryRouter><AttendanceAdminUsers /></MemoryRouter></AuthContext.Provider></StrictMode>
);
