# Pilot owner entry composition: bounded author review

2026-10-13. CHG0147 / EV0216. Baseline9fc47c9.
Status: GATED_INTERNAL_COMPOSITION_REVIEWED; EXTERNAL_DISPATCH_NOT_READY.
Implementer review, not independent acceptance or permission for a physical run.

## Reviewed connection

OwnerEntry.Run snapshots bounded context/input bytes before operator interaction.
Expected account SID and context SHA256 are entered directly at the real console
from the separately reviewed approval/configuration record. Neither value is
defaulted from request JSON, CLI or environment. ValidateSelection checks exact
digest/account and existing owner/context contracts; it returns correlation only.
Trust still depends on the operator using the separately reviewed record. Typing
a value copied from an untrusted request is not evidence of independent review;
this mechanism is local selection, not remote issuer authentication.

Prepare freezes the exact package and checks root/registration collisions before
ConfirmLocal. Fresh/Finish verify stopped service configuration, protected package,
completed predecessor slots/plans/checkpoints/report hashes and shared state
before confirmation and again afterwards. ConfirmLocal performs the actual
token/host/package/window checks, displays stage effects and requires the exact
challenge before producing its private proof.

Prepare then uses the private bootstrap Completion/reservation. Later stages
reserve before CREATE_NEW current-plan publication and protected readback, then
pass the same reservation to RunOrderedStage. Failure retains state. No new
protected path, overwrite, cleanup, resume or service/key action was added.
Existing private proof and owner-object binding remain intact; diagnostics never
dispatch into the producer or coordinator.

## Exact source hashes

| File under pilot-runtime | SHA256 |
| --- | --- |
| Program.cs | 0cc94daf8c6d882b671dbba24c5a8923a1f64a5d41503902eb2952580a25797c |
| SecureFiles.cs | 6ce90dc6173b654e6ba535769c8d42aa88905699b7498af251d2f1058426d603 |
| BootstrapAdmission.cs | 92482310ff8a3f02ceef426874f61c48936d2fcf083e8660878792fc5ff92082 |
| ControllerWindows.cs | 428ea5b2d3d8574072456d887b1063276fdeea9858df488c1ed5caf8aab306f1 |
| PlanAdmission.cs | 1278fa581032b6c2ff7812b60fd3aa7f0d301e8470ed3adb34c06ff2fafe312f |

## Findings and remaining work

- Internal trust-input composition is implemented. Actual prompt/token/native
  behavior remains NOT_RUN; managed input correlation cannot certify consent.
- Main has no controller/service/child execution dispatch and the wrapper still
  rejects all physical stages. OwnerEntry.Run itself refuses before any prompt
  or native access because CoordinatorReady=false. Keeping these gates closed
  is intentional, not evidence that a usable physical command is available.
- Next implement/review the bounded external input loader and non-redirected
  console launcher, controller/role dispatch, and exact package invocation as
  one activation connection. Do not reuse the diagnostic wrapper's redirected
  stdin/stdout launch for live owner confirmation or just flip the ready flag.
- Native private bootstrap completion, reservation ACL/flush/readback, real
  lifecycle observation and restart/durability remain untested in this pilot.
  Separately reviewed kit/host/individual stage permission remains required.

1008 managed cases, including54 selection/effects/gate cases, pass. These cover
missing/wrong SID/hash, mismatched account, altered digest casing/trailing input,
redirected streams, expiry, empty inputs, invalid stage and early entry refusal.
All three stages have positive selection fixtures but no live confirmation.
Package/source/archive verification is recorded in the
[foundation evidence](../experiments/LICENSING_PILOT_FOUNDATION.md).
Physical0/5 and independent/native/durable/security/production gates unchanged.

## External connection addendum: CHG0148 / EV0217

2026-10-13; baseline c0a9e01. The external-dispatch implementation gap described
above is now source-implemented, still gated and not physically accepted.
Main connects the exact service registration command, child command and local
controller stage/context/input command to existing role/owner composition.
Unknown shapes refuse. CoordinatorReady=false rejects before parsing/file/native
work. The internal dispatch repeats this gate to prevent bypass by direct callers.

External loader accepts canonical drive-local paths below260 characters; rejects
UNC/device/relative/traversal/ADS/wildcards/control/quote/trailing-space-or-dot
and reserved device components. Same-handle plain-file/final-path checks surround
bounded open-existing reads with sharing that denies writes/deletes. No protected
ACL authority is inferred from these external bytes; the live owner's separately
selected context pin binds them later. Prepare verifies and freezes its declared
app-local package, capped512MiB. Input/context files are capped2MiB each.

PowerShell launcher retains its default false physical gate. The source branch
uses Package mode and existing complete provenance/package verification, then
inherits all three console streams, sanitizes runtime override environment and
waits for the exact package EXE. No RunAs, injected owner choice or stdin piping.
OwnerContextPath/InputPath are only untrusted file locations, not approval pins.
Current diagnostic metadata is unchanged and cannot authorize physical execution.

