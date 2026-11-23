LIC008 Interactive User Control 0.10.1 — TEST ONLY / EXACT CONTINUATION

این بسته فقط ادامه وضعیت ثبت‌شده WrappingV3 پس از خطای شناسه گزارش 0.10.0 است.
نصب تازه، Prepare یا ساخت دوباره کلید در این کنترل‌کننده وجود ندارد.
ریشه، گزارش‌ها، بسته قدیمی و کلیدهای موجود را حذف یا تغییر ندهید.

۱. در PowerShell مدیر (Administrator) از همین بسته:
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\Run-Wrapping-User-Control.ps1 -Stage ResumeScopeFailure

این مرحله فقط همان گزارش، Run/Experiment/SID، بسته و سرویس‌های متوقف را قبول
می‌کند. نسخه اصلاح‌شده در bin-0.10.1 جدا کپی می‌شود، مسیر اجرایی سه سرویس
آزمایشی تغییر می‌کند و Guardian و App/child روی کلیدهای موجود بررسی می‌شوند.
کلید تازه ساخته نمی‌شود و ACL کلید یا پوشه محافظت‌شده تغییر نمی‌کند.
بسته قبلی در bin حفظ می‌شود و هش گزارش اصلی در سابقه ادامه ثبت می‌شود.

۲. فقط پس از PREPARED، در PowerShell معمولی، نه مدیر، از همین بسته:
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\Run-User-Probe.ps1

۳. مسیر User report را از خروجی مرحله دوم در PowerShell مدیر بدهید:
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\Run-Wrapping-User-Control.ps1 -Stage Finish -UserReport "EXACT_REPORT_PATH"

ResumeScopeFailure و Finish هرکدام فقط یک بار. در خطا، هیچ مرحله‌ای را تکرار
نکنید؛ وضعیت را نگه دارید و خروجی بفرستید. Finish پس از موفقیت همه کنترل‌ها
فقط کلیدهای همین آزمایش را با بررسی مالکیت پاک می‌کند.
حساب یا گذرواژه تازه ساخته نمی‌شود. تمام پذیرش‌های امنیتی/محصول/ماتریس false است.
توکن کاربر باید Interactive، Medium integrity، بدون elevation و بدون گروه مدیر
فعال باشد. توکن فیلترشده حساب مدیر جدا ثبت می‌شود و تست مستقل حساب استاندارد نیست.
گزارش کاربر خوداظهاری آزمایشی است، نه اثبات امنیت علیه کاربر مهاجم.
Reboot/Repair/Upgrade/Windows matrix و بازبینی مستقل هنوز باز است.
