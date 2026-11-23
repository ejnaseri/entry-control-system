import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { prisma } from "../../lib/prisma";
import { ATTENDANCE_DATA_SCOPES } from "../attendance/attendance-edition-scope";
import { exportAttendanceEntryLogs } from "../attendance/attendance.service";
import { getMembershipReportCsv } from "../membership-report/membership-report.service";
import { getAttendanceReportCsvExport, getAttendanceReportPdfExport, getAttendanceReportXlsxExport } from "../reports-attendance/reports-attendance.service";
import { getAttendanceComplianceCsv, getAttendanceComplianceXlsx } from "../reports-attendance-compliance/reports-attendance-compliance.service";
import { getCashflowCsv, getCashflowXlsx } from "../reports-cashflow/reports-cashflow.service";
import { getCustomerActivityCsv, getCustomerActivityXlsx } from "../reports-customer-activity/reports-customer-activity.service";
import { getDebtAgingReportCsv, getDebtAgingReportXlsx } from "../reports-debt-aging/reports-debt-aging.service";
import { getPayrollVarianceCsv, getPayrollVarianceXlsx } from "../reports-payroll-variance/reports-payroll-variance.service";
import { getRenewalForecastCsv, getRenewalForecastPdf, getRenewalForecastXlsx } from "../reports-renewal-forecast/reports-renewal-forecast.service";
import { getReportExportLabels, REPORT_EXPORT_LANGUAGES, type ReportExportLanguage } from "./shared/report-export.i18n";
import { extractPdfText, pdfTextIncludesWords } from "./shared/pdf-text.test-utils";

type ExportFormat = "csv" | "xlsx" | "pdf";
type RouteSignature =
  | "attendance:csv"
  | "attendance:xlsx"
  | "membership-report:csv"
  | "reports-attendance:csv"
  | "reports-attendance:xlsx"
  | "reports-attendance:pdf"
  | "reports-attendance-compliance:csv"
  | "reports-attendance-compliance:xlsx"
  | "reports-cashflow:csv"
  | "reports-cashflow:xlsx"
  | "reports-customer-activity:csv"
  | "reports-customer-activity:xlsx"
  | "reports-debt-aging:csv"
  | "reports-debt-aging:xlsx"
  | "reports-payroll-variance:csv"
  | "reports-payroll-variance:xlsx"
  | "reports-renewal-forecast:csv"
  | "reports-renewal-forecast:xlsx"
  | "reports-renewal-forecast:pdf";

type CsvExport = {
  route: RouteSignature;
  name: string;
  format: "csv";
  run: (lang: ReportExportLanguage) => Promise<string | { csv: string; filename?: string }>;
  expectedHeader: (lang: ReportExportLanguage) => string;
};

type XlsxExport = {
  route: RouteSignature;
  name: string;
  format: "xlsx";
  run: (lang: ReportExportLanguage) => Promise<{ buffer: Buffer; filename: string; contentType: string }>;
  expectedSheets: (lang: ReportExportLanguage) => string[];
};

type PdfExport = {
  route: RouteSignature;
  name: string;
  format: "pdf";
  run: (lang: ReportExportLanguage) => Promise<{ buffer: Buffer; filename: string; contentType: string }>;
};

type ExportCase = CsvExport | XlsxExport | PdfExport;
type ReportExportLabelKey = Parameters<ReturnType<typeof getReportExportLabels>["t"]>[0];

const prismaAny = prisma as any;
const originalFns = {
  transaction: prismaAny.$transaction,
  queryRawUnsafe: prismaAny.$queryRawUnsafe,
  membershipFindMany: prismaAny.membership.findMany,
  memberFindMany: prismaAny.member.findMany,
  memberShiftFindMany: prismaAny.memberShift.findMany,
  attendanceLogFindMany: prismaAny.attendanceLog.findMany,
  attendanceLogCount: prismaAny.attendanceLog.count,
  attendanceLogGroupBy: prismaAny.attendanceLog.groupBy,
  attendanceJustificationFindMany: prismaAny.attendanceJustification.findMany,
  deviceFindMany: prismaAny.device.findMany,
  paymentFindMany: prismaAny.payment.findMany,
  payrollPaymentFindMany: prismaAny.payrollPayment.findMany,
  payrollPeriodFindMany: prismaAny.payrollPeriod.findMany,
};

const baseMembershipQuery = {
  preset: "ALL",
  dateField: "CREATED_AT",
  remaining: "ALL",
  skip: 0,
  take: 50,
  sortBy: "CREATED_AT",
  sortDir: "desc",
} as any;

const baseAttendanceQuery = {
  from: "2026-07-01",
  to: "2026-07-01",
  memberType: "both",
  shiftMode: "primary",
  eventType: "all",
  onlyAnomalies: false,
  includeEvidence: true,
} as any;

const baseAttendanceComplianceQuery = {
  ...baseAttendanceQuery,
  viewBy: "member",
  sortBy: "score",
  sortDir: "asc",
  lateMinutesWeight: 0.05,
  lateCountWeight: 1,
  absentWeight: 8,
  noCheckoutWeight: 4,
  deniedWeight: 6,
} as any;

const baseCustomerActivityQuery = {
  inactiveDays: 7,
  engagementWindowDays: 30,
  lowEngagementMaxVisits: 3,
} as any;

const baseDebtAgingQuery = {
  dateField: "END_DATE",
  memberType: "all",
  bucket1: 30,
  bucket2: 60,
  bucket3: 90,
  sortBy: "remaining",
  sortDir: "desc",
} as any;

const baseRenewalForecastQuery = {
  horizonDays: 30,
  includeExpired: false,
  showOnlyDebtors: false,
  memberType: "customer",
  sortBy: "daysLeft",
  sortDir: "asc",
} as any;

const basePayrollVarianceQuery = {
  year: 2026,
  month: 7,
  sortBy: "absoluteVariance",
  sortDir: "desc",
  smallThreshold: 1000,
  mediumThreshold: 5000,
} as any;

const baseCashflowQuery = {
  from: "2026-07-01",
  to: "2026-07-01",
  groupBy: "day",
  includePayroll: true,
} as any;

const expectedRoutes: RouteSignature[] = [
  "attendance:csv",
  "attendance:xlsx",
  "membership-report:csv",
  "reports-attendance:csv",
  "reports-attendance:xlsx",
  "reports-attendance:pdf",
  "reports-attendance-compliance:csv",
  "reports-attendance-compliance:xlsx",
  "reports-cashflow:csv",
  "reports-cashflow:xlsx",
  "reports-customer-activity:csv",
  "reports-customer-activity:xlsx",
  "reports-debt-aging:csv",
  "reports-debt-aging:xlsx",
  "reports-payroll-variance:csv",
  "reports-payroll-variance:xlsx",
  "reports-renewal-forecast:csv",
  "reports-renewal-forecast:xlsx",
  "reports-renewal-forecast:pdf",
];

