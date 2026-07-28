import { requireApiPermission } from "@/server/auth/api";
import { PERMISSIONS } from "@/server/auth/rbac";
import { saveAttachment } from "@/server/storage";
import { handleError, jsonError, jsonOk } from "@/server/http";

export const runtime = "nodejs";

const MAX_IMAGE_BYTES = 2 * 1024 * 1024; // 2MB — تُخزَّن base64 في القاعدة
const ALLOWED_MIMES = ["image/jpeg", "image/png", "image/webp"];

/** رفع صورة منتج (multipart: image) — تُربط بالمنتج عند حفظ النموذج. */
export async function POST(req: Request) {
  try {
    const user = await requireApiPermission(PERMISSIONS.productsEdit);

    const form = await req.formData().catch(() => null);
    if (!form) return jsonError("نموذج غير صالح.", 400);

    const image = form.get("image");
    if (!(image instanceof File) || image.size === 0) {
      return jsonError("تحقق من الحقول المدخلة.", 422, {
        code: "validation",
        fieldErrors: { image: "اختر صورة للمنتج." },
      });
    }
    if (image.size > MAX_IMAGE_BYTES) {
      return jsonError("تحقق من الحقول المدخلة.", 422, {
        code: "validation",
        fieldErrors: { image: "الحد الأقصى لحجم الصورة 2MB." },
      });
    }
    if (!ALLOWED_MIMES.includes(image.type)) {
      return jsonError("تحقق من الحقول المدخلة.", 422, {
        code: "validation",
        fieldErrors: { image: "صيغة غير مدعومة — المسموح: JPG, PNG, WEBP." },
      });
    }

    const buffer = Buffer.from(await image.arrayBuffer());
    const att = await saveAttachment({
      ownerId: user.id,
      buffer,
      mime: image.type,
      fileName: image.name || null,
    });

    return jsonOk({ id: att.id }, 201);
  } catch (err) {
    return handleError(err);
  }
}
