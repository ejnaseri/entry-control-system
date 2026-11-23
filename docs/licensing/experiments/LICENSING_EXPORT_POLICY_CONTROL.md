# Matched export-policy control — 2026-10-21

Current checkpoint2026-11-02: [V5 executed after review and owner CONFIRM](../evidence/export-policy-control-v5-run-20261102/README.md), both process/report chains admitted and Guardian restored. GenericPrivate/PKCS8 show differentials; opaque positive control and aggregate remain CONTROL_INCONCLUSIVE. Source/build/kit review and18,480 checks PASS. All V1-V5 attempts are consumed. Full LIC008/Open003/security/production acceptance remains open.

[Licensing map](../README.md) · [Current handoff](../../project/LICENSING_SESSION_HANDOFF.md)

Latest physical checkpoint — 2026-10-28: [V4 is consumed](../evidence/export-policy-control-v4-run-20261028/README.md).
The diagnostic localizes refusal to SetupRun/StoppedProcess without a pinned
process; START_PENDING/PID10372 then STOPPED/PID0, no RUNNING observation or report
read. Setup reports completion, but Guardian was never borrowed and no paired
exports ran. The [initial-status correction](../plans/LICENSING_EXPORT_POLICY_PROCESS_OBSERVATION_FIX.md)
passes independent source/artifact review and18,316 inert checks (+80). Next
separate freshV5 chain; no V1/V2/V3/V4 retry or retrospective cause inference.

Current source checkpoint — 2026-10-28: [bounded controller diagnostics](../plans/LICENSING_EXPORT_POLICY_CONTROLLER_DIAGNOSTICS.md)
adds schema3 / RESULT_V3, closed operation boundaries and per-role memory
observations, authority NONE; report-read refusals are retained separately.
Inert build and independent artifact review PASS:18,076 checks per variant/
apphost, including1,499 controller checks (+234),14 entry refusals each and pure
validator295 PASS. No new capable/owner kit, input or physical experiment.
Next: independently review a fresh placement/binding chain for later instrumented
runtime observation. No retrofit or retry of consumed V3; its exact cause remains
unknown. LIC008/Phase6.2 and security/production remain open.

Latest physical checkpoint — 2026-10-28: V3 attempt9dded1f90d5b4299ba973898bf42890c
is CONSUMED after fresh preflight/input review and live owner CONFIRM. Setup now
records LocalSystem SETUP_COMPLETE and both new-key ownership/completion records.
Controller still fails at run-setup with UNKNOWN/VALIDATION/0x80131501, null
accepted Setup hash and zero Setup exit codes. No Guardian borrow or paired
exports; original Guardian is Stopped/Manual/PID0. Exact predicate is not recorded.
[Protected result, journals, collection and next investigation](../evidence/export-policy-control-v3-run-20261028/README.md).
The diagnostic source checkpoint above preserves independent process completion;
it does not retrofit this evidence or authorize retry of consumed V1/V2/V3.
The [earlier blank console](../evidence/export-policy-control-v3-owner-20261028/README.md)
was owner-closed without CONFIRM; its inputs stayed unreused. Fresh admission
preceded this physical attempt. LIC008/Phase6.2/security/production remain open.

Previous source/artifact checkpoint — 2026-10-28: isolated ExportPolicyControlV3
and the full new root/Setup/SID/key-prefix/scope/capability chain are implemented.
New inert/capable/owner-kit builds and bounded independent review PASS:17,842
checks per control variant/apphost; helper469/wrapper294/token9/validators295 and
ordinary-token Scalar regression pass. This is not LocalSystem service success.
See [V3 contract, exact package/kit pins and review](../plans/LICENSING_EXPORT_POLICY_V3_PLACEMENT.md)
and [exact-byte V3 evidence](../evidence/export-policy-control-v3-20261028/README.md).
That build checkpoint stopped before CheckOnly/Prepare/input/approval/Execute;
the actual owner/physical work is recorded above. Advisory root absence/SCM1060
was not elevated owner preflight. V1/V2 remain retained; LIC008 remains open.

Previous scalar source/artifact checkpoint — 2026-10-28: the fixed-size scalar reader is
corrected.126 new assertions raise the suite to17,667; a pinned ordinary-token
before/after regression reproduces the old elevation failure and verifies the
corrected return. New inert/capable artifacts pass their pure and entry-refusal
checks. See the [correction contract and exact evidence](../plans/LICENSING_EXPORT_POLICY_SCALAR_READER_FIX.md).
At that scalar checkpoint no new owner kit, inputs or physical run existed.
Its next placement/artifact action is now recorded in the V3 checkpoint above;
consumed V1/V2 remain retained.

Latest physical checkpoint — 2026-10-27: V2 elevated CheckOnly and Prepare passed;
after live owner CONFIRM, attempt92d320aeca9d4a469b8e9b5c0b8dadcd failed at
`run-setup / UNKNOWN` and is consumed. Protected controller schema2 and SCM retain
`1066 / 0xEC10F301`, decoded `IdentityElevation / VALIDATION / 0x80131501`, with
authority NONE. Guardian was never borrowed and remains original/stopped/PID0;
Setup remains LocalSystem/stopped/PID0. No paired exports. See
[exact V2 evidence and diagnostic limits](../evidence/export-policy-control-v2-20261027/README.md).
A separate ordinary-process probe reproduced the Scalar reader mismatch: the
zero-length TokenElevation query returns24/required4 while the code requires122;
fixed4 succeeds. LocalSystem's specific native error was not captured.
That checkpoint led to the bounded reader correction/regressions above. Retain
V1/V2; no retry or classifier change. LIC008 remains open.

Preceding source/artifact checkpoint — 2026-10-27: isolated ExportPolicyControlV2
placement and its separate inert, capable and owner-kit chain are implemented
and verified. Each control variant/apphost passes17,541 assertions, including179
placement cases; helper436, wrapper284, token9 and kit validators295 pass.
See the [V2 contract, exact artifact pins and next gate](../plans/LICENSING_EXPORT_POLICY_V2_PLACEMENT.md)
and the preceding [startup diagnostic design](../plans/LICENSING_EXPORT_POLICY_STARTUP_DIAGNOSTIC_PLAN.md).
That build step performed no elevated preflight, new input issuance or physical
run; its next action was the separately recorded V2 execution above. The consumed
V1 state remains unchanged. LIC008 remains open.

