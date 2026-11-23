# TEST_ONLY native pilot candidate

Latest: [adopted report successor0.4 binding](../guardian-readonly/REPORT_V04_BINDING.md)
completed; new inert package1807 cases PASS. Exact protocol pin changed to c2592068;
physical capability stays blocked pending built-kit review/separate authorization.
Historical packet0.3 notes below are not the current compiled binding.

Latest 2026-10-15: [identity/report schema2 integration](../guardian-readonly/IDENTITY_INTEGRATION.md)
is implemented in a NEW inert source candidate. Builder now refuses TestCapable
pending successor adoption/review. Historical schema39-field/capability notes
below do not describe the changed candidate. Original Prepare partially failed;
full physical acceptance0/5, not no physical execution.

Current checkpoint: CHG0151/EV0220, 2026-10-13. Default builds remain inert.
The builder's explicit `-TestCapable` switch compiles a separate experimental
artifact capable of the existing physical dispatch, not permission to execute
it. No environment or runtime CLI flag enables an inert executable. The wrapper
checks the pinned package and compiled `--inspect-capability` report; metadata
must agree. Every real stage still requires reviewed inputs and live owner
confirmation. This is not production Guardian or security acceptance.

SelfTest forces coordinator entry closed even in a test-capable build.1053 pure
cases pass in both variants; malformed command, redirected-console and metadata
mismatch refusal checks run without protected writes or native role execution.
Physical0/5 remains NOT_RUN. Historical implementation entries below retain their
dated scope; the current source/build state supersedes old unconditional-gate text.

Implemented candidate primitives:

- Closed bounded JSON/plan admission, fixed stage/run/package inventory rules.
- Read-only primary-token/default-owner/service-group measurement interfaces.
- Exact per-object owner/DACL rules, create-new descriptors and same-handle
  security/path/plain-file checks; no owner rewriting or privilege enabling.
- Single worker admission, bounded result acceptance and late-result suppression;
  a timed-out worker is awaited, never killed. A native hang remains unresolved.
- Software KSP RSA3072/decryption/export-policy/DACL/public-identity interfaces,
  OAEP-SHA256 + AES-GCM test-fixture codec, buffer clearing and export probes.
- Own-process service host interface, not connected to an execution route.
- RoleActions now implements setup-create, guardian-prepare and setup-publish:
  private ownership records before/after key creation, fixture staging, verified
  copy-new System-owned publication/readback. Failure stops subsequent actions,
  retains partial state and never retries/adopts/deletes.
- ReportEmitter has the packet's closed39-field report and bounded fixed-result
  schema. Actual role entry would capture token/default owner, boot-time digest,
  executor/assembly and independent plan/package context. These native paths
  are not connected to Main and have NOT been exercised. UNKNOWN results carry
  no post-operation identity-match claim; reporting failure retains state.
- App/Child Prepare actions now probe the restricted key (BAD_KEYSET is only
  OBSERVED, successful open is FAIL, other status UNKNOWN), then decrypt the
  public app-readable control without private ownership/staging reads. Parent
  starts the pinned executable directly, no shell/runas/credentials, with child-
  only runtime/profiler override removal. Child self-admission/report interfaces
  and parent matching of PID/token/plan/boot/artifact/result context are coded.
  On timeout the parent waits for real child exit, never kills/retries/elevates.
  This path remains disconnected from Main; no real child has been tested yet.
- Fresh Guardian reopens retained published fixtures using the same owned keys
  and tests in-memory mutations/private-export refusal; fresh App/Child use
  independent identity/report admission and stage-specific IDs.
- Finish verifies BOTH owned chains/policies/fixtures before deletion. One NEW
  Setup report handle flushes each deletion intent/disposition before proceeding.
  Only two exact owned keys may be deleted, never files/services. Failure blocks
  the next deletion. Uncertain/crash state is retained, never blindly resumed.
  Final success requires postchecks and all three result IDs. Guardian absence
  records raw open observations, NOT proven absence; the future controller must
  correlate exact Setup deletion evidence before case acceptance.

