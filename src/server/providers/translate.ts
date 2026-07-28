import "server-only";

/**
 * ترجمة أسماء خدمات لوحات SMM إلى عربية مفهومة.
 *
 * أسماء اللوحات تقنية وإنجليزية ومزدحمة بالرموز، مثل:
 *   "Instagram Followers [ Max 1M ] | 100% Real | Low Drop | Instant Start 🚀"
 * نحوّلها إلى:
 *   الاسم: "انستقرام متابعين"
 *   الوصف: "الحد الأقصى 1M · جودة عالية · نسبة انخفاض قليلة · بدء فوري"
 *
 * الترجمة قاموسية (بلا خدمة خارجية) — سريعة ومجانية وحتمية.
 */

/** المنصات — تُستخرج لتكون بداية الاسم العربي. */
const PLATFORMS: Array<[RegExp, string]> = [
  [/\binstagram\b|\big\b/i, "انستقرام"],
  [/\btiktok\b|\btik tok\b/i, "تيك توك"],
  [/\byoutube\b|\byt\b/i, "يوتيوب"],
  [/\bfacebook\b|\bfb\b/i, "فيسبوك"],
  [/\btwitter\b|\bx\.com\b/i, "تويتر"],
  [/\btelegram\b|\btg\b/i, "تيليجرام"],
  [/\bwhatsapp\b/i, "واتساب"],
  [/\bsnapchat\b/i, "سناب شات"],
  [/\bspotify\b/i, "سبوتيفاي"],
  [/\bsoundcloud\b/i, "ساوند كلاود"],
  [/\bthreads\b/i, "ثريدز"],
  [/\bkick\b/i, "كيك"],
  [/\btwitch\b/i, "تويتش"],
  [/\bdiscord\b/i, "ديسكورد"],
  [/\blinkedin\b/i, "لينكدإن"],
  [/\bpinterest\b/i, "بينتريست"],
  [/\breddit\b/i, "ريديت"],
  [/\bgoogle\b/i, "جوجل"],
  [/\bshopee\b/i, "شوبي"],
  [/\btrustpilot\b/i, "تراست بايلوت"],
];

/** نوع الخدمة — الجزء الأساسي من الاسم. */
const SERVICE_TYPES: Array<[RegExp, string]> = [
  [/\bfollowers?\b/i, "متابعين"],
  [/\bsubscribers?\b/i, "مشتركين"],
  [/\blikes?\b/i, "إعجابات"],
  [/\bviews?\b/i, "مشاهدات"],
  [/\bcomments?\b/i, "تعليقات"],
  [/\bshares?\b/i, "مشاركات"],
  [/\bsaves?\b/i, "حفظ"],
  [/\bmembers?\b/i, "أعضاء"],
  [/\breactions?\b/i, "تفاعلات"],
  [/\bplays?\b/i, "تشغيلات"],
  [/\bwatch\s*time\b/i, "ساعات مشاهدة"],
  [/\blive\s*stream\b/i, "بث مباشر"],
  [/\bstory\s*views?\b/i, "مشاهدات ستوري"],
  [/\breel\b/i, "ريلز"],
  [/\bimpressions?\b/i, "ظهور"],
  [/\breach\b/i, "وصول"],
  [/\bvotes?\b/i, "تصويتات"],
  [/\breviews?\b/i, "تقييمات"],
  [/\btraffic\b/i, "زيارات"],
  [/\bpremium\b/i, "بريميوم"],
];

