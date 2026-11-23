# W03 NativeHostV2 origin lease — closed package evidence

Built November 11 Kabul from baseline `b151e74e8b3ca82d88a2e6a369c36e230459b3c0`.
The independently reconstructed thirteen-input source-set SHA256 is
`f523cb773ce574b662aa9e501a5ba1d665873895cef6b10fc6fabbad377ba14b`.
The retained fresh output is
`out/lic008-standard-native-package-binding-v2-cbbfbad83a364ddbb75a33627d20d115`.
[Contract and limits](../../plans/LICENSING_LIC008_STANDARD_NATIVE_LOADER_PROFILE.md).

These five files are **106,362 bytes of byte-for-byte originals**, copied
from the final output with CreateNew and no JSON reserialization. Independent
review byte-compared each archive file with its source and verified 13 live/
snapshot inputs, all 375 installed pins and set digests, three DLL/config/
response/report sets, 66 terminal child records, 60 exact operational
refusals, no pending child and all authority/effect flags false.

| Original | Bytes | SHA256 |
| --- | ---: | --- |
| [build-manifest.json](build-manifest.json) | 102,190 | `c2cd939dd57883ca8dcdb93d9b6cb11cfb406912adade53a124fd578a7c3ad35` |
| [source-set.json](source-set.json) | 2,549 | `f523cb773ce574b662aa9e501a5ba1d665873895cef6b10fc6fabbad377ba14b` |
| [default-pure-test-report.json](default-pure-test-report.json) | 541 | `b062e85940c44407efde21f6ddae21ee10349fe6956d1742ec6395e92ef5ef9d` |
| [unrelated-defines-pure-test-report.json](unrelated-defines-pure-test-report.json) | 541 | `b062e85940c44407efde21f6ddae21ee10349fe6956d1742ec6395e92ef5ef9d` |
| [native-macro-defines-pure-test-report.json](native-macro-defines-pure-test-report.json) | 541 | `b062e85940c44407efde21f6ddae21ee10349fe6956d1742ec6395e92ef5ef9d` |

Each warning-as-error .NET 10 variant passed profile **144**, input codec
**134**, stage store **1,020**, package binder **700**, User intent **187**
and origin lease **82** pure checks. Each refused **20** operational CLI
shapes. The three DLL SHA256 values in table order are
`79f0cfdc2af21214dc97e8cff414e3143c6d613bce9cbd7d5dbdc31019b111d0`,
`ad26d7eb67040ca039032704489b4a6cf0ae542e4902646c084fc0ec818e4f4b`
and `bc86a43166acee8ca19230915d225acd421393fdb8869d3893427d51f55a4fc0`.
Byte reproducibility is not established.

The origin lease is an injected, bounded sequence of samples, not an atomic
filesystem snapshot or a Win32 handle claim. Its ACL digests are supplied
pins, not an authenticated protected policy. It does not cover native image,
hostfxr or runtime files, a protected Owner intent original, or durable
cross-process stage consumption. No account logon, SCM, native loader, CLR,
persisted-key operation or W03 comparison ran. All effect, physical,
security, production and LIC008 acceptance flags remain false.
