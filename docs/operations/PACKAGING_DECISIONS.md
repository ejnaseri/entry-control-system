# Phase 6.0 Packaging and Installer Decisions

Current scheduling status — 2026-10-07: CHG0080/EV0149 adopts
[exact reviewed native-entry policy](../licensing/plans/LICENSING_NATIVE_ENTRY_ADOPTION.md).
Product and scoped independent-agent amendment Security approval recorded;
Open012 closed as scheduling-only. NATIVE-ENTRY NOT_READY; LIC008/Open003,
Vendor/artifact/contracts and all original full item/FILE/STORE/Windows/release
exits remain open as applicable. No native implementation or runtime authorization.
Older diagnostic/pending-dependency summaries below are historical checkpoints.

Current physical result: EV0135 completes V5/0.12.0 binary Repair simulation on Windows11 x64 build22000: key identity/envelope bytes preserved, Guardian/App/child controls and owned cleanup PASS, missing-key repair refused without recreation. V5 is consumed and must not be rerun. This is host-specific test evidence, not actual Installer Repair or security/production/matrix acceptance. EV0117's rejected DPAPI-NG result remains preserved as history.

Current next step: 2026-10-06: LIC001-005 remain complete; LIC006-008 remain in progress. EV0132 completes V4/0.11.0 normal restart on current Windows11 x64 build22000: same-key/envelope Guardian reopen/decrypt/export/tamper and App/actual-child contrast PASS; owned-key cleanup PASS; services independently Stopped/Manual. User-pasted summary confirms ordered boot/preparation times and normalRebootPassed=true; original protected report/checkpoint digests still need independent capture. CHG0065/EV0133 prepares fresh V5/0.12.0 binary Repair SIMULATION: Prepare creates/retains fresh test keys; Repair admits only verified existing keys/state, stages identical trusted bits in a separate directory, rechecks identity/envelopes/isolation, cleans up owned keys, then proves the same admission gate refuses controlled missing keys with retained envelopes and no recreation. Pure11/11, actual report contract, admission/evidence negative fixtures and package/parser guards PASS. EV0134 records V5 Prepare; EV0135 now records completed physical V5/0.12.0 Repair simulation on this host: same key identity and envelope bytes verified, Guardian/App/child controls PASS, owned-key cleanup PASS, controlled missing-key repair refused without key recreation. User-pasted summary reports repairSimulationPassed/hostFeasibilityPassed=true; original protected summary/checkpoint/evidence digests are not independently captured. Services independently Stopped/Manual. Never rerun V5. CHG0068/EV0137 prepared V6 Upgrade kit0.13.0; CHG0069/EV0138 now records physical OLD0.13.0 to NEW0.13.1 binary Upgrade SIMULATION PASS on Windows11 Pro21H2 x64 build22000. User-pasted summary confirms distinct managed artifacts, same key identity/envelope bytes and preserved OLD files, with no key recreation; Guardian/App/actual-child controls and owned-key cleanup PASS. Services independently Stopped/Manual on bin-new. CHG0070/EV0139 records the user's separate elevated read-only hash capture: original summary SHA2567b95d1e086b91de870445b7ed1e84c4f40fe83a6faa9c5e8fe20cf51de221517, checkpoint matches and all eleven evidence files match. This is operator verification, not independent Security review; V4/V5 hash gaps remain. V6 is consumed: never rerun Prepare/Upgrade. CHG0072/EV0141 now prepares V7 kit0.14.0: pure17/17 and actual report/package/hash/DACL/SID/checkpoint plus inert lifecycle/failure guards PASS. CHG0073/EV0142 records operator-run V7 Prepare/Uninstall/Reinstall transcript PASS: six Guardian controls, App/actual-child contrast, artifact0.14.0 and owned-key cleanup PASS. Exactly three test registrations removed/recreated; services independently Stopped/Manual, PID0. CHG0074/EV0143 reviews the supplied final summary and records operator read-only hashes: both checkpoints and all11 evidence files match; original summary SHA256cc8d7464fedb6b20b9adeae2d0e34f1aff483b3f481b975a74a1632ef9ffb586. Same key/envelope/protected bytes/SIDs/DACL continuity and no recreation are reported true/false as intended; this is operator evidence, not independent Security acceptance. V7 consumed: never rerun. UI/Attendance/Backup current status notes are synchronized against accepted evidence; broader hardening remains open. Next: review unresolved native-entry dependencies before Guardian/Store implementation. See [reinstall plan](../licensing/plans/LICENSING_WRAPPING_REINSTALL_PLAN.md). No new physical run is authorized by these results. See [Upgrade plan and kit](../licensing/plans/LICENSING_WRAPPING_UPGRADE_PLAN.md). Actual installer Repair/Upgrade, interrupted operation, TPM, separate standard account and Windows matrix remain open. This is not actual product Installer Repair; productionRepairTested/productionUpgradeTested/security/production/matrix remain false. Do not rerun consumed V1-V6. See [wrapping design](../licensing/design/LICENSING_SOFTWARE_KSP_WRAPPING_DESIGN.md).

