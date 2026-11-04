import { useState, type FormEvent } from "react";
import { Link, Navigate } from "react-router-dom";
import { AppError } from "@/lib/errors";
import { Button } from "@/components/ui/Button";
import { Field, inputClass } from "@/components/ui/Field";
import { useAuth } from "@/hooks/useAuth";
import { AuthCard } from "@/features/auth/AuthCard";

export function SignupPage() {
  const { user, loading, signUp } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);

  if (!loading && user) return <Navigate to="/dashboard" replace />;

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    if (name.trim().length < 2) {
      setError("השם צריך לפחות שתי אותיות.");
      return;
    }
    if (!email.includes("@")) {
      setError("הזינו אימייל תקין.");
      return;
    }
    if (password.length < 6) {
      setError("הסיסמה צריכה לפחות 6 תווים.");
      return;
    }
    setPending(true);
    try {
      const result = await signUp(email.trim(), password, name.trim());
      if (result.needsEmailConfirm) setSentTo(email.trim());
    } catch (caught) {
      setError(caught instanceof AppError ? caught.message : "ההרשמה לא הושלמה. נסו שוב.");
    } finally {
      setPending(false);
    }
  }

  if (sentTo) {
    return (
      <AuthCard title="כמעט סיימנו">
        <p className="text-muted">
          שלחנו קישור אישור אל {sentTo}. פתחו אותו ואז התחברו. אם המייל לא הגיע, בדקו גם בתיקיית הספאם.
        </p>
        <Link
          to="/login"
          className="mt-6 inline-flex min-h-11 items-center rounded-full bg-primary px-5 text-sm font-medium text-primary-ink"
        >
          למסך ההתחברות
        </Link>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title="הרשמה"
      footer={
        <>
          כבר יש חשבון?{" "}
          <Link to="/login" className="font-medium text-primary">
            התחברות
          </Link>
        </>
      }
    >
      <form className="flex flex-col gap-4" onSubmit={(event) => void onSubmit(event)} noValidate>
        <Field label="שם לתצוגה">
          <input className={inputClass} value={name} onChange={(event) => setName(event.target.value)} required />
        </Field>
        <Field label="אימייל">
          <input
            className={inputClass}
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
        </Field>
        <Field label="סיסמה" hint="לפחות 6 תווים.">
          <input
            className={inputClass}
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
        </Field>
        {error ? (
          <p className="text-sm text-primary" role="alert">
            {error}
          </p>
        ) : null}
        <Button type="submit" disabled={pending}>
          {pending ? "יוצרים חשבון…" : "יצירת חשבון"}
        </Button>
      </form>
    </AuthCard>
  );
}
