import { describe, expect, it } from "vitest";
import { galleryTemplates, hiddenCount } from "./gallery";

const t = (id: string, tags: string[], widthMm = 100, heightMm = 75) => ({ id, tags, widthMm, heightMm });

const library = [
  t("plain", []),
  t("henna", ["חינה"]),
  t("general", ["כללי"]),
  t("wedding-a", ["חתונה"]),
  t("wedding-portrait", ["חתונה"], 75, 100),
  t("wedding-b", ["חתונה"]),
  t("square", ["כללי"], 100, 100),
];

const ids = (list: { id: string }[]) => list.map((item) => item.id);

describe("frame gallery", () => {
  it("shows the event's kind first, then general, and hides other kinds", () => {
    expect(ids(galleryTemplates(library, { eventType: "wedding", slot: "landscape", all: false }))).toEqual([
      "wedding-a",
      "wedding-b",
      "general",
    ]);
  });

  it("shows every template of the orientation with all, still in that order", () => {
    expect(ids(galleryTemplates(library, { eventType: "wedding", slot: "landscape", all: true }))).toEqual([
      "wedding-a",
      "wedding-b",
      "general",
      "plain",
      "henna",
    ]);
    expect(hiddenCount(library, "wedding", "landscape")).toBe(2);
  });

  it("keeps the slot's orientation, and treats a square as portrait", () => {
    expect(ids(galleryTemplates(library, { eventType: "wedding", slot: "portrait", all: false }))).toEqual([
      "wedding-portrait",
      "square",
    ]);
  });

  it("shows everything to an event without a kind", () => {
    expect(galleryTemplates(library, { eventType: null, slot: "landscape", all: false })).toHaveLength(5);
  });

  it("filters company events by their own tag", () => {
    const withCompany = [...library, t("company", ["אירוע חברה"])];
    expect(ids(galleryTemplates(withCompany, { eventType: "company", slot: "landscape", all: false }))).toEqual([
      "company",
      "general",
    ]);
  });
});
