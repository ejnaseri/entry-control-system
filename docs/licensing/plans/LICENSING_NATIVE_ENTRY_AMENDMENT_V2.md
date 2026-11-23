# LIC-OPEN-012 bounded native-entry amendment — v2

Date: 2026-10-07. Scope: FULL and ATTENDANCE.
Status: `REVISED_DRAFT_SECURITY_REVIEW_AND_FINAL_PRODUCT_CONFIRMATION_PENDING`.
Record: CHG0077 / LIC-EV-0146. Baseline: HEAD5ceffad plus preserved r87 docs.
Supersedes [v1 draft](LICENSING_NATIVE_ENTRY_AMENDMENT.md) as a proposal only;
v1 remains byte-preserved for its [review](../reviews/LICENSING_NATIVE_ENTRY_REVIEW.md).

## 1. Authority and unchanged boundaries

Product approved the direction and preparation of this revision, not final
adoption. Security Reviewer remains NOT_ASSIGNED; Security approval NOT_OBTAINED.
Codex is the author, not an independent approver. Master sections16/17.1 and
dependency cells remain effective unchanged; Open012 remains `[!]`.
Adoption requires exact-revision Security review, findings disposition and final
Product confirmation, followed by synchronized master/mirror updates.

Entry permits a named bounded implementation in an isolated development scope,
not product activation, deployment, completion or release. All original FILE001-005,
STORE001-005, LIC001-013, phase and Windows/Installer/K40/issuer/Audit/Backup exits
remain under their existing owners. Fake adapters remain durable=false and
runtimeAuthority=NONE. No projection, Backup, unsigned hash or caller assertion
grants authority. No crypto/wire/key-owner/assurance/platform policy is changed.
No code, service, ACL/key, DB, physical test, V1-V7 rerun or commit in this revision.

## 2. Conjunctive native-entry ledger

| ID | Required accepted evidence | Current status |
| --- | --- | --- |
| NE-001 | CORE: LIC001-005 closures, protocol/vector pins and fresh relevant regressions | Existing closures; fresh entry evidence pending |
| NE-002 | ADAPTER_ENTRY: bounded adapter decision described below, explicitly approved scope/limits and isolated failure evidence | BLOCKED; not supplied/accepted; V7 alone insufficient |
| NE-003 | CONTRACTS: individually reviewed C_* interfaces/failure contracts in section3 | PARTIAL; prior scoped reviews exist; new integration slices pending |
| NE-004 | VENDOR: completed LIC011 and due Open001/002/006 decisions, separate issuer authority | NOT_STARTED; no completion record |
| NE-005 | ARTIFACT: all LIC6.3 scans on exact current customer artifacts for the requested entry scope | NOT_STARTED; earlier isolation evidence is not all three scans |
| NE-006 | REVIEW: named owners/reviewer, accepted exact v2-or-successor amendment, versioned evidence ledger and explicit per-slice authorization | BLOCKED; independent review/final confirmation pending |

Every row is required. Missing, stale, failed or unknown evidence denies entry.

### 2.1 Adapter decision versus final product matrix — NER-001 disposition

Open003's full Windows/TPM/Software protection selection and LIC008 full exit
cannot be assumed complete before the native product/Installer exists. Therefore
this revision explicitly PROPOSES a separate ADAPTER_ENTRY decision slice under
LIC008; it does NOT require or imply early Open003/LIC008 closure. This proposed
scheduling distinction itself needs Security/Product approval before use.

Before entry, Windows Security Owner and assigned Security Reviewer must accept:

- Exact provider/API/algorithm, key ownership/usage/export policy, token/SID/DACL
  rules, envelope format, failure classification and restart/read-back contracts.
- Enumerated development OS/build/architecture/provider/TPM coverage, exact
  harness/artifact digests and isolated positive/negative evidence for that scope:
  rightful reopen/use, unauthorized peer/child refusal, export refusal, envelope
  mutation refusal, identity continuity and owned cleanup. Missing coverage is
  explicit, never default PASS. Existing evidence is reusable only if applicable.
