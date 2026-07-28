import "server-only";

import { requirePagePermission } from "@/server/auth/current-user";
import { PERMISSIONS } from "@/server/auth/rbac";
import { listAllBankAccounts } from "@/server/bank-accounts/service";
import { BankAccountsManager } from "@/components/admin/bank-accounts-manager";

export const dynamic = "force-dynamic";

export default async function AdminBankAccountsPage() {
  await requirePagePermission(PERMISSIONS.settingsEdit);
  const initialAccounts = await listAllBankAccounts();

  return (
    <div className="space-y-6">
      <BankAccountsManager initialAccounts={initialAccounts} />
    </div>
  );
}
