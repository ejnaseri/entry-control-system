# W03 native loader pre-CLR role shape — original closed-build evidence

Built November 11 Kabul from baseline `81d9f6412aebc2e2fdba2c373b1aad2e775d8ab7`.
Owner stage 0 now requires wholly zero run/nonce buffers; User, Setup and
Guardian require exact lowercase-hex 32/64 values. [Contract and limits](../../plans/LICENSING_LIC008_STANDARD_NATIVE_LOADER_PROFILE.md).

Authoritative retained output:
`out/lic008-standard-native-loader-v1-5cb9586a8cc04ae7aca1c76ea1c63930`.
The independently reconstructed six-input source-set SHA256 is
`e65308c647b5990384c1597d8a4a80bdf9fd9655f846bb4eafd2aef12fe87eb3`.

These eight files are **34,871 bytes of byte-for-byte originals**, copied by
CreateNew from the fresh final output without reserializing JSON. The manifest
pins the six source inputs, two installed hostfxr headers, 19,520-file Zig
toolchain, three PE hashes/import lists, compiler and self-test records, and
20 refused operational CLI forms per variant.
Independent artifact/archive review passed six live/snapshot source pins, both
header pins, the verified toolchain tree, all three PE/import sets, 66
terminal child records with zero pending, and byte equality of all eight
archived originals.

| Original | Bytes | SHA256 |
| --- | ---: | --- |
| [build-manifest.json](build-manifest.json) | 28,266 | `0b0a5df8bbd23ef2bff056e3d20107aaa083ef8094590873d1c2827e6d5fad7d` |
| [source-set.json](source-set.json) | 1,173 | `e65308c647b5990384c1597d8a4a80bdf9fd9655f846bb4eafd2aef12fe87eb3` |
| [default-pure-test-report.json](default-pure-test-report.json) | 302 | `2422a7613f45787ac9d4fa3b4a8cb568255bc912613d723b7240b1fd727268c1` |
| [unrelated-defines-pure-test-report.json](unrelated-defines-pure-test-report.json) | 302 | `2422a7613f45787ac9d4fa3b4a8cb568255bc912613d723b7240b1fd727268c1` |
| [compile-only-native-pure-test-report.json](compile-only-native-pure-test-report.json) | 302 | `fd3f8a790ec26242673af4494fcfb034f24b053d9d2c3c95063e3da61d960837` |
| [default-pe-imports.json](default-pe-imports.json) | 1,483 | `4b6af95470168ebb483c5b3beb3dfe774f821cea8090f6963f575ba191254820` |
| [unrelated-defines-pe-imports.json](unrelated-defines-pe-imports.json) | 1,484 | `48b41ac7462c806648cbed4e4d5a2e72701dbb6e51bacca061b531fc4cb2888a` |
| [compile-only-native-pe-imports.json](compile-only-native-pe-imports.json) | 1,559 | `aff8915c288f46436b303cbd68dd213abfa64257b4bff043c6f14ecda7226c12` |

Default and unrelated-defines passed **629** injected checks each;
compile-only-native passed **649** including 20 invalid-argument checks that
return before native calls. Each variant refused **20** operational CLI shapes,
including the new complete User invocation. The three AMD64 executable hashes
in table order are
`0347b935bfa58e5390213faec7a157b76f3717614b38565f62e9c4b6511a15eb`,
`4a6efe1f66bce33e3728891d390afd27ab900f6658b4adae8db4a40038e41364`
and `a6489cf2eedaecb3df64a38d97f0901559d16898ff59a633c8f06662511602a8`.
Byte reproducibility is not established.

Only injected tests and closed CLI refusals ran. The Windows/hostfxr adapter
was compiled but never used to load hostfxr or initialize CLR. Neither run/
nonce syntax nor a candidate package supplies one-use protected Owner intent,
live process/token/file custody or physical admission. No account, SCM,
managed entry, persisted-key or W03 comparison ran. LIC008/Open003 and
security/production acceptance remain open. The [older loader archive](../standard-native-loader-v1-20261111/README.md)
remains historical.
