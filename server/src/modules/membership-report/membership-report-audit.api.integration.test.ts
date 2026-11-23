import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import express from "express";
import {
  AdminPermission,
  AdminRole,
  AuditActor,
  MembershipStatus,
  PermissionMode,
  type Prisma,
} from "@prisma/client";
import { env } from "../../config/env";
import { prisma } from "../../lib/prisma";
import { errorHandler } from "../../middlewares/error-handler";
import { membershipReportRouter } from "./membership-report.router";
import { membershipReportQuerySchema } from "./membership-report.schemas";
import {
  getAuditedMembershipReportCsv,
  type MembershipReportExportContext,
} from "./membership-report.service";
import { reportsAttendanceRouter } from "../reports-attendance/reports-attendance.router";
import { attendanceReportCsvExportQuerySchema } from "../reports-attendance/reports-attendance.schemas";
import { getAuditedAttendanceReportExport } from "../reports-attendance/reports-attendance.service";
import { reportsCustomerActivityRouter } from "../reports-customer-activity/reports-customer-activity.router";
import { reportsDebtAgingRouter } from "../reports-debt-aging/reports-debt-aging.router";
import { reportsRenewalForecastRouter } from "../reports-renewal-forecast/reports-renewal-forecast.router";
import { reportsPayrollVarianceRouter } from "../reports-payroll-variance/reports-payroll-variance.router";
import { reportsAttendanceComplianceRouter } from "../reports-attendance-compliance/reports-attendance-compliance.router";
import { reportsCashflowRouter } from "../reports-cashflow/reports-cashflow.router";
import { generateAuditedReportExport } from "../reports/shared/report-export.audit";
import { ATTENDANCE_DATA_SCOPES } from "../attendance/attendance-edition-scope";

type Fixture = {
  suffix: string;
  allowedAdminId: string;
  allowedSessionId: string;
  allowedToken: string;
  deniedAdminId: string;
  deniedSessionId: string;
  deniedToken: string;
  memberId: string;
  memberCode: string;
  memberName: string;
  memberPhone: string;
  planId: string;
  membershipId: string;
};

function assertSafeDatabaseTarget() {
  if (env.NODE_ENV === "production") {
    throw new Error("Membership report audit integration tests refuse to run with NODE_ENV=production");
  }
  const hostname = new URL(env.DATABASE_URL).hostname.toLowerCase();
  const localHosts = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);
  if (
    !localHosts.has(hostname)
    && process.env["MEMBERSHIP_REPORT_AUDIT_API_INTEGRATION_ALLOW_REMOTE"] !== "1"
  ) {
    throw new Error(
      `Membership report audit integration tests refuse non-local database host: ${hostname}`
    );
  }
}

