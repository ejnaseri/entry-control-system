import type { AdminRole } from "../../api/auth";

const english = () => ({
  title: "Access users", subtitle: "Create logins and assign Attendance roles.", add: "Add user", edit: "Edit user",
  username: "Username", fullName: "Full name", email: "Email", password: "Password", role: "Role", status: "Status",
  active: "Active", inactive: "Inactive", save: "Save", cancel: "Cancel", resetPassword: "Reset password",
  deactivate: "Deactivate", reactivate: "Reactivate", loading: "Loading…", failed: "The user operation failed.",
  success: "Operation completed.", passwordHint: "Leave blank to keep the current password.", legacy: "Legacy restricted role",
  settings: "Settings", retry: "Retry", noUsers: "No access users found.", actions: "Actions",
});
export type AdminUserCopy = ReturnType<typeof english>;
const dari = (): AdminUserCopy => ({ ...english(), title: "کاربران دسترسی", subtitle: "حساب ورود بسازید و نقش‌های حاضری را تعیین کنید.", add: "افزودن کاربر", edit: "ویرایش کاربر", username: "نام کاربری", fullName: "نام کامل", email: "ایمیل", password: "رمز عبور", role: "نقش", status: "وضعیت", active: "فعال", inactive: "غیرفعال", save: "ذخیره", cancel: "لغو", resetPassword: "بازنشانی رمز", deactivate: "غیرفعال‌سازی", reactivate: "فعال‌سازی دوباره", loading: "در حال بارگذاری…", failed: "عملیات کاربر انجام نشد.", success: "عملیات انجام شد.", passwordHint: "برای حفظ رمز فعلی خالی بگذارید.", legacy: "نقش قدیمی محدودشده", settings: "تنظیمات", retry: "تلاش دوباره", noUsers: "کاربر دسترسی پیدا نشد.", actions: "عملیات" });
const pashto = (): AdminUserCopy => ({ ...english(), title: "د لاسرسي کاروونکي", subtitle: "د ننوتلو حسابونه او د حاضرۍ رولونه تنظیم کړئ.", add: "کاروونکی زیاتول", edit: "کاروونکی سمول", username: "کارن نوم", fullName: "بشپړ نوم", email: "برېښنالیک", password: "پټنوم", role: "رول", status: "حالت", active: "فعال", inactive: "غیرفعال", save: "خوندي کول", cancel: "لغوه", resetPassword: "پټنوم بیا ټاکل", deactivate: "غیرفعالول", reactivate: "بیا فعالول", loading: "بارېږي…", failed: "د کاروونکي عملیات ناکام شول.", success: "عملیات بشپړ شول.", passwordHint: "د اوسني پټنوم ساتلو لپاره تش پرېږدئ.", legacy: "محدود پخوانی رول", settings: "امستنې", retry: "بیا هڅه", noUsers: "د لاسرسي کاروونکي ونه موندل شول.", actions: "کړنې" });

export function getAdminUserCopy(language: string): AdminUserCopy {
  const code = language.split("-")[0];
  return code === "fa" ? dari() : code === "ps" ? pashto() : english();
}

export function getAttendanceRoleLabel(role: AdminRole, language: string, legacyLabel: string): string {
  const code = language.split("-")[0];
  const labels: Record<string, Partial<Record<AdminRole, string>>> = {
    en: { GYM_OWNER: "Attendance Owner", MANAGER: "Attendance Manager", OPERATOR: "Attendance Operator", DEVICE_OPERATOR: "Device Technician", READ_ONLY_AUDITOR: "Read-only Attendance Auditor", VENDOR_OWNER: "Vendor Maintenance" },
    fa: { GYM_OWNER: "مالک حاضری", MANAGER: "مدیر حاضری", OPERATOR: "اپراتور حاضری", DEVICE_OPERATOR: "تخنیکر دستگاه", READ_ONLY_AUDITOR: "بازرس فقط‌خواندنی حاضری", VENDOR_OWNER: "نگهداری فروشنده" },
    ps: { GYM_OWNER: "د حاضرۍ مالک", MANAGER: "د حاضرۍ مدیر", OPERATOR: "د حاضرۍ چلوونکی", DEVICE_OPERATOR: "د وسیلې تخنیکر", READ_ONLY_AUDITOR: "د حاضرۍ یوازې لوستونکی پلټونکی", VENDOR_OWNER: "د پلورونکي ساتنه" },
  };
  return labels[code]?.[role] ?? labels.en?.[role] ?? legacyLabel;
}
