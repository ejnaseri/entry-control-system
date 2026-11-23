# Isolated pilot placement plan — 2026-10-16

Status:PROPOSED_INERT_IMPLEMENTATION_ONLY; physical execution not authorized.
Purpose: run a later new experiment without deleting or adopting retained V1.

## Fixed proposed namespace

| Target | Proposed value |
| --- | --- |
| Root | C:/ProgramData/Ecs.Lic008.EntryEvidenceV2 |
| Setup | Ecs.Lic008.EntryEvidenceV2.Setup |
| Guardian | Ecs.Lic008.EntryEvidenceV2.Guardian |
| App | Ecs.Lic008.EntryEvidenceV2.App |
| Key prefix | Ecs.Lic008.EntryEvidenceV2.TEST_ONLY. |

This is a new physical experiment, not a report schema number or product version.
No target has been created and absence has not been certified. Access denied,
lookup failure or collision must never be treated as absence. Keep all V1 roots,
services, keys, diagnostic folders, approvals and reports unchanged.

## Implementation boundary

1. Add a separate successor names override to adopted0.4; do not edit frozen
   packet names or old approval documents. No mutable command-line root/prefix.
2. Update compiled Root/Prefix, service SID derivation vectors and active review
   helper service names together. Derive all three new SIDs and independently
   cross-check them read-only. ACLs keep identical rights/owners/flags but use
   new service principals; paths and key names must resolve only to new targets.
3. Update source/build/packet bindings. Keep historical V1 diagnostics frozen;
   they must never silently become V2 mutation tools. No rename/copy/migration
   from ProgramData V1 and no use of old consent, reservation or checkpoint.
4. Test rejection of V1 paths/SIDs/reports in V2, mixed namespaces, collisions,
   incomplete lookup, wrong host/boot and duplicate/replayed stage inputs.
   Preserve schema2/role-policy tests and all physical-entry refusal gates.
5. Build a new inert kit and review its exact bytes. Only afterward consider a
   separately authorized capable kit and owner-bound host/boot/stage inputs.
   Actual preflight must prove new root/services absent; Setup key creation
   remains exact-name create-new without overwrite. Unknown means retain/stop.

## Not authorized by this plan

No service registration/start, ACL change, key creation/deletion, old-state
cleanup, Prepare retry, in-place binary replacement or Windows restart.
No expansion to production use or acceptance of the new native implementation.
Existing physical build gate stays closed during inert work. Prior v0.4 built
review does not certify a renamed/recompiled package.
