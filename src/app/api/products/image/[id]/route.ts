import { and, eq, ne } from "drizzle-orm";
import { db } from "@/server/db";
import { attachments, products } from "@/server/db/schema";
import { readAttachment } from "@/server/storage";
import { getSessionUser } from "@/server/auth/session";
import { handleError, jsonError } from "@/server/http";
import { isUuid } from "@/lib/utils";

export const runtime = "nodejs";

/**
 * تقديم صور المنتجات للعموم — بلا مصادقة، لكن بشرط صارم:
 * المعرّف يُقدَّم فقط إذا كان مستخدمًا كـ imageId لمنتج غير مخفي.
 * المرفقات الأخرى (إثباتات الإيداع ونحوها) تبقى خاصة عبر /api/files/[id].
 */
export async function GET(_req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    if (!isUuid(params.id)) return jsonError("الصورة غير موجودة.", 404);

    // الصورة عامة فقط إن كانت مربوطة بمنتج ظاهر في المتجر.
    const [used] = await db
      .select({ id: products.id, traderOnly: products.traderOnly })
      .from(products)
      .where(and(eq(products.imageId, params.id), ne(products.status, "hidden")))
      .limit(1);
    if (!used) return jsonError("الصورة غير موجودة.", 404);

    // صورة منتج حصري للتجار: نفس منظور صفحة المنتج — غير موجودة لغيرهم.
    let traderPrivate = false;
    if (used.traderOnly) {
      const viewer = await getSessionUser();
      if (!viewer?.isTrader) return jsonError("الصورة غير موجودة.", 404);
      traderPrivate = true;
    }

    const [att] = await db
      .select()
      .from(attachments)
      .where(eq(attachments.id, params.id))
      .limit(1);
    if (!att || !att.mime?.startsWith("image/")) {
      return jsonError("الصورة غير موجودة.", 404);
    }

    const data = await readAttachment(att);
    return new Response(new Uint8Array(data), {
      headers: {
        "Content-Type": att.mime,
        // محتوى المرفق لا يتغيّر لنفس المعرّف — تغيير الصورة ينشئ معرّفًا جديدًا.
        // صور منتجات التجار خاصة كي لا تبقى في كاش وسيط بعد سحب صفة التاجر.
        "Cache-Control": traderPrivate
          ? "private, max-age=3600"
          : "public, max-age=31536000, immutable",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (err) {
    return handleError(err);
  }
}
