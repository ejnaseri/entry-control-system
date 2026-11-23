# Limited non-author pilot foundation source/output review

2026-10-10. CHG0113 / LIC-EV-0182.
Verdict: `PILOT_FOUNDATION_CUSTODY_AND_RECORDED_PURE_RESULTS_SUPPORTED_WITH_ONE_LOW_MODEL_FINDING`.
User requested commit then next review; initial ownership/amendment/foundation
changes committed6150a3c76842013612f2db9b6d53e44168bdf977, clean afterward.
Agent `/root/adapter_routing_review` accepts a distinct bounded assignment;
prior planning/Track A approvals do not transfer to this implementation.

## Verified custody and scope

Sources `licensing/adapter-evidence/pilot-foundation/`, builder
`scripts/build-license-pilot-foundation.ps1`; [checkpoint](../experiments/LICENSING_PILOT_FOUNDATION.md)
and exact specification0.1+ownership0.2 provide context. Read-only inspection of
committed bytes and frozen output, not independent test re-execution.

| Raw input | SHA256 |
| --- | --- |
| Policy.cs | 5b343f497f56127d05181835642dbc51b0b071a81cc89b3a760e199ae393102a |
| Program.cs | 8ce1b0e98b0b6af8141141d14e2bfa7c0cc4e91072eca6cd0192e0cc1dc1f6ea |
| MakeHost.cs | f56b3b89d61e904b60900da87382898f52de8a3052e942b861c7d08e1b7d55a3 |
| README.md | 01ddf5ea3cd9e1283f57500c054587e929c578af6ad2b9831370b4d3051c61cf |
| Builder | 29ccd3c82dfa97321700958f8115a732fb28743d6ffab02806f32a32ce312d7f |
| Specification0.1 | 8e50ace849f4f542e096532dda6d45314bb1508f93bb8c83e85728efb5155452 |
| Ownership0.2 | f2859ad5a1d3bd5a41f2cec89448ac98ca042585118ecd9b40d08d2bf3916706 |

All seven match current files/frozen snapshots. Provenance digest
e6cf1851dcbc90cd302b6eae4cc6d8bd6953f5e06678129e14ec013ef0938364
and seven evidence bindings match. Inventories match sizes/hashes/counts:
compiler15, references167, final host tool5, package194, runtime189, hostfxr1;
both original HostModel/template inputs bound. Correspondence acyclic.
Actual recorded emitter DLL a1602f7f63835b3beb3cf02d226d53ad106a2499174734c5d44272b9f76defe4
and apphost b2d92222ef647fb42e4f4757407b163cacc32b665bdfda60b6a661f7d1c98f72
match files. Report141 unique PASS rows, runtime10.0.11/X64, timestamp
UTC2026-10-10T11:36:57.8994202Z. Entry refusal records exit2/empty stdout/
PHYSICAL_ACTION_NOT_IMPLEMENTED, consistent with Program.cs line20.
Builder frozen compile/HostModel/AppLocal runtime-bundling/post-validation
and blocked sequence behavior inspected, not rerun by reviewer.

## PF-R01 — LOW, OPEN: publication omits required metadata composition

Policy.cs lines58–64 checks creator/path/destination SYSTEM owner/digest equality,
but ignores staging owner and source/destination ACE inventories. A staging
FileRule changed to Owner=SystemSid still passes publication. Program.cs
lines36–41 tests destination-owner substitution, not staging substitution.
Separate File-rule tests do not establish that publication requires File checks.
This is a pure model composition gap, not an observed native/publication flaw.

Minimal correction: validate source/destination against independently expected
owner/exact DACL within publication, or require a validated metadata type. Add
source-owner substitution and wrong source/destination ACE regression cases;
bind fresh changed source/output for targeted review before physical extension.
Do not infer expected metadata from the observed rule being validated.

## Checks, residuals and next step

Reviewer used three read-only shell calls and one output poll: Git/source/docs,
digest/size/inventory/report comparisons. No edit/build/execution/protected/
native/token/ACL/SCM operation/delegation. Coordinator separately compares seven
source snapshots/current files and evidence bindings plus unique report IDs;
all match, no test rerun. Documentation/prior-package checks also PASS.

