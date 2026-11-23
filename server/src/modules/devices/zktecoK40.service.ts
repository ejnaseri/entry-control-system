import {
  AccessViolationReason,
  AttendanceSource,
  AttendanceType,
  DeviceConnectionType,
  DeviceRawLogStatus,
  DeviceType,
  MemberStatus,
  MemberType,
  MembershipStatus,
  Prisma,
} from "@prisma/client";
import { createHash } from "crypto";
import { prisma } from "../../lib/prisma";
import { logger } from "../../config/logger";
import { env } from "../../config/env";
import type { DeviceEvent, DeviceEventType } from "../../shared/devices.types";
import { resolveAttendancePunchDecision } from "../../shared/attendance-policy";
import { ZktecoK40Client } from "./zktecoK40.client";
import {
  isStrictStaffDeviceScope,
  normalizeCanonicalPhysicalDeviceExternalId,
  type DeviceDataScope,
} from "./device-edition-scope";

function mapEventType(eventType: DeviceEventType): AttendanceType | null {
  if (eventType === "CHECK_OUT") return AttendanceType.OUT;
  if (eventType === "CHECK_IN") return AttendanceType.IN;
  return null;
}

type MemberWithAccess = Prisma.MemberGetPayload<{
  include: {
    accessPolicy: { include: { rules: true } };
    memberships: {
      include: {
        plan: {
          select: {
            basePrice: true;
            durationValue: true;
            durationUnit: true;
          };
        };
      };
    };
    shifts: { select: { shiftStart: true; shiftEnd: true; weekdays: true; earlyAccessMinutes: true; isActive: true } };
  };
}>;

type LastAuthorizedLog = {
  entryType: AttendanceType;
  recordedAt: Date;
} | null;

type StoredDeviceRawLog = {
  id: string;
  status: DeviceRawLogStatus;
  processedAt: Date | null;
  isNew: boolean;
};

function parseMinutes(time: string | null | undefined): number | null {
  if (!time) return null;
  const [hRaw, mRaw] = time.split(":");
  const h = Number(hRaw);
  const m = Number(mRaw);
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  return h * 60 + m;
}

const ALL_WEEKDAYS = [0, 1, 2, 3, 4, 5, 6];
const LATE_CHECKOUT_GRACE_MINUTES = Number(process.env["ATTENDANCE_LATE_CHECKOUT_GRACE_MINUTES"] ?? 240);

function isZktecoConnectionType(
  connectionType: DeviceConnectionType
): connectionType is "NETWORK" | "ZKTECO_PULL_SDK" {
  return connectionType === DeviceConnectionType.NETWORK || connectionType === DeviceConnectionType.ZKTECO_PULL_SDK;
}

function toScheduleWeekday(date: Date) {
  return (date.getDay() + 1) % 7;
}

function normalizeWeekdays(days?: number[] | null) {
  return Array.from(new Set(days ?? [])).sort((a, b) => a - b);
}

function isAllWeekdays(days: number[]) {
  return days.length === ALL_WEEKDAYS.length && ALL_WEEKDAYS.every((day) => days.includes(day));
}

function sameWeekdays(left: number[], right: number[]) {
  if (left.length !== right.length) return false;
  return left.every((day, idx) => day === right[idx]);
}

function getShiftWeekdays(member: MemberWithAccess) {
  const days = new Set<number>();
  (member.shifts ?? []).forEach((shift) => {
    if (!shift.isActive) return;
    const shiftDays = shift.weekdays?.length ? shift.weekdays : ALL_WEEKDAYS;
    shiftDays.forEach((day) => days.add(day));
  });
  const list = Array.from(days);
  return list.length ? list.sort((a, b) => a - b) : [];
}

function isWithinStaffShift(member: MemberWithAccess, ts: Date): boolean {
  const shifts = member.shifts ?? [];
  if (shifts.length === 0) return false;
  const dayStart = startOfDay(ts);
  const weekday = toScheduleWeekday(ts);
  const prevDayStart = addDays(dayStart, -1);
  const prevWeekday = toScheduleWeekday(prevDayStart);

  return shifts.some((shift) => {
    if (!shift.isActive) return false;
    const shiftDays = shift.weekdays?.length ? shift.weekdays : ALL_WEEKDAYS;
    const crossesMidnight = timeToMinutes(shift.shiftEnd) <= timeToMinutes(shift.shiftStart);
    const earlyAccessMinutes = getEarlyAccessMinutes(shift.earlyAccessMinutes);

    if (shiftDays.includes(weekday)) {
      const window = computeShiftWindow(dayStart, shift.shiftStart, shift.shiftEnd);
      if (isWithinShiftAccessWindow(ts, window, earlyAccessMinutes)) return true;
    }

    if (crossesMidnight && shiftDays.includes(prevWeekday)) {
      const window = computeShiftWindow(prevDayStart, shift.shiftStart, shift.shiftEnd);
      if (isWithinShiftAccessWindow(ts, window, earlyAccessMinutes)) return true;
    }

    return false;
  });
}

function getEarlyAccessMinutes(value: number | null | undefined) {
  const minutes = Number(value ?? 15);
  if (!Number.isFinite(minutes)) return 15;
  return Math.max(0, minutes);
}

function isWithinShiftAccessWindow(
  timestamp: Date,
  window: { startAt: Date; endAt: Date },
  earlyAccessMinutes: number
) {
  return timestamp >= addMinutes(window.startAt, -earlyAccessMinutes) && timestamp <= window.endAt;
}

