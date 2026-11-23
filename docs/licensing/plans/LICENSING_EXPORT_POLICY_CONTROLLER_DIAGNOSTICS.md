# Export-policy controller diagnostics

Date: 2026-10-28. Source baseline: committed `7ea3f5f`.
Status: `SOURCE_IMPLEMENTED_INERT_BUILD_AND_REVIEW_PASS`.

[Consumed V3 evidence](../evidence/export-policy-control-v3-run-20261028/README.md)
· [Historical V3 placement contract](LICENSING_EXPORT_POLICY_V3_PLACEMENT.md)
· [Exact inert verification evidence](../evidence/export-policy-controller-diagnostics-20261028/README.md)
· [Experiment](../experiments/LICENSING_EXPORT_POLICY_CONTROL.md)
· [Current handoff](../../project/LICENSING_SESSION_HANDOFF.md)

## Problem and evidence boundary

Consumed V3 attempt `9dded1f90d5b4299ba973898bf42890c` recorded a protected
LocalSystem `SETUP_COMPLETE` report and both new-key ownership/completion
journals. Its controller nevertheless ended at `run-setup`,
`UNKNOWN / VALIDATION / 0x80131501`, without an accepted Setup report hash.
The retained transport observation was STOPPED/PID0 with zero exit codes.
Guardian was never borrowed and no paired exports ran. The actual controller
predicate that refused this run was not recorded.

A missed short-lived RUNNING/nonzero PID, a refused protected-report read and
report-binding validation are investigation paths, not established causes.
Setup completion, zero service exit codes and later stopped snapshots do not
replace the controller's independent process-completion and report-admission
requirements. The new instrumentation does not add evidence to that historical
run or change its `UNKNOWN` outcome.

## Implemented source contract

The change adds bounded observations in
[ControlRunDiagnostics.cs](../../../licensing/adapter-evidence/export-policy-control/ControlRunDiagnostics.cs),
[ControlController.cs](../../../licensing/adapter-evidence/export-policy-control/ControlController.cs)
and [ControlWindowsDeployment.cs](../../../licensing/adapter-evidence/export-policy-control/ControlWindowsDeployment.cs).
The controller now emits schema3,
`TEST_ONLY_EXPORT_POLICY_CONTROLLER_RESULT_V3`, with a closed controller stage
and nullable Setup/Guardian run diagnostics. Each diagnostic has
`evidenceAuthority=NONE`. This is a report-format revision inside the existing,
consumed ExportPolicyControlV3 placement; no fresh physical namespace is
implemented here. Historical V2/V3 controller results remain their original
schema2 / `TEST_ONLY_EXPORT_POLICY_CONTROLLER_RESULT_V2` bytes.

The controller stage identifies the operation boundary at which control stopped:
deployment and registration; Setup run/process proof/report parse/report
validation/start time/service exit/predecessor; Guardian borrow/run/process
proof/restoration/report admission/result parse; or final completion. Guard and
observation boundaries have separate closed names. These names do not identify
every nested predicate inside a snapshot, custody check or report validation.
They provide a bounded location, not a promise of an exact root-cause diagnosis.

Each Windows role run maintains one memory-only trace. It records:

| Field group | Meaning and limit |
| --- | --- |
| Stage | Closed boundary for admission, initial configuration/start/status, polling, process admission/wait, final checks, report read, return or timeout. The first propagated failure preserves its boundary. |
| First/last status | The first and latest raw status observations already obtained by the run. No extra SCM queries are made to populate diagnostics. |
| Running observed | Whether an existing observation saw RUNNING with nonzero PID. False cannot prove that no such transient state existed between observations. |
| Process observations | Handle-opened flag; PID and UTC start only after identity admission; identity-validated flag; raw wait result and observed-exit flag. No process handle is serialized. |
| Report read | `NOT_ATTEMPTED`, `READ`, `EMPTY` or `REFUSED`, bounded byte count, and a separate optional read-failure category/HResult. No report bytes are retained here. |
| Run failure | First propagated failure's existing closed category and managed HResult. No exception object, message or stack is retained. |
| Authority | Always `NONE`; diagnostic status, wait results and flags cannot authorize completion, report acceptance or restoration. |

`ReadFailed` preserves the existing protected-report fallback: caught
IO/invalid-data/access failures still return an empty report to the controller,
but the role diagnostic records `REFUSED` and the first read failure separately.
That handled read failure does not freeze the run stage or become its propagated
failure. The run can therefore reach `Complete` while the later controller stage
is `SetupReportParse` or `GuardianReportParse`. This must not be described as a
successful report read, or confused with a read that was never attempted.

