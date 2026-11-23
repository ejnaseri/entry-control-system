# Protocol v1 negative corpus

This directory contains descriptor-only negative cases for the ten signed Entry Control
System Licensing protocol v1 object types. It intentionally contains no signed golden
blob, private key, production identifier, customer entitlement, Recovery token or
executable fixture.

A test harness must begin with a valid, visibly non-production in-memory fixture for the
named `types`, apply exactly the described `mutation`, then assert the complete
`expected` outcome. Descriptors are data, never instructions to relax the exact CDDL,
COSE or lifecycle contract.

## Files

- `malformed-cases.json` contains 224 malformed, cryptographic,
  binding, lifecycle, replay and rollback descriptors.
- `cross-type-cases.json` explicitly contains all 90 ordered
  source-to-target mismatches for the ten signed types.

Every malformed corpus case requires rejection without authoritative state mutation or
request consumption. A harness may report a more specific internal diagnostic, but it
must map it to the stable `errorCode` in the descriptor.

## Descriptor contract

- `types` identifies every signed type to which a malformed mutation applies.
- `mutation.operation` names the single invalid transformation; the remaining keys are
  declarative parameters.
- `expected.stage` is the latest stage the invalid object may reach:
  `PRE_DECODE`, `CBOR_PARSE`, `COSE_PARSE`, `DOMAIN`, `SCHEMA`,
  `SIGNATURE`, `TRUST`, `CLAIMS` or `STATE`.
- `authoritativeStateChanged=false` and `requestConsumed=false` are mandatory.
- Cross-type cases preserve the complete source COSE bytes and ask the target verifier
  to process them. Protected media type, payload token type and target contract must
  independently reject the object.

## Admission and isolation rules

The descriptor-only erratum approved in `LIC-CHG-0011` preserves all 224 cases
and expands to 744 case/type pairs. The four generic registry-signer cases for
unknown key, wrong purpose, wrong environment and SPKI collision apply to the
nine registered-key types, not `activation-request`: that request proves possession
using its embedded canonical device public key and matching derived IDs. Its
signature, SPKI and device-key mismatch cases remain mandatory. A passing request
preflight never issues a License or authorizes operation. Recovery's explicit
wrong-type case supplies text; the separate negative-counter case supplies a
negative integer and continues to require `COUNTER_OUT_OF_RANGE`.

Inputs are length-checked before allocation-heavy decoding. The per-type byte cap in
`malformed-cases.json` applies to the complete tagged COSE_Sign1 bytes. The parser then
requires CBOR tag 18, an embedded payload, empty external AAD, exact protected headers,
an empty unprotected map, deterministic CBOR, ES256 low-S verification, exact schema and
finally lifecycle/state checks. Failure at any earlier stage must prevent every later
side effect.

The same descriptor IDs and decisions must be exercised by the Vendor implementation,
the portable/Node verifier and the future .NET Guardian verifier. Test implementations
may generate signed fixtures only with a clearly marked test root that production never
trusts.

## Local validation

From the repository root:

```powershell
node -e "const fs=require('fs'); for (const p of ['licensing/protocol/v1/corpus/malformed-cases.json','licensing/protocol/v1/corpus/cross-type-cases.json']) JSON.parse(fs.readFileSync(p,'utf8'));"
```

Coverage validation must additionally prove:

- exactly ten distinct registered signed types;
- each type has explicit `missing-required`, `unknown-field`, `wrong-type` and
  `oversize` cases;
- exactly 90 unique ordered cross-type pairs, with no self-pair.
