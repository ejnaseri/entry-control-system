# W03 native host pre-CLR role shape — original closed-build evidence

Built November 11 Kabul from baseline `81d9f6412aebc2e2fdba2c373b1aad2e775d8ab7`.
Owner invocation is argc10 with wholly zero run/nonce buffers; User is argc14
with exact lowercase-hex run32/nonce64; service invocation is argc12 with
zero buffers and separate StartService values. Guardian-after is stage4.
[Contract and limits](../../plans/LICENSING_LIC008_STANDARD_NATIVE_HOST.md).

Authoritative retained output:
`out/lic008-standard-native-host-v1-827a95f604224da6a14f860c65948b33`.
The independently reconstructed six-input source-set SHA256 is
`f8d47f0bb55af83c06226d89df8f02c48d0c72c40d136d1f4a67361c82f84da0`.

These eight files are **31,515 bytes of byte-for-byte originals**, copied by
CreateNew from the fresh final output without JSON reserialization. The
manifest pins six source files, the verified Zig compiler/tree, three AMD64
PE hashes/import lists, pure reports, and 16 refused operational CLI forms
per variant.
Independent artifact/archive review passed all six live/snapshot input pins,
the verified 19,520-file toolchain tree, three PE/import sets, 54 terminal
child records with zero pending, and byte equality of all eight originals.

| Original | Bytes | SHA256 |
| --- | ---: | --- |
| [build-manifest.json](build-manifest.json) | 24,867 | `8a73aa2eb872c51687463583db5a7a77e05aebd3ff1a564b54ec1ac54aefe9e1` |
| [source-set.json](source-set.json) | 1,152 | `f8d47f0bb55af83c06226d89df8f02c48d0c72c40d136d1f4a67361c82f84da0` |
| [default-pure-test-report.json](default-pure-test-report.json) | 299 | `11d47c56129c042968e4901fbc39b6618d6b423d3c1a08057e0267915ced5313` |
| [unrelated-defines-pure-test-report.json](unrelated-defines-pure-test-report.json) | 299 | `11d47c56129c042968e4901fbc39b6618d6b423d3c1a08057e0267915ced5313` |
| [compile-only-native-pure-test-report.json](compile-only-native-pure-test-report.json) | 299 | `11d47c56129c042968e4901fbc39b6618d6b423d3c1a08057e0267915ced5313` |
| [default-pe-imports.json](default-pe-imports.json) | 1,482 | `8a8cc023c8bcc1881598f500038c53f8361bcca85a3fb718ba3200963d7ab996` |
| [unrelated-defines-pe-imports.json](unrelated-defines-pe-imports.json) | 1,484 | `55c2ea1501f878061a51eab0fa78b1b95af7fdbd41847cb0179dbec3122b6643` |
| [compile-only-native-pe-imports.json](compile-only-native-pe-imports.json) | 1,633 | `bf857aefe8f46259212cfb94bb9a60c1abc62c4d69e4149fd122af0758645c8a` |

Each of the three warnings-as-errors native console variants passed **2,564**
injected checks and refused **16** operational CLI entries, including the
complete User invocation. The three PE hashes in table order are
`0ce042efa79745f8d9ee5261a3ff18a693f0af0535231c2560fb939a9abaa550`,
`63932fbe6846e225b3f0a0d767f619d141d726429c94deb6d6515519c16dbb3b`
and `46bd4756220248cfd4d24148e3e8311a84e28d8f2178f053a798153d7b5e4158`.
Byte reproducibility is not established.

The first fresh cold-cache build retained at
`out/lic008-standard-native-host-v1-c6b70953b383443d9467080cbbb2f381`
hit its former five-minute compiler deadline. Its unresolved Zig child ended
naturally and left an EXE, but that attempt has a pending record and no final
manifest; it is incomplete, excluded and untouched. The reviewed builder
raised only the bounded cold-cache compile deadline to 30 minutes and made
this separate final build.

Only injected tests and closed CLI refusals ran. The Windows adapter was
compiled in one variant but no native environment, SCM, hostfxr/CLR, account,
persisted-key or W03 operation ran. No protected `StandardUserIntent`, one-use
launch guard or live process/token/file custody was established. All physical,
security, production and LIC008 acceptance flags remain false. The
[older host archive](../standard-native-host-foundation-v1-20261103/README.md)
remains historical.