function translatedHeader(lang: ReportExportLanguage, keys: ReportExportLabelKey[]) {
  const { t } = getReportExportLabels(lang);
  return keys.map((key) => t(key)).join(",");
}

function translatedSheets(lang: ReportExportLanguage, keys: ReportExportLabelKey[]) {
  const { t } = getReportExportLabels(lang);
  return keys.map((key) => t(key));
}

const customerActivityExportCases: ExportCase[] = (["visitedToday", "inactiveMembers", "lowEngagement"] as const).flatMap(
  (tab): ExportCase[] => [
    {
      route: "reports-customer-activity:csv",
      name: `customer activity ${tab} CSV`,
      format: "csv",
      run: (lang) => getCustomerActivityCsv({ ...baseCustomerActivityQuery, tab, lang }),
      expectedHeader: (lang) => translatedHeader(lang, ["member", "phone", "plan"]),
    },
    {
      route: "reports-customer-activity:xlsx",
      name: `customer activity ${tab} XLSX`,
      format: "xlsx",
      run: (lang) => getCustomerActivityXlsx({ ...baseCustomerActivityQuery, tab, lang }),
      expectedSheets: (lang) =>
        translatedSheets(lang, [
          "summary",
          tab === "visitedToday" ? "visitedToday" : tab === "inactiveMembers" ? "inactiveMembers" : "lowEngagement",
        ]),
    },
  ]
);

const exportCases: ExportCase[] = [
  {
    route: "attendance:csv",
    name: "Attendance Entry Logs CSV",
    format: "csv",
    run: async (lang) => ({
      csv: (await exportAttendanceEntryLogs(
        { from: "2026-07-01", to: "2026-07-01", eventType: "ALL", source: "ALL", result: "ALL", lang },
        "CSV",
        ATTENDANCE_DATA_SCOPES.STRICT_STAFF
      )).buffer.toString("utf8"),
    }),
    expectedHeader: (lang) => translatedHeader(lang, ["timestamp", "employee", "memberCode"]),
  },
  {
    route: "attendance:xlsx",
    name: "Attendance Entry Logs XLSX",
    format: "xlsx",
    run: (lang) => exportAttendanceEntryLogs(
      { from: "2026-07-01", to: "2026-07-01", eventType: "ALL", source: "ALL", result: "ALL", lang },
      "XLSX",
      ATTENDANCE_DATA_SCOPES.STRICT_STAFF
    ),
    expectedSheets: (lang) => translatedSheets(lang, ["entryLogs"]),
  },
  {
    route: "membership-report:csv",
    name: "membership report CSV",
    format: "csv",
    run: (lang) => Promise.resolve(getMembershipReportCsv({ ...baseMembershipQuery, lang })),
    expectedHeader: (lang) => translatedHeader(lang, ["membershipId", "memberCode", "memberName"]),
  },
  {
    route: "reports-attendance:csv",
    name: "attendance daily report CSV",
    format: "csv",
    run: async (lang) => ({
      csv: (await getAttendanceReportCsvExport({ ...baseAttendanceQuery, variant: "daily", sortBy: "memberName", sortDir: "asc", lang }, ATTENDANCE_DATA_SCOPES.FULL_LEGACY)).buffer.toString("utf8"),
    }),
    expectedHeader: (lang) => translatedHeader(lang, ["date", "present", "absentDays"]),
  },
  {
    route: "reports-attendance:xlsx",
    name: "attendance report XLSX",
    format: "xlsx",
    run: (lang) => getAttendanceReportXlsxExport({ ...baseAttendanceQuery, lang }, ATTENDANCE_DATA_SCOPES.FULL_LEGACY),
    expectedSheets: (lang) => translatedSheets(lang, ["summaryKpi", "daily", "members", "evidence"]),
  },
  {
    route: "reports-attendance:pdf",
    name: "attendance report PDF",
    format: "pdf",
    run: (lang) => getAttendanceReportPdfExport({ ...baseAttendanceQuery, lang }, ATTENDANCE_DATA_SCOPES.FULL_LEGACY),
  },
  {
    route: "reports-attendance-compliance:csv",
    name: "attendance compliance CSV",
    format: "csv",
    run: (lang) => getAttendanceComplianceCsv({ ...baseAttendanceComplianceQuery, lang }, ATTENDANCE_DATA_SCOPES.FULL_LEGACY),
    expectedHeader: (lang) => translatedHeader(lang, ["entity", "type", "score"]),
  },
  {
    route: "reports-attendance-compliance:xlsx",
    name: "attendance compliance XLSX",
    format: "xlsx",
    run: (lang) => getAttendanceComplianceXlsx({ ...baseAttendanceComplianceQuery, lang }, ATTENDANCE_DATA_SCOPES.FULL_LEGACY),
    expectedSheets: (lang) => translatedSheets(lang, ["summary", "distribution", "compliance"]),
  },
  {
    route: "reports-cashflow:csv",
    name: "cashflow CSV",
    format: "csv",
    run: (lang) => getCashflowCsv({ ...baseCashflowQuery, lang }),
    expectedHeader: (lang) => translatedHeader(lang, ["period", "inflow", "refunds"]),
  },
  {
    route: "reports-cashflow:xlsx",
    name: "cashflow XLSX",
    format: "xlsx",
    run: (lang) => getCashflowXlsx({ ...baseCashflowQuery, lang }),
    expectedSheets: (lang) => translatedSheets(lang, ["summary", "trend", "expenses"]),
  },
  ...customerActivityExportCases,
  {
    route: "reports-debt-aging:csv",
    name: "debt aging CSV",
    format: "csv",
    run: (lang) => getDebtAgingReportCsv({ ...baseDebtAgingQuery, lang }),
    expectedHeader: (lang) => translatedHeader(lang, ["member", "type", "plan"]),
  },
  {
    route: "reports-debt-aging:xlsx",
    name: "debt aging XLSX",
    format: "xlsx",
    run: (lang) => getDebtAgingReportXlsx({ ...baseDebtAgingQuery, lang }),
    expectedSheets: (lang) => translatedSheets(lang, ["summary", "buckets", "debtors"]),
  },
  {
    route: "reports-payroll-variance:csv",
    name: "payroll variance CSV",
    format: "csv",
    run: (lang) => getPayrollVarianceCsv({ ...basePayrollVarianceQuery, lang }),
    expectedHeader: (lang) => translatedHeader(lang, ["employee", "period", "suggestedPay"]),
  },
  {
    route: "reports-payroll-variance:xlsx",
    name: "payroll variance XLSX",
    format: "xlsx",
    run: (lang) => getPayrollVarianceXlsx({ ...basePayrollVarianceQuery, lang }),
    expectedSheets: (lang) => translatedSheets(lang, ["summary", "trend", "variance"]),
  },
  {
    route: "reports-renewal-forecast:csv",
    name: "renewal forecast CSV",
    format: "csv",
    run: (lang) => getRenewalForecastCsv({ ...baseRenewalForecastQuery, lang }),
    expectedHeader: (lang) => translatedHeader(lang, ["member", "plan", "currentStatus"]),
  },
  {
    route: "reports-renewal-forecast:xlsx",
    name: "renewal forecast XLSX",
    format: "xlsx",
    run: (lang) => getRenewalForecastXlsx({ ...baseRenewalForecastQuery, lang }),
    expectedSheets: (lang) => translatedSheets(lang, ["summary", "byPlan", "forecast"]),
  },
  {
    route: "reports-renewal-forecast:pdf",
    name: "renewal forecast PDF",
    format: "pdf",
    run: (lang) => getRenewalForecastPdf({ ...baseRenewalForecastQuery, lang }),
  },
];

