import { requireApiUser } from "@/server/auth/api";
import { createTicket } from "@/server/support/service";
import { createTicketSchema } from "@/server/validation/support";
import { handleError, jsonOk, parseBody } from "@/server/http";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const user = await requireApiUser();
    const parsed = await parseBody(req, createTicketSchema);
    if (!parsed.success) return parsed.response;

    const ticket = await createTicket(user.id, parsed.data);
    return jsonOk({ ticket: { id: ticket.id, ticketNo: ticket.ticketNo } }, 201);
  } catch (err) {
    return handleError(err);
  }
}