Incomplete SID/directory/bootstrap/strict-plan/admission/physical-emitter/native/
controller/actual authorization details remain explicitly disclosed.141 fixture
assertions are not complete physical-policy acceptance. Full kit/Track B/FEP/REM/
Security/production/NE/native approval absent; four REM/LIC008/Open003 open.
Next PF-R01 bounded model composition correction/regressions and fresh output,
then targeted review. No code fix performed by this review. Bounded AI review
is not independent human security assurance or protection against hostile roles.

## Author correction, targeted review pending

EV0183 foundation0.1.1 composes independent closed-catalog source/destination
owner/protection/ACE validation inside Publish. Forty added regressions cover
source-owner and both ACE sets/creators/paths/protection/duplicates;181 pure
cases PASS. [Exact corrected output](../experiments/LICENSING_PILOT_FOUNDATION.md).
PF-R01 author-corrected, not independently CLOSED. Review above applies to0.1.0
and cannot approve changed bytes by implication; targeted review remains next.

## CHG0115 / LIC-EV-0184: targeted correction review

2026-10-10. Verdict: `PF-R01 RESOLVED_IN_PURE_MODEL`; no new scoped finding.
Agent `/root/adapter_routing_review` accepted a distinct corrective assignment,
inspecting HEAD6150a3c plus disclosed dirty foundation0.1.1 inputs. Earlier
approval was not transferred. Original finding above remains historical.

Publish reconstructs its expected closed catalog from independently supplied
Guardian/App fixture identities, resolves only listed source/destination pairs,
checks creators/path correspondence and necessarily calls File for both ends.
Observed owners/ACEs cannot redefine the expected policy. Forty regressions
cover ten substitutions for each of four pairs, including staging SYSTEM owner,
both ACE inventories/protection flags/creators, unlisted paths and duplicates.
README, emitter and builder dependency version consistently identify0.1.1.

| Reviewed raw input | SHA256 |
| --- | --- |
| Policy.cs | bce73d5ff879a41c4e684a8c157e0c2cce530bd125d76f878900c4a77a98a14c |
| Program.cs | 207a457d53528bb9fbca1dfc3908db01c9d351def5388c31b119e55b8e930241 |
| MakeHost.cs | f56b3b89d61e904b60900da87382898f52de8a3052e942b861c7d08e1b7d55a3 |
| README.md | 6a8029d40f1283dac025bbc607cea33980cae83d6b7ed1b43b5c799d1c71ae65 |
| Builder | 447cbdaeb7fa1ebc35f79a0b11dd0ba8bb5bdf003ab7973dcc3f988ec8901d70 |
| Specification0.1 | 8e50ace849f4f542e096532dda6d45314bb1508f93bb8c83e85728efb5155452 |
| Ownership0.2 | f2859ad5a1d3bd5a41f2cec89448ac98ca042585118ecd9b40d08d2bf3916706 |

All seven current inputs match frozen snapshots/manifest. Exact corrected
[output and evidence digests](../experiments/LICENSING_PILOT_FOUNDATION.md)
match: provenance c8a606de4901262b9d058498954d60840d573db3b55bb01465cd98a1e06eedab,
seven evidence bindings,194 package files, changed managed DLL and unchanged
fixed-name apphost. Recorded181 unique PASS rows, version0.1.1,
UTC2026-10-10T13:26:46.3849717Z; entry refusal exit2/empty stdout/
PHYSICAL_ACTION_NOT_IMPLEMENTED. These are author-executed records, not
reviewer test reruns. Coordinator separately rechecked seven current input
hashes/seven evidence bindings and181 unique PASS rows, with no execution.

Reviewer used two read-only shell calls; no edits/builds/execution/protected
access/native/SCM/CNG/token/ACL operations or delegation. This is bounded AI
technical review, not independent human security assurance.

Next bounded inert work: strict SID validation, directory/creation policy and
stage-plan/schema/admission models with negative fixtures before physical-role
extension. Actual copying/token/ACL capture/native workers/physical emitters
remain unimplemented. No full-kit/physical/Security/production/NE/native/FEP/REM
acceptance follows; four REM/LIC008/Open003 remain open. Review/status changes
uncommitted; reviewed source baseline6150a3c plus bound dirty inputs.

