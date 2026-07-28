# Evo Store

متجر المنتجات والخدمات الرقمية — عربي بالكامل (RTL)، وضع داكن، محفظة داخلية بسجل قيود غير قابل للتلاعب.

مبني على **Next.js 14 (App Router) + TypeScript + Tailwind CSS + Drizzle ORM + PostgreSQL**.

> هذه **المرحلة 0 (الأساس)**: نظام التصميم والهوية، مخطط قاعدة البيانات الكامل، ونظام المصادقة.
> راجع وثيقة المعمارية في مشروع Claude (`evo-store-architecture.md`) لبقية المراحل.

---

## المتطلبات

- Node.js 18.18+ (يُفضّل 20+)
- PostgreSQL 15+

## الإعداد السريع

```bash
# 1) تثبيت الاعتماديات
npm install

# 2) نسخ متغيرات البيئة وتعبئتها
cp .env.example .env
#   - عدّل DATABASE_URL ليشير إلى قاعدة بياناتك
#   - ولّد SESSION_SECRET:
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"

# 3) توليد الهجرة من المخطط ثم تطبيقها
npm run db:generate
npm run db:migrate

# 4) التهيئة: تصليب قاعدة البيانات (append-only) + أدمن + تصنيفات
npm run db:seed

# 5) التشغيل
npm run dev
```

الافتراضي: <http://localhost:3000>

بيانات الأدمن الافتراضية (غيّرها عبر متغيرات `SEED_ADMIN_*`):
`admin@evo.store` / `Admin12345`

## أوامر قاعدة البيانات

| الأمر | الوظيفة |
|---|---|
| `npm run db:generate` | توليد ملفات الهجرة من `schema.ts` |
| `npm run db:migrate` | تطبيق الهجرات |
| `npm run db:push` | دفع المخطط مباشرة (تطوير سريع) |
| `npm run db:seed` | تصليب + بيانات ابتدائية |
| `npm run db:studio` | واجهة Drizzle Studio |

> **مهم:** ملف `src/server/db/sql/00_hardening.sql` يضيف Triggers تمنع تعديل/حذف قيود المحفظة
> (سجل إلحاقي)، وقيود منع الرصيد السالب. يُطبَّق تلقائيًا ضمن `db:seed`، أو يدويًا:
> `psql "$DATABASE_URL" -f src/server/db/sql/00_hardening.sql`

## بنية المشروع

```
src/
  app/
    (auth)/            # تسجيل الدخول/الإنشاء/التحقق/الاستعادة
    account/           # حساب العميل
    admin/             # لوحة الإدارة (خلف RBAC)
    api/auth/          # واجهات المصادقة (Route Handlers)
    layout.tsx         # RTL + خط عربي (Cairo) + وضع داكن
    globals.css        # نظام التصميم (متغيرات الألوان)
  components/
    ui/                # مكوّنات واجهة (Button, Input, Card, ...)
    brand/ layout/ auth/
  lib/                 # أدوات مشتركة (cn, env, api-client)
  server/
    db/                # Drizzle: schema, client, seed, hardening
    auth/              # كلمات المرور، الجلسات، الرموز، RBAC
    validation/        # مخططات Zod
    http.ts            # مساعدات استجابة الواجهات
  middleware.ts        # حماية /admin على الحافة
```

## الأمان (مطبّق في هذه المرحلة)

- تجزئة كلمات المرور بـ **bcrypt** (تكلفة 12).
- جلسات مبهمة (opaque) تُخزّن **مجزّأة** (SHA-256) في قاعدة البيانات، وكوكي **HttpOnly + SameSite=Lax + Secure** في الإنتاج.
- قفل مؤقت بعد محاولات دخول فاشلة متكررة.
- رموز التحقق (OTP) والاستعادة تُخزّن **مجزّأة** مع صلاحية زمنية.
- عدم كشف وجود الحسابات في مسارات الدخول والاستعادة.
- **RBAC**: فصل عميل/موظف/أدمن + صلاحيات دقيقة للموظفين.
- سجل المحفظة **إلحاقي** يُفرض على مستوى قاعدة البيانات.
- كل المبالغ `NUMERIC(18,8)` (بلا `FLOAT`)، وتبقى نصوصًا في التطبيق للحفاظ على الدقة.

## المراحل التالية

