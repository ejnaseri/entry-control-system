# Export-policy startup diagnosis and isolated continuation plan

Date: 2026-10-27. Baseline: committed `53367ec`.
Historical checkpoint: `SOURCE_DIAGNOSTICS_INERT_VERIFIED_PHYSICAL_PLACEMENT_PENDING`.
The subsequent [V2 placement and artifact checkpoint](LICENSING_EXPORT_POLICY_V2_PLACEMENT.md)
implements the successor contract and verifies its separate inert/capable/owner-kit
chain. The results below retain the original diagnostic checkpoint's exact pins.
The later [V2 physical result](../evidence/export-policy-control-v2-20261027/README.md)
now records an actual SCM IdentityElevation diagnostic and a consumed failed
attempt; this does not retroactively establish V1's original cause.

[Consumed attempt evidence](../evidence/export-policy-control-20261027/README.md)
· [Experiment](../experiments/LICENSING_EXPORT_POLICY_CONTROL.md)
· [Current handoff](../../project/LICENSING_SESSION_HANDOFF.md)

The work at this checkpoint was bounded startup instrumentation, pure regression
tests and a separate inert build.
The owner asked to continue after the consumed attempt was committed. This plan
does not issue a new approval, authorize reuse of that attempt or claim a cause
has been found. A diagnostic result and a successful export-policy comparison
are separate outcomes; neither alone closes LIC008 or production acceptance.

## Evidence to preserve

Attempt `f9ed088cce17426cb48759645d45e2e6` consumed the fixed
`C:\ProgramData\Ecs.Lic008.ExportPolicyControlV1` namespace. Elevated CheckOnly
and Prepare passed; after live owner confirmation, execution stopped at
`run-setup` with `UNKNOWN`. Controller failure `VALIDATION/0x80131501` and SCM
exit1067 do not identify the original exception. The retained service from
baseline `53367ec` assigns1067 in its generic failure path; this is not proof
of an operating-system crash. The new source instrumentation below is separate.

The retained Setup is LocalSystem, Stopped/Manual/PID0. Guardian was never
borrowed and remains at its original path/account, Stopped/Manual/PID0. Its
`guardianRestored=false` flag does not represent a restoration failure.
The collection found no role report or journal/consumption marker. Source order
requires consumed and intent records before key creation, so the unchanged
journal suggests startup/admission or the first write failed. This is an
inference, not a physical inventory proving that no CNG key exists.

Retain unchanged:

- The V1 root, Setup registration, deployed package, reservation and inputs.
- Capable candidate `a3bd7cfbf58543678366d113cd32da0b`, owner kit
  `d3b686b0ca964df8b7a9f77fb289cefc`, and consumed input `f9ed088cce17426cb48759645d45e2e6`.
- The exact archived reports, hashes, SCM observations and original failed evidence.
- Older consumed pilot/diagnostic namespaces and their keys, ACLs and binaries.

Do not restart Setup, rerun Prepare/Execute, reuse or extend the old approval,
delete collision markers, change retained ACLs, query/export/delete retained
keys, or replace/rebuild/patch installed V1 bits. Source edits and a separately
named future artifact do not retroactively change this evidence.

## Why baseline reporting missed the failure

At baseline `53367ec`, the service could fail before reaching the worker
report-producing catch. The following table describes that consumed implementation,
not the newly instrumented source:

| Boundary | Baseline observation limit |
| --- | --- |
| Entry grammar and SCM dispatcher | A process/dispatcher failure may produce no registered service status or protected report. |
| Control-handler registration and SCM arguments | Registration occurs before the callback's main try; failed registration returns without a useful recorded category. |
| RUNNING status and initial token capture | Failure is reduced to generic1067 by the service catch. |
| Service admission | Token capture, plan/reservation reads, session validity, host/boot/environment and package/runtime checks precede the worker catch. |
| First durable consumed write | A failed write can leave no marker; failure of its own reporting path must remain distinguishable from an unstarted worker. |
| Worker, report and final status | A second failure while publishing evidence or reporting stopped status must not replace the original cause or imply a clean completion. |

Source boundaries (these working-tree paths now contain the new instrumentation):
[service dispatcher](../../../licensing/adapter-evidence/export-policy-control/NativeControlService.cs),
[service admission](../../../licensing/adapter-evidence/export-policy-control/NativeControlAdmission.cs),
[worker/report](../../../licensing/adapter-evidence/export-policy-control/NativeControlRuntime.cs),
[journal order](../../../licensing/adapter-evidence/export-policy-control/ControlLifecycle.cs),
and [external observer](../../../licensing/adapter-evidence/export-policy-control/ControlWindowsDeployment.cs).

