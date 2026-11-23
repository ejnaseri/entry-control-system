// Read-only preparation-contract checks, NOT a physical kit or security approval.
import assert from 'node:assert/strict';
import { readFileSync, lstatSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const relative = 'licensing/adapter-evidence/pilot-implementation/implementation-packet.json';
const digest = b => createHash('sha256').update(b).digest('hex');
function plain(relativePath) {
  assert.match(relativePath, /^[A-Za-z0-9_./-]+$/);
  assert(!relativePath.split('/').some(p => p === '..' || p === '.' || p === ''));
  let current = path.resolve(repo, relativePath);
  assert(current.startsWith(repo + path.sep));
  for (;;) {
    assert(!lstatSync(current).isSymbolicLink(), 'Nonplain input');
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }
  return path.resolve(repo, relativePath);
}
function strictJson(text) {
  // Check duplicate keys before JSON.parse can discard them. JSON.parse handles
  // complete grammar/encoding; scanner is bounded and does not evaluate input.
  assert(Buffer.byteLength(text) <= 65536);
  let i = 0;
  const ws = () => { while (i < text.length && /[ \t\r\n]/.test(text[i])) i++; };
  function string() {
    assert.equal(text[i], '"'); const start = i++;
    while (i < text.length) { const c = text[i++]; if (c === '\\') { i++; continue; } if (c === '"') return JSON.parse(text.slice(start, i)); }
    throw new Error('Unterminated string');
  }
  function value(depth) {
    assert(depth <= 12); ws();
    if (text[i] === '{') {
      i++; ws(); const seen = new Set(); if (text[i] === '}') { i++; return; }
      for (;;) { ws(); const key = string(); assert(!seen.has(key), 'Duplicate key'); seen.add(key);
        ws(); assert.equal(text[i++], ':'); value(depth + 1); ws();
        if (text[i] === '}') { i++; return; } assert.equal(text[i++], ','); }
    }
    if (text[i] === '[') { i++; ws(); if (text[i] === ']') { i++; return; }
      for (;;) { value(depth + 1); ws(); if (text[i] === ']') { i++; return; } assert.equal(text[i++], ','); } }
    if (text[i] === '"') { string(); return; }
    const start = i; while (i < text.length && !/[\s,}\]]/.test(text[i])) i++;
    assert(i > start); JSON.parse(text.slice(start, i));
  }
  value(0); ws(); assert.equal(i, text.length); return JSON.parse(text);
}
const closed = (o, keys) => assert.deepEqual(Object.keys(o).sort(), [...keys].sort());
const roles = ['Controller', 'Setup', 'Guardian', 'App', 'Child'];
const actions = ['setup-create', 'guardian-prepare', 'setup-publish', 'app-prepare', 'child-prepare',
  'guardian-fresh', 'app-fresh', 'child-fresh', 'setup-finish', 'guardian-absence'];
const owners = ['A', 'S', 'G', 'P', 'P'];
const directories = ['', 'bin', 'plans', 'controller', 'shared', 'protected', 'guardian-work', 'setup-reports', 'guardian-reports', 'app-reports'];
const grants = [
  ['S:F:3','A:F:3','G:RD:3','P:RD:3'], ['S:F:3','A:F:3','G:RD:3','P:RD:3'],
  ['S:F:3','A:F:3','G:RD:3','P:RD:3'], ['S:F:3','A:F:3'], ['S:F:3','A:F:3','G:RD:3','P:RD:3'],
  ['S:F:3','G:RD:3'], ['S:F:3','G:M:3'], ['S:F:3','A:RD:3'], ['S:F:3','A:RD:3','G:M:3'], ['S:F:3','A:RD:3','P:M:3']];
const top = ['schemaVersion','id','revision','scope','status','date','physicalExecutionAuthorized','securityAccepted','productionAccepted',
  'runtimeAuthority','durable','references','proposedSourceAllowlist','names','identities','bootstrap','directories','fileClasses',
  'stages','report','lifecycle','custody','authorizationGates','excluded','physicalCases','implementationComplete'];
