import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { sentMagnets, targetBadge, targetLevel } from "@/lib/magnetTarget";
import { listAdminEvents, type AdminEventRow } from "@/services/api";
import type { MagnetCounts } from "@/services/types";
import { EventList, type EventListItem } from "@/features/admin/EventList";
import { useMagnetCounts } from "@/features/admin/events/useMagnetCounts";

function toItem(row: AdminEventRow, counts: Map<string, MagnetCounts> | null): EventListItem {
  const mine = counts?.get(row.id);
  const level = mine ? targetLevel(sentMagnets(mine), row.magnet_target) : "none";
  return {
    id: row.id,
    title: row.title,
    status: row.status,
    badge: targetBadge(level),
    badgeLevel: level,
    frameId: row.frame_id,
    framePublished: row.frame_published,
    portraitId: row.frame_portrait_id,
    portraitPublished: row.portrait_published,
  };
}

export function EventsPanel() {
  const [rows, setRows] = useState<AdminEventRow[] | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    listAdminEvents()
      .then(setRows)
      .catch((error: Error) => setMessage(error.message));
  }, []);

  // Only events with a target can carry a badge. Read once, and again on return to the page.
  const targeted = useMemo(
    () => (rows ?? []).filter((row) => row.magnet_target && row.status !== "draft").map((row) => row.id),
    [rows],
  );
  const { counts } = useMagnetCounts(targeted, { poll: false });
  const events = useMemo(() => (rows ? rows.map((row) => toItem(row, counts)) : null), [rows, counts]);

  return (
    <section className="mx-auto w-full max-w-xl px-4 pt-6">
      <div className="flex items-end justify-between gap-3">
        <h1 className="font-display text-4xl leading-none text-ink">אירועים</h1>
        <Link className="inline-flex min-h-12 items-center rounded-full bg-pop px-4 text-base text-ink" to="/admin/events/new">
          אירוע חדש
        </Link>
      </div>
      {events ? (
        <EventList events={events} />
      ) : (
        <p className="mt-6 text-base text-ink">{message ?? "טוענים…"}</p>
      )}
    </section>
  );
}
