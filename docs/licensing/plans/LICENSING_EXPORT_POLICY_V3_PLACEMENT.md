# Export-policy V3 placement and artifact contract

Date: 2026-10-28. Source baseline: committed `10e1913`.
Status: `V3_CONSUMED_SETUP_COMPLETE_CONTROLLER_UNKNOWN`.

[Scalar-reader correction](LICENSING_EXPORT_POLICY_SCALAR_READER_FIX.md)
· [Historical V2 contract](LICENSING_EXPORT_POLICY_V2_PLACEMENT.md)
· [Consumed V2 evidence](../evidence/export-policy-control-v2-20261027/README.md)
· [Experiment](../experiments/LICENSING_EXPORT_POLICY_CONTROL.md)
· [Current handoff](../../project/LICENSING_SESSION_HANDOFF.md)

The separate fixed V3 placement and its inert, test-capable and owner-kit chain
are implemented, built and independently reviewed within the stated scope.
Actual verification and pins are recorded below. The original build checkpoint
stopped at owner-kit review. Subsequent actual elevated preflight, preparation and
live owner-confirmed execution are recorded in the
[V3 physical evidence](../evidence/export-policy-control-v3-run-20261028/README.md).
Attempt9dded1f90d5b4299ba973898bf42890c is now CONSUMED: Setup recorded LocalSystem
SETUP_COMPLETE and both new-key journals, but controller run-setup remained
UNKNOWN/VALIDATION/0x80131501 before Guardian borrow. Exact controller predicate
is not recorded. No paired export result or security acceptance exists.

Dated source successor — 2026-10-28: [controller diagnostics](LICENSING_EXPORT_POLICY_CONTROLLER_DIAGNOSTICS.md)
adds schema3 / `TEST_ONLY_EXPORT_POLICY_CONTROLLER_RESULT_V3` in an inert-only
checkpoint. The schema2 contract and archived results below describe the actual
`b88c629` artifacts and remain historical. This source revision does not retrofit
the consumed attempt or establish a fresh placement or permission to retry it.

## Preserved evidence and scope

V1 attempt `f9ed088cce17426cb48759645d45e2e6` and V2 attempt
`92d320aeca9d4a469b8e9b5c0b8dadcd` are consumed. Both failed at `run-setup` with
`UNKNOWN`; Guardian was never borrowed. V1's original failure remains unknown.
The V2 protected result identifies `IdentityElevation / VALIDATION / 0x80131501`
through SCM1066/service0xEC10F301, with `evidenceAuthority=NONE`. It did not record
the original service's native error or output length.

The committed scalar correction replaces the zero-length size probe only for
TokenType(8) and TokenElevation(20): one four-byte read, exact returned length,
closed values and failure refusal. Ordinary-current-process regression showed
the old reader reject error24/required4 while the corrected reader returned0.
This is not a reproduced LocalSystem context or proof that V3 Setup will pass.
Variable-length token parsing, role admission and all acceptance rules remain.

Keep V1/V2 roots, Setup registrations, deployed bits, inputs, approvals, possible
keys, journals and archives unchanged. Preserve earlier pilot/diagnostic state
too. There is no retry, migration, retained-key query, repair, patch, overwrite,
cleanup or approval extension. An absent report/journal is not proof of key
absence or deletion authority. Prior output packages remain historical; V3 is
a new binding chain, not a renamed retained package.

## Fixed resources and identities

| Binding | V3 contract |
| --- | --- |
| Placement constant | `Ecs.Lic008.ExportPolicyControlV3` |
| Protected root | `C:\ProgramData\Ecs.Lic008.ExportPolicyControlV3` |
| New Setup service | `Ecs.Lic008.ExportPolicyControlV3.Setup` |
| Setup account and token user/owner | `LocalSystem`, `S-1-5-18` |
| Derived Setup service SID | `S-1-5-80-1089034463-1541443459-4272285516-2530654974-4160034000` |
| New test-key prefix | `Ecs.Lic008.ExportPolicyControlV3.TEST_ONLY.` |
| Existing Guardian service | `Ecs.Lic008.EntryEvidenceV2.Guardian` |
| Guardian account | `NT SERVICE\Ecs.Lic008.EntryEvidenceV2.Guardian` |
| Guardian SID and token user/owner | `S-1-5-80-1925419286-2081043195-3517708708-3498839447-1988319315` |
| Administrators SID | `S-1-5-32-544` |
| Artifact/input prefix | `lic008-export-policy-v3-` |
| Sole capable define | `TEST_CAPABLE_EXPORT_POLICY_CONTROLLER_V3` |

