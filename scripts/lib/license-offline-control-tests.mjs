// TEST_ONLY_DO_NOT_TRUST: portable providers and atomic store double only.
import assert from "node:assert/strict";
import { runOfflineFileMatrix } from "./license-offline-file-matrix.mjs";
import { createLicenseStateFixtures } from "./license-state-fixtures.mjs";
import { TEST_ONLY_KEYS } from "../../licensing/vectors/v1/test-only/keys.mjs";
import { signEs256Rfc6979LowS } from "../../licensing/vectors/v1/lib/ecdsa-rfc6979.mjs";

export async function runLicenseOfflineControlTests(production, fileMatrixOnly = false) {
  const ids = [], failures = [], hex = b => Buffer.from(b).toString("hex");
  const ok = r => { assert(r.ok, `${r.stage}/${r.errorCode}`); return r; };
  const no = (r, code) => { assert.equal(r.ok, false); if (code) assert.equal(r.errorCode, code); assert.equal(r.runtimeAuthority, "NONE"); };
  const test = async (id, run) => { ids.push(id); try { await run(); } catch (e) { failures.push({ id, message: e.stack ?? String(e) }); } };
  for (const edition of ["FULL", "ATTENDANCE"]) {
    const f = createLicenseStateFixtures(production, { edition });
    function setup() {
      const machine = production.core.createLicenseStateMachineV1(f.configuration);
      const s = { machine, state: ok(machine.transition(machine.initial(), f.initialActivation().command, f.now)).state,
        requests: new Map(), entropy: 0, signs: 0, commits: 0, writes: 0 };
      s.store = { commit: async p => {
        s.commits++;
        if (s.state.stateGeneration !== p.expectedPreviousGeneration || hex(s.state.stateHash) !== hex(p.expectedPreviousHash)) return { decision: "CONFLICT" };
        if (p.decision === "PROPOSED") {
          assert(p.commitObligations.includes("RECONCILE_RESTRICTIVE_TRANSITION_BEFORE_REPORTING_EFFECTIVE"));
          assert(p.commitObligations.includes("STAGE_COMPLETE_STATE_AND_JOURNAL"));
          s.state = p.state; s.writes++;
        } else { assert.equal(p.state, s.state); assert.equal(p.commitObligations.length, 0); }
        return { decision: "ACKNOWLEDGED", stateGeneration: s.state.stateGeneration, stateHash: s.state.stateHash };
      } };
      s.reader = { read: async id => { const r = s.requests.get(hex(id)); return r ? { encoded: r.encoded } : undefined; } };
      s.workflow = production.createOfflineControlCompletionV1({ machine, verification: f.verification, requests: s.reader, store: s.store });
      s.generator = production.createOfflineRequestWorkflowV1({ machine, verification: f.verification,
        installation: { randomBytes: n => f.bytes(`control-${++s.entropy}`, n), signInstallation: async ({ sigStructure }) => {
          s.signs++; return new Uint8Array(signEs256Rfc6979LowS(sigStructure, TEST_ONLY_KEYS.TEST_ONLY_INSTALLATION_DEVICE_PRIMARY.privateScalar));
        } },
        registration: { register: async p => {
          assert.equal(hex(p.expectedStateHash), hex(s.state.stateHash)); assert(!s.requests.has(hex(p.requestId)));
          s.requests.set(hex(p.requestId), p); return { decision: "REGISTERED", requestId: p.requestId, requestHash: p.requestHash };
        } },
      });
      return s;
    }
    const input = (action = "SUSPEND", effectiveAt = f.now) => ({ purpose: "CONTROL", issuedAt: f.now, notAfter: f.now + 86400n, action, effectiveAt, reasonCode: 1n });
    async function candidate(s, { action = "SUSPEND", effectiveAt = f.now, vendor = false } = {}) {
      let plan;
      if (!vendor) { plan = ok(await s.generator.prepare(s.state, input(action, effectiveAt))).plan; ok(await s.generator.export(plan)); }
      const parent = (s.state.pending ?? s.state.current).entitlement.payload;
      const p = f.payload("pos-control-vendor-suspend");
      Object.assign(p, { edition, tokenId: f.bytes(`control-token-${++s.entropy}`), licenseId: parent.licenseId, activationId: parent.activationId,
        issuedAt: f.now, notBefore: f.now, notAfter: f.now + 86400n, action, effectiveAt, reasonCode: 1n,
        controlRevision: s.state.control.revision + 1n, origin: vendor ? "VENDOR_INITIATED" : "REQUEST_BOUND" });
      if (plan) Object.assign(p, { requestId: plan.requestId, requestHash: plan.requestHash });
      const c = { plan, payload: p, input: { kind: "CONTROL", artifact: f.sign("offline-control", p), ...(plan ? { requestId: plan.requestId } : {}) } };
      return c;
    }
    const apply = (s, c, state = s.state) => s.workflow.apply(state, c.input, f.now);
    const resign = c => { c.input.artifact = f.sign("offline-control", c.payload); };
    if (fileMatrixOnly) {
      await runOfflineFileMatrix({ edition, kind: "CONTROL", production, f, test,
        scenario: async () => { const s = setup();  return { s, c: await candidate(s) }; } });
      continue;
    }
    await test(`${edition}/request-derives-binding-and-does-not-suspend`, async () => {
      const s = setup(), before = s.state, c = await candidate(s);
      const p = ok(f.verifier.verifySignedObject({ expectedType: "activation-request", encoded: c.plan.encoded })).value.payload;
      assert.equal(p.requestPurpose, "CONTROL"); assert.equal(p.controlAction, "SUSPEND"); assert.equal(p.controlEffectiveAt, f.now);
      assert.equal(p.controlReasonCode, 1n); assert.equal(p.controlRevision, 0n); assert.equal(p.stateGeneration, s.state.stateGeneration);
      assert.equal(hex(p.licenseId), hex(s.state.current.entitlement.payload.licenseId)); assert.equal(p.edition, edition);
      assert.equal(s.state, before); assert.equal(s.commits, 0); assert.equal(s.machine.project(s.state, f.now).state, "ACTIVE");
    });
    await test(`${edition}/invalid-intent-before-signing`, async () => {
      const s = setup();
      for (const bad of [{ action: "DELETE" }, { reasonCode: 0n }, { reasonCode: 6n }, { reasonCode: 1 }, { effectiveAt: -1n }, { licenseId: new Uint8Array(16) }]) no(await s.generator.prepare(s.state, { ...input(), ...bad }));
      no(await s.generator.prepare(s.machine.initial(), input()), "CONTROL_REQUIRES_LINEAGE"); assert.equal(s.signs, 0);
    });
    await test(`${edition}/request-bound-suspend-complete-state`, async () => {
      const s = setup(), c = await candidate(s), before = s.state;
      const r = ok(await apply(s, c)); assert.equal(r.durable, false); assert.equal(r.runtimeAuthority, "NONE");
      assert.equal(s.state.control.revision, 1n); assert.equal(s.machine.project(s.state, f.now).state, "SUSPENDED_LOCKED");
      assert.equal(s.state.consumedRequests.length, before.consumedRequests.length + 1); assert.equal(s.state.receipts.length, before.receipts.length + 1);
    });
    await test(`${edition}/higher-unsuspend-restores-only-reversible-control`, async () => {
      const s = setup(); ok(await apply(s, await candidate(s)));
      ok(await apply(s, await candidate(s, { action: "UNSUSPEND" })));
      assert.equal(s.state.control.revision, 2n); assert.equal(s.machine.project(s.state, f.now).state, "ACTIVE");
    });
    await test(`${edition}/terminal-revoke-cannot-be-unsuspended`, async () => {
      const s = setup(); ok(await apply(s, await candidate(s, { action: "REVOKE" })));
      assert.equal(s.machine.project(s.state, f.now).state, "REVOKED_LOCKED"); assert.equal(s.state.tombstones.length, 1);
      const before = s.state; no(await apply(s, await candidate(s, { action: "UNSUSPEND" })));
      assert.equal(s.state, before); assert.equal(s.writes, 1);
    });
    await test(`${edition}/vendor-control-needs-no-request`, async () => {
      const s = setup(), before = s.state.consumedRequests.length;
      s.reader.read = async () => { throw Error("must not read"); };
      ok(await apply(s, await candidate(s, { vendor: true }))); assert.equal(s.state.consumedRequests.length, before);
    });
    await test(`${edition}/future-control-remains-scheduled`, async () => {
      const s = setup(); ok(await apply(s, await candidate(s, { effectiveAt: f.now + 300n })));
      assert.equal(s.machine.project(s.state, f.now).state, "ACTIVE"); assert.equal(s.state.control.revision, 1n);
      const p = ok(s.machine.transition(s.state, { kind: "REEVALUATE" }, f.now + 300n)); await s.store.commit(p);
      assert.equal(s.machine.project(s.state, f.now + 300n).state, "SUSPENDED_LOCKED");
    });
    await test(`${edition}/exact-retry-is-read-only`, async () => {
      const s = setup(), c = await candidate(s); ok(await apply(s, c)); const before = s.state;
      assert.equal(ok(await apply(s, c)).decision, "ADAPTER_CONFIRMED_DUPLICATE"); assert.equal(s.state, before); assert.equal(s.writes, 1);
    });
    await test(`${edition}/action-time-reason-mismatch-neutral`, async () => {
      const s = setup();
      for (const change of [{ action: "REVOKE" }, { effectiveAt: f.now + 1n }, { reasonCode: 2n }]) {
        const c = await candidate(s); Object.assign(c.payload, change); resign(c); no(await apply(s, c));
      } assert.equal(s.commits, 0);
    });
    await test(`${edition}/wrong-signer-and-tamper-neutral`, async () => {
      const s = setup(), c = await candidate(s);
      c.input.artifact = f.sign("offline-control", c.payload, "TEST_ONLY_ONLINE_LEASE_PRIMARY"); no(await apply(s, c));
      resign(c); c.input.artifact[c.input.artifact.length - 1] ^= 1; no(await apply(s, c)); assert.equal(s.commits, 0);
    });
    await test(`${edition}/duplicate-must-retain-request-id-and-hash-correlation`, async () => {
      const s = setup(), c = await candidate(s), other = await candidate(s); ok(await apply(s, c));
      no(await apply(s, { input: { ...c.input, requestId: other.plan.requestId } }), "OFFLINE_RESPONSE_REQUEST_MISMATCH");
      const p = f.clone(f.requestSnapshot(c.plan.encoded).payload); p.requestNonce = f.bytes("altered-archive", 32);
      s.requests.set(hex(c.plan.requestId), { encoded: f.sign("activation-request", p) });
      no(await apply(s, c), "OFFLINE_RESPONSE_REQUEST_MISMATCH"); assert.equal(s.commits, 1);
    });
    await test(`${edition}/request-bound-retry-cannot-drop-request`, async () => {
      const s = setup(), c = await candidate(s); ok(await apply(s, c));
      no(await apply(s, { input: { kind: "CONTROL", artifact: c.input.artifact } }), "OUTSTANDING_REQUEST_REQUIRED"); assert.equal(s.commits, 1);
    });
    await test(`${edition}/vendor-retry-cannot-acquire-request`, async () => {
      const s = setup(), request = await candidate(s), vendor = await candidate(s, { vendor: true }); ok(await apply(s, vendor));
      no(await apply(s, { input: { ...vendor.input, requestId: request.plan.requestId } }), "CONTROL_REQUEST_MISMATCH"); assert.equal(s.commits, 1);
    });
    await test(`${edition}/same-revision-different-token-rejected`, async () => {
      const s = setup(), c = await candidate(s); ok(await apply(s, c));
      const d = await candidate(s); d.payload.controlRevision = 1n; resign(d); no(await apply(s, d)); assert.equal(s.writes, 1);
    });
    await test(`${edition}/pending-commit-never-reports-effective`, async () => {
      const s = setup(), c = await candidate(s), before = s.state;
      s.store.commit = async () => ({ decision: "PENDING" }); no(await apply(s, c), "COMMIT_PENDING"); assert.equal(s.state, before);
    });
    await test(`${edition}/lost-ack-preserves-restriction-and-retries-read-only`, async () => {
      const s = setup(), c = await candidate(s), commit = s.store.commit;
      s.store.commit = async p => { await commit(p); throw Error("SECRET_CANARY"); };
      const r = await apply(s, c); no(r, "COMMIT_OUTCOME_UNKNOWN"); assert(!JSON.stringify(r).includes("SECRET_CANARY"));
      assert.equal(s.machine.project(s.state, f.now).state, "SUSPENDED_LOCKED"); s.store.commit = commit;
      assert.equal(ok(await apply(s, c)).decision, "ADAPTER_CONFIRMED_DUPLICATE"); assert.equal(s.writes, 1);
    });
    await test(`${edition}/concurrent-controls-do-not-overwrite`, async () => {
      const s = setup(), a = await candidate(s), b = await candidate(s), state = s.state;
      const results = await Promise.all([apply(s, a, state), apply(s, b, state)]);
      assert.equal(results.filter(r => r.ok).length, 1); assert.equal(results.find(r => !r.ok).errorCode, "COMMIT_STATE_CONFLICT"); assert.equal(s.writes, 1);
    });
    await test(`${edition}/control-completion-rejects-other-intents`, async () => {
      const s = setup(), c = await candidate(s);
      no(await s.workflow.apply(s.state, { ...c.input, kind: "ENTITLEMENT" }, f.now), "CONTROL_COMPLETION_ONLY"); assert.equal(s.commits, 0);
    });
  }
  assert.equal(new Set(ids).size, ids.length);
  return { attempted: ids.length, passed: ids.length - failures.length, failures };
}
