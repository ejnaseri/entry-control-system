# Limited non-author Track A candidate/output review

CHG0105 / LIC-EV-0174, 2026-10-10.

User authorized the proposed non-author review. Existing agent
`/root/adapter_routing_review` accepted a distinct Track A reviewer assignment;
this is not reuse of earlier routing/plan approval. Coordinator records the
returned findings without changing candidate source or executing it.

Verdict: `TRACK_A_CUSTODY_AND_RECORDED_PURE_RESULTS_SUPPORTED_WITH_ONE_LOW_MODEL_FINDING`.
Limited AI-agent technical review, not an independent human security guarantee,
Security/production/native/physical approval or full-plan closure.

## Exact inputs and checks

HEAD inspected: `4afcaff70192be58fd32f71c4385abd010fa78bf`, clean worktree.
[Candidate checkpoint and output pins](../experiments/LICENSING_ADAPTER_TRACK_A.md),
[fresh plan](../plans/LICENSING_ADAPTER_FRESH_EVIDENCE_PLAN.md),
[contract0.2](../plans/LICENSING_ADAPTER_OPERATION_CONTRACT_V02.md) and
[routing amendment](../plans/LICENSING_ADAPTER_OPERATION_CONTRACT_V03.md) bound
the review scope. Sources: `licensing/adapter-evidence/track-a/` and
`scripts/build-license-adapter-track-a.ps1`.

| Raw source | SHA256 |
| --- | --- |
| CandidateCodec.cs | 62723ac52f4f3ded49d32e128f3ad3a0cabb25a2491381858f9ec4b9ce433893 |
| FailureModel.cs | 41eaafaa7e1532d820250ffdc02c7ffe4a36d250011002ea9d61dba3b514a1d8 |
| DiagnosticModel.cs | 06849cafb12e839907f51d9e5abec5fd98d1057a5c94f699b47b42cc4a373bb0 |
| Program.cs | 9629d13d66eb09b318c36517dff7b9631a3bc11e071473deb295c2d8c3726510 |
| build-inputs.json | 9f8811782abdd115543f8e0e2d71ec23351914eee5a62597a77c857ff8fbb06a |
| README.md | 547851358cdefc337572d55de59c06c432243101ad0ca2b327f36ce2cefdd99c |
| Builder script | 050a4bc3bd6f036e3b7fc3ae3b5b75cd002aa0cceedaed7e3a732a74c5349def |

All seven current files match frozen source snapshots. Final provenance SHA256
2658877ce08be9513a6f514e31f110bb8b8fcbe9f9f044e6625dfb2de972f055
and its five artifact bindings match. Three package files match size/digest,
including executed DLL1cdda9be3cb08785facc9ed30aed930ad6f78c402fc99b14659185eccd518beb
matching the actual emitter report. Frozen compiler15/reference167 inventories
match sizes/hashes/counts; bindings are acyclic. Historical dirty source baseline
f9c8af remains historical: matching current committed bytes do not rewrite it.

Recorded57 cases have57 unique IDs and zero FAIL rows. Twelve diagnostic cases
exercise allowlisted DTO construction, exception canaries and recursive schema
rejection. Ten inventory refusals are a builder-recorded aggregate, not ten
separate report rows. Branches were inspected, not rerun by the reviewer.
Reviewer checks: read-only Git HEAD/status, source/document reads, SHA256/size
comparisons, manifest inventories and report ID/status analysis. No edits,
build/candidate execution, protected resources, machine mutations or delegation.
Coordinator separately compared provenance/five bindings/seven source snapshots
and current files read-only; all matched. No new physical/test execution.

## Finding TA-R01 — LOW, OPEN

`FailureModel.cs` line40 (Start), lines41–42 (Expire/Complete) permit restarting
a completed simulated worker without resetting Expired/Cleared/Delivered.
After Start→Expire→Complete→Start, cleanup appears completed during a new active
operation and subsequent normal completion suppresses delivery because expiry
remains sticky. `Program.cs` line85 tests only one lifecycle. This is a defect
in the fake model, not a finding about an executed native worker.

Smallest correction: make the instance explicitly single-use and refuse restart,
or fully reset per-operation flags; add a focused lifecycle regression and bind
new source/output for targeted review. No correction implemented by this review.

## Coverage recommendation TA-C01 — OPEN

Add independently specified exact header/AAD domain-byte expectations. Current
inspected framing matches the contract, but shared encoder/decoder round trips
and AAD length alone could miss matching implementation drift. This is a bounded
test improvement, not evidence of a currently incorrect encoding.

