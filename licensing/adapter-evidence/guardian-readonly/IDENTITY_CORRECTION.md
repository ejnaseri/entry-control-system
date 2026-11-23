# Service identity correction candidate — 2026-10-15

Status: PURE_CANDIDATE_TESTED, NOT_RUNTIME_INTEGRATED, NOT_PHYSICALLY_ACCEPTED.

Superseded implementation status: [inert runtime integration](IDENTITY_INTEGRATION.md)
now connects the candidate across capture/reports/observers/controllers. The
original pure candidate and historical boundaries below remain as design history.

## Evidence and diagnosis

Owner token-detail output: Win32Exit1066 / ServiceSpecificExit20024, original
path restored. Prior read-only CIM confirmed the same stopped state/path/result.
20024 = 20000 + 8 + 16: expected SID absent from TokenGroups, so group enabled
is also false. User and owner matched expected Guardian SID and token was primary.
This does not mean two independent identity failures. No key checks were run.
Protected journals have not been read by the unelevated agent.

The original NativeTokens.CaptureIdentity conflates an absent group with an
existing disabled group by returning attributes0 for either, and always requires
the service SID to be an enabled group. StageController.ValidateSingle and
Validate repeat the latter assumption. Changing only CaptureIdentity would leave
reports rejected and could accidentally weaken evidence semantics.

Microsoft documents separate token user and group information:
[Access tokens](https://learn.microsoft.com/en-us/windows/win32/secauthz/access-tokens),
[TOKEN_GROUPS](https://learn.microsoft.com/en-us/windows/win32/api/winnt/ns-winnt-token_groups).
These references define the fields/flags; this host's absence observation is
local evidence, not a claim that every Windows virtual account has the same shape.

## Candidate rule

[Pure classifier](ServiceIdentityCandidate.cs), not used by any runtime:

- Guardian/App/actual Child: expected service SID must be independently bound
  to the configured role (Child binds to App), with exact user/owner equality and
  primary token. Completed native queries, no impersonation, no restricted token.
- If matching group count is zero, attributes must be zero. Do not fabricate
  ENABLED attributes or report a group that was not observed.
- If matching group count is one, require enabled and not deny-only.
- Missing, disabled, deny-only and duplicate groups are distinct facts; duplicates
  rejected. Wrong user cannot be rescued by group membership.
- Setup remains LocalSystem user/owner and requires one enabled, non-deny-only
  service group. Controller's separate owner/elevation contract is unchanged.
- Query failure/unknown observation is rejected, never defaulted to absent.

The restricted-token exclusion is conservative candidate policy. The20024 probe
did not measure restriction state; no acceptance of that actual token is inferred.

## Test result

`scripts/test-license-service-identity-candidate.ps1`:660 pure cases PASS:
640 role/count/attribute/user/owner/type combinations,12 query/impersonation/
restriction refusals,4 invalid SID and4 invalid role refusals. Native collection,
report round-trip, actual Child and physical execution remain untested here.
No native operations, service configuration, ACL/key writes or existing source
manifest changes are made by these tests. Original runtime sources are unchanged.

## Required integration (next bounded step)

1. Add explicit required group count/presence and restriction/query evidence to
   token snapshots and a versioned successor report contract. Missing fields in
   older reports must not silently default to count0. Never rewrite old evidence.
2. Use one policy from both current-token and independently observed process-token
   paths. Validate the expected SID against plan/registered role, not self-report.
3. Carry raw observations through ReportEmitter, RoleActions and ProcessObserver;
   update both controller admission paths and App/Child comparisons. Include
   negative report tampering, missing-field and observation mismatch tests.
4. Compile/test a new inert candidate. Review protocol/schema compatibility and
   all successor hash bindings before a new executable package. No in-place DLL
   replacement in the partially completed retained experiment and no Prepare retry.

This document is a bounded correction proposal, not a change to frozen adopted
protocol bytes. Full pilot acceptance remains0/5; security/production false.
