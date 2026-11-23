import { expect, test, type Download, type Locator, type Page, type Route } from "@playwright/test";
import { promises as fs } from "node:fs";
import { getLocalizedDatePresetRange } from "../src/shared/datePresets";
import { FULL_TEST_FEATURES, FULL_TEST_IDENTITY } from "./auth-fixtures";

const API_GLOB = /^https?:\/\/[^/]+\/api(?:\/|$)/;
const ARABIC_SCRIPT_RE = /[\u0600-\u06ff]/;
const MOJIBAKE_RE = /[\u00c3\u00c2\u00d8\u00d9\u00db\ufffd]/;
const NOW = "2026-07-14T08:00:00.000Z";
const REPORT_FROM = "2026-07-01";
const REPORT_TO = "2026-07-14";
const MEMBER_NAME = "\u0646\u0627\u0635\u0631 \u0645\u062d\u0645\u062f\u06cc";
const DEVICE_NAME = "\u0648\u0631\u0648\u062f\u06cc \u0627\u0635\u0644\u06cc";
const NOTE = "\u062a\u0633\u062a \u062e\u0631\u0648\u062c\u06cc";

const languages = ["en", "fa", "ps"] as const;
type TestLanguage = (typeof languages)[number];

test.describe("localized report CSV downloads", () => {
  test.describe.configure({ timeout: 240_000 });

  for (const language of languages) {
    test(`${language} downloads are UTF-8 and localized`, async ({ page }) => {
      await prepareApp(page, language);

      await page.goto("/attendance");
      await waitForAppIdle(page);
      await expect(page.getByText(MEMBER_NAME).first()).toBeVisible();
      await verifyDailyAttendanceDatePicker(page, language);
      const dailyAttendance = await downloadCsvFrom(
        page,
        () => page.getByTestId("attendance-daily-export-csv").click(),
        /^attendance-\d{4}-\d{2}-\d{2}\.csv$/u
      );
      assertCsvDownload(dailyAttendance, language, "Employee Name");
      assertDailyAttendanceRows(dailyAttendance, language);

      await page.goto("/entry-logs");
      await waitForAppIdle(page);
      await expect(page.getByTestId("entry-logs-export-csv")).toBeEnabled();
      await verifyEntryLogsDateRange(page, language);
      const entryLogs = await downloadCsvFrom(
        page,
        () => page.getByTestId("entry-logs-export-csv").click(),
        /^entry-logs-\d{4}-\d{2}-\d{2}\.csv$/u
      );
      assertCsvDownload(entryLogs, language, "Time");
      assertEntryLogRows(entryLogs, language);

      await page.getByTestId("entry-logs-manual-open").click();
      const manualModal = page.getByTestId("entry-logs-manual-modal");
      await manualModal.getByTestId("entry-logs-manual-member-search").fill("14");
      await manualModal.getByTestId("entry-logs-manual-member-member-1").click();
      const manualDateTimeInput = manualModal.locator(".shamsi-date-input input");
      await manualDateTimeInput.click();
      const manualCalendar = page.locator(".rmdp-calendar").last();
      const localizedTwo = language === "en" ? /^2$/ : /^۲$/;
      await manualCalendar.locator(".rmdp-day:not(.rmdp-day-hidden)").filter({ hasText: localizedTwo }).first().click();
      const displayedManualDateTime = await manualDateTimeInput.inputValue();
      const manualPost = page.waitForRequest((request) =>
        request.method() === "POST" && new URL(request.url()).pathname === "/api/v1/attendance/manual"
      );
      await manualModal.getByTestId("entry-logs-manual-submit").click();
      const manualPayload = (await (await manualPost).postDataJSON()) as { occurredAt?: string };
      expect(manualPayload.occurredAt).toBeTruthy();
      assertIsoMatchesLocalizedDateTime(manualPayload.occurredAt!, displayedManualDateTime);

      const attendanceSummaryRequest = page.waitForRequest((request) =>
        new URL(request.url()).pathname === "/api/v1/reports/attendance/summary"
      );
      await page.goto(`/reports/attendance?preset=custom&from=${REPORT_FROM}&to=${REPORT_TO}`);
      await waitForAppIdle(page);
      const attendanceSummaryUrl = new URL((await attendanceSummaryRequest).url());
      expect(attendanceSummaryUrl.searchParams.get("from")).toBe(REPORT_FROM);
      expect(attendanceSummaryUrl.searchParams.get("to")).toBe(REPORT_TO);
      await page.locator(".attendance-report-filter-toggle").click();
      const attendanceDateInputs = page.locator(".shamsi-date-input input");
      await expect(attendanceDateInputs).toHaveCount(2);
      if (language === "en") {
        await expect(attendanceDateInputs.nth(0)).toHaveValue("2026/07/01");
        await expect(attendanceDateInputs.nth(1)).toHaveValue("2026/07/14");
      } else {
        await expect(attendanceDateInputs.nth(0)).not.toHaveValue("2026/07/01");
        await expect(attendanceDateInputs.nth(1)).not.toHaveValue("2026/07/14");
        await expect(attendanceDateInputs.nth(0)).toHaveValue(/[۰-۹]{4}\/[۰-۹]{2}\/[۰-۹]{2}/u);
        await expect(attendanceDateInputs.nth(1)).toHaveValue(/[۰-۹]{4}\/[۰-۹]{2}\/[۰-۹]{2}/u);
      }
      const attendanceRange = await verifyAttendanceReportDateControls(page, language);
      await expect(page.getByTestId("attendance-report-export-menu")).toBeEnabled();

      const reportDaily = await downloadAttendanceReportCsv(page, "attendance-report-export-csv-daily", language, "daily", attendanceRange);
      assertCsvDownload(reportDaily, language, "Date");
      assertReportDailyRows(reportDaily);

      const reportMembers = await downloadAttendanceReportCsv(page, "attendance-report-export-csv-members", language, "members", attendanceRange);
      assertCsvDownload(reportMembers, language, "Member code");
      assertReportMemberRows(reportMembers, language);

      const reportEvidence = await downloadAttendanceReportCsv(page, "attendance-report-export-csv-evidence", language, "evidence", attendanceRange);
      assertCsvDownload(reportEvidence, language, "Timestamp");
      assertReportEvidenceRows(reportEvidence, language);

      await page.goto("/reports");
      await waitForAppIdle(page);
      await page.getByTestId("reports-open-membership").click();
      const membershipExportButton = page.getByTestId("membership-report-export-csv");
      await expect(membershipExportButton).toBeEnabled();
      await verifyReportsMembershipDateRange(page, language);
      const membershipExportRequest = page.waitForRequest(
        (request) => new URL(request.url()).pathname === "/api/v1/membership-report/export.csv"
      );
      const membershipCsv = await downloadCsvFrom(page, () => membershipExportButton.click());
      const membershipExportUrl = new URL((await membershipExportRequest).url());
      expect(membershipExportUrl.searchParams.get("lang")).toBe(language);
      assertCsvDownload(membershipCsv, language, "Membership ID");
      assertMembershipReportRows(membershipCsv, language);

      await page.getByTestId("reports-back").click();
      await page.getByTestId("reports-open-payroll").click();
      await verifyReportsPayrollMonth(page, language);

      const today = new Date();
      const currentYear = today.getFullYear();
      const currentMonth = today.getMonth() + 1;
      const expectedFrom = `${currentYear}-${String(currentMonth).padStart(2, "0")}-01`;
      const expectedTo = localDateValue(today);
      const cashflowRequest = page.waitForRequest((request) => new URL(request.url()).pathname === "/api/v1/reports/cashflow");
      await page.goto("/reports/cashflow");
      const cashflowUrl = new URL((await cashflowRequest).url());
      expect(cashflowUrl.searchParams.get("from")).toBe(expectedFrom);
      expect(cashflowUrl.searchParams.get("to")).toBe(expectedTo);
      expect(cashflowUrl.searchParams.get("groupBy")).toBe("day");

      const payrollRequest = page.waitForRequest((request) => new URL(request.url()).pathname === "/api/v1/reports/payroll-variance");
      await page.goto("/reports/payroll-variance");
      const payrollUrl = new URL((await payrollRequest).url());
      expect(payrollUrl.searchParams.get("year")).toBe(String(currentYear));
      expect(payrollUrl.searchParams.get("month")).toBe(String(currentMonth));

      await page.goto("/payments/memberships");
      await page.getByTestId("payments-customer-member-open").click();
      await page.getByTestId("payments-member-search").fill("14");
      await page.getByTestId("payments-member-member-1").click();
      await page.getByTestId("payments-debt-full-membership-1").click();
      await expect(page.getByTestId("payments-customer-amount")).toHaveValue("600");
      const paymentDateTimeInput = page.locator(".payments-date-input");
      const displayedPaymentDateTime = await paymentDateTimeInput.inputValue();
      const paymentPost = page.waitForRequest((request) =>
        request.method() === "POST" && new URL(request.url()).pathname === "/api/v1/members/member-1/payments"
      );
      await page.getByTestId("payments-customer-submit").click();
      const paymentPayload = (await (await paymentPost).postDataJSON()) as { amount: number; membershipId?: string; paidAt?: string };
      expect(paymentPayload.amount).toBe(600);
      expect(paymentPayload.membershipId).toBe("membership-1");
      expect(paymentPayload.paidAt).toBeTruthy();
      assertIsoMatchesLocalizedDateTime(paymentPayload.paidAt!, displayedPaymentDateTime);
    });
  }

  test("critical payroll and expense POST payloads preserve localized wall-clock time", async ({ page }) => {
    await prepareApp(page, "fa");

    const today = new Date();
    await page.goto("/payments/payroll");
    await page.getByTestId("payments-payroll-member-open").click();
    await page.getByTestId("payments-member-search").fill("S-1");
    await page.getByTestId("payments-member-staff-1").click();
    await expect(page.getByTestId("payments-payroll-amount")).toBeEnabled();
    await page.getByTestId("payments-payroll-amount").fill("700");
    const payrollDateTimeInput = page.locator(".shamsi-date-input--datetime input");
    await payrollDateTimeInput.click();
    await page.locator(".rmdp-calendar").last().locator(".rmdp-day:not(.rmdp-day-hidden)").filter({ hasText: /^۲$/ }).first().click();
    const displayedPayrollDateTime = await payrollDateTimeInput.inputValue();
    const payrollPost = page.waitForRequest((request) =>
      request.method() === "POST" && new URL(request.url()).pathname === "/api/v1/payroll/payments"
    );
    await page.getByTestId("payments-payroll-submit").click();
    const payrollPayload = (await (await payrollPost).postDataJSON()) as {
      memberId: string;
      year: number;
      month: number;
      amount: number;
      paidAt?: string;
    };
    expect(payrollPayload).toMatchObject({
      memberId: "staff-1",
      year: today.getFullYear(),
      month: today.getMonth() + 1,
      amount: 700,
    });
    expect(payrollPayload.paidAt).toBeTruthy();
    assertIsoMatchesLocalizedDateTime(payrollPayload.paidAt!, displayedPayrollDateTime);

    await page.goto("/payments/expenses");
    await page.getByTestId("expenses-create-open").click();
    await page.getByTestId("expenses-create-category").selectOption("expense-category-1");
    await page.getByTestId("expenses-create-amount").fill("250");
    const expenseDateTimeInput = page.locator(".expenses-occurred-at");
    const displayedExpenseDateTime = await expenseDateTimeInput.inputValue();
    const expensePost = page.waitForRequest((request) =>
      request.method() === "POST" && new URL(request.url()).pathname === "/api/v1/expenses"
    );
    await page.getByTestId("expenses-create-submit").click();
    const expensePayload = (await (await expensePost).postDataJSON()) as { categoryId: string; amount: number; occurredAt?: string };
    expect(expensePayload.categoryId).toBe("expense-category-1");
    expect(expensePayload.amount).toBe(250);
    expect(expensePayload.occurredAt).toBeTruthy();
    assertIsoMatchesLocalizedDateTime(expensePayload.occurredAt!, displayedExpenseDateTime);
  });

  test("customer membership submission preserves the local Gregorian date contract", async ({ page }) => {
    await prepareApp(page, "fa");
    const expectedStartDate = localDateValue(new Date());
    const expectedEnd = new Date(`${expectedStartDate}T00:00:00`);
    expectedEnd.setDate(expectedEnd.getDate() + 30);
    const expectedEndDate = localDateValue(expectedEnd);

    await page.goto("/members/add");
    await waitForAppIdle(page);
    await page.getByTestId("member-wizard-type-customer").check();
    await page.getByTestId("member-wizard-primary").click();

    await page.locator('input[name="firstName"]').fill("Date Test");
    await page.locator('input[name="phone"]').fill("0700000001");
    await page.locator('input[name="code"]').fill("101");
    await page.getByTestId("member-wizard-primary").click();

    const planSelect = page.locator('button[name="membership.planId"]');
    await expect(planSelect).toBeEnabled();
    await planSelect.click();
    await page.getByRole("option", { name: /Gold/u }).click();
    await page.getByTestId("member-wizard-primary").click();
    await page.getByTestId("member-wizard-primary").click();

    const memberPost = page.waitForRequest((request) =>
      request.method() === "POST" && new URL(request.url()).pathname === "/api/v1/members"
    );
    await page.getByTestId("member-wizard-primary").click();
    const memberPayload = (await (await memberPost).postDataJSON()) as {
      memberType: string;
      membership?: { planId?: string; startDate?: string; endDate?: string; price?: number };
    };
    expect(memberPayload.memberType).toBe("CUSTOMER");
    expect(memberPayload.membership).toMatchObject({
      planId: "plan-1",
      startDate: expectedStartDate,
      endDate: expectedEndDate,
      price: 1000,
    });
  });

  test("inbox and raw device-log filters submit the same localized date range", async ({ page }) => {
    await prepareApp(page, "fa");
    await page.goto("/devices");
    await waitForAppIdle(page);
    const deviceStatusTrigger = page.getByTestId("device-status-open-device-1");
    await expect(deviceStatusTrigger).toHaveCSS("background-color", "rgb(248, 251, 255)");
    await expect(deviceStatusTrigger).toHaveCSS("color", "rgb(23, 74, 126)");
    await deviceStatusTrigger.click();
    await expect(page.getByTestId("device-status-modal")).toBeVisible();
    await expect(page.getByTestId("device-status-last-poll")).toContainText("آخرین بررسی موفق");
    await expect(page.getByTestId("device-status-last-event")).toContainText("آخرین رویداد دریافت‌شده");
    await expect(page.getByTestId("device-status-last-processed")).toContainText("آخرین رویداد پردازش‌شده");
    const deviceErrorPanel = page.getByTestId("device-status-last-error");
    await expect(deviceErrorPanel).toContainText("Connection timeout");
    await expect(deviceErrorPanel).toHaveCSS("background-color", "rgb(255, 246, 247)");
    await expect(deviceErrorPanel.locator(".device-status-error-title")).toHaveCSS("color", "rgb(159, 29, 50)");
    await expect(deviceErrorPanel.locator(".device-status-error-message")).toHaveCSS("color", "rgb(95, 23, 32)");
    await expect(deviceErrorPanel.locator(".device-status-error-time")).toHaveCSS("color", "rgb(125, 43, 56)");

    await page.evaluate(() => document.documentElement.classList.remove("theme-light"));
    await expect(deviceStatusTrigger).toHaveCSS("color", "rgb(219, 234, 254)");
    await expect(deviceErrorPanel.locator(".device-status-error-title")).toHaveCSS("color", "rgb(254, 205, 211)");
    await expect(deviceErrorPanel.locator(".device-status-error-message")).toHaveCSS("color", "rgb(255, 241, 242)");
    await expect(deviceErrorPanel.locator(".device-status-error-time")).toHaveCSS("color", "rgb(253, 164, 175)");
    await page.evaluate(() => document.documentElement.classList.add("theme-light"));
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("device-status-modal")).toHaveCount(0);

    await page.getByTestId("inbox-open").click();
    await page.getByTestId("inbox-device-feed-tab").click();
    const inboxFromInput = page.locator(".inbox-device-from input");
    const inboxToInput = page.locator(".inbox-device-to input");
    await expect(inboxFromInput).not.toHaveAttribute("aria-busy", "true");
    await selectCalendarDay(inboxFromInput, "\u06f2");
    await selectCalendarDay(inboxToInput, "\u06f3");
    const inboxRequestPromise = page.waitForRequest((request) => {
      const url = new URL(request.url());
      return url.pathname === "/api/v1/inbox"
        && url.searchParams.get("category") === "DEVICE_FEED"
        && url.searchParams.get("search") === "date-wire"
        && Boolean(url.searchParams.get("from"))
        && Boolean(url.searchParams.get("to"));
    });
    await page.getByTestId("inbox-device-search").fill("date-wire");
    const inboxUrl = new URL((await inboxRequestPromise).url());
    const inboxFrom = inboxUrl.searchParams.get("from");
    const inboxTo = inboxUrl.searchParams.get("to");
    expect(inboxFrom).toMatch(/^\d{4}-\d{2}-\d{2}$/u);
    expect(inboxTo).toMatch(/^\d{4}-\d{2}-\d{2}$/u);
    expect(inboxFrom).not.toBe(inboxTo);

    await page.keyboard.press("Escape");
    await expect(page.getByTestId("inbox-drawer")).toHaveCount(0);
    await page.getByTestId("devices-raw-logs-open").click();
    const rawFromInput = page.locator(".device-raw-logs-from input");
    const rawToInput = page.locator(".device-raw-logs-to input");
    await expect(rawFromInput).not.toHaveAttribute("aria-busy", "true");
    await selectCalendarDay(rawFromInput, "\u06f2");
    await selectCalendarDay(rawToInput, "\u06f3");
    const rawRequestPromise = page.waitForRequest((request) => {
      const url = new URL(request.url());
      return url.pathname === "/api/v1/devices/raw-logs"
        && Boolean(url.searchParams.get("from"))
        && Boolean(url.searchParams.get("to"));
    });
    await page.getByTestId("device-raw-logs-apply").click();
    const rawUrl = new URL((await rawRequestPromise).url());
    expect(rawUrl.searchParams.get("from")).toBe(inboxFrom);
    expect(rawUrl.searchParams.get("to")).toBe(inboxTo);

    const supportBundleRequestPromise = page.waitForRequest((request) =>
      new URL(request.url()).pathname === "/api/v1/devices/raw-logs/support-bundle"
    );
    const supportBundleDownloadPromise = page.waitForEvent("download");
    await page.getByTestId("device-raw-logs-export").click();
    const supportBundleUrl = new URL((await supportBundleRequestPromise).url());
    expect(supportBundleUrl.searchParams.get("from")).toBe(inboxFrom);
    expect(supportBundleUrl.searchParams.get("to")).toBe(inboxTo);
    expect(supportBundleUrl.searchParams.get("language")).toBe("fa");
    expect(supportBundleUrl.searchParams.get("limit")).toBe("500");
    const supportBundleDownload = await supportBundleDownloadPromise;
    expect(supportBundleDownload.suggestedFilename()).toBe("atlasgym-device-support-20260716-123456Z.zip");
    const supportBundlePath = await supportBundleDownload.path();
    if (!supportBundlePath) throw new Error("Device support bundle was not written");
    const supportBundleBytes = await fs.readFile(supportBundlePath);
    expect(Array.from(supportBundleBytes.subarray(0, 4))).toEqual([0x50, 0x4b, 0x05, 0x06]);
  });
});

