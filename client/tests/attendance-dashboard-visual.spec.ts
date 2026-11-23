import { expect, test, type Page, type Route } from "@playwright/test";
import { FULL_TEST_IDENTITY } from "./auth-fixtures";

const NOW = "2026-08-24T08:00:00.000Z";
const EXPIRES_AT = "2026-08-24T20:00:00.000Z";
const DESKTOP_VIEWPORT = { width: 1440, height: 900 } as const;
const MOBILE_VIEWPORT = { width: 390, height: 844 } as const;

test("Attendance dashboard — desktop dark LTR", async ({ page }) => {
  await openDashboard(page, { viewport: DESKTOP_VIEWPORT, language: "en", theme: "dark" });
  await expect(page.locator(".dashboard-v2-header")).toHaveCount(0);
  await expect(page).toHaveScreenshot("attendance-dashboard-desktop-dark-ltr.png", screenshotOptions());
});

test("Attendance dashboard KPI cards open the Full-style details modal", async ({ page }) => {
  await openDashboard(page, { viewport: DESKTOP_VIEWPORT, language: "en", theme: "dark" });
  const cards = ["active-employees", "present", "inside-now", "late", "absent"] as const;

  for (const card of cards) {
    await page.getByTestId(`attendance-metric-${card}`).click();
    await expect(page.getByTestId("attendance-stat-modal")).toBeVisible();
    await expect(page.getByTestId("attendance-stat-modal").getByText("Eraj Naseri")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("attendance-stat-modal")).toHaveCount(0);
  }

  await page.getByTestId("attendance-metric-present").press("Enter");
  await expect(page.getByTestId("attendance-stat-modal")).toBeVisible();
  await expect(page.getByTestId("attendance-stat-modal").getByText("Eraj Naseri")).toBeVisible();
  const toggleBox = await page.getByTestId("sidebar-collapse-toggle").boundingBox();
  expect(toggleBox).not.toBeNull();
  const modalCoversToggle = await page.evaluate(({ x, y }) => Boolean(document.elementFromPoint(x, y)?.closest(".modal-overlay")), {
    x: toggleBox!.x + toggleBox!.width / 2,
    y: toggleBox!.y + toggleBox!.height / 2,
  });
  expect(modalCoversToggle).toBe(true);
  await expect(page).toHaveScreenshot("attendance-dashboard-kpi-modal.png", screenshotOptions());
});

test("Attendance dashboard trend uses the Full-style interactive tooltip", async ({ page }) => {
  await openDashboard(page, { viewport: DESKTOP_VIEWPORT, language: "en", theme: "dark" });

  const point = page.getByTestId("attendance-trend-point-3");
  const tooltip = page.getByTestId("attendance-trend-tooltip");
  await point.hover();
  await expect(tooltip).toBeVisible();
  await expect(tooltip).toContainText("Present: 8");

  await page.mouse.move(0, 0);
  await expect(tooltip).toHaveCount(0);

  await point.focus();
  await expect(tooltip).toBeVisible();
  await page.getByRole("heading", { name: "Attendance trend", exact: true }).click();
  await expect(tooltip).toHaveCount(0);
});

test("Attendance dashboard — desktop light RTL", async ({ page }) => {
  await openDashboard(page, { viewport: DESKTOP_VIEWPORT, language: "fa", theme: "light" });
  await expect(page.locator(".dashboard-shell")).toHaveAttribute("dir", "rtl");
  await expect(page).toHaveScreenshot("attendance-dashboard-desktop-light-rtl.png", screenshotOptions());
});

test("Attendance dashboard KPI details use the desktop light RTL layout", async ({ page }) => {
  await openDashboard(page, { viewport: DESKTOP_VIEWPORT, language: "fa", theme: "light" });
  await page.getByTestId("attendance-metric-absent").click();
  await expect(page.getByTestId("attendance-stat-modal").getByText("Eraj Naseri")).toBeVisible();
  await expect(page).toHaveScreenshot("attendance-dashboard-kpi-modal-light-rtl.png", screenshotOptions());
});

test("Attendance dashboard — mobile dark LTR", async ({ page }) => {
  await openDashboard(page, { viewport: MOBILE_VIEWPORT, language: "en", theme: "dark" });
  await expect(page.locator("aside")).toBeHidden();
  await expect(page).toHaveScreenshot("attendance-dashboard-mobile-dark-ltr.png", screenshotOptions());
});

test("Attendance dashboard — empty trend", async ({ page }) => {
  await openDashboard(page, { viewport: DESKTOP_VIEWPORT, language: "en", theme: "dark", scenario: "empty" });
  await expect(page.getByTestId("attendance-dashboard-trend").locator(".dashboard-v2-empty")).toBeVisible();
  await expect(page).toHaveScreenshot("attendance-dashboard-empty-trend.png", screenshotOptions());
});

test("Attendance dashboard — error state retries without changing the API contract", async ({ page }) => {
  const state = await openDashboard(page, { viewport: DESKTOP_VIEWPORT, language: "en", theme: "dark", scenario: "error-once" });
  const error = page.getByTestId("attendance-dashboard-error");
  await expect(error).toBeVisible();
  await expect(page).toHaveScreenshot("attendance-dashboard-error.png", screenshotOptions());
  await error.getByRole("button", { name: "Refresh" }).click();
  await expect(page.getByTestId("attendance-dashboard-metrics")).toBeVisible();
  // React Strict Mode performs the initial effect twice in the development test server.
  expect(state.summaryRequests).toBe(3);
  expect(new Set(state.businessRequests)).toEqual(new Set(["GET /api/v1/dashboard/summary"]));
});

