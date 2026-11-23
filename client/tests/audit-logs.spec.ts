import { expect, test, type Page, type Route } from "@playwright/test";
import { FULL_TEST_FEATURES, FULL_TEST_IDENTITY } from "./auth-fixtures";

const API_GLOB = /^https?:\/\/[^/]+\/api(?:\/|$)/;
const NOW = "2026-07-18T08:30:00.000Z";
const MOJIBAKE_RE = /(?:Ã.|Â.|â€|Ø.|Ù.|Û.|�)/u;

const localizedPages = [
  {
    language: "en",
    title: "Audit logs",
    direction: "ltr",
    theme: "light",
    expenseTokens: ["Expense", "Reversed"],
    membershipTarget: "Membership",
    membershipActions: ["Created", "Renewed", "Updated", "Cancelled"],
    paymentTarget: "Payment",
    paymentAction: "Recorded",
    payrollTarget: "Payroll payment",
    payrollAction: "Recorded",
    memberTarget: "Member",
    memberActions: ["Created", "Updated", "Shifts", "Deleted"],
    planTarget: "Membership plan",
    planActions: ["Created", "Updated", "Deleted"],
    staffGroupTarget: "Staff group",
    staffGroupActions: ["Created", "Updated", "Deleted"],
    soundSettingsTarget: "Sound settings",
    soundAssetTarget: "Sound file",
    soundActions: ["Sound · Settings · Updated", "Sound · File · Uploaded", "Sound · File · Deleted"],
    membershipReportTarget: "Membership report",
    membershipReportAction: "Report · Membership · Exported",
    attendanceReportTargets: ["Attendance report", "Daily attendance report", "Entry logs report"],
    attendanceReportActions: ["Report · Attendance · Exported", "Report · Daily attendance · Exported", "Report · Entry logs · Exported"],
    businessReportTargets: ["Customer activity report", "Debt aging report", "Renewal forecast report", "Payroll variance report", "Attendance compliance report", "Cashflow report"],
    businessReportActions: ["Report · Customer activity · Exported", "Report · Debt aging · Exported", "Report · Renewal forecast · Exported", "Report · Payroll variance · Exported", "Report · Attendance compliance · Exported", "Report · Cashflow · Exported"],
    deviceTarget: "Device",
    deviceActions: [
      "Created",
      "Updated",
      "Enabled",
      "Disabled",
      "Diagnosed",
      "Tested",
      "Connection tested",
      "Scan · Started",
      "Scan · Cancelled",
      "Enrollment · Started",
      "Users · Synced",
      "User · Upserted",
      "User · Deleted",
      "Time · Updated",
      "Door · Unlocked",
      "Logs · Cleared",
    ],
  },
  {
    language: "fa",
    title: "سوابق فعالیت‌ها",
    direction: "rtl",
    theme: "dark",
    expenseTokens: ["مصارف", "برگشت داده شد"],
    membershipTarget: "عضویت",
    membershipActions: ["ایجاد شد", "تمدید شد", "به‌روز شد", "لغو شد"],
    paymentTarget: "پرداخت",
    paymentAction: "ثبت شد",
    payrollTarget: "پرداخت معاش",
    payrollAction: "ثبت شد",
    memberTarget: "عضو",
    memberActions: ["ایجاد شد", "به‌روز شد", "شیفت‌ها", "حذف شد"],
    planTarget: "پلان عضویت",
    planActions: ["ایجاد شد", "به‌روز شد", "حذف شد"],
    staffGroupTarget: "گروه کارمندان",
    staffGroupActions: ["ایجاد شد", "به‌روز شد", "حذف شد"],
    soundSettingsTarget: "تنظیمات صدا",
    soundAssetTarget: "فایل صدا",
    soundActions: ["صدا · تنظیمات · به‌روز شد", "صدا · فایل صدا · آپلود شد", "صدا · فایل صدا · حذف شد"],
    membershipReportTarget: "گزارش عضویت",
    membershipReportAction: "گزارش · عضویت · صادر شد",
    attendanceReportTargets: ["گزارش حاضری", "گزارش حاضری روزانه", "گزارش لاگ‌های ورود"],
    attendanceReportActions: ["گزارش · حاضری · صادر شد", "گزارش · حاضری روزانه · صادر شد", "گزارش · لاگ‌های ورود · صادر شد"],
    businessReportTargets: ["گزارش فعالیت مشتریان", "گزارش عمر بدهی", "گزارش پیش‌بینی تمدید", "گزارش تفاوت معاش", "گزارش انطباق حاضری", "گزارش جریان نقدی"],
    businessReportActions: ["گزارش · فعالیت مشتریان · صادر شد", "گزارش · عمر بدهی · صادر شد", "گزارش · پیش‌بینی تمدید · صادر شد", "گزارش · تفاوت معاش · صادر شد", "گزارش · انطباق حاضری · صادر شد", "گزارش · جریان نقدی · صادر شد"],
    deviceTarget: "دستگاه",
    deviceActions: [
      "ایجاد شد",
      "به‌روز شد",
      "فعال شد",
      "غیرفعال شد",
      "عیب‌یابی شد",
      "آزمایش شد",
      "اتصال آزمایش شد",
      "اسکن · شروع شد",
      "اسکن · لغو شد",
      "ثبت اثرانگشت · شروع شد",
      "کاربران · همگام شدند",
      "کاربر · ایجاد یا به‌روز شد",
      "کاربر · حذف شد",
      "زمان · به‌روز شد",
      "دروازه · باز شد",
      "لاگ‌ها · پاک شدند",
    ],
  },
  {
    language: "ps",
    title: "د فعالیتونو تاریخچه",
    direction: "rtl",
    theme: "light",
    expenseTokens: ["لګښت", "بېرته وګرځول شو"],
    membershipTarget: "غړیتوب",
    membershipActions: ["جوړ شو", "تمدید شو", "تازه شو", "لغوه شو"],
    paymentTarget: "تادیه",
    paymentAction: "ثبت شوه",
    payrollTarget: "د معاش تادیه",
    payrollAction: "ثبت شوه",
    memberTarget: "غړی",
    memberActions: ["جوړ شو", "تازه شو", "شفټونه", "حذف شو"],
    planTarget: "د غړیتوب پلان",
    planActions: ["جوړ شو", "تازه شو", "حذف شو"],
    staffGroupTarget: "د کارکوونکو ډله",
    staffGroupActions: ["جوړ شو", "تازه شو", "حذف شو"],
    soundSettingsTarget: "د غږ تنظیمات",
    soundAssetTarget: "د غږ فایل",
    soundActions: ["غږ · تنظیمات · تازه شو", "غږ · د غږ فایل · پورته شو", "غږ · د غږ فایل · حذف شو"],
    membershipReportTarget: "د غړیتوب راپور",
    membershipReportAction: "راپور · غړیتوب · صادر شو",
    attendanceReportTargets: ["د حاضرۍ راپور", "د ورځنۍ حاضرۍ راپور", "د ننوتلو لاګونو راپور"],
    attendanceReportActions: ["راپور · حاضري · صادر شو", "راپور · ورځنۍ حاضري · صادر شو", "راپور · د ننوتلو لاګونه · صادر شو"],
    businessReportTargets: ["د پېرودونکو د فعالیت راپور", "د پور د عمر راپور", "د نوي کولو د اټکل راپور", "د معاش د توپیر راپور", "د حاضرۍ د مطابقت راپور", "د نغدو پیسو د جریان راپور"],
    businessReportActions: ["راپور · د پېرودونکو فعالیت · صادر شو", "راپور · د پور عمر · صادر شو", "راپور · د نوي کولو اټکل · صادر شو", "راپور · د معاش توپیر · صادر شو", "راپور · د حاضرۍ مطابقت · صادر شو", "راپور · د نغدو پیسو جریان · صادر شو"],
    deviceTarget: "وسیله",
    deviceActions: [
      "جوړ شو",
      "تازه شو",
      "فعال شو",
      "غیرفعال شو",
      "تشخیص شو",
      "وازمویل شو",
      "اتصال وازمویل شو",
      "سکین · پیل شو",
      "سکین · لغوه شو",
      "د ګوتې ثبت · پیل شو",
      "کارنان · همغږي شول",
      "کارن · جوړ یا تازه شو",
      "کارن · حذف شو",
      "وخت · تازه شو",
      "دروازه · خلاصه شوه",
      "لاګونه · پاک شول",
    ],
  },
] as const;

