import { Navigate } from "react-router-dom";

export function AttendanceReportsRedirect() {
  return <Navigate replace to="/reports/attendance" />;
}
