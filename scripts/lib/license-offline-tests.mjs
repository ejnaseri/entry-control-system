// TEST_ONLY_DO_NOT_TRUST. This tests proposals, not Windows/durable admission.
import assert from "node:assert/strict";
import { createLicenseStateFixtures } from "./license-state-fixtures.mjs";

export async function runLicenseOfflineTests(production) {
  const failures = [], ids = [];
  const test = async (id, run) => { ids.push(id); try { await run(); } catch (e) { failures.push({ id, message: e.stack ?? String(e) }); } };
  const dump = v => JSON.stringify(v, (_, x) => typeof x === "bigint" ? `${x}n` : x instanceof Uint8Array ? [...x] : x);
  for (const edition of ["FULL", "ATTENDANCE"]) {
    const f = createLicenseStateFixtures(production, { edition });
    const setup = () => {
      const machine = production.core.createLicenseStateMachineV1(f.configuration), state = machine.initial();
      const activation = f.initialActivation({ label: `offline-${edition}` });
      const s = { machine, state, activation, reads: 0, read: async () => ({ encoded: activation.encodedRequest }) };
      s.planner = production.createOfflineImportPlannerV1({ machine, verification: f.verification,
        requests: { read: async id => { s.reads++; return s.read(id); } } });
      s.input = { kind: "ENTITLEMENT", artifact: new Uint8Array(activation.encoded), requestId: new Uint8Array(activation.request.requestId) };
      return s;
    };
    const prepare = (s, input = s.input) => s.planner.prepare(s.state, input, f.now);
    const accepted = r => { assert(r.ok, `${r.stage}/${r.errorCode}`); assert.equal(r.durable, false); assert.equal(r.runtimeAuthority, "NONE"); };
    const rejected = (r, code) => { assert.equal(r.ok, false); if (code) assert.equal(r.errorCode, code); assert.equal(r.durable, false); assert.equal(r.runtimeAuthority, "NONE"); };
    await test(`${edition}/activation-is-only-a-cas-proposal`, async () => {
      const s = setup(), before = dump(s.state), r = await prepare(s); accepted(r);
      assert.equal(r.decision, "PROPOSED"); assert.equal(r.proposal.state.current.entitlement.payload.edition, edition);
      assert.equal(r.proposal.expectedPreviousGeneration, 0n);
      assert(r.proposal.commitObligations.includes("COMPARE_PREVIOUS_GENERATION_AND_HASH"));
      assert.equal(dump(s.state), before); assert.equal(s.state.consumedRequests.length, 0);
    });
    await test(`${edition}/exact-import-retry-is-idempotent`, async () => {
      const s = setup(), first = await prepare(s); accepted(first); s.state = first.proposal.state;
      const second = await prepare(s); accepted(second); assert.equal(second.decision, "IDEMPOTENT"); assert.equal(second.proposal.state, s.state);
    });
    await test(`${edition}/tampered-file-is-neutral`, async () => {
      const s = setup(), before = dump(s.state); s.input.artifact[s.input.artifact.length - 1] ^= 1;
      rejected(await prepare(s), "SIGNATURE_INVALID"); assert.equal(dump(s.state), before);
    });
    await test(`${edition}/oversize-before-store-read`, async () => {
      const s = setup(); rejected(await prepare(s, { ...s.input, artifact: new Uint8Array(16385) }), "FILE_SIZE_INVALID"); assert.equal(s.reads, 0);
    });
    await test(`${edition}/empty-before-store-read`, async () => {
      const s = setup(); rejected(await prepare(s, { ...s.input, artifact: new Uint8Array() }), "FILE_SIZE_INVALID"); assert.equal(s.reads, 0);
    });
    await test(`${edition}/path-input-is-not-a-filesystem-fallback`, async () => {
      const s = setup(); rejected(await prepare(s, { ...s.input, path: "C:/untrusted/license.ecslic" }), "OFFLINE_INPUT_FIELD_FORBIDDEN"); assert.equal(s.reads, 0);
    });
    await test(`${edition}/unknown-intent-is-closed`, async () => {
      const s = setup(); rejected(await prepare(s, { ...s.input, kind: "__proto__" }), "OFFLINE_INTENT_UNSUPPORTED"); assert.equal(s.reads, 0);
    });
    await test(`${edition}/invalid-request-id-before-store-read`, async () => {
      const s = setup(); rejected(await prepare(s, { ...s.input, requestId: new Uint8Array(32) }), "REQUEST_ID_INVALID"); assert.equal(s.reads, 0);
    });
    await test(`${edition}/missing-request-is-neutral`, async () => {
      const s = setup(); s.read = async () => undefined; rejected(await prepare(s), "OUTSTANDING_REQUEST_NOT_FOUND");
    });
    await test(`${edition}/store-failure-is-redacted`, async () => {
      const s = setup(); s.read = async () => { throw new Error("SECRET_CANARY_CREDENTIAL_DO_NOT_LEAK"); };
      const r = await prepare(s); rejected(r, "REQUEST_STORE_UNAVAILABLE"); assert(!dump(r).includes("SECRET_CANARY"));
    });
    await test(`${edition}/stored-request-signature-is-reverified`, async () => {
      const s = setup(), bytes = new Uint8Array(s.activation.encodedRequest); bytes[bytes.length - 1] ^= 1;
      s.read = async () => ({ encoded: bytes }); rejected(await prepare(s), "SIGNATURE_INVALID");
    });
    await test(`${edition}/store-cannot-substitute-another-request`, async () => {
      const s = setup(); s.read = async () => ({ encoded: f.initialActivation({ label: "other" }).encodedRequest });
      rejected(await prepare(s), "STORED_REQUEST_ID_MISMATCH");
    });
    await test(`${edition}/request-purpose-is-not-selected-by-file`, async () => {
      const s = setup(); rejected(await prepare(s, { ...s.input, kind: "RECOVERY" }), "OFFLINE_REQUEST_PURPOSE_MISMATCH");
    });
    await test(`${edition}/cross-type-file-is-not-control`, async () => {
      const s = setup(); rejected(await prepare(s, { kind: "CONTROL", artifact: s.input.artifact })); assert.equal(s.reads, 0);
    });
    await test(`${edition}/reactivation-needs-both-artifacts`, async () => {
      const s = setup(); rejected(await prepare(s, { kind: "REACTIVATION", authorization: s.input.artifact, requestId: s.input.requestId }), "FILE_BYTES_REQUIRED"); assert.equal(s.reads, 0);
    });
    await test(`${edition}/forged-state-has-no-provenance`, async () => {
      const s = setup(); s.state = { ...s.state }; rejected(await prepare(s), "UNTRUSTED_MODEL_STATE"); assert.equal(s.reads, 0);
    });
    await test(`${edition}/candidate-is-frozen-before-async-read`, async () => {
      const s = setup(); let release;
      s.read = () => new Promise(resolve => { release = resolve; });
      const pending = prepare(s); assert.equal(typeof release, "function");
      s.input.artifact.fill(0); s.input.requestId.fill(0);
      release({ encoded: s.activation.encodedRequest }); accepted(await pending);
    });
    await test(`${edition}/concurrent-plans-do-not-consume-or-commit`, async () => {
      const s = setup(), [a, b] = await Promise.all([prepare(s), prepare(s)]); accepted(a); accepted(b);
      assert.equal(dump(a.proposal.expectedPreviousHash), dump(b.proposal.expectedPreviousHash));
      assert.equal(a.proposal.expectedPreviousGeneration, b.proposal.expectedPreviousGeneration);
      assert.equal(s.state.consumedRequests.length, 0); assert.equal(s.state.stateGeneration, 0n);
    });
    await test(`${edition}/vendor-control-proposal-needs-no-request-read`, async () => {
      const s = setup(), active = await prepare(s); accepted(active); s.state = active.proposal.state;
      const p = s.state.current.entitlement.payload, c = f.payload("pos-control-vendor-suspend");
      Object.assign(c, { edition, tokenId: f.bytes("offline-control"), licenseId: p.licenseId, activationId: p.activationId,
        issuedAt: f.now, notBefore: f.now, notAfter: f.now + 86400n, effectiveAt: f.now, controlRevision: 1n, reasonCode: 1n });
      s.reads = 0; const r = await prepare(s, { kind: "CONTROL", artifact: f.sign("offline-control", c) }); accepted(r);
      assert.equal(s.machine.project(r.proposal.state, f.now).state, "SUSPENDED_LOCKED"); assert.equal(s.reads, 0);
    });
  }
  assert.equal(new Set(ids).size, ids.length);
  return { attempted: ids.length, passed: ids.length - failures.length, failures };
}
