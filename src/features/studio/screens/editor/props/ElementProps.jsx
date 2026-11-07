// Properties for text, image and shape elements. All sizes are in mm, font size in pt.
import { useRef } from 'react';
import { ColorField, NumberField, Segmented, SelectField, TextAreaField } from '@/features/studio/ui/fields';
import Icon from '@/features/studio/ui/icons';
import { nearestWeight, getFont, WEIGHT_LABELS } from '@/features/studio/fonts/registry';
import { normalizeSymbols } from '@/features/studio/fonts/textSymbols';
import { normalizeDeg, roundMm } from '@/features/studio/model/units';
import { BINDINGS, DATE_FORMATS, DEFAULT_DATE_FORMAT, SAMPLE_DATE, formatEventDate, isBound } from '@/features/studio/model/eventBinding';
import { useEditor } from '@/features/studio/store/editorStore';
import FontPicker from '../FontPicker';
import SymbolBar from './SymbolBar';

export function Section({ title, children }) {
  return (
    <section className="flex flex-col gap-3 px-4 py-4 border-b border-border">
      {title && <h3 className="text-xs text-brand">{title}</h3>}
      {children}
    </section>
  );
}

/** Edits merge per element+field, so dragging a colour picker or typing is one undo step. */
function useUpdate(el) {
  return (patch, field) => useEditor.getState().updateElement(el.id, patch, `${el.id}:${field}`);
}

export function GeometryProps({ el }) {
  const update = useUpdate(el);
  const locked = el.locked;
  const mm = (field) => (v) => update({ [field]: roundMm(v) }, field);
  // Images keep their proportions, as with the corner handles.
  const keepRatio = (el.type === 'image' || el.type === 'icon') && el.width > 0 && el.height > 0;
  const setWidth = (v) => update(keepRatio ? { width: roundMm(v), height: roundMm((v * el.height) / el.width) } : { width: roundMm(v) }, 'width');
  const setHeight = (v) => update(keepRatio ? { height: roundMm(v), width: roundMm((v * el.width) / el.height) } : { height: roundMm(v) }, 'height');
  return (
    <Section title="מיקום וגודל">
      <div className="grid grid-cols-1 gap-3">
        <NumberField label="X (משמאל)" suffix="מ״מ" value={el.x} onCommit={mm('x')} disabled={locked} />
        <NumberField label="Y (מלמעלה)" suffix="מ״מ" value={el.y} onCommit={mm('y')} disabled={locked} />
        <NumberField label="רוחב" suffix="מ״מ" value={el.width} min={0.1} onCommit={setWidth} disabled={locked} />
        {el.type !== 'text' && <NumberField label="גובה" suffix="מ״מ" value={el.height} min={0.1} onCommit={setHeight} disabled={locked} />}
        <NumberField label="סיבוב" suffix="°" value={el.rotation ?? 0} step={1} decimals={1} onCommit={(v) => update({ rotation: normalizeDeg(v) }, 'rotation')} disabled={locked} />
        <NumberField
          label="אטימות"
          suffix="%"
          value={Math.round((el.opacity ?? 1) * 100)}
          step={5}
          min={0}
          max={100}
          decimals={0}
          onCommit={(v) => update({ opacity: v / 100 }, 'opacity')}
        />
      </div>
    </Section>
  );
}

const ALIGN_OPTIONS = [
  { value: 'right', label: 'יישור לימין', icon: <Icon name="alignRight" className="size-4" /> },
  { value: 'center', label: 'יישור למרכז', icon: <Icon name="alignCenter" className="size-4" /> },
  { value: 'left', label: 'יישור לשמאל', icon: <Icon name="alignLeft" className="size-4" /> },
];

const LINK_OPTIONS = [{ value: '', label: 'לא מקושר · טקסט חופשי' }, ...BINDINGS.map((b) => ({ value: b.id, label: b.label }))];

