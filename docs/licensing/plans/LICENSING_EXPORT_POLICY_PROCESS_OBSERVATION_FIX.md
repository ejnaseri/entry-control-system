# Initial service-status observation correction

Date: 2026-10-28. Baseline: `a72c400`.
Status: `SOURCE_REVIEW_INERT_TESTS_AND_ARTIFACT_REVIEW_PASS`.

[Actual consumed V4 diagnostic](../evidence/export-policy-control-v4-run-20261028/README.md)
· [Exact inert evidence](../evidence/export-policy-initial-status-fix-20261028/README.md)
· [LIC008 work ledger](LICENSING_LIC008_COMPLETION_PLAN.md)

## Observed refusal and targeted change

V4's schema3 result locates its refusal at `SetupRun / StoppedProcess`, where the
controller required a pinned process handle and positive admitted PID. Neither
existed. The first sample was START_PENDING/PID10372; the next recorded status was
STOPPED/PID0. No RUNNING sample, handle, independent process exit or report read
was observed. A separate protected Setup completion report and both key journals
exist. This identifies the missing controller proof; it does not prove exactly
why RUNNING was missed or retrospectively identify V3/V1's cause.

After the original single admitted StartService call, the original code made one
immediate query and then returned to expensive full Guard/Snapshot work. The
correction follows a START_PENDING sample with read-only queries on that same
admitted SCM handle at 25 ms intervals before returning to the full checks.

Every native query retains success/type16/state1..7 admission. The memory-only
loop caches each valid observation and checks the current session/expiry using
`ControlRules.ValidateSession`, before each repeat query and before returning a
sample. It uses the existing monotonic 45-second run timer without resetting it.
No sample is returned after the observed deadline. Query, wait and expiry
exceptions propagate; no fallback, renewed budget or retry is added.

START_PENDING PID is never admitted as process identity. Only an actual
RUNNING/state4 with nonzero PID reaches the unchanged RecordProcess, which opens
the handle and checks exact image and start time. The original full Guard,
configuration snapshots, held-handle wait, final checks, protected report read,
report admission, Guardian borrowing/restoration and result publication still
follow. Status alone never proves process termination or authorizes restoration.

Nonpending statuses return to the original path. RUNNING/PID0, STOPPED or a missed
window cannot fabricate proof. Sampling improves the opportunity to see a short
worker; it cannot guarantee observing an arbitrarily short interval. The timer
does not preempt a blocking native query, hashing operation or full Guard.

## Verification

Independent source review by change_review PASS. The new pure seam has **80**
assertions: 14 status sequences, exact callback order, malformed samples, expiry
before/after sleep and after RUNNING, initial/crossed deadline and preserved
query/wait exceptions. In particular pending PID10372 followed by RUNNING PID42
returns the latter observation; it never pins the pending PID. Existing fake
backend process-proof/report/restoration tests remain intact.

The SOURCE-ONLY V4 inert build passes **18,316** assertions per variant/apphost,
including **1,579** controller checks. All variants refuse **14** closed entry
routes, and all physical-tested/acceptance flags remain false. The owner-kit
builder's expected control count is synchronized; no new capable artifact or kit
was built from this correction. This inert build still binds consumed V4.

Inert directory:
`out/lic008-export-policy-v4-inert-6a4bab291e71488bb4a8f7297c9878a9`.
Manifest SHA256:
`97cdcb5e9782ea21b7976ba20d77a7f624fb75294f5b5a247cc1c9fd31662ec0`.
Package manifest SHA256:
`19e1f87285722eb22896fa6c40eb045ef9ebc65c5d80ac59c8b6f7675e6187b6`.

Independent artifact review PASS: 26 live source/snapshot pairs, four tools,
167 references, 190 runtime files, four package files and all reports agree.
Retained V4 build/kit payloads and all 17 run-archive JSON originals remain exact.
No native replay of V4, service/key mutation or current-owner input
issuance is part of this source correction. Continue with a separately reviewed
fresh V5 placement and full inert/capable/owner-kit chain before any next physical
attempt. Preserve V1/V2/V3/V4 and original evidence. LIC008/Open003 and all platform,
security and production acceptance obligations remain open.
