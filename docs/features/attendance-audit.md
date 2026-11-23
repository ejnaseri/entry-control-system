## Attendance Audit (Staff Daily Summary)

### A) Expected-to-attend data
1) Staff <-> group relation:
   - `Member.staffGroupId` relates staff to `StaffGroup` (`Member` model).
   - `StaffProfile` does not carry a group id.

2) Shift templates storage:
   - Shift templates live in `StaffGroupShift` (table/model).
   - Per-staff shifts live in `MemberShift` (table/model), which is denormalized from templates and custom shifts.

3) Weekday / schedule rules:
   - `weekdays` is stored on both `StaffGroupShift` and `MemberShift`.
   - Current shifts store `shiftStart`/`shiftEnd`, including cross-midnight windows.
   - Daily/Report services use the stored weekday schedule to determine expected Staff.

4) Grace/late rule:
   - `graceMinutes` and `earlyAccessMinutes` are stored and copied with shift assignments.
   - Access policies remain separate from Time Clock recording; in `ATTENDANCE`, a valid Staff punch cannot be vetoed by a shift/access window.

### B) Entry events data
1) IN/OUT support:
   - `AttendanceLog.entryType` stores explicit `IN` / `OUT` (`AttendanceType` enum).
2) Manual entry:
   - Manual API uses `eventType` and stores it as `AttendanceLog.entryType`.

### C) Conclusion
1) Can we compute daily attendance correctly with current data?
   - Weekday/grace fields and Daily calculations are implemented. Phase 2.6 semantics and Phase 2.7 hardware reconciliation are recorded complete in the Attendance checklist; Phase 4 report/export and Phase 5.5 external-timezone/Restore checks are also complete. This does not replace final installed-product Windows/K40/pilot acceptance.

2) Historical schema/API recommendation status
   - `weekdays`, `graceMinutes` and early-access storage were added to group templates and per-Staff shifts.
   - Phase 2.6 is complete; do not recreate this work or introduce another schema fork. New calculation changes require the relevant regression gates, and release/pilot evidence remains tracked by its later owning phases.
