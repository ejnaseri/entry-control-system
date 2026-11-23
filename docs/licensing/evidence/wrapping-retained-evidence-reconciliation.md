# Retained original evidence reconciliation — LIC-EV-0153

Date: 2026-10-07. Record: CHG0084 / LIC-EV-0153.
Baseline committed first as bf4be74 at the user's request.
Result: V4/V5 listed evidence hashes and role identities MATCH; V2 metadata
hash-bound but has no referenced-file inventory. AG-002 remains PARTIAL.

## Fixed read-only execution

[Collector](../../../scripts/reconcile-license-retained-evidence.ps1) binds
all five original summary/checkpoint snapshots to the exact SHA256 and lengths
captured in [EV0152](wrapping-retained-summary-hash-capture.md). It parses the
same checked bytes, validates scope/schema/experiment/version/acceptance flags,
and validates BOTH reference inventories before opening any referenced files.
Only exact GUID-named setup/guardian/app JSON reports and four named shared
artifacts are allowed under the fixed V4/V5 roots. No directory enumeration,
arbitrary root input, protected ownership/state/private-key reads or shared
content parsing. Reparse paths, traversal, duplicate references, excessive
counts/sizes, digest/identity mismatches stop that namespace without repairs.

Coordinator-run OS RunAs hidden read-only helper PID7584.
UTC: 2026-10-07T11:25:00.2036319Z.
Collector SHA256: e91ae6c81f22b6c0f826c17ff4515a8fd54866b7ed57d4b803f1041855364bbd.
Diagnostic: E:/EntryControlSystem/out/lic008-retained-reconciliation-32eab98043c34f8bb70d44a4f3f12b11.json.
Diagnostic SHA256: 6919bad991a3817e54ca79ffe785a6c09a8c49dcace8b514f488b01cd7cde5b8.
Generated out is ignored. This document preserves the filtered result/pins.
Earlier PID8500 output68027dcef8c441aa83370c95e0335c0f (diagnostic SHA256
69d981fc937f084ddf76828a2548aff9ba3608792dd5b1299029a3e5b43ca9ea)
also matched the lists/identities; the final helper additionally checks reboot
chronology and repair-summary flags/reference. Both were read-only; neither
invoked consumed controllers or changed original evidence.

## Reconciled observations

| Namespace | Experiment ID | Original metadata | Referenced inventory |
| --- | --- | --- | --- |
| V2 | ddf935ad95bc4a1e8fcccba4b233bbb9 | EV0152 summary bytes/schema/scope/false acceptance flags match | NO INVENTORY in original schema; no invented references |
| V4 | 94cfc6789fe94e8aafdd010cb12f9af5 | Summary/checkpoint pins and experiment/version match; 7 checkpoint entries remain in summary | 10/10 listed file hashes match; 6 role reports +4 shared artifacts |
| V5 | 91fa20b415734ed0a9b7838c607ee709 | Summary/checkpoint pins and experiment/version match; 7 checkpoint entries remain in summary | 12/12 listed file hashes match; 8 role reports +4 shared artifacts |

V4 boot-before < prepared < boot-after chronology matches, with timestamp
bindings to checkpoint and historical normalRebootPassed/machineIdentityMatched
true. This is retained observation reconciliation, not a new reboot.

V5 historical repairSimulationPassed, sameKeyIdentityVerified,
sameEnvelopeBytesVerified and missingKeyRepairRefused are true;
keyRecreationAttempted and productionRepairTested are false.
missingKeyProbeRunId identifies guardian report88f7b426bdb44597b4ff534c25e6e61e.
Its five FAILED_OR_UNAVAILABLE rows are preserved as negative-test observations,
not relabeled PASS. Controller source requires this controlled missing-key
refusal; file/hash/identity matching alone is not independent crypto acceptance.
Other role statuses include PASS and OBSERVED_BAD_KEYSET; this helper does not
reclassify raw statuses or independently reproduce their security meaning.

## Exact referenced-file hashes

All relative paths below are under their named fixed ProgramData namespace.
Shared artifacts are SHA256-only, not decoded. No plaintext/error/token content
is copied into this document.

