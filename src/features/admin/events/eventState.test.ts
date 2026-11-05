import { describe, expect, it } from "vitest";
import { canGoLive, eventPhase, phaseLabel } from "./eventState";
import { suggestSlug } from "./slug";

describe("event phase", () => {
  it("names every state in Hebrew", () => {
    expect(phaseLabel[eventPhase({ status: "draft", frameId: null, framePublished: false })]).toBe("בלי מסגרת");
    expect(phaseLabel[eventPhase({ status: "draft", frameId: "f", framePublished: false })]).toBe("מסגרת לא פורסמה");
    expect(phaseLabel[eventPhase({ status: "draft", frameId: "f", framePublished: true })]).toBe("מוכן להפעלה");
    expect(phaseLabel[eventPhase({ status: "live", frameId: "f", framePublished: true })]).toBe("חי");
    expect(phaseLabel[eventPhase({ status: "closed", frameId: "f", framePublished: true })]).toBe("הסתיים");
  });

  it("blocks going live until a frame is published", () => {
    expect(canGoLive({ frameId: null, framePublished: false })).toBe(false);
    expect(canGoLive({ frameId: "f", framePublished: false })).toBe(false);
    expect(canGoLive({ frameId: "f", framePublished: true })).toBe(true);
  });

  it("hides the slug and keeps it short", () => {
    expect(suggestSlug("החתונה של נועה", "ab12")).toBe("eventab12");
    expect(suggestSlug("Noa", "ab12")).toMatch(/^[a-z0-9]+$/);
  });
});
