import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

type ShellProps = {
  children: ReactNode;
  width?: "narrow" | "wide";
};

export function Shell({ children, width = "wide" }: ShellProps) {
  return (
    <div className="min-h-screen">
      <main className={cn("mx-auto px-4 py-8", width === "narrow" ? "max-w-lg" : "max-w-5xl")}>{children}</main>
    </div>
  );
}
