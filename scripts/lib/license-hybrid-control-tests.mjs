// TEST_ONLY_DO_NOT_TRUST. Real signatures/core; in-memory request and Store doubles.
import assert from "node:assert/strict";
import { createLicenseStateFixtures } from "./license-state-fixtures.mjs";
import { TEST_ONLY_KEYS } from "../../licensing/vectors/v1/test-only/keys.mjs";
import { signEs256Rfc6979LowS } from "../../licensing/vectors/v1/lib/ecdsa-rfc6979.mjs";

export async function runLicenseHybridControlTests(production) {
  const ids = [], failures = [], hex = b => Buffer.from(b).toString("hex");
  const ok = r => { assert(r.ok, `${r.stage}/${r.errorCode}`); return r; };
  const no = (r, code) => { assert.equal(r.ok, false); if (code) assert.equal(r.errorCode, code);
    assert.equal(r.durable, false); assert.equal(r.runtimeAuthority, "NONE"); };
  const test = async (id, run) => { ids.push(id); try { await run(); } catch (e) { failures.push({ id, message: e.stack }); } };
  for (const edition of ["FULL", "ATTENDANCE"]) {
    const f = createLicenseStateFixtures(production, { edition });
    async function setup() {
      const machine = production.core.createLicenseStateMachineV1(f.configuration);
      const s = { machine, state: ok(machine.transition(machine.initial(), f.initialActivation({ mode: "HYBRID_LEASED" }).command, f.now)).state,
        records: new Map(), reads: [], writes: 0, commits: 0, counter: 0 };
      s.advance = command => { s.state = ok(machine.transition(s.state, command, f.now)).state; };
      s.installation = { randomBytes: n => f.bytes(`control-id-${++s.counter}`, n), signInstallation: async ({ sigStructure }) =>
        new Uint8Array(signEs256Rfc6979LowS(sigStructure, TEST_ONLY_KEYS.TEST_ONLY_INSTALLATION_DEVICE_PRIMARY.privateScalar)) };
      s.registration = { register: async p => { s.records.set(hex(p.requestId), p);
        return { decision: "REGISTERED", requestId: p.requestId, requestHash: p.requestHash }; } };
      s.reader = { read: async id => { s.reads.push(hex(id)); return s.records.get(hex(id)); } };
      s.store = { commit: async p => {
        s.commits++;
        if (s.state.stateGeneration !== p.expectedPreviousGeneration || hex(s.state.stateHash) !== hex(p.expectedPreviousHash)) return { decision: "CONFLICT" };
        if (p.decision === "PROPOSED") { assert(p.commitObligations.includes("RECONCILE_RESTRICTIVE_TRANSITION_BEFORE_REPORTING_EFFECTIVE"));
          assert(p.commitObligations.includes("STAGE_COMPLETE_STATE_AND_JOURNAL")); s.state = p.state; s.writes++; }
        return { decision: "ACKNOWLEDGED", stateGeneration: s.state.stateGeneration, stateHash: s.state.stateHash };
      } };
      s.transport = production.createHybridRequestWorkflowV1({ machine, verification: f.verification, installation: s.installation,
        registration: s.registration, challenge: { acquire: async () => production.core.encodeDeterministicCborV1(new Map(Object.entries({
          schemaVersion: 1n, carrierType: "lease-challenge", requestNonce: f.bytes(`nonce-${s.counter}`, 32), expiresInSeconds: 300n }))) } });
      s.control = production.createOfflineRequestWorkflowV1({ machine, verification: f.verification, installation: s.installation, registration: s.registration });
      s.workflow = production.createHybridControlResponseWorkflowV1({ machine, verification: f.verification, requests: s.reader, store: s.store });
      s.issue = async () => { s.request = ok(await s.transport.prepare(s.state, { purpose: "CHECK_IN", target: "PENDING" })).plan;
        ok(await s.transport.release(s.request)); };
      s.wrap = fields => production.core.encodeDeterministicCborV1(new Map(Object.entries({
        schemaVersion: 1n, carrierType: "lease-response", requestId: s.request.requestId, ...fields })));
      s.candidate = async ({ bound = false, action = "SUSPEND", effectiveAt = f.now, changes = {} } = {}) => {
        let request;
        if (bound) { request = ok(await s.control.prepare(s.state, { purpose: "CONTROL", issuedAt: f.now,
          notAfter: f.now + 86400n, action, effectiveAt, reasonCode: 1n })).plan; ok(await s.control.export(request)); }
        const parent = s.state.pending.entitlement.payload, payload = f.payload("pos-control-vendor-suspend");
        Object.assign(payload, { edition, tokenId: f.bytes(`command-${++s.counter}`), licenseId: parent.licenseId, activationId: parent.activationId,
          issuedAt: f.now, notBefore: f.now, notAfter: f.now + 86400n, action, effectiveAt, reasonCode: 1n,
          controlRevision: s.state.control.revision + 1n, origin: bound ? "REQUEST_BOUND" : "VENDOR_INITIATED",
          ...(bound ? { requestId: request.requestId, requestHash: request.requestHash } : {}), ...changes });
        const artifact = f.sign("offline-control", payload);
        return { artifact, payload, request, input: { encoded: s.wrap({ offlineControl: artifact }), requestId: s.request.requestId } };
      };
      await s.issue(); return s;
    }
    const apply = (s, c, at = f.now) => s.workflow.apply(s.state, c.input, at);
    const rewriteRequest = (s, changes) => {
      const payload = ok(f.verifier.verifySignedObject({ expectedType: "lease-request", encoded: s.request.encoded,
        context: { workflow: "VENDOR_HTTPS_REQUEST", build: s.state.build, device: s.state.device } })).value.payload;
      const changed = { ...f.clone(payload), ...changes };
      s.records.set(hex(changed.requestId), { encoded: f.sign("lease-request", changed) });
    };
    await test(`${edition}/vendor-suspend-does-not-consume-lease-or-create-pair`, async () => {
      const s = await setup(), before = s.state, c = await s.candidate();
      const r = ok(await apply(s, c)); assert.equal(r.decision, "ADAPTER_ACKNOWLEDGED");
      assert.equal(s.state.control.state, "SUSPENDED"); assert.equal(s.state.leaseRevision, before.leaseRevision);
      assert.equal(s.state.consumedRequests.length, before.consumedRequests.length); assert.equal(s.state.current, undefined);
      assert.equal(s.machine.project(s.state, f.now).operational, false); assert.deepEqual(s.reads, [hex(s.request.requestId)]);
    });
    await test(`${edition}/request-bound-control-resolves-own-request`, async () => {
      const s = await setup(), c = await s.candidate({ bound: true }); ok(await apply(s, c));
      assert.deepEqual(s.reads, [hex(s.request.requestId), hex(c.request.requestId)]);
      assert(s.state.consumedRequests.some(r => hex(r.id) === hex(c.request.requestId)));
      assert(!s.state.consumedRequests.some(r => hex(r.id) === hex(s.request.requestId)));
    });
    await test(`${edition}/unsigned-carrier-id-cannot-substitute-control-request`, async () => {
      const s = await setup(), c = await s.candidate({ bound: true, changes: { requestId: new Uint8Array(16) } });
      no(await apply(s, c), "OUTSTANDING_REQUEST_NOT_FOUND"); assert.equal(s.commits, 0);
    });
    await test(`${edition}/mixed-and-noncontrol-variants-refuse-before-read`, async () => {
      const s = await setup(), c = await s.candidate();
      for (const fields of [{ lease: c.artifact }, { reactivationAuthorization: c.artifact },
        { offlineControl: c.artifact, lease: c.artifact }, { offlineControl: c.artifact, trustBundle: c.artifact },
        { offlineControl: c.artifact, reactivationAuthorization: c.artifact }])
        no(await apply(s, { input: { encoded: s.wrap(fields), requestId: s.request.requestId } }), "CONTROL_RESPONSE_VARIANT_NOT_IMPLEMENTED");
      assert.equal(s.reads.length, 0); assert.equal(s.commits, 0);
    });
    await test(`${edition}/bounded-closed-input-and-id`, async () => {
      const s = await setup(), c = await s.candidate();
      for (const encoded of [new Uint8Array(), new Uint8Array(524289), new Uint8Array([0xff]), "bad"]) no(await apply(s, { input: { ...c.input, encoded } }));
      no(await apply(s, { input: { ...c.input, requestId: f.bytes("wrong") } }), "CONTROL_RESPONSE_REQUEST_ID_MISMATCH");
      no(await apply(s, { input: { ...c.input, action: "UNSUSPEND" } }), "CONTROL_RESPONSE_INPUT_INVALID");
      assert.equal(s.reads.length, 0);
    });
    await test(`${edition}/request-reader-unavailable-missing-and-redacted`, async () => {
      const s = await setup(), c = await s.candidate(); s.records.clear(); no(await apply(s, c), "OUTSTANDING_REQUEST_NOT_FOUND");
      s.reader.read = async () => { throw Error("PRIVATE_PATH"); }; const r = await apply(s, c);
      no(r, "REQUEST_STORE_UNAVAILABLE"); assert(!JSON.stringify(r).includes("PRIVATE_PATH"));
    });
    await test(`${edition}/stored-request-mismatch-and-signature`, async () => {
      const s = await setup(), c = await s.candidate(), old = s.request; await s.issue();
      s.records.set(hex(old.requestId), s.request); no(await apply(s, c), "STORED_REQUEST_ID_MISMATCH");
      const bad = new Uint8Array(old.encoded); bad[bad.length - 1] ^= 1;
      s.records.set(hex(old.requestId), { encoded: bad }); no(await apply(s, c)); assert.equal(s.commits, 0);
    });
    await test(`${edition}/signed-control-bindings-and-signature`, async () => {
      const s = await setup();
      for (const changes of [{ edition: edition === "FULL" ? "ATTENDANCE" : "FULL" },
        { activationId: f.bytes("wrong") }, { licenseId: f.bytes("wrong") }]) no(await apply(s, await s.candidate({ changes })));
      const c = await s.candidate(); c.artifact[c.artifact.length - 1] ^= 1;
      c.input.encoded = s.wrap({ offlineControl: c.artifact }); no(await apply(s, c)); assert.equal(s.commits, 0);
      for (const signer of ["TEST_ONLY_ONLINE_LEASE_PRIMARY", "TEST_ONLY_OFFLINE_CONTROL_DENIED", "TEST_ONLY_OFFLINE_CONTROL_WRONG_ENV"]) {
        const payload = { ...c.payload, keyId: new Uint8Array(TEST_ONLY_KEYS[signer].kid) };
        c.input.encoded = s.wrap({ offlineControl: f.sign("offline-control", payload, signer) }); no(await apply(s, c));
      }
      assert.equal(s.commits, 0);
    });
    await test(`${edition}/request-bound-action-hash-and-missing-record`, async () => {
      const s = await setup();
      for (const changes of [{ action: "REVOKE" }, { requestHash: f.bytes("wrong", 32) }]) no(await apply(s, await s.candidate({ bound: true, changes })));
      const c = await s.candidate({ bound: true }); s.records.delete(hex(c.request.requestId)); no(await apply(s, c));
      assert.equal(s.commits, 0);
    });
    await test(`${edition}/exact-vendor-retry-after-expiry-is-readonly`, async () => {
      const s = await setup(), c = await s.candidate(); ok(await apply(s, c)); const before = s.state;
      const r = ok(await apply(s, c, f.now + 90000n)); assert.equal(r.decision, "ADAPTER_CONFIRMED_DUPLICATE");
      assert.equal(s.state, before); assert.equal(s.writes, 1);
    });
    await test(`${edition}/exact-bound-retry-uses-own-archive`, async () => {
      const s = await setup(), c = await s.candidate({ bound: true }); ok(await apply(s, c));
      assert.equal(ok(await apply(s, c, f.now + 90000n)).decision, "ADAPTER_CONFIRMED_DUPLICATE"); assert.equal(s.writes, 1);
      s.records.delete(hex(c.request.requestId)); no(await apply(s, c), "OUTSTANDING_REQUEST_NOT_FOUND");
    });
    await test(`${edition}/fresh-command-needs-current-request`, async () => {
      const s = await setup(), c = await s.candidate(); s.advance({ kind: "NETWORK", unavailable: true });
      no(await apply(s, c), "CONTROL_RESPONSE_REQUEST_NOT_OUTSTANDING"); assert.equal(s.commits, 0);
    });
    await test(`${edition}/input-copied-before-await`, async () => {
      const s = await setup(), c = await s.candidate(), read = s.reader.read;
      s.reader.read = async id => { c.input.encoded.fill(0); c.input.requestId.fill(0); return read(id); };
      ok(await apply(s, c));
    });
    await test(`${edition}/state-provenance-and-CAS-after-await`, async () => {
      const s = await setup(), c = await s.candidate(); no(await s.workflow.apply({ ...s.state }, c.input, f.now));
      assert.equal(s.reads.length, 0); const read = s.reader.read;
      s.reader.read = async id => { s.advance({ kind: "NETWORK", unavailable: true }); return read(id); };
      no(await apply(s, c), "COMMIT_STATE_CONFLICT"); assert.equal(s.writes, 0);
    });
    await test(`${edition}/pending-conflict-bad-and-lost-ack`, async () => {
      const s = await setup(), c = await s.candidate(), commit = s.store.commit;
      for (const receipt of [{ decision: "PENDING" }, { decision: "CONFLICT" }, undefined,
        { decision: "ACKNOWLEDGED", stateGeneration: 999n, stateHash: new Uint8Array(32) }]) {
        s.store.commit = async () => receipt; const r = await apply(s, c); no(r); assert(r.commitAttempted);
      }
      s.store.commit = async p => { await commit(p); throw Error("private"); }; no(await apply(s, c), "COMMIT_OUTCOME_UNKNOWN");
      s.store.commit = commit; assert.equal(ok(await apply(s, c)).decision, "ADAPTER_CONFIRMED_DUPLICATE"); assert.equal(s.writes, 1);
    });
    await test(`${edition}/higher-unsuspend-is-not-a-lease-grant`, async () => {
      const s = await setup(); ok(await apply(s, await s.candidate())); await s.issue();
      ok(await apply(s, await s.candidate({ action: "UNSUSPEND" }))); assert.equal(s.state.control.state, "OPERATIONAL");
      assert.equal(s.machine.project(s.state, f.now).operational, false); assert.equal(s.state.leaseRevision, 0n);
    });
    await test(`${edition}/revoke-is-terminal-and-cannot-unsuspend`, async () => {
      const s = await setup(); ok(await apply(s, await s.candidate({ action: "REVOKE" }))); assert.equal(s.state.tombstones.length, 1);
      await s.issue(); no(await apply(s, await s.candidate({ action: "UNSUSPEND" }))); assert.equal(s.writes, 1);
    });
    await test(`${edition}/scheduled-suspend-and-network-flag-preserved`, async () => {
      const s = await setup(); s.advance({ kind: "NETWORK", unavailable: true }); await s.issue();
      ok(await apply(s, await s.candidate({ effectiveAt: f.now + 120n })));
      assert.equal(s.state.networkUnavailable, true); assert.equal(s.state.control.effectiveAt, f.now + 120n);
      assert.equal(s.state.tamperLatched, false); assert.equal(s.state.recoveryRequired, false);
    });
    await test(`${edition}/time-recovery-cannot-use-control-only-response`, async () => {
      const s = await setup(), c = await s.candidate(); rewriteRequest(s, { requestPurpose: "TIME_RECOVERY",
        incidentId: f.bytes("incident"), incidentNonce: f.bytes("incident", 32), preIncidentClockHighWater: s.state.clockHighWater });
      no(await apply(s, c), "CONTROL_RESPONSE_CHECK_IN_REQUIRED"); assert.equal(s.commits, 0);
    });
    await test(`${edition}/signed-transport-parent-and-counter-mismatches`, async () => {
      const s = await setup(), c = await s.candidate();
      for (const changes of [{ entitlementTokenId: f.bytes("wrong-parent") }, { entitlementGeneration: 9n },
        { activationId: f.bytes("wrong-activation") }, { stateGeneration: 999n }, { lastLeaseRevision: 999n },
        { controlRevision: 99n }, { controlEffectiveAt: f.now + 1n }]) { rewriteRequest(s, changes); no(await apply(s, c)); }
      assert.equal(s.commits, 0);
    });
    await test(`${edition}/consumed-transport-id-cannot-dispatch-new-command`, async () => {
      const s = await setup(), c = await s.candidate(), consumed = s.state.consumedRequests[0].id;
      rewriteRequest(s, { requestId: consumed }); c.input = { encoded: s.wrap({ offlineControl: c.artifact, requestId: consumed }), requestId: consumed };
      no(await apply(s, c), "CONTROL_RESPONSE_REQUEST_NOT_OUTSTANDING"); assert.equal(s.commits, 0);
    });
    await test(`${edition}/control-cannot-clear-independent-recovery-restriction`, async () => {
      const s = await setup(); s.advance({ kind: "INTEGRITY_INCIDENT",
        incident: { id: f.bytes("incident"), nonce: f.bytes("incident", 32), reason: "KEY_LOSS" } });
      await s.issue(); ok(await apply(s, await s.candidate())); await s.issue();
      ok(await apply(s, await s.candidate({ action: "UNSUSPEND" })));
      assert.equal(s.state.recoveryRequired, true); assert.equal(s.machine.project(s.state, f.now).operational, false);
    });
  }
  assert.equal(new Set(ids).size, ids.length);
  return { attempted: ids.length, passed: ids.length - failures.length, failures };
}
