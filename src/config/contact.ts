export const WHATSAPP_NUMBER = "972557209335";

const WHATSAPP_TEXT = "היי, אשמח לשמוע על מגנטים לאירוע";

export function whatsAppUrl(): string {
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(WHATSAPP_TEXT)}`;
}