Current protocol corpus correction: `LIC-CHG-0011` / `LIC-EV-0013` closes the descriptor-only erratum at protocol manifest `512534732dce759da424ba0e8d8838c3d9c294e3faa02a4017212ce482523eab`. All 224 descriptors remain (744 type expansions); wire/CDDL and acceptance policy are unchanged. LIC-6.2-004 pure state model is complete under LIC-EV-0016 after independent review and Reactivation collision remediation: 59/59 projection, 31/31 model, 27/27 security tests (18 owned STATE descriptors), plus Core/Protocol/Golden regression. LIC-6.2-005 portable trusted-time remediation is complete under LIC-EV-0026 after Product approvals LIC-CHG-0016/0017 and independent time_design_review remediation/rerun: Time 39/39, lifecycle 36/36, availability/repair 16/16, State 117/117 and Core/Protocol/Golden pass. Observed calendar is separate from the corroborated floor; future grants require corroboration, normal reboot/downtime alone does not lock, and signed repair preserves independent locks. LIC005 closure is committed as e49630a. LIC006 Offline workflows remain in progress: bounded import planning is committed as 7435dc8 (38/38). ACTIVATE/RENEW request work is committed as 67f9867 (LIC-EV-0030, 44/44). Entitlement completion/CAS acknowledgement passes36/36 under LIC-EV-0033 (import38/request44 and Core/State/Time/Protocol/Golden pass), with the fixed duplicate-request correlation failure retained in EV0032. Entitlement/Control checkpoint is committed as6c9fb09. RECOVER request/completion is committed as97a6d02 (LIC-EV-0038,36/36). REBIND is committed as91b4771 (LIC-EV-0041,40/40). TIME_CORRECT is committed as9703e13 (LIC-EV-0043,32/32). REACTIVATE request/two-artifact completion passes28/28 under LIC-EV-0045 (committed as c975958), with prior portable/crypto gates passing; real protected persistence, safe filesystem intake/export, durable reconciliation and independent closure review remain open; EV0047 records the remaining-obligations source audit and ten planned (not executed) safe-file/durable-adapter acceptance cases; portable selected-file orchestration passes16/16 fake-adapter cases under LIC-EV-0049 (committed as c975958), with prior portable/crypto gates passing; one-pass file-to-completion integration passes the expanded32-case file suite under LIC-EV-0051 (committed as c975958), with prior portable/crypto regressions passing; LIC-EV-0054 adds96/96 six-intent file completion cases (committed as c97eb29) with all prior portable/crypto regressions passing; LIC-EV-0055 completes independent review of c97eb29 with no reproducible blocking finding,8/8 additional probes and aggregate rerun passing; see LICENSING_OFFLINE_REVIEW.md; LIC007 request/registration is committed10d09f7 and primary-Lease response is committed14ddebf; control-only dispatch is committedbc7aecb. Atomic Lease+Control composition is committed e88d0ca and limited independent review is complete under LIC-EV-0074 (28/28 independent probes and aggregate pass); review committedec2fbf3. Subsequent trust-only CHECK_IN preparation/CAS passes44/44 cases and aggregate/Golden regressions (EV0077); trust-only checkpoint committed6f7b411. Subsequent coordinated trust plus Lease/optional Control handoff passes44/44 cases and aggregate/Golden regressions (EV0080); independent review of committed53a7d74 passes28/28 (26 acceptance checks plus2 clock diagnostics), with no blocking portable finding. Failed clock/trust evaluation must block future runtime admission; Hybrid Reactivation request targeting and three-artifact completion now pass48/48 both-Edition cases and all aggregate/Golden regressions under EV0087. The new Entitlement stays a separate signed input because the frozen response carrier has no Entitlement slot. Mixed trust/Control variants and TIME_RECOVERY stay closed; targeted review of the new core helper and transport/runtime/protected Store integration remain open. Failed clock/trust evaluation still must block future runtime admission. LIC008 Windows feasibility remains in progress: EV0126/0130/0132/0135 record Software-KSP host controls, filtered-admin interactive contrast, normal reboot and binary Repair simulation. CHG0067/EV0136 selects the bounded Upgrade plan, implementation/build/run NOT_RUN. Real file/protected Store, TPM, separate standard account and full Windows acceptance remain outstanding under existing dependencies. Persistent storage, runtime admission, Guardian and Windows release evidence remain open.

Decision date: 2026-08-26