All placement choices are constants. No CLI argument, environment value or
untrusted JSON selects a root, service, key prefix, service SID or capability. Setup
remains own-process type16, Manual start3, Normal error control1, service-SID
type1, and LocalSystem. Its newly derived service SID does not become its token
user/owner or replace SYSTEM in a DACL.

The Setup SID was independently derived with SHA-1 over the uppercase service
name encoded as UTF-16LE, interpreted as five little-endian uint32 words. Pure
tests must pin the exact value and reject V1/V2 Setup identities. Future physical
admission must still resolve and compare the registered SID; this calculation
does not establish service registration or actual token membership.

Both key names are `<prefix><attempt32>.exportable` and
`<prefix><attempt32>.nonexportable`, with exactly32 lowercase hexadecimal attempt
characters. They remain distinct RSA3072 persisted machine keys in Microsoft
Software Key Storage Provider, decryption usage1, and export policies3 and0.
Creation does not overwrite. Each created key is closed and independently
reopened before metadata/public identity is accepted. All matched metadata
except policy and key material must agree; a positive exportable control precedes
each GenericPrivate, PKCS8 and Opaque comparison. There is no seal or retained-key
operation. Direct0x80090010/0x80090029 remain observations in this experiment;
the original runtime denial classifier is unchanged.

The key DACL stays exactly SYSTEM plus the existing Guardian:

```text
D:P(A;;GA;;;SY)(A;;GA;;;S-1-5-80-1925419286-2081043195-3517708708-3498839447-1988319315)
```

No new Setup-SID or administrator key ACE is introduced.

## Store, lifecycle and Guardian contract

The V3 root uses the existing17-entry service-store whitelist: deployment
`plan.json`, `reservation.json`, `package-manifest.json`; four files under `bin`
(`ExportPolicyControl.exe`, `ExportPolicyControl.dll`,
`ExportPolicyControl.runtimeconfig.json`, `runtime-inventory.json`); seven Setup
journal files (consumed, two intents, two owned, complete and recovery); and
`reports/setup.json`, `reports/guardian-consumed.json`, `reports/guardian.json`.
`controller-result.json` remains a separately guarded controller publication.

| Object | Owner | SYSTEM | Administrators | Existing Guardian |
| --- | --- | --- | --- | --- |
| Root, bin, journal directories | Administrators | Full | Full | Read/traverse |
| Reports directory | Administrators | Full | Full | Modify |
| Setup journal and report | SYSTEM | Full | Read | Read |
| Guardian consumed/report files | Guardian | Full | Read | Modify |
| Apphost and DLL | Administrators | Full | Full | Read/execute |
| Other deployment files | Administrators | Full | Full | Read |

Exclusive root/file creation and fresh Setup registration remain mandatory.
Protected DACL/owner, path/reparse/link-count, size and pinned-handle checks are
unchanged. Consumption and intent are durable before creation; owned records
follow successful property/public-identity validation. Missing ownership records
never authorize cleanup. Setup and Guardian retain their closed write roles.

The original Guardian command remains exactly:

```text
"C:\ProgramData\Ecs.Lic008.EntryEvidenceV2\bin\EntryControl.AdapterPilot.exe" --service Guardian
```

The approval binds its complete original name/account/path, Manual start3,
own-process type16, Normal error control1, service-SID type1, STOPPED/state1,
PID0 and other-configuration SHA256. Borrowing can change only its binary command
to the V3 apphost with role Guardian and exact plan/approval/package pins. The
service name, account, SID and all other configuration stay fixed.

