import { NextResponse } from "next/server";
import { ZodError, type ZodSchema } from "zod";
import { AppError } from "@/server/errors";

export type FieldErrors = Record<string, string>;

export function zodToFieldErrors(err: ZodError): FieldErrors {
  const out: FieldErrors = {};
  for (const issue of err.issues) {
    const key = issue.path.join(".") || "_";
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}

export function jsonOk<T>(data: T, status = 200) {
  return NextResponse.json({ ok: true, data }, { status });
}

export function jsonError(
  message: string,
  status = 400,
  extra?: { code?: string; fieldErrors?: FieldErrors },
) {
  return NextResponse.json(
    { ok: false, error: message, ...extra },
    { status },
  );
}

/** يقرأ ويتحقق من جسم الطلب JSON مقابل مخطط Zod. */
export async function parseBody<T>(
  req: Request,
  schema: ZodSchema<T>,
): Promise<
  | { success: true; data: T }
  | { success: false; response: NextResponse }
> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return {
      success: false,
      response: jsonError("جسم الطلب غير صالح (JSON).", 400),
    };
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return {
      success: false,
      response: jsonError("تحقق من الحقول المدخلة.", 422, {
        code: "validation",
        fieldErrors: zodToFieldErrors(parsed.error),
      }),
    };
  }
  return { success: true, data: parsed.data };
}

/** يحوّل أخطاء التطبيق (مصادقة/محفظة/...) إلى استجابة موحّدة. */
export function handleError(err: unknown) {
  if (err instanceof AppError) {
    return jsonError(err.message, err.status, {
      code: err.code,
      fieldErrors: err.fieldErrors,
    });
  }
  console.error("[api] unhandled error:", err);
  return jsonError("حدث خطأ غير متوقع. حاول لاحقًا.", 500, {
    code: "internal",
  });
}
