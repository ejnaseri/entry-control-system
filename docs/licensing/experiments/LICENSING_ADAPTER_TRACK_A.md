# Adapter Track A: inert candidate checkpoint

CHG0103 / LIC-EV-0172, 2026-10-09. Owner explicitly authorized Track A after
EV0171. This record covers author-executed pure tests, not independent Security
acceptance, physical authorization or production native entry.

## Implemented boundary

Candidate sources live in `licensing/adapter-evidence/track-a/`; builder is
`scripts/build-license-adapter-track-a.ps1`. They are separate from product
client/backend, Core contracts/vectors and historical Windows spike controllers.
No service/key/account/ACL/registry/database operation is implemented or executed.
Memory-only AES-GCM uses ephemeral keys, not persisted RSA or Software KSP.

The builder freezes six explicit source inputs, compiler files and reference
assemblies; inventories installed runtime/hostfxr and executor before/after;
checks original repository source bytes after execution; binds manifests and
actual managed-assembly/executor hashes. Direct csc, SDK10.0.400 and runtime10.0.11
avoid MSBuild imports/NuGet restore. This pure-only package is framework-dependent,
not the proposed self-contained physical role kit. `executorExeSha256` denotes
dotnet.exe; no apphost, child or service-role identity is inferred. This local
binding chain does not establish source/binary equivalence acceptance or protect
against a hostile administrator. Generated output remains ignored under `out/`.

## Observed result and custody

Successful output directory:
`out/lic008-adapter-track-a-0e50d7838d484f3587aea1e9bced4fc5/`.
Source baseline e1ff72357a013ee1065c3c203d633be20bb4e981, relevant source dirty=true;
untracked input bytes are individually bound by the source manifest.

| Artifact | SHA256 |
| --- | --- |
| build-provenance.json | c70c7fbe4054dad7fbc61bf5f8f55cbe91da31f2a4e9a2d386f21c7d4354c14e |
| source-manifest.json | b7f28cfe9704597b8bc561da239bea1c33267e2889350099c1b9240f6c2d1a42 |
| toolchain-manifest.json | 875756591061be0037277c815bd1be8c91830feeb3b5d4b7012a9550c1487cbf |
| package-manifest.json | b71fbad70a026c9d88cab1df0f5a31dd90ef156107f70c041361d66361134cd1 |
| compile.rsp | 188fe9ad618ebea162a7f9dfbe6f146c8a6d56e70dd355601a8a15b9f4537021 |
| pure-test-report.json | 67647a68a2aa908f3fe351511aaea109c63e26d1ed94846c24b8678124bc5eb2 |
| executed candidate DLL | 741e361eb86faf9ec8627eb31968d21875246a885d8c36ec60bd80cf63217ba1 |
| dotnet.exe executor | ab1b71fd3dd71062e074c9fab8312081a81b7f2b3e0327c48c4d249c8d1a3135 |

45/45 pure cases and four inventory refusals PASS. Runtime10.0.11, X64,
Windows10.0.22000.0; actual report UTC2026-10-09T10:05:48.1016670Z.
Refusals cover digest mismatch, omitted entry exposing an extra file, duplicate
entry and path escape. Two development attempts failed before a successful final
run: duplicate PowerShell manifest key at parsing, then inventory rejection of
the runtime's `.version` file. Final code explicitly permits that basename;
all other path/duplicate checks remain. Failed output is retained, not evidence
of PASS and not a physical run.

## Coverage is not full plan completion

The following table records initial EV0172 coverage; EV0173 below supersedes
its U08 NOT_IMPLEMENTED status and four-refusal count only.

| Planned case | Current evidence / remaining gap |
| --- | --- |
| FEP-B01 | Local source/toolchain/package pre/post binding; independent review and full physical kit custody pending |
| FEP-B02 | Four pure inventory refusals; broader controller/source substitution matrix pending |
| FEP-B03 | Actual pure DLL/executor emitter only; real role/child evidence NOT_RUN |
| FEP-U01/U02 | Candidate bounds/header/context substitution/snapshot tests PASS; not Core serialization |
| FEP-U03 | Memory-only AES-GCM mutation tests PASS; RSA/KSP integration NOT_RUN |
| FEP-U04 | Same-context replay structurally allowed, observed lack of rollback proof; not an anti-rollback PASS |
| FEP-U05/U06 | Typed cause qualification and deterministic fake-worker checks PASS; native cause evidence and real timeout/worker lifecycle NOT_RUN |
| FEP-U07 | Exact Offline COMMIT_* vs Hybrid TRUSTED_RESPONSE_* names and read-only confirmation exception PASS in model; actual Store integration NOT_RUN |
| FEP-U08 | Recursive Audit/redaction canaries NOT_IMPLEMENTED/NOT_RUN |
| FEP-P01 through P05 | All physical cases NOT_RUN; no physical controller included |

