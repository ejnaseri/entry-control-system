# Consumed V2 export-policy attempt — 2026-10-27

[V2 placement and reviewed artifacts](../../plans/LICENSING_EXPORT_POLICY_V2_PLACEMENT.md)
· [Experiment](../../experiments/LICENSING_EXPORT_POLICY_CONTROL.md)
· [Current handoff](../../../project/LICENSING_SESSION_HANDOFF.md)
· [Retained V1 evidence](../export-policy-control-20261027/README.md)

Source/artifact baseline `a24c718` was already committed and the worktree was
clean before proceeding. Actual elevated V2 CheckOnly and Prepare passed. After
the owner's live console confirmation, attempt
`92d320aeca9d4a469b8e9b5c0b8dadcd` failed at `run-setup` with `UNKNOWN` and is
consumed. No paired export observations were produced. This is a physical
failure with a bounded startup diagnostic, not a passing licensing/security test.

Retain V2 root, Setup registration, installed bytes, inputs, reservation and any
possible keys unchanged. Do not rerun the wrapper, restart Setup, reuse/edit its
approval, patch retained binaries or clean up either V1 or V2.

## Actual sequence and bindings

The normal Windows UAC path launched a fixed CheckOnly capture at
11:08:31–36 UTC. Its inner report is
`TEST_ONLY_EXPORT_POLICY_OWNER_PREFLIGHT_V2 / READY_FOR_INPUT_PREPARATION`.
It binds the exact reviewed candidate, package, owner, host and boot and the
original stopped Guardian. The helper's freshness predicates require V2 Setup
query error1060 and V2 root absence error2; access denial is not accepted as absence.

One separate Prepare invocation ran at11:09:36–46 UTC. Independent byte/hash,
canonical input and effect review verified exactly three new files. Input
issuance was11:09:41.8680408 UTC and expiry13:09:41.8680408 UTC (17:39:41 Kabul).
That historical expiry does not make this consumed approval reusable.

| Binding | Value |
| --- | --- |
| Candidate | `out/lic008-export-policy-v2-capable-27db447d0004467087e3d021e7d4ab84` |
| Candidate manifest SHA256 | `71ed3a49997fd1fdbe2f21163173ba05ce7da6060090c30c0bfe3316da40caa5` |
| Owner kit | `out/lic008-export-policy-v2-owner-kit-c654d14c659a48a8bc8f6abe570dc66c` |
| Kit SHA256 | `991889568c67267caf6de30e54f1311e090d748d0dc2d1f98e3adf53cf111253` |
| Input | `out/lic008-export-policy-v2-input-92d320aeca9d4a469b8e9b5c0b8dadcd` |
| Protected root | `C:\ProgramData\Ecs.Lic008.ExportPolicyControlV2` |
| New Setup | `Ecs.Lic008.ExportPolicyControlV2.Setup` |

The Execute launcher started11:12:15.9404354 UTC in a visible elevated console,
with inherited native stdin/stdout and no supplied confirmation. The owner
reported entering the exact CONFIRM. The wrapper finished at11:14:32.9710622 UTC
with `OWNER_EXECUTION_FAILED_OR_REFUSED_RETAIN_DO_NOT_RETRY`. That outer status
alone is not the outcome authority; the protected controller result below is
the recorded outcome. A transcript was retained locally but does not reliably
capture native stdout and is not the primary evidence.

## Protected result and diagnostic limits

The original controller result is schema2 with scope
`TEST_ONLY_EXPORT_POLICY_CONTROLLER_RESULT_V2`, the exact attempt/plan/approval/
package bindings, phase `run-setup`, outcome `UNKNOWN`, and null Setup/Guardian
report digests. Its failure category is `VALIDATION` and managed HRESULT is
`-2146233087` (`0x80131501`).

Its cached Setup transport and the separately collected SCM status agree:

| Field | Recorded value |
| --- | --- |
| State / PID | STOPPED1 /0 |
| Win32 exit | 1066 |
| Service-specific exit | 3960533761 (`0xEC10F301`) |
| Decoded stage | `IdentityElevation` (15) |
| Category | `VALIDATION` (3) |
| Listed managed HRESULT | `-2146233087` (`0x80131501`, table index1) |
| Transport and decoded evidence authority | `NONE` |

