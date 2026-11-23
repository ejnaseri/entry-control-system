# Adapter operation contract — proposed v0.1

Date: 2026-10-07. Record: CHG0090 / LIC-EV-0159.
Contract ID: ADAPTER-OPS-01. Status: PROPOSED_NOT_ACCEPTED.
Prepared after user-requested baseline commit b1ad38f2a5f289c52f1a9823fc6e197ce032d41c.
Paired [decision draft0.3](LICENSING_ADAPTER_ENTRY_DECISION_DRAFT.md).
No product interface/schema/crypto implementation change. The following are
proposed normative requirements to review, not evidence of implemented behavior.

## 1. Authority boundary and concrete existing interfaces

Existing [OfflineEntitlementCommitAdapterV1](../../../server/src/licensing/offline/entitlement-completion.ts)
requires generation AND hash CAS and whole-state/journal/outbox/anchor commitment;
confirm is read-only. Its completion keeps durable=false/runtimeAuthority=NONE,
including adapter acknowledgement. Source pin at preparation:
7507ba2a16b3fc0a3b69aac4084ca9acf94394849b393b198520f30cc400c99d.

Existing [HybridTrustedResponseStoreV1](../../../server/src/licensing/hybrid/trusted-response.ts)
requires trust AND license baselines, complete coupled transaction, no sequential
split commits, and protected read-back after pending/unknown outcomes. Source pin:
5042c0b78fb0898fefff28e72e2c0a98dec77295226361533b3f0b582b209a4f.
These are portable interface requirements, not implemented Windows durability.

This adapter supplies crypto/readiness primitives below those boundaries. It
cannot replace CAS, validate licensing entitlement, issue business admission,
publish authoritative state, manufacture a Store ACK or implement a commit by
encrypting a file alone. No new ADP code maps silently to existing Core state.
Full C_TXN/C_CLOCK/C_GATE/C_IPC/C_AUDIT/C_RECOVERY acceptance is still required.

## 2. Operation inputs and allowed outputs

All requests originate inside authenticated Guardian work after its bounded
service start callback, not arbitrary App/Node paths. Logical fields below are
not a CDDL, public DTO or frozen binary encoding. Unknown fields/profiles reject.

| Operation | Required immutable input authority | Allowed output / side effects |
| --- | --- | --- |
| ValidateOwnedKey | Accepted artifact/profile, exact existing ownership record/public key identity and current process/boot/caller binding | Bounded readiness evidence or typed failure; no key/ACL/file creation or replacement |
| SealCandidate | Validated key, authenticated transaction proposal, expected new generation/state hash/context, bounded whole-state bytes | Candidate encrypted envelope to trusted transaction only; no persistence/ACK/admission; new randomness for each attempt |
| OpenCandidate | Validated key, immutable bounded envelope, independently trusted expected installation/Edition/generation/key/domain context | Authenticated plaintext to trusted Guardian transaction memory only; never App IPC; no reset, migration or automatic write |
| ReconcileReadiness | Protected read-back coordinated by existing transaction/recovery authority after invalidation | Evidence requiring further decision; cannot turn unknown commit into success or replay stale proposal |

Key creation/purge is outside this contract. Separate accepted signed SYSTEM
Setup/ownership intent is required. Validate/Open failure never invokes Create.

## 3. Required invariants and planned verification

Each OC identifier is a proposed contract requirement, not an executed test.
ADP-P references refer to the NOT_RUN plan in the decision draft.

| ID | Proposed precise requirement | Planned verification / original owner gate |
| --- | --- | --- |
| OC-01 | Exact accepted artifact/profile/provider/algorithm and OS/architecture match before any protected call; unaccepted TPM/platform cannot substitute | ADP-P01/P08/P09..13; NE-002/LIC008/Windows matrix |
| OC-02 | Caller/process/build/boot/generation-bound internal request verified before work; forbid arbitrary sign/decrypt proxy or App key handle/plaintext | ADP-P05/P14; C_IPC/LIC6.4.001..003 |
| OC-03 | Reopen exact existing owned key; read-back machine RSA3072/usage/export/DACL/provider/public identity; reject missing/unknown/mismatch with zero creation/ACL edits | ADP-P02/P05/P15; LIC008/C_IPC |
| OC-04 | Caller buffers snapshotted before first await; accepted strict parser rejects duplicate/unknown/oversize/truncated fields and integer/length overflows before crypto output | ADP-P03; C_FILE/LIC6.5.002 |
| OC-05 | Expected context sourced from accepted installation and current transaction authority, not copied from envelope; installation/product/Edition/generation/domain/key/purpose compared | ADP-P03; NE-003/C_TXN/LIC6.5.002 |
| OC-06 | Deterministic context/AAD encoding and authenticated metadata coverage pinned by final schema/vectors before integration; missing encoding/limit configuration denies use | ADP-P03; LIC6.5.002, no prose-as-schema approval |
| OC-07 | Whole valid envelope substitution across context rejected; same-context replay checked against independent state/anchors/high-water, never accepted by tag alone | ADP-P03/P07; STORE001-005/C_TXN |
| OC-08 | Fresh OS-CSPRNG32-byte data key and12-byte nonce for every seal attempt; OAEP-SHA256/SILENT, GCM tag16; unknown outcome never retries with reused entropy | ADP-P02/P03/P07; LIC008/LIC6.5.002 |
| OC-09 | Plaintext/data key cleared on all exits, including cancellation/timeout/provider failure; no partially authenticated plaintext released; private state absent from logs/IPC/errors | ADP-P02/P14; C_AUDIT/C_IPC |
| OC-10 | Fresh-process/boot, key/policy/context change, provider error or unknown operation invalidates cached readiness; revalidate across relevant awaits, no historical PASS lease | ADP-P02/P15; C_CLOCK/C_GATE/LIC6.4.001 |
| OC-11 | Absent key with retained state invokes approved recovery restriction, not fresh install; identity/ACL mismatch preserves evidence; provider outage never weakens provider | ADP-P02/P06; C_RECOVERY/LIC008 |
| OC-12 | Exception, timeout/cancellation after possible side effects means uncertain outcome, not no-change or success; reconcile without rollback/replay before further protected admission | ADP-P02/P07; existing completion/C_TXN/C_GATE |
| OC-13 | ACK only from whole durable transaction with exact expected generation AND hash (Hybrid also trust baseline) plus journal/outbox/anchor obligations; encryption success never ACK | ADP-P07; existing interfaces/STORE001-005 |
| OC-14 | Duplicate/read-only confirmation must match current protected generation AND hash with zero writes; stale proposal cannot be submitted automatically after conflict | ADP-P07; existing Offline/Hybrid interfaces |
| OC-15 | Redacted bounded correlation/status/operation-stage diagnostics only; no key names/private ownership bytes/plaintext/provider exception text exposed to App | ADP-P14; C_AUDIT, approved redaction taxonomy required |
| OC-16 | Signed Repair/Upgrade/Reinstall preserve exact key/state identity; changed artifacts invalidate relevant acceptance; explicit purge/format migration separately reviewed | ADP-P06/P15; LIC6.4.006/C_RECOVERY |

