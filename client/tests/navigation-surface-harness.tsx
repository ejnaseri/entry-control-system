import { lazy, StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import type { AdminPermission, AuthState } from "../src/api/auth";
import { AuthContext, type AuthContextValue } from "../src/auth/AuthContext";
import type { Capability } from "../src/auth/authState";
import { ToastProvider } from "../src/components/ToastProvider";
import { FullShellAdapter } from "../src/layouts/FullShellAdapter";
import { RouteManifestProvider } from "../src/routing/RouteManifestContext";
import { defineRouteBundle } from "../src/routing/routeManifest";
import "../src/i18n/config";
import "../src/index.css";

const query = new URLSearchParams(window.location.search);
const scenario = query.get("scenario") ?? "full";
const fakePage = lazy(async () => ({ default: () => null }));
const features = resolveFeatures(scenario);
const permissions = resolvePermissions(scenario);
const pathname = scenario === "hidden-feature" ? "/members" : scenario === "settings" ? "/settings/audit-logs" : "/members/member-1";

const bundle = defineRouteBundle({
  id: "NAVIGATION_SURFACE_TEST_MANIFEST",
  edition: "FULL",
  layout: fakePage,
  routes: [
    { key: "dashboard", path: "/dashboard", feature: "ATTENDANCE_DASHBOARD", permissions: ["ATTENDANCE_VIEW"], component: fakePage, navigation: { surface: "main", icon: "dashboard", labelKey: "nav.dashboard", defaultLabel: "Dashboard" }, order: 10 },
    { key: "members", path: "/members", feature: "CUSTOMERS", permissions: ["MEMBERS_VIEW"], component: fakePage, navigation: { surface: "main", icon: "members", labelKey: "nav.members", defaultLabel: "Members" }, order: 20 },
    { key: "members-add", path: "/members/add", feature: "CUSTOMERS", permissions: ["MEMBERS_WRITE"], component: fakePage, title: { labelKey: "members.actions.add", defaultLabel: "Add member" }, navigation: null, parentKey: "members", headerAction: { labelKey: "members.actions.add", defaultLabel: "Add member" }, order: 21 },
    { key: "members-detail", path: "/members/:id", feature: "CUSTOMERS", permissions: ["MEMBERS_VIEW"], component: fakePage, title: { labelKey: "memberDetail.title", defaultLabel: "Member details" }, navigation: null, parentKey: "members", order: 22 },
    { key: "finance", path: "/finance", feature: "FINANCIAL_REPORTS", permissions: ["FINANCIAL_REPORTS_VIEW"], component: fakePage, navigation: { surface: "main", icon: "reports", labelKey: "nav.reports", defaultLabel: "Finance" }, order: 30 },
    { key: "settings-audit-logs", path: "/settings/audit-logs", feature: "AUDIT_LOGS", permissions: ["AUDIT_LOG_VIEW"], component: fakePage, navigation: { surface: "settings", icon: "audit-logs", labelKey: "settings.menu.auditLogs", defaultLabel: "Audit logs" }, order: 40 },
    { key: "settings-membership-plans", path: "/settings/membership-plans", feature: "MEMBERSHIPS", permissions: ["MEMBERSHIPS_WRITE"], component: fakePage, navigation: { surface: "settings", icon: "membership-plans", labelKey: "settings.menu.membershipPlans", defaultLabel: "Membership plans" }, order: 41 },
  ],
});

const auth = {
  features,
  permissions,
  user: { id: "admin-1", username: "owner", fullName: "Test Owner", role: "GYM_OWNER" },
} as AuthState;

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
  hasFeature: (feature) => features.includes(feature),
  hasPermission: (permission) => permissions.includes(permission),
  hasAnyPermission: (required) => required.some((permission) => permissions.includes(permission)),
};

createRoot(document.getElementById("root") as HTMLElement).render(
  <StrictMode>
    <QueryClientProvider client={new QueryClient()}>
      <ToastProvider>
        <AuthContext.Provider value={context}>
          <RouteManifestProvider bundle={bundle}>
            <MemoryRouter initialEntries={[pathname]}>
              <Routes>
                <Route element={<FullShellAdapter />}>
                  <Route path="*" element={<div data-testid="navigation-test-page">Test page</div>} />
                </Route>
              </Routes>
            </MemoryRouter>
          </RouteManifestProvider>
        </AuthContext.Provider>
      </ToastProvider>
    </QueryClientProvider>
  </StrictMode>
);

function resolveFeatures(scenarioName: string): Capability[] {
  if (scenarioName === "hidden-feature") return ["ATTENDANCE_DASHBOARD"];
  if (scenarioName === "settings") return ["AUDIT_LOGS"];
  return ["ATTENDANCE_DASHBOARD", "CUSTOMERS", "AUDIT_LOGS"];
}

function resolvePermissions(scenarioName: string): AdminPermission[] {
  if (scenarioName === "hidden-feature") return ["ATTENDANCE_VIEW", "MEMBERS_VIEW", "MEMBERS_WRITE"];
  if (scenarioName === "settings") return ["AUDIT_LOG_VIEW"];
  if (scenarioName === "read-only") return ["ATTENDANCE_VIEW", "MEMBERS_VIEW", "AUDIT_LOG_VIEW"];
  return ["ATTENDANCE_VIEW", "MEMBERS_VIEW", "MEMBERS_WRITE", "AUDIT_LOG_VIEW"];
}
