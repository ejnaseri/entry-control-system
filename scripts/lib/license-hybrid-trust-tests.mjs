// TEST_ONLY_DO_NOT_TRUST. Real signatures; in-memory storage only.
import assert from "node:assert/strict";
import { createLicenseStateFixtures } from "./license-state-fixtures.mjs";
import { TEST_ONLY_KEYS } from "../../licensing/vectors/v1/test-only/keys.mjs";
import { signEs256Rfc6979LowS } from "../../licensing/vectors/v1/lib/ecdsa-rfc6979.mjs";
export async function runLicenseHybridTrustTests(production) {
  const ids = [], failures = [], hex = b => Buffer.from(b).toString("hex");
  const ok = r => { assert(r.ok, `${r.stage}/${r.errorCode}`); return r; };
  const no = (r, code) => { assert.equal(r.ok, false); if (code) assert.equal(r.errorCode, code);
    assert.equal(r.durable, false); assert.equal(r.runtimeAuthority, "NONE"); };
  const test = async (id, fn) => { ids.push(id); try { await fn(); } catch(e) { failures.push({ id, message: e.stack }); } };
  const encode = obj => production.core.encodeDeterministicCborV1(new Map(Object.entries(obj)));
  for (const edition of ["FULL", "ATTENDANCE"]) {
    const f = createLicenseStateFixtures(production, { edition });
    async function setup() {
      const machine = production.core.createLicenseStateMachineV1(f.configuration);
      const state = ok(machine.transition(machine.initial(), f.initialActivation({ mode: "HYBRID_LEASED" }).command, f.now)).state;
      const s = { machine, state, records: new Map(), writes: 0, calls: 0, counter: 0 };
      s.reader = { read: async id => s.records.get(hex(id)) };
      s.store = { commit: async p => { s.calls++;
        if (p.expectedStateGeneration !== s.state.stateGeneration || hex(p.expectedStateHash) !== hex(s.state.stateHash) ||
          (s.hash && hex(p.expectedTrustHash) !== hex(s.hash))) return { decision: "CONFLICT" };
        if (p.decision === "UPDATE") { s.hash = p.proposedTrustHash; s.trust = p.trust; s.writes++; }
        return { decision: "ACKNOWLEDGED", trustHash: p.proposedTrustHash };
      } };
      s.make = (verification = f.verification) => production.createHybridTrustResponseWorkflowV1({ machine, verification, requests: s.reader, store: s.store });
      s.workflow = s.make();
      const transport = production.createHybridRequestWorkflowV1({ machine, verification: f.verification,
        installation: { randomBytes: n => f.bytes(`trust-${++s.counter}`, n), signInstallation: async ({ sigStructure }) =>
          new Uint8Array(signEs256Rfc6979LowS(sigStructure, TEST_ONLY_KEYS.TEST_ONLY_INSTALLATION_DEVICE_PRIMARY.privateScalar)) },
        registration: { register: async p => { s.records.set(hex(p.requestId), p); return { decision: "REGISTERED", requestId: p.requestId, requestHash: p.requestHash }; } },
        challenge: { acquire: async () => encode({ schemaVersion: 1n, carrierType: "lease-challenge", requestNonce: f.bytes("trust-nonce", 32), expiresInSeconds: 300n }) } });
      s.request = ok(await transport.prepare(state, { purpose: "CHECK_IN", target: "PENDING" })).plan;
      ok(await transport.release(s.request));
      s.delegation = changes => ({ ...f.payload("pos-delegation-online-lease"), tokenId: f.bytes("delegation-five"), delegationSerial: 5n, ...changes });
      s.denial = changes => ({ ...f.payload("pos-denylist-revision-1"), ...changes });
      s.bundle = (delegations = [s.delegation()], denial = s.denial()) => encode({ schemaVersion: 1n, carrierType: "trust-bundle",
        delegations: delegations.map(p => p instanceof Uint8Array ? p : f.sign("key-delegation", p)),
        denylist: denial instanceof Uint8Array ? denial : f.sign("key-denylist", denial) });
      // Invalid companion proves trust acknowledgement does not grant License authority.
      s.input = (bundle = s.bundle()) => ({ requestId: s.request.requestId, encoded: encode({ schemaVersion: 1n, carrierType: "lease-response",
        requestId: s.request.requestId, lease: new Uint8Array([1]), trustBundle: bundle }) });
      s.prepare = (input = s.input(), at = f.now) => s.workflow.prepare(s.state, input, at);
      s.reload = () => { s.workflow = s.make({ ...s.trust, crypto: production.nodeCryptoV1 }); };
      s.rewrite = changes => { const payload = ok(f.verifier.verifySignedObject({ expectedType: "lease-request", encoded: s.request.encoded,
        context: { workflow: "VENDOR_HTTPS_REQUEST", build: state.build, device: state.device } })).value.payload;
        s.records.set(hex(s.request.requestId), { encoded: f.sign("lease-request", { ...f.clone(payload), ...changes }) }); };
      return s;
    }
    const run = (name, fn) => test(`${edition}/${name}`, async () => fn(await setup()));
    await run("root-update-preserves-facts-without-license-authority", async s => {
      const before = s.state, p = ok(await s.prepare()).plan;
      assert.equal(p.trust.delegations.length,5); assert.deepEqual(p.trust.delegations.slice(0,4),f.verification.delegations);
      assert.equal(JSON.stringify(p.trust.roots),JSON.stringify(f.verification.roots)); assert.equal(JSON.stringify(p.trust.trustedKeys),JSON.stringify(f.verification.trustedKeys));
      assert.equal(s.writes,0); const r = ok(await s.workflow.complete(p)); assert.equal(r.requestConsumed,false);
      assert.equal(r.runtimeAuthority,"NONE"); assert.equal(r.durable,false); assert.equal(s.state,before); assert.equal(s.writes,1);
      assert.equal(f.verification.delegations.length,4); assert.equal(s.machine.project(s.state,f.now).operational,false);
    });
    await run("exact-retry-reload-read-only", async s => {
      ok(await s.workflow.complete(ok(await s.prepare()).plan)); s.reload(); const p = ok(await s.prepare()).plan;
      assert.equal(p.decision,"EXACT_RETRY"); assert.equal(hex(p.expectedTrustHash),hex(p.proposedTrustHash));
      ok(await s.workflow.complete(p)); assert.equal(s.writes,1);
    });
    await run("trust-cas-conflict", async s => { const p = ok(await s.prepare()).plan; ok(await s.workflow.complete(p));
      no(await s.workflow.complete(p),"TRUST_COMMIT_CONFLICT"); assert.equal(s.writes,1); });
    await run("state-cas-conflict", async s => { const p = ok(await s.prepare()).plan; s.state = s.machine.initial();
      no(await s.workflow.complete(p),"TRUST_COMMIT_CONFLICT"); assert.equal(s.writes,0); });
    await run("bad-root-signature-whole-bundle-neutral", async s => {
      const bad = f.sign("key-denylist",s.denial()); bad[bad.length-1] ^= 1;
      no(await s.prepare(s.input(s.bundle(undefined,bad)))); assert.equal(s.calls,0); assert.equal(f.verification.delegations.length,4);
    });
    await run("wrong-signer-and-environment", async s => {
      no(await s.prepare(s.input(s.bundle([f.sign("key-delegation",s.delegation(),"TEST_ONLY_ONLINE_LEASE_PRIMARY")]))));
      no(await s.prepare(s.input(s.bundle([s.delegation({ environment:"PROD" })])))); assert.equal(s.calls,0);
    });
    await run("global-serial-rollback-collision", async s => {
      for (const serial of [2n,4n]) no(await s.prepare(s.input(s.bundle([s.delegation({ delegationSerial:serial })])))); assert.equal(s.calls,0);
    });
    await run("wire-kid-order-separate-from-serial-order", async s => {
      const list = [s.delegation(),{ ...f.payload("pos-delegation-offline-control"),delegationSerial:6n,tokenId:f.bytes("six") }];
      list.sort((a,b) => Buffer.compare(a.delegatedKeyId,b.delegatedKeyId));
      const p = ok(await s.prepare(s.input(s.bundle(list)))).plan; assert.equal(p.trust.delegations.length,6);
      assert.deepEqual(p.trust.delegations.slice(-2).map(d => d.delegationSerial),[5n,6n]);
      no(await s.prepare(s.input(s.bundle([...list].reverse())))); no(await s.prepare(s.input(s.bundle([list[0],list[0]]))));
    });
    await run("denylist-first-revision-expiry", async s => {
      no(await s.prepare(s.input(s.bundle([s.delegation()],f.payload("pos-denylist-revision-2"))))); no(await s.prepare(s.input(),s.denial().notAfter));
    });
    await run("denylist-cumulative-chain-rollback", async s => {
      ok(await s.workflow.complete(ok(await s.prepare()).plan)); s.reload();
      ok(await s.workflow.complete(ok(await s.prepare(s.input(s.bundle([s.delegation()],f.payload("pos-denylist-revision-2"))))).plan)); s.reload();
      assert.equal(s.trust.denylist.revision,2n); no(await s.prepare(s.input(s.bundle([s.delegation()],s.denial()))),"DENYLIST_REVISION_ROLLBACK");
    });
    await run("denylist-predecessor-collision", async s => {
      ok(await s.workflow.complete(ok(await s.prepare()).plan)); s.reload();
      no(await s.prepare(s.input(s.bundle([s.delegation()],s.denial({ tokenId:f.bytes("collision") })))),"DENYLIST_REVISION_COLLISION");
      no(await s.prepare(s.input(s.bundle([s.delegation()],{ ...f.payload("pos-denylist-revision-2"),previousDenylistHash:f.bytes("bad",32) }))),"DENYLIST_PREDECESSOR_MISMATCH");
    });
    await run("permanent-denial-no-removal-or-changing-facts", async s => {
      const dl = s.denial({ deniedKeys:[{ delegatedKeyId:s.delegation().delegatedKeyId,effectiveAt:f.now,reasonCode:1n }] });
      ok(await s.workflow.complete(ok(await s.prepare(s.input(s.bundle([s.delegation()],dl)))).plan)); s.reload();
      const next = { ...dl,tokenId:f.bytes("next"),denylistRevision:2n,previousDenylistHash:s.trust.denylist.tokenHash,previousDenylistTokenId:dl.tokenId };
      for (const deniedKeys of [[],dl.deniedKeys,[{ ...dl.deniedKeys[0],reasonCode:2n }]]) no(await s.prepare(s.input(s.bundle([s.delegation()],{ ...next,deniedKeys }))));
      const verifier = production.core.createLicenseVerifierV1({ ...s.trust,crypto:production.nodeCryptoV1 });
      const result = verifier.verifySignedObject({ expectedType:"lease",encoded:f.sign("lease",f.payload("pos-lease-full")),
        context:{ workflow:"VENDOR_HTTPS_RESPONSE",trustedNow:dl.notAfter+1n } });
      assert.equal(result.ok,false); assert.equal(result.errorCode,"SIGNING_KEY_DENIED");
    });
    await run("time-recovery-purpose-forbidden", async s => {
      s.rewrite({ requestPurpose:"TIME_RECOVERY",incidentId:f.bytes("incident"),incidentNonce:f.bytes("incident-nonce",32),preIncidentClockHighWater:s.state.clockHighWater });
      no(await s.prepare(),"TIME_RECOVERY_TRUST_UPDATE_FORBIDDEN"); assert.equal(s.calls,0);
    });
    await run("same-batch-serial-collision", async s => {
      const list = [s.delegation(),{ ...f.payload("pos-delegation-offline-control"),delegationSerial:5n,tokenId:f.bytes("collision-five") }];
      list.sort((a,b) => Buffer.compare(a.delegatedKeyId,b.delegatedKeyId));
      no(await s.prepare(s.input(s.bundle(list))),"DELEGATION_SERIAL_COLLISION"); assert.equal(s.calls,0);
    });
    await run("denial-requires-explicit-verifier-replacement", async s => {
      const original = production.core.createLicenseVerifierV1(f.verification);
      const encoded = f.sign("lease",f.payload("pos-lease-full"));
      const input = { expectedType:"lease",encoded,context:{ workflow:"VENDOR_HTTPS_RESPONSE",trustedNow:f.now } };
      ok(original.verifySignedObject(input));
      const dl = s.denial({ deniedKeys:[{ delegatedKeyId:s.delegation().delegatedKeyId,effectiveAt:f.now,reasonCode:1n }] });
      const p = ok(await s.prepare(s.input(s.bundle(undefined,dl)))).plan; ok(await s.workflow.complete(p));
      ok(original.verifySignedObject(input));
      const replacement = production.core.createLicenseVerifierV1({ ...p.trust,crypto:production.nodeCryptoV1 });
      const denied = replacement.verifySignedObject(input); assert.equal(denied.ok,false); assert.equal(denied.errorCode,"SIGNING_KEY_DENIED");
    });
    await run("request-state-parent-bindings", async s => {
      for (const changes of [{ stateGeneration:s.state.stateGeneration+1n },{ entitlementTokenId:f.bytes("wrong") },
        { entitlementGeneration:999n },{ activationId:f.bytes("wrong") },{ licenseId:f.bytes("wrong") }]) { s.rewrite(changes); no(await s.prepare()); }
      assert.equal(s.calls,0);
    });
    await run("missing-unavailable-invalid-request", async s => {
      s.records.clear(); no(await s.prepare(),"OUTSTANDING_REQUEST_NOT_FOUND");
      s.records.set(hex(s.request.requestId),{ encoded:new Uint8Array([1]) }); no(await s.prepare());
      s.reader.read = async () => { throw Error("PRIVATE_PATH"); }; const r = await s.prepare(); no(r,"REQUEST_STORE_UNAVAILABLE"); assert(!JSON.stringify(r).includes("PRIVATE_PATH"));
    });
    await run("closed-bounded-carrier-id", async s => {
      const input = s.input(); for (const encoded of [new Uint8Array(),new Uint8Array(524289),new Uint8Array([255])]) no(await s.prepare({ ...input,encoded }));
      no(await s.prepare({ ...input,requestId:f.bytes("wrong") })); no(await s.prepare({ ...input,root:"injected" }));
      no(await s.prepare({ ...input,encoded:encode({ schemaVersion:1n,carrierType:"lease-response",requestId:input.requestId,lease:new Uint8Array([1]) }) }),"TRUST_BUNDLE_REQUIRED");
      assert.equal(s.calls,0);
    });
    await run("snapshot-before-async-read", async s => { const input = s.input(), promise = s.prepare(input); input.encoded.fill(0); ok(await promise); });
    await run("model-plan-provenance", async s => {
      no(await s.workflow.prepare({ ...s.state },s.input(),f.now)); const p = ok(await s.prepare()).plan;
      no(await s.workflow.complete({ ...p }),"UNTRUSTED_TRUST_PLAN"); no(await s.make().complete(p),"UNTRUSTED_TRUST_PLAN"); assert.equal(s.calls,0);
    });
    await run("immutable-plan", async s => {
      const p = ok(await s.prepare()).plan, hash = hex(p.proposedTrustHash), kid = hex(p.trust.roots[0].kid);
      try { p.proposedTrustHash.fill(0); } catch {} try { p.trust.roots[0].kid.fill(0); } catch {}
      assert.equal(hex(p.proposedTrustHash),hash); assert.equal(hex(p.trust.roots[0].kid),kid); ok(await s.workflow.complete(p));
    });
    await run("pending-invalid-lost-ack", async s => {
      const p = ok(await s.prepare()).plan; s.store.commit = async () => ({ decision:"PENDING" }); no(await s.workflow.complete(p),"TRUST_COMMIT_PENDING");
      s.store.commit = async () => ({ decision:"ACKNOWLEDGED",trustHash:f.bytes("bad",32) }); no(await s.workflow.complete(p),"TRUST_ACKNOWLEDGEMENT_INVALID");
      s.store.commit = async () => { throw Error("PRIVATE_PATH"); }; const r = await s.workflow.complete(p); no(r,"TRUST_COMMIT_OUTCOME_UNKNOWN"); assert(!JSON.stringify(r).includes("PRIVATE_PATH"));
    });
  }
  return { attempted:ids.length,passed:ids.length-failures.length,failures };
}
