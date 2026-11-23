# Consumed export-policy attempt — 2026-10-27

[Experiment and source review](../../experiments/LICENSING_EXPORT_POLICY_CONTROL.md#consumed-setup-failure--2026-10-27)
· [Current handoff](../../../project/LICENSING_SESSION_HANDOFF.md)

Attempt `f9ed088cce17426cb48759645d45e2e6` is consumed. Elevated owner CheckOnly
and Prepare passed. Following the owner's live CONFIRM, execution failed at
`run-setup` with `UNKNOWN`. No paired export observations were produced.
Do not rerun, edit/reuse the approval, restart Setup, patch retained binaries
or clean up this attempt. Security and production acceptance remain false.

## Outcome and limits

- The original controller result records `VALIDATION`, managed HRESULT
  `-2146233087` (`0x80131501`), and null Setup/Guardian report digests.
- `guardianBorrowAttempted=false` and `guardianRestored=false`: Guardian was
  never borrowed, so restoration was unnecessary. Three SCM/CIM snapshots
  retain its original executable/account and `Stopped/Manual/PID0` state.
- New LocalSystem Setup remains registered and stopped, PID0, Win32 exit1067.
  No live control process was observed during collection. The new protected
  root, reservation, inputs, binaries and service registration are retained.
- Setup/Guardian reports and eight expected journal/consumption files were
  absent at collection. Source order requires durable consumed and intent
  records before key creation; this is a source-order inference about this
  unchanged journal, not an independent inventory proving absence of CNG keys.
- SCM events7045/7023 corroborate installation and termination. The service
  code also assigns1067 to its generic failure path and discards the original
  exception. Neither SCM1067 nor the controller's generic validation HRESULT
  identifies the original failing check. No specific token/ACL/environment
  cause is established. Comparison and export-denial classification are unchanged.

Next work is a separately reviewed startup-diagnostic design with fixed stage,
category and HRESULT, plus a recovery/isolation plan for any future attempt.
These reports are observations on one development host, not passing acceptance
fixtures, a retry authorization or proof of production readiness.

## Provenance

The files below are exact byte copies; no JSON reserialization or redaction was
performed. Git attributes disable newline conversion for them. They contain
owner SID, local paths, host/boot hashes and service metadata, but no private
key bytes, exported blobs or credentials. The approval is historical and consumed.

Capture directory:
`out/lic008-export-policy-owner-check-903b289e99a54ae39e95afb2427fa569`.
CheckOnly, Prepare, Execute and SCM event files came from its top level.
`collection-index.json` came from its `post-run-collection` subdirectory.
Controller result, plan, reservation and package manifest came from that
collection's `originals` directory. `approval.json` came from
`out/lic008-export-policy-input-f9ed088cce17426cb48759645d45e2e6`.

The reviewed elevated collector read the fixed protected root
`C:\ProgramData\Ecs.Lic008.ExportPolicyControlV1` at09:22:31-35UTC, after execution
ended at09:22:05UTC. It recorded four original JSON hashes/copies, ten absent
expected files, four deployed binary/inventory hashes, twelve read-only SCM
queries and initial/admission/final process/service snapshots. Original/copy
hashes matched. The archive copies were separately rehashed against those captures.
This is local custody evidence, not independent human Security acceptance.

The collector's `nativeExperimentExecuted=false`, `serviceChanged=false` and
other no-mutation flags describe collection only. The preceding Execute did
create retained experiment state and register/start Setup. Metadata fields with
`validated=false` are parsed observations; the collector did not classify success.
No binaries or full console transcript are committed here. The transcript did
not reliably capture native stdout and is not the authority for the outcome.

Retained local collector script SHA256:
`06c3e70bcbb005954efc310daaf9ab0909ea7ce65962aa5d704390fea42e5a17`.
Retained local Execute launcher SHA256:
`2c3db50ee02e4eb9dec7b50182b44ac4e127bfb574318a509a1189955b04b7d8`.

## Exact archived hashes

| File | SHA256 |
| --- | --- |
| [CheckOnly-result.json](CheckOnly-result.json) | `71eb38c0b789e9962575b5a4b3c2e3d6fbf61335eadbe860a047aae94ff62e54` |
| [Prepare-result.json](Prepare-result.json) | `9dd69b4e953484a01a00085e2cc2261eb6e2a58a5ad1ac24f473d6af72f99ca9` |
| [Execute-result.json](Execute-result.json) | `0a9d4733a0e0e8d33a4cb6032f6d6d04eb0b4f6039085ec635a8a3d9640ed33a` |
| [SCM-events.json](SCM-events.json) | `03ff890b71dd046a0924692821667a055fbcd68bc90ff3454d14444c8a68f37f` |
| [collection-index.json](collection-index.json) | `7bc892cf1a77f5e3797f2c49760af20155666cd861a582ee83e6ae1725de63b0` |
| [controller-result.json](controller-result.json) | `18e738920ff0ae70136fd0a2a8f1b1a1d94f274c9f019a4dff1eadcf7f3750a2` |
| [plan.json](plan.json) | `199d1b43dbc2b835974e13230e6ba5f32343a50f85eaaa1dac1b570b4dadeddb` |
| [reservation.json](reservation.json) | `03ff8561ba9b408e29d2c40277ba08943f4e47bcd680e179162d92968db12e17` |
| [package-manifest.json](package-manifest.json) | `97b8caf02391035147418568c017cc49865bf38e342643ad3734e1232d829292` |
| [approval.json](approval.json) | `dea69dc9adf4d6a2ac5f307dcb9d3ed3ad9f5089b2165ab39164e482dbe2f155` |

Keep these bytes unchanged. Any later observation belongs in a separate record.
