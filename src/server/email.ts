import "server-only";
import nodemailer from "nodemailer";

/**
 * إرسال البريد عبر SMTP (يعمل مع Gmail بكلمة مرور تطبيق، أو أي مزوّد SMTP).
 *
 * متغيرات البيئة المطلوبة (في Vercel → Environment Variables):
 * - SMTP_HOST   مثل smtp.gmail.com
 * - SMTP_PORT   465 (SSL) أو 587 (STARTTLS)
 * - SMTP_USER   بريد الإرسال
 * - SMTP_PASS   كلمة مرور التطبيق
 * - EMAIL_FROM  اسم المرسل الظاهر، مثل: "Evo Store <you@gmail.com>" (اختياري)
 * - ADMIN_NOTIFY_EMAIL بريد يستقبل إشعارات الطلبات الجديدة (اختياري)
 *
 * غير مضبوطة؟ الدوال لا تفشل — تتجاهل الإرسال بتحذير في السجل، فلا يتعطل
 * أي مسار (تسجيل، طلب...) بسبب البريد.
 */

/**
 * مزوّدان مدعومان:
 *  - RESEND_API_KEY (الأبسط: مفتاح واحد، إرسال من دومين المتجر)
 *  - أو SMTP_HOST/USER/PASS (أي خادم SMTP بما فيه Gmail)
 * الأول له الأولوية إن وُجد.
 */
export function isEmailConfigured(): boolean {
  if (process.env.RESEND_API_KEY?.trim()) return true;
  return Boolean(
    process.env.SMTP_HOST?.trim() &&
      process.env.SMTP_USER?.trim() &&
      process.env.SMTP_PASS?.trim(),
  );
}

/** عنوان المرسل — يُفضّل دومين المتجر لا بريدًا شخصيًا. */
function fromAddress(): string {
  const custom = process.env.EMAIL_FROM?.trim();
  if (custom) return custom;
  const smtpUser = process.env.SMTP_USER?.trim();
  if (smtpUser && !process.env.RESEND_API_KEY) return `Evo Store <${smtpUser}>`;
  return "Evo Store <noreply@evo-storex.com>";
}

/** إرسال عبر Resend API (بلا SMTP). */
async function sendViaResend(
  to: string,
  subject: string,
  html: string,
): Promise<boolean> {
  const key = process.env.RESEND_API_KEY?.trim();
  if (!key) return false;
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from: fromAddress(), to, subject, html }),
      signal: AbortSignal.timeout(12_000),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      console.error(`[email] Resend رفض الإرسال (${res.status}): ${detail.slice(0, 200)}`);
    }
    return true; // لا نعيد المحاولة عبر SMTP — Resend هو المزوّد المختار
  } catch (e) {
    console.error("[email] فشل الاتصال بـ Resend:", e);
    return true;
  }
}

function transport() {
  const host = process.env.SMTP_HOST?.trim();
  const user = process.env.SMTP_USER?.trim();
  const pass = process.env.SMTP_PASS?.trim();
  if (!host || !user || !pass) return null;
  const parsed = Number(process.env.SMTP_PORT);
  const port = Number.isFinite(parsed) && parsed > 0 ? parsed : 465;
  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
    // مهلات صارمة: خادم SMTP بطيء يجب ألا يعطّل إنشاء الطلبات.
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 15_000,
  });
}

const escapeHtml = (s: string) =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

async function send(to: string, subject: string, html: string): Promise<void> {
  // Resend أولًا إن كان مضبوطًا.
  if (await sendViaResend(to, subject, html)) return;

  const t = transport();
  if (!t) {
    // لا نسجّل الموضوع — قد يحوي بيانات حساسة.
    console.warn(`[email] البريد غير مضبوط — تخطّي الإرسال إلى ${to}`);
    return;
  }
  try {
    await t.sendMail({
      from: fromAddress(),
      to,
      subject,
      html,
    });
  } catch (e) {
    // البريد ليس حرجًا — لا نُفشل الطلب الأصلي بسببه، ولا نسجّل الموضوع.
    console.error(`[email] فشل الإرسال إلى ${to}:`, e);
  }
}

const wrap = (title: string, body: string) => `
<div dir="rtl" style="font-family:Tahoma,Arial,sans-serif;max-width:560px;margin:0 auto;background:#0a0a0c;color:#f5f5f5;border-radius:12px;padding:28px">
  <h2 style="color:#d4af37;margin:0 0 16px">Evo Store</h2>
  <h3 style="margin:0 0 12px">${title}</h3>
  <div style="font-size:14px;line-height:1.9">${body}</div>
  <p style="margin-top:24px;font-size:11px;color:#999">رسالة تلقائية من متجر Evo Store — لا تشاركها مع أحد.</p>
</div>`;

/** رمز تحقق البريد / الدخول. */
export async function sendVerificationEmail(
  to: string,
  code: string,
): Promise<void> {
  await send(
    to,
    // الرمز داخل جسم الرسالة فقط — لا في الموضوع (يتسرّب للسجلات والتنبيهات).
    "رمز التحقق — Evo Store",
    wrap(
      "رمز التحقق الخاص بك",
      `<p>استخدم الرمز التالي لإتمام العملية:</p>
       <p style="font-size:28px;font-weight:bold;letter-spacing:6px;color:#d4af37;direction:ltr;text-align:center">${code}</p>
       <p>الرمز صالح لمدة قصيرة ولا يطلبه منك أي موظف.</p>`,
    ),
  );
}

