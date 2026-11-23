# Fresh bounded adapter evidence plan — proposed v0.1

Date: 2026-10-08. Record: CHG0101 / LIC-EV-0170.
ID: ADAPTER-EVIDENCE-PLAN-01. Status: DRAFT_NOT_APPROVED_NOT_IMPLEMENTED.
Baseline: 2dd8781 plus retained EV0167–0169 changes; no executable kit exists.
Owner decisions: EV0166 initial Software evidence scope and conditional physical
executor arrangement remain confirmed. Exact new plan review/execution permission
is NOT_OBTAINED. This document is preparation, not authority to build/run native
product services or silently change adopted prerequisites.

## 1. Objective and non-goals

Address REM-01 from the [sufficiency assessment](../reviews/LICENSING_ADAPTER_EVIDENCE_SUFFICIENCY_ASSESSMENT.md):
produce fresh evidence with explicit source/build/assembly/dependency/manifest/
runner/host/result linkage. Historical V4/V5 reports remain unchanged and are not
retrofitted with hashes they never recorded. Fresh results supplement history,
not replace V4 reboot or V5 controlled missing-key observations by implication.

Proposed runtime scope: Microsoft Software KSP, RSA3072/decryption-only/export0,
OAEP-SHA256/SILENT and AES256-GCM with random32-byte key/12-byte nonce/tag16.
Only the current approved development host, whose actual OS/build/x64 identity
must be freshly recorded before any mutation. Historical22000 is an evidence
identity, not a claimed current measurement. Different scope/profile/toolchain
requires revised exact review; unknown host/provider refuses without mutation.
Product target stays Windows10/11 x64. No TPM/Windows10/fleet approval inferred.

This is a test-only feasibility/contract-candidate harness, NOT production
Guardian/Setup/App/Store, signed Installer, licensing activation or deployment.
No PostgreSQL, existing customer data, K40 device, Vendor issuance/keys, physical
power loss, OS-provider disabling, real Backup/Restore or old experiment cleanup.
No standard account creation, reboot or hardware required for the first pilot.
No FULL/ATTENDANCE runtime authority; both Edition tags can be candidate contexts.

## 2. Two separately gated tracks

| Track | Allowed after its own approval | Exit / restriction |
| --- | --- | --- |
| A: inert preparation | Implement test-only source snapshot builder, strict candidate codec/classifier and pure tests under workspace/out; no persisted machine keys/SCM/ACL changes | Pinned reviewed source/package, pure test results, guarded physical controller plan; not native acceptance |
| B: isolated physical pilot | Execute only a reviewed/pinned fresh package against new exact test names below, after separate operator authorization | Bound role/child results, original output digests and exact owned cleanup/retained-state disposition; not product integration |

Neither track starts in this planning turn. Track A source/build approval must
explicitly cover the candidate, not invoke the all-NE prerequisite bypass for
production. Track B is independent of A build success: no post-build automatic
elevation, service registration, controller execution or reboot. Existing V1–V7
controllers never called or copied as executable recovery shortcuts.

## 3. Source and artifact identity chain — mandatory in the new kit

1. Before build, enumerate an exact closed allowlist of compilation/controller/
   config/test inputs, including every linked source, project/global.json,
   imported props/targets and dependency/restore inputs. Refuse reparse/escaped/
   duplicate/unlisted inputs. Publish sorted relative paths, sizes and raw SHA256
   in source-manifest.json; no credentials/private environment or arbitrary repo
   contents. Record source commit and a digest of the relevant dirty diff; clean
   is an explicit value, not a guess. A source tree can be dirty if frozen and
   disclosed; no unrelated user edits are reset.
2. Copy exact reviewed inputs to a new workspace/out snapshot using create-new
   files. Build only from that snapshot with controlled explicit source paths;
   linked sources cannot resolve back into a mutable repository. Verify source
   bytes before/after build. Reject unexpected imports/generated source changes;
   record any required generation inputs/outputs rather than omit them.
3. Pin actual SDK/runtime/RID/compiler/build command, dependency resolution and
   framework/runtime pack hashes or exact inventories. Initial SDK10.0.400 /
   runtime10.0.11 win-x64 is a proposed test identity inherited from prior kits,
   not chosen as a universal Windows support claim. Any different selection is
   reviewed before build. No package update/network restore as an implicit run
   step; missing approved build inputs stop preparation.
