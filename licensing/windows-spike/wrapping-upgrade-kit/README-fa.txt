LIC-6.2-008 Binary Upgrade Simulation Kit 0.13.0 — TEST ONLY

این آزمایش نصب یا آپدیت واقعی محصول نیست. فقط Software-KSP روی همین میزبان است.
OLD نسخه 0.13.0 و NEW نسخه 0.13.1 اسمبلی و manifest متفاوت دارند، ولی قالب
رمزگذاری ثابت است. فضای تازه WrappingV6؛ هیچ بخش V1 تا V5 را تغییر یا اجرا نکنید.
هر مرحله فقط یک بار؛ روی خطا توقف، نگهداری وضعیت و ارسال خروجی. ری‌استارت لازم نیست.
قبل از اجرای فیزیکی، خروجی build/test و فهرست تغییرات سیستمی باید بررسی شوند.

۱. از پوشه همین kit در PowerShell 64-bit ادمین:
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\Run-Wrapping-Upgrade.ps1 -Stage Prepare
تا PREPARED_FOR_UPGRADE صبر کنید، سپس خروجی را ارسال کنید. OLD کلیدها را ایجاد
و بررسی می‌کند؛ کلید و envelope نگه داشته شده، سه سرویس Stopped/Manual می‌شوند.

۲. فقط بعد از بررسی خروجی Prepare، از همان kit در PowerShell ادمین:
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\Run-Wrapping-Upgrade.ps1 -Stage Upgrade
بسته‌های OLD/NEW و checkpoint/اطلاعات/هویت دستگاه تطبیق داده می‌شوند.
OLD Guardian باید کلید موجود را تأیید کند. سپس NEW در bin-new جدا کپی می‌شود.
مسیر سه سرویس آزمایشی تغییر می‌کند؛ تا همه مسیرها و بسته NEW تأیید نشوند
هیچ سرویس شروع نمی‌شود. تغییر مسیرهای SCM اتمیک نیست؛ شکست یعنی توقف و حفظ intent.
NEW Guardian همان کلید/envelope را بررسی و App/child محدودیت را دوباره تست می‌کنند.
پس از تمام موفقیت‌ها فقط کلیدهای متعلق به همین آزمایش حذف و نبودشان تأیید می‌شود.
فایل‌های OLD/NEW، checkpoint، envelope و گزارش‌ها باقی می‌مانند.

در خطا: دوباره اجرا نکنید، intent حذف نکنید و کلید/ACL جدید نسازید.
هیچ Resume خودکار وجود ندارد؛ ادامه نیازمند بسته مخصوص همان وضعیت و بررسی جدا است.
قبول‌نشدن کلید/نسخه/بسته و توقف وسط تغییر مسیر فقط با fixture بی‌خطر تست می‌شوند؛
اجرای موفق فیزیکی Upgrade اثبات قطع برق یا همه خطاهای واقعی نیست.
productionUpgradeTested/securityAccepted/productionAccepted/matrixAccepted=false.
حساب استاندارد جدا، TPM، Windows matrix، NSIS/MSI، DB migration، License Store
و uninstall/reinstall هنوز تأیید نشده‌اند. ارتقای واقعی لایسنس را قبول یا تمدید نمی‌کند.
