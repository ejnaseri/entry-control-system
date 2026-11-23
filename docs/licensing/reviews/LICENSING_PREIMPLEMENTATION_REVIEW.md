# Pre-implementation documentation review — LIC-6.2-008

Date: 2026-09-12. Base: `ad5c209` plus preserved preflight-kit worktree.
Reviewer/implementer: Codex; acceptance reviewer/operator: Project Owner.
This is a documentation and dependency review, not a repeated independent LIC006
code review, a full application test rerun or a release approval.

## Documents and conclusions

| Documents reviewed | Consequence for the next work |
| --- | --- |
| LICENSING_DESIGN; LICENSING_OFFLINE_REVIEW; LICENSING_WINDOWS_SPIKE | LIC003 is complete; LIC008 may proceed. LIC006 remains open; its portable review is complete. LIC-OPEN-003 provider choices and LIC-OPEN-012 integration cycle remain open. |
| PROJECT_CHECKLIST; ATTENDANCE_EDITION_CHECKLIST | Phase 6 remains active, Phase 7 gated. Optional Attendance features, other device families and schema redesign are outside this work. Existing business/test-history checkboxes are not re-certified by reading them. |
| PACKAGING_DECISIONS; security-design | Native baseline .NET 10.0.11 win-x64, SDK 10.0.400; separate virtual service identities, Guardian-only secrets, no shared NetworkService grant. A test harness is not the signed product Guardian/Installer. |
| backup-restore; server/PRISMA_GUIDE; server/docs/domain-model | No migration, database, backup, restore, production License path or customer records are needed. Prisma License is never authority. |
| k40-setup; attendance-audit; inbox; server/docs/devices-api | No device connections, commands, polling, attendance changes or optional Inbox work. Historical API examples are not authorization to execute commands. |
| Root/client README; protocol/v1 README and corpus README; vectors/v1 and dotnet README | Navigation and test packages are not runtime authority. Frozen vectors stay untouched. Root README contains superseded pre-erratum pins/counts; replace duplicated pin prose with authoritative links. Client README is a generic template, not packaging authority. |

The repository Markdown inventory, heading/checkbox counts and pre-change hashes
are retained locally in `out/lic008-docs-before-harness.json`. Review focused on
current requirements, status, dependencies and affected boundaries; historical
test logs were consulted as records, not rerun or reapproved. No AGENTS.md was
found in the repository inventory or the previously checked workspace parents.

## Corrections and scope

The user confirmed both supplied preflight reports were run on the development
computer. The elevated report observes Windows 11 Pro build 22000, x64 and TPM
SpecVersion `1.2, 2, 3`; this is not TPM 2.0 attestation or P-256 feasibility.
The earlier non-elevated report had UNKNOWN TPM. No target-laptop evidence exists.

The next deliverable is an offline, self-contained test harness with fixed test
service names, protected test directories, non-production keys, explicit start /
recheck / cleanup operations and redacted per-case reports. It must not run its
service/key mutations automatically during development verification. The second
laptop is unavailable; native evidence stays NOT RUN until actually executed.

Named implementation owner: Codex. Acceptance reviewer/operator: Project Owner.
Planned cases: LIC008-HARNESS-001 command/identity refusal; 002 isolated setup and
collision refusal; 003 software/TPM P-256 create/reopen/sign/export-policy and ACL;
004 Guardian-SID DPAPI-NG positive and App/child denial; 005 protected-file denial;
006 retained-key recheck; 007 exact-key cleanup and retained reports. Build and
pure guard tests may pass locally without marking any physical case executed.
TPM wrapping, attestation, NV, actual reboot/repair/reinstall, ordinary-user
denial, TPM-less/Windows 10 matrix and LIC-FILE/STORE acceptance remain separate.

After preparing this bounded LIC008 harness, LIC007 has completed portable
dependencies LIC003–005 and can be a subsequent work slice. Preparing this harness
does not itself start or close Hybrid, Guardian or production Store work.

## Native API references

Implementation references (not new product decisions):

- [CNG key properties](https://learn.microsoft.com/en-us/windows/win32/seccng/key-storage-property-identifiers)
- [NCryptSetProperty security descriptor flags](https://learn.microsoft.com/en-us/windows/win32/api/ncrypt/nf-ncrypt-ncryptsetproperty)
- [DPAPI-NG protection descriptors](https://learn.microsoft.com/en-us/windows/win32/api/ncryptprotect/nf-ncryptprotect-ncryptcreateprotectiondescriptor)
- [Windows service dispatcher](https://learn.microsoft.com/en-us/windows/win32/api/winsvc/nf-winsvc-startservicectrldispatcherw)
