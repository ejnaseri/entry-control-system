import {
  InboxCategory,
  InboxEntityType,
  InboxItemType,
  InboxScope,
  InboxSeverity,
  Prisma,
} from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { HttpError } from "../../middlewares/error-handler";
import type { InboxListQuery, InboxReadAllInput, InboxReadBulkInput } from "./inbox.schemas";
import { emitInboxItem } from "./inbox.events";

export type InboxListResult = {
  items: Prisma.InboxItemGetPayload<{}>[];
  total: number;
  page: number;
  pageSize: number;
};

export type CreateInboxItemInput = {
  scope: InboxScope;
  category: InboxCategory;
  type: InboxItemType;
  severity: InboxSeverity;
  title: string;
  body?: string | null;
  createdAt?: Date;
  entityType?: InboxEntityType | null;
  entityId?: string | null;
  actionPath?: string | null;
  dedupeKey?: string | null;
  deviceId?: string | null;
  memberId?: string | null;
};

export async function listInboxItems(query: InboxListQuery, scope: InboxScope): Promise<InboxListResult> {
  const where = buildInboxWhere(query, scope);
  const skip = (query.page - 1) * query.pageSize;
  const take = query.pageSize;

  const [items, total] = await Promise.all([
    prisma.inboxItem.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take,
    }),
    prisma.inboxItem.count({ where }),
  ]);

  return {
    items,
    total,
    page: query.page,
    pageSize: query.pageSize,
  };
}

export async function markInboxItemRead(id: string, scope: InboxScope) {
  try {
    return await prisma.inboxItem.update({
      where: { id, scope },
      data: { readAt: new Date() },
    });
  } catch (error) {
    if (isRecordNotFound(error)) {
      throw new HttpError(404, "Inbox item not found", { id });
    }
    throw error;
  }
}

export async function markInboxItemsRead(input: InboxReadAllInput, scope: InboxScope) {
  const where: Prisma.InboxItemWhereInput = {
    scope,
    readAt: null,
  };

  if (input.category) where.category = input.category;
  if (input.severity) where.severity = input.severity;
  if (input.type) where.type = input.type;
  if (input.deviceId) where.deviceId = input.deviceId;
  if (input.memberId) where.memberId = input.memberId;

  const result = await prisma.inboxItem.updateMany({
    where,
    data: { readAt: new Date() },
  });

  return { updated: result.count };
}

export async function markInboxItemsReadBulk(input: InboxReadBulkInput, scope: InboxScope) {
  const result = await prisma.inboxItem.updateMany({
    where: {
      scope,
      id: { in: input.ids },
      readAt: null,
    },
    data: { readAt: new Date() },
  });

  return { updatedCount: result.count };
}

export async function getUnreadCounts(scope: InboxScope) {
  const [alerts, deviceFeed] = await Promise.all([
    prisma.inboxItem.count({ where: { scope, category: InboxCategory.ALERT, readAt: null } }),
    prisma.inboxItem.count({ where: { scope, category: InboxCategory.DEVICE_FEED, readAt: null } }),
  ]);

  return {
    alerts,
    deviceFeed,
    total: alerts + deviceFeed,
  };
}

export async function createInboxItem(input: CreateInboxItemInput) {
  const scope = input.scope;
  const dedupeKey = input.dedupeKey ?? undefined;
  const data: Prisma.InboxItemCreateInput = {
    scope,
    category: input.category,
    type: input.type,
    severity: input.severity,
    title: input.title,
    body: input.body ?? null,
    ...(input.createdAt ? { createdAt: input.createdAt } : {}),
    entityType: input.entityType ?? null,
    entityId: input.entityId ?? null,
    actionPath: input.actionPath ?? null,
    dedupeKey: dedupeKey ?? null,
    ...(input.deviceId ? { device: { connect: { id: input.deviceId } } } : {}),
    ...(input.memberId ? { member: { connect: { id: input.memberId } } } : {}),
  };

  if (dedupeKey) {
    const existing = await prisma.inboxItem.findUnique({
      where: { scope_dedupeKey: { scope, dedupeKey } },
    });
    if (existing) return existing;
    const created = await prisma.inboxItem.create({ data });
    emitInboxItem(created);
    return created;
  }

  const created = await prisma.inboxItem.create({ data });
  emitInboxItem(created);
  return created;
}

export function buildActionPath(entityType?: InboxEntityType | null, entityId?: string | null) {
  if (!entityType || !entityId) return null;
  if (entityType === InboxEntityType.MEMBER) return `/members/${entityId}`;
  if (entityType === InboxEntityType.MEMBERSHIP) return `/members/${entityId}`;
  if (entityType === InboxEntityType.SHIFT) return `/members/${entityId}`;
  if (entityType === InboxEntityType.DEVICE) return "/devices";
  return null;
}

export function buildDedupeKey({
  type,
  entityType,
  entityId,
  window,
}: {
  type: InboxItemType;
  entityType?: InboxEntityType | null;
  entityId?: string | null;
  window?: string | null;
}) {
  const parts = [type, entityType ?? "NONE", entityId ?? "NONE"];
  if (window) parts.push(window);
  return parts.join(":");
}

export function formatDayKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

export function formatWindowKey(date: Date, minutes: number) {
  const safeMinutes = Math.max(1, minutes);
  const ms = date.getTime();
  const bucket = Math.floor(ms / (safeMinutes * 60000)) * safeMinutes;
  const bucketDate = new Date(bucket * 60000);
  return bucketDate.toISOString();
}

function buildInboxWhere(query: InboxListQuery, scope: InboxScope): Prisma.InboxItemWhereInput {
  const where: Prisma.InboxItemWhereInput = { scope };

  if (query.category) where.category = query.category;
  if (query.severity) where.severity = query.severity;
  if (query.type) where.type = query.type;
  if (query.deviceId) where.deviceId = query.deviceId;
  if (query.memberId) where.memberId = query.memberId;

  if (query.unreadOnly) {
    where.readAt = null;
  }

  if (query.from || query.to) {
    const createdAt: Prisma.DateTimeFilter = {};
    if (query.from) createdAt.gte = parseDate(query.from, "from");
    if (query.to) createdAt.lte = parseDate(query.to, "to");
    where.createdAt = createdAt;
  }

  if (query.search) {
    where.OR = [
      { title: { contains: query.search, mode: "insensitive" } },
      { body: { contains: query.search, mode: "insensitive" } },
    ];
  }

  return where;
}

function parseDate(value: string, field: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new HttpError(400, `Invalid ${field} date`, { value });
  }
  return parsed;
}

function isRecordNotFound(error: unknown) {
  return Boolean((error as { code?: string })?.code === "P2025");
}


