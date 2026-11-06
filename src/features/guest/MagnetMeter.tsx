import { magnetLine, PRINT_STATUS_LABEL } from "@/lib/magnets";
import type { PrintJobStatus } from "@/services/types";

export type GuestShot = {
  id: string;
  url: string | null;
  status: PrintJobStatus;
  frameId: string | null;
};

type Props = {
  left: number;
  shots?: GuestShot[];
  onOpen?: (id: string) => void;
};

function MagnetGlyph() {
  return (
    <svg width="28" height="34" viewBox="0 0 28 34" aria-hidden="true">
      <rect x="1.5" y="1.5" width="25" height="31" rx="5" fill="#9ADCFF" stroke="#1C1416" strokeWidth="2" />
      <rect x="5.5" y="5" width="17" height="16" rx="2.5" fill="#FBF6F1" stroke="#1C1416" strokeWidth="1.5" />
    </svg>
  );
}

export function MagnetMeter({ left, shots = [], onOpen }: Props) {
  const count = Math.max(0, left);
  return (
    <div>
      <ul className="guest-magnets">
        {shots.map((shot) => (
          <li key={shot.id}>
            <button
              type="button"
              className={`magnet-photo${shot.status === "rejected" ? " is-rejected" : ""}`}
              onClick={() => onOpen?.(shot.id)}
            >
              {shot.url ? <img src={shot.url} alt="" /> : <span className="magnet-photo-empty" />}
              <span className="magnet-sticker">{PRINT_STATUS_LABEL[shot.status]}</span>
            </button>
          </li>
        ))}
        {Array.from({ length: count }, (_, index) => (
          <li key={`empty-${index}`}>
            <span className="magnet-empty" />
          </li>
        ))}
      </ul>
      <p className="mt-2 text-base text-ink">{magnetLine(count)}</p>
    </div>
  );
}

export function MagnetIcons({ used, left }: { used: number; left: number }) {
  return (
    <ul className="guest-magnets" aria-hidden="true">
      {Array.from({ length: used }, (_, index) => (
        <li key={`used-${index}`}>
          <MagnetGlyph />
        </li>
      ))}
      {Array.from({ length: Math.max(0, left) }, (_, index) => (
        <li key={`left-${index}`}>
          <span className="magnet-empty" />
        </li>
      ))}
    </ul>
  );
}
