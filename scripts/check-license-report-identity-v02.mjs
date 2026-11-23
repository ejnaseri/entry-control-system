import {activePin} from './check-license-pilot-isolation.mjs';
// Read-only draft binding check. Never adopts a contract or switches runtime pins.
import assert from 'node:assert/strict';
import {readFileSync,lstatSync} from 'node:fs';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const repo=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const digest=b=>createHash('sha256').update(b).digest('hex');
function read(relative) {
  assert.match(relative,/^[A-Za-z0-9_./-]+$/);
  assert(relative.split('/').every(p=>p && p!=='.' && p!=='..'));
  let cursor=path.resolve(repo,relative);assert(cursor.startsWith(repo+path.sep));
  const file=cursor;
  for(;;){assert(!lstatSync(cursor).isSymbolicLink());const next=path.dirname(cursor);if(next===cursor)break;cursor=next;}
  return readFileSync(file);
}
const raw=read('licensing/adapter-evidence/pilot-implementation/implementation-packet-v04-draft.json');
assert.equal(digest(raw),'949eb0806a38a71567c78b2ac0def9419e02435885d98d1d7dd4aa692b99d3b9');
const packet=JSON.parse(raw);let pins=0;
for(const ref of [packet.base,...packet.references]){assert.equal(digest(read(ref.path)),ref.sha256);pins++;}
const contract=JSON.parse(read(packet.references[0].path));
assert.equal(contract.status,'DRAFT_REVIEW_AND_ADOPTION_PENDING');
assert.equal(contract.report.schemaVersion,2);assert.equal(contract.report.fields.length,42);
assert.equal(new Set(contract.report.fields).size,42);
assert.deepEqual(contract.report.fields.slice(-3),['serviceSidGroupCount','tokenRestricted','tokenQueryComplete']);
const emitter=read('licensing/adapter-evidence/pilot-runtime/ReportEmitter.cs').toString();
const fields=[...emitter.match(/string\[\] Fields=\{([\s\S]*?)\};/)[1].matchAll(/"([^"]+)"/g)].map(m=>m[1]);
assert.deepEqual(fields,contract.report.fields);
for(const name of ['ServiceSidGroupCount','TokenRestricted','TokenQueryComplete'])
  assert(new RegExp('\\[JsonRequired\\] public (int|bool) '+name+' ').test(emitter));
assert(emitter.includes('r.SchemaVersion==2'));
const program=read('licensing/adapter-evidence/pilot-runtime/Program.cs').toString();
const v04Pin='c25920687086f0ade2d90486aa02556212a5172e12b423df02ee0650ca69bd7b';
assert.equal(digest(read('licensing/adapter-evidence/pilot-implementation/implementation-packet-v04.json')),v04Pin);
assert(program.includes('SuccessorPacketSha256="'+activePin+'"'));
const builder=read('scripts/build-license-adapter-pilot.ps1').toString();
assert(builder.includes("if($TestCapable-and$ReviewedSuccessorSha256-cne$isolatedSuccessor){throw 'ISOLATED_V2_BUILD_REVIEW_PIN_REQUIRED'}"));
assert(builder.includes("$isolatedSuccessor='"+activePin+"'"));
// Exact reviewed draft means no unlisted fields or implicit authority overrides.
function validate(p,c){assert.deepEqual(p,packet);assert.deepEqual(c,contract);}
let negatives=0;
function reject(edit){const p=structuredClone(packet),c=structuredClone(contract);edit(p,c);
  assert.throws(()=>validate(p,c));negatives++;}
for(const key of ['productImplementationDirectionAdopted','physicalExecutionAuthorized','independentReviewSatisfied','securityAccepted','productionAccepted'])reject(p=>p[key]=true);
reject(p=>p.runtimeAuthority='LICENSE');reject(p=>p.base.sha256='0'.repeat(64));
reject(p=>p.references[0].sha256='0'.repeat(64));reject(p=>p.overrides.push('RESUME_RETAINED'));
reject((p,c)=>c.report.schemaVersion=1);reject((p,c)=>c.report.fields.pop());
reject((p,c)=>c.report.fields.push('privateKey'));reject((p,c)=>c.report.fields.reverse());
reject((p,c)=>delete c.requiredEvidence.tokenQueryComplete);
reject((p,c)=>c.requiredEvidence.serviceSidGroupCount.allowed.push(2));
reject((p,c)=>c.requiredEvidence.tokenRestricted.acceptedValue=true);
reject((p,c)=>c.requiredEvidence.tokenQueryComplete.acceptedValue=false);
reject((p,c)=>c.restrictionQuery.acceptedReturnedLengths.push(2));
reject((p,c)=>c.restrictionQuery.requiresSuccess=false);
reject((p,c)=>c.identity.setup=c.identity.absentGroup);
reject((p,c)=>c.identity.childExpectedSid='GUARDIAN_SID');
reject((p,c)=>c.compatibility.schema1='UPGRADE');
reject((p,c)=>c.gates.productAdopted=true);
reject((p,c)=>c.gates.physicalExecutionAuthorized=true);
for(const bad of ['../outside','/absolute','docs//bad','C:/outside']){assert.throws(()=>read(bad));negatives++;}
console.log(`PASS: report-v2 DRAFT, ${pins} direct reference pins,42 field order,required fields,inert gate,${negatives} negative checks.`);
console.log('Historical draft flags preserved; current isolated runtime pin v0.5 checked; physical/security/production acceptance false.');
