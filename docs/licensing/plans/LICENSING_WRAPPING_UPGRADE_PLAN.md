# LIC008 bounded wrapping-key Upgrade experiment plan

Planning date: 2026-10-06

Status: `PHYSICAL_UPGRADE_SIMULATION_PASS` under CHG0069/EV0138; physical
Prepare/Upgrade completed on the current host. Production/matrix/security acceptance unchanged.
Checklist owner: `LIC-6.2-008`; selected follow-up to EV0135 under CHG0067.
Implementer: Codex. Physical operator/acceptance reviewer: Project Owner.
Independent Security review remains required before LIC008 closure.
Planning base: `f40b8d5` plus preserved r78/EV0135 documentation changes.

## 1. Authority and duplicate-work check

[Master design](../design/LICENSING_DESIGN.md) governs checklist dependencies and acceptance.
[Wrapping design](../design/LICENSING_SOFTWARE_KSP_WRAPPING_DESIGN.md) section4 requires
Upgrade to preserve key name/material/ACL and state identity.
[Packaging decisions](../../operations/PACKAGING_DECISIONS.md) section7 governs the future REAL
Installer upgrade, including backup, signed complete version sets and migration.
This isolated experiment neither implements nor replaces that product workflow.

Before selecting this work, documentation, wrapping sources/kit/build/test names,
Git history and local `out/*upgrade*` directories were inspected. Existing V2
feasibility, V3 interactive control, V4 reboot and V5 same-version binary Repair
are recorded and must not be repeated. No separate wrapping Upgrade plan, kit,
controller or local Upgrade output was found. General Upgrade requirements were
already documented; the new deliverable is their bounded experiment plan.

## 2. Scope and non-goals

Test two distinct self-contained service artifacts, OLD and NEW, against the SAME
fresh experiment keys and test envelopes. Prefer a new fixed `WrappingV6`
namespace; reserve it only in this document until implementation preflight proves
it fresh. Never reuse V1-V5, production services, existing keys or retained roots.

Use existing approved Software-KSP RSA3072/OAEP-SHA256/AES256-GCM policy and
exact role/DACL/identity controls. Both artifacts retain the same test envelope
schema and cryptographic domain: this is binary-version continuity, not a format
migration. Different version strings alone are insufficient evidence: the closed
manifests must differ, the actual managed service assemblies must have distinct
hashes, and the executing report factory must identify OLD or NEW from compiled
code. Apphost EXE hashes alone do not bind .NET managed code.

No Server/Client/Prisma/DB/K40 changes; no new accounts/passwords; no signing-key
reuse, TPM operations, machine-wide crypto-folder ACL changes, production Store,
real NSIS/MSI, customer license, migration or final Installer changes. Technical
targets remain Windows10 client x64 build14393+ and Windows11 client x64
build22000+ under the existing matrix; lifecycle dates are advisory. No wider
compatibility claim or dependency amendment is made.

## 3. Required implementation stages (not executable commands yet)

1. **Inert build and guard tests.** Produce separately closed OLD/NEW manifests;
   test the real service report emitters against the actual controller validators.
   Validate source-to-package bytes, exact versions/roles/actions/run/experiment/
   package hashes, optional Registry fields, PowerShell parsing, sc.exe alias/
   quoting/exit handling and no-overwrite/no-create boundaries. No SCM/key writes.
2. **Prepare OLD, elevated once after review.** Require fresh fixed namespace and
   package/platform checks; install Manual isolated Setup/Guardian/App services.
   Setup creates only fresh owned test keys. OLD Guardian and App/actual child
   perform all positive/negative controls. Retain keys/envelopes and seal a
   checkpoint with machine, exact identities, ownership, manifests, plan and
   evidence hashes; verify all services Stopped/Manual. Pause for output review.
3. **Upgrade to NEW, elevated once from the reviewed kit.** Pin the OLD checkpoint
   and trusted OLD/NEW artifacts before mutation. OLD Guardian must verify the
   existing keys/envelopes before staging. Copy NEW into a separate versioned
   directory, never overwrite OLD. Change only exact test service executable
   paths while every service remains stopped. Start no role until the complete
   NEW role-path/package/version set has been read back and verified. NEW
   Guardian verifies unchanged key identity/provider/policy/DACL and decrypts
   existing bytes; NEW App and actual child repeat the isolation/control matrix.
