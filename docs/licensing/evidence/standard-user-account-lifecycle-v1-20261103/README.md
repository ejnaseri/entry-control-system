# W03 closed account lifecycle - original build reports

Date: November3 UTC / November4 Kabul. Source baseline: `c7cfc93` plus28 exact
inputs. [Lifecycle contract](../../plans/LICENSING_LIC008_STANDARD_ACCOUNT_LIFECYCLE.md).

Authoritative output: `out/lic008-standard-account-lifecycle-v1-1e656782d98d48d19e8d2e7aa5c29943`.
Built UTC: `2026-11-03T19:47:56.0827366+00:00`.
Source-set SHA256: `4caf2eddea99598ae186dcac49dfeb67e5873b066946939f06e0897b0b03e101`.

Four byte-for-byte original copies; no JSON reserialization:

| Original | SHA256 |
| --- | --- |
| [build-manifest.json](build-manifest.json) | `0a96dd0110a8d249b80532dbca942100c8b565b3ca42a5ee852f4db0da3b2e86` |
| [default-pure-test-report.json](default-pure-test-report.json) | `50ed001c5a0c392dcf370f33d64f60a785861ec8e3accae6ceb46e3531c5c3b8` |
| [unrelated-defines-pure-test-report.json](unrelated-defines-pure-test-report.json) | `50ed001c5a0c392dcf370f33d64f60a785861ec8e3accae6ceb46e3531c5c3b8` |
| [compile-only-native-pure-test-report.json](compile-only-native-pure-test-report.json) | `50ed001c5a0c392dcf370f33d64f60a785861ec8e3accae6ceb46e3531c5c3b8` |

Each variant passes **12,855 assertions and26 closed operational entries**:
identity305, launch270, credential40, comparison1,976, primitives447, codec259,
store5,452, creation729, worker channel1,734, pipe70, custody622 and account951.
These are synthetic/injected source assertions, not physical LIC008 cases.
Native account backend is absent; account mutation/logon, native pipe/store/
custody, persisted CNG, full controller and acceptance are explicitly false.

| Variant | DLL SHA256 |
| --- | --- |
| default | `2951067d5bb0de36621c81c94ca06290ad04142eb11b2a5366cd02723b52a496` |
| unrelated-defines | `5054feafb3ced2377467f6d48f2c7b2baceb11b094f4762d7e04b50d6aca1617` |
| compile-only-native | `0709235cd41a24915a170779a86303b30964a4a3bd1ec734c623e086abf032a2` |

Runtimeconfig SHA256: `614b63d58626fb0d97ff1313dc925605aafdba2b82a32c9d53b1bafa0286d516`.

Independent source review PASS after correcting late activation admission,
explicit flag encoding, immutable group capture, mutation-callback reentry and
activation-result publication. Native SID-bound account binding, explicit
NetAPI/SAM conversion, loaded runtime/process proof and full SCM/controller
integration remain separate work. No account enable/disable/logon or fresh
service/key operation was invoked by the build or source review.

Independent artifact review PASS: **1,416 read-only assertions**, exact41-file/
4-directory output,28 current/snapshot sources,3 tools,167 references,15 Roslyn
files,190 runtime files, AMD64 DLLs, response/config and report pins. The reviewer
invoked no entry or native binding.

The prior account remains last independently observed disabled/Local/Users-only.
No consumed approval is reused. All earlier outputs and owned objects remain
retained; development scratch outputs are not authoritative execution evidence.
LIC008/Open003 and security/production acceptance remain open.
