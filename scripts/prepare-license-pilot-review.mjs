// Review material only: never writes a runnable approval, protected state or services.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const need = (ok, reason) => { if (!ok) throw new Error(reason); };
const [candidateArg, expectedProvenance, ownerSid] = process.argv.slice(2);
need(process.argv.length === 5 && process.platform === 'win32', 'Expected candidate directory, provenance SHA256, owner SID on Windows');
need(/^[a-f0-9]{64}$/.test(expectedProvenance ?? '') && /^S-1-5-21-(?:[1-9][0-9]*-){3}[1-9][0-9]*$/.test(ownerSid ?? ''), 'Review pins required');
const candidate = path.resolve(candidateArg);
need(path.dirname(candidate) === path.join(repo, 'out'), 'Only a direct repository out candidate is accepted');
const read = name => fs.readFileSync(path.join(candidate, name));
const provenance = read('self-contained-provenance.json');
need(hash(provenance) === expectedProvenance, 'Package provenance mismatch');
const p = JSON.parse(provenance), delivery = JSON.parse(read('delivery-provenance.json'));
need(typeof p.physicalEntryEnabled === 'boolean' && p.physicalTested === false && p.runtimeAuthority === 'NONE' &&
  p.securityAccepted === false && p.productionAccepted === false &&
  delivery.physicalEntryEnabled === p.physicalEntryEnabled && delivery.physicalExecuted === false, 'Unaccepted diagnostic or test-capable package required');
need(delivery.packageProvenanceSha256 === expectedProvenance && hash(read('pilot-kit.zip')) === delivery.archiveSha256 &&
  hash(read('kit/kit-manifest.json')) === delivery.kitManifestSha256, 'Delivery bindings changed');
const source = JSON.parse(read('source-manifest.json'));
for (const item of source.files) {
  need(typeof item.relative === 'string' && !item.relative.includes('..') && !path.isAbsolute(item.relative), 'Source path refused');
  need(hash(fs.readFileSync(path.join(repo, item.relative))) === item.sha256, 'Source differs from reviewed build');
}
// Existing package wrapper verifies inventory and runs only the read-only host inspector.
const powershell = path.join(process.env.SystemRoot, 'System32/WindowsPowerShell/v1.0/powershell.exe');
const stdout = execFileSync(powershell, ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File',
  path.join(repo, 'licensing/adapter-evidence/pilot-kit/Run-Pilot.ps1'), '-Stage', 'InspectHost', '-Mode', 'Package',
  '-CandidateDirectory', candidate, '-ExpectedProvenanceSha256', expectedProvenance], { encoding: 'utf8', windowsHide: true, timeout: 60000 });
const host = JSON.parse(stdout);
need(host.readOnly === true && host.ownerApproved === false && host.physicalTested === false, 'Host report is not diagnostic');
const services = Object.fromEntries(['Setup', 'Guardian', 'App'].map(role => {
  const name = 'Ecs.Lic008.EntryEvidenceV2.' + role;
  const text = execFileSync(path.join(process.env.SystemRoot, 'System32/sc.exe'), ['showsid', name], { encoding: 'utf8', windowsHide: true, timeout: 10000 });
  const matches = text.match(/S-1-5-80-(?:[0-9]+-){4}[0-9]+/g);
  need(matches?.length === 1, 'Cannot obtain unique Windows service SID');
  return [role, matches[0]];
}));
const files = JSON.parse(read('package-manifest.json')).files.map(({ name, size, sha256 }) => ({ name, size, sha256 }))
  .sort((a, b) => a.name < b.name ? -1 : a.name > b.name ? 1 : 0);
const profile = { schemaVersion: 1, scope: 'TEST_ONLY_PILOT_PROFILE_REVIEW_DRAFT', provider: 'Microsoft Software Key Storage Provider',
  algorithm: 'RSA', keyBits: 3072, exportPolicy: 0, keyUsage: 'DECRYPT_ONLY', target: 'Windows10/11-x64',
  runtime: '10.0.11', successorPacketSha256: '8d6b30a67a7060b1e343b1fa485c11f460698d20017bc48da597fcd67757ea30',
  approved: false, securityAccepted: false, productionAccepted: false };