test.describe("audit log viewer", () => {
  test("filters the read-only list and displays redacted event details", async ({ page }) => {
    const requests = await prepareApp(page, { language: "en", theme: "light", canViewAuditLogs: true });

    await page.goto("/settings/audit-logs");
    const auditPage = page.getByTestId("audit-logs-page");
    await expect(auditPage).toBeVisible();
    await expect(page.getByTestId("audit-log-row-audit-1")).toBeVisible();
    await expect(auditPage.getByText("Read only", { exact: true })).toBeVisible();

    const filteredRequest = page.waitForRequest((request) => {
      const url = new URL(request.url());
      return url.pathname === "/api/v1/audit-logs" && url.searchParams.get("search") === "failed-login";
    });
    await page.getByTestId("audit-logs-search").fill("failed-login");
    await page.getByTestId("audit-logs-apply").click();
    const filteredUrl = new URL((await filteredRequest).url());
    expect(filteredUrl.searchParams.get("page")).toBe("1");
    expect(filteredUrl.searchParams.get("pageSize")).toBe("20");

    await page.getByTestId("audit-log-view-audit-1").click();
    const modal = page.getByTestId("audit-log-detail-modal");
    await expect(modal).toBeVisible();
    await expect(modal.locator("[role='dialog']")).toHaveCSS("background-color", "rgb(248, 251, 255)");
    await expect(modal).toContainText("Audit event details");
    await expect(modal).toContainText("[REDACTED]");
    await expect(modal).not.toContainText("top-secret");
    await expect(modal.getByRole("button")).toHaveCount(1);

    await page.keyboard.press("Escape");
    await expect(modal).toHaveCount(0);
    expect(requests.auditMethods).toEqual(expect.arrayContaining(["GET"]));
    expect(requests.auditMethods.every((method) => method === "GET")).toBe(true);
  });

  for (const locale of localizedPages) {
    test(`${locale.language} renders localized content in ${locale.theme} theme`, async ({ page }) => {
      await prepareApp(page, {
        language: locale.language,
        theme: locale.theme,
        canViewAuditLogs: true,
      });

      await page.goto("/settings/audit-logs");
      const auditPage = page.getByTestId("audit-logs-page");
      await expect(auditPage).toBeVisible();
      await expect(auditPage.getByRole("heading", { level: 1 })).toHaveText(locale.title);
      await expect(auditPage).toHaveAttribute("dir", locale.direction);
      await expect(page.locator("html")).toHaveAttribute("dir", locale.direction);
      if (locale.theme === "light") {
        await expect(page.locator("html")).toHaveClass(/theme-light/u);
      } else {
        await expect(page.locator("html")).not.toHaveClass(/theme-light/u);
      }

      await expect(page.getByTestId("audit-log-row-audit-1")).toBeVisible();
      const expenseRow = page.getByTestId("audit-log-row-audit-expense-1");
      await expect(expenseRow).toBeVisible();
      for (const token of locale.expenseTokens) {
        await expect(expenseRow).toContainText(token);
      }
      const membershipRows = membershipAuditItems();
      for (let index = 0; index < membershipRows.length; index += 1) {
        const row = page.getByTestId(`audit-log-row-${membershipRows[index].id}`);
        await expect(row).toBeVisible();
        await expect(row).toContainText(locale.membershipTarget);
        await expect(row).toContainText(locale.membershipActions[index]);
      }
      const paymentRow = page.getByTestId("audit-log-row-audit-membership-payment-recorded");
      await expect(paymentRow).toBeVisible();
      await expect(paymentRow).toContainText(locale.paymentTarget);
      await expect(paymentRow).toContainText(locale.paymentAction);
      const payrollRow = page.getByTestId("audit-log-row-audit-payroll-payment-recorded");
      await expect(payrollRow).toBeVisible();
      await expect(payrollRow).toContainText(locale.payrollTarget);
      await expect(payrollRow).toContainText(locale.payrollAction);
      const memberRows = memberAuditItems();
      for (let index = 0; index < memberRows.length; index += 1) {
        const row = page.getByTestId(`audit-log-row-${memberRows[index].id}`);
        await expect(row).toBeVisible();
        await expect(row).toContainText(locale.memberTarget);
        await expect(row).toContainText(locale.memberActions[index]);
      }
      const planRows = planAuditItems();
      for (let index = 0; index < planRows.length; index += 1) {
        const row = page.getByTestId(`audit-log-row-${planRows[index].id}`);
        await expect(row).toBeVisible();
        await expect(row).toContainText(locale.planTarget);
        await expect(row).toContainText(locale.planActions[index]);
      }
      const staffGroupRows = staffGroupAuditItems();
      for (let index = 0; index < staffGroupRows.length; index += 1) {
        const row = page.getByTestId(`audit-log-row-${staffGroupRows[index].id}`);
        await expect(row).toBeVisible();
        await expect(row).toContainText(locale.staffGroupTarget);
        await expect(row).toContainText(locale.staffGroupActions[index]);
      }
      const deviceRows = deviceAuditItems();
      for (let index = 0; index < deviceRows.length; index += 1) {
        const row = page.getByTestId(`audit-log-row-${deviceRows[index].id}`);
        await expect(row).toBeVisible();
        await expect(row).toContainText(locale.deviceTarget);
        await expect(row).toContainText(locale.deviceActions[index]);
      }
      const soundRows = soundAuditItems();
      for (let index = 0; index < soundRows.length; index += 1) {
        const row = page.getByTestId(`audit-log-row-${soundRows[index].id}`);
        await expect(row).toBeVisible();
        await expect(row).toContainText(index === 0 ? locale.soundSettingsTarget : locale.soundAssetTarget);
        await expect(row).toContainText(locale.soundActions[index]);
      }
      const membershipReportRow = page.getByTestId("audit-log-row-audit-report-membership-exported");
      await expect(membershipReportRow).toBeVisible();
      await expect(membershipReportRow).toContainText(locale.membershipReportTarget);
      await expect(membershipReportRow).toContainText(locale.membershipReportAction);
      const attendanceReportRows = attendanceReportAuditItems();
      for (let index = 0; index < attendanceReportRows.length; index += 1) {
        const row = page.getByTestId(`audit-log-row-${attendanceReportRows[index].id}`);
        await expect(row).toBeVisible();
        await expect(row).toContainText(locale.attendanceReportTargets[index]);
        await expect(row).toContainText(locale.attendanceReportActions[index]);
      }
      const businessReportRows = businessReportAuditItems();
      for (let index = 0; index < businessReportRows.length; index += 1) {
        const row = page.getByTestId(`audit-log-row-${businessReportRows[index].id}`);
        await expect(row).toBeVisible();
        await expect(row).toContainText(locale.businessReportTargets[index]);
        await expect(row).toContainText(locale.businessReportActions[index]);
      }
      const visibleText = await auditPage.innerText();
      expect(visibleText).not.toMatch(MOJIBAKE_RE);
    });
  }

  test("blocks the route and avoids audit API requests without AUDIT_LOG_VIEW", async ({ page }) => {
    const requests = await prepareApp(page, { language: "en", theme: "light", canViewAuditLogs: false });

    await page.goto("/settings/audit-logs");
    await expect(page.getByRole("heading", { name: "You do not have access to this section" })).toBeVisible();
    await expect(page.getByTestId("audit-logs-page")).toHaveCount(0);
    expect(requests.auditMethods).toEqual([]);
  });
});

