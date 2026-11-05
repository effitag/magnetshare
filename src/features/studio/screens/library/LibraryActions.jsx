// Library header buttons: backup, restore, import a frame picture, new template.
import { useRef } from 'react';
import Button from '@/features/studio/ui/Button';
import Icon from '@/features/studio/ui/icons';

/** Calls `onPick(file)` with the chosen file, then clears the input so the same file can be picked again. */
function useFilePicker(onPick) {
  const ref = useRef(null);
  const onChange = (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (file) onPick(file);
  };
  return { ref, open: () => ref.current.click(), onChange };
}

export default function LibraryActions({ library, onNew }) {
  const { items, busy, exportZip, importZip, importFrame } = library;
  const zip = useFilePicker(importZip);
  const frame = useFilePicker(importFrame);
  return (
    <div className="flex flex-wrap items-center gap-2">
      {busy ? (
        <span className="text-sm text-secondary-foreground" role="status">
          {busy}
        </span>
      ) : (
        <>
          <Button variant="ghost" onClick={exportZip} disabled={!items?.length} title="הורדת כל התבניות כקובץ ZIP אחד">
            גיבוי ZIP
          </Button>
          <Button variant="ghost" onClick={zip.open} title="הוספת התבניות מקובץ גיבוי, כעותקים חדשים">
            שחזור מגיבוי
          </Button>
          <Button variant="ghost" onClick={frame.open} title="תבנית חדשה מתמונת מסגרת שיש לך (PNG עם חלון שקוף)">
            ייבוא מסגרת
          </Button>
        </>
      )}
      <input ref={zip.ref} type="file" accept=".zip,application/zip" className="hidden" onChange={zip.onChange} />
      <input ref={frame.ref} type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" className="hidden" onChange={frame.onChange} />
      <Button variant="primary" onClick={onNew}>
        <Icon name="plus" />
        תבנית חדשה
      </Button>
    </div>
  );
}
