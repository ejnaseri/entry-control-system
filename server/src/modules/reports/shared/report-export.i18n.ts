import { z } from "zod";

export const REPORT_EXPORT_LANGUAGES = ["en", "fa", "ps"] as const;
export type ReportExportLanguage = (typeof REPORT_EXPORT_LANGUAGES)[number];

const emptyToUndefined = (value: unknown) => (value === "" || value === null ? undefined : value);

export const reportExportLanguageSchema = z
  .preprocess(emptyToUndefined, z.enum(REPORT_EXPORT_LANGUAGES).default("en"))
  .default("en");

type LabelKey =
  | "activeCustomers"
  | "activatedAt"
  | "actualPaid"
  | "actualMinutes"
  | "adjustments"
  | "absentDays"
  | "attendanceCountsNote"
  | "authorizedEvents"
  | "autoRenew"
  | "averageDebt"
  | "averageScore"
  | "bestScore"
  | "bucket"
  | "buckets"
  | "byPlan"
  | "category"
  | "checkIn"
  | "checkOut"
  | "collectionRate"
  | "compliance"
  | "count"
  | "createdAt"
  | "currentStatus"
  | "daily"
  | "dailyDetails"
  | "dailySummary"
  | "date"
  | "dateField"
  | "dateFrom"
  | "dateTo"
  | "daysLeft"
  | "daysPastDue"
  | "daysSinceLastVisit"
  | "debtAtRisk"
  | "debtors"
  | "debtorsCount"
  | "denied"
  | "deniedAttempts"
  | "device"
  | "deviceId"
  | "distribution"
  | "earlyCount"
  | "earlyLeave"
  | "earlyLeaveCount"
  | "earlyLeaveMinutes"
  | "earlyMin"
  | "employee"
  | "engagementWindow"
  | "entity"
  | "entryLogs"
  | "event"
  | "eventType"
  | "evaluatedCount"
  | "evidence"
  | "expireDate"
  | "expiringCount"
  | "expiringSoon"
  | "expenses"
  | "expenseAdjustments"
  | "expensesGross"
  | "expensesNet"
  | "expectedRenewals"
  | "expectedShifts"
  | "filters"
  | "firstVisit"
  | "forecast"
  | "from"
  | "generatedAt"
  | "groupBy"
  | "grossOutflow"
  | "horizonDays"
  | "includePayroll"
  | "invalidPunch"
  | "inactive30Days"
  | "inactive7Days"
  | "inactiveMembers"
  | "inactiveThreshold"
  | "inflow"
  | "justified"
  | "justifiedDays"
  | "label"
  | "largestDebt"
  | "lastPaymentDate"
  | "lastVisit"
  | "lateCount"
  | "lateMin"
  | "lateMinutes"
  | "lateMinShort"
  | "lifecycle"
  | "lowEngagement"
  | "lowEngagementMaxVisits"
  | "member"
  | "memberCode"
  | "memberName"
  | "memberType"
  | "membershipEnd"
  | "membershipId"
  | "membershipInflow"
  | "membershipNet"
  | "membershipRefunds"
  | "members"
  | "metric"
  | "month"
  | "monthlyTimecard"
  | "missingPunch"
  | "netCash"
  | "netOutflow"
  | "noCheckout"
  | "noCheckoutCount"
  | "noMembers"
  | "notes"
  | "onlyAnomalies"
  | "outstanding"
  | "overtime"
  | "overtimeMin"
  | "overtimeMinutes"
  | "paid"
  | "pairedSessions"
  | "payrollOutflow"
  | "paymentStatus"
  | "period"
  | "phone"
  | "plan"
  | "present"
  | "presentDays"
  | "range"
  | "reason"
  | "refunds"
  | "remaining"
  | "renewalRatePct"
  | "result"
  | "revenueAtRisk"
  | "score"
  | "search"
  | "scheduledMinutes"
  | "sharePct"
  | "shiftId"
  | "shift"
  | "shiftMode"
  | "source"
  | "staffGroupId"
  | "staffGroup"
  | "startDate"
  | "state"
  | "status"
  | "suggestedAction"
  | "suggestedPay"
  | "summary"
  | "summaryKpi"
  | "timestamp"
  | "to"
  | "topLateMembers"
  | "totalDue"
  | "totalOutflow"
  | "totalOutstanding"
  | "totalPaid"
  | "totalRemaining"
  | "totalSuggested"
  | "totalVariance"
  | "trend"
  | "type"
  | "unscheduled"
  | "unscheduledPresent"
  | "value"
  | "variance"
  | "varianceRatePct"
  | "varianceReason"
  | "viewBy"
  | "visitDays"
  | "visitedToday"
  | "worstScore";

