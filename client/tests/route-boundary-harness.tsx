import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import type { AdminPermission, AuthState } from "../src/api/auth";
import { AuthContext, type AuthContextValue } from "../src/auth/AuthContext";
import { RequireFeature, RequirePermission } from "../src/auth/AuthRoutes";
import type { Capability } from "../src/auth/authState";
import { NotFoundPage } from "../src/routing/NotFoundPage";
import "../src/i18n/config";

const query = new URLSearchParams(window.location.search);
const features = query.get("feature") === "1" ? (["CUSTOMERS"] as Capability[]) : ([] as Capability[]);
const permissions = query.get("permission") === "1" ? (["MEMBERS_VIEW"] as AdminPermission[]) : [];
const path = query.get("unknown") === "1" ? "/unknown-private-route" : "/protected";
const auth = { features, permissions } as AuthState;

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
    <AuthContext.Provider value={context}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route
            path="/protected"
            element={
              <RequireFeature feature="CUSTOMERS">
                <RequirePermission anyOf={["MEMBERS_VIEW"]}>
                  <div data-testid="protected-content">Protected customer content</div>
                </RequirePermission>
              </RequireFeature>
            }
          />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>
  </StrictMode>
);
