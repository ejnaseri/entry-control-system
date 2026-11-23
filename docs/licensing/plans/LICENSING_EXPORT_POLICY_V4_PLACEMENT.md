# Export-policy V4 placement and diagnostic experiment

Date: 2026-10-28. Source baseline: `38c98c8`.
Status: `V4_CONSUMED_SETUP_COMPLETE_PROCESS_NOT_OBSERVED`.

[LIC008 completion work](LICENSING_LIC008_COMPLETION_PLAN.md)
· [Controller diagnostics](LICENSING_EXPORT_POLICY_CONTROLLER_DIAGNOSTICS.md)
· [Consumed V3](../evidence/export-policy-control-v3-run-20261028/README.md)
· [Historical V3 contract](LICENSING_EXPORT_POLICY_V3_PLACEMENT.md)

The owner requests execution of all remaining LIC008 work. This successor makes
the already implemented schema3 controller diagnostics available in a fresh
test-only placement. It preserves consumed V1/V2/V3 resources and evidence.
The V3 failure's exact predicate remains unknown. No historical attempt is retried.

Actual owner-confirmed V4 run: [protected evidence and localized refusal](../evidence/export-policy-control-v4-run-20261028/README.md).
Setup again records completion, but the controller's new diagnostic pinpoints
`SetupRun / StoppedProcess`: first START_PENDING/PID10372, then STOPPED/PID0,
without RUNNING/handle/process-exit proof; report read was NOT_ATTEMPTED.
Guardian was never borrowed. V4 is now consumed; the preparation results below
are historical and must not be used to retry its inputs or placement.

## Concrete resource contract

| Binding | Exact V4 value |
| --- | --- |
| Placement | `Ecs.Lic008.ExportPolicyControlV4` |
| Protected root | `C:\ProgramData\Ecs.Lic008.ExportPolicyControlV4` |
| New Setup service | `Ecs.Lic008.ExportPolicyControlV4.Setup` |
| Setup account and token user/owner | LocalSystem / `S-1-5-18` |
| Setup service SID | `S-1-5-80-223512861-2069854949-399502294-4005083310-3557816799` |
| New key prefix | `Ecs.Lic008.ExportPolicyControlV4.TEST_ONLY.` |
| Existing Guardian service | `Ecs.Lic008.EntryEvidenceV2.Guardian` |
| Guardian account | `NT SERVICE\Ecs.Lic008.EntryEvidenceV2.Guardian` |
| Guardian SID | `S-1-5-80-1925419286-2081043195-3517708708-3498839447-1988319315` |
| Artifact and input prefix | `lic008-export-policy-v4-` |
| Sole physical capability define | `TEST_CAPABLE_EXPORT_POLICY_CONTROLLER_V4` |

SHA-1 of the uppercase Setup service name encoded as UTF-16LE, read as five
little-endian uint32 words, produces the SID above. Read-only `sc.exe showsid`
agrees. Neither observation registers the service or proves actual token membership.

Keys remain distinct, fresh machine RSA3072 keys in Microsoft Software Key Storage
Provider, decryption usage1, export policies3/0 and attempt-specific suffixes
`.exportable` / `.nonexportable`. The exact key DACL remains SYSTEM plus the
existing Guardian. No administrator or Setup-SID key ACE is added. Setup creates
and independently reopens each key; Guardian runs the matched three-format export
comparison. Positive control must precede each nonexportable-arm observation.

The Guardian's original binary remains:

```text
"C:\ProgramData\Ecs.Lic008.EntryEvidenceV2\bin\EntryControl.AdapterPilot.exe" --service Guardian
```

Only its binary command may be borrowed after valid Setup report admission and
independent Setup process completion. Restoration still requires independent
Guardian process completion and the exact stopped borrowed configuration.
No timeout, diagnostic flag, stopped/PID0 observation or worker-ended report
substitutes for that proof. Retention follows any unresolved state.

## Binding and execution boundaries

Every placement-bound plan/reservation/journal scope becomes
`TEST_ONLY_EXPORT_POLICY_CONTROL_V4`; approval, package, native evidence,
inert/capable build and package-build, package verification, owner-kit/build,
prepared input and preflight use their corresponding `_V4` scope. Record shapes
retain schema1. The controller diagnostic result intentionally remains schema3 /
`TEST_ONLY_EXPORT_POLICY_CONTROLLER_RESULT_V3`: report version and placement
version are separate. Stable pure/token/wrapper/failure report formats keep V1.

Builders, helper, wrapper, package, source snapshots and input directory must all
agree on the new binding. V1/V2/V3 capabilities cannot activate V4. Regression
fixtures reject old paths, key names, Setup SIDs, plans/reservations, effects,
approvals, packages, native/predecessor reports and journals, including mixed
versions with every dependent digest correctly recomputed.

All other guards and operation ordering remain as reviewed at `38c98c8`:
immutable input/package/runtime custody, exact .NET10.0.11, admission, owner token,
expiry/boot binding, single-use consumption, file whitelist, closed ACLs, bounded
worker, 25 ms polling / 45 s external deadline, process proof, diagnostic sanitizer,
protected result publication and denial classification. There is no seal, purge,
retained-key mutation, automatic retry, forced kill or service rollback.

