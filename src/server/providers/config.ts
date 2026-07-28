import "server-only";
import { decryptSecret } from "@/server/crypto";

/**
 * فكّ إعدادات المزوّد غير السرّية (config فقط) لعرضها في نموذج التعديل.
 * لا يُعيد الأسرار (credentials) إطلاقًا.
 */
export function unpackConfigForForm(
  encrypted: string | null,
): { linkField?: string } & Record<string, unknown> {
  if (!encrypted) return {};
  try {
    const parsed = JSON.parse(decryptSecret(encrypted)) as {
      config?: Record<string, unknown>;
    };
    return (parsed.config ?? {}) as { linkField?: string } & Record<
      string,
      unknown
    >;
  } catch {
    return {};
  }
}