const labels: Record<ReportExportLanguage, Record<LabelKey, string>> = {
  en: {
    activeCustomers: "Active customers",
    activatedAt: "Activated At",
    actualPaid: "Actual Paid",
    adjustments: "Adjustments",
    absentDays: "Absent Days",
    attendanceCountsNote: "Counts are generated from filtered attendance logs and shift windows.",
    authorizedEvents: "Authorized Events",
    autoRenew: "Auto Renew",
    averageDebt: "Average debt",
    averageScore: "Average score",
    bestScore: "Best score",
    bucket: "Bucket",
    buckets: "Buckets",
    byPlan: "By Plan",
    category: "Category",
    collectionRate: "Collection rate",
    compliance: "Compliance",
    count: "Count",
    createdAt: "Created At",
    currentStatus: "Current Status",
    daily: "Daily",
    dailySummary: "Daily summary",
    date: "Date",
    dateField: "Date field",
    dateFrom: "Date from",
    dateTo: "Date to",
    daysLeft: "Days Left",
    daysPastDue: "Days Past Due",
    daysSinceLastVisit: "Days Since Last Visit",
    debtAtRisk: "Debt at risk",
    debtors: "Debtors",
    debtorsCount: "Debtors count",
    denied: "Denied",
    deniedAttempts: "Denied attempts",
    device: "Device",
    deviceId: "Device id",
    distribution: "Distribution",
    earlyCount: "Early count",
    earlyLeave: "Early leave",
    earlyLeaveCount: "Early leave count",
    earlyLeaveMinutes: "Early leave minutes",
    earlyMin: "Early min",
    employee: "Employee",
    engagementWindow: "Engagement window",
    entity: "Entity",
    event: "Event",
    eventType: "Event type",
    evaluatedCount: "Evaluated count",
    evidence: "Evidence",
    expireDate: "Expire Date",
    expiringCount: "Expiring count",
    expiringSoon: "Expiring Soon",
    expenses: "Expenses",
    expenseAdjustments: "Expense Adjustments",
    expensesGross: "Expenses Gross",
    expensesNet: "Expenses Net",
    expectedRenewals: "Expected renewals",
    expectedShifts: "Expected shifts",
    filters: "Filters",
    firstVisit: "First Visit",
    forecast: "Forecast",
    from: "From",
    generatedAt: "Generated at",
    groupBy: "Group by",
    grossOutflow: "Gross Outflow",
    horizonDays: "Horizon days",
    includePayroll: "Include payroll",
    inactive30Days: "Inactive 30 days",
    inactive7Days: "Inactive 7 days",
    inactiveMembers: "Inactive Members",
    inactiveThreshold: "Inactive threshold",
    inflow: "Inflow",
    justified: "Justified",
    justifiedDays: "Justified days",
    label: "Label",
    largestDebt: "Largest debt",
    lastPaymentDate: "Last Payment Date",
    lastVisit: "Last Visit",
    lateCount: "Late Count",
    lateMin: "Late min",
    lateMinutes: "Late Minutes",
    lateMinShort: "L",
    lifecycle: "Lifecycle",
    lowEngagement: "Low engagement",
    lowEngagementMaxVisits: "Low-engagement max visits",
    member: "Member",
    memberCode: "Member code",
    memberName: "Member Name",
    memberType: "Member type",
    membershipEnd: "Membership End",
    membershipId: "Membership ID",
    membershipInflow: "Membership inflow",
    membershipNet: "Membership Net",
    membershipRefunds: "Membership refunds",
    members: "Members",
    metric: "Metric",
    month: "Month",
    netCash: "Net Cash",
    netOutflow: "Net Outflow",
    noCheckout: "No checkout",
    noCheckoutCount: "No checkout count",
    noMembers: "No members.",
    notes: "Notes",
    onlyAnomalies: "Only anomalies",
    outstanding: "Outstanding",
    overtime: "Overtime",
    overtimeMin: "Overtime min",
    overtimeMinutes: "Overtime minutes",
    paid: "Paid",
    payrollOutflow: "Payroll Outflow",
    paymentStatus: "Payment Status",
    period: "Period",
    phone: "Phone",
    plan: "Plan",
    present: "Present",
    presentDays: "Present days",
    range: "Range",
    reason: "Reason",
    refunds: "Refunds",
    remaining: "Remaining",
    renewalRatePct: "Renewal rate %",
    result: "Result",
    revenueAtRisk: "Revenue at risk",
    score: "Score",
    search: "Search",
    sharePct: "Share %",
    shiftId: "Shift id",
    shiftMode: "Shift mode",
    source: "Source",
    staffGroupId: "Staff group id",
    startDate: "Start Date",
    state: "State",
    status: "Status",
    suggestedAction: "Suggested Action",
    suggestedPay: "Suggested Pay",
    summary: "Summary",
    summaryKpi: "Summary KPI",
    timestamp: "Timestamp",
    to: "To",
    topLateMembers: "Top 20 members by late minutes",
    totalDue: "Total Due",
    totalOutflow: "Total Outflow",
    totalOutstanding: "Total outstanding",
    totalPaid: "Total Paid",
    totalRemaining: "Total Remaining",
    totalSuggested: "Total suggested",
    totalVariance: "Total variance",
    trend: "Trend",
    type: "Type",
    unscheduled: "Unscheduled",
    unscheduledPresent: "Unscheduled present",
    value: "Value",
    variance: "Variance",
    varianceRatePct: "Variance Rate %",
    varianceReason: "Variance Reason",
    viewBy: "View by",
    visitDays: "Visit Days",
    visitedToday: "Visited Today",
    actualMinutes: "Actual minutes",
    checkIn: "Check in",
    checkOut: "Check out",
    dailyDetails: "Daily details",
    entryLogs: "Entry logs",
    invalidPunch: "Invalid punch",
    missingPunch: "Missing punch",
    monthlyTimecard: "Monthly timecard",
    pairedSessions: "Paired sessions",
    scheduledMinutes: "Scheduled minutes",
    shift: "Shift",
    staffGroup: "Staff group",
    worstScore: "Worst score",
  },
  fa: {
    activeCustomers: "مشتریان فعال",
    activatedAt: "زمان فعال‌سازی",
    actualPaid: "پرداخت واقعی",
    adjustments: "اصلاحات",
    absentDays: "روزهای غیبت",
    attendanceCountsNote: "شمارش‌ها از لاگ‌های حضور فیلترشده و بازه‌های شیفت ساخته شده‌اند.",
    authorizedEvents: "رویدادهای مجاز",
    autoRenew: "تمدید خودکار",
    averageDebt: "میانگین بدهی",
    averageScore: "میانگین امتیاز",
    bestScore: "بهترین امتیاز",
    bucket: "بازه",
    buckets: "بازه‌ها",
    byPlan: "بر اساس پلن",
    category: "دسته",
    collectionRate: "نرخ دریافت",
    compliance: "انطباق",
    count: "تعداد",
    createdAt: "زمان ایجاد",
    currentStatus: "وضعیت فعلی",
    daily: "روزانه",
    dailySummary: "خلاصه روزانه",
    date: "تاریخ",
    dateField: "فیلد تاریخ",
    dateFrom: "تاریخ شروع",
    dateTo: "تاریخ پایان",
    daysLeft: "روزهای باقی‌مانده",
    daysPastDue: "روزهای گذشته از موعد",
    daysSinceLastVisit: "روز از آخرین مراجعه",
    debtAtRisk: "بدهی در خطر",
    debtors: "بدهکاران",
    debtorsCount: "تعداد بدهکاران",
    denied: "رد شده",
    deniedAttempts: "تلاش‌های رد شده",
    device: "دستگاه",
    deviceId: "شناسه دستگاه",
    distribution: "توزیع",
    earlyCount: "تعداد خروج زودهنگام",
    earlyLeave: "خروج زودهنگام",
    earlyLeaveCount: "تعداد خروج زودهنگام",
    earlyLeaveMinutes: "دقیقه خروج زودهنگام",
    earlyMin: "دقیقه خروج زودهنگام",
    employee: "کارمند",
    engagementWindow: "بازه تعامل",
    entity: "مورد",
    event: "رویداد",
    eventType: "نوع رویداد",
    evaluatedCount: "تعداد ارزیابی‌شده",
    evidence: "شواهد",
    expireDate: "تاریخ انقضا",
    expiringCount: "تعداد در آستانه انقضا",
    expiringSoon: "در آستانه انقضا",
    expenses: "مصارف",
    expenseAdjustments: "اصلاحات مصارف",
    expensesGross: "مصارف ناخالص",
    expensesNet: "مصارف خالص",
    expectedRenewals: "تمدیدهای مورد انتظار",
    expectedShifts: "شیفت‌های مورد انتظار",
    filters: "فیلترها",
    firstVisit: "اولین مراجعه",
    forecast: "پیش‌بینی",
    from: "از",
    generatedAt: "زمان تولید",
    groupBy: "گروه‌بندی",
    grossOutflow: "خروجی ناخالص",
    horizonDays: "روزهای افق",
    includePayroll: "شامل معاش",
    inactive30Days: "غیرفعال ۳۰ روز",
    inactive7Days: "غیرفعال ۷ روز",
    inactiveMembers: "اعضای غیرفعال",
    inactiveThreshold: "حد غیرفعالی",
    inflow: "ورودی",
    justified: "موجه",
    justifiedDays: "روزهای موجه",
    label: "برچسب",
    largestDebt: "بیشترین بدهی",
    lastPaymentDate: "تاریخ آخرین پرداخت",
    lastVisit: "آخرین مراجعه",
    lateCount: "تعداد تأخیر",
    lateMin: "دقیقه تأخیر",
    lateMinutes: "دقیقه تأخیر",
    lateMinShort: "ت",
    lifecycle: "چرخه",
    lowEngagement: "تعامل کم",
    lowEngagementMaxVisits: "حداکثر مراجعه برای تعامل کم",
    member: "عضو",
    memberCode: "کد عضو",
    memberName: "نام عضو",
    memberType: "نوع عضو",
    membershipEnd: "پایان عضویت",
    membershipId: "شناسه عضویت",
    membershipInflow: "ورودی عضویت",
    membershipNet: "خالص عضویت",
    membershipRefunds: "بازپرداخت عضویت",
    members: "اعضا",
    metric: "شاخص",
    month: "ماه",
    netCash: "نقدی خالص",
    netOutflow: "خروجی خالص",
    noCheckout: "بدون خروج",
    noCheckoutCount: "تعداد بدون خروج",
    noMembers: "عضوی وجود ندارد.",
    notes: "یادداشت‌ها",
    onlyAnomalies: "فقط موارد غیرعادی",
    outstanding: "باقی‌مانده",
    overtime: "اضافه‌کاری",
    overtimeMin: "دقیقه اضافه‌کاری",
    overtimeMinutes: "دقیقه اضافه‌کاری",
    paid: "پرداخت‌شده",
    payrollOutflow: "خروجی معاش",
    paymentStatus: "وضعیت پرداخت",
    period: "دوره",
    phone: "تلفن",
    plan: "پلن",
    present: "حاضر",
    presentDays: "روزهای حضور",
    range: "بازه",
    reason: "دلیل",
    refunds: "بازپرداخت‌ها",
    remaining: "باقی‌مانده",
    renewalRatePct: "نرخ تمدید %",
    result: "نتیجه",
    revenueAtRisk: "درآمد در خطر",
    score: "امتیاز",
    search: "جستجو",
    sharePct: "سهم %",
    shiftId: "شناسه شیفت",
    shiftMode: "حالت شیفت",
    source: "منبع",
    staffGroupId: "شناسه گروه کارمندان",
    startDate: "تاریخ شروع",
    state: "حالت",
    status: "وضعیت",
    suggestedAction: "اقدام پیشنهادی",
    suggestedPay: "معاش پیشنهادی",
    summary: "خلاصه",
    summaryKpi: "خلاصه شاخص‌ها",
    timestamp: "زمان",
    to: "تا",
    topLateMembers: "۲۰ عضو برتر بر اساس دقیقه تأخیر",
    totalDue: "کل قابل پرداخت",
    totalOutflow: "کل خروجی",
    totalOutstanding: "کل باقی‌مانده",
    totalPaid: "کل پرداخت‌شده",
    totalRemaining: "کل باقی‌مانده",
    totalSuggested: "کل پیشنهادی",
    totalVariance: "کل اختلاف",
    trend: "روند",
    type: "نوع",
    unscheduled: "خارج از برنامه",
    unscheduledPresent: "حضور خارج از برنامه",
    value: "مقدار",
    variance: "اختلاف",
    varianceRatePct: "نرخ اختلاف %",
    varianceReason: "دلیل اختلاف",
    viewBy: "نمایش بر اساس",
    visitDays: "روزهای مراجعه",
    visitedToday: "مراجعه امروز",
    actualMinutes: "دقایق واقعی",
    checkIn: "زمان ورود",
    checkOut: "زمان خروج",
    dailyDetails: "جزئیات روزانه",
    entryLogs: "لاگ‌های ورود و خروج",
    invalidPunch: "ثبت نامعتبر",
    missingPunch: "ثبت ناقص",
    monthlyTimecard: "تایم‌کارت ماهانه",
    pairedSessions: "جلسه‌های جفت‌شده",
    scheduledMinutes: "دقایق برنامه‌ریزی‌شده",
    shift: "شیفت",
    staffGroup: "گروه کارمندان",
    worstScore: "بدترین امتیاز",
  },
  ps: {
    activeCustomers: "فعال پېرېدونکي",
    activatedAt: "د فعالېدو وخت",
    actualPaid: "واقعي ورکړه",
    adjustments: "سمونونه",
    absentDays: "د غیابت ورځې",
    attendanceCountsNote: "شمېرې د فلټر شويو حضور لاګونو او د شیفت کړکیو څخه جوړېږي.",
    authorizedEvents: "اجازه شوي پېښې",
    autoRenew: "اتومات تمدید",
    averageDebt: "اوسط پور",
    averageScore: "اوسط نمره",
    bestScore: "غوره نمره",
    bucket: "بازه",
    buckets: "بازې",
    byPlan: "د پلان له مخې",
    category: "کټګوري",
    collectionRate: "د راټولولو کچه",
    compliance: "مطابقت",
    count: "شمېر",
    createdAt: "د جوړېدو وخت",
    currentStatus: "اوسنی حالت",
    daily: "ورځنی",
    dailySummary: "ورځنی لنډیز",
    date: "نېټه",
    dateField: "د نېټې فیلډ",
    dateFrom: "له نېټې",
    dateTo: "تر نېټې",
    daysLeft: "پاتې ورځې",
    daysPastDue: "له موعد وروسته ورځې",
    daysSinceLastVisit: "له وروستي ورتګ وروسته ورځې",
    debtAtRisk: "په خطر کې پور",
    debtors: "پوروړي",
    debtorsCount: "د پوروړو شمېر",
    denied: "رد شوی",
    deniedAttempts: "رد شوې هڅې",
    device: "وسیله",
    deviceId: "د وسیلې پېژند",
    distribution: "وېش",
    earlyCount: "د وختي وتلو شمېر",
    earlyLeave: "وختي وتل",
    earlyLeaveCount: "د وختي وتلو شمېر",
    earlyLeaveMinutes: "د وختي وتلو دقیقې",
    earlyMin: "د وختي وتلو دقیقې",
    employee: "کارکوونکی",
    engagementWindow: "د تعامل کړکۍ",
    entity: "مورد",
    event: "پېښه",
    eventType: "د پېښې ډول",
    evaluatedCount: "ارزول شوی شمېر",
    evidence: "شواهد",
    expireDate: "د ختمېدو نېټه",
    expiringCount: "د ختمېدو شمېر",
    expiringSoon: "ژر ختمېدونکی",
    expenses: "لګښتونه",
    expenseAdjustments: "د لګښتونو سمونونه",
    expensesGross: "ناخالص لګښتونه",
    expensesNet: "خالص لګښتونه",
    expectedRenewals: "تمه شوي تمدیدونه",
    expectedShifts: "تمه شوي شیفتونه",
    filters: "فلټرونه",
    firstVisit: "لومړی ورتګ",
    forecast: "وړاندوینه",
    from: "له",
    generatedAt: "د جوړېدو وخت",
    groupBy: "ډلبندي",
    grossOutflow: "ناخالص وتنه",
    horizonDays: "د افق ورځې",
    includePayroll: "معاش شامل کړه",
    inactive30Days: "۳۰ ورځې غیر فعال",
    inactive7Days: "۷ ورځې غیر فعال",
    inactiveMembers: "غیر فعال غړي",
    inactiveThreshold: "د غیر فعالیت حد",
    inflow: "ننوتنه",
    justified: "موجه",
    justifiedDays: "موجه ورځې",
    label: "لیبل",
    largestDebt: "تر ټولو لوی پور",
    lastPaymentDate: "د وروستۍ ورکړې نېټه",
    lastVisit: "وروستی ورتګ",
    lateCount: "د ناوختي شمېر",
    lateMin: "د ناوختي دقیقې",
    lateMinutes: "د ناوختي دقیقې",
    lateMinShort: "ن",
    lifecycle: "د ژوند پړاو",
    lowEngagement: "کم تعامل",
    lowEngagementMaxVisits: "د کم تعامل اعظمي ورتګونه",
    member: "غړی",
    memberCode: "د غړي کوډ",
    memberName: "د غړي نوم",
    memberType: "د غړي ډول",
    membershipEnd: "د غړیتوب پای",
    membershipId: "د غړیتوب پېژند",
    membershipInflow: "د غړیتوب ننوتنه",
    membershipNet: "د غړیتوب خالص",
    membershipRefunds: "د غړیتوب بېرته ورکړې",
    members: "غړي",
    metric: "شاخص",
    month: "میاشت",
    netCash: "خالص نغدې",
    netOutflow: "خالص وتنه",
    noCheckout: "بې وتلو",
    noCheckoutCount: "د بې وتلو شمېر",
    noMembers: "غړي نشته.",
    notes: "یادښتونه",
    onlyAnomalies: "یوازې غیر عادي",
    outstanding: "پاتې",
    overtime: "اضافي کار",
    overtimeMin: "د اضافي کار دقیقې",
    overtimeMinutes: "د اضافي کار دقیقې",
    paid: "ورکړل شوی",
    payrollOutflow: "د معاش وتنه",
    paymentStatus: "د ورکړې حالت",
    period: "دوره",
    phone: "تلیفون",
    plan: "پلان",
    present: "حاضر",
    presentDays: "د حضور ورځې",
    range: "بازه",
    reason: "دلیل",
    refunds: "بېرته ورکړې",
    remaining: "پاتې",
    renewalRatePct: "د تمدید کچه %",
    result: "پایله",
    revenueAtRisk: "په خطر کې عاید",
    score: "نمره",
    search: "لټون",
    sharePct: "برخه %",
    shiftId: "د شیفت پېژند",
    shiftMode: "د شیفت حالت",
    source: "سرچینه",
    staffGroupId: "د کارکوونکو ډلې پېژند",
    startDate: "د پیل نېټه",
    state: "حالت",
    status: "حالت",
    suggestedAction: "وړاندیز شوی اقدام",
    suggestedPay: "وړاندیز شوی معاش",
    summary: "لنډیز",
    summaryKpi: "د شاخصونو لنډیز",
    timestamp: "وخت",
    to: "تر",
    topLateMembers: "۲۰ غړي د ناوختي دقیقو له مخې",
    totalDue: "ټول واجب",
    totalOutflow: "ټوله وتنه",
    totalOutstanding: "ټول پاتې",
    totalPaid: "ټول ورکړل شوي",
    totalRemaining: "ټول پاتې",
    totalSuggested: "ټول وړاندیز شوی",
    totalVariance: "ټول اختلاف",
    trend: "روند",
    type: "ډول",
    unscheduled: "بې مهالویشه",
    unscheduledPresent: "بې مهالویشه حضور",
    value: "مقدار",
    variance: "اختلاف",
    varianceRatePct: "د اختلاف کچه %",
    varianceReason: "د اختلاف دلیل",
    viewBy: "پر بنسټ ښکاره کول",
    visitDays: "د ورتګ ورځې",
    visitedToday: "نن ورتګ",
    actualMinutes: "حقیقي دقیقې",
    checkIn: "د ننوتلو وخت",
    checkOut: "د وتلو وخت",
    dailyDetails: "ورځني جزئیات",
    entryLogs: "د ننوتلو او وتلو ثبتونه",
    invalidPunch: "ناسم ثبت",
    missingPunch: "نیمګړی ثبت",
    monthlyTimecard: "میاشتنی وخت‌کارت",
    pairedSessions: "جوړه شوې ناستې",
    scheduledMinutes: "پلان شوې دقیقې",
    shift: "شیفټ",
    staffGroup: "د کارکوونکو ډله",
    worstScore: "تر ټولو بده نمره",
  },
};

