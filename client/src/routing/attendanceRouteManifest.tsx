import { lazy } from "react";
import { defineRouteBundle } from "./routeManifest";

const AttendanceShellAdapter = lazy(() =>
  import("../layouts/AttendanceShellAdapter").then((module) => ({ default: module.AttendanceShellAdapter }))
);
const AttendanceDashboard = lazy(() => import("../pages/attendance-edition/AttendanceDashboard").then((module) => ({ default: module.AttendanceDashboard })));
const AttendanceReport = lazy(() => import("../pages/attendance-edition/AttendanceReport").then((module) => ({ default: module.AttendanceReport })));
const AttendanceReportsRedirect = lazy(() => import("./attendanceReportRedirect").then((module) => ({ default: module.AttendanceReportsRedirect })));
const EmployeesList = lazy(() => import("../pages/employees/EmployeesList").then((module) => ({ default: module.EmployeesList })));
const AddEmployee = lazy(() => import("../pages/employees/EmployeeFormPage").then((module) => ({ default: module.AddEmployee })));
const EditEmployee = lazy(() => import("../pages/employees/EmployeeFormPage").then((module) => ({ default: module.EditEmployee })));
const EmployeeDetail = lazy(() => import("../pages/employees/EmployeeDetail").then((module) => ({ default: module.EmployeeDetail })));
const StaffDailyAttendance = lazy(() => import("../pages/attendance-edition/StaffDailyAttendance").then((module) => ({ default: module.StaffDailyAttendance })));
const StaffEntryLogs = lazy(() => import("../pages/attendance-edition/StaffEntryLogs").then((module) => ({ default: module.StaffEntryLogs })));
const StaffDevices = lazy(() => import("../pages/attendance-edition/StaffDevices").then((module) => ({ default: module.StaffDevices })));
const AttendanceAdminUsers = lazy(() => import("../pages/attendance-edition/AttendanceAdminUsers").then((module) => ({ default: module.AttendanceAdminUsers })));
const AuditLogsPage = lazy(() => import("../pages/settings/AuditLogs").then((module) => ({ default: module.AuditLogsPage })));
const BackupsPage = lazy(() => import("../pages/settings/Backups").then((module) => ({ default: module.BackupsPage })));
const MembersRedirect = lazy(() => import("./attendanceRouteRedirects").then((module) => ({ default: module.MembersRedirect })));
const MemberAddRedirect = lazy(() => import("./attendanceRouteRedirects").then((module) => ({ default: module.MemberAddRedirect })));
const MemberDetailRedirect = lazy(() => import("./attendanceRouteRedirects").then((module) => ({ default: module.MemberDetailRedirect })));
const MemberEditRedirect = lazy(() => import("./attendanceRouteRedirects").then((module) => ({ default: module.MemberEditRedirect })));

