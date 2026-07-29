import "server-only";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/server/db";
import {
  categories,
  products,
  productPackages,
  productQuantityConfig,
  productStockItems,
  providerProducts,
  priceTiers,
  orders,
} from "@/server/db/schema";
import { AppError, isPgError } from "@/server/errors";
import type { CategoryInput, ProductInput } from "@/server/validation/catalog";

/**
 * خدمة الكتالوج — إدارة التصنيفات والمنتجات (بكجات/كمية/شرائح) ذريًّا.
 */

const nullable = (v: string | undefined) => (v?.trim() ? v.trim() : null);

/* ------------------------------------------------------------------ */
/*  التصنيفات                                                          */
/* ------------------------------------------------------------------ */

export async function createCategory(input: CategoryInput) {
  try {
    const [row] = await db
      .insert(categories)
      .values({
        name: input.name,
        slug: input.slug,
        icon: nullable(input.icon),
        sortOrder: input.sortOrder,
        isVisible: input.isVisible,
      })
      .returning();
    return row;
  } catch (e) {
    if (isPgError(e, "23505")) {
      throw new AppError("slug_taken", "هذا المعرّف مستخدم مسبقًا.", 409, {
        slug: "المعرّف مستخدم — اختر غيره",
      });
    }
    throw e;
  }
}

export async function updateCategory(id: string, input: CategoryInput) {
  try {
    const [row] = await db
      .update(categories)
      .set({
        name: input.name,
        slug: input.slug,
        icon: nullable(input.icon),
        sortOrder: input.sortOrder,
        isVisible: input.isVisible,
        updatedAt: new Date(),
      })
      .where(eq(categories.id, id))
      .returning();
    if (!row) throw new AppError("not_found", "التصنيف غير موجود.", 404);
    return row;
  } catch (e) {
    if (isPgError(e, "23505")) {
      throw new AppError("slug_taken", "هذا المعرّف مستخدم مسبقًا.", 409, {
        slug: "المعرّف مستخدم — اختر غيره",
      });
    }
    throw e;
  }
}

export async function deleteCategory(id: string) {
  try {
    const deleted = await db
      .delete(categories)
      .where(eq(categories.id, id))
      .returning({ id: categories.id });
    if (deleted.length === 0) {
      throw new AppError("not_found", "التصنيف غير موجود.", 404);
    }
  } catch (e) {
    if (isPgError(e, "23503")) {
      throw new AppError(
        "category_in_use",
        "لا يمكن حذف تصنيف مرتبط بمنتجات — انقل منتجاته أو أخفِه.",
        409,
      );
    }
    throw e;
  }
}

/* ------------------------------------------------------------------ */
/*  المنتجات                                                           */
/* ------------------------------------------------------------------ */

function productValues(input: ProductInput) {
  return {
    name: input.name,
    slug: input.slug,
    categoryId: input.categoryId,
    type: input.type,
    fulfillment: input.fulfillment,
    status: input.status,
    imageId: input.imageId ?? null,
    description: nullable(input.description),
    executionTime: nullable(input.executionTime),
    terms: nullable(input.terms),
    warranty: nullable(input.warranty),
    sortOrder: input.sortOrder,
    traderOnly: input.traderOnly,
    requiredFields: input.requiredFields,
  };
}

async function syncChildren(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  productId: string,
  input: ProductInput,
) {
  if (input.type === "package") {
    // مزامنة البكجات: تحديث الموجود، إدراج الجديد، حذف المحذوف (مقيّدة بهذا المنتج فقط).
    const keptIds = input.packages
      .map((p) => p.id)
      .filter((v): v is string => !!v);

    const existing = await tx
      .select({ id: productPackages.id })
      .from(productPackages)
      .where(eq(productPackages.productId, productId));
    const toDelete = existing
      .map((r) => r.id)
      .filter((id) => !keptIds.includes(id));
    if (toDelete.length > 0) {
      await tx
        .delete(productPackages)
        .where(inArray(productPackages.id, toDelete));
    }

    for (const p of input.packages) {
      const values = {
        productId,
        name: p.name,
        description: nullable(p.description),
        salePrice: p.salePrice || "0",
        traderPrice: p.traderPrice?.trim() ? p.traderPrice : null,
        costPrice: p.costPrice || "0",
        quantity: p.quantity || "1",
        packageType: p.packageType || "fixed",
        pricePer1000: p.pricePer1000?.trim() ? p.pricePer1000 : null,
        traderPricePer1000: p.traderPricePer1000?.trim() ? p.traderPricePer1000 : null,
        minQty: p.minQty || "1",
        maxQty: p.maxQty?.trim() ? p.maxQty : null,
        isAvailable: p.isAvailable,
        sortOrder: p.sortOrder,
        providerId: p.providerId || null,
        externalProductId: p.externalProductId || null,
        fallbackProviderId: p.fallbackProviderId || null,
        fallbackExternalProductId: p.fallbackExternalProductId || null,
        updatedAt: new Date(),
      };
      if (p.id) {
        await tx
          .update(productPackages)
          .set(values)
          .where(eq(productPackages.id, p.id));
      } else {
        await tx.insert(productPackages).values(values);
      }
    }
  }

  if (input.type === "quantity" && input.qtyConfig) {
    const cfg = input.qtyConfig;
    const values = {
      productId,
      unit: cfg.unit,
      minQty: cfg.minQty,
      maxQty: cfg.maxQty?.trim() ? cfg.maxQty : null,
      pricePerUnit: cfg.pricePerUnit?.trim() ? cfg.pricePerUnit : null,
      pricePer1000: cfg.pricePer1000?.trim() ? cfg.pricePer1000 : null,
      traderPricePerUnit: cfg.traderPricePerUnit?.trim()
        ? cfg.traderPricePerUnit
        : null,
      traderPricePer1000: cfg.traderPricePer1000?.trim()
        ? cfg.traderPricePer1000
        : null,
      costPrice: cfg.costPrice || "0",
      updatedAt: new Date(),
    };
    const [existing] = await tx
      .select({ id: productQuantityConfig.id })
      .from(productQuantityConfig)
      .where(eq(productQuantityConfig.productId, productId))
      .limit(1);
    if (existing) {
      await tx
        .update(productQuantityConfig)
        .set(values)
        .where(eq(productQuantityConfig.id, existing.id));
    } else {
      await tx.insert(productQuantityConfig).values(values);
    }

    // مزامنة الشرائح
    const existingTiers = await tx
      .select({ id: priceTiers.id })
      .from(priceTiers)
      .where(eq(priceTiers.productId, productId));
    const keptTierIds = input.tiers
      .map((t) => t.id)
      .filter((v): v is string => !!v);
    const tierDelete = existingTiers
      .map((r) => r.id)
      .filter((id) => !keptTierIds.includes(id));
    if (tierDelete.length > 0) {
      await tx.delete(priceTiers).where(inArray(priceTiers.id, tierDelete));
    }
    for (const t of input.tiers) {
      const tv = {
        productId,
        minQty: t.minQty,
        maxQty: t.maxQty?.trim() ? t.maxQty : null,
        pricePerUnit: t.pricePerUnit,
      };
      if (t.id) {
        await tx.update(priceTiers).set(tv).where(eq(priceTiers.id, t.id));
      } else {
        await tx.insert(priceTiers).values(tv);
      }
    }
  }
}

