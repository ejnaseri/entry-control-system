# Track A test-only candidate

Pure framing, evidence-qualified failure models and deterministic fake-worker
tests only. This is not a Windows KSP adapter, License State serializer, Store
or product service. No service/key/account/ACL APIs or physical controller.

Build with the repository's build-license-adapter-track-a.ps1. The builder freezes
explicit sources/compiler/references and hashes the runtime inventory. Direct
csc compilation avoids MSBuild imports, NuGet restore/network and generated code.
Execution is framework-dependent via the pinned dotnet10.0.11 host, not a
self-contained role EXE. Thus executorExeSha256 is dotnet.exe, explicitly not
proof of a candidate apphost or future physical roles. Those remain Track B.

The binary takes only --self-test. It refuses arbitrary input or physical actions.
The GCM test uses ephemeral memory-only AES; no RSA/KSP or persisted key test.
FEP-U04 PASS means the documented lack of anti-rollback is observed, not that
rollback prevention passes. FEP-U05/U06 are simulated evidence/worker models.
Core logical-state serialization, actual codec-to-KSP integration, real timeout,
child/service identity and physical FEP-P tests remain
unimplemented and NOT_RUN. Do not report all16 plan cases complete.

DiagnosticModel constructs only a closed candidate DTO, never serializing raw
exceptions/input/provider metadata. Recursive closed-schema checks reject unknown
or duplicate properties, unsafe code values and extra nested array entries.
Canary tests cover text/hex/base64 in rejected input and nested provider exceptions.
This is pure FEP-U08 candidate coverage, not deployed product Audit/IPC acceptance.

Version0.1.2 makes each SimulatedDeadline instance single-use: restart after
timeout or normal completion refuses without altering final state. A new
instance represents a new operation; no actual native-worker replacement is
authorized. Regression cases cover restart, overlap and invalid transitions.
Independent literal-byte fixtures check complete candidate envelope and AAD
domain/header bytes against contract0.2, not shared encoder/decoder round trips.
