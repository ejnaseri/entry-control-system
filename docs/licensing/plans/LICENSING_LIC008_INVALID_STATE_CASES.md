# LIC008 invalid-state and controlled-interruption cases

Date: 2026-10-28. Reviewed source baseline: `38c98c8`, with the separately reviewed
V4 placement changes in progress. Status: `PLANNED_NEW_NATIVE_CASES_NOT_RUN`.

This document specifies W04 and W05 from the [LIC008 completion
plan](LICENSING_LIC008_COMPLETION_PLAN.md). It adds no executable route, approval,
account, service, key or completed test. Case IDs below organize this proposed
suite; they are not new canonical acceptance IDs. Every new native case in both
tables remains **NOT_RUN**. Feasible on the current laptop means suitable after
the new runner and exact resources are implemented and reviewed, not ready to
execute an existing retained package.

The current [V4 export-policy experiment](LICENSING_EXPORT_POLICY_V4_PLACEMENT.md)
is a separate operation. Its result must be reviewed before choosing subsequent
physical work. No W04/W05 fixture may alter that attempt, consumed export-policy
V1/V2/V3, wrapping V1–V7, EntryEvidence resources or production state.

## Existing evidence and its limits

| Evidence | What already exists | What it does not establish |
| --- | --- | --- |
| Wrapping V5 Repair | Historical binary-repair simulation and controlled missing-key refusal with retained envelopes, no recreation. [Retained reconciliation](../evidence/wrapping-retained-evidence-reconciliation.md) records the original summary/checkpoint and 12 referenced hashes. The missing-key report's five `FAILED_OR_UNAVAILABLE` rows remain negative observations. | A general native invalid-state suite, actual product Repair, power-loss recovery, or a new run of these cases. Do not relabel individual error rows as security PASS. |
| Wrapping envelope checks | [Wrapping source](../../../licensing/windows-spike/wrapping-control/Program.cs) has managed wrong-key and wrapped-key/nonce/AAD/ciphertext/tag corruption tests. [V5 worker](../../../licensing/windows-spike/wrapping-repair-control/Program.cs) also runs a native CNG-backed aggregate `guardian.envelope-negative-matrix` in its bounded workflow. | Separate original evidence for every subcase, accepted product context binding or same-context rollback resistance. Current replacement-adapter coverage is still required. |
| Repair/Upgrade/reinstall controller tests | [Repair fixtures](../../../scripts/test-license-windows-wrapping-repair.ps1), [Upgrade fixtures](../../../scripts/test-license-windows-wrapping-upgrade.ps1) and [reinstall fixtures](../../../scripts/test-license-windows-wrapping-reinstall.ps1) test admission refusal before candidate/path mutation, drift, partial SCM operations and retained intent using fakes. Historical V6/V7 lifecycle simulations exist. | Real interruption of those operations. V7 explicitly retains `interruptionPhysicallyTested=false` and `invalidStateRefusalPhysicallyTested=false`; see [operator evidence](../evidence/wrapping-v7-operator-verification.md). |
| Export-policy lifecycle | [Lifecycle tests](../../../licensing/adapter-evidence/export-policy-control/ControlLifecycleTests.cs) inject create/finalize/inspect/reopen/owned/completion/recovery failures, corrupt journal bindings and verify no subsequent key operation. | Native CNG failure injection or terminating a live worker at those boundaries. |
| Adapter store and controller | [Store tests](../../../licensing/adapter-evidence/export-policy-control/ControlStoreTests.cs) use managed path/role tables and binary descriptors. [Controller tests](../../../licensing/adapter-evidence/export-policy-control/ControlControllerTests.cs) use fake runs plus owner guards that throw before native access. | Native file/ACL/link races, actual process interruption, production transaction durability or proof from STOPPED/PID0 alone. |
| Consumed export-policy V3 | [Exact original evidence](../evidence/export-policy-control-v3-run-20261028/README.md) records LocalSystem Setup completion and two owned-key journals, followed by controller `UNKNOWN`; Guardian was not borrowed. | An intentional fault case or proof of a particular failed predicate. The abandoned first V3 console was closed without CONFIRM and is also not an interruption test. |