async function testExportRouteMatrixIsCovered() {
  const sourceRoutes = scanSourceExportRoutes();
  assert.deepEqual(sourceRoutes, [...expectedRoutes].sort());

  const coveredRoutes = new Set(exportCases.map((item) => item.route));
  expectedRoutes.forEach((route) => {
    assert.equal(coveredRoutes.has(route), true, `Missing export health case for ${route}`);
  });
}

async function testNoDataExportsProduceValidFiles() {
  installNoDataPrismaMock();
  try {
    for (const item of exportCases) {
      for (const lang of REPORT_EXPORT_LANGUAGES) {
        if (item.format === "csv") {
          const result = await item.run(lang);
          assertValidCsv(item, result, lang);
        } else if (item.format === "xlsx") {
          const result = await item.run(lang);
          assertValidXlsx(item, result, lang);
        } else {
          const result = await item.run(lang);
          assertValidPdf(item, result, lang);
        }
      }
    }
  } finally {
    restorePrisma();
  }
}

async function testMembershipCsvReconcilesFixtureRow() {
  const currentMembership = {
    id: "membership-renewal-2",
    memberId: "member-1",
    planId: "plan-gold",
    status: "ACTIVE",
    startDate: new Date("2026-07-01T00:00:00.000Z"),
    endDate: new Date("2099-08-01T00:00:00.000Z"),
    createdAt: new Date("2026-06-28T09:15:00.000Z"),
    activatedAt: new Date("2026-07-01T07:30:00.000Z"),
    autoRenew: true,
    totalDue: 1300.5,
    totalPaid: 800.25,
    member: {
      id: "member-1",
      code: "C-001",
      firstName: "احمد,",
      lastName: "رضایی",
      phone: "+93 700 000 001",
    },
    plan: {
      id: "plan-gold",
      name: 'Gold "Plus"',
      durationValue: 1,
      durationUnit: "MONTH",
    },
  };

  prismaAny.membership.findMany = async (args: any) => {
    if (args?.select?.memberId) {
      return [
        { id: "membership-first-1", memberId: "member-1", createdAt: new Date("2026-05-01T08:00:00.000Z") },
        { id: currentMembership.id, memberId: "member-1", createdAt: currentMembership.createdAt },
      ];
    }
    return [currentMembership];
  };

  try {
    for (const lang of REPORT_EXPORT_LANGUAGES) {
      const csv = await getMembershipReportCsv({ ...baseMembershipQuery, lang });
      const parsed = parseCsv(csv);
      const labels = getReportExportLabels(lang);

      assert.equal(parsed.length, 2, `membership CSV ${lang} should contain one fixture row`);
      assert.deepEqual(parsed[0], [
        labels.t("membershipId"),
        labels.t("memberCode"),
        labels.t("memberName"),
        labels.t("phone"),
        labels.t("plan"),
        labels.t("status"),
        labels.t("lifecycle"),
        labels.t("startDate"),
        labels.t("membershipEnd"),
        labels.t("createdAt"),
        labels.t("activatedAt"),
        labels.t("autoRenew"),
        labels.t("daysLeft"),
        labels.t("totalDue"),
        labels.t("totalPaid"),
        labels.t("remaining"),
        labels.t("expiringSoon"),
      ]);

      const row = parsed[1]!;
      assert.equal(row.length, 17);
      assert.equal(row[0], currentMembership.id);
      assert.equal(row[1], currentMembership.member.code);
      assert.equal(row[2], "احمد, رضایی");
      assert.equal(row[3], currentMembership.member.phone);
      assert.equal(row[4], currentMembership.plan.name);
      assert.equal(row[5], labels.membershipStatus("ACTIVE"));
      assert.equal(row[6], labels.membershipLifecycle("RENEWAL"));
      if (lang !== "en") {
        assert.notEqual(row[6], "RENEWAL", `membership CSV ${lang} must not expose the internal lifecycle enum`);
      }
      assert.equal(row[7], currentMembership.startDate.toISOString());
      assert.equal(row[8], currentMembership.endDate.toISOString());
      assert.equal(row[9], currentMembership.createdAt.toISOString());
      assert.equal(row[10], currentMembership.activatedAt.toISOString());
      assert.equal(row[11], labels.yesNo(true));
      assert.match(row[12] ?? "", /^-?\d+$/u);
      assert.equal(row[13], "1300.50");
      assert.equal(row[14], "800.25");
      assert.equal(row[15], "500.25");
      assert.equal(row[16], labels.yesNo(false));
    }
  } finally {
    restorePrisma();
  }
}

