import {
  AttendanceSource,
  AttendanceType,
  InboxCategory,
  InboxEntityType,
  InboxItemType,
  InboxScope,
  InboxSeverity,
  MemberType,
  MembershipStatus,
} from "@prisma/client";
import { env, type AppEdition } from "../../config/env";
import { prisma } from "../../lib/prisma";
import { logger } from "../../config/logger";
import { subscribeAttendanceInboxEvents } from "../devices/attendance-inbox-events";
import {
  resolveAttendanceAutoCheckoutDecision,
  type AttendanceAutoCheckoutSetting,
} from "../../shared/attendance-auto-checkout";
import { buildDedupeKey, createInboxItem, formatDayKey } from "./inbox.service";
import { recordAttendanceInboxEvent } from "./inbox.attendance";

const JOB_INTERVAL_MS = Number(process.env["INBOX_JOB_INTERVAL_MS"] ?? 15 * 60 * 1000);
const EXPIRING_SOON_DAYS = Number(process.env["INBOX_EXPIRING_SOON_DAYS"] ?? 2);
const SHIFT_ENDING_MINUTES = Number(process.env["INBOX_SHIFT_ENDING_MINUTES"] ?? 30);
const DEVICE_OFFLINE_MINUTES = Number(process.env["INBOX_DEVICE_OFFLINE_MINUTES"] ?? 10);
const DEVICE_FEED_RETENTION_DAYS = Number(process.env["INBOX_DEVICE_FEED_RETENTION_DAYS"] ?? 7);
const ALERT_RETENTION_DAYS = Number(process.env["INBOX_ALERT_RETENTION_DAYS"] ?? 90);
const AUTO_CHECKOUT_AFTER_MINUTES = Number(process.env["ATTENDANCE_AUTO_CHECKOUT_AFTER_MINUTES"] ?? 240);
const AUTO_CHECKOUT_LOOKBACK_HOURS = Number(process.env["ATTENDANCE_AUTO_CHECKOUT_LOOKBACK_HOURS"] ?? 36);

type AutoCheckoutRoutineOptions = Readonly<{
  edition: AppEdition;
  setting: AttendanceAutoCheckoutSetting;
  now?: Date;
}>;

export function startInboxScheduler(edition: AppEdition = env.APP_EDITION) {
  let activeRun: Promise<void> | null = null;
  const stopAttendanceProducer = edition === "ATTENDANCE"
    ? subscribeAttendanceInboxEvents(recordAttendanceInboxEvent)
    : null;

  const run = () => {
    if (activeRun) return activeRun;
    activeRun = runInboxJobs(edition)
      .catch((error) => {
        logger.error("Inbox scheduler failed", { message: (error as Error).message, stack: (error as Error).stack });
      })
      .finally(() => {
        activeRun = null;
      });
    return activeRun;
  };

  void run();
  const intervalId = setInterval(run, JOB_INTERVAL_MS);
  return async () => {
    clearInterval(intervalId);
    await activeRun;
    stopAttendanceProducer?.();
  };
}

async function runInboxJobs(edition: AppEdition) {
  if (edition === "FULL") {
    await createExpiringMembershipAlerts();
    await createExpiredMembershipAlerts();
    await createShiftEndingSoonAlerts(InboxScope.FULL, "/members");
    await autoCheckoutOverdueShifts({
      edition,
      setting: env.ATTENDANCE_AUTO_CHECKOUT_ENABLED,
    });
    await createDeviceDisconnectedAlerts(InboxScope.FULL);
    await cleanupDeviceFeed(InboxScope.FULL);
    await cleanupOldAlerts(InboxScope.FULL);
    return;
  }

  // Attendance Inbox remains capability-gated until O.2.7. This branch is
  // intentionally ready in advance and contains no Membership or synthetic
  // auto-checkout work.
  await createShiftEndingSoonAlerts(InboxScope.ATTENDANCE, "/employees");
  await createDeviceDisconnectedAlerts(InboxScope.ATTENDANCE);
  await cleanupDeviceFeed(InboxScope.ATTENDANCE);
  await cleanupOldAlerts(InboxScope.ATTENDANCE);
}

