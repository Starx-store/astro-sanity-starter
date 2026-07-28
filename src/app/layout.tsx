import type { Metadata, Viewport } from "next";
import { Cairo } from "next/font/google";
import { headers } from "next/headers";
import "./globals.css";
import { isMaintenanceMode, getSetting } from "@/server/settings/service";
import { getLocale } from "@/server/locale";
import { getSessionUser } from "@/server/auth/session";
import { isStaffOrAdmin } from "@/server/auth/rbac";
import { MaintenanceScreen } from "@/components/layout/maintenance-screen";
import { WhatsAppButton } from "@/components/layout/whatsapp-button";
import { ThemeScript } from "@/components/layout/theme-toggle";
import { AnnouncementBar } from "@/components/layout/announcement-bar";

const cairo = Cairo({
  subsets: ["arabic", "latin"],
  variable: "--font-sans",
  display: "swap",
  weight: ["400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: {
    default: "Evo Store — متجر المنتجات والخدمات الرقمية",
    template: "%s | Evo Store",
  },
  description:
    "متجر Evo لبيع المنتجات والخدمات الرقمية عبر محفظة داخلية آمنة. اشحن رصيدك واطلب بسهولة.",
  applicationName: "Evo Store",
  authors: [{ name: "Evo Store" }],
  keywords: ["Evo Store", "متجر رقمي", "خدمات رقمية", "محفظة", "شحن"],
};

export const viewport: Viewport = {
  themeColor: "#0a0a0c",
  width: "device-width",
  initialScale: 1,
};

const AUTH_PATHS = ["/login", "/register", "/forgot-password", "/reset-password"];

async function maintenanceGate(): Promise<{ blocked: boolean; storeName: string }> {
  try {
    const path = (await headers()).get("x-evo-path") ?? "/";
    if (path.startsWith("/admin") || AUTH_PATHS.some((p) => path === p)) {
      return { blocked: false, storeName: "Evo Store" };
    }
    if (!(await isMaintenanceMode())) {
      return { blocked: false, storeName: "Evo Store" };
    }
    const user = await getSessionUser();
    if (user && isStaffOrAdmin(user)) {
      return { blocked: false, storeName: "Evo Store" };
    }
    const storeName = await getSetting<string>("store.name", "Evo Store");
    return { blocked: true, storeName };
  } catch {
    return { blocked: false, storeName: "Evo Store" };
  }
}

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const path = (await headers()).get("x-evo-path") ?? "/";
  const isAdminPath = path.startsWith("/admin");
  const gate = await maintenanceGate();
  const locale = await getLocale();
  
  let announcement = { enabled: false, text: "", link: "", badge: "" };
  if (!gate.blocked) {
    announcement.enabled = await getSetting<boolean>("announcement.enabled", false);
    announcement.text = await getSetting<string>(`announcement.text_${locale}`, "");
    announcement.link = await getSetting<string>("announcement.link", "");
    announcement.badge = await getSetting<string>("announcement.badge", "");
  }

  return (
    <html
      lang={locale}
      dir={locale === "ar" ? "rtl" : "ltr"}
      className={cairo.variable}
    >
      <head>
        <ThemeScript />
      </head>
      <body className="min-h-screen bg-bg font-sans text-foreground antialiased">
        {gate.blocked ? (
          <MaintenanceScreen storeName={gate.storeName} />
        ) : (
          <>
            <AnnouncementBar 
              enabled={announcement.enabled} 
              text={announcement.text} 
              link={announcement.link} 
              badge={announcement.badge} 
            />
            {children}
            {!isAdminPath && <WhatsAppButton />}
          </>
        )}
      </body>
    </html>
  );
}
