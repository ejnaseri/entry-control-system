# Guardian seal diagnostic candidate — 2026-10-17

## Current physical result and successor — 2026-10-21

Status: PHYSICAL_ALL_THREE_EXPORTS_UNKNOWN_RESTORED. The owner executed
attempt `fbd377ea27da4025b585fdfbc9abcd29`; its input and diagnostic V3 directory
are now consumed. Seven prerequisites PASS, then generic, PKCS8 and opaque
exports each report UNKNOWN / direct cryptographic HRESULT `0x80090029`.
No seal/roundtrip ran. The worker ended without timeout or worker failure, and
the controller reported DIAGNOSTIC_UNKNOWN_RESTORED. Read-only SCM inspection
independently confirms Guardian Stopped/PID0/Manual with original account/path.

[Exact result and evidence limits](../reviews/LICENSING_GUARDIAN_DIAGNOSTIC_BUILT_REVIEW.md).
Do not rerun this or an earlier wrapper, edit key policy, delete retained evidence,
or convert unsupported to denial PASS. The earlier pending-run statements below
are historical preparation records, not current execution instructions.

Next: [matched export-policy control](LICENSING_EXPORT_POLICY_CONTROL.md), using
two new persisted test keys, not the retained keys. No exportable positive
control exists in the previous pilot; both restricted/app-readable keys have
ExportPolicy.None. LIC008/security/production acceptance remain open.

## Current independent-export successor — 2026-10-20

Historical preparation status: INDEPENDENT_EXPORT_SUCCESSOR_PREPARED;
owner execution is now recorded above.
Implementation committed `1b8d191`. October21: the same package/source/runtime
was rechecked after the prior input expired; fresh reviewed inputfbd377ea...
passes CheckOnly and expires16:06:02Kabul October21. See the current exact pins
in the review linked below. Earlier inputs remain preserved, not extended.
The isolated V2 implementation and owner-run result below were committed first
as `f6de973`. New diagnostic V3 preserves both consumed V1/V2 directories. The
retained EntryEvidenceV2 pilot, original KeyOperations and installed files are
unchanged; no Prepare, retained ACL edit, key creation/deletion or service run.

All seven prerequisites must PASS. Only a direct, unwrapped CryptographicException
with HRESULT0x80090029 during an export records UNKNOWN and permits observing the
next export. Other errors and successful exports stop immediately; returned private
buffers are zeroed before refusal. Denial PASS still requires direct0x80090010,
now explicitly with no inner exception. UNKNOWN is never promoted to PASS.
Any UNKNOWN prevents seal/roundtrip, even when later exports PASS. Completion
still requires all eleven observations PASS.

Report schema4/V4 admits ordered independent export observations. A normal
matrix with unresolved exports has exactly ten rows and no seal row. Premature
termination at a continuing generic/PKCS8 result is rejected unless a worker/
deadline interruption is recorded. Prerequisite or unexpected export failures
remain terminal. Old report scopes/schemas, reordered/duplicate rows and seal
after any UNKNOWN are rejected. Wrapped cryptographic exceptions preserve the
outer HRESULT and receive positive WrapperDepth; this prevents a wrapper with
an overwritten denial/unsupported HRESULT from passing or continuing.

Approval schema4/V4 binds the exact V3 root and report4 and rejects both consumed
attempt IDs. Original Guardian identity, exclusive reservation, restoration and
live confirmation remain unchanged. Default build stays inert; reviewed capable
build requires the exact source pin.1211 pure assertions PASS (Diagnostic72,
ExportProbe633, report244, other components262), with12/9 inert/capable entry
refusals per host and3 no-artifact builder refusals. Bounded separate AI review
and exact artifact checks passed, not human security or physical acceptance.

