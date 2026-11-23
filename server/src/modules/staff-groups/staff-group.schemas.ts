import { SalaryType } from "@prisma/client";
import { z } from "zod";

const emptyToUndefined = (value: unknown) => (value === "" || value === null ? undefined : value);
const timeRegex = /^([01]\d|2[0-3]):[0-5]\d$/;
const allWeekdays = [0, 1, 2, 3, 4, 5, 6];
const toMinutes = (value: string) => {
  const [hoursPart = "0", minutesPart = "0"] = value.split(":");
  const hours = Number(hoursPart);
  const minutes = Number(minutesPart);
  return hours * 60 + minutes;
};

const shiftTemplateSchema = z
  .object({
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
  })
  .refine(({ shiftStart, shiftEnd }) => toMinutes(shiftEnd) !== toMinutes(shiftStart), {
    message: "End time must be different from start time",
    path: ["shiftEnd"],
  });

export const staffGroupCreateSchema = z.object({
  name: z.string().min(2, "Group name is required"),
  description: z.preprocess(emptyToUndefined, z.string().max(500).optional()),
  accessLevel: z.preprocess(emptyToUndefined, z.string().max(120).optional()),
  shifts: z.array(shiftTemplateSchema).min(1, "Add at least one shift"),
});

export const staffGroupUpdateSchema = staffGroupCreateSchema;

export const staffGroupIdParamSchema = z.object({
  id: z.string().cuid("Invalid staff group id"),
});

export type StaffGroupInput = z.infer<typeof staffGroupCreateSchema>;
