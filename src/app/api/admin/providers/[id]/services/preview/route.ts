import { z } from "zod";
import { requireApiPermission } from "@/server/auth/api";
import { PERMISSIONS } from "@/server/auth/rbac";
import { translateServiceName } from "@/server/providers/translate";
import { handleError, jsonOk, parseBody } from "@/server/http";

export const runtime = "nodejs";

const schema = z.object({
  items: z
    .array(
      z.object({
        externalId: z.string().trim().min(1),
        name: z.string().trim().max(500),
        category: z.string().trim().max(200).nullable().optional(),
      }),
    )
    .max(200),
});

/** معاينة الأسماء والأوصاف العربية قبل الاستيراد. */
export async function POST(req: Request) {
  try {
    await requireApiPermission(PERMISSIONS.providersManage);
    const parsed = await parseBody(req, schema);
    if (!parsed.success) return parsed.response;

    return jsonOk({
      items: parsed.data.items.map((i) => ({
        externalId: i.externalId,
        ...translateServiceName(i.name, i.category ?? null),
      })),
    });
  } catch (err) {
    return handleError(err);
  }
}
