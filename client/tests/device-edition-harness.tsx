import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import type { AuthState } from "../src/api/auth";
import { AuthContext, type AuthContextValue } from "../src/auth/AuthContext";
import { StaffDevices } from "../src/pages/attendance-edition/StaffDevices";
import "../src/i18n/config";
import "../src/index.css";

const profile = new URLSearchParams(window.location.search).get("profile") ?? "owner";
const features = ["ATTENDANCE_DAILY", "AUTH", "DEVICES", "EMPLOYEES", "ENTRY_LOGS"] as const;
const ownerPermissions = [
  "SIGN_IN",
  "DEVICES_VIEW",
  "DEVICES_USER_SYNC",
  "DEVICES_ENROLL",
  "SYSTEM_SETTINGS_MANAGE",
] as const;
const permissions: readonly string[] = profile === "viewer" ? ["SIGN_IN", "DEVICES_VIEW"] : ownerPermissions;
const auth = {
  features,
  permissions,
  user: { id: "admin-1", username: "owner", fullName: "Owner", role: "GYM_OWNER" },
} as unknown as AuthState;
const context: AuthContextValue = {
  status: "authenticated",
  auth,
  identity: null,
  setupStatus: null,
  error: null,
  refresh: async () => {},
  login: async () => {},
  setupOwner: async () => {},
  logout: async () => {},
  hasFeature: (feature) => features.includes(feature as never),
  hasPermission: (permission) => permissions.includes(permission),
  hasAnyPermission: (required) => required.some((permission) => permissions.includes(permission)),
};

createRoot(document.getElementById("root") as HTMLElement).render(
  <StrictMode>
    <AuthContext.Provider value={context}>
      <MemoryRouter initialEntries={["/devices"]}>
        <Routes><Route path="/devices" element={<StaffDevices />} /></Routes>
      </MemoryRouter>
    </AuthContext.Provider>
  </StrictMode>
);