Last reviewed: 2026-09-05

LIC004 closure: LIC-6.2-004 pure state model is complete under LIC-EV-0016 after independent review and Reactivation collision remediation: 59/59 projection, 31/31 model, 27/27 security tests (18 owned STATE descriptors), plus Core/Protocol/Golden regression. LIC-6.2-005 portable trusted-time remediation is complete under LIC-EV-0026 after Product approvals LIC-CHG-0016/0017 and independent time_design_review remediation/rerun: Time 39/39, lifecycle 36/36, availability/repair 16/16, State 117/117 and Core/Protocol/Golden pass. Observed calendar is separate from the corroborated floor; future grants require corroboration, normal reboot/downtime alone does not lock, and signed repair preserves independent locks. LIC005 closure is committed as e49630a. LIC006 Offline workflows remain in progress: bounded import planning is committed as 7435dc8 (38/38). ACTIVATE/RENEW request work is committed as 67f9867 (LIC-EV-0030, 44/44). Entitlement completion/CAS acknowledgement passes36/36 under LIC-EV-0033 (import38/request44 and Core/State/Time/Protocol/Golden pass), with the fixed duplicate-request correlation failure retained in EV0032. Entitlement/Control checkpoint is committed as6c9fb09. RECOVER request/completion is committed as97a6d02 (LIC-EV-0038,36/36). REBIND is committed as91b4771 (LIC-EV-0041,40/40). TIME_CORRECT is committed as9703e13 (LIC-EV-0043,32/32). REACTIVATE request/two-artifact completion passes28/28 under LIC-EV-0045 (committed as c975958), with prior portable/crypto gates passing; real protected persistence, safe filesystem intake/export, durable reconciliation and independent closure review remain open; EV0047 records the remaining-obligations source audit and ten planned (not executed) safe-file/durable-adapter acceptance cases; portable selected-file orchestration passes16/16 fake-adapter cases under LIC-EV-0049 (committed as c975958), with prior portable/crypto gates passing; one-pass file-to-completion integration passes the expanded32-case file suite under LIC-EV-0051 (committed as c975958), with prior portable/crypto regressions passing; LIC-EV-0054 adds96/96 six-intent file completion cases (committed as c97eb29) with all prior portable/crypto regressions passing; LIC-EV-0055 completes independent review of c97eb29 with no reproducible blocking finding,8/8 additional probes and aggregate rerun passing; see LICENSING_OFFLINE_REVIEW.md; LIC007 request/registration is committed10d09f7 and primary-Lease response is committed14ddebf; control-only dispatch is committedbc7aecb. Atomic Lease+Control composition is committed e88d0ca and limited independent review is complete under LIC-EV-0074 (28/28 independent probes and aggregate pass); review committedec2fbf3. Subsequent trust-only CHECK_IN preparation/CAS passes44/44 cases and aggregate/Golden regressions (EV0077); trust-only checkpoint committed6f7b411. Subsequent coordinated trust plus Lease/optional Control handoff passes44/44 cases and aggregate/Golden regressions (EV0080); independent review of committed53a7d74 passes28/28 (26 acceptance checks plus2 clock diagnostics), with no blocking portable finding. Failed clock/trust evaluation must block future runtime admission; Hybrid Reactivation request targeting and three-artifact completion now pass48/48 both-Edition cases and all aggregate/Golden regressions under EV0087. The new Entitlement stays a separate signed input because the frozen response carrier has no Entitlement slot. Mixed trust/Control variants and TIME_RECOVERY stay closed; targeted review of the new core helper and transport/runtime/protected Store integration remain open. Failed clock/trust evaluation still must block future runtime admission. LIC008 Windows feasibility remains in progress: EV0126/0130/0132/0135 record Software-KSP host controls, filtered-admin interactive contrast, normal reboot and binary Repair simulation. CHG0067/EV0136 selects the bounded Upgrade plan, implementation/build/run NOT_RUN. Real file/protected Store, TPM, separate standard account and full Windows acceptance remain outstanding under existing dependencies. Persistent storage, runtime admission, Guardian and Windows release evidence remain open.

Status: Accepted baseline for Phase 6.1–6.6; Phase 6.1 build identity/artifact gate and `LIC-6.2-001` protocol freeze passed; `LIC-6.2-002` Golden Vectors and `LIC-6.2-003` portable preflight-core verification passed; the remaining Phase 6.2–6.6 gates stay open

Scope: single-machine, offline-first Windows installation for both `FULL` and `ATTENDANCE` artifacts from one source tree.

## 1. Supported platform

