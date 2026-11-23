import { expect, test, type Page, type Route } from "@playwright/test";
import { FULL_TEST_IDENTITY } from "./auth-fixtures";

const NOW = "2026-08-24T08:00:00.000Z";
const EXPIRES_AT = "2026-08-24T20:00:00.000Z";
const EMPLOYEE_ID = "cmemployee00000000000000001";
const DEVICE_ID = "cmdevice000000000000000001";
const DESKTOP_VIEWPORT = { width: 1440, height: 900 } as const;
const MOBILE_VIEWPORT = { width: 390, height: 844 } as const;

test.use({ timezoneId: "Asia/Kabul" });

test("Attendance entry logs — desktop dark LTR", async ({ page }) => {
  await openEntryLogs(page, { viewport: DESKTOP_VIEWPORT, language: "en", theme: "dark" });
  await expect(page).toHaveScreenshot("attendance-entry-logs-desktop-dark-ltr.png", screenshotOptions());
});

test("Attendance entry logs — desktop light RTL", async ({ page }) => {
  await openEntryLogs(page, { viewport: DESKTOP_VIEWPORT, language: "fa", theme: "light" });
  await expect(page.locator(".dashboard-shell")).toHaveAttribute("dir", "rtl");
  await expect(page).toHaveScreenshot("attendance-entry-logs-desktop-light-rtl.png", screenshotOptions());
});

test("Attendance entry logs — mobile dark table", async ({ page }) => {
  await openEntryLogs(page, { viewport: MOBILE_VIEWPORT, language: "en", theme: "dark" });
  await page.getByRole("button", { name: "Hide filters" }).click();
  await page.getByTestId("entry-logs-table").scrollIntoViewIfNeeded();
  await expect(page.locator("aside")).toBeHidden();
  await expect(page).toHaveScreenshot("attendance-entry-logs-mobile-dark-table.png", screenshotOptions());
});

test("Attendance entry logs — empty rows", async ({ page }) => {
  await openEntryLogs(page, { viewport: DESKTOP_VIEWPORT, language: "en", theme: "dark", scenario: "empty" });
  await expect(page.getByText("No entry logs found.")).toBeVisible();
  await expect(page).toHaveScreenshot("attendance-entry-logs-empty.png", screenshotOptions());
});

test("Attendance entry logs — error retries on the same Staff endpoints", async ({ page }) => {
  const state = await openEntryLogs(page, { viewport: DESKTOP_VIEWPORT, language: "en", theme: "dark", scenario: "error-once" });
  const error = page.getByTestId("entry-logs-error");
  await expect(error).toBeVisible();
  await expect(page).toHaveScreenshot("attendance-entry-logs-error.png", screenshotOptions());
  await error.getByRole("button", { name: "Retry" }).click();
  await expect(page.getByTestId("entry-log-row").first().getByText("Eraj Naseri", { exact: true })).toBeVisible();
  expect(new Set(state.businessRequests.map(stripQuery))).toEqual(new Set([
    "GET /api/v1/attendance",
    "GET /api/v1/attendance/options/devices",
    "GET /api/v1/employees",
  ]));
});

test("Attendance entry logs — deterministic loading state", async ({ page }) => {
  const state = await openEntryLogs(page, { viewport: DESKTOP_VIEWPORT, language: "en", theme: "dark", scenario: "loading" });
  await expect(page.getByTestId("entry-logs-table").locator(".app-table-skeleton").first()).toBeVisible();
  await expect(page).toHaveScreenshot("attendance-entry-logs-loading.png", screenshotOptions());
  state.releaseLogs?.();
  await expect(page.getByTestId("entry-log-row").first().getByText("Eraj Naseri", { exact: true })).toBeVisible();
  expect(state.businessRequests.every((request) => /\/api\/v1\/(?:attendance(?:\/options\/devices)?|employees)/u.test(request))).toBe(true);
});

test("Attendance entry logs — manual entry modal", async ({ page }) => {
  await openEntryLogs(page, { viewport: DESKTOP_VIEWPORT, language: "en", theme: "dark" });
  await page.getByRole("button", { name: "Manual entry" }).click();
  await expect(page.getByTestId("staff-entry-logs-manual-modal")).toBeVisible();
  await expect(page).toHaveScreenshot("attendance-entry-logs-manual-modal.png", screenshotOptions());
});

type EntryLogsOptions = Readonly<{
  viewport: Readonly<{ width: number; height: number }>;
  language: "en" | "fa";
  theme: "dark" | "light";
  scenario?: "normal" | "empty" | "error-once" | "loading";
}>;

