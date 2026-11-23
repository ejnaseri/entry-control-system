export type AttendanceCopy = ReturnType<typeof english>;

const english = () => ({
  daily: "Daily attendance", entryLogs: "Entry logs", report: "Attendance report", operationalOnly: "Employee attendance records only.",
  today: "Today", yesterday: "Yesterday", previousDay: "Previous day", nextDay: "Next day", customDate: "Custom date",
  search: "Search employees", group: "Staff group", shift: "Shift", shiftMode: "Shift mode", all: "All", primaryShift: "Primary shift", allShifts: "All shifts",
  present: "Present", absent: "Absent", late: "Late", inside: "Inside", justified: "Justified", unscheduled: "Unscheduled",
  denied: "Denied", warnings: "Warnings", noCheckout: "No checkout", noShift: "No scheduled shift", multipleEvents: "Multiple events",
  employee: "Employee", status: "Status", firstIn: "First IN", lastOut: "Last OUT", duration: "Duration", exception: "Exception",
  lateMinutes: "Late", earlyLeave: "Early leave", overtime: "Overtime", minutes: "min", noRows: "No attendance rows found.",
  loading: "Loading…", justification: "Justification", reason: "Reason", save: "Save", remove: "Remove", cancel: "Cancel", close: "Close", retry: "Retry",
  event: "Event", source: "Source", device: "Device", result: "Result", dateRange: "Date range", from: "From", to: "To",
  recordedAt: "Recorded at", code: "Code", noLogs: "No entry logs found.",
  authorized: "Authorized", in: "IN", out: "OUT", manual: "Manual", api: "API", deviceSource: "Device",
  totalIn: "Total IN", totalOut: "Total OUT", uniqueEmployees: "Unique employees", deniedAttempts: "Denied attempts",
  previous: "Previous", next: "Next", page: "Page", addManual: "Manual entry", occurredAt: "Occurred at", notes: "Notes",
  selectEmployee: "Search and select an employee", submit: "Submit", required: "Complete the required fields.",
  loadFailed: "Attendance data could not be loaded.", saveFailed: "The attendance change could not be saved.",
  filters: "Filters", showFilters: "Show filters", hideFilters: "Hide filters", clear: "Clear", details: "Details", cardView: "Card view", rowView: "Row view", phone: "Phone", role: "Role", staffOnly: "Staff only",
  exportCsv: "Export CSV", exportXlsx: "Export XLSX", exportCompleted: "Entry Logs export completed.", exportFailed: "Entry Logs export could not be generated.",
});

const dari = (): AttendanceCopy => ({
  ...english(), daily: "حاضری روزانه", entryLogs: "لاگ ورود و خروج", report: "گزارش حاضری", operationalOnly: "فقط رویدادهای حاضری کارمندان.",
  today: "امروز", yesterday: "دیروز", previousDay: "روز قبل", nextDay: "روز بعد", customDate: "تاریخ دلخواه",
  search: "جستجوی کارمند", group: "گروه کارمندان", shift: "شیفت", shiftMode: "حالت شیفت", all: "همه", primaryShift: "شیفت اصلی", allShifts: "همه شیفت‌ها",
  present: "حاضر", absent: "غایب", late: "دیرآمده", inside: "داخل", justified: "موجه", unscheduled: "بدون برنامه",
  denied: "ردشده", warnings: "هشدارها", noCheckout: "بدون خروج", noShift: "بدون شیفت برنامه‌ریزی‌شده", multipleEvents: "رویدادهای متعدد",
  employee: "کارمند", status: "وضعیت", firstIn: "اولین ورود", lastOut: "آخرین خروج", duration: "مدت حضور", exception: "استثنا",
  lateMinutes: "تأخیر", earlyLeave: "خروج زودهنگام", overtime: "اضافه‌کاری", minutes: "دقیقه", noRows: "رکورد حاضری پیدا نشد.",
  loading: "در حال بارگذاری…", justification: "توجیه غیبت", reason: "دلیل", save: "ذخیره", remove: "حذف", cancel: "لغو", close: "بستن", retry: "تلاش دوباره",
  event: "رویداد", source: "منبع", device: "دستگاه", result: "نتیجه", dateRange: "بازه تاریخ", from: "از", to: "تا",
  authorized: "مجاز", in: "ورود", out: "خروج", manual: "دستی", api: "API", deviceSource: "دستگاه",
  totalIn: "مجموع ورود", totalOut: "مجموع خروج", uniqueEmployees: "کارمندان یکتا", deniedAttempts: "تلاش‌های ردشده",
  previous: "قبلی", next: "بعدی", page: "صفحه", addManual: "ثبت دستی", occurredAt: "زمان رویداد", notes: "یادداشت",
  selectEmployee: "کارمند را جستجو و انتخاب کنید", submit: "ثبت", required: "فیلدهای ضروری را تکمیل کنید.",
  loadFailed: "اطلاعات حاضری بارگذاری نشد.", saveFailed: "تغییر حاضری ذخیره نشد.", filters: "فیلترها", showFilters: "نمایش فیلترها", hideFilters: "پنهان‌کردن فیلترها", clear: "پاک‌کردن",
  details: "جزئیات", cardView: "نمای کارت", rowView: "نمای ردیف", phone: "شماره تماس", role: "نقش", staffOnly: "فقط کارمندان",
  exportCsv: "خروجی CSV", exportXlsx: "خروجی XLSX", exportCompleted: "خروجی لاگ‌ها آماده شد.", exportFailed: "خروجی لاگ‌ها ساخته نشد.",
});