- The exact authoritative target list and test obligations are in [WINDOWS_SUPPORT_MATRIX.md](WINDOWS_SUPPORT_MATRIX.md).
- Release architecture is Windows x64 only.
- Serviced Windows 11 x64 Home, Pro and Enterprise releases are supported production targets after their exact clean-machine rows pass.
- Windows 10 x64 build14393 (1607)+ and Windows 11 x64 build22000+ are technical targets across install-capable client editions. Microsoft servicing date is advisory, not a Setup rejection, but each exact build still needs product/runtime/K40 matrix evidence.
- Windows 10 before build14393, Windows 7/8/8.1, every 32-bit Windows installation, Arm/Arm64 Windows, Windows Server, Insider/Preview and S mode are explicitly unsupported; Setup must fail before mutation with a clear architecture/OS/edition message.
- Clean-machine acceptance must include every positive and negative row in the support matrix, with at least two independent physical computers across positive rows. Repeated runs or cloned VMs on one development computer are not fleet evidence.
- A separate 32-bit build will not be produced. Node.js 24 has no official Windows x86 binary, current PostgreSQL Windows distributions do not provide a supported x86 package, and carrying an older runtime would create a second security and regression lifecycle for very uncommon hardware.
- A 64-bit Windows machine runs the x64 product directly; whether Windows is Home, Pro or Enterprise does not change the application binary.
- The application remains usable without Internet after installation while a valid `OFFLINE_BOUND` entitlement or `HYBRID_LEASED` offline allowance is active. Internet is not intrinsically required for login, attendance, device polling, reports, backup, restore verification or startup.

## 2. Build and runtime versions

The release manifest and build pipeline must pin exact versions and SHA-256 hashes. Version ranges, `latest`, PATH discovery, and network downloads during customer installation are forbidden.

| Component | Pinned baseline | Decision |
| --- | --- | --- |
| Installer compiler | NSIS `3.11` | Build one offline, elevated, signed x64 Setup executable. NSIS is free for commercial use under its documented licenses. |
| Application runtime | Node.js `24.19.0` x64 LTS | Source/build compatibility passed in Phase 6.1 using a temporary `npx` runtime while the host global Node remained `22.19.0`. Bundling and verifying the official private Windows runtime remains Phase 6.4/6.6; do not install Node globally or modify PATH on customer machines. |
| Service hosts | .NET `10.0.11` LTS, self-contained `win-x64` | Build two owned, separately identified Windows Worker services: a License Guardian and an App Host that supervises the bundled Node backend. The customer machine must not need a separately installed .NET runtime. Do not use WinSW, NSSM, or `node-windows`. |
| Database | PostgreSQL `17.11` x64 binaries | Bundle a private PostgreSQL 17 runtime including `initdb`, `psql`, `pg_dump`, `pg_restore`, `createdb`, and `dropdb`; do not depend on PATH or an unrelated machine-wide PostgreSQL installation. |

Patch updates within the pinned Node 24, .NET 10 and PostgreSQL 17 lines require the same regression and clean-machine gates. A PostgreSQL major upgrade is a separate migration project; it must never occur silently inside a normal application update.

## 3. Installer technology and artifact policy

- NSIS `3.11` produces separate build-selected Setup files for `FULL` and `ATTENDANCE`; each contains exactly one Edition artifact and the shared approved runtimes.
- Setup requires Administrator elevation because it installs services and protected Program Files/ProgramData paths.
- Administrator elevation is not treated as `SYSTEM`. For bootstrap and every Upgrade migration, NSIS starts a manifest-pinned one-shot `EntryControlSystem.Setup` service under `LocalSystem`; only that helper can read `installer.secrets`, and no credential is returned to the NSIS process.
- Production artifacts must be Authenticode-signed and accompanied by a SHA-256 checksum and the root `version.json`. Current Phase 6.1 FULL/ATTENDANCE outputs are explicitly unsigned development artifacts: their manifests prove deterministic content/integrity when checked against a trusted copy, not publisher authenticity, and cannot pass the Pilot gate.
- The Phase 6.1 launcher rejects output-affecting parent `NODE_*` controls and disables child compile caches. Because Node may consume instrumentation variables before JavaScript begins, the official build/CI launcher must start with a clean Node-control environment; this development gate is not a substitute for the signed Phase 6.4 host/build trust boundary.
- Setup is fully offline: every runtime and migration required for install, repair, upgrade and uninstall is already inside the signed artifact.
- No automatic updater exists in v1. Updates are manually supplied signed Setup packages on a single `stable` channel.
- Downgrade is rejected by default. Vendor recovery may override it only with a verified backup and an explicit recovery workflow.
- A third-party notices file must ship with the product and record the exact licenses/hashes of NSIS, Node.js, .NET, PostgreSQL and bundled fonts/assets.

## 4. Windows services and recovery

Stable service IDs do not change with branding or Edition:

