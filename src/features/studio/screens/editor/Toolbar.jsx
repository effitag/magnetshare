import { useRef, useState } from 'react';
import Button, { IconButton } from '@/features/studio/ui/Button';
import Icon from '@/features/studio/ui/icons';
import { notify } from '@/features/studio/ui/toast';
import { createImage, createPhotoArea, createShape, createText } from '@/features/studio/model/schema';
import { sanitizeName, splitExtension } from '@/features/studio/model/names';
import { renderPrintPng } from '@/features/studio/render/renderToCanvas';
import Dialog from '@/features/studio/ui/Dialog';
import { downloadBlob } from '@/features/studio/storage/backupZip';
import { useDoc, useEditor } from '@/features/studio/store/editorStore';
import { useEditorContext } from './EditorContext';
import IconPicker from './IconPicker';
import { IMAGE_ACCEPT, imageUploadMessage, importImage } from './imageImport';


const STATUS = {
  saved: { label: 'נשמר', className: 'text-muted-foreground' },
  dirty: { label: 'שומר…', className: 'text-muted-foreground' },
  saving: { label: 'שומר…', className: 'text-muted-foreground' },
  offline: { label: 'לא נשמר · אין חיבור', className: 'text-status-pending' },
  error: { label: 'לא נשמר · מנסה שוב', className: 'text-destructive' },
  conflict: { label: 'לא נשמר · נשמר במקום אחר', className: 'text-destructive' },
};

