import { expect, test, type Page } from "@playwright/test";
import { FULL_TEST_IDENTITY } from "./auth-fixtures";

const NOW = "2026-08-24T08:00:00.000Z";
const EXPIRES_AT = "2026-08-24T20:00:00.000Z";
const EMPLOYEE_ID = "cmemployee00000000000000001";
const ATTENDANCE_FEATURES = [
  "ADMIN_USERS",
  "ATTENDANCE_DAILY",
  "ATTENDANCE_DASHBOARD",
  "ATTENDANCE_EXPORT",
  "ATTENDANCE_REPORTS",
  "AUDIT_LOGS",
  "AUTH",
  "BACKUPS",
  "DEVICES",
  "EMPLOYEES",
  "ENTRY_LOGS",
];
const UNSELECTED_OPTIONAL_FEATURES = [
  "ATTENDANCE_COMPLIANCE",
  "INBOX",
  "SOUNDS",
  "DEVICE_DIAGNOSTICS",
  "DOOR_CONTROL",
];
const ATTENDANCE_PERMISSIONS = [
  "SIGN_IN",
  "ADMIN_USERS_MANAGE",
  "ROLES_MANAGE",
  "MEMBERS_VIEW",
  "MEMBERS_WRITE",
  "ATTENDANCE_VIEW",
  "ATTENDANCE_EXPORT",
  "ATTENDANCE_MANUAL",
  "ATTENDANCE_JUSTIFY",
  "DEVICES_VIEW",
  "DEVICES_DIAGNOSTICS",
  "DEVICES_USER_SYNC",
  "DEVICES_ENROLL",
  "DEVICES_CLEAR_LOGS",
  "DOOR_UNLOCK",
  "BACKUP_CREATE",
  "BACKUP_SETTINGS_MANAGE",
  "AUDIT_LOG_VIEW",
  "SYSTEM_SETTINGS_MANAGE",
];

const excludedDirectUrls = [
  "/membership-plans",
  "/payroll",
  "/expenses",
  "/membership-report",
  "/payments",
  "/payments/memberships",
  "/payments/payroll",
  "/payments/expenses",
  "/reports/attendance-compliance",
  "/reports/customer-activity",
  "/reports/debt-aging",
  "/reports/renewal-forecast",
  "/reports/payroll-variance",
  "/reports/cashflow",
  "/settings/membership-plans",
  "/settings/staff-groups",
  "/settings/sounds",
  "/inbox",
  "/devices/diagnostics",
  "/devices/raw-logs",
  "/devices/door-control",
  "/push-test",
];

test("every Phase 3 excluded direct URL is generic Not Found and produces no business request", async ({ page }) => {
  test.setTimeout(300_000);
  const optionalWebsocketUrls: string[] = [];
  page.on("websocket", (socket) => {
    if (new URL(socket.url()).pathname === "/ws/inbox") optionalWebsocketUrls.push(socket.url());
  });
  const requests = await mockAttendanceApi(
    page,
    true,
    ATTENDANCE_PERMISSIONS,
    [...ATTENDANCE_FEATURES, ...UNSELECTED_OPTIONAL_FEATURES]
  );

  for (const path of excludedDirectUrls) {
    requests.length = 0;
    await page.goto(path, { waitUntil: "domcontentloaded" });
    try {
      await expect(page.getByTestId("generic-not-found"), path).toBeVisible({ timeout: 60_000 });
    } catch (error) {
      throw new Error(`${path}: bootstrap requests: ${requests.join(", ")}`, { cause: error });
    }
    await expect(page.locator("body"), path).not.toContainText(/Customer|Membership|Payroll|Expense|Financial/i);
    expect(businessRequests(requests), path).toEqual([]);
    expect(optionalWebsocketUrls, `${path} opened the unselected Inbox WebSocket`).toEqual([]);
  }
});

