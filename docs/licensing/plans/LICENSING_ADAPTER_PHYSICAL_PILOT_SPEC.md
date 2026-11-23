# Adapter physical pilot specification — proposed v0.1

Date: 2026-10-10. CHG0108 / LIC-EV-0177.
ID: ADAPTER-PHYSICAL-PILOT-01. Status: DRAFT_NOT_REVIEWED_NOT_EXECUTABLE.
Baseline:1794baf, which commits Track A0.1.2 corrections and EV0174–0176 reviews.
This document specifies future TEST_ONLY behavior; no physical controller, role
binary or runnable kit is produced. No service/key/ACL change is authorized.

## 1. Scope and gates

Read with the preserved [fresh evidence plan0.1](LICENSING_ADAPTER_FRESH_EVIDENCE_PLAN.md),
[contract0.2](LICENSING_ADAPTER_OPERATION_CONTRACT_V02.md),
[routing correction](LICENSING_ADAPTER_OPERATION_CONTRACT_V03.md) and
[Track A corrective review](../reviews/LICENSING_ADAPTER_TRACK_A_REVIEW.md).
This fills proposed resource/stage detail without altering preserved plan bytes.
It does not retroactively declare its cases complete. Scope:
TEST_ONLY_SOFTWARE_KSP_ADAPTER_EVIDENCE_V1, current reviewed development host
only; product target remains Windows10/11 x64, no fleet/platform acceptance.

Sequence: exact specification review → separately authorized inert physical-kit
implementation/build → source/package/controller/ACL and pure-negative review →
separate owner authorization of exact package and Prepare → returned evidence
review → separately authorized VerifyFreshProcess → evidence review → separately
authorized Finish. There is no automatic transition to physical execution.
Author remains coordinator, user remains sole Product/security decision owner
and conditional physical executor; no human security officer is invented.
AI-agent review is bounded technical assessment, not Security assurance.

Track A's framework-dependent pure runner is not reused as a physical role EXE.
Future physical kit needs a separate closed self-contained win-x64 package,
managed role DLL/apphost/runtime dependency identity, actual child emitter and
reviewed controller. SDK10.0.400/runtime10.0.11 are proposed pins, not universal
Windows requirements. No implicit network restore/runtime upgrade.

## 2. Exact names and admission before mutation

ExperimentId and every RunId:32 lowercase hexadecimal characters, generated
once from OS randomness; arbitrary caller paths/names refused. The three role
names and root below are fixed, never constructed from unrelated user input.

| Resource | Exact proposed name / condition |
| --- | --- |
| New workspace output | E:/EntryControlSystem/out/lic008-adapter-evidence-<ExperimentId>/; create-new, all ancestors checked, never reuse an existing tree |
| Machine root R | C:/ProgramData/Ecs.Lic008.EntryEvidenceV1; must be absent, including dangling/reparse entries; do not adopt/delete on collision |
| Setup service | Ecs.Lic008.EntryEvidenceV1.Setup; LocalSystem, own enabled unrestricted service SID, Manual |
| Guardian service | Ecs.Lic008.EntryEvidenceV1.Guardian; exact virtual account NT SERVICE/Ecs.Lic008.EntryEvidenceV1.Guardian, Manual |
| App service | Ecs.Lic008.EntryEvidenceV1.App; exact different virtual account NT SERVICE/Ecs.Lic008.EntryEvidenceV1.App, Manual |
| Restricted key | Ecs.Lic008.EntryEvidenceV1.TEST_ONLY.<ExperimentId>.restricted |
| Readable control key | Ecs.Lic008.EntryEvidenceV1.TEST_ONLY.<ExperimentId>.app-readable |

All services are own-process, no auto-start, recovery/restart action, dependency
on product services or interactive desktop. Exact quoted binPath contains only
the reviewed R/bin apphost and fixed role/plan arguments; no shell interpretation.
App spawns one actual child of that reviewed apphost under its existing primary
token, without credentials/elevation/impersonation. Verify user SID, enabled
service SID, token type/elevation and child artifact before key operations.

Before Prepare writes anything: validate approved source/package/kit/plan pins,
closed package inventory, x64 host and exact approved host evidence identity;
check all three registrations/root absent, ancestors plain and two exact key
names absent using Software KSP machine/SILENT opens. Unknown/error does not
mean absence. No provider enumeration, persistent probing keys or old-state
cleanup. Service SIDs are derived from exact names and verified numerically by
the roles after registration; locale-dependent account strings are never ACL
identities. If post-registration SID/token checks fail, retain partial state,
do not create keys and do not automatically remove registrations.