async function openEntryLogs(page: Page, options: EntryLogsOptions) {
  const scenario = options.scenario ?? "normal";
  const businessRequests: string[] = [];
  let attendanceRequests = 0;
  let releaseLogs: (() => void) | undefined;
  const logsGate = scenario === "loading" ? new Promise<void>((resolve) => { releaseLogs = resolve; }) : null;

  await page.clock.setFixedTime(new Date(NOW));
  await page.setViewportSize(options.viewport);
  await page.emulateMedia({ colorScheme: options.theme, reducedMotion: "reduce" });
  await page.addInitScript(
    ({ language, theme }) => {
      localStorage.setItem("i18nextLng", language);
      localStorage.setItem("ecs-theme", theme);
    },
    { language: options.language, theme: options.theme },
  );
  await page.route(/^https?:\/\/[^/]+\/api(?:\/|$)/u, async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.pathname === "/api") {
      await route.fulfill({ json: { ...FULL_TEST_IDENTITY, edition: "ATTENDANCE" } });
      return;
    }
    if (url.pathname === "/api/v1/auth/setup-status") {
      await route.fulfill({ json: { setupRequired: false, activeAdminCount: 1, hasGymOwner: true, hasVendorOwner: false } });
      return;
    }
    if (url.pathname === "/api/v1/auth/me") {
      await route.fulfill({ json: authPayload() });
      return;
    }
    if (url.pathname === "/api/v1/attendance/options/devices") {
      businessRequests.push(`${request.method()} ${url.pathname}${url.search}`);
      await route.fulfill({ json: [{ id: DEVICE_ID, name: "Front gate" }, { id: "device-2", name: "Staff entrance" }] });
      return;
    }
    if (url.pathname === "/api/v1/employees" && request.method() === "GET") {
      businessRequests.push(`${request.method()} ${url.pathname}${url.search}`);
      await route.fulfill({ json: { items: [employee()], total: 1, skip: 0, take: 100 } });
      return;
    }
    if (url.pathname === "/api/v1/attendance" && request.method() === "GET") {
      attendanceRequests += 1;
      businessRequests.push(`${request.method()} ${url.pathname}${url.search}`);
      if (scenario === "error-once" && attendanceRequests <= 2) {
        await route.fulfill({ status: 500, json: { message: "Entry logs unavailable" } });
        return;
      }
      if (logsGate) await logsGate;
      await route.fulfill({ json: scenario === "empty" ? emptyLogsResponse() : logsResponse() });
      return;
    }
    if (url.pathname === "/api/v1/attendance/manual" && request.method() === "POST") {
      businessRequests.push(`${request.method()} ${url.pathname}${url.search}`);
      await route.fulfill({ status: 201, json: logsResponse().items[0] });
      return;
    }
    if (url.pathname === "/api/v1/attendance/export.csv" || url.pathname === "/api/v1/attendance/export.xlsx") {
      businessRequests.push(`${request.method()} ${url.pathname}${url.search}`);
      await route.fulfill({ status: 200, body: "export" });
      return;
    }
    await fulfillNotFound(route);
  });

  await page.goto("/entry-logs", { waitUntil: "domcontentloaded" });
  if (scenario === "loading") {
    await expect(page.getByTestId("entry-logs-table").locator(".app-table-skeleton").first()).toBeVisible();
  } else if (scenario === "error-once") {
    await expect(page.getByTestId("entry-logs-error")).toBeVisible();
  } else {
    await expect(page.getByTestId("entry-logs-table")).toBeVisible();
    if (scenario === "normal") await expect(page.getByTestId("entry-log-row").first().getByText("Eraj Naseri", { exact: true })).toBeVisible();
  }
  await settleVisuals(page);

  return { businessRequests, releaseLogs };
}

async function fulfillNotFound(route: Route) {
  await route.fulfill({ status: 404, json: { message: "Route not found" } });
}

async function settleVisuals(page: Page) {
  await page.addStyleTag({
    content: `
      *, *::before, *::after {
        animation-delay: 0s !important;
        animation-duration: 0s !important;
        caret-color: transparent !important;
        scroll-behavior: auto !important;
        transition-delay: 0s !important;
        transition-duration: 0s !important;
      }
    `,
  });
  await page.evaluate(async () => { await document.fonts.ready; });
}

function stripQuery(request: string) {
  return request.replace(/\?.*$/u, "");
}

