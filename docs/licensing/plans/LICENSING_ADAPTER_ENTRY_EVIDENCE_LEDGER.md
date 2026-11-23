# LIC008 bounded adapter-entry evidence and gap ledger

Date: 2026-10-07. Version:1. Record: CHG0081 / LIC-EV-0150.
Status: `CANDIDATE_EVIDENCE_MAPPED_NOT_ACCEPTED`.
Scope: FULL and ATTENDANCE; preparation for NE-002/ADAPTER_ENTRY only.
Baseline: HEAD8a01e682b4a351b2554a995d7585e91661f9f2f2 plus preserved r91 docs.
Author/evidence mapper: Codex. Windows Security decision owner: NOT_ASSIGNED.
Adapter acceptance reviewer: NOT_ASSIGNED. No approval inferred from the
separate scheduling-amendment review. No new physical or harness test executed.

## 1. Proposed scope, not an adapter decision

The [adopted scheduling policy](LICENSING_NATIVE_ENTRY_ADOPTION.md) permits a
separately reviewed bounded adapter-entry decision; this ledger prepares that
decision, not its acceptance. Scope proposed for review: existing test-only
Microsoft Software Key Storage Provider wrapping feasibility on the single
Windows11 Pro21H2 x64 build22000 development host. The artifacts use .NET10,
SDK10.0.400/runtime10.0.11, win-x64; those are evidence identities, not proof
of compatibility on every supported Windows10/11 build.

SOFTWARE_BOUND is lower assurance. TPM/NV, Windows10, newer Windows11, fleet
coverage, actual signed Installer, production Guardian/Store, rollback/crash-safe
state and hostile-administrator/full-machine-clone resistance are NOT accepted.
Unproved provider/platform paths remain refused; no silent DPAPI/provider fallback.
The production RSA/envelope implementation is not supplied by these tests.
Test keys were cleaned up and namespaces consumed; retained files are evidence,
not a usable current key or a ready production adapter.

## 2. Required technical profile and scope limits

Compare [wrapping design](../design/LICENSING_SOFTWARE_KSP_WRAPPING_DESIGN.md)
sections1-4 with actual test code; do not promote test conventions to product policy.

| Boundary | Existing candidate/test profile | Production distinction retained |
| --- | --- | --- |
| Provider/key | Exact Microsoft Software KSP; machine RSA3072; export policy0; decryption-only usage | Planned ECDSA installation key remains signing-only; no reuse for encryption |
| Wrap | NCryptEncrypt/Decrypt OAEP-SHA256 with silent flag, random32-byte AES key | No OAEP-SHA1/PKCS1v1.5; no direct RSA state encryption |
| Envelope | AES256-GCM, random12-byte nonce,16-byte tag; experiment AAD and identities | Final LIC6.5.002 schema/encoding/domain/generation binding and parser vectors still pending |
| Creator | Test Setup under SYSTEM creates exact test-owned names/intents; Guardian reopens | Signed product one-shot Setup/manifest/TTL/peer authority still unimplemented |
| Restricted key DACL | Protected SYSTEM + exact test Guardian SID; exact ACE forms/rights read back | Actual EntryControlSystem.License SID not tested; no App/DB/user/broad Admin key grant |
| A/B positive control | Separate app-readable test key; V3 chosen user also receives test control access | Control-key grants must NEVER appear in a production restricted key |
| Public identity | Provider/name and public SPKI hash compared against owned test record | Unsigned/local test identity hashes are not signed manifest/runtime authority |
| Denial | Restricted OBSERVED_BAD_KEYSET meaningful with same-provider rightful/readable controls | No global NTE_BAD_KEYSET relabel; missing key/provider error/ACL refusal distinct |
| Buffer handling | Test code clears data keys/plaintext in finally; native decrypt clears output on exception | Source pattern only; not independent process-memory/secret-leak assurance |

## 3. Reusable historical evidence index

Every reference is an existing result, not a test rerun or a new acceptance.
Operator hashes prove reported file-byte correspondence, not an independent
Security attestation or current ACL/TPM/production behavior.