const yesNo: Record<ReportExportLanguage, { yes: string; no: string }> = {
  en: { yes: "Yes", no: "No" },
  fa: { yes: "بله", no: "خیر" },
  ps: { yes: "هو", no: "نه" },
};

const enumLabels = {
  memberType: {
    en: { STAFF: "Staff", CUSTOMER: "Customer", MIXED: "Mixed" },
    fa: { STAFF: "کارمند", CUSTOMER: "مشتری", MIXED: "مختلط" },
    ps: { STAFF: "کارکوونکی", CUSTOMER: "پېرېدونکی", MIXED: "ګډ" },
  },
  membershipStatus: {
    en: { ACTIVE: "Active", PENDING: "Pending", EXPIRED: "Expired", SUSPENDED: "Suspended", CANCELLED: "Cancelled" },
    fa: { ACTIVE: "فعال", PENDING: "در انتظار", EXPIRED: "منقضی", SUSPENDED: "تعلیق‌شده", CANCELLED: "لغوشده" },
    ps: { ACTIVE: "فعال", PENDING: "په تمه", EXPIRED: "ختم شوی", SUSPENDED: "ځنډول شوی", CANCELLED: "لغوه شوی" },
  },
  membershipLifecycle: {
    en: { FIRST_TIME: "First-time", RENEWAL: "Renewal" },
    fa: { FIRST_TIME: "اولین عضویت", RENEWAL: "تمدید" },
    ps: { FIRST_TIME: "لومړی غړیتوب", RENEWAL: "تمدید" },
  },
  paymentStatus: {
    en: { PAID: "Paid", PENDING: "Pending", CANCELLED: "Cancelled", REFUNDED: "Refunded", FAILED: "Failed" },
    fa: { PAID: "پرداخت‌شده", PENDING: "در انتظار", CANCELLED: "لغوشده", REFUNDED: "بازپرداخت‌شده", FAILED: "ناموفق" },
    ps: { PAID: "ورکړل شوی", PENDING: "په تمه", CANCELLED: "لغوه شوی", REFUNDED: "بېرته ورکړل شوی", FAILED: "ناکام" },
  },
  suggestedAction: {
    en: { Call: "Call", SMS: "SMS", Visit: "Visit" },
    fa: { Call: "تماس", SMS: "پیامک", Visit: "مراجعه حضوری" },
    ps: { Call: "زنګ", SMS: "پیام", Visit: "مراجعه" },
  },
  customerActivityState: {
    en: { NEVER: "Never visited", INACTIVE: "Inactive" },
    fa: { NEVER: "هرگز مراجعه نکرده", INACTIVE: "غیرفعال" },
    ps: { NEVER: "هیڅکله نه دی راغلی", INACTIVE: "غیر فعال" },
  },
  entityType: {
    en: { member: "Member", group: "Group" },
    fa: { member: "عضو", group: "گروه" },
    ps: { member: "غړی", group: "ډله" },
  },
  attendanceEvent: {
    en: { IN: "Entry", OUT: "Exit", DENIED: "Denied" },
    fa: { IN: "ورود", OUT: "خروج", DENIED: "رد شده" },
    ps: { IN: "ننوتل", OUT: "وتل", DENIED: "رد شوی" },
  },
  attendanceSource: {
    en: { DEVICE: "Device", MANUAL: "Manual", API: "API" },
    fa: { DEVICE: "دستگاه", MANUAL: "دستی", API: "API" },
    ps: { DEVICE: "وسیله", MANUAL: "لاسي", API: "API" },
  },
  attendanceResult: {
    en: { authorized: "Authorized", denied: "Denied" },
    fa: { authorized: "مجاز", denied: "رد شده" },
    ps: { authorized: "اجازه شوی", denied: "رد شوی" },
  },
  attendanceStatus: {
    en: { ABSENT: "Absent", LATE: "Late", PRESENT: "Present", INSIDE: "Inside", JUSTIFIED: "Justified" },
    fa: { ABSENT: "غایب", LATE: "دیرآمده", PRESENT: "حاضر", INSIDE: "داخل", JUSTIFIED: "موجه" },
    ps: { ABSENT: "غایب", LATE: "ناوخته", PRESENT: "حاضر", INSIDE: "دننه", JUSTIFIED: "موجه" },
  },
  attendanceShiftMode: {
    en: { primary: "Primary shift", all: "All shifts", ignoreShifts: "Ignore shifts" },
    fa: { primary: "شیفت اصلی", all: "همه شیفت‌ها", ignoreShifts: "بدون شیفت" },
    ps: { primary: "اصلي شیفټ", all: "ټول شیفټونه", ignoreShifts: "شیفټونه له پامه غورځول" },
  },
  attendanceEventFilter: {
    en: { all: "All events", in: "Entry", out: "Exit", denied: "Denied" },
    fa: { all: "همه رویدادها", in: "ورود", out: "خروج", denied: "رد شده" },
    ps: { all: "ټولې پېښې", in: "ننوتل", out: "وتل", denied: "رد شوی" },
  },
  debtDateField: {
    en: { CREATED_AT: "Created date", START_DATE: "Start date", END_DATE: "End date", ACTIVATED_AT: "Activated date" },
    fa: { CREATED_AT: "تاریخ ایجاد", START_DATE: "تاریخ شروع", END_DATE: "تاریخ پایان", ACTIVATED_AT: "تاریخ فعال‌سازی" },
    ps: { CREATED_AT: "د جوړېدو نېټه", START_DATE: "د پیل نېټه", END_DATE: "د پای نېټه", ACTIVATED_AT: "د فعالېدو نېټه" },
  },
} as const;

