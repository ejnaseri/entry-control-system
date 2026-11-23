// TEST_ONLY_DO_NOT_TRUST. Real signed artifacts; atomic persistence is a double.
import assert from "node:assert/strict";
import { createLicenseStateFixtures } from "./license-state-fixtures.mjs";
import { TEST_ONLY_KEYS } from "../../licensing/vectors/v1/test-only/keys.mjs";
import { signEs256Rfc6979LowS } from "../../licensing/vectors/v1/lib/ecdsa-rfc6979.mjs";
export async function runLicenseHybridTrustedResponseTests(production) {
  const ids = [], failures = [], hex = b => Buffer.from(b).toString("hex");
  const ok = r => { assert(r.ok,`${r.stage}/${r.errorCode}`); return r; };
  const no = (r,code) => { assert.equal(r.ok,false); if(code) assert.equal(r.errorCode,code); assert.equal(r.durable,false); assert.equal(r.runtimeAuthority,"NONE"); };
  const encode = o => production.core.encodeDeterministicCborV1(new Map(Object.entries(o)));
  for(const edition of ["FULL","ATTENDANCE"]) {
    const f = createLicenseStateFixtures(production,{edition}), key = TEST_ONLY_KEYS.TEST_ONLY_ONLINE_LEASE_DENIED;
    // The key label is a fixture name only: its actual denial status comes from the signed Denylist.
    async function setup() {
      const machine = production.core.createLicenseStateMachineV1(f.configuration);
      const s = { machine, state:ok(machine.transition(machine.initial(),f.initialActivation({mode:"HYBRID_LEASED"}).command,f.now)).state,
        records:new Map(),calls:0,writes:0,counter:0 };
      s.reader = {read:async id=>s.records.get(hex(id))};
      s.issue = async () => {
        const requester = production.createHybridRequestWorkflowV1({machine:s.machine,verification:s.verification??f.verification,
          installation:{randomBytes:n=>f.bytes(`trusted-${++s.counter}`,n),signInstallation:async({sigStructure})=>new Uint8Array(signEs256Rfc6979LowS(sigStructure,TEST_ONLY_KEYS.TEST_ONLY_INSTALLATION_DEVICE_PRIMARY.privateScalar))},
          challenge:{acquire:async()=>encode({schemaVersion:1n,carrierType:"lease-challenge",requestNonce:f.bytes(`nonce-${s.counter}`,32),expiresInSeconds:300n})},
          registration:{register:async p=>{s.records.set(hex(p.requestId),p);return {decision:"REGISTERED",requestId:p.requestId,requestHash:p.requestHash};}}});
        s.request=ok(await requester.prepare(s.state,{purpose:"CHECK_IN",target:s.state.current?"CURRENT":"PENDING"})).plan;
        ok(await requester.release(s.request));
      };
      s.store={commit:async p=>{s.calls++;const q=p.license.proposal;
        if(q.expectedPreviousGeneration!==s.state.stateGeneration||hex(q.expectedPreviousHash)!==hex(s.state.stateHash)||
          (s.trustHash&&hex(s.trustHash)!==hex(p.trust.expectedTrustHash))) return {decision:"CONFLICT"};
        assert(q.commitObligations.includes("STAGE_COMPLETE_STATE_AND_JOURNAL")||q.decision==="IDEMPOTENT");
        if(q.decision!=="IDEMPOTENT"||p.trust.decision!=="EXACT_RETRY")s.writes++;
        s.state=q.state;s.trustHash=p.trust.proposedTrustHash;s.trust=p.trust.trust;
        return {decision:"ACKNOWLEDGED",trustHash:s.trustHash,stateGeneration:s.state.stateGeneration,stateHash:s.state.stateHash};}};
      s.make=()=>production.createHybridTrustedResponseWorkflowV1({machine:s.machine,verification:s.verification??f.verification,requests:s.reader,store:s.store});
      s.workflow=s.make();
      s.bundle=(denied=[],changes={},denyChanges={})=>{
        const d={...f.payload("pos-delegation-online-lease"),tokenId:f.bytes("rotation"),delegationSerial:5n,delegatedKeyId:key.kid,delegatedPublicKey:key.spkiDer,...changes};
        const deny={...f.payload("pos-denylist-revision-1"),deniedKeys:denied.map(k=>({delegatedKeyId:k,effectiveAt:f.now,reasonCode:1n})).sort((a,b)=>Buffer.compare(a.delegatedKeyId,b.delegatedKeyId)),...denyChanges};
        return encode({schemaVersion:1n,carrierType:"trust-bundle",delegations:[f.sign("key-delegation",d)],denylist:f.sign("key-denylist",deny)});
      };
      s.lease=(changes={},signer=key.id)=>{
        const parent=(s.state.current??s.state.pending).entitlement.payload,c=s.state.control,d=s.state.device;
        return f.sign("lease",{...f.payload("pos-lease-initial-control"),keyId:TEST_ONLY_KEYS[signer].kid,edition,tokenId:f.bytes(`lease-${s.counter}`),
          licenseId:parent.licenseId,activationId:parent.activationId,installationId:d.installationId,deviceKeyId:d.deviceKeyId,assurance:d.assurance,
          features:parent.features,entitlementTokenId:parent.tokenId,entitlementGeneration:parent.generation,leaseRequestId:s.request.requestId,leaseRequestHash:s.request.requestHash,
          leaseRevision:s.state.leaseRevision+1n,issuedAt:f.now,notBefore:f.now,serverTime:f.now,notAfter:f.now+parent.offlineAllowanceSeconds,offlineUntil:f.now+parent.offlineAllowanceSeconds,
          controlRevision:c.revision,controlState:c.state,controlEffectiveAt:c.effectiveAt,controlReasonCode:c.reasonCode,...changes},signer);
      };
      s.control=(changes={})=>{const p=(s.state.current??s.state.pending).entitlement.payload;return f.sign("offline-control",{
        ...f.payload("pos-control-vendor-suspend"),edition,tokenId:f.bytes("control"),licenseId:p.licenseId,activationId:p.activationId,
        issuedAt:f.now,notBefore:f.now,notAfter:f.now+86400n,effectiveAt:f.now,controlRevision:s.state.control.revision+1n,...changes});};
      s.input=(fields={})=>({requestId:s.request.requestId,encoded:encode({schemaVersion:1n,carrierType:"lease-response",requestId:s.request.requestId,
        lease:s.lease(),trustBundle:s.bundle(),...fields})});
      s.prepare=(input=s.input())=>s.workflow.prepare(s.state,input,f.now);
      s.accept=async p=>{const r=ok(await s.workflow.complete(p));s.machine=r.machine;s.verification={...r.trust,crypto:production.nodeCryptoV1};s.workflow=s.make();return r;};
      await s.issue();return s;
    }
    const test=async(name,fn)=>{const id=`${edition}/${name}`;ids.push(id);try{await fn(await setup());}catch(e){failures.push({id,message:e.stack});}};
    await test("new-key-one-atomic-proposal",async s=>{
      const old=s.state,oldMachine=s.machine,p=ok(await s.prepare()).plan;assert.equal(s.calls,0);assert.equal(s.state,old);
      assert.equal(p.license.proposal.state.stateGeneration,old.stateGeneration+1n);assert.equal(p.trust.trust.delegations.length,5);
      const r=await s.accept(p);assert.equal(s.calls,1);assert.equal(s.writes,1);assert.equal(r.runtimeAuthority,"NONE");assert.equal(r.durable,false);
      assert.equal(r.machine.project(r.state,f.now).operational,true);assert.equal(oldMachine.project(old,f.now).operational,false);
      assert(r.state.consumedRequests.some(v=>hex(v.id)===hex(s.request.requestId)));assert.throws(()=>oldMachine.project(r.state,f.now));
    });
    await test("new-key-without-delegation-rejects",async s=>{no(await s.prepare(s.input({trustBundle:s.bundle([],{delegatedKeyId:TEST_ONLY_KEYS.TEST_ONLY_ONLINE_LEASE_PRIMARY.kid,delegatedPublicKey:TEST_ONLY_KEYS.TEST_ONLY_ONLINE_LEASE_PRIMARY.spkiDer})})));assert.equal(s.calls,0);});
    await test("denied-response-signer-rejects",async s=>{no(await s.prepare(s.input({trustBundle:s.bundle([key.kid])})),"SIGNING_KEY_DENIED");assert.equal(s.calls,0);});
    await test("denied-retained-parent-rejects",async s=>{no(await s.prepare(s.input({trustBundle:s.bundle([TEST_ONLY_KEYS.TEST_ONLY_OFFLINE_ENTITLEMENT_PRIMARY.kid])})),"SIGNING_KEY_DENIED");assert.equal(s.calls,0);});
    await test("bad-root-or-lease-neutral",async s=>{
      const root=s.bundle();root[root.length-1]^=1;no(await s.prepare(s.input({trustBundle:root})));
      const lease=s.lease();lease[lease.length-1]^=1;no(await s.prepare(s.input({lease})));assert.equal(s.calls,0);assert.equal(s.writes,0);
    });
    await test("lease-request-parent-bindings",async s=>{
      for(const changes of [{leaseRequestId:f.bytes("wrong")},{leaseRequestHash:f.bytes("wrong",32)},{entitlementTokenId:f.bytes("wrong")},{activationId:f.bytes("wrong")}])no(await s.prepare(s.input({lease:s.lease(changes)})));
      assert.equal(s.calls,0);
    });
    await test("lease-control-trust-one-generation",async s=>{
      const p=ok(await s.prepare(s.input({offlineControl:s.control(),lease:s.lease({controlRevision:1n,controlState:"SUSPENDED",controlEffectiveAt:f.now,controlReasonCode:1n})}))).plan;
      const old=s.state;const r=await s.accept(p);assert.equal(s.calls,1);assert.equal(r.state.stateGeneration,old.stateGeneration+1n);
      assert.equal(r.machine.project(r.state,f.now).state,"SUSPENDED_LOCKED");
    });
    await test("denied-control-and-invalid-control-neutral",async s=>{
      no(await s.prepare(s.input({offlineControl:s.control(),trustBundle:s.bundle([TEST_ONLY_KEYS.TEST_ONLY_OFFLINE_CONTROL_PRIMARY.kid])})),"SIGNING_KEY_DENIED");
      no(await s.prepare(s.input({offlineControl:new Uint8Array([1])})));assert.equal(s.calls,0);
    });
    await test("closed-bounded-and-unsupported-variants",async s=>{
      const input=s.input();no(await s.prepare({...input,foo:1}));no(await s.prepare({...input,encoded:new Uint8Array(524289)}));
      no(await s.prepare({...input,requestId:f.bytes("wrong")}));no(await s.prepare(s.input({reactivationAuthorization:new Uint8Array([1])})));
      no(await s.prepare({requestId:s.request.requestId,encoded:encode({schemaVersion:1n,carrierType:"lease-response",requestId:s.request.requestId,lease:s.lease()})}));assert.equal(s.calls,0);
    });
    await test("signed-time-recovery-forbidden",async s=>{
      const p=ok(f.verifier.verifySignedObject({expectedType:"lease-request",encoded:s.request.encoded,context:{workflow:"VENDOR_HTTPS_REQUEST",build:s.state.build,device:s.state.device}})).value.payload;
      s.records.set(hex(s.request.requestId),{encoded:f.sign("lease-request",{...f.clone(p),requestPurpose:"TIME_RECOVERY",incidentId:f.bytes("incident"),incidentNonce:f.bytes("nonce",32),preIncidentClockHighWater:s.state.clockHighWater})});
      no(await s.prepare(),"TIME_RECOVERY_TRUST_UPDATE_FORBIDDEN");assert.equal(s.calls,0);
    });
    await test("input-mutation-and-plan-provenance",async s=>{
      const input=s.input(),promise=s.prepare(input);input.encoded.fill(0);const p=ok(await promise).plan;
      no(await s.workflow.complete({...p}),"UNTRUSTED_RESPONSE_PLAN");no(await s.make().complete(p),"UNTRUSTED_RESPONSE_PLAN");
      assert.throws(()=>s.machine.stageTrust({...s.state},s.bundle(),f.now));assert.equal(s.calls,0);
    });
    await test("state-and-trust-cas-conflicts",async s=>{
      const p=ok(await s.prepare()).plan;s.trustHash=f.bytes("wrong",32);no(await s.workflow.complete(p),"TRUSTED_RESPONSE_CONFLICT");
      s.trustHash=undefined;s.state=s.machine.initial();no(await s.workflow.complete(p),"TRUSTED_RESPONSE_CONFLICT");assert.equal(s.writes,0);
    });
    await test("partial-acknowledgements-never-publish-model",async s=>{
      const p=ok(await s.prepare()).plan,q=p.license.proposal.state;
      for(const ack of [{stateGeneration:q.stateGeneration,stateHash:q.stateHash},{trustHash:p.trust.proposedTrustHash},
        {trustHash:f.bytes("wrong",32),stateGeneration:q.stateGeneration,stateHash:q.stateHash},
        {trustHash:p.trust.proposedTrustHash,stateGeneration:q.stateGeneration,stateHash:f.bytes("wrong",32)}]){
        s.store.commit=async()=>({decision:"ACKNOWLEDGED",...ack});const r=await s.workflow.complete(p);no(r,"TRUSTED_RESPONSE_ACKNOWLEDGEMENT_INVALID");assert(!('machine' in r));}
    });
    await test("pending-and-lost-ack-no-publication",async s=>{
      const p=ok(await s.prepare()).plan,commit=s.store.commit;s.store.commit=async()=>({decision:"PENDING"});no(await s.workflow.complete(p),"TRUSTED_RESPONSE_PENDING");
      s.store.commit=async p=>{await commit(p);throw Error("PRIVATE_PATH");};const r=await s.workflow.complete(p);no(r,"TRUSTED_RESPONSE_OUTCOME_UNKNOWN");
      assert.equal(s.writes,1);assert(!('machine' in r));assert(!JSON.stringify(r).includes("PRIVATE_PATH"));
    });
    await test("branch-retains-restrictions-and-denials",async s=>{
      const incident={id:f.bytes("incident"),nonce:f.bytes("nonce",32),reason:"INTEGRITY_FAILURE"};
      s.state=ok(s.machine.transition(s.state,{kind:"INTEGRITY_INCIDENT",incident},f.now)).state;await s.issue();
      const before=s.state,r=await s.accept(ok(await s.prepare()).plan);assert.equal(r.state.tamperLatched,before.tamperLatched);
      assert.equal(r.state.recoveryRequired,true);assert.equal(r.machine.project(r.state,f.now).operational,false);
    });
    await test("future-denial-enforced-on-later-projection",async s=>{
      const d={...f.payload("pos-delegation-online-lease"),tokenId:f.bytes("rotation"),delegationSerial:5n,delegatedKeyId:key.kid,delegatedPublicKey:key.spkiDer};
      const deny={...f.payload("pos-denylist-revision-1"),deniedKeys:[{delegatedKeyId:key.kid,effectiveAt:f.now+100n,reasonCode:1n}]};
      const bundle=encode({schemaVersion:1n,carrierType:"trust-bundle",delegations:[f.sign("key-delegation",d)],denylist:f.sign("key-denylist",deny)});
      const r=await s.accept(ok(await s.prepare(s.input({trustBundle:bundle}))).plan);
      assert.equal(r.machine.project(r.state,f.now).operational,true);assert.throws(()=>r.machine.project(r.state,f.now+100n));
      const transition=r.machine.transition(r.state,{kind:"REEVALUATE"},f.now+100n);assert.equal(transition.ok,false);assert.equal(transition.errorCode,"SIGNING_KEY_DENIED");
    });
    await test("replace-active-old-key-and-deny-it-atomically",async s=>{
      const original=production.createHybridLeaseResponseWorkflowV1({machine:s.machine,verification:f.verification,requests:s.reader,
        store:{commit:async p=>{s.state=p.state;return{decision:"ACKNOWLEDGED",stateGeneration:s.state.stateGeneration,stateHash:s.state.stateHash};}}});
      const encoded=encode({schemaVersion:1n,carrierType:"lease-response",requestId:s.request.requestId,lease:s.lease({},"TEST_ONLY_ONLINE_LEASE_PRIMARY")});
      ok(await original.complete(ok(await original.prepare(s.state,{encoded,requestId:s.request.requestId},f.now)).plan));
      assert.equal(s.machine.project(s.state,f.now).operational,true);await s.issue();
      const r=await s.accept(ok(await s.prepare(s.input({trustBundle:s.bundle([TEST_ONLY_KEYS.TEST_ONLY_ONLINE_LEASE_PRIMARY.kid])}))).plan);
      assert.equal(r.machine.project(r.state,f.now).operational,true);assert.equal(hex(r.state.current.lease.payload.keyId),hex(key.kid));assert.equal(s.writes,1);
    });
    await test("fresh-checkin-after-trust-handoff",async s=>{
      const input=s.input();await s.accept(ok(await s.prepare(input)).plan);no(await s.prepare(input),"TRUST_REQUEST_STATE_MISMATCH");
      await s.issue();const p=ok(await s.prepare()).plan;assert.equal(p.trust.decision,"EXACT_RETRY");
      const r=await s.accept(p);assert.equal(s.writes,2);assert.equal(r.state.leaseRevision,2n);assert.equal(r.machine.project(r.state,f.now).operational,true);
    });
    await test("one-archived-request-read-per-preparation",async s=>{
      const read=s.reader.read;let reads=0;s.reader.read=async id=>{assert.equal(++reads,1);return read(id);};
      ok(await s.prepare());assert.equal(reads,1);
    });
    await test("receipt-shortcut-cannot-bypass-new-denial",async s=>{
      const lease=s.lease();await s.accept(ok(await s.prepare(s.input({lease}))).plan);
      const bundle=s.bundle([key.kid],{}, {denylistRevision:2n,tokenId:f.bytes("rev-two"),previousDenylistTokenId:s.trust.denylist.tokenId,previousDenylistHash:s.trust.denylist.tokenHash});
      const branch=s.machine.stageTrust(s.state,bundle,f.now);assert.throws(()=>branch.machine.project(branch.state,f.now));
      const r=branch.machine.transition(branch.state,{kind:"IMPORT_LEASE",encoded:lease,parentTokenId:s.state.current.entitlement.payload.tokenId},f.now);
      assert.equal(r.ok,false);assert.equal(r.errorCode,"SIGNING_KEY_DENIED");assert.equal(r.state,s.state);
    });
    await test("stage-rejects-forged-root-update",async s=>{
      const bundle=s.bundle();bundle[bundle.length-1]^=1;assert.throws(()=>s.machine.stageTrust(s.state,bundle,f.now));
      assert.equal(s.machine.project(s.state,f.now).operational,false);assert.equal(s.calls,0);
    });
    await test("invalid-observation-before-request-read",async s=>{
      let reads=0;s.reader.read=async()=>{reads++;throw Error("unused");};no(await s.prepare({...s.input(),observation:{wallUtc:f.now}}));assert.equal(reads,0);
    });
  }
  return {attempted:ids.length,passed:ids.length-failures.length,failures};
}
