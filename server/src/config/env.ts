import "dotenv/config";
import { z } from "zod";
import { APP_EDITIONS, type AppEdition } from "../shared/app-identity";
import { ATTENDANCE_AUTO_CHECKOUT_SETTINGS } from "../shared/attendance-auto-checkout";
import { ATTENDANCE_POLICIES } from "../shared/attendance-policy";
import { DEFAULT_APP_TIMEZONE, isValidAppTimezone } from "../shared/app-timezone";
import {
  DEFAULT_OPTIONAL_FEATURE_FLAGS,
  type OptionalFeatureFlags,
} from "./capabilities";

const appEditionSchema = z.enum(APP_EDITIONS);

export type { AppEdition };

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  APP_EDITION: appEditionSchema.default("FULL"),
  APP_TIMEZONE: z.string().refine(isValidAppTimezone, "APP_TIMEZONE must be a valid IANA time zone").default(DEFAULT_APP_TIMEZONE),
  ATTENDANCE_POLICY: z.enum(ATTENDANCE_POLICIES).default("TIME_CLOCK"),
  ATTENDANCE_AUTO_CHECKOUT_ENABLED: z.enum(ATTENDANCE_AUTO_CHECKOUT_SETTINGS).default("0"),
  APP_FEATURE_INBOX: z.enum(["0", "1"]).default("0"),
  PORT: z.coerce.number().int().positive().max(65535).default(4000),
  DATABASE_URL: z.string().url(),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
  SHADOW_DATABASE_URL: z.string().url().optional(),
  ZKTECO_HOST: z.string().optional(),
  ZKTECO_PORT: z.coerce.number().int().positive().max(65535).optional(),
  ZKTECO_PASS: z.string().optional(),
  ZKTECO_POLL_INTERVAL_MS: z.coerce.number().int().positive().default(5000),
  DOOR_RELAY_HOST: z.string().optional(),
  DOOR_RELAY_PORT: z.coerce.number().int().positive().max(65535).optional(),
  DOOR_RELAY_PATH: z.string().optional(),
  DOOR_OPEN_SECONDS: z.coerce.number().positive().optional(),
  AUTH_COOKIE_NAME: z.string().min(1).default("ecs_session"),
  AUTH_SESSION_HOURS: z.coerce.number().positive().max(168).default(12),
  CLIENT_ORIGIN: z.string().optional(),
  ATLASGYM_BACKUP_ROOT: z.string().optional(),
  ATLASGYM_PG_DUMP_PATH: z.string().optional(),
  ATLASGYM_CREATEDB_PATH: z.string().optional(),
  ATLASGYM_DROPDB_PATH: z.string().optional(),
  ATLASGYM_PG_RESTORE_PATH: z.string().optional(),
  ATLASGYM_PSQL_PATH: z.string().optional(),
  ATLASGYM_BACKUP_TIMEOUT_MS: z.coerce.number().int().positive().default(15 * 60 * 1000),
});

export type AppEnv = z.infer<typeof envSchema>;

export function parseEnv(source: NodeJS.ProcessEnv): AppEnv {
  return envSchema.parse(source);
}

export const env = parseEnv(process.env);

export const runtimeOptionalFeatureFlags: OptionalFeatureFlags = Object.freeze({
  ...DEFAULT_OPTIONAL_FEATURE_FLAGS,
  APP_FEATURE_INBOX: env.APP_FEATURE_INBOX === "1",
});

// Node's local Date operations power attendance day/shift boundaries. Keep the
// host timezone from silently changing business dates between installations.
process.env["TZ"] = env.APP_TIMEZONE;

export const isProduction = env.NODE_ENV === "production";
