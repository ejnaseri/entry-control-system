# V3 source and artifact evidence — 2026-10-28

[V3 placement contract](../../plans/LICENSING_EXPORT_POLICY_V3_PLACEMENT.md)
· [Scalar correction](../../plans/LICENSING_EXPORT_POLICY_SCALAR_READER_FIX.md)
· [Consumed V2 evidence](../export-policy-control-v2-20261027/README.md)

These19 JSON files preserve exact bytes from separate V3 builds, read-only token
regression and bounded placement/binding observations. No JSON was reserialized.
Git attributes disable newline conversion and whitespace checking for these JSON
files. Generated binaries and source snapshots remain in unique `out` directories;
no binary is committed here. No protected root, Setup service, test key, owner
input or approval was created in this checkpoint.

## Source and build boundary

Source baseline is `10e1913`. The new fixed root/Setup/SID/key prefix and all
placement-bound scopes/capability select V3. Existing Guardian identity, ACLs,
scalar fix, lifecycle/process/restoration guards, diagnostic codec, runtime
inventory format and controller schema2/RESULT_V2 remain unchanged. Old V1/V2
bindings are explicit negative fixtures; they do not select retained resources.

The inert/capable chain shares source-set hash
`8dfcbea41af9edaf5cbd501f252a645dadefc500f0618e12e8e09384b258c5e5`.
Independent review checked each build's25 current source inputs and snapshots,
four tools,167 references,190 runtime files and four package files, including
exact capable-to-inert manifest binding. The runtime inventory hash remains
`f5e89159159cad439f9a473c4c46d6c8ba785c59828f8854d5467dc7d8dd76fa`.

| Check | Actual result |
| --- | --- |
| Each control variant and packaged apphost | 17,842 assertions passed |
| Placement component | 334 cases, within the total |
| Native-key pure component | 265 cases, within the total |
| Identity component, including scalar correction | 494 cases, within the total |
| Default and legacy defines | 14 closed-entry refusals per variant/apphost |
| Capable build | 13 malformed-entry refusals per variant/apphost |
| Owner helper | 469 pure assertions and eight malformed-entry refusals |
| Owner wrapper | 294 pure assertions |
| Owner-kit report validators | 295 pure assertions |
| Owner helper's own-process token test | Nine checks, ordinary token/elevation0 |
| Prior-artifact path admission | Six refusals before compilation or output |

Repeated executions use the same assertions; their totals are not independent
physical experiments. Legacy compilation includes both V1 and V2 controller
defines and remains inert. Only the V3 define enables capable dispatch. The
builder executes only pure self-tests and malformed capable routes; no valid
service/controller entry is invoked. Every build's physical-tested and acceptance
flags remain false.

The new owner kit binds the reviewed capable manifest/package,25 candidate source
inputs and six helper/wrapper/build/test inputs. Its helper is compiled without
the capability define. The token test reads only its own token and verifies the
Query|Duplicate membership path; it is not elevated owner CheckOnly. Its reported
query-only exception is a separate known membership-path observation from the
scalar-reader regression below. No valid check/prepare/controller route ran.
The kit manifest records the same previously reviewed owner SID; a read-only
current-process user check matched it before building. No approval or expiry is
issued by creating the kit.

Independent final kit review rehashed all31 current inputs and snapshots,
recomputed their source sets, and verified four tools, PowerShell,167 references,
190 runtime files, three kit files and all four report hashes. The helper compile
selects only ControlInputTool Main with warnings as errors and no capability
define. The kit's approval-issued, elevated-preflight, physical-stage, helper
capability and acceptance flags are all false. This bounded automated/agent
review does not constitute human Security acceptance.

## Ordinary-token scalar regression

The separate harness ran on .NET10.0.11 at09:31:12–13UTC, PID8164, with only its
own current-process TOKEN_QUERY=8 handle. It loaded the pinned old V2 DLL and
new V3 inert DLL in separate contexts and called only the private Scalar method.

| Information class | Zero-length query | Direct four-byte query | Old Scalar | V3 inert Scalar |
| --- | --- | --- | --- | --- |
| TokenType(8) | false/error122/required4 | true/written4/value1 | returns1 | returns1 |
| TokenElevation(20) | false/error24/required4 | true/written4/value0 | VALIDATION/-2146233087 | returns0 |

The allocated-size reads agree with the direct reads. The old DLL remains
`add4b35d175e23bf37a420329db435bacce71a532c80fcd3e791bdaa72750b5f`;
the new inert DLL is
`b040f5b38d58616ccae01146f136d9170461b34b97d611d3354f73b7102cf66e`.
All10 output pins, two tool pins and167 references were verified. The runner's
runtime-inventory field binds metadata; actual runtime-byte verification belongs
to the separate artifact audit. This ordinary, unelevated primary-token result
does not reproduce LocalSystem or prove that Setup startup will succeed.

## Advisory placement and prior-binding checks

At09:23:07.3376541UTC, `Get-Item -LiteralPath` for exactly
`C:\ProgramData\Ecs.Lic008.ExportPolicyControlV3` returned ItemNotFound, and
`sc.exe query Ecs.Lic008.ExportPolicyControlV3.Setup` returned1060. Only those two
read-only targets were queried. The record has `evidenceAuthority=NONE`: it is
not elevated CheckOnly, a Guardian/custody check or future freshness proof.

