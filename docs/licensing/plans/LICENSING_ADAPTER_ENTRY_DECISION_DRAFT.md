# Bounded adapter-entry decision — draft v0.4

Date: 2026-10-07. Record: CHG0087 / LIC-EV-0156.
Profile ID: ADAPTER-DEV-SOFTWARE-01. Revision:0.4.
Status: DRAFT_NOT_APPROVED; NE-002 NOT_ACCEPTED; NATIVE-ENTRY NOT_READY.
Author: coordinator Codex. No new test execution or implementation authorization.

Current CHG0092/EV0161,2026-10-08: [corrected contract0.2](LICENSING_ADAPTER_OPERATION_CONTRACT_V02.md)
and [claim index0.2](../evidence/adapter-entry-claim-bindings-v2.json) add explicit
claim/result tuples and lifecycle dependencies, candidate failure evidence/Core/
Audit routing, exact bounded container/deadlines and planned vectors. Decision
accountability/technical preparation are named; physical executors still not
assigned and case placement is PROPOSED, not approved deferral. Prior reviewed
0.3/0.1/0.1 bytes are preserved in commit317d3f7; this revision needs new review.

Current follow-up CHG0088/EV0157: [Product direction confirmed](LICENSING_ADAPTER_PRODUCT_CONFIRMATION.md)
for general Windows10/11 x64 design/staged validation, fail-closed preservation
and role separation. This is NOT exact technical-draft/security approval.
CHG0089/EV0158: [decision owner assigned](LICENSING_ADAPTER_SECURITY_OWNER_ASSIGNMENT.md)
to PROJECT_OWNER_CURRENT_USER with explicit role acceptance. Revision0.2 records
this ownership change only; technical proposals unchanged. Case owners remain
NOT_ASSIGNED; independent technical approval and evidence acceptance pending.

CHG0090/EV0159: revision0.3 adds [operation contract0.1](LICENSING_ADAPTER_OPERATION_CONTRACT.md)
and [exact candidate claim index](../evidence/adapter-entry-claim-bindings-v1.json).
Existing Offline/Hybrid interfaces constrain the proposal; no new Core states,
schema freeze or runtime permission. Missing source/binary/manifest acceptance,
final encoding/bounds and case execution owners remain explicit. Baseline0.2
and EV0155-0158 records committed b1ad38f before this preparation.

## 1. Plain-language decisions for the Project Owner

This proposes a limited development decision, NOT customer deployment or a
finished adapter. Customer target remains Windows10/11 x64; accepting this draft
would not certify every target build. The proposed evidence scope is ONLY the
observed Windows11 Pro21H2 x64 build22000 development host, Microsoft Software
KSP, .NET10/SDK10.0.400/runtime10.0.11 historical test artifacts. FULL/ATTENDANCE
product integration is untested. No TPM, x86, fleet or actual Installer approval.

Before approval, the user must explicitly:

1. Confirm or amend this exact proposed limited development scope, understanding
   that remaining Windows10/11 acceptance stays mandatory before release.
2. Designate a named Windows Security decision owner with authority to accept
   scope/evidence/limitations. Completed for role assignment under EV0158, not
   acceptance of this exact technical draft.
   The non-author adapter reviewer is separate from the author and decision owner.
3. Confirm actual owners for outstanding cases below; role categories alone are
   placeholders, not assignments or signed acceptance records.

Current independent reviewer /root/adapter_security_review performed EV0155
with acceptance withheld; this draft has NOT been submitted for approval.
No external human officer is introduced as a mandatory new requirement.

## 2. Decision boundary and authority

Inputs: [adopted scheduling policy](LICENSING_NATIVE_ENTRY_ADOPTION.md),
[exact v2](LICENSING_NATIVE_ENTRY_AMENDMENT_V2.md),
[candidate evidence](LICENSING_ADAPTER_ENTRY_EVIDENCE_LEDGER.md),
[author assessment](../reviews/LICENSING_ADAPTER_ENTRY_SCOPE_ASSESSMENT.md),
[independent findings](../reviews/LICENSING_ADAPTER_ENTRY_INDEPENDENT_REVIEW.md).
Baseline for existing review: e61172eb99d1eea9c1b18209a084b2053435524e;
EV0155/r97 follow-up is uncommitted when this draft is prepared.

