export function inAppBrowser(userAgent: string): boolean {
  return /WhatsApp|Instagram|FBAN|FBAV|FB_IAB|FBIOS|FB4A|Facebook/i.test(userAgent);
}