| Record | Existing result and provenance | Reuse limits |
| --- | --- | --- |
| EV0107/CHG0052 | Earlier P256 Software-KSP signing-key ACL A/B contrast supports the narrow non-disclosure interpretation on this host | Different key purpose/experiment; NOT RSA-wrap evidence or global denial classifier |
| EV0117 | Profile-backed LOCAL=user works but Peer can decrypt; exact service-SID DPAPI-NG protection fails0x80090034 | Valid negative result; tested standalone descriptors rejected, no retry/fallback authorization |
| EV0126 V2/0.9.3 | User transcript: Setup creation, Guardian/fresh reopen/policy/decrypt/export/tamper, App/actual-child contrast and cleanup PASS | One host; original protected summary reconciliation/hash still pending |
| EV0130 V3/0.10.1 | Non-elevated interactive A/B, Guardian/App/child/fresh-process checks and cleanup PASS; summary/user/manifest digest comparison recorded | Filtered-admin token, NOT independent standard user; individual role hashes not independently reread |
| EV0132 V4/0.11.0 | Normal Windows Restart: ordered boot checkpoint, same key/envelope, Guardian/App/child controls and cleanup PASS | Original summary/checkpoint/evidence byte hashes uncaptured independently; no power loss/auto-start/Windows Update proof |
| EV0135 V5/0.12.0 | Binary Repair simulation preserves key/envelope; controlled missing-key refusal without recreation, cleanup PASS | Not actual product Repair; original summary/checkpoint/evidence hashes remain gap; arbitrary invalid-state/power-loss not physically exercised |
| EV0138 + EV0139 V6/0.13.0->0.13.1 | Distinct managed upgrade artifacts, same key/envelope, old bits preserved, no recreation, controls/cleanup PASS; operator summary/checkpoint/all11 file hashes reconciled | Binary simulation only; no signed Installer/migration/interruption/fleet acceptance |
| EV0142 + EV0143 V7/0.14.0 | Prepare/Uninstall/Reinstall PASS; three test registrations removed/recreated, same identities/envelopes/protected inventory, controls/cleanup PASS; operator summary/both checkpoints/all11 file hashes reconciled | Retained binaries, test SCM lifecycle only; current DACLs not independently remeasured; no ordinary user/physical interruption/invalid-state acceptance |

Original summary hashes already recorded:

- V3: d9814c711473fbda4432c41b82b4e5834d1823508df0d142893d0492600a3183.
- V6:7b95d1e086b91de870445b7ed1e84c4f40fe83a6faa9c5e8fe20cf51de221517;
  checkpoint62d79f5a09637a96b0c63ce3d99178ea524d7a416b875a7e52835816deefe779.
- V7:cc8d7464fedb6b20b9adeae2d0e34f1aff483b3f481b975a74a1632ef9ffb586;
  Prepare655033bafa4d3d363ef78074006603995a3234c712dc5cff6a9bd26c74998929;
  Uninstall92cc111baeec627e419c56e89486e5d2ed51bb390c773fec9a6e4be5df87f418.

V7 exact11-file hashes and provenance: [operator ledger](../evidence/wrapping-v7-operator-verification.md).
V6 exact11-file hashes: [Upgrade plan sections9-10](LICENSING_WRAPPING_UPGRADE_PLAN.md).
V3/V4/V5 precise evidence identities: [master EV0130/0132/0135](../design/LICENSING_DESIGN.md).
Do not substitute attachment SHA256 for original report SHA256.

## 4. Coverage-to-requirement map

AE-IDs below are ledger rows, NOT executed test IDs. HOST_OBSERVED is historical
one-host result; SOURCE_ONLY is inspection, neither means an accepted entry gate.

