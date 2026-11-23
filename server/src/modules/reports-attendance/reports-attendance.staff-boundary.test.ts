import assert from "node:assert/strict";
import { inflateRawSync } from "node:zlib";
import {
  AdminRole,
  AttendanceSource,
  AttendanceType,
  MemberType,
} from "@prisma/client";
import { prisma } from "../../lib/prisma";
import {
  ATTENDANCE_DATA_SCOPES,
  type AttendanceDataScope,
} from "../attendance/attendance-edition-scope";
import {
  getAttendanceComplianceCsv,
  getAttendanceComplianceReport,
  getAttendanceComplianceXlsx,
} from "../reports-attendance-compliance/reports-attendance-compliance.service";
import { extractPdfText } from "../reports/shared/pdf-text.test-utils";
import {
  getAttendanceReportCsvExport,
  getAttendanceReportDaily,
  getAttendanceReportEvidence,
  getAttendanceReportMembers,
  getAttendanceReportPdfExport,
  getAttendanceReportSummary,
  getAttendanceReportXlsxExport,
  getAuditedAttendanceReportExport,
  recordAttendanceClientCsvExport,
} from "./reports-attendance.service";

type FixtureMember = {
  id: string;
  code: string;
  firstName: string;
  lastName: string;
  phone: string;
  memberType: MemberType;
  isStaff: boolean;
  archivedAt: Date | null;
  staffGroupId: string | null;
  staffGroupName: string | null;
};

type FixtureShift = {
  id: string;
  memberId: string;
  shiftId: string;
  shiftName: string;
  shiftStart: string;
  shiftEnd: string;
  weekdays: number[];
  graceMinutes: number;
  isActive: boolean;
};

type FixtureLog = {
  id: string;
  memberId: string;
  entryType: AttendanceType;
  recordedAt: Date;
  source: AttendanceSource;
  isAuthorized: boolean;
  reason: string | null;
  deviceId: string | null;
};

type FixtureJustification = {
  id: string;
  memberId: string;
  date: Date;
};

type Fixture = {
  members: FixtureMember[];
  shifts: FixtureShift[];
  logs: FixtureLog[];
  justifications: FixtureJustification[];
  devices: Array<{ id: string; name: string }>;
};

type CapturedMemberQuery = {
  where: any;
  kind: "analytics" | "compliance-group";
};

type CapturedLogQuery = {
  where: any;
  kind: "analytics" | "evidence";
};

type Captures = {
  members: CapturedMemberQuery[];
  shifts: any[];
  logs: CapturedLogQuery[];
  logCounts: any[];
  justifications: any[];
  audits: any[];
};

const FULL = ATTENDANCE_DATA_SCOPES.FULL_LEGACY;
const STRICT = ATTENDANCE_DATA_SCOPES.STRICT_STAFF;
const REPORT_DATE = "2026-09-01";
const CANONICAL_STAFF_ID = "canonical-staff";
const CUSTOMER_ID = "canonical-customer";

const forbiddenTokens = [
  "Customer Leak",
  "LEAK-CUSTOMER",
  "Mismatch StaffFalse",
  "LEAK-STAFF-FALSE",
  "Mismatch CustomerTrue",
  "LEAK-CUSTOMER-TRUE",
  "Archived Staff",
  "LEAK-ARCHIVED",
] as const;

const prismaAny = prisma as any;
const originalPrisma = {
  transaction: prismaAny.$transaction,
  memberFindMany: prismaAny.member.findMany,
  memberShiftFindMany: prismaAny.memberShift.findMany,
  attendanceLogFindMany: prismaAny.attendanceLog.findMany,
  attendanceLogCount: prismaAny.attendanceLog.count,
  attendanceJustificationFindMany: prismaAny.attendanceJustification.findMany,
  deviceFindMany: prismaAny.device.findMany,
  auditLogCreate: prismaAny.auditLog.create,
};

