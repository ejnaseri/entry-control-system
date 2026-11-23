LIC008 Binary Repair Simulation 0.12.0 — TEST ONLY

این بسته آزمایش مستقل است، نه Repair واقعی نصب محصول یا پذیرش امنیتی.
فضای تازه WrappingV5 دارد. V1/V2/V3/V4 را دوباره اجرا، تغییر یا حذف نکنید.
هر مرحله فقط یک بار؛ در خطا وضعیت را نگه دارید و خروجی را بفرستید.
حساب تازه ساخته نمی‌شود، ACL کلید/اطلاعات ضعیف نمی‌شود و ری‌استارت لازم نیست.

۱. PowerShell 64-bit مدیر:
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\Run-Wrapping-Repair.ps1 -Stage Prepare

پس از PREPARED_FOR_REPAIR، کلیدها نگه داشته می‌شوند و سرویس‌ها Stopped/Manual
هستند. ابتدا خروجی را بفرستید تا بررسی شود.

۲. بعد از تأیید مرحله اول، در PowerShell مدیر از همین بسته:
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\Run-Wrapping-Repair.ps1 -Stage Repair

این مرحله بسته/دستگاه/گزارش/اطلاعات قبلی را تطبیق می‌دهد. Guardian باید قبل از
هر کپی و تغییر مسیر سرویس، معتبر بودن همان کلیدها و اطلاعات را ثابت کند.
بسته معتبر در bin-repaired جدا کپی می‌شود؛ فایل‌های قبلی و کلیدها حفظ می‌شوند.
مسیر اجرایی سه سرویس آزمایشی تغییر می‌کند و Guardian/App/child دوباره تست می‌شوند.
هویت عمومی کلیدها و بایت‌های envelope باید ثابت بمانند. کلید تازه ساخته نمی‌شود.

پس از موفقیت، فقط کلیدهای همین آزمایش با بررسی مالکیت پاک می‌شوند. سپس با
اطلاعات باقی‌مانده، عمداً همان دروازه Repair دوباره تست می‌شود: چون کلید پاک
شده، باید RECOVERY_REQUIRED بدهد و هیچ فایل/مسیر/کلید جایگزینی ایجاد نکند.
ردیف‌های FAILED_OR_UNAVAILABLE در این آخرین تست عمدیِ کلید حذف‌شده مورد انتظارند؛
پیام PASS: controlled missing-key repair refused و گزارش نهایی باید ثبت شوند.

این تست بازنصب آزمایشی فایل اجرایی و دروازه نگهداری کلید است، نه تعمیر فایل خراب
یا مفقود اجرایی، MSI/Setup واقعی، Upgrade، قطع برق وسط تعمیر، TPM یا Windows matrix.
پذیرش‌های security/production/matrix و productionRepairTested همچنان false هستند.
