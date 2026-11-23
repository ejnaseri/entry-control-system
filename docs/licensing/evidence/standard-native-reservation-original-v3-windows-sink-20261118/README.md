# W03 V3 reservation fresh reader and compile-only Windows sink — closed evidence

Built November 18 Kabul from baseline `ca86ab7e40bdf74c3eedc2303cd62270717934ac`.
The independently reconstructed 19-input source-set SHA256 is
`f65f8eb8c645f7fce91c5b809068d3d2d171298f42c0e4b0ea5242621bd3e5d5`.
The retained fresh output is
`out/lic008-standard-native-package-binding-v2-e1dffae17cbf430e962ff82466256a35`.
[Contract and limits](../../plans/LICENSING_LIC008_STANDARD_NATIVE_LOADER_PROFILE.md).

These five files are **109,524 bytes of byte-for-byte originals**, copied
from the final output with CreateNew and no JSON reserialization.
Independent artifact/archive audit passed for all 19 live/snapshot inputs,
375 installed pins, three DLL/config/response/report sets, 66 terminal child
records, 60 exact refusals, no pending child and all five byte-equal originals.

| Original | Bytes | SHA256 |
| --- | ---: | --- |
| [build-manifest.json](build-manifest.json) | 103,795 | `8255f2bc3b5647947cb8b2905d5405b4b8058416fb416cbf1948bd64dbad0b7a` |
| [source-set.json](source-set.json) | 3,697 | `f65f8eb8c645f7fce91c5b809068d3d2d171298f42c0e4b0ea5242621bd3e5d5` |
| [default-pure-test-report.json](default-pure-test-report.json) | 678 | `5c7efbbbeb70b4889ba95851ba940257001a49e02e2661283f0489c1ecbc1de7` |
| [unrelated-defines-pure-test-report.json](unrelated-defines-pure-test-report.json) | 678 | `5c7efbbbeb70b4889ba95851ba940257001a49e02e2661283f0489c1ecbc1de7` |
| [native-macro-defines-pure-test-report.json](native-macro-defines-pure-test-report.json) | 676 | `cabd449b17494cda092326556f256e708ddba5407b93e26a57f73d32f4c0bac3` |

Each warning-as-error .NET 10 variant passed profile **144**, input codec
**134**, V2 stage store **1,020**, package binder **700**, User intent **187**,
origin lease **82**, V3 stage reservation **145** and independent V3 original
parser **41** checks. Each refused **20** operational CLI shapes. The three
DLL SHA256 values in table order are
`68eae327abcda4f37ab4163f8f1c53484d1aa347213428f36b24f1251c60e918`,
`9168e9a480a4b8879d8c464fe5e03e995f422361c488e652297f532d89606fc9`
and `88297a7b3be6e1d5e1d2cd689065d3b57b11b12b1be35bcf52b6e3a923826349`.
Byte reproducibility is not established.

`NativeHostReservationOriginalV3` reparses a supplied canonical User intent
and the exact 32-property launch reservation from fresh bytes. It checks the
plan/approval, host/boot, injected Owner/worker context, command, run/nonce,
time window and false authority flags. Its inputs remain supplied assertions;
the parser does not itself obtain protected files or OS token facts.

`NativeHostReservationWindowsV3` compiled only in the closed native-macro
variant. It contains a fixed held seven-directory chain, an exact protected
Owner+SYSTEM DACL for `stage`/`journal` and both original files, definite-
absence probes, relative CreateNew, complete `FILE_ID_INFO`, retained handles,
same-handle write/flush/readback, and a reservation-byte parser call. No CLI
can construct or call it. It does not create the directories, prove ancestor
ACL policy, establish the worker's OS identity, or read a prior-process file
as an adopted reservation. Actual acceptance of the requested Owner/primary-
group descriptor and the pre-existing directory ACLs needs physical testing;
the code may fail closed. A file flush is not proof of crash-durable directory
entry. No account logon, SCM, native loader, CLR or persisted-key operation
ran. All effect, physical, security, production and LIC008 flags are false.