| Service | Purpose | Startup |
| --- | --- | --- |
| `EntryControlSystem.Database` | Private PostgreSQL 17 cluster | Automatic delayed start |
| `EntryControlSystem.License` | Signed License Guardian owning CNG/TPM identity, Secure State, official loopback proxy and minimal recovery helper | Automatic delayed start; no database dependency for License verification |
| `EntryControlSystem.App` | Separate App Host supervising the Node backend | Automatic delayed start; depends on `EntryControlSystem.Database` and `EntryControlSystem.License` |

- `EntryControlSystem.Setup` is not a persistent product service. It is an Authenticode/manifest-verified one-shot `LocalSystem` helper created only by signed Setup/Upgrade, refuses a non-`LocalSystem` service token, accepts a fixed version/Edition-bound plan over a challenge-bound ACLed pipe (never an arbitrary command/path), writes redacted logs and returns no secret. It self-terminates on a bounded TTL and is stopped/deleted on success or failure; the next signed Setup may reconcile only an exact manifest-matching stopped orphan before continuing. App/Node cannot use it under their tokens.
- The Guardian runs under `NT SERVICE\EntryControlSystem.License`. The App Host and Node run under the separate `NT SERVICE\EntryControlSystem.App`; neither account has interactive logon or administrator membership.
- Only the Guardian SID can open the installation CNG/TPM keys and authoritative License State. App/Node receive a short-lived capability bound to the authenticated pipe peer token, process handle/creation identity, build, state generation, boot nonce and expiry over a narrowly ACLed named pipe; PID alone is never trusted, and App/Node cannot read or modify those files/keys directly.
- The Guardian owns `127.0.0.1:41820` and reverse-proxies to the verified App/Node private endpoint. A manually launched Node process cannot become the official product endpoint without the Guardian handshake.
- PostgreSQL runs under the virtual account `NT SERVICE\EntryControlSystem.Database`, with access limited to its data/log directory. A broad shared `NetworkService` file grant is not used.
- The App Host sends a graceful stop to Node, waits up to 30 seconds, then terminates the child process tree and reports a failed stop.
- If Node integrity fails, the Guardian does not launch it; the independently signed minimal helper can create/verify an Emergency Backup before signed repair and cannot Restore or run business operations.
- SCM recovery restarts each Guardian/App service after 5 seconds, then 30 seconds, then 60 seconds; each failure counter resets after one day. Repeated failure remains stopped and visible in Event Log rather than looping forever.
- Loss of Guardian heartbeat/pipe makes the App Host immediately stop admitting new operations and stop its Node process tree within the bounded shutdown window. App resumes only after a new Guardian handshake/capability; Guardian can keep the minimal restricted/recovery surface available while App restarts.
- The application is healthy only after database connectivity, migration state, Edition/version identity and HTTP liveness pass. A non-operational License still starts the verified restricted HTTP/recovery surface and must not cause an SCM restart loop. Full operational readiness additionally requires a valid License admission state.

## 5. Filesystem layout and ACL

Immutable binaries live under:

```text
%ProgramFiles%\EntryControlSystem\
  app\
  service\
  runtime\node\
  runtime\postgresql\
  migrations\
  third-party-licenses\
```

Mutable machine data live outside the binaries under:

```text
%ProgramData%\EntryControlSystem\
  config\runtime.env
  config\app.secrets
  config\guardian.secrets
  config\installer.secrets
  logs\app\
  logs\installer\
  backups\
  postgres\data\
  postgres\logs\
  state\licensing\
  restore\
```

- Edition, timezone, attendance policy, auto-checkout policy, ports and tool paths stay in the ACL-protected external `runtime.env`; it contains no database password, and these values never move into the restored database.
- `%ProgramFiles%\EntryControlSystem` grants write access only to `SYSTEM` and Administrators; ordinary users receive read/execute only.
- `%ProgramData%\EntryControlSystem` disables broad inherited write access. `SYSTEM` and Administrators control the installation, but `state\licensing` has its own protected DACL with normal access only for `SYSTEM` and `NT SERVICE\EntryControlSystem.License`. A local Administrator can still take ownership, which is an explicit threat-model limit.
- `NT SERVICE\EntryControlSystem.License` receives its CNG-key rights, modify access to `state\licensing` and the external License journal, read access only to `runtime.env` plus `guardian.secrets`, and the backup access required by its Emergency Backup helper. `guardian.secrets` contains distinct transition and read-only Backup database credentials and is never readable by App/Node.
- `NT SERVICE\EntryControlSystem.App` receives read access to `runtime.env` plus only `app.secrets`, and modify access only to app logs, approved backups and restore workspaces; it receives no direct License State/key, Guardian credential or migration credential access. `app.secrets` contains only the ordinary non-superuser application database credential.
- `NT SERVICE\EntryControlSystem.Database` receives modify access only to `postgres\data` and `postgres\logs`.
- `installer.secrets` contains the separate bootstrap/migration credential and is readable only by `SYSTEM` through the temporary signed `EntryControlSystem.Setup` service. The elevated NSIS process, Guardian, App and Node never receive it; Upgrade rotates or reuses it only inside that helper.
- Ordinary interactive users receive no direct access to secrets, database files or restore workspaces. Authorized operations happen through the authenticated application API.
- An operator-selected external backup folder receives explicit narrow Modify grants for `NT SERVICE\EntryControlSystem.App` and `NT SERVICE\EntryControlSystem.License`; neither service receives broad access to an entire drive or network share. The elevated recovery CLI has no separate file ACL: it authorizes a one-time IPC request and the Guardian performs `pg_dump`/verify under the Guardian SID.
- Every generated application, Guardian-transition, Guardian-backup and bootstrap/migration database credential is independently random, never printed to Installer/Application logs and stored only in its purpose-specific secret file with the ACL above. No long-running App/Guardian/customer-facing process receives the PostgreSQL cluster-superuser credential.

