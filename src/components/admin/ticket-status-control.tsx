"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { apiPost } from "@/lib/api-client";

const OPTIONS = [
  { value: "in_progress", label: "قيد المعالجة" },
  { value: "awaiting_customer", label: "بانتظار العميل" },
  { value: "closed", label: "إغلاق" },
] as const;

export function TicketStatusControl({
  ticketId,
  status,
}: {
  ticketId: string;
  status: string;
}) {
  const router = useRouter();
  const [value, setValue] = useState(status);
  const [loading, setLoading] = useState(false);

  async function save() {
    setLoading(true);
    await apiPost(`/api/admin/support/${ticketId}/status`, { status: value });
    setLoading(false);
    router.refresh();
  }

  return (
    <div className="flex items-end gap-2">
      <div className="flex-1">
        <p className="mb-1 text-xs text-muted">تغيير الحالة</p>
        <select
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="h-11 w-full rounded-lg border border-border bg-input px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        >
          {OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>
      <Button loading={loading} onClick={save} disabled={value === status}>
        حفظ
      </Button>
    </div>
  );
}
