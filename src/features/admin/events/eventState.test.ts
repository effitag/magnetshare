import { describe, expect, it } from "vitest";
import { canGoLive, eventPhase, phaseLabel, slotState } from "./eventState";
import { suggestSlug } from "./slug";

describe("event phase", () => {
  it("names every state in Hebrew", () => {
    expect(phaseLabel[eventPhase({ status: "draft", frameId: null, framePublished: false })]).toBe("בלי מסגרת");
    expect(phaseLabel[eventPhase({ status: "draft", frameId: "f", framePublished: false })]).toBe("מסגרת לא פורסמה");
    expect(phaseLabel[eventPhase({ status: "draft", frameId: "f", framePublished: true })]).toBe("מוכן להפעלה");
    expect(phaseLabel[eventPhase({ status: "live", frameId: "f", framePublished: true })]).toBe("חי");
    expect(phaseLabel[eventPhase({ status: "closed", frameId: "f", framePublished: true })]).toBe("הסתיים");
  });

  it("goes live with either published slot, and blocks a half-published pair", () => {
    expect(canGoLive({ frameId: null, framePublished: false })).toBe(false);
    expect(canGoLive({ frameId: "f", framePublished: false })).toBe(false);
    expect(canGoLive({ frameId: "f", framePublished: true })).toBe(true);
    expect(canGoLive({ frameId: null, framePublished: false, portraitId: "p", portraitPublished: true })).toBe(true);
    expect(canGoLive({ frameId: "f", framePublished: true, portraitId: "p", portraitPublished: false })).toBe(false);
    expect(slotState(null, false)).toBe("אין");
    expect(slotState("f", false)).toBe("לא פורסמה");
    expect(slotState("f", true)).toBe("פורסמה");
  });

  it("hides the slug and keeps it short", () => {
    expect(suggestSlug("החתונה של נועה", "ab12")).toBe("eventab12");
    expect(suggestSlug("Noa", "ab12")).toMatch(/^[a-z0-9]+$/);
  });
});