/** Link a text to the event's name or date, or unlink it for free text. */
function EventLinkProps({ el, update }) {
  const bind = isBound(el) ? el.bind : '';
  const setLink = (value) => {
    if (!value) return update({ bind: null }, 'bind');
    if (value === 'names') return update({ bind: 'names' }, 'bind');
    const dateFormat = el.dateFormat ?? DEFAULT_DATE_FORMAT;
    return update({ bind: 'date', dateFormat, text: formatEventDate(SAMPLE_DATE, dateFormat) }, 'bind');
  };
  const setFormat = (dateFormat) => update({ dateFormat, text: formatEventDate(SAMPLE_DATE, dateFormat) }, 'dateFormat');
  return (
    <>
      <SelectField label="קישור לאירוע" value={bind} onChange={setLink} options={LINK_OPTIONS} />
      {bind === 'date' && (
        <SelectField
          label="פורמט תאריך"
          value={el.dateFormat ?? DEFAULT_DATE_FORMAT}
          onChange={setFormat}
          options={DATE_FORMATS.map((f) => ({ value: f.id, label: f.id === 'hebrew' ? `${f.label} · ${formatEventDate(SAMPLE_DATE, 'hebrew')}` : f.label }))}
        />
      )}
      {bind && (
        <p className="text-xs text-muted-foreground">
          {bind === 'names' ? 'בכל אירוע יופיע כאן שם האירוע.' : 'בכל אירוע יופיע כאן תאריך האירוע.'} התוכן כאן הוא דוגמה. שם ארוך מוקטן כדי להיכנס בשורה אחת.
        </p>
      )}
    </>
  );
}

export function TextProps({ el }) {
  const update = useUpdate(el);
  const weights = getFont(el.font)?.weights ?? [400, 700];
  const textRef = useRef(null);
  const setText = (text) => update({ text: normalizeSymbols(text) }, 'text');
  return (
    <Section title="טקסט">
      <EventLinkProps el={el} update={update} />
      <TextAreaField label={isBound(el) ? 'תוכן לדוגמה' : 'תוכן'} value={el.text} onChange={setText} inputRef={textRef} />
      <SymbolBar textRef={textRef} value={el.text} onInsert={setText} />
      <FontPicker value={el.font} onChange={(font) => update({ font, weight: nearestWeight(font, el.weight ?? 400) }, 'font')} />
      <div className="grid grid-cols-1 gap-3">
        <SelectField
          label="משקל"
          value={String(el.weight ?? 400)}
          onChange={(w) => update({ weight: Number(w) }, 'weight')}
          options={weights.map((w) => ({ value: String(w), label: `${WEIGHT_LABELS[w] ?? w} · ${w}` }))}
        />
        <NumberField label="גודל" suffix="pt" value={el.sizePt} step={0.5} min={2} max={400} decimals={1} onCommit={(v) => update({ sizePt: v }, 'sizePt')} />
        <ColorField label="צבע" value={el.color} onChange={(color) => update({ color }, 'color')} />
        <NumberField label="מרווח שורות" value={el.lineHeight ?? 1.2} step={0.05} min={0.6} max={3} onCommit={(v) => update({ lineHeight: v }, 'lineHeight')} />
      </div>
      <Segmented label="יישור" value={el.align ?? 'center'} onChange={(align) => update({ align }, 'align')} options={ALIGN_OPTIONS} />
    </Section>
  );
}

export function ShapeProps({ el }) {
  const update = useUpdate(el);
  return (
    <Section title="צורה">
      <ColorField label="מילוי" value={el.fill} allowNone onChange={(fill) => update({ fill }, 'fill')} />
      <ColorField label="קו מתאר" value={el.stroke} allowNone onChange={(stroke) => update({ stroke }, 'stroke')} />
      <div className="grid grid-cols-1 gap-3">
        <NumberField label="עובי קו מתאר" suffix="מ״מ" value={el.strokeWidthMm ?? 0} min={0} onCommit={(v) => update({ strokeWidthMm: roundMm(v) }, 'strokeWidthMm')} />
        {el.shape === 'rect' && (
          <NumberField label="עיגול פינות" suffix="מ״מ" value={el.cornerRadiusMm ?? 0} min={0} onCommit={(v) => update({ cornerRadiusMm: roundMm(v) }, 'cornerRadiusMm')} />
        )}
        {el.stroke && (
          <NumberField label="קו מקווקו (0 = רציף)" suffix="מ״מ" value={el.dashMm ?? 0} min={0} onCommit={(v) => update({ dashMm: roundMm(v) }, 'dashMm')} />
        )}
      </div>
    </Section>
  );
}
