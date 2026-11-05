import { useRef, useState } from 'react';
import Button, { IconButton } from '@/features/studio/ui/Button';
import Icon from '@/features/studio/ui/icons';
import { notify } from '@/features/studio/ui/toast';
import { createImage, createPhotoArea, createShape, createText } from '@/features/studio/model/schema';
import { sanitizeName, splitExtension } from '@/features/studio/model/names';
import { renderPrintPng } from '@/features/studio/render/renderToCanvas';
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

  async function publishFrame() {
    if (ctx.isTemplate) {
      notify('תבנית לא מתפרסמת לאורחים. צרו ממנה מסגרת לאירוע, ואז פרסמו אותה.');
      return;
    }
    setExporting(true);
    try {
      const blob = await renderPrintPng(doc, ctx.assets);
      await ctx.repo.publish(ctx.templateId, blob);
      notify('המסגרת פורסמה. עכשיו אפשר להפעיל את האירוע.');
    } catch (err) {
      console.error('[toolbar] publish failed:', err);
      notify('לא הצלחנו לפרסם את המסגרת. נסו שוב.');
    } finally {
      setExporting(false);
    }
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
      <Button variant="primary" onClick={publishFrame} disabled={exporting}>
        פרסום
      </Button>
      <Button variant="primary" onClick={exportPng} disabled={exporting} title="קובץ PNG להדפסה: החלון של התמונה שקוף">
        <Icon name="download" />
        {exporting ? 'מייצא…' : 'ייצוא PNG'}
      </Button>
    </header>
  );
}
