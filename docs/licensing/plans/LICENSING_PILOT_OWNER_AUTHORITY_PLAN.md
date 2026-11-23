# Pilot owner authority and durable stage consumption: bounded proposal

Date: 2026-10-12. Originally CHG0141 / LIC-EV-0210; finalized CHG0142 / LIC-EV-0211.
Revision: 0.1-final-proposal.
Status: AUTHOR_FINAL_PROPOSAL_ADOPTION_PENDING_NOT_IMPLEMENTED.

This addresses findings in the [owner source review](../reviews/LICENSING_PILOT_OWNER_CONNECTION_REVIEW.md).
It is not permission for an actual stage or new protected file. Preserve frozen
specification0.1/ownership0.2/collision0.3 and packet0.2; a narrowly reviewed,
adopted and hash-bound successor is required before new path/ACL implementation.

## 1. Owner authority: explicit local action, not self-claimed JSON

Proposed test-only method: one explicitly confirmed stage in the reviewed local
controller under the real owner's elevated primary token. Pin the expected owner
SID through the reviewed approval/configuration channel, not the same untrusted
request field. Capture the actual primary TokenUser, refuse impersonation,
different user/SYSTEM/service account or non-elevated context. Display exact
stage, experiment, live host/boot, package/source/kit/plan pins and stage effects;
require deliberate owner confirmation of that exact preview before reservation.
Changes to any reviewed input require a new preview/confirmation, never reuse.

A stored matching hash or SID remains evidence of correlation only. The future
producer must directly create the decision from that local confirmation and live
identity rather than upgrade a generic ValidateOwnerInput result into authority.
No signing key/account/password/privilege acquisition is proposed. This proves
the local confirmed executor, not remote signer identity or resistance to a
malicious administrator. If remote approvals become necessary, that is a
separate signature/trust-anchor design, not a hidden fallback.

## 2. Exact proposed new records

Only these three fixed slots within the already fixed test root:

- controller/owner-prepare-consumed.json
- controller/owner-fresh-process-consumed.json
- controller/owner-finish-consumed.json

Proposed owner Administrators(S-1-5-32-544), protected DACL with only SYSTEM and
Administrators full control, controller as creator; no inheritance, service
access, arbitrary path/filename, overwrite, deletion or ACL repair. Use existing
same-handle path/type/DACL checks and CreateNew/flush/readback mechanisms.

Exact field order/schema is now specified in section5 and the machine-readable
contract. It binds stage/experiment, decision ID/hash, owner, approved context,
input/plan/binding/packet/source/kit/provenance/package/dependency/profile/host/
boot pins and previous checkpoint/evidence. Security/production flags false.
No private keys, secret buffers, private paths or exception text.

One slot per stage per experiment-root means a different decision ID cannot
restart the same partial stage. Compare prior slots for decision-ID reuse too.
Presence, malformed/empty/truncated content, wrong protection or unknown I/O
all block; none means absence or grants resumption. Never delete/replace intent
because expiry passed or a success checkpoint is missing.

## 3. Ordering and crash boundary

Prepare: pure pinned-input review and explicit live-owner confirmation; actual
host/boot/collision checks; create new root/controller directory with exact
protection; reserve Prepare slot with CreateNew, flush and independent readback;
only then remaining package/plans/report directories and service registrations,
followed by the existing role coordinator. Bootstrap ordering change must be
spelled out in the successor, not silently applied to packet0.2.

Minimal root/controller creation necessarily precedes writing an in-root journal.
A crash there leaves root present: existing collision rules refuse Prepare and
retain it. Do not claim a journal exists before those two filesystem operations,
and do not create an out-of-root fallback. No service/key operation may precede
successful journal flush/readback.

Fresh/Finish: verify exact protected previous-stage evidence, live host/boot/
owner, approved package and current stopped-service state; confirm exact new
stage; reserve its fixed slot and independently read back; only then launch.
Reserved intent never becomes a completion checkpoint. Existing independently
validated checkpoints retain their meaning; no overwrite/state editing needed.

After restart, a reserved or ambiguous slot blocks that stage even if there is
no report/checkpoint. Retain for investigation; no automated resume, reapproval
bypass, rollback, cleanup or forced service stop. A later stage requires its
original completed predecessor checkpoint and a separate owner confirmation.
Success does not delete the consumed slot.

## 4. Required evidence before activation

Managed cases: actor mismatch, request replacement after preview, each slot's
exact path/owner/ACL/schema/context; different decision for same stage; prior-ID
reuse; empty/truncated/malformed/unknown reservation; before/after write/flush/
readback failure; partial bootstrap; restart replay; no checkpoint shortcut.
Use managed/restart models without claiming actual durability.

Native pilot prerequisites: approved amended packet/built kit, real owner
confirmation and primary token, same-handle ACL/file readback, independent live
observer and exact allowed operations. Physical tests must separately exercise
new-process replay refusal, ordinary reboot persistence and ambiguous writes.
Power-loss/power-cut guarantees remain NOT_TESTED until real evidence; flush is
not by itself a transactional or tamper-proof durability claim.

