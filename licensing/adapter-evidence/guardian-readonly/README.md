# Retained Guardian read-only diagnostic candidate

Latest 2026-10-15: this diagnostic returned1066/202; original path restored.
Do not repeat it. See [token-only successor and result boundary](TOKEN_DETAIL.md).

2026-10-14. BUILD_TESTED / OWNER_AUTHORIZED_DIAGNOSTIC / PHYSICAL_NOT_RUN.
This is not Prepare, a retry, repair, cleanup or acceptance of the existing keys.

The original service loses the failure detail in a catch that returns1067. This
separate executable probes read-only layers against the exact retained plan and
original managed assembly. It calls a closed set of original internal read-only
helpers by reflection. It never calls RoleActions.Execute, the original Main,
key creation/deletion/property setters, sealing/export, protected writes or ACL
setters. Existing source/package bytes, keys and retained plan remain unchanged.

## Evidence boundary

The owner-supplied Setup report has four PASS results; Guardian emitted no
report. The four supplied ACLs match current rules. This does not prove Guardian
ran cryptography, prove all five pilot cases or identify the original exception.
Current boot differs from the failed run. The diagnostic explicitly pins both
the retained plan's old boot and today's observed new boot, without overriding
the original runtime admission. Its results describe current retained-state
access only; they cannot retrospectively prove the earlier execution's cause.

## Execution and output

Only `--self-test` and `--service` exist. Self-test runs no probe/native role.
Service mode uses the exact existing Guardian service name and account context.
It accepts no SCM start arguments. Each probe stops on its first failure.
SCM exit1066 carries a bounded service-specific number: stage*100+reason.
Reason1..18 maps to the ordered reasons in pure-tests.json;90=access exception,
91=cryptographic exception,92=IO exception,99=unclassified. Unknown exception
messages, raw buffers and secrets are never emitted. This is not a raw HRESULT.
Success exits0 and only means these read-only checks completed.

Stages:1 original assembly/runtime;2 Guardian identity/SIDs;3 original plan;
4 host and separately pinned boots;5 original package file reads/hash checks;
6/8 restricted/control ownership files;7/9 existing key open/policy/public identity;
10 staging/report directory owner/DACL checks. The probe intentionally does not
call original VerifyPackage's executable-path check because its own executable
is separate; package contents/ACLs are checked, not original-process admission.
It also does not test report creation, private export, seal/open payload, original
worker deadlines or report emission. If all probes pass, do not declare the
original fault fixed: those unexecuted paths still need diagnosis.

## Deployment boundary — runner prepared, physical execution pending

The builder only compiles in a unique out directory and runs managed tests.
The diagnostic is framework-dependent on the pinned local runtime10.0.11/x64,
not a customer delivery artifact. Do not point an elevated service directly at
a development-writable out directory.

A separately reviewed deployment runner must verify the stopped exact original
Guardian configuration, all diagnostic/runtime/package pins and current boot;
create a NEW protected diagnostic-only directory with SYSTEM/Administrators
control and Guardian read/execute; copy/read back exact bytes; capture original
configuration; temporarily change only Guardian's binary path; run once without
start arguments; collect numeric result; restore the exact original path only
after the diagnostic has stopped. No force-stop, repeat, deletion, source-package
replacement, changes to retained ACLs/keys or other service configuration.
Retain all evidence; errors or a live/hung process require stop-and-report rather
than automatic restoration/retry. Both configuration transitions need verification.

The owner separately approved this exact diagnostic scope on 2026-10-14.
The previous Prepare permission is not used as service-path change authority.
The build manifest remains unchanged and records its earlier unauthorized state.

[One-shot runner](../../../scripts/run-license-guardian-readonly.ps1) defaults to
`SelfTest`: read-only candidate/runtime hash checks, boot/configuration checks and
three negative predicate tests. `Execute` requires the pinned elevated owner.
It refuses a pre-existing diagnostic directory and configured automatic recovery,
atomically creates the new protected directory, copies only the DLL/runtimeconfig,
verifies the retained package against the pinned plan, journals both transitions,
starts once with no arguments and waits up to45 seconds. No force-stop, deletion,
retry or automatic restoration after ambiguous infrastructure failure exists.
A stopped probe (including a nonzero diagnostic result) restores the original path.
Evidence stays in `C:\ProgramData\Ecs.Lic008.GuardianReadOnlyV1`.

Local read-only preflight passed. The agent is not elevated, so deployment/start/
restoration have NOT been physically tested. The owner must run Execute once in
Administrator Windows PowerShell5.1 and send the numeric result. A timeout or
runner error requires inspection, not rerunning Execute or original Prepare.