[Current package/input pins and read-only checks](../reviews/LICENSING_GUARDIAN_DIAGNOSTIC_BUILT_REVIEW.md)
include an input superseded after a boot-binding mismatch and the fresh reviewed
replacement. No gate was bypassed or old artifact edited. Next owner-confirmed
one-attempt execution; result may still be UNKNOWN while providing more evidence.
The reason for generic export being unsupported and LIC008 acceptance remain open.

## Current per-format physical result — 2026-10-20

Attempt a288f62ae7284f979490d225303d7f16 executed by owner:
seven prerequisites PASS; private-export-generic UNKNOWN/0x80090029.
PKCS8/opaque/seal NOT_RUN. Guardian independently observed restored, Stopped/PID0.
V2 diagnostic root/input now consumed: preserve V1/V2; do not rerun or clean up.
The failing API is isolated but its underlying reason remains unresolved.
[Evidence and limits](../reviews/LICENSING_GUARDIAN_DIAGNOSTIC_BUILT_REVIEW.md).
Next: independently observe remaining exports in a reviewed isolated successor;
unsupported stays UNKNOWN and must never authorize seal/completion.

## Current isolated per-format package — 2026-10-20

Historical preparation status: ISOLATED_SUCCESSOR_PREPARED; now consumed above.
The previous per-format implementation and documentation were committed first
as `8d1a63e`. Subsequent placement changes use only the new fixed diagnostic root
`C:\ProgramData\Ecs.Lic008.GuardianSealDiagnosticV2`. Consumed diagnostic V1 and
the original EntryEvidenceV2 pilot remain preserved; no cleanup or Prepare retry.

Approval schema3 / TEST_ONLY_GUARDIAN_SEAL_APPROVAL_V3 now binds the exact root
and report schema3 in shared controller/service validation. Old-schema approvals,
the consumed attempt, V1/arbitrary roots and path spelling variants are refused.
Launcher executable paths derive from the single root constant. Original Guardian
identity/restore command, exclusive reservation and stop-before-restore remain.
No global export-denial policy or original KeyOperations change was made.

Default builds remain inert. An explicit diagnostic-capable build requires the
reviewed source-set hash before creating output. Fresh input preparation is
read-only: it verifies exact package/runtime/owner/boot and emits canonical JSON;
live owner confirmation and elevated controller admission still precede effects.
646 pure assertions PASS per host; inert/capable builds pass12/9 entry refusals
per host respectively. Valid-shaped service requests are tested only when inert.
Three invalid builder-pin requests refuse without creating artifacts. A separate
bounded AI source/artifact review found no blocker; this is not security approval.

The [exact package, fresh input, expiry and wrapper checks](../reviews/LICENSING_GUARDIAN_DIAGNOSTIC_BUILT_REVIEW.md)
are recorded separately. The wrapper temporarily excludes only process-local
DOTNET_ROOT, restores it in finally and continues refusing other runtime overrides.
No persistent environment changes, service execution or retained ACL/key changes
were performed by the agent. Next: owner runs the fresh wrapper once and supplies
the full result. The failed export format, any subsequent correction, LIC008 and
security/production acceptance remain unresolved. Older checkpoints below are
historical and do not override this one.

## Previous inert per-format successor — 2026-10-20

Status: INERT_EXPORT_FORMAT_SUCCESSOR_TESTED; NOT_PHYSICALLY_EXECUTED.
All previous diagnostic admission changes and the owner-run UNKNOWN outcome
were committed first as `73fc6e4`, as requested. The changes below are subsequent
work, not part of that commit.

The diagnostic-only [ExportProbe](../../../licensing/adapter-evidence/guardian-seal-diagnostic/ExportProbe.cs)
replaces one grouped export observation with three exact ordered stage IDs:

| Stage | Existing CNG format |
| --- | --- |
| `private-export-generic` | GenericPrivateBlob |
| `private-export-pkcs8` | Pkcs8PrivateBlob |
| `private-export-opaque` | OpaqueTransportBlob |

