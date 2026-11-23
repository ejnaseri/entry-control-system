# Physical-pilot inert foundation checkpoint

2026-10-10. CHG0112 / LIC-EV-0181.
Owner authorized next inert preparation step following EV0180. This is the first
implementation slice, not a complete physical kit or an executable Track B plan.
No commit or independent source review performed in this implementation turn.

## Implemented

Separate sources: `licensing/adapter-evidence/pilot-foundation/`:
Policy.cs, Program.cs, MakeHost.cs, README.md. Builder:
`scripts/build-license-pilot-foundation.ps1`. Existing Track A, Core/backend/
client/historical controllers and preserved specs unchanged.

Policy models compare injected default owners with independently assigned role
owners,18 representative file rules with exact protected ACEs, staged G-owned
input/S-owned publication metadata/digest equality and ten ordered action IDs.
Unknown/live/failed completion blocks further actions. All observations are
fixtures, not actual Windows TokenOwner/file security/SCM/CNG evidence. File
rules represent ownership classes, not the complete directory/plan/host/bootstrap
admission manifest; SID strings are controlled fixtures, not measured host SIDs.
No physical role action is implemented. In-memory booleans do not obtain real
operator authorization, attest worker completion or prove native hang recovery.

Direct frozen csc build uses SDK10.0.400 references/compiler. Frozen HostModel
creates a pure-runner apphost with AppLocal-only runtime search. Self-contained
win-x64 output copies pinned local10.0.11 runtime and hostfxr;194 package files
individually inventoried. Source snapshot also binds both exact reviewed spec
versions and builder; relevant dirty source/diff disclosed. No restore/network/
MSBuild imports. Hash correspondence is custody, not trusted signature, accepted
source/binary equivalence or universal Windows10/11 compatibility.

