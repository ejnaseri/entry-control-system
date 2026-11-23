# W03 V3 typed prefix-to-preactivation chain — closed evidence

Built November 18 Kabul from baseline `6e81a5e8e19878e15903eb5c3fcb3df03a6fe04e`.
The independently reconstructed 25-input source-set SHA256 is
`87ab17b4ab7dabdfa19c826970f8dcedc42fa45a845061a4284efff56102c921`.
The retained fresh output is
`out/lic008-standard-native-package-binding-v2-36415c85b4d744c69b8c867d76fcedc9`.
[Contract and limits](../../plans/LICENSING_LIC008_STANDARD_NATIVE_LOADER_PROFILE.md).

These five files contain **112,303 byte-for-byte original bytes** copied from
the fresh output with CreateNew, with no JSON reserialization. An independent
read-only audit matched all 25 live and 25 snapshot source pins, 375 installed
pins, manifest, DLLs and reports, then compared all five archived originals
byte-for-byte against the output. The closed build has three .NET 10
warning-as-error variants, 66 terminal child records, 60 exact operational
refusals, and no pending child.

| Original | Bytes | SHA256 |
| --- | ---: | --- |
| [build-manifest.json](build-manifest.json) | 105,215 | `ada1cb2b22a0edf0d9128ef92c4e2e2fb08e3280b5926999826d24f1b512ed5f` |
| [source-set.json](source-set.json) | 4,828 | `87ab17b4ab7dabdfa19c826970f8dcedc42fa45a845061a4284efff56102c921` |
| [default-pure-test-report.json](default-pure-test-report.json) | 754 | `64aa2b66bb90b1491c25e4d322f39c333c30eab9cfd02cfa96717e8aa84ead3a` |
| [unrelated-defines-pure-test-report.json](unrelated-defines-pure-test-report.json) | 754 | `64aa2b66bb90b1491c25e4d322f39c333c30eab9cfd02cfa96717e8aa84ead3a` |
| [native-macro-defines-pure-test-report.json](native-macro-defines-pure-test-report.json) | 752 | `e64f7e2183c9d8cd6c5af88c45619b081c864eb2721a92c77eed30f4400cb489` |

Each variant passed profile **144**, input codec **134**, V2 store **1,020**,
package **700**, V2 User intent **187**, origin lease **82**, V3 reservation
writer **157**, reservation original reader **44**, preactivation **331**,
V3 prefix **106**, and V3 typed User intent **76** checks, totaling **2,981**
per variant. Each refused 20
operational CLI shapes. The three DLL SHA256 values in variant order are
`1885cecb48d7da9ee419892a44a39cbb12de0d2f41f36b3efd68757ef98b87e6`,
`995472de11d57fdb28d2524cc922d7b88161606a6a9107fcdedefec3cb4520e3`,
and `f858acb02357dc4fbc6ccd8587862235628a5f5ad`.
Byte reproducibility is not established.

The pure prefix reader checks injected directory and original observations
for slots 0–40 and returns a typed slot-40 seal that includes the verified
`stage` directory identity. The V3 intent, reservation writer, independent
reservation reader, and preactivation model now require that seal and reject
V2 intent bytes. Their injected tests bind slots 41–43 to the slot-40 original,
including exact stage/journal parent IDs, chronology, and final rereads.
The Windows reservation sink compiles in the native-macro variant and checks
held attempt, stage, and journal directory IDs before creation. It does not
hold or reread the physical slot-40 original and has no operational CLI.

These are injected claims and compile-only source checks. No physical W03
transcript or protected root, account activation/logon, User process, SCM,
CLR, persisted-key operation, or standard-user denial was exercised.
Physical durability, historical authorship, cross-process custody,
security acceptance, production acceptance, and LIC008 closure remain false.