Each stage makes exactly one export call. Only a direct CryptographicException
with HRESULT `0x80090010` passes, as in the original check. Unsupported
`0x80090029`, unexpected errors and successful exports remain UNKNOWN and stop
before subsequent export/roundtrip stages. Any successfully returned buffer is
zeroed in finally before refusal, including the empty-buffer test. No exception
messages, stack traces, data dictionaries or private bytes enter reports.
The failure code remains the managed exception HRESULT, not a separately
measured native return value.

Report schema advances to3 / TEST_ONLY_GUARDIAN_SEAL_DIAGNOSTIC_REPORT_V3 with11
ordered observations (the three exports replace the prior single step). V2
schema/scope, old grouped IDs, missing/duplicate/reordered stages, incomplete
PASS prefixes and malformed failure/row metadata are refused. Completion still
requires all stages PASS with no worker failure/deadline. Package contract V2
and pure-test scope V1 are unchanged; these are separate versioned contracts.
The old physical schema2 report remains UNKNOWN and is never upgraded/relabelled.

### Verification and exact candidate

Candidate: `out/lic008-guardian-seal-inert-954aaae122504cdfa4ef2cf2ff3d476b`.
623 pure assertions PASS through both DLL and apphost (same assertions, not1246):
Diagnostic58, new ExportProbe247, report87, other existing components231.
The additional coverage checks each failure position, exact mapping/call count,
early stop/no seal, unsupported and wrapped errors, successful-buffer zeroing,
safe error output and report correlation/serialization.

Nine entry refusals PASS per host, including full-shape service/controller
arguments and approval-input requests with absent input paths. Three builder
capability/pin refusal cases PASS without creating any output directories.
190 runtime files and actual loaded native modules verified;20 source files,
22 custody inputs and4 package files rehashed. Issued capable package and all
original pilot-runtime source hashes still match their previous inventory.

Source-set SHA256:
`1178e0536682fdcd1153b17799b386ac803d552d952f3d1789f86cc928e1fa66`.
Package-manifest SHA256:
`c26e13d7f2915141e948bd85a6c401e094e4472cb6e0bbd13971e457a8cd1485`.
DLL SHA256:
`daadcd3d3c2d31d7712e11d47a6c41d3b0e7f4e0c23cf53568c2f29f9df92bc0`.
Bounded separate AI source review found no blocking finding; this is not
independent human security approval or evidence of native export behavior.

### Execution boundary and next step

PhysicalEnabled is unconditionally false, even with the former build define.
The builder refuses capability/pin requests before writing files, and the CLI
refuses new approval-input preparation before any file/native access. No fresh
approval, service/key operation or retained ACL edit occurred in this step.
Installed pilot, original KeyOperations.ExportDenied, the consumed diagnostic
root and previously issued artifacts remain unchanged.

Next: review and implement isolated successor placement/attempt handling that
preserves the consumed GuardianSealDiagnosticV1 directory and exact restored
Guardian configuration; then bind/review its exact package before requesting
a new owner-confirmed diagnostic execution. Do not enable this candidate against
the consumed root, delete evidence, reuse the previous approval or retry Prepare.
The failing export format and final correction still require fresh physical
evidence; LIC008, securityAccepted and productionAccepted remain open/false.

## Previous physical outcome — 2026-10-20

Current status2026-10-20: PHYSICAL_DIAGNOSTIC_EXECUTED_UNKNOWN_RESTORED.
Owner-run attempt ae144443de634367b40496e90192f3eb produced7 PASS, followed by
private-export-denied UNKNOWN/0x80090029 (NTE_NOT_SUPPORTED); memory seal/roundtrip
was not reached. Guardian restored and independently observed Stopped/PID0/Manual.
All five diagnostic preparation/execution/interpretation tasks are performed,
but root-cause correction and LIC008 acceptance remain open. Next bounded
per-format export observations; never reinterpret unsupported as denial or rerun
the consumed wrapper/Prepare. Preserve retained diagnostic root and V2 state.
See [physical outcome and limits](../reviews/LICENSING_GUARDIAN_DIAGNOSTIC_BUILT_REVIEW.md).