No approval follows from preparing a document. Missing, stale, failed, unknown
or unassigned required evidence denies entry. ADAPTER_ENTRY alone does not
satisfy CORE, CONTRACTS, VENDOR, ARTIFACT or REVIEW. LIC008/Open003/full exits,
STORE001-005, FILE001-005 and WIN-V1-01..05 remain binding. Neither proposed
operations below nor proposed tests authorize changing current machine state.

## 3. Exact proposed adapter profile

| Boundary | Proposed rule | Evidence / unresolved distinction |
| --- | --- | --- |
| Provider/purpose | Exact Microsoft Software Key Storage Provider, machine RSA3072, decryption-only usage and export-policy0; separate from ECDSA signing key | Historical feasibility, not current product-key availability |
| Cryptography | NCrypt OAEP-SHA256 with SILENT flag; random32-byte data key, AES256-GCM nonce12/tag16; no OAEP-SHA1/PKCS1v1.5/DPAPI substitution | Source and harness observations; fresh positive/negative adapter evidence required for changed implementation |
| Ownership | Planned signed one-shot SYSTEM Setup creates once under valid fixed intent; Guardian reopens; App/Node/DB/user cannot access restricted private key | Product signed plan, intent, TTL and actual role identities unimplemented; C_IPC required |
| Restricted DACL | Protected SYSTEM plus exact Guardian service SID, no broad principals; compare exact approved ACE forms/rights, identity and policy on reopen | Test SID != EntryControlSystem.License SID. Masks0x10000000/0xD01F01FF are historical Software-provider representations, not generic allowed masks for other providers |
| A/B controls | Separate explicitly test-only readable key, never production restricted-key grants | Test identities/keys must not enter product bootstrap or deployment |
| Secret handling | Bounded local buffers; zero data key/plaintext on all exits; no plaintext/private key in IPC/log/error/telemetry | Source clearing alone is not memory-forensics assurance; C_AUDIT canary evidence required |
| Assurance | SOFTWARE_BOUND lower assurance; no hostile-admin/full-disk/VM-clone or rollback-proof claim | TPM/NV/provider decisions and anchors remain separate required obligations |

### 3.1 Proposed operations, not permission to execute now

Readiness validation: reopen an existing exact owned key, read back public
identity/provider/policy/DACL, run bounded private self-test only in an authorized
slice. Validation never creates a key or alters ACLs. Self-tests cannot produce
business admission merely because crypto succeeds.

Seal/open primitives: Guardian-internal only, bounded immutable input and typed
expected context from accepted C_TXN/C_GATE authority. No arbitrary decrypt/sign
proxy for App. Any plaintext remains local to the approved transaction; do not
return plaintext License State, unwrapped data key or private handle to App.

Creation: separate signed Setup operation under accepted creation intent only.
Not an implicit recovery action. Repair/upgrade/reinstall preserve exact identity;
no replacement creation on open/decrypt failure. No purge, reset, migration,
uninstall, Restore or anti-rollback bypass authorized by this profile.

Readiness invalidates on provider/key/policy/ACL/identity/context change, fresh
process/boot, uncertain operation or input mutation. Cached PASS cannot grant a
lease or protected access. Reopen/read-back precedes new scoped use; actual boot/
generation/lease coordination must come from accepted C_CLOCK/C_GATE/C_IPC.

### 3.2 Expected context, encoding and replay boundary — ASR-004

Expected context must come from trusted accepted installation/Edition and
transaction authority, NOT fields copied from the supplied envelope or an
untrusted caller. Proposed fields: profile/domain/version, installation ID,
product, Edition, generation, wrapping-key public identity and operation purpose.
Encoding must be deterministic and length-delimited under the eventual accepted
schema; exact bytes/types/limits/vectors are NOT frozen by this prose.

