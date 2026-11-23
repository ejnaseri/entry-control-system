// Use only after the owner explicitly permits this exact kit's Prepare effects.
// Issues local review-bound inputs; never launches a physical stage or supplies consent.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {validatePermissionSource} from './license-pilot-permission-source.mjs';
const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const [candidateArg, pin, ownerSid, permission, permissionPath, permissionPin] = process.argv.slice(2);
const need = (ok, message) => { if (!ok) throw new Error(message); };
need(process.argv.length === 8 && permission === '--owner-approved-prepare', 'Explicit owner-approved Prepare issuance and reviewed permission path/hash required');
const candidate = path.resolve(candidateArg);
need(path.dirname(candidate) === path.join(repo, 'out'), 'Candidate must be a direct out child');
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
// Match System.Text.Json default encoding for the ASCII schemas used here.
const bytes = value => Buffer.from(JSON.stringify(value));
const readJson = file => JSON.parse(fs.readFileSync(file));
const provenance = fs.readFileSync(path.join(candidate, 'self-contained-provenance.json'));
need(hash(provenance) === pin && JSON.parse(provenance).physicalEntryEnabled === true, 'Pinned test-capable candidate required');
// Validate before helper execution or draft/output creation. An operator must
// supply the independently reviewed hash; never derive trust from this file alone.
need(fs.lstatSync(permissionPath).isFile() && fs.statSync(permissionPath).size<=16384,'Permission source must be a bounded regular file');
const permissionBytes=fs.readFileSync(permissionPath);
const activePacketPin=hash(fs.readFileSync(path.join(repo,'licensing/adapter-evidence/pilot-implementation/implementation-packet-v05.json')));
const permissionExpected={stage:'Prepare',ownerSid,provenanceSha256:pin,successorPacketSha256:activePacketPin};
let permissionSource=validatePermissionSource(permissionBytes,permissionPin,permissionExpected);
// Existing read-only helper rechecks source, package, archive and current host.
const fresh = JSON.parse(execFileSync(process.execPath, [path.join(repo, 'scripts/prepare-license-pilot-review.mjs'),
  candidate, pin, ownerSid], { encoding: 'utf8', windowsHide: true, timeout: 90000 }));
const draft = fresh.output;
const manifest = readJson(path.join(draft, 'review-manifest.json'));
for (const file of manifest.files) need(hash(fs.readFileSync(path.join(draft, file.name))) === file.sha256, 'Draft changed');
const profile = readJson(path.join(draft, 'profile-review.json'));
profile.scope = 'TEST_ONLY_PILOT_PROFILE_OWNER_APPROVED'; profile.approved = true;
const input = readJson(path.join(draft, 'owner-input-draft.json'));
const { plan, binding } = input.input;
need(binding.successorPacketSha256===permissionSource.successorPacketSha256,'Permission successor mismatch');
need(plan.stage === 'Prepare' && input.decision.ownerSid === ownerSid && !plan.ownerAuthorized && !plan.builtKitReviewed,
  'Only untouched Prepare drafts can be issued');
plan.ownerAuthorized = true; plan.builtKitReviewed = true; plan.profileSha256 = hash(bytes(profile));
binding.profileSha256 = plan.profileSha256; binding.planSha256 = hash(bytes(plan));
const now = new Date(); now.setUTCMilliseconds(0);
permissionSource=validatePermissionSource(permissionBytes,permissionPin,permissionExpected,now);
const expires = new Date(Math.min(now.getTime() + 4 * 60 * 60 * 1000,Date.parse(permissionSource.expiresUtc)));
const utc = date => date.toISOString().replace('.000Z', '+00:00');
Object.assign(input.decision, { decision: 'APPROVE_TEST_STAGE', controllerInputSha256: hash(bytes(input.input)),
  bindingSha256: hash(bytes(binding)), issuedUtc: utc(now), expiresUtc: utc(expires) });
const context = readJson(path.join(draft, 'owner-context-draft.json'));
context.controllerInputSha256 = input.decision.controllerInputSha256;
context.decisionSha256 = hash(bytes(input.decision));
const exe = path.join(candidate, 'package/EntryControl.AdapterPilot.exe');
function diagnostic(args, payload, pass) {
  const r = spawnSync(exe, args, { input: payload, encoding: 'utf8', windowsHide: true, timeout: 30000 });
  need(pass ? r.status === 0 && r.stderr === '' : r.status === 2 && r.stdout === '' && r.stderr.trim() === 'PILOT_FAILED_OR_REFUSED',
    'Compiled input diagnostic failed: ' + args[0]);
  if (pass) { const report = JSON.parse(r.stdout); need(report.readOnly === true && report.executionAuthorized === false &&
    report.physicalTested === false && report.loadedAssemblySha256 === hash(fs.readFileSync(path.join(candidate, 'package/EntryControl.AdapterPilot.dll'))), 'Unexpected diagnostic authority'); }
}
diagnostic(['--validate-controller-input', hash(bytes(input.input))], bytes(input.input), true);
diagnostic(['--validate-owner-input', context.decisionSha256, ownerSid], bytes(input), true);
diagnostic(['--validate-owner-input', '0'.repeat(64), ownerSid], bytes(input), false);
const expired = structuredClone(input); expired.decision.expiresUtc = expired.decision.issuedUtc;
diagnostic(['--validate-owner-input', hash(bytes(expired.decision)), ownerSid], bytes(expired), false);
const out = path.join(repo, 'out', 'lic008-prepare-approved-' + plan.experimentId);
validatePermissionSource(permissionBytes,permissionPin,permissionExpected);
need(Date.now()<expires.getTime(),'Issuance window elapsed');
fs.mkdirSync(out);
const contextHash = hash(bytes(context));
const record = { scope: 'TEST_ONLY_PREPARE_OWNER_PERMISSION', stage: 'Prepare', candidate, provenanceSha256: pin,
  ownerSid, experimentId: plan.experimentId, issuedUtc: utc(now), expiresUtc: utc(expires),
  ownerContextSha256: contextHash, ownerInputSha256: hash(bytes(input)), ownerDecisionSha256: context.decisionSha256,
  challenge: `CONFIRM Prepare ${plan.experimentId} ${context.controllerInputSha256} ${contextHash}`,
  permissionSource,
  physicalExecuted: false, liveOwnerAuthenticated: false, securityAccepted: false, productionAccepted: false };
const files = { 'profile.json': bytes(profile), 'owner-input.json': bytes(input), 'owner-context.json': bytes(context),
  'reviewed-permission.json': bytes(record), 'permission-source.json': permissionBytes };
for (const [name, data] of Object.entries(files)) fs.writeFileSync(path.join(out, name), data, { flag: 'wx' });
fs.writeFileSync(path.join(out, 'manifest.json'), bytes({ files: Object.entries(files).map(([name, data]) => ({ name, sha256: hash(data) })) }), { flag: 'wx' });
console.log(JSON.stringify({ output: out, ...record, diagnosticPasses: 2, diagnosticRefusals: 2 }));