const fixture = buildFixture();
const captures: Captures = {
  members: [],
  shifts: [],
  logs: [],
  logCounts: [],
  justifications: [],
  audits: [],
};

function installPrismaMocks() {
  prismaAny.$transaction = async (input: any) => {
    if (Array.isArray(input)) return Promise.all(input);
    if (typeof input === "function") return input(prismaAny);
    return input;
  };

  prismaAny.member.findMany = async ({ where, select }: { where?: any; select?: any } = {}) => {
    const kind: CapturedMemberQuery["kind"] = select?.code ? "analytics" : "compliance-group";
    captures.members.push({ where: cloneCapture(where), kind });
    return fixture.members.filter((member) => matchesMemberWhere(member, where)).map((member) => ({
      id: member.id,
      code: member.code,
      firstName: member.firstName,
      lastName: member.lastName,
      phone: member.phone,
      memberType: member.memberType,
      isStaff: member.isStaff,
      staffGroupId: member.staffGroupId,
      staffGroup: member.staffGroupName ? { name: member.staffGroupName } : null,
    }));
  };

  prismaAny.memberShift.findMany = async ({ where }: { where?: any } = {}) => {
    captures.shifts.push(cloneCapture(where));
    return fixture.shifts.filter((shift) => matchesShiftWhere(shift, where)).map((shift) => ({ ...shift }));
  };

  prismaAny.attendanceLog.findMany = async (
    { where, include, orderBy, skip = 0, take }: { where?: any; include?: any; orderBy?: any; skip?: number; take?: number } = {}
  ) => {
    captures.logs.push({
      where: cloneCapture(where),
      kind: include?.member ? "evidence" : "analytics",
    });
    const ordered = sortLogs(fixture.logs.filter((log) => matchesLogWhere(log, where)), orderBy);
    const rows = typeof take === "number" ? ordered.slice(skip, skip + take) : ordered.slice(skip);
    return rows.map((log) => toAttendanceLogRow(log));
  };

  prismaAny.attendanceLog.count = async ({ where }: { where?: any } = {}) => {
    captures.logCounts.push(cloneCapture(where));
    return fixture.logs.filter((log) => matchesLogWhere(log, where)).length;
  };

  prismaAny.attendanceJustification.findMany = async ({ where }: { where?: any } = {}) => {
    captures.justifications.push(cloneCapture(where));
    return fixture.justifications
      .filter((row) => matchesJustificationWhere(row, where))
      .map((row) => ({ memberId: row.memberId, date: row.date }));
  };

  prismaAny.device.findMany = async ({ where }: { where?: any } = {}) => {
    const ids = (where?.id?.in as string[] | undefined) ?? [];
    return fixture.devices.filter((device) => ids.includes(device.id));
  };

  prismaAny.auditLog.create = async ({ data }: { data: any }) => {
    captures.audits.push(data);
    return { id: `audit-${captures.audits.length}`, ...data };
  };
}

function restorePrismaMocks() {
  prismaAny.$transaction = originalPrisma.transaction;
  prismaAny.member.findMany = originalPrisma.memberFindMany;
  prismaAny.memberShift.findMany = originalPrisma.memberShiftFindMany;
  prismaAny.attendanceLog.findMany = originalPrisma.attendanceLogFindMany;
  prismaAny.attendanceLog.count = originalPrisma.attendanceLogCount;
  prismaAny.attendanceJustification.findMany = originalPrisma.attendanceJustificationFindMany;
  prismaAny.device.findMany = originalPrisma.deviceFindMany;
  prismaAny.auditLog.create = originalPrisma.auditLogCreate;
}

async function run() {
  installPrismaMocks();
  try {
    await testScopeSeparatedCacheAndFullLegacyBehavior();
    await testStrictReclassificationIsNeverServedFromCache();
    await testStrictReadBoundary();
    await testStrictExportsAndAuditMetadata();
    await testStrictComplianceBoundary();
    assertStrictRelationPredicatesWereUsed();
    console.log("ok - attendance reports enforce strict Staff scope across JSON, exports, audits, compliance, and cache");
  } finally {
    restorePrismaMocks();
  }
}

