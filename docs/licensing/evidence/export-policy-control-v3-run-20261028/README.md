# Consumed V3 attempt: Setup complete, controller UNKNOWN — 2026-10-28

[V3 contract](../../plans/LICENSING_EXPORT_POLICY_V3_PLACEMENT.md)
· [Earlier interrupted console](../export-policy-control-v3-owner-20261028/README.md)
· [Current handoff](../../../project/LICENSING_SESSION_HANDOFF.md)

Actual attempt `9dded1f90d5b4299ba973898bf42890c` is CONSUMED. After the owner's
live CONFIRM, Setup published a bound `SETUP_COMPLETE` report and both new-key
ownership records. The controller nevertheless failed in `run-setup` with
`UNKNOWN / VALIDATION / 0x80131501`, before borrowing Guardian. No paired export
test ran. Keep the root, Setup, keys, inputs, binaries and reports unchanged;
do not rerun, restart, clean up, extend approval or patch the retained package.
LIC008/Phase6.2 and Security/production acceptance remain open.

Fresh elevated CheckOnly passed at10:17:06–11UTC after the earlier console was
closed without CONFIRM. It again required exact V3 root absence and unregistered
Setup, together with unchanged owner, package, host/boot and original stopped
Guardian. This is a new admission before any observed V3 namespace consumption;
the previous input/launcher remain retained and unreused.

Prepare passed at10:18:04–14UTC and issued attempt
`9dded1f90d5b4299ba973898bf42890c`. Its input window is
10:18:09.510053–12:18:09.510053UTC (14:48:09–16:48:09 Kabul). Its historical expiry
does not authorize reuse of the consumed attempt.
Exact input hashes, candidate/package/DLL/runtime bindings, five allowed effects
and the original Guardian snapshot were reviewed before the owner confirmed.

The new single-use console launcher writes an initial direct console message
and independent file milestones. It omits optional transcription; this is an
observability change, not a demonstrated fix for the earlier blank window.
Native stdin/stdout remain attached, and no confirmation is supplied by automation.
Reviewed kit/source/native admission and process-restoration rules are unchanged.

Local capture directory:
`out/lic008-export-policy-v3-owner-check-220ed3a3403a4fcb875ccbe05e35d156`.
Local input directory:
`out/lic008-export-policy-v3-input-9dded1f90d5b4299ba973898bf42890c`.

## Actual execution and protected result

The visible elevated console PID12348 started10:21:56UTC. Durable file milestones
record the initial notice and wrapper entry; the owner reported typing the exact
CONFIRM in that window. The launcher supplied no input. It finished at
10:23:53.2871254UTC with `OWNER_EXECUTION_FAILED_OR_REFUSED_RETAIN_DO_NOT_RETRY`.
The outer capture does not independently classify the physical outcome.

The [protected controller result](controller-result.json) is schema2 /
`TEST_ONLY_EXPORT_POLICY_CONTROLLER_RESULT_V2`, which is the expected controller
schema for V3. It binds the exact attempt/plan/approval/package. Phase is
`run-setup`, outcome `UNKNOWN`, failure `VALIDATION`, managed HRESULT
`-2146233087 / 0x80131501`. Both accepted role-report hashes are null.
Cached Setup transport is STOPPED1/PID0 with Win32/service exits0/0, no startup
diagnostic and evidence authority NONE. Guardian transport is null;
`guardianBorrowAttempted=false`, `guardianRestored=false` mean it was never
borrowed, not that a restoration failed.

The separate [Setup report](reports__setup.json) records `SETUP_COMPLETE`, no
failure, workerEnded=true, deadlineExceeded=false and no pairs. Its actual
LocalSystem token is user/ownerS-1-5-18, primary type1, elevation1, V3 service SID,
attributes14, one matching group, unrestricted and queryComplete=true. It binds
the exact source artifact, runtime inventory, host/boot and inputs. PID14036
started10:23:43.1805614UTC. This is observed LocalSystem progress past the scalar
reader/admission that blocked V2; it is not independent process-exit proof or
controller acceptance of this report.

The setup-consumed marker, two intent records, two owned records and
[setup-complete journal](journal__setup-complete.json) are present. The completion
journal pins both owned records. Those records identify the new exportable
policy3 and nonexportable policy0 keys, distinct public-key hashes, and matching
DACL hash `801e69173a3331bc79d7018ce9ded8fab2337b8bd77444d4416c0690f8ce834a`.
They record key creation; collection did not reopen/export/inventory any key.
Guardian report/consumption marker and setup-recovery record are absent.

The [elevated read-only collection](collection-index.json) ran10:24:40–47UTC.
All three service/process snapshots observed the original Guardian binary/virtual
account, Stopped/Manual/PID0, and V3 Setup LocalSystem/Stopped/Manual/PID0 with
zero exit codes. No live control process was found. Eleven protected JSON files
were copied byte-for-byte and four installed package files matched the reviewed
package hashes. No service, ACL, key, binary or protected evidence was modified.

## Failure boundary and next work