## 6. Ports, same-origin, firewall and TLS

| Endpoint | Binding | Policy |
| --- | --- | --- |
| Web application/API/WebSocket | `127.0.0.1:41820` | License Guardian owns the official origin and proxies only to its verified private App/Node endpoint. |
| Private PostgreSQL | `127.0.0.1:55432` | SCRAM authentication; never exposed to LAN. |
| K40 Pull | Outbound TCP to device port `4370` | No inbound Windows firewall rule is required. |

- Setup preflights both local ports and fails with a clear diagnostic if they are occupied; it never silently selects another port.
- No inbound firewall rule is created for the v1 single-machine installation.
- Production CORS does not allow Vite development origins. The browser uses `http://127.0.0.1:41820`, and Client/API/WebSocket share that origin.
- TLS is intentionally not configured for loopback-only v1. Exposing the product to LAN, using remote browsers, or enabling Push device endpoints is a Scope Change requiring HTTPS certificates, explicit firewall rules, trusted-host/CORS review and a new security gate.

## 7. Install, upgrade and uninstall policy

Fresh install order:

1. Verify the signed package, architecture, free space and port availability.
2. Install immutable binaries, create protected ProgramData directories and start the temporary signed `EntryControlSystem.Setup` helper under `LocalSystem`; NSIS retains no secret.
3. Through that fixed helper plan, register the stopped Database service/virtual SID, initialize the private PostgreSQL cluster in its final protected directory and apply the exact Database-SID data/log ACLs.
4. The helper generates the independent purpose-scoped database credentials plus ACL-protected public runtime config and secret files described in section 5.
5. The helper starts the Database service, waits for exact loopback readiness, then creates the dedicated application, migration, Guardian-transition and Guardian-backup roles plus the application database. A failed readiness or bootstrap stops setup and rolls back only the newly created installation state.
6. The helper runs Prisma migrations once while PostgreSQL is running.
7. Install the License Guardian and App services with their separate identities/dependencies, then stop/delete the temporary Setup service after its completion record is sealed. Failure cleanup also removes the helper without exposing or deleting preserved customer data.
8. Start the Guardian first and then App; the Guardian creates/loads the installation identity and serves the verified restricted activation/recovery surface while App/Node remain License-gated.
9. Wait for liveness/identity, create Start Menu/Desktop shortcuts and open the local activation UI. Ordinary Owner setup unlocks only after the selected finite License mode is operational.

Upgrade order:

1. Reject downgrade and Edition mismatch.
2. Create and verify a full backup before changing binaries or schema.
3. Stop `EntryControlSystem.App` first, then stop `EntryControlSystem.License`; keep the database available for the guarded migration step.
4. Stage versioned App/Guardian binaries and signed manifests, then create the one-shot `EntryControlSystem.Setup` helper. It alone reads the migration credential, runs the fixed guarded migration plan and atomically activates the complete version set while both persistent services remain stopped; NSIS then stops/deletes it.
5. Start/verify the Guardian first, then start the App service and require health, version, Edition and License-state continuity checks. An expired/locked License may remain restricted; an update must not silently clear or extend it.
6. If activation fails before a schema change, remove the Setup helper and restore the prior binaries. Never automatically reverse a completed database migration; use forward repair or the explicit Vendor Restore workflow.

Uninstall removes services, shortcuts and immutable binaries. It preserves `config`, PostgreSQL data, logs, backups and the installation identity/Secure License State by default. Destructive data removal is a separate explicit action with typed confirmation and a final verified-backup warning; silent uninstall can never delete customer data or reset a License incident.

