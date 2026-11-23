import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import type { AuthState } from "../src/api/auth";
import { AuthContext, type AuthContextValue } from "../src/auth/AuthContext";
import { AddEmployee, EditEmployee } from "../src/pages/employees/EmployeeFormPage";
import { EmployeeDetail } from "../src/pages/employees/EmployeeDetail";
import { EmployeesList } from "../src/pages/employees/EmployeesList";
import { MemberAddRedirect, MemberDetailRedirect, MemberEditRedirect, MembersRedirect } from "../src/routing/attendanceRouteRedirects";
import "../src/i18n/config";
import "../src/index.css";

const scenario = new URLSearchParams(window.location.search).get("scenario") ?? "list";
const pathByScenario: Record<string, string> = {
  list: "/employees", add: "/employees/add", edit: "/employees/cmemployee00000000000000001/edit",
  detail: "/employees/cmemployee00000000000000001", legacy: "/members/cmemployee00000000000000001",
  customerLegacy: "/members/cmcustomer00000000000000001",
};
const features = ["AUTH", "DEVICES", "EMPLOYEES"] as const;
const permissions = ["SIGN_IN", "MEMBERS_VIEW", "MEMBERS_WRITE", "DEVICES_VIEW", "DEVICES_ENROLL"] as const;
const auth = { features, permissions, user: { id: "admin-1", username: "owner", fullName: "Owner", role: "GYM_OWNER" } } as unknown as AuthState;
const context: AuthContextValue = {
  status: "authenticated", auth, identity: null, setupStatus: null, error: null, refresh: async () => {}, login: async () => {},
  setupOwner: async () => {}, logout: async () => {}, hasFeature: (feature) => features.includes(feature as never),
  hasPermission: (permission) => permissions.includes(permission as never), hasAnyPermission: (required) => required.some((permission) => permissions.includes(permission as never)),
};

createRoot(document.getElementById("root") as HTMLElement).render(
  <StrictMode><AuthContext.Provider value={context}><MemoryRouter initialEntries={[pathByScenario[scenario] ?? "/employees"]}>
    <Routes>
      <Route path="/employees" element={<EmployeesList />} /><Route path="/employees/add" element={<AddEmployee />} />
      <Route path="/employees/:id" element={<EmployeeDetail />} /><Route path="/employees/:id/edit" element={<EditEmployee />} />
      <Route path="/members" element={<MembersRedirect />} /><Route path="/members/add" element={<MemberAddRedirect />} />
      <Route path="/members/:id" element={<MemberDetailRedirect />} /><Route path="/members/:id/edit" element={<MemberEditRedirect />} />
    </Routes>
  </MemoryRouter></AuthContext.Provider></StrictMode>
);
