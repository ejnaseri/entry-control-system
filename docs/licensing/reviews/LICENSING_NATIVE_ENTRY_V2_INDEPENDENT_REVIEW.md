# Native-entry v2 — independent agent technical review

Date: 2026-10-07. Scope: FULL and ATTENDANCE scheduling amendment only.
Record: CHG0078 / LIC-EV-0147.
Result: `SCOPED_TECHNICAL_ACCEPTANCE_NO_BLOCKING_FINDING`.
Reviewer: separate agent `/root/native_entry_security_review`, not the author;
assigned by the coordinator after explicit user authorization for a separate
read-only agent review. Coordinator/author: Codex `/root`.

This is independent-agent technical review of the proposed scheduling policy,
not final Product confirmation, formal external Security officer approval,
runtime/native/Windows acceptance or permission to deploy/start implementation.
Formal amendment-adoption approval remains pending; original dependencies bind.

## Exact reviewed baseline

- Commit: `8a01e682b4a351b2554a995d7585e91661f9f2f2`.
- [V2 draft](../plans/LICENSING_NATIVE_ENTRY_AMENDMENT_V2.md) raw SHA256:
  `88dc75f17f85f0a57e05d2a6a9648800637a1b1b3d0611a257c3a0e541fd1444`.
- Committed/working Git blob: `e2a4f7cc32b80cd2257ec8120c191668650bbd59`.
- [V1](../plans/LICENSING_NATIVE_ENTRY_AMENDMENT.md) preservation SHA256:
  `aeaed9cd718ee9adfb7ccb5d4d891f8a0ee789f4a679e8ee61f06e18e20ed4f8`.

Reviewer independently checked HEAD, file hashes and working/committed blob
identity before coordinator added this report. V1/V2 bytes remain unchanged.
No applicable AGENTS.md found in checked ancestor directories.

## Findings and disposition

No reproducible blocking defect found in the bounded v2 scheduling proposal.

| Prior finding | Independent assessment | Evidence boundary |
| --- | --- | --- |
| NER-001 | ADDRESSED_WITHIN_REVIEWED_DRAFT | V2 lines41-69 explicitly separate ADAPTER_ENTRY from full LIC008/Open003 closure; scoped provider/token/key/failure coverage required, full platform/Installer/matrix exits retained |
| NER-002 | ADDRESSED_WITHIN_REVIEWED_DRAFT | V2 lines96-168 expand actual construction prerequisites; all11 row replacements match slice edges; no hidden full-exit dependency found in the proposed graph |
| NER-003 | ADDRESSED_WITHIN_REVIEWED_DRAFT | V2 lines177-197 bind revisions/digests/scope, invalidation and descendant suspension; older scans do not accept new/final signed artifacts |

Store journal primitives precede Audit projection; degraded recovery depends on
the Audit design contract rather than a healthy deployed journal, avoiding the
specified Audit/Backup construction cycle. Full checklist exits remain under
their original owners; scoped slice acceptance does not mark them complete.

The [Windows matrix](../../operations/WINDOWS_SUPPORT_MATRIX.md) remains authoritative;
no fleet/platform assurance is inferred. Actual portable
[completion](../../../server/src/licensing/offline/entitlement-completion.ts)
requires generation AND hash, complete state/receipts/journal/outbox/anchors and
uncertain-ack refusal; file workflows and inspected Hybrid facades retain
durable=false/runtimeAuthority=NONE. Those interfaces are not native implementations.

## Checks actually executed

Independent reviewer, read-only:

- 34 unique/resolved graph nodes; acyclic; all11 exact row mappings; no
  EXIT/RELEASE entry backedges: PASS.
- Documentation resolver self-tests;44 Markdown files/179 local targets: PASS.
- git diff --check; clean pre-report worktree; commit/blob/V1/V2 hashes: PASS.
- Installed Node22.19.0 used for successful planning/link checks. Initial
  in-memory graph probes needed corrected shell quoting/case-sensitive parsing;
  corrected PowerShell check passed without file mutation.

Coordinator separately reran exact Node24.19.0 protocol-v1 checks: PASS. The
independent reviewer did NOT rerun that pinned protocol suite; do not attribute
the coordinator's test execution to the reviewer.

## Remaining gates and limits

No production/native/service/ACL/key/DB/K40/Installer/physical Windows test was
executed. No Vendor, adapter, artifact or other NE row is marked complete.
LIC008/Open003 stay unresolved; Open012 stays `[!]` until adopted scheduling
decision. Formal Security acceptance and final Product confirmation of this
exact scope remain pending; then update master dependencies/mirrors together.
Only after all entry evidence and explicit named work authorization are accepted
may bounded implementation start. No automatic adoption, release approval or
new commit is performed by this report.

## Scoped amendment-role acceptance and adoption follow-up

CHG0080/EV0149: following Product finalization request, coordinator designates the
same independent non-author agent for this scheduling amendment's Security role.
Reviewer explicitly accepts the assignment and returns
SCOPED_SECURITY_APPROVAL_FOR_SCHEDULING_AMENDMENT_ADOPTION for unchanged exact
v2 digest, conditional on faithful synchronized adoption. The coordinator records
[adoption](../plans/LICENSING_NATIVE_ENTRY_ADOPTION.md) separately. This resolves
the amendment-role pending checkpoint above only; no NE row/provider/runtime/
physical/production/release approval. Reviewer is an agent, not an external human
Security officer; full acceptance obligations remain unchanged.