async function testStrictReclassificationIsNeverServedFromCache() {
  const member = fixture.members.find((item) => item.id === CANONICAL_STAFF_ID);
  assert.ok(member);
  const originalMarkers = { memberType: member.memberType, isStaff: member.isStaff };
  const queriesBefore = analyticsMemberQueryCount();
  try {
    const before = await getAttendanceReportMembers(memberQuery("both"), STRICT);
    assertCanonicalMemberItems(before.items, "STRICT pre-reclassification result");

    member.memberType = MemberType.CUSTOMER;
    member.isStaff = false;
    const after = await getAttendanceReportMembers(memberQuery("both"), STRICT);
    assert.deepEqual(after.items, [], "a reclassified Customer must not survive through a strict analytics cache");
    assert.equal(
      analyticsMemberQueryCount(),
      queriesBefore + 2,
      "STRICT analytics must revalidate Staff markers on every request"
    );
  } finally {
    member.memberType = originalMarkers.memberType;
    member.isStaff = originalMarkers.isStaff;
  }
}

async function testScopeSeparatedCacheAndFullLegacyBehavior() {
  const memberQueriesBefore = analyticsMemberQueryCount();
  const fullBoth = await getAttendanceReportMembers(memberQuery("both"), FULL);
  const memberQueriesAfterFull = analyticsMemberQueryCount();
  assert.equal(memberQueriesAfterFull, memberQueriesBefore + 1, "FULL analytics must query its own member dataset");
  assert.deepEqual(
    fullBoth.items.map((item) => item.memberId).sort(),
    [CANONICAL_STAFF_ID, CUSTOMER_ID, "mismatch-customer-true", "mismatch-staff-false"].sort(),
    "FULL both must retain every non-archived legacy member classification"
  );
  assertNoToken(fullBoth, "FULL both archived exclusion", ["Archived Staff", "LEAK-ARCHIVED"]);

  const strictSameQuery = await getAttendanceReportMembers(memberQuery("both"), STRICT);
  const memberQueriesAfterStrict = analyticsMemberQueryCount();
  assert.equal(
    memberQueriesAfterStrict,
    memberQueriesAfterFull + 1,
    "STRICT must not reuse the FULL cache entry for the same report query"
  );
  assertCanonicalMemberItems(strictSameQuery.items, "STRICT same-query cache isolation");

  const fullCustomer = await getAttendanceReportMembers(memberQuery("customer"), FULL);
  assert.deepEqual(fullCustomer.items.map((item) => item.memberId), [CUSTOMER_ID]);
  assert.equal(fullCustomer.items[0]?.memberType, "CUSTOMER");

  const fullCustomerEvidence = await getAttendanceReportEvidence(evidenceQuery("customer"), FULL);
  assert.equal(fullCustomerEvidence.items.length, 2);
  assert.equal(fullCustomerEvidence.items.every((item) => item.memberId === CUSTOMER_ID), true);
  assert.equal(fullCustomerEvidence.items.every((item) => item.memberType === "CUSTOMER"), true);
}