async function prepareApp(
  page: Page,
  options: { language: "en" | "fa" | "ps"; theme: "light" | "dark"; canViewAuditLogs: boolean },
) {
  const auditMethods: string[] = [];
  await page.addInitScript(({ language, theme }) => {
    window.localStorage.setItem("i18nextLng", language);
    window.localStorage.setItem("ecs-theme", theme);
  }, options);

  await page.route(API_GLOB, async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;

    if (request.method() === "OPTIONS") {
      await route.fulfill({ status: 204, headers: corsHeaders(route) });
      return;
    }

    if (path === "/api") {
      await json(route, FULL_TEST_IDENTITY);
      return;
    }

    if (path.startsWith("/api/v1/audit-logs")) auditMethods.push(request.method());

    if (path === "/api/v1/auth/setup-status") {
      await json(route, { setupRequired: false, activeAdminCount: 1, hasGymOwner: true, hasVendorOwner: false });
      return;
    }

    if (path === "/api/v1/auth/me") {
      const expiresAt = "2026-07-20T08:30:00.000Z";
      await json(route, {
        edition: "FULL",
        features: [...FULL_TEST_FEATURES],
        user: {
          id: "admin-1",
          username: "owner",
          email: null,
          fullName: "Test Owner",
          role: "GYM_OWNER",
          isActive: true,
          isProtected: false,
          lastLoginAt: NOW,
          passwordChangedAt: NOW,
          createdAt: NOW,
          updatedAt: NOW,
        },
        permissions: options.canViewAuditLogs ? ["AUDIT_LOG_VIEW", "SIGN_IN"] : ["SIGN_IN"],
        session: {
          id: "audit-session-1",
          createdAt: NOW,
          lastSeenAt: NOW,
          expiresAt,
        },
        expiresAt,
      });
      return;
    }

    if (path === "/api/v1/sounds/settings") {
      await json(route, {
        id: "sound-settings",
        enabled: false,
        accessAllowedSoundId: null,
        accessDeniedSoundId: null,
        alertSoundId: null,
        accessAllowedVolume: 70,
        accessDeniedVolume: 70,
        alertVolume: 70,
      });
      return;
    }

    if (path === "/api/v1/inbox/unread-count") {
      await json(route, { alerts: 0, deviceFeed: 0, total: 0 });
      return;
    }

    if (path === "/api/v1/audit-logs/options") {
      await json(route, {
        actions: [
          "auth.login_failed",
          "expense.reversed",
          "membership.created",
          "membership.renewed",
          "membership.updated",
          "membership.cancelled",
          "membership.payment.recorded",
          "payroll.payment.recorded",
          "member.created",
          "member.updated",
          "member.shifts.updated",
          "member.deleted",
          "membership_plan.created",
          "membership_plan.updated",
          "membership_plan.deleted",
          "staff_group.created",
          "staff_group.updated",
          "staff_group.deleted",
          "device.created",
          "device.updated",
          "device.enabled",
          "device.disabled",
          "device.diagnosed",
          "device.tested",
          "device.connection_tested",
          "device.scan.started",
          "device.scan.cancelled",
          "device.enrollment.started",
          "device.users.synced",
          "device.user.upserted",
          "device.user.deleted",
          "device.time.updated",
          "device.door.unlocked",
          "device.logs.cleared",
          "sound.settings.updated",
          "sound.asset.uploaded",
          "sound.asset.deleted",
          "report.membership.exported",
        ],
        targetTypes: ["AdminUser", "Device", "Expense", "Member", "Membership", "MembershipPlan", "MembershipReport", "Payment", "PayrollPayment", "SoundAsset", "SoundSettings", "StaffGroup"],
        actors: [auditActor()],
        actorTypes: ["ADMIN", "SYSTEM"],
        actorRoles: ["GYM_OWNER"],
      });
      return;
    }

    if (path === "/api/v1/audit-logs/audit-1") {
      await json(route, {
        ...auditItem(),
        userAgent: "Playwright browser",
        sessionId: "session-1",
        requestId: "request-1",
        beforeData: null,
        afterData: { password: "[REDACTED]", username: "owner" },
        metadata: { reason: "Invalid password", token: "[REDACTED]" },
      });
      return;
    }

    if (path === "/api/v1/audit-logs") {
      await json(route, {
        items: [
          auditItem(),
          expenseAuditItem(),
          ...membershipAuditItems(),
          membershipPaymentAuditItem(),
          payrollPaymentAuditItem(),
          ...memberAuditItems(),
          ...planAuditItems(),
          ...staffGroupAuditItems(),
          ...deviceAuditItems(),
          ...soundAuditItems(),
          membershipReportAuditItem(),
          ...attendanceReportAuditItems(),
          ...businessReportAuditItems(),
        ],
        page: Number(url.searchParams.get("page") ?? 1),
        pageSize: Number(url.searchParams.get("pageSize") ?? 20),
        total: 38,
        summary: { total: 38, successful: 37, failed: 1 },
      });
      return;
    }

    await json(route, {});
  });

  return { auditMethods };
}

