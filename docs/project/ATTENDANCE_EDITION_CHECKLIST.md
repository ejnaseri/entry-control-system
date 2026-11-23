# چک‌لیست تبدیل پروژه به نسخهٔ کامل و نسخهٔ حاضری

به‌روزرسانی ۲۰۲۶-۱۱-۱۸ کابل: [اتصال نوع‌دار زنجیرهٔ V3 در W03](../licensing/plans/LICENSING_LIC008_STANDARD_NATIVE_LOADER_PROFILE.md) انجام شد. مهر جایگاه ۴۰ شناسهٔ پوشهٔ تأییدشدهٔ `stage` را حمل می‌کند و نویسندهٔ رزرو، خوانندهٔ تازهٔ رزرو و مدل پیش‌فعال‌سازی، نیت کاربر V3 و همان مهر را لازم دارند. مدل با داده‌های تزریق‌شده، اصل‌های جایگاه‌های ۰ تا ۴۳ را به هم وصل و اصل‌های پایانی را دوباره می‌خواند. ساخت بستهٔ V8 با ۲۵ ورودی در هر سه نسخهٔ دات‌نتِ سخت‌گیر به‌ترتیب ۱۴۴/۱۳۴/۱۰۲۰/۷۰۰/۱۸۷/۸۲/۱۵۷/۴۴/۳۳۱/۱۰۶/۷۶ بررسی و ۲۰ رد فرمان عملیاتی را گذراند. [شواهد V8](../licensing/evidence/standard-native-typed-chain-v3-20261118/README.md) هش مجموعهٔ منبع `87ab17b4ab7dabdfa19c826970f8dcedc42fa45a845061a4284efff56102c921` را ثبت می‌کند. مخزن ویندوزی فقط قابل‌کامپایل است و فایل واقعی جایگاه ۴۰ را نگه نمی‌دارد یا دوباره نمی‌خواند. نگهداری واقعی فایل‌ها و فرایندها، پل فعال‌سازی و اجرای کامل هنوز باقی‌اند؛ حساب آزمایشی غیرفعال، W03 اجرا نشده، LIC008 `[~]` و LIC-OPEN-003 باز است.

اصلاح ۲۰۲۶-۱۱-۱۱ کابل: [nonce سرویس در مدل W03](../licensing/plans/LICENSING_LIC008_STANDARD_NATIVE_LOADER_PROFILE.md) اکنون مطابق قرارداد طرح و بارگذار، دقیقاً ۶۴ رقم هگز کوچک می‌پذیرد و شکل قدیمی ۳۲ رقمی را رد می‌کند. سه ساخت تازه و مستقل بازبینی‌شده، هرکدام آزمون‌های خالص ۱۴۴/۱۲۵/۱۰۲۰/۷۰۰ و ۱۹ رد فرمان عملیاتی را گذراندند. [پنج گزارش اصلی اصلاح‌شده](../licensing/evidence/standard-native-package-binding-v2-nonce64-20261111/README.md) بایت‌به‌بایت ثبت شده‌اند؛ ساخت قبلی با ۱۰۱۱ آزمون، سابقهٔ تاریخی است. منبع معتبر run-id و nonce برای Owner/User پیش از CLR، نگهداری واقعی فایل‌های محافظت‌شده و آزمون فیزیکی W03 هنوز بازند؛ LIC008/Open003 و پذیرش امنیتی تغییر نکرده‌اند.

به‌روزرسانی ۲۰۲۶-۱۱-۱۱ کابل: [اتصال بستهٔ نامزد V2 برای W03](../licensing/plans/LICENSING_LIC008_STANDARD_NATIVE_LOADER_PROFILE.md) مستقل بازبینی شد. این مدل، شش جریان اصلی، هفت منبع ثابت، چهار دارایی و بایت‌های ۱۸۹ فایل runtime را با هش‌ها و اندازه‌ها تطبیق می‌دهد. هر سه ساخت دات‌نت با هشدارهای ممنوع، آزمون‌های خالص ۱۴۴/۱۲۵/۱۰۱۱/۷۰۰ و ۱۹ رد فرمان عملیاتی را گذراندند. [پنج گزارش اصلیِ بایت‌به‌بایت](../licensing/evidence/standard-native-package-binding-v2-20261111/README.md) با مجموع ۱۰۲٬۶۸۳ بایت ثبت و مستقل تطبیق شدند. این فقط نامزدِ حافظه‌ای و بدون امضای معتبر است؛ نگهداری واقعی فایل‌های محافظت‌شده، هویت فرایند و توکن، سرویس و CLR، ورود حساب آزمایشی و کلید پایدار هنوز آزموده نشده‌اند. پذیرش فیزیکی همیشه رد می‌شود و W03، LIC008/Open003 و پذیرش امنیتی باز هستند.

به‌روزرسانی ۲۰۲۶-۱۱-۱۱ کابل: [بارگذار بومی و مدل کنترل V2 برای W03](../licensing/plans/LICENSING_LIC008_STANDARD_NATIVE_LOADER_PROFILE.md) ساخته و مستقل بازبینی شدند. سه نسخهٔ بارگذار به‌ترتیب ۳۸۵، ۳۸۵ و ۴۰۵ بررسی تزریقی را گذراندند و هرکدام ۱۹ فرمان عملیاتی را رد کردند. [هشت گزارش اصلی](../licensing/evidence/standard-native-loader-v1-20261111/README.md) و بازبینی مستقل، سه فایل PE و وابستگی‌های آن‌ها و همهٔ ۱۹٬۵۲۰ فایل ابزار Zig را تطبیق می‌دهد. پروفایل، قرارداد ورودی و مدل ۶۸ رکوردی ذخیره‌سازی در هر سه ساخت دات‌نت به‌ترتیب ۱۴۴، ۱۲۵ و ۱۰۱۱ آزمون خالص را گذراندند و هر ساخت ۱۹ فرمان را رد کرد. [پنج گزارش اصلی](../licensing/evidence/standard-native-control-v2-20261111/README.md) و بازبینی مستقل، هفت ورودی و ۳۷۵ ثبتِ فایل نصب‌شده با ۳۷۴ مسیر یکتا را بررسی کردند. این‌ها آزمون اجزای بسته‌اند. ذخیره‌سازی محافظت‌شده، هویت واقعی فرایند و توکن، سرویس، بارگذاری CLR، ورود حساب آزمایشی و آزمون کلید پایدار هنوز اجرا نشده‌اند؛ W03 و LIC008/Open003 و پذیرش امنیتی باز هستند.

به‌روزرسانی ۲۰۲۶-۱۱-۱۱ کابل: [پایهٔ بومی راه‌اندازی W03](../licensing/plans/LICENSING_LIC008_STANDARD_NATIVE_HOST.md) با چهار نقش و سه نسخهٔ بسته ساخته شد. هر نسخه ۲۴۵۵ آزمون خالص را گذراند و ۱۵ ورودی عملیاتی را رد کرد. [هشت گزارش خام و بدون تغییر بایت](../licensing/evidence/standard-native-host-foundation-v1-20261103/README.md) منبع، فایل اجرایی و وابستگی‌های واردشده را ثبت می‌کنند؛ بازبینی مستقل خروجی با ۱۳۹۳۶۳ بررسی فقط‌خواندنی پاس شد. فراخوانی واقعی ویندوز، اجرای سرویس، بارگذاری دات‌نت، ورود با حساب آزمایشی و آزمون کلید پایدار انجام نشده است. اتصال کامل بارگذار، قرارداد تازهٔ مجوز، اثبات فرایند و توکن، مصرف پایدار مراحل و کنترل‌کننده و گردآورنده پیش از آزمون واقعی W03 لازم است. LIC008 و Open003 باز هستند.

به‌روزرسانی ۲۰۲۶-۱۱-۰۴ کابل: [انتقال هویت مالک و گزارش‌های سرویس W03](../licensing/plans/LICENSING_LIC008_STANDARD_TRANSFER_JOURNALS.md) شامل مدل یک‌بارمصرف نسخهٔ دوم، نگاشت ۱۵ فایل ثابت گزارش سرویس به مخزن محافظت‌شده و محدودیت صریح دسترسی Setup پیاده شد. هر سه نسخه ۲۲۹۸۷ بررسی مصنوعی و ۴۱ ورودی بسته را پاس کردند؛ بازبینی مستقل منبع و خروجی با ۱۵۳۰ بررسی فقط‌خواندنی تأیید شد. [چهار گزارش اصلی](../licensing/evidence/standard-user-owner-transfer-v1-20261103/README.md) ثبت شده‌اند. انتقال واقعی، فعال‌سازی یا ورود حساب، اجرای سرویس و آزمون کلید واقعی انجام نشده است. قدم بعدی اتصال واقعی فرایند و انتقال، قرارداد ورودی و مصرف پایدار نسخهٔ دوم، ServiceMain، محیط راه‌اندازی مشخص، هویت دات‌نت بارگذاری‌شده، پوشهٔ موقت محافظت‌شده و کنترل‌کنندهٔ کامل است. W03 و LIC008/Open003 باز می‌مانند.

تکمیل بعدی در ۲۰۲۶-۱۱-۰۴ کابل: [اتصال‌های بومی W03](../licensing/plans/LICENSING_LIC008_STANDARD_NATIVE_LIFECYCLE.md) شامل نگهداری همان حساب با SID، تبدیل صریح پرچم‌های SAM و NetAPI، چرخهٔ سرویس تازه و مشاهدهٔ جداگانهٔ فرایند و توکن پیاده و منبع مستقل تأیید شد. هر سه نسخه ۱۹۳۸۲ بررسی مصنوعی و ۳۷ ورودی بسته را پاس کردند؛ [چهار گزارش اصلی](../licensing/evidence/standard-user-native-lifecycle-v1-20261103/README.md) ثبت شد و بازبینی مستقل خروجی با ۱۴۹۶ بررسی فقط‌خواندنی پاس شد. مسیرهای واقعی همچنان بسته‌اند و حساب، سرویس یا کلید واقعی در این آزمون‌ها تغییری نکرد. اتصال گزارش‌های سرویس، ServiceMain، پذیرش واقعی فرایند، مجوز ارتباط با مالک، هویت کد و دات‌نت بارگذاری‌شده، مصرف پایدار مراحل و کنترل‌کنندهٔ کامل باقی است. آزمون واقعی W03 و بستن LIC008/Open003 هنوز انجام نشده‌اند.

تکمیل بعدی در ۲۰۲۶-۱۱-۰۴ کابل: [چرخهٔ حساب آزمایشی](../licensing/plans/LICENSING_LIC008_STANDARD_ACCOUNT_LIFECYCLE.md) با ثبت چهار گزارش پایدار، بررسی مالکیت پیش از تغییر و الزام اثبات پایان فرایند برای بازگشت به حالت غیرفعال، پیاده و منبع مستقل بازبینی شد. هر سه نسخه ۱۲۸۵۵ بررسی مصنوعی و ۲۶ ورودی بسته را پاس کردند. [چهار گزارش اصلی](../licensing/evidence/standard-user-account-lifecycle-v1-20261103/README.md) ثبت شد. بخش تغییر واقعی حساب هنوز پیاده نشده و حساب واقعی فعال یا وارد نشده است؛ قدم بعدی اتصال امن به SID، هویت واقعی فرایندها، نسخهٔ بارگذاری‌شدهٔ دات‌نت، سرویس‌ها و کنترل‌کنندهٔ کامل است.

بازبینی مستقل خروجی چرخهٔ حساب نیز با ۱۴۱۶ بررسی فقط‌خواندنی پاس شد؛ حساب واقعی در این آزمون‌ها تغییری نکرد.

به‌روزرسانی ۲۰۲۶-۱۱-۰۴ کابل: [ارتباط و پذیرش کارگرهای W03](../licensing/plans/LICENSING_LIC008_STANDARD_ADMISSION.md) شامل مجوز یک‌بارمصرف، ثبت پایدار گزارش‌ها توسط کنترل‌کننده، کانال محلی و نگهداری فایل‌ها پیاده و منبع مستقل بازبینی شد. هر سه نسخه ۱۱۳۹۲ بررسی مصنوعی و ۲۲ ورودی بسته را پاس کردند؛ [چهار گزارش اصلی](../licensing/evidence/standard-user-admission-v1-20261103/README.md) ثبت شد. اتصال واقعی هویت فرایندها، اثبات نسخهٔ بارگذاری‌شدهٔ دات‌نت، ثبت پایدار مصرف هر مرحله، اثرهای حساب/سرویس و کنترل‌کنندهٔ کامل باقی است. حساب آزمایشی فعال نشده و آزمون واقعی W03 هنوز اجرا نشده است.

بازبینی مستقل خروجی این بخش با ۱۴۰۱ بررسی فقط‌خواندنی پاس شد؛ این نتیجه هنوز پذیرش آزمون واقعی ویندوز نیست.

تکمیل بعدی W03 در ۲۰۲۶-۱۱-۰۳: [قرارداد ورودی، مخزن محافظت‌شده و ساخت کلید](../licensing/plans/LICENSING_LIC008_STANDARD_CONSTRUCTION.md) پیاده و منبع به‌صورت مستقل بازبینی شد. هر سه نسخه ۸۷۶۲ بررسی و ۱۸ ورودی بسته را پاس کردند. [چهار گزارش اصلی](../licensing/evidence/standard-user-construction-v1-20261103/README.md) بایگانی شد. مسیر اجرای واقعی بسته است. قدم بعدی، ارتباط تأییدشده و مجوز یک‌بارمصرفِ کارگرها، نگهداری فایل‌های اجرایی، اثرهای حساب/سرویس و کنترل‌کنندهٔ کامل است. ورود با حساب آزمایشی و مقایسهٔ واقعی کلید هنوز اجرا نشده است.

بازبینی مستقل خروجی این بخش نیز با ۱۳۶۰ بررسی فقط‌خواندنی پاس شد؛ این نتیجه پذیرش آزمون واقعی ویندوز یا بسته‌شدن LIC008 نیست.

به‌روزرسانی ۲۰۲۶-۱۱-۰۳: [اجزای بستهٔ W03](../licensing/plans/LICENSING_LIC008_STANDARD_COMPONENTS.md) شامل شروع معلق فرایند، نگهداری رمز، منطق مقایسه و بازکردن/بررسی/رمزگشایی کلید پیاده و مستقل بازبینی شدند. هر سه نسخه ۳۰۳۸ بررسی و ۱۳ ورودی بسته را پاس کردند؛ ۸۵۸ بررسی مستقل خروجی هم پاس شد. این‌ها آزمون ساخت و دادهٔ مصنوعی هستند؛ ورود با حساب آزمایشی و آزمون کلید پایدار هنوز اجرا نشده‌اند. قدم بعدی تکمیل محیط تازه، ثبت پایدار ساخت کلیدها، سرویس‌ها و ارتباط کاربر، سپس کنترل‌کنندهٔ کامل است. LIC008 هنوز باز است.

وضعیت جاری LIC008 - 2026-11-02: [V5 پس از بازبینی و CONFIRM دستی اجرا شد](../licensing/evidence/export-policy-control-v5-run-20261102/README.md). پایان مستقل هر دو فرایند و گزارش آن‌ها تأیید و Guardian بازگردانده شد. در دو قالب تفاوت سیاست export مشاهده شد؛ قالب opaque و نتیجهٔ کلی نامعین باقی ماند. ۱۸٬۴۸۰ بررسی کد پاس شده و [۱۹ گزارش اصلی قدیمی بایگانی شد](../licensing/evidence/wrapping-retained-originals-20261028/README.md). [حساب آزمایشی تازه ساخته و بازبینی شد](../licensing/evidence/standard-account-preparation-v1-run-20261102/README.md): غیرفعال و فقط عضو Users است. [بخش تشخیص هویت](../licensing/plans/LICENSING_LIC008_STANDARD_IDENTITY_FOUNDATION.md) با ۳۰۵ بررسی برای هر نسخه و بازبینی مستقل آماده است؛ خواندن واقعی توکن فقط متعلق به حساب فعلی Owner بود. هنوز با حساب آزمایشی وارد نشده‌ایم و راه‌انداز کامل مقایسهٔ رمزنگاری W03 پیاده نشده است. فقط همین لپ‌تاپ موجود است؛ TPM، دستگاه مستقل و پذیرش نهایی باز هستند.

آخرین وضعیت LIC008 — 2026-10-28: [اجرای V4 مصرف‌شده](../licensing/evidence/export-policy-control-v4-run-20261028/README.md)
محل توقف را SetupRun/StoppedProcess مشخص کرد: فرایند در وضعیت RUNNING دیده و
ثبت نشده بود؛ گزارش Setup تکمیل است، اما خواندن آن انجام نشد و Guardian اجرا نشد.
[اصلاح مشاهدهٔ شروع](../licensing/plans/LICENSING_EXPORT_POLICY_PROCESS_OBSERVATION_FIX.md)
با حفظ شرط‌های پایان فرایند، بازبینی مستقل و ۱۸٬۳۱۶ بررسی غیرفعال پاس شد.
قدم بعد زنجیرهٔ تازهٔ V5 است؛ V1/V2/V3/V4 تکرار نشوند.
[فهرست کامل کارها](../licensing/plans/LICENSING_LIC008_COMPLETION_PLAN.md)
فقط دسترسی به همین لپ‌تاپ و بازبودن شواهد TPM/دستگاه مستقل و پذیرش نهایی را ثبت می‌کند.

وضعیت جاری کد LIC008 — 2026-10-28: ثبت محدود مرحله‌های کنترلر و مشاهده‌های هر
نقش با schema3 / RESULT_V3 پیاده شد؛ اعتبار آن NONE است و رد شدن خواندن گزارش
جدا از گزارش خالی یا خواندن انجام‌نشده ثبت می‌شود. ساخت غیرفعال و بازبینی مستقل
بسته پاس شدند: ۱۸٬۰۷۶ بررسی در هر گونه و apphost، شامل ۱٬۴۹۹ بررسی کنترلر
(۲۳۴ مورد تازه)، ۱۴ رد ورودی در هر کدام و ۲۹۵ آزمون خالص اعتبارسنج بستهٔ مالک.
بستهٔ دارای قابلیت/مالک، ورودی یا اجرای واقعی تازه‌ای ایجاد نشد. قدم بعد بازبینی
مستقل فضای نام و زنجیرهٔ اتصال تازه برای مشاهدهٔ عملیاتی بعدی است؛ علت دقیق V3
هنوز معلوم نیست و LIC008/مرحلهٔ 6.2 و پذیرش امنیتی/محصول بازند.
[قرارداد تشخیص و شواهد بررسی](../licensing/plans/LICENSING_EXPORT_POLICY_CONTROLLER_DIAGNOSTICS.md).

آخرین اجرای واقعی LIC008 — 2026-10-28: آزمایش V3 با شناسهٔ
9dded1f90d5b4299ba973898bf42890c پس از CONFIRM دستی انجام شد و مصرف‌شده است.
پیش‌بررسی، آماده‌سازی و بازبینی ورودی پاس شدند. Setup با LocalSystem از بررسی
توکن عبور کرد و SETUP_COMPLETE و ساخت دو کلید تازه را ثبت کرد؛ اما کنترلر در
run-setup با UNKNOWN/VALIDATION/0x80131501 متوقف شد. شرط دقیق شکست هنوز ثبت نشده؛
کد خروج صفر Setup به‌تنهایی تأیید پایان مستقل فرایند نیست. Guardian وارد آزمایش
نشد و با مسیر/حساب اصلی، متوقف و PID صفر باقی ماند؛ آزمون جفتی export انجام نشد.
پنجرهٔ خالی قبلی بدون CONFIRM توسط مالک بسته شد و ورودی آن استفادهٔ دوباره نشد.
[شواهد دقیق V3 و بررسی بعدی](../licensing/evidence/export-policy-control-v3-run-20261028/README.md).
کد تشخیصی بالا شواهد تازه‌ای به این اجرای مصرف‌شده اضافه نمی‌کند؛ مرحله‌ها
محل کلی عملیات را نشان می‌دهند و همهٔ شرط‌های درونی را مشخص نمی‌کنند.
V1/V2/V3 حفظ شوند؛ تکرار، پاک‌سازی یا تغییر بستهٔ مصرف‌شده مجاز نیست.
LIC008/مرحلهٔ 6.2 و پذیرش امنیتی/محصول بازند.

سابقهٔ اصلاح Scalar — 2026-10-28: خوانندهٔ Scalar برای TokenType/TokenElevation
مستقیماً چهار بایت می‌خواند و طول و مقادیر مجاز را دقیق بررسی می‌کند؛ قواعد
هویت و خواندن اطلاعات با اندازهٔ متغیر تغییر نکرده‌اند. بسته‌های غیرفعال و دارای
قابلیت تازه، ۱۷٬۶۶۷ بررسی در هر گونهٔ ساخت و apphost، شامل ۴۹۴ بررسی هویت
(۱۲۶ مورد تازه)، را پاس کردند؛ پیش‌فرض/قدیمی ۱۴ و دارای قابلیت ۱۳ ورودی را رد کردند.
آزمون فقط‌خواندنی روی همان توکن فرایند
عادی نشان داد خوانندهٔ قدیمی TokenElevation را رد می‌کند و خوانندهٔ اصلاح‌شده
مقدار ۰ را برمی‌گرداند؛ TokenType در هر دو مقدار ۱ است. خطای ۲۴ فقط در این
بافت عادی بازتولید شد؛ سرویس مرحلهٔ IdentityElevation را ثبت کرده و موفقیت
LocalSystem هنوز آزموده نشده است. در آن مرحلهٔ اصلاح، بستهٔ مالک، ورودی یا فضای
نام تازه ایجاد نشده و اجرای واقعی تازه‌ای انجام نشده بود؛ کار V3 در بالا،
قدم بعدی آن یادداشت را جایگزین می‌کند.
[اصلاح و شواهد بررسی](../licensing/plans/LICENSING_EXPORT_POLICY_SCALAR_READER_FIX.md).
V1/V2 مصرف‌شده حفظ می‌شوند؛ LIC008، مرحلهٔ 6.2 و پذیرش امنیتی/محصول بازند.

وضعیت جاری آزمایش LIC008 — 2026-10-27: CheckOnly و Prepare نسخهٔ V2 با
دسترسی Administrator پاس شدند. پس از تأیید زندهٔ مالک، تلاش
`92d320aeca9d4a469b8e9b5c0b8dadcd` مصرف شد و در `run-setup` با `UNKNOWN` شکست خورد.
گزارش حفاظت‌شدهٔ کنترل‌کننده، `IdentityElevation / VALIDATION / 0x80131501`
و کدهای SCM `1066 / 0xEC10F301` را ثبت کرد؛ اعتبار تشخیصی آن `NONE` است.
آزمون فقط‌خواندنی توکنِ همان فرایند عادی، ناسازگاری خواننده را بازتولید کرد:
پرس‌وجوی اندازهٔ TokenElevation خطای ۲۴ و اندازهٔ ۴ داد؛ خواندن ثابتِ ۴ بایتی
با مقدار ۰ موفق شد، اما Scalar فعلی رد کرد چون Info فقط خطای ۱۲۲ را می‌پذیرد.
بافت سرویس LocalSystem بازتولید نشد و خطای بومی ۲۴ در اجرای واقعی سرویس ثبت نشده؛
این نتیجه به معنی کمبود دسترسی Administrator نیست. Setup با حساب LocalSystem
متوقف و PID0 است؛ Guardian اصلاً قرض گرفته نشد و با مسیر/حساب اصلی متوقف است.
سه مشاهدهٔ جمع‌آوری، فرایند زندهٔ آزمایش نیافتند. گزارش‌های دو نقش و هشت فایل
journal/مصرف یافت نشدند؛ شواهد مقایسهٔ خروج کلید نداریم. نبودن فایل‌ها، نبودن
کلید CNG را اثبات نمی‌کند. علت اصلی شکست V1 همچنان نامشخص است.
اصلاح جداگانهٔ کد در بخش بالا، قدم بعدی این یادداشت تاریخی را جایگزین می‌کند.
V1/V2 و ورودی‌ها/بسته‌هایشان حفظ شوند؛ تکرار، پاک‌سازی،
وصلهٔ فایل‌های نصب‌شده یا تغییر معیار قبولی خروج کلید مجاز نیست.
[شواهد حفاظت‌شده و حدود نتیجهٔ V2](../licensing/evidence/export-policy-control-v2-20261027/README.md).
مرحلهٔ 6.2، LIC008 و پذیرش امنیتی/محصول بازند.

سابقهٔ کد و بسته‌های LIC008 — 2026-10-27: زنجیرهٔ کامل نام‌ها، ریشه، Setup،
پیشوند کلید، SID، scope و قابلیت ساختِ جداگانهٔ ExportPolicyControlV2 پیاده شد.
ساخت و بازبینی بستهٔ غیرفعال، بستهٔ دارای قابلیت آزمایش و بستهٔ مالک پاس شد. همان
۱۷٬۵۴۱ بررسی در هر گونهٔ ساخت و apphost پاس شد؛ ۱۷۹ مورد مربوط به جداسازی V2 است.
گونه‌های پیش‌فرض/قدیمی هر کدام ۱۴ ورودی و بستهٔ دارای قابلیت ۱۳ ورودی نامعتبر
را رد کردند. ۴۳۶ بررسی ابزار، ۲۸۴ بررسی راه‌انداز، ۲۹۵ بررسی اعتبارسنج بسته،
۹ بررسی توکن خود فرایند و ۸ رد ورودی نامعتبر ابزار پاس شدند؛ هش‌های کد، ابزار،
مرجع و runtime تأیید شدند. هویت و ACL مربوط به Guardian و وضعیت نگه‌داشته‌شدهٔ
V1 تغییر نکرده‌اند؛ علت شکست قبلی همچنان نامشخص است.
در آن مرحلهٔ ساخت، CheckOnly، Prepare و اجرای واقعی V2 هنوز انجام نشده بودند؛
اکنون نتیجهٔ مصرف‌شدهٔ بالا، قدم بعدی آن یادداشت تاریخی را جایگزین می‌کند.
تأییدیهٔ مصرف‌شده و زمان انقضای تاریخی آن مجوز استفادهٔ مجدد نیستند.
[قرارداد V2، بررسی‌ها و هش‌های دقیق](../licensing/plans/LICENSING_EXPORT_POLICY_V2_PLACEMENT.md).
مرحلهٔ 6.2، LIC008 و پذیرش امنیتی/محصول بازند.

سابقهٔ آزمایش V1 — 2026-10-27: مالک اجرای واقعی را تأیید کرد؛
تلاش `f9ed088cce17426cb48759645d45e2e6` مصرف شد و در `run-setup` با نتیجهٔ
`UNKNOWN` متوقف شد. Setup با حساب LocalSystem، وضعیت Stopped و PID0 باقی است؛
کد خروج ویندوز `1067` است. Guardian اصلاً به تنظیمات آزمایش تغییر نکرد؛
دو مقدار `guardianBorrowAttempted=false` و `guardianRestored=false` به معنی
نیازنداشتن به بازگردانی‌اند. مسیر/حساب اصلی Guardian و توقف آن با PID0 تأیید شد.
گزارش Setup/Guardian یا نشانگر journal یافت نشد؛ شواهد مقایسهٔ خروج کلید نداریم
و علت دقیق شکست راه‌اندازی ثبت نشده است. نبودن فایل‌ها، نبودن کلید CNG را
اثبات نمی‌کند. کار کد و طرح تشخیصِ بعدی در بخش بالا ثبت شده است؛
تکرار، استفادهٔ مجدد از تأییدیه، بازسازی/وصلهٔ فایل‌های نگه‌داشته‌شده
یا تغییر معیار قبولی مجاز نیست. LIC008 و پذیرش امنیتی/محصول بازند.
[شواهد اجرای مصرف‌شده](../licensing/evidence/export-policy-control-20261027/README.md).

