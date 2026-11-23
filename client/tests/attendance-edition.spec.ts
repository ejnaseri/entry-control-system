import { expect, test, type Page, type Route } from "@playwright/test";

const EMPLOYEE_ID = "cmemployee00000000000000001";
const GROUP_ID = "cmstaffgroup0000000000000001";
const SHIFT_ID = "cmshift00000000000000000001";
const DEVICE_ID = "cmdevice0000000000000000001";
const employee = { id: EMPLOYEE_ID, code: "1", memberType: "STAFF", isStaff: true, firstName: "Eraj", lastName: "Naseri", phone: "0700000000", photoUrl: null, status: "ACTIVE", roleType: "EMPLOYEE", customTitle: null, staffGroupId: GROUP_ID, staffGroup: { id: GROUP_ID, name: "Day" }, archivedAt: null, createdAt: "2026-08-23T08:00:00.000Z", updatedAt: "2026-08-23T08:00:00.000Z" };
const groups = [{ id: GROUP_ID, name: "Day", description: null, accessLevel: null, shifts: [{ id: SHIFT_ID, shiftName: "Morning", shiftStart: "08:00", shiftEnd: "16:00", weekdays: [1,2,3,4,5], graceMinutes: 5, earlyAccessMinutes: 15, isActive: true }] }];
const daily = { date: "2026-08-24", summary: { present: 1, absent: 0, late: 1, inside: 1, justified: 0, unscheduledPresentCount: 1, deniedCount: 2 }, warnings: { noCheckout: 1, noShift: 1, multipleEvents: 1 }, rows: [{ memberId: EMPLOYEE_ID, memberCode: "1", memberFullName: "Eraj Naseri", memberPhone: "0700000000", staffGroupId: GROUP_ID, staffGroupName: "Day", shiftId: SHIFT_ID, shiftName: "Morning", shiftStart: "08:00", shiftEnd: "16:00", graceMinutes: 5, status: "LATE", checkInAt: "2026-08-24T04:00:00.000Z", checkOutAt: null, lateMinutes: 10, earlyMinutes: 0, earlyLeaveMinutes: null, overtimeMinutes: null, durationMinutes: null, confirmedDurationMinutes: 0, hasOpenSession: true, openSessionSince: "2026-08-24T04:00:00.000Z", liveDurationMinutes: 60, lastEventType: "IN", deviceName: "Front gate", warnings: ["NO_CHECKOUT", "MULTIPLE_EVENTS"], isJustified: false, justificationReason: null, hasShift: true }] };
const logs = { items: [{ id: "cmlog000000000000000000001", createdAt: "2026-08-24T04:00:01.000Z", recordedAt: "2026-08-24T04:00:00.000Z", memberId: EMPLOYEE_ID, memberCode: "1", memberFullName: "Eraj Naseri", memberType: "STAFF", memberStatus: "ACTIVE", memberPhone: "0700000000", memberRole: "EMPLOYEE", memberTitle: null, deviceId: DEVICE_ID, deviceName: "Front gate", eventType: "IN", source: "DEVICE", isAuthorized: true, reason: null }], page: 1, pageSize: 20, total: 1, summary: { totalIn: 1, totalOut: 0, uniqueVisitors: 1, deniedAttempts: 0 } };

test("daily attendance renders operational Staff metrics without export or excluded requests", async ({ page }) => {
  const requests: string[] = []; await mockApi(page, requests); await open(page, "daily");
  await expect(page.getByTestId("staff-daily-attendance")).toBeVisible();
  await expect(page.getByText("Eraj Naseri")).toBeVisible();
  await expect(page.getByTestId("attendance-daily-metrics")).toContainText("No scheduled shift");
  await expect(page.getByRole("button", { name: /export|csv/i })).toHaveCount(0);
  expect(requests.some((value) => value.startsWith("GET /api/v1/attendance/daily?"))).toBe(true);
  assertSafeRequests(requests);
});