export default function Toolbar({ status, onClose }) {
  const doc = useDoc();
  const ctx = useEditorContext();
  const canUndo = useEditor((s) => (s.history?.past.length ?? 0) > 0);
  const canRedo = useEditor((s) => (s.history?.future.length ?? 0) > 0);
  const zoom = useEditor((s) => s.zoom);
  const showSample = useEditor((s) => s.showSample);
  const { undo, redo, addElement, setZoom, setShowSample } = useEditor.getState();
  const hasPhotoArea = doc.elements.some((e) => e.type === 'photo');
  const hasSample = Boolean(doc.preview?.photo);
  const fileRef = useRef(null);
  const [iconsOpen, setIconsOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const saveState = STATUS[status] ?? STATUS.saved;

  async function onImagePicked(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const { path, img } = await importImage(ctx, file);
      addElement(createImage(doc.size, path, img.naturalWidth, img.naturalHeight, splitExtension(file.name).stem));
    } catch (err) {
      console.error('[toolbar] image import failed:', err);
      notify(imageUploadMessage(err));
    }
  }

  const [ask, setAsk] = useState(null); // { live, queued } before replacing the event's current frame

  // An event frame goes to guests with "שמירה לאירוע": render, then put it into the event's slot.
  async function finishSaveForEvent(moveQueued) {
    setAsk(null);
    setExporting(true);
    try {
      const { saveForEvent } = await import('@/features/admin/events/eventFrames');
      const moved = await saveForEvent(ctx.templateId, doc, ctx.eventId, { moveQueued });
      notify(moved > 0 ? `המסגרת נשמרה לאירוע. ${moved} מגנטים שבתור עודכנו אליה.` : 'המסגרת נשמרה לאירוע ומוכנה לאורחים.', 'info');
    } catch (err) {
      console.error('[toolbar] save for event failed:', err);
      notify(err instanceof Error && err.message ? err.message : 'לא הצלחנו לשמור את המסגרת לאירוע. נסו שוב.');
    } finally {
      setExporting(false);
    }
  }

  async function saveToEvent() {
    setExporting(true);
    try {
      if (!(await ctx.flush())) {
        notify('השינויים עוד לא נשמרו. נסו שוב בעוד רגע.');
        return;
      }
      const { getSlotState } = await import('@/services/api');
      const { slotOf } = await import('@/features/admin/events/eventFrames');
      const state = await getSlotState(ctx.eventId, slotOf(doc));
      const replacing = state.frameId && state.frameId !== ctx.templateId;
      if (replacing && (state.status === 'live' || state.queued > 0)) {
        setAsk({ live: state.status === 'live', queued: state.queued });
        return;
      }
    } catch (err) {
      console.error('[toolbar] save for event failed:', err);
      notify('לא הצלחנו לבדוק את האירוע. נסו שוב.');
      return;
    } finally {
      setExporting(false);
    }
    await finishSaveForEvent(false);
  }

  async function exportPng() {
    setExporting(true);
    try {
      downloadBlob(await renderPrintPng(doc, ctx.assets), `${sanitizeName(doc.name)}.png`);
    } catch (err) {
      console.error('[toolbar] PNG export failed:', err);
      notify('הייצוא נכשל. נסה שוב.');
    } finally {
      setExporting(false);
    }
  }

  return (
    <header className="flex min-h-12 shrink-0 flex-wrap items-center gap-1 border-b border-border bg-background px-2 py-1">
      <Button variant="ghost" onClick={onClose} className="px-2">
        <Icon name="back" />
        תבניות
      </Button>
      <div className="min-w-0 flex items-baseline gap-2 ps-1">
        <h1 className="truncate text-sm font-semibold max-w-56">{doc.name}</h1>
        <span className={`text-xs whitespace-nowrap ${saveState.className}`} role="status">
          {saveState.label}
        </span>
      </div>

      <div className="flex-1 flex items-center justify-center gap-1">
        <Button
          variant="ghost"
          disabled={hasPhotoArea}
          title={hasPhotoArea ? 'בתבנית כבר יש אזור תמונה' : 'החלון שאליו נכנסת התמונה מהאירוע'}
          onClick={() => addElement(createPhotoArea(doc.size), 1)}
        >
          <Icon name="camera" />
          אזור תמונה
        </Button>
        <Button variant="ghost" onClick={() => addElement(createText(doc.size, doc.event.font))}>
          <Icon name="text" />
          טקסט
        </Button>
        <Button variant="ghost" onClick={() => fileRef.current.click()}>
          <Icon name="image" />
          תמונה
        </Button>
        <input ref={fileRef} type="file" accept={IMAGE_ACCEPT} className="hidden" onChange={onImagePicked} />
        <Button variant="ghost" onClick={() => setIconsOpen(true)}>
          <Icon name="heart" />
          אייקונים
        </Button>
        {iconsOpen && <IconPicker onClose={() => setIconsOpen(false)} />}
        <IconButton label="מלבן" onClick={() => addElement(createShape(doc.size, 'rect'))}>
          <Icon name="rect" />
        </IconButton>
        <IconButton label="אליפסה" onClick={() => addElement(createShape(doc.size, 'ellipse'))}>
          <Icon name="ellipse" />
        </IconButton>
        <IconButton label="קו" onClick={() => addElement(createShape(doc.size, 'line'))}>
          <Icon name="line" />
        </IconButton>
      </div>

      {hasSample && (
        <IconButton label={showSample ? 'הסתרת התמונה לדוגמה' : 'הצגת התמונה לדוגמה'} active={showSample} onClick={() => setShowSample(!showSample)}>
          <Icon name="eye" />
        </IconButton>
      )}
      <IconButton label="ביטול (Ctrl+Z)" onClick={undo} disabled={!canUndo}>
        <Icon name="undo" />
      </IconButton>
      <IconButton label="חזרה (Ctrl+Shift+Z)" onClick={redo} disabled={!canRedo}>
        <Icon name="redo" />
      </IconButton>
      <span className="w-px h-6 bg-muted mx-1" />
      <IconButton label="הקטנה" onClick={() => setZoom(zoom / 1.25)}>
        <Icon name="minus" />
      </IconButton>
      <span className="w-12 text-center text-xs text-secondary-foreground tabular-nums" dir="ltr">
        {Math.round(zoom * 100)}%
      </span>
      <IconButton label="הגדלה" onClick={() => setZoom(zoom * 1.25)}>
        <Icon name="plus" />
      </IconButton>
      <IconButton label="התאמה למסך" onClick={() => setZoom(1)}>
        <Icon name="fit" />
      </IconButton>
      <span className="w-px h-6 bg-muted mx-1" />
      {ctx.eventId && (
        <Button variant="primary" onClick={saveToEvent} disabled={exporting} title="המסגרת מגיעה לאורחים רק אחרי השמירה לאירוע">
          שמירה לאירוע
        </Button>
      )}
      <Button variant="primary" onClick={exportPng} disabled={exporting} title="קובץ PNG להדפסה: החלון של התמונה שקוף">
        <Icon name="download" />
        {exporting ? 'מייצא…' : 'ייצוא PNG'}
      </Button>
      {ask && (
        <Dialog title={ask.live ? 'החלפת המסגרת באירוע חי' : 'החלפת המסגרת של האירוע'} onClose={() => setAsk(null)}>
          {ask.live && <p className="mb-3 text-sm">אורחים חדשים יצלמו במסגרת הזו. מגנטים שכבר הודפסו נשארים עם המסגרת שאיתה צולמו. אורח שבאמצע צילום יתבקש לצלם שוב.</p>}
          {ask.queued > 0 && <p className="mb-3 text-sm">{ask.queued} מגנטים עוד לא הודפסו. לעדכן גם אותם למסגרת הזו?</p>}
          <div className="flex flex-wrap justify-end gap-2">
            <Button onClick={() => setAsk(null)}>ביטול</Button>
            {ask.queued > 0 ? (
              <>
                <Button onClick={() => finishSaveForEvent(false)}>רק למגנטים חדשים</Button>
                <Button variant="primary" onClick={() => finishSaveForEvent(true)}>
                  כולל {ask.queued} שבתור
                </Button>
              </>
            ) : (
              <Button variant="primary" onClick={() => finishSaveForEvent(false)}>
                שמירה לאירוע
              </Button>
            )}
          </div>
        </Dialog>
      )}
    </header>
  );
}
