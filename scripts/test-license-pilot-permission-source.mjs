import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {validatePermissionSource,permissionHash} from './license-pilot-permission-source.mjs';
const now=new Date('2026-10-16T10:00:00.000Z');
const p={schemaVersion:1,scope:'TEST_ONLY_REVIEWED_PREPARE_PERMISSION_SOURCE_V1',decision:'APPROVE_PREPARE',
  stage:'Prepare',ownerSid:'S-1-5-21-1-2-3-1001',provenanceSha256:'a'.repeat(64),successorPacketSha256:'b'.repeat(64),
  approvalReference:'TEST_ONLY:synthetic-message-1',approvedUtc:'2026-10-16T09:00:00.000Z',expiresUtc:'2026-10-16T11:00:00.000Z'};
const expected={stage:p.stage,ownerSid:p.ownerSid,provenanceSha256:p.provenanceSha256,successorPacketSha256:p.successorPacketSha256};
const encode=p=>Buffer.from(JSON.stringify(p));let passed=0;
function accept(raw=encode(p),pin=permissionHash(raw),e=expected,t=now){return validatePermissionSource(raw,pin,e,t);}
const result=accept();assert(Object.isFrozen(result));assert.equal(result.approvalReference,p.approvalReference);passed++;
assert.equal(accept().recordSha256,permissionHash(encode(p)));passed++;
for(const key of Object.keys(p)){const changed={...p};delete changed[key];assert.throws(()=>accept(encode(changed)));passed++;}
for(const change of [{extra:true},{schemaVersion:2},{scope:'PRODUCTION'},{decision:'PENDING_OWNER_APPROVAL'},
 {stage:'Finish'},{ownerSid:'S-1-5-18'},{ownerSid:'S-1-5-21-1-2-3-1002'},
 {provenanceSha256:'c'.repeat(64)},{successorPacketSha256:'c'.repeat(64)},
 {approvalReference:''},{approvalReference:'   '},{approvalReference:'bad\nreference'},
 {approvedUtc:'2026-10-13T09:00:00.000Z',expiresUtc:'2026-10-13T11:00:00.000Z'},
 {approvedUtc:'2026-10-16T10:01:00.000Z'}, {expiresUtc:now.toISOString()},
 {expiresUtc:'2026-10-18T10:00:00.000Z'},{approvedUtc:'2026-02-30T09:00:00.000Z'},
 {approvedUtc:'2026-10-16T09:00:00+00:00'}]) {assert.throws(()=>accept(encode({...p,...change})));passed++;}
for(const raw of [Buffer.alloc(0),Buffer.alloc(16385),Buffer.from('{}'),Buffer.from('null'),
 Buffer.from('[]'),Buffer.from(JSON.stringify(p)+'\n'),Buffer.from(JSON.stringify(p).replace('{','{"stage":"Finish",'))]){
 assert.throws(()=>accept(raw));passed++;}
assert.throws(()=>accept(encode(p),'0'.repeat(64)));passed++;
assert.throws(()=>accept(encode(p),undefined,{...expected,stage:'Finish'}));passed++;
assert.throws(()=>accept(encode(p),undefined,expected,new Date(NaN)));passed++;
const command=new URL('./issue-license-pilot-prepare.mjs',import.meta.url);
// Legacy invocation must refuse before reading a candidate, creating drafts or launching helpers.
const run=spawnSync(process.execPath,[command.pathname.replace(/^\/(\w:)/,'$1'),'nonexistent','a'.repeat(64),p.ownerSid,'--owner-approved-prepare'],{encoding:'utf8',windowsHide:true});
assert.notEqual(run.status,0);assert.match(run.stderr,/reviewed permission path\/hash required/);passed++;
const source=readFileSync(command,'utf8');
assert(!source.includes('Explicit owner chat approval on 2026-10-13'));passed++;
assert(source.indexOf('validatePermissionSource(permissionBytes')<source.indexOf('const fresh ='));passed++;
assert(source.includes("'permission-source.json': permissionBytes"));passed++;
assert(source.includes('Math.min(now.getTime() + 4 * 60 * 60 * 1000,Date.parse(permissionSource.expiresUtc))'));passed++;
console.log(`PASS: ${passed} permission provenance checks; synthetic in-memory records only; no approval issued or native execution.`);
