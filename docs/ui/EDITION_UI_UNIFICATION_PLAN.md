# طرح یکسان‌سازی رابط کاربری FULL و ATTENDANCE

تاریخ تصویب: 2026-09-26

وضعیت: `UI-1.7 ACCEPTED — BROWSER-FEEDBACK REMEDIATION COMPLETE`

مالک اجرا: Frontend

مرجع Scope نسخه‌ها: [ATTENDANCE_EDITION_CHECKLIST.md](../project/ATTENDANCE_EDITION_CHECKLIST.md)

## UI-1.7 — اصلاح برابری بصری براساس بازبینی واقعی مرورگر

بازبینی کاربر در مرورگر بعد از پذیرش `UI-1.6` نشان داد که Shared Shell درست یکسان شده، اما محتوای بعضی صفحه‌های Attendance هنوز فقط از primitiveهای مشترک استفاده می‌کند و ترکیب‌بندی مرجع FULL را دقیق دنبال نمی‌کند. بنابراین پذیرش تاریخی `UI-1.6` حفظ می‌شود، ولی بستهٔ اصلاحی `UI-1.7` تا بازبینی صفحه‌به‌صفحه باز است.

- [x] Dashboard حاضری از قرارداد تصویری واقعی `dashboard-v2` نسخهٔ FULL استفاده می‌کند: بدون content header تکراری، با پنج KPI، شبکهٔ سه‌پنلی اصلی و سه پنل تحلیلی با breakpointهای همان مرجع.
- [x] داده‌ها همچنان فقط Staff attendance، warning، punch و device هستند؛ `GET /api/v1/dashboard/summary` برای اعداد و `GET /api/v1/dashboard/details?type=…` برای جزئیات on-demand استفاده می‌شوند و هر دو با Permission `ATTENDANCE_VIEW` و strict Staff scope محافظت می‌شوند.
- [x] بازخورد نهایی مرورگر روی Dashboard اعمال شد: surface تکراری عنوان/زیرعنوان حذف شد و هر پنج KPI با کلیک یا صفحه‌کلید modal جزئیات واقعی باز می‌کنند؛ جدول شامل نام، کد، تلفن، گروه، شیفت/نقش، ورود، خروج و وضعیت است و Active/Present/Inside/Late/Absent مستقل فیلتر می‌شوند.
- [x] هشت baseline شامل Desktop Dark/LTR، Desktop Light/RTL، Mobile، KPI detail modal در Dark/LTR و Light/RTL، empty، error/retry و loading بازتولید و مستقیم بازبینی شدند؛ focused visual و interaction برابر `8/8` پاس شد.
- [x] build و verify رسمی ATTENDANCE روی Node دقیق `24.19.0` پاس شد؛ manifest برابر `96ff4c…04b02` است.
- [x] لیست Employees اکنون قرارداد واقعی صفحهٔ Members نسخهٔ FULL را استفاده می‌کند: بدون PageHeader تکراری، نوار فشردهٔ title/filter/search، جدول شش‌ستونهٔ avatar/name/code، ردیف کلیک‌پذیر، status badge، details action و pagination همسان؛ فیلترهای Staff Group و Archived مخصوص حاضری حفظ شدند.
- [x] Add Employee اکنون composition واقعی Add Member نسخهٔ FULL را با header فشرده، کارت wizard، step indicator هفت‌مرحله‌ای، Back/Next/Save و Review استفاده می‌کند؛ نوع فقط Employee/Staff و قفل‌شده است و هیچ Customer/Membership/Payment/Salary surface یا payload وارد ATTENDANCE نشده است.
- [x] Employee Details اکنون composition واقعی Member Details نسخهٔ FULL را استفاده می‌کند: profile header با avatar/chip/stat/action، surface تب‌دار و panel/tableهای همسان در Overview، Attendance، Schedule و Access. داده‌ها و درخواست‌ها فقط از Employee facade می‌آیند؛ Payment/Membership/Salary و حذف فیزیکی وارد Attendance نشده‌اند و Archive/Restore امن حفظ شده است.
- [x] Edit Employee اکنون همان wizard هفت‌مرحله‌ای Add/Edit Member نسخهٔ FULL را استفاده می‌کند و Device Enrollment مشترک با انتخاب دستگاه، پیشنهاد Device User ID و `FingerIdPicker` ده‌انگشتی در Add و Edit موجود است. فرمان enrollment فقط با `DEVICES_ENROLL` و فقط بعد از Save/Update موفق Staff اجرا می‌شود؛ `fingerId` وارد Employee payload نمی‌شود و failure/retry هیچ Employee تکراری نمی‌سازد.
- [x] تمام ورودی‌های انتخابی Routeهای فعال ATTENDANCE در Employees، Add/Edit Employee، Daily Attendance، Entry Logs و Manual Entry، Devices و Employee Tools، Access Users، Audit Logs، Attendance Report و Backups از زیرمنوی سفارشی مشترک FULL استفاده می‌کنند. هیچ `<select>` بومی در این graph فعال باقی نمانده است؛ منوی مشترک با portal سراسری از clipping داخل کارت/مودال جلوگیری می‌کند و RTL/LTR، جستجو، disabled state و accessibility label را حفظ می‌کند.
- [x] suite تصویری Employees برابر `12/12` و facade/payload/enrollment/failure-retry/legacy-redirect behavior برابر `7/7` پاس شد؛ strict Device boundary نیز پاس شد. Employee Details، Full-style Edit wizard و finger picker در Desktop/RTL/Mobile مستقیم بازبینی شدند. build/verify رسمی ATTENDANCE روی Node دقیق `24.19.0` با manifest `18ace145ba30248716007857ad037fb97ecb6aeae960aa7dbeed245b08390558` پاس شد. K40 فیزیکی در این تغییر اجرا نشد و پذیرش سخت‌افزاری ایجاد/ویرایش همچنان طبق checklist پایلوت باز است.
- [x] Daily Attendance حاضری اکنون ترکیب‌بندی واقعی `AttendanceDaily` نسخهٔ FULL را استفاده می‌کند: سطح `attendance-clean`، header و date navigator فشرده، سه summary card چندمعیاره، filterbar، Row/Card view و جدول شش‌ستونهٔ Employee/Clock/Status/Overtime/Shift/Justification.
- [x] Staff Group، Primary/All shift، تاریخ شمسی و Justification مخصوص حاضری حفظ شدند؛ visual برابر `7/7` و behavior قرارداد Staff برابر `5/5` پاس شد. build/verify رسمی ATTENDANCE روی Node دقیق `24.19.0` با manifest `30a811…dcf85` پاس شد.
- [x] Entry Logs حاضری اکنون ترکیب‌بندی واقعی صفحهٔ Attendance/Entry Logs نسخهٔ FULL را استفاده می‌کند: header فشرده، چهار summary card، filter panel جمع‌شونده و جدول فشردهٔ شش‌ستونه با ادغام نام/کُد و منبع/دستگاه.
- [x] فیلترهای Staff، CSV/XLSX، ثبت دستی، Permissionها و endpointهای حاضری بدون تغییر ماندند؛ visual برابر `7/7` و behavior قرارداد Staff برابر `5/5` پاس شد. build/verify رسمی ATTENDANCE روی Node دقیق `24.19.0` با manifest `d0f348…6161cb` پاس شد.
- [x] Attendance Report حاضری اکنون قاب، header و tab treatment واقعی `AttendanceReportPage` نسخهٔ FULL را استفاده می‌کند؛ Filters، KPI grid، Trend panel و جدول‌های Daily/Employees/Evidence از قبل component مشترک Full بودند و Monthly Timecard مخصوص حاضری در همان surface حفظ شد.
- [x] Staff-only queryها، exportهای CSV/XLSX/PDF، Permissionها، زبان‌ها و filenameها ثابت ماندند؛ visual برابر `10/10` و behavior جامع Phase 3–7 برابر `12/12` پاس شد. build/verify رسمی ATTENDANCE روی Node دقیق `24.19.0` با manifest `b963fa…a28c35` پاس شد.
- [x] Devices حاضری اکنون قرارداد واقعی صفحهٔ Devices نسخهٔ FULL را استفاده می‌کند: header تیره و فشرده، filter surface ثابت و Device rowهای افقی با badge وضعیت و actionهای فشرده؛ Recent Device Events و اطلاعات Poll/Event مخصوص حاضری در همان زبان بصری حفظ شدند.
- [x] Pull-only payload، Create/Edit/Test، Employee tools، Permissionها و endpointهای Core بدون تغییر ماندند؛ visual برابر `8/8` و behavior دستگاه برابر `4/4` پاس شد. build/verify رسمی ATTENDANCE روی Node دقیق `24.19.0` با manifest `120a60…0ee5eb` پاس شد و هیچ K40 فیزیکی اجرا نشد.
- [x] Settings حاضری inventory کامل سه زیرصفحهٔ مجاز را پوشش می‌دهد: Access Users، Audit Logs و Backups. Access Users اکنون header آماری، جدول اصلی و فرم کناری sticky واقعی Admin Users نسخهٔ FULL را استفاده می‌کند؛ نقش‌ها و محدودیت‌های امنیتی Attendance حفظ شدند. Audit Logs و Backups از قبل مستقیماً همان componentهای FULL بودند و baselineهایشان بدون تغییر پاس شدند.
- [x] Settings visual برابر `8/8` و Access Users behavior برابر `3/3` پاس شد؛ build/verify رسمی ATTENDANCE روی Node دقیق `24.19.0` با manifest `49ae9c…d4e373` پاس شد.
- [x] تراکم heading تمام جدول‌های ATTENDANCE استاندارد شد: اندازهٔ `10px`، وزن `680`، tracking و فاصلهٔ عمودی فشرده‌تر، با scope صریح Edition روی `SharedAppShell`. محتوای ردیف‌ها و typography جدول‌های FULL تغییر نکرد. ماتریس کامل real-app یک‌بار با بازتولید baseline و یک‌بار بدون update هر دو `79/79` پاس شدند؛ build/verify رسمی ATTENDANCE و FULL با Node دقیق `24.19.0` و manifestهای `c62534d9…11e4304` و `5b7ae57f…0d4c4c` پاس شد.
- [x] محتوای ردیف‌های جدول Employees حاضری برای Contact، Staff group و Role به `12px` استاندارد شد و وضعیت Active/Blocked/Archived با state معنایی و کنتراست خوانای Light اصلاح شد. Employees visual/interaction با baseline جدیدِ Light پُر و assertion محاسباتی font/color برابر `14/14` پاس شد؛ build/verify رسمی ATTENDANCE با manifest `b2e1c59c…8f32192` پاس شد.
- [x] بلوک تکراری breadcrumb/title هدر مشترک در تمام Routeهای ATTENDANCE حذف شد، در حالی‌که actionهای هدر و قرارداد کامل FULL حفظ شدند. ماتریس بازتولیدشدهٔ Attendance برابر `80/80`، پذیرش مستقل Shell/Settings برابر `13/13` و محافظ رفتاری header نسخهٔ FULL برابر `4/4` پاس شد؛ build/verify هر دو Edition با manifestهای `96673527…b5c8ec3` و `3b2dc8f6…9c242a7` پاس شد.
- [x] بازبینی صفحه‌به‌صفحهٔ Dashboard، Employees، Daily Attendance، Entry Logs، Attendance Report، Devices و هر سه زیرصفحهٔ Settings کامل شد؛ `UI-1.7` بسته است.

