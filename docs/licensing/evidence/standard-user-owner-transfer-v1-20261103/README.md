# W03 closed Owner transfer and service journals - original reports

Date: November3 UTC / November4 Kabul. Source baseline: `afbb6fc` plus40 exact
inputs. [Transfer/journal contract](../../plans/LICENSING_LIC008_STANDARD_TRANSFER_JOURNALS.md).

Authoritative output: `out/lic008-standard-owner-transfer-v1-94bd56de52e44f95a39ed849cec08d97`.
Built UTC: `2026-11-03T20:41:27.2731753+00:00`.
Source-set SHA256: `8a90ec107259fed2fa5384c4769705aca0e5eb3e40d65188f055e7ac5664c3a4`.

Four byte-for-byte original copies, **90,187 bytes**; no JSON reserialization:

| Original | SHA256 |
| --- | --- |
| [build-manifest.json](build-manifest.json) | `7afd14bf866273115f8f73433e98566acfaa9877200d21cb1315ca04558e84f5` |
| [default-pure-test-report.json](default-pure-test-report.json) | `cbb57e7aa1c909a49837c695045ce9357f6bf5e8dfe2570dd545f0538cdad88a` |
| [unrelated-defines-pure-test-report.json](unrelated-defines-pure-test-report.json) | `cbb57e7aa1c909a49837c695045ce9357f6bf5e8dfe2570dd545f0538cdad88a` |
| [compile-only-native-pure-test-report.json](compile-only-native-pure-test-report.json) | `cbb57e7aa1c909a49837c695045ce9357f6bf5e8dfe2570dd545f0538cdad88a` |

Each variant passes **22,987 assertions and41 closed operational entries**:
identity305, launch270, credential40, comparison1,976, primitives447, input
codec259, store7,493, creation729, worker channel1,734, pipe70, custody622,
account lifecycle951, flag codec2,982, native account adapter2,027, service
lifecycle1,330, peer-object rules188, Owner transfer1,381 and service journal183.
These are synthetic/injected component assertions, not physical LIC008 cases.

| Variant | DLL SHA256 |
| --- | --- |
| default | `6decca899a9ea2aea34a14b3547e211730c25d4d3bc087fe4a95cbe07f522407` |
| unrelated-defines | `d0fa455117782d0d6d092449beda2ea385bd6ceeb3fdb42e2096531de8d44cbd` |
| compile-only-native | `828446345e40c0a09d8548aca7f90198024a643380429f67d561436f8953bd26` |

Runtimeconfig SHA256: `614b63d58626fb0d97ff1313dc925605aafdba2b82a32c9d53b1bafa0286d516`.

Independent source review PASS, including the corrected concurrent terminal
publication race, fixed service mapping/permissions and retained write failures.
Independent artifact audit PASS: **1,530 read-only assertions**,40 current/
snapshot inputs,3 tools,167 references,15 Roslyn and190 runtime originals,
exact53-file/4-directory output, AMD64 DLLs and exact response/config/report
pins. The reviewer ran no entry or native binding.

The Owner transfer is an injected V2 protocol model; it has no actual native
transfer, V2 input codec, concrete transfer store or live bootstrap transport.
The service journal adapter is concrete mapping/receipt/readback logic over an
injected store, not physical collection. All native effects, association,
bootstrap, loaded-code and compatibility/security/production acceptance flags
remain false. Existing synchronous account/store and unresolved RPC retention
limitations still apply; no late-completion recovery or cleanup is inferred.

No account activation/disable/logon, SCM creation/start or actual handle transfer
ran. Account1023 remains last independently observed disabled/Local/Users-only
on November2; this build is not a new physical account observation. All consumed
attempts, owned objects and previous outputs remain retained. Only the40 exact
manifest inputs participate in this build. LIC008/Open003 remains open.
