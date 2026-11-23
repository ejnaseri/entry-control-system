این بستهٔ آزمایشی نسخهٔ 0.7.0 فقط برای تشخیص محدود شکست DPAPI-NG در EV0109 است.
این بسته برای state دقیق ComparisonV1 پس از اجرای یک‌بارهٔ 0.6.0 ساخته شده است.

Run-Protection-Diagnostic.ps1 مشخصات غیرمحرمانهٔ token و profile سرویس Guardian را
جمع‌آوری می‌کند و دو آزمایش رمزگذاری کاملاً درون‌حافظه‌ای انجام می‌دهد:
LOCAL=user و SID دقیق Guardian. دادهٔ آزمایش تصادفی است؛ plaintext، ciphertext یا hash
آن روی دیسک ذخیره نمی‌شود و تمام bufferها پس از استفاده صفر می‌شوند.

این diagnostic از LOCAL=machine استفاده نمی‌کند، هویت یا تنظیمات profile سرویس را تغییر
نمی‌دهد، ACL یا کلید موجود را تغییر نمی‌دهد، کلید تازه نمی‌سازد و helper ایجاد نمی‌کند.
نتیجهٔ آن security acceptance یا تغییر policy نیست.

فقط Run-Protection-Diagnostic.ps1 را پس از تطبیق hash، یک‌بار در Windows PowerShell
64-bit و elevated اجرا کنید. هیچ‌یک از اسکریپت‌های قدیمی را دوباره اجرا نکنید.

در صورت شکست، دوباره اجرا نکنید. خروجی کامل و مسیر Report را برای reconciliation نگه دارید.