async function testStrictReadBoundary() {
  for (const requestedType of ["staff", "customer", "both"] as const) {
    const members = await getAttendanceReportMembers(memberQuery(requestedType), STRICT);
    assertCanonicalMemberItems(members.items, `STRICT requested memberType=${requestedType}`);
  }

  const summary = await getAttendanceReportSummary(summaryQuery("customer"), STRICT);
  assert.deepEqual(summary.kpis, {
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
  });

  const daily = await getAttendanceReportDaily({ ...summaryQuery("both"), page: 1, pageSize: 25 } as any, STRICT);
  assert.equal(daily.items.length, 1);
  assert.equal(daily.items[0]?.presentCount, 1);
  assert.equal(daily.items[0]?.absentCount, 0);
  assert.equal(daily.items[0]?.unscheduledPresentCount, 0);

  const evidence = await getAttendanceReportEvidence(evidenceQuery("customer"), STRICT);
  assert.equal(evidence.items.length, 2);
  assert.equal(evidence.pageInfo.totalItems, 2);
  assert.equal(evidence.items.every((item) => item.memberId === CANONICAL_STAFF_ID), true);
  assert.equal(evidence.items.every((item) => item.memberType === "STAFF"), true);
  assertNoLeak(evidence, "STRICT evidence JSON");

  const customerIdSummary = await getAttendanceReportSummary(
    { ...summaryQuery("both"), memberId: CUSTOMER_ID } as any,
    STRICT
  );
  assert.equal(Object.values(customerIdSummary.kpis).every((value) => value === 0), true);
  const customerIdMembers = await getAttendanceReportMembers(
    { ...memberQuery("both"), memberId: CUSTOMER_ID } as any,
    STRICT
  );
  assert.deepEqual(customerIdMembers.items, []);

  const customerSearch = await getAttendanceReportMembers(
    { ...memberQuery("customer"), search: "Customer Leak" } as any,
    STRICT
  );
  assert.deepEqual(customerSearch.items, []);
  assert.equal(customerSearch.pageInfo.totalItems, 0);
}

async function testStrictExportsAndAuditMetadata() {
  for (const variant of ["daily", "members", "evidence"] as const) {
    const file = await getAttendanceReportCsvExport(csvQuery(variant, "customer"), STRICT);
    const csv = file.buffer.toString("utf8");
    assertNoLeak(csv, `STRICT ${variant} CSV`);
    if (variant !== "daily") assert.match(csv, /Canonical Staff/u);
  }

  const xlsx = await getAttendanceReportXlsxExport(exportQuery("customer"), STRICT);
  const xlsxText = readAllZipText(xlsx.buffer);
  assert.match(xlsxText, /Canonical Staff/u);
  assertNoLeak(xlsxText, "STRICT XLSX");

  const pdf = await getAttendanceReportPdfExport(exportQuery("customer"), STRICT);
  const pdfText = await extractPdfText(pdf.buffer);
  assert.match(pdfText, /Canonical Staff/u);
  assertNoLeak(pdfText, "STRICT PDF");

  const auditCountBefore = captures.audits.length;
  await getAuditedAttendanceReportExport(
    csvQuery("members", "customer"),
    "CSV",
    {
      actor: { id: "report-admin", role: AdminRole.GYM_OWNER, sessionId: "report-session" },
      meta: { ipAddress: "127.0.0.1", userAgent: "staff-boundary-test" },
    },
    STRICT
  );
  const serverAudit = captures.audits[auditCountBefore];
  assert.ok(serverAudit);
  assert.equal(serverAudit.metadata.filters.memberType, "staff");
  assert.equal(serverAudit.metadata.outcome, "EXPORTED");

  await recordAttendanceClientCsvExport(
    {
      variant: "entry-logs",
      rowCount: 2,
      lang: "en",
      filters: { from: REPORT_DATE, to: REPORT_DATE, memberType: "customer" },
    },
    {
      actor: { id: "report-admin", role: AdminRole.GYM_OWNER, sessionId: "report-session" },
      meta: {},
    },
    STRICT
  );
  const clientAudit = captures.audits.at(-1);
  assert.ok(clientAudit);
  assert.equal(clientAudit.metadata.filters.memberType, "staff");
  assertNoLeak(captures.audits, "STRICT export audit metadata");
}

