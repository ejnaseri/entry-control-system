import { expect, test, type Page, type Route } from "@playwright/test";
import { FULL_TEST_IDENTITY } from "./auth-fixtures";

const NOW = "2026-08-24T08:00:00.000Z";
const EXPIRES_AT = "2026-08-24T20:00:00.000Z";
const EMPLOYEE_ID = "cmemployee00000000000000001";
const GROUP_ID = "cmstaffgroup0000000000000001";
const DEVICE_ID = "cmdevice000000000000000001";
const DESKTOP_VIEWPORT = { width: 1440, height: 900 } as const;
const MOBILE_VIEWPORT = { width: 390, height: 844 } as const;

test("Attendance employees list — desktop dark LTR", async ({ page }) => {
  await openEmployees(page, { path: "/employees", viewport: DESKTOP_VIEWPORT, language: "en", theme: "dark" });
  await expect(page.getByTestId("shared-app-shell")).toHaveAttribute("data-edition", "ATTENDANCE");
  await expect(page.getByTestId("employees-table").locator(".app-table-header-cell").first()).toHaveCSS("font-size", "10px");
  await expect(page).toHaveScreenshot("attendance-employees-list-desktop-dark-ltr.png", screenshotOptions());
});

test("Attendance employees list — desktop light RTL empty", async ({ page }) => {
  await openEmployees(page, { path: "/employees", viewport: DESKTOP_VIEWPORT, language: "fa", theme: "light", scenario: "empty" });
  await expect(page.locator(".dashboard-shell")).toHaveAttribute("dir", "rtl");
  await expect(page.getByText("کارمندی پیدا نشد.")).toBeVisible();
  await expect(page).toHaveScreenshot("attendance-employees-list-desktop-light-rtl-empty.png", screenshotOptions());
});

test("Attendance employees list — compact row content and readable light status", async ({ page }) => {
  await openEmployees(page, { path: "/employees", viewport: DESKTOP_VIEWPORT, language: "en", theme: "light" });
  const firstRow = page.getByTestId("employee-row").first();
  await expect(firstRow.locator(".app-table-cell").nth(1)).toHaveCSS("font-size", "12px");
  await expect(firstRow.locator(".members-meta__primary").first()).toHaveCSS("font-size", "12px");
  await expect(firstRow.locator('.member-badge--status[data-status="ACTIVE"]')).toHaveCSS("color", "rgb(15, 106, 75)");
  await expect(page).toHaveScreenshot("attendance-employees-list-desktop-light-ltr.png", screenshotOptions());
});

test("Attendance employees list — mobile dark LTR", async ({ page }) => {
  await openEmployees(page, { path: "/employees", viewport: MOBILE_VIEWPORT, language: "en", theme: "dark" });
  await expect(page.locator("aside")).toBeHidden();
  await expect(page).toHaveScreenshot("attendance-employees-list-mobile-dark-ltr.png", screenshotOptions());
});

test("Attendance employee detail — desktop dark LTR", async ({ page }) => {
  const state = await openEmployees(page, { path: `/employees/${EMPLOYEE_ID}`, viewport: DESKTOP_VIEWPORT, language: "en", theme: "dark" });
  await expect(page.getByTestId("employee-overview")).toBeVisible();
  await expect(page.getByText("Assigned shifts")).toBeVisible();
  await expect(page).toHaveScreenshot("attendance-employee-detail-desktop-dark-ltr.png", screenshotOptions());

  await page.getByRole("tab", { name: "Recent attendance" }).click();
  await expect(page.getByTestId("employee-attendance")).toBeVisible();
  await page.getByRole("tab", { name: "Schedule and access" }).click();
  await expect(page.getByTestId("employee-schedule")).toBeVisible();
  await page.getByRole("tab", { name: "Access", exact: true }).click();
  await expect(page.getByTestId("employee-access")).toBeVisible();

  expect(new Set(state.businessRequests)).toEqual(new Set([
    `GET /api/v1/employees/${EMPLOYEE_ID}`,
    `GET /api/v1/employees/${EMPLOYEE_ID}/attendance`,
  ]));
  await expect(page.getByTestId("employee-detail")).not.toContainText(/Payments|Membership|Salary/u);
});

test("Attendance employee detail — desktop light RTL", async ({ page }) => {
  await openEmployees(page, { path: `/employees/${EMPLOYEE_ID}`, viewport: DESKTOP_VIEWPORT, language: "fa", theme: "light" });
  await expect(page.getByTestId("employee-detail")).toHaveAttribute("dir", "rtl");
  await expect(page.getByTestId("employee-overview")).toBeVisible();
  await expect(page).toHaveScreenshot("attendance-employee-detail-desktop-light-rtl.png", screenshotOptions());
});