const pashto = (): AttendanceCopy => ({
  ...dari(), daily: "ورځنۍ حاضري", entryLogs: "د ننوتلو او وتلو ثبتونه", report: "د حاضرۍ راپور", operationalOnly: "یوازې د کارکوونکو د حاضرۍ پېښې.",
  today: "نن", yesterday: "پرون", previousDay: "مخکینۍ ورځ", nextDay: "بله ورځ", customDate: "ټاکلې نېټه",
  search: "کارکوونکی ولټوئ", group: "د کارکوونکو ډله", shift: "شیفټ", shiftMode: "د شیفټ حالت", all: "ټول", primaryShift: "اصلي شیفټ", allShifts: "ټول شیفټونه",
  present: "حاضر", absent: "غایب", late: "ناوخته", inside: "دننه", justified: "موجه", unscheduled: "بې پروګرامه",
  denied: "رد شوی", warnings: "خبرتیاوې", noCheckout: "وتل نشته", noShift: "ټاکل شوی شیفټ نشته", multipleEvents: "ډېرې پېښې",
  employee: "کارکوونکی", status: "حالت", firstIn: "لومړی ننوتل", lastOut: "وروستی وتل", duration: "موده", exception: "استثنا",
  loading: "بارېږي…", justification: "د غیابت دلیل", reason: "دلیل", save: "خوندي کول", remove: "لرې کول", cancel: "لغوه", close: "تړل", retry: "بیا هڅه",
  event: "پېښه", source: "سرچینه", device: "وسیله", result: "پایله", dateRange: "د نېټې موده", from: "له", to: "تر",
  authorized: "مجاز", in: "ننوتل", out: "وتل", manual: "لاسي", deviceSource: "وسیله", uniqueEmployees: "ځانګړي کارکوونکي",
  previous: "مخکینی", next: "بل", page: "پاڼه", addManual: "لاسي ثبت", occurredAt: "د پېښې وخت", notes: "یادښت",
  selectEmployee: "کارکوونکی ولټوئ او وټاکئ", submit: "ثبت", filters: "فلټرونه", showFilters: "فلټرونه ښودل", hideFilters: "فلټرونه پټول", clear: "پاکول", details: "جزئیات",
  cardView: "د کارت بڼه", rowView: "د قطار بڼه", phone: "ټیلیفون", role: "دنده", staffOnly: "یوازې کارکوونکي",
  exportCsv: "CSV صادرول", exportXlsx: "XLSX صادرول", exportCompleted: "د ثبتونو صادرول بشپړ شول.", exportFailed: "د ثبتونو صادرول جوړ نه شول.",
});

export function getAttendanceCopy(language: string): AttendanceCopy {
  const code = language.split("-")[0];
  if (code === "fa") return dari();
  if (code === "ps") return pashto();
  return english();
}