The controller records only a broad phase and exception category/HRESULT. It
does not retain the exact failing predicate, first SCM status, process-handle
observation or protected-report read failure. Therefore the actual cause is not
established by SETUP_COMPLETE, exits0/0 or the later stopped snapshots.

Source review identifies the narrow next investigation in
[NativeControlDeployment.Run](../../../../licensing/adapter-evidence/export-policy-control/ControlWindowsDeployment.cs)
and [ControlController.VerifyRun](../../../../licensing/adapter-evidence/export-policy-control/ControlController.cs).
Run pins a process only for RUNNING4/nonzero PID and refuses STOPPED if it never
obtained that handle; repeated full custody checks can leave an observation gap
for a short worker. That is a source-level hypothesis, not a recorded miss in this
run. Run also substitutes empty report bytes after specified protected-store
read failures, while later report/binding/process checks can fail in the same
phase. The present diagnostic cannot distinguish these paths.

Next: add bounded, non-authoritative controller stage/reason diagnostics and
offline regressions for these observation/report boundaries in a separate source
change. Preserve independent process-completion, custody, token, restoration and
denial gates. Do not turn a worker's self-report, zero SCM exit or STOPPED/PID0
into substitute completion authority. Any later physical work needs its own
reviewed fresh placement/artifacts/inputs; consumed V1/V2/V3 cannot be retried.

| Binding | SHA256 |
| --- | --- |
| Owner kit | `510bf819019a418f6bfecd41abfb4f362741393a218e1cd6a66eb31c2b5fca04` |
| Capable manifest | `b6f450fd5e6397d322f45fcc6df52322b28b8a376701b30ab9908f2f79b1156e` |
| Package manifest | `73ddc70b61171f2e348a39ba38b315691fd226298caacaf7b5f01495af129f1b` |
| Execute launcher | `6a34423b0654c97c7525c2f54eedbce6daf9ad7a67293dbf413c0054b69c5e44` |
| Read-only collector | `2c5f178d46c49dc5e7f69f6d628a372bda796a7611cb3221f2466ee19d0e1e20` |

| Exact archived record | SHA256 |
| --- | --- |
| [CheckOnly-result.json](CheckOnly-result.json) | `f47cbf6d18f9d9a9fd375ab0bc2a56038db3220842a09c179ba03a1fb3713a74` |
| [Prepare-result.json](Prepare-result.json) | `ccffa92992470f6edafa276e2b5660cf02cb4cecdcbcdd3c632a1c8250dfd780` |
| [plan.json](plan.json) | `ecfd9b645245fd7ba1d7d1c4cc13a40c3820dcfb084a1d3c39f0f197f74e4863` |
| [approval.json](approval.json) | `e87ffc5e6d3e04ded0e04c5fa7a7cbd969021e14736ea6eb8ee198b499c08901` |
| [prepared-input.json](prepared-input.json) | `ba741b34afc87d366570c7d7568f6d320a03bcc4887ead0d78c43f0ee73d43b7` |
| [Execute-result.json](Execute-result.json) | `6d9a93ad995a5e001ffc957a1374039c67b840c049a0f2b5ebb650a93f97bea9` |
| [collection-index.json](collection-index.json) | `23ea0de5c219dba628f59d1614aa867c94e33501f7553ae0e5b951246532da13` |
| [controller-result.json](controller-result.json) | `d2eb611710c6c27f2375190dfeb366d7c7b8360009813575b36c4071cfe58923` |
| [reports__setup.json](reports__setup.json) | `25a90dc14494b5472d5c3f6d9720a43115ff8a9e26af299a94f4e9f43613af9f` |
| [reservation.json](reservation.json) | `af60bdde0702698a2abe52ef2580f03f028d68ed6da7d590e6efdbf887f2ea38` |
| [package-manifest.json](package-manifest.json) | `73ddc70b61171f2e348a39ba38b315691fd226298caacaf7b5f01495af129f1b` |
| [journal__setup-consumed.json](journal__setup-consumed.json) | `e975d002d54cff3babee96a4f92a649b91cf4ff653bcab213c6eb03d7a166eff` |
| [journal__exportable-intent.json](journal__exportable-intent.json) | `06c9b8f89bf95dd380aa3271f4a81b1088c6d96112ddaf3ab1733fe8fd81bcea` |
| [journal__nonexportable-intent.json](journal__nonexportable-intent.json) | `ae5b08dc265e9473063c7f9eb81e9d7b638d8ecef57e03cd09d23c06c78f1fbb` |
| [journal__exportable-owned.json](journal__exportable-owned.json) | `7746fe266555a0fab67c31fcfcef2e7689679b9d209e5b3003dad99a607b52c4` |
| [journal__nonexportable-owned.json](journal__nonexportable-owned.json) | `b687464fd0f68d2d6c1ae03bb7625176dd139a97968dc917d0aaf6131119e5c7` |
| [journal__setup-complete.json](journal__setup-complete.json) | `479fe99ce189e0bee1e898db8edc45f1c5b172322d626539a72e441340eea4a7` |

These seventeen JSON archives are exact byte copies with newline conversion
disabled. Protected plan.json duplicates the prepared plan byte-for-byte and is
stored once. No retained V1/V2 input, package, service or key is modified.
