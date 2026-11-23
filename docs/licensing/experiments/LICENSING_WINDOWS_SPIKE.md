# LIC-6.2-008 Windows feasibility handoff

Base: `ad5c209`. Implementer: Codex. Acceptance reviewer and target-laptop operator:
Project Owner. Independent security closure review remains required, not assigned
or performed by this preparation step. The user authorized a separate test kit
for an available Windows 11 laptop. No virtual machine or Windows reinstall is required.

## Current deliverable

EV0098 update: the separate0.3.0 baseline has now run on the current host.
Software finalization failed0x80090010 after preparatory calls succeeded; DPAPI
secret protection failed0x80090034 after descriptor creation. Four App/child file
denials passed. New services are retained stopped; no cleanup/reboot/recheck or
production change followed. See the [physical result and hashes](LICENSING_PROVISIONING_HARNESS.md).
This supersedes the pre-execution handoff status below.

The separate [provisioning baseline0.3.0](LICENSING_PROVISIONING_HARNESS.md)
is built and guard-tested. It uses new fixed names and does not replace retained
0.2.0 services. Physical execution is pending; use its mutation manifest and
handoff rather than rerunning the old installation instructions below.

Next experiment design: [Guardian provisioning/protection and dependency proposal](../plans/LICENSING_WINDOWS_NEXT_PLAN.md).
The plan is prepared; its new baseline probes are not executed. It requires a
fresh fixed namespace and preserves the retained installation. Setup key creation
and native dependency changes are provisional; the master contract is unchanged.

`licensing/windows-spike/preflight/` is a portable, offline inventory kit for inbox
Windows PowerShell 5.1. It needs neither elevation nor the application/database.
Extract the ZIP, run `Run-Preflight.cmd`, and return the newly created
`report-*/preflight.json`. The Persian instructions ship with the kit.
The launcher uses process-only execution-policy bypass; it does not change policy.
Each invocation writes only a new sibling report directory. Deleting the extracted
kit after retaining the report is sufficient cleanup; no system cleanup script runs.

Inventory records selected OS/CPU/memory/system-volume/TPM fields and the collector
hash. It excludes host/user names, serials, network identifiers and secrets.
Query failures are UNKNOWN, never an inferred TPM absence. A platform candidate
is not provider feasibility, Windows support-matrix completion or security PASS.
The report is self-reported development evidence, not attestation.

## Service/key test harness 0.2.0 (historical preparation baseline)

The pre-change repository documentation review is recorded in
[LICENSING_PREIMPLEMENTATION_REVIEW.md](../reviews/LICENSING_PREIMPLEMENTATION_REVIEW.md).
The user confirmed both returned preflight reports are from the development
computer. Elevated execution observed TPM spec `1.2, 2, 3`; this neither proves
TPM 2.0 nor the required P-256 provider support. The second laptop remains unavailable.

Build using `powershell.exe -NoProfile -ExecutionPolicy Bypass -File
scripts/build-license-windows-harness.ps1`. The builder pins SDK10.0.400 and a
self-contained .NET10.0.11 win-x64 runtime; it emits a ZIP/hash under ignored out/.
It runs only pure guard tests, never setup or key generation. Verify with
`scripts/test-license-windows-harness.ps1 -PackageRoot <extracted-package>`.

The separate `licensing/windows-spike/harness` C# project and `kit` PowerShell
controller create only `Ecs.Lic008.Spike.Guardian` and `Ecs.Lic008.Spike.App`, with
their own virtual accounts and Manual startup, under `%ProgramData%\Ecs.Lic008.Spike`.
The operator explicitly runs InstallAndRun, Recheck or Cleanup on the designated
test laptop. Recheck reopens the same keys; no automatic reboot occurs.
Both roles are one-shot SCM services; direct interactive service/key execution
is refused by exact identity checks. The App child repeats its denial probes.