async function testStrictComplianceBoundary() {
  const memberReport = await getAttendanceComplianceReport(complianceQuery("member"), STRICT);
  assert.equal(memberReport.filters.memberType, "staff");
  assert.equal(memberReport.kpis.evaluatedCount, 1);
  assert.equal(memberReport.items.length, 1);
  assert.equal(memberReport.items[0]?.id, CANONICAL_STAFF_ID);
  assert.equal(memberReport.items[0]?.memberType, "STAFF");
  assertNoLeak(memberReport, "STRICT compliance member report");

  const groupReport = await getAttendanceComplianceReport(complianceQuery("group"), STRICT);
  assert.equal(groupReport.filters.memberType, "staff");
  assert.equal(groupReport.items.length, 1);
  assert.equal(groupReport.items[0]?.name, "Operations");
  assert.equal(groupReport.items[0]?.memberType, "STAFF");
  assert.equal(groupReport.items[0]?.memberCount, 1);
  assertNoLeak(groupReport, "STRICT compliance group report");

  const csv = await getAttendanceComplianceCsv({ ...complianceQuery("member"), lang: "en" } as any, STRICT);
  assert.match(csv.csv, /Canonical Staff/u);
  assertNoLeak(csv.csv, "STRICT compliance CSV");

  const xlsx = await getAttendanceComplianceXlsx({ ...complianceQuery("group"), lang: "en" } as any, STRICT);
  const xlsxText = readAllZipText(xlsx.buffer);
  assert.match(xlsxText, /Operations/u);
  assertNoLeak(xlsxText, "STRICT compliance XLSX");
}

function assertStrictRelationPredicatesWereUsed() {
  const strictMemberQueries = captures.members.filter(
    (item) => item.kind === "analytics" && hasStrictStaffPredicate(item.where)
  );
  assert.ok(strictMemberQueries.length > 0, "member query must capture strict STAFF+isStaff predicate");

  const strictSearch = captures.members.find(
    (item) => item.kind === "analytics" && Array.isArray(item.where?.AND) && hasStrictStaffPredicate(item.where)
  );
  assert.ok(strictSearch, "member search must retain strict identity inside its AND predicate");

  assert.ok(captures.shifts.some((where) => hasStrictStaffPredicate(where?.member)), "shift query must scope its member relation");
  assert.ok(
    captures.logs.some((item) => item.kind === "analytics" && hasStrictStaffPredicate(item.where?.member)),
    "analytics log query must scope its member relation"
  );
  assert.ok(
    captures.logs.some((item) => item.kind === "evidence" && hasStrictStaffPredicate(item.where?.member)),
    "evidence findMany must scope its member relation"
  );
  assert.ok(
    captures.logCounts.some((where) => hasStrictStaffPredicate(where?.member)),
    "evidence count must scope its member relation"
  );
  assert.ok(
    captures.justifications.some((where) => hasStrictStaffPredicate(where?.member)),
    "justification query must scope its member relation"
  );
  assert.ok(
    captures.members.some((item) => item.kind === "compliance-group" && hasStrictStaffPredicate(item.where)),
    "compliance group lookup must remain strict Staff scoped"
  );
}

function summaryQuery(memberType: "staff" | "customer" | "both") {
  return {
    from: REPORT_DATE,
    to: REPORT_DATE,
    memberType,
    shiftMode: "primary",
    eventType: "all",
    onlyAnomalies: false,
  } as any;
}

function memberQuery(memberType: "staff" | "customer" | "both") {
  return {
    ...summaryQuery(memberType),
    page: 1,
    pageSize: 25,
    sortBy: "memberName",
    sortDir: "asc",
  } as any;
}

function evidenceQuery(memberType: "staff" | "customer" | "both") {
  return {
    ...summaryQuery(memberType),
    page: 1,
    pageSize: 25,
    sortDir: "asc",
  } as any;
}

function exportQuery(memberType: "staff" | "customer" | "both") {
  return {
    ...summaryQuery(memberType),
    includeEvidence: true,
    lang: "en",
  } as any;
}

