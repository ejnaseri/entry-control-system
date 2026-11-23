import { expect, test, type Page, type Route } from "@playwright/test";
import { FULL_TEST_IDENTITY } from "./auth-fixtures";

const NOW = "2026-08-24T08:00:00.000Z";
const EXPIRES_AT = "2026-08-24T20:00:00.000Z";
const DESKTOP = { width: 1440, height: 900 } as const;
const MOBILE = { width: 390, height: 844 } as const;

test.use({ timezoneId: "Asia/Kabul" });

test("Attendance access users — desktop dark LTR", async ({ page }) => {
  await openSettings(page, "/settings/admin-users", "attendance-admin-users", { viewport: DESKTOP, language: "en", theme: "dark" });
  await expect(page).toHaveScreenshot("attendance-access-users-desktop-dark-ltr.png", screenshotOptions());
});

test("Attendance access users — desktop light RTL", async ({ page }) => {
  await openSettings(page, "/settings/admin-users", "attendance-admin-users", { viewport: DESKTOP, language: "fa", theme: "light" });
  await expect(page.locator(".dashboard-shell")).toHaveAttribute("dir", "rtl");
  await expect(page).toHaveScreenshot("attendance-access-users-desktop-light-rtl.png", screenshotOptions());
});

test("Attendance access users — mobile edit state", async ({ page }) => {
  await openSettings(page, "/settings/admin-users", "attendance-admin-users", { viewport: MOBILE, language: "en", theme: "dark" });
  await page.getByRole("row").filter({ hasText: "attendance.manager" }).getByRole("button", { name: "Edit user" }).click();
  await expect(page.getByLabel("Role")).toContainText("Attendance Manager");
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(MOBILE.width);
  await expect(page).toHaveScreenshot("attendance-access-users-mobile-edit.png", screenshotOptions());
});

test("Attendance audit logs — desktop dark LTR", async ({ page }) => {
  await openSettings(page, "/settings/audit-logs", "audit-logs-page", { viewport: DESKTOP, language: "en", theme: "dark" });
  await expect(page).toHaveScreenshot("attendance-audit-logs-desktop-dark-ltr.png", screenshotOptions());
});

test("Attendance audit logs — desktop light RTL", async ({ page }) => {
  await openSettings(page, "/settings/audit-logs", "audit-logs-page", { viewport: DESKTOP, language: "fa", theme: "light" });
  await expect(page.locator(".dashboard-shell")).toHaveAttribute("dir", "rtl");
  await expect(page).toHaveScreenshot("attendance-audit-logs-desktop-light-rtl.png", screenshotOptions());
});

test("Attendance audit logs — redacted detail modal", async ({ page }) => {
  const state = await openSettings(page, "/settings/audit-logs", "audit-logs-page", { viewport: DESKTOP, language: "en", theme: "dark" });
  await page.getByTestId("audit-log-view-audit-1").click();
  await expect(page.getByTestId("audit-log-detail-modal")).toBeVisible();
  await expect(page.getByTestId("audit-log-detail-modal")).toContainText("[REDACTED]");
  await expect(page).toHaveScreenshot("attendance-audit-log-redacted-detail.png", screenshotOptions());
  expect(state.businessRequests.every(isAllowedSettingsRequest)).toBe(true);
});

test("Attendance backups — desktop dark LTR", async ({ page }) => {
  const state = await openSettings(page, "/settings/backups", "backups-page", { viewport: DESKTOP, language: "en", theme: "dark" });
  await expect(page.getByTestId("backups-table")).toBeVisible();
  await expect(page).toHaveScreenshot("attendance-backups-desktop-dark-ltr.png", screenshotOptions());
  expect(state.businessRequests.every(isAllowedSettingsRequest)).toBe(true);
});

test("Attendance backups — mobile light RTL", async ({ page }) => {
  await openSettings(page, "/settings/backups", "backups-page", { viewport: MOBILE, language: "fa", theme: "light" });
  await expect(page.locator(".dashboard-shell")).toHaveAttribute("dir", "rtl");
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(MOBILE.width);
  await expect(page).toHaveScreenshot("attendance-backups-mobile-light-rtl.png", screenshotOptions());
});

test("Attendance backups — custom status menu escapes clipped cards", async ({ page }) => {
  await openSettings(page, "/settings/backups", "backups-page", { viewport: DESKTOP, language: "en", theme: "dark" });
  await expect(page.locator("select")).toHaveCount(0);
  const mainSurface = page.locator("main.main-surface");
  await expect(page.getByText("Advanced backup tools", { exact: true })).toBeAttached();
  await mainSurface.evaluate((element) => element.scrollTo({ top: element.scrollHeight, behavior: "instant" }));
  const statusFilter = page.getByLabel("Status", { exact: true });
  await statusFilter.click();
  await expect(page.getByRole("listbox")).toBeVisible();
  await expect(page.getByRole("option", { name: "Completed", exact: true })).toBeVisible();
  await expect(page).toHaveScreenshot("attendance-backups-custom-status-menu.png", screenshotOptions());
});