No DB/client/product Guardian changes. No Windows lifecycle gate or x86/ARM
target; intended Windows10/11 x64 boundary remains unchanged and unproven as a
fleet. Owner is still the sole human decision owner; author/independent review
and technical/native/security approval remain explicitly separate.

## 5. Closed schemas and owner trust input

The [machine-readable proposal](../../../licensing/adapter-evidence/pilot-implementation/owner-authority-contract-v01.json)
lists the exact ordered fields. Maximum UTF-8 JSON bytes2097152, depth12; require
all fields, no null/duplicate/unknown member, exact types/case and canonical
serialization for hashes. No defaults turn a missing field into approval.

Owner context fields: schemaVersion1, scope TEST_ONLY_OWNER_CONFIRMATION_CONTEXT_V1,
expectedOwnerSid, controllerInputSha256, successorPacketSha256, decisionSha256,
stage, experimentId. Controller input and decision use the existing closed
candidate shapes. The context's canonical SHA256 is supplied separately via the
owner-reviewed configuration channel, not extracted from its own file/request.
No extra context file under the protected root is proposed. Explicit operator
verification/selection of the expected account and context pins is a precondition
outside an untrusted request; availability of CLI values alone does not satisfy
it. A context containing the same self-claimed SID is not authenticated owner
configuration. Fail closed if that reviewed configuration is unavailable.

At a real console (input AND output not redirected), display exact immutable
snapshot/pins/stage effects and challenge:
CONFIRM <stage> <experimentId> <controllerInputSha256> <ownerContextSha256>
Only exact case-sensitive response accepted; EOF/cancel/blank/yes/redirected
input or changed context refuses. Hash UTF-8 challenge without newline into
confirmationSha256, but that hash is NOT proof of consent by itself. Producer
must directly capture the successful live prompt and primary owner token.
Recheck token/host/boot/package/context before reservation and each launch.
Never upgrade diagnostic OwnerAdmission.Validate output into confirmation.

Consumed record fields, in exact order: schemaVersion, scope, stage, experimentId,
decisionId, ownerSid, ownerContextSha256, ownerDecisionSha256,
controllerInputSha256, bindingSha256, planSha256, successorPacketSha256,
hostBindingSha256, bootIdentity, sourceManifestSha256, provenanceSha256,
kitManifestSha256, packageManifestSha256, dependencyInventorySha256, profileSha256,
previousCheckpointSha256, previousEvidenceSha256, reservedUtc, state,
confirmationSha256, securityAccepted, productionAccepted.
schemaVersion1; scope TEST_ONLY_OWNER_STAGE_CONSUMED_V1; state RESERVED only.
Digests64 lowercase hex; IDs32 lowercase hex; numeric canonical account SID.
Prepare previous hashes empty; Fresh/Finish previous hashes64hex. UTC reserved
time must be inside the existing decision's positive<=24h UTC window and match
the freshly captured local time at reservation; not trusted-clock assurance.
Stage/path/experiment and every pin must match admitted context. No state update,
COMPLETED flag, append/repair API or success-checkpoint substitution allowed.

## 6. Persistence and race rules

Use CREATE_NEW, zero sharing during write, protected descriptor at creation,
same-handle path/type/owner/DACL validation, bounded write, Flush(true), close,
separate protected readback and exact byte/hash/schema check. Only readback
success returns a private reservation proof to the exact coordinator operation.
No caller-supplied DTO or diagnostic result can construct that proof. Once the
write was attempted, all failures retain and block; never reserve again.

Fresh/Finish must validate prior stage slot(s) against the completed protected
checkpoint/plan/evidence chain before creating their current slot. Require every
earlier slot and reject repeated decision ID across stages. Current slot is
attempted exactly once using CREATE_NEW; any collision or unknown I/O blocks.
Do not implement read-absent-then-overwrite. Concurrent processes compete for the
same fixed stage slot; only the successful writer AND independent reader can
proceed. After success a new process still sees RESERVED and refuses that stage;
the original live coordinator alone continues with its private reservation proof.

Prepare root/controller creation is the only pre-reservation filesystem change;
no copy/service/key creation before verified reservation. An early crash leaves
root present and blocks all new Prepare attempts; do not adopt its contents.
Bootstrap completion must carry direct validated native provenance, not arbitrary
ServiceReceipt arrays. Preserve same-process reservation proof through bootstrap
and ordered actions; it is not reconstructed from stored journal after restart.

## 7. Finalization boundary

The proposal is ready for scoped adoption and successor binding, NOT adopted or
implemented by this document. A future successor must explicitly add only three
fixed file rules, change the bootstrap order and require local confirmation plus
durable stage reservation. Existing v02 packet/raw hashes remain unchanged;
new proposal validator must not make old runtime consume this new contract.
Next scoped adoption/binding, then producer/journal implementation with gates
closed. Independent/native/security/production acceptance remains false.
