# LIC-OPEN-012 bounded native-entry amendment

Date: 2026-10-06. Amendment version: 1. Scope: both FULL and ATTENDANCE.
Status: `PRODUCT_DIRECTION_APPROVED_SECURITY_REVIEW_PENDING`.
Record: CHG0075 / LIC-EV-0144; baseline commit5ceffad plus preserved r85
operator-evidence/documentation worktree. No runtime code or dependency waiver.

## 1. Authority and activation

The Project Owner explicitly approved proceeding with the previously proposed
bounded-entry approach. Codex prepares this concrete amendment as implementer and
repository documentation reviewer, not as an independent Security approver.
Assigned Security Reviewer: NOT_ASSIGNED. Security approval: NOT_OBTAINED.
Product direction approval does not imply approval of any changed crypto policy.

This is a candidate amendment to master sections16/17.1 and the dependency cells
listed below, not an effective replacement of them. LIC-OPEN-012 stays `[!]`.
Before activation, the assigned Security Reviewer must review this exact revision,
identify findings and accept an evidence record; the Product Owner confirms the
final reviewed scope. In the same adoption change, update all named master cells
and mirrors and record the accepted decision/revision. Only then may Open012 be
closed as a scheduling-policy decision. Native entry remains blocked until ALL
its separate prerequisites are satisfied; Open012 closure cannot close LIC008.
Material amendment changes require a new review of the changed scope.

## 2. Separate entry from exit

An implementation-entry gate permits construction and isolated validation of a
bounded component. It is not component completion, License authority, an accepted
Store, a customer Installer, deployment permission or release approval.
All original full-item exits, LIC-FILE-001..005, LIC-STORE-001..005, Windows matrix,
crypto/time/binding/rollback/transition/Audit/recovery/issuer gates remain owned
by their existing checklist IDs. No native evidence moves into portable tests.

While a required native adapter is absent, production admission remains denied;
fake/in-memory stores and successful test harnesses cannot activate the app.
Existing portable results remain durable=false/runtimeAuthority=NONE. Neither
unsigned artifact hashes nor caller-supplied booleans confer runtime authority.

## 3. NATIVE-ENTRY prerequisite ledger

| ID | Required evidence | Current state |
| --- | --- | --- |
| NE-001 | Completed LIC001-005, immutable protocol/vector pins and current regressions | Existing closures recorded; fresh native-entry regression run still required |
| NE-002 | LIC008 accepted provider/ownership/algorithm/lifecycle/assurance decision and Open003 resolution | BLOCKED: V7 operator proof complete, but one-host Software-KSP evidence is not adapter/TPM/Windows-matrix acceptance |
| NE-003 | Reviewed portable Offline/Hybrid contracts plus bounded admission/Auth/Audit interface records described in section4 | PARTIAL: scoped Offline and Hybrid Reactivation/trust reviews exist; new integration interface records not yet accepted |
| NE-004 | Completed LIC011 separate Vendor authority and due Open001/002/006 decisions, no issuer secrets in customer system | NOT_STARTED: no Vendor completion evidence |
| NE-005 | All LIC6.3 current-customer-artifact gates complete with exact hashes | NOT_STARTED: prior Phase6.1/client isolation is not the complete LIC6.3 gate |
| NE-006 | Named implementer/reviewers, this amendment accepted by Product/Security, versioned interface/evidence ledger and explicit bounded work authorization | BLOCKED: Product direction approved; Security Reviewer/approval and per-slice authorization pending |

Entry is a conjunction, never an either/or: every required row must have accepted
evidence bound to the same intended scope/artifacts. Stale, missing, failed or
unknown evidence refuses entry. No V1-V7 reruns are required or authorized.

## 4. Contracts to pin before entry

These are required review artifacts, not claims that their code is implemented.

| Contract | Existing owner | Minimum concrete boundary and failure tests |
| --- | --- | --- |
| Native file session | LIC006; OfflineFileAdaptersV1 | Exact regular open-object identity, no link/reparse/swap, capped reads during growth, closed role/type, immutable byte snapshot, quarantine/publication collision and unknown outcome; FILE001-005 |
| Complete-state transaction | LIC006/007; OfflineEntitlementCommitAdapterV1 and Hybrid Store adapters | Compare generation AND hash; complete state/request consumption/receipts/journal/outbox/anchors; flush/reconcile before acknowledgement; retained exact request bytes; no uncertain rollback or automatic stale retry; STORE001-005 |
| Clock and trust acquisition | LIC005/007/009 | Trusted observation/receipt freshness across awaits; same-boot monotonic evidence; reproduce rejected OBSERVE_TIME SIGNING_KEY_DENIED diagnostic; unchanged historical projection cannot authorize business work |
| Runtime barrier and leases | LIC009/LIC6.4.004 | Bind process/build/generation/boot/expiry and scope; serialize transitions; pending/hung/unknown-commit refuses operations; stop process tree/drain DB and classify in-flight K40 commands without replaying them |
| Guardian/App/Setup ownership and IPC | LIC6.4.001..003 | Exact identities/peer tokens, manifest/publisher checks, purpose-bound proxy/pipe, constrained one-shot Setup plans, TTL/orphan reconciliation; no arbitrary signing/execution or private-key return |
| Restricted status/Auth/recovery | LIC010/LIC6.4.005 | Redacted status and permissions, fail-closed direct URLs, fixed Emergency Backup operation even if Node/journal is unavailable; no Restore/business/unlock bypass |
| Journal/outbox/projection | LIC012/LIC6.5.005 | Authoritative external event durability vs idempotent redacted DB projection, secret-canary tests, failure/duplicate/Restore reconciliation; projection acknowledgement cannot become License authority |

