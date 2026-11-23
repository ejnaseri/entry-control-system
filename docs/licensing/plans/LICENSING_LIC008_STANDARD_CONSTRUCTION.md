# LIC008 W03 closed input, protected store and key-construction components

Date: 2026-11-03.
Status: `CLOSED_SOURCE_AND_BUILD_READY_PHYSICAL_CONTROLLER_NOT_IMPLEMENTED`.

Subsequent [closed admission increment](LICENSING_LIC008_STANDARD_ADMISSION.md)
implements worker-channel sequencing, compile-only local pipe transport and
held file custody. The remaining-runner list below records this construction
checkpoint; see that later contract for current integration obligations.

[W03 design](LICENSING_LIC008_STANDARD_USER_CONTROL.md) /
[previous closed components](LICENSING_LIC008_STANDARD_COMPONENTS.md) /
[completion ledger](LICENSING_LIC008_COMPLETION_PLAN.md).

This source increment follows `bece78d`. It does not enable the owned disabled
account, create a persisted key or service, or execute the physical W03 comparison.
The previous disabled-account preparation and all consumed V1–V5 attempts remain
separate evidence. Their approvals cannot authorize a new native operation.

## Input originals and hash graph

`StandardInputCodec` accepts only bounded, strict UTF8 canonical JSON. It rejects
BOMs, malformed encoding, duplicate or unknown properties, omitted fields,
case/order/whitespace changes, extra payload members, noncanonical hashes and
non-UTC or expired windows. The plan pins the exact fixed account and original
account records, fresh resource names and derived service SIDs, two ordered
payload files, effects, source set, package, runtime, image, host and boot.

The plan contains neither its own digest nor an approval digest. Hash the exact
plan original, encode an approval that binds that digest, then hash the exact
approval original. Only then derive the complete execution scope. The approval
window must lie inside the plan window. This avoids a circular self-hash.

Parsing does not authenticate owner identity, host or boot, original-file
custody, one-use intent or live local confirmation. `NativeAuthorized` stays
false. Producing a confirmation string is not evidence that the owner entered it.

## Fixed protected store

`StandardProtectedStore` uses closed file/directory enums under the fresh fixed
root. Creation never becomes open-if, replacement, permission repair or cleanup.
The native adapter requests atomic relative `NtCreateFile(FILE_CREATE)` with the
protected descriptor attached at creation. Each origin pins volume/file ID,
creation time, exact final path, type, link count, length, digest and descriptor.
Held parent and read handles, exact original readback and a durable flush precede
a successful typed receipt. Every operation requires the admitted scope/window
and the separately supplied custody guard. Serialized provenance alone is not
authority to reopen a path.

All owned store objects require Administrators owner/group and exact protected
SYSTEM/Administrators access. Only fixed public inputs, binaries and synthetic
envelopes grant the exact test user and fresh Guardian read/execute access.
The test user and Guardian have no report-file write path. Guardian report
originals must come through a future authenticated channel and be written by the
owner collector. The implementation does not assume an unobserved Guardian
TokenPrimaryGroup or repair a virtual account's group/permissions.

The exact descriptor parser intentionally refuses Windows-equivalent encodings
with unadmitted control bookkeeping or spare bytes. No physical run has yet
established the descriptor formatting returned on this host. A refusal preserves
the partial fresh scope; it does not authorize widening the descriptor contract.
The native relative-directory option combination is likewise compile-checked,
not physically accepted on this host or a Windows support-matrix target.

## Fresh key construction and original journals

`StandardKeyCreationLifecycle` admits the exact fresh SYSTEM Setup service token
and source-bound context before every effect. It writes/readbacks an immutable
durable intent before native creation, inspects the actual created key, closes
that handle, independently reopens it and requires identical public/descriptor
identity. Ownership originals precede completion, and both ownership originals
must exist before either completion original. The six originals bind the full
scope, source set, key arm/name, chronology and predecessor digests.

The compile-only native backend requests machine Software-KSP RSA3072, decrypt
usage1, export policy0 and the complete protected SYSTEM/Guardian descriptor
(plus the exact test user for the accessible positive control) before finalize.
There is no overwrite, key deletion, private export, adoption or retry. An
unavailable name probe is only a BAD_KEYSET observation; successful atomic
creation without overwrite is also mandatory. Raw native substage/status remains
separate from managed HResult. Failed writes, finalization, guard checks, reopen
or releases retain partial/unknown effects rather than manufacture no-effect
evidence or perform a recovery write.

## Closed build and remaining runner

The separate `build-license-standard-construction.ps1` snapshots and pins this
increment and the prior component sources. Default, unrelated-capability and
compile-only-native variants expose only synthetic self-tests. Native store,
key-creation, launch, service, worker and controller routes remain closed.

[Four original build reports](../evidence/standard-user-construction-v1-20261103/README.md)
record the final twenty-source build: each variant passes8,762 assertions and18
closed entries (identity305/launch270/credential40/comparison1,976/primitives447/
codec259/store4,736/creation729). Independent source and artifact review PASS
(1,360 read-only artifact assertions). Source snapshots,
installed tools/references/compiler/runtime pins are rehashed after all tests;
this includes the builder's own input. No physical result is inferred from counts.

The next complete runner still needs authenticated worker admission and report
transport, held executable/runtime custody, fresh SCM services and pre-operation
process/token proof, current exact account/membership checks and declared
activation/return-to-disabled effects, controller sequencing and independent
original collection. In particular, observing a service after it has already
accessed a key is insufficient: every worker must wait for the controller's
scoped one-use grant before any key operation.

After implementation, independently review the complete source, exact artifacts
and effects. Any physical run requires a fresh input window and the owner's live
manual local CONFIRM; never reuse the account-preparation approval. Actual W03,
W04/W05, independent hardware/Windows, TPM/NV, LIC008/Open003 and
security/production acceptance remain open.