Build: `powershell.exe -NoProfile -ExecutionPolicy Bypass -File
scripts/build-license-adapter-pilot.ps1` from the repository root. This freezes
the explicit inputs/compiler/references, compiles warnings-as-errors with cached
SDK10.0.400/runtime10.0.11, runs managed-only tests and three physical-entry
refusals, then records source/artifact/executor bindings under ignored `out/`.
No network restore, service registration, token operation, CNG call or ACL
change is invoked. This build is framework-dependent, NOT the final self-contained
package/kit/archive custody graph. The executor digest is dotnet.exe, not an
apphost or the future actual-child emitter.

All ten action bodies are now candidate source, not physical test results.
StageController (in PlanAdmission.cs) now validates canonical approved plan
digests, exact ordered report sets, measured-receipt input context, three exact
Stopped/Manual/PID0 service receipts/SIDs, process lifetimes and parent/child
nesting, cross-stage history and unchanged context/shared hashes. Its receipts
are inert inputs today; the native collector must independently measure them,
never copy them from report claims. Finish correlates the full Setup deletion
report with Guardian observations, not raw BAD_KEYSET alone. Checkpoints remain
in-memory candidate values, not protected durable evidence or Security approval.
The frozen pilot-kit/Run-Pilot.ps1 accepts only a provenance-pinned SelfTest;
all three physical stages refuse before any file/token/service inspection.
Still required before physical execution: reviewed role/child dispatch and full
report/context integration, the
Prepare/VerifyFreshProcess/Finish controller and bootstrap/collision admission,
actual same-primary-token child with independent artifact/report measurements,
measured boot/context and checkpoint/report validation, reviewed cleanup progress,
complete self-contained kit/provenance/archive bindings, consolidated built-kit
review and separate owner permission for each physical stage. Generic BAD_KEYSET
is not proof of absence or authorized denial. Existing protected experiments
must not be reused or cleaned up by this candidate.

Pure tests prove managed rules only; they do not prove Windows token-owner/ACL,
service timing, native cryptographic operation, restart behavior or security.
No LIC008/REM/FEP/NE/native/production acceptance is established.

ControllerWindows now supplies DISCONNECTED native readback interfaces: exact
three-service registration queries (only SCM1060 is missing; access denied and
marked-for-delete are unknown), bounded SCM config/status reads, fixed own-process
Manual executable/account/dependency admission and actual service SID lookup.
Protected reports and the exact five shared files are read through SecureFiles;
shared digest binds ordered name/size/hash. Canonical previous checkpoints require
their independently supplied raw hash. PersistValidated re-reads reports/services/
shared/previous checkpoint, validates the stage, creates a NEW Admin-owned protected
checkpoint, flushes and verifies readback. Partial/corrupt output is retained,
never overwritten or blindly resumed; this is not power-loss-atomic storage.
No interface has been invoked natively. The candidate retained-handle observer
below adds independent child discovery/token measurement; it is not yet connected
to actual execution. SCM stopped snapshots do not prove an earlier process identity/lifetime. Root/key
collision bootstrap, service creation/dispatch, complete custody and review remain
unfinished. 265 managed cases and six physical-entry refusals pass; physical0/5.

ProcessObserver now attaches only to a live PID obtained from exact service SCM
status before/after attachment, with creation time newer than a caller-measured
launch boundary. It retains one non-inheritable QUERY_INFORMATION/SYNCHRONIZE
handle, queries full image path/native creation time/parent and primary token
user/default-owner/type/elevation/service-group attributes while alive. Child
discovery uses a bounded Toolhelp snapshot, exactly one App child, retained child
handle and native parent/creation/token checks; never a report-provided PID.
Completion requires a signaled handle, native exit time and zero exit code.
Live observer disposal refuses; no kill, suspension, credentials, privilege
enablement, ACL changes or retry. Failure admission closes query handles only,
never terminates a process. PersistValidated now takes observer instances with
private constructors, calls Complete and matches observations to every report
before StageController validation; manufactured DTOs are only managed fixtures.

