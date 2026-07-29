import * as React from "react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "outline" | "ghost" | "danger" | "subtle";
type Size = "sm" | "md" | "lg" | "icon";

const variantClasses: Record<Variant, string> = {
  primary:
    "bg-gradient-to-b from-gold to-gold-strong text-gold-foreground hover:from-gold-strong hover:to-gold-strong shadow-gold transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] shadow-md hover:shadow-gold/20",
  outline:
    "border border-border bg-transparent text-foreground hover:bg-surface-2 transition-all duration-200 hover:border-gold/40 active:scale-[0.98]",
  ghost: "bg-transparent text-foreground hover:bg-surface-2 transition-colors duration-200 active:scale-[0.98]",
  danger: "bg-danger text-white hover:opacity-90 transition-opacity active:scale-[0.98]",
  subtle: "bg-surface-2 text-foreground hover:bg-border transition-colors duration-200 active:scale-[0.98]",
};

const sizeClasses: Record<Size, string> = {
  sm: "h-9 px-3 text-sm rounded-md",
  md: "h-11 px-5 text-sm rounded-lg",
  lg: "h-12 px-7 text-base rounded-lg",
  icon: "h-10 w-10 rounded-lg",
};

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    { className, variant = "primary", size = "md", loading, disabled, children, ...props },
    ref,
  ) => {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={cn(
          "inline-flex select-none items-center justify-center gap-2 font-semibold transition-all duration-150",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg",
          "disabled:cursor-not-allowed disabled:opacity-50",
          variantClasses[variant],
          sizeClasses[size],
          className,
        )}
        {...props}
      >
        {loading && (
          <span
            aria-hidden
            className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
          />
        )}
        {children}
      </button>
    );
  },
);
Button.displayName = "Button";
