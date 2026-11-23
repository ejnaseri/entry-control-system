import { AdminRole } from "@prisma/client";
import { z } from "zod";
import type { AppEdition } from "../../config/env";

const manageableRoles = [
  AdminRole.GYM_OWNER,
  AdminRole.ADMIN,
  AdminRole.MANAGER,
  AdminRole.RECEPTION,
  AdminRole.ACCOUNTANT,
  AdminRole.DEVICE_OPERATOR,
  AdminRole.READ_ONLY_AUDITOR,
  AdminRole.STAFF,
] as const;

export const manageableAdminRoles = [...manageableRoles];

const attendanceManageableRoles = [
  AdminRole.GYM_OWNER,
  AdminRole.MANAGER,
  AdminRole.OPERATOR,
  AdminRole.DEVICE_OPERATOR,
  AdminRole.READ_ONLY_AUDITOR,
] as const;

export const attendanceManageableAdminRoles = Object.freeze([...attendanceManageableRoles]);

export function getManageableAdminRoles(edition: AppEdition): readonly AdminRole[] {
  return edition === "ATTENDANCE" ? attendanceManageableAdminRoles : manageableAdminRoles;
}

export const adminUserIdParamSchema = z.object({
  id: z.string().cuid("Invalid admin user id"),
});

const usernameSchema = z
  .string()
  .trim()
  .min(3)
  .max(50)
  .regex(/^[a-zA-Z0-9._-]+$/, "Username may contain letters, numbers, dot, underscore, and dash only")
  .transform((value) => value.toLowerCase());

const optionalEmailSchema = z.preprocess(
  (value) => {
    if (typeof value === "string" && value.trim() === "") return null;
    return value;
  },
  z.string().trim().email().max(254).transform((value) => value.toLowerCase()).nullable().optional()
);

const optionalFullNameSchema = z.preprocess(
  (value) => {
    if (typeof value === "string" && value.trim() === "") return null;
    return value;
  },
  z.string().trim().min(2).max(120).nullable().optional()
);

export const adminPasswordSchema = z.string().min(10).max(256);

export const adminUserCreateSchema = z.object({
  username: usernameSchema,
  password: adminPasswordSchema,
  fullName: optionalFullNameSchema,
  email: optionalEmailSchema,
  role: z.enum(manageableRoles),
});

export const attendanceAdminUserCreateSchema = adminUserCreateSchema.extend({
  role: z.enum(attendanceManageableRoles),
});

export const adminUserUpdateSchema = z
  .object({
    username: usernameSchema.optional(),
    fullName: optionalFullNameSchema,
    email: optionalEmailSchema,
    role: z.enum(manageableRoles).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, "At least one field is required");

export const attendanceAdminUserUpdateSchema = z
  .object({
    username: usernameSchema.optional(),
    fullName: optionalFullNameSchema,
    email: optionalEmailSchema,
    role: z.enum(attendanceManageableRoles).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, "At least one field is required");

export const adminUserResetPasswordSchema = z.object({
  password: adminPasswordSchema,
});

export const vendorMaintenanceActivateSchema = z.object({
  password: z.string().min(14).max(256),
  durationMinutes: z.coerce.number().int().min(15).max(240).default(60),
  reason: z.string().trim().min(5).max(500),
});

export const vendorMaintenanceDeactivateSchema = z.object({
  reason: z
    .string()
    .trim()
    .max(500)
    .optional()
    .transform((value) => (value ? value : undefined)),
});

export type AdminUserCreateInput =
  | z.infer<typeof adminUserCreateSchema>
  | z.infer<typeof attendanceAdminUserCreateSchema>;
export type AdminUserUpdateInput =
  | z.infer<typeof adminUserUpdateSchema>
  | z.infer<typeof attendanceAdminUserUpdateSchema>;
export type AdminUserResetPasswordInput = z.infer<typeof adminUserResetPasswordSchema>;
export type VendorMaintenanceActivateInput = z.infer<typeof vendorMaintenanceActivateSchema>;
export type VendorMaintenanceDeactivateInput = z.infer<typeof vendorMaintenanceDeactivateSchema>;