Bootstrap order is fixed: controller creates/validates public root/bin/plans/
controller/report directories and pins binaries/plans; only then registers
the three services. Setup-create makes protected/guardian-work/shared directories
as SYSTEM, applies/verifies their final protected DACL/owner before writing any
intent/ownership/fixture bytes. Guardian/App initially only need bin/plans
access. Controller does not traverse private directories or attempt to grant
itself rights when SYSTEM-owned construction cannot complete.

Fresh host inventory records actual OS/build/architecture/runtime and a locally
reviewed host binding before mutation; historical22000 is not a fresh measurement.
Unknown/different host is a pre-mutation refusal pending a revised review.
Code-name search found this namespace proposed only in existing planning docs,
not in current controller/candidate code; live namespace/key collision checks
were NOT_RUN and must still occur. No reference to V1–V7 as recovery code.

## 3. Directory/file inventory and proposed exact DACLs

S=SYSTEM numeric SID S-1-5-18; A=Administrators S-1-5-32-544;
G/P=verified exact Guardian/App service SIDs. Setup uses SYSTEM, not an added
broad Setup-account grant. Every DACL is protected, non-null, exact allow ACEs
only: no inherited ACE, deny/callback/object ACE, unknown principal or duplicate.
Flags on directory ACEs: ObjectInherit|ContainerInherit (0x03); ordinary-file
ACEs flags0. Child directories/files receive explicitly set protected DACLs,
not reliance on inherited ambient ProgramData permissions. Owner is A for
controller-created public directories/files; S for Setup/role-created objects.
No owner substitution is used as permission bypass.

Exact file masks: FullControl F=0x001F01FF; Modify M=0x001301BF;
Read Rf=0x00120089; directory ReadAndExecute Rd=0x001200A9.
These file masks are NOT CNG key rights. Builder/controller validation must
test exact native read-back forms and reject unexpected normalization; never
silently accept broader masks. Template notation below is a closed proposed
manifest, not executable SDDL or an already accepted ACL policy.

| Exact path beneath R | Directory principals/masks | Exact contained files and file masks |
| --- | --- | --- |
| R itself | S:F,A:F,G:Rd,P:Rd | no direct files; only directories below |
| bin/ | S:F,A:F,G:Rd,P:Rd | exact future package-manifest entries; S:F,A:F,G:0x001200A9,P:0x001200A9 (read/execute binaries) |
| plans/ | S:F,A:F,G:Rd,P:Rd | prepare.json, fresh-process.json, finish.json create-new only when separately authorized; S:F,A:F,G:Rf,P:Rf |
| controller/ | S:F,A:F | run-admission.json, prepare-checkpoint.json, fresh-process-checkpoint.json, finish-checkpoint.json, final-summary.json; S:F,A:F |
| shared/ | S:F,A:F,G:Rd,P:Rd | public-control.json, restricted-envelope.bin, app-readable-envelope.bin, restricted-expected-hash.json, app-readable-expected-hash.json; S:F,A:Rf,G:Rf,P:Rf |
| protected/ | S:F,G:Rd | restricted-intent.json, app-readable-intent.json, restricted-owned.json, app-readable-owned.json; S:F,G:Rf |
| guardian-work/ | S:F,G:M | same two envelope/hash basenames as staging copies; S:F,G:M; no App/Administrator ACE |
| setup-reports/ | S:F,A:Rd | <approved RunId>.json; S:F,A:Rf; Setup writes as SYSTEM |
| guardian-reports/ | S:F,A:Rd,G:M | <approved RunId>.json; S:F,A:Rf,G:M |
| app-reports/ | S:F,A:Rd,P:M | <approved RunId>.json, including one separately assigned child RunId; S:F,A:Rf,P:M |

Roles cannot write bin/plans/controller. App has no access to protected or
guardian-work. SYSTEM publishes shared files only after validating Guardian
staging digest/content/ownership; never lets App write the positive-control
fixture or lets public content become private ownership authority. Administrator
controller never reads protected records: Guardian/Setup compare them internally
and emit bounded evidence. No blanket parent grant to Users/Everyone/interactive
operator. Administrator/SYSTEM can override local controls: custody hashing is
not protection against a hostile administrator or compromised role.