- Exact limitations, remaining TPM/NV/rollback/snapshot risks, and fail-closed
  behavior when the requested adapter is unproved/unavailable. Software without
  TPM remains lower assurance. No silent substitution or broader compatibility.
- A Windows Security Owner ledger mapping each pending native/product matrix
  case to LIC008/Open003, LIC6.4.006 and LIC6.6.002 as applicable, with scope,
  owner, test IDs and acceptance criteria. It must cover all existing targets.

An accepted Software-only development slice does not accept TPM or Windows10,
nor permit deployment there. Unaccepted provider/platform paths cannot exercise
real protected operations; contracts/doubles are not acceptance evidence.
V7 is consumed one-host evidence, not a fleet decision; no rerun required here.
Full platform/provider feasibility selection remains LIC008/Open003; real signed
Installer lifecycle remains LIC6.4.006; full independent physical Windows matrix
remains LIC6.6.002. None is moved, waived or automatically marked complete.

## 3. Explicit reviewed contract nodes

Each C_* node is a design/interface slice with enumerated negative tests, named
owner, accepted revision and evidence digest. It is NOT its owner's full exit.

| Node | Owner | Minimum retained boundary/test obligations |
| --- | --- | --- |
| C_FILE | LIC006 / Core Owner | Open-object identity; reparse/link/swap/modification refusal; read-growth caps; immutable bytes; quarantine/publication collisions and uncertain result; FILE001-005 |
| C_TXN | LIC006/007 / Core and Windows Security Owners | Generation AND hash CAS; whole state/consumption/receipts/journal/outbox/anchors; flush/read-back/reconcile; unknown acknowledgement never rollback or stale retry; STORE001-005 |
| C_CLOCK | LIC005/007/009 / Security Owner | Trusted time/trust freshness across awaits, same boot; rejected OBSERVE_TIME/SIGNING_KEY_DENIED cannot admit from historical projection |
| C_GATE | LIC009/6.4.004 / Backend and Host Owners | Process/build/generation/boot/expiry leases; serialized transition; pending/hung/unknown refusal; process stop, DB drain and K40 indeterminate classification/no replay |
| C_AUTH | LIC010 / Backend/Client Owner | Redacted status/permissions/direct-URL fail-closed shell; narrow Emergency Backup, no business/Restore/unlock bypass |
| C_IPC | LIC6.4.001..003 / Host and Installer Owners | Exact peer token/identity/publisher/manifest, scoped IPC/proxy, one-shot constrained Setup, TTL/orphan rules; no private key or arbitrary execution |
| C_AUDIT | LIC012/6.5.005 / Audit and Windows Security Owners | Complete taxonomy, recursive secret-canary redaction; authoritative journal/sealed outbox vs idempotent projection; duplicate/outage/Restore reconciliation |
| C_RECOVERY | LIC010/6.4.005/6.5.004 / Recovery Owner | Fixed Guardian Backup even with Node/journal unavailable; DB/state/key exclusion and Restore isolation; auditable degraded-operation backfill |

## 4. Expanded entry graph

Dependencies are accepted prerequisite slices, not full checklist closures.
Nodes name the entry to construct the described slice; a downstream dependency
requires that slice's scoped tests/evidence accepted, not just construction started.
ARTIFACT scans the current portable/customer entry artifact, not future native
bits; later generated bits trigger section6 rescans. Vendor operational gates
are retained as a full pre-entry prerequisite, not replaced with issuer doubles.

