import { z } from "zod";

const emptyToUndefined = (value: unknown) => (value === "" || value === null ? undefined : value);

const parseBoolean = (value: unknown) => {
  if (value === undefined) return undefined;
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["true", "1", "yes"].includes(normalized)) return true;
    if (["false", "0", "no"].includes(normalized)) return false;
  }
  return undefined;
};

export const INBOX_CATEGORIES = ["ALERT", "DEVICE_FEED"] as const;
export const INBOX_SEVERITIES = ["INFO", "WARNING", "CRITICAL"] as const;
export const INBOX_TYPES = [
  "MEMBERSHIP_EXPIRING",
  "MEMBERSHIP_EXPIRED",
  "SHIFT_ENDING_SOON",
  "DEVICE_DISCONNECTED",
  "DEVICE_DENIED",
  "DEVICE_AUTHORIZED",
  "SHIFT_VIOLATION",
  "MULTIPLE_FAILED_ATTEMPTS",
] as const;

export const inboxListQuerySchema = z.object({
  category: z.preprocess(emptyToUndefined, z.enum(INBOX_CATEGORIES).optional()),
  unreadOnly: z.preprocess(parseBoolean, z.boolean().optional()),
  severity: z.preprocess(emptyToUndefined, z.enum(INBOX_SEVERITIES).optional()),
  type: z.preprocess(emptyToUndefined, z.enum(INBOX_TYPES).optional()),
  deviceId: z.preprocess(emptyToUndefined, z.string().cuid("Invalid device id").optional()),
  memberId: z.preprocess(emptyToUndefined, z.string().cuid("Invalid member id").optional()),
  from: z.preprocess(emptyToUndefined, z.string().optional()),
  to: z.preprocess(emptyToUndefined, z.string().optional()),
  search: z.preprocess(emptyToUndefined, z.string().optional()),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(20),
});

export type InboxListQuery = z.infer<typeof inboxListQuerySchema>;

export const inboxReadAllSchema = z.object({
  category: z.preprocess(emptyToUndefined, z.enum(INBOX_CATEGORIES).optional()),
  severity: z.preprocess(emptyToUndefined, z.enum(INBOX_SEVERITIES).optional()),
  type: z.preprocess(emptyToUndefined, z.enum(INBOX_TYPES).optional()),
  deviceId: z.preprocess(emptyToUndefined, z.string().cuid("Invalid device id").optional()),
  memberId: z.preprocess(emptyToUndefined, z.string().cuid("Invalid member id").optional()),
});

export type InboxReadAllInput = z.infer<typeof inboxReadAllSchema>;

export const inboxReadBulkSchema = z.object({
  ids: z.array(z.string().cuid("Invalid inbox id")).min(1, "Ids are required"),
});

export type InboxReadBulkInput = z.infer<typeof inboxReadBulkSchema>;

export const inboxIdParamSchema = z.object({
  id: z.string().cuid("Invalid inbox id"),
});

