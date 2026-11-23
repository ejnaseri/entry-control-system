# Guardian diagnostic built-package review — 2026-10-18

## Current owner-run independent-export result — 2026-10-21

Status: PHYSICAL_ALL_THREE_EXPORTS_UNKNOWN_RESTORED; NOT_ACCEPTED.
Owner supplied the complete schema4 / TEST_ONLY_GUARDIAN_SEAL_DIAGNOSTIC_REPORT_V4
controller output for attempt `fbd377ea27da4025b585fdfbc9abcd29`.
Process12104 started2026-10-21T08:05:18.5094058Z (12:35:18 Kabul).
workerEnded=true, deadlineExceeded=false, workerFailure=null.

| Observation | Result |
| --- | --- |
| Seven prerequisites through key policy/DACL/public identity | PASS |
| private-export-generic | UNKNOWN / 0x80090029 |
| private-export-pkcs8 | UNKNOWN / 0x80090029 |
| private-export-opaque | UNKNOWN / 0x80090029 |
| seal-roundtrip-memory | NOT_RUN; correctly blocked by UNKNOWN |
| Controller termination | DIAGNOSTIC_UNKNOWN_RESTORED |

Each export failure is CRYPTOGRAPHIC, HResult/nativeStatus -2146893783,
wrapperDepth0. The field named nativeStatus duplicates the managed HRESULT;
it is not an independently measured NCrypt return or evidence of which native
size-query/data-export call failed. No export-policy differential or security
acceptance follows from these three matching failures.

Exact report bindings (matching the previously reviewed local artifacts):

| Binding | Value |
| --- | --- |
| Experiment | `30173bfda30af041dcc879170579d658` |
| Plan SHA256 | `5f1a449b81d80da5c741f99e0274c2553b177df9795706cc91df71894acdfd4e` |
| Assembly SHA256 | `55b8cb81f94799047533bf7a23e08e0796327e540476d4c06d19fa9ca0920557` |
| Approval SHA256 | `0e9cc5ee1f25c292ef29fa3b9e8122f4bdb3080e5652e5651e22ea305432a8d5` |
| Package SHA256 | `5a9c5cf944120a066a9e1e17de3cf0be2d1ab090ad0874fab74aa4c11398b26a` |
| Boot binding | `6739c70accbde52a1ad75630ac7c4f1ddad10728156df13497d416fbb6f0d0bd` |

Protected report location:
`C:\ProgramData\Ecs.Lic008.GuardianSealDiagnosticV3\reports\result.json`.
Evidence here is the owner's controller-console JSON, not an independently
read/hashed raw report. Read-only SCM inspection confirms Stopped/PID0/Manual,
account NT SERVICE\Ecs.Lic008.EntryEvidenceV2.Guardian and original command
`"C:\ProgramData\Ecs.Lic008.EntryEvidenceV2\bin\EntryControl.AdapterPilot.exe" --service Guardian`.
The non-elevated agent made no service/key/ACL changes. Consumed V1/V2/V3 and
original pilot evidence stay retained. securityAccepted/productionAccepted=false.

Next: [separate matched export-policy experiment](../experiments/LICENSING_EXPORT_POLICY_CONTROL.md).
The current pilot gate still accepts only its original denial code; no global
reinterpretation of 0x80090029 or original Prepare retry is authorized.

## Current October21 input after expiry

Historical preparation only: this input was subsequently consumed by the owner
execution above. Its pending-run/absent-root observations describe pre-run state.

Source/report successor committed `1b8d191`; prior placement/result committed
`f6de973`. Before handoff, client date advanced to October21. The October20 input
2d9a9c776dda44d69b281def75403369 correctly refused CheckOnly with
APPROVAL_EXPIRED_DO_NOT_EDIT_REQUEST_FRESH_REVIEW, before controller/service effects.
That input and all prior artifacts remain unchanged; never edit expiry or reuse it.