Existing source interfaces do not silently change. No protocol wire/schema, key
creation ownership, algorithms, time/commercial policy, event taxonomy or Windows
scope is changed by this scheduling amendment. A required policy change returns
to its existing Product/Security decision gate.

## 5. Candidate implementation-entry graph

Every dependency below is an accepted entry/interface slice, not its full owning
item's exit. In particular, NATIVE does not depend on full Phase6.2 completion,
and Store/DB entry does not depend on full Guardian/Installer completion.
This graph is a scheduling model only; it is not executable admission software.

| Node | Dependencies | Meaning |
| --- | --- | --- |
| CORE | - | LIC001-005 closures and pinned contracts |
| ADAPTER | CORE | Accepted LIC008/Open003 feasibility and limitations |
| VENDOR | CORE | LIC011 and due Vendor decisions |
| CONTRACTS | CORE | Accepted section4 portable/integration contract slices |
| ARTIFACT | CORE,VENDOR | Completed LIC6.3 on actual current customer artifact |
| REVIEW | CONTRACTS | Assigned Security and final Product approval of amendment/slices |
| NATIVE | CORE,ADAPTER,VENDOR,CONTRACTS,ARTIFACT,REVIEW | All NE-001..006 accepted |
| GUARDIAN_SLICE | NATIVE | Ownership/identity/integrity/IPC implementation and isolated tests |
| APP_SLICE | GUARDIAN_SLICE,CONTRACTS | Peer-authenticated App/Node Host and denied-until-ready barrier |
| SETUP_SLICE | GUARDIAN_SLICE,APP_SLICE,CONTRACTS | Reviewed purpose-bound provisioning/bootstrap; no arbitrary plan |
| DB_SLICE | GUARDIAN_SLICE,APP_SLICE,SETUP_SLICE | Private DB roles/credentials/ACLs for bounded integration |
| STORE_SLICE | GUARDIAN_SLICE,APP_SLICE,ADAPTER,CONTRACTS | Protected native transaction/journal/anchor implementation |
| FILE_SLICE | STORE_SLICE,CONTRACTS | Real acquisition/publication and request-ledger integration |
| INTEGRATION | DB_SLICE,STORE_SLICE,FILE_SLICE,APP_SLICE | Native runtime/Auth/Audit/Backup/transport reconciliation |
| EXIT_62 | INTEGRATION,VENDOR | Full LIC001-013 and retained FILE/STORE/runtime acceptance |
| EXIT_64 | INTEGRATION,SETUP_SLICE,ARTIFACT | Full signed services/Installer/recovery/lifecycle acceptance |
| EXIT_65 | INTEGRATION | Full DB/Store/ACL/Backup/external-Audit acceptance |
| RELEASE | EXIT_62,EXIT_64,EXIT_65,ARTIFACT | Complete Phase6.6 incl Windows matrix, signing, K40, independent approval |

EDGE CHECK: full EXIT_62/64/65/RELEASE may never become predecessors of NATIVE or
its implementation slices; doing so reintroduces the closure cycle. Full exits
still converge at RELEASE and are not waived by the entry graph.

## 6. Exact master locations to amend after review

| Location | Proposed change on adoption | Unchanged acceptance |
| --- | --- | --- |
| Section16 and17.1 Phase6.4 entry; LIC6.4.001 dependencies | NATIVE permits bounded Guardian construction, not completed Phase6.2 | Full Guardian identity/crash/restart/integrity and all Phase6.4 exit evidence |
| LIC6.4.002..005 dependency cells | Distinguish accepted GUARDIAN/APP/SETUP interface slices needed to start vs full exit prerequisites | Authenticated IPC, transition barriers and actual recovery/Backup evidence |
| Section17.1 Phase6.5 entry; LIC6.5.001 dependencies | Accepted DB_SLICE prerequisites replace full Phase6.4 exit as implementation entry | Private PostgreSQL credentials/roles, migrations and Backup evidence |
| LIC6.5.002 dependencies | Accepted Guardian/App slices plus LIC008/contract evidence permit Store implementation | Full durable atomic Store/anchor/rollback/crash evidence |
| LIC6.5.003..005 dependency cells | Pin actual DB/Store/recovery/event interface slices for integration entry | Real cross-role ACL, Restore isolation and journal/outbox/projection matrices |
| Section17.1 exits and LIC006/007/009/010/012/013 | Make entry-vs-exit language explicit only | All existing full-item closures and phase aggregate tests |
| Open012, phase mirrors and session handoff | Record accepted revision/review IDs and closure of scheduling decision only | All other Open items and incomplete implementation statuses |

## 7. Immediate work and exclusions

1. Assign the Security Reviewer and obtain review of this exact amendment; record
   findings and their disposition. Do not represent implementer review as independent.
2. Apply reviewed master dependency changes in one synchronized adoption update.
3. Satisfy the NATIVE ledger; many prerequisites remain incomplete even after adoption.
4. Activate only a named bounded slice once its entry record is accepted, then
   retain every original exit for later real integration and release acceptance.

No production Guardian/Store/Installer code, customer data, service/ACL/key mutation,
secret provisioning, Vendor key ceremony, new Windows test or V7 replay is authorized
by this draft. No commit or external reviewer assignment is performed here.

## 8. Draft validation record

2026-10-06, implementer Codex: in-memory graph validation found all18 unique
nodes, resolved every dependency and produced an acyclic topological order.
Documentation resolver self-tests PASS:42 Markdown files/163 local targets.
Exact Node24.19.0 protocol-v1 package/schema/corpus checks PASS; git diff --check
PASS. These checks validate draft consistency, not independent Security approval,
real native implementations or satisfaction of any NATIVE entry prerequisite.
