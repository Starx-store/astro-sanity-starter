import "server-only";
import { and, asc, desc, eq } from "drizzle-orm";
import { db } from "@/server/db";
import {
  supportTickets,
  supportMessages,
  notifications,
  orders,
  type SupportTicket,
  type SupportMessage,
} from "@/server/db/schema";
import { AppError } from "@/server/errors";
import { generateReferenceNo } from "@/server/auth/tokens";
import { notifyAdmin } from "@/server/email";
import type { CreateTicketInput } from "@/server/validation/support";
import type { SessionUser } from "@/server/auth/session";

/** أول رسالة تحمل العنوان + التفاصيل معًا. */
export async function createTicket(
  userId: string,
  input: CreateTicketInput,
): Promise<SupportTicket> {
  if (input.relatedOrderId) {
    const [order] = await db
      .select({ id: orders.id })
      .from(orders)
      .where(and(eq(orders.id, input.relatedOrderId), eq(orders.userId, userId)))
      .limit(1);
    if (!order) {
      throw new AppError("order_not_found", "الطلب المرتبط غير موجود.", 404, {
        relatedOrderId: "طلب غير صالح",
      });
    }
  }

  const ticket = await db.transaction(async (tx) => {
    const [created] = await tx
      .insert(supportTickets)
      .values({
        ticketNo: generateReferenceNo("TKT"),
        userId,
        department: input.department,
        priority: input.priority,
        relatedOrderId: input.relatedOrderId || null,
        status: "new",
      })
      .returning();

    await tx.insert(supportMessages).values({
      ticketId: created.id,
      sender: "customer",
      senderId: userId,
      body: `[${input.subject}]\n\n${input.body}`,
    });

    return created;
  });

  // إشعار صاحب المتجر (لا يُفشل إنشاء التذكرة إن تعذّر الإرسال).
  await notifyAdmin("تذكرة دعم جديدة 🎫", [
    ["رقم التذكرة", ticket.ticketNo],
    ["الموضوع", input.subject],
    ["القسم", input.department],
    ["الأولوية", input.priority],
  ]);

  return ticket;
}

export async function listUserTickets(userId: string): Promise<SupportTicket[]> {
  return db
    .select()
    .from(supportTickets)
    .where(eq(supportTickets.userId, userId))
    .orderBy(desc(supportTickets.updatedAt))
    .limit(50);
}

export async function getTicketForUser(
  ticketId: string,
  userId: string,
): Promise<{ ticket: SupportTicket; messages: SupportMessage[] } | null> {
  const [ticket] = await db
    .select()
    .from(supportTickets)
    .where(and(eq(supportTickets.id, ticketId), eq(supportTickets.userId, userId)))
    .limit(1);
  if (!ticket) return null;
  const messages = await db
    .select()
    .from(supportMessages)
    .where(eq(supportMessages.ticketId, ticketId))
    .orderBy(asc(supportMessages.createdAt));
  return { ticket, messages };
}

export async function getTicketAdmin(
  ticketId: string,
): Promise<{ ticket: SupportTicket; messages: SupportMessage[] } | null> {
  const [ticket] = await db
    .select()
    .from(supportTickets)
    .where(eq(supportTickets.id, ticketId))
    .limit(1);
  if (!ticket) return null;
  const messages = await db
    .select()
    .from(supportMessages)
    .where(eq(supportMessages.ticketId, ticketId))
    .orderBy(asc(supportMessages.createdAt));
  return { ticket, messages };
}

export async function addTicketMessage(params: {
  ticketId: string;
  user: SessionUser;
  body: string;
  asStaff: boolean;
}): Promise<void> {
  await db.transaction(async (tx) => {
    const [ticket] = await tx
      .select()
      .from(supportTickets)
      .where(eq(supportTickets.id, params.ticketId))
      .for("update");
    if (!ticket) throw new AppError("not_found", "التذكرة غير موجودة.", 404);
    if (!params.asStaff && ticket.userId !== params.user.id) {
      throw new AppError("forbidden", "غير مصرّح.", 403);
    }
    if (ticket.status === "closed") {
      throw new AppError("ticket_closed", "التذكرة مغلقة.", 409);
    }

    await tx.insert(supportMessages).values({
      ticketId: ticket.id,
      sender: params.asStaff ? "staff" : "customer",
      senderId: params.user.id,
      body: params.body,
    });

    const nextStatus = params.asStaff ? "awaiting_customer" : "in_progress";
    await tx
      .update(supportTickets)
      .set({ status: nextStatus, updatedAt: new Date() })
      .where(eq(supportTickets.id, ticket.id));

    if (params.asStaff) {
      await tx.insert(notifications).values({
        userId: ticket.userId,
        type: "support_reply",
        title: "رد جديد على تذكرتك",
        body: `لديك رد من الدعم على التذكرة ${ticket.ticketNo}.`,
        metadata: { ticketId: ticket.id },
      });
    }
  });
}

export async function updateTicketStatus(params: {
  ticketId: string;
  status: "new" | "in_progress" | "awaiting_customer" | "closed";
  adminId: string;
}): Promise<void> {
  const [ticket] = await db
    .select()
    .from(supportTickets)
    .where(eq(supportTickets.id, params.ticketId))
    .limit(1);
  if (!ticket) throw new AppError("not_found", "التذكرة غير موجودة.", 404);

  await db
    .update(supportTickets)
    .set({ status: params.status, updatedAt: new Date() })
    .where(eq(supportTickets.id, params.ticketId));

  if (params.status === "closed") {
    await db.insert(notifications).values({
      userId: ticket.userId,
      type: "support_closed",
      title: "أُغلقت تذكرتك",
      body: `تم إغلاق التذكرة ${ticket.ticketNo}. افتح تذكرة جديدة إن احتجت.`,
      metadata: { ticketId: ticket.id },
    });
  }
}