test("all promoted Attendance routes support direct loading and only call allowlisted APIs", async ({ page }) => {
  const requests = await mockAttendanceApi(page);
  const routes: Array<[string, string]> = [
    ["/", "attendance-dashboard"],
    ["/dashboard", "attendance-dashboard"],
    ["/employees", "employees-list"],
    ["/employees/add", "employee-form-add"],
    [`/employees/${EMPLOYEE_ID}`, "employee-detail"],
    [`/employees/${EMPLOYEE_ID}/edit`, "employee-form-edit"],
    ["/members", "employees-list"],
    ["/members/add", "employee-form-add"],
    [`/members/${EMPLOYEE_ID}`, "employee-detail"],
    [`/members/${EMPLOYEE_ID}/edit`, "employee-form-edit"],
    ["/attendance", "staff-daily-attendance"],
    ["/entry-logs", "staff-entry-logs"],
    ["/reports", "attendance-report"],
    ["/reports/attendance", "attendance-report"],
    ["/devices", "staff-devices"],
    ["/settings", "attendance-admin-users"],
    ["/settings/admin-users", "attendance-admin-users"],
    ["/settings/audit-logs", "audit-logs-page"],
    ["/settings/backups", "backups-page"],
  ];

  for (const [path, testId] of routes) {
    await page.goto(path, { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId(testId), path).toBeVisible();
  }

  assertAttendanceNetworkOnly(requests);
});

test("login bootstrap does not call protected or excluded APIs", async ({ page }) => {
  const requests = await mockAttendanceApi(page, false);
  await page.goto("/login", { waitUntil: "domcontentloaded" });
  await expect(page.getByAltText("Entry Control Attendance")).toBeVisible();
  await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
  expect(businessRequests(requests)).toEqual([]);
});

test("English, Dari and Pashto plus persisted light and dark themes pass on the real Attendance shell", async ({ page }) => {
  const requests = await mockAttendanceApi(page);
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/employees", { waitUntil: "domcontentloaded" });
  await page.evaluate(() => localStorage.removeItem("ecs-theme"));
  await page.reload({ waitUntil: "domcontentloaded" });

  const html = page.locator("html");
  const shell = page.getByTestId("shared-app-shell");
  const theme = page.getByTestId("shared-theme-toggle");

  await expect(shell).toHaveAttribute("data-theme", "dark");
  await expect(html).not.toHaveClass(/theme-light/);
  const darkBackground = await shell.evaluate((element) => getComputedStyle(element).backgroundColor);

  await theme.click();
  await expect(shell).toHaveAttribute("data-theme", "light");
  await expect(html).toHaveClass(/theme-light/);
  await expect.poll(() => page.evaluate(() => localStorage.getItem("ecs-theme"))).toBe("light");
  const lightBackground = await shell.evaluate((element) => getComputedStyle(element).backgroundColor);
  expect(lightBackground).not.toBe(darkBackground);

  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("shared-app-shell")).toHaveAttribute("data-theme", "light");
  await expect(page.locator("html")).toHaveClass(/theme-light/);

  await selectSharedLanguage(page, "fa");
  await expect(page.locator("html")).toHaveAttribute("lang", "fa");
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(page.getByRole("link", { name: "کارمندان", exact: true })).toBeVisible();

  await selectSharedLanguage(page, "ps");
  await expect(page.locator("html")).toHaveAttribute("lang", "ps");
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(page.getByRole("link", { name: "کارکوونکي", exact: true })).toBeVisible();

  await selectSharedLanguage(page, "en");
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page.locator("html")).toHaveAttribute("dir", "ltr");
  await expect(page.getByRole("link", { name: "Employees", exact: true })).toBeVisible();

  await page.getByTestId("shared-theme-toggle").click();
  await expect(page.getByTestId("shared-app-shell")).toHaveAttribute("data-theme", "dark");
  await expect(page.locator("html")).not.toHaveClass(/theme-light/);
  assertAttendanceNetworkOnly(requests);
});

test("Phase 5.2 Audit viewer exposes Staff-safe history and redacted details only", async ({ page }) => {
  const requests = await mockAttendanceApi(page);
  await page.goto("/settings/audit-logs", { waitUntil: "domcontentloaded" });

  const auditPage = page.getByTestId("audit-logs-page");
  await expect(auditPage).toBeVisible();
  await expect(page.getByTestId("audit-log-row-attendance-audit-1")).toBeVisible();
  await expect(auditPage).toContainText("attendance.manual.created");
  await expect(auditPage).not.toContainText(/Customer|Membership|Payment|Payroll|Expense|Financial/u);

  await page.getByTestId("audit-log-view-attendance-audit-1").click();
  const detail = page.getByTestId("audit-log-detail-modal");
  await expect(detail).toBeVisible();
  await expect(detail).toContainText("[REDACTED]");
  await expect(detail).not.toContainText("50000");

  expect([...new Set(requests.filter((request) => request.includes("/api/v1/audit-logs")))].sort()).toEqual([
    "GET /api/v1/audit-logs/options",
    "GET /api/v1/audit-logs?page=1&pageSize=20",
    "GET /api/v1/audit-logs/attendance-audit-1",
  ].sort());
  assertAttendanceNetworkOnly(requests);
});

