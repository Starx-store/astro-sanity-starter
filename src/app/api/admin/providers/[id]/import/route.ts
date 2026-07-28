import { z } from "zod";
import { requireApiPermission } from "@/server/auth/api";
import { PERMISSIONS } from "@/server/auth/rbac";
import { importProviderServices } from "@/server/providers/import";
import { handleError, jsonOk, jsonError, parseBody } from "@/server/http";
import { isUuid } from "@/lib/utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

const schema = z.object({
  categoryId: z.string().uuid("اختر تصنيفًا"),
  markupType: z.enum(["fixed", "percent"]),
  // حتى 6 خانات صحيحة و4 عشرية (يطابق عمود numeric(10,4)).
  markupValue: z
    .string()
    .trim()
    .regex(/^\d{1,6}(\.\d{1,4})?$/, "قيمة الهامش غير صالحة (حد أقصى 999999.9999)"),
  publish: z.boolean().default(false),
  selections: z
    .array(
      z.object({
        externalId: z.string().trim().min(1),
        // أسماء خدمات المزوّد قد تكون طويلة جدًا — نقبل حتى 500 ونقصّها لاحقًا.
        name: z.string().trim().max(500).optional(),
      }),
    )
    .min(1, "اختر خدمة واحدة على الأقل")
    .max(100, "استورد حتى 100 خدمة في المرة"),
});

/** استيراد خدمات مختارة من كتالوج المزوّد كمنتجات بسعر = سعر المزوّد + هامش. */
export async function POST(req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    await requireApiPermission(PERMISSIONS.providersManage);
    if (!isUuid(params.id)) return jsonError("المزوّد غير موجود.", 404);

    const parsed = await parseBody(req, schema);
    if (!parsed.success) return parsed.response;

    const result = await importProviderServices({
      providerId: params.id,
      ...parsed.data,
    });
    return jsonOk(result, 201);
  } catch (err) {
    return handleError(err);
  }
}
