import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  InboxCategory,
  InboxItemType,
  InboxScope,
  InboxSeverity,
} from "@prisma/client";

const TEST_DATABASE_URL = "postgresql://inbox_scope_test:inbox_scope_test@127.0.0.1:1/inbox_scope_test";
const missingDotenvPath = path.join(__dirname, `.inbox-scope-test-missing-${process.pid}.env`);

process.env["NODE_ENV"] = "test";
process.env["APP_EDITION"] = "FULL";
process.env["DATABASE_URL"] = TEST_DATABASE_URL;
process.env["PORT"] = "4000";
process.env["LOG_LEVEL"] = "error";
process.env["DOTENV_CONFIG_PATH"] = missingDotenvPath;
process.env["DOTENV_CONFIG_QUIET"] = "true";

const { prisma } = require("../../lib/prisma") as typeof import("../../lib/prisma");
const {
  createInboxItem,
  getUnreadCounts,
  listInboxItems,
  markInboxItemRead,
  markInboxItemsRead,
  markInboxItemsReadBulk,
} = require("./inbox.service") as typeof import("./inbox.service");
const { inboxListQuerySchema } = require("./inbox.schemas") as typeof import("./inbox.schemas");

const prismaForTest = prisma as any;
const originalMethods = {
  findMany: prismaForTest.inboxItem.findMany,
  count: prismaForTest.inboxItem.count,
  update: prismaForTest.inboxItem.update,
  updateMany: prismaForTest.inboxItem.updateMany,
  findUnique: prismaForTest.inboxItem.findUnique,
  create: prismaForTest.inboxItem.create,
};

const calls = {
  findMany: [] as any[],
  count: [] as any[],
  update: [] as any[],
  updateMany: [] as any[],
  findUnique: [] as any[],
  create: [] as any[],
};

function resetCalls() {
  for (const entries of Object.values(calls)) entries.length = 0;
}

function installMocks() {
  prismaForTest.inboxItem.findMany = async (input: any) => {
    calls.findMany.push(input);
    return [];
  };
  prismaForTest.inboxItem.count = async (input: any) => {
    calls.count.push(input);
    return calls.count.length;
  };
  prismaForTest.inboxItem.update = async (input: any) => {
    calls.update.push(input);
    return { id: input.where.id, scope: input.where.scope, readAt: input.data.readAt };
  };
  prismaForTest.inboxItem.updateMany = async (input: any) => {
    calls.updateMany.push(input);
    return { count: 1 };
  };
  prismaForTest.inboxItem.findUnique = async (input: any) => {
    calls.findUnique.push(input);
    return null;
  };
  prismaForTest.inboxItem.create = async (input: any) => {
    calls.create.push(input);
    return { id: `inbox-${calls.create.length}`, readAt: null, ...input.data };
  };
}

function restoreMocks() {
  prismaForTest.inboxItem.findMany = originalMethods.findMany;
  prismaForTest.inboxItem.count = originalMethods.count;
  prismaForTest.inboxItem.update = originalMethods.update;
  prismaForTest.inboxItem.updateMany = originalMethods.updateMany;
  prismaForTest.inboxItem.findUnique = originalMethods.findUnique;
  prismaForTest.inboxItem.create = originalMethods.create;
}

async function assertListAndCountIsolation() {
  resetCalls();
  const query = inboxListQuerySchema.parse({
    category: "ALERT",
    unreadOnly: "true",
    search: "device",
  });

  await listInboxItems(query, InboxScope.ATTENDANCE);
  assert.equal(calls.findMany.length, 1);
  assert.equal(calls.count.length, 1);
  assert.deepEqual(calls.findMany[0].where, {
    scope: InboxScope.ATTENDANCE,
    category: InboxCategory.ALERT,
    readAt: null,
    OR: [
      { title: { contains: "device", mode: "insensitive" } },
      { body: { contains: "device", mode: "insensitive" } },
    ],
  });
  assert.deepEqual(calls.count[0].where, calls.findMany[0].where);

  resetCalls();
  const counts = await getUnreadCounts(InboxScope.ATTENDANCE);
  assert.deepEqual(counts, { alerts: 1, deviceFeed: 2, total: 3 });
  assert.deepEqual(calls.count.map((input) => input.where), [
    { scope: InboxScope.ATTENDANCE, category: InboxCategory.ALERT, readAt: null },
    { scope: InboxScope.ATTENDANCE, category: InboxCategory.DEVICE_FEED, readAt: null },
  ]);
}

