# V2 legacy evidence custody disposition — LIC-EV-0154

Date: 2026-10-07. Change: CHG0085. Coordinator/author assessment only.
Result: EXACT_ROLE_REPORT_IDS_NOT_RECOVERED_FROM_EXAMINED_SOURCES.
Disposition: LEGACY_HOST_OBSERVATION_ONLY_WITH_EXPLICIT_PROVENANCE_GAP.

## Requested three-stage procedure

1. Search existing source, documentation and historical output for exact V2
   report IDs. Completed; none recovered in the examined material.
2. If exact IDs are recovered, read/hash only those named report files.
   NOT_APPLICABLE this pass: stage1 did not supply authorized exact filenames.
   No protected-directory enumeration, inferred filenames or new elevated reads.
3. Otherwise preserve the gap and restrict V2 to historical observations.
   Completed below. No harness rerun, key/service/ACL mutation or repair.

## Examined inputs and verified pins

| Input | Verification / finding |
| --- | --- |
| [Current V2 controller](../../../licensing/windows-spike/wrapping-control-kit/Run-Wrapping-Harness.ps1) | Raw SHA256726d9607fe9ec9ab1fb1ec13391f2b3c4f50c8d835d0e63d34f694be0f76ac97 |
| Original package controller under out/lic008-wrapping-af2eac0d77324e2abad1df798bba9695/package | Same raw controller digest; inspected as text, not executed |
| Original0.9.3 ZIP in that exact out package | SHA256ba78c9502fe8cffb1734dc99877f83c78d013ca34e492fd6606dc06178d6a11a matches EV0126 recorded package pin |
| Original user attachment e08a1ecf-bcb6-4387-948a-7be7462b6632/Pasted text.txt | SHA2562210af0530307c1857d78281253af378ae78f9c5efa71206245552f57ffbc569 matches EV0126 transcript pin; tables and summary path only, no role RunIds/report paths |
| Current master/wrapping design, handoff and adapter ledger | Record summary name/transcript/package hashes, not exact V2 role report IDs |
| Git history for summary/transcript/experiment references | Relevant commits f40b8d5,1974a72,bf4be74; original f40b8d5 design records same summary/transcript/package references, no role IDs in those records |
| [Original summary custody](wrapping-retained-summary-hash-capture.md) and [metadata reconciliation](wrapping-retained-evidence-reconciliation.md) | V2 original summary hash-bound to65f72549d6638f0d30488d5372bd2384f282853ab3daf79b260ddd1d18f164a1,1888 bytes; experiment ddf935ad95bc4a1e8fcccba4b233bbb9; no evidenceFiles inventory |

Run-Wrapping-Harness.ps1 line38 creates a new random GUID for EACH Run call
and writes Role-reports/RunId.json. Line40 prints only Id,Status,Stage,Error.
Lines59-64 describe five scheduled runs: Setup/create, Guardian/verify,
App/probe, fresh Guardian/verify, Setup/cleanup. This expected sequence does
not reveal the actual random filenames or prove current file availability.
Line65 creates a SEPARATE random summary filename and stores experimentId but
no role-report ID list/hashes. Neither summary GUID nor experiment GUID can
be used to derive those random RunIds. Source inspection is not execution.

Search was bounded to repo docs/source/history and the exact known transcript
and package; it is not a claim that the original role files are absent/deleted
or that no other operator record could exist. An initial workspace out filename
inventory encountered unrelated ACCESS_DENIED fixture directories; no content
was read, permissions changed or elevated discovery performed there. Those
errors are unrelated to V2 custody and establish no V2 absence/corruption.

## Disposition and checklist effect

V2 retains EV0126's user-reported one-host Software-KSP observations and
EV0152/0153's original summary hash/metadata checks. Do not label its individual
role reports independently hash-reconciled, archive-complete or Security accepted.
Do not fabricate a manifest retroactively or use later V4/V5 evidence as a
replacement for missing exact V2 provenance. Later evidence keeps its own scope.

The three-stage investigation/disposition task is complete, but AG-002 remains
PARTIAL with an explicit LEGACY_V2_ROLE_PROVENANCE_GAP. This is documentation
of a known limitation, not a waiver or closure of the owning acceptance gate.
LIC008/Open003 and NE-002 remain incomplete; native entry NOT_READY. All six
native-entry prerequisite gates and original full-exit requirements unchanged.
securityAccepted=false; productionAccepted=false. No protected reads, physical
crypto tests, database/Installer changes or consumed-controller reruns this pass.

Reopen exact-report reconciliation only if a credible record supplies exact
RunIds, or a separately scoped protected-report discovery is explicitly approved
and reviewed. Current authorization did not require that broader discovery.
Do not rerun consumed V2 to recreate historical evidence.

## Next scoped work

Present the candidate ledger, EV0151 author scope assessment and EV0152-0154
custody results to an explicitly assigned non-author adapter reviewer/owner.
They must decide whether this legacy provenance gap is acceptable for the
bounded adapter-entry decision or requires additional independently scoped
evidence. The existing amendment scheduling review is NOT adapter approval.
Only then proceed through accepted versioned integration contracts and the
remaining prerequisite gates. No production Guardian/Store implementation
authorization is implied by this custody disposition.

Validation: original transcript and package SHA256 match historical EV0126;
packaged/current controller byte hashes equal; exact-name search results reviewed.
Documentation link self-tests and git whitespace checks run for these changes.
No new commit requested/performed in this step; previous uncommitted EV0153
follow-up is preserved.
