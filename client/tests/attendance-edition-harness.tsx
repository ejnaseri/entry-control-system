import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import type { AuthState } from "../src/api/auth";
import { AuthContext, type AuthContextValue } from "../src/auth/AuthContext";
import { ToastProvider } from "../src/components/ToastProvider";
import { StaffDailyAttendance } from "../src/pages/attendance-edition/StaffDailyAttendance";
import { StaffEntryLogs } from "../src/pages/attendance-edition/StaffEntryLogs";
import "../src/i18n/config";
import "../src/index.css";

const scenario = new URLSearchParams(window.location.search).get("scenario") ?? "daily";
const features = ["ATTENDANCE_DAILY", "AUTH", "EMPLOYEES", "ENTRY_LOGS"] as const;
const permissions = ["SIGN_IN", "MEMBERS_VIEW", "ATTENDANCE_VIEW", "ATTENDANCE_EXPORT", "ATTENDANCE_MANUAL", "ATTENDANCE_JUSTIFY"] as const;
const auth = { features, permissions, user: { id: "admin-1", username: "owner", fullName: "Owner", role: "GYM_OWNER" } } as unknown as AuthState;
const context: AuthContextValue = {
  status: "authenticated", auth, identity: null, setupStatus: null, error: null,
  refresh: async () => {}, login: async () => {}, setupOwner: async () => {}, logout: async () => {},
  hasFeature: (feature) => features.includes(feature as never),
  hasPermission: (permission) => permissions.includes(permission as never),
  hasAnyPermission: (required) => required.some((permission) => permissions.includes(permission as never)),
};

createRoot(document.getElementById("root") as HTMLElement).render(
  <StrictMode><AuthContext.Provider value={context}><ToastProvider><MemoryRouter initialEntries={[scenario === "logs" ? "/entry-logs" : "/attendance"]}><Routes>
    <Route path="/attendance" element={<StaffDailyAttendance />} />
    <Route path="/entry-logs" element={<StaffEntryLogs />} />
  </Routes></MemoryRouter></ToastProvider></AuthContext.Provider></StrictMode>
);