function auditActor() {
  return {
    id: "admin-1",
    username: "owner",
    fullName: "Test Owner",
    role: "GYM_OWNER",
    isActive: true,
  };
}

function auditItem() {
  return {
    id: "audit-1",
    actorType: "ADMIN",
    actorId: "admin-1",
    actorRole: "GYM_OWNER",
    actor: auditActor(),
    action: "auth.login_failed",
    targetType: "AdminUser",
    targetId: "admin-1",
    success: false,
    ipAddress: "127.0.0.1",
    createdAt: NOW,
    hasDetails: true,
  };
}

function expenseAuditItem() {
  return {
    id: "audit-expense-1",
    actorType: "ADMIN",
    actorId: "admin-1",
    actorRole: "GYM_OWNER",
    actor: auditActor(),
    action: "expense.reversed",
    targetType: "Expense",
    targetId: "expense-1",
    success: true,
    ipAddress: "127.0.0.1",
    createdAt: NOW,
    hasDetails: false,
  };
}

function membershipAuditItems() {
  return ["created", "renewed", "updated", "cancelled"].map((action, index) => ({
    id: `audit-membership-${action}`,
    actorType: "ADMIN",
    actorId: "admin-1",
    actorRole: "GYM_OWNER",
    actor: auditActor(),
    action: `membership.${action}`,
    targetType: "Membership",
    targetId: `membership-${index + 1}`,
    success: true,
    ipAddress: "127.0.0.1",
    createdAt: NOW,
    hasDetails: false,
  }));
}