سابقهٔ آماده‌سازی ۲۷ اکتوبر: بستهٔ اصلاح‌شدهٔ مالک
`d3b686b0ca964df8b7a9f77fb289cefc` جداگانه ساخته شد؛ بستهٔ قبلی `86cb…`
که CheckOnly آن در ۲۵ اکتوبر ناموفق بود، بدون تغییر حفظ شده است.
۴۱۴ بررسی ابزار، ۱۹۵ بررسی راه‌انداز، ۲۹۵ بررسی اعتبارسنج بسته و ۸ رد ورودی
نامعتبر پاس شدند. ۹ بررسی فقط‌خواندنی توکن، خطای Query-only را بازتولید کرد
و موفقیت Query|Duplicate را با `isAdministrator=false/elevation=0` نشان داد؛
این نتیجه، پاس‌شدن پیش‌بررسی Administrator نیست. هش فایل kit.json:
`61a8519bd99c64e6b3d33504a4358a6d5185e783908f3231cd408cf0c9ed5dc8`.
CheckOnly با دسترسی Administrator و Prepare جداگانه، پیش از اجرای مصرف‌شده پاس شدند.
ورودی `f9ed088cce17426cb48759645d45e2e6` با هش‌ها و اثرات دقیق بازبینی شده بود؛
۲۷ اکتوبر ساعت ۱۵:۴۴:۳۴ کابل زمان انقضای تاریخی آن است و مجوز استفادهٔ مجدد نیست.
بسته، ورودی‌ها و فایل‌های نصب‌شده بدون تغییر حفظ شوند.
[جزئیات بستهٔ اصلاح‌شده](../licensing/experiments/LICENSING_EXPORT_POLICY_CONTROL.md#corrected-owner-kit--2026-10-27).

سابقهٔ آزمایش LIC008 — 2026-10-24: اجرای قبلی مالک، هفت پیش‌شرط را پاس کرد؛
خروج کلید در هر سه قالب با `0x80090029` نامشخص ماند و seal اجرا نشد.
Guardian به تنظیمات قبلی برگشت و متوقف است. شواهد V1/V2/V3 حفظ شوند؛
اجرای مصرف‌شده تکرار نشود. راه‌انداز و بستهٔ غیرفعال ابتدا با `e0b62f1`
کامیت شدند. اکنون بستهٔ قابل‌اجرای جداگانه، متصل به منبع و بستهٔ غیرفعال
بازبینی‌شده ساخته شد؛ نسخهٔ پیش‌فرض و تعریف‌های قدیمی همچنان غیرفعال‌اند.
قابل‌اجرا بودن به معنی مجوز اجرا نیست؛ تأیید مالک، بسته، هویت، انقضا و
CONFIRM زنده همچنان لازم‌اند. بازگشت Guardian فقط پس از اثبات خروج پردازش
و توقف سرویس مجاز است؛ وضعیت نامطمئن یا تغییر نیمه‌کاره مجوز تکرار نیست.
۱۰٬۹۰۶ بررسی مصنوعی در هر حالت پاس شدند؛ ۱۴ رد ورودی نسخهٔ غیرفعال،
۱۳ رد ورودی نامعتبر نسخهٔ قابل‌اجرا و ۸ رد ساخت بدون تولید بسته پاس شدند.
۲۲ ورودی منبع و ۱۹۰ فایل runtime تطبیق شدند. بررسی فقط‌خواندنی: Guardian
با تنظیمات اصلی متوقف است و پوشه/سرویس Setup آزمایش جدید وجود ندارند.
ابزار آماده‌سازی ورودی مالک و راه‌انداز جداگانه اکنون ساخته شدند: ۲۴۰ بررسی
مصنوعی ابزار، ۵۳ بررسی راه‌انداز، ۸ رد ورودی ابزار، ۵ رد ورودی راه‌انداز و
۴ رد ساخت بدون خروجی پاس شدند. فایل‌های runtime پیش از اجرای ابزار بررسی
می‌شوند؛ فقط DOTNET_ROOT همان پردازش موقتاً کنار گذاشته و برگردانده می‌شود.
حالت Prepare فقط سه فایل ورودی جدید با اعتبار دوساعته می‌سازد و هرگز خودکار
Execute نمی‌کند. بستهٔ مالک `86cb2dc5b6914a50a6e3b4563e3c106c` آماده است.
بررسی CheckOnly در دسترسی معمولی عامل، پیش از شروع ابزار به‌درستی رد شد؛
این نتیجه به معنی پاس‌شدن بررسی کامل Administrator نیست. قدم بعد، اجرای
CheckOnly توسط مالک با Administrator و بازبینی خروجی آن است؛ سپس هنگام
آمادگی مالک، ورودی تازه و بررسی جداگانهٔ هش‌ها/اثرات پیش از CONFIRM زنده.
هنوز کلید جدید یا اجرای واقعی این آزمایش نداشته‌ایم، تأییدیه صادر نشده و
معیار قبولی تغییر نکرده است. نبودن گزارش نهایی، حتی پس از انقضا، مجوز تکرار نیست.
LIC008 و پذیرش امنیتی/محصول همچنان بازند.
[نتیجه و طرح مقایسه](../licensing/experiments/LICENSING_EXPORT_POLICY_CONTROL.md).
خلاصه‌های قدیمی زیر، وضعیت تاریخی‌اند و دستور اجرای جاری نیستند.

آخرین وضعیت — 2026-10-13، CHG0151/EV0220: بستهٔ آزمایشی قابل‌اجرا ساخته و
بازبینی نویسنده انجام شد؛ نسخهٔ پیش‌فرض غیرفعال هم با ۱۰۵۳ آزمون و بررسی
بسته و رد ورودی‌های ناسازگار پاس شد. اجرای واقعی هنوز انجام نشده است.
قدم فوری: نهایی‌کردن ورودی/context و تأیید جداگانهٔ Prepare برای همین بسته؛
سپس اجرای سه مرحلهٔ مستقل و تطبیق شواهد. LIC008 تکمیل نشده؛ در Phase6.2
پنج مورد کامل، سه مورد در جریان و پنج مورد شروع‌نشده است. کارهای تحویل
6.3 تا6.6 و Phase7 بازند؛ Inbox نیز منتظر پذیرش K40 و فعال‌سازی تحویلی است.
[شواهد و ترتیب کارهای باقی‌مانده](../licensing/experiments/LICENSING_PILOT_FOUNDATION.md).
خلاصه‌های تاریخ‌دار قدیمی زیر، سابقه‌اند و قدم بعدی جاری را تعیین نمی‌کنند.

Current scheduling status — 2026-10-07: CHG0080/EV0149 adopts
[exact reviewed native-entry policy](../licensing/plans/LICENSING_NATIVE_ENTRY_ADOPTION.md).
Product and scoped independent-agent amendment Security approval recorded;
Open012 closed as scheduling-only. NATIVE-ENTRY NOT_READY; LIC008/Open003,
Vendor/artifact/contracts and all original full item/FILE/STORE/Windows/release
exits remain open as applicable. No native implementation or runtime authorization.
Older diagnostic/pending-dependency summaries below are historical checkpoints.

Current physical result: EV0135 completes V5/0.12.0 binary Repair simulation on Windows11 x64 build22000: key identity/envelope bytes preserved, Guardian/App/child controls and owned cleanup PASS, missing-key repair refused without recreation. V5 is consumed and must not be rerun. This is host-specific test evidence, not actual Installer Repair or security/production/matrix acceptance. EV0117's rejected DPAPI-NG result remains preserved as history.

Current next step: 2026-10-06: LIC001-005 remain complete; LIC006-008 remain in progress. EV0132 completes V4/0.11.0 normal restart on current Windows11 x64 build22000: same-key/envelope Guardian reopen/decrypt/export/tamper and App/actual-child contrast PASS; owned-key cleanup PASS; services independently Stopped/Manual. User-pasted summary confirms ordered boot/preparation times and normalRebootPassed=true; original protected report/checkpoint digests still need independent capture. CHG0065/EV0133 prepares fresh V5/0.12.0 binary Repair SIMULATION: Prepare creates/retains fresh test keys; Repair admits only verified existing keys/state, stages identical trusted bits in a separate directory, rechecks identity/envelopes/isolation, cleans up owned keys, then proves the same admission gate refuses controlled missing keys with retained envelopes and no recreation. Pure11/11, actual report contract, admission/evidence negative fixtures and package/parser guards PASS. EV0134 records V5 Prepare; EV0135 now records completed physical V5/0.12.0 Repair simulation on this host: same key identity and envelope bytes verified, Guardian/App/child controls PASS, owned-key cleanup PASS, controlled missing-key repair refused without key recreation. User-pasted summary reports repairSimulationPassed/hostFeasibilityPassed=true; original protected summary/checkpoint/evidence digests are not independently captured. Services independently Stopped/Manual. Never rerun V5. CHG0068/EV0137 prepared V6 Upgrade kit0.13.0; CHG0069/EV0138 now records physical OLD0.13.0 to NEW0.13.1 binary Upgrade SIMULATION PASS on Windows11 Pro21H2 x64 build22000. User-pasted summary confirms distinct managed artifacts, same key identity/envelope bytes and preserved OLD files, with no key recreation; Guardian/App/actual-child controls and owned-key cleanup PASS. Services independently Stopped/Manual on bin-new. CHG0070/EV0139 records the user's separate elevated read-only hash capture: original summary SHA2567b95d1e086b91de870445b7ed1e84c4f40fe83a6faa9c5e8fe20cf51de221517, checkpoint matches and all eleven evidence files match. This is operator verification, not independent Security review; V4/V5 hash gaps remain. V6 is consumed: never rerun Prepare/Upgrade. CHG0072/EV0141 now prepares V7 kit0.14.0: pure17/17 and actual report/package/hash/DACL/SID/checkpoint plus inert lifecycle/failure guards PASS. CHG0073/EV0142 records operator-run V7 Prepare/Uninstall/Reinstall transcript PASS: six Guardian controls, App/actual-child contrast, artifact0.14.0 and owned-key cleanup PASS. Exactly three test registrations removed/recreated; services independently Stopped/Manual, PID0. CHG0074/EV0143 reviews the supplied final summary and records operator read-only hashes: both checkpoints and all11 evidence files match; original summary SHA256cc8d7464fedb6b20b9adeae2d0e34f1aff483b3f481b975a74a1632ef9ffb586. Same key/envelope/protected bytes/SIDs/DACL continuity and no recreation are reported true/false as intended; this is operator evidence, not independent Security acceptance. V7 consumed: never rerun. UI/Attendance/Backup current status notes are synchronized against accepted evidence; broader hardening remains open. Next: review unresolved native-entry dependencies before Guardian/Store implementation. See [reinstall plan](../licensing/plans/LICENSING_WRAPPING_REINSTALL_PLAN.md). No new physical run is authorized by these results. See [Upgrade plan and kit](../licensing/plans/LICENSING_WRAPPING_UPGRADE_PLAN.md). Actual installer Repair/Upgrade, interrupted operation, TPM, separate standard account and Windows matrix remain open. This is not actual product Installer Repair; productionRepairTested/productionUpgradeTested/security/production/matrix remain false. Do not rerun consumed V1-V6. See [wrapping design](../licensing/design/LICENSING_SOFTWARE_KSP_WRAPPING_DESIGN.md).

Current UI follow-up: 2026-09-27: `UI-1.7` now includes Full-style Employee Details/Edit plus complete Full custom-select parity across every active ATTENDANCE page, form and modal. Add/Edit retain the permission-gated K40 enrollment flow and strict save-before-enroll boundary. Employees, Daily Attendance, Entry Logs/Manual Entry, Devices/Employee Tools, Access Users, Audit Logs, Attendance Report and Backups now use the shared custom dropdown; the active Attendance route graph contains no native `<select>`. The shared menu portals above clipped cards/modals while preserving RTL/LTR, searchable options, disabled state and accessible labels. Dashboard `Scheduled today` copy is clarified as `Expected today` / `مورد انتظار امروز` / `د نن ورځې تمه کېدونکي`, without changing the metric. The shared Sidebar collapse control now stays on the base UI layer (`z-30`) below every modal layer; direct hit-testing confirms the Dashboard overlay covers it. Affected custom-select visual coverage passed 44/44; dashboard visual coverage passed 8/8; custom-select Staff behavior passed 19/19; typecheck passed and lint retains four pre-existing warnings with zero errors. Canonical ATTENDANCE build/verify passed on exact Node `24.19.0` with manifest `b851aa896649ca09fd9f8fa156ee56e4c93ac0dce5574e687390a00ffba09c80`. No API/Server/Database/Prisma/Licensing/Guardian/Installer or Device backend logic changed. No physical K40 was executed, so pilot creation/edit enrollment remains open. See [UI unification plan](../ui/EDITION_UI_UNIFICATION_PLAN.md) and [primitive inventory](../ui/EDITION_UI_PRIMITIVE_INVENTORY.md).

Current UI polish: 2026-09-27: table headings across ATTENDANCE are now edition-scoped to a compact `10px`/`680` treatment with tighter tracking and vertical spacing. Row content and FULL table typography are unchanged. The complete Attendance real-app matrix passed twice (`79/79` snapshot refresh and `79/79` no-update stability run); canonical build/verify passed on exact Node `24.19.0` for ATTENDANCE (manifest `c62534d9c3035bfb465bfca3bc5d26b62a26613dfd52708d9f16bc27511e4304`) and FULL (manifest `5b7ae57f6a237b89ed6dd12a1a5d9d6980c8cb9c9adb5050974a977f6b0d4c4c`).

Current Employees table polish: 2026-09-27: the ATTENDANCE Employees row content is now compact at `12px`, including Contact, Staff group and Role, while employee names retain their existing hierarchy. Status badges now expose their semantic state so Light theme contrast rules apply to Active/Blocked, with an explicit Archived rule. Focused Employees visual/interaction passed `14/14`, including a new populated Light baseline and computed font/color assertions; canonical ATTENDANCE build/verify passed on exact Node `24.19.0` with manifest `b2e1c59c8f0af84758985083ec227abd39625a3e26e81a39501c6cc8a8f32192`.

Current Attendance header polish: 2026-09-27: the redundant route breadcrumb/title block is no longer rendered in the shared header for ATTENDANCE, across Desktop/Mobile and LTR/RTL; header actions remain aligned and the FULL breadcrumb/title contract is preserved. The refreshed Attendance matrix passed `80/80`; the final isolated Shell/Settings rerun passed `13/13`, and the FULL navigation contract passed `4/4` on a separate fresh server. Canonical build/verify passed on exact Node `24.19.0` for ATTENDANCE (manifest `9667352706c832b99004da41393068b763ce619b226682fc1a808927cb5c8ec3`) and FULL (manifest `3b2dc8f62cf2f0e1c043ce2be8b8211f194f6dce62e78d7800908a2069c242a7`).

Current protocol corpus correction: `LIC-CHG-0011` / `LIC-EV-0013` closes the descriptor-only erratum at protocol manifest `512534732dce759da424ba0e8d8838c3d9c294e3faa02a4017212ce482523eab`. All 224 descriptors remain (744 type expansions); wire/CDDL and acceptance policy are unchanged. LIC-6.2-004 pure state model is complete under LIC-EV-0016 after independent review and Reactivation collision remediation: 59/59 projection, 31/31 model, 27/27 security tests (18 owned STATE descriptors), plus Core/Protocol/Golden regression. LIC-6.2-005 portable trusted-time remediation is complete under LIC-EV-0026 after Product approvals LIC-CHG-0016/0017 and independent time_design_review remediation/rerun: Time 39/39, lifecycle 36/36, availability/repair 16/16, State 117/117 and Core/Protocol/Golden pass. Observed calendar is separate from the corroborated floor; future grants require corroboration, normal reboot/downtime alone does not lock, and signed repair preserves independent locks. LIC005 closure is committed as e49630a. LIC006 Offline workflows remain in progress: bounded import planning is committed as 7435dc8 (38/38). ACTIVATE/RENEW request work is committed as 67f9867 (LIC-EV-0030, 44/44). Entitlement completion/CAS acknowledgement passes36/36 under LIC-EV-0033 (import38/request44 and Core/State/Time/Protocol/Golden pass), with the fixed duplicate-request correlation failure retained in EV0032. Entitlement/Control checkpoint is committed as6c9fb09. RECOVER request/completion is committed as97a6d02 (LIC-EV-0038,36/36). REBIND is committed as91b4771 (LIC-EV-0041,40/40). TIME_CORRECT is committed as9703e13 (LIC-EV-0043,32/32). REACTIVATE request/two-artifact completion passes28/28 under LIC-EV-0045 (committed as c975958), with prior portable/crypto gates passing; real protected persistence, safe filesystem intake/export, durable reconciliation and independent closure review remain open; EV0047 records the remaining-obligations source audit and ten planned (not executed) safe-file/durable-adapter acceptance cases; portable selected-file orchestration passes16/16 fake-adapter cases under LIC-EV-0049 (committed as c975958), with prior portable/crypto gates passing; one-pass file-to-completion integration passes the expanded32-case file suite under LIC-EV-0051 (committed as c975958), with prior portable/crypto regressions passing; LIC-EV-0054 adds96/96 six-intent file completion cases (committed as c97eb29) with all prior portable/crypto regressions passing; LIC-EV-0055 completes independent review of c97eb29 with no reproducible blocking finding,8/8 additional probes and aggregate rerun passing; see LICENSING_OFFLINE_REVIEW.md; LIC007 request/registration is committed10d09f7 and primary-Lease response is committed14ddebf; control-only dispatch is committedbc7aecb. Atomic Lease+Control composition is committed e88d0ca and limited independent review is complete under LIC-EV-0074 (28/28 independent probes and aggregate pass); review committedec2fbf3. Subsequent trust-only CHECK_IN preparation/CAS passes44/44 cases and aggregate/Golden regressions (EV0077); trust-only checkpoint committed6f7b411. Subsequent coordinated trust plus Lease/optional Control handoff passes44/44 cases and aggregate/Golden regressions (EV0080); independent review of committed53a7d74 passes28/28 (26 acceptance checks plus2 clock diagnostics), with no blocking portable finding. Failed clock/trust evaluation must block future runtime admission; Hybrid Reactivation request targeting and three-artifact completion now pass48/48 both-Edition cases and all aggregate/Golden regressions under EV0087. The new Entitlement stays a separate signed input because the frozen response carrier has no Entitlement slot. Mixed trust/Control variants and TIME_RECOVERY stay closed; targeted review of the new core helper and transport/runtime/protected Store integration remain open. Failed clock/trust evaluation still must block future runtime admission. LIC008 Windows feasibility remains in progress: EV0126/0130/0132/0135 record Software-KSP host controls, filtered-admin interactive contrast, normal reboot and binary Repair simulation. CHG0067/EV0136 selects the bounded Upgrade plan, implementation/build/run NOT_RUN. Real file/protected Store, TPM, separate standard account and full Windows acceptance remain outstanding under existing dependencies. Persistent storage, runtime admission, Guardian and Windows release evidence remain open.

LIC004 closure: LIC-6.2-004 pure state model is complete under LIC-EV-0016 after independent review and Reactivation collision remediation: 59/59 projection, 31/31 model, 27/27 security tests (18 owned STATE descriptors), plus Core/Protocol/Golden regression. LIC-6.2-005 portable trusted-time remediation is complete under LIC-EV-0026 after Product approvals LIC-CHG-0016/0017 and independent time_design_review remediation/rerun: Time 39/39, lifecycle 36/36, availability/repair 16/16, State 117/117 and Core/Protocol/Golden pass. Observed calendar is separate from the corroborated floor; future grants require corroboration, normal reboot/downtime alone does not lock, and signed repair preserves independent locks. LIC005 closure is committed as e49630a. LIC006 Offline workflows remain in progress: bounded import planning is committed as 7435dc8 (38/38). ACTIVATE/RENEW request work is committed as 67f9867 (LIC-EV-0030, 44/44). Entitlement completion/CAS acknowledgement passes36/36 under LIC-EV-0033 (import38/request44 and Core/State/Time/Protocol/Golden pass), with the fixed duplicate-request correlation failure retained in EV0032. Entitlement/Control checkpoint is committed as6c9fb09. RECOVER request/completion is committed as97a6d02 (LIC-EV-0038,36/36). REBIND is committed as91b4771 (LIC-EV-0041,40/40). TIME_CORRECT is committed as9703e13 (LIC-EV-0043,32/32). REACTIVATE request/two-artifact completion passes28/28 under LIC-EV-0045 (committed as c975958), with prior portable/crypto gates passing; real protected persistence, safe filesystem intake/export, durable reconciliation and independent closure review remain open; EV0047 records the remaining-obligations source audit and ten planned (not executed) safe-file/durable-adapter acceptance cases; portable selected-file orchestration passes16/16 fake-adapter cases under LIC-EV-0049 (committed as c975958), with prior portable/crypto gates passing; one-pass file-to-completion integration passes the expanded32-case file suite under LIC-EV-0051 (committed as c975958), with prior portable/crypto regressions passing; LIC-EV-0054 adds96/96 six-intent file completion cases (committed as c97eb29) with all prior portable/crypto regressions passing; LIC-EV-0055 completes independent review of c97eb29 with no reproducible blocking finding,8/8 additional probes and aggregate rerun passing; see LICENSING_OFFLINE_REVIEW.md; LIC007 request/registration is committed10d09f7 and primary-Lease response is committed14ddebf; control-only dispatch is committedbc7aecb. Atomic Lease+Control composition is committed e88d0ca and limited independent review is complete under LIC-EV-0074 (28/28 independent probes and aggregate pass); review committedec2fbf3. Subsequent trust-only CHECK_IN preparation/CAS passes44/44 cases and aggregate/Golden regressions (EV0077); trust-only checkpoint committed6f7b411. Subsequent coordinated trust plus Lease/optional Control handoff passes44/44 cases and aggregate/Golden regressions (EV0080); independent review of committed53a7d74 passes28/28 (26 acceptance checks plus2 clock diagnostics), with no blocking portable finding. Failed clock/trust evaluation must block future runtime admission; Hybrid Reactivation request targeting and three-artifact completion now pass48/48 both-Edition cases and all aggregate/Golden regressions under EV0087. The new Entitlement stays a separate signed input because the frozen response carrier has no Entitlement slot. Mixed trust/Control variants and TIME_RECOVERY stay closed; targeted review of the new core helper and transport/runtime/protected Store integration remain open. Failed clock/trust evaluation still must block future runtime admission. LIC008 Windows feasibility remains in progress: EV0126/0130/0132/0135 record Software-KSP host controls, filtered-admin interactive contrast, normal reboot and binary Repair simulation. CHG0067/EV0136 selects the bounded Upgrade plan, implementation/build/run NOT_RUN. Real file/protected Store, TPM, separate standard account and full Windows acceptance remain outstanding under existing dependencies. Persistent storage, runtime admission, Guardian and Windows release evidence remain open.

آخرین بازبینی: 2026-09-26

وضعیت سند: مرجع رسمی و زندهٔ اجرای `FULL` / `ATTENDANCE`

مرحلهٔ جاری: `LIC-6.2-006` باز است. تست‌های قبلی در `c97eb29` کامیت شدند. بررسی مستقل همین نسخه انجام شد (`LIC-EV-0055`): ایراد مسدودکنندهٔ قابل‌بازتولید پیدا نشد، ۸ آزمایش مستقل و اجرای کامل تست‌ها موفق بودند. تکرار همین بررسی لازم نیست مگر کد تغییر مهمی کند. کارهای واقعی فایل ویندوز و ذخیره‌سازی محافظت‌شده طبق وابستگی‌های مستند باقی مانده‌اند. گزارش بررسی جدید هنوز کامیت نشده است.

این سند مسیر رسمی تبدیل پروژهٔ فعلی به دو محصول از یک کدبیس است. از این پس هیچ کار مربوط به Attendance Edition نباید فقط بر اساس حافظه، گفت‌وگو یا تشخیص لحظه‌ای انجام شود؛ مرحله، تست، مدرک و نتیجه باید در همین فایل ثبت گردد.

اسناد مرتبط:

- [چک‌لیست اصلی پروژه](PROJECT_CHECKLIST.md) برای وضعیت کلی تمام محصول
- [راهنمای K40](../operations/k40-setup.md) برای شواهد و Regression دستگاه واقعی
- [طرح بکاپ و بازیابی](../operations/backup-restore.md) برای سیاست عملیاتی فعلی
- [طرح امنیت](../architecture/security-design.md) برای مدل نقش‌ها، Permission و Audit
- [مرجع واحد، طرح امنیت و چک‌لیست اجرایی Licensing](../licensing/design/LICENSING_DESIGN.md) برای تمام تصمیم‌ها، پروتکل Offline/Hybrid، اتصال دستگاه، Tamper، قفل، Recovery، ترتیب اجرا و Evidence
- [طرح یکسان‌سازی رابط کاربری دو Edition](../ui/EDITION_UI_UNIFICATION_PLAN.md) برای Shared Visual System، مرزهای ممنوع، ترتیب Commit و Gateهای Visual/Build isolation

اگر یک سند قدیمی دربارهٔ Scope نسخهٔ حاضری با این فایل تضاد داشت، این چک‌لیست برای جداسازی `FULL` / `ATTENDANCE` مرجع نهایی است. تست‌های قبلی همچنان Evidence نسخهٔ کامل هستند، اما به‌تنهایی Gateهای جداسازی Edition را کامل نمی‌کنند.

## راهنمای وضعیت‌ها

| علامت | معنی |
| --- | --- |
| `[x]` | انجام و با مدرک مناسب تأیید شده است |
| `[~]` | بخشی موجود است، اما برای Attendance Edition هنوز تغییر یا تست لازم دارد |
| `[ ]` | هنوز اجرا نشده است |
| `[!]` | ریسک شناخته‌شده یا تصمیمی که باید پیش از Gate تعیین‌شده برای خودش حل شود |
| `[OPTIONAL]` | برای نسخهٔ اول الزامی نیست و فقط پس از عبور از Release Gate اصلی انجام می‌شود |
| `[OUT]` | آگاهانه خارج از Attendance Edition است؛ کد آن برای FULL حفظ می‌شود |
| `[BLOCKED]` | بدون پیش‌نیاز یا اختیار جدید نباید شروع شود |

## قوانین نگهداری این سند

- هر تغییر مربوط به Edition باید ردیف همین سند را در همان آیتم شماره‌دار Phase و Evidence Log به‌روز کند.
- `[x]` فقط وقتی مجاز است که Command، تست خودکار، تست دستی یا فایل شاهد ثبت شده باشد.
- «پیاده‌سازی شده» و «تست شده» همیشه جدا ثبت شوند.
- پس از هر تغییر Edition، رفتار `FULL` باید Regression شود.
- هیچ کد، جدول، Migration یا قابلیت نسخهٔ کامل برای ساخت Attendance Edition حذف نمی‌شود.
- هیچ Fork دائمی از Repository یا Prisma schema جدا ساخته نمی‌شود.
- UI مخفی‌شده به‌تنهایی امنیت یا جداسازی محصول محسوب نمی‌شود؛ بک‌اند باید مرجع نهایی باشد.
- در Phase 1، هر آیتم `1.x` یک واحد مستقل کار/Commit با Gate خودش است. در Phaseهای 2 تا 7، شماره‌ها work packageهای traceable هستند؛ هر Commit فقط یک مورد یا چند مورد فنیِ جدانشدنی را پوشش می‌دهد و Gate کل Phase فقط هنگام تکمیل Phase اجرا می‌شود.
- Commitها کوچک و Stageمحور باشند؛ تغییرهای Attendance و اصلاحات نامرتبط در یک Commit مخلوط نشوند.
- Checkbox خلاصهٔ هر Phase فقط وقتی `[x]` می‌شود که Implementation و Verification مربوط به آن جداگانه کامل و Evidence ثبت شده باشد.
- بخش‌های 2 تا 18 کاتالوگ Scope و معیار پذیرش‌اند؛ بخش 19 ترتیب اجرا را تعیین می‌کند و هر آیتم آن باید به معیارهای مرتبط ارجاع دهد.
- اگر تستی اجرا نشد، نتیجه دقیقاً `Not run` نوشته شود.
- پشتیبانی از دستگاه جدید بدون دستگاه واقعی، لاگ واقعی یا دسترسی تستی شروع نمی‌شود.

## 1. قرارداد قفل‌شدهٔ محصول

این تصمیم‌ها مبنای تمام مراحل بعدی هستند و تغییرشان Scope Change محسوب می‌شود.

| تصمیم | وضعیت | قرارداد |
| --- | --- | --- |
| یک کدبیس مشترک | `[x]` | `FULL` و `ATTENDANCE` از همین Repository ساخته می‌شوند |
| رفتار پیش‌فرض | `[x]` | اگر Edition تعیین نشده باشد، رفتار سازگار فعلی `FULL` حفظ می‌شود |
| Edition حاضری | `[x]` | `APP_EDITION=ATTENDANCE` فقط قابلیت‌های کارمند و حاضری را فعال می‌کند |
| محل نگهداری Edition | `[x]` | خارج از دیتابیس؛ Restore بکاپ نباید Edition نصب‌شده را تغییر دهد |
| Prisma و Migration | `[x]` | یک schema و یک migration chain؛ جدول‌های غیرفعال حذف نمی‌شوند |
| مدل ثبت تردد | `[x]` | `ATTENDANCE_POLICY=TIME_CLOCK` برای کارمند شناخته‌شده؛ validation/default آن در Phase 2.4 اعمال شده است |
| ثبت در برابر دروازه | `[x]` | ثبت Punch از تصمیم بازشدن در جدا است |
| Door control | `[x]` | در Attendance v1 پیش‌فرض خاموش؛ قابلیت اختیاری جداگانه |
| Auto-checkout | `[x]` | `ATTENDANCE_AUTO_CHECKOUT_ENABLED` پیش‌فرض `0` است؛ مقدار `1` در Attendance v1 نیز تا Scope Change صریح non-operational می‌ماند و هیچ `OUT` مصنوعی ساخته نمی‌شود |
| دستگاه نسخهٔ اول | `[x]` | فقط مسیر تست‌شدهٔ K40 Pull |
| `/iclock` / ADMS | `[OUT]` | تا زمان پیاده‌سازی، احراز هویت و تست واقعی جزو محصول نیست |
| Generic device push | `[OUT]` | تا زمان احراز هویت دستگاه/HMAC/IP policy در Production غیرفعال |
| دامنهٔ استقرار v1 | `[x]` | یک سایت و K40 تست‌شده؛ ادعای Multi-device پس از رفع محدودیت شناسه‌ها |
| Payroll | `[OUT]` | حتی با وجود ارتباط با کارمند، در Attendance v1 نمایش یا Mount نمی‌شود |
| Customer/Membership/Finance | `[OUT]` | فقط در FULL؛ Route و API آن‌ها در Attendance در دسترس نیست |
| Compliance score | `[OPTIONAL]` | مرحلهٔ دوم، پس از اصلاح محاسبهٔ گروه و سیاست وزن‌ها |
| Inbox | `[IN — O.2 selected]` | صف عملیاتی مشترک؛ فقط رویدادهای Staff/Attendance و دستگاه. Scope Change در 2026-10-03 تصویب شد، اما Feature تا پاس‌شدن تمام Gateهای O.2 همچنان خاموش و code-not-ready می‌ماند |
| Sounds | `[OPTIONAL]` | پیش‌فرض خاموش و فقط هنگام بازبودن مرورگر قابل اتکا است |
| مرخصی رسمی | `[OUT]` | v1 فقط توجیه غیبت روزانه دارد؛ سیستم Approval مرخصی ادعا نمی‌شود |
| تعطیلات و مرخصی بازه‌ای | `[!]` | خارج از Scope پایه؛ Decision Gate آن پیش از Phase 7/Pilot است و تا آن زمان ادعای این قابلیت نمی‌شود |
| Licensing | `[IN]` | Scope محدودمدت Offline/Hybrid برای هر دو Edition تصویب شد؛ مدل DB موجود منبع حقیقت نیست، Core در 6.2 آغاز و Gate نهایی Host/ACL/Clean Windows در 6.6 بسته می‌شود |

### 1.1 سرمایه‌های موجود که نباید دوباره ساخته شوند

| بخش موجود | وضعیت فعلی | قاعدهٔ ادامه |
| --- | --- | --- |
| Daily Attendance و Justification | `[x]` | UI مستقل Staff-only، فیلترها، summary/warning، Justification و مرز Staff/Edition تست شده‌اند؛ خروجی مستقل این صفحه هنوز جزو کارهای بعدی Phase 4 است |
| Entry Logs و Manual Attendance | `[x]` | List، فیلترهای server-side، Device option امن و Manual IN/OUT مستقل Staff-only تست شده‌اند؛ CSV/XLSX کامل سمت Server تمام فیلترها را حفظ و pagination صفحه را حذف می‌کند |
| Attendance Report | `[x]` | محاسبات و tableهای موجود Summary/Daily/Employees/Evidence حفظ و در API/UI مستقل Attendance با Staff scope اجباری و copy سه‌زبانه استفاده شدند؛ CSV/XLSX/PDF با `ATTENDANCE_EXPORT` مستقل فعال‌اند و Exportهای FULL دست‌نخورده باقی مانده‌اند |
| Attendance Compliance | `[~]` | Logic و CSV/XLSX موجود است؛ برای v1 بازسازی نشود و تا نسخهٔ اختیاری پس از v1 مخفی بماند |
| K40 Pull و Event processing | `[x]` | مرز Edition، Pull تک‌دستگاه، Raw-first strict-both، جداسازی Core، `TIME_CLOCK`، PostgreSQL integration و K40 واقعی تا تطبیق RawLog→Daily/Entry Logs/Report در Phase 2.7 پاس شدند؛ UI و Capability activation نیز در Phase 3.5 تکمیل شد |
| Employee/Member core | `[~]` | Facade/Projection مستقل Staff-only، archive بدون Delete فیزیکی، Audit امن، DeviceUser persistence و Attendance/Report/Device isolation بک‌اند آماده است؛ UI در Phase 3 و marker repair در Gate نهایی Phase 2 باقی مانده‌اند |
| Auth/Admin users/Permissions | `[~]` | Session، Setup، Role و User management موجودند؛ Capability و Role bundle حاضری افزوده شود |
| Audit Log viewer | `[x]` | Viewer مشترک با Permission، filter و detail حفظ شد؛ policy واحد Action/Target/Staff evidence روی list/summary/options/detail دادهٔ تاریخی FULL اعمال و redaction حساس/مالی تقویت شد |
| Backup/Restore | `[~]` | Backup UI، schedule، verify، import و recovery موجود و دارای پوشش گسترده‌اند؛ Edition isolation/installer QA اضافه شود |
| Dashboard | `[x]` | API/UI مستقل Attendance فقط KPI حاضری کارمندان، هشدار، Punch، Device health و روند هفت‌روزه را می‌دهد؛ legacy FULL جدا و محفوظ است |
| Inbox scheduler | `[!]` | Device و Staff alert مفید است، اما Membership و Auto-checkout legacy در همان Job bundle قرار دارند؛ Guard مستقل Phase 2.5 ساخت `OUT` در Attendance را متوقف می‌کند، ولی تفکیک کامل bundle همچنان Work package اختیاری `O.2` است |

قاعدهٔ تست: تست‌های موجود فقط وقتی دوباره اجرا می‌شوند که کد مرتبط تغییر کند یا Gate جدید به آن‌ها نیاز داشته باشد. به‌جای تکرار بی‌هدف، Assertionهای Edition-specific به Suite مناسب اضافه می‌شوند.

## 2. تعریف قابلیت‌های Edition

### 2.1 قابلیت‌های اجباری Attendance

- [x] `AUTH`
- [x] `ATTENDANCE_DASHBOARD`
- [ ] `EMPLOYEES`
- [ ] `ATTENDANCE_DAILY`
- [ ] `ENTRY_LOGS`
- [ ] `DEVICES`
- [x] `ATTENDANCE_REPORTS`
- [x] `ATTENDANCE_EXPORT`
- [ ] `STAFF_GROUPS`
- [x] `ADMIN_USERS`
- [ ] `AUDIT_LOGS`
- [x] `BACKUPS`

### 2.2 قابلیت‌های اختیاری و پیش‌فرض خاموش

- [OPTIONAL] `ATTENDANCE_COMPLIANCE`
- [OPTIONAL] `INBOX`
- [OPTIONAL] `SOUNDS`
- [OPTIONAL] `DEVICE_DIAGNOSTICS`
- [OPTIONAL] `DOOR_CONTROL`

### 2.3 قابلیت‌های صریحاً غیرفعال در Attendance

- [ ] `CUSTOMERS=false`
- [ ] `MEMBERSHIPS=false`
- [ ] `CUSTOMER_PAYMENTS=false`
- [ ] `PAYROLL=false`
- [ ] `EXPENSES=false`
- [ ] `FINANCIAL_REPORTS=false`
- [ ] `ICLOCK_ADMS=false`
- [ ] `GENERIC_DEVICE_PUSH=false` تا زمان Hardening

### 2.4 ماتریس هدف و Gate فعال‌سازی

این جدول قرارداد اجرایی هدف محصول است و در 2026-08-04 پیش از Phase 1.2 صریحاً توسط User تأیید شد. ستون `ATTENDANCE` به‌تنهایی مجوز فعال‌سازی فوری نیست: تا وقتی Gate همان ردیف پاس نشده، Capability نباید در `features` مؤثر ظاهر شود و Consumer آن نباید Mount/Start شود.

| Capability | `FULL` | `ATTENDANCE` هدف v1 | Gate فعال‌سازی Attendance |
| --- | --- | --- | --- |
| `AUTH` | روشن | روشن | Phase 1؛ Setup/Login/Logout/Me و قرارداد Auth |
| `EMPLOYEES` | روشن | روشن | Phase 2 Backend isolation، سپس Phase 3 UI |
| `STAFF_GROUPS` | روشن | روشن | Phase 2 Staff/Shift boundary، سپس Phase 3 UI |
| `ATTENDANCE_DAILY` | روشن | روشن | Phase 2 Staff-only semantics، سپس Phase 3 UI |
| `ENTRY_LOGS` | روشن | روشن | Phase 2 Staff-only، سپس Phase 3؛ Export کامل در Phase 4 |
| `DEVICES` | روشن | روشن | Phase 2 Staff-only ingestion، سپس Phase 3 UI و K40 regression |
| `ATTENDANCE_DASHBOARD` | روشن | روشن | Phase 4 Staff-only query/DTO/UI |
| `ATTENDANCE_REPORTS` | روشن | روشن | Phase 4 Staff-only query/DTO/UI |
| `ATTENDANCE_EXPORT` | code-ready؛ رفتار export فعلی FULL همچنان با parent route و `FINANCIAL_EXPORT` موجود حفظ می‌شود | روشن و مستقل از Permission مالی | Phase 4 Permission/migration/export/Audit tests |
| `ADMIN_USERS` | روشن | روشن | Phase 3 Role bundle و selector امن |
| `AUDIT_LOGS` | روشن | روشن | Phase 5 historical edition filtering |
| `BACKUPS` | روشن | روشن | Phase 5 restore/data isolation و Backup security gate |
| `ATTENDANCE_COMPLIANCE` | روشن با رفتار فعلی FULL | پیش‌فرض خاموش/اختیاری پس از v1 | Group score، Staff isolation و policy approval |
| `INBOX` | روشن با رفتار فعلی FULL | انتخاب‌شده برای v1؛ تا پایان O.2 پیش‌فرض خاموش و code-not-ready | Job split، Auth WebSocket، Staff/historical isolation و Gate کامل O.2 |
| `SOUNDS` | روشن با رفتار فعلی FULL | پیش‌فرض خاموش/اختیاری پس از v1 | Browser/installer QA و Staff-only events |
| `DEVICE_DIAGNOSTICS` | روشن با رفتار فعلی FULL | پیش‌فرض خاموش/اختیاری پس از v1 | Technician/Vendor roles و redaction |
| `DOOR_CONTROL` | روشن با رفتار فعلی FULL | پیش‌فرض خاموش/اختیاری پس از v1 | Permission مستقل، policy مشتری و real-device safety QA |
| `CUSTOMERS` | روشن | خاموش | در Attendance Mount/Start/Request نشود |
| `MEMBERSHIPS` | روشن | خاموش | در Attendance Mount/Start/Request نشود |
| `CUSTOMER_PAYMENTS` | روشن | خاموش | در Attendance Mount/Start/Request نشود |
| `PAYROLL` | روشن | خاموش | در Attendance Mount/Start/Request نشود |
| `EXPENSES` | روشن | خاموش | در Attendance Mount/Start/Request نشود |
| `FINANCIAL_REPORTS` | روشن | خاموش | در Attendance Mount/Start/Request نشود |
| `ICLOCK_ADMS` | رفتار legacy فعلی FULL حفظ شود؛ Production-ready ادعا نشود | خاموش | Scope Change و Gate مستقل دستگاه/امنیت |
| `GENERIC_DEVICE_PUSH` | رفتار test/legacy فعلی FULL تا Hardening حفظ شود | خاموش | Scope Change و credential/HMAC/IP-policy QA |

تفسیر قطعی Registry در Gate 1.2:

- `FULL target=25` و `FULL effective/code-ready=25` است؛ `ATTENDANCE_EXPORT` از Phase 4.3 typed/code-ready است، اما export فعلی FULL بدون تغییر از parent route و `FINANCIAL_REPORTS`/`FINANCIAL_EXPORT` موجود استفاده می‌کند.
- `ATTENDANCE target=17` است: 12 قابلیت پایه و 5 قابلیت با activation مستقل. از 2026-10-03 فقط `O.2 INBOX` به Scope تحویلی v1 وارد شده است؛ چهار Optional دیگر خارج مسیر اجباری‌اند. Inbox نیز تا تکمیل O.2، code-ready و Flag متناظر مؤثر نمی‌شود.
- `ATTENDANCE effective/code-ready=[]` در پایان 1.2 است؛ حتی Flag اختیاری true نیز Gate آمادگی خالی را دور نمی‌زند.
- حضور `ICLOCK_ADMS` و `GENERIC_DEVICE_PUSH` در FULL effective فقط حفظ سازگاری legacy فعلی است و ادعای Production-ready بودن نیست.
- شناسهٔ `activationGate` مالک انتقال را مشخص می‌کند؛ Acceptance جزئی هر قابلیت همچنان در همین جدول و Phase مالک لازم است. تمام خروجی‌ها با ترتیب code-point، بدون تکرار و runtime-frozen هستند.
- وضعیت جاری پس از Gate 3.4 برابر `ATTENDANCE effective/code-ready=[ATTENDANCE_DAILY,AUTH,EMPLOYEES,ENTRY_LOGS]` است؛ سایر Capabilityهای هدف تا Gate مالک UI/API خود خاموش‌اند.

`/api` identity و `/api/v1/health` Capability تجاری نیستند و همیشه قابل دسترسی‌اند. Restore-maintenance middleware نیز مستقل از Edition و پیش از تمام Routeهای business روشن باقی می‌ماند؛ Route خاموش و مسیر ناشناختهٔ خارج از namespace روشن پیش از parser/Auth/maintenance رد می‌شود و query جانبی ایجاد نمی‌کند.

#### 2.4.1 انتقال قطعی `code-ready`

در پایان Phase 1.2، `ATTENDANCE` عمداً `features=[]` دارد؛ Registry فقط قرارداد هدف را معرفی می‌کند و هنوز هیچ Consumer را آماده اعلام نمی‌کند. تنها آیتم‌های زیر حق افزودن Feature به allowlist آمادگی کد را دارند:

| Feature | Work item مالک انتقال به code-ready |
| --- | --- |
| `AUTH` | پایان 1.4 پس از Permission intersection و قرارداد `/api` و Setup/Login/Me |
| `EMPLOYEES`, `STAFF_GROUPS`, `ATTENDANCE_DAILY`, `ENTRY_LOGS`, `DEVICES` | پایان Gate Phase 2؛ UI آن‌ها جداگانه در Phase 3 آماده می‌شود |
| `ADMIN_USERS` | پایان 3.6 پس از Role bundle/selector tests |
| `ATTENDANCE_DASHBOARD`, `ATTENDANCE_REPORTS`, `ATTENDANCE_EXPORT` | پایان Gate Phase 4 |
| `AUDIT_LOGS`, `BACKUPS` | پایان Gate Phase 5 |
| `ATTENDANCE_COMPLIANCE` | فقط Work package اختیاری `O.1` |
| `INBOX` | فقط Work package اختیاری `O.2` |
| `SOUNDS` | فقط Work package اختیاری `O.3` |
| `DEVICE_DIAGNOSTICS` | فقط Work package اختیاری `O.4` |
| `DOOR_CONTROL` | فقط Work package اختیاری `O.5` |

هر انتقال code-ready باید در همان Commit همراه تست Feature list، Route/Job side effect و FULL regression انجام شود. هیچ Phase دیگری حق تغییر این allowlist را ندارد.

### 2.5 منبع و تقدم محاسبهٔ Capability مؤثر

- Registry مرکزی بک‌اند تنها منبع حقیقت برای نام Capability، Edition هدف، Gate و وضعیت آمادگی کد است.
- در `FULL`، رفتار و Route/Jobهای موجود پیش‌فرض حفظ می‌شوند؛ معرفی Registry نباید به‌تنهایی چیزی را خاموش کند.
- در `ATTENDANCE`، Feature مؤثر برابر است با تقاطع `Edition target allowlist`، `code-ready allowlist` و برای Feature اختیاری `external feature flag`.
- Feature اجباری تا پیش از پاس‌شدن Gate خودش Fail-closed می‌ماند؛ در `features` برگردانده نمی‌شود و Route/Job/UI آن فعال نمی‌شود.
- Feature اختیاری فقط با مقدار case-sensitive `0|1` در یکی از متغیرهای صریح `APP_FEATURE_ATTENDANCE_COMPLIANCE`, `APP_FEATURE_INBOX`, `APP_FEATURE_SOUNDS`, `APP_FEATURE_DEVICE_DIAGNOSTICS` یا `APP_FEATURE_DOOR_CONTROL` فعال می‌شود؛ default همه در Attendance برابر `0` است.
- هر Flag فقط در Work package اختیاری `O.1` تا `O.5` صاحب همان Feature به env schema افزوده می‌شود؛ قبل از آن حتی مقدار `1` نباید Feature را فعال کند. این Flagها در v1 رفتار موجود `FULL` را خاموش نمی‌کنند.
- `APP_EDITION`، Flagهای Feature و policyهای نصب خارج از دیتابیس هستند و Import/Restore حق تغییر آن‌ها را ندارد.
- هیچ Permission، Role row یا per-user `ALLOW` نمی‌تواند Capability خاموش یا code-not-ready را فعال کند.
- خروجی `features` مرتب، بدون تکرار و فقط شامل Featureهای مؤثر همان Process است؛ Featureهای هدفِ هنوز آماده در پاسخ اعلام نمی‌شوند.

### 2.6 قرارداد مصوب Route و Direct URL غیرفعال — تأییدشده برای 1.5

- Backend برای Route مربوط به Capability خاموش آن Router را ثبت نمی‌کند و همان پاسخ عمومی `404 Not Found` مربوط به مسیر ناشناخته را می‌دهد.
- پاسخ `403` یا متن `Feature disabled` برای Route خاموش مجاز نیست، چون نام Feature پنهان را افشا می‌کند؛ `403` فقط برای Route روشن با Permission ناکافی است.
- Mountهای خارج از `registerRoutes`، شامل raw parser و `/iclock` در `app.ts`، نیز تابع همین قرارداد هستند.
- Frontend برای Route شناخته‌شده اما خاموش، صفحهٔ عمومی Not Found را بدون نام Feature نمایش می‌دهد.
- `/` و `/settings` به اولین Route روشن و مجاز Redirect می‌شوند؛ wildcard ناشناخته Not Found است و کورکورانه به Dashboard نمی‌رود.
- Redirectهای legacy `/members*` فقط پس از اثبات Staff بودن شناسه به `/employees*` می‌روند؛ Customer ID باید Not Found بگیرد.

### 2.7 قرارداد مصوب Auth و هویت عمومی — تأییدشده برای 1.4

- `GET /api` حداقل `{ name, version, edition }` را برای bootstrap عمومی و تشخیص mismatch برمی‌گرداند؛ هیچ Capability یا اطلاعات حساس در آن لازم نیست.
- Client پیش از Setup/Me هویت عمومی را دریافت می‌کند و تمام هویت canonical شامل schema/product/version/API/License-protocol/manifest-version/hash و Edition را با برابری دقیق می‌سنجد؛ mismatch یا ناتوانی در تأیید هویت، Login/Setup و درخواست‌های بعدی Auth را Fail-closed مسدود می‌کند.
- هویت Client/Server اکنون از root `version.json` می‌آید و شامل schema/product/version/API/License-protocol/manifest-version/hash و Edition است؛ Client همهٔ این فیلدها را با پاسخ عمومی Server دقیق مقایسه و mismatch را Fail-closed می‌کند. Production Client build فقط با `ECS_BUILD_EDITION` فرمان root مجاز است؛ `VITE_APP_EDITION` فقط انتخاب Development/Serve است و هیچ `VITE_APP_VERSION` یا default نسخه/Edition وجود ندارد.
- پاسخ موفق `POST /auth/setup`، `POST /auth/login` و `GET /auth/me` همگی قرارداد یکسان `edition`, `features`, `permissions`, `user`, `session` و alias سازگار `expiresAt` دارند؛ `session` دقیقاً `id`, `createdAt`, `lastSeenAt`, `expiresAt` را می‌دهد و alias سطح بالا با `session.expiresAt` برابر است.
- `edition` فقط `FULL` یا `ATTENDANCE` است؛ `features` Capabilityهای مؤثر Process و `permissions` Permissionهای مؤثر همان کاربر پس از Edition intersection هستند.
- Session token فقط در Cookie امن می‌ماند و Password/hash، token/hash، IP، User-Agent و فیلدهای داخلی Session وارد payload نمی‌شوند.
- Frontend پس از Login/Setup نباید برای کامل‌شدن Auth state به Refresh پنهان وابسته باشد؛ همان پاسخ باید State کامل را بسازد.
- UI برای نمایش یا اجرای هر Action باید هم Feature و هم Permission لازم را بررسی کند؛ Backend همچنان مرجع نهایی هر دو است.

### 2.8 معیار پذیرش Capability Contract

- [x] بک‌اند Edition و Capabilityهای مؤثر را محاسبه می‌کند.
- [x] `/api` هویت عمومی و Setup/Login/Me قرارداد یکسان Edition/Auth را برمی‌گردانند.
- [ ] هر اکشن هم به Feature و هم Permission مناسب نیاز دارد.
- [ ] Owner با تمام Permissionهای قدیمی نیز به Feature غیرفعال دسترسی ندارد.
- [ ] Restore بکاپ FULL روی نصب ATTENDANCE، Featureها را تغییر نمی‌دهد.
- [x] مقدار ناشناختهٔ `APP_EDITION` باعث Startup failure واضح می‌شود.
- [ ] Consumer مربوط به Feature خاموش هیچ Router، raw parser، timer، WebSocket، database query یا frontend request ایجاد نمی‌کند.

## 3. منو و Routeهای نهایی فرانت‌اند

ترتیب منوی Attendance v1:

1. داشبورد
2. کارمندان
3. حاضری روزانه
4. لاگ ورود و خروج
5. دستگاه‌ها
6. گزارش‌های حاضری
7. تنظیمات

زیرمنوی تنظیمات:

1. حساب‌های کاربری
2. گروه‌ها و شیفت‌ها
3. Audit Log
4. بکاپ و بازیابی
5. صداها فقط در صورت فعال‌بودن Feature

### 3.1 زیرساخت Route و Navigation

- [x] یک Route Manifest مشترک برای `App`, منوی اصلی و منوی Settings ساخته شود.
- [x] هر Route دارای `feature`, `permissions`, `path`, `component`, `navigation` و `order` باشد.
- [x] `RequireFeature` علاوه بر `RequirePermission` اضافه شود.
- [x] Direct URL مربوط به Feature غیرفعال، generic Not Found بدهد و نام قابلیت مخفی را افشا نکند.
- [x] Root و Settings به اولین Route روشن و مجاز Redirect شوند؛ wildcard ناشناخته generic Not Found باشد.
- [x] Route componentها با `React.lazy` بارگیری و Manifest/entry در Production build بر اساس `ECS_BUILD_EDITION` و در Development بر اساس `VITE_APP_EDITION` انتخاب شود تا import صفحهٔ Excluded اصلاً وارد graph حاضری نشود.
- [x] Build حاضری Chunk صفحه‌های مالی/مشتری را تولید نکند.
- [x] Header، میانبر Add و Breadcrumb از همان Route Manifest استفاده کنند.

### 3.2 ماتریس صفحه‌های اجباری

| Route نهایی | منبع فعلی | وضعیت | کار لازم |
| --- | --- | --- | --- |
| `/login` | `AuthEntryPage` | `[x]` | Setup/Login/Logout حفظ شد و نام، لوگو، icon، title و copy پایه از Product Brand همان Edition می‌آید |
| `/` | Redirect | `[x]` | رفتن به اولین Route فعال و مجاز؛ اکنون Dashboard حاضری |
| `/dashboard` | `AttendanceDashboard` | `[x]` | API/UI مستقل فقط حاضری؛ بدون KPI، Query یا chunk مشتری/مالی |
| `/employees` | `/members` / `MembersList` | `[~]` | Backend Phase 2.1 آماده و Staff-only است؛ تغییر Route/نام و اجبار Client در Phase 3 مانده است |
| `/employees/add` | `AddMember` / `MemberWizard` | `[~]` | Backend ورودی Customer/Membership/Payment/Salary را رد می‌کند؛ Wizard امن در Phase 3 مانده است |
| `/employees/:id` | `MemberDetail` | `[~]` | Projection امن پروفایل/شیفت/دسترسی و اتصال persistence-only DeviceUser آماده است؛ Device UI در Phase 3 مانده است |
| `/employees/:id/edit` | `EditMember` | `[~]` | Backend فقط Employee را می‌پذیرد و subroute عضویت ندارد؛ UI و request cleanup در Phase 3 مانده‌اند |
| `/attendance` | `AttendanceDaily` | `[~]` | حفظ هسته؛ افزودن فیلتر Staff Group و Permission خروجی |
| `/entry-logs` | `Attendance` | `[~]` | فقط Staff؛ حذف Customer/Membership؛ خروجی کامل سمت سرور |
| `/devices` | `Devices` | `[x]` | صفحهٔ مستقل K40 Pull، Route/Capability فعال و Permissionهای Core تفکیک شده‌اند؛ Advanced/Support خاموش و خارج build باقی مانده است |
| `/reports` | Redirect | `[x]` | انتقال مستقیم به تنها گزارش فعال `/reports/attendance` |
| `/reports/attendance` | `AttendanceReport` | `[x]` | فقط Staff؛ Summary/Daily/Employees/Evidence، بدون Customer/Finance/Export |
| `/settings` | Redirect | `[~]` | اولین Settings Route فعال |
| `/settings/admin-users` | `AdminUsers` | `[x]` | صفحهٔ مستقل Access Users، Roleهای Attendance و schema/selector اجباری سمت سرور و کلاینت |
| `/settings/staff-groups` | `StaffGroups` | `[~]` | گروه و شیفت بدون نمایش Salary |
| `/settings/audit-logs` | `AuditLogs` | `[x]` | فقط Domainهای مجاز Edition؛ direct ID مخفی 404 و payload حساس/مالی redacted |
| `/settings/backups` | `Backups` | `[~]` | حفظ عملیات ضروری؛ Advanced برای Owner/Vendor |
| `*` | wildcard | `[~]` | generic Not Found؛ بدون Redirect کور به Dashboard |

### 3.3 سازگاری Routeهای قدیمی

- [x] در Attendance، `/members` به `/employees` Redirect شود.
- [x] `/members/add`, `/members/:id`, `/members/:id/edit` به معادل Employee Redirect شوند.
- [x] Redirect هرگز Customer ID را به Employee page باز نکند.
- [x] Bookmarkهای قدیمی مجاز کارمند حفظ شوند.

### 3.4 صفحه‌های اختیاری

| Route/سطح | وضعیت | شرط فعال‌سازی |
| --- | --- | --- |
| `/reports/attendance-compliance` | `[OPTIONAL]` | Gate کامل و `APP_FEATURE_ATTENDANCE_COMPLIANCE=1` |
| `/settings/sounds` | `[OPTIONAL]` | Gate کامل، `APP_FEATURE_SOUNDS=1` و QA مرورگر/نسخهٔ نصبی |
| Inbox drawer/WebSocket | `[OPTIONAL]` | Gate کامل، `APP_FEATURE_INBOX=1`، Auth و Staff scope |
| Device diagnostics/raw logs/support | `[OPTIONAL]` | Gate کامل، `APP_FEATURE_DEVICE_DIAGNOSTICS=1` و نقش Technician/Vendor |
| Door unlock | `[OPTIONAL]` | Gate کامل، `APP_FEATURE_DOOR_CONTROL=1` و Permission مستقل |

### 3.5 صفحه‌های خارج از Attendance

- [ ] `/payments` و همهٔ `/payments/*` در Attendance وجود نداشته باشند.
- [ ] `/settings/membership-plans` وجود نداشته باشد.
- [ ] `/reports/customer-activity` وجود نداشته باشد.
- [ ] `/reports/debt-aging` وجود نداشته باشد.
- [ ] `/reports/renewal-forecast` وجود نداشته باشد.
- [ ] `/reports/payroll-variance` وجود نداشته باشد.
- [ ] `/reports/cashflow` وجود نداشته باشد.
- [ ] Membership و Payroll inline sections از `/reports` حذف شوند.
- [ ] فایل قدیمی و بدون Route `MemberProfile.tsx` در Build حاضری وارد نشود؛ Cleanup فیزیکی آن Scope جدا است.
- [ ] درخواست مستقیم همهٔ Routeهای بالا در بک‌اند Attendance پاسخ 404/غیرفعال بدهد.

## 4. صفحه‌ها و Workflowهای کارمند

### 4.1 فهرست کارمندان

- [x] عنوان‌ها و ترجمه‌ها از Member به Employee/کارمند تغییر کنند.
- [x] `memberType` در Client، URL و Server همیشه `STAFF` باشد.
- [x] All/Customer filter حذف شود.
- [x] ستون Membership/بدهی/اعتبار حذف شود.
- [x] Search، Status، Group و Pagination حفظ شود.
- [x] پاسخ DTO حاضری شامل داده‌های Customer/Finance نباشد.
- [x] در Attendance v1 عملیات عادی فقط Deactivate/Archive باشد؛ Delete فیزیکی Employee در Attendance ارائه نشود و رفتار موجود آن فقط برای FULL حفظ شود.

### 4.2 افزودن و ویرایش کارمند

- [x] Wizard انتخاب نوع را نشان ندهد و `STAFF` را قطعی بفرستد.
- [x] CustomerForm و Membership Plan request اجرا نشود.
- [x] فیلدهای Membership date/price/discount/debt/payment حذف شوند.
- [x] Salary type/amount و نرخ‌های پولی اضافه‌کاری نمایش داده نشوند.
- [x] Backend adapter برای ستون‌های فعلی Salary مقدار خنثی و معتبر فراهم کند.
- [x] نام، کد، تماس، وضعیت، نقش سازمانی، گروه، شیفت و Access schedule حفظ شوند؛ ایجاد/تغییر کد، DeviceUser را تراکنشی claim/remap و تا sync فیزیکی دوباره نامعتبر می‌کند و conflict را امن رد می‌کند.
- [~] Device user ID و Fingerprint enrollment در مرز بک‌اند آماده است؛ Feature نهایی و UI دستگاه در Gate نهایی Phase 2 و Phase 3 باقی مانده‌اند.
- [x] Edit صفحه هیچ `/members/:id/memberships` request ارسال نکند.
- [x] Customer ID در Add/Edit/Detail از سمت Server رد شود.

### 4.3 جزئیات کارمند

- [x] Overview کارمند حفظ شود.
- [x] Attendance history حفظ شود.
- [x] Shifts/schedules بدون Salary حفظ شود.
- [x] Access عملیاتی و Device UI امن حفظ شد؛ Door control همچنان مستقل و خاموش است.
- [x] Membership، Payments، Credit، Debt و Financial summary حذف شوند.
- [x] API پاسخ Attendance Edition Projection جدا و حداقلی داشته باشد.

## 5. حاضری روزانه و لاگ تردد

### 5.1 حاضری روزانه

- [ ] Date navigation و presetها حفظ شوند.
- [ ] Search، Shift و Staff Group filter فعال باشند.
- [ ] Present، Absent، Late، Inside و Justified نمایش داده شوند.
- [ ] First IN، Last OUT و مدت حضور نمایش داده شوند.
- [ ] Late minutes، Early leave و Overtime نمایش داده شوند.
- [ ] `NO_CHECKOUT`, `NO_SHIFT`, `MULTIPLE_EVENTS` هشدار واضح داشته باشند.
- [ ] Unscheduled presence و Denied/Unknown رویدادها قابل بررسی باشند.
- [x] Justification create/update/delete فقط برای Staff و با Audit باشد.
- [ ] CSV با Permission `ATTENDANCE_EXPORT` کار کند.
- [ ] عبارت «مرخصی» فقط وقتی استفاده شود که داده واقعاً Justification باشد؛ `NO_SHIFT` با «بدون شیفت برنامه‌ریزی‌شده» نمایش داده شود.

### 5.2 Entry/Exit Logs

- [x] Member type state و URL به Staff normalize شود.
- [x] Customer selector و Membership details حذف شود.
- [x] فیلتر Date/Event/Source/Device/Employee/Result حفظ شود.
- [x] Manual IN/OUT فقط Employee search کند.
- [x] Manual entry نیازمند `ATTENDANCE_MANUAL` و Audit کامل باشد.
- [x] خروجی فعلی محدود به صفحهٔ باز، با Export کامل سمت سرور جایگزین شود.
- [x] Export دیگر page-only نیست و تمام ردیف‌های فیلترشده را سمت Server می‌سازد.
- [x] CSV و XLSX کامل بر اساس فیلترها تولید شوند.

## 6. گزارش‌های Attendance Edition

### 6.1 داشبورد عملیاتی حاضری

- [x] تعداد کارمندان فعال/مورد انتظار امروز
- [x] حاضر، به‌موقع، دیرآمده، غایب و موجه
- [x] Inside now و Open session
- [x] Missing checkout و Multiple events
- [x] Punchهای امروز، Denied و Unknown ID
- [x] وضعیت Online/Offline دستگاه و آخرین Sync/Event
- [x] روند هفت‌روزهٔ حاضری و استثناها
- [OPTIONAL] Peak hours فقط در صورت تأیید ارزش عملیاتی در Pilot حفظ شود؛ Release v1 به آن وابسته نیست.
- [x] تمام Queryهای داشبورد Staff-only باشند.
- [x] Active membership، Expiring، Revenue، Debt و Payment query اجرا نشوند.

### 6.2 گزارش جامع حاضری

- [x] Filterهای Date preset/from/to/Employee/Group/Shift/Device/Event حفظ شوند.
- [x] Server بدون توجه به Query Client، Staff scope را تحمیل کند.
- [x] Member type selector از UI حذف شود.
- [x] KPIها: present employee-days، absent، late count/minutes، early leave count/minutes، overtime، justified، unscheduled، denied و no-checkout.
- [x] برچسب `presentDays` روشن کند که Employee-day است، نه تعداد روز تقویمی.
- [x] تب Daily حفظ شود.
- [x] تب Employees حفظ شود.
- [x] تب Evidence حفظ شود.
- [x] CSV daily/employees/evidence کامل و UTF-8 باشد.
- [x] XLSX و PDF حفظ شوند.
- [x] Export از `FINANCIAL_EXPORT` جدا و به `ATTENDANCE_EXPORT` وصل شود.
- [ ] PDF برند قابل تنظیم و Filter labels انسانی داشته باشد.
- [x] Exportها با Audit، Actor، Session، IP و row count ثبت شوند.

### 6.3 تایم‌شیت ماهانهٔ کارمند — Gap اجباری

- [x] تب `Monthly Timecard` در `/reports/attendance` طراحی شود.
- [x] Month و Employee/Group filter داشته باشد.
- [x] ساعات برنامه‌ریزی‌شده نمایش داده شود.
- [x] ساعات واقعی و Sessionهای جفت‌شده نمایش داده شود.
- [x] Overtime، Late، Early leave و Absence نمایش داده شود.
- [x] Missing/invalid punches مشخص باشد.
- [x] روزهای Justified جدا باشند.
- [x] جمع ماهانه و جزئیات روزانه قابل تطبیق باشند.
- [x] CSV/XLSX و نسخهٔ چاپی/PDF مدیر تولید شود.
- [x] هیچ مبلغ، Salary یا ادعای Payroll در آن وجود نداشته باشد.
- [OUT] Employee/Manager sign-off جزو v1 نیست و فقط با Scope Change و Workflow رسمی اضافه می‌شود.

### 6.4 Attendance Compliance — اختیاری پس از v1

- [OPTIONAL] تمام داده‌ها Staff-only شوند.
- [OPTIONAL] Export از Permission مالی جدا شود.
- [OPTIONAL] Weightهای امتیازدهی تعریف و مستند شوند.
- [OPTIONAL] امتیاز Group بر اساس میانگین/نرمال‌سازی اصلاح شود تا گروه بزرگ جریمه نشود.
- [OPTIONAL] Custom weight boundary tests تکمیل شوند.
- [OPTIONAL] تنها پس از تأیید سیاست مشتری در منو فعال شود.

### 6.5 گزارش‌های ممنوع در Attendance

- [ ] Customer Activity API/UI/exports غیرفعال باشند.
- [ ] Membership Report API/UI/exports غیرفعال باشند.
- [ ] Debt Aging API/UI/exports غیرفعال باشند.
- [ ] Renewal Forecast API/UI/exports غیرفعال باشند.
- [ ] Payroll و Payroll Variance API/UI/exports غیرفعال باشند.
- [ ] Cashflow API/UI/exports غیرفعال باشند.

## 7. Backend Route و Service Boundary

### 7.1 Routeهای پایه و اجباری

- [x] `/api` identity نام Edition و Version صحیح را برگرداند.
- [x] `/api/v1/health` همیشه در دسترس باشد.
- [x] `/api/v1/auth` Setup/Login/Logout/Me حفظ شود.
- [x] Restore-maintenance middleware قبل از Routeهای business و Special ingestion و پیش از body parser حفظ شود.
- [x] `/api/v1/admin-users` با نقش‌های مجاز Attendance حفظ شود.
- [ ] `/api/v1/audit-logs` با Edition filtering حفظ شود.
- [ ] `/api/v1/backups` با Permissionهای فعلی امن حفظ شود.
- [ ] `/api/v1/staff-groups` و `/api/v1/shifts` زیر `STAFF_GROUPS` فقط پس از Staff/Salary isolation فعال شوند.
- [ ] `/api/v1/devices` زیر `DEVICES` فقط پس از Commit Gate کامل Phase 2 و promotion صریح `DEVICES` فعال شود.
- [x] `/api/v1/dashboard` زیر `ATTENDANCE_DASHBOARD` فقط با Router مستقل Attendance و `ATTENDANCE_VIEW` فعال است.
- [OPTIONAL] `/api/v1/inbox` و `/api/v1/sounds` فقط پس از Gate کامل Featureهای `INBOX`/`SOUNDS` فعال شوند.

### 7.2 Employee API

- [x] قرارداد مصوب API: Router/Facade اختصاصی `/api/v1/employees` فقط Staff DTO/operation بدهد؛ `/api/v1/members` برای FULL حفظ و در Attendance Mount نشود.
- [x] List/Create/Get/Update/Shifts/Attendance فقط Staff را قبول کنند؛ Employee HTTP `DELETE` ثبت نشود و Deactivate/Archive از `PATCH` امن انجام شود.
- [x] `memberType=STAFF` و `isStaff=true` در مرز Service canonical شوند.
- [x] مرز Employee عمداً فقط رکوردی را می‌پذیرد که هم‌زمان `memberType=STAFF` و `isStaff=true` باشد؛ حالت‌های legacy ناسازگار همان 404 غیرقابل‌تمایز می‌گیرند و read/update حق auto-repair ندارد.
- [ ] پیش از Commit Gate نهایی Phase 2، inventory خواندنی، classification و repair اتمیک/قابل Audit و rollback — یا Evidence صفر بودن mismatch — اجرا شود.
- [x] `/members/:id/memberships` در Attendance Mount نشود.
- [x] `/members/:id/payments` در Attendance Mount نشود.
- [x] `/members/:id/full` در Attendance Mount نشود؛ جزئیات کارمند فقط از Projection امن `/employees/:id` برگردد.
- [x] Manual attendance و Justification، Customer target را رد کنند.

### 7.3 Attendance و Reports API

- [x] `/attendance` list به Staff محدود شود.
- [x] `/attendance/daily` رفتار فعلی Staff را حفظ و تست کند.
- [x] `/attendance/manual` Staff target را enforce کند.
- [x] Justification create/delete Staff target را enforce کند.
- [x] `/reports/attendance/*` بدون توجه به `memberType` Client فقط Staff باشد.
- [x] `/reports/attendance-compliance` در صورت Feature فعال فقط Staff باشد.
- [x] Attendance DTOها Membership/Customer finance fields نداشته باشند.

### 7.4 Routeهای غیرفعال

- [ ] `/membership-plans` در Attendance Mount نشود.
- [ ] `/payroll` در Attendance Mount نشود.
- [ ] `/expenses` در Attendance Mount نشود.
- [ ] `/membership-report` در Attendance Mount نشود.
- [ ] `/reports/customer-activity` در Attendance Mount نشود.
- [ ] `/reports/debt-aging` در Attendance Mount نشود.
- [ ] `/reports/renewal-forecast` در Attendance Mount نشود.
- [ ] `/reports/payroll-variance` در Attendance Mount نشود.
- [ ] `/reports/cashflow` در Attendance Mount نشود.
- [ ] تست خودکار پاسخ عمومی و یکسان `404 Not Found` برای همهٔ Routeهای بالا وجود داشته باشد.

## 8. Permission، Role و Security

### 8.1 نگاشت تأییدشدهٔ Roleهای v1

برای جلوگیری از Migration غیرضروری enum، نام‌های دیتابیسی فعلی حفظ و فقط bundle و Label آن‌ها در Attendance تغییر می‌کنند:

| Label در Attendance | `AdminRole` موجود | Permission bundle هدف |
| --- | --- | --- |
| Attendance Owner | `GYM_OWNER` | `SIGN_IN`, `ADMIN_USERS_MANAGE`, `ROLES_MANAGE`, `MEMBERS_VIEW`, `MEMBERS_WRITE`, `ATTENDANCE_VIEW`, `ATTENDANCE_EXPORT`, `ATTENDANCE_MANUAL`, `ATTENDANCE_JUSTIFY`, تمام Permissionهای Device مجاز Feature، `BACKUP_CREATE`, `BACKUP_SETTINGS_MANAGE`, `AUDIT_LOG_VIEW`, `SYSTEM_SETTINGS_MANAGE`, `LICENSE_VIEW`, `LICENSE_ACTIVATE` |
| Attendance Manager | `MANAGER` | `SIGN_IN`, `MEMBERS_VIEW`, `MEMBERS_WRITE`, `ATTENDANCE_VIEW`, `ATTENDANCE_EXPORT`, `ATTENDANCE_MANUAL`, `ATTENDANCE_JUSTIFY`, `DEVICES_VIEW`, `DEVICES_USER_SYNC`, `DEVICES_ENROLL` |
| Attendance Operator | `OPERATOR` | `SIGN_IN`, `MEMBERS_VIEW`, `ATTENDANCE_VIEW`, `ATTENDANCE_MANUAL`, `ATTENDANCE_JUSTIFY`, `DEVICES_VIEW` |
| Device Technician | `DEVICE_OPERATOR` | `SIGN_IN`, `MEMBERS_VIEW`, `ATTENDANCE_VIEW`, `DEVICES_VIEW`, `DEVICES_DIAGNOSTICS`, `DEVICES_USER_SYNC`, `DEVICES_ENROLL`, `DEVICES_CLEAR_LOGS` |
| Read-only Attendance Auditor | `READ_ONLY_AUDITOR` | `SIGN_IN`, `MEMBERS_VIEW`, `ATTENDANCE_VIEW`, `AUDIT_LOG_VIEW` |
| Vendor Maintenance | `VENDOR_OWNER` | تمام Permissionهای allowlist حاضری، شامل `LICENSE_VIEW`، `LICENSE_ACTIVATE` و `RESTORE_DATABASE`، فقط در activation window موجود و با Capabilityهای فعال؛ Restore هنگام License lock همچنان بسته است |

- `DOOR_UNLOCK` و `SOUND_SETTINGS_MANAGE` حتی برای Role مجاز فقط پس از فعال‌شدن Feature اختیاری متناظر مؤثر می‌شوند.
- `MEMBERS_VIEW` و `MEMBERS_WRITE` به‌علت سازگاری enum حفظ می‌شوند، اما در Attendance فقط Employee/Staff action را مجاز می‌کنند.
- `ADMIN`, `SUPER_ADMIN`, `RECEPTION`, `ACCOUNTANT` و `STAFF` در selector ساخت حساب جدید Attendance نمایش داده نمی‌شوند. حساب legacy بازیابی‌شده تا زمان migrate/deactivate فقط Permissionهای تقاطع‌یافته را می‌گیرد و هیچ Feature خاموشی را فعال نمی‌کند.
- `MEMBERS_DELETE` در bundleهای Attendance v1 قرار نمی‌گیرد؛ Deactivate/Archive مسیر عادی است.
- denylist قطعی Attendance بدون توجه به Role/override شامل `MEMBERS_DELETE`, `MEMBERSHIPS_WRITE`, `MEMBERSHIPS_CANCEL`, `PAYMENTS_RECORD`, `PAYMENTS_REVERSE`, `FINANCIAL_REPORTS_VIEW`, `FINANCIAL_EXPORT`, `EXPENSES_MANAGE` و `PAYROLL_MANAGE` است. `LICENSE_VIEW` برای Owner/Vendor و `LICENSE_ACTIVATE` برای Owner/Vendor فقط پس از Phase 6.2 و با signed same-device token/Recovery policy مؤثر می‌شوند.
- `ATTENDANCE_EXPORT` از Phase 4.3 typed و code-ready است و فقط در bundleهای Owner/Manager/Vendor وجود دارد؛ `FINANCIAL_EXPORT` در Attendance ممنوع می‌ماند و Operator/Technician/Auditor با مشاهدهٔ گزارش حق Export نمی‌گیرند.

### 8.2 کارهای Permission و Security

- [x] `APP_EDITION` در `config/env.ts` به‌صورت enum معتبر تعریف شود.
- [x] Capability policy مرکزی برای Route registration، Service، Job و UI ساخته شود.
- [x] Effective permissions با allowlist Edition تقاطع داده شوند.
- [x] Role permission rowهای قدیمی یا overrideهای ALLOW نتوانند Capability خاموش را فعال کنند.
- [x] `ATTENDANCE_EXPORT` به Prisma enum، migration، seed و UI اضافه شود.
- [~] Attendance Owner برای bundle عملیاتی پیش از Licensing فقط Permissionهای موجود جدول 8.1 را می‌گیرد و `ATTENDANCE_EXPORT` مستقل از Permission مالی است؛ افزودن دو Permission License در ردیف بعد هنوز پیاده نشده است.
- [ ] `LICENSE_VIEW` / `LICENSE_ACTIVATE` از denylist قدیمی خارج و با License admission، Owner/Vendor bundle و restricted-session tests هر دو Edition پیاده شوند؛ Admin view-only و Recovery/Rebind همچنان Vendor-signed بماند.
- [~] Roleهای جدول 8.1 برای سطح پیش از Licensing در Backend runtime bundle و UI label/selector اعمال شده‌اند؛ Permissionهای جدید License در 6.2 باقی‌اند.
- [x] نام enumهای legacy در DB حفظ شوند، اما Label و bundle Edition امن باشد.
- [x] Admin role selector نقش‌های Accountant/Gym/Finance نامربوط را نمایش ندهد.
- [ ] Password reset/deactivation همچنان Sessionها را revoke کند.
- [x] Audit options/list/detail داده‌های تاریخی Membership/Finance را در Attendance افشا نکند.
- [ ] Push endpoint فقط با credential/HMAC امن فعال شود؛ در v1 خاموش باشد.
- [ ] `/push-test` در Production غیرفعال باشد.
- [x] Inbox WebSocket پیش از فعال‌سازی Auth و Authorization داشته باشد؛ O.2.3 upgrade را پیش از `WELCOME` با Feature/Session/Edition/Permission می‌بندد.
- [x] Device Core event/SSE response فقط projection تاریخی و strict-both Staff باشد و Customer/marker ناسازگار یا raw payload را بازنگرداند.
- [ ] Device raw/support/Audit/Inbox responseهای اختیاری نباید Customer identity بازگردانند.
- [ ] `SERVER_HOST` validate و پیش‌فرض `127.0.0.1` باشد؛ Bind روی LAN فقط با مقدار صریح Installer و Firewall policy ثبت‌شده مجاز است.
- [ ] Setup هیچ Password پیش‌فرض یا Credential سخت‌کدشده نداشته باشد و Password policy موجود Regression شود.
- [ ] Vendor Maintenance زمان‌دار، قابل لغو و بدون Backdoor دائمی باقی بماند.
- [ ] Restore-maintenance و Vendor maintenance regression شوند.

## 9. معنای Time Clock و پردازش K40

### 9.1 قواعد اجباری

- [x] Punch کارمند ACTIVE و شناخته‌شده مستقل از پنجرهٔ شیفت ذخیره شود.
- [x] Punch مربوط به Customer موجود در بکاپ FULL فقط RawLog بسازد، با status موجود `SKIPPED_INVALID` و reason پایدار `NON_STAFF_MEMBER` نهایی شود و هیچ AttendanceLog/InboxItem/Door call/KPI ایجاد نکند.
- [x] شیفت فقط Late/Early/Overtime/Unscheduled را محاسبه کند؛ fixture فاز 2.6 این classificationها را بدون gating تطبیق می‌دهد.
- [x] نبود شیفت باعث حذف Punch معتبر نشود.
- [x] کارمند ناشناخته یا Inactive رد و با reason امن در RawLog Evidence ثبت شود؛ برای هر Punch ادعای Global Audit جدا وجود ندارد.
- [x] تصمیم `attendanceRecorded` از `doorAllowed` جدا باشد؛ در Attendance v1 هر Punch پذیرفته‌شده `attendanceRecorded=true` و بدون فرمان در `doorAllowed=false` است.
- [x] Door call در Attendance v1 انجام نشود.
- [x] Raw device log قبل از پردازش حفظ شود.
- [x] Dedupe مانع ثبت دوبارهٔ همان Event شود.
- [x] IN/OUT inference برای Open session، Missing checkout، Multiple events و Checkout درست کار کند.
- [x] Cross-midnight shift و Checkout بعد از Shift/buffer در Daily و Report یکسان محاسبه شوند.
- [x] Early/late/no-shift/outside-shift از نظر ذخیره‌شدن و non-gating در `TIME_CLOCK` و از نظر classification/reconciliation کامل Daily/Report تست شده‌اند.
- [x] Denied event در Daily summary و Report Evidence/KPI با strict Staff scope تست شده است.

### 9.2 مسیرهای Device ingestion

- [x] K40 Pull مسیر رسمی v1 باشد.
- [x] Startup در Attendance فقط یک K40 فعال و پشتیبانی‌شدهٔ `FINGERPRINT` با `NETWORK`/`ZKTECO_PULL_SDK` را در Pull mode فعال کند.
- [ ] Site allowlist و mapping چندسایت/چنددستگاه پیش از ادعای آن طراحی و تست شود.
- [x] Restored customer-linked device user پردازش تجاری Customer انجام ندهد.
- [x] `/iclock` در Attendance v1 Mount یا advertise نشود.
- [x] Generic JSON push در Attendance خاموش باشد؛ فعال‌سازی آینده Security Gate مستقل می‌خواهد.

### 9.3 محدودیت Multi-device

- [x] Global uniqueness فعلی `DeviceUser.externalId` و `memberId` قرارداد Pilot تک-K40 است؛ پشتیبانی مستقل چنددستگاهی ادعا نمی‌شود.
- [x] collision، claim race و remap شناسه در تست خودکار بررسی شد؛ inventory واقعی Pilot در 2026-08-23 تعداد `STAFF/isStaff=false = 0` و `CUSTOMER/isStaff=true = 0` را ثبت کرد.
- [ ] پیش از پشتیبانی چند دستگاه مستقل، مدل composite device/user یا mapping مناسب طراحی شود.
- [ ] هیچ مستند فروش v1 ادعای Multi-device نامحدود نکند.

## 10. صفحه و API دستگاه‌ها

### 10.1 Core اجباری

این موارد در Phase 2.3 در factory بک‌اند آماده و در Phase 3.5 با promotion صریح `DEVICES`، Route واقعی و UI مستقل Mount و تست شدند.

- [x] List/Get/Create/Update دستگاه
- [x] Status، Runtime status، Last poll/event/error
- [x] Enable/Disable با Permission مناسب
- [x] Test connection
- [x] Device time read/set
- [x] Employee enrollment/Fingerprint trigger
- [x] Device user list/sync/upsert/delete با Staff enforcement
- [x] Suggest user ID
- [x] Event stream فقط در صورت Auth و Feature مناسب

### 10.2 Advanced/Support

- [OPTIONAL] Diagnose و Network scan فقط با `DEVICE_DIAGNOSTICS` و برای Technician/Vendor
- [OPTIONAL] Raw logs و Support bundle فقط با `DEVICE_DIAGNOSTICS`، برای Technician/Vendor و Staff-scoped
- [OPTIONAL] Clear device logs فقط با `DEVICE_DIAGNOSTICS`، برای Owner/Technician و با تأیید/Audit
- [x] Delete device user با تأیید/Audit و Employee identity امن
- [OPTIONAL] Door unlock فقط با `DOOR_CONTROL` و Permission مستقل

### 10.3 تست سخت‌افزاری K40

- [x] اتصال و Polling
- [x] Create/update/enable/disable دستگاه
- [x] User list/sync/create/delete
- [x] Fingerprint enrollment
- [x] Time read/set
- [x] Staff IN و OUT
- [x] Punch قبل/بعد شیفت در Time Clock
- [x] Duplicate event
- [x] Unknown/Inactive user
- [x] Restart backend و resume cursor/status
- [x] No door call در Attendance v1
- [x] Reconciliation بین Raw Log، Attendance Log، Daily، Entry Logs و Report

Evidence 2026-08-23: دستگاه واقعی `cmjfmgv340000owiczn5kdzgp` روی `192.168.1.200:4370` تست شد. Punch کارمند `ID 1 — Eraj naseri` در `2026-08-23T10:46:56Z` به RawLog `cmt5on71000012sicbwpz4tmp` و AttendanceLog `cmt5on73w00022sicjf9vgsgs` از نوع `OUT`/authorized رسید و با IN همان روز در Daily، Entry Logs و Report reconcile شد؛ Door/Inbox/Violation بعد از Punch همگی صفر بودند. fixture موقت `ID 18` روی خود K40 create/enroll شد؛ Punch خارج شیفت `00:00–00:01` به Attendance authorized رسید و Punch بعد از `BLOCKED` شدن فقط `SKIPPED_INVALID / INACTIVE_EMPLOYEE` ساخت. سپس user فیزیکی و تمام fixtureهای DB پاک و leftovers صفر تأیید شد. restart همان RawLog را بدون duplication و پس از اصلاح بدون Prisma error خواند؛ lifecycle موقت device نیز create/update/disable/enable و اتصال واقعی را پاس کرد و K40 اصلی در پایان `enabled=true, ONLINE` ماند. جزئیات در `docs/k40-setup.md` ثبت شده است.

## 11. Jobهای پس‌زمینه و Inbox

### 11.1 Jobهای اجباری

- [x] Device runtime manager فقط وقتی `DEVICES` code-ready و روشن است شروع شود؛ پیش از Phase 2 هیچ Customer-linked processing در Attendance اجرا نشود.
- [x] Backup scheduler فقط وقتی `BACKUPS` code-ready و روشن است شروع شود.
- [x] Restore maintenance مانع Jobهای ناسازگار شود؛ startup active فقط HTTP را بالا می‌آورد و runtime pause/resume، Device/Inbox/Backup/WebSocket مجاز Edition را idempotent و quiescent می‌کند.
- [x] در Attendance فعلی که `INBOX` هنوز code-ready نیست و Optional default آن false است، Inbox scheduler و WebSocket اصلاً load/start/attach نشوند؛ از O.2.5، `APP_FEATURE_INBOX=0|1` در env schema معتبر است، اما تا Gate نهایی حتی مقدار `1` نیز Feature را فعال نمی‌کند و رفتار legacy `FULL` را خاموش نمی‌سازد.
- [x] `ATTENDANCE_AUTO_CHECKOUT_ENABLED=0` پیش‌فرض است؛ Guard مستقل از Inbox در Attendance برای هر دو مقدار پذیرفته‌شدهٔ `0|1` پیش از Query/Write متوقف می‌شود و هیچ `OUT` مصنوعی نمی‌سازد، در حالی که مسیر legacy `FULL` حفظ می‌شود.

### 11.2 تفکیک Inbox scheduler — Scope انتخاب‌شدهٔ O.2

- [x] Membership expiring job در Attendance اجرا نشود.
- [x] Membership expired job در Attendance اجرا نشود.
- [x] Device disconnected alert حفظ شود.
- [x] Shift-ending alert فقط با Employee path باشد.
- [x] Denied/unknown/inactive/repeated attempts فقط با projection امن Attendance و بدون Raw payload/Customer identity نمایش داده شوند.
- [OUT] Auto-checkout و `OUT` مصنوعی جزو O.2 نیست؛ قرارداد مستقل `ATTENDANCE_AUTO_CHECKOUT_ENABLED` بدون تغییر و non-operational می‌ماند.
- [x] Device feed retention برابر 7 روز و Alert retention برابر 90 روز حفظ و تست شوند.

Evidence 2026-10-03: Scheduler با Edition صریح به دو مسیر `FULL` و `ATTENDANCE` تقسیم شد. مسیر Attendance هیچ Membership query یا Auto-checkout اجرا نمی‌کند، Shift را فقط برای Staff با `/employees/:id` می‌سازد، Device disconnected را با scope حاضری نگه می‌دارد و cleanup را به همان scope با retentionهای 7/90 روز محدود می‌کند. producer دستگاه فقط projection امن پس از پایان Transaction را می‌پذیرد؛ Customer/non-Staff هیچ event نمی‌سازد و accepted/unknown/inactive/invalid/repeated بدون raw payload، external device-user id، biometric، Membership یا Door data ذخیره می‌شوند. تست‌های `test:inbox-attendance-producers`، `test:attendance-auto-checkout`، `test:devices-boundary`، `test:devices`، `test:inbox-scope`، `test:startup-consumers` و `test:http-routes` پاس شدند؛ `INBOX` هنوز در Attendance code-ready/فعال نشده است.

### 11.3 Inbox انتخاب‌شدهٔ Attendance

- [x] Membership filter/type از UI حذف شود.
- [x] Action pathها فقط به Routeهای مجاز Attendance شامل `/employees/:id`، `/devices` و `/entry-logs` بروند و قبل از نمایش با Permission مقصد تطبیق داده شوند.
- [x] هیچ Customer/Membership item قدیمی بعد از Restore قابل مشاهده، شمارش، جستجو یا ارسال روی WebSocket نباشد.
- [x] برای v1، `readAt` همان Shared operations queue باقی بماند؛ per-user receipt فقط Scope Change بعدی است.
- [x] Bell، unread badge، Drawer، Alerts/Device feed، severity/type/device/date/search filters، pagination، Mark read و Mark all read با ظاهر مشترک FULL ارائه شوند.
- [x] UI انگلیسی/دری/پشتو، LTR/RTL، Light/Dark، Desktop/Mobile و حالت‌های loading/empty/error را پوشش دهد.
- [x] Sounds جزو O.2 نیست و Attendance Inbox هیچ Sound API، asset، player یا unlock control را load/request نکند.
- [x] Feature خاموش هیچ HTTP/WebSocket/Sound request یا lazy chunk ایجاد نکند؛ production gate داخلی تا O.2.7 tree-shake می‌شود.

Evidence 2026-10-03 (O.2.4): `AttendanceShellAdapter` فقط با code-ready داخلی، Auth feature `INBOX` و `ATTENDANCE_VIEW`، لایهٔ lazy Inbox را load می‌کند. این لایه Bell/Badge/Drawer مشترک FULL و WebSocket invalidation را بدون import یا request صدا ارائه می‌دهد؛ Alert typeهای Membership/Shift violation از Attendance حذف و Device filter بدون `DEVICES_VIEW` load نمی‌شود. تست مرورگر feature-off نبود Bell/API/WebSocket/chunk را و feature-on Drawer/badge/Attendance type allowlist/no-Sounds/no-unauthorized-device-request را 2/2 ثابت کرد. shell visual موجود Dark/Light، LTR/RTL و Mobile را 4/4 بدون تغییر پاس کرد؛ typecheck، lint با صفر error و چهار warning قدیمی، build هر دو Edition و route-build isolation نیز پاس شدند. production Attendance تا O.2.7 همچنان Inbox marker/chunk ندارد؛ ماتریس نهایی خود Drawer و stateهای loading/empty/error در O.2.6 تکمیل می‌شود.

### 11.4 قرارداد قفل‌شدهٔ O.2 Attendance Inbox — تصویب 2026-10-03

#### 11.4.1 دامنهٔ رویداد

| سطح | رویداد | شدت | مقصد مجاز | قاعده |
| --- | --- | --- | --- | --- |
| Alert | Device disconnected | `CRITICAL` | `/devices` | یک Alert برای هر Device/window؛ reconnect رویداد تکراری نسازد |
| Alert | Shift ending soon | `INFO` | `/employees/:id` | فقط Staff دارای Shift فعال؛ بدون Salary/Payroll data |
| Alert | Inactive employee attempt | `WARNING` | `/employees/:id` یا `/entry-logs` | فقط Employee اثبات‌شده؛ Customer/Member legacy هرگز projection نشود |
| Alert | Unknown device user | `WARNING` | `/devices` یا `/entry-logs` | فقط عنوان و دلیل امن؛ raw payload، biometric data و Customer identity ممنوع |
| Alert | Repeated failed attempts | `WARNING` | `/employees/:id`، `/devices` یا `/entry-logs` | Dedupe window حفظ شود و شمارش فقط از evidence مجاز Attendance باشد |
| Device feed | Accepted Staff punch | `INFO` | `/employees/:id` یا `/entry-logs` | Employee، Device، زمان و `IN/OUT`؛ بدون ادعای بازشدن Door |
| Device feed | Rejected/invalid safe event | `WARNING` | `/entry-logs` یا `/devices` | فقط reason code/copy امن و بدون دادهٔ Customer/raw |

- Punch معتبر `TIME_CLOCK` بیرون پنجرهٔ Shift همچنان ثبت حاضری است و Alert «Access denied/Shift violation» تولید نمی‌کند.
- `Membership expiring/expired`، Debt/Payment، Blacklist Customer، Door opened/unlock و Auto-checkout در Attendance Inbox ممنوع‌اند.
- Missing checkout، Late، Absent، No shift و Multiple attendance events در داشبورد/روزانه باقی می‌مانند و تا Scope Change جداگانه producer Inbox نمی‌شوند؛ این تصمیم از اعلان‌های زمان‌بندی‌شدهٔ مبهم و پرتکرار جلوگیری می‌کند.

#### 11.4.2 مرز داده و تاریخچه

- [x] `InboxItem` دارای scope صریح و قابل Query برای مبدأ `FULL` یا `ATTENDANCE` شد؛ migration، ردیف‌های تاریخی موجود را `FULL` طبقه‌بندی می‌کند و dedupe را با `(scope, dedupeKey)` جدا نگه می‌دارد.
- [x] Runtime `ATTENDANCE` فقط ردیف‌های scope حاضری را list/count/read/search می‌کند؛ Runtime `FULL` رفتار legacy خود را حفظ می‌کند و قرارداد default/migration با تست متمرکز و PostgreSQL واقعی تثبیت شد.
- [x] producer حاضری فقط بعد از نتیجهٔ نهایی Raw-first/strict Staff projection بنویسد و هیچ تصمیم Attendance، cursor، dedupe RawLog یا Door behavior را تغییر ندهد.
- [x] تمام List/unread/read-all/read-bulk/read-one عملیات scope را در Server enforce می‌کنند؛ ID مستقیم ردیف Scope دیگر پاسخ عمومی 404 می‌دهد.

#### 11.4.3 Auth، Permission و Realtime

- [x] HTTP Inbox به Session معتبر و `ATTENDANCE_VIEW` نیاز داشته باشد؛ Action path دستگاه فقط برای `DEVICES_VIEW` و Employee فقط برای `MEMBERS_VIEW` برگردد.
- [x] WebSocket پیش از `WELCOME` همان Session/Auth/Edition/Feature/Permission را validate کند؛ connection ناشناس، Session منقضی، Edition ناسازگار یا Feature خاموش رد شود.
- [x] Server فقط projection مجاز همان Edition را broadcast کند؛ broadcast خام سراسری موجود برای Attendance قابل استفاده نیست.
- [x] Restore maintenance و shutdown، Scheduler و WebSocket را idempotent/quiescent متوقف و از سر بگیرند.
- [x] `readAt` در O.2 مشترک بین اپراتورها است؛ per-user receipt، delivery guarantee و mobile/background notification خارج Scope هستند.

Evidence 2026-10-03: HTTP Attendance Inbox در Router خود `ATTENDANCE_VIEW` را enforce می‌کند و FULL قرارداد legacy `SIGN_IN` را نگه می‌دارد. projection مشترک، action path دستگاه/Employee را بدون `DEVICES_VIEW`/`MEMBERS_VIEW` حذف و path ناشناخته را fail-closed می‌کند. WebSocket به upgrade احرازشده تبدیل شد و پیش از `WELCOME`، Feature، Session، Edition و Permission را می‌سنجد؛ broadcast فقط scope همان Edition و projection مخصوص permission هر client را می‌فرستد. stop/resume listener و clientها را quiescent پاک می‌کند. تست `test:inbox-security` حالت‌های 404/401/403، اتصال معتبر، عدم نشت FULL→ATTENDANCE، action-path filtering و cleanup را همراه regression HTTP FULL پوشش می‌دهد.

#### 11.4.4 فعال‌سازی و Gate پذیرش

- [x] `O.2.0` Scope Change و قرارداد محصول/امنیت/داده ثبت شد؛ هیچ کد Runtime یا schema در این مرحله تغییر نکرد.
- [x] `O.2.1` مدل scope، migration و Repository/Service query boundary با fixture default-FULL و Scopeهای هم‌کلید پیاده و در PostgreSQL واقعی تست شد.
- [x] `O.2.2` Scheduler/producers به FULL legacy و Attendance Staff-only تفکیک شدند؛ Auto-checkout و Membership bundle وارد Attendance نمی‌شوند و feature تا Gate نهایی غیرفعال می‌ماند.
- [x] `O.2.3` HTTP و WebSocket Auth/Permission/Edition filtering و maintenance lifecycle کامل شد؛ Attendance همچنان تا Gate نهایی unmounted/code-not-ready است.
- [x] `O.2.4` UI مشترک Inbox بدون Sounds به `AttendanceShellAdapter`، code-ready داخلی و Auth feature/permission gate متصل شد؛ build تحویلی تا O.2.7 آن را tree-shake می‌کند.
- [x] `O.2.5` `APP_FEATURE_INBOX=0|1` به external config افزوده شد؛ `0` absence کامل و `1` فقط پس از Gate feature را فعال می‌کند.
- [~] `O.2.6` Browser/API/PostgreSQL/restore-isolation/dedupe/retention/FULL regression پاس شد؛ K40 واقعی برای disconnect/reconnect و Staff/unknown/inactive event acceptance به‌علت در دسترس نبودن `192.168.1.200:4370` هنوز باقی است.
- [ ] `O.2.7` پس از پاس‌شدن تمام Gateها، `INBOX` به Attendance code-ready allowlist منتقل، build isolation دوباره تأیید و سپس config تحویلی Attendance روی `APP_FEATURE_INBOX=1` تنظیم شود.

Gate نهایی O.2: Flag=`0` هیچ Route/Job/WebSocket/request/chunk ایجاد نکند؛ Flag=`1` فقط Staff/Device projection مجاز را نشان دهد؛ Restore دادهٔ FULL هیچ count/item/badge/socket leak نسازد؛ Sounds/Door/Auto-checkout خاموش بمانند؛ تمام Regressionهای FULL پاس شوند.

Evidence 2026-10-03 (O.2.5): `APP_FEATURE_INBOX` با validation دقیق و case-sensitive فقط برای `0|1` به env و نمونهٔ external config افزوده شد و پیش‌فرض `0` دارد. Runtime یک projection frozen از Optional flagها می‌سازد و همان مقدار را در startup consumer، HTTP registration/boundary، Auth feature/permission و WebSocket gate مصرف می‌کند. چون `INBOX` هنوز در Attendance code-ready allowlist نیست، تست با Flag=`1` نیز صفر load/start/attach برای Scheduler/WebSocket و `INBOX_EFFECTIVE=false` را ثابت کرد؛ Flagهای نامعتبر پیش از bootstrap رد شدند و FULL با Flag=`0` همچنان Inbox legacy را فعال نگه داشت. typecheck/build، config، startup consumer، capability، HTTP route، Auth permission و Inbox security همگی پاس شدند؛ O.2.6 و O.2.7 هنوز باز و هیچ K40 واقعی در این مرحله اجرا نشد.

Evidence 2026-10-03 (O.2.6 automated): Drawer مشترک حالت خطای مستقل و Retry محلی‌شده گرفت. Browser matrix برابر 5/5، نبود کامل Feature خاموش، فیلترهای Attendance/no-Sounds، دادهٔ populated، loading، empty و error/retry را در English/Dari/Pashto، LTR/RTL، Light/Dark و Desktop/Mobile پوشش داد. تست‌های scope unit و PostgreSQL واقعی، composite dedupe/read isolation، Attendance producer/retention، HTTP/WebSocket security و Auto-checkout همگی پاس شدند. Restore واقعی FULL→ATTENDANCE و FULL→FULL با 40 migration، dump/restore PostgreSQL، حفظ config خارجی و cleanup کامل هر دو DB/artifact پاس شد. Full operations regression برابر 28/28، Full browser reports برابر 6/6 و Audit viewer برابر 5/5 پاس شدند؛ client/server typecheck، lint، build و artifact isolation نیز موفق بودند. تست فیزیکی اجرا نشد: probe فقط‌خواندنی شبکه در زمان آزمون `Tcp4370=False` برای `192.168.1.200:4370` برگرداند، پس O.2.6 تا اتصال K40 و اجرای acceptance محدود آن `[~]` می‌ماند.

## 12. Staff Group، Shift و تنظیمات زمان

- [ ] Group CRUD حفظ شود.
- [ ] Shift name/start/end/weekdays حفظ شود.
- [ ] Overnight shift حفظ و تست شود.
- [ ] Grace minutes و Early access حفظ شوند.
- [ ] Active/inactive shift حفظ شود.
- [ ] Salary type/amount از Attendance UI حذف شود.
- [ ] Backend برای ستون‌های اجباری Salary مقدار امن `0`/default داشته باشد.
- [ ] Overtime minutes عملیاتی حفظ شود، اما نرخ پولی حذف شود.
- [x] `APP_TIMEZONE` خارج از دیتابیس validate شود؛ مقدار پیش‌فرض v1 برابر `Asia/Kabul` است و Node local timezone را برای مرزهای روز/شیفت تعیین می‌کند.
- [x] `ATTENDANCE_POLICY` خارج از دیتابیس validate شود؛ مقدار پیش‌فرض و تنها مقدار پشتیبانی‌شدهٔ Attendance v1 برابر `TIME_CLOCK` باشد.
- [x] `ATTENDANCE_AUTO_CHECKOUT_ENABLED=0|1` به‌صورت case-sensitive validate و پیش‌فرض `0` است؛ مقدار `1` فقط رزرو شده و در Attendance v1 non-operational است، و فعال‌سازی آیندهٔ آن Scope Change، UI/Audit واضح و تست مستقل می‌خواهد.
- [ ] تاریخ‌های شمسی/Dari/Pashto و ذخیرهٔ Gregorian/UTC به‌صورت سازگار Regression شوند.
- [~] قرارداد مصوب persistence v1: Edition، Feature flags، timezone و Attendance policy خارج از DB/Restore هستند؛ validation و Restore isolation مربوط به Development env در Phase 5.5 پاس شد. config محافظت‌شدهٔ ProgramData در Installer، Organization/product branding و ACL آن در Phase 6 باقی است و DB settings API جدید جزو v1 نیست.

## 13. Audit Log

- [x] Employee create/update/deactivate/archive در Facade جدید و Delete legacy فقط در FULL Audit داشته باشند؛ Employee HTTP `DELETE` در Attendance وجود نداشته باشد.
- [ ] Staff group/shift تغییرات Audit داشته باشند.
- [x] Manual attendance و Justification Audit داشته باشند.
- [x] Device Core create/update/enable/disable و فرمان‌های Staff user/enroll Audit امن و بدون شناسهٔ خام Customer داشته باشند.
- [ ] فرمان‌های اختیاری clear/unlock در Gateهای `DEVICE_DIAGNOSTICS`/`DOOR_CONTROL` Audit مناسب داشته باشند.
- [x] Admin user و Vendor maintenance Audit حفظ شود.
- [x] Exportهای حاضری Audit داشته باشند.
- [x] Backup/restore Audit در policy تاریخی حفظ شود؛ فعال‌سازی عملیاتی Backup متعلق به Phase 5.3 است.
- [x] Before/after payload دادهٔ Password/Secret/Biometric/Financial پنهان را افشا نکند.
- [x] Attendance viewer فقط Action/Targetهای مجاز Edition را لیست کند و مسیرهای مشترک بدون Evidence قطعی Staff را fail-closed پنهان سازد.
- [x] Restore FULL data isolation برای Audit با list/detail واقعی و 404 شناسه‌های Customer/Payment/Expense تست شود.

## 14. Backup و Recovery

### 14.1 قرارداد داده

- [x] بکاپ همچنان Full database باشد.
- [x] جدول‌های غیرفعال حذف نشوند تا Upgrade به FULL ممکن بماند.
- [x] Edition config بیرون دیتابیس و بیرون Restore payload باقی بماند.
- [x] Restore FULL backup داخل ATTENDANCE، مشتری/مالی را قابل دسترسی نکند.

### 14.2 UI عادی Owner

- [x] Readiness/health
- [x] Storage root
- [x] Schedule و retention
- [x] Manual safe backup
- [x] History/status/details
- [x] Verify
- [x] External copy/reminder

### 14.3 Advanced/Vendor

- [x] Import assistant
- [x] Support package
- [x] Restore test
- [x] Restore prepare/confirm
- [x] Maintenance mode
- [x] Post-restore checks
- [x] Production restore sidecar/result

### 14.4 سازگاری و Installer

- [ ] تغییر برند AtlasGym در path/manifest با backward compatibility انجام شود.
- [ ] Installer مسیرهای قدیمی بکاپ را کشف کند.
- [ ] PowerShell scriptها و PostgreSQL CLI طبق تصمیم ثبت‌شدهٔ Gate 18.0 discover/bundle و version-check شوند.
- [ ] Scheduled backup در نسخهٔ نصب‌شده QA شود.
- [x] Restore روی دیتابیس disposable و سپس API smoke انجام شود.

### 14.5 Hardening الزامی پیش از Release

این موارد از چک‌لیست اصلی Backup به Release Gate این Edition ارث می‌رسند؛ «Backup/restore passed» بدون آن‌ها کامل نیست:

- [x] پیش از extraction برای expanded bytes، entry count، directory depth و path policy سهمیه اعمال و anti-ZIP-bomb regression پاس شود.
- [x] timeout پردازش خارجی تا بسته‌شدن واقعی child process صبر کند و سپس cleanup/state نهایی شود.
- [x] restore-safety matrix برای phrase/folder/type/file/hash/size/test-target/active-connection و cleanup دیتابیس disposable پاس شود.
- [x] full-app restore-maintenance boundary برای startup، HTTP business/special ingestion، Jobها و WebSocket در FULL/ATTENDANCE تست شود.
- [x] post-restore API smoke روی restore واقعی تست شود.
- [x] Audit و Role gate عملیات Verify/Support/Restore برای Owner/Vendor با failure isolation پوشش داده شود.
- [x] stale/restarted/concurrent `OperationRun` و orphan cleanup حداقل برای مسیرهای قابل استفاده در Installer پوشش داده شود.
- [x] هر مورد باز دیگر Backup در `PROJECT_CHECKLIST.md` پیش از Phase 6 به `Required`, `Deferred with rationale` یا `Blocked` طبقه‌بندی و Evidence آن ثبت شود.

## 15. Branding، Language و Build

- [x] Product configuration برای نام، لوگو، icon و support label ساخته شود.
- [~] `AtlasGym` و عبارت‌های Gym در Attendance Login/Layout/Page title با Product config جایگزین و copy فعلی FULL حفظ شد؛ PDF/Backup/Support bundle تا Phaseهای مالک خود باز است.
- [ ] Member/Customer/Membership/Finance/Salary copy در Attendance UI باقی نماند.
- [ ] انگلیسی، دری و پشتو برای همهٔ Routeهای Attendance کامل باشند.
- [ ] RTL/LTR، Theme و Date localization Regression شوند.
- [x] Build FULL رفتار فعلی را بسازد.
- [x] Build Attendance، Route/chunk/branding مخصوص حاضری بسازد و logo artifact نسخه FULL را تولید نکند.
- [ ] Build حاضری `VITE_APP_EDITION=ATTENDANCE` و Server نصب‌شده `APP_EDITION=ATTENDANCE` داشته باشند؛ mismatch در first-run/startup با خطای واضح متوقف شود.
- [ ] Build metadata، API identity و Installer version یکسان باشند.
- [ ] نسخهٔ نصبی Frontend را Same-origin از Backend محلی سرو کند؛ `VITE_API_URL` فقط برای Development/Test باقی بماند.
- [ ] Manifest/Bundle scan ثابت کند صفحه‌های Excluded در Attendance artifact نیستند.

## 16. نقش‌ها و Workflow کاربران

### 16.1 نقش‌های پیشنهادی v1 طبق Decision Gate جدول 8.1

- [ ] Attendance Owner (`GYM_OWNER`)
- [ ] Attendance Manager (`MANAGER`)
- [ ] Attendance Operator (`OPERATOR`)
- [ ] Device Technician (`DEVICE_OPERATOR`)
- [ ] Read-only Attendance Auditor (`READ_ONLY_AUDITOR`)
- [ ] Vendor Maintenance زمان‌دار (`VENDOR_OWNER`)

### 16.2 Workflow راه‌اندازی اولیه

- [ ] Owner اولیه ساخته شود.
- [ ] نقش‌ها و کاربران ساخته شوند.
- [ ] Group و Shift تعریف شوند.
- [ ] Employees و Device IDs ثبت شوند.
- [ ] Fingerprint enrollment انجام شود.
- [ ] K40 connection/time/polling بررسی شود.
- [ ] Backup root، schedule و test backup تنظیم شوند.

### 16.3 Workflow روزانه

- [ ] شروع روز: Device status و unknown IDs بررسی شوند.
- [ ] حین روز: Punchها، Deniedها و Open sessionها بررسی شوند.
- [ ] اصلاح: Evidence بررسی، سپس Manual IN/OUT یا Justification با دلیل ثبت شود.
- [ ] پایان روز: Missing checkout، multiple events و unscheduled presence بررسی شوند.
- [ ] پایان دوره: Timecard/Attendance report صادر و تطبیق شود.
- [ ] Owner: Audit، حساب‌های فعال و وضعیت Backup را دوره‌ای بررسی کند.

## 17. تست‌های خودکار الزامی

### 17.1 Backend Edition Matrix

- [x] `FULL` همهٔ Routeهای فعلی مورد انتظار را حفظ کند.
- [x] `ATTENDANCE` Routeهای Core را 2xx/401/403 مناسب بدهد.
- [x] Routeهای Excluded در Attendance همان پاسخ عمومی `404 Not Found` مسیر ناشناخته را بدهند.
- [ ] مقدار Edition نامعتبر Startup را متوقف کند.
- [ ] stale role rows و per-user ALLOW قابلیت خاموش را دور نزنند.
- [x] `/api` identity و پاسخ‌های Setup/Login/Me، Edition/Feature/Permission مؤثر و سازگار برگردانند.

### 17.2 Staff Isolation

- [x] Employee list/create/get/update/archive فقط strict-both Staff باشد و HTTP Delete ارائه نشود.
- [x] Customer ID و markerهای Staff ناسازگار در Employee routes با 404 غیرقابل‌تمایز و بدون mutation رد شوند.
- [x] Manual attendance/Justification با Customer ID رد شود.
- [x] Entry logs، Report service موجود و Dashboard عملیاتی Attendance strict Staff هستند؛ Dashboard فقط `/summary` امن را Mount می‌کند و legacy details/financial routes در Attendance وجود ندارند.
- [x] Device sync/enroll Customer یا marker ناسازگار را map نکند و پیش از فرمان فیزیکی با 404 یکسان رد کند.
- [x] Device Core event/SSE هیچ Customer یا marker ناسازگار را افشا نکند.
- [x] هر پنج Optional انتخاب‌نشدهٔ Compliance/Inbox/Sounds/Device Diagnostics/Door حتی با Flagهای محیطی آلودهٔ `1` Feature یا Route فعال، module load، Job/WebSocket یا side effect ندارند؛ هر O.x هنگام انتخاب آینده Gate مستقل خود را دارد.

### 17.3 Attendance Semantics

- [x] On-time IN/OUT
- [x] Late arrival
- [x] Early arrival
- [x] Early leave
- [x] Overtime، شامل checkout دیرتر از buffer و تطبیق Daily/Report
- [x] Missing checkout
- [x] Multiple events و قابلیت بازبینی از anomaly filter
- [x] Unscheduled day
- [x] Outside-shift punch در Time Clock از نظر persistence/non-gating و classification کامل
- [x] Overnight/cross-midnight shift
- [x] Duplicate device event
- [x] Unknown/Inactive employee در مرز Raw-only Phase 2.3
- [x] Manual correction و Justification lifecycle در Service/HTTP boundary و fixtureهای خودکار
- [x] Auto-checkout خاموش مستقل از Inbox هیچ Query/Write یا OUT مصنوعی نسازد؛ مقدار رزروشدهٔ `1` نیز در Attendance v1 آن را فعال نکند

### 17.4 Reports و Export

- [x] Attendance export بدون `FINANCIAL_EXPORT` و با `ATTENDANCE_EXPORT` کار کند.
- [x] Customer query parameter نتواند Scope را تغییر دهد.
- [x] CSV daily/employees/evidence کامل باشد.
- [x] Entry Logs export بیش از یک page را کامل صادر کند.
- [x] XLSX/PDF مقادیر، زبان، برند و filename درست داشته باشند.
- [x] Monthly timecard totals با Daily sessions تطبیق کند.
- [x] Export Audit row count و Actor را ثبت کند.

### 17.5 Frontend/E2E

- [x] Nav/Route matrix برای FULL و ATTENDANCE
- [x] Direct URL همهٔ صفحه‌های Excluded
- [x] Owner با Permissionهای legacy نیز Feature مخفی را نبیند.
- [x] Login/Dashboard/Reports/Employee screens هیچ Financial API request نزنند.
- [x] Employee wizard Customer option یا Membership request نداشته باشد.
- [x] Edit employee Membership request نداشته باشد.
- [x] Attendance export با Permission جدید دیده شود.
- [x] Optionalهای خاموش Compliance/Inbox/Sound/Diagnostics/Door حتی با Featureهای تزریق‌شده هیچ Route، request، Inbox WebSocket یا Chunk قابل‌استفاده ایجاد نکنند.
- [x] English/Dari/Pashto و Light/Dark smoke
- [x] هیچ متن AtlasGym/Gym/Customer/Membership/Finance در Attendance UI باقی نماند.

### 17.6 Restore و Data Isolation

- [x] بکاپ FULL با Customer/Membership/Payment به دیتابیس disposable Restore شود.
- [x] Server با `APP_EDITION=ATTENDANCE` بالا بیاید.
- [x] Edition بعد از Restore همان ATTENDANCE بماند.
- [x] Customer/Finance Routeها بسته باشند.
- [x] Dashboard/Reports/Entry Logs/Audit/Inbox Customer data نشان ندهند.
- [x] Customer-linked devices پس از Startup processing تجاری اجرا نکنند.
- [x] Employee attendance و Backup operations همچنان کار کنند.

### 17.7 FULL Regression

- [x] تمام Routeهای FULL همچنان Mount شوند.
- [x] Customer/Membership/Payment/Payroll/Expense workflowهای موجود خراب نشوند.
- [x] گزارش‌های FULL و Exportها حفظ شوند.
- [x] Role/Permissionهای FULL رفتار فعلی را حفظ کنند.
- [x] Backup/restore FULL سازگار بماند.

## 18. Packaging، Installer و Pilot

### 18.0 Decision Gate پیش از کدنویسی Installer

- [x] فناوری Windows service، Installer و نسخه‌های دقیق آن‌ها همراه license/update policy در `PACKAGING_DECISIONS.md` ثبت شد.
- [x] PostgreSQL 17.11 و ابزارهای `psql`/`pg_dump`/`pg_restore` به‌صورت private bundled runtime تصویب شد؛ PATH/discovery خارجی مرجع اجرا نیست.
- [x] مسیرهای نهایی Program Files/ProgramData و ACL حساب‌های Service در `PACKAGING_DECISIONS.md` ثبت شد.
- [x] Web برابر `127.0.0.1:41820`، DB برابر `127.0.0.1:55432`، Same-origin، بدون inbound Firewall/TLS در نصب تک‌سیستم تصویب شد.
- [x] Licensing محدودمدت برنامه برای v1 صریحاً `[IN]` ثبت شد؛ Scope Change و Workflow کامل Offline/Hybrid، TPM/CNG، Secure State خارج DB/Backup، Tamper/Recovery، restricted runtime و Emergency Backup در `LICENSING_DESIGN.md` تصویب شد.

Gate: پاس شد — هیچ Installer نهایی یا migration-on-install پیش از ثبت این تصمیم‌ها ساخته نشد.

### 18.1 آماده‌سازی نسخه

- [x] فایل واحد root-level `version.json` منبع Version برای Client/Server/API و قرارداد artifact است و buildها mismatch را رد می‌کنند؛ مصرف همین هویت توسط Installer پس از ساخته‌شدن آن در Phase 6.4 الزامی و هنوز اجرا نشده است.
- [ ] Licensing کامل طبق `LICENSING_DESIGN.md` پیاده شود؛ مدل Prisma منبع حقیقت نباشد و Secure State/clock/revision/tamper خارج DB/Backup بمانند.
- [ ] Build scan ثابت کند هیچ issuer، production private key، HMAC secret یا Recovery signer وارد Artifact مشتری نشده است.
- [ ] Guardian و App Windows service با Service SID، ACL و dependency جدا تعریف شوند؛ Guardian مالک License State/official loopback proxy و App مالک Node باشد.
- [ ] Startup/restart/recovery policy تعریف شود.
- [ ] PostgreSQL و ابزارهای لازم دقیقاً طبق تصمیم Gate 18.0 نصب/کشف و supported-version آن‌ها بررسی شوند.
- [ ] Migration روی Install/Upgrade امن اجرا شود.
- [ ] Frontend از Backend محلی/Same-origin سرو شود.
- [ ] Log و Backup در مسیر ProgramData خارج از app binaries ذخیره شوند.
- [ ] Uninstall داده و بکاپ را بدون تأیید حذف نکند.

### 18.2 تست Clean Windows

- [ ] نصب روی Windows پاک
- [ ] Offline request/import/renewal و Hybrid check-in/suspend/revoke/offline allowance
- [ ] TPM-backed و Windows 10 Software-CNG fallback با assurance درست
- [ ] Expiry/Grace/Tamper/Recovery restricted mode و Emergency Backup
- [ ] Binary integrity failure با Node خاموش و Emergency Backup واقعی از elevated signed recovery CLI و اجرای Guardian
- [ ] DB Backup/Restore نتواند License/Secure State را تمدید، منتقل یا rollback کند
- [ ] First-run setup
- [ ] Service restart و PC reboot
- [ ] Guardian crash/pipe loss فوراً App/Node را Fail-closed کند و پس از handshake جدید فقط طبق License state برگردد.
- [ ] K40 connection
- [ ] Employee creation/enrollment
- [ ] IN/OUT و Daily/Entry Logs/Reports
- [ ] Backup schedule/manual/verify
- [ ] Upgrade بدون از دست‌رفتن داده
- [ ] Uninstall/reinstall policy
- [ ] Offline/local operation

### 18.3 Pilot مشتری

- [ ] Scope کتبی مشتری با این سند تطبیق شود.
- [ ] License mode، مدت دقیق، warning/grace، offline allowance، assurance و مسئول Renewal مشتری ثبت شود.
- [ ] تعداد کارمندان، شیفت‌ها، K40ها و کاربران سیستم ثبت شود.
- [ ] تعطیلات/مرخصی/Auto-checkout/Door expectations دوباره تأیید شوند.
- [ ] Backup location و مسئول آن مشخص شود.
- [ ] Pilot محدود با دادهٔ واقعی اجرا شود.
- [ ] حداقل یک چرخهٔ کامل روز کاری و یک گزارش دوره‌ای تأیید شود.
- [ ] خطاها و درخواست‌های خارج Scope جدا ثبت شوند.
- [ ] Sign-off تحویل نسخهٔ Attendance ثبت شود.

## 19. ترتیب اجرایی و Gateهای Commit

### 19.0 ترتیب و Dependency اجباری

| Phase | پیش‌نیاز | قاعدهٔ Fail-closed |
| --- | --- | --- |
| 1 — Foundation | Phase 0 | فقط Consumerهایی فعال شوند که Capability و safety gate آن‌ها کامل است |
| 2 — Staff/Time Clock | تمام Gateهای Phase 1 (`1.1` تا `1.8`) | Employee/Attendance/Device تا پایان این Phase در Attendance deploy نشوند |
| 3 — Frontend Surface | Backend gateهای Phase 2 | UI فقط قراردادهای Staff-only آماده را مصرف کند |
| 4 — Dashboard/Reports | Phase 2 و Route/Auth foundation Phase 3 | هیچ KPI/Export مختلط موقتاً نمایش داده نشود |
| 5 — Operations/Recovery | Phase 1 startup gating و Phaseهای 2 تا 4 | Audit/Backup/Job فقط پس از isolation خودشان فعال شوند |
| 6 — Build/Installer | Phaseهای 1 تا 5 و Decision Gate 18.0 | Artifact ناقص Attendance تولید یا نصب نشود |
| 7 — Pilot/Release | Clean-machine Gate Phase 6 | Pilot فقط روی Artifact امضاشدهٔ همان source/version انجام شود |

Featureهای `[OPTIONAL]` جزو مسیر اجباری v1 نیستند. اگر مشتری پیش از Release یکی را درخواست کرد، Scope Change ثبت و Gate کامل همان Feature پیش از فعال‌سازی اجرا می‌شود.

### Phase 0 — Scope و سند

- [x] ممیزی کامل Frontend routes/pages/API clients انجام شد.
- [x] ممیزی کامل Backend routes/services/models/jobs انجام شد.
- [x] گزارش‌ها، Dashboard، Inbox، Sound، Audit و Backup طبقه‌بندی شدند.
- [x] تصمیم یک کدبیس و دو Edition ثبت شد.
- [x] این چک‌لیست مرجع ساخته شد.
- [x] ممیزی اجرایی 2026-08-04 انجام؛ قرارداد قطعی Phase 1 و پیشنهادهای Route/Auth/Fail-closed/Role/config همراه Decision deadline صریح ثبت شدند.

Gate: سند از README و Project Checklist قابل دسترسی باشد، Evidence Commit قبلی ثبت شده باشد و هیچ تصمیم باز بدون deadline باقی نماند.

### Phase 1 — Edition و Capability Foundation

#### [x] 1.1 — `APP_EDITION` validation

Implementation:

- [x] در `server/src/config/env.ts` مقدار case-sensitive `APP_EDITION` با enum دقیق `FULL|ATTENDANCE` و default برابر `FULL` اضافه شود.
- [x] parser تست‌پذیر از `process.env` جدا و type `AppEdition` از همان schema استخراج شود؛ startup همچنان config واقعی را یک‌بار parse کند.
- [x] `APP_EDITION=FULL` همراه توضیح دو مقدار مجاز و هشدار «ATTENDANCE تا Gate 1.6 قابل Startup نیست» به `server/.env.example` اضافه شود؛ `server/.env` محلی تغییر نکند.
- [x] Guard کوچک و تست‌پذیر قبل از `createApp/listen/jobs` در bootstrap اصلی، اجرای واقعی `APP_EDITION=ATTENDANCE` را تا پایان 1.6 با خطای واضح متوقف کند؛ config parser همچنان `ATTENDANCE` را مقدار معتبر برگرداند.
- [x] تغییرهای application/runtime این Commit فقط به config و Guard موقت bootstrap محدود باشد؛ test file، `server/package.json`, `.env.example` و دو Checklist نیز مجازند و هیچ Capability، Route، Permission، Job، DB schema یا Frontend behavior FULL تغییر نکند.

Verification:

- [x] تست مستقل `test:edition-config` با child process ماژول compiled `config/env` را import کند، `DATABASE_URL` تستی امن بدهد و حالت env حذف‌شده→`FULL`، `FULL`، `ATTENDANCE` و مقدار خالی/lowercase/ناشناخته→exit غیرصفر را پوشش دهد.
- [x] `npm.cmd run test:edition-config`, `npm.cmd run typecheck` و `npm.cmd run build` در `server` پاس شوند.
- [x] child-process bootstrap test ثابت کند `FULL` از Guard عبور می‌کند، `ATTENDANCE` پیش از createApp/listen/job با پیام مشخص متوقف می‌شود و config نامعتبر نیز پیش از bootstrap رد می‌شود؛ هیچ Port/DB connection/Device/Job واقعی در harness شروع نشود.

Gate 1.1: فقط runtime config parsing، Guard موقت Attendance و harness آن تغییر کاربردی کرده باشند، FULL بدون تغییر بماند و Evidence/هر دو Checklist به‌روز شوند.

#### [x] 1.2 — Registry و Capability Matrix مرکزی

Implementation:

- [x] Registry typed در `server/src/config/capabilities.ts` تمام نام‌های جدول 2.4، Edition target، optional بودن و activation gate را تعریف کند.
- [x] helperهای pure برای target/effective features، Feature check و خروجی مرتب/بدون تکرار ساخته شوند.
- [x] `FULL` تمام رفتارهای موجود را حفظ کند؛ `ATTENDANCE` فقط Featureهای target و code-ready را برگرداند و Optionalها پیش‌فرض false باشند.
- [x] هیچ Route/Job/UI در این آیتم هنوز به Registry وصل نشود.

Verification:

- [x] `test:capabilities` ماتریس دقیق FULL/ATTENDANCE، optional=false، code-ready gate، عدم فعال‌سازی Excluded و immutability را پوشش دهد.
- [x] `npm.cmd run test:capabilities`, typecheck و build پاس شوند.

Gate 1.2: Capability contract pure، مرکزی و تست‌شده باشد و معرفی آن به‌تنهایی رفتار FULL را تغییر ندهد.

#### [x] 1.3 — Effective Permission intersection

Implementation:

- [x] Capability-to-permission allowlist مرکزی ساخته و پس از Role rows و per-user overrides اعمال شود.
- [x] stale Role row و per-user `ALLOW` نتوانند Permission متعلق به Feature خاموش را برگردانند.
- [x] `DENY` کاربر همچنان بعد از Edition filtering مؤثر بماند.
- [x] Phase 1.3 فقط enumهای موجود را استفاده کند؛ `FINANCIAL_EXPORT` را deny کند و `ATTENDANCE_EXPORT` را تا کار 4.3 وارد typed runtime map نکند.

Verification:

- [x] تست Owner، Role معمولی، stale row، `ALLOW` و `DENY` را در هر دو Edition پوشش دهد.
- [x] Auth payload و middleware از همان Permission مؤثر استفاده کنند و اختلافی بین UI/API ایجاد نشود.

Gate 1.3: Feature خاموش حتی برای Owner/Vendor و override دستی قابل دورزدن نباشد؛ پیش از ارائهٔ Auth payload حاضری، Permission intersection آماده باشد.

#### [x] 1.4 — API identity و Auth contract

Implementation:

- [x] `GET /api` مقدار `name`, `version`, `edition` معتبر بدهد.
- [x] پاسخ‌های موفق Setup/Login/Me قرارداد یکسان بخش 2.7 را بدهند.
- [x] `features` فقط Featureهای مؤثر Process و `permissions` فقط خروجی تست‌شدهٔ 1.3 باشند.
- [x] تنها پس از پاس‌شدن این Gate، `AUTH` به code-ready allowlist Attendance افزوده شود.

Verification:

- [x] تست API قرارداد دقیق `/api`, setup, login و me را برای FULL و ATTENDANCE و session موجود پوشش دهد.
- [x] هیچ Password hash، Feature خاموش یا Permission حذف‌شده در payload نباشد.

Gate 1.4: Auth response contract نسخه‌دار و سازگار باشد، Permission خام legacy افشا نشود و Client behavior هنوز تا 1.7 تغییر نکند.

#### [x] 1.5 — HTTP Route registration و پاسخ 404

Implementation:

- [x] `registerRoutes` هر Router را با Capability متناظر ثبت کند.
- [x] Mountهای `app.ts` شامل `/iclock`، raw parser و `/api/v1/devices/push-test` نیز زیر همان policy بروند.
- [x] ترتیب health/auth، restore-maintenance، business routes، not-found و error handler حفظ شود.
- [x] Consumer required ولی code-not-ready در Attendance ثبت نشود؛ FULL همان inventory فعلی را حفظ کند.

Verification:

- [x] تست Route inventory برای FULL و ATTENDANCE وجود داشته باشد.
- [x] Routeهای خاموش پاسخ عمومی یکسان 404 بدهند؛ Route روشن بدون Auth/Permission پاسخ 401/403 مناسب بدهد.

Gate 1.5: هیچ HTTP entry point خارج از Capability boundary نماند و FULL route inventory تغییر ناخواسته نکند.

#### [x] 1.6 — Startup consumer gating

Implementation:

- [x] Bootstrap اصلی در `bootstrap.ts` (با wrapper بدون تغییر `index.ts`) برای Device manager، Inbox scheduler، Inbox WebSocket و Backup scheduler از Registry واحد استفاده کند.
- [x] Feature خاموش timer، socket handler، device connection یا DB query شروع نکند.
- [x] Restore maintenance و shutdown/error behavior فعلی حفظ شود؛ این Gate فقط رفتار موجود را Regression می‌کند و hardening جدید Jobهای maintenance همچنان متعلق به Phase 5.1 است.
- [x] پس از پاس‌شدن HTTP/startup boundary tests، Guard موقت 1.1 برداشته شود و Attendance بتواند فقط با `AUTH` و Consumerهای code-ready Startup شود.
- [x] هم‌زمان با برداشتن Guard، هشدار موقت «ATTENDANCE تا Gate 1.6 قابل Startup نیست» از `server/.env.example` حذف یا به وضعیت نهایی و دقیق Startup تبدیل شود.

Verification:

- [x] تست bootstrap با spy ثابت کند هر Consumer در FULL یک‌بار و در Attendance فقط پس از code-ready/Feature gate شروع می‌شود.
- [x] در Attendance فعلی، Optional default مربوط به Inbox و `BACKUPS`/`DEVICES` not-ready هیچ load یا side effect ایجاد نکنند؛ تست با `APP_FEATURE_INBOX=0` اجرا شود و `FULL` legacy همچنان Inbox را روشن نگه دارد.
- [x] Attendance bootstrap پس از برداشتن Guard با `features=[AUTH]` بالا بیاید و هیچ Consumer business آماده‌نشده‌ای را شروع نکند.

Gate 1.6: HTTP و non-HTTP consumerها هر دو Fail-closed باشند.

#### [x] 1.7 — Frontend Auth state foundation

Implementation:

- [x] typeهای Client برای `edition` و `features` اضافه و Login/Setup/Me بدون refresh پنهان normalize شوند.
- [x] helperهای `hasFeature` و `hasPermission` جدا باشند؛ business Route/Nav refactor به Phase 3 موکول شود.
- [x] bootstrap هویت عمومی `/api` را برای Edition/version mismatch دریافت کند و خطای ناسازگاری واضح بدهد.

Verification:

- [x] unit/component test Auth state هر سه پاسخ، logout، Retry/fail-closed، race پاسخ stale، حالت موفق هر دو Edition و mismatch را پوشش دهد.
- [x] build و lint Client پاس شوند و رفتار FULL موجود حفظ شود.

Gate 1.7: Client قرارداد را می‌فهمد، اما هنوز هیچ پنهان‌سازی UI به‌عنوان security claim ثبت نمی‌شود.

#### [x] 1.8 — Phase 1 regression matrix

- [x] suite واحد `test:edition-boundary` config/auth/permission/route/startup و Auth state کلاینت را پوشش دهد؛ هر boundary suite در Process تازه اجرا شود و ماتریس هر دو Edition در suiteهای مربوط بررسی گردد.
- [x] FULL تمام Routeها و startup consumerهای فعلی مورد انتظار را حفظ کند.
- [x] Attendance فقط Featureهای code-ready را اعلام/فعال کند و تمام Excluded/not-readyها 404/no-side-effect باشند.
- [x] Backend typecheck/build و تست‌های مرتبط Auth/Route پاس شوند؛ Client typecheck/build/lint پاس شوند.

Commit Gate Phase 1: تمام Gateهای 1.1 تا 1.8 پاس باشند؛ هنوز business UI refactor یا Staff data transformation مخلوط نشده باشد. `APP_EDITION=ATTENDANCE` تا پایان Phaseهای ایزولیشن، Artifact قابل انتشار محسوب نمی‌شود.

### Phase 2 — Staff Isolation و Time Clock

- [x] 2.1 `/api/v1/employees` و Staff projection طبق بخش‌های 4 و 7.2 بدون physical DELETE پیاده‌سازی و `/members` در Attendance بسته شود.
- [x] 2.2 Attendance/manual/justification/report طبق بخش 7.3 در Service boundary Staff-only شوند.
- [x] 2.3 Device sync/enroll/ingestion طبق بخش‌های 9 و 10 Customer را رد و Staff-only شود؛ پیش از code-ready شدن `DEVICES`، moduleهای Core از Diagnostics/Door/Push فیزیکی جدا شوند تا Feature اختیاری خاموش import یا Router construction نداشته باشد.
- [x] 2.4 `ATTENDANCE_POLICY=TIME_CLOCK`، outside-shift recording و جدایی `attendanceRecorded`/`doorAllowed` پیاده‌سازی شوند.
- [x] 2.5 `ATTENDANCE_AUTO_CHECKOUT_ENABLED=0|1` با default `0` و no-synthetic-OUT regression مستقل از Inbox پیاده‌سازی/تست شد؛ `1` در Attendance v1 رزرو و non-operational و legacy `FULL` حفظ است.
- [x] 2.6 تست‌های خودکار Staff isolation و سناریوهای بخش‌های 17.2/17.3 با fixture واحد Daily/Report پاس شدند؛ بخش‌های Dashboard/Optional که هنوز Mount نیستند در Gateهای صاحب Feature دوباره تست می‌شوند.
- [x] 2.7 K40 regression خودکار، integration واقعی PostgreSQL و چک‌لیست دستگاه واقعی بخش 10.3 پاس و Evidence تطبیق RawLog→Report ثبت شد.

Commit Gate: هیچ Customer ID از API/Device/Report Attendance عبور نکند، FULL سالم باشد و تعداد marker mismatchهای حل‌نشده صفر باشد؛ تا آن زمان هیچ Feature Phase 2 به code-ready منتقل نشود.

وضعیت Commit Gate Phase 2: `[x]` — strict Customer/unknown/inactive integration صفر Attendance/Door/Inbox/Violation، FULL K40 regression سالم، mismatch inventory واقعی صفر و fixture cleanup صفر است. این Gate فقط backend isolation Phase 2 را می‌بندد و Capability/Route/UI را پیش از Gateهای مالک آن‌ها فعال نمی‌کند.

### Phase 3 — Frontend Attendance Surface

- [x] 3.1 Route Manifest واحد و `RequireFeature` طبق بخش 3.1 ساخته شدند.
- [x] 3.2 Navigation/Settings/Header/Breadcrumb/redirect و Add shortcut از همان Manifest استفاده می‌کنند؛ metadata مسیر خاموش با Permission قدیمی نیز نمایش داده نمی‌شود.
- [x] 3.3 Employees list/add/detail/edit طبق بخش 4 فقط Staff DTO/API مصرف کنند.
- [x] 3.4 Daily Attendance و Entry Logs طبق بخش 5 هیچ Customer/Finance request یا copy نداشته باشند.
- [x] 3.5 Devices Core/Advanced split و Feature/Permission ابزارهای خطرناک اعمال شود.
- [x] 3.6 Role mapping جدول 8.1 و branding پایه در UI اعمال شود؛ slot هدف `ATTENDANCE_EXPORT` تا تکمیل 4.3 نمایش/ارسال نشود.
- [x] 3.7 Direct URL، Network assertion، سه زبان و Light/Dark smoke مربوط به این Phase پاس شدند.

Commit Gate: Direct URL و Network assertions پاس شوند؛ Build FULL Regression شود.

### Phase 4 — Dashboard و Reports

- [x] 4.1 Dashboard API/UI طبق بخش 6.1 Staff-only و بدون Query مالی شد؛ module graph و service حاضری نیز از Customer/Financial branch فیزیکی جدا شدند.
- [x] 4.2 Attendance report API/UI طبق بخش 6.2 Staff-only شد؛ read routeها و download/export handlerها مالکیت جدا دارند و export تا تکمیل 4.3 Fail-closed مانده است.
- [x] 4.3 `ATTENDANCE_EXPORT` به Prisma enum/migration/seed/Auth/UI افزوده و از Permission مالی جدا شد.
- [x] 4.4 Entry Logs CSV/XLSX کامل سمت Server و مستقل از صفحهٔ فعلی ساخته شد.
- [x] 4.5 Monthly Timecard طبق بخش 6.3 با totals قابل تطبیق و CSV/XLSX/PDF ساخته شد.
- [x] 4.6 Export Audit/row count/Actor، branding و سه زبان تکمیل شود.
- [x] 4.7 DB fixture، export parsers و E2E بخش 17.4 پاس شوند.

Commit Gate: KPIها و Exportها با DB fixture و سه زبان تطبیق کنند.

### Phase 5 — Operations و Recovery

- [x] 5.1 Startup gating اجباری بخش 11.1 با Restore maintenance regression تکمیل شد.
- [x] 5.2 Audit filtering/redaction بخش 13 برای دادهٔ تاریخی FULL تکمیل شد.
- [x] 5.3 Backup edition compatibility و Hardening الزامی بخش‌های 14.1 و 14.5 تکمیل شد؛ assertion نهایی Restore دادهٔ FULL زیر Runtime Attendance متعلق به suite مرحلهٔ 5.4 باقی ماند.
- [x] 5.4 Full-backup-to-attendance isolation suite بخش 17.6 پاس شد.
- [x] 5.5 Timezone/policy/config خارجی بخش 12 و عدم تغییر آن پس از Restore تست شد.
- [x] 5.6 absence tests ثابت کنند تمام Optionalهای انتخاب‌نشده Flag/Feature/Route/Job/WebSocket/request/chunk فعال ندارند.
- [x] 5.7 FULL operations/backup regression مرتبط پاس شد.

Commit Gate: Restore و startup هیچ Feature یا دادهٔ پنهان را فعال نکند.

### Work package میان‌مرحله‌ای `UI-1` — Shared Visual System دو Edition

این Work Package مشکل کشف‌شدهٔ Shell و styling موازی را بدون بازکردن Scope Backend اصلاح می‌کند. ترتیب، معماری، baseline، rollback و Gateهای کامل در [طرح یکسان‌سازی رابط کاربری](../ui/EDITION_UI_UNIFICATION_PLAN.md) مرجع است.

- [x] `UI-1.0` علت ریشه‌ای و Baseline فعلی ثبت شد: Worktree روی `d2f98c9` تمیز؛ Edition boundary برابر 36/36، component/browser برابر 37/37 و Attendance real-app برابر 12/12 پاس شدند.
- [x] `UI-1.1` Visual baseline و Screenshot regression برای Shell مرجع FULL ساخته و بازبینی شد: Desktop/Mobile، expanded/collapsed/settings، Dark/Light و LTR/RTL؛ focused برابر 5/5 و Gate کامل برابر 36/36، browser برابر 42/42 و real-app برابر 12/12 پاس شد؛ هیچ کد تولیدی تغییر نکرد.
- [x] `UI-1.2` `SharedAppShell` بدون تغییر ظاهر FULL استخراج شد؛ Brand از `PRODUCT_BRAND` می‌آید و side effectهای Inbox/Sound/WebSocket در `FullShellAdapter` باقی ماندند؛ Visual برابر 5/5، Navigation برابر 4/4 و Gate کامل برابر 36/36 با browser برابر 42/42 و real-app برابر 12/12 پاس شد.
- [x] `UI-1.3` Attendance با `AttendanceShellAdapter` به `SharedAppShell` مهاجرت کرد؛ Shell/copy موازی حذف شد؛ route/API/business scope ثابت ماند؛ Visualهای FULL برابر 5/5 و Attendance برابر 4/4، build isolation، Gate کامل 36/36، browser برابر 42/42 و Attendance real-app برابر 16/16 پاس شدند.
- [x] `UI-1.4` primitiveها و tokenهای مشترک inventory و تکمیل شدند؛ موجودها reuse و خلأهای عمومی ساخته شدند؛ سه baseline بصری و interaction/accessibility suite برابر 4/4، FULL visual برابر 5/5، Attendance visual برابر 4/4، Gate کامل برابر 36/36 با browser برابر 46/46 و real-app برابر 16/16 پاس شدند.
- [x] `UI-1.5` صفحه‌های Attendance به ترتیب مصوب و بدون تغییر API/data/permission/business semantics به Design System مشترک مهاجرت کنند.
  - [x] `UI-1.5.1` Attendance Dashboard با primitiveهای مشترک header/button/summary/status/error/table و tokenهای semantic مهاجرت کرد؛ شش حالت تصویری Desktop/Mobile، Dark/Light، LTR/RTL، empty/error/loading بازبینی شد؛ retry و API/Permission ثابت ماند؛ focused برابر 6/6 و Gate جامع برابر 36/36 با browser 46/46 و real-app 22/22 پاس شد.
  - [x] `UI-1.5.2` Employees list/add/detail/edit با primitiveها و tokenهای مشترک مهاجرت کرد؛ هشت حالت تصویری شامل Desktop/Mobile، Dark/Light، LTR/RTL، empty/error/loading و Detail/Add/Edit بازبینی شد؛ Employee facade، payloadها، Permissionها و Staff-only semantics ثابت ماند؛ focused visual برابر 8/8، behavior برابر 5/5 و Gate جامع برابر 36/36 با browser 46/46 و real-app 30/30 پاس شد.
  - [x] `UI-1.5.3` Daily Attendance با primitiveها و tokenهای مشترک مهاجرت کرد؛ هفت حالت تصویری Desktop/Mobile، Dark/Light، LTR/RTL، empty/error/loading و Justification modal بازبینی شد؛ Staff Daily endpoint، queryها، payload/lifecycle توجیه، Permissionها و Staff-only semantics ثابت ماند؛ focused visual برابر 7/7، behavior برابر 5/5 و Gate جامع برابر 36/36 با browser 46/46 و real-app 37/37 پاس شد.
  - [x] `UI-1.5.4` Entry Logs با primitiveها و tokenهای مشترک مهاجرت کرد؛ هفت حالت تصویری Desktop/Mobile، Dark/Light، LTR/RTL، empty/error/loading و Manual Entry modal بازبینی شد؛ endpointها، queryها، exportها، payload ثبت دستی، Permissionها و Staff-only semantics ثابت ماند؛ focused visual برابر 7/7، behavior برابر 5/5 و Gate جامع برابر 36/36 با browser 46/46 و real-app 44/44 پاس شد.
  - [x] `UI-1.5.5` Attendance Report و Monthly Timecard از نظر presentation به primitiveها و tokenهای مشترک مهاجرت کردند؛ ده حالت تصویری شامل Desktop/Mobile، Dark/Light، LTR/RTL، filter، tabها، empty/error/loading و Timecard عادی/expanded بازبینی شد؛ endpointها، queryها، exportها، filenameها، Permissionها و Staff-only semantics ثابت ماند؛ focused visual برابر 10/10، قرارداد Phase 3–7 برابر 12/12 و Gate جامع برابر 36/36 با browser 46/46 و real-app 54/54 پاس شد.
  - [x] `UI-1.5.6` Devices Core از نظر presentation به primitiveها و tokenهای مشترک مهاجرت کرد؛ هشت حالت تصویری شامل Desktop/Mobile، Dark/Light، LTR/RTL، empty/error/loading و Add/Employee Tools modal بازبینی شد؛ Core endpointها، queryها، payload اجباری K40 Pull، Permissionها و Staff-only semantics ثابت ماند و Advanced surface همچنان غایب است؛ focused visual برابر 8/8، behavior برابر 4/4 و Gate جامع برابر 36/36 با browser 46/46 و real-app 62/62 پاس شد.
  - [x] `UI-1.5.7` Admin Users، Audit Logs و Backups فقط از نظر presentation مهاجرت کردند؛ هشت حالت تصویری شامل Desktop/Mobile، Dark/Light، LTR/RTL، Admin edit، Audit redacted detail و Backup dashboard بازبینی شد؛ Admin role/API، Audit read-only/filter/redaction و Backup/Restore semantics ثابت ماند؛ focused visual برابر 8/8، Admin behavior برابر 3/3، Audit behavior برابر 5/5 و Gate جامع برابر 36/36 با browser 46/46 و real-app 70/70 پاس شد.
- [x] `UI-1.6` پذیرش نهایی با Edition boundary، Visual matrix، artifact scan و build/verify هر دو Edition روی Node دقیق `24.19.0` پاس شد؛ Edition برابر 36/36، browser/FULL برابر 46/46 و Attendance real-app برابر 70/70 است؛ manifestهای FULL/ATTENDANCE به‌ترتیب `98422a…527a9` و `2f5364…780cc` تأیید شدند.

Gate هر Commit: تغییر `server/**`، Prisma، Database، Licensing، Guardian، Installer، Device processing، Permission، Capability یا API خارج Scope است؛ FULL visual regression و Attendance build isolation باید سبز بمانند.

### Work packageهای `O.x` — O.2 انتخاب‌شده؛ سایر Optionalها خارج مسیر اجباری v1

- [OPTIONAL] `O.1 ATTENDANCE_COMPLIANCE`: Scope Change، اصلاح کامل بخش 6.4، افزودن/تست `APP_FEATURE_ATTENDANCE_COMPLIANCE` و سپس انتقال code-ready انجام شود.
- [~] `O.2 INBOX` — انتخاب‌شده در 2026-10-03: O.2.1 تا O.2.5 و تمام Gateهای خودکار O.2.6 شامل Browser/API/PostgreSQL/restore/dedupe/retention/FULL regression کامل شد؛ فقط acceptance فیزیکی K40 در O.2.6 و سپس انتقال نهایی code-ready/config تحویلی O.2.7 باقی است.
- [OPTIONAL] `O.3 SOUNDS`: Scope Change، Staff-only event policy، مرورگر/Installer QA، افزودن/تست `APP_FEATURE_SOUNDS` و سپس انتقال code-ready انجام شود.
- [OPTIONAL] `O.4 DEVICE_DIAGNOSTICS`: Scope Change، Technician/Vendor role gate، RawLog/support redaction، K40 safety QA، افزودن/تست `APP_FEATURE_DEVICE_DIAGNOSTICS` و سپس انتقال code-ready انجام شود.
- [OPTIONAL] `O.5 DOOR_CONTROL`: Scope Change و سیاست کتبی مشتری، Permission مستقل، جدایی attendance/door، real-device safety/no-call regression، افزودن/تست `APP_FEATURE_DOOR_CONTROL` و سپس انتقال code-ready انجام شود.

Gate هر `O.x`: Feature در حالت Flag=0 هیچ side effect یا chunk قابل استفاده نداشته باشد؛ در Flag=1 فقط پس از تمام تست‌های همان ردیف code-ready شود و FULL regression پاس بماند.

### Phase 6 — Build و Installer

- [x] 6.0 تمام تصمیم‌های بخش 18.0 در `PACKAGING_DECISIONS.md` ثبت و تأیید شدند.
- [x] 6.1 `version.json` مرجع واحد، build manifest/hash نسخه‌دار، سازگاری Node 24 و `build:full` / `build:attendance` مستقل و قابل تکرار با Edition/version metadata سازگار ساخته و تست شدند؛ authenticity/signing، حذف فیزیکی moduleهای Server و Clean-Windows عمداً در 6.3/6.4/6.6 باقی‌اند.
- [~] 6.2: LIC-6.2-004 pure state model is complete under LIC-EV-0016 after independent review and Reactivation collision remediation: 59/59 projection, 31/31 model, 27/27 security tests (18 owned STATE descriptors), plus Core/Protocol/Golden regression. LIC-6.2-005 portable trusted-time remediation is complete under LIC-EV-0026 after Product approvals LIC-CHG-0016/0017 and independent time_design_review remediation/rerun: Time 39/39, lifecycle 36/36, availability/repair 16/16, State 117/117 and Core/Protocol/Golden pass. Observed calendar is separate from the corroborated floor; future grants require corroboration, normal reboot/downtime alone does not lock, and signed repair preserves independent locks. LIC005 closure is committed as e49630a. LIC006 Offline workflows remain in progress: bounded import planning is committed as 7435dc8 (38/38). ACTIVATE/RENEW request work is committed as 67f9867 (LIC-EV-0030, 44/44). Entitlement completion/CAS acknowledgement passes36/36 under LIC-EV-0033 (import38/request44 and Core/State/Time/Protocol/Golden pass), with the fixed duplicate-request correlation failure retained in EV0032. Entitlement/Control checkpoint is committed as6c9fb09. RECOVER request/completion is committed as97a6d02 (LIC-EV-0038,36/36). REBIND is committed as91b4771 (LIC-EV-0041,40/40). TIME_CORRECT is committed as9703e13 (LIC-EV-0043,32/32). REACTIVATE request/two-artifact completion passes28/28 under LIC-EV-0045 (committed as c975958), with prior portable/crypto gates passing; real protected persistence, safe filesystem intake/export, durable reconciliation and independent closure review remain open; EV0047 records the remaining-obligations source audit and ten planned (not executed) safe-file/durable-adapter acceptance cases; portable selected-file orchestration passes16/16 fake-adapter cases under LIC-EV-0049 (committed as c975958), with prior portable/crypto gates passing; one-pass file-to-completion integration passes the expanded32-case file suite under LIC-EV-0051 (committed as c975958), with prior portable/crypto regressions passing; LIC-EV-0054 adds96/96 six-intent file completion cases (committed as c97eb29) with all prior portable/crypto regressions passing; LIC-EV-0055 completes independent review of c97eb29 with no reproducible blocking finding,8/8 additional probes and aggregate rerun passing; see LICENSING_OFFLINE_REVIEW.md; LIC007 request/registration is committed10d09f7 and primary-Lease response is committed14ddebf; control-only dispatch is committedbc7aecb. Atomic Lease+Control composition is committed e88d0ca and limited independent review is complete under LIC-EV-0074 (28/28 independent probes and aggregate pass); review committedec2fbf3. Subsequent trust-only CHECK_IN preparation/CAS passes44/44 cases and aggregate/Golden regressions (EV0077); trust-only checkpoint committed6f7b411. Subsequent coordinated trust plus Lease/optional Control handoff passes44/44 cases and aggregate/Golden regressions (EV0080); independent review of committed53a7d74 passes28/28 (26 acceptance checks plus2 clock diagnostics), with no blocking portable finding. Failed clock/trust evaluation must block future runtime admission; Hybrid Reactivation request targeting and three-artifact completion now pass48/48 both-Edition cases and all aggregate/Golden regressions under EV0087. The new Entitlement stays a separate signed input because the frozen response carrier has no Entitlement slot. Mixed trust/Control variants and TIME_RECOVERY stay closed; targeted review of the new core helper and transport/runtime/protected Store integration remain open. Failed clock/trust evaluation still must block future runtime admission. LIC008 Windows feasibility remains in progress: EV0126/0130/0132/0135 record Software-KSP host controls, filtered-admin interactive contrast, normal reboot and binary Repair simulation. CHG0067/EV0136 selects the bounded Upgrade plan, implementation/build/run NOT_RUN. Real file/protected Store, TPM, separate standard account and full Windows acceptance remain outstanding under existing dependencies. Persistent storage, runtime admission, Guardian and Windows release evidence remain open.
- [ ] 6.3 conditional chunks، نبود issuer/private key در Artifact مشتری، bundle scan و branding/language کامل بخش 15 پاس و secret scan پس از Packaging دوباره اجرا شود.
- [ ] 6.4 Guardian/App Windows serviceهای جدا، one-shot LocalSystem Setup helper و Installer با purpose-scoped secrets، proxy/named-pipe، elevated recovery CLI و Guardian-executed Emergency Backup و startup/restart/integrity/recovery/repair/uninstall policy ساخته شوند.
- [ ] 6.5 PostgreSQL tools، migration، ProgramData config/license-state/log/backup و ACL دقیق Guardian/App/Database Service SID پیاده و تست شوند.
- [ ] 6.6 Gate تجمعی Licensing و Clean-machine matrix بخش 18.2 شامل install/reboot/upgrade/offline/K40/Backup/License/repair/uninstall پاس شود.

Commit Gate: Installer قابل تکرار و داده پس از restart/upgrade سالم باشد.

### Phase 7 — Pilot و Release

- [ ] 7.1 Customer scope و تصمیم تعطیلات/مرخصی/Auto-checkout/Door کتبی تأیید شود؛ برای Licensing نیز Mode، مدت دقیق، warning/grace، offline allowance و assurance همان مشتری در Entitlement/تحویل ثبت شود.
- [ ] 7.2 Real K40 pilot با تعداد ثبت‌شدهٔ Employee/Shift/Device/User اجرا شود.
- [ ] 7.3 حداقل یک Daily close workflow کامل با exception correction تأیید شود.
- [ ] 7.4 Period report/timecard/export با دادهٔ واقعی تطبیق و تأیید شود.
- [ ] 7.5 Backup/recovery ownership، schedule، restore-test و handoff ثبت شود.
- [ ] 7.6 Sign-off، known limitations و Release notes همان version ثبت شوند.

Release Gate: تمام موارد «تعریف Done» زیر پاس باشند.

## 20. تعریف Done برای Attendance Edition v1

- [ ] هیچ Route، صفحه، API request یا Chunk مربوط به Customer/Membership/Finance/Payroll/Expense در Artifact حاضری قابل استفاده نیست.
- [ ] تمام Employee/Attendance/Report/Device workflows در Server به Staff محدود هستند.
- [ ] K40 Punch خارج شیفت ثبت و به‌عنوان استثنا طبقه‌بندی می‌شود.
- [ ] Door و Auto-checkout پیش‌فرض خاموش‌اند.
- [ ] Daily، Entry Logs، Attendance Report و Monthly Timecard با خروجی کامل کار می‌کنند.
- [ ] Backup/restore و Full-backup isolation پاس شده‌اند.
- [ ] FULL edition تمام Regressionهای موجود را پاس می‌کند.
- [ ] Build/Installer روی Windows پاک تست شده است.
- [ ] سه زبان و RTL/LTR تست شده‌اند.
- [ ] Scope خارج v1 به مشتری اعلام شده است.
- [ ] Pilot واقعی و Sign-off مشتری ثبت شده است.

## 21. کارهایی که فعلاً نباید شروع شوند

- `[BLOCKED]` حذف فیزیکی Customer/Membership/Finance code یا جدول‌ها
- `[BLOCKED]` ساخت Prisma schema یا Repository fork جدا
- `[BLOCKED]` شروع UI-only hiding قبل از Server capability boundary
- `[BLOCKED]` فعال‌سازی `/iclock` بدون persistence/auth/device QA
- `[BLOCKED]` فعال‌سازی Generic Push یا Inbox WebSocket بدون Auth
- `[BLOCKED]` ادعای Multi-device عمومی قبل از اصلاح DeviceUser mapping
- `[BLOCKED]` فعال‌سازی Compliance قبل از اصلاح Group score و سیاست وزن‌ها
- `[BLOCKED]` ادعای Leave management یا Holiday calendar بدون پیاده‌سازی واقعی
- `[BLOCKED]` افزودن Payroll به Attendance v1 بدون Scope Change صریح
- `[BLOCKED]` ساخت Installer نهایی قبل از Edition/Staff isolation/Restore gates

## 22. Evidence Log

برای هر مرحله یک ردیف اضافه شود.

| Date | Phase/Item | Change | Verification command/manual test | Result | Commit |
| --- | --- | --- | --- | --- | --- |
| 2026-09-27 | Attendance redundant shared-header title removal | Stopped rendering the route breadcrumb/title block in ATTENDANCE while retaining header actions and the complete FULL route-header contract; stabilized the pre-existing Backup portal screenshot by pinning its scroll container | Refreshed complete Attendance real-app matrix = 80/80; final no-update matrix = 79/80 before deterministic Backup scroll stabilization; focused unstable checks passed 2/2 and Backup repeated 3/3; isolated final Attendance Shell/Settings = 13/13; FULL navigation/header contract = 4/4 on fresh port; lint; exact Node `24.19.0` ATTENDANCE/FULL build+verify; `git diff --check` | Passed — ATTENDANCE manifest `96673527…b5c8ec3`, FULL manifest `3b2dc8f6…9c242a7`; selected header block is absent from every Attendance route and retained in FULL. Three legacy FULL screenshots showed only existing anti-aliasing drift (~1%) and were intentionally not rewritten. No API/Server/Database/Prisma/Licensing/Guardian/Installer/Device/K40 change or execution | This Attendance-header polish commit |
| 2026-09-27 | Attendance Employees row density and Light-status contrast | Scoped the Employees table body to `12px`; added semantic `data-status` for Active/Blocked/Archived so existing Full-style Light contrast rules apply, plus an explicit Archived Light treatment | Employees visual/interaction with refreshed Dark/Mobile and new populated Light baseline = 14/14; immediate no-update rerun = 14/14; computed Contact/Staff group font and Active color assertions; direct populated Light visual review; lint; canonical ATTENDANCE build/verify on exact Node `24.19.0`; `git diff --check` | Passed — manifest `b2e1c59c…8f32192`; Contact, Staff group and Role are visually subordinate to the employee name and status text is readable in Light; no FULL/API/Server/Database/Prisma/Licensing/Guardian/Installer/Device/K40 change or execution | This Employees-table polish commit |
| 2026-09-27 | Attendance table-heading density standardization | Added an explicit Edition marker to the shared shell and scoped compact table-heading typography/spacing to ATTENDANCE only; row content and FULL styling remain unchanged | Attendance real-app visual/behavior matrix with refreshed baselines = 79/79; immediate no-update stability rerun = 79/79; Employees computed-style assertion confirms `10px`; canonical ATTENDANCE and FULL build/verify passed on exact Node `24.19.0`; `git diff --check` | Passed — ATTENDANCE manifest `c62534d9…11e4304`, FULL manifest `5b7ae57f…0d4c4c`; Employees, Daily, Entry Logs, Reports, Devices, Dashboard detail modal and Settings tables are covered; no API/Server/Database/Prisma/Licensing/Guardian/Installer/Device/K40 change or execution | This table-heading polish commit |
| 2026-09-27 | Attendance sidebar logo transparent-background correction | Replaced the black-background sidebar wordmark with a genuine RGBA transparent-background version; tightly framed it with a small transparent safety margin and retained the Attendance-only sidebar asset boundary | Direct alpha-channel and Light/Dark visual inspection; full Attendance real-app matrix with refreshed baselines = 79/79; focused shell/dashboard no-update run = 13/13; canonical ATTENDANCE build/verify passed on exact Node `24.19.0`; artifact alpha/presence check; `git diff --check` | Passed — manifest `9be1dba1f17d503352245752a92c730787654fc2460d3269a9fbb29b6e8eeeeb`; no black rectangle remains in Light or Dark sidebar; FULL/login/collapsed icon and all backend/business contracts remain unchanged | This transparent-logo correction commit |
| 2026-09-27 | Attendance sidebar primary-logo integration | Added the supplied Atlas Attendance wordmark as an Attendance-only sidebar brand asset; removed only the source image's empty outer margins; kept the square Attendance icon for the collapsed sidebar and existing login branding; added an optional shared-shell sidebar-logo contract and excluded the asset from FULL artifacts | Full Attendance real-app matrix with refreshed visual baselines = 79/79; focused shell/dashboard run without snapshot updates = 13/13; product-brand contract and client typecheck passed; canonical ATTENDANCE and FULL build/verify passed on exact Node `24.19.0`; direct artifact presence/isolation check; visual review in Dark/LTR and Light/RTL | Passed — ATTENDANCE manifest `1065d58bfb55f79785926c563a716f22d5ecf05e077f93ff5dd1c8b5402ccfd1`; FULL manifest `5c9bdfb826e537f6e74f2b901223548cf8013eb75acc0c822cbec0ebac801e38`; supplied artwork/colors remained intact; no backend, API, database, permission, device or K40 behavior changed | This sidebar-logo commit |
| 2026-09-27 | Attendance Dashboard chart-tooltip parity | Added the FULL Dashboard interactive SVG tooltip pattern to the Attendance trend chart: nearest-point pointer tracking, mouse leave, keyboard focus/blur, localized date, Present value, accessible point labels, and edge-clamped tooltip positioning | `npm.cmd run test:attendance-dashboard-visual` = 9/9; focused mouse/keyboard tooltip regression passed; canonical `build:attendance` and `verify:attendance` passed on exact Node `24.19.0`; `git diff --check` | Passed — manifest `139f206ee19b7590d61884321972fe53ee9e7dae8fa6f2cb28d1dcf93477440f`; frontend presentation/interaction only; summary data, API, permissions, backend, database, Prisma and device behavior remain unchanged | This chart-tooltip follow-up commit |
| 2026-09-27 | UI-1.7 — Real KPI detail tables | جایگزینی کارت‌های تکراری داخل modal با جدول واقعی Active/Present/Inside/Late/Absent؛ افزودن endpoint read-only و on-demand جزئیات با strict Staff scope و `ATTENDANCE_VIEW` | Server Dashboard test پاس؛ HTTP route-registry پاس؛ Dashboard visual/interaction برابر 8/8 با modalهای Dark/LTR و Light/RTL؛ Phase 4.1 برابر 2/2؛ client/server typecheck؛ lint با صفر error و چهار warning قدیمی؛ build/verify رسمی | Passed — manifest `2bfc95…944c15`؛ هیچ Customer/Membership/Finance داده یا capability وارد نشد؛ Database/Prisma/Licensing/Guardian/Installer/Device/K40 تغییر یا اجرا نشد | This KPI-detail follow-up commit |
| 2026-09-27 | UI-1.7 — Final Dashboard/Add Employee browser feedback | حذف content header تکراری Dashboard؛ افزودن modal همسان FULL برای هر پنج KPI؛ تبدیل Add Employee به wizard هفت‌مرحله‌ای هم‌ساخت Add Member با نوع قفل‌شدهٔ Staff | Dashboard visual/interaction برابر 7/7 و Phase 4.1 behavior/permission برابر 2/2؛ Employees visual برابر 9/9؛ Employee facade/payload behavior برابر 5/5؛ client typecheck و lint با صفر error و چهار warning قدیمی؛ `build:attendance` و `verify:attendance` روی Node دقیق `24.19.0` | Passed — manifest `4716b3…9929ef`؛ فقط frontend presentation/interaction تغییر کرد؛ endpoint یگانهٔ Dashboard و Employee facade/payload/permission/Staff-only boundary ثابت ماند؛ هیچ Backend/Database/Prisma/Licensing/Guardian/Installer/K40 یا دستگاه فیزیکی تغییر یا اجرا نشد | This UI-1.7 follow-up commit |
| 2026-09-27 | UI-1.6 — Final UI unification acceptance | پذیرش نهایی Shared Visual System و بسته‌شدن UI-1.0 تا UI-1.6؛ بدون تغییر کد تولیدی | Node portable رسمی دقیق `24.19.0` با SHA-256 `57f71a…f4c73`؛ `test:edition-boundary` برابر 36/36، browser/FULL برابر 46/46 و Attendance real-app برابر 70/70؛ `build:full`/`verify:full` و `build:attendance`/`verify:attendance` پاس؛ اسکن مستقیم release artifact پاس؛ بازبینی مستقیم FULL/Attendance Desktop/Mobile، Light/Dark، LTR/RTL و English/Dari/Pashto | Passed — FULL manifest `98422a…527a9` و ATTENDANCE manifest `2f5364…780cc`؛ artifact حاضری بدون Customer/Finance/Optional route/request/WebSocket/chunk/AtlasGym asset؛ هیچ Backend/API/Database/Prisma/Licensing/Guardian/Installer/K40 یا دستگاه فیزیکی تغییر یا اجرا نشد | This UI-1.6 acceptance commit |
| 2026-09-26 | UI-1.5.7 — Admin Users, Audit Logs and Backups presentation migration | مهاجرت Admin Users به header/button/table/status/error مشترک؛ مهاجرت header/action/summary/status/error در Audit و header/action در Backups با حفظ componentهای دامنه‌ای حساس؛ افزودن هشت baseline واقعی | focused visual بدون update برابر 8/8 و بازبینی مستقیم هشت Screenshot؛ Admin behavior برابر 3/3؛ Audit read-only/redaction برابر 5/5؛ اجرای نهایی `npm.cmd run test:edition-boundary` برابر 36/36 با browser/FULL برابر 46/46 و Attendance real-app برابر 70/70؛ production build و FULL/ATTENDANCE artifact isolation پاس | Passed — فقط presentation تغییر کرد؛ Admin role restrictions و Core API، Audit historical Edition filtering و recursive redaction، و Backup/Restore schedule/storage/external-copy/maintenance semantics ثابت ماند؛ هیچ Backend/Database/Prisma/Licensing/Guardian/Installer/K40 یا دستگاه فیزیکی تغییر یا اجرا نشد؛ `UI-1.5` برابر 7/7 کامل و قدم بعد `UI-1.6` است | This UI-1.5.7 commit |
| 2026-09-26 | UI-1.5.6 — Devices Core presentation migration | مهاجرت header/filter/status/state/table و Add/Edit/Employee Tools modal به primitiveها و tokenهای مشترک؛ حفظ card/runtime/event layout و افزودن هشت baseline با endpoint/loading/error/mobile/modal coverage | `npm.cmd run test:attendance-devices-visual` بدون update برابر 8/8 و بازبینی مستقیم هشت Screenshot؛ `npm.cmd run test:devices-ui -- --reporter=line` برابر 4/4؛ اجرای نهایی `npm.cmd run test:edition-boundary` برابر 36/36 با browser/FULL برابر 46/46 و Attendance real-app برابر 62/62؛ production build و FULL/ATTENDANCE artifact isolation پاس | Passed — تنها presentation تغییر کرد؛ Core Device/Employee endpointها، queryهای search/status/enabled، payload اجباری `FINGERPRINT + NETWORK + PULL`، routeها، Permissionهای `DEVICES_VIEW`/`SYSTEM_SETTINGS_MANAGE`/`DEVICES_USER_SYNC`/`DEVICES_ENROLL` و Staff-only semantics ثابت ماند؛ Advanced operations همچنان غایب و هیچ Backend/Database/Prisma/Licensing/Guardian/Installer/K40 یا دستگاه فیزیکی تغییر یا اجرا نشد؛ قدم بعد `UI-1.5.7` Admin Users، Audit Logs و Backups است | This UI-1.5.6 commit |
| 2026-09-26 | UI-1.5.5 — Attendance Report and Monthly Timecard presentation migration | مهاجرت shell/header/tab/error گزارش و Timecard table/status/pagination/month/export controls به primitiveها و tokenهای مشترک؛ reuse بدون fork از componentهای Report مشترک با FULL؛ افزودن ده baseline و endpoint/loading/error/tab/expanded coverage | `npm.cmd run test:attendance-report-visual` بدون update برابر 10/10 و بازبینی مستقیم ده Screenshot؛ `npm.cmd run test:attendance-phase-3-7 -- --reporter=line` برابر 12/12؛ اجرای نهایی `npm.cmd run test:edition-boundary` برابر 36/36 با browser/FULL برابر 46/46 و Attendance real-app برابر 54/54؛ production build و FULL/ATTENDANCE artifact isolation پاس | Passed — تنها presentation تغییر کرد؛ خانوادهٔ `/api/v1/reports/attendance/*`، queryهای filter/sort/month/page، Report و Timecard CSV/XLSX/PDF exportها، payload/filename، routeها، `ATTENDANCE_VIEW`/`ATTENDANCE_EXPORT` و Staff-only semantics ثابت ماند؛ هیچ Backend/Database/Prisma/Licensing/Guardian/Installer/K40 تغییر یا اجرا نشد؛ قدم بعد `UI-1.5.6` Devices Core است | This UI-1.5.5 commit |
| 2026-09-26 | UI-1.5.4 — Entry Logs presentation migration | جایگزینی header، filter، summary، status، error، table، pagination و Manual Entry modal محلی با primitiveها و tokenهای مشترک؛ افزودن هفت baseline و endpoint/loading/error/modal coverage | `npm.cmd run test:attendance-entry-logs-visual` برابر 7/7 و بازبینی مستقیم هفت Screenshot؛ `npm.cmd run test:attendance-ui` برابر 5/5؛ اجرای نهایی `npm.cmd run test:edition-boundary` برابر 36/36 با browser/FULL برابر 46/46 و Attendance real-app برابر 44/44؛ production build و FULL/ATTENDANCE artifact isolation پاس | Passed — تنها presentation تغییر کرد؛ `GET /api/v1/attendance`، Device/Employee options، queryهای filter، CSV/XLSX export، `POST /api/v1/attendance/manual`، payload/filename، routeها، `ATTENDANCE_VIEW`/`ATTENDANCE_EXPORT`/`ATTENDANCE_MANUAL` و Staff-only semantics ثابت ماند؛ هیچ Backend/Database/Prisma/Licensing/Guardian/Installer/K40 تغییر یا اجرا نشد؛ قدم بعد `UI-1.5.5` Attendance Report و Monthly Timecard است | This UI-1.5.4 commit |
| 2026-09-26 | UI-1.5.3 — Daily Attendance presentation migration | جایگزینی header، date actions، filter، summary، status، warning، error، table و Justification modal محلی با primitiveها و tokenهای مشترک؛ حفظ date navigation و exception layout به‌عنوان presentation؛ افزودن هفت baseline و endpoint/loading/error/modal coverage | `npm.cmd run test:attendance-daily-visual` بدون update برابر 7/7 و بازبینی مستقیم هفت Screenshot؛ `npm.cmd run test:attendance-ui` برابر 5/5؛ اجرای نهایی `npm.cmd run test:edition-boundary` برابر 36/36 با browser/FULL برابر 46/46 و Attendance real-app برابر 37/37؛ production build و FULL/ATTENDANCE artifact isolation پاس | Passed — تنها presentation تغییر کرد؛ `GET /api/v1/attendance/daily`، Staff Group options، queryهای date/search/group/shift/mode، `POST/DELETE /api/v1/attendance/justifications`، payloadها، routeها، `ATTENDANCE_VIEW`/`ATTENDANCE_JUSTIFY` و Staff-only semantics ثابت ماند؛ هیچ Backend/Database/Prisma/Licensing/Guardian/Installer/K40 تغییر یا اجرا نشد؛ قدم بعد `UI-1.5.4` Entry Logs است | This UI-1.5.3 commit |
| 2026-09-26 | UI-1.5.2 — Employees List/Add/Detail/Edit presentation migration | جایگزینی header، filter، table، status، pagination، error/action و styling محلی با primitiveها و tokenهای مشترک؛ حفظ panelهای domain-specific جزئیات و فرم؛ افزودن هشت baseline و endpoint/loading/error coverage | `npm.cmd run test:attendance-employees-visual` بدون update برابر 8/8 و بازبینی مستقیم هشت Screenshot؛ `npm.cmd run test:employees-ui` برابر 5/5؛ اجرای نهایی `npm.cmd run test:edition-boundary` برابر 36/36 با browser/FULL برابر 46/46 و Attendance real-app برابر 30/30؛ production build و FULL/ATTENDANCE isolation پاس | Passed — تنها presentation تغییر کرد؛ Employee facade endpoints، Create/Update payloadها، routeها، `MEMBERS_VIEW`/`MEMBERS_WRITE` و Staff-only semantics ثابت ماند؛ هیچ Backend/Database/Prisma/Licensing/Guardian/Installer/K40 تغییر یا اجرا نشد؛ قدم بعد `UI-1.5.3` Daily Attendance است | This UI-1.5.2 commit |
| 2026-09-26 | UI-1.5.1 — Attendance Dashboard presentation migration | جایگزینی header، action، metric card، status/error/loading و trend table محلی با primitiveها و tokenهای مشترک؛ حفظ panelهای domain-specific به‌عنوان presentation؛ افزودن شش baseline و retry/API-contract coverage | `npm.cmd run test:attendance-dashboard-visual` بدون update برابر 6/6 و بازبینی مستقیم شش Screenshot؛ تست واقعی Phase 4.1 برابر 2/2؛ اجرای نهایی `npm.cmd run test:edition-boundary` برابر 36/36 با browser/FULL برابر 46/46 و Attendance real-app برابر 22/22؛ FULL/ATTENDANCE build isolation پاس | Passed — تنها presentation تغییر کرد؛ `GET /api/v1/dashboard/summary`، payload، route، `ATTENDANCE_VIEW` و Staff-only semantics ثابت ماند؛ هیچ Backend/Database/Prisma/Licensing/Guardian/Installer/K40 تغییر یا اجرا نشد؛ قدم بعد `UI-1.5.2` Employees است | This UI-1.5.1 commit |
| 2026-09-26 | UI-1.4 — Shared page primitives and accessibility contract | ثبت inventory؛ reuse کردن `ReportFiltersPanel`/`DataTable`/`PaginationControls`؛ افزودن `PageHeader`/`SummaryCard`/`StatusBadge`/`Modal`/`Button`/`EmptyState`/`ErrorState`؛ tokenهای semantic؛ keyboard row activation، localized pagination nav، Filter aria relation، Modal focus trap/Escape/restore و reduced motion | `npm.cmd run test:ui-primitives` بدون update برابر 4/4 و بازبینی مستقیم سه Screenshot؛ FULL visual برابر 5/5؛ Attendance visual برابر 4/4؛ اجرای نهایی `npm.cmd run test:edition-boundary` برابر 36/36 با browser 46/46 و Attendance real-app 16/16؛ build isolation پاس | Passed — هیچ صفحهٔ business در این مرحله migrate نشد؛ API/query/payload/permission ثابت؛ artifact حاضری بدون dependency ممنوع FULL؛ هیچ Backend/Database/Prisma/Licensing/Guardian/Installer/K40 تغییر یا اجرا نشد؛ Node محلی `22.19.0` و Node دقیق `24.19.0` برای UI-1.6 باقی است | This UI-1.4 commit |
| 2026-09-26 | UI-1.3 — Attendance shared-shell migration | افزودن `AttendanceShellAdapter` و اتصال Manifest حاضری به `SharedAppShell`؛ حذف `AttendanceRouteShell` و copy موازی؛ namespace مستقل سه‌زبانهٔ labelهای Route؛ چهار baseline تصویری حاضری؛ تفکیک صریح `ATTENDANCE_EXPORT` از محافظ قدیمی `FINANCIAL_EXPORT` پس از کشف آن در Gate | Attendance visual بدون update برابر 4/4؛ FULL visual بدون update برابر 5/5؛ focused export regression برابر 1/1؛ product/shared dependency gate و FULL/ATTENDANCE build isolation پاس؛ اجرای نهایی `npm.cmd run test:edition-boundary` برابر 36/36 با browser 42/42 و Attendance real-app 16/16 | Passed — Shell/Theme/Language/Navigation/Breadcrumb/Header/Logout/Responsive مشترک شد؛ artifact حاضری بدون Full adapter/Inbox/Sound/WebSocket/AtlasGym یا Route ممنوع؛ هیچ Backend/API/Database/Prisma/Licensing/Guardian/Installer/K40 تغییر یا اجرا نشد؛ Node محلی `22.19.0` و Node دقیق `24.19.0` برای UI-1.6 باقی است | This UI-1.3 commit |
| 2026-09-26 | UI-1.2 — Side-effect-free SharedAppShell | انتقال Shell/Theme/Language/Navigation/Breadcrumb/Header/Responsive state به `SharedAppShell`؛ استفاده از `PRODUCT_BRAND`؛ نگه‌داری Inbox/Sound/WebSocket در `FullShellAdapter`؛ اتصال FULL manifest به adapter؛ گیت source و artifact برای dependencyهای ممنوع | Visual بدون update برابر 5/5؛ Navigation برابر 4/4؛ product/shared dependency gate پاس؛ FULL/ATTENDANCE build isolation پاس؛ `npm.cmd run test:edition-boundary` برابر 36/36 با browser 42/42 و Attendance real-app 12/12؛ `git diff --check` | Passed — پنج Screenshot FULL بدون اختلاف پیکسلی؛ artifact حاضری بدون Full adapter/Inbox/Sound/WebSocket/AtlasGym؛ هیچ Backend/API/Database/Prisma/Licensing/Guardian/Installer/K40 تغییر یا اجرا نشد؛ Node محلی `22.19.0` و Node دقیق `24.19.0` برای UI-1.6 باقی است | This UI-1.2 commit |
| 2026-09-26 | UI-1.1 — FULL shell visual baseline protection | پنج Screenshot قطعی برای Desktop dark expanded/collapsed/settings، Desktop light RTL و Mobile dark؛ reuse کردن harness ثابت Route/Auth؛ افزودن Visual suite به Edition component gate | `npm.cmd run test:edition-shell-visual` برابر 5/5 در اجرای بدون update؛ بازبینی مستقیم هر پنج تصویر؛ `npm.cmd run test:edition-boundary` از `server` برابر 36/36 با browser 42/42 و Attendance real-app 12/12 | Passed — هیچ فایل تولیدی، Backend، API، Database، Prisma، Licensing، Guardian، Installer یا K40 تغییر/اجرا نشد؛ Node محلی `22.19.0` بود و Node دقیق `24.19.0` برای UI-1.6 باقی است | This UI-1.1 commit |
| 2026-08-01 | Phase 0 | ممیزی کامل و ایجاد چک‌لیست دو Edition | Documentation review؛ هیچ تست برنامه اجرا نشد | Passed — documentation only | `396044a` |
| 2026-08-04 | Phase 0 execution preflight | رفع ابهام Phase 1، Capability/Auth/404/fail-closed/Role/config/dependency/Backup/Installer gates و تفکیک Optional | Full checklist/repository cross-check؛ Markdown structure/link check؛ `git diff --check`؛ تست برنامه اجرا نشد | Passed — documentation only | `eebb67b` |
| 2026-08-04 | Phase 1.1 — Edition config/startup guard | Parser مستقل و typed برای `FULL`/`ATTENDANCE` با default `FULL`؛ Guard موقت پیش از load شدن App/Prisma/Device/Inbox/Backup؛ runtime imports deferred؛ child-process harness مستقل از env میزبان | `npm.cmd run test:edition-config`؛ `npm.cmd run typecheck`؛ `npm.cmd run build`؛ polluted-env rerun؛ اجرای واقعی fail-closed با `APP_EDITION=ATTENDANCE`؛ `git diff --check` | Passed — no DB/Port/Device/Job started in harness | `f0da95f` |
| 2026-08-04 | Phase 1.2 — Capability Registry | Registry typed و runtime-frozen برای 25 Capability؛ target/effective برابر 25/24 در FULL و 17/0 در Attendance؛ allowlistهای صریح Fail-closed؛ Optional defaults=false؛ helperهای pure و بدون Consumer | `npm.cmd run test:capabilities`؛ `npm.cmd run test:edition-config`؛ `npm.cmd run typecheck`؛ `npm.cmd run build`؛ import بدون env/DB؛ consumer scan؛ `git diff --check` | Passed — no Route/Job/UI/DB/Permission consumer added | `4c17809` |
| 2026-08-04 | Phase 1.3 — Effective Permission intersection | allowlist مرکزی و frozen برای هر 31 Permission موجود؛ ترتیب Role→ALLOW→DENY→Capability؛ denylist قطعی 11 مورد؛ اتصال به resolver مشترک Setup/Login/Me/middleware؛ FULL identity و Attendance fail-closed | `npm.cmd run test:auth-permissions`؛ `npm.cmd run test:capabilities`؛ `npm.cmd run test:edition-config`؛ `npm.cmd run typecheck`؛ `npm.cmd run build`؛ source trace و دو بازبینی مستقل؛ `git diff --check` | Passed — FULL unchanged؛ Attendance فعلاً `permissions=[]`؛ هیچ Route/Auth payload/UI/DB schema تغییر نکرد | `5978437` |
| 2026-08-04 | Phase 1.4 — API identity/Auth contract | افزودن Edition به هویت عمومی؛ serializer واحد و صریح برای Setup/Login/Me با Feature/Permission مؤثر، Session امن و expiresAt سازگار؛ token فقط Cookie؛ انتقال فقط AUTH به code-ready Attendance | `npm.cmd run test:auth-contract`؛ `npm.cmd run test:capabilities`؛ `npm.cmd run test:auth-permissions`؛ `npm.cmd run test:edition-config`؛ `npm.cmd run typecheck`؛ `npm.cmd run build`؛ direct compiled regressions؛ سه بازبینی مستقل؛ `git diff --check` | Passed — FULL=24 Feature؛ Attendance=`features=[AUTH]`, `permissions=[SIGN_IN]` برای Owner؛ startup guard حفظ و Route/UI/DB بدون تغییر | `26cfdd5` |
| 2026-08-04 | Phase 1.5 — HTTP Route registration/404 boundary | Registry مرکزی و frozen برای 32 HTTP registration؛ loader تنبل و Capability gate؛ رد زودهنگام Route خاموش و unknown خارج namespace روشن پیش از CORS/parser/Auth/maintenance/DB؛ gate شدن iClock/raw/push؛ تفکیک منطقی Push، Device Core/Diagnostics/Door، Attendance و Dashboard با حفظ compositeهای legacy | `npm.cmd run test:http-routes`؛ `npm.cmd run test:auth-contract`؛ `npm.cmd run test:capabilities`؛ `npm.cmd run test:auth-permissions`؛ `npm.cmd run test:edition-config`؛ `npm.cmd run typecheck`؛ `npm.cmd run build`؛ Attendance/Dashboard و چهار Device API regression؛ smoke مستقیم هر دو Edition؛ دو بازبینی مستقل؛ `git diff --check` | Passed — FULL=32 و Attendance=3 registration روشن؛ هر 29 registration خاموش با/بدون Cookie 404 یکسان و probeهای نمایندهٔ JSON خراب/بزرگ و urlencoded بزرگ نیز پیش از parser همان 404 را می‌دهند؛ no raw/router/maintenance/session/device side effect؛ FULL 401/403/503، preflight و legacy push/iClock حفظ | `30b315a` |
| 2026-08-09 | Phase 1.6 — Startup consumer gating | Mapping frozen و مستقل Device manager→`DEVICES`، Inbox scheduler/WebSocket→`INBOX` و Backup scheduler→`BACKUPS`؛ loaderهای conditional پیش از import؛ حفظ load/start order و fail-fast/error behavior نسخهٔ FULL؛ حذف Guard موقت Attendance و اصلاح `.env.example` | `npm.cmd run test:startup-consumers`؛ `npm.cmd run test:edition-config`؛ `npm.cmd run test:capabilities`؛ `npm.cmd run test:auth-permissions`؛ `npm.cmd run test:auth-contract`؛ `npm.cmd run test:http-routes`؛ `npm.cmd run test:backups`؛ `npm.cmd run test:devices`؛ `npm.cmd run typecheck`؛ `npm.cmd run build`؛ سه بازبینی مستقل؛ `git diff --check` | Passed — FULL هر چهار Consumer را دقیقاً یک‌بار و با ترتیب legacy load/start می‌کند؛ loader failure همچنان sequential/fail-fast و Device start rejection غیرکشنده است؛ Attendance با `features=[AUTH]` بالا می‌آید و Device/Inbox/Backup را حتی load نمی‌کند، بنابراین timer/WebSocket/device/DB side effect ندارد؛ هیچ Port/DB/K40 واقعی در harness استفاده نشد | `66cbf3f` |
| 2026-08-09 | Phase 1.7 — Frontend Auth state foundation | قرارداد pure و مشترک Edition/Capability؛ normalize واحد Setup/Login/Me با session دقیق؛ helperهای مستقل Feature/Permission؛ bootstrap ترتیبی `/api` و تشخیص دقیق Edition/version؛ UI مسدودکنندهٔ mismatch/unavailable و Retry؛ محافظ generation/abort برای StrictMode؛ حفظ Route/Nav تجاری تا Phase 3 | Client: `npm.cmd run test:auth-state-unit`؛ `npm.cmd run test:auth-state-component`؛ `npm.cmd run test:audit-logs`؛ `npm.cmd run test:report-downloads`؛ `npx.cmd tsc -b --pretty false`؛ `npm.cmd run lint -- --quiet`؛ `npm.cmd run build`. Server contract regression: `npm.cmd run typecheck`؛ `npm.cmd run build`؛ اجرای مستقیم compiled تست‌های edition-config، capabilities، auth-contract و http-route registry؛ `git diff --check` | Passed — Auth component 11/11، تمام 11 سناریوی FULL regression پاس؛ اجرای اضافی دو-Worker یک timeout تقویم داشت و rerun تک‌Worker همان سناریو پاس شد؛ Login/Setup هیچ Me پنهان ندارند؛ matching FULL/ATTENDANCE بالا می‌آیند؛ mismatch و identity failure پیش از downstream Auth مسدود می‌شوند؛ stale `ME=401` state جدید را overwrite نمی‌کند؛ Capability name کپی دستی Client نیست | `426f329` |
| 2026-08-09 | Phase 1.8 — Unified Phase 1 regression matrix | Orchestrator واحد، sequential و fail-fast با env پاک؛ یک Build در هر سمت؛ شش تست compiled و process-isolated برای config/capability/permission/Auth/HTTP/startup؛ Auth unit/component کلاینت روی پورت آزاد، strictPort و بدون reuse شدن Vite قبلی؛ پایدارسازی regression پاسخ stale `ME=401` بدون delay زمانی | `npm.cmd run test:edition-boundary` در `server`؛ اجرای متمرکز stale-401؛ سه بازبینی مستقل؛ `git diff --check` | Passed — هر 13 مرحلهٔ Runner، هر شش boundary سرور و Auth component 11/11 پاس؛ FULL inventory=32 و چهار startup Consumer حفظ؛ Attendance inventory=3، `features=[AUTH]` و تمام 29 registration و loader/starterهای business خاموش بدون side effect؛ Server/Client typecheck/build و Client lint پاس؛ هیچ DB/K40 واقعی استفاده نشد. اجرای نخست Flake دومین click تست race را آشکار کرد؛ Gate کنترل‌شده، انتظار تکمیل واقعی response و assertion صفر بودن `auth:unauthorized` جای delay را گرفتند و rerun کامل پاس شد | `76e9a65` |
| 2026-08-09 | Phase 2.1 — Employee Staff-only Facade/Projection | Router/Repository/Service مستقل `/api/v1/employees` با strict-both Staff scope، DTO و Audit allowlist، Salary/Overtime خنثی، optimistic update، Archive/Restore بدون physical Delete، رد Customer/marker ناسازگار و subrouteهای full/membership/payment؛ حفظ legacy `/members` در FULL؛ افزودن Employee و Member regression به runner | `npm.cmd run test:employees`؛ `npm.cmd run test:members`؛ `npm.cmd run test:http-routes` و اجرای مستقیم compiled آن؛ `npm.cmd run test:edition-boundary`؛ Server/Client typecheck/build، Client lint و Auth component داخل runner؛ سه بازبینی مستقل؛ `git diff --check` | Passed — Employee focused 14 گروه، runner نهایی 16/16 و Auth component 11/11؛ FULL inventory=33 و legacy Members سالم؛ Attendance inventory=3، `features=[AUTH]` و 30 registration خاموش با Employee router/service/repository بدون load/query/parser side effect. DB/K40/Device واقعی استفاده نشد. inventory/repair markerهای legacy اجرا نشد و شرط بازِ Commit Gate نهایی Phase 2 است | `bf9cd94` |
| 2026-08-11 | Phase 2.2 — Attendance/Report Staff-only boundary | Scope صریح و Edition-bound برای Entry Logs، Daily، Manual، Justification، Attendance Reports و Compliance؛ strict-both relation predicates و DTO/select امن؛ Customer/mismatch 404 یکسان و بدون mutation/Audit؛ Serializable retry و post-write marker check؛ canonical report/export Audit؛ bypass شدن cache در STRICT برای جلوگیری از نشت پس از reclassification؛ حفظ کامل legacy FULL | `npm.cmd run test:attendance`؛ `npm.cmd run test:attendance-boundary`؛ `npm.cmd run test:reports-attendance`؛ `npm.cmd run test:http-routes`؛ `npm.cmd run test:edition-boundary`؛ Server/Client typecheck/build و Client lint داخل runner؛ بازبینی مستقل production؛ `git diff --check` | Passed — Attendance boundary شش گروه، HTTP scope/permission، Report/Compliance strict matrix و FULL regressions پاس؛ runner نهایی 21/21 و Auth component 11/11؛ FULL inventory=33، Attendance inventory=3، `features=[AUTH]` و 30 registration خاموش حفظ شد. هیچ DB/K40/Device واقعی استفاده نشد؛ marker inventory/repair همچنان Gate باز نهایی Phase 2 است | `94980dd` |
| 2026-08-16 | Phase 2.3 — Device Staff-only/Core boundary | Scope صریح FULL/STRICT برای startup، Pull ingestion و فرمان‌های user؛ strict-both Staff mapping، DeviceUser claim/remap امن، Raw-first Customer rejection، cursor پیوسته و RawLog immutable؛ singleton K40 با transaction advisory lock؛ DTO/config/event/Audit امن؛ جداسازی فیزیکی Core از Diagnostics/Door/Push/Inbox و حفظ legacy FULL | `npm.cmd run test:devices-boundary`؛ `npm.cmd run test:devices`؛ اجرای compiled Employee/HTTP/startup regressions؛ `npm.cmd run test:edition-boundary`؛ سه بازبینی مستقل؛ `git diff --check` | Passed — runner نهایی 24/24 و Auth component 11/11؛ FULL inventory=33 و رفتار legacy Customer/Push/Door/Inbox حفظ؛ Attendance inventory=3، `features=[AUTH]` و 30 registration خاموش بدون Device loader/start side effect. تست‌های mock/process-isolated اجرا شدند؛ DB واقعی، `test:devices-integration` و K40 واقعی `Not run` و متعلق به 2.7 هستند. marker inventory/repair همچنان Gate باز نهایی Phase 2 است | `fda4fe7` |
| 2026-08-16 | Phase 2.4 — TIME_CLOCK punch/door decision boundary | `ATTENDANCE_POLICY` خارج DB با default/تنها مقدار `TIME_CLOCK` و fail-before-bootstrap؛ ثبت هر Punch معتبر strict Staff مستقل از Shift/Access policy با `isAuthorized=true` و بدون AccessViolation؛ projection مثبت live/history با `attendanceRecorded`/`doorAllowed`/`doorOpened`؛ مرتب‌سازی chronological batch پیش از IN/OUT inference؛ حفظ exact مسیر legacy FULL | `npm.cmd run test:edition-config`؛ `npm.cmd run test:devices-boundary`؛ `npm.cmd run test:devices`؛ server typecheck/build و direct compiled regressions؛ `npm.cmd run test:edition-boundary`؛ بازبینی مستقل production/test/docs؛ `git diff --check` | Passed — no-shift، early/late/outside، policy محدود و overnight/unsorted inference ثبت شدند؛ Customer/mismatch/inactive همچنان Raw-only و Door/Inbox/Violation صفر است؛ strict eventها `attendanceRecorded=true` و `doorAllowed=false` دارند و `authorized` فقط alias سازگاری رکورد جدید است. FULL 14 K40 + 2 Support حفظ شد؛ runner نهایی 24/24 و Auth component 11/11؛ FULL inventory=33، Attendance=3/`features=[AUTH]` و disabled=30. DB واقعی، `test:devices-integration` و K40 واقعی `Not run` و متعلق به 2.7؛ classification کامل 2.6 و marker repair باز است | `b7b8c30` |
| 2026-08-16 | Phase 2.5 — default-off Auto-checkout boundary | قرارداد frozen و typed برای `ATTENDANCE_AUTO_CHECKOUT_ENABLED=0\|1` با default `0` و fail-before-bootstrap؛ Decision صریح `ATTENDANCE_V1_DISABLED` برای هر دو مقدار و `LEGACY_FULL` برای FULL؛ Guard نخست routine و پیش از خواندن clock و هر Prisma Query/Write؛ regression مستقیم zero-query/zero-write و حفظ exact synthetic `OUT` legacy FULL؛ بدون Capability/Route/Consumer/schema/UI جدید | `npm.cmd run test:edition-config`؛ `npm.cmd run test:attendance-auto-checkout`؛ `npm.cmd run test:startup-consumers`؛ server typecheck/build؛ `node --check scripts/test-edition-boundary.mjs`؛ اجرای isolated `npm.cmd run test:edition-boundary`؛ بازبینی production/test/docs؛ `git diff --check` | Passed — Attendance با `0` و `1` صفر Query و صفر synthetic `OUT` دارد؛ FULL با هر دو مقدار lookup و شکل legacy `OUT` شامل source/reason/time را حفظ می‌کند. Runner نهایی 25/25 و Auth component 11/11؛ FULL inventory=33، Attendance=3/`features=[AUTH]` و disabled=30 بدون promotion. DB واقعی، Device integration و K40 واقعی `Not run` و متعلق به 2.7؛ `1` همچنان Scope Change رزروشده، classification کامل 2.6 و marker repair باز است | `9cfd34c` |
| 2026-08-23 | Phase 2.6 — Attendance semantics and Daily/Report reconciliation | fixture واحد strict Staff برای On-time، Late، Early arrival/leave، Overtime دیرهنگام، Missing checkout، Multiple events، Unscheduled، Overnight، Absent/Justified و Denied؛ assertion تطبیق Daily summary/rows با Report KPI/Daily/Employees و عدم نشت Customer/دو marker mismatch؛ افزودن suite به runner؛ همسان‌سازی late checkout Report با Daily | `npm.cmd run test:attendance-semantics`؛ `npm.cmd run test:attendance-boundary`؛ `npm.cmd run test:reports-attendance`؛ final isolated `npm.cmd run test:edition-boundary`؛ `git diff --check` | Passed — suite جدید اختلاف واقعی checkout ساعت 19:30 را آشکار کرد: Report پیش‌تر Overtime را 0 و No-checkout را اضافه می‌کرد؛ پس از fix، Daily/Report دقیقاً reconcile شدند. Runner نهایی 26/26 و Auth component 11/11؛ FULL legacy report/K40/Member سالم، Attendance همچنان inventory=3/`features=[AUTH]` و disabled=30 بدون promotion. DB واقعی، Device integration و K40 واقعی `Not run` و متعلق به 2.7؛ marker inventory/repair هنوز باز است | `4c9fdb3` |
| 2026-08-23 | Phase 2.7 — PostgreSQL/K40 hardware gate | strict PostgreSQL integration برای Staff replay/reconciliation و Customer/Unknown/Inactive Raw-only؛ اجرای checklist 10.3 روی K40 واقعی؛ inventory mismatch و cleanup؛ اصلاح advisory lock Prisma 7 و RawLog conflict noise | `npm.cmd run test:devices`؛ `npm.cmd run test:devices-boundary`؛ `npm.cmd run test:devices-integration`؛ `npm.cmd run test:attendance-integration`؛ `npm.cmd run test:attendance-api-integration`؛ `npm.cmd run test:edition-boundary`؛ `npx.cmd prisma migrate status`؛ real K40 scripts؛ `git diff --check` | Passed — real Eraj IN/OUT از RawLog تا Daily/Entry Logs/Report reconcile و Door/Inbox/Violation صفر؛ temp ID 18 create/enroll/outside-shift/inactive/delete و cleanup صفر؛ restart idempotent و بی‌خطای Prisma؛ device lifecycle و time sync پاس؛ K40 اصلی `enabled=true, ONLINE`؛ marker mismatch صفر. هیچ Capability/Route/UI promote نشد | `ffe6be6` |
| 2026-08-23 | Phase 3.1 — Frontend Route/feature boundary | Route Manifest typed برای FULL و ATTENDANCE؛ انتخاب entry در build-time؛ lazy route graph؛ `RequireFeature` پیش از Permission؛ first-accessible Root/Settings redirect؛ generic 404؛ تست مستقیم و build scan برای نبودن Customer/Finance chunks | Client: `npm.cmd run typecheck`؛ `npm.cmd run lint -- --quiet`؛ `npm.cmd run test:route-manifest`؛ `npm.cmd run test:route-boundary`؛ `npm.cmd run test:route-build-boundary`؛ `npm.cmd run test:edition-components`؛ FULL `test:audit-logs` و localized report regression؛ final `npm.cmd run test:edition-boundary` از Server؛ `git diff --check` | Passed — FULL route surface حفظ شد؛ Attendance build فقط shell امن را mount می‌کند و marker/chunk مسیرهای Members/Payments/Finance ندارد؛ Feature خاموش 404 عمومی و Feature روشن بدون Permission برابر Forbidden است. تست تاریخ گزارش نیز از وابستگی به روز اول ماه شمسی پاک شد. Navigation/Header/Breadcrumb عمداً برای 3.2 باز است؛ هیچ Capability promote نشد | `32371c4` |
| 2026-08-23 | Phase 3.2 — Manifest-driven navigation surface | Context مشترک Manifest؛ حذف `settingsNavigation` و route/permission arrays موازی Layout؛ main/settings navigation و icon metadata؛ Header title، parent breadcrumb و Add action؛ فیلتر همزمان Feature+Permission و عدم افشای عنوان مسیر خاموش | Client: `npm.cmd run test:route-manifest`؛ `npm.cmd run test:navigation-surface`؛ `npm.cmd run test:audit-logs`؛ `npm.cmd run test:route-build-boundary`؛ typecheck/lint؛ final `npm.cmd run test:edition-boundary` از Server؛ `git diff --check` | Passed — چهار browser matrix مسیر مجاز، Feature خاموش با Permission قدیمی، read-only بدون Add و Settings flyout محدود را پوشش می‌دهد؛ FULL سه زبان/تم Audit سالم و Attendance build بدون Customer/Finance chunk ماند. هیچ Capability یا backend Route promote نشد؛ K40/DB واقعی Not run و برای این UI phase لازم نبود | `a320d4d` |
| 2026-08-23 | Phase 3.3 — Staff-only Employees UI | API client و صفحه‌های مستقل list/add/detail/edit؛ گزینهٔ امن Staff Group بدون Salary؛ shell و Routeهای Attendance؛ Redirect چهار bookmark قدیمی؛ فعال‌سازی فقط `EMPLOYEES` با Permission intersection | Client: `npm.cmd run test:employees-ui`؛ `npm.cmd run test:route-build-boundary`؛ typecheck/lint؛ Server: `npm.cmd run test:employees`؛ `npm.cmd run test:capabilities`؛ `npm.cmd run test:auth-permissions`؛ `npm.cmd run test:auth-contract`؛ `npm.cmd run test:http-routes`؛ final `npm.cmd run test:edition-boundary`؛ `git diff --check` | Passed — پنج browser workflow فهرست/افزودن/ویرایش/Staff bookmark/Customer 404 فقط `/api/v1/employees*` را مصرف می‌کنند؛ Attendance artifact فقط Employee chunks و Redirect امن دارد؛ FULL Members حفظ شد؛ Attendance inventory=4 و `features=[AUTH,EMPLOYEES]` است. K40/DB واقعی لازم نبود | `28e0e65` |
| 2026-08-24 | Phase 3.4 — Staff-only Daily Attendance and Entry Logs UI | صفحه‌های مستقل Daily/Entry Logs؛ date/group/shift/employee/event/source/device/result filters؛ summary/warning، Manual IN/OUT و Justification؛ گزینهٔ امن Device؛ مخفی‌بودن Export تا Phase 4؛ فعال‌سازی `ATTENDANCE_DAILY` و `ENTRY_LOGS` | Client `test:attendance-ui` 5/5؛ route build isolation؛ typecheck/lint/build؛ Server Attendance/Capability/Auth/HTTP/Startup؛ final `test:edition-boundary` 28/28 و browser matrix 29/29؛ `git diff --check` | Passed — هیچ Members/Membership/Payment/Payroll/Expense یا `memberType` request وجود ندارد؛ Result filter server-side است؛ Attendance artifact فقط chunkهای مستقل Staff را دارد؛ FULL حفظ شد؛ inventory=6 و `features=[ATTENDANCE_DAILY,AUTH,EMPLOYEES,ENTRY_LOGS]`. DB/K40 واقعی لازم نبود | `b251ef7` |
| 2026-08-24 | Phase 3.5 — K40 Device Core UI/Capability | facade و صفحهٔ مستقل list/status/event/create/update/enable/disable/test/time و Staff user sync/upsert/delete/enroll؛ Permission تفکیک‌شده؛ startup Device manager؛ حفظ secret ذخیره‌شده در update؛ حذف client config ناشناخته؛ جداسازی build/runtime از Diagnostics/Door/Push | Client `test:devices-ui` 4/4؛ route manifest/navigation/build isolation؛ typecheck/lint/build؛ Server Device/Capability/Auth/HTTP/Startup؛ final `test:edition-boundary` 28/28 و browser matrix 33/33؛ `git diff --check` | Passed — Attendance inventory=7 و `features=[ATTENDANCE_DAILY,AUTH,DEVICES,EMPLOYEES,ENTRY_LOGS]`؛ عملیات Core با 401/403 مناسب فعال است؛ Diagnostics/Raw Logs/Scan/Clear/Unlock/Push عمومی 404 و module/chunk آنها غایب است؛ FULL حفظ شد. DB/K40 واقعی Not run و برای این UI/promotion phase لازم نبود؛ شواهد سخت‌افزاری Phase 2.7 همچنان معتبر است | `1341afe` |
| 2026-08-24 | Phase 3.6 — Attendance Role mapping/Admin Users/Base branding | bundleهای ثابت Owner/Manager/Operator/Technician/Auditor/Vendor؛ schema و selector پنج Role قابل‌ساخت؛ migration امن حساب legacy؛ صفحهٔ مستقل Access Users؛ promotion `ADMIN_USERS`؛ Product Brand build-selected برای Login/Layout/title/icon/support label؛ غیبت `ATTENDANCE_EXPORT` | Server Admin-role/Capability/Auth/Permission/HTTP/Startup؛ Client product-brand unit، Admin Users Playwright 3/3، Route Manifest و build isolation؛ typecheck/lint/build؛ final `test:edition-boundary` 30/30 و browser matrix 36/36؛ `git diff --check` | Passed — Attendance inventory=8 و `features=[ADMIN_USERS,ATTENDANCE_DAILY,AUTH,DEVICES,EMPLOYEES,ENTRY_LOGS]`؛ Roleهای ADMIN/SUPER_ADMIN/RECEPTION/ACCOUNTANT/STAFF/VENDOR از create/update selector/schema رد می‌شوند؛ enum DB حفظ و legacy account قابل مهاجرت است؛ Attendance HTML/logo artifact مستقل و FULL سالم است. DB/K40 واقعی Not run و برای این Auth/UI/build phase لازم نبود | `71b0a13` |
| 2026-08-24 | Phase 3.7 — Direct URL/Network/Language/Theme gate | Theme روشن/تاریک build-independent و پایدار؛ copy سه‌زبانهٔ کنترل‌های Shell؛ E2E روی App واقعی Attendance برای هفده صفحهٔ Excluded FULL و نه URL رزروشده/قدیمی، چهارده Route/redirect فعال، Login و Network allowlist | Client focused `test:attendance-phase-3-7` 4/4؛ Server unified `test:edition-boundary` 31/31 شامل browser matrix 36/36 + Phase 3.7 browser 4/4؛ FULL/ATTENDANCE build isolation؛ typecheck/lint/build؛ `git diff --check` | Passed — URLهای ممنوع generic Not Found و صفر business request؛ Routeهای فعال مستقیم load می‌شوند؛ Customer/Membership/Finance/Payroll/Expense و Advanced Device request صفر؛ English LTR و دری/پشتو RTL؛ Theme روشن/تاریک در `ecs-theme` پایدار و FULL سالم است. DB/K40 واقعی Not run و برای این E2E/UI gate لازم نبود | Committed with Phase 4.1 after final verification |
| 2026-08-24 | Phase 4.1 — Staff-only Attendance Dashboard | Service/DataSource/Router مستقل فقط حاضری؛ strict-both Staff query؛ Permission `ATTENDANCE_VIEW`؛ خلاصهٔ کارمند/حاضری/هشدار/Punch/Device و trend هفت‌روزه؛ API client، UI و copy انگلیسی/دری/پشتو؛ promotion `ATTENDANCE_DASHBOARD`؛ legacy FULL Dashboard حفظ شد | Focused server Dashboard/Capability/Auth/HTTP/Startup/FULL regression؛ focused browser Phase 4.1 برابر 2/2؛ Client typecheck/lint/build و build-graph scan؛ unified `test:edition-boundary` 33/33 شامل browser matrix 36/36 + real Attendance app 6/6؛ `git diff --check` | Passed — Attendance inventory=9 و Featureهای مؤثر 7 مورد؛ فقط `GET /api/v1/dashboard/summary` وجود دارد؛ details/reports-summary برابر 404؛ Query/DTO/UI و build بدون Customer/Membership/Payment/Revenue/Debt/Payroll/Expense؛ Root و `/dashboard` مستقیم load می‌شوند؛ FULL Dashboard permission behavior سالم است. DB/K40 واقعی Not run و برای این read-only Dashboard phase لازم نبود | Committed after final verification |
| 2026-08-24 | Phase 4.2 — Staff-only Attendance Report | Router/Facade/schema و API client مستقل برای options/summary/daily/employees/evidence؛ reuse محاسبات و tableهای موجود؛ Staff scope اجباری؛ فیلترهای امن، 11 KPI و copy انگلیسی/دری/پشتو؛ promotion `ATTENDANCE_REPORTS`؛ جداسازی read از export و حفظ legacy FULL | Focused server Report schema/options/permission/export boundary؛ Capability/Auth/HTTP/Startup/FULL regressions؛ focused browser Phase 4.2 برابر 1/1؛ Client typecheck/lint/build و build-graph scan؛ unified `test:edition-boundary` 34/34 شامل browser matrix 36/36 + real Attendance app 7/7؛ `git diff --check` | Passed — Attendance inventory=10 و Featureهای مؤثر 8 مورد؛ فقط پنج endpoint خواندنی Report فعال‌اند؛ `memberType` و queryهای مالی رد می‌شوند؛ CSV/XLSX/PDF/client-export-audit برابر 404 و UI بدون Export است؛ legacy FULL Report و exportهای آن سالم‌اند. DB/K40 واقعی Not run و برای این read-only Report phase لازم نبود | Committed after final verification |
| 2026-08-24 | Phase 4.3 — Dedicated Attendance Report export permission | Permission typed `ATTENDANCE_EXPORT` با migration enum و seed Roleهای Owner/Manager/Vendor؛ Capability/Auth mapping؛ Router مستقل export با Staff scope اجباری؛ CSV daily/employees/evidence و XLSX/PDF در UI فقط برای دارندهٔ Permission؛ حفظ `FINANCIAL_EXPORT` و legacy FULL | Prisma generate/validate/migrate deploy/status و seed query؛ focused Capability/Auth/Report/HTTP/Startup/Playwright؛ Client/server typecheck، lint و build؛ unified `test:edition-boundary` 34/34 شامل browser matrix 36/36 + real Attendance app 8/8؛ `git diff --check` | Passed — Attendance inventory=10 و Featureهای مؤثر 9 مورد؛ هر سه endpoint export علاوه بر `ATTENDANCE_VIEW` دقیقاً `ATTENDANCE_EXPORT` می‌خواهند؛ `FINANCIAL_EXPORT` به‌تنهایی 403/بدون UI است؛ `memberType` قابل تزریق نیست؛ پنج دانلود مرورگر و legacy FULL سالم‌اند؛ 39 migration روی DB اصلی up to date است. K40 واقعی Not run و برای این Permission/Report-export phase لازم نبود | `d2e09f3` |
| 2026-08-24 | Phase 4.4 — Complete Entry Logs CSV/XLSX | Query سخت‌گیرانهٔ export بدون `memberType/page/pageSize`؛ جمع‌آوری batch سمت Server تا سقف امن 50,000 ردیف؛ CSV دارای BOM و XLSX واقعی؛ حفظ Date/Search/Employee/Device/Event/Source/Result؛ UI فقط با `ATTENDANCE_EXPORT` | Focused Attendance API و Playwright 5/5؛ HTTP/Capability/Auth boundaries؛ Client/server typecheck، lint و builds؛ unified `test:edition-boundary` 34/34 شامل browser matrix 36/36 + real Attendance app 10/10؛ build-graph scan و `git diff --check` | Passed — export مستقل از صفحهٔ فعلی است، widening به Customer رد می‌شود، FULL endpoint جدید را mount نمی‌کند و هیچ DB/K40 واقعی برای این export composition لازم نبود | Committed after final verification |
| 2026-08-24 | Phase 4.5 — Staff-only Monthly Timecard | تب ماهانه با Month و Employee/Group؛ planned/actual minutes و paired sessions؛ Late/Early leave/Overtime/Absence/Justified/Missing/Invalid؛ totals قابل تطبیق با daily details؛ CSV/XLSX/PDF بدون Salary/Payroll | Unit reconciliation و schema/router/export permission؛ real-app Phase 4.5؛ HTTP module isolation؛ Client/server typecheck، lint و builds؛ unified `test:edition-boundary` 34/34 شامل browser matrix 36/36 + real Attendance app 10/10؛ `git diff --check` | Passed — تمام روزهای ماه از Daily Staff-only محاسبه می‌شوند؛ سه export فقط با Permission مستقل فعال‌اند؛ FULL و legacy Report سالم‌اند. DB/K40 واقعی Not run و برای این aggregation/UI phase لازم نبود؛ parser/DB-fixture شواهد Phase 4.7 باقی است | Committed after final verification |
| 2026-08-24 | Phase 4.6 — Audited, branded and localized Attendance exports | Audit fail-closed برای Entry Logs و Monthly Timecard با Actor/Role/Session/IP/User-Agent/format/row count/outcome و filterهای امن؛ برند `Entry Control Attendance` در filename/XLSX/PDF؛ labelها، statusها، sheetها و UI انگلیسی/دری/پشتو؛ حفظ exportهای FULL | Focused Attendance/Report service-router tests؛ localization/branding برای CSV/XLSX/PDF در سه زبان؛ focused real-app Phase 4.6؛ Client/server typecheck و client lint؛ unified `test:edition-boundary` 34/34 شامل browser matrix 36/36 + real Attendance app 11/11؛ `git diff --check` | Passed — Search text یا محتوای report در Audit ذخیره نمی‌شود؛ row count از نتیجهٔ واقعی generator ثبت می‌شود؛ Entry Logs و Timecard در Server audit می‌شوند و filenameهای Attendance از FULL جدا هستند. DB/K40 واقعی Not run و برای این audit/presentation phase لازم نبود؛ DB fixture و export-parser acceptance در Phase 4.7 باقی است | Committed after final verification |
| 2026-08-24 | Phase 4.7 — PostgreSQL export parser and HTTP E2E gate | Fixture موقت واقعی شامل Staff گزارش، Staff دارای 205 لاگ و Customer کنترل؛ Routerهای production Attendance/Report؛ parser دقیق CSV و XLSX و PDF.js؛ Permission و Customer-widening guards؛ Audit واقعی و cleanup اجباری | `npm.cmd run test:attendance-export-integration` پس از build؛ سه زبان × ده export = 30 دانلود/Audit؛ CSVهای daily/employees/evidence، Report XLSX/PDF، Entry Logs CSV/XLSX و Timecard CSV/XLSX/PDF؛ unified `test:edition-boundary` 34/34 شامل browser matrix 36/36 + real Attendance app 11/11؛ `git diff --check` | Passed — تمام 205 Entry Log مستقل از pagination صادر شد؛ Report فقط Staff fixture را داشت؛ workbook sheet/value/brand/filename و PDF text در سه زبان parse شد؛ Timecard totals بین detail CSV و summary XLSX برابر بود؛ 30 Audit دارای Actor/Role/Session/IP/User-Agent/outcome/row count درست بود؛ cleanup تمام Member/Shift/Log/Audit/Session/Group fixtureها را با صفر leftover تأیید کرد. K40 Not run و برای export gate لازم نبود | Committed after final verification |
| 2026-08-24 | Phase 5.1 — Mandatory startup and Restore-maintenance gating | خواندن fail-closed وضعیت maintenance پیش از App/Server/listen و Consumer side effect؛ startup active فقط HTTP؛ coordinator سریال و idempotent برای pause/resume دستگاه، Inbox، Backup scheduler و WebSocket؛ stop quiescent؛ gate شدن `/iclock` و push پیش از raw parser | Focused startup/Backup/Inbox/Device/HTTP route tests؛ Server typecheck/build؛ unified `npm.cmd run test:edition-boundary` 34/34 شامل browser matrix 36/36 + real Attendance app 11/11؛ `git diff --check` | Passed — خطای status-read پیش از هر side effect fail-closed است؛ FULL هر چهار Consumer و ATTENDANCE فقط Consumer مجاز را دقیقاً یک‌بار resume/stop می‌کنند؛ health/auth/backup control حفظ و business/special ingestion در maintenance با 503 مسدود است. DB، restore واقعی و K40 اجرا نشدند و برای این lifecycle/regression phase لازم نبودند | `319be91` |
| 2026-08-25 | Phase 5.2 — Historical FULL Audit filtering and redaction | policy صریح و fail-closed برای Action+Target و Evidence قطعی Staff؛ اتصال واحد list/summary/options/detail به Edition؛ 404 یکسان برای direct ID مخفی؛ redaction بازگشتی credential/biometric/permission/financial؛ marker صریح writerهای Manual/Justification؛ promotion صفحهٔ مشترک Audit با `AUDIT_LOG_VIEW` | Focused policy/router/redaction و Attendance writer/API؛ Capability/Auth/HTTP/Startup؛ `npm.cmd run test:audit-logs-integration` با PostgreSQL محلی و 0 fixture؛ Client typecheck/lint/build، route-build scan و real-app Audit؛ unified `npm.cmd run test:edition-boundary` 35/35 شامل browser matrix 36/36 + real Attendance app 12/12؛ `git diff --check` | Passed — رکورد Staff مجاز در list/summary/options/detail دیده شد؛ Customer/Expense/attendance بدون marker حتی با direct ID برابر 404 ماند؛ Salary redacted شد؛ FULL viewer و Route حفظ شدند؛ artifact Attendance شامل Audit مشترک بدون Customer/Finance/advanced-device chunk است. Restore واقعی و K40 Not run و برای این read-boundary/database-fixture phase لازم نبودند | `df757fd` |
| 2026-08-25 | Phase 5.3 — Backup Edition compatibility and mandatory hardening | promotion `BACKUPS` در Attendance و Route/UI مشترک با Role/Permission موجود؛ Full-database/خارج-DB Edition contract؛ brand-selected copy؛ pre-extraction ZIP central-directory quota/path/symlink/encryption/ratio policy؛ child-close-aware timeout؛ stale OperationRun و orphan extraction recovery | Backup service 9/9؛ hardening contract؛ Router 5/5؛ Capability/Auth/HTTP/Startup؛ failure workflow PostgreSQL 9/9 با cleanup؛ Attendance real app 12/12؛ backup/restore/API-smoke واقعی روی disposable DB و cleanup؛ unified Edition boundary 36/36 با browser matrix 36/36؛ build/typecheck/lint | Passed — full dump شامل جدول‌های غیرفعال است و config Edition وارد payload نمی‌شود؛ Owner Backup عادی و Vendor Restore را طبق gate دارد؛ ZIP bomb/traversal پیش از extraction رد می‌شود؛ timeout پیش از close settle نمی‌شود؛ دیتابیس restore موقت و artifactهای تست حذف شدند. Assertion دادهٔ FULL زیر Runtime Attendance عمداً به Phase 5.4 سپرده شد؛ K40 لازم نبود | `0c53a3d` |
| 2026-08-25 | Phase 5.4 — FULL-backup-to-Attendance restore isolation | runner دائمی loopback-only با دو DB نام‌گذاری‌شده و cleanup fail-safe؛ fixture FULL شامل Customer/Membership/Payment/Expense/Inbox/Audit و Staff/Device؛ `pg_dump` custom-format و `pg_restore` واقعی؛ App/auth/route/payload/Audit/device/backup assertions زیر Attendance | `npm.cmd run test:attendance-restore-isolation`؛ 39 migration روی DB منبع؛ dump/restore به DB مقصد؛ 13 Route ممنوع برابر 404؛ Employees/Daily/Entry Logs/Dashboard/Report/Audit بدون Customer؛ سه Audit مستقیم مخفی برابر 404؛ Customer punch بدون side effect؛ Staff punch موفق؛ Backup دستی 7,308,123 bytes؛ unified Edition boundary 36/36 با component 36/36 و real-app 12/12 | Passed — Edition از config بیرونی برابر ATTENDANCE ماند؛ ردیف‌های FULL در DB برای Upgrade حفظ اما از HTTP/Audit مخفی شدند؛ Backup روی DB Restoreشده COMPLETED شد؛ هر دو DB و تمام dump/backup artifactها حذف شدند. K40 فیزیکی لازم نبود چون processing واقعی با DeviceUser fixture اجرا شد | `18fe3c9` |
| 2026-08-25 | Phase 5.5 — External timezone/policy/config Restore persistence | `APP_TIMEZONE` معتبر نام‌دار/UTC با default کابل و اعمال به `process.env.TZ`؛ fail-before-bootstrap برای timezone نامعتبر؛ source Runtime با `FULL/UTC/TIME_CLOCK/1` و host TZ متضاد؛ چهار SystemSetting sentinel متضاد؛ target Runtime با `ATTENDANCE/Asia-Kabul/TIME_CLOCK/0` روی همان DB Restoreشده | `npm.cmd run test:edition-config`؛ `npm.cmd run test:attendance-restore-config` با 39 migration، dump/restore واقعی و Backup دستی 7,308,123 bytes؛ restored sentinel equality؛ Kabul boundary ثابت `2026-01-15T19:45Z → 2026-01-16 00:15`؛ Backup hardening؛ cleanup DB/artifact؛ unified Edition boundary 36/36 با component 36/36 و real-app 12/12 | Passed — config دیتابیس حتی با keyهای هم‌نام Runtime را override نکرد؛ `TZ` آلودهٔ میزبان هم با APP_TIMEZONE جایگزین شد؛ Edition/Policy/Auto-checkout خارجی پس از Restore ثابت ماندند؛ DBها و temp roots صفر شدند. ProgramData/ACL متعلق به Phase 6 است؛ K40 لازم نبود | `6d122b5` |
| 2026-08-26 | Phase 5.6 — Unselected Optional absence gate | پنج Flag محیطی Optional عمداً روی `1`؛ Feature/HTTP inventory و module-load Fail-closed؛ Inbox Job/WebSocket startup و maintenance-resume بدون load/start؛ stale client Auth با هر پنج Feature تزریق‌شده؛ Direct URL/Network/WebSocket assertion؛ اسکن marker و filename تمام Chunkهای Optional | Focused Server build/Capability/HTTP/Startup؛ FULL و ATTENDANCE production build scan؛ focused browser absence 1/1؛ `npm.cmd run test:attendance-optional-absence` برابر 36/36، component browser برابر 36/36 و real-app برابر 12/12؛ `git diff --check` | Passed — Compliance/Inbox/Sounds/Diagnostics/Door با Flagهای آلوده هم غیرفعال ماندند؛ هیچ Router/module/Job/Inbox WebSocket/request/chunk فعال نشد؛ FULL route/build و تمام Attendance Core regressions سالم‌اند. اجرای اول Gate به‌علت ETIMEDOUT زیرپردازش Node در مرحلهٔ 23 ناقص شد؛ focused همان مرحله پاس و rerun کامل PASS شد. DB و K40 واقعی لازم نبودند | `82fd486` |
| 2026-08-26 | Phase 5.7 — FULL operations and Backup regression | Runner دائمی ۲۸ مرحله‌ای برای Route/Role/Permission، Customer/Membership/Payment، Payroll/Expense، Dashboard/Attendance/گزارش‌ها و تمام Exportهای FULL؛ workflowهای PostgreSQL؛ failure/restart بکاپ؛ Restore واقعی FULL به FULL؛ Build و مرورگر | `npm.cmd run test:full-operations-regression` برابر 28/28؛ 39 migration و fixture/cleanup مستقل برای هفت workflow دیتابیسی؛ `pg_dump`/`pg_restore` واقعی و Backup دستی 7,308,123 bytes؛ Report download برابر 6/6؛ Audit viewer برابر 5/5؛ FULL/ATTENDANCE artifact isolation؛ typecheck/lint/build | Passed — تمام Routeها، نقش‌ها، workflowهای عملیاتی و مالی، گزارش‌ها و Backup/Restore نسخهٔ FULL حفظ شدند. ماتریس Export قدیمی در اجرای اولیه یک کمبود تست برای Entry Logs CSV/XLSX را آشکار کرد؛ پوشش اصلاح و rerun کامل پاس شد. هر دو DB موقت و artifactهای Restore پاک شدند؛ K40 فیزیکی لازم نبود | `1b026a3` |
| 2026-08-26 | Phase 6.0 — Packaging and Installer Decision Gate | ممیزی repository/runtime و Windows فعلی؛ بررسی منابع رسمی NSIS/Node/.NET/PostgreSQL؛ قرارداد دقیق platform، version، service، database، path/ACL، port/network، update/uninstall و تصمیم اولیهٔ Licensing | `PACKAGING_DECISIONS.md` با NSIS 3.11، Node 24.19.0، .NET 10.0.11، PostgreSQL 17.11، Windows 10/11 x64، portهای 41820/55432 و baseline اولیهٔ Licensing `[OUT]`؛ بررسی نبود تصمیم باز آن Gate؛ `git diff --check` | Passed — Installer آفلاین، runtimeهای private، Service host خود پروژه، Same-origin loopback، حفظ پیش‌فرض داده در Uninstall و مسیر دستی signed update قطعی شد. Windows 10 Home/Pro/Enterprise/LTSC پذیرفته و Windows 7/8.1 و x86/ARM خارج شدند. تصمیم اولیهٔ Licensing سپس با Scope Change ردیف بعد به `[IN]` تغییر کرد | `1b026a3` |
| 2026-08-26 | Phase 6.0 Scope Change — Licensing `[IN]` | ممیزی مستقل نقاط اتصال Server/Client/Backup/Audit، پروتکل و کلیدهای Windows و threat/state/recovery؛ ثبت ماتریس الزام‌های پذیرش و محدودیت‌های واقعی Administrator، Snapshot و revoke آفلاین | `LICENSING_DESIGN.md`؛ اصلاح `PACKAGING_DECISIONS.md`، `security-design.md`، Phaseهای 6/7 و Scope table؛ Markdown/link/static consistency و `git diff --check` | Passed — Offline و Hybrid، finite term، ES256/COSE، TPM/CNG fallback، Secure State خارج DB/Backup، restricted mode، quarantine بدون حذف داده، Recovery امضاشده، Emergency Backup و ترتیب Phase 6.1–6.6 تصویب شدند. هیچ runtime/DB/K40 تغییر یا اجرا نشد؛ Implementation هنوز شروع نشده است | Uncommitted — awaiting commit gate |
| 2026-08-28 | Phase 6.1 — canonical version identity and deterministic Edition artifacts | strict `version.json`/parser؛ build identity مشترک Server/Client؛ Production build بدون fallback؛ runtime Edition/Node admission؛ manifest بستهٔ path/size/SHA-256؛ output/junction/env/size/CLI hardening؛ حذف icon و favicon برند مقابل | Node `24.19.0` با `npx`؛ identity/consumer tests؛ چهار build تازه و tamper/path/symlink/case/env matrix؛ FULL manifest دارای 242 ورودی closure، جدا از manifest/sidecar (244 فایل کل) / `4f433662771087888df0b3aacc3b432632e62c158293a9af266fa2c7f23cc04f`؛ ATTENDANCE دارای 188 ورودی (190 فایل کل) / `ded7fd492cf1ec3ee5d5fe39e25684acec27fde655289106cddd17095957784e`؛ Edition boundary 36/36 + browser 37/37 + real-app 12/12؛ FULL operations مراحل 1–26 و focused report 6/6 و Audit 5/5 | Passed with recorded failures — build اولیه declaration/Vite CJS و assertion اولیهٔ tamper اصلاح و کامل rerun شد؛ یک اجرای FULL runner در step 25 با `ETIMEDOUT` و اجرای دیگر در step 27 با timeout 240 ثانیه‌ای مرورگر متوقف شدند؛ build و مراحل report/Audit جداگانه پاس شدند، اما هیچ‌کدام از دو اجرای aggregate پیام `[full-operations] PASS` نداد و `test:phase-6.1 PASS` ادعا نمی‌شود. Artifactها unsigned هستند، dependency tree مستقل reinstall نشد، Server physical isolation به 6.3، Guardian/signing به 6.4 و Clean Windows/K40 به 6.6 سپرده شد | Working tree — commit pending |
| 2026-09-05 | Phase 6.2.003 — تکمیل هستهٔ preflight و اصلاح corpus | Protocol/Golden/Core روی Node `24.19.0`؛ .NET `10.0.400`؛ 676/676 descriptor، 12/12 PoP، 66/66 carrier/context/Rebind؛ Edition 36/36، component 37/37 و browser 12/12 | PASS؛ `LIC-EV-0013` با protocol pin `512534732dce759da424ba0e8d8838c3d9c294e3faa02a4017212ce482523eab` و vector pin `565a5efca1a1767a622a0d751a5937633018587f7cc463ce3e531ed9656fb99e`؛ بازبینی مستقل Protocol/Security | پنج تناقض corpus و ایرادهای زمان بازیابی/تفکیک کلید قدیم و جدید اصلاح و تست شدند؛ خطاهای قبلی در master حفظ‌اند. LIC-6.2-004 بعدی و شروع‌نشده؛ runtime/Guardian/Installer هنوز باز است. | Base `b753adf`; working tree — commit pending |
| 2026-09-03 | Phase 6.2.002 — Golden Vectorهای غیرتولیدی | بازتولید قطعی ۱۰۵ artifact و ۱۸ کلید عمومی `TEST_ONLY`؛ ۳۵ signed + ۶ carrier مثبت؛ ۴۲ منفی باینری؛ ۷۴۸ join دقیق (۴۲ linked + ۷۰۶ deferred)؛ اجرای واقعی ۹۰ cross-type؛ verifierهای مستقل Node/.NET؛ probeهای CBOR/JSON/path/ADS/case/oversize/link/report/no-overwrite/alias؛ production-isolation scan؛ بازبینی مستقل Protocol/Security | Node `24.19.0` و .NET SDK `10.0.400`؛ هر سه گزارش Vendor/Node/.NET دارای ۱۷۳ رکورد و byte-identical با hash `0fa67ea1ef8c85ed8e142855d9a4f4daa0670d3bd9463dc42e2385f7da637ce8`؛ index برابر `92d06ac04a92c5e1a37c993185a246bd9a6b8513693ff43555f3179ebb9cc685`؛ manifest نهایی ۱۲۹‌فایلی برابر `044f2d388efcb961a450bab4e842d2df2538c1771724d929b6a01a606577fa3c` | Passed after remediation — candidate قبلی `d0a024591d95f60c99f67ee2a31c441e51e37c078f8bd8e713a8dc010c1483d5`، manifest پیش از اصلاح ADS برابر `efcdcf364643deecbdb229190a5097433a4b8500a0afb02f98c1c0e35162212d` و manifest پیش از اصلاح namespace/UNC برابر `c0260dd2daa07cd26522c8ae1e32e59b7d195ac4414b5c8d6539eed6f3e1a213`، خطاهای source/canonical JSON و پذیرش reportهای ADS/extended-path/administrative-share در .NET به‌عنوان تاریخچهٔ ردشده حفظ و سپس اصلاح شدند. فقط قرارداد تست بسته شد؛ parser/Core/trust تولیدی، Guardian، Installer، DB/state، K40 و Clean Windows هنوز پیاده یا ادعا نشده‌اند. `LIC-6.2-003` بعدی و شروع‌نشده است | Working tree — commit pending |
| 2026-08-31 | Phase 6.2.001 — Licensing protocol v1 final closure | exact registry/schema/message/signer/carrier؛ CDDL 13/13؛ ۲۲۴ malformed descriptor و ۹۰ جفت ordered cross-type؛ manifest/sidecar/pin هجده‌فایلی؛ بررسی مستقل package/docs/security | Node `24.19.0` focused gate PASS؛ hash نهایی `5999201211627e3f8c13d2af52cc2a7494e4bc3599a1cf440dac49714f1648e6`؛ هر دو reviewer بدون blocker | Passed after remediation — تاریخچهٔ candidate مسدودشده در ردیف بعد حفظ شد؛ تمام شکاف‌های purpose/Control/Rebind/time/delegation/TPM/trust/Denylist/corpus/test/pin بسته و rerun شدند. هیچ golden vector، private key، parser/verifier، runtime License، DB، Guardian، Installer یا K40 پیاده/آزمایش نشد؛ `LIC-6.2-002` هنوز شروع نشده است | Working tree — commit pending |
| 2026-08-30 | Phase 6.2.001 — Licensing protocol v1 candidate review | exact deterministic tagged CBOR/COSE registry؛ ۱۰ signed CDDL و ۳ carrier؛ candidate corpus/manifest؛ بررسی مستقل امنیتی | focused gate و CDDL 13/13 روی candidate اجرا شد، سپس closure review آن را مسدود کرد | Blocked — manifest candidate برابر `af0bce13d53a106e51463ceae65a12b96a59e9a4c4c4b9101ca6d840f07ab3d1` فقط تاریخچهٔ ردشده است. کمبودهای purpose/response، Control/Rebind، lifetime/time/delegation، trust/Denylist، TPM context، corpus و pin بیرونی manifest سپس اصلاح و در ردیف PASS بالا بسته شدند. هیچ golden vector، private key، parser/verifier، runtime License، DB، Guardian، Installer یا K40 پیاده/آزمایش نشد | Working tree — superseded by accepted remediation |
| 2026-09-26 | UI-1.0 — Shared visual system discovery and readiness baseline | تشخیص Shell/page styling موازی؛ تصویب ظاهر مشترک با Brand/Route/Capability جدا؛ ثبت مرز Frontend-only، معماری adapter و Gateهای مرحله‌ای در `EDITION_UI_UNIFICATION_PLAN.md` | `npm.cmd run test:edition-boundary` از `server`؛ Server/Client typecheck، Client lint، FULL/ATTENDANCE builds و isolation scan؛ component/browser 37/37؛ Attendance real-app 12/12؛ `git status --short` | Passed — تمام 36 مرحله سبز و Worktree پیش از مستندسازی تمیز بود؛ DB/K40/Windows service اجرا نشد. Baseline با Node محلی 22.19.0 است و پذیرش نهایی باید روی Node دقیق 24.19.0 تکرار شود؛ هیچ کد محصول تغییر نکرد | This documentation commit |

## 23. تصمیم‌ها و Scope Changeها

هر تصمیم جدیدی که محدودهٔ v1 را تغییر می‌دهد اینجا ثبت شود.

| Date | Requested change | Decision | Impact on phases/tests | Approved by |
| --- | --- | --- | --- | --- |
| 2026-08-01 | ساخت نسخهٔ فقط حاضری بدون آسیب به نسخهٔ کامل | یک کدبیس، دو Edition و server-enforced capabilities | تمام Phaseهای 1 تا 7 | User |
| 2026-08-04 | ماتریس هدف Capability و code-ready rollout | جدول 2.4/2.4.1 منبع target/readiness باشد؛ FULL موجود حفظ و Attendance فقط پس از Gate هر Consumer فعال شود | Phase 1.2 تا 5 و Edition boundary tests | User — تأیید صریح 2026-08-04 |
| 2026-08-04 | رفتار Feature خاموش | Backend همان 404 عمومی مسیر ناشناخته را می‌دهد؛ Frontend generic Not Found؛ 403 فقط برای Feature روشن و Permission ناکافی | Phase 1.5، Phase 3 و Edition route tests | User — تأیید صریح 2026-08-04 پیش از اجرای 1.5 |
| 2026-08-09 | API کارمند | `/api/v1/employees` Facade/Router مستقل Staff-only؛ `/api/v1/members` فقط FULL؛ Employee HTTP Delete در Attendance ارائه نشود و Deactivate/Archive مسیر عادی باشد | Phase 2/3، strict-both repair gate و legacy redirect tests | User — تأیید صریح 2026-08-09 پیش از اجرای 2.1 |
| 2026-08-04 | منبع Edition/Feature/Policy | خارج DB/Restore؛ env در Development و config محافظت‌شدهٔ ProgramData در Installer؛ Optionalها پیش‌فرض خاموش | Phase 1/5/6 و restore isolation | User — تأیید صریح 2026-08-04 |
| 2026-08-04 | Auth contract | `/api` هویت عمومی؛ Setup/Login/Me پاسخ یکسان edition/features/effective permissions، Session امن و alias سازگار expiresAt بدهند | Phase 1.4/1.7 و Auth tests | User — تأیید صریح 2026-08-04 پیش از اجرای 1.4 |
| 2026-08-04 | Roleهای Attendance | enumهای موجود طبق جدول 8.1 با Label/bundle امن استفاده شوند؛ Roleهای نامربوط در selector جدید نمایش داده نشوند | Phase 1.3/3.6 و stale-role tests | User — تأیید صریح 2026-08-24 با شروع Phase 3.6 |
| 2026-08-04 | Optionalها | Inbox/Sounds/Compliance/Diagnostics/Door خارج مسیر اجباری v1 و فقط با Scope Change مستقل وارد می‌شوند | Phase 5/6/7 و O.1–O.5 | User — Gate 5.6 نبود کامل هر پنج Optional را ثابت کرد |
| 2026-08-26 | Licensing v1 | لایسنس محدودمدت برای هر دو Edition `[IN]`؛ حالت `OFFLINE_BOUND` و `HYBRID_LEASED`، مدت دقیق در اختیار Vendor، اتصال به کلید نصب TPM/CNG، Secure State خارج DB/Backup، قفل قابل بازیابی و Remote suspend/revoke در تماس بعدی/پایان allowance | Phase 6.1–6.6 و `LICENSING_DESIGN.md` | User — تأیید صریح نیازمندی Offline/Online، عدم فروش دائمی و رفتار Tamper/Lock/Recovery در 2026-08-26 |
| 2026-09-26 | یکسان‌سازی ظاهر FULL و ATTENDANCE | یک Shared Visual System و `SharedAppShell` بدون side effect؛ Brand/Route/Capability/Permission/داده جدا می‌مانند و Backend/API/Database/Licensing/Device logic خارج Scope است | Work package `UI-1.0` تا `UI-1.6`، Visual regression و Edition build-isolation gates | User — تأیید صریح 2026-09-26 پیش از هر تغییر کد |
| 2026-10-03 | افزودن Inbox به نسخهٔ Attendance | `O.2 INBOX` برای v1 انتخاب شد: ظاهر مشترک FULL با دادهٔ Staff/Device-only، scope تاریخی صریح، HTTP/WebSocket احرازشده، `APP_FEATURE_INBOX` fail-closed و بدون Membership/Customer/Sounds/Door/Auto-checkout | بخش‌های 11.2 تا 11.4 و مراحل O.2.1–O.2.7؛ migration/query isolation، producer split، Auth، restore/K40/FULL regression و build isolation | User — تأیید صریح 2026-10-03 پیش از شروع O.2.1 |
