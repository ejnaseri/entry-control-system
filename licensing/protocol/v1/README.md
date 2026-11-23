# Entry Control System Licensing Protocol v1

Status: frozen wire contract for `LIC-6.2-001`.

This package defines the ten signed Licensing protocol v1 objects. The normative
product and security policy remains
[`docs/LICENSING_DESIGN.md`](../../../docs/LICENSING_DESIGN.md). The machine-readable
registry, the CDDL files and the semantic rules below are one contract; an
implementation must satisfy all three. A CDDL match alone is never sufficient.

This package contains schemas and descriptor-only negative cases. It contains no
production key, test private key, signed token, golden vector, parser, signer or
runtime authorization implementation. Positive and byte-level negative golden vectors
belong to `LIC-6.2-002`.

## Package inventory

- `protocol-registry.json` freezes algorithms, byte limits, endpoints, carriers,
  lifetimes, signer purposes, reason codes and the licensable Feature registry.
- `schemas/*.cddl` contains one self-contained root schema for each signed object and
  closed schemas for the non-authoritative outer carriers.
- `corpus/malformed-cases.json` describes malformed, cryptographic, trust, binding,
  lifecycle, replay and rollback failures.
- `corpus/cross-type-cases.json` explicitly describes every ordered mismatch among the
  ten signed object types.
- `protocol-manifest.json` and `protocol-manifest.sha256` close the package over exact
  paths, sizes and SHA-256 digests. They exclude only themselves.

## Exact signed-object profile

Every signed object is exactly this tagged, embedded `COSE_Sign1` shape:

```cddl
#6.18([
  protected: bstr .cbor {
    1: -7,
    3: exact-media-type,
    4: bstr .size 32
  },
  unprotected: {},
  payload: bstr .cbor exact-closed-payload-map,
  signature: bstr .size 64
])
```

The Sig_structure external AAD is the empty byte string. Detached payloads and every
additional protected or unprotected header are forbidden. Algorithm `-7` means ES256:
SHA-256 with P-256 ECDSA. The signature is the raw, fixed-width 32-byte `R` followed by
32-byte `S`; both scalars must be non-zero and in range, and `S` must be low-S.

The complete tagged object, protected map and payload use RFC 8949 Core Deterministic
Encoding. Reject before authorization: a missing/wrong tag; trailing data; indefinite
items; non-shortest integers, lengths or tags; floats; `null`; duplicate map keys;
unknown fields; malformed UTF-8; non-NFC display text; forbidden optional placeholders;
or a map whose encoded keys are not in deterministic bytewise order. All payload map
keys are lower-camel-case text. Optional values are omitted, never encoded as `null`.

The protected `kid`, payload `keyId`, accepted key-registry entry and permitted signer
purpose must identify the same 32-byte SHA-256 key ID. The protected media type,
payload `tokenType`, selected schema and calling API/file workflow must all identify the
same type. No alias, extension or caller-selected algorithm can alter that decision.

## Primitive and comparison rules

- Opaque IDs are 16-byte byte strings. Text UUIDs are forbidden.
- Hashes, nonces and key IDs are raw 32-byte byte strings, never hex text.
- Installation public keys are structurally valid, canonical 91-byte RFC 5480 DER
  SubjectPublicKeyInfo values for `id-ecPublicKey` / `prime256v1` and an uncompressed
  P-256 point. A length match without structural and curve validation is insufficient.
- Timestamps are unsigned UTC Unix seconds in `0..253402300799`. Validity windows are
  half-open: `[notBefore, notAfter)`.
- Counters are unsigned integers in `0..9223372036854775807`; generation/revision
  counters that represent an issued object begin at one.
- Display strings are NFC UTF-8, at most 256 encoded bytes, and never authorize.
- Feature arrays are strictly ASCII-code-point sorted and duplicate-free. Denylist
  entries and Trust-bundle Delegations are sorted by raw `delegatedKeyId` using
  unsigned-byte lexicographic order and reject duplicate IDs; display/map encoding does
  not define that order.
- Hash references named `requestHash`, `leaseRequestHash`, token hashes or state hashes
  are SHA-256 over the complete tagged deterministic COSE bytes. The three Build claims
  are the raw digests defined by Phase 6.1 instead.
- `minimumProductVersion` is a canonical SemVer 2 version and is inclusive;
  `maximumMajorVersion` is an inclusive unsigned major. Compare SemVer precedence,
  ignore build metadata for precedence and never compare versions lexically.

CDDL cannot prove deterministic source bytes, scalar validity/low-S, SPKI structure,
Unicode normalization, sorted uniqueness, hash equality, time arithmetic, monotonic
state or key purpose. Those checks are mandatory semantic validation.

## Signed object registry

