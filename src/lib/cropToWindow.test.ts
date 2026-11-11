import { describe, expect, it } from "vitest";
import { capLongEdge, coverCropSource, printWindowPixels, encodeThumb } from "./cropToWindow";

describe("print window crop", () => {
  it("sizes the window at 25 pixels per millimetre", () => {
    expect(
      printWindowPixels({ widthMm: 100, heightMm: 150, windowW: 0.5, windowH: 0.8 }),
    ).toEqual({ width: 1250, height: 3000 });
  });

  it("caps the long edge at 3000 and keeps the aspect", () => {
    expect(
      printWindowPixels({ widthMm: 200, heightMm: 100, windowW: 1, windowH: 1 }),
    ).toEqual({ width: 3000, height: 1500 });
    expect(capLongEdge(5000, 2500, 3000)).toEqual({ width: 3000, height: 1500 });
  });

  it("cover-crops from the center, not the top", () => {
    expect(coverCropSource(4000, 3000, 1)).toEqual({ sx: 500, sy: 0, sw: 3000, sh: 3000 });
    expect(coverCropSource(3000, 4000, 1)).toEqual({ sx: 0, sy: 500, sw: 3000, sh: 3000 });
  });
});

describe("thumbnail format", () => {
  const blob = (type: string) => new Blob(["x"], { type });

  it("keeps WebP when the browser can encode it", async () => {
    const thumb = await encodeThumb(async (type) => blob(type));
    expect(thumb.type).toBe("image/webp");
  });

  it("uses JPEG when the browser quietly returns PNG instead of WebP (iPhone)", async () => {
    const asked: string[] = [];
    const thumb = await encodeThumb(async (type) => {
      asked.push(type);
      return type === "image/webp" ? blob("image/png") : blob(type);
    });
    expect(thumb.type).toBe("image/jpeg");
    expect(asked).toEqual(["image/webp", "image/jpeg"]);
  });

  it("uses JPEG when WebP gives nothing, and fails only when nothing can be encoded", async () => {
    expect((await encodeThumb(async (type) => (type === "image/jpeg" ? blob(type) : null))).type).toBe("image/jpeg");
    await expect(encodeThumb(async () => null)).rejects.toThrow("thumb");
  });
});
