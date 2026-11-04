import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Copy, Download, Printer } from "lucide-react";
import { Button } from "@/components/ui/Button";

type QrPanelProps = {
  url: string;
  fileName: string;
  eventId: string;
  printable?: boolean;
};

export function QrPanel({ url, fileName, eventId, printable = true }: QrPanelProps) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    import("qrcode")
      .then((mod) => mod.toDataURL(url, { width: 640, margin: 1, color: { dark: "#1C1416", light: "#FFFDFB" } }))
      .then((next) => {
        if (!cancelled) setDataUrl(next);
      })
      .catch(() => {
        if (!cancelled) setError("לא הצלחנו ליצור את הקוד. רעננו את העמוד ונסו שוב.");
      });
    return () => {
      cancelled = true;
    };
  }, [url]);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      setError("ההעתקה נכשלה. סמנו את הקישור והעתיקו אותו ידנית.");
    }
  }

  function download() {
    if (!dataUrl) return;
    const anchor = document.createElement("a");
    anchor.href = dataUrl;
    anchor.download = fileName;
    anchor.click();
  }

  return (
    <section className="rounded-2xl bg-surface p-5 shadow-card">
      <h2 className="text-xl font-semibold">קוד לשולחן</h2>
      <p className="mt-2 text-sm text-muted">הדפיסו אותו על כרטיס קטן ליד שולחן הכניסה, בגובה העיניים.</p>
      <div className="mt-4 flex justify-center">
        {dataUrl ? <img src={dataUrl} alt="קוד QR לאירוע" className="size-64 rounded-xl bg-surface" /> : null}
      </div>
      {error ? (
        <p className="mt-3 text-sm text-primary" role="alert">
          {error}
        </p>
      ) : null}
      <p className="mt-3 break-all text-sm text-muted">{url}</p>
      <div className="mt-4 flex flex-wrap gap-2 print:hidden">
        <Button onClick={download} disabled={!dataUrl}>
          <Download className="size-4" aria-hidden="true" />
          הורדת PNG
        </Button>
        <Button variant="ghost" onClick={() => void copyLink()}>
          <Copy className="size-4" aria-hidden="true" />
          {copied ? "הקישור הועתק" : "העתקת קישור"}
        </Button>
        {printable ? (
          <Link
            to={`/events/${eventId}/print`}
            className="inline-flex min-h-11 items-center gap-2 rounded-full bg-surface px-5 text-sm font-medium text-ink shadow-card"
          >
            <Printer className="size-4" aria-hidden="true" />
            תצוגת הדפסה
          </Link>
        ) : null}
      </div>
    </section>
  );
}
