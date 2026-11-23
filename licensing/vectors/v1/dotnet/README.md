# .NET golden-vector consumer (test only)

This project is a test-only, dependency-free consumer of the frozen licensing
protocol v1 golden vectors. It is not a production license parser, verifier, or
trust store. The committed public keys in the sibling `keys/` directory are
non-production fixtures and must never be trusted by shipped application code.

The scoped `global.json` requires exactly .NET SDK `10.0.400`. From this directory,
route build artifacts and the verdict to disposable locations:

```powershell
$artifacts = Join-Path $env:TEMP 'ecs-license-vector-artifacts'
$report = Join-Path $env:TEMP 'ecs-dotnet-verdict.json'
$vectors = (Resolve-Path ..).Path
dotnet run --project EntryControl.GoldenVectors.csproj --configuration Release `
  --artifacts-path $artifacts -- --vectors $vectors --report $report
```

The consumer validates the exact shared index, all 41 positives (35 signed plus
six carriers), all 42 binary negatives, and all 744 frozen malformed-corpus joins
(42 binary-linked plus 702 explicitly deferred). It also executes all 90
cross-type objects unchanged under their target contracts and emits the same 173
verdict entries as the other consumers. Descriptor-only semantic/schema behavior
remains explicitly deferred to `LIC-6.2-003`.

`--vectors` must be an absolute, regular, non-link package-root path. On Windows,
both package and report arguments must use canonical local drive-rooted paths;
UNC, administrative-share, extended and device namespaces are forbidden. A
report target must be outside the package, absent before execution, and have an
existing non-link directory parent; it is created once without overwrite. Its
basename must also be canonical: NTFS ADS/colon paths, DOS device aliases and
trailing-dot/space aliases are rejected before any file is opened.
When `--report` is omitted, the compact ASCII JSON verdict (with one final LF) is
written to standard output. Verification never mutates the vector package.