test("Attendance employee detail — mobile dark LTR", async ({ page }) => {
  await openEmployees(page, { path: `/employees/${EMPLOYEE_ID}`, viewport: MOBILE_VIEWPORT, language: "en", theme: "dark" });
  await expect(page.locator("aside")).toBeHidden();
  await expect(page.getByTestId("employee-overview")).toBeVisible();
  await expect(page).toHaveScreenshot("attendance-employee-detail-mobile-dark-ltr.png", screenshotOptions());
});

test("Attendance add employee — desktop light RTL", async ({ page }) => {
  await openEmployees(page, { path: "/employees/add", viewport: DESKTOP_VIEWPORT, language: "fa", theme: "light" });
  await expect(page.getByTestId("employee-form-add")).toBeVisible();
  await expect(page).toHaveScreenshot("attendance-employee-add-desktop-light-rtl.png", screenshotOptions());
});

test("Attendance add employee wizard uses the Full-style personal step", async ({ page }) => {
  await openEmployees(page, { path: "/employees/add", viewport: DESKTOP_VIEWPORT, language: "en", theme: "dark" });
  await page.getByTestId("employee-wizard-primary").click();
  await expect(page.getByLabel("Employee code")).toBeVisible();
  await expect(page).toHaveScreenshot("attendance-employee-add-personal-desktop-dark-ltr.png", screenshotOptions());
});

test("Attendance employee form — Full-style custom selection menu", async ({ page }) => {
  await openEmployees(page, { path: "/employees/add", viewport: DESKTOP_VIEWPORT, language: "en", theme: "dark" });
  await page.getByTestId("employee-wizard-primary").click();
  await expect(page.locator("select")).toHaveCount(0);
  await page.getByLabel("Gender", { exact: true }).click();
  await expect(page.getByRole("listbox")).toBeVisible();
  await expect(page).toHaveScreenshot("attendance-employee-custom-select-desktop-dark-ltr.png", screenshotOptions());
});

test("Attendance edit employee — mobile Full-style wizard and fingerprint enrollment", async ({ page }) => {
  await openEmployees(page, { path: `/employees/${EMPLOYEE_ID}/edit`, viewport: MOBILE_VIEWPORT, language: "en", theme: "dark" });
  await page.getByTestId("employee-wizard-primary").click();
  await expect(page.getByTestId("employee-device-enrollment")).toBeVisible();
  await page.getByTestId("employee-device-enrollment").scrollIntoViewIfNeeded();
  await expect(page).toHaveScreenshot("attendance-employee-edit-mobile-enrollment.png", screenshotOptions());
});

