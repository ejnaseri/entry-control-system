export type DeviceEventMode = "PULL" | "PUSH" | "AUTO";

const AUTO_PUSH_WINDOW_MS = 2 * 60 * 1000;

type ConfigShape = {
  eventMode?: string;
  pushEnabled?: boolean;
};

export function getConfiguredEventMode(config: unknown): DeviceEventMode {
  const eventMode = typeof config === "object" && config !== null ? (config as ConfigShape).eventMode : undefined;
  const raw = typeof eventMode === "string" ? eventMode : "";
  const normalized = raw.trim().toUpperCase();
  if (normalized === "PUSH" || normalized === "AUTO" || normalized === "PULL") {
    return normalized as DeviceEventMode;
  }
  return "PULL";
}

export function isPushEnabled(config: unknown): boolean {
  const raw = (config as ConfigShape | undefined)?.pushEnabled;
  return Boolean(raw);
}

export function shouldAcceptPush(config: unknown): boolean {
  const mode = getConfiguredEventMode(config);
  if (mode === "PUSH") return true;
  return mode === "AUTO" && isPushEnabled(config);
}

export function isAutoPushActive(
  mode: DeviceEventMode,
  pushEnabled: boolean,
  lastPushAt?: Date | null,
  now: Date = new Date(),
  windowMs: number = AUTO_PUSH_WINDOW_MS
): boolean {
  if (mode !== "AUTO" || !pushEnabled || !lastPushAt) {
    return false;
  }
  return now.getTime() - lastPushAt.getTime() <= windowMs;
}
