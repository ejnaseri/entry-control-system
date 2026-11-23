# LIC008 W03 genuine standard-account control

Date: 2026-11-02. Updated: 2026-11-11 Kabul.
Status: `CLOSED_COMPONENTS_READY_FULL_CONTROLLER_LOGON_AND_PHYSICAL_CRYPTO_NOT_RUN`.

[Completion ledger](LICENSING_LIC008_COMPLETION_PLAN.md) /
[Existing interactive implementation](../../../licensing/windows-spike/wrapping-user-control/Interactive.cs)

The subsequent [native startup foundation](LICENSING_LIC008_STANDARD_NATIVE_HOST.md)
builds an exact four-role native host in three closed variants. Each passes
2,455 pure assertions and refuses 15 operational entries; [eight original
reports](../evidence/standard-native-host-foundation-v1-20261103/README.md)
pin source and PE imports. Independent artifact audit PASS (139,363 read-only
checks). There is
still no real ServiceMain, CLR loader or full V2 admission chain, and no
physical W03 entry has run.

The owner has only this laptop and initially only the administrator account.
The separate prerequisite has now created one disabled Local/Users-only test
account with SID `S-1-5-21-3058020570-171625005-1532683838-1023`; it has not
been activated or used for logon. W03 needs an actual standard-account run.
Running the current administrator account without
elevation, using its filtered token or restricting a duplicate token cannot supply
that evidence. No account, service or key is created by this document.

Independent source/design review by the auxiliary change_review agent found
the following constraints. This is scoped automated review, not final human
Security acceptance. The full crypto controller remains unimplemented and NOT_RUN.
The separate [disabled-account prerequisite](LICENSING_LIC008_STANDARD_ACCOUNT_PREPARATION.md)
has passed source/build/artifact review,160 pure checks and8 closed entries.
Elevated preflight/input review and owner-confirmed account preparation are now
complete. [Exact account-only execution evidence](../evidence/standard-account-preparation-v1-run-20261102/README.md)
does not supply activation/logon, token/process or crypto isolation evidence.

The subsequent [identity foundation](LICENSING_LIC008_STANDARD_IDENTITY_FOUNDATION.md)
passes305 pure checks per variant, independent source/artifact review and a
read-only current-Owner token codec query. That query is not the standard
account1023; activation/logon, full process proof and crypto runner remain pending.
The later [closed components](LICENSING_LIC008_STANDARD_COMPONENTS.md) implement
the suspended credentialed-launch component, credential lifetime, pure comparison
and open/inspect/decrypt primitives. Each variant passes3,038 assertions/13 closed
entries; independent source/artifact review PASS (858 artifact assertions).
There is no physical entry, key-creation/journal factory or complete controller.

The subsequent [construction increment](LICENSING_LIC008_STANDARD_CONSTRUCTION.md)
adds strict canonical input binding, the fixed protected store and fresh
create/inspect/close/reopen/owned/completion components. Native entry remains
closed; the authenticated full controller and actual W03 comparison are pending.
This supersedes the earlier missing-factory implementation gap, without changing
the scope of the previous component evidence.

The subsequent [admission increment](LICENSING_LIC008_STANDARD_ADMISSION.md)
implements one-use GRANT/REPORT/durable-ACK sequencing, owner collection of all
four reports, compile-only local pipe transport and held file custody. Three
variants each pass11,392 synthetic/injected assertions and22 closed entries;
independent source/artifact review PASS (1,401 artifact assertions). Native mutual process/token adapters, actual
loaded-runtime selection, durable stage consumption, account/service effects
and full controller/collector remain pending. The account is not activated and
physical W03 remains NOT_RUN.

The subsequent [owned-account lifecycle](LICENSING_LIC008_STANDARD_ACCOUNT_LIFECYCLE.md)
adds injected activation/explicit-return sequencing, four owner-only originals,
late admission and held-exit guard contracts. Each variant passes12,855
assertions/26 closed entries; independent source/artifact review PASS (1,416
artifact assertions). It supplies no
native account backend and performs no actual account mutation/logon. Next
implement the exact SID-bound native backend and remaining process/runtime/SCM/
controller adapters; physical W03 is still NOT_RUN.

The next [native lifecycle increment](LICENSING_LIC008_STANDARD_NATIVE_LIFECYCLE.md)
implements the retained-SID native account source, explicit NetAPI/SAM codec,
fresh-service lifecycle and separate borrowed process/token observations. Source
review PASS; every physical entry stays closed. These observations establish
neither process/token association nor loaded-code proof. Concrete journals,
ServiceMain wiring, actual held process adapters, separately declared Owner
bootstrap, startup/runtime custody and full controller/collector remain pending.
No account activation/logon, SCM or persisted CNG operation ran.
Three-variant build PASS,19,382 assertions/37 closed entries each;
[four exact originals](../evidence/standard-user-native-lifecycle-v1-20261103/README.md).
Independent artifact review PASS,1,496 read-only assertions.

