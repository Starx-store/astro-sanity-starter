import * as React from "react";
import { cn } from "@/lib/utils";

export type BadgeTone =
  | "gold"
  | "neutral"
  | "success"
  | "warning"
  | "danger"
  | "info";

const toneMap: Record<BadgeTone, string> = {
  gold: "bg-gold/15 text-gold border-gold/30",
  neutral: "bg-surface-2 text-muted border-border",
  success: "bg-success/15 text-success border-success/30",
  warning: "bg-warning/15 text-warning border-warning/30",
  danger: "bg-danger/15 text-danger border-danger/30",
  info: "bg-info/15 text-info border-info/30",
};

export function Badge({
  tone = "neutral",
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { tone?: BadgeTone }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium",
        toneMap[tone],
        className,
      )}
      {...props}
    />
  );
}
