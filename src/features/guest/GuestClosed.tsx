import { useState } from "react";
import { Link } from "react-router-dom";
import { MagnetFrame } from "./camera/MagnetFrame";
import { GuestHero } from "./GuestHero";
import { ShotDialog, type GuestFrame } from "./GuestLanding";
import { MagnetMeter, type GuestShot } from "./MagnetMeter";

/** Shown after the admin closed the event. */
export const CLOSED_THANKS = "האירוע הסתיים, תודה רבה";

type Props = {
  title: string;
  dateLabel: string | null;
  landscape: GuestFrame | null;
  portrait: GuestFrame | null;
  /** The guest's own magnets, read only. Empty when this browser has no guest. */
  shots: GuestShot[];
};

/**
 * The closed event's thank-you screen: the event's names and date, its magnet
 * design, and the guest's own magnets with their status. No cover photo (it
 * stays private once the event closes), no times, no camera.
 */
export function GuestClosed({ title, dateLabel, landscape, portrait, shots }: Props) {
  const [openId, setOpenId] = useState<string | null>(null);
  const design = [landscape, portrait].find((frame) => frame?.overlayUrl) ?? null;
  const open = shots.find((shot) => shot.id === openId) ?? null;
  const openFrame =
    (open?.frameId && portrait?.id === open.frameId ? portrait : null) ??
    (open?.frameId && landscape?.id === open.frameId ? landscape : null) ??
    landscape ??
    portrait;
  const width = Math.min(300, typeof window !== "undefined" ? window.innerWidth - 56 : 300);

  return (
    <main className="guest-stage">
      <GuestHero title={title} dateLabel={dateLabel} coverUrl={null} compact />
      <div className="guest-body">
        <p className="guest-thanks">{CLOSED_THANKS}</p>
        {design ? (
          <div className="guest-closed-design">
            <MagnetFrame frame={design.frame} overlayUrl={design.overlayUrl} width={width}>
              <div className="guest-fallback" />
            </MagnetFrame>
          </div>
        ) : null}
        {shots.length ? (
          <section aria-labelledby="closed-magnets">
            <h2 id="closed-magnets" className="mb-2 text-base text-ink">
              המגנטים שלכם
            </h2>
            <MagnetMeter left={0} shots={shots} onOpen={setOpenId} readOnly />
          </section>
        ) : null}
        <p className="guest-privacy">
          <Link to="/privacy">מדיניות הפרטיות</Link>
        </p>
      </div>
      {open && openFrame ? <ShotDialog shot={open} frame={openFrame} onClose={() => setOpenId(null)} /> : null}
    </main>
  );
}
