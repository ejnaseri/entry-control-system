// TEST_ONLY_DO_NOT_TRUST. LIC005 review reproducer; never a production module.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

assert.equal(process.versions.node, "24.19.0");
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url), before = new Set(Object.keys(require.cache));
const coreRoot = path.join(root, "server/dist/licensing/core/v1");
const adapter = path.join(root, "server/dist/licensing/adapters/node-crypto.js");
const core = require(path.join(coreRoot, "index.js"));
const { nodeCryptoV1 } = require(adapter);
for (const file of Object.keys(require.cache).filter(file => !before.has(file))) {
  const relative = path.relative(coreRoot, file);
  assert(file === adapter || (!relative.startsWith("..") && !path.isAbsolute(relative)));
}
const { createLicenseStateFixtures } = await import("./lib/license-state-fixtures.mjs");
let failed = 0, attempted = 0;
for (const edition of ["FULL", "ATTENDANCE"]) {
  // Product-approved availability contract: boot count and downtime alone are
  // never incidents. These are wall/boot model inputs, not physical OS tests.
  for (const scenario of [
    { name: "48-normal-reboots", boots: 48, interval: 900n, termDays: 365n, expected: "ACTIVE" },
    { name: "three-days-off", boots: 1, interval: 3n * 86400n, termDays: 365n, expected: "ACTIVE" },
    { name: "one-month-off", boots: 1, interval: 30n * 86400n, termDays: 365n, expected: "ACTIVE" },
    { name: "six-months-off", boots: 1, interval: 180n * 86400n, termDays: 365n, expected: "ACTIVE" },
    { name: "weekly-term-after-month-off", boots: 1, interval: 30n * 86400n, termDays: 7n, expected: "EXPIRED_LOCKED" },
    { name: "exact-annual-expiry-after-shutdown", boots: 1, interval: 365n * 86400n, termDays: 365n, expected: "EXPIRED_LOCKED" },
  ]) {
    attempted++;
    const label = `${edition}/${scenario.name}`;
    try {
      const f = createLicenseStateFixtures({ core, nodeCryptoV1 }, { edition });
      const machine = core.createLicenseStateMachineV1(f.configuration);
      const activation = f.initialActivation({ termSeconds: scenario.termDays * 86400n, graceSeconds: 0n });
      let result = machine.transition(machine.initial(), activation.command, f.now);
      assert(result.ok, `${result.stage}/${result.errorCode}`);
      let state = result.state;
      const deadline = state.current.entitlement.payload.termEndsAt;
      for (let index = 0; index <= scenario.boots; index++) {
        result = machine.transition(state, {
          kind: "OBSERVE_TIME",
          observation: { wallUtc: f.now + BigInt(index) * scenario.interval,
            monotonicMs: 1000n, bootId: f.bytes(`${label}-boot-${index}`) },
          incident: { id: f.bytes(`${label}-incident-${index}`),
            nonce: f.bytes(`${label}-nonce-${index}`, 32), reason: "CLOCK_ROLLBACK" },
        }, f.now);
        assert(result.ok, `${result.stage}/${result.errorCode}`);
        state = result.state;
        assert.equal(state.timeIncident, undefined, "Normal reboot must not create a time incident");
        assert.equal(state.tamperLatched, false);
        assert.equal(state.current.entitlement.payload.termEndsAt, deadline, "Shutdown cannot extend the term");
        assert.equal(state.current.entitlement.payload.graceUntil, deadline, "No grace may be invented");
      }
      assert.equal(machine.project(state, state.clockHighWater).state, scenario.expected);
      console.log(`ok - ${label}`);
    } catch (error) {
      failed++;
      console.error(`not ok - ${label}: ${error.message}`);
    }
  }
  for (const reboot of [false, true]) {
    attempted++;
    const f = createLicenseStateFixtures({ core, nodeCryptoV1 }, { edition });
    const machine = core.createLicenseStateMachineV1(f.configuration);
    let state = machine.initial();
    const apply = command => {
      const result = machine.transition(state, command, f.now);
      assert(result.ok, `${result.stage}/${result.errorCode}`);
      state = result.state;
    };
    const incident = label => ({ id: f.bytes(label), nonce: f.bytes(`${label}-nonce`, 32), reason: "CLOCK_FORWARD_JUMP" });
    const bootA = f.bytes("review-boot-a"), bootB = f.bytes("review-boot-b");
    const bootId = reboot ? bootB : bootA;
    apply(f.initialActivation({ mode: "OFFLINE_BOUND", label: "review-active" }).command);
    apply({ kind: "OBSERVE_TIME", observation: { wallUtc: f.now, monotonicMs: 1000n, bootId: bootA }, incident: incident("initial") });
    const trustedBefore = state.clockHighWater;
    apply({ kind: "OBSERVE_TIME", observation: { wallUtc: f.now + 63244800n, monotonicMs: 1000n, bootId }, incident: incident("jump") });
    const afterJump = machine.project(state, state.clockHighWater).state;
    const highWaterAfterJump = state.clockHighWater;
    apply({ kind: "BEGIN_TIME_RECOVERY", observation: { wallUtc: f.now, monotonicMs: 2000n, bootId }, incident: incident("repair") });
    const p = state.current.entitlement.payload, i = state.timeIncident;
    const requestPayload = f.payload("pos-activation-time-correct");
    delete requestPayload.tpmEvidence;
    Object.assign(requestPayload, {
      edition, requestId: f.bytes("review-request"), requestNonce: f.bytes("review-request-nonce", 32),
      licenseId: p.licenseId, activationId: p.activationId, installationId: state.device.installationId,
      deviceKeyId: state.device.deviceKeyId, keyId: state.device.deviceKeyId,
      devicePublicKey: state.device.devicePublicKey, bindingKind: state.device.assurance,
      versionIdentitySha256: state.build.versionIdentitySha256, buildIdentitySha256: state.build.buildIdentitySha256,
      buildManifestSha256: state.build.buildManifestSha256,
      stateGeneration: state.stateGeneration, entitlementGeneration: state.entitlementGeneration,
      leaseRevision: state.leaseRevision, controlRevision: state.control.revision, controlState: state.control.state,
      timeCorrectionRevision: state.timeCorrectionRevision, incidentId: i.id, incidentNonce: i.nonce,
      preIncidentClockHighWater: i.preIncidentClockHighWater, issuedAt: f.now, notAfter: f.now + 86400n,
    });
    const request = f.requestSnapshot(f.sign("activation-request", requestPayload));
    const correction = f.payload("pos-time-correction");
    Object.assign(correction, {
      edition, tokenId: f.bytes("review-correction"), licenseId: p.licenseId, activationId: p.activationId,
      installationId: state.device.installationId, deviceKeyId: state.device.deviceKeyId,
      requestId: request.requestId, requestHash: request.requestHash, incidentId: i.id, incidentNonce: i.nonce,
      expectedStateGeneration: state.stateGeneration, newStateGeneration: state.stateGeneration + 1n,
      timeCorrectionRevision: state.timeCorrectionRevision + 1n, preIncidentClockHighWater: i.preIncidentClockHighWater,
      issuedAt: f.now, correctedUtc: f.now + 10n, notBefore: f.now, notAfter: f.now + 3600n,
    });
    const result = machine.transition(state, {
      kind: "APPLY_TIME_CORRECTION", encoded: f.sign("time-correction", correction), request,
      observation: { wallUtc: f.now, monotonicMs: 3000n, bootId },
      evidence: { bootId, sentMonotonicMs: 2000n, requestHash: request.requestHash },
    }, f.now);
    const label = `${edition}/${reboot ? "reboot" : "same-boot"}-forward-jump-repair`;
    console.log(JSON.stringify({ label, trustedBefore: String(trustedBefore), highWaterAfterJump: String(highWaterAfterJump),
      afterJump, correction: result.ok ? "ACCEPTED" : `${result.stage}/${result.errorCode}` }));
    // The master requires forward-clock mistakes to remain repairable. Do not
    // turn the failing cross-boot observation into an expected-success fixture.
    try {
      assert(result.ok, `${label}: signed repair at the real UTC was rejected`);
      assert.equal(machine.project(result.state, result.state.clockHighWater).state, "ACTIVE");
      console.log(`ok - ${label}`);
    } catch (error) {
      failed++;
      console.error(`not ok - ${error.message}`);
      assert.equal(result.state, state, "Rejected repair must preserve prior state");
    }
  }
}
assert.equal(attempted, 16);
console.log(`[license-time-review] ${attempted - failed}/${attempted}; portable model only, not independent/platform closure`);
process.exitCode = failed ? 1 : 0;
