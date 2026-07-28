/**
 * واجهة المحوّل الموحّدة (Adapter) — تسمح بإضافة مزوّدين جدد دون لمس منطق الطلبات.
 * كل محوّل يترجم بروتوكول مزوّد معيّن إلى هذه العمليات الأربع.
 */

export type ProviderOrderStatus =
  | "pending"
  | "in_progress"
  | "completed"
  | "partial"
  | "failed";

export interface ProviderContext {
  baseUrl: string;
  /** أسرار مفكوكة التشفير — تبقى في الخادم فقط. */
  credentials: Record<string, string>;
  config: Record<string, unknown>;
}

export interface CreateOrderParams {
  externalProductId: string;
  quantity: string | null;
  input: Record<string, unknown>;
  reference: string;
}

export interface CreateOrderResult {
  externalOrderId: string;
  status: ProviderOrderStatus;
  /** تكلفة فعلية لدى المزوّد إن توفّرت (نص عشري). */
  charge?: string | null;
  raw?: unknown;
}

export interface StatusResult {
  status: ProviderOrderStatus;
  deliveryData?: Record<string, unknown> | null;
  charge?: string | null;
  raw?: unknown;
}

export interface RefillResult {
  /** معرّف طلب إعادة التعبئة لدى المزوّد (إن وُجد). */
  refillId: string | null;
  raw?: unknown;
}

export interface BalanceResult {
  balance: string | null;
  currency?: string | null;
  raw?: unknown;
}

export interface TestResult {
  ok: boolean;
  message: string;
  balance?: string | null;
}

/** خدمة معروضة في كتالوج المزوّد (سعرها لدى المزوّد لكل 1000). */
export interface ProviderService {
  externalId: string;
  name: string;
  category: string | null;
  /** سعر المزوّد لكل 1000 (نص عشري كما يعيده المزوّد). */
  ratePer1000: string;
  minQty: string | null;
  maxQty: string | null;
  type: string | null;
}

export interface ProviderAdapter {
  key: string;
  label: string;
  /** الحقول المتوقّعة في credentials (للعرض في نموذج الأدمن). */
  credentialFields: { key: string; label: string }[];
  createOrder(
    ctx: ProviderContext,
    params: CreateOrderParams,
  ): Promise<CreateOrderResult>;
  getStatus(
    ctx: ProviderContext,
    externalOrderId: string,
  ): Promise<StatusResult>;
  getBalance(ctx: ProviderContext): Promise<BalanceResult>;
  testConnection(ctx: ProviderContext): Promise<TestResult>;
  /** كتالوج خدمات المزوّد (اختياري — لا تدعمه كل المحوّلات). */
  getServices?(ctx: ProviderContext): Promise<ProviderService[]>;
  /** طلب إعادة تعبئة لطلب سابق (اختياري — للمتابعين/الإعجابات التي تنقص). */
  createRefill?(
    ctx: ProviderContext,
    externalOrderId: string,
  ): Promise<RefillResult>;
}

/** خطأ محوّل — يحمل رسالة صالحة للعرض وتفاصيل للسجل. */
export class AdapterError extends Error {
  constructor(
    message: string,
    public detail?: unknown,
  ) {
    super(message);
  }
}