async function createFixture(): Promise<Fixture> {
  const suffix = randomUUID();
  const compactSuffix = suffix.replaceAll("-", "");
  const allowedToken = `membership-report-audit-allowed-${suffix}`;
  const deniedToken = `membership-report-audit-denied-${suffix}`;
  const memberName = `Private-${compactSuffix}`;
  const memberPhone = `+93-${compactSuffix.slice(0, 9)}`;
  const memberCode = `IT-RPT-${compactSuffix.slice(0, 12)}`;

  const records = await prisma.$transaction(async (tx) => {
    const allowedAdmin = await tx.adminUser.create({
      data: {
        username: `it-report-audit-allowed-${suffix}`,
        passwordHash: "not-used-by-membership-report-audit-test",
        role: AdminRole.STAFF,
      },
    });
    const deniedAdmin = await tx.adminUser.create({
      data: {
        username: `it-report-audit-denied-${suffix}`,
        passwordHash: "not-used-by-membership-report-audit-test",
        role: AdminRole.STAFF,
      },
    });
    await tx.adminUserPermission.createMany({
      data: [
        permissionRow(allowedAdmin.id, AdminPermission.SIGN_IN, PermissionMode.ALLOW),
        permissionRow(allowedAdmin.id, AdminPermission.FINANCIAL_EXPORT, PermissionMode.ALLOW),
        permissionRow(deniedAdmin.id, AdminPermission.SIGN_IN, PermissionMode.ALLOW),
        permissionRow(deniedAdmin.id, AdminPermission.FINANCIAL_EXPORT, PermissionMode.DENY),
      ],
    });
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
    const allowedSession = await tx.adminSession.create({
      data: {
        adminUserId: allowedAdmin.id,
        tokenHash: hashSessionToken(allowedToken),
        expiresAt,
      },
    });
    const deniedSession = await tx.adminSession.create({
      data: {
        adminUserId: deniedAdmin.id,
        tokenHash: hashSessionToken(deniedToken),
        expiresAt,
      },
    });
    const member = await tx.member.create({
      data: {
        code: memberCode,
        firstName: memberName,
        phone: memberPhone,
        notes: `never-audit-member-notes-${suffix}`,
        memberType: "CUSTOMER",
        isStaff: false,
      },
    });
    const plan = await tx.membershipPlan.create({
      data: {
        name: `IT report plan ${suffix}`,
        slug: `it-report-plan-${suffix}`,
        durationDays: 30,
        price: 1_000,
      },
    });
    const startDate = new Date("2026-07-01T00:00:00.000Z");
    const endDate = new Date("2099-07-31T23:59:59.000Z");
    const membership = await tx.membership.create({
      data: {
        memberId: member.id,
        planId: plan.id,
        startDate,
        endDate,
        expiresAt: endDate,
        status: MembershipStatus.ACTIVE,
        basePrice: 1_000,
        totalDue: 1_000,
        totalPaid: 250,
        createdByAdminId: allowedAdmin.id,
      },
    });
    return {
      allowedAdmin,
      deniedAdmin,
      allowedSession,
      deniedSession,
      member,
      plan,
      membership,
    };
  });

  return {
    suffix,
    allowedAdminId: records.allowedAdmin.id,
    allowedSessionId: records.allowedSession.id,
    allowedToken,
    deniedAdminId: records.deniedAdmin.id,
    deniedSessionId: records.deniedSession.id,
    deniedToken,
    memberId: records.member.id,
    memberCode,
    memberName,
    memberPhone,
    planId: records.plan.id,
    membershipId: records.membership.id,
  };
}

function permissionRow(
  adminUserId: string,
  permission: AdminPermission,
  mode: PermissionMode
) {
  return {
    adminUserId,
    permission,
    mode,
    reason: "Membership report audit integration fixture",
  };
}

function hashSessionToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function buildTestApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/v1/membership-report", membershipReportRouter);
  app.use("/api/v1/reports/attendance", reportsAttendanceRouter);
  app.use("/api/v1/reports/customer-activity", reportsCustomerActivityRouter);
  app.use("/api/v1/reports/debt-aging", reportsDebtAgingRouter);
  app.use("/api/v1/reports/renewal-forecast", reportsRenewalForecastRouter);
  app.use("/api/v1/reports/payroll-variance", reportsPayrollVarianceRouter);
  app.use("/api/v1/reports/attendance-compliance", reportsAttendanceComplianceRouter);
  app.use("/api/v1/reports/cashflow", reportsCashflowRouter);
  app.use(errorHandler);
  return app;
}