این مرحله فقط presentation است؛ Backend/API/Database/Prisma/Licensing/Guardian/Installer/Device logic و دستگاه فیزیکی تغییر یا اجرا نشدند.

## 1. مسئله و تصمیم قطعی

دو Edition باید یک زبان طراحی، Shell، Theme، فاصله‌گذاری، Typography، Navigation، Header، Breadcrumb، کنترل‌ها، جدول‌ها و رفتار Responsive داشته باشند. تفاوت مجاز فقط در Brand، Route، Capability، Permission، متن و دادهٔ مخصوص هر محصول است.

وضعیت فعلی این قرارداد را برآورده نمی‌کند:

- `FULL` از `client/src/layouts/DashboardLayout.tsx` و Design System کامل موجود استفاده می‌کند.
- `ATTENDANCE` از `client/src/routing/AttendanceRouteShell.tsx` و چند صفحهٔ موازی با کلاس‌های ساده و مستقیم Tailwind استفاده می‌کند.
- `DashboardLayout` فعلی presentation-only نیست؛ AtlasGym assets، Inbox، Sound، WebSocket و APIهای FULL را مستقیم import می‌کند. بنابراین استفادهٔ مستقیم آن در Artifact حاضری ممنوع است.
- تست‌های موجود Theme/Language/Route/Network/Build isolation را می‌سنجند، اما Visual parity یا Screenshot regression ندارند.

