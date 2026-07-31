import { requireApiPermission } from "@/server/auth/api";
import { PERMISSIONS } from "@/server/auth/rbac";
import {
  adminUpdateNewsArticle,
  adminDeleteNewsArticle,
} from "@/server/news/service";
import { handleError, jsonOk, parseBody } from "@/server/http";
import { z } from "zod";

export const runtime = "nodejs";

const updateNewsSchema = z.object({
  title: z.string().min(2).optional(),
  content: z.string().min(5).optional(),
  category: z.enum(["update", "tip", "news"]).optional(),
  imageUrl: z.string().optional().nullable(),
  isPinned: z.boolean().optional(),
});

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireApiPermission(PERMISSIONS.settingsEdit);
    const { id } = await params;
    const parsed = await parseBody(req, updateNewsSchema);
    if (!parsed.success) return parsed.response;

    const article = await adminUpdateNewsArticle(id, parsed.data);
    return jsonOk({ article });
  } catch (err) {
    return handleError(err);
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireApiPermission(PERMISSIONS.settingsEdit);
    const { id } = await params;
    await adminDeleteNewsArticle(id);
    return jsonOk({ deleted: true });
  } catch (err) {
    return handleError(err);
  }
}
