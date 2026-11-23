# Consumed V4 diagnostic execution ? 2026-10-28

[V4 contract](../../plans/LICENSING_EXPORT_POLICY_V4_PLACEMENT.md) ? [Construction evidence](../export-policy-control-v4-20261028/README.md) ? [LIC008 work ledger](../../plans/LICENSING_LIC008_COMPLETION_PLAN.md)

Code/artifact baseline: `a72c400`. Attempt `95dcc9bb897c4fcb869f7af8a6c7f8bd` is
CONSUMED after elevated CheckOnly/Prepare, independent exact-input review and
live owner-entered CONFIRM. The native experiment is not to be repeated.

## Actual result and localized refusal

Controller schema3 / RESULT_V3 remains `run-setup / UNKNOWN / VALIDATION /
0x80131501`, with null accepted Setup/Guardian report hashes. The new closed
controller boundary is `SetupRun` and native run boundary is `StoppedProcess`.

| Observation | Original recorded value |
| --- | --- |
| First SCM status | START_PENDING/state2, PID10372, exits0/0 |
| Last SCM status | STOPPED/state1, PID0, exits0/0 |
| RUNNING observed / handle opened | false / false |
| Admitted PID / start / identity | 0 / null / false |
| Wait result / observed process exit | null / false |
| Protected report read | NOT_ATTEMPTED, 0 bytes, no read failure |
| Run failure | VALIDATION / managed HResult -2146233087 |
| Diagnostic authority | NONE |
| Guardian borrow / restoration | false / false; never borrowed |

At this reviewed source boundary the refusing predicate requires a non-null
pinned process handle and positive admitted PID. Both were absent. This localizes
V4 to missing independent Setup process observation, before protected-report read
or controller report parsing. It does not prove that Windows never entered
RUNNING, why observations missed it, or the cause of consumed V3/V1.

The separately collected protected Setup report is `SETUP_COMPLETE`, PID10372,
start13:27:20.4290332UTC, workerEnded true, deadlineExceeded false, no failure or
pairs. It binds the V4 SYSTEM primary/elevated token and exact Setup service SID,
attempt, plan/approval/package/DLL/runtime/host/boot. Both fresh intent/owned
records and setup-complete hashes agree, with distinct public identities,
export policies3/0 and the same protected DACL. These records establish reported
Setup progress; they do not supply the controller missing process proof.

Guardian report and guardian-consumed record are absent; Guardian was never
borrowed and paired export comparison is NOT_RUN. setup-recovery is absent.

## Execution, collection and custody

| Event | UTC on 2026-10-28 |
| --- | --- |
| CheckOnly | 13:17:47.7780085?13:17:55.5398202 |
| Prepare | 13:19:44.7664747?13:19:59.7887564 |
| Input issue / expiry | 13:19:52.3030835 / 15:19:52.3030835; consumed irrespective of expiry |
| Execute capture | 13:25:12.3903219?13:27:34.7149450; visible console PID1376 |
| Read-only collection | 13:29:29.3489767?13:29:34.3526281 |

The collector recorded 11 exact JSON originals, four deployed package hashes and
3 absent fixed paths. Three collection samples show Setup LocalSystem and the
original Guardian Stopped/Manual/PID0, with no live ExportPolicyControl process.
Guardian retains original binary/account; its recorded exit1077 is not a new
Guardian execution. All 12 read-only SCM queries returned0. The collector performs
no service/key/ACL change or success classification. Its nativeExperimentExecuted
false flag describes collection only; the owner-confirmed experiment did run.

Independent post-run review rehashed all copies and deployed payloads, reconciled
bindings, token and journals, and checked the final service/process observations.
This scoped review is not full LIC008, matrix or Security acceptance.

Original capture directory: `out/lic008-export-policy-v4-owner-check-c08ad30799bf4d6494d4ba9ceb92cd74`.

Input directory: `out/lic008-export-policy-v4-input-95dcc9bb897c4fcb869f7af8a6c7f8bd`.

These 17 JSON files preserve exact original bytes without reserialization or Git
newline conversion. The protected plan equals the prepared plan and is stored
once. Binary contents are not committed.

| Archived record | SHA256 |
| --- | --- |
| [CheckOnly-result.json](CheckOnly-result.json) | `47b80f5e080db48551772afdccf8cfbe0984d2597383c188ea468dcee7dc5e69` |
| [Prepare-result.json](Prepare-result.json) | `a132e9ff81b6305bfdd0bb923354e29bde3b2ee63678ea62cd8404c130a462d7` |
| [Execute-result.json](Execute-result.json) | `16c8fef79824f6de631c2aec45076ce3213a8f1231ebc66e7ba1a4789f9934d3` |
| [approval.json](approval.json) | `f8bb6c8d81b30a43732ac0b7fe6b46afc078de1ea4b30a709b5ff611aa0bf8a5` |
| [prepared-input.json](prepared-input.json) | `054b8388b459606046c8443dfdcfe804a07912b2d0d9b16958ae619cef004c71` |
| [collection-index.json](collection-index.json) | `3135803c2ac3dcf12e1dd44c23c01f5c261e9b2cc180d031daba0a8eb0fcaed4` |
| [controller-result.json](controller-result.json) | `a778a144b036e351d3fd7eb681eb27429fe20c6fbe5dfc7de0bd219dc7d16acd` |
| [reports__setup.json](reports__setup.json) | `5786174ed81e36f2fbb762a121b5d98312c1604abc1c78a192ac9ad1795a3fb9` |
| [plan.json](plan.json) | `58152e2eb15432917c0e23db28f0a5010912b8d0adfe3eae92cf7b136ff1c5b3` |
| [reservation.json](reservation.json) | `6b7afc6ec3005382b917cdcc8ed647b1e8daaa4d92d92211db5e1e543cfb8c37` |
| [package-manifest.json](package-manifest.json) | `fca1d27771cd04c2b1bb3131654f109e3e85efc839903d36271e821b52eafbfb` |
| [journal__setup-consumed.json](journal__setup-consumed.json) | `46b969ad34d19b3f8a6337f9b65d7962ab377677a8fa220d0fdc385d4d0a97de` |
| [journal__exportable-intent.json](journal__exportable-intent.json) | `ea4cc5db3322485eb3cf62a7aa5c320f5574d84b6fc0137b82cc11338ff19c85` |
| [journal__nonexportable-intent.json](journal__nonexportable-intent.json) | `2a3c09b3271bd9047c225ec220b48ee58abcae54db1a76338947034bc318be5f` |
| [journal__exportable-owned.json](journal__exportable-owned.json) | `e597a4b79e4ffd4d21404b6974428082ecbf71cf025240c72bc5001028afc451` |
| [journal__nonexportable-owned.json](journal__nonexportable-owned.json) | `13e964ee6d3474bf073c01a58cd7d6b17f451a144338d643b53874c1834bf9b6` |
| [journal__setup-complete.json](journal__setup-complete.json) | `a61f161448b5a5a83592075be1aa7505b420822f789a8cae85a853335a566f29` |

## Follow-up

Preserve the consumed V4 root, Setup, keys, inputs and evidence, together with
V1/V2/V3. Use this exact observation gap to review a targeted initial-status
observation change that pins only an actually RUNNING process and preserves
image/time/PID admission, independent exit proof and all restoration checks.
A later native test needs a separate fresh placement/package/input/review and
owner CONFIRM. No policy/error-classification widening, old-input retry or
worker-ended substitute is authorized by the diagnostic. LIC008/Open003 and
security/production acceptance remain open.
