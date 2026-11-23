# Entry Control System

Documentation entry point: [docs/README.md](docs/README.md)

Project status and quality checklist: [docs/project/PROJECT_CHECKLIST.md](docs/project/PROJECT_CHECKLIST.md)

Attendance Edition split checklist: [docs/project/ATTENDANCE_EDITION_CHECKLIST.md](docs/project/ATTENDANCE_EDITION_CHECKLIST.md)

FULL/ATTENDANCE shared visual system and UI unification plan: [docs/ui/EDITION_UI_UNIFICATION_PLAN.md](docs/ui/EDITION_UI_UNIFICATION_PLAN.md)

Packaging and Installer decisions: [docs/operations/PACKAGING_DECISIONS.md](docs/operations/PACKAGING_DECISIONS.md)

Windows v1 support, exclusions and clean-machine acceptance matrix: [docs/operations/WINDOWS_SUPPORT_MATRIX.md](docs/operations/WINDOWS_SUPPORT_MATRIX.md)

Licensing master decision record, security contract and implementation checklist: [docs/licensing/design/LICENSING_DESIGN.md](docs/licensing/design/LICENSING_DESIGN.md)

LIC008 Software-KSP wrapping-key decision and harness contract: [docs/licensing/design/LICENSING_SOFTWARE_KSP_WRAPPING_DESIGN.md](docs/licensing/design/LICENSING_SOFTWARE_KSP_WRAPPING_DESIGN.md)

Frozen Licensing protocol v1 schema/negative-corpus package: [licensing/protocol/v1](licensing/protocol/v1/README.md)

Closed non-production Licensing protocol v1 Golden Vector package and independent test consumers: [licensing/vectors/v1](licensing/vectors/v1/README.md). Current coverage and hashes are recorded in that package and the Licensing master, including the approved descriptor erratum. This test package is not the production License parser, Core, Guardian, trust store or Installer.

Real K40 setup notes: [docs/operations/k40-setup.md](docs/operations/k40-setup.md)

Backup and restore plan: [docs/operations/backup-restore.md](docs/operations/backup-restore.md)

Security design: [docs/architecture/security-design.md](docs/architecture/security-design.md)

Additional project notes live in [docs](docs).

## Canonical builds

The root [version.json](version.json) is the only Product/API/License-protocol/build identity source. Release-build commands require exact Node.js `24.19.0`; Production Client builds cannot be selected with `VITE_APP_EDITION` or a version fallback.

From the repository root, under Node `24.19.0`:

```text
npm run build:full
npm run build:attendance
npm run verify:full
npm run verify:attendance
npm run test:phase-6.1
npm run test:license-protocol-v1
npm run test:license-golden-vectors
```

Outputs are written separately to `release/FULL` and `release/ATTENDANCE`, each with `version.json`, `build-identity.json`, `build-manifest.json` and `build-manifest.sha256`. These Phase 6.1 artifacts are unsigned development outputs: SHA-256 manifests support deterministic integrity verification but do not replace Authenticode or the Phase 6.4 License Guardian.

The Golden Vector gate runs under exact Node `24.19.0` and its independent .NET consumer uses scoped SDK `10.0.400`. See the [Licensing master evidence](docs/licensing/design/LICENSING_DESIGN.md) for current pins and historical verification.

Windows provider feasibility test tools and laptop instructions: [LIC008 handoff](docs/licensing/experiments/LICENSING_WINDOWS_SPIKE.md). These separate development tools do not install the application or close Licensing acceptance gates.
