import { expect, test, type Page, type Route } from "@playwright/test";

const DEVICE_ID = "cmdevice00000000000000001";
const EMPLOYEE_ID = "cmemployee00000000000000001";
const employee = {
  id: EMPLOYEE_ID,
  code: "1",
  memberType: "STAFF",
  isStaff: true,
  firstName: "Eraj",
  lastName: "Naseri",
  status: "ACTIVE",
};
const device = {
  id: DEVICE_ID,
  name: "Front K40",
  type: "FINGERPRINT",
  connectionType: "NETWORK",
  enabled: true,
  status: "ONLINE",
  model: "K40",
  serialNumber: "K40-1",
  config: { ip: "192.168.1.200", port: 4370, eventMode: "PULL", pushEnabled: false },
  lastSuccessfulPollAt: "2026-08-24T08:00:00.000Z",
  lastEventReceivedAt: "2026-08-24T08:01:00.000Z",
};

test("viewer sees K40 Pull status and test only", async ({ page }) => {
  const requests: string[] = [];
  await mockApi(page, requests);
  await open(page, "viewer");
  await expect(page.getByTestId("staff-devices")).toBeVisible();
  await expect(page.getByText("Front K40")).toBeVisible();
  await expect(page.getByText(/192\.168\.1\.200:4370/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Add device" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Edit" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Employee tools" })).toHaveCount(0);
  await page.getByRole("button", { name: "Test connection" }).click();
  await expect.poll(() => requests).toContain(`POST /api/v1/devices/${DEVICE_ID}/test-connection`);
  assertCoreOnly(requests);
});

test("owner create is forced to fingerprint network Pull mode", async ({ page }) => {
  const requests: string[] = [];
  let created: Record<string, unknown> | null = null;
  await mockApi(page, requests, async (route) => {
    const request = route.request();
    if (request.method() === "POST" && new URL(request.url()).pathname === "/api/v1/devices") {
      created = request.postDataJSON();
      await route.fulfill({ status: 201, json: { ...device, ...created } });
      return true;
    }
    return false;
  });
  await open(page, "owner");
  await page.getByRole("button", { name: "Add device" }).click();
  await page.getByLabel("Name").fill("Office K40");
  await page.getByRole("button", { name: "Save" }).click();
  await expect.poll(() => created).not.toBeNull();
  expect(created?.type).toBe("FINGERPRINT");
  expect(created?.connectionType).toBe("NETWORK");
  expect(created?.config).toMatchObject({ eventMode: "PULL", pushEnabled: false, port: 4370 });
  expect(JSON.stringify(created)).not.toMatch(/customer|membership|payment|diagnos|unlock|pushEnabled":true/iu);
  assertCoreOnly(requests);
});

test("employee device commands use the selected Staff code and confirmed delete", async ({ page }) => {
  const requests: string[] = [];
  const commands: Array<{ path: string; body: Record<string, unknown> }> = [];
  await mockApi(page, requests, async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (request.method() === "POST" && /\/(?:upsert|delete|enroll)$/u.test(path)) {
      commands.push({ path, body: request.postDataJSON() });
      await route.fulfill({ json: { ok: true, employeeId: EMPLOYEE_ID } });
      return true;
    }
    return false;
  });
  await open(page, "owner");
  await page.getByRole("button", { name: "Employee tools" }).click();
  await chooseDropdown(page, "Select an employee", EMPLOYEE_ID);
  await page.getByRole("button", { name: "Create/update user" }).click();
  await expect.poll(() => commands.length).toBe(1);
  await page.getByRole("button", { name: "Enroll fingerprint" }).click();
  await expect.poll(() => commands.length).toBe(2);
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Delete user" }).click();
  await expect.poll(() => commands.length).toBe(3);
  expect(commands.map((command) => command.body.userId)).toEqual(["1", "1", "1"]);
  expect(commands[0]?.body.name).toBe("Eraj Naseri");
  expect(commands[1]?.body.fingerId).toBe(0);
  expect(commands[2]?.body.confirm).toBe(true);
  expect(JSON.stringify(commands)).not.toMatch(/customer|memberType|membership|payment/iu);
  assertCoreOnly(requests);
});

test("Attendance device surface does not expose optional advanced operations", async ({ page }) => {
  const requests: string[] = [];
  await mockApi(page, requests);
  await open(page, "owner");
  for (const label of ["Diagnostics", "Raw logs", "Network scan", "Clear logs", "Unlock door", "Push test"]) {
    await expect(page.getByText(label, { exact: true })).toHaveCount(0);
  }
  assertCoreOnly(requests);
});

async function open(page: Page, profile: "owner" | "viewer") {
  await page.route("**/device-edition-harness.html*", (route) => route.fulfill({
    contentType: "text/html; charset=utf-8",
    body: "<!doctype html><html><head><meta charset=\"UTF-8\" /></head><body><div id=\"root\"></div><script type=\"module\">import RefreshRuntime from '/@react-refresh';RefreshRuntime.injectIntoGlobalHook(window);window.$RefreshReg$=()=>{};window.$RefreshSig$=()=>type=>type;window.__vite_plugin_react_preamble_installed__=true;</script><script type=\"module\" src=\"/tests/device-edition-harness.tsx\"></script></body></html>",
  }));
  await page.goto(`/device-edition-harness.html?profile=${profile}`);
}

async function chooseDropdown(page: Page, label: string, value: string) {
  await page.getByLabel(label, { exact: true }).click();
  await page.locator(`[role="option"][data-value="${value}"]`).click();
}

async function mockApi(
  page: Page,
  requests: string[],
  custom?: (route: Route) => Promise<boolean>
) {
  await page.route(/^https?:\/\/[^/]+\/api(?:\/|$)/u, async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    requests.push(`${request.method()} ${url.pathname}${url.search}`);
    if (custom && await custom(route)) return;
    if (url.pathname === "/api/v1/employees") {
      await route.fulfill({ json: { items: [employee], total: 1, skip: 0, take: 100 } });
      return;
    }
    if (url.pathname === "/api/v1/devices/status") {
      await route.fulfill({ json: { devices: [{ id: DEVICE_ID, connected: true, lastPollAt: device.lastSuccessfulPollAt, lastEventAt: device.lastEventReceivedAt }] } });
      return;
    }
    if (url.pathname === "/api/v1/devices/events") {
      await route.fulfill({ json: { items: [{ id: "event-1", authorized: true, attendanceRecorded: true, memberName: "Eraj Naseri", memberCode: "1", entryType: "IN" }] } });
      return;
    }
    if (url.pathname === "/api/v1/devices") {
      await route.fulfill({ json: request.method() === "GET" ? [device] : device });
      return;
    }
    if (url.pathname === `/api/v1/devices/${DEVICE_ID}/users`) {
      await route.fulfill({ json: { items: [{ userId: "1", name: "Eraj Naseri" }] } });
      return;
    }
    if (url.pathname.endsWith("/users/sync")) {
      await route.fulfill({ json: { total: 1, synced: 1, skipped: 0 } });
      return;
    }
    if (url.pathname.endsWith("/time")) {
      await route.fulfill({ json: { time: "2026-08-24T08:00:00.000Z" } });
      return;
    }
    await route.fulfill({ json: { ok: true, status: "ONLINE" } });
  });
}

function assertCoreOnly(requests: string[]) {
  expect(requests.some((request) => /\/api\/v1\/(?:members|memberships|payments|payroll|expenses)(?:\/|\?|$)/u.test(request))).toBe(false);
  expect(requests.some((request) => /\/api\/v1\/devices\/(?:raw-logs|scan|push-test|events\/push)(?:\/|\?|$)/u.test(request))).toBe(false);
  expect(requests.some((request) => /\/api\/v1\/devices\/[^/?]+\/(?:diagnose|scan|logs|unlock)(?:\/|\?|$)/u.test(request))).toBe(false);
}
