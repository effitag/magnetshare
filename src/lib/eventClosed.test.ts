import { describe, expect, it } from "vitest";
import { AppError } from "./errors";
import { isEventClosedRefusal, shouldRecheck } from "./eventClosed";
import { SendFailed } from "./sendRetry";

describe("isEventClosedRefusal", () => {
  it("spots a send refused because the event closed", () => {
    const refused = new AppError("האירוע לא פתוח לצילום.", { code: "event_not_live" });
    expect(isEventClosedRefusal(new SendFailed("stop", refused))).toBe(true);
    expect(isEventClosedRefusal(refused)).toBe(true);
    expect(isEventClosedRefusal({ message: "event_not_live" })).toBe(true);
  });

  it("ignores every other failure", () => {
    const quota = new AppError("נגמרו המגנטים שלכם לאירוע הזה.", { code: "print_quota_exceeded" });
    expect(isEventClosedRefusal(new SendFailed("stop", quota))).toBe(false);
    expect(isEventClosedRefusal(new SendFailed("exhausted", new Error("failed to fetch")))).toBe(false);
    expect(isEventClosedRefusal(null)).toBe(false);
    expect(isEventClosedRefusal("event_not_live")).toBe(false);
  });

  it("does not treat a give-up as closed, even if the last error mentioned it", () => {
    const refused = new AppError("x", { code: "event_not_live" });
    expect(isEventClosedRefusal(new SendFailed("exhausted", refused))).toBe(false);
  });
});

describe("shouldRecheck", () => {
  it("re-reads on the first return, then at most every 10 seconds", () => {
    expect(shouldRecheck(null, 1_000)).toBe(true);
    expect(shouldRecheck(1_000, 5_000)).toBe(false);
    expect(shouldRecheck(1_000, 11_000)).toBe(true);
  });
});
