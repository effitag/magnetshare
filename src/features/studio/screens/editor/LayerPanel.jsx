// Layer list, top layer first. Drag rows to reorder; the background always stays at the bottom.
import { useState } from 'react';
import { IconButton } from '@/features/studio/ui/Button';
import Icon from '@/features/studio/ui/icons';
import { textPreview } from '@/features/studio/model/text';
import { useDoc, useEditor } from '@/features/studio/store/editorStore';

function typeIcon(el) {
  if (el.type === 'photo') return 'camera';
  if (el.type === 'icon') return 'heart';
  if (el.type === 'text') return 'text';
  if (el.type === 'image' || el.type === 'background') return 'image';
  if (el.shape === 'ellipse') return 'ellipse';
  return el.height < 2 ? 'line' : 'rect';
}

function layerLabel(el) {
  return el.type === 'text' ? textPreview(el.text, 'טקסט') : el.name;
}

export default function LayerPanel() {
  const doc = useDoc();
  const selectedId = useEditor((s) => s.selectedId);
  const { select, updateElement, reorderElement } = useEditor.getState();
  const [drag, setDrag] = useState(null); // { id, over } — over: insert before this display row
  const rows = [...doc.elements].reverse();
  const count = rows.length;

  function onDragOver(e, index) {
    if (!drag) return;
    e.preventDefault();
    const rect = e.currentTarget.getBoundingClientRect();
    // Never below the background, which is the last row.
    const over = Math.min(e.clientY < rect.top + rect.height / 2 ? index : index + 1, count - 1);
    if (over !== drag.over) setDrag({ ...drag, over });
  }

  function onDrop(e) {
    e.preventDefault();
    // Display row d sits above array index count - d.
    if (drag?.over != null) reorderElement(drag.id, count - drag.over);
    setDrag(null);
  }

  return (
    <aside className="flex max-h-[28vh] w-full shrink-0 flex-col border-t border-border bg-background md:h-full md:max-h-none md:w-60 md:border-s md:border-t-0 min-h-0">
      <h2 className="px-3 pt-3 pb-2 text-xs text-muted-foreground">שכבות</h2>
      <ul className="flex-1 overflow-y-auto px-1.5 pb-3" onDragLeave={(e) => !e.currentTarget.contains(e.relatedTarget) && drag && setDrag({ ...drag, over: null })}>
        {rows.map((el, i) => {
          const isBg = el.type === 'background';
          const visible = el.visible !== false;
          return (
            <li
              key={el.id}
              draggable={!isBg}
              onDragStart={(e) => {
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/plain', el.id);
                setDrag({ id: el.id, over: null });
              }}
              onDragOver={(e) => onDragOver(e, i)}
              onDrop={onDrop}
              onDragEnd={() => setDrag(null)}
              className={`relative flex items-center gap-0.5 rounded-md pe-1 ${
                el.id === selectedId ? 'bg-primary/20' : 'hover:bg-secondary'
              } ${drag?.id === el.id ? 'opacity-50' : ''}`}
            >
              {drag?.over === i && <span className="pointer-events-none absolute inset-x-1 -top-px h-0.5 rounded bg-brand" />}
              <button
                type="button"
                onClick={() => select(el.id)}
                className={`flex-1 min-w-0 flex items-center gap-2 h-9 ps-2 text-start text-sm ${visible ? 'text-foreground' : 'text-muted-foreground'} ${
                  isBg ? '' : 'cursor-grab active:cursor-grabbing'
                }`}
              >
                <Icon name={typeIcon(el)} className="size-4 shrink-0 text-muted-foreground" />
                <span className="truncate" dir="auto">
                  {layerLabel(el)}
                </span>
              </button>
              <IconButton label={visible ? 'הסתרה' : 'הצגה'} active={!visible} onClick={() => updateElement(el.id, { visible: !visible })}>
                <Icon name={visible ? 'eye' : 'eyeOff'} className="size-4" />
              </IconButton>
              {!isBg && (
                <IconButton label={el.locked ? 'ביטול נעילה' : 'נעילה'} active={el.locked} onClick={() => updateElement(el.id, { locked: !el.locked })}>
                  <Icon name={el.locked ? 'lock' : 'unlock'} className="size-4" />
                </IconButton>
              )}
            </li>
          );
        })}
      </ul>
    </aside>
  );
}