function hasManualAccessOverride(member: MemberWithAccess): boolean {
  const policy = member.accessPolicy;
  if (!policy) return false;
  const rulesCount = policy.rules?.length ?? 0;
  if (rulesCount > 0) return true;
  const allowedDays = normalizeWeekdays(policy.allowedDays);
  if (allowedDays.length === 0) return false;
  if (isAllWeekdays(allowedDays)) return false;
  const shiftDays = getShiftWeekdays(member);
  if (shiftDays.length > 0 && sameWeekdays(allowedDays, shiftDays)) return false;
  return true;
}

function isWithinAccessPolicy(member: MemberWithAccess, ts: Date): { allowed: boolean; reason?: AccessViolationReason } {
  const policy = member.accessPolicy;
  if (!policy) return { allowed: true };

  const weekday = toScheduleWeekday(ts); // 0 = Saturday
  if (policy.allowedDays && policy.allowedDays.length > 0 && !policy.allowedDays.includes(weekday)) {
    return { allowed: false, reason: AccessViolationReason.DAY_NOT_ALLOWED };
  }

  const rules = policy.rules ?? [];
  if (rules.length === 0) return { allowed: true };

  const minutes = ts.getHours() * 60 + ts.getMinutes();
  const matched = rules.some((rule) => {
    if (rule.weekday !== weekday) return false;
    const from = parseMinutes(rule.fromTime);
    const to = parseMinutes(rule.toTime);
    if (from === null || to === null) return true;
    return minutes >= from && minutes <= to;
  });

  if (!matched) {
    return { allowed: false, reason: AccessViolationReason.TIME_NOT_ALLOWED };
  }

  return { allowed: true };
}

function getActiveMembership(member: MemberWithAccess, ts: Date) {
  const activeMembership = member.memberships
    .filter((membership) => membership.status === MembershipStatus.ACTIVE && membership.endDate >= ts)
    .sort((left, right) => right.endDate.getTime() - left.endDate.getTime())[0];
  if (activeMembership) return activeMembership;

  const pendingMembership = member.memberships
    .filter((membership) => membership.status === MembershipStatus.PENDING)
    .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime())[0];

  return pendingMembership;
}

function toAmount(value: Prisma.Decimal | number | null | undefined) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function inferMembershipPeriods(membership: MemberWithAccess["memberships"][number]) {
  const planBasePrice = toAmount(membership.plan?.basePrice);
  const membershipBasePrice = toAmount(membership.basePrice);
  if (planBasePrice <= 0 || membershipBasePrice <= 0) return 1;

  const ratio = membershipBasePrice / planBasePrice;
  const rounded = Math.round(ratio);
  if (rounded >= 1 && Math.abs(ratio - rounded) < 0.0001) {
    return rounded;
  }
  return 1;
}

function computeActivatedMembershipEndDate(membership: MemberWithAccess["memberships"][number], activatedAt: Date) {
  const durationValue = Math.max(1, Math.floor(Number(membership.plan?.durationValue ?? 1)));
  const periods = inferMembershipPeriods(membership);
  const totalDuration = durationValue * periods;

  if (membership.plan?.durationUnit === "DAYS") {
    return addDays(activatedAt, totalDuration);
  }
  return addMonths(activatedAt, totalDuration);
}

