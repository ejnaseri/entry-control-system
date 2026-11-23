import { expect, test, type Page, type Route } from "@playwright/test";
import { FULL_TEST_IDENTITY } from "./auth-fixtures";

const NOW = "2026-08-24T08:00:00.000Z";
const EXPIRES_AT = "2026-08-24T20:00:00.000Z";
const EMPLOYEE_ID = "cmemployee00000000000000001";
const DESKTOP_VIEWPORT = { width: 1440, height: 900 } as const;
const MOBILE_VIEWPORT = { width: 390, height: 844 } as const;

test.use({ timezoneId: "Asia/Kabul" });

test("Attendance report — desktop dark filters", async ({ page }) => {
  await openReport(page, { path: "/reports/attendance", viewport: DESKTOP_VIEWPORT, language: "en", theme: "dark" });
  await page.getByRole("button", { name: "Show filters" }).click();
  await expect(page).toHaveScreenshot("attendance-report-desktop-dark-filters.png", screenshotOptions());
});

test("Attendance report — desktop light RTL", async ({ page }) => {
  await openReport(page, { path: "/reports/attendance", viewport: DESKTOP_VIEWPORT, language: "fa", theme: "light" });
  await expect(page.locator(".dashboard-shell")).toHaveAttribute("dir", "rtl");
  await expect(page).toHaveScreenshot("attendance-report-desktop-light-rtl.png", screenshotOptions());
});

test("Attendance report — mobile daily table", async ({ page }) => {
  await openReport(page, { path: "/reports/attendance", viewport: MOBILE_VIEWPORT, language: "en", theme: "dark" });
  const viewport = await page.evaluate(() => ({ innerWidth: window.innerWidth, scrollWidth: document.documentElement.scrollWidth }));
  expect(viewport.scrollWidth).toBeLessThanOrEqual(viewport.innerWidth);
  await page.getByTestId("attendance-report-tab-daily").scrollIntoViewIfNeeded();
  await expect(page.locator("aside")).toBeHidden();
  await expect(page).toHaveScreenshot("attendance-report-mobile-daily-table.png", screenshotOptions());
});

test("Attendance report — employees tab", async ({ page }) => {
  await openReport(page, { path: "/reports/attendance", viewport: DESKTOP_VIEWPORT, language: "en", theme: "dark" });
  await page.getByTestId("attendance-report-tab-employees").click();
  await expect(page.getByRole("cell", { name: /Eraj Naseri/u })).toBeVisible();
  await page.getByTestId("attendance-report-tab-employees").scrollIntoViewIfNeeded();
  await expect(page).toHaveScreenshot("attendance-report-employees-tab.png", screenshotOptions());
});

test("Attendance report — evidence tab", async ({ page }) => {
  await openReport(page, { path: "/reports/attendance", viewport: DESKTOP_VIEWPORT, language: "en", theme: "dark" });
  await page.getByTestId("attendance-report-tab-evidence").click();
  await expect(page.getByRole("cell", { name: "K40", exact: true }).first()).toBeVisible();
  await page.getByTestId("attendance-report-tab-evidence").scrollIntoViewIfNeeded();
  await expect(page).toHaveScreenshot("attendance-report-evidence-tab.png", screenshotOptions());
});

test("Attendance report — empty daily state", async ({ page }) => {
  await openReport(page, { path: "/reports/attendance", viewport: DESKTOP_VIEWPORT, language: "en", theme: "dark", scenario: "empty" });
  await expect(page.getByText("No data for selected filters.").first()).toBeVisible();
  await page.getByTestId("attendance-report-tab-daily").scrollIntoViewIfNeeded();
  await expect(page).toHaveScreenshot("attendance-report-empty.png", screenshotOptions());
});

test("Attendance report — error state stays on Staff report endpoints", async ({ page }) => {
  const state = await openReport(page, { path: "/reports/attendance", viewport: DESKTOP_VIEWPORT, language: "en", theme: "dark", scenario: "error" });
  await expect(page.getByTestId("attendance-report-error")).toBeVisible();
  await expect(page).toHaveScreenshot("attendance-report-error.png", screenshotOptions());
  expect(state.businessRequests.every(isAllowedReportRequest)).toBe(true);
});

