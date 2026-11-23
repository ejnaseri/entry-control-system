# Independent bounded adapter-entry review — LIC-EV-0155

Date: 2026-10-07. Record: CHG0086 / LIC-EV-0155.
Reviewed baseline: e61172eb99d1eea9c1b18209a084b2053435524e.
Verdict: INDEPENDENT_TECHNICAL_REVIEW_COMPLETED_ADAPTER_ENTRY_NOT_ACCEPTED.

## Assignment and independence

User explicitly requested committing current work first, then an independent
security-adapter review. Coordinator committed e61172e, then assigned non-author
agent /root/adapter_security_review. Reviewer explicitly accepted the bounded
technical Security reviewer role for this assessment. It is not Windows Security
decision ownership, an external human officer role, production acceptance or a
waiver of the adopted policy. Coordinator transcribes the returned conclusions
here; this file is not an author self-approval or a new physical test result.

Inputs: [candidate ledger](../plans/LICENSING_ADAPTER_ENTRY_EVIDENCE_LEDGER.md),
[author assessment](LICENSING_ADAPTER_ENTRY_SCOPE_ASSESSMENT.md),
[adopted scheduling v2](../plans/LICENSING_NATIVE_ENTRY_AMENDMENT_V2.md),
[adoption](../plans/LICENSING_NATIVE_ENTRY_ADOPTION.md), relevant native helper/
V2/V5/V7 source and collectors, and [EV0152](../evidence/wrapping-retained-summary-hash-capture.md),
[EV0153](../evidence/wrapping-retained-evidence-reconciliation.md),
[EV0154](../evidence/wrapping-v2-legacy-custody-disposition.md).
Existing ledger raw pin5f6612a8fec22e1ec7c36fbf8c8cdc946b699d957dd51768d1048099047f1266
and amendment pin88dc75f17f85f0a57e05d2a6a9648800637a1b1b3d0611a257c3a0e541fd1444
remain unchanged. The old NOT_ASSIGNED reviewer statement is historical; this
record supplies review assignment/performance only, NOT scoped approval.

## Findings

| ID | Severity / consequence | Independent finding | Required disposition |
| --- | --- | --- | --- |
| ASR-001 | HIGH, entry blocker | Adopted section2.1 requires Windows Security decision owner and assigned reviewer acceptance. Review is now assigned/performed, but decision owner and accepted scope remain absent; AR-001/006 unsatisfied | Explicit owner designation and exact bounded scope approval; no owner inferred from reviewer assignment |
| ASR-002 | HIGH, entry blocker | AR-004 failure/operation contract is unaccepted. Broad FAILED_OR_UNAVAILABLE covers observed V5 controlled missing-key refusal, not provider outage/identity/ACL/uncertain-result/recovery classification | Pin versioned permitted operations and fail-closed contracts. Missing/unproved/unavailable paths cannot trigger replacement creation, fallback, replay or admission; resolve AR-002/004 |
| ASR-003 | MEDIUM, entry-blocking documentation | AG-003..008 placement is proposed. Role categories do not supply named owners, exact test IDs and acceptance criteria required by adopted policy | Owned scope/test/criteria ledger for every residual case, under original mandatory gates; resolve AR-005 |
| ASR-004 | MEDIUM, source-reuse constraint | V7 OpenEnvelope uses supplied authenticated AAD, not independently reconstructed expected installation/Edition/generation context. Whole valid old-envelope replay is not tested by byte-mutation matrix | Do not import harness as authoritative-state adapter. Pin expected-context/format constraint; final schema/parser/rollback vectors remain NE-003/LIC6.5.002 |

Reviewer evidence locations at baseline: amendment lines47/59; candidate ledger
line7; author assessment lines44/55; V5 controller line179; V7 Program lines259,
271 and350. Relevant sources:
[V5 controller](../../../licensing/windows-spike/wrapping-repair-kit/Run-Wrapping-Repair.ps1),
[V7 Program](../../../licensing/windows-spike/wrapping-reinstall-control/Program.cs).
ASR-004 is a limitation on source reuse, not a newly observed deployed customer
vulnerability. A valid GCM tag authenticates supplied bytes; it alone does not
prove those bytes belong to the expected authoritative context/current generation.

