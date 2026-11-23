// TEST_ONLY_DO_NOT_TRUST. Real core/signatures with in-memory provider/store doubles.
import assert from "node:assert/strict";
import { runOfflineFileMatrix } from "./license-offline-file-matrix.mjs";
import { createLicenseStateFixtures } from "./license-state-fixtures.mjs";
import { TEST_ONLY_KEYS } from "../../licensing/vectors/v1/test-only/keys.mjs";
import { signEs256Rfc6979LowS } from "../../licensing/vectors/v1/lib/ecdsa-rfc6979.mjs";

export async function runLicenseOfflineRecoveryTests(production, fileMatrixOnly = false) {
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
      s.advance = (cmd, now = f.now) => { s.state = ok(machine.transition(s.state, cmd, now)).state; };
      s.incident = (tamper = false) => s.advance({ kind: "INTEGRITY_INCIDENT",
        incident: s.state.incident ?? { id: f.bytes("incident"), nonce: f.bytes("incident-nonce", 32), reason: "STORAGE_FAILURE" },
        ...(tamper ? { evidence: [{ protectionDomain: "SEALED_PROGRAMDATA", observedGeneration: 0n, protectedHighWater: 1n },
          { protectionDomain: "SEALED_REGISTRY", observedGeneration: 0n, protectedHighWater: 1n }] } : {}) });
      s.store = { commit: async p => {
        s.commits++;
        if (s.state.stateGeneration !== p.expectedPreviousGeneration || hex(s.state.stateHash) !== hex(p.expectedPreviousHash)) return { decision: "CONFLICT" };
        assert.equal(p.decision, "PROPOSED"); assert(p.commitObligations.includes("SEAL_INDEPENDENT_ANCHORS"));
        assert(p.commitObligations.includes("STAGE_COMPLETE_STATE_AND_JOURNAL"));
        s.state = p.state; s.writes++;
        return { decision: "ACKNOWLEDGED", stateGeneration: s.state.stateGeneration, stateHash: s.state.stateHash };
      } };
      s.workflow = production.createOfflineRecoveryCompletionV1({ machine, verification: f.verification,
        requests: { read: async id => { const p = s.requests.get(hex(id)); return p ? { encoded: p.encoded } : undefined; } }, store: s.store });
      s.generator = production.createOfflineRequestWorkflowV1({ machine, verification: f.verification,
        installation: { randomBytes: n => f.bytes(`recover-${++s.entropy}`, n), signInstallation: async ({ sigStructure }) => {
          s.signs++; return new Uint8Array(signEs256Rfc6979LowS(sigStructure, TEST_ONLY_KEYS.TEST_ONLY_INSTALLATION_DEVICE_PRIMARY.privateScalar));
        } }, registration: { register: async p => {
          assert.equal(hex(p.expectedStateHash), hex(s.state.stateHash)); s.requests.set(hex(p.requestId), p);
          return { decision: "REGISTERED", requestId: p.requestId, requestHash: p.requestHash };
        } },
      });
      return s;
    }
    const input = { purpose: "RECOVER", issuedAt: f.now, notAfter: f.now + 86400n };
    async function candidate(s, transition = "REPAIR_SECURE_STATE") {
      const plan = ok(await s.generator.prepare(s.state, input)).plan; ok(await s.generator.export(plan));
      const pair = s.state.current, parent = pair.entitlement.payload;
      const p = f.payload(transition === "CLEAR_TAMPER" ? "pos-recovery-clear-tamper" : "pos-recovery-repair-state");
      Object.assign(p, { tokenId: f.bytes(`repair-${++s.entropy}`), edition, installationId: s.state.device.installationId,
        licenseId: parent.licenseId, activationId: parent.activationId, entitlementTokenId: parent.tokenId,
        entitlementTokenHash: pair.entitlement.hash, entitlementGeneration: parent.generation,
        requestId: plan.requestId, requestHash: plan.requestHash, incidentId: s.state.incident.id, incidentNonce: s.state.incident.nonce,
        expectedStateGeneration: s.state.stateGeneration, newStateGeneration: s.state.stateGeneration + 1n,
        controlRevision: s.state.control.revision, allowedTransition: transition, maximumFeatures: [...parent.features],
        issuedAt: f.now, notBefore: f.now, notAfter: f.now + 3600n });
      return { plan, payload: p, input: { kind: "RECOVERY", artifact: f.sign("recovery", p), requestId: plan.requestId } };
    }
    const apply = (s, c, state = s.state, now = f.now) => s.workflow.apply(state, c.input, now);
    const resign = c => { c.input.artifact = f.sign("recovery", c.payload); };
    if (fileMatrixOnly) {
      await runOfflineFileMatrix({ edition, kind: "RECOVERY", production, f, test,
        scenario: async () => { const s = setup(); s.incident(); return { s, c: await candidate(s) }; } });
      continue;
    }
    function control(s, action) {
      const p = f.payload("pos-control-vendor-suspend"), parent = s.state.current.entitlement.payload;
      Object.assign(p, { tokenId: f.bytes(`recovery-control-${action}`), edition, licenseId: parent.licenseId, activationId: parent.activationId,
        action, controlRevision: s.state.control.revision + 1n, effectiveAt: f.now, issuedAt: f.now, notBefore: f.now, notAfter: f.now + 86400n, reasonCode: 1n });
      s.advance({ kind: "IMPORT_CONTROL", encoded: f.sign("offline-control", p) });
    }
    await test(`${edition}/request-derived-from-incident-no-effect`, async () => {
      const s = setup(); s.incident(); const before = s.state, c = await candidate(s), p = f.requestSnapshot(c.plan.encoded).payload;
      assert.equal(p.requestPurpose, "RECOVER"); assert.equal(hex(p.stateHash), hex(before.stateHash));
      assert.equal(hex(p.incidentNonce), hex(before.incident.nonce)); assert.equal(hex(p.entitlementTokenHash), hex(before.current.entitlement.hash));
      assert.equal(s.state, before); assert.equal(s.commits, 0);
    });
    await test(`${edition}/missing-incident-and-claim-overrides-rejected`, async () => {
      const s = setup(); no(await s.generator.prepare(s.state, input), "RECOVERY_INCIDENT_REQUIRED");
      no(await s.generator.prepare(s.machine.initial(), input), "RECOVERY_INCIDENT_REQUIRED"); s.incident();
      for (const field of ["incidentId", "incidentNonce", "stateHash", "entitlementTokenId", "allowedTransition", "newDevice"]) {
        no(await s.generator.prepare(s.state, { ...input, [field]: "override" }), "REQUEST_INPUT_FIELD_FORBIDDEN");
      } assert.equal(s.signs, 0);
    });
    await test(`${edition}/repair-is-one-complete-state`, async () => {
      const s = setup(); s.incident(); const before = s.state, c = await candidate(s), r = ok(await apply(s, c));
      assert.equal(r.durable, false); assert.equal(r.runtimeAuthority, "NONE"); assert.equal(s.state.recoveryRequired, false);
      assert.equal(s.state.stateGeneration, before.stateGeneration + 1n); assert.equal(s.state.consumedRecoveries.length, 1);
      assert.equal(s.state.consumedRequests.length, before.consumedRequests.length + 1); assert.equal(s.state.receipts.length, before.receipts.length + 1);
      assert.equal(hex(s.state.current.entitlement.hash), hex(before.current.entitlement.hash)); assert.equal(s.writes, 1);
    });
    await test(`${edition}/tamper-clear-preserves-separate-storage-lock`, async () => {
      const s = setup(); s.incident(); s.incident(true); ok(await apply(s, await candidate(s, "CLEAR_TAMPER")));
      assert.equal(s.state.tamperLatched, false); assert.equal(s.state.recoveryRequired, true); assert(s.state.incident);
      ok(await apply(s, await candidate(s))); assert.equal(s.state.recoveryRequired, false); assert(!s.state.incident);
    });
    await test(`${edition}/storage-repair-preserves-tamper-lock`, async () => {
      const s = setup(); s.incident(); s.incident(true); ok(await apply(s, await candidate(s)));
      assert.equal(s.state.recoveryRequired, false); assert.equal(s.state.tamperLatched, true); assert(s.state.incident);
    });
    await test(`${edition}/suspension-is-not-cleared-by-repair`, async () => {
      const s = setup(); control(s, "SUSPEND"); s.incident(); ok(await apply(s, await candidate(s)));
      assert.equal(s.machine.project(s.state, f.now).state, "SUSPENDED_LOCKED"); assert.equal(s.state.control.revision, 1n);
    });
    await test(`${edition}/expired-license-is-not-extended`, async () => {
      const s = setup(); s.incident(); const expiry = s.state.current.entitlement.payload.graceUntil;
      ok(await apply(s, await candidate(s))); assert.equal(s.machine.project(s.state, expiry).state, "EXPIRED_LOCKED");
      assert.equal(s.state.current.entitlement.payload.graceUntil, expiry);
    });
    await test(`${edition}/terminal-revoke-cannot-use-recover-request`, async () => {
      const s = setup(); control(s, "REVOKE"); s.incident(); no(await s.generator.prepare(s.state, input), "REACTIVATION_REQUIRED");
      assert.equal(s.signs, 0); assert.equal(s.state.tombstones.length, 1);
    });
    await test(`${edition}/replay-remains-strict-single-use`, async () => {
      const s = setup(); s.incident(); const c = await candidate(s); ok(await apply(s, c)); const before = s.state;
      no(await apply(s, c), "RECOVERY_TOKEN_REPLAYED"); assert.equal(s.state, before); assert.equal(s.commits, 1);
    });
    await test(`${edition}/wrong-incident-state-and-transition-neutral`, async () => {
      const s = setup(); s.incident(); const before = s.state;
      for (const patch of [{ incidentId: f.bytes("wrong") }, { incidentNonce: f.bytes("wrong", 32) },
        { expectedStateGeneration: 0n }, { newStateGeneration: s.state.stateGeneration + 2n }, { allowedTransition: "CLEAR_TAMPER" }]) {
        const c = await candidate(s); Object.assign(c.payload, patch); resign(c); no(await apply(s, c));
      } assert.equal(s.state, before); assert.equal(s.commits, 0);
    });
    await test(`${edition}/wrong-request-and-installation-neutral`, async () => {
      const s = setup(); s.incident(); const c = await candidate(s), d = await candidate(s);
      no(await apply(s, { input: { ...c.input, requestId: d.plan.requestId } }));
      c.payload.installationId = f.bytes("wrong-installation"); resign(c); no(await apply(s, c)); assert.equal(s.commits, 0);
    });
    await test(`${edition}/wrong-signer-tamper-and-expired-token-neutral`, async () => {
      const s = setup(); s.incident(); const c = await candidate(s);
      c.input.artifact = f.sign("recovery", c.payload, "TEST_ONLY_OFFLINE_CONTROL_PRIMARY"); no(await apply(s, c));
      resign(c); c.input.artifact[c.input.artifact.length - 1] ^= 1; no(await apply(s, c));
      resign(c); no(await apply(s, c, s.state, f.now + 3600n)); assert.equal(s.commits, 0);
    });
    await test(`${edition}/failed-and-pending-commit-no-completion`, async () => {
      const s = setup(); s.incident(); const c = await candidate(s), before = s.state;
      s.store.commit = async () => ({ decision: "PENDING" }); no(await apply(s, c), "COMMIT_PENDING");
      s.store.commit = async () => { throw Error("SECRET_CANARY"); }; const r = await apply(s, c);
      no(r, "COMMIT_OUTCOME_UNKNOWN"); assert(!JSON.stringify(r).includes("SECRET_CANARY")); assert.equal(s.state, before);
    });
    await test(`${edition}/lost-ack-cannot-replay-or-rollback-repair`, async () => {
      const s = setup(); s.incident(); const c = await candidate(s), commit = s.store.commit;
      s.store.commit = async p => { await commit(p); throw Error("lost ack"); };
      no(await apply(s, c), "COMMIT_OUTCOME_UNKNOWN"); assert.equal(s.state.recoveryRequired, false);
      s.store.commit = commit; no(await apply(s, c), "RECOVERY_TOKEN_REPLAYED"); assert.equal(s.writes, 1);
    });
    await test(`${edition}/concurrent-repairs-only-one-commit`, async () => {
      const s = setup(); s.incident(); const c = await candidate(s), d = await candidate(s), before = s.state;
      const results = await Promise.all([apply(s, c, before), apply(s, d, before)]);
      assert.equal(results.filter(r => r.ok).length, 1); assert.equal(results.find(r => !r.ok).errorCode, "COMMIT_STATE_CONFLICT"); assert.equal(s.writes, 1);
    });
    await test(`${edition}/pending-successor-is-not-recovery-parent`, async () => {
      const s = setup(), parent = s.state.current.entitlement.payload;
      const plan = ok(await s.generator.prepare(s.state, { ...input, purpose: "RENEW" })).plan;
      const p = f.clone(parent); Object.assign(p, { tokenId: f.bytes("pending"), generation: 2n, previousTokenId: parent.tokenId,
        requestId: plan.requestId, requestHash: plan.requestHash, notBefore: f.now + 86400n, termStartsAt: f.now + 86400n });
      s.advance({ kind: "IMPORT_ENTITLEMENT", encoded: f.sign("entitlement", p), request: f.requestSnapshot(plan.encoded) });
      assert(s.state.pending); s.incident(); const c = await candidate(s), request = f.requestSnapshot(c.plan.encoded).payload;
      assert.equal(request.entitlementGeneration, 1n); assert.equal(s.state.entitlementGeneration, 2n);
      ok(await apply(s, c)); assert.equal(s.state.pending.entitlement.payload.generation, 2n); assert.equal(s.state.entitlementGeneration, 2n);
    });
    await test(`${edition}/recovery-facade-rejects-other-intents-and-forged-state`, async () => {
      const s = setup(); s.incident(); const c = await candidate(s);
      no(await s.workflow.apply(s.state, { ...c.input, kind: "CONTROL" }, f.now), "RECOVERY_COMPLETION_ONLY");
      no(await apply(s, c, { ...s.state }), "UNTRUSTED_MODEL_STATE"); assert.equal(s.commits, 0);
    });
    await test(`${edition}/rebind-response-is-not-generic-recover`, async () => {
      const s = setup(); s.incident(); const c = await candidate(s);
      Object.assign(c.payload, { allowedTransition: "REBIND_DEVICE", oldDeviceKeyId: s.state.device.deviceKeyId,
        newDeviceKeyId: s.state.device.deviceKeyId, newAssurance: "SOFTWARE_BOUND" }); resign(c);
      no(await apply(s, c)); assert.equal(s.commits, 0);
    });
  }
  assert.equal(new Set(ids).size, ids.length);
  return { attempted: ids.length, passed: ids.length - failures.length, failures };
}
