import { Gender, MemberRoleType, MemberStatus } from "@prisma/client";
import { z } from "zod";

const emptyToUndefined = (value: unknown) => (value === "" || value === null ? undefined : value);
const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/u;
const datePattern = /^\d{4}-\d{2}-\d{2}$/u;
const allWeekdays = [0, 1, 2, 3, 4, 5, 6];

function toMinutes(value: string) {
  const [hours = "0", minutes = "0"] = value.split(":");
  return Number(hours) * 60 + Number(minutes);
}

const employeeStatusSchema = z.union([z.literal(MemberStatus.ACTIVE), z.literal(MemberStatus.BLOCKED)]);

const timeRangeSchema = z
  .object({
    from: z.string().regex(timePattern, "Use HH:mm format"),
    to: z.string().regex(timePattern, "Use HH:mm format"),
  })
  .strict()
  .refine(({ from, to }) => toMinutes(to) > toMinutes(from), {
    message: "End time must be after start time",
    path: ["to"],
  });

const dayAccessSchema = z
  .object({
    weekday: z.number().int().min(0).max(6),
    ranges: z.array(timeRangeSchema).min(1, "Add at least one time range"),
  })
  .strict();

const accessSchema = z
  .object({
    allowedDays: z.array(z.number().int().min(0).max(6)).min(1, "Pick at least one day"),
    allowedTimeRanges: z.array(dayAccessSchema).default([]),
  })
  .strict()
  .superRefine((value, context) => {
    const allowedDays = new Set(value.allowedDays);
    value.allowedTimeRanges.forEach((entry, index) => {
      if (!allowedDays.has(entry.weekday)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["allowedTimeRanges", index, "weekday"],
          message: "Weekday must be part of allowed days",
        });
      }
    });
  });

const overtimeSchema = z
  .object({
    allowOvertime: z.boolean(),
    maxOvertimePerDay: z.number().min(0).optional(),
  })
  .strict();

const employeeShiftSchema = z
  .object({
    shiftName: z.string().min(1, "Shift name is required"),
    shiftStart: z.string().regex(timePattern, "Use HH:mm format"),
    shiftEnd: z.string().regex(timePattern, "Use HH:mm format"),
    weekdays: z.array(z.number().int().min(0).max(6)).min(1).default(allWeekdays),
    graceMinutes: z.number().int().min(0).default(0),
    earlyAccessMinutes: z.number().int().min(0).max(120).default(15),
    isActive: z.boolean().default(true),
  })
  .strict();

const extraShiftSchema = z
  .object({
    shiftId: z.string().cuid("Invalid shift id"),
    isActive: z.boolean().default(true),
  })
  .strict();

const roleSchema = z
  .object({
    roleType: z.nativeEnum(MemberRoleType),
    customTitle: z.preprocess(emptyToUndefined, z.string().max(120).optional()),
  })
  .strict();

const profileSchema = z
  .object({
    position: z.preprocess(emptyToUndefined, z.string().max(120).optional()),
    department: z.preprocess(emptyToUndefined, z.string().max(120).optional()),
    systemRole: z.preprocess(emptyToUndefined, z.string().max(120).optional()),
  })
  .strict()
  .default({});

const staffGroupIdSchema = z.preprocess(emptyToUndefined, z.string().cuid("Invalid staff group id").optional());
const employeeCodeSchema = z.string().min(1, "Employee code is required").regex(/^\d+$/u, "Use numeric employee code");

const employeePayloadShape = {
  code: employeeCodeSchema,
  firstName: z.string().min(1, "firstName is required"),
  lastName: z.preprocess(emptyToUndefined, z.string().optional()),
  fatherName: z.preprocess(emptyToUndefined, z.string().optional()),
  phone: z.preprocess(emptyToUndefined, z.string().min(6).max(20).optional()),
  email: z.preprocess(emptyToUndefined, z.string().email().optional()),
  gender: z.nativeEnum(Gender).optional(),
  birthDate: z.preprocess(emptyToUndefined, z.string().regex(datePattern, "Use YYYY-MM-DD").optional()),
  nationalId: z.preprocess(emptyToUndefined, z.string().max(120).optional()),
  photoUrl: z.preprocess(emptyToUndefined, z.string().max(2_048).optional()),
  status: employeeStatusSchema.default(MemberStatus.ACTIVE),
  notes: z.preprocess(emptyToUndefined, z.string().max(2_000).optional()),
  role: roleSchema,
  profile: profileSchema,
  access: accessSchema,
  overtime: overtimeSchema,
  staffGroupId: staffGroupIdSchema,
  shifts: z.array(employeeShiftSchema).default([]),
  extraShifts: z.array(extraShiftSchema).default([]),
} as const;

function requireSchedule(
  value: { staffGroupId?: string | undefined; shifts: readonly unknown[]; extraShifts: readonly unknown[] },
  context: z.RefinementCtx
) {
  if (!value.staffGroupId && value.shifts.length === 0 && value.extraShifts.length === 0) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Select a staff group or add at least one shift",
      path: ["staffGroupId"],
    });
  }
}

export const employeeCreateSchema = z
  .object(employeePayloadShape)
  .strict()
  .superRefine(requireSchedule);

export const employeeUpdateSchema = z.object(employeePayloadShape).strict().superRefine(requireSchedule);

export const employeeShiftAssignmentSchema = z
  .object({
    staffGroupId: staffGroupIdSchema,
    shifts: z.array(employeeShiftSchema).default([]),
    extraShifts: z.array(extraShiftSchema).default([]),
  })
  .strict();

export const employeeArchiveSchema = z.object({ archived: z.boolean() }).strict();

export const employeeIdParamSchema = z.object({ id: z.string().cuid("Invalid employee id") }).strict();

const queryBooleanSchema = z.preprocess((value) => {
  if (value === undefined) return false;
  if (value === "true" || value === true) return true;
  if (value === "false" || value === false) return false;
  return value;
}, z.boolean());

export const listEmployeesQuerySchema = z
  .object({
    status: employeeStatusSchema.optional(),
    staffGroupId: staffGroupIdSchema,
    search: z.preprocess(emptyToUndefined, z.string().max(200).optional()),
    includeArchived: queryBooleanSchema,
    take: z.coerce.number().int().min(1).max(100).default(25),
    skip: z.coerce.number().int().min(0).default(0),
  })
  .strict();

export type EmployeeCreateInput = z.infer<typeof employeeCreateSchema>;
export type EmployeeUpdateInput = z.infer<typeof employeeUpdateSchema>;
export type EmployeeShiftAssignmentInput = z.infer<typeof employeeShiftAssignmentSchema>;
export type EmployeeArchiveInput = z.infer<typeof employeeArchiveSchema>;
export type ListEmployeesQuery = z.infer<typeof listEmployeesQuerySchema>;