async function verifyDailyAttendanceDatePicker(page: Page, language: TestLanguage) {
  const pageRoot = page.getByTestId("attendance-daily-page");
  await expect(pageRoot).toHaveAttribute("dir", language === "en" ? "ltr" : "rtl");

  await page.getByTestId("attendance-daily-date-preset").click();
  await page.locator('[role="option"][data-value="custom"]').click();

  const dateInput = page.getByTestId("attendance-daily-date-filter").locator(".shamsi-date-input input");
  await expect(dateInput).toBeVisible();
  if (language === "en") {
    await expect(dateInput).toHaveValue(/\d{4}\/\d{2}\/\d{2}/u);
  } else {
    await expect(dateInput).toHaveValue(/[۰-۹]{4}\/[۰-۹]{2}\/[۰-۹]{2}/u);
  }

  await dateInput.click();
  const calendar = page.locator(".shamsi-date-input-calendar").last();
  await expect(calendar).toBeVisible();
  if (language === "en") {
    await expect(calendar).not.toHaveClass(/shamsi-date-input-calendar--rtl/u);
  } else {
    await expect(calendar).toHaveClass(/shamsi-date-input-calendar--rtl/u);
  }

  const dateRequest = page.waitForRequest((request) => {
    const url = new URL(request.url());
    return url.pathname === "/api/v1/attendance/daily" && Boolean(url.searchParams.get("date"));
  });
  await calendar
    .locator(".rmdp-day:not(.rmdp-day-hidden):not(.rmdp-disabled):not(.rmdp-today)")
    .first()
    .click();
  const requestUrl = new URL((await dateRequest).url());
  expect(requestUrl.searchParams.get("date")).toMatch(/^\d{4}-\d{2}-\d{2}$/u);
  expect(requestUrl.searchParams.get("mode")).toBe("primary");

  const displayDate = await page.getByTestId("attendance-daily-display-date").textContent();
  expect(displayDate?.trim()).toBeTruthy();
  if (language !== "en") {
    expect(displayDate).toMatch(ARABIC_SCRIPT_RE);
  }
  await waitForAppIdle(page);
}