| Node | Dependencies | Meaning |
| --- | --- | --- |
| CORE | - | LIC001-005 closures and current regressions |
| ADAPTER_ENTRY | CORE | Section2.1 bounded decision, not Open003 closure |
| VENDOR | CORE | LIC011 and due Vendor decisions complete |
| C_FILE | CORE | Reviewed file interface |
| C_TXN | CORE | Reviewed transaction interface |
| C_CLOCK | CORE | Reviewed clock/trust interface |
| C_GATE | C_CLOCK | Reviewed admission/transition contract |
| C_AUTH | C_GATE | Reviewed restricted status contract |
| C_IPC | CORE | Reviewed ownership/IPC contract |
| C_AUDIT | C_AUTH,C_GATE,C_TXN | Reviewed journal/outbox/projection contract |
| C_RECOVERY | C_AUTH,C_IPC,C_AUDIT | Reviewed fixed Backup contract |
| CONTRACTS | C_FILE,C_TXN,C_CLOCK,C_GATE,C_AUTH,C_IPC,C_AUDIT,C_RECOVERY | All required design slices |
| ARTIFACT | CORE,VENDOR,CONTRACTS | LIC6.3 exact current entry-artifact scans |
| REVIEW | CONTRACTS | Exact amendment and slice approval, not author self-approval |
| NATIVE | CORE,ADAPTER_ENTRY,VENDOR,CONTRACTS,ARTIFACT,REVIEW | All NE rows and named bounded authorization |
| GUARDIAN_SLICE | NATIVE | Guardian ownership/integrity/IPC base |
| APP_SLICE | GUARDIAN_SLICE,C_IPC | Authenticated App and denied-until-ready Host |
| SETUP_SLICE | GUARDIAN_SLICE,APP_SLICE,C_IPC | Purpose-bound provisioning/bootstrap |
| DB_SLICE | GUARDIAN_SLICE,APP_SLICE,SETUP_SLICE | Private PostgreSQL roles/secrets |
| STORE_SLICE | GUARDIAN_SLICE,APP_SLICE,ADAPTER_ENTRY,C_TXN,C_AUDIT | Durable state/anchors/journal primitives |
| ACL_SLICE | DB_SLICE,STORE_SLICE,SETUP_SLICE | Exact cross-role ACL plan and denial |
| FILE_SLICE | STORE_SLICE,C_FILE | Real file/request-ledger integration |
| GATE_SLICE | APP_SLICE,STORE_SLICE,C_GATE,C_CLOCK | Real admission/coordinator integration |
| AUTH_SLICE | GATE_SLICE,C_AUTH | Restricted Client/Auth integration |
| RECOVERY_SLICE | GUARDIAN_SLICE,SETUP_SLICE,DB_SLICE,ACL_SLICE,C_RECOVERY | Signed fixed Backup/verify |
| BACKUP_SLICE | RECOVERY_SLICE,DB_SLICE,STORE_SLICE,ACL_SLICE | Normal/Emergency Backup and Restore isolation |
| AUDIT_SLICE | STORE_SLICE,AUTH_SLICE,BACKUP_SLICE,C_AUDIT | Production projection/backfill/Restore integration |
| TRANSITION_SLICE | GUARDIAN_SLICE,APP_SLICE,DB_SLICE,STORE_SLICE,GATE_SLICE | Durable pending/process-tree/DB drain reconciliation |
| LIFECYCLE_SLICE | SETUP_SLICE,RECOVERY_SLICE,TRANSITION_SLICE,ACL_SLICE | Real signed Installer lifecycle |
| INTEGRATION | FILE_SLICE,AUTH_SLICE,AUDIT_SLICE,BACKUP_SLICE,TRANSITION_SLICE,LIFECYCLE_SLICE | Full native integration |
| EXIT_62 | INTEGRATION,VENDOR | All LIC001-013 and LIC008/Open003 full acceptance |
| EXIT_64 | INTEGRATION,ARTIFACT | All six native/Installer full exits |
| EXIT_65 | INTEGRATION | All five DB/Store/ACL/Backup/Audit full exits |
| RELEASE | EXIT_62,EXIT_64,EXIT_65,ARTIFACT | All six LIC6.6 gates, final scans/matrix/independent approval |

No EXIT/RELEASE node is an entry predecessor. STORE has journal primitives but
not Audit projection completion as a prerequisite; RECOVERY has the degraded
Audit design contract, not a healthy deployed journal requirement. This preserves
the non-blocking Emergency Backup obligation without creating an Audit/Backup cycle.

