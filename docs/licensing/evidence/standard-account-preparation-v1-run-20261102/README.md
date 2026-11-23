# Disabled standard-account preparation completed - 2026-11-02

[Exact operation contract](../../plans/LICENSING_LIC008_STANDARD_ACCOUNT_PREPARATION.md) / [W03 design](../../plans/LICENSING_LIC008_STANDARD_USER_CONTROL.md) / [Construction](../standard-account-preparation-v1-20261102/README.md)

Source baseline `33f3e92`. Attempt
`838384fa60a04a3385a8d83e18342cd7` is CONSUMED. Source/build/artifact
review, elevated CheckOnly/Prepare and exact-input/launcher review passed.
The owner entered the full live CONFIRM and chose a password through the local
SecureString prompt. No password was sent in chat or stored in these records.
The account-only operation completed; do not repeat it, edit its input or adopt
another existing identity by name.

## Actual account and custody result

| Binding | Observed value |
| --- | --- |
| Account | EcsLic008W03V1 |
| Exact owned SID | S-1-5-21-3058020570-171625005-1532683838-1023 |
| Principal origin | Local |
| Enabled | false |
| Complete local membership enumeration | true |
| Local memberships | Users, S-1-5-32-545 only |
| Protected root | C:\ProgramData\Ecs.Lic008.StandardUserAccountV1 |
| Result status | DISABLED_ACCOUNT_PREPARATION_COMPLETE |
| Account/token logon or crypto comparison | NOT_RUN |
| Standard-user/security/production acceptance flags | false |

Durable plan -> create intent -> owned acknowledgement -> complete -> result
all bind the same attempt, plan hash and exact SID. The owned acknowledgement
preceded any Users membership addition. The complete/result records and later
independent read-only collection agree on disabled/Local/Users-only state.
No service or CNG/TPM operation or existing-account mutation is in this helper.
Existing Guardian remains on its original path/account, Stopped/Manual/PID0.

| Event | UTC on November2 |
| --- | --- |
| CheckOnly | 11:35:55.4076013 to11:35:58.0880862 |
| Prepare | 11:36:29.7280688 to11:36:32.3699839 |
| Plan issue / expiry | 11:36:32.1756574 /13:36:32.1756574; now consumed |
| Owner Execute capture | 13:10:55.9457630 to13:11:37.4964827; console PID14276 |
| Exact-SID read-only collection | 13:17:35.0258888 to13:17:38.8789828; collector PID276 |

All recorded creation/journal/completion times are within the reviewed plan
window. The later collector did not create/change an account or read a password.
It imported only pinned read-only helpers, validated the protected SYSTEM/Admin
root and regular single-link/final-path file handles, and copied the five fixed
original JSON files (2,963 bytes) without reserialization. The raw protected plan
matches the issued plan. This archive adds the three owner capture records and
collection index: nine exact JSON files total, with Git newline conversion disabled.

Independent post-run review PASS:74 read-only file/AST assertions reconcile raw
bytes, chain, SID/state/membership, chronology, source/collector and scope limits.
This is automated scoped review, not human Security or W03 crypto acceptance.

Collector SHA256:
`3ef19d46df154dc5c5b1b8d6267a447b658cfa832fdfafc3c5ae4818091e6005`.

Reviewed Execute launcher SHA256:
`961a5c88d15589a05285b6f7893e3005f92e3775e199360bf10539e0755f7f36`.

Original capture: `out/lic008-standard-account-v1-owner-check-85fa0489ce4e4b249e14571bd78d0c55`.

| Original record | SHA256 |
| --- | --- |
| [plan.json](plan.json) | `ee493a1c4e69779d84bed2965bc80eeacae8d9c7e812a814e06fadfabce04b8b` |
| [create-intent.json](create-intent.json) | `e8754fe5d2347e035ba583a96c0034561b847040cd11bc66d0c8efa7d89770e2` |
| [account-owned.json](account-owned.json) | `7b18035b8faa2fdc21f43e5ef88a66fdbd872d3a9f070f2d9069f5f2675d2305` |
| [account-preparation-complete.json](account-preparation-complete.json) | `4e4878a24f5b4d99a585aba865af730958286a9cf8e088e346c0b8b6e7d8ad6b` |
| [result.json](result.json) | `9c83c9900c531318d3e379468665138843d7ba7926d4a0075422f620436204dd` |
| [CheckOnly-result.json](CheckOnly-result.json) | `0f6e223a31034879ab61edf34f8350cb5c80d41fa95e399f84c6d0ba44d8ec27` |
| [Prepare-result.json](Prepare-result.json) | `581b4eda2c7dd0e1d00b4e367f31a29022bfb289dbba412ef9128485fe1268d4` |
| [Execute-result.json](Execute-result.json) | `90769611022bdef3efd5b573c3fcdbbb6a0576a42db9dd6cb0e03221d64f7017` |
| [collection-index.json](collection-index.json) | `379fc2c38220f92d76f11daa37d074ea021d45d4acb411d748fd9ef0fe7f6bb8` |

## Next operation and phase boundary

Keep the account disabled, ownership root and password private; no automatic
activation, logon, password reset, account/profile/key removal or retry. W03
crypto runner remains unimplemented. Its later operation must bind this exact
SID and ownership record, independently admit the actual standard process token
and held process handles, and compare user-accessible/restricted controls with
Guardian positive controls and rechecks. Activation/logon needs separate exact
reviewed effects and live owner CONFIRM; these account-preparation inputs cannot
authorize it. No filtered-administrator evidence substitutes for that run.

LIC008/Open003, W04/W05, TPM/NV, independent Windows/hardware and security/
production acceptance remain open.