This is still disconnected candidate code, not measured Windows evidence. A
short-lived child/service missed before capture, unavailable Nt query, denied
cross-account token access or ambiguous parent set blocks progress; controller
must not infer success or enable SeDebugPrivilege. Timing/dispatch integration
must arrange live observation and retain handles on timeout; no capture handshake
or watcher loop is implemented yet. A token snapshot does not prove identity at
every instant, and native parent metadata is not an anti-spoof/security guarantee.
Image path is not proof of the loaded DLL bytes: existing package/report checks
and complete custody remain necessary.316 managed cases/six entry refusals PASS;
no native observer operation. Next safe bootstrap plus reviewed coordination/
dispatch, self-contained custody and consolidated built-kit review. Physical0/5.

BootstrapAdmission now provides a disconnected READ_ONLY collision preflight:
fixed root OPEN_EXISTING/reparse-aware probe (only error2 with plain ancestors
is absent; other failures unknown), three exact SCM registration probes and two
exact machine/SILENT Software-KSP key opens, without enumeration or mutation.
Root/service presence refuses immediately. Successful key open is PRESENT;
every failing key open, including BAD_KEYSET, is UNKNOWN. RequireClear deliberately
cannot authorize mutation under this current raw-status policy; a caller cannot
forge an ABSENT classification to bypass it. This reveals a contract blocker,
not completed bootstrap. Current specification demands two proven absent key
names BEFORE any write, but the allowed probe lacks an admitted unambiguous
absence result in this context. No service registration/create/copy/start route
or observer coordination added. Need an owner-approved narrow specification
correction/review before these mutations, not an UNKNOWN override.344 managed
cases/six entry refusals PASS; no preflight native method executed. Physical0/5.

Current successor integration (EV0202): legacy Admit/RequireClear still refuses
and retains raw-open UNKNOWN behavior. Distinct AdmitSuccessor requires exact
compiled successor packet digest/canonical approved Prepare plan, then native
token/runtime/boot/plain root/three registration absence checks ONLY. No negative
key-open inference or catch/override of legacy refusal; no create/register/start
code yet and Main/kit remain closed. This is candidate preflight, not host/custody
or physical execution acceptance.

Setup now verifies the newly finalized handle, opens that exact persisted name
with original machine/SILENT provider options, independently checks policy/DACL/
public identity and compares it BEFORE writing owned record/next label. Any
exception retains state and original Step blocks later work; no handle-only
fallback, adoption, deletion or retry. V03-I01 is source-corrected, NOT physically
verified or an independent finding closure. Exact create32/finalize64 guards
exclude overwrite/legacy-copy/validation bypass. Managed ordered-readback and
failure tests do not prove native persistence behavior.

Builder freezes/pins original+successor packets, all three specs, author review,
adoption and foundation policy alongside codec; provenance records those pins.
Pure runner emits compiled successor digest and builder requires exact match.
371 unique managed cases (344+27), six entry refusals and pinned wrapper PASS;
same wrapper cases are not additional371 tests. No native operation. Still need
public directory/package/plan/service creation, live capture/role dispatch,
self-contained custody and consolidated review/authority before physical0/5.

EV0203 public bootstrap/registration candidate: CreatePublicAndRegister freezes
canonical plan and cloned package bytes, checks exact ordered names/sizes/digests
(aggregate512MiB ceiling), successor admission and pre-registration G/P SID
lookup, then creates only seven Controller-owned public directories. Protected
package/Prepare plan/admission writes are create-new/flush/readback; Setup's
private directories remain its responsibility. A pre-registration lookup failure
refuses before any write; no SID guessing or permission expansion.

RegisterAllNew uses CreateService only for three exact own-process Manual names
with fixed quoted apphost/role, Setup LocalSystem or exact virtual accounts.
Query/change-config rights only, no start/stop/delete permission requested. Only
new handles receive unrestricted service SID configuration. Exact stopped/PID0/
Manual/basic config and SID lookup are read back, plus no failure actions/command,
failure flag/delayed start/trigger and normal error control. Any partial failure
throws and retains state; no rollback/adopt/reconfigure old service/key operation.
No native method executed; Main/kit still refuses physical entry. Bootstrap is
not full orchestration: host/custody admission, actual role dispatch, live observer
capture coordination and self-contained reviewed kit still required.396 managed
cases (371+25)/six physical-entry refusals/wrapper PASS; physical0/5 unchanged.