An open operation reconstructs expected authenticated context, rejects supplied
context mismatch and unsupported/duplicate/oversize/truncated fields BEFORE
releasing plaintext. Never trust supplied AAD merely because its tag verifies.
Wrapped-key/nonce/ciphertext/tag lengths and metadata authentication belong to
the final schema. Whole valid envelopes from a different installation/Edition/
generation are rejected against independently established expected context.

Same-context historical replay still needs authoritative generation/hash CAS,
journal/high-water/anchor reconciliation and rollback defenses; GCM does not
provide them. C_TXN and LIC6.5.002 retain those responsibilities. Context contract
and parser vectors are pre-integration blockers, not claimed existing coverage.
Test harness Seal/OpenEnvelope must not be copied unchanged as state authority.

## 4. Proposed fail-closed result contract — ASR-002

The following ADP-F codes are NEW DRAFT adapter diagnostics, NOT executed test
IDs, existing licensing state transitions or a change to the public API. Mapping
to accepted Core states/status/redacted Audit events needs NE-003/C_GATE/C_AUDIT.
No raw exception/code alone proves access denial or authorizes recreation.

| Proposed outcome | Required behavior / recovery boundary |
| --- | --- |
| ADP-F01 KEY_ABSENT_WITH_RETAINED_STATE | Refuse protected operation/admission; request existing RECOVERY_REQUIRED handling through accepted recovery authority. Preserve files; no new key/state/reset |
| ADP-F02 IDENTITY_POLICY_OR_ACL_MISMATCH | Refuse and preserve tamper/policy evidence; no ACL rewrite, alternate key or repair shortcut |
| ADP-F03 PROVIDER_UNAVAILABLE | Refuse, record redacted bounded diagnostic; no provider/DPAPI fallback. A later explicitly bounded read-only readiness retry cannot replay a write or reuse a nonce |
| ADP-F04 UNAUTHORIZED_CALLER_OR_UNPROVED_PROFILE | Refuse before protected operation; unknown platform/provider/peer/build is not presumed supported |
| ADP-F05 MALFORMED_OR_CONTEXT_AUTH_FAILURE | Reject before plaintext delivery; clear temporary buffers, no decrypt output or state mutation |
| ADP-F06 INDETERMINATE_OPERATION_OR_COMMIT | No admission, automatic replay, rollback to old state or claim of success. Preserve transaction/evidence, invoke accepted C_TXN reconciliation before any new operation |
| ADP-F07 RESTART_READBACK_FAILURE | Readiness remains denied; require same owned identity and authenticated current-state reconciliation, never recreate from an OpenKey error |
| ADP-F08 VERIFIED_SUCCESS | Only successful scoped primitive, not license validity/business authority. Requires all caller/context/provider/read-back checks; admission remains C_GATE responsibility |

Absence of an owned record during genuinely fresh installation is a separate
signed Setup intent flow, NOT ADP-F01-triggered creation. NTE_BAD_KEYSET alone
does not distinguish missing key/ACL/provider failures. Historical
OBSERVED_BAD_KEYSET remains unchanged; only exact approved positive/negative
contrast may support a narrowly scoped non-disclosure classification.
Historical FAILED_OR_UNAVAILABLE is not upgraded to this detailed taxonomy.

## 5. Proposed claim-to-evidence index — ASR-001/003

V2 explicitly EXCLUDED as required positive/negative proof. It remains historical
only under [EV0154](../evidence/wrapping-v2-legacy-custody-disposition.md).
AE identifiers below are requirement mappings, not new executed tests. Existing
result/source custody does not establish current executable/source equivalence,
independent physical attestation or sufficiency for a new adapter implementation.

