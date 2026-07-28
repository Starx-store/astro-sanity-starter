/**
 * حساب مالي بدقة ثابتة (Fixed-point) بمقياس 8 خانات عشرية — مطابق لـ NUMERIC(18,8).
 * لا يُستخدم Number/Float إطلاقًا في الحسابات؛ BigInt فقط.
 * الوحدة الداخلية: 1 = 0.00000001 (مضروب في 10^8).
 *
 * ملف نقي (بلا اعتماديات خادمية) — آمن للاستيراد من أي مكان.
 */

export const MONEY_SCALE = 8;
const FACTOR = 100000000n; // 10^8

/** الجزء الصحيح حتى 12 خانة (يغطي NUMERIC(18,8))، والكسر حتى 8. */
export const AMOUNT_REGEX = /^\d{1,12}(\.\d{1,8})?$/;

/**
 * تحويل مبلغ (نص من قاعدة البيانات أو من نموذج) إلى قيمة داخلية BigInt.
 * يرفض أي صيغة غير صالحة (سوالب، أسّية، فراغات، أكثر من 8 كسور).
 */
export function parseAmount(input: string | number | bigint): bigint {
  if (typeof input === "bigint") return input;
  const s = String(input ?? "").trim();
  if (!s || !AMOUNT_REGEX.test(s)) {
    return 0n;
  }
  const [whole, frac = ""] = s.split(".");
  return (
    BigInt(whole) * FACTOR +
    BigInt((frac + "0".repeat(MONEY_SCALE)).slice(0, MONEY_SCALE))
  );
}

/** تحويل القيمة الداخلية إلى نص بصيغة قاعدة البيانات (8 كسور دائمًا). */
export function toDbAmount(v: bigint): string {
  const neg = v < 0n;
  const a = neg ? -v : v;
  const whole = a / FACTOR;
  const frac = (a % FACTOR).toString().padStart(MONEY_SCALE, "0");
  return `${neg ? "-" : ""}${whole}.${frac}`;
}

/** عرض مختصر للمستخدم: يحذف الأصفار الزائدة (100.00000000 → 100). */
export function displayAmount(v: string | bigint): string {
  const s = typeof v === "bigint" ? toDbAmount(v) : String(v);
  if (!s.includes(".")) return s;
  const trimmed = s.replace(/0+$/, "").replace(/\.$/, "");
  return trimmed === "" || trimmed === "-" ? "0" : trimmed;
}

/* ------------------------------------------------------------------ */
/*  الكميات — دقة ثابتة بمقياس 4 (مطابق لـ NUMERIC(18,4))              */
/* ------------------------------------------------------------------ */

export const QTY_SCALE = 4;
const QTY_FACTOR = 10000n; // 10^4

export const QTY_REGEX = /^\d{1,14}(\.\d{1,4})?$/;

/** تحويل كمية إلى قيمة داخلية BigInt بمقياس 4. */
export function parseQty(input: string | number | bigint): bigint {
  if (typeof input === "bigint") return input;
  const s = String(input ?? "").trim();
  if (!s || !QTY_REGEX.test(s)) {
    return QTY_FACTOR; // افتراضي 1.0000
  }
  const [whole, frac = ""] = s.split(".");
  return (
    BigInt(whole) * QTY_FACTOR +
    BigInt((frac + "0".repeat(QTY_SCALE)).slice(0, QTY_SCALE))
  );
}

/** كمية بصيغة قاعدة البيانات (4 كسور). */
export function toDbQty(v: bigint): string {
  const whole = v / QTY_FACTOR;
  const frac = (v % QTY_FACTOR).toString().padStart(QTY_SCALE, "0");
  return `${whole}.${frac}`;
}

/**
 * إجمالي = سعر الوحدة (مقياس 8) × كمية (مقياس 4) بتقريب نصفي لأعلى عند مقياس 8.
 * (price8 × qty4) مقياسه 12 ⇒ نقسم على 10^4 مع تقريب.
 */
export function mulAmountByQty(price8: bigint, qty4: bigint): bigint {
  return (price8 * qty4 + QTY_FACTOR / 2n) / QTY_FACTOR;
}

/** سعر الوحدة من "سعر لكل 1000" بتقريب نصفي لأعلى. */
export function per1000ToUnit(pricePer1000: bigint): bigint {
  return (pricePer1000 + 500n) / 1000n;
}

/**
 * حساب سعر البيع من سعر المزوّد بإضافة هامش:
 * - "fixed": مبلغ ثابت يُضاف (بنفس وحدة السعر — أي لكل 1000).
 * - "percent": نسبة مئوية تُضاف فوق سعر المزوّد.
 * كلاهما بتقريب نصفي لأعلى. تُستخدم لتزامن أسعارنا مع أسعار المزوّد.
 */
export function applyMarkup(
  providerAmount: bigint,
  type: "fixed" | "percent",
  value: string | number,
): bigint {
  const raw = String(value).trim();
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return providerAmount;
  if (type === "fixed") {
    // المبلغ الثابت يُحوَّل لمقياس 8 دون المرور بـ Number (حفاظًا على الدقة).
    return providerAmount + parseAmount(raw);
  }
  const bps = BigInt(Math.round(Math.min(100000, n) * 100)); // نسبة × 100
  return (providerAmount * (10000n + bps) + 5000n) / 10000n;
}

/**
 * تطبيق نسبة خصم مئوية على مبلغ داخلي (مقياس 8) بتقريب نصفي لأعلى.
 * percent مثل 5 أو 7.5. تُقصّ بين 0 و100. تُستخدم لخصومات فئات العضوية.
 */
export function applyPercentDiscount(amount: bigint, percent: number): bigint {
  if (!Number.isFinite(percent) || percent <= 0) return amount;
  const p = Math.min(100, Math.max(0, percent));
  const bps = BigInt(Math.round(p * 100)); // 0..10000
  const remain = 10000n - bps;
  return (amount * remain + 5000n) / 10000n;
}
