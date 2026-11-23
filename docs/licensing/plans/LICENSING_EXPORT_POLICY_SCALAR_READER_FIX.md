# Fixed-size token scalar correction

Date: 2026-10-28. Baseline: committed `7d65bdc`.
Status: `SCALAR_READER_CORRECTED_OWN_TOKEN_REGRESSION_AND_ARTIFACTS_VERIFIED`.
Subsequent continuation: [V3 placement contract](LICENSING_EXPORT_POLICY_V3_PLACEMENT.md)
defines the separately bound artifact/owner-kit step. The source/binding and
next-step statements below describe this completed V2-bound checkpoint; its
artifacts and evidence remain historical. No new physical result is implied.

[Experiment](../experiments/LICENSING_EXPORT_POLICY_CONTROL.md)
· [Consumed V2 evidence](../evidence/export-policy-control-v2-20261027/README.md)
· [Exact correction evidence](../evidence/export-policy-scalar-reader-20261028/README.md)
· [Current handoff](../../project/LICENSING_SESSION_HANDOFF.md)

This checkpoint corrects the fixed-size token reader and verifies new local
artifacts. The earlier V2 service result identifies `IdentityElevation /
VALIDATION / 0x80131501`; it did not record the service's native error or output
length. Error24/required4 was separately reproduced on an ordinary current-process
token. The two contexts must remain distinct.

## Reader and regression boundary

[NativeControlIdentity](../../../licensing/adapter-evidence/export-policy-control/NativeControlIdentity.cs)
now queries TokenType(8) and TokenElevation(20) once, directly into four bytes.
It initializes every byte to FF, requires a successful call and exactly four
returned bytes, and accepts only type1/2 or elevation0/1. Unsupported information
classes fail before the callback. Failure never becomes a default elevation.
The sentinel also rejects incomplete writes even if the callback falsely reports
a complete result. The variable-size `Info<T>` reader retains its original size,
error and pointer bounds; error24 was not added to its accepted sizing results.

`Validate` still requires a primary token, the exact role user/owner/service SID,
the existing service-group rule, a complete query and an unrestricted token.
Startup stage IDs, diagnostic encoding, export-denial classification, service
configuration, key policy and ACL rules are unchanged.

The pure identity suite adds126 assertions: four successful value checks,
60 status/length/call-count checks,12 invalid-value refusals,30 incomplete-byte
subset refusals, and20 unsupported-class/no-call checks. Identity cases increase
from368 to494; the complete suite increases from17,541 to17,667. Both build scripts
pin the new total. The owner-kit builder change only synchronizes its expected
control count; this checkpoint does not build or issue an owner kit.

The separate [regression harness](../../../licensing/adapter-evidence/export-policy-control/ControlScalarRegression.cs)
and [runner](../../../scripts/test-license-export-policy-scalar.ps1) load the pinned
old capable DLL and the new inert DLL in separate assembly load contexts. They
invoke only the private `Scalar(SafeAccessTokenHandle,int)` method and query only
their own current-process token with TOKEN_QUERY=8. Neither target's application
entry, identity Capture, service dispatch, CNG code or owner-input helper runs.
No new application command or source in the application build set is added.

The runner requires explicit inert manifest/DLL hashes, checks the package
binding, holds the target DLLs read-only while loading, snapshots its own sources,
and compiles with warnings as errors on .NET10.0.11. It records closed numeric
query results and hashes in a unique output directory. Its before/after assertion
is intentionally tied to the reviewed old DLL and this host's ordinary-token
reproduction; it is not a portable claim about every Windows token or version.

## Verification checkpoint

The fresh inert build passed17,667 assertions and14 closed-entry refusals for
each of its two variants and the packaged apphost. Runtime inventory verification
covers190 files. The independent inert review rehashed25 source/snapshot pairs,
four tools,167 references,190 runtime files and four package files, and recomputed
the source/reference-set hashes.

The ordinary-token regression passed: the old Scalar still rejected elevation
with VALIDATION/0x80131501 after error24/required4 from its sizing query; the
corrected Scalar returned0, matching the direct four-byte read. Both versions
returned type1. Three invalid runner bindings were refused before compilation
or token access, without creating output.

The separately built capable artifact binds that exact inert manifest and source
set. Its three variants pass17,667 cases with14/14/13 entry refusals; the capable
apphost passes17,667/13. Only malformed capable routes are tested by the builder.
The native regression uses the inert DLL; it never exercises a physical entry.

| Artifact | Output suffix | Manifest SHA256 |
| --- | --- | --- |
| Inert | `v2-inert-02a1fdd35e9f4f6182c6a694af7c39ba` | `8930298522fa8fbc3ea2887599f32396c16cbd724884159add5018022d752de3` |
| Scalar regression | `scalar-regression-d8f2727695214b7aa1d1741a7629b15a` | `98baba7e70977ace8482b4e84b6022f2ed819efd3be4a1fa212654cb1dc12098` |
| Capable | `v2-capable-0da1cb44ef064546a6df9b2903c95f0a` | `5981379fd802879d1b3b6a68414138056813fc92803fc449918266bcf1959b7d` |

Each suffix follows `out/lic008-export-policy-`. Exact package/build/report bytes
and before/after results are retained in the linked11-file evidence archive.

## Continuation boundary

Both consumed V1/V2 attempts and their original binaries, inputs and evidence
remain retained. New build output is not fresh physical placement: these sources
still bind to consumed `Ecs.Lic008.ExportPolicyControlV2`.

The next step is a separately reviewed fresh placement contract, including new
Setup name/SID, root, key prefix and every binding through capability, approval,
package and owner-kit validation. That source change requires new artifacts and
review before CheckOnly or fresh, time-limited input preparation. The later
visible execution still requires the owner's live CONFIRM for its exact package
and effects. Neither existing approval is reusable.

This fix does not establish that LocalSystem Setup now passes, produce paired
export observations or close LIC008/Phase6.2, native-entry, Security or production
acceptance. Those decisions remain open; all acceptance flags remain false.
