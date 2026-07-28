/**
 * أخطاء التطبيق الموحّدة — تُترجم في طبقة HTTP إلى استجابة JSON برمز وحالة،
 * مع أخطاء حقول اختيارية تظهر تحت مدخلات النماذج.
 */
export class AppError extends Error {
  constructor(
    public code: string,
    message: string,
    public status = 400,
    public fieldErrors?: Record<string, string>,
  ) {
    super(message);
  }
}

/** أخطاء المحفظة والدفتر المالي. */
export class WalletError extends AppError {}

/** فحص أخطاء PostgreSQL برمز محدد (23505 فريد، 23503 مفتاح أجنبي...). */
export function isPgError(e: unknown, code: string): boolean {
  return (
    typeof e === "object" &&
    e !== null &&
    "code" in e &&
    (e as { code?: unknown }).code === code
  );
}
