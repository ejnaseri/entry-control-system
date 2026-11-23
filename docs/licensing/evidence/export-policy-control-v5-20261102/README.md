# V5 source, build and owner-kit evidence - 2026-11-02

[V5 contract](../../plans/LICENSING_EXPORT_POLICY_V5_PLACEMENT.md) / [Initial-status correction](../../plans/LICENSING_EXPORT_POLICY_PROCESS_OBSERVATION_FIX.md) / [Consumed V4](../export-policy-control-v4-run-20261028/README.md)

These21 JSON files preserve exact report bytes without reserialization or Git
newline conversion. Inert construction occurred October28; source/tool/runtime/
artifact pins were independently rechecked November2 before separate capable
and owner-kit construction. Generated binaries/snapshots remain under `out`.

## Source and verification

The source derives from correction baseline `87d69f7` and selects only a fresh
ExportPolicyControlV5 root, Setup SID, keys, scopes, capability and input/output
prefix. All old V1/V2/V3/V4 definitions/records are negative fixtures. Existing
Guardian identity, ACLs, process completion/restoration proof and classification
remain intact. The initial-start observer retains the same admitted SCM handle,
25ms sampling, cheap current-session/expiry checks and original45s timer. Only
RUNNING/nonzeroPID reaches unchanged process admission. Sampling is not a
guarantee of capturing every short worker. Controller result schema3/RESULT_V3
is deliberately independent of placement version.

| Check | Actual result |
| --- | --- |
| Each control variant and packaged apphost | 18,480 assertions PASS |
| Placement / native-key / controller components | 638 /285 /1,579 within total |
| New old-V4/mixed-version refusals | 164 assertions after correction checkpoint |
| Default and V1/V2/V3/V4-defined entries | 14 refusals per variant/apphost |
| V5 capable malformed entries | 13 refusals per variant/apphost |
| Owner helper | 539 pure assertions;8 malformed entries refused |
| Owner wrapper / kit validators | 318 /295 pure assertions |
| Helper own-process token regression | 9 checks; non-elevated current-owner token |
| Independent source review | PASS, change_review |
| Independent Nov2 inert/capable/kit audit | PASS, project_audit |

Independent audits rehashed26 current sources and snapshots per control build,
four tools,167 references,190 runtime files and four package files; the capable
manifest binds the exact reviewed inert. Kit review covers32 current inputs and
snapshots, four tools plus PowerShell, references/runtime, three kit payloads
and report pins. The helper has no physical capability. Its own-token regression
is not a genuine standard-account isolation test or elevated owner preflight.

The same assertion suite is repeated across builds; totals are not summed into
independent physical coverage. Builders invoke pure/malformed routes only.
All build physicalTested/security/production flags remain false. These are scoped
automated source/artifact reviews, not human Security or full LIC008 acceptance.

## Original locations and byte pins

| Group | Original directory |
| --- | --- |
| inert | `out/lic008-export-policy-v5-inert-e082c0b53483478cb82f2f2f3bb53c88` |
| capable | `out/lic008-export-policy-v5-capable-b1a1cc9921c747c192ee9adb04ad9b37` |
| kit | `out/lic008-export-policy-v5-owner-kit-78d3a277e46149719def879d1c795c77` |

Build files gain inert-/capable- archive prefixes; variant reports also include
variant names. Kit report filenames remain unchanged. No file bytes are changed.

