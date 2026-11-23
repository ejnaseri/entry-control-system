export const ATTENDANCE_POLICIES = Object.freeze(["TIME_CLOCK"] as const);

export type AttendancePolicy = (typeof ATTENDANCE_POLICIES)[number];

export type AttendancePunchDecision = Readonly<{
  attendanceRecorded: true;
  doorAllowed: false;
  doorOpened: false;
}>;

const TIME_CLOCK_PUNCH_DECISION: AttendancePunchDecision = Object.freeze({
  attendanceRecorded: true,
  doorAllowed: false,
  doorOpened: false,
});

/**
 * Attendance v1 is a time clock, not an access-control policy. Once the
 * strict Staff identity boundary has admitted a punch, shift windows may
 * classify that attendance later but cannot veto recording it or actuate a
 * door.
 */
export function resolveAttendancePunchDecision(policy: AttendancePolicy): AttendancePunchDecision {
  if (policy === "TIME_CLOCK") return TIME_CLOCK_PUNCH_DECISION;

  const unreachable: never = policy;
  throw new Error(`Unsupported attendance policy: ${String(unreachable)}`);
}