| Order | Token type | Signer purpose | Complete COSE maximum | Envelope/import rule |
| ---: | --- | --- | ---: | --- |
| 1 | `activation-request` | `INSTALLATION_DEVICE` | 131072 B | `notAfter-issuedAt <= 2592000s` |
| 2 | `lease-request` | `INSTALLATION_DEVICE` | 8192 B | one-time Vendor challenge, at most 300s |
| 3 | `key-delegation` | `PROD_ROOT` | 8192 B | at most 158112000s |
| 4 | `key-denylist` | `PROD_ROOT` | 262144 B | import window at most 31622400s; accepted facts persist |
| 5 | `entitlement` | `OFFLINE_ENTITLEMENT` | 16384 B | term at most 31622400s; envelope at most 35424000s |
| 6 | `lease` | `ONLINE_LEASE` | 16384 B | envelope at most 2592000s |
| 7 | `offline-control` | `OFFLINE_CONTROL` | 8192 B | envelope at most 2592000s |
| 8 | `reactivation-authorization` | `OFFLINE_CONTROL` | 16384 B | envelope at most 604800s |
| 9 | `recovery` | `RECOVERY` | 16384 B | envelope at most 86400s |
| 10 | `time-correction` | `RECOVERY` | 8192 B | envelope at most 86400s |

The exact media type for each row is
`application/vnd.entry-control.<token-type>+cbor;v=1`; no parameters, casing variants
or aliases are accepted beyond those exact bytes recorded in the registry.

## Carriers and endpoints

An outer file or HTTPS response only transports independently signed objects. It never
authorizes, changes their signature scope or supplies a missing claim.

| Carrier | Exact content |
| --- | --- |
| `.ecsreq` | one `activation-request` COSE object |
| `.ecslic` | one `entitlement` COSE object |
| `.ecsctl` | one `offline-control` or one `reactivation-authorization` COSE object |
| `.ecsrec` | one `recovery` or one `time-correction` COSE object |
| `.ecstrust` | one closed deterministic trust-bundle carrier, at most 1048576 B |
| Lease HTTPS request | raw `lease-request` COSE bytes with matching Content-Type |
| Lease HTTPS response | one closed deterministic response carrier, at most 524288 B |

The only Vendor challenge endpoint is `POST /v1/licensing/lease-challenges`, whose
response Content-Type is exactly
`application/vnd.entry-control.lease-challenge+cbor;v=1`. The only signed Lease
endpoint is `POST /v1/licensing/leases`; its request Content-Type is the exact protected
Lease-request media type and its carrier response Content-Type is exactly
`application/vnd.entry-control.lease-response+cbor;v=1`. Paths compare as exact ASCII
bytes; authority, query, fragment, trailing slash, percent-normalized spelling and
aliases are forbidden. TLS 0-RTT is forbidden for these mutations. `.ecstrust` uses
exact media type `application/vnd.entry-control.trust-bundle+cbor;v=1` when a media
type is carried.

The trust bundle contains Root-signed Delegations and one cumulative Root-signed
Denylist. A Lease response normally carries one Lease and may also carry independently
signed Control or trust updates. Online Time Recovery requires its matching same-boot
Lease, permits only optional independently authorized Control or Reactivation objects alongside it,
and forbids/rejects transported trust, Delegation, or Denylist updates.

File extensions are picker hints. Import selects a verifier from the signed protected
media type and rejects content not allowed by that workflow. Reactivation authorization
and its new Entitlement may be staged in either order, but neither grants operation;
their validation, one-time consumption and new-lineage promotion are atomic.

## Mandatory semantic validation

Validation order is: complete-object byte cap; strict CBOR/COSE shape and deterministic
encoding; exact domain/schema; ES256 scalar and signature verification; trusted
Root/delegation/environment/purpose/denylist; claim equality and arithmetic; then
monotonic lifecycle/state transition. Any failure changes no authoritative state and
consumes no outstanding request.

Every Vendor-signed object has a positive structural window
`notBefore < notAfter`, requires `issuedAt < notAfter`, and calculates its envelope as
`notAfter - min(issuedAt, notBefore)`. Ordinary admission requires
`issuedAt <= trustedNow + 300` and `trustedNow < notAfter`; an object before
`notBefore` may only be staged and cannot authorize. A delegated token additionally
requires both its validity window and `issuedAt` inside the accepted Delegation:
`delegation.notBefore <= token.notBefore < token.notAfter <= delegation.notAfter` and
`delegation.notBefore <= token.issuedAt < delegation.notAfter`.

An activation request instead requires `issuedAt < notAfter`,
`notAfter-issuedAt <= 2592000`, `issuedAt <= vendorUtc+300` and
`vendorUtc < notAfter`. Time Correction still requires a positive structural window,
but suspect local wall time alone cannot reject it: `issuedAt` and `correctedUtc` must
not precede the sealed pre-incident high-water, `issuedAt <= correctedUtc+300`, and the
current incident/same-boot monotonic proof must pass. Online Time Recovery uses signed
`serverTime` as its validation reference and requires `issuedAt=serverTime`.

