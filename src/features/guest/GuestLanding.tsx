import { Link } from "react-router-dom";
import { GuestHero } from "./GuestHero";
import { GuestQuiet } from "./GuestQuiet";
import { MagnetMeter } from "./MagnetMeter";

type Props = {
  mode: "live" | "missing" | "closed";
  title?: string;
  dateLabel?: string | null;
  coverUrl?: string | null;
  frameUrl?: string | null;
  magnetsLeft?: number;
  inApp?: boolean;
  cameraTo?: string;
};

function CameraIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" aria-hidden="true">
      <rect
        x="3"
        y="7"
        width="22"
        height="16"
        rx="4"
        fill="currentColor"
        stroke="#1C1416"
        strokeWidth="2"
      />
      <path
        d="M10 7.5 12 4.5h4l2 3"
        fill="none"
        stroke="#1C1416"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <circle cx="14" cy="15" r="4" fill="#FBF6F1" stroke="#1C1416" strokeWidth="2" />
    </svg>
  );
}

export function GuestLanding({
  mode,
  title = "",
  dateLabel,
  coverUrl,
  frameUrl,
  magnetsLeft = 0,
  inApp = false,
  cameraTo,
}: Props) {
  if (mode === "missing" || mode === "closed") return <GuestQuiet mode={mode} />;

  return (
    <main className="guest-stage">
      <GuestHero
        title={title}
        dateLabel={dateLabel}
        coverUrl={coverUrl}
        frameUrl={frameUrl}
        note={inApp ? "כדי לצלם בנוחות, פתחו את הקישור בספארי או בכרום. אפשר גם להמשיך כאן." : null}
      />
      <div className="guest-body">
        <MagnetMeter left={magnetsLeft} />
        <p className="guest-steps">מצלמים · מאשרים · מקבלים מגנט</p>
        <p className="guest-privacy">
          <Link to="/privacy">מדיניות הפרטיות</Link>
        </p>
      </div>
      <Link className="guest-shoot" to={cameraTo ?? "#"}>
        <CameraIcon />
        לצלם
      </Link>
    </main>
  );
}
