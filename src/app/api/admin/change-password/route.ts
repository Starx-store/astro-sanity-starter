import { NextResponse } from "next/server";
import { getSessionUser } from "@/server/auth/session";
import { changePasswordSchema } from "@/server/validation/auth";
import { changeUserPassword } from "@/server/auth/service";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "غير مصرح به" }, { status: 401 });
  }

  const json = await req.json().catch(() => null);
  const parse = changePasswordSchema.safeParse(json);
  if (!parse.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parse.error.issues) {
      const field = String(issue.path[0] || "");
      if (field && !fieldErrors[field]) {
        fieldErrors[field] = issue.message;
      }
    }
    return NextResponse.json(
      { ok: false, error: "بيانات غير صالحة", fieldErrors },
      { status: 400 },
    );
  }

  try {
    await changeUserPassword(user.id, {
      currentPassword: parse.data.currentPassword,
      newPassword: parse.data.newPassword,
    });
    return NextResponse.json({ ok: true, message: "تم تغيير كلمة المرور بنجاح" });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err.message || "فشل تغيير كلمة المرور" },
      { status: err.statusCode || 400 },
    );
  }
}
