import { describe, expect, it } from "vitest";
import { activationChecklist, canGoLive, eventPhase, phaseLabel } from "./eventState";
import { suggestSlug } from "./slug";

describe("event phase", () => {
  it("names every state in Hebrew", () => {
    expect(phaseLabel[eventPhase({ status: "draft", frameId: null, framePublished: false })]).toBe("טיוטה");
    expect(phaseLabel[eventPhase({ status: "draft", frameId: "f", framePublished: false })]).toBe("טיוטה");
    expect(phaseLabel[eventPhase({ status: "draft", frameId: "f", framePublished: true })]).toBe("מוכן להפעלה");
    expect(phaseLabel[eventPhase({ status: "live", frameId: "f", framePublished: true })]).toBe("חי");
    expect(phaseLabel[eventPhase({ status: "closed", frameId: "f", framePublished: true })]).toBe("נסגר");
  });

  it("goes live with either ready slot, and blocks a half-ready pair", () => {
    expect(canGoLive({ frameId: null, framePublished: false })).toBe(false);
    expect(canGoLive({ frameId: "f", framePublished: false })).toBe(false);
    expect(canGoLive({ frameId: "f", framePublished: true })).toBe(true);
    expect(canGoLive({ frameId: null, framePublished: false, portraitId: "p", portraitPublished: true })).toBe(true);
    expect(canGoLive({ frameId: "f", framePublished: true, portraitId: "p", portraitPublished: false })).toBe(false);
  });

  it("hides the slug and keeps it short", () => {
    expect(suggestSlug("החתונה של נועה", "ab12")).toBe("eventab12");
    expect(suggestSlug("Noa", "ab12")).toMatch(/^[a-z0-9]+$/);
  });
});

describe("activation checklist", () => {
  const ready = { title: "רון ♥ מאיה", eventDate: "2027-02-11", printQuota: 5, eventType: "wedding", hasFrame: true, hasLink: true };

  it("is all ready for a complete event", () => {
    const items = activationChecklist(ready);
    expect(items.map((item) => item.label)).toEqual(["פרטים", "מסגרת", "QR"]);
    expect(items.every((item) => item.ok)).toBe(true);
  });

  it("says what is missing", () => {
    const items = activationChecklist({ ...ready, eventType: null, eventDate: null, hasFrame: false });
    expect(items[0]).toMatchObject({ ok: false, missing: "חסר: תאריך, סוג אירוע" });
    expect(items[1]).toMatchObject({ ok: false, missing: "בחרו מסגרת" });
    expect(items[2].ok).toBe(true);
  });
});