4. **Finish only after all required gates pass.** Record shared-byte comparison,
   old/new package and actual report identities, exact service configuration and
   case results. Setup deletes only fully owned experiment keys and confirms
   absence. Retain OLD/NEW bits, checkpoints, envelopes and reports; keep services
   Stopped/Manual. Incomplete runs retain state, not automatic cleanup/retry.

Implementation handoff below now documents exact stages/versions/commands and
mutation manifest. The tests cover inert guards, not physical role execution.

## 4. Acceptance matrix

Physical acceptance for every row remains `NOT_RUN`. Inert evidence for artifact
distinction, report/package rejection, inventory/no-overwrite, key admission and
partial path-switch guards is recorded below; it is not native fault coverage.
Missing prerequisites are not denial PASS.

| Case | Required proof |
| --- | --- |
| `LIC008-UPGRADE-001` OLD baseline | Setup creation/publish, OLD Guardian policy/identity/decrypt/export refusal/tamper and App/actual-child A/B/token controls pass before upgrade. |
| `LIC008-UPGRADE-002` distinct artifacts | Different closed manifests AND actual managed service assembly bytes; report compiled version matches OLD before and NEW after. All dependencies/controller bytes verified, not only EXE. |
| `LIC008-UPGRADE-003` continuity | Same key names/public identities/provider/length/export/usage/protected DACL; exactly unchanged persisted envelope bytes; NEW decrypts OLD envelopes without creating keys or republishing envelopes. |
| `LIC008-UPGRADE-004` isolation | NEW App/actual child cannot open restricted key, while readable-key controls and exact token/execution evidence pass. BAD_KEYSET is only interpreted within this complete A/B pattern. |
| `LIC008-UPGRADE-005` invalid candidate | Wrong scope/role/version/experiment, downgrade, package tamper, missing file or unknown version rejects before candidate/path/state mutation. Old state retained. |
| `LIC008-UPGRADE-006` invalid retained state | Missing key, identity/policy/ACL mismatch, changed checkpoint/envelope or forged ownership rejects without key creation, ACL repair, plaintext fallback or cleanup. Use safe fixtures first; any physical variant needs its own reviewed fresh namespace/ownership plan. |
| `LIC008-UPGRADE-007` incomplete activation | Deterministic inert fault fixtures at staging/path-switch boundaries leave no admission through a mixed role-version set. Services remain stopped; durable intent describes old/new state and the next permitted reconciliation. No blind retry or unreviewed restore. |
| `LIC008-UPGRADE-008` evidence/cleanup | All gates bind the exact experiment/package/run; completed owned-key deletion confirmed; final summary and stopped Manual services recorded. Failure retains resources and false acceptance. |

SCM path changes are NOT an atomic multi-service transaction. The controller must
gate role startup on the entire verified version set and retain an incomplete
activation intent if any path change fails. Fault fixtures model selected
controller boundaries only; they do not prove sudden power-loss durability.
Any physical interruption/resume flow needs an explicit reviewed checkpoint-bound
continuation; deleting intent or rerunning Prepare/Upgrade is never recovery.

## 5. Reports, limits and stopping rules

Reports must include checklist/scope/schema, compiled artifact version, actual
package/report hashes, experiment/run IDs, role/token/OS inventory, unchanged
key public identities/policies, envelope hashes, case stages/errors, service
configuration and cleanup results. No private key, decrypted payload, random AES
key or customer data may be written to reports or logs. Fixtures use random test
envelopes, not real licenses. Hashes identify bytes; unsigned kit manifests are
not publisher authentication against a hostile Administrator.

Keep `productionUpgradeTested=false`, `securityAccepted=false`,
`productionAccepted=false`, `matrixAccepted=false`; distinguish any future
`upgradeSimulationPassed` from actual product Upgrade. Ordinary-user, reboot,
actual interruption/power loss, signed Installer Repair/Upgrade, retained-data
uninstall/reinstall, TPM and other Windows rows are not proved by this run.

Stop on unexpected access, unknown creation outcome, mismatched identity/hash,
timeout, mixed versions or policy failure. Preserve state/reports; never broaden
permissions or recreate a key to obtain PASS. Operator reviews output between
physical stages. Do not auto-elevate, reboot, start old namespaces or simulate
destructive power loss on the development computer.

## 6. Entry, exit and next safe action

LIC003 is complete, permitting this isolated LIC008 feasibility work.
`LIC-OPEN-003` and `LIC-OPEN-012` remain open; production Guardian/Store and
Phase6.4/6.5 dependencies are unchanged. No LIC008/Phase6.2 closure is claimed.

