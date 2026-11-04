import type { ReactNode } from "react";
import { Link } from "react-router-dom";

type AuthCardProps = {
  title: string;
  children: ReactNode;
  footer?: ReactNode;
};

export function AuthCard({ title, children, footer }: AuthCardProps) {
  return (
    <div className="mx-auto flex min-h-screen max-w-lg flex-col justify-center px-4 py-10">
      <Link to="/" className="mb-6 text-lg font-semibold text-ink">
        MemoriaShare
      </Link>
      <div className="rounded-2xl bg-surface p-6 shadow-card">
        <h1 className="text-2xl font-semibold">{title}</h1>
        <div className="mt-6">{children}</div>
      </div>
      {footer ? <div className="mt-4 text-sm text-muted">{footer}</div> : null}
    </div>
  );
}
