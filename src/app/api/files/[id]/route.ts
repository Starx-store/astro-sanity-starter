import { eq } from "drizzle-orm";
import { db } from "@/server/db";
import { attachments } from "@/server/db/schema";
import { requireApiUser } from "@/server/auth/api";
import { isStaffOrAdmin } from "@/server/auth/rbac";
import { readAttachment } from "@/server/storage";
import { handleError, jsonError } from "@/server/http";
import { isUuid } from "@/lib/utils";

export const runtime = "nodejs";

/**
 * تقديم المرفقات الخاصة — للمالك أو للإدارة فقط.
 * لا وصول مباشر للملفات على القرص؛ كل شيء عبر هذه النقطة بعد التحقق.
 */
export async function GET(_req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const user = await requireApiUser();

    if (!isUuid(params.id)) return jsonError("الملف غير موجود.", 404);

    const [att] = await db
      .select()
      .from(attachments)
      .where(eq(attachments.id, params.id))
      .limit(1);
    if (!att) return jsonError("الملف غير موجود.", 404);

    const allowed = att.ownerId === user.id || isStaffOrAdmin(user);
    if (!allowed) return jsonError("غير مصرّح بالوصول لهذا الملف.", 403);

    const data = await readAttachment(att);
    return new Response(new Uint8Array(data), {
      headers: {
        "Content-Type": att.mime ?? "application/octet-stream",
        "Content-Disposition": `inline; filename="${encodeURIComponent(att.fileName ?? att.id)}"`,
        "Cache-Control": "private, max-age=0, must-revalidate",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (err) {
    return handleError(err);
  }
}
