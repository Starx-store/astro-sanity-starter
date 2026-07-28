"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Users,
  ShoppingCart,
  Wallet,
  TrendingUp,
  DollarSign,
  Clock,
  LifeBuoy,
  Server,
  RotateCcw,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { displayAmount } from "@/lib/money";

interface Overview {
  stats: {
    users: { total: number; customers: number };
    orders: { total: number; completed: number; pending: number; failed: number };
    sales: { total: string; today: string; month: string };
    profit: { total: string; today: string; month: string };
    walletsBalance: string;
    pendingDeposits: number;
    openTickets: number;
  };
  top: Array<{ name: string; orders: number; revenue: string }>;
  providers: Array<{
    name: string;
    orders: number;
    completed: number;
    balance: string | null;
  }>;
}

/**
 * لوحة النظرة العامة — تجلب الإحصائيات عبر /api/admin/overview بعد فتح
 * الصفحة فورًا، مع سقوط راجع ودود وإعادة محاولة عند أي تعثّر مؤقت.
 */
export function OverviewDashboard() {
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    fetch("/api/admin/overview", { cache: "no-store" })
      .then(async (r) => {
        const j = await r.json().catch(() => null);
        if (!r.ok || !j?.ok) {
          throw new Error(j?.error ?? `تعذّر التحميل (${r.status})`);
        }
        setData(j.data as Overview);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "تعذّر التحميل."))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading && !data) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="flex items-center gap-4 p-5">
              <span className="h-11 w-11 shrink-0 animate-pulse rounded-lg bg-surface-2" />
              <div className="flex-1 space-y-2">
                <div className="h-3 w-20 animate-pulse rounded bg-surface-2" />
                <div className="h-5 w-14 animate-pulse rounded bg-surface-2" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="rounded-xl border border-dashed border-border p-10 text-center">
        <p className="font-semibold">تعذّر تحميل الإحصائيات</p>
        <p className="mt-1 text-sm text-muted">{error}</p>
        <Button className="mt-4" variant="outline" onClick={load}>
          <RotateCcw className="h-4 w-4" />
          إعادة المحاولة
        </Button>
      </div>
    );
  }

  if (!data) return null;
  const { stats, top, providers } = data;
  const money = (v: string) => `${displayAmount(v)}$`;

  const cards = [
    { Icon: DollarSign, label: "مبيعات الشهر", value: money(stats.sales.month), tone: "gold" as const },
    { Icon: TrendingUp, label: "أرباح الشهر", value: money(stats.profit.month), tone: "success" as const },
    { Icon: DollarSign, label: "مبيعات اليوم", value: money(stats.sales.today) },
    { Icon: TrendingUp, label: "أرباح اليوم", value: money(stats.profit.today) },
    { Icon: ShoppingCart, label: "إجمالي الطلبات", value: String(stats.orders.total) },
    { Icon: Users, label: "المستخدمون", value: String(stats.users.total) },
    { Icon: Wallet, label: "أرصدة المحافظ", value: money(stats.walletsBalance) },
    { Icon: TrendingUp, label: "إجمالي المبيعات", value: money(stats.sales.total) },
  ];

  return (
    <div className="space-y-8">
      {/* بطاقات الإحصائيات */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map(({ Icon, label, value, tone }) => (
          <Card key={label}>
            <CardContent className="flex items-center gap-4 p-5">
              <span
                className={`grid h-11 w-11 shrink-0 place-items-center rounded-lg ${
                  tone === "gold"
                    ? "bg-gold/15 text-gold"
                    : tone === "success"
                      ? "bg-success/15 text-success"
                      : "bg-surface-2 text-muted"
                }`}
              >
                <Icon className="h-5 w-5" />
              </span>
              <div>
                <p className="text-xs text-muted">{label}</p>
                <p className="text-xl font-extrabold" dir="ltr">
                  {value}
                </p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* تنبيهات تشغيلية */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Link href="/admin/orders">
          <Card className="p-5 transition-colors hover:border-gold/40">
            <div className="flex items-center gap-3">
              <ShoppingCart className="h-5 w-5 text-gold" />
              <div>
                <p className="text-sm text-muted">طلبات قيد التنفيذ</p>
                <p className="text-lg font-bold">{stats.orders.pending}</p>
              </div>
            </div>
          </Card>
        </Link>
        <Link href="/admin/deposits">
          <Card className="p-5 transition-colors hover:border-gold/40">
            <div className="flex items-center gap-3">
              <Clock className="h-5 w-5 text-warning" />
              <div>
                <p className="text-sm text-muted">إيداعات بانتظار المراجعة</p>
                <p className="text-lg font-bold">{stats.pendingDeposits}</p>
              </div>
            </div>
          </Card>
        </Link>
        <Link href="/admin/support">
          <Card className="p-5 transition-colors hover:border-gold/40">
            <div className="flex items-center gap-3">
              <LifeBuoy className="h-5 w-5 text-info" />
              <div>
                <p className="text-sm text-muted">تذاكر دعم مفتوحة</p>
                <p className="text-lg font-bold">{stats.openTickets}</p>
              </div>
            </div>
          </Card>
        </Link>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* أفضل المنتجات */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">أفضل المنتجات مبيعًا</CardTitle>
          </CardHeader>
          <CardContent>
            {top.length === 0 ? (
              <p className="text-sm text-muted">لا مبيعات مكتملة بعد.</p>
            ) : (
              <ul className="space-y-2">
                {top.map((p) => (
                  <li
                    key={p.name}
                    className="flex items-center justify-between border-b border-border/50 pb-2 text-sm last:border-0"
                  >
                    <span className="font-medium">{p.name}</span>
                    <span className="flex items-center gap-3 text-muted">
                      <span>{p.orders} طلب</span>
                      <span className="font-semibold text-foreground" dir="ltr">
                        {money(p.revenue)}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* أداء المزوّدين */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">أداء المزوّدين</CardTitle>
          </CardHeader>
          <CardContent>
            {providers.length === 0 ? (
              <p className="flex items-center gap-2 text-sm text-muted">
                <Server className="h-4 w-4" />
                لا مزوّدين بعد.
              </p>
            ) : (
              <ul className="space-y-2">
                {providers.map((p) => (
                  <li
                    key={p.name}
                    className="flex items-center justify-between border-b border-border/50 pb-2 text-sm last:border-0"
                  >
                    <span className="font-medium">{p.name}</span>
                    <span className="flex items-center gap-3 text-muted">
                      <Badge tone="neutral">
                        {p.completed}/{p.orders}
                      </Badge>
                      {p.balance != null && (
                        <span dir="ltr">{money(p.balance)}</span>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