async function testRemainingReportExportAudits(fixture: Fixture) {
  const server = createServer(buildTestApp());
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const address = server.address() as AddressInfo;
    const origin = `http://127.0.0.1:${address.port}/api/v1/reports`;
    const cases = [
      ["customer_activity", "customer-activity", "CustomerActivityReport", "tab=visitedToday&inactiveDays=7&engagementWindowDays=30&lowEngagementMaxVisits=3"],
      ["debt_aging", "debt-aging", "DebtAgingReport", "dateField=END_DATE&memberType=all&bucket1=30&bucket2=60&bucket3=90&sortBy=remaining&sortDir=desc"],
      ["renewal_forecast", "renewal-forecast", "RenewalForecastReport", "horizonDays=30&includeExpired=false&showOnlyDebtors=false&memberType=customer&sortBy=daysLeft&sortDir=asc"],
      ["payroll_variance", "payroll-variance", "PayrollVarianceReport", "year=2026&month=7&sortBy=absoluteVariance&sortDir=desc&smallThreshold=1000&mediumThreshold=5000"],
      ["attendance_compliance", "attendance-compliance", "AttendanceComplianceReport", "from=2026-07-01&to=2026-07-01&memberType=both&shiftMode=primary&eventType=all&onlyAnomalies=false&viewBy=member&sortBy=score&sortDir=asc&lateMinutesWeight=0.05&lateCountWeight=1&absentWeight=8&noCheckoutWeight=4&deniedWeight=6"],
      ["cashflow", "cashflow", "CashflowReport", "from=2026-07-01&to=2026-07-01&groupBy=day&includePayroll=true"],
    ] as const;
    const formats: Record<string, readonly string[]> = {
      customer_activity: ["csv", "xlsx"],
      debt_aging: ["csv", "xlsx"],
      renewal_forecast: ["csv", "xlsx", "pdf"],
      payroll_variance: ["csv", "xlsx"],
      attendance_compliance: ["csv", "xlsx"],
      cashflow: ["csv", "xlsx"],
    };

    for (const [token, route, targetType, baseQuery] of cases) {
      const unauthenticated = await fetch(`${origin}/${route}/export.csv?${baseQuery}&lang=en`);
      assert.equal(unauthenticated.status, 401);
      const denied = await fetch(`${origin}/${route}/export.csv?${baseQuery}&lang=en`, {
        headers: authenticatedHeaders(fixture.deniedToken),
      });
      assert.equal(denied.status, 403);

      for (const format of formats[token] ?? []) {
        const response = await fetch(`${origin}/${route}/export.${format}?${baseQuery}&lang=fa`, {
          headers: authenticatedHeaders(fixture.allowedToken),
        });
        assert.equal(response.status, 200, `${route} ${format}`);
        await response.arrayBuffer();
        const audit = await prisma.auditLog.findFirst({
          where: {
            actorId: fixture.allowedAdminId,
            action: `report.${token}.exported`,
            targetType,
            success: true,
          },
          orderBy: { createdAt: "desc" },
        });
        assert.ok(audit, `${route} ${format} audit`);
        assert.equal(audit.sessionId, fixture.allowedSessionId);
        assert.equal(audit.beforeData, null);
        assert.equal(audit.afterData, null);
        const metadata = asJsonObject(audit.metadata);
        assert.equal(metadata["format"], format.toUpperCase());
        assert.equal(metadata["outcome"], "EXPORTED");
        assert.equal(typeof metadata["rowCount"], "number");
        const filters = asJsonObject(metadata["filters"] as Prisma.JsonValue);
        assert.equal(filters["lang"], "fa");
        assert.equal(filters["searchApplied"], false);
      }
    }

    const pdfDataResponse = await fetch(
      `${origin}/renewal-forecast/export-pdf-data?horizonDays=30&includeExpired=false&showOnlyDebtors=false&memberType=customer&sortBy=daysLeft&sortDir=asc&lang=en`,
      { headers: authenticatedHeaders(fixture.allowedToken) }
    );
    assert.equal(pdfDataResponse.status, 200);
    const pdfData = await pdfDataResponse.json() as { filename: string; contentType: string; data: string };
    assert.match(pdfData.filename, /\.pdf$/);
    assert.equal(pdfData.contentType, "application/pdf");
    assert.equal(Buffer.from(pdfData.data, "base64").subarray(0, 4).toString("ascii"), "%PDF");
    const pdfDataAudit = await prisma.auditLog.findFirst({
      where: {
        actorId: fixture.allowedAdminId,
        action: "report.renewal_forecast.exported",
        targetType: "RenewalForecastReport",
        success: true,
      },
      orderBy: { createdAt: "desc" },
    });
    assert.equal(asJsonObject(pdfDataAudit?.metadata ?? {})["format"], "PDF");

    const failureAction = "report.cashflow.exported";
    await assert.rejects(() =>
      generateAuditedReportExport({
        context: {
          actor: {
            id: fixture.allowedAdminId,
            role: AdminRole.STAFF,
            sessionId: fixture.allowedSessionId,
          },
          meta: {
            ipAddress: "127.0.0.1",
            userAgent: "shared-report-audit-integration-test",
          },
        },
        action: failureAction,
        targetType: "CashflowReport",
        targetId: "cashflow-report",
        format: "CSV",
        filters: { searchApplied: true },
        generate: async () => {
          throw new Error(`private-report-error-${fixture.suffix}`);
        },
      })
    );
    const failed = await prisma.auditLog.findFirst({
      where: { actorId: fixture.allowedAdminId, action: failureAction, success: false },
      orderBy: { createdAt: "desc" },
    });
    assert.ok(failed);
    assert.equal(JSON.stringify(failed).includes(`private-report-error-${fixture.suffix}`), false);

    const invalidSessionId = `missing-shared-report-session-${fixture.suffix}`;
    await assert.rejects(() =>
      generateAuditedReportExport({
        context: {
          actor: { id: fixture.allowedAdminId, role: AdminRole.STAFF, sessionId: invalidSessionId },
          meta: {},
        },
        action: "report.debt_aging.exported",
        targetType: "DebtAgingReport",
        targetId: "debt-aging-report",
        format: "CSV",
        filters: {},
        generate: async () => ({
          filename: "should-not-download.csv",
          contentType: "text/csv",
          body: "private",
          rowCount: 1,
        }),
      })
    );
    console.log("ok remaining report exports are permission-guarded, attributed, private, failed-audited, and fail closed");
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => error ? reject(error) : resolve())
    );
  }
}

