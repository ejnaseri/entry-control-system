# Consumed V5 native export-policy comparison - 2026-11-02

[V5 contract](../../plans/LICENSING_EXPORT_POLICY_V5_PLACEMENT.md) / [Construction evidence](../export-policy-control-v5-20261102/README.md) / [LIC008 work ledger](../../plans/LICENSING_LIC008_COMPLETION_PLAN.md)

Code/artifact baseline: `4a58cf9`. Attempt
`4c6e686cdf7e4d989900a8e0d0053a0d` is CONSUMED after fresh elevated
CheckOnly/Prepare, independent exact-input/launcher review and live owner CONFIRM.
Never repeat the attempt, patch retained bits or reuse its approval.

## Actual bounded result

Controller phase `complete`, outcome `CONTROL_INCONCLUSIVE`, no failure.
Setup and Guardian reports were independently admitted; Guardian was borrowed
and restored. Both runs actually observed RUNNING, opened and admitted their
process handle/image/PID/start time, observed wait0/process exit and read the
protected report. This successful new observation does not retroactively prove
why V1/V3/V4 failed or that short-lived RUNNING can always be sampled.

| Role | PID | Process start UTC | Report outcome |
| --- | --- | --- | --- |
| Setup / LocalSystem | 11732 | 10:54:51.2743422 | SETUP_COMPLETE |
| Existing Guardian virtual account | 3496 | 10:55:42.0629562 | CONTROL_INCONCLUSIVE |

Both tokens are primary/elevated, unrestricted and completely queried; Setup
has the exact V5 service SID with attributes14. Guardian has its virtual-account
SID as user/owner and no duplicate matching group, attributes0/count0. Both
workers report ended/no deadline/no failure. Complete protected creation and
reopen journals bind distinct public identities, policies3/0 and one protected
DACL. The controller accepted exact Setup/Guardian report hashes.

| Export format | Exportable positive control | Nonexportable key | Reported comparison |
| --- | --- | --- | --- |
| generic-private | EXPORTED | CRYPTOGRAPHIC, managed HResult -2146893783 | POLICY_DIFFERENTIAL_OBSERVED |
| pkcs8-private | EXPORTED | CRYPTOGRAPHIC, managed HResult -2146893783 | POLICY_DIFFERENTIAL_OBSERVED |
| opaque-transport | CRYPTOGRAPHIC, managed HResult -2146893783 | Same observed error | CONTROL_INCONCLUSIVE |

The managed HResult is `0x80090029`, matching the evaluator's Unsupported
category. It is not an independently captured NCrypt status or identification
of a specific native sub-call. No exported private bytes are recorded. Each
format has its own positive control; GenericPrivate/PKCS8 success cannot supply
the missing opaque positive control. Therefore the three-format aggregate
remains CONTROL_INCONCLUSIVE. There is no restricted normal export return or
recorded BOUNDARY_FAILURE. Do not widen the classifier or turn this result into
an all-formats nonexportability/security guarantee.

## Execution and collection

| Event | UTC on November2 |
| --- | --- |
| CheckOnly | 10:37:18.9064891 to10:37:27.8141299 |
| Prepare | 10:39:05.9183247 to10:39:20.9893110 |
| Input issue / expiry | 10:39:13.6251665 /12:39:13.6251665; now consumed |
| Execute capture | 10:52:09.8252970 to10:56:29.5454586; visible console PID10036 |
| Read-only collection | 10:56:50.3491660 to10:56:56.8779552; collector PID8152 |

The collector captured13 exact JSON originals (9,577 bytes), four deployed
payload hashes/sizes and one absent fixed path, setup-recovery. All three
collection service samples show Setup LocalSystem and original Guardian
Stopped/Manual/PID0 with exits0/0; process samples show no live control process.
All12 read-only SCM queries return0. The collector did not change services,
keys or ACLs or classify success. Its nativeExperimentExecuted=false concerns
collection only; the owner-confirmed experiment did execute.

The collector script SHA256 is
`acf0eb180788f6e06afc17602dd1873f6a016e85436d7fe7f7f751521ef276b0`.
The reviewed Execute launcher SHA256 is
`b31e6e15838740a02fc50f1999d411de1aa29b2de3735fd0cd938e1dbd937c3c`.
Both remain in the original capture directory. This archive copies19 JSON
files byte-for-byte without reserialization or Git newline conversion. The
protected/prepared plan is identical and stored once. Binary files stay under
out/the retained protected root.

