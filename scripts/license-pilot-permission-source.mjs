// Provenance validation only. This neither authenticates the owner nor grants execution.
import {createHash} from 'node:crypto';
const need=(ok,message)=>{if(!ok)throw new Error(message);};
export const permissionHash=bytes=>createHash('sha256').update(bytes).digest('hex');
export function validatePermissionSource(raw, expectedHash, expected, now=new Date()) {
  need(Buffer.isBuffer(raw) && raw.length>0 && raw.length<=16384,'Permission record size refused');
  need(/^[a-f0-9]{64}$/.test(expectedHash) && permissionHash(raw)===expectedHash,'Reviewed permission hash required');
  const p=JSON.parse(raw.toString('utf8'));
  // Closed canonical JSON rejects duplicate keys, invalid UTF-8 and hidden fields.
  need(p && !Array.isArray(p) && Buffer.from(JSON.stringify(p)).equals(raw),'Canonical permission JSON required');
  const keys=['schemaVersion','scope','decision','stage','ownerSid','provenanceSha256','successorPacketSha256','approvalReference','approvedUtc','expiresUtc'];
  need(Object.keys(p).length===keys.length && keys.every(k=>Object.hasOwn(p,k)),'Permission fields refused');
  need(p.schemaVersion===1 && p.scope==='TEST_ONLY_REVIEWED_PREPARE_PERMISSION_SOURCE_V1' &&
    p.decision==='APPROVE_PREPARE' && p.stage==='Prepare' && expected.stage==='Prepare','Explicit Prepare permission required');
  need(/^S-1-5-21-(?:[1-9][0-9]*-){3}[1-9][0-9]*$/.test(p.ownerSid) && p.ownerSid===expected.ownerSid,'Permission owner mismatch');
  for(const key of ['provenanceSha256','successorPacketSha256'])
    need(/^[a-f0-9]{64}$/.test(p[key]) && p[key]===expected[key],'Permission candidate mismatch');
  need(typeof p.approvalReference==='string' && /^[A-Za-z0-9][A-Za-z0-9:._/-]{7,255}$/.test(p.approvalReference),'Reviewable approval reference required');
  const parse=s=>{need(typeof s==='string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.000Z$/.test(s),'UTC timestamp required');
    const n=Date.parse(s);need(Number.isFinite(n) && new Date(n).toISOString()===s,'Invalid timestamp');return n;};
  const start=parse(p.approvedUtc),end=parse(p.expiresUtc),current=now.getTime();
  need(Number.isFinite(current) && start<=current && current<end && end>start && end-start<=86400000,'Permission expired/future/oversized window');
  return Object.freeze({...p,recordSha256:expectedHash});
}
