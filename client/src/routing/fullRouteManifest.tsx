import { lazy } from "react";
import { defineRouteBundle } from "./routeManifest";

const FullShellAdapter = lazy(() =>
  import("../layouts/FullShellAdapter").then((module) => ({ default: module.FullShellAdapter }))
);
const DashboardHome = lazy(() =>
  import("../pages/DashboardHome").then((module) => ({ default: module.DashboardHome }))
);
const AttendanceDaily = lazy(() =>
  import("../pages/AttendanceDaily").then((module) => ({ default: module.AttendanceDaily }))
);
const Attendance = lazy(() =>
  import("../pages/Attendance").then((module) => ({ default: module.Attendance }))
);
const Devices = lazy(() => import("../pages/devices/Devices").then((module) => ({ default: module.Devices })));
const MembersList = lazy(() =>
  import("../pages/members/MembersList").then((module) => ({ default: module.MembersList }))
);
const AddMember = lazy(() =>
  import("../pages/members/AddMember").then((module) => ({ default: module.AddMember }))
);
const MemberDetail = lazy(() =>
  import("../pages/members/MemberDetail").then((module) => ({ default: module.MemberDetail }))
);
const EditMember = lazy(() =>
  import("../pages/members/EditMember").then((module) => ({ default: module.EditMember }))
);
const PaymentsRedirect = lazy(() =>
  import("./fullRouteRedirects").then((module) => ({ default: module.PaymentsRedirect }))
);
const MembershipPaymentsPage = lazy(() =>
  import("../pages/payments/Payments").then((module) => ({ default: module.MembershipPaymentsPage }))
);
const PayrollPaymentsPage = lazy(() =>
  import("../pages/payments/Payments").then((module) => ({ default: module.PayrollPaymentsPage }))
);
const ExpensesPage = lazy(() =>
  import("../pages/payments/ExpensesPage").then((module) => ({ default: module.ExpensesPage }))
);
const Reports = lazy(() => import("../pages/Reports").then((module) => ({ default: module.Reports })));
const AttendanceReportPage = lazy(() =>
  import("../pages/reports/AttendanceReportPage").then((module) => ({ default: module.AttendanceReportPage }))
);
const CustomerActivityReportPage = lazy(() =>
  import("../pages/reports/CustomerActivityReportPage").then((module) => ({ default: module.CustomerActivityReportPage }))
);
const DebtAgingReportPage = lazy(() =>
  import("../pages/reports/DebtAgingReportPage").then((module) => ({ default: module.DebtAgingReportPage }))
);
const RenewalForecastReportPage = lazy(() =>
  import("../pages/reports/RenewalForecastReportPage").then((module) => ({ default: module.RenewalForecastReportPage }))
);
const PayrollVarianceReportPage = lazy(() =>
  import("../pages/reports/PayrollVarianceReportPage").then((module) => ({ default: module.PayrollVarianceReportPage }))
);
const AttendanceComplianceReportPage = lazy(() =>
  import("../pages/reports/AttendanceComplianceReportPage").then((module) => ({ default: module.AttendanceComplianceReportPage }))
);
const CashflowReportPage = lazy(() =>
  import("../pages/reports/CashflowReportPage").then((module) => ({ default: module.CashflowReportPage }))
);
const AdminUsersPage = lazy(() =>
  import("../pages/settings/AdminUsers").then((module) => ({ default: module.AdminUsersPage }))
);
const AuditLogsPage = lazy(() =>
  import("../pages/settings/AuditLogs").then((module) => ({ default: module.AuditLogsPage }))
);
const StaffGroups = lazy(() =>
  import("../pages/settings/StaffGroups").then((module) => ({ default: module.StaffGroups }))
);
const MembershipPlans = lazy(() =>
  import("../pages/settings/MembershipPlans").then((module) => ({ default: module.MembershipPlans }))
);
const SoundSettingsPage = lazy(() =>
  import("../pages/settings/SoundSettings").then((module) => ({ default: module.SoundSettingsPage }))
);
const BackupsPage = lazy(() =>
  import("../pages/settings/Backups").then((module) => ({ default: module.BackupsPage }))
);