async function createExpiringMembershipAlerts() {
  const now = new Date();
  const expiringEnd = addDays(now, EXPIRING_SOON_DAYS);
  const memberships = await prisma.membership.findMany({
    where: {
      status: MembershipStatus.ACTIVE,
      endDate: { gt: now, lte: expiringEnd },
      member: { memberType: MemberType.CUSTOMER, isStaff: false },
    },
    include: {
      member: { select: { id: true, firstName: true, lastName: true, code: true } },
      plan: { select: { name: true } },
    },
  });

  const windowKey = formatDayKey(now);
  await Promise.all(
    memberships.map((membership) => {
      const memberName = formatMemberName(membership.member.firstName, membership.member.lastName);
      const daysLeft = Math.max(0, Math.ceil((membership.endDate.getTime() - now.getTime()) / 86400000));
      const dedupeKey = buildDedupeKey({
        type: InboxItemType.MEMBERSHIP_EXPIRING,
        entityType: InboxEntityType.MEMBERSHIP,
        entityId: membership.id,
        window: windowKey,
      });

      return createInboxItem({
        scope: InboxScope.FULL,
        category: InboxCategory.ALERT,
        type: InboxItemType.MEMBERSHIP_EXPIRING,
        severity: InboxSeverity.WARNING,
        title: `Membership expiring soon: ${memberName}`,
        body: `Plan ${membership.plan?.name ?? "-"} ends on ${membership.endDate.toLocaleDateString()} (${daysLeft} day(s) left).`,
        createdAt: now,
        entityType: InboxEntityType.MEMBERSHIP,
        entityId: membership.id,
        actionPath: `/members/${membership.memberId}`,
        dedupeKey,
        memberId: membership.memberId,
      });
    })
  );
}

async function createExpiredMembershipAlerts() {
  const now = new Date();
  const dayStart = startOfDay(now);
  const dayEnd = addDays(dayStart, 1);

  const memberships = await prisma.membership.findMany({
    where: {
      status: MembershipStatus.ACTIVE,
      endDate: { gte: dayStart, lt: dayEnd },
      member: { memberType: MemberType.CUSTOMER, isStaff: false },
    },
    include: {
      member: { select: { id: true, firstName: true, lastName: true, code: true } },
      plan: { select: { name: true } },
    },
  });

  const windowKey = formatDayKey(dayStart);
  await Promise.all(
    memberships.map((membership) => {
      const memberName = formatMemberName(membership.member.firstName, membership.member.lastName);
      const dedupeKey = buildDedupeKey({
        type: InboxItemType.MEMBERSHIP_EXPIRED,
        entityType: InboxEntityType.MEMBERSHIP,
        entityId: membership.id,
        window: windowKey,
      });

      return createInboxItem({
        scope: InboxScope.FULL,
        category: InboxCategory.ALERT,
        type: InboxItemType.MEMBERSHIP_EXPIRED,
        severity: InboxSeverity.WARNING,
        title: `Membership expired: ${memberName}`,
        body: `Plan ${membership.plan?.name ?? "-"} expired on ${membership.endDate.toLocaleDateString()}.`,
        createdAt: now,
        entityType: InboxEntityType.MEMBERSHIP,
        entityId: membership.id,
        actionPath: `/members/${membership.memberId}`,
        dedupeKey,
        memberId: membership.memberId,
      });
    })
  );
}

async function createShiftEndingSoonAlerts(scope: InboxScope, employeeBasePath: "/members" | "/employees") {
  const now = new Date();
  const dayStart = startOfDay(now);
  const windowEnd = addMinutes(now, SHIFT_ENDING_MINUTES);
  const weekday = toScheduleWeekday(dayStart);

  const shifts = await prisma.memberShift.findMany({
    where: {
      isActive: true,
      weekdays: { has: weekday },
      member: { OR: [{ memberType: MemberType.STAFF }, { isStaff: true }] },
    },
    include: {
      member: { select: { id: true, firstName: true, lastName: true, code: true } },
    },
  });

  const windowKey = formatDayKey(dayStart);
  const alerts = shifts
    .map((shift) => {
      const endAt = computeShiftEnd(dayStart, shift.shiftStart, shift.shiftEnd);
      if (endAt <= now || endAt > windowEnd) return null;

      const memberName = formatMemberName(shift.member.firstName, shift.member.lastName);
      const dedupeKey = buildDedupeKey({
        type: InboxItemType.SHIFT_ENDING_SOON,
        entityType: InboxEntityType.SHIFT,
        entityId: shift.id,
        window: windowKey,
      });

      return createInboxItem({
        scope,
        category: InboxCategory.ALERT,
        type: InboxItemType.SHIFT_ENDING_SOON,
        severity: InboxSeverity.INFO,
        title: `Shift ending soon: ${memberName}`,
        body: `Shift ${shift.shiftName} ends at ${shift.shiftEnd}.`,
        createdAt: now,
        entityType: InboxEntityType.SHIFT,
        entityId: shift.id,
        actionPath: `${employeeBasePath}/${shift.memberId}`,
        dedupeKey,
        memberId: shift.memberId,
      });
    })
    .filter(Boolean);

  await Promise.all(alerts);
}