MakeHost uses the standard [Microsoft HostWriter API](https://github.com/dotnet/runtime/blob/v10.0.0/src/installer/managed/Microsoft.NET.HostModel/AppHost/HostWriter.cs),
with generated output confined to a new workspace/out tree. The frozen actual
HostModel DLL hash is in toolchain/provenance, not inferred from the online source.
This apphost is not a registered Windows service or an actual child-role emitter.

## Actual author-executed evidence

141/141 pure cases PASS:10 token-owner fixture cases,108 file-rule cases,
16 publication model cases,7 sequence cases. IDs are distinct; counts measure
assertions, not completed original FEP/catalog obligations. Actual apphost
`--role Setup` refuses exit2 with only PHYSICAL_ACTION_NOT_IMPLEMENTED stderr
and empty stdout. PhysicalImplemented/physicalTested/nativeKspTested/
measuredTokenOwner/securityAccepted/productionAccepted=false, durable=false,
runtimeAuthority=NONE. Self-test reports own loaded DLL and own EXE hashes.

Successful output:
`out/lic008-pilot-foundation-4e7a1aec2a6c46719ced052d4431bfc7/`.
Version0.1.0/runtime10.0.11/X64, report UTC2026-10-10T11:36:57.8994202Z.
Source baseline95336c58f39fb49e39f9c7248670028b994ede09 plus bound dirty inputs.
Source/compiler/reference/runtime/host-tool/package validation and original
repo-source checks finish without mismatch. Reports/output remain ignored in out.

| Artifact | SHA256 |
| --- | --- |
| build-provenance.json | e6cf1851dcbc90cd302b6eae4cc6d8bd6953f5e06678129e14ec013ef0938364 |
| source-manifest.json | 07c605eaacb55974063069c2bc5687a51fbec13f3d63ccbd2001311686002e59 |
| toolchain-manifest.json | 7257bfb872377f8b9e43fc53b3cb446c8e8e21bf3e4fd622b57ea26c19227f6b |
| package-manifest.json | 723b7516054961d3f7d8a64283e453b0d52184a69fd1e0646ce12d9048d3b695 |
| host-tool.rsp | 49c22618a551ebdab73d2ac25e43783fb3556f08d17f08353a83d0bc6a27dc5a |
| foundation.rsp | 3408047ee82d4f0b392b8c0f6d3304f2ffaa545db620c2fab7c0ba3c8c4e3497 |
| pure-test-report.json | ecb2629e733f41333ea2eeacdd1060ee138c0eb39ae27035e39dfd210f5163c9 |
| entry-refusal.json | a4af1db9f27990e33996082828c7b1451f9d5ead113c1b58f20bc20bc04ee5b2 |
| executed managed DLL | a1602f7f63835b3beb3cf02d226d53ad106a2499174734c5d44272b9f76defe4 |
| actual apphost EXE | b2d92222ef647fb42e4f4757407b163cacc32b665bdfda60b6a661f7d1c98f72 |

Two development attempts are retained, not claimed PASS: first host lacked
bundled hostfxr and refused launch; second encountered PowerShell singleton
inventory Count after tests. Corrected builder bundles/hash-checks hostfxr and
uses array-normalized inventory count. No installed runtime or machine setting
changed to work around them; final fresh output is evidence above.

## Remaining work and next checkpoint

Next bounded non-author review of this new policy/builder/actual output before
extending foundation into a controller/native role implementation. Proposed
owner/directory/file/role creation rules need full model/guard coverage, strict
stage-plan/schema/RunId/host/artifact admission, negative package/kit/manifest
fixtures and complete kit/provenance/archive chain. Native token capture,
same-handle secure file creation/read-back, publication/actual role/child report
emitters, service controller, RSA/KSP and real worker lifecycle are NOT_IMPLEMENTED.
No device/admin execution instruction now; no protected-resource/test collision
check, service/key/ACL/token/DB mutation in this turn. Physical permission remains
separate after exact executable review. Four REM/LIC008/Open003 and NE/native
gates stay open. This slice does not complete physical-kit preparation or grant
Security/production acceptance. New source/docs uncommitted.

EV0182: above changes committed6150a3c, then [limited non-author source/output
review](../reviews/LICENSING_PILOT_FOUNDATION_REVIEW.md) confirms exact custody and
recorded141 cases/refusal. One LOW PF-R01 publication metadata composition gap:
source owner and source/destination ACE checks are not enforced within Publish.
Next bounded correction/tests/fresh output/targeted review before extending into
physical operations. Prior implementation checkpoint's uncommitted note is
historical; source is now committed, new review/status docs uncommitted.

## CHG0114 / LIC-EV-0183: publication metadata composition correction

2026-10-10: user authorizes PF-R01 correction. Foundation0.1.1 reconstructs
expected staging and shared rules independently from trusted fixture G/P
identities and the closed file catalog. Observed owner/ACEs cannot define
expected policy. Publish now requires both source/destination protected DACL
flags, exact owners/ACE inventories, correct creators/allowed path pair,
no existing destination and unchanged bounded digest before accepting the model
operation. The existing File validator is called within Publish for both ends.
No actual file copying/token/ACL/native operation is added.

Forty added regressions (ten for each of four file pairs): SYSTEM owner wrongly
substituted for Guardian at source; broadened source/destination ACEs;
unprotected source/destination; wrong source/destination creator; unlisted
matched path pair; duplicate source/destination ACEs. The sixteen previous
publication assertions remain. Full run181/181 unique pure cases PASS plus
actual apphost physical-command refusal. PF-R01 author correction implemented;
targeted non-author confirmation PENDING, not CLOSED.

Final output `out/lic008-pilot-foundation-6c31cbebb0d740e8a39cc4a9edad4f89/`.
Version0.1.1/runtime10.0.11/X64, UTC2026-10-10T13:26:46.3849717Z.
Source baseline6150a3c76842013612f2db9b6d53e44168bdf977 plus bound dirty source.
Frozen source/toolchain/194-file package and actual DLL/EXE identity checks PASS.
Apphost hash stays unchanged because it loads the fixed DLL basename; changed
DLL/package/deps/source/provenance hashes are independently bound, so unchanged
EXE alone must never be interpreted as unchanged executed implementation.

| Corrected artifact | SHA256 |
| --- | --- |
| build-provenance.json | c8a606de4901262b9d058498954d60840d573db3b55bb01465cd98a1e06eedab |
| source-manifest.json | a9275df516b92b067455c8698b8b424361b1d9cc62e7124c531e64b927276f1a |
| toolchain-manifest.json | 7257bfb872377f8b9e43fc53b3cb446c8e8e21bf3e4fd622b57ea26c19227f6b |
| package-manifest.json | 0e20cdadecb9e41b40c6a1548c1e23cc943ff8356cd9b9b3a1711662faa488fb |
| host-tool.rsp | d369db7f49fc1dace6549e1e1644badb2cc04cc2f28635925dd4dfe94ce3d773 |
| foundation.rsp | 46653441bd7316045c69a0b90f882a7e3e000b0cf0e772c84dd8e0b6646c6cb9 |
| pure-test-report.json | 49bd2db54811748dee3234e31424383e4a2a9648680610020bba60e8a3b0f5b9 |
| entry-refusal.json | a4af1db9f27990e33996082828c7b1451f9d5ead113c1b58f20bc20bc04ee5b2 |
| executed DLL | bbd13d4c4074d140bb3bfa962d332d5ee720fdeb40d4f5d1d66db0b70e99115d |
| actual apphost | b2d92222ef647fb42e4f4757407b163cacc32b665bdfda60b6a661f7d1c98f72 |

Next targeted corrective source/output review before extending into native
publication. Full SID/directory/strict-plan/host/kit/actual role/controller/native
implementation remains open. No machine/Core/backend/customer mutation, no
Security/production/physical acceptance. REM/LIC008/Open003/NE gates unchanged.
Original reports preserved; correction/source/status docs uncommitted.

## CHG0115 / LIC-EV-0184: correction review completed

2026-10-10: [targeted non-author review](../reviews/LICENSING_PILOT_FOUNDATION_REVIEW.md)
resolves PF-R01 in the pure model only, with no new scoped finding. Exact seven
changed/current inputs, frozen output, seven evidence bindings,194-file package,
DLL/apphost and recorded181 unique PASS rows/refusal match. No reviewer rerun,
build or native/machine operation. Original0.1.0 finding and0.1.1 author evidence
remain historical checkpoints, not rewritten approvals.

Next strict SID/directory/creation and stage-plan/schema/admission inert models
with negative fixtures, before any physical-role extension. No full-kit/native/
Security/production/FEP/REM acceptance; LIC008/Open003/NE gates unchanged.
Bounded AI review is not human security assurance. Review/status docs uncommitted.

## CHG0116 / LIC-EV-0185: strict identity, creation and stage-plan model slice

2026-10-11: user requests current changes committed then next inert work.
Commit850d3ad342920bf101bccd78ad1c221295417a09 preserves0.1.1 correction and
EV0182/0184 reviews; worktree clean immediately afterward. Existing foundation
had only service SID prefix checks, representative files and action sequencing;
no duplicate complete directory/plan implementation was found in that source.
No prior reviewed specification bytes edited; no Core/backend/client changes.

Foundation0.1.2 adds the following pure models, not Windows measurements:

- Canonical S-1-5-80 followed by exactly five uint32 decimal components. Reject
  overflow, signs, whitespace, Unicode digits, leading zeros, wrong case/count,
  wrong authority and identical Guardian/App identities. Token owner checks now
  compose this service-identity validation, not merely matching arbitrary strings.
- All ten proposed directories (including root), with original exact numeric
  masks and directory ACE flags3, creator and owner classes from amendment0.2.
  Creation fixtures reject wrong role/token/owner/ACE/protection, existing or
  reparse objects and non-catalog paths. Representative18 file rules gain the
  same create-new/creator/token/plain-path composition; file flags remain0.
- Closed JSON plan fixture capped at2MiB/depth8, exact schemaVersion1/scope,
  three fixed stage names and ordered5/3/2 action lists. Exact ExperimentId,
  distinct stage RunIds and separately injected host/source/package/kit/spec/
  profile/prior checkpoint/evidence digest bindings required. Prepare has empty
  prior bindings; later stages require both digests. Duplicate/unknown/missing
  fields, foreign IDs/action order/pins, malformed JSON and injected authorization/
  collision/ancestor/prerequisite failures refuse. Expected pins are validated
  independently of observed JSON, but supplied by fixtures, not actual approval.

392 added cases:32 identity,108 representative file-creation,120 directory,
132 plan assertions. Total573 unique PASS rows, including prior181 regressions.
Actual pure apphost still refuses --role Setup with exit2/empty stdout/fixed
PHYSICAL_ACTION_NOT_IMPLEMENTED. No physical controller/service/key/ACL/token/
protected data/customer DB operation. Runtime authority NONE, durable=false,
physical/security/production flags false. Source baseline850d3ad plus pinned
dirty0.1.2 inputs, runtime10.0.11/X64, UTC2026-10-11T06:43:10.6349186Z.

Fresh output `out/lic008-pilot-foundation-cf573f99b897450ba98350c9c877943b/`.
Frozen seven inputs/toolchain/194-file package and post-test custody checks PASS.
Unchanged fixed-name apphost does not imply unchanged managed implementation.

| Artifact | SHA256 |
| --- | --- |
| build-provenance.json | a738c9eb765f484d5fde3b563b59e5cec82e1d8801d305a73c9da25bce8bcd17 |
| source-manifest.json | 0f8c6031dd0ca56bca5a4babcfe0fa3f349af59e71219a936a529f545bc80ff5 |
| toolchain-manifest.json | 7257bfb872377f8b9e43fc53b3cb446c8e8e21bf3e4fd622b57ea26c19227f6b |
| package-manifest.json | 3ff1a593dd122bcf5fb491f75659e7e14ef6c6bcb1f77dafe6dd84be9676b4e3 |
| host-tool.rsp | 46ebd515567fe14fa6420c668717c5f1f754b9486e6dbeee38a8d786d040ecd9 |
| foundation.rsp | 419c0aa2e8366bdbaeef3ceaf49da6ce10183c00fa86df95c9f9cdc52b4a7547 |
| pure-test-report.json | 3bc35b52ac18926d30bf98b61a82765e3e71e2e13fb4552f431f11d569dac718 |
| entry-refusal.json | a4af1db9f27990e33996082828c7b1451f9d5ead113c1b58f20bc20bc04ee5b2 |
| executed DLL | e27096da996577cc414199a816d9e99b4edab0227cb415a024643cb5313b825d |
| actual apphost | b2d92222ef647fb42e4f4757407b163cacc32b665bdfda60b6a661f7d1c98f72 |

First development build21ad5d968d70461faed7453140955387 failed compilation on
a record initializer typo; retained, not PASS. Corrected source built in a fresh
output above. Historical review-package checker still PASS14 claims/unchanged
reports and10 corrupt-index refusals; that is not approval of this new model.

Next bounded non-author source/output review of0.1.2. Current plan fixture is
not the complete executable plan: cross-stage RunId history, all controller/
package/plan file rules, actual report schemas/context/size admission, artifact/
kit/archive negative guards and bootstrap/action-state admission remain open.
No actual SID derivation/token read-back/native normalization/same-handle secure
creation, copying, role emitters/controller or KSP workers implemented. Existing
role/creator observations and authorization/absence/plain/prior flags are injected,
not observations of real Windows paths or services. No hostile-producer report
attestation or universal Windows acceptance. Full kit/FEP/REM/LIC008/Open003/NE/
native/Security/production gates unchanged. New0.1.2 source/status docs uncommitted.

## CHG0117 / LIC-EV-0186: foundation0.1.2 review completed

2026-10-11: [distinct limited non-author review](../reviews/LICENSING_PILOT_FOUNDATION_REVIEW.md)
supports0.1.2 pure-model implementation and recorded custody; no actionable
finding in the slice. Seven current/frozen inputs/evidence bindings,194 package
files, DLL/apphost,573 unique recorded PASS rows and refusal match. No reviewer
test execution or Windows operation; earlier0.1.1 approval was not transferred.
Next inert cross-stage RunId/history/bootstrap/action-state composition, report/
context schemas and package/kit/artifact negative guards. Full executable/native/
physical/FEP/REM/Security/production/NE gates unchanged; LIC008/Open003 open.
Bounded AI review is not human security assurance. Changes uncommitted.

## CHG0118 / LIC-EV-0187: cross-stage/report/package inert guard slice

2026-10-11: user authorizes next inert implementation after EV0186 review.
Checked current source: cross-stage reservations, candidate report validation
and negative package inventory models were not previously implemented. Existing
dirty0.1.2 inputs/review retained; no new commit requested. Source baseline remains
850d3ad342920bf101bccd78ad1c221295417a09 plus frozen disclosed dirty inputs.
No historical specification/contract/protocol/production backend/Core change.

Foundation0.1.3 adds:

- Volatile PilotSession composes independently supplied Plan admission with
  fixed three-stage/action progression and closed candidate report validation.
  RunIds reserved on stage admission cannot repeat across stages; experiment,
  host/source/package/kit/spec/profile and EXE/DLL/provenance/dependency identity
  remain fixed. Previous checkpoint/evidence must match the model's prior close.
  Plan digest may change per stage. Caller RunId/result arrays are copied.
- No overlapping action, observation before launch, early stage close or later
  stage before prior closure. Unknown worker, invalid report or unknown stopped
  state blocks that instance permanently, including late success. Bootstrap/
  authorization/absence/plain/stopped states are injected fixture observations,
  not actual controller/SCM measurements or durable recovery state.
- Closed candidate scope TEST_ONLY_PILOT_REPORT_MODEL: bounded2MiB/depth8 JSON,
  exact independently expected stage/action/role/owner/RunId/ExperimentId and
  host/source/package/kit/spec/profile/EXE/DLL/plan/provenance/dependency pins.
  Only ordered independently allowlisted result IDs with PASS permit progression;
  worker-ended true, authority NONE and durable/security/production false.
  Missing/extra/duplicate/context/authority/result substitutions refuse. Raw
  exceptions/private diagnostic strings are not permitted fields. This is NOT
  the physical report schema or a classifier converting BAD_KEYSET to PASS.
- Flat independently expected package inventory model: exact count/name/size/
  digest/plain records, case-insensitive collision refusal and bounded safe
  basenames; missing/extra/changed/nonplain/path escape/ADS/reserved Windows names
  refuse. This validator operates on injected records, not filesystem reads;
  it is not yet composed with a full kit/provenance/archive graph or admission.

97 added tests:18 package,63 candidate-report,16 session.670 unique pure cases
PASS including all prior573. Actual pure apphost --role Setup still refuses
exit2/empty stdout/PHYSICAL_ACTION_NOT_IMPLEMENTED. First fresh build succeeds.
Frozen seven source inputs/toolchain/194 package files and post-execution hashes
match. Runtime10.0.11/X64; UTC2026-10-11T06:53:16.9841737Z. No physical/service/
key/token/ACL/protected-data/DB operation. Authority NONE and all physical/
security/production flags false. Fixed-name apphost unchanged; managed DLL changed.

Fresh output `out/lic008-pilot-foundation-ef0b540c2cce4fd3a207a32b8c3a9711/`.

| Artifact | SHA256 |
| --- | --- |
| build-provenance.json | 30db3299c547d24da2abeaa8054e7f5d9e14250f753044a97839ceae29d53781 |
| source-manifest.json | 87728c5f83d7f51f43f213a6d7b77d1f1b5b5cbf11f69b04f2d5509afb6b80ef |
| toolchain-manifest.json | 7257bfb872377f8b9e43fc53b3cb446c8e8e21bf3e4fd622b57ea26c19227f6b |
| package-manifest.json | 45d3793a5582149c8fa1f91abf70f6d9148fb248381238b8b9c0f753b84da5af |
| host-tool.rsp | 1f9062cca147c978cee0ac71dfad655e000ab59dde2ec45587c3e0d84e0252dc |
| foundation.rsp | 095bb3c617e10a3fb31b963f9c2de9ccb4a57b36a7c38a88a31ed0753f66fd3a |
| pure-test-report.json | 5d96eff4bc7b011061abd181b30ade000722af120bcff070cb118b99d810dcda |
| entry-refusal.json | a4af1db9f27990e33996082828c7b1451f9d5ead113c1b58f20bc20bc04ee5b2 |
| executed DLL | ce82b69553456fe5d23c7042d7155a4a7d9c177dac8500ce7c54e2a8fcb78f1f |
| actual apphost | b2d92222ef647fb42e4f4757407b163cacc32b665bdfda60b6a661f7d1c98f72 |

Next bounded non-author new0.1.3 source/output review;0.1.2 review does not
approve these changed bytes. Full kit/archive/provenance graph composition,
real package-to-artifact measurements, bootstrap object/action inventory,
physical report OS/build/time/monotonic/token/owner/hash capture and native
result schemas remain open. Same-handle secure creation, actual copying,
native worker/role-child/controller implementations and physical runs absent.
Session state/checkpoint digests are injected and in memory, not durable Store
authority. Full kit/FEP/REM/LIC008/Open003/NE/native/Security/production gates
unchanged. New source/status docs and prior0.1.2 review remain uncommitted.

## Bounded completion checklist for the current pilot preparation

### CHG0153 / EV0222 — partial physical evidence and diagnostic preparation

Built-kit audit aftercf65204:37 source/247 kit entries match, archive pinned and
1807 package SelfTest PASS. [Review](../reviews/LICENSING_REPORT_V04_BUILT_KIT_REVIEW.md)
confirms retained V1 service collisions. Next fixed isolated V2 inert namespace;
original keys/services remain untouched, no Prepare retry or capability activation.

Latest successor0.4 [binding result](../../../licensing/adapter-evidence/guardian-readonly/REPORT_V04_BINDING.md):
22 transitive artifact pins,12 successor negatives (plus preserved32/28 checks),
1807 managed cases and full inert package/wrapper PASS. Review-helper only creates
non-authorizing drafts; retained experiment remains untouched and not resumable.

Latest afterbbaab57: schema2 bounded review PASS_LIMITED; [scoped adoption](../plans/LICENSING_REPORT_IDENTITY_V02_ADOPTION.md)
registered separately.1807 cases, draft28 negatives and old32 negatives rerun PASS;
not additional unique tests. Next adopted successor/binding switch for an inert
build only. No native execution or activation authorized.

Successor preparation after4f78b62: [schema2 adoption plan](../plans/LICENSING_REPORT_IDENTITY_V02_ADOPTION_PLAN.md),
closed report contract and packet0.4-draft. Four direct reference hashes,42 field
order/required fields/inert guard and28 negative checks PASS. This is preparation,
not adoption or a runtime pin switch. Frozen v0.3 checker remains PASS.

Latest: [R1 correction re-review](../../../licensing/adapter-evidence/guardian-readonly/RESTRICTION_LENGTH_REVIEW.md)
PASS_LIMITED at1e21662;1807 managed tests rerun and30 source pins match. R1 code
correction addressed; next schema2 adoption/bindings, physical gate remains closed.

R1 correction implemented after c28dc4a: [dedicated reader](../../../licensing/adapter-evidence/guardian-readonly/RESTRICTION_LENGTH_CORRECTION.md),
27 injected-query tests and1807 total managed cases PASS. Re-review pending;
no native Guardian execution or retained state changes.

Review override: [R1 native length mismatch](../../../licensing/adapter-evidence/guardian-readonly/IDENTITY_INTEGRATION_REVIEW.md)
reproduced read-only on the current token after commit18943e4. CHANGES_REQUIRED;
next dedicated parser/query correction, not new physical execution.

Latest integration: schema2/shared identity policy connected across capture,
report, observer and both controllers.1780 managed cases PASS, rerun in inert
self-contained/extracted kit; builder exit0. TestCapable refused pending adoption.
See [integration result](../../../licensing/adapter-evidence/guardian-readonly/IDENTITY_INTEGRATION.md).
Original retained experiment remains unchanged and not resumable with new bytes.

Latest correction follow-up:20024 observed, virtual-account user/owner match but
matching TokenGroups entry absent. [Correction candidate](../../../licensing/adapter-evidence/guardian-readonly/IDENTITY_CORRECTION.md)
passes660 pure cases; original runtime untouched. Next versioned token/report/
observer/controller integration, not another physical diagnostic or Prepare.

Latest 2026-10-15: first diagnostic returned1066/202 and restored original path;
read-only CIM confirmed stopped/original path. This isolates combined service
identity validation only. [Token-detail successor](../../../licensing/adapter-evidence/guardian-readonly/TOKEN_DETAIL.md)
prepared with150 pure tests and read-only preflight PASS, physical execution pending.
No original security predicate, retained ACL or key changes; no Prepare retry.

2026-10-14. Operator-pasted Setup report d5ae2dbc for experiment663fde1c, time
2026-10-13T16:12:07.8218591Z, declares private-directory creation, both owned-key
creation/reopen verification and public-control publication PASS. Source/package/
plan pins match the issued experiment. This is supplied report content, not a
new independent protected-file hash capture. Guardian report aed72215 is absent
according to the elevated operator read. Prior SCM query/event7023 shows1067;
the code maps all caught service failures to1067 without detailed reporting.
No exact exception can be recovered from that status. App was not started.

Operator's root/plan/guardian-work/guardian-reports owner/DACLs match SecureFiles
rules. Administrator guardian-work listing denial is consistent with its SYSTEM+
Guardian-only DACL and says nothing about Guardian's effective access. Do not
expand ACLs, delete keys/state or rerun Prepare. Native state is partially created.

Read-only2026-10-14 capture: same host bbe896ad, new boot
c1e1b3806edf81fb24c02d4226be6b4ccc159651785f20332f40cf94553b3fc9 versus prior
db258d9bc32ce3b87190e432f9fb25be5a5a600f19475c5b645789490b29fde2.
Guardian retains original binary path/virtual account, Manual, Stopped, now1077.
Do not treat this new-boot status as contradicting the recorded earlier failure.

New candidate under licensing/adapter-evidence/guardian-readonly and builder
scripts/build-license-guardian-readonly.ps1: closed read-only reflected helper
calls into exact retained DLL586aaeab and plan3f90f918. Ten stages cover assembly,
identity, plan, host/boot, original inventory/ACLs, owned records, existing keys
and directory ACLs. Native service status is the only result channel: bounded
stage/reason number, no raw exception/data output. Original Main/actions/writes
are never dispatched. Both old and current boots are pinned separately; this is
current-state diagnosis, not proof of the earlier run's cause. No original
executor-path admission, export/seal/report-writing success claim.

Final ignored output out/lic008-guardian-readonly-2cab6f20d2cd45998e494b30615e8e32.
Manifest SHA256 dc73228301dda9b2cdc0e1f18cb2ef7163d0a5908698318d23b5ac30bfd93ef0;
DLL SHA25628cdbd5168e26ba9588f82c63a20cd7ef81d8f4fb0b0ae6ea839d711dfe34811.
22 pure classification cases PASS;3 invalid CLI shapes refuse before service
dispatch; all manifest and original pilot source pins verified unchanged.
Initial same-boot-only candidate b4130969 superseded after detecting new boot.
No probe launched under Guardian, no service configuration or protected state
changed. Owner subsequently approved this exact diagnostic scope. One-shot
deployment runner implemented; read-only SelfTest passes candidate/runtime hashes,
boot/configuration and three negative predicates. It atomically creates a NEW
protected directory, refuses reuse/automatic recovery, verifies retained package,
changes only the Guardian binary path and restores it after observed stop.
No deployment/start/restoration physically tested: agent is not elevated.
Next owner Execute once and numeric result/restoration review; never repeat on
error, force-stop or continue Prepare. Never launch from development-writable out. Candidate README records
scope/limitations. Full physical cases0/5 accepted; Prepare partial, not NOT_RUN.

Latest override EV0222 (2026-10-14): physical Prepare is PARTIAL/FAILED, not
NOT_RUN. Operator Setup report supplies candidate creation evidence; no full
FEP case closure is accepted (0/5 accepted). Guardian diagnosis is next, not
fresh Prepare, Fresh or Finish. Preserve all state and original artifact pins.

Current override (2026-10-13, EV0220): the executable test-capable candidate is
now built and author-reviewed, with1053 managed cases and package/activation
negative checks PASS. The table below is the preserved2026-10-11 checkpoint.
Current remaining work is final exact stage inputs/owner Prepare permission,
three individually authorized physical stages and evidence/decision closure;
physical0/5 remains NOT_RUN. Do not repeat completed source/build slices.

2026-10-11: user asks where the checklist stands and when limited tests/reviews
end. This is a deliverable grouping, NOT a new approval, a fixed number of turns
or a product completion percentage. Master Phase6.2 rows001-005 are complete,
006-008 in progress,009-013 not started. This work is under008 and REM-01,
not evidence that008 or the whole Licensing phase is complete.

| Deliverable | Current status / exit criterion |
| --- | --- |
| Pure foundation and negative fixture slice | EV0188 exact0.1.3 source/output review complete, no actionable finding;670 recorded PASS cases supported. This bounded model checkpoint can end; do not add unrelated generic fixture rounds merely to increase counts. |
| Complete TEST_ONLY executable pilot packet | NOT_COMPLETE: EV0195 all10 bodies plus controller evidence core/volatile checkpoint chain/gated wrapper coded,219 managed cases/six entry refusals and bound wrapper SelfTest PASS. Native bootstrap/collector/persistence/dispatch/full self-contained custody remain. Consolidated built-kit review before physical execution. |
| New current-host physical pilot evidence | NOT_RUN: separately authorized Prepare, VerifyFreshProcess, Finish in order; each returned stage evidence reviewed before the next. Includes FEP-P01..05 creation/policy/use/export/isolation/fresh-process/owned-cleanup obligations; these are five mapped cases, not five extra standalone installations. |
| Evidence/decision checkpoint | OPEN: evaluate required fresh case sufficiency and REM-01..04 disposition, exact scoped review plus owner decision; synchronize NE-002 and residual ledger without inventing production/native authority. |

Limited preparation reviews end at the reviewed frozen executable packet with
all blocking findings resolved, not at an arbitrary test count. Physical evidence
review still follows; native/product work will have its own verification later.
Earlier reviewed unchanged models/specifications should be reused, not endlessly
re-reviewed. Changed code, a real finding or differing host/package requires
appropriate targeted review. No guaranteed date or number of iterations before
executable integration and host results exist. Scope changes require explicit
disposition, not silently extending this packet to every later TPM/Windows/Store
release case or waiving those cases. Four REM work packages stay open; they are
not four commands. Detailed original obligations remain authoritative in the
[fresh plan](../plans/LICENSING_ADAPTER_FRESH_EVIDENCE_PLAN.md) and
[evidence sufficiency assessment](../reviews/LICENSING_ADAPTER_EVIDENCE_SUFFICIENCY_ASSESSMENT.md).

## CHG0119 / LIC-EV-0188: review completed and finite next deliverable

2026-10-11: [distinct non-author0.1.3 review](../reviews/LICENSING_PILOT_FOUNDATION_REVIEW.md)
supports current pure models/recorded custody; no actionable scoped finding.
Seven current/frozen inputs/evidence bindings,194 package files, DLL/apphost,
670 unique recorded PASS rows and physical-entry refusal match. No reviewer
rerun or machine/native operation. This pure-model review checkpoint can end;
changed bytes or a defined executable deliverable, not unchanged models, trigger
subsequent review. Original acceptance gates are not waived.

Next consolidate an implementation-readiness packet using existing reviewed
specifications/models: exact TEST_ONLY responsibilities/permitted operations,
complete bootstrap/object/action inventory, physical report schemas, failure/
stopping/retention interfaces and closed source/package/kit/archive provenance/
artifact admission. Explicitly separate actual implementation authorization,
review of the built exact kit, and Prepare/Fresh/Finish authorizations. No new
native implementation or physical permission is implied by this review.

This fits the completion table above; the packet is a component of complete
executable preparation, not a newly added release gate. Master Phase6.2:
5 complete,3 in progress,5 not started; current work under LIC-6.2-008/REM-01.
Four REM packages remain open. No percentage/date/fixed number of commands
claimed; full kit/physical evidence and later scoped decision remain incomplete.
New code/review/status docs uncommitted; baseline850d3ad plus bound dirty inputs.

## CHG0120 / LIC-EV-0189: consolidated implementation-readiness packet

2026-10-11: user requests next step then commit. The recorded immediate next
deliverable after EV0188 is the consolidated implementation-readiness packet,
not another model iteration or authorization to operate on Windows. Earlier
conversation described executable-kit completion too broadly: THIS checkpoint
prepares the exact implementation contract; it does not build actual roles or
the five-test executable kit. Physical role/controller/native code remains absent.

Machine-readable packet:
`licensing/adapter-evidence/pilot-implementation/implementation-packet.json`,
ID ADAPTER-PILOT-IMPLEMENTATION-01 revision0.1, status
PREPARED_FOR_SCOPED_REVIEW_NOT_BUILT. SHA256
8d182ccd61ed911b1d9019a3426c6d3725cbf268e3b57cdc064544cb21aa822e.
It binds exact unchanged specification0.1/ownership0.2, reviewed foundation0.1.3
Policy and existing candidate codec bytes. Thirteen proposed source paths name
the future runtime/kit/builder/codec allowlist, not thirteen implemented files.
No placeholder source/binary/kit digest or old V1-V7 controller can authorize a run.

Consolidates fixed namespace/root/key labels, actual future role/default owner
expectations, ordered bootstrap, ten directory and nine file classes with exact
principals/mask classes/flags, ordered5+3+2 action/operation responsibilities,
bounded physical report/context/token/artifact/native-result field declarations,
worker budgets/stopping/retention, source/package/kit/provenance/archive design,
separate implementation/built-kit/stage authorization and exclusions. Existing
reviewed policies are referenced without editing their pinned bytes. Symbolic
G/P remain expected future independently measured service SIDs; report schema
fields remain proposed, not real measurements or cryptographic attestation.

Read-only checker `scripts/check-license-pilot-implementation-packet.mjs` validates
closed packet structure, source reference digests, stage/action/owner/directory
constraints and boundary flags. Rejects duplicate JSON properties before parse,
unsafe referenced paths and nonplain input ancestors.20 negative consistency
checks PASS, including broadened private directory grants, creation/deletion in
the wrong stage, wrong path/source alias, premature authorization/implementation
claims, report budget/secret fields and missing gates. This is preparation-contract
lint, not executable behavior or acceptance of every native/report schema rule.
It imports no role/native/service logic, writes no output or machine state.

Reviewed pure runner670 cases remain unchanged; not rerun or recounted as new
physical evidence. No service/key/ACL/token/DB/Core/backend/client/Windows change.
Next scoped packet review before the exact implementation decision and runtime/
controller/native coding, followed by one consolidated built-kit review and the
three separately authorized physical stages. This is the packet component of
the existing executable-preparation deliverable, not an added release gate.
No full-kit/physical/FEP/REM/NE/native/Security/production acceptance. Four REM/
LIC008/Open003 remain open. User requested current source/reviews/status/packet
changes committed together after verification; generated out outputs excluded.

## CHG0121 / LIC-EV-0190: scoped packet review completed

2026-10-11: user authorizes the next two steps, packet review followed by actual
TEST_ONLY implementation. Distinct non-author `adapter_routing_review` examined
committed43bada5, packet and four pinned references, read-only checker output.
Conclusion: PACKET_SUFFICIENT_FOR_USER_AUTHORIZED_TEST_ONLY_IMPLEMENTATION.
No blocking contradiction; no redundant new owner implementation approval needed.
LOW IP-C01: file-class checker shape/ACE syntax did not independently constrain
exact file names, owners and ACE grants. Coordinator corrected that checker
using independent expected arrays and three targeted mutation negatives.
23 negative checks PASS; checker SHA256
416d319e557f55c46c3e3a5b4b8c2ff546d286b4c627a81eda9eb121050af1bd.
Historical packet raw SHA256 remains
8d182ccd61ed911b1d9019a3426c6d3725cbf268e3b57cdc064544cb21aa822e;
all four source-reference pins unchanged. This review does not independently
review the subsequent correction/native implementation, authorize physical
execution, or supply human security assurance.

## CHG0122 / LIC-EV-0191: actual native candidate primitives started

Seven new C# sources in `licensing/adapter-evidence/pilot-runtime/`:
Program, PlanAdmission, NativeTokens, SecureFiles, NativeWorker, ServiceHost,
KeyOperations. Real token/default-owner/group query and secure create-new/read
same-handle owner/DACL/plain-path interfaces, single bounded worker admission,
Software KSP RSA3072/decryption-only/export0 policy and exact DACL/public identity,
OAEP-SHA256/AES-GCM fixture operations, private-export probe and service-host
interfaces. These native interfaces are NOT connected to Main and NOT physically
tested. No privilege/owner rewrite, overwrite/recreate or forced worker kill.
OAEP output handling accepts actual32-byte decrypt result after bounded query
allocation and clears surplus buffers. Reserved Windows device file names are
refused. Preserve ownership evidence/unknown errors; do not adopt old experiments.

Builder `scripts/build-license-adapter-pilot.ps1` freezes explicit source inputs,
compiler/reference bytes, source/artifact/dotnet-executor digests; cached
SDK10.0.400/runtime10.0.11, CSC warnings-as-errors, no network/MSBuild/restore.
First compile caught nullable provider access; corrected and rebuilt in a new
output directory. Failed output retained, not presented as evidence.
Successful candidate is framework-dependent, not final self-contained apphost/
actual-child/package/kit/archive provenance. README states this boundary.

43 managed-only cases PASS: safe names/closed duplicate-free JSON, fixed routing,
directory/private ACL rule data, unlisted/path refusal, codec snapshot/context/
length negatives and managed worker admission. These do not exercise native
tokens/ACLs/CNG/SCM or establish cryptographic security. Three actual processes
invoked service/child/controller-shaped commands; all exit2, empty stdout,
PHYSICAL_CONTROLLER_NOT_READY before any native/protected access.

Output: `out/lic008-pilot-runtime-candidate-5fda913298eb46f190483bd51ec530df/`.

| Evidence | SHA256 |
| --- | --- |
| build-provenance.json | 452cb507d854eb060efe99156adf88a9cbd9f38f4a8534f7426ddd29d6daa4ad |
| EntryControl.AdapterPilot.dll | 56867735bb8ff6101591640856c402fc7c2a1b71d25c160e6916833a35c37d4c |
| pure-test-report.json | 1211666bc9ff27a87a00f15be095bad4556fde2c2a4dd5cc67e12e99cb20d468 |

Remaining implementation: RoleActions/ReportEmitter, controller for the ordered
5+3+2 actions, pre-write bootstrap/root/service/key collisions (generic
BAD_KEYSET must remain unknown), real same-primary-token child and bounded
report/context/boot/checkpoint measurements, per-key cleanup disposition and
full self-contained kit/provenance/archive bindings. Then one consolidated
built-kit review and separately authorized physical Prepare, VerifyFreshProcess,
Finish. The user's requested second step is STARTED/PARTIAL, not falsely closed
as a complete kit. New physical cases0/5, no native/service/key/ACL/token/Core/
backend/customer changes. Historical670 pure-model evidence not rerun or added
to43 as physical evidence. Four REM/LIC008/Open003/NE/FEP/Security/production
gates remain open. These new changes are uncommitted.

## CHG0123 / LIC-EV-0192: first Prepare actions and role reports implemented

2026-10-11: user asks to commit existing changes before the next step. Commit
691a787 (`test: review pilot packet and add gated native primitives`) captures
all prior source/checker/docs, generated out excluded. New candidate additions:

- RoleActions setup-create: create-new three Setup-owned private/public/staging
  directories, two durable intents before key creation, verified owned records
  after finalization and exact public control. Partial failure retained, no retry.
- Guardian prepare: verify private/public identity/policy, probe private export,
  seal/open random OAEP-SHA256/AES-GCM test fixtures, write Guardian-owned staging.
- Setup publish: verify private/public chains and Guardian-owner staging/context,
  decrypt/check fixture, copy to new System-owned shared files and verify byte
  readback; no move/overwrite/adoption. No destructive cleanup implementation yet.
- ReportEmitter: packet's39-field closed report and six-field fixed results,
  fixed IDs/reason codes, raw cryptographic status only, no exception text/key
  name/private path/plaintext. Role entry captures actual token/owner/group,
  process/executor/assembly/runtime and boot-time hash; compares approved plan
  context. Successful work repeats package/token/boot validation; UNKNOWN stops
  normal work and does not claim post-operation artifact/context verification.
  Report write uses exact own-role create-new descriptor/same-handle checks.

These are actual native implementation interfaces, not native observations:
Main still permits ONLY `--self-test`, every physical-shaped entry refused before
token/CNG/ACL/SCM/protected-root access. Bootstrap/parent ownership/controller and
native report writer behavior remain unverified. A failed report retains state,
never produces stage success. Worker timeout waits actual completion before
evidence handling; hanging native workers are not forcibly terminated. No new
Security review of this source is claimed; one consolidated built-kit review
remains necessary. Historical packet/specification/codec bytes unchanged.

Builder freezes explicit nine C# sources plus unchanged codec/builder/packet;
framework-dependent candidate, no self-contained kit yet. Final build43 previous
plus24 new report/action pure cases =67: closed report serialization, authority/
hash/status/result/duplicate/secret-reason refusal, UNKNOWN report distinction,
fixed action routing and unsupported cleanup refusal before admission. Three
actual physical-entry refusals PASS; unchanged670 foundation cases not rerun.

Output: `out/lic008-pilot-runtime-candidate-982b274bb40a4e9999bede793d913f49/`.

| Evidence | SHA256 |
| --- | --- |
| build-provenance.json | a56e22965471d1a8889c59705c24533c10b436c6f3c5a0fcd60272e7b70a0018 |
| EntryControl.AdapterPilot.dll | b57b35c0d38387e2a7146aeb0a16b006984ea869337997ef0f6183eaba9cd369 |
| pure-test-report.json | 5aa1d6eae803569922d339965dd3c424e4f92c2141fe69a7824d8b04ce373e99 |

All six retained evidence bindings independently match. Earlier interim43-case
output retained, not the final source's report. Next remaining App/actual-child,
fresh/cleanup actions and controller/bootstrap/measured context/checkpoints/full
self-contained custody integration. Only3/10 action bodies coded; NOT3/5 physical
cases passed. Physical evidence0/5, no current-host mutation, no product/backend
change or LIC008/four REM/NE/FEP/native/Security/production closure. New slice
source/docs are included in the subsequent user-requested commit. No additional
native implementation or physical execution is authorized by this commit-only
and next-step explanation request.

## CHG0124 / LIC-EV-0193: App/Child Prepare candidate implementation

2026-10-11: prior source/docs committed e3c6427, then user explicitly authorizes
the App/child next step. New candidate source in existing RoleActions,
ReportEmitter and pure-test aggregation; no new source allowlist or policy change.

App/Child never call private ownership or Guardian staging readers. Restricted
Software machine-key raw open:0x80090016 OBSERVED/RAW_BAD_KEYSET, zero
FAIL/RESTRICTED_OPEN_SUCCEEDED, everything else UNKNOWN/OPERATION_UNKNOWN.
No global denial/absence classifier. Only the OBSERVED path continues to the
positive control; FAIL/UNKNOWN stops normal actions and retains evidence.
App-readable control checks closed public identity/schema/context, native key
policy/public identity, published fixture/hash and OAEP/AES-GCM decryption.

Parent child-start interface uses the exact admitted executable and fixed
ArgumentList (--child,Child,child-prepare,approved-plan hash), no shell/runas/
credentials/impersonation/token replacement. Child-only environment copy strips
DOTNET_/COMPLUS_/CORECLR_/COR_ startup/profiler overrides, not system variables.
Parent waits real exit inside the bounded-result worker; no Kill, retry or early
release. A late child completion cannot produce parent PASS. Main remains
disconnected, so this has NOT started an actual child. Future reviewed dispatch
must route Child to the independently admitted RoleActions entry and must not
let an arbitrary interactive invocation bypass identity admission.

Report routing now writes App and Child reports to approved app-reports paths,
exact App-owner descriptors. Parent uses actual spawned PID/exit0 and reads the
exact approved child run file, validates closed39-field/result schema, separate
PID, matching user/default owner/primary type/elevation/service SID attributes,
plan/run/experiment/boot and every package/provenance/context pin, independent
executor/DLL hashes, runtime/architecture, worker-ended and ordered two results.
BAD_KEYSET is explicitly OBSERVED, never a substituted PASS. Reports are test
evidence, not cryptographic attestation from a trusted independent process.
Parent/child integration and secure report behavior still need physical review.

Final candidate build warnings-as-errors:112 pure cases (previous67 plus45
new; this count is not physical evidence). Added raw-status routing, direct
child-start settings/argument/environment checks, inert child report acceptance
and corrupted PID/identity/elevation/plan/boot/artifact/pins/results/status
refusals. Fake process/report fixtures never invoke tokens/CNG/SCM or Process.Start.
Three actual processes still refuse service/child/controller-shaped commands
before native/protected access. No real child or native role run this turn.

Output: `out/lic008-pilot-runtime-candidate-75151dbafa514ccab7d2cd23f2c8fec7/`.

| Evidence | SHA256 |
| --- | --- |
| build-provenance.json | 876560dc84f8c11c09ad0519879041b3b85518cb9849cd4e5ba476963744f566 |
| EntryControl.AdapterPilot.dll | 75f2f0cf76c985bced4f2bc39cd50b72cc86bcff51444556be92eb48b1ce2269 |
| pure-test-report.json | dad093dad6caaaa016d070e3811fe111715ebedccbb94992c5fcd9f8165010a8 |

All six final evidence bindings match. Earlier110-case interim output retained,
not the final source's report. Historical packet/four pins and670 reviewed model
evidence unchanged, not rerun. Five Prepare action bodies coded of ten total;
not five physical cases passed. Physical0/5, no product/backend/service/key/ACL/
token change. Next fresh/cleanup actions and remaining dispatch/controller/
bootstrap/checkpoints/full self-contained custody; consolidated built-kit review
before separate stage permissions. No LIC008/four REM/NE/FEP/native/Security/
production acceptance. Current new code/docs uncommitted.

## CHG0125 / LIC-EV-0194: fresh/owned-cleanup action bodies coded

2026-10-11: user authorizes next candidate implementation. Five remaining action
bodies complete the proposed10-action source set, not the complete kit:

- Guardian fresh: existing owned/public identity, key policy and published
  fixture/hash context, reopen/decrypt, in-memory mutation matrix and export
  probes. No new keys, fixture files or ownership records.
- Fresh App/Child: stage-specific child action/report run IDs and identical
  independent primary-token/package/plan/context/result checks; no generation
  of test data or adoption. Actual new-process/Stopped/PID0 continuity still
  needs the controller and physical evidence.
- Setup Finish: verify BOTH private chains/public identities/key policies and
  retained decryptable fixtures before any deletion. Recheck exact owned key
  identity immediately before each CngKey.Delete. Only these two handles/names;
  never delete files, services, old experiments or unrelated keys.
- Per-key progress: create exactly the approved new Setup Finish report using
  its exact descriptor/default owner and handle checks. Persist UNKNOWN/
  DELETE_STARTED before each deletion; flush its PASS/UNKNOWN disposition before
  proceeding. All updates use this same exclusively held newly created report
  handle; never reopen/replace an existing report or journal. This is staged
  progress within a new report, not a relaxation permitting overwrite/adoption.
  Failure of intent persistence prevents that deletion; failed deletion or
  disposition persistence prevents the next. Final identity/context verification
  failure retains already flushed progress and cannot publish final success.
- Guardian absence: retained ownership/public chain and exact raw key opens.
  BAD_KEYSET OBSERVED only, zero FAIL/KEY_STILL_PRESENT, other status UNKNOWN.
  Guardian cannot read Setup-private reports; future controller must correlate
  exact verified Setup deletion report/checkpoint with these observations before
  acceptance. No broadened ACL, recreation or generic absence classifier.

Report schema admits the three exact stage mappings and narrowly scoped new
result statuses/reasons. Intermediate Finish progress is explicitly without
post-operation artifact verification; final completion requires ordered three
PASS results and successful postchecks. No final stage/case acceptance from
these report claims alone. Buffered/report writes are NOT an atomic crash-safe
store: power-loss/interrupted-write durability and native hangs remain untested;
corrupt/partial/unknown state must be retained, not blindly retried.

162 pure tests (previous112 plus50): full action/stage maps; fresh child context
and cross-stage refusal; controlled raw absence status data; real deletion-order
helper with inert callbacks verifies intent-before-delete/per-key progression,
first-deletion failure stopping, failed intent write causing zero deletes and
failed disposition write preventing second deletion. Finish progress/final
report/status/stage/count guards also tested. Callback fixtures never call
CngKey.Delete, file/ACL/token/CNG/SCM APIs or Process.Start. Native paths compile
warnings-as-errors only. Three actual physical-shaped entry refusals PASS;
Main unchanged self-test-only, no role run, restart or deletion performed.

Final output: `out/lic008-pilot-runtime-candidate-a052a54aa5074723affec179f0e82892/`.

| Evidence | SHA256 |
| --- | --- |
| build-provenance.json | 6d427d60006f68e36e06812026f97d6f4c477be92a05954e1234a275926e2f8a |
| EntryControl.AdapterPilot.dll | c07d23d4617da2bf128fa82f5b896eff4b0438ae94382705a800701fea521801 |
| pure-test-report.json | 912667bc2309f964e26567d6212a44c343fe997ad0889c2f4ad9d8f1cd542a29 |

All six final evidence bindings match; interim112-case build retained, not final
source evidence. Historical packet/four pins unchanged. Next complete controller
bootstrap/root/service/key collision/approval admission, exact source/package/
kit/archive custody, stage checkpoints/reports/manual-stopped PID0 validation,
reviewed dispatch to real services/child; one consolidated built-kit review
before separately authorized stages. No separate new approval needed for coding
this already-authorized TEST_ONLY scope. Physical cases0/5, no DB/backend/Core/
customer or Windows state changes. LIC008/four REM/NE/FEP/native/Security/
production remain open. Current fresh/cleanup and preceding App/Child source/docs
uncommitted; no commit requested in these implementation turns.

## CHG0126 / LIC-EV-0195: controller evidence core / entry integration

2026-10-11: user asks commit first, then controller/integration next step. Prior
App/Child/fresh/cleanup sources and docs committed2e52784. New source in existing
PlanAdmission.cs, plus proposed pilot-kit/Run-Pilot.ps1 and README-fa.txt; builder
now freezes those two kit-entry inputs and validates their guarded behavior.

StageController closes admission over canonical approved-plan digest, exact
ordered5/3/2 report/run sets and raw report digests, bounded closed schemas,
expected role/user/default owner/primary token/service SID attributes and every
plan/boot/artifact/package/runtime/context pin. Independent process-receipt
inputs must match PID, start/report/end ordering and child lifetime nesting;
ordered service actions do not confuse child's earlier report time with App's
later report. Three exact distinct measured service SIDs and Stopped/Manual/PID0
receipts required. Fresh/Finish must chain previous checkpoint/evidence/run
history, unchanged context/shared hashes and start after previous completion.
Unknown/incomplete reports, leftover-running services, missing/extra/mismatched
evidence and partial deletion reports refuse stage progression. Finish requires
all verified Setup deletion results alongside exact Guardian raw observations;
never infer absence from BAD_KEYSET alone.

Receipts are currently injected inert fixtures, NOT Windows measurements.
Actual controller must independently collect receipts and protected file/context
evidence, not manufacture inputs from the role reports being validated. Returned
checkpoint is volatile candidate data, not persisted/attested Security authority.
The canonical plan format here must be emitted by the future controller so its
digest matches independent role/raw-plan admission. No new profile acceptance
or replacement of the pinned ownership/bootstrap specification is implied.

New PowerShell controller entry gates Prepare/VerifyFreshProcess/Finish before
any file/identity/service/CNG inspection or mutation. SelfTest requires absolute
plain candidate input, externally provided provenance SHA256 and exact six
candidate bindings/SDK executor digest, then invokes managed-only self-tests.
No elevation/shell credentials/service mutation. This is a gated test entry,
NOT a finished physical orchestration script. No self-contained apphost or
complete source/package/kit/archive custody graph produced yet.

219 unique pure cases (previous162 plus57 controller cases), warnings-as-errors
build: complete three-stage fixture chain, report count/context/owner/hash/boot/
time/result corruption, service state/start-mode/SID/PID checks, process receipts
and stale history/freshness refusal. Three actual executable physical-shaped
entry refusals, three actual controller physical-stage refusals, syntax PASS.
Bound wrapper SelfTest repeats the same219 cases successfully; not another219
new unique assertions. None invokes native roles/collector or reads ProgramData.

Final output: `out/lic008-pilot-runtime-candidate-e94c7cbe07304c42bafe94be97f637c2/`.

| Evidence | SHA256 |
| --- | --- |
| build-provenance.json | d18b424a63c45d2b7b39749085f3fe77bf2d6b25eda209c000798c9e641f9982 |
| EntryControl.AdapterPilot.dll | 08ef7f584bdedb0f43e8cf21c110b34728d645ab4ce8df2c9e43a2c59f3430bb |
| pure-test-report.json | c52af488524c1379de0848bb316506c1b7f9c5e2db94bea7183f0c32387bf876 |
| controller-entry-checks.json | 50197cb400725b5ad739691b999dcfbb96e6ff92585a42fd21713b5c83a6c286 |

Six provenance bindings and separate controller-checks-to-provenance digest match.
Prior interim214/219 builds retained, not final source evidence. Original
packet/four referenced pins unchanged; historical670 model cases not rerun.
Next actual native bootstrap with definite collision/unknown handling, trusted
receipt/file collector, protected checkpoint persistence, reviewed dispatch and
self-contained package/kit/archive/provenance integration. Then one consolidated
built-kit review before separately authorized stages. The requested complete
controller/kit is PARTIAL, not closed by this managed core. Current physical0/5;
no service/key/ACL/token/backend/customer change or LIC008/four REM/NE/FEP/native/
Security/production acceptance. Included in the owner-requested commit.

## CHG0127 / LIC-EV-0196: native readback / protected checkpoint interfaces

2026-10-11: user authorized the next implementation step after638f4ba. Added
ControllerWindows.cs and froze it in the explicit candidate build inventory.
Native methods are disconnected from Main/kit entry, not physical evidence.

- Exact fixed Setup/Guardian/App SCM queries request only query rights; missing
  registration requires ERROR_SERVICE_DOES_NOT_EXIST1060. Denied access, pending
  deletion and other failures refuse as unknown. No service create/start/delete.
- Bounded QueryServiceConfig/status reads require own-process16, Manual3,
  exact pinned-root executable/role argument/account, empty dependencies,
  Stopped/PID0 before and after and independent valid service SID lookup.
  This metadata admission is candidate code, not finalized role dispatch.
- Actual protected report bytes/owner/DACL/path checks use SecureFiles; fixed
  ordered five shared files bind name/size/hash. Previous checkpoint raw digest
  and canonical encoding must match independently supplied plan/history pins.
- PersistValidated requires successful StageController validation and fresh
  native report/service/shared/previous-file re-reads. Creates only one new
  exact Admin-owned protected checkpoint, flushes and verifies readback. Existing
  or partial output is never replaced/adopted/resumed. Flush/readback does not
  promise atomic crash/power-loss recovery; ambiguous state must remain blocked.

ProcessReceipt inputs are STILL NOT measured by this code. Stopped SCM snapshots
do not establish earlier PID/token/lifetime or child ancestry. Retained process
handles, independent child discovery/token measurements and trusted context
assembly remain required before physical admission. No CNG absence claim added;
root/key collision bootstrap and service creation/dispatch are not completed.

265 unique managed cases (219 prior +46 routing/config/unknown/shared-inventory
rules), warnings-as-errors compile PASS. Three executable and three controller
physical-stage refusals, frozen wrapper syntax and provenance-pinned SelfTest
PASS (same265 cases rerun, not530). Tests invoke no native collectors, token/SCM/
key/file ACL/checkpoint methods. Original packet/reference pins unchanged.

Final output: `out/lic008-pilot-runtime-candidate-9b95c37a987842ae8620a259185421d3/`.

| Evidence | SHA256 |
| --- | --- |
| build-provenance.json | 82bea0f24cc82ef19df31fe57a3d484facbfc485237d2041a0f7ef43e218550c |
| EntryControl.AdapterPilot.dll | 5b2337337d4bfd72189774511969f4c4ff192de02f7899f2837918d6e5406f0e |
| pure-test-report.json | 86db0f8545c47ec579560f34c049bcbb9c2eaf4232af2fb4a5db5dc38011f834 |
| controller-entry-checks.json | 897056c3d3cde034aa2c6d63b687f102c6043a6fac05be9dc7caebe8297df809 |

All six evidence bindings and external controller-to-provenance binding verified.
Interim260-case output retained, not final source evidence. Next retained-handle
process/token collector and independent child discovery; then collision-safe
bootstrap, creation/dispatch, full self-contained custody and one consolidated
built-kit review before separately authorized physical stages. Whole native
controller step remains PARTIAL. Physical0/5 and LIC008/four REM/NE/FEP/native/
Security/production gates unchanged; no backend/customer/Windows state change.
Current source/docs included in the owner-requested stage commit.

## CHG0128 / LIC-EV-0197: retained process/token observation candidate

2026-10-11: next implementation authorized after35906d0. New ProcessObserver.cs
included in the explicit frozen source inventory. NativeTokens shares the current
primary-token reader with an external process token query; no token replacement,
impersonation or privilege enabling. ControllerWindows adds exact live service
PID query and persistence now accepts privately constructed ProcessObserver
instances, not fabricated ProcessObservation/ProcessReceipt inputs.

- Service attachment requires exact own-process Running SCM PID before/after
  opening a non-inheritable QUERY_INFORMATION/SYNCHRONIZE handle. Native PID,
  creation time after independently measured launch boundary, pinned image path,
  boot and primary token context checked while the retained process is live.
- Bounded Toolhelp process snapshot discovers exactly one App child independent
  of report claims. Child handle/native parent PID, creation after retained App
  start, matching token user/owner/type/elevation/service attributes required;
  retained parent must remain live through capture. Missing/extra/fast-exited
  children are UNKNOWN/refused, never reconstructed from report PID afterward.
- Complete uses zero-time handle wait and native creation/exit time plus exit0;
  report time must lie in observed lifetime. Live Dispose refuses so orchestration
  must retain observer on timeout. Admission-failure handle disposal only closes
  query handles, never kills process. No launch/start/stop/kill/suspend performed.
- Each stage requires exact observation count/order/action/run/PID/token/image/
  boot/report hashes and child-parent/lifetime consistency before checkpoint
  creation. StageController still validates all report/package/role/stage/chain
  contracts. Managed fixture DTOs cannot be supplied to native persistence.

Limitations: code remains disconnected from Main/kit. No native query or actual
child/process tested. Future orchestration must measure launch boundary and
coordinate live capture; watcher/handshake is not implemented and short-lived
roles can be missed. Cross-account query may be denied; do not enable debug
privileges or relax ACLs to force PASS. NtQueryInformationProcess availability is
not guaranteed across all future versions; unavailable query is fail-closed.
Primary token snapshot is not proof of identity at every instant, native parent
metadata is not anti-spoof attestation, and image path alone is not loaded-DLL
integrity. Full source/package/report custody and physical review remain required.

316 unique managed cases (265 prior +51 observer/observation checks), compile
warnings-as-errors PASS. Live/exit/unknown wait classification, native-time value
bounds, missing/extra/self-child selection, three-stage observation fixture
matching and negative owner/type/attributes/elevation/PID/run/path/boot/lifetime/
parent cases. Three executable and three controller physical-entry refusals,
syntax and external-provenance-pinned wrapper SelfTest PASS (same316 cases, not
632). Tests execute NO process/token/SCM/native observer calls. Original pinned
packet and references unchanged. No backend/database/customer state changed.

Final output: `out/lic008-pilot-runtime-candidate-0db013453a2e43548281f8ecd81bbe55/`.

| Evidence | SHA256 |
| --- | --- |
| build-provenance.json | 0bd786c85c2e947f45616b7cb8ccadfed1525d0006ce79ba5f6cd673c9ab5f98 |
| EntryControl.AdapterPilot.dll | d78c5bfe9a3609dc654be20248d6fedce588222160a238b374efa57b31ba4ec6 |
| pure-test-report.json | 6bc9f55be906ba8ce69d75347320abc22cede3b6be51913d27a777464097d7a2 |
| controller-entry-checks.json | 5d296d6852c941fb188c326c54565b6a93e407d814fb944bbdba5f1932a617cb |

Six artifact bindings and external controller-provenance binding independently
verified. Interim316 build before observer-only persistence change retained,
not final source evidence. Next collision-safe root/key/service bootstrap and
reviewed observation/dispatch coordination, self-contained custody/archive and
consolidated built-kit review before individually authorized physical stages.
Native-controller step PARTIAL; physical0/5; LIC008/four REM/NE/FEP/native/Security/
production gates unchanged. Included in the owner-requested observer commit.

API references used for candidate implementation (not physical approval):
[GetProcessTimes](https://learn.microsoft.com/en-us/windows/win32/api/processthreadsapi/nf-processthreadsapi-getprocesstimes),
[OpenProcessToken](https://learn.microsoft.com/en-us/windows/win32/api/processthreadsapi/nf-processthreadsapi-openprocesstoken),
[NtQueryInformationProcess](https://learn.microsoft.com/en-us/windows/win32/api/winternl/nf-winternl-ntqueryinformationprocess),
[PROCESSENTRY32W](https://learn.microsoft.com/en-us/windows/win32/api/tlhelp32/ns-tlhelp32-processentry32w).

## CHG0129 / LIC-EV-0198: read-only bootstrap preflight and contract blocker

2026-10-11: user requested commit first then next bootstrap/coordination step.
Observer source/docs committedb3a6e20. Added BootstrapAdmission.cs to closed build
inventory, native entry unchanged/self-test-only. No physical authorization used.

Preflight candidate verifies Prepare canonical plan digest/runtime/x64/boot and
controller primary token before fixed-path queries. Root is OPEN_EXISTING with
OPEN_REPARSE_POINT/BACKUP_SEMANTICS; any successful open (file/directory/dangling
entry) is a collision. Only ERROR_FILE_NOT_FOUND2 after plain ancestor checks
is classified absent; missing ancestor, access denial and other errors unknown.
Three exact registration queries require existing SCM1060 absence policy. No
read of private experiments, no namespace enumeration or writes. Only two exact
experiment-bound machine/SILENT Software-KSP key opens are attempted if preceding
checks succeed. Success means PRESENT; ALL failures are UNKNOWN, including
BAD_KEYSET. RequireClear cross-checks label order and raw-state mapping, so
injected ABSENT labels cannot bypass this gate. Every present/unknown blocks.

The whole requested bootstrap/coordination step is NOT complete. This guard
deliberately has no mutation-permitting key result under current contract.
[Preserved spec0.1 section2](../plans/LICENSING_ADAPTER_PHYSICAL_PILOT_SPEC.md)
requires absent keys BEFORE any write and excludes provider enumeration/probing
keys/helper expansion. Existing raw open status cannot establish that admitted
absence in this context; project policy retains BAD_KEYSET as ambiguous rather
than converting an ACL-masked inaccessible key into absence. This is a contract
blocker found in source/spec inspection, not a new physical Windows failure.

Proposed direction ONLY, pending owner choice: prepare a narrowly scoped successor
contract assessing exact-name collision enforcement by create-new-without-overwrite
in the already-specified Setup role, retaining ownership-intent/partial-state
handling and refusing every collision/unknown. This changes the pre-write key-
absence requirement and sequencing; it must receive scoped review/owner approval,
not be implemented as a hidden retry or permission bypass. No old spec/packet
bytes changed, no extra System helper/privilege/ACL/enumeration exemption adopted.
Full guarded registration/start/live-observer coordination, self-contained custody
and built-kit review remain after resolving this blocker. No physical command
to run now. Native/LIC008/four REM/NE/FEP/Security/production gates unchanged0/5.

344 unique managed cases (316 prior +28 root/error/key-state/forged-absence/order/
count/collision checks), warnings-as-errors build PASS. Three executable and
three controller-stage refusals, syntax and provenance-pinned wrapper SelfTest
PASS (same344 cases, not688). Native probes not invoked; no service/key/token/
ACL/customer/backend change. Generated artifacts retained, not committed.

Final output: `out/lic008-pilot-runtime-candidate-7774df01007d4c60b0b2f5a085f81c84/`.

| Evidence | SHA256 |
| --- | --- |
| build-provenance.json | 6192fe841e9bf01f3092dfe5a18a58a119de2a1cabc6492107b463530c72abb7 |
| EntryControl.AdapterPilot.dll | ea1dda946ca3008592a4b829fae5450a04dea5d496423f98a1315b8243592b2a |
| pure-test-report.json | 4c1ca8cd36e947040f1e0e4c7d01ef427c3c1983fbac09f29e9160142499ad9e |
| controller-entry-checks.json | 86b2a21761748da2bc95ba0feca004d660144bb8c0dbc3bbb365f237ee2842f6 |

All six bindings/external controller-to-provenance digest verified. Source/docs
for this preflight step included in the owner-requested correction commit.
Microsoft documents [NCryptOpenKey](https://learn.microsoft.com/en-us/windows/win32/api/ncrypt/nf-ncrypt-ncryptopenkey)
as an existing-key open and describes BAD_KEYSET as not found; this does not
override the project's stricter context-specific evidence rule. Microsoft's
[NCryptCreatePersistedKey](https://learn.microsoft.com/en-us/windows/win32/api/ncrypt/nf-ncrypt-ncryptcreatepersistedkey)
documents NTE_EXISTS for an existing name when OVERWRITE is not specified; this
supports investigating the proposed successor, not accepting it or running it.

## CHG0130 / LIC-EV-0199: key collision correction draft0.3

2026-10-11: owner agreed to prepare the proposed correction after its explanation.
[New specification0.3](../plans/LICENSING_ADAPTER_PHYSICAL_PILOT_SPEC_V03.md)
is PLANNING_ONLY/AUTHOR_DRAFT_AWAITING_SCOPED_REVIEW. Only the pre-write key-
absence requirement is replaced: root/service absence and independent pins stay;
two exact new key names are enforced by original Setup without OVERWRITE. Late
collision can occur after public bootstrap/first key and must retain partial
state/block publication/stage progression. Native success alone and intent alone
do not establish verified ownership or permit cleanup. No retry/adoption/helper/
privilege/ACL relaxation. Race/partial finalization behavior needs actual evidence,
not a blanket atomicity claim. Original0.1/0.2 and frozen packet hashes unchanged.

Six finite review checks and planned implementation negatives are specified;
none claimed executed or independently reviewed here. Existing344 managed cases
remain EV0198 preflight evidence, not new successor evidence. No code change or
native operation, physical0/5; blocker/code admission remains closed until
review/adoption/bound successor packet and implementation. Next scoped consistency
review, explicit adoption/binding, bounded integration/tests and full kit review.
Current new docs/preceding preflight changes included in the owner-requested commit.

## CHG0131 / LIC-EV-0200: limited author successor0.3 consistency review

2026-10-12: prior preflight/draft committedc02280c, initially clean worktree.
[Exact review](../reviews/LICENSING_ADAPTER_PHYSICAL_PILOT_SPEC_V03_REVIEW.md)
binds0.3/raw references/packet/current key-role-bootstrap source hashes. Author
assessment only; no subagent/independent review or security approval. Six document
criteria supported without a blocking narrow-text contradiction. No target/code/
packet edits, build/test rerun or native operation. EV0198's344 cases remain
historical evidence, not new successor tests or proof of native readiness.

V03-I01: current source wraps finalized handle, verifies it and writes owned
record; does not reopen persisted name and compare policy/public identity first.
Original0.1 section4 requirement remains inherited by0.3. This must be closed
in bounded implementation after successor adoption/binding, not waived or patched
inside this review. Failure must retain state/block owned record/next label.
Next explicit adoption/binding/review-authority decision, separately bound
successor packet, scoped integration/negative tests, full controller/custody
and built-kit review. Review checkpoint complete; V03-I01/adoption/security/
LIC008/four REM/NE/native gates open, physical0/5. No backend/customer/Windows
state change; new review/status docs uncommitted, no commit requested this turn.

## CHG0132 / LIC-EV-0201: scoped adoption / bound successor packet0.2

2026-10-12: owner asks to proceed with the explicitly described adoption and
successor-packet step. [New decision record](../plans/LICENSING_ADAPTER_PHYSICAL_PILOT_SPEC_V03_ADOPTION.md)
selects exact0.3 implementation direction; no independent review satisfied,
security/native approval or physical-stage permission. Sole owner unchanged;
author consistency review not promoted into external assurance or gate waiver.

New `licensing/adapter-evidence/pilot-implementation/implementation-packet-v02.json`
is a closed overlay: frozen base packet/raw digest plus exact0.3/author-review/
adoption digests. Only original bootstrap ordering, Setup-create operations and
explicit source allowlist replaced; unlisted paths/identities/ACLs/stages/report/
lifecycle/custody/exclusions inherited unchanged. Exact Setup machine32/no
OVERWRITE, finalize SILENT64, no absence-from-open, stop/retain/no retry/adoption/
cleanup, persisted-name/public-identity match before owned record/next label.
V03-I01, controller coordination and self-contained custody/review remain OPEN.

Read-only `scripts/check-license-pilot-successor-packet.mjs` verifies raw base plus
7 reference pins (4 inherited+3 new), closed schema/overrides,16 explicit source
paths and all authority flags false except separately recorded product direction.
Canonical token validation rejects duplicate JSON keys rather than silently
normalizing them.24 negative checks PASS: extra fields/pin changes/permissions,
false independent or physical approval, changed order/root guard, escaped source,
overwrite/finalize flags/actor/absence fallback/ownership shortcuts/missing gaps
and duplicate/trailing JSON. These are new packet checks, NOT344 runtime cases
or physical results. Old checker still verifies the unchanged original packet.

| New bound input | SHA256 |
| --- | --- |
| Specification0.3 | dfce64538c6fd13aa0891996f9ee94b7807c9e210be3060b508b66f2e75848d6 |
| Author review | c9e521847cfe097767f71111685baa4d5216e5702c13d616870dfa23ee521bd4 |
| Adoption record | 2ce23e0bc92bd00d1acc6751a787b18b966ac15802a95082a311a16ec7709e15 |
| Successor packet0.2 | 73235a629ff81da4ac611b97d9c2e1c8999d4f8312c24e4f4b93cc823a564a14 |

Existing candidate builder/runtime still consumes the original packet and remains
closed. No source/native/runtime activation or candidate rebuild performed here.
Next bounded V03-I01 persisted-name readback correction, successor bootstrap/
builder integration and negative tests with physical entry still disabled; full
controller/capture/custody/built-kit and outstanding review-authority requirements
remain before separately permitted stages. Physical0/5; LIC008/four REM/NE/native/
Security/production gates unchanged. New and preceding review docs uncommitted;
included in the owner-requested adoption/packet commit.

## CHG0133 / LIC-EV-0202: successor preflight / V03-I01 source correction

2026-10-12: user requests current changes committed then next implementation.
Adoption/packet/author review/status/checker committed4999d47 before source work.
KeyOperations.VerifyNewlyPersisted verifies the successfully finalized new handle,
opens only its exact approved name/provider/machine/SILENT context and independently
verifies policy/DACL/public identity before returning that hash to RoleActions.
Owned record writes and next label follow only on success. Original Step stops
later work after exceptions. No open-after-collision, fallback to handle-only,
retry/delete/adoption/permission changes. Creation flag guard permits only32 and
finalization only64. V03-I01 is SOURCE_CORRECTED_MANAGED_CHECKS_PASSED_NATIVE_NOT_RUN,
not an independently accepted or physically tested finding closure.

BootstrapAdmission adds distinct AdmitSuccessor: canonical approved Prepare plan
and exact compiled successor packet digest required; controller token/runtime/
boot/plain ancestors/root and three exact registration absence checks remain.
No key opens or key-absence declaration in this successor path. Legacy Admit/
RequireClear continues to reject all raw unknown/forged absence, no suppressed
exception/override. No directory/copy/service registration/start route added.
Main/kit entry still self-test-only; successor preflight native calls NOT_RUN.

Builder now freezes eight exact protocol inputs (base/successor/three specs/
author review/adoption/foundation policy) plus codec already frozen. Verifies raw
digests before build and frozen/live inputs after build, records protocol pins
and successor digest in provenance. Pure emitted compiled successor digest must
match independently pinned expected packet. Does not make framework-dependent
candidate a complete self-contained physical kit or add host-stage authorization.
Frozen packet/review/adoption bytes and their open-requirement history unchanged.

371 unique managed cases (344 prior +27 flags/ordered identity readback/failed
readback blocks ownership/successor plan-and-packet pin/stage refusal checks).
Compile warnings-as-errors PASS, three executable and three controller-stage
refusals, syntax and provenance-pinned wrapper SelfTest PASS (same371, not742).
Actual key/provider/file/token/SCM paths not executed. Original successor checker
24 negatives and base checker23 remain packet checks, not native test results.

Final output: `out/lic008-pilot-runtime-candidate-a87a6d7fb51f41c7bca1f34c0920b85e/`.

| Evidence | SHA256 |
| --- | --- |
| build-provenance.json | 58bfa6b3739f1ab079050d2fd4852437b5a824df6c27aba7673b5f282d5ae616 |
| EntryControl.AdapterPilot.dll | 1322b6f10fddc3610be6e5f9619ee96072758ce2453d0eb1bbe45a1586f7e644 |
| pure-test-report.json | ad9b86e410e5582687444d7aafeff6d0343e1be3f0e7a42b6ee1945e691401b5 |
| controller-entry-checks.json | c59f396537da81e17d4840e2f5bc1f53b2dc3c46a169105f4e2d68bf01e54d68 |

All six artifact bindings/eight frozen protocol pins/external controller-to-
provenance digest independently verified. Earlier371 output before emitted-pin
assertion retained, not final source evidence. Next actual public bootstrap/
service/role/live-observer coordination source and self-contained custody plus
built-kit/review-authority requirements before separately authorized physical
stages. Physical0/5 and LIC008/four REM/NE/native/Security/production unchanged.
No backend/customer/Windows state change. Source/docs included in the owner-requested
persisted-name correction commit.

## CHG0134 / LIC-EV-0203: public bootstrap and new service registration source

2026-10-12: user requested commit first then next implementation. Source/docs
committed791bd4a before new work. Existing BootstrapAdmission/ControllerWindows
extended, no new code source outside successor allowlist. All code disconnected
from Main/kit physical entry; no native operation performed.

CreatePublicAndRegister snapshots canonical plan and clones package bytes before
admission, exact ordered names/sizes/hashes, aggregate512MiB cap. Requires approved
successor digest/canonical Prepare plan, token/runtime/boot/root/service absence
and pre-registration independent Guardian/App account-to-SID lookup matching
plan. Lookup unavailable/mismatched means refuse before writes, not guess SID,
register a helper or expand privileges. No claim this lookup/timing works on the
current host or fleet without physical evidence.

Creates only seven original Controller-owned public directories with SecureFiles
exact protected descriptors. Package/Prepare plan/run-admission use create-new,
flush/owner-DACL/path checks and independent byte readback. Private shared/
protected/guardian-work remain Setup-created, no administrator private read.
No source/customer/back-end write; no automatic cleanup on any partial failure.

RegisterAllNew uses CreateService only, exactly three own-process16/Manual3/
normal error-control1 registrations with quoted pinned-root apphost/fixed role,
Setup LocalSystem or exact Guardian/App virtual account, no passwords/dependencies.
Requests only query-config/change-config/query-status on created service handles,
not start/stop/delete. Sidtype1 configured only through NEW handle. No open-and-
adopt, reconfigure existing registration or DeleteService. Each new registration
read back; exact service names/config/stopped/PID0/numeric SID, Sidtype1, zero
failure actions/no recovery command/reboot message, zero failure flag/delayed
start/triggers. Unsupported/denied/unexpected query refuses and retains state.
Final Guardian/App SIDs match independent approved plan before return. No keys
created or role processes launched by this method. Partial directory/copy/
registration/SID/config failure stops, retaining created files/registrations.

396 unique managed cases (371 prior +25 template/SID/automation rules, package
snapshot/foreign-order/count/path/empty/hash changes, seven public creator checks).
Warnings-as-errors build PASS; three executable and three controller physical
entry refusals, wrapper syntax and provenance-bound wrapper SelfTest PASS
(same396 cases, not792). None invokes native CreateService/QueryServiceConfig2/
SID lookup/file ACL/ProgramData writes. This is source/managed evidence, not
physical bootstrap success or complete controller/host/custody acceptance.

Final output: `out/lic008-pilot-runtime-candidate-b6a57b365f4c4e56a42dab7bed951c15/`.

| Evidence | SHA256 |
| --- | --- |
| build-provenance.json | 9950a71c6b581e12b4653f3dc2723ded8d0363f63df47e97e26f5628402daae0 |
| EntryControl.AdapterPilot.dll | 9f4194666ad403145a022bd7d520f4b54c9e34a9a1ddc15902464a796bb475ec |
| pure-test-report.json | 014a1e378747a272245a4b97b094c8deb22d8441035aed029032209dacf72976 |
| controller-entry-checks.json | 34b407e76dbfabf9ca53eabf41c38ccb099f029d3b8478b250e82163cd5316d1 |

Six bindings/eight frozen protocol inputs/external controller-provenance digest
verified. Next service role dispatch/ordered starts/live-observer coordination,
actual host binding/self-contained custody and consolidated built-kit/authority
checks before individually authorized physical stages. Bootstrap slice complete
as candidate code only; whole controller step PARTIAL. Main/kit remains closed;
physical0/5 and LIC008/four REM/NE/native/Security/production unchanged. New source/
docs included in the owner-requested public bootstrap commit.

API reference for configuration guards:
[SERVICE_SID_INFO](https://learn.microsoft.com/en-us/windows/win32/api/winsvc/ns-winsvc-service_sid_info),
[QueryServiceConfig2](https://learn.microsoft.com/en-us/windows/win32/api/winsvc/nf-winsvc-queryserviceconfig2a).
These document the native interfaces, not independent or actual test evidence.

## CHG0135 / LIC-EV-0204: ordered dispatch and live observer source integration

2026-10-12: prior bootstrap source/docs committedb6f3c9b before user-authorized
next implementation. Existing allowlisted files only; Main and kit still refuse
all physical shapes. No service/child/native operation executed during this turn.

ServiceHost.RunRole decodes exactly3 bounded SCM arguments (service name, fixed
action, approved plan hash), validates exact role/action/context before Execute.
DispatchChild accepts only the existing four fixed child arguments. Role/child
dispatch methods are disconnected from Main, not enabled executable entry points.

StartAndObserve validates canonical approved stage plan/raw protected plan hash,
exact successor digest, service/action and new report paths; consumes each RunId
once. Requires no retained live observer/active launch. Native StartService called
once with action/hash, only read-only status polling afterward. StartPending may
wait; Running requires valid PID for independent retained-handle observation.
Stopped/missed/error/expired capture refuses, no repeated StartService or identity
inferred from report claims. Capture5000ms elapsed guard also checked after native
attachment; observer strongly retained if a late result cannot be accepted.

RunOrderedStage freezes the plan, checks prior protected checkpoint stage/context/
experiment/run/evidence/shared hashes and time before Fresh/Finish, and verifies
all approved reports absent before starts. RequireNewReport checks protected parent
descriptor/plain path and only native error2 admits a new path; access-denied/
existing/reparse/unknown refuses. This is a preflight check, not a race-free lock;
role CreateNew/report checks remain required. No silent restart/replay/cleanup.

OrderedActions allows only the exact service action sequence; it advances only
after native process exit0, stopped/config receipts and complete per-action
report context/result/pins matched to independently captured token and parent/
lifetime observations. App's child is independently discovered through read-only
snapshot polling; zero candidates before birth is not success/absence. Extra,
missed or already-exited child refuses; no report-PID reconstruction or new IPC/
ready-handshake. Observer handles held strongly on failure/timeout, later launches
blocked in the controller process. No StopService/Kill/delete/retry/next-stage
auto-transition. Final full StageController/ProcessObserver validation plus
fresh protected report/shared/history reads precede checkpoint persistence.

Conservative overall action-observation/validation10000ms guard checked during
polling, after observed exit and after report validation, so late completion
cannot advance. This may reject a valid but slow role, does not interrupt a
blocking Windows API, prove native deadline enforcement or guarantee catching
short-lived services/children. Cross-account token queries/host defaults remain
unverified. Timing/readiness/incomplete-state behavior still needs scoped built-
kit and physical assessment; no performance/platform/Security guarantee.

481 unique managed cases (396 prior +85):33 SCM role/action/hash/count/template
checks,6 capture-state checks,16 per-action report/hash/PID fixture checks and30
three-stage sequencing/active/wrong-order/incomplete/blocked checks. Existing full
stage negatives also pass. Warnings-as-errors compile, three executable and
three controller physical-entry refusals, wrapper syntax and provenance-pinned
wrapper SelfTest PASS (same481, not962). No actual native driver/capture operation.

Final output: `out/lic008-pilot-runtime-candidate-01c54fa4e2ee4041905281cb6b8f6e51/`.

| Evidence | SHA256 |
| --- | --- |
| build-provenance.json | 6eebcb5b5e3f1051a40119459861963e22ffd05c97232a59ab490e80abecacd4 |
| EntryControl.AdapterPilot.dll | 083a9b362ceeaf36787ae6f15930b916653454d74aeef162826bd4ffdffdd215 |
| pure-test-report.json | abbd20ec17b6b349a7bd7a8578eaa089b9cfaecd605e8a08f2144001d4b258eb |
| controller-entry-checks.json | 9b9afec7c2a1cd8f38568656ca65a4505d305a59f8b77da1c9475675c2eb6223 |

Six evidence bindings/eight frozen protocol pins/external controller-provenance
binding verified. Interim481 outputs before report replay and late-result guards
retained, not final source evidence. Next self-contained apphost/runtime package/
source/kit/archive custody and reviewed executable Main/kit/actual host admission
and activation, outstanding independent-review authority and consolidated built-
kit checks before individually permitted physical stages. Native controller/kit
still NOT_READY, physical0/5 and LIC008/four REM/NE/Security/production unchanged.
No backend/customer/Windows state change. Source/docs included in the
owner-requested ordered dispatch commit.

## CHG0136 / LIC-EV-0205: gated self-contained package / closed delivery archive

2026-10-12: coordinator source/docs committed8dab9b6 before new implementation.
Existing builder/wrapper/README-fa/pure emitter extended, frozen packet/spec/
review/adoption unchanged. No new runtime source outside allowlist; generated
host-helper source is embedded in frozen builder/retained host-tool artifacts.

Builder snapshots cached SDK10.0.400 HostModel/apphost template and runtime10.0.11/
hostfxr, uses direct CSC/app-local HostWriter and includedFrameworks/deps metadata.
No MSBuild/publish/network restore/download.194 closed package files, exact name/
size/hash/plain-path manifest. Candidate compiler/reference snapshots remain in
out, not all distributed in ZIP; no full portable build-toolchain reproduction
or customer redistribution readiness claimed.

Framework-dependent candidate/wrapper, actual self-contained EXE, kit Package-mode
wrapper and extracted wrapper all pass SAME481 unique managed cases, not2405.
Emitter verifies actual apphost/DLL digests, runtime10.0.11 and package-local
System.Private.CoreLib path. Child-only DOTNET/COMPLUS/CORECLR/COR overrides
removed, parent/machine environment unchanged. No clean-machine/absent-installed-
dotnet/platform test or native host/token/ACL/service/key operation.

Mode=Package SelfTest requires exact independently supplied self-contained
provenance digest, four fixed metadata bindings, closed file names (reserved-name
guards), sizes/hashes/plain ancestors and no directories/extra package entries.
Direct local apphost executes only SelfTest. Three original executable/three
controller plus three additional self-contained apphost physical-shape refusals
PASS. Four separately observed Package wrapper refusals PASS: Prepare/Fresh/
Finish before inspection and SelfTest with wrong provenance digest. Those are
process/admission checks, not additional481 runtime cases or physical evidence.

Kit contains package/snapshot/host-tool plus metadata/wrapper/README. Kit manifest
lists payload, not itself; ZIP contains payload+manifest234 entries. External
delivery provenance binds ZIP/kit manifest/package provenance outside self-hash
cycles. Create-new extraction admits exact names/count/no duplicates/sizes/hashes
and descendants only; extracted wrapper SelfTest PASS. No automatic deletion.

Final output: `out/lic008-pilot-runtime-candidate-e0df4ec29ec14e308e07ea3037f7b442/`.

| Evidence | SHA256 |
| --- | --- |
| self-contained-provenance.json | 85c708cb06cc7f64216fa948b6ba2b542b8346da5cc15efb5838d112c56a166c |
| package-manifest.json | 0512b3689acdc07e2d4e5d064113318e08464e93dcfe653b6ae2834291277440 |
| delivery-provenance.json | 3d171974bcb9377224834a01eadf8256ea35b447a7dcdf4d41c2eb5cb2351ae8 |
| pilot-kit.zip | 54fb50b4d0b415e59f7fc83c57ef2a2a18c62b5601db7111727d5fb87b359ab0 |

Independent extracted194 file hashes/archive digest/live-source-to-snapshot
hashes PASS after final build. Earlier packaging candidates retained, not final
source evidence. Next actual host binding/Main/controller admission and reviewed
activation integration, consolidated built-kit and outstanding independent-review
authority before individually permitted stages. Main/wrapper physical routes
still unconditionally disabled; physical0/5, LIC008/REM/NE/native/Security gates
unchanged. No backend/customer/Windows protected-state changes. New source/docs
included in the owner-requested packaging commit.

## CHG0137 / LIC-EV-0206: read-only host inspection / independent host-plan match

2026-10-12: packaging source/docs committed31cc813 before next implementation.
Existing NativeTokens contains typed HostSnapshot/HostAdmission, no extra source
outside allowlist or frozen packet/spec/review/adoption edit. RtlGetVersion reads
actual major/minor/build/workstation type; Registry64 fixed Cryptography/MachineGuid
read only, canonical GUID validated and hashed, raw identifier not emitted. Digest
binds schema/scope/machine fingerprint/OS/build/type/OS+process architecture/runtime.
Requires client10.0/build>=10240/X64/runtime10.0.11; no lifecycle/date/ESU filter.
This is target/profile admission, NOT fleet/native-feature compatibility proof.

Unavailable, missing, malformed, empty, inaccessible GUID or OS query refuses;
no registry writes/privilege enabling/fallback IDs. GUID-derived fingerprint may
be cloned/edited and is NOT hardware proof/anti-clone/admin resistance or product
License authority. Boot hash separate from stable host-profile digest. Different
OS/runtime/profile needs newly reviewed pilot binding, not a product-support ban.

Bootstrap, role PlanAdmission, ordered starts and successful post-operation report
context independently capture host and compare to approved plan HostBindingSha256,
not copy host hash from a report. No physical execution of these role paths.
Main accepts exact --inspect-host ONLY as a read-only diagnostic in addition to
SelfTest. Package-mode InspectHost first admits external provenance/full package,
sanitizes child runtime overrides, checks EXE/DLL digests and readonly/unapproved
host output. Extra arguments/physical stage shapes remain refused; no controller/
service/child activation or acceptance introduced.

501 unique managed cases (481+20 host schema/scope/version/type/architecture/
runtime/fingerprint/binding/GUID checks), compile warnings-as-errors and original
entry refusals PASS. Self-contained package/kit/ZIP/extracted SelfTests repeat
same501 cases, not additional unique cases. Fresh package is194 files/234 archive
entries; source-to-snapshot bindings checked after build. Prior candidate before
wrapper InspectHost integration retained, not final source evidence.

Final output: `out/lic008-pilot-runtime-candidate-677cf7f8004b4de9aaa5e06943e18bd1/`.

| Evidence | SHA256 |
| --- | --- |
| self-contained-provenance.json | 1675a1e5566340ca5f41c15f1cd8a1c06df5038b19ae4210f98daf78df79c0c6 |
| package-manifest.json | be6885789882a4d912d3832aad23694c3a43013602afa5fbebcfa4314d980ed4 |
| delivery-provenance.json | 05539dc6b0900b0a86212f32d00b0c925ad8914e9803b40bad96a46875768ea4 |
| pilot-kit.zip | e1cf237241fe07fb6008df0a3dabc225662261342ac3fd83cf7385cac100cc3c |
| host-inspection.json | a59dc436ae1e6184c996102b1c0e2755e0f018a3b35d963ff712159f3fec7fd9 |

Actual Package-mode read-only inspection on current host PASS, exit0. Windows
10.0.22000 workstation1, OS/processX64, runtime10.0.11. Returned host binding
`bbe896adb1157f0b94e133f26796c7569ee735b60710f3b3f469f7199bd2d5e9`, boot identity
`699629076528af059fa7bc2606f7461a504328573c1744ff6827f66f3c497913`, actual executor
`79f27b1236484a1871b97f3af2b42ec3d22267e98f89e41eb4ee842b8a2e54c4`, assembly
`1d90f01584b56312ddfbc70e1f550e9421c1fe2ace4c7fe57e490e5bfd36e4e2`.
Host output captured verbatim with final newline in ignored out/host-inspection;
outside ZIP/provenance built earlier, not retroactively claimed archived/bound
delivery evidence. readOnly=true; ownerApproved/physicalTested/securityAccepted/
productionAccepted=false. This inspection invokes readonly OS/registry/boot APIs,
NOT SCM/service/token/Software-KSP/ACL operations or FEP physical cases.

Next reviewed executable/controller protected admission/activation integration,
consolidated built-kit and outstanding independent-review authority/actual host
approval before separately permitted Prepare/Fresh/Finish. Main/wrapper physical
routes remain disabled. Physical0/5 and LIC008/REM/NE/security/native unchanged;
no backend/customer/Windows protected-state changes. Source/docs included in the
next user-requested commit before controller admission work.

## CHG0138 / LIC-EV-0207: separate controller binding / protected intake candidate

2026-10-12: previous source/docs committed bb12007 first. Added ControllerBinding
as a separately supplied expected-values boundary, not a serialized approval or
signed ticket. ControllerAdmission copies bounded plan input, requires exact raw
SHA256 plus canonical closed JSON and existing plan validation, then compares
stage/experiment, packet, host/boot, source/provenance/kit/package/dependencies/
profile and previous-checkpoint/evidence pins. Both CreatePublicAndRegister and
RunOrderedStage now require it before any native work. Existing protected-plan
ReadProtected candidate checks controller token, protected file, current role
SIDs/boot, independently captured host and current package; it remains unrouted.
No pre-bootstrap external intake or authority-to-binding construction is claimed.
Caller-supplied matching pins cannot establish independent review or approval.

561 unique managed cases PASS (501+60 across the three stages: positive snapshot,
14 expected-field substitutions, noncanonical bytes, two false plan-authority
flags, empty input and original-input mutation). Framework-dependent wrapper,
self-contained apphost, kit and extracted kit repeat the same cases; not new
unique tests. Physical entry/controller/apphost refusal checks PASS. Main and
wrapper unchanged: physical commands disabled; no controller protected intake,
SCM/token/KSP/ACL/service/key operation executed. No new InspectHost execution.
Initial build45e86734a716405f88715a336425a522 failed on a local variable name
collision; retained outside final evidence and corrected before final build.

Final ignored output: out/lic008-pilot-runtime-candidate-3c18f2a27c0c4032b35b86dae0b56e17.
Exact SHA256:

- self-contained-provenance.json:
  `6f2603fe014340332a49d45782d74467f6cd1aeb9540f803c85a31d33f566ec6`
- package-manifest.json:
  `bbf2773d52e039e0b73b591658ff51442135936ff5c3da3c4cd7b0609ac6b3f1`
- delivery-provenance.json:
  `2e809214a560db53ba947c1b44dadb123ee013ee71e33087fcb640f525278da9`
- pilot-kit.zip:
  `88cb0c728e2d4b675e293672c3ac8c30363e5a9ef82e7867c7f45e7670f3532b`

Actual apphost runtime10.0.11 and package-local CoreLib verified; assembly digest
`26c08a806a60a5a7cf4da87546eeaecce839f549179d523883a17c84e27c4bc0`.
All source-manifest hashes match current C# sources. Frozen successor checker
24 negatives and historical implementation packet23 negatives PASS; historical
NOT_BUILT output is not a status assertion about this new candidate.

Next reviewed external-input/authority and built-kit custody construction of the
binding, then bounded Main/wrapper activation review before separately permitted
stages. Authentication, replay/consumption and pre-bootstrap path handling cannot
be inferred from these pure pin comparisons. Physical0/5, independent review and
security/production false; LIC008/REM/NE/native gates unchanged. No backend/client/
customer protected-state change. Work subsequently committed ff8e3ea before EV0208.

## CHG0139 / LIC-EV-0208: bounded external input / diagnostic-only entry

2026-10-12: EV0207 committed ff8e3ea first. ControllerInput adds a closed schema1
scope TEST_ONLY_CONTROLLER_INPUT_V1 wrapper for plan and separately expected
binding. Independently supplied whole-input SHA256 checked before JSON parsing;
existing canonical plan/expected-pin checks follow. Null/unknown/duplicate fields,
wrong scope/schema, substituted hashes and false required plan flags refuse.
Main exact --validate-controller-input <sha256> reads bounded stdin (2MiB maximum)
and emits diagnostic only. Package ValidateInput requires independent package
provenance plus absolute InputPath and ExpectedInputSha256, validates package
inventory and sends a bounded read-only file snapshot as raw stdin bytes to the
fixed apphost. No shell interpolation of input JSON. Main only self-artifact
hashing, no protected plans or Windows token/SCM/KSP/ACL calls. Direct stdin waits
for EOF; this is not a deadline-controlled native execution path.

597 unique managed cases PASS (561+36: eleven external-input cases at each of
three stages plus stream exact-bound/empty/over-bound checks). Framework, package,
kit and extracted wrappers repeat these cases, not extra unique tests. All three
physical stages and native-entry shapes still refuse; no physical activation.
Built-kit extraction/hash verification PASS. Source hashes match final snapshot.
Frozen successor/base packet and docs link validators run separately.

Actual synthetic fixture, ignored out/controller-input-fixture-ev0208.json:
SHA256 `a794760dd4a2a32e70d91019159c95805eb4eb3d50db5079ba3f3fb4744fc4b5`.
Illustrative one-byte package rows, fake host/context pins and true plan flags
are solely managed test data, not actual host/kit approval. Positive direct
apphost, Package wrapper and extracted-kit ValidateInput all exit0 with
inputValidated/readOnly=true; liveContextValidated/executionAuthorized/
physicalEntryEnabled/ownerApproved/physicalTested/securityAccepted/
productionAccepted=false. Direct apphost substituted pin exits2 with fixed
PILOT_FAILED_OR_REFUSED and no report; package wrapper substituted pin exits2
PILOT_CONTROLLER_REFUSED. No real authorized plan or physical case executed.

Final ignored output: out/lic008-pilot-runtime-candidate-06b82b6bb4584d098da3e988fef4c987.
Exact SHA256:

- self-contained-provenance.json:
  `cabdf71000d6f6808100855171c3a69c0c0c8f3176be9525c2e01f6f426c44c1`
- package-manifest.json:
  `18283d76fbe568d42a7031d2293735a64017a5d2ac31658cb509217866b12765`
- delivery-provenance.json:
  `63470f914913fab9114e51e6ed90340ae6b5b09cb70f85e6c4dc108322c71a6d`
- pilot-kit.zip:
  `612fdcb8de501665d0f6eee202deaecb1200a285c63c5d16660a28a296e74ddc`

Final loaded assembly SHA256:
`585243b12cd85cf9ef6fac7ae8de3028981e4d8274bb5974f02cb8b6498f7387`.
Earlier019729cae19043d4a835b58584951b3e build passed597 but preceded bounded wrapper
stream correction/README update; retained, not final current-source evidence.
Fixture and external validation stdout are not retroactively part of the built
ZIP/provenance graph. Package-local runtime10.0.11/CoreLib remain verified.

Next reviewed authority/custody-to-binding construction and physical activation
review. External digest does NOT authenticate a signer, record independent
review or implement replay/consumption. Existing ReadProtected lane still
unrouted. Physical0/5 and LIC008/REM/NE/native/security gates unchanged; backend,
client and customer protected state untouched. Current changes included in the
user-requested follow-up commit2c95246; generated output excluded.

## CHG0140 / LIC-EV-0209: exact owner-decision / stage connection candidate

2026-10-12: user requested previous changes committed before implementation.
Initial git status clean; already committed2c95246, no empty commit created.
Closed OwnerStageDecision carries schema/scope, unique decision ID, account-shaped
owner SID, APPROVE_TEST_STAGE, canonical input/binding digests, exact stage and
experiment, UTC issue/expiry and false security/production flags. Separately
supplied canonical decision digest and expected SID must match before private
OwnerAdmission construction. Input binds the complete plan/package/kit/source/
host/boot/previous-stage context; none is inferred from the decision's name.
Candidate validity<=24h checked at admission and use, using local UTC wall time;
not trusted time or a production authorization policy.

Bootstrap and ordered-stage APIs now require that private-constructed handle
instead of raw plan/binding. Decision-ID reservation before native access is
process-local. Prepare uses admitted -> bootstrap begun -> complete stopped-
registration readback -> same-object stage begun. Failure before readback leaves
bootstrap begun and cannot continue/retry; repeat/new-object same-ID use refuses.
Fresh/Finish reserve directly once. Bootstrapped run-admission additionally pins
owner-decision digest. This source lane has NOT been executed physically.
Low-level helpers are not newly trusted; Main/wrapper physical routes stay closed.

Read-only Main --validate-owner-input <canonicalDecisionSha256> <expectedOwnerSid>
accepts bounded stdin. Package ValidateOwnerInput additionally validates the
independently pinned package and whole-input hash before transport; separate
ExpectedOwnerDecisionSha256/ExpectedOwnerSid required. Diagnostic success means
record correlation only, not consumption, live owner-token check or issuer
authentication. A separately supplied SID/hash cannot prove who created a record.
No actual owner approval was created by this implementation or synthetic tests.

677 unique managed cases PASS (597+80 owner cases across three stages): snapshot/
alias, different hash/SID, scope/schema/decision substitutions, exact input/
binding/stage/experiment/ID, UTC offset/future/expiry/oversized window, false
security/production claims, bootstrap sequencing and process-local repeated-ID
consumption. Framework/apphost/kit/extracted SelfTests repeat the same cases.
Physical entry/stage refusal checks, closed ZIP/extraction and source/wrapper
snapshot matching PASS. Direct synthetic apphost positive and changed expected
owner SID refusal PASS; positive Package and extracted ValidateOwnerInput PASS.
No native protected-file/token/SCM/KSP/ACL/role operations or physical case ran.

Final ignored output: out/lic008-pilot-runtime-candidate-7901e27d3b2443799a4be96ddf38074a.
Exact SHA256:

- self-contained-provenance.json:
  `0083e7226dadfca3b7cbe38c598660409833231936bfc3cbda3eb3cbf73c97d1`
- package-manifest.json:
  `d50472967918b800d0728c89640bb35a17297376ae07105d1d5bb2ec97e78e5c`
- delivery-provenance.json:
  `bd2afd97e7d34f02e0e6480c2a7157c63037f584adb18a25f24f3e0463316b9f`
- pilot-kit.zip:
  `1bbb673a60f92a67793825b909c12dd77fbd099ed5c59c08eb30fa545942b288`

Final loaded assembly SHA256:
`acfa330dde9674342bd1ff43b49ae0897c06365e2e47815e2c03bce6d7962522`.
Synthetic out/owner-input-fixture-ev0209.json SHA256:
`8f7b5367b9f48024324ea37a890d85c3f1262a7c9a1c76d74c6871c38ac5df83`.
Canonical decision SHA256:
`b27d2d7be217c43e646863aacd2f513f8c50c3c4cc455cea8bca1e9f929eb9a1`.
Illustrative SID S-1-5-21-1-2-3-1001 is not the real owner; fake context/package
pins inherited from EV0208. Validity2026-10-12T13:39:48+00:00 to14:39:48+00:00
was a test-only window, not permission to execute. Diagnostic ownerRecordMatched
true; ownerIdentityAuthenticated/ownerApproved/liveContextValidated/
executionAuthorized/physicalEntryEnabled/physicalTested/securityAccepted/
productionAccepted all false. Fixture/stdout are outside prior built ZIP graph;
no retrospective archived evidence claim. Do not reuse expired fixture as approval.

Next bounded source review of this connection and actual owner-authority producer,
durable consumption/restart replay prevention and physical activation review.
Do not enable physical entry using a self-claimed record/hash alone. Physical0/5,
independent/security/production acceptance false; LIC008/REM/NE/native gates
unchanged. Backend/client/customer protected state untouched. Current work
subsequently committed f4f8af0 before the bounded owner-source review.

## CHG0141 / LIC-EV-0210: bounded owner author review / executor match correction

2026-10-12: prior owner connection source/docs committed f4f8af0 before next step.
[Author review](../reviews/LICENSING_PILOT_OWNER_CONNECTION_REVIEW.md) assessed
owner input/binding/phase transitions, NativeTokens and mutation-root callers,
closed SecureFiles rules and frozen successor scope. Not independent/security
approval. OWNER-R01: record owner SID does not authenticate actual executor or
record issuer. Existing controller capture enforced primary/elevated/default
Administrators owner but not the decision's exact user. Source correction now
matches actual TokenUser to decision OwnerSid before bootstrap/stage reservation
and every ordered service action. Capture still rejects impersonation; helper
requires type1/elevation1/Administrators owner/empty controller service+attributes.
No privileges, credentials, impersonation, fallback identity or SID override added.
Current executor-match SOURCE_CORRECTED/MANAGED_TESTED, NATIVE_NOT_RUN. Historical
issuer and actual confirmed owner-authority producer remain OPEN.

OWNER-R02 static consumption disappears on restart; R03 no allowed protected
journal slot; R04 internal bootstrap completion receipts are not an arbitrary-
caller proof. All remain open. New [bounded owner/journal proposal](../plans/LICENSING_PILOT_OWNER_AUTHORITY_PLAN.md)
sets explicit local-owner confirmation and three fixed per-stage CreateNew slots,
protected controller ACL, reservation before service/key operations, refusal on
any retained/malformed/ambiguous slot and no resume/cleanup/reapproval bypass.
Minimal root/controller creation must precede in-root Prepare reservation; a
crash there leaves root collision and blocks replay. This ordering/path change
requires reviewed adoption/successor binding before implementation. Proposal
NOT_ADOPTED/NOT_IMPLEMENTED; existing frozen source/path/packet pins unchanged.

688 unique managed cases PASS (677+11 actual-owner-match model cases: exact match,
other account/SYSTEM, wrong default owner, impersonation token type, elevation0/2,
service marker/attributes and invalid expected owner). Framework/self-contained/
kit/extracted SelfTests repeat these cases, not extra unique tests. Existing
physical stage/entry refusal, closed package/ZIP/extraction and exact source
snapshot checks PASS. No actual controller-token query, live-owner confirmation,
protected journal write, service/key/ACL operation or physical role ran.
Diagnostic ownerIdentityAuthenticated/executionAuthorized flags remain false.

Final ignored output: out/lic008-pilot-runtime-candidate-2a706d068635486f87e1707cb1fad5d8.
Exact SHA256:

- self-contained-provenance.json:
  `79e3a1b67067fe0b876800fb572b483611ef8b937058ecec015424e82f353d7c`
- package-manifest.json:
  `de0f196f69c09d8f7cd4a54e11fa11c8f282840c3a03da08095b3b0b31ecb4fc`
- delivery-provenance.json:
  `41e4a89417f1801453fd38b91f39f830f64939e233e50aae8a6a838f4c07a572`
- pilot-kit.zip:
  `9987c78d2b94d6da4702d31766463ce7d485a7fd3a351df77bd6dbb3dea750c3`

Final loaded assembly SHA256:
`fc6c72a45f538183f3358fe3e2e20735f985002310dcb4adcf1965c22bb51c22`.
Runtime10.0.11/package-local CoreLib verified; reviewed four-source hashes in
the review match final candidate snapshot. No native tests or new approvals
inferred from the self-contained build or this author assessment.

Next bounded review/adoption/successor binding for the proposed owner authority/
durable-consumption changes, then journal/producer implementation with physical
entry still closed. Physical0/5 and LIC008/REM/NE/native/security/production gates
unchanged. Backend/client/customer state untouched. Follow-up included in this
user-requested commit; generated packages excluded.

## CHG0142 / LIC-EV-0211: finalized owner/journal proposal / bounded author review

2026-10-12: initial git clean at130906d, prior changes already committed; no empty
commit made. Completed bounded review and finalization of the owner-authority/
durable-consumption proposal, not actual stage authorization. Final proposal
revision0.1 fixes exact ordered required context/consumed fields, bounded canonical
JSON, separately reviewed owner-context pin, live token/console challenge and
direct producer provenance. No self-claimed record or diagnostic can become
execution authority. Context pin external to hashed plan avoids a hash cycle.

Persistence rules now fix stage-wide CREATE_NEW slots, zero write sharing,
same-handle protection/path checks, flush/close and independent protected byte/
hash/schema readback before any service/key operation. Malformed/empty/current
slot or unknown I/O blocks a newly issued decision too. Prior slots must match
completed predecessor chains with distinct decision IDs. No completed-state
overwrite, checkpoint intent shortcut, post-restart proof reconstruction or
fabricated internal DTO. Minimal new root/controller creation alone precedes
Prepare reservation; a crash there leaves root collision and blocks replay.

Closed machine proposal: licensing/adapter-evidence/pilot-implementation/
owner-authority-contract-v01.json SHA256:
`a4537539bdeda1fcf60e2c52799cf91b75c8f1906dc97fece11ddbeaf99d8983`.
It pins preserved packet0.2 SHA25673235a62..., finalized proposal SHA256
`36cd7081505f0b5ddc616939f2ecc110ed6629e7845f87c3f2d23578410c77b1`
and earlier owner-source review SHA256
`6c99cc75806f28a4947adf9d8fff5a4a2359f2a0b572db1c2da70ae5392ad28a`.
Read-only check-license-pilot-owner-authority.mjs verifies three exact raw refs,
closed entire proposal and33 negative cases. These are proposal-parser tests,
not runtime/native replay or durability tests. Gates in proposal all false,
runtimeAuthority NONE; ADOPTION_PENDING/NOT_IMPLEMENTED.

[Final author review](../reviews/LICENSING_PILOT_OWNER_AUTHORITY_REVIEW.md) records
five bounded schema/trust/consent/race/crash checks and remaining producer,
private-proof, native ACL/flush/readback, restart/reboot and power-loss evidence.
No independent/security approval invented. Machine proposal is not a runtime
packet and no compiled pin was changed. Existing frozen contracts unchanged.

No runtime C# change, new apphost build, native token/SCM/KSP/ACL/journal operation
or real owner confirmation this turn. Prior688 runtime cases retained, not
rerun or counted as proposal tests. Next scoped product adoption and hash-bound
successor overlay, then producer/journal implementation with gates closed.
Physical0/5 and LIC008/REM/NE/native/security/production gates unchanged. Current
proposal/review/validator/status changes included in user-requested commit.

## CHG0143 / LIC-EV-0212: scoped owner-contract adoption / successor0.3 binding

2026-10-12: initial git clean atf729a5f. User requests the explicitly described
scoped adoption/binding next step and commit if checks pass. Recorded separate
[product adoption](../plans/LICENSING_PILOT_OWNER_AUTHORITY_ADOPTION.md) of final
owner proposal/contract as gated implementation direction, not approval of a
real host, kit, owner context or Prepare/Fresh/Finish. Sole human owner retained;
no independent reviewer/security/native approval invented.

New licensing/adapter-evidence/pilot-implementation/implementation-packet-v03.json
overlays frozen0.2. Exact additions/replacements: trusted separately pinned
owner context plus explicit live console confirmation; exact elevated primary
owner match/rechecks; three fixed controller consumed-file slots with unchanged
controller protected SYSTEM+Administrators full-control descriptor; Prepare only
root/controller creation before CREATE_NEW/flush/close/independent protected
readback, then original directory/package/plan/registration/action work. All
three stages require reservation before service/key work, prior consumed slots
and completed chains, private direct native proof and no replay/reconstruction/
DTO shortcut. Source inventory16/key/role/other path/ACL/custody/report/lifecycle
and collision-no-overwrite requirements inherit unchanged from0.2/base.

Exact raw SHA256:

- successor implementation packet0.3:
  `44ede8aa237a80667ccc3c3da4580aa8231041d443d7b9904be32481b6233d8a`
- owner authority contract0.1:
  `a4537539bdeda1fcf60e2c52799cf91b75c8f1906dc97fece11ddbeaf99d8983`
- final author proposal review:
  `9dab34bceae8a2c81647813f8f01407f1362801e18e1787882abc79b7c2c1e04`
- separate scoped adoption:
  `caa9d9a28598d277c3372ae60cf133a802bdebff7fc7f8f3606fd0b111a9ad9e`
- preserved base0.2:
  `73235a629ff81da4ac611b97d9c2e1c8999d4f8312c24e4f4b93cc823a564a14`

New read-only check-license-pilot-owner-successor.mjs verifies the entire closed
packet,14 transitive raw reference hashes, file/ACL agreement with contract,
original source presence and Software-KSP flags, and32 negative cases. Also
asserts current Program.SuccessorPacketSha256 remains0.2: new gated contract has
NOT been silently activated. Owner proposal33, preserved successor24 and base23
negative checks plus documentation links/whitespace checked separately. These
are contract/parser checks, not implementation, replay durability or native tests.

Frozen proposal's ADOPTION_PENDING/productAdopted=false status is historical at
its bytes; separate adoption/overlay records the new direction without rewriting
pins. Packet physical/independent/native-owner/durable-replay/security/production/
implementationComplete/durable flags false, runtimeAuthority NONE.

No runtime code changes, new binary/kit build, native token/SCM/KSP/ACL/journal
write or real owner confirmation this step. Previous688 managed runtime cases
not rerun. Next successor-bound journal/schema/private-proof/owner-producer
implementation with physical entry closed; review and actual permission remain
separate. Physical0/5, LIC008/REM/NE/native/security/production gates unchanged.
Checks must pass before requested adoption/packet/validator/status commit.

## CHG0144 / LIC-EV-0213: successor-bound journal / confirmation primitives

2026-10-12: initial git clean atd23d42c. Implemented gated primitives within
existing allowed runtime sources. Program compiled successor now0.3 SHA256
44ede8aa237a80667ccc3c3da4580aa8231041d443d7b9904be32481b6233d8a;
builder binds14 exact protocol inputs including all preserved contracts and
new owner proposal/reviews/adoption. Build provenance uses actual report pin;
owner successor checker accepts only adopted0.3 or preserved0.2, not arbitrary
runtime switches. No frozen packet/adoption bytes changed.

Added only three allowed controller consumed slots with exact existing controller
file owner/DACL/creator. OwnerContext8 and OwnerConsumed27 positional fields all
JsonRequired; context digest/canonical fields and independent consumed readback
validated against immutable admitted snapshot. Missing/unknown/duplicate members,
wrong flags/status/context/UTC/owner/stage pins refuse. RESERVED intent only;
no write/update/delete/resume API added. Exact field order matches contract.

ConfirmedOwnerStage has private constructor. ConfirmLocal requires separately
trusted context pin, real input/output console, exact challenge response and
actual elevated primary owner/host/boot/app-local complete package checks before
and after prompt. Source package verifies closed inventory, sizes/hashes/plain
paths, actual EXE/DLL/CoreLib paths and runtime10.0.11/X64. Trusted external
context channel remains future entry configuration responsibility, not a claim
that arbitrary CLI hashes authenticate configuration. No diagnostic promotion.

OwnerReservation private constructor follows only direct successful native
CreateNew protected file/zero sharing/write/Flush(true)/close/separate protected
readback. Holds protected controller parent handle and checks its descriptor/
path before and after write/readback; exact slot/stage only. Confirmation proof
can attempt writing once; failure does not enable same-proof retry. Existing
slot/partial file cannot be adopted or replaced; no caller DTO/stored record can
construct the native proof. These native/console APIs have NOT_RUN this step.

Both mutation roots additionally refuse with CoordinatorReady=false before any
native work. Main/wrapper physical commands stay closed. Prior-slot/completed
predecessor checks, bootstrap root/controller/reservation ordering integration,
live reservation handoff, unforgeable native bootstrap readback provenance and
trusted owner-context entry configuration still required. No claim that raw
journal existence alone satisfies authority or complete coordinator admission.

877 unique managed cases PASS (688+189,63 at each stage): canonical owner context
plus context substitutions, exact/incorrect/redirected challenge, consumed record
readback/time/status/pin refusal, all27 individually missing fields, exact slot
ACL/path exclusions, and managed dictionary/concurrent-map same-stage replay,
partial retained state and competing reservation models. Models do NOT exercise
real disk/new process/reboot/native ACL/flush/power-loss durability. Framework,
self-contained apphost, kit/extracted repeat the same cases; not new unique tests.
Existing physical-entry/controller/apphost shape refusals and closed package/
ZIP/extraction PASS. No actual owner confirmation/token/journal/service/key/ACL
operation occurred. Runtime CoreLib remains package-local10.0.11.

Final ignored output: out/lic008-pilot-runtime-candidate-bfb43a6e589d43b592184479f253110f.
Exact SHA256:

- self-contained-provenance.json:
  `a262741c1313faa25de4f1f5cb445742353313a8a2338ff7d503c4163a8543a6`
- package-manifest.json:
  `dd7f2c61fd8b834ebdf2f26625141ba2667a9a88f539543b2b4e0b437d044788`
- delivery-provenance.json:
  `958fd4ba7fb531e3e98cd35cdf1912ed5f2decf2671180a702a3ec04b2a2facd`
- pilot-kit.zip:
  `f23a47735c938691ebe71461f39c746f0bc3fc38b9b2230eece78d02ef42dc7c`

Final loaded assembly SHA256:
`c3c6a9f9d17b70841f60c1357b6f2bd295c77a1ad28de106c2abe1e0c69d1834`.
Final source-manifest hashes all match repository. Earlier19015386... and
774e33f0... builds passed pure877 but correctly refused final source custody
after implementation refinements changed source; retained, not final evidence.
An initial inline Node schema inspection hit PowerShell argument quoting;
corrected read-only stdin inspection PASS for8/27 required field order. Neither
these intermediate diagnostics nor final build imply security acceptance.

Next complete prior-slot/completed-chain and private proof/coordinator integration
with roots/entry still gated, then bounded source/kit review before individual
physical approval. Physical0/5 and LIC008/REM/NE/native/durable/security/production
gates unchanged. Backend/client/customer protected state untouched. Current
source/builder/validator/status included in user-requested commit after checks;
out/ artifacts excluded.

## CHG0145 / EV0214: prior-slot and completed-chain integration

2026-10-13; clean baseline f45b579. OwnerReservation.Create now calls protected
historical validation before attempting its fixed CREATE_NEW slot. Prepare has
no predecessors; Fresh requires Prepare; Finish requires Prepare and Fresh in
that order. Reads only fixed plan/slot/checkpoint routes and admitted report IDs.
Missing/unknown protected reads propagate refusal without writes or recovery.

Correlation checks canonical plans/records/checkpoints, same owner/experiment/
host/boot/source/package/context, distinct decision IDs across stages, required
reservation schema/state and context/challenge digest reconstruction. Completed
checkpoint chain must match plan/evidence hashes, cumulative exact run IDs,
shared digest, ordered UTC completion and the current admitted plan's chain tip.
Each historical report's bytes/hash and ordered aggregate match its completed
protected checkpoint. A reservation alone is insufficient; it is never converted
into a live proof. Null owner SID now produces explicit readback refusal.

This validates retained evidence correlation, not a new independent observation
of historical processes or authentication of old consent. The old decision bytes
and decision window are not stored in these slots, so no renewed attestation of
that window is claimed. Existing protected checkpoint production and native
observer validation remain the source of completion provenance.

927 unique managed cases PASS (877+50): complete zero/one/two predecessor chains,
missing/extra/reordered stages, repeated current/prior decision IDs, wrong owner,
state/context/plan/binding/challenge pins, future reservation/completion,
checkpoint flags/run IDs/evidence, noncanonical plan and missing/altered reports.
An initial test build refused because a historical test fixture reused bytes
intentionally corrupted by the existing alias-isolation test; the fixture now
serializes the intact plan. That failed build is not accepted evidence.

Final framework/app-local/kit/extracted checks PASS for the same927 cases; closed
source/package/archive custody and physical-entry refusal checks PASS. Successor
validator14 pins/32 negatives PASS; docs83 files/520 targets and diff check PASS.
No native history read, owner prompt, reservation, service/key/ACL operation ran.

Final ignored output:
`out/lic008-pilot-runtime-candidate-39c5ded1716e4669ac9c461c276f22fa`.
SHA256:

- self-contained-provenance.json:
  `6ff3a49004d937aa1bf89947f6520fb282a7c1c513e26ed808221798fdab048f`
- package-manifest.json:
  `dceb8dc6c18bf7bd34d5a16c9ddd2f7a5be8534f191af51f03c64e44486f6dfd`
- delivery-provenance.json:
  `b9a99bf59f142b30e64836b0296d8efefc244f24f3aa322f46bc3e94048b603e`
- pilot-kit.zip:
  `1952245fd71b6217be6dcee6e63b30d255994a8f1586b2bb7a11e6c435ff9d5d`
- loaded assembly:
  `a828363bc0d9ada92b8c4169094dd7d2360fdbfc87fca68ab1b709875b3f8118`

Next bootstrap root/controller then reservation ordering, private proof handoff
and native registration provenance, followed by trusted owner-context entry and
source/kit review. Main/wrapper and CoordinatorReady stay closed; physical0/5,
independent/native/durable/security/production acceptance unchanged. Changes
included in user-requested commit; generated out artifacts excluded.

## CHG0146 / EV0215: live reservation handoff and native bootstrap provenance

2026-10-13; clean baseline ac9c08f. Prepare bootstrap now takes the privately
produced ConfirmedOwnerStage. After context/owner/collision/package checks, only
root and controller directories are created. OwnerReservation.Create performs
reservation/readback before remaining directories, copies or service registration.
Failures retain state; no adoption, overwrite, retry or rollback path added.

BootstrapAdmission.Completion has a private constructor. Its sole production
factory performs direct RegisterAllNew and validates the actual service readback,
then rechecks live reservation before producing completion and advancing owner
phase. OwnerAdmission.CompleteBootstrap accepts this proof, not a service array.
Receipt-shape validation remains pure and cannot advance phase. Completion binds
the exact OwnerAdmission object and the private reservation created in bootstrap.

OwnerReservation now retains immutable owner/record identity. RunOrderedStage
requires the same reservation, marks its stage attempt once before native
verification and calls VerifyLive before each service action. Rechecks actual
owner primary token, host, boot, source package, decision window, protected
current journal bytes/hash and earlier completed chain. A different admitted
object with identical decision bytes still cannot reuse the proof. Failed/partial
execution cannot begin that proof again. No journal-to-proof deserializer exists.

954 managed cases PASS, including27 handoff cases across the three stages:
same-object binding, different-object refusal, wrong-object attempt, repeated
attempt, eight competing managed callers with one winner, and plan/stage/decision
substitutions. The old synthetic Prepare completion success fixture is replaced
by missing-native-proof refusal; no fabricated native Completion is injected.
Managed proof fixtures stay local to SelfTest and cannot escape as authority.
Actual bootstrap/native completion and full Prepare consume success remain
NOT_RUN and must be tested through the separately permitted native entry.

Framework/app-local/kit/extracted runs repeat the same954 cases. Closed source/
package/archive custody and physical entry refusal checks PASS. Successor checker
14 transitive pins/32 negatives PASS. Documentation83 files/522 local targets,
resolver self-tests and diff check PASS. Final source hashes match the repository.
No native owner prompt, journal operation, service registration/start, key or ACL
operation ran. Main/wrapper and CoordinatorReady remain closed.

Final ignored output:
`out/lic008-pilot-runtime-candidate-c6e2577f85f34dc386a9acf40331985a`.
SHA256:

- self-contained-provenance.json:
  `0d0656cb85c9f35163e3f419a3835b817eb3a3e9eac7f2d78bd15625ca5dec64`
- package-manifest.json:
  `2fe87419b1ff2cf1c47c74d4b467babfc5639b499327ec72463404abb636cd3b`
- delivery-provenance.json:
  `98b950cb2ef55772b5e419db1e7a288b48da5225305b4ea2f422e0d0d913cf86`
- pilot-kit.zip:
  `1b36dcc370cb8907ed112822e1865b3d57be967d0695fc0b45c06cd03faad086`
- loaded assembly:
  `c4ebc340384f747a29e5ac87edce36833810dfd05307fc9b84e42ee9ac0c9f98`

Next trusted owner-context entry integration and bounded source/kit review,
before individually permitted physical stages. This source implementation is not
independent review or actual durability evidence. Physical0/5 and independent/
native/durable/security/production gates unchanged. Backend/client/customer
state untouched; generated out artifacts excluded from the continuation commit.

## CHG0147 / EV0216: trusted local selection and internal entry composition

2026-10-13; clean baseline9fc47c9. OwnerEntry.Run now composes bounded immutable
owner input/context snapshots, direct console entry of the separately reviewed
owner account SID and context hash, correlation validation, preflight, live
confirmation and private reservation handoff. Expected values have no defaults
from untrusted input/CLI/environment. Correct operator selection is an explicit
trust assumption; a typed hash alone is not remote approval authentication.

Prepare snapshots package bytes and preflights collisions before ConfirmLocal;
Fresh/Finish read retained protected package, stopped service configuration,
predecessor chain and shared state before confirmation and again afterwards.
Confirmation preview now includes exact stage effects, including owned test-key
deletion for Finish. Fresh/Finish reserve before publishing their existing fixed
plan path with CREATE_NEW and independent protected byte readback, then pass
the same reservation to RunOrderedStage. No new path or recovery API added.

1008 managed cases PASS (954+54). New cases cover selected account/context,
missing/wrong/case/space pins, redirected input/output, expiry, empty input,
unknown stage effects and refusal at the internal entry gate before any console
or native operation. Framework/app-local/kit/extracted repeat the same cases;
closed source/package/archive custody and physical entry refusal checks PASS.
Successor checker14 pins/32 negatives and docs84 files/526 targets PASS.
No actual owner prompt, native identity, reservation, service or key operation
ran. Backend/client/customer state untouched.

[Bounded author entry review](../reviews/LICENSING_PILOT_OWNER_ENTRY_REVIEW.md)
records exact source hashes and remaining work. It is not independent acceptance.
Main/wrapper and CoordinatorReady remain closed. Next external bounded loader,
non-redirected console launcher and controller/service/child dispatch connection,
with exact kit review before individually permitted physical stages. Do not just
enable the ready flag or reuse redirected diagnostic input as local consent.
Physical0/5 and all independent/native/durable/security/production gates unchanged.

Final ignored output:
`out/lic008-pilot-runtime-candidate-aec446895ac74ab5b983ea812a0321f9`.
SHA256:

- self-contained-provenance.json:
  `92e9e4e33dc77c63e946152d14f28533973543aa05d67db4cce148dfd3ff1161`
- package-manifest.json:
  `b86ebf9c1397b5a71a49ce221b55eb2d06246ad82e7b1477d836c9eb12b70347`
- delivery-provenance.json:
  `4445365e215840afeef133f0c72c0ec92b29b649f3f7b273d36a02e47f3d7202`
- pilot-kit.zip:
  `edce670bdfdc0df035fa040d9fe26b58e4e612f11358946af57e8e7b57bdf0bf`
- loaded assembly:
  `40786f7155ea428ddaf1030bad990a08033958e0a6a110c27455f8c3d38a4d3b`

Final source-manifest hashes match repository. Source/docs included in the
continuation commit; generated out artifacts excluded.

## CHG0148 / EV0217: gated external commands and inherited-console launcher

2026-10-13; clean baseline c0a9e01. Main connects a gated physical dispatcher
with exact controller stage/context/input, registered service role and child
action/hash shapes. No permissive fallback. Both Main and internal Dispatch
refuse while CoordinatorReady=false, before native access. Local file snapshot
loader uses canonical path validation, bounded open-existing reads, read-only
sharing and same-handle plain-file/final-path checks before/after reading.
External bytes remain untrusted until the owner context selection/confirmation.
Prepare source package capture is app-local, declared-inventory and512MiB bounded;
context/input snapshots are2MiB each. No external protected ACL trust inferred.

Run-Pilot gains OwnerContextPath and a gated Package-mode physical branch after
existing complete provenance/package checks. Launch uses inherited console I/O,
exact package executable, sanitized runtime environment and explicit quoted file
arguments; no auto-elevation/redirected consent/automatic owner pin. Its separate
physicalEnabled flag remains false. The current package cannot run physical roles.
Activation metadata and preview policy must be reviewed together with stage
permission; neither diagnostic provenance nor flipping flags is authorization.

1044 managed cases PASS (1008+36). Added exact service/child/controller shapes,
missing/extra argument rejection, duplicate input path, local paths with spaces,
UNC/device/traversal/ADS/reserved names/control/quote/wildcard/trailing aliases,
and early internal dispatch refusal. Framework/app-local/kit/extraction repeat
the same cases, not more unique tests. PowerShell parse, physical-entry refusals
and closed source/package/archive checks PASS. Successor14 pins/32 negatives and
docs84 files/528 targets PASS. Native external reads/interactive launch remain
NOT_RUN. No owner prompt, service/key/ACL operation or protected state change.

Bounded author review addendum in LICENSING_PILOT_OWNER_ENTRY_REVIEW records exact
source and remaining activation conditions; not independent acceptance.
Final ignored output:
`out/lic008-pilot-runtime-candidate-22080845d6c64e1f907527d2b1f736bb`.
SHA256:

- self-contained-provenance.json:
  `879f7c00964f9572715ec12df7df77efe9517cd010ee30c0915e122b89808f2b`
- package-manifest.json:
  `81e526cc69a92c8528f2ff37d4fe45ce085904f9e335b25981dabcf1d1950c1b`
- delivery-provenance.json:
  `673e85d07edbbfbfe6102bb72592e5f61f3e18a13360d1d1c51bed9aec7db1d2`
- pilot-kit.zip:
  `6f9aeb1f1b144b0bd9529df1aed160ef3f0e9766be7c41c60472703aec42e5db`
- loaded assembly:
  `a66140646c43b7dab3e826d50cd4528617c511eefbb827fc286f4551d71e4309`

Next exact activation-readiness review and real owner/context/plan preparation,
then separately permitted Prepare. Physical0/5 and all independent/native/durable/
security/production gates unchanged. Backend/client/customer state untouched.
Source hashes match final build; generated out artifacts excluded from commit.

## CHG0149 / EV0218: readiness correction and actual-host review inputs

2026-10-13; clean baseline1603497. Read-only package InspectHost, whoami, SCM
query/showsid and account translation exposed a first-install dependency:
all three exact registrations return1060, showsid returns numeric identities,
but NTAccount translation fails until accounts exist. Bootstrap's former lookup
therefore refused before it could register services. Pre-registration now derives
fixed-name service SIDs; actual post-registration translation/token checks remain
mandatory and must match derivation. No unknown error is recast as absence.

Observed Windows service SID vectors:

- Setup: S-1-5-80-605052468-3913639721-3392015177-3683605843-3403796123
- Guardian: S-1-5-80-352077755-3436833279-1920633778-1136893238-1139765240
- App: S-1-5-80-1470498833-3441363375-1579855512-474641215-1476591558

Host build22000/workstation/X64, runtime10.0.11; host binding
`bbe896adb1157f0b94e133f26796c7569ee735b60710f3b3f469f7199bd2d5e9`;
boot `db258d9bc32ce3b87190e432f9fb25be5a5a600f19475c5b645789490b29fde2`.
Root Test-Path false is preliminary, not native collision admission. No protected
root, service, key or ACL was created/modified. Read-only host inspection is not
counted as a physical pilot case or owner authentication.

1052 managed cases PASS (1044+8 fixed-name vectors/refusals). Framework/app-local/
kit/extraction custody and physical-entry refusal checks PASS. Final ignored
candidate: `out/lic008-pilot-runtime-candidate-ce0594fdae47420590df9d133e799c54`.
SHA256:

- self-contained-provenance.json:
  `5c4aa8cb4049ccef314df013d61a1f8a9cbfdbbd73747766d8af81531cf3710b`
- package-manifest.json:
  `ce9f608cf6a22e5752d4a22d6231942879394eee73009194fdc07e7a22a135c7`
- delivery-provenance.json:
  `49d866341b826a391e5c1f5ab8bdfbc194107b55a03fe1435956ad21ff601174`
- pilot-kit.zip:
  `a377b095fcae613ffeee79cf6c196dfb808946e1650652d1bccf7e94bd35da5d`
- loaded assembly:
  `c1aca1ea755091a9f808ff799919c942b69d660e413ccadcc83aaa24a72ef9aa`

New scripts/prepare-license-pilot-review.mjs creates review material only after
exact inert source/package/delivery/archive checks and read-only current host
capture. Actual run generated five files in
`out/lic008-prepare-review-eb3bf2769427c56d2831469ecc9a7fa8` at11:04:56Z:
profile-review.json, prepare-plan-draft.json, host-observation.json,
review-status.json and review-manifest.json. Review-manifest SHA256:
`ecbcd7405e8445e3438d7d0a4188594f0fec967b137c731950d45a84b195079f`.
Owner SID selected for review is the currently observed account ending1001;
no owner approval/decision/context/expiry is issued. Draft plan has both authority
flags false; profile approved=false. Each reviewed file hash verified. Passing
the exact draft to compiled ValidateControllerInput refuses as intended; incorrect
provenance pin refuses generator before output. These checks are separate from
the1052 runtime cases. Generated review material remains ignored, not committed.

Next concrete plan/profile and activation-policy review, then exact permitted
kit/input preparation and individual Prepare approval. Current boot/package
changes invalidate draft bindings; do not promote draft flags automatically.
CoordinatorReady/physicalEnabled false, physical0/5, all independent/native/
durable/security/production gates unchanged. Source/docs/helper committed after
checks; backend/client/customer state untouched.

## CHG0150 / EV0219: concrete Prepare draft author review completed

2026-10-13; clean baseline b809e1c. Used unchanged EV0218 review/candidate paths
and exact hashes recorded above. In-memory Node audit verified review manifest
and four payload digests, all source rows, package/provenance/kit bindings,
ordered dependency inventory and194 actual package file hashes/lengths, profile
binding/values, exact five actions, six distinct IDs, empty previous history,
draft authority flags and service SID cross-bindings. Compiled read-only
InspectHost returned the same host and boot as the retained observation.

Result:244 assertions PASS; packageFiles194; hostUnchanged/bootUnchanged true;
approvalCreated/physicalExecuted false. This count is not new runtime cases;
EV0218's1052 managed cases remain the prior build result, not rerun here. The
ad-hoc audit emits only console results and creates no persistent test report.
No new source/package generated, protected state read/write, SCM/KSP change or
owner confirmation. No fresh native root/service-absence proof is claimed.

Source inspection confirms profile provider/RSA3072/export0/decryption-only
matches actual create/reopen checks. Profile digest is opaque admission/context
binding, not a parsed policy/approval. Existing draft approved=false is retained;
final profile changes require rebinding. Exact review results, activation change
map and eventual Prepare decision scope are in the existing
[owner entry review](../reviews/LICENSING_PILOT_OWNER_ENTRY_REVIEW.md).

Next implement the bounded test-capable build connection and its non-physical
negative checks as one change, not another identical draft review. Then build
final kit, refresh concrete inputs and request separate exact-kit Prepare
permission. Current inert kit is not that final kit. Frozen packet/adoption bytes
unchanged; physical0/5 and all acceptance gates remain open. Backend/client/
customer data untouched. This is author review, not independent acceptance.

## CHG0151 / EV0220: test-capable build and non-physical activation checks

2026-10-13; baseline888d217. Source/build capability connection implemented;
default inert build and explicit TestCapable build both PASS1053 managed cases,
closed source/inventory/archive verification and kit/extraction wrapper reruns.
Each build additionally passes two capability-metadata mismatch refusals and
three redirected-console stage refusals, recorded in activation-negative-checks
and included in the kit's hash manifest. Existing malformed-entry and missing-pin
checks remain. These are not actual native-role, consent or protected-store tests.
SelfTest closes coordinator entry in both compiled variants; no real stage runs.

Final test-capable candidate:
`out/lic008-pilot-runtime-candidate-d272e7da21914985b7ed4c58ef0bbf90`.
SHA256:

- self-contained-provenance.json:
  `0c793e2dbb0775d5bd95e6337aa63ae4333cb1ad962d8af93b706c6527e6322a`
- package-manifest.json:
  `9607223f1cb20928bbb30f2b0dcfd5b9b85fa73d3af3a573071d6df8acfbec17`
- delivery-provenance.json:
  `85cb59f5f031c1117bdf47f897f9acbaa86021e59dd5a6dadd65991c123dc8fe`
- pilot-kit.zip:
  `44abe479e001fd6d33056ecb1fceee6e0cd9ed781449a4086a3c21809c89b59c`
- activation-negative-checks.json:
  `b3757a9857520efb38a0810406213d381b1cf7d6f52f4326e399940ba7e6c44a`

Default inert regression candidate:
`out/lic008-pilot-runtime-candidate-f98e9b01cd62416eb94836699bbea641`.
Earlier intermediate78245935 candidate is superseded, not the final source set.
No source edits occurred during either final build. Generated artifacts stay out
of Git; source/protocol snapshots and hashes identify the dirty development build.

Fresh review-only inputs against the final test-capable kit:
`out/lic008-prepare-review-16e3abd52e4047294a3f6601bb0f981c`;
review-manifest SHA256
`0b000406ecc732beec29cba5162b6ba48acb6665d245790b04740af7bfd1d71c`.
Helper verifies source/package/delivery and captures host read-only. Owner flags
false, profile approved=false; no decision/context/window issued. Capability true
is not permission. Root Test-Path false and all three SCM queries1060 after tests;
these observations are not a replacement for native bootstrap absence admission.

Current next steps, reconciled against master and both project checklists:

1. Final stage input/context preparation and separately pinned owner Prepare
   permission; refresh boot/host if changed. No automatic conversion of drafts.
2. Prepare, inspect returned evidence; separately permit VerifyFreshProcess,
   inspect evidence; separately permit Finish and reconcile final ten reports.
   These three stages supply the five FEP-P01..05 cases, not five installations.
3. Assess fresh evidence and REM-01..04 / ADAPTER_ENTRY / NE obligations under
   existing contracts. A passing pilot does not automatically close LIC008.
4. Remaining Licensing work:006/007 protected-file/persistence/runtime integration,
   009 admission/coordinator,010 Auth/client restrictions,011 Vendor boundary,
   012 audit and013 aggregate gate. Guardian/IPC/Store/installer work follows its
   adopted implementation-entry dependencies, not an invented all-or-nothing order.
5. Delivery phases6.3-6.6: artifact isolation/signing, real services/Installer,
   PostgreSQL/ACL/storage and clean Windows10/11-x64 lifecycle matrix; Phase7
   customer/K40/day-close/report/backup pilot and sign-off. Inbox O.2.6 K40
   acceptance and O.2.7 delivery activation can proceed separately when hardware
   is available. UI unification's recorded completed work need not be repeated.

Phase6.2 remains5 complete /3 in progress /5 not started, not a product percentage.
Physical0/5; security/production/durable/independent acceptance unchanged. Author
review only. No backend/client/database/customer-state changes.

## CHG0152 / EV0221: exact pending Prepare decision/context prepared

2026-10-13; EV0220 changes initially uncommitted as requested in the prior turn.
No runtime/builder/kit edits in this follow-up; final d272e7da candidate and its
EV0220 pins remain unchanged. Only review-helper generation and documentation
advance. User requested next preparation and then commit, not separately pinned
permission for physical mutation.

prepare-license-pilot-review.mjs now emits controller-input-draft.json,
owner-input-draft.json and owner-context-draft.json with exact canonical linkage
to the plan/binding/package/profile and selected owner SID. Decision text is
PENDING_OWNER_APPROVAL, issued/expires both1970-01-01T00:00:00+00:00 (invalid
zero-length window), ownerAuthorized/builtKitReviewed/profile approved remain
false. ownerContextCreated=true means only a draft exists; ownerContextApproved
and physicalExecutionAuthorized remain false. This helper has no approve mode.

Eight-file output:
`out/lic008-prepare-review-96f161a7843adb3f1e410609be4fe224`.
Review-manifest SHA256:
`a526d8dd6bb710b392fae17dc0e20811592b0067f58285aca9c8d63c32641ab4`.
17 read-only assertions PASS: seven file digests, eight structural/hash/authority
checks and two real compiled diagnostic rejections (ValidateInput and
ValidateOwnerInput, exit2/PILOT_FAILED_OR_REFUSED/empty stdout). No live command,
owner token authentication, protected write, SCM or KSP operation. Previous1053
managed-case results are EV0220 evidence, not rerun or increased by this step.

Exact pending owner choice: authorize only Prepare for the EV0220 test-capable
kit on the reviewed current host, creating the fixed EntryEvidenceV1 test root,
three Manual test registrations and two experiment-owned keys with retained
reports. No customer/backend/production state, automatic Fresh/Finish, cleanup
or retry. On failure retain and stop. The kit ZIP/provenance pins remain EV0220.
After explicit permission, refresh host/boot, issue a bounded owner decision and
recompute plan/controller/decision/context hashes; present final independent
review pins for live console confirmation. Draft hashes are NOT approval pins.
Physical0/5 and independent/native/durable/security/production gates unchanged.

### Owner Prepare permission and execution environment — 2026-10-13

Subsequent issuance after owner reported opening Administrator PowerShell:
scripts/issue-license-pilot-prepare.mjs produces only bounded local approval
inputs, not execution or simulated console consent. It requires an explicit
owner-approved-prepare invocation, verifies pinned test-capable provenance,
uses the existing helper for source/archive/package/live-host checks and creates
fresh experiment/run IDs. Profile is explicitly owner-approved for this test;
all changed profile/plan/controller/binding/decision/context pins are recomputed.
Authorization scope comes from the owner's chat permission, not the CLI switch.

Issued out/lic008-prepare-approved-663fde1cf5e62ca713c1f2894c32e02e;
window2026-10-13T15:57:41Z to19:57:41Z. Context SHA256
1b411d07b5b09c739587a0f2b4a34ae456e93aab8b989f9ecb41595150865f81;
owner-input SHA256
5d477edec803100094f53d1bcc7883380d89cdcb0ff817c5cc159153f88965e9;
decision SHA256
ef1222470a48f2fd7d9d250a99bed6dcdf68d5101d27988ace994e1d0e56dbb5.
Both compiled read-only controller/owner validators PASS; wrong decision digest
and zero-length validity window refuse. Initial over-escaped date-offset encoding
was rejected before any approved output was written; corrected serializer passed
the exact compiled checks. No physical operation or owner authentication by the
agent; final console confirmation and Prepare output are still awaited.

After commit c5b3f49, the owner explicitly approved Prepare on the current
Windows host for the EV0220 exact test kit and previously stated limited effects.
This grants scope permission, not Security acceptance or automatic Fresh/Finish.
Pinned wrapper InspectHost passed again: provenance0c793e2d unchanged, host
bbe896ad and bootdb258d9b unchanged. Root Test-Path false; all three exact service
queries return1060 (preliminary observations, not native bootstrap proof).

Actual execution context reports SID S-1-5-21-3058020570-171625005-1532683838-1001,
Elevated=false, InputRedirected=true, OutputRedirected=true. Therefore live
Prepare cannot proceed from this session under the existing owner-confirmation
contract. No live dispatch attempted and no elevation/console bypass introduced.
No decision window issued or protected state mutated. Next is an elevated local
interactive owner console, then finalized bounded decision/context and its live
confirmation. Do not request duplicate scope consent; physical0/5 remains.
