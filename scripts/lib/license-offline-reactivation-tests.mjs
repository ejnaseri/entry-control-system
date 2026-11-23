// TEST_ONLY_DO_NOT_TRUST. Actual production core, in-memory request/store doubles.
import assert from "node:assert/strict";
import { runOfflineFileMatrix } from "./license-offline-file-matrix.mjs";
import { createLicenseStateFixtures } from "./license-state-fixtures.mjs";
import { TEST_ONLY_KEYS } from "../../licensing/vectors/v1/test-only/keys.mjs";
import { signEs256Rfc6979LowS } from "../../licensing/vectors/v1/lib/ecdsa-rfc6979.mjs";

export async function runLicenseOfflineReactivationTests(production, fileMatrixOnly = false) {
  const ids = [], failures = [], hex = b => Buffer.from(b).toString("hex");
  const ok = r => { assert(r.ok, `${r.stage}/${r.errorCode}`); return r; };
  const no = (r, code) => { assert.equal(r.ok, false); if (code) assert.equal(r.errorCode, code); assert.equal(r.runtimeAuthority, "NONE"); };
  const test = async (id, run) => { ids.push(id); try { await run(); } catch (e) { failures.push({ id, message: e.stack ?? String(e) }); } };
  for (const edition of ["FULL", "ATTENDANCE"]) {
    const f = createLicenseStateFixtures(production, { edition });
    function setup(revoke = true, incident = true) {
      const machine = production.core.createLicenseStateMachineV1(f.configuration), initial = f.initialActivation();
      const s = { machine, initial, state: ok(machine.transition(machine.initial(), initial.command, f.now)).state,
        requests: new Map(), entropy: 0, signs: 0, writes: 0, commits: 0 };
      s.advance = cmd => { s.state = ok(machine.transition(s.state, cmd, f.now)).state; };
      if (revoke) {
        const p = f.payload("pos-control-vendor-suspend"), old = s.state.current.entitlement.payload;
        Object.assign(p, { edition, licenseId: old.licenseId, activationId: old.activationId, action: "REVOKE", controlRevision: 1n,
          effectiveAt: f.now, issuedAt: f.now, notBefore: f.now, notAfter: f.now + 86400n, reasonCode: 1n });
        s.advance({ kind: "IMPORT_CONTROL", encoded: f.sign("offline-control", p) });
        if (incident) s.advance({ kind: "BEGIN_REACTIVATION", incident: { id: f.bytes("reactivate-incident"), nonce: f.bytes("reactivate-nonce", 32), reason: "COMMERCIAL_REACTIVATION" } });
      }
      s.store = { commit: async p => {
        s.commits++; if (p.expectedPreviousGeneration !== s.state.stateGeneration || hex(p.expectedPreviousHash) !== hex(s.state.stateHash)) return { decision: "CONFLICT" };
        assert(p.commitObligations.includes("SEAL_INDEPENDENT_ANCHORS")); assert(p.commitObligations.includes("STAGE_COMPLETE_STATE_AND_JOURNAL"));
        s.state = p.state; s.writes++; return { decision: "ACKNOWLEDGED", stateGeneration: s.state.stateGeneration, stateHash: s.state.stateHash };
      } };
      s.reader = { read: async id => s.requests.get(hex(id)) };
      s.workflow = production.createOfflineReactivationCompletionV1({ machine, verification: f.verification, store: s.store, requests: s.reader });
      s.generator = production.createOfflineRequestWorkflowV1({ machine, verification: f.verification,
        installation: { randomBytes: n => f.bytes(`reactivate-${++s.entropy}`, n), signInstallation: async ({ sigStructure }) => {
          s.signs++; return new Uint8Array(signEs256Rfc6979LowS(sigStructure, TEST_ONLY_KEYS.TEST_ONLY_INSTALLATION_DEVICE_PRIMARY.privateScalar));
        } }, registration: { register: async p => { assert.equal(hex(p.expectedStateHash), hex(s.state.stateHash)); s.requests.set(hex(p.requestId), { encoded: p.encoded });
          return { decision: "REGISTERED", requestId: p.requestId, requestHash: p.requestHash }; } } });
      return s;
    }
    const input = { purpose: "REACTIVATE", issuedAt: f.now, notAfter: f.now + 86400n };
    async function candidate(s) {
      const plan = ok(await s.generator.prepare(s.state, input)).plan; ok(await s.generator.export(plan));
      const a = f.payload("pos-reactivation-authorization"), old = s.state.current.entitlement.payload, t = s.state.tombstones[0], label = `pair-${++s.entropy}`;
      Object.assign(a, { tokenId: f.bytes(`${label}-auth`), edition, installationId: s.state.device.installationId, deviceKeyId: s.state.device.deviceKeyId,
        requestId: plan.requestId, requestHash: plan.requestHash, revokedLicenseId: old.licenseId, revokedActivationId: old.activationId,
        finalRevokeTokenHash: t.finalRevokeTokenHash, finalControlRevision: t.finalControlRevision,
        incidentId: s.state.incident.id, incidentNonce: s.state.incident.nonce, newLicenseId: f.bytes(`${label}-license`), newActivationId: f.bytes(`${label}-activation`),
        maximumFeatures: [...old.features], issuedAt: f.now, notBefore: f.now, notAfter: f.now + 86400n });
      const e = f.clone(old); delete e.previousTokenId;
      Object.assign(e, { tokenId: f.bytes(`${label}-entitlement`), generation: 1n, licenseId: a.newLicenseId, activationId: a.newActivationId,
        requestId: plan.requestId, requestHash: plan.requestHash, reactivationAuthorizationId: a.tokenId, issuedAt: f.now, notBefore: f.now });
      const c = { plan, a, e, input: { kind: "REACTIVATION", requestId: plan.requestId } }; resign(c); return c;
    }
    function resign(c) { c.input.authorization = f.sign("reactivation-authorization", c.a); c.input.entitlement = f.sign("entitlement", c.e); }
    const apply = (s, c, state = s.state) => s.workflow.apply(state, c.input, f.now);
    if (fileMatrixOnly) {
      await runOfflineFileMatrix({ edition, kind: "REACTIVATION", production, f, test,
        scenario: async () => { const s = setup();  return { s, c: await candidate(s) }; } });
      continue;
    }
    await test(`${edition}/derived-request-does-not-unlock`, async () => {
      const s = setup(), before = s.state, c = await candidate(s), p = f.requestSnapshot(c.plan.encoded).payload, t = before.tombstones[0];
      assert.equal(p.requestPurpose, "REACTIVATE"); assert.equal(hex(p.revokedLineageTombstoneHash), hex(t.hash)); assert.equal(p.finalControlRevision, t.finalControlRevision);
      assert.equal(hex(p.incidentNonce), hex(before.incident.nonce)); assert.equal(s.state, before); assert.equal(s.machine.project(s.state, f.now).state, "REVOKED_LOCKED");
    });
    await test(`${edition}/nonrevoked-or-missing-incident-rejected`, async () => {
      for (const s of [setup(false), setup(true, false)]) { no(await s.generator.prepare(s.state, input), "REACTIVATION_INCIDENT_REQUIRED"); assert.equal(s.signs, 0); }
      const s = setup(); for (const key of ["revokedLicenseId", "incidentId", "finalControlRevision", "newLicenseId"]) no(await s.generator.prepare(s.state, { ...input, [key]: 1n }), "REQUEST_INPUT_FIELD_FORBIDDEN");
    });
    await test(`${edition}/atomic-new-lineage-keeps-tombstone`, async () => {
      const s = setup(), before = s.state, c = await candidate(s); const r = ok(await apply(s, c));
      assert.equal(r.durable, false); assert.equal(r.runtimeAuthority, "NONE"); assert.equal(s.state.stateGeneration, before.stateGeneration + 1n);
      assert.equal(hex(s.state.current.entitlement.payload.licenseId), hex(c.a.newLicenseId)); assert.equal(s.state.entitlementGeneration, 1n);
      assert.equal(s.state.consumedReactivations.length, 1); assert.equal(s.state.receipts.length, before.receipts.length + 2);
      assert.equal(s.state.consumedRequests.length, before.consumedRequests.length + 1); assert.deepEqual(s.state.tombstones, before.tombstones);
      assert.equal(s.machine.project(s.state, f.now).state, "ACTIVE");
      const old = s.machine.transition(s.state, s.initial.command, f.now); assert.equal(old.ok, false); assert.equal(old.errorCode, "TERMINAL_REVOCATION");
    });
    await test(`${edition}/missing-half-and-wrong-intent`, async () => {
      const s = setup(), c = await candidate(s); for (const key of ["authorization", "entitlement"]) no(await apply(s, { input: { ...c.input, [key]: undefined } }), "FILE_BYTES_REQUIRED");
      no(await apply(s, { input: { ...c.input, kind: "ENTITLEMENT" } }), "REACTIVATION_COMPLETION_ONLY"); assert.equal(s.commits, 0);
    });
    await test(`${edition}/wrong-incident-revoke-and-new-lineage`, async () => {
      const s = setup(); for (const patch of [{ incidentNonce: f.bytes("wrong", 32) }, { finalRevokeTokenHash: f.bytes("wrong", 32) },
        { finalControlRevision: 2n }, { newLicenseId: s.state.current.entitlement.payload.licenseId }]) {
        const c = await candidate(s); Object.assign(c.a, patch); resign(c); no(await apply(s, c));
      } assert.equal(s.commits, 0);
    });
    await test(`${edition}/pair-mismatch-and-collision`, async () => {
      const s = setup(); for (const key of ["licenseId", "reactivationAuthorizationId", "tokenId"]) {
        const c = await candidate(s); c.e[key] = key === "tokenId" ? c.a.tokenId : f.bytes("wrong"); resign(c); no(await apply(s, c));
      } assert.equal(s.commits, 0);
    });
    await test(`${edition}/feature-ceiling-and-generation`, async () => {
      const s = setup(), c = await candidate(s); c.a.maximumFeatures = c.a.maximumFeatures.slice(0, -1); resign(c); no(await apply(s, c), "REACTIVATION_FEATURES_WIDENED");
      const d = await candidate(s); d.e.generation = 2n; resign(d); no(await apply(s, d)); assert.equal(s.commits, 0);
    });
    await test(`${edition}/signers-tamper-and-wrong-device`, async () => {
      const s = setup(), c = await candidate(s);
      c.input.authorization = f.sign("reactivation-authorization", c.a, "TEST_ONLY_RECOVERY_PRIMARY"); no(await apply(s, c));
      resign(c); c.input.entitlement[c.input.entitlement.length - 1] ^= 1; no(await apply(s, c));
      c.a.deviceKeyId = f.bytes("wrong", 32); resign(c); no(await apply(s, c)); assert.equal(s.commits, 0);
    });
    await test(`${edition}/exact-request-and-tombstone-binding`, async () => {
      const s = setup(), c = await candidate(s), d = await candidate(s); no(await apply(s, { input: { ...c.input, requestId: d.plan.requestId } }));
      const p = f.requestSnapshot(c.plan.encoded).payload; p.revokedLineageTombstoneHash = f.bytes("wrong", 32);
      s.requests.set(hex(c.plan.requestId), { encoded: f.sign("activation-request", p) }); no(await apply(s, c)); assert.equal(s.commits, 0);
    });
    await test(`${edition}/replay-and-lost-ack-no-rollback`, async () => {
      const s = setup(), c = await candidate(s), commit = s.store.commit; s.store.commit = async p => { await commit(p); throw Error("lost ack"); };
      no(await apply(s, c), "COMMIT_OUTCOME_UNKNOWN"); const before = s.state; s.store.commit = commit;
      no(await apply(s, c), "REACTIVATION_AUTHORIZATION_REPLAYED"); assert.equal(s.state, before); assert.equal(s.writes, 1);
    });
    await test(`${edition}/failed-pending-and-invalid-ack`, async () => {
      const s = setup(), c = await candidate(s), before = s.state;
      s.store.commit = async () => ({ decision: "PENDING" }); no(await apply(s, c), "COMMIT_PENDING");
      s.store.commit = async () => ({ decision: "ACKNOWLEDGED", stateGeneration: 0n, stateHash: before.stateHash }); no(await apply(s, c), "COMMIT_ACKNOWLEDGEMENT_INVALID");
      s.store.commit = async () => { throw Error("SECRET_CANARY"); }; const r = await apply(s, c); no(r, "COMMIT_OUTCOME_UNKNOWN"); assert(!JSON.stringify(r).includes("SECRET_CANARY")); assert.equal(s.state, before);
    });
    await test(`${edition}/concurrent-pairs-one-winner`, async () => {
      const s = setup(), c = await candidate(s), d = await candidate(s), before = s.state;
      const r = await Promise.all([apply(s, c, before), apply(s, d, before)]); assert.equal(r.filter(x => x.ok).length, 1); assert.equal(s.writes, 1);
    });
    await test(`${edition}/independent-lock-remains`, async () => {
      const s = setup(); s.advance({ kind: "INTEGRITY_INCIDENT", incident: s.state.incident }); ok(await apply(s, await candidate(s)));
      assert.equal(s.state.recoveryRequired, true); assert.equal(s.machine.project(s.state, f.now).state, "RECOVERY_REQUIRED");
    });
    await test(`${edition}/future-pair-and-hybrid-not-half-activated`, async () => {
      const s = setup(), c = await candidate(s); c.a.notBefore = f.now + 60n; resign(c); no(await apply(s, c), "REACTIVATION_NOT_YET_EFFECTIVE");
      const d = await candidate(s); Object.assign(d.e, { mode: "HYBRID_LEASED", checkCadenceSeconds: 21600n, offlineAllowanceSeconds: 604800n, timeRecoveryRttSeconds: 300n }); resign(d); no(await apply(s, d), "REACTIVATION_PAIR_INCOMPLETE"); assert.equal(s.commits, 0);
    });
  }
  assert.equal(new Set(ids).size, ids.length);
  return { attempted: ids.length, passed: ids.length - failures.length, failures };
}
