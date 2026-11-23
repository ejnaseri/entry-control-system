# Bounded identity/report review — 2026-10-15

Latest R1 disposition: [correction re-review](RESTRICTION_LENGTH_REVIEW.md)
PASS_LIMITED at1e21662, implementation/injected-query scope only. Historical
CHANGES_REQUIRED finding below remains evidence, not the current R1 code status.
Schema2 adoption and physical acceptance remain outstanding.

Follow-up: [R1 correction](RESTRICTION_LENGTH_CORRECTION.md) implemented with27
reader tests;1807 managed cases PASS. Original finding below is preserved.
This implementation update is not a completed re-review or physical acceptance.

Baseline commit:18943e4. Reviewer: same coding agent/author, NOT independent human
or independent-agent security review. Status: CHANGES_REQUIRED before successor
adoption or any new physical kit. No services, keys or protected ACLs mutated.

## R1 — blocking native length assumption

NativeTokens.CaptureIdentity invokes Info(21, Marshal.ReadInt32) for
TokenHasRestrictions. Its generic Info helper requires sizing n>=4 and returned
written>=4. A read-only query of this session's current process token on this
host returned:

```text
sizingSuccess=False sizingError=122 required=1
querySuccess=True written=1 bytes=01aaaaaa
```

The four-byte output buffer was initialized to AA; only one byte was written.
Thus the current helper rejects this valid native response as TOKEN_LENGTH_REFUSED
before the policy can evaluate it. This affects Controller capture too, not only
the Guardian observation which motivated the correction. Do not read four bytes
from a one-byte result or synthesize false on failure.

Reproducer: [read-only inspection](../../../scripts/inspect-license-token-restriction-length.ps1).
It runs under the agent's ordinary account, not Guardian; the value01 says nothing
about Guardian's restriction status. It proves the local API return-size mismatch,
not Windows-wide compatibility. No protected report bytes were read.

Microsoft's [TOKEN_INFORMATION_CLASS documentation](https://learn.microsoft.com/en-us/windows/win32/api/winnt/ne-winnt-token_information_class)
describes TokenHasRestrictions as a DWORD indicating whether the token has ever
been filtered. The implementation must reconcile the observed native shape with
the documented shape explicitly. This field is not a list of restricting SIDs;
schema semantics should name/document the filtered-history observation precisely.

Required next correction: dedicated bounded parser/query for this information
class, explicit supported one-byte/four-byte representations and exact returned
length handling, no uninitialized-byte reads and rejection of other lengths or
failed queries. Add buffer/length/query-failure tests, then rerun inert regression
and repeat bounded review. Do not relax the generic helper for all token classes.

## Checks completed without another blocking finding in reviewed scope

- Required schema2 fields reject missing input; schema1 rejected, no automatic
  upgrade. Native report Build supplies actual snapshot fields explicitly.
- Shared policy is used at native capture, both controller validators and
  independent observer validation. Expected SID is additionally role/plan-bound.
- ControllerWindows compares the full snapshot; App/Child paths compare all new
  fields and process relationships. Absent group is distinct from disabled/deny-only.
- Setup retains its SYSTEM-plus-service-group requirement. Controller retains
  separate owner/elevation checks. Unknown/incomplete evidence is not acceptance.
- TestCapable builder guard remains closed; frozen successor/adoption files
  preserved. Schema2 adoption is still outstanding, not implied by successful pins.

## Verification

Reviewed built DLL6a2e8350f39a55042489969414190ab1b854bdedbb58cdd38cb8acd1c457b2ca
from inert candidate ac14708e086b4ebf9748ce5fb14ef64a reran1780 cases PASS.
Frozen successor14 pins/32 negative checks PASS. These tests did not exercise
the newly added native length query, hence did not expose R1. No final security,
production, Windows matrix or physical-case acceptance is granted.
