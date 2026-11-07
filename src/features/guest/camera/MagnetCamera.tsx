import { useCallback, useEffect, useRef, useState, type ChangeEvent } from "react";
import { CameraOff, Film, Loader2, RotateCw, Upload, X, Zap, ZapOff } from "lucide-react";
import { canvasToJpeg, cropCanvasToWindow, type WindowFrame } from "@/lib/cropToWindow";
import { countMagnetsLeft } from "@/lib/magnets";
import type { PrintJob } from "@/services/types";
import { inAppBrowser } from "../browser";
import { FrameViewfinder } from "./FrameViewfinder";
import type { CameraFrame } from "./MagnetFrame";
import { MagnetReview } from "./MagnetReview";
import { PrintStatus } from "./PrintStatus";

export const VINTAGE_FILTER_ENABLED = false;
const VINTAGE_FILTER = "sepia(0.35) contrast(0.88) brightness(1.08) saturate(1.15)";

let cameraQueue: Promise<void> = Promise.resolve();

function enqueueCamera(run: () => Promise<void>) {
  const job = cameraQueue.then(run, run);
  cameraQueue = job.then(
    () => undefined,
    () => undefined,
  );
  return job;
}

export type CameraChoice = {
  id: string;
  overlayUrl: string | null;
  frame: CameraFrame;
};

type Orient = "landscape" | "portrait";

function orientKey(eventId: string) {
  return `magnetimshare:frame-orient:${eventId}`;
}

function readOrient(eventId: string): Orient | null {
  try {
    const value = localStorage.getItem(orientKey(eventId));
    return value === "landscape" || value === "portrait" ? value : null;
  } catch {
    return null;
  }
}

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
  quota: number;
  landscape: CameraChoice | null;
  portrait: CameraChoice | null;
  jobs: PrintJob[];
  onClose: () => void;
  onPrinted: () => Promise<PrintJob[]>;
  onRefreshJobs: () => Promise<PrintJob[]>;
};