No all16-case closure. `runtimeAuthority=NONE`; durable/nativeKspTested/
physicalTested/securityAccepted/productionAccepted=false. Four REM work packages
remain open; NE-002 NOT_ACCEPTED, NATIVE_ENTRY NOT_READY, LIC008/Open003 open.

Next: complete remaining inert checks (especially recursive redaction canaries
and broader artifact-negative tests), then review exact frozen candidate/output.
Physical controller/ACL/mutation specification and a separate Track B review
and authorization must precede any real service/key operation. Do not rerun
consumed V1-V7 controllers or the historical metadata collector.

## CHG0104 / LIC-EV-0173: candidate diagnostic and inventory hardening

2026-10-09: owner-requested initial changes committed as
f9c8af09b7dbffe921490ef8b85aa2274c249cab; worktree clean immediately afterward.
Then candidate0.1.1 adds DiagnosticModel and twelve pure diagnostic tests.
The model constructs a closed DTO with fixed scope, NONE authority, durable=false
and one bounded code. It never serializes Exception/Message/Data/InnerException,
raw input, stack traces or provider metadata. Recursive schema validation checks
all property names, duplicate names, permitted values and exact nested array size.
This is allowlisted construction, not a generic sanitizer for arbitrary objects.

Text/hex/base64 canaries in simulated rejected-input exceptions and nested
provider failures are absent from emitted output. Deliberately contaminated
nested names/values, duplicate properties, extra array entries and undefined
outcomes refuse. Native provider failures were not executed. Product C_AUDIT,
IPC, console/file logging integration and actual provider diagnostics remain
NOT_RUN; FEP-U08 has candidate-only evidence, not deployed Audit acceptance.

Inventory refusals now additionally cover wrong size, nonexistent filename,
malformed digest, absolute path, case-insensitive duplicate and empty inventory.
These are in-memory manifest mutations against real frozen files; not a hostile
filesystem/reparse race proof or complete controller substitution matrix.
The source snapshot now has seven explicit inputs, including DiagnosticModel.
Emitter version must match the bound build profile.

Final run: `out/lic008-adapter-track-a-fd4a3c9fb5804180bfdd4ac8b8b9a795/`,
source baseline f9c8af09b7dbffe921490ef8b85aa2274c249cab plus bound dirty inputs;
57/57 pure cases and10/10 inventory refusals PASS. Actual report timestamp
UTC2026-10-09T13:06:07.0493897Z, runtime10.0.11/X64. Earlier successful development
run195edb78 retained but superseded by final version/profile-binding run.

| Final artifact | SHA256 |
| --- | --- |
| build-provenance.json | 2658877ce08be9513a6f514e31f110bb8b8fcbe9f9f044e6625dfb2de972f055 |
| source-manifest.json | 167e6159c6be6661ea61457ba204d1d6b9ed9428fcd015556081f619cb5f8ec8 |
| toolchain-manifest.json | 875756591061be0037277c815bd1be8c91830feeb3b5d4b7012a9550c1487cbf |
| package-manifest.json | dd5ce026e6e370c9c8ed35e7210c0f07c40a550320048bd321221c22290a7672 |
| compile.rsp | 84eebc33f48940bafaa9cddbe084b289502b4f96925cfc410708c29df3cdf18d |
| pure-test-report.json | 0e67211a36b1e50d37e2f2f8deb11c94b6663bc7eb3081c643735a959a35cbd6 |
| executed candidate DLL | 1cdda9be3cb08785facc9ed30aed930ad6f78c402fc99b14659185eccd518beb |

Next exact non-author candidate/output review, with B01/B02/B03/U05/U06 and
deployed Audit limits explicit. No new physical controller or Track B authority.
All five physical cases NOT_RUN, four REM work packages open, NE-002 NOT_ACCEPTED,
NATIVE_ENTRY NOT_READY; no production/backend/service/key/account/ACL change.
Initial commit completed; at this checkpoint the follow-up was uncommitted
(subsequently committed4afcaff). No new subagent
review or independent acceptance was performed during this implementation.

