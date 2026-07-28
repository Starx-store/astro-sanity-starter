/**
 * هل المسار داخلي وآمن لإعادة التوجيه؟
 *
 * لا يكفي أن يبدأ بـ "/": المتصفحات تعامل "//evil.com" و"/\evil.com"
 * (وأشكالها المختلطة) كعناوين خارجية بروتوكول-نسبي، فتصير إعادة توجيه مفتوحة.
 */
export function isSafePath(value: string | null | undefined): boolean {
  if (!value) return false;
  const v = value.trim();
  if (!v.startsWith("/")) return false;
  // الحرف الثاني لا يجوز أن يكون شرطة مائلة عادية أو خلفية:
  // "//evil.com" و"/\evil.com" كلاهما يُفسَّر كنطاق خارجي.
  const second = v[1];
  if (second === "/" || second === "\\") return false;
  // منع محارف التحكم التي قد تُستخدم للتحايل على التحليل.
  if (/[\u0000-\u001F\u007F]/.test(v)) return false;
  return true;
}