test("Phase 4.1 dashboard renders Staff attendance, warnings, device health, and seven-day trend", async ({ page }) => {
  const requests = await mockAttendanceApi(page);
  await page.goto("/dashboard", { waitUntil: "domcontentloaded" });

  const dashboard = page.getByTestId("attendance-dashboard");
  await expect(dashboard).toBeVisible();
  await expect(dashboard.locator(".dashboard-v2-header")).toHaveCount(0);
  await expect(dashboard).toContainText("Active employees");
  await expect(dashboard).toContainText("Missing checkout");
  await expect(dashboard).toContainText("Unknown IDs");
  await expect(dashboard).toContainText("Seven-day attendance trend");
  const dashboardRequests = requests.filter((request) => request.includes("/api/v1/dashboard"));
  expect(dashboardRequests.length).toBeGreaterThan(0);
  expect([...new Set(dashboardRequests)]).toEqual(["GET /api/v1/dashboard/summary"]);
  assertAttendanceNetworkOnly(requests);
});

test("Phase 4.1 dashboard requires ATTENDANCE_VIEW before requesting its summary", async ({ page }) => {
  const requests = await mockAttendanceApi(page, true, ["SIGN_IN"]);
  await page.goto("/dashboard", { waitUntil: "domcontentloaded" });

  await expect(page.getByText("Permission required")).toBeVisible();
  expect(requests.some((request) => request.includes("/api/v1/dashboard/summary"))).toBe(false);
});

test("Phase 4.2 reuses the report workspace with Staff-only filters, KPIs, and tabs", async ({ page }) => {
  const requests = await mockAttendanceApi(page, true, ATTENDANCE_PERMISSIONS.filter((permission) => permission !== "ATTENDANCE_EXPORT"));
  await page.goto("/reports/attendance?memberType=customer&paymentStatus=PAID", { waitUntil: "domcontentloaded" });

  const report = page.getByTestId("attendance-report");
  await expect(report).toBeVisible();
  await expect(report.getByRole("heading", { name: "Attendance report" })).toBeVisible();
  await expect(report).toContainText("Present employee-days");
  await expect(report).toContainText("Early-leave minutes");
  await expect(report).toContainText("Overtime minutes");
  await expect(report).toContainText("Justified absences");
  await expect(report).not.toContainText(/Customer|Membership|Payment|Salary|Payroll|Financial/i);
  await expect(page.getByTestId("attendance-report-export-menu")).toHaveCount(0);

  await page.getByTestId("attendance-report-tab-employees").click();
  await expect.poll(() => requests.some((request) => request.includes("/reports/attendance/members"))).toBe(true);
  await page.getByTestId("attendance-report-tab-evidence").click();
  await expect.poll(() => requests.some((request) => request.includes("/reports/attendance/evidence"))).toBe(true);

  const reportRequests = requests.filter((request) => request.includes("/api/v1/reports/attendance/"));
  expect(reportRequests.some((request) => /memberType|paymentStatus|export|client-export/u.test(request))).toBe(false);
  assertAttendanceNetworkOnly(requests);
});