async function testCustomerActivityExportsReconcileFixtureRows() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const atDay = (days: number, hours: number) => {
    const value = new Date(today);
    value.setDate(value.getDate() + days);
    value.setHours(hours, 0, 0, 0);
    return value;
  };
  const memberships = [
    buildCustomerMembershipFixture("visited", "C-101", "Visited", "Customer", "+93 701", "Gold", atDay(60, 0)),
    buildCustomerMembershipFixture("inactive", "C-102", "Inactive", "Customer", "+93 702", "Silver", atDay(45, 0)),
    buildCustomerMembershipFixture("never", "C-103", "Never", "Visited", null, null, atDay(30, 0)),
  ];
  const visitedEvents = [atDay(-3, 9), atDay(-2, 9), atDay(-1, 9), atDay(0, 9), atDay(0, 17)];
  const inactiveVisit = atDay(-10, 11);

  prismaAny.membership.findMany = async () => memberships;
  prismaAny.attendanceLog.groupBy = async () => [
    { memberId: "member-visited", _max: { recordedAt: visitedEvents.at(-1) } },
    { memberId: "member-inactive", _max: { recordedAt: inactiveVisit } },
  ];
  prismaAny.attendanceLog.findMany = async () => [
    ...visitedEvents.map((recordedAt) => ({ memberId: "member-visited", recordedAt })),
    { memberId: "member-inactive", recordedAt: inactiveVisit },
  ];

  const queryBase = {
    inactiveDays: 7,
    engagementWindowDays: 30,
    lowEngagementMaxVisits: 3,
  } as any;

  try {
    for (const lang of REPORT_EXPORT_LANGUAGES) {
      const labels = getReportExportLabels(lang);
      const cases = [
        {
          tab: "visitedToday" as const,
          headers: ["member", "phone", "plan", "membershipEnd", "firstVisit", "lastVisit", "authorizedEvents"] as ReportExportLabelKey[],
          expectedRows: [[
            "Visited Customer (#C-101)",
            "+93 701",
            "Gold",
            atDay(60, 0).toISOString().slice(0, 10),
            atDay(0, 9).toISOString(),
            atDay(0, 17).toISOString(),
            "2",
          ]],
          sheetName: labels.t("visitedToday"),
        },
        {
          tab: "inactiveMembers" as const,
          headers: ["member", "phone", "plan", "membershipEnd", "lastVisit", "daysSinceLastVisit", "state"] as ReportExportLabelKey[],
          expectedRows: [
            ["Never Visited (#C-103)", "", "", atDay(30, 0).toISOString().slice(0, 10), "", "", labels.customerActivityState("NEVER")],
            [
              "Inactive Customer (#C-102)",
              "+93 702",
              "Silver",
              atDay(45, 0).toISOString().slice(0, 10),
              inactiveVisit.toISOString().slice(0, 19),
              "10",
              labels.customerActivityState("INACTIVE"),
            ],
          ],
          sheetName: labels.t("inactiveMembers"),
        },
        {
          tab: "lowEngagement" as const,
          headers: ["member", "phone", "plan", "membershipEnd", "visitDays", "lastVisit", "daysSinceLastVisit"] as ReportExportLabelKey[],
          expectedRows: [
            ["Never Visited (#C-103)", "", "", atDay(30, 0).toISOString().slice(0, 10), "0", "", ""],
            [
              "Inactive Customer (#C-102)",
              "+93 702",
              "Silver",
              atDay(45, 0).toISOString().slice(0, 10),
              "1",
              inactiveVisit.toISOString().slice(0, 19),
              "10",
            ],
          ],
          sheetName: labels.t("lowEngagement"),
        },
      ];

      for (const item of cases) {
        const query = { ...queryBase, tab: item.tab, lang };
        const csvResult = await getCustomerActivityCsv(query);
        const csvRows = parseCsv(csvResult.csv);
        assert.deepEqual(csvRows[0], item.headers.map((key) => labels.t(key)));
        assert.deepEqual(csvRows.slice(1), item.expectedRows, `customer activity ${item.tab} ${lang} CSV rows`);

        const xlsxResult = await getCustomerActivityXlsx(query);
        const workbook = readZipEntry(xlsxResult.buffer, "xl/workbook.xml");
        assert.match(workbook, new RegExp(`name="${escapeRegExp(labels.t("summary"))}"`, "u"));
        assert.match(workbook, new RegExp(`name="${escapeRegExp(item.sheetName)}"`, "u"));

        const summaryRows = parseXlsxSheet(xlsxResult.buffer, 1);
        assert.deepEqual(summaryRows[0], [labels.t("metric"), labels.t("value")]);
        assert.deepEqual(findXlsxRow(summaryRows, labels.t("activeCustomers")), [labels.t("activeCustomers"), "3"]);
        assert.deepEqual(findXlsxRow(summaryRows, labels.t("visitedToday")), [labels.t("visitedToday"), "1"]);
        assert.deepEqual(findXlsxRow(summaryRows, labels.t("inactive7Days")), [labels.t("inactive7Days"), "2"]);
        assert.deepEqual(findXlsxRow(summaryRows, labels.t("inactive30Days")), [labels.t("inactive30Days"), "1"]);
        assert.deepEqual(findXlsxRow(summaryRows, labels.t("lowEngagement")), [labels.t("lowEngagement"), "2"]);

        const tableRows = parseXlsxSheet(xlsxResult.buffer, 2);
        assert.deepEqual(tableRows[0], item.headers.map((key) => labels.t(key)));
        assert.deepEqual(tableRows.slice(1), item.expectedRows, `customer activity ${item.tab} ${lang} XLSX rows`);
      }
    }
  } finally {
    restorePrisma();
  }
}

