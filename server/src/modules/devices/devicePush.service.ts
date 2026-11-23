import { DeviceStatus } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { HttpError } from "../../middlewares/error-handler";
import type { DeviceEvent, DeviceEventType } from "../../shared/devices.types";
import { shouldAcceptPush } from "./deviceEventMode";
import { processDeviceEvents } from "./zktecoK40.service";
import { formatDeviceError } from "./deviceError";
import { FULL_DEVICE_DATA_SCOPE } from "./device-edition-scope";

type RawPushEvent = Record<string, unknown>;

type PushResult = {
  received: number;
  processed: number;
  ignored: number;
  deviceId: string;
};

export async function handleDevicePush(payload: unknown): Promise<PushResult> {
  const { deviceId, serialNumber, events } = normalizePushPayload(payload);
  const device =
    (deviceId ? await prisma.device.findUnique({ where: { id: deviceId } }) : null) ??
    (serialNumber ? await prisma.device.findFirst({ where: { serialNumber } }) : null);

  if (!device) {
    throw new HttpError(404, "Device not found for push payload", { deviceId, serialNumber });
  }

  const receivedAt = new Date();
  await prisma.device
    .update({
      where: { id: device.id },
      data: {
        status: DeviceStatus.ONLINE,
        lastSeenAt: receivedAt,
        lastPushAt: receivedAt,
      },
    })
    .catch(() => {});

  if (!shouldAcceptPush(device.config)) {
    return {
      received: events.length,
      processed: 0,
      ignored: events.length,
      deviceId: device.id,
    };
  }

  const mappedEvents = events
    .map((raw) => mapPushEvent(raw, device.id))
    .filter((evt): evt is DeviceEvent => Boolean(evt));

  if (mappedEvents.length === 0) {
    return {
      received: events.length,
      processed: 0,
      ignored: events.length,
      deviceId: device.id,
    };
  }

  await prisma.device
    .update({
      where: { id: device.id },
      data: { lastEventReceivedAt: receivedAt },
    })
    .catch(() => {});

  let summary: Awaited<ReturnType<typeof processDeviceEvents>>;
  try {
    summary = await processDeviceEvents(mappedEvents, { scope: FULL_DEVICE_DATA_SCOPE });
  } catch (error) {
    const failedAt = new Date();
    await prisma.device
      .update({
        where: { id: device.id },
        data: {
          status: DeviceStatus.ERROR,
          lastErrorAt: failedAt,
          lastErrorMessage: formatDeviceError(error, "Device push processing failed without details"),
        },
      })
      .catch(() => {});
    throw error;
  }

  const now = new Date();
  const updateData: Record<string, unknown> = {
    status: DeviceStatus.ONLINE,
    lastSeenAt: now,
    lastPushAt: now,
    lastEventProcessedAt: now,
  };
  if (summary.maxRecordId !== undefined) updateData["lastAttendanceRecordId"] = summary.maxRecordId;
  if (summary.maxTimestamp) updateData["lastAttendanceAt"] = summary.maxTimestamp;

  await prisma.device.update({ where: { id: device.id }, data: updateData }).catch(() => {});

  return {
    received: events.length,
    processed: summary.processedCount,
    ignored: events.length - summary.processedCount,
    deviceId: device.id,
  };
}

function normalizePushPayload(payload: unknown): {
  deviceId?: string;
  serialNumber?: string;
  events: RawPushEvent[];
} {
  if (!payload || typeof payload !== "object") {
    return { events: [] };
  }

  const data = payload as Record<string, unknown>;
  const deviceId = coerceString(data["deviceId"] ?? data["device_id"] ?? data["device"]);
  const serialNumber = coerceString(
    data["SN"] ?? data["sn"] ?? data["serialNumber"] ?? data["serial"] ?? data["deviceSN"]
  );

  const events =
    (Array.isArray(data["events"]) ? (data["events"] as RawPushEvent[]) : null) ??
    (Array.isArray(data["data"]) ? (data["data"] as RawPushEvent[]) : null) ??
    (Array.isArray(data["records"]) ? (data["records"] as RawPushEvent[]) : null) ??
    [data as RawPushEvent];

  return {
    ...(deviceId ? { deviceId } : {}),
    ...(serialNumber ? { serialNumber } : {}),
    events,
  };
}

function mapPushEvent(raw: RawPushEvent, deviceId: string): DeviceEvent | null {
  const timestamp = parseTimestamp(raw);
  const externalUserId = extractUserId(raw);
  const recordId = extractRecordId(raw);
  if (!timestamp || !externalUserId) {
    return null;
  }

  return {
    deviceId,
    externalUserId,
    timestamp,
    eventType: mapType(raw),
    ...(recordId !== null ? { recordId } : {}),
    raw,
  };
}

function extractUserId(row: RawPushEvent): string | null {
  const candidate =
    row["userId"] ??
    row["user_id"] ??
    row["uid"] ??
    row["uidNumber"] ??
    row["pin"] ??
    row["PIN"] ??
    row["UserID"] ??
    row["user"] ??
    row["cardno"] ??
    row["cardNumber"];

  return coerceString(candidate);
}

function parseTimestamp(row: RawPushEvent): Date | null {
  const value =
    row["recordTime"] ??
    row["timestamp"] ??
    row["time"] ??
    row["Time"] ??
    row["attTime"] ??
    row["AttTime"] ??
    row["LogTime"] ??
    row["checkTime"] ??
    row["date"];

  if (!value) {
    return null;
  }

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value;
  }

  const parsed = new Date(String(value));
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed;
}

function extractRecordId(row: RawPushEvent): number | null {
  const candidate =
    row["id"] ?? row["recordId"] ?? row["LogID"] ?? row["AttLogId"] ?? row["logid"] ?? row["serialNumber"];
  if (candidate === undefined || candidate === null) return null;
  const num = Number(candidate);
  return Number.isNaN(num) ? null : num;
}

function mapType(row: RawPushEvent): DeviceEventType {
  const rawType = row["type"] ?? row["attType"] ?? row["verifyType"] ?? row["AttType"] ?? row["event"] ?? row["status"];
  if (typeof rawType === "string") {
    const value = rawType.toLowerCase();
    if (value.includes("out")) return "CHECK_OUT";
    if (value.includes("in")) return "CHECK_IN";
  }
  if (typeof rawType === "number") {
    if (rawType === 0) return "CHECK_IN";
    if (rawType === 1) return "CHECK_OUT";
  }
  return "UNKNOWN";
}

function coerceString(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  const str = String(value).trim();
  return str.length > 0 ? str : null;
}
