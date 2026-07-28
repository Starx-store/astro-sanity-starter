import Link from "next/link";
import { asc, eq, sql } from "drizzle-orm";
import { Plus, Server } from "lucide-react";
import { db } from "@/server/db";
import { providers, providerProducts } from "@/server/db/schema";
import { displayAmount } from "@/lib/money";
import { providerStatusLabel } from "@/lib/labels";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { requirePagePermission } from "@/server/auth/current-user";
import { PERMISSIONS } from "@/server/auth/rbac";

export const dynamic = "force-dynamic";

export default async function AdminProvidersPage() {
  await requirePagePermission(PERMISSIONS.providersManage);

  const rows = await db
    .select({
      p: providers,
      links: sql<number>`count(${providerProducts.id})::int`,
    })
    .from(providers)
    .leftJoin(providerProducts, eq(providerProducts.providerId, providers.id))
    .groupBy(providers.id)
    .orderBy(asc(providers.name));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">المزوّدون</h1>
          <p className="text-sm text-muted">
            اربط المتجر بمزوّدي التنفيذ التلقائي وتابع أرصدتهم.
          </p>
        </div>
        <Link href="/admin/providers/new">
          <Button size="sm">
            <Plus className="h-4 w-4" />
            مزوّد جديد
          </Button>
        </Link>
      </div>

      {rows.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 p-12 text-center">
            <Server className="h-8 w-8 text-muted" />
            <p className="text-muted">لا يوجد مزوّدون بعد.</p>
            <Link href="/admin/providers/new">
              <Button size="sm">أضف أول مزوّد</Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map(({ p, links }) => {
            const st = providerStatusLabel(p.status);
            return (
              <Link key={p.id} href={`/admin/providers/${p.id}`}>
                <Card className="h-full p-6 transition-colors hover:border-gold/40">
                  <div className="mb-3 flex items-start justify-between">
                    <span className="grid h-10 w-10 place-items-center rounded-lg bg-gold/10 text-gold">
                      <Server className="h-5 w-5" />
                    </span>
                    <Badge tone={st.tone}>{st.label}</Badge>
                  </div>
                  <h3 className="font-bold">{p.name}</h3>
                  <p className="mt-1 text-xs text-muted">{p.adapter}</p>
                  <div className="mt-4 flex items-center justify-between text-sm">
                    <span className="text-muted">{links} منتج مرتبط</span>
                    <span className="font-semibold" dir="ltr">
                      {p.balance != null ? `${displayAmount(p.balance)}$` : "—"}
                    </span>
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
