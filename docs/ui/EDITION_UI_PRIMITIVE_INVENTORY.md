# موجودی primitiveهای مشترک رابط کاربری دو Edition

تاریخ: 2026-09-26

وضعیت: `UI-1.4 COMPLETE`

مرجع Scope: [طرح یکسان‌سازی رابط کاربری](EDITION_UI_UNIFICATION_PLAN.md)

## 1. تصمیم

هر دو Edition باید یک قرارداد presentation مشترک داشته باشند، اما این مرحله هیچ صفحه، API، payload، query key، Permission یا business behavior را مهاجرت نمی‌کند. `UI-1.4` فقط primitiveهای لازم برای مهاجرت مرحله‌ای `UI-1.5` را تثبیت و تست می‌کند.

قاعدهٔ اصلی:

- primitive موجود و کافی reuse می‌شود؛ نسخهٔ موازی ساخته نمی‌شود.
- primitive عمومیِ مفقود در `client/src/components/ui/**` ساخته می‌شود.
- componentهای domain-specific تا زمان مهاجرت صفحهٔ مالک حذف یا بازنویسی نمی‌شوند.
- primitive مشترک نباید Auth، API، Route Manifest، Product Brand، WebSocket، Inbox، Sound یا business service را import کند.

## 2. موجودی و انتخاب canonical

| Primitive | وضعیت پیش از UI-1.4 | تصمیم canonical | شواهد/مرز مهاجرت |
| --- | --- | --- | --- |
| `PageHeader` | component عمومی وجود نداشت؛ headerها داخل صفحه‌ها تکرار می‌شدند | `components/ui/PageHeader.tsx` اضافه شد | عنوان semantic، توضیح، eyebrow، icon و action slot؛ مهاجرت مصرف‌کننده‌ها فقط در UI-1.5 |
| `SummaryCard` | چهار تعریف محلی با نام `SummaryCard` و چند card اختصاصی دیگر | `components/ui/SummaryCard.tsx` اضافه شد | toneهای neutral/brand/success/warning/danger؛ cardهای دارای منطق domain تا مهاجرت صفحه باقی می‌مانند |
| `FilterPanel` | `ReportFiltersPanel` موجود و دارای هشت مصرف‌کننده بود | همان `components/reports/ReportFiltersPanel.tsx` reuse شد | `aria-expanded` با `aria-controls` و content id قطعی تکمیل شد؛ primitive موازی ساخته نشد |
| `DataTable` | suite مشترک در ۲۲ فایل استفاده می‌شد | همان `components/ui/DataTable.tsx` reuse شد | semantics جدول حفظ شد؛ row کلیک‌پذیر با Enter/Space و focus-visible قابل استفاده شد |
| `StatusBadge` | پنج تعریف محلی با نام `StatusBadge` و badgeهای domain-specific | `components/ui/StatusBadge.tsx` اضافه شد | tone عمومی و dot اختیاری؛ badgeهای دارای enum/label domain در UI-1.5 adapter می‌گیرند |
| `Modal` | foundation عمومی وجود نداشت و ۱۶ Modal محلی در صفحه‌ها بود | `components/ui/Modal.tsx` اضافه شد | dialog/aria-modal، label/description، initial focus، focus trap، Escape، backdrop و focus restore؛ فرم و mutation بیرون primitive می‌ماند |
| `Button` | buttonهای raw و action componentهای محلی متعدد | `components/ui/Button.tsx` اضافه شد | variantهای primary/secondary/ghost/danger، اندازه، loading و icon slot؛ Permission در مصرف‌کننده باقی می‌ماند |
| `EmptyState` | حالت‌های خالی عمدتاً markup محلی یا `DataTableEmptyRow` بودند | `EmptyState` در `components/ui/StatePanel.tsx` اضافه شد | حالت صفحه/section؛ `DataTableEmptyRow` برای empty row جدول همچنان canonical است |
| `ErrorState` | markup خطا در صفحه‌ها تکرار می‌شد | `ErrorState` در `components/ui/StatePanel.tsx` اضافه شد | `role=alert`، توضیح و action slot؛ retry behavior را مصرف‌کننده تزریق می‌کند |
| `PaginationControls` | component مشترک در هفت فایل استفاده می‌شد | همان `components/ui/PaginationControls.tsx` reuse شد | wrapper به `nav` semantic تبدیل و aria-label در English/Dari/Pashto اضافه شد؛ جهت iconها از RTL/LTR می‌آید |

