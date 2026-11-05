// Photo area: its shape, and the sample photo used to preview the frame.
import { useRef } from 'react';
import Button from '@/features/studio/ui/Button';
import Icon from '@/features/studio/ui/icons';
import { FieldLabel, NumberField, Segmented } from '@/features/studio/ui/fields';
import { notify } from '@/features/studio/ui/toast';
import { DEFAULT_PREVIEW } from '@/features/studio/model/schema';
import { roundMm } from '@/features/studio/model/units';
import { ZOOM_MAX, ZOOM_MIN } from '@/features/studio/model/photo';
import { useDoc, useEditor } from '@/features/studio/store/editorStore';
import { useEditorContext } from '../EditorContext';
import { IMAGE_ACCEPT, imageUploadMessage, importImage } from '../imageImport';
import { Section } from './ElementProps';

const SHAPES = [
  { value: 'rect', label: 'מלבן', icon: <Icon name="rect" className="size-4" /> },
  { value: 'ellipse', label: 'עיגול', icon: <Icon name="ellipse" className="size-4" /> },
];

export default function PhotoProps({ el }) {
  const ctx = useEditorContext();
  const doc = useDoc();
  const panPhoto = useEditor((s) => s.panPhoto);
  const { setPreview, setPanPhoto, setShowSample, updateElement } = useEditor.getState();
  const preview = { ...DEFAULT_PREVIEW, ...doc.preview };
  const fileRef = useRef(null);
  const update = (patch, field) => updateElement(el.id, patch, `${el.id}:${field}`);

  async function onPicked(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const { path } = await importImage(ctx, file);
      setPreview({ photo: path, zoom: 1, focusX: 0.5, focusY: 0.5 });
      setShowSample(true);
    } catch (err) {
      console.error('[photo] sample upload failed:', err);
      notify(imageUploadMessage(err));
    }
  }

  return (
    <>
      <Section title="אזור תמונה">
        <p className="text-xs text-muted-foreground leading-relaxed">
          בקובץ להדפסה האזור הזה שקוף, והתמונה מהאירוע נכנסת לתוכו. שכבות שמעליו, כמו טקסט וקישוטים, יופיעו מעל התמונה.
        </p>
        <Segmented label="צורה" value={el.shape ?? 'rect'} options={SHAPES} onChange={(shape) => update({ shape }, 'shape')} />
        {(el.shape ?? 'rect') === 'rect' && (
          <NumberField
            label="עיגול פינות"
            suffix="מ״מ"
            value={el.cornerRadiusMm ?? 0}
            min={0}
            onCommit={(v) => update({ cornerRadiusMm: roundMm(v) }, 'cornerRadiusMm')}
          />
        )}
      </Section>

      <Section title="תמונה לדוגמה">
        {!preview.photo ? (
          <>
            <p className="text-xs text-muted-foreground leading-relaxed">תמונה מהמחשב, רק כדי לראות איך המסגרת תיראה. היא לא נכנסת לקובץ להדפסה.</p>
            <Button onClick={() => fileRef.current.click()}>
              <Icon name="image" />
              בחירת תמונה לדוגמה
            </Button>
          </>
        ) : (
          <>
            <Button
              variant={panPhoto ? 'primary' : 'secondary'}
              onClick={() => {
                setShowSample(true);
                setPanPhoto(!panPhoto);
              }}
            >
              <Icon name="move" />
              {panPhoto ? 'סיום מיקום התמונה' : 'מיקום התמונה בחלון'}
            </Button>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {panPhoto ? 'גוררים את התמונה בתוך החלון. גלגלת העכבר מגדילה ומקטינה. Esc לסיום.' : 'אפשר גם בלחיצה כפולה על התמונה.'}
            </p>
            <label className="flex flex-col gap-1">
              <FieldLabel>
                הגדלה <span className="tabular-nums">{Math.round(preview.zoom * 100)}%</span>
              </FieldLabel>
              <input
                type="range"
                min={ZOOM_MIN * 100}
                max={ZOOM_MAX * 100}
                step={5}
                value={Math.round(preview.zoom * 100)}
                onChange={(e) => setPreview({ zoom: Number(e.target.value) / 100 }, 'preview:zoom')}
                className="accent-brand"
                dir="ltr"
              />
            </label>
            <div className="flex flex-wrap gap-1">
              <Button variant="ghost" onClick={() => setPreview({ zoom: 1, focusX: 0.5, focusY: 0.5 }, 'preview:reset')}>
                איפוס
              </Button>
              <Button variant="ghost" onClick={() => fileRef.current.click()}>
                החלפה
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  setPanPhoto(false);
                  setPreview({ photo: null });
                }}
              >
                הסרה
              </Button>
            </div>
          </>
        )}
        <input ref={fileRef} type="file" accept={IMAGE_ACCEPT} className="hidden" onChange={onPicked} />
      </Section>
    </>
  );
}
