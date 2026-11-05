// Frame editor: properties (right), canvas (centre), layers (left).
import { useEffect, useMemo, useState } from 'react';
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

export default function EditorScreen({ repo, templateId, onClose }) {
  const [revision, setRevision] = useState(undefined);
  const [isTemplate, setIsTemplate] = useState(true);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const online = useOnline();
  const assets = useMemo(() => createAssetCache((path) => repo.readAsset(templateId, path)), [repo, templateId]);
  const doc = useDoc();

  useEffect(() => {
    let alive = true;
    repo
      .load(templateId)
      .then((loaded) => {
        if (!alive) return;
        useEditor.getState().open(loaded.doc);
        setIsTemplate(loaded.isTemplate);
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

  const sync = useCloudSync({ repo, templateId, revision, assets });
  useEditorKeys({ onSaveNow: sync.flush });

  // Leaving saves first; if something can't be saved (no connection, conflict), ask before dropping it.
  async function close() {
    if (await sync.flush()) onClose();
    else setConfirmLeave(true);
  }

  const context = useMemo(() => ({ repo, templateId, assets, isTemplate }), [repo, templateId, assets, isTemplate]);

  if (revision === undefined || !doc) {
    return <main className="min-h-screen grid place-items-center text-sm text-muted-foreground">פותח את התבנית…</main>;
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
          onConfirm={onClose}
          onClose={() => setConfirmLeave(false)}
        />
      )}
    </EditorContext.Provider>
  );
}
