import type { TFunction } from "i18next";

const REASON_ALIASES: Record<string, string> = {
  "membership inactive": "MEMBERSHIP_INACTIVE",
  "membership debt": "MEMBERSHIP_DEBT",
  "no payment yet": "NO_PAYMENT_YET",
  "day not allowed": "DAY_NOT_ALLOWED",
  "time not allowed": "TIME_NOT_ALLOWED",
  blacklisted: "BLACKLISTED",
  "inactive member": "INACTIVE_MEMBER",
  "device user not found": "DEVICE_USER_NOT_FOUND",
  "member not found": "MEMBER_NOT_FOUND",
  "membership expired": "EXPIRED",
  debtor: "DEBTOR",
  unregistered: "UNREGISTERED",
  unknown: "UNKNOWN",
};

const CODE_PATTERN = /^[A-Z][A-Z0-9_]+$/;

export function formatAccessReason(reason: string | null | undefined, t: TFunction) {
  if (!reason) return "";
  const trimmed = reason.trim();
  if (!trimmed) return "";

  const alias = REASON_ALIASES[trimmed.toLowerCase()];
  const code = alias ?? (CODE_PATTERN.test(trimmed) ? trimmed : null);
  if (!code) return trimmed;

  return t(`accessReasons.${code}`, { defaultValue: prettifyReasonCode(code) });
}

function prettifyReasonCode(code: string) {
  return code
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
