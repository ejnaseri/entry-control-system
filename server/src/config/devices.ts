import { env } from "./env";

export type ZktecoConfig =
  | {
      enabled: true;
      host: string;
      port: number;
      password?: string;
      pollIntervalMs: number;
    }
  | {
      enabled: false;
    };

export const zktecoConfig: ZktecoConfig = env.ZKTECO_HOST
  ? {
      enabled: true,
      host: env.ZKTECO_HOST,
      port: env.ZKTECO_PORT ?? 4370,
      ...(env.ZKTECO_PASS ? { password: env.ZKTECO_PASS } : {}),
      pollIntervalMs: env.ZKTECO_POLL_INTERVAL_MS,
    }
  : { enabled: false };