test("Attendance report — deterministic loading state", async ({ page }) => {
  const state = await openReport(page, { path: "/reports/attendance", viewport: DESKTOP_VIEWPORT, language: "en", theme: "dark", scenario: "loading" });
  await expect(page.locator(".staff-attendance-report-workspace .app-table-skeleton").first()).toBeVisible();
  await expect(page).toHaveScreenshot("attendance-report-loading.png", screenshotOptions());
  state.releaseReport?.();
  await expect(page.getByText("2026-08-24", { exact: true }).first()).toBeVisible();
  expect(state.businessRequests.every(isAllowedReportRequest)).toBe(true);
});

test("Attendance monthly timecard — desktop table", async ({ page }) => {
  await openReport(page, { path: "/reports/attendance?tab=timecard&month=2026-08", viewport: DESKTOP_VIEWPORT, language: "en", theme: "dark" });
  await expect(page.getByTestId("monthly-timecard-row").first()).toContainText("Eraj Naseri");
  await page.getByTestId("attendance-report-tab-timecard").scrollIntoViewIfNeeded();
  await expect(page).toHaveScreenshot("attendance-report-timecard.png", screenshotOptions());
});

test("Attendance monthly timecard — expanded details", async ({ page }) => {
  await openReport(page, { path: "/reports/attendance?tab=timecard&month=2026-08", viewport: DESKTOP_VIEWPORT, language: "en", theme: "dark" });
  await page.getByTestId("monthly-timecard-expand").first().click();
  await expect(page.getByText("Daily details").first()).toBeVisible();
  await page.getByTestId("monthly-timecard-row").first().scrollIntoViewIfNeeded();
  await expect(page).toHaveScreenshot("attendance-report-timecard-expanded.png", screenshotOptions());
});

type ReportOptions = Readonly<{
  path: string;
  viewport: Readonly<{ width: number; height: number }>;
  language: "en" | "fa";
  theme: "dark" | "light";
  scenario?: "normal" | "empty" | "error" | "loading";
}>;

