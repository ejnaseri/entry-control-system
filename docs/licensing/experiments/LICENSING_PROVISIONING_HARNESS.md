# LIC008 Guardian provisioning baseline — package 0.3.0

Status: current-host physical baseline executed; key finalization and DPAPI
protection failed. This is diagnostic evidence, not Windows acceptance.

Final build: `out/lic008-provisioning-308f8a26890b4c04bfd59877f2431970/licensing-windows-provisioning-0.3.0.zip`.
SHA-256: `bf9967003d8930affa17cb7976a654d36dd618e0c3f88cc7aa18210b15e95755`.
Build and31/31 pure guards plus28/28 package/controller guards passed. Earlier
same-version development archives under79753d4c9ae64cd8b6465368572a8834 and
11e16264d732471aa3054ebc3d83b148 are superseded; select this exact final digest.
Scope: the Guardian baseline in [the experiment plan](../plans/LICENSING_WINDOWS_NEXT_PLAN.md),
under the existing LIC008 entry dependency. No Setup-created key or dependency
amendment is adopted. LIC006 portable review remains complete and was not repeated.

## Implemented experiment

Source is `licensing/windows-spike/provisioning/` with a separate project and
controller in `provisioning-kit/`. The DPAPI interop implementation is linked from
the existing harness; the old installed executable is not updated. Build with
`scripts/build-license-windows-provisioning.ps1`; it pins SDK10.0.400 and
self-contained runtime10.0.11, runs guard tests and emits a ZIP/hash in `out/`.

Guardian retains the approved virtual-account identity. Native Software CNG stages
are provider open, algorithm query, machine-key creation without overwrite, export
policy, signing usage, DACL assignment before finalize, finalize and managed-handle
opening. Public-key identity/ownership publication, signing, verification and DACL
checks have separate stages. This deliberately instruments native operations;
success/failure does not retroactively identify the old managed compound error.
If this provider refuses pre-finalization ACL assignment, that exact stage remains
a failed result; the tool does not silently retry with a weaker policy.

The actual token user SID and matching service-group attributes are checked; a
present disabled/deny-only service group is rejected. Worker crypto runs separately
from the SCM callback with a100-second process deadline. Controller timeout or a
missing report means unknown outcome, never successful completion.

App and its actual child consume a per-run Guardian readiness record. Key denial
requires Guardian reopen/sign/policy verification and export refusal first; DPAPI
denial requires Guardian round-trip/reopen success and a readable ciphertext.
Missing prerequisites are skipped explicitly. Recheck starts new processes to
reopen the same key and blob, without replacing them. It is not reboot evidence.

DPAPI descriptor/protect and create-roundtrip/file publication failures carry stage
labels; separate reopen/decrypt outcome is reported. Reports include OS version,
process/token identity, executable and package-manifest hashes, run and phase,
stage/status/error codes. Manager adds domain membership. No private key, plaintext
DPAPI secret, host/user name or customer record is included.

## Exact mutation manifest for a future physical run

| Resource | Fixed scope and behavior |
| --- | --- |
| SCM | Only `Ecs.Lic008.ProvisioningV1.Guardian` and `.App`; own virtual accounts, Manual startup, unrestricted service SID. Existing names cause refusal. |
| Files | Only `%ProgramData%/Ecs.Lic008.ProvisioningV1`: immutable package copy, installation marker/plan, protected test records, shared public/ciphertext/readiness records and reports. Existing root causes refusal. |
| Directory ACLs | SYSTEM/Administrators manage root/bin; services get traversal/read. Guardian alone plus SYSTEM accesses protected files; Guardian writes shared records and App reads them; each service writes its report directory. No broad drive or old-root grant. |
| Key | Only Software P-256 `Ecs.Lic008.ProvisioningV1.TEST_ONLY.software.<32-hex-run-id>`, machine-scoped, signing-only, export-disabled; DACL SYSTEM and this Guardian. No overwrite flag or enumeration. |
| DPAPI | Exact new Guardian SID descriptor, fresh32-byte secret, shared encrypted blob and protected comparison hash; memory secret cleared. No LocalMachine fallback. |
| Cleanup | Opens only validated intended key; requires matching ownership/public hash before deletion. Only DELETED_AND_CONFIRMED allows deletion of the two exact services. Files/reports are retained. |

ABSENT_FOR_CALLER, NO_INTENT_RETAINED, INCOMPLETE_OWNERSHIP, DENIED_OR_UNKNOWN and
FAIL_STILL_OPEN never authorize service teardown. If a key is created before
complete ownership is recorded, no automatic reconciliation or speculative delete
is offered. A later review must resolve the retained intent. No recursive cleanup
or automatic reinstall exists.

The old `Ecs.Lic008.Spike` services/root/keys remain outside this namespace. Build
and guard tests do not execute InstallAndRun/Recheck/Cleanup, install any service,
create any persistent key, change ACLs or decrypt existing private state.

## Run handoff and remaining boundaries

