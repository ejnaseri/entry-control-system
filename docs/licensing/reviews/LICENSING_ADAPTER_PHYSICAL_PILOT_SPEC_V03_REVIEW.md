# Limited author consistency review — pilot key-collision correction0.3

Date: 2026-10-12 (Asia/Kabul). CHG0131 / LIC-EV-0200.
Baseline: `c02280c39e58ef60bcc07670b6740166c1646fb9`, initially clean worktree.
Verdict: `DOCUMENT_DIRECTION_SUPPORTED_WITH_IMPLEMENTATION_GAP_AND_GATES_OPEN`.
Reviewer: author/coordinator `/root`; NOT an independent/non-author review.
No subagent delegation, native calls, build/test rerun or physical acceptance.

## Scope and exact inputs

Review the six criteria in [successor0.3](../plans/LICENSING_ADAPTER_PHYSICAL_PILOT_SPEC_V03.md)
against preserved0.1+ownership0.2 and current disconnected source. This is an
assessment of document consistency plus a narrow source comparison, not a full
security audit of the native runtime/controller or adopted executable contract.

| Input | Raw SHA256 |
| --- | --- |
| Specification0.1 | 8e50ace849f4f542e096532dda6d45314bb1508f93bb8c83e85728efb5155452 |
| Ownership correction0.2 | f2859ad5a1d3bd5a41f2cec89448ac98ca042585118ecd9b40d08d2bf3916706 |
| Successor0.3 | dfce64538c6fd13aa0891996f9ee94b7807c9e210be3060b508b66f2e75848d6 |
| Original implementation-packet.json | 8d182ccd61ed911b1d9019a3426c6d3725cbf268e3b57cdc064544cb21aa822e |
| KeyOperations.cs | 655ea6816bde835af535f2514f25a5b5b480b16e6cf7b1aee6709e914337186f |
| RoleActions.cs | 116ece039b8728a63974d5f29a171ecf4203daed9e2a623c9e29499287075aa1 |
| BootstrapAdmission.cs | 9a70f00584534f4c872ca035b7fce1c8820b2301e5cd1e00b0ef19f33ed68e9a |

Also inspected NativeWorker lifecycle handling and original specification's key,
stage/failure/report sections. Source hashes bind the observations, not a build
approval. Reviewed target/reference/code/packet bytes remain unchanged.

## Six bounded checks

| Criterion | Document/source assessment |
| --- | --- |
| 1. Narrow replacement, root/service absence and no UNKNOWN override | Supported at document level.0.3 section2 removes the key-open prerequisite explicitly; existing BootstrapAdmission still refuses, not silently bypassed. Root/service plain-path/pins remain required. |
| 2. Original Setup, two exact names once/no overwrite | Supported at document level. KeyOperations.Create currently uses0x20/legacy0, not0x80; RoleActions attempts restricted then app-readable with no retry branch. No new helper/permission authorized. |
| 3. Intent/finalize/owned record and partial-state retention | Supported at document level; implementation completion still required. Intent precedes creation, partial first/second failure blocks publication, no adoption/delete/rollback. See V03-I01 below for persisted-name readback. |
| 4. Original schema/report budget and lifetime gates | Supported at document level. No added reports/files/stages; failures retain state and block progression. Current Step sets unknown and skips later work; NativeWorker waits real completion on timeout and never cancels/kills. Actual emitters/observer timing remain untested. |
| 5. Ownership/ACL/policy/Finish/custody preservation | Supported at document level, not full code acceptance.0.2 and0.1 section4 checks remain inherited. A bound successor packet is still needed; original packet's absent-key-before-write requirement is NOT compatible with directly executing0.3. |
| 6. Authority/tests separated | Supported. Owner authorized drafting, not exact adoption/execution.344 prior managed cases are NOT successor tests. No LIC008/REM/NE/FEP/security/native gate closure. |

No blocking contradiction was found in the narrow document direction. These six
assessments are review checks, not six new executed program test cases or a claim
that the whole implementation is ready. Independent review is not supplied by
this author's assessment and earlier unrelated reviews cannot substitute for it.

## V03-I01 — persisted-name readback is an open implementation requirement

Source evidence: KeyOperations.Create finalizes its native handle then returns
`CngKey.Open(handle, ...)`. RoleActions verifies this returned wrapper, writes
the owned record and reads the intent/owned records. That is NOT a new open of
the persisted key by its approved name. Current KeyOperations.Owned validates
record context but does not perform that key reopen.

Preserved specification0.1 section4 explicitly requires reopening and verifying
policy/public identity before writing the owned record.0.3 inherits this; its
section2 step6 does not waive it. Thus this is a source implementation gap, not
a reason to broaden the amendment or alter old specification bytes.

Required bounded implementation correction, after successor adoption/binding:

- From the successfully finalized newly created handle, verify policy/DACL and
  capture the public identity, without treating creation success as ownership.
- Open only that exact newly created name in the original provider with machine/
  SILENT options; independently verify original policy/DACL and identical public
  identity. This is post-success readback, NOT opening/adopting a collided key.
- Only after those checks create/read back the owned record; only then allow the
  next label. Failed reopen, changed identity, policy mismatch or uncertainty
  retains state and blocks owned-record creation/publication/continuation.
- Never delete/recreate/retry, grant permissions or fall back to handle-only
  verification on failure. Add managed negative coverage; actual provider/name
  persistence behavior still requires separately authorized physical evidence.

Disposition: `OPEN_IMPLEMENTATION_REQUIREMENT`, not fixed/tested this turn.
Do not implement from this review alone as an authorization to open native entry.

## Next work and gate state

1. Record an explicit adoption/binding decision for exact0.3 digest and clarify
   remaining review authority; author assessment is not independent Security
   acceptance. Prepare a separately bound successor implementation packet that
   expresses revised ordering instead of rewriting the frozen original packet.
2. Under that scoped contract, integrate bootstrap without UNKNOWN suppression,
   close V03-I01 with negative tests and preserve all physical entry refusals.
3. Complete registration/role/live-observer coordination and self-contained
   source/package/kit/archive custody; consolidated built-kit review remains.
4. Only then obtain individual owner permissions for Prepare/Fresh/Finish.

Review checkpoint complete; successor adoption/binding, V03-I01, native controller
and all production/security gates remain OPEN. Physical cases0/5. No command to
run, no services/keys/ACLs/files in ProgramData/customer/backend changes or commit
requested in this review turn. Review/status documents are uncommitted.
