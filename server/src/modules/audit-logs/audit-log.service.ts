import { AdminRole, AuditActor, Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { HttpError } from "../../middlewares/error-handler";
import type { AppEdition } from "../../config/env";
import type { AuditLogListQuery } from "./audit-log.schemas";
import { getAuditLogVisibilityWhere } from "./audit-log-edition-policy";

const actorSelect = {
  id: true,
  username: true,
  fullName: true,
  role: true,
  isActive: true,
} satisfies Prisma.AdminUserSelect;

const auditListSelect = {
  id: true,
  actorType: true,
  actorId: true,
  actorRole: true,
  action: true,
  targetType: true,
  targetId: true,
  success: true,
  ipAddress: true,
  createdAt: true,
  beforeData: true,
  afterData: true,
  metadata: true,
  adminUser: { select: actorSelect },
} satisfies Prisma.AuditLogSelect;

const auditDetailSelect = {
  ...auditListSelect,
  userAgent: true,
  sessionId: true,
  requestId: true,
} satisfies Prisma.AuditLogSelect;

type AuditListRow = Prisma.AuditLogGetPayload<{ select: typeof auditListSelect }>;
type AuditDetailRow = Prisma.AuditLogGetPayload<{ select: typeof auditDetailSelect }>;

const REDACTED_VALUE = "[REDACTED]";
const SENSITIVE_KEY_TOKENS = new Set([
  "authorization", "biometric", "cookie", "credential", "fingerprint", "passcode", "passwd", "password",
  "permission", "permissions", "secret", "token",
]);
const FINANCIAL_KEY_TOKENS = new Set([
  "amount", "balance", "cost", "credit", "currency", "debt", "expense", "fee", "finance", "financial",
  "paid", "payment", "payroll", "price", "rate", "refund", "revenue", "salary",
]);

export async function listAuditLogs(query: AuditLogListQuery, edition: AppEdition = "FULL") {
  const where = buildAuditWhere(query, edition);
  const skip = (query.page - 1) * query.pageSize;

  const [rows, total, successful, failed] = await prisma.$transaction([
    prisma.auditLog.findMany({
      where,
      select: auditListSelect,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip,
      take: query.pageSize,
    }),
    prisma.auditLog.count({ where }),
    prisma.auditLog.count({ where: { AND: [where, { success: true }] } }),
    prisma.auditLog.count({ where: { AND: [where, { success: false }] } }),
  ]);

  return {
    items: rows.map(toAuditListItem),
    page: query.page,
    pageSize: query.pageSize,
    total,
    summary: { total, successful, failed },
  };
}

export async function getAuditLogOptions(edition: AppEdition = "FULL") {
  if (edition === "FULL") return getFullAuditLogOptions();

  const visibilityWhere = getAuditLogVisibilityWhere(edition);
  const [actionRows, targetRows, actors, actorTypeRows, actorRoleRows] = await Promise.all([
    prisma.auditLog.findMany({
      where: visibilityWhere,
      distinct: ["action"],
      select: { action: true },
      orderBy: { action: "asc" },
    }),
    prisma.auditLog.findMany({
      where: { AND: [visibilityWhere, { targetType: { not: null } }] },
      distinct: ["targetType"],
      select: { targetType: true },
      orderBy: { targetType: "asc" },
    }),
    prisma.adminUser.findMany({
      where: { auditLogs: { some: visibilityWhere } },
      select: actorSelect,
      orderBy: [{ fullName: "asc" }, { username: "asc" }],
    }),
    prisma.auditLog.findMany({
      where: visibilityWhere,
      distinct: ["actorType"],
      select: { actorType: true },
      orderBy: { actorType: "asc" },
    }),
    prisma.auditLog.findMany({
      where: { AND: [visibilityWhere, { actorRole: { not: null } }] },
      distinct: ["actorRole"],
      select: { actorRole: true },
      orderBy: { actorRole: "asc" },
    }),
  ]);

  return {
    actions: actionRows.map((row) => row.action),
    targetTypes: targetRows
      .map((row) => row.targetType)
      .filter((value): value is string => typeof value === "string" && value.length > 0),
    actors,
    actorTypes: actorTypeRows.map((row) => row.actorType),
    actorRoles: actorRoleRows
      .map((row) => row.actorRole)
      .filter((value): value is AdminRole => value !== null),
  };
}

async function getFullAuditLogOptions() {
  const [actionRows, targetRows, actors] = await Promise.all([
    prisma.auditLog.findMany({
      distinct: ["action"],
      select: { action: true },
      orderBy: { action: "asc" },
    }),
    prisma.auditLog.findMany({
      where: { targetType: { not: null } },
      distinct: ["targetType"],
      select: { targetType: true },
      orderBy: { targetType: "asc" },
    }),
    prisma.adminUser.findMany({
      where: { auditLogs: { some: {} } },
      select: actorSelect,
      orderBy: [{ fullName: "asc" }, { username: "asc" }],
    }),
  ]);

  return {
    actions: actionRows.map((row) => row.action),
    targetTypes: targetRows
      .map((row) => row.targetType)
      .filter((value): value is string => typeof value === "string" && value.length > 0),
    actors,
    actorTypes: Object.values(AuditActor),
    actorRoles: Object.values(AdminRole),
  };
}

export async function getAuditLogById(id: string, edition: AppEdition = "FULL") {
  const row = await prisma.auditLog.findFirst({
    where: { AND: [{ id }, getAuditLogVisibilityWhere(edition)] },
    select: auditDetailSelect,
  });
  if (!row) {
    throw new HttpError(404, "Audit log not found", { id });
  }
  return toAuditDetail(row);
}

export function buildAuditWhere(query: AuditLogListQuery, edition: AppEdition): Prisma.AuditLogWhereInput {
  const where: Prisma.AuditLogWhereInput = {};

  if (query.actorId) where.actorId = query.actorId;
  if (query.actorType) where.actorType = query.actorType;
  if (query.actorRole) where.actorRole = query.actorRole;
  if (query.action) where.action = query.action;
  if (query.targetType) where.targetType = query.targetType;
  if (typeof query.success === "boolean") where.success = query.success;

  if (query.from || query.to) {
    const from = query.from ? parseLocalDate(query.from, "from") : null;
    const to = query.to ? parseLocalDate(query.to, "to") : null;
    if (from && to && from > to) {
      throw new HttpError(400, "Invalid date range", { from: query.from, to: query.to });
    }
    where.createdAt = {};
    if (from) where.createdAt.gte = from;
    if (to) where.createdAt.lt = addDays(to, 1);
  }

  const search = query.search?.trim();
  if (search) {
    const role = findEnumValue(AdminRole, search);
    const actorType = findEnumValue(AuditActor, search);
    const or: Prisma.AuditLogWhereInput[] = [
      { action: { contains: search, mode: "insensitive" } },
      { targetType: { contains: search, mode: "insensitive" } },
      { targetId: { contains: search, mode: "insensitive" } },
      { ipAddress: { contains: search, mode: "insensitive" } },
      { userAgent: { contains: search, mode: "insensitive" } },
      {
        adminUser: {
          is: {
            OR: [
              { username: { contains: search, mode: "insensitive" } },
              { fullName: { contains: search, mode: "insensitive" } },
            ],
          },
        },
      },
    ];
    if (role) or.push({ actorRole: role });
    if (actorType) or.push({ actorType });
    where.OR = or;
  }

  return edition === "FULL" ? where : { AND: [getAuditLogVisibilityWhere(edition), where] };
}

function toAuditListItem(row: AuditListRow) {
  return {
    id: row.id,
    actorType: row.actorType,
    actorId: row.actorId,
    actorRole: row.actorRole,
    actor: row.adminUser,
    action: row.action,
    targetType: row.targetType,
    targetId: row.targetId,
    success: row.success,
    ipAddress: row.ipAddress,
    createdAt: row.createdAt,
    hasDetails: Boolean(row.beforeData || row.afterData || row.metadata),
  };
}

function toAuditDetail(row: AuditDetailRow) {
  return {
    ...toAuditListItem(row),
    userAgent: row.userAgent,
    sessionId: row.sessionId,
    requestId: row.requestId,
    beforeData: sanitizeAuditJson(row.beforeData),
    afterData: sanitizeAuditJson(row.afterData),
    metadata: sanitizeAuditJson(row.metadata),
  };
}

export function sanitizeAuditJson(value: Prisma.JsonValue | null): Prisma.JsonValue | null {
  if (value === null || typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeAuditJson(item));
  }

  return Object.fromEntries(
    Object.entries(value).map(([key, nested]) => [
      key,
      shouldRedactAuditKey(key) ? REDACTED_VALUE : sanitizeAuditJson(nested ?? null),
    ])
  );
}

