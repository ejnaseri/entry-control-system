# K40 Setup

Last reviewed: 2026-05-31

This document records the real K40 setup that has been used during project verification. Keep it updated whenever the physical network, device address, app configuration, or device communication settings change.

## Hardware Scope

| Item | Value |
| --- | --- |
| Real device available | ZKTeco K40 |
| Physical location | Not recorded yet |
| Other real devices available | None confirmed |
| Supported workflow verified with hardware | Fingerprint attendance, user list, user create/delete, fingerprint enrollment trigger, device time read/update, log fetch, authorized entry/exit, out-of-time denied event |
| Device families not verified | Face recognition devices, USB/serial production devices, non-ZKTeco brands |

## Device Network Settings

| Setting | Value |
| --- | --- |
| Device model | K40 |
| Device IP address | `192.168.1.200` |
| TCP communication port | `4370` |
| Subnet mask | `255.255.255.0` |
| Gateway | `0.0.0.0` / empty for direct cable setup |
| DNS | `0.0.0.0` / empty for direct cable setup |
| DHCP | Off |

## Windows Ethernet Adapter Settings

Use a different IP address from the K40, but keep it in the same subnet.

| Setting | Value |
| --- | --- |
| Adapter used during test | Ethernet 2 |
| PC Ethernet IP address | `192.168.1.250` |
| Subnet mask | `255.255.255.0` |
| Gateway | Empty |
| DNS | Empty |

Do not set the PC Ethernet adapter to `192.168.1.200`. That IP belongs to the K40 and creates a duplicate IP conflict.

## App Device Configuration

| Field | Value |
| --- | --- |
| Name | ZKTeco K40 |
| Type | Fingerprint |
| Connection | Network |
| Model | K40 |
| IP / Host | `192.168.1.200` |
| Port | `4370` |
| Password / Comm key | Empty unless the device is configured with a communication key |
| Event mode | Pull |
| Push / ADMS | Disabled for the verified setup |
| Enabled | Active |

## Healthy Diagnostic Result

A healthy direct-cable setup should show:

- The saved device as `192.168.1.200:4370`.
- The PC Ethernet adapter in the same subnet, for example `Ethernet 2: 192.168.1.250 / 255.255.255.0`.
- Matching NIC: `Ethernet 2`.
- TCP port `4370` open.
- Ping/TCP reachability successful.

## Known Misconfiguration Patterns

| Symptom | Likely cause | Fix |
| --- | --- | --- |
| PC and device both show `192.168.1.200` | Duplicate IP conflict | Keep K40 on `192.168.1.200`; change PC Ethernet to `192.168.1.250` |
| Windows adapter shows `169.254.x.x` | Windows self-assigned address; intended IPv4 config was not active | Set static IPv4 again, disable/enable the adapter, or reconnect the cable |
| Device is reachable from Windows but app is configured with another IP | App device config mismatch | Update the device in `/devices` to `192.168.1.200:4370` |
| Port `4370` timeout | Cable, power, wrong IP, blocked NIC, or K40 communication disabled | Check cable/power, confirm K40 IP and port, then rerun diagnostics |

## Verified Manual Results

> Scope note: the May 2026 results below are historical `FULL` access-control evidence. The separate `ATTENDANCE` `TIME_CLOCK` hardware gate passed on 2026-08-23 and is recorded after that list.

The following were confirmed on 2026-05-25 with the real K40:

- Device connection works from the Devices page.
- Device monitor shows connected state after the PC Ethernet IP was corrected.
- Diagnostics identify healthy setup and duplicate-IP setup clearly.
- Device users can be listed.
- Available device user ID suggestion works.
- Test user creation works.
- Fingerprint enrollment trigger works.
- Test user deletion works.
- Device time can be read.
- Device time can be updated.
- Attendance logs can be fetched.
- Authorized check-in appears in dashboard live events, entry logs, and daily attendance.
- Authorized check-out appears in dashboard live events, entry logs, and daily attendance.
- Authorized access opens the door.
- Out-of-time access is denied with `TIME_NOT_ALLOWED`.
- Debtor access is denied correctly on the real K40.
- Expired member access is denied on the real K40 workflow.
- Denied access creates the expected Inbox warning item and notification badge.
- Re-fetching K40 logs after a denied event does not create duplicate Entry Logs rows.
- Network disconnect creates a critical Inbox alert and Dashboard disconnected state.
- Network reconnect restores the K40 to connected state.
- Authorized entry for Eraj naseri worked after network recovery.

