# W03 V3 User reservation and compile-only Windows origin — closed evidence

Built November 18 Kabul from baseline `e09a5a91eb6e466b58bbd140a607941776aa0792`.
The independently reconstructed 16-input source-set SHA256 is
`c8d754972a168b17b2404e4a7673e403009547cec6f109875a1c562bc6fdef98`.
The retained fresh output is
`out/lic008-standard-native-package-binding-v2-39c14a3caf1c45638deb499a8bf39226`.
[Contract and limits](../../plans/LICENSING_LIC008_STANDARD_NATIVE_LOADER_PROFILE.md).

These five files are **107,911 bytes of byte-for-byte originals**, copied
from the final output with CreateNew and no JSON reserialization. The earlier
`out/lic008-standard-native-package-binding-v2-e89ca1a1db3b4ceebf91ff990750f4ba`
is a complete but superseded pre-fix build; it is not used for this evidence.
Independent artifact/archive audit passed for all 16 live/snapshot inputs,
375 installed pins, three DLL/config/response/report sets, 66 terminal child
records, 60 exact refusals, no pending child and all five byte-equal originals.

| Original | Bytes | SHA256 |
| --- | ---: | --- |
| [build-manifest.json](build-manifest.json) | 102,976 | `ae267129bd726ed16608f528d277b4a904d3342eb43aa1512669b8809fe181e7` |
| [source-set.json](source-set.json) | 3,118 | `c8d754972a168b17b2404e4a7673e403009547cec6f109875a1c562bc6fdef98` |
| [default-pure-test-report.json](default-pure-test-report.json) | 606 | `ab8bc67aaf640a11002043aab90d85904d690f15b8b33213f5f5c1bd10df4f11` |
| [unrelated-defines-pure-test-report.json](unrelated-defines-pure-test-report.json) | 606 | `ab8bc67aaf640a11002043aab90d85904d690f15b8b33213f5f5c1bd10df4f11` |
| [native-macro-defines-pure-test-report.json](native-macro-defines-pure-test-report.json) | 605 | `ae4cd0877fb779cc14df03bc54c72ae2ecb13e1e7d0457c56bd077a8b52a603d` |

Each warning-as-error .NET 10 variant passed profile **144**, input codec
**134**, V2 stage store **1,020**, package binder **700**, User intent **187**,
origin lease **82** and V3 stage reservation **145** checks. Each refused
**20** operational CLI shapes. The three DLL SHA256 values in table order are
`9639877f013214ec179d3bfc571bfc046c7aa3199edecda06381dfae5808ba13`,
`b2c6fe80361bb768e29167b5bdb66db3c66f7566d9ab8cb15f0839e481aa3a69`
and `f83b8f75d40f2c322c2a6e84da382b61106bc8bf3e1629378a4d1997fc7ba9c0`.
Byte reproducibility is not established.

V3 is a two-original, injected Owner-only **proposal**. It keeps V2's 68-slot
transcript intact, writes a canonical User intent original and then a
fixed-name launch-reservation original in a fake CreateNew/readback sink. It
rejects a reused name or partial history on a fresh instance sharing that
sink. Receipt identity, held-parent relative open, protected ACL and flush
are injected assertions; no durable cross-process replay proof exists. It
does not gate V2 `AccountActivationIntent` or `NativeHostUserLaunchV2`.

The Windows origin adapter compiled only in the native-macro variant. It
contains held-parent relative-open and full `FILE_ID_INFO` inspection code,
but no operational entry calls it. The origin lease still has injected guard
and ACL pins, and no live protected input or runtime custody was tested. No
account logon, SCM, native loader, CLR or persisted-key operation ran. All
effect, physical, security, production and LIC008 acceptance flags are false.
