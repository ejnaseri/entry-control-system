# Adapter evidence sufficiency and remaining-work assessment — LIC-EV-0169

Date: 2026-10-08. Record: CHG0100 / LIC-EV-0169.
Baseline: 2dd8781 plus retained EV0167/0168 preparation/result changes.
Assessor: coordinator Codex, author-side technical assessment; NOT a non-author
Security acceptance or a new independent physical review.
Verdict: HISTORICAL_FEASIBILITY_OBSERVATIONS_SUPPORTED;
REQUIRED_ENTRY_EVIDENCE_INCOMPLETE. NE-002 NOT_ACCEPTED; NATIVE-ENTRY NOT_READY.

## 1. Exact inputs and question

| Input | Raw SHA256 checked |
| --- | --- |
| [PRE_ENTRY package0.4](../plans/LICENSING_ADAPTER_PRE_ENTRY_ACCEPTANCE_PACKAGE.md) | afc60efe47b61d25ecd92a36c1ed2a51b2af4aaf9897e2add99b722cddbb10d6 |
| [Base operation contract0.2](../plans/LICENSING_ADAPTER_OPERATION_CONTRACT_V02.md) | cd877da8b41874739af15d99682cf4a3abb4d7f4c676b52629eb3e1d1ccb54e7 |
| [Reviewed routing amendment0.3](../plans/LICENSING_ADAPTER_OPERATION_CONTRACT_V03.md) | 7c762f33ab2223d9a61d87d58afd902eec04828dbdfee93b63582d55bcd98a57 |
| [Historical claim index0.2](../evidence/adapter-entry-claim-bindings-v2.json) | b3fb32ac723c72f5d45f82fa858fe1d5224fa1586b1a83a78a0720bdcaf21ea6 |
| EV0168 operator metadata capture, workspace out/e25c38edfe89457fad6b655fd17dbef7 | 34aa1e1e35861d499df237b0e025a81d1b98609aaef1f33da0998e4bfb5abecf |

Question: can historical test-only Software-KSP observations, now linked to their
EXEs, satisfy the exact bounded development entry requirements? Apply the
[adopted scheduling policy](../plans/LICENSING_NATIVE_ENTRY_ADOPTION.md), not the
historical pending status inside its byte-preserved proposal. Owner scope and
conditional execution arrangement from EV0166 remain confirmed; do not ask for
them again. ACR-001 structure and ACR-002 narrow routing are not reopened.

## 2. Evidence sufficiency verdict

The14 hash-bound V4/V5 rows, exact experiment/role identities, report-to-EXE
matches and lifecycle metadata support the explicitly limited historical
observations. They do not prove a new production adapter or the execution of
the managed assemblies in the local package. EXE apphost identity cannot replace
assembly/dependency/source/runner binding. The requirement in ADP-P01 explicitly
includes those bindings; approving a limitation is not completing that requirement.

V4/V5 used the old test JSON envelope. Even fully bound old bits would not execute
the new proposed binary container, independent-context parser or detailed failure
classifier. Historical FAILED_OR_UNAVAILABLE cannot establish all F01..07 causes;
isolated BAD_KEYSET stays unknown. Matching historical runtime/OS does not certify
current host or Windows10/11 compatibility. No unsafe provider fallback permitted.

| Evidence use | Assessment |
| --- | --- |
| Historical one-host provider/key-policy/reopen/decrypt/export/tamper/App-child observations | Supported as historical observations with declared test-role and custody limits; not formally accepted entry evidence |
| V4 normal reboot and V5 controlled missing-key/no-recreation observations | Bound by their exact summary/checkpoint dependencies and EXE rows; not product lifecycle, all failure causes or Store recovery |
| Source/managed assembly executed in V4/V5 | NOT_ESTABLISHED; cannot reconstruct a missing historical measurement from today's local files |
| New container/classifier/readiness implementation | NOT_RUN/absent; no new acceptance inherited from the old harness |
| Real standard-user isolation, product SIDs/IPC, Store/TPM/Windows matrix | Still pending at their owning gates; case placement not yet adopted |

Conclusion: do not repeat metadata collection merely to try to obtain a DLL hash
that the old reports never recorded. Do not repair/modify old evidence or rerun
consumed V1–V7. To supply any required fresh executable evidence, prepare a new
isolated candidate/plan with complete source/assembly/dependency/manifest/runner
identity recorded from the start. It must preserve the declared profile and
have separate reviewed scope/mutation authorization. That is an evidence task,
not permission to implement/deploy production Guardian/Store. A new harness alone
will not finish the other native-entry prerequisites.