export function MagnetCamera({
  eventId,
  guestId,
  quota,
  landscape,
  portrait,
  jobs,
  onClose,
  onPrinted,
  onRefreshJobs,
}: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const videoTrackRef = useRef<MediaStreamTrack | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const capturingRef = useRef(false);
  const startIdRef = useRef(0);
  const timeoutsRef = useRef<number[]>([]);
  const photoUrlRef = useRef<string | null>(null);
  const modeRef = useRef<"camera" | "review" | "sent">("camera");
  const isFrontRef = useRef(false);
  const camFailedRef = useRef(false);
  const facingSeen = useRef(false);
  const ensureRef = useRef<() => Promise<void>>(async () => undefined);
  const refreshRef = useRef(onRefreshJobs);
  const refreshGen = useRef(0);

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
  const [wide, setWide] = useState(() => window.matchMedia("(orientation: landscape)").matches);
  const [orient, setOrient] = useState<Orient>(() => {
    const saved = readOrient(eventId);
    if (saved === "portrait" && portrait) return "portrait";
    if (saved === "landscape" && landscape) return "landscape";
    return landscape ? "landscape" : "portrait";
  });
  const [sentJobs, setSentJobs] = useState<PrintJob[] | null>(null);
  const [serverJobs, setServerJobs] = useState(jobs);
  modeRef.current = mode;
  isFrontRef.current = isFront;
  camFailedRef.current = camFailed;
  refreshRef.current = onRefreshJobs;
  const left = countMagnetsLeft(quota, serverJobs);

  const both = Boolean(landscape && portrait);
  const active = (orient === "portrait" ? portrait : landscape) ?? landscape ?? portrait;
  const filterOn = VINTAGE_FILTER_ENABLED && vintage;

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

  function choose(next: Orient) {
    if (next === "landscape" && !landscape) return;
    if (next === "portrait" && !portrait) return;
    setOrient(next);
    try {
      localStorage.setItem(orientKey(eventId), next);
    } catch {
      /* private mode still switches for this visit */
    }
  }

  useEffect(
    () => () => {
      timeoutsRef.current.forEach(clearTimeout);
      if (photoUrlRef.current) URL.revokeObjectURL(photoUrlRef.current);
    },
    [],
  );

  useEffect(() => {
    setServerJobs(jobs);
  }, [jobs]);

  useEffect(() => {
    const query = window.matchMedia("(orientation: landscape)");
    const onChange = () => setWide(query.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    if (mode !== "camera" || camFailed) return undefined;
    if (facingSeen.current !== isFront) {
      facingSeen.current = isFront;
      stopTracks();
    }
    void ensureRef.current();
    void pullJobs();
    const onBack = () => {
      if (document.visibilityState === "hidden") return;
      if (modeRef.current !== "camera") return;
      void ensureRef.current();
      void pullJobs();
    };
    document.addEventListener("visibilitychange", onBack);
    window.addEventListener("pageshow", onBack);
    window.addEventListener("focus", onBack);
    return () => {
      document.removeEventListener("visibilitychange", onBack);
      window.removeEventListener("pageshow", onBack);
      window.removeEventListener("focus", onBack);
    };
    // ensureRef and pullJobs read refs. Facing changes stop the old tracks first.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isFront, mode, camFailed]);

  useEffect(
    () => () => {
      startIdRef.current += 1;
      stopTracks();
    },
    [],
  );

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  function stopTracks() {
    startIdRef.current += 1;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    videoTrackRef.current = null;
  }

  async function attach(video: HTMLVideoElement, stream: MediaStream) {
    video.autoplay = true;
    video.muted = true;
    video.defaultMuted = true;
    video.playsInline = true;
    video.setAttribute("playsinline", "true");
    video.setAttribute("webkit-playsinline", "true");
    if (video.srcObject !== stream) video.srcObject = stream;
    try {
      await video.play();
    } catch {
      /* a later visibility check plays again */
    }
  }

  function tracksAreLive(stream: MediaStream | null): stream is MediaStream {
    const tracks = stream?.getVideoTracks() ?? [];
    return tracks.length > 0 && tracks.every((track) => track.readyState === "live");
  }

  async function openFacing(front: boolean) {
    const facingMode = front ? "user" : "environment";
    try {
      return await navigator.mediaDevices.getUserMedia({
        video: { facingMode, width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false,
      });
    } catch (error) {
      const name = error instanceof DOMException ? error.name : "";
      if (name === "OverconstrainedError") {
        return navigator.mediaDevices.getUserMedia({ video: { facingMode }, audio: false });
      }
      throw error;
    }
  }

  async function stepLive() {
    if (modeRef.current !== "camera" || camFailedRef.current) return;
    const video = videoRef.current;
    if (!video) return;

    const existing = streamRef.current;
    if (tracksAreLive(existing)) {
      videoTrackRef.current = existing.getVideoTracks()[0] ?? null;
      await attach(video, existing);
      setLoading(false);
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      setCamFailed(true);
      setLoading(false);
      return;
    }

    const id = ++startIdRef.current;
    const facing = isFrontRef.current;
    existing?.getTracks().forEach((track) => track.stop());
    if (streamRef.current === existing) {
      streamRef.current = null;
      videoTrackRef.current = null;
    }
    setLoading(true);
    setCamError(null);
    try {
      let stream: MediaStream;
      try {
        stream = await openFacing(facing);
      } catch (error) {
        const name = error instanceof DOMException ? error.name : "";
        if (id !== startIdRef.current) return;
        if (name === "NotAllowedError" && inAppBrowser(navigator.userAgent)) {
          setCamFailed(true);
          setLoading(false);
          return;
        }
        if (name === "NotAllowedError" || name === "NotFoundError" || name === "NotReadableError") throw error;
        setCamFailed(true);
        setLoading(false);
        return;
      }
      if (id !== startIdRef.current || modeRef.current !== "camera" || isFrontRef.current !== facing) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      streamRef.current = stream;
      videoTrackRef.current = stream.getVideoTracks()[0] ?? null;
      const node = videoRef.current;
      if (node) await attach(node, stream);
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

  function ensureLiveView() {
    return enqueueCamera(() => stepLive());
  }
  ensureRef.current = ensureLiveView;

  const bindVideo = useCallback((node: HTMLVideoElement | null) => {
    videoRef.current = node;
    if (node && modeRef.current === "camera" && !camFailedRef.current) void ensureRef.current();
  }, []);

  async function pullJobs() {
    const gen = ++refreshGen.current;
    try {
      const next = await refreshRef.current();
      if (gen === refreshGen.current) setServerJobs(next);
    } catch {
      /* the pill keeps the last successful count */
    }
  }

  function retryCamera() {
    setCamError(null);
    stopTracks();
    void ensureRef.current();
  }

  async function toggleFlash() {
    const next = flash === "off" ? "on" : "off";
    setFlash(next);
    const track = videoTrackRef.current;
    const torch = trackTorch(track);
    if (torch) {
      await track
        ?.applyConstraints({ advanced: [{ torch: next === "on" }] } as unknown as MediaTrackConstraints)
        .catch(() => undefined);
    }
  }

  async function finishPhoto(source: HTMLCanvasElement, choice: CameraChoice) {
    const windowFrame: WindowFrame = {
      widthMm: choice.frame.widthMm,
      heightMm: choice.frame.heightMm,
      windowW: choice.frame.windowW,
      windowH: choice.frame.windowH,
    };
    const cropped = cropCanvasToWindow(source, source.width, source.height, windowFrame);
    const blob = await canvasToJpeg(cropped);
    rememberPhoto(URL.createObjectURL(blob), blob);
    setMode("review");
  }

  async function handleCapture() {
    const video = videoRef.current;
    const choice = active;
    if (!video || !choice || loading || capturingRef.current) return;
    if (left <= 0) {
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
      if (filterOn && typeof ctx.filter !== "undefined") ctx.filter = VINTAGE_FILTER;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      ctx.restore();
      if (filterOn && typeof ctx.filter === "undefined") applyVintagePixels(ctx, canvas.width, canvas.height);
      await finishPhoto(canvas, choice);
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
    const choice = active;
    if (!file || !choice) return;
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
    await finishPhoto(canvas, choice);
  }

  const inset = wide
    ? { top: 12, bottom: 12, right: 76, left: 132 }
    : { top: 88, bottom: 148, right: 16, left: 16 };
  const disabled = loading || left <= 0;
  const fileInput = (
    <input ref={fileInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFile} />
  );

  if (!active) return null;

  if (camFailed) {
    return (
      <div className="cam-root" dir="rtl">
        {fileInput}
        <button type="button" onClick={onClose} aria-label="סגור" className="cam-glass cam-close">
          <X className="h-4 w-4" />
        </button>
        <div className="cam-sheet">
          <CameraOff className="h-10 w-10 text-ink" />
          <h1 className="font-display text-3xl text-ink">נפתח בתוך אפליקציה</h1>
          <p className="max-w-[260px] text-base leading-relaxed text-ink">
            הדפדפן הפנימי לא פותח את המצלמה. אפשר לצלם מהגלריה, או לפתוח ב-Safari או ב-Chrome.
          </p>
          <button type="button" className="cam-send max-w-xs" onClick={() => fileInputRef.current?.click()}>
            <Upload className="h-5 w-5" />
            בחרו תמונה
          </button>
        </div>
      </div>
    );
  }

  const showLive = mode === "camera";

  return (
    <>
    <div
      className="cam-root"
      dir="rtl"
      data-orient={orient}
      aria-hidden={showLive ? undefined : true}
      role={showLive ? "dialog" : undefined}
      aria-modal={showLive ? true : undefined}
      aria-label={showLive ? "מצלמה לאירוע" : undefined}
      style={showLive ? undefined : { visibility: "hidden" }}
    >
      {fileInput}
      <canvas ref={canvasRef} className="hidden" />
      <div className={`pointer-events-none absolute inset-0 z-[115] bg-black transition-opacity duration-75 ${blackFx ? "opacity-100" : "opacity-0"}`} />
      <div className={`pointer-events-none absolute inset-0 z-[110] bg-white transition-opacity duration-150 ${shutterFx ? "opacity-80" : "opacity-0"}`} />
      <div
        className={`pointer-events-none absolute inset-0 z-[101] bg-[#FFF5EC] ${frontFlash ? "opacity-100" : "opacity-0"}`}
        style={{ transitionDuration: frontFlash ? "50ms" : "200ms" }}
      />
      {camError ? (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-paper p-8 text-center" role="alert">
          <CameraOff className="mb-3 h-10 w-10 text-primary" />
          <p className="mb-5 text-base text-ink">{camError}</p>
          <div className="flex flex-col gap-3">
            <button type="button" className="cam-send" onClick={retryCamera}>
              נסו שוב
            </button>
            {allowPicker ? (
              <button type="button" className="cam-send" onClick={() => fileInputRef.current?.click()}>
                בחרו תמונה
              </button>
            ) : null}
            <button type="button" className="cam-text" onClick={onClose}>
              חזרה
            </button>
          </div>
        </div>
      ) : (
        <FrameViewfinder
          frame={active.frame}
          overlayUrl={active.overlayUrl}
          inset={inset}
          videoRef={bindVideo}
          isFront={isFront}
          filter={filterOn ? VINTAGE_FILTER : "none"}
          loading={loading}
        />
      )}
      <div className={`cam-top ${wide ? "is-wide" : ""}`}>
        <button type="button" onClick={onClose} aria-label="סגור מצלמה" className="cam-glass">
          <X className="h-4 w-4" />
        </button>
        {both ? (
          <div className="cam-orient" role="group" aria-label="כיוון המסגרת">
            <button type="button" aria-pressed={orient === "landscape"} onClick={() => choose("landscape")}>
              לרוחב
            </button>
            <button type="button" aria-pressed={orient === "portrait"} onClick={() => choose("portrait")}>
              לאורך
            </button>
          </div>
        ) : (
          <span />
        )}
        <p className="cam-quota">{left <= 0 ? "המכסה הסתיימה" : `${left} נותרו`}</p>
      </div>
      {!camError ? (
        <div className={wide ? "cam-controls is-wide" : "cam-controls"}>
          <div className="flex items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => void toggleFlash()}
              aria-label={flash === "on" ? "כבו פלאש" : "הפעילו פלאש"}
              aria-pressed={flash === "on"}
              className="cam-glass"
            >
              {flash === "on" ? <Zap className="h-5 w-5" /> : <ZapOff className="h-5 w-5" />}
            </button>
            {VINTAGE_FILTER_ENABLED ? (
              <button
                type="button"
                onClick={() => setVintage((value) => !value)}
                aria-label={vintage ? "בטלו פילטר וינטאג׳" : "הפעילו פילטר וינטאג׳"}
                aria-pressed={vintage}
                className="cam-glass"
              >
                <Film className="h-5 w-5" />
              </button>
            ) : null}
          </div>
          <button
            type="button"
            onClick={() => void handleCapture()}
            aria-label="צלמו תמונה"
            aria-disabled={disabled}
            className={`cam-shutter ${disabled ? "opacity-25" : ""}`}
          >
            <span className={loading ? "is-loading" : ""} />
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
    {mode === "review" && photoUrl && photoBlob ? (
      <MagnetReview
        photoUrl={photoUrl}
        blob={photoBlob}
        eventId={eventId}
        guestId={guestId}
        frameId={active.id}
        frame={active.frame}
        overlayUrl={active.overlayUrl}
        onRetake={handleRetake}
        onSent={async () => {
          const next = await onPrinted();
          refreshGen.current += 1;
          setServerJobs(next);
          setSentJobs(next);
          setMode("sent");
        }}
      />
    ) : null}
    {mode === "sent" && photoUrl ? (
      <PrintStatus
        jobs={sentJobs ?? jobs}
        quota={quota}
        photoUrl={photoUrl}
        frame={active.frame}
        overlayUrl={active.overlayUrl}
        onAgain={handleRetake}
        onClose={onClose}
      />
    ) : null}
    </>
  );
}