The role report write privilege is confined to its own directory. Reports are
not immutable merely because their hash is recorded. Create-new approved RunId,
closed expected report inventory, per-stage pre/post hashes and immediate
controller read-back are required; no claim of cryptographic report attestation.
Maximum10 role reports over all three stages; each JSON input/report capped at
2MiB before parse; expected report IDs known before role launch. Extra files,
unbounded directory content or unknown schema properties refuse progression.
Two envelope files use the candidate1049126-byte maximum. No logs/dumps/temp
files outside the specified inventory. Runtime unexpected output is retained
as an incomplete run, not recursively deleted to restore an apparent PASS.

## 4. Exact key policy and private lifecycle

Only Microsoft Software Key Storage Provider, machine RSA3072, decryption-only
usage, export policy0, OAEP-SHA256 with SILENT; memory AES256-GCM random key32,
nonce12/tag16. No signing algorithm, TPM, DPAPI, alternate provider or fallback.
Restricted protected DACL: exactly S and G allow GenericAll0x10000000 flags0.
Readable control: exactly S,G,P with the same mask/flags. Proposed Software-KSP
read-back accepts only 0x10000000 or historical provider-mapped0xD01F01FF for
each exact principal; no other mask/provider/ACE accepted. This historical form
is a proposed pilot rule subject to review, not automatic product authorization.
GenericAll on the test keys is deliberately broader than future product
least-privilege design; these keys never hold customer/Vendor/license secrets.

Setup writes a create-new intent before each create, sets algorithm/size/export/
usage/DACL before finalize, reopens and verifies policy/public identity, then
writes owned record immediately. Create once per exact name. A partially
finalized key without a complete ownership chain is retained for investigation,
not adopted/deleted based on its name. Never recreate on open failure.
Guardian opens both rightful keys, verifies context/policy/DACL/public identity,
then seals/opens fixture bytes. Private export negative checks use exactly
GenericPrivateBlob, Pkcs8PrivateBlob and OpaqueTransportBlob: export success is
FAIL even if buffer cleared; only classified native export refusal is a PASS.
Unexpected wrapper/format/parse failure is unknown, not export-denied evidence.

Persist only fixture ciphertext/envelope, public SPKI identity, independent
TEST_FIXTURE context and expected random-payload hash. Do not persist plaintext,
data key, handles or raw provider exceptions. Supplied stateHash is not the Core
logical License-state hash. Actual opened plaintext is compared internally,
never returned as runtime authority; primitive success durable=false/NONE.
AAD/context mutation tests are bounded to copies in memory; original persisted
fixtures/keys/ACLs stay unchanged. Clear key/plaintext buffers only after worker
completion. Public fixture/hash matching is not same-context anti-rollback.

## 5. Per-stage read/write/launch manifest

Each stage has fixed action, source/package/kit/spec/profile digests, ExperimentId,
new RunIds, previous checkpoint/original-evidence hashes and explicit owner
authorization. Controller validates all pins; actual roles validate their own
loaded DLL/apphost/dependencies and read-only plan before CNG. Actual child
records its own identity; it cannot echo parent's reported artifact hash.

| Stage | Exact allowed mutations/role reports | End condition / mandatory stop |
| --- | --- | --- |
| Prepare | Create absent R/directories/package copies/prepare plan/admission; create exactly3 Manual registrations. Setup-create writes intents/owned keys/public-control and report1, exits. Guardian fixture/policy/export report1, exits. Setup-publish separately launches with a distinct preassigned RunId, validates staging against protected ownership/plan and publishes shared fixtures/report1, exits; no key create/delete/set-policy in this action. App report1 plus actual child report1. Controller writes prepare checkpoint. | Stop completed services, verify Stopped/Manual/PID0; retain both keys/fixtures/all evidence. No automatic fresh-process or cleanup. Any failed/ambiguous step retains partial state; no rerun. |
| VerifyFreshProcess | Read pinned Prepare state, create fresh-process plan; launch fresh Guardian report1 and App/child reports2 against exact existing keys/fixtures; create fresh checkpoint. | No create/finalize/delete/set-property/DACL/package replacement. Same public key/fixture identities and App contrast required. Stop only completed workers; Stopped/Manual/PID0 required for stage PASS. Not reboot evidence. |
| Finish | Read pinned prior evidence, create finish plan. Setup validates both private ownership chains and deletes exactly2 owned keys, with individual progress reports in its one report. Guardian report1 verifies controlled absent keys against retained fixtures without creation. Controller creates finish checkpoint/final summary. | Retain files/three registrations, services Stopped/Manual/PID0. No registration removal, directory/file purge, old key cleanup or reinstall simulation. Never rerun Finish blindly after partial deletion. |

