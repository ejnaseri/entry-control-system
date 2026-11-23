# R1 restriction-query correction — 2026-10-15

Latest: [bounded re-review](RESTRICTION_LENGTH_REVIEW.md) of1e21662 is PASS_LIMITED
for implementation/managed tests. Native Guardian verification remains pending.

Review baseline c28dc4a committed first. Status: IMPLEMENTED_AND_MANAGED_TESTED;
bounded re-review pending. No Guardian run, protected writes or physical acceptance.

NativeTokens.CaptureIdentity now uses a dedicated TokenRestrictionReader for
GetTokenInformation class21 only. It allocates a four-byte buffer, performs one
query, and requires success plus returned length exactly1 or4 before reading.
Length1 reads one byte; length4 reads the full DWORD. Nonzero remains filtered;
false is obtained only from a successful supported zero-valued response. Other
lengths and failed queries throw. Memory is released in finally. No retry or
default-false branch; other token information uses the unchanged generic helper.

No schema, policy acceptance, owner permission or retained artifact is changed.
The value continues to mean TokenHasRestrictions (ever filtered), not a claim
that restricting-SID count was queried. TestCapable guard remains closed.

27 new injected-query tests exercise the exact reader (unmanaged buffers but no
native token API):10 one/four-byte values,3 nonzero high-byte DWORD values,14
failed-query/invalid-length combinations. One-byte tests prefill unused bytes
with AA, including zero followed by nonzero sentinel bytes, to detect over-read.
Failed-query tests deliberately leave the buffer untouched and must throw before
any read. Both report/controller paths retain their prior regression coverage.

Final candidate: out/lic008-pilot-runtime-candidate-32a308fdfc634c58b03febbbaa34272c.
1807 managed cases PASS (1780 prior +27), same suite rerun in self-contained kit.
Extracted archive/bound wrapper checks also PASS; complete builder exit0.
Documentation links and diff whitespace checks PASS.
The earlier native one-byte observation is not a new Guardian test. Exact changed
reader under Guardian/native lifecycle and Windows matrix remain untested.

Next: bounded re-review of this correction, then successor schema2 adoption and
binding review before any physical-enabled package. Do not rerun retained Prepare.