async function verifyAttendanceReportDateControls(page: Page, language: TestLanguage) {
  await expect(page.getByTestId("attendance-report-page")).toHaveAttribute("dir", language === "en" ? "ltr" : "rtl");

  for (const preset of ["today", "thisWeek", "thisMonth"] as const) {
    await page.getByTestId("attendance-report-preset").click();
    await page.locator(`[role="option"][data-value="${preset}"]`).click();
    const expectedRange = getLocalizedDatePresetRange(preset, language);
    const requestPromise = page.waitForRequest((request) => {
      const url = new URL(request.url());
      return (
        url.pathname === "/api/v1/reports/attendance/summary" &&
        url.searchParams.get("from") === expectedRange.from &&
        url.searchParams.get("to") === expectedRange.to
      );
    });
    await page.getByTestId("attendance-report-apply-filters").click();
    await requestPromise;
    await waitForAppIdle(page);
  }

  await page.getByTestId("attendance-report-preset").click();
  await page.locator('[role="option"][data-value="custom"]').click();
  const fromInput = page.getByTestId("attendance-report-date-from").locator(".shamsi-date-input input");
  const toInput = page.getByTestId("attendance-report-date-to").locator(".shamsi-date-input input");
  const selectableDay = ".rmdp-day:not(.rmdp-day-hidden):not(.rmdp-disabled):not(.rmdp-today):visible";

  await fromInput.click();
  let calendar = page.locator(".shamsi-date-input-calendar").last();
  await expectCalendarDirection(calendar, language);
  await calendar.locator(selectableDay).first().click();
  await toInput.click();
  calendar = page.locator(".shamsi-date-input-calendar").last();
  await calendar.locator(selectableDay).nth(1).click();

  const customRequest = page.waitForRequest((request) => {
    const url = new URL(request.url());
    return (
      url.pathname === "/api/v1/reports/attendance/summary" &&
      Boolean(url.searchParams.get("from")) &&
      Boolean(url.searchParams.get("to"))
    );
  });
  await page.getByTestId("attendance-report-apply-filters").click();
  const customUrl = new URL((await customRequest).url());
  const range = {
    from: customUrl.searchParams.get("from")!,
    to: customUrl.searchParams.get("to")!,
  };
  expect(range.from).toMatch(/^\d{4}-\d{2}-\d{2}$/u);
  expect(range.to).toMatch(/^\d{4}-\d{2}-\d{2}$/u);
  expect(range.from <= range.to).toBe(true);
  await waitForAppIdle(page);

  for (const tab of ["members", "evidence", "daily"] as const) {
    const requestPath = `/api/v1/reports/attendance/${tab}`;
    const tabRequest = page.waitForRequest((request) => {
      const url = new URL(request.url());
      return (
        url.pathname === requestPath &&
        url.searchParams.get("from") === range.from &&
        url.searchParams.get("to") === range.to
      );
    });
    await page.getByTestId(`attendance-report-tab-${tab}`).click();
    await tabRequest;
  }

  await fromInput.click();
  calendar = page.locator(".shamsi-date-input-calendar").last();
  await calendar.locator(selectableDay).nth(2).click();
  await expect(page.getByTestId("attendance-report-date-error")).toBeVisible();
  await expect(page.getByTestId("attendance-report-apply-filters")).toBeDisabled();
  return range;
}

