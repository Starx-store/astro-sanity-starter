import { CouponManager } from "@/components/admin/coupon-manager";
import { requirePagePermission } from "@/server/auth/current-user";
import { PERMISSIONS } from "@/server/auth/rbac";

export const dynamic = "force-dynamic";

export default async function AdminCouponsPage() {
  await requirePagePermission(PERMISSIONS.settingsEdit);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">كوبونات الخصم</h1>
        <p className="text-sm text-muted">
          أنشئ رموز خصم يستخدمها العملاء عند الطلب.
        </p>
      </div>
      <CouponManager />
    </div>
  );
}
