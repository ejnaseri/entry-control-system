import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

assert.equal(process.versions.node, "24.19.0");
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const baseline = spawnSync(process.execPath, [path.join(root, "scripts/test-license-time-v1.mjs")], { cwd: root, stdio: "inherit" });
assert.equal(baseline.status, 0, "Core/State/Time regression failed");
const require = createRequire(import.meta.url), before = new Set(Object.keys(require.cache));
const productionRoot = path.join(root, "server/dist/licensing");
const core = require(path.join(productionRoot, "core/v1/index.js"));
const { nodeCryptoV1 } = require(path.join(productionRoot, "adapters/node-crypto.js"));
const { createOfflineImportPlannerV1 } = require(path.join(productionRoot, "offline/import-plan.js"));
const { createOfflineRequestWorkflowV1 } = require(path.join(productionRoot, "offline/request.js"));
const { createOfflineFileWorkflowV1 } = require(path.join(productionRoot, "offline/file-workflow.js"));
const { createOfflineEntitlementCompletionV1, createOfflineControlCompletionV1, createOfflineRecoveryCompletionV1, createOfflineRebindCompletionV1, createOfflineTimeCorrectionCompletionV1, createOfflineReactivationCompletionV1 } = require(path.join(productionRoot, "offline/entitlement-completion.js"));
for (const file of Object.keys(require.cache).filter(file => !before.has(file))) {
  const relative = path.relative(productionRoot, file);
  assert(!relative.startsWith("..") && !path.isAbsolute(relative), `Production dependency escaped: ${file}`);
}
const { runLicenseOfflineTests } = await import("./lib/license-offline-tests.mjs");
const result = await runLicenseOfflineTests({ core, nodeCryptoV1, createOfflineImportPlannerV1 });
console.log(`[license-offline] ${result.passed}/${result.attempted}`);
for (const failure of result.failures) console.error(failure);
assert.equal(result.attempted, 38); assert.equal(result.failures.length, 0);
const { runLicenseOfflineRequestTests } = await import("./lib/license-offline-request-tests.mjs");
const requests = await runLicenseOfflineRequestTests({ core, nodeCryptoV1, createOfflineRequestWorkflowV1 });
console.log(`[license-offline-request] ${requests.passed}/${requests.attempted}`);
for (const failure of requests.failures) console.error(failure);
assert.equal(requests.attempted, 44); assert.equal(requests.failures.length, 0);
const { runLicenseOfflineCompletionTests } = await import("./lib/license-offline-completion-tests.mjs");
const completion = await runLicenseOfflineCompletionTests({ core, nodeCryptoV1, createOfflineRequestWorkflowV1, createOfflineEntitlementCompletionV1 });
console.log(`[license-offline-completion] ${completion.passed}/${completion.attempted}`);
for (const failure of completion.failures) console.error(failure);
assert.equal(completion.attempted, 36); assert.equal(completion.failures.length, 0);
const { runLicenseOfflineControlTests } = await import("./lib/license-offline-control-tests.mjs");
const control = await runLicenseOfflineControlTests({ core, nodeCryptoV1, createOfflineRequestWorkflowV1, createOfflineControlCompletionV1 });
console.log(`[license-offline-control] ${control.passed}/${control.attempted}`);
for (const failure of control.failures) console.error(failure);
assert.equal(control.attempted, 36); assert.equal(control.failures.length, 0);
const { runLicenseOfflineRecoveryTests } = await import("./lib/license-offline-recovery-tests.mjs");
const recovery = await runLicenseOfflineRecoveryTests({ core, nodeCryptoV1, createOfflineRequestWorkflowV1, createOfflineRecoveryCompletionV1 });
console.log(`[license-offline-recovery] ${recovery.passed}/${recovery.attempted}`);
for (const failure of recovery.failures) console.error(failure);
assert.equal(recovery.attempted, 36); assert.equal(recovery.failures.length, 0);
const { runLicenseOfflineRebindTests } = await import("./lib/license-offline-rebind-tests.mjs");
const rebind = await runLicenseOfflineRebindTests({ core, nodeCryptoV1, createOfflineRequestWorkflowV1, createOfflineRebindCompletionV1 });
console.log(`[license-offline-rebind] ${rebind.passed}/${rebind.attempted}`);
for (const failure of rebind.failures) console.error(failure);
assert.equal(rebind.attempted, 40); assert.equal(rebind.failures.length, 0);
const { runLicenseOfflineTimeCorrectionTests } = await import("./lib/license-offline-time-correction-tests.mjs");
const timeCorrection = await runLicenseOfflineTimeCorrectionTests({ core, nodeCryptoV1, createOfflineRequestWorkflowV1, createOfflineTimeCorrectionCompletionV1 });
console.log(`[license-offline-time-correction] ${timeCorrection.passed}/${timeCorrection.attempted}`);
for (const failure of timeCorrection.failures) console.error(failure);
assert.equal(timeCorrection.attempted, 32); assert.equal(timeCorrection.failures.length, 0);
const { runLicenseOfflineReactivationTests } = await import("./lib/license-offline-reactivation-tests.mjs");
const reactivation = await runLicenseOfflineReactivationTests({ core, nodeCryptoV1, createOfflineRequestWorkflowV1, createOfflineReactivationCompletionV1 });
console.log(`[license-offline-reactivation] ${reactivation.passed}/${reactivation.attempted}`);
for (const failure of reactivation.failures) console.error(failure);
assert.equal(reactivation.attempted, 28); assert.equal(reactivation.failures.length, 0);
const { runLicenseOfflineFileTests } = await import("./lib/license-offline-file-tests.mjs");
const files = await runLicenseOfflineFileTests({ core, nodeCryptoV1, createOfflineRequestWorkflowV1, createOfflineFileWorkflowV1 });
console.log(`[license-offline-files] ${files.passed}/${files.attempted}`);
for (const failure of files.failures) console.error(failure);
assert.equal(files.attempted, 32); assert.equal(files.failures.length, 0);
const matrixProduction = { core, nodeCryptoV1, createOfflineRequestWorkflowV1, createOfflineFileWorkflowV1,
  createOfflineEntitlementCompletionV1, createOfflineControlCompletionV1, createOfflineRecoveryCompletionV1,
  createOfflineRebindCompletionV1, createOfflineTimeCorrectionCompletionV1, createOfflineReactivationCompletionV1 };
for (const run of [runLicenseOfflineCompletionTests, runLicenseOfflineControlTests, runLicenseOfflineRecoveryTests,
  runLicenseOfflineRebindTests, runLicenseOfflineTimeCorrectionTests, runLicenseOfflineReactivationTests]) {
  const matrix = await run(matrixProduction, true);
  console.log(`[license-file-matrix/${run.name}] ${matrix.passed}/${matrix.attempted}`);
  for (const failure of matrix.failures) console.error(failure);
  assert.equal(matrix.attempted, 16); assert.equal(matrix.failures.length, 0);
}
console.log("[license-offline] PASS - portable offline/file orchestration; no durable store, real filesystem or runtime authority.");
