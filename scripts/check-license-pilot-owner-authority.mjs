// Read-only proposal validator. No runtime adoption, protected writes or native calls.
import assert from 'node:assert/strict';
import {readFileSync,lstatSync} from 'node:fs';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const repo=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const expected={
  "schemaVersion": 1,
  "id": "ADAPTER-PILOT-OWNER-AUTHORITY-01",
  "revision": "0.1",
  "scope": "TEST_ONLY_OWNER_AUTHORITY_PROPOSAL_V1",
  "status": "AUTHOR_FINAL_PROPOSAL_ADOPTION_PENDING_NOT_IMPLEMENTED",
  "base": {
    "path": "licensing/adapter-evidence/pilot-implementation/implementation-packet-v02.json",
    "sha256": "73235a629ff81da4ac611b97d9c2e1c8999d4f8312c24e4f4b93cc823a564a14"
  },
  "references": [
    {
      "path": "docs/licensing/plans/LICENSING_PILOT_OWNER_AUTHORITY_PLAN.md",
      "sha256": "36cd7081505f0b5ddc616939f2ecc110ed6629e7845f87c3f2d23578410c77b1"
    },
    {
      "path": "docs/licensing/reviews/LICENSING_PILOT_OWNER_CONNECTION_REVIEW.md",
      "sha256": "6c99cc75806f28a4947adf9d8fff5a4a2359f2a0b572db1c2da70ae5392ad28a"
    }
  ],
  "gates": {
    "productAdopted": false,
    "physicalExecutionAuthorized": false,
    "independentReviewSatisfied": false,
    "nativeOwnerAuthenticated": false,
    "durableReplayTested": false,
    "securityAccepted": false,
    "productionAccepted": false,
    "implementationComplete": false,
    "runtimeAuthority": "NONE"
  },
  "records": [
    "controller/owner-prepare-consumed.json",
    "controller/owner-fresh-process-consumed.json",
    "controller/owner-finish-consumed.json"
  ],
  "acl": {
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
  "schema": {
    "maxBytes": 2097152,
    "maxDepth": 12,
    "allFieldsRequired": true,
    "canonical": true,
    "contextScope": "TEST_ONLY_OWNER_CONFIRMATION_CONTEXT_V1",
    "contextFields": [
      "schemaVersion",
      "scope",
      "expectedOwnerSid",
      "controllerInputSha256",
      "successorPacketSha256",
      "decisionSha256",
      "stage",
      "experimentId"
    ],
    "consumedScope": "TEST_ONLY_OWNER_STAGE_CONSUMED_V1",
    "consumedFields": [
      "schemaVersion",
      "scope",
      "stage",
      "experimentId",
      "decisionId",
      "ownerSid",
      "ownerContextSha256",
      "ownerDecisionSha256",
      "controllerInputSha256",
      "bindingSha256",
      "planSha256",
      "successorPacketSha256",
      "hostBindingSha256",
      "bootIdentity",
      "sourceManifestSha256",
      "provenanceSha256",
      "kitManifestSha256",
      "packageManifestSha256",
      "dependencyInventorySha256",
      "profileSha256",
      "previousCheckpointSha256",
      "previousEvidenceSha256",
      "reservedUtc",
      "state",
      "confirmationSha256",
      "securityAccepted",
      "productionAccepted"
    ],
    "state": "RESERVED",
    "maxDecisionHours": 24
  },
  "confirmation": {
    "authority": "LIVE_LOCAL_OWNER_EXACT_STAGE_CONFIRMATION",
    "expectedOwnerSource": "SEPARATELY_OWNER_REVIEWED_CONTEXT_PIN",
    "redirectedInputAllowed": false,
    "redirectedOutputAllowed": false,
    "challenge": "CONFIRM <stage> <experimentId> <controllerInputSha256> <ownerContextSha256>",
    "diagnosticCanAuthorize": false
  },
  "ordering": [
    "VALIDATE_CONTEXT_PINS_AND_LIVE_OWNER_PREVIEW_CONFIRMATION",
    "RECHECK_HOST_BOOT_PACKAGE_AND_OWNER",
    "PREPARE_ONLY_CREATE_NEW_ROOT_AND_CONTROLLER_DIRECTORY",
    "CREATE_NEW_STAGE_SLOT_NO_SHARING",
    "CHECK_SAME_HANDLE_WRITE_FLUSH_CLOSE",
    "INDEPENDENT_PROTECTED_BYTE_HASH_SCHEMA_READBACK",
    "RETURN_PRIVATE_LIVE_RESERVATION_PROOF",
    "COPY_PREPARE_PACKAGE_OR_START_ORDERED_STAGE"
  ],
  "retention": {
    "existingSlot": "BLOCK_RETAIN",
    "unknownIo": "BLOCK_RETAIN",
    "partialWrite": "BLOCK_RETAIN",
    "restart": "BLOCK_SAME_STAGE_NO_RECONSTRUCTION",
    "priorSlots": "REQUIRE_COMPLETED_CHAIN_AND_DISTINCT_DECISION_IDS",
    "allowOverwrite": false,
    "allowDelete": false,
    "allowResume": false,
    "allowReapprovalBypass": false,
    "allowCheckpointAsIntent": false,
    "allowDtoAsProof": false
  }
};
const sha=b=>createHash('sha256').update(b).digest('hex');
function plain(relative){
  assert.match(relative,/^[A-Za-z0-9_.\/-]+$/);
  assert(!relative.split('/').some(x=>['','..','.'].includes(x)));
  let p=path.resolve(repo,relative);assert(p.startsWith(repo+path.sep));const file=p;
  for(;;){assert(!lstatSync(p).isSymbolicLink());const next=path.dirname(p);if(next===p)break;p=next;}
  return file;
}
function parse(bytes){
  assert(bytes.length>0&&bytes.length<=65536);
  const text=bytes.toString('utf8'),value=JSON.parse(text);
  const compact=text.replace(/("(?:[^"\\]|\\.)*")|\s+/g,(match,string)=>string??'');
  assert.equal(compact,JSON.stringify(value),'Duplicate/noncanonical JSON');
  return value;
}
function validate(value){assert.deepEqual(value,expected,'Closed proposal changed');}
const file='licensing/adapter-evidence/pilot-implementation/owner-authority-contract-v01.json';
const bytes=readFileSync(plain(file));const value=parse(bytes);validate(value);
const escaped={note:'quote" and space',path:'a\\b'};
assert.deepEqual(parse(Buffer.from(JSON.stringify(escaped,null,2))),escaped);
for(const row of [value.base,...value.references])assert.equal(sha(readFileSync(plain(row.path))),row.sha256,'Pinned reference changed');
let negatives=0;
function refuse(fn){assert.throws(fn);negatives++;}
const edits=[
  p=>{p.extra=true},p=>{delete p.retention},p=>{p.status='ACCEPTED'},
  p=>{p.base.sha256='a'.repeat(64)},p=>{p.references.reverse()},
  ...Object.keys(expected.gates).filter(k=>k!=='runtimeAuthority').map(k=>p=>{p.gates[k]=true}),
  p=>{p.gates.runtimeAuthority='PRODUCTION'},p=>{p.records[0]='../escape'},
  p=>{p.records.push('controller/extra.json')},p=>{p.acl.owner='S-1-5-18'},
  p=>{p.acl.aces[0].mask=1},p=>{p.acl.inheritance=true},
  p=>{p.schema.maxBytes++},p=>{p.schema.consumedFields.reverse()},
  p=>{p.schema.state='COMPLETED'},p=>{p.confirmation.diagnosticCanAuthorize=true},
  p=>{p.confirmation.redirectedInputAllowed=true},p=>{p.ordering.reverse()},
  p=>{p.retention.allowResume=true},p=>{p.retention.allowReapprovalBypass=true},
  p=>{p.retention.allowOverwrite=true},p=>{p.retention.allowDtoAsProof=true}
];
for(const edit of edits){const changed=structuredClone(value);edit(changed);refuse(()=>validate(changed));}
refuse(()=>parse(Buffer.from('{"x":1,"x":1}')));
refuse(()=>parse(Buffer.from('{} trailing')));
refuse(()=>parse(Buffer.alloc(65537)));
refuse(()=>plain('../escape'));
console.log('PASS: closed owner-authority proposal, 3 pinned references, '+negatives+' negative checks.');
console.log('Proposal SHA256: '+sha(bytes));
console.log('ADOPTION_PENDING; no physical/native/durable/security/production acceptance.');
