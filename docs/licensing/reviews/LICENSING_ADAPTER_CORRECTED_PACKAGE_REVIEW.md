# Independent corrected-package review — LIC-EV-0162

Date: 2026-10-08. Record: CHG0093 / LIC-EV-0162.
Baseline: a6b4719b848e8b0af8e1c78af75c2879725a690b.
Reviewer: /root/adapter_corrected_review, non-author technical agent.
Verdict: PROPOSED_DESIGN_DIRECTION_TECHNICALLY_COHERENT_WITH_ROUTING_CORRECTION_REQUIRED;
ADAPTER_ENTRY_NOT_ACCEPTED. NE-002 NOT_ACCEPTED; NATIVE-ENTRY NOT_READY.

## Exact reviewed inputs

| Input | Revision | Raw SHA256 verified |
| --- | --- | --- |
| [Decision draft](../plans/LICENSING_ADAPTER_ENTRY_DECISION_DRAFT.md) | 0.4 | 9ec3895975043ebd5e18dceb314396ea4016d9e4c9271f8adbef65b0e8aa6e6f |
| [Operation contract](../plans/LICENSING_ADAPTER_OPERATION_CONTRACT_V02.md) | 0.2 | cd877da8b41874739af15d99682cf4a3abb4d7f4c676b52629eb3e1d1ccb54e7 |
| [Claim index](../evidence/adapter-entry-claim-bindings-v2.json) | 0.2 | b3fb32ac723c72f5d45f82fa858fe1d5224fa1586b1a83a78a0720bdcaf21ea6 |

Reviewer accepted the bounded technical role and verified all three pins and
both recorded portable-interface source pins. Coordinator records the returned
conclusions; this is not independent human certification or physical attestation.
Reviewed inputs remain unchanged in this result-recording step.

## Findings and correction disposition

| Finding | Disposition | Remaining requirement |
| --- | --- | --- |
| ACR-001 | Structural correction satisfied: explicit claim/report/hash/result-ID/raw-status tuples and reboot/missing-key summary/checkpoint dependencies | Derived custody-chain consistency is not original physical authentication, source/binary equivalence or accepted claim sufficiency |
| ACR-002 MEDIUM | New routing precision defect: contract0.2 lines24 and34–38 describes Offline COMMIT_* names as unqualified existing Store rules | Explicitly preserve distinct Offline and Hybrid public error names; documentation correction only |
| ASR-002 | Evidence-qualified absence/provider/mismatch and unknown BAD_KEYSET handling improved; historical outcomes unchanged | Accepted Core/Audit mappings and fresh required negative evidence still open |
| ASR-004 | Candidate header534/AAD554/max-envelope1049126 arithmetic and independent expected-context requirements coherent | Accepted serializer/logical-hash reconstruction, golden bytes and executed parser/crypto/rollback vectors still absent |
| ASR-004 cleanup | Late output suppressed; live native buffer/handle retained until worker ends; no overlapping replacement on timed-out key | Accepted IPC/Gate hung-worker handling still required |
| ASR-001/003 HIGH residual entry blockers | Missing artifact sufficiency, exact scope acceptance, physical executors and accepted case placement accurately disclosed | Proposed placement and decision-role assignment do not complete these obligations |

ACR-002 exact existing interface distinction:

| Outcome | Offline completion | Hybrid trusted response |
| --- | --- | --- |
| Conflict | COMMIT_STATE_CONFLICT | TRUSTED_RESPONSE_CONFLICT |
| Pending | COMMIT_PENDING | TRUSTED_RESPONSE_PENDING |
| Invalid acknowledgement | COMMIT_ACKNOWLEDGEMENT_INVALID | TRUSTED_RESPONSE_ACKNOWLEDGEMENT_INVALID |
| Possible commit exception | COMMIT_OUTCOME_UNKNOWN | TRUSTED_RESPONSE_OUTCOME_UNKNOWN |

References: [Offline interface](../../../server/src/licensing/offline/entitlement-completion.ts)
and [Hybrid interface](../../../server/src/licensing/hybrid/trusted-response.ts),
Hybrid error enumeration lines106–114 at the reviewed baseline. Semantics agree;
unqualified names would incorrectly change Hybrid's public contract. Neither
interface should be changed to match the draft. No primitive failure fabricates
a Store receipt; primitive success remains separate from durable ACK/admission.

The index preserves operator-only AE-010 without original result tuples. AE-007
lines852–937/DEP-V4-REBOOT lines1114 onward and AE-009 lines985–1007/
DEP-V5-MISSING-KEY lines1128 onward provide explicit context dependencies. These
locations refer to the exact reviewed pins, not future revisions.

## Checks and limits

Four read-only reviewer tool calls; package checker PASS for14 claims/14 unchanged
reports, explicit tuples/dependencies, ten corrupted-index refusals and byte
arithmetic. Coordinator independently reran that checker successfully. These are
metadata/specification checks, not native cryptography or product test results.
No protected ProgramData access, elevation, controller rerun, key/service/ACL/
DB/Installer operation or subordinate reviewer delegation. No product code edits.
Sole decision owner PROJECT_OWNER_CURRENT_USER remains assigned. Physical case
executors remain NOT_ASSIGNED; proposed placements remain unaccepted. No NE,
LIC008/Open003, Store, TPM, Windows matrix or release gate closed.

## Smallest useful next task

Prepare one narrowly versioned routing correction for ACR-002, distinguishing
existing Offline and Hybrid names, and assess the exact corrected pin. Preserve
this reviewed snapshot and do not relabel it as corrected or accepted.
Then prepare the consequential PRE_ENTRY acceptance decision: required claim/
artifact sufficiency, accepted obligation placement and actual executor
assignments. No implementation permission follows from this review. This step
records findings only; no corrective contract edits or commit performed.
