# W03 suspended-launch and crypto components

Date: 2026-11-03. Source baseline: `f2bb69d`.
Status: `CLOSED_COMPONENTS_IMPLEMENTED_FULL_CONTROLLER_AND_PHYSICAL_W03_NOT_RUN`.

[W03 design](LICENSING_LIC008_STANDARD_USER_CONTROL.md) /
[Identity foundation](LICENSING_LIC008_STANDARD_IDENTITY_FOUNDATION.md) /
[Completion ledger](LICENSING_LIC008_COMPLETION_PLAN.md) /
[Closed builder](../../../scripts/build-license-standard-launch.ps1).

The owned Local/Users-only account SID1023 was last observed disabled in the
[account preparation originals](../evidence/standard-account-preparation-v1-run-20261102/README.md).
These components perform no account activation or logon through their entry
points. No W03 Setup/Guardian service, persisted machine key, account session or
protected placement has been created by this construction. The earlier actual
own-token codec query was Owner1001 only, not account1023.

## Implemented source

- [Launch plan/session](../../../licensing/adapter-evidence/standard-user-control/StandardLaunch.cs)
  and [native bindings](../../../licensing/adapter-evidence/standard-user-control/StandardNativeLaunch.cs):
  actual-credential CreateProcessWithLogonW, fixed local user/domain, logonFlags0,
  suspended/Unicode/no-window flags, explicit fixed environment and protected
  future cwd. Returned handles/IDs stay on the rooted creating lease. The exact
  creating plan/guard cannot be substituted by a second attempt. Independently
  read token/PID/start/image twice before a single resume; only previous suspend
  count1 admits running. Timeout, guard/query/resume failure retains unresolved
  ownership. Exit requires a signalled wait and exit code on the same handle.
  No terminate, retry, PID adoption, profile load or desktop ACL change exists.
- [Credential lifetime](../../../licensing/adapter-evidence/standard-user-control/StandardCredential.cs):
  read-only SecureString snapshot, length1..127, no managed password string,
  reject embedded NUL, clear every allocated UTF16 cell including the terminator,
  then length-based ZeroFreeBSTR in finally. Fake-memory tests cover full erasure
  after NUL/read/callback failure and concurrent mutation of the caller's string.
  These tests use public fixtures, never the owner's password.
- [Comparison model](../../../licensing/adapter-evidence/standard-user-control/StandardCryptoComparison.cs):
  four distinct stages and externally collected process/report proofs, exact
  account/scope/host/boot/package/runtime bindings, six original key-journal
  records, immutable key/descriptor/public/envelope identities and chronology.
  Both keys require Machine Software KSP RSA3072/decrypt usage1/export policy0;
  restricted grants SYSTEM+fresh Guardian, accessible also grants exact SID1023
  GenericAll. This is a broad accessible positive control, not decrypt-only ACL.
- [Open/inspect/decrypt primitives](../../../licensing/adapter-evidence/standard-user-control/StandardNativeCrypto.cs):
  strict owner/protected DACL/public SPKI/profile readback, fixed public synthetic
  AES256-GCM/RSA-OAEP-SHA256 envelope, authenticated scope/descriptor context,
  bounded unwrap and zeroed data-key/plaintext/partial-output buffers. Actual
  persisted CNG calls are compile-only. No key creation/journal factory, private
  export, deletion, overwrite or permission setter is implemented.

[Launch tests](../../../licensing/adapter-evidence/standard-user-control/StandardLaunchTests.cs),
[credential tests](../../../licensing/adapter-evidence/standard-user-control/StandardCredentialTests.cs),
[comparison tests](../../../licensing/adapter-evidence/standard-user-control/StandardCryptoComparisonTests.cs),
[primitive tests](../../../licensing/adapter-evidence/standard-user-control/StandardNativeCryptoTests.cs).

## Interpretation and native boundaries

The model consumes typed caller-supplied metadata. It does not authenticate that
metadata or implement a collector. Only a future independently reviewed trusted
controller may supply real held-handle, custody, token and original-byte claims;
worker JSON or a fixture boolean cannot establish them.

