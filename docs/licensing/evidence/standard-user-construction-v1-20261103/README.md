# W03 closed construction components — original build reports

Date: 2026-11-03. Source baseline: `bece78d` plus the exact twenty source inputs
listed in the manifest. [Construction contract](../../plans/LICENSING_LIC008_STANDARD_CONSTRUCTION.md).

Authoritative output: `out/lic008-standard-construction-v1-414f39983e4e43868f7b255b2f0c8934`.
Built UTC: `2026-11-03T19:03:03.8188789+00:00`.
Source-set SHA256: `388ca6c99673be9928c7af5e296aed418fda5d0cb3522b9e50ea5edf881969ae`.

These four files are byte-for-byte copies, with no JSON reserialization:

| Original report | SHA256 |
| --- | --- |
| [Build manifest](build-manifest.json) | `17ce742780c404b207441c3f41d5accd5d9d4c7a666cb762d23edad75357b570` |
| [Default pure report](default-pure-test-report.json) | `6a369f86acbb246d259301336a083eb440a5dcd810e5b64a57413edb79b34795` |
| [Unrelated-defines pure report](unrelated-defines-pure-test-report.json) | `6a369f86acbb246d259301336a083eb440a5dcd810e5b64a57413edb79b34795` |
| [Compile-only-native pure report](compile-only-native-pure-test-report.json) | `6a369f86acbb246d259301336a083eb440a5dcd810e5b64a57413edb79b34795` |

Each variant passes **8,762 assertions and18 closed operational entries**:
identity305, launch270, credential40, comparison1,976, crypto primitives447,
input codec259, protected store4,736 and key creation729. Counts are source-level
assertions, not physical LIC008 case counts. The report explicitly records
synthetic in-memory crypto fixtures and no native logon, account mutation,
persisted-CNG or native-store probe, full controller or acceptance.

Default DLL SHA256: `4c9ae137cc6fd76b6b6051532baedd39086aad09ce3ffc1e534a236d3f21deaa`.
Unrelated-defines DLL SHA256: `bffdb2e273bda7afa24b4a542d6dc19fc02896cb69bcaa259b1cf7ba4a828466`.
Compile-only-native DLL SHA256: `1ec8c6597ae7845a23d57fc91fe19ba80391ada3a9f9430ab94eff51fed8eea5`.
Runtimeconfig SHA256: `614b63d58626fb0d97ff1313dc925605aafdba2b82a32c9d53b1bafa0286d516`.

Independent source review PASS after fixing directory-access mismatch,
unproved Guardian group assignment, parent handle lifetime, operation reentry
and creation concurrency. Independent artifact review PASS:1,360 read-only
assertions, exact33-file/4-directory output, twenty current/snapshot sources,
3 tools,167 references,15 Roslyn files,190 runtime files, AMD64 DLLs, exact
responses/configs and all report pins. No entry or native binding was invoked
by that review. Native descriptor formatting, relative-directory flag
compatibility and physical permission/durability behavior remain unproven.
The owner-controller Guardian/standard-user report sink still needs authenticated
IPC. No standard-account activation/logon, fresh service or persisted key was
created by this build. All consumed attempts and retained objects remain intact.

Intermediate construction outputs are retained as superseded build diagnostics;
only the named manifest/output above is the reviewed final source snapshot.
This is no LIC008/Open003, hardware/Windows, Security or production acceptance.
