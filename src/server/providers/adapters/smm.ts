import {
  AdapterError,
  type ProviderAdapter,
  type ProviderContext,
  type CreateOrderParams,
  type CreateOrderResult,
  type StatusResult,
  type BalanceResult,
  type TestResult,
  type ProviderOrderStatus,
  type ProviderService,
  type RefillResult,
} from "./types";

/**
 * محوّل لوحات الخدمات الرقمية (SMM Panel API v2) — المعيار الأوسع انتشارًا
 * لمزوّدي خدمات التواصل والمتابعين. يرسل POST بحقول (key, action, ...).
 *
 * credentials: { key }
 * baseUrl: نقطة نهاية الـ API (مثل https://panel.example.com/api/v2)
 * input: يستخدم الحقل المحدّد في config.linkField (افتراضي "link").
 */

const STATUS_MAP: Record<string, ProviderOrderStatus> = {
  completed: "completed",
  partial: "partial",
  canceled: "failed",
  cancelled: "failed",
  fail: "failed",
  failed: "failed",
  error: "failed",
  pending: "pending",
  "in progress": "in_progress",
  processing: "in_progress",
};

function mapStatus(raw: unknown): ProviderOrderStatus {
  const s = String(raw ?? "").trim().toLowerCase();
  return STATUS_MAP[s] ?? "in_progress";
}

/** نداء خام — يقبل كائنًا أو مصفوفة (كتالوج الخدمات يعود كمصفوفة). */
async function smmRaw(
  ctx: ProviderContext,
  fields: Record<string, string>,
  timeoutMs = 20000,
): Promise<unknown> {
  const key = ctx.credentials.key;
  if (!key) throw new AdapterError("مفتاح المزوّد (key) غير مضبوط.");

  const body = new URLSearchParams({ key, ...fields });
  let res: Response;
  try {
    res = await fetch(ctx.baseUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
      cache: "no-store",
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (e) {
    throw new AdapterError(
      "تعذّر الاتصال بالمزوّد (انتهت المهلة أو الشبكة).",
      String(e),
    );
  }

  const text = await res.text().catch(() => "");
  if (!text) throw new AdapterError("استجابة فارغة من المزوّد.");
  // سقف حجم: كتالوج ضخم أو رد خبيث يجب ألا يستنزف ذاكرة الدالة.
  const MAX_BYTES = 24 * 1024 * 1024;
  if (text.length > MAX_BYTES) {
    throw new AdapterError("استجابة المزوّد أكبر من الحد المسموح.");
  }
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    // بعض اللوحات ترجع HTML عند خطأ مصادقة/حظر — نعرض مقتطفًا مفيدًا.
    throw new AdapterError(
      `استجابة غير صالحة من المزوّد: ${text.slice(0, 120)}`,
    );
  }
  if (json && typeof json === "object" && !Array.isArray(json)) {
    const o = json as Record<string, unknown>;
    if (o.error) throw new AdapterError(String(o.error), o);
  }
  return json;
}

async function smmCall(
  ctx: ProviderContext,
  fields: Record<string, string>,
): Promise<Record<string, unknown>> {
  const json = await smmRaw(ctx, fields);
  if (!json || typeof json !== "object" || Array.isArray(json)) {
    throw new AdapterError("استجابة غير متوقعة من المزوّد.");
  }
  return json as Record<string, unknown>;
}

export const smmAdapter: ProviderAdapter = {
  key: "smm",
  label: "لوحة خدمات (SMM Panel API v2)",
  credentialFields: [{ key: "key", label: "مفتاح API (key)" }],

  async testConnection(ctx: ProviderContext): Promise<TestResult> {
    try {
      const bal = await this.getBalance(ctx);
      return {
        ok: true,
        message: "تم الاتصال بنجاح.",
        balance: bal.balance,
      };
    } catch (e) {
      return {
        ok: false,
        message: e instanceof AdapterError ? e.message : "فشل الاتصال.",
      };
    }
  },

  async getBalance(ctx: ProviderContext): Promise<BalanceResult> {
    const json = await smmCall(ctx, { action: "balance" });
    return {
      balance: json.balance != null ? String(json.balance) : null,
      currency: json.currency != null ? String(json.currency) : null,
      raw: json,
    };
  },

  async createOrder(
    ctx: ProviderContext,
    params: CreateOrderParams,
  ): Promise<CreateOrderResult> {
    const linkField = String(ctx.config.linkField ?? "link");
    const link =
      (params.input[linkField] as string | undefined) ??
      (params.input.link as string | undefined) ??
      (params.input.url as string | undefined) ??
      (params.input.target as string | undefined) ??
      (params.input.username as string | undefined) ??
      (params.input.account as string | undefined) ??
      (Object.values(params.input).find((v) => typeof v === "string" && v.trim() !== "") as string | undefined);
    if (!link) {
      throw new AdapterError(
        `يرجى تعبئة حقل الطلب المطلوب (الرابط/اسم المستخدم).`,
      );
    }

    const fields: Record<string, string> = {
      action: "add",
      service: params.externalProductId,
      link: String(link),
    };
    if (params.quantity) {
      // اللوحات (Perfect Panel وأمثالها) تتوقع كمية صحيحة —
      // قيمنا تُخزّن بمقياس عشري ("1000.0000") فتُطبّع هنا إلى "1000".
      const n = Number(params.quantity);
      fields.quantity = Number.isFinite(n)
        ? String(Math.round(n))
        : params.quantity;
    }

    const json = await smmCall(ctx, fields);
    if (json.order == null) {
      throw new AdapterError("لم يُعِد المزوّد رقم طلب.", json);
    }
    return {
      externalOrderId: String(json.order),
      status: "pending",
      charge: json.charge != null ? String(json.charge) : null,
      raw: json,
    };
  },

  async getServices(ctx: ProviderContext): Promise<ProviderService[]> {
    // كتالوج اللوحات ضخم (آلاف الخدمات، عدة ميجابايت) — مهلة أطول.
    const json = await smmRaw(ctx, { action: "services" }, 60000);
    if (!Array.isArray(json)) {
      throw new AdapterError("لم يُعِد المزوّد قائمة خدمات صالحة.");
    }
    const out: ProviderService[] = [];
    for (const raw of json) {
      if (!raw || typeof raw !== "object") continue;
      const s = raw as Record<string, unknown>;
      const id = s.service;
      if (id == null) continue;
      out.push({
        externalId: String(id),
        name: String(s.name ?? `خدمة ${id}`),
        category: s.category != null ? String(s.category) : null,
        ratePer1000: String(s.rate ?? "0"),
        minQty: s.min != null ? String(s.min) : null,
        maxQty: s.max != null ? String(s.max) : null,
        type: s.type != null ? String(s.type) : null,
      });
    }
    return out;
  },

  async getStatus(
    ctx: ProviderContext,
    externalOrderId: string,
  ): Promise<StatusResult> {
    const json = await smmCall(ctx, {
      action: "status",
      order: externalOrderId,
    });
    return {
      status: mapStatus(json.status),
      charge: json.charge != null ? String(json.charge) : null,
      deliveryData: {
        startCount: json.start_count ?? null,
        remains: json.remains ?? null,
        status: json.status ?? null,
      },
      raw: json,
    };
  },

  async createRefill(
    ctx: ProviderContext,
    externalOrderId: string,
  ): Promise<RefillResult> {
    const json = await smmCall(ctx, {
      action: "refill",
      order: externalOrderId,
    });
    // بعض اللوحات ترجع refill id، وبعضها ترجع نجاحًا فقط.
    return {
      refillId: json.refill != null ? String(json.refill) : null,
      raw: json,
    };
  },
};
