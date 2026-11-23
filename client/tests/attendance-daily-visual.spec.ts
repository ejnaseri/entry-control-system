import { expect, test, type Page, type Route } from "@playwright/test";
import { FULL_TEST_IDENTITY } from "./auth-fixtures";

const NOW = "2026-08-24T08:00:00.000Z";
const EXPIRES_AT = "2026-08-24T20:00:00.000Z";
const EMPLOYEE_ID = "cmemployee00000000000000001";
const GROUP_ID = "cmstaffgroup0000000000000001";
const SHIFT_ID = "cmshift00000000000000000001";
const DESKTOP_VIEWPORT = { width: 1440, height: 900 } as const;
const MOBILE_VIEWPORT = { width: 390, height: 844 } as const;

test.use({ timezoneId: "Asia/Kabul" });

test("Attendance daily — desktop dark LTR", async ({ page }) => {
  await openDaily(page, { viewport: DESKTOP_VIEWPORT, language: "en", theme: "dark" });
  await expect(page).toHaveScreenshot("attendance-daily-desktop-dark-ltr.png", screenshotOptions());
});

test("Attendance daily — desktop light RTL", async ({ page }) => {
  await openDaily(page, { viewport: DESKTOP_VIEWPORT, language: "fa", theme: "light" });
  await expect(page.locator(".dashboard-shell")).toHaveAttribute("dir", "rtl");
  await expect(page).toHaveScreenshot("attendance-daily-desktop-light-rtl.png", screenshotOptions());
});

test("Attendance daily — mobile dark table", async ({ page }) => {
  await openDaily(page, { viewport: MOBILE_VIEWPORT, language: "en", theme: "dark" });
  await page.getByTestId("attendance-daily-table").scrollIntoViewIfNeeded();
  await expect(page.locator("aside")).toBeHidden();
  await expect(page).toHaveScreenshot("attendance-daily-mobile-dark-table.png", screenshotOptions());
});

test("Attendance daily — empty rows", async ({ page }) => {
  await openDaily(page, { viewport: DESKTOP_VIEWPORT, language: "en", theme: "dark", scenario: "empty" });
  await expect(page.getByText("No attendance rows found.")).toBeVisible();
  await expect(page).toHaveScreenshot("attendance-daily-empty.png", screenshotOptions());
});

test("Attendance daily — error retries on the same Staff endpoint", async ({ page }) => {
  const state = await openDaily(page, { viewport: DESKTOP_VIEWPORT, language: "en", theme: "dark", scenario: "error-once" });
  const error = page.getByTestId("attendance-daily-error");
  await expect(error).toBeVisible();
  await expect(page).toHaveScreenshot("attendance-daily-error.png", screenshotOptions());
  await error.getByRole("button", { name: "Retry" }).click();
  await expect(page.getByText("Eraj Naseri")).toBeVisible();
  expect(new Set(state.businessRequests.map(stripQuery))).toEqual(new Set([
    "GET /api/v1/attendance/daily",
    "GET /api/v1/employees/options/staff-groups",
  ]));
});

test("Attendance daily — deterministic loading state", async ({ page }) => {
  const state = await openDaily(page, { viewport: DESKTOP_VIEWPORT, language: "en", theme: "dark", scenario: "loading" });
  await expect(page.getByTestId("attendance-daily-table").locator(".app-table-skeleton").first()).toBeVisible();
  await expect(page).toHaveScreenshot("attendance-daily-loading.png", screenshotOptions());
  state.releaseDaily?.();
  await expect(page.getByText("Eraj Naseri")).toBeVisible();
  expect(state.businessRequests.every((request) => /\/api\/v1\/(?:attendance\/daily|employees\/options\/staff-groups)/u.test(request))).toBe(true);
});

test("Attendance daily — justification modal", async ({ page }) => {
  await openDaily(page, { viewport: DESKTOP_VIEWPORT, language: "en", theme: "dark" });
  await page.getByRole("button", { name: "Justification" }).first().click();
  await expect(page.getByTestId("attendance-justification-modal")).toBeVisible();
  await expect(page).toHaveScreenshot("attendance-daily-justification-modal.png", screenshotOptions());
});

type DailyOptions = Readonly<{
  viewport: Readonly<{ width: number; height: number }>;
  language: "en" | "fa";
  theme: "dark" | "light";
  scenario?: "normal" | "empty" | "error-once" | "loading";
}>;