function applyTime(base: Date, time: string): Date {
  const [hours, minutes] = time.split(":").map(Number);
  const next = new Date(base);
  next.setHours(hours ?? 0, minutes ?? 0, 0, 0);
  return next;
}

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function addMinutes(date: Date, minutes: number): Date {
  const d = new Date(date);
  d.setMinutes(d.getMinutes() + minutes);
  return d;
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function addMonths(date: Date, months: number): Date {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

function timeToMinutes(value: string) {
  const [hours, minutes] = value.split(":").map(Number);
  return (hours ?? 0) * 60 + (minutes ?? 0);
}

function computeShiftWindow(dayStart: Date, shiftStart: string, shiftEnd: string) {
  const startAt = applyTime(dayStart, shiftStart);
  let endAt = applyTime(dayStart, shiftEnd);
  if (timeToMinutes(shiftEnd) <= timeToMinutes(shiftStart)) {
    endAt = addDays(endAt, 1);
  }
  if (endAt < startAt) {
    endAt = addDays(endAt, 1);
  }
  return { startAt, endAt };
}

function findShiftWindowForTimestamp(member: MemberWithAccess, timestamp: Date) {
  const shifts = member.shifts ?? [];
  if (shifts.length === 0) return null;

  const dayStart = startOfDay(timestamp);
  const weekday = toScheduleWeekday(timestamp);
  const prevDayStart = addDays(dayStart, -1);
  const prevWeekday = toScheduleWeekday(prevDayStart);

  let best: { startAt: Date; endAt: Date; distance: number } | null = null;

  const considerWindow = (window: { startAt: Date; endAt: Date }) => {
    let distance = 0;
    if (timestamp < window.startAt) {
      distance = window.startAt.getTime() - timestamp.getTime();
    } else if (timestamp > window.endAt) {
      distance = timestamp.getTime() - window.endAt.getTime();
    }
    if (!best || distance < best.distance) {
      best = { startAt: window.startAt, endAt: window.endAt, distance };
    }
  };

  for (const shift of shifts) {
    if (!shift.isActive) continue;
    const shiftDays = shift.weekdays?.length ? shift.weekdays : ALL_WEEKDAYS;
    const crossesMidnight = timeToMinutes(shift.shiftEnd) <= timeToMinutes(shift.shiftStart);

    if (shiftDays.includes(weekday)) {
      considerWindow(computeShiftWindow(dayStart, shift.shiftStart, shift.shiftEnd));
    }

    if (crossesMidnight && shiftDays.includes(prevWeekday)) {
      considerWindow(computeShiftWindow(prevDayStart, shift.shiftStart, shift.shiftEnd));
    }
  }

  const resolvedBest = best as { startAt: Date; endAt: Date; distance: number } | null;
  if (!resolvedBest) return null;
  return { startAt: resolvedBest.startAt, endAt: resolvedBest.endAt };
}

type AccessDecision = { allowed: boolean; reason?: AccessViolationReason; activeMembership?: MemberWithAccess["memberships"][number] };

type ProcessedResult = {
  processed: boolean;
  advanceCursor?: boolean;
  timestamp: Date;
  recordId?: number;
};

function isTerminalRawLogStatus(status: DeviceRawLogStatus): boolean {
  return (
    status === DeviceRawLogStatus.PROCESSED ||
    status === DeviceRawLogStatus.SKIPPED_INVALID ||
    status === DeviceRawLogStatus.SKIPPED_DUPLICATE
  );
}

export type ProcessContext = {
  scope: DeviceDataScope;
  unlockClient?: ZktecoK40Client;
  stopOnError?: boolean;
};

const DEFAULT_UNLOCK_SECONDS = 3;

function evaluateAccess(member: MemberWithAccess, ts: Date): AccessDecision {
  if (!member) return { allowed: false, reason: AccessViolationReason.MEMBER_NOT_FOUND };
  if (member.isBlacklisted) return { allowed: false, reason: AccessViolationReason.BLACKLISTED };
  if (member.status === MemberStatus.DEBTOR) return { allowed: false, reason: AccessViolationReason.DEBTOR };
  if (member.status === MemberStatus.EXPIRED) return { allowed: false, reason: AccessViolationReason.EXPIRED };
  if (member.status !== MemberStatus.ACTIVE) return { allowed: false, reason: AccessViolationReason.INACTIVE_MEMBER };

  const isStaff = member.memberType === MemberType.STAFF || member.isStaff;
  if (isStaff) {
    const hasShifts = (member.shifts ?? []).length > 0;
    const withinShift = hasShifts ? isWithinStaffShift(member, ts) : false;
    const hasOverride = hasManualAccessOverride(member);
    const policyResult = hasOverride ? isWithinAccessPolicy(member, ts) : { allowed: true };

    if (hasShifts) {
      if (!withinShift) {
        return { allowed: false, reason: AccessViolationReason.TIME_NOT_ALLOWED };
      }
      if (!policyResult.allowed) {
        return { allowed: false, reason: policyResult.reason ?? AccessViolationReason.TIME_NOT_ALLOWED };
      }
      return { allowed: true };
    }

    if (hasOverride) {
      return policyResult.allowed ? { allowed: true } : { allowed: false, reason: policyResult.reason ?? AccessViolationReason.TIME_NOT_ALLOWED };
    }

    return { allowed: false, reason: AccessViolationReason.TIME_NOT_ALLOWED };
  }

  let activeMembership: MemberWithAccess["memberships"][number] | undefined;
  if (!isStaff) {
    activeMembership = getActiveMembership(member, ts);
    if (!activeMembership) {
      return { allowed: false, reason: AccessViolationReason.MEMBERSHIP_INACTIVE };
    }
    const totalDue = Number(activeMembership.totalDue ?? 0);
    const totalPaid = Number(activeMembership.totalPaid ?? 0);
    if (totalPaid <= 0) {
      return { allowed: false, reason: AccessViolationReason.NO_PAYMENT_YET };
    }
    if (totalPaid < totalDue) {
      return { allowed: false, reason: AccessViolationReason.MEMBERSHIP_DEBT };
    }
  }

  const policyResult = isWithinAccessPolicy(member, ts);
  if (!policyResult.allowed) {
    return policyResult.reason ? { allowed: false, reason: policyResult.reason } : { allowed: false };
  }

  return { allowed: true, ...(activeMembership ? { activeMembership } : {}) };
}

export async function processDeviceEvent(event: DeviceEvent, context: ProcessContext): Promise<void> {
  await processDeviceEventInternal(event, context);
}

export async function processDeviceEvents(
  events: DeviceEvent[],
  context: ProcessContext
): Promise<{ processedCount: number; maxRecordId?: number; maxTimestamp?: Date }> {
  let processedCount = 0;
  let maxRecordId: number | undefined;
  let maxTimestamp: Date | undefined;
  let cursorInvalidated = false;

  // K40 SDK batches are not guaranteed to be chronological. TIME_CLOCK
  // inference must observe older punches before newer ones; FULL retains its
  // legacy input order.
  const orderedEvents = isStrictStaffDeviceScope(context.scope)
    ? [...events].sort(compareDeviceEventsChronologically)
    : events;

  for (const event of orderedEvents) {
    try {
      const processed = await processDeviceEventInternal(event, context);
      if (processed.processed) {
        processedCount += 1;
      }
      if (processed.processed || processed.advanceCursor) {
        if (typeof processed.recordId === "number") {
          if (maxRecordId === undefined || processed.recordId > maxRecordId) {
            maxRecordId = processed.recordId;
          }
        }
        if (!maxTimestamp || processed.timestamp > maxTimestamp) {
          maxTimestamp = processed.timestamp;
        }
      }
    } catch (error) {
      logger.error("[K40] Failed to process event", {
        device: event.deviceId,
        ...(!isStrictStaffDeviceScope(context.scope) ? { externalUserId: event.externalUserId } : {}),
        message: (error as Error).message,
      });
      // A Pull batch can be unordered and several records can share one timestamp.
      // Never persist a partial cursor after a failure: already-terminal RawLogs are
      // idempotent on retry, while advancing a partial cursor could lose the failed
      // record forever. Polling asks for stopOnError so the manager also records the
      // outage/backoff; generic FULL Push keeps its legacy best-effort behavior.
      if (context.stopOnError) throw error;
      if (isStrictStaffDeviceScope(context.scope)) {
        cursorInvalidated = true;
        break;
      }
    }
  }

  return {
    processedCount,
    ...(!cursorInvalidated && maxRecordId !== undefined ? { maxRecordId } : {}),
    ...(!cursorInvalidated && maxTimestamp ? { maxTimestamp } : {}),
  };
}

function compareDeviceEventsChronologically(left: DeviceEvent, right: DeviceEvent): number {
  const timestampOrder = left.timestamp.getTime() - right.timestamp.getTime();
  if (timestampOrder !== 0) return timestampOrder;
  if (left.recordId !== undefined && right.recordId !== undefined) {
    return left.recordId - right.recordId;
  }
  return 0;
}

async function processDeviceEventInternal(event: DeviceEvent, context: ProcessContext): Promise<ProcessedResult> {
  const rawLog = await recordDeviceRawLog(event);
  try {
    if (isStrictStaffDeviceScope(context.scope)) {
      return await processStrictStaffStoredDeviceEvent(event, rawLog);
    }
    return await processStoredDeviceEvent(event, context, rawLog);
  } catch (error) {
    await markRawLogStatus(rawLog, DeviceRawLogStatus.FAILED, (error as Error).message);
    throw error;
  }
}

async function processStrictStaffStoredDeviceEvent(
  event: DeviceEvent,
  rawLog: StoredDeviceRawLog
): Promise<ProcessedResult> {
  if (!rawLog.isNew && isTerminalRawLogStatus(rawLog.status)) {
    return {
      processed: false,
      advanceCursor: true,
      timestamp: event.timestamp,
      ...(event.recordId !== undefined ? { recordId: event.recordId } : {}),
    };
  }

  let committedEvent: Parameters<typeof import("./device.events").pushStrictStaffProcessedEvent>[0] | null = null;
  let committedInboxEvent: import("./attendance-inbox-events").AttendanceInboxEvent | null = null;
  let result: ProcessedResult;
  try {
    result = await runStrictStaffTransaction(async (tx) => {
    // A serialization retry must never publish the result of the rolled-back attempt.
    committedEvent = null;
    committedInboxEvent = null;
    const terminal = async (
      reason: string,
      inboxEvent?: import("./attendance-inbox-events").AttendanceInboxEvent
    ): Promise<ProcessedResult> => {
      await tx.deviceRawLog.updateMany({
        where: { id: rawLog.id, status: { not: DeviceRawLogStatus.PROCESSED } },
        data: {
          status: DeviceRawLogStatus.SKIPPED_INVALID,
          processError: reason,
          processedAt: new Date(),
        },
      });
      committedInboxEvent = inboxEvent ?? null;
      return {
        processed: false,
        advanceCursor: true,
        timestamp: event.timestamp,
        ...(event.recordId !== undefined ? { recordId: event.recordId } : {}),
      };
    };

    const externalId = normalizeCanonicalPhysicalDeviceExternalId(event.externalUserId);
    if (externalId === null) {
      return terminal("NON_NUMERIC_EXTERNAL_USER_ID", {
        kind: "INVALID_DEVICE_EVENT",
        occurredAt: event.timestamp,
        device: { id: event.deviceId },
      });
    }

    // Classification intentionally precedes attendance dedupe. A restored Customer or
    // inconsistent legacy marker must always terminate as NON_STAFF_MEMBER.
    const mapping = await tx.deviceUser.findUnique({
      where: { externalId },
      select: {
        id: true,
        memberId: true,
        deviceId: true,
        lastSyncedAt: true,
        member: {
          select: {
            id: true,
            code: true,
            firstName: true,
            lastName: true,
            memberType: true,
            isStaff: true,
            status: true,
            archivedAt: true,
          },
        },
      },
    });

    if (!mapping || !mapping.memberId || !mapping.member) {
      return terminal("DEVICE_USER_NOT_FOUND", {
        kind: "UNKNOWN_DEVICE_USER",
        occurredAt: event.timestamp,
        device: { id: event.deviceId },
      });
    }
    if (mapping.member.memberType !== MemberType.STAFF || mapping.member.isStaff !== true) {
      return terminal("NON_STAFF_MEMBER");
    }
    if (mapping.member.archivedAt || mapping.member.status !== MemberStatus.ACTIVE) {
      return terminal("INACTIVE_EMPLOYEE", {
        kind: "INACTIVE_EMPLOYEE_ATTEMPT",
        occurredAt: event.timestamp,
        employee: {
          id: mapping.member.id,
          code: mapping.member.code,
          name: `${mapping.member.firstName} ${mapping.member.lastName ?? ""}`.trim(),
        },
        device: { id: event.deviceId },
      });
    }
    if (mapping.deviceId !== event.deviceId) {
      return terminal("DEVICE_USER_DEVICE_MISMATCH", {
        kind: "INVALID_DEVICE_EVENT",
        occurredAt: event.timestamp,
        device: { id: event.deviceId },
      });
    }
    if (!mapping.lastSyncedAt) {
      return terminal("DEVICE_USER_NOT_SYNCED", {
        kind: "INVALID_DEVICE_EVENT",
        occurredAt: event.timestamp,
        device: { id: event.deviceId },
      });
    }

    const dedupeKey = buildAttendanceDedupeKey(event);
    const existing = await tx.attendanceLog.findUnique({ where: { dedupeKey } });
    if (existing) {
      await tx.deviceRawLog.updateMany({
        where: { id: rawLog.id, status: { not: DeviceRawLogStatus.PROCESSED } },
        data: {
          status: DeviceRawLogStatus.SKIPPED_DUPLICATE,
          processError: "ATTENDANCE_DEDUPE_MATCH",
          processedAt: new Date(),
        },
      });
      return {
        processed: false,
        advanceCursor: true,
        timestamp: event.timestamp,
        ...(event.recordId !== undefined ? { recordId: event.recordId } : {}),
      };
    }

    const member = await tx.member.findFirst({
      where: {
        id: mapping.memberId,
        memberType: MemberType.STAFF,
        isStaff: true,
        status: MemberStatus.ACTIVE,
        archivedAt: null,
      },
      select: {
        id: true,
        code: true,
        firstName: true,
        lastName: true,
        memberType: true,
        isStaff: true,
        status: true,
        isBlacklisted: true,
        accessPolicy: {
          select: {
            allowedDays: true,
            maxEntriesPerDay: true,
            rules: { select: { weekday: true, fromTime: true, toTime: true } },
          },
        },
        shifts: {
          where: { isActive: true },
          select: {
            shiftStart: true,
            shiftEnd: true,
            weekdays: true,
            earlyAccessMinutes: true,
            isActive: true,
          },
        },
      },
    });
    if (!member) {
      return terminal("NON_STAFF_MEMBER");
    }

    const previousLog = await tx.attendanceLog.findFirst({
      where: {
        memberId: member.id,
        recordedAt: { lt: event.timestamp },
        isAuthorized: true,
        member: { memberType: MemberType.STAFF, isStaff: true, archivedAt: null },
      },
      orderBy: { recordedAt: "desc" },
      select: { entryType: true, recordedAt: true },
    });
    const strictMember = { ...member, memberships: [] } as unknown as MemberWithAccess;
    const attendanceDecision = resolveAttendancePunchDecision(env.ATTENDANCE_POLICY);
    const allowLateCheckout = shouldAllowLateCheckout(strictMember, previousLog, event.timestamp);
    const entryType = resolveEntryType(event, previousLog, { allowCrossDayOut: allowLateCheckout });

    await tx.attendanceLog.create({
      data: {
        memberId: member.id,
        deviceUserId: mapping.id,
        recordedAt: event.timestamp,
        entryType,
        source: AttendanceSource.DEVICE,
        // In TIME_CLOCK mode this flag means the Staff punch is accepted into
        // the timecard. Door eligibility is a separate, explicit decision.
        isAuthorized: attendanceDecision.attendanceRecorded,
        reason: null,
        dedupeKey,
        rawLogId: rawLog.id,
      },
    });

    await tx.deviceRawLog.update({
      where: { id: rawLog.id },
      data: {
        status: DeviceRawLogStatus.PROCESSED,
        processError: null,
        processedAt: new Date(),
      },
    });

    committedEvent = {
      deviceId: event.deviceId,
      externalUserId: String(externalId),
      timestamp: event.timestamp,
      eventType: event.eventType,
      ...(event.recordId !== undefined ? { recordId: event.recordId } : {}),
      // Keep `authorized` as a compatibility alias for the accepted
      // attendance record. It is intentionally not the Door decision.
      authorized: attendanceDecision.attendanceRecorded,
      attendanceRecorded: attendanceDecision.attendanceRecorded,
      doorAllowed: attendanceDecision.doorAllowed,
      reason: null,
      memberName: `${member.firstName} ${member.lastName ?? ""}`.trim(),
      memberCode: member.code,
      doorOpened: attendanceDecision.doorOpened,
    };
    committedInboxEvent = {
      kind: "ACCEPTED_STAFF_PUNCH",
      occurredAt: event.timestamp,
      entryType,
      employee: {
        id: member.id,
        code: member.code,
        name: `${member.firstName} ${member.lastName ?? ""}`.trim(),
      },
      device: { id: event.deviceId },
    };

    return {
      processed: true,
      timestamp: event.timestamp,
      ...(event.recordId !== undefined ? { recordId: event.recordId } : {}),
    };
    });
  } catch (error) {
    if (!isUniqueConstraintError(error)) throw error;
    await prisma.deviceRawLog.updateMany({
      where: { id: rawLog.id, status: { not: DeviceRawLogStatus.PROCESSED } },
      data: {
        status: DeviceRawLogStatus.SKIPPED_DUPLICATE,
        processError: "ATTENDANCE_DEDUPE_CONFLICT",
        processedAt: new Date(),
      },
    });
    return {
      processed: false,
      advanceCursor: true,
      timestamp: event.timestamp,
      ...(event.recordId !== undefined ? { recordId: event.recordId } : {}),
    };
  }

  if (committedInboxEvent) {
    try {
      const { publishAttendanceInboxEvent } = await import("./attendance-inbox-events");
      await publishAttendanceInboxEvent(committedInboxEvent);
    } catch (error) {
      logger.error("[K40] Failed to publish Attendance Inbox event", {
        device: event.deviceId,
        message: (error as Error).message,
      });
    }
  }

  if (committedEvent) {
    try {
      const { pushStrictStaffProcessedEvent } = await import("./device.events");
      pushStrictStaffProcessedEvent(committedEvent);
    } catch (error) {
      logger.error("[K40] Failed to publish strict Staff event", {
        device: event.deviceId,
        message: (error as Error).message,
      });
    }
  }
  return result;
}

async function runStrictStaffTransaction<T>(operation: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      return await prisma.$transaction(operation, { isolationLevel: "Serializable" });
    } catch (error) {
      lastError = error;
      if ((error as { code?: string })?.code !== "P2034" || attempt === 3) {
        throw error;
      }
    }
  }
  throw lastError;
}