| Claim | Proposed applicable records | Version/host/provenance boundary |
| --- | --- | --- |
| AE-001..005/008/011 creation/read-back/crypto/export/refusal/tamper/cleanup | V4 EV0132+EV0153; V5 EV0135+EV0153; V6 EV0138/0139; V7 EV0142/0143 | One host, test roles; independent technical review EV0155 only. Required row-level result/artifact binding still pending approval |
| AE-007 process/normal reboot continuity | V4 EV0132+EV0153 ONLY for reboot claim | Kit0.11.0, experiment94cfc6789fe94e8aafdd010cb12f9af5;10 listed hashes matched. Not power-loss/auto-start/customer Installer |
| AE-009 controlled missing-key repair refusal | V5 EV0135+EV0153 | Kit0.12.0, experiment91fa20b415734ed0a9b7838c607ee709;12 matched references, negative report88f7b426bdb44597b4ff534c25e6e61e; not complete failure taxonomy |
| AE-010 lifecycle simulations | V6 EV0138/0139 and V7 EV0142/0143 | V6 OLD0.13.0/NEW0.13.1; V7 kit0.14.0 experimente0fe1ec7545845eb94d42883d1949570; operator hash provenance, not actual signed Installer |
| AE-006 interactive contrast, supplementary only | V3 EV0130 | Filtered administrator, not separate standard user; cannot satisfy residual ordinary-user test |
| AE-012..014 Store/TPM/full matrix | NONE accepted | Pending original gates; no gap closed by proposed scope |

Required existing reference pins (original report hashes, not attachment hashes):

| Artifact | SHA256 / binding |
| --- | --- |
| Candidate ledger | 5f6612a8fec22e1ec7c36fbf8c8cdc946b699d957dd51768d1048099047f1266 |
| Adopted amendment v2 | 88dc75f17f85f0a57e05d2a6a9648800637a1b1b3d0611a257c3a0e541fd1444 |
| V4 summary / checkpoint | ae8698b7e6459a3aa1c3fbee17f5c424c679aeb9d7f60f64ce5d4c4e11ee9a6a /7417aae3163e3a35e0103303619844adcda021388c1816f02e8d288f10be62ea |
| V5 summary / checkpoint | 7a90250b5c520db757b27381b6cf995f90ce1486b03446d6314a8954de1734ef /adb4aa66402c671f50d21bbcdca84dc619341ffc5108ea1c7bdcd7fb20a7b1d8 |
| V6 summary / upgrade checkpoint | 7b95d1e086b91de870445b7ed1e84c4f40fe83a6faa9c5e8fe20cf51de221517 /62d79f5a09637a96b0c63ce3d99178ea524d7a416b875a7e52835816deefe779 |
| V7 summary / prepare / uninstall | cc8d7464fedb6b20b9adeae2d0e34f1aff483b3f481b975a74a1632ef9ffb586 /655033bafa4d3d363ef78074006603995a3234c712dc5cff6a9bd26c74998929 /92cc111baeec627e419c56e89486e5d2ed51bb390c773fec9a6e4be5df87f418 |
| Inspected WrappingNative / V7 Program source | a67b2ad638cf8e92d504b4b7fda011ef1fc3493291159cb511f556788d790d14 /be5f7b729d4360160847ebfc63fa858d9952f9acdf87b9ec9c246fc5d641959a |

All exact V4/V5 reference pins are in [EV0153](../evidence/wrapping-retained-evidence-reconciliation.md);
V6 artifact/11-file pins in [Upgrade plan sections9-10](LICENSING_WRAPPING_UPGRADE_PLAN.md);
V7 artifact/11-file pins in [operator ledger](../evidence/wrapping-v7-operator-verification.md).
Artifacts remain test-only and consumed; no controller reruns. Source pins alone
do not prove a binary was built from those bytes. Accepted evidence index must
bind each relied-upon row to its actual artifact manifest/binary/toolchain/host
and runner provenance; unresolved links remain MISSING, not implied by a version.

## 6. Pending-case ledger — proposed tests, all NOT_RUN

ADP-P IDs below are NEW PLANNED cases, not additions to the frozen protocol
corpus and not evidence of passing tests. NamedOwner=NOT_ASSIGNED for EVERY row.
Role labels identify who should be designated, not who has accepted the work.
Each later run needs isolated reviewed scope, exact artifacts and authorization;
never rerun V1-V7 or test interruptions on customer/current retained state.

