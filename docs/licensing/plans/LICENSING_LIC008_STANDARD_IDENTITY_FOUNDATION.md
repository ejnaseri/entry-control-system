# W03 process-token identity foundation

Date: 2026-11-02. Source baseline: `d6f9e6a`.
Status: `SOURCE_ARTIFACT_AND_OWN_TOKEN_CODEC_PASS_REAL_STANDARD_LOGON_AND_CRYPTO_NOT_RUN`.

[W03 design](LICENSING_LIC008_STANDARD_USER_CONTROL.md) /
[Owned disabled account](../evidence/standard-account-preparation-v1-run-20261102/README.md) /
[Exact original reports](../evidence/standard-identity-foundation-v1-20261102/README.md) /
[Source](../../../licensing/adapter-evidence/standard-user-control/StandardIdentity.cs) /
[Native reader](../../../licensing/adapter-evidence/standard-user-control/StandardTokenReader.cs) /
[Tests](../../../licensing/adapter-evidence/standard-user-control/StandardIdentityTests.cs) /
[Builder](../../../scripts/build-license-standard-identity.ps1)

This is the identity component only. It implements no account activation,
credentialed launch, process resume/termination, service, CNG, crypto controller
or protected-store operation. Existing W03 account1023 remains disabled and was
not used by the native diagnostic. No W03 isolation or acceptance closure follows.

## Admission and bounded native codec

The token contract requires exact owned SID1023 as user/owner, primary1,
elevation0, elevationType1, integrityS-1-16-8192, no filtering/restrictions or
AppContainer, complete group capture, enabled/non-deny-only Interactive and Users
groups, and complete absence of Administrators SID regardless of flags. Duplicate,
malformed or incomplete groups refuse. A filtered Admin cannot pass simply
because WindowsPrincipal.IsInRole ignores its deny-only Administrators group.

The reader accepts a caller-held process handle and records PID, creation
FILETIME, full image path and queried primary token. It rejects capture-thread
impersonation and pins Windows x64/.NET10.0.11. Variable token buffers are bounded
to1MiB, group count1024, header8/stride16; token-user/owner/integrity SID data
must follow their16/8/16-byte headers. SID pointers/lengths/revision/count and
canonical strings are checked before consumption. Scalar Type8/ElevationType18/
Elevation20/AppContainer29 use exact initialized four-byte reads; kind27 is
MandatoryPolicy and is refused. HasRestrictions21 accepts only initialized
one-byte or four-byte0/1, matching the previous host observation.

The numeric information classes follow Microsoft's
[TOKEN_INFORMATION_CLASS](https://learn.microsoft.com/en-us/windows/win32/api/winnt/ne-winnt-token_information_class)
and the read operation follows [GetTokenInformation](https://learn.microsoft.com/en-us/windows/win32/api/securitybaseapi/nf-securitybaseapi-gettokeninformation).
This codec does not establish image-file hash/custody, suspended-launch admission,
actual process completion, report authenticity or a crypto comparison. Those
remain separate controller obligations; self-reported token JSON is insufficient.

## Closed construction and actual own-token result

The default and unrelated capability builds expose only self-test. A distinct
READ_ONLY_STANDARD_TOKEN_DIAGNOSTIC_V1 build additionally exposes the exact
inspect-own-token route; no foreign-process ID is accepted. Every other entry
stays closed, including proposed future physical capability symbols.

Each variant passes305 pure assertions, including filtered/deny-only Admin,
required-group combinations, scalar values/length/no-write faults, SID pointer/
table boundaries and malformed restriction data. Default/unrelated/readonly
closed-entry counts are10/10/9. The builder invokes pure/closed routes only.

Final output: `out/lic008-standard-identity-v1-3b45c86943864677be92e9669883d805`.

Manifest SHA256: `e9c391c717ec172140e710e3b3a4a20a1ea924f2d1114a0e7150a99cd84e209b`.

Source-set SHA256: `186db54d0eddeb497141a92d3b4fab7a083e04f9611d8aa3ff0c8586c5b18f0d`.

Independent source/artifact review PASS:812 read-only assertions verify5 current
sources/snapshots,3 tools,167 references,15 Roslyn root files,190 runtime files,
all3 AMD64 DLL/runtimeconfig/report/response-file sets and exact installed sets.

After that review, one separate readonly route actually queried the current
Owner1001 process at14:19:02UTC. PID18728 and creation FILETIME134381027423931637
match the independently held launch process; exit0 was observed. Complete native
token data: primary1/elev0/elevationType3/IL8192/restrictions true/AppContainer
false,14 unique groups, Administrators attrs16, Users and Interactive attrs7.
Its actual refusal is WRONG_ACCOUNT, before subsequent token-shape predicates;
do not claim a runtime Admin-specific refusal or standard-account run. Those
Admin rejection cases are pure fixtures. Independent offline capture review
PASS,60 assertions. No account/service/key/logon operation ran.

## Remaining implementation

The full controller still needs exact parent account-owned/complete byte pins,
fresh scope/Setup/Guardian/key/ACL/session bindings, credentialed process creation,
independent actual standard-token/image admission before any probe, held-handle
exit, protected bounded report custody, positive/restricted controls and Guardian
rechecks. No account activation or logon is authorized by the consumed account-
preparation input or by this read-only diagnostic route.

The intended launch must use actual credentials and a returned process handle;
[CreateProcessWithLogonW](https://learn.microsoft.com/en-us/windows/win32/api/winbase/nf-winbase-createprocesswithlogonw)
and [CREATE_SUSPENDED](https://learn.microsoft.com/en-us/windows/win32/procthread/process-creation-flags)
are design references, not implemented launch evidence. Do not substitute network-
credentials-only logon, a restricted duplicate or filtered Owner token. Final
profile/environment, IPC, account activation/return-state and failure-retention
effects require a concrete complete runner review before live owner CONFIRM.

Full W03/LIC008/Open003, W04/W05, TPM/NV, independent Windows/hardware and
security/production acceptance remain open.