Historical aggregate success and synthetic coverage are prerequisites and design
references. They do not change a new row's execution status.

## Common contract and classification

Each case gets a fresh namespace, immutable case manifest, exact fixture/mutation
inventory, source/package/runtime pins, owner/host/boot binding, expiry and one-use
intent. Use only synthetic secrets. A fresh positive control must succeed with the
same provider/API/profile before a negative crypto result can be interpreted.
If positive admission fails, the negative case is inconclusive, not proved denial.

Record raw bounded stage/category/HResult and exact evidence hashes separately
from the reviewer disposition. Proposed suite dispositions are
`EXPECTED_REFUSAL_OBSERVED`, `UNEXPECTED_ACCEPTANCE`, `INCONCLUSIVE`, and
`NOT_RUN`; these are not existing native wire outcomes or licensing states.
Existing native `UNKNOWN`, `BOUNDARY_FAILURE`, `CONTROL_INCONCLUSIVE` and
`POLICY_DIFFERENTIAL_OBSERVED` retain their exact meanings. Security, production
and matrix acceptance remain false throughout this suite.

`NTE_BAD_KEYSET` (`0x80090016`) alone does not prove a missing key or access denial.
Provider unavailability, absence, wrong identity, ACL refusal, malformed input and
unknown errors remain distinct. The matched export evaluator's known denial and
unsupported results (`0x80090010`/`0x80090029`) must not become a generic allowlist
for these cases. Restricted export returning bytes is a boundary failure; no
error, diagnostic flag or unreadable report authorizes recreation or fallback.

The [adapter decision draft](LICENSING_ADAPTER_ENTRY_DECISION_DRAFT.md) proposes
ADP-F01–F07 recovery categories. Those are draft mappings, not implemented public
states. V5's existing `RECOVERY_REQUIRED` refusal text must not be promoted into
a completed production recovery integration. Accepted C_GATE/C_TXN/C_AUDIT
contracts still own that integration.

Proof for a refusal consists of the admitted fixture and exact fault, the actual
refusal boundary, and evidence that prohibited later operations did not occur.
No output file by itself proves zero key/API calls. The new worker must record
bounded call milestones/counters at reviewed call sites; after abrupt termination,
missing acknowledgements leave the associated effects uncertain. Use independent
read-only inspection of exact owned objects where permitted; never infer native
key absence from directory absence or a name search.

## W04 native invalid-state matrix

All rows are **NOT_RUN in the proposed suite**. `L` means possible on this laptop
with isolated new test objects and no global provider/OS changes. `D` means a
disposable environment or separately implemented product integration is required.
Each listed mutation is a separate fresh case, not several mutations combined in
one observation.

