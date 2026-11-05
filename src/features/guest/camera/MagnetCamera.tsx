import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { CameraOff, Film, Loader2, RotateCw, Upload, X, Zap, ZapOff } from "lucide-react";
import { canvasToJpeg, cropCanvasToWindow, type WindowFrame } from "@/lib/cropToWindow";
import type { PrintJob } from "@/services/types";
import { inAppBrowser } from "../browser";
import { FrameViewfinder } from "./FrameViewfinder";
import { MagnetReview } from "./MagnetReview";
import { PrintStatus } from "./PrintStatus";
import type { CameraFrame } from "./MagnetFrame";

const VINTAGE_FILTER = "sepia(0.35) contrast(0.88) brightness(1.08) saturate(1.15)";

function trackTorch(track: MediaStreamTrack | null): boolean {
  const capabilities = (track?.getCapabilities?.() ?? {}) as { torch?: boolean };
  return capabilities.torch === true;
}

function applyVintagePixels(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const image = ctx.getImageData(0, 0, w, h);
  const px = image.data;
  for (let i = 0; i < px.length; i += 4) {
    const r = px[i];
    const g = px[i + 1];
    const b = px[i + 2];
    px[i] = 30 + ((r * 0.88 + g * 0.1 + b * 0.02) / 255) * 200;
    px[i + 1] = 25 + ((r * 0.05 + g * 0.9 + b * 0.05) / 255) * 200;
    px[i + 2] = 20 + ((r * 0.05 + g * 0.05 + b * 0.9) / 255) * 200;
  }
  ctx.putImageData(image, 0, 0);
}

type Props = {
  eventId: string;
  guestId: string;
  frame: CameraFrame;
  overlayUrl: string | null;
  remaining: number;
  jobs: PrintJob[];
  onClose: () => void;
  onSent: () => void;
};