async function pushLegacyProcessedEvent(
  event: Parameters<typeof import("./device.events").pushProcessedEvent>[0]
): Promise<void> {
  const { pushProcessedEvent } = await import("./device.events");
  pushProcessedEvent(event);
}

async function recordLegacyDeviceInboxItems(
  input: Parameters<typeof import("../inbox/inbox.device").recordDeviceInboxItems>[0]
): Promise<void> {
  const { recordDeviceInboxItems } = await import("../inbox/inbox.device");
  await recordDeviceInboxItems(input);
}

async function openLegacyDoor(
  options: Parameters<typeof import("../door/door.service").openDoor>[0]
): Promise<void> {
  const { openDoor } = await import("../door/door.service");
  await openDoor(options);
}

async function processStoredDeviceEvent(
  event: DeviceEvent,
  context: ProcessContext,
  rawLog: StoredDeviceRawLog
): Promise<ProcessedResult> {
  // The prior client-side cursor skipped this replay implicitly. The persisted
  // cursor now allows one equal-timestamp overlap after restart, so terminal
  // RawLogs must short-circuit to preserve FULL's no-duplicate feed/inbox behavior.
  if (!rawLog.isNew && isTerminalRawLogStatus(rawLog.status)) {
    return {
      processed: false,
      advanceCursor: true,
      timestamp: event.timestamp,
      ...(event.recordId !== undefined ? { recordId: event.recordId } : {}),
    };
  }

  const dedupeKey = buildAttendanceDedupeKey(event);
  const existing = await prisma.attendanceLog.findUnique({ where: { dedupeKey } });
  if (existing) {
    await markRawLogStatus(rawLog, DeviceRawLogStatus.SKIPPED_DUPLICATE, "ATTENDANCE_DEDUPE_MATCH");
    return {
      processed: false,
      advanceCursor: true,
      timestamp: event.timestamp,
      ...(event.recordId !== undefined ? { recordId: event.recordId } : {}),
    };
  }

  const device = await prisma.device.findUnique({
    where: { id: event.deviceId },
    select: { id: true, name: true },
  });

  const externalId = Number(event.externalUserId);
  if (Number.isNaN(externalId)) {
    logger.warn("[K40] Skipping event with non-numeric user id", { rawUserId: event.externalUserId });
    await markRawLogStatus(rawLog, DeviceRawLogStatus.SKIPPED_INVALID, "NON_NUMERIC_EXTERNAL_USER_ID");
    return {
      processed: false,
      advanceCursor: true,
      timestamp: event.timestamp,
      ...(event.recordId !== undefined ? { recordId: event.recordId } : {}),
    };
  }

  const deviceUser = await prisma.deviceUser.findUnique({
    where: { externalId },
    include: {
      member: {
        include: {
          accessPolicy: { include: { rules: true } },
          memberships: {
            include: {
              plan: {
                select: {
                  basePrice: true,
                  durationValue: true,
                  durationUnit: true,
                },
              },
            },
          },
          shifts: {
            where: { isActive: true },
            select: { shiftStart: true, shiftEnd: true, weekdays: true, earlyAccessMinutes: true, isActive: true },
          },
        },
      },
    },
  });

  if (!deviceUser) {
    logger.warn("[K40] Device user not found for event", { externalId });
    await markRawLogStatus(rawLog, DeviceRawLogStatus.SKIPPED_INVALID, "DEVICE_USER_NOT_FOUND");
    await pushLegacyProcessedEvent({
      ...event,
      authorized: false,
      reason: AccessViolationReason.DEVICE_USER_NOT_FOUND,
    });
    try {
      await recordLegacyDeviceInboxItems({
        event,
        authorized: false,
        reason: AccessViolationReason.DEVICE_USER_NOT_FOUND,
        deviceId: device?.id ?? null,
        deviceName: device?.name ?? null,
      });
    } catch (error) {
      logger.error("[K40] Failed to record inbox item for unknown user", {
        message: (error as Error).message,
      });
    }
    return {
      processed: false,
      advanceCursor: true,
      timestamp: event.timestamp,
      ...(event.recordId !== undefined ? { recordId: event.recordId } : {}),
    };
  }

  const member = deviceUser.member;
  const previousLog = await fetchLastAuthorizedLog(deviceUser.id, deviceUser.memberId, event.timestamp);
  const decision = member
    ? evaluateAccess(member as MemberWithAccess, event.timestamp)
    : { allowed: false, reason: AccessViolationReason.MEMBER_NOT_FOUND };
  let deniedReasonOverride: string | null = null;

  const allowLateCheckout = member
    ? shouldAllowLateCheckout(member as MemberWithAccess, previousLog, event.timestamp)
    : false;
  let entryType = resolveEntryType(event, previousLog, { allowCrossDayOut: allowLateCheckout });

  if (!decision.allowed && decision.reason === AccessViolationReason.TIME_NOT_ALLOWED && allowLateCheckout) {
    decision.allowed = true;
    delete decision.reason;
    entryType = AttendanceType.OUT;
  }

  if (decision.allowed && member && entryType === AttendanceType.IN) {
    const isStaff = member.memberType === MemberType.STAFF || member.isStaff;
    if (!isStaff) {
      const maxEntriesPerDay = member.accessPolicy?.maxEntriesPerDay ?? null;
      if (maxEntriesPerDay && maxEntriesPerDay > 0) {
        const entriesToday = await countAuthorizedEntriesForDay(member.id, event.timestamp);
        if (entriesToday >= maxEntriesPerDay) {
          decision.allowed = false;
          decision.reason = AccessViolationReason.TIME_NOT_ALLOWED;
          deniedReasonOverride = "MAX_ENTRIES_PER_DAY";
        }
      }
    }
  }

  if (!decision.allowed) {
    await prisma.accessViolation.create({
      data: {
        ...(member?.id ? { memberId: member.id } : {}),
        deviceUserId: deviceUser.id,
        reason: decision.reason ?? AccessViolationReason.UNKNOWN,
      },
    });
  }

  if (
    decision.allowed &&
    entryType === AttendanceType.IN &&
    decision.activeMembership &&
    decision.activeMembership.status === MembershipStatus.PENDING &&
    !decision.activeMembership.activatedAt
  ) {
    const activatedAt = event.timestamp;
    const endDate = computeActivatedMembershipEndDate(decision.activeMembership, activatedAt);
    await prisma.membership.update({
      where: { id: decision.activeMembership.id, activatedAt: null },
      data: {
        activatedAt,
        status: MembershipStatus.ACTIVE,
        startDate: activatedAt,
        endDate,
        expiresAt: endDate,
      },
    });
  }

  try {
    await prisma.attendanceLog.create({
      data: {
        memberId: deviceUser.memberId,
        deviceUserId: deviceUser.id,
        recordedAt: event.timestamp,
        entryType,
        source: AttendanceSource.DEVICE,
        isAuthorized: decision.allowed,
        reason: decision.allowed ? null : deniedReasonOverride ?? decision.reason ?? null,
        dedupeKey,
        rawLogId: rawLog.id,
      },
    });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      await markRawLogStatus(rawLog, DeviceRawLogStatus.SKIPPED_DUPLICATE, "ATTENDANCE_DEDUPE_CONFLICT");
      return {
        processed: false,
        advanceCursor: true,
        timestamp: event.timestamp,
        ...(event.recordId !== undefined ? { recordId: event.recordId } : {}),
      };
    }
    throw error;
  }

  await markRawLogStatus(rawLog, DeviceRawLogStatus.PROCESSED);

  let doorOpened = false;
  if (decision.allowed) {
    try {
      doorOpened = await unlockDoorForEvent(event, context.unlockClient);
    } catch (error) {
      logger.error("Door unlock failed", {
        memberId: deviceUser.memberId,
        externalId,
        message: (error as Error).message,
      });
    }
  }

  if (decision.allowed && !doorOpened) {
    const doorOptions: { memberId?: string; reason: string } = {
      reason: "authorized_by_policy",
    };
    if (deviceUser.memberId) {
      doorOptions.memberId = String(deviceUser.memberId);
    }
    try {
      await openLegacyDoor(doorOptions);
      doorOpened = true;
    } catch (error) {
      logger.error("Door relay open failed", {
        memberId: deviceUser.memberId,
        externalId,
        message: (error as Error).message,
      });
    }
  }

  const memberName = deviceUser.member ? `${deviceUser.member.firstName ?? ""} ${deviceUser.member.lastName ?? ""}`.trim() : "";
  const memberCodeLabel = deviceUser.member?.code ?? "n/a";
  const reasonLabel = decision.allowed ? "OK" : decision.reason ?? AccessViolationReason.UNKNOWN;
  const accessLogLine = `[ACCESS] member=${memberName || "Unknown"} (code=${memberCodeLabel}, externalId=${externalId}) authorized=${
    decision.allowed
  } reason=${reasonLabel} doorOpened=${doorOpened} at=${event.timestamp.toISOString()}`;

  logger.debug(accessLogLine);
  try {
    await recordLegacyDeviceInboxItems({
      event,
      authorized: decision.allowed,
      reason: decision.reason ?? null,
      memberId: deviceUser.memberId ?? null,
      memberName,
      memberCode: deviceUser.member?.code ?? null,
      deviceId: device?.id ?? null,
      deviceName: device?.name ?? null,
      entryType,
      doorOpened,
      deviceUserId: deviceUser.id,
    });
  } catch (error) {
    logger.error("[K40] Failed to record inbox item", { message: (error as Error).message });
  }
  await pushLegacyProcessedEvent({
    ...event,
    authorized: decision.allowed,
    reason: decision.reason ?? null,
    memberName,
    ...(deviceUser.member?.code ? { memberCode: deviceUser.member.code } : {}),
    doorOpened,
  });

  return {
    processed: true,
    timestamp: event.timestamp,
    ...(event.recordId !== undefined ? { recordId: event.recordId } : {}),
  };
}