export function normalizeReportExportLanguage(value?: string | null): ReportExportLanguage {
  return REPORT_EXPORT_LANGUAGES.includes(value as ReportExportLanguage) ? (value as ReportExportLanguage) : "en";
}

export function getReportExportLabels(lang?: ReportExportLanguage) {
  const language = normalizeReportExportLanguage(lang);
  return {
    language,
    t: (key: LabelKey) => labels[language][key],
    yesNo: (value: boolean) => (value ? yesNo[language].yes : yesNo[language].no),
    memberType: (value: string) => translateEnum(enumLabels.memberType[language], value),
    membershipStatus: (value: string) => translateEnum(enumLabels.membershipStatus[language], value),
    membershipLifecycle: (value: string) => translateEnum(enumLabels.membershipLifecycle[language], value),
    paymentStatus: (value: string) => translateEnum(enumLabels.paymentStatus[language], value),
    suggestedAction: (value: "Call" | "SMS" | "Visit") => enumLabels.suggestedAction[language][value],
    customerActivityState: (value: "NEVER" | "INACTIVE") => enumLabels.customerActivityState[language][value],
    entityType: (value: "member" | "group") => enumLabels.entityType[language][value],
    attendanceEvent: (value: "IN" | "OUT" | "DENIED") => enumLabels.attendanceEvent[language][value],
    attendanceSource: (value: "DEVICE" | "MANUAL" | "API") => enumLabels.attendanceSource[language][value],
    attendanceResult: (value: "authorized" | "denied") => enumLabels.attendanceResult[language][value],
    attendanceStatus: (value: "ABSENT" | "LATE" | "PRESENT" | "INSIDE" | "JUSTIFIED") => enumLabels.attendanceStatus[language][value],
    attendanceShiftMode: (value: "primary" | "all" | "ignoreShifts") => enumLabels.attendanceShiftMode[language][value],
    attendanceEventFilter: (value: "all" | "in" | "out" | "denied") => enumLabels.attendanceEventFilter[language][value],
    debtDateField: (value: "CREATED_AT" | "START_DATE" | "END_DATE" | "ACTIVATED_AT") => enumLabels.debtDateField[language][value],
    debtBucket: (key: string) => `${key} ${language === "en" ? "days" : language === "fa" ? "روز" : "ورځې"}`,
  };
}

function translateEnum<T extends Record<string, string>>(map: T, value: string) {
  return map[value as keyof T] ?? value;
}
