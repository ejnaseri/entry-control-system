import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import path from "node:path";
import express from "express";
import {
  AdminPermission,
  InboxCategory,
  InboxItemType,
  InboxScope,
  InboxSeverity,
  type InboxItem,
} from "@prisma/client";

const missingDotenvPath = path.join(__dirname, `.inbox-security-test-missing-${process.pid}.env`);
process.env["NODE_ENV"] = "test";
process.env["APP_EDITION"] = "FULL";
process.env["DATABASE_URL"] = "postgresql://inbox_security:inbox_security@127.0.0.1:1/inbox_security";
process.env["PORT"] = "4000";
process.env["LOG_LEVEL"] = "error";
process.env["DOTENV_CONFIG_PATH"] = missingDotenvPath;
process.env["DOTENV_CONFIG_QUIET"] = "true";

const { prisma } = require("../../lib/prisma") as typeof import("../../lib/prisma");
const { createInboxRouter } = require("./inbox.router") as typeof import("./inbox.router");
const { emitInboxItem } = require("./inbox.events") as typeof import("./inbox.events");
const { projectInboxItemForPermissions } = require("./inbox.projection") as typeof import("./inbox.projection");
const { attachInboxWebsocket } = require("./inbox.ws") as typeof import("./inbox.ws");
const { WebSocket } = require("ws") as { WebSocket: any };

const prismaAny = prisma as any;
const originalInboxCount = prismaAny.inboxItem.count;

function makeAuth(edition: "FULL" | "ATTENDANCE", permissions: AdminPermission[]) {
  return {
    edition,
    features: ["AUTH", "INBOX"],
    permissions,
    user: { id: "admin-1", username: "tester", role: "MANAGER" },
    session: {
      id: "session-1",
      createdAt: new Date(),
      lastSeenAt: new Date(),
      expiresAt: new Date(Date.now() + 60_000),
    },
    expiresAt: new Date(Date.now() + 60_000),
  } as any;
}

function makeItem(scope: InboxScope, actionPath: string): InboxItem {
  return {
    id: `${scope}-${actionPath}`,
    scope,
    category: InboxCategory.ALERT,
    type: InboxItemType.DEVICE_DENIED,
    severity: InboxSeverity.WARNING,
    title: "Safe alert",
    body: "Safe body",
    createdAt: new Date("2026-10-03T12:00:00.000Z"),
    readAt: null,
    entityType: null,
    entityId: null,
    actionPath,
    dedupeKey: null,
    deviceId: null,
    memberId: null,
  };
}

async function listen(server: Server) {
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Test server did not bind to TCP");
  return address.port;
}

async function closeServer(server: Server) {
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
}

async function testHttpPermissionBoundary() {
  prismaAny.inboxItem.count = async () => 0;
  const app = express();
  app.use((req, _res, next) => {
    const mode = req.get("x-test-auth");
    if (mode === "sign-in") req.auth = makeAuth("ATTENDANCE", [AdminPermission.SIGN_IN]);
    if (mode === "attendance") req.auth = makeAuth("ATTENDANCE", [AdminPermission.ATTENDANCE_VIEW]);
    next();
  });
  app.use("/api/v1/inbox", createInboxRouter("ATTENDANCE"));
  const server = createServer(app);
  const port = await listen(server);
  try {
    const url = `http://127.0.0.1:${port}/api/v1/inbox/unread-count`;
    assert.equal((await fetch(url)).status, 401);
    assert.equal((await fetch(url, { headers: { "x-test-auth": "sign-in" } })).status, 403);
    const allowed = await fetch(url, { headers: { "x-test-auth": "attendance" } });
    assert.equal(allowed.status, 200);
    assert.deepEqual(await allowed.json(), { alerts: 0, deviceFeed: 0, total: 0 });
  } finally {
    await closeServer(server);
  }

  const fullApp = express();
  fullApp.use((req, _res, next) => {
    if (req.get("x-test-auth") === "sign-in") {
      req.auth = makeAuth("FULL", [AdminPermission.SIGN_IN]);
    }
    next();
  });
  fullApp.use("/api/v1/inbox", createInboxRouter("FULL"));
  const fullServer = createServer(fullApp);
  const fullPort = await listen(fullServer);
  try {
    const fullUrl = `http://127.0.0.1:${fullPort}/api/v1/inbox/unread-count`;
    assert.equal((await fetch(fullUrl)).status, 401);
    assert.equal((await fetch(fullUrl, { headers: { "x-test-auth": "sign-in" } })).status, 200);
  } finally {
    await closeServer(fullServer);
  }
}

