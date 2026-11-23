import type { IncomingMessage, Server } from "http";
import { AdminPermission, InboxScope } from "@prisma/client";
import { isFeatureEnabled } from "../../config/capabilities";
import { env, runtimeOptionalFeatureFlags, type AppEdition } from "../../config/env";
import { logger } from "../../config/logger";
import { getAuthSessionTokenFromCookieHeader } from "../auth/auth.cookies";
import { getCurrentAuth } from "../auth/auth.service";
import { onInboxItem } from "./inbox.events";
import { projectInboxItemForPermissions } from "./inbox.projection";

type InboxWebsocketAuth = NonNullable<Awaited<ReturnType<typeof getCurrentAuth>>>;

export type InboxWebsocketDependencies = Readonly<{
  resolveAuth: (request: IncomingMessage) => Promise<InboxWebsocketAuth | null>;
  isEnabled: (edition: AppEdition) => boolean;
}>;

const DEFAULT_DEPENDENCIES: InboxWebsocketDependencies = Object.freeze({
  resolveAuth: (request) => {
    const cookieHeader = Array.isArray(request.headers.cookie)
      ? request.headers.cookie[0]
      : request.headers.cookie;
    const userAgentHeader = request.headers["user-agent"];
    const userAgent = Array.isArray(userAgentHeader) ? userAgentHeader[0] : userAgentHeader;
    return getCurrentAuth(getAuthSessionTokenFromCookieHeader(cookieHeader), {
      ...(request.socket.remoteAddress ? { ipAddress: request.socket.remoteAddress } : {}),
      ...(userAgent ? { userAgent } : {}),
    });
  },
  isEnabled: (edition) => isFeatureEnabled(edition, "INBOX", runtimeOptionalFeatureFlags),
});

export function attachInboxWebsocket(
  server: Server,
  edition: AppEdition = env.APP_EDITION,
  dependencies: InboxWebsocketDependencies = DEFAULT_DEPENDENCIES
) {
  const { WebSocketServer } = require("ws") as { WebSocketServer: any };
  const wss = new WebSocketServer({ noServer: true }) as {
    on: (...args: any[]) => void;
    emit: (...args: any[]) => void;
    clients: Set<any>;
    handleUpgrade: (request: IncomingMessage, socket: any, head: Buffer, callback: (client: any) => void) => void;
    close: (callback: () => void) => void;
  };
  const expectedScope = edition === "ATTENDANCE" ? InboxScope.ATTENDANCE : InboxScope.FULL;
  const clientPermissions = new WeakMap<object, readonly AdminPermission[]>();
  let stopped = false;

  wss.on("connection", (socket: any, _request: IncomingMessage, auth: InboxWebsocketAuth) => {
    clientPermissions.set(socket, auth.permissions);
    socket.send(JSON.stringify({ type: "WELCOME" }));
  });

  const handleUpgrade = (request: IncomingMessage, socket: any, head: Buffer) => {
    if (getRequestPathname(request) !== "/ws/inbox") return;
    void authorizeUpgrade(request, edition, dependencies)
      .then((auth) => {
        if (stopped) {
          socket.destroy();
          return;
        }
        if (!auth.ok) {
          rejectUpgrade(socket, auth.status, auth.message);
          return;
        }
        wss.handleUpgrade(request, socket, head, (client) => {
          wss.emit("connection", client, request, auth.auth);
        });
      })
      .catch((error) => {
        logger.error("Inbox websocket authorization failed", { message: (error as Error).message });
        rejectUpgrade(socket, 500, "Internal Server Error");
      });
  };
  server.on("upgrade", handleUpgrade);

  const unsubscribe = onInboxItem((item) => {
    if (item.scope !== expectedScope) return;
    wss.clients.forEach((client: any) => {
      if (client.readyState !== 1) return;
      const projected = projectInboxItemForPermissions(
        item,
        edition,
        clientPermissions.get(client) ?? []
      );
      client.send(JSON.stringify({ type: "INBOX_ITEM_CREATED", item: projected }));
    });
  });

  logger.info("Inbox websocket attached", { path: "/ws/inbox", edition, scope: expectedScope });
  return () => new Promise<void>((resolve) => {
    if (stopped) {
      resolve();
      return;
    }
    stopped = true;
    server.off("upgrade", handleUpgrade);
    unsubscribe();
    wss.clients.forEach((client: any) => client.terminate?.());
    wss.close(resolve);
  });
}

async function authorizeUpgrade(
  request: IncomingMessage,
  edition: AppEdition,
  dependencies: InboxWebsocketDependencies
): Promise<
  | { ok: true; auth: InboxWebsocketAuth }
  | { ok: false; status: number; message: string }
> {
  if (!dependencies.isEnabled(edition)) {
    return { ok: false, status: 404, message: "Not Found" };
  }
  const auth = await dependencies.resolveAuth(request);
  if (!auth) {
    return { ok: false, status: 401, message: "Unauthorized" };
  }
  if (auth.edition !== edition) {
    return { ok: false, status: 403, message: "Edition mismatch" };
  }
  const requiredPermission = edition === "ATTENDANCE"
    ? AdminPermission.ATTENDANCE_VIEW
    : AdminPermission.SIGN_IN;
  if (!auth.permissions.includes(requiredPermission)) {
    return { ok: false, status: 403, message: "Forbidden" };
  }
  return { ok: true, auth };
}

function getRequestPathname(request: IncomingMessage) {
  try {
    return new URL(request.url ?? "", "http://localhost").pathname;
  } catch {
    return "";
  }
}

function rejectUpgrade(socket: any, status: number, message: string) {
  if (socket.destroyed) return;
  socket.write(
    `HTTP/1.1 ${status} ${message}\r\nConnection: close\r\nContent-Type: text/plain; charset=utf-8\r\nContent-Length: ${Buffer.byteLength(message)}\r\n\r\n${message}`
  );
  socket.destroy();
}
