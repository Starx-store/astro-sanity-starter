import { NextResponse } from "next/server";
import { db } from "@/server/db";
import { orders, products } from "@/server/db/schema";
import { eq, or } from "drizzle-orm";
import { displayAmount } from "@/lib/money";
import { formatDate } from "@/lib/utils";

export const runtime = "nodejs";

const STATUS_MAP: Record<string, string> = {
  under_review: "قيد المراجعة والتدقيق ⏳",
  in_progress: "قيد التنفيذ حالياً ⚡",
  needs_info: "يتطلب معلومات إضافية منكم ⚠️",
  completed: "مكتمل وتم التسليم بنجاح 🎉",
  refunded: "تم استرجاع المبلغ للمحفظة ↩️",
  cancelled: "ملغي ❌",
  failed: "فشل التنفيذ ⚠️",
  awaiting_payment: "في انتظار الدفع 💳",
};

export async function POST(req: Request) {
  try {
    const { message } = await req.json().catch(() => ({ message: "" }));
    const text = String(message || "").trim();

    if (!text) {
      return NextResponse.json({
        reply: "أهلاً بك! كيف يمكنني مساعدتك اليوم؟ يمكنك إدخال رقم الطلب للاستعلام عن حالته، أو اختيار أحد الأسئلة الشائعة.",
      });
    }

    // 1) فحص ما إذا كان المدخل رقم طلب (مثل ORD-XXXXXX أو كود)
    const orderMatch = text.match(/ORD-[A-Z0-9-]+/i) || text.match(/[a-f0-9-]{8,36}/i);
    if (orderMatch) {
      const searchNo = orderMatch[0].trim();
      const [ord] = await db
        .select({
          orderNo: orders.orderNo,
          status: orders.status,
          totalPrice: orders.totalPrice,
          createdAt: orders.createdAt,
          productName: products.name,
        })
        .from(orders)
        .innerJoin(products, eq(products.id, orders.productId))
        .where(or(eq(orders.orderNo, searchNo), eq(orders.id, searchNo)))
        .limit(1);

      if (ord) {
        const statusAr = STATUS_MAP[ord.status] || ord.status;
        return NextResponse.json({
          reply: ` تفاصيل الطلب برقم **${ord.orderNo}**:\n\n` +
                 `📦 **المنتج**: ${ord.productName}\n` +
                 `💰 **الإجمالي**: ${displayAmount(ord.totalPrice)}$\n` +
                 `📌 **الحالة الحالية**: ${statusAr}\n` +
                 `📅 **تاريخ الطلب**: ${formatDate(ord.createdAt)}\n\n` +
                 (ord.status === "completed" 
                   ? "تم إكمال الطلب وتسليمه بنجاح! شكراً لثقتك بنا." 
                   : "جاري متابعة طلبك وتحديث حالته أوتوماتيكياً."),
        });
      } else {
        return NextResponse.json({
          reply: `عذراً، لم أجد طلباً برقم \`${searchNo}\`. تأكد من كتابة رقم الطلب بالشكل الصحيح (مثال: ORD-XXXXXX).`,
        });
      }
    }

    const query = text.toLowerCase();

    // 2) الأسئلة الشائعة
    if (query.includes("دفع") || query.includes("شحن") || query.includes("محفظة") || query.includes("طريقة")) {
      return NextResponse.json({
        reply: "💳 **طرق الدفع وتعبئة المحفظة المتاحة في المتجر**:\n\n" +
               "1️⃣ **التحويل البنكي المباشر**: (راجحي، بنك الرياض، إلخ) مع رفع إثبات التحويل.\n" +
               "2️⃣ **Binance Pay**: شحن فوري بضغطة زر وبدون عمولة.\n" +
               "3️⃣ **العملات الرقمية (Crypto / USDT)**: عبر شبكة TRC20 أو BEP20 مع تحقق آلي سريعة.\n\n" +
               "يمكنك التوجه لصفحة المحفظة لشحن رصيدك فوراً!",
      });
    }

    if (query.includes("وقت") || query.includes("سرعة") || query.includes("تستغرق") || query.includes("مظة")) {
      return NextResponse.json({
        reply: "⚡ **سرعة تنفيذ الطلبات**:\n\n" +
               "• **الخدمات الفورية (أكواد / اشتراكات)**: تُسلم فوراً بعد الدفع مباشرةً.\n" +
               "• **خدمات المتابعين والدعم**: تبدأ المعالجة التلقائية خلال 1 إلى 15 دقيقة من الشراء.",
      });
    }

    if (query.includes("تواصل") || query.includes("دعم") || query.includes("واتس") || query.includes("انسان")) {
      return NextResponse.json({
        reply: "💬 يمكنك التواصل المباشر مع فريق الدعم الفني عبر زر الواتساب الأخضر المتاح في الصفحة، أو عبر فتح تذكرة دعم من حسابك.",
      });
    }

    if (query.includes("تاجر") || query.includes("خصم") || query.includes("جملة") || query.includes("vip")) {
      return NextResponse.json({
        reply: "🏆 **باقة التجار والـ VIP**:\n\n" +
               "نوفر أسعاراً خاصة ومخصصة للتجار والموزعين! تواصل مع إدارة المتجر لترقية حسابك لحساب تاجر والاستفادة من خصومات الجملة الحصرية.",
      });
    }

    // إجابة عامة موجهة
    return NextResponse.json({
      reply: "يمكنني مساعدتك في:\n" +
             " 🔍 **تتبع حالة طلبك**: اكتب رقم الطلب (مثال: ORD-XXXX).\n" +
             " 💳 **الاستفسار عن طرق الشحن والدفع**.\n" +
             " ⚡ **معرفة سرعة التنفيذ**.\n" +
             " 💬 **التواصل مع الدعم الفني**.",
    });
  } catch {
    return NextResponse.json({
      reply: "حدث خطأ أثناء معالجة الطلب، حاول مرة أخرى لاحقاً.",
    });
  }
}
