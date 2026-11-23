import assert from "node:assert/strict";
import { computeComplianceScore } from "./attendance-compliance.logic";

function run() {
  const scoreHealthy = computeComplianceScore(
    {
      lateMinutes: 0,
      lateCount: 0,
      absentDays: 0,
      noCheckoutCount: 0,
      deniedCount: 0,
    },
    {
      lateMinutesWeight: 0.05,
      lateCountWeight: 1,
      absentWeight: 8,
      noCheckoutWeight: 4,
      deniedWeight: 6,
    }
  );
  assert.equal(scoreHealthy, 100);

  const scoreRisky = computeComplianceScore(
    {
      lateMinutes: 180,
      lateCount: 10,
      absentDays: 8,
      noCheckoutCount: 3,
      deniedCount: 5,
    },
    {
      lateMinutesWeight: 0.05,
      lateCountWeight: 1,
      absentWeight: 8,
      noCheckoutWeight: 4,
      deniedWeight: 6,
    }
  );
  assert.equal(scoreRisky, 0);
  console.log("ok - attendance compliance score");
}

run();