Planning exit: current summaries agree with EV0135, the scope/negative cases/
evidence/retention contract above is recorded, and local documentation checks
pass. This does not close an implementation or physical acceptance row.

The Product Owner subsequently authorized implementation after committing the
planning documents as 8e4d3c3. OLD/NEW sources, inert tests and the kit are now
prepared under EV0137. The subsequent user-run Prepare/Upgrade completed under
EV0138; section9 records the physical result. No service/key execution occurred
during build verification. This kit is now consumed; the commands below are
historical operator instructions, not permission to rerun.

Documentation validation (2026-10-06): nine changed/new documents,61 local links
with no missing targets, unique seven-column EV0135/0136 rows, r79/handoff
alignment, unchanged LIC008 in-progress/Open012 blocked gates and eight planned
Upgrade cases PASS. `git diff --check` passes. Local link checks do not verify
external URLs or section anchors. No runtime/build/physical test was run.

## 7. Implemented kit and inert evidence — 2026-10-06

Kit version0.13.0, scope TEST_ONLY_SOFTWARE_KSP_WRAPPING_V6; OLD service0.13.0
and NEW service0.13.1. SDK10.0.400/runtime10.0.11, self-contained win-x64.
Source: wrapping-upgrade-control and wrapping-upgrade-kit in licensing/windows-spike;
scripts/build-license-windows-wrapping-upgrade.ps1 and its test counterpart.

Artifact: E:/EntryControlSystem/out/lic008-wrapping-upgrade-2ab85815105741ea8cf613e52c334fd4/licensing-windows-wrapping-upgrade-0.13.0.zip

ZIP SHA256: 7eedbc84df86c1a3b8c05ee44ab4a358d9e2ee93ab7bb46cc52bb9be697b9dde.
Closed kit manifest SHA256: faaf4e56086366bd7fdb44f636b0768db8a260322b450aa6724ae34b1ca63b74.
OLD managed DLL SHA256: c5dbe73523561cea8295760ac81d24775b6f0a62a51ca9eebf1e0d3db8ec2436.
NEW managed DLL SHA256: 84ddb0d4587add54fbe667cf648f6f157b86481a7ffe80778eaac458287dd84a.
Hashes identify unsigned test bytes; no publisher-authentication claim.

Build command: powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/build-license-windows-wrapping-upgrade.ps1.
Both builds and both pure13/13 pass. Inert tests execute both actual report
factories against the actual controller validator: scope/role/action/run/experiment/
compiled version/EXE/managed DLL/package hash and false acceptance-field corruption
reject. Closed manifest/content hashes and kit/source bytes match; unknown/reversed
version pair and identical managed code reject. Real inert package/inventory fixtures
exercise changed/missing/duplicate/traversal content, retained-evidence hash and
CreateNew no-overwrite guards. Each Guardian admission row failure and duplication
reject; complete role set rejects changed identity/path/state/SID configuration.

The actual Upgrade boundary is exercised with inert copied files and mocked
SCM/ACL/crypto/package dependencies: missing-key and wrong-identity result fixtures
refuse before candidate/intent/SCM changes; after-stage failure preserves intent
without SCM writes; second-SCM-write failure preserves partial stopped state and
the real Run helper rejects the mixed version set before plan write/start. A valid
fixture stages and activates all three roles. These are controller fault fixtures,
not native missing-key tests or power-loss evidence. Optional Registry fields,
PowerShell parser/sc alias/quoting/nonzero exit and crypto/source boundaries pass.
V6 root and services absent before and after inert build; no persisted keys/ACL/
service changes, no existing V1-V5 run. Cached NuGet packages used with audit disabled;
no dependency-vulnerability or independent security-review claim.

## 8. Exact prospective physical mutation manifest

Only C:/ProgramData/Ecs.Lic008.WrappingV6 and services
Ecs.Lic008.WrappingV6.Guardian/App/Setup may be changed. Prepare refuses an existing
root or any service collision. Guardian/App use their exact virtual service
accounts; Setup uses LocalSystem with its enabled service SID. All use Manual
startup and unrestricted service SID type. No local account/password is created.

