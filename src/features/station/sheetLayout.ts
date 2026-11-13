/**
 * TEMPORARY sheet layout, until the importer confirms the DS620 media, the
 * sheet size and the cutting or mounting step (PR C replaces this file).
 *
 * One magnet per sheet: a 4×6 inch sheet turned the same way as the magnet,
 * the magnet centred on it, with short corner marks for trimming.
 */
import { PRINT_DPI, type Rect } from "./compose";

export const SHEET_INCHES = { long: 6, short: 4 } as const;

export type Sheet = {
  width: number;
  height: number;
  /** Where the magnet goes on the sheet. */
  magnet: Rect;
  /** Trim marks: short lines just outside each corner of the magnet. */
  marks: { x1: number; y1: number; x2: number; y2: number }[];
};

export function oneMagnetSheet(magnetW: number, magnetH: number, dpi = PRINT_DPI): Sheet {
  const long = SHEET_INCHES.long * dpi;
  const short = SHEET_INCHES.short * dpi;
  const width = magnetW >= magnetH ? long : short;
  const height = magnetW >= magnetH ? short : long;
  if (magnetW > width || magnetH > height) throw new Error("magnet_larger_than_sheet");
  const x = Math.round((width - magnetW) / 2);
  const y = Math.round((height - magnetH) / 2);
  const gap = Math.round(dpi / 25.4); // 1 mm away from the magnet
  const len = Math.round((dpi / 25.4) * 4); // 4 mm long
  const marks: Sheet["marks"] = [];
  for (const cx of [x, x + magnetW]) {
    for (const cy of [y, y + magnetH]) {
      const outX = cx === x ? -1 : 1;
      const outY = cy === y ? -1 : 1;
      marks.push({ x1: cx + outX * gap, y1: cy, x2: cx + outX * (gap + len), y2: cy });
      marks.push({ x1: cx, y1: cy + outY * gap, x2: cx, y2: cy + outY * (gap + len) });
    }
  }
  return { width, height, magnet: { x, y, w: magnetW, h: magnetH }, marks };
}
