# Licensing protocol v1 golden vectors

Status: `LIC-6.2-002` complete. This directory is non-production test
material. Nothing under `licensing/vectors/` is a production issuer, trust store,
parser, verifier or authorization implementation.

All fixture keys use public, domain-separated `TEST_ONLY_DO_NOT_TRUST` derivation
labels. Their private scalars are intentionally reproducible and therefore provide
no secrecy. Production/customer modules must never import or trust this directory.

The package is pinned to protocol manifest
`512534732dce759da424ba0e8d8838c3d9c294e3faa02a4017212ce482523eab`.
The fixture issuer uses RFC 8949 Core Deterministic CBOR, tagged embedded
`COSE_Sign1`, and deterministic RFC 6979 low-S ES256 only to make regeneration
byte-identical. RFC 6979 here is not a production signing requirement.

Closed package layout:

- `vectors-index.json`: hashes, signer metadata and expected decisions.
- `fixtures/positive/*.cbor`: 35 signed-object and 6 carrier fixtures.
- `fixtures/negative/*.cbor`: 42 executable critical binary failures.
- `keys/*.spki.der`: 18 public, 91-byte P-256 SPKIs only.
- `coverage/malformed-expanded.json`: all 744 descriptor/type expansions after
  the descriptor-only `LIC-CHG-0011` erratum; 42 are linked one-to-one to binary
  fixtures and 702 remain descriptor-only for these non-production consumers.
  The production Core gate owns 676 of those descriptors; 26 state/time/replay
  cases belong to `LIC-6.2-004`, `LIC-6.2-005` and `LIC-6.2-007`.
- `coverage/cross-type.json`: all 90 ordered source/target pairs, each executed
  unchanged against the wrong target contract by both independent consumers.
- `reports/vendor-verdict.json`: issuer-side canonical expected verdict bytes.
- `reports/node-verdict.json` and `reports/dotnet-verdict.json`: seeded only from
  fresh successful consumers and byte-identical to the Vendor report. Each report
  contains 173 executed records: 41 positives, 42 binary negatives and 90
  cross-type rejects. The generator emits only the Vendor report.
- an explicit report path supplied to either verifier receives canonical,
  runtime-neutral result bytes; normal verification never mutates this package.
- `node-verifier/` and `dotnet/`: independent consumers. Neither imports the
  fixture issuer, deterministic signer or test private-key derivation graph.
- `vector-manifest.json` and `vector-manifest.sha256`: closed-world package
  inventory and repository-external digest pin maintained by the aggregate gate.

The generator accepts only a fresh, empty output directory outside this source
package. Verifier reports likewise require a fresh path outside the package and
are created without overwrite. A successful deterministic generation contains
exactly 105 generated artifacts. The reproducible generation and closure commands
from the repository root are:

On Windows, verifier package/report arguments must use canonical local drive-rooted
paths. UNC, administrative-share, extended and device namespace aliases are
rejected before filesystem access so they cannot bypass package containment.

```powershell
npx.cmd --yes -p node@24.19.0 -c "node licensing/vectors/v1/generate-vectors.mjs --generate <ABSOLUTE_EMPTY_OUTPUT>"
npx.cmd --yes -p node@24.19.0 -c "node licensing/vectors/v1/verify-vectors.mjs --vectors <ABSOLUTE_VECTOR_ROOT> --report <ABSOLUTE_FRESH_REPORT>"
npx.cmd --yes -p node@24.19.0 -c "npm.cmd run test:license-golden-vectors"
npx.cmd --yes -p node@24.19.0 -c "npm.cmd run test:license-protocol-v1"
```

The aggregate gate also builds and runs the dependency-free .NET consumer under
the exact .NET SDK `10.0.400` pinned in `dotnet/global.json`, compares all three
report files byte for byte, probes malformed paths/files/JSON/report targets,
including namespace/UNC aliases, NTFS ADS, reserved-device and trailing-dot/space
report aliases, scans production code for fixture-key imports, and verifies the
closed manifest and its external pin.
