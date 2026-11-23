// TEST_ONLY_DO_NOT_TRUST. Independent trust-coordination probes; no build/native I/O.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
assert.equal(process.versions.node, "24.19.0");
const require = createRequire(import.meta.url), before = new Set(Object.keys(require.cache));
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../server/dist/licensing");
const core = require(path.join(root, "core/v1/index.js"));
const { nodeCryptoV1 } = require(path.join(root, "adapters/node-crypto.js"));
const { createHybridRequestWorkflowV1 } = require(path.join(root, "hybrid/request.js"));
const { createHybridLeaseResponseWorkflowV1 } = require(path.join(root, "hybrid/lease-response.js"));
const { createHybridTrustedResponseWorkflowV1 } = require(path.join(root, "hybrid/trusted-response.js"));
for (const file of Object.keys(require.cache).filter(f => !before.has(f))) {
  const relative = path.relative(root, file); assert(!relative.startsWith("..") && !path.isAbsolute(relative));
}
const { createLicenseStateFixtures } = await import("./lib/license-state-fixtures.mjs");
const { TEST_ONLY_KEYS: keys } = await import("../licensing/vectors/v1/test-only/keys.mjs");
const { signEs256Rfc6979LowS } = await import("../licensing/vectors/v1/lib/ecdsa-rfc6979.mjs");
const ok = r => { assert(r.ok, `${r.stage}/${r.errorCode}`); return r; };
const hex = b => Buffer.from(b).toString("hex");
const encode = fields => core.encodeDeterministicCborV1(new Map(Object.entries(fields)));
const results = [], failures = [];
for (const edition of ["FULL", "ATTENDANCE"]) {
  const f = createLicenseStateFixtures({ core, nodeCryptoV1 }, { edition });
  const rotated = keys.TEST_ONLY_ONLINE_LEASE_DENIED, old = keys.TEST_ONLY_ONLINE_LEASE_PRIMARY;
  async function setup(active = false) {
    let machine = core.createLicenseStateMachineV1(f.configuration), verification = f.verification;
    let state = ok(machine.transition(machine.initial(), f.initialActivation({ mode: "HYBRID_LEASED" }).command, f.now)).state;
    let request, count = 0, commits = 0, trustHash;
    const records = new Map(), reader = { read: async id => records.get(hex(id)) };
    const store = { commit: async plan => {
      commits++; const p = plan.license.proposal;
      if (p.expectedPreviousGeneration !== state.stateGeneration || hex(p.expectedPreviousHash) !== hex(state.stateHash) ||
        (trustHash && hex(trustHash) !== hex(plan.trust.expectedTrustHash))) return { decision: "CONFLICT" };
      state = p.state; trustHash = plan.trust.proposedTrustHash;
      return { decision: "ACKNOWLEDGED", trustHash, stateGeneration: state.stateGeneration, stateHash: state.stateHash };
    } };
    const make = (overrides = {}) => createHybridTrustedResponseWorkflowV1({ machine, verification, requests: reader, store, ...overrides });
    async function issue() {
      const workflow = createHybridRequestWorkflowV1({ machine, verification,
        challenge: { acquire: async () => encode({ schemaVersion: 1n, carrierType: "lease-challenge", requestNonce: f.bytes(`trust-review-nonce-${++count}`,32), expiresInSeconds:300n }) },
        installation: { randomBytes: () => f.bytes(`trust-review-id-${count}`), signInstallation: async ({ sigStructure }) => new Uint8Array(signEs256Rfc6979LowS(sigStructure,keys.TEST_ONLY_INSTALLATION_DEVICE_PRIMARY.privateScalar)) },
        registration: { register: async p => { records.set(hex(p.requestId),p);return {decision:"REGISTERED",requestId:p.requestId,requestHash:p.requestHash};} } });
      request = ok(await workflow.prepare(state,{purpose:"CHECK_IN",target:state.current?"CURRENT":"PENDING"})).plan;ok(await workflow.release(request));
    }
    function bundle(denied = [], overrides = {}) {
      return encode({schemaVersion:1n,carrierType:"trust-bundle",delegations:[f.sign("key-delegation",{
        ...f.payload("pos-delegation-online-lease"),tokenId:f.bytes("review-rotation"),delegationSerial:5n,delegatedKeyId:rotated.kid,delegatedPublicKey:rotated.spkiDer})],
      denylist:f.sign("key-denylist",{...f.payload("pos-denylist-revision-1"),deniedKeys:denied.map(k=>({delegatedKeyId:k,effectiveAt:f.now,reasonCode:1n})).sort((a,b)=>Buffer.compare(a.delegatedKeyId,b.delegatedKeyId)),...overrides})});
    }
    function lease(changes = {}, key = rotated) {
      const p=(state.current??state.pending).entitlement.payload,d=state.device,c=state.control;
      return f.sign("lease",{...f.payload("pos-lease-initial-control"),edition,keyId:key.kid,tokenId:f.bytes(`trust-review-lease-${count}`),
        licenseId:p.licenseId,activationId:p.activationId,installationId:d.installationId,deviceKeyId:d.deviceKeyId,assurance:d.assurance,features:p.features,
        entitlementTokenId:p.tokenId,entitlementGeneration:p.generation,leaseRequestId:request.requestId,leaseRequestHash:request.requestHash,
        leaseRevision:state.leaseRevision+1n,issuedAt:f.now,notBefore:f.now,serverTime:f.now,notAfter:f.now+p.offlineAllowanceSeconds,offlineUntil:f.now+p.offlineAllowanceSeconds,
        controlRevision:c.revision,controlState:c.state,controlEffectiveAt:c.effectiveAt,controlReasonCode:c.reasonCode,...changes},key.id);
    }
    const input = (fields={}) => ({requestId:request.requestId,encoded:encode({schemaVersion:1n,carrierType:"lease-response",requestId:request.requestId,lease:lease(),trustBundle:bundle(),...fields})});
    await issue();
    if(active) {
      const w=createHybridLeaseResponseWorkflowV1({machine,verification,requests:reader,store:{commit:async p=>{state=p.state;return {decision:"ACKNOWLEDGED",stateGeneration:state.stateGeneration,stateHash:state.stateHash};}}});
      const i={requestId:request.requestId,encoded:encode({schemaVersion:1n,carrierType:"lease-response",requestId:request.requestId,lease:lease({},old)})};
      ok(await w.complete(ok(await w.prepare(state,i,f.now)).plan));await issue();
    }
    return {get state(){return state;},set state(v){state=v;},get machine(){return machine;},get request(){return request;},get commits(){return commits;},
      records,reader,store,make,issue,bundle,lease,input,
      accept:async(w,p)=>{const r=ok(await w.complete(p));machine=r.machine;verification={...r.trust,crypto:nodeCryptoV1};return r;},
      reject:async(fields={},code)=>{const initial=state,n=commits,r=await make().prepare(state,input(fields),f.now);assert.equal(r.ok,false);if(code)assert.equal(r.errorCode,code);assert.equal(state,initial);assert.equal(commits,n);return r;}};
  }
  async function test(name,fn){try{await fn();results.push(`${edition}/${name}`);}catch(e){failures.push({name:`${edition}/${name}`,message:e.stack});}}
  await test("sibling-branch-cannot-use-another-branch-result",async()=>{
    const s=await setup(),a=s.machine.stageTrust(s.state,s.bundle(),f.now),b=s.machine.stageTrust(s.state,s.bundle(),f.now);
    const changed=ok(a.machine.transition(a.state,{kind:"NETWORK",unavailable:true},f.now)).state;
    assert.throws(()=>b.machine.project(changed,f.now));assert.throws(()=>s.machine.project(changed,f.now));
    assert.equal(a.machine.project(changed,f.now).operational,false);assert.equal(b.state,s.state);
  });
  await test("branch-cannot-accept-predecessor-future-state",async()=>{
    const s=await setup(),branch=s.machine.stageTrust(s.state,s.bundle(),f.now);
    const changed=ok(s.machine.transition(s.state,{kind:"NETWORK",unavailable:true},f.now)).state;
    assert.throws(()=>branch.machine.stageTrust(changed,s.bundle(),f.now));assert.equal(branch.machine.transition(changed,{kind:"REEVALUATE"},f.now).ok,false);
  });
  await test("denied-current-parent-cannot-hide-behind-new-lease",async()=>{const s=await setup(true);await s.reject({trustBundle:s.bundle([keys.TEST_ONLY_OFFLINE_ENTITLEMENT_PRIMARY.kid])},"SIGNING_KEY_DENIED");});
  await test("replacement-removes-old-lease-authority-only-after-complete",async()=>{
    const s=await setup(true),initial=s.state,w=s.make(),p=ok(await w.prepare(s.state,s.input({trustBundle:s.bundle([old.kid])}),f.now)).plan;
    assert.equal(s.state,initial);assert.equal(hex(initial.current.lease.payload.keyId),hex(old.kid));
    const r=await s.accept(w,p);assert.equal(hex(r.state.current.lease.payload.keyId),hex(rotated.kid));assert.equal(r.machine.project(r.state,f.now).operational,true);assert.equal(s.commits,1);
  });
  await test("new-key-denial-delayed-until-corroborated-time",async()=>{
    const s=await setup(),effective=f.now+100n,w=s.make();
    const r=await s.accept(w,ok(await w.prepare(s.state,s.input({trustBundle:s.bundle([],{deniedKeys:[{delegatedKeyId:rotated.kid,effectiveAt:effective,reasonCode:1n}]})}),f.now)).plan);
    assert.equal(r.machine.project(r.state,effective-1n).operational,true);assert.throws(()=>r.machine.project(r.state,effective));
  });
  await test("mismatched-machine-trust-config-never-commits",async()=>{
    const s=await setup(),alternate={...f.verification,trustedKeys:f.verification.trustedKeys.slice(0,1)};
    const r=await s.make({verification:alternate}).prepare(s.state,s.input(),f.now);assert.equal(r.ok,false);assert.equal(r.errorCode,"TRUST_MODEL_CONFIGURATION_MISMATCH");assert.equal(s.commits,0);
  });
  await test("source-config-mutation-after-factory-does-not-rewrite-pinned-trust",async()=>{
    const s=await setup(),config={...f.verification,roots:[...f.verification.roots],trustedKeys:[...f.verification.trustedKeys]},w=s.make({verification:config});
    config.roots.length=0;config.trustedKeys.length=0;
    ok(await w.prepare(s.state,s.input(),f.now));assert.equal(s.commits,0);
  });
  await test("memoized-request-is-stable-during-next-stage",async()=>{
    const s=await setup(),record={encoded:new Uint8Array(s.request.encoded)},w=s.make();let reads=0;
    s.reader.read=async()=>{assert.equal(++reads,1);return record;};
    const promise=w.prepare(s.state,s.input(),f.now);const p=ok(await promise).plan;record.encoded.fill(0);
    assert.equal(p.license.proposal.state.leaseRevision,1n);assert.equal(reads,1);assert.equal(s.commits,0);
  });
  await test("partial-trust-state-acknowledgements-cannot-publish",async()=>{
    const s=await setup(),w=s.make(),p=ok(await w.prepare(s.state,s.input(),f.now)).plan,initial=s.state;
    for(const ack of [{trustHash:p.trust.proposedTrustHash,stateGeneration:p.license.proposal.state.stateGeneration,stateHash:initial.stateHash},
      {trustHash:p.trust.expectedTrustHash,stateGeneration:p.license.proposal.state.stateGeneration,stateHash:p.license.proposal.state.stateHash}]){
      s.store.commit=async()=>({decision:"ACKNOWLEDGED",...ack});const r=await w.complete(p);assert.equal(r.ok,false);assert.equal(r.errorCode,"TRUSTED_RESPONSE_ACKNOWLEDGEMENT_INVALID");assert(!("machine"in r));assert.equal(s.state,initial);
    }
  });
  await test("state-advance-invalidates-both-part-plan",async()=>{
    const s=await setup(),w=s.make(),p=ok(await w.prepare(s.state,s.input(),f.now)).plan;
    s.state=ok(s.machine.transition(s.state,{kind:"NETWORK",unavailable:true},f.now)).state;
    const r=await w.complete(p);assert.equal(r.ok,false);assert.equal(r.errorCode,"TRUSTED_RESPONSE_CONFLICT");assert.equal(s.state.leaseRevision,0n);
  });
  await test("new-denial-blocks-historical-receipt-shortcut",async()=>{
    const s=await setup(),encoded=s.lease(),w=s.make();const r=await s.accept(w,ok(await w.prepare(s.state,s.input({lease:encoded}),f.now)).plan);
    const dl=r.trust.denylist,branch=r.machine.stageTrust(r.state,s.bundle([rotated.kid],{denylistRevision:dl.revision+1n,tokenId:f.bytes("review-denial-2"),previousDenylistTokenId:dl.tokenId,previousDenylistHash:dl.tokenHash}),f.now);
    const replay=branch.machine.transition(branch.state,{kind:"IMPORT_LEASE",encoded,parentTokenId:branch.state.current.entitlement.payload.tokenId},f.now);
    assert.equal(replay.ok,false);assert.equal(replay.errorCode,"SIGNING_KEY_DENIED");assert.equal(replay.state,r.state);
  });
  await test("trust-update-blocked-during-existing-time-incident",async()=>{
    const s=await setup(true);s.state=ok(s.machine.transition(s.state,{kind:"BEGIN_TIME_RECOVERY",observation:{wallUtc:f.now,bootId:f.bytes("review-boot"),monotonicMs:1000n},incident:{id:f.bytes("review-incident"),nonce:f.bytes("review-incident",32),reason:"CLOCK_FORWARD_JUMP"}},f.now)).state;
    await s.issue();await s.reject({},"TIME_RECOVERY_TRUST_UPDATE_FORBIDDEN");assert.throws(()=>s.machine.stageTrust(s.state,s.bundle(),f.now));
  });
  await test("corroborated-clock-crossing-denial-rejects-with-original-state",async()=>{
    const s=await setup(),observation={wallUtc:f.now,bootId:f.bytes("tracked-review-boot"),monotonicMs:1000n};
    s.state=ok(s.machine.transition(s.state,{kind:"OBSERVE_TIME",observation,incident:{id:f.bytes("tracked-init"),nonce:f.bytes("tracked-init",32),reason:"CLOCK_FORWARD_JUMP"}},f.now)).state;
    await s.issue();
    const w=s.make(),r=await s.accept(w,ok(await w.prepare(s.state,{...s.input({trustBundle:s.bundle([],{deniedKeys:[{delegatedKeyId:rotated.kid,effectiveAt:f.now+100n,reasonCode:1n}]})}),observation},f.now)).plan);
    assert(r.state.clock);assert.equal(r.machine.project(r.state,f.now).operational,true);
    const crossed=r.machine.transition(r.state,{kind:"OBSERVE_TIME",observation:{...observation,wallUtc:f.now+100n,monotonicMs:101000n},incident:{id:f.bytes("observe"),nonce:f.bytes("observe",32),reason:"CLOCK_FORWARD_JUMP"}},f.now+100n);
    assert.equal(crossed.ok,false);assert.equal(crossed.errorCode,"SIGNING_KEY_DENIED");assert.equal(crossed.state,r.state);
    // Reusing the last accepted model is not evidence of a successful clock observation.
    assert.equal(r.machine.project(crossed.state,f.now+100n).operational,true);
  });
  await test("signed-time-replacement-crosses-old-key-denial-atomically",async()=>{
    const s=await setup(true),observation={wallUtc:f.now,bootId:f.bytes("replace-review-boot"),monotonicMs:1000n};
    s.state=ok(s.machine.transition(s.state,{kind:"OBSERVE_TIME",observation,incident:{id:f.bytes("init-clock"),nonce:f.bytes("init-clock",32),reason:"CLOCK_FORWARD_JUMP"}},f.now)).state;
    await s.issue();const signed=f.now+120n,parent=s.state.current.entitlement.payload,w=s.make();
    const input=s.input({trustBundle:s.bundle([],{deniedKeys:[{delegatedKeyId:old.kid,effectiveAt:f.now+100n,reasonCode:1n}]}),
      lease:s.lease({serverTime:signed,issuedAt:signed,notBefore:signed,offlineUntil:signed+parent.offlineAllowanceSeconds,notAfter:signed+parent.offlineAllowanceSeconds})});
    const p=ok(await w.prepare(s.state,{...input,observation:{...observation,wallUtc:signed,monotonicMs:121000n}},signed)).plan;
    assert.equal(p.license.proposal.state.clockHighWater,signed);const r=await s.accept(w,p);assert.equal(r.machine.project(r.state,signed).operational,true);
    assert.equal(hex(r.state.current.lease.payload.keyId),hex(rotated.kid));assert.equal(s.commits,1);
  });
}
console.log(JSON.stringify({passed:results.length,attempted:results.length+failures.length,results,failures},null,2));
if(failures.length)process.exitCode=1;