## Verified build

[Exact original manifest and reports](../evidence/standard-user-components-v1-20261103/README.md).
Final output: `out/lic008-standard-launch-v1-7f4d359579b94ba4a8399ba6ae604e7d`.
Manifest SHA256: `d1952be2c74068cddb23575e327bb69869d14fbd8dc1a776cb9db23d07e25317`.

All three variants pass3,038 assertions (identity305/launch270/credential40/
comparison1,976/primitives447) and13 closed entries. Source review PASS;
independent artifact review PASS,858 read-only assertions. Fourteen current
sources and snapshots,3 tools,167 references,15 Roslyn files,190 runtime files,
AMD64 binaries, compile responses and exact output sets match. Default/unrelated
builds omit native bindings; compile-only build includes them but has no native
entry. Tests use synthetic in-memory crypto and injected handles only. No actual
standard-user logon, persisted CNG backend or physical W03 operation has run.

## Comparison outcomes

All five surrounding positive decrypts must succeed before interpreting the
restricted operation: Guardian both keys before and after, plus standard-user
accessible key. Missing/failed positive operations remain inconclusive without
invented inspected metadata. OPEN failure/NOT_RUN/open-only result supplies no
completed readback; INSPECT failure likewise cannot fabricate one. DECRYPT-stage
results require completed validated actual readback matching Setup.

Raw managed HResult, independently captured native status and stage remain
separate. The narrow BAD_KEYSET/access-denied observations are never a generic
CryptographicException success. BAD_KEYSET is not renamed ACCESS_DENIED or
missing-key proof. Restricted INSPECT failures are unclassified, even with a
familiar code. Open success alone does not establish decryption or private export;
successful restricted decryption remains its own unexpected observation.

The prospective service-token requirements include primary1/elevation1/default
elevationType1/System integrity, complete nonempty groups and enabled Service
Logon. Setup additionally needs its exact derived service SID. Guardian may have
its virtual SID as TokenUser without a duplicate own-SID group. V5 originals did
not record integrity/elevationType/full groups: these requirements do not expand
historical V5 evidence.

CreateProcessWithLogonW flags0 deliberately avoid profile loading and network-
credentials-only substitution. Actual local-logon rights, Secondary Logon and
desktop access remain future preflight/observed-run prerequisites. Failure never
authorizes global security-policy or window-station/desktop ACL repair. Native
launch is restricted to the admitted elevated interactive Owner, not SYSTEM.
Retained unresolved handles exist only while the owning controller lives;
serialized PID/time cannot recreate them after it exits.

## Required next complete runner

Implement the fresh protected placement and authenticated canonical plan/approval
chain; complete allowed file/runtime sets and held file custody; exact parent
account original hashes and current SID/membership/disabled-state admission;
declared account activation and return-state effects; durable fresh two-key
create-intent/owned/completion and reopen readback; fresh Setup/Guardian service
roles and original-handle process admission; authenticated bounded standard-user
IPC and protected original report collection; and full controller sequencing.

Keep native entry disabled until all of those are implemented and independently
reviewed with the exact artifacts and effects. The consumed account-preparation
approval is not reused. Any subsequent physical input needs a fresh expiry,
complete effects and the owner's manual local CONFIRM. No additional permission
is needed to continue source construction and review.

W03 actual isolation, W04/W05, LIC008/Open003, independent hardware/Windows,
TPM/NV and security/production acceptance remain open.

Primary references:
[credentialed creation](https://learn.microsoft.com/en-us/windows/win32/api/winbase/nf-winbase-createprocesswithlogonw),
[resume count](https://learn.microsoft.com/en-us/windows/win32/api/processthreadsapi/nf-processthreadsapi-resumethread),
[length-based BSTR cleanup](https://source.dot.net/System.Private.CoreLib/src/runtime/src/libraries/System.Private.CoreLib/src/System/Runtime/InteropServices/Marshal.cs.html),
[CNG decryption](https://learn.microsoft.com/en-us/windows/win32/api/ncrypt/nf-ncrypt-ncryptdecrypt).