## 8. Product licensing decision

Application Licensing is explicitly `[IN]` for v1 in both Editions. The accepted [Licensing Security and Operations Design](../licensing/design/LICENSING_DESIGN.md) is normative for the threat model, Offline/Hybrid protocol, Vendor key separation, Windows CNG/TPM binding, external Secure State, expiry/grace, online suspension/revocation, tamper quarantine, restricted runtime, Emergency Backup and signed recovery.

Required product behavior:

- Every License is finite; the Vendor selects an exact daily, weekly, monthly, annual or custom validity interval. There is no perpetual mode.
- `OFFLINE_BOUND` supports request/response activation and renewal with no Internet dependency.
- `HYBRID_LEASED` supports outbound remote activation, renewal, suspension and revocation with an explicit signed offline allowance.
- Immediate remote disable is not promised for a disconnected machine; it becomes effective on the next authenticated check-in or at the end of the last signed allowance.
- The authoritative License, clock/high-water anchors, monotonic revisions and tamper latch remain outside PostgreSQL and outside customer Backup/Restore.
- A non-operational License starts a restricted, recoverable service. It blocks business APIs, K40 polling/commands, business jobs, WebSocket and physical actuation while preserving Login, safe License operations, minimal diagnostics, scheduled data protection and a narrow authorized Emergency Backup path.
- Suspect artifacts are quarantined and audited; customer data and diagnostic evidence are never deleted as punishment.
- The separately identified .NET License Guardian owns CNG/TPM identity, Secure State, official loopback proxy and immutable-manifest checks; the App Host/Node have no direct State/key access and independently enforce runtime/API gates; Client is presentation only.
- No partial License implementation may enter a production Installer or Pilot artifact.
- `LIC-6.2-001` freezes the source-only [protocol v1 package](../../licensing/protocol/v1/README.md): 10 signed CDDL schemas, 3 non-authoritative carrier schemas, exact registry/negative corpus and closed manifest. This package contains no License key, signed token, issuer, verifier or runtime admission and must not be presented as an operational Licensing subsystem.
- `LIC-6.2-002` closes the non-production [protocol v1 Golden Vector package](../../licensing/vectors/v1/README.md). The approved `LIC-CHG-0011` erratum retains 105 generated artifacts, 18 test-only public keys, 35 signed + 6 carrier positives, 42 binary negatives and 90 cross-types. The malformed join is `744 = 42 binary + 702 descriptor-only`; 676 descriptors belong to Core and 26 remain later state/time/replay work. Node `24.19.0` and .NET SDK `10.0.400` emitted identical 173-record reports. Current vector/protocol/index/report pins are `565a5efca1a1767a622a0d751a5937633018587f7cc463ce3e531ed9656fb99e`, `512534732dce759da424ba0e8d8838c3d9c294e3faa02a4017212ce482523eab`, `b3c1a80cfdbbc80ffcb20403f9bd07419ff9f71bfe461a1b3c3ddb1d7dcbd597` and `ed196d8f03b9f1b2285245592d61967f3293b290b18cdb4c32405408a48b1e5c`. Windows path/ADS/namespace/no-overwrite guards and test-key isolation checks pass. Historical pins remain in `LIC-EV-0010`; `LIC-EV-0013` records the new verification.

## 9. Acceptance consequences

