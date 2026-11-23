import type { AttendanceType } from "@prisma/client";

type AttendanceEmployeeProjection = Readonly<{
  id: string;
  name: string;
  code: string;
}>;

type AttendanceDeviceProjection = Readonly<{
  id: string;
  name?: string | null;
}>;

export type AttendanceInboxEvent =
  | Readonly<{
      kind: "ACCEPTED_STAFF_PUNCH";
      occurredAt: Date;
      entryType: AttendanceType;
      employee: AttendanceEmployeeProjection;
      device: AttendanceDeviceProjection;
    }>
  | Readonly<{
      kind: "INACTIVE_EMPLOYEE_ATTEMPT";
      occurredAt: Date;
      employee: AttendanceEmployeeProjection;
      device: AttendanceDeviceProjection;
    }>
  | Readonly<{
      kind: "UNKNOWN_DEVICE_USER" | "INVALID_DEVICE_EVENT";
      occurredAt: Date;
      device: AttendanceDeviceProjection;
    }>;

type AttendanceInboxEventListener = (event: AttendanceInboxEvent) => void | Promise<void>;
const listeners = new Set<AttendanceInboxEventListener>();

export function subscribeAttendanceInboxEvents(listener: AttendanceInboxEventListener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export async function publishAttendanceInboxEvent(event: AttendanceInboxEvent) {
  await Promise.all([...listeners].map((listener) => listener(event)));
}
