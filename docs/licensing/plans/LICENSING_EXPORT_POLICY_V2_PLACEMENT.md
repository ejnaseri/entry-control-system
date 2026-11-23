# Export-policy V2 placement and artifact contract

Date: 2026-10-27. Source baseline: committed `29efbbd`.
Current status: `V2_CONSUMED_RUN_SETUP_UNKNOWN_IDENTITY_ELEVATION_DIAGNOSTIC`.
Subsequent2026-10-28 [V3 placement contract](LICENSING_EXPORT_POLICY_V3_PLACEMENT.md)
selects a separate source/artifact/owner-kit chain. It does not retry V2, change
the retained evidence below or issue new physical permission.
Subsequent2026-10-28 [scalar-reader correction and artifact checkpoint](LICENSING_EXPORT_POLICY_SCALAR_READER_FIX.md)
passes pure/ordinary-token regression checks. It still binds consumed V2 and is
not a new physical placement; the original physical/artifact history below stays intact.
The source/build checkpoint below predates the subsequent owner-confirmed
[physical result and exact evidence](../evidence/export-policy-control-v2-20261027/README.md).

[Startup diagnostic design](LICENSING_EXPORT_POLICY_STARTUP_DIAGNOSTIC_PLAN.md)
· [Consumed V1 evidence](../evidence/export-policy-control-20261027/README.md)
· [Experiment](../experiments/LICENSING_EXPORT_POLICY_CONTROL.md)
· [Current handoff](../../project/LICENSING_SESSION_HANDOFF.md)

The complete fixed V2 binding chain is implemented. Separate inert, test-capable
and owner-kit artifacts were built and reviewed; exact results and hashes are
recorded below. That build step issued no owner input or approval and performed
no elevated preflight or physical experiment. The later physical step passed
CheckOnly and Prepare, then failed at Setup with an IdentityElevation diagnostic.
V2 is now consumed; the original V1 startup failure's cause remains unresolved.

## Retained V1 boundary

Attempt `f9ed088cce17426cb48759645d45e2e6` consumed
`C:\ProgramData\Ecs.Lic008.ExportPolicyControlV1` and failed at `run-setup`
with `UNKNOWN`. Setup remains registered; Guardian was never borrowed. Missing
role reports and journal markers are not a physical inventory proving that no
CNG key exists. The original service's generic1067 cannot be decoded into the
new startup vocabulary retroactively.

Retain the V1 root, service, binaries, inputs, approval, journal state, possible
keys and archived evidence unchanged. Retain earlier pilot/diagnostic namespaces
too. V2 does not restart, retry, migrate, repair, patch, overwrite, clean up or
access retained keys. A new output directory or attempt ID cannot make V1 fresh.
The old consumed/expired approval is never authority for V2.

## Fixed resource and identity contract

| Binding | Selected V2 value |
| --- | --- |
| Placement name | `Ecs.Lic008.ExportPolicyControlV2` |
| Protected root | `C:\ProgramData\Ecs.Lic008.ExportPolicyControlV2` |
| New Setup service | `Ecs.Lic008.ExportPolicyControlV2.Setup` |
| Setup account and token user/owner | `LocalSystem`, `S-1-5-18` |
| Derived Setup service SID | `S-1-5-80-1349545842-880831857-2158974086-2597486822-1814426470` |
| Test-key prefix | `Ecs.Lic008.ExportPolicyControlV2.TEST_ONLY.` |
| Existing Guardian service | `Ecs.Lic008.EntryEvidenceV2.Guardian` |
| Guardian account | `NT SERVICE\Ecs.Lic008.EntryEvidenceV2.Guardian` |
| Guardian SID and token user/owner | `S-1-5-80-1925419286-2081043195-3517708708-3498839447-1988319315` |
| Administrators SID | `S-1-5-32-544` |
| New artifact/input prefix | `lic008-export-policy-v2-` |
| Sole capable define | `TEST_CAPABLE_EXPORT_POLICY_CONTROLLER_V2` |

These values are compile-time constants. There is no namespace, service-name,
key-prefix or placement override in arguments, environment or untrusted JSON.
The new Setup service uses own-process type16, Manual start3, Normal error
control1 and unrestricted service-SID type1. Its new service SID is a separate
service identity; its process user and owner remain LocalSystem.