A valid Setup predecessor report and independent Setup process completion are
required before borrowing. Borrow intent precedes any possible partial SCM
change. Restoration requires independently confirmed termination of the pinned
Guardian process plus the exact stopped borrowed snapshot and still-valid
owner/custody/expiry checks. STOPPED/PID0, worker-ended text, a timeout or startup
diagnostic alone cannot authorize it. The30-second worker and45-second external
observation budgets remain distinct; late success is discarded and the real
worker must finish. Fast/unobserved processes stay unresolved. There is no
automatic rollback, restart, retry, kill, service deletion or key cleanup.

## Complete V3 binding chain

| Contract | Required V3 scope |
| --- | --- |
| Plan, reservation and lifecycle records | `TEST_ONLY_EXPORT_POLICY_CONTROL_V3` |
| Owner approval | `TEST_ONLY_EXPORT_POLICY_OWNER_APPROVAL_V3` |
| Package manifest | `TEST_ONLY_EXPORT_POLICY_PACKAGE_V3` |
| Native role evidence | `TEST_ONLY_EXPORT_POLICY_NATIVE_EVIDENCE_V3` |
| Inert / capable build | `TEST_ONLY_EXPORT_POLICY_CONTROL_INERT_BUILD_V3` / `TEST_ONLY_EXPORT_POLICY_CONTROL_CAPABLE_BUILD_V3` |
| Inert / capable package build | `TEST_ONLY_EXPORT_POLICY_CONTROL_INERT_PACKAGE_BUILD_V3` / `TEST_ONLY_EXPORT_POLICY_CONTROL_CAPABLE_PACKAGE_BUILD_V3` |
| Package verification | `TEST_ONLY_EXPORT_POLICY_CONTROL_PACKAGE_VERIFIED_V3` |
| Owner-kit build / kit | `TEST_ONLY_EXPORT_POLICY_OWNER_KIT_BUILD_V3` / `TEST_ONLY_EXPORT_POLICY_OWNER_KIT_V3` |
| Prepared input | `TEST_ONLY_EXPORT_POLICY_PREPARED_INPUT_V3` |
| Owner preflight | `TEST_ONLY_EXPORT_POLICY_OWNER_PREFLIGHT_V3` |

Schema1 remains where record shape is unchanged; exact scope is still required.
The inert/capable/owner-kit directory names and future input name use the fixed
new prefix. An input name must contain its own plan's attempt ID. The source,
package, helper, wrapper, builders, snapshot inventories and validators must
agree. Rehashed V1/V2 records, old names and renamed old candidates are rejected;
hash mismatch alone is not adequate coverage of semantic version admission.
Default builds and former capable defines, including V1 and V2, remain closed.

The capable build must bind its exact reviewed inert manifest and the same
source/tool/reference/runtime/package chain. The owner kit must bind the exact capable
manifest/package and helper/wrapper snapshots. No previous kit or approval is
inherited. The approval-effect vocabulary names the new V3 root, Setup and key
prefix and retains the unchanged Guardian borrow/restoration and retention limits.
Windows x64 and exact .NET10.0.11/runtime-inventory admission remain mandatory.
The wrapper pins runtime/fxr before helper startup and only temporarily excludes
and restores process-local DOTNET_ROOT; it does not change persistent settings.

Stable pure/synthetic, token-test, wrapper-test and bounded failure formats keep
their V1 scopes. Controller result keeps schema2 and
`TEST_ONLY_EXPORT_POLICY_CONTROLLER_RESULT_V2`; this is a report format, not a
placement selector. Its attempt/plan/approval/package correlation remains required.
The startup0xEC1 codec/stage table is unchanged. Raw status cache remains bounded
and memory-only; decode requires STOPPED/PID0, Win32 exit1066 and a valid payload.
Both transport and decoded records declare `evidenceAuthority=NONE` and cannot
grant process-exit proof, restoration permission or acceptance.

