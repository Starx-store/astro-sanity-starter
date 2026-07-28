import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/server/db";
import { settings } from "@/server/db/schema";

/**
 * إعدادات المتجر (جدول key/value JSONB). قيم معروفة:
 * store.name, store.currency, store.min_deposit, store.maintenance
 */

export type SettingsMap = Record<string, unknown>;

export async function getAllSettings(): Promise<SettingsMap> {
  const rows = await db.select().from(settings);
  const map: SettingsMap = {};
  for (const r of rows) map[r.key] = r.value;
  return map;
}

export async function getSetting<T = unknown>(
  key: string,
  fallback: T,
): Promise<T> {
  const [row] = await db
    .select()
    .from(settings)
    .where(eq(settings.key, key))
    .limit(1);
  return row ? (row.value as T) : fallback;
}

export async function setSetting(key: string, value: unknown): Promise<void> {
  await db
    .insert(settings)
    .values({ key, value: value as object })
    .onConflictDoUpdate({
      target: settings.key,
      set: { value: value as object, updatedAt: new Date() },
    });
}

export async function isMaintenanceMode(): Promise<boolean> {
  try {
    return (await getSetting<boolean>("store.maintenance", false)) === true;
  } catch {
    return false;
  }
}
