import { z } from "zod";
import { DeviceConnectionType, DeviceRawLogStatus, DeviceStatus, DeviceType } from "@prisma/client";

const hostRegex = /^[a-zA-Z0-9.-]+$/;
const ipv4Regex =
  /^(25[0-5]|2[0-4]\d|1?\d?\d)(\.(25[0-5]|2[0-4]\d|1?\d?\d)){3}$/;
const ipv6Regex = /^(([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}|::1)$/;

const hostSchema = z
  .string()
  .min(1, "Host is required")
  .refine((value) => ipv4Regex.test(value) || ipv6Regex.test(value) || hostRegex.test(value), {
    message: "Enter a valid IP or hostname",
  });

const eventModeSchema = z.enum(["PULL", "PUSH", "AUTO"]).default("PULL");

const networkConfigSchema = z.object({
  ip: hostSchema,
  port: z.number().int().min(1).max(65535),
  dns: hostSchema.optional(),
  gateway: z.string().optional(),
  subnet: z.string().optional(),
  timeoutMs: z.number().int().min(100).max(30000).optional(),
  pollIntervalMs: z.number().int().min(500).max(120000).optional(),
  protocol: z.string().min(2).max(60).optional(),
  eventMode: eventModeSchema.optional(),
  pushEnabled: z.boolean().optional(),
});

const usbConfigSchema = z.object({
  vendorId: z.string().min(2, "Vendor ID is required"),
  productId: z.string().min(2, "Product ID is required"),
  driver: z.string().optional(),
  timeoutMs: z.number().int().min(100).max(30000).optional(),
});

const serialConfigSchema = z.object({
  comPort: z.string().min(2, "COM port is required"),
  baudRate: z.number().int().min(1200).max(1000000),
  parity: z.enum(["none", "even", "odd", "mark", "space"]).optional(),
  stopBits: z.number().int().min(1).max(2).optional(),
  dataBits: z.number().int().min(5).max(8).optional(),
  timeoutMs: z.number().int().min(100).max(30000).optional(),
});

const zktecoConfigSchema = networkConfigSchema.extend({
  password: z.string().optional(),
  pollIntervalMs: z.number().int().min(500).max(120000).optional(),
});

const configSchemas: Record<DeviceConnectionType, z.ZodTypeAny> = {
  [DeviceConnectionType.NETWORK]: networkConfigSchema,
  [DeviceConnectionType.USB]: usbConfigSchema,
  [DeviceConnectionType.SERIAL]: serialConfigSchema,
  [DeviceConnectionType.ZKTECO_PULL_SDK]: zktecoConfigSchema,
};

const baseDeviceSchema = z.object({
  name: z.string().min(2, "Name is required"),
  type: z.nativeEnum(DeviceType),
  connectionType: z.nativeEnum(DeviceConnectionType),
  enabled: z.boolean().default(true),
  model: z.string().optional(),
  serialNumber: z.string().optional(),
  config: z.unknown(),
});

const refinedDeviceSchema = baseDeviceSchema.superRefine((value, ctx) => {
  const schema = configSchemas[value.connectionType];
  if (!schema) return;
  const parsed = schema.safeParse(value.config ?? {});
  if (!parsed.success) {
    parsed.error.issues.forEach((issue) => {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: issue.message,
        path: ["config", ...(issue.path ?? [])],
      });
    });
  }
});

export const deviceCreateSchema = refinedDeviceSchema;

export const deviceUpdateSchema = refinedDeviceSchema.and(z.object({
  status: z.nativeEnum(DeviceStatus).optional(),
}));

export const deviceIdParamSchema = z.object({
  id: z.string().cuid("Invalid device id"),
});

const enrollUserIdSchema = z
  .union([z.string(), z.number()])
  .transform((value) => String(value).trim())
  .refine((value) => value.length > 0, { message: "User ID is required" });

export const deviceEnrollSchema = z.object({
  userId: enrollUserIdSchema,
  fingerId: z.number().int().min(0).max(9).optional(),
  name: z.string().trim().min(1).max(24).optional(),
});

const deviceUserIdSchema = z
  .union([z.string(), z.number()])
  .transform((value) => String(value).trim())
  .refine((value) => value.length > 0, { message: "User ID is required" });

export const deviceUserUpsertSchema = z.object({
  userId: deviceUserIdSchema,
  name: z.string().trim().min(1).max(24),
});

export const deviceUserDeleteSchema = z.object({
  userId: deviceUserIdSchema,
});

export const strictDeviceUserDeleteSchema = deviceUserDeleteSchema
  .extend({ confirm: z.literal(true) })
  .strict();

export const deviceTimeUpdateSchema = z.object({
  timestamp: z.string().datetime().optional(),
});

export const deviceUnlockSchema = z.object({
  seconds: z.coerce.number().int().min(1).max(60).optional(),
});

export const deviceLogsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).optional(),
});

const optionalQueryString = (max: number) =>
  z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    z.string().trim().max(max).optional()
  );

export const deviceRawLogsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  deviceId: z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    z.string().cuid("Invalid device id").optional()
  ),
  status: z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    z.nativeEnum(DeviceRawLogStatus).optional()
  ),
  from: optionalQueryString(40),
  to: optionalQueryString(40),
  search: optionalQueryString(120),
});

export const deviceRawLogSupportBundleQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(1000).default(500),
  language: z.enum(["en", "fa", "ps"]).default("en"),
  deviceId: z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    z.string().cuid("Invalid device id").optional()
  ),
  status: z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    z.nativeEnum(DeviceRawLogStatus).optional()
  ),
  from: optionalQueryString(40),
  to: optionalQueryString(40),
  search: optionalQueryString(120),
});

export const deviceFilterSchema = z.object({
  type: z.nativeEnum(DeviceType).optional(),
  connectionType: z.nativeEnum(DeviceConnectionType).optional(),
  status: z.nativeEnum(DeviceStatus).optional(),
  enabled: z.coerce.boolean().optional(),
  search: z.string().optional(),
});

export type DeviceCreateInput = z.infer<typeof deviceCreateSchema>;
export type DeviceUpdateInput = z.infer<typeof deviceUpdateSchema>;
export type DeviceFilterInput = z.infer<typeof deviceFilterSchema>;

export function sanitizeConfig(connectionType: DeviceConnectionType, rawConfig: unknown) {
  const schema = configSchemas[connectionType];
  if (!schema) {
    return rawConfig;
  }
  const parsed = schema.parse(rawConfig ?? {}) as Record<string, unknown>;
  const timeoutRaw = parsed["timeoutMs"];
  const pollIntervalRaw = parsed["pollIntervalMs"];
  const timeoutMs = typeof timeoutRaw === "number" ? timeoutRaw : 3000;
  const pollIntervalMs = typeof pollIntervalRaw === "number" ? pollIntervalRaw : undefined;

  return {
    ...parsed,
    timeoutMs,
    ...(pollIntervalMs ? { pollIntervalMs } : {}),
  };
}