تصمیم قطعی:

> یک Shared Visual System و `SharedAppShell` بدون side effect ساخته می‌شود. هر دو Edition همان Shell و primitiveهای نمایشی را مصرف می‌کنند؛ قابلیت‌های اختصاصی فقط از adapter/slotهای build-selected و fail-closed وارد می‌شوند. ظاهر فعلی FULL مرجع بصری است، نه dependency graph یا Feature set نسخهٔ حاضری.

## 2. اهداف پذیرش

- [x] Sidebar، Header، Breadcrumb، User menu، Theme/Language controls و Responsive behavior در هر دو Edition از یک implementation مشترک می‌آیند.
- [x] Brand هر Edition فقط از `PRODUCT_BRAND` می‌آید؛ Shared Shell هیچ asset یا نام AtlasGym/Entry Control را hard-code نمی‌کند.
- [x] Navigation و Header action فقط از Route Manifest و Feature+Permission مؤثر ساخته می‌شوند.
- [x] صفحه‌های Attendance از tokenها و primitiveهای مشترک برای header، card، filter، table، badge، modal، button، empty/error/loading state و pagination استفاده کنند.
- [x] Light/Dark، LTR/RTL و English/Dari/Pashto در هر دو Edition از یک قرارداد persisted استفاده می‌کنند.
- [x] Artifact حاضری هیچ Customer/Finance/Payroll/Expense، Inbox، Sound، optional Device diagnostics، FULL WebSocket یا Brand asset نسخهٔ FULL را حمل نمی‌کند.
- [x] رفتار و ظاهر FULL نسبت به baseline تصویری پذیرفته‌شده regression ندارد.
- [x] API، Backend، Database، Prisma، Licensing، Guardian، Device processing و business semantics تغییر نکردند.

«یک استایل» به معنی pixel-identical بودن متن و محتوای دو محصول نیست. ساختار و Design System باید یکی باشد؛ Brand، تعداد منوها، عنوان‌ها و داده‌ها طبق Edition متفاوت می‌مانند.

## 3. خارج از Scope و تغییرات ممنوع

این Work Package مجوز تغییر هیچ‌یک از موارد زیر نیست:

- `server/**`، Prisma schema/migration/seed یا Database data
- HTTP/API contract، DTO، Auth envelope، Permission، Role یا Capability readiness
- Licensing، Guardian، Secure State، Installer یا Windows service
- K40 polling/commands، Door، Inbox/Sound policy یا Background jobs
- فعال‌کردن Feature اختیاری یا افزودن Route جدید
- انتقال مستقیم `DashboardLayout` فعلی به Manifest حاضری
- کپی‌کردن دوبارهٔ CSS/JSX نسخهٔ FULL داخل فایل Attendance
- مخفی‌کردن Feature ممنوع فقط با CSS یا شرط UI
- افزودن import ثابت FULL به module مشترک و اتکا به dead-code elimination برای امنیت Artifact

اگر برای تکمیل UI نیاز واقعی به یکی از این تغییرها پیدا شد، کار متوقف، Scope Change جدا ثبت و پیش از ادامه تأیید می‌شود.

## 4. معماری هدف