async function verifyEntryLogsDateRange(page: Page, language: TestLanguage) {
  await expect(page.getByTestId("entry-logs-page")).toHaveAttribute("dir", language === "en" ? "ltr" : "rtl");
  await page.getByTestId("entry-logs-filter-toggle").click();
  await page.getByTestId("entry-logs-range-preset").click();
  await page.locator('[role="option"][data-value="custom"]').click();

  const fromInput = page.getByTestId("entry-logs-date-from").locator(".shamsi-date-input input");
  const toInput = page.getByTestId("entry-logs-date-to").locator(".shamsi-date-input input");
  await expect(fromInput).toBeVisible();
  await expect(toInput).toBeVisible();
  if (language === "en") {
    await expect(fromInput).toHaveValue(/\d{4}\/\d{2}\/\d{2}/u);
    await expect(toInput).toHaveValue(/\d{4}\/\d{2}\/\d{2}/u);
  } else {
    await expect(fromInput).toHaveValue(/[۰-۹]{4}\/[۰-۹]{2}\/[۰-۹]{2}/u);
    await expect(toInput).toHaveValue(/[۰-۹]{4}\/[۰-۹]{2}\/[۰-۹]{2}/u);
  }

  const selectableDay = ".rmdp-day:not(.rmdp-day-hidden):not(.rmdp-disabled):not(.rmdp-today):visible";
  await toInput.click();
  let calendar = page.locator(".shamsi-date-input-calendar").last();
  await expect(calendar).toBeVisible();
  await expect(calendar).toHaveClass(
    language === "en"
      ? /^(?!.*shamsi-date-input-calendar--rtl).*$/u
      : /shamsi-date-input-calendar--rtl/u
  );
  await calendar.locator(selectableDay).last().click({ timeout: 15_000 });
  await waitForAppIdle(page);

  const firstRequest = page.waitForRequest(
    (request) => {
      const url = new URL(request.url());
      return url.pathname === "/api/v1/attendance" && Boolean(url.searchParams.get("from"));
    },
    { timeout: 15_000 }
  );
  await fromInput.click();
  calendar = page.locator(".shamsi-date-input-calendar").last();
  await expect(calendar).toBeVisible();
  await calendar.locator(selectableDay).first().click();
  const firstUrl = new URL((await firstRequest).url());

  const secondRequest = page.waitForRequest(
    (request) => {
      const url = new URL(request.url());
      return (
        url.pathname === "/api/v1/attendance" &&
        Boolean(url.searchParams.get("to")) &&
        url.searchParams.get("to") !== firstUrl.searchParams.get("to")
      );
    },
    { timeout: 15_000 }
  );
  await toInput.click();
  calendar = page.locator(".shamsi-date-input-calendar").last();
  await calendar.locator(selectableDay).nth(1).click();
  const secondUrl = new URL((await secondRequest).url());
  assertEntryLogsDayBoundaries(secondUrl);

  await fromInput.click();
  calendar = page.locator(".shamsi-date-input-calendar").last();
  await calendar.locator(selectableDay).nth(2).click();
  await expect(page.getByTestId("entry-logs-range-error")).toBeVisible();
  await expect(page.getByTestId("entry-logs-apply-filters")).toBeDisabled();
}

async function verifyReportsMembershipDateRange(page: Page, language: TestLanguage) {
  await expect(page.getByTestId("reports-page")).toHaveAttribute("dir", language === "en" ? "ltr" : "rtl");
  const reportTab = page.getByTestId("membership-report-tab");
  await reportTab.locator(".attendance-report-filter-toggle").click();
  const fromInput = page.getByTestId("membership-report-date-from").locator(".shamsi-date-input input");
  const toInput = page.getByTestId("membership-report-date-to").locator(".shamsi-date-input input");
  await expect(fromInput).toBeVisible();
  await expect(toInput).toBeVisible();

  const selectableDay = ".rmdp-day:not(.rmdp-day-hidden):not(.rmdp-disabled):not(.rmdp-today)";
  await fromInput.click();
  let calendar = page.locator(".shamsi-date-input-calendar").last();
  await expectCalendarDirection(calendar, language);
  await calendar.locator(selectableDay).first().click();

  await toInput.click();
  calendar = page.locator(".shamsi-date-input-calendar").last();
  await calendar.locator(selectableDay).nth(1).click();
  if (language === "en") {
    await expect(fromInput).toHaveValue(/\d{4}\/\d{2}\/\d{2}/u);
    await expect(toInput).toHaveValue(/\d{4}\/\d{2}\/\d{2}/u);
  } else {
    await expect(fromInput).toHaveValue(/[۰-۹]{4}\/[۰-۹]{2}\/[۰-۹]{2}/u);
    await expect(toInput).toHaveValue(/[۰-۹]{4}\/[۰-۹]{2}\/[۰-۹]{2}/u);
  }

  const reportRequest = page.waitForRequest((request) => {
    const url = new URL(request.url());
    return (
      url.pathname === "/api/v1/membership-report" &&
      Boolean(url.searchParams.get("from")) &&
      Boolean(url.searchParams.get("to"))
    );
  });
  await page.getByTestId("membership-report-apply-filters").click();
  const reportUrl = new URL((await reportRequest).url());
  const from = reportUrl.searchParams.get("from");
  const to = reportUrl.searchParams.get("to");
  expect(from).toMatch(/^\d{4}-\d{2}-\d{2}$/u);
  expect(to).toMatch(/^\d{4}-\d{2}-\d{2}$/u);
  expect(from! <= to!).toBe(true);
  await waitForAppIdle(page);

  await fromInput.click();
  calendar = page.locator(".shamsi-date-input-calendar").last();
  await calendar.locator(selectableDay).nth(2).click();
  await expect(page.getByTestId("membership-report-date-error")).toBeVisible();
  await expect(page.getByTestId("membership-report-apply-filters")).toBeDisabled();
}

async function verifyReportsPayrollMonth(page: Page, language: TestLanguage) {
  const monthInput = page.getByTestId("payroll-report-month").locator(".shamsi-date-input input");
  await expect(monthInput).toBeVisible();
  await monthInput.click();
  const calendar = page.locator(".shamsi-date-input-calendar").last();
  await expectCalendarDirection(calendar, language);
  const monthOption = calendar.locator(".rmdp-month-picker .rmdp-day:not(.rmdp-disabled):not(.rmdp-selected)").first();
  await expect(monthOption).toBeVisible();
  const payrollRequest = page.waitForRequest((request) => {
    const url = new URL(request.url());
    return url.pathname === "/api/v1/payroll/report" && Boolean(url.searchParams.get("month"));
  });
  await monthOption.click();
  const payrollUrl = new URL((await payrollRequest).url());
  expect(Number(payrollUrl.searchParams.get("year"))).toBeGreaterThan(2000);
  expect(Number(payrollUrl.searchParams.get("month"))).toBeGreaterThanOrEqual(1);
  expect(Number(payrollUrl.searchParams.get("month"))).toBeLessThanOrEqual(12);
  if (language === "en") {
    await expect(monthInput).toHaveValue(/[A-Za-z]+ \d{4}/u);
  } else {
    await expect(monthInput).toHaveValue(/[۰-۹]{4}/u);
  }
  await waitForAppIdle(page);
}

async function expectCalendarDirection(calendar: Locator, language: TestLanguage) {
  await expect(calendar).toBeVisible();
  if (language === "en") {
    await expect(calendar).not.toHaveClass(/shamsi-date-input-calendar--rtl/u);
  } else {
    await expect(calendar).toHaveClass(/shamsi-date-input-calendar--rtl/u);
  }
}

