# Adapter physical pilot specification — proposed v0.2 ownership correction

Date:2026-10-10. CHG0110 / LIC-EV-0179.
ID: ADAPTER-PHYSICAL-PILOT-01 revision0.2.
Status: PROPOSED_NOT_REVIEWED_NOT_EXECUTABLE.

Read together with preserved [specification0.1](LICENSING_ADAPTER_PHYSICAL_PILOT_SPEC.md),
raw SHA2568e50ace849f4f542e096532dda6d45314bb1508f93bb8c83e85728efb5155452.
This narrow successor corrects [PP-R01](../reviews/LICENSING_ADAPTER_PHYSICAL_PILOT_SPEC_REVIEW.md).
It supersedes only section3's unconditional SYSTEM ownership of all role-created
objects and adds corresponding owner admission/read-back/publication checks.
All other paths, exact DACL principals/masks/flags, key policy, allowed actions,
create-new semantics,10 report total, stage sequencing and gates remain unchanged.
No original reviewed bytes overwritten; no executable code or kit produced.

## 1. Exact ownership by creator

Use the original numeric identities: S=SYSTEM S-1-5-18,
A=Administrators S-1-5-32-544, G/P=verified exact Guardian/App service SIDs.
The table defines expected owner, not a command to transfer ownership.

| Objects in original closed inventory | Creator | Required owner SID |
| --- | --- | --- |
| Root/public bin/plans/controller/report directories and controller-created package/plan/checkpoint/summary files | Elevated controller | A (unchanged) |
| protected/, guardian-work/, shared/ directories | Setup-create | S |
| protected intent/owned records | Setup-create | S |
| shared/public-control.json | Setup-create | S |
| Shared final two envelope/two expected-hash files | Setup-publish | S |
| Setup reports | Corresponding Setup action | S |
| Four guardian-work staging files | Guardian | G |
| Guardian reports | Guardian | G |
| App reports and actual child report files | App/child under App primary token | P |

Guardian/App do not create any additional directories. In particular,
guardian-work directory remains SYSTEM-owned while its staging files are
Guardian-owned. Report directories remain controller-created/A-owned; report
files belong to their exact producer as listed. Setup-publish creates new
SYSTEM-owned destination copies; it never changes staging-file owners or moves
role-owned staging files into shared as if they were SYSTEM-owned publications.
Source staging files and hashes remain retained.

## 2. Verify actual default owner, never assume or fix it

Windows new-object ownership follows the creator token's default owner, which
must not be inferred just from TokenUser or a service-name string. See
[Microsoft new-object ownership rules](https://learn.microsoft.com/en-us/windows/win32/secauthz/owner-of-a-new-object).

Before controller creates public objects, verify its token/default owner equals
A, with its required elevation checks. Before any Setup/Guardian/App/child file
creation, read TOKEN_OWNER from the actual primary token and compare with the
table's independently expected S/G/P, alongside existing TokenUser/enabled
service SID/artifact checks. No impersonation token may determine creation.
App's actual child independently verifies its own TokenOwner=P; parent-reported
token values are insufficient. These are future executable admission checks,
not measurements already performed on the current host.

If the token's default owner differs, refuse that action before its file/key
operations and retain any earlier stage state for review. Do not silently accept
SYSTEM/Administrators/another group instead of G/P, rewrite TOKEN_OWNER, enable
take-ownership/restore privileges, grant WRITE_OWNER or impersonate SYSTEM.
Whether the proposed identities satisfy this on the available host is NOT_RUN;
an unexpected host token requires revised review, not permission expansion.

Create-new files must receive the specified protected exact DACL during creation,
then be checked on the same plain-file handle for owner SID/DACL before sensitive
content is written. No replacement/overwrite of pre-existing files. Subsequent
consumers independently recheck owner/DACL/plain path/size/digest before use.
Failure retains the created object and denies progression/publication; do not
repair its owner or ACL in place to turn a failure into PASS. Stage file lists,
RunIds and10-report budget remain unchanged; no SYSTEM helper launch added.

## 3. Publication and report consumers

Setup-publish must validate SYSTEM owner on guardian-work directory, G owner on
each staging file, exact S:F/G:M file DACL, bounded size, closed filename set,
expected context and stage-bound Guardian report/digest before copying. It then
creates the existing four exact shared destination files as S-owned with the
original S:F/A:Rf/G:Rf/P:Rf DACL, reads back and records their final digests.
Public-control.json retains its Setup-create/S ownership. Guardian staging and
shared destination hashes must agree; public data is not ownership authority
for private keys. Unexpected owner denies publication without owner substitution.

Controller checks setup-report owner S, guardian-report owner G and app/child-
report owner P, plus protected original file DACL, approved RunId/role/experiment,
closed schema, size/digest and loaded-artifact evidence. Numeric owner comparison
cannot be replaced by checking filename or service-name text. Controller still
does not read protected or guardian-work contents; publication validation there
belongs to Setup, not a new Administrator access grant.

Owner rights have an important limit: Windows owners implicitly can modify their
own object's DACL. Keeping explicit ACE masks unchanged does not remove that
implicit ability. Thus G/P-owned output is not immutable or trustworthy against
a compromised producer. Exact consumer read-back/closed inventory/digests remain
required, but cannot prove hostile-role/admin resistance or signed attestation.
This test-only evidence boundary is unchanged; no runtime/product authority is
derived from a role report. Do not claim that Modify ACE alone makes output
tamper-proof. Role code never exercises owner rights to relax permissions.

## 4. Required future pure/actual checks

These are specified tests, all NOT_IMPLEMENTED/NOT_RUN in this amendment:

- Each S/A/G/P token-owner fixture matches only its independently expected role;
  wrong/unknown/Administrators owner on a Guardian/App action refuses before work.
- Child token owner substitution refuses even with a correct parent's report.
- Every table row checks expected owner alongside original protected DACL.
  Right owner with wrong ACL and right ACL with wrong owner both refuse.
- Publication accepts G-owned staging and produces S-owned new destinations;
  System-owned staging falsely substituted for G, inherited/unprotected ACL,
  changed bytes or existing destination all refuse, without owner rewrite.
- Report validation rejects foreign owner for each role, including App-child
  files. Test actual emitter paths later, not only hand-built report fixtures.
- Pure guard tests prove no SetTokenInformation ownership change, privilege
  enabling, extra WRITE_OWNER grant, hidden SYSTEM launch or move-as-publication
  is introduced. Final artifact/role behavior remains subject to executable review.

Existing Track A63 pure PASS cases are historical candidate evidence, not tests
of this owner amendment. No physical SIDs/tokens/files/ACLs have been measured or
changed. PP-R01 author correction prepared; targeted non-author review PENDING,
not CLOSED. Next exact0.1+0.2 ownership-correction review before authorizing inert
physical-kit implementation. Track B, Security/production/native-entry approval,
FEP-P01..05 and four REM closures remain absent; LIC008/Open003 open.
