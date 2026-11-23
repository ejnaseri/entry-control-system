# Fresh V2 Prepare permission — 2026-10-17

The owner requested the next step after being told the2026-10-16 approval had
expired and that a fresh approval for today was required. This renews only the
same exact-candidate Prepare scope; it is not permission for later stages.

Candidate: out/lic008-pilot-runtime-candidate-4c7923163636489a86768c96c12165f8.
Provenance:4296ff854c75e6b5a1685a12ee1741ee75139fc9e504d313db137f7b60873b4d.
Successor:8d6b30a67a7060b1e343b1fa485c11f460698d20017bc48da597fcd67757ea30.
Owner SID:S-1-5-21-3058020570-171625005-1532683838-1001.

Scope: create protected V2 root, copy reviewed package, register three V2 test
services and execute Prepare including two test keys. No V1 changes, adoption,
cleanup, production changes, reboot, automatic retry or later stage permission.
Owner must confirm live in Administrator PowerShell; no agent-supplied consent.

Window:2026-10-17T10:06:00.000Z through2026-10-17T14:06:00.000Z
(18:36 Kabul). These are issuance bounds, not a claimed message timestamp.

Read-only checks today: same package provenance hash; CIM returned no V2 service
and Get-Item returned path-not-found for the exact V2 root. These observations
are not a replacement for elevated runtime preflight or proof of key absence.
The expired attempt stopped before CONFIRM according to the supplied transcript.
Old permission/input artifacts remain unchanged. No physical stage run by agent.

## Issued inputs

Output:out/lic008-prepare-approved-30173bfda30af041dcc879170579d658.
Issued10:10:18UTC; expires14:06UTC today. Compiled input diagnostics2 PASS and
2 expected refusals; read-only helper rechecked sources/package/archive/host.
Permission source SHA256:
1f3de825fede65b2faf1b0ede893462cd98f00fa35686e22c29dfd91ebe76a18.
Owner-context SHA256:
fa28aa8319c799497aa5cb89c5889c1b7477f5a5ab26e4ababe556506606fe70.
Owner-input SHA256:
34aba8df47261f35144713b7fad50b97245271dcb09688c3867639fdb2dd9b63.
Controller-input SHA256:
4ae9e08b76710c4c07c0477d78913e43166554b0d958ac5eea53b5f17782b811.
Await live owner confirmation/output; do not reuse yesterday's inputs or retry
after a partial failure. physicalExecuted=false; no production/security acceptance.
