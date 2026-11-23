// TEST_ONLY_DO_NOT_TRUST. Fake file adapters; no physical Windows safety proof.
import assert from "node:assert/strict";
import { createLicenseStateFixtures } from "./license-state-fixtures.mjs";
import { TEST_ONLY_KEYS } from "../../licensing/vectors/v1/test-only/keys.mjs";
import { signEs256Rfc6979LowS } from "../../licensing/vectors/v1/lib/ecdsa-rfc6979.mjs";
export async function runLicenseOfflineFileTests(production) {
  const failures = [], ids = [];
  const test = async (id, fn) => { ids.push(id); try { await fn(); } catch(e) { failures.push({ id, message: e.stack ?? String(e) }); } };
  const ok = r => { assert(r.ok, `${r.stage}/${r.errorCode}`); return r; };
  const no = (r, code) => { assert.equal(r.ok, false); if(code) assert.equal(r.errorCode, code); };
  for(const edition of ["FULL", "ATTENDANCE"]) {
    const f = createLicenseStateFixtures(production, { edition });
    function setup(withStore = false) {
      const machine = production.core.createLicenseStateMachineV1(f.configuration), state = machine.initial(), initial = f.initialActivation();
      const s = { state, initial, reads: 0, lookups: 0, registrations: 0, writes: 0, sequence: 0, commits: 0, stateWrites: 0 };
      s.store = { commit: async p => {
        s.commits++;
        if (p.expectedPreviousGeneration !== s.state.stateGeneration || !Buffer.from(p.expectedPreviousHash).equals(Buffer.from(s.state.stateHash))) return {decision:"CONFLICT"};
        if (p.decision === "PROPOSED") { assert(p.commitObligations.includes("SEAL_INDEPENDENT_ANCHORS")); assert(p.commitObligations.includes("STAGE_COMPLETE_STATE_AND_JOURNAL")); s.state = p.state; s.stateWrites++; }
        return {decision:"ACKNOWLEDGED",stateGeneration:s.state.stateGeneration,stateHash:s.state.stateHash};
      } };
      const registration = { register: async p => { s.registrations++; return { decision: "REGISTERED", requestId:p.requestId, requestHash:p.requestHash }; } };
      s.registration = registration;
      s.requests = production.createOfflineRequestWorkflowV1({ machine, verification:f.verification, registration,
        installation: { randomBytes:n=>f.bytes(`file-${++s.sequence}`,n), signInstallation:async ({sigStructure})=>new Uint8Array(signEs256Rfc6979LowS(sigStructure,TEST_ONLY_KEYS.TEST_ONLY_INSTALLATION_DEVICE_PRIMARY.privateScalar)) } });
      s.files = { read: async ({type,maxBytes}) => { s.reads++; assert.equal(type,"entitlement"); assert.equal(maxBytes,16384); return initial.encoded; },
        publish:async p=>{ s.writes++; assert(s.registrations>0); assert.deepEqual(f.hash(p.bytes),p.requestHash); return {decision:"PUBLISHED",byteLength:p.bytes.length,requestHash:p.requestHash}; } };
      s.reader = {read:async ()=>{s.lookups++;return {encoded:initial.encodedRequest};}};
      s.workflow = production.createOfflineFileWorkflowV1({ machine, verification:f.verification, requestWorkflow:s.requests, files:s.files, requests:s.reader, ...(withStore?{store:s.store}:{}) });
      s.input = {kind:"ENTITLEMENT",requestId:initial.request.requestId};
      s.plan = async()=>ok(await s.requests.prepare(state,{purpose:"ACTIVATE",issuedAt:f.now,notAfter:f.now+86400n})).plan;
      return s;
    }
    await test(`${edition}/bounded-read-to-real-planner`,async()=>{const s=setup(),read=s.files.read,lookup=s.reader.read;s.files.read=async p=>{s.input.requestId.fill(0);return read(p);};s.reader.read=async()=>{s.initial.encoded.fill(0);return lookup();};const r=ok(await s.workflow.prepareImport(s.state,s.input,f.now));assert.equal(r.decision,"PROPOSED");assert.equal(r.durable,false);assert.equal(r.runtimeAuthority,"NONE");assert.equal(s.state.stateGeneration,0n);assert.equal(s.reads,1);});
    await test(`${edition}/invalid-metadata-before-io`,async()=>{const s=setup();for(const input of [{...s.input,path:"unsafe"},{...s.input,kind:"UNKNOWN"},{...s.input,requestId:new Uint8Array(1)}])no(await s.workflow.prepareImport(s.state,input,f.now));assert.equal(s.reads,0);});
    await test(`${edition}/invalid-intake-does-not-plan`,async()=>{const s=setup();for(const bytes of [undefined,new Uint8Array(),new Uint8Array(16385)]){s.files.read=async()=>bytes;no(await s.workflow.prepareImport(s.state,s.input,f.now),"FILE_INTAKE_FAILED");}assert.equal(s.lookups,0);});
    await test(`${edition}/read-errors-redacted`,async()=>{const s=setup();s.files.read=async()=>{throw Error("SECRET_CANARY");};const r=await s.workflow.prepareImport(s.state,s.input,f.now);no(r,"FILE_INTAKE_FAILED");assert(!JSON.stringify(r).includes("SECRET_CANARY"));assert.equal(s.lookups,0);});
    await test(`${edition}/pair-second-read-failure-no-planner`,async()=>{const s=setup();s.files.read=async p=>{s.reads++;if(p.role==="authorization"){assert.equal(p.type,"reactivation-authorization");return new Uint8Array([1]);}throw Error("second failed");};no(await s.workflow.prepareImport(s.state,{kind:"REACTIVATION",requestId:s.input.requestId},f.now),"FILE_INTAKE_FAILED");assert.equal(s.lookups,0);assert.equal(s.reads,2);});
    await test(`${edition}/registered-export-and-exact-retry`,async()=>{const s=setup(),p=await s.plan(),seen=[];s.files.publish=async x=>{s.writes++;assert(s.registrations>=s.writes);seen.push(x.bytes);return {decision:"PUBLISHED",byteLength:x.bytes.length,requestHash:x.requestHash};};for(let i=0;i<2;i++){const r=ok(await s.workflow.exportRequest(p));assert.equal(r.durable,false);}assert.deepEqual(seen[0],seen[1]);});
    await test(`${edition}/registration-failure-no-publication`,async()=>{const s=setup(),p=await s.plan();s.registration.register=async()=>undefined;no(await s.workflow.exportRequest(p));assert.equal(s.writes,0);no(await s.workflow.exportRequest({...p}));assert.equal(s.writes,0);});
    await test(`${edition}/publication-unknown-and-bad-ack`,async()=>{const s=setup(),p=await s.plan();s.files.publish=async()=>{throw Error("SECRET_CANARY");};const r=await s.workflow.exportRequest(p);no(r,"FILE_PUBLICATION_OUTCOME_UNKNOWN");assert(!JSON.stringify(r).includes("SECRET_CANARY"));s.files.publish=async()=>({decision:"PUBLISHED",byteLength:0,requestHash:new Uint8Array(32)});no(await s.workflow.exportRequest(p),"FILE_PUBLICATION_ACK_INVALID");assert.equal(s.registrations,2);});
    await test(`${edition}/completion-missing-store-before-io`,async()=>{const s=setup();no(await s.workflow.applyImport(s.state,s.input,f.now),"FILE_COMPLETION_UNAVAILABLE");assert.equal(s.reads,0);});
    await test(`${edition}/one-read-one-complete-commit`,async()=>{const s=setup(true),read=s.reader.read;s.reader.read=async()=>{s.initial.encoded.fill(0);return read();};const r=ok(await s.workflow.applyImport(s.state,s.input,f.now));assert.equal(r.decision,"ADAPTER_ACKNOWLEDGED");assert.equal(r.durable,false);assert.equal(r.runtimeAuthority,"NONE");assert.equal(s.reads,1);assert.equal(s.lookups,1);assert.equal(s.stateWrites,1);assert.equal(s.state.consumedRequests.length,1);});
    await test(`${edition}/planning-with-store-still-no-write`,async()=>{const s=setup(true);ok(await s.workflow.prepareImport(s.state,s.input,f.now));assert.equal(s.commits,0);});
    await test(`${edition}/invalid-file-and-pair-failure-no-commit`,async()=>{const s=setup(true);s.initial.encoded[0]^=1;no(await s.workflow.applyImport(s.state,s.input,f.now));s.files.read=async p=>{if(p.role==="authorization")return new Uint8Array([1]);throw Error("second read");};no(await s.workflow.applyImport(s.state,{kind:"REACTIVATION",requestId:s.input.requestId},f.now),"FILE_INTAKE_FAILED");assert.equal(s.commits,0);});
    await test(`${edition}/pending-conflict-invalid-ack-preserved`,async()=>{const s=setup(true),before=s.state;for(const [receipt,code] of [[{decision:"PENDING"},"COMMIT_PENDING"],[{decision:"CONFLICT"},"COMMIT_STATE_CONFLICT"],[{decision:"ACKNOWLEDGED",stateGeneration:0n,stateHash:before.stateHash},"COMMIT_ACKNOWLEDGEMENT_INVALID"]]){s.store.commit=async()=>receipt;no(await s.workflow.applyImport(s.state,s.input,f.now),code);}assert.equal(s.state,before);});
    await test(`${edition}/lost-ack-no-rollback-exact-retry`,async()=>{const s=setup(true),commit=s.store.commit;s.store.commit=async p=>{await commit(p);throw Error("SECRET_CANARY");};const r=await s.workflow.applyImport(s.state,s.input,f.now);no(r,"COMMIT_OUTCOME_UNKNOWN");assert(!JSON.stringify(r).includes("SECRET_CANARY"));const before=s.state;s.store.commit=commit;assert.equal(ok(await s.workflow.applyImport(s.state,s.input,f.now)).decision,"ADAPTER_CONFIRMED_DUPLICATE");assert.equal(s.state,before);assert.equal(s.stateWrites,1);});
    await test(`${edition}/concurrent-imports-one-state-write`,async()=>{const s=setup(true),before=s.state;const results=await Promise.all([s.workflow.applyImport(before,s.input,f.now),s.workflow.applyImport(before,s.input,f.now)]);assert.equal(results.filter(r=>r.ok).length,1);assert.equal(s.stateWrites,1);});
    await test(`${edition}/cannot-submit-caller-proposal-or-bytes`,async()=>{const s=setup(true);for(const field of ["proposal","artifact","authorization","entitlement"]){no(await s.workflow.applyImport(s.state,{...s.input,[field]:{}},f.now),"FILE_INTENT_INVALID");}assert.equal(s.reads,0);assert.equal(s.commits,0);});
  }
  assert.equal(new Set(ids).size,ids.length);return {attempted:ids.length,passed:ids.length-failures.length,failures};
}
