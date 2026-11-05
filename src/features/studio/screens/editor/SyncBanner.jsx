// Strip under the toolbar when saving needs attention: no connection, failing saves, or a conflict.
import { useEffect, useState } from 'react';
import Button from '@/features/studio/ui/Button';
import { notify } from '@/features/studio/ui/toast';
import { isNetworkError } from '@/features/studio/storage/errors';

export function useOnline() {
  const [online, setOnline] = useState(() => navigator.onLine);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);
  return online;
}

function Bar({ tone, children }) {
  const tones = {
    warn: 'border-status-pending/40 bg-status-pending/10',
    danger: 'border-destructive/50 bg-destructive/10',
  };
  return (
    <div role="status" className={`shrink-0 flex flex-wrap items-center gap-x-4 gap-y-2 border-b px-4 py-2 text-sm text-foreground ${tones[tone]}`}>
      {children}
    </div>
  );
}

export default function SyncBanner({ status, online, onReload, onKeepMine }) {
  const [busy, setBusy] = useState(false);

  async function choose(action) {
    setBusy(true);
    try {
      await action();
    } catch (err) {
      console.error('[sync] resolving the conflict failed:', err);
      notify(isNetworkError(err) ? 'אין חיבור לאינטרנט. נסה שוב כשהחיבור יחזור.' : 'הפעולה נכשלה. נסה שוב.');
    } finally {
      setBusy(false);
    }
  }

  if (status === 'conflict') {
    return (
      <Bar tone="danger">
        <p className="flex-1 min-w-60">התבנית נשמרה בינתיים בלשונית או במחשב אחר. איזו גרסה לשמור?</p>
        <Button disabled={busy} onClick={() => choose(onReload)}>
          הגרסה מהענן
        </Button>
        <Button variant="primary" disabled={busy} onClick={() => choose(onKeepMine)}>
          הגרסה שלי
        </Button>
      </Bar>
    );
  }
  if (!online || status === 'offline') {
    return (
      <Bar tone="warn">
        <p>
          <strong className="font-semibold">אין חיבור לאינטרנט.</strong> אפשר להמשיך לעבוד. השינויים עוד לא נשמרו, והם יישמרו לבד כשהחיבור יחזור.
        </p>
      </Bar>
    );
  }
  if (status === 'error') {
    return (
      <Bar tone="danger">
        <p>השמירה נכשלה. השינויים עוד לא נשמרו, ואני מנסה שוב אוטומטית.</p>
      </Bar>
    );
  }
  return null;
}
