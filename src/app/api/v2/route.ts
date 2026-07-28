import { NextRequest, NextResponse } from "next/server";
import { validateApiKey } from "@/server/api-keys/service";
import { db } from "@/server/db";
import { products, productPackages, productQuantityConfig, priceTiers, orders } from "@/server/db/schema";
import { eq, inArray } from "drizzle-orm";
import { createOrder } from "@/server/orders/service";
import { randomUUID } from "crypto";
import { displayAmount } from "@/lib/money";

export const runtime = "nodejs";

function getApiKey(req: NextRequest): string | null {
  const urlKey = req.nextUrl.searchParams.get("key");
  if (urlKey) return urlKey;
  const auth = req.headers.get("authorization");
  if (auth && auth.toLowerCase().startsWith("bearer ")) {
    return auth.slice(7).trim();
  }
  return null;
}

export async function GET(req: NextRequest) {
  return handleRequest(req);
}

export async function POST(req: NextRequest) {
  return handleRequest(req);
}

async function handleRequest(req: NextRequest) {
  try {
    const key = getApiKey(req);
    const action = req.nextUrl.searchParams.get("action");
    
    // Also parse form data / json if POST
    let body: any = {};
    if (req.method === "POST") {
      const contentType = req.headers.get("content-type") || "";
      if (contentType.includes("application/json")) {
        try { body = await req.json(); } catch {}
      } else if (contentType.includes("application/x-www-form-urlencoded") || contentType.includes("multipart/form-data")) {
        try {
          const formData = await req.formData();
          formData.forEach((val, k) => { body[k] = val; });
        } catch {}
      }
    }
    
    const finalKey = key || body.key;
    const finalAction = action || body.action;

    if (!finalKey) {
      return NextResponse.json({ error: "API key is required" }, { status: 401 });
    }

    const user = await validateApiKey(finalKey);
    if (!user) {
      return NextResponse.json({ error: "Invalid API key" }, { status: 401 });
    }
    if (user.status !== "active") {
      return NextResponse.json({ error: "Account is not active" }, { status: 403 });
    }

    if (finalAction === "balance") {
      const { wallets } = await import("@/server/db/schema");
      const [wallet] = await db.select().from(wallets).where(eq(wallets.userId, user.id)).limit(1);
      return NextResponse.json({
        balance: wallet ? displayAmount(wallet.balance) : "0.00",
        currency: wallet?.currency || "USD"
      });
    }

    if (finalAction === "services") {
      const allProducts = await db.select().from(products).where(eq(products.status, "active"));
      
      const services = [];
      for (const p of allProducts) {
        if (p.type === "package") {
          const pkgs = await db.select().from(productPackages).where(eq(productPackages.productId, p.id));
          for (const pkg of pkgs) {
            if (pkg.isAvailable) {
              services.push({
                service: pkg.id,
                name: `${p.name} - ${pkg.name}`,
                type: "Default",
                category: "Packages", // simplified
                rate: displayAmount(pkg.salePrice),
                min: "1",
                max: "1"
              });
            }
          }
        } else {
          const [cfg] = await db.select().from(productQuantityConfig).where(eq(productQuantityConfig.productId, p.id)).limit(1);
          if (cfg) {
            services.push({
              service: p.id,
              name: p.name,
              type: "Default",
              category: "Services",
              rate: displayAmount(cfg.pricePer1000 || "0"),
              min: displayAmount(cfg.minQty),
              max: cfg.maxQty ? displayAmount(cfg.maxQty) : "1000000"
            });
          }
        }
      }
      return NextResponse.json(services);
    }

    if (finalAction === "add") {
      const serviceId = body.service || req.nextUrl.searchParams.get("service");
      const link = body.link || req.nextUrl.searchParams.get("link");
      const quantity = body.quantity || req.nextUrl.searchParams.get("quantity");
      
      if (!serviceId) return NextResponse.json({ error: "Service ID is required" }, { status: 400 });
      
      let productId = serviceId;
      let packageId: string | undefined = undefined;
      let qtyStr: string | undefined = quantity?.toString();
      
      // Check if serviceId is a package
      const [pkg] = await db.select().from(productPackages).where(eq(productPackages.id, serviceId)).limit(1);
      if (pkg) {
        productId = pkg.productId;
        packageId = pkg.id;
        qtyStr = undefined; // packages don't use arbitrary quantity in our schema
      } else {
        const [prod] = await db.select().from(products).where(eq(products.id, serviceId)).limit(1);
        if (!prod) {
          return NextResponse.json({ error: "Service not found" }, { status: 400 });
        }
      }

      try {
        const result = await createOrder({
          userId: user.id,
          productId,
          packageId,
          quantity: qtyStr,
          inputs: { link }, // We map "link" to a generic inputs. Adjust based on requiredFields if needed.
          idempotencyKey: `api-v2-${randomUUID()}`
        });
        
        return NextResponse.json({ order: result.order.id });
      } catch (err: any) {
        return NextResponse.json({ error: err.message || "Failed to create order" }, { status: 400 });
      }
    }

    if (finalAction === "status") {
      const orderId = body.order || req.nextUrl.searchParams.get("order");
      const orderIdsParam = body.orders || req.nextUrl.searchParams.get("orders");
      
      if (orderId) {
        const [ord] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
        if (!ord || ord.userId !== user.id) return NextResponse.json({ error: "Order not found" }, { status: 404 });
        
        return NextResponse.json({
          status: mapStatus(ord.status),
          charge: displayAmount(ord.totalPrice),
          start_count: "0",
          remains: ord.quantity ? displayAmount(ord.quantity) : "0",
          currency: "USD"
        });
      } else if (orderIdsParam) {
        const ids = orderIdsParam.split(",").map((s: string) => s.trim());
        const ords = await db.select().from(orders).where(inArray(orders.id, ids));
        const res: Record<string, any> = {};
        for (const ord of ords) {
          if (ord.userId === user.id) {
            res[ord.id] = {
              status: mapStatus(ord.status),
              charge: displayAmount(ord.totalPrice),
              start_count: "0",
              remains: ord.quantity ? displayAmount(ord.quantity) : "0",
              currency: "USD"
            };
          } else {
            res[ord.id] = { error: "Not found" };
          }
        }
        return NextResponse.json(res);
      } else {
        return NextResponse.json({ error: "order or orders parameter required" }, { status: 400 });
      }
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

function mapStatus(status: string): string {
  switch (status) {
    case "pending":
    case "awaiting_payment":
    case "under_review":
      return "Pending";
    case "in_progress":
    case "sent_to_provider":
      return "In progress";
    case "completed":
      return "Completed";
    case "partially_completed":
      return "Partial";
    case "cancelled":
    case "refunded":
    case "failed":
      return "Canceled";
    default:
      return "Pending";
  }
}