async function recordDeviceRawLog(event: DeviceEvent): Promise<StoredDeviceRawLog> {
  const dataHash = buildAttendanceDedupeKey(event);
  const inserted = await prisma.deviceRawLog.createMany({
    data: {
      deviceId: event.deviceId,
      recordedAt: event.timestamp,
      dataHash,
      payload: buildRawLogPayload(event),
      status: DeviceRawLogStatus.PENDING,
    },
    skipDuplicates: true,
  });
  const rawLog = await prisma.deviceRawLog.findUnique({
    where: { dataHash },
    select: {
      id: true,
      status: true,
      processedAt: true,
    },
  });
  if (!rawLog) {
    throw new Error("Raw device log insert could not be read back");
  }
  return { ...rawLog, isNew: inserted.count === 1 };
}

async function markRawLogStatus(
  rawLog: StoredDeviceRawLog,
  status: DeviceRawLogStatus,
  processError?: string | null
) {
  const data = {
    status,
    processedAt: new Date(),
    processError: processError ?? null,
  };
  if (status === DeviceRawLogStatus.FAILED) {
    // A post-commit publisher failure or a stale processing attempt must never
    // downgrade immutable PROCESSED evidence.
    await prisma.deviceRawLog.updateMany({
      where: { id: rawLog.id, status: { not: DeviceRawLogStatus.PROCESSED } },
      data,
    });
    return;
  }
  if (status === DeviceRawLogStatus.PROCESSED) {
    await prisma.deviceRawLog.update({ where: { id: rawLog.id }, data });
    return;
  }
  // The RawLog snapshot can be stale when two workers observe the same hash.
  // Never let a late duplicate/invalid classifier downgrade evidence that a
  // concurrent worker has already committed as PROCESSED.
  await prisma.deviceRawLog.updateMany({
    where: { id: rawLog.id, status: { not: DeviceRawLogStatus.PROCESSED } },
    data,
  });
}

