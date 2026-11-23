// Read-only closed successor-packet checks. No Windows/native operations.
import assert from 'node:assert/strict';
import { readFileSync, lstatSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const repo=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const hash=b=>createHash('sha256').update(b).digest('hex');
function plain(relative) {
  assert.match(relative,/^[A-Za-z0-9_./-]+$/);
  assert(!relative.split('/').some(x=>['','..','.'].includes(x)));
  let cursor=path.resolve(repo,relative);assert(cursor.startsWith(repo+path.sep));
  const result=cursor;
  for(;;){assert(!lstatSync(cursor).isSymbolicLink());const parent=path.dirname(cursor);if(parent===cursor)break;cursor=parent;}
  return result;
}
function parse(bytes) {
  assert(bytes.length>0&&bytes.length<=65536);
  const text=bytes.toString('utf8');const value=JSON.parse(text);
  // Require canonical JSON tokens (whitespace outside strings is permitted).
  // Duplicates, alternate number/escape encodings and malformed/trailing text
  // cannot be silently normalized by JSON.parse into an admitted packet.
  const compact=text.replace(/("(?:[^"\\]|\\.)*")|\s+/g,(match,string)=>string??'');
  assert.equal(compact,JSON.stringify(value),'Noncanonical or duplicate JSON');return value;
}
const base={path:'licensing/adapter-evidence/pilot-implementation/implementation-packet.json',sha256:'8d182ccd61ed911b1d9019a3426c6d3725cbf268e3b57cdc064544cb21aa822e'};
const references=[
  {path:'docs/licensing/plans/LICENSING_ADAPTER_PHYSICAL_PILOT_SPEC_V03.md',sha256:'dfce64538c6fd13aa0891996f9ee94b7807c9e210be3060b508b66f2e75848d6'},
  {path:'docs/licensing/reviews/LICENSING_ADAPTER_PHYSICAL_PILOT_SPEC_V03_REVIEW.md',sha256:'c9e521847cfe097767f71111685baa4d5216e5702c13d616870dfa23ee521bd4'},
  {path:'docs/licensing/plans/LICENSING_ADAPTER_PHYSICAL_PILOT_SPEC_V03_ADOPTION.md',sha256:'2ce23e0bc92bd00d1acc6751a787b18b966ac15802a95082a311a16ec7709e15'}];
const bootstrap=['VERIFY_APPROVED_HOST_AND_ALL_SOURCE_PACKAGE_KIT_PLAN_PINS','VERIFY_PLAIN_ANCESTORS_ROOT_AND_THREE_REGISTRATIONS_ABSENT',
  'VERIFY_CONTROLLER_PRIMARY_TOKEN_DEFAULT_OWNER_A_AND_ELEVATION','CREATE_NEW_PUBLIC_DIRECTORIES_WITH_EXACT_PROTECTED_DESCRIPTORS',
  'COPY_NEW_PINNED_PACKAGE_AND_AUTHORIZED_PREPARE_PLAN_VERIFY_READBACK','REGISTER_EXACT_THREE_OWN_PROCESS_MANUAL_SERVICES_NO_RECOVERY',
  'DERIVE_NUMERIC_SERVICE_SIDS_AND_REQUIRE_ROLE_SELF_VERIFICATION','START_ORDERED_PREPARE_ACTIONS_ONLY_AFTER_PREVIOUS_WORKER_COMPLETION',
  'SETUP_ENFORCES_EXACT_KEY_NAMES_CREATE_NEW_NO_OVERWRITE_RETAIN_ON_COLLISION'];
const setup=['CREATE_PRIVATE_DIRECTORIES','CREATE_EACH_INTENT_THEN_KEY_ONCE_NO_OVERWRITE','REOPEN_PERSISTED_NAME_VERIFY_POLICY_PUBLIC_IDENTITY',
  'WRITE_OWNED_RECORD_ONLY_AFTER_REOPEN','WRITE_PUBLIC_CONTROL_ONLY_AFTER_BOTH_VERIFIED','WRITE_OWN_REPORT'];
const additions=['ControllerWindows.cs','ProcessObserver.cs','BootstrapAdmission.cs'].map(x=>'licensing/adapter-evidence/pilot-runtime/'+x);
const closed=(object,keys)=>assert.deepEqual(Object.keys(object).sort(),[...keys].sort());
function validate(p,b) {
  closed(p,['schemaVersion','id','revision','scope','status','date','physicalExecutionAuthorized','independentReviewSatisfied',
    'securityAccepted','productionAccepted','implementationComplete','runtimeAuthority','durable','base','references','inheritance',
    'overrides','keyCreation','openImplementationRequirements','authorizationBoundary']);
  assert.equal(p.schemaVersion,1);assert.equal(p.id,b.id);assert.equal(p.scope,b.scope);assert.equal(p.revision,'0.2');
  assert.equal(p.status,'PRODUCT_ADOPTED_GATED_IMPLEMENTATION_NOT_BUILT');assert.equal(p.date,'2026-10-12');
  for(const key of ['physicalExecutionAuthorized','independentReviewSatisfied','securityAccepted','productionAccepted','implementationComplete','durable'])assert.equal(p[key],false);
  assert.equal(p.runtimeAuthority,'NONE');assert.deepEqual(p.base,base);assert.deepEqual(p.references,references);
  assert.equal(p.inheritance,'ALL_BASE_FIELDS_UNCHANGED_EXCEPT_EXACT_OVERRIDES');
  closed(p.overrides,['bootstrap','setupCreateOperations','proposedSourceAllowlist']);
  assert.deepEqual(p.overrides.bootstrap,bootstrap);assert.deepEqual(p.overrides.setupCreateOperations,setup);
  const expected=[...b.proposedSourceAllowlist.slice(0,9),...additions,...b.proposedSourceAllowlist.slice(9)];
  assert.deepEqual(p.overrides.proposedSourceAllowlist,expected);
  assert.deepEqual(p.keyCreation,{actor:'Setup',provider:'Microsoft Software Key Storage Provider',labels:['restricted','app-readable'],
    legacyKeySpec:0,createFlags:32,finalizeFlags:64,absenceFromOpenAllowed:false,
    onCollisionOrUnknown:'BLOCK_RETAIN_NO_RETRY_NO_ADOPT_NO_CLEANUP',ownedRecordRequires:'FINALIZE_POLICY_AND_PERSISTED_NAME_PUBLIC_IDENTITY_MATCH',
    failureBlocks:'NEXT_LABEL_PUBLICATION_STAGE_CHECKPOINT_AND_LATER_STAGES'});
  assert.deepEqual(p.openImplementationRequirements,['V03-I01','BOOTSTRAP_DISPATCH_CAPTURE_COORDINATION','SELF_CONTAINED_CUSTODY_AND_BUILT_KIT_REVIEW']);
  assert.equal(p.authorizationBoundary,'OWNER_PRODUCT_IMPLEMENTATION_DIRECTION_ONLY_NO_INDEPENDENT_OR_PHYSICAL_APPROVAL');
}
const baseBytes=readFileSync(plain(base.path));assert.equal(hash(baseBytes),base.sha256);const b=parse(baseBytes);
for(const ref of [...b.references,...references])assert.equal(hash(readFileSync(plain(ref.path))),ref.sha256,'Reference changed');
const bytes=readFileSync(plain('licensing/adapter-evidence/pilot-implementation/implementation-packet-v02.json'));
const packet=parse(bytes);validate(packet,b);for(const source of packet.overrides.proposedSourceAllowlist)plain(source);
const mutations=[p=>p.physicalExecutionAuthorized=true,p=>p.independentReviewSatisfied=true,p=>p.securityAccepted=true,
  p=>p.productionAccepted=true,p=>p.implementationComplete=true,p=>p.extra=true,p=>p.base.sha256='a'.repeat(64),
  p=>p.references.pop(),p=>p.references[0].sha256='a'.repeat(64),p=>p.overrides.extra='OVERRIDE',p=>p.overrides.bootstrap.reverse(),
  p=>p.overrides.bootstrap[1]='SKIP_ROOT_CHECK',p=>p.overrides.setupCreateOperations.reverse(),p=>p.overrides.proposedSourceAllowlist.push('../escape'),
  p=>p.keyCreation.createFlags=160,p=>p.keyCreation.finalizeFlags=64|8,p=>p.keyCreation.actor='Controller',
  p=>p.keyCreation.absenceFromOpenAllowed=true,p=>p.keyCreation.onCollisionOrUnknown='RETRY',
  p=>p.keyCreation.ownedRecordRequires='HANDLE_ONLY',p=>p.openImplementationRequirements.shift()];
for(const mutate of mutations){const changed=structuredClone(packet);mutate(changed);assert.throws(()=>validate(changed,b));}
for(const invalid of ['{"x":1,"x":2}','{"x":{"y":1,"y":2}}','{"x":1} trailing'])assert.throws(()=>parse(Buffer.from(invalid)));
console.log(`PASS: successor packet0.2; base plus 7 reference pins; 16 proposed sources; ${mutations.length+3} negative checks.`);
console.log(`Packet SHA256: ${hash(bytes)}`);
console.log('GATED_IMPLEMENTATION_DIRECTION_ONLY; independent review false, physical/native/security acceptance false.');
