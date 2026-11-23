# Inbox / Notification Center (MVP)

> Scope note: the device-feed and denied-access rules below describe the legacy `FULL` workflow. `ATTENDANCE` Inbox was selected for v1 on 2026-10-03 but remains unmounted until the complete O.2 gate passes; a valid Staff `TIME_CLOCK` punch, including an outside-shift punch, records attendance with `doorAllowed=false` and does not yet create an Inbox denial/alert. `ATTENDANCE_AUTO_CHECKOUT_ENABLED` strictly accepts `0|1` with default `0`, but both values are non-operational in Attendance v1: the Auto-checkout routine returns before any AttendanceLog Query/Write even if invoked independently of Inbox. Value `1` is reserved for an explicit future Auto-checkout Scope Change with dedicated UI/Audit/tests; the existing `FULL` scheduler and legacy synthetic `OUT` behavior remain unchanged.

> O.2 status (2026-10-03): Attendance Inbox is selected for implementation but remains unmounted and code-not-ready until its complete gate passes. `InboxItem.scope` separates `FULL` and `ATTENDANCE`; O.2.2 isolates Staff/Device producers; O.2.3 secures HTTP/WebSocket and filters Edition/action paths. O.2.4 connects the shared Bell/Drawer to `AttendanceShellAdapter` behind an internal code-ready gate plus Auth `INBOX`/`ATTENDANCE_VIEW`, removes Membership-only filters, and imports no Sounds code. O.2.5 adds strict external `APP_FEATURE_INBOX=0|1` configuration with default `0`; even `1` remains ineffective until code-ready promotion. Automated O.2.6 Browser/API/PostgreSQL/restore/dedupe/retention/FULL gates pass; physical K40 acceptance remains because `192.168.1.200:4370` was unreachable. Production Attendance keeps the internal gate false and tree-shakes every Inbox request/WebSocket/chunk until O.2.7.

## Categories
- ALERT: actionable system alerts (memberships expiring/expired, shift ending soon, device disconnected, access denied, multiple failed attempts).
- DEVICE_FEED: chronological device events (authorized/denied).

## Alert creation rules
- Every device event becomes a DEVICE_FEED item.
- Alerts are created for denied access or important conditions:
  - Membership expired
  - Shift violation (day/time not allowed)
  - Device disconnected (heartbeat missing)
  - Multiple failed attempts (aggregated)

## Dedupe strategy
Dedupe uses `dedupeKey` composed from item type + entity + time window:
- Membership expiring/expired: one alert per membership per day.
- Shift ending soon: one alert per shift per day.
- Device disconnected: one alert per device per day.
- Multiple failed attempts: one alert per member/device per 2-minute window.

## Retention
- DEVICE_FEED items are cleaned after 7 days.
- ALERT items are cleaned after 90 days.

## Config
These environment variables can be adjusted (optional):
- `INBOX_JOB_INTERVAL_MS`
- `INBOX_EXPIRING_SOON_DAYS`
- `INBOX_SHIFT_ENDING_MINUTES`
- `INBOX_DEVICE_OFFLINE_MINUTES`
- `INBOX_DEVICE_FEED_RETENTION_DAYS`
- `INBOX_ALERT_RETENTION_DAYS`
- `INBOX_FAILED_ATTEMPT_WINDOW_MINUTES`
- `INBOX_FAILED_ATTEMPT_THRESHOLD`

Notes:
- Expiring alerts are kept as history even if a membership is renewed.
- Device feed items are auto-marked read after ~1s of visibility in the Inbox drawer (alerts are manual only).