1. ✅ المحفظة — **منفّذة**: نواة دفتر مالي ذرية (قفل صف + idempotency)، طلبات شحن بإثبات مرفق، مراجعة أدمن (اعتماد/رفض)، تعديل إداري للرصيد بصلاحيات، صفحة `/wallet` ولوحات `/admin/deposits` و`/admin/users`. المرفقات محلية في `./storage` (تُستبدل بـ S3 لاحقًا).
2. ✅ المنتجات والطلبات اليدوية — **منفّذة**: تصنيفات ومنتجات (بكجات/كمية + شرائح أسعار + حقول مطلوبة ديناميكية)، تسعير خادمي بالكامل، متجر `/products` مع نافذة تأكيد، إنشاء طلب مع حجز ذري، طلباتي مع مراسلات وإلغاء، ولوحة أدمن كاملة للطلبات (تنفيذ/معلومات/إكمال+تسوية/استرجاع) والمنتجات والتصنيفات.
3. ✅ الدفع التلقائي (Binance Pay) — **منفّذ**: إنشاء أوامر دفع موقّعة (HMAC-SHA512)، Webhook بتحقق توقيع RSA-SHA256 مع تخزين `payment_events` الخام وIdempotency كاملة، إضافة الرصيد تلقائيًا، وزر «تحديث الحالة» (Polling آمن بنفس مفتاح الاعتماد) للتطوير المحلي حيث لا تصل الـ Webhooks.

   **التفعيل:** ضع `BINANCE_PAY_API_KEY/SECRET` في `.env` (من merchant.binance.com)، واضبط Webhook URL في بوابة التاجر على `https://<نطاقك>/api/webhooks/binance`. محليًا استخدم زر تحديث الحالة بعد الدفع.
4. ✅ المزوّدون والتنفيذ التلقائي — **منفّذ**: طبقة محوّلات موحّدة (Adapter) مع محوّلي `mock` و`smm` (معيار لوحات الخدمات)، أسرار مشفّرة at-rest (AES-256-GCM)، خدمة مزوّدين (CRUD + اختبار اتصال + ربط منتجات)، إرسال الطلبات تلقائيًا مع تسوية عند النجاح واسترجاع تلقائي عند الفشل، سجل `provider_api_logs`، إعادة إرسال ومزامنة يدوية، ونقطة cron للمتابعة الدورية (`/api/cron/poll-providers` محميّة بـ `CRON_SECRET`).
5. ✅ الدعم والإشعارات والتقارير — **منفّذ**: إشعارات داخل الموقع (جرس بعداد + صفحة `/notifications` مع تعليم مقروء)، نظام تذاكر دعم كامل (عميل `/support` + أدمن `/admin/support` بأقسام وأولويات وحالات وربط طلبات)، ولوحة إحصائيات حقيقية (مبيعات/أرباح يوم وشهر، طلبات حسب الحالة، أفضل المنتجات، أداء المزوّدين) مع تصدير الطلبات CSV.
6. ✅ التصليب — **منفّذ**: مصادقة ثنائية TOTP (RFC 6238، بلا اعتماديات) تُفعّل من `/account` وتُفرض عند الدخول؛ تحديد المعدّل على الدخول/التسجيل/الطلبات/الإيداعات؛ رؤوس أمان (CSP/HSTS/nosniff/frame-options)؛ مطابقة أرصدة المحافظ (Reconciliation) من `/admin/settings`؛ إعدادات المتجر ووضع الصيانة؛ وتوثيق النسخ الاحتياطي.

---

## ✅ المشروع مكتمل — كل المراحل الست منفّذة ومُختبرة.

### أوامر مفيدة إضافية
- `CRON_SECRET` في `.env` + جدولة `POST /api/cron/poll-providers` لمتابعة طلبات المزوّدين تلقائيًا.
- التصدير: `/api/admin/reports/orders` (CSV).
- النسخ الاحتياطي: `pg_dump "$DATABASE_URL" -Fc -f evo-backup.dump`.

---

## النشر على Vercel

المشروع جاهز لـ Vercel: المرفقات تُخزَّن في قاعدة البيانات (لا يعتمد على قرص قابل للكتابة)، تجمّع اتصالات مناسب لـ serverless (max=1 + prepare=false مع Supabase Pooler)، وملف `vercel.json` لجدولة متابعة المزوّدين كل 5 دقائق.

1. ارفع الكود إلى GitHub (ملف `.env` مستثنى تلقائيًا).
2. vercel.com → **Add New → Project → Import** المستودع (Next.js يُكتشف تلقائيًا).
3. أضف متغيرات البيئة في Settings → Environment Variables:
   - `DATABASE_URL` — رابط Supabase (يُفضّل **Transaction pooler** منفذ 6543 لـ serverless) مع `?sslmode=require`
   - `SESSION_SECRET` — 48 بايت عشوائية
   - `APP_BASE_URL` — رابط مشروعك، مثل `https://evo-store.vercel.app`
   - `CRON_SECRET` — سلسلة عشوائية (Vercel Cron يرسلها كـ Bearer تلقائيًا)
   - اختياري: `PROVIDER_ENCRYPTION_KEY`، `BINANCE_PAY_API_KEY/SECRET`
4. طبّق الهجرات مرة واحدة (من جهازك موجّهًا لنفس القاعدة): `npm run db:migrate && npm run db:seed`
5. Deploy. اضبط Binance Webhook على `https://<نطاقك>/api/webhooks/binance`.

> عمود `attachments.data` أُضيف لتخزين المرفقات في القاعدة — أعد `npm run db:generate && npm run db:migrate` (أو `setup.bat`) لتطبيقه قبل النشر.


<!-- deployed to vercel -->
