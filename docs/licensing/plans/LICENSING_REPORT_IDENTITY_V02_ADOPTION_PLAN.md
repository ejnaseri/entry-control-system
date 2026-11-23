# Report identity v2 successor adoption plan — 2026-10-15

Status: DRAFT_REVIEW_AND_ADOPTION_PENDING. Preparation only; no decision is
silently recorded as owner approval. Baseline R1 re-review commit4f78b62.

## Exact proposed delta

[Closed contract](../../../licensing/adapter-evidence/pilot-implementation/report-identity-contract-v02.json)
overlays implementation packet0.3, without changing its frozen bytes or inherited
owner confirmation, replay, file ACL, crypto, process observation or stage rules.
Report schema2 adds three required fields to the previous39, preserving order:
serviceSidGroupCount, tokenRestricted, tokenQueryComplete. Result schema and bounds
stay unchanged. tokenRestricted means TokenHasRestrictions/ever filtered, not a
restricted SID count. Only successful1/4-byte native responses are understood.

Virtual Guardian/App/actual Child require exact expected user/owner SID and primary
token; group may be absent with count0/attributes0, or count1/enabled/not deny-only.
Setup still requires SYSTEM user/owner and one enabled service group. All cases
reject duplicate, unknown, impersonated or filtered evidence. Child binds to App.
Controller's independent owner/elevation checks stay intact. A report's own SID
is never sufficient to establish which role/process was authorized.

Both report admission paths and independent process observer must agree with
the live snapshot. Missing required fields and schema1 are refused. Existing
schema1 reports/keys are retained as historical evidence, not converted.

## Binding and decision sequence

1. Review this plan, the closed contract and draft packet0.4's exact raw hashes.
   The checker verifies bindings and narrow invariants, not security acceptance.
2. Record a separate bounded product adoption decision only after review/owner
   authorization. Do not rewrite frozen review/adoption bytes. Draft flags are
   historical when a later separate decision exists; never auto-flip them here.
3. Produce the adopted successor packet/checker and change runtime/build pins
   together. Existing implementation remains inert and pinned to0.3 until then;
   passing source comparison does not mean0.4 is installed or approved.
4. Build/review a new inert package, then separately resolve physical placement
   with the retained failed experiment. New owner host/kit/stage authorization
   is necessary before physical capability or execution. No automatic cleanup,
   Prepare retry, reuse of old approval, or in-place binary replacement.

## Scope and non-goals

The sole human owner remains decision owner; author review is not independent
human security review. No Windows matrix/Guardian/native success is inferred
from1807 managed tests. Full accepted physical cases remain0/5.
This task adds no production Guardian, cryptographic algorithm, ACL or recovery
operation. Existing TestCapable build refusal remains active.
