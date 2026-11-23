# Initial-status observation fix ? 2026-10-28

[Fix contract](../../plans/LICENSING_EXPORT_POLICY_PROCESS_OBSERVATION_FIX.md) ? [Actual V4 diagnostic](../export-policy-control-v4-run-20261028/README.md)

These seven JSON files preserve exact bytes from a SOURCE-ONLY inert build after
baseline `a72c400`. No JSON is reserialized. Binaries and source snapshots remain
in `out/lic008-export-policy-v4-inert-6a4bab291e71488bb4a8f7297c9878a9`. Git newline conversion is disabled for these JSON files.

The change samples START_PENDING read-only before expensive full context checks,
validating the session/expiry cheaply before repeat reads and before returning
an observation. It keeps the existing timer, RUNNING-only PID admission and all
original image/time/process-wait/report/restoration guards. It cannot guarantee
observing an arbitrarily short RUNNING interval.

Every inert variant and packaged apphost passes 18,316 assertions, including
1,579 controller checks (80 added). Each has14 closed-entry refusals. Default
and V1/V2/V3 defines remain inert. Independent source review PASS; the linked
contract records final artifact audit status. All physical/security/production
acceptance flags remain false.

This artifact still binds CONSUMED V4. No new capable/owner kit was built from
it and it was not executed against installed resources. A later native test
requires a separate fresh placement, package, reviewed inputs and owner CONFIRM.

| Original record | SHA256 |
| --- | --- |
| [manifest.json](manifest.json) | `97cdcb5e9782ea21b7976ba20d77a7f624fb75294f5b5a247cc1c9fd31662ec0` |
| [package-manifest.json](package-manifest.json) | `19e1f87285722eb22896fa6c40eb045ef9ebc65c5d80ac59c8b6f7675e6187b6` |
| [package-build.json](package-build.json) | `45b84738e7c8180f293918ebf1327db76564c3014874159503cc22604e9a1284` |
| [package-verification.json](package-verification.json) | `0eed8aae1336ce40572d7ba118b2e2147382796e86cb60f7699c8c4281dd1d17` |
| [apphost-pure-test-report.json](apphost-pure-test-report.json) | `ae5282fd020605baab23892a3e7db631dab30f28fc691ce84184863b0a75521a` |
| [default-pure-test-report.json](default-pure-test-report.json) | `ae5282fd020605baab23892a3e7db631dab30f28fc691ce84184863b0a75521a` |
| [legacy-pure-test-report.json](legacy-pure-test-report.json) | `ae5282fd020605baab23892a3e7db631dab30f28fc691ce84184863b0a75521a` |