function buildRawLogPayload(event: DeviceEvent): Prisma.InputJsonObject {
  return toJsonValue({
    deviceId: event.deviceId,
    externalUserId: event.externalUserId,
    timestamp: event.timestamp,
    eventType: event.eventType,
    recordId: event.recordId ?? null,
    raw: event.raw ?? null,
  }) as Prisma.InputJsonObject;
}

function toJsonValue(value: unknown, seen = new WeakSet<object>()): unknown {
  if (value === null || typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return value;
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (typeof value === "bigint") {
    return value.toString();
  }
  if (value === undefined || typeof value === "function" || typeof value === "symbol") {
    return null;
  }
  if (Array.isArray(value)) {
    return value.map((item) => toJsonValue(item, seen));
  }
  if (typeof value === "object") {
    if (seen.has(value)) {
      return "[Circular]";
    }
    seen.add(value);
    const result: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value)) {
      result[key] = toJsonValue(item, seen);
    }
    seen.delete(value);
    return result;
  }
  return null;
}

function resolveUnlockSeconds(): number {
  const raw = Number(env.DOOR_OPEN_SECONDS ?? DEFAULT_UNLOCK_SECONDS);
  if (!Number.isFinite(raw)) {
    return DEFAULT_UNLOCK_SECONDS;
  }
  const rounded = Math.round(raw);
  return Math.min(60, Math.max(1, rounded));
}