function memberAuditItems() {
  return ["created", "updated", "shifts.updated", "deleted"].map((action, index) => ({
    id: `audit-member-${action.replace(".", "-")}`,
    actorType: "ADMIN",
    actorId: "admin-1",
    actorRole: "GYM_OWNER",
    actor: auditActor(),
    action: `member.${action}`,
    targetType: "Member",
    targetId: `member-${index + 1}`,
    success: true,
    ipAddress: "127.0.0.1",
    createdAt: NOW,
    hasDetails: false,
  }));
}

function planAuditItems() {
  return ["created", "updated", "deleted"].map((action, index) => ({
    id: `audit-membership-plan-${action}`,
    actorType: "ADMIN",
    actorId: "admin-1",
    actorRole: "GYM_OWNER",
    actor: auditActor(),
    action: `membership_plan.${action}`,
    targetType: "MembershipPlan",
    targetId: `membership-plan-${index + 1}`,
    success: true,
    ipAddress: "127.0.0.1",
    createdAt: NOW,
    hasDetails: false,
  }));
}

function staffGroupAuditItems() {
  return ["created", "updated", "deleted"].map((action, index) => ({
    id: `audit-staff-group-${action}`,
    actorType: "ADMIN",
    actorId: "admin-1",
    actorRole: "GYM_OWNER",
    actor: auditActor(),
    action: `staff_group.${action}`,
    targetType: "StaffGroup",
    targetId: `staff-group-${index + 1}`,
    success: true,
    ipAddress: "127.0.0.1",
    createdAt: NOW,
    hasDetails: false,
  }));
}

