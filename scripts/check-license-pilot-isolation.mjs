// Pure repository checks: no service, registry, key or protected-directory operations.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
export const activePin='8d6b30a67a7060b1e343b1fa485c11f460698d20017bc48da597fcd67757ea30';
export const activePacketPath='licensing/adapter-evidence/pilot-implementation/implementation-packet-v05.json';
const read=p=>readFileSync(new URL('../'+p,import.meta.url));
const hash=b=>createHash('sha256').update(b).digest('hex');
const bytes=read(activePacketPath);assert.equal(hash(bytes),activePin);
const packet=JSON.parse(bytes), ns=packet.namespace;
assert.equal(packet.revision,'0.5');
assert.equal(packet.base.sha256,'c25920687086f0ade2d90486aa02556212a5172e12b423df02ee0650ca69bd7b');
for(const ref of [packet.base,...packet.references])assert.equal(hash(read(ref.path)),ref.sha256);
assert.equal(ns.prefix,'Ecs.Lic008.EntryEvidenceV2');
assert.equal(ns.root,'C:/ProgramData/'+ns.prefix);
assert.equal(ns.keyPrefix,ns.prefix+'.TEST_ONLY.');
assert.equal(packet.runtimeAuthority,'NONE');
for(const flag of ['physicalExecutionAuthorized','independentReviewSatisfied','securityAccepted','productionAccepted'])assert.equal(packet[flag],false);
const source=read('licensing/adapter-evidence/pilot-runtime/Program.cs').toString();
assert(source.includes('Root="'+ns.root+'"'));
assert(source.includes('Prefix="'+ns.prefix+'"'));
assert(source.includes('SuccessorPacketSha256="'+activePin+'"'));
const helper=read('scripts/prepare-license-pilot-review.mjs').toString();
assert(helper.includes(ns.prefix+'.'));assert(helper.includes(activePin));
const tokens=read('licensing/adapter-evidence/pilot-runtime/NativeTokens.cs').toString();
for(const [role,sid] of Object.entries(ns.services)){
  const digest=createHash('sha1').update(Buffer.from((ns.prefix+'.'+role).toUpperCase(),'utf16le')).digest();
  const derived='S-1-5-80-'+Array.from({length:5},(_,i)=>digest.readUInt32LE(i*4)).join('-');
  assert.equal(derived,sid);assert(tokens.includes(sid));
}
let negatives=0;
for(const edit of [p=>p.namespace.root=p.namespace.root.replace('V2','V1'),
 p=>p.namespace.prefix=p.namespace.prefix.replace('V2','V1'),
 p=>p.namespace.services.Guardian=p.namespace.services.App,
 p=>p.namespace.keyPrefix='Ecs.Lic008.EntryEvidenceV1.TEST_ONLY.',
 p=>p.physicalExecutionAuthorized=true,p=>p.retainedV1Policy='ADOPT',
 p=>p.base.sha256='0'.repeat(64)]){
  const changed=structuredClone(packet);edit(changed);
  assert.notEqual(hash(Buffer.from(JSON.stringify(changed))),activePin);
  assert.throws(()=>assert.deepEqual(changed,packet));negatives++;
}
console.log('PASS: isolated V2 namespace, 3 independently derived SID vectors, '+negatives+' packet mutation refusals; no execution authorized by this check.');
