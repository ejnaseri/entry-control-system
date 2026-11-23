import type { DeviceStatus, Prisma } from "@prisma/client";
import type { Request } from "express";
import type { DeviceActionContext } from "./device.service";

export type DeviceRuntimeSnapshot = {
  id: string;
  connected: boolean;
  lastPollAt?: Date;
  lastEventAt?: Date;
  lastEventProcessedAt?: Date;
  lastError?: string;
  lastErrorAt?: Date;
};

export type RawLogPayloadSummary = {
  externalUserId?: string;
  eventType?: string;
  recordId?: number | string;
};

export function toRuntimeSnapshot(value: {
  id: string;
  connected: boolean;
  lastPollAt?: Date | null | undefined;
  lastEventAt?: Date | null | undefined;
  lastEventProcessedAt?: Date | null | undefined;
  lastError?: string | null | undefined;
  lastErrorAt?: Date | null | undefined;
}): DeviceRuntimeSnapshot {
  return {
    id: value.id,
    connected: value.connected,
    ...(value.lastPollAt ? { lastPollAt: value.lastPollAt } : {}),
    ...(value.lastEventAt ? { lastEventAt: value.lastEventAt } : {}),
    ...(value.lastEventProcessedAt ? { lastEventProcessedAt: value.lastEventProcessedAt } : {}),
    ...(value.lastError ? { lastError: value.lastError } : {}),
    ...(value.lastErrorAt ? { lastErrorAt: value.lastErrorAt } : {}),
  };
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function summarizeRawLogPayload(payload: Prisma.JsonValue): RawLogPayloadSummary {
  if (!isObjectRecord(payload)) {
    return {};
  }

  const externalUserId = payload["externalUserId"];
  const eventType = payload["eventType"];
  const recordId = payload["recordId"];

  return {
    ...(typeof externalUserId === "string" || typeof externalUserId === "number"
      ? { externalUserId: String(externalUserId) }
      : {}),
    ...(typeof eventType === "string" ? { eventType } : {}),
    ...(typeof recordId === "string" || typeof recordId === "number" ? { recordId } : {}),
  };
}

export function getDeviceActionContext(req: Request): DeviceActionContext {
  const auth = req.auth;
  if (!auth) {
    throw new Error("Admin auth context was not resolved");
  }
  const meta: DeviceActionContext["meta"] = {};
  if (req.ip) meta.ipAddress = req.ip;
  const userAgent = req.get("user-agent");
  if (userAgent) meta.userAgent = userAgent;
  return {
    actor: {
      id: auth.user.id,
      role: auth.user.role,
      sessionId: auth.session.id,
    },
    meta,
  };
}

export function summarizeConnectionTestAudit(result: { ok: boolean; status?: DeviceStatus }) {
  return {
    success: result.ok,
    metadata: {
      outcome: result.ok ? "CONNECTED" : "FAILED",
      ...(result.status ? { deviceStatus: result.status } : {}),
    },
  };
}

const SAFE_STRICT_DEVICE_STRING_CONFIG_KEYS = ["ip", "dns", "gateway", "subnet", "protocol"] as const;
const SAFE_STRICT_DEVICE_NUMBER_CONFIG_KEYS = ["port", "timeoutMs", "pollIntervalMs"] as const;

function selectSafeStrictDeviceConfig(value: unknown): Record<string, string | number> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};

  const config = value as Record<string, unknown>;
  const safe: Record<string, string | number> = {};
  for (const key of SAFE_STRICT_DEVICE_STRING_CONFIG_KEYS) {
    const entry = config[key];
    if (typeof entry === "string") safe[key] = entry;
  }
  for (const key of SAFE_STRICT_DEVICE_NUMBER_CONFIG_KEYS) {
    const entry = config[key];
    if (typeof entry === "number" && Number.isFinite(entry)) safe[key] = entry;
  }
  return safe;
}

export function toSafeDeviceDto<T extends { config: unknown }>(device: T): Omit<T, "config"> & { config: unknown } {
  return {
    ...device,
    config: selectSafeStrictDeviceConfig(device.config),
  };
}
