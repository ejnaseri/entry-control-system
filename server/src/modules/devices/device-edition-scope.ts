import { DeviceConnectionType, DeviceType, MemberType, type Prisma } from "@prisma/client";
import type { AppEdition } from "../../config/env";

export const DEVICE_DATA_SCOPES = Object.freeze({
  FULL_LEGACY: "FULL_LEGACY",
  STRICT_STAFF: "STRICT_STAFF",
} as const);

export type DeviceDataScope = (typeof DEVICE_DATA_SCOPES)[keyof typeof DEVICE_DATA_SCOPES];

export const FULL_DEVICE_DATA_SCOPE: DeviceDataScope = DEVICE_DATA_SCOPES.FULL_LEGACY;
export const STRICT_STAFF_DEVICE_DATA_SCOPE: DeviceDataScope = DEVICE_DATA_SCOPES.STRICT_STAFF;
export const MAX_DEVICE_EXTERNAL_ID = 2_147_483_647;

export function getDeviceDataScope(edition: AppEdition): DeviceDataScope {
  return edition === "ATTENDANCE" ? STRICT_STAFF_DEVICE_DATA_SCOPE : FULL_DEVICE_DATA_SCOPE;
}

export function isStrictStaffDeviceScope(scope: DeviceDataScope): boolean {
  return scope === STRICT_STAFF_DEVICE_DATA_SCOPE;
}

export function buildStrictStaffDeviceMemberWhere(): Prisma.MemberWhereInput {
  return {
    memberType: MemberType.STAFF,
    isStaff: true,
    archivedAt: null,
  };
}

export function isAttendanceK40PullDevice(device: {
  type: DeviceType;
  connectionType: DeviceConnectionType;
}): boolean {
  return (
    device.type === DeviceType.FINGERPRINT &&
    (device.connectionType === DeviceConnectionType.NETWORK ||
      device.connectionType === DeviceConnectionType.ZKTECO_PULL_SDK)
  );
}

export function isAttendanceK40PullDeviceInput(device: {
  type: DeviceType;
  connectionType: DeviceConnectionType;
  config?: unknown;
}): boolean {
  if (!isAttendanceK40PullDevice(device)) return false;
  if (!device.config || typeof device.config !== "object" || Array.isArray(device.config)) return true;

  const config = device.config as Record<string, unknown>;
  return (
    (config["eventMode"] === undefined || config["eventMode"] === "PULL") &&
    config["pushEnabled"] !== true
  );
}

export function resolveDeviceRuntimePolicy(
  scope: DeviceDataScope,
  device: {
    enabled: boolean;
    type: DeviceType;
    connectionType: DeviceConnectionType;
  }
): Readonly<{ shouldStart: boolean; forcePull: boolean; allowPush: boolean; allowAutomaticDoor: boolean }> {
  if (!isStrictStaffDeviceScope(scope)) {
    return Object.freeze({
      shouldStart: device.enabled,
      forcePull: false,
      allowPush: true,
      allowAutomaticDoor: true,
    });
  }

  return Object.freeze({
    shouldStart: device.enabled && isAttendanceK40PullDevice(device),
    forcePull: true,
    allowPush: false,
    allowAutomaticDoor: false,
  });
}

export function normalizeDeviceExternalId(value: string | number): number | null {
  if (typeof value === "string" && !/^\d+$/u.test(value.trim())) return null;
  const externalId = Number(typeof value === "string" ? value.trim() : value);
  return Number.isInteger(externalId) && externalId > 0 && externalId <= MAX_DEVICE_EXTERNAL_ID
    ? externalId
    : null;
}

export function normalizeCanonicalPhysicalDeviceExternalId(value: string | number): number | null {
  const externalId = normalizeDeviceExternalId(value);
  if (externalId === null || String(value).trim() !== String(externalId)) return null;
  return externalId;
}