function shouldRedactAuditKey(key: string): boolean {
  const normalized = key
    .replace(/([a-z0-9])([A-Z])/gu, "$1_$2")
    .replace(/[^a-zA-Z0-9]+/gu, "_")
    .toLowerCase();
  const tokens = normalized.split("_").filter(Boolean);
  if (tokens.some((token) => SENSITIVE_KEY_TOKENS.has(token) || FINANCIAL_KEY_TOKENS.has(token))) return true;
  return normalized === "private_key" || normalized === "license_key" || normalized === "fingerprint_template";
}

function parseLocalDate(value: string, field: "from" | "to") {
  const [yearRaw, monthRaw, dayRaw] = value.split("-");
  const year = Number(yearRaw);
  const month = Number(monthRaw);
  const day = Number(dayRaw);
  const date = new Date(year, month - 1, day);
  date.setHours(0, 0, 0, 0);
  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    !Number.isInteger(day) ||
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    throw new HttpError(400, `Invalid ${field} date`, { [field]: value });
  }
  return date;
}

function addDays(date: Date, days: number) {
  const value = new Date(date);
  value.setDate(value.getDate() + days);
  return value;
}

function findEnumValue<T extends Record<string, string>>(values: T, search: string): T[keyof T] | null {
  const normalized = search.trim().toUpperCase().replace(/[\s-]+/gu, "_");
  return (Object.values(values).find((value) => value === normalized) as T[keyof T] | undefined) ?? null;
}
