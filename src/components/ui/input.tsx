import * as React from "react";
import { cn } from "@/lib/utils";

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, invalid, ...props }, ref) => {
    return (
      <input
        ref={ref}
        className={cn(
          "h-11 w-full rounded-lg border bg-input px-4 text-sm text-foreground",
          "placeholder:text-muted/70",
          "transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1 focus:ring-offset-bg",
          "disabled:cursor-not-allowed disabled:opacity-50",
          invalid ? "border-danger focus:ring-danger" : "border-border",
          className,
        )}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";
