# LIC008 retained-data Uninstall/Reinstall simulation plan

Planning date: 2026-10-06
Status: `PHYSICAL_SIMULATION_PASS_OPERATOR_HASH_RECONCILED`; CHG0074/EV0143.
Prepare/Uninstall/Reinstall completed; V7 consumed. Production/security/matrix acceptance unchanged.
Owner: LIC-6.2-008. Scope: isolated SOFTWARE_BOUND wrapping-key feasibility only.
Read [wrapping lifecycle contract](../design/LICENSING_SOFTWARE_KSP_WRAPPING_DESIGN.md) and
[completed Upgrade evidence](LICENSING_WRAPPING_UPGRADE_PLAN.md) first.

## 1. Purpose and limits

Prove that removing and reinstalling the test service registration can preserve
the same wrapping keys, protected ownership records and encrypted envelopes, then
reopen them without silently creating replacement keys. Default uninstall retains
license data; explicit purge is a different, separately authorized operation.

This is NOT the real product Installer, uninstall of this project, signed-package
acceptance, production License Store, database migration or release approval.
No existing V1-V6 experiment may be reused: their keys were cleaned up or their
state is consumed. V6 operator hash reconciliation does not close LIC008.

## 2. Proposed isolated resources — review before implementation

Use a fresh fixed `C:/ProgramData/Ecs.Lic008.WrappingV7` root and exact test service
names `Ecs.Lic008.WrappingV7.Guardian`, `.App` and `.Setup`; refuse root/service
collisions before mutation. Test keys must have a V7 TEST_ONLY prefix and exact
experiment ownership. Final names, artifact versions, manifest digests, directories,
ACL entries and complete mutation list must be pinned in the implementation handoff.
These reviewed names are implemented in the consumed pinned kit below; Prepare was
the immediate operator handoff. Later stages require review of preceding output.

Guardian/App use exact virtual service accounts; Setup uses LocalSystem with its
enabled service SID. All services are Manual; require Stopped/PID0 before any
registration change. Record exact enabled token identities and service SIDs;
reinstallation must reproduce those recorded identities or refuse. Never adapt
the key ACL to a changed identity merely to make a test pass.

Keep the existing crypto candidate unchanged: separate non-exportable Software-KSP
RSA3072 wrapping keys, OAEP-SHA256 and AES256-GCM test envelopes. The ECDSA signing
key stays separate. Preserve exact restricted SYSTEM+Guardian ACL and the deliberate
App-readable positive control. No user/password, broad account ACL or DPAPI fallback.

## 3. Three reviewed, one-shot stages

1. **Prepare:** verify fresh resources and supported platform, create owned keys
   once through Setup, publish random test envelopes, run Guardian and App/actual-child
   positive/negative controls, record package/host/experiment/keys/public identities,
   protected ownership/evidence hashes and exact service identities/paths. Stop all
   services. Retain keys for review; print a preparation checkpoint.
2. **Retained-data uninstall simulation:** after operator review, verify the same
   existing keys and complete stopped role set; write a durable one-shot intent.
   Remove ONLY the three exact owned service registrations. Do not delete keys,
   retained root, protected/shared records, envelopes or reports; do not change their
   ACLs. Preserve binary files as evidence rather than recursively deleting them.
   Confirm registration absence and unchanged retained-file inventory. The retained
   binaries mean this is explicitly a service-registration uninstall simulation,
   not proof of real Installer file removal. Pause for operator review.
3. **Reinstall simulation:** pin original machine/experiment/package/checkpoints
   and unchanged retained inventory. Refuse a partial or unexpected role set; never
   overwrite a collision. Recreate exactly the recorded service registrations and
   SID settings with verified trusted bits, without calling the key-create action.
   Verify identities, accounts, SID types, paths and complete stopped set before
   probes. Guardian must reopen the SAME keys and decrypt SAME envelopes with the
   original public identity/policy/ACL/export restrictions; App/actual child must
   retain isolation with the readable control passing. Only after all continuity
   gates succeed may a separate owned-test cleanup delete the two exact test keys,
   verify absence and leave services Stopped/Manual with all reports retained.

No automatic retry/Resume, startup, restart, reboot or rollback. Any partial failure
retains intents and evidence and requires a separately reviewed reconciliation;
the success path must not silently repair a partially recreated service set.

