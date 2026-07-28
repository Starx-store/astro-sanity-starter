import "server-only";
import { getSetting } from "@/server/settings/service";

interface WhatsAppNotificationOptions {
  phone: string;
  text: string;
  type: "order" | "deposit" | "referral" | "system";
}

/**
 * Standardizes phone formatting (cleans spaces/dashes, ensures international format)
 */
function formatWhatsAppNumber(phone: string): string {
  // Remove all non-numeric characters except +
  let cleaned = phone.replace(/[^\d+]/g, "");
  
  // If it starts with 00, replace with +
  if (cleaned.startsWith("00")) {
    cleaned = "+" + cleaned.slice(2);
  }
  
  if (!cleaned.startsWith("+") && cleaned.length > 0) {
    cleaned = "+" + cleaned;
  }
  
  return cleaned;
}

export async function sendWhatsAppNotification({ phone, text, type }: WhatsAppNotificationOptions): Promise<void> {
  if (!phone || phone.trim() === "") return;
  const formattedPhone = formatWhatsAppNumber(phone);
  
  const apiUrl = process.env.WHATSAPP_API_URL || (await getSetting<string>("whatsapp.api_url", ""));
  const apiToken = process.env.WHATSAPP_API_TOKEN || (await getSetting<string>("whatsapp.api_token", ""));

  if (apiUrl && apiToken) {
    try {
      const response = await fetch(apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiToken}`,
        },
        body: JSON.stringify({
          to: formattedPhone,
          message: text,
          type: type,
        }),
      });
      
      if (!response.ok) {
        console.error(`Failed to send WhatsApp notification to ${formattedPhone}:`, await response.text());
      }
    } catch (error) {
      console.error(`Error dispatching WhatsApp notification to ${formattedPhone}:`, error);
    }
  } else {
    // Graceful fallback / Internal logger if no external API token is provided yet
    console.log(`[WhatsApp Mock] To: ${formattedPhone} | Type: ${type}`);
    console.log(`[WhatsApp Mock] Message: ${text}`);
  }
}
