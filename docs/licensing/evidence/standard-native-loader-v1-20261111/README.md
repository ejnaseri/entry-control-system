# W03 native loader — original closed-build evidence

Built November 11 Kabul from baseline `58659d8` and six exact inputs.
[Contract and limits](../../plans/LICENSING_LIC008_STANDARD_NATIVE_LOADER_PROFILE.md).
Authoritative retained output:
`out/lic008-standard-native-loader-v1-337a6537942e4208b6efe311d4a7f0fd`.
The source-set SHA256 is
`a1c01aec091cfd5b85ffd8457e5911271eb6918b3777ba5ab0a9a36f51376e4f`.

These eight files are **32,978 bytes of byte-for-byte originals**, copied
from the retained build with CreateNew and without JSON parsing or
reserialization. The manifest pins the six source files, two installed
hostfxr headers, portable Zig compiler/tool tree, three actual PE hashes and
imports, pure test results and 19 closed CLI refusals per variant.

| Original | Bytes | SHA256 |
| --- | ---: | --- |
| [build-manifest.json](build-manifest.json) | 26,373 | `ed1454135c29b82957c70711a6d2f855c4c31b0048016c4183fb596d2f784e1a` |
| [source-set.json](source-set.json) | 1,173 | `a1c01aec091cfd5b85ffd8457e5911271eb6918b3777ba5ab0a9a36f51376e4f` |
| [default-pure-test-report.json](default-pure-test-report.json) | 302 | `95e399a5db2cdc474a9220367ec6ea4ad52b032f78d68b24450c3251158045d6` |
| [unrelated-defines-pure-test-report.json](unrelated-defines-pure-test-report.json) | 302 | `95e399a5db2cdc474a9220367ec6ea4ad52b032f78d68b24450c3251158045d6` |
| [compile-only-native-pure-test-report.json](compile-only-native-pure-test-report.json) | 302 | `3754a9c0d36cece4b2f39760ecd3b3cad4ea193ffb947ccdeca74feeb0cd71ce` |
| [default-pe-imports.json](default-pe-imports.json) | 1,483 | `c52945cfdee4e22abbdfccaabdb3508f619213c5cec7273a0994ca7e009bdc0b` |
| [unrelated-defines-pe-imports.json](unrelated-defines-pe-imports.json) | 1,484 | `cb7e9b5b17e7b2fc80bf5563787a89c88783f60b07adb42163b9f2c36df23f12` |
| [compile-only-native-pe-imports.json](compile-only-native-pe-imports.json) | 1,559 | `117d43f2680b964844c6fca5c5da65ca5096b467aec38905079c215b3be81e8a` |

All three AMD64 console builds passed the injected tests: **385**, **385**
and **405** assertions respectively. Each refused **19** operational CLI
shapes. Executable SHA256 values respectively are
`b5e214f104ebb7156004894b17422f41e894d9cf45bb8ea4ac58e6f7761761f6`,
`f030f02c61129825cd113c0d3f5554381bbf6f49c2f8697e35305057682f49bd`
and `e238f002f2fc7a91ec5280603555a15d3d6f815caf7ebb75e62a318b91e0286d`.
Byte reproducibility is not established.

Only fake injected tests and closed CLI refusal paths were executed. The
Windows/hostfxr factory was compiled into the third variant but never used
to load hostfxr or initialize CLR. No actual SCM dispatch, managed entry,
account activation/logon, key operation or W03 comparison ran. All physical,
loaded-code, security, production and LIC008 acceptance flags remain false.
The earlier cold-cache compile timeout and its later unadopted EXE remain
retained in a separate incomplete `out/` directory, with no final manifest.