## CHG0117 / LIC-EV-0186: foundation0.1.2 limited source/output review

2026-10-11. Verdict: `FOUNDATION_0.1.2_PURE_MODEL_AND_RECORDED_CUSTODY_SUPPORTED`.
No actionable finding in the reviewed slice. Agent `/root/adapter_routing_review`
accepted a distinct read-only assignment against HEAD850d3ad342920bf101bccd78ad1c221295417a09
plus disclosed dirty0.1.2 inputs. Earlier0.1.1 approval was not transferred.

Canonical service identities require exactly five uint32 decimal components and
distinct Guardian/App identities; Token composes this check. Directory/file
creation resolves independently expected closed rules and validates creator,
token owner, object owner, protected exact ACEs, existence and reparse fixtures.
Directory flags3 differ from file flags0. Plan bounds bytes/depth, rejects
duplicate/unknown fields, validates separately injected expected bindings and
compares exact stage/action/RunId sequences. JSON cannot define expected pins.
Negative fixtures cover documented substitutions. Authorization/collision/
ancestry/completion flags remain simulated, not actual host measurements.

| Reviewed raw input | SHA256 |
| --- | --- |
| Policy.cs | 7ae8180472d8bbae529cc3583d0e71663eb9ea160358c2e8fa2f46bb16f8d386 |
| Program.cs | f47816d80a1c0c82d08799eff490b2f1627bcffa8f84efed3ae42cf62e9bc7fb |
| MakeHost.cs | f56b3b89d61e904b60900da87382898f52de8a3052e942b861c7d08e1b7d55a3 |
| README.md | 706800850950072ce02e23bc993dac96da0088d1165a550d93ab092aca7c2fd8 |
| Builder | ff6295847817521bd3845449daf914a985eab3ba78c4e0080599c835f55122c6 |
| Specification0.1 | 8e50ace849f4f542e096532dda6d45314bb1508f93bb8c83e85728efb5155452 |
| Ownership0.2 | f2859ad5a1d3bd5a41f2cec89448ac98ca042585118ecd9b40d08d2bf3916706 |

All seven current inputs match frozen snapshots/manifest. Exact
[EV0185 output and pins](../experiments/LICENSING_PILOT_FOUNDATION.md) provenance
a738c9eb765f484d5fde3b563b59e5cec82e1d8801d305a73c9da25bce8bcd17,
seven evidence bindings and194 package files match hashes/sizes/count. Actual
emitter DLL e27096da996577cc414199a816d9e99b4edab0227cb415a024643cb5313b825d
and apphost b2d92222ef647fb42e4f4757407b163cacc32b665bdfda60b6a661f7d1c98f72
match files/report. Recorded573 unique PASS rows, version0.1.2,
UTC2026-10-11T06:43:10.6349186Z; refusal exit2/empty stdout/
PHYSICAL_ACTION_NOT_IMPLEMENTED. Author-executed records reviewed, not rerun.
Coordinator separately verified source snapshots/current hashes, evidence
bindings,194 package files and unique PASS count using read-only checks.

Reviewer used two read-only shell calls; no edits/build/execution/native/
protected operations or delegation. Bounded AI technical review is not
independent human security assurance or hostile-producer attestation.

Next inert cross-stage RunId/history/bootstrap/action-state composition,
complete report/context schemas and package/kit/artifact negative admission
guards. Actual SID derivation/token/ACL read-back/native/role-child emitters/
physical execution/full executable custody remain incomplete. No full-kit/FEP/
REM/Security/production/NE/native acceptance follows; four REM/LIC008/Open003
remain open. New source/review/status docs uncommitted.

## CHG0119 / LIC-EV-0188: foundation0.1.3 review and bounded exit assessment

2026-10-11. Verdict: `FOUNDATION_0.1.3_MODEL_AND_RECORDED_CUSTODY_SUPPORTED`.
No actionable finding in this bounded review. Agent `/root/adapter_routing_review`
accepted a distinct read-only assignment on HEAD850d3ad342920bf101bccd78ad1c221295417a09
plus disclosed dirty0.1.3 inputs; earlier approvals were not transferred.