November4 Kabul [W03 Owner transfer and service journals](LICENSING_LIC008_STANDARD_TRANSFER_JOURNALS.md):
one-use V2 Owner-object transfer model and fifteen fixed Owner-only service
originals implemented. Concrete protected-store mapping validates canonical bytes,
typed durable receipts and exact readback; Setup permissions use an explicit
key-record allowlist. Three variants each pass22,987 assertions/41 closed entries;
independent source review and artifact audit PASS (1,530 read-only assertions).
[Four exact original reports](../evidence/standard-user-owner-transfer-v1-20261103/README.md). No actual transfer, account activation/
logon, SCM or persisted CNG operation ran. Next native held-process/transfer
adapters, V2 input/transfer-store/consumption contract, ServiceMain, positive
startup environment and bounded runtime provenance, protected user scratch and
full controller/collector. Physical W03/LIC008/Open003 and acceptance remain open.

## Reuse boundary

The historical InteractiveAllowed predicate checks enabled administrator
membership but does not require elevationType1 or absence of the Administrators
SID. Its wrapper explicitly permits elevation types1 and3, resumes retained
WrappingV3 resources and automatically deletes keys. Do not reuse that execution
path or rename it as a genuine standard-account test. Retained sources, objects
and evidence remain unchanged.

RSA3072/OAEP and synthetic AES-GCM envelope semantics can inform the new control.
The old accessible-control DACL grants GenericAll; label that grant accurately
if retained in the new design. It is a user-accessible positive control, not
proof of a narrower decrypt-only authorization policy.

## Fresh scope and account preparation

Proposed placement: `Ecs.Lic008.StandardUserControlV1`, with its own fixed
ProgramData root, Setup service, Guardian virtual account, key prefix, scopes
and purpose-specific capability. The name is proposed, not issued or proof of
freshness. Derive and independently pin both service SIDs in the implemented
contract. Default and all unrelated capability builds must remain inert.
Do not borrow the existing EntryEvidence Guardian for this scope.

Account preparation is a separate bounded operation before the SID-bound crypto
approval. Its concrete runner must fix a unique local account name and effects,
refuse an existing name, write a protected create intent, create without
overwrite and record the resulting exact SID and ownership acknowledgement.
Explicit local membership is Users only; verify actual membership after creation.
Do not modify an existing account or infer success from its display name.

The owner enters any password only through the local credential interface;
never request or store it in chat, command arguments, environment, transcripts
or files. Account preparation and SID-bound crypto execution each require
separate complete reviewed effects and owner-entered live CONFIRM in their
local console. Broad test authorization does not bypass those native boundaries.

## Actual process identity and proof

The trusted controller must hold the real credentialed process handle and
independently admit its image hash, creation time and primary token before the
probe accesses a key. A worker's self-reported JSON identity is insufficient.
Require all of these on the independently captured token:

- Exact new local account SID, different from owner and built-in accounts.
- Primary token1, elevation0, elevationType1 and integrity RID8192.
- Interactive SID enabled and not deny-only, with complete bounded group capture.
- Administrators SID absent regardless of flags, including deny-only membership.
- No restricted-token substitution, thread impersonation or incomplete query.

Normal implicit token groups are expected; Users-only local membership does not
mean only one token group. Keep exact four-byte scalar reads and bounded native
SID/group buffers, with malformed or incomplete evidence refused.

Bind every stage to attempt, plan/approval/package/runtime, owner/host/boot,
account SID and key public identities. Keep the independently admitted process
handle through observed exit. Missing held-handle completion proof remains
UNKNOWN; STOPPED/PID0, timeout or a report cannot replace it.

## Crypto comparison and sequence

SYSTEM creates two fresh persisted machine Software-KSP RSA3072 decryption
keys, both nonexportable and never OpenOrCreate. Restricted DACL: SYSTEM plus
the new Guardian. Accessible-control DACL: those principals plus the exact new
user SID. Verify owner, protected descriptor, provider, usage, length, export
policy and distinct public hashes after creation and reopen. Keep protected
intent/owned/completion records and synthetic envelopes.

1. Admit Setup completion and the complete ownership/journal chain.
2. Fresh Guardian opens, validates and decrypts both controls successfully.
3. The independently admitted actual standard-user process opens/decrypts its
   accessible control and attempts the restricted key operation.
4. Guardian reopens, revalidates and decrypts both keys again.
5. Independently collect the original reports and bounded process/token proof.

Failure of either positive control or Guardian recheck makes the comparison
inconclusive. Preserve raw bounded native categories and codes. BAD_KEYSET can
be a distinct observed no-access result supported by those controls; never
rename it ACCESS_DENIED, missing-key proof or W01 export-policy proof. Do not
accept every CryptographicException as denial.

## Required implementation checks and lifecycle

Pure regressions must reject wrong SID, filtered/deny-only administrator,
missing Interactive membership, wrong integrity/type/elevation, malformed
native buffers, old/mixed scopes, swapped identities/ACLs, stale or substituted
reports, PID reuse, missing exit proof, failed accessible control or Guardian
recheck. Account fakes must reject collisions, changed SID/membership,
ambiguous ownership and cleanup of an unowned identity.

Retain keys, account ownership journal and evidence after the run. Any later
disable/removal must revalidate the recorded exact SID and declared effects.
Disabling an account does not prove its sessions ended. No automatic key,
account, profile deletion, blanket logoff or implicit retry is permitted.

This control supplies bounded standard-user isolation evidence only. Its
preparation does not close W01, W04/W05, independent Windows/hardware coverage,
LIC008/Open003 or security/production acceptance.