## 5. Exact candidate master dependency replacements — NER-002 disposition

On adoption, label the master dependency column as implementation entry only;
add an explicit full-exit dependency/evidence note. This table is the proposed
literal entry replacement; all other existing dependencies and exits stay intact.
Node definitions and NE ledger become authoritative by reference only on adoption.

| Master location | Current dependency/entry | Proposed entry dependencies | Owner and retained full exit/test evidence |
| --- | --- | --- | --- |
| Section16 order | Sequential6.1..6.6 | Use section4 slice order for construction only | Maintainer; all phase exits retained |
| 17.1 PHASE6.4 | 6.2 core contracts and6.3 rules complete | NATIVE | Host Owner; all LIC6.4.001..006 full exits |
| 17.1 PHASE6.5 | 6.4 services/Installer exist and storage choices accepted | GUARDIAN_SLICE,APP_SLICE,SETUP_SLICE,ADAPTER_ENTRY | DB/Security Owners; all LIC6.5.001..005 full exits |
| LIC6.4.001 | PHASE6.2,PHASE6.3 | NATIVE | Host; identity/crash/restart/integrity; full Guardian obligations |
| LIC6.4.002 | LIC6.4.001 | GUARDIAN_SLICE,C_IPC | Host; peer/process/build/generation/boot/expiry attacks |
| LIC6.4.003 | LIC6.4.001,LIC6.4.002 | GUARDIAN_SLICE,APP_SLICE,C_IPC | Installer; non-SYSTEM/stale/arbitrary plan/TTL/orphan/secret tests |
| LIC6.4.004 | LIC6.4.001,LIC6.4.002,LIC009 | GUARDIAN_SLICE,APP_SLICE,DB_SLICE,STORE_SLICE,GATE_SLICE | Host/Backend; LIC009 retained; real hung/commit-race/K40 indeterminate tests |
| LIC6.4.005 | LIC6.4.001,LIC6.4.003 | GUARDIAN_SLICE,SETUP_SLICE,DB_SLICE,ACL_SLICE,C_RECOVERY | Recovery; real Node/journal-failure Backup; no Restore/unlock |
| LIC6.4.006 | LIC6.4.001..005 | SETUP_SLICE,RECOVERY_SLICE,TRANSITION_SLICE,ACL_SLICE | Installer/QA; existing001..005 full closures and signed lifecycle matrix remain exit prerequisites |
| LIC6.5.001 | PHASE6.4 | GUARDIAN_SLICE,APP_SLICE,SETUP_SLICE | DB/Installer; SCRAM/roles/secret ACL/migration/Backup |
| LIC6.5.002 | LIC008,LIC6.4.001 | GUARDIAN_SLICE,APP_SLICE,ADAPTER_ENTRY,C_TXN,C_AUDIT | Windows Security; LIC008 full acceptance retained; ACL/nonce/tag/power-loss/rollback/STORE001-005 |
| LIC6.5.003 | LIC6.5.001,LIC6.5.002 | DB_SLICE,STORE_SLICE,SETUP_SLICE | Windows Security; actual001/002 integration and clean cross-role denial |
| LIC6.5.004 | LIC6.4.005,LIC6.5.001..003 | RECOVERY_SLICE,DB_SLICE,STORE_SLICE,ACL_SLICE | Recovery/QA; real dump/Restore/old-snapshot/rebind and state exclusion |
| LIC6.5.005 | LIC012,LIC6.5.002,LIC6.5.004 | STORE_SLICE,AUTH_SLICE,BACKUP_SLICE,C_AUDIT | Audit/Security; LIC012 full contract retained; real crash/disk/DB-outage/duplicate/redaction/Restore/backfill |