The Setup SID above was independently calculated using SHA-1 over the uppercase
service name encoded as UTF-16LE and five little-endian uint32 digest words.
Pure validation must pin that exact value. Physical admission must still resolve
the registered service SID and compare it to the derived value; the calculation
does not prove registration or token membership on the host.

Both arms use names `<prefix><attempt32>.exportable` and
`<prefix><attempt32>.nonexportable`. Attempt32 is exactly32 lowercase hexadecimal
characters. They remain two distinct RSA3072 persisted machine keys in Microsoft
Software Key Storage Provider, with decryption usage1 and policies3 and0.
Creation never overwrites a collision. All compared metadata except export
policy and key material must match. Each key is closed and independently reopened
before its identity is accepted; the positive control precedes each matching
GenericPrivate, PKCS8 and Opaque probe. The original denial classifier stays
unchanged; direct0x80090029 is not promoted into denial PASS.

The protected key DACL remains exactly SYSTEM plus the existing Guardian:

```text
D:P(A;;GA;;;SY)(A;;GA;;;S-1-5-80-1925419286-2081043195-3517708708-3498839447-1988319315)
```

No Setup-service-SID or administrator ACE is added to the key DACL. The new
Setup SID does not replace SYSTEM or Guardian in this contract.

## Protected files and custody

The fixed root contains the same reviewed relative paths under the new placement:

- Deployment: `plan.json`, `reservation.json`, `package-manifest.json`.
- Package: `bin/ExportPolicyControl.exe`, `bin/ExportPolicyControl.dll`,
  `bin/ExportPolicyControl.runtimeconfig.json`, `bin/runtime-inventory.json`.
- Setup journal: `journal/setup-consumed.json`, `journal/exportable-intent.json`,
  `journal/nonexportable-intent.json`, `journal/exportable-owned.json`,
  `journal/nonexportable-owned.json`, `journal/setup-complete.json`,
  `journal/setup-recovery.json`.
- Role evidence: `reports/setup.json`, `reports/guardian-consumed.json`,
  `reports/guardian.json`.
- Controller publication: `controller-result.json`, through its separately
  guarded controller writer rather than the service-store whitelist.

Creation remains exclusive; a pre-existing root or Setup registration refuses
placement. Existing parent/path, reparse, link-count, size, owner, protected-DACL
and pinned-handle checks remain. No generic output path or broad file writer is
introduced. Durable consumption and intent precede creation; owned records
follow actual property and public-identity validation. An absent owned record
does not grant cleanup authority.

| Object | Owner | SYSTEM | Administrators | Existing Guardian |
| --- | --- | --- | --- | --- |
| Root, bin, journal directories | Administrators | Full | Full | Read/traverse |
| Reports directory | Administrators | Full | Full | Modify |
| Setup journal and Setup report | SYSTEM | Full | Read | Read |
| Guardian consumed/report files | Guardian | Full | Read | Modify |
| Apphost and DLL | Administrators | Full | Full | Read/execute |
| Other deployment files | Administrators | Full | Full | Read |

These are exact protected-store rules, not permission for broader ACL grants.
Setup writes only its journal and report; Guardian writes only its consumed
marker and report. The controller writer retains its own root-created/session
and custody requirements.

## Guardian borrow and restoration contract

The original Guardian path remains exactly:

```text
"C:\ProgramData\Ecs.Lic008.EntryEvidenceV2\bin\EntryControl.AdapterPilot.exe" --service Guardian
```

The owner approval binds the complete original Guardian snapshot: fixed name,
virtual account, path, Manual start3, own-process type16, Normal error control1,
service-SID type1, STOPPED/state1, PID0 and other-configuration SHA256. Before
borrowing, the snapshot must still match exactly. Borrowing changes only its
binary command to the new V2 apphost with role Guardian and exact plan, approval
and package hashes; the service name, account and configuration stay fixed.

A valid Setup predecessor report and independently observed Setup process
completion are required before borrowing. Borrow intent is recorded before a
possible partial SCM change. Restoration is one bounded operation after the
pinned Guardian process has independently ended and the complete stopped
snapshot matches the expected borrowed configuration. Owner identity, custody,
host/boot/package and unexpired approval checks remain active. STOPPED/PID0,
a worker-ended report, timeout or startup diagnostic alone cannot authorize
restoration. An unresolved run retains state for review; it does not trigger
automatic rollback, retry, kill, service deletion or key cleanup.