async function autoCheckoutOverdueShifts(
  options: AutoCheckoutRoutineOptions = {
    edition: env.APP_EDITION,
    setting: env.ATTENDANCE_AUTO_CHECKOUT_ENABLED,
  }
) {
  if (!resolveAttendanceAutoCheckoutDecision(options.edition, options.setting).operational) return;
  if (!Number.isFinite(AUTO_CHECKOUT_AFTER_MINUTES) || AUTO_CHECKOUT_AFTER_MINUTES <= 0) return;
  if (!Number.isFinite(AUTO_CHECKOUT_LOOKBACK_HOURS) || AUTO_CHECKOUT_LOOKBACK_HOURS <= 0) return;

  const now = options.now ? new Date(options.now.getTime()) : new Date();
  const lookbackStart = addMinutes(now, -AUTO_CHECKOUT_LOOKBACK_HOURS * 60);

  const recentLogs = await prisma.attendanceLog.findMany({
    where: {
      isAuthorized: true,
      recordedAt: { gte: lookbackStart, lte: now },
      member: { OR: [{ memberType: MemberType.STAFF }, { isStaff: true }] },
    },
    orderBy: { recordedAt: "desc" },
    include: {
      member: {
        select: {
          id: true,
          shifts: { select: { shiftStart: true, shiftEnd: true, weekdays: true, isActive: true } },
        },
      },
    },
  });

  const latestByMember = new Map<string, (typeof recentLogs)[number]>();
  for (const log of recentLogs) {
    if (!log.memberId) continue;
    if (!latestByMember.has(log.memberId)) {
      latestByMember.set(log.memberId, log);
    }
  }

  const autoCheckouts: Array<{
    memberId: string;
    deviceUserId: string | null;
    recordedAt: Date;
  }> = [];

  latestByMember.forEach((log) => {
    if (log.entryType !== AttendanceType.IN) return;
    if (!log.member) return;

    const shiftWindow = findShiftWindowForTimestamp(log.member.shifts ?? [], log.recordedAt);
    if (!shiftWindow) return;

    const cutoff = addMinutes(shiftWindow.endAt, AUTO_CHECKOUT_AFTER_MINUTES);
    if (now < cutoff) return;

    autoCheckouts.push({
      memberId: log.memberId!,
      deviceUserId: log.deviceUserId ?? null,
      recordedAt: shiftWindow.endAt,
    });
  });

  if (autoCheckouts.length === 0) return;

  await Promise.all(
    autoCheckouts.map((checkout) =>
      prisma.attendanceLog.create({
        data: {
          memberId: checkout.memberId,
          deviceUserId: checkout.deviceUserId,
          recordedAt: checkout.recordedAt,
          entryType: AttendanceType.OUT,
          source: AttendanceSource.API,
          isAuthorized: true,
          reason: "auto checkout after shift end",
        },
      })
    )
  );
}

