import type { ReactNode } from "react";

export const inputClass =
  "min-h-11 w-full rounded-xl border border-line bg-surface px-3 text-base text-ink outline-none focus:border-primary";

type FieldProps = {
  label: string;
  error?: string;
  hint?: string;
  children: ReactNode;
};

export function Field({ label, error, hint, children }: FieldProps) {
  return (
    <label className="flex flex-col gap-2 text-sm">
      <span className="font-medium text-ink">{label}</span>
      {children}
      {error ? (
        <span className="text-primary" role="alert">
          {error}
        </span>
      ) : hint ? (
        <span className="text-muted">{hint}</span>
      ) : null}
    </label>
  );
}