function deviceAuditItems() {
  return [
    "created",
    "updated",
    "enabled",
    "disabled",
    "diagnosed",
    "tested",
    "connection_tested",
    "scan.started",
    "scan.cancelled",
    "enrollment.started",
    "users.synced",
    "user.upserted",
    "user.deleted",
    "time.updated",
    "door.unlocked",
    "logs.cleared",
  ].map((action, index) => ({
    id: `audit-device-${action}`,
    actorType: "ADMIN",
    actorId: "admin-1",
    actorRole: "GYM_OWNER",
    actor: auditActor(),
    action: `device.${action}`,
    targetType: "Device",
    targetId: `device-${index + 1}`,
    success: true,
    ipAddress: "127.0.0.1",
    createdAt: NOW,
    hasDetails: false,
  }));
}

function soundAuditItems() {
  return [
    { action: "sound.settings.updated", targetType: "SoundSettings", targetId: "global" },
    { action: "sound.asset.uploaded", targetType: "SoundAsset", targetId: "sound-asset-1" },
    { action: "sound.asset.deleted", targetType: "SoundAsset", targetId: "sound-asset-2" },
  ].map((item) => ({
    id: `audit-${item.action.replaceAll(".", "-")}`,
    actorType: "ADMIN",
    actorId: "admin-1",
    actorRole: "GYM_OWNER",
    actor: auditActor(),
    action: item.action,
    targetType: item.targetType,
    targetId: item.targetId,
    success: true,
    ipAddress: "127.0.0.1",
    createdAt: NOW,
    hasDetails: false,
  }));
}