Independent post-run review PASS: project_audit rehashed the13 copies and four
deployed payloads; change_review completed146 archive-only binding, token,
process, journal, comparison and custody assertions. No blocker was found.
This scoped automated review is separate from human Security and platform/
product acceptance. Root archive/staged-byte checks preserve the originals.

Capture: `out/lic008-export-policy-v5-owner-check-3d9859780c3a4707a35ed4f42f7d81e7`.

Inputs: `out/lic008-export-policy-v5-input-4c6e686cdf7e4d989900a8e0d0053a0d`.

| Archived record | SHA256 |
| --- | --- |
| [controller-result.json](controller-result.json) | `26e5553e989917eeac64285760ae07e97c5e1d0a704ef0e568e8befed5770053` |
| [reports__setup.json](reports__setup.json) | `69874857fd205e3ed37176e5f127792ce8a0db292d21cdf81c9e16b3ed71ad8a` |
| [reports__guardian.json](reports__guardian.json) | `5b4ce3b02b7519d83f98e05ec8a4e19085de445a9b7084198d7bcf24cacf9492` |
| [plan.json](plan.json) | `e4aea602e211202539eac6b614b5facf8fb3081cd5e6ec249410d7874c71aeb4` |
| [reservation.json](reservation.json) | `2f9b53c0056a8b58e354da49c20f45dd647400f88bc4202fbffd71ab7922bbb8` |
| [package-manifest.json](package-manifest.json) | `f82f9015a154f99e106742c2c773ed5405019cea3bf08cd75293ef395266b078` |
| [journal__setup-consumed.json](journal__setup-consumed.json) | `a06dafed01f19066e7acee222774159f76259ba9f94e3e83fbd2763d7270a21a` |
| [journal__exportable-intent.json](journal__exportable-intent.json) | `ff3d093c4c97bc9d476c70b5f3c991eb337524bf32bf5a5e0e816382ad799a7c` |
| [journal__nonexportable-intent.json](journal__nonexportable-intent.json) | `3ecd885d0acac348184fc070303a2f88c2a66f94aea299a73a4c1c4c2e242978` |
| [journal__exportable-owned.json](journal__exportable-owned.json) | `a2f5544efa62d126a1b1442fce36dc85eaffc394bf997272f4e7c11400168202` |
| [journal__nonexportable-owned.json](journal__nonexportable-owned.json) | `e760634150ff9439ccfcefdfd68827193d0d7ae1e540df2a707876768fafa643` |
| [journal__setup-complete.json](journal__setup-complete.json) | `df01ead14387fd391321b8c9e007aca54a4d8181835d84f093a8d70c71baac89` |
| [reports__guardian-consumed.json](reports__guardian-consumed.json) | `3872b572043d9f295b755999e4410c09af5c072221cfb7888d1feaaaea00d978` |
| [CheckOnly-result.json](CheckOnly-result.json) | `e59d4e0fbd4185a3b82806e9e07a38fceb4672d6418ab6c2fc7ea2946658038c` |
| [Prepare-result.json](Prepare-result.json) | `2ebcc4c1e66fcbe0133d6326ccd1fd391aa07cd7eea5dcf679e2243a8fecae0f` |
| [Execute-result.json](Execute-result.json) | `10c0cc28400fdca83d6c9a05ef979f773280cb862036cba82ba5fd0f64c65059` |
| [approval.json](approval.json) | `96d99d47bcaf48cd40c5058fa76781d8686cb5fa685c05791c3064d076a64d43` |
| [prepared-input.json](prepared-input.json) | `77a4b3a7dd801f83adc314eab5d50015dab3cbe11a054e722f72c609b6e367dc` |
| [collection-index.json](collection-index.json) | `eee1689129d204a36f4877175ada0366b289d5b1d10647935e97b2c62d8158f9` |

## Follow-up and phase effect

Preserve this root, Setup registration, both keys, package, inputs and evidence,
together with all consumed V1-V4 resources. Do not retry merely to replace the
inconclusive opaque control with a preferred result. Record the two observed
format differentials and opaque limitation in the proposed Software-KSP profile;
profile/adapter acceptance remains W07, not this experiment's wire outcome.
Proceed with the separately reviewed genuine-standard-account W03 runner and
fresh W04/W05 cases. At this V5 checkpoint W03 had design only and no account;
the later [account-only helper](../../plans/LICENSING_LIC008_STANDARD_ACCOUNT_PREPARATION.md)
does not supply crypto-runner or standard-user execution evidence.
TPM/NV and independent-machine/Windows evidence remain unavailable here. Full
LIC008/Open003 and security/production/matrix acceptance remain open.
