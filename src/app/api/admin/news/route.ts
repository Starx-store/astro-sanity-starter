import { requireApiPermission } from "@/server/auth/api";
import { PERMISSIONS } from "@/server/auth/rbac";
import {
  adminGetNewsArticles,
  adminCreateNewsArticle,
} from "@/server/news/service";
import { handleError, jsonOk, parseBody } from "@/server/http";
import { z } from "zod";

export const runtime = "nodejs";

const createNewsSchema = z.object({
  title: z.string().min(2, "العنوان يجب أن يكون حرفين على الأقل"),
  content: z.string().min(5, "المحتوى يجب أن يكون 5 أحرف على الأقل"),
  category: z.enum(["update", "tip", "news"]),
  imageUrl: z.string().optional().nullable(),
  isPinned: z.boolean().optional(),
});

export async function GET() {
  try {
    await requireApiPermission(PERMISSIONS.settingsEdit);
    const articles = await adminGetNewsArticles();
    return jsonOk({ articles });
  } catch (err) {
    return handleError(err);
  }
}

export async function POST(req: Request) {
  try {
    await requireApiPermission(PERMISSIONS.settingsEdit);
    const parsed = await parseBody(req, createNewsSchema);
    if (!parsed.success) return parsed.response;

    const article = await adminCreateNewsArticle(parsed.data);
    return jsonOk({ article }, 201);
  } catch (err) {
    return handleError(err);
  }
}