/** صفات الجودة والخصائص — تتحوّل إلى وصف مقروء. */
const ATTRIBUTES: Array<[RegExp, string]> = [
  [/\breal\b|\bhq\b|\bhigh\s*quality\b/i, "جودة عالية"],
  [/\blq\b|\blow\s*quality\b/i, "جودة اقتصادية"],
  [/\bnon\s*drop\b|\bno\s*drop\b/i, "بدون انخفاض"],
  [/\blow\s*drop\b/i, "انخفاض قليل"],
  [/\binstant\s*start\b/i, "بدء فوري"],
  [/\bfast\b|\bsuper\s*fast\b/i, "سريع"],
  [/\bslow\b/i, "تدريجي"],
  [/\brefill\b/i, "قابل لإعادة التعبئة"],
  [/\bno\s*refill\b/i, "بدون إعادة تعبئة"],
  [/\bcancel\s*enable[d]?\b/i, "يمكن الإلغاء"],
  [/\bguarantee[d]?\b/i, "مضمون"],
  [/\blifetime\b/i, "ضمان مدى الحياة"],
  [/\barab\b|\barabic\b/i, "عربي",],
  [/\bworldwide\b|\bglobal\b/i, "عالمي"],
  [/\bmixed\b/i, "منوّع"],
  [/\bfemale\b/i, "إناث"],
  [/\bmale\b/i, "ذكور"],
  [/\bactive\b/i, "نشِط"],
  [/\bold\s*accounts?\b/i, "حسابات قديمة"],
  [/\bwith\s*posts?\b/i, "حسابات بمنشورات"],
  [/\bprofile\s*pic|\bwith\s*pp\b/i, "بصور شخصية"],
  [/\bdrip\s*feed\b/i, "توزيع تدريجي"],
  [/\bautomatic\b/i, "تلقائي"],
];

const clean = (s: string) =>
  s
    // إزالة الرموز التعبيرية وعلامات الزينة
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{2B00}-\u{2BFF}]/gu, "")
    .replace(/\s+/g, " ")
    .trim();

/** استخراج الحد الأقصى/الأدنى المذكور في الاسم (مثل "Max 1M"). */
function extractLimits(name: string): string[] {
  const out: string[] = [];
  const max = name.match(/max\s*[:\-]?\s*([\d.,]+\s*[kmb]?)/i);
  if (max) out.push(`الحد الأقصى ${max[1].replace(/\s+/g, "").toUpperCase()}`);
  const min = name.match(/min\s*[:\-]?\s*([\d.,]+\s*[kmb]?)/i);
  if (min) out.push(`الحد الأدنى ${min[1].replace(/\s+/g, "").toUpperCase()}`);
  const speed = name.match(/(\d+[\d.,]*\s*[kmb]?)\s*\/\s*(day|hour|hr)/i);
  if (speed) {
    out.push(
      `السرعة ${speed[1].replace(/\s+/g, "").toUpperCase()}/${
        /day/i.test(speed[2]) ? "يوم" : "ساعة"
      }`,
    );
  }
  return out;
}

export interface TranslatedService {
  name: string;
  description: string;
}

/**
 * يحوّل اسم خدمة المزوّد إلى اسم عربي مختصر + وصف عربي للخصائص.
 * يحتفظ بالاسم الأصلي في الوصف لتيسير المطابقة عند الحاجة.
 */
export function translateServiceName(
  rawName: string,
  category?: string | null,
): TranslatedService {
  const source = clean(rawName);

  const platform = PLATFORMS.find(([re]) => re.test(source))?.[1] ?? null;
  const type = SERVICE_TYPES.find(([re]) => re.test(source))?.[1] ?? null;

  // الاسم = المنصة + نوع الخدمة. عند تعذّر التعرّف لا نسقط إلى نص المزوّد
  // الخام (يكشف صياغته وقد يحمل اسمه) — نستخدم اسمًا عامًا يعدّله الأدمن.
  let name = [platform, type].filter(Boolean).join(" ");
  if (!name) name = platform ?? "خدمة رقمية";

  // الوصف = الخصائص المكتشفة + الحدود + الاسم الأصلي للمرجعية.
  const attrs = ATTRIBUTES.filter(([re]) => re.test(source)).map(([, ar]) => ar);
  const limits = extractLimits(source);
  const parts = [...new Set([...limits, ...attrs])];

  // الوصف يُعرض للعملاء — لا نُدرج الاسم الأصلي للمزوّد فيه إطلاقًا
  // (يكشف هوية المزوّد وصياغته). الأدمن يرى الاسم الأصلي في شاشة الاستيراد.
  const description = parts.length > 0 ? parts.join(" · ") : "خدمة رقمية";

  return { name: name.slice(0, 120), description };
}
