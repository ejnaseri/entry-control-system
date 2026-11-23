import { Gender, MemberRoleType, MemberStatus, OvertimeRateType, SalaryType, MemberType } from "@prisma/client";
import { z } from "zod";
import type { CustomerFormPayload, MemberWizardPayload } from "../../shared/member.types";

const emptyToUndefined = (value: unknown) => (value === "" || value === null ? undefined : value);
const timeRegex = /^([01]\d|2[0-3]):[0-5]\d$/;
const allWeekdays = [0, 1, 2, 3, 4, 5, 6];

const toMinutes = (value: string) => {
  const [hoursPart = "0", minutesPart = "0"] = value.split(":");
  const hours = Number(hoursPart);
  const minutes = Number(minutesPart);
  return hours * 60 + minutes;
};

const timeRangeSchema = z
  .object({
    from: z.string().regex(timeRegex, "Use HH:mm format"),
    to: z.string().regex(timeRegex, "Use HH:mm format"),
  })
  .refine(({ from, to }) => toMinutes(to) > toMinutes(from), {
    message: "End time must be after start time",
    path: ["to"],
  });

const dayAccessSchema = z.object({
  weekday: z.number().int().min(0).max(6),
  ranges: z.array(timeRangeSchema).min(1, "Add at least one time range"),
});

const accessPolicySchema = z
  .object({
    allowedDays: z.array(z.number().int().min(0).max(6)).min(1, "Pick at least one day"),
    allowedTimeRanges: z.array(dayAccessSchema).default([]),
  })
  .superRefine((value, ctx) => {
    const allowed = new Set(value.allowedDays);
    value.allowedTimeRanges.forEach((entry, index) => {
      if (!allowed.has(entry.weekday)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["allowedTimeRanges", index, "weekday"],
          message: "Weekday must be part of allowed days",
        });
      }
    });
  });

const overtimePolicySchema = z
  .object({
    allowOvertime: z.boolean(),
    overtimeRateType: z.nativeEnum(OvertimeRateType).optional(),
    overtimeAmount: z.number().min(0).optional(),
    maxOvertimePerDay: z.number().min(0).optional(),
  })
  .superRefine((value, ctx) => {
    if (value.allowOvertime) {
      if (!value.overtimeRateType) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["overtimeRateType"],
          message: "Choose an overtime rate type",
        });
      }
      if (value.overtimeAmount === undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["overtimeAmount"],
          message: "Overtime amount is required",
        });
      }
    }
  });

const shiftSchema = z.object({
  id: z.string().cuid().optional(),
  shiftName: z.string().min(1, "Shift name is required"),
  shiftStart: z.string().regex(timeRegex, "Use HH:mm format"),
  shiftEnd: z.string().regex(timeRegex, "Use HH:mm format"),
  weekdays: z.array(z.number().int().min(0).max(6)).min(1).default(allWeekdays),
  graceMinutes: z.number().int().min(0).default(0),
  earlyAccessMinutes: z.number().int().min(0).max(120).default(15),
  salaryType: z.nativeEnum(SalaryType),
  salaryAmount: z.number().min(0),
  isActive: z.boolean().default(true),
});

const extraShiftSchema = z.object({
  shiftId: z.string().cuid("Invalid shift id"),
  rateOverride: z.number().nonnegative().optional(),
  isActive: z.boolean().default(true).optional(),
});

const memberRoleSchema = z.object({
  roleType: z.nativeEnum(MemberRoleType),
  isStaff: z.boolean(),
  customTitle: z.preprocess(emptyToUndefined, z.string().max(120).optional()),
});

const fingerIdSchema = z
  .preprocess((value) => (value === "" ? null : value), z.union([z.number().int().min(0).max(9), z.null()]))
  .optional();