Prepare creates bin-old, protected, shared and three role-report directories;
applies only per-directory test ACLs, copies verified OLD bits and writes fresh
installation/plan/checkpoint/reports. Protected ownership records have SYSTEM and
Guardian access only. Setup creates two machine-wide non-exportable Software-KSP
keys with names Ecs.Lic008.WrappingV6.TEST_ONLY.restricted.<experiment> and
Ecs.Lic008.WrappingV6.TEST_ONLY.app-readable.<experiment>. Restricted DACL is
SYSTEM+Guardian; readable control deliberately adds App, not an interactive user.
It creates random test envelopes, then starts only the bounded test role probes.
On success keys are retained and all services are Stopped/Manual for review.

Upgrade pins the exact kit, OLD/NEW manifests, machine, checkpoint, paused plan,
reports and shared files. It writes a one-shot run-intent, runs OLD Guardian
admission, writes upgrade-intent, stages verified NEW in bin-new and applies ACL
only to that new directory. Three stopped service paths are configured to NEW;
upgrade-activation is written only after the complete role set is read back.
Every later Run rechecks the full stopped role set and activation/package binding.
NEW may not create keys: its compiled service guard also refuses create.
NEW Guardian/App/child verify continuity/isolation; upgrade-proof is saved, then
Setup deletes only the two owned keys and confirms absence. The final summary
retains reports/envelopes/OLD/NEW files and records all acceptance flags false.
No source, ECDSA key, TPM, DB, K40, production installation or old namespace changes.
No automatic restart/rollback/retry/Resume is provided; partial intent requires
separate reviewed reconciliation. Physical invalid-state/interruption tests are
explicitly false in the summary, regardless of passing inert fault fixtures.

