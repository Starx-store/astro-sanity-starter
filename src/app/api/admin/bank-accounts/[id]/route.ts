import { jsonOk, handleError, parseBody } from "@/server/http";
import { requirePagePermission } from "@/server/auth/current-user";
import { PERMISSIONS } from "@/server/auth/rbac";
import { updateBankAccount, deleteBankAccount } from "@/server/bank-accounts/service";
import { bankAccountSchema } from "@/server/validation/bank-accounts";

export async function PUT(req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    await requirePagePermission(PERMISSIONS.settingsEdit);
    const parsed = await parseBody(req, bankAccountSchema.partial());
    if (!parsed.success) return parsed.response;
    const account = await updateBankAccount(params.id, parsed.data);
    return jsonOk(account);
  } catch (error) {
    return handleError(error);
  }
}

export async function DELETE(req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    await requirePagePermission(PERMISSIONS.settingsEdit);
    await deleteBankAccount(params.id);
    return jsonOk({ success: true });
  } catch (error) {
    return handleError(error);
  }
}
