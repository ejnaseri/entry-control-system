# Guardian token-only successor diagnostic — 2026-10-15

Latest result: owner returned1066/20024, original path restored; read-only CIM
confirmed stopped/original path and20024. Bits8+16 mean absent matching group
(therefore not enabled), while user/owner/primary checks matched. See the
[tested correction candidate and integration boundary](IDENTITY_CORRECTION.md).
Do not repeat this diagnostic. The execution-pending text below is historical.

Owner output from the first diagnostic: Win32Exit1066, Specific202, original
path restored. Read-only CIM also confirmed stopped service/original path and
202; SID type UNRESTRICTED. Protected journal contents were not independently
read (unelevated access denied). These are scoped observations, not acceptance.

202 maps to stage2/SERVICE_IDENTITY_REFUSED: original code combines user SID
equality, service group enabled and not deny-only. It does not identify which
predicate failed. Owner/type check occurs earlier and did not throw. A missing
group returns attributes0 in the original implementation; this is a hypothesis,
not an observed token fact. No security predicate is relaxed or fixed here.

The separate GuardianTokenDetail.cs only reads token metadata after checking
runtime, original assembly hash and current boot. It never calls original
Capture admission or any key, plan, crypto or protected-directory helpers.
It separately observes user/owner SID equality, primary token, matching service
group count and enabled/deny-only attributes. Thread impersonation is refused.
No SID strings, unrelated groups, secrets or exception messages are emitted.

SCM Specific20000+mask is an OBSERVATION, never PASS/security acceptance:

| Bit | Meaning |
| --- | --- |
| 1 | User differs from expected Guardian SID |
| 2 | Owner differs from expected Guardian SID |
| 4 | Not primary token |
| 8 | Service SID absent from token groups |
| 16 | Matching group not enabled (also set if absent) |
| 32 | Matching group has deny-only attribute |
| 64 | Duplicate matching groups |

Other failure codes retain stage*100+reason. All128 mask combinations and22
exception mappings pass (150 pure tests). These tests do not prove native query
or service lifecycle behavior. Duplicate groups are flagged; do not interpret
their last-entry attributes alone. Specific20000 is no mismatch observed, not
proof the original failure is fixed.

Current boot changed again to b8086f476aeb3be728d83e4921f2011f43b5e87451bb7cf73b03a40184443504.
New candidate: out/lic008-guardian-readonly-11a2b2233af348a7a250ef9c8844de4e.
Manifest SHA256:9827997c2072d5b09953190e4a71a9d91a6d30de64b555b98bf4155f467d14c7.
DLL SHA256:c9b7cd94cb70b7cacf65be721b5e5064177e18cafb49a34a461c84fa5167af2f.
Earlier token candidate5b7654ed is superseded before execution (boot mismatch).

[New runner](../../../scripts/run-license-guardian-token-detail.ps1) uses a NEW
protected C:\ProgramData\Ecs.Lic008.GuardianTokenDetailV1 directory, one start,
same Guardian account, temporary binary path and verified restoration after stop.
Old runner/directory/keys/ACLs/pilot source are not reused or changed. User requested
this next diagnostic step. Agent remains unelevated; physical execution pending.
On error retain everything and inspect; no repeat, forced stop, Prepare or cleanup.
Original Prepare remains PARTIAL/FAILED and full physical cases accepted0/5.