type OpenOptions = Readonly<{
  viewport: Readonly<{ width: number; height: number }>;
  language: "en" | "fa";
  theme: "dark" | "light";
}>;

async function openSettings(page: Page, path: string, testId: string, options: OpenOptions) {
  const businessRequests: string[] = [];
  await page.clock.setFixedTime(new Date(NOW));
  await page.setViewportSize(options.viewport);
  await page.emulateMedia({ colorScheme: options.theme, reducedMotion: "reduce" });
  await page.addInitScript(({ language, theme }) => {
    localStorage.setItem("i18nextLng", language);
    localStorage.setItem("ecs-theme", theme);
  }, { language: options.language, theme: options.theme });
  await mockApi(page, businessRequests);
  await page.goto(path, { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId(testId)).toBeVisible();
  await settleVisuals(page);
  return { businessRequests };
}

async function mockApi(page: Page, businessRequests: string[]) {
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
    businessRequests.push(`${request.method()} ${url.pathname}${url.search}`);
    if (url.pathname === "/api/v1/admin-users") {
      await route.fulfill({ json: { items: adminUsers(), roles: ["GYM_OWNER", "MANAGER", "OPERATOR", "DEVICE_OPERATOR", "READ_ONLY_AUDITOR"] } });
      return;
    }
    if (url.pathname === "/api/v1/audit-logs/options") {
      await route.fulfill({ json: { actions: ["attendance.manual.created"], targetTypes: ["AttendanceLog"], actors: [authPayload().user], actorTypes: ["ADMIN"], actorRoles: ["GYM_OWNER"] } });
      return;
    }
    if (url.pathname === "/api/v1/audit-logs/audit-1") {
      await route.fulfill({ json: { ...auditItem(), userAgent: "Attendance desktop", sessionId: "session-1", requestId: "request-1", beforeData: null, afterData: { memberType: "STAFF", salaryAmount: "[REDACTED]" }, metadata: { editionScope: "ATTENDANCE_STRICT_STAFF" } } });
      return;
    }
    if (url.pathname === "/api/v1/audit-logs") {
      await route.fulfill({ json: { items: [auditItem()], page: 1, pageSize: 20, total: 1, summary: { total: 24, successful: 22, failed: 2 } } });
      return;
    }
    if (url.pathname === "/api/v1/backups") {
      await route.fulfill({ json: backupList() });
      return;
    }
    await fulfillNotFound(route);
  });
}

function authPayload() {
  return {
    edition: "ATTENDANCE",
    features: ["ADMIN_USERS", "ATTENDANCE_DAILY", "ATTENDANCE_DASHBOARD", "ATTENDANCE_EXPORT", "ATTENDANCE_REPORTS", "AUDIT_LOGS", "AUTH", "BACKUPS", "DEVICES", "EMPLOYEES", "ENTRY_LOGS"],
    permissions: ["SIGN_IN", "ADMIN_USERS_MANAGE", "ROLES_MANAGE", "MEMBERS_VIEW", "MEMBERS_WRITE", "ATTENDANCE_VIEW", "ATTENDANCE_EXPORT", "ATTENDANCE_MANUAL", "ATTENDANCE_JUSTIFY", "DEVICES_VIEW", "DEVICES_DIAGNOSTICS", "DEVICES_USER_SYNC", "DEVICES_ENROLL", "DEVICES_CLEAR_LOGS", "DOOR_UNLOCK", "BACKUP_CREATE", "BACKUP_SETTINGS_MANAGE", "AUDIT_LOG_VIEW", "SYSTEM_SETTINGS_MANAGE"],
    user: adminUsers()[0],
    session: { id: "session-1", createdAt: NOW, lastSeenAt: NOW, expiresAt: EXPIRES_AT },
    expiresAt: EXPIRES_AT,
  };
}

function adminUsers() {
  return [
    { id: "admin-1", username: "owner", email: "owner@example.test", fullName: "Attendance Owner", role: "GYM_OWNER", isActive: true, isProtected: true, deactivatedAt: null, lastLoginAt: NOW, passwordChangedAt: NOW, createdAt: NOW, updatedAt: NOW },
    { id: "admin-2", username: "attendance.manager", email: "manager@example.test", fullName: "Laila Ahmadi", role: "MANAGER", isActive: true, isProtected: false, deactivatedAt: null, lastLoginAt: NOW, passwordChangedAt: NOW, createdAt: NOW, updatedAt: NOW },
    { id: "admin-3", username: "device.operator", email: null, fullName: "Eraj Naseri", role: "DEVICE_OPERATOR", isActive: false, isProtected: false, deactivatedAt: NOW, lastLoginAt: null, passwordChangedAt: NOW, createdAt: NOW, updatedAt: NOW },
  ];
}

function auditItem() {
  return { id: "audit-1", actorType: "ADMIN", actorId: "admin-1", actorRole: "GYM_OWNER", actor: authPayload().user, action: "attendance.manual.created", targetType: "AttendanceLog", targetId: "attendance-log-1", success: true, ipAddress: "127.0.0.1", createdAt: NOW, hasDetails: true };
}

