# W03 V3 prefix seal and typed User intent — closed evidence

Built November 18 Kabul from baseline `10ca6c81752ac52dd131b1b6170f288091956ff2`.
The independently reconstructed 25-input source-set SHA256 is
`1976014cf360aa9b3604e14fa9bcf30014c23a88d2b23e51f8d71df03ed9ac90`.
The retained fresh output is
`out/lic008-standard-native-package-binding-v2-11980e16eb4942b1a19dd396b5afc64d`.
[Contract and limits](../../plans/LICENSING_LIC008_STANDARD_NATIVE_LOADER_PROFILE.md).

These five files are **112,296 byte-for-byte original bytes**, copied from
the final output with CreateNew and no JSON reserialization. Independent
source review passed; the output archive was checked against the original
files. The closed build has three .NET 10 warning-as-error variants, 66
terminal child records, 60 exact operational refusals and no pending child.

| Original | Bytes | SHA256 |
| --- | ---: | --- |
| [build-manifest.json](build-manifest.json) | 105,211 | `332f2ccd056a92389a18af2b7dd56f29f762f672e1b71bf6830a3b1c6142de7b` |
| [source-set.json](source-set.json) | 4,828 | `1976014cf360aa9b3604e14fa9bcf30014c23a88d2b23e51f8d71df03ed9ac90` |
| [default-pure-test-report.json](default-pure-test-report.json) | 753 | `86b278c1c1c4ea08601a75265748800cdb43cf5470c72cc19234c9aa22fd631f` |
| [unrelated-defines-pure-test-report.json](unrelated-defines-pure-test-report.json) | 753 | `86b278c1c1c4ea08601a75265748800cdb43cf5470c72cc19234c9aa22fd631f` |
| [native-macro-defines-pure-test-report.json](native-macro-defines-pure-test-report.json) | 751 | `e59b44e644c3baad21421ccefaf20f896b0f2f5beae517f3d7877cff355cd5b3` |

Each variant passed profile **144**, input codec **134**, V2 store
**1,020**, package **700**, V2 User intent **187**, origin lease **82**, V3
reservation **145**, reservation parser **41**, preactivation **313**, V3
prefix **97** and V3 typed User intent **76** checks. The three DLL SHA256
values in table order are
`2099d683ac213ce235aaf0d1131644efe62587fdc75b457f466b0be7746c6b5b`,
`2972c63d5fd227fe86cc27e6a0d9c5283a6f80b5437a4d87a56dd39b5861a513`
and `d0fbe7c5463370d306fc5f2c07e2ed1d91ec9898872d2b1b0f1ee80161ceb291`.
Byte reproducibility is not established.

`NativeHostTranscriptPrefixV3` freshly rereads 9 injected directory witnesses
and 41 injected originals for slots 0–40, validates the canonical V3 event
chain and a typed slot-40 seal, then rereads all 50 targets. The seal commits
to directory paths, full IDs, ACL hashes and 40 predecessor original receipts.
`NativeHostUserIntentV3` requires this typed seal and writes its exact slot-40
SHA in `previousSha256`; it has no V2 fallback. This intent is not yet wired
into the existing V3 reservation writer, parser, preactivation model or
Windows sink, so no continuous 0–43 operational chain is claimed. Caller-
supplied ACL pins for attempt/input/ancestors are correlation only; exact
security policy for the real protected placement remains unresolved.

All observations, source roles, evidence digests and seal contents are
injected assertions. No account activation, User launch, SCM, CLR, physical
protected-root operation or persisted-key operation ran. Every effect,
physical, security, production and LIC008 flag remains false.
