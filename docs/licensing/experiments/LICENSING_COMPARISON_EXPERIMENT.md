# LIC008 creator/protector comparison — 0.4.0

2026-09-19. User explicitly authorized the test-only SYSTEM creator comparison,
then the user-scoped protection comparison **only if the first is acceptable**.
This is an experiment under LIC008, not approval of a production policy change.
Master section5 and LIC-OPEN-003/012 remain binding until separately resolved.

## Mutation scope reviewed before execution

- Fresh fixed namespace `%ProgramData%/Ecs.Lic008.ComparisonV1`; refuse existing
  root or Guardian/App/Setup service names. Never modify retained Spike or
  ProvisioningV1 installations, global Crypto directory ACLs, TPM, BIOS or DB.
- `Ecs.Lic008.ComparisonV1.Setup`: temporary Manual LocalSystem SCM service.
  Actual SYSTEM user plus its enabled, non-deny-only service SID is required.
  It accepts only create, a valid fresh run ID and matching executable digest
  from the fixed admin/SYSTEM-writable plan. No arbitrary path/provider/command,
  secret return, production key or App-triggerable provisioning endpoint.
- Key name: `Ecs.Lic008.ComparisonV1.TEST_ONLY.software.<run-id>`. Same native
  Software P-256/machine/signing/non-exportable/pre-finalize SYSTEM+Guardian DACL
  recipe as0.3.0. No overwrite or provider fallback. Fresh namespace and Guardian
  SID necessarily differ; this is not a byte-identical prior-identity replay.
- SYSTEM records intent before creation and public ownership after finalization;
  incomplete handoff is retained. It creates a random protected-file canary and
  publishes only public test identity. No DPAPI experiment runs in Setup.
- The helper has the existing100-second process deadline. The controller verifies
  exact stopped configuration and deletes only that helper before any Guardian
  test. Failed/unknown removal blocks further work. It does not delete an unknown
  key or either previous installation. Guardian/App and reports remain retained.
- Guardian/App are separate virtual accounts. Directory ACLs mirror the isolated
  baseline. The controller binds every report to role, run, action and executable
  digest. Package hashes are integrity evidence, not production signing.

The helper uses a fixed local protected test plan, not the product's future signed
challenge-bound IPC. This scoped unsigned test helper does not satisfy LIC6.4 Setup
acceptance. App has no plan write access and cannot select helper operations.

## Experiment1 acceptance before experiment2

Require Setup creation PASS and confirmed helper removal. Then require two new
Guardian/App process rounds, both with Guardian reopen/public-identity match,
signature verification, exact DACL/policy checks and private-export refusal;
App and actual child must receive explicit denial for the same key and protected
file read/write. Child identity/execution must pass. Missing, duplicate, ambiguous
or skipped required results block experiment2. Process restart is not reboot.

An error yields a retained comparison report with `keyExperimentPassed=false`
and protection NOT_RUN. No automatic rerun, security weakening or alternate
provider is allowed to turn a failed prerequisite into success.

## Conditional experiment2

Only the explicit `-ContinueProtection` controller switch and both accepted key
rounds permit a plan with `KeyExperimentAccepted=true`. Guardian then uses the
fixed test-only `LOCAL=user` DPAPI-NG descriptor, fresh secret and fresh ciphertext.
The SID descriptor remains the production baseline; no fallback is inserted into
it. App/child can read the ciphertext and must fail cryptographic decryption.
Guardian must decrypt and compare successfully both immediately and in a fresh
service process. No secret is printed or persisted in plaintext.

Final protection result distinguishes NOT_RUN, FAILED_OR_INCOMPLETE and
PASS_BOUNDED_PROCESS_RESTART_ONLY. Even success leaves reboot, ordinary-user,
profile-loss, repair/reinstall, clone limits, TPM and production Store acceptance
open. It supports a design decision; it is not that decision.

Build: `scripts/build-license-windows-comparison.ps1`, exact SDK10.0.400 and
self-contained runtime10.0.11. Sources in `licensing/windows-spike/comparison/`
link the reviewed native creation, token and worker-host helpers from provisioning.
Guard tests include both positive acceptance contracts and removal/corruption of
each required result, wrong identity, namespace and unapproved protect-plan refusal.