The same capable packagebaafb2f635764b95ad7c8a36fd66a954 was freshly rechecked:
22 source inputs/4 package hashes and sizes match,1211 pure assertions PASS,
runtime custody PASS, Guardian Stopped/PID0/Manual/original command/account and
V3 diagnostic root absent. Fresh input emitted by the reviewed preparation entry:
`out/lic008-guardian-seal-execution-fbd377ea27da4025b585fdfbc9abcd29`.
Approval SHA256:
`0e9cc5ee1f25c292ef29fa3b9e8122f4bdb3080e5652e5651e22ea305432a8d5`.
Wrapper SHA256:
`90aecb41239664230ebfb403d18e552a05be8195dffaa215fcd841183ac78f44`.
Boot remains6739c70accbde52a1ad75630ac7c4f1ddad10728156df13497d416fbb6f0d0bd.
Issued2026-10-21T07:36:02.4114399Z; expires2026-10-21T11:36:02.4114399Z,
**16:06:02 Kabul on October21**. Fresh wrapper CheckOnly PASS; wrapper behavior
unchanged except the new approval pin. No service/probe execution, automated
renewal or changed expiry on an old approval. Physical result remains pending.

## Current independent-export package and input — 2026-10-20

Status: LIMITED_INDEPENDENT_EXPORT_BUILD_REVIEW_PASS; OWNER_RUN_PENDING.
Previous V2 placement/result committed first `f6de973`. The new
[independent-observation contract](../experiments/LICENSING_GUARDIAN_SEAL_DIAGNOSTIC.md)
keeps unsupported UNKNOWN, continues only direct0x80090029 export observations,
and prohibits seal/completion after unresolved checks. A source review found a
wrapped-HRESULT classification gap; corrected before final builds with explicit
no-inner-exception guards and144 additional wrapper/sequence/privacy assertions.

Final inert7bd7b89149bf4267a512734a2d9939c1 and capablebaafb2f635764b95ad7c8a36fd66a954
pass1211 pure assertions through DLL/apphost (same set, not2422),12/9 entry
refusals per host, and3 invalid builder-pin refusals with no new artifacts.
Final builds have no compiler warning.22 custody inputs,20 snapshots and4 package
files match;190 runtime files and loaded modules verify. Separate bounded AI
source/artifact review found no remaining blocker; no independent human security
acceptance or fresh physical run is claimed.

| Reviewed artifact | SHA256 |
| --- | --- |
| Source set | `a2d59f15cf33a618dd1640fce313a5e4be6f4f4479b6cee71ce7e191cc7d8a73` |
| Package manifest | `5a9c5cf944120a066a9e1e17de3cf0be2d1ab090ad0874fab74aa4c11398b26a` |
| Diagnostic DLL | `55b8cb81f94799047533bf7a23e08e0796327e540476d4c06d19fa9ca0920557` |
| Fresh approval | `8b4a0b9fcbfb05daf1e52ac146fb687b33203d155efe050a8f26b2b1153595fb` |
| Execution wrapper | `6e55b6215667686e24bd4be2412ddb643b0d8840527120f70c089ca7c66ea6e7` |

Package: `out/lic008-guardian-seal-capable-baafb2f635764b95ad7c8a36fd66a954`.
Historical October20 input/wrapper (expired; use October21 checkpoint above):
`out/lic008-guardian-seal-execution-2d9a9c776dda44d69b281def75403369`.
Approval V4 binds report4/root GuardianSealDiagnosticV3, retained experiment/plan
and boot6739c70accbde52a1ad75630ac7c4f1ddad10728156df13497d416fbb6f0d0bd.
Issued2026-10-20T18:22:47.0322894Z; expires2026-10-20T22:22:47.0322894Z,
**02:52:47 Kabul on October21**. Input preparation emits JSON only; live owner
confirmation is still mandatory. Local ignored outputs are not committed binaries.

