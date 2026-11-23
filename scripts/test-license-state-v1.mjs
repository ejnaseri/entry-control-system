import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
assert.equal(process.versions.node, "24.19.0", "Use the pinned Node 24.19.0 runtime.");
const regression = spawnSync(process.execPath, [path.join(root, "scripts/test-license-core-v1.mjs")], {
  cwd: root, stdio: "inherit", env: process.env,
});
assert.equal(regression.status, 0, `Core regression failed: ${regression.error ?? regression.signal ?? regression.status}`);

// Establish the production dependency boundary before importing any test issuer/key.
const require = createRequire(import.meta.url);
const before = new Set(Object.keys(require.cache));
const coreRoot = path.join(root, "server/dist/licensing/core/v1");
const adapterPath = path.join(root, "server/dist/licensing/adapters/node-crypto.js");
const core = require(path.join(coreRoot, "index.js"));
const { nodeCryptoV1 } = require(adapterPath);
const { projectLicenseStateV1 } = require(path.join(coreRoot, "state-projection.js"));
for (const file of Object.keys(require.cache).filter(file => !before.has(file))) {
  const relative = path.relative(coreRoot, file);
  assert(file === adapterPath || (!relative.startsWith("..") && !path.isAbsolute(relative)), `Production dependency escaped: ${file}`);
}
assert.equal(typeof core.createLicenseStateMachineV1, "function");
assert.equal(core.projectLicenseStateV1, undefined, "Raw projection must not bypass factory provenance.");
const { runLicenseStateModelTests } = await import("./lib/license-state-model-tests.mjs");
const { runLicenseStateSecurityTests } = await import("./lib/license-state-security-tests.mjs");
const { executeLicenseStateProjectionTests } = await import("./lib/license-state-projection-tests.mjs");
let failures = 0;
for (const [name, expectedCount, run] of [
  ["projection", 59, () => executeLicenseStateProjectionTests({ projectLicenseStateV1 })],
  ["model", 31, () => runLicenseStateModelTests({ core, nodeCryptoV1 })],
  ["security", 27, () => runLicenseStateSecurityTests({ core, nodeCryptoV1 })],
]) {
  const result = run();
  console.log(`[license-state] ${name}: ${result.passed}/${result.attempted}`);
  for (const failure of result.failures) console.error(failure);
  failures += result.failures.length;
  assert.equal(result.attempted, expectedCount, `${name} coverage count drifted`);
  assert.equal(result.passed + result.failures.length, result.attempted, `${name} returned inconsistent accounting`);
}
assert.equal(failures, 0, "License state acceptance failed.");
console.log("[license-state] PASS - pure proposed states only; no persistence or runtime authorization claimed.");
