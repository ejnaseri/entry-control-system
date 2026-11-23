# Adapter physical pilot specification — v0.3 key collision correction

Date: 2026-10-11. CHG0130 / LIC-EV-0199.
ID: ADAPTER-PHYSICAL-PILOT-01 revision0.3.
Status: PLANNING_ONLY / AUTHOR_DRAFT_AWAITING_SCOPED_REVIEW.

Owner agreed to prepare the proposed correction on 2026-10-11. This records that
product direction, NOT adoption of reviewed executable bytes or permission to
create a key/service. No independent review or physical/security acceptance is
claimed. Main/kit/preflight gates remain unchanged and closed.

Read with preserved [specification0.1](LICENSING_ADAPTER_PHYSICAL_PILOT_SPEC.md),
SHA256 `8e50ace849f4f542e096532dda6d45314bb1508f93bb8c83e85728efb5155452`,
and [ownership correction0.2](LICENSING_ADAPTER_PHYSICAL_PILOT_SPEC_V02.md),
SHA256 `f2859ad5a1d3bd5a41f2cec89448ac98ca042585118ecd9b40d08d2bf3916706`.
[Current blocker/evidence](../experiments/LICENSING_PILOT_FOUNDATION.md): EV0198.
Original specification/packet/evidence bytes are preserved, not edited.

## 1. Exact change and unchanged boundary

This proposal supersedes ONLY spec0.1 section2's requirement to prove absence of
the two key names by machine/SILENT opens before any write, and the corresponding
Prepare bootstrap ordering/acceptance statements. All other admission checks,
identities, names, ownership0.2, exact ACLs, policy, stages and cleanup limits stay.

| Before | Proposed replacement |
| --- | --- |
| Before any write, prove both key names absent by controller opens | Before public bootstrap, prove root/three registrations absent; enforce key-name collision at each Setup create-new operation, without overwrite |
| Failed key open might be interpreted as missing | No negative key-open result authorizes creation or proves absence |
| Key absence implicitly known before registrations/files | A key collision can be discovered after public bootstrap or after the first new key; retain partial state and block continuation |

Scope remains TEST_ONLY_SOFTWARE_KSP_ADAPTER_EVIDENCE_V1, exact new experiment,
same root/three services/two keys/ten reports/three separately authorized stages.
No production Guardian, installer, License Store, Auth/IPC, DB/customer changes,
TPM/DPAPI, provider enumeration, new System helper, privilege enablement, token
owner rewrite, ACL repair, overwrite, adoption or automatic cleanup/retry.

## 2. Revised Prepare ordering

1. Validate independent approved host/source/package/kit/plan pins, runtime/x64,
   plain ancestors and elevated controller primary/default-owner context. Require
   exact root and three service registrations absent, including reparse entries;
   denied access/unknown is a refusal before mutation. These guards are unchanged.
2. Do NOT use controller key opens as the key-absence prerequisite. The revised
   bootstrap route must not call old RequireClear and then suppress its failure,
   relabel UNKNOWN as ABSENT or add an override. Existing code stays unchanged
   until the successor and bound packet are reviewed/adopted explicitly.
3. Controller creates only the original public directories/package/Prepare plan/
   admission and registers only the original three Manual own-process services.
   Numeric SID/default-owner/role self-admission and observer coordination remain
   mandatory. Any failure retains already-created state and stops.
4. In the existing Setup-create action, create private directories and, for
   `restricted` then `app-readable`, write that label's new protected intent
   before making one exact-name creation attempt. Intent means ATTEMPT PLANNED,
   not ownership or absence. It cannot authorize deletion or reuse of a key.
5. Use the existing Software KSP RSA creation path with legacy spec0 and only
   MACHINE_KEY (`0x20`) at creation. OVERWRITE (`0x80`) MUST NOT be present. No
   alternate provider/name, user-key fallback, enumeration or name generation on
   collision. Set original RSA3072/export0/decryption-only/protected exact key
   DACL on the successfully returned new handle, never on a preexisting key.
6. Finalize that handle with original SILENT (`0x40`) only; no validation bypass
   or legacy-store copy. Creation success alone is not persisted ownership.
   Require successful finalization, original policy/DACL/public identity checks
   and a new matching private owned record/readback before the next label.
7. Publish public-control only after BOTH label chains fully verify. Continue
   Guardian/publication/App/Child only after successful Setup evidence and actual
   worker/process completion. Full stage validation and checkpoints stay required.