async function createDeviceDisconnectedAlerts(scope: InboxScope) {
  const now = new Date();
  const cutoff = addMinutes(now, -DEVICE_OFFLINE_MINUTES);
  const devices = await prisma.device.findMany({
    where: {
      enabled: true,
      lastSeenAt: { lt: cutoff },
    },
    select: { id: true, name: true, lastSeenAt: true },
  });

  const windowKey = formatDayKey(now);
  await Promise.all(
    devices.map((device) => {
      const dedupeKey = buildDedupeKey({
        type: InboxItemType.DEVICE_DISCONNECTED,
        entityType: InboxEntityType.DEVICE,
        entityId: device.id,
        window: windowKey,
      });

      return createInboxItem({
        scope,
        category: InboxCategory.ALERT,
        type: InboxItemType.DEVICE_DISCONNECTED,
        severity: InboxSeverity.CRITICAL,
        title: `Device disconnected: ${device.name}`,
        body: device.lastSeenAt ? `Last seen at ${device.lastSeenAt.toLocaleString()}.` : "Last seen time unavailable.",
        createdAt: now,
        entityType: InboxEntityType.DEVICE,
        entityId: device.id,
        actionPath: "/devices",
        dedupeKey,
        deviceId: device.id,
      });
    })
  );
}

async function cleanupDeviceFeed(scope: InboxScope) {
  const cutoff = addDays(new Date(), -DEVICE_FEED_RETENTION_DAYS);
  await prisma.inboxItem.deleteMany({
    where: {
      scope,
      category: InboxCategory.DEVICE_FEED,
      createdAt: { lt: cutoff },
    },
  });
}

async function cleanupOldAlerts(scope: InboxScope) {
  if (!Number.isFinite(ALERT_RETENTION_DAYS) || ALERT_RETENTION_DAYS <= 0) return;
  const cutoff = addDays(new Date(), -ALERT_RETENTION_DAYS);
  await prisma.inboxItem.deleteMany({
    where: {
      scope,
      category: InboxCategory.ALERT,
      createdAt: { lt: cutoff },
    },
  });
}

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function addMinutes(date: Date, minutes: number): Date {
  const d = new Date(date);
  d.setMinutes(d.getMinutes() + minutes);
  return d;
}

function formatMemberName(firstName: string, lastName?: string | null) {
  return [firstName, lastName].filter(Boolean).join(" ");
}

function applyTime(base: Date, time: string): Date {
  const [hours, minutes] = time.split(":").map(Number);
  const next = new Date(base);
  next.setHours(hours ?? 0, minutes ?? 0, 0, 0);
  return next;
}

function timeToMinutes(value: string) {
  const [hoursPart = "0", minutesPart = "0"] = value.split(":");
  const hours = Number(hoursPart);
  const minutes = Number(minutesPart);
  return hours * 60 + minutes;
}

function computeShiftEnd(dayStart: Date, shiftStart: string, shiftEnd: string) {
  const shiftStartAt = applyTime(dayStart, shiftStart);
  let shiftEndAt = applyTime(dayStart, shiftEnd);
  if (timeToMinutes(shiftEnd) <= timeToMinutes(shiftStart)) {
    shiftEndAt = addDays(shiftEndAt, 1);
  }
  if (shiftEndAt < shiftStartAt) {
    shiftEndAt = addDays(shiftEndAt, 1);
  }
  return shiftEndAt;
}

function findShiftWindowForTimestamp(
  shifts: Array<{ shiftStart: string; shiftEnd: string; weekdays?: number[] | null; isActive?: boolean | null }>,
  timestamp: Date
) {
  if (!shifts || shifts.length === 0) return null;
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
    if (shift.isActive === false) continue;
    const shiftDays = shift.weekdays?.length ? shift.weekdays : [0, 1, 2, 3, 4, 5, 6];
    const crossesMidnight = timeToMinutes(shift.shiftEnd) <= timeToMinutes(shift.shiftStart);

    if (shiftDays.includes(weekday)) {
      considerWindow({ startAt: applyTime(dayStart, shift.shiftStart), endAt: computeShiftEnd(dayStart, shift.shiftStart, shift.shiftEnd) });
    }

    if (crossesMidnight && shiftDays.includes(prevWeekday)) {
      considerWindow({ startAt: applyTime(prevDayStart, shift.shiftStart), endAt: computeShiftEnd(prevDayStart, shift.shiftStart, shift.shiftEnd) });
    }
  }

  const resolvedBest = best as { startAt: Date; endAt: Date; distance: number } | null;
  if (!resolvedBest) return null;
  return { startAt: resolvedBest.startAt, endAt: resolvedBest.endAt };
}

function toScheduleWeekday(date: Date) {
  return (date.getDay() + 1) % 7;
}

export const inboxJobsTestHooks = Object.freeze({
  autoCheckoutOverdueShifts,
  runInboxJobs,
});