| Planned ID / scope | Proposed responsible role; named owner | Minimum acceptance criterion | Original owning gate / entry consequence |
| --- | --- | --- | --- |
| ADP-P01 claim/evidence and artifact binding | Security/QA; NOT_ASSIGNED | Every required claim has exact applicable result, source/binary/manifest/toolchain/host and runner pins; V2 excluded; no unresolved relied-upon link | AR-003/NE-002; before scope acceptance |
| ADP-P02 provider/missing/ACL/identity/unknown outcome | Windows Security/Core; NOT_ASSIGNED | Each ADP-F01..07 case refuses without output/admission/recreate/fallback/replay; uncertain outcome requires reconciliation | AR-002/004, LIC008/C_GATE/C_TXN; detailed contract before entry, fresh physical evidence before corresponding slice acceptance |
| ADP-P03 context/parser/whole-envelope substitution | Core/Windows Security; NOT_ASSIGNED | Different install/Edition/generation/key/domain and malformed/oversize inputs reject; same-context old replay blocked by accepted anchors/CAS, not GCM alone | NE-003/LIC6.5.002/STORE001-005; no authoritative Store integration until accepted |
| ADP-P04 separate standard interactive user | Windows QA/Security; NOT_ASSIGNED | Real non-admin standard account cannot use restricted key; applicable positive control/token evidence valid; filtered-admin not substitute | LIC008/LIC6.6.002, AG-003; reviewer must decide if required for exact entry scope |
| ADP-P05 signed Setup/Guardian/App and child isolation | Host/Installer; NOT_ASSIGNED | Actual product SIDs, exact protected DACL, no broad/App/user grants; signed intent/TTL/ownership/IPC and child refusals | C_IPC/LIC6.4.001..003/006, AG-006; before corresponding product operations accepted |
| ADP-P06 actual Repair/Upgrade/Uninstall/Reinstall | Installer/QA; NOT_ASSIGNED | Signed product operations preserve intended identity/state and retained-data policy; invalid/missing cases refuse; no accidental purge/recreate/downgrade bypass | LIC6.4.006/LIC008, AG-004/006; simulations not final acceptance |
| ADP-P07 interruption/disk/process/uncertain commit | Core/Windows QA; NOT_ASSIGNED | At each declared boundary no partial-state admission/stale retry; generation+hash CAS and journal/outbox/anchor reconciliation; no unsafe replay | LIC6.5.002/STORE001-005/LIC6.4.006, AG-004/005 |
| ADP-P08 TPM/NV/copy/rollback and Software limits | Windows Security; NOT_ASSIGNED | Approved provider choice and TPM controls/anchors tested; copy/clone/admin limits explicit; no unproved TPM substitution | LIC008/Open003/LIC6.5.002, AG-007; outside proposed Software scope, full exit retained |
| ADP-P09 current development-host product row | Windows/Release QA; NOT_ASSIGNED | Complete WIN-V1-01 final product flows for both Editions, including lifecycle/isolation/recovery; history alone insufficient | WIN-V1-01/LIC6.6.002, AG-008 |
| ADP-P10 newer Windows11 x64 | Windows/Release QA; NOT_ASSIGNED | WIN-V1-02 applicable TPM/Software and both-Edition flows on approved independent host; artifact/provider pins | WIN-V1-02/LIC6.6.002, AG-008 |
| ADP-P11 early-floor Windows10 x64 | Windows/Release QA; NOT_ASSIGNED | WIN-V1-03 flows on build14393/approved floor; no inferred compatibility from Windows11 | WIN-V1-03/LIC6.6.002, AG-008 |
| ADP-P12 later Windows10 x64 | Windows/Release QA; NOT_ASSIGNED | WIN-V1-04 applicable edition/provider flows on independent approved machine; correct refusal when unsupported | WIN-V1-04/LIC6.6.002, AG-008 |
| ADP-P13 unsupported platform pre-mutation refusal | Windows/Release QA; NOT_ASSIGNED | x86/Arm64/Server/pre-floor/Insider samples refuse before key/service/state mutation; no x86 product build implied | WIN-V1-05/LIC6.6.002, AG-008 |
| ADP-P14 IPC/plaintext/redacted diagnostic boundary | Host/Audit/Security; NOT_ASSIGNED | No private key/data key/plaintext in App IPC or logs; recursive canary/error/unknown-outcome Audit coverage | C_IPC/C_AUDIT/LIC012/LIC6.5.005, AG-005/006 |
| ADP-P15 restart/read-back/auto-start product recovery | Host/Windows QA; NOT_ASSIGNED | Same owned identity/public policy/DACL and current-state checks after restart; failure denies lease, never recreates; real auto-start tested | LIC6.4.001/006/LIC008/LIC6.6.002; historical V4 reboot not substitute |

