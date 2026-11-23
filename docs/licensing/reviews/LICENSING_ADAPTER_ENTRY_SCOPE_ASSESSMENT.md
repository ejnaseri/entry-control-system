# Adapter-entry evidence — bounded scope assessment

Date: 2026-10-07. Record: CHG0082 / LIC-EV-0151.
Result: `PRE_ACCEPTANCE_ASSESSMENT_GAPS_REMAIN`.
Reviewer: Codex, evidence-ledger author, separate assessment pass; NOT independent
adapter Security approval. No Windows Security decision owner or independent
adapter reviewer assignment inferred from the prior scheduling amendment.

## Exact input and permitted conclusion

[Evidence ledger v1](../plans/LICENSING_ADAPTER_ENTRY_EVIDENCE_LEDGER.md), raw SHA256
5f6612a8fec22e1ec7c36fbf8c8cdc946b699d957dd51768d1048099047f1266.
Baseline HEAD8a01e68 plus preserved r92 documentation. Scope considered: the
test-only Software-KSP RSA wrapping candidate on Windows11 Pro21H2 x64 build22000.
Applied [adopted v2](../plans/LICENSING_NATIVE_ENTRY_ADOPTION.md) requirements.
This report proposes obligation placement, not permission to defer/waive a gate.
No complete adapter, native entry, ordinary-user, TPM, platform or release approval.

## 1. Evidence reuse disposition

| Existing evidence | Reusable support | What it cannot support |
| --- | --- | --- |
| V6 EV0138/0139 and V7 EV0142/0143 | Primary existing one-host RSA/provider/key-policy/DACL/identity, rightful decrypt/export/tamper/App-child contrast, lifecycle-simulation and cleanup observations; operator hash reconciliation recorded | Independent Security attestation, new product artifacts, actual Installer/full matrix/TPM/anti-rollback or current usable keys |
| V3 EV0130 | Additional interactive refusal/readable-control evidence; exact filtered-admin token and summary/user/manifest digests | Separate standard-user assurance or every role report independently reread |
| V4 EV0132 | Supplementary normal-reboot observation, preserving its current provenance gap | Fully reconciled original-file evidence or auto-start/crash/Windows Update proof |
| V5 EV0135 | Supplementary same-version repair and retained-envelope missing-key refusal; preserve hash gap | Actual signed Installer Repair, arbitrary invalid-state or power-loss assurance |
| V2 EV0126 | Supplementary earliest successful wrapping/fresh-process control | Original summary verification before its custody gap is reconciled |
| Earlier P256 EV0107 | Historical evidence for same-host/provider ACL-mediated non-disclosure contrast | Replacement RSA crypto proof or global BAD_KEYSET denial classification |
| DPAPI-NG EV0117 | Negative evidence excluding tested overbroad/unavailable standalone descriptors | An approved fallback or authority to rerun/recreate retained experiments |

V6/V7 cannot automatically replace V4's reboot case or V5's controlled missing-key
case: these demonstrate different boundaries. Review must declare which cases
the requested adapter-entry decision needs and reconcile their applicable evidence.
Old report hash gaps do not invalidate unrelated V6/V7 operator observations;
they also cannot be erased because newer experiments passed.

## 2. Before bounded adapter-entry acceptance

| ID | Required disposition before acceptance | Existing gap mapping |
| --- | --- | --- |
| AR-001 | Named Windows Security decision owner and non-author adapter reviewer; exact scope/profile/limitations approved separately from scheduling review | AG-001/009 |
| AR-002 | Pin provider/API/key-policy/creation ownership, test-versus-product SID/ACL conventions, wrapping format and fresh buffers; no production control-key grants or fallback | AG-005/006; AE-001..005/008 |
| AR-003 | Index accepted evidence hashes, runner/artifact/host/role/experiment identity and provenance; declare required lifecycle cases and resolve applicable custody gaps or obtain newly reviewed evidence later | AG-002; AE-007/009/010 |
| AR-004 | Explicit fail-closed classification for missing key, wrong identity/ACL, provider outage, uncertain result and absent/unproved adapter; design contracts are not executed negative tests | AG-004/005/006 |
| AR-005 | Map every residual platform/provider/Installer/Store case to exact owning gates/test IDs and owner; declare what remains outside requested development scope | AG-003..008 |
| AR-006 | Accepted current evidence ledger plus per-slice authorization and all OTHER NE prerequisites; ADAPTER_ENTRY acceptance alone does not satisfy NATIVE | NE-001..006 |

All six dispositions remain pending; this author's assessment is not their
acceptance. Current source checks and past reported PASS do not complete them.
No envelope or full Store security requirement is silently transferred to later
owners; the existing LIC6.5.002/FILE/STORE ownership remains intact.

## 3. Proposed integration/release obligation placement

