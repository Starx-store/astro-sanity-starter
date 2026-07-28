import * as React from "react";
import { cn } from "@/lib/utils";
import { AlertTriangle, CheckCircle2, Info, XCircle } from "lucide-react";

type Tone = "info" | "success" | "warning" | "danger";

const toneMap: Record<
  Tone,
  { cls: string; Icon: React.ComponentType<{ className?: string }> }
> = {
  info: { cls: "border-info/40 bg-info/10 text-info", Icon: Info },
  success: {
    cls: "border-success/40 bg-success/10 text-success",
    Icon: CheckCircle2,
  },
  warning: {
    cls: "border-warning/40 bg-warning/10 text-warning",
    Icon: AlertTriangle,
  },
  danger: { cls: "border-danger/40 bg-danger/10 text-danger", Icon: XCircle },
};

export function Alert({
  tone = "info",
  className,
  children,
}: {
  tone?: Tone;
  className?: string;
  children: React.ReactNode;
}) {
  const { cls, Icon } = toneMap[tone];
  return (
    <div
      role="alert"
      className={cn(
        "flex items-start gap-3 rounded-lg border p-3 text-sm",
        cls,
        className,
      )}
    >
      <Icon className="mt-0.5 h-4 w-4 shrink-0" />
      <div className="text-foreground/90">{children}</div>
    </div>
  );
}
