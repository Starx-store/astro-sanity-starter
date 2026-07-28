import { requireRole, requirePagePermission } from "@/server/auth/current-user";
import { getAllSettings } from "@/server/settings/service";
import { hasPermission, PERMISSIONS } from "@/server/auth/rbac";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SettingsForm } from "@/components/admin/settings-form";
import { ReconcileButton } from "@/components/admin/reconcile-button";
import { BroadcastForm } from "@/components/admin/broadcast-form";

export const dynamic = "force-dynamic";

export default async function AdminSettingsPage() {
  const viewer = await requirePagePermission(PERMISSIONS.settingsEdit);
  const s = await getAllSettings();
  const getSetting = (key: string, def: any) => s[key] ?? def;
  const canEdit = true; // الصفحة نفسها تتطلب settingsEdit
  const canReconcile = await hasPermission(viewer, PERMISSIONS.walletAdjust);

  const initial = {
    storeName: String(s["store.name"] ?? "Evo Store"),
    currency: String(s["store.currency"] ?? "USD"),
    minDeposit: String(s["store.min_deposit"] ?? "1"),
    maintenance: s["store.maintenance"] === true,
    silverDiscount: String(s["tiers.silver_discount"] ?? "0"),
    goldDiscount: String(s["tiers.gold_discount"] ?? "0"),
    sarRate: String(s["currencies.sar_rate"] ?? "4"),
    yersRate: String(s["currencies.yers_rate"] ?? "1600"),
    yeroRate: String(s["currencies.yero_rate"] ?? "550"),
    bep20Address: String(s["crypto.bep20_address"] ?? ""),
    cryptoMinConfirmations: String(s["crypto.min_confirmations"] ?? "6"),
    supportWhatsapp: String(s["support.whatsapp"] ?? "967771581353"),
    logo: String(s["store.logo"] ?? ""),
    traderReferralCode: String(s["referral.trader_code"] ?? ""),
    "store.whatsapp": String(s["store.whatsapp"] ?? ""),
    "store.meta_description": String(s["store.meta_description"] ?? ""),
    "announcement.enabled": s["announcement.enabled"] === true,
    "announcement.text_ar": String(s["announcement.text_ar"] ?? ""),
    "announcement.text_en": String(s["announcement.text_en"] ?? ""),
    "announcement.link": String(s["announcement.link"] ?? ""),
    "announcement.badge": String(s["announcement.badge"] ?? ""),
    "auth.register_phone_required": s["auth.register_phone_required"] !== false,
    "auth.allow_registration": s["auth.allow_registration"] !== false,
    "admin.fallback_email": String(s["admin.fallback_email"] ?? ""),
    "whatsapp.api_url": String(s["whatsapp.api_url"] ?? ""),
    "whatsapp.api_token": String(s["whatsapp.api_token"] ?? ""),
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">الإعدادات</h1>
        <p className="text-sm text-muted">إعدادات المتجر وأدوات الصيانة المالية.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">إعدادات المتجر</CardTitle>
        </CardHeader>
        <CardContent>
          {canEdit ? (
            <SettingsForm initial={initial} />
          ) : (
            <p className="text-sm text-muted">
              تحتاج صلاحية <code>settings.edit</code> لتعديل الإعدادات.
            </p>
          )}
        </CardContent>
      </Card>

      <BroadcastForm />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">مطابقة المحافظ (Reconciliation)</CardTitle>
        </CardHeader>
        <CardContent>
          {canReconcile ? (
            <ReconcileButton />
          ) : (
            <p className="text-sm text-muted">
              تحتاج صلاحية <code>wallet.adjust</code> لتشغيل المطابقة.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">النسخ الاحتياطي</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted">
          <p>
            خُذ نسخة احتياطية دورية لقاعدة البيانات. في Supabase تتوفّر نسخ يومية
            تلقائية (Project → Database → Backups).
          </p>
          <p>يدويًا عبر pg_dump:</p>
          <pre className="overflow-x-auto rounded-lg bg-surface-2/60 p-3 text-xs" dir="ltr">
{`pg_dump "$DATABASE_URL" -Fc -f evo-backup.dump`}
          </pre>
        </CardContent>
      </Card>
    </div>
  );
}
