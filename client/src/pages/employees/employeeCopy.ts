export type EmployeeCopy = ReturnType<typeof englishCopy>;

const englishCopy = () => ({
  employees: "Employees", addEmployee: "Add employee", editEmployee: "Edit employee", employeeDetails: "Employee details",
  search: "Search by name, code or phone", searchAction: "Search", filters: "Filters", status: "Status", group: "Staff group", all: "All", active: "Active",
  blocked: "Blocked", archived: "Archived", includeArchived: "Include archived", code: "Employee code", name: "Name",
  contact: "Contact", role: "Role", actions: "Actions", view: "View", edit: "Edit", retry: "Retry", noEmployees: "No employees found.",
  loading: "Loading…", previous: "Previous", next: "Next", showing: "Showing", of: "of", personal: "Personal information",
  schedule: "Schedule and access", work: "Work profile", firstName: "First name", lastName: "Last name", fatherName: "Father name",
  phone: "Phone", email: "Email", gender: "Gender", male: "Male", female: "Female", other: "Other", birthDate: "Birth date",
  nationalId: "National ID", position: "Position", department: "Department", systemRole: "System role", customTitle: "Custom title",
  notes: "Notes", allowedDays: "Allowed days", accessTime: "Access time", from: "From", to: "To", selectGroup: "Select a staff group",
  customShift: "Use a custom shift", shiftName: "Shift name", shiftStart: "Shift start", shiftEnd: "Shift end", grace: "Grace minutes",
  earlyAccess: "Early access minutes", overtime: "Allow overtime", maxOvertime: "Maximum overtime per day (minutes)", save: "Save",
  cancel: "Cancel", required: "Complete the required fields and select a group or custom shift.", saveFailed: "Employee could not be saved.",
  loadFailed: "Employee data could not be loaded.", archive: "Archive", restore: "Restore", overview: "Overview", attendance: "Recent attendance",
  noAttendance: "No attendance events found.", noShifts: "No shifts assigned.", event: "Event", eventTime: "Date and time", source: "Source", result: "Result",
  in: "IN", out: "OUT", authorized: "Authorized", denied: "Denied", logout: "Sign out",
  employeeOnly: "This area contains employees only.", employee: "Employee", access: "Access", assignedShifts: "Assigned shifts", recentEvents: "Recent events",
  maxEntries: "Maximum entries per day", unlimited: "Unlimited", noAccessRanges: "No restricted access times.",
  enrollOnSave: "Enroll when saved", enrollmentQueued: "Fingerprint enrollment will start after the employee is saved.",
  enrollmentFailed: "Fingerprint enrollment failed.", employeeSavedEnrollmentFailed: "The employee was saved, but enrollment failed.",
  selectEnrollmentDevice: "Select a fingerprint device.", enrollmentCodeRequired: "Enter a numeric employee code before enrollment.",
  enrollmentNameRequired: "Enter the employee name before enrollment.", selectFinger: "Choose a finger before enrollment.",
  suggestCodeFailed: "A device user ID could not be suggested.",
  days: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as string[],
});

const dariCopy = (): EmployeeCopy => ({
  ...englishCopy(), employees: "کارمندان", addEmployee: "افزودن کارمند", editEmployee: "ویرایش کارمند", employeeDetails: "جزئیات کارمند",
  search: "جستجو با نام، کد یا شماره", searchAction: "جستجو", filters: "فیلترها", status: "وضعیت", group: "گروه کارمندان", all: "همه", active: "فعال", blocked: "مسدود",
  archived: "آرشیف‌شده", includeArchived: "نمایش آرشیف‌شده‌ها", code: "کد کارمند", name: "نام", contact: "تماس", role: "نقش",
  actions: "عملیات", view: "مشاهده", edit: "ویرایش", retry: "تلاش دوباره", noEmployees: "کارمندی پیدا نشد.", loading: "در حال بارگذاری…",
  previous: "قبلی", next: "بعدی", showing: "نمایش", of: "از", personal: "اطلاعات شخصی", schedule: "شیفت و دسترسی",
  work: "پروفایل کاری", firstName: "نام", lastName: "تخلص", fatherName: "نام پدر", phone: "شماره تماس", email: "ایمیل",
  gender: "جنسیت", male: "مرد", female: "زن", other: "دیگر", birthDate: "تاریخ تولد", nationalId: "تذکره/شناسه ملی",
  position: "سمت", department: "بخش", systemRole: "نقش سیستمی", customTitle: "عنوان دلخواه", notes: "یادداشت",
  allowedDays: "روزهای مجاز", accessTime: "زمان دسترسی", from: "از", to: "تا", selectGroup: "یک گروه کارمندان انتخاب کنید",
  customShift: "استفاده از شیفت دلخواه", shiftName: "نام شیفت", shiftStart: "شروع شیفت", shiftEnd: "پایان شیفت",
  grace: "دقایق مهلت", earlyAccess: "دقایق ورود زودتر", overtime: "اجازه اضافه‌کاری", maxOvertime: "حداکثر اضافه‌کاری روزانه (دقیقه)",
  save: "ذخیره", cancel: "لغو", required: "فیلدهای ضروری را تکمیل و یک گروه یا شیفت دلخواه انتخاب کنید.",
  saveFailed: "ذخیره کارمند انجام نشد.", loadFailed: "اطلاعات کارمند بارگذاری نشد.", archive: "آرشیف", restore: "بازگردانی",
  overview: "نمای کلی", attendance: "حاضری اخیر", noAttendance: "رویداد حاضری پیدا نشد.", noShifts: "شیفتی تعیین نشده است.",
  event: "رویداد", eventTime: "تاریخ و زمان", source: "منبع", result: "نتیجه", in: "ورود", out: "خروج",
  authorized: "مجاز", denied: "ردشده", logout: "خروج", employeeOnly: "این بخش فقط شامل کارمندان است.", employee: "کارمند",
  access: "دسترسی", assignedShifts: "شیفت‌های تعیین‌شده", recentEvents: "رویدادهای اخیر", maxEntries: "حداکثر ورود روزانه",
  unlimited: "بدون محدودیت", noAccessRanges: "محدودیت زمانی برای دسترسی تعیین نشده است.",
  enrollOnSave: "ثبت هنگام ذخیره", enrollmentQueued: "ثبت اثر انگشت پس از ذخیرهٔ کارمند آغاز می‌شود.",
  enrollmentFailed: "ثبت اثر انگشت ناموفق بود.", employeeSavedEnrollmentFailed: "کارمند ذخیره شد، اما ثبت اثر انگشت ناموفق بود.",
  selectEnrollmentDevice: "یک دستگاه اثر انگشت انتخاب کنید.", enrollmentCodeRequired: "پیش از ثبت، کد عددی کارمند را وارد کنید.",
  enrollmentNameRequired: "پیش از ثبت، نام کارمند را وارد کنید.", selectFinger: "پیش از ثبت یک انگشت انتخاب کنید.",
  suggestCodeFailed: "پیشنهاد شناسهٔ کاربر دستگاه ممکن نشد.",
  days: ["یکشنبه", "دوشنبه", "سه‌شنبه", "چهارشنبه", "پنجشنبه", "جمعه", "شنبه"],
});