Missing output is unresolved evidence. No token, ACL, environment, runtime or
provider defect is established by the consumed reports.

## Current source-only deliverable

The current source candidate introduces
[ControlStartupDiagnostics and ControlStartupTrace](../../../licensing/adapter-evidence/export-policy-control/ControlStartupDiagnostics.cs)
for a closed, test-only failure vocabulary. Instrumentation records a fixed
stage, fixed category and an exact listed managed HRESULT, or explicitly omits
an unlisted HRESULT. It stores no exception object or full error. The original
exception continues through the existing failure path unchanged. A managed
HRESULT must not be relabelled as the original native API return value.

The selected transport is SCM status: `Win32Exit=1066`
(`ERROR_SERVICE_SPECIFIC_ERROR`) plus one versioned32-bit service-specific code.
The [Windows SERVICE_STATUS contract](https://learn.microsoft.com/en-us/windows/win32/api/winsvc/ns-winsvc-service_status)
interprets the service-specific field only with that Win32 status.
[SetServiceStatus guidance](https://learn.microsoft.com/en-us/windows/win32/api/winsvc/nf-winsvc-setservicestatus)
requires completing work before the single STOPPED notification; this design
retains the existing worker join and never retries that notification.
There are no early diagnostic file writes or separate callable diagnostic-only
native route. Requirements for the implementation and its review:

- Stage and category values are closed constants. No exception message, stack,
  data dictionary, arbitrary path, account text, private blob, serialized key or
  secret-derived digest enters the diagnostic record.
- An explicit per-dispatch trace follows the actual failing boundary across both
  `Task.Run` transitions; it is not `ThreadStatic`. Tests must cover asynchronous
  failure and verify that a second failing boundary preserves the first failure.
- Recording is observational. It cannot enable a closed entry, relax owner or
  service identity, accept a different runtime/package, widen export-denial
  classification, retry work, bypass expiry or start a later operation.
- A failed sink/status write cannot trigger another sink indefinitely, hide the
  first failure, start cleanup or fabricate successful report delivery.
- Existing worker deadline, independent process observation and stopped-state
  requirements remain. Diagnostic output never proves a worker has ended.
- CLI arguments, environment variables and untrusted files cannot choose an
  output path, namespace, service, category, admission bypass or capability.

The controller source now emits schema2 with scope
`TEST_ONLY_EXPORT_POLICY_CONTROLLER_RESULT_V2`, adding separate Setup and
Guardian transport observations. The Windows backend caches at most the latest
immutable raw status for each role in memory: state, PID, Win32 exit and
service-specific exit. These values come from the already admitted Run; the
diagnostic getter issues no new Windows query, guarded operation or file write
after a failure. A missing cache or failed diagnostic read leaves the observation
unavailable without replacing the original execution failure.

The controller decodes a cached status only for STOPPED/state1 with PID0; other
valid service states may retain raw numeric observations but no decoded startup
diagnostic. Both transport and decoded records declare `evidenceAuthority=NONE`.
The cache supplies no pinned process handle, independent completion evidence or
restoration permission. Original worker/report/process requirements still decide
execution; retained schema1 reports and their bytes remain unchanged.

Source implementation and inert validation are complete as recorded below.
They are not executed Windows service evidence; the earlier physical failure
cannot acquire new diagnostic details retroactively.

## Selected SCM channel and its limits

The source codec uses:

```text
serviceSpecificExit = 0xEC100000 | (stage << 12) | (category << 8) | hresultIndex
prefixMask = 0xFFF00000
stage = 8 bits; category = 4 bits; hresultIndex = 8 bits
```

It decodes only when Win32 exit is1066 and the top12 bits match the exact
versioned prefix. Stage IDs1..44 follow the explicitly reviewed enum declaration,
from `ServiceArguments` through `GuardianConsumedWrite`; zero and undefined IDs
are rejected. Additions need a codec/vector review, never reuse or insertion
that changes existing IDs. The linked source is the full stage-name mapping.

| Category index | Fixed value |
| --- | --- |
| 1 | WRAPPED_EXCEPTION |
| 2 | CRYPTOGRAPHIC |
| 3 | VALIDATION |
| 4 | ACCESS |
| 5 | IO |
| 6 | SECURITY |
| 7 | OTHER |

Any non-null `InnerException` selects WRAPPED_EXCEPTION, while the indexed
HRESULT belongs to the caught exception itself. The codec does not unwrap it
or claim to reveal the inner/root cause.

| HRESULT index | Exact decoded value |
| --- | --- |
| 0 | null; `hResultListed=false` |
| 1 | 0x80131501 |
| 2 | 0x8013150A |
| 3 | 0x80070005 |
| 4 | 0x80131620 |
| 5 | 0x80131509 |
| 6 | 0x80070057 |
| 7 | 0x80070002 |
| 8 | 0x80070003 |
| 9 | 0x80131500 |
| 10 | 0x80131505 |
| 11 | 0x80131515 |
| 12 | 0x80131622 |

Decoded values are signed32-bit managed HRESULTs; the hexadecimal display here
preserves their exact bits. The decoded record declares `evidenceAuthority=NONE`.
The implemented controller schema2 retains raw transport values separately and
applies the STOPPED/PID0 decoding rule above. Its pure producer/consumer tests
pass in the recorded inert checkpoint; actual SCM delivery remains untested.

- A listed HRESULT decodes to that exact numeric value. An unlisted value decodes
  to null with an explicit unlisted flag; no truncation, guessed reconstruction
  or conversion of the index into a native error is permitted.
- Unknown versions, stages, categories, reserved bits, invalid table indexes or
  inconsistent Win32/service-specific combinations are not valid diagnostic
  evidence. Keep raw numeric transport observations separate from decoded data.
- This avoids the circular requirement to write through the protected store
  whose identity/ACL/admission might itself be failing. It adds no alternative
  file writer and relaxes no existing protected-store check.
- Before a handler exists, a service cannot publish through this channel. Runtime
  loading/process failure, dispatcher failure, handler-registration failure or a
  failing `SetServiceStatus` may still leave no diagnostic code. Absence remains
  unknown; it must not be synthesized as a particular stage/category/HRESULT.
- Keep only the first encoded failure in the explicit trace; rethrow the original
  exception without storing it. Join the real worker before final stopped status.
  Failure of final status delivery does not permit skipping the join or claiming
  that the code reached SCM.
- A decoded code is non-authoritative diagnostic metadata. It is never independent
  process-exit proof, restoration permission, a successful worker report, an
  ownership record, a positive comparison or Security/production acceptance.
- Any future observation must be correlated with the reviewed package, fixed
  service, attempt, host/boot and independent process evidence. An unbound code
  can inform a hypothesis, but cannot authorize a later operation.
- Version the producer/consumer interpretation and test malformed combinations.
  Keep existing records and retained-package semantics unchanged; a new decoder
  does not reveal the exception discarded by the consumed V1 binary.

No new Windows Event Log source, persistent logging service, ACL grant or
alternate elevated helper is implied by this plan. Such an effect would need to
be part of the concrete reviewed package/effects before physical use.

## Isolation and recovery decision

V1 is not fresh again. A new attempt ID or output directory does not change the
fixed protected root, Setup registration or key prefix. These bindings occur in
`ControlRules`, `ProtectedControlStore`, `NativeKeys`, registered service-SID
derivation, package admission, controller/helper wrappers and their tests.
A successor must update the complete binding chain, not just substitute a path
or accept an arbitrary namespace argument.

A possible future matched-control placement is the fixed successor namespace
`Ecs.Lic008.ExportPolicyControlV2`, with its own root, LocalSystem Setup and key
prefix adopted together. This is a proposal only: this turn does not implement
that namespace, publish a capable successor, issue approval or run it. Its new
Setup service SID must be derived and tested explicitly; do not silently claim
exact retained-Setup identity equivalence. No separate diagnostic-only physical
route is introduced by the source instrumentation.

Before selecting that continuation, review the new resource/ACL/name contract,
complete expected effects and evidence correlation. The future matched
comparison still requires new policy0/policy3 persisted keys, Setup-to-Guardian
parity and a positive control for every format. A source/inert diagnostic result
is not permission to create those keys or borrow Guardian again.

Recovery of retained V1 is a separate future decision. It requires reconciling
actual ownership and retained state before any deletion or change; filename,
prefix, absent journal or expired approval cannot establish ownership or grant
cleanup. This work authorizes no recovery action on the machine.

## Verification and execution sequence

1. Complete the source-only diagnostic model/instrumentation and focused pure
   tests: each stage/category, unknown values, numeric bounds, first-failure
   preservation, async propagation, failing sink/status callbacks and privacy
   canaries. Recheck existing capability/CLI refusal and controller regressions.
2. Review the resulting exact source, SCM codec/vectors, coverage limits and
   proposed successor placement. Keep original package bytes and the
   runtime denial gate unchanged. Record unresolved findings explicitly.
3. Build a separate inert candidate with complete source/tool/runtime/artifact
   custody. Review its actual output and fake-operation failures. A test-capable
   successor requires its own explicit gate and exact effects; old capability
   or owner approval is not inherited.
4. Once that physical package is reviewed, perform its read-only elevated
   preflight and review the actual output. Confirm fresh placement, stopped
   relevant services, no live diagnostic process, exact runtime/host/boot and
   retained V1 custody. A successful pure suite is not this preflight.
5. When the owner is ready, prepare new bounded inputs, review their exact hashes
   and effects, then require local live confirmation in a visible elevated
   console for one admitted run. Do not auto-type confirmation or reuse an old
   approval. Keep native stdin/stdout unredirected; transcription is secondary.
6. After confirmed termination, separately collect the fixed originals and
   hashes and read-only service/process observations. On timeout, missing signal,
   failed publication or uncertain process state, retain state and review; no
   automatic retry, kill, cleanup or late-success conversion.
7. Decide what the new evidence actually establishes. A specific diagnosis may
   justify a separately bounded source correction and new artifact review.
   Complete the matched export-policy experiment only under its own reviewed
   successor plan. LIC008, native-entry, Security and production gates remain open.

## Completed source and inert verification

The source instrumentation, controller schema2 and focused regressions are
implemented. Both default and legacy-defines-still-inert variants compile with
warnings as errors against pinned .NET10.0.11 and pass the same17,362 assertions.
The packaged apphost passes that suite too. These are repeated executions of
the same cases, not52,086 independent cases or physical service evidence.
Each variant and the apphost refuse all14 non-self-test entry shapes.

| Component | Assertions |
| --- | ---: |
| Comparison | 7,543 |
| Keys | 245 |
| Store | 1,193 |
| Identity | 368 |
| Service arguments | 18 |
| Worker deadline | 42 |
| Lifecycle | 326 |
| Admission | 125 |
| Controller | 1,265 |
| Startup diagnostics | 6,237 |

The diagnostic suite checks the stable wire mapping, every payload combination
in256 partitions, every12-bit prefix and all16-bit Win32 statuses, private-data
canaries, nested/Task/racing first-failure capture, actual pure token validation
and service join/status sequencing. Lifecycle tests prove failed consumption
writes do not reach fake key operations and failed recovery cannot replace the
original failure. Controller tests retain missing-report/PID diagnostics without
allowing borrowing, restoration or success from those diagnostics.

Bounded source review identified and corrected two first-failure ordering gaps:
record the original Setup exception before recovery verification, and trace the
inner worker callback before timeout handling can discard its exception. This
is AI/source review, not independent human Security acceptance. During test
development, the expected HRESULT for the wrapped CryptographicException fixture
was corrected to the actual pinned-runtime value0x80131501; no acceptance guard
was changed. Failed intermediate build outputs are not candidates.

Candidate: `out/lic008-export-policy-inert-2ccca41bbcf248198d075c6d19e0e585`.
All24 source inputs were rehashed after the successful build. The builder pins
the source snapshots,4 tools,167 references and190 runtime/fxr files and verifies
the canonical package. The owner-kit builder's expected control count now matches
17,362; its295 pure validator checks also pass. No new owner kit or capable
package was built, and no inputs were issued. Earlier issued artifacts remain
historical and cannot be treated as this changed source.

| Artifact | SHA256 |
| --- | --- |
| Inert manifest | `603b43d1618e10130c44d8fdf1a6270849e731a40e4762a5181964045d3f218b` |
| Package manifest | `ed129ebf1254c5c4fbc1d5f06985c7448db9693aafa306755ba064dda867f5f1` |
| Package build report | `298d62b4125bbd1f5ec3a4b8175f3e8e8b8cd340f6767828da0e9165e7797022` |
| Default/package DLL | `87851f0cdc607a2f3b20d997bb4b8af0917b3603377c3c3d15e580d3230add5c` |
| Legacy-defines-still-inert DLL | `03c9324bcf4f3e085266e12a7b4d32a2da4c113d3a8fdfc09e62b9980ff90012` |
| Apphost pure report | `4d29d43c4702ac31ffb19c131eae745ef83dfea7801027ea0041af3a57675f4a` |

That checkpoint's next source/artifact step is now completed in the
[V2 placement review](LICENSING_EXPORT_POLICY_V2_PLACEMENT.md): fixed resources,
names, ACL/effects and separate inert/capable/owner-kit artifacts. Its subsequent
elevated preflight, input issuance and physical run are recorded in V2 evidence
above. At this earlier checkpoint the diagnostic code had not yet been observed
through an actual Windows SCM run;
the root cause of the consumed V1 failure remains unknown. None of these changes
authorizes restarting V1 or broadening the original export-denial classifier.

Only source changes, synthetic checks and the separate inert artifact were in
this diagnostic checkpoint's implementation scope. Successor implementation and
artifact results belong to the linked V2 record. Neither checkpoint supplies a
current physical command, new approval window or accepted diagnostic result.