## Verification and owner execution sequence

1. Implement the complete V4 binding and cross-version negatives. Build inert;
   verify source/snapshot/tool/reference/runtime/package pins and closed entries.
2. Review the concrete scope and exact inert artifact. Build the separate capable
   artifact bound to that inert manifest; verify pure/malformed-route results.
3. Build and verify a new owner kit, pure helper/wrapper/validator tests and
   read-only own-token checks. Review the exact artifact packet separately before
   physical execution; author checks are not an independent Security attestation.
4. Elevated owner CheckOnly must observe fresh V4 root/Setup, original stopped
   Guardian, current host/boot/runtime/custody. Prepare then issues fresh bounded
   inputs, whose exact effects, bindings, hashes and expiry are reviewed separately.
5. Execute in a visible elevated owner console with its native live full `CONFIRM`
   line. Confirmation is entered only by the owner. Record the schema3 controller
   stage and run trace, original protected reports/journals and hashes after exit.
6. Classify actual results. If unresolved, retain the attempt and use the diagnostic
   evidence to choose a targeted correction and separately fresh later scope.

This experiment cannot close TPM/NV, standard-user, interruption, cross-Windows,
production Installer/Store, full LIC008 or security/release acceptance by itself.
The [completion plan](LICENSING_LIC008_COMPLETION_PLAN.md) retains those obligations.

## Actual results at preparation

The new inert artifact passes **18,236** assertions per variant/apphost, including
**484** placement checks and **275** native-key checks. The **160** additions are
old-V3 and mixed-version refusal cases. Default and V1/V2/V3-defined builds remain
inert; **14** closed-entry refusals pass per variant/apphost. Wrapper pure tests
pass **305** cases. These executions do not start any service or create any key.

Inert directory:
`out/lic008-export-policy-v4-inert-be18b45065a74ad58012297cd76f141a`.
Package manifest SHA256:
`e5e8a66d7ad9456956e15baad41440d112c13f179056729be05e6e9aa909d941`.

Capable and owner-kit construction and independent source/artifact review now
PASS. Helper pure tests pass **502**, wrapper **305**, validator **295** and the
ordinary own-token regression **9** cases; **8** malformed helper entries refuse.
Both control builds pass the same 18,236 assertions; malformed capable entries
refuse in **13** cases. Reviews verify 26 control source/snapshot inputs and 32
kit inputs, four tools plus kit PowerShell, 167 references, 190 runtime files
and exact package/kit payloads. Build physical-tested/acceptance flags stay false.

| Artifact | Directory under `out/` | Manifest SHA256 |
| --- | --- | --- |
| Inert | `lic008-export-policy-v4-inert-be18b45065a74ad58012297cd76f141a` | `d98f41c276141343d5f8b9187c9a80a15e2cd10e60667c01c7d5ef69b7d1341f` |
| Capable | `lic008-export-policy-v4-capable-d24712f957da462097daa3b691a2a190` | `955ea878608ed55d504054dd9945db74424b1a2cce0d47a08125fe6d84bebd83` |
| Owner kit | `lic008-export-policy-v4-owner-kit-9bb63977804548388f4624271b855a23` | `3e245b1dec46baaf9e30f717f1c0934f1df71b2ce3ec210f110bcdb3bdf75ac8` |

Capable package SHA256:
`fca1d27771cd04c2b1bb3131654f109e3e85efc839903d36271e821b52eafbfb`.
The [22-file exact-byte archive](../evidence/export-policy-control-v4-20261028/README.md)
records construction, tests, scoped independent review and ordinary inventory.
Elevated CheckOnly (13:17:47–55UTC) and Prepare (13:19:44–59UTC) PASS.
Fresh attempt `95dcc9bb897c4fcb869f7af8a6c7f8bd` is issued at
13:19:52.3030835UTC and expires 15:19:52.3030835UTC (19:49:52 Kabul).
Plan SHA256: `58152e2eb15432917c0e23db28f0a5010912b8d0adfe3eae92cf7b136ff1c5b3`.
Approval SHA256: `f8bb6c8d81b30a43732ac0b7fe6b46afc078de1ea4b30a709b5ff611aa0bf8a5`.
The capture is `out/lic008-export-policy-v4-owner-check-c08ad30799bf4d6494d4ba9ceb92cd74`.
Independent exact-input review at 13:22:35UTC PASS: all three files, canonical
pins, scopes/effects, host/boot/owner/Guardian bindings, printed descriptor and
32 unchanged kit inputs match. Prepared descriptor SHA256:
`054b8388b459606046c8443dfdcfe804a07912b2d0d9b16958ae619cef004c71`.
Prepare capture SHA256:
`a132e9ff81b6305bfdd0bb923354e29bde3b2ee63678ea62cd8404c130a462d7`.
Execute must perform its fresh preflight and require live owner CONFIRM;
physical observation remains NOT_RUN at this preparation checkpoint.