async function testAttendanceExportAudits(fixture: Fixture) {
  const server = createServer(buildTestApp());
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const address = server.address() as AddressInfo;
    const baseUrl = `http://127.0.0.1:${address.port}/api/v1/reports/attendance/export.csv`;
    const actions = {
      daily: "report.daily_attendance.exported",
      members: "report.attendance.exported",
      evidence: "report.entry_logs.exported",
    } as const;

    const unauthenticated = await fetch(`${baseUrl}?from=2026-07-01&to=2026-07-01&variant=daily&lang=fa`);
    assert.equal(unauthenticated.status, 401);
    const denied = await fetch(`${baseUrl}?from=2026-07-01&to=2026-07-01&variant=daily&lang=fa`, {
      headers: authenticatedHeaders(fixture.deniedToken),
    });
    assert.equal(denied.status, 403);

    for (const variant of ["daily", "members", "evidence"] as const) {
      const query = new URLSearchParams({
        from: "2026-07-01",
        to: "2026-07-01",
        memberId: fixture.memberId,
        search: fixture.memberName,
        variant,
        lang: "fa",
      });
      const response = await fetch(`${baseUrl}?${query}`, {
        headers: authenticatedHeaders(fixture.allowedToken),
      });
      assert.equal(response.status, 200);
      const bytes = new Uint8Array(await response.arrayBuffer());
      assert.deepEqual(Array.from(bytes.slice(0, 3)), [0xef, 0xbb, 0xbf]);

      const audit = await prisma.auditLog.findFirst({
        where: { actorId: fixture.allowedAdminId, action: actions[variant], success: true },
        orderBy: { createdAt: "desc" },
      });
      assert.ok(audit);
      assert.equal(audit.actorRole, AdminRole.STAFF);
      assert.equal(audit.sessionId, fixture.allowedSessionId);
      assert.equal(audit.userAgent, "membership-report-audit-integration-test");
      assert.equal(audit.beforeData, null);
      assert.equal(audit.afterData, null);
      const metadata = asJsonObject(audit.metadata);
      assert.equal(metadata["format"], "CSV");
      assert.equal(metadata["outcome"], "EXPORTED");
      assert.equal(typeof metadata["rowCount"], "number");
      const filters = asJsonObject(metadata["filters"] as Prisma.JsonValue);
      assert.equal(filters["language"], "fa");
      assert.equal(filters["searchApplied"], true);
      assert.equal(JSON.stringify(audit).includes(fixture.memberName), false);
    }

    for (const variant of ["daily-attendance", "entry-logs"] as const) {
      const response = await fetch(
        `http://127.0.0.1:${address.port}/api/v1/reports/attendance/client-export-audit`,
        {
          method: "POST",
          headers: {
            ...authenticatedHeaders(fixture.allowedToken),
            "content-type": "application/json",
          },
          body: JSON.stringify({
            variant,
            rowCount: 1,
            lang: "ps",
            filters: {
              from: "2026-07-01",
              to: "2026-07-01",
              searchApplied: true,
            },
          }),
        }
      );
      assert.equal(response.status, 201);
      const action = variant === "daily-attendance"
        ? "report.daily_attendance.exported"
        : "report.entry_logs.exported";
      const audit = await prisma.auditLog.findFirst({
        where: { actorId: fixture.allowedAdminId, action },
        orderBy: { createdAt: "desc" },
      });
      assert.ok(audit);
      const metadata = asJsonObject(audit.metadata);
      assert.equal(metadata["generation"], "CLIENT");
      assert.equal(metadata["rowCount"], 1);
      assert.equal(metadata["language"], "ps");
      assert.equal(JSON.stringify(audit).includes(fixture.memberName), false);
    }

    const invalidSessionId = `missing-attendance-export-session-${fixture.suffix}`;
    await assert.rejects(() =>
      getAuditedAttendanceReportExport(
        attendanceReportCsvExportQuerySchema.parse({
          from: "2026-07-01",
          to: "2026-07-01",
          memberId: fixture.memberId,
          variant: "daily",
          lang: "en",
        }),
        "CSV",
        {
          actor: { id: fixture.allowedAdminId, role: AdminRole.STAFF, sessionId: invalidSessionId },
          meta: { userAgent: "attendance-export-fail-closed-test" },
        },
        ATTENDANCE_DATA_SCOPES.FULL_LEGACY
      )
    );
    assert.equal(
      await prisma.auditLog.count({ where: { sessionId: invalidSessionId } }),
      0
    );
    console.log("ok attendance CSV exports are permission-guarded, attributed, private, and fail closed");
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => error ? reject(error) : resolve())
    );
  }
}

