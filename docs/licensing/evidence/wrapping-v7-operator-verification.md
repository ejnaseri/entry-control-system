# V7 operator summary and hash verification — LIC-EV-0143

Recorded: 2026-10-06. Scope: TEST_ONLY_SOFTWARE_KSP_WRAPPING_V7, version0.14.0.

## Provenance and limits

The Project Owner supplied the summary through attachment
`12cdcc4d-a8d7-4d4e-9166-e9e9e8095eaf/Pasted text.txt`, then separately ran
read-only Get-FileHash checks in elevated PowerShell and pasted the output.
Attachment SHA256: `4c1e6af01890b4f5c3867cbaa074bf34c67d2d9e4cfb759ec7296a3685138b61`.
This attachment digest is NOT the original summary digest. No original protected
JSON was copied into this repository; this Markdown records operator-supplied evidence.
The reviewer parsed the supplied JSON and checked scope/version/kit, result flags,
three service states and bounded inventories. Operator checks verify file bytes,
not current DACL hashes or an independent Security attestation. Guardian-reported
protected inventory/DACL continuity remains bounded to the successful harness.

## Summary identity and results

Experiment: `e0fe1ec7545845eb94d42883d1949570`.
Reported UTC: `2026-10-06T10:52:42.6452879Z`.
OS: Windows11 Pro21H2 x64 build22000; this is one development host, not a full matrix row.
Kit manifest SHA256: `8f2b6a599d1042d9d4285abf692f3fe73368d034bbe69aab9ef3607d3d8ecb15`.

Reported true: uninstallSimulationPassed, reinstallSimulationPassed,
hostFeasibilityPassed, sameKeyIdentityVerified, sameEnvelopeBytesVerified,
sameProtectedFileBytesVerified, sameServiceSidsVerified, retainedDaclsVerified,
ownedKeyCleanupPassed and immutableBinariesRetained.
Reported false: keyRecreationAttempted, productionUninstallTested,
productionReinstallTested, securityAccepted, productionAccepted, matrixAccepted,
interruptionPhysicallyTested and invalidStateRefusalPhysicallyTested.
ordinaryUserNotTested=true. Guardian/App/Setup are Stopped/Manual, PID0, SID type1.
The summary contains11 evidence files and5 protected file records.

## Original-file hash capture

| File | SHA256 | Operator result |
| --- | --- | --- |
| wrapping-summary-6ab84a1dfeee472db6dfb2a20ffa3315.json | `cc8d7464fedb6b20b9adeae2d0e34f1aff483b3f481b975a74a1632ef9ffb586` | Original digest captured; not independently read by reviewer |
| prepare-checkpoint.json | `655033bafa4d3d363ef78074006603995a3234c712dc5cff6a9bd26c74998929` | Matches summary |
| uninstall-checkpoint.json | `92cc111baeec627e419c56e89486e5d2ed51bb390c773fec9a6e4be5df87f418` | Matches summary |

## Eleven evidence-file byte hashes

Every row returned Match=True; no exception was reported by the Stop-on-error command.

| Relative file | SHA256 | Match |
| --- | --- | --- |
| app-reports/3d23b96045fc4fdb83c1509cc5857afe.json | `56a503cff66fda434772e93e1654edae63a18ab66ec6726b77ace760376023c4` | True |
| app-reports/f409c1ae521d49d8a7cf1195ac1408dc.json | `5eba2e701285cf1661fb8bd42c859e1c5c3c626d1c3c168400f896cebfbf6471` | True |
| guardian-reports/154d802012264459a02d3780193308fd.json | `deccb03f6b48be4a6dfffdff72c3ef7d266587935f7567a5cd0035a2caf5cc9a` | True |
| guardian-reports/610fd07bf360439887c454f6585bea58.json | `885d0d62190d720cb91ca05b5362d565b1d95112a7150598b5488099c275fa14` | True |
| guardian-reports/c1f6b7f9f407443291268cc2ba5ab27e.json | `509b3f45f2aab282f1a3901c1efb4ae490223e62db531d898d01465e8a1a22ec` | True |
| setup-reports/2bcc1cd6068f4a3abff67f0fbedbef16.json | `8ce9b44c02577aaad39540588144350ffcc7d7dc65f5ff82f3faf80e678d45cf` | True |
| setup-reports/e619236267ec4a0c874c160cd583bf5a.json | `959671953aecbe5986bec40819d4e3d66fafa175290eebb89f29571f7656dcad` | True |
| shared/app-readable-envelope.json | `a6f5eeb1aa7e9e9df8f66688c85530f5b23269173df46e787d49a2fe8e95d9b3` | True |
| shared/app-readable-hash.json | `3badee52d3c1949372eec41fb24614b32949ee0deee262f27929f19ebdcca410` | True |
| shared/control-set.json | `6c6914e0ac7aa8009a9cea53b769ac9a3e59e41de24a5970e301f3a8d55dbfc3` | True |
| shared/restricted-envelope.json | `dbeb3d2504264a683e6e4f3f8f786d74b4e87d72476727ec107251d945125fa0` | True |

## Current handoff

V7 evidence-content review and operator byte-hash reconciliation are complete.
V7 is consumed: never rerun Prepare/Uninstall/Reinstall or recreate deleted keys.
Retain reports/checkpoints/intents/binaries. This closes the V7 evidence gap only:
V4/V5 gaps, actual Installer, separate standard account, TPM/NV, physical interruption,
Windows matrix and production acceptance remain open. LIC008 stays in progress;
Open003 open, Open012 blocked. Current UI/Attendance/Backup status notes were
reconciled against accepted existing evidence, without closing broader hardening.
Next: review the unresolved native-entry dependency proposal before production
Guardian/Store work. No policy/dependency waiver is granted.