4. Build a closed package-manifest.json listing all runtime/test files except
   the manifest itself, including EXE apphost, managed DLL, deps.json,
   runtimeconfig.json and dependencies. Verify SHA256/size and absence of extra
   package files. Separate kit-manifest.json binds that manifest plus controller,
   pure runner and README. Never hash a manifest as its own entry.
5. Build-provenance.json binds source-manifest, package/kit manifest digests,
   source commit/diff, builder/command/toolchain and pure-test output hashes.
   Distribute an archive plus separately retained digest/review record. Keep
   provenance outside its own hash cycle. Hash correspondence is custody, NOT
   trusted code signature, runtime admission or guaranteed reproducibility.
6. Every physical role validates current EXE, loaded managed assembly, package
   manifest and closed dependency inventory against the reviewed expected
   digests. Refuse mismatches before CNG/protected calls, do not merely echo the
   controller's hashes. The actual child emits/validates its own loaded assembly
   and runtime identity. Pre/post relevant calls and controller read-back check
   identity; explicitly acknowledge that hashes cannot defeat a hostile admin.
7. Every report records exact plan/source/provenance/kit/package hashes, EXE and
   loaded assembly hashes, validated dependency inventory digest, role/action/
   RunId/ExperimentId, token/SID identity match, actual runtime/OS/build/x64 and
   UTC timestamps plus monotonic operation duration, raw result IDs/statuses.
   The summary binds reports/checkpoints/pure runner outputs by original digest
   with chronological stage/boot context. Version text alone never binds a case.

The package/provenance validation and report emission must be tested through
the actual emitter code, not only handmade fixtures. Reports/provenance do not
claim authentic publisher identity or signed-product installation. No source/
binary equivalence is accepted until this whole chain is measured and reviewed.

## 4. Candidate operation and parser coverage

Base requirements: [contract0.2](LICENSING_ADAPTER_OPERATION_CONTRACT_V02.md) plus
[approved narrow routing0.3](LICENSING_ADAPTER_OPERATION_CONTRACT_V03.md).
No schema/protocol freeze or code changes to existing Offline/Hybrid interfaces.

Candidate binary container:534-byte fixed header,554-byte AAD including exact
20-byte ENTRY_CONTROL_SYSTEM domain,1..1048576 ciphertext bytes and16-byte tag;
max1049126. Suite/purpose/Edition/installation/generation/hash/profile/key context
is independently supplied, not copied from the envelope. Snapshot inputs before
await, enforce length/overflow/Core counter bounds before allocation/native use,
no trailing/unknown fields, no fallback/algorithm negotiation. Validate wrapped
key384/nonce12/tag16 and unwrapped key32; suppress all unauthenticated plaintext.

Use memory-only random test payloads and clearly TEST_FIXTURE context. A supplied
32-byte stateHash in this pilot is only a context fixture, not a Core logical
License-state hash. No fabricated production serializer, state acceptance or
Store ACK. After authenticated open, compare payload internally and clear it;
never emit plaintext, data key, private handle/key or raw exception. Actual Core
logical-hash reconstruction, trusted anchors and whole-snapshot rollback proof
remain future accepted Store/serializer obligations. Cross-context rejection can
be tested without claiming same-context anti-rollback success.

Preserve F01..07 evidence-qualified classifications. Isolated BAD_KEYSET remains
unknown, no Create-on-open/no provider or DPAPI fallback. Physical unavailable-
provider/ACL-corruption cases are not invented by mutating global provider/key
ACLs; pure injected cases must be labelled simulated, with real coverage missing.
Native timeout is not cancellation: retain live buffers/handles until worker ends,
suppress late delivery, deny readiness and no overlapping key replacement. Hung
worker disposition is a separately reviewed dependency, not permission to kill
or repair production processes. Pure late-worker tests never claim actual native
interruption coverage. Test crypto success remains durable=false/authority=NONE.

## 5. Planned test IDs and owning gates — all NOT_RUN