async function testPermissionGuardsAndSuccessfulAudit(fixture: Fixture) {
  const server = createServer(buildTestApp());
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const address = server.address() as AddressInfo;
    const baseUrl = `http://127.0.0.1:${address.port}/api/v1/membership-report/export.csv`;
    const query = new URLSearchParams({
      preset: "ALL",
      memberId: fixture.memberId,
      search: fixture.memberName,
      remaining: "ALL",
      sortBy: "CREATED_AT",
      sortDir: "desc",
      lang: "fa",
    });

    const unauthenticated = await fetch(`${baseUrl}?${query}`);
    assert.equal(unauthenticated.status, 401);

    const denied = await fetch(`${baseUrl}?${query}`, {
      headers: authenticatedHeaders(fixture.deniedToken),
    });
    assert.equal(denied.status, 403);
    assert.equal(
      await prisma.auditLog.count({
        where: {
          actorId: fixture.deniedAdminId,
          action: "report.membership.exported",
        },
      }),
      0
    );

    const response = await fetch(`${baseUrl}?${query}`, {
      headers: authenticatedHeaders(fixture.allowedToken),
    });
    assert.equal(response.status, 200);
    assert.match(response.headers.get("content-type") ?? "", /^text\/csv/u);
    assert.match(
      response.headers.get("content-disposition") ?? "",
      /^attachment; filename="membership-report-/u
    );
    const responseBytes = new Uint8Array(await response.arrayBuffer());
    assert.deepEqual(
      Array.from(responseBytes.slice(0, 3)),
      [0xEF, 0xBB, 0xBF],
      "Expected UTF-8 BOM at the start of the downloaded CSV"
    );
    const csv = Buffer.from(responseBytes).toString("utf8");
    assert.ok(csv.includes(fixture.membershipId));
    assert.ok(csv.includes(fixture.memberCode));
    assert.ok(csv.includes(fixture.memberName));
    assert.ok(csv.includes(fixture.memberPhone));
    assert.ok(csv.includes("تمدید"), "Expected localized Dari lifecycle value in the downloaded CSV");
    assert.ok(!csv.includes(",RENEWAL,"), "Downloaded Dari CSV must not expose the internal lifecycle enum");

    const audit = await prisma.auditLog.findFirst({
      where: {
        actorId: fixture.allowedAdminId,
        action: "report.membership.exported",
        targetType: "MembershipReport",
        targetId: "membership-report",
        success: true,
      },
      orderBy: { createdAt: "desc" },
    });
    assert.ok(audit, "Expected successful membership report export audit");
    assert.equal(audit.actorType, AuditActor.ADMIN);
    assert.equal(audit.actorRole, AdminRole.STAFF);
    assert.equal(audit.sessionId, fixture.allowedSessionId);
    assert.ok(audit.ipAddress);
    assert.equal(audit.userAgent, "membership-report-audit-integration-test");
    assert.equal(audit.beforeData, null);
    assert.equal(audit.afterData, null);

    const metadata = asJsonObject(audit.metadata);
    assert.equal(metadata["format"], "CSV");
    assert.equal(metadata["rowCount"], 1);
    assert.equal(metadata["outcome"], "EXPORTED");
    const filters = asJsonObject(metadata["filters"] as Prisma.JsonValue);
    assert.equal(filters["preset"], "ALL");
    assert.equal(filters["memberId"], fixture.memberId);
    assert.equal(filters["searchApplied"], true);
    assert.equal(filters["language"], "fa");

    const serializedAudit = JSON.stringify(audit);
    assert.equal(serializedAudit.includes(fixture.memberName), false);
    assert.equal(serializedAudit.includes(fixture.memberPhone), false);
    assert.equal(serializedAudit.includes(fixture.memberCode), false);
    assert.equal(serializedAudit.includes(`never-audit-member-notes-${fixture.suffix}`), false);
    console.log(
      "ok membership report CSV export is permission-guarded, attributed, row-counted, and privacy-safe"
    );
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => error ? reject(error) : resolve())
    );
  }
}