function membershipReportAuditItem() {
  return {
    id: "audit-report-membership-exported",
    actorType: "ADMIN",
    actorId: "admin-1",
    actorRole: "GYM_OWNER",
    actor: auditActor(),
    action: "report.membership.exported",
    targetType: "MembershipReport",
    targetId: "membership-report",
    success: true,
    ipAddress: "127.0.0.1",
    createdAt: NOW,
    hasDetails: false,
  };
}

function attendanceReportAuditItems() {
  return [
    { action: "report.attendance.exported", targetType: "AttendanceReport", targetId: "attendance-report" },
    { action: "report.daily_attendance.exported", targetType: "DailyAttendanceReport", targetId: "daily-attendance-report" },
    { action: "report.entry_logs.exported", targetType: "EntryLogsReport", targetId: "entry-logs-report" },
  ].map((item) => ({
    id: `audit-${item.action.replaceAll(".", "-")}`,
    actorType: "ADMIN",
    actorId: "admin-1",
    actorRole: "GYM_OWNER",
    actor: auditActor(),
    action: item.action,
    targetType: item.targetType,
    targetId: item.targetId,
    success: true,
    ipAddress: "127.0.0.1",
    createdAt: NOW,
    hasDetails: false,
  }));
}

function businessReportAuditItems() {
  return [
    ["customer_activity", "CustomerActivityReport"],
    ["debt_aging", "DebtAgingReport"],
    ["renewal_forecast", "RenewalForecastReport"],
    ["payroll_variance", "PayrollVarianceReport"],
    ["attendance_compliance", "AttendanceComplianceReport"],
    ["cashflow", "CashflowReport"],
  ].map(([token, targetType]) => ({
    id: `audit-report-${token}-exported`,
    actorType: "ADMIN",
    actorId: "admin-1",
    actorRole: "GYM_OWNER",
    actor: auditActor(),
    action: `report.${token}.exported`,
    targetType,
    targetId: `${token}-report`,
    success: true,
    ipAddress: "127.0.0.1",
    createdAt: NOW,
    hasDetails: false,
  }));
}

function membershipPaymentAuditItem() {
  return {
    id: "audit-membership-payment-recorded",
    actorType: "ADMIN",
    actorId: "admin-1",
    actorRole: "GYM_OWNER",
    actor: auditActor(),
    action: "membership.payment.recorded",
    targetType: "Payment",
    targetId: "payment-1",
    success: true,
    ipAddress: "127.0.0.1",
    createdAt: NOW,
    hasDetails: false,
  };
}

function payrollPaymentAuditItem() {
  return {
    id: "audit-payroll-payment-recorded",
    actorType: "ADMIN",
    actorId: "admin-1",
    actorRole: "GYM_OWNER",
    actor: auditActor(),
    action: "payroll.payment.recorded",
    targetType: "PayrollPayment",
    targetId: "payroll-payment-1",
    success: true,
    ipAddress: "127.0.0.1",
    createdAt: NOW,
    hasDetails: false,
  };
}

function corsHeaders(route: Route) {
  const origin = route.request().headers().origin ?? "http://127.0.0.1:5173";
  return {
    "access-control-allow-origin": origin,
    "access-control-allow-credentials": "true",
    "access-control-allow-headers": "content-type",
    "access-control-allow-methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
  };
}

async function json(route: Route, body: unknown, status = 200) {
  await route.fulfill({
    status,
    contentType: "application/json",
    headers: corsHeaders(route),
    body: JSON.stringify(body),
  });
}
