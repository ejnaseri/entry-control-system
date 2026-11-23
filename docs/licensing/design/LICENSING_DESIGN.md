# Licensing Master Design, Security Contract and Implementation Checklist

Decision date: 2026-08-26

Last reviewed: 2026-10-14

Document revision: `v1-design-r164`

Current scheduling status: CHG0080/EV0149 adopts exact reviewed v2 with Product
and scoped independent-agent amendment Security approval. Open012 `[x]` is a
scheduling-only closure; NATIVE-ENTRY NOT_READY. LIC008/Open003 and all remaining
implementation/physical/release gates stay open. Earlier dated checkpoints below
retain historical diagnostic status, not the current adoption state.

Session continuation: [current handoff and retained experiment state](../../project/LICENSING_SESSION_HANDOFF.md).

Current bounded LIC008 W03 implementation checkpoint (2026-11-18):
[V8 pure typed V3 chain evidence](../evidence/standard-native-typed-chain-v3-20261118/README.md)
connects modeled slots 0-43. The physical W03 and every security, native,
account, User-creation and LIC008 acceptance gate remain open; see the dated
checkpoint near the end of this document.

Decision status: `ACCEPTED`

Implementation status: `PHASE_6_2_IN_PROGRESS`

Verification status: Phase 6.1 and `LIC-6.2-001` through `LIC-6.2-005` are verified under `LIC-EV-0013`, `LIC-EV-0016` and `LIC-EV-0026`. This is portable parser/state/time evidence only. Runtime admission, persistent License state, Guardian, Authenticode, Installer, protected storage/ACL and clean-machine release behavior remain unimplemented or unverified; the cumulative Licensing Release Gate remains open.

Active checklist status: 2026-10-06: LIC001-005 remain complete; LIC006-008 remain in progress. EV0132 completes V4/0.11.0 normal restart on current Windows11 x64 build22000: same-key/envelope Guardian reopen/decrypt/export/tamper and App/actual-child contrast PASS; owned-key cleanup PASS; services independently Stopped/Manual. User-pasted summary confirms ordered boot/preparation times and normalRebootPassed=true; original protected report/checkpoint digests still need independent capture. CHG0065/EV0133 prepares fresh V5/0.12.0 binary Repair SIMULATION: Prepare creates/retains fresh test keys; Repair admits only verified existing keys/state, stages identical trusted bits in a separate directory, rechecks identity/envelopes/isolation, cleans up owned keys, then proves the same admission gate refuses controlled missing keys with retained envelopes and no recreation. Pure11/11, actual report contract, admission/evidence negative fixtures and package/parser guards PASS. EV0134 records V5 Prepare; EV0135 now records completed physical V5/0.12.0 Repair simulation on this host: same key identity and envelope bytes verified, Guardian/App/child controls PASS, owned-key cleanup PASS, controlled missing-key repair refused without key recreation. User-pasted summary reports repairSimulationPassed/hostFeasibilityPassed=true; original protected summary/checkpoint/evidence digests are not independently captured. Services independently Stopped/Manual. Never rerun V5. CHG0068/EV0137 prepared V6 Upgrade kit0.13.0; CHG0069/EV0138 now records physical OLD0.13.0 to NEW0.13.1 binary Upgrade SIMULATION PASS on Windows11 Pro21H2 x64 build22000. User-pasted summary confirms distinct managed artifacts, same key identity/envelope bytes and preserved OLD files, with no key recreation; Guardian/App/actual-child controls and owned-key cleanup PASS. Services independently Stopped/Manual on bin-new. CHG0070/EV0139 records the user's separate elevated read-only hash capture: original summary SHA2567b95d1e086b91de870445b7ed1e84c4f40fe83a6faa9c5e8fe20cf51de221517, checkpoint matches and all eleven evidence files match. This is operator verification, not independent Security review; V4/V5 hash gaps remain. V6 is consumed: never rerun Prepare/Upgrade. CHG0072/EV0141 now prepares V7 kit0.14.0: pure17/17 and actual report/package/hash/DACL/SID/checkpoint plus inert lifecycle/failure guards PASS. CHG0073/EV0142 records operator-run V7 Prepare/Uninstall/Reinstall transcript PASS: six Guardian controls, App/actual-child contrast, artifact0.14.0 and owned-key cleanup PASS. Exactly three test registrations removed/recreated; services independently Stopped/Manual, PID0. CHG0074/EV0143 reviews the supplied final summary and records operator read-only hashes: both checkpoints and all11 evidence files match; original summary SHA256cc8d7464fedb6b20b9adeae2d0e34f1aff483b3f481b975a74a1632ef9ffb586. Same key/envelope/protected bytes/SIDs/DACL continuity and no recreation are reported true/false as intended; this is operator evidence, not independent Security acceptance. V7 consumed: never rerun. UI/Attendance/Backup current status notes are synchronized against accepted evidence; broader hardening remains open. Next: review unresolved native-entry dependencies before Guardian/Store implementation. See [reinstall plan](../plans/LICENSING_WRAPPING_REINSTALL_PLAN.md). No new physical run is authorized by these results. See [Upgrade plan and kit](../plans/LICENSING_WRAPPING_UPGRADE_PLAN.md). Actual installer Repair/Upgrade, interrupted operation, TPM, separate standard account and Windows matrix remain open. This is not actual product Installer Repair; productionRepairTested/productionUpgradeTested/security/production/matrix remain false. Do not rerun consumed V1-V6. See [wrapping design](LICENSING_SOFTWARE_KSP_WRAPPING_DESIGN.md).

EV0103 preparation follow-up: the exact retained-state key-open diagnostic0.4.2 is built but not physically executed. It records separate native provider-open, P-256 query and exact-key-open results under Guardian/App/actual child, requires the unchanged Guardian managed positive control, keeps0x80090016 INCONCLUSIVE and imports no create/set/finalize/delete/export/enumeration API. Pure57/57 and controller52 checks, inert bootstrap, parser and native-API allowlist pass. Elevated retained-state preflight and service execution remain NOT_RUN; no acceptance status changes.

EV0104 records the first elevated0.4.2 preflight refusal: Administrator correctly cannot inspect Guardian-protected intent/ownership files. The refusal occurred before the diagnostic directory, service reconfiguration, plan write or service/key operation; live state remained unchanged. Corrected0.4.3 moves that protected-record comparison into the Guardian positive control and adds a regression forbidding Administrator-controller access to protected key records.

EV0105 physically executes0.4.3. Guardian's managed reopen/sign/policy/DACL/private-export controls and native provider/P-256/exact-key open all PASS. App and actual child open the same provider and confirm P-256 support, but exact machine-key open returns native `NTE_BAD_KEYSET` (`0x80090016`) for both. This rules out managed-wrapper behavior, unavailable provider/algorithm, wrong tested key name and different open flags; it does not by itself distinguish an absent key from provider-mediated non-disclosure to an unauthorized caller. Security acceptance remains false and unchanged. The next bounded work is to prepare, review and only then execute a fresh two-key ACL-disambiguation experiment: identical test-only machine keys with restricted versus explicit App-readable DACLs, without modifying or deleting the retained key. No second acceptance round or LOCAL=user protection may proceed yet.

EV0106 prepares ACL-disambiguation0.5.0 but does not physically execute it. A fresh experiment ID binds two new Software machine-key names: `acl-restricted` receives only SYSTEM+Guardian and `acl-app-readable` additionally receives App. Setup records intent before each creation and ownership immediately after finalization; Guardian/App/actual child use exact native provider/P-256/key-open probes. The contrast gate requires Guardian to open both, App/child to observe0x80090016 only for restricted and to open the App-readable control. Only after the complete contrast may Guardian delete those two fresh keys after intent/ownership/published-public-identity checks. Any incomplete create/probe retains evidence for reconciliation. The retained EV0105 key is excluded by name validation and is never a cleanup target. Pure73/73, controller58, inert bootstrap, parser/state-pin/generated-name/API-bound checks pass. Physical execution and any acceptance decision remain NOT_RUN.

EV0107 physically executes0.5.0. Both fresh machine/non-exportable/P-256/signing keys finalize, sign and pass exact protected-DACL checks. Guardian opens restricted and App-readable. App and actual child open the same Software KSP, confirm P-256, receive0x80090016 only on restricted, and open App-readable. This controlled one-variable contrast establishes on this host/provider that the restricted result is ACL-mediated key non-disclosure rather than provider/algorithm/name/flag failure. Guardian then deletes and confirms absence of both fresh keys; Setup is absent and Comparison services finish Stopped/Manual on bin-0.5.0-acl-control. The report intentionally keeps securityAccepted=false and decisionChanged=false. At that checkpoint the required next action was an explicit narrow decision; CHG0052 below records it without changing global `IsDenied` or historical labels.

CHG0052 now makes that narrow decision. Version0.6.0 implements a separate key-isolation classifier which can return `PASS_KEY_NOT_DISCLOSED` only when the plan explicitly opts into the accepted ACL behavior and the existing exact provider, key, DACL, Guardian and App/child controls all pass. Generic denial classification is unchanged, and `NTE_BAD_KEYSET` remains INCONCLUSIVE everywhere else. EV0108 prepares a one-time EV0107-state/hash-pinned continuation which performs two fresh verification rounds and permits `LOCAL=user` protection plus fresh-process verification only after both pass. It creates/deletes no key, starts no Setup helper and changes no key ACL. Pure81/81, controller60 and all parser/state/native-bound checks pass; physical execution is NOT_RUN and no production acceptance is claimed.

EV0109 physically executes0.6.0 once. Both independent retained-key rounds pass all Guardian, App, actual-child, file and identity gates, with App/child returning `PASS_KEY_NOT_DISCLOSED`; the summary records `rounds=[true,true]` and `keyIsolationAccepted=true`. The conditional protection phase creates the `LOCAL=user` descriptor, then `NCryptProtectSecret` fails at `dpapi-protect-secret` with `NTE_ENCRYPTION_FAILURE` (`0x80090034`). No ciphertext/hash is published, App/child DPAPI checks and fresh-process reopen are prerequisite-skipped, and `protectionExperiment=FAILED_OR_INCOMPLETE`. Services finish Stopped/Manual on bin-0.6.0-accepted-rounds. The next work is diagnosis of DPAPI-NG behavior under the exact virtual service token/profile/provider context; do not rerun0.6.0 or adopt `LOCAL=machine` as a silent fallback.

EV0110 prepares that diagnosis in0.7.0 without physical execution. The state-pinned continuation validates the exact EV0109 report, installed manifest/binary, failed protect plan, absent shared ciphertext, stopped Manual virtual-account services and helper absence before installing a fresh bin. Guardian records current SID/account/authentication/impersonation, environment and Win32 profile paths/type, and whether its HKU hive is loaded. It then compares `LOCAL=user` and exact `SID=<Guardian>` using independent random32-byte memory-only protect/unprotect probes whose buffers are zeroed; no plaintext, ciphertext or hash is persisted. Source/package guards forbid `LOCAL=machine`, protected-record Administrator reads, service identity/profile changes and key/ACL operations. Pure84/84, controller63, all prior regressions and the new parser/state/API bounds pass. Physical execution and any policy conclusion remain NOT_RUN.

EV0111 physically executes0.7.0 once. Guardian runs under the exact expected virtual-account SID with matching primary identity, `Negotiate` authentication and no impersonation. Both environment and special-folder profile paths resolve to `C:\Users\Default`; `HKEY_USERS\<Guardian SID>` is not loaded; `GetUserProfileDirectory` and `GetProfileType` are unavailable. The memory-only `LOCAL=user` and exact `SID=<Guardian>` probes both create their descriptors but fail `NCryptProtectSecret` with `NTE_ENCRYPTION_FAILURE` (`0x80090034`). No diagnostic secret/blob/hash is persisted, no App service is started, and services finish Stopped/Manual on bin-0.7.0-protection-diagnostic. This rejects the tested virtual-account DPAPI-NG adapter on this host but does not prove whether a profile-backed test identity or the whole local DPAPI-NG provider is the limiting factor.

Implementation history: `184f228` closes LIC004; `41fdf18` commits the original LIC005 checkpoint. `LIC-EV-0020` through `LIC-EV-0023` retain the cross-boot repair failure and rejected draft. Product decisions `LIC-CHG-0016` / `LIC-CHG-0017` and the concrete contract in section 8.4 resolve the availability/future-enabling tradeoff. `LIC-EV-0025` preserves two additional implementation-review failures; `LIC-EV-0026` records passing final remediation. LIC005 closure is now committed as `e49630a`; LIC006 starts from that clean baseline under `LIC-EV-0027`.

Golden regression for the earlier LIC004 checkpoint also passed: exact Node `24.19.0`, .NET SDK `10.0.400`, byte-identical 173-record Vendor/Node/.NET reports, 1418-file production isolation scan and unchanged 129-file vector manifest `565a5efca1a1767a622a0d751a5937633018587f7cc463ce3e531ed9656fb99e`.

Applies to: both `FULL` and `ATTENDANCE` Windows x64 products.

Canonical repository path: `docs/LICENSING_DESIGN.md`

## 0. Document authority and execution rules

This file is the single source of truth for every Entry Control System Licensing decision, security boundary, implementation task, acceptance gate and evidence record. Every developer, reviewer and release operator must read it before changing License-related code, schema, protocol, Installer, Windows service, Backup/Restore behavior, authentication, build output or Vendor tooling.

For Licensing-specific behavior, this file takes precedence over `README.md`, `PACKAGING_DECISIONS.md`, `security-design.md`, `PROJECT_CHECKLIST.md`, `ATTENDANCE_EDITION_CHECKLIST.md`, comments and previous chat history. Those files may summarize or link here, but they must not define a different License rule. Any conflict must be resolved by updating this file and every affected summary in the same change.

### 0.1 Authority, ownership and language

| Responsibility | Required owner/approver |
| --- | --- |
| Commercial scope, License modes, durations and customer policy | Product Owner |
| Protocol, key hierarchy, tamper/recovery and security-limit changes | Product Owner plus assigned Security Reviewer |
| Document custody and cross-document synchronization | Lead Repository Maintainer |
| Phase implementation | Named owner recorded on each active checklist item before coding starts |
| Release Gate approval | Product Owner, Release Owner and Security Reviewer |

Named people may change, but these roles may not remain `Unassigned` when their blocking Phase begins.

Normative language rules:

- `must`, `required`, `only`, `never`, `forbidden`, exact tables/formulas and checklist exit criteria are binding.
- `may` describes a permitted option that still must stay inside every binding boundary.
- `suggested`, `example`, explanatory threat-limit text and Primary References are informative unless an accepted Decision/Open-item resolution promotes a value to binding policy.
- A value listed in section 18 as Open is not permission for a developer to choose silently.
- Section numbers use `§`, for example `§6.1` means the Offline request/response subsection. Work phases always use `PHASE-6.1` through `PHASE-6.6` to avoid that ambiguity.

Mirror and conflict policy:

| File | Role for Licensing | Conflict rule |
| --- | --- | --- |
| `docs/LICENSING_DESIGN.md` | Normative master decision, implementation and evidence record | Always authoritative for Licensing |
| `docs/PACKAGING_DECISIONS.md` | Normative for non-License Installer details; mirror of License-sensitive service/ACL decisions | Update in the same change; this file wins on License behavior |
| `docs/security-design.md` | Security summary and wider Auth/Role context | Must link/summarize without redefining License rules |
| `docs/ATTENDANCE_EDITION_CHECKLIST.md` | Overall Edition/Phase status mirror | Status must match section 17 here |
| `docs/PROJECT_CHECKLIST.md` | Portfolio-level project status mirror | May summarize only |
| `README.md` | Navigation only | Never a decision source |

### 0.2 Mandatory working rules

- Do not implement a License behavior that is absent from this file, and do not silently weaken a mandatory invariant to simplify implementation.
- Select work only from the implementation checklist in section 17 after all listed dependencies are complete.
- Every pull request/commit must name its `LIC-*` checklist IDs and the tests that prove them.
- A checkbox may become `[x]` only when implementation, negative tests, required platform evidence and an Evidence Log row all exist. Code alone is not Done.
- Protocol, key-purpose, state-transition, lock-surface, Recovery or data-safety changes require explicit Product Owner approval and a Decision Log entry before implementation.
- A wire-format change after protocol v1 is frozen requires a new protocol version, migration/compatibility policy and golden vectors; editing v1 semantics in place is forbidden.
- Production private keys, shared License HMAC secrets, real Recovery tokens and customer Entitlements must never be committed as examples or test fixtures. Test keys must be visibly non-production and production must not trust them.
- If a blocker or uncertainty affects security, data safety or commercial behavior, mark the item `[!]`, record it in section 18 and stop that dependent work rather than improvising.
- Historical Decision/Evidence rows are append-only. Corrections add a new row that supersedes the old entry; they do not erase the audit trail.

### 0.3 Status legend

| Marker | Meaning |
| --- | --- |
| `[ ]` | Not started; no dependent item may assume it exists |
| `[~]` | In progress or partially proven; still not a completed dependency |
| `[x]` | Implemented and verified with an Evidence Log row |
| `[!]` | Blocked by a recorded decision, external dependency or failed gate |
| `[N/A]` | Intentionally excluded with Product Owner approval and recorded rationale |

Decision status, implementation status and verification status are separate facts. An accepted decision can still have `[ ]` implementation, and implemented code can remain `[~]` until required verification passes.

### 0.4 Accepted decision index

The detailed clauses in sections 1–16 remain normative; this table is a navigation index, not a shorter replacement.

| Decision ID | Accepted decision | Detail |
| --- | --- | --- |
| `LIC-DEC-001` | Licensing is `[IN]` for v1 in both Editions; every License is finite and no perpetual/lifetime mode exists | Sections 1 and 3 |
| `LIC-DEC-002` | Both `OFFLINE_BOUND` and outbound-only `HYBRID_LEASED` are first-class modes | Sections 3 and 6 |
| `LIC-DEC-003` | A disconnected machine cannot be remotely disabled immediately; effect occurs at authenticated contact or signed allowance expiry | Sections 2, 3 and 9 |
| `LIC-DEC-004` | V1 uses deterministic CBOR, exact CDDL, `COSE_Sign1` and ES256 with strict parsing/domain separation | Section 4 |
| `LIC-DEC-005` | Root, Offline Entitlement, Online Lease, Offline Control, Recovery, Authenticode and Dev/Test keys have separate purposes/custody | Section 4.3 |
| `LIC-DEC-006` | Binding uses locally generated non-exportable purpose-separated keys; TPM is preferred and a distinct Software-KSP wrapping key is the lower-assurance fallback | Section 5 |
| `LIC-DEC-007` | Authoritative License State, clock/revision anchors and tamper evidence live outside PostgreSQL and Backup/Restore | Section 7 |
| `LIC-DEC-008` | Hybrid authorization requires one exact atomic Entitlement/Lease pair; neither half, an old parent nor a DB row can authorize operation | Sections 3, 6, 7 and 9 |
| `LIC-DEC-009` | Suspend is reversible only through authorized higher control; terminal Revoke requires two-artifact lineage reactivation and keeps an old-lineage tombstone | Sections 4 and 9 |
| `LIC-DEC-010` | Ambiguous disk/clock/TPM/antivirus failures enter recoverable restriction; only corroborated independent evidence creates `TAMPER_LOCKED` | Section 10 |
| `LIC-DEC-011` | Guardian, App/Node, Database and temporary Setup identities are separated; Guardian and Backend independently enforce License admission | Sections 5, 7, 11 and 16 |
| `LIC-DEC-012` | Lock never deletes customer data; Login, safe License/diagnostics and narrow Emergency Backup remain, while Restore and business/physical operations stay blocked | Sections 10–13 |
| `LIC-DEC-013` | Vendor authority/signing infrastructure is a separate system and never ships in a customer artifact | Sections 4.4 and 14 |
| `LIC-DEC-014` | No partial License implementation may enter a production Installer or Pilot; the cumulative Release Gate closes only in Phase 6.6 | Sections 15 and 16 |
| `LIC-DEC-015` | License forensics use a Guardian-owned hash-linked external journal plus a recursively redacted idempotent PostgreSQL Audit projection with fail-closed outbox/Restore reconciliation | Sections 7, 13 and 15 |
| `LIC-DEC-016` | V1 issuer timing/lifetime policy is finite and bounded: Hybrid check default 6h (1–24h), allowance default 7d (1–30d), warning default 7d (0–30d), grace default 3d (0–7d), term maximum 366d, Entitlement envelope maximum 410d, Lease envelope maximum 30d, clock tolerance 300s and same-boot Time-Recovery RTT 300s | Sections 3, 4 and 8; `LIC-OPEN-004` |
| `LIC-DEC-017` | Protocol v1 is frozen as the closed `licensing/protocol/v1` package: exact tagged deterministic CBOR/COSE domains, 10 signed schemas, 3 carrier schemas, byte caps, endpoints, signer purposes, Feature/build contract, reason registries and negative corpus | Sections 4 and 6; `LIC-6.2-001` |

### 0.5 Fixed v1 platform and packaging baseline

These values affect Licensing and are repeated here so a developer does not need another file to discover a binding, service or artifact assumption. Any accepted version update must change this table and the Packaging document in the same commit.

| Area | Fixed v1 decision |
| --- | --- |
| Windows | Per [WINDOWS_SUPPORT_MATRIX.md](../../operations/WINDOWS_SUPPORT_MATRIX.md): Windows 10 client x64 build14393+ and Windows 11 client x64 build22000+, regardless of Microsoft servicing date; pre-14393 Windows 10, Windows 7/8/8.1, Server, Insider/S mode, x86 and Arm/Arm64 are out |
| Installer | NSIS `3.11`, fully offline and Authenticode-signed |
| App runtime | Node.js `24.19.0` x64, bundled privately |
| Native hosts | .NET `10.0.11` x64 for Guardian/App/Setup helpers |
| Database | Private PostgreSQL `17.11` x64 on `127.0.0.1:55432` |
| Official product origin | Guardian-owned `http://127.0.0.1:41820`; no v1 inbound LAN/Vendor-control port |
| Persistent services | `EntryControlSystem.Database`, `EntryControlSystem.License`, `EntryControlSystem.App` under separate identities |
| Temporary privileged helper | One-shot `EntryControlSystem.Setup` under `LocalSystem`, fixed-plan only and removed after Setup/Upgrade |
| Authoritative State path | `%ProgramData%\EntryControlSystem\state\licensing\`, outside PostgreSQL and customer Backup |
| Secret separation | `runtime.env` contains no DB password; App, Guardian and Installer credentials use separate ACL-protected secret files |

## 1. Objective and mandatory invariants

Entry Control System uses a non-perpetual, machine-bound license that works at sites with no Internet and can also be managed remotely when Internet is available.

The following rules are mandatory:

- Every Entitlement has a finite business term and a finite signed-token envelope. There is no perpetual value, sentinel date or lifetime purchase mode.
- The Vendor may issue an exact daily, weekly, monthly, annual or custom UTC business term.
- The customer application contains only Vendor verification public keys. No Vendor production signing private key or shared licensing HMAC secret may enter Git, CI, an Installer or a customer machine; the installation's own non-exportable device key is generated locally.
- Offline operation is a first-class supported mode, not a temporary network-failure fallback.
- Online management uses outbound customer check-in. The v1 loopback-only product never opens an inbound Vendor-control port.
- A license is bound to a per-installation public key, not primarily to MAC address, disk serial, CPU ID or another brittle inventory value.
- License authority and anti-rollback state live outside PostgreSQL and outside normal Backup/Restore.
- Client-side route hiding is never an enforcement boundary. The separately identified signed License Guardian and Backend both enforce the state.
- Expiry, suspension, revocation or recoverable storage trouble starts a restricted service; it does not delete customer data or make Emergency Backup unavailable.
- Confirmed tamper is fail-closed and durable, but recovery remains possible only through a correctly scoped, one-time, Vendor-signed Recovery token.
- A candidate import is fully verified before replacing an active entitlement. A fake, old or wrong-device file must not be able to brick an otherwise valid installation.

## 2. Security claims and explicit limits

The design is intended to make forged licenses, copied licenses, database rollback and ordinary file editing cryptographically ineffective, while making binary patching materially harder and detectable.

It does not make these impossible claims:

- Software on a customer-controlled computer cannot be proven absolutely uncrackable against an attacker with local Administrator, debugger, kernel or physical control. Signed native enforcement, TPM keys, ACLs and independent checks raise the cost; they do not change this limit.
- A machine that is completely offline cannot receive an immediate remote revocation. The action becomes effective at the next authenticated check-in or no later than the end of its previously signed offline allowance.
- Absolute time and a complete offline machine-snapshot rollback cannot always be distinguished without a trustworthy external time source or persistent TPM monotonic anchor.
- Reading or copying public license bytes cannot reliably be detected and is not a security failure. Modification, deletion, replacement, replay, wrong-machine use and integrity failure can be detected.
- A file cannot be made invisible to a Windows Administrator. ACL protection limits ordinary users; cryptographic verification supplies authenticity.

Product and sales material must use the same limits. In particular, the Vendor portal must distinguish `revocation requested` from `revocation delivered/effective`.

## 3. Modes

Both modes use the same token format, trust roots, verifier, device identity, Secure State and recovery path.

### 3.1 `OFFLINE_BOUND`

- Activation request and response travel by file, USB or another out-of-band channel.
- The current signed Entitlement authorizes operation through its finite validity and optional signed post-expiry grace only while the activation-global Control state is operational; unlike Hybrid mode, no Lease or Internet contact is required.
- Renewal is another higher-generation, device-bound Entitlement.
- Remote disable cannot be guaranteed while the installation stays offline; expiry or an on-site `OFFLINE_CONTROL` token is the enforcement boundary.
- File extensions are `.ecsreq` for requests, `.ecslic` for entitlements, `.ecsctl` for Offline Control, `.ecsrec` for recovery and `.ecstrust` for a bounded unsigned carrier containing independently Root-signed trust objects. File names are presentation only; protected media type, schema, signer purpose and signature determine type.

### 3.2 `HYBRID_LEASED`

- The Vendor first approves a finite Entitlement and the installation obtains short signed Leases through outbound HTTPS.
- When reachable, the installation checks in periodically and proves possession of its installation key.
- A Lease cannot grant a wider Edition/Feature set or outlive its parent token. Entitlement times satisfy `notBefore <= termStartsAt < termEndsAt <= graceUntil <= entitlement.notAfter <= delegation.notAfter`; no-grace issuance sets `graceUntil = termEndsAt`. Entitlement operation cannot begin before `effectiveStart = max(notBefore, termStartsAt)`. A Lease satisfies `offlineUntil <= lease.notAfter <= entitlement.notAfter`.
- Network failure, DNS failure, TLS timeout or Vendor-server 5xx is not tamper. The previous valid Lease continues until its signed `offlineUntil`.
- Reversible suspension/unsuspend status from a newer valid Lease, or terminal revocation from a separately `OFFLINE_CONTROL`-signed object transported by the response, enters the guarded transition on first authenticated delivery. If no response arrives, operation stops at `offlineUntil`.
- Hybrid operation always ends at `min(offlineUntil, lease.notAfter, graceUntil)`. Post-term grace can never revive an ended Lease, cross `offlineUntil` or outlive the Entitlement token envelope.
- Hybrid is operational only with both a valid current Entitlement and a valid Lease bound to that exact Entitlement token ID/generation, activation, device, Product and Edition. Entitlement-only, Lease-only, orphaned or old-parent pairs remain restricted.
- Binding v1 issuer defaults are a six-hour check attempt, seven-day offline allowance, seven-day expiry warning and three-day post-expiry grace. The accepted ranges are respectively 1–24 hours, 1–30 days, 0–30 days and 0–7 days, and all values are explicit signed policy. The signed parent allowance must be at least one check interval plus the 300-second clock/retry tolerance. Every Lease sets `offlineUntil = min(serverTime + parent.offlineAllowanceSeconds, parent.notAfter, parent.graceUntil)`; no other arbitrary shortening is valid. Operational issuance requires more than 300 seconds remaining and the installation computes `nextCheckAt = min(serverTime + checkCadenceSeconds, offlineUntil - 300)`. A site needing more than 30 days of uninterrupted disconnection uses `OFFLINE_BOUND`; v1 Hybrid has no exception above 30 days.

### 3.3 Frozen v1 issuer timing and lifetime policy

Issuer/verifier policy uses integer UTC seconds with no floating-point duration:

| Policy | Default | Accepted bound |
| --- | ---: | ---: |
| Hybrid check cadence (`nextCheckAt - serverTime`) | `21600` (6h) | `3600..86400` (1–24h) |
| Hybrid offline allowance (`offlineUntil - serverTime`) | `604800` (7d) | `86400..2592000` (1–30d), and at least cadence + `300` |
| Warning lead | `604800` (7d) | `0..2592000` (0–30d); require `lead <= termEndsAt - effectiveStart` and `warningStartsAt = termEndsAt - lead` with no silent clamp |
| Post-term grace | `259200` (3d) | `0..604800` (0–7d); zero means `graceUntil = termEndsAt` |
| Business term | Issuer-selected finite daily/weekly/monthly/annual/custom term | positive and at most `31622400` (366d) |
| Entitlement token envelope | bounded to its approved term | `notAfter - min(issuedAt, notBefore) <= 35424000` (410d); operation still ends at `graceUntil` |
| Lease token envelope | bounded to the approved allowance | `notAfter - min(issuedAt, notBefore) <= 2592000` (30d) |

These are protocol maxima, not permission to issue every maximum automatically. Software-bound installations default to shorter values under section 5. No customer policy can exceed these v1 bounds; doing so requires a reviewed protocol/policy revision, never a hidden configuration override.

## 4. Cryptographic protocol

### 4.1 Wire format

The frozen machine-readable v1 contract is [`licensing/protocol/v1`](../../../licensing/protocol/v1/README.md), closed by its own path/size/SHA-256 manifest. It contains exactly ten self-contained signed-object CDDL schemas, three closed non-authoritative carrier schemas, the exact registry and descriptor-only malformed/cross-type corpus. The policy in this document and that package are one contract; CDDL matching alone never grants authorization.

V1 signed objects use RFC 8949 Core Deterministic CBOR inside a mandatory tagged and embedded `COSE_Sign1`:

- The complete object is CBOR tag `18` over exactly four array elements: protected-header `bstr`, empty unprotected map, embedded payload `bstr` and signature `bstr`. A missing/wrong tag, detached payload or trailing CBOR item is rejected.
- Signature algorithm: `ES256`, ECDSA P-256 with SHA-256.
- COSE signature encoding: fixed 64-byte `R || S`; `R` and `S` must be in the P-256 scalar range and v1 issuers/verifiers enforce low-S canonical form.
- The protected header map is exactly COSE label `1=-7` (`alg=ES256`), label `3` (the exact token media type) and label `4` (binary `kid`). The unprotected header map is empty. V1 carries no `crit` entry and rejects every additional header.
- `Sig_structure.external_aad` is exactly the empty byte string. No workflow supplies caller-controlled external AAD.
- Exact media types domain-separate `activation-request`, `lease-request`, `key-delegation`, `key-denylist`, `entitlement`, `lease`, `offline-control`, `reactivation-authorization`, `recovery` and `time-correction` under `application/vnd.entry-control.<type>+cbor;v=1`.
- Payload `keyId` must byte-for-byte match protected `kid`; payload `tokenType` and `protocolVersion` must match the protected media type.
- Runtime selects the permitted algorithm and key purpose from its trusted key registry. An input cannot choose `none`, another curve or an incompatible verification path.
- Domain separation is mandatory. An Entitlement can never be accepted as a Lease, Revocation, Time Correction or Recovery token.
- Parsers reject duplicate map keys, indefinite-length items, floats, unknown fields for that protocol version, malformed UTF-8, non-minimal encodings, oversized input and trailing data.
- Opaque IDs are `bstr .size 16`; hashes, nonces and key IDs are raw `bstr .size 32`, never textual UUID/hex. Counters are unsigned and at most `9223372036854775807`; timestamps are unsigned UTC Unix seconds at most `253402300799`. Validity is the half-open interval `[notBefore, notAfter)`.
- Every Vendor-signed object requires `notBefore < notAfter`, `issuedAt < notAfter`, and measures its envelope from `min(issuedAt, notBefore)`. Ordinary admission requires `issuedAt <= trustedNow + 300` and `trustedNow < notAfter`; a future-`notBefore` object can only be staged. A subordinate-signed token additionally requires `delegation.notBefore <= token.notBefore < token.notAfter <= delegation.notAfter` and `delegation.notBefore <= token.issuedAt < delegation.notAfter`.
- An activation request requires `issuedAt < notAfter`, `issuedAt <= vendorUtc + 300`, `vendorUtc < notAfter` and its own 30-day maximum. Time Correction keeps the positive structural window but uses its incident/same-boot proof and signed `correctedUtc`: both `issuedAt` and `correctedUtc` are at least the sealed pre-incident high-water and `issuedAt <= correctedUtc + 300`. Online Time Recovery uses signed `serverTime` and requires `issuedAt=serverTime`.
- Token and request size limits are fixed before decoding and tested before allocation-heavy parsing.
- Complete tagged-COSE maxima are: activation request `131072`, Lease request `8192`, Delegation `8192`, Denylist `262144`, Entitlement `16384`, Lease `16384`, Offline Control `8192`, Reactivation Authorization `16384`, Recovery `16384` and Time Correction `8192` bytes.
- Each media type has one mandatory CDDL schema under `licensing/protocol/v1/schemas`. An “applicable subset” is descriptive only; code generation/validation uses the exact schema with no optional authorization claim unless that CDDL explicitly permits it.

`LIC-6.2-002` requires the same Golden Vectors to produce byte-identical results in the non-production Vendor fixture issuer and independent Node/.NET test consumers. Those consumers are not the future production Node verifier or .NET License Guardian; production parsing/trust remains `LIC-6.2-003` and Guardian integration remains Phase 6.4.

Installation public keys use one canonical encoding: RFC 5480 SubjectPublicKeyInfo DER for `id-ecPublicKey / prime256v1` with the uncompressed P-256 point. `deviceKeyId` is SHA-256 of those exact DER bytes.

Portable preflight API boundary (`LIC-6.2-003`): caller snapshots are trusted adapter inputs, not substitute signed evidence. `context.device` identifies the local installation key; during Rebind it is the new key whose proof of possession is in the exact signed request. `context.previousDevice`, when present, is the separately sealed active binding before Rebind, including a previously accepted durable override; otherwise the original parent Entitlement supplies the previous binding. Old key/installation and new key/assurance are checked separately, preserving A-to-B-to-C rebind when the unchanged parent still binds A. The core defensively copies both snapshots and revalidates the exact signed request. Real acquisition and persistence of those trusted snapshots remain later state/Guardian work. Time-Recovery elapsed evidence must be a runtime BigInt in inclusive `0..300`; an invalid type or negative duration is rejected.

An activation request is itself a device-key `COSE_Sign1` over its exact CDDL payload. It does not contain its own hash. The Vendor computes `requestHash = SHA-256` over the complete deterministic encoded `.ecsreq` bytes, and the Entitlement signs that hash.

Outer carriers are closed deterministic CBOR but never authorize: `.ecstrust` is capped at `1048576` bytes, the Lease challenge response at `4096` bytes and the Lease response at `524288` bytes before decode. Embedded objects retain their complete signed bytes and must pass their own schema/signature/purpose checks. The only Vendor challenge endpoint is exact `POST /v1/licensing/lease-challenges`; the only signed Lease endpoint is exact `POST /v1/licensing/leases`. Authority/query/fragment/trailing slash/path normalization/alias variants and TLS 0-RTT are forbidden for these mutations.

### 4.2 Common signed claims

The table below is the union of common claims. Each token contains exactly the required/optional keys in its own v1 CDDL and no others:

| Claim | Meaning |
| --- | --- |
| `protocolVersion` / `tokenType` / `tokenId` / `keyId` | Strict schema, domain and signer identity |
| `productId` / `edition` | Exact product and `FULL` or `ATTENDANCE` binding |
| `customerId` / `customerDisplayName` | Vendor customer identity; display name is not authorization |
| `licenseId` / `activationId` / `installationId` / `deviceKeyId` | Exact commercial License lineage, activation, installation and SHA-256 hash of its canonical public key |
| `generation` / `previousTokenId` | Monotonic replacement and rollback protection |
| `issuedAt` / `notBefore` / `notAfter` | Finite cryptographic token-envelope validity |
| `mode` / `features` | Authorized upper bound on the product surface |
| `termStartsAt` / `termEndsAt` | Exact finite paid/business term |
| `warningStartsAt` / `graceUntil` | Explicit customer-visible warning and optional post-term grace |
| `minimumProductVersion` / `maximumMajorVersion` | Inclusive signed SemVer 2 compatibility range; build metadata does not affect precedence |
| `requestHash` | Binding to the exact approved activation request |

An Entitlement missing `termEndsAt` / `graceUntil` / `notAfter`, carrying an infinite/out-of-policy date, violating `notBefore <= termStartsAt < termEndsAt <= graceUntil <= notAfter`, or exceeding the issuing key's delegation validity or maximum token/term lifetime is rejected. Its operational start is `effectiveStart = max(notBefore, termStartsAt)`; pre-validation or storage before that instant never grants operation.

License `features` are a sorted, duplicate-free, closed set of the 23 exact v1 values in `protocol-registry.json` and are restrictive only: the effective surface is the intersection of the signed Entitlement, the selected Edition, the capabilities physically present in that exact build, the server code-ready registry and an optional external flag. `ICLOCK_ADMS` and `GENERIC_DEVICE_PUSH` are never License-activatable. An `ATTENDANCE` object containing Customer, payment, membership, payroll, expense or financial-report Features is rejected rather than narrowed silently. A License can never activate an excluded/reserved capability or a chunk absent from the artifact. Device/member seat limits are not operational v1 claims; adding them requires a separate remediation workflow and Scope Change so a lower renewal cannot unexpectedly brick an existing installation.

Outstanding request purpose is part of the authorization domain. A standalone-valid request-bound primary response outside this exact matrix is rejected:

| Request purpose | Only permitted response | Required equality/transition |
| --- | --- | --- |
| activation `ACTIVATE` | Entitlement | generation 1; no predecessor/reactivation ID; exact request/Product/Edition/installation/device |
| activation `RENEW` | Entitlement | same lineage/device; generation = request Entitlement generation + 1; successor `previousTokenId = request.entitlementTokenId` |
| activation `CONTROL` | Offline Control | `origin=REQUEST_BOUND`; exact request hash/ID, target, action, effective time and reason; higher Control revision |
| activation `RECOVER` | Recovery | only `CLEAR_TAMPER` or `REPAIR_SECURE_STATE`; exact incident/current Entitlement/Control; Secure-State generation + 1 |
| activation `REBIND` | Recovery | exactly `REBIND_DEVICE`; old key=request old key, new key=request device key, assurance=request binding kind; state generation + 1 |
| activation `REACTIVATE` | Reactivation Authorization plus Entitlement | exact revoked/tombstone/request/device and new-lineage pair; generation-one Entitlement references/atomically consumes authorization |
| activation `TIME_CORRECT` | Time Correction | exact incident/request/device; state and Time-Correction revision each advance one |
| Lease `CHECK_IN` | Lease | exact request hash/ID, device, parent, current Build and monotonic Lease/Control tuple |
| Lease `TIME_RECOVERY` | Lease | every Check-in binding plus current incident/high-water and same-boot 300-second proof |

Every request-bound response repeats the request ID and SHA-256 of the complete tagged deterministic request COSE bytes. A `RENEW` request carries only its current `entitlementTokenId`; the successor derives `previousTokenId` from it, avoiding two contradictory predecessor fields.

An ordinary `CHECK_IN` Lease carrier may additionally transport independently signed asynchronous Delegation/Denylist updates, Offline Control or a previously request-bound Reactivation Authorization; a transition-only Control/Reactivation carrier may omit the primary Lease but cannot substitute for one or authorize operation by itself. The outer carrier request ID is correlation only and never changes an object's request binding. `TIME_RECOVERY` instead requires its matching Lease, permits independently authorized Control/Reactivation only alongside that Lease, and forbids every trust/Delegation/Denylist update on the bootstrap path. These asynchronous objects cannot widen or replace the primary purpose matrix.

Lease-specific claims include `entitlementTokenId`, `entitlementGeneration`, `leaseRevision`, `serverTime`, `offlineUntil`, one activation-global `controlRevision` / `controlState`, `leaseRequestId` and `leaseRequestHash = SHA-256` of the complete deterministic device-signed `lease-request` COSE bytes. Runtime accepts the response only for its exact outstanding request/nonce and consumes that request atomically.

After Rebind, each Lease request and Lease carries `bindingRecoveryTokenId` exactly while the durable signed binding override is active; it must equal Secure State and is forbidden otherwise. A successor Entitlement that directly binds the new key retires the override.

Offline-Control claims include the target License/activation, monotonic control revision, exactly one of `SUSPEND` / `UNSUSPEND` / terminal `REVOKE`, effective time and reason code. The exact time relation is `notBefore <= effectiveAt < notAfter`. `origin=VENDOR_INITIATED` forbids request ID/hash and supports remote/operator action. `origin=REQUEST_BOUND` requires both and must bind a `CONTROL` activation request with identical target/action/effective-time/reason. An `UNSUSPEND` cannot reverse `REVOKE`.

`controlRevision` is one activation-global monotonic sequence shared by online Lease status and Offline Control. Its sole initial tuple is exactly `controlRevision=0`, `controlState=OPERATIONAL`, `controlEffectiveAt=0`, `controlReasonCode=0 (NONE)`. Every tuple with `controlRevision>0` requires reason `1..5`; reason `0`, a non-operational state, or a nonzero effective time at revision zero is rejected. Activation requests carry only the reduced current snapshot and likewise require revision zero to be `OPERATIONAL`; every other state requires a positive revision. The Vendor authority reserves/records revisions transactionally, and an offline request includes the installation's high-water value. A new Lease requires a strictly higher `leaseRevision` unless it is the exact idempotent same-token retry. Its `controlRevision` is rejected when lower than the stored high-water value; an equal value is accepted only with the exact already-sealed `controlState`, reason/effective tuple and cannot cause a transition; a greater value applies only a signer-authorized valid transition and advances the high-water value. A suspended/revoked state survives expiration or replacement of the token that carried it. Entitlement renewal never clears or lowers the current control state.

An `offline-control` transition object requires a strictly higher `controlRevision`, except that the byte-identical same-token retry is idempotent. Revision reuse with another token, action or payload is rejected.

Time-Correction retry boundary clarification (`LIC-CHG-0015`): applying an already consumed correction remains `STATE/TIME_CORRECTION_REPLAYED` in the verifier/state mutation seam. A separate read-only receipt lookup may acknowledge the exact previously accepted encoded bytes as `ALREADY_APPLIED`; it cannot update time, state generation, revisions, requests, incidents or authorization. This supplies the idempotent user workflow without suppressing the frozen replay negative. A receipt lookup is not a new signature acceptance or permission to unlock. Different bytes must undergo ordinary verification, even when a caller claims the same ID. Secure receipt persistence and the actual UI/file workflow remain their owning later items.

Recovery-specific claims include `incidentId`, `incidentNonce`, `expectedStateGeneration`, `newStateGeneration`, `allowedTransition`, optional old/new device key IDs, `reasonCode` and a short `notAfter`. These are Secure-State generations and are never interpreted as Entitlement `generation` values.

The closed Recovery transitions are `CLEAR_TAMPER`, `REPAIR_SECURE_STATE` and `REBIND_DEVICE`. A successful Rebind creates a durable signed binding override; subsequent Leases carry that Recovery token ID until a successor Entitlement directly binds the new device key. Rebind cannot silently mutate the old Entitlement, change Edition/mode, widen Features, extend time or lower a high-water value.

Time-Correction claims include `incidentId`, `incidentNonce`, `expectedStateGeneration`, `newStateGeneration`, `timeCorrectionRevision`, `issuedAt`, `correctedUtc`, `reasonCode` and a short issuer-bounded lifetime. `timeCorrectionRevision` is an activation-global monotonic namespace separate from Entitlement, Lease, Control and Secure-State generations; exact same-token retry is idempotent, while every different correction must be strictly above the sealed high-water value.

A terminally revoked lineage can be replaced only by a separate `reactivation-authorization` signed with the `OFFLINE_CONTROL` key plus a new `OFFLINE_ENTITLEMENT`-signed Entitlement. The authorization binds the exact revoked `licenseId` / `activationId`, final revoke token hash and control revision, incident/request hash, current device key, new `licenseId` / `activationId`, Product/Edition and maximum Features. The new Entitlement references that authorization ID and starts a new generation lineage. Runtime consumes both atomically and permanently preserves a sealed tombstone for the revoked IDs; every old Entitlement, Lease, Control or Recovery object for that lineage remains rejected. This is a new commercial activation, not Recovery and not `UNSUSPEND`.

### 4.3 Vendor key hierarchy

Production uses separate P-256 keys and purposes:

1. `PROD_ROOT` stays offline in a hardware token/HSM and signs only bounded subordinate-key authorizations.
2. `OFFLINE_ENTITLEMENT` stays in controlled hardware and signs finite Entitlements approved by a Vendor operator.
3. `ONLINE_LEASE` stays in the online service HSM/KMS and can sign only short Leases, reversible suspension/unsuspend status and signed server time within a parent Entitlement. It cannot originate terminal Revocation.
4. `OFFLINE_CONTROL` stays offline in controlled hardware and signs only on-site suspend, terminal revoke, higher-revision unsuspend or explicit terminal-lineage reactivation authorization. Its signed objects may be delivered by the online service, but the online Lease key cannot originate them.
5. `RECOVERY` stays separate and normally offline; it signs only incident-scoped Recovery/Rebind/Time-Correction operations and cannot clear a commercial/security Revocation.

Every Root and delegated `keyId` is the 32-byte SHA-256 digest of that key's canonical RFC 5480 SPKI DER. An ID collision with different SPKI bytes is rejected. Each Root-signed `key-delegation` payload uses `keyId` for the Root signer and separately contains the subordinate SPKI DER, its derived `delegatedKeyId`, exact `purpose`, `environment`, `notBefore`, `notAfter`, `maxTokenLifetimeSeconds`, purpose-specific optional `maxBusinessTermSeconds` and monotonic delegation serial. A Delegation envelope is at most `158112000` seconds and every delegated ceiling can only narrow its protocol/purpose maximum. The protected `kid` on every subordinate-signed token must equal the exact `delegatedKeyId` of the accepted delegation. Runtime enforces ID/SPKI binding, purpose, lifetime, environment, denylist and serial constraints even when a token signature is mathematically valid.

A Root-signed `key-denylist` uses the same identifier namespace, a monotonic revision and entries sorted by raw `delegatedKeyId` in unsigned-byte lexicographic order with duplicate IDs forbidden. Revision one has no predecessor; every later revision binds the previous Denylist token ID/hash and must be a cumulative superset with every prior key/effective-time/reason entry unchanged. Lower revision, removal, replacement, delayed effective time or changed reason is rejected; equal revision is accepted only for the byte-identical object. Its one-year envelope limits initial import freshness only. Once accepted, each denied-key fact and revision high-water persist indefinitely, so expiry never restores a denied key. Delegations inside an unsigned `.ecstrust` carrier use the same ID ordering/uniqueness rule.

Additional rules:

- Development and test roots are entirely separate and never trusted by production.
- Authenticode/code-signing keys are separate from all licensing keys.
- Long-duration issuance, revocation and recovery require MFA, an auditable Vendor operator and explicit typed confirmation. Root/delegation ceremonies and terminal-revocation replacement use two-person approval when two authorized operators exist; until then, the single-operator risk, hardware-token custody and immutable audit must be recorded explicitly.
- Public-key rotation overlaps old and new verification keys until every valid token from the old key has expired or been reissued.
- Online key rotation is exercised regularly. A compromised online key cannot create an Offline Entitlement, terminal Revocation or Recovery token. A terminal remote Revocation is an `OFFLINE_CONTROL`-signed object that the online service may only deliver.
- The `.ecstrust`/HTTPS trust carrier is intentionally unsigned and non-authoritative and has no bundle revision. Each embedded Delegation and Denylist remains independently Root-signed and advances only under its own exact serial/revision/idempotency rules; a carrier can never roll trust backward or authorize by itself. A fully offline installation cannot learn of a newly compromised key until such a carrier or signed application update is delivered; this latency is recorded like offline revocation.
- Root compromise requires a signed application trust-root update and reissue plan; it cannot be repaired by silently downloading a new public key.

### 4.4 Vendor authority deployment gate

Phase 6.2 must select and exercise the actual production HSM/hardware token/KMS, Vendor domain/hosting, operator MFA/RBAC, immutable audit retention, backup/DR, key ceremony, duplicate-issuance protection and compromise runbook. This does not block Phase 6.1 or protocol vectors, but Hybrid production cannot pass the Phase 6.6 Release Gate without it.

## 5. Installation identity and supported-Windows behavior

The exact v1 OS/edition/architecture boundary and multi-machine acceptance
obligations are defined in [WINDOWS_SUPPORT_MATRIX.md](../../operations/WINDOWS_SUPPORT_MATRIX.md).
No Licensing result from one host broadens that matrix.

A separate signed `EntryControlSystem.License` .NET Guardian service creates and owns one machine-wide ECDSA P-256 installation key. The App Host/Node run under `NT SERVICE\EntryControlSystem.App` and have no filesystem, CNG or DPAPI access to the Guardian key or authoritative License State.

Preferred path:

- Use `Microsoft Platform Crypto Provider`.
- Mark the key non-exportable and TPM-backed.
- Limit the CNG key DACL to `SYSTEM` and `NT SERVICE\EntryControlSystem.License`.
- Derive `deviceKeyId` as SHA-256 of the canonical public-key encoding.
- Include TPM attestation in activation when available and verify it server-side before claiming hardware assurance.

The v1 TPM `contextHash` is SHA-256 of one untagged RFC 8949 Core Deterministic CBOR array in this exact order: exact UTF-8 text `ENTRY_CONTROL_SYSTEM:LICENSE:TPM_ATTESTATION_CONTEXT:V1`, then raw `requestId`, `requestNonce`, `installationId`, `deviceKeyId`, `versionIdentitySha256`, `buildIdentitySha256` and `buildManifestSha256` byte strings. No map, alternate string, omitted item or extra item is equivalent. A TPM context/evidence failure rejects the TPM request and never silently downgrades it to Software-bound assurance.

Software fallback when no usable TPM exists on a supported matrix row:

- Use `Microsoft Software Key Storage Provider` with a machine-wide non-exportable key.
- Use a distinct RSA-3072 encryption/decryption key to wrap fresh per-envelope AES-256 keys with RSA-OAEP-SHA256; the ECDSA installation key remains signing-only.
- Restrict the wrapping-key DACL to `SYSTEM` and the exact Guardian service SID. Do not use standalone DPAPI-NG, `LOCAL=user`, `LOCAL=machine` or a dedicated password-bearing local account as the v1 boundary.
- Mark the activation `SOFTWARE_BOUND` / lower assurance in the Vendor system and local status.
- Default Software-bound issuance to a shorter term/offline allowance and require explicit Vendor approval for longer terms. A complete TPM-less disk/VM clone remains an acknowledged limitation and Hybrid duplicate-activation detection is required.

The exact selected direction, candidate crypto profile, lifecycle and harness stop
rules are in [LICENSING_SOFTWARE_KSP_WRAPPING_DESIGN.md](LICENSING_SOFTWARE_KSP_WRAPPING_DESIGN.md).

The Phase 6.2 Windows spike must prove Platform CNG key ACLs, a separate TPM
sealing/wrapping key, the approved Software-CNG fallback, Guardian/App child-token
isolation, repair/reinstall continuity and TPM NV feasibility across the supported
matrix. The ECDSA signing key is never assumed to wrap the AES storage key.

RAM, NIC or disk replacement must not automatically invalidate the license. TPM clear, motherboard replacement, OS wipe or loss of the installation private key enters `RECOVERY_REQUIRED` and uses a rebind workflow. It is not automatically classified as malicious tamper.

## 6. Activation and online proof of possession

### 6.1 Offline request/response

An `.ecsreq` contains:

- request ID and a random 256-bit nonce;
- installation public key and proof-of-possession signature;
- installation ID, product, Edition and exact build identity;
- previous license ID/generation when renewing;
- current Secure-State/control high-water values and, for terminal-lineage replacement, the incident nonce plus revoked-lineage tombstone identifiers/hash;
- TPM attestation when available;

The Vendor verifies the request signature, computes the exact request hash defined in section 4.1 and produces an Entitlement bound to `requestHash`, `installationId`, `deviceKeyId` and the next allowed generation.

Import is staged, size-limited, path-safe and atomic:

- Same token ID/generation is idempotent.
- A lower generation or replay cannot replace current state.
- A higher generation with an invalid predecessor requires an incident-specific Recovery token.
- A valid renewal whose `effectiveStart = max(notBefore, termStartsAt)` is in the future is stored as a pending successor; it never replaces the current Entitlement or Hybrid pair early. Promotion no earlier than `effectiveStart` is journaled/atomic and survives restart or power loss.
- While the current Entitlement remains within `graceUntil`, a normal successor must overlap it and must not reduce its effective authorization. Immediate shortening uses an explicit higher-revision Suspend/Revoke Control token, never an apparently ordinary renewal.
- Whenever the previous Entitlement has lapsed solely because `trustedNow >= old.graceUntil`, regardless of whether an earlier Hybrid Lease had already ended, a correctly chained higher-generation successor may be accepted without overlap. It is eligible for immediate promotion only when `successor.effectiveStart <= trustedNow < successor.graceUntil` and every selected-mode requirement (including an exact Hybrid pair) is valid; otherwise it remains pending. Existing Suspend/Tamper/Recovery state is not cleared, and a terminally revoked lineage requires the separate reactivation contract in section 4.2.
- In `OFFLINE_BOUND`, promotion atomically replaces the current Entitlement. In `HYBRID_LEASED`, Secure State keeps an atomic `activePair` and a pending successor Entitlement with an optional exactly bound Lease; promotion replaces `activePair` only when both members form a valid `pendingPair` at trusted time. The old pair remains authoritative until that atomic promotion or its own effective end. Importing/promoting an Entitlement alone never invalidates a still-valid old pair and never activates the new Hybrid lineage.
- Only the highest valid pending lineage is retained; replacing a pending renewal requires the correct predecessor/generation chain.
- A wrong-machine, wrong-Edition or invalid candidate is rejected and audited while the current valid state remains unchanged.
- Reparse points, junctions, symlinks, hardlinks and time-of-check/time-of-use file swaps are rejected.

#### LIC006 bounded-import checkpoint (not a durable workflow)

`server/src/licensing/offline/import-plan.ts` accepts bounded file contents under an explicit trusted workflow intent. It accepts no path, extension-based type dispatch, HTTP body or permissive filesystem fallback. Candidate bytes and receipt observations are copied before asynchronous request lookup. The injected protected-request reader returns encoded device-signed request bytes, not an authoritative decoded caller object; the planner verifies the signature again, derives its hash/nonce/payload, matches the lookup ID/purpose and delegates response/state rules to the existing core. Time-Correction freshness evidence comes from that trusted request reader, not an import-field override.

Results are internal, non-durable plans only: `durable=false`, `runtimeAuthority=NONE`. A successful proposed state retains all core compare-generation/hash, journal, anchor and restrictive-transition commit obligations. Concurrent plans against one prior state are not two committed imports. A read-only `MODEL_ALREADY_APPLIED` Time-Correction result acknowledges only a factory-provenance model receipt, never physical persistence or user-visible completion. Request-store failures expose a fixed safe code without adapter error text; invalid candidates cannot mutate current model state.

This first slice has no request creation/signing/export, concrete protected reader/store, filesystem open/write/quarantine, durable receipt acknowledgement, HTTP/UI integration or Rebind-device acquisition. Complete Recovery/Time-Correction/reactivation positive workflow matrices, historical-request retry behavior after consumption, real safe file intake and atomic durable completion remain open. Hybrid reactivation cannot be completed from the two Offline artifacts alone; the core continues to require the exact Lease/request set owned by the Hybrid workflow. Do not mark LIC006 complete from the initial import-planner tests.

#### LIC006 request-generation checkpoint (portable adapters, not Windows storage)

`offline/request.ts` builds `ACTIVATE`, `RENEW`, `CONTROL`, `RECOVER`, `REBIND`, `TIME_CORRECT` and `REACTIVATE` requests. The trusted caller supplies purpose and explicit finite request timestamps (at most the frozen 30-day limit), not arbitrary claims or a path. CONTROL additionally takes only the frozen action, effective UTC and reason1..5, validates them before signing and snapshots them before asynchronous work. Factory-provenance model state supplies installation public key, Edition/build digests, high-water counters, current/pending target lineage and the highest renewal predecessor. RECOVER/REBIND instead target the current Entitlement and its generation/hash, with incident and state evidence derived from that same protected model. Request timestamps are not signed Vendor time and cannot raise the clock floor or authorize operation. Production acquisition of those inputs remains Guardian work. REBIND obtains the new local key/assurance through the staged-device provider and retains the previous effective key from state, as described in its separate checkpoint below.

An injected installation-only signer receives the exact activation-domain Sig_structure; it never receives a Vendor private key or arbitrary caller payload. Fresh CSPRNG ID/nonce acquisition is an adapter obligation. TPM requests require their exact context-bound evidence adapter and never downgrade on failure; portable context/size tests are not verification of real TPM attestation. Signatures are canonicalized to low-S and the complete tagged deterministic COSE bytes are independently reverified against the model device/build before a plan is returned.

Export accepts only a plan created by that workflow instance. Before releasing export bytes, a trusted registration adapter must compare the expected License state generation/hash, reserve request ID and nonce without overwrite, and acknowledge the exact request ID/hash. Production registration must flush the protected request record and required journal/outbox before acknowledgement; it must not increment the License generation behind the signed request and immediately stale it. Retry of that same plan registers/exports the exact same bytes without signing again. The eventual request ledger/transaction must retain uniqueness, consumed status and restart-safe retry evidence independently of this in-memory plan provenance. Public filename and extension carry no authority.

This checkpoint supplies no production signer/CSPRNG/TPM provider, real protected store, filesystem write, restart rehydration, UI/download endpoint or runtime authority. Both plan and exported-byte results explicitly retain `durable=false` and `runtimeAuthority=NONE`; registration doubles exercise obligations, not physical flush/ACL guarantees. Request preparation has no authority or consumption effect. Remaining LIC006 work includes safe file adapters, durable completion/retry after consumption, other request purposes and complete recovery/control/reactivation integrations. No frozen wire, commercial, time or state-transition rule changes here.

#### LIC006 Entitlement completion adapter (not physical durability)

`offline/entitlement-completion.ts` provides separately closed Entitlement, CONTROL and Recovery completion factories that share one internal transaction handoff. The original EV0033 checkpoint covered Entitlement only; CONTROL begins under EV0034. Each factory accepts only its selected bounded import intent and an existing factory-provenance store snapshot, runs the existing planner, then hands its complete proposed state and every commit obligation to a trusted CAS adapter. It never consumes a request or writes a receipt separately. The adapter must compare both previous generation and hash and atomically handle the new state, consumed requests, receipts, journal/outbox and independent anchors. It must not acknowledge pending or unreconciled restrictive transitions. Where the core supports idempotent receipts (Entitlement/Control), exact duplicates still require read-only confirmation of the current generation/hash; an old in-memory model receipt alone is not completion. Recovery instead retains strict single-use rejection, including after a lost acknowledgement; reconciliation is a separate open concern.

An adapter exception is `COMMIT_OUTCOME_UNKNOWN`: the commit may have succeeded before acknowledgement was lost. The workflow never rolls it back, deletes data, automatically retries a stale proposal or reports that authority was unchanged. Conflicts, pending completion and a mismatched acknowledgement are unsuccessful outcomes. Only an exact acknowledged state hash/generation yields `ADAPTER_ACKNOWLEDGED` or `ADAPTER_CONFIRMED_DUPLICATE`; these portable results remain `durable=false`, `runtimeAuthority=NONE` and are not a public activation result. The caller must acquire a fresh trusted snapshot before retry/reconciliation.

Consumed request history retains the exact signed request bytes for this retry path. Entitlement imports correlate the response request ID/hash with the independently verified historical request even before the core's exact-receipt shortcut. Parsing this correlation grants no trust: full core signature verification or the authenticated receipt is still required. Historical lookup is not renewed outstanding authority: new responses still face the core consumed-request/generation/lineage checks. Missing history cannot be reported as a completed duplicate. The test store is an all-old/all-new in-memory double, not a production store, crash-safe journal, Windows anchor or process-restart rehydrator. Other response types, actual file safety/storage, complete recovery workflows and independent closure review remain open.

#### LIC006 Offline-Control workflow checkpoint

CONTROL request creation/export does not suspend, unlock or revoke anything. A request-bound `.ecsctl` must match the independently verified archived request ID/hash, target, action, effective time and reason; existing core rules still require the Offline-Control signer and a strictly higher control revision except for an exact read-only retry. The planner retains ID/hash correlation even for historical retries. Request-bound controls cannot omit the selected request; Vendor-initiated controls cannot acquire one, even on duplicate delivery. Vendor-initiated delivery needs no request lookup or consumption.

The Control completion factory passes every existing restrictive-transition obligation to the same trusted complete-state adapter; a pending transition or lost acknowledgement never reports effectiveness. Existing state/time behavior owns scheduled effects, reversible unsuspend and permanent revoked-lineage tombstones. In particular, a CONTROL request for UNSUSPEND is not authority to reverse terminal Revoke. Request creation does not introduce a new commercial rule or clear other locks. Physical transition barriers, secure files/keys/store, process-restart recovery and independent review remain later/open work; model/double evidence cannot establish actual revocation delivery to a customer.

#### LIC006 RECOVER workflow checkpoint

RECOVER request creation requires a factory-provenance current Entitlement and an existing integrity incident with a repairable storage/tamper condition. It never creates a caller-selected incident or takes caller-supplied hashes, device overrides or allowed transitions. It binds current Entitlement token/hash/generation even if a higher pending successor exists, while preserving the actual Secure-State/Control/Lease/Time-Correction counters. A terminally tombstoned lineage cannot use this request path to reactivate.

The separately closed Recovery completion factory uses the existing planner and complete-state CAS/acknowledgement handoff. This RECOVER path permits only the already approved signed CLEAR_TAMPER or REPAIR_SECURE_STATE, not REBIND_DEVICE. It preserves core single-use replay rejection, exact incident/request/state/parent/Control binding and independent restrictions. A lost commit acknowledgement is an unknown outcome; replay remains rejected and cannot be used as a new repair or automatic rollback. Durable reconciliation/receipt UX after such an outcome is still open and this slice introduces no new already-applied Recovery bypass.

Recovery never extends the Entitlement, clears suspension/revocation, discards pending successors or clears a separate remaining storage/tamper/time condition. Production evidence acquisition, physical protected-state repair, safe file I/O, restart reconciliation and independent closure review remain open. Results still carry durable=false/runtimeAuthority=NONE and are not a production unlock acknowledgement.

#### LIC006 REBIND workflow checkpoint (portable, verified under LIC-EV-0041)

RECOVER is committed as `97a6d02`. The next bounded slice uses a trusted Guardian-owned staged replacement-device provider, never a caller-supplied device override. REBIND requests preserve the protected installation identity, current Entitlement/incident/state and previous effective key, but use the new local key for proof of possession and assurance/TPM context. Preparation/export never activates or rotates the effective binding. Missing protected history after an OS wipe is not reconstructed from a customer Backup by this slice.

A separately closed REBIND import/completion intent reacquires and snapshots the staged local replacement binding before asynchronous lookup, verifies the archived REBIND request and delegates only REBIND_DEVICE to the existing core. The complete-state commit includes binding override, single-use consumption, receipts, anchors and journal obligations. The adapter must also reconcile the staged key's lifecycle with that transaction; no key is deleted on failure or lost acknowledgement. Previous binding history supports A-to-B-to-C without modifying the original Entitlement. Existing expiry, Features, Edition, commercial/tamper/time restrictions and pending successors remain governed by the core. Strict Recovery replay rejection remains unchanged.

No real CNG/TPM key acquisition, protected persistence, hardware/Backup transfer, remote disable, safe filesystem, UI/runtime or independent closure is supplied here. The old disconnected installation remains bounded by its existing finite token until contact/expiry, not instantly disabled by local Rebind.

#### LIC006 TIME_CORRECT workflow checkpoint

REBIND is committed as91b4771. TIME_CORRECT derives current lineage and frozen time-incident ID/nonce/floor from factory-owned state, not caller overrides. A trusted observation adapter snapshots boot/tick before signing; its request-hash-bound evidence is registered with the exact request bytes. Request export never repairs the clock. Same-boot evidence must match the incident; lost boot evidence requires the existing fresh-incident workflow, not invented elapsed time.

The closed Time-Correction completion facade reuses the existing state transition and complete-state CAS. Exact historical receipt acknowledgement follows CHG0015: verify archived request correlation, then use an explicitly read-only protected-store confirmation of current generation/hash. It never reapplies the correction, consumes twice, changes time or calls a write adapter for a duplicate. Missing confirmation, conflict, pending or lost acknowledgement is not completion. The core's TIME_CORRECTION_REPLAYED rejection remains unchanged. Real clock acquisition, durable evidence/receipts, safe filesystem and Windows/runtime/independent closure remain open.

#### LIC006 REACTIVATE workflow checkpoint

TIME_CORRECT is committed as9703e13. The bounded REACTIVATE request derives the exact current/head revoked lineage, permanent tombstone ID/hash, final revoke token/revision and existing incident from factory-owned state. It takes no caller-selected lineage, incident or authority. Incident creation still uses the existing protected BEGIN_REACTIVATION transition; this request adapter neither opens an incident nor clears a lock.

The separately closed Reactivation completion factory imports both bounded signed artifacts through the existing planner and one complete-state CAS/acknowledgement. OFFLINE_CONTROL authorizes replacement; OFFLINE_ENTITLEMENT signs the new generation-one lineage. No half pair, wrong request/incident/device, reused authorization or old-lineage resurrection is allowed. Independent tamper/storage/time locks survive. Lost acknowledgement remains unknown and strict authorization replay remains rejected; no new retry bypass is introduced. HYBRID_LEASED still requires its exact Lease/request pair and cannot be completed by these two offline artifacts alone; that integration belongs to LIC007.

This remains portable workflow evidence, not protected persistence, a Vendor operator UI, real filesystem/Windows/runtime integration or independent closure. Next safe work is a LIC006 remaining-obligations audit and safe-file/durable-adapter contract work, not automatic closure or production release.

#### LIC006 remaining-obligations audit and adapter acceptance contract

Audit baseline: HEAD9703e13 plus preserved uncommitted REACTIVATE checkpoint EV0045. This section decomposes existing requirements; it does not change wire semantics, choose an unproven Windows API/provider, grant runtime authority or close LIC006. Evidence EV0047 is a source/document audit, not a new execution of EV0045 tests.

| Surface inspected | What exists | What is still missing | Owning gate |
| --- | --- | --- | --- |
| `offline/request.ts` | Seven signed request purposes; immutable plans; conditional registration before returning export bytes | Real CSPRNG/CNG/TPM/time acquisition; protected request ledger and physical export | LIC006 contract; LIC008 feasibility; Guardian/Store implementation |
| `offline/import-plan.ts` | Size-limited byte inputs; explicit intent; archived signed-request verification; complete pair planning | Secure file selection/open/read/identity stability; quarantine; no path API exists here | LIC006 safe-file work; Guardian integration |
| `offline/entitlement-completion.ts` | Complete-state CAS obligation handoff; exact acknowledgement; explicit unknown outcomes | Concrete atomic durable store, restart rehydration and journal/anchor reconciliation | LIC006 contract; LIC-6.5-002 implementation |
| `offline/rebind-device.ts` | Copied staged-device snapshot; previous/new key distinction | Real staged-key ownership, lifecycle and interrupted-commit reconciliation; OS-wipe history acquisition | LIC008 and Guardian/Store |
| `core/v1/state.ts` and `time.ts` | Pure state/time transitions, receipts, tombstones and factory provenance | Verified durable rehydration; platform evidence; no deserializing arbitrary JSON into trusted model state | Guardian/Store; independent review |
| `scripts/test-license-offline-v1.mjs` | Portable generated-request/import/completion regressions for both Editions | Real file/ACL/crash/restart evidence and independent LIC006 closure review | LIC006 plus owning later release gates |

Safe intake contract, derived from sections 4, 6.1, 7 and 10:

1. A trusted workflow selects expected object type and bounded request ID before file bytes enter the planner. Extension, basename, MIME supplied by the user and token contents cannot select a more permissive workflow. Reactivation stages both bounded artifacts before any state commit.
2. The eventual native adapter proves the selected object is a regular file and rejects reparse/junction/symlink/hardlink and path-swap cases. Checking a path and later reopening it is not evidence. File identity and reads must remain tied to the validated open object; the implementation must demonstrate how it prevents or detects concurrent replacement/modification. Exact Windows handle/access/share choices remain subject to platform tests, not assumed from this contract.
3. Enforce the frozen per-type byte cap before allocation-heavy parsing and while reading. Reject empty, truncated, growing and oversized input. Deliver a private complete byte snapshot; no partial bytes or live mutable view reaches signature verification.
4. A file read or signature failure does not replace the active Entitlement, consume requests or latch tamper. Invalid candidate handling is distinct from integrity failure of authoritative State. Never delete the source, the active License, customer data or the only evidence. Quarantine follows section 10: safe copy, protected destination and redacted hash/reason evidence; it never grants authority.
5. Safe export consumes only a factory-owned registered request plan. It writes those exact bytes; it cannot regenerate an ID/nonce/signature, rotate a key or omit Time-Correction evidence from the protected ledger. Retry retains the original request. Destination failure is not activation and cannot roll back an already registered request. Existing no-overwrite registration does not by itself prove destination file safety. Physical publication/flush and collision behavior need explicit tests before implementation is called safe.

Durable registration/completion contract, derived from sections 6.1, 7, 11 and 13:

1. Request registration compares the expected State generation AND hash, reserves ID/nonce without overwrite and retains exact signed bytes/hash, consumed status and any boot/tick evidence. Flush the required protected record and journal/outbox before releasing request bytes. Registration must not secretly increment License generation and immediately invalidate its signed request. Concurrent uniqueness and restart retry are ledger obligations, not a WeakSet guarantee.
2. A response proposal remains non-authoritative until the trusted transaction handles the complete new State, consumed request/authorization IDs, receipts, pending pair, tombstones, staged binding reference, journal/outbox and independent anchors. Never commit an individual field or one Reactivation half. Enforce every `commitObligations` entry; restrictive transitions also retain the section 11 barrier/reconciliation requirements.
3. After interruption, admit only the provable last complete old or new transaction. Do not choose the highest readable file or silently restore an older copy. Anchor disagreement, missing evidence or unknown transaction outcome remains restricted; no automatic retry of a stale proposal, compensating rollback, deleted key or renewed request authority.
4. The acknowledgement must match the accepted complete State generation/hash. Pending, conflict, malformed acknowledgement and exceptions are not success. A thrown write may have committed; `COMMIT_OUTCOME_UNKNOWN` cannot be displayed as unchanged or successful. Production public status is separate from today's `durable=false/runtimeAuthority=NONE` adapter results.
5. Entitlement/Control exact retries retain existing idempotent core behavior and require current-store confirmation. Time-Correction uses its separately read-only receipt confirmation under CHG0015. Recovery/Rebind/Reactivation retain strict single-use rejection; durable support reconciliation after lost acknowledgement is still open, not permission to add a generic `ALREADY_APPLIED` bypass.
6. Database Restore and customer Backups cannot supply State, private keys, request authority or receipts. The audited PostgreSQL projection cannot authorize operation. Store protection/provider selection remains LIC008 and production implementation remains LIC-6.5-002; no ad hoc Node filesystem or database substitute is accepted.

The following are planned acceptance cases, NOT passing tests. A later evidence row must name the executed case, Edition, OS/build/filesystem, adapter version, result and retained failure artifacts. Portable doubles alone cannot satisfy the physical columns.

| Planned case ID | Required check | Evidence needed |
| --- | --- | --- |
| LIC-FILE-001 | Correct type and exact bytes; wrong extension cannot widen intent; Reactivation missing half | Both Editions through actual native intake and existing planner |
| LIC-FILE-002 | Empty, truncated, cap+1 and growth during read; bounded memory/read behavior | Native real-file tests for every relevant cap |
| LIC-FILE-003 | Symlink/junction/reparse/hardlink, path replacement and concurrent content modification | Supported-Windows matrix filesystem attack tests tied to open-object identity |
| LIC-FILE-004 | Access denied, sharing/antivirus conflict, read failure and quarantine failure preserve current authority/data | Disposable protected directories; zero unauthorized writes/consumption |
| LIC-FILE-005 | Export failure/collision/interruption and retry retain registered exact bytes and Time-Correction evidence | Physical publication tests plus restart-safe ledger reconciliation |
| LIC-STORE-001 | Competing request ID/nonce registrations, stale generation/hash and post-registration restart | Protected ledger, no overwrite and exact retry evidence |
| LIC-STORE-002 | Inject failure at each stage/write/flush/anchor/ack point, including both Reactivation artifacts | Real complete-old/complete-new crash/restart matrix; no half authority |
| LIC-STORE-003 | Commit succeeds but acknowledgement is lost; restrictive transition still pending | Proven transaction reconciliation; no false effectiveness or replay bypass |
| LIC-STORE-004 | Receipt/history tampering, missing history and wrong request correlation; read-only confirmation races | Fail-closed protected-store and zero-write duplicate evidence |
| LIC-STORE-005 | Staged Rebind key survives interrupted commit; Backup/Restore cannot import authority | CNG/TPM/Store and real Backup boundary evidence |

Execution boundary: the next bounded implementation is portable safe-intake/export orchestration against a trusted adapter, with explicit fake-adapter tests and no physical-safety claim. Selecting and executing the native implementation depends on LIC008; production durable storage depends on Guardian and LIC-6.5-002. LIC006 remains `[~]`. This audit does not alter the section 17 dependency graph or waive physical evidence. If a proposed closure requires changing which gate owns an exit criterion, record a reviewed scope/dependency clarification first; do not close LIC006 by silently moving its requirements to a later phase.

#### LIC006 portable file orchestration checkpoint

`offline/file-workflow.ts` coordinates a trusted selected-file adapter with the existing import planner and request exporter. It accepts closed metadata, not paths, extension-based dispatch or caller artifact bytes. Before I/O it validates model provenance, intent, request ID and observation shape and snapshots metadata. It passes frozen per-type caps to the adapter and rejects empty/oversized/non-byte results before planning; each returned buffer is copied before further awaits. Reactivation reads both artifacts before any planner invocation. The returned result is a plan, NOT an automatic commit or public activation result.

The file adapter must enforce limits during reading and prove regular-file identity/link/swap safety in its later native implementation. Post-read length checks here cannot prove bounded native allocation or Windows safety. No boolean claimed by an untrusted file is accepted as evidence. Quarantine and real native open/publish remain open.

Request publication delegates first to the existing provenance-checked registration/export workflow, then publishes exactly the registered bytes. An acknowledgement must match byte count and computed hash. Publication exceptions are unknown outcomes, not proof that no file exists; registration is never rolled back and retries reuse the same plan. A matching adapter acknowledgement still returns durable=false/runtimeAuthority=NONE. Fake-adapter tests do not close any physical LIC-FILE or LIC-STORE case from the audit.

#### LIC006 six-intent file completion acceptance matrix

The permanent offline runner executes a separate matrix through the real
`createOfflineFileWorkflowV1`, real signature verification and the six closed
completion factories. Test-only scenario builders are shared with existing
direct-completion suites; their original test bodies and counts are retained.
Eight cases for each intent in each Edition add 96 cases, separately from the
existing 32 file-orchestration cases:

- Valid bounded role/type intake, planning without writes, then one complete-state
  commit; assert generation, request consumption, receipts and intent-specific
  outcomes, including preserved Entitlement for repair and retained revocation
  tombstones for Reactivation.
- Tamper each signed artifact (both halves independently for Reactivation), file
  read failure, wrong request and caller-supplied byte override: no state writes.
- Pending/conflicting/invalid acknowledgements never become success.
- Lost acknowledgement never rolls back the committed state. Explicit retry uses
  the fresh snapshot: Entitlement/Control/Time-Correction confirm read-only;
  Recovery/Rebind/Reactivation reject without a second write. Rebind's staged-key
  admission rejects an already-current key before token replay checking.
- Concurrent imports against one previous snapshot yield one CAS winner.

This is bounded portable coverage, not an exhaustive semantic or physical test
matrix. The separate suites retain renewal, Control action, repair and other
variant coverage. Real native file acquisition/publication, protected Store,
power-loss/restart reconciliation and independent closure review remain open.

#### LIC006 one-pass file-to-completion checkpoint

`file-workflow.ts` now exposes separate `prepareImport` (no commit) and `applyImport` (closed completion) operations sharing the same bounded intake. `applyImport` requires a configured trusted store before any file I/O. It dispatches copied content to the matching existing Entitlement/Control/Recovery/Rebind/Time-Correction/Reactivation completion factory, which performs the existing verification and complete-state CAS handoff. It neither reopens files between verification and commit nor accepts externally constructed proposals or artifact-byte overrides. Reactivation still stages both files before verification/commit; no half-pair write is introduced.

Completion failure/unknown-outcome and purpose-specific replay/duplicate semantics are unchanged. A new explicit retry reacquires a fresh trusted State snapshot and reads the selected candidate again; it is not an automatic retry or an assurance that a changed selected file is the same artifact. Existing core verification still applies. Portable acknowledgement remains durable=false/runtimeAuthority=NONE. All real native safety, quarantine, protected persistence, restart and independent review requirements remain open.

#### LIC007 portable request checkpoint (in progress)

Start from committed LIC008 preparation `5e842d9`; its physical laptop evidence
remains pending. LIC007 dependencies LIC003–005 are complete. Implementer Codex;
acceptance reviewer Project Owner; independent closure review remains required.

The first bounded slice acquires an exact lease-challenge through a trusted
Vendor HTTPS adapter, parses its bounded unsigned carrier, and creates a closed
CHECK_IN request for explicitly selected CURRENT or PENDING Entitlement. TIME_RECOVERY
uses the current Hybrid parent and existing time incident only. Device/build,
parent identity/generation, Control tuple, Lease/state counters and any binding
Recovery reference come from a factory-owned model. No caller-supplied claim,
URL, clock floor, nonce or signed-body override is accepted. The installation
signer signs only that Sig_structure; low-S normalization and full re-verification
precede the internal plan. A challenge is neither Vendor time nor License authority.
Its 300-second expiry/single-use is enforced by Vendor; the local workflow cannot
infer a trusted wall-clock expiry from this unsigned carrier.

For TIME_RECOVERY the trusted observation is captured before challenge acquisition
and signing, conservatively including those delays in the eventual request-bound
same-boot RTT. It must match the existing incident boot/tick. Retries keep the
same signed bytes and original evidence, never reset RTT or create new authority.
Actual Windows acquisition and final response-time freshness remain owning gates.

Release of transport bytes requires protected registration comparing State generation
AND hash, reserving request ID AND nonce without overwrite, and retaining exact
bytes/hash/purpose/parent and time evidence. Record/journal/outbox durability and
same-boot reconciliation are adapter obligations. A mismatched/conflict receipt
releases no bytes; an exception is an unknown registration outcome. Exact retries
use the original plan without fetching another challenge or signing again.

All results remain internal `durable=false`, `runtimeAuthority=NONE`. This slice
contains no real HTTPS endpoint, Vendor nonce database, retry scheduler, response
application, pair promotion, runtime admission or Store. Full Hybrid reactivation,
transition-only delivery, trust updates and outage/time-recovery integration remain
open. Existing frozen wire/state/time semantics and LIC006 review stay unchanged.

#### LIC007 primary-Lease response checkpoint (in progress)

Request preparation/registration is committed as `10d09f7`. The next bounded
workflow accepts exact response bytes plus the expected request ID and optional
trusted local receipt observation. The transport adapter remains responsible for
Vendor origin, HTTP status/media, no redirects/0-RTT and bounded reads. This
portable module opens no connection and accepts no URL, caller claim or override.

The closed carrier is bounded and copied before the protected-request read. Only
the primary-Lease variant is implemented here: Control/Reactivation/trust sidecars
and transition-only variants are rejected together before any request read or
commit. They are not silently stripped or partially applied; their dedicated
orchestration remains open. Parsing the unsigned carrier grants no authority.

The archived installation-signed request is reverified against model device/build.
Carrier ID, archived request ID and signed Lease request ID/hash must agree,
including before the model's read-only historical Lease receipt shortcut. Existing
model commands perform signature/trust, lineage/parent, feature, revision,
Control, expiry, pair promotion, consumption and time checks without changing
frozen policy. CHECK_IN uses IMPORT_LEASE; TIME_RECOVERY uses RECOVER_ONLINE_TIME
and the original protected request-bound boot/tick evidence plus copied receipt
observation. Time Recovery retains strict replay rejection; no ordinary duplicate
shortcut is used to replay time repair or clear an independent restriction.

Preparation only creates a factory-owned proposal. Completion accepts only a plan
from that workflow and delegates the entire proposal to the existing protected
Store CAS/journal/anchor/reconciliation contract. Generation AND hash must agree;
IDEMPOTENT requires read-only acknowledgement, not another write. Conflict,
pending, mismatched acknowledgement and unknown commit outcome are distinguished;
no automatic rollback or retry of a stale proposal occurs. All results remain
`durable=false`, `runtimeAuthority=NONE`. A Store double is not Windows durability.

#### LIC007 control-only transport dispatch checkpoint (in progress)

Primary-Lease response handling is committed as `14ddebf`. A separate closed
workflow now handles a CHECK_IN carrier containing only independently signed
Offline Control. The primary-Lease factory remains closed to this variant. Mixed
Lease/Control, trust and Reactivation carriers still reject as a whole, before
request lookup or any commit. TIME_RECOVERY cannot use a control-only response.

The new dispatcher snapshots bounded carrier bytes and expected request ID before
awaiting the protected request reader. It re-verifies the stored installation-signed
CHECK_IN with model device/build, checks exact carrier/request ID and current or
pending Hybrid parent lineage/generation. A fresh command requires an unconsumed
request at the model generation with matching Lease and complete Control counters.
Only an exact model-authenticated Control receipt may bypass current transport
freshness for read-only acknowledgement; existing lineage/tombstone rules still
apply. Expired exact Control retries retain the existing read-only behavior.

The carrier and its Lease request never authorize the Control command. Parsing the
embedded command selects only its independent request lookup. VENDOR_INITIATED
Control needs no CONTROL request; REQUEST_BOUND Control resolves its own signed
activation-request/CONTROL ID/hash/action/time/reason through the existing closed
Offline-Control planner/completion. The lease-request cannot substitute for it.
Existing core verifies signature, purpose, edition, lineage, revision, terminal
revocation and scheduling, preserving independent security/time restrictions.

Only the Control proposal reaches the existing complete-state Store transaction;
CAS/journal/anchor/restrictive-transition reconciliation and unknown-outcome rules
are unchanged. This is command dispatch, not a successful Lease check-in: it does
not consume the Lease request, clear network failure, advance Lease/time evidence
or create an active pair. REQUEST_BOUND Control consumes only its own CONTROL
request with the command. Transport delivery receipt/consumption and combined
response coordination remain explicit later LIC007 work, not an implemented
interpretation of step6 below. Results remain `durable=false`,
`runtimeAuthority=NONE`; real HTTPS and Windows Store acceptance remain open.

#### LIC007 Lease plus Offline-Control checkpoint (in progress)

Control-only transport dispatch is committed as `bc7aecb`. The separate combined
factory accepts exactly one Lease plus one independently signed Offline Control,
for CHECK_IN or TIME_RECOVERY. Trust/Reactivation and single-artifact variants
remain outside this factory. The existing primary-Lease and control-only factories
retain their closed scopes. Input bytes, expected request ID and trusted receipt
observation are bounded/copied before asynchronous reads. The primary request is
verified and exactly hash/ID-correlated; REQUEST_BOUND sidecar Control separately
resolves and verifies its own CONTROL request, including historical retry binding.

The internal `IMPORT_LEASE_CONTROL` command adds composition, not a wire token or
new authority policy. Both objects use existing reducers and unchanged validators
inside the same unsealed state generation. A verified Lease preview establishes
its Control revision and, for Time Recovery, authenticated time. The sequence then
respects the existing activation-global Control rules: a higher-revision sidecar
follows Lease; otherwise Control precedes Lease and an equal-revision Lease must
echo exactly the sealed Control tuple. Conflicting tuples and stale Control objects
still reject. A terminal Revoke cannot be undone by Lease. The preliminary result
is never sealed, returned, projected to runtime or sent to a Store.

Only after both reductions succeed does the outer transition mature/promote and
seal once: one new generation, one previous-state hash, both signed receipts and
all applicable request consumptions. A single complete-state Store call retains
all CAS/journal/anchors/restrictive-reconciliation obligations. Failure of either
object leaves the original model unchanged and makes no Store call. Time Recovery
and Control are committed together; an invalid sidecar cannot repair the clock,
and repair cannot clear unrelated security restrictions. The caller cannot choose
ordering or override fields. No intermediate single-artifact completion is called.

Fresh imports require neither artifact to be an existing receipt. One known half
is rejected as COMBINED_PARTIAL_RECEIPT rather than applying only the other half.
For CHECK_IN, two exact existing receipts may obtain only the existing read-only
acknowledgement of current state after complete request correlation; this does not
claim the historical objects were originally committed together. Existing terminal/
retired-lineage restrictions remain, including refusal to replay the Lease after
terminal Revoke. TIME_RECOVERY remains single-use and rejects replay. Uncertain
commits require reconciliation; no rollback or automatic partial retry is attempted.

This checkpoint changes only portable composition. Signed protocol, prior single-
artifact policy, production persistence and runtime authority are unchanged.
All results retain `durable=false`, `runtimeAuthority=NONE`. Independent review of
this committed LIC007/core composition is complete under LIC-EV-0074; see
[scoped review](../reviews/LICENSING_HYBRID_REVIEW.md). Future additions still require closure
review. LIC006's completed review is not repeated. Physical old-or-new power-loss proof, protected delivery reconciliation,
real transport/backoff, trust updates and full Hybrid Reactivation remain open.

### 6.2 Hybrid check-in

1. The installation obtains a short-lived, one-time nonce only from exact `POST /v1/licensing/lease-challenges`; the closed deterministic challenge carrier is capped at `4096` bytes and Vendor state, not suspect client wall time, enforces its `300`-second lifetime and consumption.
2. The installation sends exactly one deterministic `COSE_Sign1` body with media type `application/vnd.entry-control.lease-request+cbor;v=1`, protected `kid = deviceKeyId` and the installation-key signature. There is no unsigned authorization body beside it.
3. The exact `lease-request` CDDL requires `protocolVersion`, `tokenType`, `requestId`, nonce, HTTP method `POST`, exact path `/v1/licensing/leases`, `licenseId`, activation/installation/device IDs, exact parent Entitlement token ID/generation, last Lease revision, activation-global Control revision/state, Secure-State generation and exact version/build/manifest SHA-256 values. The COSE signature covers the complete deterministic payload, while the signed method/path prevents cross-endpoint replay.
4. The service resolves the registered device public key, verifies every binding, consumes the nonce/request ID once and processes retries idempotently.
5. For an ordinary operational `CHECK_IN`, it normally returns a TLS-protected closed carrier capped at `524288` bytes with an independently signed Lease carrying a higher Lease revision, signed server time, permitted Control tuple and the exact request ID/hash binding above. A transition-only `CHECK_IN` response may instead contain independently signed Control/Reactivation material and no Lease, but that carrier cannot substitute for a Lease or authorize operation by itself. A `TIME_RECOVERY` response always requires its matching same-boot Lease, may carry only independently authorized Control/Reactivation beside it, and rejects trust updates. A terminal revoke or lineage reactivation is a separate `OFFLINE_CONTROL`-signed object that the response may only transport; optional ordinary-check-in trust updates remain independently Root-signed.
6. The installation verifies the complete response, outstanding request hash/nonce and exact Entitlement parent before atomically consuming the request and advancing Secure State.

TLS 1.3 is preferred and 0-RTT is disabled for license mutation. Application signatures remain the final trust layer so ordinary certificate rotation does not brick an offline-first customer.

Retry is idempotent with bounded exponential backoff and jitter. Multiple installations presenting the same activation ID are an anomaly for Vendor review; a network failure alone never creates a tamper latch.

#### Portable trust-sidecar checkpoint (LIC-6.2-007)

The independent review of e88d0ca is committed as ec2fbf3. The subsequent trust workflow in server/src/licensing/hybrid/trust-response.ts prepares independently Root-signed trust updates from ordinary CHECK_IN responses. It checks the archived installation-signed request, factory-owned state and exact parent; TIME_RECOVERY is forbidden. Existing carrier caps, unsigned-byte key ordering, pinned Roots, global per-Root/environment Delegation serial high-water and cumulative Denylist predecessor/revision rules remain unchanged. Delegations are validated in serial order after wire-order validation, preserving all prior facts. Only the exact current highest Delegation may repeat; replaying older Delegations remains a rollback even if previously accepted. Import envelope expiry does not erase accepted denial facts.

Preparation uses the existing corroborated clock floor when the model has trusted-time tracking. Its immutable proposal binds both the previous trust digest and License generation/hash. The trust-only Store adapter must compare both, retain exact signed artifacts, journal/flush/anchor the update and reconcile restrictions before acknowledging. Exact retry against a reloaded matching trust snapshot is read-only; stale factories conflict. The internal deterministic trust digest is CAS metadata, not a signed protocol change.

This facade does not validate or apply companion Lease/Control/Reactivation artifacts, consume CHECK_IN, replace the live verifier or authorize operation. A malformed companion cannot confer License authority here. Returned acknowledgement remains durable=false and runtimeAuthority=NONE. Runtime trust replacement, revalidation of existing grants under newly denied keys and coordinated complete-response application are mandatory separate integration work before production use. The full-response rule above is unchanged. Physical protected storage, HTTPS, delivery reconciliation and LIC007 closure remain open.

#### Coordinated trust and License checkpoint (LIC-6.2-007)

The trust-only checkpoint is committed as 6f7b411. The subsequent hybrid/trusted-response.ts facade supports ordinary CHECK_IN carrying a Lease, a Root-signed trust bundle and optionally an independently signed Offline-Control. It snapshots each archived request once, validates the trust update, then uses a separately staged model branch under that same trust to validate the complete Lease/Control response. Unsupported Reactivation/control-only variants and TIME_RECOVERY remain rejected in this facade.

The core stageTrust method accepts only a factory-owned state and a signed bundle verified against its frozen existing Roots. It preserves the same state/hash/generation at branching; it cannot inject arbitrary state or replace Root anchors. The resulting branch re-resolves current/pending Entitlement and Lease signing authority, including pendingCurrentLease, on projection and on every successful transition, including receipt shortcuts. Historical expiry/consumption claims are not re-imported, and accepted Control restrictions/tombstones are not removed. A valid immediate replacement Lease can retire a newly denied old Lease; a remaining denied authorizing token causes preparation/projection to fail rather than silently deleting history or creating a new lock policy. Denial activation uses the existing corroborated enabling-time rule.

One immutable proposal contains the trust CAS hash, complete License proposal and exact received bytes. Its adapter must atomically compare and persist both trust and state, with existing journal/anchor/flush/restrictive reconciliation obligations. Partial/mismatched acknowledgements, conflicts, pending writes and unknown outcomes publish no replacement machine. A complete acknowledgement returns the staged machine/state/trust to the trusted coordinator with durable=false and runtimeAuthority=NONE; it never switches a real running service. The production coordinator must retire the old verifier and all operations using it behind the protected commit/reconciliation barrier. A later fresh CHECK_IN works with the returned model/trust. Replaying an already consumed response still fails the archived request generation check; lost-ack reconciliation requires protected read-back, not blind import retry.

Independent review of these new core/trust changes at53a7d74 is complete:28/28 probes (26 acceptance checks plus2 clock diagnostics), with no reproducible blocking portable-contract defect. See [trust coordination review](../reviews/LICENSING_HYBRID_TRUST_REVIEW.md). The earlier Offline and Hybrid reviews are not repeated. Actual service-barrier switching, restart rehydration, protected Store and target Windows acceptance remain outstanding. No LIC007 or Release Gate closure is claimed.

The review records a concrete LIC-6.2-009 integration gate: when a tracked-clock observation crosses a scheduled signing-key denial, the model rejects the transition neutrally with SIGNING_KEY_DENIED. The unchanged historical clock-managed state can still project operational at its old corroborated floor. Such a projection is not a successful current authorization evaluation. The future coordinator must deny admission after the failed observation/trust check until valid replacement or reconciliation succeeds; a runtime test must demonstrate this before closure. This clarification does not add a persisted lock or allow ordinary caller time to advance the clock floor.

#### Hybrid Reactivation checkpoint (LIC-6.2-007)

The previous trust/core review is committed as 67f4e95. The new CHECK_IN target REACTIVATION first loads the exact protected REACTIVATE activation request, verifies its installation signature, and asks the core reactivationTarget method to verify the Authorization/Entitlement pair using the same checks as REACTIVATE. Only an immutable parent snapshot leaves that method; no intermediate model state, request consumption, generation increment or runtime authority is published. The original terminal state/hash remains the request-registration CAS basis. New-lineage Lease and Control revisions start at zero in this request. An existing Rebind override is retired for the directly bound new parent, consistently with core completion.

The hybrid/reactivation-response.ts facade accepts exactly a Lease plus Reactivation-Authorization response and a separately supplied bounded signed Entitlement. The frozen lease-response schema has no Entitlement field and is unchanged. The facade loads and independently verifies both exact archived requests, requires REACTIVATE and CHECK_IN respectively, and submits all three artifacts to one core REACTIVATE transition. The full proposal advances the model once and consumes both requests plus the one-time Authorization together. Final verification is repeated under the core's trust/time context, not inferred from earlier target preparation. The old terminal tombstones, independent tamper/recovery locks and historical consumed recovery facts remain intact. No receipt replay shortcut can reapply the Authorization.

One complete-state CAS adapter call must persist the proposal with the existing journal/flush/anchor obligations. Conflicts, pending/partial acknowledgements and lost acknowledgements grant no authority; lost outcomes require protected read-back reconciliation. Returned evidence remains durable=false and runtimeAuthority=NONE. The new facade deliberately rejects additional Control/trust sidecars, TIME_RECOVERY requests and an outstanding time incident. It does not implement network transport, secure file intake, persistent storage or runtime admission. Both-Edition tests pass48/48; EV0087 records all328 Hybrid cases plus prior Core/State/Time/Offline regressions and Golden validation passing. Targeted independent review of this new helper/facade, mixed variants and physical integration remain required before LIC007 closure. Prior independent reviews are not repeated.

## 7. Authoritative Secure State and anti-rollback

The current Prisma `License` model is a legacy, non-authoritative skeleton. It may later hold a redacted UI projection, or be deprecated, but it can never authorize operation.

Authoritative state is outside the database and Backup payload:

```text
%ProgramData%\EntryControlSystem\state\licensing\
```

It contains at least:

- for `OFFLINE_BOUND`, current/pending Entitlement hashes; for `HYBRID_LEASED`, the atomic current `activePair`, pending successor Entitlement and optional exactly bound `pendingPair` Lease, with exact parent linkage;
- highest entitlement generation, lease revision, activation-global control revision and activation-global Time-Correction revision;
- sealed current Control tuple, permanent terminal-lineage tombstones and consumed reactivation/recovery authorization IDs;
- highest successfully run build/version;
- maximum trusted Vendor UTC and clock high-water mark;
- state generation, previous-state hash and crash-safe journal;
- outstanding one-time activation/Lease request IDs, nonce hashes and complete request hashes needed for atomic response matching/consumption;
- current incident nonce, persistent tamper latch and any durable `transitionPending` Control/operation-reconciliation set;
- assurance level and installation public-key reference.

Storage requirements:

- Use a separate symmetric storage key, never the ECDSA installation key. Protect it with a dedicated TPM sealing/wrapping key or Guardian-SID DPAPI-NG after the platform spike proves the selected path.
- Encrypt and authenticate each sensitive record with AES-256-GCM, a fresh CSPRNG 96-bit nonce unique under that key and AAD containing protocol/type, state generation, previous hash and storage-location ID. Detect nonce reuse in the journal and rotate the storage key through a crash-safe transaction.
- Keep sealed, generation-linked anchors in independent ProgramData and Registry locations; disagreement is fail-closed.
- Write through staging, flush and atomic replace. Power loss must end at the complete old or complete new state, never half-authorized.
- Do not automatically select an arbitrary older copy. Recovery from an interrupted transaction is allowed only when generation and journal evidence prove it is the last complete state.
- Repair and normal uninstall preserve installation identity and Secure State. An OS/disk wipe creates a new identity and requires Vendor reissue/rebind.
- PostgreSQL dump/restore, database Restore maintenance and a copied customer Backup cannot change, extend or transfer this state.

Signed state alone does not prevent replay of an entire old snapshot. Phase 6.2 therefore includes a feasibility spike across the supported Windows matrix for a low-write TPM NV/monotonic anchor. Until that evidence exists, the product must state the exact offline snapshot limitation; no absolute anti-snapshot claim is allowed.

## 8. Time policy

All license decisions use UTC. Timezone and daylight-saving changes have no effect.

Effective time uses the maximum trustworthy evidence from:

- Windows UTC;
- last signed Vendor UTC;
- sealed clock high-water mark;
- monotonic elapsed time during the current boot.

Rules:

- Reboot, service restart, reinstall, sleep or hibernate never restart warning, grace or offline allowance.
- Product-approved availability clarification (`LIC-CHG-0016`): neither boot frequency nor shutdown duration alone constitutes a clock/security incident. Multiple boots each day and days or months powered off require no automatic License lock, reactivation or mandatory Internet contact solely for that reason. An otherwise valid `OFFLINE_BOUND` installation with consistent time evidence resumes normally. Genuine term/grace expiry still restricts operation; a Hybrid Lease also retains its existing signed offline deadline. Shutdown never pauses, restarts or extends any deadline.
- The 300-second same-boot discrepancy tolerance is not a maximum permitted shutdown duration. No hardcoded downtime threshold or per-reboot allowance is approved. Conflicting clock evidence remains recoverable restriction, never a tamper accusation based on downtime alone.
- The exact v1 clock-correction tolerance is `300` seconds. A larger backward discrepancy is not silently absorbed; classification follows the state/recovery rules below.
- A material backward jump enters `RECOVERY_REQUIRED` with reason `CLOCK_ROLLBACK`.
- A large forward jump does not erase the license permanently; it enters restricted Time Recovery so a signed online time or offline Time-Correction token can repair it.
- A Time-Correction token is device-bound, incident-bound, one-time, has the exact expected/new Secure-State generations and requires a strictly higher `timeCorrectionRevision`. Because the local wall clock is untrusted, acceptance requires the current incident nonce, `issuedAt` and `correctedUtc` not below the sealed pre-incident clock high-water mark, an issuer-bounded maximum lifetime, and monotonic elapsed-time proof when the incident remains in the same boot. It is not expired solely by the suspect wall clock.
- If reboot/lost monotonic evidence leaves token freshness unprovable, the installation remains restricted and requires a fresh incident request or online signed time. After acceptance, it immediately advances and seals the new trusted-time high-water mark.
- TPM clear resets trust in the hardware clock and requires rebind/recovery.

Online Time Recovery has one explicit fail-closed pre-validation path because the suspect local clock cannot first decide whether a fresh Lease is expired:

1. While restricted, create a new incident-bound `lease-request`, record its Vendor challenge/request hash and monotonic send time in Secure State, and require the response in the same boot within the exact v1 maximum recovery round trip of `300` seconds.
2. Without granting operation or trusting `serverTime` yet, perform strict canonical parsing, algorithm/signature and already-pinned delegation-key checks; exact request ID/hash/nonce, device, activation, parent Entitlement, build and state-generation binding; and monotonic Lease/Control revision checks. Trust/delegation/denylist updates are not accepted through this bootstrap path.
3. Require signed `serverTime` not below the sealed pre-incident clock high-water mark. Evaluate the already Root-verified delegation, parent Entitlement and Lease `[notBefore, notAfter)` windows against that signed `serverTime`, not the suspect Windows clock; all ordinary term/grace/offline and signer-purpose limits still apply.
4. Only after every check passes, atomically consume the request, seal `serverTime` and the new clock/state high-water values, then rerun the ordinary state machine. An actually expired, suspended or revoked License remains locked; failure at any step remains `RECOVERY_REQUIRED` and cannot partially advance authorization.

LIC005 verified portable checkpoint (`LIC-EV-0026`, not Windows/runtime evidence): `time.ts` consumes trusted adapter boot/monotonic snapshots and keeps the corroborated floor separate from operational calendar evidence. Floor epochs never originate from uncorroborated Windows UTC. Subsecond residuals survive frequent samples and boot changes; a new-boot incident anchors only its subsequently proven elapsed interval. Observations during an open incident do not churn request generation. Offline correction retains exact request/incident/revision checks and conservative freshness; online recovery retains the same-boot 300000ms bound and pinned-trust bootstrap. Verified signed repair/import evidence, receipts, counters and complete pair/Control changes are one pure proposal, not a committed transaction.

Remaining platform limits: Windows boot/sleep/TPM observations and request-send/receipt snapshots are trusted adapter inputs requiring real acquisition, protected persistence and validation in LIC008, Guardian and Store work. Consistent observed calendar time supports existing finite offline operation across arbitrary shutdown duration, but does not prove absolute UTC or perfect snapshot resistance. Future-only enabling may require fresh signed evidence under the approved policy. No existing poisoned state is migrated or reinterpreted; this unshipped model accepts only factory-provenance states. The actual UI, protected file/HTTPS workflows, runtime admission and Windows release gate are not implemented by LIC005.

### 8.1 LIC005 remediation design-review history (resolved by 8.4 and LIC-EV-0026)

Product Owner has approved the availability and repairability requirements in `LIC-CHG-0016`, including separation of observed Windows time from authoritative License time. That approval does not itself prove a safe replacement algorithm or close `LIC-OPEN-011`. Before changing the security-sensitive state transition, the detailed design requires the Security review specified in section 0.1.

The proposed implementation must distinguish two separately protected concepts:

1. **Observed operational time/evidence:** Windows UTC and boot/elapsed observations used to evaluate normal calendar expiry. Preserve observation provenance and rollback evidence across reboot; calling evidence provisional must not mean discarding it on restart. A still-consistent calendar after a long shutdown must count the elapsed days/months and must not require a fresh signed time solely because the shutdown was long.
2. **Corroborated correction floor:** a nondecreasing lower bound justified by accepted signed time and independently justified elapsed evidence. An uncorroborated forward wall-clock sample cannot irreversibly raise this floor. Signed repair may correct provisional observations but never lower this floor, reset term/Lease/grace deadlines, consume a correction twice, clear commercial/tamper/storage locks or erase rollback evidence.

This split is a design proposal, not permission to repurpose the frozen `preIncidentClockHighWater` wire claim. The final algorithm must define how the existing claim is populated from valid protected evidence without weakening its accepted monotonic semantics. It must also specify trusted initial activation, normal operation after reboot, ordinary signed check-in, offline correction and lost-boot freshness. Windows UTC alone does not prove absolute time; the existing TPM/no-TPM snapshot limitation remains explicit. No new grace, offline allowance, mandatory online reboot or arbitrary discrepancy threshold may be introduced as a shortcut.

Review must address every time consumer together, not only the comparison inside Time Correction:

| Consumer / interaction | Required review result |
| --- | --- |
| Projection and expiry | Real elapsed shutdown counts toward every finite deadline; a provisional clock must not become an unlimited offline extension mechanism |
| Future renewal and exact Hybrid pair promotion | A bad forward sample must not irreversibly discard a still-valid predecessor or grant future-only authority; repair must have a defined safe outcome without rolling back accepted generation/revision counters |
| Scheduled Control and terminal tombstones | Define interaction with provisional time while preserving signed Control, nondecreasing revisions and permanent terminal lineage facts; clock repair must not become an unsuspend/revoke bypass |
| Ordinary imports / reevaluation | No indirect path may copy an uncorroborated observation into the correction floor or bypass the same evidence rules |
| Signed repair / online bootstrap | Both modes must reevaluate the current exact pair atomically at corrected time, reject stale/wrong-boot/replayed responses and preserve independent locks |
| Persistence and restart | Both evidence tracks and outstanding request provenance belong in the same later protected generation-linked transaction; neither a reboot nor a service restart resets them |

The initial independent design review in `LIC-EV-0023` rejected the unresolved enabling-time policy. Product approval `LIC-CHG-0017`, the concrete contract in section 8.4, and independently reviewed implementation `LIC-EV-0026` supersede that blocking status. The historical findings below remain part of the review trail; they do not claim Windows/runtime implementation.

### 8.2 Acceptance scenarios for the approved availability requirement

The permanent portable review runner `scripts/test-license-time-review-v1.mjs` covers both Editions: 48 normal boots, three days off, one month off, six months off with a valid annual term, a weekly term expired after one month off, exact annual expiry after shutdown, same-boot forward-clock repair and cross-boot forward-clock repair. Boot count/duration are inputs to tests, not operational thresholds. These are model/fixture checks and do not establish Windows hardware behavior. Further interaction tests from section 8.1 and the existing Core/State/Time/Protocol/Golden regressions are required for remediation closure.

### 8.3 Independent design review outcome ? Product resolution recorded

The user explicitly authorized an independent agent review. Reviewer `time_design_review` read the complete master and relevant implementation/tests, independently reproduced `14/16` with exit `1` under Node `24.19.0`, and did not approve the draft for implementation. This is a completed design review with unresolved findings, not a passed security gate. Product subsequently resolved this tradeoff in `LIC-CHG-0017`; final portable-code approval is `LIC-EV-0026`.

High-priority findings:

- **Irreversible lifecycle effects:** `state.ts` uses the same time for `mature`, `promote` and final state sealing. A false forward sample can discard a predecessor or create a terminal tombstone; fixing the correction comparison alone cannot repair those effects or undo future-only access already granted.
- **Enabling-time ambiguity:** available offline evidence cannot always distinguish genuine shutdown from a falsely advanced calendar. Allowing future-only rights solely from that calendar risks early activation; requiring corroboration can delay a preissued future renewal or scheduled UNSUSPEND. This requires the narrow Product decision below, not a new rule locking normal reboots.
- **Evidence provenance:** a wall-derived epoch must never become a corroborated floor merely by adding monotonic elapsed time. All ordinary command inputs, initial activation, signed Lease handling and reevaluation paths must obey explicit provenance rules; persisting another field alone is insufficient.
- **Legacy state:** an already sealed poisoned high-water or terminal tombstone must not be silently lowered, reinterpreted or deleted. There is currently no shipped persistent model or rehydration seam. Any replacement must use newly constructed provenance-bearing states; a production migration is unsupported until separately designed and approved.

Reviewer recommendation, now Product-approved in `LIC-CHG-0017` (implementation and closure verification remain separate):

1. Keep already-effective current authority usable across ordinary reboots and arbitrary shutdown durations while the observed calendar is consistent and the existing finite term/Lease remains valid.
2. Do not enable a future-only renewal, added Feature set or scheduled UNSUSPEND from provisional calendar time alone. Retain the current valid exact pair while waiting for corroborated time. A qualifying freshly issued signed artifact or signed time may supply that evidence, including offline delivery.
3. A provisional crossing of scheduled restrictive Control may restrict operation provisionally, but must not alone create a permanent terminal tombstone. This provisional condition must be distinguished from an already effective commercial lock, which time correction never clears.
4. The possible additional proof requirement is at an uncorroborated future-enabling boundary, not at every reboot or after an arbitrary downtime threshold. If the old term has genuinely ended, it cannot remain operational merely because the future grant is awaiting proof.

Following Product approval in `LIC-CHG-0017`, the detailed implementation contract must separately define protected observation history and a nondecreasing corroborated floor, floor-based monotonic epochs with fractional preservation, frozen request-claim population for new states, atomic full-pair/control reevaluation and all ordinary-command time consumers. Required new negative tests include future Offline/Hybrid pairs, scheduled SUSPEND/UNSUSPEND/REVOKE, accumulated small forward drift, signed check-in, reboot/fraction retention and legacy/unproven-state rejection. Neither the recommendation nor this report changes production acceptance behavior.

### 8.4 Approved scoped remediation contract (`LIC-CHG-0017`)

Independent reviewer `time_design_review` conditionally approved scoped LIC005 implementation after the following concrete details are recorded. They are adopted here; no further Product policy is added. This is design approval, not code/test closure.

- Once clock-managed, store the operational observed calendar separately from `clockHighWater`, the corroborated floor. Ordinary caller `trustedNow` values cannot raise that floor, reset provenance or enable future transitions. The pre-clock LIC004 seam still accepts explicitly trusted adapter UTC; it is not permission to feed Windows wall time as trusted evidence. No legacy state rehydration/migration is implemented.
- Maintain independent observed-calendar and floor monotonic epochs. Compare same-boot wall discrepancies against the observed epoch; preserve fractions and evidence across observations. A new boot carries forward both histories but cannot add unknown shutdown duration to the floor. It may advance consistent observed calendar time by any duration without an incident merely for downtime.
- Ordinary token admission uses consistent observed time, while promotion and irreversible Control maturation require corroborated time and still check observed expiry. A current already-effective pair may operate within its observed finite window. Scheduled enabling Control requires the floor; provisionally crossed restrictive Control may restrict without a terminal tombstone. Signed time repair cannot clear already matured commercial/tamper/storage locks.
- The lapsed-renewal exception and no-shortening check also use corroborated time, after full verification of any candidate signed-time evidence and before receipts/promotion. Provisional calendar expiry alone cannot justify narrowing an existing grant.
- After all ordinary signature, request, lineage and claim checks succeed, an Entitlement's Vendor-signed `issuedAt` or a Lease's signed `serverTime` may corroborate the floor. Neither future `notBefore`/`termStartsAt` nor device-request timestamps qualify. Clock-managed imports that introduce a greater signed bound require an explicit trusted-adapter receipt observation; without one they cannot advance that bound. The receipt observation is verified within the same proposal, not a preceding generation-changing observation command.
- For repair, retain frozen checks against the sealed `preIncidentClockHighWater`, derive the existing independent floor at receipt, and set the result to the maximum of that derived floor and authenticated signed UTC. Do not add the full request RTT to signed time. If the prior floor still dominates, preserve its fractional epoch; otherwise anchor the newer signed bound at the receipt tick. Repair resets provisional observed time only and reevaluates the complete pair/control state atomically.
- Opening an incident in a missing/new boot establishes a floor-only epoch at the incident tick, carries any justified prior fractional residue and preserves the frozen incident floor. It must not invent Vendor time or shutdown elapsed. Same-boot incidents retain their existing floor epoch, so waiting for a signed response cannot discard proven elapsed time.
- Every rejection remains neutral; consumed-token replay remains rejected and duplicate acknowledgement read-only. Existing already-poisoned states, lower-floor migration and deletion of old tombstones are not supported. Both-Edition regression and final independent code review are required before LIC005 completion.

## 9. Effective state machine

The implementation may persist orthogonal facts, but it exposes exactly one effective state using this priority:

| Priority | State | Operational behavior |
| ---: | --- | --- |
| 1 | `TAMPER_LOCKED` | Restricted; incident-scoped signed Recovery required |
| 2 | `REVOKED_LOCKED` | Restricted and terminal for that License lineage; explicit reactivation authorization plus a new Entitlement/activation lineage is required |
| 3 | `SUSPENDED_LOCKED` | Restricted; only a newer signed `UNSUSPEND` control state may reopen it |
| 4 | `RECOVERY_REQUIRED` | Restricted; storage/key/clock/hardware repair required |
| 5 | `INCOMPATIBLE_LOCKED` | Restricted; Product/Edition/build is incompatible |
| 6 | `LEASE_EXPIRED_LOCKED` | Restricted; Hybrid `offlineUntil` ended while the parent Entitlement is still inside `graceUntil` |
| 7 | `EXPIRED_LOCKED` | Restricted; finite Entitlement `graceUntil` passed, including after an earlier Hybrid Lease expiry |
| 8 | `POST_EXPIRY_GRACE` | Operational only while also inside any required Hybrid Lease |
| 9 | `OFFLINE_GRACE` | Operational Hybrid lease inside `offlineUntil` with warning |
| 10 | `EXPIRING` | Operational with warning |
| 11 | `ACTIVE` | Fully operational within licensed Edition/Features |
| 12 | `UNLICENSED` | Initial activation/support surface only |

Key transitions:

- `ACTIVE → EXPIRING → POST_EXPIRY_GRACE → EXPIRED_LOCKED`.
- Hybrid connection loss: `ACTIVE → OFFLINE_GRACE → LEASE_EXPIRED_LOCKED` at signed `offlineUntil`.
- A newer signed suspend/revoke moves any lower-priority operational state to its locked state.
- `OFFLINE_BOUND` becomes Active with a valid promoted current Entitlement. `HYBRID_LEASED` becomes Active only with a valid atomically promoted `activePair`; neither half can activate it alone, and an old-parent Lease cannot authorize a new Entitlement. In both modes trusted time must be at or after `effectiveStart`, and the activation-global control state must also be neither Suspended nor Revoked.
- `SUSPENDED_LOCKED` is reversible only by a higher control revision. `REVOKED_LOCKED` is terminal for that License lineage; only the atomic `reactivation-authorization` plus new Entitlement contract in section 4.2 may create a replacement lineage.
- Corroborated authoritative rollback/replacement moves to `TAMPER_LOCKED`.
- Missing/ambiguous storage, disk/antivirus failure, key loss, TPM reset or suspicious time moves to `RECOVERY_REQUIRED` rather than accusing the customer of tamper.
- A one-time Recovery token can perform only its signed transition and consumes its nonce atomically.

## 10. Tamper, quarantine and recovery

Integrity failures are classified by evidence, not by an accusation about intent:

1. An invalid, old, wrong-device or wrong-purpose candidate import is rejected/quarantined without changing a valid installation or setting an incident latch.
2. A single signature/tag/hash mismatch, missing file, disk full, filesystem corruption, antivirus sharing/quarantine, interrupted atomic replace, TPM/BIOS service, dead CMOS battery, network outage or Vendor-server failure is fail-closed as `RECOVERY_REQUIRED` with a specific integrity/storage reason.
3. `TAMPER_LOCKED` requires corroboration from an independently protected anchor: for example a valid older generation below TPM/high-water evidence, a replaced device binding contradicted by sealed installation history, rollback/reorder of multiple sealed anchors/journal records, or repeated unauthorized replacement after a verified repair.
4. A program manifest/hash failure first becomes `RECOVERY_REQUIRED / PROGRAM_INTEGRITY_FAILURE`. The Guardian refuses the suspect Node binary and accepts only its signed elevated recovery CLI flow. Only corroborated rollback/replacement creates the persistent tamper latch.

Response policy:

- Never delete customer database, backups, attendance history or the only diagnostic evidence.
- Do not silently delete the suspect license artifact. Move a safe copy to an ACL-protected quarantine and record its hash/reason/generation. Set the persistent tamper latch only for the corroborated case above.
- Do not reveal full token, raw device fingerprint, private material or recovery token in logs/support packages.
- Only a device- and incident-bound Recovery token with a higher generation may clear confirmed tamper. Generic Recovery cannot undo `REVOKED_LOCKED`.
- Recovery token replay, expiry, wrong incident, wrong device, wrong Edition or widened Features is rejected.
- Hardware transfer rebinds a Backup-restored application to the new key; it never transfers the old private key. The old offline installation remains bounded by its last finite token until next contact/expiry.

If normal immutable program files fail integrity, the Guardian must not run the suspect Node application. Its separately signed minimal Recovery/Emergency-Backup helper protects data and supports Installer Repair. Ordinary license expiry still starts a verified restricted Node surface.

## 11. Runtime enforcement and allowed surface

### 11.1 Enforcement layers

- The signed `EntryControlSystem.License` Guardian runs under its own virtual Service SID and exclusively owns CNG/TPM access, Secure State, trust bundles, signed immutable-manifest validation and the official loopback listener.
- `EntryControlSystem.App` and its Node child run under a different Service SID with no direct Guardian-key/state access. The Guardian reverse-proxies the official loopback origin to the verified child over a private endpoint.
- Guardian capabilities are short-lived and bound to the authenticated named-pipe peer token, process handle/creation identity (not reusable PID alone), exact build-manifest hash, state generation, boot nonce and expiry; replay or use by another process/build/generation is rejected.
- Node independently verifies token claims and enforces startup, HTTP, jobs, WebSocket and physical-operation gates.
- A separately Authenticode-signed, manifest-pinned elevated recovery CLI can authorize a one-time IPC request without loading Node; the Guardian service itself executes the fixed-path Emergency `pg_dump`/verify under `NT SERVICE\EntryControlSystem.License`. The CLI has no database/backup ACL, and the Guardian command exposes no Restore, business or License-bypass operation and records to the external incident journal.
- The browser presents state and sends only allowlisted recovery calls; it is not trusted.
- An exception, unreadable state or disagreement between Host and Node defaults to restricted, never Active.

Restore maintenance and License admission use one serialized runtime coordinator with a blocker set. Independent pause/resume coordinators are forbidden because one could resume a consumer while the other blocker remains active.

### 11.2 Consumer policy

| Consumer | Operational/Grace | License locked | Restore maintenance |
| --- | --- | --- | --- |
| K40 polling and event processing | Run | Stop; do not advance cursor | Stop |
| Inbox jobs/auto-checkout | Run if Edition-enabled | Stop | Stop |
| Business WebSocket | Run if Edition-enabled and authenticated | Reject/terminate | Stop |
| Backup scheduler | Run | Continue for data protection | Stop |
| License verifier/outbound sync | Run | Continue | Continue only when DB-write-free |
| HTTP | Full licensed surface | Exact restricted allowlist | Existing maintenance policy |

Every side effect obtains a unique operation ID and generation-bound operational lease from the serialized coordinator and holds it through database outcome, K40 cursor advancement or physical command completion. Database mutations write that operation ID/generation into a transactional commit marker so an interrupted client outcome can be reconciled.

On a verified control/lock transition, the Guardian first durably seals the signed Control as `transitionPending`; this state survives a crash and admits no new operational leases. The coordinator asks in-flight work to cancel and waits at most 30 seconds. If quiescence fails, the Guardian revokes the capability and the App Host terminates the Node Job/process tree. Process death alone is never assumed to roll back PostgreSQL: runtime connections use a dedicated non-superuser App role and per-boot/generation application tag, while a separate least-privilege local transition credential may only inspect/cancel/terminate that role's sessions and read operation commit markers. PostgreSQL exposes those powers only through fixed `SECURITY DEFINER` functions/views with a pinned safe `search_path`, revoked `PUBLIC` access and exact checks for the App role plus current boot/generation tag; the transition role receives no direct blanket `pg_signal_backend`, table-write or business-read grant. The transition waits until those sessions leave `pg_stat_activity`, then reconciles every ambiguous operation ID as committed or not committed before sealing the new effective state/generation. If PostgreSQL is unavailable, the pending state remains fail-closed and reconciliation resumes before App operation on restart.

The Vendor action may be reported as delivered/transitioning after the pending Control is durable, but never as effective until quiescence and outcome reconciliation complete. This applies to every business mutation, manual attendance, payment/expense, Device command and Door actuation, not only HTTP entry. A database commit or physical command admitted before the barrier and completed before its effectiveness cannot be undone; its known result, or an explicit `INDETERMINATE_EXTERNAL_OUTCOME` when the device cannot prove completion, is recorded as a pre-transition operation before the remote action is reported effective.

### 11.3 Restricted allowlist

The route registry uses a first-class `LICENSE_RECOVERY` admission class, not an Optional Capability. Exact allowed operations are:

- coarse public product/License identity and liveness;
- setup status and the one-time local initial activation session;
- login, logout and current-session identity;
- safe License status, activation request, staged entitlement import, outbound refresh and signed recovery;
- a narrow authenticated Emergency Backup facade for effective `BACKUP_CREATE` holders in the approved Owner/Admin/Vendor roles: start, poll, verify and download/copy its result;
- redacted minimal support diagnostics and Vendor maintenance activation needed for recovery.

The full Backup router is not allowlisted: Backup import, Restore, schedule/storage mutation and unrelated support operations stay blocked. All business routes, reports/exports, manual attendance, K40 Push/iClock/raw ingestion, Device commands, enrollment, Door control and Settings mutation are rejected before body parsing and before database or physical side effects. The stable response is HTTP `423` with a safe reason code and state generation.

During `PROGRAM_INTEGRITY_FAILURE`, Node is unavailable. The elevated signed recovery CLI uses explicit typed confirmation and a one-use Guardian IPC challenge; the Guardian uses the existing approved Backup root to run only Emergency Backup/verify before repair. Windows elevation plus the challenge is the local authorization boundary for this exceptional path; the CLI never receives or prints database credentials.

Known disabled-Edition routes still return the existing generic `404` before License disclosure.

## 12. Authentication and Client contract

Unauthenticated public identity exposes only:

```text
operational, activationRequired, coarseState, stateGeneration
```

After authentication, Setup/Login/Me may additionally expose `state`, `mode`, `expiresAt`, `graceEndsAt`, `offlineUntil`, `warning`, safe `reasonCode` and `assurance`. Neither contract includes the raw Entitlement, signature, activation secret, request nonce, full fingerprint, machine key or recovery token.

First installation flow:

1. Installer starts a verified restricted service and creates the installation key.
2. An elevated Installer/Guardian command creates a random one-time activation secret with a short TTL. The loopback session requires exact `127.0.0.1` Host/Origin, same-origin Fetch Metadata, no CORS, a CSRF nonce and mutation-only POST; DNS-rebinding/foreign Origin/secret replay is rejected.
3. `OFFLINE_BOUND` import installs a valid finite Entitlement atomically. `HYBRID_LEASED` activation stages the Entitlement and obtains its exactly bound Lease, then promotes the two only as one valid `activePair`; an Entitlement-only response remains restricted.
4. Ordinary Owner setup unlocks only after the selected mode reaches an operational state at trusted time.

The session is permanently disabled after successful activation/Owner setup and can be reopened only by an elevated signed local workflow. Regenerating/exporting an activation request never rotates the installation key.

After setup:

- Owner/Admin may view safe status.
- An authenticated `GYM_OWNER` or active `VENDOR_OWNER` with effective `LICENSE_ACTIVATE` may import an already Vendor-signed, same-device renewal; `ADMIN` is view-only. Cryptographic policy remains authoritative.
- Rebind, tamper clear, Edition change and recovery require both a scoped Vendor-signed token and the protected Vendor workflow.
- Existing sessions are immediately reduced to the restricted permission set when state locks.

The Client uses a shared `RestrictedLicenseShell` outside both normal Edition layouts. It must not start business API requests, Sound calls or Inbox WebSocket reconnects while restricted.

## 13. Backup, Restore, Audit and data safety

- Emergency Backup is available in every license lock state: through the restricted Node facade for an authenticated effective `BACKUP_CREATE` Owner/Admin/Vendor, or through the elevated signed recovery CLI authorizing the Guardian service when program integrity prevents Node from running.
- A customer Backup includes customer database data but excludes Entitlement authority, installation private key, Secure State, runtime configuration and Recovery tokens.
- Database Restore cannot renew, transfer, clear or roll back a License.
- Restore remains Vendor-maintenance-only and cannot bypass the License gate.
- A tamper-evident external License journal records high-water revisions and incident events because a PostgreSQL Audit row alone can be rolled back by Restore.
- A redacted projection is also written to normal Audit Log for UI visibility in both Editions.

Required event families include activation requested/imported/verified, online renewed, warning/grace, expired, suspended/revoked, verification/storage failure, tamper detected, recovery applied and Emergency Backup result. Logs keep only safe IDs, key IDs, revisions, reason codes and hash prefixes.

The external journal and database projection follow one explicit failure contract:

- Every event has a random `licenseEventId`, state generation, previous external-event hash, event family, trusted-time evidence and an allowlisted redacted payload. Raw tokens, customer secrets, machine private material, full fingerprints and credentials are forbidden.
- The Guardian appends/flushes the external journal and sealed projection outbox as part of the authoritative state transaction before a License activation/renewal, control or state-transition response is reported complete. This is not a generic barrier for data-protection responses. If the durable write fails, an enabling action remains restricted; a restrictive condition remains fail-closed as `transitionPending` / `RECOVERY_REQUIRED` and is not reported remotely as fully effective until its evidence is durable.
- The PostgreSQL Audit projection is secondary and idempotent by `licenseEventId`. A database outage or projection failure never rolls back an already durable restrictive License fact and never widens operation; the sealed outbox retains the redacted event, exposes a safe health warning and retries with bounded backoff.
- After database Restore, reconciliation compares event IDs and reprojects only missing safe License events from the external journal/outbox. It cannot import License authority into PostgreSQL, change Secure State or reproduce a redacted/forbidden field.
- Projection success removes an outbox item only after database commit is known. Duplicate delivery, crash between journal/projection/ack, outbox corruption/full disk and external-journal disagreement are fail-closed and tested.
- External-journal, outbox or Audit-projection degradation must never block Emergency Backup start, completion, verification, download or copy in any License/storage/program-integrity lock. Emergency Backup cannot enable business operation or change License State. It carries a safe non-authoritative pending `licenseEventId`/reason marker in its verified Backup result manifest and attempts Windows Event Log as an independent best-effort channel; after journal repair, the Guardian backfills and idempotently projects the required Emergency Backup result event. Failure to write either auxiliary channel is reported safely but does not discard an otherwise verified Backup artifact.

## 14. Existing repository integration obligations

Implementation must address these current facts:

- Prisma `License` is non-authoritative and must be explicitly deprecated/projection-only before use.
- `LICENSE_VIEW` and `LICENSE_ACTIVATE` currently have incomplete Edition/Capability mapping and require a tested v1 policy.
- License admission must occur after known-route/Edition rejection but before raw/JSON/urlencoded parsing and raw device ingestion.
- License startup and transitions integrate with the existing Restore-maintenance lifecycle through one serialized coordinator.
- The current Inbox WebSocket needs Session and License admission on upgrade plus termination on lock.
- The current Backup router must be wrapped by a small Emergency Backup facade rather than globally exempted.
- The production listener must be proven bound to `127.0.0.1`, production CORS must be same-origin, the Client must not default to the development port, and ProgramData config/ACL loading must replace development `.env` behavior in the packaged artifact.
- The canonical version/build/manifest SHA-256 values from Phase 6.1 are exact claims in every activation and Lease request and in each resulting Lease. An Entitlement transitively binds its exact issuance request through `requestHash` and separately authorizes an inclusive `minimumProductVersion` / `maximumMajorVersion` SemVer range, so a legitimate patch need not require a commercial reissue. These values are not yet authentic: Authenticode and Guardian-backed manifest trust remain Phase 6.4 requirements.

The Vendor issuer/portal is a separate security boundary and must never be bundled into either customer Edition. A customer artifact may contain only request generation, verification, import, sync and recovery clients.

Phase 6.2 must assign an owner and deployment for that separate Vendor system and deliver: a transactionally monotonic customer/Entitlement/activation/Lease/control database; idempotent nonce/proof-of-possession APIs; operator portal/API with MFA and least-privilege roles; HSM/KMS and Offline-signing adapters; immutable operator/security audit; monitoring/rate limits; encrypted backup/DR; key ceremony/rotation; and compromise/revocation runbooks. Remote activation/deactivation is not complete until this boundary passes its own tests.

## 15. Mandatory acceptance gates

The Licensing Release Gate remains open through Phase 6.6. Phase 6.2 creates permanent protocol/core/Node/Client/Vendor-authority tests; Phase 6.4 adds real Guardian/App/Installer/repair evidence; Phase 6.5 adds production Store/ACL evidence; Phase 6.6 reruns the complete matrix on clean Windows and real K40. Passing 6.2 alone must never be described as complete production Licensing.

The cumulative matrix covers at least:

1. Crypto/parser: shared golden vectors and exact CDDL/media/header contracts including device-signed `lease-request`; one-bit payload/signature changes; `R/S` zero/out-of-range/high-S; fake/unknown/denied/wrong-purpose keys; SPKI-derived `kid` / `delegatedKeyId` mismatch/collision; algorithm confusion; duplicate/non-canonical/oversized input; cross-token use; delegation/denylist update and key rotation.
2. Claims: wrong product/Edition/device/build; finite exact daily/weekly/monthly/annual/custom boundaries; no operation before `effectiveStart`; future pending renewal without interruption; operational overlap/no-shortening and lapsed-expiry successor policy; reboot/power-loss promotion and pending-generation ordering; expired/grace behavior; no perpetual token.
3. Binding: TPM non-exportability, Software-CNG fallback on every applicable supported-Windows row, copy/clone, ordinary RAM/NIC/disk change, TPM clear, repair/upgrade/reinstall, hardware transfer and Edition mismatch.
4. Time: UTC boundary, timezone/DST, reboot/sleep, small/large backward and forward jumps, online pre-validation with signed server time bound to the exact outstanding Lease request while wall time is unusable, same-boot/round-trip and no-trust-update constraints, post-seal ordinary reevaluation, offline Time Correction, independent Time-Correction revision high-water, expected/new Secure-State generations, incident/monotonic freshness and replay.
5. Rollback: old token/state/lease, DB Backup/Restore, full snapshot with the documented TPM/no-TPM result, binary downgrade, signed-manifest edit and failed update/power-loss recovery.
6. Hybrid/control: exact signed method/path/body proof-of-possession, nonce/request replay, wrong/outstanding request ID/hash response rejection, atomic initial/renewal `activePair` / `pendingPair` promotion across reboot/power loss, terminal revoke versus reversible suspend, Offline Control signer separation, first-contact delivery, strictly increasing Lease revision plus lower/equal/higher Control-revision rules and durable Control state, `min(offlineUntil, lease.notAfter, graceUntil)` with no grace bypass, Entitlement-only/Lease-only/wrong-parent/new-parent-old-Lease rejection, overlong/widened/anomalous Lease, outage/backoff, malformed response, concurrent revision ordering and duplicate activation anomaly.
7. Secure State: ACL, AES-GCM nonce uniqueness/tag failure, journal truncation/reorder/delete/rollback/rotation/log-flood, read/copy neutrality, authoritative bit change, missing state, fake extra file, invalid candidate never latching, disk full, antivirus sharing, concurrent import, reparse/TOCTOU, mirrored-anchor mismatch and updater transaction.
8. Enforcement: restricted startup; Guardian/App identity and named-pipe peer-token/process-creation/build/generation/boot/expiry binding; Guardian crash/pipe loss fail-closed and clean re-handshake; zero K40 poll/cursor/door; zero business job/WebSocket/API/DB side effect; durable transition-pending admission stop, bounded cancellation, process-tree termination, dedicated App DB-session termination, `pg_stat_activity` drain and commit-marker reconciliation before effectiveness; transition credential denial against non-App sessions/business tables and `SECURITY DEFINER` search-path/role/tag abuse; fail-closed verifier exception; exact allowed Auth/License/Emergency Backup surface and identical state generation across Guardian/Node/Client.
9. Recovery: one-time device/incident binding, explicit Secure-State generation claims, replay/expiry/wrong-transition rejection, offline USB recovery, Edition/Feature non-widening, hardware rebind, power loss, old installation behavior, mismatch classification, terminal Revocation non-recovery and two-artifact reactivation with permanent old-lineage tombstone/replay rejection.
10. Issuer operations: no Vendor production signing private key in source/CI/customer artifact (test keys are visibly non-production and production never trusts them), real HSM scopes, operator MFA/RBAC/audit, monotonic issuance, configured high-risk approval, key rotation/denylist, backup/DR and compromise exercises.
11. FULL/ATTENDANCE regression: each Edition accepts only its exact Entitlement; all existing Edition, operations, Backup/Restore and real K40 gates remain intact.
12. Clean Windows: every positive and negative row in [WINDOWS_SUPPORT_MATRIX.md](../../operations/WINDOWS_SUPPORT_MATRIX.md) passes its TPM/Software-fallback, pre-mutation refusal, activation, renewal, reboot, offline, expiry, recovery, repair, upgrade and uninstall obligations on the required independent machines; one-shot LocalSystem Setup helper success/failure/orphan cleanup and non-SYSTEM/stale-plan refusal pass without credential/command-line/log disclosure; App/Guardian/Installer database-secret ACL isolation is proven; initial activation resists Host-header/Origin/CSRF/DNS-rebinding/session replay; binary-integrity failure leaves Node off while the Guardian Emergency Backup succeeds.
13. Forensic/Audit: every required event family reaches the hash-linked external journal and recursively redacted idempotent Audit projection; secret canaries never appear; external-write, DB-write and outbox-ack failures follow the contract above; duplicate/crash/restart/log-full/tamper cases reconcile; database Restore reprojects missing safe events without changing License State; corrupt/full journal/outbox plus locked or Node-integrity-failure state still permits Emergency Backup start/verify/download with zero unlock and later event backfill.

Test IDs should use stable families such as `LIC-CRYPTO`, `LIC-BIND`, `LIC-TIME`, `LIC-ROLLBACK`, `LIC-HYBRID`, `LIC-STATE`, `LIC-GATE`, `LIC-RECOVERY`, `LIC-ISSUER` and `LIC-AUDIT`.

## 16. Phase 6 execution order

The phase responsibilities and full completion gates remain:

1. `6.1` — canonical version/build identity and independent reproducible `FULL` / `ATTENDANCE` artifacts.
2. `6.2` — exact CDDL/protocol and golden vectors, Windows isolation/storage feasibility spike, Vendor authority/issuer boundary, portable verifier/state machine, Node/Client restricted workflows, Offline/Hybrid core and permanent non-packaged tests. This starts but does not close the Licensing Release Gate.
3. `6.3` — conditional chunk, customer-artifact issuer/private-key absence, bundle, branding and language scans; the secret/issuer scan is rerun after packaging and at 6.6.
4. `6.4` — separately identified signed Guardian and App .NET services, one-shot LocalSystem Setup helper and NSIS Installer, private proxy/named-pipe enforcement, purpose-scoped secret handoff, elevated recovery CLI with Guardian-executed Backup, integrity/repair/update/uninstall tests.
5. `6.5` — private PostgreSQL, ProgramData config/state paths, Guardian/App/Database Service-SID separation and production Secure Store/ACL tests.
6. `6.6` — complete Licensing Release Gate and the exact [Windows v1 support matrix](../../operations/WINDOWS_SUPPORT_MATRIX.md), including install/reboot/upgrade/offline/K40/Backup/License/repair/uninstall and unsupported-target pre-mutation refusal.

No final Installer or Pilot build may ship with only part of the License workflow enabled.

CHG0080/EV0149 adopts the [bounded native-entry policy](../plans/LICENSING_NATIVE_ENTRY_ADOPTION.md):
construction follows the exact reviewed v2 section4 slice order rather than
waiting for full phase closure. V2 sections2-6 (six conjunctive NE prerequisites,
contract nodes, expanded graph, row mappings and evidence invalidation) are
incorporated as binding scheduling rules at SHA256
88dc75f17f85f0a57e05d2a6a9648800637a1b1b3d0611a257c3a0e541fd1444.
Every full phase/item/FILE/STORE/Windows/release exit above remains required.
The approved scheduling rule itself proves no entry prerequisite complete.

## 17. Authoritative implementation and traceability checklist

This section is the live implementation status for Licensing. The Edition and Project checklists mirror it; they do not replace it. Owners must be named in the handoff/evidence record before an item changes to `[~]`.

### 17.1 Phase entry and exit gates

| Phase ID | Entry criteria | Exit criteria | Completion effect |
| --- | --- | --- | --- |
| `PHASE-6.1` | Accepted master design; no runtime Licensing code required | `LIC-6.1-001` through `LIC-6.1-004` are `[x]`; canonical version/build identity and independent reproducible Edition artifacts pass | Unlocks protocol/build-bound work; does not claim Licensing exists |
| `PHASE-6.2` | `PHASE-6.1` complete; owners assigned; due Open items identified | `LIC-6.2-001` through `LIC-6.2-013` are `[x]`; protocol/core/Vendor/Windows-spike/Audit-contract evidence passes | Starts permanent Licensing gate; does not permit production Installer/Pilot |
| `PHASE-6.3` | Build artifacts from 6.1 and customer-side License code from 6.2 exist | `LIC-6.3-001` through `LIC-6.3-003` are `[x]` | Proves current customer artifacts are isolated/clean; scans must run again later |
| `PHASE-6.4` | Accepted `NATIVE` (all NE-001..006), as defined by adopted v2 | `LIC-6.4-001` through `LIC-6.4-006` are `[x]` on real Windows service/Installer flows | Bounded construction entry, not phase completion; native entry currently NOT_READY |
| `PHASE-6.5` | Accepted `GUARDIAN_SLICE`, `APP_SLICE`, `SETUP_SLICE`, `ADAPTER_ENTRY`; each row additionally requires its adopted entry prerequisites | `LIC-6.5-001` through `LIC-6.5-005` are `[x]` with real ACL/Store/PostgreSQL/Audit-journal evidence | Bounded storage construction entry, not Release Done |
| `PHASE-6.6` | Every earlier item and every Open item that blocks 6.6 is closed | `LIC-6.6-001` through `LIC-6.6-006` are `[x]`; no release-critical failure or unapproved deviation remains | Closes Licensing Release Gate and permits Phase 7/Pilot review |

### 17.2 Requirement-to-test traceability map

| Requirement ID | Requirement | Normative clauses | Implementation items | Required test families |
| --- | --- | --- | --- | --- |
| `LIC-REQ-001` | Finite terms, warning/grace and no perpetual token | §1, §3, §4.2, §9 | `LIC-6.2-003`, `LIC-6.2-004` | `LIC-CRYPTO`, `LIC-TIME` |
| `LIC-REQ-002` | Complete Offline and outbound Hybrid activation/renewal | §3, §6 | `LIC-6.2-006`, `LIC-6.2-007`, `LIC-6.2-009` | `LIC-HYBRID`, `LIC-GATE` |
| `LIC-REQ-003` | Exact protocol, signer purposes and key separation | §4 | `LIC-6.2-001` through `LIC-6.2-003`, `LIC-6.3-002` | `LIC-CRYPTO`, `LIC-ISSUER` |
| `LIC-REQ-004` | Machine binding with TPM and lower-assurance fallback | §5 | `LIC-6.2-008`, `LIC-6.5-002` | `LIC-BIND`, `LIC-STATE` |
| `LIC-REQ-005` | External Secure State and rollback resistance | §7 | `LIC-6.2-004`, `LIC-6.2-008`, `LIC-6.5-002` | `LIC-STATE`, `LIC-ROLLBACK` |
| `LIC-REQ-006` | Trusted time, Online Time Recovery and offline Time Correction | §8 | `LIC-6.2-005`, `LIC-6.2-007` | `LIC-TIME`, `LIC-HYBRID` |
| `LIC-REQ-007` | Monotonic control, suspend/revoke/reactivation and tamper recovery | §4.2, §9, §10 | `LIC-6.2-004`, `LIC-6.2-006`, `LIC-6.2-007` | `LIC-HYBRID`, `LIC-RECOVERY`, `LIC-ROLLBACK` |
| `LIC-REQ-008` | Guardian/Backend enforcement and zero locked business/physical side effects | §11 | `LIC-6.2-009`, `LIC-6.4-001` through `LIC-6.4-004` | `LIC-GATE`, `LIC-STATE` |
| `LIC-REQ-009` | Restricted Auth/UI plus safe Emergency Backup and Restore isolation | §12, §13 | `LIC-6.2-010`, `LIC-6.4-005`, `LIC-6.5-004` | `LIC-GATE`, `LIC-RECOVERY` |
| `LIC-REQ-010` | Separate production Vendor authority, audit and key operations | §4.3, §4.4, §14 | `LIC-6.2-011`, `LIC-6.3-002` | `LIC-ISSUER`, `LIC-CRYPTO` |
| `LIC-REQ-011` | Supported-Windows x64 Installer, pre-mutation platform refusal, services, credentials and ACLs | §5, §7, §11, §16; `WINDOWS_SUPPORT_MATRIX.md` | `LIC-6.4-001` through `LIC-6.4-006`, `LIC-6.5-001` through `LIC-6.5-005`, `LIC-6.6-002` | `LIC-BIND`, `LIC-STATE`, `LIC-GATE` |
| `LIC-REQ-012` | FULL/ATTENDANCE isolation, no issuer secrets and cumulative Release Gate | §1, §14–§16 | `LIC-6.1-001` through `LIC-6.1-004`, `LIC-6.3-001` through `LIC-6.3-003`, `LIC-6.6-001` through `LIC-6.6-006` | `LIC-ISSUER`, `LIC-GATE`, existing Edition regression suites |
| `LIC-REQ-013` | Hash-linked external License journal, sealed retry outbox and recursively redacted idempotent Audit projection survive failure/Restore without changing authority | §7, §13, §15 | `LIC-6.2-012`, `LIC-6.5-005`, `LIC-6.6-001` | `LIC-AUDIT`, `LIC-STATE`, `LIC-RECOVERY` |

### 17.3 Governance state

| ID | Deliverable | Owner role | Status | Evidence |
| --- | --- | --- | --- | --- |
| `LIC-GOV-001` | Consolidate all accepted License decisions, checklist, Open register and logs in this canonical file | Lead Repository Maintainer | `[x]` | `LIC-EV-0001`, `LIC-EV-0002`, `LIC-EV-0003`; canonical master committed as `4069bba` |
| `LIC-GOV-002` | Commit the canonical master before any runtime License implementation, then use one governance-only follow-up commit to record that immutable hash and close `LIC-GOV-001` / `LIC-GOV-002` | Lead Repository Maintainer | `[x]` | Immutable master commit `4069bba`; this governance-only bookkeeping commit records and closes the bootstrap |
| `LIC-GOV-003` | Assign a named owner/reviewer when an implementation item first becomes active | Product Owner | `[x]` | Phase 6.1 implementation owner: Codex; acceptance reviewer: Project Owner; independent code/test review required before closure |

### 17.4 `PHASE-6.1` — canonical version and independent builds

| ID | Deliverable | Dependencies | Owner role | Planned implementation/evidence | Status | Exit evidence |
| --- | --- | --- | --- | --- | --- | --- |
| `LIC-6.1-001` | Create root `version.json` as the canonical Product/API/protocol/build identity schema | `LIC-GOV-002` | Build Owner | `version.json`, schema/parser and unit tests | `[x]` | `LIC-EV-0004`, `LIC-EV-0005` |
| `LIC-6.1-002` | Make Server, Client and build/test scripts consume the same identity and reject mismatch/hardcoded fallback; require the future Installer to consume the artifact identity in Phase 6.4 | `LIC-6.1-001` | Build Owner | Server/Client build config, artifact contract and mismatch tests; no Installer exists in 6.1 | `[x]` | `LIC-EV-0004`, `LIC-EV-0005` |
| `LIC-6.1-003` | Produce independent reproducible `build:full` / `build:attendance` outputs with Edition/version manifest and file hashes | `LIC-6.1-001`, `LIC-6.1-002` | Build Owner | Root build scripts and artifact manifests | `[x]` | `LIC-EV-0004`, `LIC-EV-0005` |
| `LIC-6.1-004` | Prove Node `24.19.0` compatibility and rerun the current FULL/ATTENDANCE regression/artifact-isolation gates | `LIC-6.1-003` | QA Owner | Existing Server/Client/Edition runners | `[x]` | `LIC-EV-0005` |

#### Frozen Phase 6.1 identity and artifact contract

The root `version.json` is strict JSON with exactly this v1 identity: `schemaVersion=1`, `productId=ENTRY_CONTROL_SYSTEM`, `productVersion=1.0.0`, `apiVersion=v1`, `licenseProtocolVersion=1`, `buildManifestVersion=1`, ordered `supportedEditions=["FULL","ATTENDANCE"]` and `nodeVersion=24.19.0`. Its identity digest is `4c90f292580715e8db609f830eeafa2b19dea95a90a70f684761672bd069d893`, calculated over canonical key-sorted JSON rather than the formatted file bytes. Phase 6.1 reserved the protocol-version namespace; `LIC-6.2-001` froze its schema/registry package and `LIC-6.2-002` froze the non-production cross-runtime Golden Vectors. The portable production parser/verifier is verified under `LIC-6.2-003`; runtime admission remains a later checklist item.

Each build identity adds one exact Edition. Each artifact manifest closes over every emitted file except the manifest and its sidecar, recording canonical relative path, byte size and SHA-256. Production Client builds require the root-selected `ECS_BUILD_EDITION`; packaged Server admission requires an explicit matching `APP_EDITION`, exact Node version and matching build identity. For a repository-contained output, replacement is limited to the exact `release/<requested Edition>` directory; the other Edition, descendants of either artifact, repository source paths, custom existing paths and linked/junction ancestors fail closed. Custom outputs are allowed only outside the repository and only when the target does not already exist.

The reproducibility result means byte-identical manifests from fresh empty output directories using the same source, lockfiles and already-installed dependency tree under pinned Node `24.19.0`; it is not clean-checkout or independent dependency-install/supply-chain evidence. The build launcher rejects output-affecting parent `NODE_*` controls and gives child processes a narrow environment with compile cache disabled, but JavaScript cannot undo instrumentation already consumed at Node startup; official build/CI launchers must therefore begin with a clean Node-control environment. Phase 6.1 artifacts are unsigned development artifacts: the manifest/sidecar detect accidental or independently checked modification but are jointly replaceable and do not prove publisher authenticity or resist an Administrator or concurrent post-verification tamper. Authenticode/Guardian/runtime manifest trust remains Phase 6.4. The two Editions are independently labeled and client route/brand-selected here; physical removal of excluded Server modules and the exact customer-artifact/issuer-secret scan remain `LIC-6.3-001` through `LIC-6.3-003`.

### 17.5 `PHASE-6.2` — protocol, core, Vendor and restricted workflows

Dated LIC008 correction - November11 Kabul: the [V2 stage-store service nonce](../plans/LICENSING_LIC008_STANDARD_NATIVE_LOADER_PROFILE.md)
now requires 64 lowercase-hex characters, matching the plan grammar and
native loader; 32 refuses. Fresh independently audited closed builds pass
144/125/1,020/700 pure checks and 19 refused entries per variant;
[five corrected originals](../evidence/standard-native-package-binding-v2-nonce64-20261111/README.md)
are retained. Earlier 1,011-check outputs remain historical. Owner/User
pre-CLR run/nonce sourcing, protected custody and physical W03 remain open;
LIC008/Open003 and Security/production acceptance are unchanged.

Dated LIC008 update - November11 Kabul: the [closed V2 candidate package
binder](../plans/LICENSING_LIC008_STANDARD_NATIVE_LOADER_PROFILE.md) validates
six original streams, seven fixed source anchors, four injected asset byte
streams and 189 runtime leaves against canonical source-set/manifest/plan/
approval hashes. Three warning-as-error .NET builds each passed
144/125/1,011/700 pure checks and refused 19 operational entries;
[five byte-exact originals](../evidence/standard-native-package-binding-v2-20261111/README.md)
are retained. This unsigned in-memory candidate cannot admit a physical kit
or prove protected custody, Owner intent, source-to-binary equivalence or
loaded-code identity. W03, LIC008/Open003 and Security/production acceptance
remain open.

Dated LIC008 update - November11 Kabul: [closed native loader and V2 control
model](../plans/LICENSING_LIC008_STANDARD_NATIVE_LOADER_PROFILE.md) have
independently audited source/artifact builds. The loader's three native
variants passed 385/385/405 injected checks and 19 closed entries each;
[eight byte-exact originals](../evidence/standard-native-loader-v1-20261111/README.md)
and a full 19,520-file Zig rehash were reviewed. The canonical profile, new
plan/approval input codec and 68-slot stage-store model passed 144/125/1,011
pure checks in each of three .NET variants, plus 19 closed entries each;
[five exact originals](../evidence/standard-native-control-v2-20261111/README.md)
and the seven-source/375-installed-pin (374 unique paths) artifact review
passed. These are
closed component tests. No actual protected store, Owner/worker association,
SCM, hostfxr/CLR, account logon or persisted CNG operation ran. Physical W03,
LIC008/Open003 and Security/production acceptance remain open.

Dated LIC008 update - November11 Kabul: [closed native W03 startup foundation](../plans/LICENSING_LIC008_STANDARD_NATIVE_HOST.md)
has a six-input, three-variant build: 2,455 pure assertions and 15 closed
entries per variant. [Eight exact originals](../evidence/standard-native-host-foundation-v1-20261103/README.md)
pin native PE hashes/imports; independent artifact audit PASS (139,363
read-only checks). No actual
Win32 environment call, SCM dispatch, CLR load, account logon or persisted-key
probe ran. The complete new runtime/admission/controller chain remains before
physical W03. LIC008/Open003 and Security/production acceptance remain open.

Dated LIC008 update - November4 Kabul: [closed W03 transfer/journal components](../plans/LICENSING_LIC008_STANDARD_TRANSFER_JOURNALS.md)
pass22,987 synthetic/injected assertions and41 closed entries per variant;
independent source/artifact review PASS. No actual transfer/account/logon/SCM/
persisted-key operation ran. Native adapters, V2 admission/consumption, service
hosting, startup/runtime provenance and full controller remain before physical
W03. The [execution ledger](../plans/LICENSING_LIC008_COMPLETION_PLAN.md) owns
remaining work; LIC008/Open003 and acceptance remain open.

Dated LIC008 update - 2026-11-02: the [fresh V5 chain](../plans/LICENSING_EXPORT_POLICY_V5_PLACEMENT.md)
passes independent source/build/kit review and18,480 control checks. Fresh
CheckOnly/Prepare and input/launcher review PASS; after owner CONFIRM,
[V5 completed](../evidence/export-policy-control-v5-run-20261102/README.md)
with admitted process/report proof and restored Guardian. GenericPrivate/PKCS8
show differentials; opaque positive control/aggregate remain inconclusive.
[Nineteen retained originals](../evidence/wrapping-retained-originals-20261028/README.md)
are now archived and independently reconciled; historical V2 role-ID and
managed-assembly/source binding gaps remain. Only this laptop/current admin
account was available initially. [Disabled-account preparation completed](../evidence/standard-account-preparation-v1-run-20261102/README.md),
owned SID ends1023, Local/Users-only; activation/logon and crypto remain NOT_RUN.
[W03 crypto design](../plans/LICENSING_LIC008_STANDARD_USER_CONTROL.md) is reviewed,
but the crypto runner is unimplemented. The current
[execution ledger](../plans/LICENSING_LIC008_COMPLETION_PLAN.md) supersedes older
next-action/custody summaries; LIC008/Open003 and all acceptance exits stay open.

Dated LIC008 update — 2026-10-28: the [current execution ledger](../plans/LICENSING_LIC008_COMPLETION_PLAN.md)
and [consumed V4 diagnostic](../evidence/export-policy-control-v4-run-20261028/README.md)
supersede older next-action/custody summaries. V4 records Setup completion but
refuses missing independent process observation before report read/Guardian borrow.
The [source-only initial-status correction](../plans/LICENSING_EXPORT_POLICY_PROCESS_OBSERVATION_FIX.md)
passes18,316 inert checks and independent review. Only the current laptop is
available; full LIC008/Open003 remains `[~]`/open. The historical row evidence below
is retained; completed V4/V5 wrapping metadata reconciliation and remaining limits
are distinguished in the [custody reassessment](../evidence/LIC008_RETAINED_EVIDENCE_GAPS_20261028.md).

| ID | Deliverable | Dependencies | Owner role | Planned implementation/evidence | Status | Exit evidence |
| --- | --- | --- | --- | --- | --- | --- |
| `LIC-6.2-001` | Freeze exact v1 CDDL/media/header schemas for every request/token type in §4 | `PHASE-6.1` | Protocol Owner | `licensing/protocol/v1` | `[x]` | `LIC-EV-0006` start, blocked candidate `LIC-EV-0007`, and accepted remediation `LIC-EV-0008`: 10 signed + 3 carrier CDDL schemas, strict registry, 224 malformed descriptors (744 type expansions after the approved descriptor-only erratum `LIC-CHG-0011` / `LIC-EV-0012`), complete 90-pair cross-type corpus and closed 18-file manifest `512534732dce759da424ba0e8d8838c3d9c294e3faa02a4017212ce482523eab` |
| `LIC-6.2-002` | Create identical positive/negative golden vectors for Vendor issuer, .NET verifier and Node verifier | `LIC-6.2-001` | Protocol Owner | Versioned non-production vectors under `licensing/` | `[x]` | `LIC-EV-0009` start, `LIC-EV-0010` original closure and `LIC-EV-0013` erratum repin: 35 signed + 6 carrier positives, 42 binary negatives, 90 executed cross-type rejects, 173 byte-identical verdicts and closed 129-file manifest `565a5efca1a1767a622a0d751a5937633018587f7cc463ce3e531ed9656fb99e` |
| `LIC-6.2-003` | Implement strict parser, ES256/COSE verification, delegation/denylist and claim validation | `LIC-6.2-001`, `LIC-6.2-002` | Security Owner | Portable License core plus `LIC-CRYPTO` tests | `[x]` | `LIC-EV-0011` start, failed checkpoint/erratum `LIC-EV-0012`, passing closure `LIC-EV-0013`: 676/676 owned descriptors, 41/41 positives, 42/42 binary negatives, 90/90 cross-types, 12/12 PoP and 66/66 carrier/context/Rebind regressions; independent Protocol/Security reviews |
| `LIC-6.2-004` | Implement pure state machine for terms, pairs, revisions, control, rollback, tamper and reactivation tombstones | `LIC-6.2-003` | License Core Owner | Portable state-machine core | `[x]` | `LIC-EV-0014` start, `LIC-EV-0015` initial tests, `LIC-EV-0016` reviewed closure: 59 projection + 31 model + 27 security cases, all 18 owned STATE descriptors, Core/Protocol/Golden regression |
| `LIC-6.2-005` | Implement trusted-time model, Online Time Recovery and Time-Correction revision rules | `LIC-6.2-003`, `LIC-6.2-004` | Security Owner | Portable time policy/adapters | `[x]` | `LIC-EV-0026`: 39/39 Time, 36/36 lifecycle, 16/16 availability/repair, State 117/117, Core/Protocol/Golden; independent code review/rerun by `time_design_review`; 44-file compiled digest recorded; earlier failures retained in EV0020-0025 |
| `LIC-6.2-006` | Implement Offline request/import/pending renewal/lapsed renewal/control/recovery/reactivation workflows | `LIC-6.2-003` through `LIC-6.2-005` | License Core Owner | Server License module and safe file workflows | `[~]` | `LIC-EV-0054`: import38/request44/Entitlement completion36/Control36/Recovery36/Rebind40/TimeCorrection32/Reactivation28/files32 plus96 six-intent file completion cases and Core/State/Time/Protocol/Golden pass; earlier checkpoints preserved. EV0047 records the remaining-obligations source audit and ten planned (not executed) adapter acceptance cases. Independent portable review at c97eb29 is complete under LIC-EV-0055 (8/8 probes, no reproducible blocking finding); real file/storage workflows, lost-ack durable reconciliation and final integration/closure review remain open; complete Hybrid reactivation remains LIC007 |
| `LIC-6.2-007` | Implement Hybrid nonce/PoP/check-in, exact pair promotion, Lease/control delivery and outage behavior | `LIC-6.2-003` through `LIC-6.2-005` | License Core Owner | Server sync client and Vendor API contract doubles | `[~]` | LIC-EV-0061 starts portable nonce/PoP request preparation and conditional registration only; LIC-EV-0063 records52/52 both-Edition cases and passing prior regressions. Implementer Codex; acceptance reviewer Project Owner. Request checkpoint committed10d09f7; primary-Lease response checkpoint committed14ddebf (EV0066:48/48 response cases plus request52/52 and regressions). Control-only dispatch committedbc7aecb (EV0068:44/44). Lease+Control composition committede88d0ca; EV0071 passes48/48 combined cases and regressions. EV0074 completes limited independent portable review,28/28 probes, committedec2fbf3. EV0075 starts subsequent trust-only preparation/CAS handoff; EV0077 passes44/44 trust cases and all aggregate/Golden regressions. Trust-only checkpoint committed6f7b411; EV0078/0079/0080 add coordinated trust plus Lease/optional Control handoff,44/44 new cases and passing aggregate/Golden regressions. Independent trust/core review of committed53a7d74 passes28/28 (26 acceptance checks plus2 clock diagnostics); see LICENSING_HYBRID_TRUST_REVIEW.md. Hybrid Reactivation request targeting and three-artifact completion pass48/48 both-Edition cases and all aggregate/Golden regressions under EV0087; targeted review of committed2a6fb87 reports no reproducible blocking portable defect, see LICENSING_HYBRID_REACTIVATION_REVIEW.md. The separate Entitlement preserves the frozen carrier. Mixed trust/Control and TIME_RECOVERY remain closed; failed-evaluation admission gating, transport/runtime/protected Store integration and LIC007 closure remain open. |
| `LIC-6.2-008` | Complete real Windows TPM/CNG/DPAPI-NG/Service-SID/repair/TPM-NV feasibility spike, choose supported adapters and close `LIC-OPEN-003` | `LIC-6.2-003` | Windows Security Owner | Isolated Windows spike; preflight plus test-only service/key harness; no production secret | `[~]` | Historical EV0091-0098 failures/corrections retained; EV0117 rejects tested standalone DPAPI-NG options. CHG0057 selects the separate Software-KSP wrapping-key direction, not production acceptance. EV0126 V2 host feasibility, EV0130 V3 filtered-admin interactive contrast, EV0132 V4 normal reboot and EV0135 V5 binary Repair simulation pass on current Windows11 x64 build22000; owned keys cleaned up and services Stopped/Manual. Original protected V4/V5 evidence hashes remain independently uncaptured. CHG0068/EV0137 prepared V6 kit; CHG0069/EV0138 records physical OLD0.13.0 to NEW0.13.1 Upgrade simulation PASS: same keys/envelope bytes and OLD files preserved, no recreation, Guardian/App/child and owned cleanup PASS. V6 independently Stopped/Manual on bin-new; EV0139 operator read-only hash capture matches checkpoint and all11 files, original-summary hash captured, not independent Security acceptance. EV0140 selected retained-data Uninstall/Reinstall; EV0141 prepares V7 kit0.14.0 with pure17/17 and real helper/inert lifecycle guards PASS. EV0142 records physical Prepare/Uninstall/Reinstall transcript PASS; six Guardian controls, App/actual-child contrast, artifact0.14.0 and owned-key cleanup PASS. Three V7 services independently Stopped/Manual, PID0. EV0143 reviews supplied summary and captures operator hashes: original summary cc8d7464fedb6b20b9adeae2d0e34f1aff483b3f481b975a74a1632ef9ffb586, both checkpoints and all11 files match. Continuity flags reported PASS; no independent Security attestation. V7 consumed; never rerun any stage. V6 consumed; never rerun either stage. Physical interruption/invalid-state tests remain NOT_RUN. Actual signed Installer lifecycle, separate standard account, TPM/NV, supported-Windows matrix and independent Security acceptance remain open; LIC-OPEN-003 is not closed. See wrapping design and LICENSING_WRAPPING_UPGRADE_PLAN.md. |
| `LIC-6.2-009` | Implement Node startup/HTTP/job/WebSocket/K40/physical admission, serialized coordinator and operation leases | `LIC-6.2-004` | Backend Owner | Server admission/coordinator integration | `[ ]` | `LIC-GATE` zero-side-effect and transition-race tests; reproduce the trust-review clock-boundary diagnostic and prove failed observation/trust checks cannot fall back to admission from historical state |
| `LIC-6.2-010` | Implement Auth status contract, permissions, restricted Client shell and narrow Emergency Backup facade contract | `LIC-6.2-004`, `LIC-6.2-009` | Backend/Client Owner | Server Auth/License routes and Client shell | `[ ]` | Permission/privacy/direct-URL/browser tests |
| `LIC-6.2-011` | Assign and implement the separate Vendor authority boundary, resolve `LIC-OPEN-001`, `LIC-OPEN-002` and `LIC-OPEN-006`, and deliver HSM/KMS adapters, MFA/RBAC, monotonic issuance, audit and DR plan | `PHASE-6.1`, `LIC-GOV-003` | Vendor Security Owner | Separate Vendor system/repository; evidence link only in customer repo | `[ ]` | `LIC-ISSUER` tests, accepted Open-item resolutions and operational runbook exercise |
| `LIC-6.2-012` | Implement the complete License event taxonomy, recursive redaction, external-journal/sealed-outbox contract and idempotent Audit projection with failure/Restore doubles | `LIC-6.2-004`, `LIC-6.2-009`, `LIC-6.2-010` | Backend/Audit Owner | Guardian event contract plus Server Audit projection | `[ ]` | `LIC-AUDIT` completeness/secret-canary/dual-write/retry/Restore tests plus degraded-journal Emergency Backup non-blocking proof |
| `LIC-6.2-013` | Add permanent aggregate non-packaged Licensing gate covering all 6.2 components and existing Edition regressions | `LIC-6.2-001` through `LIC-6.2-012` | QA Owner | Root/server/client aggregate test script | `[ ]` | Repeatable aggregate PASS; no production-complete claim |

### 17.6 `PHASE-6.3` — artifact isolation and secret absence

| ID | Deliverable | Dependencies | Owner role | Planned implementation/evidence | Status | Exit evidence |
| --- | --- | --- | --- | --- | --- | --- |
| `LIC-6.3-001` | Scan FULL/ATTENDANCE Client chunks/routes/features and Server artifact module/file inventories, and prove exact physical Edition isolation | `PHASE-6.1`, current 6.2 artifact | Build Owner | Client build-boundary scanner plus Server artifact inventory/allowlist scanner | `[ ]` | Both artifacts pass marker/route/chunk and Server module/file matrices |
| `LIC-6.3-002` | Prove no Vendor issuer, production private key, shared HMAC, Recovery signer or portal code enters customer source/CI/artifact | `LIC-6.2-011` | Security/Build Owner | Source, dependency, symbol, archive and entropy/secret scans | `[ ]` | Negative scan report with approved public-key inventory |
| `LIC-6.3-003` | Verify Entry Control branding, English/Dari/Pashto copy and License UI/export names in both Editions | `LIC-6.3-001` | Client/QA Owner | Existing brand/language/browser scanners | `[ ]` | Three-language visual/DOM/artifact evidence |

### 17.7 `PHASE-6.4` — native services and Installer

Dependencies below are implementation-entry prerequisites defined by adopted v2,
not predecessor full-item closures. A slice must have scoped accepted evidence
before dependent work starts. Full exit obligations remain in Exit evidence.

| ID | Deliverable | Implementation-entry dependencies | Owner role | Planned implementation/evidence | Status | Exit evidence |
| --- | --- | --- | --- | --- | --- | --- |
| `LIC-6.4-001` | Build signed `EntryControlSystem.License` Guardian owning identity, State, manifest checks and official proxy | `NATIVE` | Windows Host Owner | .NET Guardian service | `[ ]` | Service identity/crash/restart/integrity tests |
| `LIC-6.4-002` | Build signed `EntryControlSystem.App` Host and authenticated capability-bound Guardian/App IPC | `GUARDIAN_SLICE`, `C_IPC` | Windows Host Owner | .NET App Host, named pipe and private Node endpoint | `[ ]` | Peer-token/process/build/generation/boot/expiry attack matrix |
| `LIC-6.4-003` | Build one-shot `EntryControlSystem.Setup` LocalSystem helper and offline NSIS FULL/ATTENDANCE Installers | `GUARDIAN_SLICE`, `APP_SLICE`, `C_IPC` | Installer Owner | .NET Setup helper and NSIS scripts | `[ ]` | Non-SYSTEM/stale/arbitrary-plan refusal, TTL/orphan/secret tests |
| `LIC-6.4-004` | Enforce durable `transitionPending`, process-tree stop, App DB-session drain and commit-marker reconciliation | `GUARDIAN_SLICE`, `APP_SLICE`, `DB_SLICE`, `STORE_SLICE`, `GATE_SLICE` | Host/Backend Owner | Guardian/App/Server/PostgreSQL transition contract | `[ ]` | Hung/commit-race/device-indeterminate effectiveness tests |
| `LIC-6.4-005` | Build signed recovery CLI and Guardian-executed fixed Emergency Backup/verify operation | `GUARDIAN_SLICE`, `SETUP_SLICE`, `DB_SLICE`, `ACL_SLICE`, `C_RECOVERY` | Recovery Owner | Minimal CLI/Guardian IPC | `[ ]` | Node-integrity-failure real Backup even with journal/outbox unavailable; no Restore/business/unlock/bypass |
| `LIC-6.4-006` | Prove Install/Upgrade/Repair/restart/failure/uninstall preservation and no partial version set | `SETUP_SLICE`, `RECOVERY_SLICE`, `TRANSITION_SLICE`, `ACL_SLICE` | Installer/QA Owner | Disposable Windows VMs | `[ ]` |Repeatable lifecycle matrix and signed artifact hashes; full LIC-6.4-001 through LIC-6.4-005 closures remain required |

### 17.8 `PHASE-6.5` — production storage, PostgreSQL and ACLs

Dependencies below are implementation-entry prerequisites defined by adopted v2.
LIC008/Open003 full acceptance, FILE/STORE matrices, actual ACL/Backup/Audit and
all cumulative exits remain required; ADAPTER_ENTRY does not close them.

| ID | Deliverable | Implementation-entry dependencies | Owner role | Planned implementation/evidence | Status | Exit evidence |
| --- | --- | --- | --- | --- | --- | --- |
| `LIC-6.5-001` | Install private PostgreSQL and exact App/Guardian-transition/Guardian-backup/Installer roles and secret files | `GUARDIAN_SLICE`, `APP_SLICE`, `SETUP_SLICE` | Database/Installer Owner | Setup helper, PostgreSQL config and secret ACLs | `[ ]` | Cross-role denial, SCRAM, migration and Backup tests |
| `LIC-6.5-002` | Implement production Secure Store, Secure-State transaction journal, anchors, TPM/DPAPI wrapping and crash-safe atomic state transactions | `GUARDIAN_SLICE`, `APP_SLICE`, `ADAPTER_ENTRY`, `C_TXN`, `C_AUDIT` | Windows Security Owner | Guardian Store adapters | `[ ]` |`LIC-STATE` ACL/nonce/tag/power-loss/rollback matrix; full LIC008/Open003 acceptance retained |
| `LIC-6.5-003` | Apply exact ProgramFiles/ProgramData/Registry/CNG/Service-SID ACLs with no App access to Guardian State/secrets | `DB_SLICE`, `STORE_SLICE`, `SETUP_SLICE` | Windows Security Owner | Installer ACL plan | `[ ]` | Clean-machine positive/negative access evidence |
| `LIC-6.5-004` | Prove normal/Emergency Backup and Restore exclude and cannot alter/transfer/renew License State | `RECOVERY_SLICE`, `DB_SLICE`, `STORE_SLICE`, `ACL_SLICE` | Recovery/QA Owner | Real dump/restore isolation runners | `[ ]` | Full Backup/Restore/old-snapshot/rebind matrix |
| `LIC-6.5-005` | Deploy the production hash-linked external License journal, sealed projection outbox and redacted Audit projection with post-Restore reconciliation | `STORE_SLICE`, `AUTH_SLICE`, `BACKUP_SLICE`, `C_AUDIT` | Windows Security/Backend Audit Owner | Guardian journal/outbox and Server Audit sink | `[ ]` |Real `LIC-AUDIT` crash/full-disk/DB-outage/duplicate/redaction/Restore and Emergency-Backup-backfill matrix; full LIC012 contract retained |

### 17.9 `PHASE-6.6` — cumulative production Release Gate

| ID | Deliverable | Dependencies | Owner role | Planned implementation/evidence | Status | Exit evidence |
| --- | --- | --- | --- | --- | --- | --- |
| `LIC-6.6-001` | Rerun every §15 crypto/binding/time/rollback/hybrid/state/gate/recovery/issuer/audit test | `PHASE-6.1` through `PHASE-6.5` | QA/Security Owner | Cumulative release runner | `[ ]` | One indexed PASS report with zero skipped release tests |
| `LIC-6.6-002` | Pass every positive and negative row of `WINDOWS_SUPPORT_MATRIX.md`, including TPM/Software-CNG and pre-mutation refusal | `LIC-6.6-001` | Windows QA Owner | At least two independent physical computers plus clean disposable machines/VMs | `[ ]` | Exact OS/edition/build/architecture/TPM matrix and hashed artifacts |
| `LIC-6.6-003` | Pass real K40 Offline/Hybrid/lock/transition/Backup workflows with no forbidden physical side effect | `LIC-6.6-002` | Device QA Owner | Real K40 and isolated test data | `[ ]` | Device ID/firmware/network/test IDs and safe results |
| `LIC-6.6-004` | Rerun customer-artifact secret/issuer/chunk/brand/language scans on final signed packages | `LIC-6.6-002` | Release/Security Owner | Final FULL/ATTENDANCE installers | `[ ]` | Checksums, signature verification and scan report |
| `LIC-6.6-005` | Exercise Vendor key rotation/denylist, operator approval, backup/DR and compromise/revocation runbooks | `LIC-6.2-011`; `LIC-OPEN-001` through `LIC-OPEN-008` closed | Vendor Security Owner | Production-shaped Vendor staging | `[ ]` | Timestamped exercise report and remediated findings |
| `LIC-6.6-006` | Perform final independent review: all rows/evidence closed, no partial implementation or unapproved deviation | `LIC-6.6-001` through `LIC-6.6-005` | Product/Release/Security Owners | This master file and signed release inventory | `[ ]` | Written Release Gate approval; unlocks Phase 7 only |

## 18. Open decisions, procurement gates and accepted risks

This append-only register retains both open and closed rows. Every row still marked `[ ]` must be resolved before its stated gate; a closed row remains as decision history. Resolution requires an append-only Decision Log row and updates to the affected normative clauses/checklist.

| Open ID | Unresolved decision/risk | Current binding boundary | Owner role | Must close before | Status |
| --- | --- | --- | --- | --- | --- |
| `LIC-OPEN-001` | Select actual Vendor authority owner, domain, hosting, monitoring, audit retention, backup/DR and incident SLA | Vendor system stays separate and no customer artifact may contain issuer code/key | Product/Vendor Operations Owner | `LIC-6.2-011` completion | `[ ]` |
| `LIC-OPEN-002` | Select production Root/Offline hardware token or HSM and Online HSM/KMS provider, custody and key ceremony | Key purposes/custody in §4.3 cannot be merged or weakened | Vendor Security Owner | `LIC-6.2-011` completion | `[ ]` |
| `LIC-OPEN-003` | Prove and select TPM sealing/NV and Software-CNG protection adapters across `WINDOWS_SUPPORT_MATRIX.md` | No absolute anti-snapshot claim; TPM-less remains lower assurance; one-host evidence cannot select a fleet adapter | Windows Security Owner | `LIC-6.2-008` completion | `[ ]` |
| `LIC-OPEN-004` | Convert suggested Hybrid defaults into exact issuer policy: check cadence, warning, grace, 1–30 day allowance, max term/token lifetime, clock tolerance and Time-Recovery RTT | Closed by the exact bounded policy in `LIC-DEC-016`; values remain signed/finite and cannot be widened by local configuration | Product/Security Owners | `PHASE-6.2` protocol freeze | `[x]` — `LIC-CHG-0006`, `LIC-EV-0006` |
| `LIC-OPEN-005` | Select Authenticode certificate/timestamp provider, release-key custody and signing ceremony | Authenticode key remains separate from License keys; unsigned artifact cannot pass Pilot | Release/Security Owners | `PHASE-6.4` exit | `[ ]` |
| `LIC-OPEN-006` | Assign named operators/reviewer and address initial single-operator/two-person-approval risk | High-risk actions remain MFA/audited; risk must be explicit until two operators exist | Product/Vendor Security Owners | `LIC-6.2-011` completion | `[ ]` |
| `LIC-OPEN-007` | Record the exact snapshot/clone assurance claim after TPM and TPM-less evidence | Marketing/support cannot claim perfect offline snapshot detection | Product/Windows Security Owners | `PHASE-6.5` exit | `[ ]` |
| `LIC-OPEN-008` | Define Vendor renewal/revocation/recovery support ownership and customer escalation procedure | Offline revoke latency and `requested` versus `effective` distinction remain mandatory | Product/Vendor Operations Owners | `PHASE-6.6` exit | `[ ]` |
| `LIC-OPEN-009` | Record each Pilot customer's Mode, term, warning/grace, allowance, assurance and renewal owner | Customer-specific values cannot widen protocol/product limits | Product/Pilot Owner | Phase 7 customer Pilot | `[ ]` |
| `LIC-OPEN-010` | Clarify exact Time-Correction retry versus consumed-token replay: section 4.2 says byte-identical retry is idempotent, while the frozen `MAL_TIME_CORRECTION_TOKEN_REPLAY` descriptor requires `STATE/TIME_CORRECTION_REPLAYED` and current preflight rejects every previously accepted correction token | Neither silently discard the frozen negative test nor silently remove the accepted idempotent-retry rule. Product/Security approval must define the boundary (for example strict consumed-token rejection in the core, with a separate read-only already-completed result at the workflow layer). No second time/state advance is permitted under either interpretation; v1 wire semantics remain frozen. | Product/Security Owners | `LIC-6.2-005` implementation | `[x]` ? `LIC-CHG-0015`, `LIC-EV-0018` |
| `LIC-OPEN-011` | Cross-boot forward-clock repair previously poisoned high-water and rejected signed repair in both Editions | Resolved by Product-approved availability and future-enabling policy in `LIC-CHG-0016` / `LIC-CHG-0017`, concrete provenance contract in section 8.4 and verified remediation `LIC-EV-0026`. Separate observed calendar and corroborated floor; no downtime threshold, compulsory online reboot, lowered signed floor, changed wire semantics or legacy-state migration. Later Windows acquisition/Store limits remain explicit. | Product/Security Owners | `LIC-6.2-005` closure and dependent LIC006/007 entry | `[x]` |
| `LIC-OPEN-012` | Resolve the closure cycle between LIC006, Phase6.2, Guardian and Store | CHG0080/EV0149 adopts exact reviewed v2 implementation-entry/full-exit separation; Product confirmed, independent non-author agent amendment Security reviewer approved. Scheduling decision closed only; all NE gates and full FILE/STORE/platform/item exits retained; LIC008/Open003 remain open. | Lead Repository Maintainer / Product and scoped agent Security Reviewer | Scheduling policy adopted; actual native entry still NOT_READY | `[x]` |

## 19. Developer workflow and handoff contract

### 19.1 Starting an item

1. Read sections 0–18 and confirm the selected `LIC-*` item has no incomplete dependency or due Open item.
2. Record the named implementer, reviewer, branch/commit base and intended test IDs in a new Evidence Log row; then change only that item to `[~]`.
3. Inspect the current implementation and tests. Do not rely on a previous chat summary as repository truth.
4. Write or update negative tests before/security-boundary code alongside the implementation.
5. Keep the change limited to the selected IDs. A discovered requirement change returns to Product Owner approval/change control first.

### 19.2 Closing an item

1. Run the item's focused tests and every affected aggregate/Edition/Backup/K40 gate.
2. Record exact commands, versions, OS/TPM environment, artifact/checksum locations, result and known limitations in section 20.
3. Obtain the required reviewer for security, protocol, Installer or release-sensitive work.
4. Update mirror documents in the same commit.
5. Change `[~]` to `[x]` only after the Evidence row is complete and the commit/build identifier exists.

### 19.3 Required handoff template

```text
Active checklist status: 2026-10-04: LIC001-005 remain complete; LIC006-008 remain in progress and LIC009-013 are not started. EV0117 completes0.8.2: profile-backed `LOCAL=user` is functional but shared with Peer; exact service-SID protect fails0x80090034. The control is rejected, no rerun is permitted and production acceptance remains false. A separate approved adapter comparison is next. See [profile control](../experiments/LICENSING_PROFILE_CONTROL.md).
Current status:
Named implementer / reviewer:
Base branch and commit:
Files changed:
Tests already run and exact results:
Artifacts / hashes / environment:
Open IDs, risks or failed checks:
Decisions changed (normally none):
Exact next safe action:
```

### 19.4 Global Definition of Done

Licensing may be called complete only when `LIC-6.6-006` is `[x]`. Passing unit tests, finishing the Node module, producing an Installer or activating one machine is never sufficient by itself. A failed or skipped release test reopens the affected item and every dependent Gate.

## 20. Decision, change and evidence logs

### 20.1 Append-only Decision/Change Log

| Change ID | Date | Revision | Decision/change | Approver | Affected IDs | Required retest/mirror update |
| --- | --- | --- | --- | --- | --- | --- |
| `LIC-CHG-0001` | 2026-08-26 | `v1-design-r1` | Changed v1 Licensing from `[OUT]` to finite `[IN]` for both Editions; accepted Offline/Hybrid, no perpetual sale and recoverable lock | Product Owner (explicit user approval) | `LIC-DEC-001` through `LIC-DEC-003`, all Phase 6 License work | Packaging/Security/Edition/Project summaries updated; implementation not started |
| `LIC-CHG-0002` | 2026-08-26 | `v1-design-r1` | Accepted the complete crypto/key/binding/state/time/control/tamper/runtime/Backup/Audit/Vendor design after independent blocker reviews | Product Owner | `LIC-DEC-004` through `LIC-DEC-015`, `LIC-REQ-001` through `LIC-REQ-013` | Static documentation review; future §15 implementation matrix required |
| `LIC-CHG-0003` | 2026-08-27 | `v1-design-r2` | Promoted this file to the single authoritative master record and added stable IDs, execution checklist, Open register, handoff and Evidence rules; no technical License behavior changed | Product Owner (explicit user request) | `LIC-GOV-001` through `LIC-GOV-003`, sections 0 and 17–20 | README and checklist mirrors; static/link/consistency checks |
| `LIC-CHG-0004` | 2026-08-27 | `v1-design-r3` | Recorded immutable canonical-master commit `4069bba`, closed the governance bootstrap and activated Phase 6.1 with named implementation and acceptance roles; no technical License behavior changed | Product Owner (authorization to proceed) | `LIC-GOV-001` through `LIC-GOV-003`, `LIC-6.1-001` | Clean-scope review and Phase 6.1 evidence required |
| `LIC-CHG-0005` | 2026-08-28 | `v1-design-r4` | Completed Phase 6.1 with one strict canonical product/build identity, exact Node `24.19.0`, independently selected deterministic FULL/ATTENDANCE development artifacts and closed-world SHA-256 manifests; no License token, state-machine, signing, Guardian or Installer behavior was introduced | Product Owner (authorization to implement Phase 6.1) | `LIC-6.1-001` through `LIC-6.1-004`, `LIC-REQ-012` | `LIC-EV-0004`, `LIC-EV-0005`; all mirrors updated; Phase 6.2 remains next and inactive until owner/reviewer assignment |
| `LIC-CHG-0006` | 2026-08-30 | `v1-design-r5` | Accepted the finite v1 timing/lifetime package in `LIC-DEC-016`, closed `LIC-OPEN-004` and activated only `LIC-6.2-001`; also approved resolving byte-level schema details under the strict deterministic CBOR/COSE profile without adding Golden Vectors, parser/runtime behavior or production keys | Product Owner (explicit approval); independent Security Reviewer required at closure | `LIC-DEC-016`, `LIC-OPEN-004`, `LIC-6.2-001` | `LIC-EV-0006`; protocol schema/corpus tests and mirror updates required before `[x]` |
| `LIC-CHG-0007` | 2026-08-30 | `v1-design-r6` | Froze protocol v1 as one closed source package: exact tag-18/headers/media domains, 10 signed and 3 carrier CDDL schemas, byte/carrier/endpoint limits, request/build/Feature/signer/reason registries, cumulative Denylist and durable Rebind semantics, plus descriptive negative corpus; no golden token, key, parser, verifier, signer or runtime admission was added | Product Owner (policy and implementation authorization); independent protocol/security reviews | `LIC-DEC-017`, `LIC-6.2-001`, `LIC-REQ-003` | Blocked candidate `LIC-EV-0007` and accepted remediation/final rerun `LIC-EV-0008`; README, Packaging, Security, Edition and Project mirrors updated; any wire change now requires a new protocol version |
| `LIC-CHG-0008` | 2026-08-31 | `v1-design-r7` | Activated `LIC-6.2-002` to create one deterministic, source-only Golden Vector package consumed unchanged by a non-production Vendor fixture issuer and independent Node/.NET test verifiers. Test private keys must be conspicuously non-production, remain outside customer artifacts and production trust, and the item cannot implement or claim the production parser/runtime assigned to `LIC-6.2-003`. | Product Owner (authorization to proceed); Protocol Owner Codex; independent Protocol and Security reviewers required at closure | `LIC-6.2-002`, `LIC-REQ-003` | `LIC-EV-0009` start; exact Node 24.19.0 and .NET 10 cross-runtime reports, deterministic regeneration, positive/negative coverage, key-isolation scan, closed vector manifest and mirror updates required before `[x]` |
| `LIC-CHG-0009` | 2026-09-03 | `v1-design-r8` | Completed `LIC-6.2-002` as a closed, deterministic and strictly non-production Golden Vector package with a fixture-only Vendor issuer plus independent Node/.NET test consumers. The package executes positive, binary-negative and cross-type cases identically, but deliberately does not implement or authorize the production parser/runtime assigned to `LIC-6.2-003`. | Product Owner (authorization to implement the next approved item); Protocol Owner Codex; independent Protocol and Security closure reviewers | `LIC-6.2-002`, `LIC-REQ-003` | `LIC-EV-0010`; closed vector manifest/pin, exact cross-runtime reports, attack probes, production-isolation scan and all documentation mirrors updated; `LIC-6.2-003` is next but remains unstarted |
| `LIC-CHG-0010` | 2026-09-03 | `v1-design-r9` | Activated only `LIC-6.2-003` to build the portable production License preflight core: bounded deterministic CBOR/tag-18 COSE parsing, ES256 P-1363 verification, injected and purpose-separated trust, Delegation/Denylist validation, exact signed/carrier schemas and finite claim validation. State checks assigned by the frozen corpus may be evaluated only against immutable caller context; persistence, request consumption and effective state transitions remain `LIC-6.2-004` onward. | Product Owner (explicit authorization to proceed); Security Owner/implementer Codex; independent Protocol and Security reviewers required at closure | `LIC-6.2-003`, `LIC-REQ-001`, `LIC-REQ-003` | `LIC-EV-0011`; exact Node `24.19.0` `LIC-CRYPTO`, Golden Vector/protocol regressions, production-isolation scan and mirror updates required before `[x]` |
| `LIC-CHG-0011` | 2026-09-05 | `v1-design-r10` | Approved a descriptor-only v1 corpus erratum: exclude `activation-request` from `MAL_COMMON_UNKNOWN_SIGNER`, `MAL_COMMON_WRONG_PURPOSE_SIGNER`, `MAL_COMMON_WRONG_ENVIRONMENT` and `MAL_COMMON_KEY_ID_SPKI_COLLISION`, because activation verifies possession using its embedded canonical device SPKI rather than Vendor-registry metadata; change `MAL_RECOVERY_WRONG_TYPE` to text for `expectedStateGeneration`, while the separate negative-counter descriptor continues to require `COUNTER_OUT_OF_RANGE`. No CDDL, wire byte, signer-purpose or acceptance policy changes. Preserve all 224 descriptors, all other nine signer-type joins, all binary/cross-type fixtures and explicit activation PoP/hash/signature rejection coverage. | Product Owner (explicit authorization to proceed after the five corrections were presented); implementer Codex; independent Protocol reviewer `erratum_review`; independent Security closure reviewer | `LIC-6.2-001`, `LIC-6.2-002`, `LIC-6.2-003`, `LIC-REQ-003` | `LIC-EV-0012`; regenerate and repin protocol/vector packages and reports; exact Protocol/Golden/Core/Edition gates, independent closure reviews and synchronized mirrors required; previous pins remain historical evidence |
| `LIC-CHG-0012` | 2026-09-05 | `v1-design-r11` | Completed the approved corpus erratum and portable preflight implementation. Independent review added permanent full carrier/context coverage and exposed two implementation defects: invalid elapsed values passed Time Recovery, and Rebind conflated the local new key with the old sealed binding. Enforce runtime BigInt `0..300`; distinguish local `device` from sealed `previousDevice` with original-parent fallback, and revalidate both through the exact signed request. No wire/CDDL/issuer/commercial/state-transition policy changed. | Product Owner (authorization to complete the approved next item); implementer Codex; independent Protocol/Security reviewers `erratum_review` and `targeted_source_audit` | `LIC-6.2-001` through `LIC-6.2-003`, `LIC-REQ-001`, `LIC-REQ-003` | `LIC-EV-0013`; corrected pins, full Core/Protocol/Golden/Edition gates and synchronized mirrors pass; `LIC-6.2-004` is next and remains unstarted |
| `LIC-CHG-0013` | 2026-09-05 | `v1-design-r12` | Activated only `LIC-6.2-004` after committing the reviewed preflight closure as `10791e7`. Implement the already accepted pure state-transition contract in §§3, 4.2, 6, 7, 9 and 10; no new wire, issuer, commercial or transition policy is approved by this implementation record. | Product Owner (explicit commit-and-proceed request); implementer Codex; independent Security/Protocol reviewer `erratum_review`; independent test/code reviewer `targeted_source_audit` | `LIC-6.2-004`, `LIC-REQ-001`, `LIC-REQ-005`, `LIC-REQ-007` | `LIC-EV-0014`; deterministic model/power-loss and 18 owned STATE descriptor tests, Core/Protocol/Golden regression, production isolation and synchronized mirrors required before closure |
| `LIC-CHG-0014` | 2026-09-05 | `v1-design-r13` | Completed LIC004 pure-model review and remediation. Two independently verified Reactivation artifacts must also have distinct token IDs within their shared proposed transaction. Added permanent current-versus-pending Recovery, complete/missing/future Hybrid Reactivation, Control persistence and equal-revision eligibility coverage. No wire, issuer, commercial or transition policy changed. | Product Owner (authorization to perform the described independent review, remediation and commit); implementer Codex; independent Security reviewer `state_final_review` | `LIC-6.2-004`, `LIC-REQ-001`, `LIC-REQ-005`, `LIC-REQ-007` | `LIC-EV-0016`; synchronized mirrors; LIC005 next but not started |
| `LIC-CHG-0015` | 2026-09-05 | `v1-design-r13` | Product Owner confirmed that Time Correction applies once; exact duplicate delivery may report the previously applied result without another effect. Clarify read-only receipt acknowledgement separately from strict consumed-token rejection, preserving both section 4.2 idempotency and the frozen replay test. Activate LIC005 only. | Product Owner (explicit confirmation to implement the recorded decision); implementer Codex; independent closure review required | `LIC-OPEN-010`, `LIC-6.2-005`, `LIC-REQ-006` | `LIC-EV-0018`; no v1 wire/corpus change; time/state/core regressions and mirrors required |
| `LIC-CHG-0016` | 2026-09-08 | `v1-design-r16` | Product Owner explicitly approved normal offline operation across repeated daily boots and days/months of shutdown, with no security lock/reactivation solely for boot count or downtime. Finite term/grace and Hybrid allowance still elapse. Approved separating observed Windows time from authoritative License time so a mistaken forward clock remains repairable. No downtime threshold, reboot grace, compulsory online reboot, wire change or weakening of the signed correction floor is approved. | Product Owner (explicit confirmation and request to proceed); detailed Security review remains pending | `LIC-OPEN-011`, `LIC-6.2-005`, `LIC-REQ-006` | Record the detailed time-consumer design before security-sensitive implementation; add availability/expiry/repair tests in both Editions; preserve failing history and synchronize all mirrors; no closure claim |
| `LIC-CHG-0017` | 2026-09-08 | `v1-design-r18` | Product explicitly approved the independent review recommendation: existing effective authority remains usable through normal boots/downtime within its finite deadlines; future-only renewal/features/UNSUSPEND require corroborated time or qualifying fresh signed evidence, including offline delivery. Provisional restrictive Control must not alone create irreversible terminal tombstones; existing effective locks remain protected. No per-boot Internet requirement or new grace is introduced. | Product Owner (explicit yes); independent Security reviewer `time_design_review` reviews the concrete provenance implementation contract | `LIC-OPEN-011`, `LIC-6.2-005`, `LIC-REQ-006` | `LIC-EV-0024` starts remediation tests/design refinement; all time consumers, both Editions, future pairs/Control, replay and legacy provenance require verification before closure |
| `LIC-CHG-0018` | 2026-09-08 | `v1-design-r19` | Completed the Product-approved LIC005 portable remediation: independent observed/floor epochs and fractions, explicit signed-import receipt evidence, corroborated future promotion/Control/no-shortening and repair-preserved elapsed time. No new commercial policy, signed schema/corpus, production key or runtime admission is added beyond CHG0016/0017. | Product Owner (approved implementation); implementer Codex; independent Security reviewer `time_design_review` | `LIC-6.2-005`, `LIC-OPEN-011`, `LIC-REQ-006` | `LIC-EV-0025` retains failures; `LIC-EV-0026` records final passing tests/review and synchronized mirrors. LIC006 is next, not started |
| `LIC-CHG-0019` | 2026-09-08 | `v1-design-r20` | Commit reviewed LIC005 closure as e49630a and start only LIC006 under the existing Offline request/import and data-safety contract. First slice is bounded signed-import planning against protected request lookup; no new commercial or signed-wire semantics. | Product Owner (explicit commit-and-proceed request); implementer Codex; acceptance reviewer Project Owner | `LIC-6.2-006`, `LIC-REQ-002`, `LIC-REQ-007` | `LIC-EV-0027`; permanent both-Edition positive/negative tests and isolation checks; independent Security review required before closure |
| `LIC-CHG-0020` | 2026-09-08 | `v1-design-r21` | Continue LIC006 from committed import checkpoint 7435dc8 with portable ACTIVATE/RENEW creation, installation-only signing and conditional registration/export-byte contracts. Reuse frozen request schema, exact state/build/device binding and existing verification; no commercial, wire, time or authority-transition change. | Product Owner (explicit request to implement the described next step); implementer Codex; acceptance reviewer Project Owner | `LIC-6.2-006`, `LIC-REQ-002` | `LIC-EV-0029` and `LIC-EV-0030`; both-Edition tests and synchronized mirrors; physical Windows/storage and independent closure review remain open |
| `LIC-CHG-0021` | 2026-09-08 | `v1-design-r22` | Commit request slice as67f9867 and continue LIC006 with Entitlement completion/CAS acknowledgement and complete-state obligation handoff. Fix historical retry correlation to the exact signed request ID/hash without changing the core's read-only idempotent receipt semantics. | Product Owner (explicit commit-and-start-next-step request); implementer Codex; acceptance reviewer Project Owner | `LIC-6.2-006`, `LIC-REQ-002`, `LIC-REQ-005` | EV0031 start and EV0032 retained failing review probe; full both-Edition and crypto/isolation reruns required. No physical persistence, runtime, wire/commercial change or independent closure claimed |
| `LIC-CHG-0022` | 2026-09-08 | `v1-design-r23` | Continue LIC006 with CONTROL requests and a separately closed Offline-Control completion factory sharing existing CAS/obligation handoff. Preserve exact request-bound versus Vendor-initiated origin even for historical retries. Reuse frozen action/reason/time/revision and existing suspend/unsuspend/terminal-revoke semantics; no new wire, commercial or time policy. | Product Owner (explicit next-step implementation request); implementer Codex; acceptance reviewer Project Owner | `LIC-6.2-006`, `LIC-REQ-007` | EV0034 start, EV0035 compile failure, EV0036 final portable regression; synchronized mirrors. No new commit requested and no physical storage/runtime or independent closure claimed |
| `LIC-CHG-0023` | 2026-09-08 | `v1-design-r24` | Continue LIC006 from6c9fb09 with incident-derived RECOVER requests and a separately closed Recovery completion factory. Reuse signed CLEAR_TAMPER/REPAIR_SECURE_STATE and strict single-use rules; current Entitlement remains the repair parent even with a pending successor. Synchronize stale live summaries without rewriting historical decisions/evidence. | Product Owner (explicit next-steps implementation request); implementer Codex; acceptance reviewer Project Owner | `LIC-6.2-006`, `LIC-REQ-007` | EV0037 start, EV0038 portable regression. No new wire/commercial/time/replay policy, production persistence/runtime or independent closure; no new commit requested |
| `LIC-CHG-0024` | 2026-09-08 | `v1-design-r25` | Commit RECOVER as97a6d02 and implement bounded REBIND request/import/completion using a trusted staged-device adapter and existing frozen signed transitions. Preserve old/new binding separation, current parent, one-use consumption and complete-state CAS. | Product Owner (explicit commit-and-implement request); implementer Codex; acceptance reviewer Project Owner | `LIC-6.2-006`, `LIC-REQ-004`, `LIC-REQ-007` | EV0039 start; both-Edition binding/negative/commit tests and aggregate regression required; no new policy or independent closure |
| `LIC-CHG-0025` | 2026-09-08 | `v1-design-r26` | Commit REBIND as91b4771; implement TIME_CORRECT request/evidence and closed completion using existing signed repair rules and CHG0015 read-only receipt acknowledgement. Exact archived-request correlation precedes duplicate confirmation. | Product Owner (commit-and-next-step request); implementer Codex; acceptance reviewer Project Owner | `LIC-6.2-006`, `LIC-REQ-006` | EV0042 start; both-Edition request/repair/replay/freshness/commit tests and prior aggregates required; no new time/wire/commercial policy |
| `LIC-CHG-0026` | 2026-09-08 | `v1-design-r27` | Commit TIME_CORRECT as9703e13; add incident/tombstone-derived REACTIVATE request and closed two-artifact completion using existing frozen state and signer rules. | Product Owner (commit-and-next-step request); implementer Codex; acceptance reviewer Project Owner | `LIC-6.2-006`, `LIC-REQ-007` | EV0044 start; both-Edition pair, lineage, replay and failure tests plus existing aggregates; no new wire/commercial policy or independent closure |
| `LIC-CHG-0027` | 2026-09-08 | `v1-design-r28` | Decompose existing LIC006 safe-file and durable-adapter obligations into a source-audited handoff and ten planned acceptance cases. Preserve existing implementation/history and gate ownership; select no new platform provider, storage policy or wire semantics. | Product Owner (next-step request); implementer Codex; acceptance reviewer Project Owner | `LIC-6.2-006`, `LIC-REQ-005`, `LIC-REQ-007` | EV0046 start and EV0047 documentation/source audit; mirrors and local checks required; no new commit or runtime implementation |
| `LIC-CHG-0028` | 2026-09-08 | `v1-design-r29` | Add portable selected-file intake/request-publication orchestration under the existing LIC006 adapter contract. Preserve explicit intent, caps, immutable snapshots, complete Reactivation staging and registration-before-publication. | Product Owner (next-step implementation request); implementer Codex; acceptance reviewer Project Owner | `LIC-6.2-006` | EV0048 start; fake-adapter tests and existing aggregates required. No native/provider choice, wire/state policy, runtime authority or independent closure |
| `LIC-CHG-0029` | 2026-09-08 | `v1-design-r30` | Connect one-pass bounded file intake to the six existing closed completion factories; preserve planning-only entry, complete-state obligations and existing replay/unknown-outcome rules. | Product Owner (next-step request); implementer Codex; acceptance reviewer Project Owner | `LIC-6.2-006` | EV0050 start; expanded fake-adapter completion tests and existing regressions; no new wire/state policy, native Store or independent closure |
| `LIC-CHG-0030` | 2026-09-08 | `v1-design-r31` | Record previous portable work committed as c975958 and expand file-to-completion acceptance coverage across all six intents and both Editions. Reuse signed scenario builders without replacing direct-completion tests. | Product Owner (explicit next-step implementation request); implementer Codex | `LIC-6.2-006` | EV0052 start and EV0053 retained test-expectation failure; final regression evidence required. No production, wire, commercial, time, native Store or runtime policy change; no independent closure. |
| `LIC-CHG-0031` | 2026-09-12 | `v1-design-r35` | Complete independent review of committed portable LIC006 scope and synchronize live status without repeating closed LIC004/005 review or changing production code. | Project Owner (explicit independent-review approval); reviewer offline_independent_review; coordinator Codex | `LIC-6.2-006` | LIC-EV-0055 and LICENSING_OFFLINE_REVIEW.md; limited portable approval only. Native/Store dependencies and LIC006 exit criteria unchanged. |

| `LIC-CHG-0032` | 2026-09-12 | `v1-design-r36` | Commit Windows test-kit preparation as5e842d9 and start LIC007 portable challenge/PoP request and conditional registration under existing completed dependencies. Synchronize live status; restore revision ordering after stale r34 header (historical CHG0031 already records r35). | Project Owner (explicit commit-and-next-step request); implementer Codex | `LIC-6.2-007` | EV0061 start; both-Edition tests and existing regressions required. No wire/time/commercial change, physical Store/HTTPS/runtime implementation or independent closure. |

| `LIC-CHG-0033` | 2026-09-12 | `v1-design-r37` | Commit signed request checkpoint10d09f7; implement bounded primary-Lease CHECK_IN/TIME_RECOVERY response preparation and complete-state adapter acknowledgement using existing signed core transitions. | Project Owner (explicit commit-and-implement request); implementer Codex | `LIC-6.2-007` | EV0064 start. Unsupported response variants reject atomically. Relocate EV0062-0065 unchanged from below Primary references into the Evidence table. No protocol, time/commercial policy, real transport/Store or independent closure change. |

| `LIC-CHG-0034` | 2026-09-12 | `v1-design-r38` | Commit primary-Lease checkpoint14ddebf and add separately closed CHECK_IN control-only carrier dispatch using existing Offline-Control completion and protected request lookup. | Project Owner (explicit commit-and-next-step request); implementer Codex | `LIC-6.2-007` | EV0067 start. No change to signed wire/core/time/commercial rules. Control dispatch does not complete or consume the Lease check-in; mixed transactions/delivery ledger and independent closure remain open. |

| `LIC-CHG-0035` | 2026-09-12 | `v1-design-r39` | Add internal atomic Lease+Offline-Control reduction and separately closed combined carrier workflow. Respect activation-global revision ordering without changing strict Control increment or equal-tuple Lease rules; seal only one complete generation. | Project Owner (explicit implementation request); implementer Codex | `LIC-6.2-007` | EV0069 start; targeted composition and prior core/workflow regressions required. Initial planned Lease-first ordering refined to existing revision rules before final-source tests; no signed wire/time/commercial change or independent closure. |

| `LIC-CHG-0036` | 2026-09-12 | `v1-design-r40` | Independently review committed Hybrid request/response and atomic core composition e88d0ca; retain existing deferred physical/transport scopes and completed LIC006 review. | Project Owner (explicit independent-review authorization); reviewer hybrid_independent_review; coordinator Codex | `LIC-6.2-007` | EV0072 start, EV0073 retained fixture failure, EV0074 independent28/28 and coordinator aggregate pass. Limited portable approval, no production remediation or stage closure. |
| `LIC-CHG-0037` | 2026-09-12 | `v1-design-r41` | Add ordinary CHECK_IN Root-signed trust-sidecar preparation and trust-only CAS handoff, reusing frozen trust rules. | Project Owner (implementation authorization); implementer Codex; independent closure pending | `LIC-6.2-007` | EV0075 start; EV0076 retained preparation/test failures; EV0077 aggregate/Golden pass. No live verifier replacement, complete response application, physical Store, protocol or release closure. |
| `LIC-CHG-0038` | 2026-09-12 | `v1-design-r42` | Implement staged Root-authorized trust branching and coordinated CHECK_IN Lease plus optional Control preparation with one trust/state CAS handoff. | Project Owner (commit then next-step authorization); implementer Codex; targeted independent review pending | `LIC-6.2-007` | EV0078 start; EV0079 retained compile/fixture failures; EV0080 records44/44 and aggregate/Golden pass. Reuses existing signature, denial, time, model and restriction rules; no new signed schema, lock state or physical runtime authority. |
| `LIC-CHG-0039` | 2026-09-13 | `v1-design-r43` | Independently review committed trust/core coordination53a7d74 and explicitly track its rejected-clock-observation admission gate. | Project Owner (next-step independent-review authorization); reviewer hybrid_independent_review; coordinator Codex | `LIC-6.2-007`, `LIC-6.2-009` | EV0081 start, EV0082 retained fixture failure; independent28/28 final probes. No production remediation or new clock/lock policy. Runtime/native/LIC007 closure remains open. |
| `LIC-CHG-0040` | 2026-09-19 | `v1-design-r44` | Add read-only verified Hybrid Reactivation request targeting and one-CAS three-artifact completion under the existing terminal-lineage contract. | Project Owner (next-step implementation authorization); implementer Codex; targeted independent review pending | `LIC-6.2-007` | EV0084 start and EV0085 retained compilation/fixture failures; focused48/48 pass. Separate signed Entitlement preserves the frozen carrier. Mixed variants, physical persistence, transport and runtime gates remain open; no security/commercial/time-policy change. |
| `LIC-CHG-0041` | 2026-09-19 | `v1-design-r45` | Conduct the bounded portable review of committed Hybrid Reactivation handoff2a6fb87 without repeating prior LIC006/Hybrid/trust reviews. | Project Owner (next-step authorization); reviewer Codex, separate review pass | `LIC-6.2-007` | EV0088 and LICENSING_HYBRID_REACTIVATION_REVIEW.md. No reproducible blocking portable defect; no protocol, commercial, time, physical-storage or runtime policy change. |
| `LIC-CHG-0042` | 2026-09-19 | `v1-design-r46` | Implement ordinary CHECK_IN Reactivation composition with optional Control and Trust, using one staged-trust and complete-state CAS plan. | Project Owner (explicit next-step request); implementer Codex | `LIC-6.2-007` | EV0090. Frozen carrier remains unchanged; Entitlement remains a separate signed input. TIME_RECOVERY, real HTTPS/protected Store/service and runtime admission remain outside this portable checkpoint. |
| `LIC-CHG-0043` | 2026-09-19 | `v1-design-r48` | Record physical failures and subsequent corrections; add stage diagnostics, report export and exact-name read-only provider inspection. | Project Owner (diagnostic next-step and local execution requests); implementer Codex | `LIC-6.2-008` | EV0091-0094. No production protection-policy, key provisioning authority or dependency change; physical acceptance and resource reconciliation remain open. |

| `LIC-CHG-0044` | 2026-09-19 | `v1-design-r49` | Record cross-document path review and correct active status summaries; distinguish existing LIC008 from provisional Setup key creation and retain LIC-OPEN-012. | Project Owner (requested documentation/checklist review); reviewer Codex | LIC006/007/008, LIC-OPEN-003/012 and checklist mirrors | See LICENSING_PATH_REVIEW.md and EV0095. No dependency waiver, key-owner change, stage closure or repeated independent review. |

| `LIC-CHG-0045` | 2026-09-19 | `v1-design-r50` | Prepare the Guardian provisioning/protection baseline experiment and a concrete native-entry dependency amendment proposal. | Project Owner (authorized planning step); author Codex; security acceptance pending | LIC008, LIC-OPEN-003/012 | LICENSING_WINDOWS_NEXT_PLAN.md; EV0096. No production key-owner/protection change, dependency amendment adoption or physical probe execution. |

| `LIC-CHG-0046` | 2026-09-19 | `v1-design-r51` | Build separate test-only Guardian provisioning baseline0.3.0 with fixed isolated namespace, native creation stages, token/readiness guards and conservative cleanup. | Project Owner (authorized next implementation step); implementer Codex; physical/security acceptance pending | LIC008 | EV0097 and LICENSING_PROVISIONING_HARNESS.md. No Setup key creation, dependency waiver, production policy change or physical probe execution. |

| `LIC-CHG-0047` | 2026-09-19 | `v1-design-r52` | Review exact0.3.0 mutation scope and execute the separate current-host physical Guardian baseline; retain failed stage evidence and resources. | Project Owner (authorized next physical step); operator/reviewer Codex | LIC008 | EV0098. No Setup alternative, dependency change, global ACL relaxation, cleanup or acceptance closure. |

| `LIC-CHG-0048` | 2026-09-19 | `v1-design-r53` | Investigate finalized-key denial and standalone SID protection using bounded read-only environment collection and official documentation. | Project Owner (authorized next diagnostic step); implementer/reviewer Codex | LIC008, LIC-OPEN-003 | EV0099; no key creation, service/ACL/logging change, provider selection or contract amendment. |
| `LIC-CHG-0049` | 2026-09-19 | `v1-design-r54` | Execute bounded SYSTEM creator comparison; condition protection on accepted key isolation. | Project Owner (conditional experiment authorization); implementer Codex | LIC008, LIC-OPEN-003/012 | EV0100; first incomplete, second NOT_RUN. No production contract amendment. |
| `LIC-CHG-0050` | 2026-09-19 | `v1-design-r55` | Diagnose retained comparison key ACL mismatch through a fixed-key metadata reader. | Project Owner (diagnostic authorization); implementer Codex | LIC008, LIC-OPEN-003 | EV0101; no key mutation, acceptance waiver or production policy change. |
| `LIC-CHG-0051` | 2026-09-19 | `v1-design-r56` | Correct Software KSP ACL representation check and execute retained-key isolation continuation. | Project Owner (correction and experiment authorization); implementer Codex | LIC008, LIC-OPEN-003 | EV0102; Guardian correction passes, App key denial unresolved, protection NOT_RUN. No production policy change. |
| `LIC-CHG-0052` | 2026-09-21 | `v1-design-r62` | Adopt a narrow Microsoft Software KSP key-non-disclosure classification only when the exact retained machine key, protected SYSTEM+Guardian DACL, Guardian reopen/sign/public-identity/policy/private-export controls, App/actual-child `NTE_BAD_KEYSET` result and EV0107 ACL-only positive control all apply. | Project Owner (explicit approval); implementer/security reviewer Codex | LIC008, LIC-OPEN-003 | EV0107-EV0108. Never add `0x80090016` to global `IsDenied`, apply it to other providers/APIs, or relabel EV0102/EV0105. Two fresh accepted rounds remain required before conditional `LOCAL=user`; no production acceptance or LIC008 closure. |
| `LIC-CHG-0053` | 2026-10-04 | `v1-design-r66` | Prepare a separate profile-backed DPAPI-NG control using two fresh LocalService services: shared-account `LOCAL=user` is deliberately non-acceptable; exact Owner service SID must exclude same-account Peer and survive Owner process restart. | Project Owner (resume LIC008 authorization); implementer/reviewer Codex; physical/security acceptance pending | LIC008, LIC-OPEN-003 | EV0112 and LICENSING_PROFILE_CONTROL.md. No account/password/profile creation, retained/production Guardian change, `LOCAL=machine`, key/ACL/TPM mutation or production adapter decision. |
| `LIC-CHG-0054` | 2026-10-04 | `v1-design-r66` | Correct only the pre-service SID-ACL construction failure and resume the exact retained EV0113 empty state; do not rerun0.8.0. | Project Owner (reported physical result and continued LIC008); implementer/reviewer Codex | LIC008, LIC-OPEN-003 | EV0113-EV0114. Explicit SecurityIdentifier objects plus real ACL fixture; continuation pins failed report/hash/content, empty directories and absent services. No acceptance/policy change. |
| `LIC-CHG-0055` | 2026-10-04 | `v1-design-r66` | Correct only the Windows PowerShell5-incompatible copy destination and resume exact EV0115 stopped-service/empty-directory state without recreating services. | Project Owner (reported continuation result and continued LIC008); implementer/reviewer Codex | LIC008, LIC-OPEN-003 | EV0115-EV0116. Nested two-argument Join-Path and permanent source guard; exact reports/inventory/service configurations pinned. No acceptance/policy change. |
| `LIC-CHG-0056` | 2026-10-04 | `v1-design-r68` | Fix the v1 production boundary to serviced Windows 11 Home/Pro/Enterprise x64 and Windows 10 Enterprise LTSC 2019/2021 x64. Explicitly exclude x86, Arm64, non-LTSC Windows 10, Windows Server and legacy/preview targets. Require fail-closed pre-mutation Setup checks and multi-machine evidence; one development host cannot prove fleet support. | Product Owner (explicit approval); implementer/reviewer Codex; physical Release/Security review pending | LIC008, LIC-REQ-011, LIC-6.4-006, LIC-6.6-002, LIC-OPEN-003 | EV0118 and WINDOWS_SUPPORT_MATRIX.md. Scope/docs only; Installer guard and all physical matrix rows remain NOT_RUN. Every candidate wrapping adapter must satisfy this matrix before selection. |
| `LIC-CHG-0057` | 2026-10-04 | `v1-design-r69` | Select the distinct non-exportable Microsoft Software-KSP wrapping-key direction over a dedicated local service account. Reject standalone DPAPI-NG/LOCAL scopes for production; keep the ECDSA installation key signing-only. Adopt RSA-3072/OAEP-SHA256 wrapping of fresh AES-256-GCM envelope keys as the first test candidate, subject to harness/matrix/review acceptance. | Product Owner (explicit approval); implementer/reviewer Codex; independent Security acceptance pending | LIC008, LIC-DEC-006, LIC-OPEN-003, LIC-6.5-002 | EV0119 and LICENSING_SOFTWARE_KSP_WRAPPING_DESIGN.md. Design only; no key/service/ACL/state mutation, adapter implementation or acceptance. Fresh isolated harness and full Windows matrix remain required. |
| `LIC-CHG-0058` | 2026-10-04 | `v1-design-r70` | Implement the approved direction as a fresh, test-only `Ecs.Lic008.WrappingV1` first-host feasibility harness. Preserve fail-closed platform/freshness checks, exact RSA/AES profile, A/B ACL control and explicit non-acceptance flags; do not treat build success as physical or production acceptance. | Product Owner (explicit next-step authorization); implementer/reviewer Codex; physical operator and independent Security acceptance pending | LIC008, LIC-DEC-006, LIC-OPEN-003, LIC-6.5-002 | EV0120. Inert build/static evidence only; no service/key/ACL mutation. Ordinary-user, reboot/lifecycle and all physical matrix rows remain required. |
| `LIC-CHG-0059` | 2026-10-04 | `v1-design-r71` | Supersede CHG0056's lifecycle-gated OS boundary. Target Windows 10 client x64 build14393+ and Windows 11 client x64 build22000+ regardless of Microsoft servicing date; retain x86/Arm64/Server/Insider/S-mode exclusion. Treat lifecycle as advisory, while exact runtime/product/K40 matrix evidence remains mandatory. | Product Owner (explicit scope change); implementer/reviewer Codex; Release/Security acceptance pending | LIC008, LIC-REQ-011, LIC-6.4-006, LIC-6.6-002, LIC-OPEN-003 | EV0121 and WINDOWS_SUPPORT_MATRIX.md. This permits current build22000 for first-host execution but does not claim obsolete Windows is secure or prove other builds. Windows 10 before14393 remains impossible under the pinned .NET stack. |
| `LIC-CHG-0060` | 2026-10-04 | `v1-design-r72` | Correct the `0.9.1` read-only Insider preflight for Registry keys that exist without optional BranchName/ContentType/Ring values. Missing optional values mean no positive Insider evidence, not an exception; retain StrictMode, all platform boundaries and non-acceptance flags. | Product Owner (explicit correction authorization); implementer/reviewer Codex; physical operator pending | LIC008, LIC-REQ-011, LIC-OPEN-003 | EV0122-EV0123. Exact missing/present property fixtures required; consumed0.9.1 must not rerun. No service/key/ACL mutation during diagnosis or correction. |

### 20.2 Append-only Evidence Log

| Evidence ID | Date | Checklist/Requirement IDs | Commit/build | Environment | Commands/tests/artifacts | Result and reviewer notes |
| --- | --- | --- | --- | --- | --- | --- |
| `LIC-EV-0001` | 2026-08-26 | `LIC-DEC-001` through `LIC-DEC-015`, `LIC-REQ-001` through `LIC-REQ-013` | Working tree; commit pending | Documentation-only technical design review | Three independent read-only crypto/key, integration and threat/state reviews plus Markdown/local-link/trailing-whitespace checks and `git diff --check` | Passed — the detailed technical License contract in §§1–16 had no remaining blocker. No runtime, DB, Windows Installer or K40 implementation/test was performed. |
| `LIC-EV-0002` | 2026-08-27 | `LIC-GOV-001`, `LIC-REQ-013` | Working tree; commit pending | Documentation-only master/handoff review | Independent management/dependency/threat reviews; Markdown local-link, trailing-whitespace, 82-ID reference/uniqueness and table-column checks; `git diff --check` | Passed after closing the explicit dual License-journal/Audit-projection traceability gap. The first ad hoc table-check command had a PowerShell interpolation parser error; its corrected rerun passed and changed no file. No remaining technical, dependency or handoff blocker exists; `LIC-GOV-002` is the only pre-implementation action. |
| `LIC-EV-0003` | 2026-08-27 | `LIC-GOV-001`, `LIC-GOV-002`, `LIC-GOV-003` | Canonical master `4069bba`; governance follow-up containing this row | Documentation governance bootstrap | `git diff --cached --check`; canonical-document scope review; named Phase 6.1 owner/reviewer assignment | Passed — runtime License implementation starts only after the immutable master snapshot; Phase 6.1 is now active. |
| `LIC-EV-0004` | 2026-08-28 | `LIC-6.1-001` through `LIC-6.1-003`, `LIC-REQ-012` | Working tree; commit pending; canonical identity SHA-256 `4c90f292580715e8db609f830eeafa2b19dea95a90a70f684761672bd069d893` | Windows development machine; exact Node `24.19.0` via temporary `npx`; host global Node `22.19.0`; existing installed dependency tree | `test-version-identity.mjs`; `test-version-consumers.mjs`; strict Server/Client identity mismatch and startup probes; `test-build-artifacts.mjs`; named FULL/ATTENDANCE builds and artifact verification | Passed after preserving and fixing three initial failures: the first Node 24 declaration build exited 2 because `tsconfig.runtime.json` omitted required Express/ZK type declarations; the next Vite attempt failed with `Dynamic require of "node:crypto" is not supported`; the first tamper test correctly rejected modified content but its assertion expected `hash` while the stable diagnostic used `sha256`. The include list, ESM/CJS bridge and error-code assertion were corrected and the complete gates rerun. |
| `LIC-EV-0005` | 2026-08-28 | `LIC-6.1-001` through `LIC-6.1-004`, `LIC-REQ-012` | Working tree; commit pending; FULL manifest `4f433662771087888df0b3aacc3b432632e62c158293a9af266fa2c7f23cc04f`; ATTENDANCE manifest `ded7fd492cf1ec3ee5d5fe39e25684acec27fde655289106cddd17095957784e` | Windows development machine; Node `24.19.0` via `npx`; global Node `22.19.0`; no clean Windows VM, independent dependency reinstall or physical K40 run | Four fresh builds plus tamper/path/case/symlink/junction/size/CLI/parent-Node-environment matrix passed; official build/verify passed with FULL 242 manifest closure entries/244 total files and ATTENDANCE 188 entries/190 total files; Edition boundary 36/36, component browser 37/37 and Attendance real-app 12/12 passed; FULL operations stages 1–26 plus focused report downloads 6/6 and Audit viewer 5/5 passed; independent integration, security and documentation reviews completed | Accepted Phase 6.1 evidence with two aggregate-runner interruptions explicitly retained: one `test-full-operations-regression.mjs` invocation stopped at step 25 with child `ETIMEDOUT`; another reached step 27 and hit the 240-second `attendance-report-date-from` locator timeout. The affected production build, route scan, report 6/6 and Audit 5/5 later passed as focused runs, but neither aggregate invocation printed `[full-operations] PASS` and `test:phase-6.1` is not claimed as a single PASS. No unresolved Phase 6.1 reviewer blocker remains. Artifacts are unsigned and jointly replaceable; clean-install supply-chain proof, physical Server isolation/secret scan, Guardian/Authenticode/runtime trust and clean Windows/K40 evidence remain Phases 6.3–6.6. |
| `LIC-EV-0006` | 2026-08-30 | `LIC-DEC-016`, `LIC-OPEN-004`, `LIC-6.2-001` | Base `0a085c2`; working tree; Phase 6.2.001 start record | Protocol Owner/implementer: Codex; Product Owner: Project Owner; closure Security Reviewer: independent reviewer; Windows development workspace; no runtime, DB, Installer or K40 change authorized | Product Owner explicitly approved the finite policy package; intended tests: strict registry/CDDL inventory, bounded UTF-8/control-file checks, protocol closure manifest, malformed descriptor coverage, complete 10-by-9 cross-type matrix, private-key/binary-fixture absence, Node `24.19.0` focused runner, documentation/link/ID checks and independent protocol/security review | Start gate passed — `LIC-OPEN-004` is closed and `LIC-6.2-001` alone is `[~]`. No schema, vector, parser, signature verifier or runtime License behavior is claimed complete by this start row; closure requires a later append-only Evidence row. |
| `LIC-EV-0007` | 2026-08-30 | `LIC-DEC-017`, `LIC-6.2-001`, `LIC-REQ-003` | Base `0a085c2`; rejected candidate manifest `af0bce13d53a106e51463ceae65a12b96a59e9a4c4c4b9101ca6d840f07ab3d1`; commit pending | Windows development workspace; exact Node `24.19.0` via `npx`; global Node `22.19.0`; Protocol implementer Codex; independent closure Security Reviewer; no production key, runtime, DB, Installer, K40 or clean-VM work | Initial focused gate and 13-file CDDL validation; strict JSON/manifest/private-key scans; independent protocol/security closure review | **Blocked candidate — not closure evidence.** The candidate gate passed its then-current 197-descriptor package after correcting its own nonexistent `signature` category assertion, and the RFC 8610-capable validator accepted all 13 CDDL files (the unrelated incomplete `cddl@0.21.1` parser rejected standard tag-of-array syntax). Independent closure review then found material gaps: incomplete purpose/response and Control/Rebind rules; lifetime/future-time/delegation bounds; trust-carrier and cumulative-Denylist semantics; missing exact TPM context; a stale `buildManifestHash` corpus field; shallow corpus/registry/manifest assertions with no digest pin outside the package; and premature completion mirrors. The candidate hash is retained only as failed history. Remediation and a fresh manifest/gate/reviewer PASS are mandatory before `[x]`. |
| `LIC-EV-0008` | 2026-08-31 | `LIC-DEC-017`, `LIC-6.2-001`, `LIC-REQ-003` | Base `0a085c2`; final protocol manifest `5999201211627e3f8c13d2af52cc2a7494e4bc3599a1cf440dac49714f1648e6`; commit pending | Windows development workspace; exact Node `24.19.0` via temporary `npx`; global Node `22.19.0`; Protocol implementer Codex; independent package/document and final Security Reviewers; no production key, runtime, DB, Installer, K40 or clean-VM work | `npx.cmd --yes -p node@24.19.0 -c "npm.cmd run test:license-protocol-v1"`; `npx.cmd --yes '@grinstead/cddl@1.0.0' validate` over all 13 CDDL files; exact registry/schema/message/signer/carrier assertions; canonical JSON/actionable-field/stage/type/count checks over 224 malformed descriptors and 90 ordered cross-type pairs; 18-file manifest closure, sidecar and repository-external digest pin; key/binary scan; documentation/mirror/link/ID checks; `git diff --check` | **Passed after remediation and independent rerun.** All `LIC-EV-0007` blockers were closed: exact purpose-response/Control/Rebind contracts, validity/delegation/TPM/trust/Denylist rules, structural Control unions, executable corpus fields/stages/applicability and deep registry/carrier checks are pinned. The pre-manifest reruns intentionally stopped first on `README.md manifest size mismatch` and then `Protocol manifest sidecar mismatch`; after generation, intermediate manifest `8d309f6cb920e96130daaf446273481db692bae6d1122b6a725e7e8958537179` passed the gate but independent Security review blocked two corpus applicability/order conflicts. Those were fixed and repinned; the final Node gate reports 224/90 and 18-file PASS, all 13 CDDL schemas pass, both independent reviewers report no material blocker, and `git diff --check` has line-ending warnings only. No golden vector, private key, parser/verifier, signer, runtime License, DB, Guardian, Installer, clean Windows or K40 behavior is claimed; `LIC-6.2-002` remains unstarted. |
| `LIC-EV-0009` | 2026-08-31 | `LIC-6.2-002`, `LIC-REQ-003` | Base `42548f3`; working tree; Phase 6.2.002 start record | Windows development workspace; Protocol Owner/implementer Codex; Product Owner Project Owner; independent Protocol and Security reviewers required at closure; exact Node `24.19.0`; installed .NET 10 x64 toolchain; no production key, customer runtime, DB, Guardian, Installer, K40 or clean-VM work authorized | Intended gates: deterministic test-only issuer regeneration; canonical CBOR/tag-18/COSE ES256 fixed-byte positives; actual byte-level negatives plus complete 224-descriptor and 90 ordered cross-type traceability; independent Node/.NET fixture consumers with byte-identical result reports; test-key/private-material isolation scans; closed manifest/sidecar/external pin; exact protocol-v1 regression; documentation/link/ID checks and independent closure reviews | Start gate passed — the dependency `LIC-6.2-001` is complete and `LIC-6.2-002` alone is `[~]`. Test keys must carry an unmistakable non-production marker and no production/customer module may import or trust them. This row claims no Golden Vector PASS, production parser/verifier, runtime authorization or packaging behavior; closure requires a later append-only Evidence row. |
| `LIC-EV-0010` | 2026-09-03 | `LIC-6.2-002`, `LIC-REQ-003` | Base `42548f3`; final index `92d06ac04a92c5e1a37c993185a246bd9a6b8513693ff43555f3179ebb9cc685`; final 129-file vector manifest `044f2d388efcb961a450bab4e842d2df2538c1771724d929b6a01a606577fa3c`; commit pending | Windows x64 development workspace; exact Node `24.19.0` via `npx`; host Node `22.19.0`; scoped .NET SDK `10.0.400` with x64 host/runtime `10.0.11`; Protocol Owner/implementer Codex; independent Protocol and Security closure reviewers; no production key/runtime, DB, Guardian, Installer, K40 or clean-Windows execution | `npx.cmd --yes -p node@24.19.0 -c "npm.cmd run test:license-golden-vectors"`; exact protocol-v1 regression; deterministic 105-artifact regeneration; 18 bounded `TEST_ONLY` public keys; 35 signed + 6 carrier positives; 42 executable binary negatives; exact 748 malformed joins (42 linked + 706 deferred); all 90 cross-type cases executed; strict CBOR/JSON/signature/trust/carrier/source-join checks; traversal/backslash/ADS/case/oversize/nonregular/link/report no-overwrite/alias probes; production key/import scan; three byte-identical 173-record reports with SHA-256 `0fa67ea1ef8c85ed8e142855d9a4f4daa0670d3bd9463dc42e2385f7da637ce8`; manifest/sidecar/external pin; documentation/link/ID and `git diff --check`; independent final reviews | **Passed after preserving and remediating blocked candidates.** Candidate manifest `d0a024591d95f60c99f67ee2a31c441e51e37c078f8bd8e713a8dc010c1483d5` was a false-green candidate, not closure: reviews found shared issuer/private-key dependencies, metadata-only cross-type coverage, shallow carrier/source joins, invalid trust-negative preconditions/order, missing FULL-chain and semantic-link assertions, incomplete canonical/path/output hardening and unsafe test-key wording. The first remediated aggregate then exposed `.NET` `MALFORMED_SOURCE_PATH`/`MALFORMED_SOURCE_ENVELOPE` handling; exact source-object validation and canonical JSON were fixed. An initial Windows PowerShell sync also failed because that host lacked `Path.GetRelativePath` and temporarily flattened generated duplicates; those copies were moved to a recoverable temp quarantine, the one binary stray was removed, the canonical 105-file tree was resynchronized and verified with zero stray root files. The stale committed reports and manifest then failed closed as designed; reports were seeded only from fresh successful consumers and `--prepare-manifest` produced the external pin. A final NTFS probe then proved another false-green: .NET accepted `<temp>\host.txt:vectorreport`, exited `0` and wrote a hidden 57,081-byte ADS while the 13-byte host sentinel remained. The already-pinned, aggregate-PASS pre-ADS manifest `efcdcf364643deecbdb229190a5097433a4b8500a0afb02f98c1c0e35162212d` is retained only as superseded false-green history and is not closure. Report syntax was hardened to reject colon/ADS, DOS device names and trailing-dot/space aliases before opening; permanent probes were added for both consumers. The first hardened prepare rerun failed exactly with `.NET trailing-dot report attack unexpectedly succeeded` because syntax validation occurred after `Path.GetFullPath` normalization; validating the raw CLI path fixed it. The focused rerun then returned `CLI_REPORT_PATH`/exit `1`, left only the 13-byte default stream, and the full aggregate passed before the next repin. Independent review then proved the pinned `c0260dd2daa07cd26522c8ae1e32e59b7d195ac4414b5c8d6539eed6f3e1a213` candidate false-green too: .NET accepted both an extended `\\?\C:\...` report alias and a `\\localhost\C$\...` administrative-share alias, exited `0` and wrote the full 57,081-byte report inside the package. Both consumers now require canonical local drive-rooted Windows CLI paths and permanently reject extended/device/UNC/administrative-share aliases for vector roots and report outputs. The first ad hoc documentation command had a PowerShell quoting error (`SyntaxError: Unexpected eof`); the stdin-based rerun passed all eight local-link/mirror/ID checks. The first staged-diff closure check then rejected five source files with an extra blank line at EOF; those non-semantic lines were removed, candidate manifest `15a5b2eededff27fff1e32f7869f0b63fdb465c2e3917f308e9b074fb36cf769` was superseded, and the package was repinned before the exact final rerun. Fresh Node/.NET outputs matched Vendor byte-for-byte, all attack probes and the production-isolation scan passed, and both independent reviewers reported no material blocker. This evidence closes only the non-production vector contract: production parser/Core/trust, state, Guardian, Installer, DB, K40 and clean-Windows behavior remain unimplemented and unclaimed; `LIC-6.2-003` is next and unstarted. |
| `LIC-EV-0011` | 2026-09-03 | `LIC-6.2-003`, `LIC-REQ-001`, `LIC-REQ-003` | Base `3d36967`; working tree; Phase 6.2.003 start record | Windows development workspace; Security Owner/implementer Codex; Product Owner Project Owner; independent Protocol and Security closure reviewers; exact Node `24.19.0`; no production Root/private key, persistent License state, Server admission, DB, Client, Guardian, Installer, Vendor service, K40 or clean-Windows work authorized | Intended gates: portable production core compiled under strict TypeScript; exact bounded CBOR/tag-18 COSE and all ten signed/three carrier schemas; ES256 P-1363 scalar/low-S/SPKI/kid checks; injected Root/delegated/device trust; purpose/environment/cumulative Denylist and Delegation rotation checks; finite term/SemVer/Feature/request/build/parent/control claim checks; immutable-context state preflight with zero side effects; all 41 positive vectors, 42 binary negatives, 90 cross-types and the frozen malformed corpus traced/executed at the applicable core seam; production-key/test-fixture import isolation; protocol/vector/Edition regressions and independent closure review | Start gate passed — both direct dependencies are complete and only `LIC-6.2-003` is `[~]`. The production core must use injected trust and may not import vector code or deterministic test keys. A validated artifact is not an admission decision: persistence, request consumption, trusted-time acquisition, runtime wiring, Vendor issuance, Guardian/Installer and Windows security evidence remain later items. Closure requires a later append-only Evidence row. |
| `LIC-EV-0012` | 2026-09-05 | `LIC-6.2-001` through `LIC-6.2-003`, `LIC-REQ-003` | Implementation checkpoint `b753adf`; erratum working tree | Windows development workspace; exact Node `24.19.0`; implementer Codex; independent Protocol reviewer `erratum_review` and Security reviewer `targeted_source_audit`; no production secret or runtime/storage/physical change | Previous exact `test:license-core-v1` exited `1`: 41/41 positives, 42/42 binary negatives, 90/90 cross-types and 675/680 owned descriptors; five contradictions were explicitly hard-failed. Protocol and Golden Vector gates passed their previous pins. Authorized correction is exactly `LIC-CHG-0011`; intended reruns include regenerated protocol/vector pins, 744 expanded malformed joins, 676 owned Core descriptors, retained activation PoP negatives, Edition regression and independent reviews. | Erratum authorized; previous failed Core gate is retained as evidence and never counted as closure. Activation proof-of-possession does not issue a License or authorize operation. This row starts correction work only; `LIC-6.2-003` remains `[~]` until a later passing closure row. |
| `LIC-EV-0013` | 2026-09-05 | `LIC-6.2-001` through `LIC-6.2-003`, `LIC-REQ-001`, `LIC-REQ-003` | Base `b753adf`; current tested working tree; compiled Licensing build digest `c2a3cc61d03be82039d125e66dcdbee86ae5c9a745a1a3a1d3df543c201dd558` | Windows development workspace; exact Node `24.19.0`; .NET SDK `10.0.400`; implementer Codex; independent Protocol and final Security reviewer `erratum_review`; independent Security reviewer `targeted_source_audit`; no hardware/DB/Guardian/Installer or clean-Windows execution | `npx.cmd --yes -p node@24.19.0 -c "npm.cmd run test:license-protocol-v1"`; equivalent exact-Node `test:license-golden-vectors`, `test:license-core-v1` and `npm.cmd --prefix server run test:edition-boundary`. Protocol: 224 descriptors, 744 expansions, 90 cross-types and 18-file manifest `512534732dce759da424ba0e8d8838c3d9c294e3faa02a4017212ce482523eab`. Vectors: 105 generated files reproduced; all CBOR/DER/CDDL/registry bytes unchanged; 129-file manifest `565a5efca1a1767a622a0d751a5937633018587f7cc463ce3e531ed9656fb99e`; index `b3c1a80cfdbbc80ffcb20403f9bd07419ff9f71bfe461a1b3c3ddb1d7dcbd597`; fresh Vendor/Node/.NET reports byte-identical at `ed196d8f03b9f1b2285245592d61967f3293b290b18cdb4c32405408a48b1e5c` (173 executed verdicts); path/ADS/namespace/no-overwrite guards and 1409-file test-key isolation scan pass. Core: strict TS build, 41/41 positives, 42/42 binary negatives, 90/90 cross-types, 676/676 descriptors, 12/12 PoP and 66/66 carrier/context/Rebind regressions; 18 production modules load without fixture/issuer/private-key modules. Edition: 36/36 stages including 37/37 component tests and 12/12 real-app browser tests. | **Passed after corpus correction and contextual remediation.** The five contradictory results in `LIC-EV-0012` are preserved, not suppressed. Preparation initially rejected stale documentation pins, .NET `MALFORMED_SOURCE_HASH`, and the production protocol-manifest constant; exact pins/mirrors were synchronized. The first contextual harness rejected duplicate test IDs (`56 !== 58`); unique type-qualified labels fixed it. Its focused pre-fix run then passed only 57/66: negative/numeric/string/NaN elapsed values were wrongly accepted, and Rebind confused old and local-new key snapshots. The runtime BigInt bound and separate immutable `previousDevice`/local-device checks fixed both while preserving chained A-to-B-to-C. A subsequent aggregate passed context 66/66 but rejected `MAL_RECOVERY_WRONG_TYPE::recovery: Unhandled schema replacement descriptor text`; the executor now materializes actual text and the exact aggregate passes 676/676. Temporary probe setup failures (invalid fixture index path, non-BigInt time and unsorted delegation bootstrap) were corrected before their successful probes. Both independent reviewers rechecked the source fixes; `erratum_review` independently bootstrapped production trust and passed 66/66, and `targeted_source_audit` independently confirmed new-key acceptance and old-key rejection. All final gates pass and no reviewed material blocker remains. The build digest is SHA-256 of compact JSON containing the 36 sorted `server/dist/licensing` entries as `{path,sha256,size}`; paths are repository-relative with forward slashes. This closes portable preflight only: 26 descriptor-only state/time/replay cases remain owned by LIC004/005/007; persistence, runtime admission, production issuance, Windows binding/storage and the cumulative Release Gate remain open. |
| `LIC-EV-0014` | 2026-09-05 | `LIC-6.2-004`, `LIC-REQ-001`, `LIC-REQ-005`, `LIC-REQ-007` | Branch `main`; base `10791e7` (LIC003 closure committed, clean worktree verified); implementation start | Windows development workspace; License Core Owner/implementer Codex; independent Security/Protocol reviewer `erratum_review`; independent test/code reviewer `targeted_source_audit`; exact Node `24.19.0`; no physical device needed | Intended `LIC-STATE`, `LIC-ROLLBACK`, `LIC-HYBRID` and `LIC-RECOVERY` deterministic tests: exact state priority and half-open terms; Offline/Hybrid pending and atomic pairs; no-shortening/lapsed successor; monotonic revisions, idempotency and collision; future/persistent Control; tamper versus ambiguous evidence; incident-scoped Recovery/Rebind; atomic Reactivation with permanent tombstones; immutable rejection and old-or-new crash model; all 18 owned STATE descriptors; production isolation and existing Core/Protocol/Golden regressions | Start gate passed; only LIC004 becomes `[~]`. Inputs representing trusted UTC/identity/anchors are adapter assumptions, not Windows evidence. Results are proposed pure model states, not committed runtime authority. Clock acquisition/Time Recovery, file/HTTPS workflows, secure persistence/anchors, audit outbox, runtime coordinator, Guardian and Windows release gates remain later items. A later evidence row and independent review are required before closure. |
| `LIC-EV-0015` | 2026-09-05 | `LIC-6.2-004`, `LIC-REQ-001`, `LIC-REQ-005`, `LIC-REQ-007` | WIP checkpoint `f744285`; subsequent tested working tree | Windows development workspace; exact Node `24.19.0`; implementer Codex; final independent closure review pending | `npx.cmd --yes -p node@24.19.0 -c "npm.cmd run test:license-state-v1"`: production build/Core regression, 59/59 projection cases, 29/29 signed model/ordering cases and 24/24 security cases including all 18 owned STATE descriptors. Core retains 676/676 descriptors, 41 positives, 42 binary negatives, 90 cross-types, 12 PoP and 66 contextual cases; 21 production modules load without fixture/private-key imports. Exact-Node protocol regression passes unchanged pins. `git diff --check` and pre-checkpoint Server typecheck pass. | Test checkpoint, not closure. Initial implementation typecheck failures involved TypeScript narrowing, deterministic-CBOR typing and exact optional fields; corrected before checkpoint. First aggregate passed projection 59/59, model 28/28 and security 24/24. Final rerun adds a bounded-input regression and passes model 29/29. Follow-up hardening narrows revoked-lineage retry to the exact final REVOKE acknowledgment, defensively copies proposal CAS hashes and rejects oversized signed command buffers before copy/hash. The crash test is an old-or-new store double, not physical power-loss evidence. Production persistence, trusted-clock acquisition, Windows anti-tamper, runtime admission, physical K40 and clean-Windows tests are not run or claimed. Independent final review remains required; LIC004 stays `[~]`, LIC005 stays `[ ]`. |
| `LIC-EV-0016` | 2026-09-05 | `LIC-6.2-004`, `LIC-REQ-001`, `LIC-REQ-005`, `LIC-REQ-007` | Base `f744285`; tested compiled Licensing digest `b66d1cdcb5a109c6aeb4fff74897d1758e61a3b857b7f8bc652654f87abaf9b3` | Windows development workspace; exact Node `24.19.0`; .NET SDK `10.0.400`; implementer Codex; independent final Security reviewer `state_final_review` | `npx.cmd --yes -p node@24.19.0 -c "npm.cmd run test:license-state-v1"`: strict production build, Core 676/676 descriptors, 41/41 positives, 42/42 binary negatives, 90/90 cross-types, 12/12 PoP, 66/66 context; projection 59/59, model 31/31, security 27/27 including all 18 owned STATE descriptors. Independent reviewer separately executes security 27/27 on rebuilt production code with exact Node. Golden aggregate includes Protocol regression; protocol/vector pins unchanged. `git diff --check` passes. | Passed after preserving a concrete review failure: two different Reactivation artifacts with identical token IDs were accepted because both checked only the prior receipts. Independent probe failed 24/25; permanent expanded security runner failed 26/27 with `TOKEN_ID_COLLISION: candidate unexpectedly accepted`. Add an explicit intra-transaction ID collision check before either artifact is consumed; final aggregate and independent rerun pass. An initial ad hoc probe had a PowerShell quoting SyntaxError and was rerun via stdin before the valid failing result; it is not counted as a product failure. New cases exercise current/pending Recovery, Hybrid full/missing/future Reactivation sets, persistent Control and equal-revision staging. No remaining material reviewer blocker. Digest is SHA-256 of compact JSON for 42 sorted compiled Licensing entries `{path,sha256,size}` with repository-relative forward-slash paths. No runtime wiring changed; Edition/Backup/K40 gates were not rerun for this isolated pure-core change. Physical storage, Windows protection, clock acquisition, runtime admission and power-loss evidence remain later gates. LIC005 stays unstarted. |
| `LIC-EV-0017` | 2026-09-05 | `LIC-6.2-005`, `LIC-REQ-006`, `LIC-OPEN-010` | Clean baseline `184f228`; documentation-only entry inspection | Windows development workspace; entry inspector/proposed implementer Codex; Product/Security clarification and closure reviewer assignment required before coding | Read-only inspection of master sections 4.2 and 8, frozen Time-Correction replay descriptor, expanded vector join, existing `assertStatePreflight` and trusted-time/request snapshot types. No production code, schema, corpus, clock, state store, runtime or hardware mutation; no new test execution claimed. | Entry blocked, not a test regression: exact-retry wording and consumed-token rejection do not yet define a consistent acceptance seam for LIC005. Record `LIC-OPEN-010` and request direction before implementing one interpretation. Preserve existing LIC004 closure and all frozen protocol/vector bytes; no decision has been changed or assumed approved. |
| `LIC-EV-0018` | 2026-09-05 | `LIC-6.2-005`, `LIC-REQ-006`, `LIC-OPEN-010` | Base `184f228`; working tree | Windows development workspace; implementer Codex; independent Security closure review required; portable model only | Intended exact-Node time tests: UTC/tolerance/backward/forward/same-boot/restart/sleep evidence, offline correction freshness/incident/revision/replay, read-only duplicate acknowledgement, signed online time bootstrap and atomic reevaluation with existing locks preserved; all five owned STATE descriptors; Core/State/Protocol/Golden regression and production isolation | Start only: user resolved the retry-layer ambiguity. No production runtime, Windows clock/TPM acquisition, storage, HTTPS or UI implementation is claimed. No second correction or lock clearing is authorized by a receipt lookup. Later evidence is required before LIC005 closure. |
| `LIC-EV-0019` | 2026-09-05 | `LIC-6.2-005`, `LIC-REQ-006`, `LIC-OPEN-010` | Base `184f228`; tested 44-file compiled Licensing digest `364e105dab0f2651f95db42947596bb269e9930e04d69dfd27df5192154a00c8`; commit pending | Windows development workspace; exact Node `24.19.0`; .NET SDK `10.0.400`; implementer Codex; independent Security closure review pending | `npx.cmd --yes -p node@24.19.0 -c "npm.cmd run test:license-time-v1"`: production build, Core 676/676 descriptors plus 41 positives/42 binary negatives/90 cross-types/12 PoP/66 context, State 59+31+27 = 117/117, Time 39/39 including all five owned STATE descriptors. Production graph has 22 isolated modules. Exact-Node `test:license-golden-vectors` includes passing Protocol regression, unchanged pins, 105 byte-identical regenerated files, 173 identical Vendor/Node/.NET verdicts, path/ADS hardening and a 1421-file production isolation scan. `git diff --check` passes. | Passing implementation checkpoint, not closure. First time aggregate passed 35/35. Inspection then added four regressions and fixed generation churn during locked observations and fractional-time loss on frequent sub-second samples; final Time result is 39/39. Initial Golden run failed `Security mirror is stale` because the previous mirror rewrite omitted its existing protocol-baseline summary; restore the true 224-descriptor/independent-review baseline text and rerun successfully without changing the scanner or protocol bytes. Exact duplicate acknowledgement is read-only; strict application still rejects replay. No new production keys, Windows clock/store/HTTPS/UI/runtime integration, physical K40 or Edition/Backup regression was executed or claimed. Build digest is SHA-256 of compact JSON containing sorted repository-relative forward-slash entries {path,sha256,size}. Request/clock evidence acquisition and the cross-boot absolute-time limitation remain explicit. LIC005 remains `[~]` pending independent review; LIC006/007 are not started. |
| `LIC-EV-0020` | 2026-09-08 | `LIC-6.2-005`, `LIC-REQ-006`, `LIC-OPEN-011` | Committed checkpoint `41fdf18`; subsequent test/documentation-only review | Windows development workspace; exact Node `24.19.0`; local reviewer/implementer Codex, not an independent reviewer; no Windows clock changes, DB, hardware or runtime admission | Review reproducer: `node scripts/test-license-time-review-v1.mjs` under pinned Node, with fixture-only signed requests/corrections and real production core. FULL and ATTENDANCE each accept same-boot forward-jump repair but reject the same repair after boot identity changes: `2/4`, exit `1`. High-water moves from `1800001000` to `1863245800`, projection becomes `EXPIRED_LOCKED`, and fresh incident-bound signed correction returns `CLAIMS/TIME_CORRECTION_BELOW_HIGH_WATER`. Reject preserves prior state. | Failed closure check, not a resolved defect. Earlier Time 39/39 tests do not cover this recovery failure and cannot prove closure. The script deliberately asserts repair success and remains red instead of blessing the faulty rejection. `LIC-OPEN-011` records the unresolved security/availability policy; LIC005 becomes `[!]`, LIC006/007 remain unstarted. No production policy, frozen schema/corpus or acceptance code is changed in this review. A reviewed Product/Security resolution, permanent passing regressions and independent review are required before closure. |
| `LIC-EV-0021` | 2026-09-08 | `LIC-6.2-005`, `LIC-OPEN-011` | `41fdf18` production source; review-only worktree | Exact cached Node `24.19.0`, Windows development workspace; local Codex review only | Fresh `node scripts/test-license-time-v1.mjs` rebuild passes Core 676/676 descriptors plus 41/42/90/12/66 baseline cases, State 117/117 and Time 39/39, exit 0. Rerunning `node scripts/test-license-time-review-v1.mjs` against that rebuilt core again yields exactly 2/4 and both `CLAIMS/TIME_CORRECTION_BELOW_HIGH_WATER` failures. `node scripts/test-license-protocol-v1.mjs` passes unchanged 224-descriptor/90-cross-type/18-file pins; `git diff --check` passes. | Confirms the review failure is not a stale build or baseline test regression. No production source changed after the checkpoint. Blocker remains unresolved; no independent review, real Windows time experiment, Golden/Edition/Backup/K40 rerun or release closure is claimed for this review-only change. |
| `LIC-EV-0022` | 2026-09-08 | `LIC-6.2-005`, `LIC-OPEN-011`, `LIC-CHG-0016` | Base `41fdf18`; documentation and non-production acceptance-test worktree only | Windows development workspace; exact cached Node `24.19.0`; implementer/local design reviewer Codex; independent Security reviewer not yet assigned for remediation | `node scripts/test-license-time-review-v1.mjs` under pinned Node: expanded result `14/16`, exit `1`. Both Editions pass all six new availability/expiry scenarios and same-boot repair; both original cross-boot repair failures remain exactly `CLAIMS/TIME_CORRECTION_BELOW_HIGH_WATER`. No production source, system clock, DB, keys or runtime integration changed. | Product requirements are now recorded in section 8 and the proposed split/interaction review matrix in 8.1?8.2. The green availability cases are preservation tests, not proof of a repaired clock model. A local source inspection identified future-pair promotion, scheduled Control/tombstones and indirect time-floor advancement as required design-review interactions, not newly executed defect verdicts. Security review is required before the replacement state-transition contract is implemented. LIC005 remains `[!]`; LIC006/007 remain unstarted. |
| `LIC-EV-0023` | 2026-09-08 | `LIC-6.2-005`, `LIC-OPEN-011`, `LIC-CHG-0016` | Base `41fdf18`; documentation/review-test working tree | User-authorized independent Security design reviewer `time_design_review`; local complementary reviewer Codex; Windows development workspace; cached Node `24.19.0` | Independent reviewer read the entire master and relevant source/tests, then independently ran `node scripts/test-license-time-review-v1.mjs`: `14/16`, exit `1`, both cross-boot repairs fail `CLAIMS/TIME_CORRECTION_BELOW_HIGH_WATER`. Separate main-agent stdin fixture probe in both Editions: start at UTC `1800001000`, import a signed REVOKE effective at now+86400 (zero tombstones), observe a new boot at now+172800, then obtain one tombstone and `REVOKED_LOCKED`. The independent reviewer inspected this interaction but did not independently execute that additional probe. | Design review completed, **not approved for implementation**. Findings: irreversible promotion/tombstones, unresolved future-enabling evidence policy, laundering of provisional wall time through epochs/ordinary trustedNow, and unsafe reinterpretation of old poisoned state. Section 8.3 records the recommendation for explicit Product approval; ordinary reboot/months availability remains approved, not reopened. No source, signed protocol, keys, OS clock, DB or runtime changed. LIC005 stays `[!]`; no closure or dependent work. |
| `LIC-EV-0024` | 2026-09-08 | `LIC-6.2-005`, `LIC-OPEN-011`, `LIC-CHG-0017` | Base `41fdf18`; existing review/docs worktree preserved | Implementer Codex; independent Security reviewer `time_design_review`; exact Node `24.19.0`; pure model only | Planned corroborated-floor/observed-calendar epochs, guarded promotion/control, ordinary command provenance, signed repair and permanent both-Edition negative tests. Product resolved the future-enabling tradeoff. Existing 14/16 failing checkpoint remains historical. | Start only, not a passing result. Detailed contract is undergoing independent review before production edits. No runtime/Windows store/clock/HTTPS integration, legacy-state migration or new wire schema is authorized or claimed. LIC005 remains open until a later tested review result; LIC006/007 remain unstarted. |
| `LIC-EV-0025` | 2026-09-08 | `LIC-6.2-005`, `LIC-OPEN-011` | Base `41fdf18`; intermediate remediation source/emitted core | Implementer Codex; independent Security reviewer `time_design_review`; exact Node `24.19.0` | Initial aggregate passed Time39, lifecycle30, review16 and State/Core baseline, but independent probes exposed two additional flaws. Provisional lapse accepted narrowed successors: FULL Features23 to22, ATTENDANCE4 to3; reviewer injected negatives produced24/26. Direct newboot recovery delivered600s after its incident accepted floor1800001001 instead of justified1800001600 in both Editions. Main permanent expanded36-case runner against the pre-fix emitted core failed32/36 with exactly those four Edition-specific assertions. | Preserve failures, not closure. Fix no-shortening using candidate-corroborated time only after complete signature/request verification and before receipts/promotion. On missing/newboot incident establish a floor-only epoch at incident tick with carried fraction and no invented Vendor time; preserve the sameboot epoch and frozen incident floor. Final build and independent rerun are recorded separately in EV0026. No protocol/corpus negative was removed or weakened. |
| `LIC-EV-0026` | 2026-09-08 | `LIC-6.2-005`, `LIC-OPEN-011`, `LIC-REQ-006` | Base `41fdf18`; final 44-file compiled Licensing digest `c9ef040778389e2bcb7fd6ea89c5b720c9e0490d5af03b644f6944f9fb86475a`; closure commit pending | Windows development workspace; exact cached Node `24.19.0`, .NET SDK `10.0.400`; implementer Codex; independent Security reviewer `time_design_review` | `node scripts/test-license-time-v1.mjs` under pinned Node rebuilds production and passes Core676/676 descriptors plus41 positives/42 binary negatives/90 cross-types/12 PoP/66 context, State59+31+27=117, Time39/39, lifecycle36/36 and review16/16. Reviewer independently reruns final emitted lifecycle36 and review16, both exit0, and reports no remaining material portable-code blocker. `node scripts/test-license-golden-vectors.mjs` passes Protocol,105 byte-identical regenerated files,173 identical Vendor/Node/.NET verdicts, namespace/path/ADS guards and1421-file production isolation scan; unchanged129-file manifest565a5efca1a1767a622a0d751a5937633018587f7cc463ce3e531ed9656fb99e. | Passing portable closure after both review fixes; EV0020-0025 remain historical failures/checkpoints. Digest is SHA-256 of compact JSON containing44 sorted repository-relative forward-slash compiled Licensing entries {path,sha256,size}. No Windows clock/TPM/store acquisition, durable transaction, legacy-state rehydration/migration, production key, UI/HTTPS/runtime admission, physical K40 or clean-Windows evidence is claimed. Edition/Backup gates were not rerun because production integration was untouched. LIC005 and OPEN011 close; LIC006/007 remain unstarted. |
| `LIC-EV-0027` | 2026-09-08 | `LIC-6.2-006`, `LIC-REQ-002`, `LIC-REQ-007` | Clean committed baseline e49630a; LIC006 start | Implementer Codex; acceptance reviewer Project Owner; independent Security closure reviewer must be assigned before closure; exact Node24.19.0; portable workflow adapters only | Planned bounded byte intake, explicit expected object type, independently verified stored request bytes, purpose/state matching, atomic complete reactivation proposal, invalid-candidate neutrality, duplicate acknowledgement, safe adapter failure and both-Edition tests. | Start, not completion: first slice does not create/sign/export requests, open user paths, acquire Windows identity, implement a protected request store, consume requests durably or grant runtime authority. Actual filesystem reparse/hardlink/TOCTOU enforcement, request creation and durable workflow completion remain required before LIC006 closure. No permissive filesystem fallback is introduced. |
| `LIC-EV-0028` | 2026-09-08 | `LIC-6.2-006` | Base e49630a; 46-file compiled Licensing digest `d8a5261bbe448118fb7b30f702e52b513c13dabf8c2ef4d6c19bc30deff9c597`; first-slice worktree | Windows development workspace; exact cached Node24.19.0; .NET SDK10.0.400; implementer Codex; no independent LIC006 closure review yet | `node scripts/test-license-offline-v1.mjs` rebuilds production and passes Offline38/38 across both Editions, Core676/676 descriptors plus41 positives/42 binary negatives/90 cross-types/12 PoP/66 context, State117/117, Time39/39, lifecycle36/36 and availability16/16. Separate `node scripts/test-license-golden-vectors.mjs` passes Protocol,105 byte-identical regenerated files,173 matching Vendor/Node/.NET verdicts, path/namespace/ADS guards and1424-file production source/artifact isolation; frozen129-file manifest unchanged. Server typecheck and `git diff --check` pass. | Passing bounded-import planning checkpoint only. Tests cover activation/duplicate/control proposals, size/type/request/store/signature/provenance failures, redaction, async candidate-copy integrity and concurrent non-committing plans. Complete Recovery/Time-Correction/reactivation workflow positives, request creation/signing/export, protected-reader/commit adapters, receipt durability, real safe filesystem intake, Rebind and integration remain unproven. LIC006 still `[~]`; production Guardian/Store/Windows/runtime work remains at its owning later gates. No OS clock, DB, device or live License was changed. Digest hashes compact JSON of sorted repository-relative forward-slash {path,sha256,size} entries. |
| `LIC-EV-0029` | 2026-09-08 | `LIC-6.2-006`, `LIC-REQ-002` | Base `7435dc8`; request-generation worktree | Implementer Codex; acceptance reviewer Project Owner; independent Security closure reviewer still required; Windows development workspace, portable installation/registration adapters only | ACTIVATE/RENEW creation, finite request window, exact device/build/state/predecessor binding, CSPRNG adapter, low-S installation signature recheck, TPM context/no-downgrade, compare-state/no-overwrite registration and exact-byte export retry tests planned alongside implementation. | In-progress checkpoint, not closure. Initial TypeScript check failed on optional devicePublicKey, index-signature access and missing deterministic-CBOR tag discriminator; corrected before aggregate rerun. No production signer, TPM/CSPRNG provider, filesystem export, durable store, runtime, DB, OS clock or physical device changed. Test outcomes are recorded in the following evidence row. |
| `LIC-EV-0030` | 2026-09-08 | `LIC-6.2-006`, `LIC-REQ-002` | Base 7435dc8; 48-file compiled Licensing digest `f110ba9c19cbbd0f8873645664151a8fbc511a3f202de066c2353291eca5d90d`; request slice uncommitted | Windows development workspace; exact cached Node24.19.0; .NET SDK10.0.400; implementer/local reviewer Codex; no independent LIC006 closure review | Exact Node `scripts/test-license-offline-v1.mjs` rebuilds production and passes import38/38, request44/44 (both Editions), Core676/676 descriptors plus41 positives/42 binary negatives/90 cross-types/12 PoP/66 context, State117, Time39/lifecycle36/availability16. Exact Node `scripts/test-license-golden-vectors.mjs` passes Protocol,105 byte-identical regenerated files,173 identical Vendor/Node/.NET verdicts and1427-file production isolation; frozen129-file vector manifest unchanged. `npm.cmd run typecheck` in server and `git diff --check` pass. | Initial aggregate passed all44 new cases but exited1 because the already-running launcher still expected32 while test coverage was expanded; preserved failure `44 !== 32`. Clean final launcher rerun expects44 and exits0. Test doubles prove registration-before-export, no-overwrite ID/nonce collisions, CAS conflict, exact-byte retry, neutral provider failures, TPM context/no fallback, high-S normalization, mutation/provenance defenses, highest-pending renewal and generated-request/response/replay binding. This is portable contract evidence only: no production CSPRNG/CNG/TPM signer, hardware attestation proof, protected store, physical file intake/export, restart rehydration, receipt durability, UI/API/runtime, DB or real K40. No independent closure or full LIC006 completion. Digest hashes compact JSON of48 sorted repository-relative forward-slash {path,sha256,size} entries. |
| `LIC-EV-0031` | 2026-09-08 | `LIC-6.2-006`, `LIC-REQ-002`, `LIC-REQ-005` | Clean committed baseline `67f9867` | Implementer Codex; acceptance reviewer Project Owner; independent Security closure reviewer remains required | Start the narrowly scoped Entitlement response completion adapter: existing import preflight followed by complete-state CAS/obligation handoff, exact acknowledgement, conflict/pending/unknown-outcome handling and read-only duplicate confirmation. Planned both-Edition generated-request/response tests include active/future/lapsed renewal, invalid-candidate neutrality, races, failed writes and lost acknowledgements. | Start, not closure. No new signed schema, commercial/time/transition policy, physical store or runtime authority. In-memory registration/state doubles model all-old/all-new outcomes but cannot prove flush, anchors, Windows ACL, crash recovery or process-restart rehydration. Other response purposes and independent closure remain open. |
| `LIC-EV-0032` | 2026-09-08 | `LIC-6.2-006`, `LIC-REQ-002` | Base 67f9867; intermediate completion worktree/emitted code | Implementer/local reviewer Codex; exact cached Node24.19.0; no independent review | Initial `scripts/test-license-offline-v1.mjs` passed import38, request44, completion32 and full Core/State/Time baseline. Local review then expanded completion to36 cases and ran `runLicenseOfflineCompletionTests` against that emitted production code via Node stdin:32/36, exit1. FULL and ATTENDANCE each incorrectly acknowledged a previously imported response when selecting a different request, or when its archived signed request was replaced with same ID/different nonce. All four assertions failed with `true !== false`. | Concrete workflow correlation defect, not forged authority: the core's authenticated receipt shortcut made no new mutation, but the workflow could acknowledge the wrong request. Added exact Entitlement response requestId/requestHash matching against independently verified request bytes before delegating to core. No signed schema, crypto trust, time/transition or commercial rule changes. Final rebuilt evidence follows separately. |
| `LIC-EV-0033` | 2026-09-08 | `LIC-6.2-006`, `LIC-REQ-002`, `LIC-REQ-005` | Base67f9867; 50-file compiled Licensing digest `5650f70164a21d4c71484495be0ba4c86f8ebe66027d802cd989bc9e21151cde`; completion slice uncommitted | Windows development workspace; exact cached Node24.19.0; .NET SDK10.0.400; implementer/local reviewer Codex, no independent LIC006 closure review | Exact Node `scripts/test-license-offline-v1.mjs` rebuilds production and passes import38/38, request44/44, completion36/36, Core676/676 descriptors plus41 positives/42 binary negatives/90 cross-types/12 PoP/66 context, State117, Time39/lifecycle36/availability16. Exact Node `scripts/test-license-golden-vectors.mjs` passes Protocol,105 byte-identical regenerated files,173 identical Vendor/Node/.NET verdicts and1430-file production isolation; frozen129-file vector manifest unchanged. Server `npm.cmd run typecheck` and `git diff --check` pass. | Passed portable checkpoint after the four EV0032 failures were fixed; they remain permanent both-Edition tests. Completion tests cover generated-request activation, consumption/receipt/complete-state handoff, exact archived-request retry, invalid candidate neutrality, failed/pending/mismatched/lost acknowledgements, CAS races, future/immediate/lapsed renewal and no-shortening. All-old/all-new behavior is a store double only. No production store/flush/anchor/ACL, real process-restart rehydration, filesystem/UI/API/runtime integration, production key, DB, real K40 or physical power-loss test was performed. Other request/response purposes and independent review remain open; no LIC006 or release closure. Digest hashes compact JSON of50 sorted repository-relative forward-slash {path,sha256,size} entries. |
| `LIC-EV-0034` | 2026-09-08 | `LIC-6.2-006`, `LIC-REQ-007` | HEAD67f9867 plus preserved uncommitted EV0033 completion checkpoint | Implementer Codex; acceptance reviewer Project Owner; independent closure reviewer still required | Start portable CONTROL request generation and Offline-Control response completion, reusing frozen action/reason/time/request binding, existing state transitions and complete-state CAS obligations. Planned both-Edition tests cover request-bound and Vendor-initiated delivery, suspend/unsuspend/terminal revoke, exact historical correlation, replay, future effect and failed/pending commit acknowledgement. | Start, not closure. No new commercial, time, wire or state-transition rule; no live customer License, Vendor service, Windows storage, device, runtime or production key operation. Prior uncommitted changes are preserved; this request does not authorize a new Git commit. |
| `LIC-EV-0035` | 2026-09-08 | `LIC-6.2-006`, `LIC-REQ-007` | HEAD67f9867 plus preserved EV0033 and new Control worktree | Implementer/local reviewer Codex; exact Node24.19.0 aggregate; Windows development workspace | Initial server typecheck and aggregate build failed with TS2339: generic Extract input did not expose kind on every generic branch. Replaced it with an exact keyed input map retaining separately typed ENTITLEMENT/CONTROL surfaces; no widening to other purposes. Aggregate build had started before that fix and exited1 with the same compiler failure. | Preparation failure retained; no test or closure success claimed by this row. Final rebuilt Control/Core/State/Time/Protocol/Golden evidence follows separately. |
| `LIC-EV-0036` | 2026-09-08 | `LIC-6.2-006`, `LIC-REQ-007` | HEAD67f9867 plus preserved uncommitted EV0033 and Control slice; 50-file compiled Licensing digest `5e1f7eddfccf026c1031a2fabf42afc79c21435d9de005d5919fa258a9702fe4` | Windows development workspace; exact cached Node24.19.0; .NET SDK10.0.400; implementer/local reviewer Codex, no independent closure review | Exact Node `scripts/test-license-offline-v1.mjs` rebuild passes import38/38, request44/44, Entitlement completion36/36 and Control36/36 in both Editions, plus Core676 descriptors and41 positives/42 binary negatives/90 cross-types/12 PoP/66 context, State117, Time39/lifecycle36/availability16. Exact Node `scripts/test-license-golden-vectors.mjs` passes Protocol,105 byte-identical regenerated files,173 identical Vendor/Node/.NET verdicts and1430-file production isolation; frozen129-file vector manifest unchanged. Server `npm.cmd run typecheck` and `git diff --check` pass. | Passing portable checkpoint after EV0035 compile remediation. The previous unsupported-purpose test now targets still-unimplemented RECOVER instead of newly supported CONTROL; strict CONTROL input validation has new tests. Coverage includes no-effect request creation, exact signed action/time/reason/lineage, Vendor-initiated no-request delivery, suspend/unsuspend/terminal-revoke preservation, future Control, exact duplicates/origin/ID/hash, wrong signer/tamper, reused revisions, pending/lost acknowledgements and concurrent CAS. No production key, live License, Vendor service, Windows storage/ACL/process barrier, hardware, DB, UI/API/runtime or physical power-loss work was run. Remaining Recovery/Rebind/Time-Correction/Reactivation integration and independent review stay open; LIC006 is not complete. Digest hashes compact JSON of50 sorted repository-relative forward-slash {path,sha256,size} entries. |
| `LIC-EV-0037` | 2026-09-08 | `LIC-6.2-006`, `LIC-REQ-007` | Clean baseline6c9fb09 | Implementer Codex; acceptance reviewer Project Owner; independent closure reviewer required | Start RECOVER request generation from factory-owned current Entitlement/incident/state and a separately closed Recovery completion facade using existing strict single-use core transitions. Planned both-Edition request/response, pending-parent, wrong incident/state/transition/key, commercial-lock preservation and failed/unknown commit tests. Synchronize stale live summaries without rewriting historical logs. | Start only. REBIND, Time-Correction and terminal-lineage reactivation remain separate workflows; no new replay acknowledgement or state/crypto/commercial policy. No physical storage/Guardian/key/DB/runtime changes. |
| `LIC-EV-0038` | 2026-09-08 | `LIC-6.2-006`, `LIC-REQ-007` | Base6c9fb09; RECOVER slice uncommitted; 50-file compiled Licensing digest `a6bc75881b9a3e08d31c3e9cb11415766f614b4bc9d1dd7e49cb04135cc3012d` | Windows development workspace; exact cached Node24.19.0; .NET SDK10.0.400; implementer/local reviewer Codex, no independent closure review | Exact Node `scripts/test-license-offline-v1.mjs` rebuild passes import38/38, request44/44, Entitlement36/36, Control36/36 and Recovery36/36 (18 cases per Edition), plus Core676 descriptors and41 positives/42 binary negatives/90 cross-types/12 PoP/66 context, State117, Time39/lifecycle36/availability16. Exact Node `scripts/test-license-golden-vectors.mjs` passes Protocol,105 byte-identical regenerated files,173 identical Vendor/Node/.NET verdicts and1430-file production isolation; frozen129-file vector manifest unchanged. Server `npm.cmd run typecheck` and `git diff --check` pass. | Passing portable checkpoint. Tests cover incident-derived claims, current versus pending parent, independent tamper/storage locks, finite expiry/suspension/terminal-revoke preservation, wrong incident/state/request/signer/transition, strict replay, pending/failed/lost acknowledgement and concurrent CAS. Unsupported-purpose regression now targets still-unimplemented REBIND. No production key, live License, protected Windows storage, physical file workflow, restart/power-loss, UI/API/runtime, DB or K40 work. Lost-ack durable reconciliation, Rebind/Time-Correction/Reactivation and independent review remain open; LIC006 is not complete. Digest hashes compact JSON of50 sorted repository-relative forward-slash {path,sha256,size} entries. |
| `LIC-EV-0039` | 2026-09-08 | `LIC-6.2-006`, `LIC-REQ-004`, `LIC-REQ-007` | Clean baseline97a6d02 | Implementer Codex; acceptance reviewer Project Owner; independent closure reviewer still required | Start REBIND generation and separately closed import/completion with trusted staged-device acquisition. Planned both-Edition new-key PoP, old-key/current-parent correlation, chain, TPM/no-downgrade, malformed/wrong-purpose/device/incident/replay neutrality and atomic/unknown commit tests. | Start only; preserve frozen schemas and core transitions. No production key/store, OS wipe/Backup rehydration, runtime or physical transfer is authorized by this portable checkpoint. |
| `LIC-EV-0040` | 2026-09-08 | `LIC-6.2-006` | Base97a6d02; intermediate REBIND worktree | Exact Node24.19.0; implementer/local reviewer Codex | First aggregate passed all prior Core/State/Time/import/request/Entitlement/Control/Recovery suites and REBIND40/40, but exited1 at launcher assertion `40 !== 32`: coverage was expanded during the already-running launch, which retained its initial expected count32. | Runner synchronization failure, not a passing aggregate. Final launcher expects40 and a clean full rebuild/rerun follows. No production state or wire change; failure retained. |
| `LIC-EV-0041` | 2026-09-08 | `LIC-6.2-006`, `LIC-REQ-004`, `LIC-REQ-007` | Base97a6d02; REBIND slice uncommitted; 52-file compiled Licensing digest `34a1f505d0d430cb7b5f93204a67b037d0a6ed98945e0f43f2689bdd8d940186` | Windows development workspace; exact cached Node24.19.0; .NET SDK10.0.400; implementer/local reviewer Codex, no independent closure review | Clean final exact-Node `scripts/test-license-offline-v1.mjs` rebuild exits0: import38/request44/Entitlement36/Control36/Recovery36/Rebind40, Core676 descriptors plus41 positives/42 binary negatives/90 cross-types/12 PoP/66 context, State117, Time39/lifecycle36/availability16. `scripts/test-license-golden-vectors.mjs` passes Protocol,105 byte-identical regenerated files,173 identical Vendor/Node/.NET verdicts and1433-file production isolation; frozen129-file vector manifest unchanged. Server `npm.cmd run typecheck` and `git diff --check` pass. | Passing portable checkpoint after EV0040 launcher count correction. Twenty cases per Edition cover new-key proof, A-B-C history, preserved parent/expiry/pending/counters/suspension/tamper, terminal-revoke denial, provider/assurance/TPM/no-fallback, wrong key/incident/transition/Edition/signature/request, async snapshot, replay, concurrent CAS and pending/failed/lost acknowledgement. TPM evidence uses doubles, not hardware validation. No real key/store/filesystem/Backup transfer/OS wipe/remote disable/runtime/DB/K40 or independent review. Lost-ack durability, Time-Correction/Reactivation and platform work remain open; LIC006 is not complete. Digest hashes compact JSON of52 sorted repository-relative forward-slash {path,sha256,size} entries. |
| `LIC-EV-0042` | 2026-09-08 | `LIC-6.2-006`, `LIC-REQ-006` | Clean baseline91b4771 | Implementer Codex; acceptance reviewer Project Owner; independent closure reviewer required | Start incident-derived TIME_CORRECT requests with trusted boot/tick evidence registration, closed complete-state completion and exact read-only duplicate confirmation. Both-Edition wrong incident/request/floor/boot/revision/signature, independent-lock, failed/unknown commit and replay tests planned. | Start only; no production clock/store/key, runtime, DB or K40 changes. LIC006 remains open. |
| `LIC-EV-0043` | 2026-09-08 | `LIC-6.2-006`, `LIC-REQ-006` | Base91b4771; TIME_CORRECT slice uncommitted; 52-file compiled Licensing digest `9e007170a334eb2de91c8e055395a96a65959a2c30c5e4e496862af1de401ac9` | Windows development workspace; exact cached Node24.19.0; .NET SDK10.0.400; implementer/local reviewer Codex, no independent closure review | Exact Node `scripts/test-license-offline-v1.mjs` rebuild exits0: import38/request44/Entitlement36/Control36/Recovery36/Rebind40/TimeCorrection32; Core676 descriptors plus41 positives/42 binary negatives/90 cross-types/12 PoP/66 context, State117, Time39/lifecycle36/availability16. `scripts/test-license-golden-vectors.mjs` passes Protocol,105 byte-identical regenerated files,173 identical Vendor/Node/.NET verdicts and1433-file production isolation; frozen129-file vector manifest unchanged. Server `npm.cmd run typecheck` and `git diff --check` pass. | Sixteen cases per Edition cover derived request/evidence, bad boot/tick/provider, atomic correction, exact read-only duplicate and unchanged core replay rejection, archived ID/hash correlation, unavailable/pending/bad confirmation, wrong incident/floor/revision/device/signature, receipt freshness, wrong evidence hash, failed/lost-ack/concurrent commit, independent storage restriction and expired License. Earlier core time suites retain commercial/tamper/future-enabling regression. No production OS clock change/acquisition, safe filesystem, protected store/receipt rehydration, runtime, DB, real K40 or independent closure. Actual durability/reconciliation and Reactivation remain open; LIC006 not complete. Digest hashes compact JSON of52 sorted repository-relative forward-slash {path,sha256,size} entries. |
| `LIC-EV-0044` | 2026-09-08 | `LIC-6.2-006`, `LIC-REQ-007` | Clean baseline9703e13 | Implementer Codex; acceptance reviewer Project Owner; independent closure reviewer required | Start REACTIVATE request generation from existing sealed incident/tombstone and closed complete-pair completion. Planned both-Edition valid pair, missing half, wrong signer/request/incident/lineage, replay, immutable tombstones, independent locks, Hybrid rejection and failed/unknown/concurrent commit tests. | Start only; no real License, Vendor signing key, protected storage, clock, DB, device or runtime mutation. LIC006 remains open. |
| `LIC-EV-0045` | 2026-09-08 | `LIC-6.2-006`, `LIC-REQ-007` | Base9703e13; REACTIVATE slice uncommitted; 52-file compiled Licensing digest `d3bea1ffb7fea7c7b3312d0c8dbbc0d5aea23902adb2f293ccadf3149198b988` | Windows development workspace; exact cached Node24.19.0; .NET SDK10.0.400; implementer/local reviewer Codex, no independent closure review | Exact Node `scripts/test-license-offline-v1.mjs` rebuild exits0: import38/request44/Entitlement36/Control36/Recovery36/Rebind40/TimeCorrection32/Reactivation28; Core676 descriptors plus41 positives/42 binary negatives/90 cross-types/12 PoP/66 context, State117, Time39/lifecycle36/availability16. `scripts/test-license-golden-vectors.mjs` passes Protocol,105 byte-identical regenerated files,173 identical Vendor/Node/.NET verdicts and1433-file production isolation; frozen129-file vector manifest unchanged. Server `npm.cmd run typecheck` and `git diff --check` pass. | Fourteen cases per Edition cover incident/tombstone-derived request, absent revocation/incident, atomic pair/new lineage/immutable tombstone/old-token denial, missing half, wrong intent/incident/revoke/pair/generation/features/signer/device/request, token collision, replay/lost acknowledgement, failed/pending/mismatched acknowledgement, concurrent CAS, preserved storage restriction and future/Hybrid incomplete-pair rejection. Unsupported-purpose regression now uses UNKNOWN because all seven frozen activation purposes have request support. No production key/store, file/Windows/DB/runtime/physical device or independent closure evidence. HYBRID complete reactivation remains LIC007; safe file adapters, durable reconciliation and LIC006 closure review remain open. Digest hashes compact JSON of52 sorted repository-relative forward-slash {path,sha256,size} entries. |
| `LIC-EV-0046` | 2026-09-08 | `LIC-6.2-006` | HEAD9703e13 plus preserved EV0045 uncommitted worktree | Implementer Codex; acceptance reviewer Project Owner; independent closure reviewer still required | Start remaining-obligations audit against request/import/completion/staged-device interfaces, master requirements and later platform/storage gates. | Documentation/contract work only. Do not confuse portable completion with Windows file safety or durability; no production key, file, State, DB or runtime change. |
| `LIC-EV-0047` | 2026-09-08 | `LIC-6.2-006`, `LIC-REQ-005`, `LIC-REQ-007` | HEAD9703e13 plus preserved EV0045 worktree; documentation-only follow-up | Implementer/local reviewer Codex; acceptance reviewer Project Owner; no independent closure review | Source audit of offline request/import/completion/staged-device seams and State/Time ownership. Added ten uniquely identified planned acceptance cases and explicit physical-evidence requirements. Exact Node24.19.0 `scripts/test-license-protocol-v1.mjs` passes. Read-only Node document check passes ten unique planned IDs, four existing source seams and explicit not-executed labeling; `git diff --check` passes. All four status mirrors synchronized. | Audit/contract checkpoint only, no new runtime implementation or new execution of the offline/Golden/platform suites. EV0045 remains the prior code-test evidence. Real file/ACL/durability/restart tests are NOT executed; no OS/private key/License/DB/K40 change. Next bounded implementation is portable safe-intake/export orchestration with fake-adapter tests, while native acquisition/provider validation and Store/Guardian remain their owning gates. No gate/dependency waiver, independent closure or new commit. |
| `LIC-EV-0048` | 2026-09-08 | `LIC-6.2-006` | HEAD9703e13 plus preserved EV0045/0047 worktree | Implementer Codex; acceptance reviewer Project Owner; independent closure reviewer required | Start portable file orchestration: explicit intent, bounded copied intake before planner, all Reactivation bytes before planning, registered exact request export and exact publication acknowledgement. Fake-adapter positive/negative tests and prior regressions required. | No native file opens, protected store, runtime authority, physical safety claim or new commit. Existing signed/state rules unchanged. |
| `LIC-EV-0049` | 2026-09-08 | `LIC-6.2-006` | HEAD9703e13 plus preserved prior worktree; 54-file compiled Licensing digest `8d839b19715aa3c0abf58109d6a6dec27419a1c0de7cd60e58412419c6b67362` | Windows development workspace; exact Node24.19.0, .NET SDK10.0.400; implementer/local reviewer Codex, no independent closure review | Exact Node `scripts/test-license-offline-v1.mjs` rebuild exits0: import38/request44/Entitlement36/Control36/Recovery36/Rebind40/TimeCorrection32/Reactivation28/files16. Core676 descriptors plus41 positives/42 binary negatives/90 cross-types/12 PoP/66 context; State117, Time39/lifecycle36/availability16 pass. Golden runner passes Protocol,105 byte-identical regenerated files,173 Vendor/Node/.NET verdicts and1436-file production isolation; frozen129-file manifest unchanged. Server build/typecheck and `git diff --check` pass. | Eight fake-adapter cases per Edition cover valid bounded intake to the real planner, metadata/byte mutation during awaits, pre-I/O metadata rejection, empty/oversized/non-byte/error intake, second Reactivation read failure before planning, registration-before-publication, exact retry, forged-plan/registration failure, unknown publication and invalid acknowledgement. No real native file/link/ACL/crash, protected Store, quarantine, public activation, runtime, DB or K40 evidence; none of ten physical audit cases closes. Import returns a plan, not a commit. No new commit or independent LIC006 closure. Digest hashes compact JSON of54 sorted repository-relative forward-slash {path,sha256,size} entries. |
| `LIC-EV-0050` | 2026-09-08 | `LIC-6.2-006` | HEAD9703e13 plus preserved EV0045-0049 worktree | Implementer Codex; acceptance reviewer Project Owner; independent closure reviewer required | Start one-pass file-to-completion integration: shared bounded intake, direct closed completion dispatch using copied bytes, no second file read and no caller-created proposal commit. Test missing store, valid write, invalid candidate/read failure, pending/conflict/lost acknowledgement, exact retry and concurrent completion. | Portable fake-adapter evidence only; no native file/provider/Store/runtime change, no new commit or policy. |
| `LIC-EV-0051` | 2026-09-08 | `LIC-6.2-006` | HEAD9703e13 plus preserved worktree; 54-file compiled Licensing digest `4d56d98b7d8c38ebe72ec4dd3c44e0e91ded56a1aa5bdaedaefddb81c57bce56` | Windows development workspace; exact Node24.19.0, .NET SDK10.0.400; implementer/local reviewer Codex; no independent closure review | Exact Node `scripts/test-license-offline-v1.mjs` rebuild exits0: files32 (previous16 plus16 new completion cases), import38/request44/Entitlement36/Control36/Recovery36/Rebind40/TimeCorrection32/Reactivation28; Core676 descriptors and41 positives/42 binary negatives/90 cross-types/12 PoP/66 context; State117, Time39/lifecycle36/availability16. Golden runner passes Protocol,105 identical regenerated files,173 matching Vendor/Node/.NET verdicts and1436-file production isolation; frozen129-file manifest unchanged. Server typecheck and `git diff --check` pass. | New both-Edition cases cover missing store before I/O, one read/lookup/complete Entitlement write with candidate-buffer mutation, planning-only zero writes, invalid file/second pair-read failure, pending/conflict/bad acknowledgement, lost acknowledgement and exact duplicate without second write, concurrent CAS, and rejection of caller proposals/bytes. All six intents dispatch to their existing typed factories; new end-to-end successful file completion coverage is Entitlement, not a claim of a complete six-intent matrix. No native file, protected Store, quarantine, restart/power-loss, runtime/DB/K40 or independent closure. No commit; LIC006 and physical cases remain open. Digest hashes compact JSON of54 sorted repository-relative forward-slash {path,sha256,size} entries. |
| `LIC-EV-0052` | 2026-09-08 | `LIC-6.2-006` | HEAD c975958 plus test worktree | Implementer Codex; no independent review | Start six-intent file-to-completion matrix: reuse each existing signed scenario builder with the real file workflow, planner and completion factories; eight cases per intent per Edition (96 planned additional cases). Existing direct-completion suites remain separate and unchanged in acceptance expectations. | No production behavior, signed protocol, native filesystem, protected Store, runtime, DB or device mutation. LIC006 remains open pending evidence and independent/physical gates. |
| `LIC-EV-0053` | 2026-09-08 | `LIC-6.2-006` | HEAD c975958 plus matrix worktree | Implementer Codex; retained failing test evidence | First aggregate and focused rerun both stop at Rebind14/16: the new retry assertion expected RECOVERY_TOKEN_REPLAYED but received REBIND_DEVICE_UNAVAILABLE in both Editions. Earlier aggregate Core/State/Time, import38/request44, all six direct-completion suites, files32 and first three matrix groups pass. | Source review of offline/rebind-device.ts confirms identical staged/current keys are rejected before token replay. Correct only the new test expectation; preserve single-use failure and exactly one state write. Production behavior is unchanged. Full final-source rerun required. |
| `LIC-EV-0054` | 2026-09-08 | `LIC-6.2-006` | HEAD c975958 plus tests/docs only; production sources unchanged | Windows development workspace; exact Node24.19.0 and .NET SDK10.0.400; implementer Codex, no independent review | Final-source aggregate offline runner exits0: six matrix groups16/16 each (96 new), files32, import38/request44/Entitlement36/Control36/Recovery36/Rebind40/TimeCorrection32/Reactivation28; Core676 owned descriptors and prior positive/negative/PoP/context cases, State117, Time39/lifecycle36/availability16 pass. Focused final-source matrix also passes96/96. Golden/Protocol runner exits0:105 identical regenerated files,173 matching Vendor/Node/.NET verdicts,1436 production isolation files, unchanged129-file vector manifest565a5efca1a1767a622a0d751a5937633018587f7cc463ce3e531ed9656fb99e. Server typecheck and diff whitespace check pass. | EV0053's expectation was corrected after source review without changing production semantics. Each intent has valid outcome, tamper, I/O failure, pending/conflict/bad acknowledgement, lost-ack/retry, concurrent CAS, wrong request and caller-byte override coverage in both Editions. Shared test fixtures do not replace direct suites. No physical filesystem, protected Store, power-loss, runtime, DB/K40, independent review or new commit; LIC006 remains open. |
| `LIC-EV-0055` | 2026-09-12 | `LIC-6.2-006` | Reviewed HEAD c97eb2964b0c436ed3dfa90aad8beed7c9857ea1; production unchanged | Independent reviewer offline_independent_review; coordinator Codex; Windows development workspace; exact Node24.19.0 | Limited independent approval: no reproducible blocking security/correctness finding in five portable offline modules and related tests/contracts. Independent stdin probes8/8 across both Editions pass: metadata mutation, counterfeit model, mismatched valid signed stored-request ID and cap+1 file. Coordinator aggregate rebuild exits0: import38/request44/Entitlement36/Control36/Recovery36/Rebind40/TimeCorrection32/Reactivation28/files32 plus six matrix groups16/16 (96), Core676 descriptors and prior positive/negative/context/PoP tests, State117, Time39/lifecycle36/availability16. | Detailed scope, initial probe-construction error, optional permanent signed-request coverage improvement and remaining native/time-acquisition/Store requirements in LICENSING_OFFLINE_REVIEW.md. Eight independent probes are ad hoc, not new permanent cases. Protocol/Golden and full application tests were not rerun this review; prior EV0054 remains their evidence. No code, DB/device/OS security or production-key mutation; no new commit. Portable review complete, LIC006 not closed; final integration/physical review remains required. |
| `LIC-EV-0056` | 2026-09-12 | `LIC-6.2-008` | Base ad5c209; user authorized separate laptop test kit | Implementer Codex; acceptance reviewer/operator Project Owner; independent security closure reviewer still required | Start with offline read-only inventory on available Windows 11 laptop, before choosing service/provider harness. Planned local checks: PowerShell execution, exact ZIP contents/hashes, extracted-path execution and report field/scope validation. | Preparation only. No production secrets, TPM/BIOS/BitLocker changes or services. LIC006 portable review remains complete; physical obligations remain open. Dependency cycle recorded as LIC-OPEN-012, no graph change. |
| `LIC-EV-0057` | 2026-09-12 | `LIC-6.2-008` | ad5c209 plus inventory-kit/docs worktree | Current Windows development workspace, inbox Windows PowerShell; implementer Codex, no independent review | `powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File licensing/windows-spike/preflight/Collect-Preflight.ps1` exits0. Build script exits0. Three-file ZIP extracts into a spaced Persian path; extracted collector exits0, all three SHA256 values match, report field allowlist/scope/collector hash checks pass. OS/hardware/system-volume OBSERVED; TPM UNKNOWN (query unavailable to this run). | Both executions are on the development machine, not the target laptop. Inventory records no provider PASS and creates only report files. ZIP and hash manifest in ignored out/; build script reproduces package from three explicit source files, excluding local reports. Target report, real CNG/DPAPI-NG/Service-SID/TPM/NV/repair evidence and all physical FILE/STORE acceptance remain pending. No portable review/regression rerun or new commit. |
| `LIC-EV-0058` | 2026-09-12 | `LIC-6.2-008` | ad5c209 plus preserved preflight worktree | Implementer/document reviewer Codex; acceptance reviewer/operator Project Owner | User requested pre-change documentation/checklist review and preparation of service/key harness while target laptop is unavailable. Review recorded in LICENSING_PREIMPLEMENTATION_REVIEW.md; planned HARNESS-001 through007, build and pure guard checks before handoff. | Both user preflight reports are explicitly development-machine evidence; elevated report reads TPM spec1.2, not P-256/provider acceptance. LIC006 independent review is not repeated. Native service/key mutation and target tests NOT RUN. No protocol, provider-choice, production dependency or release-gate change. |
| `LIC-EV-0059` | 2026-09-12 | `LIC-6.2-008` | ad5c209 plus test harness worktree | Implementer Codex; no physical service/key tests | Initial .NET build failed CS8604 for nullable CNG security descriptor bytes; added explicit null rejection, then build passed with zero warnings/errors. Initial package guard test failed Argument count mismatch because Windows PowerShell5.1 wraps ConvertFrom-Json array output inside the explicit array subexpression; inspecting the test-only child output proved native arguments were preserved. Removed the extra array wrapper; next run passed16/16 C# pure guards and14 PowerShell checks. | Retained implementation/test-construction failures. No provider choice or production rule changed. Subsequent final-source package and expanded interactive-refusal checks still required. |
| `LIC-EV-0060` | 2026-09-12 | `LIC-6.2-008` | ad5c209 plus final harness/docs worktree | Windows development host; SDK10.0.400, bundled runtime10.0.11 win-x64; implementer Codex, acceptance reviewer Project Owner | Final build/publish passes. Extracted final ZIP in spaced Persian path passes C# pure guards16/16 and PowerShell harness checks16/16: package inventory/hash, wrong scope/duplicate/path/ADS/hash/extra-file/junction rejection, native argument roundtrip and interactive/unknown command refusal. Server npm.cmd run typecheck exits0; diff whitespace passes. | ZIP out/lic008-harness-4a2241134a6442eda72a182a95c334f5/licensing-windows-harness-0.2.0.zip, 35718707 bytes, SHA256 bea40eb88974d5034c54979dfd3c2dd7361e72def78f10e51a198c22c40a71fc. Read-only preflight evidence is development-only. No test service, CNG/TPM key, DPAPI operation, DB/K40/runtime admission or production file mutation executed. Physical HARNESS-001 through007 acceptance, independent native review, FILE/STORE cases and Windows matrix remain open. LIC007 not started in this bounded harness slice; prior LIC006 review not repeated. |
| `LIC-EV-0061` | 2026-09-12 | `LIC-6.2-007` | Clean base5e842d9 (LIC008 tools/docs committed) | Implementer Codex; acceptance reviewer Project Owner; independent closure reviewer required | Start bounded Hybrid nonce/PoP request and registration slice under existing section6.2 contract. Planned both-Edition signed CHECK_IN/current/pending and TIME_RECOVERY; model/input/nonce/cap/signature/boot negatives, mutation across awaits, exact retry, ID/nonce conflict, stale state and unknown acknowledgement tests. | User explicitly requested commit then next step. No real Vendor service, Windows key/store, License/DB/K40/runtime mutation. LIC006 and LIC008 remain open; independent portable LIC006 review is not repeated. |
| `LIC-EV-0062` | 2026-09-12 | `LIC-6.2-007` | Base5e842d9; request checkpoint worktree | Implementer Codex; Node24.19.0 | Initial aggregate and focused Hybrid runs passed46/48; both Rebind fixtures failed INITIAL_BINDING_OVERRIDE_FORBIDDEN because the test attempted to seed recovery history into initial device state. Replaced with genuine signed Offline Rebind transition; added current/pending successor and missing-public-key cases. One intervening PowerShell Node -e probe failed shell quoting before tests; corrected stdin invocation. | Corrected focused suite passes52/52; strict TypeScript compile exits0. Earlier fixture/command failures retained. Final-source aggregate and Golden regression recorded separately; no independent review or stage closure. |
| `LIC-EV-0063` | 2026-09-12 | `LIC-6.2-007` | Base5e842d9; final request checkpoint worktree | Windows development host; exact Node24.19.0; .NET SDK10.0.400; implementer Codex, no independent closure | Exact-Node scripts/test-license-hybrid-v1.mjs exits0: Hybrid52/52, Core676/676 descriptors plus41 positive42 negative90 cross-type12 PoP66 context; State59+31+27; Time39/lifecycle36/availability16; Offline import38/request44/Entitlement36/Control36/Recovery36/Rebind40/TimeCorrection32/Reactivation28/files32 and six file matrices16 each (96). Strict TS build and production import isolation pass. Exact-Node scripts/test-license-golden-vectors.mjs reproduces105 files and byte-identical173-record Vendor/Node/.NET reports;1439 production files isolated;129-file vector manifest unchanged at565a5efca1a1767a622a0d751a5937633018587f7cc463ce3e531ed9656fb99e. Local links25 and unique EV/CHG definitions pass; git diff --check passes. | Portable checkpoint PASS. Golden first log reached PASS but PowerShell redirection surfaced informational stderr as NativeCommandError/shell exit1; rerun through Node spawnSync captured actual child status0,signal null. Logs in ignored out/lic007-final-test.log and out/lic007-golden-final.log. New request/registration code remains uncommitted; Windows kit is committed5e842d9. No real HTTPS, Vendor replay database, protected ledger, Windows service/key mutation, runtime/DB/K40 test or independent LIC007 review. Full response/pair/control/time/outage/reactivation workflow and LIC006/008 physical gates remain open; no repeat of LIC006 independent review. |
| `LIC-EV-0064` | 2026-09-12 | `LIC-6.2-007` | Clean base10d09f7; signed request checkpoint committed | Implementer Codex; acceptance reviewer Project Owner; independent closure reviewer required | User authorized commit then response implementation. Start bounded primary-Lease CHECK_IN/TIME_RECOVERY carrier intake, protected request correlation, existing model transition and complete-state CAS acknowledgement. Planned both-Edition signature/binding/replay/expiry/pair/time/mutation/store-failure tests and existing aggregate/Golden regression. | No wire/state/time policy change. Sidecar/control-only/trust/reactivation response orchestration remains a separate checkpoint; this slice must reject unsupported carrier variants as a whole. No real HTTPS or Windows Store/service/key mutation; LIC006 review not repeated. |
| `LIC-EV-0065` | 2026-09-12 | `LIC-6.2-007` | Base10d09f7; response checkpoint worktree | Implementer Codex; exact Node24.19.0 | Strict TS compile exits0. Initial focused response suite34/36: test checked nonexistent tamperLatch after KEY_LOSS; model correctly uses recoveryRequired without corroborated rollback evidence. Corrected assertion and verified non-operational projection. Expanded run46/48: future-pair fixture wrongly placed Lease notBefore above signed serverTime; existing core rejected LEASE_TIME_ORDER. Keep valid current Lease and future Entitlement term instead. | Corrected expanded focused suite48/48. Fixture errors retained; no production core/policy fix or waiver. Initial read-only path probes found no root AGENTS.md and corrected guessed Offline filenames via rg; no task rule file found. Final aggregate/Golden evidence follows separately. |
| `LIC-EV-0066` | 2026-09-12 | `LIC-6.2-007` | Base10d09f7; final primary-Lease response worktree | Windows development host; exact Node24.19.0; .NET SDK10.0.400; implementer Codex, no independent closure | Exact-Node scripts/test-license-hybrid-v1.mjs exits0: request52/52 and response48/48 across FULL/ATTENDANCE; strict TS build, production import isolation, Core676 descriptors plus41 positive42 negative90 cross-type12 PoP66 context; State59+31+27; Time39/lifecycle36/availability16; Offline import38/request44/Entitlement36/Control36/Recovery36/Rebind40/TimeCorrection32/Reactivation28/files32 and six16-case file matrices (96) pass. Exact-Node scripts/test-license-golden-vectors.mjs exits0:105 regenerated files,173 byte-identical Vendor/Node/.NET verdicts,1442 production files isolated;129-file vector manifest unchanged at565a5efca1a1767a622a0d751a5937633018587f7cc463ce3e531ed9656fb99e. Local links21, unique EV/CHG IDs and all Evidence rows inside the seven-column table pass; git diff --check passes. | Portable checkpoint PASS; no stage closure. Logs: out/lic007-response-aggregate.log and out/lic007-response-golden.log (ignored). Previous request checkpoint committed10d09f7; new response checkpoint uncommitted. No actual network, Vendor nonce store, protected Windows ledger, service/key mutation, DB/K40/runtime admission or independent review. Sidecar/control-only/trust/reactivation orchestration, backoff scheduler and physical LIC006/008 remain open. Prior LIC006 independent review not repeated. |
| `LIC-EV-0067` | 2026-09-12 | `LIC-6.2-007` | Clean base14ddebf; primary-Lease response committed | Implementer Codex; acceptance reviewer Project Owner; independent closure reviewer required | User authorized commit then next step. Start bounded CHECK_IN control-only carrier dispatch to independently signed Offline-Control completion: Vendor-initiated and separately request-bound CONTROL; strict input, request correlation, parent/model binding, whole-variant rejection and both-Edition atomic adapter failure tests. | Transport dispatch only; does not claim successful Lease check-in or consume the Lease request. Lease-plus-sidecar composition, transport-delivery ledger, trust/reactivation orchestration and actual HTTPS/Store remain open. No signed wire/core/time/commercial change; LIC006 independent review not repeated. |
| `LIC-EV-0068` | 2026-09-12 | `LIC-6.2-007` | Base14ddebf; final control-only dispatch worktree | Windows development host; exact Node24.19.0; .NET SDK10.0.400; implementer Codex, no independent closure | Strict TS builds exit0. Initial focused36/36 and expanded final44/44 control cases pass in FULL/ATTENDANCE, including independently request-bound controls, incorrect/denied/wrong-environment signer rejection, expired read-only retries, variant/purpose/parent/counter/consumed-request rejection, mutation, scheduling, terminal revoke, independent restriction preservation and CAS/pending/bad/lost acknowledgement. Exact-Node scripts/test-license-hybrid-v1.mjs exits0: request52/52,response48/48,control44/44, Core676 descriptors plus41 positive42 negative90 cross-type12 PoP66 context; State59+31+27; Time39/lifecycle36/availability16; Offline38/request44/Entitlement36/Control36/Recovery36/Rebind40/TimeCorrection32/Reactivation28/files32 plus six16-case file matrices pass. Golden runner exits0:105 regenerated files,173 byte-identical Vendor/Node/.NET verdicts,1445 production files isolated;129-file manifest unchanged at565a5efca1a1767a622a0d751a5937633018587f7cc463ce3e531ed9656fb99e. Local links21, unique EV/CHG IDs, seven-column Evidence table and git diff --check pass. | Portable dispatch checkpoint PASS; no stage closure or new commit. Logs out/lic007-control-aggregate.log and out/lic007-control-golden.log (ignored). Full transport consumption/delivery, mixed-carrier atomic orchestration, trust/reactivation and retry scheduler remain open. No actual HTTPS, Windows protected Store/service/key mutation, DB/K40/runtime admission or independent review. LIC006 portable review not repeated; LIC006/008 physical acceptance and LIC-OPEN-012 remain open. |
| `LIC-EV-0069` | 2026-09-12 | `LIC-6.2-007` | Clean basebc7aecb | Implementer Codex; acceptance reviewer Project Owner; independent closure required | Start bounded Lease plus Offline-Control composite command/workflow. Verify both with existing rules, apply Lease then Control inside one unsealed model reduction, seal once and hand one full proposal to Store. Test both Editions, request-bound sidecar, Time Recovery, invalid halves, revisions, replay and CAS failures. | No intermediate state may escape or commit. Trust/Reactivation sidecars and physical Store/HTTPS remain open. LIC006 independent review not repeated; changed core composition requires targeted tests and later independent LIC007 closure. |
| `LIC-EV-0070` | 2026-09-12 | `LIC-6.2-007` | Basebc7aecb; composite worktree | Implementer Codex; exact Node24.19.0 | Strict TypeScript builds pass. Initial focused40/40 composite cases pass. Source review against section4.2 shared Control revision rules identified need to process independently signed Control before an equal-or-higher Control-revision Lease; refined ordering and added both-Edition equal tuple, higher Lease status, Time Recovery with independently request-bound Control, direct-core caps/closed nested command and neutral failure tests. Expanded48/48 passes. | Portable focused checkpoint only. Existing strictly higher Control and exact equal-tuple Lease rules preserved; no failing gate waived. Final aggregate/Golden evidence follows. LIC006 independent review not repeated; targeted independent LIC007 composition review remains open. |
| `LIC-EV-0071` | 2026-09-12 | `LIC-6.2-007` | Basebc7aecb; final Lease+Control composition worktree | Windows development host; exact Node24.19.0; .NET SDK10.0.400; implementer Codex, independent review pending | Exact-Node scripts/test-license-hybrid-v1.mjs exits0: combined48/48, request52/52, primary response48/48, control44/44; strict TS build and production graph isolation; Core676 descriptors plus41 positive42 negative90 cross-type12 PoP66 context; State59+31+27; Time39/lifecycle36/availability16; Offline import38/request44/Entitlement36/Control36/Recovery36/Rebind40/TimeCorrection32/Reactivation28/files32 and six16-case file matrices pass. Exact-Node Golden runner exits0:105 regenerated files,173 byte-identical Vendor/Node/.NET verdicts,1445 production files isolated;129-file vector manifest unchanged at565a5efca1a1767a622a0d751a5937633018587f7cc463ce3e531ed9656fb99e. Local links21, unique EV/CHG definitions, Evidence table layout and git diff --check pass. | Portable atomic-composition checkpoint PASS; no new commit or stage closure. Logs out/lic007-combined-aggregate.log and out/lic007-combined-golden.log (ignored). One model generation and one complete-state adapter call are tested with doubles, not physical power-loss durability. Original state is retained on either-half failure; partial receipts reject; existing terminal Lease replay restrictions and strict Time Recovery replay remain. Trust/Reactivation orchestration, protected reconciliation, actual HTTPS/Windows Store, independent LIC007/core-composition review and physical LIC006/008 remain open. LIC006 independent review is not repeated. |
| `LIC-EV-0072` | 2026-09-12 | `LIC-6.2-007` | Clean e88d0caecab54cd824e14b5820ab3fce03cf116b | User-authorized independent reviewer hybrid_independent_review; coordinator Codex; portable Windows development workspace | Start independent source/probe review of current Hybrid request, primary/control-only/combined responses and changed core composition. Planned independently authored signed probes plus exact-Node aggregate baseline. | Review in progress; no approval or stage closure. Prior LIC006 independent review at ad5c209 is not repeated. No Windows security/service/key, actual HTTPS, DB/K40 or runtime mutation. Any findings and remediation reruns must be retained below. |
| `LIC-EV-0073` | 2026-09-12 | `LIC-6.2-007` | Reviewed e88d0ca; independent review tests worktree | Independent reviewer hybrid_independent_review; Node24.19.0 | Independently authored initial24/24 probes passed. Expanded run26/28 failed both Editions with LEASE_OFFLINE_UNTIL_FORMULA_MISMATCH: the new signed-time scenario advanced serverTime without shifting offlineUntil/notAfter. | Retained review-fixture construction failure, not a production defect. Reviewer corrected test-only time-window fields; no production source or policy changed. Final results followEV0074. |
| `LIC-EV-0074` | 2026-09-12 | `LIC-6.2-007` | e88d0caecab54cd824e14b5820ab3fce03cf116b; review docs/tests worktree | Independent reviewer hybrid_independent_review; coordinator Codex; exact Node24.19.0 | Reviewer executed scripts/test-license-hybrid-independent-review.mjs:28/28 independent probes across both Editions, covering revision order/collisions, wrong-purpose signer, historical/partial/terminal receipts, fresh request wrapping, signed-time validity/scheduling, strict Time Recovery replay and invalid partial acknowledgement. Coordinator separately reran scripts/test-license-hybrid-v1.mjs, exit0: request52/primary48/control44/combined48, strict TS build, production isolation, Core676 descriptors plus41 positive42 negative90 cross-type12 PoP66 context, State59+31+27, Time39/lifecycle36/availability16, prior Offline suites and six16-case file matrices pass. | Limited approval of reviewed portable Hybrid/core composition; no reproducible blocking finding and no production remediation. See LICENSING_HYBRID_REVIEW.md. Coordinator baseline log out/lic007-independent-baseline.log. Offline sources are unchanged from ad5c209; its independent review is not repeated. Entire LIC007, future trust/reactivation/transport/reconciliation, actual Windows Store/FILE acceptance and Release Gate remain open. No real HTTPS, Windows security/service/key mutation, DB/K40/runtime execution or new commit. |
| `LIC-EV-0075` | 2026-09-12 | `LIC-6.2-007` | Clean baseec2fbf3; independent review committed | Implementer Codex; acceptance reviewer Project Owner; independent closure required | Start bounded CHECK_IN trust-sidecar preparation and trust-only protected CAS handoff. Reuse pinned Root signature, Delegation serial and cumulative Denylist validators; preserve all existing trust facts. Planned both-Edition invalid signatures/order/replay/denial persistence/Time Recovery prohibition and adapter failure tests. | Trust-only result does not validate/apply the accompanying Lease or Control, consume check-in or switch a live verifier. Coordinated runtime trust replacement, full response application, actual HTTPS and protected Store remain open. No wire/key-custody/time/commercial change; previous independent reviews not repeated. |
| `LIC-EV-0076` | 2026-09-12 | `LIC-6.2-007` | Baseec2fbf3; trust-only worktree | Implementer Codex; exact Node24.19.0, development Windows | Initial strict TypeScript build failed TS2322 on optional verifier signerKeyId; use the already signature-validated payload keyId. Rebuild passed. Initial focused40 cases passed30/40: both Editions had prototype-sensitive Root comparison, wrong snapshot serial property and three cases rejected WRONG_FIELD_TYPE because test bundles contained zero Delegations. Corrected fixture comparisons/property and preserved a valid highest Delegation in bundles. Focused40/40 then expanded44/44 pass. A Python test-file write attempt did not run because Python was unavailable; file was created with apply_patch. | Preparation and fixture failures retained; no frozen core/schema/trust policy changed or failure waived. Expanded tests include valid signed TIME_RECOVERY rejection, same-batch serial collision and explicit verifier replacement boundary. Final aggregate and Golden evidence follows separately. |
| `LIC-EV-0077` | 2026-09-12 | `LIC-6.2-007` | Baseec2fbf3; final trust-only worktree | Implementer Codex; exact Node24.19.0 and .NET SDK10.0.400; development Windows, no independent closure | Exact-Node scripts/test-license-hybrid-v1.mjs exits0: trust44/44, request52/52, primary48/48, control44/44, combined48/48 across both Editions (236 Hybrid cases); strict TS build and production graph isolation; Core676 descriptors plus41 positive42 binary-negative90 cross-type12 PoP66 context; State59+31+27; Time39/lifecycle36/availability16; Offline import38/request44/Entitlement36/Control36/Recovery36/Rebind40/TimeCorrection32/Reactivation28/files32 plus six16-case file matrices pass. Golden runner exits0:105 byte-identical regenerated files,173 identical Vendor/Node/.NET verdicts,1448 production files isolated; unchanged129-file manifest565a5efca1a1767a622a0d751a5937633018587f7cc463ce3e531ed9656fb99e. Local links22 across five updated documents, unique EV/CHG IDs, seven-column Evidence layout and git diff --check pass. | Portable checkpoint only; no new commit or stage closure. Logs out/lic007-trust-aggregate.log and out/lic007-trust-golden.log (ignored). CAS/retry tests use memory doubles; Root/delegation/denial facts remain cumulative. Trust acknowledgement neither validates companion artifacts nor consumes CHECK_IN, mutates the License model or replaces a live verifier. Runtime trust coordination/revalidation, complete-response application, Reactivation, transport reconciliation, physical Store/FILE/LIC008 and LIC-OPEN-012 remain open. No actual HTTPS, Windows security/service/key, DB/K40 or runtime mutation; prior independent reviews not repeated. |
| `LIC-EV-0078` | 2026-09-12 | `LIC-6.2-007` | Clean base6f7b411; trust-only checkpoint committed | Implementer Codex; acceptance reviewer Project Owner; independent closure pending | Start coordinated ordinary CHECK_IN Lease plus optional Control and trust-bundle preparation. Stage a model under cumulative pinned trust, verify all response artifacts and retained authorizing pairs under that trust, and hand one trust-plus-state CAS proposal to the adapter. Planned both-Edition key rotation/denial, invalid halves, receipts, provenance and failed/partial acknowledgements. | No separate trust or License commit and no automatic runtime switch; full protected storage/rehydration and service barrier remain physical integration obligations. Reactivation variants stay closed. Existing wire, commercial, time and restriction rules unchanged; prior independent reviews are not repeated. |
| `LIC-EV-0079` | 2026-09-12 | `LIC-6.2-007` | Base6f7b411; coordinated trust/License worktree | Implementer Codex; exact Node24.19.0; no independent review | Initial TS build failed TS2339 because the lease-response union had not been narrowed before reading Lease/Control; use the existing lease discriminator and rebuild passed. Initial focused32 cases passed10/32: alternate-signer fixture still carried the original payload keyId, causing KEY_ID_MISMATCH in22 cases. Correcting the fixture keyId yielded30/32; remaining two expected tamperLatched=true from a single integrity incident, whereas existing policy sets recoveryRequired. Corrected assertions preserve both original flags. Expanded44/44 passed, including active-key replacement, later fresh CHECK_IN, single archived-request read, receipt denial bypass rejection and forged Root/invalid observation. | Compilation/fixture failures retained; no security or state policy weakened to pass. Internal trust-update preparation was factored out unchanged and consumed by both the previous trust-only facade and the new model branch. Final aggregate/Golden evidence follows separately. |
| `LIC-EV-0080` | 2026-09-12 | `LIC-6.2-007` | Base6f7b411; final coordinated trust/License worktree | Implementer Codex; exact Node24.19.0 and .NET SDK10.0.400; development Windows, no independent closure | Exact-Node scripts/test-license-hybrid-v1.mjs exits0: coordinated44/44, trust44/44, request52/52, primary48/48, control44/44, combined48/48 across both Editions (280 Hybrid cases); strict TS build and production graph isolation; Core676 descriptors plus41 positive42 binary-negative90 cross-type12 PoP66 context; State59+31+27; Time39/lifecycle36/availability16; Offline import38/request44/Entitlement36/Control36/Recovery36/Rebind40/TimeCorrection32/Reactivation28/files32 plus six16-case file matrices pass. Golden runner exits0:105 regenerated byte-identical files,173 identical Vendor/Node/.NET verdicts,1454 production files isolated; unchanged129-file manifest565a5efca1a1767a622a0d751a5937633018587f7cc463ce3e531ed9656fb99e. Local links22, unique EV/CHG IDs, seven-column Evidence layout and git diff --check pass. | Portable coordinated handoff checkpoint only; new work uncommitted, no LIC007/Release closure. Logs out/lic007-trusted-response-aggregate.log and out/lic007-trusted-response-golden.log (ignored). Tests cover active key rotation plus denial, retained parent rejection, full Lease+Control composition, permanent/future denial on branched projection and receipt shortcuts, subsequent fresh requests, immutable/provenance boundaries, one-read snapshots, joint CAS and partial/pending/lost acknowledgement. A complete acknowledgement exposes a staged model but proves no physical Store or service-barrier switch; denied retained grants fail closed without deleting restrictions/history. Targeted independent review of this new core/trust slice, Reactivation, protected read-back/runtime reconciliation, actual HTTPS/Windows FILE/Store and LIC-OPEN-012 remain open. Prior independent reviews not repeated. |
| `LIC-EV-0081` | 2026-09-13 | `LIC-6.2-007` | Clean53a7d74a75fbf58a2c1de83414c7d0de0db40274 | User-authorized independent reviewer hybrid_independent_review; coordinator Codex | Start bounded independent review of new Root trust updates, model trust branching, retained-authority checks and coordinated trust/Lease/Control handoff. Independent signed probes and separate coordinator aggregate baseline planned. | No review approval or closure yet. Prior LIC006/ad5c209 and Hybrid/e88d0ca reviews not repeated. No native Windows security/service/key, physical Store/FILE, DB/K40, HTTPS or runtime mutation. Findings, initial failures and reruns will be retained in following rows. |
| `LIC-EV-0082` | 2026-09-13 | `LIC-6.2-007` | Reviewed53a7d74; independent trust review test worktree | Independent reviewer hybrid_independent_review; exact Node24.19.0 | Initial independent24/24 probes passed. Expanded28 run passed26/28: both clock-diagnostic fixtures incorrectly assumed that receipt observation initializes an unclocked state, whereas ordinary imports preserve the pre-clock seam. Reviewer corrected fixtures to initialize with OBSERVE_TIME and generate a fresh request before the diagnostic; rerun pending. Signed-time replacement crossing old-key denial passed both Editions in the expanded run. | Retained test-fixture failure, not a production defect or policy waiver. The diagnostic also examines the unchanged historical projection after a rejected clock observation; its runtime-admission implication must be stated explicitly in the final review. No production remediation or closure claimed here. |
| `LIC-EV-0083` | 2026-09-13 | `LIC-6.2-007`, `LIC-6.2-009` | Reviewed53a7d74a75fbf58a2c1de83414c7d0de0db40274; review docs/tests worktree | Independent reviewer hybrid_independent_review; coordinator Codex; exact Node24.19.0 | scripts/test-license-hybrid-trust-independent-review.mjs final28/28, exit0, across FULL/ATTENDANCE:26 independent acceptance/rejection checks plus2 diagnostic clock-boundary checks. Coordinator scripts/test-license-hybrid-v1.mjs separately exits0:280 Hybrid cases (request52/primary48/control44/combined48/trust44/coordinated44), strict TS build, production isolation, Core676 descriptors plus41 positive42 binary-negative90 cross-type12 PoP66 context; State59+31+27; Time39/lifecycle36/availability16; prior Offline suites and six16-case file matrices pass. | Limited portable-contract approval; no reproducible blocking defect or production remediation. See LICENSING_HYBRID_TRUST_REVIEW.md. The clock diagnostics are not runtime security approval: after a rejected observation/trust evaluation, future LIC009 coordination must not admit operations from unchanged historical projection. Signed-time new-key replacement crossing old-key denial passes. Baseline log out/lic007-trust-independent-baseline.log (ignored). No new commit or LIC007/native/Release closure; previous independent reviews not repeated. Physical Store/service barrier, Reactivation, real transport, Windows acceptance and LIC-OPEN-012 remain open. |
| `LIC-EV-0084` | 2026-09-19 | `LIC-6.2-007` | Base67f4e95; prior independent trust review committed | Implementer Codex; acceptance reviewer Project Owner; targeted independent review required before closure | Start Hybrid Reactivation request targeting and three-artifact completion: reuse existing core pair validation to expose only a verified new-parent target, generate/register its installation-signed CHECK_IN without state mutation, then validate Authorization plus separately supplied Entitlement plus exact Lease/request and submit one complete-state CAS proposal. Both-Edition binding/replay/lock/tombstone/failure tests planned. | Frozen carrier has no Entitlement slot: it remains a separate bounded signed input. This checkpoint rejects mixed Control/trust variants and TIME_RECOVERY. No signed schema, commercial/time policy, real HTTPS/Store/service/key, DB/K40 or runtime changes. Existing untracked .NET obj build outputs are preserved. LIC007/physical acceptance remains open; prior independent reviews are not repeated. |
| `LIC-EV-0085` | 2026-09-19 | `LIC-6.2-007` | Base67f4e95; Hybrid Reactivation worktree | Implementer Codex; exact Node24.19.0; no independent review | Initial strict TS build failed TS2322 on the narrowed parent snapshot; explicit structural parent type corrected it. Subsequent direct-binding branch failed TS2339 for the optional bindingRecoveryTokenId; explicit device snapshot type corrected it and rebuild exited0. Initial focused44 passed42/44: both Edition fixtures incorrectly rejected a narrower Lease feature set. Expanded48 passed46/48: corrected narrowed Lease was accepted, but fixtures incorrectly expected all signed features in a projection whose build has no code-ready capabilities. Assertions now check retained signed restrictions and the effective subset. | Compilation and fixture failures retained; no feature, time, binding or security policy weakened. Expanded cases include a second Hybrid reactivation and real signed rebind followed by retirement of its override. Final focused and aggregate/Golden evidence follows separately. |
| `LIC-EV-0086` | 2026-09-19 | `LIC-6.2-007` | Base67f4e95; Reactivation validation workspace | Implementer Codex; development Windows; exact Node24.19.0 | Focused48/48 and full Hybrid aggregate exited0. Golden first exited1 because pre-existing Sept18 dotnet/bin violated the closed vector-package rule. Reversible preservation moved bin but Windows denied the obj directory move; rerun exited1 on dotnet/obj. Restored bin to its original location, left obj untouched and changed no ACL. Created detached validation worktree at out/lic007-reactivation-validation; first isolated run exited1 because checkout converted package.json to CRLF. Copied exact working bytes of all728 tracked files plus both new files and all production scan roots;1440 root files were compared byte-for-byte and SHA256 recorded in out/lic007-reactivation-validation-copy.json. | Environmental/preparation failures retained, no gate weakened or fixture manifest regenerated. Original generated bin/obj and Windows harness outputs remain preserved. Isolated exact-byte Golden rerun follows; logs out/lic007-reactivation-golden.log, -golden-rerun.log and -golden-isolated.log preserve failed attempts. No independent re-review or physical security/runtime action. |
| `LIC-EV-0087` | 2026-09-19 | `LIC-6.2-007` | Base67f4e95; final Hybrid Reactivation worktree, uncommitted | Implementer Codex; exact Node24.19.0 and .NET SDK10.0.400; development Windows; independent review pending | Focused48/48 exits0. Exact-Node scripts/test-license-hybrid-v1.mjs exits0: Reactivation48/request52/primary48/control44/combined48/trust44/coordinated44, totaling328 Hybrid cases across FULL/ATTENDANCE; strict TS and production graph isolation; Core676 descriptors plus41 positive42 binary-negative90 cross-type12 PoP66 context; State59+31+27; Time39/lifecycle36/availability16; Offline import38/request44/Entitlement36/Control36/Recovery36/Rebind40/TimeCorrection32/Reactivation28/files32 and six16-case file matrices pass. Exact-Node scripts/test-license-golden-vectors.mjs in the byte-identical validation worktree exits0:105 byte-identical regenerated files,173 identical Vendor/Node/.NET verdicts,1457 production files isolated; unchanged129-file manifest565a5efca1a1767a622a0d751a5937633018587f7cc463ce3e531ed9656fb99e. Local links, unique EV/CHG IDs, seven-column tables and git diff --check verified. | Portable checkpoint only; no stage closure or new commit. Logs out/lic007-reactivation-aggregate.log and out/lic007-reactivation-golden-isolated-rerun.log; snapshot hashes in out/lic007-reactivation-validation-copy.json. The disposable validation worktree was removed after PASS; logs and hashes are retained. Memory-adapter tests cover one CAS/generation, two request consumptions, three signed artifacts, replay/collisions, retained tombstones and independent locks, repeated Hybrid reactivation, post-Rebind direct binding, immutable inputs and conflict/pending/lost/invalid acknowledgements. Targeted independent review of this new core helper/facade, mixed Control/trust and Time Recovery composition, protected read-back/runtime reconciliation, actual HTTPS and Windows FILE/Store acceptance remain open. Prior independent reviews are not repeated; no physical security/service/key, DB/K40 or runtime mutation. |
| `LIC-EV-0088` | 2026-09-19 | `LIC-6.2-007` | Reviewed2a6fb873e5b5ab5af23d165072a247da94d4ef6d | Reviewer Codex, separate targeted review pass; exact Node24.19.0; development Windows | Fresh strict TypeScript compilation exits0. Reviewed frozen-schema diff, core state/ownership data flow, bounded input copies, two protected archived-request reads, all-three-artifact transition, one-CAS acknowledgement boundary, replay/lock/tombstone/rebind/time-incident tests and existing final evidence EV0087: focused48/48, aggregate328 Hybrid cases, Golden Vendor/Node/.NET pass. | No reproducible blocking portable-contract defect. See LICENSING_HYBRID_REACTIVATION_REVIEW.md. This is not physical Store/HTTPS/Windows/service/runtime approval and does not close LIC007. Mixed Control/trust and Time Recovery composition, protected read-back reconciliation, LIC008 target acceptance and LIC-OPEN-012 remain open. Previous reviews were not repeated. |
| `LIC-EV-0089` | 2026-09-19 | `LIC-6.2-007` | Review documentation worktree | Reviewer Codex; development Windows; exact Node24.19.0 | Initial documentation validator failed `AssertionError: LIC-EV- duplicate, 88 !== 149` because it compared unique evidence-table rows against every repeated reference in the master document. The corrected validator limits uniqueness to table rows and passes: EV88, CHG41, local links28 and seven-column Evidence rows; `git diff --check` passes. | Retained validator-script failure only; no product code, protocol, policy or acceptance claim changed. Review report and mirrors are internally linked and consistent. |
| `LIC-EV-0090` | 2026-09-19 | `LIC-6.2-007` | Basee63e8d5; development Windows; exact Node24.19.0 | Implementer Codex; acceptance reviewer Project Owner; targeted review remains required before closure | Added optional Control to Hybrid Reactivation and a Trust-staged Reactivation facade. It validates the archived REACTIVATE and CHECK_IN requests, revalidates all signed artifacts under staged Trust, then proposes one state/trust CAS. Initial aggregate run stopped at TypeScript errors (wrong Trust import and unguarded Store acknowledgement); corrected build passed. First behavioral run passed48/52 because fixtures used Control revision1 after an existing terminal Control revision1; corrected fixtures use revision2 per the global Control sequence. Final strict TypeScript and full aggregate pass: Reactivation52/52, request52, primary48, control44, combined48, trust44 and coordinated44, plus all Core/State/Time/Offline regressions. | Retains compile and fixture failures as evidence. No protocol/schema, commercial/time policy, native HTTPS, protected Store, Windows service/key, DB/K40 or runtime-admission change. TIME_RECOVERY remains rejected; durable=false and runtimeAuthority=NONE. |
| `LIC-EV-0091` | 2026-09-19 | `LIC-6.2-008` | Windows 11 target laptop; harness package SHA-256 `70661B38AFAF5E9EF56F388D479E1E981B48AB62279EAEABF860BEB252700E26` | Target operator Project Owner; implementer/reviewer Codex | Package guard verification passed16/16 before transfer. Physical InstallAndRun created both isolated Manual services; protected-file creation and App/child file access-denial probes passed. Guardian software-P256, TPM-P256 and DPAPI-NG creation each returned `CryptographicException:0x80090010`; dependent key/DPAPI probes were correctly NOT_TESTED_PREREQUISITE. Cleanup passed for software but TPM cleanup returned the same code; Harness retained services and ownership records. Guardian cleanup report `c5b05c410d644d188579fa35b119d586` confirms matched service identity and the TPM cleanup failure. | `0x80090010` is `NTE_PERM` per Microsoft Learn. This is physical negative evidence, not TPM absence or security acceptance. Do not alter TPM, BIOS, BitLocker, key ACLs or delete retained resources manually. LIC008, LIC006, Store/Guardian integration and release remain open. |

| `LIC-EV-0092` | 2026-09-19 | `LIC-6.2-008` | Subsequent diagnostic worktree; base0bac5a5 | Implementer Codex; operator report, device identity unconfirmed | Correct EV0091: initial DPAPI-NG error was0x80090034, not0x80090010. Old compound creation probes do not identify failing suboperation. Cleanup Software PASS also permits absent keys; TPM denial proves neither key existence nor deletion. Added fixed creation-stage diagnostics and standalone existing-report exporter. SDK10.0.400/runtime10.0.11 build passes, C#16/16 and PowerShell16/16 guards pass; isolated exporter fixtures pass legacy missing-Stage compatibility, explicit field selection, preserved errors, service snapshot and identity rejection with no failed-output publication. | Supersedes incorrect interpretations in EV0091 without removing original evidence. No real key/service/ACL mutation executed in this step. Existing installation must not be overwritten. Diagnostic export supports0.2.0; enhanced0.2.1 physical execution and protected-state reconciliation remain pending. |

| `LIC-EV-0093` | 2026-09-19 | `LIC-6.2-008` | Existing local0.2.0 installation; diagnostic export | Codex; user explicitly requested local collection | Unelevated read returned Access Denied. Elevated PowerShell report exporter succeeded: out/lic008-diagnostics-4801f3ec065341afa549448405b117df.json contains Guardian/App create run1e84b1df521a4ac486b7a47ba553a530 and cleanup runc5b05c410d644d188579fa35b119d586. Both test services Stopped; CNG failures0x80090010, DPAPI-NG0x80090034, missing Stage values confirmed. | Reports exist on the currently accessible host; no independent second-laptop evidence claimed. No service start/stop, key operation, ACL change or cleanup performed. Physical root cause and resource reconciliation remain open. |

| `LIC-EV-0094` | 2026-09-19 | `LIC-6.2-008` | Local read-only inspection; original create run1e84b1df521a4ac486b7a47ba553a530 | Codex; operator-authorized elevated Administrator, not Guardian | Both CNG providers open successfully. Software ECDSA_P256 query succeeds; Platform ECDSA_P256 query returns0x80090029. Exact original test key opens both return0x80090016 for this caller. OS10.0.22000, non-domain, TPM raw SpecVersion1.2,2,3 enabled/activated; both services Stopped/Manual with expected virtual accounts. Report out/lic008-inspection-5a1ab1ea99474071b3f58f7f6a1ebd8b.json. Inspector parse/compile and exact-name/pre-native rejection checks pass. | No key creation/export/sign/delete, service mutation, ACL change or private-state access. Absence is caller-scoped; cleanup remains unresolved. Software algorithm support is not Guardian provisioning acceptance. TPM P-256 unsupported by current query. DPAPI0x80090034 is encryption failure; standalone SID feasibility remains open. No provider selection, policy change or LIC008 closure. |

| `LIC-EV-0095` | 2026-09-19 | LIC006/007/008 and LIC-OPEN-012 | Base0bac5a5 plus existing diagnostic worktree | Codex; documentation and selected source/history review | Inventory24 existing Markdown documents, including all15 docs files; review active decisions/checklists/dependencies and prior evidence. Historical ad5c209 already contains LIC008 and Guardian key creation. Current Phase6.2 row count:5 complete,3 in progress,5 not started. Report LICENSING_PATH_REVIEW.md corrects EV0090's fixture-only explanation: committed reducer ordering also changed, and reactivationBase resets the new-lineage Control state. | Current summaries corrected; historical rows preserved. Setup-created installation key is provisional, not approved. LIC-OPEN-012 unresolved; earlier reviews do not certify0bac5a5. Initial documentation patch generation failed before mutation due to PowerShell string metadata serialization; corrected patch applied. Application/crypto/native/DB/K40 tests Not run; no new physical acceptance or stage closure. |

| `LIC-EV-0096` | 2026-09-19 | LIC008, LIC-OPEN-003/012 | Base0bac5a5 plus existing worktree | Codex; documentation planning and source comparison | Read master identity/phase/dependency contracts, current harness creation/denial/cleanup/service lifecycle and diagnostic evidence. Prepared P01-P12 baseline, conditional Setup alternative, retained-resource boundaries and explicit proposed native-entry dependency table in LICENSING_WINDOWS_NEXT_PLAN.md. Microsoft creation lifecycle and SID DPAPI-NG references checked. | Plan prepared only. Every new physical probe is NOT RUN; no service/key/ACL/DB/code mutation in this step. Guardian creation stays normative. Dependency proposal keeps FILE/STORE/full-phase/release exits and remains unadopted; Open003/012 and LIC006/007/008 stay open. Prior independent reviews not repeated. |

| `LIC-EV-0097` | 2026-09-19 | LIC008, LIC-OPEN-003 | Base0bac5a5 plus provisioning worktree | Codex; development Windows; SDK10.0.400/runtime10.0.11 | scripts/build-license-windows-provisioning.ps1 exits0; pure guards31/31 and package/controller guards28/28 pass. Staged failure/redaction, identity/group/namespace refusal, command/manifest/path/junction/collision and cleanup-classification checks. Final ZIP out/lic008-provisioning-308f8a26890b4c04bfd59877f2431970/licensing-windows-provisioning-0.3.0.zip SHA256 bf9967003d8930affa17cb7976a654d36dd618e0c3f88cc7aa18210b15e95755. | Build/test package only. Intermediate packages79753d4c9ae64cd8b6465368572a8834 and11e16264d732471aa3054ebc3d83b148 are superseded, not physical evidence. Old services observed Stopped; new services absent. No service/key/ACL/DB mutation. Physical P01-P12, independent security acceptance, TPM/ordinary-user/reboot/repair/Windows matrix and LIC-OPEN-012 remain open. Prior independent reviews not repeated. |

| `LIC-EV-0098` | 2026-09-19 | LIC008, LIC-OPEN-003 | Final0.3.0 ZIP bf9967003d8930affa17cb7976a654d36dd618e0c3f88cc7aa18210b15e95755 | User-authorized elevated current-host run; OS10.0.22000, non-domain; operator Codex | Exact digest/fresh root/name preflight; InstallAndRun completed run27ef5ffb1caf4a42a8d8ef431d91d579. Guardian Software provider/query/create/property/DACL-set stages pass, native-finalize-key fails0x80090010; DPAPI descriptor passes, protect-secret fails0x80090034. App/actual-child file read/write denied4/4; key/DPAPI denials and export skipped for missing prerequisites. Report digest4dd789de10bb76dda733a52d43a728c0ae48b1a5c02f85a5c144ced867b97e93; executable hashes and run IDs match. | Controller exit0 means collection completed, not security PASS. Failure location established for this variant only; usable/persisted key, effective key ACL and exact root causes unproven. Both new services retained Stopped/Manual; old stopped installation preserved. No cleanup/recheck/reboot/TPM/DB or production change. See LICENSING_PROVISIONING_HARNESS.md physical results. LIC008 and Open003/012 remain open. |

| `LIC-EV-0099` | 2026-09-19 | LIC008, LIC-OPEN-003 | Current provisioning baseline27ef5ffb1caf4a42a8d8ef431d91d579; diagnostic worktree | Codex; current host; unelevated and authorized elevated read-only collector | scripts/inspect-license-provisioning-environment.ps1 completes twice. Shared CNG Keys DACL: Everyone read/synchronize, SYSTEM/Admin full control, no other grant; KeyIso Running. Elevated CAPI2 metadata shows disabled; DPAPI Operational enabled with no matching events in the fixed window. Four retained test services Stopped/Manual. Elevated report digest3b7db4a93b95ce471cc46d700e0ddc503e4c258695d57c1074d5514bd167dffd. | Stronger persistence-permission hypothesis, not original-token AccessCheck or causal trace. SID standalone compatibility remains unresolved; official domain example and LOCAL protector distinctions documented. Initial ad hoc pipeline parse failed before execution and was corrected. No key contents, new crypto operation, service/ACL/domain change or cleanup. Proposed identity/protector comparisons remain test/design alternatives; no production policy change or LIC008/Open closure. |

| `LIC-EV-0100` | 2026-09-19 | LIC008, LIC-OPEN-003/012 | Base0bac5a5 plus comparison worktree; executed0.4.0 ZIP61153b850c5543b24ba4f06d0b82fb0d7fac6aced797a2c9344785a071bc9970 | User-authorized current-host SYSTEM comparison; Codex | Build/pure38 and guard49 checks pass. Initial missing-Setup bootstrap failure before crypto; exact-hash partial-install continuation creates only missing helper. Setup0d26c5c6d100431b88f6bbf5ecb31956 finalization/sign/verify PASS; check-ace-rights fails InvalidDataException:0x80131501. Summary digest a48147a085f0b872f99befe60a600725943c9daafb9603245cbfe9ea45a548db. Source bootstrap fix and added inert regression pass after correcting empty mock PSScriptRoot. | Key isolation NOT accepted; actual ACE masks unrecorded. Guardian/App rounds and conditional protection NOT_RUN. Helper deleted, six retained services Stopped/Manual, owned test key retained. No global ACL/TPM/production change or independent-review repeat. Executed archive retained unchanged; source correction not deployed. See LICENSING_COMPARISON_EXPERIMENT.md. LIC008/Open003/012 stay open. |

| `LIC-EV-0101` | 2026-09-19 | LIC008, LIC-OPEN-003 | Retained owned comparison key0d26c5c6d100431b88f6bbf5ecb31956; metadata reader worktree | User-authorized current-host diagnosis; temporary SYSTEM reader; Codex | Exact public SPKI match. Protected DACL has exactly SYSTEM and expected Guardian allow ACEs, no flags/callbacks, both mask0xD01F01FF. Original equality with0x10000000 fails despite GENERIC_ALL present. Machine/P256/None export/Signing metadata confirmed. Reader compile succeeds using local cache after interrupted remote restore. Report out/lic008-key-metadata/metadata-1b5e11d96fff4309af4bf018c1b5c8ad.json digest eae096799e2f70a4329497be3d9a3dafdbf12d7c4135ae570025631b7b7e057c. | Immediate failure traced to harness raw-mask equality; no effective access acceptance inferred. Helper deleted; six retained services Stopped/Manual. New reader binary directory/report only; no key creation/change/delete, global ACL mutation or private export. Validator unchanged, Guardian/App rounds pending, protection NOT_RUN. See LICENSING_COMPARISON_EXPERIMENT.md; no LIC008/Open closure. |

| `LIC-EV-0102` | 2026-09-19 | LIC008, LIC-OPEN-003 | Corrected0.4.1 ZIP28b95e18dab83adb9ae3105811bba5dbcbeb0bd5cb62757f8339c1f17ef1409e | User-authorized retained-key continuation; current host; Codex | Initial CS8602 nullable Provider build failure fixed with explicit refusal. Final pure52/52, controller49/49, inert bootstrap and parser pass. Handoff2ff9f5a792994bb9a302a054d2ae3c75 PASS; verify9b7ff54568d249318589f43e28c8e95f Guardian reopen/sign/policy/ACL/private-export refusal PASS. App/child key-open0x80090016 INCONCLUSIVE, file denials4/4 PASS, child identity/execution PASS. Summary continuation-4dde8b0572a24b23b55d11567ad2b8fa digest81ba564119ee7c64eaf75cb5530076fdda9436dc3ffa8f97460bb7aeb25f6e69. | Original ACL comparison fixed and physically verified; key-isolation gate still unmet. Second key round and protection NOT_RUN; no broadening of IsDenied. Two ComparisonV1 binary paths updated, six services Stopped/Manual; retained key and old binaries/reports preserved, no global ACL/TPM change. LIC008 remains open. Details in LICENSING_COMPARISON_EXPERIMENT.md. |

| `LIC-EV-0103` | 2026-09-19 | LIC008, LIC-OPEN-003 | Base419d1a6 plus retained-diagnostic worktree; prepared0.4.2 ZIPf9d85d37b21d9bd80a0437519018f5eadcf4cc4c8d6a042a6dbc2ff621b691e2 | Codex; development Windows11 build22000; SDK10.0.400/runtime10.0.11 | Added exact retained-key native provider-open/P-256-query/key-open diagnostics shared by Guardian/App/actual child; Guardian managed reopen/sign/policy/export refusal remains the positive control. Added one-time digest/state-pinned Diagnose-Retained continuation, explicit securityAccepted=false/acceptanceChanged=false summary, final service-state snapshot, package exclusion of consumed Resume-Retained, child binary-plan binding and .NET obj ignore. Final pure57/57, controller52 checks, inert bootstrap, diagnostic parser and read-only native API allowlist pass. Existing six services observed Stopped/Manual and temporary helpers absent before build. | Package preparation only. Elevated protected-state preflight and physical diagnostic are NOT_RUN. No service start/configuration, key open/create/change/delete, ACL/TPM/DB/K40 operation or acceptance reinterpretation occurred.0x80090016 remains INCONCLUSIVE; second key round and LOCAL=user remain NOT_RUN. NuGet audit disabled for cached build; no vulnerability-audit claim. |

| `LIC-EV-0104` | 2026-09-19 | LIC008, LIC-OPEN-003 | Attempted0.4.2 preflight ZIPf9d85d37b21d9bd80a0437519018f5eadcf4cc4c8d6a042a6dbc2ff621b691e2; corrected0.4.3 ZIPe7fe936be1c3b365db445a197510fafd6cdc679ada9fea9f02c960fbb0a162a3 | User-run elevated preflight; remediation by Codex |0.4.2 stopped with PowerShell Test-Path AccessDenied at protected/software-intent.json. Read-only follow-up confirms bin-0.4.2-diagnostic absent, no diagnostic report, both Comparison services Stopped/Manual on bin-0.4.1 and helpers absent.0.4.3 removes Administrator access to protected records; Guardian now compares protected intent/ownership to the published record before managed/native controls. Added controller regression rejecting protected/software access. Final pure57/57, controller52, inert bootstrap/parser/native API allowlist pass. | Expected ACL boundary exposed a controller-design defect; no protected ACL weakening. Failed attempt made no directory/service/plan/key/ACL mutation. Corrected package is prepared only; elevated0.4.3 execution, second key round and LOCAL=user remain NOT_RUN. No acceptance change. |

| `LIC-EV-0105` | 2026-09-19 | LIC008, LIC-OPEN-003 | Diagnostic report `key-open-diagnostic-b2d7ddfbd7a24fa384cfa16093cb9dac.json`, copied evidence SHA256dbdc3b6cc266a48340be66a7b99d7815be03662d80a2e19669c467646cc7c433; package manifest SHA25619d264521d0a6ae01f5df07f6ccfb05b488f5b44606b374bce17707d17a61fcc; binary SHA2565290ed64577cc3c93e7f0b5e14f410384e876d647a4dff7a8638a3743467b53c | User-run elevated0.4.3 retained-state diagnostic; current host | Run c2ed6691980c4792b5e743991ab8a172 collected complete evidence. Guardian protected/public records match; managed reopen, machine/non-exportable/P-256/signing properties, public identity, sign/verify, exact protected DACL and private-export refusal PASS. Native provider open, P-256 support and exact machine-key open PASS for Guardian. App and actual child open the same provider and report P-256 support, but both exact-key opens return NCryptStatus0x80090016; child token identity and execution PASS. | Report explicitly records diagnosticCollected=true, securityAccepted=false and acceptanceChanged=false. Result eliminates provider/algorithm availability, managed-wrapper and flag/name mismatch within this probe, but does not prove explicit denial. Both services finish Stopped/Manual on bin-0.4.3-diagnostic; retained key is unchanged. Second key round, LOCAL=user, reboot, ordinary-user, TPM, repair/reinstall and production acceptance remain NOT_RUN. Next proposal is a fresh restricted-versus-App-readable ACL control pair; retained key must not be modified or deleted. |

| `LIC-EV-0106` | 2026-09-21 | LIC008, LIC-OPEN-003 | Base52e0591 plus ACL-control worktree; prepared0.5.0 ZIPce2efa0981f49608a6715a7c36c1e45eb5a8a9d138809e445b2b474286356d45 | Codex; development Windows11 build22000; SDK10.0.400/runtime10.0.11 | Added experiment/run-bound restricted and App-readable Software machine-key controls, exact three-identity native contrast, durable per-key intent/ownership, public pair binding, verified fresh-key-only cleanup and one-time EV0105-hash/state-pinned continuation. Setup helper removal covers post-create SID/config failures; the outer mutation boundary always records the three-service snapshot and securityAccepted=false/decisionChanged=false, including pre-key copy/config failure. Pure73/73, controller58, inert bootstrap, diagnostic parser/read-only allowlist and ACL continuation parser/generated-name/native-API bounds pass. | Package preparation only: no SCM/key/ACL/TPM/DB operation occurred. Physical A/B execution, acceptance interpretation, second acceptance round and LOCAL=user remain NOT_RUN. Retained key cannot match the generated ACL-control namespace and is not modified/deleted. NuGet audit disabled for cached build; no vulnerability-audit claim. |

| `LIC-EV-0107` | 2026-09-21 | LIC008, LIC-OPEN-003 | Report `acl-disambiguation-610290f45bcf46d4957638f7dc9dd9a0.json`, copied evidence SHA256166299e96e2036a3740a44d323ec7c4a608c4faef72c646ee3bc827902ecc50e; manifest SHA25652c7b6e846c54c1ae2498997ec0016ed174fae02033ebf55f5f97122f59d9da3; binary SHA2564052df511dcf9c7fb3a914912bb44976e260ba3b41f0aea867b5dcc30daab80e | User-run elevated0.5.0; current host; experiment c448747f67ec435fb27433d2a9608551 | Setup creates restricted SYSTEM+Guardian and App-readable SYSTEM+Guardian+App machine/non-exportable/P-256/signing controls; both finalize, public identity/signing and exact protected DACL PASS. Guardian opens both. App/actual child provider/P-256 stages PASS, restricted exact-key returns OBSERVED_BAD_KEYSET and App-readable exact-key opens PASS; child identity/execution PASS. Guardian cleanup returns DELETED_AND_CONFIRMED for both. | Complete A/B contrast establishes ACL-mediated Software-KSP non-disclosure on this host. setupComplete, contrastObserved, cleanupConfirmed and helperRemoved are true; Setup ABSENT, Comparison services Stopped/Manual on bin-0.5.0-acl-control. Report keeps securityAccepted=false/decisionChanged=false. Retained EV0105 key unchanged. Second acceptance round, LOCAL=user, reboot, ordinary-user, TPM, repair/reinstall and production acceptance remain NOT_RUN. |
| `LIC-EV-0108` | 2026-09-21 | LIC008, LIC-OPEN-003 | Base52e0591 plus comparison worktree; prepared0.6.0 ZIP291bfc71300835b39d07bcd3cabcb4202b930b471bcffbcaecdf1886ca75378e | Codex; development Windows11 build22000; SDK10.0.400/runtime10.0.11 | Added explicit plan-bound narrow classifier: `PASS_KEY_NOT_DISCLOSED` is possible only for accepted ACL behavior; global `IsDenied` is unchanged and the legacy path still returns INCONCLUSIVE. Added one-time EV0107 report/manifest/binary/state-pinned continuation for two fresh verify rounds, followed only on both PASS by protect and verify-protect with `LOCAL=user`. Pure81/81, controller60, inert bootstrap, diagnostic/ACL/accepted-round parsers, state pins and native/API bounds pass. | Package preparation only. No SCM/key/ACL/TPM/DB operation occurred. The continuation creates/deletes no key and invokes no Setup helper; the retained key and exact protected records remain authoritative. Physical rounds and protection are NOT_RUN. This records CHG0052 implementation readiness, not production acceptance, LIC008 closure, reboot/ordinary-user/repair acceptance or a historical relabel. |
| `LIC-EV-0109` | 2026-09-21 | LIC008, LIC-OPEN-003 | Report `accepted-rounds-4ad8c06e51c74405b726ede8c305844c.json`, copied evidence SHA256e5cd53e948ae094a441c2245056a15e8c5f7889aa3c07653789361d5c007c002; package ZIP SHA256291bfc71300835b39d07bcd3cabcb4202b930b471bcffbcaecdf1886ca75378e; installed manifest SHA25680458c612faa2f9dd2c9a4827b84fa95b6aee2af231d7c1c12760fc813e2e86d; binary SHA2564052df511dcf9c7fb3a914912bb44976e260ba3b41f0aea867b5dcc30daab80e | User-run elevated0.6.0; current host | Verify runs05e3dd6101684cbfb03973b8945b5b70 and5bea3d0e12f141af8b06fbe63d2c238a each pass Guardian reopen/sign/policy/DACL/private-export/file controls; App/actual child each return PASS_KEY_NOT_DISCLOSED, file denials and identities PASS. Protect runc6bd4350422e40c1b237efd5e138eb97 creates LOCAL=user descriptor, then dpapi-protect-secret fails CryptographicException0x80090034. | `rounds=[true,true]`, `keyIsolationAccepted=true`, `protectionExperiment=FAILED_OR_INCOMPLETE`, `productionAccepted=false`. No ciphertext/hash publication; App/child DPAPI and verify-protect are prerequisite-skipped. Services finish Stopped/Manual on bin-0.6.0-accepted-rounds; helpers absent. Do not rerun or adopt LOCAL=machine. DPAPI-NG virtual-service/profile/provider diagnosis, reboot/ordinary-user/TPM/repair/power-loss/production acceptance and LIC008 closure remain open. |
| `LIC-EV-0110` | 2026-09-21 | LIC008, LIC-OPEN-003 | Base37d3a15 plus diagnostic worktree; prepared0.7.0 ZIP8bf0028bd3eab420568e75547592ae625fb225a161382a36071b621c81bfb48e; manifest SHA2565c301f20a37b6f8afaec79253f0486b1de9120dd4053ec8d1f507f3773e7fe9d; executable SHA2560a699176b836252a8be07011bcad807ee01c27690a56067c6dec52806c163d45 | Codex; development Windows11 build22000; SDK10.0.400/runtime10.0.11 | Added Guardian-only diagnose-protection action, token/profile/HKU observations and memory-only random32-byte LOCAL=user versus exact Guardian-SID protect/unprotect controls with buffer zeroing. Added one-time EV0109 report/manifest/binary/plan/service-state-pinned continuation and explicit securityAccepted=false/policyChanged=false/productionAccepted=false summary. Pure84/84, controller63, inert bootstrap and all retained/ACL/accepted/protection parser, state, package and native/API bounds pass. | Preparation only: no physical service, DPAPI, key, ACL, profile or provider operation occurred. Package excludes consumed continuations. Guards forbid LOCAL=machine, persisted diagnostic secret/blob/hash, Administrator protected-record access and service identity/profile changes. Physical diagnostic and any adapter/policy decision remain NOT_RUN; LIC008/Open003 stay open. |
| `LIC-EV-0111` | 2026-09-21 | LIC008, LIC-OPEN-003 | Report `protection-diagnostic-504cd5bf4b724762a328d5abfc8d5964.json`, copied evidence SHA25608f65149a6ae953d5af12d00dc0b473160a8e976f194f62554dc9ae669bfac6d; package ZIP SHA2568bf0028bd3eab420568e75547592ae625fb225a161382a36071b621c81bfb48e; installed manifest SHA2565c301f20a37b6f8afaec79253f0486b1de9120dd4053ec8d1f507f3773e7fe9d; binary SHA2560a699176b836252a8be07011bcad807ee01c27690a56067c6dec52806c163d45 | User-run elevated0.7.0; current host; run12f3501a2dda4c10bb045139fd764450 | Exact Guardian virtual SID/account and primary identity match; AuthenticationType Negotiate, ImpersonationLevel None. USERPROFILE and SpecialFolder.UserProfile are C:\Users\Default; HKU exact-SID hive is false; profile-directory returns InvalidDataException0x80131501 and profile-type Win32Exception0x80004005. Both memory-only LOCAL=user and exact Guardian-SID protect probes fail at dpapi-protect-secret with CryptographicException0x80090034. | diagnosticCollected=true; securityAccepted/policyChanged/productionAccepted=false. No secret/blob/hash persistence, LOCAL=machine, service identity/profile change, key/ACL operation or App run. Services finish Stopped/Manual on bin-0.7.0-protection-diagnostic. Tested virtual-account DPAPI-NG is rejected on this host; causal split between missing profile and broader local provider behavior needs an explicitly approved identity/profile control. LIC008/Open003 and all release gates remain open. |
| `LIC-EV-0112` | 2026-10-04 | LIC008, LIC-OPEN-003 | Worktree after1cde30e; prepared0.8.0 ZIP SHA2567ba9c0a561ad2c0ba792bb386ec0b01a3c1237398fee2615c8b4b0fd0dc54b2d; manifestefbb2295ed8ea537b30cde5851be25f0a068cced0f33d0a221b28ff534ff9a63; executable12f1dfd8cbbc51126668a32ad19ec28cad0fb90e64b9ea761b81d15b49e9cb0a | Codex; development Windows; SDK10.0.400/runtime10.0.11 | Added separate LocalService Owner/Peer profile control with exact enabled service-SID token checks, independent LOCAL=user/exact-SID values, same-account peer contrast, fresh-process Owner verification, mandatory profile/HKU controls, prerequisite-safe refusal classification, buffer zeroing, fresh namespace and ACL-bounded reports/hashes. Initial missing Stage compile failure retained; first passing build rejected for pre-create SID resolution/root read ACL; later static-guard placement failure corrected. Final pure14/14 and package/static/parser guards PASS. | Preparation only; physical execution NOT_RUN. No service/profile/DPAPI operation, user/password, retained ComparisonV1/production Guardian change, LOCAL=machine, key/CNG ACL/TPM/DB/K40 mutation or adapter acceptance. Earlier output packages superseded. LIC008/Open003 remain open. See LICENSING_PROFILE_CONTROL.md. |
| `LIC-EV-0113` | 2026-10-04 | LIC008, LIC-OPEN-003 | User-run0.8.0; report `profile-control-524936c2734d48b4bc4ea402946842ec.json` SHA256f2cc9958914a568b59ea391a75a6c94f1c740beb9586aed592ec62e83fb59ff7 | Elevated current host | Controller stops in first Set-Rules AddAccessRule with IdentityNotMappedException because string SIDs were translated as account names. Read-only reconciliation confirms both services ABSENT, five exact directories empty, no bin/plan/role-report/blob/hash and reports=[]. | Harness failure before any service/profile/DPAPI operation. controlComplete/securityAccepted/policyChanged/productionAccepted false. Root/report retained;0.8.0 must not rerun. |
| `LIC-EV-0114` | 2026-10-04 | LIC008, LIC-OPEN-003 | Prepared0.8.1 ZIP SHA256b8cc5949305d348596bd93a044a91a72ef9e958c7167e4108a9f662c3f8a54be; manifestc203f419e43d643ad206fba2d364d12cfa72eb6e5a8a8da7f86db2af6897922c; executable12f1dfd8cbbc51126668a32ad19ec28cad0fb90e64b9ea761b81d15b49e9cb0a | Codex; development Windows; SDK10.0.400/runtime10.0.11 | ACL rules now use explicit SecurityIdentifier objects. Resume switch pins EV0113 report hash/content, exact empty inventory and absent services. Added real SID-ACL fixture proving SYSTEM/Admin/LocalService entries. Pure14/14 and package/static/parser/ACL fixture guards PASS. | Preparation only; physical0.8.1 NOT_RUN. No real service/profile/DPAPI/key/TPM/DB/K40 operation during correction. Production and policy acceptance false; LIC008/Open003 remain open. |
| `LIC-EV-0115` | 2026-10-04 | LIC008, LIC-OPEN-003 | User-run exact0.8.1; summary `profile-control-e096e3b29f80470d8a473fe7c60b9eba.json` retained under corrected root ACL | Elevated current host; read-only unelevated SCM reconciliation | ACL and creation of Owner/Peer Manual LocalService services succeed. Copy loop then throws ParameterBindingException because Windows PowerShell5 treats `clretwrc.dll` as unsupported third positional Join-Path argument. SCM shows both exact services Stopped/Manual/LocalService with expected role paths; protected root denies unelevated read as designed. | Harness compatibility failure before first file copy, plan, role report, service start or DPAPI. No acceptance change.0.8.1 must not rerun; exact elevated content/inventory verification is a0.8.2 precondition. |
| `LIC-EV-0116` | 2026-10-04 | LIC008, LIC-OPEN-003 | Prepared0.8.2 ZIP SHA256baf0a827f68b227e9dd9cd8a8bc7a4d0365d615e5d7675c42f606c3a00367922; manifest04be66db87a7d665c98285fdb701351c0405ac41cff8b32f25407997da5dfd6e; executable12f1dfd8cbbc51126668a32ad19ec28cad0fb90e64b9ea761b81d15b49e9cb0a | Codex; development Windows; SDK10.0.400/runtime10.0.11 | Uses nested two-argument Join-Path. Resume switch requires both exact reports, original digest,0.8.1 summary fields, exact empty inventory and exact stopped service identities/paths; it skips service creation. Permanent PowerShell5 path guard added. Pure14/14 and package/static/parser/ACL fixture/path guards PASS. | Preparation only; physical0.8.2 NOT_RUN. No service/profile/DPAPI/key/TPM/DB/K40 operation during correction. Production/policy acceptance false; LIC008/Open003 remain open. |
| `LIC-EV-0117` | 2026-10-04 | LIC008, LIC-OPEN-003 | User-run exact0.8.2; protected report `profile-control-e0ceb2bf81d4460ab901a441bb264d2f.json`; supplied transcript SHA25661a55fc856f1e65f57bdfc068d150bd7c3cb2c4f27b1ad099d8e3e9b11b765d1 (not report-file digest) | Elevated current host; OS10.0.22000; Owner/Peer LocalService with distinct enabled service SIDs attributes14 | All three rounds observe `C:\WINDOWS\ServiceProfiles\LocalService` and loaded HKU S-1-5-19. Owner LOCAL=user protect/unprotect/persist PASS and fresh Owner reopen PASS; Peer also decrypts it. Exact Owner-SID protect fails at dpapi-protect-secret with CryptographicException0x80090034, so downstream exact-SID blob probes correctly report missing prerequisite. | `controlComplete=false`; securityAccepted/policyChanged/productionAccepted=false. Both services finish Stopped. Valid profile disproves missing-profile-only explanation; LOCAL=user is overbroad and exact service SID unavailable on this standalone host. No rerun. Dedicated-account versus separate non-exportable wrapping-key design comparison requires explicit approval; LIC008/Open003 remain open. |
| `LIC-EV-0118` | 2026-10-04 | LIC008, LIC-REQ-011, LIC-6.4-006, LIC-6.6-002 | Product-approved platform review after EV0117; repository source/docs audit plus current Microsoft lifecycle/runtime references | Codex documentation review; no clean/physical target execution | Added authoritative Windows matrix; reconciled Packaging and Licensing contracts; defined supported LTSC releases, explicit exclusions, pre-mutation Setup contract, independent-machine rule and exact LIC008/Release obligations. Existing `win-x64` projects/build scripts confirm current artifact architecture; old broad Windows 10 Home/Pro compatibility language was superseded. | Scope/governance evidence only. No Installer/preflight code, service/key/TPM/DPAPI/DB/K40 operation or physical acceptance executed. All `WIN-V1-*` rows remain `NOT_RUN`; LIC008/Open003 and Release Gate remain open. |
| `LIC-EV-0119` | 2026-10-04 | LIC008, LIC-DEC-006, LIC-OPEN-003, LIC-6.5-002 | Product selected option 2 after EV0117/EV0118; official Microsoft CNG/KSP/NCrypt/RSA support review plus repository contract reconciliation | Codex design review; no physical execution | Added the purpose-separated Software-KSP wrapping design: RSA-3072/OAEP-SHA256 candidate, fresh AES-256-GCM envelope keys, export policy zero, exact SYSTEM+Guardian protected DACL, Setup-only creation, Guardian-only decrypt, lifecycle/recovery/clone limits and bounded fresh harness cases. | Documentation/design evidence only. No service, user, key, ACL, DPAPI, TPM, state, DB or K40 mutation; no production adapter or crypto schema implemented. Physical host and `WIN-V1-*` evidence remain NOT_RUN; LIC008/Open003 remain open. |
| `LIC-EV-0120` | 2026-10-04 | LIC008, LIC-DEC-006, LIC-OPEN-003, LIC-6.5-002 | Prepared0.9.0 ZIP SHA256180635242880586793e5e32b055140481ccf4101d745a34d91d2def15f3ba335 | Codex; development Windows; exact SDK10.0.400/runtime10.0.11 | Added fresh Setup/Guardian/App services and key namespace, RSA-3072 Software-KSP creation with export policy zero/decryption usage/protected DACL, explicit silent NCryptEncrypt/NCryptDecrypt OAEP-SHA256 wrapping of fresh AES-256-GCM keys, protected envelope persistence, public-identity/property/DACL/private-export verification, App/actual-child restricted versus App-readable A/B probes, wrong-key/wrapped-key/nonce/AAD/ciphertext/tag rejection, fresh Guardian reopen/decrypt, ownership-bound cleanup, exact supported-release/fresh-state controller gates and immutable manifest. Pure11/11, publish, PowerShell parser, source/API boundary and package-manifest guards PASS. | Preparation only: no controller execution, service installation, persisted key, ACL or state mutation. `securityAccepted`, `productionAccepted` and `matrixAccepted` remain false; ordinary interactive user, reboot/Repair/Upgrade/Uninstall, independent review and all physical `WIN-V1-*` rows remain NOT_RUN. LIC008/Open003 remain open. |
| `LIC-EV-0121` | 2026-10-04 | LIC008, LIC-REQ-011, LIC-6.4-006, LIC-6.6-002, LIC-OPEN-003 | Prepared0.9.1 ZIP SHA256bec531462aed69f9c7b4b62638a8b21fd7885c19a184046ffe468fc316ddc71f | Codex; development Windows; exact SDK10.0.400/runtime10.0.11 | Replaced the servicing-date/exact-release gate with fail-closed Windows 10 client x64 build14393+ or Windows 11 client x64 build22000+ admission; Server, non-x64 and active WindowsSelfHost/Insider remain rejected. Summary records exact caption/build/display version, the compatibility policy and `vendorLifecycleNotRequired=true`. Package version advanced to0.9.1; pure11/11, publish, parser, crypto/API and manifest guards PASS. | Preparation only: no service/key/ACL/state mutation. Current build22000 is now eligible for first-host feasibility, not fleet proof. S-mode production detection remains an Installer obligation. Physical execution, ordinary-user/lifecycle/remaining matrix and all acceptance gates remain NOT_RUN/open. |
| `LIC-EV-0122` | 2026-10-04 | LIC008, LIC-REQ-011, LIC-OPEN-003 | User-run exact0.9.1 transcript; current Windows11 Pro build22000 x64 | Elevated current host | Read-only platform preflight found `HKLM\SOFTWARE\Microsoft\WindowsSelfHost\Applicability`, then StrictMode direct access to absent `BranchName` raised PropertyNotFoundStrict. The key contains WNS values but no BranchName/ContentType/Ring. Read-only reconciliation confirms `C:\ProgramData\Ecs.Lic008.WrappingV1` absent and all three WrappingV1 services absent. | Pre-mutation compatibility-harness failure. No directory/service/key/ACL/state operation and no report.0.9.1 must not rerun. Security/production/matrix acceptance unchanged false/open. |
| `LIC-EV-0123` | 2026-10-04 | LIC008, LIC-REQ-011, LIC-OPEN-003 | Prepared0.9.2 ZIP SHA2565d1746f97e64f1d1af5541e7682c8d007733839647ece64de46c9f47d8c647b6 | Codex; development Windows; exact SDK10.0.400/runtime10.0.11 | Replaced direct optional Registry-member reads with exact PSObject property lookup; absent values return null, while present values retain exact string content. Added AST-extracted regression fixtures for the EV0122 missing-property shape and a present BranchName; direct `$appl.*` access is forbidden. Pure11/11, publish, PowerShell parser, Registry fixture, crypto/API and manifest guards PASS. | Preparation only; no service/key/ACL/state mutation. Physical0.9.2 is NOT_RUN. One execution is permitted only against the still-fresh WrappingV1 namespace; all acceptance gates remain open. |

| `LIC-EV-0124` | 2026-10-05 | LIC008 | User transcript from exact0.9.2 | Current Windows11 Pro x64 build22000; read-only reconciliation | First Sc create call resolves to built-in sc=Set-Content alias, prompting for Value then failing DriveNotFoundException. Script ordering places this after installation marker/package copy and before any service start/key creation. Root existence and zero WrappingV1 services independently confirmed; root contents denied to unelevated inspector and are not claimed hash-verified. | Retain WrappingV1 root and do not rerun0.9.2. No crypto evidence or acceptance; package contents inferred from script location, not independently enumerated. |
| `LIC-EV-0125` | 2026-10-05 | LIC008 | Prepared0.9.3 ZIP SHA256ba78c9502fe8cffb1734dc99877f83c78d013ca34e492fd6606dc06178d6a11a | Codex; SDK10.0.400/runtime10.0.11; Windows PowerShell | Fresh WrappingV2 root/services/key prefix/report scope and executable. Replaced Sc with Invoke-ServiceControl and explicit -Words arguments. Actual production wrapper exercised against inert child processes with built-in sc alias present: quoted command with spaces succeeds, exit7 propagates failure. AST guards forbid Sc calls/functions and old runtime namespace. Pure11/11, Registry fixture, parser, publish and manifest guards PASS. | Physical0.9.3 NOT_RUN; V2 root/services confirmed absent. No SCM/key/ACL mutation during preparation. V1 retained. Security/production/matrix acceptance remains false. |

New evidence rows must include the exact failing result as well as the later passing rerun; do not replace or sanitize historical failures.

### CHG0061 — wrapping controller alias correction (2026-10-05, r73)

Product authorized0.9.3 after EV0124. Use fresh `Ecs.Lic008.WrappingV2`
identities and `Invoke-ServiceControl -Words`; preserve the consumed V1 root.
EV0125 records executable alias/argument/exit-status regression evidence.
Cryptographic profile and security acceptance requirements are unchanged.

### CHG0062 — bounded interactive wrapping control (2026-10-05, r74)

User authorized the next interactive-user experiment after the successful V2
transcript. Preserve V1/V2 and use a fresh V3 namespace and separate source/kit.
The restricted key policy stays SYSTEM + Guardian. The A/B control key additionally
allows App and exactly the preselected interactive SID. Require an enabled
Interactive SID, Medium integrity, no elevation and no enabled Administrators
membership; record filtered-admin tokens separately, not as a standard-account test.
Prepare/Finish are one-shot; keep keys while paused and never replace missing keys.
Finish pins the installed manifest, plan, services, experiment/run/user/binary,
captures exact user-report bytes/hash, reruns Guardian and only then deletes owned
fresh keys. User-originated reports are diagnostic, not authenticated adversarial
evidence. Security, production and matrix acceptance remain false.

| Evidence | Date | Scope | Artifact | Executor | Result | Limits |
| --- | --- | --- | --- | --- | --- | --- |
| `LIC-EV-0126` | 2026-10-05 | LIC008 | User transcript SHA2562210af0530307c1857d78281253af378ae78f9c5efa71206245552f57ffbc569; V2 summary name wrapping-summary-7da3625af6f14f10b05b5bed5e1cf5be.json; package ZIP SHA256ba78c9502fe8cffb1734dc99877f83c78d013ca34e492fd6606dc06178d6a11a | User elevated; Codex read-only SCM | Transcript: Setup RSA/policy/DACL creation PASS; Guardian and fresh Guardian reopen/decrypt/private export refusal/tamper PASS; App/child restricted OBSERVED_BAD_KEYSET with readable control PASS; token/child PASS; owned-key cleanup PASS. All three V2 services independently Stopped/Manual. | Host feasibility only. Protected JSON unavailable unelevated; exact report hashes pending. Ordinary-user/lifecycle/matrix NOT_RUN. No global error reclassification or LIC008 closure. |
| `LIC-EV-0127` | 2026-10-05 | LIC008 | Prepared0.10.0 ZIP SHA256ab14b31ce634348502e5c85c9a6b0d64c5a303a00a8fdd72ee7989b8b86beb4c | Codex; SDK10.0.400/runtime10.0.11 | Pure20/20, actual non-elevated token capture (integrity8192, interactive attrs7, elevationType3), alias/quoting/exit fixtures, both kit parsers, manifest/publish and static crypto/token/continuation guards PASS. V3 root/services absent. | No service installation or persisted-key operation. Physical V3 NOT_RUN; filtered-admin token is not a standard-account test. No security/production/matrix acceptance. |

### CHG0063 — exact scope-failure continuation (2026-10-05, r75)

EV0128 exposed a test gap:0.10.0's service writer still emitted V2 scope while
the controller and interactive writer expected V3. Creation succeeded but the
controller correctly refused the report before Guardian/App/user probes.
Version0.10.1 centralizes ReportScope and adds an inert CLI exercising the SAME
service-report factory consumed by the controller, with identity-rejection tests.
Continuation accepts only the recorded V3 installation, original0.10.0 manifest/
binary hash, exact create run/experiment/user, full successful Setup report,
public key identities, empty Guardian/App report directories and stopped/manual
exact-account/path/service-SID inventory. After all read-only checks it writes a
one-shot intent, copies corrected bits into separate bin-0.10.1, changes only
the three V3 service paths and runs Guardian/App against existing keys. No key
creation, old-binary overwrite or protected/key ACL change occurs. Any mismatch
or partial continuation retains state. The legacy V2 scope exception exists only
in this exact original create-report validator, never in current report admission.

| Evidence | Date | Scope | Artifact | Executor | Result | Limits |
| --- | --- | --- | --- | --- | --- | --- |
| `LIC-EV-0128` | 2026-10-05 | LIC008 | User JSON: setup-reports/5a109d0ad27643c396e8c160902800b4.json; experiment c43b7dda51f7419099879fcb64efb8c6; original binary SHA2565326cbb9a4fdc8608ebb3dc90c0e349206eb5caeaabd8c17cef2ea0be2bba315; installed manifest SHA256d8e42f8cade07f25e3e6d7411d67ffc7c2cfd6d0cdfcb8355a7701ac67139370 | User elevated; Codex read-only public plan/control-set/manifest/binary/SCM | All21 Setup rows PASS, including both keys and control-set publication. Writer emitted TEST_ONLY_SOFTWARE_KSP_WRAPPING_V2; controller expected V3 and stopped with Report mismatch. Exact plan, public identities and installed hashes read independently; services Stopped/Manual. | Original JSON digest pending elevated continuation capture. No Guardian/App/user execution or cleanup; retain keys/root/old package. Prior pure/static tests missed emitter/controller mismatch. |
| `LIC-EV-0129` | 2026-10-05 | LIC008 | Prepared0.10.1 ZIP SHA256182922775385babc635be092dd058c2b1ff758843de867d1a6ce2615d8d5c87a | Codex; SDK10.0.400/runtime10.0.11 | Pure20/20, executable shared service-report factory/controller identity contract, wrong identity rejection, exact legacy21-row fixture with failure/duplicate/missing/identity rejection, alias/quoting/exit, optional Registry/version, kit parsers and manifest/source-byte guards PASS. | No SCM/key/ACL mutation during preparation. V3 remains stopped on original bin; bin-0.10.1 absent. ResumeScopeFailure physically NOT_RUN. Security/production/matrix remain false. |

### CHG0064 — bounded normal-reboot experiment (2026-10-05, r76)

EV0130 completes V3 continuation and non-elevated interactive contrast without
claiming a separate standard-account test. Its owned keys were cleaned up, so
user-authorized reboot work uses fresh V4/0.11.0 rather than resurrecting V3.
Prepare proves Setup/Guardian/App/child gates, records exact public envelopes/
reports/paused plan/package and host boot/machine evidence, then leaves keys
retained with all services Stopped/Manual. No automatic reboot or auto-start is
authorized. VerifyAfterReboot requires a later boot after preparation on the same
machine/build and matching bits, plan, evidence and service identities before its
one-shot intent and any service start. Missing/mismatched keys must fail, never
be replaced. Guardian verifies identity/policy/decrypt/export/tamper, App/actual
child repeat A/B controls, then Setup performs exact owned-key cleanup.
This is only normal user-controlled restart, not power loss, installer lifecycle,
TPM, standard-account or full Windows-matrix acceptance. Flags remain false.

| Evidence | Date | Scope | Artifact | Executor | Result | Limits |
| --- | --- | --- | --- | --- | --- | --- |
| `LIC-EV-0130` | 2026-10-05 | LIC008 | V3 summary wrapping-summary-a2742d6a8f774e3cbb8dd0569521cd3e.json SHA256d9814c711473fbda4432c41b82b4e5834d1823508df0d142893d0492600a3183; user report SHA256521ebb551756e4942ca6994443d9f8872e00d6df4548a010211caca3a413575f; installed0.10.1 manifest SHA25698756b670e2d348ba5602a3c5856b95922ce648fc3e94786d798217a1a419b25; legacy create-report digest e5b1ceaaece89b6b0bce839642bb20ec3e3b2b75c4c7ae964c7bf394c5797114 recorded by elevated controller | User elevated Resume/Finish, normal User-Probe; Codex summary/user/manifest/hash/SCM read-only | Guardian + fresh Guardian reopen/policy/decrypt/export refusal/tamper PASS; App/actual child and interactive restricted OBSERVED_BAD_KEYSET with readable decrypt control PASS. Elevated user attempt refused before probe; subsequent token has elevationType3, Medium8192, Interactive attrs7, elevated/admin=false. Owned-key cleanup PASS in transcript; summary hostFeasibilityPassed=true. All V3 services independently Stopped/Manual. | Filtered admin token, not independent standard-account test. Exact role digests are reported by controller, not independently reread. Security/production/matrix false. Normal reboot, repair/upgrade/uninstall, TPM/power-loss remain untested. Never rerun V3. |
| `LIC-EV-0131` | 2026-10-05 | LIC008 | Prepared0.11.0 ZIP SHA2561a986ecee846ad2c5ecfd73d2b952fb711ba720323188092673d7c0055feb68d | Codex; SDK10.0.400/runtime10.0.11 | Pure11/11, actual executable shared report factory/controller identity contract, wrong identity rejection, new-boot/UTC/unchanged/old/malformed timestamp rejection, changed evidence/name/count/hash fixtures, real inert7-file inventory/hash fixture, alias/quoting/exit, optional Registry/version, parser/publish/manifest/source-byte guards PASS. | No service/key/ACL operation or reboot during preparation; V4 root/services absent. Physical Prepare/VerifyAfterReboot NOT_RUN. V3 retained stopped with keys cleaned by accepted diagnostic sequence; no production/security/matrix acceptance. |

### CHG0065 — bounded binary-repair simulation (2026-10-05, r77)

EV0132 observes successful V4 normal restart, but it is not a completed installer
lifecycle matrix. The next authorized experiment is a fresh V5/0.12.0 lower-level
binary-repair simulation, not product Installer Repair. Prepare creates/checks
fresh keys and retains a package/plan/shared-envelope/report/machine checkpoint.
Repair reconciles that exact state; a live Guardian admission gate must pass key
identity, policy, decrypt, export refusal and tamper checks before any candidate
directory, candidate ACL or service-path write. Trusted identical-version bits
are staged separately; old bits, persisted key ownership and encrypted envelopes
are preserved. After Guardian/App/child recheck and shared-byte comparison, only
owned experiment keys are deleted. With those envelopes retained, the SAME live
admission boundary is invoked again and must refuse the deliberately missing
keys before any candidate/intent/service-path mutation or key recreation.
RECOVERY_REQUIRED here is a modeled harness refusal, not implemented production
Store recovery. Actual missing/corrupt binary restoration, signed Setup/MSI,
upgrade, interrupted repair, standard-account/TPM/matrix review remain open.

| Evidence | Date | Scope | Artifact | Executor | Result | Limits |
| --- | --- | --- | --- | --- | --- | --- |
| `LIC-EV-0132` | 2026-10-05 | LIC008 | User-pasted V4 summary wrapping-summary-47513d20e9864dcf84d40b8ace00b916.json; attachment transcript SHA256908d04344d77eaaef0f1cfd864ea313de82aad7a628ffdf8cf35d9b461b2084c; controller-reported checkpoint digest7417aae3163e3a35e0103303619844adcda021388c1816f02e8d288f10be62ea | User elevated Prepare/Verify after manual Windows Restart; Codex transcript review and read-only SCM | UTC bootBefore07:55:23.5000000 < prepared14:07:36.2351718 < bootAfter15:47:31.5000000, all2026-10-05. Summary normalRebootPassed/hostFeasibilityPassed/machineIdentityMatched=true. After-reboot Guardian policy/identity/decrypt/export/tamper PASS, App/actual child expected restricted BAD_KEYSET + readable decrypt PASS. Owned cleanup PASS. All V4 services independently Stopped/Manual. | Original protected JSON/checkpoint/role hashes are reported, not independently captured. Attachment digest is NOT original-summary digest. Ordinary user not repeated in V4; V3 filtered-admin result remains separate. Security/production/matrix false; no power-loss, actual installer or complete Windows row acceptance. Never rerun V4. |
| `LIC-EV-0133` | 2026-10-05 | LIC008 | Prepared0.12.0 ZIP SHA256d1f7e2dd40a0f2f7a833333e8fa4557ac7d14c2d7fba5bd9a4ef2173fb77e01a | Codex; SDK10.0.400/runtime10.0.11 | Pure11/11, executable shared report/controller contract and identity rejection, unchanged/changed/missing evidence fixtures, real inert7-file hashing fixture, each failed Guardian admission row and duplicate rejection, actual repair-boundary missing-key fixture with read-only probe mocks proving no candidate/intent write, alias/quoting/exit, optional version/Registry, parser/publish/manifest/source-byte guards PASS. | No service/key/ACL mutation or reboot during preparation; V5 root/services absent. Physical Prepare/Repair NOT_RUN. productionRepairTested=false, security/production/matrix false; test random envelopes, not real product License Store/Installer. |

### Physical V5 preparation checkpoint (2026-10-05)

| Evidence | Date | Scope | Artifact | Executor | Result | Limits |
| --- | --- | --- | --- | --- | --- | --- |
| `LIC-EV-0134` | 2026-10-05 | LIC008 | User Prepare transcript attachment31b7d2c5-472b-45ab-abc0-b9fb93aa8291; transcript SHA256a23ccfcd9199ee204e5d6b6cb856dbed94e6a4a602f534235d5fbd32a11a16e9; V5/0.12.0 package from EV0133 | User elevated Prepare; Codex transcript review and read-only SCM | Both key creations/publish PASS; Guardian policy/decrypt/export/tamper controls PASS; App and actual child restricted OBSERVED_BAD_KEYSET with readable-key decrypt, token and execution PASS. PREPARED_FOR_REPAIR printed; all three V5 services independently Stopped/Manual. | Keys intentionally retained according to controller output. Original protected reports/checkpoint not independently read or hashed. Repair NOT_RUN; no production Repair/security/matrix acceptance. Do not rerun Prepare. Next: Repair once from the same package; no reboot. |

### CHG0066 — record physical binary-repair simulation (2026-10-05, r78)

EV0135 completes the V5/0.12.0 host experiment prepared by CHG0065 and EV0134.
This changes evidence status only, not the production design or release gates.
Original and repaired package manifest hashes match; the reported existing-key
identity and persisted envelope bytes remain unchanged across separate binary
staging. Guardian controls and App/actual-child contrast pass before cleanup.
After owned-key deletion, the same admission boundary refuses missing keys without
recreation; its expected FAILED_OR_UNAVAILABLE rows accompany controlled refusal
PASS and the final summary. Do not rerun Prepare/Repair or remove retained reports.
LIC006/007/008 remain in progress. Actual signed Installer Repair, Upgrade,
interrupted operation, TPM, separate standard-account and full matrix coverage
remain open. No next implementation experiment is authorized by this record.

| Evidence | Date | Scope | Artifact | Executor | Result | Limits |
| --- | --- | --- | --- | --- | --- | --- |
| `LIC-EV-0135` | 2026-10-05 | LIC008 | V5 summary wrapping-summary-de5efc93255841619c9f86f2570af292.json pasted in attachmentb0a6f92b-9675-47b6-a455-40abfd2437e5; transcript SHA25696d680d2d2f68eb9b68b8b1df784606eab4318da20881d302f00f063d6d5ba58; Repair output attachmentddbd0633-b69c-4a73-8a43-29cf48fe84cf | User elevated Repair/Get-Content; Codex transcript review and read-only SCM | Summary schema1/scopeV5/version0.12.0, experiment91fa20b415734ed0a9b7838c607ee709, UTC2026-10-05T16:21:46.0956348Z, Windows11 Pro21H2 build22000. repairSimulationPassed/hostFeasibilityPassed/sameKeyIdentityVerified/sameEnvelopeBytesVerified/missingKeyRepairRefused=true; keyRecreationAttempted=false. Both manifests aa4b776de01e5008db2a025e79390bb99f14b314605d64ac6b1a700205aa712c. Guardian controls, App/actual-child contrast and owned-key cleanup PASS; final missing-key0x80090016 diagnostics followed by controlled refusal PASS. Summary lists12 evidence files; all three services independently Stopped/Manual. | Reported checkpoint SHA256adb4aa66402c671f50d21bbcdca84dc619341ffc5108ea1c7bdcd7fb20a7b1d8 and12 evidence digests are not independently captured from protected originals. Attachment hash is NOT the original summary hash. productionRepairTested/securityAccepted/productionAccepted/matrixAccepted=false; ordinaryUserNotTested=true for V5 (V3 filtered-admin evidence remains separate). Test random envelopes, not production Store or signed Installer Repair. Never rerun V5. |

### CHG0067 — synchronize current status and select bounded Upgrade plan (2026-10-06, r79)

Product Owner authorized the immediate documentation/planning step after checking
whether it already existed. EV0135 Repair results were already recorded and are
not duplicated or rerun. The wrapping header, current physical summaries and
LIC008 live checklist row are reconciled with those results; historical rows
remain unchanged. The selected next LIC008 feasibility experiment is defined in
[LICENSING_WRAPPING_UPGRADE_PLAN.md](../plans/LICENSING_WRAPPING_UPGRADE_PLAN.md): two distinct
managed artifacts/closed manifests, same test keys/envelopes, preserved isolation,
invalid-candidate/retained-state refusal and incomplete-version-set admission
guards. Planning only: no source, kit, build or physical execution is authorized
by this step. Production dependencies/LIC-OPEN-003/012 and release gates unchanged.

| Evidence | Date | Scope | Artifact | Executor | Result | Limits |
| --- | --- | --- | --- | --- | --- | --- |
| `LIC-EV-0136` | 2026-10-06 | LIC008 planning/status synchronization | LICENSING_WRAPPING_UPGRADE_PLAN.md and synchronized master/mirrors; base f40b8d5 plus preserved r78/EV0135 docs | Codex; planning requested by Project Owner | Duplicate-work check across current docs, wrapping source/kit/build/test names, Git history and local out/*upgrade* found general Upgrade requirements but no separate plan/controller/kit/output. Current V5 result not repeated. OLD/NEW artifact distinction, stage boundaries, eight NOT_RUN acceptance cases, safe failure retention and no-create/mixed-version gates documented. Local documentation checks recorded in the plan after validation. | Documentation only. No application, service, key, ACL, DB, K40 or production artifact mutation. Build/physical Upgrade and all acceptance flags remain unproved; no LIC008 closure or native-entry dependency waiver. Implementation needs separate authorization and physical stages need reviewed mutation manifest/operator approval. |

### CHG0068 — prepare two-artifact Upgrade kit (2026-10-06, r80)

After committing the planning record as 8e4d3c3, the Product Owner authorized the
next implementation/build step under LIC008. Fresh WrappingV6 service sources,
controller and inert tests now produce OLD0.13.0 and NEW0.13.1 closed win-x64
artifacts with distinct managed DLL hashes and compiled report versions. The
service plan/report binds the actual EXE, managed DLL and package manifest; NEW
refuses creation. The controller pins retained state and requires OLD Guardian
admission before candidate staging. Manual role paths switch while stopped;
complete-set verification and an activation record gate every later Run before
plan write/start. Failure retains intent and does not recreate keys or auto-resume.
Only proven experiment keys are deleted after all continuity/isolation gates pass.
The exact prospective mutation manifest and operator commands are in the Upgrade
plan. Actual Installer upgrade, native fault/interruption, security/matrix/production
acceptance and LIC-OPEN-003/012 remain open. No production code/decision changes.

| Evidence | Date | Scope | Artifact | Executor | Result | Limits |
| --- | --- | --- | --- | --- | --- | --- |
| `LIC-EV-0137` | 2026-10-06 | LIC008 V6 inert preparation | Kit0.13.0 ZIP SHA2567eedbc84df86c1a3b8c05ee44ab4a358d9e2ee93ab7bb46cc52bb9be697b9dde; kit manifest faaf4e56086366bd7fdb44f636b0768db8a260322b450aa6724ae34b1ca63b74; OLD DLL c5dbe73523561cea8295760ac81d24775b6f0a62a51ca9eebf1e0d3db8ec2436; NEW DLL84ddb0d4587add54fbe667cf648f6f157b86481a7ffe80778eaac458287dd84a | Codex; SDK10.0.400/runtime10.0.11; planning base8e4d3c3 | Both publish and pure13/13 PASS. Actual shared report factory/controller contract, wrong version/scope/role/action/run/experiment/EXE/DLL/manifest/acceptance flags, distinct managed versions, package/source bytes, unknown/downgrade/same-code, real inert package/inventory/no-overwrite and traversal/tamper/missing/duplicate negatives PASS. Actual boundary with inert copied files and mocked SCM/ACL/crypto/package dependencies passes missing-key/identity refusal, after-staging and partial-SCM failure, mixed-set real Run refusal before plan/start, and successful activation. Optional Registry/version/parser/alias/quoting/exit/source crypto guards PASS. V6 root/services absent before/after build. | Physical Prepare/Upgrade NOT_RUN. No persisted-key/service/ACL/DB/K40 operation or consumed V1-V5 rerun. Native invalid-state and interruption tests remain false; mocks are not power-loss evidence. Cached feed used with NuGet audit disabled. Unsigned test artifacts, no publisher authentication or independent Security acceptance. productionUpgradeTested/security/production/matrix remain false; LIC008/Open003/012 unchanged. |

### CHG0069 — record physical Upgrade simulation result (2026-10-06, r81)

User completed V6 Prepare and Upgrade, supplied the final summary, then requested
documentation/checklist update and commit. EV0138 records OLD0.13.0 to NEW0.13.1
continuity, role controls and owned cleanup PASS on the current host. A repeated
Prepare was refused before mutation. All three V6 services independently observed
Stopped/Manual on bin-new. Keep the consumed artifacts/reports/intents; never
rerun either stage or recreate keys. No production source or security-policy change.
LIC008 remains in progress; Open003 remains open and Open012 blocked. Reconcile
original protected evidence and review remaining gaps before choosing the next
bounded experiment; actual Installer, interruption, TPM, separate standard account,
Windows matrix and independent Security acceptance remain open.

| Evidence | Date | Scope | Artifact | Executor | Result | Limits |
| --- | --- | --- | --- | --- | --- | --- |
| `LIC-EV-0138` | 2026-10-06 | LIC008 V6 physical binary Upgrade simulation | Summary wrapping-summary-1225a3288609492a8fb0803c005c6796.json; experiment b0d47d4451d14ecaa423eaaad40f0491; UTC07:33:53.5771655Z; summary transcript attachment297bfffc-49ec-4092-b0b6-bdb8ef3f1e7b SHA256255c7d269d282258e098914078ace6bab5b5736305cf8593d1e99915b325890c; reported checkpoint62d79f5a09637a96b0c63ce3d99178ea524d7a416b875a7e52835816deefe779; kit/artifact hashes match EV0137 and Upgrade plan section9 | User elevated Prepare/Upgrade; Codex transcript/summary review and independent read-only SCM; Windows11 Pro21H2 x64 build22000 | Setup creation and OLD Guardian/App/actual-child baseline PASS; PREPARED_FOR_UPGRADE. Repeated Prepare refused at existing-root gate before mutation. OLD admission, three path changes, NEW Guardian/App/child artifact0.13.1 and owned-key cleanup PASS. Summary upgradeSimulationPassed/hostFeasibilityPassed/distinctManagedArtifactsVerified/sameKeyIdentityVerified/sameEnvelopeBytesVerified/oldFilesPreserved=true; keyRecreationAttempted=false. Three services independently Stopped/Manual on bin-new, PID0. | Pasted transcript digest is NOT original summary hash. Eleven evidence hashes and checkpoint hash are reported, not independently captured; protected access denied, no ACL widening. productionUpgradeTested/security/production/matrix/physical interruption/physical invalid-state flags=false; ordinaryUserNotTested=true. No actual Installer/TPM/Windows-matrix/independent Security acceptance. V6 consumed; never rerun. LIC008/Open003/012 unchanged. |

### CHG0070 — reconcile V6 original-file hashes (2026-10-06, r82)

User supplied separate elevated read-only Get-FileHash verification. EV0139 records
original-summary digest, matching checkpoint and all eleven matching evidence files.
This supersedes only the V6 operator hash gap at EV0138; no independent Security
acceptance, direct Codex protected-file access or V4/V5 hash closure is claimed.
No service/key/ACL mutation or consumed test rerun. Existing gates unchanged.

| Evidence | Date | Scope | Artifact | Executor | Result | Limits |
| --- | --- | --- | --- | --- | --- | --- |
| `LIC-EV-0139` | 2026-10-06 | V6 original-file hash reconciliation | Original summary7b95d1e086b91de870445b7ed1e84c4f40fe83a6faa9c5e8fe20cf51de221517; checkpoint62d79f5a09637a96b0c63ce3d99178ea524d7a416b875a7e52835816deefe779; eleven evidence files listed in Upgrade plan section9 | User elevated read-only PowerShell; Codex output review | Checkpoint matches prior summary; all11 original evidence files Match=True; original summary hash captured separately from attachment hash. | Operator-supplied output, not independent Security review or direct Codex capture. V4/V5 hash gaps, production/matrix/interruption/invalid-state gates unchanged. No rerun, service/key/ACL operation. |

### CHG0071 — plan retained-data Uninstall/Reinstall simulation (2026-10-06, r82)

User authorized recording EV0139 and preparing the next plan. Added
[retained-data reinstall plan](../plans/LICENSING_WRAPPING_REINSTALL_PLAN.md): proposed fresh
V7 namespace, three separately reviewed one-shot stages, exact owned registration
removal only, retained keys/records/envelopes/ACLs/binaries, identity-pinned
reinstallation without creation, continuity/isolation controls and separate final
owned-test cleanup. Collision/missing-key/identity/partial-operation negatives are
required; mock evidence does not imply physical interruption acceptance.
This is planning, not implementation or approval to uninstall production or V1-V6.

| Evidence | Date | Scope | Artifact | Executor | Result | Limits |
| --- | --- | --- | --- | --- | --- | --- |
| `LIC-EV-0140` | 2026-10-06 | LIC008 retained-data reinstall planning | LICENSING_WRAPPING_REINSTALL_PLAN.md; baseline39d1f7e plus documentation worktree | Codex documentation review | Lifecycle contract, fresh namespace, retained-data boundaries, staged operator review, no-key-recreation gate, required negatives and evidence limits recorded. | PLANNING_ONLY. No sources/kit/build/native test or physical uninstall/reinstall. No service/key/ACL/DB/K40 mutation. No real Installer, power-loss, TPM, Windows-matrix or independent Security acceptance; LIC008/Open003/012 unchanged. |

### CHG0072 — prepare retained-data reinstall kit (2026-10-06, r83)

User authorized the next implementation after documentation reorganization and
post-commit duplicate-work audit (base63a330a). Existing old Cleanup deletes keys
and therefore is not a retained-key reinstall test; V6 explicitly lists it untested.
Added fresh V7 service/controller/build/inert tests without changing Native,
ServiceHost, TokenEvidence or backend runtime. Compiled create guard blocks
post-prepare/lifecycle-intent key recreation; Guardian snapshots five protected
file hashes/DACLs and protected-directory DACL in addition to key-policy checks.
The three operator-reviewed stages implement only test SCM registration removal/
recreation; retained bits are not removed, so real Installer acceptance is excluded.
Partial operations retain intent and refuse startup/automatic continuation.

Publish/pure17/17 and actual helpers/inert boundaries PASS. Initial fixture lacked
kitRoot; partial-deletion assertion exposed it before ZIP emission. Diagnostic and
corrected full rerun plus fresh final build PASS; failed first output remains
superseded, with no physical run. Exact package/hashes/mutation manifest recorded
in [reinstall plan sections6/7](../plans/LICENSING_WRAPPING_REINSTALL_PLAN.md).
Next: review resources and run Prepare once elevated; review output before later
stages. LIC008 stays in progress, Open003 open, Open012 blocked. No production
adapter, unsigned publisher or independent Security acceptance.

| Evidence | Date | Scope | Artifact | Executor | Result | Limits |
| --- | --- | --- | --- | --- | --- | --- |
| `LIC-EV-0141` | 2026-10-06 | LIC008 V7 inert preparation | Kit0.14.0 ZIPfcb833814fde7004c2485dda26739eaa81aa66aa02a97893c8bf3650034203ec; kit manifest8f2b6a599d1042d9d4285abf692f3fe73368d034bbe69aab9ef3607d3d8ecb15; BIN manifestf39e94e091f64996f1c4af530412402b2055dd883618b19e525e2f89695c4818; managed DLL40225fa9cea55ca7014989f4d1bff6f9205e15ced26c6f1a9869452040c59fa1 | Codex; SDK10.0.400/runtime10.0.11; base63a330a | Publish/pure17/17 PASS. Actual emitter/identity/package/source and real inert IO/DACL/protected inventory/SID/checkpoint negatives PASS. Actual lifecycle boundaries with mocked SCM/crypto/package test missing-key/protected drift before delete, partial deletion, collision, partial creation/SID mismatch with real Run refusing before plan/start, post-reinstall refusal and successful registration cycles. Optional Registry/alias/quoting/exit/parser/native crypto boundaries PASS. Initial fixture missing kitRoot fixed; failed package never handed off. | Physical Prepare/Uninstall/Reinstall NOT_RUN; V7 root/services absent during build. No persisted-key/SCM/ACL write/customer DB/K40 operation, no consumed V1-V6 rerun. Fixture negatives are not real interruption/invalid-state acceptance; retained binaries mean no actual Installer file removal. NuGet audit disabled for cached feed, unsigned artifacts. productionUninstallTested/productionReinstallTested/security/production/matrix false; ordinary-user/TPM/Windows-matrix/independent review gaps remain. |

### CHG0073 — record V7 physical lifecycle transcripts (2026-10-06, r84)

Records the operator-reviewed Prepare, Uninstall and Reinstall outputs from the
same EV0141 kit. Prepare creation/publication and six Guardian controls PASS;
App/actual-child restricted BAD_KEYSET plus readable positive control, token,
artifact0.14.0 and execution PASS. Uninstall reran six Guardian controls before
three successful DeleteService calls and UNINSTALLED_RETAINED_DATA. Reinstall
recreated three registrations, passed Guardian/App/actual-child controls and
deleted both exact owned test keys successfully. Read-only SCM after Reinstall
independently shows three Stopped/Manual services, PID0. V7 is consumed.

The final summary was emitted, but its protected contents were inaccessible to
the unelevated reviewer and have not yet been pasted. Do not record its boolean
continuity assertions or original hashes as independently verified. Capture the
existing summary/checkpoints/evidence read-only next; never rerun any V7 stage.
No actual product Installer, clean Windows matrix, TPM/NV, separate standard
account, physical interruption or independent Security acceptance. LIC008 remains
in progress; Open003 open and Open012 blocked. See reinstall plan section8.

| Evidence | Date | Scope | Artifact | Executor | Result | Limits |
| --- | --- | --- | --- | --- | --- | --- |
| `LIC-EV-0142` | 2026-10-06 | LIC008 V7 physical retained-data service-registration lifecycle | EV0141 kit0.14.0; Prepare attachment3b7c28db-a7e5-4cc6-95d9-b90b2d64ed88; user-pasted Uninstall/Reinstall console outputs; uninstall-checkpoint.json; emitted wrapping-summary-6ab84a1dfeee472db6dfb2a20ffa3315.json | User elevated staged execution; Codex transcript review and read-only SCM | Prepare creation/publication and Guardian/App/actual-child controls PASS; Uninstall six Guardian PASS, exactly three DeleteService SUCCESS and retained-data completion marker; Reinstall three registrations recreated, six Guardian controls and App/actual-child positive/isolation/token/artifact/execution PASS, both owned-key cleanup PASS. Three services independently Stopped/Manual, PID0 after Reinstall. | Console evidence, not original summary contents/digests. Summary/checkpoint/evidence hashes pending; retained bytes/DACLs/SIDs/key identity are enforced by controller gates but not independently attested. No actual Installer file removal, TPM/matrix/standard-account/interruption/independent Security acceptance; production and security gates remain open. Never rerun V7. |

### CHG0074 — V7 summary/hash reconciliation and status synchronization (2026-10-06, r85)

The user supplied the final V7 summary and a separate elevated read-only SHA256
capture. Summary scope/version/kit, result and false acceptance flags, three
Stopped/Manual/PID0 services and11 evidence/5 protected records were checked.
Both original checkpoint hashes match the summary; all11 evidence files Match=True.
The original summary digest is captured, distinct from the transcript digest.
This closes the V7 evidence-content/operator-byte-hash gap, not LIC008 or any
Security/production/matrix gate. DACL hashes are Guardian-reported, not independently
remeasured by the operator command. V4/V5 evidence gaps and Open003/012 remain.
Current UI/Attendance/Backup mirrors are synchronized only against existing accepted
evidence; no new full-app, physical K40, service, key or DB test is claimed.

| Evidence | Date | Scope | Artifact | Executor | Result | Limits |
| --- | --- | --- | --- | --- | --- | --- |
| `LIC-EV-0143` | 2026-10-06 | V7 summary content and operator hash reconciliation | Original summary SHA256cc8d7464fedb6b20b9adeae2d0e34f1aff483b3f481b975a74a1632ef9ffb586; Prepare655033bafa4d3d363ef78074006603995a3234c712dc5cff6a9bd26c74998929; Uninstall92cc111baeec627e419c56e89486e5d2ed51bb390c773fec9a6e4be5df87f418; [full evidence ledger](../evidence/wrapping-v7-operator-verification.md) | User elevated read-only commands; Codex supplied-JSON/transcript review | Correct kit/artifact/scope; lifecycle/key/envelope/protected-byte/SID/DACL/cleanup flags PASS, no key recreation; both checkpoints and all11 evidence byte hashes match. | Operator evidence, not independent Security review; original JSON not archived here. Current DACLs/protected files not independently rehashed; no actual Installer/TPM/Windows matrix/standard-account/interruption acceptance. V7 consumed, never rerun; LIC008/Open003/012 unchanged. |

### CHG0075 — Concrete native-entry amendment, pending Security review (2026-10-06, r86)

User approved proceeding with the bounded-entry proposal. The
[version1 amendment](../plans/LICENSING_NATIVE_ENTRY_AMENDMENT.md) records Product
direction approval, six conjunctive entry prerequisites, seven integration
contract boundaries, an explicit entry graph and the exact master locations for
later synchronized adoption. Security Reviewer is not assigned and Security
approval has not been obtained. Codex's implementer/documentation review is not
independent approval. Sections16/17.1 and their dependency cells remain effective
unchanged; Open012 stays `[!]`. Full FILE/STORE, item, phase and release exits are
retained. Next: assigned Security review and disposition before adoption, then
complete missing entry prerequisites. No production implementation, Windows
mutation, physical test, consumed-kit rerun or new commit is claimed.

| Evidence | Date | Scope | Artifact | Executor | Result | Limits |
| --- | --- | --- | --- | --- | --- | --- |
| `LIC-EV-0144` | 2026-10-06 | LIC-OPEN-012 planning amendment | Baseline5ceffad plus preserved r85 documentation; native-entry amendment v1 | Product direction: user; draft and repository checks: Codex | Concrete ledger prepared; Product direction approved; 18-node graph acyclic, docs42/163 links and resolver self-tests, exact Node24.19.0 protocol checks and diff check PASS | Draft only; Security review/approval absent, effective dependencies unchanged, Open012 blocked; no native-entry acceptance or runtime/release authority |

### CHG0076 — Targeted native-entry v1 review, changes required (2026-10-07, r87)

User authorized the next review step. The author Codex performed a separate
targeted security/dependency review, not independent Security approval.
[Review record](../reviews/LICENSING_NATIVE_ENTRY_REVIEW.md) pins the exact v1
SHA256 and records two adoption blockers: adapter-entry versus full matrix
acceptance ambiguity (NER-001), and missing exact per-row dependency replacement
instructions (NER-002). Evidence-invalidation rules require clarification
(NER-003). The explicit graph alone cannot prove expanded gate acyclicity.
Current dependencies, Open012 `[!]`, LIC008/Open003 and all full exit requirements
remain unchanged. Next: revise the draft with dispositions, then assigned
Security review and final Product confirmation before adoption. No runtime code,
Windows mutation, physical run or commit.

| Evidence | Date | Scope | Artifact | Executor | Result | Limits |
| --- | --- | --- | --- | --- | --- | --- |
| `LIC-EV-0145` | 2026-10-07 | Native-entry v1 targeted review | Reviewed draft SHA256aeaed9cd718ee9adfb7ccb5d4d891f8a0ee789f4a679e8ee61f06e18e20ed4f8; master/matrix and selected source contracts | Codex, amendment author, separate review pass | CHANGES_REQUIRED: NER-001/002 blockers and NER-003 clarification; explicit18-node graph, docs43/172 links/self-tests, Node24.19.0 protocol and diff checks PASS; reviewed bytes unchanged | Not independent Security approval or native/production acceptance; existing worktree preserved, effective dependencies/statuses unchanged |

### CHG0077 — Revised native-entry v2 draft (2026-10-07, r88)

User authorized draft correction. [V2 amendment](../plans/LICENSING_NATIVE_ENTRY_AMENDMENT_V2.md)
addresses NER-001..003: explicitly proposed bounded ADAPTER_ENTRY with full
LIC008/Open003/Windows matrix acceptance retained; expanded design/implementation
nodes and per-row old/new entry dependencies; artifact/scope/revision evidence
pins and transitive invalidation/rerun rules. V1 reviewed bytes are preserved.
Responses are ADDRESSED_IN_DRAFT, not independent acceptance. Current sections16/
17.1 and dependency cells remain unchanged; Open012 `[!]`, Open003 and incomplete
items retain their status. Next: assigned exact-revision Security review and final
Product confirmation before synchronized adoption; entry evidence still required.
No production code, service/key/ACL/DB change, physical experiment or commit.

| Evidence | Date | Scope | Artifact | Executor | Result | Limits |
| --- | --- | --- | --- | --- | --- | --- |
| `LIC-EV-0146` | 2026-10-07 | Native-entry v2 draft correction | Baseline5ceffad plus preserved r87 worktree; v2 SHA25688dc75f17f85f0a57e05d2a6a9648800637a1b1b3d0611a257c3a0e541fd1444 | Codex author; user authorized revision | NER-001..003 addressed in draft; expanded34-node graph and all11 row mappings PASS; docs44/179 links/self-tests, Node24.19.0 protocol and diff checks PASS; v1 hash unchanged | Independent Security/final Product acceptance pending; no effective dependency or completion change, runtime authority or native acceptance |

### CHG0078 — Independent agent review of committed v2 (2026-10-07, r89)

User explicitly authorized a separate read-only agent review after commit8a01e68.
Reviewer `/root/native_entry_security_review` independently reviewed the exact
committed v2 digest and its canonical/source boundaries. Scoped technical
acceptance: no reproducible blocking finding; NER-001..003 addressed within this
draft. [Full review record](../reviews/LICENSING_NATIVE_ENTRY_V2_INDEPENDENT_REVIEW.md)
distinguishes independent-agent checks from coordinator protocol execution.
This is not formal external Security approval or final Product confirmation.
V1/V2 bytes unchanged; current dependencies and statuses unchanged, Open012 `[!]`.
No native implementation, Windows mutation, entry completion or release authority.
Next: record formal Security acceptance/final Product confirmation before adoption,
then satisfy all named entry prerequisites before any bounded implementation.

| Evidence | Date | Scope | Artifact | Executor | Result | Limits |
| --- | --- | --- | --- | --- | --- | --- |
| `LIC-EV-0147` | 2026-10-07 | Independent-agent v2 scheduling review | Commit8a01e682b4a351b2554a995d7585e91661f9f2f2; v2 SHA25688dc75f17f85f0a57e05d2a6a9648800637a1b1b3d0611a257c3a0e541fd1444 | Reviewer native_entry_security_review; coordinator Codex | Scoped acceptance, no blocker;34-node graph/11 mappings and docs44/179/self-tests/hash/blob/diff PASS; Node22.19.0 planning checks; coordinator Node24.19.0 protocol PASS separately | No formal external Security/final Product approval, adoption, native entry, physical or production acceptance; review report added after reviewed clean baseline |

### CHG0079 — Product confirmation and native-entry readiness audit (2026-10-07, r90)

User explicitly agrees to the explained construction order and asks to proceed.
[Readiness record](../plans/LICENSING_NATIVE_ENTRY_READINESS.md) records final
Product confirmation of exact committed v2 and six remaining entry gates.
Independent-agent technical review exists; formal scoped Security reviewer
designation/acceptance remains pending. Coordinator requests the missing role
choice; no human-only/external-review requirement is invented and no author
self-approval is substituted. Existing canonical dependency cells remain unchanged
and Open012 `[!]`. No native entry, implementation or full-item completion.

| Evidence | Date | Scope | Artifact | Executor | Result | Limits |
| --- | --- | --- | --- | --- | --- | --- |
| `LIC-EV-0148` | 2026-10-07 | Product confirmation and read-only native-entry audit | V2 commit8a01e68/SHA25688dc75f17f85f0a57e05d2a6a9648800637a1b1b3d0611a257c3a0e541fd1444; master and tracked source/project inventory | User Product confirmation; Codex coordinator audit | Product confirmation recorded; six entry gaps enumerated, NATIVE NOT_READY | Security role/acceptance pending; no adoption, independent physical proof, Vendor completion, native or production authority |

### CHG0080 — Adopt reviewed native-entry scheduling amendment (2026-10-07, r91)

Product confirms v2 and requests finalization. Existing independent non-author
agent `/root/native_entry_security_review` accepts the explicitly scoped amendment
Security role and returns SCOPED_SECURITY_APPROVAL_FOR_SCHEDULING_AMENDMENT_ADOPTION
for exact committed v2 digest. [Adoption record](../plans/LICENSING_NATIVE_ENTRY_ADOPTION.md)
records both approvals and agent-versus-human/runtime/release limits. Sections16/
17.1 and all11 native/storage dependency cells synchronize to reviewed v2; full
exits retained, Open012 closes scheduling-only. Native entry NOT_READY; no other
item/Open closure, code/physical mutation or native implementation authorization.

| Evidence | Date | Scope | Artifact | Executor | Result | Limits |
| --- | --- | --- | --- | --- | --- | --- |
| `LIC-EV-0149` | 2026-10-07 | Scoped scheduling adoption | Exact v2 commit8a01e68; SHA25688dc75f17f85f0a57e05d2a6a9648800637a1b1b3d0611a257c3a0e541fd1444; adoption record | User Product approval; scoped agent Security Reviewer native_entry_security_review; coordinator Codex | Scoped Security approval and Product confirmation; reviewed scheduling policy adopted, Open012 `[x]` only | No NE gate accepted, native/runtime/provider/Windows/production/release acceptance; all existing full exits remain required |

### CHG0081 — Existing adapter evidence and gap ledger (2026-10-07, r92)

User authorized mapping existing security-adapter tests, not a new physical run.
[Candidate ledger](../plans/LICENSING_ADAPTER_ENTRY_EVIDENCE_LEDGER.md) maps14
requirements and9 gaps with original owners. V2/V3/V4/V5/V6/V7 observations,
operator versus independent provenance and test-only lower-assurance scope are
explicit. Source inspection confirms candidate parameters/checks, not fresh
crypto/Windows execution. Original V2/V4/V5 hashes, independent standard user,
physical interruption/invalid states, TPM/NV, actual signed Installer, final
schema/Store and full platform/adapter acceptance remain open. NE-002 remains
NOT_ACCEPTED; no native-entry or other item completion. Open012 scheduling closure
unchanged. Next: named scope/acceptance review and retained-evidence custody
assessment, then versioned integration contract records; never rerun consumed kits.

| Evidence | Date | Scope | Artifact | Executor | Result | Limits |
| --- | --- | --- | --- | --- | --- | --- |
| `LIC-EV-0150` | 2026-10-07 | Existing adapter evidence inventory | Baseline8a01e68 plus preserved r91 docs; existing EV0126/0130/0132/0135/0138/0139/0142/0143 and selected source SHA256 pins in ledger | Codex evidence mapper | Candidate14 requirement/9 gap rows;4 source pins match; docs48/218/self-tests, Node24.19.0 protocol and diff checks PASS; no new physical result | Adapter owner/reviewer/acceptance pending, NE-002 NOT_ACCEPTED; one-host test-only Software evidence, no production/provider/fleet/TPM/Store approval |

### CHG0082 — Bounded adapter scope assessment and custody probe (2026-10-07, r93)

User authorized the next limited review. Author Codex prepares
[scope assessment](../reviews/LICENSING_ADAPTER_ENTRY_SCOPE_ASSESSMENT.md):
historical evidence reuse limits, six pre-acceptance dispositions and all9 gap
placements under original owning gates. This is not independent adapter approval
or permission to defer required evidence. V6/V7 cannot substitute V4 reboot/V5
missing-key cases. Read-only SHA256 attempts for exactly5 retained V2/V4/V5
summary/checkpoint files all fail ACCESS_DENIED; no original digest obtained,
no absence/corruption inference and no ACL workaround. NE-002 NOT_ACCEPTED,
native entry NOT_READY; Open012 scheduling closure unchanged. Next: elevated
operator read-only evidence reconciliation where available, accepted contracts
and separately assigned non-author adapter scope review, without consumed-kit reruns.

| Evidence | Date | Scope | Artifact | Executor | Result | Limits |
| --- | --- | --- | --- | --- | --- | --- |
| `LIC-EV-0151` | 2026-10-07 | Limited adapter scope/custody assessment | Input ledger SHA2565f6612a8fec22e1ec7c36fbf8c8cdc946b699d957dd51768d1048099047f1266;5 explicit retained summary/checkpoint paths | Codex ledger author/coordinator | Reuse and pre-entry/integration/release boundaries documented;5 read-only hash attempts ACCESS_DENIED, no digest | Not independent adapter Security acceptance; no physical/harness/key/ACL/service/DB mutation, no gate completion |

### CHG0083 — Elevated fixed-path original hash capture (2026-10-07, r94)

User authorizes reading the five retained originals with admin access.
Coordinator adds a fixed-path read-only collector, checks parser/inert inventory,
then launches OS RunAs elevation (hidden helper). All5 original hashes captured;
V4/V5 checkpoint digests match historical reported values. Output is a new
workspace/out diagnostic only; no controller/service/key/ACL/protected-file write.
[Result ledger](../evidence/wrapping-retained-summary-hash-capture.md) records
original-versus-diagnostic provenance and exact hashes. AG-002 PARTIAL: original
summary metadata and referenced evidence files are not yet reconciled. No new
crypto/physical harness test or adapter/NE acceptance. Next bounded read-only
metadata/evidence reconciliation; keep consumed namespaces untouched.

| Evidence | Date | Scope | Artifact | Executor | Result | Limits |
| --- | --- | --- | --- | --- | --- | --- |
| `LIC-EV-0152` | 2026-10-07 | Elevated original V2/V4/V5 summary/checkpoint hash capture | Collector SHA25656b5ac616281720920867f335416d78d77bb7e6390b3ca09692d2fb2153bc38f; diagnostic SHA2568999df56cf83627200870455f49765332d4dc60eada177c548e1a0879e547f33;5 originals in result ledger | Coordinator Codex via user-authorized OS RunAs helper | Five HASH_READ;2 checkpoints match historical reports; parser/inert inventory PASS | Metadata/role/shared-file reconciliation and independent adapter review pending; no CNG/SCM/ACL/protected writes, physical test, acceptance or commit |

### CHG0084 — Hash-bound retained metadata and listed evidence reconciliation (2026-10-07, r95)

User requests committing baseline first (bf4be74), then continuing the bounded
custody task. Coordinator's fixed read-only collector checks the exact five
EV0152 byte pins, summary/checkpoint identities and both reference inventories
before allowed reads. V4 all10 and V5 all12 listed hashes/role identities match;
both7-entry checkpoint subsets match. V4 historical reboot chronology and V5
repair flags/missing-key report reference are consistent. Shared content is
hash-only. V2 legacy summary has no inventory; no fabricated role references.
[Result and exact reference pins](../evidence/wrapping-retained-evidence-reconciliation.md).
AG-002 remains PARTIAL; LIC008/Open003, NE-002 and native-entry readiness unchanged.
No independent Security acceptance, current key/ACL/binary measurement, physical
rerun or protected/service/DB mutation. Next bounded V2 custody disposition,
separately assigned non-author adapter scope review and integration contracts.

| Evidence | Date | Scope | Artifact | Executor | Result | Limits |
| --- | --- | --- | --- | --- | --- | --- |
| `LIC-EV-0153` | 2026-10-07 | Original V2/V4/V5 metadata and V4/V5 referenced evidence | Collector SHA256e91ae6c81f22b6c0f826c17ff4515a8fd54866b7ed57d4b803f1041855364bbd; final diagnostic SHA2566919bad991a3817e54ca79ffe785a6c09a8c49dcace8b514f488b01cd7cde5b8; exact reference pins in result | Coordinator Codex via authorized OS RunAs helper | V4 10/10 and V5 12/12 listed hashes/role identities match; both checkpoint subsets7; V2 hash-bound metadata only; parser/inert refusal checks PASS | V2 inventory unavailable, AG-002 PARTIAL; no independent adapter acceptance, current key/ACL/binary checks or harness reruns; overall full/security/production=false |

### CHG0085 — V2 exact-name investigation and legacy custody disposition (2026-10-07, r96)

User authorizes the three-stage investigation: recover exact V2 report names
from existing material, read only those names if recovered, otherwise document
the gap and keep V2 historical-only. Existing docs/source/relevant Git history,
original user transcript and exact0.9.3 package examined. Transcript/ZIP hashes
match EV0126 and packaged/current controller bytes match. Role RunIds are new
random GUIDs, omitted from printed tables and summary; exact filenames not
recovered. Conditional role-file read stage not applicable; no broader protected
discovery or controller rerun. [Disposition](../evidence/wrapping-v2-legacy-custody-disposition.md)
records LEGACY_V2_ROLE_PROVENANCE_GAP. Investigation complete but AG-002 remains
PARTIAL, not waived; LIC008/Open003/NE-002 and full exits unchanged. Next explicitly
assigned non-author adapter scope decision with this limitation and accepted
integration contracts/prerequisites. No service/key/ACL/database/Installer change.

| Evidence | Date | Scope | Artifact | Executor | Result | Limits |
| --- | --- | --- | --- | --- | --- | --- |
| `LIC-EV-0154` | 2026-10-07 | V2 exact role report-name recovery and legacy disposition | EV0126 transcript/ZIP original hashes match; packaged/current controller SHA256726d9607fe9ec9ab1fb1ec13391f2b3c4f50c8d835d0e63d34f694be0f76ac97; existing EV0152/0153 summary binding | Coordinator Codex author assessment | No exact role IDs recovered in examined sources; conditional read skipped; V2 legacy host observation only, gap explicit | Not proof of file absence, not independent Security approval or gate waiver; AG-002 PARTIAL/native NOT_READY; no protected reads/rerun/mutation or new commit |

### CHG0086 — Independent bounded adapter review, entry acceptance withheld (2026-10-07, r97)

User explicitly requests commit first then independent adapter assessment.
Baseline e61172eb99d1eea9c1b18209a084b2053435524e committed. Non-author agent
/root/adapter_security_review accepts this technical reviewer assignment and
returns INDEPENDENT_TECHNICAL_REVIEW_COMPLETED_ADAPTER_ENTRY_NOT_ACCEPTED.
[Review record](../reviews/LICENSING_ADAPTER_ENTRY_INDEPENDENT_REVIEW.md) preserves
ASR-001/002 HIGH entry blockers (decision owner/accepted scope and versioned
failure/operation contract), ASR-003 MEDIUM owned-case ledger blocker and
ASR-004 MEDIUM experiment-envelope expected-context/replay reuse limitation.
V2 legacy-only custody limitation technically acceptable if expressly excluded
from required evidence; no AG-002 waiver. AG-009 review performed, acceptance
withheld. Historical Software observations reusable within their original scopes,
not production identity/Store/TPM/platform proof. No NE gate completion or native
authorization; LIC008/Open003 unchanged. Next ONE versioned adapter-entry
decision/profile with exact evidence/context/failure/owner/test/criteria bindings,
explicit decision-owner designation, then scoped independent acceptance.

| Evidence | Date | Scope | Artifact | Executor | Result | Limits |
| --- | --- | --- | --- | --- | --- | --- |
| `LIC-EV-0155` | 2026-10-07 | Independent bounded Software-KSP adapter-entry assessment | Fixed baseline e61172e; candidate ledger, adopted v2, EV0151-0154 and relevant source/collectors | Non-author agent /root/adapter_security_review, explicitly user-authorized technical reviewer | Review complete, entry NOT_ACCEPTED; four ASR findings, eight pins and inert reference guards reported PASS; V2 legacy-only reuse conditional, not gap closure | No decision ownership, independent physical retest, protected reads/elevation/mutation, full/native/product approval or second commit; NE-002 NOT_ACCEPTED |

### CHG0087 — Proposed adapter decision/profile v0.1 (2026-10-07, r98)

User authorizes preparing the proposed document, not owner designation or exact
scope approval. [Draft0.1](../plans/LICENSING_ADAPTER_ENTRY_DECISION_DRAFT.md)
states single-host Software profile, permitted future primitives/creation boundary,
fail-closed ADP-F01..08 diagnostics, independently expected context/replay limits,
claim/evidence pins excluding V2, and15 planned NOT_RUN ADP-P cases mapped to
original gates with proposed criteria. Names remain NOT_ASSIGNED; roles are not
approvals. ASR-001..004 get proposed dispositions, no finding closed by prose.
Exact bytes/schema/accepted failure and context contracts, sufficient artifact
binding and actual owners still required. No contract overrides, new physical
test, protected/service/backend mutation or commit. Next Product exact-scope
confirmation and explicit decision/case owner designation, then complete accepted
contracts/evidence and scoped independent approval. NE-002 NOT_ACCEPTED and
native entry NOT_READY; every other original gate/full exit remains unchanged.

| Evidence | Date | Scope | Artifact | Executor | Result | Limits |
| --- | --- | --- | --- | --- | --- | --- |
| `LIC-EV-0156` | 2026-10-07 | Proposed bounded adapter-entry decision preparation | Draft ADAPTER-DEV-SOFTWARE-01 revision0.1; adopted policy, EV0155 findings and EV0152-0154 custody | Coordinator Codex author | Proposed scope/operation/failure/context/evidence and15 planned case mappings documented; source pins match read-only | NOT_APPROVED, owners/accepted evidence/contracts/review pending; no schema freeze, code/host mutation, test execution, waiver, gate completion or commit |

### CHG0088 — Product principles confirmed, technical owner unassigned (2026-10-07, r99)

User explicitly agrees to general Windows10/11 x64 design with limited staged
validation, fail-closed preservation/clear diagnostics/controlled recovery, and
separate Product, named technical decision and independent review responsibilities.
[Confirmation](../plans/LICENSING_ADAPTER_PRODUCT_CONFIRMATION.md) records those
Product principles only. No technical owner name/role delegation supplied; no
exact technical profile/digest/contract/test acceptance inferred. Decision owner
and case owners NOT_ASSIGNED. Draft technical status and ASR-001..004 remain open;
NE-002 NOT_ACCEPTED/native NOT_READY, all original gates/exits unchanged. Next
explicit owner designation/role acceptance, required contracts/evidence/case
ownership and exact scoped independent acceptance. No code/host mutation/test/commit.

| Evidence | Date | Scope | Artifact | Executor | Result | Limits |
| --- | --- | --- | --- | --- | --- | --- |
| `LIC-EV-0157` | 2026-10-07 | Product adapter direction confirmation | User's explicit agreement to three recommendations; separate confirmation record | Project Owner confirmation; coordinator documentation | Staged general design, fail-closed data preservation and role separation confirmed | No technical owner assignment, exact profile/security/test/NE acceptance or implementation permission; existing findings/gates open |

### CHG0089 — Sole Project Owner accepts Security decision accountability (2026-10-07, r100)

User states no second person is on the project and explicitly requests registration
after explanation of bounded decision accountability, separate technical review
and retained tests. [Assignment](../plans/LICENSING_ADAPTER_SECURITY_OWNER_ASSIGNMENT.md)
names PROJECT_OWNER_CURRENT_USER as project Windows Security decision owner,
role accepted. Product and Security accountability share the same sole person;
no independent human reviewer/expert or personal algorithm guarantee inferred.
Coordinator technical work and non-author agent review stay separate and bounded.
Draft0.2 records ownership change only and requires exact fresh scoped review.
ASR-001 ownership component addressed, but accepted scope/evidence missing; finding
and AR-001/006/AG-001/009/NE-002 not closed by role acceptance. Case owners remain
NOT_ASSIGNED. Native NOT_READY/all full exits unchanged. Next contracts/evidence/
case ownership and pinned non-author review, then separate owner decision. No
code/host mutation, physical test, implementation authorization or commit.

| Evidence | Date | Scope | Artifact | Executor | Result | Limits |
| --- | --- | --- | --- | --- | --- | --- |
| `LIC-EV-0158` | 2026-10-07 | Explicit project Security decision-owner designation/role acceptance | User's affirmative registration request; owner assignment record; draft revision0.2 | PROJECT_OWNER_CURRENT_USER accepts role; coordinator records | Owner ASSIGNED_AND_ROLE_ACCEPTED; prior owner-pending state superseded | Decision accountability only, no exact technical/profile/evidence approval, independent human assurance, test/case assignment, gate completion or slice permission |

### CHG0090 — Operation contract and exact candidate claim binding (2026-10-07, r101)

User requests committing current changes and preparing the next step. Baseline
b1ad38f2a5f289c52f1a9823fc6e197ce032d41c committed first. Coordinator prepares
[ADAPTER-OPS-01 proposed0.1](../plans/LICENSING_ADAPTER_OPERATION_CONTRACT.md)
with16 OC requirements aligned to existing Offline/Hybrid CAS/ack contracts,
explicit caller/context/limits/restart/failure/no-replay boundaries and planned
test/gate mappings. Draft profile advances0.3 for these changes. Derived
[candidate index](../evidence/adapter-entry-claim-bindings-v1.json) maps14 AE claims
to14 exact V4/V5 role reports/raw results where available; V2 excluded, V6/V7
operator records separate. No new original protected reads or historical-status
relabel. Artifact/source equivalence, accepted context encoding/limits, case
owners and exact independent acceptance remain pending; no finding/gate closed
by proposed prose/structure checks. Existing provider/profile/evidence/codec
approval and all native/full exits unchanged. Next exact scoped contract/index
review and bindings; no product/Core/protocol/schema/host mutation or second commit.

Prepared review-input raw SHA256 pins: draft0.3
428fb4d4956df7ebbfc9e0bd619af31ca1585b1270ad11f5c97bb0767ae061cc;
operation contract0.1
670bad6e122ca8751dfeeb248fe921236196e2eb34fe168c85f3df96ac1cffd3;
claim index0.1
1e15afb69759594c2031a0c36f90a61ff7d358016fc94b76b6bb2ea12a4c02e0.
Git attributes preserve those raw bytes; these pins are NOT accepted product
artifacts. Validation PASS: source diagnostic digest,14 report identities/hashes
and every retained result/status exactly match filtered source;14 unique claim
IDs/references valid;16 unique mapped OC rows. Docs self-tests57/291 and diff
whitespace PASS. None is a fresh provider or Windows security result.

| Evidence | Date | Scope | Artifact | Executor | Result | Limits |
| --- | --- | --- | --- | --- | --- | --- |
| `LIC-EV-0159` | 2026-10-07 | Proposed operation/failure/interface contract and exact historical claim indexing | Draft0.3; ADAPTER-OPS-01 revision0.1; derived14-claim/14-report index from pinned EV0153 diagnostic; inspected Offline/Hybrid source pins | Coordinator author/read-only evidence indexing | Concrete required operations/invariants/failure rules and report/result references prepared; source pins and structural checks validated | Proposed NOT_ACCEPTED, missing artifact/schema/bounds/owners/independent approval explicit; no native/runtime/crypto test, protected write, gate waiver/completion or second commit |

### CHG0091 — Independent contract/index review, direction coherent but entry denied (2026-10-08, r102)

User authorizes next independent review. Existing follow-up attempt interrupted
without verdict; fresh non-author /root/adapter_contract_review explicitly accepts
technical role and reviews exact draft0.3/contract0.1/index0.1 pins from EV0159.
[Result](../reviews/LICENSING_ADAPTER_CONTRACT_INDEPENDENT_REVIEW.md): proposed
design direction technically coherent with existing Offline/Hybrid interfaces,
ADAPTER_ENTRY_NOT_ACCEPTED. ASR-002/004 directions improved but exact failure/
Core/Audit mapping and context/encoding/bounds/vectors incomplete; ASR-003 planned
structure supplied but case ownership/placement pending. New ACR-001: claims
reference exact reports but not explicit supporting result IDs; AE-007/009 need
summary/checkpoint causation dependencies. EV0159 claim-to-result wording was too
strong; structural validation was not semantic sufficiency. Exact reviewed inputs
unchanged. Three input/two portable source pins and14/14 index/ref checks reported
PASS; no physical attestation or original protected reread. Next ONE revised
versioned contract/index with explicit tuples, concrete specs and owned placement,
then scoped acceptance. Owner role stays assigned; no native/gate approval or
full-exit waiver. No code/host mutation/test execution or commit.

| Evidence | Date | Scope | Artifact | Executor | Result | Limits |
| --- | --- | --- | --- | --- | --- | --- |
| `LIC-EV-0160` | 2026-10-08 | Independent operation-contract/index assessment | Exact EV0159 draft0.3/contract0.1/index0.1 raw pins; existing portable interfaces and prior findings/owner record | Non-author agent /root/adapter_contract_review; coordinator records | Proposed direction coherent; ADAPTER_ENTRY_NOT_ACCEPTED; three input/two source pins match,14 reports/14 claims/ref structure valid; ACR-001 precision gap found | No scoped adapter/NE/native/product approval, physical reports/crypto retest, code/host mutation or commit; concrete contracts/required binding/owners remain open |

### CHG0092 — Versioned review-package correction and consistency checks (2026-10-08, r103)

User asks correcting the package and committing changes. Reviewed0.3/0.1/0.1
inputs and EV0160 first preserved in317d3f7. New [contract0.2](../plans/LICENSING_ADAPTER_OPERATION_CONTRACT_V02.md)
and [index0.2](../evidence/adapter-entry-claim-bindings-v2.json), paired with
draft0.4, add exact claim/report/result-ID/raw-status/hash tuples and explicit
summary/checkpoint context for reboot/missing-key claims. Original report rows/
digests unchanged; V6/V7 operator-only and V2 excluded, no invented original proof.
New proposed evidence-qualified failure/Core/Audit routing, fixed534-byte header,
554-byte AAD and1049126-byte maximum envelope, monotonic deadlines/late-result
handling, ten planned NOT_RUN vectors and proposed case placement. Existing Core
product/install/counter/ACK constraints inspected; no protocol/runtime change.
Decision owner/preparation actors named, physical executors still NOT_ASSIGNED;
no approved deferral or accidental case assignment. [Read-only checker](../../../scripts/check-adapter-review-package.mjs)
validates14 claims/14 unchanged reports, explicit tuples/dependencies and ten
corrupt-index refusals plus byte arithmetic. These are metadata/spec checks,
not crypto acceptance. ASR findings only proposed/structural dispositions;
exact new independent acceptance/schema/payload vectors/artifact bindings/required
physical evidence still open. NE-002 NOT_ACCEPTED/native NOT_READY/all full exits
unchanged. Final requested commit after validation; no product code/key/service/ACL/DB/
Installer mutation or consumed-controller rerun.

Correction review-input raw SHA256 pins: draft0.4
9ec3895975043ebd5e18dceb314396ea4016d9e4c9271f8adbef65b0e8aa6e6f;
contract0.2
cd877da8b41874739af15d99682cf4a3abb4d7f4c676b52629eb3e1d1ccb54e7;
index0.2
b3fb32ac723c72f5d45f82fa858fe1d5224fa1586b1a83a78a0720bdcaf21ea6.
These are proposed document/evidence pins only, not product artifact approval.
Docs self-tests59/310, read-only package consistency and diff whitespace PASS.

| Evidence | Date | Scope | Artifact | Executor | Result | Limits |
| --- | --- | --- | --- | --- | --- | --- |
| `LIC-EV-0161` | 2026-10-08 | Review-package correction and metadata/specification validation | Draft0.4, proposed operation contract0.2 and explicit claim index0.2; preserved reviewed inputs317d3f7 | Coordinator author, read-only checker | Exact row/dependency binding and concrete candidate specs added;14/14 consistency and ten corrupt-index refusals/size arithmetic PASS | No independent acceptance/native implementation/crypto test, new case executor/approved deferral or gate completion; user-requested commits preserve baseline and correction |

### CHG0093 — Independent corrected-package review, routing precision correction required (2026-10-08, r104)

User authorizes the next independent review. Non-author /root/adapter_corrected_review
accepts the bounded technical role and reviews committed a6b4719 exact draft0.4/
contract0.2/index0.2 pins from EV0161. [Review result](../reviews/LICENSING_ADAPTER_CORRECTED_PACKAGE_REVIEW.md):
proposed direction technically coherent with routing correction required;
ADAPTER_ENTRY_NOT_ACCEPTED. ACR-001 structural attribution/dependency correction
satisfied within derived custody chain, not physical/artifact sufficiency approval.
New ACR-002 MEDIUM: contract unqualified COMMIT_* rules describe Offline names;
Hybrid must retain its existing TRUSTED_RESPONSE_* public errors. No interface
change requested. Container/AAD/size, expected-context/logical-hash separation and
noncancelable cleanup constraints coherent as proposed requirements. ASR-001/003
residual entry blockers and ASR-002/004 accepted mapping/evidence/schema/vector
requirements remain open. Three input/two portable source pins and read-only
14/14 package/ten corrupt-index checks PASS. Four reviewer tool calls, no protected
reads/host mutation/native tests/code changes. Reviewed bytes unchanged. Next
narrow versioned routing correction and scoped assessment, then consequential
PRE_ENTRY evidence/placement/executor decisions; no NE/native/release permission.

| Evidence | Date | Scope | Artifact | Executor | Result | Limits |
| --- | --- | --- | --- | --- | --- | --- |
| `LIC-EV-0162` | 2026-10-08 | Independent corrected adapter-package review | Committed a6b4719; exact EV0161 draft0.4/contract0.2/index0.2 pins and existing portable interfaces | Non-author agent /root/adapter_corrected_review; coordinator records | ACR-001 structurally satisfied; proposed direction coherent with ACR-002 routing correction required; entry NOT_ACCEPTED | No physical/artifact sufficiency acceptance, executable adapter, scoped approval, host/code mutation, gate closure or commit |

### CHG0094 — Narrow workflow error-routing amendment (2026-10-08, r105)

User requests correcting the reviewed document. [Contract amendment0.3](../plans/LICENSING_ADAPTER_OPERATION_CONTRACT_V03.md)
supersedes only contract0.2 section1 ADP-F06 routing and its unqualified Store
error paragraph. Offline retains COMMIT_STATE_CONFLICT/COMMIT_PENDING/
COMMIT_ACKNOWLEDGEMENT_INVALID/COMMIT_OUTCOME_UNKNOWN; Hybrid retains the
corresponding existing TRUSTED_RESPONSE_* names. Read-only Offline confirmation
and actual Store attempt flags distinguished; primitive outcomes never fabricate
receipts or authority. Existing source names inspected, no interface changes.
Reviewed0.2/draft0.4/index0.2 pins preserved. All remaining contract requirements
and NE/ASR/full exits retained; ACR-002 corrected as a proposal, exact non-author
amendment assessment pending. No production code/host mutation, crypto test,
historical controller rerun or commit. Next narrow exact assessment, then required
PRE_ENTRY claim/artifact sufficiency, accepted placement and executor decisions.

| Evidence | Date | Scope | Artifact | Executor | Result | Limits |
| --- | --- | --- | --- | --- | --- | --- |
| `LIC-EV-0163` | 2026-10-08 | Proposed ACR-002 routing correction | Operation contract0.3 amendment with preserved0.2; existing Offline/Hybrid sources | Coordinator author | Workflow-specific error names and attempt semantics explicitly preserved | Documentation consistency only; non-author acceptance pending, no backend/native/physical test, gate closure or commit |

### CHG0095 — Limited routing amendment independently approved (2026-10-08, r106)

User requests limited amendment review and commit. Non-author /root/adapter_routing_review
explicitly accepts technical role; two read-only calls compare exact0.3 against
unchanged Offline/Hybrid sources and preserved0.2. [Verdict](../reviews/LICENSING_ADAPTER_ROUTING_AMENDMENT_REVIEW.md):
ACR-002 ADDRESSED, narrow routing amendment technically approved, no scoped defects.
All eight error names and confirm-vs-commit flags match; separate confirmation
exception READ_ONLY_CONFIRMATION_UNAVAILABLE retained. Uncertainty, coupled
trust/license commit, generation/hash checks and NONE/nondurable boundaries
preserved. Supersession remains only0.2 ADP-F06 routing/error paragraph. Reviewed
amendment SHA2567c762f33ab2223d9a61d87d58afd902eec04828dbdfee93b63582d55bcd98a57
unchanged; review recorded separately and raw-byte Git attribute added. This is
not whole-contract/NE/native/product/physical acceptance or human certification.
Remaining ASR and original full-exit prerequisites retained. Next PRE_ENTRY
required claim/artifact sufficiency, accepted placement and actual executor
assignments; no repetitive ACR-002 review needed. User-requested documentation
commit follows consistency/link/whitespace/staged-byte checks; no backend or
machine-state changes, protected reads, controller reruns or physical tests.

| Evidence | Date | Scope | Artifact | Executor | Result | Limits |
| --- | --- | --- | --- | --- | --- | --- |
| `LIC-EV-0164` | 2026-10-08 | Independent limited ACR-002 routing review | Exact amendment0.3 raw pin; preserved0.2 and unchanged Offline/Hybrid interfaces | Non-author agent /root/adapter_routing_review; coordinator records | ACR-002 ADDRESSED; routing amendment technically approved, no scoped defects | No whole-contract/NE/native/physical/release acceptance or executor assignment; user-requested docs commit only |

### CHG0096 — PRE_ENTRY evidence, placement and executor decision preparation (2026-10-08, r107)

User requests next step after committed routing review91bafbf. Coordinator checks
existing adopted entry requirements/evidence/role records and prepares the
[candidate decision package](../plans/LICENSING_ADAPTER_PRE_ENTRY_ACCEPTANCE_PACKAGE.md).
No repetition of completed ACR-001 structure/ACR-002 routing or consumed tests.
Required historical claims separated from supplementary filtered-admin/lifecycle
observations and absent Store/TPM/matrix coverage. All15 ADP-P placements supplied
as proposals, not approved deferrals. Existing decision owner reused; two explicit
choices pending: initial one-host Software evidence scope with unchanged Windows10/11
product target, and user physical execution per fresh separately authorized plan.
No physical executor assigned from decision-role acceptance. Read-only workspace
package check: V4/0.11.0 and V5/0.12.0 manifests each list194 safe basenames; all
listed SHA256/lengths match, zero mismatches. Manifest/toolchain/EXE/DLL/controller
pins recorded, V5 manifest matches historical EV0135. No extra-file inventory or
original per-report binary linkage/source-build equivalence established; ADP-P01/
AR-003/AG-002 still partial. No protected reads/elevation/native/controller run,
host/backend/code mutation or commit. Next owner choices and required bindings/
scoped sufficiency assessment; all other NE and full exits remain mandatory.

| Evidence | Date | Scope | Artifact | Executor | Result | Limits |
| --- | --- | --- | --- | --- | --- | --- |
| `LIC-EV-0165` | 2026-10-08 | PRE_ENTRY decision preparation and local historical package custody | Candidate package0.1, required claim set/all15 case placements; fixed local V4/V5 manifests/bits | Coordinator read-only preparation | Each194 manifest-listed files matches hash/size; required vs supplementary scope and pending decisions explicit | No report/binary/source equivalence or sufficiency approval, physical executor assignment, native/test/gate acceptance, host mutation or commit |

### CHG0097 — Owner confirms evidence scope and conditional physical execution (2026-10-08, r108)

User explicitly confirms the two choices presented after EV0165. [Package0.2
section6](../plans/LICENSING_ADAPTER_PRE_ENTRY_ACCEPTANCE_PACKAGE.md) records:
initial historical Windows11 x64 build22000 Software-KSP evidence scope only,
unchanged Windows10/11 x64 product target; coordinator technical preparation and
PROJECT_OWNER_CURRENT_USER named/accepted conditional physical executor for
available approved resources, after separate authorization of each fresh reviewed
test plan. This is actual arrangement acceptance, not mere role proposal, but
neither all15 case assignments nor unavailable-machine/device availability is
inferred. Today's OS build is not remeasured or assumed from historical evidence.
No blanket key/service/account/ACL/reboot permission. Case placement, required
claim/artifact/runner sufficiency and other NE prerequisites remain unaccepted.
Owner-choice component resolved only; ASR-001/003 not fully closed. No case/run,
native or release gate complete. Next required bindings and scoped sufficiency/
placement assessment; no repetitive owner confirmation. Documentation update
only, no host/backend operation, independent review, test or commit.

| Evidence | Date | Scope | Artifact | Executor | Result | Limits |
| --- | --- | --- | --- | --- | --- | --- |
| `LIC-EV-0166` | 2026-10-08 | Explicit owner scope/execution-arrangement confirmation | User affirmative response to two choices; PRE_ENTRY package0.2 section6 | PROJECT_OWNER_CURRENT_USER confirms; coordinator records | Initial Software evidence scope and conditional physical executor arrangement CONFIRMED | No evidence/placement/all-case/NE/native/release acceptance, unavailable resource assignment, blanket host authority or test execution |

### CHG0098 — Report/apphost custody limitation and fixed metadata capture preparation (2026-10-08, r109)

User requests committing prior owner/package records then next technical work.
Commit2dd8781 completed first. [Package0.3 section7](../plans/LICENSING_ADAPTER_PRE_ENTRY_ACCEPTANCE_PACKAGE.md)
records that EV0153 filtered role metadata omits binarySha256, and inspected V4/V5
source computes it from EXE Environment.ProcessPath, not the managed DLL. No
historical assembly/manifest/source equivalence inferred from matching apphost.
Preserved existing collector/index/source unchanged. New fixed read-only
[helper](../../../scripts/collect-license-report-artifact-bindings.ps1) prepares
hash-bound selected metadata from14 exact indexed role reports and pinned local
V4/V5 manifest/EXE/DLL pairs. No protected shared/key/ownership/plan contents,
binary execution or host writes; only one new diagnostic under out. Windows
PowerShell parsing,14 pinned refs/App+Guardian positive fixtures and11 invalid
ref/metadata refusals PASS without protected reads. Helper raw SHA256
26803a296c7ed19d9e8a1224c2e59a756bb6914df557db55cab60d3dccfed6f2;
Git attribute preserves bytes. User handoff command/read/write manifest recorded;
elevated execution NOT_RUN, no coordinator elevation. Source-build/assembly
binding remains unestablished even with matching EXEs. Next operator capture,
exact output binding and scoped evidence-sufficiency/placement assessment; no
ADP-P01/AR/AG/ASR/NE/full exit closed. No backend/controller/key/service/ACL/account/
DB/device operation, new physical test or second commit in preparation.

| Evidence | Date | Scope | Artifact | Executor | Result | Limits |
| --- | --- | --- | --- | --- | --- | --- |
| `LIC-EV-0167` | 2026-10-08 | Historical role/artifact linkage audit and read-only capture preparation | Package0.3 section7, inspected V4/V5 source pins, fixed14-report helper | Coordinator prepares; user operator execution pending | Apphost-only hash limitation explicit; pure14 refs/positive fixtures/11 refusals and parser PASS | Capture NOT_RUN; no executed assembly/source equivalence, scoped sufficiency/placement/native acceptance or host mutation; prior docs committed2dd8781 only |

### CHG0099 — Operator metadata capture binds all14 historical reports to local EXEs (2026-10-08, r110)

Operator runs prepared read-only helper and supplies report path. [Package0.4
section8](../plans/LICENSING_ADAPTER_PRE_ENTRY_ACCEPTANCE_PACKAGE.md) records
output SHA25634aa1e1e35861d499df237b0e025a81d1b98609aaef1f33da0998e4bfb5abecf,
14215 bytes, UTC2026-10-08T13:37:59.4100223Z; pinned collector/index unchanged.
Coordinator checks hash/parse of same workspace snapshot and every14 unique
report row against original index hashes/experiments/roles. All6 V4/8 V5 rows
read and recorded EXE hashes match pinned local packages, zero stopped/unmatched
rows; old runtime10.0.11/OS10.0.22000.0 preserved. Capture resolves the narrow
omitted EXE metadata link, not full ADP-P01/AR-003/AG-002/source/DLL equivalence.
Historical reports lack assembly binding; local DLL custody is not executed-DLL
proof. False security/production/assembly-execution flags and unestablished
source equivalence remain. No original raw results reclassified. Next scoped
historical-evidence sufficiency and placement assessment, not report repair or
consumed-controller rerun; if required, future fresh reviewed evidence only.
No coordinator elevation/protected reads, new crypto test, code/service/key/ACL/
account/DB/Installer mutation or commit. All other NE/full exit requirements open.

| Evidence | Date | Scope | Artifact | Executor | Result | Limits |
| --- | --- | --- | --- | --- | --- | --- |
| `LIC-EV-0168` | 2026-10-08 | Completed original role-to-EXE metadata capture and row assessment | Operator outpute25c38edfe89457fad6b655fd17dbef7, exact digest/size/time;14 pinned V4/V5 role rows and local packages | User elevated read-only capture; coordinator workspace snapshot verification |14/14 original role hashes/EXE bindings match; no stopped rows; narrow metadata link resolved | No historical executed-DLL/source equivalence, fresh crypto/platform test, independent attestation, full custody/sufficiency/native acceptance, host mutation or commit |

### CHG0100 — Bounded evidence sufficiency and residual-work assessment (2026-10-08, r111)

User requests next sufficiency step and exact remaining-work explanation.
[Author-side assessment](../reviews/LICENSING_ADAPTER_EVIDENCE_SUFFICIENCY_ASSESSMENT.md)
checks exact current package/contract/amendment/index/capture pins against adopted
entry requirements. Historical observations supported with limits; required entry
evidence incomplete.14/14 original EXE links complete, not executed-DLL/source
or new binary-format/classifier proof. No non-author Security approval inferred.
Six original AR dispositions assessed partial/open,0 fully accepted. Four
residual work packages summarize obligations without changing gates: fully bound
required executable evidence, exact design/failure acceptance, case placement/
resources and scoped technical/owner decision.15 planned ADP-P and10 ACV still
NOT_RUN; overlapping catalogs, not25 tasks, and later product gates not all
pre-entry. No completion percentage/time estimate fabricated. Next REM-01 fresh
isolated evidence-plan draft with complete source/assembly/dependency/manifest/
runner binding; no old rerun/report repair or production implementation approval.
Owner confirmations/narrow routing result retained. All other NE/full exits open;
no host/code/test operation, delegated review, gate adoption or commit.

| Evidence | Date | Scope | Artifact | Executor | Result | Limits |
| --- | --- | --- | --- | --- | --- | --- |
| `LIC-EV-0169` | 2026-10-08 | Bounded evidence sufficiency and remaining-work assessment | Exact current package0.4/contract0.2/amendment0.3/index0.2/EV0168 capture pins; adopted entry obligations | Coordinator author-side read-only assessment | Historical observations supported, entry evidence incomplete;14 EXE links done,4 residual work packages,6 AR partial/open | No independent/scoped approval, gate/placement change, native/physical test, code/host mutation or commit; other NE/full exits retained |

### CHG0101 — Fresh fully bound test-only evidence plan prepared (2026-10-08, r112)

User requests next REM-01 preparation step. [Plan0.1](../plans/LICENSING_ADAPTER_FRESH_EVIDENCE_PLAN.md)
defines frozen allowlisted source/build inputs, actual toolchain/dependency/
assembly/EXE/manifest/controller/runner identity and actual role/child emitter
validation with acyclic manifests. Separates inert candidate Track A from fresh
physical pilot Track B; no automatic post-build controller/elevation.16 FEP
cases map to original overlapping ADP/ACV obligations; all NOT_RUN. New proposed
EntryEvidenceV1 resources/three Manual roles/two owned keys, collision refusal,
staged ownership/cleanup/no-recreate and retained incomplete state; exact ACL/
controller mutation manifest still required before physical authorization.
Candidate random payload/context not real Core logical-state serializer or
same-context rollback authority; no old tests reused as new format evidence.
Source-adjacent V7 builder/report/tests inspected as design reference, not run
or accepted for new bits. Next exact limited non-author plan review and separately
authorized test-only implementation; no self-approval or other-NE bypass.
REM-01 planning component prepared, four residual packages remain; no native/
product/platform/crypto acceptance. No build/code/service/key/ACL/account/DB/
controller/physical operation, delegated review or commit in this planning step.

| Evidence | Date | Scope | Artifact | Executor | Result | Limits |
| --- | --- | --- | --- | --- | --- | --- |
| `LIC-EV-0170` | 2026-10-08 | Fresh source/assembly-bound evidence-plan preparation | ADAPTER-EVIDENCE-PLAN-01 proposed0.1; original operation contract and retained evidence limits | Coordinator author | Binding chain, two approval tracks,16 case criteria and proposed resource/stage limits prepared | Plan unapproved/unimplemented; no new kit/tests/host mutation/gate completion or commit, full NE prerequisites retained |

### CHG0102 — Fresh evidence plan direction independently reviewed after commit (2026-10-09, r113)

User requests prior changes committed first, then limited next plan review and
explanation of root Git attributes. Commit e1ff723 preserves EV0167–0170/helper/
plan; post-commit worktree clean. Non-author /root/adapter_routing_review accepts
distinct fresh-plan technical assignment and reviews exact plan0.1 unchanged
SHA256f83e2ec5d777e41d043e592e0aa8e60d6abebfe74b3580466d05a5123c25b080.
[Verdict](../reviews/LICENSING_ADAPTER_FRESH_EVIDENCE_PLAN_REVIEW.md): adequate
plan direction, no corrective defect in bounded planning scope; executable/
physical design acceptance pending. Binding-chain, stage/production separation,
fresh ownership/no-recreate and parser/failure/deadline directions coherent.
Disclosed exact controller/ACL/hung-worker/artifact-validation prerequisites
remain open. Two read-only calls, no build/protected/native/test mutation. Exact
plan preserved via -text attribute; no content change or retroactive approval.
Next explicit Track A inert test-only implementation permission, then actual
frozen-kit/pure-output/controller/ACL review before separate Track B. All16 FEP
NOT_RUN/four REM packages open. Owner choices retained; no placement/NE/native/
release approval or second commit. Git attributes manage byte custody/line ends,
not product runtime/backend/license authority.

| Evidence | Date | Scope | Artifact | Executor | Result | Limits |
| --- | --- | --- | --- | --- | --- | --- |
| `LIC-EV-0171` | 2026-10-09 | Limited non-author fresh-evidence plan review | Committed e1ff723 and exact plan0.1 raw pin; separate review record | Agent /root/adapter_routing_review accepts distinct role; coordinator records | ADEQUATE_PLAN_DIRECTION, no corrective defect; staged blockers accurately disclosed | No executable/physical acceptance, cases/REM/NE completion, host/code/build/test mutation or second commit; Track A authorization still required |

## LIC-CHG-0103 / LIC-EV-0172: authorized inert Track A candidate

2026-10-09: owner authorizes Track A only. Separate candidate codec/failure model
and frozen direct-csc builder implemented; 45/45 pure cases and four inventory
refusals PASS, actual managed DLL/executor hashes bound. Source baseline e1ff723
plus explicitly recorded dirty inputs, SDK10.0.400/runtime10.0.11. Framework-
dependent pure runner, not self-contained physical roles. No services, persisted
keys, accounts, ACLs, backend/Core or historical controllers changed. See
[exact checkpoint, digests and coverage gaps](../experiments/LICENSING_ADAPTER_TRACK_A.md).
Full FEP case closure, recursive Audit canaries, actual child/Store/native timeout
and all physical tests remain pending. Four REM packages and LIC008/Open003 stay
open; NE-002 NOT_ACCEPTED/NATIVE_ENTRY NOT_READY. Next remaining inert checks and
exact candidate review, not Track B execution. Security/production acceptance
false; no independent-review claim or commit performed in this checkpoint.

## LIC-CHG-0104 / LIC-EV-0173: pure diagnostic coverage follow-up

2026-10-09: initial Track A/plan-review checkpoint committed f9c8af0, then
candidate0.1.1 adds closed allowlisted diagnostic DTO/recursive validation,
text/hex/base64 canary and nested failure tests.57/57 pure and10/10 inventory
refusals PASS; actual DLL/executor/profile binding and pre/post custody checks.
[Final digests and limits](../experiments/LICENSING_ADAPTER_TRACK_A.md) preserve
EV0172 history. Candidate FEP-U08 now evidenced, not deployed C_AUDIT/IPC/native
diagnostic acceptance. No product/Core/native/physical mutation. Next exact
non-author candidate/output review; source/controller/real worker/role evidence
gaps disclosed, all physical cases NOT_RUN/four REM open. NE-002 NOT_ACCEPTED,
NATIVE_ENTRY NOT_READY, LIC008/Open003 open; Security/production false.

## LIC-CHG-0105 / LIC-EV-0174: limited Track A non-author review

2026-10-10: user authorizes distinct non-author Track A candidate/output review
on committed4afcaff. Source snapshots/provenance/artifact inventories/recorded
57 unique pure PASS cases supported;10 refusals are an inspected builder
aggregate, not independent re-execution. [Exact review and source pins](../reviews/LICENSING_ADAPTER_TRACK_A_REVIEW.md).
One LOW fake-worker reuse defect TA-R01 OPEN; independent golden header/AAD
assertions recommended TA-C01. No source correction/build/native/physical run
performed. Next bounded fix/regression/golden assertions and new bound output,
then targeted review. Four REM and LIC008/Open003 remain open; NE-002
NOT_ACCEPTED/NATIVE_ENTRY NOT_READY, Security/production false. AI-agent review
is not human Security assurance or full-plan approval.

## LIC-CHG-0106 / LIC-EV-0175: model correction, review pending

2026-10-10: owner requests correction. Candidate0.1.2 makes fake-worker instances
single-use, four regression cases PASS; independent literal complete-envelope/
AAD assertions added for TA-C01.63/63 pure tests and10/10 inventory refusals PASS.
[Corrected output pins](../experiments/LICENSING_ADAPTER_TRACK_A.md). TA-R01 author
correction implemented, not independently CLOSED; next targeted exact correction/
output review. No native worker or real physical behavior claimed; backend/Core/
services/keys/ACLs unchanged. Four REM and LIC008/Open003 remain open; NE-002
NOT_ACCEPTED/NATIVE_ENTRY NOT_READY, Security/production false. No commit this turn.

## LIC-CHG-0107 / LIC-EV-0176: targeted correction review completed

2026-10-10: user-authorized distinct corrective review inspects exact dirty0.1.2
candidate and frozen output, verifies7 source pins/5 evidence bindings/3 package
files and63 unique recorded PASS rows. [Review verdict](../reviews/LICENSING_ADAPTER_TRACK_A_REVIEW.md):
TA-R01 resolved in simulated candidate, TA-C01 satisfied for framing, no new
scoped finding. No builder/candidate/physical execution. Next exact test-only
controller/resource/ACL/mutation/failure-retention specification, then review
before physical implementation/execution. Four REM and LIC008/Open003 remain
open; NE-002 NOT_ACCEPTED/NATIVE_ENTRY NOT_READY, Security/production false.
No whole-plan or deployed adapter acceptance and no commit in this turn.

## LIC-CHG-0108 / LIC-EV-0177: physical pilot specification prepared

2026-10-10: user-requested Track A correction/review checkpoint committed
1794baf5746d218e63b9e033d4d981cbccbc02a7; post-commit worktree clean. Then
[proposed physical pilot specification0.1](../plans/LICENSING_ADAPTER_PHYSICAL_PILOT_SPEC.md)
prepared, raw SHA2568e50ace849f4f542e096532dda6d45314bb1508f93bb8c83e85728efb5155452.
Exact new namespace/root/roles/two keys, closed file templates/protected DACL
principals and file masks, proposed Software key rights/read-back, ordered
Prepare create/Guardian/publish/App-child, fresh-process and owned Finish,
10 role reports, deadline/uncertain-state retention specified. Public controller
and SYSTEM private bootstrap separated; no Administrator private-record access.
Source/package/host/SID normalization/actual emitters/worker guards unimplemented
or unmeasured, explicit remaining kit gates. Status DRAFT_NOT_REVIEWED_NOT_EXECUTABLE.
Next scoped specification review, then separately authorized inert physical-kit
implementation and exact executable review before any Track B authorization.
No build/test rerun/services/keys/ACL/host mutation in preparation. Four REM,
LIC008/Open003 and NE/native gates unchanged; no physical/security acceptance.

## LIC-CHG-0109 / LIC-EV-0178: physical specification review requires correction

2026-10-10: user-authorized distinct non-author spec0.1 review on committed
95336c5 verifies unchanged raw pin and finds PP-R01 MEDIUM ownership contradiction:
role-created staging/reports require SYSTEM owner but Modify-only role tokens
have no specified owner-setting authority. [Exact review](../reviews/LICENSING_ADAPTER_PHYSICAL_PILOT_SPEC_REVIEW.md)
requires narrowly versioned owner/protocol correction before inert kit
implementation. Remaining direction coherent with executable/host/ACL/collision
dependencies disclosed; not physical approval. No edits to reviewed spec, build
or protected/native execution. Next preserve0.1, prepare ownership successor and
review it. Four REM/LIC008/Open003/NE/native gates open; Security/production false.

## LIC-CHG-0110 / LIC-EV-0179: ownership correction proposed

2026-10-10: user requests suggested PP-R01 correction. Preserved spec0.1 plus
[narrow ownership amendment0.2](../plans/LICENSING_ADAPTER_PHYSICAL_PILOT_SPEC_V02.md),
raw SHA256f2859ad5a1d3bd5a41f2cec89448ac98ca042585118ecd9b40d08d2bf3916706:
SYSTEM directories/private records/publications/Setup reports, Guardian staging/
reports and App/child reports have separately expected owners. Actual token
default-owner and file owner/DACL checks required; unexpected owner refuses,
no ownership rewrite/privilege expansion/hidden SYSTEM launch. Setup-publish
creates new SYSTEM-owned copies, never moves role-owned originals as trusted
publications. Exact previous masks/paths/stages/10 reports unchanged. Implicit
owner DACL rights/compromised-producer limits disclosed. Future owner regression/
actual host tests NOT_RUN; author correction prepared, non-author confirmation
pending. Next targeted0.1+0.2 review before inert kit implementation. No build,
code/service/key/ACL/token mutation or gate closure; Security/production false.

## LIC-CHG-0111 / LIC-EV-0180: ownership amendment review completed

2026-10-10: user-authorized distinct corrective review verifies exact0.1+0.2
pins unchanged on HEAD95336c5 plus disclosed docs. [Scoped verdict](../reviews/LICENSING_ADAPTER_PHYSICAL_PILOT_SPEC_REVIEW.md):
PP-R01 resolved in design only, no new scoped contradiction; ready for separately
authorized inert physical-kit preparation. Owner/TokenOwner/read-back/publication
protocol coherent; no changed DACLs/report budget/hidden SYSTEM grants. Actual
host/token/creation/ACL/collision/emitter evidence NOT_RUN. Next separately scoped
inert implementation/build and executable review, not Track B execution. Four
REM/LIC008/Open003/NE/native gates unchanged, Security/production false. No source
build or protected-resource mutation in review; no commit this turn.

## LIC-CHG-0112 / LIC-EV-0181: inert pilot foundation first slice

2026-10-10: user authorizes next inert preparation. Separate policy/ordered-action
models and self-contained pure-runner builder implemented;141/141 pure fixture
cases PASS, actual apphost physical-mode refusal observed. [Exact source/output
boundary and pins](../experiments/LICENSING_PILOT_FOUNDATION.md).194 local-runtime/
apphost/dependency files bound; source snapshots include preserved0.1+0.2 specs,
SDK10.0.400/runtime10.0.11 and dirty baseline disclosed. This is first inert
implementation slice, not physical-kit completion: native roles/controller/token/
ACL/creation/actual child/crypto/worker/complete kit admission unimplemented.
Next bounded non-author policy/builder/output review before extension. No protected
or machine mutation, Core/backend/Track A unchanged. Four REM/LIC008/Open003/NE
gates open; all physical/Security/production flags false. No commit this turn.

## LIC-CHG-0113 / LIC-EV-0182: pilot foundation review, one model gap

2026-10-10: user-requested initial changes committed6150a3c, then distinct
non-author source/output review verifies seven raw inputs/frozen inventories/
actual apphost-DLL identity/recorded141 PASS cases/refusal. [Review](../reviews/LICENSING_PILOT_FOUNDATION_REVIEW.md)
finds PF-R01 LOW: publication checks omit staging owner and exact ACE inventories;
separate File tests do not compose this mandatory validation. Next bounded fix/
regressions/new pinned output then targeted review. No code correction/native/
physical execution performed in review; disclosed full-kit/host/role/guard gaps
remain. Four REM/LIC008/Open003/NE/native gates unchanged, Security/production
false. New review/status docs uncommitted after requested initial commit.

## LIC-CHG-0114 / LIC-EV-0183: publication model correction implemented

2026-10-10: user requests PF-R01 fix. Foundation0.1.1 Publish reconstructs expected
rules independently, enforces source/destination owner/protected exact ACEs via
mandatory File checks and closed creator/path/digest/no-existing conditions.
Forty added regression assertions;181/181 unique pure cases and actual apphost
physical-mode refusal PASS. [Corrected custody](../experiments/LICENSING_PILOT_FOUNDATION.md)
binds changed DLL/deps/source/package despite unchanged fixed-name apphost.
PF-R01 author-corrected, targeted review pending. No physical/native code or
machine mutation; full kit/roles/native/admission open. Four REM/LIC008/Open003/
NE gates unchanged; Security/production false. Changes uncommitted.

## LIC-CHG-0115 / LIC-EV-0184: publication correction reviewed

2026-10-10: distinct [targeted non-author review](../reviews/LICENSING_PILOT_FOUNDATION_REVIEW.md)
of disclosed dirty foundation0.1.1 resolves PF-R01 in the pure model only; no new
scoped finding. Mandatory independently expected owner/protection/exact ACE
checks at both publication endpoints and40 regressions inspected. Seven source
pins/evidence bindings,194 package files, actual DLL/apphost and recorded181
unique PASS cases/refusal match; no reviewer execution or machine mutation.
Next strict SID/directory/creation/stage-plan/schema/admission inert coverage
with negative fixtures before physical extension. Full kit/native/physical/
Security/production/FEP/REM approval absent; four REM/LIC008/Open003/NE gates
unchanged. Bounded AI review is not human security assurance. Changes uncommitted.

## LIC-CHG-0116 / LIC-EV-0185: identity/creation/plan inert models added

2026-10-11: previous changes/reviews committed850d3ad, clean worktree, then
user-authorized next inert slice built foundation0.1.2. Canonical numeric service
SID validation, ten directory creation policies, representative file creation
composition and bounded closed three-stage JSON binding models added.392 new
assertions,573 unique pure PASS cases plus actual physical-command refusal;
[exact output and residuals](../experiments/LICENSING_PILOT_FOUNDATION.md).
No physical host observations, Windows operations or backend/Core changes.
Next bounded new-source/output review. Complete executable plan/report/artifact/
kit/cross-stage/bootstrap/native implementation remains open; injected flags/pins
do not authorize physical execution. Prior correction review does not approve
this changed source. Four REM/LIC008/Open003/NE/native/Security/production gates
unchanged. New0.1.2 code/status docs uncommitted.

## LIC-CHG-0117 / LIC-EV-0186: foundation0.1.2 reviewed

2026-10-11: distinct [limited non-author review](../reviews/LICENSING_PILOT_FOUNDATION_REVIEW.md)
supports strict SID/creation/closed-stage-plan pure models and exact recorded
custody; no actionable finding in the slice. Seven current/frozen inputs,
seven evidence bindings,194 package files, DLL/apphost and573 unique recorded
PASS rows/refusal match. No reviewer test/native/protected execution. Earlier
approval was not transferred. Next inert cross-stage RunId/history/bootstrap/
action-state composition, report/context schemas and package/kit/artifact negative
guards. Full executable/native/physical/FEP/REM/Security/production acceptance
absent; four REM/LIC008/Open003/NE gates unchanged. AI review is not independent
human security assurance. New source/review/status docs uncommitted.

## LIC-CHG-0118 / LIC-EV-0187: cross-stage/report/package inert guards

2026-10-11: authorized next slice foundation0.1.3 adds volatile cross-stage RunId
reservations/context/artifact/checkpoint continuity and ordered action/report
composition, closed candidate report/authority/result validation and independent
flat package inventory negative guards.97 added tests;670 unique pure PASS
cases and actual physical-command refusal. [Exact output/remaining work](../experiments/LICENSING_PILOT_FOUNDATION.md).
No Windows/backend/Core/customer operations. Next bounded new-source/output
review; prior0.1.2 approval does not transfer. Full kit/archive/artifact graph,
bootstrap/physical emitters/native/durable state remain incomplete; injected
observations are not actual approval. Four REM/LIC008/Open003/NE/native/FEP/
Security/production gates unchanged. Changes uncommitted, baseline850d3ad.

## LIC-CHG-0119 / LIC-EV-0188: foundation0.1.3 review and completion boundary

2026-10-11: [distinct limited review](../reviews/LICENSING_PILOT_FOUNDATION_REVIEW.md)
supports pure models/recorded custody with no actionable scoped finding. Seven
input/evidence bindings,194 package files, DLL/apphost and670 recorded unique
PASS rows/refusal match, no reviewer rerun/native operation. Current pure-model
review checkpoint can end. Next consolidated implementation-readiness packet
using reviewed specifications/models: exact TEST_ONLY operations/responsibilities,
bootstrap/object/action inventory, physical schemas/failure/retention interfaces
and closed provenance/artifact admission; then explicit actual implementation
permission and exact built-kit review before separate physical-stage approvals.
[Finite deliverable checklist](../experiments/LICENSING_PILOT_FOUNDATION.md)
retains full-kit/physical/evidence/decision work. Phase6.2 remains5 complete/3 in
progress/5 not started; current008/REM-01 work. Four REM/LIC008/Open003/NE/native/
Security/production gates unchanged. AI review not human assurance. Uncommitted.

## LIC-CHG-0120 / LIC-EV-0189: implementation-readiness packet prepared

2026-10-11: requested next deliverable consolidated into machine-readable
TEST_ONLY packet: proposed runtime/controller source allowlist, bootstrap/
owner/object/action responsibilities, physical report fields, stopping/retention
and source/package/kit/archive custody/authorization boundaries. Read-only
checker and20 negative consistency checks PASS; four existing input pins match.
[Exact packet and limits](../experiments/LICENSING_PILOT_FOUNDATION.md).
NOT_BUILT: no actual role/controller/native implementation or executable five-test
kit. Prior statement of completing that kit was broader than this checkpoint.
Next scoped packet review then explicit exact implementation decision; no
automatic physical authorization.670 reviewed model tests remain historical
unchanged evidence, not rerun. Four REM/LIC008/Open003/NE/native/FEP/Security/
production gates unchanged. User requests all current changes committed afterward.

## LIC-CHG-0121 / LIC-EV-0190: readiness packet review and precision correction

2026-10-11: distinct non-author scoped AI review concludes packet sufficient
for the user's explicitly authorized TEST_ONLY implementation. LOW IP-C01:
checker did not independently enforce exact file names/owners/ACE sets. Fixed
with pinned independent expectations and three new mutation negatives;23 PASS.
Historical packet0.1 and four referenced inputs remain byte-identical. Review
does not authorize physical execution or establish human security assurance.

## LIC-CHG-0122 / LIC-EV-0191: native primitive implementation started

2026-10-11: seven actual candidate C# primitive sources now compile with strict
warnings-as-errors. Managed-only43 cases and three actual process entry refusals
PASS. Token/owner, secure file/ACL, native worker, service-host and Software KSP
fixture interfaces are implemented but unconnected/unverified on Windows.
Main refuses every non-self-test command before native/protected access.
This is NOT the full executable pilot: role/report emitters, actual child,
controller/bootstrap/collision/context/checkpoints and self-contained kit/archive
remain incomplete. [Exact checkpoint and next implementation work](../experiments/LICENSING_PILOT_FOUNDATION.md).
No physical execution, product/backend changes or gate closure. Five current
physical cases remain0/5; LIC008/four REM/NE/native/Security/production stay open.

## LIC-CHG-0123 / LIC-EV-0192: Prepare role/report implementation slice

2026-10-11: user-requested prior changes committed691a787 before new work.
RoleActions implements first three Prepare actions (setup-create,
guardian-prepare,setup-publish); ReportEmitter implements closed39-field/fixed
result schema, native role/boot/artifact capture interfaces and create-new
own-role report output. NativeWorker-ended/UNKNOWN retention boundaries enforced;
no global BAD_KEYSET denial classifier, retries, adoption or deletion.
Nine candidate sources compile warnings-as-errors;67 pure cases and three
actual physical-entry refusals PASS. None of these is a native/physical PASS.
Main still exposes only self-test. [Exact output and missing integration](../experiments/LICENSING_PILOT_FOUNDATION.md).
Remaining App/actual-child, fresh/cleanup actions, controller/bootstrap and full
self-contained kit/report/custody integration require completion and consolidated
review. Current five physical cases0/5, all prior open gates unchanged.

## LIC-CHG-0124 / LIC-EV-0193: App/actual-child Prepare implementation

2026-10-11: after prior slice commit e3c6427, user authorizes next coding step.
App/Child Prepare probe/decrypt actions, primary-identity child-start interface,
independent own-report output and parent context matching implemented. Generic
BAD_KEYSET remains OBSERVED, not proven denial/absence; open success FAIL, other
errors UNKNOWN. Private ownership/staging not read by these roles. Runtime/
profiler override stripping affects child environment only; no shell/runas/
credentials/kill/retry. Child wait obeys actual worker-completion retention.
Nine sources compile;112 pure cases and three entry refusals PASS. No actual
child/native/service execution, Main still self-test-only. Five Prepare bodies
now coded; physical cases0/5, full kit not complete. Next fresh/cleanup actions
and controller/dispatch/custody integration, then consolidated review.
[Exact new output and limits](../experiments/LICENSING_PILOT_FOUNDATION.md).
No LIC008/REM/NE/native/Security/production gate closure; new work uncommitted.

## LIC-CHG-0125 / LIC-EV-0194: fresh/owned-cleanup candidate actions

2026-10-11: user authorizes the next coding step. Remaining five action bodies
implemented: retained Guardian fixture/policy/export/mutation checks, fresh App/
Child route/context, Setup two-key owned cleanup and Guardian raw absence probes.
Both chains/policies/fixtures verified before deletion; intent and per-key result
flushed through one new verified report handle. No existing report adoption,
files/services cleanup, recreation, retry or forced worker termination. Progress
does not claim final success; interrupted writes/power-loss remain unverified.
Guardian BAD_KEYSET is OBSERVED only; future controller must correlate deletion
reports/context, not treat raw status as proof of absence.
162 pure cases and three entry refusals PASS; all10 action bodies now candidate
code, not10 physical results. Main still self-test-only; no real key deleted or
fresh process run. [Exact checkpoint and integration gaps](../experiments/LICENSING_PILOT_FOUNDATION.md).
Next controller/bootstrap/checkpoints/dispatch/self-contained custody integration,
then consolidated built-kit review and separate stage permissions. Physical0/5;
all LIC008/four REM/NE/native/Security/production gates unchanged. Uncommitted.

## LIC-CHG-0126 / LIC-EV-0195: controller evidence core and gated entry

2026-10-11: prior App/Child/fresh/cleanup source/docs committed2e52784 before
new work. StageController now matches exact reports/role/run/plan/artifact/token/
service SID inputs, process lifetimes and child nesting, exact stopped/manual/
PID0 service snapshots, stage/history/context/shared-file continuity and Finish
deletion-plus-absence evidence. Checkpoints are volatile candidate values; actual
trusted native observation and protected checkpoint persistence remain absent.
New frozen Run-Pilot.ps1/README-fa entry: SelfTest only with an external provenance
digest and admitted candidate bindings, three physical stages unconditionally
refused before inspection/mutation.219 pure cases, three executable refusals,
three controller-stage refusals and pinned wrapper SelfTest PASS. No new physical
run or full-kit/Security/production acceptance. [Exact checkpoint and remaining
integration](../experiments/LICENSING_PILOT_FOUNDATION.md).
Next native bootstrap/collector/persistence and self-contained source/package/
kit/archive custody, then consolidated review. Native entry stays NOT_READY.

## LIC-CHG-0127 / LIC-EV-0196: native readback and checkpoint persistence candidate

2026-10-11: previous controller core committed638f4ba. Disconnected
ControllerWindows interfaces now query exact test service registrations/config/
status/SIDs and read protected reports/shared files/checkpoints. Create-new
protected canonical checkpoint persistence flushes and verifies readback, with
independent re-reads before validation.265 managed cases, six guarded physical
entry refusals and provenance-pinned wrapper SelfTest PASS; no native execution.
Process/token lifetime collector, root/key collision bootstrap, service creation/
dispatch and full self-contained custody/review remain unfinished. This does NOT
complete the native controller or close any checklist/security gate. Physical0/5.
[Exact evidence and remaining work](../experiments/LICENSING_PILOT_FOUNDATION.md).

## LIC-CHG-0128 / LIC-EV-0197: retained process/token observer candidate

2026-10-11: prior readback/persistence step committed35906d0. ProcessObserver
adds disconnected SCM-live-PID/retained handle, creation/exit/parent/image and
external primary-token measurements, independent bounded child discovery and
observation/report matching. Persistence now requires real observer instances,
not injected process-receipt DTOs.316 managed cases/six physical-entry refusals
and bound wrapper SelfTest PASS; no native/process/token/service operation.
Live capture timing and cross-account query permissions remain unverified;
unavailable/missed/ambiguous evidence refuses without privilege enabling or kill.
Next safe root/key/service bootstrap and reviewed observation/role dispatch,
self-contained custody and consolidated review. Physical0/5; no acceptance gate
closed. [Exact evidence and limitations](../experiments/LICENSING_PILOT_FOUNDATION.md).

## LIC-CHG-0129 / LIC-EV-0198: bootstrap preflight / key-absence contract blocker

2026-10-11: prior observer step committedb3a6e20. Read-only BootstrapAdmission
candidate probes exact root/three registrations/two Software-KSP machine keys;
presence rejects, denied/unknown rejects and BAD_KEYSET remains unknown. No native
calls performed.344 managed cases/six gated entry refusals/wrapper test PASS.
Bootstrap cannot progress: preserved spec0.1 section2 requires key absence before
any write while the admitted raw probe has no conclusive absence classification.
No overwrite/adoption/enumeration/privilege/helper exception introduced. Need
owner direction for a narrow successor contract and review, not automatic
relaxation. Mutation/dispatch/live-capture integration remains incomplete and
physical0/5; all gates unchanged.
[Exact evidence, blocker and proposed direction](../experiments/LICENSING_PILOT_FOUNDATION.md).

## LIC-CHG-0130 / LIC-EV-0199: proposed key-collision successor0.3

2026-10-11: owner agrees to prepare the proposed correction. New
[specification0.3](../plans/LICENSING_ADAPTER_PHYSICAL_PILOT_SPEC_V03.md) replaces
only pre-write key-absence-by-open with exact Setup create-new/no-overwrite
collision enforcement. Root/service absence and all pins/ownership/ACL/policy
guards stay; a late key collision retains public bootstrap/partial keys and
blocks publication/stage progression. Intent alone is not ownership/cleanup
authority. No retry/adoption/permission/helper expansion introduced.
Status AUTHOR_DRAFT_AWAITING_SCOPED_REVIEW, not adopted/executable/accepted.
Six bounded review checks specified; code/packet/previous spec bytes unchanged.
EV0198's344 managed tests not reclassified as successor tests. Next scoped
consistency review and explicit adoption/binding, then bounded implementation.
Physical0/5 and all licensing/native/security gates unchanged.

## LIC-CHG-0131 / LIC-EV-0200: limited author review of collision successor0.3

2026-10-12: c02280c commits prior preflight/draft. [Six-item consistency review](../reviews/LICENSING_ADAPTER_PHYSICAL_PILOT_SPEC_V03_REVIEW.md)
supports document direction, NOT independent/native/security acceptance. Exact
0.3 SHA256dfce64538c6fd13aa0891996f9ee94b7807c9e210be3060b508b66f2e75848d6;
previous specs/packet/code unchanged. V03-I01 remains an implementation gap:
current finalized-handle wrapper is not persisted-name reopen; inherited0.1
requires name/policy/public-identity readback before owned record/next key.
Next explicit successor adoption/binding/review-authority decision, new bound
packet and scoped correction/negative tests, then controller/custody/built-kit
review. No new tests or native calls;344 prior cases unchanged, physical0/5.
LIC008/four REM/NE/security/native gates unchanged; review docs uncommitted.

## LIC-CHG-0132 / LIC-EV-0201: scoped product adoption and successor packet0.2

2026-10-12: owner directs the explicitly described adoption/binding next step.
[Decision record](../plans/LICENSING_ADAPTER_PHYSICAL_PILOT_SPEC_V03_ADOPTION.md)
adopts exact0.3 as PRODUCT implementation direction only; independent review
unsatisfied, no security/physical/native approval or waiver. New separately bound
implementation-packet-v02.json inherits the frozen base except closed bootstrap/
Setup-create/source replacements and no-overwrite/persisted-name requirements.
Base/spec/author-review/adoption pins bind authority separately; V03-I01 remains
OPEN. New read-only checker verifies base+7 referenced pins,16 source paths and
24 negative checks PASS. No344-case rebuild or native operation. Next scoped
V03-I01/bootstrap integration and negative tests with entry still closed, then
remaining controller/custody/built-kit/review-authority gates. Physical0/5 and all
LIC008/REM/NE/native/security gates unchanged. New changes uncommitted.

## LIC-CHG-0133 / LIC-EV-0202: successor preflight and persisted-name correction

2026-10-12: adoption/packet/review changes committed4999d47 first. Setup now
verifies created handle and newly opened persisted name/policy/public identity
before owned record/next label. V03-I01 SOURCE_CORRECTED_NATIVE_NOT_RUN, not
independent Security closure. Distinct digest-bound successor preflight checks
root/three registrations without key-open absence inference; legacy refusal
unchanged. Builder freezes exact base/successor/spec/review/adoption inputs and
checks emitted compiled successor digest.371 managed cases (344+27), six guarded
entry refusals and bound wrapper SelfTest PASS; no native execution. Next complete
public bootstrap/service/live-observer/role coordination and self-contained
custody/built-kit review; entry disabled, physical0/5 and all gates unchanged.
[Exact retained output](../experiments/LICENSING_PILOT_FOUNDATION.md).

## LIC-CHG-0134 / LIC-EV-0203: create-new public bootstrap/registration candidate

2026-10-12: previous correction/source/docs committed791bd4a first. Candidate
freezes approved plan/package bytes, verifies pins/pre-registration SID lookup,
creates seven Controller-owned public directories and new protected package/
plan/admission with readback; registers only three exact new Manual own-process
services, configures SID1 only on new handles and verifies stopped/PID0/config/
no recovery/delayed start/triggers. No old-service adoption/reconfiguration,
start/stop/delete/key mutation/rollback.396 managed cases (371+25), six entry
refusals and bound wrapper PASS. Native methods disconnected and NOT_RUN.
Next role dispatch/live-observer coordination and full host/package/kit custody/
review-authority checks; physical0/5 and all licensing/security gates unchanged.
[Exact checkpoint](../experiments/LICENSING_PILOT_FOUNDATION.md).

## LIC-CHG-0135 / LIC-EV-0204: ordered role dispatch and retained-observer coordination

2026-10-12: prior bootstrap source/docs committedb6f3c9b. Disconnected service/
child dispatch argument checks, single StartService/RunId, live capture polling,
per-action report/token/parent validation and ordered stage/checkpoint coordinator
coded. Existing report paths refuse replay; ambiguous/missed/late results retain
observers/block later actions, no stop/kill/retry.481 managed cases (396+85), six
entry refusals and bound wrapper PASS. No actual service/child/native execution.
Next self-contained package/closed custody, reviewed activation/host binding and
outstanding independent-review authority/built-kit checks before separately
permitted stages. Main/kit disabled, physical0/5, licensing/security gates open.
[Exact retained evidence and limitations](../experiments/LICENSING_PILOT_FOUNDATION.md).

## LIC-CHG-0136 / LIC-EV-0205: gated self-contained package and delivery custody

2026-10-12: prior source/docs committed8dab9b6 first. Builder creates app-local
self-contained candidate with194 closed package files,234-entry kit/ZIP and
verified extraction; external manifest/provenance graph avoids self-hash cycle.
Package wrapper validates every file/actual EXE/DLL/runtime/local CoreLib and
kit/extracted SelfTests repeat481 cases, not new unique cases. Physical modes and
wrong external pin refuse, no native role execution. No actual host binding,
Main/controller activation/independent approval/clean-machine evidence. Next
those admission/activation and consolidated built-kit/authority checks before
individually authorized stages. Physical0/5; licensing/security gates unchanged.
[Exact retained output](../experiments/LICENSING_PILOT_FOUNDATION.md).

## LIC-CHG-0137 / LIC-EV-0206: measured read-only host inspection / plan matching

2026-10-12: packaging source/docs committed31cc813 first. Typed host snapshot
and independent plan-digest comparison added before bootstrap/role/start and
post-success context. Exact read-only InspectHost entry/package wrapper added;
service/child/controller routes remain disabled.501 managed cases (481+20),
self-contained kit/extraction PASS. Actual readonly current-host OS/registry/
boot inspection PASS:10.0.22000 workstation/X64/runtime10.0.11, no raw GUID output,
owner/security/physical approval false. Machine fingerprint is not anti-clone
or security attestation. Next actual reviewed controller/Main admission/activation
and consolidated built-kit/authority checks before individual stage permission.
Physical0/5 and licensing/security gates unchanged.
[Exact host/provenance evidence](../experiments/LICENSING_PILOT_FOUNDATION.md).

## LIC-CHG-0138 / LIC-EV-0207: separate controller binding / protected intake candidate

2026-10-12: EV0206 source/docs committed bb12007 before implementation. Controller
admission now snapshots bounded canonical plan bytes and compares separately
supplied stage, experiment, plan/packet, host/boot, package/source/kit/provenance/
profile and previous-stage pins. Public bootstrap and ordered-stage APIs require
this binding before native access. Unrouted protected-plan loader checks current
controller token, file protection, role SIDs, boot, host and package. No claim of
authenticated authorization or independent review; pre-bootstrap external intake
and reviewed Main/wrapper activation remain open. 561 managed cases (501+60);
physical0/5 and LIC008/REM/NE/native/security/production gates unchanged.
[Exact build/custody results](../experiments/LICENSING_PILOT_FOUNDATION.md).

## LIC-CHG-0139 / LIC-EV-0208: bounded external input validation entry

2026-10-12: EV0207 committed ff8e3ea first. Added closed ControllerInput wrapper
and exact whole-input hash checked before parsing. Existing plan/expected-pin
validation follows; oversized, duplicate/unknown-property and inconsistent inputs
refuse. Package ValidateInput transports a bounded file snapshot over stdin to
the fixed apphost after package/provenance verification. Exact Main diagnostic
entry is read-only; no physical activation, protected intake or service/key call.
597 managed cases (561+36) and actual synthetic input entry/wrapper checks; input
success explicitly reports liveContextValidated/executionAuthorized=false.
External digest is correlation, not authentication or independent review. Next
reviewed authority/custody-to-binding construction and activation, then separately
permitted stages; physical0/5 and all security/production gates unchanged.
[Exact results and limitations](../experiments/LICENSING_PILOT_FOUNDATION.md).

## LIC-CHG-0140 / LIC-EV-0209: exact owner-decision / stage connection candidate

2026-10-12: initial worktree clean, previous changes already committed2c95246;
no empty commit created. Closed owner decision correlates separately pinned
canonical decision SHA256 and expected account-shaped SID to exact canonical
controller input/binding, stage and experiment. UTC validity checked at admission
and use (candidate maximum24h, not trusted security time). Private-construction
OwnerAdmission replaces raw plan/binding at bootstrap and ordered-stage APIs.
Process-local one-use decision reservation precedes native access; Prepare can
continue only on the same object after bootstrap readback. Partial bootstrap is
not retryable/continuable. Read-only Main/package ValidateOwnerInput added.
677 managed cases (597+80) and actual synthetic apphost/package/extracted checks
PASS. Does not authenticate decision issuer or prevent replay after restart;
source of owner authority, durable consumption and activation review remain
open. Diagnostic ownerRecordMatched=true is NOT ownerApproved/authorized.
Physical0/5 and licensing/security/production gates unchanged.
[Exact candidate evidence and limitations](../experiments/LICENSING_PILOT_FOUNDATION.md).

## LIC-CHG-0141 / LIC-EV-0210: owner author-review / executor-match correction

2026-10-12: previous owner connection committed f4f8af0 first. Bounded author
review identifies current executor/issuer distinction, process-local replay,
missing contract-approved journal slots and bootstrap DTO provenance dependency.
Candidate correction compares actual primary controller TokenUser to owner
decision SID before bootstrap/stage reservation and each ordered service action;
existing no-impersonation/default-owner/elevation checks preserved.688 managed
cases (677+11), self-contained/kit/extraction PASS; native owner check NOT_RUN.
Issuer authority and durable consumption remain open, no physical activation.
[Review](../reviews/LICENSING_PILOT_OWNER_CONNECTION_REVIEW.md) is not independent
acceptance. [Narrow journal/owner proposal](../plans/LICENSING_PILOT_OWNER_AUTHORITY_PLAN.md)
is NOT_ADOPTED/NOT_IMPLEMENTED; review/adopt/bind before new protected paths.
Physical0/5 and LIC008/REM/NE/native/security/production gates unchanged.
[Exact candidate evidence](../experiments/LICENSING_PILOT_FOUNDATION.md).

## LIC-CHG-0142 / LIC-EV-0211: finalized owner/journal proposal and author review

2026-10-12: initial git clean at130906d. Finalized exact context/consumed schemas,
separate trusted owner-context pin, live console challenge, CREATE_NEW stage-slot
race/retention/readback and bootstrap crash boundary. Closed machine-readable
proposal binds three preserved references; read-only validator33 negative cases
PASS. No runtime code/binary changes or native operations; previous688 runtime
cases not rerun. [Author review](../reviews/LICENSING_PILOT_OWNER_AUTHORITY_REVIEW.md)
is complete for the [final proposal](../plans/LICENSING_PILOT_OWNER_AUTHORITY_PLAN.md),
not independent/owner adoption. Status ADOPTION_PENDING/NOT_IMPLEMENTED. Next
scoped adoption and successor binding before journal/producer coding; no silent
path expansion or runtime packet switch. Physical0/5; all acceptance gates open.
[Exact proposal hashes/evidence](../experiments/LICENSING_PILOT_FOUNDATION.md).

## LIC-CHG-0143 / LIC-EV-0212: scoped owner-contract adoption / successor0.3 binding

2026-10-12: owner explicitly requested the described scoped adoption/binding and
commit if checks passed; initial worktree clean atf729a5f. Recorded
[product implementation-direction adoption](../plans/LICENSING_PILOT_OWNER_AUTHORITY_ADOPTION.md),
not real host/kit/stage approval or independent acceptance. New implementation
packet0.3 overlays preserved0.2 with exact owner confirmation/reservation rules,
three fixed controller file additions and bootstrap ordering; all other source,
key/service/ACL/stage/report/custody boundaries inherit unchanged. New packet
SHA25644ede8aa237a80667ccc3c3da4580aa8231041d443d7b9904be32481b6233d8a.
Read-only checker verifies14 transitive raw pins and32 negatives; runtime pin
explicitly remains0.2. Existing proposal33/base23/old successor24 checks pass.
No runtime/native build, path-rule implementation or actual reservation this
step; previous688 runtime cases not rerun. Next implement producer/journal and
private live proof under successor0.3 while physical entry stays closed.
Physical0/5 and all independent/native/durable/security/production gates open.
[Exact binding evidence](../experiments/LICENSING_PILOT_FOUNDATION.md).

## LIC-CHG-0144 / LIC-EV-0213: successor-bound journal / live-confirmation primitives

2026-10-12: baseline d23d42c, initial git clean. Compiled successor pin now adopted
0.3; builder pins14 protocol inputs. Added only three exact controller file rules,
required closed OwnerContext/OwnerConsumed schemas, immutable context/challenge
checks and live confirmation producer with private constructor. Native reservation
primitive uses CreateNew/protected write/flush/close/independent readback plus
retained parent protection; only direct success returns a private proof. No native
console/token/file reservation operation ran.877 managed cases (688+189) pass;
restart/race are managed models, not physical durability evidence. Physical Main/
wrapper closed and both mutation roots additionally gated CoordinatorReady=false.
Prior-slot/predecessor checks, reservation-to-coordinator handoff, native bootstrap
provenance and trusted context entry integration remain open; next implement this
coordination before bounded source/kit review and separately permitted tests.
Physical0/5; independent/native/durable/security/production gates unchanged.
[Exact candidate build evidence](../experiments/LICENSING_PILOT_FOUNDATION.md).

## LIC-CHG-0145 / LIC-EV-0214: prior reservation and completed-chain validation

2026-10-13; clean baseline f45b579. Before a new owner slot is created, the
candidate reads all earlier fixed slots, protected plans, checkpoints and exact
report files. Validates chronological stage/plan/context/hash/evidence/run-ID
links, owner identity, distinct decision IDs, canonical context/challenge pins
and the current plan's chain tip. RESERVED alone is never completed evidence.
927 managed cases (877+50) pass; package validation and exact artifact evidence
are recorded in the foundation checkpoint. Historical correlation does not
reconstruct consent, decision-window attestation or a live observer/proof.
No native history reads or reservations ran; physical0/5 and all acceptance gates
unchanged. Next bootstrap ordering/private reservation handoff and native
registration provenance, then trusted entry/source-kit review. CoordinatorReady
and physical Main/wrapper remain closed.
[Evidence and limits](../experiments/LICENSING_PILOT_FOUNDATION.md).

## LIC-CHG-0146 / LIC-EV-0215: live reservation handoff and bootstrap provenance

2026-10-13; baseline ac9c08f. Prepare takes direct console-confirmation proof,
creates only root/controller before reservation, then verifies the private live
reservation before directory/package publication and native registration. A
privately constructed bootstrap Completion follows actual registration/readback;
arbitrary service receipt arrays cannot advance OwnerAdmission to ready.
RunOrderedStage requires the exact same-owner reservation, consumes its attempt
once and rechecks token/host/boot/package/window/journal/history before launches.
954 managed cases; exact package/check results in the foundation checkpoint.
Main/wrapper and CoordinatorReady stay closed; no native operation ran.
Next trusted owner-context entry integration and bounded source/kit review;
separately permitted physical tests remain0/5 and acceptance gates unchanged.
[Evidence and limits](../experiments/LICENSING_PILOT_FOUNDATION.md).

## LIC-CHG-0147 / LIC-EV-0216: reviewed owner entry composition

2026-10-13; baseline9fc47c9. Internal OwnerEntry composes separately entered
reviewed account/context pins, immutable input correlation, retained preflight,
live confirmation with stage effects, private reservation/bootstrap, current-plan
publication and ordered dispatch.1008 managed cases (954+54); package evidence
in foundation. Bounded author review records exact source and remaining external
loader/console launcher/controller-role dispatch work. No actual prompt or native
operation ran; Main/wrapper and CoordinatorReady stay closed. Next bounded
external activation connection and its kit review, then individually permitted
physical stages. Physical0/5 and all acceptance gates unchanged.
[Owner entry review](../reviews/LICENSING_PILOT_OWNER_ENTRY_REVIEW.md).

## LIC-CHG-0148 / LIC-EV-0217: gated external dispatch and console launcher

2026-10-13; baseline c0a9e01. Main now has a closed physical dispatch connection
for exact controller/service/child command shapes. External snapshots require
canonical local file paths, bounded reads, non-reparse same-handle final-path/
kind checks; Prepare snapshots only the declared app-local package. The wrapper
has a separate inherited-console launch branch after full package verification,
without redirected streams, auto-elevation or automatic approval values.
1044 managed cases (1008+36), package checks and source review recorded below.
Compiled CoordinatorReady and wrapper physicalEnabled remain false; no native
external reads, prompts or role runs occurred. Next exact activation-readiness
review/real input preparation and separately permitted Prepare; do not simply
flip gates or treat diagnostic provenance as physical permission. Physical0/5
and independent/native/durable/security/production gates unchanged.
[Connection review](../reviews/LICENSING_PILOT_OWNER_ENTRY_REVIEW.md).

## LIC-CHG-0149 / LIC-EV-0218: activation readiness and real-host review drafts

2026-10-13; baseline1603497. Read-only current-host/package inspection succeeded.
All three exact services returned1060 and pre-registration account translation
failed for each, exposing a real bootstrap dependency. Corrected pre-registration
check to fixed-name SID derivation; post-registration account/token comparison
remains mandatory. Three computed vectors match Windows sc.exe showsid.1052
managed cases and corrected package/archive checks PASS; no service creation ran.
New prepare-license-pilot-review.mjs verifies exact inert package/source/delivery,
captures host read-only and creates manifest-bound real-host plan/profile drafts
in out. OwnerAuthorized/BuiltKitReviewed false; no owner decision/context/window
or executable approval emitted. Compiled diagnostic rejects the draft as required.
Activation/profile/input review and exact-kit Prepare permission remain open.
Physical0/5 and all acceptance gates unchanged; exact evidence in foundation.
[Readiness review](../reviews/LICENSING_PILOT_OWNER_ENTRY_REVIEW.md).

## LIC-CHG-0150 / LIC-EV-0219: concrete draft review and activation work package

2026-10-13; baseline b809e1c. EV0218 manifest-bound profile/Prepare drafts reviewed
against current source and194 package files;244 read-only consistency assertions
PASS. Compiled InspectHost confirms unchanged host/boot. Crypto profile agrees
with hard-coded key creation/reopen policy; its digest is a context binding, not
a runtime-parsed approval. Draft authority flags remain false. No runtime source
changed and no new managed test count claimed. Author review only.
[Entry review](../reviews/LICENSING_PILOT_OWNER_ENTRY_REVIEW.md) now defines one
bounded activation implementation package: aligned gates/build metadata/wrapper/
preview and non-physical negative checks. Build final candidate and regenerate
pins before seeking individual Prepare permission; old inert-kit approval cannot
cover changed bytes. Enabled final kit NOT_BUILT; physical0/5, LIC008/Open003 and
all independent/native/durable/security/production gates remain unchanged.

## LIC-CHG-0151 / LIC-EV-0220: experimental executable capability built

2026-10-13; baseline888d217. Separate compile-time TestCapable artifact and default
inert artifact built;1053 managed cases PASS in each, package/archive/extracted
custody PASS. Runtime diagnostic guard prevents SelfTest from opening coordinator
entry. Wrapper matches pinned manifest/provenance capability to actual EXE/DLL
capability report before live dispatch; confirmation preview reflects build mode.
Two metadata mismatch and three noninteractive stage refusals PASS per build.
All actual owner/bootstrap/role/ACL/key paths remain unexecuted. Fresh false-flag
review drafts bind the final candidate; no owner decision/context issued.
Next final input/context and exact Prepare permission, then three separate
physical stages and five-case evidence reconciliation, not repeated preparation
reviews. LIC006-008 remain in progress;009-013 unstarted. Production Guardian,
Store, IPC, admission, Vendor, Installer and platform gates are not closed.
[Evidence and remaining sequence](../experiments/LICENSING_PILOT_FOUNDATION.md).

## LIC-CHG-0152 / LIC-EV-0221: pending exact Prepare decision/context

2026-10-13. EV0220 final kit unchanged. Review helper adds hash-linked controller,
owner-input and context drafts; PENDING_OWNER_APPROVAL, invalid zero-length epoch
window and false plan approval flags prevent use as execution authorization.
17 consistency/refusal assertions PASS, including both compiled diagnostic
rejections. Next explicit owner Prepare-only permission for the exact EV0220
kit/effects, then fresh host/boot check and bounded approval/pin issuance. No
physical operation, authority promotion or checklist closure. Evidence in
[foundation](../experiments/LICENSING_PILOT_FOUNDATION.md); physical0/5 unchanged.

## LIC-CHG-0153 / LIC-EV-0222: partial Prepare and read-only diagnostic candidate

Built review: [v0.4 inert kit](../reviews/LICENSING_REPORT_V04_BUILT_KIT_REVIEW.md)
passes bounded custody/self-test checks. Retained V1 registrations block fresh
same-name placement. [Fixed isolated namespace proposal](../plans/LICENSING_PILOT_ISOLATED_PLACEMENT_PLAN.md)
is next inert direction; no cleanup/resume, native acceptance or live approval.

Successor binding completed: [packet0.4 result](../../../licensing/adapter-evidence/guardian-readonly/REPORT_V04_BINDING.md).
New adopted packet, runtime/build/helper pins coordinated;22 transitive references
and1807 managed cases PASS, inert self-contained kit built. No native stage or
permission issued; next bounded built-kit review/retained-placement resolution.

Latest: schema2 bounded author review PASS_LIMITED; [separate adoption](../plans/LICENSING_REPORT_IDENTITY_V02_ADOPTION.md)
records product implementation direction only, under the owner's instruction to
proceed. Frozen draft/base bytes unchanged. Next adopted0.4 packet and coordinated
inert bindings; independent/physical/security/production acceptance remain false.

Successor preparation: [schema2 adoption draft](../plans/LICENSING_REPORT_IDENTITY_V02_ADOPTION_PLAN.md)
and closed contract/packet0.4-draft created without modifying frozen v0.3 bytes.
All adoption/execution/security flags false. New checker4 direct pins/42 fields/
28 negatives PASS; old14 pins/32 negatives preserved. Runtime/build packet switch
and physical capability remain blocked pending review and scoped adoption.

Latest R1 disposition: [bounded re-review](../../../licensing/adapter-evidence/guardian-readonly/RESTRICTION_LENGTH_REVIEW.md)
at1e21662 PASS_LIMITED for implementation/managed tests;1807 rerun and30 source
pins match. Next explicit schema2 successor contract/adoption/bindings; no native
Guardian or Windows-matrix acceptance, no frozen-protocol overwrite.

R1 implementation update: [dedicated restriction reader](../../../licensing/adapter-evidence/guardian-readonly/RESTRICTION_LENGTH_CORRECTION.md)
accepts only successful1/4-byte responses, reads only returned bytes and rejects
unknown/error responses.27 new tests;1807 managed PASS. Bounded re-review pending;
generic token reader, security policy and physical-entry block unchanged.

Review override: [bounded author review](../../../licensing/adapter-evidence/guardian-readonly/IDENTITY_INTEGRATION_REVIEW.md)
of18943e4 is CHANGES_REQUIRED. Read-only current-token query returns one byte for
TokenHasRestrictions, rejected by new generic reader. R1 must be corrected and
tested before adoption/physical build. Managed1780 PASS does not clear native R1.

Integration follow-up: [schema2 inert candidate](../../../licensing/adapter-evidence/guardian-readonly/IDENTITY_INTEGRATION.md)
now carries required group-count/restriction/query fields through native capture,
reports, independent observer and both controller paths. Schema1 is not accepted
as schema2. TestCapable builder blocked pending successor adoption/review; frozen
protocol and original retained package unchanged. No physical acceptance.

Latest follow-up 2026-10-15: token-detail result20024 confirms absent matching
service group while user/owner/primary checks match. [Pure correction candidate](../../../licensing/adapter-evidence/guardian-readonly/IDENTITY_CORRECTION.md)
separates virtual-account identity from group membership;660 pure cases PASS.
No runtime/protocol changes or security acceptance. Versioned evidence fields
and both controller validation paths require coordinated integration next.

2026-10-15 follow-up: first diagnostic returned1066/202 (stage2 combined service
identity rejection), with original path restoration independently observed via CIM.
Individual predicate remains unknown. [Token-only successor](../../../licensing/adapter-evidence/guardian-readonly/TOKEN_DETAIL.md)
separates bounded token observations without changing original admission;150 pure
tests and read-only runner preflight pass. New boot pinned, new directory only;
physical token-detail execution pending. No security/production acceptance.

2026-10-14. Owner transcript reports Setup four PASS results and no Guardian
report; SCM previously showed Guardian1067 and App unstarted. Current boot has
changed; Guardian now Stopped/Manual with original path/account and1077. Retain
both test keys and all state; no retry or cleanup. Four supplied owner/DACLs
match source. Original ServiceHost discards failure detail into generic1067;
root cause remains unproven. Separate fixed-plan/assembly/boot diagnostic built
and tested22 pure error classifications plus3 invalid-command refusals. It only
queries identity/files/ACLs and opens/verifies existing keys; no role execution,
seal/export or protected writes. No physical diagnostic execution. Temporary
Owner subsequently supplied separate scoped diagnostic permission. The one-shot
protected deployment runner passes read-only preflight (runtime/artifact pins,
boot/configuration and three predicate negatives). Agent is non-elevated; owner
Execute and numeric result/restoration review remain pending. No native deployment
or restoration success claimed. Prepare PARTIAL/FAILED,0/5 full cases accepted; all security/production
and LIC008 closure gates remain open. See [candidate limits](../../../licensing/adapter-evidence/guardian-readonly/README.md).

## LIC008 W03 typed V3 chain: V8 pure checkpoint (2026-11-18)

The [V8 evidence archive](../evidence/standard-native-typed-chain-v3-20261118/README.md)
records a warning-as-error pure build with check counts, in source-set order,
**144/134/1,020/700/187/82/157/44/331/106/76**. Reviewed source-set SHA256:
`87ab17b4ab7dabdfa19c826970f8dcedc42fa45a845061a4284efff56102c921`.
An injected fresh reader checks nine directory witnesses and original slots
0-40, including a typed slot-40 prefix seal. The seal carries the verified
stage directory path, 64-bit volume and 128-bit file ID. A separate V3
Owner intent at slot 41 binds that seal; the V3 reservation writer and
fresh-reader parser at slot 42, and the preactivation proposal at slot 43,
require the typed intent without a V2 fallback. The Windows reservation
sink remains compile-only. The prior
[V7 prefix/intent archive](../evidence/standard-native-prefix-seal-v3-20261118/README.md)
remains historical evidence of the earlier unconnected model.

This pure chain does not establish actual protected W03 root and ancestor
placement, native Owner/worker/host/boot identity, held slot-40 file or
cross-process custody, crash-durable namespace state, standard-account
denial, account activation, a held User child, or physical slots 44-68.
No W03 account, service, key, host CLR-load or protected-file action ran for
V8. All
authority and acceptance flags remain false; LIC008/Open003, native and
Security/production gates remain open. Next bind the typed chain to a
fresh reviewed physical W03 placement and native custody before any
physical W03 entry.

## Primary references

- [RFC 9052 — CBOR Object Signing and Encryption (COSE)](https://www.rfc-editor.org/rfc/rfc9052.html)
- [RFC 9053 — COSE algorithms](https://www.rfc-editor.org/rfc/rfc9053.html)
- [RFC 8949 — CBOR and deterministic encoding](https://www.rfc-editor.org/rfc/rfc8949.html)
- [NIST FIPS 186-5 — Digital Signature Standard](https://csrc.nist.gov/pubs/fips/186-5/final)
- [NIST SP 800-57 Part 1 Rev. 5 — Key-management guidance](https://csrc.nist.gov/pubs/sp/800/57/pt1/r5/final)
- [Microsoft TPM fundamentals](https://learn.microsoft.com/en-us/windows/security/hardware-security/tpm/tpm-fundamentals)
- [Microsoft CNG key storage providers](https://learn.microsoft.com/en-us/windows/win32/seccertenroll/cng-key-storage-providers)
- [Microsoft TPM key attestation concepts](https://learn.microsoft.com/en-us/azure/attestation/tpm-attestation-concepts)
- [Microsoft DPAPI scope](https://learn.microsoft.com/en-us/dotnet/api/system.security.cryptography.dataprotectionscope)
- [Microsoft Service SID information](https://learn.microsoft.com/en-us/windows/win32/api/winsvc/ns-winsvc-service_sid_info)
- [Microsoft QueryUnbiasedInterruptTime](https://learn.microsoft.com/en-us/windows/win32/api/realtimeapiset/nf-realtimeapiset-queryunbiasedinterrupttime)
- [RFC 8446 — TLS 1.3](https://www.rfc-editor.org/rfc/rfc8446)
- [Microsoft Authenticode timestamping](https://learn.microsoft.com/en-us/windows/win32/seccrypto/time-stamping-authenticode-signatures)
