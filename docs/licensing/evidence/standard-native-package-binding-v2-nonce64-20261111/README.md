# W03 NativeHostV2 nonce64 correction — original closed-build evidence

Built November 11 Kabul from baseline `96205fe34a75238fcea6eb85e12d0b736a7306f8`.
The corrected stage store accepts the 64-character lowercase-hex nonce
required by the plan's service-start grammar and native loader; a 32-character
nonce now explicitly refuses. [Contract, limits and historical build](../../plans/LICENSING_LIC008_STANDARD_NATIVE_LOADER_PROFILE.md).
Authoritative retained output:
`out/lic008-standard-native-package-binding-v2-7e6e79bdeb4b4f1284d291ecca5641ff`.
The reviewed nine-input source-set SHA256 is
`0473a1c1fb42fc01ed0335a44b9ee02fe92df5546c3f167e3563191e5b9bd4cd`.
The corrected store source/test and updated builder SHA256 values are
`10db02dc8aedaa8c2841622bb7d87f3353be214798713c018edc5198d31c3125`,
`c21f628ba8d7f9c383b376f7c6525ae7c8ad6238a77a6bc165473f5a5b139eb3`
and `64f92f2908b83d9b1f6e8c3d1b3dd130acd284bcb91ab8c8cf132d549692c4c2`.

These five files are **102,683 bytes of byte-for-byte originals**, copied by
CreateNew from the fresh build without parsing or reserialization. Independent
source, artifact and archive reviews PASS: nine live/snapshot source originals,
375 installed pins (374 unique paths), three pinned installed-set digests,
three DLLs/configurations/response files, 63 terminal child streams/records,
57 exact refused commands, 336 expected output files and no pending child.
All 16 manifest and 11 pure-report authority/effect flags remain false.

| Original | Bytes | SHA256 |
| --- | ---: | --- |
| [build-manifest.json](build-manifest.json) | 99,387 | `8ba274c7124982cf275c256e9e0afce1e28ef3f844158e358b1916259124679e` |
| [source-set.json](source-set.json) | 1,805 | `0473a1c1fb42fc01ed0335a44b9ee02fe92df5546c3f167e3563191e5b9bd4cd` |
| [default-pure-test-report.json](default-pure-test-report.json) | 497 | `d727f02bd620593ce2055ee9d9eda5eb6ea87b63343ea3403977e59d2183713c` |
| [unrelated-defines-pure-test-report.json](unrelated-defines-pure-test-report.json) | 497 | `d727f02bd620593ce2055ee9d9eda5eb6ea87b63343ea3403977e59d2183713c` |
| [native-macro-defines-pure-test-report.json](native-macro-defines-pure-test-report.json) | 497 | `d727f02bd620593ce2055ee9d9eda5eb6ea87b63343ea3403977e59d2183713c` |

Each .NET 10 warning-as-error variant passed profile **144**, input codec
**125**, corrected stage store **1,020** and package binder **700** pure checks,
then refused 19 operational CLI shapes. The DLL SHA256 values in
default/unrelated-defines/native-macro-defines order are
`50cf861200616d65d6cf2d19feafd8e7106f820227d39d4bc363d31f8ffaa0ea`,
`fb4819fbaa247517b4633a8ba698e316f9faed8a09b47896d8c7f3f34f1c5f8e`
and `65449f2400d721eaab8c8b2f5812de382acac7d79560843ae8d0b3d8bf9d4cad`.
The third variant changes C# symbols only; no native call was made. Byte
reproducibility is not established.

The [prior closed package build](../standard-native-package-binding-v2-20261111/README.md)
and 1,011-check stage-store reports remain immutable historical evidence;
they are superseded for service-start integration by this correction. This
build still uses synthetic injected bytes and unsigned approval. Owner/User
pre-CLR run/nonce sourcing and physical protected custody remain unresolved.
No account, SCM, native loader, CLR bootstrap, transfer, persisted key or W03
comparison ran. Physical W03, LIC008/Open003 and security/production acceptance
remain open.
