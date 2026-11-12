import { describe, expect, it } from "vitest";
import {
  clampCopies,
  copiesMark,
  countPhotosLeft,
  countPhotosUsed,
  photoLine,
  sentTitle,
  slotForSize,
  thumbPathFromPhoto,
} from "./magnets";

describe("guest photo count", () => {
  it("counts photos, not copies, and ignores rejected ones", () => {
    const jobs = [
      { copies: 1, status: "queued" },
      { copies: 1, status: "rejected" },
      { copies: 3, status: "printing" },
    ];
    expect(countPhotosUsed(jobs)).toBe(2);
    expect(countPhotosLeft(6, jobs)).toBe(4);
    expect(countPhotosLeft(2, [{ copies: 1, status: "queued" }])).toBe(1);
    expect(countPhotosLeft(1, jobs)).toBe(0);
  });

  it("says photos on the counter", () => {
    expect(photoLine(0)).toBe("ניצלתם את כל התמונות, תודה!");
    expect(photoLine(1)).toBe("נשארה לכם תמונה אחת");
    expect(photoLine(3)).toBe("נשארו לכם 3 תמונות");
  });

  it("says magnets on the sent screen, and marks copies", () => {
    expect(sentTitle(1)).toBe("המגנט בדרך אליכם!");
    expect(sentTitle(2)).toBe("2 מגנטים בדרך אליכם!");
    expect(copiesMark(1)).toBeNull();
    expect(copiesMark(3)).toBe("×3");
  });

  it("keeps the copies between 1 and the event's maximum", () => {
    expect(clampCopies(0, 3)).toBe(1);
    expect(clampCopies(2, 3)).toBe(2);
    expect(clampCopies(4, 3)).toBe(3);
    expect(clampCopies(4, 1)).toBe(1);
    expect(clampCopies(9, 20)).toBe(5);
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