The existing30-second worker budget and45-second external observation budget
remain distinct. Native work must actually end before worker completion is
reported; late success is discarded. The external observer must pin an observed
nonzero PID and process identity. A fast process that was never pinned remains
unresolved even if a report or SCM status exists.

## Complete version and artifact binding chain

Placement-bound contracts adopt V2 together. Their existing schema number may
remain1 where field shape is unchanged; the exact scope is still mandatory.

| Contract | Required scope |
| --- | --- |
| Plan, reservation and lifecycle records | `TEST_ONLY_EXPORT_POLICY_CONTROL_V2` |
| Owner approval | `TEST_ONLY_EXPORT_POLICY_OWNER_APPROVAL_V2` |
| Package manifest | `TEST_ONLY_EXPORT_POLICY_PACKAGE_V2` |
| Native role evidence | `TEST_ONLY_EXPORT_POLICY_NATIVE_EVIDENCE_V2` |
| Inert / capable build | `TEST_ONLY_EXPORT_POLICY_CONTROL_INERT_BUILD_V2` / `TEST_ONLY_EXPORT_POLICY_CONTROL_CAPABLE_BUILD_V2` |
| Inert / capable package build | `TEST_ONLY_EXPORT_POLICY_CONTROL_INERT_PACKAGE_BUILD_V2` / `TEST_ONLY_EXPORT_POLICY_CONTROL_CAPABLE_PACKAGE_BUILD_V2` |
| Package verification | `TEST_ONLY_EXPORT_POLICY_CONTROL_PACKAGE_VERIFIED_V2` |
| Owner-kit build / kit | `TEST_ONLY_EXPORT_POLICY_OWNER_KIT_BUILD_V2` / `TEST_ONLY_EXPORT_POLICY_OWNER_KIT_V2` |
| Prepared input | `TEST_ONLY_EXPORT_POLICY_PREPARED_INPUT_V2` |
| Owner preflight | `TEST_ONLY_EXPORT_POLICY_OWNER_PREFLIGHT_V2` |

The exact V2 candidate, owner-kit and prepared-input directory names use the new
prefix. Builders, helper and wrapper must agree on paths, scopes, pin fields,
source snapshots and package custody; a renamed V1 directory does not qualify.
The capable build binds the exact separately reviewed inert source/tool/reference
and package chain. The kit binds the exact capable candidate and helper/wrapper
snapshots. Default and legacy defines, including
`TEST_CAPABLE_EXPORT_POLICY_CONTROLLER_V1`, stay closed. Environment and CLI
values cannot enable capability.

Stable synthetic/pure-test, token-test and bounded failure-report formats retain
their V1 scopes. The startup codec remains the versioned0xEC1 transport vocabulary
from the diagnostic design. Controller result remains schema2 with scope
`TEST_ONLY_EXPORT_POLICY_CONTROLLER_RESULT_V2`; that result format predates the
V2 placement and is not itself proof of placement. Correlation still requires
the exact attempt, plan, approval and package hashes. Cached raw SCM status is
memory-only; decoding requires STOPPED/PID0, Win32 exit1066 and a valid codec
payload. Both transport and decoded data have `evidenceAuthority=NONE`.

Source review must follow these dependencies through
[contracts](../../../licensing/adapter-evidence/export-policy-control/ControlContracts.cs),
[store](../../../licensing/adapter-evidence/export-policy-control/ProtectedControlStore.cs),
[keys](../../../licensing/adapter-evidence/export-policy-control/NativeKeys.cs),
[identity](../../../licensing/adapter-evidence/export-policy-control/NativeControlIdentity.cs),
[admission](../../../licensing/adapter-evidence/export-policy-control/NativeControlAdmission.cs),
[controller](../../../licensing/adapter-evidence/export-policy-control/ControlController.cs),
[helper](../../../licensing/adapter-evidence/export-policy-control/ControlInputTool.cs),
[control builder](../../../scripts/build-license-export-policy-control.ps1),
[kit builder](../../../scripts/build-license-export-policy-owner-kit.ps1)
and [owner wrapper](../../../scripts/run-license-export-policy-owner.ps1).
Tests must explicitly reject old placement scopes, paths, key names and capable
defines; do not infer isolation from only a new root constant.

## Review sequence and future physical gate

1. DONE: implement the complete V2 source contract and pure negative regressions.
   Review unchanged Guardian/ACL/denial semantics and closed legacy entry points.
