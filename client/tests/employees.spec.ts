import { expect, test, type Page, type Route } from "@playwright/test";

const ID = "cmemployee00000000000000001";
const DEVICE_ID = "cmdevice000000000000000001";
const employee = {
  id: ID, code: "1", memberType: "STAFF", isStaff: true, firstName: "Eraj", lastName: "Naseri", fatherName: null,
  phone: "0700000000", email: "eraj@example.test", gender: "MALE", birthDate: null, nationalId: null, photoUrl: null,
  status: "ACTIVE", notes: null, roleType: "EMPLOYEE", customTitle: null, profile: { position: "Guard", department: "Operations", systemRole: null },
  staffGroupId: "cmstaffgroup0000000000000001", staffGroup: { id: "cmstaffgroup0000000000000001", name: "Day", description: null, accessLevel: null, shifts: [] },
  archivedAt: null, active: true, access: { allowedDays: [1, 2, 3, 4, 5], allowedTimeRanges: [], maxEntriesPerDay: null },
  overtime: { allowOvertime: false, maxOvertimePerDay: null }, shifts: [{ id: "shift-1", shiftId: "template-1", shiftName: "Day", shiftStart: "08:00", shiftEnd: "16:00", weekdays: [1,2,3,4,5], graceMinutes: 5, earlyAccessMinutes: 15, isFromGroup: true, isActive: true }],
  createdAt: "2026-08-23T08:00:00.000Z", updatedAt: "2026-08-23T08:00:00.000Z",
};
const groups = [{ id: "cmstaffgroup0000000000000001", name: "Day", description: null, accessLevel: null, shifts: [] }];

test("employee list is Staff-only and uses only the Employee facade", async ({ page }) => {
  const requests: string[] = [];
  await mockApi(page, requests);
  await open(page, "list");
  await expect(page.getByTestId("employees-list")).toBeVisible();
  await expect(page.getByText("Eraj Naseri")).toBeVisible();
  expect(requests).toContain("GET /api/v1/employees");
  expect(requests).toContain("GET /api/v1/employees/options/staff-groups");
  assertNoLegacyOrFinance(requests);
});

test("add employee sends the strict operational payload", async ({ page }) => {
  const requests: string[] = [];
  let body: Record<string, unknown> | null = null;
  await mockApi(page, requests, async (route) => {
    if (route.request().method() === "POST" && new URL(route.request().url()).pathname === "/api/v1/employees") {
      body = route.request().postDataJSON(); await route.fulfill({ status: 201, json: employee }); return true;
    }
    return false;
  });
  await open(page, "add");
  await page.getByTestId("employee-wizard-primary").click();
  await page.getByLabel("Employee code").fill("1");
  await page.getByLabel("First name").fill("Eraj");
  await page.getByTestId("employee-wizard-primary").click();
  await page.getByTestId("employee-wizard-primary").click();
  await chooseDropdown(page, "Staff group", groups[0]!.id);
  await page.getByTestId("employee-wizard-primary").click();
  await page.getByTestId("employee-wizard-primary").click();
  await page.getByTestId("employee-wizard-primary").click();
  await page.getByTestId("employee-wizard-primary").dispatchEvent("click");
  await expect(page.getByTestId("employee-detail")).toBeVisible();
  expect(body).not.toBeNull();
  for (const forbidden of ["memberType", "isStaff", "membership", "payments", "salaryAmount", "salaryType", "customerAccess", "fingerId"]) {
    expect(JSON.stringify(body)).not.toContain(`"${forbidden}"`);
  }
  expect(body?.staffGroupId).toBe(groups[0]!.id);
  assertNoLegacyOrFinance(requests);
});

