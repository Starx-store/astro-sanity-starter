import { getSetting } from "@/server/settings/service";
import { Logo } from "./logo";

/**
 * شعار المتجر من الإعدادات (خادم فقط) — يقرأ store.logo ويمرّره للشعار.
 */
export async function StoreLogo({
  className,
  withText = true,
}: {
  className?: string;
  withText?: boolean;
}) {
  const logo = String((await getSetting<string>("store.logo", "")) ?? "");
  return <Logo className={className} withText={withText} src={logo || null} />;
}
