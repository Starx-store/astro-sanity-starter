/** تسميات عربية موحّدة لأنواع القيود وحالات الإيداع والطلبات — للعرض فقط. */

export type LabelTone =
  | "gold"
  | "neutral"
  | "success"
  | "warning"
  | "danger"
  | "info";

type Locale = "ar" | "en";

export const TX_TYPE_LABELS: Record<string, { label: string; tone: LabelTone }> = {
  deposit: { label: "شحن رصيد", tone: "success" },
  purchase: { label: "شراء", tone: "gold" },
  refund: { label: "استرجاع", tone: "info" },
  hold: { label: "حجز مبلغ", tone: "warning" },
  release: { label: "فك حجز", tone: "info" },
  admin_credit: { label: "إضافة إدارية", tone: "success" },
  admin_debit: { label: "خصم إداري", tone: "danger" },
  correction: { label: "تصحيح", tone: "neutral" },
};

const TX_TYPE_LABELS_EN: Record<string, { label: string; tone: LabelTone }> = {
  deposit: { label: "Top-up", tone: "success" },
  purchase: { label: "Purchase", tone: "gold" },
  refund: { label: "Refund", tone: "info" },
  hold: { label: "Hold", tone: "warning" },
  release: { label: "Hold Released", tone: "info" },
  admin_credit: { label: "Admin Credit", tone: "success" },
  admin_debit: { label: "Admin Debit", tone: "danger" },
  correction: { label: "Correction", tone: "neutral" },
};

export const DEPOSIT_STATUS_LABELS: Record<
  string,
  { label: string; tone: LabelTone }
> = {
  pending: { label: "قيد المراجعة", tone: "warning" },
  approved: { label: "معتمد", tone: "info" },
  completed: { label: "مكتمل", tone: "success" },
  rejected: { label: "مرفوض", tone: "danger" },
  expired: { label: "منتهي", tone: "neutral" },
};

const DEPOSIT_STATUS_LABELS_EN: Record<
  string,
  { label: string; tone: LabelTone }
> = {
  pending: { label: "Under Review", tone: "warning" },
  approved: { label: "Approved", tone: "info" },
  completed: { label: "Completed", tone: "success" },
  rejected: { label: "Rejected", tone: "danger" },
  expired: { label: "Expired", tone: "neutral" },
};

export const ORDER_STATUS_LABELS: Record<
  string,
  { label: string; tone: LabelTone }
> = {
  awaiting_payment: { label: "بانتظار الدفع", tone: "warning" },
  under_review: { label: "قيد المراجعة", tone: "info" },
  // لا نذكر «المزوّد» للعملاء — التسمية محايدة تصف حالة التنفيذ فقط.
  sent_to_provider: { label: "قيد التنفيذ", tone: "info" },
  in_progress: { label: "جاري التنفيذ", tone: "gold" },
  completed: { label: "مكتمل", tone: "success" },
  partially_completed: { label: "مكتمل جزئيًا", tone: "warning" },
  cancelled: { label: "ملغي", tone: "neutral" },
  failed: { label: "فشل", tone: "danger" },
  refunded: { label: "تم الاسترجاع", tone: "neutral" },
  needs_manual: { label: "يحتاج تدخلًا يدويًا", tone: "warning" },
  needs_info: { label: "بحاجة لمعلومات منك", tone: "warning" },
};

const ORDER_STATUS_LABELS_EN: Record<
  string,
  { label: string; tone: LabelTone }
> = {
  awaiting_payment: { label: "Awaiting Payment", tone: "warning" },
  under_review: { label: "Under Review", tone: "info" },
  // لا نذكر «المزوّد» للعملاء — التسمية محايدة تصف حالة التنفيذ فقط.
  sent_to_provider: { label: "Processing", tone: "info" },
  in_progress: { label: "In Progress", tone: "gold" },
  completed: { label: "Completed", tone: "success" },
  partially_completed: { label: "Partially Completed", tone: "warning" },
  cancelled: { label: "Cancelled", tone: "neutral" },
  failed: { label: "Failed", tone: "danger" },
  refunded: { label: "Refunded", tone: "neutral" },
  needs_manual: { label: "Needs Manual Handling", tone: "warning" },
  needs_info: { label: "More Info Needed", tone: "warning" },
};

export const PRODUCT_STATUS_LABELS: Record<
  string,
  { label: string; tone: LabelTone }
> = {
  active: { label: "متاح", tone: "success" },
  hidden: { label: "مخفي", tone: "neutral" },
  maintenance: { label: "صيانة", tone: "warning" },
  out_of_stock: { label: "نفدت الكمية", tone: "danger" },
};

const PRODUCT_STATUS_LABELS_EN: Record<
  string,
  { label: string; tone: LabelTone }
> = {
  active: { label: "Available", tone: "success" },
  hidden: { label: "Hidden", tone: "neutral" },
  maintenance: { label: "Maintenance", tone: "warning" },
  out_of_stock: { label: "Out of Stock", tone: "danger" },
};

export const DEPOSIT_METHOD_LABELS: Record<
  string,
  { label: string; tone: LabelTone }
