# LIC008 next experiment and native integration dependency proposal

Date: 2026-09-19. Base: `0bac5a5` plus existing diagnostic/documentation worktree.
Author/implementation owner: Codex. Acceptance reviewer: Project Owner.
Independent security reviewer: not assigned; required before security closure.
Status: **plan prepared; current-host baseline executed with failures; remaining
experiments pending; dependency amendment proposed**.
Follow-up EV0098: the isolated current-host baseline executed with key-finalize
and DPAPI-protect failures; see [physical results](../experiments/LICENSING_PROVISIONING_HARNESS.md).
The matrices below describe the plan, not a claim that every row was executed.
Dependency amendment remains proposed and unadopted.

Implementation follow-up: [baseline package0.3.0](../experiments/LICENSING_PROVISIONING_HARNESS.md)
is built and guard-tested under EV0097. Its physical results are recorded under
EV0098; security acceptance remains pending. No dependency amendment is adopted.

The user requested this planning step after the [path review](../reviews/LICENSING_PATH_REVIEW.md).
It authorizes preparation of a concrete experiment and dependency proposal, not
automatic adoption of Setup-created product keys or a changed protection policy.
The [master](../design/LICENSING_DESIGN.md) remains normative. Proposal labels below are
local labels, not new completed checklist items or amendments to section17.

## 1. Objective and established facts

Determine whether the Guardian virtual account can create and retain the required
machine-scoped signing key, and independently protect secret state on a standalone
Windows installation. Locate the failing operation before selecting an adapter.

| Existing evidence | Consequence for this experiment |
| --- | --- |
| EV0091 corrected by EV0092-0094: file creation and App/child file denials passed | Preserve that evidence; it does not prove key or DPAPI isolation. |
| Old compound Software/TPM key probes returned 0x80090010 | Creation, public-key recording, DACL setup and verification were combined; the failing operation is not established. |
| DPAPI-NG returned 0x80090034 | Separate protection investigation; a successful signing key would not resolve it. |
| Administrator query reports Software P-256 support, Platform P-256 query 0x80090029 | Start with Software diagnosis. Hardware assurance needs a suitable TPM target and its own evidence. |
| Exact old key opens returned 0x80090016 under Administrator | Caller-scoped observation only; no permission to remove old keys or services. |
| Old services are retained, stopped, with unresolved cleanup | Never reinstall over them, reuse their keys, broaden their ACLs or infer successful cleanup. |

## 2. Recommended baseline: Guardian creates the key

This preserves master section5 and packaging section7 step8. Privileged test
setup only installs isolated services/directories with fixed identities and ACLs;
it does not create their signing key. Guardian creates the key under its own token.

The existing 0.2.1 candidate is not yet this full experiment. Its stage labels
separate some failures, but `CngKey.Create` and `AssertKey` still combine operations,
and its namespace collides with the retained installation. Reuse reviewed guard
logic; do not simply run InstallAndRun again on this host.

### Pre-execution implementation contract

- Use a separate fixed test namespace, proposed `Ecs.Lic008.ProvisioningV1`,
  with Guardian/App services and a correspondingly separate ProgramData root.
  A fixed build profile owns those names; do not add arbitrary service/path/key
  arguments. Reject any pre-existing root, service or intended key collision.
- Generate a new run ID and random canaries. Use only test keys with names derived
  from fixed provider/profile and that run ID; never overwrite an existing key.
  Record intent before creation and public identity after creation. An interrupted
  creation without complete ownership is retained for reconciliation.
- Validate exact installed binary/manifest, service configuration and actual
  process token before a probe. Record user SID and relevant service-SID presence/
  enabled state, not just a role argument. The App child must actually inherit
  the App token; an Administrator shell is not an App/Guardian substitute.
