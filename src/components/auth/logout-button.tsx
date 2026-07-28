"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { Button, type ButtonProps } from "@/components/ui/button";
import { apiPost } from "@/lib/api-client";
import { useLocale } from "@/lib/use-locale";

const T = {
  ar: { logout: "تسجيل الخروج" },
  en: { logout: "Sign out" },
} as const;

export function LogoutButton(props: ButtonProps) {
  const router = useRouter();
  const t = T[useLocale()];
  const [loading, setLoading] = useState(false);

  async function logout() {
    setLoading(true);
    await apiPost("/api/auth/logout", {});
    router.push("/");
    router.refresh();
  }

  return (
    <Button variant="outline" size="sm" onClick={logout} loading={loading} {...props}>
      <LogOut className="h-4 w-4" />
      {t.logout}
    </Button>
  );
}