async function testPayrollVarianceExportsReconcileFixtureRows() {
  const paymentDate = new Date("2026-07-10T08:00:00.000Z");
  const periods = [
    buildPayrollPeriodFixture("over", "P-103", "Over", "Paid", 10_000, 13_000, "Over payment", paymentDate),
    buildPayrollPeriodFixture("under", "P-102", "Under", "Paid", 10_000, 8_000, "Under payment", paymentDate),
    buildPayrollPeriodFixture("equal", "P-101", "Equal", "Paid", 10_000, 10_000, "Exact payment", paymentDate),
  ];
  prismaAny.payrollPeriod.findMany = async () => periods;

  const queryBase = {
    year: 2026,
    month: 7,
    sortBy: "absoluteVariance",
    sortDir: "desc",
    smallThreshold: 1000,
    mediumThreshold: 5000,
  } as any;

  try {
    for (const lang of REPORT_EXPORT_LANGUAGES) {
      const labels = getReportExportLabels(lang);
      const query = { ...queryBase, lang };
      const csvHeaders = ["employee", "period", "suggestedPay", "actualPaid", "variance", "varianceReason", "paymentStatus"] as ReportExportLabelKey[];
      const expectedCsvRows = [
        ["Over Paid (#P-103)", "2026-07", "10000.00", "13000.00", "3000.00", "Over payment", labels.paymentStatus("PAID")],
        ["Under Paid (#P-102)", "2026-07", "10000.00", "8000.00", "-2000.00", "Under payment", labels.paymentStatus("PAID")],
        ["Equal Paid (#P-101)", "2026-07", "10000.00", "10000.00", "0.00", "Exact payment", labels.paymentStatus("PAID")],
      ];

      const csvResult = await getPayrollVarianceCsv(query);
      const csvRows = parseCsv(csvResult.csv);
      assert.deepEqual(csvRows[0], csvHeaders.map((key) => labels.t(key)));
      assert.deepEqual(csvRows.slice(1), expectedCsvRows, `payroll variance ${lang} CSV rows`);

      const xlsxResult = await getPayrollVarianceXlsx(query);
      const workbook = readZipEntry(xlsxResult.buffer, "xl/workbook.xml");
      [labels.t("summary"), labels.t("trend"), labels.t("variance")].forEach((sheetName) => {
        assert.match(workbook, new RegExp(`name="${escapeRegExp(sheetName)}"`, "u"));
      });

      const summary = parseXlsxSheet(xlsxResult.buffer, 1);
      assert.deepEqual(summary[0], [labels.t("metric"), labels.t("value")]);
      assert.deepEqual(findXlsxRow(summary, labels.t("totalSuggested")), [labels.t("totalSuggested"), "30000"]);
      assert.deepEqual(findXlsxRow(summary, labels.t("totalPaid")), [labels.t("totalPaid"), "31000"]);
      assert.deepEqual(findXlsxRow(summary, labels.t("totalVariance")), [labels.t("totalVariance"), "1000"]);
      assert.deepEqual(findXlsxRow(summary, labels.t("varianceRatePct")), [labels.t("varianceRatePct"), "3.33"]);
      assert.deepEqual(findXlsxRow(summary, labels.t("month")), [labels.t("month"), "2026-07"]);

      const trend = parseXlsxSheet(xlsxResult.buffer, 2);
      assert.deepEqual(trend, [
        [labels.t("label"), labels.t("suggestedPay"), labels.t("paid"), labels.t("variance")],
        ["Over Paid", "10000", "13000", "3000"],
        ["Under Paid", "10000", "8000", "-2000"],
        ["Equal Paid", "10000", "10000", "0"],
      ]);

      const variance = parseXlsxSheet(xlsxResult.buffer, 3);
      assert.deepEqual(variance[0], [
        labels.t("employee"),
        labels.t("period"),
        labels.t("suggestedPay"),
        labels.t("actualPaid"),
        labels.t("variance"),
        labels.t("varianceRatePct"),
        labels.t("varianceReason"),
        labels.t("paymentStatus"),
      ]);
      assert.deepEqual(variance.slice(1), [
        ["Over Paid (#P-103)", "2026-07", "10000", "13000", "3000", "30", "Over payment", labels.paymentStatus("PAID")],
        ["Under Paid (#P-102)", "2026-07", "10000", "8000", "-2000", "-20", "Under payment", labels.paymentStatus("PAID")],
        ["Equal Paid (#P-101)", "2026-07", "10000", "10000", "0", "0", "Exact payment", labels.paymentStatus("PAID")],
      ]);
    }
  } finally {
    restorePrisma();
  }
}

async function testRenewalForecastExportsReconcileFixtureRows() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const atDay = (days: number) => {
    const value = new Date(today);
    value.setDate(value.getDate() + days);
    return value;
  };
  const forecastRows = [
    buildRenewalMembershipFixture("debtor", "R-201", "Debtor", "Member", "Gold", atDay(5), 1300, 800, false),
    buildRenewalMembershipFixture("auto", "R-202", "Auto", "Renew", "Gold", atDay(10), 1000, 1000, true),
    buildRenewalMembershipFixture("outside", "R-203", "Outside", "Range", "Silver", atDay(45), 900, 900, false),
  ];
  const recentRows = [
    { id: "history-a-first", memberId: "history-a" },
    { id: "history-a-renew", memberId: "history-a" },
    { id: "history-b-first", memberId: "history-b" },
    { id: "history-b-renew", memberId: "history-b" },
  ];
  const historyRows = recentRows.map((row, index) => ({ ...row, createdAt: atDay(-120 + index) }));

  prismaAny.membership.findMany = async (args: any) => {
    if (args?.include) {
      const gte = args.where?.endDate?.gte as Date | undefined;
      const lte = args.where?.endDate?.lte as Date | undefined;
      return forecastRows.filter((row) => (!gte || row.endDate >= gte) && (!lte || row.endDate <= lte));
    }
    if (Array.isArray(args?.orderBy)) return historyRows;
    return recentRows;
  };

  const queryBase = {
    horizonDays: 30,
    includeExpired: false,
    showOnlyDebtors: false,
    memberType: "customer",
    sortBy: "daysLeft",
    sortDir: "asc",
  } as any;

  try {
    for (const lang of REPORT_EXPORT_LANGUAGES) {
      const labels = getReportExportLabels(lang);
      const query = { ...queryBase, lang };
      const headers = ["member", "plan", "currentStatus", "expireDate", "daysLeft", "totalDue", "paid", "remaining", "autoRenew", "suggestedAction"] as ReportExportLabelKey[];
      const expectedCsvRows = [
        [
          "Debtor Member (#R-201)",
          "Gold",
          labels.membershipStatus("ACTIVE"),
          atDay(5).toISOString().slice(0, 10),
          "5",
          "1300.00",
          "800.00",
          "500.00",
          labels.yesNo(false),
          labels.suggestedAction("Call"),
        ],
        [
          "Auto Renew (#R-202)",
          "Gold",
          labels.membershipStatus("ACTIVE"),
          atDay(10).toISOString().slice(0, 10),
          "10",
          "1000.00",
          "1000.00",
          "0.00",
          labels.yesNo(true),
          labels.suggestedAction("SMS"),
        ],
      ];

      const csvResult = await getRenewalForecastCsv(query);
      const csvRows = parseCsv(csvResult.csv);
      assert.deepEqual(csvRows[0], headers.map((key) => labels.t(key)));
      assert.deepEqual(csvRows.slice(1), expectedCsvRows, `renewal forecast ${lang} CSV rows`);
      assert.equal(csvResult.csv.includes("Outside Range"), false);

      const xlsxResult = await getRenewalForecastXlsx(query);
      const workbook = readZipEntry(xlsxResult.buffer, "xl/workbook.xml");
      [labels.t("summary"), labels.t("byPlan"), labels.t("forecast")].forEach((sheetName) => {
        assert.match(workbook, new RegExp(`name="${escapeRegExp(sheetName)}"`, "u"));
      });

      const summary = parseXlsxSheet(xlsxResult.buffer, 1);
      assert.deepEqual(summary[0], [labels.t("metric"), labels.t("value")]);
      assert.deepEqual(findXlsxRow(summary, labels.t("expiringCount")), [labels.t("expiringCount"), "2"]);
      assert.deepEqual(findXlsxRow(summary, labels.t("revenueAtRisk")), [labels.t("revenueAtRisk"), "2300"]);
      assert.deepEqual(findXlsxRow(summary, labels.t("expectedRenewals")), [labels.t("expectedRenewals"), "1"]);
      assert.deepEqual(findXlsxRow(summary, labels.t("renewalRatePct")), [labels.t("renewalRatePct"), "50"]);
      assert.deepEqual(findXlsxRow(summary, labels.t("debtAtRisk")), [labels.t("debtAtRisk"), "500"]);
      assert.deepEqual(findXlsxRow(summary, labels.t("horizonDays")), [labels.t("horizonDays"), "30"]);

      const byPlan = parseXlsxSheet(xlsxResult.buffer, 2);
      assert.deepEqual(byPlan, [
        [labels.t("plan"), labels.t("count"), labels.t("totalDue"), labels.t("totalRemaining")],
        ["Gold", "2", "2300", "500"],
      ]);

      const forecast = parseXlsxSheet(xlsxResult.buffer, 3);
      assert.deepEqual(forecast[0], headers.map((key) => labels.t(key)));
      assert.deepEqual(
        forecast.slice(1),
        expectedCsvRows.map((row) => [row[0], row[1], row[2], row[3], row[4], String(Number(row[5])), String(Number(row[6])), String(Number(row[7])), row[8], row[9]]),
        `renewal forecast ${lang} XLSX rows`
      );
      assert.equal(forecast.some((row) => row[0] === "Outside Range (#R-203)"), false);

      const pdfResult = await getRenewalForecastPdf(query);
      assert.equal(pdfResult.buffer.subarray(0, 5).toString("utf8"), "%PDF-");
      assert.match(pdfResult.buffer.toString("latin1"), /%%EOF/u);
      assert.equal(pdfResult.buffer.length > 500, true);
      const pdfText = await extractPdfText(pdfResult.buffer);
      for (const expected of [
        labels.t("horizonDays"),
        labels.t("expiringCount"),
        labels.t("revenueAtRisk"),
        labels.t("expectedRenewals"),
        labels.t("debtAtRisk"),
      ]) {
        assert.equal(pdfTextIncludesWords(pdfText, expected), true, `renewal forecast ${lang} PDF is missing extracted words: ${expected}\n${pdfText}`);
      }
      for (const expected of ["AtlasGym", "Debtor Member", "Auto Renew", "Gold"]) {
        assert.equal(pdfText.includes(expected), true, `renewal forecast ${lang} PDF is missing extracted text: ${expected}\n${pdfText}`);
      }
      assert.equal(pdfText.includes("Outside Range"), false);
      assert.equal(pdfText.includes("undefined"), false);
      assert.equal(pdfText.includes("NaN"), false);
    }
  } finally {
    restorePrisma();
  }
}