The earlier newly prepared inputbe3039f5b6fb43ba9281b38665f33e3e failed CheckOnly
with OWNER_OR_BOOT_CHANGED_REQUEST_REVIEW, before controller/service effects.
Owner SID was unchanged; queried boot binding differed from55f50efa... and was
stable at6739c70a... across three subsequent reads. CIM LastBootUpTime still
reported October18; an actual reboot or a specific cause is NOT established.
That input/wrapper remain unchanged (SHA25645a2e83fa576dddb048881a454b69c7cdba8c064db292871a0171d1a4b6f2746
and9306f0f1e9406fa1495b93082811fefff77de3df4839f7a16f4fbee9e65df1ec).
The replacement changes only boot/attempt/times and its wrapper approval pin.
No automatic renewal, expiry edit or boot-check bypass was introduced.

Fresh CheckOnly PASS verifies package/context/runtime/state. Process-local
DOTNET_ROOT removal/restoration PASS; synthetic other override refused and
restoration verified. Persistent User/Machine settings untouched. Guardian
independently observed Stopped/PID0/Manual/original path/account, new V3 root
absent. Protected original plan/report pins still require elevated controller
revalidation; the non-elevated agent cannot independently hash them.

Next: owner runs the current wrapper once in Administrator PowerShell and enters
the exact displayed CONFIRM line. Preserve consumed V1/V2 evidence. No original
pilot code, keys, ACLs or installed services were changed by preparation. On any
failure retain state and send full output; do not retry this or old wrappers.
SecurityAccepted/productionAccepted remain false and LIC008 stays open.

## Current owner-run per-format outcome — 2026-10-20

Status: PHYSICAL_GENERIC_EXPORT_UNKNOWN_RESTORED.
Owner ran attempt a288f62ae7284f979490d225303d7f16 and supplied the controller's
schema3/V3 report and DIAGNOSTIC_UNKNOWN_RESTORED output. All experiment/plan,
assembly, boot, approval, package and attempt pins match the prepared input below.
Process12628 started2026-10-20T11:49:45.5223901Z (16:19:45 Kabul);
workerEnded=true, deadlineExceeded=false, workerFailure=null. Seven prerequisites
PASS, including retained RSA-3072/decryption key policy, protected DACL and public
identity. The first export, private-export-generic, is UNKNOWN:
CRYPTOGRAPHIC/HResult -2146893783 (0x80090029), wrapperDepth0.
PKCS8, opaque and seal/roundtrip were NOT_RUN. No all-format denial or completed
seal is established. The recorded nativeStatus copies the managed HRESULT.

