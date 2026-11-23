import { EventEmitter } from "events";
import type { AccessViolationReason } from "@prisma/client";
import type { DeviceEvent } from "../../shared/devices.types";

const emitter = new EventEmitter();
const strictStaffEmitter = new EventEmitter();
export type ProcessedEvent = DeviceEvent & {
  authorized: boolean;
  reason?: AccessViolationReason | null;
  memberName?: string;
  memberCode?: string;
  doorOpened?: boolean;
};
export type StrictStaffProcessedEvent = Pick<
  DeviceEvent,
  "deviceId" | "externalUserId" | "timestamp" | "eventType" | "recordId"
> & {
  /** Compatibility alias for attendanceRecorded on the strict boundary. */
  authorized: true;
  attendanceRecorded: true;
  doorAllowed: false;
  doorOpened: false;
  reason: null;
  memberName: string;
  memberCode: string;
};

const recent: ProcessedEvent[] = [];
const strictStaffRecent: StrictStaffProcessedEvent[] = [];
const MAX_RECENT = 50;

export function pushProcessedEvent(event: ProcessedEvent) {
  recent.unshift(event);
  if (recent.length > MAX_RECENT) {
    recent.pop();
  }
  emitter.emit("event", event);
}

export function getRecentEvents(limit = 20) {
  return recent.slice(0, limit);
}

export function pushStrictStaffProcessedEvent(event: StrictStaffProcessedEvent) {
  // Positive projection: structurally wider callers cannot publish raw device
  // data or add an accidental identity/secret field to the Attendance stream.
  const safeEvent: StrictStaffProcessedEvent = {
    deviceId: event.deviceId,
    externalUserId: event.externalUserId,
    timestamp: event.timestamp,
    eventType: event.eventType,
    ...(event.recordId !== undefined ? { recordId: event.recordId } : {}),
    authorized: true,
    attendanceRecorded: true,
    doorAllowed: false,
    doorOpened: false,
    reason: null,
    memberName: event.memberName,
    memberCode: event.memberCode,
  };
  strictStaffRecent.unshift(safeEvent);
  if (strictStaffRecent.length > MAX_RECENT) {
    strictStaffRecent.pop();
  }
  strictStaffEmitter.emit("event", safeEvent);
}

export function getRecentStrictStaffEvents(limit = 20) {
  return strictStaffRecent.slice(0, limit);
}

export function subscribeSse(res: import("express").Response) {
  const onEvent = (data: ProcessedEvent) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };
  emitter.on("event", onEvent);
  res.on("close", () => {
    emitter.off("event", onEvent);
  });
}

export function subscribeStrictStaffSse(res: import("express").Response) {
  const onEvent = (data: StrictStaffProcessedEvent) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };
  strictStaffEmitter.on("event", onEvent);
  res.on("close", () => {
    strictStaffEmitter.off("event", onEvent);
  });
}