## Attendance Phase 2.7 Real-K40 Evidence

The `ATTENDANCE` matrix passed on 2026-08-23 against device `cmjfmgv340000owiczn5kdzgp` at `192.168.1.200:4370`, using the strict Staff-only Pull scope. The development server was stopped during controlled commands so only one K40 socket owner was active.

| Check | Result |
| --- | --- |
| Connection, polling and status | TCP/K40 connection passed repeatedly; polling ran every second and the device finished `enabled=true`, `ONLINE` |
| Device lifecycle | A temporary device record passed create, update, disable/enable and real K40 connection; it was removed afterward with zero leftovers |
| User list and sync | Eight physical users were read; four canonical active Staff users synced and four non-Staff users were skipped. Strict list returned only Staff, including `ID 1 — Eraj naseri` |
| User create/enroll/delete | Temporary strict Staff `ID 18 — Phase27 HardwareTest` was created on K40, fingerprint enrollment was completed by the user, the fingerprint matched, and the physical user was deleted afterward |
| Time read/set | Device time was read, set from the server, read back and was within approximately 4.3 seconds of the server clock |
| Staff IN/OUT and reconciliation | Eraj's real `IN` plus the user-confirmed `OUT` at `2026-08-23T10:46:56Z` produced RawLog `cmt5on71000012sicbwpz4tmp`, AttendanceLog `cmt5on73w00022sicjf9vgsgs`, a closed Daily row, two Entry Logs and matching Report KPI/Daily/Employees values |
| Outside-shift `TIME_CLOCK` | ID 18 had a `00:00–00:01` shift; a real afternoon fingerprint still produced `RawLog(PROCESSED)` and `AttendanceLog(IN, authorized)` with no access-policy gate |
| Inactive identity | After ID 18 was changed to `BLOCKED`, its next physical scan produced only `SKIPPED_INVALID / INACTIVE_EMPLOYEE`; Attendance count remained one and Door/Inbox/Violation stayed zero |
| Duplicate/restart/resume | Restarting strict polling reread the cursor boundary without adding RawLog/Attendance rows. After changing insertion to `createMany(skipDuplicates)`, the same real replay remained `before=1/after=1` without the caught Prisma `dataHash` error |
| No door/inbox/violation | Counts after the real Eraj punch and both ID 18 scenarios were all zero; strict polling never received an unlock client |
| Cleanup | Physical ID 18, its Member/DeviceUser/Shift, two temporary RawLogs and its Attendance row were removed; all fixture leftover counts were zero. The real Eraj evidence remains in the database |

The hardware run found a separate real-PostgreSQL issue in the singleton enable guard: Prisma 7 could not deserialize the `void` result of `pg_advisory_xact_lock` through `$queryRaw`. The guard now uses `$executeRaw`; the strict boundary test and a repeated real device lifecycle both pass.

## Remaining Manual K40 Tests

No legacy `FULL` or Attendance Phase 2.7 K40 tests remain open. Rerun the applicable matrix after changes to device communication/ingestion and again at the Release Gate.

## Change Rules

- Do not add support for face devices or other hardware without a real device, real logs, or temporary access to that exact model.
- Any change to K40 attendance processing must run `npm run test:devices` in `server`.
- Any change to device communication or diagnostics must run the manual K40 checklist when the physical device is available.
- Keep this file and `docs/PROJECT_CHECKLIST.md` updated after every real-device test.