export const selectedRouteBundle = defineRouteBundle({
  id: "ATTENDANCE_ROUTE_MANIFEST",
  edition: "ATTENDANCE",
  layout: AttendanceShellAdapter,
  routes: [
    { key: "dashboard", path: "/dashboard", feature: "ATTENDANCE_DASHBOARD", permissions: ["ATTENDANCE_VIEW"], component: AttendanceDashboard, navigation: { surface: "main", icon: "dashboard", labelKey: "attendanceShellRoutes.dashboard", defaultLabel: "Attendance dashboard" }, order: 5 },
    { key: "employees", path: "/employees", feature: "EMPLOYEES", permissions: ["MEMBERS_VIEW"], component: EmployeesList, navigation: { surface: "main", icon: "members", labelKey: "attendanceShellRoutes.employees", defaultLabel: "Employees" }, order: 10 },
    { key: "employees-add", path: "/employees/add", feature: "EMPLOYEES", permissions: ["MEMBERS_WRITE"], component: AddEmployee, title: { labelKey: "attendanceShellRoutes.addEmployee", defaultLabel: "Add employee" }, navigation: null, parentKey: "employees", headerAction: { labelKey: "attendanceShellRoutes.addEmployee", defaultLabel: "Add employee" }, order: 11 },
    { key: "employees-detail", path: "/employees/:id", feature: "EMPLOYEES", permissions: ["MEMBERS_VIEW"], component: EmployeeDetail, title: { labelKey: "attendanceShellRoutes.employeeDetails", defaultLabel: "Employee details" }, navigation: null, parentKey: "employees", order: 12 },
    { key: "employees-edit", path: "/employees/:id/edit", feature: "EMPLOYEES", permissions: ["MEMBERS_WRITE"], component: EditEmployee, title: { labelKey: "attendanceShellRoutes.editEmployee", defaultLabel: "Edit employee" }, navigation: null, parentKey: "employees-detail", order: 13 },
    { key: "legacy-members", path: "/members", feature: "EMPLOYEES", permissions: ["MEMBERS_VIEW"], component: MembersRedirect, title: { labelKey: "attendanceShellRoutes.employees", defaultLabel: "Employees" }, navigation: null, order: 20 },
    { key: "legacy-members-add", path: "/members/add", feature: "EMPLOYEES", permissions: ["MEMBERS_WRITE"], component: MemberAddRedirect, title: { labelKey: "attendanceShellRoutes.addEmployee", defaultLabel: "Add employee" }, navigation: null, order: 21 },
    { key: "legacy-members-detail", path: "/members/:id", feature: "EMPLOYEES", permissions: ["MEMBERS_VIEW"], component: MemberDetailRedirect, title: { labelKey: "attendanceShellRoutes.employeeDetails", defaultLabel: "Employee details" }, navigation: null, order: 22 },
    { key: "legacy-members-edit", path: "/members/:id/edit", feature: "EMPLOYEES", permissions: ["MEMBERS_WRITE"], component: MemberEditRedirect, title: { labelKey: "attendanceShellRoutes.editEmployee", defaultLabel: "Edit employee" }, navigation: null, order: 23 },
    { key: "attendance-daily", path: "/attendance", feature: "ATTENDANCE_DAILY", permissions: ["ATTENDANCE_VIEW"], component: StaffDailyAttendance, navigation: { surface: "main", icon: "attendance", labelKey: "attendanceShellRoutes.dailyAttendance", defaultLabel: "Daily attendance" }, order: 30 },
    { key: "entry-logs", path: "/entry-logs", feature: "ENTRY_LOGS", permissions: ["ATTENDANCE_VIEW"], component: StaffEntryLogs, navigation: { surface: "main", icon: "entry-logs", labelKey: "attendanceShellRoutes.entryLogs", defaultLabel: "Entry logs" }, order: 40 },
    { key: "reports", path: "/reports", feature: "ATTENDANCE_REPORTS", permissions: ["ATTENDANCE_VIEW"], component: AttendanceReportsRedirect, title: { labelKey: "attendanceShellRoutes.attendanceReport", defaultLabel: "Attendance report" }, navigation: null, order: 45 },
    { key: "reports-attendance", path: "/reports/attendance", feature: "ATTENDANCE_REPORTS", permissions: ["ATTENDANCE_VIEW"], component: AttendanceReport, navigation: { surface: "main", icon: "reports", labelKey: "attendanceShellRoutes.attendanceReport", defaultLabel: "Attendance report" }, order: 46 },
    { key: "devices", path: "/devices", feature: "DEVICES", permissions: ["DEVICES_VIEW"], component: StaffDevices, navigation: { surface: "main", icon: "devices", labelKey: "attendanceShellRoutes.devices", defaultLabel: "Devices" }, order: 50 },
    { key: "admin-users", path: "/settings/admin-users", feature: "ADMIN_USERS", permissions: ["ADMIN_USERS_MANAGE"], component: AttendanceAdminUsers, navigation: { surface: "settings", icon: "admin-users", labelKey: "attendanceShellRoutes.accessUsers", defaultLabel: "Access users" }, order: 60 },
    { key: "settings-audit-logs", path: "/settings/audit-logs", feature: "AUDIT_LOGS", permissions: ["AUDIT_LOG_VIEW"], component: AuditLogsPage, navigation: { surface: "settings", icon: "audit-logs", labelKey: "attendanceShellRoutes.auditLogs", defaultLabel: "Audit logs" }, order: 70 },
    { key: "settings-backups", path: "/settings/backups", feature: "BACKUPS", permissions: ["BACKUP_CREATE", "BACKUP_SETTINGS_MANAGE", "RESTORE_DATABASE"], component: BackupsPage, navigation: { surface: "settings", icon: "backups", labelKey: "attendanceShellRoutes.backups", defaultLabel: "Backups" }, order: 80 },
  ],
});
