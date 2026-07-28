import "server-only";
import { and, desc, eq, gte, inArray, sql } from "drizzle-orm";
import { db } from "@/server/db";
import {
  users,
  orders,
  wallets,
  depositRequests,
  supportTickets,
  products,
  providers,
} from "@/server/db/schema";

/**
 * تجميعات لوحة الإدارة والتقارير.
 * كل المبالغ تُجمع في قاعدة البيانات (NUMERIC) وتُعاد كسلاسل نصية للدقة.
 */

const num = (v: unknown): string => (v == null ? "0" : String(v));

export interface DashboardStats {
  users: { total: number; customers: number };
  orders: { total: number; completed: number; pending: number; failed: number };
  sales: { total: string; today: string; month: string };
  profit: { total: string; today: string; month: string };
  walletsBalance: string;
  pendingDeposits: number;
  openTickets: number;
}

function startOfTodayUTC(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}
function startOfMonthUTC(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

export async function getDashboardStats(): Promise<DashboardStats> {
  const today = startOfTodayUTC();
  const month = startOfMonthUTC();

  const [[userRow], statusRows, [salesAll], [salesToday], [salesMonth], [wal], [dep], [tk]] =
    await Promise.all([
      db
        .select({
          total: sql<number>`count(*)::int`,
          customers: sql<number>`count(*) filter (where ${users.role} = 'customer')::int`,
        })
        .from(users),
      db
        .select({
          status: orders.status,
          count: sql<number>`count(*)::int`,
        })
        .from(orders)
        .groupBy(orders.status),
      db
        .select({
          sales: sql<string>`coalesce(sum(${orders.totalPrice}),0)`,
          profit: sql<string>`coalesce(sum(${orders.totalPrice} - ${orders.costPrice}),0)`,
        })
        .from(orders)
        .where(eq(orders.status, "completed")),
      db
        .select({
          sales: sql<string>`coalesce(sum(${orders.totalPrice}),0)`,
          profit: sql<string>`coalesce(sum(${orders.totalPrice} - ${orders.costPrice}),0)`,
        })
        .from(orders)
        .where(and(eq(orders.status, "completed"), gte(orders.updatedAt, today))),
      db
        .select({
          sales: sql<string>`coalesce(sum(${orders.totalPrice}),0)`,
          profit: sql<string>`coalesce(sum(${orders.totalPrice} - ${orders.costPrice}),0)`,
        })
        .from(orders)
        .where(and(eq(orders.status, "completed"), gte(orders.updatedAt, month))),
      db.select({ total: sql<string>`coalesce(sum(${wallets.balance}),0)` }).from(wallets),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(depositRequests)
        .where(eq(depositRequests.status, "pending")),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(supportTickets)
        .where(inArray(supportTickets.status, ["new", "in_progress", "awaiting_customer"])),
    ]);

  const byStatus = (s: string) =>
    statusRows.find((r) => r.status === s)?.count ?? 0;
  const totalOrders = statusRows.reduce((a, r) => a + r.count, 0);

  return {
    users: { total: userRow?.total ?? 0, customers: userRow?.customers ?? 0 },
    orders: {
      total: totalOrders,
      completed: byStatus("completed"),
      pending:
        byStatus("under_review") +
        byStatus("needs_info") +
        byStatus("in_progress") +
        byStatus("sent_to_provider") +
        byStatus("needs_manual"),
      failed: byStatus("failed") + byStatus("refunded"),
    },
    sales: {
      total: num(salesAll?.sales),
      today: num(salesToday?.sales),
      month: num(salesMonth?.sales),
    },
    profit: {
      total: num(salesAll?.profit),
      today: num(salesToday?.profit),
      month: num(salesMonth?.profit),
    },
    walletsBalance: num(wal?.total),
    pendingDeposits: dep?.count ?? 0,
    openTickets: tk?.count ?? 0,
  };
}

export interface TopProduct {
  name: string;
  orders: number;
  revenue: string;
}

export async function getTopProducts(limit = 8): Promise<TopProduct[]> {
  const rows = await db
    .select({
      name: products.name,
      orders: sql<number>`count(*)::int`,
      revenue: sql<string>`coalesce(sum(${orders.totalPrice}),0)`,
    })
    .from(orders)
    .innerJoin(products, eq(orders.productId, products.id))
    .where(eq(orders.status, "completed"))
    .groupBy(products.id, products.name)
    .orderBy(desc(sql`count(*)`))
    .limit(limit);
  return rows.map((r) => ({ name: r.name, orders: r.orders, revenue: num(r.revenue) }));
}

export interface ProviderPerf {
  name: string;
  orders: number;
  completed: number;
  balance: string | null;
}

export async function getProviderPerformance(): Promise<ProviderPerf[]> {
  const rows = await db
    .select({
      name: providers.name,
      balance: providers.balance,
      orders: sql<number>`count(${orders.id})::int`,
      completed: sql<number>`count(*) filter (where ${orders.status} = 'completed')::int`,
    })
    .from(providers)
    .leftJoin(orders, eq(orders.providerId, providers.id))
    .groupBy(providers.id, providers.name, providers.balance)
    .orderBy(desc(sql`count(${orders.id})`));
  return rows.map((r) => ({
    name: r.name,
    orders: r.orders,
    completed: r.completed,
    balance: r.balance != null ? String(r.balance) : null,
  }));
}
