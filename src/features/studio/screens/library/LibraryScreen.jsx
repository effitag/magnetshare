// Studio home (/admin/studio): the frame templates shared by all admins.
import { useState } from 'react';
import Button from '@/features/studio/ui/Button';
import { ConfirmDialog, NameDialog } from '@/features/studio/ui/Dialog';
import EventAssignDialog from './EventAssignDialog';
import LibraryActions from './LibraryActions';
import NewTemplateDialog from './NewTemplateDialog';
import TagFilter from './TagFilter';
import TemplateCard from './TemplateCard';
import { useLibrary } from './useLibrary';

export default function LibraryScreen({ repo, onOpen }) {
  const library = useLibrary(repo, onOpen);
  const { items, loadError, refresh } = library;
  const [dialog, setDialog] = useState(null); // { kind: 'new' | 'rename' | 'delete', item? }
  const [tag, setTag] = useState(null); // show only templates with this event tag
  const close = () => setDialog(null);
  const closeIf = (ok) => ok && close();

  return (
    <div className="max-w-5xl mx-auto px-4 md:px-8 pt-6 md:pt-10 pb-16">
      <header className="mb-6">
        <h1 className="font-display text-4xl leading-none text-ink">מסגרות</h1>
        <p className="mt-3 text-base text-ink">{items ? `${items.length} תבניות` : 'הספרייה המשותפת'}</p>
        <div className="mt-4">
          <LibraryActions library={library} onNew={() => setDialog({ kind: 'new' })} />
        </div>
      </header>

      {loadError && (
        <div role="alert" className="mb-6 flex flex-wrap items-center gap-3 rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3">
          <p className="flex-1 text-sm">{loadError}</p>
          <Button onClick={refresh}>נסה שוב</Button>
        </div>
      )}
      {items === null && !loadError && <p className="text-muted-foreground text-sm">טוען…</p>}
      {items?.length === 0 && (
        <div className="rounded-xl border border-dashed border-cool-600 py-16 text-center">
          <p className="text-secondary-foreground mb-4">אין עדיין תבניות.</p>
          <Button variant="primary" onClick={() => setDialog({ kind: 'new' })}>
            יצירת התבנית הראשונה
          </Button>
        </div>
      )}
      {items?.length > 0 && <TagFilter items={items} value={tag} onChange={setTag} />}
      {items?.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {items.filter((item) => !tag || item.tags.includes(tag)).map((item) => (
            <TemplateCard
              key={item.id}
              item={item}
              onOpen={() => onOpen(item.id)}
              onRename={() => setDialog({ kind: 'rename', item })}
              onDelete={() => setDialog({ kind: 'delete', item })}
              onDuplicate={item.isTemplate ? () => setDialog({ kind: 'for-event', mode: 'copy', item }) : null}
              onAssign={item.isTemplate ? null : () => setDialog({ kind: 'for-event', mode: 'assign', item })}
              onPublish={item.isTemplate ? null : () => library.publish(item)}
              onUnpublish={item.isTemplate || !item.isPublished ? null : () => library.unpublish(item)}
              isPublished={item.isPublished}
            />
          ))}
        </div>
      )}

      {dialog?.kind === 'new' && <NewTemplateDialog onSubmit={library.create} onClose={close} />}
      {dialog?.kind === 'for-event' && (
        <EventAssignDialog
          title={dialog.mode === 'copy' ? 'מסגרת לאירוע' : 'שיוך לאירוע'}
          mode={dialog.mode}
          size={dialog.item.size}
          onClose={close}
          onSubmit={async ({ eventId, slot, both }) => {
            const ok = dialog.mode === 'copy'
              ? await library.duplicateForEvent(dialog.item, eventId, { slot, both })
              : await library.assignToEvent(dialog.item, eventId, slot);
            if (ok) close();
          }}
        />
      )}
      {dialog?.kind === 'rename' && (
        <NameDialog
          title="שינוי שם"
          initial={dialog.item.name}
          confirmLabel="שמירה"
          onSubmit={async (name) => closeIf(await library.rename(dialog.item, name))}
          onClose={close}
        />
      )}
      {dialog?.kind === 'delete' && (
        <ConfirmDialog
          title="מחיקת תבנית"
          message={`התבנית «${dialog.item.name}» והתמונות שלה יימחקו. אי אפשר לבטל את זה.`}
          confirmLabel="מחיקה"
          onConfirm={async () => closeIf(await library.remove(dialog.item))}
          onClose={close}
        />
      )}
    </div>
  );
}