## Remaining boundary and next action

First correct TA-R01 and add focused regression plus TA-C01 golden assertions;
then bind and review the changed candidate/output. No physical controller exists.
Track B still requires exact controller/ACL/resources/worker specification,
review and separate authorization. Native KSP/RSA/child/Core serializer/Store/
real deadlines/deployed Audit/physical cases remain unimplemented or NOT_RUN.
REM-01..04 open; no16-case closure, case-placement adoption, NE-002 acceptance or
native-entry readiness. LIC008/Open003 remain open. Product backend/client,
Core contracts/vectors and historical reports/controllers unchanged.

## Author follow-up, not reviewer re-approval

EV0175 candidate0.1.2 implements the single-use alternative and four lifecycle
regressions for TA-R01, plus two independent full-envelope/AAD golden assertions
for TA-C01. [Corrected output custody](../experiments/LICENSING_ADAPTER_TRACK_A.md)
records63 pure PASS cases. Both corrections await targeted non-author review;
the verdict above applies only to inspected0.1.1 bytes and is not transferred
to the changed candidate. Original findings/history are preserved.

## CHG0107 / LIC-EV-0176: targeted corrective review

2026-10-10: user authorizes the next proposed corrective review. The same
non-author agent accepts a separate bounded assignment and inspects HEAD
4afcaff70192be58fd32f71c4385abd010fa78bf plus disclosed dirty candidate0.1.2
inputs. Verdict: TA-R01 `RESOLVED_IN_SIMULATED_CANDIDATE`; TA-C01
`SATISFIED_FOR_CANDIDATE_FRAMING`. No new findings in this limited scope.
Earlier0.1.1 approval was not transferred; changed bytes inspected explicitly.

Start now records first use and rejects every later Start before changing flags.
Four lifecycle regressions directly cover expired/normal restart, new-instance
state and invalid/overlapping transitions. Golden fixtures independently specify
full envelope and AAD: literal magic/version/suite/purpose/Edition, distinct
field patterns, big-endian generation/length,384-byte wrapped-key field,
ciphertext/tag positions and exact20-byte domain match contract0.2's534-byte
header/554-byte AAD. Expected bytes use neither codec constants nor its output.

| Corrected raw source | SHA256 |
| --- | --- |
| CandidateCodec.cs | 62723ac52f4f3ded49d32e128f3ad3a0cabb25a2491381858f9ec4b9ce433893 |
| FailureModel.cs | 5b7fca20a852d9135b9df49fa0187b55a9b96a4834b799682ef86b5bd215a448 |
| DiagnosticModel.cs | 06849cafb12e839907f51d9e5abec5fd98d1057a5c94f699b47b42cc4a373bb0 |
| Program.cs | 1533dcb98654234902194cc81312067b10abc6de06d11aa5d824f1ad615224a6 |
| build-inputs.json | 3ecf8bc3a990accb31378128f63bc90b62c908906955f4c94ea18be9ceb76d62 |
| README.md | cac8744eb86a7c3415c837a92ef4383bd5ee857141577934f16a163c0079e69a |
| Builder | 050a4bc3bd6f036e3b7fc3ae3b5b75cd002aa0cceedaed7e3a732a74c5349def |

All seven match current files and frozen manifest/snapshot. Corrected output
provenance matches4e329700daf6f96025bcc87e1779fe7e7b56f3bc83ef0c9ec6e0f64e8ed8381c;
five evidence bindings/three package sizes and hashes match. Actual emitter DLL
1a350ab6f6f142415405c8733b394327e62d7e175af509d4e84e507130fb5bb7 matches.
Recorded63 unique PASS rows include all six added assertions, version0.1.2,
runtime10.0.11/X64, UTC2026-10-10T08:16:22.7424504Z. Ten inventory refusals
remain a builder-recorded aggregate, not independent execution by reviewer.

Reviewer used two read-only tool calls: Git/source/doc inspection and
hash/size/report comparisons. No edits/build/candidate execution/protected
operation/delegation. Coordinator records results, no new runtime operation.
Findings closed only for the fake candidate/framing-test scope. AI-agent review
is not human Security assurance. Real lifecycle/roles/Core/Store/deployed Audit
and physical tests remain unimplemented or NOT_RUN; no FEP/REM closure, Track B
authority, Security/production or NE/native acceptance.

Next prepare the exact test-only physical controller/resource/ACL/mutation and
failure-retention specification for review, before implementing or executing
physical operations. This review does not authorize that execution.