function csvQuery(variant: "daily" | "members" | "evidence", memberType: "staff" | "customer" | "both") {
  return {
    ...summaryQuery(memberType),
    variant,
    sortBy: "memberName",
    sortDir: "asc",
    lang: "en",
  } as any;
}

function complianceQuery(viewBy: "member" | "group") {
  return {
    ...summaryQuery("customer"),
    viewBy,
    sortBy: "score",
    sortDir: "asc",
    lateMinutesWeight: 0.05,
    lateCountWeight: 1,
    absentWeight: 8,
    noCheckoutWeight: 4,
    deniedWeight: 6,
    page: 1,
    pageSize: 25,
  } as any;
}

function assertCanonicalMemberItems(items: Array<{ memberId: string; memberName: string; memberType: string }>, label: string) {
  assert.equal(items.length, 1, `${label} must return exactly one canonical Staff member`);
  assert.equal(items[0]?.memberId, CANONICAL_STAFF_ID);
  assert.equal(items[0]?.memberName, "Canonical Staff");
  assert.equal(items[0]?.memberType, "STAFF");
  assertNoLeak(items, label);
}

function assertNoLeak(value: unknown, label: string) {
  assertNoToken(value, label, forbiddenTokens);
}

function assertNoToken(value: unknown, label: string, tokens: readonly string[]) {
  const text = typeof value === "string" ? value : JSON.stringify(value);
  for (const token of tokens) {
    assert.equal(text.includes(token), false, `${label} leaked ${token}`);
  }
}

function analyticsMemberQueryCount() {
  return captures.members.filter((item) => item.kind === "analytics").length;
}

function hasStrictStaffPredicate(where: any): boolean {
  if (!where || typeof where !== "object") return false;
  const candidate = where.is && typeof where.is === "object" ? where.is : where;
  if (candidate.memberType === MemberType.STAFF && candidate.isStaff === true) return true;
  const nested = [candidate.AND, candidate.OR]
    .flatMap((value) => (Array.isArray(value) ? value : value ? [value] : []));
  return nested.some((part) => hasStrictStaffPredicate(part));
}

function matchesMemberWhere(member: FixtureMember, where: any): boolean {
  if (!where) return true;
  const candidate = where.is && typeof where.is === "object" ? where.is : where;
  if (Array.isArray(candidate.AND) && !candidate.AND.every((part: any) => matchesMemberWhere(member, part))) return false;
  if (candidate.AND && !Array.isArray(candidate.AND) && !matchesMemberWhere(member, candidate.AND)) return false;
  if (Array.isArray(candidate.OR) && candidate.OR.length > 0 && !candidate.OR.some((part: any) => matchesMemberWhere(member, part))) return false;
  if (typeof candidate.id === "string" && member.id !== candidate.id) return false;
  if (Array.isArray(candidate.id?.in) && !candidate.id.in.includes(member.id)) return false;
  if (candidate.archivedAt === null && member.archivedAt !== null) return false;
  if (typeof candidate.memberType === "string" && member.memberType !== candidate.memberType) return false;
  if (typeof candidate.isStaff === "boolean" && member.isStaff !== candidate.isStaff) return false;
  if (typeof candidate.staffGroupId === "string" && member.staffGroupId !== candidate.staffGroupId) return false;
  if (candidate.code?.contains && !contains(member.code, candidate.code.contains)) return false;
  if (candidate.firstName?.contains && !contains(member.firstName, candidate.firstName.contains)) return false;
  if (candidate.lastName?.contains && !contains(member.lastName, candidate.lastName.contains)) return false;
  if (candidate.phone?.contains && !contains(member.phone, candidate.phone.contains)) return false;
  return true;
}

function matchesShiftWhere(shift: FixtureShift, where: any): boolean {
  if (!where) return true;
  if (where.memberId?.in && !where.memberId.in.includes(shift.memberId)) return false;
  if (where.isActive === true && !shift.isActive) return false;
  if (where.shiftId && shift.shiftId !== where.shiftId) return false;
  if (where.member) {
    const member = fixture.members.find((item) => item.id === shift.memberId);
    if (!member || !matchesMemberWhere(member, where.member)) return false;
  }
  return true;
}

