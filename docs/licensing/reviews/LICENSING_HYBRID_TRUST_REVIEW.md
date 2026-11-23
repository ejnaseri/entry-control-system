# LIC007 trust coordination independent review

Date: 2026-09-13. Reviewed production commit:
`53a7d74a75fbf58a2c1de83414c7d0de0db40274`.
Reviewer: `hybrid_independent_review`; coordinator: Codex.

## Scoped result

No reproducible blocking defect was found against the current portable trust
coordination contract. Independent probes finish **28/28**, comprising 26
acceptance/rejection checks and two diagnostic clock-boundary checks (one per
Edition). The diagnostics expose a concrete runtime integration obligation below;
their passing result is not runtime security approval.

This review covers new `hybrid/trust-response.ts`, `hybrid/trusted-response.ts`,
`core/v1/trust-update.ts`, `stageTrust`/retained-trust checks in `state.ts`, their
types, and the related `lease-response.ts` ownership check. It applies the current
r42 contract in [LICENSING_DESIGN.md](../design/LICENSING_DESIGN.md), including trust
purpose/cumulative-update rules, the coordinated response checkpoint and section
8.4's clock provenance and neutral-rejection requirements. Prior e88d0ca Hybrid
composition and LIC006/ad5c209 review were not repeated wholesale.

No production files were changed. All signatures are real deterministic TEST_ONLY
Root/delegated/installation signatures; persistence and request readers are memory
adapters. No Windows service/key/registry/ACL, HTTPS, DB/K40 or runtime action was
performed. LIC007 and physical/native acceptance remain open.

## Independent probes

Runner: `scripts/test-license-hybrid-trust-independent-review.mjs`. It loads and
checks the compiled production dependency graph before importing fixture helpers;
it does not import the implementer's Hybrid test-case functions. The normal
aggregate must first compile `server/dist` from the reviewed source. Run with
exact Node24.19.0:

```powershell
& 'C:/Users/Owner/AppData/Local/npm-cache/_npx/09ae5d3560c7b1f2/node_modules/node/bin/node.exe' scripts/test-license-hybrid-trust-independent-review.mjs
```

Each named scenario runs in FULL and ATTENDANCE:

| Scenario | Observed result |
| --- | --- |
| Sibling trust branches | A state newly produced by one branch is refused by its sibling and predecessor |
| Later predecessor state | A branch refuses a subsequent state created by its predecessor |
| Denied retained parent | A new Lease cannot hide denied Entitlement authority; no commit |
| Immediate old-key replacement | Newly denied old Lease is replaced by authorized new-key Lease in one complete handoff; original state is unchanged before completion |
| Scheduled new-key denial | Projection succeeds immediately before denial and refuses at effective UTC in the pre-clock trusted-time seam |
| Machine/configuration mismatch | Divergent trusted-key configuration rejects before commit |
| Caller configuration mutation | Root/key array mutation after factory creation cannot rewrite pinned trust |
| Archived request memoization | Exactly one read supplies the stages; later buffer mutation cannot alter the prepared proposal |
| Partial acknowledgements | New state with old trust hash, or new trust with old state hash, never publishes a machine |
| State CAS conflict | State advancement invalidates the complete trust/license plan |
| Historical receipt under denial | Branch receipt shortcut refuses a newly denied retained Lease signer |
| Existing time incident | Both trust response and direct staging refuse updates |
| Clock crossing denial (diagnostic) | Observation is rejected with original state; projecting that historical clock-managed state does not prove the rejected observation |
| Signed-time replacement | Fresh valid replacement plus receipt observation crosses old-key denial and advances floor atomically while retaining operational new-key authority |

Execution history: initial24/24 passed. Expanded28 first passed26/28: the two
clock diagnostics incorrectly assumed that providing an import receipt observation
initializes the pre-clock model. The model correctly retained its pre-clock seam.
The fixtures now explicitly perform `OBSERVE_TIME` and then issue a fresh request.
Final28/28 passed, exit0. This was a fixture correction, not a production fix or
policy waiver. JSON results were emitted to the review tool transcript.

The coordinator separately reruns the existing Core/State/Time/Offline/Hybrid
aggregate; its outcomes and log path belong in the master's append-only Evidence
Log. Those regressions are separate from these independently authored probes.

## Clock-boundary integration obligation

The tracked-clock diagnostic reproduces this exact sequence in both Editions:

1. Initialize a clock-managed state and accept a Lease whose signing key is denied
   by the staged Root-signed trust snapshot at `f.now + 100`.
2. Submit a consistent same-boot `OBSERVE_TIME` at that boundary, with monotonic
   elapsed100 seconds. The candidate crosses the effective denial.
3. `state.ts:591`–`599` returns `ok=false`, `SIGNING_KEY_DENIED`, and the original
   state. No candidate state or new authority is published.
4. Calling `project` on that original state with a later ordinary `trustedNow`
   still uses the old corroborated/observed clock values. It can return an
   operational historical projection.

This is not evidence that denial enforcement succeeded at runtime. Section8.4
requires every rejected transition to remain neutral and forbids ordinary caller
UTC from advancing a clock-managed floor; the present portable API grants no
runtime capability. Therefore the sequence is not classified as a violation of
those frozen portable guarantees. It is an explicit **runtime integration gate**:
after a failed observation/retained-trust check, the future coordinator must not
admit operations by projecting the unchanged last state. It must treat that
failure as an unsuccessful authorization evaluation until valid replacement or
reconciliation succeeds. Tests must cover this sequence at runtime before that
gate can close. No new persisted lock, clock policy or automatic state mutation
is prescribed by this review.

The companion signed-time replacement probe confirms that a valid new-key Lease
with trusted receipt observation can cross the old-key denial atomically; this
review did not reproduce a general replacement dead end.

## Remaining scope

Accepted Control history/tombstones retain the explicitly documented semantics;
this review does not invent denial-driven undo of historical Control facts.
Branches revalidate retained current/pending Entitlement and Lease authority,
including `pendingCurrentLease`, rather than reimporting expired historical
claims. Old verifiers/models still exist as objects; retiring them is an explicit
coordinator/runtime obligation, not an accomplished effect of a portable return.

Dual CAS and complete acknowledgements are adapter contracts, not proof of
physical atomicity, power-loss durability, protected anchors or live switching.
Results remain `durable=false` and `runtimeAuthority=NONE`. Reactivation, real
transport/delivery/reconciliation, Guardian/Store integration and physical Windows
acceptance remain open. This scoped review does not close LIC007.
