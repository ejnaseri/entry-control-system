import { lazy, Suspense } from "react";
import { useAuth } from "../auth/AuthContext";
import { SharedAppShell } from "./SharedAppShell";

const AttendanceInboxShell = __ECS_ATTENDANCE_INBOX_CODE_READY__
  ? lazy(() => import("./AttendanceInboxShell").then((module) => ({ default: module.AttendanceInboxShell })))
  : null;

export function AttendanceShellAdapter() {
  const { hasFeature, hasPermission } = useAuth();
  const inboxEnabled = __ECS_ATTENDANCE_INBOX_CODE_READY__
    && hasFeature("INBOX")
    && hasPermission("ATTENDANCE_VIEW");

  if (!inboxEnabled || !AttendanceInboxShell) return <SharedAppShell />;

  return (
    <Suspense fallback={<SharedAppShell />}>
      <AttendanceInboxShell />
    </Suspense>
  );
}
