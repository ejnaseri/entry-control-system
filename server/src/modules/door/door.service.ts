import { env } from "../../config/env";
import { logger } from "../../config/logger";
import type { DoorOpenOptions } from "./door.types";

const REQUEST_TIMEOUT_MS = 5000;

function buildRelayUrl(host: string, seconds?: number): string {
  const base = host.startsWith("http://") || host.startsWith("https://") ? host : `http://${host}`;
  const url = new URL(base);

  if (env.DOOR_RELAY_PORT) {
    url.port = String(env.DOOR_RELAY_PORT);
  }

  const path = env.DOOR_RELAY_PATH ?? "/open";
  url.pathname = path.startsWith("/") ? path : `/${path}`;

  if (seconds) {
    url.searchParams.set("seconds", String(seconds));
  }

  return url.toString();
}

export async function openDoor(options: DoorOpenOptions = {}): Promise<void> {
  const host = env.DOOR_RELAY_HOST;
  if (!host) {
    logger.debug("Door relay host not configured; skipping door open", { memberId: options.memberId });
    return;
  }

  const seconds = options.seconds ?? env.DOOR_OPEN_SECONDS;
  const url = buildRelayUrl(host, seconds);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        seconds,
        memberId: options.memberId,
        reason: options.reason ?? "authorized",
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`Door relay responded with ${res.status} ${res.statusText}${body ? `: ${body}` : ""}`);
    }

    logger.info("Door relay triggered", { url, seconds, memberId: options.memberId });
  } catch (error) {
    logger.error("Failed to trigger door relay", {
      url,
      memberId: options.memberId,
      message: (error as Error).message,
    });
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