async function testGenerationFailureAudit(fixture: Fixture) {
  const prismaAny = prisma as any;
  const originalFindMany = prismaAny.membership.findMany;
  prismaAny.membership.findMany = async () => {
    throw new Error(`forced-private-generation-error-${fixture.suffix}`);
  };
  try {
    await assert.rejects(() =>
      getAuditedMembershipReportCsv(
        membershipReportQuerySchema.parse({
          preset: "ALL",
          memberId: fixture.memberId,
          search: fixture.memberName,
          lang: "ps",
        }),
        validContext(fixture)
      )
    );
  } finally {
    prismaAny.membership.findMany = originalFindMany;
  }

  const audit = await prisma.auditLog.findFirst({
    where: {
      actorId: fixture.allowedAdminId,
      action: "report.membership.exported",
      success: false,
    },
    orderBy: { createdAt: "desc" },
  });
  assert.ok(audit, "Expected failed membership report generation audit");
  const metadata = asJsonObject(audit.metadata);
  assert.equal(metadata["format"], "CSV");
  assert.equal(metadata["rowCount"], 0);
  assert.equal(metadata["outcome"], "GENERATION_FAILED");
  assert.equal(JSON.stringify(audit).includes(fixture.memberName), false);
  assert.equal(JSON.stringify(audit).includes(`forced-private-generation-error-${fixture.suffix}`), false);
  console.log("ok failed membership report generation writes a safe failed audit");
}

