# LIC008 profile-backed DPAPI-NG control — 0.8.0

Date: 2026-10-04. This is the reviewed control that follows EV0111. It prepares
one isolated physical experiment; it does not select a production Guardian
identity, accept a protection adapter, or close LIC008/LIC-OPEN-003.

## Decision and reason

The next control uses two fresh services under the built-in `LocalService`
account. Windows documents that SCM loads the user profile for a service user
account. This gives the experiment a profile-backed identity without creating a
local user, storing a new password, joining a domain, or changing the retained
ComparisonV1 Guardian. The control is deliberately separate from the retained
key namespace and from all product services.

`LOCAL=user` is only a positive comparison. Both services share the same base
account, so successful peer decryption proves that descriptor is too broad for
production. The candidate is `SID=<exact Owner service SID>`. Acceptance of the
control requires all of the following in one run:

1. Owner and Peer run as `S-1-5-19` and each token contains its exact enabled,
   non-deny-only service SID.
2. Owner protects and immediately unprotects independent random 32-byte values
   with `LOCAL=user` and its exact service-SID descriptor.
3. Peer opens the `LOCAL=user` blob but is refused on the exact Owner-SID blob.
4. A fresh Owner process opens both blobs and matches owner-only hashes.
5. Every plaintext/decoded buffer is zeroed; no plaintext is persisted.

Even a complete result is diagnostic evidence only. It shows whether an existing
profile-backed base identity plus a service SID can separate DPAPI-NG consumers
on this host. A production decision still needs identity privilege review,
the full Windows support matrix plus reboot/repair tests, independent security review, and an exact
Installer/Guardian lifecycle. A dedicated local account or domain gMSA is not an
automatic fallback; either requires its own password/domain/operations review.

## Mutation and retention boundary

- Fresh root: `%ProgramData%\Ecs.Lic008.ProfileV1`.
- Fresh services: `Ecs.Lic008.ProfileV1.Owner` and `.Peer`, Manual start,
  `NT AUTHORITY\LocalService`, unrestricted service SID.
- No user/profile creation, profile loading API, password, `LOCAL=machine`, key,
  CNG ACL, TPM, database, K40, retained ComparisonV1 or production mutation.
- The shared directory is writable only by the two service SIDs; the owner hash
  and report directory excludes Peer. Administrators and SYSTEM retain control.
- A failed or incomplete run is retained and must not be rerun. Services are
  stopped; the report records their final configuration for reconciliation.

## Prepared package — EV0112

Source is in `licensing/windows-spike/profile-control/` and the controller in
`licensing/windows-spike/profile-control-kit/`. Build command:

`powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/build-license-windows-profile-control.ps1`

Final archive:
`out/lic008-profile-control-deb162fe6c634970823f7f13f27d705c/licensing-windows-profile-control-0.8.0.zip`

- ZIP SHA256: `7ba9c0a561ad2c0ba792bb386ec0b01a3c1237398fee2615c8b4b0fd0dc54b2d`
- Manifest SHA256: `efbb2295ed8ea537b30cde5851be25f0a068cced0f33d0a221b28ff534ff9a63`
- Executable SHA256: `12f1dfd8cbbc51126668a32ad19ec28cad0fb90e64b9ea761b81d15b49e9cb0a`
- SDK/runtime: 10.0.400 / 10.0.11, self-contained win-x64.
- Pure executable guards: 14/14; package/static/controller parser guards PASS.

The initial compile failed because the linked native adapter requires the shared
stage wrapper; the wrapper was added and the full build passed. A first passing
package was then rejected during source review because service SIDs were resolved
before service creation and root plan-read access was incomplete. The ordering
and read-only ACL were corrected, a permanent ordering guard was added, and the
package was rebuilt. Final review then made profile/HKU observations mandatory
and separated blob-read failure from a genuine exact-SID unprotect refusal. A
static-guard placement error failed the next build and was corrected before the
final package above was rebuilt from scratch. All earlier output directories are
superseded and are not execution candidates.

### Physical0.8.0 bootstrap failure — EV0113

The user executed the exact0.8.0 package once. It stopped in the first root ACL
application because `FileSystemAccessRule` treated string SIDs as account names
and could not translate them. No service was created and no binary, plan, role
report, blob, hash or DPAPI operation exists. The retained root contains only the
five expected empty directories and summary
`profile-control-524936c2734d48b4bc4ea402946842ec.json`, SHA256
`f2cc9958914a568b59ea391a75a6c94f1c740beb9586aed592ec62e83fb59ff7`.
It records both services ABSENT and all acceptance flags false. Do not rerun0.8.0.

### Corrected retained-state continuation — EV0114

Version0.8.1 constructs every ACL identity as an explicit
`SecurityIdentifier`. Its `-ResumeFailedAclBootstrap` path requires the exact
EV0113 report hash/content, exact five empty directories, no extra root entries
and both service names absent. A new permanent fixture applies the ACL and proves
SYSTEM, Administrators and LocalService SIDs are present before packaging.

