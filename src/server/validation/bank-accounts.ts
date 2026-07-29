import { z } from "zod";

export const bankAccountSchema = z.object({
  bankName: z.string().trim().min(1, "اسم البنك مطلوب").max(100),
  accountName: z.string().trim().min(1, "اسم صاحب الحساب مطلوب").max(100),
  accountNumber: z.string().trim().min(1, "رقم الحساب مطلوب").max(50),
  iban: z.string().nullish().transform((val) => val?.trim() || ""),
  currency: z.string().nullish().transform((val) => val?.trim() || "SAR"),
  notes: z.string().nullish().transform((val) => val?.trim() || ""),
  logo: z.string().nullish().transform((val) => val?.trim() || ""),
  isActive: z.boolean().default(true),
  sortOrder: z.coerce.number().int().min(0).default(0),
});

export type BankAccountInput = z.infer<typeof bankAccountSchema>;
