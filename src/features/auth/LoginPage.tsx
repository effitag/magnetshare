import { useState, type FormEvent } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { AppError } from "@/lib/errors";
import { Button } from "@/components/ui/Button";
import { Field, inputClass } from "@/components/ui/Field";
import { useAuth } from "@/hooks/useAuth";
import { AuthCard } from "@/features/auth/AuthCard";

export function LoginPage() {
  const { user, loading, signIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? "/dashboard";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  if (!loading && user) return <Navigate to="/dashboard" replace />;

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
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
      await signIn(email.trim(), password);
      navigate(from, { replace: true });
    } catch (caught) {
      setError(caught instanceof AppError ? caught.message : "ההתחברות לא הצליחה. נסו שוב.");
    } finally {
      setPending(false);
    }
  }

  return (
    <AuthCard
      title="התחברות"
      footer={
        <>
          אין חשבון?{" "}
          <Link to="/signup" className="font-medium text-primary">
            הרשמה
          </Link>
        </>
      }
    >
      <form className="flex flex-col gap-4" onSubmit={(event) => void onSubmit(event)} noValidate>
        <Field label="אימייל" error={error && !password ? error : undefined}>
          <input
            className={inputClass}
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
        </Field>
        <Field label="סיסמה">
          <input
            className={inputClass}
            type="password"
            autoComplete="current-password"
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
          {pending ? "מתחברים…" : "התחברות"}
        </Button>
        <Link to="/forgot-password" className="min-h-11 text-sm font-medium text-primary">
          שכחתי סיסמה
        </Link>
      </form>
    </AuthCard>
  );
}
