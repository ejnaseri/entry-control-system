# Inert identity integration — 2026-10-15

Latest: [R1 dedicated reader correction](RESTRICTION_LENGTH_CORRECTION.md) is
implemented/managed-tested; bounded re-review pending, physical entry still closed.

Review override: [bounded review](IDENTITY_INTEGRATION_REVIEW.md) found blocking
R1 (TokenHasRestrictions returns one byte locally; helper requires four).
Status CHANGES_REQUIRED; passing managed tests below do not clear this finding.

This supersedes the pure-only implementation status, not frozen adoption bytes.
Original retained package, keys, services and prior reports remain unchanged.
Current runtime source is a NEW inert candidate; do not compare it to the old
source manifest as if it were the same executable.

## Implemented

- NativeTokens captures actual matching group count and TokenHasRestrictions,
  requires successful bounded queries, and rejects duplicate groups. Snapshot
  evidence has no implicit constructor defaults. Controller remains separate.
- Shared ServiceIdentityPolicy applies to native capture, single/final controller
  admission and independent ProcessObserver validation. Exact plan/role binding,
  primary token, owner, no impersonation and role-specific group rules remain.
- Report schema2 has42 fields. Three new fields are JsonRequired:
  serviceSidGroupCount, tokenRestricted, tokenQueryComplete. Raw observations
  are preserved; absent does not become ENABLED. Old schema1 reports are refused,
  not upgraded or reinterpreted. Native Build explicitly supplies all three.
  Property initializers exist only for internal synthetic test fixtures;
  deserialization still requires the fields, including false and zero values.
- ControllerWindows and ProcessObserver compare all snapshot fields. Parent/child
  report checking and final App/Child comparisons include the new evidence.
- Builder refuses -TestCapable with REPORT_V2_ADOPTION_PENDING. This source must
  not create a physically enabled delivery kit until successor contract/bindings
  and review are completed. Existing reviewed protocol files are not edited.

## Verification and limits

Final build: out/lic008-pilot-runtime-candidate-ac14708e086b4ebf9748ce5fb14ef64a.
1780 unique managed cases PASS; same cases rerun in self-contained package and
extracted bound wrapper, not additional unique cases. Native/controller/apphost
entry refusals PASS; complete builder exit0. TestCapable guard refusal verified.
Frozen successor14 transitive pins/32 negative checks PASS (preservation only,
not schema2 adoption). Documentation links and diff whitespace checks PASS.

Added matrix tests, schema1 rejection, missing required JSON fields, invalid
counts/restriction/query completion, absent-group round-trip, full inert stage
acceptance and independent observer agreement; tampered reports are tested in
both controller validators. Actual child, native token query and Windows matrix
remain physically untested with these changed bytes.

The new absent-group integration test initially failed because ProcessObserver
still required an enabled group. That duplicated predicate was replaced with
the shared policy before the final build. The earlier1723-case build is an
intermediate artifact, not the final integration result.

Next: bounded review of schema2 and successor adoption/hash binding, not Prepare
retry or in-place replacement. Partial original experiment stays retained;
securityAccepted and productionAccepted remain false, full cases accepted0/5.
