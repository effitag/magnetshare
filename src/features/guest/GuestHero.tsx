import { useState } from "react";

type Props = {
  title: string;
  dateLabel?: string | null;
  coverUrl?: string | null;
  note?: string | null;
};

export function GuestHero({ title, dateLabel, coverUrl, note }: Props) {
  const [coverOk, setCoverOk] = useState(true);
  const showCover = Boolean(coverUrl) && coverOk;

  return (
    <div className={showCover ? "guest-top" : "guest-top is-plain"}>
      <div className="guest-hero">
        {showCover ? (
          <img
            className="guest-hero-media"
            src={coverUrl ?? undefined}
            alt=""
            width={800}
            height={1000}
            decoding="async"
            onError={() => setCoverOk(false)}
          />
        ) : (
          <div className="guest-fallback" />
        )}
        <div className="guest-hero-fade" />
      </div>

      {note ? <p className="guest-note">{note}</p> : null}

      <div className="guest-caption">
        <h1 className="guest-name">{title}</h1>
        {dateLabel ? <p className="guest-date">{dateLabel}</p> : null}
      </div>
    </div>
  );
}