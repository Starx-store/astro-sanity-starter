/** ثوابت المصادقة المشتركة. */
export const SESSION_COOKIE = "evo_session";

/** مدة صلاحية الجلسة: 30 يومًا. */
export const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30;

/** مدة صلاحية رمز التحقق (OTP): 15 دقيقة. */
export const OTP_TTL_MS = 1000 * 60 * 15;

/** مدة صلاحية رابط استعادة كلمة المرور: ساعة واحدة. */
export const RESET_TTL_MS = 1000 * 60 * 60;

/** الحد الأقصى لمحاولات الدخول الفاشلة قبل القفل المؤقت. */
export const MAX_FAILED_LOGINS = 5;

/** مدة القفل المؤقت بعد تجاوز المحاولات: 15 دقيقة. */
export const LOCK_DURATION_MS = 1000 * 60 * 15;
