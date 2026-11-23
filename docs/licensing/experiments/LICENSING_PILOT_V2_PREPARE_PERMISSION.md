# V2 Prepare owner permission — 2026-10-16

Reference: docs/licensing/experiments/LICENSING_PILOT_V2_PREPARE_PERMISSION.md

The owner explicitly replied in the current conversation:
«اره تایید میکنم همین چهار مورد رو انجام بده»
following the four-step proposal for Prepare of the newly reviewed V2 candidate.
This records that actual permission, not the historical2026-10-13 approval.

Scope: Prepare only for candidate
out/lic008-pilot-runtime-candidate-4c7923163636489a86768c96c12165f8,
provenance SHA2564296ff854c75e6b5a1685a12ee1741ee75139fc9e504d313db137f7b60873b4d,
successor0.5 SHA2568d6b30a67a7060b1e343b1fa485c11f460698d20017bc48da597fcd67757ea30,
owner SID S-1-5-21-3058020570-171625005-1532683838-1001.

Permitted effects: protected EntryEvidenceV2 root, reviewed package copy,
three V2 test service registrations and Prepare actions including two test keys.
No V1 changes/adoption/cleanup, production changes, reboot, retry or later stage.
On failure retain state and inspect evidence before any further mutation.

Local permission-record window:2026-10-16T13:14:00.000Z through
2026-10-16T17:14:00.000Z. This bounds use of the approval; it is not an asserted
message timestamp. Issued input expiry cannot exceed this window.

Current agent process is non-elevated, matching the owner SID above. Preparation
does not authenticate a live elevated owner. The actual owner must confirm in
an Administrator PowerShell console; the agent must not supply that confirmation.
Prepare outcome remains pending; no execution success or security acceptance.

## Issuance result

Permission source raw SHA256:
f3a0f06c1f00d55c871ee9b84ed21e03326c44806f82318debfa651e2e448646.
Helper issued fresh inputs at
out/lic008-prepare-approved-cba763a0778fb2585628edd02a64d866.
Issued2026-10-16T13:16:48Z; expires2026-10-16T17:14:00Z (21:44 Kabul).
Owner-context SHA256:
4507122351dd4abbf79bf228c99f89104bd72f90e86dcac185cfbecb0257a73b.
Owner-input SHA256:
942b2d9cab5c72a6ca3a0af33218fe2091bbcba032eefc988bf0238af625df66.
Controller-input SHA256:
6c2d0cf590ddf9cc1621c647188c1a8e9bc4978d6f7e1b6b2dfa7ea00a2457a9.

Both compiled input validation checks passed; wrong-decision-hash and expired
decision refused (2 positive,2 negative). Source/package/archive/host were
rechecked by the read-only helper. physicalExecuted=false and live owner
authentication still pending. Do not regenerate/retry to bypass expiry or a
partial execution; inspect actual state first. Await user console output.