```text
fullRouteManifest -------- FullShellAdapter ----\
                                              +--> SharedAppShell --> Outlet
attendanceRouteManifest -- AttendanceAdapter -/

SharedAppShell
  ├── PRODUCT_BRAND
  ├── Route Manifest navigation/breadcrumb/actions
  ├── shared theme/language/responsive state
  └── optional edition slots (presentation contract only)

FullShellAdapter
  └── lazy/build-selected FULL-only Inbox/Sound behavior

AttendanceAdapter
  └── no optional FULL behavior unless its own approved Feature gate exists
```

قواعد Dependency:

1. `SharedAppShell` فقط dependencyهای خنثی و مشترک را import می‌کند.
2. کد FULL-only از Shared module قابل‌دسترسی معکوس نیست؛ adapter مالک import آن است.
3. `PRODUCT_BRAND` تنها منبع نام، لوگو، icon، edition label و support label است.
4. Labelهای Route از Manifest/i18n می‌آیند؛ Shell نباید برای صفحه‌های Attendance mapping دستی نگه دارد.
5. business pageها API و data logic موجود خود را نگه می‌دارند و فقط presentation آنها به primitiveهای مشترک منتقل می‌شود.

## 5. ترتیب اجرایی و Commit Gateها

هر ردیف یک Commit مستقل است، مگر دو تغییر از نظر Compile جدانشدنی باشند. هیچ مرحله‌ای پیش از پاس‌شدن Gate مرحلهٔ قبل شروع نمی‌شود.

### UI-1.1 — Baseline و محافظ‌های بصری

- [x] Viewportها، Themeها و زبان‌های مرجع ثبت شدند: Desktop برابر `1440x900`، Mobile برابر `390x844`، Dark/Light و English LTR/Dari RTL.
- [x] Screenshot regression برای Shell نسخهٔ FULL در Light/Dark و LTR/RTL اضافه شد.
- [x] harness موجود Route Manifest و Auth ثابت reuse شد تا تفاوت داده باعث false diff نشود؛ APIهای Inbox/Sound نیز پاسخ ثابت دارند.
- [x] تست صریح Brand isolation و نبود import/marker ممنوع Attendance در Gate موجود حفظ شد و اسکن build هر دو Edition پاس شد.
- [x] پنج Baseline تصویری expanded/collapsed/settings/RTL/mobile بازبینی و تصویب شدند؛ snapshot جدید بدون توضیح پذیرفته نمی‌شود.

Gate: هیچ کد تولیدی تغییر نکند؛ تست‌های جدید روی ظاهر مرجع FULL پاس شوند و Gate موجود Edition نیز سبز بماند.

### UI-1.2 — استخراج SharedAppShell بدون تغییر FULL

- [x] presentation و state مشترک از `DashboardLayout` به `SharedAppShell` منتقل شد.
- [x] AtlasGym asset/name با `PRODUCT_BRAND` build-selected جایگزین شد.
- [x] Inbox، Sound، WebSocket و side effectهای FULL در `FullShellAdapter` باقی ماندند و گیت source dependency این مرز را قفل کرد.
- [x] `fullRouteManifest` فقط از `FullShellAdapter` جدید استفاده می‌کند.
- [x] ظاهر، Route، Network و رفتار FULL با پنج baseline تصویری بدون update برابر ماند.

Gate: Screenshotهای FULL بدون update پاس؛ تست navigation، Auth، route boundary، lint/typecheck/build و FULL regression پاس؛ هیچ فایل Backend تغییر نکند.

### UI-1.3 — مهاجرت Shell نسخهٔ حاضری

- [x] `AttendanceShellAdapter` به `SharedAppShell` وصل شد و Manifest حاضری مستقیماً همین adapter را انتخاب می‌کند.
- [x] Brand، Navigation، Breadcrumb، Header action، Theme، Language، Logout و Responsive behavior از قرارداد مشترک می‌آیند.
- [x] `AttendanceRouteShell` و copy موازی آن حذف شدند؛ labelهای Route در namespace مستقل سه‌زبانه باقی ماندند.
- [x] هیچ Inbox/Sound/WebSocket/FULL asset یا forbidden route وارد Artifact حاضری نشد.

Gate: Build-isolation scan پاس؛ Attendance real-app `16/16` و component/browser matrix برابر `42/42`؛ Screenshotهای FULL برابر `5/5` بدون اختلاف و Screenshotهای Attendance برابر `4/4`؛ Edition boundary برابر `36/36`.

### UI-1.4 — primitiveهای مشترک صفحه

- [x] tokenها و primitiveهای `PageHeader`, `SummaryCard`, `FilterPanel`, `DataTable`, `StatusBadge`, `Modal`, `Button`, `EmptyState`, `ErrorState` و `PaginationControls` در [موجودی primitiveها](EDITION_UI_PRIMITIVE_INVENTORY.md) ثبت شدند.
- [x] `ReportFiltersPanel`، `DataTable` و `PaginationControls` موجود reuse و فقط primitiveهای عمومی مفقود در `components/ui` اضافه شدند؛ componentهای domain-specific تا UI-1.5 حفظ شدند.
- [x] tokenهای semantic مشترک سطح/Border/Focus/Overlay روی متغیرهای Dark/Light موجود اضافه و styling primitiveهای جدید به همان tokenها محدود شد.
- [x] Accessibility شامل keyboard row activation، Filter aria relation، Pagination nav label، Modal focus trap/Escape/restore، semantic stateها و reduced motion با تست مرورگر قفل شد.