export const selectedRouteBundle = defineRouteBundle({
  id: "FULL_ROUTE_MANIFEST",
  edition: "FULL",
  layout: FullShellAdapter,
  routes: [
    { key: "dashboard", path: "/dashboard", feature: "ATTENDANCE_DASHBOARD", permissions: ["ATTENDANCE_VIEW"], component: DashboardHome, navigation: { surface: "main", icon: "dashboard", labelKey: "nav.dashboard", defaultLabel: "Dashboard" }, order: 10 },
    { key: "members", path: "/members", feature: "CUSTOMERS", permissions: ["MEMBERS_VIEW"], component: MembersList, navigation: { surface: "main", icon: "members", labelKey: "nav.members", defaultLabel: "Members" }, order: 20 },
    { key: "attendance", path: "/attendance", feature: "ATTENDANCE_DAILY", permissions: ["ATTENDANCE_VIEW"], component: AttendanceDaily, navigation: { surface: "main", icon: "attendance", labelKey: "nav.attendanceDaily", defaultLabel: "Daily attendance" }, order: 30 },
    { key: "entry-logs", path: "/entry-logs", feature: "ENTRY_LOGS", permissions: ["ATTENDANCE_VIEW"], component: Attendance, navigation: { surface: "main", icon: "entry-logs", labelKey: "nav.attendance", defaultLabel: "Entry logs" }, order: 40 },
    { key: "payments", path: "/payments", feature: "CUSTOMER_PAYMENTS", permissions: ["PAYMENTS_RECORD", "MEMBERSHIPS_WRITE"], component: PaymentsRedirect, title: { labelKey: "nav.paymentsMemberships", defaultLabel: "Payments" }, navigation: null, order: 50 },
    { key: "payments-memberships", path: "/payments/memberships", feature: "CUSTOMER_PAYMENTS", permissions: ["PAYMENTS_RECORD", "MEMBERSHIPS_WRITE"], component: MembershipPaymentsPage, navigation: { surface: "main", icon: "membership-payments", labelKey: "nav.paymentsMemberships", defaultLabel: "Membership payments" }, order: 51 },
    { key: "payments-payroll", path: "/payments/payroll", feature: "PAYROLL", permissions: ["PAYROLL_MANAGE"], component: PayrollPaymentsPage, navigation: { surface: "main", icon: "payroll", labelKey: "nav.paymentsPayroll", defaultLabel: "Payroll payments" }, order: 52 },
    { key: "payments-expenses", path: "/payments/expenses", feature: "EXPENSES", permissions: ["EXPENSES_MANAGE"], component: ExpensesPage, navigation: { surface: "main", icon: "expenses", labelKey: "nav.paymentsExpenses", defaultLabel: "Expenses" }, order: 53 },
    { key: "devices", path: "/devices", feature: "DEVICES", permissions: ["DEVICES_VIEW"], component: Devices, navigation: { surface: "main", icon: "devices", labelKey: "nav.devices", defaultLabel: "Devices" }, order: 60 },
    { key: "reports", path: "/reports", feature: "FINANCIAL_REPORTS", permissions: ["FINANCIAL_REPORTS_VIEW", "ATTENDANCE_VIEW", "MEMBERS_VIEW", "PAYROLL_MANAGE"], component: Reports, navigation: { surface: "main", icon: "reports", labelKey: "nav.reports", defaultLabel: "Reports" }, order: 70 },
    { key: "reports-attendance", path: "/reports/attendance", feature: "ATTENDANCE_REPORTS", permissions: ["ATTENDANCE_VIEW"], component: AttendanceReportPage, title: { labelKey: "attendanceReport.header.title", defaultLabel: "Attendance report" }, navigation: null, parentKey: "reports", order: 71 },
    { key: "reports-customer-activity", path: "/reports/customer-activity", feature: "CUSTOMERS", permissions: ["MEMBERS_VIEW"], component: CustomerActivityReportPage, title: { labelKey: "customerActivityReport.header.title", defaultLabel: "Customer activity" }, navigation: null, parentKey: "reports", order: 72 },
    { key: "reports-debt-aging", path: "/reports/debt-aging", feature: "FINANCIAL_REPORTS", permissions: ["FINANCIAL_REPORTS_VIEW"], component: DebtAgingReportPage, title: { labelKey: "debtAgingReport.header.title", defaultLabel: "Debt aging" }, navigation: null, parentKey: "reports", order: 73 },
    { key: "reports-renewal-forecast", path: "/reports/renewal-forecast", feature: "FINANCIAL_REPORTS", permissions: ["FINANCIAL_REPORTS_VIEW"], component: RenewalForecastReportPage, title: { labelKey: "renewalForecastReport.header.title", defaultLabel: "Renewal forecast" }, navigation: null, parentKey: "reports", order: 74 },
    { key: "reports-payroll-variance", path: "/reports/payroll-variance", feature: "PAYROLL", permissions: ["PAYROLL_MANAGE"], component: PayrollVarianceReportPage, title: { labelKey: "payrollVarianceReport.header.title", defaultLabel: "Payroll variance" }, navigation: null, parentKey: "reports", order: 75 },
    { key: "reports-attendance-compliance", path: "/reports/attendance-compliance", feature: "ATTENDANCE_COMPLIANCE", permissions: ["ATTENDANCE_VIEW"], component: AttendanceComplianceReportPage, title: { labelKey: "attendanceComplianceReport.header.title", defaultLabel: "Attendance compliance" }, navigation: null, parentKey: "reports", order: 76 },
    { key: "reports-cashflow", path: "/reports/cashflow", feature: "FINANCIAL_REPORTS", permissions: ["FINANCIAL_REPORTS_VIEW"], component: CashflowReportPage, title: { labelKey: "cashflowReport.header.title", defaultLabel: "Cashflow" }, navigation: null, parentKey: "reports", order: 77 },
    { key: "members-add", path: "/members/add", feature: "CUSTOMERS", permissions: ["MEMBERS_WRITE"], component: AddMember, title: { labelKey: "members.actions.add", defaultLabel: "Add member" }, navigation: null, parentKey: "members", headerAction: { labelKey: "members.actions.add", defaultLabel: "Add member" }, order: 80 },
    { key: "members-detail", path: "/members/:id", feature: "CUSTOMERS", permissions: ["MEMBERS_VIEW"], component: MemberDetail, title: { labelKey: "memberDetail.title", defaultLabel: "Member details" }, navigation: null, parentKey: "members", order: 81 },
    { key: "members-edit", path: "/members/:id/edit", feature: "CUSTOMERS", permissions: ["MEMBERS_WRITE"], component: EditMember, title: { labelKey: "members.actions.edit", defaultLabel: "Edit member" }, navigation: null, parentKey: "members", order: 82 },
    { key: "settings-admin-users", path: "/settings/admin-users", feature: "ADMIN_USERS", permissions: ["ADMIN_USERS_MANAGE"], component: AdminUsersPage, navigation: { surface: "settings", icon: "admin-users", labelKey: "settings.menu.adminUsers", defaultLabel: "Admin users" }, order: 100 },
    { key: "settings-audit-logs", path: "/settings/audit-logs", feature: "AUDIT_LOGS", permissions: ["AUDIT_LOG_VIEW"], component: AuditLogsPage, navigation: { surface: "settings", icon: "audit-logs", labelKey: "settings.menu.auditLogs", defaultLabel: "Audit logs" }, order: 110 },
    { key: "settings-membership-plans", path: "/settings/membership-plans", feature: "MEMBERSHIPS", permissions: ["MEMBERSHIPS_WRITE", "SYSTEM_SETTINGS_MANAGE"], component: MembershipPlans, navigation: { surface: "settings", icon: "membership-plans", labelKey: "settings.menu.membershipPlans", defaultLabel: "Membership plans" }, order: 120 },
    { key: "settings-staff-groups", path: "/settings/staff-groups", feature: "STAFF_GROUPS", permissions: ["MEMBERS_VIEW", "SYSTEM_SETTINGS_MANAGE"], component: StaffGroups, navigation: { surface: "settings", icon: "staff-groups", labelKey: "settings.menu.staffGroups", defaultLabel: "Staff groups" }, order: 130 },
    { key: "settings-sounds", path: "/settings/sounds", feature: "SOUNDS", permissions: ["SIGN_IN", "SOUND_SETTINGS_MANAGE"], component: SoundSettingsPage, navigation: { surface: "settings", icon: "sounds", labelKey: "settings.menu.soundSettings", defaultLabel: "Sound settings" }, order: 140 },
    { key: "settings-backups", path: "/settings/backups", feature: "BACKUPS", permissions: ["BACKUP_CREATE", "BACKUP_SETTINGS_MANAGE", "RESTORE_DATABASE"], component: BackupsPage, navigation: { surface: "settings", icon: "backups", labelKey: "settings.menu.backups", defaultLabel: "Backups" }, order: 150 },
  ],
});