Earlier October20 issuance checkpoint:
October19 input expired before effects. Owner requested fresh review/input;
unchanged candidate rechecked, new current-boot input ae144443de634367b40496e90192f3eb
expires15:01:32Kabul October20. Read-only wrapper check PASS; old input preserved.
All three corrections and consolidated artifact checks are complete;326 pure
tests pass. Default build remains inert; explicit reviewed diagnostic-capable
package and one-attempt input prepared. See the exact hashes, expiry, limits and
diagnostic checklist in the
[consolidated review](../reviews/LICENSING_GUARDIAN_DIAGNOSTIC_BUILT_REVIEW.md).
No live service/probe executed by agent; LIC008 remains open. Older statuses below
are historical and do not override this current checkpoint.

Latest2026-10-18: apphost/runtime stage committed74185fc; subsequent
[built-package review](../reviews/LICENSING_GUARDIAN_DIAGNOSTIC_BUILT_REVIEW.md)
passes limited inert custody but identifies three pre-execution gaps. No source
correction or live execution performed during that review. Next GSD-R1 trusted
pin delivery, then runtime/environment and report-attempt binding corrections.

## Latest apphost/runtime/service admission — after commit bab61b2

Deployment connection was committed as bab61b2. The new builder now produces an
actual GuardianSealDiagnostic.exe using the installed SDK HostWriter, with
global-only .NET lookup and runtimeconfig rollForward=Disable/10.0.11. This is
a framework-dependent diagnostic for the observed host, NOT a self-contained
release or Windows10/11 matrix acceptance. No NuGet/network restore is involved.

The package contract advances to TEST_ONLY_GUARDIAN_SEAL_PACKAGE_V2 with four
fixed files: apphost, DLL, runtimeconfig and runtime-inventory.json. Existing
three-file candidate manifests are not accepted. RuntimeCustody verifies the
exact inventory and SHA256 of190 files across the fixed10.0.11 runtime/hostfxr
directories, required CoreLib/coreclr/hostpolicy/hostfxr entries, loaded CoreLib
path, process architecture and runtime version. This is a runtime consistency
check, not prevention of pre-managed-code execution or hostile administrator
changes. Environment/host resolution still belongs in the complete package review.

Deployment.RunService connects protected package/approval reading and pinned
hash checks to the native dispatcher, performs canonical context/time/boot and
installed-file/runtime checks before probing, and rechecks before report output.
It is still internal/unreachable from Main. Delivery of separately reviewed
approval/package pins into a future capable service entry/SCM configuration is
not wired; the current fixed DiagnosticPath has no pin arguments. Do not enable
that path or derive expected pins from files being verified.

Latest candidate:
`out/lic008-guardian-seal-inert-8bb36ba930dc4079af5d054b7223cfc3`.
166 pure cases PASS through both dotnet and the new apphost (same cases, not332).
Five physical CLI routes refuse in each host. The read-only --verify-local-runtime
route passed and bound its output to the inventory hash; it does not touch keys,
SCM or protected test data. Manifest/approval negative tests retain full four-file
shape so field mutations are not accidentally rejected only for wrong count.
Final source snapshots and HostWriter input copies agree with working inputs.

Next: complete built-package/admission review, including trusted pin delivery,
runtime/environment assumptions and report validation, before enabling a capable
entry or issuing a fresh exact-effect approval. No approval/physical run was made.
The changes after bab61b2 are not yet committed. Older sections are historical.

## Latest deployment connection — after commit f2a6d17

The prior metadata collector, diagnostic/launcher components and documentation
were committed as f2a6d17. Deployment.cs now connects WindowsLauncher callbacks
to native protected creation, one-attempt reservation, hash-checked copies,
phase journals and protected report readback. Root CREATE_NEW is the durable
reservation; any partial failure leaves it retained. Files are CREATE_NEW with
explicit protected descriptors, checked through handles and flushed to disk.
No overwrite, deletion, ACL alteration or automatic retry is implemented.

