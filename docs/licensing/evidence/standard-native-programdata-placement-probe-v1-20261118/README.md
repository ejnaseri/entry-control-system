# W03 ProgramData sibling placement diagnostic — exact original evidence

The third, reviewed attempt ran once on November 18 Kabul from
`out/lic008-programdata-placement-probe-v1-d0fb418dd1f044b6870a4084add43171`.
It created only the separate fixture
`C:\ProgramData\Ecs.Lic008.StandardNativeHostPlacementProbeV1.d0fb418dd1f044b6870a4084add43171`.
The canonical W03 root `C:\ProgramData\Ecs.Lic008.StandardNativeHostV1`
remained absent. The first two compile-only preparations (`9c89…` and
`6f9f…`) remain retained in `out/` and were never invoked.
[Scope and remaining W03 gates](../../plans/LICENSING_LIC008_STANDARD_NATIVE_LOADER_PROFILE.md).

The source, preparation script and invocation script SHA256 values are
`7101b0fa0c8cf5862bca4de624205eea75e58697994191d57e2ea553872f24c0`,
`8b1b2dfc18aacb93f206f076706bc698a4639ae41b37a7bf3a892c0f0c2b1dc6`
and `2aaf9d3819870aefaf0bebf28eac5601f1bf85842ecce3c4d0c186761ef8fdab`.
The separately reviewed preparation manifest SHA256 is
`c282a1dfc2b3b3b14a334800a3469b88a1f87a4a3a1fbe86a660a5da0db3f631`.
Its 14 source/build/script pins matched the actual bytes before invocation;
the compile child exited 0. The exact one-use invocation child exited 0,
with terminal status `FEASIBILITY_OBSERVED`, no journal/validation error and
no pending child.

The **32 byte-for-byte originals total 27,478 bytes** and were copied with
CreateNew, without JSON reserialization. [INDEX.sha256](INDEX.sha256) lists
every filename and SHA256; its own SHA256 is
`c3aa33e2db448f48ce6e985d16cf519674e3e827299860a2cf44bdac3876657f`.
The originals include the manifest, compile and invoke intent/started/result,
probe intent/result, seven intent/native/observed step triples, and the two
actual fixed files. The ignored output and physical sibling fixture remain
retained; this consumed attempt must not be invoked again or deleted as an
implicit cleanup.

| Key original | SHA256 |
| --- | --- |
| [prepare-manifest.json](prepare-manifest.json) | `c282a1dfc2b3b3b14a334800a3469b88a1f87a4a3a1fbe86a660a5da0db3f631` |
| [invoke.result.json](invoke.result.json) | `55a89a9f9af515bfb1e92ab829c54b375a451682f972b9b26fc43deeb1c6e91e` |
| [probe-intent.json](probe-intent.json) | `171c47a2a683f5a90b1bb6b9ab9669669f68ddb7c9836d711978c05d9e84f912` |
| [probe-result.json](probe-result.json) | `2877818992f1b1c13bb17b41c50bbd3f5b8452c0cd857a7010ee51d8feae0a0b` |
| [stage-exact.bin](stage-exact.bin) | `ae0bce90f41835fe571c08d89f61ccda09248b6694970226c9384ac8557f5fb5` |
| [journal-exact.bin](journal-exact.bin) | `60dbf189ff0cbf181e28887e5ffe4d963ce7302a3a36f25aa2df9c536a3d39c9` |

The current Owner token created five directories: fixture root, `records`,
record attempt, `stage` and `journal`, followed by one fixed file in each of
`stage` and `journal`. Nine observed objects had distinct full 128-bit file
IDs on one volume; the new seven had Owner SID ending `1001`, Owner+SYSTEM
full-access protected DACLs, exact paths and no reparse/offline attribute.
Both files matched their exact 28- and 30-byte content. The account
`EcsLic008W03V1` remained disabled. The probe source contains no account,
service or key API; false effect flags are scoped source claims, not a global
system-state inventory.

An independent read-only native audit reopened all nine live objects and
matched their final path, full ID, volume, type, attributes, creation time,
length and raw security descriptor to the report. It found exactly the seven
new entries under the fixture, and the pinned terminal validator passed again
without starting the probe. Filesystem last-write timestamps were not used
as a causal-order proof; the retained step journals record the call sequence.

This is one-host directory/file placement feasibility for a separate fixture.
It does not execute the compile-only V3 reservation sink or show that its
later read-only parent handles can create children. It does not establish the
actual W03 ancestor ACL policy, continuous protected custody, directory-entry
crash durability, standard-user denial, full W03 runner or LIC008/Open003
acceptance. All authority and acceptance flags remain false.
