import { jsonOk, handleError } from "@/server/http";
import { listActiveBankAccounts } from "@/server/bank-accounts/service";

export async function GET() {
  try {
    const accounts = await listActiveBankAccounts();
    return jsonOk(accounts);
  } catch (error) {
    return handleError(error);
  }
}