## 4. Required rejection tests and evidence classification

| Case | Required behavior | Initial coverage |
| --- | --- | --- |
| Root/service collision | Refuse before mutation | Inert fixture first |
| Key missing or wrong public identity with retained data | Recovery/refusal; no key creation or replacement | Inert fixture; physical test requires separate reviewed resources |
| Ownership/checkpoint/envelope/hash mismatch | Refuse; preserve retained state | Inert fixture first |
| SID/account/path/package mismatch | Refuse; no ACL broadening or start | Inert fixture first |
| Partial service deletion/recreation | Retain intent; no mixed-set probes | Mocked boundary fixture, not physical interruption evidence |
| Successful uninstall checkpoint | Exactly three registrations absent; retained file hashes unchanged | Physical success stage when authorized |
| Successful reinstall | Same key identity and envelope bytes; Guardian/App/child controls PASS | Physical success stage when authorized |
| Power loss/real interruption | Separate crash-safe reconciliation proof | NOT_RUN; not implied by mocked failures |

Tests must call real shared controller guards where feasible. Pure/package/parser,
inventory/path/no-overwrite, token/report binding and native/API allowlist checks
must pass before packaging. Tests may not run the physical controller implicitly.
Negative physical cases must not corrupt success-run state or consumed V1-V6 keys.

## 5. Evidence and next action

Record exact package/source hashes, platform/build, run/experiment, all service
states/identities/SIDs, key/public identities, retained inventories before/after
each boundary, same-envelope confirmation, report hashes and owned cleanup.
Distinguish uninstall simulation success, reinstall simulation success, native
negative tests, mocked failure tests and independently reviewed security evidence.
productionUninstallTested/productionReinstallTested/securityAccepted/
productionAccepted/matrixAccepted remain false for an isolated simulation.

The user subsequently authorized implementation under CHG0072/EV0141.
Before physical execution, review the exact mutation manifest and pinned package
below and each stage's output. Real Installer lifecycle, separate standard account, TPM/NV,
interruption, clean Windows matrix and independent Security review remain open.

## 6. Prepared kit and inert verification — EV0141

Sources: `licensing/windows-spike/wrapping-reinstall-control` and
`licensing/windows-spike/wrapping-reinstall-kit`; build/test scripts:
`scripts/build-license-windows-wrapping-reinstall.ps1` and
`scripts/test-license-windows-wrapping-reinstall.ps1`.
Uses existing WrappingNative/ServiceHost/TokenEvidence unchanged; V1-V6 sources
and backend runtime are untouched. SDK10.0.400/runtime10.0.11, self-contained win-x64.

Kit:
`E:/EntryControlSystem/out/lic008-wrapping-reinstall-2de44fbeb95c4c3a9fe3dc332337a16b/package`.
Archive `licensing-windows-wrapping-reinstall-0.14.0.zip` SHA256:
`fcb833814fde7004c2485dda26739eaa81aa66aa02a97893c8bf3650034203ec`.
Kit manifest: `8f2b6a599d1042d9d4285abf692f3fe73368d034bbe69aab9ef3607d3d8ecb15`.
BIN manifest: `f39e94e091f64996f1c4af530412402b2055dd883618b19e525e2f89695c4818`.
EXE: `d9e3c51d212774b9a67d873025f3ab6d39552386d0e0680baef29ad92ce142b0`.
Managed DLL: `40225fa9cea55ca7014989f4d1bff6f9205e15ced26c6f1a9869452040c59fa1`.

Publish and pure17/17 PASS. Actual shared service-report factory/controller binding,
wrong role/action/run/experiment/scope/version/EXE/DLL/manifest/acceptance flags,
closed package, unknown version, traversal/missing/duplicate/tampered file,
real fixture inventory/no-overwrite/read-only DACL, protected file/directory digest,
SID/account/path/full-stopped-set and checkpoint identity negatives PASS.
Real lifecycle boundary functions with mocked SCM/crypto/package dependencies pass
missing-key/protected-drift refusal before deletion, partial deletion with retained
intent, registration collision before mutation, partial creation/SID mismatch with
no activation/probes/plan overwrite, post-reinstall missing-key/protected-drift refusal,
and successful registration uninstall/reinstall. Real Run refuses partial/bad activation
before plan writes or starts. Optional Registry, PowerShell alias/quoting/exit,
parser, source/API/crypto and no-create/no-ACL-write lifecycle guards PASS.

