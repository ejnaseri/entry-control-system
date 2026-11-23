# V2 built-kit and routing review — 2026-10-16

Baseline: f58b606. Reviewer: same coding agent/author; not independent Security.
Verdict: PASS_LIMITED_INERT_CUSTODY_AND_NAMESPACE; activation preparation needs
the permission-record correction below. No physical execution authorized.

## Exact candidate and checks

Candidate: out/lic008-pilot-runtime-candidate-91b794dc96a14295b1e646ba2328bb17.

| Artifact | SHA256 |
| --- | --- |
| self-contained-provenance.json | b17926811a401ddfffacb683eac3c8aa78773d0c6661b3506ae5c99110d0a30e |
| pilot-kit.zip | 52dd14ebae35dc23fa9ec0f1d5d634dbddea39e361dd9b59a22a3da37613b873 |
| kit/kit-manifest.json | 07327f369d2baeb5f74f50abf78a10f5ca0742fde2f3ecb1992328c61750422f |
| loaded pilot DLL | 57f379b854c17e16a7e5bd8254fd45d164300d19ab9078c6f3160f8f9e386b30 |
| successor0.5 | 8d6b30a67a7060b1e343b1fa485c11f460698d20017bc48da597fcd67757ea30 |

All39 source-manifest entries matched current source bytes after commit. All249
listed kit entries matched hashes and lengths. Archive and manifest hashes match
delivery provenance. This pass did not re-extract the archive; its exact bytes
match the archive whose extraction was verified by the builder.

Pinned kit Run-Pilot.ps1 SelfTest in Package mode passed1820 cases again, with
package-local CoreLib, expected successor0.5 and physicalTested=false. These are
the same cases, not1820 additional unique tests. Current source checker passed
24 transitive bindings and preserved historical negative checks. Capability is
false; builder TestCapable refusal remains intact.

## Routing findings

- Compiled Root/Prefix and active review helper use fixed EntryEvidenceV2.
  SecureFiles.PathOf, service binary/account names and KeyOperations.Name derive
  from these constants. No CLI root override or V1 migration was added.
- Bootstrap verifies host/boot, root/service collisions and derived V2 SIDs
  before public directory creation. Existing registrations are not adopted.
  Setup creates exact key names without overwrite. Unknown lookup still stops.
- Owner/controller context and prior journal validate the new successor pin;
  retained package/report checks bind hashes and identities. Old approval bytes
  cannot simply authorize the new binary. Native identity matching remains
  required; service SID derivation alone is not identity authentication.
- Remaining literal V1 paths in NativeTokens are negative-test inputs; the old
  SID in the generic pure-policy fixture is not a runtime target.
- Read-only CIM found the three V1 services Stopped/Manual, and no V2 service
  in that enumeration. This is not a certified elevated root/service/key
  absence preflight and does not grant creation permission.

## A1 — stale permission provenance in issuance helper

scripts/issue-license-pilot-prepare.mjs hardcodes permissionSource as explicit
owner chat approval on2026-10-13. A future V2 issuance would therefore record an
old approval date even though it builds fresh inputs. This is inaccurate consent
provenance, not evidence of a bypass: live owner confirmation and package/input
checks still apply. The helper was NOT run and no V2 approval was issued.

Before issuing any V2 permission record, replace this historical assertion with
an explicit current, reviewed approval reference bound to the exact candidate
and stage. Missing/old/mismatched approval references must refuse issuance; test
the record builder without creating an approval or running native roles.
Do not infer new permission from the old2026-10-13 approval or from this review.

## Next bounded action

Correct and test A1, then prepare/review a separately pinned capable candidate
under explicit scoped authorization. Actual Prepare still needs fresh owner
context and live confirmation; no retry of V1 is allowed. No repeat of this
unchanged inert-kit review is needed; changed binaries require their own review.
No live service/key/ACL mutation, cleanup or reboot occurred. LIC008 remains open.