| ID / environment | Fixture and exact fault | Required refusal/proof and preserved effects | Existing coverage / prerequisite |
| --- | --- | --- | --- |
| W04-I01 / L — missing owned key | Establish a successful native unwrap, pin owned public identity and retained envelope; close handles. Delete only that newly created case key once using its verified ownership record, then attempt open-only admission. | Refuse protected work; preserve envelope and marker bytes; no Create/OpenOrCreate, replacement, ACL repair, provider fallback or repair candidate/service-path mutation. Prove intentional deletion and separately observed native absence; preserve the raw open error. | V5 historical controlled case; repeat under the new reviewed adapter/runner. No deletion of any retained key. |
| W04-I02 / L — wrong key/public identity | Create two fresh keys A and B. Envelope belongs to A; present B or a record with B's public digest to an operation independently bound to A. Rebind fixture digests so refusal is semantic, not merely a stale hash. | Reject identity before protected decrypt when identity is checked first; a separately declared wrong-key crypto subcase must fail authentication without plaintext delivery. Neither outcome creates or selects a third key. | Managed lifecycle and wrapping negative fixtures; baseline A unwrap and separately verified B identity required. Same-name key replacement is excluded from this row. |
| W04-I03 / L — unsupported key profile | One fixture each for RSA length, usage, export policy, machine/user-key expectation or provider identifier mismatch. Create only the declared fresh malformed-profile key, or supply the mismatched record where native creation is unsupported. | Reject metadata/admission before private export/decrypt. Report whether the fault was materialized natively or refused at fixture creation. A record-only mutation cannot count as a native provider/profile test. | NativeKeys/lifecycle synthetic checks. No global KSP disable, provider installation or fallback. |
| W04-I04 / L — key owner/DACL | On one fresh owned key, test wrong owner, missing rightful Guardian ACE, unprotected/inherited DACL, and an extra principal ACE as separate cases. Read back the exact applied descriptor before evaluation. | Refuse identity/policy admission before crypto; preserve both expected and actual descriptor hashes. No automatic normalization, broadened access, alternate key or decryption result. A native inability to set the fixture is NOT_RUN/INCONCLUSIVE for that mutation. | Existing descriptor/policy fixtures; fault setter limited to the case key, ownership checked before modification. |
| W04-I05 / L — store owner/DACL | Fresh files/directories with each wrong owner, inheritance or extra/missing ACE condition; keep content otherwise valid and pinned. | Native handle/descriptor admission refuses before content reaches the protected operation. No ACL repair or fallback path; original fixture bytes remain. | Managed `ControlStoreTests`; native descriptor readback still missing for these cases. Never alter ProgramData parent ACLs. |
| W04-I06 / L — path/handle hazards | Separate case-local reparse point, file hardlink, held writer and replacement attempt. Any link target is another pinned synthetic sentinel inside the same case inventory. | Refuse wrong final path/type/link count or conflicting open. Sentinel bytes/hash unchanged. For a blocked replacement, report the actual OS refusal; do not claim that a substitution occurred. | Store code pins parents, opens with reparse checks and validates final handles. Native races must use a bounded handshake, not timing sleeps or arbitrary targets. |
| W04-I07 / L — malformed or cross-context input | Independent duplicate/unknown/omitted JSON fields, zero/oversize/truncated bytes, wrong scope/role/attempt/host/boot/expiry and changed package/runtime pin. Include semantic old-scope fixtures with dependent digests rebound. | Refuse at the declared parser/admission boundary; no key operation or downstream stage. Distinguish noncanonical bytes from canonical-but-wrong context. | Existing pure admission/placement/helper tests. Fault data are separate case fixtures; never edit an issued owner approval or installed runtime. |
| W04-I08 / L — invalid completion journal | Omit or change setup-consumed, intent, owned or complete record separately; include changed public/DACL identities, duplicate arm identity and old scopes. Rebind completion hashes for semantic cases. | Refuse before first key open for an invalid journal chain; for a valid chain whose actual key differs, allow only open/inspect and reject before export/decrypt. Record these two boundaries separately. No synthesized completion or recreation. | Lifecycle tests already distinguish zero key opens from two opens/zero exports. New runner needs native equivalent evidence, not a fabricated successful Setup report. |
| W04-I09 / L — envelope/authentication | From one valid fresh envelope, mutate wrong key, wrapped DEK, nonce, AAD, ciphertext and tag separately. Also test independently expected domain/installation/edition/generation/key identity where the selected adapter contract implements them. | Reject before plaintext delivery; clear temporary DEK/plaintext buffers, no state write or nonce reuse. Corrupt crypto bytes and wrong semantic context are separate results. Unsupported product-context fields stay NOT_RUN until implemented. | Historical aggregate native wrapping negative matrix plus managed cases; no per-field product acceptance inferred. |
| W04-I10 / L — wrong caller/role | Use only newly created case service identities; one worker receives the opposite role's operation. Do not create a Windows user or substitute a filtered administrator for a standard account. | Reject token/owner/service-SID/role admission before protected key/file operations. Capture only bounded identity evidence; no plaintext, credentials or raw exception text. | Managed identity/role tests. Actual standard-account isolation remains separate W03 and requires that real session. |
| W04-I11 / L — consumed/colliding attempt | Precreate the exact case-owned consumption marker or reserved service/root in a separate collision fixture, then invoke the new runner's admission once. | Refuse without overwriting marker, using the colliding object, rerunning Setup or recreating a key. Hash equality plus invocation/call evidence proves retention. | Existing CREATE_NEW and controller one-attempt fixtures. Never select an existing experiment merely to trigger a collision. |
| W04-I12 / D or later product integration — historical valid replay | Offer an older, cryptographically valid envelope/journal with the same context but stale generation/hash to an accepted current-state coordinator. | Accepted CAS/high-water/anchor rules reject stale replay; no rollback of durable state, no replayed write/nonce or new admission. Crypto validity alone is insufficient. | Production native C_TXN/STORE001–005 reconciliation is not supplied by this experimental store. VM/disk rollback and provider disruption are disposable-only variants. |

