# W03 identity foundation and current-owner token codec - 2026-11-02

[Scope and remaining work](../../plans/LICENSING_LIC008_STANDARD_IDENTITY_FOUNDATION.md).

Six exact JSON originals, no reserialization or Git newline conversion. Source/artifact independent review PASS (812 read-only assertions);305 pure assertions per variant, closed entries10/10/9. Builder did not invoke the native read route.

A later separate read-only own-token capture succeeded (independent offline audit60 assertions): current Owner1001, PID18728, exact externally held start FILETIME, exit0. Native token is primary1/elev0/elevationType3/IL8192/HasRestrictions true/AppContainer false,14 groups including Administrators deny-only16. Actual admission returns WRONG_ACCOUNT first. Admin-specific refusal is covered by pure fixtures, not exercised after the early actual mismatch.

No test of account1023, account change, logon, process creation under another identity, SCM, CNG or W03 crypto comparison occurred. Build flags describing no native read apply to construction; the separate own-token records describe the subsequent codec query. No security/production acceptance.

Build: `out/lic008-standard-identity-v1-3b45c86943864677be92e9669883d805`.

| Exact original record | SHA256 |
| --- | --- |
| [manifest.json](manifest.json) | `e9c391c717ec172140e710e3b3a4a20a1ea924f2d1114a0e7150a99cd84e209b` |
| [default-pure-test-report.json](default-pure-test-report.json) | `175ac1498dbbb4032263bfe55e900dbbb7bd5613165c6e6730a8d6c075cad9b6` |
| [unrelated-defines-pure-test-report.json](unrelated-defines-pure-test-report.json) | `175ac1498dbbb4032263bfe55e900dbbb7bd5613165c6e6730a8d6c075cad9b6` |
| [readonly-diagnostic-pure-test-report.json](readonly-diagnostic-pure-test-report.json) | `175ac1498dbbb4032263bfe55e900dbbb7bd5613165c6e6730a8d6c075cad9b6` |
| [own-token.json](own-token.json) | `cda6f36eb7b914511739b5cb38b9e835c856125ee8c7aae0ed81893ab3939625` |
| [own-token-capture.json](own-token-capture.json) | `4ca4194d9644f21991e51ded9dd0748ab70160bbfd270d3a10ba448686b7c6b5` |