export function MagnetCamera({ eventId, guestId, frame, overlayUrl, remaining, jobs, onClose, onSent }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const videoTrackRef = useRef<MediaStreamTrack | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const capturingRef = useRef(false);
  const startIdRef = useRef(0);
  const timeoutsRef = useRef<number[]>([]);
  const capturedCountRef = useRef(0);
  const photoUrlRef = useRef<string | null>(null);

  const [isFront, setIsFront] = useState(false);
  const [flash, setFlash] = useState<"off" | "on">("off");
  const [vintage, setVintage] = useState(false);
  const [loading, setLoading] = useState(true);
  const [camError, setCamError] = useState<string | null>(null);
  const [allowPicker, setAllowPicker] = useState(false);
  const [camFailed, setCamFailed] = useState(() => inAppBrowser(navigator.userAgent));
  const [shutterFx, setShutterFx] = useState(false);
  const [blackFx, setBlackFx] = useState(false);
  const [frontFlash, setFrontFlash] = useState(false);
  const [mode, setMode] = useState<"camera" | "review" | "sent">("camera");
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [photoBlob, setPhotoBlob] = useState<Blob | null>(null);
  const [landscape, setLandscape] = useState(() => window.matchMedia("(orientation: landscape)").matches);

  function later(fn: () => void, ms: number) {
    const id = window.setTimeout(fn, ms);
    timeoutsRef.current.push(id);
    return id;
  }

  function rememberPhoto(url: string, blob: Blob) {
    if (photoUrlRef.current) URL.revokeObjectURL(photoUrlRef.current);
    photoUrlRef.current = url;
    setPhotoUrl(url);
    setPhotoBlob(blob);
  }

  useEffect(() => () => {
    timeoutsRef.current.forEach(clearTimeout);
    if (photoUrlRef.current) URL.revokeObjectURL(photoUrlRef.current);
  }, []);

  useEffect(() => {
    capturedCountRef.current = 0;
  }, [remaining]);

  useEffect(() => {
    const query = window.matchMedia("(orientation: landscape)");
    const onChange = () => setLandscape(query.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    if (mode !== "camera" || camFailed) return undefined;
    void startCamera();
    return stopCamera;
    // startCamera closes over the latest facing mode. The id guard drops stale streams.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isFront, mode, camFailed]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function startCamera() {
    if (!navigator.mediaDevices?.getUserMedia) {
      setCamFailed(true);
      setLoading(false);
      return;
    }
    const id = ++startIdRef.current;
    setLoading(true);
    setCamError(null);
    streamRef.current?.getTracks().forEach((track) => track.stop());
    try {
      let stream: MediaStream;
      const facingMode = isFront ? "user" : "environment";
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode, width: { ideal: 1920 }, height: { ideal: 1080 } },
          audio: false,
        });
      } catch (error) {
        const name = error instanceof DOMException ? error.name : "";
        if (name === "OverconstrainedError") {
          stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode }, audio: false });
        } else if (name === "NotAllowedError" && inAppBrowser(navigator.userAgent)) {
          if (id !== startIdRef.current) return;
          setCamFailed(true);
          setLoading(false);
          return;
        } else if (name === "NotAllowedError" || name === "NotFoundError" || name === "NotReadableError") {
          throw error;
        } else {
          if (id !== startIdRef.current) return;
          setCamFailed(true);
          setLoading(false);
          return;
        }
      }
      if (id !== startIdRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch(() => undefined);
      }
      videoTrackRef.current = stream.getVideoTracks()[0] ?? null;
    } catch (error) {
      if (id !== startIdRef.current) return;
      const name = error instanceof DOMException ? error.name : "";
      const messages: Record<string, string> = {
        NotAllowedError: "הגישה למצלמה נדחתה. אפשר לבחור תמונה מהמכשיר.",
        NotFoundError: "לא נמצאה מצלמה במכשיר.",
        NotReadableError: "המצלמה תפוסה על ידי אפליקציה אחרת.",
      };
      setAllowPicker(name === "NotAllowedError");
      setCamError(messages[name] || "לא ניתן לגשת למצלמה. נסו בדפדפן אחר.");
    } finally {
      if (id === startIdRef.current) setLoading(false);
    }
  }

  function stopCamera() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    videoTrackRef.current = null;
  }

  async function toggleFlash() {
    const next = flash === "off" ? "on" : "off";
    setFlash(next);
    const track = videoTrackRef.current;
    const torch = trackTorch(track);
    if (torch) {
      await track?.applyConstraints({ advanced: [{ torch: next === "on" }] } as unknown as MediaTrackConstraints).catch(() => undefined);
    }
  }

  async function finishPhoto(source: HTMLCanvasElement) {
    const windowFrame: WindowFrame = {
      widthMm: frame.widthMm,
      heightMm: frame.heightMm,
      windowW: frame.windowW,
      windowH: frame.windowH,
    };
    const cropped = cropCanvasToWindow(source, source.width, source.height, windowFrame);
    const blob = await canvasToJpeg(cropped);
    rememberPhoto(URL.createObjectURL(blob), blob);
    setMode("review");
  }

  async function handleCapture() {
    const video = videoRef.current;
    if (!video || loading || capturingRef.current) return;
    if (remaining - capturedCountRef.current <= 0) {
      if (navigator.vibrate) navigator.vibrate([10, 50, 10]);
      return;
    }
    if (!video.videoWidth || !video.videoHeight) return;
    capturingRef.current = true;
    if (navigator.vibrate) navigator.vibrate(40);
    try {
      const needFrontFlash = flash === "on" && !trackTorch(videoTrackRef.current);
      if (needFrontFlash) {
        setFrontFlash(true);
        await new Promise((resolve) => later(() => resolve(undefined), 50));
      }
      setBlackFx(true);
      await new Promise((resolve) => later(() => resolve(undefined), 25));
      setBlackFx(false);
      setShutterFx(true);
      later(() => setShutterFx(false), 150);
      if (needFrontFlash) later(() => setFrontFlash(false), 200);

      const canvas = canvasRef.current;
      if (!canvas) return;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.save();
      if (isFront) {
        ctx.translate(canvas.width, 0);
        ctx.scale(-1, 1);
      }
      if (vintage && typeof ctx.filter !== "undefined") ctx.filter = VINTAGE_FILTER;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      ctx.restore();
      if (vintage && typeof ctx.filter === "undefined") applyVintagePixels(ctx, canvas.width, canvas.height);
      await finishPhoto(canvas);
    } finally {
      capturingRef.current = false;
    }
  }

  function handleRetake() {
    setMode("camera");
    capturingRef.current = false;
  }

  async function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const url = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const next = new Image();
      next.onload = () => resolve(next);
      next.onerror = () => reject(new Error("image"));
      next.src = url;
    });
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(image, 0, 0);
    await finishPhoto(canvas);
  }

  const inset = landscape
    ? { top: 12, bottom: 12, right: 76, left: 132 }
    : { top: 72, bottom: 140, right: 20, left: 20 };
  const disabled = loading || remaining - capturedCountRef.current <= 0;
  const fileInput = (
    <input ref={fileInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFile} />
  );

  if (mode === "sent") {
    return <PrintStatus jobs={jobs} remaining={remaining} onAgain={handleRetake} onClose={onClose} />;
  }

  if (mode === "review" && photoUrl && photoBlob) {
    return (
      <MagnetReview
        photoUrl={photoUrl}
        blob={photoBlob}
        eventId={eventId}
        guestId={guestId}
        frame={frame}
        overlayUrl={overlayUrl}
        onRetake={handleRetake}
        onSent={() => {
          capturedCountRef.current += 1;
          onSent();
          setMode("sent");
        }}
      />
    );
  }

  if (camFailed) {
    return (
      <div className="cam-root bg-paper" dir="rtl">
        {fileInput}
        <button type="button" onClick={onClose} aria-label="סגור" className="cam-glass absolute right-5 top-12">
          <X className="h-4 w-4" />
        </button>
        <div className="flex min-h-dvh flex-col items-center justify-center px-8 text-center">
          <CameraOff className="mb-4 h-10 w-10 text-ink" />
          <h1 className="font-display text-3xl text-ink">נפתח בתוך אפליקציה</h1>
          <p className="mt-3 max-w-[260px] text-base leading-relaxed text-ink">
            הדפדפן הפנימי לא פותח את המצלמה. אפשר לצלם מהגלריה, או לפתוח ב-Safari או ב-Chrome.
          </p>
          <button type="button" className="cam-send mt-8" onClick={() => fileInputRef.current?.click()}>
            <Upload className="h-5 w-5" />
            בחרו תמונה
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="cam-root" dir="rtl" role="dialog" aria-modal="true" aria-label="מצלמה לאירוע">
      {fileInput}
      <canvas ref={canvasRef} className="hidden" />
      <div className={`pointer-events-none absolute inset-0 z-[115] bg-black transition-opacity duration-75 ${blackFx ? "opacity-100" : "opacity-0"}`} />
      <div className={`pointer-events-none absolute inset-0 z-[110] bg-white transition-opacity duration-150 ${shutterFx ? "opacity-80" : "opacity-0"}`} />
      <div className={`pointer-events-none absolute inset-0 z-[101] bg-[#FFF5EC] ${frontFlash ? "opacity-100" : "opacity-0"}`} style={{ transitionDuration: frontFlash ? "50ms" : "200ms" }} />
      {camError ? (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-paper p-8 text-center" role="alert">
          <CameraOff className="mb-3 h-10 w-10 text-primary" />
          <p className="mb-5 text-base text-ink">{camError}</p>
          <div className="flex flex-col gap-3">
            <button type="button" className="cam-send" onClick={() => void startCamera()}>נסו שוב</button>
            {allowPicker ? (
              <button type="button" className="cam-send" onClick={() => fileInputRef.current?.click()}>בחרו תמונה</button>
            ) : null}
            <button type="button" className="cam-text" onClick={onClose}>חזרה</button>
          </div>
        </div>
      ) : (
        <FrameViewfinder
          frame={frame}
          overlayUrl={overlayUrl}
          inset={inset}
          videoRef={videoRef}
          isFront={isFront}
          filter={vintage ? VINTAGE_FILTER : "none"}
          loading={loading}
        />
      )}
      <div className={`absolute inset-x-0 top-0 z-40 flex items-center justify-between px-5 ${landscape ? "pt-3" : "pt-12"}`}>
        <button type="button" onClick={onClose} aria-label="סגור מצלמה" className="cam-glass h-10 w-10">
          <X className="h-4 w-4" />
        </button>
        <p className="cam-quota">{remaining <= 0 ? "המכסה הסתיימה" : `${remaining} נותרו`}</p>
      </div>
      {!camError ? (
        <div
          className={landscape ? "absolute inset-y-0 left-0 z-40 grid w-[120px] grid-rows-[1fr_auto_1fr] items-center justify-items-center py-4" : "absolute inset-x-0 bottom-0 z-40 grid grid-cols-[1fr_auto_1fr] items-center px-6"}
          style={landscape ? { paddingLeft: "env(safe-area-inset-left, 0px)" } : { paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 34px)" }}
        >
          <div className="flex items-center justify-center gap-3">
            <button type="button" onClick={() => void toggleFlash()} aria-label={flash === "on" ? "כבו פלאש" : "הפעילו פלאש"} aria-pressed={flash === "on"} className="cam-glass">
              {flash === "on" ? <Zap className="h-5 w-5" /> : <ZapOff className="h-5 w-5" />}
            </button>
            <button type="button" onClick={() => setVintage((value) => !value)} aria-label={vintage ? "בטלו פילטר וינטאג׳" : "הפעילו פילטר וינטאג׳"} aria-pressed={vintage} className="cam-glass">
              <Film className="h-5 w-5" />
            </button>
          </div>
          <button type="button" onClick={() => void handleCapture()} aria-label="צלמו תמונה" aria-disabled={disabled} className={`relative flex h-20 w-20 items-center justify-center ${disabled ? "opacity-25" : ""}`}>
            <span className="absolute inset-0 rounded-full border-[3.5px] border-paper/80" />
            <span className={`h-[61px] w-[61px] rounded-full ${loading ? "bg-paper/40" : "bg-pop"}`} />
            {loading ? <Loader2 className="absolute h-5 w-5 animate-spin text-ink" /> : null}
          </button>
          <div className="flex items-center justify-center">
            <button type="button" onClick={() => setIsFront((value) => !value)} aria-label="החליפו מצלמה קדמית או אחורית" className="cam-glass">
              <RotateCw className="h-5 w-5" />
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
