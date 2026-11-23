# Controller diagnostic source and inert verification — 2026-10-28

[Implementation contract](../../plans/LICENSING_EXPORT_POLICY_CONTROLLER_DIAGNOSTICS.md)
· [Consumed V3 physical evidence](../export-policy-control-v3-run-20261028/README.md)
· [Current handoff](../../../project/LICENSING_SESSION_HANDOFF.md)

This checkpoint adds bounded controller/run diagnostics after source baseline
`7ea3f5f`. Only an inert artifact and pure tests were executed. The eight JSON
files here preserve the exact original report bytes; they were not reserialized.
Git attributes disable newline conversion and whitespace checking for these
files. Generated binaries and source snapshots remain in the unique `out`
directory below and are not committed in this archive.

## Meaning and limits

Controller result schema3 / `TEST_ONLY_EXPORT_POLICY_CONTROLLER_RESULT_V3`
adds closed operation stages and optional per-role observations: first/last
service status, observed RUNNING, process admission/wait state, protected-report
read status and bounded failure categories/HResults. Handled report-read failures
remain separate from a later propagated failure. No exception message, stack,
free-form path, report body or private key material is added. Every diagnostic
has `evidenceAuthority=NONE` and cannot authorize completion or report admission.

Stages identify operation boundaries. They do not identify every predicate
inside grouped snapshot, custody or report checks, and first/last observations
are not a complete timeline. Missing a RUNNING observation cannot establish that
the service never ran. The source retains the original guards, native calls,
25 ms polling, 45 s deadline, process proof, single-use checks, report fallback,
Guardian restoration and result-publication behavior.

Consumed V3 attempt `9dded1f90d5b4299ba973898bf42890c` still has the original
schema2 controller result: `UNKNOWN / VALIDATION / 0x80131501` at `run-setup`,
despite its separate protected Setup completion and new-key journals. Its exact
refusing predicate remains unknown. The new diagnostics do not retrofit that
attempt or establish its cause. Synthetic tests of missed RUNNING, read refusal
and report rejection are regression coverage, not a physical reproduction.

## Actual verification

| Check | Result |
| --- | --- |
| Default inert, legacy-define inert and packaged apphost | 18,076 assertions each; PASS |
| Controller component within each total | 1,499 assertions; 234 added |
| Closed native entry routes | 14 refusals per variant/apphost |
| Owner-kit report validators | 295 pure assertions; PASS |
| Modified control/owner-kit build scripts | PowerShell parser: zero errors |
| Documentation resolver and self-tests | PASS: 120 Markdown files, 927 local link targets |
| Independent source review | Diagnostic isolation, existing operation order and failure preservation: PASS |
| Independent fresh artifact review | 26 current sources and snapshots, 4 tools, 167 references, 190 runtime files and 4 package files: PASS |
| Retained evidence review | All 95 previously tracked evidence files match `7ea3f5f` byte-for-byte |
| Retained V3 artifact review | Old manifests/pins, 81 source snapshots and 16 variant/package/kit payloads unchanged |

Repeated executions use the same assertions; their totals must not be added as
independent cases. The three pure-test reports below have identical bytes.
Default and legacy compilation remain inert, with capability `NONE` and all
physical-tested/security/production acceptance flags false. Legacy defines do
not enable physical execution. The owner-kit validator uses its pure validation
fixtures; it does not build a kit or invoke the owner workflow.

## Original locations and exact hashes

The inert build is:
`out/lic008-export-policy-v3-inert-6c577c01ff8b4cecb6309d6c64e0e5c8`.

The owner-kit validator report is:
`out/lic008-controller-diagnostics-verification-402ab74c4ea34efaae44a572b98bdacd/owner-kit-validator-tests.json`.

All files below except that separate validator report came from the inert build.
The default/legacy reports were copied from `default/pure-test-report.json`
and `defines-still-inert/pure-test-report.json`, respectively; the other filenames
are unchanged.

| Archived file | SHA256 |
| --- | --- |
| [manifest.json](manifest.json) | `7ce1da6be5eb9d8404d5c137af5ca70838006ee04d6d7d0990c0a38e3fb05771` |
| [package-manifest.json](package-manifest.json) | `6e030355ac0e4b5cf8238f894c4a17e2edd5526066f3e6118c9387b02f0a1dc0` |
| [package-build.json](package-build.json) | `2cfb3ebc88719cae655e626e649a69da19e5d283ad25a39a3525444f99e1bafe` |
| [package-verification.json](package-verification.json) | `b663c88ef10fe131e5451d843abb33ead39e5997bcd4df69813cc224644e2aa9` |
| [apphost-pure-test-report.json](apphost-pure-test-report.json) | `5eba8240813069cd4ce1f800264d10ba3df37f99e6fea22a08d470dc73aac5d8` |
| [default-pure-test-report.json](default-pure-test-report.json) | `5eba8240813069cd4ce1f800264d10ba3df37f99e6fea22a08d470dc73aac5d8` |
| [legacy-pure-test-report.json](legacy-pure-test-report.json) | `5eba8240813069cd4ce1f800264d10ba3df37f99e6fea22a08d470dc73aac5d8` |
| [owner-kit-validator-tests.json](owner-kit-validator-tests.json) | `4ff911b6d8dbb64f79015dc254bb7eba08d7e99471ae4eb35505c66d3d3f104f` |

| Additional build pin | SHA256 |
| --- | --- |
| Default/package DLL | `109cc589957d0109e5a338322463c70e5c90aa85fe27ec37d82e879d6b3e15fa` |
| Legacy-define DLL | `3f2bbe2f405f99108918db75aa1c5167346731e4080df102297d1ede7dd86000` |
| Source set | `b4f83e5e24b72c4021c418e465c5af3f7b5d7d06b3808b334a2ebaaaba4ebe3c` |
| Runtime inventory | `f5e89159159cad439f9a473c4c46d6c8ba785c59828f8854d5467dc7d8dd76fa` |

## Next boundary

No capable build, owner-kit build, own-token regression, owner CheckOnly/Prepare,
new input/approval or physical experiment was performed. The source still binds
the consumed V3 placement; this inert artifact is not a fresh runnable experiment.
Retained V1/V2/V3 resources, keys, inputs, packages and evidence must remain intact.

The next step is a separate review of fresh placement and complete artifact/input
bindings for a future instrumented experiment. Later physical execution requires
its own current preflight, fresh bounded inputs, review and live owner `CONFIRM`.
This archive does not supply those prerequisites. Paired export evidence,
LIC008/Phase6.2, security acceptance and production/release acceptance remain open.