Initial build output f320af688caf48e693f09782c3ef4099 compiled/pure-tested but did
not emit a ZIP: a fixture lacked its kitRoot variable and the partial-delete
assertion failed. Diagnostic rerun identified that test-only omission; test setup
and negative-case probe counts were corrected. Full standalone rerun and fresh
final build pass. The first package is superseded and must not be run physically.
No physical resource was created by either build. Cached NuGet feed with audit
disabled; no dependency-vulnerability, signed publisher or independent Security claim.

## 7. Exact prospective physical mutation manifest and handoff

Only `C:/ProgramData/Ecs.Lic008.WrappingV7` and exactly the three V7 service names
in section2 may change. No V1-V6 namespace, customer DB, K40, production installation,
local user/password, global Crypto ACL or TPM change is allowed.

Prepare creates root/bin/protected/shared and three role-report directories and
applies initial per-directory ACLs only. Root/bin: SYSTEM+Administrators Full,
Guardian/App ReadAndExecute. Protected: SYSTEM Full+Guardian Modify, no Admin
grant. Shared: SYSTEM+Admin Full+Guardian Modify+App ReadAndExecute. Each report
directory: SYSTEM+Admin Full and Modify only for its emitting Guardian/App role;
Setup reports need SYSTEM/Admin only. Setup uses LocalSystem with enabled own SID;
Guardian/App use exact virtual accounts; Manual startup, unrestricted service SID.
Two Software-KSP keys:
`Ecs.Lic008.WrappingV7.TEST_ONLY.restricted.<experiment>` and
`Ecs.Lic008.WrappingV7.TEST_ONLY.app-readable.<experiment>`, protected CNG ACLs
SYSTEM+Guardian and SYSTEM+Guardian+App respectively. Random test-only envelopes.
Fresh-root/service collision refuses; initial create happens once. Compiled guard
refuses create once prepare checkpoint or uninstall/reinstall intent exists.
Prepare runs Setup/Guardian/App-child probes, hashes seven reports/shared files,
six controller-readable directory DACLs and five Guardian-readable protected
files plus protected-directory DACL. Writes installation/paused plan/prepare
checkpoint; retains keys and all three services Stopped/Manual for review.

Uninstall writes one-shot run intent, admits the same keys/protected records
through Guardian, captures eight reports/shared files, writes uninstall intent
and deletes only the exact three stopped owned SCM registrations. Bounded polling
checks both SCM and Registry absence; a marked-for-delete/partial state refuses.
Keys, protected/shared data, DACLs, binaries and all reports remain. No cleanup
action, file deletion or Set-Acl call. Uninstall checkpoint records pre-deletion
key proof and unchanged readable inventories; native key continuity after removal
is not yet proved until the Reinstall Guardian succeeds.

Reinstall pins machine, manifests, installation, checkpoints/intents, paused plan,
files and DACLs; rejects any existing/partial registrations. Writes one-shot run
and reinstall intents, recreates exactly three original Manual service registrations
and SID settings with unchanged retained binaries, then verifies original SIDs/
accounts/paths/full stopped set before activation or start. No key create or
retained ACL rewrite. Guardian reopens/decrypts the original keys/envelopes and
compares all five protected file hashes/DACLs and directory DACL with prior proof.
App/actual child repeat isolation/positive controls. Writes reinstall proof; only
then Setup deletes the two exact owned test keys and proves absence. Leaves
services Stopped/Manual and all files/checkpoints/intents/reports retained.
Registration writes are non-atomic; failure preserves state, no automatic Resume
or repair. Physical invalid-state/interruption flags stay false regardless of mocks.