The package is unsigned development tooling. Manifest/hash validation detects
accidental modification, not publisher authenticity or an administrator attacker.
The exact source and mutation manifest must be reviewed before physical execution.
Use `01-Install-And-Test.cmd` elevated on the selected host only for that experiment;
`02-Recheck.cmd` exercises a new service process, and `03-Cleanup.cmd` is a separate
explicit operation after reviewing results. `04-Status.cmd` only reads status.
Persian instructions are packaged. Preserve `run-*.json` and per-role reports;
reading them requires elevation rather than changing directory permissions.

This package does not implement the conditional Setup alternative, ordinary-user
execution, automatic reboot, repair/reinstall, TPM signing/wrapping/attestation/NV,
power loss, real file intake or production Store/Backup acceptance. Those remain
explicitly untested. Software results on this host cannot close the Windows10/
TPM-less/independent-target matrix. No production admission or License gate changes.

Automated checks exercise stage failure attribution and short-circuiting, redaction,
identity/group denial, wrong/old key namespace, managed-command refusal, native
argument quoting, package tamper/extra/duplicate/alias/junction rejection, fresh-root/
service collision and conservative cleanup decisions. They do not prove Windows
cryptographic behavior; that requires the subsequent physical run.

## Physical baseline — 2026-09-19 (EV0098)

User authorized the next step: mutation-manifest review and execution on this host.
Archive digest matched the final build above; extraction was to a fresh directory.
Both new service names and the target root were absent before execution. An elevated
controller ran only InstallAndRun; no Cleanup, Recheck, reboot or fallback followed.

Run: `27ef5ffb1caf4a42a8d8ef431d91d579`. OS10.0.22000, domainJoined=false.
Guardian and App report their exact expected primary virtual-account SID;
ServiceGroupAttributes=null means no matching group entry was reported, not that
the primary identity is missing. Both executable hashes match the package manifest.

| Probe/stage | Observed result | Interpretation |
| --- | --- | --- |
| Protected canary creation | PASS | Guardian wrote its test file. |
| Software provider open and P-256 query | PASS | Available under the actual Guardian token. |
| Native create, export-policy/signing-usage and pre-finalization DACL setters | PASS | Preparatory calls succeeded; this is not a usable/persisted key or verified effective DACL. |
| `native-finalize-key` | FAILED_OR_UNAVAILABLE, `CryptographicException:0x80090010` | Failure is now located at finalization in this specific native variant. Exact cause and remediation remain unresolved. |
| Key reopen | FileNotFound at `load-public-record` | Publication was not reached. This is a missing harness record, not proof that the OS key does not exist. |
| Private export and App/child key denial | NOT_TESTED_PREREQUISITE | No positive usable-key control; no key-isolation acceptance. |
| DPAPI descriptor creation | PASS | Descriptor creation alone does not prove secret protection. |
| `dpapi-protect-secret` | FAILED_OR_UNAVAILABLE, `CryptographicException:0x80090034` | Secret encryption failed; decrypt/continuity/denial acceptance cannot proceed. |
| App and actual child protected-file read/write | Four PASS_ACCESS_DENIED results,0x80070005 | Narrow file-isolation evidence for this run. |
| App/child DPAPI denial | NOT_TESTED_PREREQUISITE | No successfully protected blob; no cryptographic isolation claim. |
| Child execution/identity | PASS | Actual child probe completed under the expected App identity. |

