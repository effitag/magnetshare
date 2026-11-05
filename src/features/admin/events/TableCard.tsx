import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { guestEventUrl } from "./slug";

type Props = { title: string; slug: string };

export function TableCard({ title, slug }: Props) {
  const url = guestEventUrl(slug);
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    QRCode.toDataURL(url, { margin: 1, width: 800, color: { dark: "#1C1416", light: "#FFFFFF" } }).then((data) => {
      if (!cancelled) setSrc(data);
    });
    return () => {
      cancelled = true;
    };
  }, [url]);

  return (
    <article className="table-card mx-auto flex w-full max-w-[105mm] flex-col items-center bg-sticker px-4 py-6 text-center text-ink">
      {src ? <img className="w-[55mm] max-w-full" src={src} alt="" width={320} height={320} /> : null}
      <h1 className="mt-4 font-display text-3xl leading-none">{title}</h1>
      <p className="mt-3 text-base">סרקו, צלמו, וקבלו מגנט</p>
    </article>
  );
}
