import { cn } from "@/lib/utils";

/**
 * شعار Evo Store — يعرض صورة الشعار المرفوعة من الإعدادات إن وُجدت،
 * وإلا الشعار النصّي الافتراضي.
 */
export function Logo({
  className,
  withText = true,
  src,
}: {
  className?: string;
  withText?: boolean;
  src?: string | null;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      {src ? (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src={src}
          alt="شعار المتجر"
          className="h-10 w-10 rounded-lg object-contain"
        />
      ) : (
        <span
          aria-hidden
          className="grid h-9 w-9 place-items-center rounded-lg bg-gradient-to-br from-gold-soft via-gold to-gold-strong font-extrabold text-gold-foreground shadow-gold"
        >
          E
        </span>
      )}
      {withText && (
        <span className="text-xl font-extrabold tracking-tight">
          <span className="text-gradient-gold">Evo</span>
          <span className="text-foreground"> Store</span>
        </span>
      )}
    </span>
  );
}