async function openDaily(page: Page, options: DailyOptions) {
  const scenario = options.scenario ?? "normal";
  const businessRequests: string[] = [];
  let dailyRequests = 0;
  let releaseDaily: (() => void) | undefined;
  const dailyGate = scenario === "loading" ? new Promise<void>((resolve) => { releaseDaily = resolve; }) : null;

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
    if (url.pathname === "/api/v1/employees/options/staff-groups") {
      businessRequests.push(`${request.method()} ${url.pathname}${url.search}`);
      await route.fulfill({ json: [staffGroup()] });
      return;
    }
    if (url.pathname === "/api/v1/attendance/daily") {
      dailyRequests += 1;
      businessRequests.push(`${request.method()} ${url.pathname}${url.search}`);
      if (scenario === "error-once" && dailyRequests <= 2) {
        await route.fulfill({ status: 500, json: { message: "Daily attendance unavailable" } });
        return;
      }
      if (dailyGate) await dailyGate;
      await route.fulfill({ json: scenario === "empty" ? emptyDailyResponse() : dailyResponse() });
      return;
    }
    if (url.pathname === "/api/v1/attendance/justifications") {
      businessRequests.push(`${request.method()} ${url.pathname}${url.search}`);
      await route.fulfill({ status: request.method() === "DELETE" ? 204 : 201, json: request.method() === "DELETE" ? undefined : { id: "justification-1" } });
      return;
    }
    await fulfillNotFound(route);
  });

  await page.goto("/attendance", { waitUntil: "domcontentloaded" });
  if (scenario === "loading") {
    await expect(page.getByTestId("attendance-daily-table").locator(".app-table-skeleton").first()).toBeVisible();
  } else if (scenario === "error-once") {
    await expect(page.getByTestId("attendance-daily-error")).toBeVisible();
  } else {
    await expect(page.getByTestId("attendance-daily-table")).toBeVisible();
    if (scenario === "normal") await expect(page.getByText("Eraj Naseri")).toBeVisible();
  }
  await settleVisuals(page);

  return { businessRequests, releaseDaily };
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

function staffGroup() {
  return {
    id: GROUP_ID,
    name: "Day operations",
    description: "Weekday operations team",
    accessLevel: "Staff",
    shifts: [{ id: SHIFT_ID, shiftName: "Day shift", shiftStart: "08:00", shiftEnd: "16:00", weekdays: [1, 2, 3, 4, 5], graceMinutes: 5, earlyAccessMinutes: 15, isActive: true }],
  };
}

function dailyResponse() {
  return {
    date: "2026-08-24",
    summary: { present: 3, absent: 1, late: 1, inside: 1, justified: 1, unscheduledPresentCount: 1, deniedCount: 2 },
    warnings: { noCheckout: 1, noShift: 1, multipleEvents: 1 },
    rows: [
      dailyRow({ memberId: EMPLOYEE_ID, memberCode: "1042", memberFullName: "Eraj Naseri", status: "LATE", warnings: ["NO_CHECKOUT", "MULTIPLE_EVENTS"], hasOpenSession: true, checkOutAt: null, durationMinutes: null, liveDurationMinutes: 250, lateMinutes: 10 }),
      dailyRow({ memberId: "employee-2", memberCode: "1055", memberFullName: "Laila Ahmadi", status: "PRESENT", warnings: [], checkInAt: "2026-08-24T03:28:00.000Z", checkOutAt: "2026-08-24T12:05:00.000Z", durationMinutes: 497, liveDurationMinutes: null }),
      dailyRow({ memberId: "employee-3", memberCode: "1071", memberFullName: "Farid Rahimi", status: "ABSENT", warnings: [], checkInAt: null, checkOutAt: null, durationMinutes: null, liveDurationMinutes: null, isJustified: true, justificationReason: "Approved leave" }),
      dailyRow({ memberId: "employee-4", memberCode: "1090", memberFullName: "Mina Safi", status: "INSIDE", warnings: ["NO_SHIFT"], hasShift: false, shiftId: null, shiftName: "", checkInAt: "2026-08-24T04:12:00.000Z", checkOutAt: null, durationMinutes: null, liveDurationMinutes: 208 }),
    ],
  };
}

function emptyDailyResponse() {
  return {
    date: "2026-08-24",
    summary: { present: 0, absent: 0, late: 0, inside: 0, justified: 0, unscheduledPresentCount: 0, deniedCount: 0 },
    warnings: { noCheckout: 0, noShift: 0, multipleEvents: 0 },
    rows: [],
  };
}

function dailyRow(overrides: Record<string, unknown>) {
  return {
    memberId: EMPLOYEE_ID,
    memberCode: "1042",
    memberFullName: "Eraj Naseri",
    memberPhone: "0700 000 000",
    staffGroupId: GROUP_ID,
    staffGroupName: "Day operations",
    shiftId: SHIFT_ID,
    shiftName: "Day shift",
    shiftStart: "08:00",
    shiftEnd: "16:00",
    graceMinutes: 5,
    status: "PRESENT",
    checkInAt: "2026-08-24T03:40:00.000Z",
    checkOutAt: "2026-08-24T12:00:00.000Z",
    lateMinutes: 0,
    earlyMinutes: 0,
    earlyLeaveMinutes: 0,
    overtimeMinutes: 0,
    durationMinutes: 480,
    confirmedDurationMinutes: 480,
    pairedSessionCount: 1,
    hasOpenSession: false,
    openSessionSince: null,
    liveDurationMinutes: null,
    lastEventType: "OUT",
    deviceName: "Front gate",
    warnings: [],
    isJustified: false,
    justificationReason: null,
    hasShift: true,
    ...overrides,
  };
}

function screenshotOptions() {
  return { animations: "disabled" as const, caret: "hide" as const, fullPage: false, scale: "css" as const };
}