Admission requires a separately pinned canonical approval, exact owner SID,
experiment/plan/package/boot bindings and a UTC validity window of at most4hours.
Local unredirected exact confirmation is required to construct the deployment
object; it is not callable from current Main. No real approval was issued.
Original plan and the two owner-collected report hashes are checked before any
deployment. Report readback checks protected parent/file owner/DACL, bounded
same-handle bytes, canonical JSON and diagnostic assembly/boot/plan binding.
An UNKNOWN/late report cannot be promoted to completed probe.

Verification:156 pure tests (22 new manifest/approval/ACL-policy cases),5 actual
process entry refusals PASS. Build:
`out/lic008-guardian-seal-inert-99517ff6bc83482f86aacb5631526510`.
No protected directory/file, service or key operation was executed. Native
creation and SCM behavior are still untested in this candidate.

Remaining before live use: actual apphost packaging, runtime/dependency custody,
service-side deployment admission connection, complete built-artifact review,
then exact-effect owner approval and live confirmation. The current build has
no apphost and no live CLI routes. Its three-file manifest shape is a future
framework-dependent package contract, not proof of runtime compatibility or
dependency integrity. Do not reuse the old Prepare approval for diagnosis.

## Latest native implementation — 2026-10-17

NativeService.cs now supplies a separate SCM dispatcher, fixed V2 Guardian
identity/experiment/plan binding, original package inventory verification,
10-second worker integration and a CREATE_NEW/Flush(true) report writer. It
checks owner/DACL and non-reparse handles for both the new diagnostic root and
its separate reports directory. Guardian has read/execute only on the binary
root and modify only on reports; the report itself is owned by Guardian and
readable by Administrators. No retained V2 report or staging file is written.
Post-work token/boot checks are required. Late/unknown results cannot become a
completed probe. A native timeout is not cancellation: the existing worker waits
for native work to actually end, while the controller stops waiting after45s
without killing the worker or restoring a live service.

WindowsLauncher.cs implements the SCM side of ILauncherEnvironment: fixed-name
configuration/status queries, manual own-process/SID-type/recovery checks,
allowlisted path changes, one start attempt and bounded stopped-state observation.
There is no service creation/deletion, ACL weakening, forced stop or key mutation.
Deployment/admission/journal/report-validation callbacks remain mandatory and
have NOT yet been implemented/wired as a deployable controller. There is no
atomic protection against a concurrent privileged administrator changing SCM;
pre/post checks detect observed changes, not a stronger security guarantee.

Latest build:134 pure tests and5 process entry refusals PASS, including the new
--diagnostic-service route. Report tests reject mismatched context, reordered or
truncated success, false acceptance and live-worker claims. Native API paths
were compiled, NOT executed. A compile-time AccessRule name collision was fixed
before the successful rerun. Documentation links and diff whitespace checks pass.
Candidate: `out/lic008-guardian-seal-inert-0cad88e3a39440f2bd6a61800f732e5d`.

Next concrete task: implement protected deployment and one-time reservation,
artifact/runtime/owner-approval admission and report readback; package the actual
apphost (the intended .exe does not yet exist in this inert DLL build). Review
that complete package before enabling CLI routes or giving an execution command.
The native dispatcher requires a deployment-verification callback and is NOT
reachable from Main. Neither the diagnostic service nor retained V2 was run.
Older implementation sections below describe historical checkpoints.

The retained V2 restricted-seal-stage result is UNKNOWN. Visible ACL metadata
does not explain it. NativeWorker.Task.Wait can wrap the original exception in
AggregateException; RoleActions only emits a native status for a directly caught
CryptographicException. Therefore null nativeStatus does not exclude CNG failure.
This is a reporting limitation, not proof of the original failure's cause.

## Implemented now