function backupList() {
  const profile = (frequency: "hourly" | "daily" | "weekly" | "monthly" | "yearly") => ({ enabled: frequency === "daily", frequency, time: "23:30", minute: 30, dayOfWeek: 1, dayOfMonth: 1, month: 1 });
  const profiles = { hourly: profile("hourly"), daily: profile("daily"), weekly: profile("weekly"), monthly: profile("monthly"), yearly: profile("yearly") };
  const profileStatus = (frequency: keyof typeof profiles) => ({ enabled: frequency === "daily", frequency, nextRunAt: frequency === "daily" ? "2026-08-24T19:00:00.000Z" : null, dueNow: false, scheduledBackups: frequency === "daily" ? 7 : 0, keepCount: 14, cleanupCandidates: 0, lastScheduledBackup: null });
  const backup = { id: "backup-1", jobId: "job-1", type: "MANUAL", status: "COMPLETED", verificationStatus: "VERIFIED", folderName: "backup-2026-08-24", relativePath: "backup-2026-08-24", scheduleFrequency: null, location: "E:\\EntryControlBackups\\backup-2026-08-24", createdAt: NOW, startedAt: NOW, finishedAt: "2026-08-24T08:02:00.000Z", verifiedAt: "2026-08-24T08:03:00.000Z", sizeBytes: "52428800", sha256: "7b3d7f7d6a6d4f729ba32b831b817bfe", databaseName: "entry_control", schema: "public", operator: "Attendance Owner", notes: "Verified daily safety copy", hasManifest: true, hasDump: true, errorMessage: null, restoreSidecarSummary: { hasHandoff: false, handoffCreatedAt: null, productionRestoreStatus: null, productionRestoreCompletedAt: null, postRestoreStatus: null, postRestoreCheckedAt: null }, triggeredBy: { id: "admin-1", username: "owner", fullName: "Attendance Owner", role: "GYM_OWNER" } };
  const restoreMaintenance = { enabled: false, restoreJobId: null, startedAt: null, startedById: null, startedByRole: null, reason: null, selectedBackupFolderName: null, selectedBackupPath: null, emergencyBackupPath: null, handoffPath: null, updatedAt: null };
  return {
    items: [backup], meta: { page: 1, limit: 10, total: 1, totalPages: 1 },
    settings: {
      backupRoot: "E:\\EntryControlBackups", rootExists: true, scriptPath: "scripts/backup-database.ps1", scriptExists: true, pgDumpPath: "pg_dump", pgDumpAvailable: true,
      restoreTools: { createdbPath: null, dropdbPath: null, pgRestorePath: null, psqlPath: null, available: false }, timeoutMs: 300000, activeJob: null, activeOperationRuns: [], restoreMaintenance,
      storage: { currentRoot: "E:\\EntryControlBackups", recommendedRoot: "E:\\EntryControlBackups", source: "configured", envLocked: false, configPath: "backup-storage.json", configExists: true, isRecommended: true, needsSetup: false, health: { exists: true, writable: true, outsideProject: true, ok: true, message: null } },
      schedule: { configPath: "backup-config.json", configExists: true, schedulerRunning: true, config: { enabled: true, backupRoot: "E:\\EntryControlBackups", frequency: "daily", dailyTime: "23:30", schedule: profiles.daily, profiles, retention: { hourly: 24, daily: 14, weekly: 8, monthly: 6, yearly: 5, preMigration: 10, manualAutoDelete: false }, externalCopy: { enabled: false, lastTarget: "", lastCopiedAt: null } }, nextRunAt: "2026-08-24T19:00:00.000Z", dueNow: false, lastScheduledBackup: backup, retention: { scheduledBackups: 7, keepCount: 14, cleanupCandidates: 0, lastCleanupAt: NOW }, profiles: { hourly: profileStatus("hourly"), daily: profileStatus("daily"), weekly: profileStatus("weekly"), monthly: profileStatus("monthly"), yearly: profileStatus("yearly") }, externalCopy: { enabled: false, lastTarget: "", lastCopiedAt: null, latestVerifiedBackupAt: NOW, reminderDue: false } },
      externalCopy: { availableDrives: [] },
    },
  };
}

function isAllowedSettingsRequest(request: string) {
  return /^(?:GET) \/api\/v1\/(?:admin-users|audit-logs(?:\/options|\/[^/?]+)?|backups)(?:\?|$)/u.test(request);
}

async function fulfillNotFound(route: Route) {
  await route.fulfill({ status: 404, json: { message: "Route not found" } });
}

async function settleVisuals(page: Page) {
  await page.addStyleTag({ content: "*,*::before,*::after{animation-delay:0s!important;animation-duration:0s!important;caret-color:transparent!important;scroll-behavior:auto!important;transition-delay:0s!important;transition-duration:0s!important}" });
  await page.evaluate(async () => { await document.fonts.ready; });
}

function screenshotOptions() {
  return { animations: "disabled" as const, caret: "hide" as const, fullPage: false, scale: "css" as const };
}
