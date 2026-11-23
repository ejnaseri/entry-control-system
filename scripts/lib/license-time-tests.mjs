// TEST_ONLY_DO_NOT_TRUST. Load only after the production dependency graph scan.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createLicenseStateFixtures } from "./license-state-fixtures.mjs";

const dump = value => JSON.stringify(value, (_, v) => typeof v === "bigint" ? `${v}n` : v instanceof Uint8Array ? [...v] : v);
export function runLicenseTimeTests(production) {
  const { core } = production, f = createLicenseStateFixtures(production), now = f.now;
  const failures = [], ids = [], descriptorIds = [];
  let sequence = 0;
  const name = () => `time-${sequence++}`;
  const boot = f.bytes("boot-a"), bootB = f.bytes("boot-b");
  const observation = (wallUtc = now, monotonicMs = 1000n, bootId = boot) => ({ wallUtc, monotonicMs, bootId });
  const incident = () => { const id=name(); return { id:f.bytes(id),nonce:f.bytes(`${id}-nonce`,32),reason:"CLOCK_ROLLBACK" }; };
  const test = (id, run) => { ids.push(id); try { run(); } catch (error) { failures.push({ id, message:error.stack ?? String(error) }); } };
  const advance = (scene, command) => {
    const prior=scene.state,before=dump(prior),input=dump(command);
    const result=scene.machine.transition(prior,command,scene.now);
    assert.equal(dump(prior),before);assert.equal(dump(command),input);
    assert(result.ok,`${result.stage}/${result.errorCode}`);assert.equal(result.requestConsumed,false);assert.equal(result.authoritativeStateChanged,false);
    assert.equal(result.state.stateGeneration,prior.stateGeneration+1n);
    assert.equal(dump(result.expectedPreviousHash),dump(prior.stateHash));
    scene.state=result.state;return result;
  };
  const reject = (scene, command, code, stage="STATE") => {
    const prior=scene.state,before=dump(prior),input=dump(command);
    const result=scene.machine.transition(prior,command,scene.now);
    assert.equal(result.ok,false,code);assert.equal(result.errorCode,code);assert.equal(result.stage,stage);
    assert.equal(result.state,prior);assert.equal(dump(prior),before);assert.equal(dump(command),input);
    assert.equal(result.requestConsumed,false);assert.equal(result.authoritativeStateChanged,false);
  };
  const effective = scene => scene.machine.project(scene.state,scene.state.clockHighWater).state;
  function lease(scene, recovery=false, changes={}, requestChanges={}) {
    const s=scene.state,p=(s.current??s.pending).entitlement.payload,label=name();
    const requestPayload=f.payload(recovery?"pos-lease-request-time-recovery":"pos-lease-request-check-in");
    Object.assign(requestPayload,{requestId:f.bytes(`${label}-request`),requestNonce:f.bytes(`${label}-nonce`,32),
      licenseId:p.licenseId,activationId:p.activationId,installationId:s.device.installationId,deviceKeyId:s.device.deviceKeyId,keyId:s.device.deviceKeyId,
      stateGeneration:s.stateGeneration,entitlementTokenId:p.tokenId,entitlementGeneration:p.generation,lastLeaseRevision:s.leaseRevision,
      controlRevision:s.control.revision,controlState:s.control.state,controlEffectiveAt:s.control.effectiveAt,controlReasonCode:s.control.reasonCode,
      ...(recovery?{incidentId:s.timeIncident.id,incidentNonce:s.timeIncident.nonce,preIncidentClockHighWater:s.timeIncident.preIncidentClockHighWater}:{}),...requestChanges});
    const request=f.requestSnapshot(f.sign("lease-request",requestPayload));
    const payload=f.payload("pos-lease-initial-control");
    Object.assign(payload,{tokenId:f.bytes(label),licenseId:p.licenseId,activationId:p.activationId,installationId:s.device.installationId,
      deviceKeyId:s.device.deviceKeyId,assurance:s.device.assurance,entitlementTokenId:p.tokenId,entitlementGeneration:p.generation,
      leaseRequestId:request.requestId,leaseRequestHash:request.requestHash,leaseRevision:s.leaseRevision+1n,
      features:[...p.features],issuedAt:now,serverTime:now,notBefore:now,notAfter:now+p.offlineAllowanceSeconds,
      offlineUntil:[now+p.offlineAllowanceSeconds,p.notAfter,p.graceUntil].reduce((a,b)=>a<b?a:b),
      controlRevision:s.control.revision,controlState:s.control.state,controlEffectiveAt:s.control.effectiveAt,controlReasonCode:s.control.reasonCode,...changes});
    const encoded=f.sign("lease",payload);
    return {payload,request,encoded,command:recovery?{kind:"RECOVER_ONLINE_TIME",encoded,request,observation:observation(now+90000n,2000n),
      evidence:{bootId:boot,sentMonotonicMs:1000n,requestHash:request.requestHash}}:{kind:"IMPORT_LEASE",encoded,request,parentTokenId:p.tokenId}};
  }
  function fresh(mode="OFFLINE_BOUND", open=true) {
    const machine=core.createLicenseStateMachineV1(f.configuration),scene={machine,state:machine.initial(),now};
    advance(scene,f.initialActivation({mode,label:name()}).command);
    if(mode==="HYBRID_LEASED")advance(scene,lease(scene).command);
    advance(scene,{kind:"OBSERVE_TIME",observation:observation(),incident:incident()});
    if(open)advance(scene,{kind:"BEGIN_TIME_RECOVERY",observation:observation(now+90000n),incident:incident()});
    return scene;
  }
  function correction(scene,changes={}) {
    const s=scene.state,p=s.current.entitlement.payload,label=name(),i=s.timeIncident;
    const rp=f.payload("pos-activation-time-correct");delete rp.tpmEvidence;
    Object.assign(rp,{requestId:f.bytes(`${label}-request`),requestNonce:f.bytes(`${label}-nonce`,32),
      licenseId:p.licenseId,activationId:p.activationId,installationId:s.device.installationId,deviceKeyId:s.device.deviceKeyId,keyId:s.device.deviceKeyId,
      devicePublicKey:s.device.devicePublicKey,bindingKind:s.device.assurance,stateGeneration:s.stateGeneration,
      entitlementGeneration:s.entitlementGeneration,leaseRevision:s.leaseRevision,controlRevision:s.control.revision,controlState:s.control.state,
      timeCorrectionRevision:s.timeCorrectionRevision,incidentId:i.id,incidentNonce:i.nonce,preIncidentClockHighWater:i.preIncidentClockHighWater,
      issuedAt:now,notAfter:now+86400n});
    const request=f.requestSnapshot(f.sign("activation-request",rp));
    const payload=f.payload("pos-time-correction");Object.assign(payload,{tokenId:f.bytes(label),
      licenseId:p.licenseId,activationId:p.activationId,installationId:s.device.installationId,deviceKeyId:s.device.deviceKeyId,
      requestId:request.requestId,requestHash:request.requestHash,incidentId:i.id,incidentNonce:i.nonce,
      expectedStateGeneration:s.stateGeneration,newStateGeneration:s.stateGeneration+1n,timeCorrectionRevision:s.timeCorrectionRevision+1n,
      preIncidentClockHighWater:i.preIncidentClockHighWater,issuedAt:now,correctedUtc:now+10n,notBefore:now,notAfter:now+3600n,...changes});
    const encoded=f.sign("time-correction",payload);
    return {payload,encoded,request,command:{kind:"APPLY_TIME_CORRECTION",encoded,request,
      observation:observation(now+90000n,2000n),evidence:{bootId:boot,sentMonotonicMs:1000n,requestHash:request.requestHash}}};
  }
  function control(scene,action) {
    const p=scene.state.current.entitlement.payload,c=f.payload("pos-control-vendor-suspend");
    Object.assign(c,{tokenId:f.bytes(name()),licenseId:p.licenseId,activationId:p.activationId,issuedAt:now,notBefore:now,notAfter:now+86400n,
      effectiveAt:now,controlRevision:scene.state.control.revision+1n,reasonCode:1n,action});
    advance(scene,{kind:"IMPORT_CONTROL",encoded:f.sign("offline-control",c)});
  }

  const anchor={bootId:boot,monotonicMs:1000n,trustedUtc:now};
  for(const [label,offset,expected] of [["back-small",-300n,undefined],["back-large",-301n,"CLOCK_ROLLBACK"],
    ["forward-small",300n,undefined],["forward-large",301n,"CLOCK_FORWARD_JUMP"]]) test(`LIC-TIME-${label}`,()=>{
    const r=core.observeLicenseClockV1(now,anchor,observation(now+offset));assert.equal(r.issue,expected);
    if(expected)assert.equal(r.trustedUtc,now);else assert(r.trustedUtc>=now);
  });
  test("LIC-TIME-monotonic-progress-includes-sleep",()=>{
    const elapsed=86400n,r=core.observeLicenseClockV1(now,anchor,observation(now+elapsed,1000n+elapsed*1000n));
    assert.equal(r.issue,undefined);assert.equal(r.trustedUtc,now+elapsed);
  });
  test("LIC-TIME-monotonic-rollback",()=>assert.equal(core.observeLicenseClockV1(now,anchor,observation(now,999n)).issue,"MONOTONIC_EVIDENCE_LOST"));
  test("LIC-TIME-subsecond-observations-cannot-freeze-time",()=>{
    let highWater=now,current=anchor;
    for(let i=1n;i<=8n;i++){const r=core.observeLicenseClockV1(highWater,current,observation(now,1000n+i*250n));
      assert.equal(r.issue,undefined);highWater=r.trustedUtc;current=r.anchor;}
    assert.equal(highWater,now+2n);
  });
  test("LIC-TIME-restart-preserves-anchor",()=>assert.equal(core.observeLicenseClockV1(now,anchor,observation(now+20n,21000n)).trustedUtc,now+20n));
  test("LIC-TIME-reboot-retains-high-water-and-finite-expiry",()=>{
    const scene=fresh("OFFLINE_BOUND",false),end=scene.state.current.entitlement.payload.graceUntil;
    advance(scene,{kind:"OBSERVE_TIME",observation:observation(end,0n,bootB),incident:incident()});assert.equal(effective(scene),"EXPIRED_LOCKED");
    assert.equal(core.observeLicenseClockV1(now,anchor,observation(now-301n,0n,bootB)).issue,"CLOCK_ROLLBACK");
  });
  for(const invalid of [-1n,NaN,1,"1",253402300800n])test(`LIC-TIME-invalid-utc-${String(invalid)}-${typeof invalid}`,()=>{
    assert.throws(()=>core.observeLicenseClockV1(now,anchor,observation(invalid)));
  });
  test("LIC-TIME-forward-incident-does-not-poison-high-water",()=>{
    const scene=fresh("OFFLINE_BOUND",false);advance(scene,{kind:"OBSERVE_TIME",observation:observation(now+99999n),incident:incident()});
    assert.equal(scene.state.clockHighWater,now);assert.equal(effective(scene),"RECOVERY_REQUIRED");assert.equal(scene.state.tamperLatched,false);
  });
  test("LIC-TIME-correction-atomic-and-read-only-retry",()=>{
    const scene=fresh(),item=correction(scene),before=scene.state;
    assert.equal(scene.machine.timeCorrectionReceipt(before,item.encoded),"NOT_APPLIED");advance(scene,item.command);
    assert.equal(scene.state.clockHighWater,item.payload.correctedUtc);assert.equal(scene.state.timeCorrectionRevision,1n);
    assert.equal(scene.state.consumedRequests.length,before.consumedRequests.length+1);assert.equal(effective(scene),"ACTIVE");
    const after=scene.state,saved=dump(after);
    for(let i=0;i<3;i++)assert.equal(scene.machine.timeCorrectionReceipt(after,item.encoded),"ALREADY_APPLIED");
    assert.equal(scene.state,after);assert.equal(dump(after),saved);reject(scene,item.command,"TIME_CORRECTION_REPLAYED");
    const changed=new Uint8Array(item.encoded);changed[changed.length-1]^=1;
    assert.equal(scene.machine.timeCorrectionReceipt(after,changed),"NOT_APPLIED");
  });
  test("LIC-TIME-locked-observations-do-not-invalidate-outstanding-request",()=>{
    const scene=fresh(),item=correction(scene),before=scene.state;
    const result=scene.machine.transition(before,{kind:"OBSERVE_TIME",observation:observation(now+99999n,1500n),incident:incident()},now);
    assert(result.ok);assert.equal(result.decision,"IDEMPOTENT");assert.equal(result.state,before);
    advance(scene,item.command);assert.equal(effective(scene),"ACTIVE");
  });
  test("LIC-TIME-correction-preserves-tamper",()=>{
    const scene=fresh(),g=scene.state.stateGeneration;
    advance(scene,{kind:"INTEGRITY_INCIDENT",incident:incident(),evidence:["SEALED_PROGRAMDATA","SEALED_REGISTRY"].map(protectionDomain=>({protectionDomain,observedGeneration:g-1n,protectedHighWater:g}))});
    advance(scene,correction(scene).command);assert.equal(effective(scene),"TAMPER_LOCKED");
  });
  test("LIC-TIME-correction-below-high-water-rejected",()=>{
    const scene=fresh(),item=correction(scene,{correctedUtc:now-1n});reject(scene,item.command,"TIME_CORRECTION_BELOW_HIGH_WATER","CLAIMS");
  });
  for(const [action,expected] of [["SUSPEND","SUSPENDED_LOCKED"],["REVOKE","REVOKED_LOCKED"]])test(`LIC-TIME-correction-preserves-${action}`,()=>{
    const scene=fresh();control(scene,action);advance(scene,correction(scene).command);assert.equal(effective(scene),expected);
  });
  test("LIC-TIME-correction-preserves-independent-recovery",()=>{
    const scene=fresh();advance(scene,{kind:"INTEGRITY_INCIDENT",incident:incident()});advance(scene,correction(scene).command);
    assert.equal(effective(scene),"RECOVERY_REQUIRED");assert.equal(scene.state.timeIncident,undefined);assert(scene.state.incident);
  });
  test("LIC-TIME-correction-cannot-renew-expired-entitlement",()=>{
    const scene=fresh(),end=scene.state.current.entitlement.payload.graceUntil;
    advance(scene,correction(scene,{issuedAt:end,correctedUtc:end,notBefore:end,notAfter:end+3600n}).command);
    assert.equal(effective(scene),"EXPIRED_LOCKED");
  });
  test("LIC-TIME-offline-freshness-exact-boundary",()=>{
    const scene=fresh(),item=correction(scene,{notAfter:now+11n});reject(scene,item.command,"TIME_CORRECTION_FRESHNESS_UNPROVEN");
  });
  test("LIC-TIME-new-incident-after-reboot-invalidates-old-request",()=>{
    const scene=fresh(),old=correction(scene);advance(scene,{kind:"BEGIN_TIME_RECOVERY",observation:observation(now+90000n,0n,bootB),incident:incident()});
    reject(scene,old.command,"REQUEST_STATE_MISMATCH");
  });
  for(const [label,edit] of [["signature",bytes=>{bytes[bytes.length-1]^=1;}],["oversize",()=>{}]])test(`LIC-TIME-invalid-${label}-neutral`,()=>{
    const scene=fresh(),item=correction(scene),encoded=label==="oversize"?new Uint8Array(8193):new Uint8Array(item.encoded);edit(encoded);
    reject(scene,{...item.command,encoded},label==="oversize"?"OBJECT_TOO_LARGE":"SIGNATURE_INVALID",label==="oversize"?"PRE_DECODE":"SIGNATURE");
  });
  for(const ms of [0n,299999n,300000n,300001n])test(`LIC-TIME-online-roundtrip-${ms}`,()=>{
    const scene=fresh("HYBRID_LEASED"),item=lease(scene,true);item.command.observation.monotonicMs=1000n+ms;
    if(ms>300000n)reject(scene,item.command,"TIME_RECOVERY_ROUND_TRIP_INVALID");else {advance(scene,item.command);assert.equal(effective(scene),"ACTIVE");}
  });
  test("LIC-TIME-online-wrong-incident",()=>{
    const scene=fresh("HYBRID_LEASED"),item=lease(scene,true,{}, {incidentNonce:f.bytes("wrong",32)});
    reject(scene,item.command,"TIME_RECOVERY_INCIDENT_MISMATCH");
  });
  test("LIC-TIME-online-preserves-suspension",()=>{
    const scene=fresh("HYBRID_LEASED");control(scene,"SUSPEND");advance(scene,lease(scene,true).command);assert.equal(effective(scene),"SUSPENDED_LOCKED");
  });
  test("LIC-TIME-online-reboot-refused",()=>{
    const scene=fresh("HYBRID_LEASED"),item=lease(scene,true);item.command.observation.bootId=bootB;
    reject(scene,item.command,"TIME_RECOVERY_ROUND_TRIP_INVALID");
  });
  const records=JSON.parse(readFileSync(new URL("../../licensing/vectors/v1/coverage/malformed-expanded.json",import.meta.url),"utf8")).records
    .filter(r=>r.tokenType==="time-correction"&&r.expected.stage==="STATE");
  assert.equal(records.length,5);
  for(const record of records)test(record.id,()=>{
    descriptorIds.push(record.id);const scene=fresh();let item=correction(scene);
    switch(record.mutation.operation){
      case "reuseAcceptedTokenIdWithDifferentPayload": {
        advance(scene,item.command);advance(scene,{kind:"BEGIN_TIME_RECOVERY",observation:observation(),incident:incident()});
        item=correction(scene,{tokenId:item.payload.tokenId,issuedAt:now+10n});break;
      }
      case "setTimeCorrectionRevisionNotCurrentPlusOne":item=correction(scene,{timeCorrectionRevision:2n});break;
      case "removeMonotonicFreshnessEvidence":delete item.command.evidence;break;
      case "useIncidentWithoutPreservedSameBootEvidence":item.command.observation.bootId=bootB;break;
      case "reuseConsumedTimeCorrectionToken":advance(scene,item.command);break;
      default:assert.fail(`Unowned mutation ${record.id}`);
    }
    reject(scene,item.command,record.expected.errorCode,record.expected.stage);
  });
  assert.equal(new Set(ids).size,ids.length);assert.equal(descriptorIds.length,5);
  return { attempted:ids.length,passed:ids.length-failures.length,failures,descriptorIds };
}