| Updated source | SHA256 |
| --- | --- |
| Program.cs | 72dfe4f8d20633cd91427b80bb92b2a20cb39d2430fe57422b901c573702cca2 |
| SecureFiles.cs | ee4c0946f3781278571da1662260d7bb39378673022eac041376624dafb45f4b |
| Run-Pilot.ps1 | 10f62906d995b7c9b954940ac9ea307d6c43c544c3b46cebdcecbeacf40cf740 |

1044 managed cases include36 command/path/gate cases. Native external handle
reads and inherited-console interaction are NOT_RUN. Package build repeats exact
source/archive/refusal checks, not a physical launcher success test. This is an
author review; no independent acceptance is created. Remaining activation work:
review exact build/host and real input preparation, reconcile activation metadata
and preview flags with permitted stage scope, and obtain individual physical
permission. The two false gates must not be treated as the only remaining safety
condition. Physical0/5 and all acceptance gates stay unchanged.

## Readiness findings and real-host drafts: CHG0149 / EV0218

2026-10-13; baseline1603497. Read-only InspectHost through the bound package
wrapper reports Windows build22000/workstation/X64, app-local runtime10.0.11.
whoami reports the expected owner SID ending1001. Each exact Setup/Guardian/App
SCM query returns1060 (not installed); sc.exe showsid reports the deterministic
SID and Inactive. NTAccount.Translate fails for all three absent service accounts.
Root Test-Path returns false; this preliminary check is not the stronger native
absence proof required at actual bootstrap.