Gate: primitive harness و test برابر 4/4 با سه Screenshot بازبینی‌شدهٔ Dark/LTR، Light/RTL و Modal؛ FULL visual برابر 5/5 و Attendance visual برابر 4/4 بدون update؛ Edition boundary برابر 36/36، browser برابر 46/46 و Attendance real-app برابر 16/16؛ build isolation پاس و business behavior ثابت.

### UI-1.5 — مهاجرت مرحله‌ای صفحه‌های Attendance

ترتیب اجباری:

1. [x] Attendance Dashboard
2. [x] Employees list/add/detail/edit
3. [x] Daily Attendance
4. [x] Entry Logs
5. [x] Attendance Report و Monthly Timecard
6. [x] Devices Core
7. [x] Admin Users، Audit Logs و Backups

Evidence مرحلهٔ `UI-1.5.1`:

- presentation داشبورد به `PageHeader`، `Button`، `SummaryCard`، `StatusBadge`، `ErrorState` و suite مشترک `DataTable` منتقل شد؛ panelهای آماری domain-specific فقط مالک چیدمان نمایشی باقی ماندند.
- تابع load، قرارداد `GET /api/v1/dashboard/summary`، payload، route و Permission `ATTENDANCE_VIEW` تغییر نکردند؛ تست واقعی Dashboard و منع درخواست بدون Permission پاس شد.
- شش baseline بازبینی‌شده برای Desktop Dark/LTR، Desktop Light/RTL، Mobile Dark/LTR، trend خالی، خطا و loading ثبت شد؛ retry نیز فقط همان endpoint داشبورد را فراخوانی می‌کند.
- focused visual/interaction برابر `6/6`، Gate کامل Edition برابر `36/36`، browser/FULL برابر `46/46` و Attendance real-app برابر `22/22` پاس شد؛ build isolation نیز سالم ماند.
- این evidence تاریخی مرحلهٔ Dashboard است؛ مرحلهٔ بعدی آن `UI-1.5.2` بود که اکنون تکمیل شده است.

Evidence مرحلهٔ `UI-1.5.2`:

- presentation صفحه‌های Employees List/Add/Detail/Edit به `PageHeader`، `ReportFiltersPanel`، suite مشترک `DataTable`، `StatusBadge`، `PaginationControls`، `Button` و `ErrorState` و tokenهای semantic منتقل شد؛ panelهای جزئیات و فرم فقط مالک چیدمان domain-specific باقی ماندند.
- خانوادهٔ endpointهای Employee، payloadهای Create/Update، routeها، Permissionهای `MEMBERS_VIEW`/`MEMBERS_WRITE` و Staff-only semantics تغییر نکردند؛ suite رفتاری موجود Employees برابر `5/5` پاس شد.
- هشت baseline بازبینی‌شده برای List در Desktop/Mobile و Dark/Light و LTR/RTL، empty/error/loading و همچنین Detail، Add و Edit/Schedule ثبت شد؛ تست‌ها فقط facade مجاز Employee را مشاهده کردند.
- focused visual/interaction برابر `8/8`، Gate کامل Edition برابر `36/36`، browser/FULL برابر `46/46` و Attendance real-app برابر `30/30` پاس شد؛ production build و FULL/ATTENDANCE isolation نیز سالم ماند.
- این evidence تاریخی مرحلهٔ Employees است؛ مرحلهٔ بعدی آن `UI-1.5.3` بود که اکنون تکمیل شده است.

Evidence مرحلهٔ `UI-1.5.3`:

- presentation صفحهٔ Daily Attendance به `PageHeader`، `Button`، `ReportFiltersPanel`، `SummaryCard`، `StatusBadge`، `ErrorState`، suite مشترک `DataTable` و `Modal` و tokenهای semantic منتقل شد؛ نوار انتخاب روز، هشدارها و جزئیات Exception فقط مالک چیدمان domain-specific باقی ماندند.
- قرارداد `GET /api/v1/attendance/daily`، گزینه‌های Staff Group، queryهای date/search/group/shift/mode، payload و lifecycle توجیه با `POST/DELETE /api/v1/attendance/justifications`، Permissionهای `ATTENDANCE_VIEW`/`ATTENDANCE_JUSTIFY` و Staff-only semantics تغییر نکردند؛ suite رفتاری موجود Attendance برابر `5/5` پاس شد.
- هفت baseline بازبینی‌شده برای Desktop Dark/LTR، Desktop Light/RTL، Mobile table، empty، error/retry، loading و Justification modal ثبت شد؛ تاریخ و timezone تست ثابت است و retry فقط endpoint مجاز Staff را فراخوانی می‌کند.
- focused visual/interaction برابر `7/7`، Gate کامل Edition برابر `36/36`، browser/FULL برابر `46/46` و Attendance real-app برابر `37/37` پاس شد؛ production build و FULL/ATTENDANCE artifact isolation نیز سالم ماند.
- این evidence تاریخی مرحلهٔ Daily Attendance است؛ مرحلهٔ بعدی آن `UI-1.5.4` بود که اکنون تکمیل شده است.

Evidence مرحلهٔ `UI-1.5.4`:

- presentation صفحهٔ Entry Logs به `PageHeader`، `Button`، `ReportFiltersPanel`، `SummaryCard`، `StatusBadge`، `ErrorState`، suite مشترک `DataTable`، `PaginationControls` و `Modal` و tokenهای semantic منتقل شد؛ فیلترهای عملیاتی، جدول رویداد و فرم ثبت دستی فقط مالک چیدمان domain-specific باقی ماندند.
- قراردادهای `GET /api/v1/attendance`، گزینه‌های Device و Employee، خروجی‌های CSV/XLSX و `POST /api/v1/attendance/manual`، queryهای search/employee/device/date/event/source/result، payload ثبت دستی، نام فایل‌های خروجی، Permissionهای `ATTENDANCE_VIEW`/`ATTENDANCE_EXPORT`/`ATTENDANCE_MANUAL` و Staff-only semantics تغییر نکردند؛ suite رفتاری موجود Attendance برابر `5/5` پاس شد.
- هفت baseline بازبینی‌شده برای Desktop Dark/LTR، Desktop Light/RTL، Mobile table، empty، error/retry، loading و Manual Entry modal ثبت شد؛ تاریخ و timezone تست ثابت است و retry فقط endpointهای مجاز Staff را فراخوانی می‌کند.
- focused visual/interaction برابر `7/7`، Gate کامل Edition برابر `36/36`، browser/FULL برابر `46/46` و Attendance real-app برابر `44/44` پاس شد؛ production build و FULL/ATTENDANCE artifact isolation نیز سالم ماند.
- این evidence تاریخی مرحلهٔ Entry Logs است؛ مرحلهٔ بعدی آن `UI-1.5.5` بود که اکنون تکمیل شده است.

Evidence مرحلهٔ `UI-1.5.5`:

- shell صفحهٔ Attendance Report و tabهای آن به `PageHeader`، `Button` و `ErrorState` منتقل شد؛ componentهای مشترک FULL یعنی `FiltersPanel`، `KpiGrid`، `TrendPanel`، `DailySummaryTable`، `MembersTable` و `EvidenceTable` بدون fork یا تغییر رفتاری reuse شدند. Monthly Timecard نیز به `Button`، suite مشترک `DataTable`، `StatusBadge`، `PaginationControls` و `LocalizedMonthInput` و tokenهای semantic منتقل شد.
- خانوادهٔ endpointهای `/api/v1/reports/attendance/*` برای options/summary/daily/members/evidence/timecard و exportهای Report و Timecard، queryهای filter/sort/month/page، نام فایل‌ها، Permissionهای `ATTENDANCE_VIEW`/`ATTENDANCE_EXPORT` و Staff-only semantics تغییر نکردند؛ suite قراردادی موجود Phase 3–7 برابر `12/12` پاس شد.
- ده baseline بازبینی‌شده برای Desktop Dark با filter باز، Desktop Light/RTL، Mobile table، Employees، Evidence، empty، error/retry، loading و Monthly Timecard در حالت عادی و expanded ثبت شد؛ tabهای Mobile بدون document overflow کامل دیده می‌شوند و جزئیات Timecard در row مستقل و بدون هم‌پوشانی cellها باز می‌شود.
- focused visual/interaction برابر `10/10`، Gate کامل Edition برابر `36/36`، browser/FULL برابر `46/46` و Attendance real-app برابر `54/54` پاس شد؛ production build و FULL/ATTENDANCE artifact isolation نیز سالم ماند.
- این evidence تاریخی مرحلهٔ Attendance Report و Monthly Timecard است؛ مرحلهٔ بعدی آن `UI-1.5.6` بود که اکنون تکمیل شده است.

Evidence مرحلهٔ `UI-1.5.6`:

- presentation صفحهٔ Devices Core به `PageHeader`، `Button`، `ReportFiltersPanel`، `StatusBadge`، `ErrorState`/`EmptyState`، suite مشترک `DataTable` و `Modal` و tokenهای semantic منتقل شد؛ cardهای K40، وضعیت runtime، رویدادهای اخیر، فرم Add/Edit و Employee Tools فقط مالک چیدمان domain-specific باقی ماندند.
- خانوادهٔ endpointهای Core شامل `/api/v1/devices`، status/events، enable/disable/test-connection، users/sync/upsert/delete، enroll و time و همچنین Employee facade، queryهای search/status/enabled، payload اجباری `FINGERPRINT + NETWORK + PULL` و Permissionهای `DEVICES_VIEW`/`SYSTEM_SETTINGS_MANAGE`/`DEVICES_USER_SYNC`/`DEVICES_ENROLL` تغییر نکردند؛ عملیات Advanced شامل Diagnostics/Raw Logs/Scan/Unlock/Clear Logs همچنان خارج surface و build حاضری باقی ماندند.
- هشت baseline بازبینی‌شده برای Desktop Dark/LTR، Desktop Light/RTL، Mobile card/table، empty، error/retry، loading، Add K40 modal و Employee Tools modal ثبت شد؛ صفحه در Mobile document overflow ندارد و error/empty متناقض هم‌زمان نمایش داده نمی‌شوند.
- focused visual/interaction برابر `8/8` و suite رفتاری موجود Devices برابر `4/4` پاس شد؛ Gate کامل Edition برابر `36/36`، browser/FULL برابر `46/46` و Attendance real-app برابر `62/62` پاس شد و production build و FULL/ATTENDANCE artifact isolation نیز سالم ماند.
- این evidence تاریخی مرحلهٔ Devices Core است؛ مرحلهٔ بعدی آن `UI-1.5.7` بود که اکنون تکمیل شده است.

Evidence مرحلهٔ `UI-1.5.7`:

- presentation صفحهٔ Attendance Admin Users به `PageHeader`، `Button`، suite مشترک `DataTable`، `StatusBadge` و `ErrorState` و tokenهای semantic منتقل شد. Audit Logs از `PageHeader`، `Button`، `SummaryCard`، `StatusBadge` و `ErrorState` مشترک استفاده می‌کند و مودال read-only دامنه‌ای آن برای حفظ قرارداد redaction و keyboard بدون تغییر باقی ماند. Backups نیز header و actionهای عمومی مشترک را مصرف می‌کند و panelهای recovery/schedule/storage دامنه‌ای دست‌نخورده ماندند.
- قراردادهای Core Admin Users برای list/create/update/reset-password/deactivate/reactivate، نقش‌های مجاز حاضری و حفاظت current/protected user تغییر نکردند. Audit فقط GET باقی ماند و historical Edition filtering و recursive redaction ثابت ماند. Backup/Restore endpointها، Permissionها، schedule/storage/external-copy و maintenance semantics هیچ تغییری نکردند.
- هشت baseline بازبینی‌شده برای Admin Users در Desktop Dark/LTR، Desktop Light/RTL و Mobile edit؛ Audit در Desktop Dark/LTR، Desktop Light/RTL و redacted detail modal؛ و Backups در Desktop Dark/LTR و Mobile Light/RTL ثبت شد. هر دو صفحهٔ Mobile document overflow ندارند و snapshotها بدون update دوباره `8/8` پاس شدند.
- suite رفتاری Admin Users برابر `3/3` و Audit Logs برابر `5/5` پاس شد؛ Gate کامل Edition برابر `36/36`، browser/FULL برابر `46/46` و Attendance real-app برابر `70/70` پاس شد و production build و FULL/ATTENDANCE artifact isolation نیز سالم ماند.
- `UI-1.5` اکنون `7/7` کامل است و پذیرش نهایی `UI-1.6` نیز با Node دقیق `24.19.0` پاس شده است.

برای هر صفحه:

- [x] فقط presentation تغییر کرد؛ API call، query key، payload، permission و Staff-only semantics ثابت ماندند.
- [x] Dark/Light و English/Dari/Pashto بررسی شدند.
- [x] loading/empty/error/modal/table/mobile states screenshot و interaction coverage دارند.
- [x] تست focused هر صفحه و سپس Gate تجمعی اجرا شد.

Gate: صفحهٔ بعد فقط پس از پاس focused tests، Visual review و Build isolation صفحهٔ فعلی شروع شود.

### UI-1.6 — پذیرش نهایی

- [x] `npm.cmd run test:edition-boundary` از `server` کامل پاس شد.
- [x] Gateهای جدید Visual در هر دو Edition پاس شدند.
- [x] `npm run build:full`, `npm run build:attendance`, `npm run verify:full` و `npm run verify:attendance` با Node دقیق `24.19.0` پاس شدند.
- [x] Artifact حاضری برای forbidden route/request/WebSocket/chunk/brand asset اسکن شد.
- [x] Browser QA مستقیم در Desktop و اندازهٔ Mobile، Light/Dark و هر سه زبان ثبت شد.
- [x] Git diff ثابت کرد هیچ Server/Prisma/Licensing/Installer/Device logic تغییر نکرده است.

Gate نهایی: ظاهر مشترک تأیید، جداسازی Edition سالم، FULL بدون regression و Evidence در هر دو Checklist ثبت شده باشد.

Evidence مرحلهٔ `UI-1.6` در 2026-09-27:

- آرشیو portable رسمی Node `v24.19.0` برای Windows x64 با SHA-256 برابر `57f71ab3652e797d84acddc79c81cc9ff1c6ddb2a1974cdb83f00fee9bff4c73` تأیید و بدون تغییر Node سراسری سیستم استفاده شد؛ npm برابر `11.17.0` بود.
- Gate جامع `test:edition-boundary` با همین runtime برابر `36/36` پاس شد؛ component/browser و FULL visual برابر `46/46` و Attendance real-app برابر `70/70` پاس شدند. FULL visual baseline، shared primitives، تمام صفحه‌های Attendance، سه زبان، Light/Dark، LTR/RTL، Desktop/Mobile، stateها و modalها بدون update سبز ماندند.
- چهار فرمان رسمی `build:full`، `verify:full`، `build:attendance` و `verify:attendance` پاس شدند. manifest نسخهٔ FULL برابر `98422a71552ae543131cac640b6e9ad9271cfae55f067cd1938ad193327527a9` و نسخهٔ ATTENDANCE برابر `2f5364de5dc4b67227a7596d0acdec2d0426a8333aa14c1095407d623fe780cc` است؛ هر دو build identity نسخهٔ Node دقیق `24.19.0` را ثبت می‌کنند.
- اسکن مستقل روی `release/FULL/client` و `release/ATTENDANCE/client` پاس شد: نسخهٔ حاضری هیچ Customer/Finance، route/request اختیاری، Inbox/Sound، WebSocket، Full adapter/chunk یا AtlasGym asset ندارد و markerهای Core مصوب حاضرند.
- baselineهای FULL و Attendance در Desktop Dark/LTR، Desktop Light/RTL و Mobile مستقیم بازبینی شدند؛ Audit redaction و Backups Mobile نیز بازبینی شد و یک اجرای واقعی Pashto/RTL روی Employees بدون overflow یا شکست layout تأیید شد. تصویر موقت و hook تصویربرداری وارد repository نشدند.
- diff نهایی فقط مستندات پذیرش را تغییر می‌دهد؛ هیچ فایل تولیدی، Server، Prisma، Database، Licensing، Guardian، Installer، Permission/API یا Device processing تغییر نکرد و هیچ Database/K40/Windows service اجرا نشد.

