import { describe, expect, it } from "vitest";
import { coverCrop, magnetLayout, mmToPx } from "./compose";
import { clampStationCopies, printFileName } from "./printFiles";
import { oneMagnetSheet } from "./sheetLayout";
import { REJECT_REASONS, stationErrorMessage, waitedLabel } from "./stationErrors";

const frame = { widthMm: 100, heightMm: 75, windowX: 0.04, windowY: 0.0533, windowW: 0.92, windowH: 0.7267 };

describe("magnetLayout", () => {
  it("sizes the magnet at 300 dpi and places the window by millimetres", () => {
    expect(mmToPx(25.4)).toBe(300);
    const layout = magnetLayout(frame);
    expect(layout.width).toBe(1181);
    expect(layout.height).toBe(886);
    expect(layout.window).toEqual({ x: 47, y: 47, w: 1087, h: 644 });
  });
});

describe("coverCrop", () => {
  it("trims a wider source to the box ratio, centred", () => {
    expect(coverCrop(2000, 1000, { w: 100, h: 100 })).toEqual({ x: 500, y: 0, w: 1000, h: 1000 });
  });

  it("trims a taller source to the box ratio, centred", () => {
    expect(coverCrop(1000, 2000, { w: 100, h: 50 })).toEqual({ x: 0, y: 750, w: 1000, h: 500 });
  });

  it("keeps a source that already matches", () => {
    expect(coverCrop(1840, 1090, { w: 1840, h: 1090 })).toEqual({ x: 0, y: 0, w: 1840, h: 1090 });
  });
});

describe("oneMagnetSheet (temporary)", () => {
  it("centres a landscape magnet on a landscape 4x6 sheet", () => {
    const sheet = oneMagnetSheet(1181, 886);
    expect(sheet.width).toBe(1800);
    expect(sheet.height).toBe(1200);
    expect(sheet.magnet).toEqual({ x: 310, y: 157, w: 1181, h: 886 });
    expect(sheet.marks).toHaveLength(8);
    for (const m of sheet.marks) {
      const inside = (x: number, y: number) => x > 310 && x < 1491 && y > 157 && y < 1043;
      expect(inside(m.x1, m.y1) || inside(m.x2, m.y2)).toBe(false);
    }
  });

  it("turns the sheet for a portrait magnet", () => {
    const sheet = oneMagnetSheet(886, 1181);
    expect([sheet.width, sheet.height]).toEqual([1200, 1800]);
  });

  it("refuses a magnet larger than the sheet", () => {
    expect(() => oneMagnetSheet(2000, 900)).toThrow("magnet_larger_than_sheet");
  });
});

describe("print files and copies", () => {
  it("names one file per copy", () => {
    expect(printFileName("tal-eden", "0eb98097-b6d4", "577918dc-d5c1", 2, 3)).toBe("tal-eden_0eb98097_577918dc_2of3.jpg");
    expect(printFileName("../x y", "a", "b", 1, 1)).toBe("xy_a_b_1of1.jpg");
  });

  it("keeps copies between 1 and 5", () => {
    expect(clampStationCopies(0)).toBe(1);
    expect(clampStationCopies(3.7)).toBe(3);
    expect(clampStationCopies(9)).toBe(5);
    expect(clampStationCopies(Number.NaN)).toBe(1);
  });
});

describe("station texts", () => {
  it("maps refusals to Hebrew, with a fallback", () => {
    expect(stationErrorMessage("print_in_progress", "x")).toBe("המגנט הזה כבר בהדפסה בעמדה אחרת.");
    expect(stationErrorMessage("unknown", "נסו שוב")).toBe("נסו שוב");
    expect(stationErrorMessage(undefined, "נסו שוב")).toBe("נסו שוב");
  });

  it("has exactly the three approved reasons", () => {
    expect(REJECT_REASONS.map((r) => r.label)).toEqual(["תוכן לא מתאים", "לא תמונה תקינה", "כשל הדפסה"]);
  });

  it("shows how long a magnet waited", () => {
    const now = Date.parse("2026-11-13T12:00:00Z");
    expect(waitedLabel("2026-11-13T11:59:40Z", now)).toBe("עכשיו");
    expect(waitedLabel("2026-11-13T11:56:00Z", now)).toBe("לפני 4 דק׳");
    expect(waitedLabel("2026-11-13T09:30:00Z", now)).toBe("לפני 2 שע׳");
  });
});

describe("print runs on a card", () => {
  const run = (over: Partial<import("@/services/types").PrintRun>) => ({
    id: "r", jobId: "j", kind: "print" as const, copies: 1, status: "printed" as const, station: "עמדה 1", createdAt: "", ...over,
  });

  it("counts printed first prints and added copies, not reprints or failures", async () => {
    const { countedCopies } = await import("./stationJobs");
    const runs = [run({ copies: 2 }), run({ copies: 3 }), run({ kind: "reprint", copies: 1 }), run({ status: "failed", copies: 4 }), run({ jobId: "other", copies: 5 })];
    expect(countedCopies(runs, "j")).toBe(5);
  });

  it("finds the print waiting for הודפס or נכשל", async () => {
    const { openRun } = await import("./stationJobs");
    expect(openRun([run({ status: "printed" }), run({ id: "open", status: "sent" })], "j")?.id).toBe("open");
    expect(openRun([run({ status: "released" })], "j")).toBeNull();
  });
});
