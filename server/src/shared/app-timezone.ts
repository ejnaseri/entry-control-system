export const DEFAULT_APP_TIMEZONE = "Asia/Kabul";
const IANA_TIMEZONE_NAME_PATTERN = /^[A-Za-z][A-Za-z0-9._+-]*(?:\/[A-Za-z0-9._+-]+)+$/u;

export function isValidAppTimezone(value: string): boolean {
  if (!value || value !== value.trim()) return false;
  if (value !== "UTC" && !IANA_TIMEZONE_NAME_PATTERN.test(value)) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value }).format(0);
    return true;
  } catch {
    return false;
  }
}
