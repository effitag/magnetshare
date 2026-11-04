import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "ghost";
};

export function Button({ variant = "primary", className, type = "button", ...props }: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        "inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-5 text-sm font-medium transition-shadow disabled:cursor-not-allowed disabled:opacity-50",
        variant === "primary" ? "bg-primary text-primary-ink" : "bg-surface text-ink shadow-card",
        className,
      )}
      {...props}
    />
  );
}