The controller exited0 because it completed collection. This does not mean all
security probes passed. Finalization is required before using a CNG key; see
[Microsoft NCryptFinalizeKey](https://learn.microsoft.com/en-us/windows/win32/api/ncrypt/nf-ncrypt-ncryptfinalizekey).
The failure location does not establish the old managed failure's location, an
ACL-root cause, a need for LocalSystem provisioning, or standalone DPAPI root cause.

Raw report: `C:/ProgramData/Ecs.Lic008.ProvisioningV1/run-27ef5ffb1caf4a42a8d8ef431d91d579.json`.
Review copy: `out/lic008-physical-418bd43cb580427085c1535057456332/run-27ef5ffb1caf4a42a8d8ef431d91d579.json`.
Report SHA-256: `4dd789de10bb76dda733a52d43a728c0ae48b1a5c02f85a5c144ced867b97e93`.
Package-manifest SHA-256: `61a7730b0d9a82a75c30bfb62ce4fbb56c2e56b649ca7ea8ef32584419ffcb9c`.
Executable SHA-256: `214469b5f90b77ccc230b1f37512809527f1120dc718b3ec4824e748b6fbb4c4`.
The local elevated transcript includes operator/machine metadata and is not a
redacted diagnostic export; keep it local. The JSON reports contain the scoped
diagnostic fields specified above.

Both new services are retained Stopped/Manual; the two old Spike services remain
Stopped and their installation was not modified. New intent/resources/reports
remain for review; no key absence, cleanup completion or automatic deletion is
inferred. Restart/reboot and dependent crypto tests were not repeated after the
failed prerequisites. No production state, DB, TPM or BIOS operation occurred.

Next investigation: determine why this exact Software finalize call is denied
under the Guardian identity, using bounded provider/token/permission evidence and
a reviewed single-variable comparison if necessary. Investigate SID DPAPI-NG
standalone compatibility separately. Do not relax global key-store ACLs or adopt
Setup key creation on this result alone. LIC008 and LIC-OPEN-003/012 remain open.

## Read-only environment diagnosis — EV0099

The next user-authorized step collected directory security descriptors, fixed
service statuses and bounded event metadata for the baseline time window, first
unelevated and then elevated. Collector:
`scripts/inspect-license-provisioning-environment.ps1`. It pins the baseline report
digest, reads only three named crypto-directory ACLs (no children/key contents),
queries two log configurations and at most64 event headers per enabled log, and
writes a fresh JSON under out/. It does not enable logging or mutate services,
keys, ACLs, descriptors, domain membership or test installation files.

Elevated evidence: `out/lic008-environment-0c12b735d69845f887dd5f137a12279d.json`,
SHA-256 `3b7db4a93b95ce471cc46d700e0ddc503e4c258695d57c1074d5514bd167dffd`.
Unelevated evidence: `out/lic008-environment-e1a9e21f23fc4c5d99d8c26b85efa6ca.json`,
SHA-256 `622b65210f2a37134779358b514fbfacc7f58d088a3ae88c233df674b5d22fe9`.

| Observation | Conclusion and limit |
| --- | --- |
| `C:/ProgramData/Microsoft/Crypto/Keys` has a protected DACL: Everyone Read/Synchronize; SYSTEM and Administrators FullControl; no other ACE | The shared directory offers no write grant to an ordinary Guardian virtual account. This supports a machine-key persistence permission hypothesis; it is not an AccessCheck against the original process token or a trace of the KSP's failing file operation. |
| SystemKeys and legacy RSA/MachineKeys ACLs were also observed | Do not confuse the legacy RSA path with the Software CNG shared-key path. No file inventory/content was read. |
| KeyIso is Running/Manual | A currently stopped key-isolation service is not the observed condition. This does not prove it was healthy at every instant of the failed call. |
| Elevated CAPI2 query shows the Operational log is disabled | No retrospective diagnostic event can be obtained from that disabled channel. Unelevated query had been UNAVAILABLE; elevation clarified configuration only. |
| Crypto-DPAPI Operational enabled, no matching events in the fixed baseline window | No additional event evidence, not proof of success or a particular root cause. |
| All four experiment services Stopped/Manual | Both retained installations remain idle and unchanged. |

Microsoft lists Software CNG shared keys under the Crypto/Keys directory in
[Key Storage and Retrieval](https://learn.microsoft.com/en-us/windows/win32/seccng/key-storage-and-retrieval).
Combining that documented location with the observed DACL and finalization failure
supports the persistence-permission hypothesis. It does not establish that changing
the global folder ACL is necessary or acceptable; no such change is proposed.

For protection, Microsoft describes the SID-based DPAPI-NG example as using domain
key distribution in [key encryption at rest](https://learn.microsoft.com/en-us/aspnet/core/security/data-protection/implementation/key-encryption-at-rest?view=aspnetcore-10.0).
The current non-domain service-SID encrypt failure therefore exposes an unresolved
compatibility assumption in master section5. Descriptor parsing success is not
proof of a supported standalone protector. Do not generalize this single failure
to every DPAPI-NG configuration.

The [CNG DPAPI constants](https://learn.microsoft.com/en-us/windows/win32/seccng/cng-dpapi-constants)
distinguish LOCAL=user from LOCAL=machine; the latter permits all local users to
decrypt. A user-scoped protector is a candidate for investigation, not the approved
Service-SID contract or a proven restart/repair solution. It requires explicit
Guardian identity/profile, App/child denial, new-process/reboot and repair/reinstall
evidence. LOCAL=logon is unsuitable for persistent state because its lifetime ends
with logoff/reboot. None was invoked or selected in this step.

### Concrete next comparison, still provisional

1. For key persistence: prepare a separately identified test-only LocalSystem
   provisioning comparison using the same Software provider, P-256, machine flag,
   export policy, usage and Guardian DACL, changing the creator identity only.
   The temporary helper must terminate before Guardian reopen/sign and App/child
   denial tests. Exact intent/ownership, collision, interrupted handoff and cleanup
   rules from the existing plan remain mandatory. Do not reuse failed-run names,
   change global crypto-folder permissions, elevate Guardian or overwrite a key.
   This is evidence for a possible design amendment, not adoption of Setup creation.
2. Independently, specify a test-only Guardian user-scoped protection comparison
   with fresh canaries and ciphertext readable by App/child. Never add it as an
   automatic fallback after SID failure. A successful round-trip alone cannot
   settle identity continuity or production acceptance.
3. Record the two alternative contracts and their acceptance obligations before
   implementing privileged comparison code. Keep the original Guardian-creation
   and SID-protection clauses normative until a reviewed decision changes them.

Collection completed twice; ACLs and service observations were read without
changing them. Initial ad hoc ACL query had a PowerShell pipeline syntax error
before execution, then the corrected query and collector succeeded. No physical
crypto rerun, cleanup or new key creation occurred. Root causes remain hypotheses
with stronger evidence, not confirmed fixes; LIC008 and Open003/012 stay open.