function assertEntryLogsDayBoundaries(url: URL) {
  const fromValue = url.searchParams.get("from");
  const toValue = url.searchParams.get("to");
  expect(fromValue).toBeTruthy();
  expect(toValue).toBeTruthy();
  const from = new Date(fromValue!);
  const to = new Date(toValue!);
  expect(from.getHours()).toBe(0);
  expect(from.getMinutes()).toBe(0);
  expect(from.getSeconds()).toBe(0);
  expect(from.getMilliseconds()).toBe(0);
  expect(to.getHours()).toBe(23);
  expect(to.getMinutes()).toBe(59);
  expect(to.getSeconds()).toBe(59);
  expect(to.getMilliseconds()).toBe(999);
  expect(from.getTime()).toBeLessThanOrEqual(to.getTime());
}

async function prepareApp(page: Page, language: TestLanguage) {
  await page.addInitScript((selectedLanguage) => {
    window.localStorage.setItem("i18nextLng", selectedLanguage);
    window.localStorage.setItem("ecs-theme", "light");
  }, language);

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

    if (path === "/api/v1/auth/setup-status") {
      await json(route, { setupRequired: false, activeAdminCount: 1, hasGymOwner: true, hasVendorOwner: false });
      return;
    }

    if (path === "/api/v1/auth/me") {
      const expiresAt = "2026-07-15T08:00:00.000Z";
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
          lastLoginAt: null,
          passwordChangedAt: null,
          createdAt: NOW,
          updatedAt: NOW,
        },
        permissions: [
          "ATTENDANCE_VIEW",
          "ATTENDANCE_MANUAL",
          "MEMBERS_VIEW",
          "MEMBERS_WRITE",
          "MEMBERSHIPS_WRITE",
          "PAYMENTS_RECORD",
          "FINANCIAL_REPORTS_VIEW",
          "FINANCIAL_EXPORT",
          "EXPENSES_MANAGE",
          "PAYROLL_MANAGE",
          "DEVICES_VIEW",
          "DEVICES_DIAGNOSTICS",
          "SOUND_SETTINGS_MANAGE",
        ],
        session: {
          id: "report-session-1",
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

    if (path === "/api/v1/inbox") {
      await json(route, { items: [], total: 0, page: 1, pageSize: 20 });
      return;
    }

    if (path === "/api/v1/devices") {
      await json(route, [
        {
          id: "device-1",
          name: DEVICE_NAME,
          type: "FINGERPRINT",
          connectionType: "ZKTECO_PULL_SDK",
          enabled: true,
          config: { ip: "192.168.1.200", port: 4370 },
          status: "ONLINE",
          createdAt: NOW,
          updatedAt: NOW,
        },
      ]);
      return;
    }

    if (path === "/api/v1/devices/status") {
      await json(route, {
        devices: [{
          id: "device-1",
          connected: true,
          lastPollAt: NOW,
          lastEventAt: NOW,
          lastEventProcessedAt: NOW,
          lastError: "Connection timeout",
          lastErrorAt: NOW,
        }],
      });
      return;
    }

    if (path === "/api/v1/devices/raw-logs") {
      await json(route, {
        items: [],
        meta: { page: 1, limit: 20, total: 0, totalPages: 1 },
        statusCounts: { PENDING: 0, PROCESSED: 0, SKIPPED_DUPLICATE: 0, SKIPPED_INVALID: 0, FAILED: 0 },
      });
      return;
    }

    if (path === "/api/v1/devices/raw-logs/support-bundle") {
      await route.fulfill({
        status: 200,
        headers: {
          ...corsHeaders(route),
          "content-type": "application/zip",
          "content-disposition": 'attachment; filename="atlasgym-device-support-20260716-123456Z.zip"',
        },
        body: Buffer.from("UEsFBgAAAAAAAAAAAAAAAAAAAAAAAA==", "base64"),
      });
      return;
    }

    if (path === "/api/v1/shifts") {
      await json(route, [
        {
          id: "shift-1",
          shiftName: "Morning",
          shiftStart: "08:00",
          shiftEnd: "16:00",
          graceMinutes: 5,
          isActive: true,
        },
      ]);
      return;
    }

    if (path === "/api/v1/staff-groups") {
      await json(route, [{ id: "group-1", name: "Front desk", description: null, createdAt: NOW, updatedAt: NOW }]);
      return;
    }

    if (path === "/api/v1/members" && request.method() === "POST") {
      await json(route, memberRecord(), 201);
      return;
    }

    if (path === "/api/v1/members") {
      const item = url.searchParams.get("memberType") === "STAFF" ? staffMemberRecord() : memberRecord();
      await json(route, {
        items: [item],
        total: 1,
        skip: 0,
        take: 100,
      });
      return;
    }

    if (path === "/api/v1/members/member-1/full") {
      await json(route, memberFullProfile());
      return;
    }

    if (path === "/api/v1/members/member-1/payments" && request.method() === "POST") {
      const payload = request.postDataJSON() as { amount: number; membershipId?: string; paidAt?: string };
      await json(route, { id: "payment-browser-1", currency: "AFN", method: "CASH", status: "PAID", createdAt: NOW, ...payload });
      return;
    }

    if (path.startsWith("/api/v1/members/")) {
      await json(route, memberRecord());
      return;
    }

    if (path === "/api/v1/membership-plans") {
      await json(route, [{
        id: "plan-1",
        name: "Gold",
        durationValue: 30,
        durationUnit: "DAYS",
        basePrice: 1000,
        price: 1000,
        isActive: true,
      }]);
      return;
    }

    if (path === "/api/v1/membership-report/export.csv") {
      const language = resolveTestLanguage(url.searchParams.get("lang"));
      await route.fulfill({
        status: 200,
        headers: {
          ...corsHeaders(route),
          "content-type": "text/csv; charset=utf-8",
          "content-disposition": 'attachment; filename="membership-report.csv"',
        },
        body: Buffer.from(buildMembershipReportCsv(language), "utf8"),
      });
      return;
    }

    if (path === "/api/v1/membership-report") {
      await json(route, emptyMembershipReport(url));
      return;
    }

    if (path === "/api/v1/reports/attendance/export.csv") {
      const language = resolveTestLanguage(url.searchParams.get("lang"));
      const variant = url.searchParams.get("variant") ?? "daily";
      await route.fulfill({
        status: 200,
        headers: {
          ...corsHeaders(route),
          "content-type": "text/csv; charset=utf-8",
          "content-disposition": `attachment; filename="attendance-${variant}.csv"`,
        },
        body: Buffer.from(buildAttendanceReportCsv(language, variant), "utf8"),
      });
      return;
    }

    if (path === "/api/v1/payroll/summary") {
      await json(route, payrollSummary(url));
      return;
    }

    if (path === "/api/v1/payroll/report") {
      await json(route, { items: [], total: 0, summary: { totalPaid: 0 } });
      return;
    }

    if (path === "/api/v1/payroll/outstanding") {
      await json(route, { items: [], total: 0, summary: { totalDue: 0, totalPaid: 0, totalBalance: 0 } });
      return;
    }

    if (path === "/api/v1/payroll/payments" && request.method() === "POST") {
      await json(route, payrollSummary(url));
      return;
    }

    if (path === "/api/v1/expenses/categories") {
      await json(route, [expenseCategoryRecord()]);
      return;
    }

    if (path === "/api/v1/expenses" && request.method() === "POST") {
      const payload = request.postDataJSON() as { categoryId: string; amount: number; occurredAt?: string };
      await json(route, expenseRecord(payload));
      return;
    }

    if (path === "/api/v1/expenses") {
      await json(route, emptyExpenseReport(url));
      return;
    }

    if (path === "/api/v1/attendance/daily") {
      await json(route, {
        date: "2026-07-14",
        summary: {
          present: 1,
          absent: 0,
          late: 0,
          inside: 0,
          justified: 0,
          unscheduledPresentCount: 0,
          deniedCount: 0,
        },
        warnings: { noCheckout: 0, noShift: 0, multipleEvents: 0 },
        rows: [dailyAttendanceRow()],
      });
      return;
    }

    if (path === "/api/v1/attendance") {
      await json(route, {
        items: [attendanceItem()],
        page: 1,
        pageSize: 20,
        total: 1,
        summary: { totalIn: 1, totalOut: 0, uniqueVisitors: 1, deniedAttempts: 0 },
      });
      return;
    }

    if (path === "/api/v1/attendance/manual" && request.method() === "POST") {
      const payload = request.postDataJSON() as { memberId: string; eventType: "IN" | "OUT"; occurredAt?: string };
      await json(route, { ...attendanceItem(), memberId: payload.memberId, entryType: payload.eventType, recordedAt: payload.occurredAt ?? NOW, source: "MANUAL" });
      return;
    }

    if (path === "/api/v1/reports/attendance/summary") {
      await json(route, {
        range: { from: REPORT_FROM, to: REPORT_TO },
        kpis: {
          presentDays: 1,
          absentDays: 0,
          lateCount: 0,
          lateMinutes: 0,
          earlyLeaveCount: 0,
          earlyLeaveMinutes: 0,
          overtimeMinutes: 0,
          justifiedCount: 0,
          unscheduledPresentCount: 0,
          deniedCount: 0,
          noCheckoutCount: 0,
        },
      });
      return;
    }

    if (path === "/api/v1/reports/attendance/daily") {
      await json(route, {
        items: [
          {
            date: "2026-07-14",
            presentCount: 1,
            absentCount: 0,
            lateCount: 0,
            lateMinutes: 0,
            earlyLeaveCount: 0,
            earlyLeaveMinutes: 0,
            overtimeMinutes: 0,
            justifiedCount: 0,
            unscheduledPresentCount: 0,
            deniedCount: 0,
            noCheckoutCount: 0,
          },
        ],
        pageInfo: pageInfo(1),
      });
      return;
    }

    if (path === "/api/v1/reports/attendance/members") {
      await json(route, {
        items: [
          {
            memberId: "member-1",
            memberCode: "14",
            memberName: MEMBER_NAME,
            memberType: "CUSTOMER",
            expectedShifts: 1,
            presentDays: 1,
            absentDays: 0,
            lateCount: 0,
            lateMinutes: 0,
            earlyLeaveCount: 0,
            earlyLeaveMinutes: 0,
            overtimeMinutes: 0,
            justifiedCount: 0,
            unscheduledPresentCount: 0,
            deniedCount: 0,
            noCheckoutCount: 0,
          },
        ],
        pageInfo: pageInfo(1),
      });
      return;
    }

    if (path === "/api/v1/reports/attendance/evidence") {
      await json(route, {
        items: [
          {
            id: "evidence-1",
            timestamp: "2026-07-14T08:00:00.000Z",
            memberId: "member-1",
            memberName: MEMBER_NAME,
            memberType: "CUSTOMER",
            eventType: "IN",
            deviceId: "device-1",
            deviceName: DEVICE_NAME,
            source: "DEVICE",
            authorized: true,
            result: "authorized",
            denyReason: null,
            notes: NOTE,
          },
        ],
        pageInfo: pageInfo(1),
      });
      return;
    }

    if (path === "/api/v1/reports/cashflow") {
      await json(route, {
        generatedAt: NOW,
        filters: { from: url.searchParams.get("from"), to: url.searchParams.get("to"), groupBy: "day", includePayroll: true },
        summary: {
          membershipInflow: 0,
          membershipRefunds: 0,
          membershipNet: 0,
          expenseGrossOutflow: 0,
          expenseAdjustments: 0,
          expenseNetOutflow: 0,
          payrollOutflow: 0,
          totalOutflow: 0,
          netCash: 0,
          transactionCounts: { membershipPayments: 0, expenseEntries: 0, payrollPayments: 0 },
        },
        charts: { trend: [], expenseByCategory: [] },
      });
      return;
    }

    if (path === "/api/v1/reports/payroll-variance") {
      await json(route, {
        generatedAt: NOW,
        filters: {
          year: Number(url.searchParams.get("year")),
          month: Number(url.searchParams.get("month")),
          memberId: null,
          staffGroupId: null,
          search: null,
          sortBy: "absoluteVariance",
          sortDir: "desc",
          smallThreshold: 500,
          mediumThreshold: 2000,
        },
        kpis: { totalSuggested: 0, totalPaid: 0, totalVariance: 0, varianceRate: 0, topVarianceEmployees: [] },
        charts: { suggestedVsPaid: [], varianceBuckets: { zero: 0, small: 0, medium: 0, large: 0 } },
        items: [],
        pageInfo: pageInfo(0),
      });
      return;
    }

    await json(route, {});
  });
}

