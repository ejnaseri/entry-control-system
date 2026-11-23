// TEST_ONLY_DO_NOT_TRUST. Independently authored LIC007 review probes.
// Run only after the normal aggregate has built server/dist; no build or native mutation.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
assert.equal(process.versions.node, "24.19.0");
const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../server/dist/licensing");
const before = new Set(Object.keys(require.cache));
const core = require(path.join(root, "core/v1/index.js"));
const { nodeCryptoV1 } = require(path.join(root, "adapters/node-crypto.js"));
const { createHybridRequestWorkflowV1 } = require(path.join(root, "hybrid/request.js"));
const { createHybridCombinedResponseWorkflowV1, createHybridLeaseResponseWorkflowV1 } = require(path.join(root, "hybrid/lease-response.js"));
for (const file of Object.keys(require.cache).filter(f => !before.has(f))) {
  const relative = path.relative(root, file);
  assert(!relative.startsWith("..") && !path.isAbsolute(relative));
}
const { createLicenseStateFixtures } = await import("./lib/license-state-fixtures.mjs");
const { TEST_ONLY_KEYS } = await import("../licensing/vectors/v1/test-only/keys.mjs");
const { signEs256Rfc6979LowS } = await import("../licensing/vectors/v1/lib/ecdsa-rfc6979.mjs");
const ok = r => { assert(r.ok, `${r.stage}/${r.errorCode}`); return r; };
const hex = b => Buffer.from(b).toString("hex");
const failures = [], results = [];
for (const edition of ["FULL", "ATTENDANCE"]) {
  const f = createLicenseStateFixtures({ core, nodeCryptoV1 }, { edition });
  async function setup(recovery = false) {
    const machine = core.createLicenseStateMachineV1(f.configuration);
    let state = ok(machine.transition(machine.initial(), f.initialActivation({ mode: "HYBRID_LEASED" }).command, f.now)).state;
    let request, serial = 0, commits = 0;
    const records = new Map();
    let observation = { wallUtc: f.now, bootId: f.bytes("independent-boot"), monotonicMs: 1000n };
    const store = { commit: async proposal => {
      commits++;
      if (state.stateGeneration !== proposal.expectedPreviousGeneration || hex(state.stateHash) !== hex(proposal.expectedPreviousHash)) return { decision: "CONFLICT" };
      state = proposal.state;
      return { decision: "ACKNOWLEDGED", stateGeneration: state.stateGeneration, stateHash: state.stateHash };
    } };
    const config = { machine, verification: f.verification, requests: { read: async id => records.get(hex(id)) }, store };
    const combined = createHybridCombinedResponseWorkflowV1(config), primary = createHybridLeaseResponseWorkflowV1(config);
    const requester = createHybridRequestWorkflowV1({ ...config, time: { observe: () => observation },
      challenge: { acquire: async () => core.encodeDeterministicCborV1(new Map(Object.entries({ schemaVersion: 1n, carrierType: "lease-challenge", requestNonce: f.bytes(`review-nonce-${++serial}`, 32), expiresInSeconds: 300n }))) },
      installation: { randomBytes: () => f.bytes(`review-id-${serial}`), signInstallation: async ({ sigStructure }) => new Uint8Array(signEs256Rfc6979LowS(sigStructure, TEST_ONLY_KEYS.TEST_ONLY_INSTALLATION_DEVICE_PRIMARY.privateScalar)) },
      registration: { register: async p => { records.set(hex(p.requestId), p); return { decision: "REGISTERED", requestId: p.requestId, requestHash: p.requestHash }; } } });
    async function issue(purpose = "CHECK_IN") {
      request = ok(await requester.prepare(state, purpose === "CHECK_IN" ? { purpose, target: state.current ? "CURRENT" : "PENDING" } : { purpose })).plan;
      ok(await requester.release(request));
    }
    const carrier = fields => core.encodeDeterministicCborV1(new Map(Object.entries({ schemaVersion: 1n, carrierType: "lease-response", requestId: request.requestId, ...fields })));
    function artifacts(l = {}, c = {}, signer) {
      const p = (state.current ?? state.pending).entitlement.payload, d = state.device;
      const lease = f.sign("lease", { ...f.payload("pos-lease-initial-control"), edition,
        tokenId: f.bytes(`review-lease-${serial}`), licenseId: p.licenseId, activationId: p.activationId,
        installationId: d.installationId, deviceKeyId: d.deviceKeyId, assurance: d.assurance, features: p.features,
        entitlementTokenId: p.tokenId, entitlementGeneration: p.generation, leaseRequestId: request.requestId, leaseRequestHash: request.requestHash,
        leaseRevision: state.leaseRevision + 1n, issuedAt: f.now, notBefore: f.now, serverTime: f.now,
        notAfter: f.now + p.offlineAllowanceSeconds, offlineUntil: f.now + p.offlineAllowanceSeconds,
        controlRevision: state.control.revision, controlState: state.control.state, controlEffectiveAt: state.control.effectiveAt, controlReasonCode: state.control.reasonCode, ...l });
      const control = f.sign("offline-control", { ...f.payload("pos-control-vendor-suspend"), edition,
        tokenId: f.bytes(`review-control-${serial}`), licenseId: p.licenseId, activationId: p.activationId,
        issuedAt: f.now, notBefore: f.now, notAfter: f.now + 86400n, action: "SUSPEND", effectiveAt: f.now, reasonCode: 1n,
        controlRevision: state.control.revision + 1n, ...c }, signer);
      return { lease, control };
    }
    const input = a => ({ encoded: carrier({ lease: a.lease, offlineControl: a.control }), requestId: request.requestId, ...(recovery ? { observation } : {}) });
    await issue();
    if (recovery) {
      const a = artifacts(); ok(await primary.complete(ok(await primary.prepare(state, { encoded: carrier({ lease: a.lease }), requestId: request.requestId }, f.now)).plan));
      const incident = { id: f.bytes("review-incident"), nonce: f.bytes("review-incident", 32), reason: "CLOCK_FORWARD_JUMP" };
      state = ok(machine.transition(state, { kind: "BEGIN_TIME_RECOVERY", observation, incident }, f.now)).state;
      await issue("TIME_RECOVERY");
    }
    return { machine, combined, primary, records, store, artifacts, input, carrier, issue,
      get state() { return state; }, set state(v) { state = v; }, get request() { return request; },
      get commits() { return commits; }, get observation() { return observation; },
      prepare: a => combined.prepare(state, input(a), f.now),
      reject: async (a, code) => { const initial = state, count = commits, r = await combined.prepare(state, input(a), f.now);
        assert.equal(r.ok, false); if (code) assert.equal(r.errorCode, code); assert.equal(state, initial); assert.equal(commits, count); return r; } };
  }
  async function test(name, fn) { try { await fn(); results.push(`${edition}/${name}`); } catch (e) { failures.push({ name: `${edition}/${name}`, message: e.stack }); } }
  await test("revision-order-cross-product", async () => {
    for (const revision of [0n, 1n, 2n]) {
      const s = await setup(), initial = s.state;
      const a = s.artifacts(revision ? { controlRevision: revision, controlState: "SUSPENDED", controlEffectiveAt: f.now, controlReasonCode: 1n } : {});
      const p = ok(await s.prepare(a)).plan.proposal;
      assert.equal(p.state.stateGeneration, initial.stateGeneration + 1n); assert.equal(p.state.control.revision, revision > 1n ? revision : 1n);
      assert.equal(p.state.receipts.length, initial.receipts.length + 2); assert.equal(s.commits, 0);
    }
  });
  await test("same-token-id-across-types-is-atomic-rejection", async () => { const s = await setup(); await s.reject(s.artifacts({}, { tokenId: f.bytes("review-lease-1") }), "TOKEN_ID_COLLISION"); });
  await test("online-signer-cannot-authorize-sidecar", async () => { const s = await setup(); await s.reject(s.artifacts({}, {}, "TEST_ONLY_ONLINE_LEASE_PRIMARY")); });
  await test("cross-edition-sidecar-cannot-piggyback", async () => { const s = await setup(); await s.reject(s.artifacts({}, { edition: edition === "FULL" ? "ATTENDANCE" : "FULL" })); });
  await test("fresh-request-cannot-wrap-two-historical-receipts", async () => {
    const s = await setup(), a = s.artifacts(); ok(await s.combined.complete(ok(await s.prepare(a)).plan)); await s.issue(); await s.reject(a, "RESPONSE_REQUEST_BINDING_MISMATCH");
  });
  await test("control-first-partial-receipt-rejected", async () => {
    const s = await setup(), a = s.artifacts(); s.state = ok(s.machine.transition(s.state, { kind: "IMPORT_CONTROL", encoded: a.control }, f.now)).state;
    await s.reject(a, "COMBINED_PARTIAL_RECEIPT");
  });
  await test("duplicate-checkin-remains-restricted-after-new-time-incident", async () => {
    const s = await setup(), a = s.artifacts(); ok(await s.combined.complete(ok(await s.prepare(a)).plan));
    s.state = ok(s.machine.transition(s.state, { kind: "BEGIN_TIME_RECOVERY", observation: s.observation, incident: { id: f.bytes("later"), nonce: f.bytes("later", 32), reason: "CLOCK_FORWARD_JUMP" } }, f.now)).state;
    const p = ok(await s.prepare(a)).plan; assert.equal(p.proposal.decision, "IDEMPOTENT"); assert.equal(p.proposal.state, s.state); assert(p.proposal.state.timeIncident);
  });
  await test("terminal-control-cannot-be-undone-by-higher-operational-lease", async () => { const s = await setup(); await s.reject(s.artifacts({ controlRevision: 2n, controlState: "OPERATIONAL", controlEffectiveAt: f.now, controlReasonCode: 1n }, { action: "REVOKE" })); });
  await test("time-recovery-delay-cannot-apply-control", async () => {
    const s = await setup(true), a = s.artifacts(), initial = s.state;
    const r = await s.combined.prepare(s.state, { ...s.input(a), observation: { ...s.observation, monotonicMs: 301001n } }, f.now);
    assert.equal(r.ok, false); assert.equal(s.state, initial); assert.equal(s.commits, 1); assert(s.state.timeIncident);
  });
  await test("time-recovery-sidecar-invalid-at-authenticated-time", async () => { const s = await setup(true); await s.reject(s.artifacts({}, { issuedAt: f.now - 100n, notBefore: f.now - 100n, notAfter: f.now - 1n })); });
  await test("time-recovery-success-is-single-use", async () => { const s = await setup(true), a = s.artifacts(); ok(await s.combined.complete(ok(await s.prepare(a)).plan)); assert.equal(s.state.timeIncident, undefined); await s.reject(a, "COMBINED_TIME_RECOVERY_REPLAYED"); });
  await test("recovery-control-validity-uses-signed-time-in-both-orders", async () => {
    for (const revision of [0n, 1n, 2n]) {
      const s = await setup(true), signed = f.now + 120n;
      const l = { serverTime: signed, issuedAt: signed, notBefore: signed,
        offlineUntil: signed + s.state.current.entitlement.payload.offlineAllowanceSeconds,
        notAfter: signed + s.state.current.entitlement.payload.offlineAllowanceSeconds,
        ...(revision ? { controlRevision: revision, controlState: "SUSPENDED", controlEffectiveAt: signed, controlReasonCode: 1n } : {}) };
      await s.reject(s.artifacts(l, { issuedAt: f.now, notBefore: f.now, notAfter: f.now + 60n, effectiveAt: f.now }));
      const good = s.artifacts(l, { issuedAt: signed, notBefore: signed, effectiveAt: signed });
      const p = ok(await s.prepare(good)).plan.proposal;
      assert.equal(p.state.clockHighWater, signed); assert.equal(p.state.timeIncident, undefined);
      assert.equal(p.state.stateGeneration, s.state.stateGeneration + 1n);
      assert.equal(s.machine.project(p.state, signed).state, "SUSPENDED_LOCKED");
    }
  });
  await test("scheduled-control-does-not-admit-until-effective", async () => {
    for (const revision of [1n, 2n]) {
      const s = await setup(), future = f.now + 120n;
      const a = s.artifacts({ controlRevision: revision, controlState: "SUSPENDED", controlEffectiveAt: future, controlReasonCode: 1n }, { effectiveAt: future });
      const p = ok(await s.prepare(a)).plan.proposal;
      assert.equal(s.machine.project(p.state, f.now).operational, true);
      assert.equal(s.machine.project(p.state, future).state, "SUSPENDED_LOCKED");
    }
  });
  await test("partial-state-ack-is-never-success", async () => {
    const s = await setup(), p = ok(await s.prepare(s.artifacts())).plan, initial = s.state;
    s.store.commit = async () => ({ decision: "ACKNOWLEDGED", stateGeneration: p.proposal.state.stateGeneration, stateHash: initial.stateHash });
    const r = await s.combined.complete(p); assert.equal(r.ok, false); assert.equal(r.errorCode, "COMMIT_ACKNOWLEDGEMENT_INVALID"); assert.equal(s.state, initial);
  });
}
console.log(JSON.stringify({ passed: results.length, attempted: results.length + failures.length, results, failures }, null, 2));
if (failures.length) process.exitCode = 1;
