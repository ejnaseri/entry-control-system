# Report identity v2 bounded review — 2026-10-15

Baseline:bbaab57. Result:PASS_LIMITED for the proposed implementation direction.
Reviewer: author/coding agent, not independent human or independent-agent review.
No new blocking discrepancy found in the scoped contract/runtime comparison.
This does not approve native Guardian behavior, a package, host or physical stage.

## Exact reviewed inputs

- report-identity-contract-v02.json SHA256
  83a90e0eaed1a1a60bd727a0f7dc7931875b10d6b959231b53757b6d4c3deaf7.
- implementation-packet-v04-draft.json SHA256
  949eb0806a38a71567c78b2ac0def9419e02435885d98d1d7dd4aa692b99d3b9.
- LICENSING_REPORT_IDENTITY_V02_ADOPTION_PLAN.md SHA256
  51655e6c48ba1c306d6b8c1dd441856122ac296894a3c251b461d7a676621ece.

## Findings / boundaries

1. Schema2 field order matches all42 runtime report fields. The three new JSON
   fields are required; zero/false are values, not substitutes for missing data.
   Schema1 has no implicit upgrade path. Internal synthetic fixture initializers
   do not override JsonRequired on external deserialization.
2. Native capture, independent observer and both controller validators share the
   role-specific policy. External expected SID is additionally plan/registration
   bound; report-supplied identity alone is not authority. Child binds to App.
3. Setup retains SYSTEM user/owner plus enabled service group; virtual accounts
   accept absent group only with count0/attributes0. Present disabled/deny-only,
   duplicate or incomplete observations remain refused. Controller's independent
   owner/elevation gate remains; filtered-history evidence is also required clear
   by the existing integrated MatchControllerOwner path.
4. tokenRestricted explicitly means ever-filtered TokenHasRestrictions, not the
   current restricting-SID count. Reader21 handles only successful1/4-byte values,
   with exact reads and failure refusal. R1 managed correction review is preserved.
5. Parent/child comparisons and independent observation/report comparisons carry
   count/restriction/query completion. No secret-bearing report fields added.
6. Maximum report sizes, result fields/status vocabulary and historical owner,
   crypto, journal, ACL and lifecycle rules are inherited, not newly certified.
   The inherited status vocabulary is a permitted envelope, not permission for
   arbitrary statuses in every operation; existing per-action restrictions stay.
7. Runtime/build still bind packet0.3 and refuse TestCapable. The proposed0.4
   direction requires a separate adopted successor and coordinated pin switch.
   Existing retained artifacts must never be reinterpreted as schema2 evidence.

## Checks rerun

Draft checker:4 direct reference hashes,42 fields/required attributes/inert guard,
28 negative checks PASS. Old successor checker:14 pins/32 negatives PASS.
Existing inert candidate32a308fdfc634c58b03febbbaa34272c SelfTest:1807 PASS
(same tests rerun, no new unique cases); physicalTested/securityAccepted/
productionAccepted remain false. No native service/key/ACL action performed.

## Recommendation

Record scoped product implementation-direction adoption separately, preserving
these reviewed bytes. Then construct an adopted successor0.4 referencing the
contract, review and decision; switch runtime/build/tool bindings in one tested
change while preserving physical refusal until separate built-kit review and
stage authorization. No automatic continuation of the retained failed Prepare.
