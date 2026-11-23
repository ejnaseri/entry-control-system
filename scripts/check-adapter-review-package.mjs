// Read-only document/evidence consistency checks. NOT crypto/native acceptance.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = relative => readFileSync(path.join(root, relative));
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const oldBytes = read('docs/licensing/evidence/adapter-entry-claim-bindings-v1.json');
assert.equal(hash(oldBytes), '1e15afb69759594c2031a0c36f90a61ff7d358016fc94b76b6bb2ea12a4c02e0');
const old = JSON.parse(oldBytes);
const sourceBytes = read('out/lic008-retained-reconciliation-32eab98043c34f8bb70d44a4f3f12b11.json');
assert.equal(hash(sourceBytes), '6919bad991a3817e54ca79ffe785a6c09a8c49dcace8b514f488b01cd7cde5b8');
const source = JSON.parse(sourceBytes);
const candidate = JSON.parse(read('docs/licensing/evidence/adapter-entry-claim-bindings-v2.json'));
const selected = {
  'AE-001': ['setup.restricted.create-rsa-wrapping-key', 'setup.app-readable.create-rsa-wrapping-key', 'setup.publish-control-set'],
  'AE-002': ['guardian.restricted.reopen-policy-decrypt'],
  'AE-003': ['guardian.restricted.reopen-policy-decrypt', 'guardian.app-readable.reopen-policy-decrypt'],
  'AE-004': ['guardian.restricted.private-export-denied', 'guardian.app-readable.private-export-denied'],
  'AE-005': ['app.restricted.open', 'app.app-readable.open-decrypt-control', 'child.restricted.open', 'child.app-readable.open-decrypt-control', 'child.token-identity', 'app.child-probe-execution'],
  'AE-007': ['guardian.restricted.reopen-policy-decrypt', 'guardian.app-readable.reopen-policy-decrypt', 'app.restricted.open', 'app.app-readable.open-decrypt-control', 'child.restricted.open', 'child.app-readable.open-decrypt-control'],
  'AE-008': ['guardian.envelope-negative-matrix'],
  'AE-009': ['guardian.restricted.reopen-policy-decrypt', 'guardian.app-readable.reopen-policy-decrypt'],
  'AE-011': ['setup.restricted.delete-owned-key', 'setup.app-readable.delete-owned-key'],
};
function validate(index) {
  assert.equal(index.revision, '0.2');
  assert.deepEqual(index.reports, old.reports, 'Original hashes/raw statuses must remain unchanged');
  for (const flag of ['securityAccepted', 'productionAccepted', 'fullEvidenceReconciled']) assert.equal(index[flag], false);
  assert.deepEqual(index.requiredEvidenceExcludes, ['V2']);
  assert.equal(index.claims.length, 14);
  assert.equal(new Set(index.claims.map(c => c.id)).size, 14);
  const reports = new Map(index.reports.map(r => [r.id, r]));
  const dependencies = new Map(index.dependencies.map(d => [d.id, d]));
  assert.equal(dependencies.size, 4);
  for (const claim of index.claims) {
    const predecessor = old.claims.find(c => c.id === claim.id);
    assert(predecessor);
    assert.deepEqual(claim.reportRefs, predecessor.reportRefs);
    const expected = claim.reportRefs.flatMap(id => {
      const report = reports.get(id); assert(report);
      return report.results.filter(r => (selected[claim.id] ?? []).includes(r.id)).map(r => ({
        reportId: id, reportSha256: report.sha256, resultId: r.id, rawStatus: r.status,
      }));
    });
    assert.deepEqual(claim.resultBindings, expected, 'Explicit result tuples must match actual selected raw rows');
    const required = claim.id === 'AE-007' ? ['DEP-V4-REBOOT'] : claim.id === 'AE-009' ? ['DEP-V5-MISSING-KEY'] : claim.id === 'AE-010' ? ['DEP-V6-OPERATOR', 'DEP-V7-OPERATOR'] : [];
    assert.deepEqual(claim.metadataDependencies, required);
    for (const id of required) assert(dependencies.has(id));
  }
  for (const id of ['DEP-V4-REBOOT', 'DEP-V5-MISSING-KEY']) {
    const dep = dependencies.get(id);
    const observed = source.results.find(r => r.id === dep.namespace); assert(observed);
    assert.equal(dep.experimentId, observed.experimentId);
    assert.equal(dep.sourceSummarySha256, observed.summarySha256);
    assert.equal(dep.sourceCheckpointSha256, observed.checkpointSha256);
    assert.deepEqual(dep.metadata, observed.observations);
  }
  for (const legacy of old.operatorOnlyHistorical) {
    const dep = dependencies.get(`DEP-${legacy.id}-OPERATOR`);
    assert.equal(dep.verifiedBy, 'HISTORICAL_OPERATOR_RECORD_ONLY');
    assert.equal(dep.sourceSummarySha256, legacy.summarySha256);
    assert.equal(dep.document, legacy.document);
  }
}
validate(candidate);
const bad = [
  c => { c.claims[0].resultBindings[0].resultId = 'invented.pass'; },
  c => { c.claims[0].resultBindings[0].rawStatus = 'FAILED_OR_UNAVAILABLE'; },
  c => { c.claims[0].resultBindings[0].reportSha256 = '0'.repeat(64); },
  c => { c.claims[0].resultBindings = []; },
  c => { c.claims.find(x => x.id === 'AE-007').metadataDependencies = []; },
  c => { c.dependencies.find(x => x.id === 'DEP-V5-MISSING-KEY').metadata.keyRecreationAttempted = true; },
  c => { c.dependencies.find(x => x.id === 'DEP-V4-REBOOT').experimentId = '0'.repeat(32); },
  c => { c.securityAccepted = true; },
  c => { c.claims[0].reportRefs.push('v2/unknown.json'); },
  c => { c.dependencies.find(x => x.id === 'DEP-V7-OPERATOR').verifiedBy = 'INDEPENDENT_PHYSICAL_ATTESTATION'; },
];
for (const mutate of bad) {
  const clone = structuredClone(candidate); mutate(clone); assert.throws(() => validate(clone));
}
const headerBytes = 8 + 2 + 2 + 1 + 1 + 16 + 8 + 32 * 3 + 4 + 12 + 384;
assert.equal(headerBytes, 534);
assert.equal(Buffer.byteLength('ENTRY_CONTROL_SYSTEM', 'ascii') + headerBytes, 554);
assert.equal(1048576 + headerBytes + 16, 1049126);
const contract = read('docs/licensing/plans/LICENSING_ADAPTER_OPERATION_CONTRACT_V02.md').toString('utf8');
for (const exact of ['534 bytes', '554 bytes', '1049126 bytes', 'PROPOSED_NOT_ACCEPTED']) assert(contract.includes(exact));
console.log(`PASS: 14 claims/14 unchanged reports, explicit tuples and lifecycle dependencies; ${bad.length} corrupt-index refusals; candidate size arithmetic. Not crypto/native approval.`);
