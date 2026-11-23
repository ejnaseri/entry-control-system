# Scalar reader correction evidence — 2026-10-28

[Correction and continuation contract](../../plans/LICENSING_EXPORT_POLICY_SCALAR_READER_FIX.md)
· [Earlier consumed V2 evidence](../export-policy-control-v2-20261027/README.md)

These11 JSON files are exact byte copies of the new inert/capable build records
and the separate ordinary-process scalar regression. No JSON was reserialized.
Git attributes disable newline conversion and whitespace checking for these files.
Generated DLLs, apphosts and source snapshots remain in their unique `out` folders;
no binary is committed here.

## Before/after observation

The regression ran2026-10-28 09:01:46.5269475–09:01:47.0989422 UTC on .NET10.0.11.
It opened only its own current-process token with TOKEN_QUERY=8. The pinned old
capable assembly and corrected inert assembly were loaded in separate contexts,
and only their private Scalar methods were invoked. No application entry or
service identity Capture was executed.

| Information class | Zero-length query | Direct four-byte query | Old Scalar | Corrected Scalar |
| --- | --- | --- | --- | --- |
| TokenType(8) | false, error122, required4 | true, written4, value1 | returns1 | returns1 |
| TokenElevation(20) | false, error24, required4 | true, written4, value0 | VALIDATION / -2146233087 | returns0 |

The allocated-from-required-length queries also returned the same four-byte
values. `passed`, `baselineFailureReproduced`, `correctedMatchesDirect` and
`baselineTypeUnchanged` are true. This is an ordinary, unelevated primary token;
it does not reproduce the earlier LocalSystem service's native error or prove
that service startup now passes. No service, key, elevation or physical control
stage was invoked, and no acceptance flag was set.

The old DLL pin is
`add4b35d175e23bf37a420329db435bacce71a532c80fcd3e791bdaa72750b5f`.
The corrected inert DLL pin is
`2de08306e7e9e5cc4bfafd4ad11a0f91bbd909da919860f6eba6ed30fb0246db`.
All10 regression output size/hash entries were verified, including source,
runner, compile logs, runtimeconfig, input pins and result. The launcher records
two tool pins and167 reference pins; its runtime-inventory field binds metadata,
while the separate build/artifact review verifies installed runtime bytes.

Three admission-only negative checks also passed without creating output:
wrong manifest hash → `SCALAR_REGRESSION_PIN_REFUSED`; wrong DLL hash →
`SCALAR_REGRESSION_INERT_MANIFEST_REFUSED`; capable directory as inert input →
`SCALAR_REGRESSION_INERT_LOCATION_REFUSED`. All stop before compilation/token access.

## Build scope and provenance

Each inert variant passes17,667 assertions and14 closed-entry refusals. The
capable build's default/legacy/capable variants pass the same17,667 assertions
with14/14/13 refusals respectively. Packaged apphosts pass17,667 with14 inert
or13 capable refusals. These repeat the same suite; do not add their counts.
The identity component has494 cases, including126 new scalar assertions.

Capable mode is a separate build pinned to the reviewed inert manifest. Its
source-set hash is the same
`42672aa3987359bb55ede3b5565070cbd5da6599ec058fbbab97340411dce42e`.
The capable DLL is
`11c528b27b763493f40008d62ac5d611946aed13e8a9cf8747933a72d04f002d`.
Its physical capability flag is true, while `physicalTested`, `securityAccepted`
and `productionAccepted` remain false. Only pure self-tests and malformed capable
routes were executed. The native regression targets the inert DLL.

Independent final review rehashed each build's25 source/snapshot pairs, four
tools,167 references,190 runtime files and four package files, and confirmed the
capable-to-inert manifest binding. Documentation resolver self-tests and807 local
targets across114 Markdown files passed.

| Record group | Original output directory |
| --- | --- |
| Inert | `out/lic008-export-policy-v2-inert-02a1fdd35e9f4f6182c6a694af7c39ba` |
| Capable | `out/lic008-export-policy-v2-capable-0da1cb44ef064546a6df9b2903c95f0a` |
| Scalar regression | `out/lic008-export-policy-scalar-regression-d8f2727695214b7aa1d1741a7629b15a` |

For each build group, the first three copied files retain `manifest.json`,
`package-manifest.json` and `package-build.json` with a group prefix. The pure
reports come from `default/pure-test-report.json` for inert and
`capable/pure-test-report.json` for capable. The three scalar files copy
`result.json`, `manifest.json` and `input-pins.json` respectively.

An earlier compile-only harness attempt is retained in
`out/lic008-export-policy-scalar-regression-3676059cdd5440fba23c390b48f7d937`.
It stopped at compiler CS8618 before loading either target or querying a token.
The assertion helper's flow annotation was corrected before the successful new
run; no application-source or runtime-scope change was involved.

## Exact byte hashes

| Archived file | SHA256 |
| --- | --- |
| [inert-manifest.json](inert-manifest.json) | `8930298522fa8fbc3ea2887599f32396c16cbd724884159add5018022d752de3` |
| [inert-package-manifest.json](inert-package-manifest.json) | `ef6696a8852ff5f435f43cb4d5a29a3121de8ab1db6cc612bdd9c66b2ebfcf8d` |
| [inert-package-build.json](inert-package-build.json) | `23f15bdbf8d2c9b9240c2c87eb538522456181f7e464548309251519c3e01c0a` |
| [inert-pure-test-report.json](inert-pure-test-report.json) | `4cbb4e74b81de55f8d4422da359ae18f4cca1c36ea921f256ef53fcc4b2ff9bb` |
| [capable-manifest.json](capable-manifest.json) | `5981379fd802879d1b3b6a68414138056813fc92803fc449918266bcf1959b7d` |
| [capable-package-manifest.json](capable-package-manifest.json) | `e32f97fb717fb29dc937fc7147b6b0cc418cd9eec2b999b3cb6b651fe083ac23` |
| [capable-package-build.json](capable-package-build.json) | `1f6bfdf59be04a171acab7e9280e10f8389c4ff7442af96eacfefb3c69460b9d` |
| [capable-pure-test-report.json](capable-pure-test-report.json) | `82569741137e833f022918d5772201c5aad798a7121e9b3cf68ff60e4b77d228` |
| [scalar-regression.json](scalar-regression.json) | `8a3389b0645dbb0d645c98de3a26242d5a5b43fc124d64903f0c7aea44773475` |
| [scalar-regression-build.json](scalar-regression-build.json) | `98baba7e70977ace8482b4e84b6022f2ed819efd3be4a1fa212654cb1dc12098` |
| [scalar-regression-input-pins.json](scalar-regression-input-pins.json) | `3cd023bf6123ae9793323ff42778c282f529e2793498c001b425e92c52530480` |

Both consumed V1/V2 attempts remain retained and unmodified; all25 earlier
archived file hashes were rechecked unchanged. No new owner kit, approval,
CheckOnly, Prepare or physical Execute is claimed. The source still targets
consumed V2, so these artifacts cannot supply a fresh physical attempt. A
separately reviewed fresh-placement contract and newly bound artifacts/inputs
remain next. LIC008/Phase6.2 and acceptance decisions remain open.