The pinned code locates that stage at
[NativeControlIdentity.Capture](../../../../licensing/adapter-evidence/export-policy-control/NativeControlIdentity.cs),
specifically `Scalar(token, 20)` for TokenElevation. `Info` first probes a required
buffer size, then queries into allocated memory; `Scalar` requires four returned
bytes. The bounded diagnostic does not identify which size/query/length predicate
failed, retain the native last error or report an elevation value. It therefore
does not prove insufficient elevation. No token shape/owner/group validation or
key export result can be inferred from this signal.

Microsoft documents [GetTokenInformation](https://learn.microsoft.com/en-us/windows/win32/api/securitybaseapi/nf-securitybaseapi-gettokeninformation)
as querying the selected token information into a sized buffer, with required
length and a failure error available separately. The
[TOKEN_ELEVATION structure](https://learn.microsoft.com/en-us/windows/win32/api/winnt/ns-winnt-token_elevation)
contains one DWORD. These contracts guide a bounded reader investigation; they
do not identify the failed service call on this host.

The new diagnostics have now been observed through an actual SCM run. This
narrows the V2 failure location; it neither retroactively diagnoses V1's generic
1067 nor supplies independent process-exit proof or restoration authority.

## Separate ordinary-process reproduction

At11:28:52–53 UTC, a new isolated .NET10.0.11 probe queried only its own current
process token using TOKEN_QUERY8. It requested no elevation and did not open
another process/token, register a service, access keys or modify retained files.
The probe pinned the reviewed capable assembly and invoked only its private
`NativeControlIdentity.Scalar` method on that own-process token. It never invoked
the assembly entry point, Capture, Dispatch, admission or lifecycle.

| Own-token observation | TokenType8 | TokenElevation20 |
| --- | --- | --- |
| Null buffer, length0 query | false; lastError122; required4 | false; lastError24; required4 |
| Returned-size four-byte query | true; written4; value1 | true; written4; value0 |
| Direct four-byte query | true; written4; value1 | true; written4; value0 |
| Actual reviewed Scalar method | returns1 | throws VALIDATION / `0x80131501` |

This reproduces a concrete reader/API mismatch in an ordinary-process context:
the initial `Info` predicate demands error122 and rejects the TokenElevation
probe's error24 despite a valid four-byte query. Value0 is a successfully read
non-elevated token value, not a query failure. The LocalSystem service's native
error/length were not captured, so error24 in that service remains an inference
consistent with its stage, not a directly observed fact. The probe explicitly
records `localSystemServiceContextReproduced=false`.

The probe compiled with warnings as errors, ran once with exit0 and empty stderr,
and preserved its source, launcher, tool/reference pins, output and build hashes.
Its local directory is
`out/lic008-export-policy-v2-own-token-probe-0e5725341a464c2f84239d0d30dc9270`.
Archived source/launcher text is provenance for that run, not a new command to
execute against consumed state. The existing application source and all issued
package bytes remain unchanged by this investigation.

## Retained state and collection

`guardianBorrowAttempted=false` and `guardianRestored=false`: Guardian was never
borrowed, so restoration was unnecessary. Initial, copy-admission and final
collector snapshots show its original executable/account and Stopped/Manual/PID0.
V2 Setup remains LocalSystem, Manual, stopped/PID0 with the diagnostic above.
All three process snapshots contain no live `ExportPolicyControl.exe` process.

Both role reports and eight journal/consumption records were absent at collection.
The observed stage and source order place this failure before lifecycle creation,
but absent files are not an independent inventory proving that no CNG keys exist.
No key inventory, key access, retry, service reconfiguration or ACL change was
performed during collection.

The reviewed elevated collector ran at11:15:41–45 UTC after execution ended.
It retained twelve read-only SCM queries, three service/process snapshots,
four exact protected JSON copies and hashes of all four deployed package files.
The package bytes match the reviewed candidate. All original/copy hashes agree;
the collection index records ten missing expected files and no collection failure.
Its `nativeExperimentExecuted=false` and no-mutation flags describe collection
only: the preceding Execute did create retained state and register/start Setup.
Metadata with `validated=false` remains advisory; no success was classified.

## Byte custody

The archive is copied without JSON reserialization or redaction. Git attributes
disable newline conversion and whitespace checking for archived JSON/text. They contain
local paths, owner SID, host/boot hashes and service metadata, with no private
key bytes, export blobs or credentials. The approval is historical and consumed.

Capture directory:
`out/lic008-export-policy-v2-owner-check-df717c8750e64931b95a2cfd79dbf4ad`.
The three stage captures came from its top level; the index came from
`post-run-collection`; controller/plan/reservation/package came from that
collection's `originals`. Approval and prepared-input came from the input
directory above. No binaries or console transcript are committed here.
The five own-token probe artifacts are byte copies of `probe-stdout.json`,
`manifest.json`, `input-pins.json`, `OwnTokenProbe.cs` and `Run-Probe.ps1` from
the separate probe directory. Their archive names below distinguish this
ordinary-process reproduction from the service evidence.

| File | SHA256 |
| --- | --- |
| [CheckOnly-result.json](CheckOnly-result.json) | `25aa979efa650ac6205e91d94449a87f211888631cf32171eb861058de8659b8` |
| [Prepare-result.json](Prepare-result.json) | `454704acbf93d80478cc4691117c2452d04642bfc973a86a365f0cc580163e7a` |
| [Execute-result.json](Execute-result.json) | `b8a34aa140fc18d398e67358b3a67615ee8954694561de66b1f97ea3455fe282` |
| [collection-index.json](collection-index.json) | `c84e4d188658ad881e46f3d104c2e62e3dd7d6b2c55074aabe0c95c5437e374c` |
| [controller-result.json](controller-result.json) | `20c93976bee198773495360756562f57e9ef489cc773407ff4a5a8eaa6676949` |
| [plan.json](plan.json) | `a75c38c54174dfc7d4819ab0a8259f5163e883f95c1a19c1d74b6ae86b272c72` |
| [reservation.json](reservation.json) | `e6e270efc194af9636de16ee4a70c3d0e859287b4dfa22a6c1524ae772b7f0fe` |
| [package-manifest.json](package-manifest.json) | `41c401552af22ce8459b56f7d03dba26f0fdaab166ef17d2614390eead0d86a7` |
| [approval.json](approval.json) | `2b1d34622b5a3a85da2e89780d2ab2837ea221cf9264093b713e307c3348988f` |
| [prepared-input.json](prepared-input.json) | `9a6c57b5daa174cfdbe36b2c9cdbdbc16f4d4cf005e97781748781b224add606` |
| [own-token-probe.json](own-token-probe.json) | `cf129b7ef1e95f83fc372526dcf65b75386dae9dddbd3ea44e7caff03dace628` |
| [own-token-probe-build.json](own-token-probe-build.json) | `17d83b93a132b7a87d7c25eb3dd2a57a9dd82f90f07000d95aab67e06c62fd09` |
| [own-token-probe-pins.json](own-token-probe-pins.json) | `68beb18c5f16f8728912d1b56bfb339c96b2e329df85b6f57039d1747e225624` |
| [own-token-probe-source.txt](own-token-probe-source.txt) | `d44fa8f06cbf57cb598f37fe5a2cc5503bed164c24b6ebdfea8c6dc44a5bfb70` |
| [own-token-probe-launcher.txt](own-token-probe-launcher.txt) | `bf3486f4206d132ae51e644895c8d0b91322760e572799436eeaf9f2fc63d6f4` |

Retained launcher/collector source hashes:

- CheckOnly: `f59b0a76f85eaf66eb685399345332e2d9386e8c4eeb30a450d8b74e84b65164`.
- Prepare: `17fbefe361641c590f6557bd5d5714b4d45c24a703082c7ea32dd9610a36e421`.
- Execute: `51f7c958574b499f1b39b75c53cfdcb06cb3200161edef747a2a544bb4a6b53f`.
- Collector: `12d2a9476846620c3629062be82d4374b8e49f641b236af0ee86d69228e20c06`.

Final verification matched all15 archived files to their originals and all31
issued source pins to the unchanged working sources. The10 earlier V1 archive
hashes remain unchanged. Independent source/artifact review found no evidence
consistency blocker; documentation resolver self-tests and780 local links across
112 Markdown files passed. No application-code test rerun or source fix is claimed
by this evidence checkpoint.

Next is a narrowly scoped fixed-size scalar-reader correction: query the known
four-byte TokenType/TokenElevation values directly, keep exact returned-length
and value validation, and retain the variable-size reader's strict bounds.
Add failed/short/oversized/malformed-return regressions and an ordinary-token
regression against the corrected method before new inert/capable artifact review.
Do not replace failure with a default elevation value or broadly accept unknown
size-query errors. A future
physical attempt needs a separate fresh-placement contract and fresh owner inputs;
neither consumed namespace is reusable. LIC008/Phase6.2, paired-export evidence,
native-entry, Security and production acceptance remain open. No export-denial
classifier change is justified by this startup failure.
