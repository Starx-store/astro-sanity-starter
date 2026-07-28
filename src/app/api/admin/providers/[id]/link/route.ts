import { requireApiPermission } from "@/server/auth/api";
import { PERMISSIONS } from "@/server/auth/rbac";
import { linkProduct } from "@/server/providers/service";
import { linkProductSchema } from "@/server/validation/providers";
import { handleError, jsonError, jsonOk, parseBody } from "@/server/http";
import { isUuid } from "@/lib/utils";

export const runtime = "nodejs";

/** ربط منتج بمزوّد بمعرّفه الخارجي. */
export async function POST(req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    await requireApiPermission(PERMISSIONS.providersManage);
    if (!isUuid(params.id)) return jsonError("المزوّد غير موجود.", 404);
    const parsed = await parseBody(req, linkProductSchema);
    if (!parsed.success) return parsed.response;

    await linkProduct({
      providerId: params.id,
      productId: parsed.data.productId,
      externalProductId: parsed.data.externalProductId,
      externalPrice: parsed.data.externalPrice || null,
    });
    return jsonOk({ linked: true }, 201);
  } catch (err) {
    return handleError(err);
  }
}