async function testDebtAgingExportsReconcileFixtureRows() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const daysAgo = (days: number) => {
    const value = new Date(today);
    value.setDate(value.getDate() - days);
    return value;
  };
  const paymentDate = new Date("2026-07-10T08:00:00.000Z");
  const rows = [
    buildDebtMembershipFixture("day30", "D-030", "Thirty", "Days", "Basic", daysAgo(30), 1000, 600, paymentDate),
    buildDebtMembershipFixture("day31", "D-031", "Thirty One", "Days", "Basic", daysAgo(31), 1500, 900, paymentDate),
    buildDebtMembershipFixture("day61", "D-061", "Sixty One", "Days", "Gold", daysAgo(61), 2000, 1000, paymentDate),
    buildDebtMembershipFixture("day91", "D-091", "Ninety One", "Days", "Gold", daysAgo(91), 3000, 1000, paymentDate),
    buildDebtMembershipFixture("settled", "D-000", "Settled", "Member", "Basic", daysAgo(15), 1000, 1000, paymentDate),
  ];
  prismaAny.membership.findMany = async () => rows;

  const queryBase = {
    dateField: "END_DATE",
    memberType: "all",
    bucket1: 30,
    bucket2: 60,
    bucket3: 90,
    sortBy: "remaining",
    sortDir: "desc",
  } as any;

  try {
    for (const lang of REPORT_EXPORT_LANGUAGES) {
      const labels = getReportExportLabels(lang);
      const query = { ...queryBase, lang };
      const headers = ["member", "type", "plan", "status", "totalDue", "paid", "remaining", "daysPastDue", "bucket", "lastPaymentDate"] as ReportExportLabelKey[];
      const expectedCsvRows = [
        ["Ninety One Days (#D-091)", labels.memberType("CUSTOMER"), "Gold", labels.membershipStatus("ACTIVE"), "3000.00", "1000.00", "2000.00", "91", labels.debtBucket("91+"), "2026-07-10"],
        ["Sixty One Days (#D-061)", labels.memberType("CUSTOMER"), "Gold", labels.membershipStatus("ACTIVE"), "2000.00", "1000.00", "1000.00", "61", labels.debtBucket("61-90"), "2026-07-10"],
        ["Thirty One Days (#D-031)", labels.memberType("CUSTOMER"), "Basic", labels.membershipStatus("ACTIVE"), "1500.00", "900.00", "600.00", "31", labels.debtBucket("31-60"), "2026-07-10"],
        ["Thirty Days (#D-030)", labels.memberType("CUSTOMER"), "Basic", labels.membershipStatus("ACTIVE"), "1000.00", "600.00", "400.00", "30", labels.debtBucket("0-30"), "2026-07-10"],
      ];

      const csvResult = await getDebtAgingReportCsv(query);
      const csvRows = parseCsv(csvResult.csv);
      assert.deepEqual(csvRows[0], headers.map((key) => labels.t(key)));
      assert.deepEqual(csvRows.slice(1), expectedCsvRows, `debt aging ${lang} CSV rows`);
      assert.equal(csvResult.csv.includes("Settled Member"), false);

      const xlsxResult = await getDebtAgingReportXlsx(query);
      const workbook = readZipEntry(xlsxResult.buffer, "xl/workbook.xml");
      [labels.t("summary"), labels.t("buckets"), labels.t("debtors")].forEach((sheetName) => {
        assert.match(workbook, new RegExp(`name="${escapeRegExp(sheetName)}"`, "u"));
      });

      const summary = parseXlsxSheet(xlsxResult.buffer, 1);
      assert.deepEqual(summary[0], [labels.t("metric"), labels.t("value")]);
      assert.deepEqual(findXlsxRow(summary, labels.t("totalOutstanding")), [labels.t("totalOutstanding"), "4000"]);
      assert.deepEqual(findXlsxRow(summary, labels.t("debtorsCount")), [labels.t("debtorsCount"), "4"]);
      assert.deepEqual(findXlsxRow(summary, labels.t("averageDebt")), [labels.t("averageDebt"), "1000"]);
      assert.deepEqual(findXlsxRow(summary, labels.t("largestDebt")), [labels.t("largestDebt"), "2000"]);
      assert.deepEqual(findXlsxRow(summary, labels.t("collectionRate")), [labels.t("collectionRate"), "46.67"]);
      assert.deepEqual(findXlsxRow(summary, labels.t("dateField")), [labels.t("dateField"), labels.debtDateField("END_DATE")]);

      const buckets = parseXlsxSheet(xlsxResult.buffer, 2);
      assert.deepEqual(buckets, [
        [labels.t("bucket"), labels.t("count"), labels.t("outstanding")],
        [labels.debtBucket("0-30"), "1", "400"],
        [labels.debtBucket("31-60"), "1", "600"],
        [labels.debtBucket("61-90"), "1", "1000"],
        [labels.debtBucket("91+"), "1", "2000"],
      ]);

      const debtors = parseXlsxSheet(xlsxResult.buffer, 3);
      assert.deepEqual(debtors[0], headers.map((key) => labels.t(key)));
      assert.deepEqual(
        debtors.slice(1),
        expectedCsvRows.map((row) => [row[0], row[1], row[2], row[3], String(Number(row[4])), String(Number(row[5])), String(Number(row[6])), row[7], row[8], row[9]]),
        `debt aging ${lang} XLSX rows`
      );
    }
  } finally {
    restorePrisma();
  }
}