Reports total5+3+2=10. All five Prepare action RunIds and exact create→Guardian→
publish→App/child ordering are fixed in the initial plan; publication is an
explicit subaction of one owner-authorized Prepare, not a hidden launch or
second key creation. Setup-create must finish before Guardian, Guardian must
finish before Setup-publish, publication must finish before App. Each action
uses a fresh service process and completed-worker check. Never keep Setup
waiting with an open native worker while another role runs. A missing or
uncertain prerequisite stops the stage; do not retry a subaction automatically.

Checks for FEP-P03 compare both exact keys under Guardian and App/actual child
with unchanged provider and flags. Raw BAD_KEYSET is recorded as observed unknown;
no generic access-denied assertion. A controlled contrast may be assessed later
under exact evidence-qualified classification, not inferred from one error.
Finish tests only controlled owned-key absence, not generic repair safety.

## 6. Failure, deadlines and retention

ValidateOwnedKey5000ms; Seal/Open10000ms; no concurrent operation on one key,
no queue in this pilot. Budget observed monotonically, no timeout-as-cancellation
claim. Expiry marks unknown, suppresses delivery, blocks any replacement and
retains buffers/handles until the worker really ends. No StopService/kill/restart
while native work is live or uncertain. Hung worker leaves stage INCOMPLETE and
all future actions blocked for manual evidence review; host/process disposition
requires a separate exact recovery plan. No forced native fault injection,
provider disable, ACL corruption, account creation or power interruption.

Controller may stop services only after explicit completed-worker result and
non-running lifecycle confirmation; if stop/status observation is uncertain,
do not start another stage. End-statePASS requires exact stopped Manual services,
not just a successful sc.exe command. Late success never changes unknown to a
durable result or emits a receipt. Reports distinguish observed native status
from model-only F01..08 classifiers. No Store commit/ACK exists in this pilot.

| Failure point | Required disposition |
| --- | --- |
| Pre-mutation collision/pin/host mismatch | refuse, no write/registration/key operation |
| Partial root/copy/ACL/registration | retain exact created state; no automatic cleanup/adoption/next service launch |
| Intent without confirmed ownership | retain intent/key evidence; do not recreate/delete |
| Policy/artifact/token mismatch | no crypto/publication/cleanup; bounded report, retain |
| Worker timeout/hang | unknown, no delivery or overlapping work, retain until reviewed safe completion/recovery |
| One key deleted, next deletion uncertain | record individual disposition; no blind retry, retain fixtures and remaining state |
| Report missing/duplicate/foreign/hash mismatch | incomplete, no later stage or cleanup based on untrusted reports |

All reports use closed allowlisted fields; nested input/provider exceptions
never serialized. Internal key-name/private ownership paths do not appear in
diagnostic error strings; opaque correlation IDs and fixed labels only. No raw
exception fallback from controller stdout/stderr. Future implementation must
test actual role/controller emitters, not assume Track A DTO covers them.

## 7. Non-executable pins and open requirements

| Required executable evidence | Status now |
| --- | --- |
| Exact physical source/role/controller allowlists and SHA256 | NOT_IMPLEMENTED; no approved hash exists |
| Closed self-contained package/kit/provenance/archive pins | NOT_BUILT; Track A pins do not substitute |
| Actual role/child artifact/token emitter regression | NOT_IMPLEMENTED/NOT_RUN |
| Native ACL/SID/path/bootstrap normalization and collision guards | PROPOSED_ABOVE; not accepted or tested |
| Ordered Setup publication subaction / live-worker completion and stop guards | SPECIFIED_REQUIREMENT; exact code/negative tests pending |
| Fresh current-host binding and owner exact kit/stage authorization | NOT_CAPTURED/NOT_OBTAINED |

Thus this is a proposed exact resource/permission/stage specification, not a
complete executable admission packet. No placeholder digest can authorize a run.
Reviewer must assess scope/isolation, proposed masks/ownership, cross-role
publication, lifecycle stopping and absence/cleanup guards before inert kit
implementation is separately authorized. Then actual code/pins/tests need their
own review. Existing Core/NE prerequisites and later release gates are unchanged.

No FEP-P01..05 run, REM-01..04 closure, LIC008/Open003 completion or native-entry
acceptance. No production Guardian/Store/Installer/IPC/Audit implemented. Next:
limited non-author review of this exact specification, resolving findings before
new physical-kit code. Do not execute old controllers or request elevation now.
