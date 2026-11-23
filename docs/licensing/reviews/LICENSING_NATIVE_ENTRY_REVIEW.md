# Native-entry amendment v1 — targeted security/dependency review

Date: 2026-10-07. Scope: FULL and ATTENDANCE.
Status: `CHANGES_REQUIRED_NOT_INDEPENDENT_APPROVAL`.
Record: CHG0076 / LIC-EV-0145.
Reviewer: Codex, the amendment author, in a separate targeted review pass.
This is NOT independent Security approval. No assigned Security Reviewer exists.

## Reviewed baseline

[Amendment v1](../plans/LICENSING_NATIVE_ENTRY_AMENDMENT.md), raw-file SHA256:
`aeaed9cd718ee9adfb7ccb5d4d891f8a0ee789f4a679e8ee61f06e18e20ed4f8`.
Repository HEAD:5ceffad; existing uncommitted r86 documentation preserved.
The reviewed amendment bytes are unchanged by this review record.

Compared with [master](../design/LICENSING_DESIGN.md) sections6.1,16,17.1,
17.5-17.9 and Open003/012; [Windows matrix](../../operations/WINDOWS_SUPPORT_MATRIX.md);
[trust review](LICENSING_HYBRID_TRUST_REVIEW.md); source contracts
[entitlement completion](../../../server/src/licensing/offline/entitlement-completion.ts)
and [file workflow](../../../server/src/licensing/offline/file-workflow.ts).

## Findings requiring disposition before adoption

### NER-001 — adapter-entry acceptance scope is ambiguous (blocking adoption)

Amendment NE-002 requires accepted LIC008 decisions and Open003 resolution.
The master Open003 requires selection/proof across the Windows matrix; LIC008
also retains actual signed Installer lifecycle and native security obligations.
Amendment NE-002 mentions TPM/Windows-matrix acceptance, while its graph assigns
full native/Installer integration and release matrix to later nodes.

The 18-node explicit graph is acyclic, but it does not expand those acceptance
conditions. If entry is interpreted as requiring the full product matrix, it
can demand native/Installer results before their implementation; if interpreted
as one-host Software-KSP proof, it can weaken the fleet/assurance selection gate.
Neither interpretation is approved. This is a scope ambiguity, not proof that
the current executable code has a runtime security defect.

Required disposition: enumerate adapter-specific pre-entry evidence versus
later product/integration/release evidence, with exact owner IDs and platform/
provider/assurance coverage. State whether existing Open003 resolution is truly
achievable before native implementation. If it is not, explicitly propose a
reviewed bounded adapter-decision slice without closing Open003/LIC008 early.
Keep TPM-less lower assurance and every original matrix exit. Do not substitute
the consumed V7 experiment for fleet acceptance or silently change Open003.

### NER-002 — adoption instructions are not yet executable cell-level edits (blocking adoption)

Amendment section6 groups LIC6.4.002..005 and LIC6.5.003..005, but does not supply
the exact replacement dependencies for each cell. The existing master includes
LIC009 for transition handling, LIC012 for external Audit, and Backup/ACL
dependencies for recovery/projection. A grouped instruction could accidentally
remove one of these or preserve a hidden full-exit prerequisite.

Required disposition: provide old/new entry dependencies for EACH affected row,
including phase entries, transition004, recovery005, ACL003, Backup004 and
Audit005. Separate entry/interface obligations from unchanged full exit
obligations. Include a per-row test/evidence/owner map and expand those actual
dependencies when checking cycles. No row changes status to complete merely
because an interface slice is accepted.

### NER-003 — evidence invalidation needs a concrete rule (required clarification)

NE prerequisites require current artifact-bound evidence, and the master requires
scans to rerun after packaging. Native implementation necessarily creates new
artifacts. Specify which code/build/protocol/adapter/interface/scope changes
invalidate which entry records; pin revision, digest, reviewer and accepted
scope. A material change suspends dependent work pending the required rerun/
review, without forcing unrelated completed portable evidence to be repeated.
Early scans must never be presented as final signed-package scan approval.

## Confirmed strengths and source boundaries

- No production admission from portable acknowledgement: actual completion code
  returns durable=false/runtimeAuthority=NONE, compares generation AND hash and
  classifies thrown commit acknowledgement as COMMIT_OUTCOME_UNKNOWN.
- Actual file adapter comments require open-object identity, link/swap refusal
  and maxBytes enforcement DURING reading; a byte array is not native proof.
- Failed time/trust observation cannot authorize from an unchanged historical
  projection; the amendment retains the recorded clock diagnostic requirement.
- Database projection/Backup cannot become License authority; no private-key
  return or arbitrary Setup plan is permitted by the proposed contracts.
- Full item/FILE/STORE/release exits remain explicitly retained; Product direction
  approval does not claim independent Security acceptance or production readiness.

## Validation and decision

The explicit 18-node graph was checked in memory: unique/resolved dependencies
and no cycles, PASS. This does NOT certify the unexpanded acceptance conditions
(NER-001) or unspecified row replacements (NER-002). Resolver self-tests and
43 Markdown files/172 local targets PASS; exact Node24.19.0 protocol package
checks PASS; git diff --check PASS. Reviewed v1 raw-file SHA256 reconfirmed unchanged.
No runtime, DB, K40, Windows service, ACL/key, Installer or physical test was run.

Decision: do not adopt v1. Prepare a revised draft addressing NER-001..003,
record each disposition and submit the exact revision to an assigned Security
Reviewer and final Product confirmation. Current master dependencies remain
binding; Open012 remains `[!]`; LIC008/Open003 remain unresolved. No new
production implementation, consumed-kit rerun, external assignment or commit.

## Follow-up disposition — 2026-10-07

CHG0077/EV0146 adds [amendment v2](../plans/LICENSING_NATIVE_ENTRY_AMENDMENT_V2.md).
NER-001..003 are ADDRESSED_IN_DRAFT, not independently accepted or closed.
V1 reviewed bytes/hash and findings above remain historical and unchanged.
Review exact v2 and obtain assigned Security acceptance/final Product confirmation
before adoption; this follow-up is an author disposition, not that approval.