test("Phase 4.3 exposes Staff-only exports only with ATTENDANCE_EXPORT", async ({ page }) => {
  const requests = await mockAttendanceApi(page);
  await page.goto("/reports/attendance", { waitUntil: "domcontentloaded" });

  await expect(page.getByTestId("attendance-report-export-menu")).toBeVisible();
  for (const [testId, endpoint] of [
    ["attendance-report-export-csv-daily", "/export.csv"],
    ["attendance-report-export-csv-members", "/export.csv"],
    ["attendance-report-export-csv-evidence", "/export.csv"],
    ["attendance-report-export-xlsx", "/export.xlsx"],
    ["attendance-report-export-pdf", "/export.pdf"],
  ] as const) {
    const before = requests.filter((request) => request.includes(endpoint)).length;
    await page.getByTestId("attendance-report-export-menu").click();
    await page.getByTestId(testId).click();
    await expect.poll(() => requests.filter((request) => request.includes(endpoint)).length).toBe(before + 1);
  }

  const exportRequests = requests.filter((request) => request.includes("/api/v1/reports/attendance/export."));
  expect(exportRequests).toHaveLength(5);
  expect(exportRequests.every((request) => !/memberType|payment|financial|client-export/iu.test(request))).toBe(true);
  assertAttendanceNetworkOnly(requests);

  await page.unrouteAll({ behavior: "wait" });
  const financialOnlyRequests = await mockAttendanceApi(
    page,
    true,
    ["SIGN_IN", "ATTENDANCE_VIEW", "FINANCIAL_EXPORT"]
  );
  await page.goto("/reports/attendance", { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("attendance-report-export-menu")).toHaveCount(0);
  expect(financialOnlyRequests.some((request) => request.includes("/export."))).toBe(false);
});

test("Phase 4.4 Entry Logs exports preserve filters without page or Customer scope", async ({ page }) => {
  const requests = await mockAttendanceApi(page);
  await page.goto("/entry-logs", { waitUntil: "domcontentloaded" });
  await page.getByTestId("entry-logs-export-csv").click();
  await page.getByTestId("entry-logs-export-xlsx").click();
  await expect.poll(() => requests.filter((request) => request.includes("/api/v1/attendance/export.")).length).toBe(2);
  const exports = requests.filter((request) => request.includes("/api/v1/attendance/export."));
  expect(exports.every((request) => !/memberType|page=|pageSize=|customer|payment|financial/iu.test(request))).toBe(true);
  assertAttendanceNetworkOnly(requests);
});

test("Phase 4.5 Monthly Timecard reconciles totals and exports CSV/XLSX/PDF", async ({ page }) => {
  const requests = await mockAttendanceApi(page);
  await page.goto("/reports/attendance?tab=timecard&month=2026-08", { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("monthly-timecard")).toBeVisible();
  await expect(page.getByTestId("monthly-timecard-row")).toContainText("Eraj Naseri");
  await expect(page.getByTestId("monthly-timecard-row")).toContainText("8h 0m");
  for (const format of ["csv", "xlsx", "pdf"] as const) {
    await page.getByTestId(`timecard-export-${format}`).click();
  }
  await expect.poll(() => requests.filter((request) => request.includes("/timecard/export.")).length).toBe(3);
  const timecardRequests = requests.filter((request) => request.includes("/reports/attendance/timecard"));
  expect(timecardRequests.every((request) => request.includes("month=2026-08"))).toBe(true);
  expect(timecardRequests.every((request) => !/memberType|salary|payroll|payment|financial/iu.test(request))).toBe(true);
  assertAttendanceNetworkOnly(requests);
});

test("Phase 4.6 export controls, language parameters, and filenames are branded in English, Dari, and Pashto", async ({ page }) => {
  const requests = await mockAttendanceApi(page);
  await page.goto("/reports/attendance?tab=timecard&month=2026-08", { waitUntil: "domcontentloaded" });

  const englishDownload = page.waitForEvent("download");
  await page.getByTestId("timecard-export-pdf").click();
  expect((await englishDownload).suggestedFilename()).toBe("entry-control-attendance-monthly-timecard-2026-08.pdf");

  await selectSharedLanguage(page, "fa");
  await expect(page.getByTestId("attendance-report-tab-timecard")).toHaveText("تایم‌کارت ماهانه");
  await expect(page.getByTestId("timecard-export-csv")).toHaveText("CSV تایم‌کارت");
  const dariDownload = page.waitForEvent("download");
  await page.getByTestId("timecard-export-csv").click();
  expect((await dariDownload).suggestedFilename()).toBe("entry-control-attendance-monthly-timecard-2026-08.csv");

  await selectSharedLanguage(page, "ps");
  await expect(page.getByTestId("attendance-report-tab-timecard")).toHaveText("میاشتنی وخت‌کارت");
  await expect(page.getByTestId("timecard-export-xlsx")).toHaveText("د وخت‌کارت XLSX");
  const pashtoDownload = page.waitForEvent("download");
  await page.getByTestId("timecard-export-xlsx").click();
  expect((await pashtoDownload).suggestedFilename()).toBe("entry-control-attendance-monthly-timecard-2026-08.xlsx");

  const exports = requests.filter((request) => request.includes("/timecard/export."));
  expect(exports.some((request) => request.includes("lang=en"))).toBe(true);
  expect(exports.some((request) => request.includes("lang=fa"))).toBe(true);
  expect(exports.some((request) => request.includes("lang=ps"))).toBe(true);

  await page.goto("/entry-logs", { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("entry-logs-export-csv")).toHaveText("CSV صادرول");
  const entryDownload = page.waitForEvent("download");
  await page.getByTestId("entry-logs-export-csv").click();
  expect((await entryDownload).suggestedFilename()).toMatch(/^entry-control-attendance-entry-logs-\d{4}-\d{2}-\d{2}\.csv$/u);
  expect(requests.some((request) => request.includes("/api/v1/attendance/export.csv") && request.includes("lang=ps"))).toBe(true);
  assertAttendanceNetworkOnly(requests);
});

async function mockAttendanceApi(
  page: Page,
  authenticated = true,
  permissions = ATTENDANCE_PERMISSIONS,
  features = ATTENDANCE_FEATURES
) {
  const requests: string[] = [];
  await page.route(/^https?:\/\/[^/]+\/api(?:\/|$)/u, async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    requests.push(`${request.method()} ${url.pathname}${url.search}`);

    if (url.pathname === "/api") {
      await route.fulfill({ json: { ...FULL_TEST_IDENTITY, edition: "ATTENDANCE" } });
      return;
    }
    if (url.pathname === "/api/v1/auth/setup-status") {
      await route.fulfill({ json: { setupRequired: false, activeAdminCount: 1, hasGymOwner: true, hasVendorOwner: false } });
      return;
    }
    if (url.pathname === "/api/v1/auth/me") {
      await route.fulfill(authenticated ? { json: authPayload(permissions, features) } : { status: 401, json: { message: "Authentication required" } });
      return;
    }
    if (url.pathname === "/api/v1/employees/options/staff-groups") {
      await route.fulfill({ json: [] });
      return;
    }
    if (url.pathname === `/api/v1/employees/${EMPLOYEE_ID}/attendance`) {
      await route.fulfill({ json: [] });
      return;
    }
    if (url.pathname === `/api/v1/employees/${EMPLOYEE_ID}`) {
      await route.fulfill({ json: employeeDetail() });
      return;
    }
    if (url.pathname === "/api/v1/employees") {
      await route.fulfill({ json: { items: [], total: 0, skip: 0, take: 20 } });
      return;
    }
    if (url.pathname === "/api/v1/attendance/options/devices") {
      await route.fulfill({ json: [] });
      return;
    }
    if (url.pathname === "/api/v1/dashboard/summary") {
      await route.fulfill({ json: dashboardSummary() });
      return;
    }
    if (url.pathname === "/api/v1/reports/attendance/options") {
      await route.fulfill({ json: {
        employees: [{ id: EMPLOYEE_ID, code: "1", name: "Eraj Naseri" }],
        groups: [{ id: "cmgroup00000000000000000001", name: "Operations" }],
        shifts: [{ id: "cmshift00000000000000000001", name: "Morning", start: "08:00", end: "16:00" }],
        devices: [{ id: "cmdevice0000000000000000001", name: "K40" }],
      } });
      return;
    }
    if (url.pathname === "/api/v1/reports/attendance/summary") {
      await route.fulfill({ json: reportSummary() });
      return;
    }
    if (url.pathname === "/api/v1/reports/attendance/daily") {
      await route.fulfill({ json: { items: [reportDay()], pageInfo: pageInfo() } });
      return;
    }
    if (url.pathname === "/api/v1/reports/attendance/members") {
      await route.fulfill({ json: { items: [reportEmployee()], pageInfo: pageInfo() } });
      return;
    }
    if (url.pathname === "/api/v1/reports/attendance/evidence") {
      await route.fulfill({ json: { items: [reportEvidence()], pageInfo: pageInfo() } });
      return;
    }
    if (url.pathname === "/api/v1/reports/attendance/timecard") {
      await route.fulfill({ json: monthlyTimecard() });
      return;
    }
    if (/^\/api\/v1\/reports\/attendance\/timecard\/export\.(?:csv|xlsx|pdf)$/u.test(url.pathname)) {
      await route.fulfill({ body: "timecard-export", contentType: "application/octet-stream" });
      return;
    }
    if (/^\/api\/v1\/reports\/attendance\/export\.(?:csv|xlsx|pdf)$/u.test(url.pathname)) {
      await route.fulfill({ body: "phase-4-3-export", contentType: "application/octet-stream" });
      return;
    }
    if (url.pathname === "/api/v1/attendance/daily") {
      await route.fulfill({ json: emptyDaily() });
      return;
    }
    if (/^\/api\/v1\/attendance\/export\.(?:csv|xlsx)$/u.test(url.pathname)) {
      await route.fulfill({ body: "entry-export", contentType: "application/octet-stream" });
      return;
    }
    if (url.pathname === "/api/v1/attendance") {
      await route.fulfill({ json: { items: [], page: 1, pageSize: 20, total: 0, summary: { totalIn: 0, totalOut: 0, uniqueVisitors: 0, deniedAttempts: 0 } } });
      return;
    }
    if (url.pathname === "/api/v1/devices/status") {
      await route.fulfill({ json: { devices: [] } });
      return;
    }
    if (url.pathname === "/api/v1/devices/events") {
      await route.fulfill({ json: { items: [] } });
      return;
    }
    if (url.pathname === "/api/v1/devices") {
      await route.fulfill({ json: [] });
      return;
    }
    if (url.pathname === "/api/v1/admin-users") {
      await route.fulfill({ json: { items: [authPayload().user], roles: ["GYM_OWNER", "MANAGER", "OPERATOR", "DEVICE_OPERATOR", "READ_ONLY_AUDITOR"] } });
      return;
    }
    if (url.pathname === "/api/v1/audit-logs/options") {
      await route.fulfill({ json: {
        actions: ["attendance.manual.created"],
        targetTypes: ["AttendanceLog"],
        actors: [authPayload().user],
        actorTypes: ["ADMIN"],
        actorRoles: ["GYM_OWNER"],
      } });
      return;
    }
    if (url.pathname === "/api/v1/audit-logs/attendance-audit-1") {
      await route.fulfill({ json: {
        ...attendanceAuditItem(),
        userAgent: "Phase 5.2 browser",
        sessionId: "session-1",
        requestId: "request-1",
        beforeData: null,
        afterData: { memberType: "STAFF", isStaff: true, salaryAmount: "[REDACTED]" },
        metadata: { editionScope: "ATTENDANCE_STRICT_STAFF", memberType: "STAFF", isStaff: true },
      } });
      return;
    }
    if (url.pathname === "/api/v1/audit-logs") {
      await route.fulfill({ json: {
        items: [attendanceAuditItem()],
        page: 1,
        pageSize: 20,
        total: 1,
        summary: { total: 1, successful: 1, failed: 0 },
      } });
      return;
    }
    if (url.pathname === "/api/v1/backups") {
      await route.fulfill({ json: emptyBackupList() });
      return;
    }
    await route.fulfill({ status: 404, json: { message: "Route not found" } });
  });
  return requests;
}

function authPayload(permissions = ATTENDANCE_PERMISSIONS, features = ATTENDANCE_FEATURES) {
  return {
    edition: "ATTENDANCE",
    features,
    permissions,
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

function reportSummary() {
  return { range: { from: "2026-08-01", to: "2026-08-24" }, kpis: {
    presentDays: 18, absentDays: 2, lateCount: 3, lateMinutes: 25, earlyLeaveCount: 1,
    earlyLeaveMinutes: 10, overtimeMinutes: 45, justifiedCount: 1, unscheduledPresentCount: 1,
    deniedCount: 2, noCheckoutCount: 1,
  } };
}

function reportDay() {
  return {
    date: "2026-08-24", presentCount: 8, absentCount: 1, lateCount: 2, lateMinutes: 15,
    earlyLeaveCount: 1, earlyLeaveMinutes: 5, overtimeMinutes: 20, justifiedCount: 1,
    unscheduledPresentCount: 0, deniedCount: 1, noCheckoutCount: 1,
  };
}

function reportEmployee() {
  return {
    memberId: EMPLOYEE_ID, memberCode: "1", memberName: "Eraj Naseri", memberType: "STAFF",
    expectedShifts: 20, presentDays: 18, absentDays: 2, lateCount: 3, lateMinutes: 25,
    earlyLeaveCount: 1, earlyLeaveMinutes: 10, overtimeMinutes: 45, justifiedCount: 1,
    unscheduledPresentCount: 1, deniedCount: 2, noCheckoutCount: 1,
  };
}

function reportEvidence() {
  return {
    id: "log-1", timestamp: NOW, memberId: EMPLOYEE_ID, memberName: "Eraj Naseri", memberType: "STAFF",
    eventType: "IN", deviceId: "cmdevice0000000000000000001", deviceName: "K40", source: "DEVICE",
    authorized: true, result: "authorized", denyReason: null, notes: null,
  };
}

function monthlyTimecard() {
  return {
    month: "2026-08",
    pageInfo: { page: 1, pageSize: 20, totalItems: 1, totalPages: 1 },
    items: [{
      memberId: EMPLOYEE_ID, memberCode: "1", memberName: "Eraj Naseri", staffGroupId: null, staffGroupName: "Operations",
      totals: { scheduledMinutes: 480, actualMinutes: 450, pairedSessionCount: 1, presentDays: 1, absentDays: 0, justifiedDays: 0, lateMinutes: 10, earlyLeaveMinutes: 0, overtimeMinutes: 0, missingPunchDays: 0, invalidPunchDays: 0, unscheduledDays: 0 },
      days: [{ date: "2026-08-24", status: "LATE", shiftName: "Morning", scheduledMinutes: 480, actualMinutes: 450, pairedSessionCount: 1, checkInAt: NOW, checkOutAt: NOW, lateMinutes: 10, earlyLeaveMinutes: 0, overtimeMinutes: 0, missingPunch: false, invalidPunch: false, justified: false, unscheduled: false }],
    }],
  };
}

function pageInfo() {
  return { page: 1, pageSize: 20, totalItems: 1, totalPages: 1 };
}

function emptyDaily() {
  return {
    date: "2026-08-24",
    summary: { present: 0, absent: 0, late: 0, inside: 0, justified: 0, unscheduledPresentCount: 0, deniedCount: 0 },
    warnings: { noCheckout: 0, noShift: 0, multipleEvents: 0 },
    rows: [],
  };
}

function employeeDetail() {
  return {
    id: EMPLOYEE_ID, code: "1", memberType: "STAFF", isStaff: true, firstName: "Eraj", lastName: "Naseri",
    fatherName: null, phone: "0700000000", email: null, gender: "MALE", birthDate: null, nationalId: null,
    photoUrl: null, status: "ACTIVE", notes: null, roleType: "EMPLOYEE", customTitle: null, profile: null,
    staffGroupId: null, staffGroup: null, archivedAt: null, active: true,
    access: { allowedDays: [1, 2, 3, 4, 5], allowedTimeRanges: [], maxEntriesPerDay: null },
    overtime: { allowOvertime: false, maxOvertimePerDay: null }, shifts: [],
    createdAt: NOW, updatedAt: NOW,
  };
}

function attendanceAuditItem() {
  return {
    id: "attendance-audit-1",
    actorType: "ADMIN",
    actorId: "admin-1",
    actorRole: "GYM_OWNER",
    actor: authPayload().user,
    action: "attendance.manual.created",
    targetType: "AttendanceLog",
    targetId: "attendance-log-1",
    success: true,
    ipAddress: "127.0.0.1",
    createdAt: NOW,
    hasDetails: true,
  };
}

function businessRequests(requests: string[]) {
  return requests.filter((request) => request !== "GET /api" && !request.includes("/api/v1/auth/"));
}

async function selectSharedLanguage(page: Page, language: "en" | "fa" | "ps") {
  await page.getByTestId("shared-language-toggle").click();
  await page.getByTestId(`shared-language-option-${language}`).click();
}

function assertAttendanceNetworkOnly(requests: string[]) {
  const forbidden = businessRequests(requests).filter((request) =>
    /\/api\/v1\/(?:members|membership|payments|payroll|expenses|inbox|sounds)(?:\/|\?|$)/u.test(request)
    || /\/api\/v1\/reports\/(?!attendance\/(?:options|summary|daily|members|evidence|timecard(?:\/export\.(?:csv|xlsx|pdf))?|export\.(?:csv|xlsx|pdf))(?:\?|$))/u.test(request)
    || /\/api\/v1\/dashboard\/(?!summary(?:\?|$))/u.test(request)
    || /\/api\/v1\/devices\/(?:diagnostics|raw-logs|scan|push-test|events\/push)(?:\/|\?|$)/u.test(request)
    || /\/api\/v1\/devices\/[^/?]+\/(?:diagnose|scan|unlock|logs(?:\/clear)?)(?:\/|\?|$)/u.test(request)
    || /(?:\?|&)memberType=/u.test(request)
  );
  expect(forbidden).toEqual([]);
}

function emptyBackupList() {
  const disabledProfile = (frequency: "hourly" | "daily" | "weekly" | "monthly" | "yearly") => ({
    enabled: false, frequency, time: "23:30", minute: 30, dayOfWeek: 1, dayOfMonth: 1, month: 1,
  });
  const profiles = {
    hourly: disabledProfile("hourly"), daily: disabledProfile("daily"), weekly: disabledProfile("weekly"),
    monthly: disabledProfile("monthly"), yearly: disabledProfile("yearly"),
  };
  const profileStatus = (frequency: keyof typeof profiles) => ({
    enabled: false, frequency, nextRunAt: null, dueNow: false, scheduledBackups: 0,
    keepCount: 0, cleanupCandidates: 0, lastScheduledBackup: null,
  });
  const restoreMaintenance = {
    enabled: false, restoreJobId: null, startedAt: null, startedById: null, startedByRole: null,
    reason: null, selectedBackupFolderName: null, selectedBackupPath: null, emergencyBackupPath: null,
    handoffPath: null, updatedAt: null,
  };
  return {
    items: [], meta: { page: 1, limit: 20, total: 0, totalPages: 0 },
    settings: {
      backupRoot: "E:\\EntryControlBackups", rootExists: true, scriptPath: "scripts/backup-database.ps1",
      scriptExists: true, pgDumpPath: "pg_dump", pgDumpAvailable: true,
      restoreTools: { createdbPath: null, dropdbPath: null, pgRestorePath: null, psqlPath: null, available: false },
      timeoutMs: 300000, activeJob: null, activeOperationRuns: [], restoreMaintenance,
      storage: {
        currentRoot: "E:\\EntryControlBackups", recommendedRoot: "E:\\EntryControlBackups", source: "configured",
        envLocked: false, configPath: "backup-storage.json", configExists: true, isRecommended: true, needsSetup: false,
        health: { exists: true, writable: true, outsideProject: true, ok: true, message: null },
      },
      schedule: {
        configPath: "backup-config.json", configExists: true, schedulerRunning: true,
        config: {
          enabled: false, backupRoot: "E:\\EntryControlBackups", frequency: "daily", dailyTime: "23:30",
          schedule: profiles.daily, profiles,
          retention: { hourly: 24, daily: 14, weekly: 8, monthly: 6, yearly: 5, preMigration: 10, manualAutoDelete: false },
          externalCopy: { enabled: false, lastTarget: "", lastCopiedAt: null },
        },
        nextRunAt: null, dueNow: false, lastScheduledBackup: null,
        retention: { scheduledBackups: 0, keepCount: 0, cleanupCandidates: 0, lastCleanupAt: null },
        profiles: {
          hourly: profileStatus("hourly"), daily: profileStatus("daily"), weekly: profileStatus("weekly"),
          monthly: profileStatus("monthly"), yearly: profileStatus("yearly"),
        },
        externalCopy: { enabled: false, lastTarget: "", lastCopiedAt: null, latestVerifiedBackupAt: null, reminderDue: false },
      },
      externalCopy: { availableDrives: [] },
    },
  };
}