test("add employee saves Staff before starting fingerprint enrollment", async ({ page }) => {
  const requests: string[] = [];
  let employeeBody: Record<string, unknown> | null = null;
  let enrollmentBody: Record<string, unknown> | null = null;
  await mockApi(page, requests, async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (request.method() === "POST" && path === "/api/v1/employees") {
      employeeBody = request.postDataJSON(); await route.fulfill({ status: 201, json: employee }); return true;
    }
    if (request.method() === "POST" && path === `/api/v1/devices/${DEVICE_ID}/enroll`) {
      enrollmentBody = request.postDataJSON(); await route.fulfill({ json: { ok: true, mode: "temporary" } }); return true;
    }
    return false;
  });

  await open(page, "add");
  await page.getByTestId("employee-wizard-primary").click();
  await page.getByLabel("Employee code").fill("1");
  await page.getByLabel("First name").fill("Eraj");
  await chooseFinger(page, "Right index (6)");
  await page.getByRole("button", { name: "Enroll when saved" }).click();
  await page.getByTestId("employee-wizard-primary").click();
  await page.getByTestId("employee-wizard-primary").click();
  await chooseDropdown(page, "Staff group", groups[0]!.id);
  await page.getByTestId("employee-wizard-primary").click();
  await page.getByTestId("employee-wizard-primary").click();
  await page.getByTestId("employee-wizard-primary").click();
  await page.getByTestId("employee-wizard-primary").dispatchEvent("click");
  await expect(page.getByTestId("employee-detail")).toBeVisible();

  expect(employeeBody).not.toBeNull();
  expect(JSON.stringify(employeeBody)).not.toContain('"fingerId"');
  expect(enrollmentBody).toEqual({ userId: "1", name: "Eraj", fingerId: 6 });
  expect(requests.indexOf("POST /api/v1/employees")).toBeLessThan(requests.indexOf(`POST /api/v1/devices/${DEVICE_ID}/enroll`));
  assertNoLegacyOrFinance(requests);
});

test("failed enrollment keeps the saved employee and retries without duplicate creation", async ({ page }) => {
  const requests: string[] = [];
  let createCount = 0;
  let enrollmentCount = 0;
  await mockApi(page, requests, async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (request.method() === "POST" && path === "/api/v1/employees") {
      createCount += 1; await route.fulfill({ status: 201, json: employee }); return true;
    }
    if (request.method() === "POST" && path === `/api/v1/devices/${DEVICE_ID}/enroll`) {
      enrollmentCount += 1;
      await route.fulfill(enrollmentCount === 1 ? { status: 503, json: { message: "Device unavailable" } } : { json: { ok: true, mode: "temporary" } });
      return true;
    }
    return false;
  });

  await open(page, "add");
  await page.getByTestId("employee-wizard-primary").click();
  await page.getByLabel("Employee code").fill("1");
  await page.getByLabel("First name").fill("Eraj");
  await chooseFinger(page, "Left index (3)");
  await page.getByRole("button", { name: "Enroll when saved" }).click();
  await page.getByTestId("employee-wizard-primary").click();
  await page.getByTestId("employee-wizard-primary").click();
  await chooseDropdown(page, "Staff group", groups[0]!.id);
  await page.getByTestId("employee-wizard-primary").click();
  await page.getByTestId("employee-wizard-primary").click();
  await page.getByTestId("employee-wizard-primary").click();
  await page.getByTestId("employee-wizard-primary").dispatchEvent("click");

  await expect(page.getByText(/employee was saved, but enrollment failed/iu)).toBeVisible();
  await page.getByRole("button", { name: "Enroll when saved" }).click();
  await expect(page.getByTestId("employee-detail")).toBeVisible();
  expect(createCount).toBe(1);
  expect(enrollmentCount).toBe(2);
});

test("edit loads and saves only through Employee URLs", async ({ page }) => {
  const requests: string[] = [];
  let updateBody: Record<string, unknown> | null = null;
  let enrollmentBody: Record<string, unknown> | null = null;
  await mockApi(page, requests, async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (request.method() === "PUT" && path === `/api/v1/employees/${ID}`) {
      updateBody = request.postDataJSON(); await route.fulfill({ json: { ...employee, firstName: "Iraj" } }); return true;
    }
    if (request.method() === "POST" && path === `/api/v1/devices/${DEVICE_ID}/enroll`) {
      enrollmentBody = request.postDataJSON(); await route.fulfill({ json: { ok: true, mode: "temporary" } }); return true;
    }
    return false;
  });
  await open(page, "edit");
  await expect(page.getByTestId("employee-form-edit")).toBeVisible();
  await page.getByTestId("employee-wizard-primary").click();
  await page.getByLabel("First name").fill("Iraj");
  await chooseFinger(page, "Left middle (2)");
  await page.getByRole("button", { name: "Enroll when saved" }).click();
  await page.getByTestId("employee-wizard-primary").click();
  await page.getByTestId("employee-wizard-primary").click();
  await page.getByTestId("employee-wizard-primary").click();
  await page.getByTestId("employee-wizard-primary").click();
  await page.getByTestId("employee-wizard-primary").click();
  await page.getByTestId("employee-wizard-primary").dispatchEvent("click");
  await expect(page.getByTestId("employee-detail")).toBeVisible();
  expect(updateBody?.firstName).toBe("Iraj");
  expect(JSON.stringify(updateBody)).not.toContain('"fingerId"');
  expect(enrollmentBody).toEqual({ userId: "1", name: "Iraj Naseri", fingerId: 2 });
  expect(requests.indexOf(`PUT /api/v1/employees/${ID}`)).toBeLessThan(requests.indexOf(`POST /api/v1/devices/${DEVICE_ID}/enroll`));
  assertNoLegacyOrFinance(requests);
});