const baseMemberSchema = z.object({
  memberType: z.nativeEnum(MemberType),
  code: z
    .string()
    .min(1, "Member code is required")
    .regex(/^\d+$/, "Use numeric device user ID"),
  fingerId: fingerIdSchema,
  firstName: z.string().min(1, "firstName is required"),
  lastName: z.preprocess(emptyToUndefined, z.string().optional()),
  fatherName: z.preprocess(emptyToUndefined, z.string().optional()),
  phone: z.preprocess(emptyToUndefined, z.string().min(6).max(20).optional()),
  email: z.preprocess(emptyToUndefined, z.string().email().optional()),
  gender: z.nativeEnum(Gender).optional(),
  birthDate: z.preprocess(emptyToUndefined, z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD").optional()),
  nationalId: z.preprocess(emptyToUndefined, z.string().optional()),
  photoUrl: z.preprocess(emptyToUndefined, z.string().optional()),
  status: z.nativeEnum(MemberStatus).optional(),
  notes: z.preprocess(emptyToUndefined, z.string().optional()),
});

const staffGroupIdSchema = z.preprocess(emptyToUndefined, z.string().cuid("Invalid staff group id").optional());

const memberWizardBaseSchema = baseMemberSchema.extend({
  role: memberRoleSchema,
  access: accessPolicySchema,
  overtime: overtimePolicySchema,
  shifts: z.array(shiftSchema).default([]),
  extraShifts: z.array(extraShiftSchema).default([]),
});

const customerMembershipSchema = z.object({
  planId: z.string().cuid("Invalid plan id"),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  price: z.number().nonnegative(),
  discount: z.number().nonnegative().optional().default(0),
  paidAmount: z.number().nonnegative().optional().default(0),
  status: z.nativeEnum(MemberStatus).default(MemberStatus.ACTIVE),
});

const customerAccessSchema = accessPolicySchema.and(
  z.object({
  maxEntriesPerDay: z.number().int().min(1).optional(),
  })
);

export const customerWizardSchema = memberWizardBaseSchema.extend({
  memberType: z.literal(MemberType.CUSTOMER),
  membership: customerMembershipSchema,
  customerAccess: customerAccessSchema,
  totalPaidAmount: z.number().int().optional(),
  totalDebtAmount: z.number().int().optional(),
});

export const staffWizardSchema = memberWizardBaseSchema
  .extend({
    memberType: z.literal(MemberType.STAFF),
    staffGroupId: staffGroupIdSchema,
  })
  .superRefine((value, ctx) => {
    const hasGroup = Boolean(value.staffGroupId);
    const hasShifts = Array.isArray(value.shifts) && value.shifts.length > 0;
    const hasExtra = Array.isArray(value.extraShifts) && value.extraShifts.length > 0;
    if (!hasGroup && !hasShifts && !hasExtra) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Select a staff group or add at least one shift",
        path: ["staffGroupId"],
      });
    }
  });

export const memberWizardSchemaUnion = z.union([staffWizardSchema, customerWizardSchema]);
export const memberWizardSchema = memberWizardSchemaUnion;

export type MemberWizardInput = (z.infer<typeof staffWizardSchema> | z.infer<typeof customerWizardSchema>) & MemberWizardPayload;
export type CustomerWizardInput = z.infer<typeof customerWizardSchema> & CustomerFormPayload;

export const listMembersQuerySchema = z.object({
  status: z.nativeEnum(MemberStatus).optional(),
  memberType: z.nativeEnum(MemberType).optional(),
  search: z.string().optional(),
  take: z.coerce.number().min(1).max(100).default(25),
  skip: z.coerce.number().min(0).default(0),
});

export type ListMemberQuery = z.infer<typeof listMembersQuerySchema>;

export const memberIdParamSchema = z.object({
  id: z.string().cuid("Invalid member id"),
});

export const memberPaymentCreateSchema = z.object({
  membershipId: z.preprocess(emptyToUndefined, z.string().cuid("Invalid membership id").optional()),
  amount: z.number().positive("Payment amount must be greater than 0"),
  paidAt: z.preprocess(emptyToUndefined, z.string().optional()),
  notes: z.preprocess(emptyToUndefined, z.string().max(500).optional()),
});

export type MemberPaymentCreateInput = z.infer<typeof memberPaymentCreateSchema>;

export const memberMembershipRenewSchema = z.object({
  planId: z.string().cuid("Invalid plan id"),
  periods: z.coerce.number().int().min(1).max(24).default(1),
  paidAmount: z.coerce.number().min(0).optional(),
  paidAt: z.preprocess(emptyToUndefined, z.string().optional()),
  notes: z.preprocess(emptyToUndefined, z.string().max(500).optional()),
});

export type MemberMembershipRenewInput = z.infer<typeof memberMembershipRenewSchema>;

export const memberMembershipCancelParamSchema = z.object({
  id: z.string().cuid("Invalid member id"),
  membershipId: z.string().cuid("Invalid membership id"),
});

export const memberMembershipCancelSchema = z.object({
  refundAt: z.preprocess(emptyToUndefined, z.string().optional()),
  notes: z.preprocess(emptyToUndefined, z.string().max(500).optional()),
});

export type MemberMembershipCancelInput = z.infer<typeof memberMembershipCancelSchema>;

export const memberShiftAssignSchema = z.object({
  staffGroupId: staffGroupIdSchema.optional(),
  extraShifts: z.array(extraShiftSchema).default([]),
  shifts: z.array(shiftSchema).default([]),
});
