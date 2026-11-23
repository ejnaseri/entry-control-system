import { lazy, StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import type { AuthState } from "../src/api/auth";
import { AuthContext, type AuthContextValue } from "../src/auth/AuthContext";
import { ToastProvider } from "../src/components/ToastProvider";
import { AttendanceShellAdapter } from "../src/layouts/AttendanceShellAdapter";
import { RouteManifestProvider } from "../src/routing/RouteManifestContext";
import { defineRouteBundle } from "../src/routing/routeManifest";
import "../src/i18n/config";
import "../src/index.css";

const query = new URLSearchParams(window.location.search);
const scenario = query.get("scenario") ?? "employees";
const inboxEnabled = query.get("inbox") === "1";
const fakePage = lazy(async () => ({ default: () => null }));
const features = [
  "ATTENDANCE_DASHBOARD",
  "EMPLOYEES",
  "AUDIT_LOGS",
  ...(inboxEnabled ? ["INBOX" as const] : []),
] as const;
const permissions = ["ATTENDANCE_VIEW", "MEMBERS_VIEW", "MEMBERS_WRITE", "AUDIT_LOG_VIEW"] as const;
const pathname = scenario === "settings" ? "/settings/audit-logs" : "/employees/employee-1";
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: query.get("queryRetry") !== "0",
    },
  },
});

const bundle = defineRouteBundle({
  id: "ATTENDANCE_SHELL_VISUAL_MANIFEST",
  edition: "ATTENDANCE",
  layout: fakePage,
  routes: [
    { key: "dashboard", path: "/dashboard", feature: "ATTENDANCE_DASHBOARD", permissions: ["ATTENDANCE_VIEW"], component: fakePage, navigation: { surface: "main", icon: "dashboard", labelKey: "attendanceShellRoutes.dashboard", defaultLabel: "Attendance dashboard" }, order: 10 },
    { key: "employees", path: "/employees", feature: "EMPLOYEES", permissions: ["MEMBERS_VIEW"], component: fakePage, navigation: { surface: "main", icon: "members", labelKey: "attendanceShellRoutes.employees", defaultLabel: "Employees" }, order: 20 },
    { key: "employees-add", path: "/employees/add", feature: "EMPLOYEES", permissions: ["MEMBERS_WRITE"], component: fakePage, title: { labelKey: "attendanceShellRoutes.addEmployee", defaultLabel: "Add employee" }, navigation: null, parentKey: "employees", headerAction: { labelKey: "attendanceShellRoutes.addEmployee", defaultLabel: "Add employee" }, order: 21 },
    { key: "employees-detail", path: "/employees/:id", feature: "EMPLOYEES", permissions: ["MEMBERS_VIEW"], component: fakePage, title: { labelKey: "attendanceShellRoutes.employeeDetails", defaultLabel: "Employee details" }, navigation: null, parentKey: "employees", order: 22 },
    { key: "settings-audit-logs", path: "/settings/audit-logs", feature: "AUDIT_LOGS", permissions: ["AUDIT_LOG_VIEW"], component: fakePage, navigation: { surface: "settings", icon: "audit-logs", labelKey: "attendanceShellRoutes.auditLogs", defaultLabel: "Audit logs" }, order: 30 },
  ],
});

const auth = {
  features,
  permissions,
  user: { id: "attendance-owner-1", username: "owner", fullName: "Attendance Owner", role: "GYM_OWNER" },
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
  hasPermission: (permission) => permissions.includes(permission as never),
  hasAnyPermission: (required) => required.some((permission) => permissions.includes(permission as never)),
};

createRoot(document.getElementById("root") as HTMLElement).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <AuthContext.Provider value={context}>
          <RouteManifestProvider bundle={bundle}>
            <MemoryRouter initialEntries={[pathname]}>
              <Routes>
                <Route element={<AttendanceShellAdapter />}>
                  <Route path="*" element={<div data-testid="attendance-shell-test-page">Attendance test page</div>} />
                </Route>
              </Routes>
            </MemoryRouter>
          </RouteManifestProvider>
        </AuthContext.Provider>
      </ToastProvider>
    </QueryClientProvider>
  </StrictMode>,
);
