import { downloadStationImage } from "@/services/api";
import type { StationFrame } from "@/services/types";
import { coverCrop, magnetLayout } from "./compose";
import { oneMagnetSheet } from "./sheetLayout";

/** Print output colours: paper white and black trim marks (not screen UI). */
const PAPER = "#ffffff";
const MARK = "#000000";
const JPEG_QUALITY = 0.95;

async function bitmap(path: string): Promise<ImageBitmap> {
  return createImageBitmap(await downloadStationImage(path));
}

function canvas(width: number, height: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const element = document.createElement("canvas");
  element.width = width;
  element.height = height;
  const context = element.getContext("2d");
  if (!context) throw new Error("canvas_unavailable");
  context.imageSmoothingQuality = "high";
  return [element, context];
}

/**
 * The print file for one magnet: the guest's full photo placed in the frame
 * window by millimetres, the full-size frame overlay on top, at the printer's
 * resolution, on the (temporary) sheet layout.
 */
export async function composePrintSheet(storagePath: string, frame: StationFrame): Promise<Blob> {
  const layout = magnetLayout(frame);
  const [photo, overlay] = await Promise.all([bitmap(storagePath), bitmap(frame.overlayPath)]);
  try {
    const [magnet, m] = canvas(layout.width, layout.height);
    m.fillStyle = PAPER;
    m.fillRect(0, 0, layout.width, layout.height);
    const crop = coverCrop(photo.width, photo.height, layout.window);
    m.drawImage(photo, crop.x, crop.y, crop.w, crop.h, layout.window.x, layout.window.y, layout.window.w, layout.window.h);
    m.drawImage(overlay, 0, 0, layout.width, layout.height);

    const sheet = oneMagnetSheet(layout.width, layout.height);
    const [page, p] = canvas(sheet.width, sheet.height);
    p.fillStyle = PAPER;
    p.fillRect(0, 0, sheet.width, sheet.height);
    p.drawImage(magnet, sheet.magnet.x, sheet.magnet.y);
    p.strokeStyle = MARK;
    p.lineWidth = 2;
    for (const mark of sheet.marks) {
      p.beginPath();
      p.moveTo(mark.x1, mark.y1);
      p.lineTo(mark.x2, mark.y2);
      p.stroke();
    }
    return await new Promise<Blob>((resolve, reject) =>
      page.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("encode_failed"))), "image/jpeg", JPEG_QUALITY),
    );
  } finally {
    photo.close();
    overlay.close();
  }
}
