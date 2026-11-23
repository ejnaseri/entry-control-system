# LIC008 retained wrapping-evidence gaps — 2026-10-28

Work item: W02 / AG-002. Baseline: `38c98c8`.
Status: `ASSESSMENT_AND_19_ORIGINAL_BYTE_ARCHIVAL_COMPLETE_RESIDUAL_PROVENANCE_OPEN`.
This is an evidence-custody assessment, not adapter, cryptographic, security or
production acceptance. WrappingV2/V4/V5 below are the historical wrapping
harnesses, not the newer ExportPolicyControl placements.

[Completion worklist](../plans/LICENSING_LIC008_COMPLETION_PLAN.md)
· [Original adapter ledger](../plans/LICENSING_ADAPTER_ENTRY_EVIDENCE_LEDGER.md)
· [EV0152 original hashes](wrapping-retained-summary-hash-capture.md)
· [EV0153 reference reconciliation](wrapping-retained-evidence-reconciliation.md)
· [EV0154 V2 disposition](wrapping-v2-legacy-custody-disposition.md)
· [EV0168 EXE binding](../plans/LICENSING_ADAPTER_PRE_ENTRY_ACCEPTANCE_PACKAGE.md#8-operator-capture-completed-and-reviewed--lic-ev-0168)

## Reconciled versus remaining

Later fixed-path capture — 2026-10-28, archived 2026-11-02:
the [19-original archive](wrapping-retained-originals-20261028/README.md) now
preserves all five summaries/checkpoints and fourteen role reports below, plus
the original capture index. All 44,753 original bytes match the historical pins;
independent hash/semantic review PASS. This closes the original-byte archival
gap for that allowlist. V2 random role IDs and historical managed-DLL/source
binding remain unestablished; AG-002 stays PARTIAL. The permission-denied
ordinary assessment and pending-capture statements below describe the earlier
13:14:46UTC checkpoint, before the successful elevated read-only capture.

The original AG-002 ledger predates EV0152–0154 and EV0168. Its V4/V5
"hashes uncaptured" statements are historical, not the latest custody result.
This pass reread and hashed existing workspace diagnostic files and package
files. It did not execute any collector, controller, native worker or service.
The only attempted original-file access was to the five exact summary/checkpoint
paths below; every attempt was refused under the current process permissions.
No elevation, protected-directory discovery, key access, ACL operation or
protected write occurred.

| Evidence or obligation | Reconciled evidence and current check | Remaining limit |
| --- | --- | --- |
| V2 original summary | EV0152 captured its original hash/length; EV0153 bound schema/scope/experiment. Both retained diagnostic bytes still match their published pins. | Original bytes were not readable in this pass. The summary has no role-report inventory. |
| V2 role provenance | EV0154 source/package/transcript assessment found no exact role RunIds. Current source and packaged controller hashes and original ZIP hash still match EV0154. | Exact role filenames remain unrecovered from the examined material; no role originals were opened. This is not proof that files are absent. V2 remains historical-only and excluded as required proof. |
| V4 original summary/checkpoint and listed references | EV0153 reconciled 10/10 references: six role reports and four shared files, including the seven checkpoint references and reboot chronology. The retained diagnostic and claim-index metadata still agree. | No original-byte copies were obtained now. Current protected state and actual reboot behavior were not remeasured. |
| V5 original summary/checkpoint and listed references | EV0153 reconciled 12/12 references: eight role reports and four shared files, including the seven checkpoint references and missing-key report identity. Retained metadata still agrees. | Original-byte capture is pending. Historical `FAILED_OR_UNAVAILABLE` rows remain negative observations; no new failure classification or Repair acceptance. |
| V4/V5 report-to-EXE binding | EV0168's 14 rows match index0.2 and EV0153 report hashes, experiment identities and each local package EXE pin. Current comparison finds zero mismatches. | The report records the apphost EXE, not the executed managed DLL, dependencies or source-build provenance. |
| V4/V5 workspace package custody | Both original manifests match their historical pins; all 194 listed files per package still match size and SHA256. | Local custody does not prove those DLL/dependency bytes executed historically; extra-file absence was not tested. |
| Durable original-byte archive | Existing committed documents and index preserve provenance/pins; three retained diagnostics remain readable under `out`. No exact-basename original summary/checkpoint or sampled role-report copy was found in the inspected evidence tree. | `out` is ignored, and filtered diagnostic JSON is not an original report copy. A separately reviewed fixed-path capture can preserve available originals without changing their historical meaning. |

AG-002 remains **PARTIAL**. Repeating V4/V5 reconciliation is not needed to claim
that EV0153 happened; a new read can establish current availability and archive
the original bytes. It cannot add omitted historical managed-assembly/source
bindings. No missing fact is inferred from a matching version, a later package,
a copied report, a zero exit code or a missing file.

## Workspace bytes checked in this pass

The following hashes were measured again on 2026-10-28 and match their published
values. These are diagnostic/index hashes, not original-summary hashes.

| Existing file | Bytes | SHA256 |
| --- | --- | --- |
| `out/lic008-retained-hashes-67763c459aff46859ec2997c1811502a.json` | 3,232 | `8999df56cf83627200870455f49765332d4dc60eada177c548e1a0879e547f33` |
| `out/lic008-retained-reconciliation-32eab98043c34f8bb70d44a4f3f12b11.json` | 55,733 | `6919bad991a3817e54ca79ffe785a6c09a8c49dcace8b514f488b01cd7cde5b8` |
| `out/lic008-report-artifact-bindings-e25c38edfe89457fad6b655fd17dbef7.json` | 14,215 | `34aa1e1e35861d499df237b0e025a81d1b98609aaef1f33da0998e4bfb5abecf` |
| [Claim index0.2](adapter-entry-claim-bindings-v2.json) | 46,782 | `b3fb32ac723c72f5d45f82fa858fe1d5224fa1586b1a83a78a0720bdcaf21ea6` |

The three source collectors also retain their recorded raw hashes:

- `collect-license-retained-summary-hashes.ps1`:
  `56b5ac616281720920867f335416d78d77bb7e6390b3ca09692d2fb2153bc38f`.
- `reconcile-license-retained-evidence.ps1`:
  `e91ae6c81f22b6c0f826c17ff4515a8fd54866b7ed57d4b803f1041855364bbd`.
- `collect-license-report-artifact-bindings.ps1`:
  `26803a296c7ed19d9e8a1224c2e59a756bb6914df557db55cab60d3dccfed6f2`.

The V2 workspace and original packaged `Run-Wrapping-Harness.ps1` both retain
`726d9607fe9ec9ab1fb1ec13391f2b3c4f50c8d835d0e63d34f694be0f76ac97`.
The ZIP at
`out/lic008-wrapping-af2eac0d77324e2abad1df798bba9695/licensing-windows-wrapping-0.9.3.zip`
retains `ba78c9502fe8cffb1734dc99877f83c78d013ca34e492fd6606dc06178d6a11a`
(35,726,375 bytes). No package was executed or rebuilt.

Current V4/V5 package roots are respectively:

- `out/lic008-wrapping-reboot-bffb66e7921f44f2a27bcc15c9daf699/package`
- `out/lic008-wrapping-repair-262288ab49c14745a0f4f05c5f653a06/package`

Their manifest hashes remain
`046c3352f6937578b2ecaac65fd1afeac522131012d619398a01b0a102f18cd8` and
`aa4b776de01e5008db2a025e79390bb99f14b314605d64ac6b1a700205aa712c`.
The 388 listed-file checks have zero size/hash mismatches. The full EXE/DLL/
runner pins are already recorded in EV0165/0168, linked above.

## Fixed original metadata paths

At `2026-10-28T13:14:46.1056551Z`, each fixed-path attempt returned
`PermissionDenied / UnauthorizedAccessException`; no original digest or bytes
were obtained. Reparse ancestors were to be refused before content access.
These results mean **unavailable under current permissions**, not absent,
changed or corrupt. The expected lengths/hashes below are the prior original
measurements from EV0152, still recorded unchanged in the matching diagnostic.

| Exact original path | Expected bytes | Prior original SHA256 |
| --- | --- | --- |
| `C:\ProgramData\Ecs.Lic008.WrappingV2\wrapping-summary-7da3625af6f14f10b05b5bed5e1cf5be.json` | 1888 | `65f72549d6638f0d30488d5372bd2384f282853ab3daf79b260ddd1d18f164a1` |
| `C:\ProgramData\Ecs.Lic008.WrappingV4\wrapping-summary-47513d20e9864dcf84d40b8ace00b916.json` | 4925 | `ae8698b7e6459a3aa1c3fbee17f5c424c679aeb9d7f60f64ce5d4c4e11ee9a6a` |
| `C:\ProgramData\Ecs.Lic008.WrappingV4\reboot-checkpoint.json` | 2404 | `7417aae3163e3a35e0103303619844adcda021388c1816f02e8d288f10be62ea` |
| `C:\ProgramData\Ecs.Lic008.WrappingV5\wrapping-summary-de5efc93255841619c9f86f2570af292.json` | 5725 | `7a90250b5c520db757b27381b6cf995f90ce1486b03446d6314a8954de1734ef` |
| `C:\ProgramData\Ecs.Lic008.WrappingV5\repair-checkpoint.json` | 2265 | `adb4aa66402c671f50d21bbcdca84dc619341ffc5108ea1c7bdcd7fb20a7b1d8` |

## Exact role-report allowlist for a later capture

The 14 paths below come from EV0153 and the pinned index0.2, not directory
enumeration or inferred random identifiers. They were **not opened in this
pass**. Expected experiments are V4 `94cfc6789fe94e8aafdd010cb12f9af5` and
V5 `91fa20b415734ed0a9b7838c607ee709`. Scope, experiment, role, action and run
identity must be checked only after the original byte hash matches.

| Exact original role-report path | Expected bytes | SHA256 |
| --- | --- | --- |
| `C:\ProgramData\Ecs.Lic008.WrappingV4\app-reports\4630e211a11542c292370df295447d69.json` | 1708 | `566c671c7ae725bb909250b3205427a3f1fb01c16a8f8dfaf56e84cb14b12b45` |
| `C:\ProgramData\Ecs.Lic008.WrappingV4\app-reports\62fc2cb5f0fd4c1ca2f732c100943089.json` | 1708 | `adcb0a30587bbb9a01b842727669e0a53fddb3b3f735a543e36c5f5602bdc951` |
| `C:\ProgramData\Ecs.Lic008.WrappingV4\guardian-reports\78eb581814e34b0e990c565727343851.json` | 1523 | `1dbc6dd514cc6ceb6a2f3adccf0d780d458934a93ac6ae4d56737037249188eb` |
| `C:\ProgramData\Ecs.Lic008.WrappingV4\guardian-reports\9cffef3f732c48ec845289f7cd972905.json` | 1524 | `bfcaa992e4042c4e97669bb60aa53da5787cbee426e1e97aca41c6ffaa77f876` |
| `C:\ProgramData\Ecs.Lic008.WrappingV4\setup-reports\c4f2c4e719cb419b90683dc99de8506a.json` | 1088 | `c2fc9acdf5969949775a1a818ea80b78c87fc337698e547e7fc16a7efed27427` |
| `C:\ProgramData\Ecs.Lic008.WrappingV4\setup-reports\f860e5ce878a4266897dadc38a7ef47c.json` | 4519 | `61b58565969f7921a50bd0759738e45e3d1dcb167f9b352e49e4b56b25918208` |
| `C:\ProgramData\Ecs.Lic008.WrappingV5\app-reports\b801b6f83e814d50becdb8eb774ab022.json` | 1723 | `0e5393bd2321d885043c181c77904404b903e6e71f3aa98d58f286a751b41c94` |
| `C:\ProgramData\Ecs.Lic008.WrappingV5\app-reports\ee50ed945ad245e5bdf9ff673f47d44a.json` | 1723 | `15a3c0383057f8f051bf6eb459c30e271a0783ae868331c692a7238db023f66e` |
| `C:\ProgramData\Ecs.Lic008.WrappingV5\guardian-reports\88f7b426bdb44597b4ff534c25e6e61e.json` | 1779 | `535fb3fe68bc75e1e3d5cf071b67c57859d011ec82169649d4c8e3d201e939c4` |
| `C:\ProgramData\Ecs.Lic008.WrappingV5\guardian-reports\91b6e923a3d04740a143905eb1bcc13d.json` | 1538 | `e2072c3b9e091a582d2b1eff008d1c270549099e4f9eb42c44c4808d73b4ed1f` |
| `C:\ProgramData\Ecs.Lic008.WrappingV5\guardian-reports\de74e8bd89f34a4289828aeb2ab51efa.json` | 1538 | `b1847249f9912c548c8645b89fac92a47da966d51981d2f38972d5e9fbd1d722` |
| `C:\ProgramData\Ecs.Lic008.WrappingV5\guardian-reports\f6249fbf23a24ffbb3e56072c7aa3691.json` | 1538 | `dc8f5e15a915be6daad8e710b4c15cf2bfdff62c0c3f7bfad16ea9cce1cfd8b5` |
| `C:\ProgramData\Ecs.Lic008.WrappingV5\setup-reports\0976d16a1c3c40d588856f5fc6ed6c93.json` | 1104 | `4c416275b5309f8be83d5b961944f183cfb67e1f412bc5327afab12b708c0725` |
| `C:\ProgramData\Ecs.Lic008.WrappingV5\setup-reports\ef164161de664ea085ec54bab83c67b9.json` | 4533 | `1f284545cff3d2dcd1b1fbf506bb61e43e10f9d3665ee3e7301c11e24c2e36e3` |

EV0168 binds all six V4 reports to EXE
`1dded83a70b8ea956b984adf0c3f0c67916e1a11d31aa3c6a3368f91a146aef0`
and all eight V5 reports to EXE
`ff9cc0ad421238f2e0a94e9632c8450d7c14a5d5d4c44a755c6af33f3e2e2663`.
The 14 retained metadata rows and index/reference identities were compared again
with zero mismatches. `managedAssemblyExecutionBound=false` and
`sourceBinaryEquivalence=NOT_ESTABLISHED` remain unchanged.

The inspected V4/V5 `ServiceReport` implementations hash `Environment.ProcessPath`
at Program.cs line115. They do not emit historical managed-assembly/manifest
hashes. Re-reading these reports cannot recover fields they never recorded.
Source inspection describes the current source; it does not itself prove the
historical executable was produced from that source.

## Optional shared-file hash-only inventory

These eight known shared artifacts were included in EV0153. If a later capture
also checks the complete listed-reference inventory, use only the exact paths
below as opaque hash/length inputs; do not decode or copy their contents. This
pass did not open them. Expected original hashes/lengths are the corresponding
rows in [EV0153](wrapping-retained-evidence-reconciliation.md#exact-referenced-file-hashes).

```text
C:\ProgramData\Ecs.Lic008.WrappingV4\shared\app-readable-envelope.json
C:\ProgramData\Ecs.Lic008.WrappingV4\shared\app-readable-hash.json
C:\ProgramData\Ecs.Lic008.WrappingV4\shared\control-set.json
C:\ProgramData\Ecs.Lic008.WrappingV4\shared\restricted-envelope.json
C:\ProgramData\Ecs.Lic008.WrappingV5\shared\app-readable-envelope.json
C:\ProgramData\Ecs.Lic008.WrappingV5\shared\app-readable-hash.json
C:\ProgramData\Ecs.Lic008.WrappingV5\shared\control-set.json
C:\ProgramData\Ecs.Lic008.WrappingV5\shared\restricted-envelope.json
```

## What a later capture can and cannot resolve

A fixed-path read-only capture can preserve the five metadata and fourteen
role-report originals, recording original path, capture time, exact byte count,
original/copy SHA256 and unavailable/mismatch status. Bind reads to the expected
pins above, refuse reparse ancestors and oversize files, use new output files
without overwriting, and stop a namespace for review on any changed identity or
hash. Preserve bytes; do not reserialize an original and call it an exact copy.
No protected ownership/state/plan file, installed binary, private-key material,
key store, ACL or service operation is part of this allowlist.

The V2 summary's GUID and experiment GUID cannot yield role RunIds: the inspected
controller generates a separate random GUID for each role call and a separate
random summary filename, and stores no report list in its summary. Its expected
five calls are not filenames. No V2 role path is invented or authorized by this
document. The old attachment is identified and hash-pinned in EV0154; it was not
available among the examined workspace attachment filenames in this pass and
was not reread. Finding an authentic exact-ID record, or separately reviewing
protected report discovery, is distinct work; never rerun V2 to manufacture
historical evidence.

This pass changes only this new assessment document. The initial broad output
filename inventory encountered unrelated denied profile-fixture directories;
those errors do not imply a WrappingV2/V4/V5 evidence problem. No prior archive
was changed, no secret was read, and no historical result was relabeled. W02's
available-byte assessment is complete; original-byte archival, V2 provenance and
historical managed-DLL/source sufficiency remain explicit limitations. All
acceptance/full-reconciliation claims remain false; LIC008 and its owning gates
remain open.
