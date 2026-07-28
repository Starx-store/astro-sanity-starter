import "server-only";

/**
 * الرابط الأساسي للمتجر — للروابط المطلقة (استعادة كلمة المرور، رجوع OAuth).
 * على الاستضافة نثبّت الدومين الرسمي ولا نعتمد على APP_BASE_URL، لأن قيمته
 * في البيئة قد تشير لعنوان vercel.app قديم.
 */
export function appBaseUrl(): string {
  if (process.env.VERCEL) return "https://evo-storex.com";
  return (process.env.APP_BASE_URL ?? "http://localhost:3000").replace(
    /\/$/,
    "",
  );
}