test("legacy Staff bookmark redirects to the safe Employee detail", async ({ page }) => {
  const requests: string[] = [];
  await mockApi(page, requests);
  await open(page, "legacy");
  await expect(page.getByTestId("employee-detail")).toBeVisible();
  expect(requests).toContain(`GET /api/v1/employees/${ID}`);
  assertNoLegacyOrFinance(requests);
});

test("legacy Customer bookmark reaches only the non-enumerating Employee 404", async ({ page }) => {
  const requests: string[] = [];
  await mockApi(page, requests);
  await open(page, "customerLegacy");
  await expect(page.getByTestId("generic-not-found")).toBeVisible();
  expect(requests).toContain("GET /api/v1/employees/cmcustomer00000000000000001");
  assertNoLegacyOrFinance(requests);
});

async function open(page: Page, scenario: string) {
  await page.route("**/employees-harness.html*", (route) => route.fulfill({ contentType: "text/html", body: `<!doctype html><html><body><div id="root"></div><script type="module">import RefreshRuntime from "/@react-refresh";RefreshRuntime.injectIntoGlobalHook(window);window.$RefreshReg$=()=>{};window.$RefreshSig$=()=>type=>type;window.__vite_plugin_react_preamble_installed__=true;</script><script type="module" src="/tests/employees-harness.tsx"></script></body></html>` }));
  await page.goto(`/employees-harness.html?scenario=${scenario}`);
}

async function mockApi(page: Page, requests: string[], custom?: (route: Route) => Promise<boolean>) {
  await page.route(/^https?:\/\/[^/]+\/api(?:\/|$)/u, async (route) => {
    const request = route.request(); const path = new URL(request.url()).pathname; requests.push(`${request.method()} ${path}`);
    if (custom && await custom(route)) return;
    if (path === "/api/v1/employees/options/staff-groups") { await route.fulfill({ json: groups }); return; }
    if (path === "/api/v1/devices" && request.method() === "GET") {
      await route.fulfill({ json: [{ id: DEVICE_ID, name: "Front desk K40", type: "FINGERPRINT", connectionType: "NETWORK", enabled: true, status: "ONLINE", config: { ip: "192.168.1.200", port: 4370 } }] }); return;
    }
    if (path === "/api/v1/employees" && request.method() === "GET") { await route.fulfill({ json: { items: [employee], total: 1, skip: 0, take: 20 } }); return; }
    if (path === `/api/v1/employees/${ID}/attendance`) { await route.fulfill({ json: [] }); return; }
    if (path === `/api/v1/employees/${ID}`) { await route.fulfill({ json: employee }); return; }
    if (path === "/api/v1/employees/cmcustomer00000000000000001" || path.endsWith("/cmcustomer00000000000000001/attendance")) {
      await route.fulfill({ status: 404, json: { message: "Employee not found" } }); return;
    }
    await route.fulfill({ status: 404, json: { message: "Route not found" } });
  });
}

function assertNoLegacyOrFinance(requests: string[]) {
  const forbidden = requests.filter((request) => /\/api\/v1\/(?:members|membership|payments|payroll|expenses)(?:\/|$)/u.test(request));
  expect(forbidden).toEqual([]);
}

async function chooseDropdown(page: Page, label: string, value: string) {
  await page.getByLabel(label, { exact: true }).click();
  await page.locator(`[role="option"][data-value="${value}"]`).click();
}

async function chooseFinger(page: Page, label: string) {
  await page.getByRole("button", { name: "Choose finger" }).click();
  await page.getByRole("button", { name: label }).click();
}
