# Owner authority / durable consumption proposal: final bounded author review

Date: 2026-10-12. CHG0142 / LIC-EV-0211.
Status: FINAL_PROPOSAL_REVIEWED_BY_AUTHOR_ADOPTION_PENDING.

Baseline130906d; initial git clean. Implementer review, not independent security
acceptance. No real owner stage approval or native operation is recorded.

## Reviewed exact inputs

- [Final proposal0.1](../plans/LICENSING_PILOT_OWNER_AUTHORITY_PLAN.md), SHA256
  `36cd7081505f0b5ddc616939f2ecc110ed6629e7845f87c3f2d23578410c77b1`.
- [Machine-readable closed contract](../../../licensing/adapter-evidence/pilot-implementation/owner-authority-contract-v01.json),
  SHA256 `a4537539bdeda1fcf60e2c52799cf91b75c8f1906dc97fece11ddbeaf99d8983`.
- Preserved packet0.2 and owner-connection review are pinned by that contract;
  all three raw references verified. Existing runtime still consumes packet0.2,
  not this proposal. No frozen source/spec/adoption hashes changed.

## Review findings resolved in final proposal

1. Schema ambiguity: section5 now fixes ordered context/consumed fields, scopes,
   all-required types/case, bounded canonical JSON, RESERVED-only state, false
   security/production flags and exact previous-stage pin requirements.
2. Circular/self-claimed trust: owner context is separately pinned through the
   owner-reviewed configuration channel, not read from its own request. Input
   and existing decision pins remain external; no new context digest is inserted
   into the already hashed plan/profile to create a hash cycle. Missing trusted
   configuration refuses. Runtime producer implementation remains pending.
3. Consent ambiguity: real input/output console, exact pin-bearing challenge,
   explicit live owner token and direct producer provenance; challenge hash or
   ValidateOwnerInput diagnostic cannot construct authority. No auto-yes,
   credentials, impersonation or historical-issuer/signature claim.
4. Restart/different-decision race: one fixed slot per stage, CREATE_NEW only,
   no sharing while writing, independent same-protection readback. Existing/
   empty/malformed/unknown slot blocks regardless of a newly issued decision ID.
   Earlier slots must match completed predecessor evidence and have distinct
   IDs. Same-slot concurrent losers cannot proceed; no checkpoint-as-intent.
5. Bootstrap/crash: only new root/controller creation precedes Prepare journal;
   crash then leaves root collision and blocks any replay/adoption. Journal
   readback must precede copies/service/key operations. Stage continuation needs
   private live proof directly created by actual verified I/O, not caller DTOs
   or proof reconstructed after restart. No automated repair/rollback/cleanup.

The proposal is internally bounded for gated implementation AFTER scoped adoption
and successor binding. This conclusion is not owner product adoption, independent
review, implementation, durability evidence or physical execution permission.

## Evidence and remaining acceptance

New read-only check-license-pilot-owner-authority.mjs validates the exact closed
proposal plus three reference digests and33 negative cases. Does not execute a
consumer, token, filesystem journal or service. Previous688 runtime cases remain
historical evidence; not rerun/newly increased by this documentation step.

Still pending: actual trusted owner-context producer/console confirmation,
amended allowlist and bootstrap implementation, private reservation proof,
native ACL/flush/readback, new-process/reboot replay tests and ambiguous writes.
Power-loss durability not proven by Flush(true); malicious-admin resistance,
remote signed approval, product release and fleet compatibility not claimed.

Next scoped adoption and hash-bound successor packet, then implementation while
physical entry remains closed. Owner is the sole human product/security decision
owner; no independent reviewer invented. Physical0/5 and licensing/security gates
unchanged. [Exact checkpoint](../experiments/LICENSING_PILOT_FOUNDATION.md).
