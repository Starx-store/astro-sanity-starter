import { jsonOk, handleError, parseBody } from "@/server/http";
import { requirePagePermission } from "@/server/auth/current-user";
import { PERMISSIONS } from "@/server/auth/rbac";
import { listAllBankAccounts, createBankAccount } from "@/server/bank-accounts/service";
import { bankAccountSchema } from "@/server/validation/bank-accounts";

export async function GET() {
  try {
    await requirePagePermission(PERMISSIONS.settingsEdit);
    const accounts = await listAllBankAccounts();
    return jsonOk(accounts);
  } catch (error) {
    return handleError(error);
  }
}

export async function POST(req: Request) {
  try {
    await requirePagePermission(PERMISSIONS.settingsEdit);
    const parsed = await parseBody(req, bankAccountSchema);
    if (!parsed.success) return parsed.response;
    const account = await createBankAccount(parsed.data);
    return jsonOk(account);
  } catch (error) {
    return handleError(error);
  }
}
