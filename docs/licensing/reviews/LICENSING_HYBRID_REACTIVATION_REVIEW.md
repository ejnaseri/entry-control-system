# LIC007 Hybrid Reactivation targeted review

Review date: 2026-09-19. Reviewed production commit:
`2a6fb873e5b5ab5af23d165072a247da94d4ef6d`.

Reviewer: Codex, separate targeted review pass. This is a portable software
review; it is not Windows, protected-storage, HTTPS, service-barrier or runtime
admission approval.

## Result and scope

No reproducible blocking defect was found in the new Hybrid Reactivation
handoff. The review covers only the changes introduced by `2a6fb87`:

- `reactivationTarget` in the state machine;
- the `CHECK_IN` request target `REACTIVATION`;
- `hybrid/reactivation-response.ts`; and
- their 48 both-Edition tests and documentation.

The completed LIC006 review at `ad5c209` and the earlier Hybrid/trust reviews
were not repeated. The frozen protocol schemas and commercial/time policy were
also checked as unchanged by the reviewed commit.

## Review checks

The review confirms the following behaviour from the compiled production code,
the focused matrix, and source/data-flow inspection:

| Check | Result |
| --- | --- |
| No intermediate authority | `reactivationTarget` returns only a defensive parent snapshot; it neither seals state nor consumes a request. |
| Exact old request | The new target accepts only a signed archived `REACTIVATE` request with matching ID. |
| Exact new request | Completion independently loads a signed archived `CHECK_IN` request and passes both requests to the core transition. |
| Three required artifacts | Authorization, separate Entitlement and Lease are all required; missing or altered artifacts fail before a Store commit. |
| Atomicity | Completion calls the Store once with one proposed state; it consumes two requests and the Authorization only in that proposal. |
| Replay/collision resistance | Authorization replay, stale plans, conflicting CAS, wrong lineage, parent/generation/request mismatch and token collision reject. |
| Restrictions retained | Tombstones and independent recovery/tamper locks remain after successful reactivation. |
| Rebind boundary | A directly bound new lineage retires the previous binding-recovery override before request/Lease verification. |
| Closed variants | Control/trust sidecars, TIME_RECOVERY and an open time incident are rejected. |
| Authority boundary | Every public result remains `durable=false` and `runtimeAuthority=NONE`; no runtime switch is performed. |

Fresh strict TypeScript compilation exits successfully. The already recorded
final validation for this exact committed source is `48/48` focused cases,
`328` Hybrid cases in the aggregate, and the Golden pass with identical Vendor,
Node and .NET verdicts. See `LIC-EV-0087` in
[LICENSING_DESIGN.md](../design/LICENSING_DESIGN.md).

## Remaining scope

The review does not prove physical Store atomicity, protected read-back after a
lost acknowledgement, real HTTPS delivery/reconciliation, service admission,
Windows file intake, TPM/CNG/DPAPI-NG or ACL behaviour. Mixed Reactivation with
Control/trust sidecars and Time Recovery remains deliberately closed until its
own bounded design and tests exist. LIC007 and the Release Gate remain open.