Historical Prepare handoff (COMPLETED; do not execute again):

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "E:\EntryControlSystem\out\lic008-wrapping-reinstall-2de44fbeb95c4c3a9fe3dc332337a16b\package\Run-Wrapping-Reinstall.ps1" -Stage Prepare
```

All three stages below have now completed. Never repeat a stage, delete intents
or recreate keys. LIC008/Open003/012 and production/security/matrix gates remain open.

## 8. Physical lifecycle output review — EV0142, 2026-10-06

Commit verification: the existing package's inert guard suite rerun PASS,
including pure17/17 and IO/DACL/SID/checkpoint/lifecycle-negative fixtures.
Documentation resolver PASS (40 Markdown files,155 local targets), pinned
Node24.19.0 protocol suite PASS, and git diff --check PASS. This verification
did not execute any physical stage, mutate SCM or operate on persisted keys.

The operator ran the EV0141 kit in elevated PowerShell, reviewing each stage's
output before the next. This is a test service-registration lifecycle, not
uninstallation/reinstallation of the actual product or removal of its binaries.

| Stage | Observed result |
| --- | --- |
| Prepare | Both owned-key creation/publication PASS; six Guardian controls PASS including protected inventory; App/actual-child restricted OBSERVED_BAD_KEYSET with readable decrypt positive control, token/artifact0.14.0 and execution PASS; PREPARED_FOR_UNINSTALL. |
| Uninstall | Six Guardian admission controls PASS; exactly three DeleteService SUCCESS; UNINSTALLED_RETAINED_DATA; uninstall checkpoint emitted. Reviewer read-only service lookup found no V7 registrations after this stage. |
| Reinstall | Three CreateService/ChangeServiceConfig2 SUCCESS; six Guardian controls PASS; App/actual-child expected restricted BAD_KEYSET with readable decrypt positive control, token/artifact0.14.0 and execution PASS; both exact owned-key deletions PASS; final summary emitted. |

After Reinstall, independent read-only SCM inspection found Guardian/App/Setup
Stopped, Manual, PID0. According to the successful controller path, continuity
and retention checks gated cleanup. EV0143 subsequently reviews the supplied
summary and captures matching operator byte hashes; see section9. No blanket
error reclassification or fleet compatibility claim.

Retained root: `C:/ProgramData/Ecs.Lic008.WrappingV7`.
Uninstall checkpoint: `uninstall-checkpoint.json`.
Final summary: `wrapping-summary-6ab84a1dfeee472db6dfb2a20ffa3315.json`.
At EV0142, original hashes and summary contents were pending because the
unelevated reviewer could not read the protected summary. EV0143 now supplies
the contents and operator hash capture; no permissions were widened.
Evidence remains operator transcripts, not independent Security attestation.

V7 is consumed: never run Prepare, Uninstall or Reinstall again. Owned test keys
were deleted; preserve existing reports/checkpoints/intents/binaries. Summary
review and operator byte-hash reconciliation are complete under EV0143. Actual Installer lifecycle, standard-account,
TPM/NV, physical invalid-state/interruption and full Windows matrix remain open.

## 9. Supplied summary and operator hash reconciliation — EV0143

The final summary reports sameKeyIdentityVerified, sameEnvelopeBytesVerified,
sameProtectedFileBytesVerified, sameServiceSidsVerified, retainedDaclsVerified,
uninstallSimulationPassed/reinstallSimulationPassed and ownedKeyCleanupPassed=true;
keyRecreationAttempted=false. Scope/version/kit/artifact and false production,
security/matrix/physical interruption acceptance flags match the pinned contract.
Experiment e0fe1ec7545845eb94d42883d1949570; UTC2026-10-06T10:52:42.6452879Z;
Windows11 Pro21H2 build22000. Three services Stopped/Manual/PID0;11 evidence and
5 protected records. Supplied JSON was parsed and checked; it is not an archived
copy of the original report bytes.

The user's separate elevated read-only Get-FileHash output captures:

- Original summary SHA256: `cc8d7464fedb6b20b9adeae2d0e34f1aff483b3f481b975a74a1632ef9ffb586`.
- Prepare checkpoint: `655033bafa4d3d363ef78074006603995a3234c712dc5cff6a9bd26c74998929`.
- Uninstall checkpoint: `92cc111baeec627e419c56e89486e5d2ed51bb390c773fec9a6e4be5df87f418`.
- Both checkpoint digests match the summary; all11 evidence files Match=True.

[Evidence ledger and exact file hashes](../evidence/wrapping-v7-operator-verification.md).
The command validates byte hashes only: current DACL/protected hashes were not
independently remeasured. No independent Security, actual Installer or Windows
matrix acceptance. V7 evidence reconciliation complete; never rerun any stage.
