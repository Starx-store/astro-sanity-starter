import { requireApiUser } from "@/server/auth/api";
import { createDepositRequest } from "@/server/wallet/deposits";
import { amountFieldSchema } from "@/server/validation/wallet";
import { handleError, jsonError, jsonOk } from "@/server/http";
import { enforceRateLimit } from "@/server/rate-limit";

export const runtime = "nodejs";

const MAX_PROOF_BYTES = 4 * 1024 * 1024; // 4MB (تحت حد جسم الطلب في Vercel)
const ALLOWED_MIMES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
];

/** إنشاء طلب شحن يدوي (multipart: amount + proof). */
export async function POST(req: Request) {
  try {
    const user = await requireApiUser();
    await enforceRateLimit({ key: "deposit", limit: 10, windowMs: 5 * 60_000, identifier: user.id });

    const form = await req.formData().catch(() => null);
    if (!form) return jsonError("نموذج غير صالح.", 400);

    const amountParsed = amountFieldSchema.safeParse(
      String(form.get("amount") ?? ""),
    );
    if (!amountParsed.success) {
      return jsonError("تحقق من الحقول المدخلة.", 422, {
        code: "validation",
        fieldErrors: { amount: amountParsed.error.issues[0].message },
      });
    }

    const proof = form.get("proof");
    if (!(proof instanceof File) || proof.size === 0) {
      return jsonError("تحقق من الحقول المدخلة.", 422, {
        code: "validation",
        fieldErrors: { proof: "إثبات التحويل مطلوب (صورة أو PDF)." },
      });
    }
    if (proof.size > MAX_PROOF_BYTES) {
      return jsonError("تحقق من الحقول المدخلة.", 422, {
        code: "validation",
        fieldErrors: { proof: "الحد الأقصى لحجم الملف 4MB." },
      });
    }
    if (!ALLOWED_MIMES.includes(proof.type)) {
      return jsonError("تحقق من الحقول المدخلة.", 422, {
        code: "validation",
        fieldErrors: { proof: "صيغة غير مدعومة — المسموح: JPG, PNG, WEBP, PDF." },
      });
    }

    const buffer = Buffer.from(await proof.arrayBuffer());
    const deposit = await createDepositRequest({
      userId: user.id,
      amount: amountParsed.data,
      proof: { buffer, mime: proof.type, fileName: proof.name || null },
    });

    return jsonOk(
      { deposit: { id: deposit.id, amount: deposit.amount, status: deposit.status } },
      201,
    );
  } catch (err) {
    return handleError(err);
  }
}