async function rejectedUpgradeStatus(url: string) {
  return new Promise<number>((resolve, reject) => {
    const socket = new WebSocket(url);
    socket.once("unexpected-response", (_request: unknown, response: { statusCode?: number; resume: () => void }) => {
      const status = response.statusCode ?? 0;
      response.resume();
      resolve(status);
    });
    socket.once("open", () => reject(new Error("Rejected WebSocket unexpectedly opened")));
    socket.once("error", () => undefined);
  });
}

async function openWebsocket(url: string) {
  return new Promise<{ socket: any; firstMessage: unknown }>((resolve, reject) => {
    const socket = new WebSocket(url);
    socket.once("error", reject);
    socket.once("message", (data: Buffer) => {
      resolve({ socket, firstMessage: JSON.parse(data.toString()) });
    });
  });
}

async function nextMessage(socket: any) {
  return new Promise<any>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("Timed out waiting for WebSocket message")), 1_000);
    socket.once("message", (data: Buffer) => {
      clearTimeout(timeout);
      resolve(JSON.parse(data.toString()));
    });
  });
}

async function testWebsocketBoundary() {
  const server = createServer((_req, res) => res.end("ok"));
  let enabled = false;
  let auth: any = null;
  const stop = attachInboxWebsocket(server, "ATTENDANCE", {
    isEnabled: () => enabled,
    resolveAuth: async () => auth,
  });
  const port = await listen(server);
  const url = `ws://127.0.0.1:${port}/ws/inbox`;
  try {
    assert.equal(await rejectedUpgradeStatus(url), 404);
    enabled = true;
    assert.equal(await rejectedUpgradeStatus(url), 401);
    auth = makeAuth("FULL", [AdminPermission.ATTENDANCE_VIEW]);
    assert.equal(await rejectedUpgradeStatus(url), 403);
    auth = makeAuth("ATTENDANCE", [AdminPermission.SIGN_IN]);
    assert.equal(await rejectedUpgradeStatus(url), 403);

    auth = makeAuth("ATTENDANCE", [AdminPermission.ATTENDANCE_VIEW]);
    const opened = await openWebsocket(url);
    assert.deepEqual(opened.firstMessage, { type: "WELCOME" });

    let crossScopeDelivered = false;
    const crossScopeListener = () => { crossScopeDelivered = true; };
    opened.socket.once("message", crossScopeListener);
    emitInboxItem(makeItem(InboxScope.FULL, "/members/customer-1"));
    await new Promise<void>((resolve) => setTimeout(resolve, 50));
    opened.socket.off("message", crossScopeListener);
    assert.equal(crossScopeDelivered, false, "FULL events must not reach Attendance sockets");

    const employeeMessagePromise = nextMessage(opened.socket);
    emitInboxItem(makeItem(InboxScope.ATTENDANCE, "/employees/staff-1"));
    const employeeMessage = await employeeMessagePromise;
    assert.equal(employeeMessage.type, "INBOX_ITEM_CREATED");
    assert.equal(employeeMessage.item.scope, InboxScope.ATTENDANCE);
    assert.equal(employeeMessage.item.actionPath, null, "MEMBERS_VIEW is required for Employee navigation");

    const entryLogMessagePromise = nextMessage(opened.socket);
    emitInboxItem(makeItem(InboxScope.ATTENDANCE, "/entry-logs"));
    const entryLogMessage = await entryLogMessagePromise;
    assert.equal(entryLogMessage.item.actionPath, "/entry-logs");
  } finally {
    await stop();
    assert.equal(server.listenerCount("upgrade"), 0, "stop must remove the upgrade listener");
    await closeServer(server);
  }
}

function testActionProjection() {
  const employee = makeItem(InboxScope.ATTENDANCE, "/employees/staff-1");
  const device = makeItem(InboxScope.ATTENDANCE, "/devices");
  const unknown = makeItem(InboxScope.ATTENDANCE, "/not-allowed");
  assert.equal(
    projectInboxItemForPermissions(employee, "ATTENDANCE", [AdminPermission.MEMBERS_VIEW]).actionPath,
    "/employees/staff-1"
  );
  assert.equal(
    projectInboxItemForPermissions(device, "ATTENDANCE", [AdminPermission.DEVICES_VIEW]).actionPath,
    "/devices"
  );
  assert.equal(projectInboxItemForPermissions(unknown, "ATTENDANCE", Object.values(AdminPermission)).actionPath, null);
}

async function main() {
  try {
    testActionProjection();
    await testHttpPermissionBoundary();
    await testWebsocketBoundary();
  } finally {
    prismaAny.inboxItem.count = originalInboxCount;
  }
  console.log("ok - Inbox HTTP/WebSocket enforce auth, permission, edition, scope and safe action paths");
}

main().catch((error: unknown) => {
  prismaAny.inboxItem.count = originalInboxCount;
  process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
  process.exitCode = 1;
});
