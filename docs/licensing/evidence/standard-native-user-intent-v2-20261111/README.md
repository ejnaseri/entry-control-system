# W03 NativeHostV2 User intent — closed package evidence

Built November 11 Kabul from baseline `4cd5b28211fc20537da5e18dcf772976f13d4436`.
The independently reconstructed eleven-input source-set SHA256 is
`3a6370d522b237154524811c5f0edc6258ad7b2f6027da8d98788b07670ded33`.
The retained fresh output is
`out/lic008-standard-native-package-binding-v2-95fd1c54d47840bdaa8e92f976c92204`.
[Contract and limits](../../plans/LICENSING_LIC008_STANDARD_NATIVE_LOADER_PROFILE.md).

These five files are **105,467 bytes of byte-for-byte originals** copied from
the final output with CreateNew, without JSON reserialization. Each archive
file was independently compared byte-for-byte against its source. Independent
artifact review also checked 11 live/snapshot inputs, all 375 installed pins
and set digests, three DLL/config/response/report sets, 66 terminal child
records, 60 exact operational refusals and no pending child. All 16 manifest
effect/authority flags were false.

| Original | Bytes | SHA256 |
| --- | ---: | --- |
| [build-manifest.json](build-manifest.json) | 101,734 | `88b6182e9e982b210385dafaa04adace8864f94dad56948db3ba9d86a23db850` |
| [source-set.json](source-set.json) | 2,176 | `3a6370d522b237154524811c5f0edc6258ad7b2f6027da8d98788b07670ded33` |
| [default-pure-test-report.json](default-pure-test-report.json) | 519 | `d017a40e2658a535e4f22b7b5cedefc9eabc474e399a74a96cc0a3bcf43a5f91` |
| [unrelated-defines-pure-test-report.json](unrelated-defines-pure-test-report.json) | 519 | `d017a40e2658a535e4f22b7b5cedefc9eabc474e399a74a96cc0a3bcf43a5f91` |
| [native-macro-defines-pure-test-report.json](native-macro-defines-pure-test-report.json) | 519 | `d017a40e2658a535e4f22b7b5cedefc9eabc474e399a74a96cc0a3bcf43a5f91` |

Each warning-as-error .NET 10 variant passed profile **144**, input codec
**134**, stage store **1,020**, package binder **700** and User intent **187**
pure checks. Each then refused **20** operational CLI shapes, including a
complete User run32/nonce64 command. The three DLL SHA256 values in table
order are `d960fd9234cce2ba223b7a8166b155f30d665266b60a3ab1d6f80bc972b4280b`,
`40a883006c62583a2b621267cc6809f86b3754989bd94d05089d42f779e9829d`
and `534a0080df4f131cd6fd235cf01a671ad931f47a85ca46f3ae47e68afe4e6a5f`.
Byte reproducibility is not established.

The intent and held-child comparison are pure injected models. The store slot
holds a proposed digest marker, not a protected Owner-authored original or
cross-process replay authority. A new model instance can match the same
injected facts again. No account logon, SCM, native loader, CLR, persisted-key
operation or W03 comparison ran. All physical, effect, security, production
and LIC008 acceptance flags remain false.
