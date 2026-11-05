import { useEffect, useRef, useState, type RefObject } from "react";
import { Loader2 } from "lucide-react";
import { MagnetFrame, type CameraFrame } from "./MagnetFrame";

type Inset = { top: number; right: number; bottom: number; left: number };

type Props = {
  frame: CameraFrame;
  overlayUrl: string | null;
  inset: Inset;
  videoRef: RefObject<HTMLVideoElement>;
  isFront: boolean;
  filter: string;
  loading: boolean;
};

export function FrameViewfinder({ frame, overlayUrl, inset, videoRef, isFront, filter, loading }: Props) {
  const areaRef = useRef<HTMLDivElement>(null);
  const [area, setArea] = useState<{ w: number; h: number } | null>(null);

  useEffect(() => {
    const el = areaRef.current;
    if (!el) return undefined;
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setArea({ w: Math.floor(width), h: Math.floor(height) });
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const aspect = frame.widthMm / frame.heightMm;
  const boxWidth = area ? Math.floor(Math.min(area.w, area.h * aspect)) : 0;

  return (
    <div
      ref={areaRef}
      className="absolute flex items-center justify-center"
      style={{ top: inset.top, right: inset.right, bottom: inset.bottom, left: inset.left }}
    >
      {boxWidth > 0 ? (
        <MagnetFrame frame={frame} overlayUrl={overlayUrl} width={boxWidth}>
          {loading ? (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-ink">
              <Loader2 className="h-7 w-7 animate-spin text-paper/40" />
            </div>
          ) : null}
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="absolute inset-0 h-full w-full object-cover"
            style={{ transform: isFront ? "scaleX(-1)" : "none", filter }}
          />
        </MagnetFrame>
      ) : null}
    </div>
  );
}
