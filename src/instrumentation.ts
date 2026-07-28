/**
 * تُحمَّل مرة واحدة عند إقلاع الخادم (Next instrumentation).
 *
 * الحارس أدناه يمنع انهيار العملية بأكملها بسبب Unhandled Rejection:
 * في بيئة serverless (Vercel Fluid) قد يُجمَّد الخادم بعد إرسال الرد بينما
 * لا تزال استعلامات قاعدة بيانات يتيمة (من render أُجهض) في الطريق؛ عند
 * الاستئناف يصل خطأ إلغائها (statement timeout ونحوه) كـ rejection بلا
 * مُعالج، والسلوك الافتراضي في Node يقتل العملية (exit 128) فيفشل الطلب
 * الجاري معه — هكذا كانت /admin تنهار. نسجّل الخطأ ونُبقي العملية حيّة.
 */
export async function register() {
  // يُستدعى أيضًا في بيئة Edge (middleware) حيث لا يوجد process.on —
  // نقيّد الحارس ببيئة Node.js فقط وإلا فشل الـ middleware ذاته.
  if (process.env.NEXT_RUNTIME === "nodejs") {
    process.on("unhandledRejection", (reason) => {
      console.error("[instrumentation] unhandledRejection (swallowed):", reason);
    });
  }
}