Current case placement/decision/preparation actors are enumerated in contract0.2
section5; no physical execution ownership or authorization is inferred. The
NOT_ASSIGNED case entries above refer to those physical execution roles.

All gaps retained: AG-001 owner/scope; AG-002 V2 provenance limitation and accepted
binding; AG-003 P04; AG-004 P02/P06/P07; AG-005 P03/P07/P14; AG-006 P05/P06/P14;
AG-007 P08; AG-008 P09..13/P15; AG-009 exact independent scoped acceptance.
No later-case deferral is granted by this table. Reviewer/decision owner must
explicitly decide pre-entry versus pre-integration obligations; original full
gates never disappear. At least two independent physical computers remain required.

## 7. Approval and acceptance record

| Required action | Named actor / current status | Required record |
| --- | --- | --- |
| Product direction confirmation | Project Owner; CONFIRMED_PRINCIPLES_ONLY under EV0157 | General design/staged scope, safety and role separation approved; exact technical revision/pins and Security acceptance NOT implied |
| Windows Security decision-owner designation | PROJECT_OWNER_CURRENT_USER; ASSIGNED_AND_ROLE_ACCEPTED under EV0158 | Sole Project Owner explicitly accepts decision accountability; not technical certification or scoped adapter approval |
| Residual case owners | ALL_NOT_ASSIGNED | Named actor per case, criteria/test revisions and accepted obligation placement |
| Independent scoped adapter approval | /root/adapter_security_review reviewed prior baseline only; NOT_REVIEWED/NOT_ACCEPTED for this draft | Exact revision/commit/raw digest, verdict/conditions; no carry-over amendment or EV0155 approval |
| Evidence sufficiency and failure/context contract acceptance | PENDING | Accepted claims/artifact pins, detailed contract/test records, all unresolved relied-upon evidence resolved |
| NE-001/003..006 and per-slice authorization | STILL_PENDING | Current original prerequisite records; adapter scope approval alone insufficient |

Material provider/algorithm/ownership/ACL/context/failure/platform/toolchain or
evidence changes require a new version and scoped re-review; no silent repinning.
If proposed behavior conflicts with an accepted Core/protocol contract, stop and
resolve through the existing change process, not a new local override.

## 8. Finding disposition and validation boundary

ASR-001: draft scope/evidence index supplied, owner assigned under EV0158;
exact scope/evidence approval still OPEN, finding not closed.
ASR-002: contract0.2 specifies evidence-qualified failure/routing candidates;
accepted mapping/fresh required evidence still OPEN. ASR-003: planned IDs/criteria/
gates and proposed placement/named preparation actors supplied; physical owners
and acceptance still OPEN. ASR-004: exact bounded container/context/deadline
candidate specified, implementation/payload schema/vector proof still OPEN.
ACR-001: explicit result tuples and lifecycle metadata added structurally in
index0.2; independent semantic acceptance still pending.
No independent finding marked fixed merely by prose.

Draft preparation only. No production/backend/native/schema code, customer data,
key/service/ACL/Installer/hardware mutation, physical test, new owner designation,
approval or commit. Existing uncommitted review records preserved. Current source
pins matched read-only; documentation links, planned-row/gap/reference structure
and whitespace validated separately, not cryptographic or runtime acceptance.