Review the complete chain through
[contracts](../../../licensing/adapter-evidence/export-policy-control/ControlContracts.cs),
[store](../../../licensing/adapter-evidence/export-policy-control/ProtectedControlStore.cs),
[keys](../../../licensing/adapter-evidence/export-policy-control/NativeKeys.cs),
[identity](../../../licensing/adapter-evidence/export-policy-control/NativeControlIdentity.cs),
[admission](../../../licensing/adapter-evidence/export-policy-control/NativeControlAdmission.cs),
[controller](../../../licensing/adapter-evidence/export-policy-control/ControlController.cs),
[helper](../../../licensing/adapter-evidence/export-policy-control/ControlInputTool.cs),
[control builder](../../../scripts/build-license-export-policy-control.ps1),
[kit builder](../../../scripts/build-license-export-policy-owner-kit.ps1)
and [wrapper](../../../scripts/run-license-export-policy-owner.ps1).

## Build/review sequence and stopping point

1. DONE: implement/review every V3 binding and negative V1/V2 fixture. Retain the scalar
   fix and independently reviewed Guardian/ACL/denial/worker invariants.
2. DONE: build the new inert artifact with complete source/tool/reference/runtime pins;
   review actual tests, closed-entry refusals and package custody. Re-run the
   separate same-token Scalar comparison against the retained old DLL through
   private reader methods only; no application/service entry is invoked.
3. DONE: build the test-capable artifact against that exact inert baseline. Review the
   purpose-specific capability, full package and malformed-route refusals without
   invoking a valid owner/service entry.
4. DONE: build/review the new owner kit's helper, wrapper, validators, safe own-token
   observations, version refusals and exact candidate/package/input bindings.
   Record actual outcomes and pins. This step stops here with no inputs issued.

CheckOnly, Prepare, approval issuance and Execute are outside this step. A later
physical step first needs an actual read-only elevated preflight and review of
fresh root/Setup placement, original stopped Guardian, runtime/host/boot and
custody. It then needs fresh bounded inputs, exact effect/hash review and the
owner's live CONFIRM in a visible elevated console; stdin/stdout stay unredirected
and confirmation is never auto-typed. Old approvals cannot be reused. After
independent termination observations, collect fixed originals/hashes separately;
unresolved state remains UNKNOWN without automatic retry or cleanup.

The completed builds do not establish host freshness, successful LocalSystem
admission or paired export evidence. LIC008/Phase6.2, native-entry, Security and
production acceptance remain open. No physical stage was executed; approval and
acceptance remain false. The separate capable artifact enables its admitted
physical entry, which is distinct from executing that entry.

## Advisory placement observation

At2026-10-28 09:23:07.3376541UTC, two narrow read-only observations returned
NOT_FOUND for the exact V3 root and SCM1060/NOT_REGISTERED for the exact V3 Setup
name. The local record is
`out/lic008-export-policy-v3-placement-observation-817e3568fc024665875fe962d0838ee6/observation.json`,
SHA256 `a649848dd9e0d644998ab6fa0d56d195bb50fcd1d37bb25bae25c3cb4b52ae86`.
This snapshot has authority NONE. It is not elevated owner CheckOnly, a current
Guardian/runtime/custody review or proof of freshness at a future execution.
No resource, input or approval was created by this observation.

## Actual source, build and regression results

The complete V3 root/Setup/SID/key-prefix/capability/scope/name chain is now wired
through control, service, helper, builders and wrapper. The retained fixed-size
Scalar implementation, Guardian identity/ACL contract, startup codec, controller
result schema2 and original denial classifier are unchanged. Negative fixtures
reject V1 and V2 keys, identities, records and placement scopes, including records
whose dependent hashes have been correctly rebound.

| Check | Actual result |
| --- | --- |
| Control suite, each variant and packaged apphost | 17,842 assertions PASS |
| Placement component, included in that total | 334 assertions PASS |
| Key component, included in that total | 265 assertions PASS |
| Identity component, included in that total | 494 assertions PASS |
| Default / legacy-defined entries | 14 refused per variant/apphost |
| Capable malformed entries | 13 refused per variant/apphost |
| Owner helper | 469 pure assertions; 8 malformed entries refused |
| Owner wrapper | 294 pure assertions PASS |
| Own-token helper | 9 checks PASS; ordinary token/elevation0 |
| Owner-kit report validators | 295 pure assertions PASS |
| Older artifact admission | 6 refusals before compilation/output creation |

