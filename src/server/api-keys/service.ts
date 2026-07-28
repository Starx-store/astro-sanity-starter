import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/server/db";
import { users } from "@/server/db/schema";
import { randomBytes } from "crypto";

/**
 * Generate a secure 32-character hex API key.
 */
function generateApiKey(): string {
  return randomBytes(16).toString("hex");
}

export async function getUserApiKey(userId: string): Promise<string | null> {
  const [user] = await db
    .select({ apiKey: users.apiKey })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return user?.apiKey || null;
}

export async function generateUserApiKey(userId: string): Promise<string> {
  const key = generateApiKey();
  await db.update(users).set({ apiKey: key }).where(eq(users.id, userId));
  return key;
}

export async function validateApiKey(apiKey: string) {
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.apiKey, apiKey))
    .limit(1);
  return user || null;
}
