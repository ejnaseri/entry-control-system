# LIC008 W03 closed Owner transfer and service journals

Date: 2026-11-03 UTC / November4 Kabul.
Status: `SOURCE_IMPLEMENTED_PHYSICAL_ENTRY_CLOSED`.

[W03 design](LICENSING_LIC008_STANDARD_USER_CONTROL.md) /
[previous native lifecycle](LICENSING_LIC008_STANDARD_NATIVE_LIFECYCLE.md) /
[completion ledger](LICENSING_LIC008_COMPLETION_PLAN.md).

The subsequent [native startup foundation](LICENSING_LIC008_STANDARD_NATIVE_HOST.md)
now has a closed compiled build and [eight exact original reports](../evidence/standard-native-host-foundation-v1-20261103/README.md).
Its three variants each pass 2,455 pure assertions and 15 entry refusals;
the physical transfer, service dispatch and persisted-key path remain closed.

This increment follows `afbb6fc`. It implements an injected one-use Owner-object
transfer protocol and a concrete protected-store adapter for service journals.
The executable accepts only exact `--self-test`. No account activation/logon,
SCM operation, actual handle transfer, native store/pipe/custody or persisted
CNG operation runs. Implemented source does not establish native compatibility,
process/token association, bootstrap authority or loaded-code provenance.

## One-use Owner-object transfer model

`StandardOwnerObjectTransfer` uses a new schema2 context and explicit effects:
`FRESH_SERVICES_TWO_KEYS_OWNED_ACCOUNT_LOGON_READONLY_OWNER_OBJECT_TRANSFER_RETURN_DISABLED_RETAIN_V2`.
The current V1 plan/approval codec cannot authorize it. Its guard must eventually
admit actual new V2 plan/approval originals and live source, startup and file
custody; a new effects string beside old approval hashes supplies no authority.

The model binds stage, run, nonce, the original held worker PID/creation time
and the complete Owner/worker identities. Before a possible transfer it roots
holders for original objects, remote loans, round-trip copies and a newly opened
current Owner primary token. An original capture must independently prove the
actual Owner primary-token association; two separate process/token observations
or a matching AuthenticationId do not prove it.

The sequence is durable intent, read-only process/token loans, immutable stage
seed, strictly bound bounded ACK, duplication of those exact remote objects
back to the Owner, object comparisons, current Owner primary-token comparison
and durable completion. Process access is QUERY_LIMITED_INFORMATION|SYNCHRONIZE
(0x101000); token access is QUERY (8). No handle is inheritable and no duplicate
uses CLOSE_SOURCE. Numeric values are bound to their actual target handle table.

The protocol retains original bytes, receipts, slots and partial outcomes. Any
failure or concurrent reentry permanently poisons that instance; final success
is published only from its still-running state. There is no remote close,
retry, cleanup, GRANT or native adapter. In-process reuse registries are not
durable cross-process consumption authority. Actual native transfer, V2 codec,
protected transfer records and transport remain to be integrated. Before any
later GRANT, the actual Owner current primary-token association must be checked
again; an earlier successful transfer cannot authorize a later identity.

## Fifteen fixed service originals

The protected store appends fifteen service journal leaves without renumbering
the original0–25 entries. They cover Setup/Guardian creation intent, ownership
and completion, followed by start/admitted/run-complete for Setup,
GuardianBefore and GuardianAfter. Only the Owner source role can read/write
these records. Setup now has an explicit six-key-record allowlist; adding a
journal file cannot silently extend Setup's source permissions. The OS descriptor
continues to trust SYSTEM and Administrators; source-role refusal is not an OS
denial claim against SYSTEM.

`StandardServiceStoreJournal` maps all fifteen files bijectively to
`IStandardDurableRecordSink`. It checks canonical exact UTF-8, full context/run/
file/time binding, a complete typed creation receipt, unique actual file identity,
hash/length and an independent exact-byte readback. Owner/custody authority and
monotonic UTC are rechecked around backing-store boundaries.

The adapter is strongly retained before a backing write can begin. A failed
write/readback permanently closes later writes and preserves attempted metadata
and bytes. Only previously completed originals may subsequently be reread under
live custody. It neither infers SCM outcomes from JSON nor replaces the service
lifecycle's ordering. NativeEvidenceEstablished remains false. The backing sink
is synchronous: a future bounded caller must retain the entire pending call,
task and adapter rather than call its locking Evidence() after a timeout.

## Verification and next integration

The new builder snapshots40 exact inputs and compiles default, unrelated-define
and compile-only-native variants against pinned .NET10.0.11/x64. Historical
builders/snapshots remain unchanged. The component counts are store
7,493, Owner transfer1,381 and service journal183, alongside the unchanged
previous components. Pure tests use injected objects, synthetic byte buffers
and in-memory crypto fixtures; they do not call the native bindings.

Each variant passes22,987 assertions and41 closed entries. Independent source
review PASS; independent artifact audit PASS,1,530 read-only assertions across
the exact53-file/4-directory output and all source/tool/runtime originals.
Exact completed build reports and independent review are recorded in the
[original report archive](../evidence/standard-user-owner-transfer-v1-20261103/README.md).

Next integrate actual held process/primary-token adapters and native transfer,
the new V2 input/consumption/transfer-store contract, actual ServiceMain,
protected user scratch, bounded startup/runtime provenance and the complete
controller/collector. SCM has no environment-block argument in
[StartServiceW](https://learn.microsoft.com/en-us/windows/win32/api/winsvc/nf-winsvc-startservicew).
A managed-entry environment check cannot establish that no startup hook or
profiler ran before it. A new loader profile must solve each launch route before
GRANT; current hashes and candidate runtime files are not loaded-code proof.

Only a complete fresh placement and binding chain, independently reviewed,
may expose the local manual CONFIRM flow. Earlier account preparation and V1–V5
approvals are consumed and cannot authorize these effects. Physical W03,
LIC008/Open003, independent Windows/hardware, TPM/NV and security/production
acceptance remain open in the completion ledger.
