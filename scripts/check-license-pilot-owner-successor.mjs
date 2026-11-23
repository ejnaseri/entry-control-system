import {activePin} from './check-license-pilot-isolation.mjs';
// Read-only owner successor checks. No runtime packet switch or native operation.
import assert from 'node:assert/strict';
import {readFileSync,lstatSync} from 'node:fs';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const repo=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const expected={
  "schemaVersion": 1,
  "id": "ADAPTER-PILOT-IMPLEMENTATION-01",
  "revision": "0.3",
  "scope": "TEST_ONLY_SOFTWARE_KSP_ADAPTER_EVIDENCE_V1",
  "status": "PRODUCT_ADOPTED_GATED_OWNER_JOURNAL_DIRECTION_NOT_BUILT",
  "date": "2026-10-12",
  "productImplementationDirectionAdopted": true,
  "physicalExecutionAuthorized": false,
  "independentReviewSatisfied": false,
  "nativeOwnerAuthenticated": false,
  "durableReplayTested": false,
  "securityAccepted": false,
  "productionAccepted": false,
  "implementationComplete": false,
  "runtimeAuthority": "NONE",
  "durable": false,
  "base": {
    "path": "licensing/adapter-evidence/pilot-implementation/implementation-packet-v02.json",
    "sha256": "73235a629ff81da4ac611b97d9c2e1c8999d4f8312c24e4f4b93cc823a564a14"
  },
  "references": [
    {
      "path": "licensing/adapter-evidence/pilot-implementation/owner-authority-contract-v01.json",
      "sha256": "a4537539bdeda1fcf60e2c52799cf91b75c8f1906dc97fece11ddbeaf99d8983"
    },
    {
      "path": "docs/licensing/reviews/LICENSING_PILOT_OWNER_AUTHORITY_REVIEW.md",
      "sha256": "9dab34bceae8a2c81647813f8f01407f1362801e18e1787882abc79b7c2c1e04"
    },
    {
      "path": "docs/licensing/plans/LICENSING_PILOT_OWNER_AUTHORITY_ADOPTION.md",
      "sha256": "caa9d9a28598d277c3372ae60cf133a802bdebff7fc7f8f3606fd0b111a9ad9e"
    }
  ],
  "inheritance": "ALL_V02_FIELDS_UNCHANGED_EXCEPT_EXACT_OVERRIDES",
  "overrides": {
    "bootstrap": [
      "VERIFY_APPROVED_HOST_AND_ALL_SOURCE_PACKAGE_KIT_PLAN_AND_OWNER_CONTEXT_PINS",
      "VERIFY_PLAIN_ANCESTORS_ROOT_AND_THREE_REGISTRATIONS_ABSENT",
      "VERIFY_CONTROLLER_PRIMARY_TOKEN_DEFAULT_OWNER_A_ELEVATION_AND_EXACT_OWNER_USER",
      "REQUIRE_EXPLICIT_LIVE_CONSOLE_OWNER_CONFIRMATION_AND_RECHECK_FROZEN_CONTEXT",
      "CREATE_NEW_ROOT_AND_CONTROLLER_DIRECTORY_ONLY_WITH_EXACT_PROTECTED_DESCRIPTORS",
      "CREATE_NEW_PREPARE_CONSUMED_SLOT_FLUSH_CLOSE_AND_INDEPENDENT_PROTECTED_READBACK",
      "CREATE_REMAINING_ORIGINAL_PUBLIC_DIRECTORIES_COPY_PACKAGE_PLAN_VERIFY_READBACK",
      "REGISTER_EXACT_THREE_OWN_PROCESS_MANUAL_SERVICES_NO_RECOVERY",
      "DERIVE_NUMERIC_SERVICE_SIDS_AND_REQUIRE_ROLE_SELF_VERIFICATION",
      "START_ORDERED_PREPARE_ONLY_WITH_PRIVATE_LIVE_RESERVATION_PROOF_AND_OWNER_RECHECK",
      "SETUP_ENFORCES_EXACT_KEY_NAMES_CREATE_NEW_NO_OVERWRITE_RETAIN_ON_COLLISION"
    ],
    "controllerFileAdditions": [
      "controller/owner-prepare-consumed.json",
      "controller/owner-fresh-process-consumed.json",
      "controller/owner-finish-consumed.json"
    ],
    "addedFileRule": {
      "creator": "Controller",
      "owner": "S-1-5-32-544",
      "protected": true,
      "inheritance": false,
      "aces": [
        {
          "sid": "S-1-5-18",
          "mask": 2032127
        },
        {
          "sid": "S-1-5-32-544",
          "mask": 2032127
        }
      ]
    },
    "ownerAuthorityContractSha256": "a4537539bdeda1fcf60e2c52799cf91b75c8f1906dc97fece11ddbeaf99d8983",
    "stageReservation": "ALL_THREE_STAGES_CREATE_NEW_SLOT_BEFORE_SERVICE_KEY_OPERATIONS_REQUIRE_PRIOR_SLOTS_AND_COMPLETED_CHAIN",
    "proof": "PRIVATE_DIRECT_NATIVE_READBACK_ONLY_NO_DTO_OR_POST_RESTART_RECONSTRUCTION"
  },
  "openImplementationRequirements": [
    "TRUSTED_OWNER_CONTEXT_AND_LIVE_CONFIRMATION_PRODUCER",
    "CLOSED_CONSUMED_SCHEMA_AND_PROTECTED_FILE_RULES",
    "CREATE_NEW_FLUSH_READBACK_PRIVATE_RESERVATION_PROOF",
    "PREPARE_BOOTSTRAP_AND_FRESH_FINISH_COORDINATION",
    "RESTART_REPLAY_AND_AMBIGUOUS_WRITE_TESTS",
    "SELF_CONTAINED_CUSTODY_AND_BUILT_KIT_REVIEW",
    "OUTSTANDING_INDEPENDENT_AND_NATIVE_ACCEPTANCE"
  ],
  "authorizationBoundary": "OWNER_PRODUCT_IMPLEMENTATION_DIRECTION_ONLY_NO_HOST_KIT_STAGE_OR_PHYSICAL_APPROVAL"
};
const hash=b=>createHash('sha256').update(b).digest('hex');
function plain(relative){
  assert.match(relative,/^[A-Za-z0-9_./-]+$/);
  assert(!relative.split('/').some(x=>['','..','.'].includes(x)));
  let cursor=path.resolve(repo,relative);assert(cursor.startsWith(repo+path.sep));const file=cursor;
  for(;;){assert(!lstatSync(cursor).isSymbolicLink());const next=path.dirname(cursor);if(next===cursor)break;cursor=next;}
  return file;
}
function parse(bytes){
  assert(bytes.length>0&&bytes.length<=65536);
  const text=bytes.toString('utf8'),value=JSON.parse(text);
  const compact=text.replace(/("(?:[^"\\]|\\.)*")|\s+/g,(match,string)=>string??'');
  assert.equal(compact,JSON.stringify(value),'Duplicate/noncanonical JSON');return value;
}
function validate(p){assert.deepEqual(p,expected,'Closed successor mismatch');}
const packetBytes=readFileSync(plain('licensing/adapter-evidence/pilot-implementation/implementation-packet-v03.json'));
const packet=parse(packetBytes);validate(packet);
const verified=new Map();
function reference(row){
  const bytes=readFileSync(plain(row.path));assert.equal(hash(bytes),row.sha256,'Reference changed');
  if(verified.has(row.path)){assert.equal(verified.get(row.path),row.sha256);return;}
  verified.set(row.path,row.sha256);
  if(row.path.endsWith('.json')){
    const value=parse(bytes);if(value.base)reference(value.base);
    for(const child of value.references??[])reference(child);
  }
}
reference(packet.base);for(const row of packet.references)reference(row);
const base=parse(readFileSync(plain(packet.base.path)));
const contract=parse(readFileSync(plain(packet.references[0].path)));
assert.deepEqual(packet.overrides.controllerFileAdditions,contract.records);
assert.deepEqual(packet.overrides.addedFileRule,contract.acl);
assert.equal(packet.overrides.ownerAuthorityContractSha256,hash(readFileSync(plain(packet.references[0].path))));
assert.equal(base.keyCreation.createFlags,32);assert.equal(base.keyCreation.finalizeFlags,64);
for(const source of base.overrides.proposedSourceAllowlist)plain(source);
// Only preserved0.2 or this adopted0.3 may be the gated runtime direction.
const program=readFileSync(plain('licensing/adapter-evidence/pilot-runtime/Program.cs'),'utf8');
const runtimePin=program.match(/SuccessorPacketSha256="([a-f0-9]{64})"/)?.[1];
const v04Pin='c25920687086f0ade2d90486aa02556212a5172e12b423df02ee0650ca69bd7b';
if(runtimePin===v04Pin)assert.equal(hash(readFileSync(plain('licensing/adapter-evidence/pilot-implementation/implementation-packet-v04.json'))),v04Pin);
assert([packet.base.sha256,hash(packetBytes),v04Pin,activePin].includes(runtimePin),'Unexpected runtime pin switch');
let negatives=0;
function refuse(fn){assert.throws(fn);negatives++;}
const edits=[
  p=>{p.extra=true},p=>{delete p.base},p=>{p.revision='0.2'},p=>{p.productImplementationDirectionAdopted=false},
  ...['physicalExecutionAuthorized','independentReviewSatisfied','nativeOwnerAuthenticated','durableReplayTested',
    'securityAccepted','productionAccepted','implementationComplete','durable'].map(k=>p=>{p[k]=true}),
  p=>{p.runtimeAuthority='PRODUCTION'},p=>{p.base.sha256='a'.repeat(64)},
  p=>{p.references.pop()},p=>{p.references[0].sha256='a'.repeat(64)},
  p=>{p.overrides.bootstrap.reverse()},p=>{p.overrides.controllerFileAdditions[0]='../escape'},
  p=>{p.overrides.controllerFileAdditions.push('controller/extra.json')},
  p=>{p.overrides.addedFileRule.owner='S-1-5-18'},p=>{p.overrides.addedFileRule.aces[0].mask=1},
  p=>{p.overrides.addedFileRule.inheritance=true},p=>{p.overrides.stageReservation='OPTIONAL'},
  p=>{p.overrides.proof='CALLER_DTO'},p=>{p.overrides.extra='OVERRIDE'},
  p=>{p.openImplementationRequirements.shift()},p=>{p.authorizationBoundary='PHYSICAL_ALLOWED'}
];
for(const edit of edits){const changed=structuredClone(packet);edit(changed);refuse(()=>validate(changed));}
for(const bad of ['{"x":1,"x":2}','{"x":{"y":1,"y":2}}','{} trailing'])refuse(()=>parse(Buffer.from(bad)));
refuse(()=>plain('../escape'));refuse(()=>parse(Buffer.alloc(65537)));
const escaped={note:'quote" and space',path:'a\\b'};
assert.deepEqual(parse(Buffer.from(JSON.stringify(escaped,null,2))),escaped);
console.log('PASS: preserved successor0.3, '+verified.size+' transitive reference pins, '+negatives+' negative checks; runtime pin '+(runtimePin===activePin?'0.5':runtimePin===v04Pin?'0.4':runtimePin===packet.base.sha256?'0.2':'0.3')+'.');
console.log('Packet SHA256: '+hash(packetBytes));
console.log('IMPLEMENTATION_DIRECTION_ONLY; physical/independent/native/durable/security acceptance false.');
