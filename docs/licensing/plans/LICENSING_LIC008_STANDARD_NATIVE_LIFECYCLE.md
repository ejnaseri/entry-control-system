# LIC008 W03 closed native account, service and peer-object bindings

Date: 2026-11-03 UTC / November4 Kabul.
Status: `SOURCE_IMPLEMENTED_PHYSICAL_ENTRY_CLOSED`.

[W03 design](LICENSING_LIC008_STANDARD_USER_CONTROL.md) /
[previous account lifecycle](LICENSING_LIC008_STANDARD_ACCOUNT_LIFECYCLE.md) /
[completion ledger](LICENSING_LIC008_COMPLETION_PLAN.md).

This increment follows `7e11850`. It supplies the SID-bound account adapter,
fresh-service lifecycle and read-only peer-object observation sources. Native
bindings are compiled only. The test executable permits only `--self-test`;
every operational argument is refused before any native binding is constructed.
No account activation/disable/logon, SCM operation, peer handle query/transfer,
native file custody/pipe/store or persisted CNG operation is performed.

## Exact account object and explicit flag domains

`StandardAccountFlagCodec` implements the closed NetAPI/SAM subset with a
separate original UF_SCRIPT sidecar. SAM disabled1/normal0x10/dontExpire0x200
must not be mistaken for NetAPI disabled2/normal0x200/dontExpire0x10000. Unknown
flags and lockout states are refused. A reconstructed value is not a new native
observation. Mutation planning admits only an actual disable-bit transition and
readback must agree in both domains.

`StandardNativeAccountBackend` roots its lease and handle-output slots before
entering native opens. It opens the fixed local machine domain and RID1023,
retains that same user handle, and never mutates an account through its name.
The server/domain/user access masks are restricted to the required operations;
the user handle requests READ_GENERAL, READ_ACCOUNT and WRITE_ACCOUNT (0x31).
The only write is SamSetInformationUser/UserControlInformation on that retained
object. There is no password, group, deletion, account creation or name-addressed
NetUserSetInfo mutation route.

SAM account name/control, actual NetUserGetInfo23 name/SID/flags and complete
direct alias membership in the held machine and builtin domains must agree.
NetAPI is used by name only for read-only observation, with exact returned SID
and name checks. Direct local aliases must be Users545 only. This is not a claim
of complete transitive membership; the actual launched standard-user token must
separately prove that Administrators is absent with every attribute value.

Before and after its nonreentrant admission callback the adapter revalidates
the same account and baseline attributes. It changes only the SAM disable bit
and reads back through the same handle. The lifecycle's actual ownership,
predecessor and held-child exit guards remain mandatory. Failure poisons the
lease and retains partial handles/state; only confirmed disabled success can
release it. No automatic compensation or second mutation is supplied.

