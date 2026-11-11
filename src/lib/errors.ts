type ErrorLike = { message?: string; code?: string; status?: number };

function asError(error: unknown): ErrorLike {
  if (typeof error === "object" && error !== null) return error as ErrorLike;
  if (typeof error === "string") return { message: error };
  return {};
}

/** What the server or the network said, kept next to the Hebrew message so a send can decide whether to retry. */
export type ErrorInfo = { code?: string; status?: number; detail?: string };

export class AppError extends Error {
  readonly code?: string;
  readonly status?: number;
  readonly detail?: string;

  constructor(message: string, info: ErrorInfo = {}) {
    super(message);
    this.name = "AppError";
    this.code = info.code;
    this.status = info.status;
    this.detail = info.detail;
  }
}

/** The code, HTTP status and raw text of a Supabase, Storage, Auth or network error. */
export function errorInfo(error: unknown, status?: number): ErrorInfo {
  if (error instanceof AppError) return { code: error.code, status: error.status ?? status, detail: error.detail };
  if (typeof error !== "object" || error === null) {
    return { status, detail: typeof error === "string" ? error : undefined };
  }
  const e = error as { code?: unknown; status?: unknown; statusCode?: unknown; name?: unknown; message?: unknown };
  const code = typeof e.code === "string" && e.code ? e.code : typeof e.statusCode === "string" ? e.statusCode : undefined;
  const ownStatus = typeof e.status === "number" ? e.status : undefined;
  const name = typeof e.name === "string" ? e.name : "";
  const message = typeof e.message === "string" ? e.message : "";
  return { code, status: ownStatus ?? status, detail: [name, message].filter(Boolean).join(": ") || undefined };
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
  if (error instanceof AppError) return error;
  return new AppError(toHebrewError(error, fallback), errorInfo(error));
}
