type ErrorLike = { message?: string; code?: string; status?: number };

function asError(error: unknown): ErrorLike {
  if (typeof error === "object" && error !== null) return error as ErrorLike;
  if (typeof error === "string") return { message: error };
  return {};
}

export class AppError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AppError";
  }
}

export function isSchemaMissing(error: unknown): boolean {
  const code = asError(error).code;
  return code === "PGRST205" || code === "42P01" || code === "PGRST204";
}

export function toHebrewError(error: unknown, fallback: string): string {
  if (error instanceof AppError) return error.message;
  const { message = "", code = "", status } = asError(error);
  const text = message.toLowerCase();

  if (isSchemaMissing(error) || text.includes("schema cache")) {
    return "הטבלאות עדיין לא הוגדרו בפרויקט. הריצו את סקריפט ההקמה ב-Supabase ואז רעננו את העמוד.";
  }
  if (code === "23505") {
    return "הנתון הזה כבר קיים. נסו שוב, ואם זה חוזר בחרו ערך אחר.";
  }
  if (code === "42501" || text.includes("row-level security")) {
    return "אין הרשאה לפעולה הזו. התחברו מחדש, או בדקו שהאירוע שייך לכם.";
  }
  if (text.includes("invalid login") || text.includes("invalid credentials")) {
    return "האימייל או הסיסמה לא נכונים. נסו שוב, או הירשמו אם עוד אין חשבון.";
  }
  if (text.includes("email not confirmed")) {
    return "צריך לאשר את האימייל לפני הכניסה. פתחו את הקישור שנשלח אליכם, ואז התחברו.";
  }
  if (text.includes("user already registered") || text.includes("already been registered")) {
    return "כבר יש חשבון עם האימייל הזה. התחברו, או השתמשו באימייל אחר.";
  }
  if (text.includes("password") && (text.includes("weak") || text.includes("at least") || text.includes("short"))) {
    return "הסיסמה קצרה מדי. בחרו לפחות 6 תווים ונסו שוב.";
  }
  if (text.includes("unable to validate email") || text.includes("invalid email")) {
    return "האימייל לא תקין. בדקו אותו ונסו שוב.";
  }
  if (status === 429 || text.includes("rate limit")) {
    return "יותר מדי ניסיונות בזמן קצר. חכו דקה ונסו שוב.";
  }
  if (text.includes("bucket") || text.includes("storage")) {
    return "העלאת התמונה נכשלה. ודאו שדלי media קיים, ונסו שוב.";
  }
  if (text.includes("network") || text.includes("fetch")) {
    return "אין חיבור לשרת. בדקו את האינטרנט ונסו שוב.";
  }
  return fallback;
}

export function toAppError(error: unknown, fallback: string): AppError {
  return new AppError(toHebrewError(error, fallback));
}
