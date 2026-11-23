import {
  AccessViolationReason,
  AttendanceType,
  InboxCategory,
  InboxEntityType,
  InboxItemType,
  InboxScope,
  InboxSeverity,
} from "@prisma/client";
import type { DeviceEvent } from "../../shared/devices.types";
import { prisma } from "../../lib/prisma";
import { buildActionPath, buildDedupeKey, createInboxItem, formatWindowKey } from "./inbox.service";

const FAILED_ATTEMPT_WINDOW_MINUTES = Number(process.env["INBOX_FAILED_ATTEMPT_WINDOW_MINUTES"] ?? 2);
const FAILED_ATTEMPT_THRESHOLD = Number(process.env["INBOX_FAILED_ATTEMPT_THRESHOLD"] ?? 3);

export type DeviceInboxInput = {
  event: DeviceEvent;
  authorized: boolean;
  reason?: AccessViolationReason | null;
  memberId?: string | null;
  memberName?: string | null;
  memberCode?: string | null;
  deviceId?: string | null;
  deviceName?: string | null;
  entryType?: AttendanceType | null;
  doorOpened?: boolean;
  deviceUserId?: string | null;
};

export async function recordDeviceInboxItems(input: DeviceInboxInput) {
  const timestamp = input.event.timestamp ?? new Date();
  const memberLabel = buildMemberLabel(input);
  const deviceLabel = input.deviceName ?? (input.deviceId ? `Device ${input.deviceId}` : "Device");
  const entryLabel = input.entryType ? input.entryType.toString() : input.event.eventType;
  const entityType = input.memberId ? InboxEntityType.MEMBER : input.deviceId ? InboxEntityType.DEVICE : null;
  const entityId = input.memberId ?? input.deviceId ?? null;
  const actionPath = buildActionPath(entityType, entityId);

  const feedTitle = input.authorized ? `Access granted: ${memberLabel}` : `Access denied: ${memberLabel}`;
  const feedBody = buildFeedBody({
    deviceLabel,
    entryLabel,
    authorized: input.authorized,
    ...(input.reason !== undefined ? { reason: input.reason } : {}),
    ...(input.doorOpened !== undefined ? { doorOpened: input.doorOpened } : {}),
  });

  await createInboxItem({
    scope: InboxScope.FULL,
    category: InboxCategory.DEVICE_FEED,
    type: input.authorized ? InboxItemType.DEVICE_AUTHORIZED : InboxItemType.DEVICE_DENIED,
    severity: input.authorized ? InboxSeverity.INFO : InboxSeverity.WARNING,
    title: feedTitle,
    body: feedBody,
    createdAt: timestamp,
    entityType,
    entityId,
    actionPath,
    deviceId: input.deviceId ?? null,
    memberId: input.memberId ?? null,
  });

  if (input.authorized) {
    return;
  }

  const failureCount = await getRecentFailureCount(input, timestamp);
  if (failureCount >= FAILED_ATTEMPT_THRESHOLD) {
    const windowKey = formatWindowKey(timestamp, FAILED_ATTEMPT_WINDOW_MINUTES);
    const dedupeKey = buildDedupeKey({
      type: InboxItemType.MULTIPLE_FAILED_ATTEMPTS,
      entityType,
      entityId,
      window: windowKey,
    });

    await createInboxItem({
      scope: InboxScope.FULL,
      category: InboxCategory.ALERT,
      type: InboxItemType.MULTIPLE_FAILED_ATTEMPTS,
      severity: InboxSeverity.WARNING,
      title: `Multiple failed attempts: ${memberLabel}`,
      body: `Detected ${failureCount} denied attempts in the last ${FAILED_ATTEMPT_WINDOW_MINUTES} minutes on ${deviceLabel}.`,
      createdAt: timestamp,
      entityType,
      entityId,
      actionPath,
      dedupeKey,
      deviceId: input.deviceId ?? null,
      memberId: input.memberId ?? null,
    });
    return;
  }

  const deniedAlert = buildDeniedAlert(input, memberLabel, deviceLabel, timestamp, entityType, entityId, actionPath);
  if (!deniedAlert) return;
  await createInboxItem(deniedAlert);
}

function buildMemberLabel(input: DeviceInboxInput) {
  if (input.memberName && input.memberName.trim().length > 0) {
    return input.memberName.trim();
  }
  if (input.memberCode && input.memberCode.trim().length > 0) {
    return `User #${input.memberCode.trim()}`;
  }
  if (input.event.externalUserId) {
    return `Device user ${input.event.externalUserId}`;
  }
  return "Unknown user";
}

