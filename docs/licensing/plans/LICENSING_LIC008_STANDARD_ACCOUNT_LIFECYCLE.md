# LIC008 W03 closed owned-account activation and return lifecycle

Date: 2026-11-03 UTC / November4 Kabul.
Status: `INJECTED_LIFECYCLE_READY_NATIVE_ACCOUNT_BACKEND_NOT_IMPLEMENTED`.

[W03 design](LICENSING_LIC008_STANDARD_USER_CONTROL.md) /
[previous admission increment](LICENSING_LIC008_STANDARD_ADMISSION.md) /
[completion ledger](LICENSING_LIC008_COMPLETION_PLAN.md).

This increment follows `c7cfc93`. It implements a closed account lifecycle with
injected stores, account objects and identity/exit guards. The build does not
enable, disable, log on or otherwise modify any Windows account. The actual
owned SID1023 was last independently observed disabled/Local/Users-only on
November2; current physical state still needs fresh preflight.

## Ownership, admission and explicit return

`StandardAccountLifecycle` requires the complete current scope, exact source
set and the declared W03 effects. Before opening the account and before every
mutation it rereads and hashes both original November2 ownership/completion
records. It cannot adopt another account by matching its display name.
The account snapshot must be Local, exact name/SID1023, complete direct local
membership with Users545 only, normal account flags and the expected disabled
state. Group lists are privately frozen before admission.

The trusted guard separately captures the actual elevated Owner1001 token,
validates host/boot/code custody and live input authority, and admits actual
Guardian-before/key originals plus the durable fresh logon recipe. These are
future native adapter obligations; a callback returning normally does not itself
establish physical evidence. Admission is repeated after intent persistence and
inside the backend's immediate mutation boundary.

The activation sequence writes and independently reads back a new protected
ACTIVATION_INTENT, changes only the disable bit on the exact owned account
object, inspects actual state and writes/readbacks ACTIVATED. The success result
is frozen before publishing authority for a later return operation. Reentry,
concurrent activation and instance reuse are refused.

ReturnDisabled is a separate explicit success-sequence call. It requires that
same live successful activation, unchanged original ownership/journal evidence,
actual independent held-child exit evidence and the current scope/window. It
writes/readbacks DISABLE_INTENT, repeats all evidence at the mutation boundary,
changes only the disable bit, verifies state and writes/readbacks DISABLED.
Only then can the account object lease be released. Disabling an account is not
logoff or proof that every session has ended; the result never claims either.

Each of the four originals binds the complete context, chronology, observed
snapshot and previous original digest. Typed receipts require unique file
identity, creation time, durable flush and exact original readback. The store
appends four closed file enums; only the owner source role can read/write these
records. Setup retains its key-journal/envelope API and cannot read or write
the account lifecycle journals.

Failure retains partial/unknown account and record effects and the owned lease.
There is no automatic enable/disable in a finally block, recovery/retry entry,
password reset, membership repair, profile/account removal, process termination
or blanket logoff. Expiry stops authority; it cannot manufacture a safe cleanup
result. A partially opened native object must be rooted by its backend before a
call can fail without returning it; retaining the lifecycle alone is insufficient.

## Native binding remains a separate implementation

The lease interface requires an actual SID-bound account object through each
inspect/change/readback. A name-addressed NetUserSetInfo call following a SID
check can race a replacement name and does not satisfy that contract.
Independent read-only review of the installed pinned LocalAccounts DLL and
[official PowerShell source](https://raw.githubusercontent.com/PowerShell/PowerShell/v7.4.0/src/Microsoft.PowerShell.LocalAccounts/LocalAccounts/Sam.cs)
established a possible domain-SID/RID/SamOpenUser route. No account cmdlet or
native account operation was invoked for that review.

The source snapshot explicitly calls its flags NetUserFlags: NetAPI UF_* uses
disabled2/normal0x200. SAMR UserAccountControl uses different bit positions.
A native SAM backend must use a separately tested semantic conversion, preserve
other admitted attributes and refuse unknown bits. It cannot pass one encoding
directly to the other. The backend must validate the same handle before and
after its nonreentrant evidence callback, then change/read back on that handle.
The callback verifies originals and controller evidence; it does not recursively
inspect the account lease while the backend holds its mutation lock.

Full-field account control updates do not supply atomic compare-and-swap
protection against concurrent privileged edits. Such interference must remain
an explicit unsupported/unknown result, never an implicit overwrite/repair claim.
Private SAM API layout and actual host compatibility still need implementation
and evidence. This increment deliberately supplies no native account backend.

## Closed verification and next work

`build-license-standard-account-lifecycle.ps1` snapshots28 exact inputs and
builds default, unrelated-capability and compile-only-native variants. Only
`--self-test` is reachable; account activation/disable/return, worker/service
and controller entries remain closed. Original build reports retain exact
source/tool/reference/runtime pins.

The [four exact original reports](../evidence/standard-user-account-lifecycle-v1-20261103/README.md)
record12,855 assertions and26 closed entries for each variant: account951,
store5,452 and the unchanged prior component suites. All native effect and
acceptance flags remain false; native account backend is explicitly absent.
Independent artifact review PASS,1,416 read-only assertions.

Independent source review PASS after fixing late activation revalidation,
flag-domain naming, mutable membership snapshots, callback lease reentry and
activation-result publication. Pure regressions cover every successful operation
boundary, wrong role/SID/group/state, changed original/receipt, absent held exit,
expiry, unknown post-mutation state and concurrent calls. These are injected
component tests, not physical W03 or native account compatibility.

Next implement and independently review the native SID-bound account backend,
native mutual process/token adapters (including explicitly broker-associated
read-only owner handle transfer if chosen), actual loaded runtime/code proof,
fresh SCM workers, durable one-use stages and full controller/collector. Any
physical run still needs a complete reviewed effects/binding chain, fresh
window and local manual owner CONFIRM. Previous account-preparation approval is
consumed and cannot authorize activation/logon. LIC008/Open003, physical W03,
W04/W05, independent Windows/hardware, TPM/NV and acceptance remain open.

Subsequent development: the [closed native lifecycle increment](LICENSING_LIC008_STANDARD_NATIVE_LIFECYCLE.md)
implements the separately tested NetAPI/SAM codec and retained-SID native
account source, fresh-service lifecycle and peer-object observation. This
historical lifecycle build remains the unchanged28-input snapshot. Native ABI
compatibility, bounded pending-call integration and physical execution remain
unverified; there is still no operational account entry in either executable.