test("Attendance edit employee — desktop finger picker", async ({ page }) => {
  await openEmployees(page, { path: `/employees/${EMPLOYEE_ID}/edit`, viewport: DESKTOP_VIEWPORT, language: "en", theme: "dark" });
  await page.getByTestId("employee-wizard-primary").click();
  await page.getByRole("button", { name: "Choose finger" }).click();
  await expect(page.getByRole("dialog", { name: "Choose a finger" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Right index (6)" })).toBeVisible();
  await expect(page).toHaveScreenshot("attendance-employee-edit-finger-picker-desktop-dark-ltr.png", screenshotOptions());
});

test("Attendance employees list — error state stays on the Employee facade", async ({ page }) => {
  const state = await openEmployees(page, { path: "/employees", viewport: DESKTOP_VIEWPORT, language: "en", theme: "dark", scenario: "error" });
  await expect(page.getByRole("alert")).toBeVisible();
  await expect(page).toHaveScreenshot("attendance-employees-list-error.png", screenshotOptions());
  expect(new Set(state.businessRequests.map((request) => request.replace(/^GET /u, "")))).toEqual(new Set(["/api/v1/employees", "/api/v1/employees/options/staff-groups"]));
});

test("Attendance employees list — deterministic loading state", async ({ page }) => {
  const state = await openEmployees(page, { path: "/employees", viewport: DESKTOP_VIEWPORT, language: "en", theme: "dark", scenario: "loading" });
  await expect(page.getByTestId("employees-table").locator(".app-table-skeleton").first()).toBeVisible();
  await expect(page).toHaveScreenshot("attendance-employees-list-loading.png", screenshotOptions());
  state.releaseEmployees?.();
  await expect(page.getByText("Eraj Naseri")).toBeVisible();
  expect(state.businessRequests.every((request) => request.includes("/api/v1/employees"))).toBe(true);
});

type EmployeesOptions = Readonly<{
  path: string;
  viewport: Readonly<{ width: number; height: number }>;
  language: "en" | "fa";
  theme: "dark" | "light";
  scenario?: "normal" | "empty" | "error" | "loading";
}>;

async function openEmployees(page: Page, options: EmployeesOptions) {
  const scenario = options.scenario ?? "normal";
  const businessRequests: string[] = [];
  let releaseEmployees: (() => void) | undefined;
  const employeesGate = scenario === "loading" ? new Promise<void>((resolve) => { releaseEmployees = resolve; }) : null;

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
    if (url.pathname.startsWith("/api/v1/employees")) businessRequests.push(`${request.method()} ${url.pathname}`);
    if (url.pathname === "/api/v1/employees/options/staff-groups") {
      await route.fulfill({ json: [staffGroup()] });
      return;
    }
    if (url.pathname === "/api/v1/devices" && request.method() === "GET") {
      await route.fulfill({ json: [fingerprintDevice()] });
      return;
    }
    if (url.pathname === "/api/v1/employees" && request.method() === "GET") {
      if (scenario === "error") {
        await route.fulfill({ status: 500, json: { message: "Employee data unavailable" } });
        return;
      }
      if (employeesGate) await employeesGate;
      await route.fulfill({ json: { items: scenario === "empty" ? [] : [employee()], total: scenario === "empty" ? 0 : 1, skip: 0, take: 20 } });
      return;
    }
    if (url.pathname === `/api/v1/employees/${EMPLOYEE_ID}/attendance`) {
      await route.fulfill({ json: attendanceEvents() });
      return;
    }
    if (url.pathname === `/api/v1/employees/${EMPLOYEE_ID}`) {
      await route.fulfill({ json: employee() });
      return;
    }
    await fulfillNotFound(route);
  });

  await page.goto(options.path, { waitUntil: "domcontentloaded" });
  if (scenario === "loading") {
    await expect(page.getByTestId("employees-table").locator(".app-table-skeleton").first()).toBeVisible();
  } else if (scenario === "error") {
    await expect(page.getByRole("alert")).toBeVisible();
  } else if (options.path === "/employees") {
    await expect(page.getByTestId("employees-table")).toBeVisible();
    if (scenario === "normal") await expect(page.getByText("Eraj Naseri")).toBeVisible();
  } else if (options.path === "/employees/add") {
    await expect(page.getByTestId("employee-form-add")).toBeVisible();
  } else if (options.path.endsWith("/edit")) {
    await expect(page.getByTestId("employee-form-edit")).toBeVisible();
  } else {
    await expect(page.getByTestId("employee-detail")).toBeVisible();
  }
  await settleVisuals(page);

  return { businessRequests, releaseEmployees };
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
    shifts: [{ id: "template-1", shiftName: "Day shift", shiftStart: "08:00", shiftEnd: "16:00", weekdays: [1, 2, 3, 4, 5], graceMinutes: 5, earlyAccessMinutes: 15, isActive: true }],
  };
}

function fingerprintDevice() {
  return {
    id: DEVICE_ID, name: "Front desk K40", type: "FINGERPRINT", connectionType: "NETWORK", enabled: true,
    status: "ONLINE", config: { ip: "192.168.1.200", port: 4370 }, model: "K40", serialNumber: "TEST-K40",
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
    fatherName: "Karim",
    phone: "0700 000 000",
    email: "eraj@example.test",
    gender: "MALE",
    birthDate: "1994-03-15T00:00:00.000Z",
    nationalId: "AF-1042",
    photoUrl: null,
    status: "ACTIVE",
    notes: "Primary reception and access desk.",
    roleType: "EMPLOYEE",
    customTitle: "Reception officer",
    profile: { position: "Reception officer", department: "Operations", systemRole: "Front desk" },
    staffGroupId: GROUP_ID,
    staffGroup: staffGroup(),
    archivedAt: null,
    active: true,
    access: { allowedDays: [1, 2, 3, 4, 5], allowedTimeRanges: [], maxEntriesPerDay: null },
    overtime: { allowOvertime: true, maxOvertimePerDay: 90 },
    shifts: [{ id: "shift-1", shiftId: "template-1", shiftName: "Day shift", shiftStart: "08:00", shiftEnd: "16:00", weekdays: [1, 2, 3, 4, 5], graceMinutes: 5, earlyAccessMinutes: 15, isFromGroup: true, isActive: true }],
    createdAt: "2026-08-23T08:00:00.000Z",
    updatedAt: "2026-08-23T08:00:00.000Z",
  };
}

function attendanceEvents() {
  return [
    { id: "event-1", entryType: "IN", recordedAt: "2026-08-24T03:30:00.000Z", source: "K40", isAuthorized: true, reason: null },
    { id: "event-2", entryType: "OUT", recordedAt: "2026-08-23T12:30:00.000Z", source: "K40", isAuthorized: true, reason: null },
  ];
}

function screenshotOptions() {
  return { animations: "disabled" as const, caret: "hide" as const, fullPage: false, scale: "css" as const };
}
