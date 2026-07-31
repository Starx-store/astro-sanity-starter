import "server-only";
import { and, desc, eq, ilike, or } from "drizzle-orm";
import { db } from "@/server/db";
import { newsArticles, type NewsArticle } from "@/server/db/schema";
import { AppError } from "@/server/errors";

export interface CreateNewsInput {
  title: string;
  content: string;
  category: "update" | "tip" | "news";
  imageUrl?: string | null;
  isPinned?: boolean;
}

export interface UpdateNewsInput {
  title?: string;
  content?: string;
  category?: "update" | "tip" | "news";
  imageUrl?: string | null;
  isPinned?: boolean;
}

/**
 * جلب الأخبار والتحديثات والنصائح المنشورة للعملاء
 */
export async function getPublishedNews(params?: {
  category?: string;
  search?: string;
  limit?: number;
}): Promise<NewsArticle[]> {
  const limit = params?.limit || 50;
  const conditions = [];

  if (params?.category && ["update", "tip", "news"].includes(params.category)) {
    conditions.push(eq(newsArticles.category, params.category as "update" | "tip" | "news"));
  }

  if (params?.search && params.search.trim()) {
    const q = `%${params.search.trim()}%`;
    conditions.push(
      or(
        ilike(newsArticles.title, q),
        ilike(newsArticles.content, q)
      )
    );
  }

  return db
    .select()
    .from(newsArticles)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(newsArticles.isPinned), desc(newsArticles.publishedAt))
    .limit(limit);
}

/**
 * جلب خبر أو نصيحة محددة بحسب المعرّف
 */
export async function getNewsArticleById(id: string): Promise<NewsArticle | null> {
  const [article] = await db
    .select()
    .from(newsArticles)
    .where(eq(newsArticles.id, id))
    .limit(1);
  return article || null;
}

/**
 * جلب كل المقالات والأخبار للأدمن
 */
export async function adminGetNewsArticles(): Promise<NewsArticle[]> {
  return db
    .select()
    .from(newsArticles)
    .orderBy(desc(newsArticles.isPinned), desc(newsArticles.createdAt));
}

/**
 * إنشاء خبر أو نصيحة جديدة (أدمن)
 */
export async function adminCreateNewsArticle(input: CreateNewsInput): Promise<NewsArticle> {
  if (!input.title.trim()) {
    throw new AppError("title_required", "عنوان الخبر أو النصيحة مطلوب.", 400);
  }
  if (!input.content.trim()) {
    throw new AppError("content_required", "محتوى الخبر أو النصيحة مطلوب.", 400);
  }

  const [article] = await db
    .insert(newsArticles)
    .values({
      title: input.title.trim(),
      content: input.content.trim(),
      category: input.category || "news",
      imageUrl: input.imageUrl?.trim() || null,
      isPinned: input.isPinned ?? false,
      publishedAt: new Date(),
    })
    .returning();

  return article;
}

/**
 * تحديث خبر أو نصيحة موجودة (أدمن)
 */
export async function adminUpdateNewsArticle(
  id: string,
  input: UpdateNewsInput
): Promise<NewsArticle> {
  const [existing] = await db
    .select()
    .from(newsArticles)
    .where(eq(newsArticles.id, id))
    .limit(1);

  if (!existing) {
    throw new AppError("not_found", "الخبر أو النصيحة غير موجودة.", 404);
  }

  const [updated] = await db
    .update(newsArticles)
    .set({
      title: input.title !== undefined ? input.title.trim() : existing.title,
      content: input.content !== undefined ? input.content.trim() : existing.content,
      category: input.category !== undefined ? input.category : existing.category,
      imageUrl: input.imageUrl !== undefined ? input.imageUrl?.trim() || null : existing.imageUrl,
      isPinned: input.isPinned !== undefined ? input.isPinned : existing.isPinned,
      updatedAt: new Date(),
    })
    .where(eq(newsArticles.id, id))
    .returning();

  return updated;
}

/**
 * حذف خبر أو نصيحة (أدمن)
 */
export async function adminDeleteNewsArticle(id: string): Promise<void> {
  await db.delete(newsArticles).where(eq(newsArticles.id, id));
}