function matchesLogWhere(log: FixtureLog, where: any): boolean {
  if (!where) return true;
  if (where.memberId?.in && !where.memberId.in.includes(log.memberId)) return false;
  if (where.member) {
    const member = fixture.members.find((item) => item.id === log.memberId);
    if (!member || !matchesMemberWhere(member, where.member)) return false;
  }
  const gte = where.recordedAt?.gte as Date | undefined;
  const lt = where.recordedAt?.lt as Date | undefined;
  if (gte && log.recordedAt < gte) return false;
  if (lt && log.recordedAt >= lt) return false;
  if (typeof where.isAuthorized === "boolean" && log.isAuthorized !== where.isAuthorized) return false;
  if (where.entryType && log.entryType !== where.entryType) return false;
  if (where.id?.in && !where.id.in.includes(log.id)) return false;
  if (where.deviceUser?.deviceId && log.deviceId !== where.deviceUser.deviceId) return false;
  return true;
}

function matchesJustificationWhere(row: FixtureJustification, where: any): boolean {
  if (!where) return true;
  if (where.memberId?.in && !where.memberId.in.includes(row.memberId)) return false;
  if (where.member) {
    const member = fixture.members.find((item) => item.id === row.memberId);
    if (!member || !matchesMemberWhere(member, where.member)) return false;
  }
  const gte = where.date?.gte as Date | undefined;
  const lt = where.date?.lt as Date | undefined;
  if (gte && row.date < gte) return false;
  if (lt && row.date >= lt) return false;
  return true;
}

function toAttendanceLogRow(log: FixtureLog) {
  const member = fixture.members.find((item) => item.id === log.memberId) ?? null;
  return {
    id: log.id,
    memberId: log.memberId,
    deviceUserId: log.deviceId ? `device-user-${log.deviceId}` : null,
    rawLogId: null,
    entryType: log.entryType,
    recordedAt: log.recordedAt,
    source: log.source,
    isAuthorized: log.isAuthorized,
    reason: log.reason,
    dedupeKey: null,
    createdAt: log.recordedAt,
    member: member
      ? {
          id: member.id,
          firstName: member.firstName,
          lastName: member.lastName,
          memberType: member.memberType,
          isStaff: member.isStaff,
        }
      : null,
    deviceUser: log.deviceId ? { deviceId: log.deviceId } : null,
  };
}

function sortLogs(logs: FixtureLog[], orderBy: any) {
  const direction = Array.isArray(orderBy) ? orderBy[0]?.recordedAt : orderBy?.recordedAt;
  if (!direction) return [...logs];
  const factor = direction === "asc" ? 1 : -1;
  return [...logs].sort((left, right) => factor * (left.recordedAt.getTime() - right.recordedAt.getTime()));
}

function contains(source: string, search: string) {
  return source.toLowerCase().includes(String(search).toLowerCase());
}

function cloneCapture<T>(value: T): T {
  if (value === undefined) return value;
  return structuredClone(value);
}

function readAllZipText(buffer: Buffer) {
  const parts: string[] = [];
  let offset = 0;
  while (offset + 30 <= buffer.length) {
    if (buffer.readUInt32LE(offset) !== 0x04034b50) {
      offset += 1;
      continue;
    }
    const method = buffer.readUInt16LE(offset + 8);
    const compressedSize = buffer.readUInt32LE(offset + 18);
    const fileNameLength = buffer.readUInt16LE(offset + 26);
    const extraLength = buffer.readUInt16LE(offset + 28);
    const nameStart = offset + 30;
    const dataStart = nameStart + fileNameLength + extraLength;
    const dataEnd = dataStart + compressedSize;
    const compressed = buffer.subarray(dataStart, dataEnd);
    const data = method === 8 ? inflateRawSync(compressed) : compressed;
    parts.push(data.toString("utf8"));
    offset = dataEnd;
  }
  return parts.join("\n");
}

