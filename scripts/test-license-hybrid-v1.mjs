import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

assert.equal(process.versions.node, "24.19.0");
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const baseline = spawnSync(process.execPath, [path.join(root, "scripts/test-license-offline-v1.mjs")], { cwd: root, stdio: "inherit" });
assert.equal(baseline.status, 0, "Core/State/Time/Offline regression failed");
const require = createRequire(import.meta.url), before = new Set(Object.keys(require.cache));
const productionRoot = path.join(root, "server/dist/licensing");
const core = require(path.join(productionRoot, "core/v1/index.js"));
const { nodeCryptoV1 } = require(path.join(productionRoot, "adapters/node-crypto.js"));
const { createHybridRequestWorkflowV1 } = require(path.join(productionRoot, "hybrid/request.js"));
const { createHybridLeaseResponseWorkflowV1, createHybridCombinedResponseWorkflowV1 } = require(path.join(productionRoot, "hybrid/lease-response.js"));
const { createHybridControlResponseWorkflowV1 } = require(path.join(productionRoot, "hybrid/control-response.js"));
const { createHybridTrustResponseWorkflowV1 } = require(path.join(productionRoot, "hybrid/trust-response.js"));
const { createHybridTrustedResponseWorkflowV1 } = require(path.join(productionRoot, "hybrid/trusted-response.js"));
const { createHybridReactivationResponseWorkflowV1 } = require(path.join(productionRoot, "hybrid/reactivation-response.js"));
const { createHybridTrustedReactivationResponseWorkflowV1 } = require(path.join(productionRoot, "hybrid/trusted-reactivation-response.js"));
const { createOfflineRequestWorkflowV1 } = require(path.join(productionRoot, "offline/request.js"));
for (const file of Object.keys(require.cache).filter(file => !before.has(file))) {
  const relative = path.relative(productionRoot, file);
  assert(!relative.startsWith("..") && !path.isAbsolute(relative), `Production dependency escaped: ${file}`);
}
const { runLicenseHybridRequestTests } = await import("./lib/license-hybrid-request-tests.mjs");
const result = await runLicenseHybridRequestTests({ core, nodeCryptoV1, createHybridRequestWorkflowV1, createOfflineRequestWorkflowV1 });
console.log(`[license-hybrid-request] ${result.passed}/${result.attempted}`);
for (const failure of result.failures) console.error(failure);
assert.equal(result.attempted, 52); assert.equal(result.failures.length, 0);
const { runLicenseHybridResponseTests } = await import("./lib/license-hybrid-response-tests.mjs");
const responses = await runLicenseHybridResponseTests({ core, nodeCryptoV1, createHybridRequestWorkflowV1, createHybridLeaseResponseWorkflowV1 });
console.log(`[license-hybrid-response] ${responses.passed}/${responses.attempted}`);
for (const failure of responses.failures) console.error(failure);
assert.equal(responses.attempted, 48); assert.equal(responses.failures.length, 0);
const { runLicenseHybridControlTests } = await import("./lib/license-hybrid-control-tests.mjs");
const controls = await runLicenseHybridControlTests({ core, nodeCryptoV1, createHybridRequestWorkflowV1, createHybridControlResponseWorkflowV1, createOfflineRequestWorkflowV1 });
console.log(`[license-hybrid-control] ${controls.passed}/${controls.attempted}`);
for (const failure of controls.failures) console.error(failure);
assert.equal(controls.attempted, 44); assert.equal(controls.failures.length, 0);
const combined = await runLicenseHybridResponseTests({ core, nodeCryptoV1, createHybridRequestWorkflowV1,
  createHybridLeaseResponseWorkflowV1, createHybridCombinedResponseWorkflowV1, createOfflineRequestWorkflowV1 }, true);
console.log(`[license-hybrid-combined] ${combined.passed}/${combined.attempted}`);
for (const failure of combined.failures) console.error(failure);
assert.equal(combined.attempted, 48); assert.equal(combined.failures.length, 0);
const { runLicenseHybridTrustTests } = await import("./lib/license-hybrid-trust-tests.mjs");
const trust = await runLicenseHybridTrustTests({ core, nodeCryptoV1, createHybridRequestWorkflowV1, createHybridTrustResponseWorkflowV1 });
console.log(`[license-hybrid-trust] ${trust.passed}/${trust.attempted}`);
for (const failure of trust.failures) console.error(failure);
assert.equal(trust.attempted, 44); assert.equal(trust.failures.length, 0);
const { runLicenseHybridTrustedResponseTests } = await import("./lib/license-hybrid-trusted-response-tests.mjs");
const coordinated = await runLicenseHybridTrustedResponseTests({ core, nodeCryptoV1, createHybridRequestWorkflowV1,
  createHybridTrustedResponseWorkflowV1, createHybridLeaseResponseWorkflowV1 });
console.log(`[license-hybrid-trusted-response] ${coordinated.passed}/${coordinated.attempted}`);
for (const failure of coordinated.failures) console.error(failure);
assert.equal(coordinated.attempted, 44); assert.equal(coordinated.failures.length, 0);
const { runLicenseHybridReactivationTests } = await import("./lib/license-hybrid-reactivation-tests.mjs");
const reactivation = await runLicenseHybridReactivationTests({ core, nodeCryptoV1, createHybridRequestWorkflowV1,
  createHybridReactivationResponseWorkflowV1, createHybridTrustedReactivationResponseWorkflowV1, createOfflineRequestWorkflowV1 });
console.log(`[license-hybrid-reactivation] ${reactivation.passed}/${reactivation.attempted}`);
for (const failure of reactivation.failures) console.error(failure);
assert.equal(reactivation.attempted, 52); assert.equal(reactivation.failures.length, 0);
console.log("[license-hybrid] PASS - portable requests, Lease/control/trust and Reactivation handoff; runtime switch/Store/HTTPS gates remain open.");