function buildFeedBody({
  deviceLabel,
  entryLabel,
  authorized,
  reason,
  doorOpened,
}: {
  deviceLabel: string;
  entryLabel: string;
  authorized: boolean;
  reason?: AccessViolationReason | null;
  doorOpened?: boolean;
}) {
  const parts = [`Device: ${deviceLabel}`, `Event: ${entryLabel}`];
  if (authorized && doorOpened) {
    parts.push("Door opened");
  }
  if (!authorized && reason) {
    parts.push(`Reason: ${formatReason(reason)}`);
  }
  return parts.join(" · ");
}

async function getRecentFailureCount(input: DeviceInboxInput, now: Date) {
  if (!input.memberId && !input.deviceUserId) return 0;
  const windowStart = new Date(now.getTime() - FAILED_ATTEMPT_WINDOW_MINUTES * 60000);
  const where: { occurredAt: { gte: Date }; memberId?: string; deviceUserId?: string } = {
    occurredAt: { gte: windowStart },
  };
  if (input.memberId) {
    where.memberId = input.memberId;
  } else if (input.deviceUserId) {
    where.deviceUserId = input.deviceUserId;
  }
  return prisma.accessViolation.count({ where });
}

function buildDeniedAlert(
  input: DeviceInboxInput,
  memberLabel: string,
  deviceLabel: string,
  timestamp: Date,
  entityType: InboxEntityType | null,
  entityId: string | null,
  actionPath: string | null
) {
  const reason = input.reason ?? AccessViolationReason.UNKNOWN;
  const mapping = mapDeniedReason(reason);
  const windowKey = formatWindowKey(timestamp, FAILED_ATTEMPT_WINDOW_MINUTES);
  const dedupeKey = buildDedupeKey({
    type: mapping.type,
    entityType,
    entityId,
    window: windowKey,
  });

  const body = `Reason: ${formatReason(reason)} · ${deviceLabel}`;

  return {
    scope: InboxScope.FULL,
    category: InboxCategory.ALERT,
    type: mapping.type,
    severity: mapping.severity,
    title: `${mapping.title}: ${memberLabel}`,
    body,
    createdAt: timestamp,
    entityType,
    entityId,
    actionPath,
    dedupeKey,
    deviceId: input.deviceId ?? null,
    memberId: input.memberId ?? null,
  };
}

function mapDeniedReason(reason: AccessViolationReason) {
  switch (reason) {
    case AccessViolationReason.TIME_NOT_ALLOWED:
    case AccessViolationReason.DAY_NOT_ALLOWED:
      return { type: InboxItemType.SHIFT_VIOLATION, severity: InboxSeverity.WARNING, title: "Access outside allowed time" };
    case AccessViolationReason.MEMBERSHIP_INACTIVE:
    case AccessViolationReason.EXPIRED:
      return { type: InboxItemType.MEMBERSHIP_EXPIRED, severity: InboxSeverity.WARNING, title: "Membership expired" };
    case AccessViolationReason.MEMBERSHIP_DEBT:
    case AccessViolationReason.NO_PAYMENT_YET:
      return { type: InboxItemType.DEVICE_DENIED, severity: InboxSeverity.CRITICAL, title: "Access denied (unpaid)" };
    case AccessViolationReason.BLACKLISTED:
      return { type: InboxItemType.DEVICE_DENIED, severity: InboxSeverity.CRITICAL, title: "Access denied (blacklisted)" };
    case AccessViolationReason.INACTIVE_MEMBER:
      return { type: InboxItemType.DEVICE_DENIED, severity: InboxSeverity.WARNING, title: "Access denied (inactive member)" };
    default:
      return { type: InboxItemType.DEVICE_DENIED, severity: InboxSeverity.WARNING, title: "Access denied" };
  }
}

function formatReason(reason: AccessViolationReason) {
  switch (reason) {
    case AccessViolationReason.MEMBERSHIP_INACTIVE:
      return "membership inactive";
    case AccessViolationReason.MEMBERSHIP_DEBT:
      return "membership debt";
    case AccessViolationReason.NO_PAYMENT_YET:
      return "no payment yet";
    case AccessViolationReason.DAY_NOT_ALLOWED:
      return "day not allowed";
    case AccessViolationReason.TIME_NOT_ALLOWED:
      return "time not allowed";
    case AccessViolationReason.BLACKLISTED:
      return "blacklisted";
    case AccessViolationReason.INACTIVE_MEMBER:
      return "inactive member";
    case AccessViolationReason.DEVICE_USER_NOT_FOUND:
      return "device user not found";
    case AccessViolationReason.MEMBER_NOT_FOUND:
      return "member not found";
    case AccessViolationReason.EXPIRED:
      return "membership expired";
    default:
      return "unknown";
  }
}