const profileBytes = Buffer.from(JSON.stringify(profile));
const id = () => crypto.randomBytes(16).toString('hex');
const experimentId = id();
const plan = { schemaVersion: 1, scope: 'TEST_ONLY_SOFTWARE_KSP_ADAPTER_EVIDENCE_V1', stage: 'Prepare', experimentId,
  guardianSid: services.Guardian, appSid: services.App, hostBindingSha256: host.hostBindingSha256,
  sourceManifestSha256: hash(read('source-manifest.json')), provenanceSha256: expectedProvenance,
  kitManifestSha256: delivery.kitManifestSha256, packageManifestSha256: hash(read('package-manifest.json')),
  dependencyInventorySha256: hash(Buffer.from(JSON.stringify(files))), profileSha256: hash(profileBytes), bootIdentity: host.bootIdentity,
  previousCheckpointSha256: '', previousEvidenceSha256: '', packageFiles: files,
  runs: ['setup-create', 'guardian-prepare', 'setup-publish', 'app-prepare', 'child-prepare'].map(action => ({ action,
    role: ({ setup: 'Setup', guardian: 'Guardian', app: 'App', child: 'Child' })[action.split('-')[0]], runId: id() })),
  previousRunIds: [], ownerAuthorized: false, builtKitReviewed: false };
const out = path.join(repo, 'out', 'lic008-prepare-review-' + experimentId);
// Exact candidate decision/context, deliberately non-executable until a separate
// owner decision. Never manufacture approval or start a validity window here.
const binding = { stage: plan.stage, experimentId, planSha256: hash(Buffer.from(JSON.stringify(plan))),
  successorPacketSha256: profile.successorPacketSha256 };
for (const key of ['hostBindingSha256', 'bootIdentity', 'sourceManifestSha256', 'provenanceSha256',
  'kitManifestSha256', 'packageManifestSha256', 'dependencyInventorySha256', 'profileSha256',
  'previousCheckpointSha256', 'previousEvidenceSha256']) binding[key] = plan[key];
const controller = { schemaVersion: 1, scope: 'TEST_ONLY_CONTROLLER_INPUT_V1', plan, binding };
const controllerInputSha256 = hash(Buffer.from(JSON.stringify(controller)));
const decision = { schemaVersion: 1, scope: 'TEST_ONLY_OWNER_STAGE_DECISION_V1', decisionId: id(), ownerSid,
  decision: 'PENDING_OWNER_APPROVAL', controllerInputSha256, bindingSha256: hash(Buffer.from(JSON.stringify(binding))),
  stage: plan.stage, experimentId, issuedUtc: '1970-01-01T00:00:00+00:00', expiresUtc: '1970-01-01T00:00:00+00:00',
  securityAccepted: false, productionAccepted: false };
const decisionSha256 = hash(Buffer.from(JSON.stringify(decision)));
const context = { schemaVersion: 1, scope: 'TEST_ONLY_OWNER_CONFIRMATION_CONTEXT_V1', expectedOwnerSid: ownerSid,
  controllerInputSha256, successorPacketSha256: profile.successorPacketSha256, decisionSha256,
  stage: plan.stage, experimentId };
fs.mkdirSync(out); // unique create; no overwrite or reuse
const artifacts = { 'profile-review.json': profileBytes, 'prepare-plan-draft.json': Buffer.from(JSON.stringify(plan)),
  'controller-input-draft.json': Buffer.from(JSON.stringify(controller)),
  'owner-input-draft.json': Buffer.from(JSON.stringify({ input: controller, decision })),
  'owner-context-draft.json': Buffer.from(JSON.stringify(context)),
  'host-observation.json': Buffer.from(stdout), 'review-status.json': Buffer.from(JSON.stringify({ schemaVersion: 1,
    scope: 'TEST_ONLY_PREPARE_REVIEW_NOT_EXECUTABLE', candidate, ownerSid, services, sourceCommit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repo, encoding: 'utf8' }).trim(),
    generatedUtc: new Date().toISOString(), approvalDecisionCreated: false, ownerContextCreated: true,
    ownerContextApproved: false, draftDecisionCreated: true, decisionSha256,
    ownerContextSha256: hash(Buffer.from(JSON.stringify(context))), physicalExecutionAuthorized: false,
    buildTestCapable: p.physicalEntryEnabled,
    blockers: [...(p.physicalEntryEnabled ? [] : ['ACTIVATION_REVIEW_AND_METADATA']), 'PROFILE_AND_PLAN_OWNER_REVIEW', 'EXACT_KIT_PREPARE_PERMISSION'],
    note: 'Boot/package changes invalidate these drafts. Decision PENDING_OWNER_APPROVAL and empty epoch window are intentionally invalid. Approval requires new decision/window and recomputation of affected pins; never edit flags alone.' })) };
for (const [name, bytes] of Object.entries(artifacts)) fs.writeFileSync(path.join(out, name), bytes, { flag: 'wx' });
fs.writeFileSync(path.join(out, 'review-manifest.json'), JSON.stringify({ scope: 'TEST_ONLY_PREPARE_REVIEW_NOT_EXECUTABLE',
  files: Object.entries(artifacts).map(([name, bytes]) => ({ name, sha256: hash(bytes) })) }), { flag: 'wx' });
console.log(JSON.stringify({ output: out, physicalExecutionAuthorized: false, approvalDecisionCreated: false, files: Object.keys(artifacts).length + 1 }));
