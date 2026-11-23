# Adapter operation contract — proposed v0.2

Date: 2026-10-08. Record: CHG0092 / LIC-EV-0161.
ID: ADAPTER-OPS-01 revision0.2. PROPOSED_NOT_ACCEPTED.
Adds concrete candidate specifications to [preserved0.1](LICENSING_ADAPTER_OPERATION_CONTRACT.md);
OC-01..16 and existing Offline/Hybrid authority boundaries remain required.
Paired decision draft0.4 and [claim index0.2](../evidence/adapter-entry-claim-bindings-v2.json).
No code/protocol/production schema change; no test-only envelope is migrated.

## 1. Failure classification and existing-interface routing

Every result has draft adapter diagnostic, stage, operation correlation, output
availability and commitAttempted. These are local proposed fields, not new Core
states/public API fields. Success/failure never grants runtimeAuthority or durability.
Raw provider exception messages and private data are excluded from exposed output.

| Outcome | Minimum evidence required for classifier | Existing boundary/result routing; proposed Audit category |
| --- | --- | --- |
| ADP-F01 | Trusted retained-state/ownership record exists; exact key absence established separately from ACL/provider failure | Deny primitive; approved recovery coordinator may request existing RECOVERY_REQUIRED, not mutate Core locally; ADAPTER_KEY_ABSENT |
| ADP-F02 | Key reopen succeeds but exact provider/public identity/usage/export/DACL comparison fails | Deny primitive, preserve restriction; no automatic TAMPER_LOCKED transition without accepted C_GATE evidence mapping; ADAPTER_IDENTITY_MISMATCH |
| ADP-F03 | Provider unavailable positively diagnosed without interpreting BAD_KEYSET as absence | Deny primitive, ready=false; read-only retry budget below; ADAPTER_PROVIDER_UNAVAILABLE |
| ADP-F04 | Caller/profile/build/boot validation fails or required accepted configuration missing | Deny before protected call, no plaintext; ADAPTER_AUTHORITY_REFUSED |
| ADP-F05 | Fixed parser bound/encoding/context comparison or verified tag check rejects | Deny, no plaintext; ADAPTER_CONTEXT_OR_AUTH_REFUSED |
| ADP-F06 | Error/timeout/cancellation with ambiguous key/primitive outcome, or persistence may have been attempted | Unknown=true, admission denied; if actual existing Store commit threw, keep COMMIT_OUTCOME_UNKNOWN and commitAttempted=true; ADAPTER_OUTCOME_UNKNOWN |
| ADP-F07 | Fresh boot/process validation cannot establish all current identity/read-back conditions | ready=false; ADAPTER_READBACK_REFUSED, with independently established cause if available |
| ADP-F08 | All current authority/profile/key/context/tag checks succeed | Primitive output only. ACK still exclusively whole Store commit; ADAPTER_PRIMITIVE_COMPLETED |

Unclassified open failure, including isolated NTE_BAD_KEYSET, is ADP-F06 (or
ADP-F07 during readiness), never a definitive missing-key/denial finding.
Historical FAILED_OR_UNAVAILABLE statuses are never relabeled by this proposal.
Audit categories above are NEW PROPOSED C_AUDIT mappings, NOT deployed events.
Accepted Core/Audit owner review and case vectors still required.

Store receipts remain exact existing rules: CONFLICT -> COMMIT_STATE_CONFLICT;
PENDING -> COMMIT_PENDING; malformed/nonmatching ACK -> COMMIT_ACKNOWLEDGEMENT_INVALID;
thrown possible commit -> COMMIT_OUTCOME_UNKNOWN. No primitive failure fabricates
one of these receipts. Before commit, commitAttempted=false; after a Store attempt,
it cannot revert false because caller timed out. No changed Core error enumeration.

## 2. Concrete bounded container candidate, not frozen product schema

The following NEW proposed binary container is only a review/vector candidate.
It does not alter frozen signed-token CBOR or existing test JSON envelopes.
Production implementation/payload serialization still needs LIC6.5.002 approval.
Integers are unsigned big-endian; no optional/duplicate fields, padding or trailing
bytes. Bytes are snapshotted once; every length validated before allocation/native use.

| Ordered header field | Exact candidate bytes/value |
| --- | --- |
| magic | 8 ASCII bytes ECSSW001 |
| containerVersion / suite | uint16=1 / uint16=1; suite1 means RSA3072 OAEP-SHA256 + AES256-GCM only |
| purpose / Edition | byte1=LicenseState; byte1=FULL or2=ATTENDANCE; other values reject |
| installationId | 16 opaque bytes from trusted installation authority; same as Core installation-ID width |
| generation | uint64, restricted0..9223372036854775807 to match Core counter bounds |
| stateHash / wrappingSpkiHash / approvedProfileHash | 32 bytes each from trusted proposal/key/profile authority |
| ciphertextLength | uint32,1..1048576 |
| nonce | 12 fresh OS-CSPRNG bytes |
| wrappedDataKey | 384 bytes, RSA3072 OAEP-SHA256 wraps exactly32 bytes |

Header length is534 bytes. Follow with ciphertextLength bytes and16-byte GCM tag.
Maximum envelope is1048576+550=1049126 bytes. Zero-length plaintext rejected;
all larger or truncated/extra inputs reject before crypto. Suite/length fixed,
no algorithm negotiation or default conversion. Unwrap output must be exactly32
bytes; otherwise refuse and clear buffers.

AAD is exact ASCII ENTRY_CONTROL_SYSTEM (20 bytes) followed by the entire534-byte
header:554 bytes total. All identity/length/nonce/wrapped-key metadata is thereby
authenticated. Independent expected context reconstructs/compares purpose,
Edition, installationId, generation, stateHash, wrappingSpkiHash and approvedProfileHash
before tag-valid plaintext release. Ciphertext is NOT the source of that expected
context. Header cannot redefine profile limits or choose a provider.

