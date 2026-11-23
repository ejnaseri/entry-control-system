# Retained V2/V4/V5 summary hashes — LIC-EV-0152

Date: 2026-10-07. Record: CHG0083 / LIC-EV-0152.
Result: `FIVE_ORIGINAL_HASHES_CAPTURED_CHECKPOINTS_MATCH_PARTIAL_RECONCILIATION`.
Scope: original retained report/checkpoint byte hashes only, not harness reruns.

## Execution and provenance

User authorized the next action: read the fixed five retained files with elevated
PowerShell. Coordinator Codex prepared
[fixed-path collector](../../../scripts/collect-license-retained-summary-hashes.ps1),
checked its parser and inert five-target inventory, then launched the OS elevation
flow with Start-Process -Verb RunAs -WindowStyle Hidden. Elevated process PID4604
completed and exited; the resulting report is readable in workspace/out.
This is coordinator-run original-file hash capture, not an independent Security
attestation and not an operator transcript substituted for original bytes.

Collector raw SHA256:
56b5ac616281720920867f335416d78d77bb7e6390b3ca09692d2fb2153bc38f.
Result UTC:2026-10-07T10:07:04.9154322Z.
Diagnostic report: E:/EntryControlSystem/out/lic008-retained-hashes-67763c459aff46859ec2997c1811502a.json.
Diagnostic report SHA256:
8999df56cf83627200870455f49765332d4dc60eada177c548e1a0879e547f33.
The diagnostic-report hash is NOT any original summary/checkpoint hash.
Generated out is ignored by Git; this document preserves its result/provenance,
not the original protected JSON content or a complete archived evidence package.

Collector uses fixed paths, read-only file handles/size caps/reparse refusal and
no CNG/SCM/ACL calls. Its only write is a new no-overwrite diagnostic JSON under
workspace/out. No original protected file, key, ACL or service was changed.

## Five original-file hashes

All five returned HASH_READ; actual stream lengths recorded below.

| ID | Exact original path | Bytes | Original SHA256 | Existing checkpoint comparison |
| --- | --- | --- | --- | --- |
| v2.summary | C:/ProgramData/Ecs.Lic008.WrappingV2/wrapping-summary-7da3625af6f14f10b05b5bed5e1cf5be.json | 1888 | 65f72549d6638f0d30488d5372bd2384f282853ab3daf79b260ddd1d18f164a1 | No prior independently captured summary digest |
| v4.summary | C:/ProgramData/Ecs.Lic008.WrappingV4/wrapping-summary-47513d20e9864dcf84d40b8ace00b916.json | 4925 | ae8698b7e6459a3aa1c3fbee17f5c424c679aeb9d7f60f64ce5d4c4e11ee9a6a | No prior independently captured summary digest |
| v4.checkpoint | C:/ProgramData/Ecs.Lic008.WrappingV4/reboot-checkpoint.json | 2404 | 7417aae3163e3a35e0103303619844adcda021388c1816f02e8d288f10be62ea | Matches previously controller-reported EV0132 checkpoint |
| v5.summary | C:/ProgramData/Ecs.Lic008.WrappingV5/wrapping-summary-de5efc93255841619c9f86f2570af292.json | 5725 | 7a90250b5c520db757b27381b6cf995f90ce1486b03446d6314a8954de1734ef | No prior independently captured summary digest |
| v5.checkpoint | C:/ProgramData/Ecs.Lic008.WrappingV5/repair-checkpoint.json | 2265 | adb4aa66402c671f50d21bbcdca84dc619341ffc5108ea1c7bdcd7fb20a7b1d8 | Matches previously controller-reported EV0135 checkpoint |

Checkpoint comparisons are against historical reported values, not an issuer
signature or a new independent proof of every referenced role result.

## What is and is not reconciled

Original five hashes now captured successfully. Earlier unelevated ACCESS_DENIED
results remain true historical observations; elevation resolved reading, not by
relaxing ACLs or rerunning consumed tests. AG-002 is PARTIAL, not closed.

The original summaries/checkpoints were hashed as opaque bytes; this collector
did NOT parse their contents, validate scope/experiment/role identities, compare
every referenced evidence-file hash or remeasure DACLs. allFiveHashesRead=true,
fullEvidenceReconciled=false, securityAccepted=false, productionAccepted=false.
V2 summary has a different/earlier schema than V4/V5; follow-up must inspect its
actual bounded metadata rather than assume it lists modern evidenceFiles.

Next: read bounded metadata of these exact captured summaries/checkpoints in a
separately reviewed read-only collector; bind reads to the captured hashes and
validate referenced relative paths/sizes/identity before hashing each required
report/shared artifact. Record mismatches/missing/unavailable data without repairs.
No protected ownership files/private key/state secret is implicitly authorized.
If paths reference stale/unknown content, stop that reconciliation, preserve data.

LIC008/Open003 and NE-002 remain incomplete; native entry NOT_READY. No ordinary
user/TPM/Installer/Windows matrix/crypto harness test executed; no provider, runtime
or production acceptance. V1-V7 remain consumed; never run their controllers again.
No commit performed in this step.

## Validation

Collector PowerShell parser and inert fixed-five-target inventory PASS; unsafe
output traversal name refused before operations. Result contract checks PASS:
expected five unique IDs/HASH_READ/digests/sizes, elevated=true, two checkpoint
matches, full reconciliation/security/production=false. Docs resolver self-tests
and50 Markdown files/227 local targets PASS; git diff --check PASS. An initial
negative-test catch referenced a non-resolvable exception type; generic catch
with exact validation error-ID checking passed. No physical harness test invoked.
