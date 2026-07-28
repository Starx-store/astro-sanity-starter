import { OverviewDashboard } from "@/components/admin/overview-dashboard";

/**
 * لوحة النظرة العامة — صفحة خفيفة بلا استعلامات وقت العرض:
 * تفتح فورًا، والإحصائيات تصل عبر /api/admin/overview من المتصفح.
 * (تجميع الاستعلامات داخل عرض RSC كان هشًّا في serverless — انظر
 * تعليق مسار الـ API.)
 */
export default function AdminDashboard() {
  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">نظرة عامة</h1>
          <p className="text-sm text-muted">ملخّص أداء المتجر.</p>
        </div>
        <a href="/api/admin/reports/orders" download>
          <span className="inline-flex h-9 items-center gap-2 rounded-md border border-border px-3 text-sm hover:bg-surface-2">
            تصدير الطلبات CSV
          </span>
        </a>
      </div>
      <OverviewDashboard />
    </div>
  );
}