function authPayload() {
  return {
    edition: "ATTENDANCE",
    features: ["ADMIN_USERS", "ATTENDANCE_DAILY", "ATTENDANCE_DASHBOARD", "ATTENDANCE_EXPORT", "ATTENDANCE_REPORTS", "AUDIT_LOGS", "AUTH", "BACKUPS", "DEVICES", "EMPLOYEES", "ENTRY_LOGS"],
    permissions: ["SIGN_IN", "ADMIN_USERS_MANAGE", "ROLES_MANAGE", "MEMBERS_VIEW", "MEMBERS_WRITE", "ATTENDANCE_VIEW", "ATTENDANCE_EXPORT", "ATTENDANCE_MANUAL", "ATTENDANCE_JUSTIFY", "DEVICES_VIEW", "DEVICES_DIAGNOSTICS", "DEVICES_USER_SYNC", "DEVICES_ENROLL", "DEVICES_CLEAR_LOGS", "DOOR_UNLOCK", "BACKUP_CREATE", "BACKUP_SETTINGS_MANAGE", "AUDIT_LOG_VIEW", "SYSTEM_SETTINGS_MANAGE"],
    user: {
      id: "admin-1", username: "owner", email: null, fullName: "Attendance Owner", role: "GYM_OWNER",
      isActive: true, isProtected: false, deactivatedAt: null, lastLoginAt: NOW, passwordChangedAt: NOW, createdAt: NOW, updatedAt: NOW,
    },
    session: { id: "session-1", createdAt: NOW, lastSeenAt: NOW, expiresAt: EXPIRES_AT },
    expiresAt: EXPIRES_AT,
  };
}

function employee() {
  return {
    id: EMPLOYEE_ID,
    code: "1042",
    memberType: "STAFF",
    isStaff: true,
    firstName: "Eraj",
    lastName: "Naseri",
    phone: "0700 000 000",
    photoUrl: null,
    status: "ACTIVE",
    roleType: "EMPLOYEE",
    customTitle: "Reception officer",
    staffGroupId: null,
    staffGroup: null,
    archivedAt: null,
    createdAt: "2026-08-23T08:00:00.000Z",
    updatedAt: "2026-08-23T08:00:00.000Z",
  };
}

function logsResponse() {
  return {
    items: [
      entryLog({ id: "log-1", recordedAt: "2026-08-24T03:40:00.000Z", memberFullName: "Eraj Naseri", memberCode: "1042", eventType: "IN", source: "DEVICE", deviceName: "Front gate", isAuthorized: true }),
      entryLog({ id: "log-2", recordedAt: "2026-08-24T05:15:00.000Z", memberId: "employee-2", memberFullName: "Laila Ahmadi", memberCode: "1055", eventType: "OUT", source: "MANUAL", deviceId: null, deviceName: null, isAuthorized: true, reason: "Supervisor correction" }),
      entryLog({ id: "log-3", recordedAt: "2026-08-24T06:05:00.000Z", memberId: "employee-3", memberFullName: "Farid Rahimi", memberCode: "1071", eventType: "IN", source: "DEVICE", deviceName: "Staff entrance", isAuthorized: false, reason: "Outside assigned schedule" }),
      entryLog({ id: "log-4", recordedAt: "2026-08-24T06:42:00.000Z", memberId: "employee-4", memberFullName: "Mina Safi", memberCode: "1090", eventType: "OUT", source: "API", deviceId: null, deviceName: null, isAuthorized: true }),
    ],
    page: 1,
    pageSize: 20,
    total: 4,
    summary: { totalIn: 2, totalOut: 2, uniqueVisitors: 4, deniedAttempts: 1 },
  };
}

function emptyLogsResponse() {
  return { items: [], page: 1, pageSize: 20, total: 0, summary: { totalIn: 0, totalOut: 0, uniqueVisitors: 0, deniedAttempts: 0 } };
}

function entryLog(overrides: Record<string, unknown>) {
  return {
    id: "log-1",
    createdAt: "2026-08-24T03:40:00.000Z",
    recordedAt: "2026-08-24T03:40:00.000Z",
    memberId: EMPLOYEE_ID,
    memberCode: "1042",
    memberFullName: "Eraj Naseri",
    memberType: "STAFF",
    memberStatus: "ACTIVE",
    memberPhone: "0700 000 000",
    memberRole: "EMPLOYEE",
    memberTitle: "Reception officer",
    deviceId: DEVICE_ID,
    deviceName: "Front gate",
    eventType: "IN",
    source: "DEVICE",
    isAuthorized: true,
    reason: null,
    ...overrides,
  };
}

function screenshotOptions() {
  return { animations: "disabled" as const, caret: "hide" as const, fullPage: false, scale: "css" as const };
}