EV0204 ordered dispatch/capture candidate: ServiceHost.RunRole validates exact
SCM service/action/approved-plan arguments and DispatchChild validates the fixed
child command shape; neither is routed from Main. Controller RunOrderedStage
freezes the plan, checks prior protected checkpoint/context/shared hashes, refuses
existing/unknown report paths, and uses OrderedActions to advance only after
real process completion, stopped service checks and per-action report/token
validation. StartService is attempted once per consumed RunId, polling only
StartPending/Running for live observer capture. No overlapping retained live
observer or active action can start another service. No stop/kill/delete/retry.

App child discovery polls read-only snapshots until one live child is captured;
zero current candidates is NOT absence/success. Missed/extra/expired child refuses.
Observers strongly retained on unknown; per-action native report context and
token/parent checks must pass before progression, full stage validation and
protected checkpoint persistence follow. Failure blocks all further launches in
that controller process. Existing reports also prevent restart-based replay.

Conservative capture5000ms and action-observation/validation10000ms elapsed guards
reject late results even after exit; these do not cancel a blocking Windows API,
guarantee short-lived capture or prove native timing behavior. No readiness
handshake added; fast service/child or access-denied can make a run incomplete.
This interface alone cannot authorize physical use.481 unique managed cases
(396+85), six physical-entry refusals and bound wrapper PASS; no native calls.
Still need self-contained apphost/runtime package/closed custody and reviewed
Main/kit activation/host binding/independent-review authority. Main/kit remain
disabled; no actual role/child/SCM/crypto run or physical/security acceptance.

EV0205 packaging: builder generates gated self-contained win-x64 app-local host/
runtime10.0.11 using cached SDK10.0.400, without MSBuild/network restore. Generated
host-helper source is embedded in frozen builder and retained in host-tool output,
not a new repo runtime source.194 closed package files/234 kit+ZIP entries checked.
Compiler/reference snapshots remain retained out, not all distributed in ZIP.
Run-Pilot Mode=Package admits only externally pinned SelfTest, validates every
package file and executes local apphost with child runtime/profiler overrides
removed. Observed EXE/DLL/runtime/local CoreLib and kit/extracted SelfTests PASS,
same481 cases, not new cases. Physical modes and wrong provenance pin refuse.
External delivery provenance binds manifest/archive without a self-hash cycle.
No clean-machine/absent-dotnet/host-token or native-role tests. Next actual host
binding and reviewed Main/controller activation plus built-kit/authority checks;
physical0/5 and all security gates remain open.

EV0206 host admission: existing NativeTokens source now contains closed typed
HostSnapshot/HostAdmission. Read-only RtlGetVersion + Registry64 MachineGuid read,
hashed canonical GUID only (raw GUID never emitted), OS/runtime/architecture
profile digest. Workstation major10/minor0/build>=10240, OS+processX64/runtime10.0.11;
no Microsoft lifecycle/patch-date condition or Windows fleet acceptance. This is
machine/profile correlation, not hardware identity/anti-clone/admin attestation.
Registry GUID can be duplicated/changed; unavailable/invalid/denied reads refuse
without SID/privilege/registry changes or fallback fingerprint.

Bootstrap/role admission/ordered starts/post-success context compare independently
captured host to approved plan hash; boot identity is checked separately. Main
adds ONLY exact --inspect-host, wrapper ONLY Package InspectHost after package/
provenance validation. Both are read-only diagnostics, not approval/activation;
all service/child/controller physical commands still refuse.501 managed cases
(481+20), kit/extraction PASS. One actual OS/registry/boot inspection on current
host succeeded (not a token/SCM/KSP/ACL operation), owner/security approved false,
physical0/5. Next reviewed Main/controller admission/activation and full built-kit/
review-authority checks before separately permitted stages.