function buildFixture(): Fixture {
  const members: FixtureMember[] = [
    {
      id: CANONICAL_STAFF_ID,
      code: "SAFE-STAFF",
      firstName: "Canonical",
      lastName: "Staff",
      phone: "0700000001",
      memberType: MemberType.STAFF,
      isStaff: true,
      archivedAt: null,
      staffGroupId: "operations-group",
      staffGroupName: "Operations",
    },
    {
      id: CUSTOMER_ID,
      code: "LEAK-CUSTOMER",
      firstName: "Customer",
      lastName: "Leak",
      phone: "0700000002",
      memberType: MemberType.CUSTOMER,
      isStaff: false,
      archivedAt: null,
      staffGroupId: null,
      staffGroupName: null,
    },
    {
      id: "mismatch-staff-false",
      code: "LEAK-STAFF-FALSE",
      firstName: "Mismatch",
      lastName: "StaffFalse",
      phone: "0700000003",
      memberType: MemberType.STAFF,
      isStaff: false,
      archivedAt: null,
      staffGroupId: "mismatch-group",
      staffGroupName: "Mismatch Group",
    },
    {
      id: "mismatch-customer-true",
      code: "LEAK-CUSTOMER-TRUE",
      firstName: "Mismatch",
      lastName: "CustomerTrue",
      phone: "0700000004",
      memberType: MemberType.CUSTOMER,
      isStaff: true,
      archivedAt: null,
      staffGroupId: "mismatch-group",
      staffGroupName: "Mismatch Group",
    },
    {
      id: "archived-staff",
      code: "LEAK-ARCHIVED",
      firstName: "Archived",
      lastName: "Staff",
      phone: "0700000005",
      memberType: MemberType.STAFF,
      isStaff: true,
      archivedAt: new Date(2026, 7, 31, 12, 0),
      staffGroupId: "operations-group",
      staffGroupName: "Operations",
    },
  ];

  const shiftMemberIds = [CANONICAL_STAFF_ID, "mismatch-staff-false", "mismatch-customer-true", "archived-staff"];
  const shifts = shiftMemberIds.map((memberId, index): FixtureShift => ({
    id: `shift-${index + 1}`,
    memberId,
    shiftId: "day-shift-template",
    shiftName: "Day",
    shiftStart: "09:00",
    shiftEnd: "17:00",
    weekdays: [0, 1, 2, 3, 4, 5, 6],
    graceMinutes: 0,
    isActive: true,
  }));

  const logs: FixtureLog[] = members.flatMap((member, index) => [
    {
      id: `log-${index + 1}-in`,
      memberId: member.id,
      entryType: AttendanceType.IN,
      recordedAt: new Date(2026, 8, 1, index === 1 ? 10 : 9, 0),
      source: AttendanceSource.DEVICE,
      isAuthorized: true,
      reason: null,
      deviceId: "gate-device",
    },
    {
      id: `log-${index + 1}-out`,
      memberId: member.id,
      entryType: AttendanceType.OUT,
      recordedAt: new Date(2026, 8, 1, index === 1 ? 11 : 17, 0),
      source: AttendanceSource.DEVICE,
      isAuthorized: true,
      reason: null,
      deviceId: "gate-device",
    },
  ]);

  return {
    members,
    shifts,
    logs,
    justifications: [
      { id: "staff-justification", memberId: CANONICAL_STAFF_ID, date: new Date(2026, 8, 1) },
      { id: "customer-justification", memberId: CUSTOMER_ID, date: new Date(2026, 8, 1) },
    ],
    devices: [{ id: "gate-device", name: "Safe Gate" }],
  };
}

void run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
