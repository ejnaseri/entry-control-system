# Adapter operation contract — proposed v0.3 routing correction

Date: 2026-10-08. Record: CHG0094 / LIC-EV-0163.
ID: ADAPTER-OPS-01 revision0.3. PROPOSED_NOT_ACCEPTED.

This narrowly versioned amendment corrects ACR-002 from the
[independent corrected-package review](../reviews/LICENSING_ADAPTER_CORRECTED_PACKAGE_REVIEW.md).
Read together with [preserved contract0.2](LICENSING_ADAPTER_OPERATION_CONTRACT_V02.md).
Only its ADP-F06 routing cell and unqualified Store-error paragraph in section1
are superseded below. All other0.2 requirements, bounds, vectors, responsibilities
and open gates remain unchanged. Draft0.4 and claim index0.2 remain unchanged;
this amendment does not retroactively change their reviewed pins or approval.

## 1. ADP-F06 routing correction

Ambiguous primitive/key outcomes remain unknown and deny admission. If an actual
Store commit attempt throws, preserve the owning workflow's existing error:
Offline COMMIT_OUTCOME_UNKNOWN; Hybrid TRUSTED_RESPONSE_OUTCOME_UNKNOWN.
For that commit attempt, commitAttempted=true. ADAPTER_OUTCOME_UNKNOWN remains
a proposed local Audit category, not a replacement public error or Core state.
Primitive failure without a Store attempt never fabricates either workflow's
commit error/receipt. No fallback, replay, recreation or local state transition.

## 2. Existing workflow-specific names, not a shared error enumeration

| Store outcome | Offline entitlement completion | Hybrid trusted response |
| --- | --- | --- |
| CONFLICT | COMMIT_STATE_CONFLICT | TRUSTED_RESPONSE_CONFLICT |
| PENDING | COMMIT_PENDING | TRUSTED_RESPONSE_PENDING |
| Malformed/nonmatching ACK | COMMIT_ACKNOWLEDGEMENT_INVALID | TRUSTED_RESPONSE_ACKNOWLEDGEMENT_INVALID |
| Exception during possible commit | COMMIT_OUTCOME_UNKNOWN | TRUSTED_RESPONSE_OUTCOME_UNKNOWN |

Source authorities: [Offline completion](../../../server/src/licensing/offline/entitlement-completion.ts)
and [Hybrid response](../../../server/src/licensing/hybrid/trusted-response.ts).
The Offline read-only confirmation path uses its existing COMMIT_* failure names
with commitAttempted=false; its commit path sets the field true after an attempt.
Hybrid's coupled trust/license commit path retains its existing names and
commitAttempted=true for these commit outcomes. Never normalize these names to
one shared prefix or change either interface to match an adapter diagnostic.

Before a Store commit attempt, commitAttempted=false. Once attempted it cannot
revert false because the caller timed out. CONFLICT/PENDING/invalid ACK remain
distinct outcomes; they are not automatically relabeled as a thrown unknown
commit. Exact generation AND hash validation, Hybrid coupled trust/license
commit, protected reconciliation after uncertainty and runtimeAuthority=NONE/
durable=false boundaries remain unchanged. Primitive crypto success is not a
durable Store ACK or admission authorization.

## 3. Validation and remaining status

Coordinator compared all eight names against the existing workflow sources and
checked documentation links/whitespace and the unchanged0.2 review package.
This is documentation/source-name consistency, not runtime or crypto execution.
ACR-002 is corrected in this proposal; exact non-author assessment remains PENDING.
No ASR/NE/full-exit acceptance follows from this edit. Required claim/artifact
sufficiency, accepted case placement, physical executors, serializer/vectors and
other native-entry prerequisites remain open. NE-002 NOT_ACCEPTED;
NATIVE-ENTRY NOT_READY. No backend/protocol/schema/key/service/ACL/DB/Installer
change, historical controller rerun or commit in this correction step.