2. DONE: build a new inert candidate with pinned source, tools, references, runtime
   inventory and artifacts. Review actual test/refusal reports and source hashes.
3. DONE: build the V2 test-capable artifact against that exact inert baseline, then
   review its package, enabled capability, unchanged effect list and refused
   malformed entry shapes. Capability does not issue an approval.
4. DONE: build and review a new V2 owner kit, including helper/wrapper/token/refusal and
   validator evidence. Record exact candidate/kit hashes and current results.
   Stop this step before CheckOnly, Prepare, input issuance or Execute.
5. DONE October27: review actual read-only elevated CheckOnly output:
   new placement freshness, stopped original Guardian, runtime/host/boot and
   custody. No earlier V1 preflight or pure test substitutes for it.
6. DONE October27: prepare fresh bounded inputs, review exact effects and pins, and
   require the owner's live exact CONFIRM in a visible elevated console. Keep
   native stdin/stdout unredirected; never auto-type or reuse confirmation.
7. DONE October27: after termination observations, separately collect original bytes,
   hashes and service/process observations. Missing output, unresolved process
   state, expiry or drift stays UNKNOWN and requires review before further work.

The future approval's effects remain limited to creating the new V2 root and
reservation; registering/starting the new LocalSystem Setup and two new test
keys; temporarily borrowing the existing Guardian against those controls;
restoring its original path only after independent completion; and retaining
the new keys, Setup and evidence. There is no seal, retained-key operation,
automatic cleanup or retry. A new failure consumes this new placement too.

## Completed source and artifact review

The fixed root, Setup name/SID, key prefix, capability, approval effects and all
placement-bound scopes now select V2. Guardian identity, token user/owner rules,
protected-store and key ACLs, one-attempt semantics, process-exit requirements
and denial classification remain unchanged. The owner wrapper requires exact V2
kit/candidate/input names under the pinned output parent; an Execute input name
must also contain its plan's attempt ID. These pure location checks supplement
the existing filesystem custody checks.

The owner-kit builder now includes the diagnostic and placement sources in the
same ordered source set as the control builder. It resolves the unique host
source by its exact relative path instead of the obsolete fixed array index.
Both builders rejected the previous V1 candidates before creating any output.

| Check | Actual result |
| --- | --- |
| Each control variant and packaged apphost | 17,541 assertions passed |
| New placement component within that total | 179 assertions passed |
| Default and legacy-defines entry refusal | 14 shapes per variant/apphost |
| Capable entry refusal | 13 malformed shapes per variant/apphost |
| Owner helper | 436 pure assertions; 8 malformed entries refused |
| Owner wrapper | 284 pure assertions |
| Owner-kit report validators | 295 pure assertions |
| Own-process token regression | 9 checks; ordinary token, elevation0 |