- Phase 6.1 completed root `version.json`, Node 24 source/build compatibility and separate deterministic `build:full` / `build:attendance` development artifacts. Reproducibility was measured from fresh output directories against the same installed dependency tree; physical Server-module isolation and supply-chain/signature trust are not claimed here.
- Phase 6.2 has completed LIC001 through LIC005. LIC-6.2-004 pure state model is complete under LIC-EV-0016 after independent review and Reactivation collision remediation: 59/59 projection, 31/31 model, 27/27 security tests (18 owned STATE descriptors), plus Core/Protocol/Golden regression. LIC-6.2-005 portable trusted-time remediation is complete under LIC-EV-0026 after Product approvals LIC-CHG-0016/0017 and independent time_design_review remediation/rerun: Time 39/39, lifecycle 36/36, availability/repair 16/16, State 117/117 and Core/Protocol/Golden pass. Observed calendar is separate from the corroborated floor; future grants require corroboration, normal reboot/downtime alone does not lock, and signed repair preserves independent locks. LIC005 closure is committed as e49630a. LIC006 Offline workflows remain in progress: bounded import planning is committed as 7435dc8 (38/38). ACTIVATE/RENEW request work is committed as 67f9867 (LIC-EV-0030, 44/44). Entitlement completion/CAS acknowledgement passes36/36 under LIC-EV-0033 (import38/request44 and Core/State/Time/Protocol/Golden pass), with the fixed duplicate-request correlation failure retained in EV0032. Entitlement/Control checkpoint is committed as6c9fb09. RECOVER request/completion is committed as97a6d02 (LIC-EV-0038,36/36). REBIND is committed as91b4771 (LIC-EV-0041,40/40). TIME_CORRECT is committed as9703e13 (LIC-EV-0043,32/32). REACTIVATE request/two-artifact completion passes28/28 under LIC-EV-0045 (committed as c975958), with prior portable/crypto gates passing; real protected persistence, safe filesystem intake/export, durable reconciliation and independent closure review remain open; EV0047 records the remaining-obligations source audit and ten planned (not executed) safe-file/durable-adapter acceptance cases; portable selected-file orchestration passes16/16 fake-adapter cases under LIC-EV-0049 (committed as c975958), with prior portable/crypto gates passing; one-pass file-to-completion integration passes the expanded32-case file suite under LIC-EV-0051 (committed as c975958), with prior portable/crypto regressions passing; LIC-EV-0054 adds96/96 six-intent file completion cases (committed as c97eb29) with all prior portable/crypto regressions passing; LIC-EV-0055 completes independent review of c97eb29 with no reproducible blocking finding,8/8 additional probes and aggregate rerun passing; see LICENSING_OFFLINE_REVIEW.md; LIC007 request/registration is committed10d09f7 and primary-Lease response is committed14ddebf; control-only dispatch is committedbc7aecb. Atomic Lease+Control composition is committed e88d0ca and limited independent review is complete under LIC-EV-0074 (28/28 independent probes and aggregate pass); review committedec2fbf3. Subsequent trust-only CHECK_IN preparation/CAS passes44/44 cases and aggregate/Golden regressions (EV0077); trust-only checkpoint committed6f7b411. Subsequent coordinated trust plus Lease/optional Control handoff passes44/44 cases and aggregate/Golden regressions (EV0080); independent review of committed53a7d74 passes28/28 (26 acceptance checks plus2 clock diagnostics), with no blocking portable finding. Failed clock/trust evaluation must block future runtime admission; Hybrid Reactivation request targeting and three-artifact completion now pass48/48 both-Edition cases and all aggregate/Golden regressions under EV0087. The new Entitlement stays a separate signed input because the frozen response carrier has no Entitlement slot. Mixed trust/Control variants and TIME_RECOVERY stay closed; targeted review of the new core helper and transport/runtime/protected Store integration remain open. Failed clock/trust evaluation still must block future runtime admission. LIC008 Windows feasibility remains in progress: EV0126/0130/0132/0135 record Software-KSP host controls, filtered-admin interactive contrast, normal reboot and binary Repair simulation. CHG0067/EV0136 selects the bounded Upgrade plan, implementation/build/run NOT_RUN. Real file/protected Store, TPM, separate standard account and full Windows acceptance remain outstanding under existing dependencies. Persistent storage, runtime admission, Guardian and Windows release evidence remain open.
- Phase 6.3 owns bundle/chunk/branding/language scanning and proves that issuer/private-key material is absent from customer artifacts.
- Phase 6.4 owns the separate .NET Guardian/App services, one-shot LocalSystem Setup helper and NSIS installer, including proxy/named-pipe License enforcement, purpose-scoped secret handoff, elevated recovery CLI with Guardian-executed Emergency Backup and integrity/repair behavior.
- Phase 6.5 owns private PostgreSQL initialization, migration, ProgramData paths and exact Service-SID ACL enforcement for config, License state, logs and Backup.
- Phase 6.6 closes the cumulative Licensing Release Gate and owns every positive and negative row in [WINDOWS_SUPPORT_MATRIX.md](WINDOWS_SUPPORT_MATRIX.md), including clean-install/reboot/upgrade/offline/K40/Backup/License/repair/uninstall and pre-mutation rejection evidence.

## Primary references

- [NSIS 3.11 manual and licensing](https://nsis.sourceforge.io/Docs/)
- [Node.js release policy](https://nodejs.org/en/about/previous-releases)
- [Node.js 24 archive](https://nodejs.org/en/download/archive/v24)
- [.NET support policy](https://dotnet.microsoft.com/en-us/platform/support/policy)
- [Microsoft Windows Worker Service guidance](https://learn.microsoft.com/en-us/dotnet/core/extensions/windows-service)
- [PostgreSQL Windows distribution guidance](https://www.postgresql.org/download/windows/)
- [PostgreSQL versioning policy](https://www.postgresql.org/support/versioning/)
- [Windows v1 support and acceptance matrix](WINDOWS_SUPPORT_MATRIX.md)
- [LIC008 Software-KSP wrapping-key design](../licensing/design/LICENSING_SOFTWARE_KSP_WRAPPING_DESIGN.md)
