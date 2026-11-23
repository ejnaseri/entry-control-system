# W03 disabled local account prerequisite

Date: 2026-11-02. Source baseline: `a64a71d`.
Status: `CONSUMED_DISABLED_ACCOUNT_PREPARATION_COMPLETE_CRYPTO_NOT_RUN`.

[W03 design](LICENSING_LIC008_STANDARD_USER_CONTROL.md) /
[Work ledger](LICENSING_LIC008_COMPLETION_PLAN.md) /
[Account-only source](../../../scripts/run-license-standard-user-account.ps1) /
[Pure tests](../../../scripts/test-license-standard-user-account.ps1) /
[Kit builder](../../../scripts/build-license-standard-user-account-kit.ps1)

This operation prepares one disabled local account because the owner currently
has only the administrator account. It does not execute genuine standard-user
isolation. The crypto runner, actual process/token admission, separate activation/
logon, Guardian controls and W03 acceptance remain pending.

## Fixed scope and effects

| Binding | Exact value |
| --- | --- |
| Purpose | `TEST_ONLY_STANDARD_USER_ACCOUNT_PREPARATION_V1` |
| New local user | `EcsLic008W03V1` |
| Description | `LIC008 W03 disabled test account` |
| Root | `C:\ProgramData\Ecs.Lic008.StandardUserAccountV1` |
| Expected owner SID | `S-1-5-21-3058020570-171625005-1532683838-1001` |
| Local machine SID | `S-1-5-21-3058020570-171625005-1532683838` |
| Only explicit local membership | Users, `S-1-5-32-545` |
| Root owner/group | Administrators, `S-1-5-32-544` |
| Protected root DACL | SYSTEM/Admin FullControl, object/container inheritance; no extra ACE |
| Account state at create and completion | DISABLED |

Effects: create the fresh protected ownership/evidence root; create one new
disabled account with password entered only in the local secure prompt; add
only its acknowledged exact SID to Users if needed; verify all local memberships;
retain account/evidence. No existing account/group is adopted, enabled,
disabled, renamed or removed. No service, CNG key, TPM, existing Guardian, logon,
profile cleanup or crypto probe is invoked. Later activation and crypto require
their own reviewed SID-bound plan and live owner CONFIRM. No enable/delete
route exists in this helper.

User AND group name collisions refuse before root consumption. All membership
queries must be readable before creation and at completion. The created SID
must use the fixed machine prefix, RID at least1000 and differ from owner.
Every observation requires exact SID/name, local origin, disabled state and
only Users membership. Missing query/ownership evidence never authorizes adoption.

## Input, custody and failures

Default/malformed entries close before module/account inspection. Explicit
CheckOnly/Prepare require the elevated primary owner, no thread impersonation,
pinned Windows PowerShell5.1.22000.2538 x64, exact script hash, host/boot and fixed
LocalAccounts module file/implementation pins. Prepare writes only a fresh GUID
out directory and canonical plan with exact effects and two-hour UTC lifetime.
Execute requires its reviewed hash and exact input-leaf/attempt equality.
Unknown/duplicate/noncanonical fields or bytes refuse. Source/tools/plan/host/
boot/expiry are rechecked around native stages and after slow queries.

Execute needs the attached visible console, owner-entered full CONFIRM and a
Read-Host -AsSecureString password of1..127 UTF-16 code units. OS password policy
still applies. No password is accepted in chat/arguments/environment, serialized
or logged; SecureString is disposed on exit. No transcript or automatic CONFIRM
is used. Retain the chosen password privately for later separately reviewed logon.

Native CREATE_NEW makes the root atomically with final SYSTEM/Admin protection.
Records use CREATE_NEW and Flush(true): plan -> create intent -> New-LocalUser
Disabled -> validated SID acknowledgement -> owned record -> observed disabled
identity/memberships -> optional Users addition -> observed final state -> complete
record -> result. Verify binding/expiry before create, membership and completion.
Ownership/failure evidence can still be retained after expiry. Failures preserve
root/account/journals without retry, cleanup, adoption or reconstruction. Lost
create acknowledgement can leave an uncertain disabled account; name presence
alone cannot repair provenance. These guards do not preempt a blocked API or
resist an already privileged Administrator. This is a local test prerequisite,
not production account management or publisher-authenticity evidence.

## Verified build

Final kit: `out/lic008-standard-account-v1-kit-79a236e84b094d3eae9fccd459d3619e`.

Kit SHA256: `45de89607d038f4480c93d51e7a02bbd1558ea0050e743f2703b4f5aa111e48e`.

Runner SHA256: `91c5a0fa8891573195f27b020a81cc3633e91ad76537e0e7e1c4dd39d2a28eec`.

160 pure assertions cover SID/disabled identity/membership, typed plan/expiry/
effects, old scopes/newlines/copied-input binding, user/group collisions,
password limits, binary DACL faults, positive protocol order and injected
journal/create/observe/guard/add failures. Eight default/malformed kit routes
refuse. The embedded native helper compiles without method invocation or an
invoking initializer; no account operation or owner preflight runs in the builder.

Independent source/artifact review PASS:28 read-only checks confirm3 current
sources/snapshots,2 payloads,4 tools/aggregate,3 parses, report160 and8 refusals.
Description length, collision/binding/password/expiry guards and fake-observation
issues were fixed before account creation. Earlier bc30/e1e6 kits remain unused
superseded build snapshots. All accountCreated/standardUserTested/security/
production build flags remain false. Elevated CheckOnly/Prepare and exact-input/
launcher review passed, followed by live owner CONFIRM/local password entry.

Native account preparation completed at13:11Z. The exact owned SID ends1023,
Local/disabled/Users-only, confirmed again by13:17Z collection. Attempt
838384fa60a04a3385a8d83e18342cd7 is consumed. Independent post-run review PASS,
74 read-only assertions. [Nine exact original records](../evidence/standard-account-preparation-v1-run-20261102/README.md).
No activation/logon or crypto probe ran. W03 crypto/LIC008/Open003, TPM/NV,
independent Windows and security/production acceptance remain open.

[Exact original construction reports](../evidence/standard-account-preparation-v1-20261102/README.md).
