import {activePin, activePacketPath} from './check-license-pilot-isolation.mjs';
// Adopted direction and source bindings only. No native/owner execution.
import './check-license-pilot-owner-successor.mjs';
import './check-license-report-identity-v02.mjs';
import assert from 'node:assert/strict';
import {readFileSync,lstatSync} from 'node:fs';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const repo=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const hash=b=>createHash('sha256').update(b).digest('hex');
function read(relative){
  assert.match(relative,/^[A-Za-z0-9_./-]+$/);
  assert(relative.split('/').every(p=>p && p!=='.' && p!=='..'));
  let cursor=path.resolve(repo,relative);assert(cursor.startsWith(repo+path.sep));const file=cursor;
  for(;;){assert(!lstatSync(cursor).isSymbolicLink());const next=path.dirname(cursor);if(next===cursor)break;cursor=next;}
  return readFileSync(file);
}
const pin='c25920687086f0ade2d90486aa02556212a5172e12b423df02ee0650ca69bd7b';
const raw=read('licensing/adapter-evidence/pilot-implementation/implementation-packet-v04.json');
assert.equal(hash(raw),pin);const packet=JSON.parse(raw);
assert.equal(packet.revision,'0.4');assert.equal(packet.productImplementationDirectionAdopted,true);
assert.equal(packet.runtimeAuthority,'NONE');
for(const flag of ['physicalExecutionAuthorized','independentReviewSatisfied','securityAccepted','productionAccepted'])assert.equal(packet[flag],false);
const seen=new Map();
function verify(ref){
  const bytes=read(ref.path);assert.equal(hash(bytes),ref.sha256);
  if(seen.has(ref.path)){assert.equal(seen.get(ref.path),ref.sha256);return;}
  seen.set(ref.path,ref.sha256);
  if(ref.path.endsWith('.json')){const p=JSON.parse(bytes);if(p.base)verify(p.base);for(const r of p.references??[])verify(r);}
}
verify({path:'licensing/adapter-evidence/pilot-implementation/implementation-packet-v04.json',sha256:pin});
verify({path:activePacketPath,sha256:activePin});
const builder=read('scripts/build-license-adapter-pilot.ps1').toString();
for(const [relative,sha256] of seen) {
  const direct=relative==='licensing/adapter-evidence/track-a/CandidateCodec.cs' &&
    builder.includes(`(Hash (Join-Path $repo '${relative}'))-ceq'${sha256}'`);
  assert(direct || builder.includes(`relative='${relative}';sha256='${sha256}'`),'Missing builder binding: '+relative);
}
for(const source of ['licensing/adapter-evidence/pilot-runtime/Program.cs','scripts/prepare-license-pilot-review.mjs'])assert(read(source).toString().includes(activePin));
assert(builder.includes("if($TestCapable-and$ReviewedSuccessorSha256-cne$isolatedSuccessor){throw 'ISOLATED_V2_BUILD_REVIEW_PIN_REQUIRED'}"));
assert(builder.includes("$isolatedSuccessor='"+activePin+"'"));
assert(builder.includes("$report.successorPacketSha256-ceq'"+activePin+"'"));
const draft=JSON.parse(read('licensing/adapter-evidence/pilot-implementation/implementation-packet-v04-draft.json'));
assert.deepEqual(packet.base,draft.base);assert.deepEqual(packet.overrides,draft.overrides);
assert.equal(packet.inheritance,draft.inheritance);
assert.deepEqual(packet.references.slice(0,3),draft.references);
function validate(p){assert.deepEqual(p,packet);}
let negatives=0;
const edits=[p=>p.productImplementationDirectionAdopted=false,p=>p.revision='0.3',p=>p.runtimeAuthority='LICENSE',
 ...['physicalExecutionAuthorized','independentReviewSatisfied','securityAccepted','productionAccepted'].map(k=>p=>p[k]=true),
 p=>p.references.pop(),p=>p.references[5].sha256='0'.repeat(64),p=>p.base.sha256='0'.repeat(64),
 p=>p.overrides.push('AUTO_RESUME'),p=>p.extra=true];
for(const edit of edits){const changed=structuredClone(packet);edit(changed);assert.throws(()=>validate(changed));negatives++;}
console.log(`PASS: adopted direction0.4, ${seen.size} transitive artifact pins, ${negatives} successor negatives; runtime/build/review-helper bindings agree.`);
console.log('BINDINGS_ONLY; exact-kit/stage/independent/security/production acceptance not granted.');