## 3. Six original acceptance dispositions — current count

These are the six AR dispositions from the earlier scope assessment, not six
equal-sized tasks or a product-completion percentage. None has a full acceptance
record yet:0 fully accepted,6 partial/open. Existing component progress is real.

| Disposition | Completed components | Residual acceptance obligation |
| --- | --- | --- |
| AR-001 | Decision owner assigned; limited initial scope confirmed; prior non-author reviews exist | Exact whole bounded profile/evidence decision still lacks scoped technical and owner acceptance |
| AR-002 | Provider/purpose/ownership/policy design, concrete candidate bounds and corrected routing documented | Final exact design/configuration and supporting relevant evidence acceptance |
| AR-003 | Explicit result tuples/dependencies; original14 hashes and EXE links verified; V2 excluded | Required assembly/source/runner/manifest sufficiency incomplete; fresh evidence or exact policy-reviewed disposition needed, no implied waiver |
| AR-004 | Evidence-qualified unknown/absence rules and safe deadline cleanup proposed | Accepted classification/recovery/Audit mapping and applicable isolated failure evidence |
| AR-005 | All15 cases have IDs/criteria/gates and proposed placement; conditional available-resource executor named | Scoped placement approval, ADP-P04 timing and concrete resource/per-case plans still unresolved |
| AR-006 | Scheduling adoption and versioned ledger exist | Accepted current conjunction of other NE prerequisites and explicit slice authorization; adapter approval alone insufficient |

## 4. Four remaining work packages for this stage, not four commands

This grouping is a planning summary of the residual obligations above, not a new
gate or a guaranteed number of iterations. The following must still be resolved
to finish the bounded adapter evidence/decision stage:

| Work package | Concrete deliverable / completion criterion | Dependency and current state |
| --- | --- | --- |
| REM-01 Required executable-evidence binding | Fresh separately reviewed candidate/evidence plan recording exact source/dirty-diff, managed assembly, dependency manifest, EXE, toolchain/runner/host and result hashes; execute accepted required cases and review evidence, or an explicit policy-reviewed alternate disposition | Historical EXE link complete, managed/source link absent; plan NOT_PREPARED, execution NOT_RUN; no old rerun |
| REM-02 Exact operation/failure design acceptance | Accept exact bounded provider/ownership/context/parser/deadline/cleanup and F01..07 evidence-to-result/recovery/Audit rules; relevant cases mapped without treating prose or old JSON as executed vectors | Proposed design coherent, routing approved narrowly; whole design/configuration/evidence acceptance pending |
| REM-03 Residual-case placement and resource readiness | Reviewed adopted placement of all15 cases, explicit standard-user timing, named available executors/resources and fresh per-case plans; unavailable hardware/hosts remain explicit | Owner arrangement confirmed, no repeat role request; placements still proposed, case availability not universally assigned |
| REM-04 Exact scoped technical and owner decision | Non-author scoped assessment with findings disposition and explicit owner decision of current profile/evidence/limits; synchronize decision ledger, without claiming native authority | Not obtained; depends on REM-01..03 sufficiency, not just document count |

Recommended next concrete deliverable is REM-01's fresh evidence-plan draft,
before code/host operations. Derive required cases from REM-02/03; do not perform
an arbitrary new physical test to make the ledger appear green. If a new scope
would amend adopted policy, use its exact-change/review procedure, not a silent
deferral. This assessment itself does not adopt any case placement.

## 5. What these counts do and do not mean

- Metadata-capture subtask:14/14 report-to-EXE links verified, complete within its
  stated scope. No need to rerun that collector now.
- Bounded adapter stage:4 remaining work packages; original6 AR dispositions
  remain partial/open, none fully accepted. Work packages can contain multiple
  designs/tests/reviews; no truthful fixed days/hours estimate before plan scope.
- New-adapter tests:15 ADP-P planned cases and10 ACV planned vectors remain NOT_RUN;
  these are overlapping case/vector catalogs, NOT25 additive tasks. Later product/
  Store/TPM/Windows obligations must not all be moved before entry, nor waived:
  exact placement requires scoped acceptance.
- All native work:NE-002 is one of6 conjunctive prerequisites; finishing this
  adapter stage alone does not finish the other5 NE gates. No full-phase/product
  percentage is inferred from document count, PASS-row count or these packages.

Assessment recorded only. Inputs preserved, no provider/service/key/ACL/account/
DB/Installer operation, new crypto test, acceptance, delegated review or commit.
