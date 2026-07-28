import "server-only";
import { z } from "zod";
import { jsonOk, parseBody, handleError } from "@/server/http";
import { requireApiPermission } from "@/server/auth/api";
import { PERMISSIONS } from "@/server/auth/rbac";
import { broadcastNotification } from "@/server/notifications/broadcast";

const broadcastSchema = z.object({
  title: z.string().trim().min(2, "العنوان قصير جداً").max(200, "العنوان طويل جداً"),
  body: z.string().trim().max(2000, "النص طويل جداً").optional().or(z.literal("")),
});

export async function POST(req: Request) {
  try {
    await requireApiPermission(PERMISSIONS.settingsEdit);

    const parsed = await parseBody(req, broadcastSchema);
    if (!parsed.success) return parsed.response;

    const count = await broadcastNotification({
      title: parsed.data.title,
      body: parsed.data.body || "",
    });

    return jsonOk({ count });
  } catch (err) {
    return handleError(err);
  }
}
