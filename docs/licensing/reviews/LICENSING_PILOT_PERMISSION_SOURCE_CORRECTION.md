# A1 permission-source correction — 2026-10-16

Implements the finding in [V2 built-kit review](LICENSING_PILOT_V2_BUILT_KIT_REVIEW.md).
Status: IMPLEMENTED_AND_SYNTHETICALLY_TESTED; no approval issued or physical run.
Same-author verification only; not independent security acceptance.

## Changed boundary

The Prepare issuance helper no longer writes the fixed2026-10-13 permission
claim. It requires two additional positional arguments after the existing
--owner-approved-prepare flag: a reviewed permission-source file and its
separately reviewed raw SHA256. The legacy invocation refuses before file access
or helper execution. No default approval, reference or time is manufactured.

The new pure validator requires a bounded (16KiB), canonical UTF-8 JSON object
(JSON.stringify form, no BOM/newline/extra fields/duplicate properties):

- schemaVersion:1; scope:TEST_ONLY_REVIEWED_PREPARE_PERMISSION_SOURCE_V1.
- decision:APPROVE_PREPARE; stage:Prepare.
- ownerSid, provenanceSha256, successorPacketSha256: exact expected bindings.
- approvalReference:8–256 ASCII identifier characters identifying the actual
  owner decision in a reviewed external record; not a generated assertion.
- approvedUtc/expiresUtc: ISO UTC with .000Z, valid calendar timestamps, current
  and no longer than24 hours. Issued owner inputs expire at the earlier of the
  approval expiry or the helper's existing4-hour limit.

Validation occurs before review-helper invocation, again when establishing the
decision window, and before output publication. The raw source is copied into
the output and covered by its manifest; reviewed-permission embeds the validated
fields and source hash. The caller must review the reference and hash separately.
This metadata does NOT prove authorship, authenticate the owner, prevent all
issuance replay or supply live execution consent. Existing live confirmation,
protected reservation and stage gates remain mandatory and unchanged.

## Verification and remaining work

scripts/test-license-pilot-permission-source.mjs:45 checks PASS. In-memory
synthetic records cover valid/frozen output, missing/extra fields, pending/wrong
stage, wrong owner/package/successor, blank/invalid reference, historical/future/
expired/oversized windows, invalid timestamps, duplicate/noncanonical JSON,
oversized input and hash mismatch. Legacy CLI refusal was exercised in a child
Node process with a nonexistent candidate. Wiring/expiry/output assertions are
source checks, not an end-to-end capable issuance test. Syntax check PASS.

No real approval example was generated; no native role or issuance helper with
valid authority was executed. Pilot compiled source and prior inert kit are
unchanged, so no rebuild was needed for this tooling-only correction.

Next: prepare the explicitly scoped capable-build change and verify its new
artifact bindings/refusal gates, then obtain exact-candidate Prepare permission
before issuance/execution. Current TestCapable guard remains closed. The previous
V2 inert review does not authorize a capable binary. LIC008 remains open.
