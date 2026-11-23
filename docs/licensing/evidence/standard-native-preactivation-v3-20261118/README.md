# W03 V3 preactivation prefix model — closed evidence

Built November 18 Kabul from baseline `117cedd1c2dea418e7eaecb239021fd2b70c5df6`.
The independently reconstructed 21-input source-set SHA256 is
`052fdcc3fa0fe569d0eceaf920342dc301e2a96f6bccfcd5becf06e87103d6bf`.
The retained fresh output is
`out/lic008-standard-native-package-binding-v2-3fd5c25e35124ea39045ab5e4c68e6a0`.
[Contract and limits](../../plans/LICENSING_LIC008_STANDARD_NATIVE_LOADER_PROFILE.md).

These five files are **110,448 bytes of byte-for-byte originals**, copied
from the final output with CreateNew and no JSON reserialization. Independent
source/artifact audit passed for all 21 live/snapshot inputs, 375 installed
pins, three DLL/config/response/report sets, 66 terminal child records, 60
exact refusals, no pending child and all five byte-equal originals.

| Original | Bytes | SHA256 |
| --- | ---: | --- |
| [build-manifest.json](build-manifest.json) | 104,267 | `6dcd71e2dd99e8991bad6ea70758c176ee4b3b6f6b636b6a36bd37749217cd15` |
| [source-set.json](source-set.json) | 4,074 | `052fdcc3fa0fe569d0eceaf920342dc301e2a96f6bccfcd5becf06e87103d6bf` |
| [default-pure-test-report.json](default-pure-test-report.json) | 703 | `d53f6fad443834a5ce0e726623f7aeb0bb60f6a8c8b2326eabb3ac692dcecaeb` |
| [unrelated-defines-pure-test-report.json](unrelated-defines-pure-test-report.json) | 703 | `d53f6fad443834a5ce0e726623f7aeb0bb60f6a8c8b2326eabb3ac692dcecaeb` |
| [native-macro-defines-pure-test-report.json](native-macro-defines-pure-test-report.json) | 701 | `5bbec8ee033a06a2859f817a7db85f3acf4d8e42c106d0fde70126068dc706cd` |

Each warning-as-error .NET 10 variant passed profile **144**, input codec
**134**, V2 stage store **1,020**, package binder **700**, User intent **187**,
origin lease **82**, V3 reservation **145**, independent reservation parser
**41** and V3 preactivation prefix **313** checks. Each refused **20**
operational CLI shapes. The three DLL SHA256 values in table order are
`89a7aa435913ed118377ffda6e4240ee91f1b8b54cc106dcec05eadc5f3f56c8`,
`a3db5d348aa036df62e535d3aee2fafec1e79cdb6f431767961d73ea545fee69`
and `e1c6fd26d6614e45aedc73452f82dca44a53969b677b27398abc2a9605e79bac`.
Byte reproducibility is not established.

`NativeHostTranscriptShapeV3` names 69 ordered slots. The new model checks
only slots 41–43: a supplied canonical User intent, a supplied exact launch
reservation and an injected Owner-only `AccountActivationIntent` proposal. It
checks pairwise full file IDs, protected ACL assertions, causal creation/write
times, exact cross-original bindings and final rereads. It uses no account API.
Slots 0–40 and 44–68 have no V3 physical transcript; V2 receipts do not
become V3 predecessors. The backend, OS token and file facts are supplied
assertions, and the model does not establish protected custody or crash
durability. No account activation, User launch, SCM, CLR or persisted-key
operation ran. Every effect, physical, security, production and LIC008 flag
remains false.
