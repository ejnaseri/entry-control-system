# W03 NativeHostV2 candidate package binding — original closed-build evidence

Built November 11 Kabul from baseline `6075d3d` and nine exact inputs: eight
C# sources and the reviewed builder. The [contract and limits](../../plans/LICENSING_LIC008_STANDARD_NATIVE_LOADER_PROFILE.md)
describe this content-only candidate. Authoritative retained output:
`out/lic008-standard-native-package-binding-v2-882df20d6ebf4022bdfcf3ac03f31e0a`.
The nine-input source-set SHA256 is
`295e416c76b3cb114b37a3c6c76a58f946f1b9d674667b058eb53fbd41ee4249`.
The frozen binder/test/builder source SHA256 values are respectively
`4a962433bec1179238053b71f946949f7f0601d2dba25dfdf41224a77420fac0`,
`06cbb736a4fd31d9ab4acbda9b7b0a586c76ea9aaf4fbff204fd469662d97095`
and `b90f946eda86f8eff791179e888191bc4670661617bc11d31a129f31eb102c39`.

These five files are **102,683 bytes of byte-for-byte originals**, copied by
CreateNew from the retained build without parsing or reserialization.
Independent artifact/archive audit PASS: all nine live/snapshot source bytes,
375 installed tool/reference/compiler/runtime pins (374 unique paths), three
DLLs and runtime configurations, all 63 terminal child streams/records, 57
refused commands, 336 expected output files with no pending child, and all
five archived originals were checked. All 16 manifest and 11 pure-report
authority/effect flags are false.

| Original | Bytes | SHA256 |
| --- | ---: | --- |
| [build-manifest.json](build-manifest.json) | 99,387 | `1b792aa2eae09baf1243a34554b378164f9068fb6057a27a499253aca2142f29` |
| [source-set.json](source-set.json) | 1,805 | `295e416c76b3cb114b37a3c6c76a58f946f1b9d674667b058eb53fbd41ee4249` |
| [default-pure-test-report.json](default-pure-test-report.json) | 497 | `ccf64f878497f3d5322c899354b36007b0bbaf1b3cc7890141a53396656db19b` |
| [unrelated-defines-pure-test-report.json](unrelated-defines-pure-test-report.json) | 497 | `ccf64f878497f3d5322c899354b36007b0bbaf1b3cc7890141a53396656db19b` |
| [native-macro-defines-pure-test-report.json](native-macro-defines-pure-test-report.json) | 497 | `ccf64f878497f3d5322c899354b36007b0bbaf1b3cc7890141a53396656db19b` |

All three .NET 10 warning-as-error builds passed profile **144**, input
codec **125**, stage store **1,011** and package binding **700** pure checks;
each refused 19 operational CLI shapes. Their DLL SHA256 values, in
default/unrelated-defines/native-macro-defines order, are
`add90d56d860a304610686f398b1e1d47709c37a0c9e69810ccbb0d646257371`,
`5bd1ff243120ce5e45ed9bb6d43e54d1623f438f1890b3a5c5e343b01fefa0db`
and `1ad45d39c6adca579845adae7cd53ed36e7fd12f84e47d88c6d5ff70a6307c0f`.
The third variant changes C# preprocessor symbols only; no C code or native
call is involved. Byte reproducibility is not established.

The tests use synthetic source, image, assembly, hostfxr and runtime bytes.
They check in-memory hash consistency, not a protected on-disk package,
source-to-binary equivalence, loaded-code identity or Owner intent. The
approval is unsigned and physical admission unconditionally refuses. No
account, SCM, native loader, CLR bootstrap, protected filesystem, transfer,
GRANT, pipe, ACK, persisted CNG key or W03 comparison was exercised. Physical
W03, LIC008/Open003 and security/production acceptance remain open.