Software and TPM P-256 creation are independent probes. Keys are machine-scoped,
signing-only, export-disabled and restricted to SYSTEM/Guardian; tests reopen,
sign/verify, inspect the DACL and attempt private export. Public hashes and exact
key ownership are retained; no vendor keys or production License objects exist.
DPAPI-NG uses `SID=<test Guardian SID>`, with no LocalMachine fallback. Shared
ciphertext is readable by App so denial tests exercise DPAPI rather than a file ACL.
Missing setup evidence and unrelated errors never count as access-denial PASS.

Cleanup opens only the exact intended key, verifies its recorded public hash and
deletes that key. A known missing-key result is distinct from unknown/inaccessible
outcomes. Incomplete ownership of an existing key requires reconciliation. Successful
cleanup removes exactly the two test services and retains all files/reports; partial
setup/cleanup is deliberately preserved for review rather than recursively deleted.
Package hashes catch accidental changes, not publisher authenticity or malicious
Administrator modification. This unsigned test kit is not a production installer.

## Initial physical-result narrative (superseded by corrections below)

For the current assessment and permitted next step, see the
[documentation path review](../reviews/LICENSING_PATH_REVIEW.md). The following original
narrative is retained as history; device attribution, DPAPI error and cleanup
interpretation are corrected in the subsequent sections and EV0092-0094.

On 2026-09-19, the target laptop ran package SHA-256
`70661B38AFAF5E9EF56F388D479E1E981B48AB62279EAEABF860BEB252700E26`.
Both test services were created and their identities matched. Guardian created its
protected file, while App and its child received the intended access-denied result
for protected-file reads and writes. Guardian could not create either Software or
TPM P-256 machine key, or Guardian-SID DPAPI-NG: each returned
`CryptographicException:0x80090010` (`NTE_PERM`). The resulting absent-key probes
were correctly recorded as `NOT_TESTED_PREREQUISITE`, never PASS.

Cleanup removed the Software test key but could not open/delete the recorded TPM
test key and returned the same error. The harness therefore retained both services
and ownership records. Cleanup report:
`guardian-reports/c5b05c410d644d188579fa35b119d586.json`. Do not change TPM,
BIOS, BitLocker, CNG ACLs or manually delete any retained resource. This is a
negative provider-feasibility result, not evidence that TPM is absent.

## Remaining physical work

### 2026-09-19 correction and diagnostic handoff

The earlier physical-result narrative overstates the evidence. The operator's
initial output shows DPAPI-NG `0x80090034`, while the two CNG creation probes show
`0x80090010`. Each old creation probe spans creation, ownership recording, ACL
configuration and validation: its failure does not locate the failing operation.
Software cleanup PASS includes the absent-key case and therefore does not prove
deletion. TPM access denial does not prove either presence or absence of a key.
The execution device has not been independently identified by the pasted report.

Version 0.2.1 adds fixed operation-stage labels to creation failures without
changing identities, key policies or cleanup authority. It is a fresh-install
candidate only; do not overwrite or reinstall the retained 0.2.0 installation.
The separate `05-Export-Diagnostics.cmd` / `Export-Diagnostics.ps1` handoff works
with the existing installation: elevated read of allowlisted report fields and
the two service statuses, with a new sibling JSON export. No key operation,
service start/stop, ACL change or private-state export is performed. Old reports
cannot retrospectively identify the precise failing operation. Reconciliation
and any future provisioning helper still need their own reviewed implementation.

The subsequent operator-authorized local export succeeded from this development
workspace on 2026-09-19 after an unelevated read returned Access Denied. An elevated
PowerShell exporter read the existing reports without changing ACLs or services.
`out/lic008-diagnostics-4801f3ec065341afa549448405b117df.json` contains the original
Guardian/App create run and Guardian cleanup run with matching run IDs. Both test
services were Stopped. Thus those reports are present on the currently accessible
host; they must not be counted as independent second-laptop evidence. All Stage
fields are null because the installed 0.2.0 binary did not record suboperations.

