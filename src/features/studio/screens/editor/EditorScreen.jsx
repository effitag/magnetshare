// Frame editor: properties (right), canvas (centre), layers (left).
import { useEffect, useMemo, useState } from 'react';
import Button from '@/features/studio/ui/Button';
import { ConfirmDialog } from '@/features/studio/ui/Dialog';
import { notify } from '@/features/studio/ui/toast';
import { createAssetCache } from '@/features/studio/storage/assetCache';
import { isNetworkError } from '@/features/studio/storage/errors';
import { useDoc, useEditor } from '@/features/studio/store/editorStore';
import { EditorContext } from './EditorContext';
import { useEditorKeys } from './hooks';
import { useCloudSync } from './useCloudSync';
import CanvasView from './CanvasView';
import LayerPanel from './LayerPanel';
import PropertiesPanel from './PropertiesPanel';
import SyncBanner, { useOnline } from './SyncBanner';
import Toolbar from './Toolbar';

export default function EditorScreen({ repo, templateId, onClose, onOpen }) {
  const [revision, setRevision] = useState(undefined);
  const [isTemplate, setIsTemplate] = useState(true);
  // For an event frame: { eventId, eventStatus, used, sourceTemplateId } (see getFrameContext).
  const [frame, setFrame] = useState(null);
  const [copying, setCopying] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const online = useOnline();
  const assets = useMemo(() => createAssetCache((path) => repo.readAsset(templateId, path)), [repo, templateId]);
  const doc = useDoc();

  useEffect(() => {
    let alive = true;
    repo
      .load(templateId)
      .then(async (loaded) => {
        const context = loaded.isTemplate ? null : await import('@/services/api').then(({ getFrameContext }) => getFrameContext(templateId));
        if (!alive) return;
        useEditor.getState().open(loaded.doc);
        setIsTemplate(loaded.isTemplate);
        setFrame(context);
        setRevision(loaded.revision);
      })
      .catch((err) => {
        console.error('[editor] could not open template:', err);
        notify(isNetworkError(err) ? 'אין חיבור לאינטרנט, אז אי אפשר לפתוח את התבנית כרגע.' : 'לא הצלחתי לפתוח את התבנית.');
        onClose();
      });
    return () => {
      alive = false;
      useEditor.getState().close();
    };
  }, [repo, templateId, onClose]);

  // A frame that magnets were sent with never changes, and the frame guests of a live event see
  // now is not edited in front of them: both are edited as a copy, which reaches guests with
  // "שמירה לאירוע". The copy itself is not attached yet, so it opens for editing.
  const needsCopy = Boolean(frame?.eventId && (frame.used || (frame.attached && frame.eventStatus === 'live')));
  const sync = useCloudSync({ repo, templateId, revision: needsCopy ? undefined : revision, assets });
  useEditorKeys({ onSaveNow: sync.flush });

  // Leaving saves first; if something can't be saved (no connection, conflict), ask before dropping it.
  const leave = () => onClose(frame?.eventId ?? null);

  async function close() {
    if (await sync.flush()) leave();
    else setConfirmLeave(true);
  }

  async function editCopy() {
    setCopying(true);
    try {
      const { copyForEvent } = await import('@/features/admin/events/eventFrames');
      const copy = await copyForEvent(doc, { eventId: frame.eventId, sourceTemplateId: frame.sourceTemplateId, readFrom: templateId });
      onOpen(copy.id);
    } catch (err) {
      console.error('[editor] copy failed:', err);
      notify('לא הצלחנו ליצור עותק. נסו שוב.');
      setCopying(false);
    }
  }

  const context = useMemo(
    () => ({ repo, templateId, assets, isTemplate, eventId: frame?.eventId ?? null, flush: sync.flush }),
    [repo, templateId, assets, isTemplate, frame, sync.flush],
  );

  if (revision === undefined || !doc) {
    return <main className="min-h-screen grid place-items-center text-sm text-muted-foreground">פותח את התבנית…</main>;
  }

  if (needsCopy) {
    return (
      <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center gap-4 px-4 text-ink">
        <h1 className="text-xl font-semibold">{doc.name}</h1>
        <p className="text-base">
          {frame.used
            ? 'עם המסגרת הזו כבר נשלחו מגנטים, ולכן היא לא משתנה: כל מגנט מודפס במסגרת שבה צולם.'
            : 'זו המסגרת של אירוע חי, ואורחים מצלמים בה עכשיו.'}{' '}
          כדי לערוך, ניצור עותק שלה. העותק יגיע לאורחים רק אחרי "שמירה לאירוע".
        </p>
        <div className="flex flex-wrap gap-2">
          <Button variant="primary" onClick={editCopy} disabled={copying}>
            {copying ? 'יוצרים עותק…' : 'יצירת עותק לעריכה'}
          </Button>
          <Button onClick={leave}>חזרה לאירוע</Button>
        </div>
      </main>
    );
  }

  return (
    <EditorContext.Provider value={context}>
      <div className="flex h-dvh min-h-0 flex-col">
        <Toolbar status={sync.status} onClose={close} />
        <SyncBanner status={sync.status} online={online} onReload={sync.reloadLatest} onKeepMine={sync.keepMine} />
        <div className="flex min-h-0 flex-1 flex-col md:flex-row">
          <PropertiesPanel />
          <CanvasView />
          <LayerPanel />
        </div>
      </div>
      {confirmLeave && (
        <ConfirmDialog
          title="השינויים האחרונים לא נשמרו"
          message={
            {
              conflict: 'התבנית נשמרה בינתיים במקום אחר, והשינויים שלך מכאן עוד לא נשמרו. אם תצא עכשיו, הם יאבדו.',
              error: 'השמירה נכשלה, אז השינויים האחרונים עוד לא נשמרו. אם תצא עכשיו, הם יאבדו.',
            }[sync.status] ?? 'אין חיבור לאינטרנט, אז השינויים האחרונים עוד לא נשמרו. אם תצא עכשיו, הם יאבדו.'
          }
          confirmLabel="לצאת בלי לשמור"
          onConfirm={leave}
          onClose={() => setConfirmLeave(false)}
        />
      )}
    </EditorContext.Provider>
  );
}