async function openReport(page: Page, options: ReportOptions) {
  const scenario = options.scenario ?? "normal";
  const businessRequests: string[] = [];
  let releaseReport: (() => void) | undefined;
  const reportGate = scenario === "loading" ? new Promise<void>((resolve) => { releaseReport = resolve; }) : null;

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
    if (url.pathname.startsWith("/api/v1/reports/attendance/")) {
      businessRequests.push(`${request.method()} ${url.pathname}${url.search}`);
    }
    if (url.pathname === "/api/v1/reports/attendance/options") {
      await route.fulfill({ json: reportOptions() });
      return;
    }
    if (url.pathname === "/api/v1/reports/attendance/summary") {
      if (scenario === "error") {
        await route.fulfill({ status: 500, json: { message: "Attendance report unavailable" } });
        return;
      }
      if (reportGate) await reportGate;
      await route.fulfill({ json: scenario === "empty" ? emptySummary() : reportSummary() });
      return;
    }
    if (url.pathname === "/api/v1/reports/attendance/daily") {
      if (reportGate) await reportGate;
      const items = scenario === "empty" ? [] : reportDays();
      await route.fulfill({ json: { items, pageInfo: pageInfo(items.length) } });
      return;
    }
    if (url.pathname === "/api/v1/reports/attendance/members") {
      const items = scenario === "empty" ? [] : reportEmployees();
      await route.fulfill({ json: { items, pageInfo: pageInfo(items.length) } });
      return;
    }
    if (url.pathname === "/api/v1/reports/attendance/evidence") {
      const items = scenario === "empty" ? [] : reportEvidence();
      await route.fulfill({ json: { items, pageInfo: pageInfo(items.length) } });
      return;
    }
    if (url.pathname === "/api/v1/reports/attendance/timecard") {
      await route.fulfill({ json: monthlyTimecard(scenario === "empty") });
      return;
    }
    if (/^\/api\/v1\/reports\/attendance\/(?:timecard\/)?export\.(?:csv|xlsx|pdf)$/u.test(url.pathname)) {
      await route.fulfill({ status: 200, body: "export" });
      return;
    }
    await fulfillNotFound(route);
  });

  await page.goto(options.path, { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("attendance-report")).toBeVisible();
  if (scenario === "loading") {
    await expect(page.locator(".staff-attendance-report-workspace .app-table-skeleton").first()).toBeVisible();
  } else if (scenario === "error") {
    await expect(page.getByTestId("attendance-report-error")).toBeVisible();
  } else if (options.path.includes("tab=timecard")) {
    await expect(page.getByTestId("monthly-timecard")).toBeVisible();
    await expect(page.getByTestId("monthly-timecard-month").locator("input")).not.toHaveAttribute("aria-busy", "true");
  } else {
    await expect(page.getByTestId("attendance-report-tab-daily")).toBeVisible();
  }
  await settleVisuals(page);

  return { businessRequests, releaseReport };
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

function isAllowedReportRequest(request: string) {
  return /^GET \/api\/v1\/reports\/attendance\/(?:options|summary|daily|members|evidence|timecard)(?:\?|$)/u.test(request);
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

function reportOptions() {
  return {
    employees: [{ id: EMPLOYEE_ID, code: "1042", name: "Eraj Naseri" }],
    groups: [{ id: "group-1", name: "Operations" }],
    shifts: [{ id: "shift-1", name: "Morning", start: "08:00", end: "16:00" }],
    devices: [{ id: "device-1", name: "K40 Front gate" }],
  };
}

function reportSummary() {
  return { range: { from: "2026-08-18", to: "2026-08-24" }, kpis: {
    presentDays: 31, absentDays: 4, lateCount: 6, lateMinutes: 75, earlyLeaveCount: 3,
    earlyLeaveMinutes: 35, overtimeMinutes: 145, justifiedCount: 2, unscheduledPresentCount: 1,
    deniedCount: 3, noCheckoutCount: 2,
  } };
}

function emptySummary() {
  return { range: { from: "2026-08-18", to: "2026-08-24" }, kpis: {
    presentDays: 0, absentDays: 0, lateCount: 0, lateMinutes: 0, earlyLeaveCount: 0,
    earlyLeaveMinutes: 0, overtimeMinutes: 0, justifiedCount: 0, unscheduledPresentCount: 0,
    deniedCount: 0, noCheckoutCount: 0,
  } };
}

function reportDays() {
  return Array.from({ length: 7 }, (_, index) => ({
    date: `2026-08-${String(18 + index).padStart(2, "0")}`,
    presentCount: 5 + (index % 3),
    absentCount: index % 3 === 0 ? 1 : 0,
    lateCount: index % 2,
    lateMinutes: index % 2 ? 10 + index : 0,
    earlyLeaveCount: index === 3 ? 1 : 0,
    earlyLeaveMinutes: index === 3 ? 12 : 0,
    overtimeMinutes: index * 5,
    justifiedCount: index === 1 ? 1 : 0,
    unscheduledPresentCount: index === 5 ? 1 : 0,
    deniedCount: index === 4 ? 2 : 0,
    noCheckoutCount: index === 6 ? 1 : 0,
  }));
}

function reportEmployees() {
  return [
    reportEmployee({ memberId: EMPLOYEE_ID, memberCode: "1042", memberName: "Eraj Naseri", presentDays: 18, absentDays: 2, lateMinutes: 25 }),
    reportEmployee({ memberId: "employee-2", memberCode: "1055", memberName: "Laila Ahmadi", presentDays: 20, absentDays: 0, lateMinutes: 0, deniedCount: 0, noCheckoutCount: 0 }),
    reportEmployee({ memberId: "employee-3", memberCode: "1071", memberName: "Farid Rahimi", presentDays: 16, absentDays: 4, lateMinutes: 45, deniedCount: 1 }),
  ];
}

function reportEmployee(overrides: Record<string, unknown>) {
  return {
    memberId: EMPLOYEE_ID, memberCode: "1042", memberName: "Eraj Naseri", memberType: "STAFF",
    expectedShifts: 20, presentDays: 18, absentDays: 2, lateCount: 3, lateMinutes: 25,
    earlyLeaveCount: 1, earlyLeaveMinutes: 10, overtimeMinutes: 45, justifiedCount: 1,
    unscheduledPresentCount: 1, deniedCount: 2, noCheckoutCount: 1,
    ...overrides,
  };
}

function reportEvidence() {
  return [
    evidence({ id: "log-1", timestamp: "2026-08-24T03:40:00.000Z", memberName: "Eraj Naseri", eventType: "IN", result: "authorized", authorized: true }),
    evidence({ id: "log-2", timestamp: "2026-08-24T05:30:00.000Z", memberId: "employee-2", memberName: "Laila Ahmadi", eventType: "OUT", source: "MANUAL", deviceId: null, deviceName: null, result: "authorized", authorized: true, notes: "Supervisor correction" }),
    evidence({ id: "log-3", timestamp: "2026-08-24T06:10:00.000Z", memberId: "employee-3", memberName: "Farid Rahimi", eventType: "DENIED", result: "denied", authorized: false, denyReason: "Outside assigned schedule" }),
  ];
}

function evidence(overrides: Record<string, unknown>) {
  return {
    id: "log-1", timestamp: NOW, memberId: EMPLOYEE_ID, memberName: "Eraj Naseri", memberType: "STAFF",
    eventType: "IN", deviceId: "device-1", deviceName: "K40", source: "DEVICE",
    authorized: true, result: "authorized", denyReason: null, notes: null, ...overrides,
  };
}

function monthlyTimecard(empty: boolean) {
  const items = empty ? [] : [
    timecard({ memberId: EMPLOYEE_ID, memberCode: "1042", memberName: "Eraj Naseri", staffGroupName: "Operations" }),
    timecard({ memberId: "employee-2", memberCode: "1055", memberName: "Laila Ahmadi", staffGroupName: "Front desk", totals: { ...timecardTotals(), scheduledMinutes: 960, actualMinutes: 945, pairedSessionCount: 2, presentDays: 2 } }),
  ];
  return { month: "2026-08", pageInfo: pageInfo(items.length), items };
}

function timecard(overrides: Record<string, unknown>) {
  return {
    memberId: EMPLOYEE_ID, memberCode: "1042", memberName: "Eraj Naseri", staffGroupId: "group-1", staffGroupName: "Operations",
    totals: timecardTotals(),
    days: [
      timecardDay({ date: "2026-08-22", status: "PRESENT", actualMinutes: 480, lateMinutes: 0 }),
      timecardDay({ date: "2026-08-23", status: "LATE", actualMinutes: 450, lateMinutes: 10 }),
      timecardDay({ date: "2026-08-24", status: "INSIDE", actualMinutes: 240, pairedSessionCount: 0, checkOutAt: null, missingPunch: true }),
    ],
    ...overrides,
  };
}

function timecardTotals() {
  return { scheduledMinutes: 1440, actualMinutes: 1170, pairedSessionCount: 2, presentDays: 3, absentDays: 0, justifiedDays: 0, lateMinutes: 10, earlyLeaveMinutes: 0, overtimeMinutes: 0, missingPunchDays: 1, invalidPunchDays: 0, unscheduledDays: 0 };
}

function timecardDay(overrides: Record<string, unknown>) {
  return { date: "2026-08-24", status: "PRESENT", shiftName: "Morning", scheduledMinutes: 480, actualMinutes: 450, pairedSessionCount: 1, checkInAt: NOW, checkOutAt: NOW, lateMinutes: 0, earlyLeaveMinutes: 0, overtimeMinutes: 0, missingPunch: false, invalidPunch: false, justified: false, unscheduled: false, ...overrides };
}

function pageInfo(totalItems: number) {
  return { page: 1, pageSize: 20, totalItems, totalPages: 1 };
}

function screenshotOptions() {
  return { animations: "disabled" as const, caret: "hide" as const, fullPage: false, scale: "css" as const };
}
