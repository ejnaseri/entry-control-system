import { AdminRole, AuditActor } from "@prisma/client";
import { z } from "zod";

const emptyToUndefined = (value: unknown) => (value === "" || value === null ? undefined : value);
const dateKeySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/u, "Use YYYY-MM-DD");

export const auditLogListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  from: z.preprocess(emptyToUndefined, dateKeySchema.optional()),
  to: z.preprocess(emptyToUndefined, dateKeySchema.optional()),
  actorId: z.preprocess(emptyToUndefined, z.string().cuid("Invalid actor id").optional()),
  actorType: z.preprocess(emptyToUndefined, z.nativeEnum(AuditActor).optional()),
  actorRole: z.preprocess(emptyToUndefined, z.nativeEnum(AdminRole).optional()),
  action: z.preprocess(emptyToUndefined, z.string().trim().min(1).max(160).optional()),
  targetType: z.preprocess(emptyToUndefined, z.string().trim().min(1).max(120).optional()),
  success: z.preprocess(
    emptyToUndefined,
    z.enum(["true", "false"]).transform((value) => value === "true").optional()
  ),
  search: z.preprocess(emptyToUndefined, z.string().trim().max(200).optional()),
});

export const auditLogIdParamSchema = z.object({
  id: z.string().cuid("Invalid audit log id"),
});

export type AuditLogListQuery = z.infer<typeof auditLogListQuerySchema>;
