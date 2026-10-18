# راه‌اندازی Supabase

## وضعیت پروژه

- migration اصلی در پروژهٔ Supabase اجرا شده است.
- برنامه فعلاً با `VITE_DATA_MODE=demo` اجرا می‌شود تا همهٔ عملیات Supabase و Edge Functionها قبل از تغییر حالت آماده شوند.
- ورود با نام کاربری، ساخت حساب، تغییر رمز و تلاش‌های آزمون از Edge Function استفاده می‌کنند.
- فایل‌های جزوه هنوز به هاست فایل متصل نشده‌اند.

## Edge Functionها

از پوشهٔ ریشهٔ پروژه، پس از `supabase login` و `supabase link` اجرا کنید:

```bash
npx supabase functions deploy
```

در این پروژه هر تابع، نشست یا نقش را خودش بررسی می‌کند؛ برای همین `verify_jwt = false` در تنظیمات CLI آمده است. این گزینه را تغییر ندهید.

## ساخت نخستین مدیر

۱. در داشبورد پروژه، **Edge Functions → Secrets** را باز کنید. متغیرهای داخلی `SUPABASE_URL`، `SUPABASE_ANON_KEY` و `SUPABASE_SERVICE_ROLE_KEY` را تابع‌ها از محیط Supabase می‌خوانند؛ کلید محرمانه را در چت یا سورس‌کد قرار ندهید.

۲. در ترمینال یک توکن یک‌بارمصرف بسازید:

```bash
openssl rand -hex 32
```

۳. در **Edge Functions → Secrets** یک secret با نام `BOOTSTRAP_ADMIN_TOKEN` بسازید و مقدار ساخته‌شده را همان‌جا وارد کنید. این توکن را به فایل یا چت نفرستید.

۴. از ریشهٔ پروژه اجرا کنید:

```bash
npm run bootstrap:admin
```

اسکریپت توکن، نام کاربری، نام مدیر و گذرواژه را در ترمینال می‌گیرد؛ ورودی توکن و گذرواژه نمایش داده نمی‌شود. پس از ساخت مدیر، secret با نام `BOOTSTRAP_ADMIN_TOKEN` را از داشبورد حذف کنید.

## کلیدها

فایل محلی `.env` شامل URL و publishable key است و در Git نادیده گرفته می‌شود. کلید publishable برای مرورگر است؛ کلید secret/service role فقط برای عملیات سمت سرور است و نباید در فایل `VITE_*` باشد.

تا وقتی اتصال همهٔ بخش‌ها و سرویس فایل کامل و آزموده نشده، `VITE_DATA_MODE=demo` را به `supabase` تغییر ندهید.
