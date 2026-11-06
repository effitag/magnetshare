import { describe, expect, it } from "vitest";
import { countMagnetsLeft, magnetLine, slotForSize, thumbPathFromPhoto } from "./magnets";

describe("guest magnet count", () => {
  it("ignores rejected copies and keeps one formula", () => {
    const jobs = [
      { copies: 1, status: "queued" },
      { copies: 1, status: "rejected" },
      { copies: 2, status: "printing" },
    ];
    expect(countMagnetsLeft(6, jobs)).toBe(3);
    expect(countMagnetsLeft(2, [{ copies: 1, status: "queued" }])).toBe(1);
    expect(magnetLine(0)).toBe("ניצלתם את כל המגנטים, תודה!");
  });

  it("builds the thumbnail path from the photo timestamp", () => {
    expect(thumbPathFromPhoto("event/guest/171000_photo.jpg")).toBe("event/guest/171000_thumb.webp");
  });

  it("treats a wider frame as landscape and a square as portrait", () => {
    expect(slotForSize(100, 75)).toBe("landscape");
    expect(slotForSize(75, 100)).toBe("portrait");
    expect(slotForSize(100, 100)).toBe("portrait");
  });
});