- Separate service startup/control handling from crypto work, with bounded probe
  execution and safe stop/timeout reporting. Current `ServiceHost.Run` calls
  `execute()` synchronously inside its service-main delegate. Review lifecycle
  explicitly before the next creation probe; this source observation is not a
  diagnosis of the earlier permission error. Microsoft documents a service-start
  deadlock caveat for [NCryptCreatePersistedKey](https://learn.microsoft.com/en-us/windows/win32/api/ncrypt/nf-ncrypt-ncryptcreatepersistedkey).
- If managed creation still fails as a single stage, the diagnostic native path
  must expose provider-open, create-persisted-key, each property assignment and
  finalize separately. Preserve the same machine/signing/export policy, use a
  different fresh test key for a different variant, and change one variable at a
  time. Microsoft documents creation/property/finalization as separate operations
  in the same API reference. Do not claim a managed failure identifies finalize.
- Guard tests must cover collision/no-overwrite, wrong identity, malformed plan,
  linked/aliased paths, forged ownership, timeout/partial results, redaction and
  preservation of old resources before physical execution. These are future tests,
  not results of this documentation step.

### Baseline probe matrix

All rows below are **NOT RUN** for this new experiment. A failed prerequisite
produces `NOT_TESTED_PREREQUISITE`, never a denial PASS.

| Local label | Actor and operation | Required evidence |
| --- | --- | --- |
| P01 | Guardian: verify identity; query Software provider/P-256 | Exact expected token, provider and algorithm; error/stage if unavailable. |
| P02 | Guardian: write intent; create fresh machine P-256 signing key with export disabled | Separate stage outcomes; no overwrite, no user-key substitution, no elevation inside Guardian. |
| P03 | Guardian: public SPKI identity, ownership record, SYSTEM/Guardian key DACL and policy read-back | Exact expected principals and permissions, machine/signing/export properties; no broad inherited grants. |
| P04 | Guardian: sign fresh random challenge and verify with public key; attempt private export | Successful positive control plus explicit export refusal. A missing key or unrelated error is not export-policy proof. Never retain exported private bytes if a test unexpectedly succeeds. |
| P05 | Fresh Guardian process: reopen same key, compare public identity, sign and recheck policy | Demonstrates process-restart continuity without creating another key. |
| P06 | App and actual App child: open/use that exact proven key; read/write protected canary | Expected access denial with positive existence control; wrong-name/missing-resource errors are inconclusive. |
| P07 | Ordinary non-admin interactive token: corresponding denials | Record actual token class; deferred if no suitable execution context, never impersonated by an elevated test. |
| P08 | Guardian: create exact `SID=<Guardian SID>` DPAPI-NG descriptor, protect random secret, unprotect and compare | Separate descriptor/protect/unprotect/read-back outcomes; no plaintext persisted or reported. |
| P09 | App/child: decrypt the same blob, which they can read from the shared test directory | Explicit cryptographic denial after Guardian round-trip success; file denial alone does not test DPAPI. |
| P10 | Fresh Guardian process: decrypt retained blob; repeat App/child denials | Same secret verification, no replacement blob or newly generated secret masking loss. |
| P11 | Scheduled normal reboot, then P05/P10 and negative controls | Same public-key/blob identity and policy across boots; no automatic reboot in ordinary probe execution. |
| P12 | Cleanup of only fully owned new experiment resources | Distinct DELETED_AND_CONFIRMED, ABSENT_FOR_CALLER, INCOMPLETE_OWNERSHIP and DENIED_OR_UNKNOWN results. Only proven resolution allows service teardown; retained reports and old installation remain intact. |

Service restart here means a new process under the same service identity. Normal
reboot, repair/reinstall, TPM wrapping/attestation/NV and power-loss tests are
separate scenarios; this first Software experiment cannot certify them.

### Standalone protection decision

Run P08-P10 with the exact approved descriptor on the standalone target and record
domain membership and OS version. Microsoft's documented
[SID-based DPAPI-NG example](https://learn.microsoft.com/en-us/aspnet/core/security/data-protection/implementation/key-encryption-at-rest?view=aspnetcore-10.0)
uses domain key distribution. That is a reason to investigate compatibility, not
proof that every native standalone configuration fails or proof of our root cause.

If the baseline cannot satisfy the standalone requirement, record an unsupported/
unresolved outcome under LIC-OPEN-003. Do not join a domain, alter system key
distribution, substitute LocalMachine DPAPI, or weaken SID isolation to obtain a
PASS. A different wrapping/protection adapter needs a separate design comparison
covering key custody, App/child denial, restart/repair, clone limits and recovery.
The ECDSA signing key must not be repurposed as a wrapping key.

## 3. Conditional alternative: Setup provisions a key

**Not selected or implemented.** Consider only after the baseline has a located,
reproducible failure and review establishes that provisioning identity is relevant.
Failure at signing, DACL validation or DPAPI alone does not justify this alternative.

A test-only comparison would use a separately reviewed fixed LocalSystem helper
and new test keys. Its plan is bound to the experiment/build, provider, run and
Guardian SID; no arbitrary executable/path or general signing service is allowed.
It must enforce no-overwrite, bounded lifetime, exact orphan reconciliation,
redacted output and no private-key return. Stop the helper before Guardian
reopen/sign/denial/continuity tests. App must not trigger provisioning or inherit
helper authority. Interrupted create/DACL/ownership handoff must be tested, including
the period before final ACL application; unexplained ownership is retained.

Production adoption would require an explicit amendment to master section5,
packaging sections4/7, installer ownership/repair rules and the acceptance matrix.
The existing Setup role does not already grant this new responsibility. A successful
test-only comparison would be evidence for that decision, not approval itself.

## 4. Concrete LIC-OPEN-012 resolution proposal

Current update CHG0080/EV0149: exact reviewed v2 scheduling policy is
[adopted](LICENSING_NATIVE_ENTRY_ADOPTION.md). Open012 closed scheduling-only;
native entry prerequisites and all full exits remain open as applicable. The
proposal/pending-adoption history below is superseded by the adoption record.

2026-10-07, CHG0077/EV0146: [v2 amendment](LICENSING_NATIVE_ENTRY_AMENDMENT_V2.md)
supersedes the v1 proposal after author review. Adapter-entry versus full matrix,
per-row dependencies and evidence invalidation are explicit; independent Security
review/final Product confirmation still pending. No adoption or native entry yet.

2026-10-06 update, CHG0075/EV0144: the user approved the Product direction.
The [concrete amendment v1](LICENSING_NATIVE_ENTRY_AMENDMENT.md) now enumerates
entry evidence, integration contracts, candidate graph and adoption locations.
Assigned Security review is pending. This proposal is not yet adopted; effective
master dependencies and Open012 `[!]` remain unchanged.

Recommendation: **permit bounded native implementation entry separately from full
phase completion**, while retaining every existing FILE/STORE and release exit.
This is preferable to declaring LIC006 complete using memory doubles or moving
its remaining evidence out of sight. The following changes are proposed only.

Define an auditable native-entry record (local label `NATIVE-ENTRY`) requiring:

1. Completed LIC001-005 and accepted LIC008 adapter decisions/limitations.
2. Explicitly reviewed portable LIC006/007 contracts and the portions of LIC009,
   LIC010 and LIC012 needed by native integration, including failed-observation
   admission, restrictive-transition barriers and unknown-ack reconciliation.
   Any deferred native obligation remains linked to its original owning item;
   a generic 'portable tests pass' is insufficient. New 0bac5a5 review is included.
3. Completed LIC011 Vendor authority boundary and all three LIC6.3 artifact gates
   against the actual current customer artifact. This proposal does not bypass
   Vendor separation, key custody or artifact isolation.
4. A versioned interface/evidence ledger naming implementation and security reviewers,
   exact hashes, open native cases and acceptance criteria. Product/Security review
   accepts the entry record. No customer installer or pilot is authorized by it.

| Canonical location | Current blocking dependency | Proposed implementation-entry rule; full exit retained |
| --- | --- | --- |
| Section16 and section17.1 Phase6.4 entry; LIC-6.4-001 | Full Phase6.2 and Phase6.3 completion | NATIVE-ENTRY plus completed Phase6.3 permits bounded Guardian development; Phase6.2 remains open until its native evidence passes. |
| Section17.1 Phase6.5 entry; LIC-6.5-001 | Full Phase6.4 exit | Reviewed executable Guardian/App and constrained Setup slices with identity/IPC/no-secret-leak tests permit private PostgreSQL/credential work; do not wait for final lifecycle/recovery exit evidence that needs those stores. |
| LIC-6.5-002 | LIC008 and completed Guardian001 | LIC008 plus reviewed executable Guardian ownership/IPC slice permits Secure Store integration; full Guardian001 remains open if its acceptance still needs Store. |
| LIC-6.4-003 and LIC-6.4-005 implementation sequencing | Complete Guardian/App/Setup predecessors | Reviewed prerequisite interface/security slices permit constrained Setup and recovery implementation; actual Backup/repair acceptance waits for real DB/Store/ACL integration. No full predecessor closure is inferred. |
| LIC006/007/009/010/012/013, full Phase6.4/6.5 exits and Phase6.6 | Existing physical, aggregate and integration acceptance | Unchanged exit evidence, including FILE001-005, STORE001-005, real service barriers, Backup isolation and lifecycle matrices. |

Proposed engineering order is acyclic: portable/Vendor/feasibility/artifact entry
record -> minimal Guardian/App/Setup implementations -> DB and Store adapters ->
real file/durability/runtime/recovery integration -> original item acceptance and
phase aggregates -> final packaging scans/Windows matrix -> Phase7 pilot.
Minimal means a reviewed implementation slice, not a production bypass or a fake
store. Where an interface is not ready, its dependent slice cannot start.

The entry record's portions must be enumerated in a reviewed amendment before
adoption; this plan does not mark them done or claim they are ready today. On
acceptance, update section16, section17.1, the affected dependency cells and mirrors
together, append a decision/change row, then resolve LIC-OPEN-012 against that
decision. Until then the current dependency graph and Open status remain binding.

## 5. Evidence, stopping conditions and immediate handoff

Each new report must identify schema/build/package digest, run ID, actor/token,
OS/domain/provider facts, exact stage, error code, prerequisite outcome and whether
a resource may have been created. Retain expected public hashes, token-class/SID
and allowlisted service/ACL facts; exclude private material, plaintext secrets,
user/host names, serials and customer data. Hashes identify artifacts, not publisher
authenticity. Separate current-host diagnostics from independent target evidence.

Stop dependent probes on unexpected access, identity mismatch, unknown creation
outcome or policy mismatch. Preserve evidence; do not escalate Guardian's token,
grant broad access, retry stale creation or remove unknown resources. Confirmed
test-key cleanup is a separate explicit action with exact ownership checks, not
an automatic reaction to a failed probe.

Immediate implementation handoff: build and guard-test the fresh-namespace
Guardian baseline (P01-P10 and cleanup accounting) as an isolated test package;
review its exact mutation manifest before a physical run. P07/P11 and hardware/
Windows10/TPM-less/repair matrices remain scheduled separately. Existing service
names, old ProgramData root, keys and reports must remain untouched. The proposed
native-entry amendment can be reviewed independently; it does not block preparing
the existing LIC008 baseline experiment.

Planning completion means this matrix, conditional alternative, dependency-change
table and resource/evidence policy are written and linked. It does not mean any
new probe passed, any adapter was selected, or LIC008/LIC006/LIC007 is complete.

Validation of this planning step: local documentation checker passed across
26 Markdown files, 51 local links, 96 unique EV rows and 45 unique CHG rows;
Evidence-table shape and `git diff --check` passed. Canonical Guardian/Store
dependencies and LIC-OPEN-012 status were checked unchanged. Runtime, native,
crypto, database and K40 tests: **Not run**. No commit was made in this step.
