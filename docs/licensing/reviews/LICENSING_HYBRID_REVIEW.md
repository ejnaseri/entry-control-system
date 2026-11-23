# LIC007 portable Hybrid independent review

Review date: 2026-09-12. Reviewed production commit:
`e88d0caecab54cd824e14b5820ab3fce03cf116b`.
Independent reviewer: `hybrid_independent_review`; coordinator: Codex.

## Result and scope

No reproducible blocking defect was found in the reviewed portable Hybrid
request/response checkpoints and the new Lease-plus-Control composition.
The independently authored probe suite passes **28/28** cases across FULL and
ATTENDANCE. This completes this bounded independent review, not LIC-6.2-007,
physical persistence acceptance, or production/runtime approval.

The contract reviewed was [LICENSING_DESIGN.md](../design/LICENSING_DESIGN.md), especially
purpose separation, activation-global Control revisions, request correlation,
the LIC007 checkpoint contracts, Hybrid check-in and secure-state obligations.
Production review covered:

- `server/src/licensing/hybrid/request.ts`: signed request preparation, provider
  boundaries, conservative time evidence and registration acknowledgement.
- `server/src/licensing/hybrid/lease-response.ts`: primary and combined carrier
  intake, separate request correlation, proposal provenance and complete-state
  acknowledgement.
- `server/src/licensing/hybrid/control-response.ts`: CHECK_IN-only dispatch,
  independently authorized Control and stale transport context restrictions.
- `server/src/licensing/core/v1/state.ts` and `state-types.ts`: the added
  `IMPORT_LEASE_CONTROL` command, revision-based reduction order, original
  generation, historical receipts, time recovery and one final seal.

Existing reducers/validators were followed where this new composition invokes
them. The completed LIC006 review at `ad5c209` was not repeated. The independent
reviewer changed no production file and ran no native Windows security, service,
key, registry, database or runtime operation.

## Independent evidence

The new runner is
`scripts/test-license-hybrid-independent-review.mjs`. It uses real deterministic
signed test fixtures and the compiled production verifier/state machine, with
in-memory request/store adapters. It loads and checks the production dependency
graph before importing TEST_ONLY fixtures. It does not call the implementer's
Hybrid case functions or rebuild the server.

Run after the normal Hybrid aggregate has built `server/dist`, using Node
**24.19.0**:

```powershell
& 'C:/Users/Owner/AppData/Local/npm-cache/_npx/09ae5d3560c7b1f2/node_modules/node/bin/node.exe' scripts/test-license-hybrid-independent-review.mjs
```

Each of these 14 named cases runs in both Editions; matrix cases contain several
branches, counted as one case per Edition:

| Probe | Expected and observed result |
| --- | --- |
| Control revision order cross-product | Lease revisions 0/1/2 relative to sidecar Control 1 yield one proposed generation and two receipts; no pre-completion commit |
| Cross-type token ID collision | Lease and Control sharing a token ID reject atomically |
| Wrong-purpose sidecar signer | Online Lease key cannot authorize Offline Control |
| Cross-Edition sidecar | Valid Lease cannot carry unauthorized other-Edition Control |
| Fresh request wrapping historical pair | Exact historical artifacts reject under a newly issued request before receipt acknowledgement |
| Control-only partial receipt | Already-applied Control cannot turn a combined carrier into a fresh Lease-only write |
| Duplicate after new time incident | Historical CHECK_IN acknowledgement stays read-only and preserves the incident |
| Revoke followed by higher operational Lease | Terminal Control cannot be cleared by Lease ordering |
| Time-recovery latency | Response after the 300-second bound cannot apply its Control or clear the incident |
| Expired recovery sidecar | Invalid Control leaves the recovery and original model untouched |
| Successful recovery replay | Recovery succeeds once; exact combined replay rejects |
| Authenticated-time validity in both orders | With signed time advanced 120 seconds, Control expired at +60 rejects; Control becoming valid at +120 succeeds at Lease revisions 0/1/2, retaining one generation |
| Future-effective Control | Equal/higher-revision Lease combinations preserve operation before the scheduled suspension and lock at its effective time |
| Partial-state acknowledgement | Matching new generation with old state hash never reports success |

The source also preserves separate verification of REQUEST_BOUND Control against
its own signed CONTROL request, rather than interpreting outer carrier correlation
as authority. The coordinator's full existing aggregate exercises those request-
bound paths and the earlier request/primary/control checkpoints. The coordinator
reran `scripts/test-license-hybrid-v1.mjs` with exact Node24.19.0, exit0:
request52/52, primary48/48, control44/44, combined48/48, plus the Core, State, Time
and Offline regression aggregate. Its log is the ignored
`out/lic007-independent-baseline.log`; this coordinator rerun is separate from
the independent28 probes. The probe runs emitted their JSON directly to the
review tool transcript; there is no separate probe log file. Aggregate details
are recorded separately in the master's append-only Evidence Log.

Execution history is retained: the initial 24-case suite passed24/24. The expanded
suite first passed26/28: both new advanced-time positive fixtures incorrectly left
`offlineUntil`/`notAfter` at their old values and were correctly rejected with
`LEASE_OFFLINE_UNTIL_FORMULA_MISMATCH`. Updating those fixture bounds to the new
signed time produced final28/28, exit0. No production change or rule waiver was
needed. Read-only exploration also corrected two guessed nonexistent source/test
paths using `rg`; those path lookup failures did not execute product tests.

## Limits and next work

Two historical receipts confirm two previously authenticated facts, not proof
that they originally committed together. The documented combined retry is only a
read-only acknowledgement; partial receipts reject and terminal Lease replay is
still refused. This is consistent with the checkpoint contract.

Store acknowledgements remain trusted adapter reports with `durable=false` and
`runtimeAuthority=NONE`. In-memory atomicity cannot prove physical old-or-new
power-loss behavior, protected ledger reconciliation, ACLs, key isolation, or
rollback-resistant anchors. Those remain under LIC006/LIC008/Guardian/Store and
LIC-OPEN-012; this review does not waive their dependencies.

Root-signed trust updates, Hybrid Reactivation carrier orchestration, actual HTTPS,
Vendor challenge consumption, delivery reconciliation and retry/backoff are
explicitly unfinished scopes, not defects disguised as completed functionality.
The next software checkpoint may address the ordinary CHECK_IN trust-update
carrier, while retaining the absolute prohibition on trust updates during
TIME_RECOVERY and the existing frozen signer/protocol boundaries. Full LIC007
closure still requires completion and review of its remaining scope.