EV0207 controller intake candidate: ControllerBinding holds separately supplied
expected stage/experiment/plan/packet, host/boot, source/package/kit/provenance/
profile and previous-checkpoint/evidence pins. Validate snapshots bounded bytes,
requires exact raw hash and canonical closed PilotPlan, then compares every pin.
Both public bootstrap and ordered-stage candidate APIs now require this binding
before any native access. ReadProtected is an unrouted read-only existing-plan
loader with controller token, protected file, current SID/boot/host and package
checks; pre-bootstrap external intake is not implemented by that loader.
Bindings are NOT authenticated authorization tickets and their callers are not
yet reviewed/activated. OwnerAuthorized/BuiltKitReviewed booleans alone cannot
satisfy this boundary, nor does a binding establish independent review. Main and
wrapper remain closed to physical commands. 60 additional managed cases cover
all three stages; physical execution/review/authority remain separate gates.
EV0208 external diagnostic intake: closed ControllerInput(schemaVersion1,
scope TEST_ONLY_CONTROLLER_INPUT_V1,plan,binding); separately supplied SHA256
binds the entire input before parsing. Unknown/duplicate members, wrong scope,
oversized/empty input and substituted/inconsistent pins refuse. Exact command
--validate-controller-input <inputSha256> reads at most2MiB of UTF-8 JSON from
stdin until EOF, validates plan/binding and emits a minimal diagnostic. It hashes
its own artifacts but does not inspect protected plans, live host/token/services
or keys. Package wrapper ValidateInput requires absolute InputPath, separate
ExpectedInputSha256 plus existing independently trusted package provenance pin;
bounded file snapshot is sent as raw bytes, not shell arguments.
Input success explicitly reports liveContextValidated/executionAuthorized/
physicalEntryEnabled/ownerApproved/securityAccepted/productionAccepted=false.
Synthetic fixtures contain illustrative plan flags, not real owner approvals.
External hashes cannot authenticate a signer; exact binding authority, replay/
consumption and reviewed physical activation remain unfinished. Direct stdin
waits for EOF (no deadline guarantee); no physical mutation route was enabled.
EV0209 owner-decision connection candidate: OwnerAdmissionInput(input,decision)
contains closed OwnerStageDecision schema1/scope TEST_ONLY_OWNER_STAGE_DECISION_V1,
decisionId,ownerSid,decision=APPROVE_TEST_STAGE,canonical controllerInputSha256,
bindingSha256,stage,experimentId,issuedUtc/expiresUtc and false security/production
flags. A separately supplied canonical decision digest and expected account SID
must match; all input/binding/stage pins and UTC validity (maximum24h) checked.
This is a local wall-clock safety bound, NOT trusted security-time validation.
OwnerAdmission has a private constructor and snapshots the admitted plan. Its
process-local decision-ID reservation happens before native operations. Prepare
requires BeginBootstrap -> actual complete-registration readback -> same-object
stage consumption; partial bootstrap cannot continue. Fresh/Finish consume once
directly. A new object with an already used ID cannot bypass the process journal;
restart/durable replay protection is NOT implemented. Other low-level helpers
remain candidates; these changes cannot make arbitrary internal callers trusted.
Main exact --validate-owner-input <canonicalDecisionSha256> <expectedOwnerSid>
and Package ValidateOwnerInput wrapper are diagnostic only; no consumption or
live owner-token inspection. Output explicitly ownerRecordMatched=true but
ownerIdentityAuthenticated/ownerApproved/executionAuthorized=false. Neither the
digest nor SID proves the issuer's identity. All physical entries stay disabled.
EV0210 bounded author review/correction: NativeTokens.MatchControllerOwner checks
exact actual primary controller user SID against the owner decision, in addition
to default Administrators owner/type1/elevation1/controller shape. Capture rejects
impersonation. Bootstrap and ordered-stage roots call this before reserving the
decision; coordinator repeats it before every ordered service action. Eleven
managed match/refusal cases,688 total. Native capture on these lanes NOT_RUN;
diagnostic commands unchanged, still no owner-token authentication claim.
Matching the actual executor is not authenticating an old decision's issuer.
Restart consumption and authority producer remain open; additional journal paths
need an adopted/bound contract change, not a permissive SecureFiles fallback.
EV0218 readiness: exact-service account translation fails before registration on
the inspected host. Bootstrap now derives only the three fixed-name service SIDs;
after registration actual account translation and token identity still must match.
1052 managed cases include eight derivation/vector/refusal checks. The separate
scripts/prepare-license-pilot-review.mjs tool creates real-host plan/profile review
drafts in out after exact package/source checks; no approval decision/context,
protected state or service is created. Draft flags remain false and runtime
diagnostics reject it. Activation/input review and exact kit permission remain.