## 6. Baseline ثبت‌شده پیش از شروع

در 2026-09-26 روی Commit `d2f98c9` و Worktree تمیز:

- `npm.cmd run test:edition-boundary` از `server`: `PASS` در تمام 36 مرحله
- Client component/browser matrix: `37/37 PASS`
- Attendance real-app matrix: `12/12 PASS`
- FULL و ATTENDANCE production build و route/chunk isolation scan: `PASS`
- Server TypeScript، Client TypeScript و Client lint: `PASS`
- Database واقعی، migration، K40 و Windows service اجرا یا تغییر داده نشدند.
- اجرای Baseline با Node محلی `22.19.0` انجام شد. Gate رسمی نهایی باید با Node دقیق `24.19.0` تکرار شود.
- Warning شناخته‌شدهٔ Vite دربارهٔ Chunk بزرگ همچنان موجود است و در این Work Package به‌تنهایی failure محسوب نمی‌شود.

## 7. سیاست Rollback و توقف

- اگر FULL visual baseline ناخواسته تغییر کرد، همان Commit پذیرفته نمی‌شود.
- اگر Attendance Artifact یک marker/chunk/asset ممنوع داشت، مهاجرت متوقف و dependency graph اصلاح می‌شود؛ حذف assertion یا مخفی‌کردن marker راه‌حل نیست.
- اگر Network call، Permission، Route یا payload تغییر کرد، تغییر presentation محسوب نمی‌شود و به Scope review برمی‌گردد.
- اگر Gate تجمعی شکست خورد، مرحلهٔ بعد شروع نمی‌شود و آخرین Commit سبز مرز Rollback است.
- Snapshot فقط وقتی update می‌شود که تغییر ظاهری مشخص، بازبینی‌شده و در Evidence توضیح داده شده باشد.

## 8. فایل‌های محتمل در Scope

- `client/src/layouts/**`
- `client/src/routing/**` فقط برای اتصال Shell و metadata نمایشی
- `client/src/components/ui/**` و primitiveهای presentation جدید
- `client/src/pages/attendance-edition/**`
- `client/src/pages/employees/**` فقط presentation
- `client/src/index.css` و configهای Brand
- `client/tests/**` و `client/scripts/test-route-build-boundary.mjs`
- `docs/EDITION_UI_UNIFICATION_PLAN.md`
- `docs/ATTENDANCE_EDITION_CHECKLIST.md`
- `docs/PROJECT_CHECKLIST.md`

قرارگرفتن یک فایل در این فهرست به‌تنهایی مجوز تغییر business logic آن نیست. هر Diff باید به آیتم فعال `UI-1.x` قابل‌ردیابی باشد.

## 9. وضعیت جاری

| Item | Status | Evidence |
| --- | --- | --- |
| مسئله و علت ریشه‌ای | `[x]` | Shell و page implementationهای موازی؛ `DashboardLayout` دارای dependency و side effect مخصوص FULL |
| Baseline امنیت/عملکرد | `[x]` | Edition boundary 36/36، browser 37/37، Attendance real-app 12/12 در 2026-09-26 |
| تصمیم معماری | `[x]` | Shared visual system با adapterهای Edition و Brand build-selected |
| UI-1.1 Visual baseline tests | `[x]` | پنج Screenshot مرجع FULL؛ focused برابر 5/5؛ Edition boundary برابر 36/36، browser برابر 42/42 و Attendance real-app برابر 12/12؛ بدون تغییر کد تولیدی |
| UI-1.2 SharedAppShell | `[x]` | Shell مشترک بدون dependency مخصوص FULL؛ adapter مجزای FULL؛ Visual برابر 5/5؛ Navigation برابر 4/4؛ Edition boundary برابر 36/36، browser برابر 42/42 و Attendance real-app برابر 12/12 |
| UI-1.3 Attendance shell migration | `[x]` | `AttendanceShellAdapter` روی `SharedAppShell`؛ حذف Shell/copy موازی؛ FULL visual برابر 5/5 و Attendance visual برابر 4/4؛ build isolation پاس؛ Edition boundary برابر 36/36، browser برابر 42/42 و Attendance real-app برابر 16/16 |
| UI-1.4 Shared primitives | `[x]` | inventory و قرارداد migration ثبت؛ primitiveهای مفقود ساخته و موجودها reuse شدند؛ سه visual baseline و accessibility interaction برابر 4/4؛ FULL 5/5، Attendance 4/4، Edition 36/36، browser 46/46 و real-app 16/16 |
| UI-1.5 Attendance page migration | `[x]` | هر هفت مرحله تکمیل؛ Admin Users/Audit Logs/Backups با هشت baseline بازبینی‌شده، behavior برابر 3/3 و 5/5، Edition برابر 36/36، browser/FULL برابر 46/46 و Attendance real-app برابر 70/70؛ build isolation و قراردادهای Admin/Audit/Backup سالم |
| UI-1.6 Final acceptance | `[x]` | Node دقیق 24.19.0؛ Edition 36/36، browser/FULL 46/46، Attendance 70/70؛ build/verify هر دو Edition و اسکن مستقیم artifact پاس؛ visual و سه زبان بازبینی؛ بدون تغییر منطق تولیدی |
