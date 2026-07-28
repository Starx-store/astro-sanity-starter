import Link from "next/link";
import { StoreLogo } from "@/components/brand/store-logo";
import { getLocale } from "@/server/locale";

const T = {
  ar: {
    tagline: "متجر المنتجات والخدمات الرقمية عبر محفظة داخلية آمنة.",
    products: "المنتجات",
    support: "الدعم",
    terms: "الشروط والأحكام",
    privacy: "سياسة الخصوصية",
    rights: "جميع الحقوق محفوظة.",
  },
  en: {
    tagline: "Digital products and services, powered by a secure built-in wallet.",
    products: "Products",
    support: "Support",
    terms: "Terms & Conditions",
    privacy: "Privacy Policy",
    rights: "All rights reserved.",
  },
} as const;

export async function SiteFooter() {
  const t = T[await getLocale()];
  return (
    <footer className="border-t border-border/70 bg-surface/40">
      <div className="mx-auto max-w-6xl px-4 py-10">
        <div className="flex flex-col items-start justify-between gap-6 md:flex-row md:items-center">
          <div className="space-y-2">
            <StoreLogo />
            <p className="max-w-sm text-sm text-muted">
              {t.tagline}
            </p>
          </div>
          <nav className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted">
            <Link href="/#products" className="hover:text-foreground">
              {t.products}
            </Link>
            <Link href="/support" className="hover:text-foreground">
              {t.support}
            </Link>
            <Link href="/terms" className="hover:text-foreground">
              {t.terms}
            </Link>
            <Link href="/privacy" className="hover:text-foreground">
              {t.privacy}
            </Link>
          </nav>
        </div>
        <div className="mt-8 border-t border-border/60 pt-6 text-center text-xs text-muted">
          © {new Date().getFullYear()} Evo Store — {t.rights}
        </div>
      </div>
    </footer>
  );
}
