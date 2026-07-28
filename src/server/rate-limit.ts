import "server-only";
import { AppError } from "@/server/errors";
import { getRequestIp } from "@/server/auth/api";

/**
 * محدّد معدّل بنافذة ثابتة داخل الذاكرة (per-process).
 * كافٍ لنشر بخادم واحد؛ للتوسّع الأفقي استبدله بـ Redis (INCR + EXPIRE)
 * دون تغيير المستدعين (نفس الواجهة).
 */

type Bucket = { count: number; resetAt: number };
const store = new Map<string, Bucket>();

// تنظيف دوري للمفاتيح المنتهية (يعمل ما دام العملية حيّة).
let sweeper: ReturnType<typeof setInterval> | null = null;
function ensureSweeper() {
  if (sweeper) return;
  sweeper = setInterval(() => {
    const now = Date.now();
    for (const [k, b] of store) if (b.resetAt <= now) store.delete(k);
  }, 60_000);
  // لا يمنع إغلاق العملية.
  if (typeof sweeper.unref === "function") sweeper.unref();
}

export interface RateLimitOptions {
  /** معرّف المجال (مثل "login") لفصل العدّادات. */
  key: string;
  /** الحد الأقصى للطلبات ضمن النافذة. */
  limit: number;
  /** طول النافذة بالمللي ثانية. */
  windowMs: number;
  /** معرّف إضافي (مثل البريد) يُدمج مع الـ IP. */
  identifier?: string;
}

/**
 * يرفع AppError (429) عند تجاوز الحد. يعتمد IP الطالب + معرّف اختياري.
 */
export async function enforceRateLimit(opts: RateLimitOptions): Promise<void> {
  ensureSweeper();
  // عند وجود معرّف موثوق (مستخدم مصادَق) نعتمد عليه وحده: الـ IP يأتي من
  // ترويسة x-forwarded-for التي يتحكم بها العميل، فإدراجها يتيح تصفير
  // العدّاد بتغييرها في كل طلب.
  const bucketKey = opts.identifier
    ? `${opts.key}:id:${opts.identifier}`
    : `${opts.key}:ip:${(await getRequestIp()) ?? "unknown"}`;
  const now = Date.now();

  const existing = store.get(bucketKey);
  if (!existing || existing.resetAt <= now) {
    store.set(bucketKey, { count: 1, resetAt: now + opts.windowMs });
    return;
  }

  existing.count += 1;
  if (existing.count > opts.limit) {
    const retrySec = Math.ceil((existing.resetAt - now) / 1000);
    throw new AppError(
      "rate_limited",
      `محاولات كثيرة جدًا. حاول بعد ${retrySec} ثانية.`,
      429,
    );
  }
}
