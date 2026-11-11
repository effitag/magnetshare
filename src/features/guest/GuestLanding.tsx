import { useState } from "react";
import { Link } from "react-router-dom";
import { PRINT_STATUS_LABEL } from "@/lib/magnets";
import { MagnetFrame, type CameraFrame } from "./camera/MagnetFrame";
import { GuestHero } from "./GuestHero";
import { GuestQuiet } from "./GuestQuiet";
import { MagnetMeter, type GuestShot } from "./MagnetMeter";

export type GuestFrame = {
  id: string;
  overlayUrl: string | null;
  frame: CameraFrame;
};

type Props = {
  mode: "live" | "missing" | "closed";
  title?: string;
  dateLabel?: string | null;
  coverUrl?: string | null;
  magnetsLeft?: number;
  shots?: GuestShot[];
  landscape?: GuestFrame | null;
  portrait?: GuestFrame | null;
  inApp?: boolean;
  /** A line about a saved photo being sent (outbox), shown under the event title. */
  notice?: string | null;
  cameraTo?: string;
};

function CameraIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" aria-hidden="true">
      <rect x="3" y="7" width="22" height="16" rx="4" fill="currentColor" stroke="#1C1416" strokeWidth="2" />
      <path d="M10 7.5 12 4.5h4l2 3" fill="none" stroke="#1C1416" strokeWidth="2" strokeLinejoin="round" />
      <circle cx="14" cy="15" r="4" fill="#FBF6F1" stroke="#1C1416" strokeWidth="2" />
    </svg>
  );
}

export function GuestLanding({
  mode,
  title = "",
  dateLabel,
  coverUrl,
  magnetsLeft = 0,
  shots = [],
  landscape = null,
  portrait = null,
  inApp = false,
  notice = null,
  cameraTo,
}: Props) {
  const [openId, setOpenId] = useState<string | null>(null);
  if (mode === "missing" || mode === "closed") return <GuestQuiet mode={mode} />;
  const open = shots.find((shot) => shot.id === openId) ?? null;
  const openFrame =
    (open?.frameId && portrait?.id === open.frameId ? portrait : null) ??
    (open?.frameId && landscape?.id === open.frameId ? landscape : null) ??
    landscape ??
    portrait;

  return (
    <main className="guest-stage guest-fit">
      <div className="guest-scroll">
        <GuestHero
          title={title}
          dateLabel={dateLabel}
          coverUrl={coverUrl}
          note={notice ?? (inApp ? "כדי לצלם בנוחות, פתחו את הקישור בספארי או בכרום. אפשר גם להמשיך כאן." : null)}
        />
        <div className="guest-body">
          <MagnetMeter left={magnetsLeft} shots={shots} onOpen={setOpenId} />
          <p className="guest-steps">מצלמים · מאשרים · מקבלים מגנט</p>
          <p className="guest-privacy">
            <Link to="/privacy">מדיניות הפרטיות</Link>
          </p>
        </div>
      </div>
      <Link className="guest-shoot" to={cameraTo ?? "#"}>
        <CameraIcon />
        לצלם
      </Link>
      {open && openFrame ? (
        <ShotDialog shot={open} frame={openFrame} onClose={() => setOpenId(null)} />
      ) : null}
    </main>
  );
}

function ShotDialog({ shot, frame, onClose }: { shot: GuestShot; frame: GuestFrame; onClose: () => void }) {
  const width = Math.min(320, typeof window !== "undefined" ? window.innerWidth - 48 : 320);
  return (
    <div className="guest-lightbox" role="dialog" aria-modal="true" aria-label="התמונה שלכם">
      <button type="button" className="guest-lightbox-close" onClick={onClose}>
        סגירה
      </button>
      <div className="guest-lightbox-card">
        <MagnetFrame frame={frame.frame} overlayUrl={frame.overlayUrl} width={width}>
          {shot.url ? <img src={shot.url} alt="" className="absolute inset-0 h-full w-full object-cover" /> : null}
        </MagnetFrame>
        <p className={`magnet-sticker${shot.status === "rejected" ? " is-rejected" : ""}`}>{PRINT_STATUS_LABEL[shot.status]}</p>
      </div>
    </div>
  );
}
