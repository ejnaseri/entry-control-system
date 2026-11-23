# Pilot owner connection: bounded author source review

Date: 2026-10-12. CHG0141 / LIC-EV-0210.
Status: AUTHOR_REVIEW_WITH_GATED_CORRECTION; NOT_INDEPENDENT_ACCEPTANCE.

Previous owner-connection source/docs committed f4f8af0 before this review.
Owner remains the sole product/security decision owner. This review is by the
implementer, not a second person, external auditor or independent agent.
No actual owner approval, role execution or acceptance is created here.

## Scope and exact source

Reviewed OwnerAdmission, owner diagnostic Main/wrapper, public bootstrap,
ordered dispatch, NativeTokens capture and SecureFiles closed path rules.
Corrected candidate source SHA256 (not a production approval):

| File | SHA256 |
| --- | --- |
| PlanAdmission.cs | 083b2b013552c2316f8477869b61b0b2814e4e6d7b0ba4e0d7044e282b3aee29 |
| NativeTokens.cs | 20721b38421d1fb1da23d4f66b659fbd43a349b4d6ca2669efbd08ae63937e66 |
| BootstrapAdmission.cs | eb2f70e1bb09bd9f8655cd2fb871aab1d3996ed726b917cdf74347f4e05a2c0a |
| ControllerWindows.cs | 151350f3e63937fbaa728e2292533577fe48b8f90d7d5dba4ba3939164c3828c |

## Findings and disposition

1. OWNER-R01: stored SID/hash does not authenticate executor or record issuer.
   f4f8af0 accepts record correlation, while NativeTokens.Capture(Controller)
   checked elevation/default token owner but did not match TokenUser to the
   decision OwnerSid. Another elevated account could satisfy those old checks.
   Candidate correction calls VerifyLiveControllerOwner before bootstrap
   reservation, ordered-stage reservation and each ordered service action.
   Capture rejects impersonation and reads the actual primary token;
   MatchControllerOwner requires exact expected user SID, Administrators default
   owner, primary type1, elevation1 and controller empty service/attributes.
   Eleven managed positive/negative cases pass. SOURCE_CORRECTED / NATIVE_NOT_RUN.
   This authenticates the current executor only if actually called; it does NOT
   prove who authored a historical decision or make CLI-supplied pins trusted.
   Owner authority producer/explicit local confirmation remains OPEN.

2. OWNER-R02: consumption is process-local. Static HashSet and same-object phase
   guards resist repeated use in one process, but disappear on restart. Existing
   root collisions, report CreateNew and successful checkpoints are useful
   additional guards, not a complete consumption journal: a failure before the
   first report/checkpoint can leave no completed stage evidence. OPEN. Do not
   enable Main based on this HashSet alone. Persistent reservation must precede
   service/key operations and be stage-wide, not just per decision ID; a newly
   issued ID cannot bypass partial-stage state.

3. OWNER-R03: current allowlist has no consumption journal. SecureFiles.Rule
   allows only run-admission/checkpoints/final-summary in controller and rejects
   extra names. Successor packet0.2 inherits unchanged physical path/ACL rules.
   Adding new records or using a success checkpoint as an intent silently would
   change that contract. OPEN_CONTRACT_DEPENDENCY; propose a narrow successor
   before implementation. Frozen spec/packet/review/adoption bytes unchanged.

4. OWNER-R04: CompleteBootstrap accepts internal ServiceReceipt DTOs. Actual
   caller currently supplies only RegisterAllNew native readbacks; Main has no
   route. Those DTOs alone are not an unforgeable proof for arbitrary future
   callers. Future activation review must preserve direct validated native
   provenance and prevent a generic caller from fabricating bootstrap completion.
   OPEN_ACTIVATION_DEPENDENCY, not evidence of an enabled external bypass.

5. Owner expiry is local wall clock, maximum24h candidate bound. It is not secure
   product time, tamper-proof approval history or a fleet compatibility test.
   Unknown/partial state must retain and refuse; no cleanup/retry/clock fallback.

## Outcome and bounded next step

Author review complete for this source slice; activation NOT_READY. Candidate
executor match corrected and managed-tested; issuer authority, durable replay
protection, contract adoption and native confirmation remain open. Diagnostic
ValidateOwnerInput still reports ownerIdentityAuthenticated=false and performs
no token/service/key call. No fabricated security acceptance.

Prepare the [owner-authority/consumption proposal](../plans/LICENSING_PILOT_OWNER_AUTHORITY_PLAN.md),
then review/adopt/bind its exact changes before adding protected journal paths.
Physical0/5; LIC008/REM/NE/native/security/production gates unchanged.
Final build evidence is in [foundation checkpoints](../experiments/LICENSING_PILOT_FOUNDATION.md).