Package validates independently expected closed records including exact sizes/
digests, plain entries, aliases and unsafe names. Candidate report validator
requires exact context/artifact/role/owner bindings, closed schemas, ordered
expected PASS results and restricted authority. PilotSession reserves copied
RunIds across stages, preserves experiment/context/artifact pins, links prior
checkpoint/evidence digests and composes ordered action/report validation.
Unknown completion/invalid reports/unknown stopped-state permanently block the
instance, including late success. These are injected volatile models only.

| Reviewed input | Raw SHA256 |
| --- | --- |
| Policy.cs | 543ac48ccd7254f2e477975e6f79c9147874a239f633437849d7b611b919a579 |
| Program.cs | 07faddaf2de718324cfb183b0c81c95bfb6da06636af4c6bff4564f74ca26fce |
| MakeHost.cs | f56b3b89d61e904b60900da87382898f52de8a3052e942b861c7d08e1b7d55a3 |
| README.md | 89f201103726855924527b23e4e2cce801b520a7ec28c2e772db3d3dd7cd9869 |
| Builder | 97c01c06907449c95de83d912be449075b19f2770cbf98c4887fb96d7f54fd6c |
| Specification0.1 | 8e50ace849f4f542e096532dda6d45314bb1508f93bb8c83e85728efb5155452 |
| Ownership0.2 | f2859ad5a1d3bd5a41f2cec89448ac98ca042585118ecd9b40d08d2bf3916706 |

All seven match current files/frozen snapshots/manifest.
[Exact EV0187 output](../experiments/LICENSING_PILOT_FOUNDATION.md) provenance
30db3299c547d24da2abeaa8054e7f5d9e14250f753044a97839ceae29d53781,
seven evidence bindings and194 package files match hashes/sizes/count.
Actual emitter DLL ce82b69553456fe5d23c7042d7155a4a7d9c177dac8500ce7c54e2a8fcb78f1f
and fixed-name apphost b2d92222ef647fb42e4f4757407b163cacc32b665bdfda60b6a661f7d1c98f72
match files/report.670 unique recorded PASS rows, version0.1.3,
UTC2026-10-11T06:53:16.9841737Z; entry refusal exit2/empty stdout/
PHYSICAL_ACTION_NOT_IMPLEMENTED. Three reviewer read-only shell calls; no
rerun/build/edit/native/protected operation or delegation. Coordinator separately
checks current input/evidence hashes and194 package entries/670 PASS rows.

Current pure-model review checkpoint can end. Further review attaches to changed
inputs or a defined acceptance deliverable, not repeated unchanged models.
Next one consolidated implementation-readiness packet: exact TEST_ONLY slice/
responsibilities/permitted operations, complete bootstrap/object/action inventory,
physical report schemas and failure/stopping/retention interfaces, source/package/
kit/archive provenance design and measurable artifact admission. Separate
implementation permission, built-kit review and per-stage physical authorization.
Use existing reviewed specifications/models; do not reopen unrelated policy.
The packet supports a concrete authorization decision before actual role/
controller/native implementation, not permission supplied by this review.

Actual token/ACL/path measurements, secure same-handle creation/copying/native
workers/role-child emitters/full kit graph/physical report data remain absent.
No full-kit/Security/production/FEP/REM/NE/native acceptance. AI review is not
human security assurance. New source/review/status docs uncommitted.

## EV0190: implementation-readiness packet review (2026-10-11)

Distinct non-author `adapter_routing_review`, read-only against43bada5, packet
and four pinned references. Conclusion:
PACKET_SUFFICIENT_FOR_USER_AUTHORIZED_TEST_ONLY_IMPLEMENTATION.
No blocking contradiction. User's present request explicitly authorizes scoped
implementation; do not require another owner decision for this same scope.
LOW IP-C01: independent exact file-class name/owner/ACE constraints missing from
checker, despite correct packet. Coordinator corrected with three targeted
negative cases;23 checker negatives PASS, packet/four pins unchanged.
The correction and subsequent EV0191 native source are not covered by this
earlier packet review. Full built-kit review remains required. No physical
operation/build/rerun by reviewer; no human Security or production assurance.