READINESS-R01: Bootstrap previously demanded successful account translation
before registering the accounts. This blocks the first installation on this
host. SOURCE_CORRECTED: fixed-name SHA1/UTF16LE service SID derivation is used
only before registration. SHA1 here is Windows namespace compatibility, not a
new cryptographic trust hash. Three numeric vectors match the independent sc.exe
showsid output. NativeTokens.Sid still requires actual account translation after
registration and additionally compares it with the derived value; role tokens
remain independently checked. Unknown lookup errors never establish absence.
[Microsoft's service isolation guidance](https://support.microsoft.com/en-us/servicing/os/windows/2009/04/ms09-012-description-of-the-security-update-for-windows-service-isolation-april-2009)
describes service SIDs as a hash of the service name and the sc.exe showsid query.
1052 managed cases (1044+8), not a native bootstrap success claim.

READINESS-R02: current kit remains explicitly inert. Activation flags, preview
semantics and provenance still describe disabled physical execution. Review these
together with exact stage permission; no flag was enabled during this work.
Author source/package review does not create independent or security acceptance.

READINESS-R03: real input preparation must not invent owner approval. New review
generator verifies pinned package/delivery/archive/source, calls only InspectHost
and sc.exe showsid, then writes a unique out review directory with profile draft,
Prepare plan draft, host observation, review status and SHA256 manifest. All
actual package/source/host/boot/service bindings are populated, fresh experiment/
run IDs are generated, but ownerAuthorized/builtKitReviewed/profile approved are
false. No decision, context approval or validity window is generated. The exact
draft is rejected by the compiled read-only controller validator as expected.
Profile is explicitly a review draft, not an already adopted runtime policy.

Next review these concrete profile/plan drafts and activation semantics, prepare
the exact permitted kit and request individual Prepare approval. Regenerate or
rebind after boot/package changes; never convert flags automatically. Generated
review material is not committed; durable hashes and paths are in foundation.

## Concrete draft review and activation work package: CHG0150 / EV0219

2026-10-13; clean baseline b809e1c. This completes the pending **author review of
the EV0218 concrete drafts**, not physical permission or independent acceptance.
No new document family or successor contract is introduced.

### Reviewed inputs and result

The exact review directory is
`out/lic008-prepare-review-eb3bf2769427c56d2831469ecc9a7fa8`; manifest SHA256
`ecbcd7405e8445e3438d7d0a4188594f0fec967b137c731950d45a84b195079f`.
All four file digests match. Plan SHA256 is
`76c923e33becf23aa5473e722320bc43bb72be344a8675284b831e20a30aaf38`;
profile SHA256 is
`41bc19b70d5353ea79998f719a1a69c9356ba769092da5c8d30f3befa4c83f99`.
The candidate and its provenance pins remain exactly EV0218's.

- [x] All source-manifest rows still match repository bytes; all194 package
  files match declared lengths/hashes and the plan's ordered inventory.
- [x] Source/provenance/kit/package/dependency/profile bindings match actual bytes.
- [x] Read-only compiled InspectHost confirms the same host and boot as EV0218.
  This does not refresh native root/service absence or authenticate the owner.
- [x] Prepare has exactly setup-create, guardian-prepare, setup-publish,
  app-prepare, child-prepare; six distinct experiment/run IDs and empty history.
- [x] Profile provider/RSA3072/export-policy0/decryption-only values agree with
  Program.Provider and KeyOperations.Create/Verify. Runtime10.0.11 agrees with
  host admission. Windows10/11-x64 is the target, not a completed platform matrix.
- [x] No approval, owner context or approval window exists; draft flags stay false.

244 read-only assertions passed in an in-memory audit, including194 package-file
checks. These are consistency checks, **not244 new runtime/security test cases**.
The previously built1052 managed tests were not rerun in this documentation-only
step. No SCM/KSP/ACL writes, live consent prompt or protected state access occurred.

ProfileSha256 is an opaque review/context binding in runtime admission; runtime
does not parse profile-review.json or enforce its approved field. Actual key
parameters are hard-coded and independently checked on reopen. Therefore this
draft is not a configurable cryptographic policy or an approval issuer. A final
profile or approval-status edit changes its digest and requires new plan/input
bindings; never flip approved=true and retain the old pin.

### Bounded activation implementation package (next work)

READINESS-R02 remains an implementation gap, not a request to approve this inert
binary. Resolve the following as **one source/build change**, then test/package it:

| Surface | Required activation consistency |
| --- | --- |
| Main/internal coordinator and Run-Pilot | Distinguish inert diagnostics from an explicitly built test-capable kit. Keep default inert; no environment/CLI bypass that merely overrides review. All live owner, reservation, native bootstrap and stage checks remain mandatory. |
| Builder, package/kit/delivery manifests and wrapper verifier | Describe and validate the same capability; the current wrapper requires physicalEntryEnabled=false. Never relabel old bytes or report an enabled build as physically tested. |
| Local confirmation preview | Replace the literal disabled capability preview only for the matching enabled build; show exact stage/effects and pins. Capability is not owner permission or production authority. |
| Build-time verification | Keep inert refusal coverage; add capability/metadata mismatch and invalid/missing-input refusal checks for the test-capable build without invoking valid privileged stages. Preserve all existing pure cases and archive/source custody checks. |
| Final review inputs | Rebuild first, then bind final package/profile/host/boot and separately reviewed owner context. Do not reuse EV0218's plan hashes after any source/package/profile change. |

This specifies preparation of a candidate, not permission to execute it. Do not
ask the owner to approve EV0218 as the future executable kit: activation changes
the assembly/source/provenance/inventory and therefore invalidates that binding.
Do not repeat the completed draft review unless its inputs change.

### Exact eventual Prepare decision, after final kit exists

The approval presented to the owner must identify the final kit/input/context
hashes, current host/boot, selected account SID and fresh experiment. Effects:
create only `C:\ProgramData\Ecs.Lic008.EntryEvidenceV1`, its fixed protected/public
test layout and copied test binaries; create the three exact Manual Setup,
Guardian and App registrations; execute the five Prepare actions above, including
two new experiment-owned test keys and fixture reports. No product Guardian,
customer data, backend or database operation is included.

On collision, unknown error or partial failure: retain evidence/state and stop;
no overwrite, automatic retry, cleanup or adoption of existing keys. Successful
Prepare retains its keys/state for review. VerifyFreshProcess and Finish each
need their own later approval; Finish's owned-key deletion is not authorized by
Prepare. No reboot or automatic stage continuation is requested here.

Decision status: concrete drafts AUTHOR_REVIEWED; enabled final kit NOT_BUILT;
owner Prepare permission NOT_REQUESTED/NOT_GRANTED for a final kit. Sole-human
owner arrangement is unchanged. Author review is not independent Security
acceptance. Physical0/5 and all native/durable/security/production gates unchanged.

## Activation candidate implemented: CHG0151 / EV0220

2026-10-13; baseline888d217. EV0219's bounded source/build package is implemented
and author-reviewed. Default compilation is inert; explicit builder TestCapable
defines TEST_CAPABLE_PILOT at compile time. No runtime flag/environment override.
The compiled capability is reported with its actual EXE/DLL digests and false
executionAuthorized/physicalTested/security/production fields. Wrapper verifies
provenance and inventory, then matches compiled capability before live dispatch.
Manifest, kit and delivery capability values derive from the same build choice.
Confirmation preview reports actual build capability without claiming acceptance.

SelfTest sets a private diagnostic guard for its entire invocation, so native
coordinator entry stays closed in both variants even from an interactive shell.
1053 managed cases PASS in each variant (1052 existing plus diagnostic-gate
assertion), including framework/app-local/kit/extracted reruns, not4212 unique
cases. Actual subprocess negatives cover malformed shapes, missing wrapper pins,
three valid controller shapes with redirected consoles, manifest/provenance
disagreement and consistently false capability metadata versus the actual binary.
No valid live stage or service/child role was invoked. Metadata-negative fixtures
are isolated under out; their deliberate repinning is test input, not approval.

Updated helper accepts either unaccepted build capability and emits only fresh
review drafts with false approval flags. New test-capable candidate and review
pins are in foundation EV0220. Older EV0218 input pins must not be reused.
Author review found no remaining blocker in this bounded capability connection;
native console/bootstrap/ACL/key/replay behavior remains untested. No independent
review or security assurance is inferred. READINESS-R02 SOURCE_IMPLEMENTED;
physical0/5 and all acceptance gates remain unchanged.

Next: finalize the concrete stage decision/context against the new kit/profile/
host/boot and obtain the owner's separate Prepare permission; do not rebuild
unchanged capability plumbing or rerun completed draft reviews as a new stage.
Permission is limited to Prepare's stated test effects, never automatic Fresh/
Finish. After any failure retain state and report, with no automatic rerun.