The control builds execute the same17,842 cases repeatedly; do not sum those
runs into independent coverage. Inert has two variants and a packaged apphost;
the capable build has default/legacy/capable variants and a capable apphost.
The capable build tests only pure self-tests and malformed entry routes, never
a valid physical owner/service entry.

The new inert audit verified25 source/snapshot pairs, four tools,167 references,
190 runtime files and four package files. Its source-set SHA256 is
`8dfcbea41af9edaf5cbd501f252a645dadefc500f0618e12e8e09384b258c5e5`.
The capable build pins that exact inert manifest. Independent capable and
owner-kit audits also passed: the kit review verified31 current-source/snapshot
pairs, four tools plus PowerShell,167 references,190 runtime files, three kit
files, all report hashes and exact capable/inert bindings. The helper has no
physical capability. These bounded agent/source/artifact audits found no blocker;
they are not human Security acceptance.

The separate scalar regression ran at09:31:12–13UTC on .NET10.0.11, querying only
its own ordinary-process TOKEN_QUERY8 handle. Type8 returned1 in both old and new
readers. Elevation20 size query returned error24/required4; direct four-byte read
returned0; the retained old reader failed VALIDATION/0x80131501 and the V3 inert
reader returned0. No elevation or LocalSystem context was requested/reproduced,
and no service/key/application entry ran. This preserves the distinction from
the consumed service's observed stage; its original native error was not recorded.

The six earlier-artifact checks used V1/V2 inputs: control builder refused inert
locations with REVIEW_LOCATION_REFUSED, scalar runner refused those inert
locations with SCALAR_REGRESSION_INERT_LOCATION_REFUSED, and owner-kit builder
refused capable locations with CANDIDATE_LOCATION_REFUSED. Output sets were
unchanged. The36 previously archived evidence files also retained their hashes.

## Exact new artifacts

| Artifact | Output directory under `out/` | Manifest SHA256 |
| --- | --- | --- |
| Inert | `lic008-export-policy-v3-inert-36273b4afe3b484280b5985017ff9e0d` | `e63d05d4acba125db89153919b608dd68512b965b9fe4880875e65e6d4e565f1` |
| Capable | `lic008-export-policy-v3-capable-835d77e7113841a7bc5673cef2cd8eb6` | `b6f450fd5e6397d322f45fcc6df52322b28b8a376701b30ab9908f2f79b1156e` |
| Owner kit (`kit.json`) | `lic008-export-policy-v3-owner-kit-17ba89f4fc18449baa50c92abdc348ae` | `510bf819019a418f6bfecd41abfb4f362741393a218e1cd6a66eb31c2b5fca04` |
| Scalar regression | `lic008-export-policy-scalar-regression-a05fbae0f8ea4a0686169b79ece3c798` | `7983a14ee01d442e5c4b3ae0107d8fbad0461469159ca480f4a1cff390423f67` |

Capable package SHA256:
`73ddc70b61171f2e348a39ba38b315691fd226298caacaf7b5f01495af129f1b`.
The [exact-byte evidence archive](../evidence/export-policy-control-v3-20261028/README.md)
holds the build/package/pure reports, kit/helper/wrapper/token/validator records,
scalar regression, older-artifact refusals and advisory placement observation.
Generated binaries and snapshots remain in their unique local output folders.

The planned CheckOnly/input/live-confirmation steps subsequently ran, as recorded
in the [physical archive](../evidence/export-policy-control-v3-run-20261028/README.md).
The [first blank console](../evidence/export-policy-control-v3-owner-20261028/README.md)
was closed by the owner without confirmation; its input remains unreused. Fresh
admission and new exact input preceded the consumed attempt.

Next: bounded controller stage/reason diagnostics and offline tests for process
observation and protected-report admission, preserving the existing proof gates.
A short-lived RUNNING PID missed between full custody checks is a source-level
hypothesis, not the established cause. Retain consumed V1/V2/V3, including the two
new V3 keys and Setup registration. No retry, cleanup, approval extension or
retained-bit patch; later physical work requires separate reviewed fresh placement.
