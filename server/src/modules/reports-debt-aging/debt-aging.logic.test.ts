import assert from "node:assert/strict";
import { buildDebtBuckets, resolveDebtBucket } from "./debt-aging.logic";

function run() {
  const buckets = buildDebtBuckets(30, 60, 90);
  assert.equal(buckets.length, 4);
  assert.equal(resolveDebtBucket(0, buckets).key, "0-30");
  assert.equal(resolveDebtBucket(30, buckets).key, "0-30");
  assert.equal(resolveDebtBucket(31, buckets).key, "31-60");
  assert.equal(resolveDebtBucket(75, buckets).key, "61-90");
  assert.equal(resolveDebtBucket(190, buckets).key, "91+");
  console.log("ok - debt aging buckets");
}

run();