### Read-only provider inspection on the current host

The operator authorized the subsequent local diagnostic step. `Inspect-Existing.ps1`
and `ReadOnlyProbe.cs` checked the original Guardian create report before querying
only the two exact test key names under elevated Administrator. Native imports are
limited to provider/key opening, algorithm support query and handle release.
Output: `out/lic008-inspection-5a1ab1ea99474071b3f58f7f6a1ebd8b.json`.

- Both provider handles opened successfully. Software reports ECDSA_P256 support;
  Platform Crypto Provider reports `0x80090029` (`NTE_NOT_SUPPORTED`) for that algorithm.
- Opening each exact machine-key name with Silent returned `0x80090016`
  (`NTE_BAD_KEYSET`) for this Administrator caller. This is not proof of global
  absence or permission to delete services/ownership evidence.
- OS reports10.0.22000, domain membership false, TPM enabled/activated and raw
  SpecVersion `1.2, 2, 3`. Both isolated services are Stopped, Manual and configured
  for the expected virtual accounts. No real second-laptop evidence is claimed.
- The old DPAPI error0x80090034 is `NTE_ENCRYPTION_FAILURE`. Microsoft's documented
  SID-based DPAPI-NG example relies on a domain controller; together with the local
  non-domain environment this warrants a separate compatibility investigation,
  not a proven cause and not a silent LocalMachine fallback.

The next bounded investigation is Software machine-key provisioning versus
Guardian use, plus standalone Guardian-SID secret protection feasibility. Changing
who creates production keys or the protection contract requires an explicit design
decision: master section5 currently says Guardian creates and owns its key.
The current TPM P-256 path is not supported by the observed provider query;
hardware-path acceptance needs a suitable target. Existing resources remain intact.

References: [NCryptIsAlgSupported](https://learn.microsoft.com/en-us/windows/win32/api/ncrypt/nf-ncrypt-ncryptisalgsupported),
[Windows cryptographic error codes](https://learn.microsoft.com/en-us/windows/win32/com/com-error-codes-4),
[DPAPI-NG SID example](https://learn.microsoft.com/en-us/aspnet/core/security/data-protection/implementation/key-encryption-at-rest?view=aspnetcore-10.0).

After reviewing the target inventory, execute the prepared isolated harness and
retain failures as well as passes. Full LIC008 must prove the master section 5 contract: Platform CNG signing-key
ACLs, a separate wrapping key, Software CNG, Guardian-SID DPAPI-NG, App/child-token
denials, and repair/reinstall/reboot continuity. Provider selection remains open.
Any persistent test resource must be recorded for cleanup; do not touch production
Guardian names/paths or existing user keys. Running the software provider on a
TPM-equipped laptop is not evidence from a physically TPM-less system.

On this working laptop do not clear TPM, change BIOS/BitLocker, simulate abrupt
power loss or perform destructive OS repair. TPM-NV and destructive failure cases
need an appropriate disposable environment and remain unexecuted. Windows 10 and
TPM-less matrix evidence remain outstanding even after a Windows 11 success.

Native file acceptance remains `LIC-FILE-001` through `005`; production durability
remains `LIC-STORE-001` through `005` under Guardian/Store owning gates, including
trusted time acquisition and lost-acknowledgement reconciliation. No Node file or
database substitute is introduced by this spike.

## Dependency issue requiring reviewed clarification before integration

The current master requires LIC006 physical completion for Phase 6.2 exit, while
Guardian LIC-6.4-001 depends on Phase 6.2 and Store LIC-6.5-002 depends on Guardian.
This creates a closure cycle. Master section 6.1 requires a reviewed scope/dependency
clarification before changing ownership of exit criteria. This handoff does not
resolve or waive that cycle. LIC008 depends only on completed LIC003 and can proceed.
LIC006 stays open and its portable independent review recorded in `ad5c209` is complete.