test("daily filters send Staff group, shift, mode, and employee search only", async ({ page }) => {
  const requests: string[] = []; await mockApi(page, requests); await open(page, "daily");
  await chooseDropdown(page, "Staff group", GROUP_ID);
  await chooseDropdown(page, "Shift mode", "all");
  await chooseDropdown(page, "Shift", SHIFT_ID);
  await page.getByLabel("Search employees").fill("Eraj");
  await expect.poll(() => requests.findLast((value) => value.startsWith("GET /api/v1/attendance/daily?")) ?? "").toContain("search=Eraj");
  const latest = requests.findLast((value) => value.startsWith("GET /api/v1/attendance/daily?")) ?? "";
  expect(latest).toContain(`shiftId=${SHIFT_ID}`); expect(latest).toContain("mode=all"); expect(latest).toContain("search=Eraj");
  assertSafeRequests(requests);
});

test("entry logs expose Staff filters and complete server-side CSV/XLSX exports", async ({ page }) => {
  const requests: string[] = []; await mockApi(page, requests); await open(page, "logs");
  await expect(page.getByTestId("staff-entry-logs")).toBeVisible(); await expect(page.getByRole("cell", { name: "Eraj Naseri" })).toBeVisible();
  await chooseDropdown(page, "Employee", EMPLOYEE_ID); await chooseDropdown(page, "Device", DEVICE_ID);
  await chooseDropdown(page, "Result", "DENIED"); await chooseDropdown(page, "Event", "OUT");
  await expect.poll(() => requests.findLast((value) => value.startsWith("GET /api/v1/attendance?")) ?? "").toContain("eventType=OUT");
  const latest = requests.findLast((value) => value.startsWith("GET /api/v1/attendance?")) ?? "";
  expect(latest).toContain(`memberId=${EMPLOYEE_ID}`); expect(latest).toContain(`deviceId=${DEVICE_ID}`); expect(latest).toContain("eventType=OUT");
  await page.getByTestId("entry-logs-export-csv").click();
  await page.getByTestId("entry-logs-export-xlsx").click();
  await expect.poll(() => requests.filter((value) => value.includes("/api/v1/attendance/export.")).length).toBe(2);
  const exports = requests.filter((value) => value.includes("/api/v1/attendance/export."));
  expect(exports.every((value) => value.includes(`memberId=${EMPLOYEE_ID}`) && value.includes(`deviceId=${DEVICE_ID}`))).toBe(true);
  expect(exports.every((value) => !/page=|pageSize=|memberType=/u.test(value))).toBe(true);
  assertSafeRequests(requests);
});

test("manual IN/OUT sends only an Employee identifier and attendance fields", async ({ page }) => {
  const requests: string[] = []; let body: Record<string, unknown> | null = null;
  await mockApi(page, requests, async (route) => { if (route.request().method() === "POST" && new URL(route.request().url()).pathname === "/api/v1/attendance/manual") { body = route.request().postDataJSON(); await route.fulfill({ status: 201, json: logs.items[0] }); return true; } return false; });
  await open(page, "logs"); await page.getByRole("button", { name: "Manual entry" }).click();
  await chooseDropdown(page, "Search and select an employee", EMPLOYEE_ID); await chooseDropdown(page, "Event", "OUT", 1);
  await page.getByRole("button", { name: "Submit" }).click();
  await expect.poll(() => body).not.toBeNull(); expect(body?.memberId).toBe(EMPLOYEE_ID); expect(body?.eventType).toBe("OUT");
  for (const forbidden of ["memberType", "customerId", "membershipId", "paymentId", "salaryAmount"]) expect(JSON.stringify(body)).not.toContain(`"${forbidden}"`);
  assertSafeRequests(requests);
});

