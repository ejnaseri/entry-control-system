# Report successor0.4 built-kit review — 2026-10-16

Baseline:cf65204. Reviewer: same coding agent/author, not independent security
review. Verdict:PASS_LIMITED_INERT_CUSTODY; NOT_READY_FOR_PHYSICAL_PLACEMENT.
No service start/configuration, key operation or protected mutation performed.

## Exact candidate

out/lic008-pilot-runtime-candidate-3c7e06d802184a9da29dc63fe8fdd3ee

| Artifact | SHA256 |
| --- | --- |
| self-contained-provenance.json | 7c9a40a3600039161f91e592b70f10a39734e3999a4200aca3f802a595731ccf |
| pilot-kit.zip | 83186d8c43a2688902b362c1d9113c2969a5b33b52fb7fd1db6b4d27ae166bf5 |
| kit/kit-manifest.json | ea7bea05d59ca308f80f6c7945ce04f03f988a8389b1a5b0f9f8b9422395e357 |
| loaded pilot DLL | 485f0570f8bbd5c4546d9e7c59a5abea6693456dc4e51d5931475c6f1974b0f5 |
| compiled successor packet | c25920687086f0ade2d90486aa02556212a5172e12b423df02ee0650ca69bd7b |

37 source-manifest entries matched current files;247 kit inventory entries matched
their hashes/lengths. Archive and manifest hashes match delivery provenance.
The pinned kit's Run-Pilot.ps1 SelfTest in Package mode passed1807 cases and
reported System.Private.CoreLib from that package, expected successor0.4,
physicalTested=false/securityAccepted=false/productionAccepted=false.
Same cases rerun, not1807 additional unique tests. Current audit did not extract
the archive again; its hash matches the previously tested/extracted archive.
Source binding checker:22 transitive references and12 successor negatives PASS;
preserved32 owner-successor and28 draft negatives PASS. Physical capability false.

## Placement blocker (expected fail-closed behavior)

Read-only CIM still shows exact EntryEvidenceV1.Setup/Guardian/App registrations,
all Stopped/Manual, pointing into the original EntryEvidenceV1 bin directory.
New package still compiles Program.Root/Prefix as EntryEvidenceV1. Bootstrap
AdmitSuccessor requires root and all three registrations absent. Therefore this
candidate cannot be treated as a fresh physical placement on this host. No
elevated native collision probe was run, and existing key contents were not read.
Known registrations alone are sufficient to rule out clean same-name placement.

The previous partial Setup created keys according to the retained evidence.
Do not delete or reuse these resources to make a test pass. Fresh experiment ID
alone changes key names but does not remove root/service-name collisions.

## Next route

Use a separate fixed, compiled experiment namespace, not a CLI-supplied arbitrary
root and not a resume mode. See [isolation plan](../plans/LICENSING_PILOT_ISOLATED_PLACEMENT_PLAN.md).
The new namespace changes service-derived SIDs, ACL subjects, names and hash
bindings, so this current kit review cannot authorize that future binary.
Retain the old namespace unchanged. No TestCapable enablement or physical stage
permission follows from this review. Native Guardian with new identity logic,
Windows matrix and full physical cases remain unverified/accepted0/5.
