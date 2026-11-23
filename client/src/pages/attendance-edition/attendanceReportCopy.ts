import type { Kpis } from "../reports/attendance-report/types";

export type AttendanceEditionReportCopy = ReturnType<typeof english>;

const english = () => ({
  title: "Attendance report",
  subtitle: "Employee attendance analysis by date, shift, group, device, and event.",
  daily: "Daily",
  employees: "Employees",
  evidence: "Evidence",
  monthlyTimecard: "Monthly Timecard",
  loadFailed: "Attendance report data could not be loaded.",
  exportCompleted: "Attendance report export completed.",
  exportFailed: "Attendance report export could not be generated.",
  timecard: {
    month: "Month", employee: "Employee", group: "Staff group", scheduled: "Scheduled", actual: "Actual",
    sessions: "Paired sessions", present: "Present days", absent: "Absent days", justified: "Justified days",
    late: "Late", earlyLeave: "Early leave", overtime: "Overtime", missing: "Missing punch",
    invalid: "Invalid punch", dailyDetails: "Daily details", noRows: "No monthly timecards found.",
    exportCsv: "Timecard CSV", exportXlsx: "Timecard XLSX", exportPdf: "Timecard PDF",
    loading: "Loading…", previous: "Previous", next: "Next", hoursShort: "h", minutesShort: "m",
    statuses: { ABSENT: "Absent", LATE: "Late", PRESENT: "Present", INSIDE: "Inside", JUSTIFIED: "Justified" },
  },
  kpis: {
    presentDays: "Present employee-days",
    absentDays: "Absent employee-days",
    lateCount: "Late arrivals",
    lateMinutes: "Late minutes",
    earlyLeaveCount: "Early leaves",
    earlyLeaveMinutes: "Early-leave minutes",
    overtimeMinutes: "Overtime minutes",
    justifiedCount: "Justified absences",
    unscheduledPresentCount: "Unscheduled presence",
    deniedCount: "Denied events",
    noCheckoutCount: "Missing checkout",
  } satisfies Record<keyof Kpis, string>,
});

const dari = (): AttendanceEditionReportCopy => ({
  ...english(),
  title: "گزارش حاضری",
  subtitle: "تحلیل حاضری کارمندان بر اساس تاریخ، شیفت، گروه، دستگاه و رویداد.",
  daily: "روزانه",
  employees: "کارمندان",
  evidence: "شواهد",
  monthlyTimecard: "تایم‌کارت ماهانه",
  loadFailed: "اطلاعات گزارش حاضری بارگذاری نشد.",
  exportCompleted: "خروجی گزارش حاضری آماده شد.",
  exportFailed: "خروجی گزارش حاضری ساخته نشد.",
  timecard: {
    month: "ماه", employee: "کارمند", group: "گروه کارمندان", scheduled: "برنامه‌ریزی‌شده", actual: "واقعی",
    sessions: "جلسه‌های جفت‌شده", present: "روزهای حضور", absent: "روزهای غیبت", justified: "روزهای موجه",
    late: "تأخیر", earlyLeave: "خروج زودهنگام", overtime: "اضافه‌کاری", missing: "ثبت ناقص",
    invalid: "ثبت نامعتبر", dailyDetails: "جزئیات روزانه", noRows: "تایم‌کارت ماهانه‌ای پیدا نشد.",
    exportCsv: "CSV تایم‌کارت", exportXlsx: "XLSX تایم‌کارت", exportPdf: "PDF تایم‌کارت",
    loading: "در حال بارگذاری…", previous: "قبلی", next: "بعدی", hoursShort: "ساعت", minutesShort: "دقیقه",
    statuses: { ABSENT: "غایب", LATE: "دیرآمده", PRESENT: "حاضر", INSIDE: "داخل", JUSTIFIED: "موجه" },
  },
  kpis: {
    presentDays: "روز-کارمند حاضر",
    absentDays: "روز-کارمند غایب",
    lateCount: "تعداد تأخیر",
    lateMinutes: "دقایق تأخیر",
    earlyLeaveCount: "خروج زودهنگام",
    earlyLeaveMinutes: "دقایق خروج زودهنگام",
    overtimeMinutes: "دقایق اضافه‌کاری",
    justifiedCount: "غیبت موجه",
    unscheduledPresentCount: "حضور بدون برنامه",
    deniedCount: "رویدادهای ردشده",
    noCheckoutCount: "خروج ثبت‌نشده",
  },
});

const pashto = (): AttendanceEditionReportCopy => ({
  ...dari(),
  title: "د حاضرۍ راپور",
  subtitle: "د نېټې، شیفټ، ډلې، وسیلې او پېښې له مخې د کارکوونکو د حاضرۍ شننه.",
  daily: "ورځنی",
  employees: "کارکوونکي",
  evidence: "شواهد",
  monthlyTimecard: "میاشتنی وخت‌کارت",
  loadFailed: "د حاضرۍ راپور معلومات پورته نه شول.",
  exportCompleted: "د حاضرۍ راپور صادر شو.",
  exportFailed: "د حاضرۍ راپور صادر نه شو.",
  timecard: {
    month: "میاشت", employee: "کارکوونکی", group: "د کارکوونکو ډله", scheduled: "پلان شوی", actual: "حقیقي",
    sessions: "جوړه شوې ناستې", present: "د حضور ورځې", absent: "د غیابت ورځې", justified: "موجه ورځې",
    late: "ناوخته", earlyLeave: "ژر وتل", overtime: "اضافه کار", missing: "نیمګړی ثبت",
    invalid: "ناسم ثبت", dailyDetails: "ورځني جزئیات", noRows: "میاشتنی وخت‌کارت ونه موندل شو.",
    exportCsv: "د وخت‌کارت CSV", exportXlsx: "د وخت‌کارت XLSX", exportPdf: "د وخت‌کارت PDF",
    loading: "بارېږي…", previous: "مخکینی", next: "بل", hoursShort: "ساعت", minutesShort: "دقیقه",
    statuses: { ABSENT: "غایب", LATE: "ناوخته", PRESENT: "حاضر", INSIDE: "دننه", JUSTIFIED: "موجه" },
  },
  kpis: {
    presentDays: "حاضر کارکوونکي-ورځې",
    absentDays: "غایب کارکوونکي-ورځې",
    lateCount: "د ناوخته راتګ شمېر",
    lateMinutes: "د ناوخته دقیقې",
    earlyLeaveCount: "ژر وتل",
    earlyLeaveMinutes: "د ژر وتلو دقیقې",
    overtimeMinutes: "د اضافه کار دقیقې",
    justifiedCount: "موجه غیابت",
    unscheduledPresentCount: "بې پروګرامه حضور",
    deniedCount: "رد شوې پېښې",
    noCheckoutCount: "وتل نه دي ثبت شوي",
  },
});

export function getAttendanceEditionReportCopy(language: string): AttendanceEditionReportCopy {
  const code = language.split("-")[0];
  if (code === "fa") return dari();
  if (code === "ps") return pashto();
  return english();
}
