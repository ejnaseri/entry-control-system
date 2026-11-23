# Documentation and checklist path review — 2026-09-19

Reviewed baseline: commit `0bac5a5` plus the existing, uncommitted Windows
diagnostic worktree. This is a documentation/dependency review requested by the
Project Owner, not a new independent software or physical security acceptance.
No previous LIC006 review was repeated and no checklist item is closed here.

## Scope and evidence

The inventory covers all 15 files in `docs/` and the nine other repository
Markdown documents, excluding generated output, dependencies and build caches.
The before-edit paths, hashes, headings and raw checkbox counts are retained in
`out/docs-path-audit-7c416f0231644989aa749fb95c3f9741.json` (local, ignored).
The review compared active decisions, execution checklists, dependencies and
remaining-work statements against dated evidence and selected source/history.
Historical logs were used as evidence, not re-executed or re-certified. This is
not an exhaustive verification of every implementation claim in every document.

| Documents inspected | Role and assessment |
| --- | --- |
| `LICENSING_DESIGN.md` | Canonical contract, section17 checklist, section18 Open register and append-only evidence. Governs licensing scope and closure. |
| `PROJECT_CHECKLIST.md` | Broad implementation/QA inventory; repeated module, priority and history entries are not independent deliverables. |
| `ATTENDANCE_EDITION_CHECKLIST.md` | Edition scope, required phases, optional O.x packages, release and pilot requirements. Section19 execution gates must be distinguished from repeated requirements. |
| `PACKAGING_DECISIONS.md`, `security-design.md` | Accepted packaging/security boundaries; current status mirrors had fallen behind implementation. |
| `LICENSING_WINDOWS_SPIKE.md` | Isolated feasibility tools, local results, corrections and remaining Windows matrix. Earlier physical-result narrative is superseded by its corrections. |
| `LICENSING_OFFLINE_REVIEW.md` | Completed portable review, recorded in ad5c209; native acceptance explicitly excluded. |
| `LICENSING_HYBRID_REVIEW.md`, `LICENSING_HYBRID_TRUST_REVIEW.md`, `LICENSING_HYBRID_REACTIVATION_REVIEW.md` | Reviews of distinct earlier commits; their conclusions must not be extended automatically to 0bac5a5. |
| `LICENSING_PREIMPLEMENTATION_REVIEW.md` | Historical pre-harness scope and boundaries, not today's completion certificate. |
| `backup-restore.md` | Local-first backup and controlled restore; authoritative licensing state is excluded. Guardian Emergency Backup is an accepted future contract, not completed native implementation. |
| `k40-setup.md` | Recorded FULL and Attendance hardware results; release hardware evidence is still separate. Physical location remains undocumented. |
| `attendance-audit.md` | Older schema/attendance note; its Phase2.6 remaining-work wording lags later Edition evidence. |
| `inbox.md` | Legacy FULL behavior explicitly separated from optional, unmounted Attendance Inbox and inactive auto-checkout. |
| Root `README.md` | Correctly links canonical masters; unsigned development artifacts are not final installers. |
| `client/README.md`, `server/PRISMA_GUIDE.md` | Template/developer notes, not product acceptance or authority to execute migration commands during this audit. |
| `server/docs/domain-model.md`, `server/docs/devices-api.md` | Initial model and legacy API examples, not current release gates. Device examples lack the current authenticated/Edition context; do not use them as current acceptance instructions. |
| `licensing/protocol/v1/README.md`, `licensing/protocol/v1/corpus/README.md` | Frozen protocol and descriptor scope; no new wire/protocol decision is introduced by Windows diagnosis. |
| `licensing/vectors/v1/README.md`, `licensing/vectors/v1/dotnet/README.md` | Closed test-only packages, not production issuer/Guardian implementations. No package changes or re-certification in this review. |

## Was the next step already planned?

| Work | Existing authority | Conclusion |
| --- | --- | --- |
| Real Windows key/protection/provider feasibility | `LIC-6.2-008`, `LIC-OPEN-003`; LIC008 already exists in ad5c209 and depends on completed LIC003 | Existing checklist work. Report collection and read-only inspection are bounded investigations inside it. |
| A temporary LocalSystem Setup helper | Packaging section4 and `LIC-6.4-003` | Already planned for signed install/upgrade under constrained authority; its existence does not authorize every privileged task. |
| Having Setup create the installation key for Guardian | Master section5 says Guardian **creates and owns** the key; packaging section7 step8 says Guardian creates/loads identity | New proposed responsibility, not an accepted design change. A test-only alternative must be explicitly scoped; production adoption requires the design/security decision. |
| Production Guardian followed by production Store immediately after LIC008 | `LIC-6.4-001` requires Phase6.2 AND Phase6.3; `LIC-6.5-002` also requires Guardian | Not the currently authorized dependency order. Passing LIC008 alone is insufficient. |

## Findings and corrections

