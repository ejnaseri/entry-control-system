// TEST_ONLY_DO_NOT_TRUST. Real production signatures/state, in-memory adapters.
import assert from "node:assert/strict";
import { runOfflineFileMatrix } from "./license-offline-file-matrix.mjs";
import { createLicenseStateFixtures } from "./license-state-fixtures.mjs";
import { TEST_ONLY_KEYS } from "../../licensing/vectors/v1/test-only/keys.mjs";
import { signEs256Rfc6979LowS } from "../../licensing/vectors/v1/lib/ecdsa-rfc6979.mjs";

export async function runLicenseOfflineRebindTests(production, fileMatrixOnly = false) {
  const ids = [], failures = [], hex = b => Buffer.from(b).toString("hex");
  const ok = r => { assert(r.ok, `${r.stage}/${r.errorCode}`); return r; };
  const no = (r, code) => { assert.equal(r.ok, false); if (code) assert.equal(r.errorCode, code); assert.equal(r.runtimeAuthority, "NONE"); };
  const test = async (id, run) => { ids.push(id); try { await run(); } catch (e) { failures.push({ id, message: e.stack ?? String(e) }); } };
  for (const edition of ["FULL", "ATTENDANCE"]) {
    const f = createLicenseStateFixtures(production, { edition });
    function setup() {
      const machine = production.core.createLicenseStateMachineV1(f.configuration);
      const s = { machine, state: ok(machine.transition(machine.initial(), f.initialActivation().command, f.now)).state,
        requests: new Map(), entropy: 0, signs: 0, writes: 0, commits: 0, staged: f.deviceForKey("TEST_ONLY_INSTALLATION_DEVICE_REBIND") };
      s.advance = cmd => { s.state = ok(machine.transition(s.state, cmd, f.now)).state; };
      s.incident = () => s.advance({ kind: "INTEGRITY_INCIDENT", incident: { id: f.bytes(`incident-${++s.entropy}`), nonce: f.bytes(`nonce-${s.entropy}`, 32), reason: "KEY_LOSS" } });
      s.rebind = { readStagedDevice: () => s.staged };
      s.store = { commit: async p => {
        s.commits++;
        if (s.state.stateGeneration !== p.expectedPreviousGeneration || hex(s.state.stateHash) !== hex(p.expectedPreviousHash)) return { decision: "CONFLICT" };
        assert(p.commitObligations.includes("SEAL_INDEPENDENT_ANCHORS")); assert(p.commitObligations.includes("STAGE_COMPLETE_STATE_AND_JOURNAL"));
        s.state = p.state; s.writes++; return { decision: "ACKNOWLEDGED", stateGeneration: s.state.stateGeneration, stateHash: s.state.stateHash };
      } };
      s.reader = { read: async id => { const p = s.requests.get(hex(id)); return p ? { encoded: p.encoded } : undefined; } };
      s.workflow = production.createOfflineRebindCompletionV1({ machine, verification: f.verification, requests: s.reader, store: s.store, rebind: s.rebind });
      s.installation = { randomBytes: n => f.bytes(`rebind-${++s.entropy}`, n), signInstallation: async ({ deviceKeyId, sigStructure }) => {
        s.signs++; const key = Object.values(TEST_ONLY_KEYS).find(k => hex(k.kid) === hex(deviceKeyId));
        return new Uint8Array(signEs256Rfc6979LowS(sigStructure, key.privateScalar));
      } };
      s.generator = production.createOfflineRequestWorkflowV1({ machine, verification: f.verification, installation: s.installation, rebind: s.rebind,
        registration: { register: async p => { assert.equal(hex(p.expectedStateHash), hex(s.state.stateHash)); s.requests.set(hex(p.requestId), p);
          return { decision: "REGISTERED", requestId: p.requestId, requestHash: p.requestHash }; } } });
      return s;
    }
    const input = { purpose: "REBIND", issuedAt: f.now, notAfter: f.now + 86400n };
    async function candidate(s) {
      const plan = ok(await s.generator.prepare(s.state, input)).plan; ok(await s.generator.export(plan));
      const p = f.payload("pos-recovery-rebind-device"), parent = s.state.current.entitlement;
      Object.assign(p, { tokenId: f.bytes(`token-${++s.entropy}`), edition, installationId: s.state.device.installationId,
        licenseId: parent.payload.licenseId, activationId: parent.payload.activationId, entitlementTokenId: parent.payload.tokenId,
        entitlementTokenHash: parent.hash, entitlementGeneration: parent.payload.generation, requestId: plan.requestId, requestHash: plan.requestHash,
        incidentId: s.state.incident.id, incidentNonce: s.state.incident.nonce, expectedStateGeneration: s.state.stateGeneration,
        newStateGeneration: s.state.stateGeneration + 1n, controlRevision: s.state.control.revision, maximumFeatures: [...parent.payload.features],
        oldDeviceKeyId: s.state.device.deviceKeyId, newDeviceKeyId: s.staged.deviceKeyId, newAssurance: s.staged.assurance,
        issuedAt: f.now, notBefore: f.now, notAfter: f.now + 3600n });
      return { plan, payload: p, input: { kind: "REBIND", artifact: f.sign("recovery", p), requestId: plan.requestId } };
    }
    const apply = (s, c, state = s.state, now = f.now) => s.workflow.apply(state, c.input, now);
    const resign = c => { c.input.artifact = f.sign("recovery", c.payload); };
    if (fileMatrixOnly) {
      await runOfflineFileMatrix({ edition, kind: "REBIND", production, f, test,
        scenario: async () => { const s = setup(); s.incident(); return { s, c: await candidate(s) }; } });
      continue;
    }
    await test(`${edition}/new-key-pop-no-authority-change`, async () => {
      const s = setup(); s.incident(); const before = s.state, c = await candidate(s), p = f.requestSnapshot(c.plan.encoded).payload;
      assert.equal(p.requestPurpose, "REBIND"); assert.equal(hex(p.deviceKeyId), hex(s.staged.deviceKeyId));
      assert.equal(hex(p.oldDeviceKeyId), hex(before.device.deviceKeyId)); assert.equal(hex(p.stateHash), hex(before.stateHash));
      assert.equal(s.state, before); assert.equal(s.writes, 0);
    });
    await test(`${edition}/complete-binding-preserves-parent-and-expiry`, async () => {
      const s = setup(); s.incident(); const before = s.state, c = await candidate(s); const r = ok(await apply(s, c));
      assert.equal(r.durable, false); assert.equal(r.runtimeAuthority, "NONE"); assert.equal(s.state.recoveryRequired, false);
      assert.equal(hex(s.state.device.deviceKeyId), hex(s.staged.deviceKeyId)); assert.equal(hex(s.state.device.bindingRecoveryTokenId), hex(c.payload.tokenId));
      assert.equal(hex(s.state.current.entitlement.hash), hex(before.current.entitlement.hash));
      assert.equal(s.state.stateGeneration, before.stateGeneration + 1n); assert.equal(s.state.consumedRecoveries.length, 1);
      assert.equal(s.machine.project(s.state, before.current.entitlement.payload.graceUntil).state, "EXPIRED_LOCKED");
    });
    await test(`${edition}/chain-a-b-c-keeps-original-entitlement`, async () => {
      const s = setup(); s.incident(); const original = hex(s.state.current.entitlement.hash); ok(await apply(s, await candidate(s)));
      const b = hex(s.state.device.deviceKeyId); s.staged = f.deviceForKey("TEST_ONLY_UNKNOWN_SIGNER"); s.incident();
      const c = await candidate(s); assert.equal(hex(c.payload.oldDeviceKeyId), b); ok(await apply(s, c));
      assert.equal(hex(s.state.current.entitlement.hash), original); assert.equal(hex(s.state.device.deviceKeyId), hex(s.staged.deviceKeyId));
    });
    await test(`${edition}/missing-incident-and-caller-override`, async () => {
      const s = setup(); no(await s.generator.prepare(s.state, input), "RECOVERY_INCIDENT_REQUIRED"); s.incident();
      for (const name of ["newDevice", "oldDeviceKeyId", "devicePublicKey", "incidentId"]) no(await s.generator.prepare(s.state, { ...input, [name]: s.staged }), "REQUEST_INPUT_FIELD_FORBIDDEN");
      const c = await candidate(s); no(await apply(s, { input: { ...c.input, newDevice: s.staged } }), "OFFLINE_INPUT_FIELD_FORBIDDEN");
    });
    await test(`${edition}/invalid-provider-bindings`, async () => {
      const s = setup(); s.incident(); const valid = s.staged;
      for (const value of [undefined, s.state.device, { ...valid, installationId: f.bytes("wrong") },
        { ...valid, deviceKeyId: f.bytes("bad", 32) }, { ...valid, bindingRecoveryTokenId: f.bytes("forged") }]) {
        s.staged = value; no(await s.generator.prepare(s.state, input), "REBIND_DEVICE_UNAVAILABLE");
      } assert.equal(s.signs, 0);
      s.rebind.readStagedDevice = () => { throw Error("SECRET_CANARY"); };
      const r = await s.generator.prepare(s.state, input); no(r); assert(!JSON.stringify(r).includes("SECRET_CANARY"));
    });
    await test(`${edition}/wrong-installation-signer`, async () => {
      const s = setup(); s.incident(); s.installation.signInstallation = async ({ sigStructure }) =>
        new Uint8Array(signEs256Rfc6979LowS(sigStructure, TEST_ONLY_KEYS.TEST_ONLY_INSTALLATION_DEVICE_PRIMARY.privateScalar));
      no(await s.generator.prepare(s.state, input)); assert.equal(s.requests.size, 0);
    });
    await test(`${edition}/tpm-context-and-no-fallback`, async () => {
      const s = setup(); s.incident(); s.staged = f.deviceForKey("TEST_ONLY_INSTALLATION_DEVICE_REBIND", { assurance: "TPM_ATTESTED" });
      no(await s.generator.prepare(s.state, input), "TPM_ATTESTATION_UNAVAILABLE"); assert.equal(s.signs, 0);
      s.installation.attestTpm = async hash => { assert.equal(hash.length, 32); return new Uint8Array([1, 2, 3]); };
      const c = await candidate(s); assert.equal(f.requestSnapshot(c.plan.encoded).payload.bindingKind, "TPM_ATTESTED"); ok(await apply(s, c));
    });
    await test(`${edition}/wrong-old-new-key-incident-revision`, async () => {
      const s = setup(); s.incident(); const before = s.state;
      for (const patch of [{ oldDeviceKeyId: f.bytes("bad", 32) }, { newDeviceKeyId: s.state.device.deviceKeyId },
        { incidentNonce: f.bytes("bad", 32) }, { controlRevision: 1n }, { newStateGeneration: s.state.stateGeneration + 2n }]) {
        const c = await candidate(s); Object.assign(c.payload, patch); resign(c); no(await apply(s, c));
      } assert.equal(s.state, before); assert.equal(s.commits, 0);
    });
    await test(`${edition}/wrong-purpose-signer-tamper-expiry`, async () => {
      const s = setup(); s.incident(); const c = await candidate(s);
      no(await s.workflow.apply(s.state, { ...c.input, kind: "RECOVERY" }, f.now), "REBIND_COMPLETION_ONLY");
      c.input.artifact = f.sign("recovery", c.payload, "TEST_ONLY_OFFLINE_CONTROL_PRIMARY"); no(await apply(s, c));
      resign(c); c.input.artifact[c.input.artifact.length - 1] ^= 1; no(await apply(s, c));
      resign(c); no(await apply(s, c, s.state, f.now + 3600n)); assert.equal(s.commits, 0);
    });
    await test(`${edition}/wrong-archived-request-and-staged-key`, async () => {
      const s = setup(); s.incident(); const c = await candidate(s), d = await candidate(s);
      no(await apply(s, { input: { ...c.input, requestId: d.plan.requestId } }));
      s.staged = f.deviceForKey("TEST_ONLY_UNKNOWN_SIGNER"); no(await apply(s, c)); assert.equal(s.writes, 0);
    });
    await test(`${edition}/single-use-and-lost-ack`, async () => {
      const s = setup(); s.incident(); const c = await candidate(s), commit = s.store.commit;
      s.store.commit = async p => { await commit(p); throw Error("lost ack"); }; no(await apply(s, c), "COMMIT_OUTCOME_UNKNOWN");
      s.store.commit = commit; no(await apply(s, c)); assert.equal(s.writes, 1); assert.equal(s.state.recoveryRequired, false);
    });
    await test(`${edition}/pending-and-failed-commit`, async () => {
      const s = setup(); s.incident(); const c = await candidate(s), before = s.state;
      s.store.commit = async () => ({ decision: "PENDING" }); no(await apply(s, c), "COMMIT_PENDING");
      s.store.commit = async () => { throw Error("failure"); }; no(await apply(s, c), "COMMIT_OUTCOME_UNKNOWN"); assert.equal(s.state, before);
    });
    await test(`${edition}/concurrent-completion-one-winner`, async () => {
      const s = setup(); s.incident(); const c = await candidate(s), d = await candidate(s), before = s.state;
      const r = await Promise.all([apply(s, c, before), apply(s, d, before)]); assert.equal(r.filter(x => x.ok).length, 1); assert.equal(s.writes, 1);
    });
    await test(`${edition}/snapshot-before-async-reader`, async () => {
      const s = setup(); s.incident(); const c = await candidate(s), expected = hex(s.staged.deviceKeyId), read = s.reader.read;
      s.reader.read = async id => { s.staged.deviceKeyId.fill(0); return read(id); }; ok(await apply(s, c));
      assert.equal(hex(s.state.device.deviceKeyId), expected);
    });
    await test(`${edition}/tamper-lock-survives-rebind`, async () => {
      const s = setup(); s.incident(); s.advance({ kind: "INTEGRITY_INCIDENT", incident: s.state.incident,
        evidence: [{ protectionDomain: "SEALED_PROGRAMDATA", observedGeneration: 0n, protectedHighWater: 1n },
          { protectionDomain: "SEALED_REGISTRY", observedGeneration: 0n, protectedHighWater: 1n }] });
      ok(await apply(s, await candidate(s))); assert.equal(s.state.tamperLatched, true); assert(s.state.incident);
    });
    await test(`${edition}/pending-parent-and-counters-survive`, async () => {
      const s = setup(), parent = s.state.current.entitlement.payload;
      const plan = ok(await s.generator.prepare(s.state, { ...input, purpose: "RENEW" })).plan;
      const p = f.clone(parent); Object.assign(p, { tokenId: f.bytes("pending"), generation: 2n, previousTokenId: parent.tokenId,
        requestId: plan.requestId, requestHash: plan.requestHash, notBefore: f.now + 86400n, termStartsAt: f.now + 86400n });
      s.advance({ kind: "IMPORT_ENTITLEMENT", encoded: f.sign("entitlement", p), request: f.requestSnapshot(plan.encoded) });
      s.incident(); const c = await candidate(s); assert.equal(f.requestSnapshot(c.plan.encoded).payload.entitlementGeneration, 1n);
      ok(await apply(s, c)); assert.equal(s.state.pending.entitlement.payload.generation, 2n); assert.equal(s.state.entitlementGeneration, 2n);
    });
    await test(`${edition}/suspension-survives`, async () => {
      const s = setup(), p = f.payload("pos-control-vendor-suspend"), parent = s.state.current.entitlement.payload;
      Object.assign(p, { edition, licenseId: parent.licenseId, activationId: parent.activationId, controlRevision: 1n,
        effectiveAt: f.now, issuedAt: f.now, notBefore: f.now, notAfter: f.now + 86400n, reasonCode: 1n });
      s.advance({ kind: "IMPORT_CONTROL", encoded: f.sign("offline-control", p) }); s.incident(); ok(await apply(s, await candidate(s)));
      assert.equal(s.machine.project(s.state, f.now).state, "SUSPENDED_LOCKED"); assert.equal(s.state.control.revision, 1n);
    });
    await test(`${edition}/edition-and-transition-cannot-change`, async () => {
      const s = setup(); s.incident();
      for (const patch of [{ edition: edition === "FULL" ? "ATTENDANCE" : "FULL" }, { allowedTransition: "REPAIR_SECURE_STATE" },
        { newAssurance: "TPM_ATTESTED" }, { maximumFeatures: ["ICLOCK_ADMS"] }]) {
        const c = await candidate(s); Object.assign(c.payload, patch); resign(c); no(await apply(s, c));
      } assert.equal(s.commits, 0);
    });
    await test(`${edition}/missing-provider-and-forged-state`, async () => {
      const s = setup(); s.incident(); const c = await candidate(s);
      const workflow = production.createOfflineRebindCompletionV1({ machine: s.machine, verification: f.verification, requests: s.reader, store: s.store });
      no(await workflow.apply(s.state, c.input, f.now), "REBIND_DEVICE_UNAVAILABLE");
      no(await apply(s, c, { ...s.state }), "UNTRUSTED_MODEL_STATE"); assert.equal(s.commits, 0);
    });
    await test(`${edition}/terminal-revoke-is-not-rebind`, async () => {
      const s = setup(), p = f.payload("pos-control-vendor-suspend"), parent = s.state.current.entitlement.payload;
      Object.assign(p, { edition, licenseId: parent.licenseId, activationId: parent.activationId, action: "REVOKE", controlRevision: 1n,
        effectiveAt: f.now, issuedAt: f.now, notBefore: f.now, notAfter: f.now + 86400n, reasonCode: 1n });
      s.advance({ kind: "IMPORT_CONTROL", encoded: f.sign("offline-control", p) }); s.incident();
      no(await s.generator.prepare(s.state, input), "REACTIVATION_REQUIRED"); assert.equal(s.signs, 0);
    });
  }
  assert.equal(new Set(ids).size, ids.length);
  return { attempted: ids.length, passed: ids.length - failures.length, failures };
}