### Requests and proof of possession

- `activation-request`: `deviceKeyId = SHA-256(devicePublicKey)`, and that value equals
  both payload `keyId` and protected `kid`. `0 < notAfter-issuedAt <= 2592000`.
  Purpose-specific fields are required only in their exact union branch. TPM evidence
  is required only for `TPM_ATTESTED`. Its `contextHash` is SHA-256 of the exact RFC 8949
  Core Deterministic CBOR array below (no tag and no other field):

  ```text
  [
    "ENTRY_CONTROL_SYSTEM:LICENSE:TPM_ATTESTATION_CONTEXT:V1",
    requestId, requestNonce, installationId, deviceKeyId,
    versionIdentitySha256, buildIdentitySha256, buildManifestSha256
  ]
  ```

  The first item is that exact UTF-8 text; remaining items are their schema-sized raw
  byte strings in the shown order. Failed context or TPM verification is rejection,
  never silent downgrade.
- `lease-request`: its one-time challenge/request ID and nonce must be outstanding and
  byte-identical on retry. Signed method/path must be the exact Lease endpoint. The
  parent, Control tuple, Secure-State generation and exact current Build hashes must
  match registered state. `TIME_RECOVERY` also binds the current incident and sealed
  pre-incident clock high-water. `bindingRecoveryTokenId` is present exactly while a
  consumed durable Rebind override is active and must match both Secure State and the
  returned Lease; it is forbidden otherwise.

### Exact request-to-response purposes

The outstanding request purpose is an authorization-domain input, not descriptive
text. A request-bound primary response outside this table rejects even if its signature
and standalone schema are valid:

| Request | Only permitted response | Required binding |
| --- | --- | --- |
| activation `ACTIVATE` | Entitlement | generation 1; no predecessor/reactivation ID; request/product/Edition/installation/device equal |
| activation `RENEW` | Entitlement | same lineage/device; generation = request Entitlement generation + 1; `previousTokenId = request.entitlementTokenId` |
| activation `CONTROL` | Offline Control | `origin=REQUEST_BOUND`; request ID/hash, target, `controlAction`, effective time and reason equal; revision greater than request high-water |
| activation `RECOVER` | Recovery | transition is only `CLEAR_TAMPER` or `REPAIR_SECURE_STATE`; incident/current Entitlement/Control equal; expected state = request state and new state = expected + 1 |
| activation `REBIND` | Recovery | transition exactly `REBIND_DEVICE`; old key equals request old key, new key equals request device key and new assurance equals request binding kind; state advances one |
| activation `REACTIVATE` | Reactivation Authorization + Entitlement | exact revoked/tombstone/request/device bindings; matching new lineage; authorization ID referenced by generation-1 Entitlement; both consumed/promoted atomically |
| activation `TIME_CORRECT` | Time Correction | exact incident/request/device; expected state = request state, new state = expected + 1 and correction revision = request high-water + 1 |
| Lease `CHECK_IN` | Lease | exact request ID/hash, device/parent/build and monotonic Lease/Control bindings |
| Lease `TIME_RECOVERY` | Lease | all CHECK_IN bindings plus current incident/high-water and same-boot 300-second path |

Every response type that carries a request hash uses SHA-256 of the complete exact
tagged request COSE bytes and repeats its request ID. The `RENEW` request carries one
current `entitlementTokenId`; the successor derives `previousTokenId` from it, so two
redundant predecessor IDs cannot disagree.

The Lease response carrier may also transport asynchronous, independently signed
objects that do not claim the current Lease request hash. For ordinary `CHECK_IN`, it
may carry Root-signed Delegation/Denylist updates, Vendor-initiated or previously
request-bound Offline Control, and a previously request-bound Reactivation Authorization;
a transition-only Control/Reactivation carrier may omit the primary Lease but cannot
substitute for one or authorize operation by itself. Its outer
`requestId` is correlation only and never converts an asynchronous object into a
request-bound response. For `TIME_RECOVERY`, a matching Lease is mandatory, a
Control/Reactivation object may accompany it, and every Delegation/Denylist/trust bundle
is forbidden on that bootstrap path. No asynchronous object can widen or replace the
primary purpose mapping.

### Root trust objects

- `key-delegation`: the Root signer/environment and purpose are exact;
  `delegatedKeyId = SHA-256(delegatedPublicKey)`. Serial increases per
  Root/environment; equal serial is accepted only for the byte-identical object. A
  delegated ceiling can only restrict the protocol maximum for its purpose.