EV0217 external connection: Main has exact gated --controller <stage> <context>
<input>, --service <role>, and --child Child <action> <planHash> dispatch. Local
canonical input paths only; two-MiB snapshots use open-existing/no-reparse,
read-only sharing and same-handle final-path/kind checks. Prepare's package is
bounded512MiB and captured from the current app-local manifest. Run-Pilot has an
inherited-console branch after package checks; no redirected consent or UAC.
1044 managed cases (1008+36). CoordinatorReady=false and wrapper physicalEnabled
false still refuse before native reads/launch. Next exact activation readiness
review and real input preparation before separately permitted physical Prepare.

EV0216 internal owner entry: direct console selection of separately reviewed SID/
context hash precedes existing input validation and live confirmation. No defaults
from request/CLI/environment. Stage effects are previewed. Prepare freezes the
package/preflights before confirmation; Fresh/Finish preflight retained protected
package/service/history/shared state, reserve and publish the current plan with
CreateNew/readback before dispatch.1008 managed cases (954+54). OwnerEntry.Run
refuses before any prompt/native access while CoordinatorReady=false. Main and
wrapper remain unchanged/closed. External input loader, non-redirected launcher
and controller/service/child dispatch connection still require implementation/
review before separately permitted physical stages. No actual owner prompt ran.

EV0215 coordinator connection: BootstrapAdmission.Completion.CreatePublicAndRegister
takes ConfirmedOwnerStage. Root/controller alone precede reservation; copy and
registration follow verified reservation. Private Completion is produced only
after native RegisterAllNew/readback and binds the exact owner object/reservation.
OwnerAdmission no longer accepts service DTOs as bootstrap completion. Ordered
stage takes the same private reservation, begins once and rechecks live owner,
host/boot/package/window and protected current/prior records before each launch.
954 managed cases; no native completion/reservation/launch ran. Trusted context
entry integration and bounded source/kit review remain; all physical gates closed.

EV0214 predecessor validation: OwnerReservation.Create now reads every earlier
fixed slot, protected plan, checkpoint and exact report set before writing its
slot. Checks canonical bytes, same owner/experiment/context/package, unique
decision IDs, context/challenge pins, ordered completion, report digests and
current plan chain tip.927 managed cases (877+50); historical correlation does
not reconstruct live consent or native process observations. No native execution.
Bootstrap ordering, private proof handoff, registration provenance and trusted
entry integration remain pending; CoordinatorReady and Main/wrapper stay closed.

EV0213 successor0.3 journal/confirmation primitives: compiled packet pin switches
to adopted44ede8aa..., builder binds14 protocol inputs (including preserved old
contracts). Only the three exact owner consumed-slot rules are added. Required
OwnerContext/OwnerConsumed JSON fields, canonical context/readback, stage/pin/
UTC checks and exact challenge/console restrictions implemented. ConfirmedOwnerStage
has a private constructor, produced only after live primary-owner/host/boot/full
app-local package checks, real console response and repeat checks. No diagnostic
can construct it. Trusted external expected-context pin remains a future entry
configuration responsibility; supplying arbitrary CLI hashes is not authenticated
configuration.
OwnerReservation private proof follows only actual CreateNew/protected-descriptor/
zero-sharing write, Flush(true), close and independent protected readback with
retained parent-directory protection checks. Failed write attempt cannot reuse
the same confirmed proof; no overwrite/delete/repair/resume. Stage-wide file
collision naturally blocks different decision IDs. Existing slots/partial writes
are not accepted as absence or reconstructed as live proof.
877 managed cases (688+189), including all27 missing consumed fields at each
stage, exact owner contexts/challenge/ACLs/readbacks and managed dictionary/
concurrent-map restart/race models. These models do not exercise real disk,
process restart, native ACL/flush or power-loss durability. Console and reservation
APIs NOT_RUN. Main/wrapper physical modes still refuse; bootstrap/ordered-stage
roots additionally require CoordinatorReady=false. Remaining prior-slot/completed
chain checks, private bootstrap provenance, live reservation handoff and trusted
owner-context entry configuration must be integrated/reviewed before that gate
can be changed. No actual owner approval/slot creation happened in this step.
