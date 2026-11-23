// TEST_ONLY_DO_NOT_TRUST. Real signatures/core; request and Store adapters are memory doubles.
import assert from "node:assert/strict";
import { createLicenseStateFixtures } from "./license-state-fixtures.mjs";
import { TEST_ONLY_KEYS } from "../../licensing/vectors/v1/test-only/keys.mjs";
import { signEs256Rfc6979LowS } from "../../licensing/vectors/v1/lib/ecdsa-rfc6979.mjs";

export async function runLicenseHybridReactivationTests(production) {
  const ids = [], failures = [], hex = b => Buffer.from(b).toString("hex");
  const ok = r => { assert(r.ok, `${r.stage}/${r.errorCode}`); return r; };
  const no = (r, code) => { assert.equal(r.ok, false); if (code) assert.equal(r.errorCode, code);
    assert.equal(r.durable, false); assert.equal(r.runtimeAuthority, "NONE"); };
  const test = async (id, run) => { ids.push(id); try { await run(); } catch (e) { failures.push({ id, message: e.stack }); } };
  for (const edition of ["FULL", "ATTENDANCE"]) {
    const f = createLicenseStateFixtures(production, { edition }), core = production.core;
    const encode = fields => core.encodeDeterministicCborV1(new Map(Object.entries(fields)));
    function setup() {
      const machine = core.createLicenseStateMachineV1(f.configuration), initial = f.initialActivation();
      const s = { machine, initial, state: ok(machine.transition(machine.initial(), initial.command, f.now)).state,
        records: new Map(), counter: 0, signs: 0, challenges: 0, reads: 0, commits: 0, writes: 0 };
      s.advance = command => { s.state = ok(machine.transition(s.state, command, f.now)).state; };
      s.revoke = () => {
        const p = f.payload("pos-control-vendor-suspend"), old = s.state.current.entitlement.payload;
        Object.assign(p, { edition, tokenId: f.bytes(`revoke-${++s.counter}`), licenseId: old.licenseId, activationId: old.activationId,
          action: "REVOKE", controlRevision: 1n, effectiveAt: f.now, issuedAt: f.now, notBefore: f.now, notAfter: f.now + 86400n, reasonCode: 1n });
        s.advance({ kind: "IMPORT_CONTROL", encoded: f.sign("offline-control", p) });
        s.advance({ kind: "BEGIN_REACTIVATION", incident: { id: f.bytes(`incident-${s.counter}`), nonce: f.bytes(`incident-nonce-${s.counter}`, 32), reason: "COMMERCIAL_REACTIVATION" } });
      };
      s.revoke();
      s.reader = { read: async id => { s.reads++; return s.records.get(hex(id)); } };
      s.registration = { register: async p => {
        assert.equal(p.expectedStateGeneration, s.state.stateGeneration); assert.equal(hex(p.expectedStateHash), hex(s.state.stateHash));
        const old = s.records.get(hex(p.requestId)); if (old) assert.equal(hex(old.encoded), hex(p.encoded));
        s.records.set(hex(p.requestId), p); return { decision: old ? "EXACT_RETRY" : "REGISTERED", requestId: p.requestId, requestHash: p.requestHash };
      } };
      s.installation = { randomBytes: n => f.bytes(`random-${++s.counter}`, n), signInstallation: async ({ deviceKeyId, sigStructure }) => {
        s.signs++; const key = Object.values(TEST_ONLY_KEYS).find(k => hex(k.kid) === hex(deviceKeyId));
        return new Uint8Array(signEs256Rfc6979LowS(sigStructure, key.privateScalar));
      } };
      s.generator = production.createOfflineRequestWorkflowV1({ machine, verification: f.verification, installation: s.installation, registration: s.registration });
      s.challenge = { acquire: async () => { s.challenges++; return encode({ schemaVersion: 1n, carrierType: "lease-challenge",
        requestNonce: f.bytes(`challenge-${++s.counter}`, 32), expiresInSeconds: 300n }); } };
      s.requester = production.createHybridRequestWorkflowV1({ machine, verification: f.verification, requests: s.reader,
        installation: s.installation, registration: s.registration, challenge: s.challenge });
      s.store = { commit: async p => {
        s.commits++;
        if (p.expectedPreviousGeneration !== s.state.stateGeneration || hex(p.expectedPreviousHash) !== hex(s.state.stateHash)) return { decision: "CONFLICT" };
        assert(p.commitObligations.includes("SEAL_INDEPENDENT_ANCHORS")); assert(p.commitObligations.includes("STAGE_COMPLETE_STATE_AND_JOURNAL"));
        s.state = p.state; s.writes++; return { decision: "ACKNOWLEDGED", stateGeneration: s.state.stateGeneration, stateHash: s.state.stateHash };
      } };
      s.trustBundle = () => {
        const key = TEST_ONLY_KEYS.TEST_ONLY_ONLINE_LEASE_DENIED;
        const delegation = { ...f.payload("pos-delegation-online-lease"), tokenId: f.bytes(`trusted-reactivation-rotation-${++s.counter}`),
          delegationSerial: 5n, delegatedKeyId: key.kid, delegatedPublicKey: key.spkiDer };
        const denylist = { ...f.payload("pos-denylist-revision-1"), tokenId: f.bytes(`trusted-reactivation-deny-${++s.counter}`), deniedKeys: [] };
        return encode({ schemaVersion: 1n, carrierType: "trust-bundle", delegations: [f.sign("key-delegation", delegation)], denylist: f.sign("key-denylist", denylist) });
      };
      s.trustedStore = { commit: async p => {
        s.commits++;
        const proposal = p.license.proposal;
        if (proposal.expectedPreviousGeneration !== s.state.stateGeneration || hex(proposal.expectedPreviousHash) !== hex(s.state.stateHash)) return { decision: "CONFLICT" };
        s.state = proposal.state; s.writes++;
        return { decision: "ACKNOWLEDGED", trustHash: p.trust.proposedTrustHash, stateGeneration: s.state.stateGeneration, stateHash: s.state.stateHash };
      } };
      s.make = () => production.createHybridReactivationResponseWorkflowV1({ machine, verification: f.verification, requests: s.reader, store: s.store });
      s.makeTrusted = () => production.createHybridTrustedReactivationResponseWorkflowV1({ machine, verification: f.verification, requests: s.reader, store: s.trustedStore });
      s.workflow = s.make(); return s;
    }
    function resign(c) { c.authorization = f.sign("reactivation-authorization", c.a); c.entitlement = f.sign("entitlement", c.e); }
    async function pair(s) {
      const plan = ok(await s.generator.prepare(s.state, { purpose: "REACTIVATE", issuedAt: f.now, notAfter: f.now + 86400n })).plan;
      ok(await s.generator.export(plan));
      const a = f.payload("pos-reactivation-authorization"), old = s.state.current.entitlement.payload, t = s.state.tombstones.at(-1), label = `pair-${++s.counter}`;
      Object.assign(a, { tokenId: f.bytes(`${label}-auth`), edition, installationId: s.state.device.installationId, deviceKeyId: s.state.device.deviceKeyId,
        requestId: plan.requestId, requestHash: plan.requestHash, revokedLicenseId: old.licenseId, revokedActivationId: old.activationId,
        finalRevokeTokenHash: t.finalRevokeTokenHash, finalControlRevision: t.finalControlRevision,
        incidentId: s.state.incident.id, incidentNonce: s.state.incident.nonce, newLicenseId: f.bytes(`${label}-license`), newActivationId: f.bytes(`${label}-activation`),
        maximumFeatures: [...old.features], issuedAt: f.now, notBefore: f.now, notAfter: f.now + 86400n });
      const e = f.clone(old); delete e.previousTokenId;
      Object.assign(e, { tokenId: f.bytes(`${label}-entitlement`), generation: 1n, licenseId: a.newLicenseId, activationId: a.newActivationId,
        deviceKeyId: s.state.device.deviceKeyId, assurance: s.state.device.assurance,
        requestId: plan.requestId, requestHash: plan.requestHash, reactivationAuthorizationId: a.tokenId, issuedAt: f.now, notBefore: f.now,
        mode: "HYBRID_LEASED", checkCadenceSeconds: 21600n, offlineAllowanceSeconds: 604800n, timeRecoveryRttSeconds: 300n });
      const c = { plan, a, e }; resign(c); return c;
    }
    const targetInput = c => ({ purpose: "CHECK_IN", target: "REACTIVATION", authorization: c.authorization,
      entitlement: c.entitlement, reactivationRequestId: c.plan.requestId, trustedNow: f.now });
    async function candidate(s) {
      const c = await pair(s); c.leasePlan = ok(await s.requester.prepare(s.state, targetInput(c))).plan; ok(await s.requester.release(c.leasePlan));
      c.l = f.payload("pos-lease-initial-control");
      Object.assign(c.l, { edition, tokenId: f.bytes(`lease-${++s.counter}`), licenseId: c.e.licenseId, activationId: c.e.activationId,
        installationId: s.state.device.installationId, deviceKeyId: s.state.device.deviceKeyId, assurance: s.state.device.assurance, features: [...c.e.features],
        entitlementTokenId: c.e.tokenId, entitlementGeneration: 1n, leaseRequestId: c.leasePlan.requestId, leaseRequestHash: c.leasePlan.requestHash,
        leaseRevision: 1n, issuedAt: f.now, notBefore: f.now, serverTime: f.now, notAfter: f.now + c.e.offlineAllowanceSeconds, offlineUntil: f.now + c.e.offlineAllowanceSeconds,
        controlRevision: 0n, controlState: "OPERATIONAL", controlEffectiveAt: 0n, controlReasonCode: 0n });
      return c;
    }
    const response = (c, fields = {}) => encode({ schemaVersion: 1n, carrierType: "lease-response", requestId: c.leasePlan.requestId,
      lease: f.sign("lease", c.l), reactivationAuthorization: c.authorization, ...fields });
    const input = c => ({ encoded: response(c), requestId: c.leasePlan.requestId, entitlement: c.entitlement });
    const prepare = (s, c, extra = {}) => s.workflow.prepare(s.state, { ...input(c), ...extra }, f.now);
    const apply = async (s, c) => { const r = await prepare(s, c); return r.ok ? s.workflow.complete(r.plan) : r; };

    await test(`${edition}/new-target-keeps-terminal-state`, async () => {
      const s = setup(), before = s.state, c = await candidate(s), p = f.requestSnapshot(c.leasePlan.encoded).payload;
      assert.equal(s.state, before); assert.equal(s.machine.project(s.state, f.now).state, "REVOKED_LOCKED");
      assert.equal(hex(p.entitlementTokenId), hex(c.e.tokenId)); assert.equal(hex(p.licenseId), hex(c.a.newLicenseId));
      assert.equal(p.stateGeneration, before.stateGeneration); assert.equal(p.entitlementGeneration, 1n);
      assert.equal(p.lastLeaseRevision, 0n); assert.equal(p.controlRevision, 0n); assert.equal(p.controlState, "OPERATIONAL");
      assert.equal(hex(c.leasePlan.expectedStateHash), hex(before.stateHash)); assert.equal(s.writes, 0);
      const target = s.machine.reactivationTarget(before, { authorization: c.authorization, entitlement: c.entitlement, request: f.requestSnapshot(c.plan.encoded) }, f.now);
      assert.equal(hex(target.tokenId), hex(c.e.tokenId)); assert.throws(() => s.machine.assertOwnsState(target));
      target.tokenId.fill(0); assert.equal(hex(c.leasePlan.parentTokenId), hex(c.e.tokenId));
    });
    await test(`${edition}/atomic-three-artifacts-two-requests`, async () => {
      const s = setup(), before = s.state, c = await candidate(s), plan = ok(await prepare(s, c)).plan;
      assert.equal(s.state, before); assert.equal(s.commits, 0); const r = ok(await s.workflow.complete(plan));
      assert.equal(r.durable, false); assert.equal(r.runtimeAuthority, "NONE"); assert.equal(s.state.stateGeneration, before.stateGeneration + 1n);
      assert.equal(s.writes, 1); assert.equal(s.state.receipts.length, before.receipts.length + 3);
      assert.equal(s.state.consumedRequests.length, before.consumedRequests.length + 2); assert.equal(s.state.consumedReactivations.length, 1);
      assert.equal(hex(s.state.current.entitlement.payload.tokenId), hex(c.e.tokenId)); assert.equal(hex(s.state.current.lease.payload.tokenId), hex(c.l.tokenId));
      assert.equal(s.state.pending, undefined); assert.deepEqual(s.state.tombstones, before.tombstones); assert.equal(s.machine.project(s.state, f.now).state, "ACTIVE");
      assert.equal(s.machine.transition(s.state, s.initial.command, f.now).errorCode, "TERMINAL_REVOCATION");
    });
    await test(`${edition}/optional-control-is-fourth-artifact-in-one-cas`, async () => {
      const s = setup(), before = s.state, c = await candidate(s);
      const control = f.sign("offline-control", { ...f.payload("pos-control-vendor-suspend"), edition,
        tokenId: f.bytes(`reactivation-control-${++s.counter}`), licenseId: c.e.licenseId, activationId: c.e.activationId,
        issuedAt: f.now, notBefore: f.now, notAfter: f.now + 86400n, effectiveAt: f.now,
        controlRevision: 2n, action: "SUSPEND", reasonCode: 1n });
      c.l = { ...c.l, controlRevision: 2n, controlState: "SUSPENDED", controlEffectiveAt: f.now, controlReasonCode: 1n };
      const plan = ok(await prepare(s, c, { encoded: response(c, { offlineControl: control }) })).plan;
      assert.equal(s.commits, 0); ok(await s.workflow.complete(plan));
      assert.equal(s.commits, 1); assert.equal(s.state.stateGeneration, before.stateGeneration + 1n);
      assert.equal(s.state.receipts.length, before.receipts.length + 4);
      assert.equal(s.machine.project(s.state, f.now).state, "SUSPENDED_LOCKED");
    });
    await test(`${edition}/trust-lease-control-reactivation-one-cas`, async () => {
      const s = setup(), before = s.state, c = await candidate(s), workflow = s.makeTrusted();
      const control = f.sign("offline-control", { ...f.payload("pos-control-vendor-suspend"), edition,
        tokenId: f.bytes(`trusted-reactivation-control-${++s.counter}`), licenseId: c.e.licenseId, activationId: c.e.activationId,
        issuedAt: f.now, notBefore: f.now, notAfter: f.now + 86400n, effectiveAt: f.now,
        controlRevision: 2n, action: "SUSPEND", reasonCode: 1n });
      c.l = { ...c.l, controlRevision: 2n, controlState: "SUSPENDED", controlEffectiveAt: f.now, controlReasonCode: 1n };
      const encoded = response(c, { offlineControl: control, trustBundle: s.trustBundle() });
      const prepared = await workflow.prepare(s.state, { encoded, entitlement: c.entitlement, requestId: c.leasePlan.requestId }, f.now);
      const plan = ok(prepared).plan; assert.equal(s.commits, 0);
      const result = ok(await workflow.complete(plan));
      assert.equal(s.commits, 1); assert.equal(result.state.stateGeneration, before.stateGeneration + 1n);
      assert.equal(result.state.receipts.length, before.receipts.length + 4);
      assert.equal(result.machine.project(result.state, f.now).state, "SUSPENDED_LOCKED");
    });
    await test(`${edition}/target-invalid-pair-no-challenge-or-sign`, async () => {
      const s = setup(), c = await pair(s), signs = s.signs;
      for (const change of [{ incidentNonce: f.bytes("bad", 32) }, { finalRevokeTokenHash: f.bytes("bad", 32) },
        { finalControlRevision: 2n }, { newLicenseId: s.state.current.entitlement.payload.licenseId }, { notBefore: f.now + 60n }]) {
        const d = f.clone(c); Object.assign(d.a, change); resign(d); no(await s.requester.prepare(s.state, targetInput(d)));
      }
      assert.equal(s.signs, signs); assert.equal(s.challenges, 0); assert.equal(s.commits, 0);
    });
    await test(`${edition}/target-feature-ceiling-generation-and-mode`, async () => {
      const s = setup(), c = await pair(s);
      for (const change of [{ generation: 2n }, { reactivationAuthorizationId: f.bytes("bad") }, { tokenId: c.a.tokenId }]) {
        const d = f.clone(c); Object.assign(d.e, change); resign(d); no(await s.requester.prepare(s.state, targetInput(d)));
      }
      c.a.maximumFeatures = []; resign(c); no(await s.requester.prepare(s.state, targetInput(c)));
      const d = await pair(s); d.e.mode = "OFFLINE_BOUND"; for (const k of ["checkCadenceSeconds", "offlineAllowanceSeconds", "timeRecoveryRttSeconds"]) delete d.e[k];
      resign(d); no(await s.requester.prepare(s.state, targetInput(d)), "HYBRID_MODE_REQUIRED"); assert.equal(s.challenges, 0);
    });
    await test(`${edition}/target-request-ledger-and-pop-required`, async () => {
      const s = setup(), c = await pair(s), id = hex(c.plan.requestId);
      for (const record of [undefined, { encoded: new Uint8Array(131073) }, { encoded: f.sign("activation-request", { ...f.requestSnapshot(c.plan.encoded).payload, requestId: f.bytes("bad") }) }]) {
        s.records.set(id, record); no(await s.requester.prepare(s.state, targetInput(c)));
      }
      const bad = new Uint8Array(c.plan.encoded); bad[bad.length - 1] ^= 1; s.records.set(id, { encoded: bad }); no(await s.requester.prepare(s.state, targetInput(c)));
      s.reader.read = async () => { throw Error("SECRET_PATH"); }; const r = await s.requester.prepare(s.state, targetInput(c)); no(r, "REQUEST_STORE_UNAVAILABLE");
      assert(!JSON.stringify(r).includes("SECRET_PATH")); assert.equal(s.challenges, 0);
    });
    await test(`${edition}/target-bounds-and-closed-input`, async () => {
      const s = setup(), c = await pair(s);
      for (const patch of [{ authorization: undefined }, { entitlement: new Uint8Array(16385) }, { reactivationRequestId: new Uint8Array(15) },
        { trustedNow: -1n }, { stateGeneration: 0n }, { purpose: "TIME_RECOVERY" }]) no(await s.requester.prepare(s.state, { ...targetInput(c), ...patch }));
      assert.equal(s.challenges, 0);
    });
    await test(`${edition}/registration-before-release-and-exact-retry`, async () => {
      const s = setup(), c = await pair(s), p = ok(await s.requester.prepare(s.state, targetInput(c))).plan;
      assert(!s.records.has(hex(p.requestId))); const register = s.registration.register;
      s.registration.register = async () => undefined; no(await s.requester.release(p), "REQUEST_REGISTRATION_CONFLICT");
      s.registration.register = register; assert.equal(ok(await s.requester.release(p)).decision, "REGISTERED");
      assert.equal(ok(await s.requester.release(p)).decision, "EXACT_RETRY"); assert.equal(s.writes, 0);
    });
    await test(`${edition}/three-artifact-missing-and-mixed-variants`, async () => {
      const s = setup(), c = await candidate(s), before = s.state;
      no(await prepare(s, c, { entitlement: undefined }));
      for (const fields of [{ lease: undefined }, { reactivationAuthorization: undefined }, { offlineControl: c.authorization }, { trustBundle: c.authorization }]) {
        const fieldsWithUndefinedRemoved = { schemaVersion: 1n, carrierType: "lease-response", requestId: c.leasePlan.requestId,
          lease: f.sign("lease", c.l), reactivationAuthorization: c.authorization, ...fields };
        for (const k of Object.keys(fieldsWithUndefinedRemoved)) if (fieldsWithUndefinedRemoved[k] === undefined) delete fieldsWithUndefinedRemoved[k];
        no(await prepare(s, c, { encoded: encode(fieldsWithUndefinedRemoved) }));
      }
      assert.equal(s.state, before); assert.equal(s.commits, 0);
    });
    await test(`${edition}/response-bounds-schema-and-id`, async () => {
      const s = setup(), c = await candidate(s), reads = s.reads;
      for (const patch of [{ encoded: new Uint8Array(524289) }, { encoded: new Uint8Array([0xff]) }, { requestId: f.bytes("bad") },
        { entitlement: new Uint8Array(16385) }, { requestId: new Uint8Array(15) }, { observation: {} }]) no(await prepare(s, c, patch));
      assert.equal(s.reads, reads); assert.equal(s.commits, 0);
    });
    await test(`${edition}/authorization-entitlement-and-lease-signatures`, async () => {
      const s = setup(), c = await candidate(s);
      for (const name of ["authorization", "entitlement", "lease"]) {
        const d = { ...c }, bad = new Uint8Array(name === "lease" ? f.sign("lease", c.l) : c[name]); bad[bad.length - 1] ^= 1;
        if (name === "lease") no(await prepare(s, d, { encoded: response(c, { lease: bad }) }));
        else { d[name] = bad; no(await prepare(s, d)); }
      }
      const a = { ...c.a, keyId: TEST_ONLY_KEYS.TEST_ONLY_RECOVERY_PRIMARY.kid };
      no(await prepare(s, { ...c, authorization: f.sign("reactivation-authorization", a, "TEST_ONLY_RECOVERY_PRIMARY") })); assert.equal(s.commits, 0);
    });
    await test(`${edition}/response-rechecks-pair-after-targeting`, async () => {
      const s = setup(), c = await candidate(s);
      for (const [which, change] of [["a", { incidentNonce: f.bytes("bad", 32) }], ["a", { maximumFeatures: [] }],
        ["e", { generation: 2n }], ["e", { reactivationAuthorizationId: f.bytes("bad") }], ["e", { tokenId: c.a.tokenId }],
        ["e", { installationId: f.bytes("bad") }]]) {
        const d = f.clone(c); Object.assign(d[which], change); resign(d); no(await prepare(s, d));
      } assert.equal(s.commits, 0);
    });
    await test(`${edition}/new-lease-exact-parent-and-request`, async () => {
      const s = setup(), c = await candidate(s);
      for (const change of [{ entitlementTokenId: s.state.current.entitlement.payload.tokenId }, { entitlementGeneration: 2n },
        { leaseRequestHash: f.bytes("bad", 32) }, { leaseRequestId: f.bytes("bad") }, { licenseId: f.bytes("bad") },
        { leaseRevision: 0n }, { tokenId: c.e.tokenId }, { controlRevision: 1n, controlState: "REVOKED", controlEffectiveAt: f.now, controlReasonCode: 1n }])
        no(await prepare(s, { ...c, l: { ...c.l, ...change } }));
      assert.equal(s.commits, 0);
    });
    await test(`${edition}/both-archived-requests-required`, async () => {
      const s = setup(), c = await candidate(s);
      for (const p of [c.plan, c.leasePlan]) {
        const id = hex(p.requestId); s.records.delete(id); no(await prepare(s, c), "OUTSTANDING_REQUEST_NOT_FOUND");
        s.records.set(id, { encoded: new Uint8Array(200000) }); no(await prepare(s, c));
        const bad = new Uint8Array(p.encoded); bad[bad.length - 1] ^= 1; s.records.set(id, { encoded: bad }); no(await prepare(s, c));
        s.records.set(id, p);
      } assert.equal(s.commits, 0);
    });
    await test(`${edition}/request-id-hash-purpose-and-tombstone`, async () => {
      const s = setup(), c = await candidate(s);
      for (const [plan, type, patch] of [[c.plan, "activation-request", { revokedLineageTombstoneHash: f.bytes("bad", 32) }],
        [c.leasePlan, "lease-request", { entitlementTokenId: f.bytes("bad") }], [c.leasePlan, "lease-request", { requestId: f.bytes("bad") }]]) {
        const p = f.requestSnapshot(plan.encoded).payload; Object.assign(p, patch);
        s.records.set(hex(plan.requestId), { encoded: f.sign(type, p) }); no(await prepare(s, c)); s.records.set(hex(plan.requestId), plan);
      }
      const p = f.requestSnapshot(c.leasePlan.encoded).payload;
      Object.assign(p, { requestPurpose: "TIME_RECOVERY", incidentId: f.bytes("time"), incidentNonce: f.bytes("time-nonce", 32), preIncidentClockHighWater: f.now });
      s.records.set(hex(c.leasePlan.requestId), { encoded: f.sign("lease-request", p) }); no(await prepare(s, c), "REACTIVATION_REQUEST_MISMATCH"); assert.equal(s.commits, 0);
    });
    await test(`${edition}/strict-single-use-and-old-plan-cas`, async () => {
      const s = setup(), c = await candidate(s), p = ok(await prepare(s, c)).plan; ok(await s.workflow.complete(p)); const state = s.state;
      no(await prepare(s, c), "REACTIVATION_AUTHORIZATION_REPLAYED"); no(await s.workflow.complete(p), "COMMIT_STATE_CONFLICT");
      no(await s.requester.prepare(s.state, targetInput(c))); assert.equal(s.state, state); assert.equal(s.writes, 1);
    });
    await test(`${edition}/one-winner-for-concurrent-pairs`, async () => {
      const s = setup(), c = await candidate(s), d = await candidate(s), plans = await Promise.all([prepare(s, c), prepare(s, d)]);
      const results = await Promise.all(plans.map(p => s.workflow.complete(ok(p).plan)));
      assert.equal(results.filter(r => r.ok).length, 1); assert.equal(results.filter(r => r.errorCode === "COMMIT_STATE_CONFLICT").length, 1); assert.equal(s.writes, 1);
    });
    await test(`${edition}/pending-bad-and-lost-acknowledgement`, async () => {
      const s = setup(), c = await candidate(s), p = ok(await prepare(s, c)).plan, state = s.state, commit = s.store.commit;
      for (const receipt of [{ decision: "PENDING" }, { decision: "ACKNOWLEDGED", stateGeneration: state.stateGeneration, stateHash: state.stateHash },
        { decision: "ACKNOWLEDGED", stateGeneration: p.proposal.state.stateGeneration, stateHash: f.bytes("wrong", 32) }]) {
        s.store.commit = async () => receipt; no(await s.workflow.complete(p)); assert.equal(s.state, state);
      }
      s.store.commit = async proposal => { await commit(proposal); throw Error("SECRET_LOST_ACK"); };
      const r = await s.workflow.complete(p); no(r, "COMMIT_OUTCOME_UNKNOWN"); assert.equal(r.commitAttempted, true); assert(!JSON.stringify(r).includes("SECRET_LOST_ACK"));
      no(await prepare(s, c), "REACTIVATION_AUTHORIZATION_REPLAYED"); assert.equal(s.writes, 1);
    });
    await test(`${edition}/state-and-plan-factory-provenance`, async () => {
      const s = setup(), c = await candidate(s), p = ok(await prepare(s, c)).plan, commits = s.commits;
      no(await s.workflow.complete({ ...p }), "UNTRUSTED_REACTIVATION_PLAN"); no(await s.make().complete(p), "UNTRUSTED_REACTIVATION_PLAN");
      no(await s.workflow.prepare({ ...s.state }, input(c), f.now), "UNTRUSTED_MODEL_STATE");
      no(await s.requester.prepare({ ...s.state }, targetInput(c)), "UNTRUSTED_MODEL_STATE"); assert.equal(s.commits, commits);
    });
    await test(`${edition}/caller-mutation-during-request-read`, async () => {
      const s = setup(), c = await pair(s), source = targetInput(c), read = s.reader.read;
      s.reader.read = async id => { source.authorization.fill(0); source.entitlement.fill(0); source.trustedNow = 0n; return read(id); };
      const plan = ok(await s.requester.prepare(s.state, source)).plan; assert.equal(hex(plan.parentTokenId), hex(c.e.tokenId));
      s.reader.read = read; const d = await candidate(s), incoming = input(d);
      s.reader.read = async id => { incoming.encoded.fill(0); incoming.entitlement.fill(0); incoming.requestId.fill(0); return read(id); };
      ok(await s.workflow.prepare(s.state, incoming, f.now)); assert.equal(s.commits, 0);
    });
    await test(`${edition}/independent-recovery-and-tamper-locks`, async () => {
      for (const tamper of [false, true]) {
        const s = setup(); s.advance({ kind: "INTEGRITY_INCIDENT", incident: s.state.incident, ...(tamper ? { evidence:
          ["SEALED_PROGRAMDATA", "SEALED_REGISTRY"].map(protectionDomain => ({ protectionDomain, observedGeneration: 1n, protectedHighWater: 2n })) } : {}) });
        const before = s.state; ok(await apply(s, await candidate(s)));
        assert.equal(s.state.recoveryRequired, before.recoveryRequired); assert.equal(s.state.tamperLatched, before.tamperLatched);
        assert.equal(s.machine.project(s.state, f.now).state, tamper ? "TAMPER_LOCKED" : "RECOVERY_REQUIRED"); assert.deepEqual(s.state.incident, before.incident);
      }
    });
    await test(`${edition}/time-incident-closed-with-no-partial-change`, async () => {
      const s = setup(), c = await candidate(s);
      s.advance({ kind: "BEGIN_TIME_RECOVERY", observation: { wallUtc: f.now, bootId: f.bytes("boot"), monotonicMs: 1000n },
        incident: { id: f.bytes("time"), nonce: f.bytes("time-nonce", 32), reason: "CLOCK_FORWARD_JUMP" } });
      const before = s.state, challenges = s.challenges;
      no(await s.requester.prepare(s.state, targetInput(c)), "TIME_RECOVERY_REACTIVATION_TARGET_FORBIDDEN");
      no(await prepare(s, c), "TIME_RECOVERY_REACTIVATION_TARGET_FORBIDDEN"); assert.equal(s.state, before); assert.equal(s.challenges, challenges); assert.equal(s.commits, 0);
    });
    await test(`${edition}/future-expired-and-restricted-lease`, async () => {
      const s = setup(), c = await candidate(s);
      for (const change of [{ notBefore: f.now + 60n }, { offlineUntil: f.now }]) no(await prepare(s, { ...c, l: { ...c.l, ...change } }));
      no(await s.workflow.prepare(s.state, input(c), f.now + 86400n)); assert.equal(s.commits, 0);
      c.l.features = c.e.features.slice(0, -1); ok(await apply(s, c));
      assert.deepEqual([...s.state.current.lease.payload.features], c.l.features);
      assert(s.machine.project(s.state, f.now).features.every(feature => c.l.features.includes(feature)));
    });
    await test(`${edition}/hybrid-lineage-second-reactivation-keeps-all-tombstones`, async () => {
      const s = setup(), first = await candidate(s); ok(await apply(s, first)); s.revoke();
      const before = s.state, second = await candidate(s); assert.equal(before.current.entitlement.payload.mode, "HYBRID_LEASED");
      ok(await apply(s, second)); assert.equal(s.state.tombstones.length, 2); assert.deepEqual(s.state.tombstones, before.tombstones);
      assert.equal(s.state.stateGeneration, before.stateGeneration + 1n); assert.equal(s.state.consumedReactivations.length, 2);
      no(await prepare(s, first), "REACTIVATION_AUTHORIZATION_REPLAYED"); assert.equal(s.writes, 2);
    });
    await test(`${edition}/new-parent-retires-rebind-override`, async () => {
      const s = setup(); s.state = ok(s.machine.transition(s.machine.initial(), s.initial.command, f.now)).state;
      const staged = f.deviceForKey("TEST_ONLY_INSTALLATION_DEVICE_REBIND");
      s.advance({ kind: "INTEGRITY_INCIDENT", incident: { id: f.bytes("key-loss"), nonce: f.bytes("key-loss-nonce", 32), reason: "KEY_LOSS" } });
      const generator = production.createOfflineRequestWorkflowV1({ machine: s.machine, verification: f.verification,
        installation: s.installation, registration: s.registration, rebind: { readStagedDevice: () => staged } });
      const plan = ok(await generator.prepare(s.state, { purpose: "REBIND", issuedAt: f.now, notAfter: f.now + 86400n })).plan; ok(await generator.export(plan));
      const r = f.payload("pos-recovery-rebind-device"), parent = s.state.current.entitlement;
      Object.assign(r, { tokenId: f.bytes("rebind-token"), edition, installationId: s.state.device.installationId,
        licenseId: parent.payload.licenseId, activationId: parent.payload.activationId, entitlementTokenId: parent.payload.tokenId,
        entitlementTokenHash: parent.hash, entitlementGeneration: parent.payload.generation, requestId: plan.requestId, requestHash: plan.requestHash,
        incidentId: s.state.incident.id, incidentNonce: s.state.incident.nonce, expectedStateGeneration: s.state.stateGeneration,
        newStateGeneration: s.state.stateGeneration + 1n, controlRevision: s.state.control.revision, maximumFeatures: [...parent.payload.features],
        oldDeviceKeyId: s.state.device.deviceKeyId, newDeviceKeyId: staged.deviceKeyId, newAssurance: staged.assurance,
        issuedAt: f.now, notBefore: f.now, notAfter: f.now + 3600n });
      s.advance({ kind: "RECOVER", encoded: f.sign("recovery", r), request: f.requestSnapshot(plan.encoded), newDevice: staged });
      assert(s.state.device.bindingRecoveryTokenId); s.revoke(); const c = await candidate(s);
      assert.equal(f.requestSnapshot(c.leasePlan.encoded).payload.bindingRecoveryTokenId, undefined); ok(await apply(s, c));
      assert.equal(s.state.device.bindingRecoveryTokenId, undefined); assert.equal(hex(s.state.device.deviceKeyId), hex(staged.deviceKeyId));
      assert.equal(s.state.consumedRecoveries.length, 1); assert.equal(s.machine.project(s.state, f.now).state, "ACTIVE");
    });
  }
  assert.equal(new Set(ids).size, ids.length);
  return { attempted: ids.length, passed: ids.length - failures.length, failures };
}
