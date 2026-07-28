import { Wrench } from "lucide-react";
import { StoreLogo } from "@/components/brand/store-logo";
import { getLocale } from "@/server/locale";

const T = {
  ar: {
    title: (storeName: string) => `${storeName} تحت الصيانة`,
    desc: "نجري بعض التحسينات حاليًا وسنعود قريبًا. شكرًا لصبرك.",
  },
  en: {
    title: (storeName: string) => `${storeName} is under maintenance`,
    desc: "We're making a few improvements and will be back soon. Thanks for your patience.",
  },
} as const;

export async function MaintenanceScreen({ storeName }: { storeName: string }) {
  const t = T[await getLocale()];
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 px-4 text-center">
      <StoreLogo />
      <span className="grid h-16 w-16 place-items-center rounded-full bg-gold/10 text-gold">
        <Wrench className="h-8 w-8" />
      </span>
      <div>
        <h1 className="text-2xl font-bold">{t.title(storeName)}</h1>
        <p className="mt-2 max-w-md text-muted">
          {t.desc}
        </p>
      </div>
    </div>
  );
}
