"use client";

import { useState } from "react";
import { Bot, X, Send, Sparkles, CreditCard, Zap, MessageSquare } from "lucide-react";

export function AiAssistant() {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Array<{ role: "assistant" | "user"; text: string }>>([
    {
      role: "assistant",
      text: "مرحباً بك! أنا **المساعد الآلي لـ Evo Store** 🤖\nكيف يمكنني مساعدتك اليوم؟ أرسل رقم طلبك للاستعلام أو اختر سؤالاً شائعاً:",
    },
  ]);
  const [loading, setLoading] = useState(false);

  const sendMessage = async (textToSend?: string) => {
    const query = textToSend || input;
    if (!query.trim() || loading) return;

    const userMsg = query.trim();
    setInput("");
    setMessages((prev) => [...prev, { role: "user", text: userMsg }]);
    setLoading(true);

    try {
      const res = await fetch("/api/ai-assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: userMsg }),
      });
      const data = await res.json();
      setMessages((prev) => [...prev, { role: "assistant", text: data.reply || "عذراً، لم أستطع فهم استفسارك." }]);
    } catch {
      setMessages((prev) => [...prev, { role: "assistant", text: "تعذر الاتصال بالمساعد الآلي، حاول مجدداً." }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Floating Button - Symmetrical with WhatsApp */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-6 left-4 sm:left-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-r from-gold to-amber-500 text-bg shadow-xl transition-all duration-300 hover:scale-110 active:scale-95"
        aria-label="المساعد الآلي"
      >
        {isOpen ? <X className="h-6 w-6" /> : <Bot className="h-7 w-7 animate-pulse" />}
      </button>

      {/* Chat Window */}
      {isOpen && (
        <div className="fixed bottom-24 left-4 sm:left-6 z-50 flex h-[500px] w-[360px] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-2xl border border-gold/30 bg-card/95 shadow-2xl backdrop-blur-xl animate-fade-in-up">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border bg-gradient-to-r from-gold/20 via-surface to-surface p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gold/20 text-gold">
                <Sparkles className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-foreground">المساعد الآلي 🤖</h3>
                <span className="flex items-center gap-1 text-[11px] text-emerald-400">
                  <span className="h-2 w-2 rounded-full bg-emerald-400 animate-ping" /> متصل للرد الآلي
                </span>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="rounded-lg p-1 text-muted hover:bg-surface hover:text-foreground"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Messages Container */}
          <div className="flex-1 space-y-3 overflow-y-auto p-4 text-sm">
            {messages.map((m, idx) => (
              <div
                key={idx}
                className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-2.5 leading-relaxed ${
                    m.role === "user"
                      ? "bg-gold text-bg font-medium rounded-br-none"
                      : "bg-surface-2 text-foreground border border-border/60 rounded-bl-none"
                  }`}
                  style={{ whiteSpace: "pre-wrap" }}
                >
                  {m.text}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="rounded-2xl bg-surface-2 px-4 py-2 text-xs text-muted border border-border/60">
                  جاري التفكير والمعالجة... ⏳
                </div>
              </div>
            )}
          </div>

          {/* Quick Action Chips */}
          <div className="flex gap-2 overflow-x-auto border-t border-border/50 p-2.5 bg-surface/50 text-xs">
            <button
              onClick={() => sendMessage("كيف اشحن محفظتي؟")}
              className="flex shrink-0 items-center gap-1.5 rounded-full border border-border bg-surface-2 px-3 py-1 text-muted hover:border-gold hover:text-gold"
            >
              <CreditCard className="h-3.5 w-3.5 text-gold" /> طريقة الشحن
            </button>
            <button
              onClick={() => sendMessage("ما هي طريقة استلام الطلب؟")}
              className="flex shrink-0 items-center gap-1.5 rounded-full border border-border bg-surface-2 px-3 py-1 text-muted hover:border-gold hover:text-gold"
            >
              <Zap className="h-3.5 w-3.5 text-gold" /> سرعة التسليم
            </button>
          </div>

          {/* Input Box */}
          <div className="flex items-center gap-2 border-t border-border p-3 bg-surface">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && sendMessage()}
              placeholder="اكتب استفسارك أو رقم طلبك..."
              className="flex-1 rounded-xl border border-border bg-input px-3.5 py-2 text-xs text-foreground focus:border-gold focus:outline-none"
            />
            <button
              onClick={() => sendMessage()}
              disabled={loading || !input.trim()}
              className="flex h-9 w-9 items-center justify-center rounded-xl bg-gold text-bg font-bold shadow-md hover:bg-gold-strong disabled:opacity-50"
            >
              <Send className="h-4 w-4 rtl:rotate-180" />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
