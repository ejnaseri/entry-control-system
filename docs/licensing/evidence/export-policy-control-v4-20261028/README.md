# V4 source and artifact evidence ? 2026-10-28

[V4 contract](../../plans/LICENSING_EXPORT_POLICY_V4_PLACEMENT.md) ? [LIC008 work ledger](../../plans/LICENSING_LIC008_COMPLETION_PLAN.md) ? [Consumed V3](../export-policy-control-v3-run-20261028/README.md)

These 22 JSON files preserve exact original bytes from fresh V4 inert/capable
builds, owner-kit tests and a separate current-host read-only inventory. No JSON
was reserialized. Git attributes disable newline conversion for these files.
Binaries and source snapshots remain under unique ignored `out` directories.

## Verified build checkpoint

Source baseline is `38c98c8`. The change selects a fresh V4 root, Setup service,
derived Setup SID, test-key prefix, placement scopes, capability and artifact/input
names. Schema3 / RESULT_V3 diagnostics remain the report format. Guardian identity,
ACLs, admission, process-completion/restoration proof, bounded timings and denial
classification remain intact. Consumed V1/V2/V3 resources are not selected.

| Check | Actual result |
| --- | --- |
| Every control variant and packaged apphost | 18,236 assertions PASS |
| Placement component | 484 cases within the total |
| Native-key component | 275 cases within the total |
| New prior-V3/mixed-version refusal coverage | 160 added control assertions |
| Default and legacy-defined entry refusals | 14 per variant/apphost |
| V4 capable malformed entry refusals | 13 per variant/apphost |
| Owner helper | 502 pure assertions; 8 malformed entries refused |
| Owner wrapper | 305 pure assertions |
| Owner-kit validators | 295 pure assertions |
| Helper own-process token regression | 9 checks; ordinary token/elevation0 |
| Independent source review | PASS, change_review |
| Independent inert/capable and owner-kit artifact review | PASS, project_audit |

The control total is the same assertion suite run in several builds, not a sum
of independent physical tests. Only V4 enables capable dispatch; the V1/V2/V3
defines remain inert. Builders invoke pure tests and malformed routes only.
All build physicalTested/security/production acceptance flags remain false.
The owner helper has no physical capability. Its token regression queries only
its own current-process token and is not elevated owner preflight.

Independent artifact review checked 26 live inputs/snapshots for each control
build, four tools, 167 references, 190 runtime files and four package files,
including the exact capable-to-inert binding. Kit review checked 32 live inputs/
snapshots, four tools plus PowerShell, the same reference/runtime chain, three
kit payloads and the test-report pins. All 104 previously tracked evidence files
matched `38c98c8` byte-for-byte at preparation. These are scoped automated reviews;
no human Security acceptance or platform matrix closure is claimed.

## Read-only current-host inventory

The unmodified legacy preflight collector was copied into a fresh `out` folder.
It observed Windows11 Pro 10.0.22000 x64, a 64-bit process and NTFS under an
unelevated token. Its TPM CIM query returned UNKNOWN/CimException. That is not
physical absence or a failed TPM feasibility result. No provider/key/SCM mutation
was made. The legacy platformCandidate field is advisory and does not implement
all current support-matrix criteria or customer Installer admission. The owner
confirms that no second computer or disposable environment is currently available.

## Provenance

| Group | Original directory |
| --- | --- |
| Inert | `out/lic008-export-policy-v4-inert-be18b45065a74ad58012297cd76f141a` |
| Capable | `out/lic008-export-policy-v4-capable-d24712f957da462097daa3b691a2a190` |
| Owner kit | `out/lic008-export-policy-v4-owner-kit-9bb63977804548388f4624271b855a23` |
| Inventory | `out/lic008-completion-inventory-bc27e13c881c47b9b03a671fd1bcc355/report-20261028-131035-9722356c107445c3a169a2be98dd50c0` |

Build files gain `inert-` or `capable-` archive prefixes. Variant reports gain
the variant name. Other kit filenames are unchanged; inventory is renamed
`current-host-inventory.json`. These names do not change file bytes.

