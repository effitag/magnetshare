import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { STARTER_CATEGORIES } from "@/features/studio/model/starters";
import { EVENT_TYPES, eventTypeLabel, eventTypeTag, isEventType } from "./eventTypes";

describe("event types", () => {
  it("has the seven agreed kinds", () => {
    expect(EVENT_TYPES.map((type) => type.id)).toEqual(["wedding", "henna", "mitzvah", "brit", "birthday", "company", "general"]);
  });

  it("filters by the same tags the studio puts on templates", () => {
    const studioTags = STARTER_CATEGORIES.map((category) => category.label);
    for (const type of EVENT_TYPES) {
      if (type.id === "company") continue; // no ready-made company frames yet
      expect(studioTags).toContain(type.tag);
    }
    expect(eventTypeTag("general")).toBe("כללי");
  });

  it("matches the database check", () => {
    const sql = readFileSync(new URL("../../supabase/migrations/202611110001_event_frames.sql", import.meta.url), "utf8");
    for (const type of EVENT_TYPES) expect(sql).toContain(`'${type.id}'`);
  });

  it("reads values safely", () => {
    expect(isEventType("wedding")).toBe(true);
    expect(isEventType("party")).toBe(false);
    expect(isEventType(null)).toBe(false);
    expect(eventTypeLabel("mitzvah")).toBe("בר/בת מצווה");
    expect(eventTypeLabel(null)).toBeNull();
  });
});
