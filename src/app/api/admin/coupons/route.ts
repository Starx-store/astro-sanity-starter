import { desc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/server/db";
import { discountCodes } from "@/server/db/schema";
import { requireApiPermission } from "@/server/auth/api";
import { PERMISSIONS } from "@/server/auth/rbac";
import { handleError, jsonOk, jsonError, parseBody } from "@/server/http";
import { nonNegAmountField } from "@/server/validation/catalog";
import { isPgError } from "@/server/errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  code: z
    .string()
    .trim()
    .min(3, "الرمز قصير جدًا")
    .max(40)
    .regex(/^[A-Za-z0-9_-]+$/, "حروف لاتينية وأرقام وشرطات فقط"),
  type: z.enum(["percent", "fixed"]),
  value: z
    .string()
    .trim()
    .regex(/^\d{1,6}(\.\d{1,4})?$/, "قيمة غير صالحة"),
  maxUses: z.coerce.number().int().min(0).max(1_000_000).optional(),
  perUserLimit: z.coerce.number().int().min(0).max(1000).optional(),
  minAmount: nonNegAmountField.optional().or(z.literal("")),
  endsAt: z.string().trim().optional().or(z.literal("")),
  isActive: z.boolean().default(true),
});

const deleteSchema = z.object({ id: z.string().uuid() });

export async function GET() {
  try {
    await requireApiPermission(PERMISSIONS.settingsEdit);
    const items = await db
      .select()
      .from(discountCodes)
      .orderBy(desc(discountCodes.createdAt))
      .limit(200);
    return jsonOk({ items });
  } catch (err) {
    return handleError(err);
  }
}

export async function POST(req: Request) {
  try {
    await requireApiPermission(PERMISSIONS.settingsEdit);
    const parsed = await parseBody(req, schema);
    if (!parsed.success) return parsed.response;
    const d = parsed.data;

    if (d.type === "percent" && Number(d.value) > 100) {
      return jsonError("نسبة الخصم لا تتجاوز 100%.", 422);
    }

    try {
      const [created] = await db
        .insert(discountCodes)
        .values({
          code: d.code.toUpperCase(),
          type: d.type,
          value: d.value,
          maxUses: d.maxUses && d.maxUses > 0 ? d.maxUses : null,
          perUserLimit:
            d.perUserLimit && d.perUserLimit > 0 ? d.perUserLimit : null,
          minAmount: d.minAmount?.trim() ? d.minAmount : null,
          endsAt: d.endsAt?.trim() ? new Date(d.endsAt) : null,
          isActive: d.isActive,
        })
        .returning();
      return jsonOk({ coupon: created }, 201);
    } catch (e) {
      if (isPgError(e, "23505")) {
        return jsonError("هذا الرمز مستخدم مسبقًا.", 409);
      }
      throw e;
    }
  } catch (err) {
    return handleError(err);
  }
}

export async function DELETE(req: Request) {
  try {
    await requireApiPermission(PERMISSIONS.settingsEdit);
    const parsed = await parseBody(req, deleteSchema);
    if (!parsed.success) return parsed.response;

    // نعطّل بدل الحذف حفاظًا على سجل الاستخدامات المرتبطة.
    const [updated] = await db
      .update(discountCodes)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(discountCodes.id, parsed.data.id))
      .returning({ id: discountCodes.id });
    if (!updated) return jsonError("الكوبون غير موجود.", 404);
    return jsonOk({ disabled: true });
  } catch (err) {
    return handleError(err);
  }
}
