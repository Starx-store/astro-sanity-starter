import "server-only";

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
  
  // If no +, assume it might need country code (e.g., 966)
  // For simplicity, if it doesn't start with +, just ensure it's digits
  if (!cleaned.startsWith("+")) {
    cleaned = "+" + cleaned;
  }
  
  return cleaned;
}

export async function sendWhatsAppNotification({ phone, text, type }: WhatsAppNotificationOptions): Promise<void> {
  const formattedPhone = formatWhatsAppNumber(phone);
  
  // In a real app, this would dispatch to a WhatsApp API provider (e.g. Twilio, MessageBird, or WhatsApp Cloud API)
  const apiUrl = process.env.WHATSAPP_API_URL;
  const apiToken = process.env.WHATSAPP_API_TOKEN;

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