| Gap | Before acceptance or its requested scope | Later owning full exit, still mandatory |
| --- | --- | --- |
| AG-001 / AG-009 | Required named decision owner/reviewer and explicit scoped adapter acceptance | Final independent product/release acceptance remains separate |
| AG-002 | Required integrity/provenance for each historical case actually used; V2/V4/V5 unresolved, not auto-accepted | Complete evidence custody and applicable native/Windows gate reconciliation |
| AG-003 | Standard-user risk/evidence limitation must be stated and accepted for scope; no claim that filtered admin completes it | Real separate standard user under LIC008/LIC6.6.002; deferral is a reviewer decision, not granted here |
| AG-004 | Failure taxonomy/refusal/reconciliation contract and explicit missing physical coverage | Real interrupted/invalid-state tests under LIC008/LIC6.4.006/STORE001-005, before corresponding operations are accepted |
| AG-005 | Pin bounded crypto-format and C_TXN/C_FILE/C_AUDIT design boundaries; no runtime authority from test envelope | Final production state schema/vectors/durable CAS/journal/anchors before Store integration acceptance; FILE/STORE original exits |
| AG-006 | Signed ownership/IPC/Setup design boundaries, intended role scope and test SID limitations | Actual signed Guardian/App/Setup/Installer tests under LIC6.4.001..006 |
| AG-007 | Software lower assurance and absent TPM scope explicit; unproved paths refused | TPM/NV/binding/rollback acceptance under LIC008/Open003 and LIC6.5.002; no full Open003 closure |
| AG-008 | Exact tested development build only; no Windows10/newer11 inference | All WIN-V1 rows and independent physical computers under LIC6.6.002; current statuses stay NOT_RUN |

These are proposed placements for review. None marks a physical failure case,
provider or NE gate PASS, and none grants production use. Independent approval
may require additional scoped evidence before even Software-only entry.

## 4. Actual read-only custody probe

Coordinator attempted SHA256 reads of exactly five retained metadata/report files
using Get-FileHash; no controller, SCM/CNG call, ACL change or file write.

| Exact retained file | Result |
| --- | --- |
| C:/ProgramData/Ecs.Lic008.WrappingV2/wrapping-summary-7da3625af6f14f10b05b5bed5e1cf5be.json | ACCESS_DENIED; no digest obtained |
| C:/ProgramData/Ecs.Lic008.WrappingV4/wrapping-summary-47513d20e9864dcf84d40b8ace00b916.json | ACCESS_DENIED; no digest obtained |
| C:/ProgramData/Ecs.Lic008.WrappingV4/reboot-checkpoint.json | ACCESS_DENIED; no digest obtained |
| C:/ProgramData/Ecs.Lic008.WrappingV5/wrapping-summary-de5efc93255841619c9f86f2570af292.json | ACCESS_DENIED; no digest obtained |
| C:/ProgramData/Ecs.Lic008.WrappingV5/repair-checkpoint.json | ACCESS_DENIED; no digest obtained |

Every attempted read returned System.UnauthorizedAccessException /
ItemExistsUnauthorizedAccessError from ResolvePath. This does not prove absence,
tampering or a key failure. Original reports were not read; no digest invented.
An initial PowerShell foreach-to-pipeline expression failed parsing before reads;
the corrected array-capture command produced the five denied results above.

Next physical-machine action, if the operator chooses it: elevated READ-ONLY
hash capture of these exact five files, followed by parsing only expected
summary/checkpoint evidence metadata and validating referenced paths before
reading any referenced file. Do not execute old controllers or broaden ACLs.
That follow-up must record original-vs-attachment provenance, matching checkpoint
fields and each required evidence-file digest; five hashes alone are not full
reconciliation. No elevation, account/service creation or remediation attempted here.

## 5. Conclusion and practical next step

NE-002 NOT_ACCEPTED; native entry NOT_READY. The evidence is sufficient to prepare
a scoped decision, not to proclaim a production adapter or all Windows compatible.
Proceed with retained-evidence read-only reconciliation where accessible and
versioned failure/ownership/format contract preparation. Submit the resulting
exact scope/ledger to a named non-author adapter reviewer before acceptance.
If original evidence is inaccessible or missing, document the gap; do not rerun
consumed V1-V7 or waive the corresponding required case by calling it complete.

No product code/backend/crypto-schema/customer data mutation, physical harness
run, new secret/key/service/ACL operation, adapter approval or commit.

## 6. Documentation validation

Six unique AR dispositions, all9 AG gap references and5 exact denied-read rows
checked PASS. A shorthand combined gap reference was expanded to its exact ID
after the first ID checker rejected it; no application source mutation.
Input ledger raw SHA256 unchanged. Resolver self-tests and49 Markdown files/223
local targets PASS; git diff --check PASS. These validate assessment records
only, not adapter acceptance or successful custody capture.
