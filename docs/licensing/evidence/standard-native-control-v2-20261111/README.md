# W03 NativeHostV2 control model — original closed-build evidence

Built November 11 Kabul from baseline `58659d8` and seven exact inputs: six
C# sources plus the reviewed builder. [Contract and limits](../../plans/LICENSING_LIC008_STANDARD_NATIVE_LOADER_PROFILE.md).
Authoritative retained output:
`out/lic008-standard-native-control-v2-7d964d0588374195a1e87cb3a8b1a68c`.
The source-set SHA256 is
`1bc6d8d589221c1fc6e5bd19b6a5c2520565ac98bcf55d99e4c72b7455c51c2d`.

These five files are **101,186 bytes of byte-for-byte originals**, copied by
CreateNew from the retained build without JSON parsing or reserialization.
The manifest pins six source files, the builder, 167 reference files,
15 compiler files, 190 runtime files, generated closed entry, three DLLs,
runtime configuration, pure tests and 19 refused CLI shapes per variant.
Independent artifact/archive audit PASS: all seven source/snapshot originals,
375 installed tool/reference/compiler/runtime pins (374 unique file paths),
three DLLs and runtime
configurations, all 63 terminal child records, 57 refused commands and all
five archived originals were checked. No pending child record was observed.

| Original | Bytes | SHA256 |
| --- | ---: | --- |
| [build-manifest.json](build-manifest.json) | 98,573 | `3a5ed5689dace236f1daa48b52d564af418caebceb8b61a831b4e483a20d87de` |
| [source-set.json](source-set.json) | 1,410 | `1bc6d8d589221c1fc6e5bd19b6a5c2520565ac98bcf55d99e4c72b7455c51c2d` |
| [default-pure-test-report.json](default-pure-test-report.json) | 401 | `6b33ee63893c22d7cd9102ca2d008220379a2c8c45a6af61b745a10809e543b4` |
| [unrelated-defines-pure-test-report.json](unrelated-defines-pure-test-report.json) | 401 | `6b33ee63893c22d7cd9102ca2d008220379a2c8c45a6af61b745a10809e543b4` |
| [native-macro-defines-pure-test-report.json](native-macro-defines-pure-test-report.json) | 401 | `6b33ee63893c22d7cd9102ca2d008220379a2c8c45a6af61b745a10809e543b4` |

All three .NET 10 warning-as-error builds passed profile **144**, input
codec **125** and stage-store **1,011** pure checks, then each refused 19
operational CLI shapes. The third build changes only C# preprocessor symbols;
it does not compile C or test a native call. DLL SHA256 values respectively
are `6379a2c912f5e7c51beb0ddcbb585a8320f0638820d50a750d4412d886b3a45e`,
`99ccd7275923d42e2c238a41126e23c4c8ea5a73f2b6e83a333d8f910acf64bc`
and `82b6ca5a3e4b2d6c6654aa9dfebff5e42ae096a0c15001db1e18ea463147f07c`.
Byte reproducibility is not established.

The builder executed only a generated pure test entry and refused operational
arguments. No actual account, SCM, native loader, CLR bootstrap, protected
filesystem, transfer, GRANT, pipe, ACK, key or W03 comparison occurred.
All physical, loaded-code, security, production and LIC008 acceptance flags
remain false.