This removes a pre-write absence assertion; it does NOT move key creation into
the controller or allow continuation after a failed native operation.

## 3. Failure, uncertainty and retention

- Existing name/NTE_EXISTS: collision, stop. Do not open/adopt/delete/rename/set
  policy on the existing key, retry with overwrite or change the ExperimentId.
- Any other creation/property/finalization/verification/owned-record failure:
  UNKNOWN or failed action under existing report schema; stop. Do not interpret
  BAD_KEYSET/access denial as permission to continue. Keep earlier files/services/
  keys and intents/owned records. No automatic rollback, late PASS or second-key
  attempt after first-key failure.
- If the first key completed but the second collides/fails, retain the first
  owned key and all partial state. No public-control/stage PASS/Fresh/Finish
  admission. Review is required; this is not a resumable Prepare or cleanup grant.
- Crash/timeout after intent, native success or finalization but before verified
  owned-record persistence: ownership is incomplete/unknown. Intent alone cannot
  authorize cleanup. Await real worker completion, retain evidence, no blind rerun.
- A race after public preflight is handled by native creation/finalization and
  postchecks, not by assuming an earlier probe was atomic. No assertion that all
  Windows/provider race behavior has been proven. Unexpected native behavior
  blocks physical acceptance and requires review, not normalization to PASS.
- Release query/key handles only through the original lifetime rules. Freeing a
  handle is not deleting the key. No deletion added to Prepare failure handling.
  The original Finish delete-only-two-verified-owned-keys rule is unchanged;
  partial Prepare state does not automatically qualify for that Finish.

Keep the closed existing report fields/result IDs and bounded sanitized failure
reporting. A missing/incomplete/error report never becomes accepted evidence.
No extra mutable progress file or report count is authorized by this correction.

## 4. Technical basis and limits

Microsoft documents that omitting OVERWRITE from
[NCryptCreatePersistedKey](https://learn.microsoft.com/en-us/windows/win32/api/ncrypt/nf-ncrypt-ncryptcreatepersistedkey)
returns NTE_EXISTS for an already-existing name. A successfully created handle
still needs [NCryptFinalizeKey](https://learn.microsoft.com/en-us/windows/win32/api/ncrypt/nf-ncrypt-ncryptfinalizekey)
before use. This supports the proposed collision mechanism, not a security proof,
atomic crash guarantee, fleet compatibility result or evidence of an actual run.

Existing KeyOperations.Create already omits OVERWRITE; that source observation
does not close this correction. BootstrapAdmission still refuses unresolved
key absence, controller/dispatch/observer timing/custody are incomplete, and no
new native test ran. EV0198's344 managed cases are historical preflight evidence,
NOT tests or acceptance of this successor protocol.

## 5. Finite review and implementation acceptance

One scoped review should check these six items against exact successor bytes:

1. Replacement is limited to key collision timing; root/service absence/pins
   remain prerequisites and no UNKNOWN override is introduced.
2. Only original Setup attempts the two exact names once, without OVERWRITE;
   no settings are applied to an existing key and no extra helper/permission.
3. Intent/finalization/owned-record sequencing, first/second-key partial failure
   and no automatic cleanup/retry/adoption are explicit and consistent.
4. Existing schema/ten-report budget/worker and observer lifetimes remain valid;
   failure blocks public-control, following roles, checkpoint and later stages.
5. Original ownership0.2/ACL/policy/Finish constraints and source/package/kit/
   archive custody are not weakened. Historical packet remains frozen; a bound
   successor packet is needed, not silent reinterpretation of old reviewed pins.
6. Test/authority claims remain separate: owner direction recorded, review pending,
   implementation NOT_DONE, physical0/5, all LIC008/REM/NE/security gates open.

After review/adoption, planned implementation tests are: reject overwrite flags;
exact two names/order; reject reuse or missing intent; create/finalize/postcheck/
owned-record failures stop; first success/second collision retains state; no
public-control/checkpoint on partial results; raw open errors never mean absence.
No such new tests are claimed now. Future native collision/race/partial-state
checks need separately authorized isolated fixtures; this document does NOT
permit additional keys/services, testing against old experiments or customer
resources, or broadening the physical kit's closed inventory.

Next: scoped consistency review of this successor, explicit adoption/binding
decision, then bounded code integration/negative tests/full built-kit review.
Owner Prepare/Fresh/Finish permissions remain separate. No execution command
is provided and the contract blocker is NOT CLOSED by this author draft.
