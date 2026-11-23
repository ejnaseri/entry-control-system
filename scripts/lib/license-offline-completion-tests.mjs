// TEST_ONLY_DO_NOT_TRUST: in-memory all-old/all-new store, not Windows durability.
import assert from "node:assert/strict";
import { runOfflineFileMatrix } from "./license-offline-file-matrix.mjs";
import { createLicenseStateFixtures } from "./license-state-fixtures.mjs";
import { TEST_ONLY_KEYS } from "../../licensing/vectors/v1/test-only/keys.mjs";
import { signEs256Rfc6979LowS } from "../../licensing/vectors/v1/lib/ecdsa-rfc6979.mjs";

export async function runLicenseOfflineCompletionTests(production, fileMatrixOnly = false) {
  const ids = [], failures = [];
  const test = async (id, run) => { ids.push(id); try { await run(); } catch (e) { failures.push({ id, message: e.stack ?? String(e) }); } };
  const ok = r => { assert(r.ok, `${r.stage}/${r.errorCode}`); return r; };
  const rejected = (r, code, attempted) => {
    assert.equal(r.ok, false); if (code) assert.equal(r.errorCode, code);
    assert.equal(r.commitAttempted, attempted); assert.equal(r.durable, false); assert.equal(r.runtimeAuthority, "NONE");
  };
  const hex = b => Buffer.from(b).toString("hex");
  for (const edition of ["FULL", "ATTENDANCE"]) {
    const f = createLicenseStateFixtures(production, { edition });
    function setup() {
      const machine = production.core.createLicenseStateMachineV1(f.configuration);
      const s = { machine, state: machine.initial(), requests: new Map(), commits: 0, writes: 0, events: [], entropy: 0 };
      s.store = { commit: async proposal => {
        s.commits++;
        if (s.state.stateGeneration !== proposal.expectedPreviousGeneration || hex(s.state.stateHash) !== hex(proposal.expectedPreviousHash)) return { decision: "CONFLICT" };
        if (proposal.decision === "PROPOSED") {
          assert.deepEqual([...proposal.commitObligations], ["COMPARE_PREVIOUS_GENERATION_AND_HASH", "STAGE_COMPLETE_STATE_AND_JOURNAL",
            "FLUSH_AND_ATOMICALLY_REPLACE_COMPLETE_STATE", "SEAL_INDEPENDENT_ANCHORS", "RECONCILE_RESTRICTIVE_TRANSITION_BEFORE_REPORTING_EFFECTIVE"]);
          // Single synchronous replacement models an atomic boundary only.
          s.state = proposal.state; s.writes++;
          s.events.push({ generation: s.state.stateGeneration, hash: hex(s.state.stateHash), consumed: s.state.consumedRequests.length, receipts: s.state.receipts.length });
        } else { assert.equal(proposal.state, s.state); assert.equal(proposal.commitObligations.length, 0); }
        return { decision: "ACKNOWLEDGED", stateGeneration: s.state.stateGeneration, stateHash: s.state.stateHash };
      } };
      s.reader = { read: async id => { const p = s.requests.get(hex(id)); return p ? { encoded: p.encoded } : undefined; } };
      s.workflow = production.createOfflineEntitlementCompletionV1({ machine, verification: f.verification, requests: s.reader, store: s.store });
      s.generator = production.createOfflineRequestWorkflowV1({ machine, verification: f.verification,
        installation: { randomBytes: n => f.bytes(`completion-${++s.entropy}`, n),
          signInstallation: async ({ sigStructure }) => new Uint8Array(signEs256Rfc6979LowS(sigStructure, TEST_ONLY_KEYS.TEST_ONLY_INSTALLATION_DEVICE_PRIMARY.privateScalar)) },
        registration: { register: async p => {
          assert.equal(p.expectedStateGeneration, s.state.stateGeneration); assert.equal(hex(p.expectedStateHash), hex(s.state.stateHash));
          assert(!s.requests.has(hex(p.requestId))); s.requests.set(hex(p.requestId), p);
          return { decision: "REGISTERED", requestId: p.requestId, requestHash: p.requestHash };
        } },
      });
      return s;
    }
    async function candidate(s, { purpose = "ACTIVATE", now = f.now, start = now, shorten = false } = {}) {
      const plan = ok(await s.generator.prepare(s.state, { purpose, issuedAt: now, notAfter: now + 86400n })).plan;
      ok(await s.generator.export(plan));
      let payload;
      if (purpose === "ACTIVATE") payload = f.initialActivation({ now, notBefore: start, termStartsAt: start }).entitlementPayload;
      else {
        const parent = (s.state.pending ?? s.state.current).entitlement.payload;
        payload = f.clone(parent);
        const shift = start - parent.termStartsAt;
        Object.assign(payload, { tokenId: f.bytes(`successor-${s.entropy}`), generation: parent.generation + 1n,
          previousTokenId: parent.tokenId, issuedAt: now, notBefore: start, termStartsAt: start,
          termEndsAt: parent.termEndsAt + shift, warningStartsAt: parent.warningStartsAt + shift,
          graceUntil: parent.graceUntil + shift, notAfter: parent.notAfter + shift });
        if (shorten) payload.features = payload.features.slice(0, -1);
      }
      Object.assign(payload, { requestId: plan.requestId, requestHash: plan.requestHash });
      return { plan, payload, input: { kind: "ENTITLEMENT", requestId: plan.requestId, artifact: f.sign("entitlement", payload) } };
    }
    const apply = (s, c, now = f.now, state = s.state) => s.workflow.apply(state, c.input, now);
    const activate = async s => { const c = await candidate(s); ok(await apply(s, c)); return c; };
    if (fileMatrixOnly) {
      await runOfflineFileMatrix({ edition, kind: "ENTITLEMENT", production, f, test,
        scenario: async () => { const s = setup();  return { s, c: await candidate(s) }; } });
      continue;
    }
    await test(`${edition}/generated-request-to-whole-state-ack`, async () => {
      const s = setup(), c = await candidate(s), old = s.state, r = ok(await apply(s, c));
      assert.equal(r.decision, "ADAPTER_ACKNOWLEDGED"); assert.equal(r.durable, false); assert.equal(r.runtimeAuthority, "NONE");
      assert.equal(s.state.stateGeneration, 1n); assert.equal(s.state.consumedRequests.length, 1); assert.equal(s.state.receipts.length, 1);
      assert.equal(s.events.length, 1); assert.equal(old.stateGeneration, 0n); assert.equal(s.machine.project(s.state, f.now).state, "ACTIVE");
      r.stateHash.fill(0); assert.notEqual(hex(s.state.stateHash), "00".repeat(32));
    });
    await test(`${edition}/consumed-request-history-enables-read-only-exact-retry`, async () => {
      const s = setup(), c = await activate(s), prior = s.state;
      const r = ok(await apply(s, c)); assert.equal(r.decision, "ADAPTER_CONFIRMED_DUPLICATE");
      assert.equal(s.state, prior); assert.equal(s.writes, 1); assert.equal(s.events.length, 1); assert.equal(s.requests.size, 1);
    });
    await test(`${edition}/invalid-file-cannot-write-or-consume`, async () => {
      const s = setup(), c = await candidate(s), before = s.state; c.input.artifact[c.input.artifact.length - 1] ^= 1;
      rejected(await apply(s, c), "SIGNATURE_INVALID", false); assert.equal(s.state, before); assert.equal(s.commits, 0);
    });
    await test(`${edition}/wrong-request-and-wrong-edition-neutral`, async () => {
      const s = setup(), c = await candidate(s), other = await candidate(s);
      rejected(await apply(s, { input: { ...c.input, requestId: other.plan.requestId } }), undefined, false);
      c.payload.edition = edition === "FULL" ? "ATTENDANCE" : "FULL";
      c.input.artifact = f.sign("entitlement", c.payload); rejected(await apply(s, c), undefined, false); assert.equal(s.commits, 0);
    });
    await test(`${edition}/write-failure-before-replacement-no-success`, async () => {
      const s = setup(), c = await candidate(s), before = s.state;
      s.store.commit = async () => { throw Error("SECRET_CANARY"); };
      const r = await apply(s, c); rejected(r, "COMMIT_OUTCOME_UNKNOWN", true);
      assert(!JSON.stringify(r).includes("SECRET_CANARY")); assert.equal(s.state, before); assert.equal(s.events.length, 0);
    });
    await test(`${edition}/lost-ack-after-replacement-retry-does-not-apply-twice`, async () => {
      const s = setup(), c = await candidate(s), commit = s.store.commit;
      s.store.commit = async p => { await commit(p); throw Error("lost ack"); };
      rejected(await apply(s, c), "COMMIT_OUTCOME_UNKNOWN", true); assert.equal(s.writes, 1);
      s.store.commit = commit; assert.equal(ok(await apply(s, c)).decision, "ADAPTER_CONFIRMED_DUPLICATE");
      assert.equal(s.writes, 1); assert.equal(s.state.consumedRequests.length, 1);
    });
    await test(`${edition}/pending-and-mismatched-ack-not-complete`, async () => {
      const s = setup(), c = await candidate(s), before = s.state;
      s.store.commit = async () => ({ decision: "PENDING" }); rejected(await apply(s, c), "COMMIT_PENDING", true);
      s.store.commit = async () => ({ decision: "ACKNOWLEDGED", stateGeneration: 1n, stateHash: new Uint8Array(32) });
      rejected(await apply(s, c), "COMMIT_ACKNOWLEDGEMENT_INVALID", true); assert.equal(s.state, before);
    });
    await test(`${edition}/stale-state-conflict-no-automatic-retry`, async () => {
      const s = setup(), old = s.state, c = await candidate(s); ok(await apply(s, c));
      rejected(await apply(s, c, f.now, old), "COMMIT_STATE_CONFLICT", true); assert.equal(s.writes, 1); assert.equal(s.commits, 2);
    });
    await test(`${edition}/concurrent-different-responses-only-one-whole-result`, async () => {
      const s = setup(), c = await candidate(s), d = await candidate(s), old = s.state;
      const results = await Promise.all([apply(s, c, f.now, old), apply(s, d, f.now, old)]);
      assert.equal(results.filter(r => r.ok).length, 1); assert.equal(results.find(r => !r.ok).errorCode, "COMMIT_STATE_CONFLICT");
      assert.equal(s.writes, 1); assert.equal(s.state.receipts.length, 1); assert.equal(s.state.consumedRequests.length, 1);
    });
    await test(`${edition}/immediate-renewal-is-complete-successor`, async () => {
      const s = setup(); await activate(s); const c = await candidate(s, { purpose: "RENEW" }); ok(await apply(s, c));
      assert.equal(s.state.current.entitlement.payload.generation, 2n); assert.equal(s.state.consumedRequests.length, 2);
    });
    await test(`${edition}/future-renewal-does-not-replace-current-early`, async () => {
      const s = setup(); await activate(s); const old = s.state.current;
      const c = await candidate(s, { purpose: "RENEW", start: f.now + 86400n }); ok(await apply(s, c));
      assert.equal(hex(s.state.current.entitlement.hash), hex(old.entitlement.hash)); assert.equal(s.state.pending.entitlement.payload.generation, 2n);
      const writes = s.writes; assert.equal(ok(await apply(s, c)).decision, "ADAPTER_CONFIRMED_DUPLICATE"); assert.equal(s.writes, writes);
      const promoted = ok(s.machine.transition(s.state, { kind: "REEVALUATE" }, f.now + 86400n));
      const receipt = await s.store.commit(promoted); assert.equal(receipt.decision, "ACKNOWLEDGED");
      assert.equal(s.state.current.entitlement.payload.generation, 2n); assert(!s.state.pending);
    });
    await test(`${edition}/lapsed-renewal-with-gap-promotes`, async () => {
      const s = setup(); await activate(s); const now = s.state.current.entitlement.payload.graceUntil + 86400n;
      const c = await candidate(s, { purpose: "RENEW", now }); ok(await apply(s, c, now));
      assert.equal(s.state.current.entitlement.payload.generation, 2n); assert.equal(s.machine.project(s.state, now).state, "ACTIVE");
    });
    await test(`${edition}/shortening-valid-term-rejected-before-store`, async () => {
      const s = setup(); await activate(s); const old = s.state, commits = s.commits;
      const c = await candidate(s, { purpose: "RENEW", shorten: true }); rejected(await apply(s, c), undefined, false);
      assert.equal(s.state, old); assert.equal(s.commits, commits);
    });
    await test(`${edition}/new-bytes-on-consumed-request-cannot-replace-license`, async () => {
      const s = setup(), c = await activate(s), before = s.state;
      c.payload.tokenId = f.bytes("replay-other-token"); c.input.artifact = f.sign("entitlement", c.payload);
      rejected(await apply(s, c), undefined, false); assert.equal(s.state, before); assert.equal(s.writes, 1);
    });
    await test(`${edition}/missing-archive-cannot-claim-duplicate-completion`, async () => {
      const s = setup(), c = await activate(s); s.requests.clear();
      rejected(await apply(s, c), "OUTSTANDING_REQUEST_NOT_FOUND", false); assert.equal(s.writes, 1);
    });
    await test(`${edition}/scope-and-model-provenance-reject-before-commit`, async () => {
      const s = setup(), c = await candidate(s);
      rejected(await s.workflow.apply(s.state, { ...c.input, kind: "CONTROL" }, f.now), "ENTITLEMENT_COMPLETION_ONLY", false);
      rejected(await apply(s, c, f.now, { ...s.state }), "UNTRUSTED_MODEL_STATE", false); assert.equal(s.commits, 0);
    });
    await test(`${edition}/duplicate-response-cannot-acknowledge-another-request`, async () => {
      const s = setup(), c = await candidate(s), other = await candidate(s); ok(await apply(s, c));
      rejected(await apply(s, { input: { ...c.input, requestId: other.plan.requestId } }), "OFFLINE_RESPONSE_REQUEST_MISMATCH", false);
      assert.equal(s.commits, 1); assert.equal(s.writes, 1);
    });
    await test(`${edition}/duplicate-response-cannot-use-replaced-request-history`, async () => {
      const s = setup(), c = await activate(s), request = f.clone(f.requestSnapshot(c.plan.encoded).payload);
      request.requestNonce = f.bytes("replacement-history-nonce", 32);
      s.requests.set(hex(c.plan.requestId), { encoded: f.sign("activation-request", request) });
      rejected(await apply(s, c), "OFFLINE_RESPONSE_REQUEST_MISMATCH", false); assert.equal(s.commits, 1);
    });
  }
  assert.equal(new Set(ids).size, ids.length);
  return { attempted: ids.length, passed: ids.length - failures.length, failures };
}