stateHash is the existing Core logical-state hash, not assumed SHA256 of arbitrary
payload bytes. After authentication, accepted state serialization/parser must
recompute the Core logical hash and compare; until that serializer/schema and
anchor reconciliation are accepted, there is NO authoritative-state integration.
Same-context old envelope replay still requires C_TXN independent anchors/high-water;
GCM alone cannot distinguish rollback of the whole trusted snapshot.

## 3. Deadline, concurrency and cleanup candidate

| Operation | Proposed deadline / bound |
| --- | --- |
| ValidateOwnedKey | 5000ms monotonic elapsed budget |
| SealCandidate / OpenCandidate | 10000ms each; one active operation per key, at most8 queued requests |
| ReconcileReadiness | 30000ms budget under separate accepted transaction authority |
| Provider readiness retry | At most one explicit read-only retry after1000ms; counted inside budget; never retry Seal/commit |
| Diagnostic exposure | Fixed enum/stage and opaque correlation16 bytes; no provider exception strings or private identifiers |

Expiry denies delivery/admission and invalidates readiness. A synchronous native
call may not be cancellable: do NOT claim timeout stopped it, clear its live buffer
prematurely, release its handle while in use or start overlapping replacement work.
Mark unknown, suppress late output, retain ownership until the native worker ends,
then clear buffers/dispose. Hung worker/process disposition needs C_GATE/C_IPC;
no forced kill or host mutation authorized by this document.
Changed bounds require new profile/review, never silent increase to accept input.

## 4. Concrete planned vectors, all NOT_RUN

| Planned vector | Expected candidate outcome / original gate |
| --- | --- |
| ACV-01 1-byte,1048576-byte and1048577-byte payload | First two structurally permitted, last refused before allocation/crypto; ADP-P03 |
| ACV-02 truncate every fixed field/tag or append a byte | ADP-F05, no plaintext; ADP-P03 |
| ACV-03 wrong magic/suite/edition, uint64 above Core maximum | ADP-F05, no conversion/fallback; ADP-P03 |
| ACV-04 valid envelope with other install/Edition/generation/hash/profile | Independent expected context rejects; ADP-P03 |
| ACV-05 nonce/wrapped-key/header/ciphertext/tag mutation | Authentication/refusal, no partial plaintext; ADP-P03 |
| ACV-06 whole old same-context snapshot | Independent CAS/anchors required; no GCM-only PASS; ADP-P03/P07 |
| ACV-07 late native success after deadline | No delivered output/ACK/admission; cleanup only after worker ends; ADP-P02/P15 |
| ACV-08 unknown open cause vs proven missing retained key | Unknown stays F06/F07, only evidence-qualified absence F01; zero Create calls; ADP-P02 |
| ACV-09 PENDING/CONFLICT/bad ACK/exception from Store | Existing receipt/error semantics, no replay/rollback; ADP-P07 |
| ACV-10 secret-canary/raw exception in diagnostics | No secret exposure; approved Audit review required; ADP-P14 |

These are enumerated specifications, NOT generated golden bytes or crypto test
results. Native implementation, approved state serializer and vector execution
remain absent; no finding becomes accepted solely because limits are concrete.

## 5. Case responsibilities and obligation placement proposal

Decision accountability: PROJECT_OWNER_CURRENT_USER under EV0158.
Preparation owner: coordinator Codex for this user-authorized package correction.
Physical case executor: NOT_ASSIGNED for all15 ADP-P cases; no role guessed.
Review assignment/acceptance for this new exact package: PENDING.

| Cases | Proposed placement, NOT an approved deferral |
| --- | --- |
| ADP-P01 | PRE_ENTRY: required claim/artifact/host sufficiency binding and review |
| ADP-P02 | PRE_ENTRY: accepted failure contract; physical variants before corresponding protected-operation acceptance |
| ADP-P03 | PRE_ENTRY: expected-context/limits/format design acceptance; PRE_STORE_INTEGRATION: serializer/parser/crypto/rollback vectors |
| ADP-P04 | Explicit scope decision needed before entry; separate standard-user evidence still mandatory at original full exits |
| ADP-P05/P14/P15 | Before relevant product IPC/Setup/Audit/restart slice acceptance; preserve original gates |
| ADP-P06/P07 | Before actual Installer/Store lifecycle acceptance; original interrupted/uncertain-state obligations retained |
| ADP-P08 | Outside proposed Software scope; original LIC008/Open003/Store TPM exits retained |
| ADP-P09..13 | Final exact platform/product matrix before deployment; no fleet approval here |

This gives explicit proposed placement and named preparation/decision actors,
not a false named executor or approved waiver. Physical execution-owner choice,
required evidence sufficiency and placement acceptance remain open for the user
and non-author reviewer. No second person is made mandatory by this proposal.

## 6. Correction scope and remaining blockers

ACR-001 addressed structurally: new index has explicit claim/report/result-ID/
raw-status/hash tuples plus source summary/checkpoint dependency records for
AE-007/009. V6/V7 operator-only claims remain clearly without original result
tuples. Prior index/contract preserved unchanged in commit317d3f7.
ASR-002/004 have concrete proposed mappings/container/bounds/vectors now, NOT
accepted implementation evidence. ASR-003 proposal placement clarified; physical
executor assignment/approval still missing. Binary/source/manifest equivalence
NOT_ESTABLISHED. Final schema/payload serializer/Core/Audit review and scoped
acceptance remain required. NE-002 NOT_ACCEPTED/NATIVE-ENTRY NOT_READY.
No code/key/service/ACL/DB/Installer/physical test or existing protocol change.
