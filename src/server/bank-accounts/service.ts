import "server-only";

import { db } from "@/server/db";
import { bankAccounts } from "@/server/db/schema";
import { eq, asc, desc } from "drizzle-orm";
import type { BankAccountInput } from "@/server/validation/bank-accounts";

export async function listActiveBankAccounts() {
  return await db.query.bankAccounts.findMany({
    where: eq(bankAccounts.isActive, true),
    orderBy: [asc(bankAccounts.sortOrder), desc(bankAccounts.createdAt)],
  });
}

export async function listAllBankAccounts() {
  return await db.query.bankAccounts.findMany({
    orderBy: [asc(bankAccounts.sortOrder), desc(bankAccounts.createdAt)],
  });
}

export async function createBankAccount(data: BankAccountInput) {
  const [account] = await db
    .insert(bankAccounts)
    .values(data)
    .returning();
  return account;
}

export async function updateBankAccount(id: string, data: Partial<BankAccountInput>) {
  const [account] = await db
    .update(bankAccounts)
    .set(data)
    .where(eq(bankAccounts.id, id))
    .returning();
  return account;
}

export async function deleteBankAccount(id: string) {
  await db.delete(bankAccounts).where(eq(bankAccounts.id, id));
}

export async function toggleBankAccount(id: string) {
  const account = await db.query.bankAccounts.findFirst({
    where: eq(bankAccounts.id, id),
  });
  if (!account) throw new Error("Bank account not found");
  
  const [updated] = await db
    .update(bankAccounts)
    .set({ isActive: !account.isActive })
    .where(eq(bankAccounts.id, id))
    .returning();
  return updated;
}