| Archived record | SHA256 |
| --- | --- |
| [inert-manifest.json](inert-manifest.json) | `c85cb1d4026b462fe04c25dfaff62bd21590c68101dd23037868597d8c9e9362` |
| [inert-package-manifest.json](inert-package-manifest.json) | `2459b7a3718e57464b27afe59a165879fa66ea990b848306609730be5930bfb0` |
| [inert-package-build.json](inert-package-build.json) | `a12dcc2105e442fe78a2bbdd5206e3c8a4f4e0bc1482bb15ccd75758b4e30ad3` |
| [inert-package-verification.json](inert-package-verification.json) | `07d16af5f4f97a1fe4666203b19fac6b1788c994ce5edac06250f16d51e4561b` |
| [inert-apphost-pure-test-report.json](inert-apphost-pure-test-report.json) | `906a1620c6c6095449fffb20886a6b95160065b1f450b5ad0fdabddd7038e46d` |
| [inert-default-pure-test-report.json](inert-default-pure-test-report.json) | `906a1620c6c6095449fffb20886a6b95160065b1f450b5ad0fdabddd7038e46d` |
| [inert-defines-still-inert-pure-test-report.json](inert-defines-still-inert-pure-test-report.json) | `906a1620c6c6095449fffb20886a6b95160065b1f450b5ad0fdabddd7038e46d` |
| [capable-manifest.json](capable-manifest.json) | `6e48833d2cfe8cc0641c78a302fbec7566138bba99396fe4d5e320ea1fae15d9` |
| [capable-package-manifest.json](capable-package-manifest.json) | `f82f9015a154f99e106742c2c773ed5405019cea3bf08cd75293ef395266b078` |
| [capable-package-build.json](capable-package-build.json) | `f3e089f6c0a299b783a35956eabe78137eaa0ee0b580beb2a01994a2d77367e2` |
| [capable-package-verification.json](capable-package-verification.json) | `2afad6f3b39d3cd2fd07120e64916e15c00ed444bc828486c7822a3692e6bbbd` |
| [capable-apphost-pure-test-report.json](capable-apphost-pure-test-report.json) | `329b670f683025eea9f9a1a051575f09b2b2ef21a7767296ae37fc144dfaaa0a` |
| [capable-default-pure-test-report.json](capable-default-pure-test-report.json) | `906a1620c6c6095449fffb20886a6b95160065b1f450b5ad0fdabddd7038e46d` |
| [capable-defines-still-inert-pure-test-report.json](capable-defines-still-inert-pure-test-report.json) | `906a1620c6c6095449fffb20886a6b95160065b1f450b5ad0fdabddd7038e46d` |
| [capable-capable-pure-test-report.json](capable-capable-pure-test-report.json) | `329b670f683025eea9f9a1a051575f09b2b2ef21a7767296ae37fc144dfaaa0a` |
| [kit.json](kit.json) | `7853bc181527e88eb9924aa6c745f3359bd735c7e12179afbb623bb86eeb92b5` |
| [kit-build.json](kit-build.json) | `697912eb8fd1aa4635f96ab7ebcac04360f25dcc6c21dc1d26c69c591cc84773` |
| [helper-pure-test-report.json](helper-pure-test-report.json) | `2325b88df302f1bd10a916b3c4f998d8ea9ad1e4f707d3ecb91b6ce363483ff0` |
| [wrapper-pure-test-report.json](wrapper-pure-test-report.json) | `f47ccc1699028e760c2f19b2ccdb4d93db1c15b208d9fc0e1854818a11ba89c4` |
| [owner-token-test-report.json](owner-token-test-report.json) | `97feeddc67bb59edc5bd9ee8313e2c70c20908904d8a2f2f72688cf0cea6d845` |
| [kit-validation-test-report.json](kit-validation-test-report.json) | `4ff911b6d8dbb64f79015dc254bb7eba08d7e99471ae4eb35505c66d3d3f104f` |

Source-set SHA256: `ed7db5e281cab813d24c24a163872668a09e59ca6e2035e3c2afdf14b330df72`.

Runtime-inventory SHA256: `f5e89159159cad439f9a473c4c46d6c8ba785c59828f8854d5467dc7d8dd76fa`.

## Physical boundary

This archive covers construction/review only. November2 CheckOnly/Prepare,
input review and owner-confirmed execution have [separate exact evidence](../export-policy-control-v5-run-20261102/README.md):
two observed differentials and an inconclusive opaque control/aggregate. No expired
or consumed October28 inputs may be reused. V1/V2/V3/V4 resources/evidence stay
preserved. Full LIC008/Open003, standard-account/interruption/TPM/NV and independent
Windows/security/production acceptance remain open.
