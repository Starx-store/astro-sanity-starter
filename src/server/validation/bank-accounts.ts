import { z } from "zod";

export const bankAccountSchema = z.object({
  bankName: z.string().trim().min(2, "اسم البنك مطلوب").max(100),
  accountName: z.string().trim().min(2, "اسم صاحب الحساب مطلوب").max(100),
  accountNumber: z.string().trim().min(4, "رقم الحساب مطلوب").max(50),
  iban: z.string().trim().max(50).optional().or(z.literal("")),
  currency: z.string().trim().min(1).max(10).default("SAR"),
  notes: z.string().trim().max(500).optional().or(z.literal("")),
  logo: z.string().trim().max(200).optional().or(z.literal("")),
  isActive: z.boolean().default(true),
  sortOrder: z.number().int().min(0).default(0),
});

export type BankAccountInput = z.infer<typeof bankAccountSchema>;
