import { expect, test, type Page, type Route } from "@playwright/test";
import { FULL_TEST_IDENTITY } from "./auth-fixtures";

const NOW = "2026-08-24T08:00:00.000Z";
const EXPIRES_AT = "2026-08-24T20:00:00.000Z";
const DEVICE_ID = "cmdevice00000000000000001";
const EMPLOYEE_ID = "cmemployee00000000000000001";
const DESKTOP_VIEWPORT = { width: 1440, height: 900 } as const;
const MOBILE_VIEWPORT = { width: 390, height: 844 } as const;

test.use({ timezoneId: "Asia/Kabul" });

test("Attendance devices — desktop dark LTR", async ({ page }) => {
  await openDevices(page, { viewport: DESKTOP_VIEWPORT, language: "en", theme: "dark" });
  await expect(page).toHaveScreenshot("attendance-devices-desktop-dark-ltr.png", screenshotOptions());
});

test("Attendance devices — desktop light RTL", async ({ page }) => {
  await openDevices(page, { viewport: DESKTOP_VIEWPORT, language: "fa", theme: "light" });
  await expect(page.locator(".dashboard-shell")).toHaveAttribute("dir", "rtl");
  await expect(page).toHaveScreenshot("attendance-devices-desktop-light-rtl.png", screenshotOptions());
});

test("Attendance devices — mobile cards and contained event table", async ({ page }) => {
  await openDevices(page, { viewport: MOBILE_VIEWPORT, language: "en", theme: "dark" });
  const viewport = await page.evaluate(() => ({ innerWidth: window.innerWidth, scrollWidth: document.documentElement.scrollWidth }));
  expect(viewport.scrollWidth).toBeLessThanOrEqual(viewport.innerWidth);
  await page.getByTestId("device-card").first().scrollIntoViewIfNeeded();
  await expect(page.locator("aside")).toBeHidden();
  await expect(page).toHaveScreenshot("attendance-devices-mobile-cards.png", screenshotOptions());
});

test("Attendance devices — empty state", async ({ page }) => {
  await openDevices(page, { viewport: DESKTOP_VIEWPORT, language: "en", theme: "dark", scenario: "empty" });
  await expect(page.getByTestId("staff-devices-empty")).toBeVisible();
  await expect(page).toHaveScreenshot("attendance-devices-empty.png", screenshotOptions());
});

test("Attendance devices — error retries only Core endpoints", async ({ page }) => {
  const state = await openDevices(page, { viewport: DESKTOP_VIEWPORT, language: "en", theme: "dark", scenario: "error-once" });
  const error = page.getByTestId("staff-devices-error");
  await expect(error).toBeVisible();
  await expect(page).toHaveScreenshot("attendance-devices-error.png", screenshotOptions());
  await error.getByRole("button", { name: "Retry" }).click();
  await expect(page.getByText("Front K40", { exact: true })).toBeVisible();
  expect(state.businessRequests.every(isAllowedCoreRequest)).toBe(true);
});

test("Attendance devices — deterministic loading state", async ({ page }) => {
  const state = await openDevices(page, { viewport: DESKTOP_VIEWPORT, language: "en", theme: "dark", scenario: "loading" });
  await expect(page.getByTestId("staff-devices-loading")).toBeVisible();
  await expect(page).toHaveScreenshot("attendance-devices-loading.png", screenshotOptions());
  state.releaseDevices?.();
  await expect(page.getByText("Front K40", { exact: true })).toBeVisible();
  expect(state.businessRequests.every(isAllowedCoreRequest)).toBe(true);
});

test("Attendance devices — add K40 modal", async ({ page }) => {
  await openDevices(page, { viewport: DESKTOP_VIEWPORT, language: "en", theme: "dark" });
  await page.getByRole("button", { name: "Add device" }).click();
  await expect(page.getByTestId("staff-device-form-modal")).toBeVisible();
  await expect(page).toHaveScreenshot("attendance-devices-add-modal.png", screenshotOptions());
});

test("Attendance devices — employee tools modal", async ({ page }) => {
  const state = await openDevices(page, { viewport: DESKTOP_VIEWPORT, language: "en", theme: "dark" });
  await page.getByRole("button", { name: "Employee tools" }).first().click();
  await expect(page.getByTestId("staff-device-tools-modal")).toBeVisible();
  await expect(page.getByText("Eraj Naseri", { exact: true }).last()).toBeVisible();
  await expect(page).toHaveScreenshot("attendance-devices-tools-modal.png", screenshotOptions());
  expect(state.businessRequests.every(isAllowedCoreRequest)).toBe(true);
});

type DeviceOptions = Readonly<{
  viewport: Readonly<{ width: number; height: number }>;
  language: "en" | "fa";
  theme: "dark" | "light";
  scenario?: "normal" | "empty" | "error-once" | "loading";
}>;

