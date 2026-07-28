import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { listAdapters, adapterCredentialFields } from "@/server/providers/adapters";
import { ProviderForm } from "@/components/admin/provider-form";
import { requirePagePermission } from "@/server/auth/current-user";
import { PERMISSIONS } from "@/server/auth/rbac";

export const dynamic = "force-dynamic";

export default async function NewProviderPage() {
  await requirePagePermission(PERMISSIONS.providersManage);

  const adapters = listAdapters().map((a) => ({
    ...a,
    credentialFields: adapterCredentialFields(a.key),
  }));

  return (
    <div className="space-y-6">
      <Link
        href="/admin/providers"
        className="inline-flex items-center gap-1 text-sm text-muted hover:text-foreground"
      >
        <ArrowRight className="h-4 w-4" />
        كل المزوّدين
      </Link>
      <h1 className="text-2xl font-bold">مزوّد جديد</h1>

      <ProviderForm
        isNew
        adapters={adapters}
        initial={{
          name: "",
          baseUrl: "",
          adapter: adapters[0]?.key ?? "mock",
          markupType: "percent",
          markupValue: "0",
          status: "active",
          linkField: "link",
        }}
      />
    </div>
  );
}