The signed/pinned product configuration must define concrete maximum input/
ciphertext/context sizes, deadlines and accepted encodings before use. They are
not invented here: no configured/accepted bounds means PROFILE_UNPROVED and
operation refusal, not unbounded parsing. Final schema/vectors remain OPEN.

## 4. Failure mapping and no-retry boundary

| Draft diagnostic | Required operation result / authority | Forbidden action |
| --- | --- | --- |
| ADP-F01 key absent with retained state | Denied; accepted RECOVERY_REQUIRED routing and preserve state | Replacement key, empty reset or relabel as fresh install |
| ADP-F02 identity/policy/ACL mismatch | Denied; redacted evidence and reviewed recovery decision | Auto-ACL repair, alternate key or downgrade |
| ADP-F03 unavailable provider | Denied; bounded explicit read-only readiness retry only when authorized | Provider/DPAPI fallback, replay Seal/commit or reuse nonce |
| ADP-F04 unauthorized/unproved profile | Denied before protected call; no candidate/plaintext output | Guess compatible provider/build or call through App |
| ADP-F05 malformed/context/auth failure | Denied, no plaintext/output/state write; clear temporary buffers | Accept supplied AAD/old valid envelope as current authority |
| ADP-F06 uncertain operation/commit | Denied until C_TXN protected reconciliation; preserve correlation/evidence | Return ACK/unchanged, compensate rollback or blind retry |
| ADP-F07 failed restart/read-back | Readiness invalid, no lease until accepted same-identity/current-state proof | Recreate or trust cached PASS |
| ADP-F08 verified primitive success | Candidate/crypto/readiness success ONLY; store/runtime authority NONE | Treat success as entitlement validity, durable activation or admission |

Broad historical FAILED_OR_UNAVAILABLE and raw NTE_BAD_KEYSET must not be
translated by code-only heuristics into definitive absence/denial. ADP codes
remain proposed diagnostics, not changes to public Core error/state contracts.
Detailed approved condition/evidence-to-Core/Audit mapping is a review blocker.

## 5. Evidence binding package and unresolved work

[Machine-readable candidate index](../evidence/adapter-entry-claim-bindings-v1.json)
binds all14 AE claims to exact filtered V4/V5 report IDs/result rows and digests
where available. It preserves raw statuses and distinguishes custody from crypto
meaning. V6/V7 remain indexed operator evidence, not original reports reread now.
V2 explicitly excluded as required evidence; no new protected read/elevation.

Package source: EV0153 diagnostic SHA256
6919bad991a3817e54ca79ffe785a6c09a8c49dcace8b514f488b01cd7cde5b8.
This is a derived review index, NOT a signed manifest/runtime authority or fresh
physical test. Accepted exact binary/source/manifest/toolchain equivalence remains
NOT_ESTABLISHED; version strings are not substituted for those missing links.

Named decision owner PROJECT_OWNER_CURRENT_USER remains accepted under EV0158.
Case execution owners remain NOT_ASSIGNED; proposed accountability may be held
by Project Owner with technical preparation coordinated by Codex, but fifteen
case assignments/execution are NOT inferred from decision-role acceptance.
Do not add another automatic role-confirmation barrier for each document:
the existing scope/evidence contract and case-placement choices remain explicit.

Next submit exact contract/draft/index pins for non-author assessment, resolve
required artifact/limit/schema bindings and case owners before their operation
or acceptance. This preparation does not turn any ASR finding, AR/AG or NE gate
green. Original full exits and all other NE prerequisites remain mandatory.

## 6. Preparation validation

Read-only inspection of existing portable interfaces and available workspace
filtered diagnostic; source pins captured. Sixteen unique OC requirements map to
planned cases/original gates;14 AE claims have only valid in-index report refs.
Fourteen V4/V5 role records preserve exact source digests/raw statuses. Negative
V5 report stays FAILED_OR_UNAVAILABLE. Overall full/security/production flags
false; V2 absent from required report references. JSON parse/link/structure and
whitespace checks run, not cryptographic/native/runtime acceptance tests.
No protocol/vector/backend code changes, host mutations, new physical tests,
new owner/approval inference or second commit in this preparation step.