| ID | Requirement | Evidence/status | Remaining obligation owner |
| --- | --- | --- | --- |
| AE-001 | Setup creation, provider/RSA3072/machine/usage/export read-back | HOST_OBSERVED V2/V3/V6/V7; native creation/source checks | Windows Security/Installer: actual signed creator/no-overwrite authority |
| AE-002 | Protected exact restricted DACL and public identity | HOST_OBSERVED rightful Guardian controls, V7 protected-inventory continuity; no new DACL inspection | Windows Security: approve exact production principals/rights and cross-role matrix |
| AE-003 | OAEP-SHA256 wrap and GCM decrypt | HOST_OBSERVED V2-V7; native helper parameters verified SOURCE_ONLY this pass | Windows Security: final schema/parser/domain separation and profile review |
| AE-004 | Private key export refusal | HOST_OBSERVED; source attempts GenericPrivateBlob,Pkcs8PrivateBlob,OpaqueTransportBlob | Windows Security: future product exact-provider policies; no assertion about untested export mechanisms |
| AE-005 | App and actual child refusal with readable control | HOST_OBSERVED V2-V7 restricted BAD_KEYSET vs successful readable decrypt | Host/Security: real App/Node capabilities and product SID binding |
| AE-006 | Non-elevated interactive refusal | HOST_OBSERVED V3 filtered admin only; standard account NOT_TESTED | Windows QA/Security: independent standard-user evidence |
| AE-007 | Fresh process and normal reboot continuity | HOST_OBSERVED V2/V3 fresh process, V4 normal restart | Windows QA: original V4 hashes and actual automatic product service recovery |
| AE-008 | Wrong key/wrapped key/nonce/AAD/ciphertext/tag refusal | HOST_OBSERVED Guardian negative matrix; V7 six corrupt/wrong-key cases inspected | Windows Security/Core: final parser/malformed input bounds and authoritative-state binding |
| AE-009 | Repair and missing key with retained envelope | HOST_OBSERVED V5 binary repair/control refusal; original hash gap | Installer/Security: actual RECOVERY_REQUIRED classification and no recreate/migration/policy bypass |
| AE-010 | Upgrade/reinstall same key, files and SID continuity | HOST_OBSERVED V6/V7 simulations; operator hashes reconciled | Installer/QA: actual signed package removal/update/Repair/rollback/downgrade lifecycle |
| AE-011 | Owned cleanup and service final state | HOST_OBSERVED consumed V2-V7 cleanup; prior read-only stopped/manual evidence | Installer: explicit product purge policy, no arbitrary deletion/recreation |
| AE-012 | Complete-state CAS/journal/anchors/crash reconciliation | NOT_IMPLEMENTED_NATIVE; portable contracts only | LIC6.5.002/Core: STORE001-005 and full rollback/power-loss tests |
| AE-013 | TPM sealing/NV/provider and copy/clone assurance | NOT_TESTED/NOT_ACCEPTED | LIC008/Open003: TPM path and explicit Software lower-assurance limits |
| AE-014 | Exact platform and both Edition final product acceptance | All WIN-V1 rows NOT_RUN; no FULL/ATTENDANCE customer runtime integration evidence | Windows/Release QA: full matrix/independent hosts and LIC6.6 exits |

## 5. Gaps and safe next actions

These are pending actions, NOT newly executed tests or authority to mutate a host.