function validate(p, checkSources = false) {
  closed(p, top); assert.equal(p.schemaVersion, 1); assert.equal(p.revision, '0.1');
  assert.equal(p.id, 'ADAPTER-PILOT-IMPLEMENTATION-01');
  assert.equal(p.scope, 'TEST_ONLY_SOFTWARE_KSP_ADAPTER_EVIDENCE_V1');
  assert.equal(p.status, 'PREPARED_FOR_SCOPED_REVIEW_NOT_BUILT');
  for (const f of ['physicalExecutionAuthorized','securityAccepted','productionAccepted','durable','implementationComplete']) assert.equal(p[f], false);
  assert.equal(p.runtimeAuthority, 'NONE');
  assert.deepEqual(p.names, {root:'C:/ProgramData/Ecs.Lic008.EntryEvidenceV1', setup:'Ecs.Lic008.EntryEvidenceV1.Setup',
    guardian:'Ecs.Lic008.EntryEvidenceV1.Guardian', app:'Ecs.Lic008.EntryEvidenceV1.App',
    keyPrefix:'Ecs.Lic008.EntryEvidenceV1.TEST_ONLY.', keyLabels:['restricted','app-readable']});
  assert.equal(p.references.length, 4); assert.equal(new Set(p.references.map(r=>r.path)).size, 4);
  for (const r of p.references) { closed(r, ['path','sha256']); assert.match(r.sha256, /^[a-f0-9]{64}$/);
    if (checkSources) assert.equal(digest(readFileSync(plain(r.path))), r.sha256, 'Referenced bytes changed'); }
  assert.equal(p.proposedSourceAllowlist.length, 13);
  assert.equal(new Set(p.proposedSourceAllowlist.map(s=>s.toLowerCase())).size, 13);
  for (const s of p.proposedSourceAllowlist) {
    assert.match(s, /^(licensing\/adapter-evidence\/(pilot-runtime\/\w+\.cs|pilot-kit\/(Run-Pilot\.ps1|README-fa\.txt)|track-a\/CandidateCodec\.cs)|scripts\/build-license-adapter-pilot\.ps1)$/);
  }
  closed(p.identities, roles);
  for (let i=0; i<roles.length; i++) { const identity=p.identities[roles[i]]; closed(identity,['user','owner','service']); assert.equal(identity.owner,owners[i]); }
  assert.equal(p.bootstrap.length,9); assert(p.bootstrap.every(s=>/^[A-Z0-9_]+$/.test(s)));
  assert.deepEqual(p.directories.map(d=>d.path), directories);
  p.directories.forEach((d,i)=>{closed(d,['path','creator','owner','aces']); const privateDir=i>=4&&i<=6;
    assert.equal(d.creator,privateDir?'Setup':'Controller'); assert.equal(d.owner,privateDir?'S':'A'); assert.deepEqual(d.aces,grants[i]);});
  assert.deepEqual(p.fileClasses.map(f=>f.directory), ['bin','plans','controller','protected','shared','guardian-work','setup-reports','guardian-reports','app-reports']);
  for (const f of p.fileClasses) {closed(f,['directory','names','owner','aces']); assert(f.names.length>0);
    assert.equal(new Set(f.names).size,f.names.length); assert(f.names.every(s=>/^[A-Za-z0-9_.-]+$/.test(s)&&!s.includes('..')));
    assert(f.aces.every(s=>/^[SAGP]:(F|M|R|RD):0$/.test(s)));}
  const fileNames=[['EXACT_PACKAGE_MANIFEST_ENTRIES'],['prepare.json','fresh-process.json','finish.json'],
    ['run-admission.json','prepare-checkpoint.json','fresh-process-checkpoint.json','finish-checkpoint.json','final-summary.json'],
    ['restricted-intent.json','app-readable-intent.json','restricted-owned.json','app-readable-owned.json'],
    ['public-control.json','restricted-envelope.bin','app-readable-envelope.bin','restricted-expected-hash.json','app-readable-expected-hash.json'],
    ['restricted-envelope.bin','app-readable-envelope.bin','restricted-expected-hash.json','app-readable-expected-hash.json'],
    ['APPROVED_SETUP_RUN_IDS.json'],['APPROVED_GUARDIAN_RUN_IDS.json'],['APPROVED_APP_AND_CHILD_RUN_IDS.json']];
  const fileOwners=['A','A','A','S','S','G','S','G','P'];
  const fileGrants=[['S:F:0','A:F:0','G:RD:0','P:RD:0'],['S:F:0','A:F:0','G:R:0','P:R:0'],['S:F:0','A:F:0'],
    ['S:F:0','G:R:0'],['S:F:0','A:R:0','G:R:0','P:R:0'],['S:F:0','G:M:0'],['S:F:0','A:R:0'],
    ['S:F:0','A:R:0','G:M:0'],['S:F:0','A:R:0','P:M:0']];
  p.fileClasses.forEach((f,i)=>{assert.equal(f.owner,fileOwners[i]);assert.deepEqual(f.names,fileNames[i]);assert.deepEqual(f.aces,fileGrants[i]);});
  assert.deepEqual(p.stages.map(s=>s.name), ['Prepare','VerifyFreshProcess','Finish']);
  assert.deepEqual(p.stages.map(s=>s.actions.length), [5,3,2]);
  assert.deepEqual(p.stages.flatMap(s=>s.actions.map(a=>a.name)), actions);
  for (const stage of p.stages) {closed(stage,['name','actions']);for(const a of stage.actions){closed(a,['name','role','operations']);
    const role=a.name.startsWith('setup-')?'Setup':a.name.startsWith('guardian-')?'Guardian':a.name.startsWith('child-')?'Child':'App';
    assert.equal(a.role,role); assert.equal(new Set(a.operations).size,a.operations.length); assert(a.operations.includes('WRITE_OWN_REPORT'));
    if(a.name!=='setup-create') assert(!a.operations.some(op=>op.includes('CREATE_TWO')||op.includes('CREATE_PRIVATE')));
    if(a.name!=='setup-finish') assert(!a.operations.some(op=>op.includes('DELETE')));
    assert(a.operations.every(op=>/^[A-Z0-9_]+$/.test(op)));}}
  closed(p.report,['schemaVersion','maximumBytes','maximumReports','fields','resultFields','statuses','forbiddenFields','contextAuthority','absenceRule']);
  assert.equal(p.report.schemaVersion,1);assert.equal(p.report.maximumBytes,2097152);assert.equal(p.report.maximumReports,10);
  assert.equal(new Set(p.report.fields).size,p.report.fields.length);
  for(const field of ['loadedAssemblySha256','executorExeSha256','tokenOwnerSid','dependencyInventorySha256','workerEnded','elapsedMonotonicMs','runtimeAuthority']) assert(p.report.fields.includes(field));
  assert(p.report.forbiddenFields.every(f=>!p.report.fields.includes(f)));
  assert.deepEqual(p.report.statuses,['PASS','FAIL','OBSERVED','UNKNOWN','SKIPPED_PREREQUISITE']);
  assert.equal(p.report.absenceRule,'RAW_BAD_KEYSET_IS_UNKNOWN_UNLESS_EXACT_CONTROLLED_CONTEXT_IS_REVIEWED');
  closed(p.lifecycle,['validateBudgetMs','cryptoBudgetMs','maxConcurrentWorkers','onUnknown','bufferRelease','stopAllowed','stagePass','onPartialDelete']);
  assert.equal(p.lifecycle.validateBudgetMs,5000);assert.equal(p.lifecycle.cryptoBudgetMs,10000);assert.equal(p.lifecycle.maxConcurrentWorkers,1);
  assert.equal(p.lifecycle.onUnknown,'BLOCK_RETAIN_NO_RETRY_NO_LATE_DELIVERY');assert.equal(p.lifecycle.bufferRelease,'ONLY_AFTER_REAL_WORKER_COMPLETION');
  closed(p.custody,['sdk','runtime','rid','build','package','kit','provenance','archive','admission']);
  assert.equal(p.custody.sdk,'10.0.400');assert.equal(p.custody.runtime,'10.0.11');assert.equal(p.custody.rid,'win-x64');
  assert.deepEqual(p.authorizationGates,['SCOPED_PACKET_REVIEW','OWNER_EXACT_IMPLEMENTATION_SCOPE','BUILT_SOURCE_KIT_NEGATIVE_REVIEW','OWNER_PREPARE',
    'PREPARE_EVIDENCE_REVIEW','OWNER_FRESH','FRESH_EVIDENCE_REVIEW','OWNER_FINISH','FINAL_EVIDENCE_AND_REM_DECISION']);
  for(const e of ['OLD_V1_V7_RERUN','WORKER_KILL','PRIVILEGE_ENABLE','TOKEN_OWNER_REWRITE','AUTOMATIC_RETRY_OR_CLEANUP']) assert(p.excluded.includes(e));
  assert.deepEqual(p.physicalCases,['FEP-P01','FEP-P02','FEP-P03','FEP-P04','FEP-P05']);
}
const bytes=readFileSync(plain(relative));const packet=strictJson(bytes.toString('utf8'));validate(packet,true);
const mutations=[p=>p.physicalExecutionAuthorized=true,p=>p.implementationComplete=true,p=>p.extra=true,
  p=>p.names.root='C:/ProgramData',p=>p.references[0].sha256='placeholder',p=>p.proposedSourceAllowlist[0]='../escape.cs',
  p=>p.proposedSourceAllowlist[1]=p.proposedSourceAllowlist[0],p=>p.directories[5].owner='A',p=>p.directories[5].aces.push('A:F:3'),
  p=>p.stages[1].actions[0].operations.push('DELETE_KEYS'),p=>p.stages[2].actions[0].operations.push('CREATE_TWO_KEYS'),
  p=>p.stages[0].actions.reverse(),p=>p.report.maximumReports=11,p=>p.report.fields.push('plaintext'),
  p=>p.lifecycle.onUnknown='RETRY',p=>p.authorizationGates.pop(),p=>p.physicalCases.pop(),
  p=>p.fileClasses[3].owner='A',p=>p.fileClasses[3].aces=['A:F:0'],p=>p.fileClasses[3].names.push('foreign.json')];
for(const mutate of mutations){const p=structuredClone(packet);mutate(p);assert.throws(()=>validate(p));}
assert.throws(()=>strictJson('{"x":1,"x":2}'));
assert.throws(()=>strictJson('{"x":{"y":1,"y":2}}'));
assert.throws(()=>strictJson('{"x":1} trailing'));
console.log(`PASS: preparation packet, 4 unchanged input pins, 10 actions/3 stages/5 physical cases, ${mutations.length+3} negative checks.`);
console.log(`Packet SHA256: ${digest(bytes)}`);
console.log('NOT_BUILT; no role/controller implementation, physical execution or Security acceptance.');