Historical Prepare command (consumed under EV0138; DO NOT EXECUTE AGAIN):

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "E:\EntryControlSystem\out\lic008-wrapping-upgrade-2ab85815105741ea8cf613e52c334fd4\package\Run-Wrapping-Upgrade.ps1" -Stage Prepare
```

Send the full output and wait for review. ONLY after preparation is accepted,
the same command with -Stage Upgrade runs once. No reboot is needed. On any
unhandled error do not repeat either stage or delete intent/resources. The kit
is a binary Upgrade simulation, not signed product Installer acceptance.

## 9. Physical result — consumed kit (2026-10-06)

CHG0069/EV0138 records user-run Prepare and Upgrade on Windows11 Pro21H2 x64
build22000. Prepare printed PREPARED_FOR_UPGRADE after Setup, OLD Guardian and
App/actual-child controls passed. The user repeated Prepare; the existing-root
gate refused before any mutation. Upgrade then completed once with OLD admission,
all three path changes, NEW Guardian and App/child controls and owned-key cleanup
PASS. Child artifact identity explicitly reports0.13.1. Read-only SCM independently
confirms three Stopped/Manual services with ProcessId0 and bin-new role paths.

Final summary:
`C:/ProgramData/Ecs.Lic008.WrappingV6/wrapping-summary-1225a3288609492a8fb0803c005c6796.json`.
Experiment `b0d47d4451d14ecaa423eaaad40f0491`; UTC2026-10-06T07:33:53.5771655Z.
Summary transcript attachment297bfffc-49ec-4092-b0b6-bdb8ef3f1e7b SHA256
`255c7d269d282258e098914078ace6bab5b5736305cf8593d1e99915b325890c`.
This hashes the pasted transcript, NOT the original protected summary file.
Prepare transcript attachment31fe8d56-cac9-45b0-ab67-383d0a28d627 and Upgrade
console output in this conversation provide the role/control and cleanup evidence.

Reported checkpoint SHA256:
`62d79f5a09637a96b0c63ce3d99178ea524d7a416b875a7e52835816deefe779`.
Reported kit manifest matches EV0137:
`faaf4e56086366bd7fdb44f636b0768db8a260322b450aa6724ae34b1ca63b74`.

| Artifact | OLD0.13.0 | NEW0.13.1 |
| --- | --- | --- |
| EXE SHA256 | 5eb6126cfefd47201b62a981a24f2200d9adee0589a93f1b07965746f57a91b2 | 82a14f22b2b393b17450a821db03634335a3edb4867eb94684cda5ecedd4ac55 |
| Managed DLL SHA256 | c5dbe73523561cea8295760ac81d24775b6f0a62a51ca9eebf1e0d3db8ec2436 | 84ddb0d4587add54fbe667cf648f6f157b86481a7ffe80778eaac458287dd84a |
| Package manifest SHA256 | 030c177e3d4e122fc085ff136d3bd692edc3fb58b74a3c2dd949bd4f24d40c2f | 18823fa32b6842444fc50e79d75c6a9355616eb19ad671d329071700e1f69f35 |

Summary upgradeSimulationPassed, hostFeasibilityPassed,
distinctManagedArtifactsVerified, sameKeyIdentityVerified, sameEnvelopeBytesVerified
and oldFilesPreserved are true; keyRecreationAttempted is false. Eleven reported
evidence digests cover two App, three Guardian, two Setup reports and four shared
files. Reported evidence inventory (not independent hash capture):

| Relative file | Reported SHA256 |
| --- | --- |
| app-reports/6069a52e245b4584a5e5f8c97336349b.json | 3cecbdc9d6ded887fac8929f763f44ea3eabd14713272762f28a3ee2a7dfd069 |
| app-reports/aa1878c9f6e74e32a864b1e621264fbc.json | 9b91efd1a6a7ff11c12dab63b64493eb8d14868fa95a45f298ddd2cb3b23a984 |
| guardian-reports/0e7b755e99b2475498e0deeb117f975a.json | df681e7fac641c43dbe9996c485b83eaced34271ad7a8f659754e6b8e19c06bc |
| guardian-reports/17a0745b959347baa48ab6e77a3573a3.json | 13f06d130373ae67a5785507072fcd59265d779a4b560788c0e09bc91b5a85f8 |
| guardian-reports/f827cf5ab3114f46a2abed71a4a1b521.json | 12ed1aae2de5f502b0572955734f6ee8ece0c198ce6c1883e6092aa28718b3e0 |
| setup-reports/232c5f5f10224147977131c7f469e320.json | eeca6b7c822b48b369ef53aa95004dc4c4d61ef7aadcae3fb2496e44df3d9e57 |
| setup-reports/c7de5cfd59444f41a46585c2434662b1.json | a0b71021fe580c549299cc62becfd5fe98f8e73d7dbcb580b20c09ec6a0fb6e5 |
| shared/app-readable-envelope.json | e61c70f651c67bdcdd92c247f872ef0af4b6931be9a42d8333762a878e81f550 |
| shared/app-readable-hash.json | 21f6a31c01e4395d37d6e245b173b48ab16ca4095852bd99a320b33afb3c16bf |
| shared/control-set.json | b6a556d65065522e0dcf0802eb65299a3d9e25ac0e4749bbc6ef4cba450a89bb |
| shared/restricted-envelope.json | f3ae4e6a846100bc07a2337c351642826637ab28ace4c97d869267db927582f2 |

Original protected summary/checkpoint/evidence bytes have not been independently
read/hashed: direct non-elevated access was denied; no ACL was broadened.

productionUpgradeTested, securityAccepted, productionAccepted, matrixAccepted,
interruptionPhysicallyTested and invalidStateRefusalPhysicallyTested remain false;
ordinaryUserNotTested remains true. This is not a signed Installer, migration,
power-loss, TPM, separate standard-account or complete Windows-matrix acceptance.
LIC008 stays [~], Open003 remains open and Open012 blocked. EV0139 below reconciles
V6 file hashes through operator read-only capture. The next proposed experiment is
the [retained-data reinstall plan](LICENSING_WRAPPING_REINSTALL_PLAN.md), planning only.
Never rerun either stage or recreate the deleted test keys. Retain all OLD/NEW
bits, shared envelopes, reports, checkpoint and intents; services stay Stopped/Manual.

## 10. Separate operator hash verification — EV0139

After EV0138 the user executed elevated Get-FileHash/Get-Content only. The original
summary SHA256 is `7b95d1e086b91de870445b7ed1e84c4f40fe83a6faa9c5e8fe20cf51de221517`.
The original checkpoint SHA256 is
`62d79f5a09637a96b0c63ce3d99178ea524d7a416b875a7e52835816deefe779`, matching
the summary and section9. All eleven original evidence files in section9 returned
Match=True against summary.evidenceFiles. Original-file digest must not be confused
with the earlier attachment transcript digest255c7d269d282258e098914078ace6bab5b5736305cf8593d1e99915b325890c.

Evidence source is the user's PowerShell output in this conversation, reviewed by
Codex; not direct non-elevated capture by Codex and not an independent Security
review or signed attestation. This closes only the V6 operator hash-reconciliation
gap. V4/V5 protected-hash gaps and all production/matrix/security/physical-interruption
gates remain open. No service/key/ACL changes or test reruns occurred in this check.