EV0174,2026-10-10: [limited non-author review](../reviews/LICENSING_ADAPTER_TRACK_A_REVIEW.md)
completed on committed4afcaff matching these frozen inputs. Custody and recorded
results supported; one LOW fake-worker restart defect TA-R01 and golden-byte
coverage recommendation TA-C01 remain open. Next bounded correction/tests and
fresh bound output, then targeted review. No code fix or physical run yet.

## CHG0106 / LIC-EV-0175: bounded model correction and golden bytes

2026-10-10: user authorizes correction of reviewed simulated model. Candidate
version0.1.2 makes SimulatedDeadline explicitly single-use. Start refuses both
overlap and restart after normal/expired completion, without changing terminal
flags. A new instance models a new operation, not permission to replace a live
native worker. Four added regressions cover expired restart, normal restart,
fresh-instance state and invalid/overlapping transitions. No native cancellation,
queue/locking/concurrency or real-deadline behavior is established.

TA-R01: author correction implemented/tests PASS; targeted non-author confirmation
PENDING, not CLOSED. TA-C01: two golden assertions compare the complete envelope
and AAD with independent literal contract bytes, using distinct installation,
generation, hash, nonce, wrapped-key, ciphertext and tag patterns. Expected bytes
do not call codec encoders/decoders or use codec header/domain constants. These
are candidate framing fixtures, not modifications to frozen Core vectors.

63/63 pure cases and10/10 inventory refusals PASS. Actual version0.1.2 report
UTC2026-10-10T08:16:22.7424504Z, runtime10.0.11/X64. Output directory:
`out/lic008-adapter-track-a-14bf7b2724594ae8bff3b7f570b9e0c3/`.
Baseline4afcaff70192be58fd32f71c4385abd010fa78bf plus explicitly bound dirty
candidate inputs. Build verifies source/toolchain/package pre/post and emitted
DLL/executor/version identity. No historical output overwritten or consumed
controller rerun. Review documents from EV0174 preserved as pending changes.

| Corrected artifact | SHA256 |
| --- | --- |
| build-provenance.json | 4e329700daf6f96025bcc87e1779fe7e7b56f3bc83ef0c9ec6e0f64e8ed8381c |
| source-manifest.json | 2a8146f1238a80717f8ace467cd97cb7fc7767b0aae4c38535aa081c41d86fe1 |
| toolchain-manifest.json | 875756591061be0037277c815bd1be8c91830feeb3b5d4b7012a9550c1487cbf |
| package-manifest.json | cf5759350a1432941c7cc31736e70d09bad971e1fa4e6e89928c13b1626f6073 |
| compile.rsp | 284f88249d147cde9118d686f4d85cadb7853d2e9c509e48d787beaeff61d2e5 |
| pure-test-report.json | 5a53a776a46beb91ae76268e44fa027c713703df7c865243587e91a752fec274 |
| executed candidate DLL | 1a350ab6f6f142415405c8733b394327e62d7e175af509d4e84e507130fb5bb7 |

Next targeted non-author review of these exact corrections and output. No new
delegation or independent review performed in this correction turn. Physical
and deployed integration cases NOT_RUN; four REM open, NE-002 NOT_ACCEPTED,
NATIVE_ENTRY NOT_READY, LIC008/Open003 open. Security/production flags false;
backend/client/services/keys/accounts/ACLs unchanged. Changes uncommitted.

EV0176,2026-10-10: [targeted non-author corrective review](../reviews/LICENSING_ADAPTER_TRACK_A_REVIEW.md)
confirms exact0.1.2 source snapshots/output and recorded63 PASS rows. TA-R01
resolved in simulated candidate, TA-C01 satisfied for framing; no new scoped
finding. No build/test rerun or native/physical/deployed acceptance. Next exact
controller/resource/ACL/mutation/failure-retention specification for review,
not physical execution. Four REM/LIC008/Open003 and NE/native gates remain open.

EV0177: Track A changes and reviews committed1794baf. Next specification-preparation
step completed as [physical pilot draft0.1](../plans/LICENSING_ADAPTER_PHYSICAL_PILOT_SPEC.md).
It proposes exact resources/ACLs/stages and failure-retention requirements, not
a built or authorized controller. Next limited specification review. No Track A
test rerun, native execution, physical evidence or open-gate closure follows.