LIC006/007 entry dependencies remain LIC003..005; bounded native completion adds
FILE_SLICE/STORE_SLICE and each applicable contract, never portable-only closure.
LIC009/010/012 original portable dependencies remain unchanged; their native
integration uses GATE_SLICE/AUTH_SLICE/AUDIT_SLICE respectively. LIC013 still
requires ALL LIC001..012 full closures. Phase6.2/6.3/6.4/6.5/6.6 full exits and
LIC6.6 dependency rows are unchanged. Open003 wording/status is unchanged;
adoption records the separate bounded ADAPTER_ENTRY decision, not full resolution.
Open012 can close as scheduling-only after accepted adoption; nothing else closes.

Each cell's downstream slice acceptance record must include the listed test IDs,
owner's name and interface/evidence digest; a role label alone is not acceptance.
The proposed row prerequisites are identical to section4 edges for that slice.

## 6. Evidence validity and reruns — NER-003 disposition

Each entry record pins: amendment/interface revision, source commit plus dirty
diff digest if any, artifact SHA256, test runner/version/result digest, Edition,
OS/build/architecture/provider/TPM scope, owner/reviewer names, approval and known
limitations. Hash identity is evidence binding, never runtime authentication.

| Change | Invalidated evidence / required action |
| --- | --- |
| Protocol/schema/crypto/trust/time policy | CORE and affected C_* reviews/regressions; approved policy process before repin; dependent entries suspended |
| Provider/API/key ownership/ACL/envelope/assurance/platform | ADAPTER_ENTRY and affected IPC/TXN/ACL tests; fresh isolated scope evidence and Security review; no wider host claim |
| Interface/transaction/IPC/runtime/Auth/Audit/Backup behavior | Affected C_* and implementation acceptance; rerun mapped failure suites and review changed scope |
| Source/dependency/toolchain/build/publisher/signing/packaging | Exact changed artifacts' LIC6.3 scans and integrity/identity evidence; affected slice tests; final signed scans always rerun under LIC6.6.004 |
| Amendment/dependency/scope/owner/approval change | REVIEW and affected entry ledger; named replacement approval and per-slice authorization; no inherited self-approval |
| Cosmetic documentation only | Check links/consistency; accepted evidence unchanged only with recorded no-semantic-impact disposition; otherwise scope review |

Track transitive descendants of invalidated nodes: dependent work/admission stays
blocked until current evidence is accepted. A rebuild does not erase historical
results, but old digests cannot cover new bits. Unchanged portable evidence need
not be repeated wholesale: justify reuse and rerun relevant entry regressions.
During permitted development, changed code is a candidate under isolated tests,
not automatically accepted for downstream integration. No unvalidated artifact
becomes runnable product authority. Acceptance happens before dependent work.

## 7. Dispositions and next action

| Finding | Draft response | Acceptance state |
| --- | --- | --- |
| NER-001 | Section2.1 explicitly splits bounded adapter decision from full Open003/LIC008 and final matrix | ADDRESSED_IN_DRAFT; independent acceptance pending |
| NER-002 | Sections3-5 expand contracts, entry graph and every affected row with owners/retained tests | ADDRESSED_IN_DRAFT; independent acceptance pending |
| NER-003 | Section6 pins scope/digests, invalidation triggers, transitive suspension and reruns | ADDRESSED_IN_DRAFT; independent acceptance pending |

Next: review exact v2 digest with assigned Security Reviewer; resolve findings,
obtain final Product confirmation, then synchronized adoption. Only after all NE
evidence is accepted may a specifically authorized bounded slice start.
This document is not that authorization and cannot close any native test gate.

## 8. Draft validation — 2026-10-07

Author checks: expanded34-node graph has unique nodes, resolved prerequisites,
no cycles and no full-exit/release entry backedges. All11 native/storage row
replacements match their slice's graph dependencies exactly. Resolver self-tests
PASS;44 Markdown files/179 local targets PASS; exact Node24.19.0 protocol-v1
checks PASS; git diff --check PASS. V1 SHA256 remains
aeaed9cd718ee9adfb7ccb5d4d891f8a0ee789f4a679e8ee61f06e18e20ed4f8.
These are draft consistency checks, not independent Security approval or evidence
that any entry prerequisite, native component or product acceptance is complete.
