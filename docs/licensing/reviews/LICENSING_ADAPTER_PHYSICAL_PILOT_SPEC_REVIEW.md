# Limited non-author physical pilot specification review

Date:2026-10-10. CHG0109 / LIC-EV-0178.
Verdict: `DRAFT_CORRECTION_REQUIRED_BEFORE_INERT_KIT_IMPLEMENTATION`.

User authorized the proposed specification review, not physical implementation
or execution. Agent `/root/adapter_routing_review` accepted a distinct non-author
specification assignment; earlier Track A/routing approvals do not transfer.
Inspected HEAD95336c58f39fb49e39f9c7248670028b994ede09, clean worktree.
[Exact specification0.1](../plans/LICENSING_ADAPTER_PHYSICAL_PILOT_SPEC.md) raw
SHA2568e50ace849f4f542e096532dda6d45314bb1508f93bb8c83e85728efb5155452
unchanged before/after review. Preserved fresh-plan/contracts define context.

## PP-R01 — MEDIUM, OPEN: ownership versus permitted role creation

Specification section3 lines91–92 require SYSTEM ownership of all Setup/role-
created objects. Yet Guardian creates guardian-work staging and Guardian reports
with G:Modify; App/child create reports with P:Modify (lines110/112/113). Reports
require create-new RunIds (lines124–127), creation occurs in assigned role stages
(lines178–180). These tokens/masks have no specified authority/protocol to create
the resulting objects owned by SYSTEM.

New-object owner normally follows the creator token's default owner; assigning
a different owner needs appropriate authority. Reviewer checked official
[Microsoft new-object ownership documentation](https://learn.microsoft.com/en-us/windows/win32/secauthz/owner-of-a-new-object)
and [SetNamedSecurityInfo requirements](https://learn.microsoft.com/en-us/windows/win32/api/aclapi/nf-aclapi-setnamedsecurityinfow).
Do not resolve this by silently granting privileges/WRITE_OWNER, unlisted SYSTEM
launches or dropping ownership validation.

Smallest proposed correction: explicitly separate SYSTEM-owned directories,
private records and shared publications from Guardian-owned staging/reports and
App-owned App/child reports, with exact creator-token/default-owner expectations
and unchanged protected DACL checks. Alternative SYSTEM-precreation/publication
needs an explicit protocol, preserving create-new semantics/report/stage counts.
Neither remedy is implemented or approved by this review.

## Supported direction and disclosed dependencies

Bootstrap avoids administrator private-directory traversal. Ordered Setup-create
→ Guardian → Setup-publish → App/child publication is explicit and creates no new
key during publish; report count5+3+2=10 is coherent. Fixed names/collision
refusal, immutable plans, loaded-artifact/child pins and per-stage authority are
required. Unknown failures retain state; no stop/replacement of live/uncertain
worker. Owned cleanup/private chains/individual deletion and no-recreation are
specified. GenericAll/provider-mapped key masks are explicitly broader test-only
policy, not accepted product permissions.

Executable pins, actual emitters, native ACL normalization, host binding and
collision guards remain unimplemented. Future collision classifier must prove
absence independently of ambiguous BAD_KEYSET/provider/ACL errors; unknown must
not become absence. Planning coherence is not implementation or physical PASS.

## Checks and next action

Reviewer: two read-only shell calls for complete spec/context inspection, Git
HEAD/status/raw hashes; one official Microsoft documentation lookup. No edits,
build, execution, protected filesystem/SCM/CNG/ACL operation or delegation.
Coordinator also read specification/Git/hash only, then records results.

Next preserve exact0.1 and prepare a narrowly versioned ownership correction
for PP-R01; review that successor before inert physical-kit implementation.
No native-entry/Track B/Security/production authorization or full FEP/REM closure.
Four REM, LIC008/Open003 and NE-002/NATIVE_ENTRY gates remain open. This is a
bounded AI technical review, not an independent human security guarantee.

## Author ownership correction prepared, not reviewer acceptance

EV0179 proposes [narrow successor0.2](../plans/LICENSING_ADAPTER_PHYSICAL_PILOT_SPEC_V02.md).
System-owned bootstrap/private/publication objects are separated from G-owned
staging/reports and P-owned App/child reports; actual TokenOwner/owner/DACL
read-back checks and copy-as-SYSTEM publication are specified without expanded
privileges/hidden launches. Original0.1 bytes are preserved. PP-R01 remains
pending targeted non-author confirmation; this author follow-up is not closure
or approval of a new executable kit. No code or host mutation performed.

## CHG0111 / LIC-EV-0180: targeted ownership correction review

2026-10-10: user authorizes the proposed corrective review. Existing non-author
agent accepts a distinct bounded assignment, inspects HEAD95336c58f39fb49e39f9c7248670028b994ede09
plus disclosed documentation changes. Verdict: PP-R01 `RESOLVED_IN_DESIGN_ONLY`.
No new scoped contradiction. Corrected specification is ready for separately
authorized inert kit preparation; not authority to execute physical operations.

Raw0.2 pin f2859ad5a1d3bd5a41f2cec89448ac98ca042585118ecd9b40d08d2bf3916706
and preserved0.1 pin8e50ace849f4f542e096532dda6d45314bb1508f93bb8c83e85728efb5155452
match before/after review. Earlier verdict remains the history of0.1; it was
not transferred to the new bytes without review.

Ownership table distinguishes SYSTEM directories/private/publication records,
Guardian staging/reports and App/child reports. Actual TokenOwner is checked
against independently expected A/S/G/P; TokenUser/service names/parent reports
do not substitute. Mismatch refuses without rewriting owner/token or adding
privileges. Create-new protected-DACL/same-handle owner validation before writes
is coherent subject to actual implementation tests. Setup validates G-owned
staging and makes new S-owned publication copies; no move/owner transfer or
Administrator private-directory read. Implicit owner DACL rights/compromised
producer limits are explicitly retained. Original paths/masks/flags/key policy/
stage ordering/5+3+2=10 reports unchanged; no hidden SYSTEM action added.

Reviewer used two read-only shell calls for complete amendment/context reads,
preserved-spec comparisons, Git HEAD/status and hashes. No edit/build/execution,
protected access/token/ACL/native operation or delegation. Coordinator records
verdict and runs documentation/prior-package read-only checks only.

Actual token compatibility/creation/read-back/publication/emitters/native ACL
normalization/collision guards remain NOT_RUN. Next separately authorized inert
physical-kit implementation/build, then exact source/package/controller and
negative-test review before independently authorized physical stages. No
Security/production/NE/native or full FEP/REM acceptance follows; four REM,
LIC008/Open003 and native-entry gates remain open. AI review is not independent
human Security assurance. No second human role or new guarantee is invented.