async function downloadAttendanceReportCsv(
  page: Page,
  menuItemTestId: string,
  language: TestLanguage,
  variant: "daily" | "members" | "evidence",
  range: { from: string; to: string }
) {
  await page.getByTestId("attendance-report-export-menu").click();
  await expect(page.getByTestId(menuItemTestId)).toBeVisible();
  const requestPromise = page.waitForRequest(
    (request) => new URL(request.url()).pathname === "/api/v1/reports/attendance/export.csv"
  );
  const csv = await downloadCsvFrom(page, () => page.getByTestId(menuItemTestId).click());
  const url = new URL((await requestPromise).url());
  expect(url.searchParams.get("lang")).toBe(language);
  expect(url.searchParams.get("variant")).toBe(variant);
  expect(url.searchParams.get("from")).toBe(range.from);
  expect(url.searchParams.get("to")).toBe(range.to);
  return csv;
}

async function downloadCsvFrom(page: Page, trigger: () => Promise<unknown>, expectedFilename?: RegExp) {
  const downloadPromise = page.waitForEvent("download");
  await trigger();
  const download = await downloadPromise;
  if (expectedFilename) expect(download.suggestedFilename()).toMatch(expectedFilename);
  return readCsvDownload(download);
}

async function readCsvDownload(download: Download) {
  const filePath = await download.path();
  if (!filePath) throw new Error(`Download was not written for ${download.suggestedFilename()}`);
  const bytes = await fs.readFile(filePath);
  expect(Array.from(bytes.subarray(0, 3))).toEqual([0xef, 0xbb, 0xbf]);
  return bytes.toString("utf8");
}

function assertCsvDownload(csv: string, language: TestLanguage, englishHeaderToken: string) {
  expect(csv).not.toMatch(MOJIBAKE_RE);
  expect(csv).not.toContain("attendanceReport.csvHeaders");
  const header = csv.replace(/^\uFEFF/, "").split(/\r?\n/)[0] ?? "";

  if (language === "en") {
    expect(header).toContain(englishHeaderToken);
    return;
  }

  expect(header).toMatch(ARABIC_SCRIPT_RE);
  expect(header).not.toContain(englishHeaderToken);
}

function localDateValue(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function assertIsoMatchesLocalizedDateTime(iso: string, displayed: string) {
  const normalized = displayed.replace(/[۰-۹]/gu, (digit) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)));
  const match = /^(\d{4})\/(\d{2})\/(\d{2}) (\d{2}):(\d{2})$/u.exec(normalized);
  expect(match, `Unexpected localized datetime: ${displayed}`).not.toBeNull();
  const local = new Date(iso);
  expect(local.getHours()).toBe(Number(match![4]));
  expect(local.getMinutes()).toBe(Number(match![5]));
  // English displays Gregorian directly. Dari/Pashto calendar conversion is already
  // covered by the shared-control browser suite; here the wall-clock/ISO POST is checked.
  if (!ARABIC_SCRIPT_RE.test(displayed)) {
    expect(local.getFullYear()).toBe(Number(match![1]));
    expect(local.getMonth() + 1).toBe(Number(match![2]));
    expect(local.getDate()).toBe(Number(match![3]));
  }
}

function assertDailyAttendanceRows(csv: string, language: TestLanguage) {
  const rows = parseCsv(csv);
  expect(rows).toHaveLength(2);
  const row = rows[1]!;
  expect(row).toHaveLength(6);
  expect(row[0]).toBe(`${MEMBER_NAME} #14 | 0700000000`);
  expect(row[1]).toContain("-");
  expectLocalizedEnum(row[2], ["PRESENT"], language);
  expect(row[3]).toBeTruthy();
  expect(row[4]).toBe("Morning");
  expect(row[5]).toBe("-");
}