| New plan ID | Exact expected result | Existing obligation / evidence limit |
| --- | --- | --- |
| FEP-B01 | Exact source allowlist/snapshot/toolchain/provenance identity; changed/escaped/missing source refuses build | ADP-P01/AR-003; actual build evidence, no inferred historical equivalence |
| FEP-B02 | Extra/missing/changed assembly/dependency/controller/manifest refuses; acyclic manifests | ADP-P01/AR-003; pure negative fixture plus real package checks |
| FEP-B03 | Actual role emitter and child verify/emit their own loaded artifact hashes; wrong run/experiment/role refuses | ADP-P01/P05; template-only output cannot PASS |
| FEP-U01 | Boundary1/1048576 accepted structurally,0/1048577 refused; truncation/trailing/invalid encoding/suite/counter reject before crypto | ADP-P03, ACV01..03; fixture validity not license-state acceptance |
| FEP-U02 | Whole valid different-install/Edition/generation/hash/profile/key context rejects against independent expected context | ADP-P03/ACV04; no supplied-AAD authority |
| FEP-U03 | Header/nonce/wrapped-key/ciphertext/tag mutation refuses without plaintext release | ADP-P03/ACV05; pure fixtures plus approved physical pilot crypto |
| FEP-U04 | Same-context valid old sample demonstrates need for external anchors; never claims GCM-only rollback prevention | ADP-P03/P07/ACV06; not a Store rollback PASS |
| FEP-U05 | Unknown versus evidence-proven absence/mismatch/outage remains distinct, no Create/fallback/replay | ADP-P02/ACV08; injected conditions explicitly simulated |
| FEP-U06 | Timeout/late-success never delivers output/ACK; live buffer cleanup only after worker end; one active key operation | ADP-P02/P15/ACV07; fake worker does not prove native hang recovery |
| FEP-U07 | Offline/Hybrid exact error/attempt semantics preserved, read-only confirm stays false | ADP-P07/ACV09; fake Store not durability/commit evidence |
| FEP-U08 | Recursive secret-canary redaction, including rejected input/provider failure; no raw exceptions exposed | ADP-P14/ACV10; not full deployed Audit/IPC acceptance |
| FEP-P01 | Fresh owned keys created once with exact approved restricted vs separate A/B control policy/DACL; read-back matches | AE001..003/ADP-P02/P05; new test roles, not product SIDs |
| FEP-P02 | Guardian rightful reopen/seal/open/random payload compare; private export refused | AE002..004; no business admission or license-state serializer |
| FEP-P03 | App/actual child restricted use refused with corresponding same-provider readable positive controls and exact token/artifact identity | AE005; BAD_KEYSET raw status retained unless exact contrast classification separately accepted |
| FEP-P04 | Fresh Guardian process reopens same key/context/envelope and read-back; mutated/foreign contexts refuse | AE007/008, ADP-P03/P15; fresh process is NOT normal reboot/auto-start evidence |
| FEP-P05 | Reviewed owned cleanup proves deletion of only two new owned keys; retained sample then refuses with no recreation | AE009/011; controlled post-cleanup absence, not every repair/provider failure |

IDs map to overlapping existing catalogs, not new completed gates. Physical
runtime results must distinguish PASS/refusal/unknown/simulated/not-tested; no
global reclassification of old statuses. Standard-user ADP-P04, actual Installer,
product IPC/Audit/Store/TPM and full Windows matrix remain explicit residual
cases. Their placement stays proposed until assessed/adopted, not waived here.

## 6. Proposed exact physical resources and mutation limits

Fixed proposed namespace: Ecs.Lic008.EntryEvidenceV1, scope
TEST_ONLY_SOFTWARE_KSP_ADAPTER_EVIDENCE_V1. Check no collision in source/resource
review before adopting names; never reuse any WrappingV1–V7 namespace.

