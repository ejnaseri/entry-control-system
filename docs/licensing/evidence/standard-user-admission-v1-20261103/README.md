# W03 closed admission components — original build reports

Date: 2026-11-03 UTC (November4 in Kabul). Source baseline: `fea37d6` plus the
26 exact inputs in the manifest. [Admission contract](../../plans/LICENSING_LIC008_STANDARD_ADMISSION.md).

Authoritative output: `out/lic008-standard-admission-v1-7d854026cdd042f5aefebb708ae287c5`.
Built UTC: `2026-11-03T19:35:48.7260353+00:00`.
Source-set SHA256: `1373e1afd6bbcd323fb2f462bb32121f75ad6f369b464f9946c0a4f32a9515a8`.

These four files are byte-for-byte copies without JSON reserialization:

| Original report | SHA256 |
| --- | --- |
| [Build manifest](build-manifest.json) | `f7e9d21bda09836b40aeac6bd34f26ec367eda97b1128197bfbf7773c25b76e9` |
| [Default pure report](default-pure-test-report.json) | `8fcc1cb340419b088803c77c46ba3736851d34ef2ab4acea7f139bebf0d12156` |
| [Unrelated-defines pure report](unrelated-defines-pure-test-report.json) | `8fcc1cb340419b088803c77c46ba3736851d34ef2ab4acea7f139bebf0d12156` |
| [Compile-only-native pure report](compile-only-native-pure-test-report.json) | `8fcc1cb340419b088803c77c46ba3736851d34ef2ab4acea7f139bebf0d12156` |

Each variant passes **11,392 assertions and 22 closed operational entries**:
identity305, launch270, credential40, comparison1,976, crypto primitives447,
input codec259, protected store4,940, key creation729, worker channel1,734,
native-pipe lifetime/rules70 and file custody622. These are synthetic/injected
source-level assertions, not physical LIC008 case counts. Native pipe/store/
custody/logon, account mutation, persisted CNG, complete crypto controller and
security/production acceptance are all explicitly false.

| Variant | DLL SHA256 |
| --- | --- |
| default | `45548d50b08f16f70ff256ee610eedae977d330ec7ffcb3f4141a1dd82f535b0` |
| unrelated-defines | `b525ae8b101da9079296deaae269032f69754c19914803699f578ff22f63943f` |
| compile-only-native | `03cf47a885d05e0d0ae6b94d6b7507e2f16cdc6e54812a26e22e3efc1545d6da` |

All runtimeconfig files: `614b63d58626fb0d97ff1313dc925605aafdba2b82a32c9d53b1bafa0286d516`.

Independent source review PASS for the closed/injected scope after correcting
pipe client-instance rights, pending-I/O/cancellation lifetime, aggregate
timeouts, frame chunking, pre-grant evidence validation and held-exit metadata.
Native token/process adapters, loaded runtime/hostfxr proof, durable consumed
stages and physical descriptor/permission compatibility remain unimplemented
or unproven. Account1023 remains last observed disabled and Users-only; this
build did not activate it, log on, create services or persisted keys.

Independent artifact review PASS: **1,401 read-only assertions**, exact39-file/
4-directory output, 26 current/snapshot sources, 3 tools, 167 references,
15 Roslyn files, 190 runtime files, AMD64 DLLs, exact response/config files and
all original report pins. The reviewer invoked no entry or native binding.

Earlier development outputs are retained as superseded diagnostics:
one refused `STANDARD_ADMISSION_SOURCE_CHANGED` while source review was active;
the subsequent build was superseded only to remove a trailing blank source line.
Only the named immutable output above is the final build. Previous evidence
and retained objects remain intact. LIC008/Open003 and acceptance remain open.