async function openDevices(page: Page, options: DeviceOptions) {
  const scenario = options.scenario ?? "normal";
  const businessRequests: string[] = [];
  let deviceListRequests = 0;
  let releaseDevices: (() => void) | undefined;
  const devicesGate = scenario === "loading" ? new Promise<void>((resolve) => { releaseDevices = resolve; }) : null;

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
    if (url.pathname === "/api/v1/employees" && request.method() === "GET") {
      businessRequests.push(`${request.method()} ${url.pathname}${url.search}`);
      await route.fulfill({ json: { items: [employee()], total: 1, skip: 0, take: 100 } });
      return;
    }
    if (url.pathname === "/api/v1/devices/status") {
      businessRequests.push(`${request.method()} ${url.pathname}${url.search}`);
      if (devicesGate) await devicesGate;
      await route.fulfill({ json: { devices: [{ id: DEVICE_ID, connected: true, lastPollAt: NOW, lastEventAt: "2026-08-24T07:58:00.000Z" }] } });
      return;
    }
    if (url.pathname === "/api/v1/devices/events") {
      businessRequests.push(`${request.method()} ${url.pathname}${url.search}`);
      if (devicesGate) await devicesGate;
      await route.fulfill({ json: { items: scenario === "empty" ? [] : deviceEvents() } });
      return;
    }
    if (url.pathname === "/api/v1/devices" && request.method() === "GET") {
      deviceListRequests += 1;
      businessRequests.push(`${request.method()} ${url.pathname}${url.search}`);
      if (scenario === "error-once" && deviceListRequests <= 2) {
        await route.fulfill({ status: 500, json: { message: "Device data unavailable" } });
        return;
      }
      if (devicesGate) await devicesGate;
      await route.fulfill({ json: scenario === "empty" ? [] : devices() });
      return;
    }
    if (url.pathname === `/api/v1/devices/${DEVICE_ID}/users` && request.method() === "GET") {
      businessRequests.push(`${request.method()} ${url.pathname}${url.search}`);
      await route.fulfill({ json: { items: [{ userId: "1042", name: "Eraj Naseri" }], mode: "active" } });
      return;
    }
    await fulfillNotFound(route);
  });

  await page.goto("/devices", { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("staff-devices")).toBeVisible();
  if (scenario === "loading") {
    await expect(page.getByTestId("staff-devices-loading")).toBeVisible();
  } else if (scenario === "error-once") {
    await expect(page.getByTestId("staff-devices-error")).toBeVisible();
  } else if (scenario === "empty") {
    await expect(page.getByTestId("staff-devices-empty")).toBeVisible();
  } else {
    await expect(page.getByText("Front K40", { exact: true })).toBeVisible();
  }
  await settleVisuals(page);

  return { businessRequests, releaseDevices };
}

function devices() {
  return [
    {
      id: DEVICE_ID,
      name: "Front K40",
      type: "FINGERPRINT",
      connectionType: "NETWORK",
      enabled: true,
      status: "ONLINE",
      model: "K40 Pro",
      serialNumber: "K40-001",
      config: { ip: "192.168.1.200", port: 4370, timeoutMs: 3000, pollIntervalMs: 1000, eventMode: "PULL", pushEnabled: false },
      lastSuccessfulPollAt: NOW,
      lastEventReceivedAt: "2026-08-24T07:58:00.000Z",
      lastErrorMessage: null,
    },
    {
      id: "cmdevice00000000000000002",
      name: "Staff Entrance K40",
      type: "FINGERPRINT",
      connectionType: "NETWORK",
      enabled: true,
      status: "ERROR",
      model: "K40",
      serialNumber: "K40-002",
      config: { ip: "192.168.1.201", port: 4370, timeoutMs: 3000, pollIntervalMs: 1000, eventMode: "PULL", pushEnabled: false },
      lastSuccessfulPollAt: "2026-08-24T07:40:00.000Z",
      lastEventReceivedAt: "2026-08-24T07:35:00.000Z",
      lastErrorMessage: "Connection timed out",
    },
  ];
}

function deviceEvents() {
  return [
    { id: "event-1", authorized: true, attendanceRecorded: true, memberName: "Eraj Naseri", memberCode: "1042", entryType: "IN" },
    { id: "event-2", authorized: false, attendanceRecorded: false, memberName: "Laila Ahmadi", memberCode: "1055", entryType: "IN" },
  ];
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

function isAllowedCoreRequest(request: string) {
  return /^(?:GET) \/api\/v1\/(?:employees|devices(?:\/(?:status|events|[^/?]+\/users))?)(?:\?|$)/u.test(request);
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

function screenshotOptions() {
  return { animations: "disabled" as const, caret: "hide" as const, fullPage: false, scale: "css" as const };
}
