import Link from "next/link";
import { notFound } from "next/navigation";
import { asc, desc, eq } from "drizzle-orm";
import { ArrowRight } from "lucide-react";
import { db } from "@/server/db";
import {
  providers,
  providerProducts,
  providerApiLogs,
  products,
  categories,
} from "@/server/db/schema";
import {
  listAdapters,
  adapterCredentialFields,
} from "@/server/providers/adapters";
import { unpackConfigForForm } from "@/server/providers/config";
import { displayAmount } from "@/lib/money";
import { formatDate, isUuid } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ProviderForm } from "@/components/admin/provider-form";
import { ProviderTestButton } from "@/components/admin/provider-test-button";
import { ProductLinkManager } from "@/components/admin/product-link-manager";
import { ServiceImporter } from "@/components/admin/service-importer";
import { SyncPricesButton } from "@/components/admin/sync-prices-button";
import { requirePagePermission } from "@/server/auth/current-user";
import { PERMISSIONS } from "@/server/auth/rbac";

export const dynamic = "force-dynamic";

export default async function ProviderDetailPage(
  props: {
    params: Promise<{ id: string }>;
  }
) {
  const params = await props.params;
  await requirePagePermission(PERMISSIONS.providersManage);

  if (!isUuid(params.id)) notFound();

  const [provider] = await db
    .select()
    .from(providers)
    .where(eq(providers.id, params.id))
    .limit(1);
  if (!provider) notFound();

  const adapters = listAdapters().map((a) => ({
    ...a,
    credentialFields: adapterCredentialFields(a.key),
  }));

  const links = await db
    .select({ link: providerProducts, productName: products.name })
    .from(providerProducts)
    .innerJoin(products, eq(providerProducts.productId, products.id))
    .where(eq(providerProducts.providerId, provider.id))
    .orderBy(asc(products.name));

  const linkedIds = new Set(links.map((l) => l.link.productId));
  const allProducts = await db
    .select({ id: products.id, name: products.name })
    .from(products)
    .orderBy(asc(products.name));
  const linkableProducts = allProducts.filter((p) => !linkedIds.has(p.id));

  const cats = await db
    .select({ id: categories.id, name: categories.name })
    .from(categories)
    .orderBy(asc(categories.sortOrder), asc(categories.name));

  const logs = await db
    .select()
    .from(providerApiLogs)
    .where(eq(providerApiLogs.providerId, provider.id))
    .orderBy(desc(providerApiLogs.createdAt))
    .limit(20);

  const linkField = unpackConfigForForm(provider.credentials).linkField ?? "link";

  return (
    <div className="space-y-6">
      <Link
        href="/admin/providers"
        className="inline-flex items-center gap-1 text-sm text-muted hover:text-foreground"
      >
        <ArrowRight className="h-4 w-4" />
        كل المزوّدين
      </Link>
      <h1 className="text-2xl font-bold">{provider.name}</h1>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <ProviderForm
            isNew={false}
            adapters={adapters}
            initial={{
              id: provider.id,
              name: provider.name,
              baseUrl: provider.baseUrl,
              adapter: provider.adapter,
              markupType: provider.markupType,
              markupValue: displayAmount(provider.markupValue),
              status: provider.status,
              linkField,
            }}
          />

          {/* استيراد خدمات المزوّد */}
          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle className="text-base">
                استيراد خدمات المزوّد
              </CardTitle>
              <SyncPricesButton providerId={provider.id} />
            </CardHeader>
            <CardContent>
              {cats.length === 0 ? (
                <p className="text-sm text-muted">
                  أنشئ تصنيفًا واحدًا على الأقل قبل استيراد الخدمات.
                </p>
              ) : (
                <ServiceImporter providerId={provider.id} categories={cats} />
              )}
            </CardContent>
          </Card>

          {/* ربط المنتجات */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">المنتجات المرتبطة</CardTitle>
            </CardHeader>
            <CardContent>
              <ProductLinkManager
                providerId={provider.id}
                products={linkableProducts}
                links={links.map((l) => ({
                  id: l.link.id,
                  productId: l.link.productId,
                  productName: l.productName,
                  externalProductId: l.link.externalProductId,
                  externalPrice: l.link.externalPrice
                    ? displayAmount(l.link.externalPrice)
                    : null,
                }))}
              />
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">الاتصال</CardTitle>
            </CardHeader>
            <CardContent>
              <ProviderTestButton providerId={provider.id} />
            </CardContent>
          </Card>

          {/* سجل API */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">سجل الاستدعاءات</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {logs.length === 0 ? (
                <p className="text-sm text-muted">لا استدعاءات بعد.</p>
              ) : (
                logs.map((log) => (
                  <div
                    key={log.id}
                    className="flex items-center justify-between gap-2 border-b border-border/50 py-2 text-xs last:border-0"
                  >
                    <div>
                      <span className="font-mono">{log.requestEndpoint}</span>
                      <span className="block text-muted">
                        {formatDate(log.createdAt)} · {log.latencyMs}ms
                      </span>
                    </div>
                    <Badge tone={log.success ? "success" : "danger"}>
                      {log.success ? "نجح" : "فشل"}
                    </Badge>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