| Namespace | Relative file | Bytes | SHA256 | Comparison |
| --- | --- | --- | --- | --- |
| v4 | app-reports/4630e211a11542c292370df295447d69.json | 1708 | 566c671c7ae725bb909250b3205427a3f1fb01c16a8f8dfaf56e84cb14b12b45 | MATCH |
| v4 | app-reports/62fc2cb5f0fd4c1ca2f732c100943089.json | 1708 | adcb0a30587bbb9a01b842727669e0a53fddb3b3f735a543e36c5f5602bdc951 | MATCH |
| v4 | guardian-reports/78eb581814e34b0e990c565727343851.json | 1523 | 1dbc6dd514cc6ceb6a2f3adccf0d780d458934a93ac6ae4d56737037249188eb | MATCH |
| v4 | guardian-reports/9cffef3f732c48ec845289f7cd972905.json | 1524 | bfcaa992e4042c4e97669bb60aa53da5787cbee426e1e97aca41c6ffaa77f876 | MATCH |
| v4 | setup-reports/c4f2c4e719cb419b90683dc99de8506a.json | 1088 | c2fc9acdf5969949775a1a818ea80b78c87fc337698e547e7fc16a7efed27427 | MATCH |
| v4 | setup-reports/f860e5ce878a4266897dadc38a7ef47c.json | 4519 | 61b58565969f7921a50bd0759738e45e3d1dcb167f9b352e49e4b56b25918208 | MATCH |
| v4 | shared/app-readable-envelope.json | 1254 | 36e6302696d53e8894aa609462f4efa1236f8e45c4e91ca9d5d116c639d5bea0 | MATCH |
| v4 | shared/app-readable-hash.json | 91 | a3a187f80e2e80ca9613152c109ac24e806ecf7d741ddd9333f0f082185ed4ac | MATCH |
| v4 | shared/control-set.json | 525 | 5ae55bcfdbd2659388af4b338585e2d71dec128bb3d0c3c636ab8792303e80ee | MATCH |
| v4 | shared/restricted-envelope.json | 1242 | d94efff382c94185bc5a51a16b83851cbeedb74ed6395407be39a6a19f886c44 | MATCH |
| v5 | app-reports/b801b6f83e814d50becdb8eb774ab022.json | 1723 | 0e5393bd2321d885043c181c77904404b903e6e71f3aa98d58f286a751b41c94 | MATCH |
| v5 | app-reports/ee50ed945ad245e5bdf9ff673f47d44a.json | 1723 | 15a3c0383057f8f051bf6eb459c30e271a0783ae868331c692a7238db023f66e | MATCH |
| v5 | guardian-reports/88f7b426bdb44597b4ff534c25e6e61e.json | 1779 | 535fb3fe68bc75e1e3d5cf071b67c57859d011ec82169649d4c8e3d201e939c4 | MATCH |
| v5 | guardian-reports/91b6e923a3d04740a143905eb1bcc13d.json | 1538 | e2072c3b9e091a582d2b1eff008d1c270549099e4f9eb42c44c4808d73b4ed1f | MATCH |
| v5 | guardian-reports/de74e8bd89f34a4289828aeb2ab51efa.json | 1538 | b1847249f9912c548c8645b89fac92a47da966d51981d2f38972d5e9fbd1d722 | MATCH |
| v5 | guardian-reports/f6249fbf23a24ffbb3e56072c7aa3691.json | 1538 | dc8f5e15a915be6daad8e710b4c15cf2bfdff62c0c3f7bfad16ea9cce1cfd8b5 | MATCH |
| v5 | setup-reports/0976d16a1c3c40d588856f5fc6ed6c93.json | 1104 | 4c416275b5309f8be83d5b961944f183cfb67e1f412bc5327afab12b708c0725 | MATCH |
| v5 | setup-reports/ef164161de664ea085ec54bab83c67b9.json | 4533 | 1f284545cff3d2dcd1b1fbf506bb61e43e10f9d3665ee3e7301c11e24c2e36e3 | MATCH |
| v5 | shared/app-readable-envelope.json | 1214 | 50bf7fc8cb147d959be5fe8e6f0605d209ba6a6406298d5e570127a91a0a1b51 | MATCH |
| v5 | shared/app-readable-hash.json | 91 | a61d7d0e5c5342e2567806260987291bfadcc1dc79b9236c6d7d610eec740604 | MATCH |
| v5 | shared/control-set.json | 525 | ccdb5d4fae963e8fe5f5eaad4b8f4264b6cdc859844841066659f993f79db697 | MATCH |
| v5 | shared/restricted-envelope.json | 1257 | a06cd519d377ee6804a7dbf4b1c216cc8b94b1ddd322344de3a80aa27b656c7c | MATCH |

## Limits and next action

This closes the bounded V4/V5 retained-reference custody task, not AG-002 as a
whole: V2 exact role-file provenance is not recoverable from its summary list
because no list exists. V3/V6/V7 evidence retains its previously recorded
operator/independent provenance; it was not re-read in this step.
Current DACLs, installed binaries/manifests, machine identity, key policy and
cryptographic behavior were NOT remeasured. Role binary digests were format
checked, not compared to current executable bytes. No services, keys, ACLs,
database, Installer or K40 state changed. No new physical test.
fullEvidenceReconciled=false; securityAccepted=false; productionAccepted=false.
LIC008/Open003 and NE-002 remain open; native entry NOT_READY.

Next: decide bounded V2 custody disposition (explicit legacy provenance gap or
separately authorized exact report-ID recovery), then obtain an explicitly
assigned non-author adapter scope review/acceptance and versioned integration
contracts. Do not search protected directories or rerun V1-V7 by implication.

## Validation

PowerShell parser and inert ValidateOnly PASS. Positive allowed-reference test
and ten traversal/absolute/UNC/unknown/duplicate reference refusals PASS; no
protected reads/writes in that mode. Final fixed-input result has 3 namespaces,
V4 10 and V5 12 matched reference rows, checkpoint subsets7 each, and all
overall acceptance/full-reconciliation flags false. Documentation links and
git whitespace checks validated separately. Post-baseline work is not committed
in this step.