Earlier V1 physical checkpoint — 2026-10-27: the October25 owner CheckOnly failure is corrected;
replacement kit, elevated CheckOnly and Prepare passed. After live owner confirmation,
the physical attempt failed at run-setup with UNKNOWN and is now consumed.
Guardian was never borrowed; both services are stopped. No paired export report
exists. See [corrected owner kit](#corrected-owner-kit--2026-10-27) and
[original evidence](../evidence/export-policy-control-20261027/README.md).
Retain the attempt/root/Setup registration; no retry, cleanup or classifier change.
Earlier dated next-step notes are historical.

## Purpose and boundary

The [owner's independent-export diagnostic](../reviews/LICENSING_GUARDIAN_DIAGNOSTIC_BUILT_REVIEW.md)
passed seven prerequisites but returned direct cryptographic HRESULT0x80090029
for all three exports. Seal did not run. This does not distinguish a format or
provider limitation from an effect of the key's no-export policy.

No previous exportable positive control was found in the current pilot or old
comparison/wrapping harnesses. Both retained restricted/app-readable keys use
policy0. Older catch-all CryptographicException PASS and ECC acceptance of29
are not suitable classification logic for this RSA experiment.

Owner agreed to the next comparison step. This authorizes preparing the new
experiment, not bypassing exact-package review and local live confirmation.
Historical status2026-10-23: CAPABLE_ARTIFACT_BUILT_OWNER_INPUT_NOT_ISSUED;
PHYSICAL_EXPERIMENT_NOT_RUN. The prior controller/deployment/inert-package work
was committed first as e0b62f1. A separate purpose-specific capable package is now
built from a pinned inert baseline. Default and legacy-define builds remain closed;
capability only makes the fully admitted owner/service routes available, not
permission to run them. Fresh owner-input preparation/issuance remains outstanding.
Implemented source is not Windows execution evidence. Earlier dated sections are
historical checkpoints; do not apply their closed-gate claims to the new capable DLL.
No original pilot/diagnostic runtime source, installed key, policy, ACL or
consumed evidence is to be changed. securityAccepted/productionAccepted=false.

## Previous inert-core checkpoint — 2026-10-21

- [Comparison core](../../../licensing/adapter-evidence/export-policy-control/MatchedExportProbe.cs):
  validates both immutable synthetic snapshots before callbacks, observes the
  same-format positive control first, erases returned buffers before the next
  callback, and stops on unexpected/wrapped errors or restricted export success.
  Direct10/29 are observations, never denial PASS. Reports explicitly declare
  synthetic=true, metadataAuthenticated=false and all acceptance/seal flags false.
- [Entry point](../../../licensing/adapter-evidence/export-policy-control/Program.cs)
  admits only exact `--self-test`. It contains no native/key/file/service entry,
  even when compiled with former pilot/diagnostic or new control capability defines.
- [Pure tests](../../../licensing/adapter-evidence/export-policy-control/PureTests.cs):
  7,543 assertions PASS, including216 cross-format matrices, mismatched metadata
  before callbacks, per-format positive controls, terminal order, null/empty
  outputs, wrapper HRESULTs, privacy canaries, buffer zeroing and result immutability.
- [Local builder](../../../scripts/build-license-export-policy-control.ps1):
  snapshots three source files and itself, compiles with warnings as errors against
  local .NET10.0.11 references, pins the expected assertion count, and rejects
  nine non-self-test CLI shapes per build. Both default and capability-defined
  variants passed the same7,543 assertions, not15,086 independent cases. Three
  unsupported builder capability/pin arguments refused without creating artifacts.

Candidate: `out/lic008-export-policy-inert-d03f63a7247149ddbc7c41dfd3aadab7`.

| Artifact | SHA256 |
| --- | --- |
| Build manifest | `aaf572afdb8b4ba86d72767b326098b774481fad3333a0a3a145f54e33b68042` |
| Default DLL | `845691c7e82ace7fa4a292308d8e23fd3829bc2d67011cf902354d59af88eed4` |
| Capability-defines-still-inert DLL | `a4a3e3245faf7e9d41351b3544c6b16f3d25c87e751e239b25d452be4e868def` |

All four source/builder pins were rehashed after testing. A separate AI agent's
bounded source review found no blocking issue (PASS_LIMITED); this is not human
security acceptance or physical evidence. Original pilot/diagnostic, server and
client sources have no changes. Documentation links and whitespace checks pass.
Generated `out` artifacts are ignored, not committed application binaries.

At this checkpoint native collection, lifecycle/deployment and authenticated
report bindings were not implemented. The following section supersedes that
implementation status, not its historical artifact pins or physical-test limits.

## Native internal connection — 2026-10-22

Implemented only under `licensing/adapter-evidence/export-policy-control`:

- [Lifecycle](../../../licensing/adapter-evidence/export-policy-control/ControlLifecycle.cs):
  CREATE_NEW consumed marker and durable intent precede each new key; inspect,
  close, independently reopen and compare identity/policy/DACL before recording
  ownership. Completion binds both owned records. Partial failures preserve
  consumed/intent/owned records and attempt a safe recovery record; no retry,
  overwrite, inferred ownership, deletion or automatic rollback.
- [Native key backend](../../../licensing/adapter-evidence/export-policy-control/NativeKeys.cs):
  fixed experiment-bound names, Software KSP RSA3072 machine keys, policy3/0,
  usage1, protected SYSTEM/Guardian DACL. Setup cannot export. Guardian reads
  both new keys and authenticates recorded public identities before comparison.
  There is no retained-key name, Delete operation or existing-key policy setter.
- [Protected store](../../../licensing/adapter-evidence/export-policy-control/ProtectedControlStore.cs):
  fixed root and role-specific file whitelist; handle-based final-path, reparse,
  type, link-count and exact protected ACL checks. CREATE_NEW uses creation-time
  security, durable flush and same-handle readback. This store does not create
  deployment directories or repair ACLs. Guardian needs execute permission for
  package DLL/EXE files; JSON inputs remain read-only for it.
- [Identity](../../../licensing/adapter-evidence/export-policy-control/NativeControlIdentity.cs)
  and [admission](../../../licensing/adapter-evidence/export-policy-control/NativeControlAdmission.cs):
  actual non-impersonating primary Setup/Guardian token, registered SID, pinned
  x64 runtime10.0.11, host/boot, fresh reservation, separately supplied plan/
  approval/package pins, package/runtime inventories and environment refusal.
  The Windows10/11 x64 product target is unchanged; these current exact-runtime
  checks are experimental custody controls, not Windows-matrix acceptance.
- [Service worker](../../../licensing/adapter-evidence/export-policy-control/NativeControlService.cs):
  SCM-only role dispatch and one worker per process. Monotonic30s budget checks
  bracket admission and guard new key/export operations. A timed-out active
  native call is not killed; wait for its return/disposal, refuse later operations
  and retain UNKNOWN. Never report stopped while this worker remains live.
- [Native evidence connection](../../../licensing/adapter-evidence/export-policy-control/NativeControlRuntime.cs):
  Guardian requires a protected, correctly bound successful Setup report before
  its worker. Native reports are separate from synthetic ProbeReport and bind
  role/token/process, plan/approval/package/assembly/runtime/host/boot, worker
  completion and ordered observations. Unexpected errors and boundary failures
  cannot report successful service completion. No seal or runtime acceptance.

`Program` still admits only exact `--self-test`, and `NativeControlRuntime.Dispatch`
refuses unconditionally before token/filesystem/SCM/CNG access. Capability defines
do not open either entry. Source wiring does not authorize invoking internal
native helpers from an alternative entry or reflection.

### Evidence limits and failure handling

Final evidence publication also requires still-valid admission. Expiry or changed
context after work can therefore leave **no final report**; recovery publication
may likewise be refused. Already durable consumed/intent/owned files remain.
Missing or late reports are unresolved, never success or permission to retry.
Do not extend an expired input to recover a report. A future controller must
retain state, independently confirm process/service termination, and request
review before restoration/cleanup. Administrator resistance, power-loss recovery,
actual ACL/CNG behavior and real timing are not established by synthetic tests.

No live CNG operation, service registration/start/configuration, protected-store
write, new approval or owner execution was performed in this step. Self-tests
use fake stores/keys/tokens; Windows SDDL parsing is used for ACL fixtures, not
to change filesystem or key permissions. No private key blob was generated by
these tests. Original pilot/diagnostic, server and client sources are unchanged.

### Verification

Both default and defines-still-inert builds compile with warnings as errors and
pass the same9,845 assertions (not19,690 independent cases):

| Component | Assertions |
| --- | ---: |
| Comparison core | 7,543 |
| Native key rules/closed guards | 245 |
| Store paths/descriptors/role rules | 1,193 |
| Token/identity parsing rules | 368 |
| Service argument rules | 18 |
| Worker deadline rules | 42 |
| Fake lifecycle/failure/ownership | 311 |
| Admission/native report/closed dispatch | 125 |

Each build also refuses nine non-self-test CLI shapes. Builder snapshots fifteen
source files plus itself, pins expected assertion count and rehashes all sixteen
inputs after testing. Two no-op mutation fixtures in the new lifecycle tests were
corrected (the replacement hash initially equalled the original); no runtime gate
was weakened to make them pass. Failed intermediate generated builds are not
execution candidates. These test counts are assertions, not physical scenarios.

Current inert candidate: `out/lic008-export-policy-inert-3dd4dcc77c3d42bf89f858f270eed28f`.

| Artifact | SHA256 |
| --- | --- |
| Build manifest | `b25a59d52090aff1edc52c6aa0f39ddd429695e57baf60a275fc46683d383614` |
| Default DLL | `7f2afc309f738494dcaf40ce904b4530f5f53f43ecf9ea74aca904c4b1f5772f` |
| Capability-defines-still-inert DLL | `11af91623ed4b2348e733c17edaab2c5974bd81664d7aea6db0eddbc5af4a971` |

All sixteen source/builder pins match after testing. Generated binaries remain
ignored; they are not a deployable or approved owner-run kit.
Three unsupported builder capability/pin arguments were also refused without
creating artifacts. Documentation resolver/self-tests pass:108Markdown files,
681local link targets; whitespace checks pass.

Bounded read-only AI-agent source reviews concluded PASS_LIMITED for this closed
entry. Review follow-ups added the successful Setup-report prerequisite and
rechecked the operation deadline after expensive admission reads; the deadline
finding was confirmed resolved. Expiry-related absence of final evidence is an
explicit unresolved state, not an implicit completion. Reviewers did not execute
native operations or independently rerun the assertion suite. These are not human
security sign-off, actual provider/ACL tests or production acceptance.

## External controller and inert package — 2026-10-23

The previous native-internal checkpoint was committed first as `da7014c`.
This step adds the following source wiring without executing its native effects:

- [Controller](../../../licensing/adapter-evidence/export-policy-control/ControlController.cs):
  one-attempt orchestration binds canonical plan/approval/package and the original
  stopped Guardian snapshot. It deploys only the new fixed namespace, registers
  a new Setup helper, and requires successful bound Setup evidence before borrowing
  Guardian. It records borrow intent before calling the configuration change, so
  partial success followed by an error cannot be reported as "never attempted".
  There is no retry, automatic rollback, cleanup or repeated result publication.
- [Owner entry](../../../licensing/adapter-evidence/export-policy-control/ControlOwnerEntry.cs):
  exact owner SID/elevated primary token, local plain input paths, separately supplied
  hashes, canonical approval/effects, live console confirmation, actual apphost/DLL,
  runtime inventory, host/boot and expiry checks. This is input consumption, not
  approval issuance. Its gate and the native runtime gate both remain `false`.
- [Windows deployment backend](../../../licensing/adapter-evidence/export-policy-control/ControlWindowsDeployment.cs):
  fixed new root/directories/files use create-new semantics, creation-time protected
  ACLs, handle identity/readback checks and no repair of existing objects. The new
  Setup is LocalSystem; only the existing V2 Guardian's binary command may be
  temporarily changed. Its account/SID, manual start, stopped state and remaining
  configuration are bound. Configured recovery actions or trigger starts are refused;
  manual start alone does not exclude automatic trigger activation.
- The controller requires an observed RUNNING/nonzero PID, a pinned process handle,
  expected image/start time, signaled process exit and SCM Stopped/PID0 before
  restoration. It then checks the unchanged borrowed configuration and verifies the
  restored original. START_PENDING/STOP_PENDING PIDs are not treated as reliable.
  A process too fast to observe is unresolved, not inferred to have finished safely.
  A missing/invalid Guardian report may be rejected after independently proven safe
  restoration; that restoration does not make the experiment pass. Without process
  proof, with configuration drift or expired authority, retain state for review.
- [Tests](../../../licensing/adapter-evidence/export-policy-control/ControlControllerTests.cs):
  fake deployment/failure seams, partial configuration change, report/PID binding,
  no repeated result write, expiry, approval/package/path parsing, closed native
  guards and twenty service-state/PID combinations. They do not invoke SCM/CNG or
  change protected files/ACLs.

The [builder](../../../scripts/build-license-export-policy-control.ps1) now snapshots
21 inputs (19 program sources, host helper and builder), pins compiler/reference/
HostModel/apphost inputs, and produces an x64 apphost using global .NET10.0.11 only.
The package has exactly four files: apphost, DLL, runtimeconfig and runtime inventory.
The [host helper](../../../licensing/adapter-evidence/export-policy-control/ControlHostBuilder.cs)
also checks actual canonical artifacts through the program's pure parsers/validators;
it does not invoke native admission or introduce a runtime verification entry.
All190 installed runtime/fxr file hashes were verified read-only. Packaging exposed
the legitimate `runtime/.version` file; the schema now permits only that exact
leading-dot exception, not arbitrary dot files or a broad path relaxation.

Verification: **10,893 synthetic assertions** pass in default, defines-still-inert
and packaged-apphost runs (the same suite, not three independent case sets).
This includes1,048 controller checks in addition to the previous9,845. Each of the
three entry surfaces refuses14 non-self-test CLI shapes before native access.
All21 source pins match after testing. Three unsupported builder arguments
(`EnablePhysical`, `Mode`, `ExpectedApprovalSha256`) refuse before creating artifacts.
Both package and native service/controller entries remain inert.
Documentation resolver/self-tests pass:108 Markdown files,687 local link targets;
whitespace checks pass. A separate bounded consistency review found no mismatch
between these current counts/pins, the source gates and the stated next step.

Current inert candidate: `out/lic008-export-policy-inert-83346973a2c54e3ab2b3d15444ee1cd5`.
Earlier intermediate candidates are superseded, not execution candidates.

| Artifact | SHA256 |
| --- | --- |
| Build manifest | `056e6ef927e40b385e0e988cad8a17fdc1dcdff3f10e5c64aa231b482250d5ef` |
| Source set | `2ac9252dcbb170aa09d2b88f5d086705713c1243d0ef24fa1fdd2cae7ff624a1` |
| Package manifest | `f42816384fa0c5432d2b2c958597b7cbc95352315d90dc9ea9dea0528e324faf` |
| Default/package DLL | `0425908e2e7eed9ee02f913d1b7390c2ba8a06e7117df46a9c74d160255311b3` |
| Defines-still-inert DLL | `78917be192e2e8ea33a2665a4d48fe171de8b7a34113d603c178cc5282bad2db` |
| Apphost | `dcf8b1246db7b3d40ac5d98d50d291a580c456882042661e06d9f02c1beae608` |
| Runtime inventory | `f5e89159159cad439f9a473c4c46d6c8ba785c59828f8854d5467dc7d8dd76fa` |
| Package-build record | `f51905b3ceb946148ecf67a64b3869a5b055fdbf763ab2e99e225466d1a7c1f4` |

Bounded read-only AI reviews found and confirmed fixes for partial-borrow reporting,
trigger-start exclusion, valid-state PID observation and ignoring success-time
`pcbBytesNeeded` outputs. No remaining blocker was reported in those reviewed
corrections; reviewers did not run native operations or independently rerun tests.
This is not human security sign-off, physical evidence or production acceptance.
No installed service/key/protected ACL or retained pilot evidence was changed.
No expiring approval was issued and no physical execution command is provided.
Original pilot/diagnostic, client/server and adapter denial-gate sources are unchanged.

## Separate capable artifact — 2026-10-23

The previous external-controller checkpoint was committed first as `e0b62f1`.
[ControlCapability](../../../licensing/adapter-evidence/export-policy-control/ControlCapability.cs)
now enables both physical gates only for the new exact compile symbol
`TEST_CAPABLE_EXPORT_POLICY_CONTROLLER_V1`. Default builds and all three older
pilot/diagnostic/export-policy symbols remain inert. Owner SID/elevation, separately
pinned canonical plan/approval/package, expiry, host/boot/runtime, live exact-effect
confirmation and native service/token/store admission are unchanged.
The program validates complete route grammar through a pure parser before native
dispatch. Self-tests in capable builds use malformed pins/arguments before native
access, rather than the valid-looking closed-gate tests used in inert builds.

The builder defaults to `-Mode Inert`. `-Mode Capable` additionally requires an
existing inert candidate and its separately reviewed manifest SHA256. Before
creating any output it verifies the exact baseline manifest,22 current source
inputs/snapshots, compiler/tool/reference sets, default and legacy DLLs, and the
four-file inert package. It then compiles a separate capable artifact; no generated
old artifact is edited. This custody check is not automated security approval:
the person providing the expected digest must still review the bound checkpoint.
The build helper reads only canonical schemas and the pure capability marker.
No builder path issues owner approval, starts services or invokes a valid native route.

Final verification:

- 10,906 synthetic assertions PASS in default, legacy-defines-inert and capable
  DLL builds and the packaged apphost. This is one repeated suite, not multiplied
  independent physical evidence. The controller component now has1,061 assertions.
- Each inert DLL/apphost refuses14 CLI shapes, including well-formed-looking
  owner/service routes. Capable DLL/apphost refuse13 malformed/foreign shapes;
  the three well-formed-looking routes are deliberately not executed by tests.
- Eight builder refusals PASS without creating output directories: unsupported
  enable flag, invalid mode, unsupported approval pin, missing baseline, inert
  mode with review arguments, wrong-case mode, wrong manifest pin and stale source
  baseline. Both final candidates bind the same22 sources and190 runtime/fxr files.
- `physicalExecutionEnabled=true` on the capable artifact describes its entry
  capability only. `physicalTested`, `securityAccepted` and `productionAccepted`
  remain false. No experiment keys, Setup registration or protected ACL were changed.

Reviewed inert baseline: `out/lic008-export-policy-inert-fc2e37b165444d97b7f8a2eb5444e9f7`.
Separate capable candidate: `out/lic008-export-policy-capable-9ad19481257b419b93e1030a8b6413a8`.

| Binding | SHA256 |
| --- | --- |
| Reviewed inert build manifest | `9ca43314cb7769640aa7f7ea274544d804b938d9edc76be28255c80ecb68ec40` |
| Shared source set | `02c93fbec38dd20d82d6f79b303131d4912630570e80a97406ae1f20dd38ab54` |
| Inert package manifest | `427503ed4804b468464ce7065ef8913c1977b9f2430617373207975c11a1ccc9` |
| Capable build manifest | `a6f918d8c39c45659356f46d7ee93b56ff0592a966474fbcbba19eddec2b7baa` |
| Capable package manifest | `69fcb0349dc4545fd5dcf8633e7c9590c29a9b99963f72e2c2be385c5c083605` |
| Capable DLL | `8542e3724ac597b610971c2be83b354d464d7a87536ea6db5f39d8ac5fce8680` |
| Apphost | `dcf8b1246db7b3d40ac5d98d50d291a580c456882042661e06d9f02c1beae608` |
| Runtime inventory | `f5e89159159cad439f9a473c4c46d6c8ba785c59828f8854d5467dc7d8dd76fa` |
| Capable package-build record | `661b381afafc116a40bbc465a6daf056f4f576bfacc8f3090fdc8d0baf210d77` |

Bounded read-only AI source review found no concrete blocker in the deployment
contract or new capability/build delta. A separate read-only artifact check matched
all22 current source pins and both snapshots,4 build tools,167 reference assemblies,
190 installed runtime/fxr files, both four-file packages, variant DLLs and the pinned
inert-baseline provenance. It confirmed stored counts/flags and the capability
define only in the capable compile response; it did not execute native routes or
independently rerun the assertion suite. Documentation resolver/self-tests pass:
108 Markdown files,688 local link targets; whitespace checks pass.
This is not a human security sign-off,
physical execution evidence, administrator resistance proof or release acceptance.
Read-only Windows observations at this checkpoint: original Guardian command/account,
Stopped/Manual/PID0; no configured triggers/recovery actions; new test root absent;
new Setup query returns1060 (not registered). These observations must be repeated
when issuing inputs and at execution; they are not an evergreen approval.

### Owner-input helper and wrapper — 2026-10-24

Historical checkpoint: owner CheckOnly subsequently failed; do not rerun this
kit or treat its pure-test/source review as elevated preflight success. See the
October25 correction below. Previous sources/kit preparation were committed as
`abfa457` before beginning that correction; generated output remains uncommitted.

The preparation boundary is now implemented separately from the unchanged capable
candidate. [ControlInputTool](../../../licensing/adapter-evidence/export-policy-control/ControlInputTool.cs)
is compiled from that candidate's exact source snapshot without the capability
define, with its own entry point. Its physical controller/service gates remain
closed. The [owner-kit builder](../../../scripts/build-license-export-policy-owner-kit.ps1)
rechecks the22 candidate sources,4 build tools,167 reference assemblies,190 runtime
files and four-file package before and after building the separate helper. It
never invokes a valid check, preparation or physical controller command.

The [owner wrapper](../../../scripts/run-license-export-policy-owner.ps1) has three
separate modes; Prepare never falls through to Execute:

| Mode | Permitted effect | Not performed |
| --- | --- | --- |
| CheckOnly (default) | Read-only package/runtime, elevated owner, host/boot, original stopped Guardian and fresh root/Setup checks | No input issuance, service/key/ACL change |
| Prepare | Repeat preflight; create a fresh local output directory and three CREATE_NEW JSON files with canonical plan/approval bindings and a two-hour window | No controller execution, auto-confirmation or protected Windows change |
| Execute | Recheck separately reviewed kit/input hashes and fresh preflight; enter the existing capable controller with live exact owner CONFIRM | No elevation, retry, old-approval extension or automatic cleanup |

Preparation pins ancestor/file handles, rejects reparse or multiple-link files,
flushes and reads back its new files, and repeats preflight. Partial output is
retained on failure. Its inputs are not security acceptance or a substitute for
separate review/live owner confirmation. Only the public guarded read-only
ObserveGuardian/RequireFreshSetup deployment methods are used by the helper.

Before any managed helper starts, the wrapper hashes and read-locks the pinned
runtime/fxr files as well as the helper and candidate files. It refuses an
unreviewed newer/prerelease hostfxr selection rather than validating it after load;
this follows the muxer's [host selection order](https://github.com/dotnet/runtime/blob/main/docs/design/features/host-components.md).
Only process-local DOTNET_ROOT may be temporarily excluded; it is restored in
finally, including failure paths. User/Machine settings stay unchanged and other
prohibited runtime overrides are refused.

Verification:240 helper pure assertions,8 malformed helper CLI refusals and53
wrapper assertions PASS. Five additional wrapper entry refusals PASS before any
helper invocation. The wrapper suite checks environment restoration on success
and failure, prohibited overrides, paths, hashes and unchanged persistent
DOTNET_ROOT. Bounded read-only AI source review found no concrete blocker in this
scope; it is not independent human security acceptance or a Windows physical run.

Final owner kit: `out/lic008-export-policy-owner-kit-86cb2dc5b6914a50a6e3b4563e3c106c`.
It references the unchanged capable candidate9ad19481257b419b93e1030a8b6413a8
and package hash69fcb0349dc4545fd5dcf8633e7c9590c29a9b99963f72e2c2be385c5c083605.

| Owner-kit binding | SHA256 |
| --- | --- |
| kit.json (separately supplied expected pin) | `ba3ef5c3c597ef3e21e1f1e17615c2dec5de56ff5fc690931e3f9700f4dc29c1` |
| kit-build.json | `b386f46295f825036f79cf1487cba423aa0d6a7577cc55430ece1f13811eb97c` |
| Run-Owner.ps1 | `655887a9781ef658dab7a3c20fc989760efe18e67986130a3cf0b0f153c40adb` |
| ControlInputTool.dll | `d21ad674c138be508c1c2dac3f28732dc7241296af46284645d92f2092b24f56` |
| Helper runtimeconfig | `614b63d58626fb0d97ff1313dc925605aafdba2b82a32c9d53b1bafa0286d516` |

Separate bounded AI artifact review matched451 file-hash checks across current
and snapshot copies, with1,342 integrity assertions:3 kit files,5 helper inputs,
22 candidate sources,4 tools plus PowerShell,167 references,190 runtime files and
4 package files. It verified report pins/counts/false flags and the helper's own
Main with no capability define. These include repeated copies, not451 distinct
runtime tests, and do not establish elevated preflight or physical success.
Documentation resolver/self-tests PASS:108 Markdown files,691 local targets;
PowerShell parsing and whitespace checks PASS.

Four owner-kit builder refusal cases created no output: malformed build digest,
wrong valid-shaped build digest, wrong package digest and out-of-range owner SID.
Initial compile-only snapshot2d79a6a4f0404219a199d77d9c50db60 stopped on a nullable
analysis warning; corrected before the successful pure build. First successful
kit8b00d7ecee9a43189433048a840b6adb was superseded after pinning the exact240 test
count. Both are retained/unissued, not commands for the owner.

The final kit's CheckOnly invocation in the agent's non-elevated console passed
file/runtime verification then refused EXPECTED_OWNER_ELEVATED_CONSOLE_REQUIRED
before starting the helper. No input directory was created. This is expected
refusal evidence, NOT a successful elevated SCM/owner preflight. Separate read-only
Windows queries observed Guardian original account/path, Stopped/Manual/PID0,
new Setup query1060 and new control root absent. These observations must be
repeated by elevated CheckOnly and do not authorize later effects.

Immediate next: owner runs the reviewed kit in elevated CheckOnly mode and sends
the full output. Only after that result is reviewed and the owner is ready, issue
fresh Prepare inputs and review their exact hashes/effects before a separately
confirmed Execute. No approval/expiry was issued by this build. Existing grants
from other attempts do not authorize this two-key experiment. After failure retain
state; no retry or retained key/ACL change. Process/expiry uncertainty may retain
temporary configuration; never claim restoration without proof.

### Owner CheckOnly failure diagnosis — 2026-10-25

Owner ran kit86cb2dc5b6914a50a6e3b4563e3c106c in elevated CheckOnly mode. The wrapper
excluded process DOTNET_ROOT then returned OWNER_HELPER_FAILED_OR_REFUSED_RETAIN.
No success/prepared-input/physical-stage result was produced. Its generic output
does not identify the exact thrown exception; do not label this a successful run.

Read-only diagnosis found two concrete defects. Both ControlInputTool.RequireOwner
and NativeControlDeployment.Guard opened a Query-only primary token then called
WindowsPrincipal.IsInRole, whose token-duplication step requires TOKEN_DUPLICATE.
Local Query-only reproduction returned SecurityException/Access denied; Query plus
Duplicate performed the membership read successfully under the current ordinary
token. This changes handle access for a membership query, not account privilege
or the requirement for enabled Administrator membership. See
[DuplicateTokenEx access requirements](https://learn.microsoft.com/en-us/windows/win32/api/securitybaseapi/nf-securitybaseapi-duplicatetokenex).

The helper also reduced every exception to a generic stderr string, and the
wrapper emitted stderr on the success stream inside an enclosing Write-Output
expression before throwing; a synthetic reproduction confirmed that the inner
reason was lost. Earlier pure tests did not cover actual Windows token membership.
Three issued kit file hashes still matched; read-only SCM showed original Guardian
account/path and Stopped/Manual/PID0. No source, service, key or ACL was changed
during diagnosis. The old kit is retained and must not be patched in place.

### Corrected owner kit — 2026-10-27

Status: CONSUMED_RUN_SETUP_UNKNOWN; elevated CheckOnly and Prepare PASS, followed
by a failed physical attempt after live owner confirmation. The owner authorized the
five-step correction/build/preflight/preparation/experiment workflow in this
session. Exact runtime admission and local live confirmation remain part of
the executable contract. The build itself issued no input; the subsequent
separate Prepare invocation below did.

The shared primary-token membership opener now requests Query|Duplicate in both
the input helper and deployment guard. Failure output is a closed six-field JSON
record (stage/category/code/HResult plus schema/scope); the PowerShell wrapper
retains this sanitized diagnosis in its terminating error. Raw exception text,
paths, data and native-host stderr are not forwarded. The builder now accepts
this exact refusal contract and pins the updated test counts.

Verification of this replacement build:

- 414 helper pure assertions, including route separation, no callback after
  malformed input, diagnostic field/order/category rules, bounded exception
  unwrapping and privacy canaries; eight actual malformed helper CLI refusals.
- 195 wrapper assertions, including malformed diagnostics, no raw stdout/stderr
  leakage and nested capture of the sanitized terminating error.
- 295 pure builder-validator assertions; missing/duplicate/extra/reordered fields,
  wrong types, coerced booleans/numbers and changed scope/count/runtime are refused.
- Nine actual own-token regression checks under pinned .NET10.0.11: Query-only
  duplication returned access denied and membership raised SecurityException
  (HRESULT -2146233078); Query|Duplicate membership lookup succeeded. The builder
  ran with isAdministrator=false/elevation=0, primary token and no impersonation.
  This is a read-only token regression, not elevated SCM/owner preflight.
- Independent bounded AI source review found no concrete blocker. Separate
  artifact review rehashed both corrected inert/capable chains:22 source inputs
  and snapshots,4 tools,167 references,190 runtime/fxr files and each package.
  Existing issued-kit/candidate pins still match. This is not human Security
  acceptance or independently rehashed consumed protected pilot evidence.

The corrected controller package already existed at this checkpoint; its current
source and snapshots were verified rather than rebuilding or patching artifacts.

| Binding | SHA256 |
| --- | --- |
| Inert764ff23fbceb435189dd8bc96427cc87 manifest | `98847ae913d330c6c0e2b9c51415284e08ad44edffbc2bae06cde143cd78692a` |
| Capablea3bd7cfbf58543678366d113cd32da0b manifest | `fa2da315a1fb7bc654095526e42d8955bc594007ac15c2bec6bf3128973dcbec` |
| Capable package manifest | `97b8caf02391035147418568c017cc49865bf38e342643ad3734e1232d829292` |
| New owner kit.json | `61a8519bd99c64e6b3d33504a4358a6d5185e783908f3231cd408cf0c9ed5dc8` |
| New kit-build.json | `d19ede622362d8674b7dd9fd9bc9f1b068864d6e01f0bf419655250b4760804a` |
| New Run-Owner.ps1 | `a331874c22ce3812c35d7d729e21e62e92118bebbebe7e5a5bbc3d4cdffd9ee6` |
| New ControlInputTool.dll | `e6825b55577a42b2b09d6377e68891545953959e84ca9db8dc5aa392dceb8ab0` |
| Own-token report | `97feeddc67bb59edc5bd9ee8313e2c70c20908904d8a2f2f72688cf0cea6d845` |

New kit: `out/lic008-export-policy-owner-kit-d3b686b0ca964df8b7a9f77fb289cefc`.
Build reports separately retain helper/wrapper/token/validator digests and
elevatedOwnerPreflightPassed=false. No key, service, protected ACL or consumed
attempt was changed by building/testing it. Physical/security/production
acceptance remain false.

Elevated CheckOnly ran through normal Windows UAC on October27 at09:11:21-29UTC
(13:41Kabul). Its actual helper report is READY_FOR_INPUT_PREPARATION with the
exact candidate/package/owner pins and original Guardian path/account,
Stopped/Manual/PID0. An independent read-only review checked both the capture
and inner report. Capture SHA256:
`71eb38c0b789e9962575b5a4b3c2e3d6fbf61335eadbe860a047aae94ff62e54`.

One subsequent elevated Prepare invocation succeeded. Its three local files
bind attempt `f9ed088cce17426cb48759645d45e2e6`, the unchanged candidate,
host/boot/owner and all five exact controller effects. Separate review rehashed
the files and matched the descriptor, Guardian snapshot and canonical bindings.

| Prepared binding | Value |
| --- | --- |
| Input directory | `out/lic008-export-policy-input-f9ed088cce17426cb48759645d45e2e6` |
| plan.json SHA256 | `199d1b43dbc2b835974e13230e6ba5f32343a50f85eaaa1dac1b570b4dadeddb` |
| approval.json SHA256 | `dea69dc9adf4d6a2ac5f307dcb9d3ed3ad9f5089b2165ab39164e482dbe2f155` |
| Issued UTC | `2026-10-27T09:14:34.600704+00:00` |
| Expires UTC / Kabul | `2026-10-27T11:14:34.600704+00:00` / October27 15:44:34 |
| Prepare capture SHA256 | `9dd69b4e953484a01a00085e2cc2261eb6e2a58a5ad1ac24f473d6af72f99ca9` |

Captures and separately reviewed launch scripts are retained under
`out/lic008-export-policy-owner-check-903b289e99a54ae39e95afb2427fa569`.
The single-use Execute launcher invokes the pinned wrapper directly in a visible
elevated console, without redirecting native streams or supplying confirmation.
Its SHA256 is `2c3db50ee02e4eb9dec7b50182b44ac4e127bfb574318a509a1189955b04b7d8`.
The owner entered the displayed CONFIRM line and confirmed this in the conversation.
Execution ran09:18:56-09:22:05UTC (13:48:56-13:52:05Kabul). The input is now
consumed regardless of its original expiry; preserve it without edit or reuse.

### Consumed Setup failure — 2026-10-27

The [original controller result](../evidence/export-policy-control-20261027/controller-result.json)
records phase=run-setup, outcome=UNKNOWN, failure.kind=VALIDATION and
managedHResult=-2146233087 (0x80131501). Both report digests are null;
guardianBorrowAttempted=false and guardianRestored=false. The latter does not
mean restoration failed: borrowing never began, so restoration was unnecessary.

The separately reviewed read-only collector ran09:22:31-35UTC. Initial, copy-admission
and final SCM/CIM snapshots agree: new LocalSystem Setup is Stopped/Manual/PID0
with Win32 exit1067; existing Guardian is Stopped/Manual/PID0 with its original
path and service account. No live control process was observed. The four copied
protected JSON files and four deployed binary/inventory hashes match the prepared
plan and reviewed package. Collector no-mutation flags apply to collection only.

Setup/Guardian reports and all eight expected journal/consumption files were
absent. No paired export observations were obtained. Source order requires
durable consumed/intent records before key creation; this narrows the failure
to startup/admission or the first durable write, assuming the retained journal
is unchanged. It is not an independent CNG key inventory or authority to clean up.

SCM events record registration and exit1067. In
[NativeControlService](../../../licensing/adapter-evidence/export-policy-control/NativeControlService.cs),
1067 is also the generic status explicitly assigned when startup/work fails;
its catch discards the original exception. Identity capture and admission can
fail before the report-producing catch, and the controller can turn a missing
report into a generic validation failure. The original failing check/HResult
cannot be recovered from these records; do not describe1067 as proof of a crash
or attribute the failure to a specific token/ACL/environment defect.

| Retained result | SHA256 |
| --- | --- |
| Execute-result.json | `0a9d4733a0e0e8d33a4cb6032f6d6d04eb0b4f6039085ec635a8a3d9640ed33a` |
| Original controller-result.json | `18e738920ff0ae70136fd0a2a8f1b1a1d94f274c9f019a4dff1eadcf7f3750a2` |
| Read-only collection-index.json | `7bc892cf1a77f5e3797f2c49760af20155666cd861a582ee83e6ae1725de63b0` |
| SCM-events.json | `03ff890b71dd046a0924692821667a055fbcd68bc90ff3454d14444c8a68f37f` |

The [evidence archive](../evidence/export-policy-control-20261027/README.md)
preserves exact JSON bytes, provenance and interpretation limits. No service
restart, retry, cleanup, retained-binary patch or classifier widening followed.
The subsequent [source/inert diagnostic checkpoint](../plans/LICENSING_EXPORT_POLICY_STARTUP_DIAGNOSTIC_PLAN.md)
implements fixed stage/category/listed-HResult reporting without exception text
and records the recovery/isolation plan. Actual SCM diagnostic behavior and the
physical comparison remain unverified; LIC008/security/production stay open.

## Matched physical experiment

Two NEW named persisted keys, never ephemeral or imported copies of a retained
key. Each key has distinct random key material and a unique experiment-bound
name; the controlled configuration differs only in export policy:

| Property | Nonexportable arm | Exportable positive control |
| --- | --- | --- |
| Provider | Microsoft Software Key Storage Provider | Same |
| Algorithm / size | RSA / 3072 | Same |
| Scope / usage | Machine / Decryption | Same |
| Export policy | None (0) | AllowExport + AllowPlaintextExport (3) |
| Protected key DACL | SYSTEM and existing V2 Guardian only | Same |
| Creation / reopening | LocalSystem Setup → existing Guardian | Same |
| Runtime / API / formats | Pinned runtime, CngKey.Export, existing three formats | Same |

Create without overwrite; verify created public identity, close creation handles,
then reopen under the actual Guardian token with MachineKey|Silent. Read back
provider, algorithm, size, machine scope, usage, exact policy, protected DACL and
public identity on BOTH arms before any private-export probe. Verify distinct
public identities and equality of each created/reopened identity. Mismatch must
stop before export. A synthetic metadata assertion is not physical verification.

Use a separately named Setup helper for new-key creation; do not rerun or modify
retained Setup/Prepare. The controller design may temporarily borrow the existing
Guardian only under explicit exact-effect confirmation, with original configuration
pinned and restoration after confirmed stop. If this cannot be safely bound,
stop and revise the placement plan rather than substituting a different identity.
Ephemeral or Guardian-created controls alone cannot claim Setup→Guardian parity.

Fixed isolated namespace: `Ecs.Lic008.ExportPolicyControlV1`, separate from
EntryEvidenceV2 and consumed GuardianSealDiagnosticV1/V2/V3. Its exact placement,
owned-key journal, service-side admission and external deployment/controller now
have implementations with default-closed entries. The October27 capable attempt
failed before comparison and consumed this namespace/root/Setup registration.
The design below does not authorize restarting that attempt or issuing replacement
inputs against its retained state.

## Observation and interpretation

For GenericPrivateBlob, Pkcs8PrivateBlob and OpaqueTransportBlob, in this order,
observe exportable control FIRST, then nonexportable arm. Do not change API,
policy or format adaptively, retry operations, or execute a seal/roundtrip.
Only direct unwrapped cryptographic10/29 failures may continue to gather the
paired observation; wrapped, unrelated and unexpected errors stop. An empty
positive-control buffer is not successful evidence and stops the experiment.

| Positive control | Nonexportable arm | Interpretation |
| --- | --- | --- |
| Nonempty export returned | Direct10 or29 | POLICY_DIFFERENTIAL_OBSERVED, only for this pair/format/runtime |
| Direct10 or29 | Direct10 or29 | CONTROL_INCONCLUSIVE; no working positive control |
| Any observed control outcome | Export returned, even empty | BOUNDARY_FAILURE; zero buffer and stop |
| Wrapped/unexpected error or malformed output | Not attempted or unresolved | UNKNOWN; stop, retain evidence |

POLICY_DIFFERENTIAL_OBSERVED is not runtime PASS, proof about retained key material,
approval of all provider versions, or security acceptance. Both arms failing29
does not prove universal format incapability. HRESULT values are managed error
observations, not independently captured NCrypt return codes. The existing gate
in [KeyOperations](../../../licensing/adapter-evidence/pilot-runtime/KeyOperations.cs)
remains unchanged. A future correction requires actual results and a separately
bounded review; never relabel old UNKNOWN reports or weaken the gate speculatively.

All returned private buffers are zeroed in finally, including empty, oversized or
unexpected outputs. Never persist, log, hash, Base64-encode or include private
blobs in reports. Safe results contain only arm/format/outcome/error category
and managed HRESULT, with no exception messages, stack traces or data dictionaries.
The experiment never uses licensing payloads or production key material.

## Lifecycle and remaining execution work

1. DONE for the bounded inert scope: implement/review the pure comparison and
   safe-result contract and record the preceding physical outcome.
2. DONE for closed-entry source/fake-test scope: connect isolated creation,
   ownership and reopening to the protected store and service worker.
   Intent must be durably recorded BEFORE creation, ownership/public identity
   after verification. No automatic delete-on-error, broad prefix cleanup or
   overwrite. If creation succeeds but verification or the owned-public record
   fails, preserve the uncertain key, intent and explicit orphan/recovery state.
   Intent or a matching name alone never authorizes deletion.
3. DONE for closed-entry source/fake-test scope: one-attempt external deployment/
   owner-entry controller and inert apphost packaging. No physical execution,
   capable build or approval issuance is claimed by this completion.
4. DONE for bounded source/artifact/pure-test scope: purpose-specific capability,
   pinned inert baseline, separate capable build, owner-input helper and narrow
   wrapper. DONE October27: corrected owner kit, elevated CheckOnly, fresh Prepare
   and independent input/artifact review. Original pins and time window retained.
5. EXECUTED ONCE October27 after live owner confirmation; failed at run-setup
   with UNKNOWN. No paired observations. Guardian never borrowed and original
   stopped configuration verified. Retain consumed root, inputs and Setup service;
   no retry, automatic cleanup or patched retained artifact.
6. NO CLASSIFIER CHANGE: the failed startup provides no export-policy evidence.
   Source/inert startup diagnostics and the isolated V2 contract are now recorded;
   separate V2 inert/capable/owner-kit artifacts are built and reviewed.
   DONE subsequently: V2 CheckOnly/Prepare and reviewed inputs, then live-confirmed
   execution. V2 also failed at run-setup/UNKNOWN, now with the bounded
   IdentityElevation diagnostic and a separately reproduced ordinary-token reader
   mismatch. DONE October28: bounded reader correction, ordinary-token regression
   and separate inert/capable artifact verification. NEXT: a fresh-placement
   contract and newly bound artifacts/inputs. Both attempts stay consumed. This experiment does not
   close LIC008 or accept production security.

Do not generate a time-limited approval until the physical runner and its exact
package have been reviewed and the owner is ready to run it. No current command
is provided for physical execution.

## Primary references

- [CngExportPolicies](https://learn.microsoft.com/en-us/dotnet/api/system.security.cryptography.cngexportpolicies?view=net-10.0):
  None0 vs AllowExport1/AllowPlaintextExport2; archival4/8 are not this experiment.
- [NCryptCreatePersistedKey](https://learn.microsoft.com/en-us/windows/win32/api/ncrypt/nf-ncrypt-ncryptcreatepersistedkey):
  null-name ephemeral behavior, named persistence, machine and overwrite flags.
- [NCryptExportKey](https://learn.microsoft.com/en-us/windows/win32/api/ncrypt/nf-ncrypt-ncryptexportkey):
  private blob formats and in-memory size-query/output semantics; listed errors
  are not exhaustive and do not mandate the current gate's single denial code.
- [QueryServiceStatusEx](https://learn.microsoft.com/en-us/windows/win32/api/winsvc/nf-winsvc-queryservicestatusex):
  PID validity depends on service state; required-size output is specified for an
  insufficient-buffer failure, not successful status reads.
- [QueryServiceConfig2W](https://learn.microsoft.com/en-us/windows/win32/api/winsvc/nf-winsvc-queryserviceconfig2w)
  and [SERVICE_TRIGGER_INFO](https://learn.microsoft.com/en-us/windows/win32/api/winsvc/ns-winsvc-service_trigger_info):
  trigger configuration is queried separately; zero triggers are required by this
  controller, rather than assuming manual start means no automatic activation.

These API descriptions inform the design; they do not replace real test evidence.