test("daily justification create and remove stay on the Staff attendance contract", async ({ page }) => {
  const requests: string[] = []; let posted: Record<string, unknown> | null = null; let deleted = ""; let justified = false;
  await mockApi(page, requests, async (route) => {
    const request = route.request(); const url = new URL(request.url());
    if (url.pathname === "/api/v1/attendance/daily") { await route.fulfill({ json: { ...daily, rows: daily.rows.map((row) => ({ ...row, isJustified: justified, justificationReason: justified ? "Approved leave" : null })) } }); return true; }
    if (url.pathname === "/api/v1/attendance/justifications" && request.method() === "POST") { posted = request.postDataJSON(); justified = true; await route.fulfill({ status: 201, json: { id: "justification-1" } }); return true; }
    if (url.pathname === "/api/v1/attendance/justifications" && request.method() === "DELETE") { deleted = url.search; justified = false; await route.fulfill({ status: 204 }); return true; }
    return false;
  });
  await open(page, "daily"); await page.getByRole("button", { name: "Justification" }).click();
  await page.getByLabel("Reason").fill("Approved leave"); await page.getByRole("button", { name: "Save" }).click();
  await expect.poll(() => posted).not.toBeNull(); expect(posted?.memberId).toBe(EMPLOYEE_ID); expect(posted?.reason).toBe("Approved leave");
  await page.getByRole("button", { name: "Details" }).click(); await page.getByRole("button", { name: "Remove" }).click();
  await expect.poll(() => deleted).toContain(`memberId=${EMPLOYEE_ID}`); expect(deleted).toContain("date="); assertSafeRequests(requests);
});

async function open(page: Page, scenario: "daily" | "logs") {
  await page.route("**/attendance-edition-harness.html*", (route) => route.fulfill({ contentType: "text/html; charset=utf-8", body: `<!doctype html><html><head><meta charset="UTF-8" /></head><body><div id="root"></div><script type="module">import RefreshRuntime from "/@react-refresh";RefreshRuntime.injectIntoGlobalHook(window);window.$RefreshReg$=()=>{};window.$RefreshSig$=()=>type=>type;window.__vite_plugin_react_preamble_installed__=true;</script><script type="module" src="/tests/attendance-edition-harness.tsx"></script></body></html>` }));
  await page.goto(`/attendance-edition-harness.html?scenario=${scenario}`);
}

async function chooseDropdown(page: Page, label: string, value: string, index = 0) {
  await page.getByLabel(label, { exact: true }).nth(index).click();
  await page.locator(`[role="option"][data-value="${value}"]`).click();
}

async function mockApi(page: Page, requests: string[], custom?: (route: Route) => Promise<boolean>) {
  await page.route(/^https?:\/\/[^/]+\/api(?:\/|$)/u, async (route) => { const request = route.request(); const url = new URL(request.url()); requests.push(`${request.method()} ${url.pathname}${url.search}`); if (custom && await custom(route)) return;
    if (url.pathname === "/api/v1/employees/options/staff-groups") { await route.fulfill({ json: groups }); return; }
    if (url.pathname === "/api/v1/employees") { await route.fulfill({ json: { items: [employee], total: 1, skip: 0, take: 100 } }); return; }
    if (url.pathname === "/api/v1/attendance/options/devices") { await route.fulfill({ json: [{ id: DEVICE_ID, name: "Front gate" }] }); return; }
    if (url.pathname === "/api/v1/attendance/daily") { await route.fulfill({ json: daily }); return; }
    if (url.pathname === "/api/v1/attendance/justifications") { await route.fulfill({ status: request.method() === "DELETE" ? 204 : 201, json: request.method() === "DELETE" ? undefined : { id: "justification-1" } }); return; }
    if (/^\/api\/v1\/attendance\/export\.(?:csv|xlsx)$/u.test(url.pathname)) { await route.fulfill({ body: "entry-export", contentType: "application/octet-stream" }); return; }
    if (url.pathname === "/api/v1/attendance") { await route.fulfill({ json: logs }); return; }
    await route.fulfill({ status: 404, json: { message: "Route not found" } });
  });
}

function assertSafeRequests(requests: string[]) {
  expect(requests.filter((request) => /\/api\/v1\/(?:members|membership|payments|payroll|expenses)(?:\/|\?|$)/u.test(request))).toEqual([]);
  expect(requests.some((request) => /(?:\?|&)memberType=/u.test(request))).toBe(false);
}