| Gap | Safe next action / closure evidence | Owning gate |
| --- | --- | --- |
| AG-001 Owner/scope approval missing | Name Windows Security owner and separate adapter acceptance reviewer; review this exact candidate scope/profile/limitations and current evidence binding | NE-002/NE-006; no automatic approval from scheduling review |
| AG-002 Original V2/V4/V5 provenance incomplete | Separate READ-ONLY capture/reconciliation of retained original summaries/checkpoints/evidence if available and authorized; no controller reruns, key recreation or ACL broadening; record unavailable evidence honestly | LIC008 evidence custody; relevant AE rows |
| AG-003 Standard user absent | Design a future fresh reviewed ordinary-user control; V3 filtered admin does not substitute; run only after explicit physical-test authorization | LIC008; LIC6.6.002 |
| AG-004 Physical invalid-state/interruption absent | Enumerate crash/missing/wrong identity/ACL/provider/outcome cases, expected restricted classifications and checkpoint-safe recovery; fresh reviewed kit/disposable scope if later authorized | LIC008 lifecycle; LIC6.4.006; STORE001-005 |
| AG-005 Production envelope/schema and atomic Store absent | Pin C_TXN/C_FILE/C_AUDIT contracts and final bounded parser vectors before native integration; random harness envelope not authoritative License state | NE-003; LIC006/007; LIC6.5.002 |
| AG-006 Product services/Installer identity and ownership absent | Review signed Setup/Guardian/App peer/manifest/TTL/intents/ACL contracts; retain actual Installer tests for native integration | C_IPC; LIC6.4.001..006 |
| AG-007 TPM/NV and lower-assurance binding incomplete | Separate TPM inventory/feasibility/rollback/copy decision from Software path; preserve full-disk/VM clone and privileged-admin limits | LIC008/Open003; LIC6.5.002 |
| AG-008 Independent Windows matrix absent | Plan exact build/provider/Edition/physical-host cases from matrix; no broad Windows10/11 compatibility statement from current-host tests | LIC6.6.002; WIN-V1-01..05 |
| AG-009 Independent adapter acceptance absent | Submit ledger/profile and applicable source/evidence for separate scoped review; prior scheduling acceptance is not cryptographic/provider acceptance | NE-002; full LIC008/Open003 exits later |

At least two independent physical machines and actual final product flows remain
release requirements, not prerequisites silently removed by a bounded development
scope. Gaps must be mapped and accepted for the exact requested entry; missing
evidence cannot be made PASS by limiting words or rerunning a consumed namespace.
Whether any gap can remain a later full-exit obligation is a recorded scoped
adapter decision, not a waiver granted by this inventory.

Recommended immediate work: AG-001/AG-009 scoped owner/reviewer and decision
preparation plus AG-002 retained-evidence custody assessment; then C_* contract
records. New hardware runs, permanent product keys or production Guardian code
do not start automatically. NE-002 remains NOT_ACCEPTED; native entry NOT_READY.

## 6. Source snapshot and verification limits

Source SHA256 captured read-only for this mapping (not final production artifacts):

| Source | SHA256 |
| --- | --- |
| [WrappingNative.cs](../../../licensing/windows-spike/wrapping-control/WrappingNative.cs) | a67b2ad638cf8e92d504b4b7fda011ef1fc3493291159cb511f556788d790d14 |
| [V2 Program.cs](../../../licensing/windows-spike/wrapping-control/Program.cs) | 51dbe212006b9d73c5a1b7cb6a1a6b0fa5080559c0d6df009437f360c155f9cc |
| [V7 Program.cs](../../../licensing/windows-spike/wrapping-reinstall-control/Program.cs) | be5f7b729d4360160847ebfc63fa858d9952f9acdf87b9ec9c246fc5d641959a |
| [V7 project](../../../licensing/windows-spike/wrapping-reinstall-control/Ecs.Lic008.WrappingV7.csproj) | e558d1f2f91e8e58750a855699661335fa02172b02a96af479b88e44b7eebe6d |

V7 links the shared WrappingNative/ServiceHost/TokenEvidence source; this table is
selected inspected-source provenance, not a complete build manifest or fresh
binary/source equivalence proof. Test flags securityAccepted/productionAccepted/
matrixAccepted remain false. Original protected reports/ACLs were not reread or
remeasured here; no new physical, cryptographic harness, VM/TPM or service test.
Do not generalize source buffer-clearing patterns into memory-forensics proof.
The consumed experiment namespaces remain untouched. No commit performed.

## 7. Inventory validation — 2026-10-07

Read-only checks PASS:14 unique AE requirement IDs,9 unique AG gap IDs and all4
selected source hashes match. Docs resolver self-tests and48 Markdown files/218
local targets PASS; exact Node24.19.0 protocol-v1 package checks PASS;
git diff --check PASS. An initial inventory-ID checker assumed a bare gap-ID
cell rather than ID plus title; corrected parsing passed without source mutation.
These validate inventory consistency only; no prior physical test was rerun,
no original protected report/ACL remeasured and no adapter/provider/NE gate
accepted by these checks.
