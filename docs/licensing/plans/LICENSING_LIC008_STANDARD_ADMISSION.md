# LIC008 W03 closed worker admission and file custody

Date: 2026-11-03 UTC (2026-11-04 in Kabul).
Status: `CLOSED_COMPONENTS_IMPLEMENTED_NATIVE_INTEGRATION_NOT_RUN`.

Subsequent [closed account lifecycle](LICENSING_LIC008_STANDARD_ACCOUNT_LIFECYCLE.md)
implements injected activation/explicit-return sequencing and owner journals.
Its native SID-bound account backend is still absent; see that contract for
current integration obligations. This document's build evidence stays unchanged.

[W03 design](LICENSING_LIC008_STANDARD_USER_CONTROL.md) /
[previous construction increment](LICENSING_LIC008_STANDARD_CONSTRUCTION.md) /
[completion ledger](LICENSING_LIC008_COMPLETION_PLAN.md).

This increment follows `fea37d6`. It adds injected worker-channel sequencing,
compile-only local named-pipe transport and held file custody. It does not
activate or log on the disabled account, create a native service or persisted
key, or execute the physical W03 comparison. Previous consumed attempts and
account-preparation approval remain separate and cannot authorize this runner.

## Admission, original reports and process exit

`StandardWorkerChannel` uses a strict canonical, bounded framed protocol:
one scoped GRANT, one REPORT and one durable ACK. A context binds the exact
attempt, source set, stage, nonce, controller and worker PID/start/image/code
pins. Setup starts without predeclared key identities; later stages require
the exact preceding report/process and distinct key/descriptor/envelope pins.

Both peers require actual held process/token observations and an independent
custody guard. The OS pipe peer PID must match that already held process; a PID
received from the pipe never authorizes opening or adopting a process. Before
GRANT, the owner separately verifies actual predecessor originals, journals and
key/envelope evidence. During work, the worker must call the scoped admission
callback again before effects. It is invalid outside that invocation or thread.

All four report originals, including Setup, are collected by the owner. A
worker has no report-file write API. The owner writes a new protected original,
flushes it, independently reads back the exact bytes and validates its typed
receipt before ACK. After ACK the controller observes the original held
worker's signalled process handle and exit code, rereads the original and
requires terminal pipe EOF. A worker cannot assert its own future exit.

The complete exchange has one 30-second monotonic budget plus UTC approval
expiry and rollback checks. Expiry, clock rollback, reuse, incomplete/failed
I/O, wrong stage/process, changed original or failed
guard leaves a partial/unknown result. No reconnect, replay or retry is exposed.
Payloads are at most 65,536 bytes; larger framed writes are split into bounded
chunks. A serialized context or a successful synthetic exchange is not native
process proof. Durable consumed-stage binding still belongs to the full runner.

## Compile-only native pipe transport

`StandardNativeWorkerChannel` creates the exact attempt/stage local pipe with
first-instance, overlapped, byte-stream and reject-remote flags. Creation has
an explicit owner/worker descriptor; client access deliberately excludes the
FILE_CREATE_PIPE_INSTANCE/FILE_APPEND_DATA bit and generic write. Setup's
SYSTEM client also receives that limited mask. Client opens use identification
SQOS, noninherited handles and no impersonation or automatic wait/reconnect.

The transport verifies its own admitted role and custody before operations;
mutual held-process/token admission remains the channel adapter's obligation.
Cancellation requests do not prove completion. On timeout the protocol is
poisoned and retains the transport, pending task, buffer and cancellation
state. Release requires observed I/O completion and completed cancellation
callbacks. Read-only completion observation remains available after expiry;
unresolved work cannot be disposed or reused as a fresh exchange.

These choices follow Microsoft's [named-pipe access rules](https://learn.microsoft.com/en-us/windows/win32/ipc/named-pipe-security-and-access-rights)
and [cancellation contract](https://learn.microsoft.com/en-us/windows/win32/api/ioapiset/nf-ioapiset-cancelioex).
No physical pipe or native descriptor compatibility has been tested by this build.

## Held files and exact input originals

`StandardFileCustody` rebinds the original plan/approval before backend opens,
then holds ancestors and 196 leaf files: dotnet.exe, 190 runtime inventory files,
two payloads and the package/runtime/source originals. It verifies exact paths,
volume/file IDs, creation time, type, link count, descriptors, length and digest.
The allowed App10.0.11, fxr10.0.11 and bin directory sets are closed. Files are
opened for read with share-read only. Mutation/reparse/hardlink changes and
untrusted write/delete/ACL grants are refused. Upper ancestors may admit only
the add-subdirectory right for sibling creation; searched directories and files
retain the stricter mutation rule. The implementation does not
repair permissions or adopt replacements by name. Verification rechecks held
objects and their content under the admitted scope/window.

The protected store now admits the exact original `input/source-set.json`
array without wrapping/reserializing it. Other JSON store records still require
objects. The source array remains bounded, strict UTF8 and duplicate-field
checked. SetupReport joins the other worker reports as owner-written only.

Disk custody does not attest loaded modules, select the actual hostfxr version,
bind a live process to those files, or prove compiler/source equivalence. In
particular, pinning fxr10.0.11 does not establish which installed hostfxr the
dotnet host selected. These flags remain explicitly false in custody snapshots.

## Closed build and next integration

`build-license-standard-admission.ps1` snapshots 26 exact inputs. Default,
unrelated-capability and compile-only-native variants expose only `--self-test`;
launch, service, controller, account and pipe operations remain unreachable.
The [original build evidence](../evidence/standard-user-admission-v1-20261103/README.md)
records exact final pins, assertion counts and independent review.
Each of the three variants passes11,392 assertions and22 closed entries.
Independent source and artifact review PASS (1,401 read-only artifact assertions).

Complete these obligations before a physical entry can be reviewed:

1. Native mutual process/token adapters and actual startup/loaded-code proof.
   Standard-user/Guardian access to the elevated owner's token is not assumed.
   A read-only handle transfer would require its own complete reviewed effect,
   restricted rights, binding and partial-transfer retention design; it is not
   implemented or authorized by this component contract.
2. Fresh SCM service bootstrap that waits for GRANT before key access, actual
   account/membership checks, and declared activation/return-to-disabled effects.
3. Durable one-use stage consumption, predecessor/key-original validation,
   complete controller sequencing and independent post-run original collection.
4. Compatibility/performance preflight for actual Windows descriptors and full
   custody cost within the exchange budget, followed by separately reviewed
   native relative-store creation compatibility evidence.

Then independently review the complete source, artifacts, input binding chain
and effects. A native run requires a fresh window and owner-entered local
CONFIRM. W03 physical crypto, W04/W05, independent Windows/hardware, TPM/NV,
LIC008/Open003 and security/production acceptance remain open.