- `key-denylist`: revision one has no predecessor; later revisions bind the previous
  token ID/hash. Entries are sorted by raw `delegatedKeyId` using unsigned-byte
  lexicographic order and are unique. A higher revision is a strict cumulative
  superset with every prior entry unchanged; lower revision, removal, replacement,
  delayed effective time or altered reason is rejected. An equal revision is only an
  exact retry. Once accepted, a denial and revision high-water persist indefinitely;
  expiry closes import freshness and never restores a denied key.

### Commercial and online authority

- `entitlement`: `notBefore <= termStartsAt < termEndsAt`, business term is at most
  31622400s, `warningStartsAt = termEndsAt-warningLeadSeconds`,
  `graceUntil = termEndsAt+graceSeconds`, warning cannot precede effective start, and
  `graceUntil <= notAfter`. The envelope is at most 35424000s and cannot outlive its
  Delegation. Initial and reactivated lineages start at generation one without a
  predecessor; ordinary renewal is exactly prior generation plus one with the exact
  predecessor. Reactivation additionally binds its one-time authorization. Hybrid mode
  alone carries cadence/allowance/RTT and requires
  `offlineAllowanceSeconds >= checkCadenceSeconds + 300`.
- Effective Features are always the intersection of the signed list, Edition allowlist,
  physically shipped artifact, server code-ready registry and optional external flag.
  Unknown, duplicate, unsorted or Edition-disallowed claims reject the object.
  `GENERIC_DEVICE_PUSH` and `ICLOCK_ADMS` are never license-activatable.
- `lease`: it can only restrict its exact Hybrid Entitlement parent. Require
  `issuedAt = serverTime`, `notBefore <= serverTime < offlineUntil <= notAfter`,
  `notAfter <= entitlement.notAfter` and envelope at most 2592000s. Require exactly
  `offlineUntil = min(serverTime + parent.offlineAllowanceSeconds,
  entitlement.notAfter, entitlement.graceUntil)`; an issuer cannot shorten it for any
  other reason. Operational issuance requires `offlineUntil-serverTime > 300`, and the
  installation computes `nextCheckAt = min(serverTime+checkCadenceSeconds,
  offlineUntil-300)`. Revision increases except exact retry. The request ID/hash,
  current Build hashes and Control tuple must match. `ONLINE_LEASE` cannot originate
  terminal Revoke.

### Control, reactivation and repair

- The sole initial Control tuple is exactly `controlRevision=0`,
  `controlState=OPERATIONAL`, `controlEffectiveAt=0`, and
  `controlReasonCode=0 (NONE)`. Every positive revision requires reason `1..5`; reason
  zero, a non-operational state, or a nonzero effective time at revision zero is
  structurally rejected. Activation requests carry the reduced current snapshot and
  likewise require revision zero to be `OPERATIONAL`; every other state requires a
  positive revision.
- `offline-control`: revision strictly increases except exact retry; target lineage,
  action and closed reason code match, and the effective time satisfies exact
  `notBefore <= effectiveAt < notAfter`. `origin=VENDOR_INITIATED`
  forbids request ID/hash and supports remote or operator-originated Control.
  `origin=REQUEST_BOUND` requires both and must bind an exact `CONTROL` activation
  request whose target/action/effective time/reason match. `UNSUSPEND` cannot reverse
  terminal Revoke. Accepted activation-global Control state survives token expiry,
  Entitlement replacement and legitimate device rebind.
- `reactivation-authorization`: binds the terminal tombstone/final Revoke, incident,
  request, current installation/device and exact new lineage. It is consumed once and
  permanently tombstoned atomically with a matching generation-one Entitlement whose
  Features do not exceed `maximumFeatures`.
- `recovery`: `newStateGeneration = expectedStateGeneration+1`; the current incident,
  Entitlement, Control high-water and Feature ceiling must match. Exactly one closed
  transition is allowed: `CLEAR_TAMPER`, `REPAIR_SECURE_STATE` or `REBIND_DEVICE`.
  Recovery cannot target terminal Revoke, extend commercial/time bounds, widen
  Features, change Edition/mode or lower any high-water. Rebind creates a durable signed
  binding override; future Leases reference its token ID until a successor Entitlement
  directly binds the new key.
- `time-correction`: state generation and correction revision each advance exactly one,
  except byte-identical retry. It binds the current incident/device and never changes
  commercial, Control, Feature or device authority. `issuedAt` and `correctedUtc` cannot
  be below sealed pre-incident high-water. Suspect wall time alone cannot admit or
  reject it; current same-boot monotonic evidence is required. Online Time Recovery must
  complete in the same boot within 300 monotonic seconds.

## Verification

Run with the exact root Node version:

```powershell
npm.cmd run test:license-protocol-v1
```

The focused test validates strict registry values, schema/header/domain inventory,
corpus coverage, all 90 cross-type pairs, package closure, prohibited key/binary
material and documentation linkage. It does not claim cryptographic parser or runtime
License behavior; those begin with later `LIC-6.2-*` items.
