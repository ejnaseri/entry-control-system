import {
  AttendanceType,
  InboxCategory,
  InboxEntityType,
  InboxItemType,
  InboxScope,
  InboxSeverity,
} from "@prisma/client";
import { prisma } from "../../lib/prisma";
import type { AttendanceInboxEvent } from "../devices/attendance-inbox-events";
import { buildDedupeKey, createInboxItem, formatWindowKey } from "./inbox.service";

const FAILED_ATTEMPT_WINDOW_MINUTES = Number(process.env["INBOX_FAILED_ATTEMPT_WINDOW_MINUTES"] ?? 2);
const FAILED_ATTEMPT_THRESHOLD = Number(process.env["INBOX_FAILED_ATTEMPT_THRESHOLD"] ?? 3);

type AttendanceEmployeeProjection = Extract<
  AttendanceInboxEvent,
  { kind: "ACCEPTED_STAFF_PUNCH" }
>["employee"];
type AttendanceDeviceProjection = AttendanceInboxEvent["device"];

/**
 * Writes only the approved Attendance projection. The input deliberately has
 * no raw payload, external device-user id, Customer, Membership, biometric or
 * Door fields, so those values cannot be persisted by this producer.
 */
export async function recordAttendanceInboxEvent(event: AttendanceInboxEvent): Promise<void> {
  if (event.kind === "ACCEPTED_STAFF_PUNCH") {
    await createInboxItem({
      scope: InboxScope.ATTENDANCE,
      category: InboxCategory.DEVICE_FEED,
      type: InboxItemType.DEVICE_AUTHORIZED,
      severity: InboxSeverity.INFO,
      title: `Attendance recorded: ${employeeLabel(event.employee)}`,
      body: `Device: ${deviceLabel(event.device)} · Punch: ${event.entryType}`,
      createdAt: event.occurredAt,
      entityType: InboxEntityType.MEMBER,
      entityId: event.employee.id,
      actionPath: `/employees/${event.employee.id}`,
      deviceId: event.device.id,
      memberId: event.employee.id,
    });
    return;
  }

  const employee = event.kind === "INACTIVE_EMPLOYEE_ATTEMPT" ? event.employee : null;
  const entityType = employee ? InboxEntityType.MEMBER : InboxEntityType.DEVICE;
  const entityId = employee?.id ?? event.device.id;
  const actionPath = employee ? `/employees/${employee.id}` : "/devices";
  const title = employee
    ? `Inactive employee attempt: ${employeeLabel(employee)}`
    : event.kind === "UNKNOWN_DEVICE_USER"
      ? `Unknown device user: ${deviceLabel(event.device)}`
      : `Invalid device event: ${deviceLabel(event.device)}`;
  const safeReason = employee
    ? "inactive employee"
    : event.kind === "UNKNOWN_DEVICE_USER"
      ? "unknown device user"
      : "invalid device event";

  await createInboxItem({
    scope: InboxScope.ATTENDANCE,
    category: InboxCategory.DEVICE_FEED,
    type: InboxItemType.DEVICE_DENIED,
    severity: InboxSeverity.WARNING,
    title,
    body: `Device: ${deviceLabel(event.device)} · Reason: ${safeReason}`,
    createdAt: event.occurredAt,
    entityType,
    entityId,
    actionPath: "/entry-logs",
    deviceId: event.device.id,
    memberId: employee?.id ?? null,
  });

  const failureCount = await countRecentAttendanceFailures(event, employee);
  if (failureCount >= FAILED_ATTEMPT_THRESHOLD) {
    await createInboxItem({
      scope: InboxScope.ATTENDANCE,
      category: InboxCategory.ALERT,
      type: InboxItemType.MULTIPLE_FAILED_ATTEMPTS,
      severity: InboxSeverity.WARNING,
      title: employee
        ? `Repeated failed attempts: ${employeeLabel(employee)}`
        : `Repeated failed attempts: ${deviceLabel(event.device)}`,
      body: `Detected ${failureCount} rejected events in the last ${FAILED_ATTEMPT_WINDOW_MINUTES} minutes.`,
      createdAt: event.occurredAt,
      entityType,
      entityId,
      actionPath,
      dedupeKey: buildDedupeKey({
        type: InboxItemType.MULTIPLE_FAILED_ATTEMPTS,
        entityType,
        entityId,
        window: formatWindowKey(event.occurredAt, FAILED_ATTEMPT_WINDOW_MINUTES),
      }),
      deviceId: event.device.id,
      memberId: employee?.id ?? null,
    });
    return;
  }

  await createInboxItem({
    scope: InboxScope.ATTENDANCE,
    category: InboxCategory.ALERT,
    type: InboxItemType.DEVICE_DENIED,
    severity: InboxSeverity.WARNING,
    title,
    body: `Reason: ${safeReason} · Device: ${deviceLabel(event.device)}`,
    createdAt: event.occurredAt,
    entityType,
    entityId,
    actionPath,
    dedupeKey: buildDedupeKey({
      type: InboxItemType.DEVICE_DENIED,
      entityType,
      entityId,
      window: formatWindowKey(event.occurredAt, FAILED_ATTEMPT_WINDOW_MINUTES),
    }),
    deviceId: event.device.id,
    memberId: employee?.id ?? null,
  });
}

async function countRecentAttendanceFailures(
  event: Exclude<AttendanceInboxEvent, { kind: "ACCEPTED_STAFF_PUNCH" }>,
  employee: AttendanceEmployeeProjection | null
) {
  const windowStart = new Date(event.occurredAt.getTime() - FAILED_ATTEMPT_WINDOW_MINUTES * 60_000);
  return prisma.inboxItem.count({
    where: {
      scope: InboxScope.ATTENDANCE,
      category: InboxCategory.DEVICE_FEED,
      type: InboxItemType.DEVICE_DENIED,
      createdAt: { gte: windowStart, lte: event.occurredAt },
      ...(employee ? { memberId: employee.id } : { deviceId: event.device.id, memberId: null }),
    },
  });
}

function employeeLabel(employee: AttendanceEmployeeProjection) {
  return employee.name.trim() || `Employee #${employee.code}`;
}

function deviceLabel(device: AttendanceDeviceProjection) {
  return device.name?.trim() || `Device ${device.id}`;
}