## Physical result: first comparison incomplete; second NOT_RUN

Current host, 2026-09-19, OS10.0.22000.0/runtime10.0.11. Executed archive
`out/lic008-comparison-aef58f176bf041bb9a12adc84c5405e4/licensing-windows-comparison-0.4.0.zip`,
SHA256 `61153b850c5543b24ba4f06d0b82fb0d7fac6aced797a2c9344785a071bc9970`.
Executable SHA256 `3da09fd848d52f539c9419406e01b7163d2eeed96f4956d46e264d38481567fd`.

Initial installation stopped before any key operation: the controller loop created
only Guardian/App although validation required Setup too. Source loop corrected
to include all three roles. The original package and failure log were retained.
An exact-hash-pinned continuation verified the partial installation, absent plan,
empty role report directories and exact stopped service identities, then created
only the missing Setup helper and executed the original controller's remaining
steps. This was not a second key attempt or a replacement of installed binaries.
Continuation source and both execution logs are retained beside the archive.

Setup run `0d26c5c6d100431b88f6bbf5ecb31956` verified SYSTEM identity and enabled
service SID. Native creation, non-exportable/signing property setting, pre-finalize
DACL setting, **finalization**, opening the finalized handle, public identity,
signing and signature verification all passed. Protected-DACL flag passed.
The composite result failed at **check-ace-rights**, with
`InvalidDataException:0x80131501`. The check requires every returned ACE mask to
equal `0x10000000`; the report did not record actual masks. Whether the mismatch
is provider normalization or an incorrect effective permission remains unproven.
Do not interpret the controller's original generic "creation failed" text as a
native-finalization failure, or this partial success as accepted isolation.

The public handoff record was not published after that failed assertion. Subsequent
reopen reported missing public record and private export was skipped. Guardian/App
rounds and both protection rounds did not run. Summary has
`keyExperimentPassed=false`, `protectionExperiment=NOT_RUN`.

Summary: `out/lic008-comparison-aef58f176bf041bb9a12adc84c5405e4/comparison-ef7a585c2de64b23a7641ccbd4e42170.json`,
SHA256 `a48147a085f0b872f99befE60a600725943c9daafb9603245cbfe9ea45a548db`
(hexadecimal comparison is case insensitive).
Setup was stopped and deleted; all six retained Guardian/App services are
Stopped/Manual. The new key, intent and ownership records remain retained.
No global Crypto ACL, TPM, previous installation or production policy was changed.

Validation: pure guards38/38, controller/package guards49/49 and an additional
inert bootstrap regression pass. That regression first failed because its dynamic
script had an empty PSScriptRoot; the mock now supplies a fixed inert path.
Corrected controller source is tested but the executed0.4.0 archive is deliberately
unchanged and superseded for new installations. No independent acceptance review
or LIC006 repeat was performed.

Next: collect only the retained owned test key's returned DACL/ACE metadata, then
determine whether the rights check is wrong or the actual ACL is wrong. Do not
relax acceptance or rerun creation merely to bypass this failure. Only after valid
Guardian and App/child isolation rounds may the user-authorized conditional
LOCAL=user comparison proceed. LIC008 and LIC-OPEN-003/012 remain open.

## Retained-key metadata diagnosis (EV0101)

2026-09-19: the fixed-key reader in
`licensing/windows-spike/comparison-diagnostics/Program.cs` opened only the
retained software key from run0d26c5c6d100431b88f6bbf5ecb31956 and matched its
public SPKI digest to the protected ownership record before reading its DACL.
It contains no key creation, property write, signing, private export or deletion.
It ran through a temporary Manual SYSTEM service
`Ecs.Lic008.ComparisonV1.Metadata`, removed after the reader stopped. A new
admin/SYSTEM-only metadata binary directory and report were written; neither
key permissions nor the existing six stopped services were modified.