function buildDebtMembershipFixture(
  suffix: string,
  code: string,
  firstName: string,
  lastName: string,
  planName: string,
  endDate: Date,
  totalDue: number,
  totalPaid: number,
  paidAt: Date
) {
  const startDate = new Date(endDate);
  startDate.setMonth(startDate.getMonth() - 1);
  return {
    id: `debt-membership-${suffix}`,
    memberId: `debt-member-${suffix}`,
    planId: `debt-plan-${planName.toLowerCase()}`,
    status: "ACTIVE",
    createdAt: startDate,
    startDate,
    endDate,
    activatedAt: startDate,
    totalDue,
    totalPaid,
    member: {
      id: `debt-member-${suffix}`,
      code,
      firstName,
      lastName,
      phone: null,
      memberType: "CUSTOMER",
      isStaff: false,
      staffGroup: null,
    },
    plan: { id: `debt-plan-${planName.toLowerCase()}`, name: planName },
    payments: [{ paidAt }],
  };
}

function buildRenewalMembershipFixture(
  suffix: string,
  code: string,
  firstName: string,
  lastName: string,
  planName: string,
  endDate: Date,
  totalDue: number,
  totalPaid: number,
  autoRenew: boolean
) {
  return {
    id: `renewal-membership-${suffix}`,
    memberId: `renewal-member-${suffix}`,
    planId: `renewal-plan-${planName.toLowerCase()}`,
    status: "ACTIVE",
    endDate,
    totalDue,
    totalPaid,
    autoRenew,
    member: {
      id: `renewal-member-${suffix}`,
      code,
      firstName,
      lastName,
      memberType: "CUSTOMER",
      isStaff: false,
    },
    plan: { id: `renewal-plan-${planName.toLowerCase()}`, name: planName },
    payments: [{ paidAt: new Date("2026-07-01T08:00:00.000Z") }],
  };
}

function buildPayrollPeriodFixture(
  suffix: string,
  code: string,
  firstName: string,
  lastName: string,
  suggestedPay: number,
  actualPaid: number,
  notes: string,
  paidAt: Date
) {
  return {
    id: `payroll-period-${suffix}`,
    memberId: `payroll-member-${suffix}`,
    year: 2026,
    month: 7,
    totalDue: suggestedPay,
    status: "PAID",
    member: {
      id: `payroll-member-${suffix}`,
      code,
      firstName,
      lastName,
      staffGroup: { name: "Operations" },
    },
    payments: [
      {
        id: `payroll-payment-${suffix}`,
        amount: actualPaid,
        status: "PAID",
        paidAt,
        notes,
        createdAt: paidAt,
        breakdown: {
          baseAmount: suggestedPay,
          deductions: 0,
          additions: 0,
          totalAdjustment: 0,
          suggestedPay,
          absentDays: 0,
          lateMinutes: 0,
          earlyLeaveMinutes: 0,
          overtimeMinutes: 0,
          justifiedDays: 0,
        },
      },
    ],
  };
}

function buildCustomerMembershipFixture(
  suffix: string,
  code: string,
  firstName: string,
  lastName: string,
  phone: string | null,
  planName: string | null,
  endDate: Date
) {
  return {
    id: `membership-${suffix}`,
    memberId: `member-${suffix}`,
    endDate,
    createdAt: new Date(endDate.getTime() - 30 * 86_400_000),
    member: { id: `member-${suffix}`, code, firstName, lastName, phone },
    plan: planName ? { name: planName } : null,
  };
}

function installNoDataPrismaMock() {
  prismaAny.$transaction = async (queries: Array<Promise<unknown>>) => Promise.all(queries);
  prismaAny.$queryRawUnsafe = async () => [];
  prismaAny.membership.findMany = async () => [];
  prismaAny.member.findMany = async () => [];
  prismaAny.memberShift.findMany = async () => [];
  prismaAny.attendanceLog.findMany = async () => [];
  prismaAny.attendanceLog.count = async () => 0;
  prismaAny.attendanceLog.groupBy = async () => [];
  prismaAny.attendanceJustification.findMany = async () => [];
  prismaAny.device.findMany = async () => [];
  prismaAny.payment.findMany = async () => [];
  prismaAny.payrollPayment.findMany = async () => [];
  prismaAny.payrollPeriod.findMany = async () => [];
}

function restorePrisma() {
  prismaAny.$transaction = originalFns.transaction;
  prismaAny.$queryRawUnsafe = originalFns.queryRawUnsafe;
  prismaAny.membership.findMany = originalFns.membershipFindMany;
  prismaAny.member.findMany = originalFns.memberFindMany;
  prismaAny.memberShift.findMany = originalFns.memberShiftFindMany;
  prismaAny.attendanceLog.findMany = originalFns.attendanceLogFindMany;
  prismaAny.attendanceLog.count = originalFns.attendanceLogCount;
  prismaAny.attendanceLog.groupBy = originalFns.attendanceLogGroupBy;
  prismaAny.attendanceJustification.findMany = originalFns.attendanceJustificationFindMany;
  prismaAny.device.findMany = originalFns.deviceFindMany;
  prismaAny.payment.findMany = originalFns.paymentFindMany;
  prismaAny.payrollPayment.findMany = originalFns.payrollPaymentFindMany;
  prismaAny.payrollPeriod.findMany = originalFns.payrollPeriodFindMany;
}

