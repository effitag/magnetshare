import { useEffect, useState } from "react";
import { renderEventPreview, type EventValues, type Template } from "../eventFrames";

// One render at a time keeps a phone responsive while the gallery fills in.
let queue: Promise<unknown> = Promise.resolve();
const cache = new Map<string, Promise<string>>();

function previewUrl(template: Template, event: EventValues): Promise<string> {
  const key = `${template.id}|${event.title}|${event.eventDate ?? ""}`;
  let url = cache.get(key);
  if (!url) {
    url = queue.then(() => renderEventPreview(template, event)).then((blob) => URL.createObjectURL(blob));
    queue = url.catch(() => undefined);
    cache.set(key, url);
    url.catch(() => cache.delete(key));
  }
  return url;
}

/** The template with the event's name and date, rendered once `enabled` turns true. */
export function usePreview(template: Template, event: EventValues, enabled: boolean): { url: string | null; failed: boolean } {
  const [state, setState] = useState<{ url: string | null; failed: boolean }>({ url: null, failed: false });
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    previewUrl(template, event)
      .then((url) => !cancelled && setState({ url, failed: false }))
      .catch((error) => {
        console.warn(`[frames] preview of ${template.id} failed:`, error);
        if (!cancelled) setState({ url: null, failed: true });
      });
    return () => {
      cancelled = true;
    };
  }, [template, event.title, event.eventDate, enabled]); // eslint-disable-line react-hooks/exhaustive-deps
  return state;
}
