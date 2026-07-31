"use client";

import { useState, useEffect } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";

export function CurtainToggle({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isHidden, setIsHidden] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("evo-hide-header-profile");
      if (saved === "true") {
        setIsHidden(true);
      }
    } catch (e) {
      // ignore
    }
  }, []);

  function toggle() {
    const next = !isHidden;
    setIsHidden(next);
    try {
      localStorage.setItem("evo-hide-header-profile", String(next));
    } catch (e) {
      // ignore
    }
  }

  return (
    <div className="flex items-center gap-2">
      {/* Profile & Wallet Container (Hidden when curtain is closed) */}
      <div
        className={`flex items-center gap-2 transition-all duration-300 ${
          isHidden ? "opacity-0 scale-95 pointer-events-none w-0 overflow-hidden" : "opacity-100 scale-100"
        }`}
      >
        {children}
      </div>

      {/* Curtain Button */}
      <Button
        variant="ghost"
        size="sm"
        onClick={toggle}
        title={isHidden ? "إظهار شارة الحساب والمحفظة" : "ستارة — إخفاء المحفظة والحساب"}
        aria-label={isHidden ? "إظهار شارة الحساب والمحفظة" : "إخفاء المحفظة والحساب"}
        className="shrink-0 text-muted hover:text-gold"
      >
        {isHidden ? (
          <Eye className="h-4 w-4 text-gold animate-pulse" />
        ) : (
          <EyeOff className="h-4 w-4" />
        )}
      </Button>
    </div>
  );
}