async function testAuditFailureIsFailClosed(fixture: Fixture) {
  const invalidSessionId = `missing-report-session-${fixture.suffix}`;
  const invalidContext: MembershipReportExportContext = {
    actor: {
      id: fixture.allowedAdminId,
      role: AdminRole.STAFF,
      sessionId: invalidSessionId,
    },
    meta: {
      ipAddress: "127.0.0.1",
      userAgent: "membership-report-audit-fail-closed-test",
    },
  };
  const query = membershipReportQuerySchema.parse({
    preset: "ALL",
    memberId: fixture.memberId,
    lang: "en",
  });

  await assert.rejects(() => getAuditedMembershipReportCsv(query, invalidContext));
  assert.equal(
    await prisma.auditLog.count({
      where: {
        sessionId: invalidSessionId,
        action: "report.membership.exported",
      },
    }),
    0
  );
  console.log("ok membership report download fails closed when its success audit cannot be stored");
}

function validContext(fixture: Fixture): MembershipReportExportContext {
  return {
    actor: {
      id: fixture.allowedAdminId,
      role: AdminRole.STAFF,
      sessionId: fixture.allowedSessionId,
    },
    meta: {
      ipAddress: "127.0.0.1",
      userAgent: "membership-report-audit-integration-test",
    },
  };
}

function authenticatedHeaders(token: string) {
  return {
    cookie: `${env.AUTH_COOKIE_NAME}=${encodeURIComponent(token)}`,
    "user-agent": "membership-report-audit-integration-test",
  };
}

function asJsonObject(value: Prisma.JsonValue | null) {
  assert.ok(
    value && typeof value === "object" && !Array.isArray(value),
    "Expected audit JSON object"
  );
  return value as Prisma.JsonObject;
}

async function cleanupFixture(fixture: Fixture) {
  await prisma.auditLog.deleteMany({
    where: { actorId: { in: [fixture.allowedAdminId, fixture.deniedAdminId] } },
  });
  await prisma.membership.deleteMany({ where: { id: fixture.membershipId } });
  await prisma.membershipPlan.deleteMany({ where: { id: fixture.planId } });
  await prisma.member.deleteMany({ where: { id: fixture.memberId } });
  await prisma.adminUserPermission.deleteMany({
    where: { adminUserId: { in: [fixture.allowedAdminId, fixture.deniedAdminId] } },
  });
  await prisma.adminSession.deleteMany({
    where: { id: { in: [fixture.allowedSessionId, fixture.deniedSessionId] } },
  });
  await prisma.adminUser.deleteMany({
    where: { id: { in: [fixture.allowedAdminId, fixture.deniedAdminId] } },
  });

  const leftovers = await prisma.$transaction([
    prisma.auditLog.count({
      where: { actorId: { in: [fixture.allowedAdminId, fixture.deniedAdminId] } },
    }),
    prisma.membership.count({ where: { id: fixture.membershipId } }),
    prisma.membershipPlan.count({ where: { id: fixture.planId } }),
    prisma.member.count({ where: { id: fixture.memberId } }),
    prisma.adminUserPermission.count({
      where: { adminUserId: { in: [fixture.allowedAdminId, fixture.deniedAdminId] } },
    }),
    prisma.adminSession.count({
      where: { id: { in: [fixture.allowedSessionId, fixture.deniedSessionId] } },
    }),
    prisma.adminUser.count({
      where: { id: { in: [fixture.allowedAdminId, fixture.deniedAdminId] } },
    }),
  ]);
  assert.deepEqual(leftovers, [0, 0, 0, 0, 0, 0, 0]);
  console.log("ok membership report audit integration fixture cleanup verified (0 records left)");
}

async function main() {
  assertSafeDatabaseTarget();
  const fixture = await createFixture();
  try {
    await testPermissionGuardsAndSuccessfulAudit(fixture);
    await testGenerationFailureAudit(fixture);
    await testAuditFailureIsFailClosed(fixture);
    await testAttendanceExportAudits(fixture);
    await testRemainingReportExportAudits(fixture);
  } finally {
    await cleanupFixture(fixture);
  }
  console.log(
    "Membership report audit API integration tests passed (auth, row count, privacy, failure audit, fail-closed, cleanup)."
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
