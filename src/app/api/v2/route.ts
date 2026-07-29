import { NextRequest, NextResponse } from "next/server";
import { validateApiKey } from "@/server/api-keys/service";
import { db } from "@/server/db";
import { products, productPackages, productQuantityConfig, categories, orders, wallets } from "@/server/db/schema";
import { eq, inArray } from "drizzle-orm";
import { createOrder } from "@/server/orders/service";
import { randomUUID } from "crypto";
import { displayAmount } from "@/lib/money";

export const runtime = "nodejs";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Requested-With",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function GET(req: NextRequest) {
  return handleRequest(req);
}

export async function POST(req: NextRequest) {
  return handleRequest(req);
}

async function handleRequest(req: NextRequest) {
  try {
    let body: Record<string, any> = {};

    // 1) Parse parameters from GET query string
    req.nextUrl.searchParams.forEach((val, key) => {
      body[key] = val;
    });

    // 2) Parse parameters from POST body if present
    if (req.method === "POST") {
      const contentType = req.headers.get("content-type") || "";
      if (contentType.includes("application/json")) {
        try {
          const json = await req.json();
          body = { ...body, ...json };
        } catch {}
      } else {
        try {
          const formData = await req.formData();
          formData.forEach((val, k) => {
            body[k] = val;
          });
        } catch {
          try {
            const text = await req.text();
            const params = new URLSearchParams(text);
            params.forEach((val, k) => {
              body[k] = val;
            });
          } catch {}
        }
      }
    }

    // Header authorization bearer fallback
    const authHeader = req.headers.get("authorization");
    if (authHeader && authHeader.toLowerCase().startsWith("bearer ")) {
      body.key = body.key || authHeader.slice(7).trim();
    }

    const key = String(body.key || body.api_key || "").trim();
    const action = String(body.action || "").trim().toLowerCase();

    // --- Action: Services Catalog ---
    // Standard SMM Panels (PerfectPanel, SmartPanel, etc.) ping the provider URL
    // to check for services. If action is services or empty or unauthenticated,
    // return the services catalog array so provider check passes 100%.
    if (
      action === "services" ||
      action === "service" ||
      (!action && !key) ||
      (action !== "balance" && action !== "add" && action !== "status" && !key)
    ) {
      return await handleServicesCatalog(CORS_HEADERS);
    }

    // --- Authentication Check for other actions ---
    if (!key) {
      return NextResponse.json(
        { error: "API key is required" },
        { status: 401, headers: CORS_HEADERS }
      );
    }

    const user = await validateApiKey(key);
    if (!user) {
      return NextResponse.json(
        { error: "Invalid API key" },
        { status: 401, headers: CORS_HEADERS }
      );
    }

    if (user.status !== "active") {
      return NextResponse.json(
        { error: "Account is inactive" },
        { status: 403, headers: CORS_HEADERS }
      );
    }

    // --- Action: User Balance ---
    if (action === "balance") {
      const [wallet] = await db
        .select()
        .from(wallets)
        .where(eq(wallets.userId, user.id))
        .limit(1);

      return NextResponse.json(
        {
          balance: wallet ? displayAmount(wallet.balance) : "0.00",
          currency: wallet?.currency || "USD",
        },
        { headers: CORS_HEADERS }
      );
    }

    // --- Action: Add Order ---
    if (action === "add") {
      const serviceId = String(body.service || body.package || body.service_id || "").trim();
      const link = String(body.link || body.url || body.username || body.target || body.account || "").trim();
      const quantity = body.quantity || body.qty || body.count;

      if (!serviceId) {
        return NextResponse.json(
          { error: "Service ID is required" },
          { status: 400, headers: CORS_HEADERS }
        );
      }

      let productId = serviceId;
      let packageId: string | undefined = undefined;
      let qtyStr: string | undefined = quantity ? String(quantity) : undefined;

      // 1. Check if serviceId matches a productPackage ID
      const [pkg] = await db
        .select()
        .from(productPackages)
        .where(eq(productPackages.id, serviceId))
        .limit(1);

      if (pkg) {
        productId = pkg.productId;
        packageId = pkg.id;
        if (pkg.packageType !== "quantity") {
          qtyStr = undefined;
        }
      } else {
        // 2. Check if serviceId matches a Product ID directly
        const [prod] = await db
          .select()
          .from(products)
          .where(eq(products.id, serviceId))
          .limit(1);

        if (!prod) {
          return NextResponse.json(
            { error: "Service not found" },
            { status: 404, headers: CORS_HEADERS }
          );
        }
      }

      try {
        // Build generic inputs object to satisfy required fields (link, url, username, etc.)
        const inputsObj: Record<string, string> = {
          link,
          url: link,
          username: link,
          target: link,
          account: link,
        };

        const result = await createOrder({
          userId: user.id,
          productId,
          packageId,
          quantity: qtyStr,
          inputs: inputsObj,
          idempotencyKey: `api-v2-${randomUUID()}`,
        });

        return NextResponse.json(
          { order: result.order.id },
          { headers: CORS_HEADERS }
        );
      } catch (err: any) {
        return NextResponse.json(
          { error: err.message || "Failed to create order" },
          { status: 400, headers: CORS_HEADERS }
        );
      }
    }

    // --- Action: Order Status ---
    if (action === "status") {
      const orderId = body.order ? String(body.order).trim() : null;
      const orderIdsParam = body.orders ? String(body.orders).trim() : null;

      if (orderId) {
        const [ord] = await db
          .select()
          .from(orders)
          .where(eq(orders.id, orderId))
          .limit(1);

        if (!ord || ord.userId !== user.id) {
          return NextResponse.json(
            { error: "Order not found" },
            { status: 404, headers: CORS_HEADERS }
          );
        }

        return NextResponse.json(
          {
            status: mapSmmStatus(ord.status),
            charge: displayAmount(ord.totalPrice),
            start_count: "0",
            remains: ord.quantity ? displayAmount(ord.quantity) : "0",
            currency: "USD",
          },
          { headers: CORS_HEADERS }
        );
      }

      if (orderIdsParam) {
        const ids = orderIdsParam.split(",").map((s) => s.trim()).filter(Boolean);
        const ords = ids.length > 0 ? await db.select().from(orders).where(inArray(orders.id, ids)) : [];
        const responseMap: Record<string, any> = {};

        for (const id of ids) {
          const ord = ords.find((o) => o.id === id);
          if (ord && ord.userId === user.id) {
            responseMap[id] = {
              status: mapSmmStatus(ord.status),
              charge: displayAmount(ord.totalPrice),
              start_count: "0",
              remains: ord.quantity ? displayAmount(ord.quantity) : "0",
              currency: "USD",
            };
          } else {
            responseMap[id] = { error: "Incorrect order ID" };
          }
        }

        return NextResponse.json(responseMap, { headers: CORS_HEADERS });
      }

      return NextResponse.json(
        { error: "order or orders parameter is required" },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    return NextResponse.json(
      { error: "Invalid action" },
      { status: 400, headers: CORS_HEADERS }
    );
  } catch (err: any) {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}

/** Fetch public services list for SMM panel integration */
async function handleServicesCatalog(headers: Record<string, string>) {
  try {
    const allProducts = await db
      .select({
        id: products.id,
        name: products.name,
        type: products.type,
        status: products.status,
        categoryId: products.categoryId,
        categoryName: categories.name,
      })
      .from(products)
      .leftJoin(categories, eq(products.categoryId, categories.id))
      .where(eq(products.status, "active"));

    const servicesList: Array<{
      service: string;
      name: string;
      type: string;
      category: string;
      rate: string;
      min: string;
      max: string;
      dripfeed: boolean;
      refill: boolean;
      cancel: boolean;
    }> = [];

    for (const p of allProducts) {
      const catName = p.categoryName || "General Services";

      if (p.type === "package") {
        const pkgs = await db
          .select()
          .from(productPackages)
          .where(eq(productPackages.productId, p.id));

        for (const pkg of pkgs) {
          if (pkg.isAvailable) {
            servicesList.push({
              service: pkg.id,
              name: `${p.name} - ${pkg.name}`,
              type: "Default",
              category: catName,
              rate: displayAmount(pkg.salePrice),
              min: "1",
              max: "1",
              dripfeed: false,
              refill: false,
              cancel: false,
            });
          }
        }
      } else {
        const [cfg] = await db
          .select()
          .from(productQuantityConfig)
          .where(eq(productQuantityConfig.productId, p.id))
          .limit(1);

        if (cfg) {
          servicesList.push({
            service: p.id,
            name: p.name,
            type: "Default",
            category: catName,
            rate: displayAmount(cfg.pricePer1000 || "0"),
            min: displayAmount(cfg.minQty),
            max: cfg.maxQty ? displayAmount(cfg.maxQty) : "1000000",
            dripfeed: false,
            refill: false,
            cancel: false,
          });
        }
      }
    }

    return NextResponse.json(servicesList, { headers });
  } catch {
    return NextResponse.json([], { headers });
  }
}

function mapSmmStatus(status: string): string {
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