> = {
  manual_admin: { label: "إداري", tone: "neutral" },
  manual_customer: { label: "تحويل يدوي", tone: "info" },
  binance: { label: "Binance Pay", tone: "gold" },
  crypto: { label: "عملة رقمية (BEP20)", tone: "gold" },
};

const DEPOSIT_METHOD_LABELS_EN: Record<
  string,
  { label: string; tone: LabelTone }
> = {
  manual_admin: { label: "Admin", tone: "neutral" },
  manual_customer: { label: "Manual Transfer", tone: "info" },
  binance: { label: "Binance Pay", tone: "gold" },
  crypto: { label: "Crypto (BEP20)", tone: "gold" },
};

export function depositMethodLabel(method: string, locale: Locale = "ar") {
  const map =
    locale === "en" ? DEPOSIT_METHOD_LABELS_EN : DEPOSIT_METHOD_LABELS;
  return (
    map[method] ?? {
      label: method,
      tone: "neutral" as LabelTone,
    }
  );
}

export const PROVIDER_STATUS_LABELS: Record<
  string,
  { label: string; tone: LabelTone }
> = {
  active: { label: "نشط", tone: "success" },
  paused: { label: "موقوف", tone: "neutral" },
};

const PROVIDER_STATUS_LABELS_EN: Record<
  string,
  { label: string; tone: LabelTone }
> = {
  active: { label: "Active", tone: "success" },
  paused: { label: "Paused", tone: "neutral" },
};

export const TICKET_STATUS_LABELS: Record<
  string,
  { label: string; tone: LabelTone }
> = {
  new: { label: "جديدة", tone: "info" },
  in_progress: { label: "قيد المعالجة", tone: "gold" },
  awaiting_customer: { label: "بانتظار ردّك", tone: "warning" },
  closed: { label: "مغلقة", tone: "neutral" },
};

const TICKET_STATUS_LABELS_EN: Record<
  string,
  { label: string; tone: LabelTone }
> = {
  new: { label: "New", tone: "info" },
  in_progress: { label: "In Progress", tone: "gold" },
  awaiting_customer: { label: "Awaiting Your Reply", tone: "warning" },
  closed: { label: "Closed", tone: "neutral" },
};

export const DEPARTMENT_LABELS: Record<string, string> = {
  general: "عام",
  orders: "الطلبات",
  payments: "المدفوعات",
  technical: "تقني",
};

const DEPARTMENT_LABELS_EN: Record<string, string> = {
  general: "General",
  orders: "Orders",
  payments: "Payments",
  technical: "Technical",
};

export const PRIORITY_LABELS: Record<string, { label: string; tone: LabelTone }> = {
  low: { label: "منخفضة", tone: "neutral" },
  normal: { label: "عادية", tone: "info" },
  high: { label: "عاجلة", tone: "danger" },
};

const PRIORITY_LABELS_EN: Record<string, { label: string; tone: LabelTone }> = {
  low: { label: "Low", tone: "neutral" },
  normal: { label: "Normal", tone: "info" },
  high: { label: "Urgent", tone: "danger" },
};

export function ticketStatusLabel(status: string, locale: Locale = "ar") {
  const map = locale === "en" ? TICKET_STATUS_LABELS_EN : TICKET_STATUS_LABELS;
  return map[status] ?? { label: status, tone: "neutral" as LabelTone };
}
export function departmentLabel(d: string, locale: Locale = "ar") {
  const map = locale === "en" ? DEPARTMENT_LABELS_EN : DEPARTMENT_LABELS;
  return map[d] ?? d;
}
export function priorityLabel(p: string, locale: Locale = "ar") {
  const map = locale === "en" ? PRIORITY_LABELS_EN : PRIORITY_LABELS;
  return map[p] ?? { label: p, tone: "neutral" as LabelTone };
}

export function providerStatusLabel(status: string, locale: Locale = "ar") {
  const map =
    locale === "en" ? PROVIDER_STATUS_LABELS_EN : PROVIDER_STATUS_LABELS;
  return (
    map[status] ?? {
      label: status,
      tone: "neutral" as LabelTone,
    }
  );
}

export function txTypeLabel(type: string, locale: Locale = "ar") {
  const map = locale === "en" ? TX_TYPE_LABELS_EN : TX_TYPE_LABELS;
  return map[type] ?? { label: type, tone: "neutral" as LabelTone };
}

export function depositStatusLabel(status: string, locale: Locale = "ar") {
  const map =
    locale === "en" ? DEPOSIT_STATUS_LABELS_EN : DEPOSIT_STATUS_LABELS;
  return (
    map[status] ?? {
      label: status,
      tone: "neutral" as LabelTone,
    }
  );
}

export function orderStatusLabel(status: string, locale: Locale = "ar") {
  const map = locale === "en" ? ORDER_STATUS_LABELS_EN : ORDER_STATUS_LABELS;
  return (
    map[status] ?? {
      label: status,
      tone: "neutral" as LabelTone,
    }
  );
}

export function productStatusLabel(status: string, locale: Locale = "ar") {
  const map =
    locale === "en" ? PRODUCT_STATUS_LABELS_EN : PRODUCT_STATUS_LABELS;
  return (
    map[status] ?? {
      label: status,
      tone: "neutral" as LabelTone,
    }
  );
}
