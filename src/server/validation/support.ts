import { z } from "zod";

export const createTicketSchema = z.object({
  department: z.enum(["general", "orders", "payments", "technical"], {
    errorMap: () => ({ message: "اختر القسم" }),
  }),
  priority: z.enum(["low", "normal", "high"]).default("normal"),
  relatedOrderId: z.string().uuid().optional().or(z.literal("")),
  subject: z.string().trim().min(3, "العنوان قصير جدًا").max(120),
  body: z.string().trim().min(5, "اكتب تفاصيل المشكلة").max(3000),
});

export const ticketReplySchema = z.object({
  body: z.string().trim().min(1, "اكتب رسالة").max(3000),
});

export const ticketStatusSchema = z.object({
  status: z.enum(["new", "in_progress", "awaiting_customer", "closed"]),
});

export type CreateTicketInput = z.infer<typeof createTicketSchema>;
