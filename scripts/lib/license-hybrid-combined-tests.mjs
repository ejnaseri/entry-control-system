// TEST_ONLY_DO_NOT_TRUST. Shared real signed Hybrid fixtures; in-memory Store only.
import assert from "node:assert/strict";
import { TEST_ONLY_KEYS } from "../../licensing/vectors/v1/test-only/keys.mjs";
import { signEs256Rfc6979LowS } from "../../licensing/vectors/v1/lib/ecdsa-rfc6979.mjs";

export async function runHybridCombinedCases({ production, f, setup, edition, test, ok, no, hex }) {
  const create = async options => {
    const s = await setup(options);
    s.workflow = production.createHybridCombinedResponseWorkflowV1({ machine: s.machine, verification: f.verification, requests: s.reader, store: s.store });
    s.candidate = async ({ action = "SUSPEND", bound = false, control = {}, lease = {} } = {}) => {
      const parent = (s.state.current ?? s.state.pending).entitlement.payload;
      let request;
      if (bound) {
        const generator = production.createOfflineRequestWorkflowV1({ machine: s.machine, verification: f.verification,
          installation: { randomBytes: n => f.bytes("combined-control-request", n), signInstallation: async ({ sigStructure }) =>
            new Uint8Array(signEs256Rfc6979LowS(sigStructure, TEST_ONLY_KEYS.TEST_ONLY_INSTALLATION_DEVICE_PRIMARY.privateScalar)) },
          registration: { register: async p => { s.records.set(hex(p.requestId), p);
            return { decision: "REGISTERED", requestId: p.requestId, requestHash: p.requestHash }; } } });
        request = ok(await generator.prepare(s.state, { purpose: "CONTROL", action, issuedAt: f.now,
          notAfter: f.now + 86400n, effectiveAt: f.now, reasonCode: 1n })).plan; ok(await generator.export(request));
      }
      const payload = { ...f.payload("pos-control-vendor-suspend"), edition,
        tokenId: f.bytes("combined-control"), licenseId: parent.licenseId, activationId: parent.activationId,
        issuedAt: f.now, notBefore: f.now, notAfter: f.now + 86400n, action, effectiveAt: f.now, reasonCode: 1n,
        controlRevision: s.state.control.revision + 1n, origin: bound ? "REQUEST_BOUND" : "VENDOR_INITIATED",
        ...(bound ? { requestId: request.requestId, requestHash: request.requestHash } : {}), ...control };
      const leaseBytes = ok(f.verifier.parseCarrier({ carrierType: "lease-response", encoded: s.response(lease) })).value.carrier.lease;
      const controlBytes = f.sign("offline-control", payload);
      return { encoded: s.carrier({ lease: leaseBytes, offlineControl: controlBytes }), lease: leaseBytes, control: controlBytes, request, payload };
    };
    s.apply = async (c, extra = {}) => { const r = await s.prepare(c.encoded, extra); return r.ok ? s.workflow.complete(r.plan) : r; };
    return s;
  };
  await test(`${edition}/combined-one-generation-one-commit`, async () => {
    const s = await create(), before = s.state, c = await s.candidate(), p = ok(await s.prepare(c.encoded)).plan;
    assert.equal(s.state, before); assert.equal(s.commits, 0); assert.equal(p.proposal.state.stateGeneration, before.stateGeneration + 1n);
    assert.equal(hex(p.proposal.state.previousStateHash), hex(before.stateHash));
    assert(p.proposal.state.current.lease); assert.equal(p.proposal.state.control.state, "SUSPENDED");
    assert.equal(p.proposal.state.receipts.length, before.receipts.length + 2);
    assert.equal(p.proposal.state.consumedRequests.length, before.consumedRequests.length + 1);
    ok(await s.workflow.complete(p)); assert.equal(s.writes, 1); assert.equal(s.commits, 1);
    assert.equal(s.machine.project(s.state, f.now).state, "SUSPENDED_LOCKED");
  });
  await test(`${edition}/combined-bound-control-consumes-both-requests-once`, async () => {
    const s = await create(), before = s.state, c = await s.candidate({ bound: true }); ok(await s.apply(c));
    assert.equal(s.state.stateGeneration, before.stateGeneration + 1n); assert.equal(s.writes, 1);
    for (const id of [s.request.requestId, c.request.requestId]) assert(s.state.consumedRequests.some(r => hex(r.id) === hex(id)));
  });
  await test(`${edition}/combined-control-signature-failure-leaves-lease-unapplied`, async () => {
    const s = await create(), before = s.state, c = await s.candidate(); c.control[c.control.length - 1] ^= 1;
    c.encoded = s.carrier({ lease: c.lease, offlineControl: c.control }); no(await s.apply(c));
    assert.equal(s.state, before); assert.equal(s.commits, 0);
  });
  await test(`${edition}/combined-lease-failure-leaves-control-unapplied`, async () => {
    const s = await create(), before = s.state, c = await s.candidate({ lease: { leaseRequestHash: f.bytes("wrong", 32) } });
    no(await s.apply(c)); assert.equal(s.state, before); assert.equal(s.commits, 0);
  });
  await test(`${edition}/combined-control-revision-conflict-is-neutral`, async () => {
    const s = await create(), before = s.state;
    no(await s.apply(await s.candidate({ control: { controlRevision: 0n } })));
    no(await s.apply(await s.candidate({ action: "UNSUSPEND", control: { controlRevision: 2n },
      lease: { controlRevision: 2n, controlState: "SUSPENDED", controlEffectiveAt: f.now, controlReasonCode: 1n } })));
    assert.equal(s.state, before); assert.equal(s.commits, 0);
  });
  await test(`${edition}/combined-revoke-dominates-lease`, async () => {
    const s = await create(), c = await s.candidate({ action: "REVOKE" }); ok(await s.apply(c));
    assert.equal(s.state.tombstones.length, 1); assert.equal(s.machine.project(s.state, f.now).state, "REVOKED_LOCKED");
    no(await s.apply(c)); assert.equal(s.writes, 1);
  });
  await test(`${edition}/combined-exact-checkin-retry-readonly-after-expiry`, async () => {
    const s = await create(), c = await s.candidate(); ok(await s.apply(c)); const before = s.state;
    const p = ok(await s.workflow.prepare(s.state, s.input(c.encoded), f.now + 90000n)).plan;
    assert.equal(ok(await s.workflow.complete(p)).decision, "ADAPTER_CONFIRMED_DUPLICATE");
    assert.equal(s.state, before); assert.equal(s.writes, 1);
  });
  await test(`${edition}/combined-bound-retry-checks-archive-hash`, async () => {
    const s = await create(), c = await s.candidate({ bound: true }); ok(await s.apply(c));
    ok(await s.apply(c)); assert.equal(s.writes, 1); s.records.delete(hex(c.request.requestId)); no(await s.apply(c), "CONTROL_REQUEST_NOT_FOUND");
  });
  await test(`${edition}/combined-partial-receipt-cannot-apply-other-half`, async () => {
    const s = await create(), c = await s.candidate(); const primary = production.createHybridLeaseResponseWorkflowV1({
      machine: s.machine, verification: f.verification, requests: s.reader, store: s.store });
    ok(await primary.complete(ok(await primary.prepare(s.state, s.input(s.carrier({ lease: c.lease })), f.now)).plan));
    const before = s.state; no(await s.apply(c), "COMBINED_PARTIAL_RECEIPT"); assert.equal(s.state, before); assert.equal(s.writes, 1);
  });
  await test(`${edition}/combined-time-recovery-and-control-one-state`, async () => {
    const s = await create({ recovery: true }), before = s.state, writes = s.writes, c = await s.candidate();
    ok(await s.apply(c, { observation: s.observation })); assert.equal(s.state.timeIncident, undefined);
    assert.equal(s.state.control.state, "SUSPENDED"); assert.equal(s.state.stateGeneration, before.stateGeneration + 1n);
    assert.equal(s.writes, writes + 1); no(await s.apply(c, { observation: s.observation }));
  });
  await test(`${edition}/combined-bad-control-cannot-repair-time`, async () => {
    const s = await create({ recovery: true }), before = s.state, writes = s.writes;
    const c = await s.candidate({ control: { activationId: f.bytes("wrong") } });
    no(await s.apply(c, { observation: s.observation })); assert.equal(s.state, before); assert.equal(s.writes, writes);
  });
  await test(`${edition}/combined-bad-time-evidence-cannot-suspend`, async () => {
    const s = await create({ recovery: true }), before = s.state, c = await s.candidate();
    no(await s.apply(c, { observation: { ...s.observation, bootId: f.bytes("wrong") } })); assert.equal(s.state, before);
  });
  await test(`${edition}/combined-unsupported-variants-reject-before-read`, async () => {
    const s = await create(), c = await s.candidate();
    for (const fields of [{ lease: c.lease }, { offlineControl: c.control },
      { lease: c.lease, offlineControl: c.control, trustBundle: c.control },
      { lease: c.lease, offlineControl: c.control, reactivationAuthorization: c.control }])
      no(await s.prepare(s.carrier(fields)), "RESPONSE_VARIANT_NOT_IMPLEMENTED");
    assert.equal(s.reads, 0); assert.equal(s.commits, 0);
  });
  await test(`${edition}/combined-input-snapshot-before-await`, async () => {
    const s = await create(), c = await s.candidate(), read = s.reader.read;
    s.reader.read = async id => { c.encoded.fill(0); return read(id); }; ok(await s.apply(c));
  });
  await test(`${edition}/combined-stale-CAS-never-writes-half`, async () => {
    const s = await create(), c = await s.candidate(), p = ok(await s.prepare(c.encoded)).plan;
    s.advance({ kind: "NETWORK", unavailable: true }); no(await s.workflow.complete(p), "COMMIT_STATE_CONFLICT"); assert.equal(s.writes, 0);
  });
  await test(`${edition}/combined-unknown-outcome-reconciles-with-exact-retry`, async () => {
    const s = await create(), c = await s.candidate(), commit = s.store.commit;
    s.store.commit = async p => { await commit(p); throw Error("private"); }; no(await s.apply(c), "COMMIT_OUTCOME_UNKNOWN");
    assert.equal(s.writes, 1); s.store.commit = commit; assert.equal(ok(await s.apply(c)).decision, "ADAPTER_CONFIRMED_DUPLICATE"); assert.equal(s.writes, 1);
  });
  await test(`${edition}/combined-pending-and-invalid-ack-not-success`, async () => {
    const s = await create(), c = await s.candidate();
    for (const receipt of [{ decision: "PENDING" }, { decision: "ACKNOWLEDGED", stateGeneration: 999n, stateHash: new Uint8Array(32) }]) {
      s.store.commit = async () => receipt; no(await s.apply(c));
    } assert.equal(s.writes, 0);
  });
  await test(`${edition}/combined-request-bound-mismatch-does-not-consume-either`, async () => {
    const s = await create(), before = s.state, c = await s.candidate({ bound: true, control: { action: "REVOKE" } });
    no(await s.apply(c)); assert.equal(s.state, before); assert.equal(s.writes, 0);
  });
  await test(`${edition}/combined-plan-cannot-cross-factories`, async () => {
    const s = await create(), c = await s.candidate(), p = ok(await s.prepare(c.encoded)).plan;
    no(await s.workflow.complete({ ...p }), "UNTRUSTED_RESPONSE_PLAN"); no(await s.make().complete(p), "UNTRUSTED_RESPONSE_PLAN");
    assert.equal(s.commits, 0);
  });
  await test(`${edition}/combined-network-and-independent-restriction`, async () => {
    const s = await create({ active: true }); s.advance({ kind: "INTEGRITY_INCIDENT",
      incident: { id: f.bytes("keyloss"), nonce: f.bytes("keyloss", 32), reason: "KEY_LOSS" } });
    s.advance({ kind: "NETWORK", unavailable: true }); await s.issue();
    ok(await s.apply(await s.candidate())); assert.equal(s.state.networkUnavailable, false);
    assert.equal(s.state.recoveryRequired, true); assert.equal(s.machine.project(s.state, f.now).operational, false);
  });
  await test(`${edition}/combined-equal-revision-lease-echoes-control`, async () => {
    for (const recovery of [false, true]) {
      const s = await create({ recovery }), before = s.state;
      const c = await s.candidate({ bound: recovery, lease: { controlRevision: 1n, controlState: "SUSPENDED", controlEffectiveAt: f.now, controlReasonCode: 1n } });
      ok(await s.apply(c, recovery ? { observation: s.observation } : {}));
      assert.equal(s.state.control.state, "SUSPENDED"); assert.equal(s.state.stateGeneration, before.stateGeneration + 1n);
    }
  });
  await test(`${edition}/combined-higher-lease-revision-follows-control`, async () => {
    const s = await create(); const c = await s.candidate({ lease: {
      controlRevision: 2n, controlState: "OPERATIONAL", controlEffectiveAt: f.now, controlReasonCode: 1n } });
    ok(await s.apply(c)); assert.equal(s.state.control.revision, 2n); assert.equal(s.state.control.state, "OPERATIONAL");
    assert.equal(s.writes, 1); assert(s.state.controlHistory.some(c => c.state === "SUSPENDED"));
  });
  await test(`${edition}/combined-core-bounds-and-closed-nested-command`, async () => {
    const s = await create(), c = await s.candidate(), request = f.requestSnapshot(s.request.encoded, {
      context: { workflow: "VENDOR_HTTPS_REQUEST", build: s.state.build, device: s.state.device } });
    const lease = { kind: "IMPORT_LEASE", encoded: c.lease, request, parentTokenId: s.request.parentTokenId };
    for (const command of [{ kind: "IMPORT_LEASE_CONTROL", lease, control: new Uint8Array(200000) },
      { kind: "IMPORT_LEASE_CONTROL", lease: { ...lease, encoded: new Uint8Array(200000) }, control: c.control },
      { kind: "IMPORT_LEASE_CONTROL", lease: { ...lease, kind: "IMPORT_CONTROL" }, control: c.control }]) {
      const r = s.machine.transition(s.state, command, f.now); assert.equal(r.ok, false); assert.equal(r.state, s.state);
    }
  });
  await test(`${edition}/combined-core-invalid-second-half-does-not-seal`, async () => {
    const s = await create(), c = await s.candidate({ control: { activationId: f.bytes("wrong") } });
    const request = f.requestSnapshot(s.request.encoded, { context: { workflow: "VENDOR_HTTPS_REQUEST", build: s.state.build, device: s.state.device } });
    const r = s.machine.transition(s.state, { kind: "IMPORT_LEASE_CONTROL",
      lease: { kind: "IMPORT_LEASE", encoded: c.lease, request, parentTokenId: s.request.parentTokenId }, control: c.control }, f.now);
    assert.equal(r.ok, false); assert.equal(r.state, s.state); assert.equal(r.requestConsumed, false); assert.equal(r.authoritativeStateChanged, false);
  });
}
