import { expect, test, type Page, type Route } from "@playwright/test";

const OWNER_ID = "cmadminowner000000000000001";
const LEGACY_ID = "cmadminlegacy00000000000001";
const roles = ["GYM_OWNER", "MANAGER", "OPERATOR", "DEVICE_OPERATOR", "READ_ONLY_AUDITOR"];
const users = [
  { id: OWNER_ID, username: "owner", fullName: "Owner", email: null, role: "GYM_OWNER", isActive: true, isProtected: false },
  { id: LEGACY_ID, username: "old.accountant", fullName: "Legacy User", email: null, role: "ACCOUNTANT", isActive: true, isProtected: false },
];

test("Attendance selector exposes only approved role labels", async ({ page }) => {
  const requests: string[] = []; await mockApi(page, requests); await open(page);
  await expect(page.getByTestId("attendance-admin-users")).toBeVisible();
  await page.getByLabel("Role", { exact: true }).click();
  await expect(page.getByRole("option")).toHaveText([
    "Attendance Owner", "Attendance Manager", "Attendance Operator", "Device Technician", "Read-only Attendance Auditor",
  ]);
  await expect(page.getByText("Legacy restricted role", { exact: true })).toBeVisible();
  for (const forbidden of ["Gym owner", "Admin", "Reception", "Accountant", "Staff", "Legacy operator"]) {
    await expect(page.getByRole("option", { name: forbidden, exact: true })).toHaveCount(0);
  }
  assertSafeRequests(requests);
});

test("new login submits an approved Attendance role", async ({ page }) => {
  const requests: string[] = []; let created: Record<string, unknown> | null = null;
  await mockApi(page, requests, async (route) => {
    const request = route.request(); const path = new URL(request.url()).pathname;
    if (request.method() === "POST" && path === "/api/v1/admin-users") {
      created = request.postDataJSON(); await route.fulfill({ status: 201, json: { ...users[1], ...created, id: "cmadminnew0000000000000001" } }); return true;
    }
    return false;
  });
  await open(page);
  await page.getByLabel("Role", { exact: true }).click();
  await expect(page.getByRole("option")).toHaveCount(5);
  await page.getByLabel("Role", { exact: true }).click();
  await page.getByLabel("Username").fill("attendance.operator");
  await page.getByLabel("Full name").fill("Attendance Operator");
  await chooseDropdown(page, "Role", "OPERATOR");
  await page.getByLabel("Password").fill("Strong-Password-42!");
  await page.getByRole("button", { name: "Save" }).click();
  await expect.poll(() => created).not.toBeNull();
  expect(created?.role).toBe("OPERATOR");
  expect(JSON.stringify(created)).not.toMatch(/ACCOUNTANT|RECEPTION|SUPER_ADMIN|FINANCIAL_EXPORT|ATTENDANCE_EXPORT/u);
  assertSafeRequests(requests);
});

test("legacy account can be migrated to a safe role and password reset revokes through the core API", async ({ page }) => {
  const requests: string[] = []; let updated: Record<string, unknown> | null = null; let reset: Record<string, unknown> | null = null;
  await mockApi(page, requests, async (route) => {
    const request = route.request(); const path = new URL(request.url()).pathname;
    if (request.method() === "PUT" && path === `/api/v1/admin-users/${LEGACY_ID}`) { updated = request.postDataJSON(); await route.fulfill({ json: { ...users[1], ...updated } }); return true; }
    if (request.method() === "POST" && path.endsWith("/reset-password")) { reset = request.postDataJSON(); await route.fulfill({ json: users[1] }); return true; }
    return false;
  });
  await open(page);
  const legacyRow = page.getByRole("row").filter({ hasText: "old.accountant" });
  await expect(legacyRow).toBeVisible();
  await legacyRow.getByRole("button", { name: "Edit user" }).click();
  await expect(page.getByLabel("Role")).toContainText("Attendance Owner");
  await chooseDropdown(page, "Role", "MANAGER");
  await page.getByLabel("Password").fill("Replacement-Password-42!");
  await page.getByRole("button", { name: "Save" }).click();
  await expect.poll(() => updated).not.toBeNull(); await expect.poll(() => reset).not.toBeNull();
  expect(updated?.role).toBe("MANAGER"); expect(reset?.password).toBe("Replacement-Password-42!");
  assertSafeRequests(requests);
});

async function open(page: Page) {
  await page.route("**/admin-users-edition-harness.html*", (route) => route.fulfill({ contentType: "text/html; charset=utf-8", body: "<!doctype html><html><head><meta charset=\"UTF-8\"></head><body><div id=\"root\"></div><script type=\"module\">import RefreshRuntime from '/@react-refresh';RefreshRuntime.injectIntoGlobalHook(window);window.$RefreshReg$=()=>{};window.$RefreshSig$=()=>type=>type;window.__vite_plugin_react_preamble_installed__=true;</script><script type=\"module\" src=\"/tests/admin-users-edition-harness.tsx\"></script></body></html>" }));
  await page.goto("/admin-users-edition-harness.html", { waitUntil: "domcontentloaded" });
}

async function chooseDropdown(page: Page, label: string, value: string) {
  await page.getByLabel(label, { exact: true }).click();
  await page.locator(`[role="option"][data-value="${value}"]`).click();
}

async function mockApi(page: Page, requests: string[], custom?: (route: Route) => Promise<boolean>) {
  await page.route(/^https?:\/\/[^/]+\/api(?:\/|$)/u, async (route) => {
    const request = route.request(); const url = new URL(request.url()); requests.push(`${request.method()} ${url.pathname}`);
    if (custom && await custom(route)) return;
    if (request.method() === "GET" && url.pathname === "/api/v1/admin-users") { await route.fulfill({ json: { items: users, roles } }); return; }
    await route.fulfill({ json: users[1] });
  });
}

function assertSafeRequests(requests: string[]) {
  expect(requests.every((request) => request.startsWith("GET /api/v1/admin-users") || request.startsWith("POST /api/v1/admin-users") || request.startsWith("PUT /api/v1/admin-users"))).toBe(true);
}