Six admission checks used existing, correctly hashed V1/V2 artifact directories.
The control builder refused old inert paths with `REVIEW_LOCATION_REFUSED`;
the scalar runner used `SCALAR_REGRESSION_INERT_LOCATION_REFUSED`; the owner-kit
builder refused old capable paths with `CANDIDATE_LOCATION_REFUSED`. Every call
produced no stdout and left the relevant output-directory set unchanged. No
compilation, token helper or physical entry was reached in these six checks.
Separate in-memory regressions exercise old scopes and effects with recomputed
pins, including both old consumed/complete journals before any fake key call.

These two small observation records were emitted by direct PowerShell read-only
checks, not by the physical runner. They make no claim of physical admission.

## Provenance and byte custody

| Record group | Original directory under `out/` |
| --- | --- |
| Inert | `lic008-export-policy-v3-inert-36273b4afe3b484280b5985017ff9e0d` |
| Capable | `lic008-export-policy-v3-capable-835d77e7113841a7bc5673cef2cd8eb6` |
| Owner kit | `lic008-export-policy-v3-owner-kit-17ba89f4fc18449baa50c92abdc348ae` |
| Scalar | `lic008-export-policy-scalar-regression-a05fbae0f8ea4a0686169b79ece3c798` |
| Placement observation | `lic008-export-policy-v3-placement-observation-817e3568fc024665875fe962d0838ee6` |
| Prior-binding refusals | `lic008-export-policy-v3-binding-regression-021b92eca2cc48aeb45b891659d52b7c` |

Build files copy `manifest.json`, `package-manifest.json` and `package-build.json`
with their group prefix; pure reports copy `default/pure-test-report.json` for
inert and `capable/pure-test-report.json` for capable. The scalar files copy
`result.json`, `manifest.json` and `input-pins.json`. Placement copies
`observation.json`; binding refusals copy `result.json`. The six owner-kit files
copy `kit.json` and `kit-build.json` under `owner-kit` names and the four test
reports under their original names. No source output was edited after copying.

| Archived file | SHA256 |
| --- | --- |
| [inert-manifest.json](inert-manifest.json) | `e63d05d4acba125db89153919b608dd68512b965b9fe4880875e65e6d4e565f1` |
| [inert-package-manifest.json](inert-package-manifest.json) | `bf51b68cb75135a884cb948cf3b8283e3a608e3146e9ee547c9e29c1832cf0e2` |
| [inert-package-build.json](inert-package-build.json) | `f087a0bbd622ad541719c2035f0fe7ed8bf18fbef09872e31fe90425d9de9927` |
| [inert-pure-test-report.json](inert-pure-test-report.json) | `8481d5ab87d967f00435f2929d1744aa40003a0740935bc5bfb8e0620886338d` |
| [capable-manifest.json](capable-manifest.json) | `b6f450fd5e6397d322f45fcc6df52322b28b8a376701b30ab9908f2f79b1156e` |
| [capable-package-manifest.json](capable-package-manifest.json) | `73ddc70b61171f2e348a39ba38b315691fd226298caacaf7b5f01495af129f1b` |
| [capable-package-build.json](capable-package-build.json) | `77fa0270ee99d243177807a5ee9f1fb1eccd45474ba5e4a75653df3ba3a198fd` |
| [capable-pure-test-report.json](capable-pure-test-report.json) | `50bc39c9ce870606f2dfa0c01430d2dd051356b06dd1064d2e59bf3ba58e3732` |
| [owner-kit.json](owner-kit.json) | `510bf819019a418f6bfecd41abfb4f362741393a218e1cd6a66eb31c2b5fca04` |
| [owner-kit-build.json](owner-kit-build.json) | `684b43bce2aceeff30409265e9fcc197d3d87450c037c7442d94c97d6c67b432` |
| [helper-pure-test-report.json](helper-pure-test-report.json) | `0c96aa6eae9401a4fb7e003630cc0fa37dc5d92e00f46a44d99f104d50b96b7d` |
| [wrapper-pure-test-report.json](wrapper-pure-test-report.json) | `25550f6f69433ab0c58409862f654176591cd317e0f0a28d65f227f7816dae33` |
| [owner-token-test-report.json](owner-token-test-report.json) | `97feeddc67bb59edc5bd9ee8313e2c70c20908904d8a2f2f72688cf0cea6d845` |
| [kit-validation-test-report.json](kit-validation-test-report.json) | `4ff911b6d8dbb64f79015dc254bb7eba08d7e99471ae4eb35505c66d3d3f104f` |
| [scalar-regression.json](scalar-regression.json) | `1b37e3b2f4a3394e0df1cad1b35ce113a1364a259241196b6670d53787a8e15c` |
| [scalar-regression-build.json](scalar-regression-build.json) | `7983a14ee01d442e5c4b3ae0107d8fbad0461469159ca480f4a1cff390423f67` |
| [scalar-regression-input-pins.json](scalar-regression-input-pins.json) | `9ec37e51a4cc0483969b0dd1a47fe3747a6993b93d7e0fe58005d84e599841e6` |
| [placement-observation.json](placement-observation.json) | `a649848dd9e0d644998ab6fa0d56d195bb50fcd1d37bb25bae25c3cb4b52ae86` |
| [binding-refusals.json](binding-refusals.json) | `2789ff1e28dc00a1b845532402b7f363699c8d30e948350527e163652072bcc7` |

All36 earlier archived V1/V2/scalar-checkpoint file hashes were rechecked
unchanged. All five changed PowerShell scripts parsed successfully. Documentation
resolver self-tests and854 local targets across116 Markdown files passed.
Retained state was not restarted, patched or cleaned up. Elevated
CheckOnly, Prepare, input/approval issuance and Execute remain pending. The next
step uses the newly reviewed owner kit for a separate elevated read-only
preflight before any fresh bounded input is prepared. LIC008/Phase6.2, native-entry,
Security and production acceptance stay open.