Observed DACL: protected, exactly two AccessAllowed ACEs, no inheritance flags
or callback data: SYSTEM and the exact ComparisonV1.Guardian SID. Both masks are
**0xD01F01FF**, while the original validator at `check-ace-rights` requires exact
equality with **0x10000000**. Replaying that expression on both reported masks
returns false; checking for the GENERIC_ALL bit returns true. The extra bits are
0xC01F01FF. This identifies the immediate failure as a raw-mask equality assumption
in the harness, rather than a missing GENERIC_ALL grant or an extra principal in
the returned DACL. Microsoft documents that generic access bits represent
object-specific sets of rights: [Generic access rights](https://learn.microsoft.com/en-us/windows/win32/secauthz/generic-access-rights).
That reference is general; the exact returned value above is current-host evidence,
not a guarantee for every provider or Windows version.

The read also confirms machine key, ECDSA_P256, export policy None and Signing
usage. Metadata is not an effective access test: Guardian reopen/sign, App/child
denials, private-export refusal and restart checks remain pending. The original
failed report is retained unchanged, the validator has not been loosened, and
experiment2 remains NOT_RUN.

Evidence directory: `out/lic008-key-metadata/`; report SHA256
`eae096799e2f70a4329497be3d9a3dafdbf12d7c4135ae570025631b7b7e057c`;
reader executable SHA256
`525a23ba42ab594d677e75dc6a2ba3ef0e6bf3acbbad428e1b9108438986082d`.
`Run.ps1` preserves the exact bounded service orchestration; `services.json`
confirms helper absence and six original services Stopped/Manual; exit.txt is0.
The first publish waited on remote restore and was stopped; publishing from the
existing local NuGet cache with NuGetAudit=false succeeded on SDK10.0.400 and
runtime10.0.11. This is compilation evidence, not a vulnerability audit.

Next implementation step: a provider-scoped, explicit rights-normalization check
with regression cases for this exact representation, unexpected principals,
extra/deny/inherited/callback ACEs and insufficient rights. Then complete retained
key handoff and the required Guardian/App rounds using a reviewed continuation;
do not recreate or silently adopt an unrelated key. Only accepted experiment1
permits the conditional protection comparison. LIC008 remains open.

## Authorized 0.4.1 correction and retained-key continuation

The user authorized correcting the validator and executing the experiment.
The Software KSP-only check accepts exactly GA0x10000000 or the observed
0xD01F01FF representation. It still requires a protected DACL with exactly two
distinct plain allow ACEs for SYSTEM and the exact Guardian, no flags/callbacks,
and no other masks/providers. Regression cases cover both accepted representations
and insufficient/unknown masks, wrong/duplicate/extra principals, deny/inherited/
inheritance/callback ACEs, wrong provider and wrong ACE count (52 pure cases total).

`Resume-Retained.ps1` is a one-time, evidence-digest-pinned continuation for the
specific EV0100 key. It preserves the old binary/report directories, validates
stopped virtual-account service configurations and absence of temporary helpers,
installs corrected files in a fresh `bin-0.4.1`, and changes only the two
ComparisonV1 service executable paths. It never starts Setup or recreates a key.
Guardian checks protected intent/ownership against the fixed retained key name,
public identity, signing and corrected policy before publishing its public handoff.
Two subsequent Guardian/App rounds must each pass the unchanged isolation gate.
Only then may ContinueProtection execute LOCAL=user protection and fresh-process
reopen/decryption-denial rounds. This reconciles the failed handoff; it does not
erase or relabel the original Setup failure. Reboot/production gates stay open.

### Physical correction result (EV0102)

Executed0.4.1 ZIP: `out/lic008-comparison-896a636daee14af28e86411acf6d33ce/licensing-windows-comparison-0.4.1.zip`,
SHA256 `28b95e18dab83adb9ae3105811bba5dbcbeb0bd5cb62757f8339c1f17ef1409e`.
Initial compile failed CS8602 at nullable key.Provider; explicit null refusal
fixed it. Final build, pure guards52/52, package/controller49/49, inert bootstrap
regression and continuation parser passed. Build used installed local NuGet cache
with audit disabled; no vulnerability-audit claim.

Guardian handoff run2ff9f5a792994bb9a302a054d2ae3c75 passed against the exact
retained key. Fresh verification run9b7ff54568d249318589f43e28c8e95f passed
Guardian reopen, public identity, signing/signature verification, corrected
DACL/policy checks, private-export refusal and protected canary read.
This physically verifies the ACL comparison correction under Guardian identity.

App and its actual child both received `CryptographicException:0x80090016` on
key open, classified **INCONCLUSIVE**, not PASS_ACCESS_DENIED. Both actors'
protected-file read/write denials passed (4/4), and child identity/execution
passed. The unchanged acceptance gate stopped after this first isolation round;
the second key round and both LOCAL=user protection rounds were not run.
Summary remains `keyExperimentPassed=false`, `protectionExperiment=NOT_RUN`.
Do not silently add0x80090016 to IsDenied or treat inability to open as proven
access denial. The existing pure test explicitly rejects that classification.

Summary is
`out/lic008-comparison-896a636daee14af28e86411acf6d33ce/continuation-4dde8b0572a24b23b55d11567ad2b8fa.json`.
Controller exit1 reflects the unmet isolation gate, not failure of the repaired
rights comparison. Two ComparisonV1 service paths now reference bin-0.4.1;
all six retained test services are Stopped/Manual, with no temporary SYSTEM
helper. Old binaries, keys and reports remain intact. No key recreated, ACL
changed, TPM touched or production policy adopted.

Next: diagnose the App/child key-open result using bounded native error-stage
evidence and a matching positive Guardian control. Determine whether the provider
hides an inaccessible key or another open/visibility prerequisite is missing.
Keep ambiguous outcomes separate from proven denial and complete both key rounds
before the conditional protection experiment. LIC008 remains open.

## Prepared retained key-open diagnostic — EV0103

Version0.4.2 is prepared but **not physically executed**. It adds a shared,
exact-name native diagnostic for Guardian, App and the actual App child. The only
native calls are provider open, P-256 support query, exact retained-key open and
handle release. No create, property set, finalize, delete, private export or key
enumeration API is imported. Guardian must also pass the unchanged managed
reopen/sign/policy/ACL/private-export controls. App/child key-open failures remain
INCONCLUSIVE; an unexpected successful open is `FAIL_ACCESS_GRANTED`.

`Diagnose-Retained.ps1` is a new one-time continuation for the exact EV0102 state.
It pins the0.4.1 manifest/binary, committed continuation digest, plan/run, key
records, stopped Manual service identities/paths and helper absence before making
a fresh `bin-0.4.2-diagnostic`. It changes only the two Comparison service binary
paths, executes one diagnostic collection and always writes a summary with
`securityAccepted=false`, `acceptanceChanged=false` and the final service-state
snapshot. It does not contain or
invoke the consumed Resume-Retained continuation.

Final build: SDK10.0.400/runtime10.0.11; pure57/57, controller52, inert bootstrap,
PowerShell parser and read-only native API allowlist pass. ZIP:
`out/lic008-comparison-6433858d74bf43f3bef9652b321341a8/licensing-windows-comparison-0.4.2.zip`,
SHA256 `f9d85d37b21d9bd80a0437519018f5eadcf4cc4c8d6a042a6dbc2ff621b691e2`.
The build used the local NuGet cache with audit disabled; no vulnerability-audit
claim is made. Elevated retained-state preflight and service execution are NOT_RUN.

### Elevated preflight refusal and corrected0.4.3 — EV0104

The first elevated0.4.2 invocation stopped at Administrator `Test-Path` access to
`protected/software-intent.json`. That directory intentionally excludes
Administrators; the refusal verifies the ACL boundary and exposes a controller
preflight defect. It occurred before creation of `bin-0.4.2-diagnostic`, service
path changes, plan writes, reports or any key operation. Read-only follow-up found
both Comparison services Stopped/Manual on bin-0.4.1 and both helpers absent.

Version0.4.3 no longer reads protected key records in the Administrator
controller. The Guardian diagnostic reads protected intent/ownership itself and
compares them with the published public record before the existing managed and
new native positive controls. A permanent source guard rejects future
`protected/software` access in the continuation. Pure57/57, controller52, inert
bootstrap/parser/native API allowlist pass. Prepared ZIP:
`out/lic008-comparison-4ecb611ed4fe42b689c72605e0711a3e/licensing-windows-comparison-0.4.3.zip`,
SHA256 `e7fe936be1c3b365db445a197510fafd6cdc679ada9fea9f02c960fbb0a162a3`.
Physical0.4.3 execution remains NOT_RUN; no acceptance interpretation changes.

### Physical native key-open result — EV0105

The elevated0.4.3 continuation completed as run
`c2ed6691980c4792b5e743991ab8a172`. Guardian matched protected intent and
ownership to the published retained record, then passed managed reopen,
machine/non-exportable/P-256/signing checks, public identity, sign/verify, exact
DACL and private-export refusal. Its native provider open, P-256 query and exact
machine-key open also passed.

App and its actual child both opened Microsoft Software KSP and confirmed P-256
support. With the same exact key name and `NCRYPT_MACHINE_KEY_FLAG |
NCRYPT_SILENT_FLAG`, both exact-key opens returned
`NCryptStatus:0x80090016` (`NTE_BAD_KEYSET`). Child service-SID identity and
execution passed. This rules out an unavailable provider/algorithm, a managed
wrapper difference and mismatched diagnostic flags/name. It does not alone prove
access denial because the documented status means the specified key was not
found for the caller and may conflate absence with provider non-disclosure.

Copied report
`out/LIC-EV-0105-key-open-diagnostic-b2d7ddfbd7a24fa384cfa16093cb9dac.json`
has SHA256
`dbdc3b6cc266a48340be66a7b99d7815be03662d80a2e19669c467646cc7c433`.
It records `diagnosticCollected=true`, `securityAccepted=false` and
`acceptanceChanged=false`. Both services end Stopped/Manual on
`bin-0.4.3-diagnostic`; the retained key was not changed. The second acceptance
round and conditional protection remain NOT_RUN.

Next, prepare and review a separate fresh-key ACL-disambiguation package. It must
compare otherwise identical test-only machine keys whose DACLs respectively
exclude and explicitly include App, exercise Guardian/App/actual child, retain
crash-reconciliation evidence and never modify/delete the retained key. Only
that controlled contrast can support a later explicit decision about whether
this Software KSP/Windows result is acceptable non-disclosure; it must not
silently relabel prior0x80090016 rows.

### Prepared ACL-disambiguation control — EV0106

Version0.5.0 is prepared but **not physically executed**. For one fresh
experiment ID it binds two new test-only Software machine keys: restricted has
only SYSTEM+Guardian in its protected DACL; App-readable is otherwise identical
and adds the exact App service SID. Setup writes per-key intent before creation
and ownership immediately after finalization. It publishes the pair only after
both policy/DACL/public-identity/signing controls pass.

Guardian, App and actual child then run the same native provider-open, P-256 and
exact-key-open stages. The contrast is complete only if Guardian opens both,
App/child receive0x80090016 on restricted, and App/child open App-readable. That
result is recorded as `OBSERVED_BAD_KEYSET`, not retroactive AccessDenied. Only
after a complete contrast may Guardian delete the two fresh keys, and only after
exact experiment-name, intent, ownership, published record and public identity
match. A partial create/probe is retained for reconciliation. The EV0105 retained
key cannot match this namespace and is never passed to this cleanup.

Pure tests73/73, controller58, inert bootstrap, diagnostic parser/read-only API
allowlist and ACL continuation parser/state pins/generated-name/native-API bounds
pass. Prepared archive:
`out/lic008-comparison-c6300aac51c54facb567a0aac2362302/licensing-windows-comparison-0.5.0.zip`,
SHA256 `ce2efa0981f49608a6715a7c36c1e45eb5a8a9d138809e445b2b474286356d45`.
No service/key/ACL operation or acceptance decision occurred during preparation.

### Physical ACL-disambiguation result — EV0107

Experiment `c448747f67ec435fb27433d2a9608551` completed. Setup created both
fresh Software machine keys with identical non-exportable P-256 signing policy;
restricted had SYSTEM+Guardian and App-readable added only the App service SID.
Both finalized, signed, matched public identity and passed exact protected-DACL
checks. Guardian opened both. App and actual child opened the provider, confirmed
P-256, returned `OBSERVED_BAD_KEYSET` only for restricted, and opened
App-readable. Child token identity and execution passed.

This controlled ACL-only difference establishes that this host's Microsoft
Software KSP hides the restricted key from the non-ACE App identity using
0x80090016. It does not make0x80090016 a general AccessDenied code. Guardian
deleted and confirmed absence of both fresh controls; Setup was removed and the
retained EV0105 key was not a cleanup target.

Copied report
`out/LIC-EV-0107-acl-disambiguation-610290f45bcf46d4957638f7dc9dd9a0.json`
has SHA256
`166299e96e2036a3740a44d323ec7c4a608c4faef72c646ee3bc827902ecc50e`.
It records `setupComplete=true`, `contrastObserved=true`,
`cleanupConfirmed=true`, `helperRemoved=true`, `securityAccepted=false` and
`decisionChanged=false`. A later policy decision may accept only the complete
same-key/equal-DACL/positive-control pattern; it must not change global IsDenied
or relabel EV0102/EV0105 history.

### Prepared narrow accepted rounds — EV0108

The Project Owner explicitly approved CHG0052: on this host/provider only, the
retained Microsoft Software KSP machine key's `NTE_BAD_KEYSET` result may be
classified as `PASS_KEY_NOT_DISCLOSED` when the plan explicitly opts in and all
existing exact-key controls also pass: protected SYSTEM+Guardian DACL, Guardian
reopen/public-identity/sign/verify/policy/private-export refusal, App and actual
child identity/execution, and the EV0107 restricted-versus-App-readable control.
This is not a generic AccessDenied mapping. Global `IsDenied`, all other providers
and APIs, and historical EV0102/EV0105 result labels remain unchanged.

Version0.6.0 implements that decision in a separate plan-bound key-isolation
classifier. `Run-Accepted-Rounds.ps1` is a one-time continuation pinned to the
exact EV0107 report digest, package manifest/binary hashes, consumed plan/run,
experiment ID, stopped Manual service paths and helper absence. It installs a
fresh `bin-0.6.0-accepted-rounds` and performs two fresh `verify` rounds. Only if
both complete with the narrow key result plus unchanged file/child/Guardian gates
does it execute `protect` and `verify-protect` using the already authorized
test-only `LOCAL=user` descriptor. It creates or deletes no key, changes no key
ACL and never starts Setup.

Pure tests81/81, controller60, inert bootstrap, retained diagnostic and ACL
parsers, accepted-round parser/state pins, global-denial guard and native/API
bounds pass. Prepared archive:
`out/lic008-comparison-474f53f4730c4a1d8454960c5241eed9/licensing-windows-comparison-0.6.0.zip`,
SHA256 `291bfc71300835b39d07bcd3cabcb4202b930b471bcffbcaecdf1886ca75378e`.
Physical execution, both accepted rounds and `LOCAL=user` protection remain
NOT_RUN. Even a complete run is bounded process-restart evidence, not production,
reboot, ordinary-user, repair/reinstall, TPM or LIC008 acceptance.

### Physical accepted rounds and protection failure — EV0109

The one-time0.6.0 continuation completed two independent retained-key verification
rounds. Guardian passed reopen, public identity, sign/verify, machine/non-exportable/
P-256/signing policy, exact protected DACL, private-export refusal and protected
file reopen in both. App and actual child returned `PASS_KEY_NOT_DISCLOSED` for
the exact key and explicit file-denial PASS, with matching token identity and
child execution. The summary records `rounds=[true,true]` and
`keyIsolationAccepted=true`; this physically satisfies CHG0052 on this host.

The conditional test-only protection phase then created the `LOCAL=user`
descriptor successfully but `NCryptProtectSecret` failed at
`dpapi-protect-secret` with `CryptographicException:0x80090034`
(`NTE_ENCRYPTION_FAILURE`). It published no ciphertext or secret hash, so App/
child decryption checks and fresh-process `verify-protect` were not eligible to
run. The final result is `protectionExperiment=FAILED_OR_INCOMPLETE` and
`productionAccepted=false`.

Copied report:
`out/LIC-EV-0109-accepted-rounds-4ad8c06e51c74405b726ede8c305844c.json`,
SHA256 `e5cd53e948ae094a441c2245056a15e8c5f7889aa3c07653789361d5c007c002`.
Verify runs are `05e3dd6101684cbfb03973b8945b5b70` and
`5bea3d0e12f141af8b06fbe63d2c238a`; protect run is
`c6bd4350422e40c1b237efd5e138eb97`. Both services finish Stopped/Manual on
`bin-0.6.0-accepted-rounds`; helpers are absent. Do not rerun0.6.0 or silently
fall back to `LOCAL=machine`. Next is a bounded read-only-first diagnosis of the
exact virtual-service token/profile and DPAPI-NG provider environment.

### Prepared DPAPI-NG virtual-service diagnostic — EV0110

Version0.7.0 is prepared but not physically executed. Its one-time continuation
pins the exact EV0109 report digest, installed0.6.0 manifest and executable,
failed protect plan/run, absent shared ciphertext, stopped Manual service paths
and helper absence. It installs a fresh binary directory and executes only one
Guardian `diagnose-protection` action; App is not started.

The Guardian report records its current SID/account, authentication and
impersonation context, environment and Win32 profile paths/type, and whether the
exact service SID hive is loaded under HKU. It then uses two independent random
32-byte secrets to compare `LOCAL=user` and exact `SID=<Guardian>` protect/
unprotect behavior entirely in memory. All plaintext, blob and decoded buffers
are zeroed; none is written to disk. The package contains no `LOCAL=machine`,
key creation/deletion, ACL mutation, profile load/change or helper path.

Pure tests84/84, controller63, inert bootstrap and all diagnostic/ACL/accepted-
round/protection parser, state-pin and API-bound checks pass. Prepared archive:
`out/lic008-comparison-1ad53ea4a4414f02a02e1cb7d8c85edf/licensing-windows-comparison-0.7.0.zip`,
SHA256 `8bf0028bd3eab420568e75547592ae625fb225a161382a36071b621c81bfb48e`.
Manifest SHA256 is `5c301f20a37b6f8afaec79253f0486b1de9120dd4053ec8d1f507f3773e7fe9d`.
Physical execution and any protection-adapter or policy decision remain NOT_RUN.

### Physical DPAPI-NG virtual-service diagnostic — EV0111

The one-time0.7.0 diagnostic completed as run
`12f3501a2dda4c10bb045139fd764450`. Guardian's primary identity matches the
exact ComparisonV1 virtual-service SID and account; authentication is Negotiate
and impersonation level is None. Both environment and special-folder user profile
resolve to `C:\Users\Default`, the exact service-SID hive is not loaded under
HKU, `GetUserProfileDirectory` is unavailable with0x80131501 and
`GetProfileType` is unavailable with0x80004005.

Both independent memory-only controls create their descriptor, then fail at
`dpapi-protect-secret`: `LOCAL=user` and exact `SID=<Guardian>` each return
`CryptographicException:0x80090034` (`NTE_ENCRYPTION_FAILURE`). No plaintext,
ciphertext or hash is persisted. The App service is not started, no profile,
service identity, key or ACL is changed, and `LOCAL=machine` is not tested.

Copied report:
`out/LIC-EV-0111-protection-diagnostic-504cd5bf4b724762a328d5abfc8d5964.json`,
SHA256 `08f65149a6ae953d5af12d00dc0b473160a8e976f194f62554dc9ae669bfac6d`.
It records `diagnosticCollected=true`, `securityAccepted=false`,
`policyChanged=false` and `productionAccepted=false`. Both services finish
Stopped/Manual on `bin-0.7.0-protection-diagnostic`. This rejects the tested
virtual-account DPAPI-NG adapter on this host; it does not yet distinguish absent
profile support from a broader local provider limitation. Any profile-backed
identity control requires a separately reviewed mutation scope.

## Prepared separate profile-backed control — EV0112

The reviewed follow-up is now a separate0.8.0 namespace and binary; it does not
modify ComparisonV1 or the retained key. Two fresh Manual services use the
built-in LocalService profile and distinct unrestricted service SIDs. Owner
compares `LOCAL=user` with its exact service-SID descriptor; same-account Peer
must open the former but be refused on the latter, and a fresh Owner process must
reopen both. Thus `LOCAL=user` is explicitly a broad negative-policy control,
not a fallback. No local user/password/profile, `LOCAL=machine`, key, CNG ACL,
TPM or production identity change is present.

Pure guards14/14 and package/static/parser guards pass. Prepared ZIP SHA256 is
`7ba9c0a561ad2c0ba792bb386ec0b01a3c1237398fee2615c8b4b0fd0dc54b2d`.
Physical execution is NOT_RUN. Full boundaries, corrected pre-build findings and
hashes are in [LICENSING_PROFILE_CONTROL.md](LICENSING_PROFILE_CONTROL.md).

###0.8.0 bootstrap failure and corrected0.8.1 — EV0113/EV0114

The elevated0.8.0 run stopped at its first ACL rule because a string SID was
treated as an account name and could not be translated. Reconciliation proves
both service names absent and all five created directories empty; no binary,
plan, role report, blob, hash or DPAPI call occurred. The retained summary hash
is `f2cc9958914a568b59ea391a75a6c94f1c740beb9586aed592ec62e83fb59ff7`.

Version0.8.1 uses explicit SecurityIdentifier objects and a real ACL fixture.
Its continuation refuses anything except that exact report/content, empty
inventory and absent services. Pure14/14 and all package/static/parser/ACL guards
pass. Prepared ZIP SHA256 is
`b8cc5949305d348596bd93a044a91a72ef9e958c7167e4108a9f662c3f8a54be`;
physical continuation remains NOT_RUN. Do not rerun0.8.0.

###0.8.1 copy failure and corrected0.8.2 — EV0115/EV0116

The exact0.8.1 continuation applied ACLs and created both LocalService controls,
then Windows PowerShell5 rejected the three-positional-argument `Join-Path` before
copying `clretwrc.dll`. Both services are Stopped/Manual on the expected paths;
no executable, plan, role report, blob/hash, service start or DPAPI call occurred.

Version0.8.2 uses nested two-argument `Join-Path` and statically forbids the old
form. Its continuation validates both exact summaries, empty inventory and both
stopped service configurations, then skips service creation. Pure14/14 and all
package/static/parser/ACL/path guards pass. Prepared ZIP SHA256 is
`baf0a827f68b227e9dd9cd8a8bc7a4d0365d615e5d7675c42f606c3a00367922`;
physical0.8.2 remains NOT_RUN. Do not rerun0.8.1.

### Physical profile-backed result — EV0117

The0.8.2 continuation completed Owner protect, Peer probe and fresh Owner verify.
All processes ran under LocalService with their correct enabled service SIDs;
profile environment/special-folder resolved to the LocalService service profile
and HKU S-1-5-19 was loaded. Owner `LOCAL=user` protect/round-trip and fresh
reopen passed, but same-base-account Peer also decrypted that blob. It is therefore
functional but explicitly too broad for production isolation.

The exact Owner service-SID descriptor again failed at `dpapi-protect-secret`
with0x80090034, now despite the valid loaded profile. No exact-SID blob existed,
so Peer/Owner missing-blob results are prerequisites, not denials or continuity
evidence. The control is complete as a negative result and must not rerun. Both
services finish Stopped; all acceptance/policy flags remain false.

This rejects the tested standalone DPAPI-NG adapters on this host. Per the prior
plan, the next work is a separately approved comparison of different protection
adapters, including key custody, App/child denial, restart/repair and recovery;
the ECDSA signing key cannot be reused for wrapping.