test("Attendance dashboard — initial loading state is deterministic", async ({ page }) => {
  const state = await openDashboard(page, { viewport: DESKTOP_VIEWPORT, language: "en", theme: "dark", scenario: "loading" });
  await expect(page.getByTestId("attendance-dashboard-loading")).toBeVisible();
  await expect(page).toHaveScreenshot("attendance-dashboard-loading.png", screenshotOptions());
  state.releaseSummary?.();
  await expect(page.getByTestId("attendance-dashboard-metrics")).toBeVisible();
  expect(state.businessRequests).toHaveLength(2);
  expect(new Set(state.businessRequests)).toEqual(new Set(["GET /api/v1/dashboard/summary"]));
});

type DashboardOptions = Readonly<{
  viewport: Readonly<{ width: number; height: number }>;
  language: "en" | "fa";
  theme: "dark" | "light";
  scenario?: "normal" | "empty" | "error-once" | "loading";
}>;

async function openDashboard(page: Page, options: DashboardOptions) {
  const scenario = options.scenario ?? "normal";
  const businessRequests: string[] = [];
  let summaryRequests = 0;
  let releaseSummary: (() => void) | undefined;
  const summaryGate = scenario === "loading" ? new Promise<void>((resolve) => { releaseSummary = resolve; }) : null;

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
    if (url.pathname === "/api/v1/dashboard/summary") {
      summaryRequests += 1;
      businessRequests.push(`${request.method()} ${url.pathname}`);
      if (scenario === "error-once" && summaryRequests <= 2) {
        await route.fulfill({ status: 500, json: { message: "Dashboard unavailable" } });
        return;
      }
      if (summaryGate) await summaryGate;
      const summary = dashboardSummary();
      await route.fulfill({ json: scenario === "empty" ? { ...summary, trend: [] } : summary });
      return;
    }
    if (url.pathname === "/api/v1/dashboard/details") {
      await route.fulfill({ json: dashboardDetails(url.searchParams.get("type") ?? "present") });
      return;
    }
    await fulfillNotFound(route);
  });

  await page.goto("/", { waitUntil: "domcontentloaded" });
  if (scenario !== "loading") {
    if (scenario === "error-once") await expect(page.getByTestId("attendance-dashboard-error")).toBeVisible();
    else await expect(page.getByTestId("attendance-dashboard-metrics")).toBeVisible();
    await settleVisuals(page);
  } else {
    await expect(page.getByTestId("attendance-dashboard-loading")).toBeVisible();
    await settleVisuals(page);
  }

  return {
    businessRequests,
    get summaryRequests() { return summaryRequests; },
    releaseSummary,
  };
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

function dashboardSummary() {
  const trend = Array.from({ length: 7 }, (_, index) => ({
    date: `2026-08-${String(18 + index).padStart(2, "0")}`,
    scheduled: 10,
    present: 8,
    late: 2,
    absent: 1,
    justified: 1,
    exceptions: 2,
  }));
  return {
    date: "2026-08-24",
    generatedAt: NOW,
    employees: { active: 12, scheduledToday: 10 },
    attendance: { present: 8, onTime: 6, late: 2, absent: 1, justified: 1, insideNow: 4, openSessions: 4 },
    warnings: { missingCheckout: 1, multipleEvents: 1, noShift: 0 },
    punches: { total: 18, denied: 1, unknownIds: 1 },
    devices: { total: 1, enabled: 1, online: 1, offline: 0, lastSyncAt: NOW, lastEventAt: NOW },
    trend,
  };
}

function dashboardDetails(type: string) {
  const status = type === "active-employees" ? "ACTIVE" : type === "inside-now" ? "INSIDE" : type === "late" ? "LATE" : type === "absent" ? "ABSENT" : "PRESENT";
  return {
    type,
    date: "2026-08-24",
    total: 2,
    items: [
      {
        memberId: "employee-1", memberCode: "1042", memberName: "Eraj Naseri", memberPhone: "0700 000 000",
        staffGroupName: "Day operations", shiftName: "Day shift", shiftTime: "08:00–16:00", role: "Reception officer",
        checkInAt: status === "ACTIVE" || status === "ABSENT" ? null : "2026-08-24T04:30:00.000Z",
        checkOutAt: null, status, lateMinutes: status === "LATE" ? 12 : null,
      },
      {
        memberId: "employee-2", memberCode: "1043", memberName: "Lina Ahmadi", memberPhone: "0700 000 001",
        staffGroupName: "Day operations", shiftName: "Day shift", shiftTime: "08:00–16:00", role: "Manager",
        checkInAt: status === "ACTIVE" || status === "ABSENT" ? null : "2026-08-24T04:35:00.000Z",
        checkOutAt: null, status, lateMinutes: status === "LATE" ? 17 : null,
      },
    ],
  };
}

function screenshotOptions() {
  return { animations: "disabled" as const, caret: "hide" as const, fullPage: false, scale: "css" as const };
}
