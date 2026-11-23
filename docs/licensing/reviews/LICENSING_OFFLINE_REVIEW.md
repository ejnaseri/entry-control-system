# Independent portable Offline workflow review

Date: 2026-09-12

Reviewed commit: `c97eb2964b0c436ed3dfa90aad8beed7c9857ea1`.

Independent reviewer: `offline_independent_review` (separate review agent,
explicitly authorized by the Project Owner). This is not an external security
certification or production-release approval.

## Decision

Limited approval of the current portable `LIC-6.2-006` implementation. No
reproducible blocking security/correctness defect was found in the reviewed scope.
The independent review of this commit is complete; do not repeat it merely
because LIC006 remains open. Material later changes require targeted review.

**LIC006 remains in progress.** Physical filesystem/storage and runtime evidence
are not supplied by this review. No production code or security policy was changed.

## Reviewed scope

- `server/src/licensing/offline/request.ts`: seven request purposes, state-derived
  identity/counters, signing/re-verification, plan provenance and registration.
- `server/src/licensing/offline/import-plan.ts`: bounded input snapshots, archived
  signed-request verification/correlation, closed intents and duplicate handling.
- `server/src/licensing/offline/entitlement-completion.ts`: six completion
  factories, complete-state CAS obligations, read-only confirmation, and
  conflict/pending/invalid/lost acknowledgement outcomes.
- `server/src/licensing/offline/rebind-device.ts`: trusted staged-key admission
  and immutable snapshot.
- `server/src/licensing/offline/file-workflow.ts`: closed metadata, bounded
  read/copy/dispatch, complete Reactivation pair and registration before export.
- Master section 6.1 contracts, the 96-case file completion matrix, 32-case file
  suite and relevant direct-completion tests. Closed LIC004/005 were not reviewed
  wholesale again; existing tests remain regression dependencies.

## Independent execution

Eight additional stdin probes passed (four in each of FULL and ATTENDANCE), using
exact cached Node `24.19.0`, `--input-type=module`, and freshly compiled production
modules. The reviewer used test-only signed fixtures and in-memory adapters:

| Probe | Expected and observed result |
| --- | --- |
| Mutate caller request ID while file reader executes | Captured original ID remains in use |
| Supply a spread-copy counterfeit model | Rejected before file I/O or commit |
| Return a different validly signed archived request ID | `STORED_REQUEST_ID_MISMATCH`, zero commits |
| Return Entitlement bytes at cap plus one | `FILE_INTAKE_FAILED`, zero commits |

The initial signed-request probe incorrectly assumed the fixture supported a
custom request-ID option. Its expectation failed; cloning and re-signing the
actual request corrected the probe, and the intended rejection passed. This is
retained as a probe-construction error, not a product defect. These eight probes
were executed ad hoc, not added to the permanent test suite.

## Nonblocking note and outstanding work

The matrix's `wrong-request-no-write` case mainly exercises a missing random
request. A permanent variant returning a competing validly signed archived
request would strengthen coverage. Existing direct suites and the independent
probe already cover stronger binding behavior; no implementation defect was found.

The following existing obligations remain open:

- Native open-object identity/link/swap/growth enforcement, physical publication
  and quarantine: actual Windows evidence, not post-read checks in a fake adapter.
- Protected request ledger, complete-state durability, crash/restart and
  unknown-outcome reconciliation, and staged-key lifecycle.
- Trusted decision-time and receipt-observation acquisition across asynchronous
  delays in the eventual Guardian integration. Portable functions accept trusted
  time; they do not acquire or prove physical elapsed-time freshness themselves.

Next work must follow the master dependency graph: Windows provider feasibility
is `LIC-6.2-008`, Guardian is `LIC-6.4-001`, and protected Store is `LIC-6.5-002`.
This review neither bypasses these gates nor changes LIC006 exit criteria.

No real License, DB, K40 device, Windows security state or production key was
modified. Full aggregate rerun evidence is recorded separately in the master.
