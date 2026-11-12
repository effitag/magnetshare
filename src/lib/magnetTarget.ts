import type { MagnetCounts } from "@/services/types";

/** Magnets sent and not rejected: what the event counter shows against its target. */
export function sentMagnets(counts: MagnetCounts): number {
  return counts.queued + counts.printing + counts.ready + counts.delivered;
}

/**
 * Where the event stands against its optional target. Only for alerts:
 * nothing is blocked at any level.
 * - none: no target set
 * - under: below 80%
 * - near: 80% or more, below the target
 * - reached: the target or more
 */
export type TargetLevel = "none" | "under" | "near" | "reached";

export function targetLevel(sent: number, target: number | null): TargetLevel {
  if (!target || target < 1) return "none";
  if (sent >= target) return "reached";
  // 80% without rounding: sent / target >= 0.8.
  if (sent * 5 >= target * 4) return "near";
  return "under";
}

/** Share of the target for the progress bar, from 0 to 1. */
export function targetShare(sent: number, target: number | null): number {
  if (!target || target < 1) return 0;
  return Math.min(1, Math.max(0, sent / target));
}

/** The badge in the events list, or null when there is nothing to flag. */
export function targetBadge(level: TargetLevel): string | null {
  if (level === "reached") return "הגיע ליעד";
  if (level === "near") return "80% מהיעד";
  return null;
}

/** "X מתוך Y מגנטים", or "X מגנטים" without a target. */
export function counterLine(sent: number, target: number | null): string {
  if (!target || target < 1) return sent === 1 ? "מגנט אחד" : `${sent} מגנטים`;
  return `${sent} מתוך ${target} מגנטים`;
}

/** "+N מעל היעד" once the count passes the target, otherwise null. */
export function overTargetLine(sent: number, target: number | null): string | null {
  if (!target || target < 1 || sent <= target) return null;
  return `+${sent - target} מעל היעד`;
}

/** Parses the admin's target field: empty means no target. Returns undefined when the value is not valid. */
export function parseTarget(raw: string): number | null | undefined {
  const text = raw.trim();
  if (!text) return null;
  if (!/^\d+$/.test(text)) return undefined;
  const value = Number(text);
  return Number.isSafeInteger(value) && value >= 1 ? value : undefined;
}