The control suite's other component counts remain those of the preceding
[diagnostic checkpoint](LICENSING_EXPORT_POLICY_STARTUP_DIAGNOSTIC_PLAN.md#completed-source-and-inert-verification).
These are repeated executions of the same assertions, not independent physical
experiments. The placement tests reject old paths, service identity, full key
snapshot names, canonical scope records and rehashed approval/journal chains.
Rejected intent/owned records reach no fake key operation. Helper and wrapper
tests reject old or mixed scopes with recomputed pins and prior directory names.
Default and all legacy defines, including the V1 controller define, remain inert.
Only the new V2 define enables capable entry; builders never invoke a well-formed
capable service/controller route.

Compilation uses warnings as errors and the pinned .NET10.0.11 runtime. Both
control candidates bind the same25 source inputs,4 tools,167 reference assemblies
and190 runtime/fxr files. Their source-set SHA256 is
`c07047faa2291a410eec655151062944c20275d320b1fed8397e0b7389fef750`.
The kit additionally binds6 helper/wrapper/test/builder sources and PowerShell.
Current source and snapshot hashes, package bytes, report bindings and the
inert→capable→kit chain were checked. This is automated and AI-assisted source/
artifact review, not independent human Security acceptance.

Changed PowerShell scripts passed syntax validation; documentation resolver
self-tests and all751 local link targets across111 Markdown files passed.
The staged changes passed Git whitespace checks.

The token regression queries only its own process. It confirms the corrected
Query|Duplicate membership path under an ordinary token; it does not establish
elevated owner admission. V2 CheckOnly, Prepare, owner-input issuance, Execute,
service changes and CNG operations were not run by that build. The later physical
checkpoint below separately records the actual SCM diagnostic and failed attempt.

| Artifact | Directory under `out/` |
| --- | --- |
| Inert | `lic008-export-policy-v2-inert-e6ef4d93cee14b34a0e3d6e8a57bb36c` |
| Capable | `lic008-export-policy-v2-capable-27db447d0004467087e3d021e7d4ab84` |
| Owner kit | `lic008-export-policy-v2-owner-kit-c654d14c659a48a8bc8f6abe570dc66c` |

| Artifact pin | SHA256 |
| --- | --- |
| Inert manifest | `354b1258af5088a52c36d230a37d20c65abae5b716eeca18541e0269838c8be7` |
| Inert package manifest | `eacdc5b064921916a519717c8eeafdef3aca3a05d01719e8076423261870be77` |
| Inert package build | `8d6ad6ffa0e80eca5dbbf932ae1bc198fd06b02d510f2f52c63f56b22989b195` |
| Capable manifest | `71ed3a49997fd1fdbe2f21163173ba05ce7da6060090c30c0bfe3316da40caa5` |
| Capable package manifest | `41c401552af22ce8459b56f7d03dba26f0fdaab166ef17d2614390eead0d86a7` |
| Capable package build | `9ca78c1e5badce263e137de961986b27406b9d847ce0716a011637b354c89fc3` |
| Capable DLL | `add4b35d175e23bf37a420329db435bacce71a532c80fcd3e791bdaa72750b5f` |
| Shared apphost | `dcf8b1246db7b3d40ac5d98d50d291a580c456882042661e06d9f02c1beae608` |
| Runtime inventory | `f5e89159159cad439f9a473c4c46d6c8ba785c59828f8854d5467dc7d8dd76fa` |
| Owner kit manifest | `991889568c67267caf6de30e54f1311e090d748d0dc2d1f98e3adf53cf111253` |
| Owner kit build | `5e4064744ed0338923ddd99a46ec0b6628f6d31d83407c1a36bd74eed221b15b` |
| Owner helper DLL | `a75929f4e51bebeb148d78409f2db2b1e09c32a83d6f7da55b24ae7b992d178f` |
| Owner wrapper | `ad40a5bee15e51239ae5a4b38eae0157e1204a4b51cc0a0a49af8c6d82d0e816` |

All10 archived V1 JSON byte hashes and5 earlier inert/capable/kit pins were
rechecked unchanged. Retained physical state was not modified or re-admitted.
That checkpoint's next action was the separate elevated CheckOnly and fresh input
sequence below. Paired export evidence, LIC008/Phase6.2, native-entry, Security
and production acceptance remain unresolved.

## Subsequent physical checkpoint — 2026-10-27

With implementation committed as `a24c718`, actual elevated CheckOnly passed,
then one Prepare issued attempt `92d320aeca9d4a469b8e9b5c0b8dadcd`. Exact input
bytes, bindings and effects were independently reviewed before a visible elevated
Execute and the owner's live CONFIRM. Execution failed at `run-setup / UNKNOWN`.
The protected schema2 controller result and independent SCM observations retain
Win32 exit1066 and service-specific `0xEC10F301`: `IdentityElevation / VALIDATION /
0x80131501`, with `evidenceAuthority=NONE`. This locates a failure during token
elevation querying/parsing, without identifying the exact failing predicate.

Guardian was never borrowed and remained original/stopped/PID0. V2 Setup is
retained LocalSystem/stopped/PID0. Both role reports and eight journal/consumption
records were absent; no CNG-key inventory was performed. The V2 root and attempt
are consumed regardless of the missing role-level consumed marker. No retry,
restart, cleanup, retained-bit patch or denial-classifier change follows from
this failure. V1 remains retained separately.

The [evidence archive](../evidence/export-policy-control-v2-20261027/README.md)
records exact captures, inputs, original report hashes and service/process
snapshots. A separate ordinary-process token probe reproduced the reviewed
Scalar method's rejection: TokenElevation's zero-length query returned error24
and required4, while both four-byte queries succeeded; the method requires122.
This is a concrete reader mismatch in that context, consistent with the service
stage, not direct reproduction of its LocalSystem native error.

The bounded fixed-size scalar-reader correction, regressions and new artifact
review are now recorded in the linked October28 checkpoint. Any later physical attempt requires a separately
reviewed fresh placement and inputs; neither V1 nor V2 is reusable.