async function assertReadIsolation() {
  resetCalls();
  await markInboxItemRead("full-row-id", InboxScope.ATTENDANCE);
  assert.deepEqual(calls.update[0].where, { id: "full-row-id", scope: InboxScope.ATTENDANCE });

  await markInboxItemsRead(
    { category: InboxCategory.ALERT, severity: InboxSeverity.WARNING },
    InboxScope.ATTENDANCE
  );
  assert.deepEqual(calls.updateMany[0].where, {
    scope: InboxScope.ATTENDANCE,
    readAt: null,
    category: InboxCategory.ALERT,
    severity: InboxSeverity.WARNING,
  });

  await markInboxItemsReadBulk({ ids: ["full-row-id", "attendance-row-id"] }, InboxScope.ATTENDANCE);
  assert.deepEqual(calls.updateMany[1].where, {
    scope: InboxScope.ATTENDANCE,
    id: { in: ["full-row-id", "attendance-row-id"] },
    readAt: null,
  });
}

async function assertCreateAndDedupeIsolation() {
  resetCalls();
  const baseInput = {
    scope: InboxScope.FULL,
    category: InboxCategory.ALERT,
    type: InboxItemType.DEVICE_DISCONNECTED,
    severity: InboxSeverity.CRITICAL,
    title: "Device disconnected",
    dedupeKey: "DEVICE_DISCONNECTED:DEVICE:device-1:window",
  };

  await createInboxItem(baseInput);
  await createInboxItem({ ...baseInput, scope: InboxScope.ATTENDANCE });

  assert.deepEqual(calls.findUnique.map((input) => input.where), [
    {
      scope_dedupeKey: {
        scope: InboxScope.FULL,
        dedupeKey: baseInput.dedupeKey,
      },
    },
    {
      scope_dedupeKey: {
        scope: InboxScope.ATTENDANCE,
        dedupeKey: baseInput.dedupeKey,
      },
    },
  ]);
  assert.equal(calls.create[0].data.scope, InboxScope.FULL);
  assert.equal(calls.create[1].data.scope, InboxScope.ATTENDANCE);
}

function assertSchemaAndMigrationContract() {
  const schemaPath = path.resolve(__dirname, "../../../prisma/schema.prisma");
  const migrationPath = path.resolve(
    __dirname,
    "../../../prisma/migrations/20261003120000_add_inbox_edition_scope/migration.sql"
  );
  const schema = fs.readFileSync(schemaPath, "utf8");
  const migration = fs.readFileSync(migrationPath, "utf8");

  assert.match(schema, /scope\s+InboxScope\s+@default\(FULL\)/u);
  assert.match(schema, /@@unique\(\[scope, dedupeKey\]\)/u);
  assert.match(migration, /ADD COLUMN "scope" "InboxScope" NOT NULL DEFAULT 'FULL'/u);
  assert.match(migration, /DROP INDEX "InboxItem_dedupeKey_key"/u);
  assert.match(migration, /"InboxItem_scope_dedupeKey_key"/u);
}

async function main() {
  installMocks();
  try {
    assertSchemaAndMigrationContract();
    await assertListAndCountIsolation();
    await assertReadIsolation();
    await assertCreateAndDedupeIsolation();
  } finally {
    restoreMocks();
  }

  console.log("ok - Inbox list/count/read/create/dedupe are isolated by explicit Edition scope");
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