The full control-word write is not atomic compare-and-swap. Concurrent
privileged interference is unsupported/unknown. Public
[SAMR access definitions](https://learn.microsoft.com/en-us/openspecs/windows_protocols/ms-samr/c0be3f43-bcf9-43ee-b027-3d02ab372c53)
and [flag mapping](https://learn.microsoft.com/en-us/openspecs/windows_protocols/ms-samr/8a193181-a7a2-49df-a8b1-f689aaa6987c)
do not establish compatibility of the local private samlib ABI. That ABI,
buffer layouts and this host's behavior remain physically unverified.

SAM/NetAPI calls are synchronous and can block while holding the account lease
lock. This component supplies no bounded native account timeout. A future
controller must bound its own wait and strongly retain the entire pending call,
task and lease. Calling locking Evidence() or Dispose() after that timeout is
not an escape and can block again. Pending account effects cannot authorize
continuation, compensation, cancellation, retry or automatic handle closure.

## Fresh services and ordered worker admission

`StandardServiceLifecycle` owns only newly created Setup and Guardian services.
Absence observation cannot authorize adopting a preexisting service. The
CreateServiceW output holder is rooted before entry and its original handle is
retained for configuration, startup and both Guardian stages. No service is
reopened by its name for ownership or mutation.

Creation uses DISABLED first because CreateServiceW has no atomic security
descriptor argument. On the same newly returned handle the adapter applies
the protected descriptor and exact service SID/configuration, reads back, then
changes start type to DEMAND. Setup uses LocalSystem and its enabled service
SID; Guardian uses the exact fresh virtual-service account. Both are standalone
processes with exact fixed dotnet command and no restart/failure actions,
triggers or delayed start. This does not borrow the retained V5 Guardian.

The dedicated service journal interface binds create intent/ownership/complete
and each start/admitted/run-complete chain. Its concrete protected-store mapping
is separate work; injected typed receipts alone are not physical collection.
Both service ownership chains must complete before any start. Stage order is
Setup, GuardianBefore, then GuardianAfter with independently guarded actual
predecessor/key evidence. Each stage has a fresh run ID and nonce and can start
only once.

RUNNING on the original SCM handle supplies the candidate PID. An injected
trusted process opener must retain the actual process, verify creation time and
capture the actual full token; SCM state and PID are checked again. Merely
opening the expected image/token does not establish code association. The
actual process opener is not supplied by this increment.

The closed service-host sequence reports RUNNING with no accepted stop controls,
waits for read-only bootstrap, enters the separate granted-operation callback,
joins all worker activity and only then reports STOPPED. No CNG operation is
authorized by RUNNING or bootstrap alone. Native RPC timeout or failure retains
pending tasks, handles and unknown effects; it does not cancel/retry an SCM call
or stop/delete/restore a service. Physical SCM compatibility remains unverified.
This host sequence is injected ordering only; actual ServiceMain/dispatcher
wiring is not supplied by this increment.
The retained pending RPCs have no late-completion observation API yet. A future
collector must inspect the same retained operations without repeating a call;
timeout cannot be reported as completed rollback or successful cleanup.

## Separate process and token observations

`StandardNativePeerObjectReader` borrows already owned handles and adds managed
references for the read duration. It requires distinct real handles with exact
Process QUERY_LIMITED_INFORMATION|SYNCHRONIZE (0x101000) and Token QUERY (8)
access, no inherit/protect flags and actual kernel Process/Token object types.
Native type/scalar buffers and TOKEN_STATISTICS are bounded. Actual process
PID/start/image/live status, token shape and stable TokenId/ModifiedId/statistics
are reread around local caller identity, scope and custody admission.

Neither borrowed peer handle is opened, duplicated, adopted or closed; the
separate local-caller identity capture queries its own token. There is no
impersonation. Reading a valid Owner token beside a valid Owner process does
not associate them. Every
observation explicitly reports process/token association, bootstrap authority,
loaded-code proof and native/security/production acceptance false.

A future broker-associated bootstrap must obtain the Owner's actual current
primary token, duplicate only read-only handles into the independently admitted
held worker, durably record transfer intent/partial outcomes, prove the exact
objects by round trip and bind stage/run/nonce/target process. It must separately
guard the Owner's current primary token immediately before GRANT. This is a
trusted broker association, not receiver-side OpenProcessToken proof. The old
effects declaration cannot silently authorize that new handle transfer.

## Verification and next integration

The new builder snapshots36 exact inputs and compiles default, unrelated-define
and compile-only-native variants against pinned .NET10.0.11/x64. Existing
builders and historical snapshots remain unchanged. Pure tests use injected
account/service/process objects and synthetic byte buffers; they never exercise
the native bindings. Exact build reports and independent review results are
recorded with the completed build evidence.

The [four exact original build reports](../evidence/standard-user-native-lifecycle-v1-20261103/README.md)
record **19,382 assertions and37 closed entries per variant**: previous12,855
plus flag codec2,982, account backend2,027, service lifecycle1,330 and peer
rules188. Independent source review PASS. All native operations and acceptance
flags remain false; implemented source is not native compatibility evidence.
Independent artifact audit PASS,1,496 read-only assertions against the exact
49-file/4-directory output and all current/snapshot/tool/runtime originals.

The subsequent [Owner transfer and service journal increment](LICENSING_LIC008_STANDARD_TRANSFER_JOURNALS.md)
implements the injected V2 loan/round-trip association protocol and concrete
fifteen-file store adapter. Its newer evidence does not alter this build's count
or turn separate observations into native association/bootstrap authority. The
following next-action paragraph describes this historical checkpoint.

Next integrate concrete service journals, actual held process/token adapters,
the separately declared one-use Owner bootstrap, actual loaded runtime/code
custody, durable stage consumption and the full controller/collector. Then a
complete fresh placement and binding chain must receive independent review
before the existing local manual CONFIRM flow can expose physical W03. Account
preparation and V1–V5 approvals are consumed and cannot authorize these effects.

LIC008/Open003 and physical W03 remain open. W04/W05 native cases, independent
Windows/hardware, TPM/NV, installer lifecycle and final acceptance remain as
listed in the completion ledger. A source assertion count is not physical test
coverage or evidence that any retained account/service/key changed.
