// TEST_ONLY_DO_NOT_TRUST. Portable real-core workflow with in-memory adapters.
import assert from "node:assert/strict";
import { runOfflineFileMatrix } from "./license-offline-file-matrix.mjs";
import { createLicenseStateFixtures } from "./license-state-fixtures.mjs";
import { TEST_ONLY_KEYS } from "../../licensing/vectors/v1/test-only/keys.mjs";
import { signEs256Rfc6979LowS } from "../../licensing/vectors/v1/lib/ecdsa-rfc6979.mjs";

export async function runLicenseOfflineTimeCorrectionTests(production, fileMatrixOnly = false) {
  const ids = [], failures = [], hex = b => Buffer.from(b).toString("hex");
  const ok = r => { assert(r.ok, `${r.stage}/${r.errorCode}`); return r; };
  const no = (r, code) => { assert.equal(r.ok, false); if (code) assert.equal(r.errorCode, code); assert.equal(r.runtimeAuthority, "NONE"); };
  const test = async (id, run) => { ids.push(id); try { await run(); } catch (e) { failures.push({ id, message: e.stack ?? String(e) }); } };
  for (const edition of ["FULL", "ATTENDANCE"]) {
    const f = createLicenseStateFixtures(production, { edition }), boot = f.bytes("time-workflow-boot");
    const observation = (tick = 1000n, bootId = boot) => ({ wallUtc: f.now + 90000n, monotonicMs: tick, bootId });
    function setup(open = true) {
      const machine = production.core.createLicenseStateMachineV1(f.configuration);
      const s = { machine, state: ok(machine.transition(machine.initial(), f.initialActivation().command, f.now)).state,
        requests: new Map(), entropy: 0, signs: 0, writes: 0, confirms: 0 };
      s.advance = cmd => { s.state = ok(machine.transition(s.state, cmd, f.now)).state; };
      s.advance({ kind: "OBSERVE_TIME", observation: { ...observation(), wallUtc: f.now }, incident: { id: f.bytes("i0"), nonce: f.bytes("n0", 32), reason: "CLOCK_ROLLBACK" } });
      if (open) s.advance({ kind: "BEGIN_TIME_RECOVERY", observation: observation(), incident: { id: f.bytes("i1"), nonce: f.bytes("n1", 32), reason: "CLOCK_FORWARD_JUMP" } });
      s.clock = { observe: () => observation() };
      s.store = {
        commit: async p => {
          if (p.expectedPreviousGeneration !== s.state.stateGeneration || hex(p.expectedPreviousHash) !== hex(s.state.stateHash)) return { decision: "CONFLICT" };
          assert(p.commitObligations.includes("SEAL_INDEPENDENT_ANCHORS")); s.state = p.state; s.writes++;
          return { decision: "ACKNOWLEDGED", stateGeneration: s.state.stateGeneration, stateHash: s.state.stateHash };
        },
        confirm: async p => { s.confirms++; return p.stateGeneration === s.state.stateGeneration && hex(p.stateHash) === hex(s.state.stateHash)
          ? { decision: "ACKNOWLEDGED", ...p } : { decision: "CONFLICT" }; },
      };
      s.workflow = production.createOfflineTimeCorrectionCompletionV1({ machine, verification: f.verification, store: s.store,
        requests: { read: async id => s.requests.get(hex(id)) } });
      s.generator = production.createOfflineRequestWorkflowV1({ machine, verification: f.verification, time: s.clock,
        installation: { randomBytes: n => f.bytes(`time-workflow-${++s.entropy}`, n), signInstallation: async ({ sigStructure }) => {
          s.signs++; return new Uint8Array(signEs256Rfc6979LowS(sigStructure, TEST_ONLY_KEYS.TEST_ONLY_INSTALLATION_DEVICE_PRIMARY.privateScalar));
        } }, registration: { register: async p => { assert.equal(hex(p.expectedStateHash), hex(s.state.stateHash)); s.requests.set(hex(p.requestId), { encoded: p.encoded, timeEvidence: p.timeEvidence });
          return { decision: "REGISTERED", requestId: p.requestId, requestHash: p.requestHash }; } } });
      return s;
    }
    const input = { purpose: "TIME_CORRECT", issuedAt: f.now, notAfter: f.now + 86400n };
    async function candidate(s) {
      const plan = ok(await s.generator.prepare(s.state, input)).plan; ok(await s.generator.export(plan));
      const p = f.payload("pos-time-correction"), parent = s.state.current.entitlement.payload, i = s.state.timeIncident;
      Object.assign(p, { tokenId: f.bytes(`correction-${++s.entropy}`), edition, installationId: s.state.device.installationId, deviceKeyId: s.state.device.deviceKeyId,
        licenseId: parent.licenseId, activationId: parent.activationId, requestId: plan.requestId, requestHash: plan.requestHash,
        incidentId: i.id, incidentNonce: i.nonce, expectedStateGeneration: s.state.stateGeneration, newStateGeneration: s.state.stateGeneration + 1n,
        timeCorrectionRevision: s.state.timeCorrectionRevision + 1n, preIncidentClockHighWater: i.preIncidentClockHighWater,
        issuedAt: f.now, notBefore: f.now, notAfter: f.now + 3600n, correctedUtc: f.now + 10n });
      return { plan, payload: p, input: { kind: "TIME_CORRECTION", artifact: f.sign("time-correction", p), requestId: plan.requestId, observation: observation(2000n) } };
    }
    const apply = (s, c, state = s.state) => s.workflow.apply(state, c.input, f.now);
    const resign = c => { c.input.artifact = f.sign("time-correction", c.payload); };
    if (fileMatrixOnly) {
      await runOfflineFileMatrix({ edition, kind: "TIME_CORRECTION", production, f, test,
        scenario: async () => { const s = setup();  return { s, c: await candidate(s) }; } });
      continue;
    }
    await test(`${edition}/request-derived-and-evidence-registered`, async () => {
      const s = setup(), before = s.state, c = await candidate(s), p = f.requestSnapshot(c.plan.encoded).payload;
      assert.equal(p.requestPurpose, "TIME_CORRECT"); assert.equal(p.preIncidentClockHighWater, before.timeIncident.preIncidentClockHighWater);
      assert.equal(hex(p.incidentNonce), hex(before.timeIncident.nonce)); assert.equal(hex(c.plan.timeEvidence.requestHash), hex(c.plan.requestHash));
      assert.equal(s.state, before); assert.equal(s.writes, 0);
    });
    await test(`${edition}/missing-incident-and-caller-claims`, async () => {
      const s = setup(false); no(await s.generator.prepare(s.state, input), "TIME_INCIDENT_REQUIRED");
      for (const field of ["preIncidentClockHighWater", "incidentNonce", "timeEvidence", "observation"]) no(await s.generator.prepare(s.state, { ...input, [field]: 0n }), "REQUEST_INPUT_FIELD_FORBIDDEN");
      assert.equal(s.signs, 0);
    });
    await test(`${edition}/bad-boot-tick-provider-no-signing`, async () => {
      const s = setup(); for (const o of [observation(999n), observation(1000n, f.bytes("new-boot"))]) {
        s.clock.observe = () => o; no(await s.generator.prepare(s.state, input), "TIME_EVIDENCE_REQUIRES_FRESH_INCIDENT");
      }
      s.clock.observe = () => { throw Error("SECRET_CANARY"); }; const r = await s.generator.prepare(s.state, input); no(r, "TIME_EVIDENCE_UNAVAILABLE");
      assert(!JSON.stringify(r).includes("SECRET_CANARY")); assert.equal(s.signs, 0);
    });
    await test(`${edition}/repair-atomic-no-entitlement-change`, async () => {
      const s = setup(), before = s.state, c = await candidate(s); ok(await apply(s, c));
      assert.equal(s.state.timeIncident, undefined); assert.equal(s.state.clockHighWater, f.now + 10n);
      assert.equal(s.state.timeCorrectionRevision, 1n); assert.equal(s.state.stateGeneration, before.stateGeneration + 1n);
      assert.equal(hex(s.state.current.entitlement.hash), hex(before.current.entitlement.hash)); assert.equal(s.writes, 1);
    });
    await test(`${edition}/duplicate-read-only-core-replay-stays-rejected`, async () => {
      const s = setup(), c = await candidate(s); ok(await apply(s, c)); const before = s.state;
      assert.equal(ok(await apply(s, c)).decision, "ADAPTER_CONFIRMED_DUPLICATE"); assert.equal(s.confirms, 1); assert.equal(s.writes, 1); assert.equal(s.state, before);
      const r = s.machine.transition(s.state, { kind: "APPLY_TIME_CORRECTION", encoded: c.input.artifact, request: f.requestSnapshot(c.plan.encoded), observation: c.input.observation }, f.now);
      assert.equal(r.errorCode, "TIME_CORRECTION_REPLAYED");
    });
    await test(`${edition}/duplicate-wrong-request-id-or-hash-rejected`, async () => {
      const s = setup(), c = await candidate(s), d = await candidate(s); ok(await apply(s, c));
      no(await apply(s, { input: { ...c.input, requestId: d.plan.requestId } }), "OFFLINE_RESPONSE_REQUEST_MISMATCH");
      const p = f.requestSnapshot(c.plan.encoded).payload; p.requestNonce = f.bytes("changed", 32);
      s.requests.set(hex(c.plan.requestId), { encoded: f.sign("activation-request", p) }); no(await apply(s, c), "OFFLINE_RESPONSE_REQUEST_MISMATCH"); assert.equal(s.confirms, 0);
    });
    await test(`${edition}/read-only-confirmation-failures`, async () => {
      const s = setup(), c = await candidate(s); ok(await apply(s, c));
      s.store.confirm = undefined; no(await apply(s, c), "READ_ONLY_CONFIRMATION_REQUIRED");
      s.store.confirm = async () => ({ decision: "PENDING" }); no(await apply(s, c), "COMMIT_PENDING");
      s.store.confirm = async () => ({ decision: "ACKNOWLEDGED", stateGeneration: 0n, stateHash: s.state.stateHash }); no(await apply(s, c), "COMMIT_ACKNOWLEDGEMENT_INVALID");
      s.store.confirm = async () => { throw Error("SECRET_CANARY"); }; no(await apply(s, c), "READ_ONLY_CONFIRMATION_UNAVAILABLE"); assert.equal(s.writes, 1);
    });
    await test(`${edition}/wrong-incident-floor-revision-device`, async () => {
      const s = setup(), before = s.state;
      for (const patch of [{ incidentNonce: f.bytes("wrong", 32) }, { correctedUtc: f.now - 1n }, { timeCorrectionRevision: 0n },
        { deviceKeyId: f.bytes("wrong", 32) }, { newStateGeneration: s.state.stateGeneration + 2n }]) {
        const c = await candidate(s); Object.assign(c.payload, patch); resign(c); no(await apply(s, c));
      } assert.equal(s.state, before); assert.equal(s.writes, 0);
    });
    await test(`${edition}/wrong-signer-tamper-and-intent`, async () => {
      const s = setup(), c = await candidate(s); no(await s.workflow.apply(s.state, { ...c.input, kind: "RECOVERY" }, f.now), "TIME_CORRECTION_COMPLETION_ONLY");
      c.input.artifact = f.sign("time-correction", c.payload, "TEST_ONLY_OFFLINE_CONTROL_PRIMARY"); no(await apply(s, c));
      resign(c); c.input.artifact[c.input.artifact.length - 1] ^= 1; no(await apply(s, c)); assert.equal(s.writes, 0);
    });
    await test(`${edition}/wrong-receipt-boot-and-expired-freshness`, async () => {
      const s = setup(), c = await candidate(s); c.input.observation = observation(2000n, f.bytes("other-boot")); no(await apply(s, c));
      c.input.observation = observation(4000000n); no(await apply(s, c)); assert.equal(s.writes, 0);
    });
    await test(`${edition}/wrong-stored-evidence-hash`, async () => {
      const s = setup(), c = await candidate(s); s.requests.get(hex(c.plan.requestId)).timeEvidence = { ...c.plan.timeEvidence, requestHash: f.bytes("wrong", 32) };
      no(await apply(s, c)); assert.equal(s.writes, 0);
    });
    await test(`${edition}/lost-ack-reconciles-read-only`, async () => {
      const s = setup(), c = await candidate(s), commit = s.store.commit; s.store.commit = async p => { await commit(p); throw Error("lost ack"); };
      no(await apply(s, c), "COMMIT_OUTCOME_UNKNOWN"); const before = s.state; ok(await apply(s, c)); assert.equal(s.state, before); assert.equal(s.writes, 1); assert.equal(s.confirms, 1);
    });
    await test(`${edition}/failed-write-and-pending`, async () => {
      const s = setup(), c = await candidate(s), before = s.state;
      s.store.commit = async () => ({ decision: "PENDING" }); no(await apply(s, c), "COMMIT_PENDING");
      s.store.commit = async () => { throw Error("failure"); }; no(await apply(s, c), "COMMIT_OUTCOME_UNKNOWN"); assert.equal(s.state, before);
    });
    await test(`${edition}/concurrent-corrections-one-winner`, async () => {
      const s = setup(), c = await candidate(s), d = await candidate(s), before = s.state;
      const r = await Promise.all([apply(s, c, before), apply(s, d, before)]); assert.equal(r.filter(x => x.ok).length, 1); assert.equal(s.writes, 1);
    });
    await test(`${edition}/independent-storage-lock-stays`, async () => {
      const s = setup(); s.advance({ kind: "INTEGRITY_INCIDENT", incident: { id: f.bytes("storage"), nonce: f.bytes("storage", 32), reason: "STORAGE_FAILURE" } });
      ok(await apply(s, await candidate(s))); assert.equal(s.state.timeIncident, undefined); assert.equal(s.state.recoveryRequired, true);
    });
    await test(`${edition}/expired-license-is-not-renewed`, async () => {
      const s = setup(), c = await candidate(s), end = s.state.current.entitlement.payload.graceUntil;
      Object.assign(c.payload, { issuedAt: end, correctedUtc: end, notBefore: end, notAfter: end + 3600n }); resign(c); ok(await apply(s, c));
      assert.equal(s.machine.project(s.state, s.state.clockHighWater).state, "EXPIRED_LOCKED");
    });
  }
  assert.equal(new Set(ids).size, ids.length);
  return { attempted: ids.length, passed: ids.length - failures.length, failures };
}