## V2 and evidence reuse determination

Reviewer accepts EV0154's LEGACY_HOST_OBSERVATION_ONLY disposition as technically
honest, not closure/waiver of AG-002. Random role RunIds cannot be reconstructed
from summary/experiment IDs. Missing exact V2 provenance need not itself block
a narrowly specified development decision that explicitly EXCLUDES V2 as
required evidence and maps each required claim to applicable V4/V5/V6/V7 results.
This conditional determination does not automatically establish their sufficiency
or approve that decision. V2 cannot support a uniquely required unresolved claim.

V4/V5 listed-file custody and role identities are reconciled; V6/V7 keep recorded
operator provenance, not independent physical attestation. V4 reboot, V5 missing-key
refusal and V6/V7 lifecycle simulations establish different observed boundaries.
Later cases cannot replace an earlier distinct required case by naming them newer.

| Requirement / disposition | Independent conclusion |
| --- | --- |
| AE-001..005/008/011 | Historical one-host feasibility reusable within limits, not product identity/security approval |
| AE-006 | Filtered-admin observation only; separate standard account untested |
| AE-007/009/010 | Distinct reboot, controlled repair/missing-key, upgrade/reinstall simulation observations reusable with their own provenance |
| AE-012..014 | Native transactional Store, TPM and product/platform matrix unimplemented/unaccepted |
| AR-003 | Custody substantially improved; accepted claim-to-evidence/artifact/host binding still required |
| AG-009 | Independent review performed, acceptance WITHHELD; combined approval gap not closed |

No NE gate becomes complete. NE-002 remains NOT_ACCEPTED; native entry NOT_READY.
LIC008/Open003/full exits unchanged. All other NE prerequisites still mandatory.

## Reviewer checks and limits

Read-only repo source/documents and available workspace diagnostic inspection.
Reviewer reports eight explicit ledger/amendment/source/collector/report SHA pins
matched; inert collector ValidateOnly passed accepted-reference fixtures and ten
unsafe/duplicate refusals. Available diagnostic matches documented SHA, V4 has10
reference rows, V5 has12 and V2 none. Overall acceptance/full-reconciliation flags
remain false; V5 negative statuses remain FAILED_OR_UNAVAILABLE, not relabeled PASS.
Collector validates fixed bounded allowlists and parses the same hashed snapshots;
shared artifacts remain hash-only. These checks are not fresh crypto/Windows tests.

No reviewer file edits, protected-directory reads, elevation, controllers, services,
CNG, ACL changes or physical test. Current keys/DACLs, executable/source equivalence
and broader Windows compatibility were not independently retested. Coordinator
removed one excess blank EOF line after baseline commit, cosmetic only; review
still targets e61172e. Commit whitespace check had that warning, now corrected.

## Minimum next scoped task

Prepare ONE versioned adapter-entry decision/profile containing:

1. Exact single-host Software-KSP development scope, permitted operations and
   separate test/product SID rules; no TPM/fleet/production approval.
2. Expected-context/format and failure/restart/read-back contracts, no implicit
   fallback/recreation/replay/admission on unknown or unavailable results.
3. Required claim-to-evidence and artifact/host pins, explicitly excluding V2
   from required evidence and preserving all original provenance limits.
4. Residual cases with owner, exact test IDs, acceptance criteria and owning gate.
5. Explicit Windows Security decision-owner designation and submission of the
   exact resulting document to the independent reviewer for scoped acceptance.

Unassigned owners remain unassigned, not filled by guesses. A human officer is
not introduced as a new mandatory requirement; explicit appropriate role
designation and scoped acceptance are required. Do not start production native
implementation before all NE gates and separate slice authorization are accepted.
Review-result documentation is new uncommitted follow-up, not a second commit.
