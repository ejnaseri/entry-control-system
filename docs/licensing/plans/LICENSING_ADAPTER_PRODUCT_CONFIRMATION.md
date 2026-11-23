# Adapter Product direction confirmation — LIC-EV-0157

Date: 2026-10-07. Record: CHG0088 / LIC-EV-0157.
Authority: user's explicit Product-direction confirmation in this conversation.
Status: PRODUCT_DIRECTION_CONFIRMED_SECURITY_DECISION_OWNER_PENDING.

Current follow-up CHG0089/EV0158: [Project Owner assigned and role accepted](LICENSING_ADAPTER_SECURITY_OWNER_ASSIGNMENT.md).
The owner-pending statements below preserve the EV0157 checkpoint; they are now
superseded for designation only, not technical Security/adapter acceptance.

## Confirmed decisions

1. General design for the existing Windows10/11 x64 product target, with limited,
   staged validation. Current-host evidence is not a restriction to this one
   Windows installation and does not establish compatibility on all customer
   builds. The [support matrix](../../operations/WINDOWS_SUPPORT_MATRIX.md)
   remains authoritative; no expansion/removal of its build or runtime boundaries.
2. On security uncertainty, deny dependent protected operations; preserve data,
   provide understandable diagnostics and use controlled recovery. No automatic
   weaker provider, replacement key, data reset or old-state admission. This is
   a Product safety requirement, not accepted implementation/negative-test proof.
3. Project Owner retains Product decisions; explicitly designate technical
   Security decision ownership and record non-author technical approval separately.
   User is not required to personally attest algorithm correctness. Agent review
   is neither a security guarantee nor a substitute for actual tests.

User agreed to all three recommendations, but did NOT supply the name of a
technical Security decision owner or delegate that role to coordinator/reviewer.
Agreement with role separation is not role assignment. Owner NOT_ASSIGNED.
Remaining case owners are also NOT_ASSIGNED; approval of principles does not
assign fifteen test cases or accept their results.

## Effect on draft and gates

[Decision draft0.1](LICENSING_ADAPTER_ENTRY_DECISION_DRAFT.md) remains a technical
proposal. Product direction is now confirmed; exact provider/format/failure
contracts, artifact/claim bindings, residual-case placement and independent
approval are NOT accepted by this confirmation. No reviewed technical version
or digest is implicitly approved. Existing [EV0155 review](../reviews/LICENSING_ADAPTER_ENTRY_INDEPENDENT_REVIEW.md)
remains acceptance withheld. ASR-001..004 stay open with their stated requirements.

NE-002 NOT_ACCEPTED; NATIVE-ENTRY NOT_READY. All other NE gates, LIC008/Open003,
full Windows/Installer/Store/release exits remain unchanged. No customer-deployment
approval, physical test, code/key/service/ACL/DB/Installer mutation or commit.

## Next required choice

Name the technical Windows Security decision owner and explicitly state the
scope of their authority. Record their acceptance of that role; then identify
case owners, complete required contracts/evidence and submit an exact pinned
revision for independent review. Do not present an author as an independent
reviewer or infer approval from an unassigned role. No external human officer
is added as an unconditional policy requirement by this record.
