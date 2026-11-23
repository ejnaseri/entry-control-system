# W03 closed source components - 2026-11-03

[Implemented scope and required next runner](../../plans/LICENSING_LIC008_STANDARD_COMPONENTS.md).

Four exact original JSON files, copied without reserialization or Git newline
conversion. Each of three variants passes3,038 assertions:305 identity,
270 suspended-launch,40 credential lifetime,1,976 comparison and447 primitive.
Each variant also refuses13 closed/malformed/physical-looking entry arguments.
These are construction tests, not native W03 isolation evidence.

Independent source review PASS after correcting creation-plan substitution,
credential full-length erasure, callback re-entry, raw-handle serialization,
native-output retention, failed-positive metadata consistency and duplicate CNG
handle disposal. Independent artifact review PASS:858 read-only assertions.

Default/unrelated variants omit actual native launcher/persisted-CNG bindings;
the third compiles them for review. All expose only self-test. None invokes a
native logon/token probe, persisted machine CNG backend, account or SCM operation.
Tests exercise public synthetic in-memory RSA/AES and injected handles. No owner
password is used. SyntheticFixture=true; physical logon/persisted CNG/account/
standard-user test/full runner/security/production acceptance flags remain false.

Build: `out/lic008-standard-launch-v1-7f4d359579b94ba4a8399ba6ae604e7d`.
Built UTC: `2026-11-03T18:35:44.5759099+00:00`.
Source-set SHA256: `ea56c03633c12d109f81beb63ab666564172d1761ff74bdfa856e10bd431a973`.
Fourteen source/snapshot pins; exact3 tools/167 references/15 Roslyn files/
190 runtime files; all AMD64 outputs, runtime10.0.11/rollForwardDisable and exact
27-file artifact set verified. Prior intermediate outputs remain retained and
are superseded, not used as this final build.

| Exact original | SHA256 |
| --- | --- |
| [manifest.json](manifest.json) | `d1952be2c74068cddb23575e327bb69869d14fbd8dc1a776cb9db23d07e25317` |
| [default-pure-test-report.json](default-pure-test-report.json) | `25813bc0f419bcbf967afdcea051759af9716e9318e69edada29ec054412e4bf` |
| [unrelated-defines-pure-test-report.json](unrelated-defines-pure-test-report.json) | `25813bc0f419bcbf967afdcea051759af9716e9318e69edada29ec054412e4bf` |
| [compile-only-native-pure-test-report.json](compile-only-native-pure-test-report.json) | `25813bc0f419bcbf967afdcea051759af9716e9318e69edada29ec054412e4bf` |