## W05 controlled worker-interruption matrix

These are **NOT_RUN**. An ordinary caught exception, timeout, owner closing a
console, managed fake failure or normal reboot is not this test. A case must
prove that its specific bounded gate was reached and that the exact worker was
terminated while paused there. All `L` rows require the new termination-capable
test runner; existing export-policy entry points have no such authority.

| ID / environment | Controlled gate | Required retained state and later observation |
| --- | --- | --- |
| W05-T01 / L | After CREATE_NEW consumption record has flushed/read back, before first intent write. | Consumption survives; no key creation was entered. Fresh admission cannot silently reuse the attempt. No complete or success report may be inferred. |
| W05-T02 / L | After first arm's intent flush/readback, before native create. Repeat separately for the second arm. | Intent retained and no ownership/completion fabricated. First-arm owned record may already exist in the second-arm case. The exact gated arm has no create invocation; no retry or deletion from intent alone. |
| W05-T03 / L | After native finalization/inspection and original handle close, before independent reopen/owned publication. One arm per case. | A persisted orphan is possible. Exact read-only key inspection may establish its identity; lack of an owned record never authorizes delete/recreate. Setup/Guardian cannot continue. Recovery journal may be absent because termination bypasses catch/finally. |
| W05-T04 / L | After first owned record flush/readback, before second arm's intent/create. | First identity and owned bytes retained; second arm not created at the proven gate. No pair completion or Guardian probe. |
| W05-T05 / L | After both owned records, before setup-complete publication. | Both identities may exist but no completed pair is admitted. Hashes remain bound; no automatic completion synthesis or Setup replay. |
| W05-T06 / L | After setup-complete flush/readback, before Setup report publication. | Valid journal does not replace the missing report/process proof. Controller refuses before Guardian; exact key/journal identities retained. |
| W05-T07 / L | After Setup report flush/readback, before normal service completion. | A self-claimed `workerEnded` or `SETUP_COMPLETE` and later STOPPED/PID0 do not establish the original controller's process proof. Record actual held-handle wait, service exit and diagnostic stage; no success from the report alone. |
| W05-T08 / L | During Guardian's comparison, after a positive export observation and before its matching restricted call, then separately after one complete pair. | Preserve only completed rows; no full three-format outcome or default denial for unexecuted calls. Export buffers must not be logged. Parent may read only after independently proving its owned worker exited. |
| W05-T09 / L | During CREATE_NEW journal/report publication: before any data, after a bounded partial write, and after flush but before readback/acknowledgement, as separate instrumented cases. | Zero/partial bytes remain invalid; fully written but unacknowledged bytes require independent canonical/hash readback. Never overwrite or delete to make the stage appear fresh. Reopening must not grant transaction success or replay authority. |
| W05-T10 / L | Worker has published evidence/exited, but the dedicated test coordinator loses its acknowledgement/result-publication step. | New read-only classifier records observed complete/partial artifacts and unknown original acknowledgement. It does not rerun a worker, synthesize accepted process history or replay writes. Missing controller output is not proof that no native action occurred. |
| W05-T11 / D | Abrupt OS/power loss, provider disable/uninstall, disk-full/I/O failure affecting shared volumes, VM snapshot rollback, service-host failure or real Installer partial transaction. | Preserve uncertain commit state; accepted generation/hash CAS, journal/outbox/anchor reconciliation must decide the result. No automatic replay/rollback. This laptop's ordinary worker tests do not prove these guarantees. |