Separate source `licensing/adapter-evidence/guardian-seal-diagnostic/Diagnostic.cs`
and local builder `scripts/build-license-guardian-seal-diagnostic.ps1`.
No existing runtime source, installed binary, retained file, ACL or service changed.
The builder snapshots existing runtime/codec sources into a new local out folder;
its selected entry point accepts only --self-test. No capability define is used.
This developer build is NOT a deployment/custody-reviewed artifact.

The proposed read-only probe splits the restricted-key path into nine observations:
read intent, read owned record, validate ownership, read public control, validate
public control, open existing key, verify policy/public identity, check private
export denial, and seal/roundtrip in memory. It stops at the first exception.
It reuses current key operations; no key creation/deletion/property change, file
publication or staging write exists in the probe. Existing ExportDenied zeroes
any unexpectedly exported bytes; Seal clears plaintext/data keys. Diagnostic
output contains no bytes, arbitrary messages, stack traces or exception Data.

Single-inner AggregateException chains are unwrapped up to8 levels; multiple or
overdeep wrappers remain unresolved. HResult is reported as nativeStatus only
for CryptographicException, not reinterpreted from generic IO/validation errors.
UNKNOWN remains UNKNOWN; no denial or security success is inferred.

## Verification

Build succeeded with49 pure checks and4 actual process entry refusals. Tests
inject a failure at each of9 steps, check stop ordering, nested exception handling,
multiple/deep wrapper refusal and sensitive-message redaction. No native probe
was called. Candidate:
`out/lic008-guardian-seal-inert-1371aabaf60b4f42a01a20eeb6122d20`.

## Remaining before any Windows execution

### Launcher protocol implementation — subsequent step, 2026-10-17

`Launcher.cs` now implements the controller sequence against an injected
ILauncherEnvironment. This is a managed protocol, NOT a native Windows launcher.
It checks the exact V2 Guardian service/account, original path, Manual/Stopped/
PID0 and disabled recovery. It requires binding verification, exclusive attempt
reservation and a new protected deployment before changing the path. It checks
again before start and before restore, starts once, and restores only after an
observed stopped worker and unchanged expected diagnostic configuration.
Ambiguous failure never triggers a finally-block rollback or forced stop.
Report validation occurs after restoration; a bad report cannot become success.

60 launcher checks added to49 diagnostic checks:109 pure checks total, plus4
real-process CLI entry refusals PASS. Injected failures at every one of18
controller operations stop the sequence; tests also cover live workers, reused
attempts, configuration drift, invalid reports and seven service mismatches.
An initial test-helper catch failed to handle InvalidDataException; corrected
and the complete suite rerun successfully. No physical execution occurred.
Latest inert candidate:
`out/lic008-guardian-seal-inert-2eefa1a989a64315bea08959df80a078`.

Still missing: the concrete native ILauncherEnvironment, service dispatcher,
protected report writer, live artifact/approval binding and worker integration.
The current interface/fake does NOT prove these native operations are safe or
implemented. The next task is implementing those concrete parts and reviewing
the complete built package before exact-effect approval and any live command.

The internal Probe is deliberately NOT connected to Main or a service entry.
Implement/review a one-shot Guardian-context launcher with exact experiment,
original plan/package/report hashes, current token validation, source/dependency
custody, bounded-worker handling and a separate protected diagnostic report.
Any temporary service configuration change and restoration must be explicit;
do not reuse old V1 launchers or pretend this is a non-mutating shell collection.
Owner approval must bind the executable and those effects before live execution.
No execution command is issued for this inert build.

The eventual worker must not accept late success, retry, stop a live worker,
continue Prepare, publish fixture bytes or touch the app-readable key. A full
pass here would only narrow the problem: original staging-file writes are NOT
tested. Seal/roundtrip and policy verification each remain grouped operations;
if either fails, its native code/suboperation may need further instrumentation.
Source references are not a security review. securityAccepted=false and
productionAccepted=false throughout; V1/V2 remain retained without retry.
