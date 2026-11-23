# V2 retained metadata collection — 2026-10-17

Baseline:8802ac8 records the partial Prepare outcome. Next diagnostic step is
scripts/collect-license-v2-prepare-metadata.ps1, default SelfTest; Collect needs
Administrator read access. It never starts/configures services, opens CNG keys,
changes ACLs, writes protected state, takes ownership or retries Prepare.

## Bounded output

Fixed EntryEvidenceV2 root/experiment and an allowlist of14 paths. No input path,
role, key name or arbitrary command parameter. Metadata includes directory/file
kind, length, owner and SDDL; no intent/owned/envelope contents. Parent reparse
checks run before access. Denied/missing/reparse inputs produce explicit
UNAVAILABLE_OR_REFUSED observations, not inferred absence or weakened permissions.

The two exact retained JSON reports are read in bounded shared-read streams,
checked against expected schema/scope/experiment/run/role/action/plan/provenance/
assembly, then hashed from the same byte snapshot. Output includes only fixed
identity/result-context flags, not arbitrary report contents or exception text.
The original report hashes supplement the owner-pasted evidence; they do not
authenticate a report independently or turn UNKNOWN into a successful result.

Service metadata is collected only for the three exact V2 registrations. Output
is JSON on stdout; no output file is created. No elevated collector run was made
by the non-elevated agent. The owner must return the output for review.

## Verification

SelfTest PASS29:14 allowed paths,4 disallowed paths,1 positive report binding,
10 mutated binding fields rejected. Pure fixtures only, no protected access.
PowerShell parser and documentation-link checks pass. This does not test native
Guardian permissions or identify an exception that was not retained in a report.

If ownership/control/staging ACL metadata cannot explain the failure, a separate
Guardian-context diagnostic with explicit suboperation/error capture is still
required. Do not run old V1 diagnostic launchers against V2 or change installed
binary paths as part of this collection. LIC008 stays open; V1/V2 retained.

## Owner-returned collection — 2026-10-17

CollectedUtc:2026-10-17T11:03:37.2990166Z. Original report SHA256 values supplied
by the owner-run collector (not independently authenticated security evidence):

- Setup968ca8f2ad4347c40b38a9339013fd8f:
  `29cf987145b78d0306b39414ba2d0e39ac230c171a283a9e158ed3d529d4e015`
- Guardian348e5ea406acc37c1d00f75a54785489:
  `5aeb6a7a0a2a73c54997ed8d3cab3ebf6bf2daebb319c61295723e99a4619bc0`

Visible owner/DACL metadata agrees with SecureFiles.Rule. Protected intent/owned
reads were denied to the collector; this does not establish Guardian denial.
Staging-file ObjectNotFound observations likewise do not establish absence under
the Guardian token. All three services remained Stopped/Manual with PID0; exit
codes Setup0,Guardian1067,App1077. No cause is proven by this metadata.

Next: [isolated diagnostic candidate](LICENSING_GUARDIAN_SEAL_DIAGNOSTIC.md).
