# V2 capable candidate — 2026-10-16

Status: BUILT_AND_LIMITED_AUTHOR_REVIEWED; exact Prepare permission pending.
User requested the next testing step after A1 correction. This authorizes
preparation/testing here, not fabricated exact-candidate consent or a live stage.

## Build selection

Default build stays inert. TestCapable now additionally requires
ReviewedSuccessorSha256 equal to the frozen0.5 packet pin. Compiled root/prefix/
successor are checked for fixed V2 before build. All frozen protocol references
remain verified; this build selection is not an owner decision. The old blanket
REPORT_V2_ADOPTION_PENDING build refusal is superseded for this explicit path.
Native runtime, console confirmation, owner reservation and stage gates unchanged.

## Exact capable candidate

out/lic008-pilot-runtime-candidate-4c7923163636489a86768c96c12165f8

| Artifact | SHA256 |
| --- | --- |
| self-contained-provenance.json | 4296ff854c75e6b5a1685a12ee1741ee75139fc9e504d313db137f7b60873b4d |
| pilot-kit.zip | eec86d16ea603886dabe48d1ffe42c523f4a5410b8c5cf6be9b958a27d85c3e8 |
| kit/kit-manifest.json | f314c3e3d1e9fe589ffb5c77d29d5b416615168a69c80487d0db76eedabe7740 |
| loaded pilot DLL | fe786bb98256bb058d9778b4b1b699596f05a3f07d7cea19b674f33fb91a74e5 |

Build/self-contained/extracted kit SelfTest each PASS1820 (same tests repeated).
Three native-entry and three unpinned wrapper-stage refusals pass; three
noninteractive controller-stage refusals and two capability-metadata mismatch
refusals pass. physicalEntryEnabled=true; physicalExecuted/Tested=false;
securityAccepted/productionAccepted=false. Builder exits0.

Separate read-only pass rehashed39 current source entries,249 kit entries and
archive/manifest/provenance. All match. Reviewed build negative paths refuse
before physical operations. Three invalid build selections pass refusal tests.
A1 permission-source45 synthetic/CLI/wiring checks also pass.
This is same-author review, not independent security certification.

Default inert regression was separately rebuilt at
out/lic008-pilot-runtime-candidate-ca9aba1eb19647d6a53a31000f72ebe5:
1820 cases plus package/extracted wrapper and refusal gates PASS, builder exit0.
That artifact is NOT the capable candidate authorized for a future test.

Read-only host/review helper produced eight non-authorizing draft files at
out/lic008-prepare-review-9937805a1b63f8dff7765484145ea511.
No APPROVE decision, valid owner context or permission-source record issued.
Boot-sensitive drafts must be refreshed if host/package/boot context changes.

## Exact next permission boundary

Ask owner for Prepare only on the pinned candidate above: create protected
C:/ProgramData/Ecs.Lic008.EntryEvidenceV2, copy this reviewed package, register
the three V2 Setup/Guardian/App test services, and execute Prepare actions
including creation of two new test keys. No V1 mutation/adoption/cleanup,
production changes, automatic reboot or later-stage permission is included.
Fresh owner source/context/hash and live console confirmation remain necessary.
The actual elevated preflight must still prove root/service absence and refuse
unknown/collision. No live preflight or physical stage was run in this turn.

Do not run with old V1 approval files or prior consent hashes. On failure retain
state and review evidence; no automatic retry/cleanup. LIC008 stays open.
