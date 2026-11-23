import assert from "node:assert/strict";
import { createLicenseStateFixtures } from "./license-state-fixtures.mjs";

const equal = (a, b) => Buffer.from(a).equals(Buffer.from(b));
const data = value => JSON.stringify(value, (_, v) => typeof v === "bigint" ? `${v}n` : v instanceof Uint8Array ? Buffer.from(v).toString("hex") : v);

export function runLicenseStateModelTests(production) {
  const failures = [], ids = [];
  const test = (id, run) => { ids.push(id); try { run(); } catch (e) { failures.push({ id, message: e.stack ?? String(e) }); } };
  const f = createLicenseStateFixtures(production), now = f.now;
  const machine = () => production.core.createLicenseStateMachineV1(f.configuration);
  const pass = (m, state, command, at = now) => {
    const before = data(state), input = data(command);
    const r = m.transition(state, command, at);
    assert.equal(data(state), before, "input state mutated"); assert.equal(data(command), input, "command mutated");
    assert(r.ok, `${r.stage}/${r.errorCode}`);
    assert.equal(r.authoritativeStateChanged, false); assert.equal(r.requestConsumed, false);
    if (r.decision === "PROPOSED") {
      assert.equal(r.state.stateGeneration, state.stateGeneration + 1n);
      assert(equal(r.state.previousStateHash, state.stateHash));
      assert(equal(r.expectedPreviousHash, state.stateHash));
      assert.equal(r.expectedPreviousGeneration, state.stateGeneration);
    }
    return r.state;
  };
  const fail = (m, s, c, code, at = now) => {
    const before = data(s), command = data(c), r = m.transition(s, c, at);
    assert.equal(r.ok, false, code); if (code) assert.equal(r.errorCode, code);
    assert.equal(r.state, s); assert.equal(data(s), before); assert.equal(data(c), command);
    assert.equal(r.authoritativeStateChanged, false); assert.equal(r.requestConsumed, false);
  };
  const initial = (m, options = {}) => {
    const a = f.initialActivation(options); return { a, s: pass(m, m.initial(), a.command, a.now) };
  };
  const renew = (s, changes = {}, at = now, label = `renew-${s.stateGeneration}`) => {
    const base = s.pending?.entitlement.payload ?? s.current.entitlement.payload;
    const requestPayload = f.payload("pos-activation-renew");
    Object.assign(requestPayload, {
      requestId: f.bytes(`${label}-req`), requestNonce: f.bytes(`${label}-nonce`, 32),
      issuedAt: at, notAfter: at + 86400n, stateGeneration: s.stateGeneration,
      entitlementGeneration: base.generation, leaseRevision: s.leaseRevision, timeCorrectionRevision: s.timeCorrectionRevision,
      controlRevision: s.control.revision, controlState: s.control.state,
      entitlementTokenId: base.tokenId, licenseId: base.licenseId, activationId: base.activationId,
      installationId: s.device.installationId, deviceKeyId: s.device.deviceKeyId,
      keyId: s.device.deviceKeyId, devicePublicKey: s.device.devicePublicKey, bindingKind: s.device.assurance,
    }); delete requestPayload.tpmEvidence;
    const request = f.requestSnapshot(f.sign("activation-request", requestPayload));
    const payload = { ...f.clone(base), tokenId: f.bytes(label), generation: base.generation + 1n,
      previousTokenId: base.tokenId, requestId: request.requestId, requestHash: request.requestHash,
      issuedAt: at, termEndsAt: base.termEndsAt + 86400n, graceUntil: base.graceUntil + 86400n,
      notAfter: base.notAfter + 86400n, warningStartsAt: base.warningStartsAt + 86400n, ...changes };
    return { kind: "IMPORT_ENTITLEMENT", encoded: f.sign("entitlement", payload), request };
  };
  const lease = (s, pair = s.pending ?? s.current, changes = {}, at = now, label = `lease-${s.stateGeneration}`) => {
    const p = pair.entitlement.payload, r = f.payload("pos-lease-request-check-in");
    Object.assign(r, { requestId: f.bytes(`${label}-req`), requestNonce: f.bytes(`${label}-nonce`, 32),
      stateGeneration: s.stateGeneration, entitlementTokenId: p.tokenId, entitlementGeneration: p.generation,
      licenseId: p.licenseId, activationId: p.activationId, installationId: s.device.installationId,
      keyId: s.device.deviceKeyId, deviceKeyId: s.device.deviceKeyId, lastLeaseRevision: s.leaseRevision,
      controlRevision: s.control.revision, controlState: s.control.state,
      controlEffectiveAt: s.control.effectiveAt, controlReasonCode: s.control.reasonCode });
    const request = f.requestSnapshot(f.sign("lease-request", r));
    const l = f.payload("pos-lease-initial-control");
    Object.assign(l, { tokenId: f.bytes(label), leaseRevision: s.leaseRevision + 1n,
      licenseId: p.licenseId, activationId: p.activationId, installationId: s.device.installationId,
      deviceKeyId: s.device.deviceKeyId, assurance: s.device.assurance, features: [...p.features],
      entitlementTokenId: p.tokenId, entitlementGeneration: p.generation,
      leaseRequestId: request.requestId, leaseRequestHash: request.requestHash,
      issuedAt: at, serverTime: at, notBefore: at, notAfter: at + p.offlineAllowanceSeconds,
      offlineUntil: [at + p.offlineAllowanceSeconds, p.notAfter, p.graceUntil].reduce((a,b)=>a<b?a:b),
      controlRevision: s.control.revision, controlState: s.control.state,
      controlEffectiveAt: s.control.effectiveAt, controlReasonCode: s.control.reasonCode, ...changes });
    if (l.notAfter > p.notAfter) l.notAfter = p.notAfter;
    return { kind: "IMPORT_LEASE", encoded: f.sign("lease", l), request, parentTokenId: p.tokenId };
  };
  const control = (s, action, effectiveAt = now, label = `control-${s.stateGeneration}`, changes = {}) => {
    const p = (s.pending ?? s.current).entitlement.payload, c = f.payload("pos-control-vendor-suspend");
    Object.assign(c, { tokenId: f.bytes(label), licenseId: p.licenseId, activationId: p.activationId,
      issuedAt: now, notBefore: now, notAfter: now + 86400n, effectiveAt, action,
      controlRevision: s.control.revision + 1n, reasonCode: 1n, ...changes });
    return { kind: "IMPORT_CONTROL", encoded: f.sign("offline-control", c) };
  };
  const assertState = (m,s,state,at=now) => { const p=m.project(s,at); assert.equal(p.state,state); assert.equal(p.runtimeAuthority,"NONE"); };

  for (const edition of ["FULL", "ATTENDANCE"]) for (const mode of ["OFFLINE_BOUND", "HYBRID_LEASED"]) {
    test(`LIC-STATE-initial-${edition}-${mode}`, () => {
      const fixtures=createLicenseStateFixtures(production,{edition}),m=production.core.createLicenseStateMachineV1(fixtures.configuration);
      const s=m.initial(); assertState(m,s,"UNLICENSED");
      const a=fixtures.initialActivation({mode}); const next=pass(m,s,a.command);
      assert.equal(next.entitlementGeneration,1n);
      assertState(m,next,mode==="OFFLINE_BOUND"?"ACTIVE":"UNLICENSED");
      assert.equal(next.consumedRequests.length,1);
      const repeat=m.transition(next,a.command,now); assert.equal(repeat.decision,"IDEMPOTENT"); assert.equal(repeat.state,next);
    });
  }
  for(const [name,duration] of [["daily",86400n],["weekly",604800n],["monthly",2678400n],["annual",31622400n],["custom",123456n]]) {
    test(`LIC-TIME-${name}-finite-boundaries`,()=>{
      const m=machine(),{s}=initial(m,{termSeconds:duration,warningLeadSeconds:3600n,graceSeconds:300n});
      assertState(m,s,"ACTIVE"); assertState(m,s,"EXPIRING",now+duration-3600n);
      assertState(m,s,"POST_EXPIRY_GRACE",now+duration); assertState(m,s,"EXPIRED_LOCKED",now+duration+300n);
    });
  }
  test("LIC-TIME-future-initial-and-half-open-promotion",()=>{
    const m=machine(),{s}=initial(m,{termStartsAt:now+120n});
    assertState(m,s,"UNLICENSED",now+119n); assert.equal(s.current,undefined);
    const p=pass(m,s,{kind:"REEVALUATE"},now+120n); assertState(m,p,"ACTIVE",now+120n);
  });
  test("LIC-STATE-future-renewal-does-not-replace-active",()=>{
    const m=machine(),{s}=initial(m);const c=renew(s,{termStartsAt:now+120n});const p=pass(m,s,c);
    assert(equal(p.current.entitlement.hash,s.current.entitlement.hash)); assert.equal(p.pending.entitlement.payload.generation,2n);
    assertState(m,p,"ACTIVE",now+119n);
    const n=pass(m,p,{kind:"REEVALUATE"},now+120n); assert.equal(n.current.entitlement.payload.generation,2n); assert.equal(n.pending,undefined);
  });
  test("LIC-ROLLBACK-highest-pending-lineage-chain",()=>{
    const m=machine(),{s}=initial(m);const p=pass(m,s,renew(s,{termStartsAt:now+120n}));
    const q=pass(m,p,renew(p,{termStartsAt:now+240n}));
    assert.equal(q.entitlementGeneration,3n); assert.equal(q.current.entitlement.payload.generation,1n);assert.equal(q.pending.entitlement.payload.generation,3n);
    const promoted=pass(m,q,{kind:"REEVALUATE"},now+240n);assert.equal(promoted.current.entitlement.payload.generation,3n);
  });
  for(const [label,change] of [["features",p=>({features:p.features.slice(1)})], ["end",p=>({termEndsAt:p.termEndsAt-1n,warningStartsAt:p.warningStartsAt-1n,graceUntil:p.graceUntil-1n})],
    ["version",()=>({minimumProductVersion:"1.0.0+new" ,maximumMajorVersion:0n})]]) {
    test(`LIC-STATE-no-shortening-${label}`,()=>{const m=machine(),{s}=initial(m);fail(m,s,renew(s,change(s.current.entitlement.payload)),label==="version"?undefined:"ENTITLEMENT_AUTHORIZATION_SHORTENED");});
  }
  test("LIC-STATE-adjacent-not-overlapping-before-lapse",()=>{
    const m=machine(),{s}=initial(m),p=s.current.entitlement.payload;
    const next={termStartsAt:p.graceUntil,termEndsAt:p.graceUntil+86400n,warningStartsAt:p.graceUntil,warningLeadSeconds:86400n,
      graceUntil:p.graceUntil+86400n+p.graceSeconds,notAfter:p.graceUntil+86400n+p.graceSeconds+86400n};
    fail(m,s,renew(s,next),"ENTITLEMENT_AUTHORIZATION_SHORTENED");
    const later=pass(m,s,renew(s,next,p.graceUntil,"lapsed"),p.graceUntil);assertState(m,later,"EXPIRING",p.graceUntil);
  });
  test("LIC-HYBRID-exact-pair-and-outage-expiry",()=>{
    const m=machine(),{s}=initial(m,{mode:"HYBRID_LEASED"});const p=pass(m,s,lease(s));assertState(m,p,"ACTIVE");
    const down=pass(m,p,{kind:"NETWORK",unavailable:true});assertState(m,down,"OFFLINE_GRACE");
    assertState(m,down,"LEASE_EXPIRED_LOCKED",p.current.lease.payload.offlineUntil);
    assertState(m,down,"EXPIRED_LOCKED",p.current.entitlement.payload.graceUntil);
  });
  test("LIC-HYBRID-renewal-half-pair-retains-old",()=>{
    const m=machine(),{s}=initial(m,{mode:"HYBRID_LEASED"});const p=pass(m,s,lease(s));const q=pass(m,p,renew(p,{termStartsAt:now+120n}));
    const at=pass(m,q,{kind:"REEVALUATE"},now+120n);assert(equal(at.current.entitlement.hash,p.current.entitlement.hash));
    const n=pass(m,at,lease(at,at.pending,{},now+120n),now+120n);assert.equal(n.current.entitlement.payload.generation,2n);assert.equal(n.pending,undefined);
  });
  test("LIC-HYBRID-future-current-lease-staging",()=>{
    const m=machine(),{s}=initial(m,{mode:"HYBRID_LEASED"});const p=pass(m,s,lease(s));const c=lease(p,p.current,{},now+120n);
    const q=pass(m,p,c);assert(equal(q.current.lease.hash,p.current.lease.hash));assert(q.pendingCurrentLease);
    const at=pass(m,q,{kind:"REEVALUATE"},now+120n);assert.equal(at.current.lease.payload.leaseRevision,2n);assert.equal(at.pendingCurrentLease,undefined);
  });
  test("LIC-STATE-scheduled-control-preserves-effective-suspend",()=>{
    const m=machine(),{s}=initial(m);const suspended=pass(m,s,control(s,"SUSPEND"));const scheduled=pass(m,suspended,control(suspended,"UNSUSPEND",now+120n));
    assertState(m,scheduled,"SUSPENDED_LOCKED",now+119n);assertState(m,scheduled,"ACTIVE",now+120n);
  });
  test("LIC-STATE-future-lease-unsuspend-cannot-authorize-early",()=>{
    const m=machine(),{s}=initial(m,{mode:"HYBRID_LEASED"}),p=pass(m,s,lease(s));const suspended=pass(m,p,control(p,"SUSPEND"));
    const c=lease(suspended,suspended.current,{controlRevision:2n,controlState:"OPERATIONAL",controlReasonCode:1n,controlEffectiveAt:now},now+120n);
    const q=pass(m,suspended,c);assertState(m,q,"SUSPENDED_LOCKED",now+119n);
    const at=pass(m,q,{kind:"REEVALUATE"},now+120n);assertState(m,at,"ACTIVE",now+120n);
  });
  test("LIC-ROLLBACK-scheduled-revoke-not-suppressed",()=>{
    const m=machine(),{s}=initial(m);const r=pass(m,s,control(s,"REVOKE",now+200n));const q=pass(m,r,control(r,"SUSPEND",now+100n));
    assertState(m,q,"ACTIVE",now+99n);assertState(m,q,"SUSPENDED_LOCKED",now+100n);assertState(m,q,"REVOKED_LOCKED",now+200n);
    fail(m,r,control(r,"UNSUSPEND",now+100n),"TERMINAL_REVOCATION");
    const direct=pass(m,q,{kind:"REEVALUATE"},now+300n),step=pass(m,pass(m,q,{kind:"REEVALUATE"},now+100n),{kind:"REEVALUATE"},now+300n);
    assert.equal(data(direct.tombstones),data(step.tombstones));
  });
  test("LIC-STATE-equal-control-revision-retains-first-eligibility",()=>{
    const m=machine(),{s}=initial(m,{mode:"HYBRID_LEASED"}),p=pass(m,s,lease(s));
    const suspended=pass(m,p,control(p,"SUSPEND"));
    const future=pass(m,suspended,lease(suspended,suspended.current,{controlRevision:2n,controlState:"OPERATIONAL",controlReasonCode:1n,controlEffectiveAt:now},now+120n));
    const earlier=pass(m,future,lease(future,future.current));
    assert.equal(data(earlier.controlHistory),data(future.controlHistory));
    assertState(m,earlier,"SUSPENDED_LOCKED",now+119n);assertState(m,earlier,"ACTIVE",now+120n);
  });
  test("LIC-STATE-control-survives-carrier-expiration-and-renewal",()=>{
    const m=machine(),{s}=initial(m),c=control(s,"SUSPEND",now,"short-control",{notAfter:now+60n});
    const suspended=pass(m,s,c),renewed=pass(m,suspended,renew(suspended,{},now+61n),now+61n);
    assertState(m,renewed,"SUSPENDED_LOCKED",now+61n);
    assert.equal(data(renewed.controlHistory),data(suspended.controlHistory));
  });
  test("LIC-ROLLBACK-multiple-revoke-polling-independent-tombstone",()=>{
    const m=machine(),{s}=initial(m);const r=pass(m,s,control(s,"REVOKE",now+200n));const q=pass(m,r,control(r,"REVOKE",now+100n));
    const early=pass(m,q,{kind:"REEVALUATE"},now+100n),late=pass(m,q,{kind:"REEVALUATE"},now+300n);
    assert.equal(data(early.tombstones),data(late.tombstones));assert.equal(late.tombstones[0].finalControlRevision,2n);
  });
  test("LIC-STATE-expired-retries-do-not-reopen",()=>{
    const m=machine(),{s,a}=initial(m),at=s.current.entitlement.payload.notAfter;
    const r=m.transition(s,a.command,at);assert.equal(r.ok,true);assert.equal(r.decision,"IDEMPOTENT");assert.equal(r.state,s);assertState(m,s,"EXPIRED_LOCKED",at);
  });
  test("LIC-STATE-revoked-control-retry-only-final-revoke",()=>{
    const m=machine(),{s}=initial(m),suspend=control(s,"SUSPEND");
    const suspended=pass(m,s,suspend),revoke=control(suspended,"REVOKE"),revoked=pass(m,suspended,revoke);
    fail(m,revoked,suspend,"TERMINAL_REVOCATION");
    const retry=m.transition(revoked,revoke,now);assert(retry.ok);assert.equal(retry.decision,"IDEMPOTENT");assert.equal(retry.state,revoked);
  });
  test("LIC-STATE-forged-state-and-invalid-clock-fail-closed",()=>{
    const m=machine(),{s}=initial(m); fail(m,{...s},{kind:"REEVALUATE"},"UNTRUSTED_MODEL_STATE");
    for(const t of [-1n,Number(now),"1800001000",NaN,253402300800n])fail(m,s,{kind:"REEVALUATE"},"INVALID_TRUSTED_TIME",t);
    fail(m,s,{kind:"REEVALUATE"},"TRUSTED_TIME_BELOW_HIGH_WATER",now-1n);
    assert.throws(()=>m.project({...s},now),e=>e.code==="UNTRUSTED_MODEL_STATE");
  });
  test("LIC-STATE-oversize-command-rejected-before-copy-or-hash",()=>{
    const m=machine(),s=m.initial();
    for(const kind of ["IMPORT_ENTITLEMENT","IMPORT_LEASE","IMPORT_CONTROL","RECOVER"]){
      const r=m.transition(s,{kind,encoded:new Uint8Array(131073)},now);
      assert.equal(r.ok,false);assert.equal(r.stage,"PRE_DECODE");assert.equal(r.errorCode,"OBJECT_TOO_LARGE");assert.equal(r.state,s);
    }
    const r=m.transition(s,{kind:"REACTIVATE",authorization:new Uint8Array(16385)},now);
    assert.equal(r.ok,false);assert.equal(r.stage,"PRE_DECODE");assert.equal(r.errorCode,"OBJECT_TOO_LARGE");assert.equal(r.state,s);
  });
  test("LIC-STATE-defensive-copy-and-determinism",()=>{
    const m=machine(),state=m.initial(),a=f.initialActivation();const p=m.transition(state,a.command,now),q=m.transition(state,a.command,now);
    assert(p.ok&&q.ok);assert.equal(data(p.state),data(q.state));const before=data(p.state);
    p.expectedPreviousHash.fill(0);assert(equal(p.expectedPreviousHash,state.stateHash));
    p.state.stateHash.fill(0);p.state.current.entitlement.payload.deviceKeyId.fill(0);a.command.encoded.fill(0);
    assert.equal(data(p.state),before);assertState(m,p.state,"ACTIVE");
    assert.throws(()=>{p.state.current.entitlement.payload.generation=100n;},TypeError);
  });
  test("LIC-STATE-atomic-pair-crash-and-cas-model",()=>{
    const m=machine(),{s}=initial(m,{mode:"HYBRID_LEASED"}),command=lease(s),proposal=m.transition(s,command,now);
    assert(proposal.ok);const oldHash=data(s.stateHash),newHash=data(proposal.state.stateHash);
    assert.equal(proposal.commitObligations[0],"COMPARE_PREVIOUS_GENERATION_AND_HASH");
    // Store double: staging/flush has no authority. Only whole-record replace can
    // select new state. Anchor disagreement is restricted, never guessed old/new.
    for(const cut of [0,1,2,3,4]){
      const disk=cut>=3?proposal.state:s,anchor=cut>=4?proposal.state.stateHash:s.stateHash;
      const reconciled=equal(disk.stateHash,anchor)?disk:null;
      if(reconciled){assert([oldHash,newHash].includes(data(reconciled.stateHash)));
        assert.equal(Boolean(reconciled.current),reconciled.consumedRequests.length===2);
        assertState(m,reconciled,reconciled.current?"ACTIVE":"UNLICENSED");
      }else assert.equal(cut,3);
    }
    const competing=m.transition(s,lease(s,s.pending,{},now,"concurrent-lease"),now);assert(competing.ok);
    assert(equal(competing.expectedPreviousHash,proposal.expectedPreviousHash));
    assert(!equal(proposal.state.stateHash,competing.state.stateHash));
    assert(!equal(proposal.state.stateHash,competing.expectedPreviousHash),"stale proposal cannot CAS onto winner");
    fail(m,{...proposal.state,current:{entitlement:s.pending.entitlement}},{kind:"REEVALUATE"},"UNTRUSTED_MODEL_STATE");
  });
  assert.equal(new Set(ids).size,ids.length);
  return { attempted:ids.length,passed:ids.length-failures.length,failures };
}