Prepared archive:
`out/lic008-profile-control-b03042142b3b4629be7e0af9958c0ee6/licensing-windows-profile-control-0.8.1.zip`

- ZIP SHA256: `b8cc5949305d348596bd93a044a91a72ef9e958c7167e4108a9f662c3f8a54be`
- Manifest SHA256: `c203f419e43d643ad206fba2d364d12cfa72eb6e5a8a8da7f86db2af6897922c`
- Executable SHA256: `12f1dfd8cbbc51126668a32ad19ec28cad0fb90e64b9ea761b81d15b49e9cb0a`
- Pure14/14 and package/static/parser/real SID-ACL fixture guards PASS.

Physical0.8.1 execution is **NOT_RUN**. Only this exact continuation package may
resume the retained EV0113 state; any new failure must again be retained.

### Physical0.8.1 copy-bootstrap failure — EV0115

The user executed the exact0.8.1 continuation once. ACL application and creation
of both Manual LocalService services succeeded. Before copying the first binary,
Windows PowerShell5.1 rejected the three-positional-argument `Join-Path` call and
named `clretwrc.dll` as the unbound argument. Both services remain Stopped with
the exact expected executable paths. Because copy never invoked, all five data/
binary/report directories remain empty; no plan, role report, blob/hash, service
start or DPAPI operation occurred. The new summary is
`profile-control-e096e3b29f80470d8a473fe7c60b9eba.json`; its protected ACL is
why the unelevated reconciliation can see the services but cannot read the root.
Do not rerun0.8.1.

### Corrected copy continuation — EV0116

Version0.8.2 uses nested two-argument `Join-Path`, with a permanent source guard
against the PowerShell5-incompatible form. Its resume path requires both exact
report names, pins the original EV0113 digest, validates the0.8.1 summary fields,
requires the exact empty inventory and verifies both stopped Manual LocalService
configurations and paths. It does not recreate the services.

Prepared archive:
`out/lic008-profile-control-cad66e2b8b8b43e888f1a2b44076eed0/licensing-windows-profile-control-0.8.2.zip`

- ZIP SHA256: `baf0a827f68b227e9dd9cd8a8bc7a4d0365d615e5d7675c42f606c3a00367922`
- Manifest SHA256: `04be66db87a7d665c98285fdb701351c0405ac41cff8b32f25407997da5dfd6e`
- Executable SHA256: `12f1dfd8cbbc51126668a32ad19ec28cad0fb90e64b9ea761b81d15b49e9cb0a`
- Pure14/14 and package/static/parser/ACL fixture/PowerShell5 path guards PASS.

Physical0.8.2 execution is **NOT_RUN**. Only `-ResumeFailedCopyBootstrap` may
continue this retained state.

### Physical profile-control result — EV0117

The exact0.8.2 continuation completed all three service rounds and correctly
reported `controlComplete=false`. Owner and Peer both ran as LocalService
(`S-1-5-19`) with their distinct enabled service SIDs (attributes14). In every
round `USERPROFILE` and SpecialFolder were
`C:\WINDOWS\ServiceProfiles\LocalService`, and the LocalService HKU hive was
loaded. This proves the intended profile-backed positive environment existed.

Owner successfully protected, immediately unprotected and persisted the random
`LOCAL=user` test blob. Peer, under the same base account but a distinct service
SID, also decrypted it (`PASS_SHARED_ACCOUNT_CONTROL_OPENED`), proving that
`LOCAL=user` is too broad for production Guardian isolation. Fresh Owner later
reopened that same blob successfully.

The exact `SID=<Owner service SID>` descriptor reached `NCryptProtectSecret` but
failed with `CryptographicException:0x80090034`. Consequently no exact-SID blob
was published; Peer and fresh Owner correctly reported missing-blob prerequisite,
not a denial or restart result. This is not a harness failure and must not be
rerun. It rejects both tested DPAPI-NG choices for this standalone host:

- exact service SID: unavailable even with a loaded profile;
- `LOCAL=user` under shared LocalService: functional but not isolated.

Report: `profile-control-e0ceb2bf81d4460ab901a441bb264d2f.json`.
Both services finish Stopped. `securityAccepted`, `policyChanged` and
`productionAccepted` remain false. The report transcript supplied by the operator
has SHA256 `61a55fc856f1e65f57bdfc068d150bd7c3cb2c4f27b1ad099d8e3e9b11b765d1`;
this is not asserted as the protected report file's digest.

Do not retry this profile control. The Product Owner fixed the required coverage
in [WINDOWS_SUPPORT_MATRIX.md](../../operations/WINDOWS_SUPPORT_MATRIX.md) and then selected the
distinct non-exportable Software-KSP wrapping-key direction instead of a
dedicated local account. The existing ECDSA signing key remains signing-only.
The next mutation, after review, is a fresh isolated harness defined in
[LICENSING_SOFTWARE_KSP_WRAPPING_DESIGN.md](../design/LICENSING_SOFTWARE_KSP_WRAPPING_DESIGN.md),
not a continuation of ProfileV1 or ComparisonV1.
