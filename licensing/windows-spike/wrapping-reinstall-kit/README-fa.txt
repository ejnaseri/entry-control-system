LIC-6.2-008 Retained-data Uninstall/Reinstall Simulation 0.14.0 — TEST ONLY

این بسته نصب‌کننده یا حذف‌کننده واقعی محصول نیست. فقط فضای آزمایشی تازه
Ecs.Lic008.WrappingV7 را استفاده می‌کند. V1 تا V6 را اجرا یا تغییر ندهید.
هر مرحله فقط یک بار و بعد از بررسی خروجی مرحله قبلی. روی خطا توقف؛ دوباره
اجرا نکنید، فایل intent حذف نکنید، کلید یا ACL جایگزین نسازید. ری‌استارت لازم نیست.

۱. در PowerShell 64-bit ادمین از همین kit:
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\Run-Wrapping-Reinstall.ps1 -Stage Prepare
تا PREPARED_FOR_UNINSTALL صبر کنید و خروجی کامل را ارسال کنید. دو کلید و اطلاعات
آزمایشی ایجاد و بررسی می‌شوند؛ سپس سه سرویس Stopped/Manual و کلیدها باقی می‌مانند.

۲. فقط پس از بررسی Prepare، از همین kit:
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\Run-Wrapping-Reinstall.ps1 -Stage Uninstall
Guardian ابتدا همان کلیدها و رکوردهای محافظت‌شده را تأیید می‌کند. سپس فقط ثبت
سه سرویس دقیق V7 حذف می‌شود. کلیدها، داده‌ها، ACL، باینری و گزارش‌ها باقی می‌مانند.
تا UNINSTALLED_RETAINED_DATA صبر کنید و خروجی را ارسال کنید؛ خودکار ادامه ندهید.

۳. فقط پس از بررسی خروجی Uninstall:
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\Run-Wrapping-Reinstall.ps1 -Stage Reinstall
ثبت سرویس‌ها با همان نام، حساب، SID، تنظیمات و فایل‌های تأییدشده بازسازی می‌شود.
هیچ کلیدی ایجاد یا ACL اصلاح نمی‌شود. Guardian همان کلید و اطلاعات قبلی و
App/child محدودیت دسترسی را بررسی می‌کنند. فقط پس از تمام موفقیت‌ها، دو کلید
متعلق به همین آزمایش حذف و نبودشان تأیید می‌شود. فایل‌ها و گزارش‌ها باقی می‌مانند.

حذف/ایجاد SCM اتمیک نیست. شکست وسط کار یعنی حفظ intent و وضعیت ناقص برای بررسی،
نه Resume یا اصلاح خودکار. خطاهای کلید مفقود، SID متفاوت، داده/ACL تغییرکرده و
ثبت ناقص با fixture بی‌خطر تست می‌شوند؛ این تست‌ها اثبات قطع برق واقعی نیستند.
نسخه موفق فیزیکی هم حذف فایل‌های نصب‌کننده واقعی را آزمایش نمی‌کند.
productionUninstallTested/productionReinstallTested/securityAccepted/
productionAccepted/matrixAccepted=false. TPM، حساب استاندارد جدا، Windows matrix،
نصب‌کننده امضاشده و License Store واقعی هنوز تأیید نشده‌اند.
