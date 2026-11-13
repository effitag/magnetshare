/** Hebrew for the print-station refusals from the database functions. */
const MESSAGES: Record<string, string> = {
  print_in_progress: "המגנט הזה כבר בהדפסה בעמדה אחרת.",
  job_closed: "המגנט הזה כבר נמסר או נדחה.",
  job_not_ready: "אפשר לסמן כנמסר רק מגנט שמוכן לאיסוף.",
  too_many_copies: "אפשר עד 5 מגנטים מכל תמונה.",
  invalid_copies: "בחרו בין 1 ל־5 עותקים.",
  nothing_to_reprint: "אפשר להדפיס מחדש רק מגנט שכבר הודפס.",
  run_not_open: "ההדפסה הזו כבר סומנה.",
  not_operator: "אין לכם הרשאה לאירוע הזה.",
  not_admin: "רק מנהל יכול לבטל.",
  job_not_found: "המגנט לא נמצא.",
  invalid_station: "קבעו שם לעמדה לפני הדפסה.",
  invalid_reason: "בחרו סיבה לדחייה.",
  job_not_closed: "אין מה לבטל במגנט הזה.",
};

export function stationErrorMessage(code: string | undefined, fallback: string): string {
  return (code && MESSAGES[code]) || fallback;
}

/** The three rejection reasons, as stored and as shown. */
export const REJECT_REASONS = [
  { code: "inappropriate", label: "תוכן לא מתאים" },
  { code: "invalid_photo", label: "לא תמונה תקינה" },
  { code: "print_failure", label: "כשל הדפסה" },
] as const;

export type RejectReason = (typeof REJECT_REASONS)[number]["code"];

/** "לפני 3 דק׳" for the queue cards. */
export function waitedLabel(createdAt: string, now: number): string {
  const minutes = Math.max(0, Math.floor((now - Date.parse(createdAt)) / 60_000));
  if (minutes < 1) return "עכשיו";
  if (minutes < 60) return `לפני ${minutes} דק׳`;
  const hours = Math.floor(minutes / 60);
  return `לפני ${hours} שע׳`;
}
