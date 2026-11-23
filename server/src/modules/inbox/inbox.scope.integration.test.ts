import assert from "node:assert/strict";
import {
  InboxCategory,
  InboxItemType,
  InboxScope,
  InboxSeverity,
} from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { HttpError } from "../../middlewares/error-handler";
import { inboxListQuerySchema } from "./inbox.schemas";
import {
  listInboxItems,
  markInboxItemRead,
  markInboxItemsReadBulk,
} from "./inbox.service";

const suffix = `${Date.now()}-${process.pid}`;
const title = `O2.1 inbox scope fixture ${suffix}`;
const sharedDedupeKey = `O2_1_SCOPE:${suffix}`;
const createdIds: string[] = [];

async function main() {
  try {
    const legacyDefault = await prisma.inboxItem.create({
      data: {
        category: InboxCategory.ALERT,
        type: InboxItemType.DEVICE_DISCONNECTED,
        severity: InboxSeverity.CRITICAL,
        title,
        dedupeKey: sharedDedupeKey,
      },
    });
    createdIds.push(legacyDefault.id);
    assert.equal(legacyDefault.scope, InboxScope.FULL, "Rows without an explicit scope must remain FULL");

    const attendance = await prisma.inboxItem.create({
      data: {
        scope: InboxScope.ATTENDANCE,
        category: InboxCategory.ALERT,
        type: InboxItemType.DEVICE_DISCONNECTED,
        severity: InboxSeverity.CRITICAL,
        title,
        dedupeKey: sharedDedupeKey,
      },
    });
    createdIds.push(attendance.id);
    assert.equal(attendance.scope, InboxScope.ATTENDANCE);

    const query = inboxListQuerySchema.parse({ search: suffix, pageSize: 20 });
    const fullResult = await listInboxItems(query, InboxScope.FULL);
    const attendanceResult = await listInboxItems(query, InboxScope.ATTENDANCE);
    assert.deepEqual(fullResult.items.map((item) => item.id), [legacyDefault.id]);
    assert.deepEqual(attendanceResult.items.map((item) => item.id), [attendance.id]);

    await assert.rejects(
      () => markInboxItemRead(legacyDefault.id, InboxScope.ATTENDANCE),
      (error: unknown) => error instanceof HttpError && error.status === 404
    );
    const unchangedFull = await prisma.inboxItem.findUniqueOrThrow({ where: { id: legacyDefault.id } });
    assert.equal(unchangedFull.readAt, null, "Cross-scope read-one must not mutate the FULL row");

    const bulkResult = await markInboxItemsReadBulk(
      { ids: [legacyDefault.id, attendance.id] },
      InboxScope.ATTENDANCE
    );
    assert.equal(bulkResult.updatedCount, 1);

    const [fullAfterBulk, attendanceAfterBulk] = await Promise.all([
      prisma.inboxItem.findUniqueOrThrow({ where: { id: legacyDefault.id } }),
      prisma.inboxItem.findUniqueOrThrow({ where: { id: attendance.id } }),
    ]);
    assert.equal(fullAfterBulk.readAt, null, "Cross-scope bulk read must not mutate the FULL row");
    assert.ok(attendanceAfterBulk.readAt instanceof Date, "Attendance bulk read must update its own row");

    console.log("ok - PostgreSQL Inbox scope default, composite dedupe, queries and read mutations are isolated");
  } finally {
    if (createdIds.length > 0) {
      await prisma.inboxItem.deleteMany({ where: { id: { in: createdIds } } });
      const remainingFixtures = await prisma.inboxItem.count({ where: { id: { in: createdIds } } });
      assert.equal(remainingFixtures, 0, "Inbox scope integration fixtures must be removed");
    }
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
