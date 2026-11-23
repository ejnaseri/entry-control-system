# W03 closed native lifecycle bindings - original build reports

Date: November3 UTC / November4 Kabul. Source baseline: `7e11850` plus36 exact
inputs. [Native lifecycle contract](../../plans/LICENSING_LIC008_STANDARD_NATIVE_LIFECYCLE.md).

Authoritative output: `out/lic008-standard-native-lifecycle-v1-02addf232023447288a6f43230398eea`.
Built UTC: `2026-11-03T20:18:31.7778751+00:00`.
Source-set SHA256: `bc41c93d97e68939416f7d617a083cf6fb1fa22f9e3da9b3883ffe119295ac79`.

Four byte-for-byte original copies, **88,715 bytes**; no JSON reserialization:

| Original | SHA256 |
| --- | --- |
| [build-manifest.json](build-manifest.json) | `1defab0f61b2771eecd6ef1191d8653262f2ce533297c5476895f41177a3031f` |
| [default-pure-test-report.json](default-pure-test-report.json) | `763e3f481e5a739a840c1aed896a465c8f57676c829b2b4f979b7b4fd0853cb1` |
| [unrelated-defines-pure-test-report.json](unrelated-defines-pure-test-report.json) | `763e3f481e5a739a840c1aed896a465c8f57676c829b2b4f979b7b4fd0853cb1` |
| [compile-only-native-pure-test-report.json](compile-only-native-pure-test-report.json) | `763e3f481e5a739a840c1aed896a465c8f57676c829b2b4f979b7b4fd0853cb1` |

Each variant passes **19,382 assertions and37 closed operational entries**:
identity305, launch270, credential40, comparison1,976, primitives447, input
codec259, store5,452, creation729, worker channel1,734, pipe70, custody622,
account lifecycle951, flag codec2,982, native account adapter2,027, service
lifecycle1,330 and peer-object rules188. These are synthetic/injected component
assertions, not physical LIC008 cases or native compatibility tests.

| Variant | DLL SHA256 |
| --- | --- |
| default | `f4c868f2b5cdb5b42f55b252d8c66bb0ef2d905dbf8c7be95aff42e3de464388` |
| unrelated-defines | `fa5060ceb1bc9c0e314de300e4961fe6122884bf7124f9c7d0281f8d05e09aa7` |
| compile-only-native | `49c055fbd303be7a2eb28805190b6897d758caa6aa875f777dbc52d4152a91e6` |

Runtimeconfig SHA256: `614b63d58626fb0d97ff1313dc925605aafdba2b82a32c9d53b1bafa0286d516`.

Independent source review PASS after correcting final thread impersonation/
identity checks, native error preservation, original custody exception handling,
retained service-handle release, nonce reuse, UTC rollback, latched failed starts
and final observation/custody deadline checks. No reviewer entry or native API
was invoked.

Independent artifact audit PASS: **1,496 read-only assertions**,36 current/
snapshot inputs,3 tools,167 references,15 Roslyn and190 runtime originals,
exact49-file/4-directory output, AMD64 DLLs and exact response/config/report
pins. The reviewer ran no entry or native binding.

The account and SCM sources are implemented but their native bindings are only
compiled. Actual account/logon/service/peer/native store/pipe/custody effects,
persisted CNG, process/token association, loaded-code proof, bootstrap, full
controller and all acceptance flags remain false. The service dispatcher,
concrete held-process opener/journal sink, pending RPC observer and bounded SAM
caller integration are absent. SAM ABI/layout compatibility is unverified.

No account activation/disable/logon, SCM creation/start or peer transfer ran.
Account1023 remains last independently observed disabled/Local/Users-only on
November2; this build is not a new physical account observation. All earlier
owned objects, consumed attempts and outputs remain retained. Only the36 exact
manifest inputs participate in this build.
LIC008/Open003 and security/production acceptance remain open.