For T03–T10, an absent key/report/recovery file is not itself an expected PASS.
Expected prefixes describe what should be present at the proven gate; the final
record must preserve uncertainty where the native action or durable write was
entered but not independently acknowledged. No case is a claim of atomic
multi-file commit. [ProtectedControlStore](../../../licensing/adapter-evidence/export-policy-control/ProtectedControlStore.cs)
uses CREATE_NEW, flush and readback, not a production transaction coordinator.

## Minimal runner design to implement next

1. Implement a separate test-only suite with default-inert capability and a
   finite case/gate enum. Do not add a kill command, arbitrary fault path or bypass
   to the current V4 controller. Proposed family: `Ecs.Lic008.InvalidStateV1`;
   freshness is **NOT_CHECKED**, and the name is not an issued resource contract.
   For each reviewed case, derive exact root, service and key names from this
   fixed family, a closed case ID and one lowercase 32-hex attempt ID. Publish
   the fully expanded names, derived service SIDs, fixture hashes, precise allowed
   changes and retention policy in the immutable manifest before any native work.
2. Use fresh Setup and Guardian test services for this suite only: LocalSystem
   Setup and the exact fresh Guardian virtual-service identity. Never borrow the
   existing EntryEvidence Guardian. Verify actual user/owner/type/elevation/SID
   attributes and exact provider/policy/ACLs; replacing the principal with the new
   suite SID is a new reviewed test contract, not a relaxation of the old one.
3. Separate fixture creation, single fault action, one evaluation, and read-only
   collection/classification. Every stage has CREATE_NEW intent and exact input
   pins. No mode repairs, cleans up, retries a consumed stage or deletes from a
   prefix. I01's one owned-key deletion is an explicit case action, not general
   cleanup. Other cases retain objects until a separately bounded disposition.
4. Compile interruption hooks only into this separate test artifact. Each hook
   signals a closed stage ID after its specified native action/flush and waits on
   a bounded private synchronization channel. Bind the channel to the held worker
   process identity and manifest; do not trust a PID or a JSON ready flag alone.
   Controller first pins exact image/start/token and a live process handle. A
   declared termination occurs once through that held handle, only after the
   expected gate acknowledgement. No process-name/tree kill, PID reacquisition,
   automatic timeout kill or termination of the shell/SCM/production services.
   Failure to pin/reach the gate leaves the case inconclusive and retained.
5. A cooperative escape path may let an unarmed/timed-out gate abort before its
   next action, with explicit non-success evidence. Such an abort is not counted
   as interruption. Gate elapsed time and a signaled process handle are recorded
   separately from completed worker/report semantics. Preserve existing
   independent process-completion and configuration requirements; diagnostic
   observations always carry `EvidenceAuthority=NONE`.
6. Collect exact allowlisted original bytes only after safe process termination
   is established. Pin original/copy digests and sizes, case manifest, source and
   package, fixture mutation, gate acknowledgement, worker PID/start, service
   status, independent wait outcome and every referenced journal/report. No key
   enumeration, private export, plaintext or raw exception message/stack enters
   the archive. A case-specific read-only key observation needs its explicit
   owned name/public identity and operation bound in the manifest.
7. Add pure tests for all manifest/old-scope/path/identity refusals, gate replay,
   forged acknowledgement, mismatched held process, incomplete evidence and
   classifier outputs before building a capable artifact. Build review must prove
   that ordinary/default/legacy defines cannot reach fixture mutation or process
   termination. Review a concrete packet before fresh owner preflight/issuance
   and live confirmation. No historical runner is executed to obtain these tests.

Suggested implementation order is I07/I11 admission-only, I02/I08/I09 valid
fixture plus semantic/authentication refusal, then I01/I03–I06/I10 native object
cases, and finally T01–T10 after the handshake/termination boundary is reviewed.
Every case begins fresh; this ordering does not allow a failed case's resources
to become the next case's baseline. D-only cases and unavailable standard-account,
hardware or product prerequisites remain explicitly NOT_RUN.

W04/W05 complete only when the per-case original evidence and residual limitations
are reviewed for the selected adapter. These cases alone cannot close LIC008,
Open003, W03/W06/W08/W09, independent Security acceptance or STORE001–005.