1. **Resolve the existing integration cycle before production integration.**
   `LIC-OPEN-012` records LIC006 physical Store evidence -> Phase6.2 exit ->
   Guardian -> Store -> LIC006. Master section6.1 requires a reviewed dependency
   or scope clarification before moving an exit criterion. The appropriate next
   deliverable is a concrete proposal that preserves all physical acceptance,
   with explicit owners and gates; this report does not approve a waiver or
   silently reorder the table.
2. **Keep provisioning and protection alternatives provisional.** Software
   algorithm support under Administrator does not prove Guardian key creation.
   The old compound probe does not reveal which suboperation failed. DPAPI-NG
   has a separate unresolved failure. A proposed experiment must distinguish
   provider support, caller identity, creation, ACL configuration, reopening,
   signing, export refusal, App/child denials and cleanup. Do not replace the
   retained installation or infer key absence from another caller's result.
3. **Current summaries were stale.** The four checklist/security/packaging top
   summaries and both master active-status paragraphs now identify 0bac5a5,
   current-host Windows evidence and the provisional next step. Older checkpoint
   summaries below them are explicitly superseded, not new work orders. Detailed
   requirement mirrors still need reconciliation against their owning evidence;
   for example Attendance section15 still describes an environment-selected
   production build, whereas the frozen Phase6.1 contract uses canonical build
   identity. No unchecked requirement is automatically marked complete here.
4. **Physical evidence has limits.** EV0092-0094 supersede EV0091's erroneous
   device attribution, DPAPI error and software-cleanup interpretation. The
   reports are on the current host; an independent second-laptop run, suitable
   TPM target, Windows10/TPM-less matrix, continuity and full acceptance remain
   outstanding. App/child file denials passed; key and DPAPI acceptance did not.
5. **Latest code and review coverage differ.** EV0090 records 52 Reactivation
   cases after optional Control/trust composition in 0bac5a5. The standalone
   Reactivation review covers 2a6fb87, not this change. Retain targeted review of
   the new reducer/trust slice before closure; do not repeat the completed
   independent LIC006 review.
6. **EV0090's failure explanation is incomplete.** It attributes the 48/52
   failure to old-lineage Control revision1 and a global sequence. Source
   `reactivationBase` resets Control for the new lineage; the committed fix also
   changes reducer ordering so a same-revision Control fact can precede its
   Lease echo. A fixture-only explanation is not supported by the final diff.
   Preserve EV0090 historically; this correction does not assert a fresh test
   run or reconstruct unavailable intermediate execution details.
7. **Not every open checkbox means missing code.** Requirements, release gates,
   operational workflows, optional features and historical inventories overlap.
   Examples include the stale attendance-audit Phase2.6 note and security
   navigation status versus later project QA. Reconcile ownership/evidence before
   converting these into tasks. Do not restart completed K40/Edition work or
   count optional Inbox/Compliance/Door as mandatory v1 implementation.

## Current position and next deliverable

Follow-up: the [bounded experiment and dependency proposal](../plans/LICENSING_WINDOWS_NEXT_PLAN.md)
is now prepared under EV0096. It is a planning deliverable, not an accepted change
to key ownership or phase dependencies; the audit findings below remain open.

Canonical Phase6.2 has exactly 13 implementation rows: five complete (001-005),
three in progress (006-008), and five not started (009-013). This is a row count,
not a percentage of engineering effort or whole-product completion.
Remaining release work includes runtime admission, restricted UI, Vendor
authority and operations, licensing audit, artifact isolation, signed native
services/installer, protected storage, Windows acceptance and customer pilot.
Existing general-product hardening and runbook obligations remain with their
owners; this review does not close them.

Next on the Windows path: prepare one bounded test/design proposal for Guardian
provisioning and standalone protection, and a separate concrete resolution
proposal for LIC-OPEN-012. Establish baseline-versus-alternative behavior,
retained-resource handling, evidence required and cleanup before executing new
privileged test code. A Setup-created-key alternative must remain visibly
provisional until its ownership change is reviewed and accepted.

LIC009 also has a satisfied software dependency (LIC004), so bounded admission
and coordinator work can proceed independently if selected. It must reproduce
the trust-review failed-clock-observation admission boundary and cannot claim
physical Guardian/Store authority. LIC010 depends on LIC009; LIC012 depends on
LIC009 and LIC010. LIC011 requires a separate Vendor owner/system and resolution
of its operational Open items; its procurement is not replaced by more customer
code. None of these paths waives the cumulative release gates.

Validation for this audit: documentation inventory, source/history comparison
and local documentation consistency checks only. Application/crypto/Windows/DB/
K40 tests: **Not run**. No service, key, ACL, database or customer data was changed.

Final documentation checks: 25 Markdown files including this new report,
41 local links with no missing targets, 95 unique EV rows, 44 unique CHG rows,
seven-column Evidence rows and `git diff --check` pass. The first PowerShell
validation command failed to parse (missing closing brace) and performed no
validation; the replacement local Node checker passed. Link checks establish
local target existence only, not external URL availability or section anchors.
