# Retained wrapping original-byte archive

Capture: **2026-10-28**. Exact-byte recheck and archival: **2026-11-02**.

[Custody reassessment](../LIC008_RETAINED_EVIDENCE_GAPS_20261028.md) ? [LIC008 work ledger](../../plans/LICENSING_LIC008_COMPLETION_PLAN.md) ? [Collector source](../../../../scripts/collect-license-retained-originals.ps1)

This archive preserves19 exact historical metadata originals plus their capture
index. Five originals are WrappingV2/V4/V5 summaries/checkpoints;14 are V4/V5
role reports. These are the wrapping harness versions, not ExportPolicyControl
placements. The19 originals total44,753bytes; every captured length and SHA256
matches the fixed previously recorded original pin. No JSON was reserialized.
Git newline conversion is disabled for these files.

## Capture and independent review

The reviewed collector ran once as the elevated expected owner at
13:55:27.4926653?13:55:28.3067184UTC on October28. It read only19 fixed metadata
paths, refused reparse ancestors and mismatched opened paths, matched exact
length/SHA256 before copying, and used fresh CreateNew outputs with flush and
readback verification. It did not enumerate protected directories, read shared
envelopes or keys, run experiments, or change services/ACLs.

Collector SHA256: `e6260434216914af77914d5be70a342f9bd0e9bbe96c6fa3341b89c48c286ce5`.

Independent review by project_audit PASS on October28: all19 files, source/index
pins and14 role scope/experiment/role/action/RunId/EXE/runtime bindings match the
EV0153/EV0168/index0.2 evidence. All filtered claim IDs/statuses agree. Each of
the two Setup-create originals additionally preserves18 stage-PASS rows omitted
by the old filtered index; that expected filtering difference is preserved.
Summary/checkpoint subsets and historical reboot/Repair chronology/flags agree.
The V5 missing-key report retains its five FAILED_OR_UNAVAILABLE rows.

Content review found metadata, paths, IDs/SIDs, times, hashes, statuses and bounded
errors; no private key, plaintext, ciphertext or shared-envelope payload. On
November2 the coordinator rehashed every captured byte and the reviewed collector
before archival; no protected original was reopened for that recheck.

## Scope of closure

ORIGINAL_BYTE_ARCHIVAL is complete for this fixed19-file allowlist. AG-002 remains
PARTIAL: WrappingV2 exact random role RunIds are unavailable; historical executed
managed-DLL/dependency/source equivalence is not established. Current copies
cannot add fields the original reports never recorded. No V2 role path is inferred.
No new shared-file hash, DACL, service, provider, TPM, reboot or Repair test was
performed. This archive does not establish independent Security acceptance, full
LIC008/Open003 closure or any Windows matrix/production acceptance.

Original capture directory: `out/lic008-retained-original-capture-2de7176754d54285b1b158dc58494787`.

Filenames retain the collector aliases: original relative paths are flattened
with `__` and prefixed by their WrappingV namespace. The index binds each alias
back to its exact original path and byte hash.

