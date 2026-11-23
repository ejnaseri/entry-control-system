// TEST_ONLY_DO_NOT_TRUST. Real signed requests/Leases; protected storage is a double.
import assert from "node:assert/strict";
import { createLicenseStateFixtures } from "./license-state-fixtures.mjs";
import { TEST_ONLY_KEYS } from "../../licensing/vectors/v1/test-only/keys.mjs";
import { signEs256Rfc6979LowS } from "../../licensing/vectors/v1/lib/ecdsa-rfc6979.mjs";
import { runHybridCombinedCases } from "./license-hybrid-combined-tests.mjs";

export async function runLicenseHybridResponseTests(production, combinedOnly = false) {
  const failures = [], ids = [], key = TEST_ONLY_KEYS.TEST_ONLY_INSTALLATION_DEVICE_PRIMARY;
  const ok = r => { assert(r.ok, `${r.stage}/${r.errorCode}`); return r; };
  const no = (r, code) => { assert.equal(r.ok, false); if (code) assert.equal(r.errorCode, code);
    assert.equal(r.durable, false); assert.equal(r.runtimeAuthority, "NONE"); };
  const hex = b => Buffer.from(b).toString("hex");
  const test = async (id, fn) => { ids.push(id); try { await fn(); } catch (e) { failures.push({ id, message: e.stack }); } };
  for (const edition of ["FULL", "ATTENDANCE"]) {
    const f = createLicenseStateFixtures(production, { edition }), core = production.core;
    async function setup({ active = false, recovery = false, future = false } = {}) {
      const machine = core.createLicenseStateMachineV1(f.configuration);
      const s = { machine, state: machine.initial(), records: new Map(), reads: 0, commits: 0, writes: 0, counter: 0 };
      s.advance = command => { s.state = ok(machine.transition(s.state, command, f.now)).state; };
      s.advance(f.initialActivation({ mode: "HYBRID_LEASED", ...(future ? { termStartsAt: f.now + 120n } : {}) }).command);
      s.observation = { wallUtc: f.now, bootId: f.bytes("response-boot"), monotonicMs: 1000n };
      const registration = { register: async p => { s.records.set(hex(p.requestId), p);
        return { decision: "REGISTERED", requestId: p.requestId, requestHash: p.requestHash }; } };
      s.requester = production.createHybridRequestWorkflowV1({ machine, verification: f.verification, registration,
        challenge: { acquire: async () => core.encodeDeterministicCborV1(new Map(Object.entries({ schemaVersion: 1n,
          carrierType: "lease-challenge", requestNonce: f.bytes(`nonce-${++s.counter}`, 32), expiresInSeconds: 300n }))) },
        installation: { randomBytes: () => f.bytes(`id-${s.counter}`), signInstallation: async ({ sigStructure }) =>
          new Uint8Array(signEs256Rfc6979LowS(sigStructure, key.privateScalar)) }, time: { observe: () => s.observation } });
      s.reader = { read: async id => { s.reads++; return s.records.get(hex(id)); } };
      s.store = { commit: async p => {
        s.commits++;
        if (s.state.stateGeneration !== p.expectedPreviousGeneration || hex(s.state.stateHash) !== hex(p.expectedPreviousHash)) return { decision: "CONFLICT" };
        if (p.decision === "PROPOSED") { s.writes++; s.state = p.state; }
        return { decision: "ACKNOWLEDGED", stateGeneration: s.state.stateGeneration, stateHash: s.state.stateHash };
      } };
      s.make = () => production.createHybridLeaseResponseWorkflowV1({ machine, verification: f.verification, requests: s.reader, store: s.store });
      s.workflow = s.make();
      s.issue = async (purpose = "CHECK_IN") => {
        s.request = ok(await s.requester.prepare(s.state, purpose === "CHECK_IN" ? { purpose, target: s.state.current ? "CURRENT" : "PENDING" } : { purpose })).plan;
        ok(await s.requester.release(s.request));
      };
      s.carrier = fields => core.encodeDeterministicCborV1(new Map(Object.entries({ schemaVersion: 1n,
        carrierType: "lease-response", requestId: s.request.requestId, ...fields })));
      s.response = (overrides = {}) => {
        const p = (s.state.current ?? s.state.pending).entitlement.payload, d = s.state.device, c = s.state.control;
        const l = f.payload("pos-lease-initial-control");
        Object.assign(l, { edition, tokenId: f.bytes(`response-${s.counter}`), licenseId: p.licenseId, activationId: p.activationId,
          installationId: d.installationId, deviceKeyId: d.deviceKeyId, assurance: d.assurance, features: p.features,
          entitlementTokenId: p.tokenId, entitlementGeneration: p.generation,
          leaseRequestId: s.request.requestId, leaseRequestHash: s.request.requestHash,
          leaseRevision: s.state.leaseRevision + 1n, issuedAt: f.now, notBefore: f.now, serverTime: f.now,
          notAfter: f.now + p.offlineAllowanceSeconds, offlineUntil: f.now + p.offlineAllowanceSeconds,
          controlRevision: c.revision, controlState: c.state, controlEffectiveAt: c.effectiveAt, controlReasonCode: c.reasonCode,
          ...overrides });
        return s.carrier({ lease: f.sign("lease", l) });
      };
      s.input = encoded => ({ encoded, requestId: s.request.requestId });
      s.prepare = (encoded = s.response(), extra = {}) => s.workflow.prepare(s.state, { ...s.input(encoded), ...extra }, f.now);
      await s.issue();
      if (active || recovery) {
        ok(await s.workflow.complete(ok(await s.prepare()).plan));
        if (recovery) {
          const incident = { id: f.bytes("incident"), nonce: f.bytes("incident-nonce", 32), reason: "CLOCK_FORWARD_JUMP" };
          s.advance({ kind: "OBSERVE_TIME", observation: s.observation, incident });
          s.observation = { ...s.observation, wallUtc: f.now + 90000n };
          s.advance({ kind: "BEGIN_TIME_RECOVERY", observation: s.observation, incident });
        }
        await s.issue(recovery ? "TIME_RECOVERY" : "CHECK_IN");
      }
      return s;
    }
    if (combinedOnly) {
      await runHybridCombinedCases({ production, f, setup, edition, test, ok, no, hex });
      continue;
    }
    await test(`${edition}/pending-pair-atomic-commit`, async () => {
      const s = await setup(), before = s.state, p = ok(await s.prepare()).plan;
      assert.equal(s.state, before); assert.equal(s.commits, 0); assert.equal(p.proposal.decision, "PROPOSED");
      assert(p.proposal.commitObligations.length); assert(p.proposal.state.current.lease);
      const r = ok(await s.workflow.complete(p)); assert.equal(r.decision, "ADAPTER_ACKNOWLEDGED");
      assert.equal(r.durable, false); assert.equal(r.runtimeAuthority, "NONE"); assert.equal(s.writes, 1);
      assert(s.state.consumedRequests.some(x => hex(x.id) === hex(s.request.requestId)));
    });
    await test(`${edition}/current-lease-and-exact-retry-readonly`, async () => {
      const s = await setup({ active: true }), response = s.response();
      ok(await s.workflow.complete(ok(await s.prepare(response)).plan)); const writes = s.writes, state = s.state;
      const retry = ok(await s.prepare(response)).plan; assert.equal(retry.proposal.decision, "IDEMPOTENT");
      assert.equal(ok(await s.workflow.complete(retry)).decision, "ADAPTER_CONFIRMED_DUPLICATE");
      assert.equal(s.writes, writes); assert.equal(s.state, state);
    });
    await test(`${edition}/closed-input-cap-schema-and-carrier-id`, async () => {
      const s = await setup();
      for (const encoded of [new Uint8Array(), new Uint8Array(524289), new Uint8Array([0xff]), 'bad']) no(await s.prepare(encoded));
      no(await s.prepare(s.response(), { url: "https://untrusted" }), "RESPONSE_INPUT_INVALID");
      no(await s.prepare(s.carrier({ lease: new Uint8Array([1]), requestId: f.bytes("wrong") })), "RESPONSE_REQUEST_ID_MISMATCH");
      assert.equal(s.reads, 0); assert.equal(s.commits, 0);
    });
    await test(`${edition}/sidecars-and-transition-only-no-partial-apply`, async () => {
      const s = await setup();
      const lease = ok(f.verifier.parseCarrier({ carrierType: "lease-response", encoded: s.response() })).value.carrier.lease;
      for (const fields of [{ offlineControl: lease }, { reactivationAuthorization: lease },
        { lease, offlineControl: lease }, { lease, reactivationAuthorization: lease }, { lease, trustBundle: lease }])
        no(await s.prepare(s.carrier(fields)), "RESPONSE_VARIANT_NOT_IMPLEMENTED");
      assert.equal(s.reads, 0); assert.equal(s.commits, 0);
    });
    await test(`${edition}/request-reader-missing-unavailable-and-redacted`, async () => {
      const s = await setup(); s.records.clear(); no(await s.prepare(), "OUTSTANDING_REQUEST_NOT_FOUND");
      s.reader.read = async () => { throw Error("SECRET_PATH"); };
      const r = await s.prepare(); no(r, "REQUEST_STORE_UNAVAILABLE"); assert(!JSON.stringify(r).includes("SECRET_PATH"));
    });
    await test(`${edition}/stored-request-signature-id-and-size`, async () => {
      const s = await setup(), original = s.request, response = s.response();
      await s.issue(); s.records.set(hex(original.requestId), s.request); s.request = original;
      no(await s.prepare(response), "STORED_REQUEST_ID_MISMATCH");
      const bad = new Uint8Array(original.encoded); bad[bad.length - 1] ^= 1;
      for (const encoded of [bad, new Uint8Array(200000)]) { s.records.set(hex(original.requestId), { encoded }); no(await s.prepare(response)); }
    });
    await test(`${edition}/request-hash-binding-before-duplicate`, async () => {
      const s = await setup(), response = s.response(); ok(await s.workflow.complete(ok(await s.prepare(response)).plan));
      await s.issue();
      const lease = ok(f.verifier.parseCarrier({ carrierType: "lease-response", encoded: response })).value.carrier.lease;
      no(await s.prepare(s.carrier({ lease })), "RESPONSE_REQUEST_BINDING_MISMATCH");
    });
    await test(`${edition}/signed-binding-and-revision-negatives`, async () => {
      const s = await setup({ active: true }), before = s.state;
      for (const changes of [{ leaseRequestHash: f.bytes("wrong", 32) }, { entitlementTokenId: f.bytes("wrong") },
        { entitlementGeneration: 2n }, { installationId: f.bytes("wrong") }, { activationId: f.bytes("wrong") },
        { buildIdentitySha256: f.bytes("wrong", 32) }, { leaseRevision: s.state.leaseRevision },
        { controlRevision: 0n, controlState: "NONE", controlEffectiveAt: 0n, controlReasonCode: 0n }]) no(await s.prepare(s.response(changes)));
      assert.equal(s.state, before);
    });
    await test(`${edition}/tampered-signature-and-truncated-response`, async () => {
      const s = await setup(), encoded = s.response();
      const lease = new Uint8Array(ok(f.verifier.parseCarrier({ carrierType: "lease-response", encoded })).value.carrier.lease);
      lease[lease.length - 1] ^= 1; no(await s.prepare(s.carrier({ lease })));
      no(await s.prepare(encoded.subarray(0, encoded.length - 1))); assert.equal(s.commits, 0);
    });
    await test(`${edition}/expired-response`, async () => {
      const s = await setup(); no(await s.workflow.prepare(s.state, s.input(s.response()), f.now + 86400n * 40n));
    });
    await test(`${edition}/input-copied-before-reader-await`, async () => {
      const s = await setup(), encoded = s.response(), input = s.input(encoded), original = s.reader.read;
      s.reader.read = async id => { encoded.fill(0); input.requestId.fill(0); return original(id); };
      ok(await s.workflow.prepare(s.state, input, f.now));
    });
    await test(`${edition}/state-and-plan-provenance`, async () => {
      const s = await setup(); no(await s.workflow.prepare({ ...s.state }, s.input(s.response()), f.now));
      const p = ok(await s.prepare()).plan;
      no(await s.workflow.complete({ ...p }), "UNTRUSTED_RESPONSE_PLAN"); no(await s.make().complete(p), "UNTRUSTED_RESPONSE_PLAN");
      assert.equal(s.commits, 0);
    });
    await test(`${edition}/state-advance-between-plan-and-commit`, async () => {
      const s = await setup(), p = ok(await s.prepare()).plan;
      s.advance({ kind: "NETWORK", unavailable: true }); no(await s.workflow.complete(p), "COMMIT_STATE_CONFLICT");
    });
    await test(`${edition}/pending-conflict-and-bad-receipts`, async () => {
      const s = await setup(), p = ok(await s.prepare()).plan;
      for (const receipt of [{ decision: "PENDING" }, { decision: "CONFLICT" }, undefined,
        { decision: "ACKNOWLEDGED", stateGeneration: 99n, stateHash: p.proposal.state.stateHash }]) {
        s.store.commit = async () => receipt; const r = await s.workflow.complete(p); no(r); assert(r.commitAttempted);
      }
    });
    await test(`${edition}/lost-acknowledgement-reconcile-exact-retry`, async () => {
      const s = await setup(), response = s.response(), p = ok(await s.prepare(response)).plan, commit = s.store.commit;
      s.store.commit = async proposal => { await commit(proposal); throw Error("SECRET_PATH"); };
      const r = await s.workflow.complete(p); no(r, "COMMIT_OUTCOME_UNKNOWN"); assert(r.commitAttempted);
      assert.equal(s.writes, 1); s.store.commit = commit;
      assert.equal(ok(await s.workflow.complete(ok(await s.prepare(response)).plan)).decision, "ADAPTER_CONFIRMED_DUPLICATE");
      assert.equal(s.writes, 1);
    });
    await test(`${edition}/time-recovery-exact-evidence-and-no-replay`, async () => {
      const s = await setup({ recovery: true }), response = s.response(), before = s.state;
      const p = ok(await s.prepare(response, { observation: s.observation })).plan;
      assert.equal(s.state, before); assert.equal(p.proposal.state.timeIncident, undefined);
      ok(await s.workflow.complete(p)); no(await s.prepare(response, { observation: s.observation }));
    });
    await test(`${edition}/time-recovery-observation-evidence-and-rtt-negatives`, async () => {
      const s = await setup({ recovery: true }), response = s.response();
      no(await s.prepare(response), "RECEIPT_OBSERVATION_REQUIRED");
      for (const observation of [{ ...s.observation, bootId: f.bytes("other-boot") },
        { ...s.observation, monotonicMs: 0n }, { ...s.observation, monotonicMs: 302001n }]) no(await s.prepare(response, { observation }));
      s.records.set(hex(s.request.requestId), { encoded: s.request.encoded }); no(await s.prepare(response, { observation: s.observation }));
    });
    await test(`${edition}/time-recovery-observation-copied-and-restrictions`, async () => {
      const s = await setup({ recovery: true }); s.advance({ kind: "INTEGRITY_INCIDENT",
        incident: { id: f.bytes("tamper"), nonce: f.bytes("tamper-nonce", 32), reason: "KEY_LOSS" } });
      await s.issue("TIME_RECOVERY");
      const observation = { ...s.observation, bootId: new Uint8Array(s.observation.bootId) }, read = s.reader.read;
      s.reader.read = async id => { observation.bootId.fill(0); observation.monotonicMs = 99999999n; return read(id); };
      const p = ok(await s.prepare(s.response(), { observation })).plan;
      assert(p.proposal.state.recoveryRequired); assert.equal(p.proposal.state.timeIncident, undefined);
      assert.equal(s.machine.project(p.proposal.state, f.now).operational, false);
    });
    await test(`${edition}/future-pair-stays-pending-until-effective`, async () => {
      const s = await setup({ future: true });
      const p = ok(await s.prepare()).plan;
      assert.equal(p.proposal.state.current, undefined); assert(p.proposal.state.pending.lease);
      assert.equal(s.machine.project(p.proposal.state, f.now).operational, false);
    });
    await test(`${edition}/network-outage-is-neutral-and-valid-response-clears-flag`, async () => {
      const s = await setup({ active: true }); s.advance({ kind: "NETWORK", unavailable: true }); await s.issue();
      const before = s.state; no(await s.prepare(new Uint8Array([0xff]))); assert.equal(s.state, before);
      const p = ok(await s.prepare()).plan; assert.equal(p.proposal.state.networkUnavailable, false);
      assert.equal(p.proposal.state.tamperLatched, false); assert.equal(p.proposal.state.recoveryRequired, false);
    });
    await test(`${edition}/lease-suspend-preserves-control-restriction`, async () => {
      const s = await setup({ active: true });
      const p = ok(await s.prepare(s.response({ controlRevision: s.state.control.revision + 1n,
        controlState: "SUSPENDED", controlEffectiveAt: f.now, controlReasonCode: 1n }))).plan;
      assert.equal(s.machine.project(p.proposal.state, f.now).state, "SUSPENDED_LOCKED");
    });
    await test(`${edition}/stale-request-after-reader-state-change`, async () => {
      const s = await setup(), read = s.reader.read;
      s.reader.read = async id => { s.advance({ kind: "NETWORK", unavailable: true }); return read(id); };
      const p = ok(await s.prepare()).plan; no(await s.workflow.complete(p), "COMMIT_STATE_CONFLICT");
      no(await s.prepare());
    });
    await test(`${edition}/commit-hash-mismatch-and-plan-bytes-immutable`, async () => {
      const s = await setup(), p = ok(await s.prepare()).plan, original = hex(p.proposal.state.stateHash);
      p.proposal.state.stateHash.fill(0); p.proposal.expectedPreviousHash.fill(0);
      assert.equal(hex(p.proposal.state.stateHash), original);
      s.store.commit = async () => ({ decision: "ACKNOWLEDGED", stateGeneration: p.proposal.state.stateGeneration, stateHash: new Uint8Array(32) });
      no(await s.workflow.complete(p), "COMMIT_ACKNOWLEDGEMENT_INVALID");
    });
    await test(`${edition}/time-evidence-must-match-exact-request`, async () => {
      const s = await setup({ recovery: true });
      s.records.set(hex(s.request.requestId), { encoded: s.request.encoded,
        timeEvidence: { ...s.request.timeEvidence, requestHash: f.bytes("wrong-evidence", 32) } });
      no(await s.prepare(s.response(), { observation: s.observation }));
    });
  }
  assert.equal(new Set(ids).size, ids.length);
  return { attempted: ids.length, passed: ids.length - failures.length, failures };
}
