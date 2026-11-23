# W03 Owner/group ACL one-file diagnostic — original evidence

Executed once on the current laptop, November 18 Kabul, in the fresh ignored
`out/lic008-owner-group-probe-v1-94ae2d43fb7041eabf0184f12353f284`.
The reviewed diagnostic source SHA256 is
`c968189f49caa8c2cf049eb3ec8f4c5d72bc058c22972c7c44aa653e5aa95f29`;
the preparation and invocation script SHAs are
`48dad688b252c9ffacbf2ecbfd806a49159ec2aa6b69992521b199c1e11502b4`
and `21d0dc5c9ed246f253f587e7235075f653044e53451efea0587d4ae5cbcad0d5`.
[Scope and next gate](../../plans/LICENSING_LIC008_STANDARD_NATIVE_LOADER_PROFILE.md).

These ten files are **8,282 byte-for-byte original bytes**, copied from the
consumed attempt with CreateNew and no reserialization. The live attempt and
its compiled files remain under `out/`. Preparation compiled only; a separate
manifest-hash-reviewed one-use invocation ran the probe. Both child processes
exited 0, no pending journal exists, and terminal validation returned
`FEASIBILITY_OBSERVED`. Independent read-only audit checked the source and
manifest chain, exact 28-byte file, full file IDs, actual ACL bytes and
one-use timeline.

| Original | Bytes | SHA256 |
| --- | ---: | --- |
| [prepare-manifest.json](prepare-manifest.json) | 1,875 | `b2ce0513047d8da38a9846baa3e3e6f5a8004daabb1b67bb594c429ea76a190b` |
| [compile.intent.json](compile.intent.json) | 2,178 | `03899b729d987f317e4e2edb69396d5ebeec86f67c5615e443851daf661ff675` |
| [compile.started.json](compile.started.json) | 62 | `4c29763f84621421eca28b548cbd23ef670b9684ce28f31b0d323b5d9c58f197` |
| [compile.result.json](compile.result.json) | 100 | `96197877b3b9f8388beeaaa6bebd005ce3623fc3ca688029ede98b32618ec1d2` |
| [invoke.intent.json](invoke.intent.json) | 1,151 | `5fd3c48f9455aebe5f0910cbcb3d835b02aaf4e78dfd9c5ce9798cc26a28eda6` |
| [invoke.started.json](invoke.started.json) | 61 | `403db498b7a7ba35e3f50796c39ea27b1772e03d2f03a99fecd5110065d87872` |
| [invoke.result.json](invoke.result.json) | 408 | `e91cff2b8255f21b453cec13f82182e32a7ed2ac6837c9113aa02dbac51e4b6d` |
| [probe-intent.json](probe-intent.json) | 690 | `88cf523ac91600d2110a7cb60eb4ccf6ba8fc52ff29be677b5da3243ba3632eb` |
| [probe-result.json](probe-result.json) | 1,729 | `e7bb9eb6bb178eb0963d63041c76b3b46da781bc14a967e61b0d0bed7b81cc95` |
| [owner-group-exact.bin](owner-group-exact.bin) | 28 | `4cefe5718965fc79e2ab58e7bb5d79d8aeb4d54ac04ec88342ede6ed95d10f3d` |

On this Owner token, the requested descriptor and the observed descriptor
had SHA256 `c898d6215916ee60e8d48c07810cb3b680e29230c535a0e70ca9133b2a461f22`.
Both owner and group were SID ending `1001`; the protected DACL contained
only SYSTEM and that SID with full access. `NtCreateFile(FILE_CREATE)` reported
new-file information 2, and the parent and child had distinct full 128-bit
file IDs on the same volume. The source used a fixed child name in a fresh
ignored-out attempt and did not call account, service or key APIs. The false
effect flags are program-scope claims, not a global system-state inventory.
This proves one fixed-file ACL creation/observation on this host and token.
The actual W03 protected root/ancestor policy, cross-process custody, standard
account denial, crash durability, full runner and LIC008/Open003 acceptance
remain open. Do not reuse this consumed attempt.