| Archived record | SHA256 |
| --- | --- |
| [inert-manifest.json](inert-manifest.json) | `d98f41c276141343d5f8b9187c9a80a15e2cd10e60667c01c7d5ef69b7d1341f` |
| [inert-package-manifest.json](inert-package-manifest.json) | `e5e8a66d7ad9456956e15baad41440d112c13f179056729be05e6e9aa909d941` |
| [inert-package-build.json](inert-package-build.json) | `976fbf0acdfee82f28683f140bad9329c9a1ae2a48569d8ee1e2c109254fe2d7` |
| [inert-package-verification.json](inert-package-verification.json) | `f65f37a350ce1d656f95e3b373fe90c65e1e8d845d376d6148c165b2d802cfc7` |
| [inert-apphost-pure-test-report.json](inert-apphost-pure-test-report.json) | `165143433d793978c72c5cfd633fccfa67a1a72bec92d1c200aa9670a1c2f59e` |
| [inert-default-pure-test-report.json](inert-default-pure-test-report.json) | `165143433d793978c72c5cfd633fccfa67a1a72bec92d1c200aa9670a1c2f59e` |
| [inert-defines-still-inert-pure-test-report.json](inert-defines-still-inert-pure-test-report.json) | `165143433d793978c72c5cfd633fccfa67a1a72bec92d1c200aa9670a1c2f59e` |
| [capable-manifest.json](capable-manifest.json) | `955ea878608ed55d504054dd9945db74424b1a2cce0d47a08125fe6d84bebd83` |
| [capable-package-manifest.json](capable-package-manifest.json) | `fca1d27771cd04c2b1bb3131654f109e3e85efc839903d36271e821b52eafbfb` |
| [capable-package-build.json](capable-package-build.json) | `2fb98859865a58ef2c08b59ed0a93a0ae736f78b05080baa41f0f838f98da1c6` |
| [capable-package-verification.json](capable-package-verification.json) | `dfd687e8c957f4a2f1a58c744fdd61dda701a8929cad7907697c85abc5c326f2` |
| [capable-apphost-pure-test-report.json](capable-apphost-pure-test-report.json) | `55027a24be8e8bc13a582587897244f8f30080cd6416085125dba78ab46e0e03` |
| [capable-default-pure-test-report.json](capable-default-pure-test-report.json) | `165143433d793978c72c5cfd633fccfa67a1a72bec92d1c200aa9670a1c2f59e` |
| [capable-defines-still-inert-pure-test-report.json](capable-defines-still-inert-pure-test-report.json) | `165143433d793978c72c5cfd633fccfa67a1a72bec92d1c200aa9670a1c2f59e` |
| [capable-capable-pure-test-report.json](capable-capable-pure-test-report.json) | `55027a24be8e8bc13a582587897244f8f30080cd6416085125dba78ab46e0e03` |
| [kit.json](kit.json) | `3e245b1dec46baaf9e30f717f1c0934f1df71b2ce3ec210f110bcdb3bdf75ac8` |
| [kit-build.json](kit-build.json) | `dbcb465d02b0cf9e8979ce23e417b7bfe81f02400e17e61c9b74362d04c2bd18` |
| [helper-pure-test-report.json](helper-pure-test-report.json) | `26470877269c18175aa9aef6bb06af79dbb5acdbaae95b87a61631f7cf963a79` |
| [wrapper-pure-test-report.json](wrapper-pure-test-report.json) | `9b41d46e544153bc5b0177a99acbd974f2197a5f22cd1059c9eeb7f354d2bbfa` |
| [owner-token-test-report.json](owner-token-test-report.json) | `97feeddc67bb59edc5bd9ee8313e2c70c20908904d8a2f2f72688cf0cea6d845` |
| [kit-validation-test-report.json](kit-validation-test-report.json) | `4ff911b6d8dbb64f79015dc254bb7eba08d7e99471ae4eb35505c66d3d3f104f` |
| [current-host-inventory.json](current-host-inventory.json) | `1d793577e31aeea245cb33e08e1b0f2d5e4eaffd7661065182cfe5aa8376962e` |

Source-set SHA256: `fea8f307072a06b4cdc9cd2f2a35e254071e52d80d7798de394833e16917be33`.

Runtime-inventory SHA256: `f5e89159159cad439f9a473c4c46d6c8ba785c59828f8854d5467dc7d8dd76fa`.

## Physical boundary

This archive records construction and review. A later owner CheckOnly/Prepare/
live-CONFIRM execution has separate evidence; no build report supplies approval
or proves physical completion. Fresh exact input/hash/effect review is required.
The V3 cause remains unknown and its consumed attempt must not be retried.
LIC008/Open003, TPM/NV, independent Windows coverage and security/production
acceptance remain open.