function assertValidCsv(item: CsvExport, result: string | { csv: string; filename?: string }, lang: ReportExportLanguage) {
  const csv = typeof result === "string" ? result : result.csv;
  const filename = typeof result === "string" ? undefined : result.filename;
  const normalized = csv.replace(/^\uFEFF/u, "");

  assert.equal(typeof csv, "string");
  assert.equal(normalized.startsWith(item.expectedHeader(lang)), true, `${item.name} has an unexpected ${lang} header`);
  assert.doesNotMatch(normalized, /\bundefined\b/u);
  assert.doesNotMatch(normalized, /\bNaN\b/u);
  assert.equal(normalized.includes("\r"), false, `${item.name} should use normalized LF line endings`);
  if (filename) {
    assert.match(filename, /\.csv$/u);
  }
}

function assertValidXlsx(
  item: XlsxExport,
  result: { buffer: Buffer; filename: string; contentType: string },
  lang: ReportExportLanguage
) {
  assert.equal(result.contentType, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  assert.match(result.filename, /\.xlsx$/u);
  assert.equal(Buffer.isBuffer(result.buffer), true);
  assert.equal(result.buffer.subarray(0, 2).toString("utf8"), "PK");

  const workbookXml = readZipEntry(result.buffer, "xl/workbook.xml");
  const expectedSheets = item.expectedSheets(lang);
  expectedSheets.forEach((sheet) => {
    assert.match(workbookXml, new RegExp(`name="${escapeRegExp(sheet)}"`, "u"), `${item.name} is missing ${lang} sheet ${sheet}`);
  });

  for (let index = 0; index < expectedSheets.length; index += 1) {
    const sheetXml = readZipEntry(result.buffer, `xl/worksheets/sheet${index + 1}.xml`);
    assert.match(sheetXml, /<worksheet/u);
    assert.doesNotMatch(sheetXml, /\bundefined\b/u);
    assert.doesNotMatch(sheetXml, /\bNaN\b/u);
  }
}

function assertValidPdf(
  item: PdfExport,
  result: { buffer: Buffer; filename: string; contentType: string },
  lang: ReportExportLanguage
) {
  assert.equal(result.contentType, "application/pdf");
  assert.match(result.filename, /\.pdf$/u);
  assert.equal(Buffer.isBuffer(result.buffer), true);
  assert.equal(result.buffer.subarray(0, 5).toString("utf8"), "%PDF-");
  assert.match(result.buffer.toString("latin1"), /%%EOF/u);
  assert.equal(result.buffer.length > 500, true, `${item.name} ${lang} PDF is too small to be a valid report`);
}

function scanSourceExportRoutes(): RouteSignature[] {
  const modulesRoot = path.join(process.cwd(), "src", "modules");
  const routes: RouteSignature[] = [];

  for (const filePath of listRouterFiles(modulesRoot)) {
    const moduleName = path.basename(path.dirname(filePath));
    const source = readFileSync(filePath, "utf8");
    const matches = source.matchAll(/\.get\("\/export\.(csv|xlsx|pdf)"/gu);
    for (const match of matches) {
      const format = match[1] as ExportFormat | undefined;
      if (!format) continue;
      routes.push(`${moduleName}:${format}` as RouteSignature);
    }
  }

  return [...new Set(routes)].sort();
}

function listRouterFiles(directory: string): string[] {
  const rows = readdirSync(directory, { withFileTypes: true });
  return rows.flatMap((entry) => {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return listRouterFiles(entryPath);
    if (entry.isFile() && entry.name.endsWith(".router.ts")) return [entryPath];
    return [];
  });
}

function readZipEntry(buffer: Buffer, entryName: string) {
  let offset = 0;
  while (offset <= buffer.length - 30) {
    const signature = buffer.readUInt32LE(offset);
    if (signature !== 0x04034b50) {
      offset += 1;
      continue;
    }

    const compressedSize = buffer.readUInt32LE(offset + 18);
    const fileNameLength = buffer.readUInt16LE(offset + 26);
    const extraLength = buffer.readUInt16LE(offset + 28);
    const nameStart = offset + 30;
    const dataStart = nameStart + fileNameLength + extraLength;
    const dataEnd = dataStart + compressedSize;
    const name = buffer.subarray(nameStart, nameStart + fileNameLength).toString("utf8");

    if (name === entryName) {
      return buffer.subarray(dataStart, dataEnd).toString("utf8");
    }

    offset = dataEnd;
  }

  throw new Error(`Missing ZIP entry: ${entryName}`);
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
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

function parseXlsxSheet(buffer: Buffer, sheetNumber: number) {
  const xml = readZipEntry(buffer, `xl/worksheets/sheet${sheetNumber}.xml`);
  return Array.from(xml.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/gu), (rowMatch) =>
    Array.from((rowMatch[1] ?? "").matchAll(/<c\b[^>]*>([\s\S]*?)<\/c>/gu), (cellMatch) => {
      const cell = cellMatch[1] ?? "";
      const inlineText = cell.match(/<t\b[^>]*>([\s\S]*?)<\/t>/u)?.[1];
      const numericValue = cell.match(/<v>([\s\S]*?)<\/v>/u)?.[1];
      return decodeXml(inlineText ?? numericValue ?? "");
    })
  );
}

function findXlsxRow(rows: string[][], firstCell: string) {
  const row = rows.find((item) => item[0] === firstCell);
  assert.ok(row, `Missing XLSX row starting with ${firstCell}`);
  return row;
}

function decodeXml(value: string) {
  return value
    .replace(/&quot;/gu, '"')
    .replace(/&apos;/gu, "'")
    .replace(/&lt;/gu, "<")
    .replace(/&gt;/gu, ">")
    .replace(/&amp;/gu, "&");
}

async function run() {
  const tests: Array<{ name: string; execute: () => Promise<void> }> = [
    { name: "export route matrix is covered", execute: testExportRouteMatrixIsCovered },
    { name: "no-data backend exports produce valid files", execute: testNoDataExportsProduceValidFiles },
    { name: "membership CSV reconciles fixture row in every language", execute: testMembershipCsvReconcilesFixtureRow },
    { name: "customer activity CSV and XLSX reconcile every tab in every language", execute: testCustomerActivityExportsReconcileFixtureRows },
    { name: "payroll variance CSV and XLSX reconcile fixture rows in every language", execute: testPayrollVarianceExportsReconcileFixtureRows },
    { name: "renewal forecast exports reconcile fixture rows in every language", execute: testRenewalForecastExportsReconcileFixtureRows },
    { name: "debt aging CSV and XLSX reconcile fixture rows in every language", execute: testDebtAgingExportsReconcileFixtureRows },
  ];

  for (const test of tests) {
    await test.execute();
    console.log(`ok - ${test.name}`);
  }
}

run().catch((error) => {
  restorePrisma();
  console.error(error);
  process.exitCode = 1;
});