The controller obtains cached diagnostics in the existing run's `finally`
observation path. The backend getter only snapshots memory. Missing diagnostics,
getter exceptions or malformed values do not replace the execution result or
the original exception. Sanitization requires canonical closed stage/category/
read-status values, authority `NONE`, valid state and PID/time/identity/wait
relationships, and a report length no greater than 2,097,152 bytes. Rejected
diagnostic data are omitted. No free-form paths, accounts, exception text,
report contents, key material or private-key data are added to these records.

## Unchanged execution and authority

The source change preserves existing guard/callback order, native-call order,
SCM polling cadence, timeout, process-handle disposal, report fallback behavior,
failure propagation and protected-result publication. It introduces no early
file write or diagnostics-only native entry. The 25 ms polling loop and 45 s
run deadline remain. The existing service startup codec and its transport
decoding are unchanged.

Independent process completion, image/time/PID admission, custody and immutable
input checks, report binding, single-use consumption, Guardian borrow/restoration
permissions and export-policy classification still control the result. The
new fields are not consulted to grant those permissions. A signaled wait stored
in a diagnostic is not a replacement for the original process proof.

The initial controller admission occurs before its result-publication region;
a refusal there, a process crash or a failed protected-result publication can
still leave no result. A grouped stage cannot distinguish all checks within its
operation. The trace contains first/last observations, not a complete timeline.
These limitations prevent treating the instrumentation as universal logging or
using missing observations as proof of absence.

## Actual verification in this checkpoint

Only an inert artifact was built. Both default and legacy-define inert variants
and the packaged apphost pass **18,076** assertions each, including **1,499**
controller checks (**234** added), and **14** entry refusals each. Regression
coverage includes missed-RUNNING fixtures; partial process admission and wait
outcomes; separate empty/refused/unattempted report reads; preserved first
failures; malformed or unavailable cached diagnostics; controller stage
boundaries; unchanged fake-backend call order and restoration outcomes; and
schema3 serialization with no free-form canary leakage. These are synthetic
fixtures, not a reproduction of the historical physical failure.

The owner-kit validator's pure suite passes **295** cases. Both changed builder
scripts parse with zero errors. Documentation resolver self-tests and all **927**
local link targets across **120** Markdown files pass. This validator run does not build a new owner
kit or execute a native worker. The inert manifest pins **26** source files,
**4** build tools, **167** reference assemblies and **190** runtime files.
Independent artifact review passes: exact source/snapshot/tool/reference/runtime
pins and all four package files match. The 95 previously tracked evidence files
and retained V3 artifact snapshots/payloads remain unchanged. This review grants
no runtime or security acceptance.

Artifact directory:
`out/lic008-export-policy-v3-inert-6c577c01ff8b4cecb6309d6c64e0e5c8`.

| Artifact | SHA256 |
| --- | --- |
| Inert build manifest | `7ce1da6be5eb9d8404d5c137af5ca70838006ee04d6d7d0990c0a38e3fb05771` |
| Package manifest | `6e030355ac0e4b5cf8238f894c4a17e2edd5526066f3e6118c9387b02f0a1dc0` |
| Package build manifest | `2cfb3ebc88719cae655e626e649a69da19e5d283ad25a39a3525444f99e1bafe` |
| Packaged apphost verification | `b663c88ef10fe131e5451d843abb33ead39e5997bcd4df69813cc224644e2aa9` |
| Default inert DLL | `109cc589957d0109e5a338322463c70e5c90aa85fe27ec37d82e879d6b3e15fa` |
| Source set | `b4f83e5e24b72c4021c418e465c5af3f7b5d7d06b3808b334a2ebaaaba4ebe3c` |

The [evidence archive](../evidence/export-policy-controller-diagnostics-20261028/README.md)
records exact original reports and the scope of verification. No capable build,
owner-kit build, native own-token regression, CheckOnly, Prepare, fresh approval,
input issuance or physical experiment was performed in this checkpoint.

## Next bounded work

First independently review a fresh placement and complete binding chain for a
future instrumented artifact. Review and build that chain separately before any
new owner preflight or input issuance. A later authorized physical observation
would require its own current preflight, exact fresh bounded inputs, independent
input review and live owner `CONFIRM`; this document supplies none of them.

Preserve consumed V1/V2/V3 roots, Setup registrations, installed bits, keys,
inputs, approvals, journals and evidence bytes. Do not retry, restart, clean up,
patch retained packages, reuse inputs or infer recovery authority from the new
diagnostics. New instrumentation cannot retrofit the consumed V3 attempt.
Its exact cause and V1's original cause remain unknown. Paired export evidence,
LIC008/Phase6.2, security acceptance and production/release acceptance remain open.