function assertEntryLogRows(csv: string, language: TestLanguage) {
  const rows = parseCsv(csv);
  expect(rows).toHaveLength(2);
  const row = rows[1]!;
  expect(row).toHaveLength(9);
  expect(row[0]).toBeTruthy();
  expect(row[1]).toBe(MEMBER_NAME);
  expect(row[2]).toBe("14");
  expectLocalizedEnum(row[3], ["CUSTOMER"], language);
  expectLocalizedEnum(row[4], ["IN"], language);
  expect(row[5]).toBe(DEVICE_NAME);
  expectLocalizedEnum(row[6], ["DEVICE"], language);
  expectLocalizedEnum(row[7], ["AUTHORIZED"], language);
  expect(row[8]).toBe(NOTE);
}

function assertReportDailyRows(csv: string) {
  const rows = parseCsv(csv);
  expect(rows).toHaveLength(2);
  expect(rows[1]).toEqual(["2026-07-14", "1", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0"]);
}

function assertReportMemberRows(csv: string, language: TestLanguage) {
  const rows = parseCsv(csv);
  expect(rows).toHaveLength(2);
  const row = rows[1]!;
  expect(row).toHaveLength(15);
  expect(row[0]).toBe("14");
  expect(row[1]).toBe(MEMBER_NAME);
  expectLocalizedEnum(row[2], ["CUSTOMER"], language);
  expect(row.slice(3)).toEqual(["1", "1", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0"]);
}

function assertReportEvidenceRows(csv: string, language: TestLanguage) {
  const rows = parseCsv(csv);
  expect(rows).toHaveLength(2);
  const row = rows[1]!;
  expect(row).toHaveLength(9);
  expect(row[0]).toBe("2026-07-14T08:00:00.000Z");
  expect(row[1]).toBe(MEMBER_NAME);
  expectLocalizedEnum(row[2], ["CUSTOMER"], language);
  expectLocalizedEnum(row[3], ["IN"], language);
  expect(row[4]).toBe(DEVICE_NAME);
  expectLocalizedEnum(row[5], ["DEVICE"], language);
  expectLocalizedEnum(row[6], ["authorized", "AUTHORIZED"], language);
  expect(row[7]).toBe("");
  expect(row[8]).toBe(NOTE);
}

function assertMembershipReportRows(csv: string, language: TestLanguage) {
  const rows = parseCsv(csv).filter((row) => row.some((cell) => cell !== ""));
  expect(rows).toHaveLength(2);
  expect(rows[0]).toHaveLength(17);
  expect(rows[1]).toHaveLength(17);
  expect(rows[1]![1]).toBe("14");
  expect(rows[1]![2]).toBe(MEMBER_NAME);
  expect(rows[1]![3]).toBe("0700000000");
  expectLocalizedEnum(rows[1]![5], ["ACTIVE"], language);
  expectLocalizedEnum(rows[1]![6], ["RENEWAL"], language);
  expectLocalizedEnum(rows[1]![11], ["YES"], language);
}

function buildAttendanceReportCsv(language: TestLanguage, variant: string) {
  const localized = language === "en"
    ? { date: "Date", memberCode: "Member code", member: "Member", type: "Member type", timestamp: "Timestamp", customer: "Customer", event: "Event", source: "Source", result: "Result" }
    : language === "fa"
      ? { date: "تاریخ", memberCode: "کد عضو", member: "عضو", type: "نوع عضو", timestamp: "زمان", customer: "مشتری", event: "رویداد", source: "منبع", result: "نتیجه" }
      : { date: "نېټه", memberCode: "د غړي کوډ", member: "غړی", type: "د غړي ډول", timestamp: "وخت", customer: "پېرودونکی", event: "پېښه", source: "سرچینه", result: "پایله" };
  if (variant === "daily") {
    return `\uFEFF${localized.date},Present,Absent,Late,Late minutes,Early leave,Early minutes,Overtime minutes,Justified,Unscheduled,Denied,No checkout\n2026-07-14,1,0,0,0,0,0,0,0,0,0,0`;
  }
  if (variant === "members") {
    return `\uFEFF${localized.memberCode},${localized.member},${localized.type},Expected shifts,Present,Absent,Late,Late minutes,Early leave,Early minutes,Overtime minutes,Justified,Unscheduled,Denied,No checkout\n14,${MEMBER_NAME},${localized.customer},1,1,0,0,0,0,0,0,0,0,0,0`;
  }
  const inLabel = language === "en" ? "In" : language === "fa" ? "ورود" : "ننوتل";
  const deviceLabel = language === "en" ? "Device" : language === "fa" ? "دستگاه" : "وسیله";
  const authorizedLabel = language === "en" ? "Authorized" : language === "fa" ? "مجاز" : "اجازه شوی";
  return `\uFEFF${localized.timestamp},${localized.member},${localized.type},${localized.event},Device,${localized.source},${localized.result},Reason,Notes\n2026-07-14T08:00:00.000Z,${MEMBER_NAME},${localized.customer},${inLabel},${DEVICE_NAME},${deviceLabel},${authorizedLabel},,${NOTE}`;
}

function expectLocalizedEnum(value: string | undefined, rawValues: string[], language: TestLanguage) {
  expect(value).toBeTruthy();
  if (language !== "en") rawValues.forEach((raw) => expect(value).not.toBe(raw));
}

function parseCsv(csv: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  const normalized = csv.replace(/^\uFEFF/u, "");

  for (let index = 0; index < normalized.length; index += 1) {
    const char = normalized[index]!;
    if (char === '"') {
      if (quoted && normalized[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (char === "," && !quoted) {
      row.push(cell);
      cell = "";
    } else if (char === "\n" && !quoted) {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else if (char !== "\r" || quoted) {
      cell += char;
    }
  }

  row.push(cell);
  rows.push(row);
  return rows;
}

async function waitForAppIdle(page: Page) {
  await expect(page.locator(".app-loader-overlay")).toHaveCount(0, { timeout: 15_000 });
}

async function selectCalendarDay(input: ReturnType<Page["getByTestId"]>, localizedDay: string) {
  await input.click();
  const calendar = input.page().locator(".rmdp-calendar").last();
  await expect(calendar).toBeVisible();
  await calendar
    .locator(".rmdp-day:not(.rmdp-day-hidden)")
    .filter({ hasText: new RegExp(`^${localizedDay}$`, "u") })
    .first()
    .click();
}

function corsHeaders(route: Route) {
  const origin = route.request().headers().origin ?? "http://127.0.0.1:5173";
  return {
    "access-control-allow-origin": origin,
    "access-control-allow-credentials": "true",
    "access-control-allow-headers": "content-type",
    "access-control-allow-methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
    "access-control-expose-headers": "content-disposition",
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

function pageInfo(totalItems: number) {
  return {
    page: 1,
    pageSize: 20,
    totalItems,
    totalPages: 1,
  };
}

function memberRecord() {
  return {
    id: "member-1",
    code: "14",
    firstName: MEMBER_NAME,
    lastName: "",
    phone: "0700000000",
    status: "ACTIVE",
    memberType: "CUSTOMER",
    isStaff: false,
    createdAt: NOW,
    updatedAt: NOW,
  };
}

function staffMemberRecord() {
  return {
    ...memberRecord(),
    id: "staff-1",
    code: "S-1",
    firstName: "Test",
    lastName: "Staff",
    memberType: "STAFF",
    isStaff: true,
    roleType: "EMPLOYEE",
  };
}

function payrollSummary(url: URL) {
  const now = new Date();
  const year = Number(url.searchParams.get("year")) || now.getFullYear();
  const month = Number(url.searchParams.get("month")) || now.getMonth() + 1;
  return {
    memberId: "staff-1",
    year,
    month,
    baseAmount: 1000,
    adjustments: 0,
    totalDue: 1000,
    paidAmount: 0,
    balance: 1000,
    status: "UNPAID",
    suggestion: null,
    payments: [],
    availableFrom: { year: 2026, month: 1 },
  };
}

function expenseCategoryRecord() {
  return {
    id: "expense-category-1",
    name: "Rent",
    slug: "rent",
    isActive: true,
    sortOrder: 1,
    createdAt: NOW,
    updatedAt: NOW,
  };
}

function emptyExpenseReport(url: URL) {
  return {
    generatedAt: NOW,
    filters: {
      from: url.searchParams.get("from") ?? REPORT_FROM,
      to: url.searchParams.get("to") ?? REPORT_TO,
      categoryId: url.searchParams.get("categoryId"),
      status: url.searchParams.get("status"),
      search: url.searchParams.get("search"),
      sortBy: "occurredAt",
      sortDir: "desc",
    },
    summary: { grossOutflow: 0, adjustments: 0, netOutflow: 0, expenseCount: 0, adjustmentCount: 0 },
    items: [],
    analytics: { categoryBreakdown: [], monthlyTrend: [] },
    pageInfo: pageInfo(0),
  };
}

function emptyMembershipReport(url: URL) {
  return {
    generatedAt: NOW,
    filters: {
      preset: url.searchParams.get("preset") ?? "LAST_90_DAYS",
      dateField: url.searchParams.get("dateField") ?? "CREATED_AT",
      from: url.searchParams.get("from"),
      to: url.searchParams.get("to"),
      status: url.searchParams.get("status"),
      planId: url.searchParams.get("planId"),
      memberId: url.searchParams.get("memberId"),
      search: url.searchParams.get("search"),
      remaining: url.searchParams.get("remaining") ?? "ALL",
      autoRenew: null,
      expiringInDays: null,
      sortBy: url.searchParams.get("sortBy") ?? "END_DATE",
      sortDir: url.searchParams.get("sortDir") ?? "desc",
    },
    total: 0,
    skip: 0,
    take: 20,
    summary: {
      totalMemberships: 0,
      active: 0,
      pending: 0,
      expired: 0,
      suspended: 0,
      cancelled: 0,
      renewals: 0,
      firstTimers: 0,
      autoRenewEnabled: 0,
      expiringSoon: 0,
      debtors: 0,
      totalDue: 0,
      totalPaid: 0,
      totalRemaining: 0,
      collectionRatePct: 0,
      averageDuePerMembership: 0,
    },
    charts: {
      statusSplit: [],
      lifecycleSplit: [],
      monthlyTrend: [],
      expiringBuckets: [],
      topPlans: [],
      topDebtors: [],
    },
    items: [],
  };
}

function resolveTestLanguage(value: string | null): TestLanguage {
  return value === "fa" || value === "ps" ? value : "en";
}

function buildMembershipReportCsv(language: TestLanguage) {
  const headers = {
    en: [
      "Membership ID",
      "Member code",
      "Member name",
      "Phone",
      "Plan",
      "Status",
      "Lifecycle",
      "Start date",
      "End date",
      "Created at",
      "Activated at",
      "Auto renew",
      "Days left",
      "Total due",
      "Total paid",
      "Remaining",
      "Expiring soon",
    ],
    fa: [
      "شناسه عضویت",
      "کد عضو",
      "نام عضو",
      "شماره تماس",
      "پلن",
      "وضعیت",
      "چرخه عضویت",
      "تاریخ شروع",
      "تاریخ پایان",
      "تاریخ ایجاد",
      "تاریخ فعال‌سازی",
      "تمدید خودکار",
      "روزهای باقی‌مانده",
      "کل قابل پرداخت",
      "کل پرداخت",
      "باقی‌مانده",
      "در آستانه انقضا",
    ],
    ps: [
      "د غړیتوب پېژند",
      "د غړي کوډ",
      "د غړي نوم",
      "تلیفون",
      "پلان",
      "حالت",
      "د غړیتوب دوره",
      "د پیل نېټه",
      "د پای نېټه",
      "د جوړېدو نېټه",
      "د فعالېدو نېټه",
      "اتومات تمدید",
      "پاتې ورځې",
      "ټول واجب",
      "ټول تادیه",
      "پاتې",
      "ژر پای ته رسېږي",
    ],
  }[language];
  const status = language === "en" ? "ACTIVE" : language === "fa" ? "فعال" : "فعال";
  const lifecycle = language === "en" ? "RENEWAL" : language === "fa" ? "تمدید" : "تمدید";
  const yes = language === "en" ? "YES" : language === "fa" ? "بلی" : "هو";
  const no = language === "en" ? "NO" : language === "fa" ? "خیر" : "نه";
  const row = [
    "membership-1",
    "14",
    MEMBER_NAME,
    "0700000000",
    "Gold",
    status,
    lifecycle,
    "2026-07-01",
    "2026-07-31",
    NOW,
    NOW,
    yes,
    "6",
    "1000",
    "400",
    "600",
    no,
  ];
  return `\uFEFF${headers.map(csvCell).join(",")}\r\n${row.map(csvCell).join(",")}\r\n`;
}

function csvCell(value: string) {
  return `"${value.replace(/"/gu, '""')}"`;
}

function expenseRecord(payload: { categoryId: string; amount: number; occurredAt?: string }) {
  return {
    id: "expense-browser-1",
    categoryId: payload.categoryId,
    category: { id: payload.categoryId, name: "Rent", slug: "rent" },
    amount: payload.amount,
    currency: "AFN",
    status: "POSTED",
    occurredAt: payload.occurredAt ?? NOW,
    notes: null,
    reference: null,
    vendorName: null,
    isAdjustment: false,
    reversalOfExpenseId: null,
    reversedAt: null,
    reversedByExpenseId: null,
    reversedByReference: null,
    reversalOfReference: null,
    createdAt: NOW,
    updatedAt: NOW,
  };
}

function memberFullProfile() {
  return {
    member: memberRecord(),
    payments: [],
    attendanceLogs: [],
    deviceUser: null,
    accessViolations: [],
    doorEvents: [],
    memberships: [
      {
        id: "membership-1",
        planId: "plan-1",
        plan: { id: "plan-1", name: "Gold", durationDays: 30 },
        startDate: "2026-07-01T00:00:00.000Z",
        endDate: "2026-07-31T00:00:00.000Z",
        status: "ACTIVE",
        basePrice: 1000,
        discount: 0,
        totalDue: 1000,
        totalPaid: 400,
        activatedAt: "2026-07-01T00:00:00.000Z",
      },
    ],
    aggregates: {
      totalPaid: 400,
      totalDue: 1000,
      outstandingBalance: 600,
      creditBalance: 0,
      attendanceDays: 0,
      attendanceLogs: 0,
      lateArrivals: 0,
      overtimeHours: 0,
    },
  };
}

function attendanceItem() {
  return {
    id: "attendance-1",
    createdAt: NOW,
    recordedAt: NOW,
    memberId: "member-1",
    memberCode: "14",
    memberFullName: MEMBER_NAME,
    memberType: "CUSTOMER",
    memberStatus: "ACTIVE",
    memberPhone: "0700000000",
    memberRole: null,
    memberTitle: null,
    membershipId: null,
    membershipStatus: null,
    deviceId: "device-1",
    deviceName: DEVICE_NAME,
    eventType: "IN",
    source: "DEVICE",
    isAuthorized: true,
    reason: NOTE,
  };
}

function dailyAttendanceRow() {
  return {
    memberId: "member-1",
    memberCode: "14",
    memberFullName: MEMBER_NAME,
    memberPhone: "0700000000",
    staffGroupId: null,
    staffGroupName: null,
    shiftId: "shift-1",
    shiftName: "Morning",
    shiftStart: "08:00",
    shiftEnd: "16:00",
    graceMinutes: 5,
    status: "PRESENT",
    checkInAt: NOW,
    checkOutAt: "2026-07-14T16:00:00.000Z",
    lateMinutes: 0,
    earlyMinutes: 0,
    earlyLeaveMinutes: 0,
    overtimeMinutes: 0,
    durationMinutes: 480,
    confirmedDurationMinutes: 480,
    hasOpenSession: false,
    openSessionSince: null,
    liveDurationMinutes: null,
    lastEventType: "OUT",
    deviceName: DEVICE_NAME,
    warnings: [],
    isJustified: false,
    justificationReason: null,
    hasShift: true,
  };
}