| Resource | Proposed exact permitted pilot use |
| --- | --- |
| Workspace package | One new out/lic008-adapter-evidence-<32-lowercase-hex>/ tree; new test-only sources/projects/kit paths require separate build approval |
| Machine root | C:/ProgramData/Ecs.Lic008.EntryEvidenceV1, must be absent before Prepare; refuse pre-existing/reparse root without deletion/adoption |
| Services | Exactly Ecs.Lic008.EntryEvidenceV1.Setup, .Guardian, .App; Manual, no auto-start/failure restart; pre-existing registrations refuse |
| Service identities | Setup LocalSystem with enabled own service SID; Guardian/App exact separate virtual service accounts; verify actual tokens/SIDs before operation |
| Keys | Exactly two fresh machine RSA wrapping keys named Ecs.Lic008.EntryEvidenceV1.TEST_ONLY.<ExperimentId>.restricted and .app-readable; immutable expected labels/ownership/creation intent |
| Restricted key | Protected SYSTEM plus exact new Guardian SID, decryption-only/export0; only reviewed provider-specific ACE forms/rights, no broad user/Admin/App grants |
| Positive control | Separate deliberately App-readable TEST_ONLY key; no customer/plaintext data and no grant on restricted key |
| Files and directory ACLs | Exact subdirectory/file/ACE manifest must be supplied by implemented-controller review before execution; currently NOT_SPECIFIED_NOT_AUTHORIZED |

This table is not a complete runnable mutation approval: absolute per-stage
paths/ACL masks/rights/run markers/controller digests must be filled and reviewed
after inert implementation. No generic recursive delete/move, permissions
relaxation, account creation, old-state adoption, service auto-recovery or purge.

## 7. Proposed physical stages and safe stopping

1. Prepare: after all collision/profile/source/package/plan checks, register only
   the three new Manual services, apply exact approved test-directory ACLs, copy
   verified immutable bits, and create only two owned keys via constrained Setup.
   Record exact service SIDs, source/package/key public identities and checkpoint.
   Run approved Guardian/App/actual-child pilot cases, stop services and retain
   keys/envelopes for review. Failures stop and retain evidence; no generic rerun.
2. VerifyFreshProcess: after prior output review, pin the same checkpoint/bits/
   owned identities, rerun read-only readiness and approved scoped test crypto in
   fresh role processes. No Create/ACL mutation/replacement key. This is not a
   Windows reboot; no Restart-Computer/shutdown command in this kit.
3. Finish: after evidence review and exact ownership validation, delete only
   the two experiment-owned keys, verify controlled missing-key refusal with
   retained test envelope and zero Create calls, then leave exact test services
   Stopped/Manual and evidence files retained. No customer/old key/file/service
   deletion. Registration removal, interrupted recovery or purge is a separate
   reviewed plan, not a generic automatic cleanup path.

After incomplete/uncertain state, retain markers/files/keys and request review.
Do not blindly repeat Prepare/Finish. Any resume needs exact checkpoint/state/
artifact admission evidence. No cleanup by names alone or side effects on mismatch.

## 8. Acceptance, actors and next handoff

Coordinator Codex: prepares this plan and, if later authorized, inert candidate/
tests/evidence coordination. PROJECT_OWNER_CURRENT_USER: existing Product/
Security decision accountability and accepted conditional physical executor on
available reviewed resources. Non-author plan reviewer: NOT_ASSIGNED_FOR_THIS_PLAN;
no prior routing review is treated as approving new creation/deletion scope.
No external human officer invented; AI review is not a security guarantee.

Before Track A, obtain scoped exact-plan assessment and resolve source/codec/
failure/case coverage findings; explicit test-only implementation permission,
not a requirement to waive NE rules. Before Track B, review actual source/diff,
frozen build/provenance, pure outputs and complete controller/ACL mutation list;
obtain exact package/run authorization. Failure/nonmatching artifacts deny run.
Only after returned original evidence is bound and assessed may the owner and
scoped reviewer decide its sufficiency under REM-01..04. No author self-approval.

Definition of plan preparation complete: this proposed objective, binding chain,
test mapping, resource boundaries, stage behavior and approval dependencies exist.
Definition of REM-01 complete: required exact evidence actually built/executed/
reviewed and accepted; preparing this plan does not complete REM-01. Four residual
work packages remain, with REM-01 planning component now PREPARED. No timetable
or percentage inferred, all new FEP tests NOT_RUN. NE-002 NOT_ACCEPTED/native
NOT_READY; other five NE prerequisites and original full gates remain mandatory.

Next concrete action: limited non-author review of this exact plan, especially
binding-chain sufficiency, candidate-versus-production scope, role isolation,
failure handling and unfinished ACL/controller details. No compilation, elevation,
service/key/ACL/account/DB mutation, native/crypto test or commit in this step.
