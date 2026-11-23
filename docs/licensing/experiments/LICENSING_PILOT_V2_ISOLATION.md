# Isolated V2 implementation — 2026-10-16

Status: IMPLEMENTED_INERT_ONLY. Baseline review/plan commit: ed4d100.
This records implementation, not independent review or permission to run.

## Changes

The [fixed placement plan](../plans/LICENSING_PILOT_ISOLATED_PLACEMENT_PLAN.md)
is bound by [successor0.5](../../../licensing/adapter-evidence/pilot-implementation/implementation-packet-v05.json).
Packet SHA256: 8d6b30a67a7060b1e343b1fa485c11f460698d20017bc48da597fcd67757ea30.
It inherits frozen0.4 and changes only the experiment namespace. Report schema
remains2. Root/service/key prefix now use Ecs.Lic008.EntryEvidenceV2.
Runtime, builder and review helper use the same packet pin. No arbitrary root
or namespace argument was introduced. Historical packets/diagnostics stay intact.

Windows sc.exe showsid was used read-only for Setup/Guardian/App; all three
vectors agree with managed derivation and a separate Node SHA1 derivation.
This checks name-to-SID mapping, NOT absence, registration or token behavior.
ACL rights/owners/flags and key create-new semantics were not changed.
New pinned bytes are excluded from Git newline conversion.

## Verification

- 1820 managed cases PASS (13 additional namespace checks), including old-root
  paths, old binary paths, mixed service accounts and old/wrong role SIDs.
- Preserved host/boot, replay, collision/unknown lookup and report2 refusal tests
  remain green. These are managed fixtures, not real V1-state adoption attempts.
- Successor checker:24 transitive artifact pins; historical32 owner,28 report,
  12 successor negatives and7 isolated packet mutations PASS.
- Inert app-local package repeats1820 cases and refuses native entry points.

Candidate: out/lic008-pilot-runtime-candidate-91b794dc96a14295b1e646ba2328bb17.
Self-contained provenance SHA256:
b17926811a401ddfffacb683eac3c8aa78773d0c6661b3506ae5c99110d0a30e.
Generated artifacts remain ignored, not committed.

## Remaining gate and next step

Review the exact new built kit and namespace routing, including report/owner
bindings and custody. The earlier0.4 built review does not certify these bytes.
Only then consider separately authorized capable-kit/stage preparation and
read-only live preflight. TestCapable build guard remains closed.

No service registration/start, protected ACL write, key operation, cleanup,
V1 retry/adoption or reboot was performed. V1 remains retained.
No new physical case passed; original pilot remains partial/failed (0/5 complete
accepted cases). Windows matrix/security/production acceptance remain open.