/** رابط استعادة كلمة المرور. */
export async function sendPasswordResetEmail(
  to: string,
  link: string,
): Promise<void> {
  await send(
    to,
    "استعادة كلمة المرور — Evo Store",
    wrap(
      "استعادة كلمة المرور",
      `<p>وصلنا طلب لإعادة تعيين كلمة مرور حسابك. اضغط الزر التالي:</p>
       <p style="text-align:center;margin:20px 0">
         <a href="${link}" style="background:#d4af37;color:#111;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:bold;display:inline-block">إعادة تعيين كلمة المرور</a>
       </p>
       <p style="font-size:12px;color:#bbb">أو انسخ الرابط: <span dir="ltr" style="word-break:break-all">${link}</span></p>
       <p>الرابط صالح لمدة قصيرة. إن لم تطلب ذلك فتجاهل الرسالة — حسابك آمن.</p>`,
    ),
  );
}

/** تسليم محتوى الطلب (أكواد/حسابات/بيانات) للعميل. */
export async function sendOrderDeliveryEmail(
  to: string,
  orderNo: string,
  content: string,
): Promise<void> {
  const safe = escapeHtml(content).replace(/\n/g, "<br/>");
  await send(
    to,
    `تم تسليم طلبك ${orderNo} 🎉`,
    wrap(
      "اكتمل طلبك",
      `<p>رقم الطلب: <b dir="ltr">${orderNo}</b></p>
       <p>محتوى التسليم:</p>
       <div style="background:#17171c;border-radius:8px;padding:14px;font-family:monospace;direction:ltr;text-align:left">${safe}</div>
       <p>يمكنك دائمًا العودة إليه من صفحة طلباتك في المتجر.</p>`,
    ),
  );
}

/** إشعار عام لصاحب المتجر (إيداع، تذكرة دعم، أي حدث مهم). */
export async function notifyAdmin(
  title: string,
  lines: Array<[string, string]>,
): Promise<void> {
  const to = process.env.ADMIN_NOTIFY_EMAIL?.trim();
  if (!to) return;
  const body = lines
    .map(
      ([k, v]) =>
        `<p>${escapeHtml(k)}: <b dir="auto">${escapeHtml(v)}</b></p>`,
    )
    .join("");
  await send(to, title, wrap(title, body));
}

/** إشعار صاحب المتجر بطلب جديد. */
export async function notifyAdminNewOrder(info: {
  orderNo: string;
  productName: string;
  total: string;
  customerEmail: string;
  status: string;
}): Promise<void> {
  const to = process.env.ADMIN_NOTIFY_EMAIL?.trim();
  if (!to) return;
  const name = escapeHtml(info.productName);
  await send(
    to,
    `طلب جديد ${info.orderNo}`,
    wrap(
      "وصل طلب جديد 🛎️",
      `<p>المنتج: <b>${name}</b></p>
       <p>الإجمالي: <b dir="ltr">${escapeHtml(info.total)}$</b></p>
       <p>العميل: <span dir="ltr">${escapeHtml(info.customerEmail)}</span></p>
       <p>الحالة: ${escapeHtml(info.status)}</p>`,
    ),
  );
}

/** إشعار صاحب المتجر عند تنفيذ طلب هامش ربحه سلبي (خسارة). */
export async function notifyAdminLossOrder(info: {
  orderNo: string;
  productName: string;
  totalPrice: string;
  costPrice: string;
  lossAmount: string;
  customerEmail: string;
}): Promise<void> {
  const to = process.env.ADMIN_NOTIFY_EMAIL?.trim() || process.env.SMTP_FROM?.trim();
  if (!to) return;
  await send(
    to,
    `⚠️ تنبيه: طلب بخسارة رقم ${info.orderNo}`,
    wrap(
      "⚠️ تنبيه طلب بخسارة مالية",
      `<p style="color:#ef4444;font-weight:bold">تم تنفيذ طلب كانت تكلفته أعلى من سعر بيعه!</p>
       <p>رقم الطلب: <b>${escapeHtml(info.orderNo)}</b></p>
       <p>المنتج: <b>${escapeHtml(info.productName)}</b></p>
       <p>سعر البيع للزبون: <b dir="ltr">${escapeHtml(info.totalPrice)}$</b></p>
       <p>التكلفة عليك: <b dir="ltr">${escapeHtml(info.costPrice)}$</b></p>
       <p style="color:#ef4444;font-size:16px">مبلغ الخسارة: <b dir="ltr">-${escapeHtml(info.lossAmount)}$</b></p>
       <p>العميل: <span dir="ltr">${escapeHtml(info.customerEmail)}</span></p>
       <p style="margin-top:12px;font-size:12px;color:#aaa">يرجى مراجعة تسعير المنتج أو المزود فوراً في لوحة التحكم.</p>`,
    ),
  );
}