This identifies CngKey.Export(GenericPrivateBlob) as the failing operation, not
the underlying reason. The generic PRIVATEBLOB identifier is documented by
[Microsoft](https://learn.microsoft.com/en-us/windows/win32/api/ncrypt/nf-ncrypt-ncryptexportkey);
do not assume an invalid RSA format or reinterpret unsupported as access denied.
Read-only SCM separately confirms Guardian Stopped/PID0/Manual with its original
path/account. Protected report cannot be read/hashed by the non-elevated agent;
this remains owner-supplied console evidence, not independently hashed raw evidence.

The V2 diagnostic root/report and wrapper are now consumed and must be retained.
No retry, cleanup, Prepare or retained key/ACL change. Prior V1 evidence remains.
Next: bounded diagnostic-only independent export observations, retaining UNKNOWN
and preventing seal/completion after unresolved exports. Review/test a new isolated
successor before fresh owner execution. LIC008/security/production remain open/false.

## Current isolated successor review and input — 2026-10-20

Historical preparation status: LIMITED_BUILD_AND_CUSTODY_CHECKS_PASS.
The owner execution above supersedes OWNER_RUN_PENDING; this input is consumed.
Prior inert per-format work committed `8d1a63e` before this step. New default-inert
candidate159d47a7886b48208f270c4cfdf4b3f3 and explicit diagnostic-capable
candidate4fbaf5ba572a42f7932987e74a4261f8 both pass646 pure assertions through DLL
and apphost (same assertions, not1292). Inert12/capable9 entry refusals per host
PASS. Three missing/wrong/unexpected source-pin cases refuse before output.

All22 custody inputs,20 snapshots and4 package files match;190 runtime files and
loaded native modules verify. Separate AI source/artifact review found no blocker,
not independent human security acceptance. Original pilot sources, installed state
and previously issued/consumed artifacts are unchanged. Fixed successor root is
GuardianSealDiagnosticV2; approval V3 binds that root and report schema3 and rejects
the consumed attempt. Package contract remains V2; pure-test scope remains V1.

| Reviewed artifact | SHA256 |
| --- | --- |
| Source set | `a13188104071aabef0022d52c80ba64359b7e70559e07d8d3ab57b33d4752d62` |
| Package manifest | `4a5aa1eb23ab7bd99f066767bdf07940d7f4d4b73a34b2ad0e970dd49df847e1` |
| Diagnostic DLL | `4f0ee08aef40daa9d28b5d1eaee48956700f23b48f583f97b8487cf6e4383a14` |
| Apphost | `632899c66bf2cc1ae077af1cdd65a8f56ba5140dd57ad1e6ba3b4578e008fb73` |
| Runtime inventory | `efd118a9ccb26555782c0ffe5afe77047ab72b876f0ef0f91d31090f5fcccbd3` |
| Fresh approval | `509c6245b5f3078be8cc7a824de6e1360f22613361c5f91587bd9b6cd8e033fb` |
| Execution wrapper | `29ca4fff8812231d5a804b02c1008c6dcd2d48e002a5144108034080e0406be6` |

Package: `out/lic008-guardian-seal-capable-4fbaf5ba572a42f7932987e74a4261f8`.
Fresh input/wrapper: `out/lic008-guardian-seal-execution-a288f62ae7284f979490d225303d7f16`.
Attempt a288f62ae7284f979490d225303d7f16 binds the same retained experiment/plan
and current boot55f50efa40f732b847b4dfbdc5c2dedcd5844c5695a06a3a2a47735b7ecffefc.
Issued2026-10-20T10:20:15.8013153Z; expires2026-10-20T14:20:15.8013153Z,
**18:50:15 Kabul, October20**. Do not edit expiry or reuse after reboot/failure.
Input preparation emits JSON only; it is not live execution or owner confirmation.
Generated packages/inputs remain local ignored artifacts; custody pins are recorded
here, not a claim that ProgramData state or generated binaries were committed.

Read-only checks independently observe the new root absent and Guardian
Stopped/PID0/Manual with original path/account. Protected retained plan/report
pins cannot be reread by this non-elevated agent; the elevated controller must
revalidate them before confirmation/effects. Wrapper -CheckOnly PASS verifies
package/context/runtime/state and never enters the controller. Parser errors0.
Process-only DOTNET_ROOT exclusion/restoration also passes CheckOnly; a synthetic
COMPLUS override is refused and DOTNET_ROOT restored on that failure. User/Machine
environment settings stay untouched; all other runtime gates remain enforced.

Next owner action: run this new Run-Diagnostic.ps1 in Administrator PowerShell,
review the effects and enter the complete displayed CONFIRM line. Only the
existing V2 Guardian path/start is temporarily changed; restore follows confirmed
stop. V1 diagnostic evidence and retained pilot keys/ACLs remain untouched.
Do not retry after failure; send full output. No new service/probe stage has been
executed by the agent. Original export-format cause remains unknown; no UNKNOWN
is converted to PASS, and securityAccepted/productionAccepted remain false.

## Previous inert successor checkpoint

Prior work and the physical result below committed `73fc6e4`.
A [separate inert per-format successor](../experiments/LICENSING_GUARDIAN_SEAL_DIAGNOSTIC.md)
now passes623 pure checks and nine entry refusals per host. It identifies the
specific export format in report schema3; no new physical run/approval occurred.
The schema2 UNKNOWN outcome below remains unchanged and its root is retained.
That inert per-format checkpoint was subsequently committed as `8d1a63e`.

## Owner-run physical outcome — 2026-10-20

Current status: PHYSICAL_DIAGNOSTIC_EXECUTED_UNKNOWN_RESTORED.
All five preparation/execution/interpretation tasks below have been performed.
This closes that diagnostic work list, NOT the seal fault, LIC008 or security/
production acceptance. No correction of the original fault is claimed.

The owner supplied the controller-printed schema2 JSON followed by
`DIAGNOSTIC_UNKNOWN_RESTORED`. It matches the reviewed experiment/plan, assembly,
approval, package, boot and attempt pins. Attempt:
`ae144443de634367b40496e90192f3eb`; process3300 started
`2026-10-20T07:16:34.1245052Z` (11:46:34 Kabul).
`workerEnded=true`, `deadlineExceeded=false`, `workerFailure=null`;
`securityAccepted=false`, `productionAccepted=false`.
This is owner-supplied console evidence; the non-elevated agent cannot reread
the protected report or independently collect its file hash. Do not label this
as an independently hashed raw report.

| Probe portion | Observed result |
| --- | --- |
| Read intent/owned records and validate ownership | 3 PASS |
| Read and validate published public control | 2 PASS |
| Open retained restricted key | PASS |
| Verify provider/algorithm/machine/export/usage policy, DACL and public identity | PASS |
| Private-export check | UNKNOWN: CRYPTOGRAPHIC, HResult `-2146893783` / `0x80090029`, wrapperDepth0 |
| Seal/roundtrip in memory | NOT RUN: sequence stopped at preceding UNKNOWN |

The report's nativeStatus repeats CryptographicException.HResult; it is not an
independent native API measurement. No successful private export was observed
in the reached attempts, but all3 export-denial checks have NOT been proved.
The ordered7-PASS/1-UNKNOWN prefix is accepted as diagnostic evidence by
NativeDiagnostic.ValidateReport; CompletedProbe still requires all9 PASS.

Read-only SCM inspection after receipt independently confirms Guardian is
Stopped/PID0/Manual, under its expected virtual account and original command:
`"C:\ProgramData\Ecs.Lic008.EntryEvidenceV2\bin\EntryControl.AdapterPilot.exe" --service Guardian`.
Diagnostic report remains at
`C:\ProgramData\Ecs.Lic008.GuardianSealDiagnosticV1\reports\result.json`.
The diagnostic root is now retained/protected; do not delete it, reuse the
consumed attempt, rerun this wrapper/Prepare or change retained V2 ACLs/keys.

### Interpretation and bounded next correction

[Microsoft defines](https://learn.microsoft.com/en-us/openspecs/windows_protocols/ms-erref/705fb797-2175-4a90-b5a3-3918024b10b8)
`0x80090029` as NTE_NOT_SUPPORTED, distinct from NTE_PERM (`0x80090010`).
The [current export loop](../../../licensing/adapter-evidence/pilot-runtime/KeyOperations.cs)
tries GenericPrivateBlob, Pkcs8PrivateBlob, then OpaqueTransportBlob, accepting
only NTE_PERM and zeroing any successfully returned bytes before refusing.
The grouped diagnostic records no format identifier, so this report cannot
identify which format returned NTE_NOT_SUPPORTED. Do not relabel it as PASS,
assume OpaqueTransport failed, claim the original October17 exception is proven
identical, or change global denial classification. Earlier wrapping harnesses
accepted every CryptographicException; their PASS cannot validate this stricter
check by itself.

Next: add allowlisted per-format observations/raw status to a separate diagnostic
successor with focused pure tests, preserving fail-closed acceptance and zeroing.
Then review the exact candidate and explicit retained-root handling before any
new owner-approved physical run. Existing issued artifacts/reports and installed
pilot remain frozen; no such successor or physical permission is issued here.

### Pre-execution environment refusal

Before this run, the wrapper refused the owner's inherited `DOTNET_ROOT`.
Owner confirmed it was the only matching process variable; read-only inspection
found User setting `C:\Users\Owner\.dotnet`, no machine setting. A temporary
process-only removal with finally restoration was tested using -CheckOnly and
then executed by the owner. Persistent User/Machine settings and the reviewed
wrapper were unchanged. This resolved a launcher precondition, not the seal
fault. No runtime/environment admission gate was weakened.

## Fresh owner-run input after expiry — 2026-10-20

The owner reported `APPROVAL_EXPIRED_DO_NOT_EDIT_REQUEST_FRESH_REVIEW` from
the October19 wrapper, then requested a fresh attempt. Its line21 expiry guard
runs before any executable/controller launch, service operation or reservation.
This was an expired-input refusal, not a physical probe failure. The old bundle
and its approval hash remain unchanged; do not reuse or extend its validity.

Read-only re-review confirmed all4 package lengths/hashes,21 current custody
inputs and the recorded source-set pin. The same apphost reran326 pure tests
and runtime inventory/actual loaded-module verification successfully; no native
service/probe route ran. Process/machine runtime overrides and Guardian service
Environment are absent. All three retained V2 services are Stopped/PID0/Manual;
Guardian retains its original path/account. Diagnostic root is absent.
The current owner SID matches; current boot differs from October19 and is
explicitly bound in the new input. The non-elevated agent cannot reread protected
retained plan/reports; their existing pins are unchanged and the Administrator
controller must revalidate all three before confirmation or effects.

Same capable candidate and package hash as the consolidated review below.
New execution folder:
`out/lic008-guardian-seal-execution-ae144443de634367b40496e90192f3eb`.
Attempt: `ae144443de634367b40496e90192f3eb`.
Issued `2026-10-20T06:31:32.3753078Z`; expires
`2026-10-20T10:31:32.3753078Z` (15:01:32 Kabul on October20).
Boot: `55f50efa40f732b847b4dfbdc5c2dedcd5844c5695a06a3a2a47735b7ecffefc`.
Approval SHA256:
`6bf581faa4e9242ffec9d0c4034aec9a8cfbc88184eee9410e541ea5b271ba11`.
Run-Diagnostic.ps1 SHA256:
`713aa0fdd3333a3ba8917e5b4f94f10dae76617298a8c7f3d63b54b7d6807f2d`.

Input was emitted by the reviewed `--prepare-diagnostic-input` route, not a
manual expiry edit. New wrapper differs only in its approval pin (apart from
line endings); `-CheckOnly` returned
`READ_ONLY_PACKAGE_AND_CONTEXT_PASS; NO_SERVICE_EXECUTED`.
The scope/effects and complete local confirmation requirement remain unchanged.
No live confirmation was supplied by an agent. At issuance the fifth task was
pending; the subsequent owner outcome is recorded above. Root cause correction,
LIC008 completion and security/production acceptance are not claimed.

## Consolidated correction and artifact review — 2026-10-19

Status at October19 review: READY_FOR_OWNER_RUN_DIAGNOSTIC, NOT_PHYSICALLY_TESTED.
The three findings below are corrected in the new candidate. This remains a
limited code/tool/AI-agent review, not independent human security acceptance.

- [x] GSD-R1: exact named approval/package pins carried in the service command;
  exact parser and command checks through configure/start/observe/restore.
- [x] GSD-R2: actual loaded hostfxr/hostpolicy/coreclr paths and hashes verified;
  current, machine and service environment checked, repeated before StartService.
- [x] GSD-R3: schema2 report binds approval/package/unique attempt plus UTC start;
  observed PID and exact start checked when available. Canonical protected attempt
  is frozen across controller/service. Fast-worker unobserved PID remains explicit.
- [x] Consolidated builds/review:326 pure tests in inert and diagnostic-capable
  DLL/apphost, five malformed/closed entry refusals per host,190 runtime hashes
  and actual native module verification. These are repeated runs of the same
  tests, not additive counts. Original Program.TestCapable remains false.
- [x] Owner-run physical diagnostic and output interpretation on October20:
  7 PASS, export check UNKNOWN, seal/roundtrip not run; Guardian restored.
  This completes execution/interpretation, not a successful probe or fault fix.

Parallel scoped AI reviews covered transport, runtime/environment and report
correlation. Root also added current-controller EXE/DLL self-binding, exact
observed start-time comparison and immediate pre-start environment recheck.
Runtime review caught a HostBuilder snapshot/custody race: all custody inputs
now checked before/after, and the copied HostBuilder must match its recorded
source hash before compilation. Corrected final builds pass326 cases.

Default inert candidate: `out/lic008-guardian-seal-inert-6fbaad75d39a425c98cba305e0466080`.
Explicit diagnostic-capable candidate:
`out/lic008-guardian-seal-capable-7c44587ec937413280c4961a1ee12ea9`.

Source-set SHA256 (21 entries including builder/host source):
`fc56ae13296806f6a10bf8642f4e71141580cbe9600d6ca4f2381b60db78b160`.
Capable package-manifest SHA256:
`72639765689688f0bfd5afb7ececae385ca8181b7ae3012950df7f5ab733b11b`.
Capable DLL SHA256:
`9bdbd13f6903722e8f9db88ac1f846db8493dd16b1602740a19a62a2fb7797ff`.
Four manifest files and21 custody inputs rehashed against the final candidate.
No capable native route was executed by build/review checks.

### Original owner-run handoff — superseded by October20 input above

The user requested all five steps and correction of any diagnosed cause in this
conversation. The prepared input describes only this one diagnostic attempt;
it does not authorize Prepare rerun, key creation/deletion, retained ACL edits,
product activation or production/security acceptance. Live owner confirmation
is still mandatory and was not supplied by an agent.

Execution folder: `out/lic008-guardian-seal-execution-d85fedeb5021499bba9036d9e219ae8d`.
Attempt:d85fedeb5021499bba9036d9e219ae8d.
Prepared input validity:2026-10-19T13:10:52.2785141Z through17:10:52.2785141Z
(21:40 Kabul on2026-10-19). Current boot bound; reboot/expiry requires review
and fresh input, never manual edits or automatic renewal.
Approval input SHA256:
`3ef1e5186e36054d2681c92c3ca6c42aecd331b4f3e264d6194b69f02f160270`.
Run-Diagnostic.ps1 SHA256:
`503fd70b66404ada872a242b397a50134b74a4192729ca69d9966d0fd5c246ab`.

Wrapper -CheckOnly passed source/package pins, owner/boot and expiry without
service execution. Normal invocation requires Administrator and unredirected
exact confirmation. Effects: create a new protected diagnostic root, temporarily
change only the existing V2 Guardian binary path, run one existing-key read/
in-memory probe, and restore original path only after verified stopped state.
On failure retain state and return the complete output; no automatic retry.
The JSON report is printed after validation and also retained separately.
Neither success of this probe nor a generic stop closes LIC008 by itself.

Historical first-pass review follows.

Disposition: PASS_LIMITED_INERT_CUSTODY / NOT_READY_FOR_PHYSICAL_EXECUTION.
Baseline commit:74185fc (previous deployment connection:bab61b2).
This is a limited author/tool-assisted review, not an independent human security
review, production acceptance or a substitute for Windows execution evidence.

## Exact artifact and checks

Candidate: `out/lic008-guardian-seal-inert-8bb36ba930dc4079af5d054b7223cfc3`.
Package-manifest SHA256:
`b32e79782b7210d753be435a6f73ab230580f14ba430f5e9850396c03f49d90a`.
Assembly SHA256:
`7dba5e1b822135a1c47b2d5f4de2681ea54680a4a8d7409800f9446d91578845`.
Runtime inventory SHA256:
`efd118a9ccb26555782c0ffe5afe77047ab72b876f0ef0f91d31090f5fcccbd3`.

- 19 recorded runtime/diagnostic/codec source hashes match current working inputs.
- 4 package files match their recorded lengths and hashes.
- Apphost --self-test rerun:166 pure cases PASS (not new physical tests).
- Apphost --verify-local-runtime rerun:190 runtime/fxr files verified; bound
 inventory hash matches the exact package file.
- Five physical CLI probes refuse with exit2 and the expected closed-entry code.
- Only local inert executable checks and read-only file inspection were run.
 No SCM operation, protected diagnostic deployment, key access or approval issued.

The19-source comparison does not establish complete toolchain reproducibility:
the builder/host-tool/reference inputs and dependency-loading assumptions need
to remain covered in the final capable-package review.

## Findings to close before enabling execution

### GSD-R1 — service pin delivery is absent (blocking wiring gap)

Launcher.DiagnosticPath has only --diagnostic-service. Deployment.RunService
requires expectedApprovalHash and expectedPackageHash; Main rejects the route.
There is no path from the separately reviewed owner pins to the service's
expected values. This is intentional inertness, but enabling Main alone would
not complete admission.

Required correction: carry the exact two validated lowercase64-hex pins from
the confirmed deployment object into the allowlisted SCM command/entry, compare
that full command throughout configuration/restore checks and parse the exact
argument count before any native call. Do not read a file then trust its own
digest as the expected value. Do not broaden to arbitrary arguments/paths.
Keep the original restoration command unchanged and the default build closed.

Acceptance tests: correct pair roundtrip; missing/swapped/extra/malformed pins,
changed command or context rejected; no setup/Prepare route introduced; CLI
remains closed until a separately reviewed capability decision.

### GSD-R2 — runtime files are checked, actual host loading is not fully bound

RuntimeCustody checks the installed10.0.11 inventory and the loaded CoreLib path.
It does not attest the actual loaded hostfxr/hostpolicy/coreclr module paths and
hashes. Global apphost search and framework rollForward=Disable are not, by
themselves, evidence that every native host module is the one hashed. Two fxr
directories (10.0.1 and10.0.11) are present on the inspected development host;
this is NOT evidence that the wrong one was loaded.

The builder sanitizes its test child's DOTNET_/COMPLUS_/CORECLR_/COR_ environment;
WindowsLauncher does not inspect the service's configured/inherited runtime
environment. Passing sanitized builder checks is not evidence for that service
environment. Managed checks happen after runtime startup; do not describe them
as prevention of malicious pre-managed-code execution or resistance to admin.

Required correction: define a bounded runtime/environment preflight and verify
the actual relevant native modules in the diagnostic process, or select a
reviewed app-local deployment approach. Choose one explicit loading model and
test refusal of mismatches. Preserve the broader product Windows10/11x64 target;
these exact-version pins belong only to this diagnostic candidate.

### GSD-R3 — report lacks exact diagnostic approval/attempt correlation

DiagnosticReport binds the retained experiment/plan, DLL, boot and a positive
PID. It does not carry the diagnostic approval hash, package-manifest hash or
fresh diagnostic attempt identity. ValidateReport only checks ProcessId>0;
there is no independent association with a process observed by this launcher.

New-root CREATE_NEW and protected ACLs already mitigate accidental reuse; no
replay exploit is claimed here. Nevertheless, the report does not contain enough
explicit correlation to prove the exact reviewed diagnostic attempt, especially
if reports are collected later as separate evidence.

Required correction: bind approval/package/unique-attempt values in the report,
reservation and validator. Define process correlation without requiring that a
fast worker necessarily be seen in a polling interval; document any remaining
limitation. Do not replace this with a bare positive PID check or silently accept
old report schemas. Test changed/missing bindings, late/unknown results and
wrong-attempt reports as refusals.

## Next bounded work

Implement GSD-R1 first while keeping execution disabled, then GSD-R2/GSD-R3 and
their negative tests. Rebuild and review the resulting exact artifact before
issuing a fresh owner approval or starting any service. These are three findings
from this review, not a guarantee that later integration finds no further issue.
The cause of the original restricted-seal-stage UNKNOWN remains unresolved.
