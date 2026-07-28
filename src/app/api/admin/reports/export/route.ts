import { NextRequest, NextResponse } from "next/server";
import { requirePagePermission } from "@/server/auth/current-user";
import { PERMISSIONS } from "@/server/auth/rbac";
import { db } from "@/server/db";
import { orders, depositRequests, users } from "@/server/db/schema";
import { eq, desc } from "drizzle-orm";
import { displayAmount, parseAmount } from "@/lib/money";

export async function GET(req: NextRequest) {
  const type = req.nextUrl.searchParams.get("type");
  
  if (type === "orders") {
    const perm = await requirePagePermission(PERMISSIONS.manageOrders);
    if (!perm.ok) return new NextResponse("Unauthorized", { status: 401 });
    
    const allOrders = await db
      .select({
        orderNo: orders.orderNo,
        userName: users.name,
        userEmail: users.email,
        userPhone: users.phone,
        totalPrice: orders.totalPrice,
        costPrice: orders.costPrice,
        status: orders.status,
        createdAt: orders.createdAt,
      })
      .from(orders)
      .leftJoin(users, eq(orders.userId, users.id))
      .orderBy(desc(orders.createdAt));
      
    const header = "\uFEFFرقم الطلب,اسم العميل,البريد,الواتساب,المجموع,التكلفة,الربح,الحالة,التاريخ\n";
    const rows = allOrders.map(o => {
      const total = parseAmount(o.totalPrice);
      const cost = parseAmount(o.costPrice);
      const profit = total > cost ? total - cost : 0n;
      
      return [
        o.orderNo,
        o.userName ? `"${o.userName.replace(/"/g, '""')}"` : "",
        o.userEmail,
        o.userPhone ?? "",
        displayAmount(total),
        displayAmount(cost),
        displayAmount(profit),
        o.status,
        o.createdAt.toISOString()
      ].join(",");
    }).join("\n");
    
    return new NextResponse(header + rows, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="orders_report.csv"',
      }
    });
  } 
  
  if (type === "deposits") {
    const perm = await requirePagePermission(PERMISSIONS.manageDeposits);
    if (!perm.ok) return new NextResponse("Unauthorized", { status: 401 });
    
    const allDeposits = await db
      .select({
        id: depositRequests.id,
        userName: users.name,
        userEmail: users.email,
        userPhone: users.phone,
        amount: depositRequests.amount,
        status: depositRequests.status,
        method: depositRequests.method,
        createdAt: depositRequests.createdAt,
      })
      .from(depositRequests)
      .leftJoin(users, eq(depositRequests.userId, users.id))
      .orderBy(desc(depositRequests.createdAt));
      
    const header = "\uFEFFمعرف الطلب,اسم العميل,البريد,الواتساب,المبلغ,الطريقة,الحالة,التاريخ\n";
    const rows = allDeposits.map(d => {
      return [
        d.id,
        d.userName ? `"${d.userName.replace(/"/g, '""')}"` : "",
        d.userEmail,
        d.userPhone ?? "",
        displayAmount(parseAmount(d.amount)),
        d.method,
        d.status,
        d.createdAt.toISOString()
      ].join(",");
    }).join("\n");
    
    return new NextResponse(header + rows, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="deposits_report.csv"',
      }
    });
  }
  
  return new NextResponse("Invalid type", { status: 400 });
}