export async function createProduct(input: ProductInput): Promise<string> {
  try {
    return await db.transaction(async (tx) => {
      const [product] = await tx
        .insert(products)
        .values(productValues(input))
        .returning({ id: products.id });
      await syncChildren(tx, product.id, input);
      return product.id;
    });
  } catch (e) {
    if (isPgError(e, "23505")) {
      throw new AppError("slug_taken", "معرّف المنتج مستخدم مسبقًا.", 409, {
        slug: "المعرّف مستخدم — اختر غيره",
      });
    }
    throw e;
  }
}

export async function updateProduct(id: string, input: ProductInput) {
  try {
    await db.transaction(async (tx) => {
      const [existing] = await tx
        .select({ id: products.id, type: products.type })
        .from(products)
        .where(eq(products.id, id))
        .for("update");
      if (!existing) throw new AppError("not_found", "المنتج غير موجود.", 404);
      if (existing.type !== input.type) {
        throw new AppError(
          "type_locked",
          "لا يمكن تغيير نوع المنتج بعد إنشائه.",
          409,
        );
      }
      await tx
        .update(products)
        .set({ ...productValues(input), updatedAt: new Date() })
        .where(eq(products.id, id));
      await syncChildren(tx, id, input);
    });
  } catch (e) {
    if (isPgError(e, "23505")) {
      throw new AppError("slug_taken", "معرّف المنتج مستخدم مسبقًا.", 409, {
        slug: "المعرّف مستخدم — اختر غيره",
      });
    }
    throw e;
  }
}

/**
 * حذف منتج. المنتجات التي لها طلبات لا تُحذف فعليًا (سجل الطلبات والقيود
 * المالية يجب أن يبقى سليمًا) — بدلًا من الفشل نؤرشفها: تُخفى من المتجر
 * ويُفكّ ربطها بالمزوّد ويُحذف مخزونها المتاح، فتختفي عمليًا عن العملاء.
 */
export async function deleteProduct(
  id: string,
): Promise<{ deleted: boolean; archived: boolean }> {
  // فحص ما إذا كان للمنتج أي طلبات سابقة
  const [existingOrder] = await db
    .select({ id: orders.id })
    .from(orders)
    .where(eq(orders.productId, id))
    .limit(1);

  if (existingOrder) {
    // للمنتج طلبات سابقة ⇒ يُؤرشف (يُخفى) للحفاظ على سجل الطلبات والقيود المالية
    const [row] = await db
      .update(products)
      .set({ status: "hidden", updatedAt: new Date() })
      .where(eq(products.id, id))
      .returning({ id: products.id });

    if (!row) {
      throw new AppError("not_found", "المنتج غير موجود.", 404);
    }

    // فك الربط بالمزوّد وإزالة المخزون المتاح غير المباع
    await db.delete(providerProducts).where(eq(providerProducts.productId, id));
    await db
      .delete(productStockItems)
      .where(
        and(
          eq(productStockItems.productId, id),
          eq(productStockItems.status, "available"),
        ),
      );

    return { deleted: false, archived: true };
  }

  // ليس له طلبات سابقة ⇒ يُحذف كلياً
  try {
    const deleted = await db
      .delete(products)
      .where(eq(products.id, id))
      .returning({ id: products.id });
    if (deleted.length === 0) {
      throw new AppError("not_found", "المنتج غير موجود.", 404);
    }
    return { deleted: true, archived: false };
  } catch (e) {
    // احتياط لقيد المفاتيح الأجنبية
    const [row] = await db
      .update(products)
      .set({ status: "hidden", updatedAt: new Date() })
      .where(eq(products.id, id))
      .returning({ id: products.id });
    if (!row) throw new AppError("not_found", "المنتج غير موجود.", 404);
    return { deleted: false, archived: true };
  }
}