| Archived record | SHA256 |
| --- | --- |
| [capture-index.json](capture-index.json) | `666922063022c2eae4135eb5dbafed3b03bbebadcf47061cce7a4aa0a0901d4a` |
| [Ecs.Lic008.WrappingV2__wrapping-summary-7da3625af6f14f10b05b5bed5e1cf5be.json](Ecs.Lic008.WrappingV2__wrapping-summary-7da3625af6f14f10b05b5bed5e1cf5be.json) | `65f72549d6638f0d30488d5372bd2384f282853ab3daf79b260ddd1d18f164a1` |
| [Ecs.Lic008.WrappingV4__wrapping-summary-47513d20e9864dcf84d40b8ace00b916.json](Ecs.Lic008.WrappingV4__wrapping-summary-47513d20e9864dcf84d40b8ace00b916.json) | `ae8698b7e6459a3aa1c3fbee17f5c424c679aeb9d7f60f64ce5d4c4e11ee9a6a` |
| [Ecs.Lic008.WrappingV4__reboot-checkpoint.json](Ecs.Lic008.WrappingV4__reboot-checkpoint.json) | `7417aae3163e3a35e0103303619844adcda021388c1816f02e8d288f10be62ea` |
| [Ecs.Lic008.WrappingV5__wrapping-summary-de5efc93255841619c9f86f2570af292.json](Ecs.Lic008.WrappingV5__wrapping-summary-de5efc93255841619c9f86f2570af292.json) | `7a90250b5c520db757b27381b6cf995f90ce1486b03446d6314a8954de1734ef` |
| [Ecs.Lic008.WrappingV5__repair-checkpoint.json](Ecs.Lic008.WrappingV5__repair-checkpoint.json) | `adb4aa66402c671f50d21bbcdca84dc619341ffc5108ea1c7bdcd7fb20a7b1d8` |
| [Ecs.Lic008.WrappingV4__app-reports__4630e211a11542c292370df295447d69.json](Ecs.Lic008.WrappingV4__app-reports__4630e211a11542c292370df295447d69.json) | `566c671c7ae725bb909250b3205427a3f1fb01c16a8f8dfaf56e84cb14b12b45` |
| [Ecs.Lic008.WrappingV4__app-reports__62fc2cb5f0fd4c1ca2f732c100943089.json](Ecs.Lic008.WrappingV4__app-reports__62fc2cb5f0fd4c1ca2f732c100943089.json) | `adcb0a30587bbb9a01b842727669e0a53fddb3b3f735a543e36c5f5602bdc951` |
| [Ecs.Lic008.WrappingV4__guardian-reports__78eb581814e34b0e990c565727343851.json](Ecs.Lic008.WrappingV4__guardian-reports__78eb581814e34b0e990c565727343851.json) | `1dbc6dd514cc6ceb6a2f3adccf0d780d458934a93ac6ae4d56737037249188eb` |
| [Ecs.Lic008.WrappingV4__guardian-reports__9cffef3f732c48ec845289f7cd972905.json](Ecs.Lic008.WrappingV4__guardian-reports__9cffef3f732c48ec845289f7cd972905.json) | `bfcaa992e4042c4e97669bb60aa53da5787cbee426e1e97aca41c6ffaa77f876` |
| [Ecs.Lic008.WrappingV4__setup-reports__c4f2c4e719cb419b90683dc99de8506a.json](Ecs.Lic008.WrappingV4__setup-reports__c4f2c4e719cb419b90683dc99de8506a.json) | `c2fc9acdf5969949775a1a818ea80b78c87fc337698e547e7fc16a7efed27427` |
| [Ecs.Lic008.WrappingV4__setup-reports__f860e5ce878a4266897dadc38a7ef47c.json](Ecs.Lic008.WrappingV4__setup-reports__f860e5ce878a4266897dadc38a7ef47c.json) | `61b58565969f7921a50bd0759738e45e3d1dcb167f9b352e49e4b56b25918208` |
| [Ecs.Lic008.WrappingV5__app-reports__b801b6f83e814d50becdb8eb774ab022.json](Ecs.Lic008.WrappingV5__app-reports__b801b6f83e814d50becdb8eb774ab022.json) | `0e5393bd2321d885043c181c77904404b903e6e71f3aa98d58f286a751b41c94` |
| [Ecs.Lic008.WrappingV5__app-reports__ee50ed945ad245e5bdf9ff673f47d44a.json](Ecs.Lic008.WrappingV5__app-reports__ee50ed945ad245e5bdf9ff673f47d44a.json) | `15a3c0383057f8f051bf6eb459c30e271a0783ae868331c692a7238db023f66e` |
| [Ecs.Lic008.WrappingV5__guardian-reports__88f7b426bdb44597b4ff534c25e6e61e.json](Ecs.Lic008.WrappingV5__guardian-reports__88f7b426bdb44597b4ff534c25e6e61e.json) | `535fb3fe68bc75e1e3d5cf071b67c57859d011ec82169649d4c8e3d201e939c4` |
| [Ecs.Lic008.WrappingV5__guardian-reports__91b6e923a3d04740a143905eb1bcc13d.json](Ecs.Lic008.WrappingV5__guardian-reports__91b6e923a3d04740a143905eb1bcc13d.json) | `e2072c3b9e091a582d2b1eff008d1c270549099e4f9eb42c44c4808d73b4ed1f` |
| [Ecs.Lic008.WrappingV5__guardian-reports__de74e8bd89f34a4289828aeb2ab51efa.json](Ecs.Lic008.WrappingV5__guardian-reports__de74e8bd89f34a4289828aeb2ab51efa.json) | `b1847249f9912c548c8645b89fac92a47da966d51981d2f38972d5e9fbd1d722` |
| [Ecs.Lic008.WrappingV5__guardian-reports__f6249fbf23a24ffbb3e56072c7aa3691.json](Ecs.Lic008.WrappingV5__guardian-reports__f6249fbf23a24ffbb3e56072c7aa3691.json) | `dc8f5e15a915be6daad8e710b4c15cf2bfdff62c0c3f7bfad16ea9cce1cfd8b5` |
| [Ecs.Lic008.WrappingV5__setup-reports__0976d16a1c3c40d588856f5fc6ed6c93.json](Ecs.Lic008.WrappingV5__setup-reports__0976d16a1c3c40d588856f5fc6ed6c93.json) | `4c416275b5309f8be83d5b961944f183cfb67e1f412bc5327afab12b708c0725` |
| [Ecs.Lic008.WrappingV5__setup-reports__ef164161de664ea085ec54bab83c67b9.json](Ecs.Lic008.WrappingV5__setup-reports__ef164161de664ea085ec54bab83c67b9.json) | `1f284545cff3d2dcd1b1fbf506bb61e43e10f9d3665ee3e7301c11e24c2e36e3` |