async function unlockDoorForEvent(event: DeviceEvent, unlockClient?: ZktecoK40Client): Promise<boolean> {
  const seconds = resolveUnlockSeconds();

  if (unlockClient) {
    await unlockClient.unlockDoor(seconds);
    return true;
  }

  const device = await prisma.device.findUnique({ where: { id: event.deviceId } });
  if (!device) {
    logger.warn("[K40] Device not found for door unlock", { device: event.deviceId });
    return false;
  }

  if (device.type !== DeviceType.FINGERPRINT) {
    logger.warn("[K40] Door unlock skipped for non-fingerprint device", { device: device.id });
    return false;
  }

  if (!isZktecoConnectionType(device.connectionType)) {
    logger.warn("[K40] Door unlock skipped for unsupported connection type", {
      device: device.id,
      connectionType: device.connectionType,
    });
    return false;
  }

  const cfg: any = device.config ?? {};
  const host = cfg.ip ?? cfg.host;
  const port = Number(cfg.port ?? 0);
  const password = cfg.password ?? cfg.pass ?? cfg.commKey;
  if (!host || !port) {
    throw new Error("Device IP/port missing in config");
  }

  const client = new ZktecoK40Client({
    id: device.id,
    host,
    port,
    ...(password !== undefined ? { password } : {}),
    ...(cfg.timeoutMs !== undefined ? { timeoutMs: cfg.timeoutMs } : {}),
  });

  try {
    await client.connect();
    await client.unlockDoor(seconds);
    return true;
  } finally {
    await client.disconnect();
  }
}

