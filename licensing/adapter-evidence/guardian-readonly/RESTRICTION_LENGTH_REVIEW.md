# R1 bounded correction re-review — 2026-10-15

Baseline:1e21662. Result:PASS_LIMITED for the R1 code/managed-test correction.
Reviewer: same author/coding agent; not independent human/agent security review.
No new blocking finding in this narrow diff. This is not schema2 adoption,
physical compatibility, Guardian success or security/production acceptance.

## Inspected

- CaptureIdentity routes only information class21 through the new reader.
  Other token-class size checks are unchanged. Role identity policy unchanged.
- Four bytes are allocated. The query result and exact returned length1/4 are
  checked before the reader selects ReadByte or ReadInt32. Short responses never
  cause a DWORD read; larger or unsupported lengths never reach a read.
- Failure is an exception, never a default-false result. There is one query,
  no retry. Allocation is freed in finally on success, rejection and exception.
- DWORD nonzero semantics preserve high bytes and sign-bit values. One-byte
  zero ignores the three unused sentinel bytes as required.
- Both local capture and independent process-token capture share CaptureIdentity,
  so this correction reaches both paths without duplicated parsing.
- Generic token reader, report schema2 fields and TestCapable refusal unchanged.

## Verified

- Candidate32a308fdfc634c58b03febbbaa34272c: all30 source-manifest entries match
  current workspace bytes after commit. Thus re-run tests match reviewed source.
- DLL SHA256:f75f74dd5c75cde9df2474c12fa7a1ed8fc79d37b453ceeac93ed34166c77e51.
- SelfTest rerun:1807 PASS, including27 reader cases. These are the same cases,
  not additional unique tests. Actual native token API is not called by them.
- Frozen successor14 pins/32 negatives PASS: preservation only, not v2 adoption.
- No service startup/configuration, protected write, key operation or cleanup.

## Disposition / next step

R1 is addressed for implementation and injected-query verification. Native
execution of the changed reader under Guardian and the Windows target matrix
remains unverified. Original physical pilot remains PARTIAL/FAILED, accepted0/5.

Next prepare the explicit schema2 successor contract/adoption and hash bindings:
42 report fields, three required evidence fields, exact filtered-history semantics,
role-specific policy and schema1 refusal. Preserve frozen schema1 artifacts;
do not overwrite their contracts or claim their existing approvals cover schema2.
Keep TestCapable blocked until that successor is reviewed/authorized. No retained
Prepare retry or in-place binary replacement is authorized by this review.
