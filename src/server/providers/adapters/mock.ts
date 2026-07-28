import type {
  ProviderAdapter,
  ProviderContext,
  CreateOrderParams,
  CreateOrderResult,
  StatusResult,
  BalanceResult,
  TestResult,
} from "./types";

/**
 * محوّل تجريبي (Mock) — لا يتصل بأي جهة خارجية.
 * مفيد للتطوير والاختبار: يحاكي قبول الطلب ثم إكماله عند أول متابعة.
 * اضبط config.instant=true لإكمال فوري، أو config.failRef لمحاكاة الفشل.
 */
export const mockAdapter: ProviderAdapter = {
  key: "mock",
  label: "تجريبي (Mock)",
  credentialFields: [],

  async testConnection(): Promise<TestResult> {
    return { ok: true, message: "المحوّل التجريبي جاهز.", balance: "1000.00" };
  },

  async getBalance(): Promise<BalanceResult> {
    return { balance: "1000.00", currency: "USD" };
  },

  async createOrder(
    ctx: ProviderContext,
    params: CreateOrderParams,
  ): Promise<CreateOrderResult> {
    if (ctx.config.failRef && ctx.config.failRef === params.reference) {
      return {
        externalOrderId: `MOCK-FAIL-${params.reference}`,
        status: "failed",
        raw: { simulated: "failure" },
      };
    }
    return {
      externalOrderId: `MOCK-${params.reference}`,
      status: ctx.config.instant ? "completed" : "in_progress",
      charge: null,
      raw: { simulated: true, externalProductId: params.externalProductId },
    };
  },

  async getStatus(
    _ctx: ProviderContext,
    externalOrderId: string,
  ): Promise<StatusResult> {
    if (externalOrderId.startsWith("MOCK-FAIL-")) {
      return { status: "failed", raw: { simulated: "failure" } };
    }
    // المتابعة الأولى تُكمل الطلب (محاكاة تنفيذ ناجح)
    return {
      status: "completed",
      deliveryData: { note: "تم التنفيذ عبر المحوّل التجريبي.", externalOrderId },
      raw: { simulated: true },
    };
  },
};