const pashtoCopy = (): EmployeeCopy => ({
  ...dariCopy(), employees: "کارکوونکي", addEmployee: "کارکوونکی زیات کړئ", editEmployee: "کارکوونکی سمول", employeeDetails: "د کارکوونکي جزئیات",
  search: "په نوم، کوډ یا ټیلیفون لټون", searchAction: "لټون", filters: "چاڼګرونه", status: "حالت", group: "د کارکوونکو ډله", all: "ټول", active: "فعال",
  blocked: "بند", archived: "آرشیف شوی", includeArchived: "آرشیف شوي وښایئ", code: "د کارکوونکي کوډ", name: "نوم",
  contact: "اړیکه", role: "دنده", actions: "عملیات", view: "کتل", edit: "سمول", retry: "بیا هڅه", noEmployees: "کارکوونکی ونه موندل شو.",
  loading: "بارېږي…", previous: "مخکینی", next: "بل", personal: "شخصي معلومات", schedule: "شیفټ او لاسرسی",
  work: "کاري پروفایل", firstName: "نوم", lastName: "تخلص", fatherName: "د پلار نوم", phone: "ټیلیفون", email: "برېښنالیک",
  save: "خوندي کول", cancel: "لغوه", archive: "آرشیف", restore: "بیا فعالول", overview: "لنډیز",
  attendance: "وروستۍ حاضري", noAttendance: "د حاضرۍ پېښه ونه موندل شوه.", noShifts: "هېڅ شیفټ نه دی ټاکل شوی.",
  event: "پېښه", eventTime: "نېټه او وخت", source: "سرچینه", result: "پایله", logout: "وتل",
  employeeOnly: "په دې برخه کې یوازې کارکوونکي شته.", employee: "کارکوونکی", access: "لاسرسی",
  assignedShifts: "ټاکل شوي شیفټونه", recentEvents: "وروستۍ پېښې", maxEntries: "د ورځې اعظمي ننوتل",
  unlimited: "بې محدودیته", noAccessRanges: "د لاسرسي د وخت محدودیت نشته.",
  enrollOnSave: "د خوندي کولو پر مهال ثبت", enrollmentQueued: "د ګوتې ثبت به د کارکوونکي له خوندي کېدو وروسته پیل شي.",
  enrollmentFailed: "د ګوتې ثبت ناکام شو.", employeeSavedEnrollmentFailed: "کارکوونکی خوندي شو، خو د ګوتې ثبت ناکام شو.",
  selectEnrollmentDevice: "د ګوتې نښې وسیله وټاکئ.", enrollmentCodeRequired: "له ثبت مخکې د کارکوونکي عددي کوډ ولیکئ.",
  enrollmentNameRequired: "له ثبت مخکې د کارکوونکي نوم ولیکئ.", selectFinger: "له ثبت مخکې یوه ګوته وټاکئ.",
  suggestCodeFailed: "د وسیلې د کارن پېژند وړاندیز ونه شو.",
  days: ["یکشنبه", "دوشنبه", "سه‌شنبه", "چهارشنبه", "پنجشنبه", "جمعه", "شنبه"],
});

export function getEmployeeCopy(language: string): EmployeeCopy {
  const base = language.split("-")[0];
  if (base === "fa") return dariCopy();
  if (base === "ps") return pashtoCopy();
  return englishCopy();
}