## 3. قرارداد token و styling

primitiveهای جدید فقط از tokenهای theme مشترک استفاده می‌کنند. tokenهای semantic زیر به `index.css` اضافه شدند و روی tokenهای موجود Dark/Light سوارند:

| Token | کاربرد |
| --- | --- |
| `--ui-surface` | سطح اصلی card/component |
| `--ui-surface-muted` | سطح ثانویه و footer/state |
| `--ui-surface-raised` | header و dialog برجسته |
| `--ui-border` | border عادی |
| `--ui-border-strong` | border تعاملی/برجسته |
| `--ui-focus-ring` | focus-visible مشترک |
| `--ui-overlay` | backdrop Modal |

قواعد Direction از logical properties و `dir` می‌آیند. هیچ رنگ Light/Dark داخل JSX hard-code نشده و motion همهٔ primitiveهای جدید زیر `prefers-reduced-motion: reduce` خاموش می‌شود.

## 4. Accessibility contract

- همهٔ actionها با keyboard قابل دسترسی‌اند و focus-visible مشترک دارند.
- row کلیک‌پذیر `DataTable` با Enter و Space فعال می‌شود.
- `ReportFiltersPanel` رابطهٔ toggle/content را با `aria-controls` و `aria-expanded` اعلام می‌کند.
- `PaginationControls` یک `nav` نام‌دار و localized است.
- `Modal` دارای `role=dialog`، `aria-modal`، title/description association، initial focus، focus trap، Escape close و focus restore است.
- `ErrorState` یک alert و `EmptyState` یک status semantic است.
- iconهای تزئینی از accessibility tree حذف می‌شوند.

## 5. Gate خودکار UI-1.4

`client/tests/ui-primitives-harness.tsx` داده و state قطعی فراهم می‌کند و `client/tests/ui-primitives.spec.ts` موارد زیر را قفل می‌کند:

- Dark/LTR با FilterPanel باز؛
- Light/RTL؛
- Modal dark/LTR؛
- keyboard activation، Focus trap/restore، Escape، Table/Pagination semantics و reduced motion.

سه screenshot مرجع فقط برای این primitive gallery هستند و baselineهای FULL/Attendance را جایگزین نمی‌کنند. suite با `npm.cmd run test:ui-primitives` اجرا و داخل `test:edition-components` نیز اجرا می‌شود.

نتیجهٔ نهایی 2026-09-26: primitive suite برابر `4/4`، FULL visual برابر `5/5`، Attendance visual برابر `4/4`، Edition boundary برابر `36/36`، browser matrix برابر `46/46` و Attendance real-app برابر `16/16` پاس شد.

## 6. قواعد مصرف در UI-1.5

1. هر صفحه ابتدا primitive canonical را با props نمایشی مصرف می‌کند؛ API و state مالک در صفحه باقی می‌ماند.
2. local component فقط وقتی باقی می‌ماند که منطق domain واقعی داشته باشد؛ دلیل آن در Diff همان صفحه ثبت می‌شود.
3. raw color/surface/border/focus جدید مجاز نیست؛ ابتدا token مشترک بررسی می‌شود.
4. `DataTableEmptyRow` داخل table و `EmptyState` برای section/page استفاده می‌شوند.
5. Modal جدید هیچ mutation یا Permission را مالک نمی‌شود.
6. پس از هر صفحه، تست رفتار موجود، Visual هر دو Theme/Direction و build-isolation باید قبل از صفحهٔ بعد پاس شود.

## 7. موارد آگاهانه باقی‌مانده

- حذف local SummaryCard/StatusBadge/Modalها بخشی از UI-1.4 نیست؛ این کار همراه با صفحهٔ مالک در UI-1.5 انجام می‌شود.
- primitiveهای domain-specific مانند `MemberStatusBadge` تا وقتی mapping تجاری خود را دارند حذف نمی‌شوند.
- mobile visual کامل هر صفحه در UI-1.5 و matrix نهایی در UI-1.6 ثبت می‌شود؛ responsive behavior پایهٔ primitiveها اکنون در CSS موجود است.