function buildAttendanceDedupeKey(event: DeviceEvent) {
  const recordId = event.recordId ?? "";
  const payload = `${event.deviceId}|${event.externalUserId}|${event.timestamp.toISOString()}|${event.eventType}|${recordId}`;
  return createHash("sha256").update(payload).digest("hex");
}

async function fetchLastAuthorizedLog(deviceUserId: string, memberId: string | null, before: Date): Promise<LastAuthorizedLog> {
  const ownerFilter: Prisma.AttendanceLogWhereInput = memberId ? { memberId } : { deviceUserId };

  return prisma.attendanceLog.findFirst({
    where: { ...ownerFilter, recordedAt: { lt: before }, isAuthorized: true },
    orderBy: { recordedAt: "desc" },
    select: { entryType: true, recordedAt: true },
  });
}

async function countAuthorizedEntriesForDay(memberId: string, timestamp: Date) {
  const dayStart = startOfDay(timestamp);
  const dayEnd = addDays(dayStart, 1);
  return prisma.attendanceLog.count({
    where: {
      memberId,
      entryType: AttendanceType.IN,
      isAuthorized: true,
      recordedAt: { gte: dayStart, lt: dayEnd },
    },
  });
}

function resolveEntryType(
  event: DeviceEvent,
  previous: LastAuthorizedLog,
  options?: { allowCrossDayOut?: boolean }
): AttendanceType {
  const explicit = mapEventType(event.eventType);
  if (explicit) return explicit;

  if (!previous) {
    return AttendanceType.IN;
  }

  if (!isSameDay(previous.recordedAt, event.timestamp)) {
    if (options?.allowCrossDayOut && previous.entryType === AttendanceType.IN) {
      return AttendanceType.OUT;
    }
    return AttendanceType.IN;
  }

  return previous.entryType === AttendanceType.IN ? AttendanceType.OUT : AttendanceType.IN;
}

function shouldAllowLateCheckout(
  member: MemberWithAccess,
  previous: LastAuthorizedLog,
  eventTimestamp: Date
): boolean {
  if (!previous || previous.entryType !== AttendanceType.IN) return false;
  if (!Number.isFinite(LATE_CHECKOUT_GRACE_MINUTES) || LATE_CHECKOUT_GRACE_MINUTES < 0) return false;

  const shiftWindow = findShiftWindowForTimestamp(member, previous.recordedAt);
  if (!shiftWindow) return false;

  const cutoff = addMinutes(shiftWindow.endAt, LATE_CHECKOUT_GRACE_MINUTES);
  return eventTimestamp <= cutoff;
}

function isSameDay(left: Date, right: Date) {
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  );
}

function isUniqueConstraintError(error: unknown) {
  return Boolean((error as { code?: string })?.code === "P2002");
}
