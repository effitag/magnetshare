import { Link } from "react-router-dom";
import { AuthCard } from "@/features/auth/AuthCard";

export function ForgotPasswordPage() {
  return (
    <AuthCard title="שכחתם את הסיסמה?">
      <p className="text-muted">
        איפוס סיסמה באימייל יהיה זמין בקרוב. אין צורך לפנות אלינו — בינתיים אפשר לחזור להתחברות, או להירשם עם כתובת
        אחרת.
      </p>
      <Link
        to="/login"
        className="mt-6 inline-flex min-h-11 items-center rounded-full bg-primary px-5 text-sm font-medium text-primary-ink"
      >
        חזרה להתחברות
      </Link>
    </AuthCard>
  );
}
