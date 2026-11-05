import { IconButton } from '@/features/studio/ui/Button';
import Icon from '@/features/studio/ui/icons';

const dateFormat = new Intl.DateTimeFormat('he-IL', { dateStyle: 'medium', timeStyle: 'short' });

function sizeLabel({ widthMm, heightMm }) {
  return `${widthMm / 10}×${heightMm / 10}`;
}

export default function TemplateCard({ item, onOpen, onRename, onDelete, onDuplicate, onAssign, onPublish, onUnpublish, isPublished }) {
  const { name, updatedAt, size, tags, thumbnailUrl } = item;
  const edited = updatedAt ? dateFormat.format(new Date(updatedAt)) : '';
  return (
    <article className="group flex flex-col rounded-xl border border-border bg-background overflow-hidden hover:border-cool-600 transition-colors">
      <button type="button" onClick={onOpen} className="block bg-card p-4" aria-label={`פתיחת ${name}`}>
        <div className="flex h-48 items-center justify-center">
          <div
            className="max-h-full max-w-full bg-white shadow-md"
            // Inline style: the frame's own proportions (landscape, portrait or square).
            style={{ aspectRatio: `${size.widthMm} / ${size.heightMm}`, [size.widthMm >= size.heightMm ? 'width' : 'height']: '100%' }}
          >
            {thumbnailUrl && <img src={thumbnailUrl} alt="" className="size-full object-contain" />}
          </div>
        </div>
      </button>
      <div className="flex items-start gap-2 p-3">
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-semibold">{name}</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {tags?.length > 0 && <span className="text-brand">{tags.join(' · ')} · </span>}
            נערך {edited}
          </p>
        </div>
        <span className="shrink-0 rounded bg-secondary px-1.5 py-0.5 text-xs text-secondary-foreground tabular-nums" dir="ltr" title="גודל בס״מ">
          {sizeLabel(size)}
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-1 px-2 pb-2">
        <IconButton label="שינוי שם" onClick={onRename}>
          <Icon name="pencil" />
        </IconButton>
        {onDuplicate && (
          <button type="button" className="min-h-11 px-2 text-base text-ink" onClick={onDuplicate}>
            מסגרת לאירוע
          </button>
        )}
        {onAssign && (
          <button type="button" className="min-h-11 px-2 text-base text-ink" onClick={onAssign}>
            שיוך לאירוע
          </button>
        )}
        {onPublish && !isPublished && (
          <button type="button" className="min-h-11 px-2 text-base text-ink" onClick={onPublish}>
            פרסום
          </button>
        )}
        {onUnpublish && (
          <button type="button" className="min-h-11 px-2 text-base text-ink" onClick={onUnpublish}>
            ביטול פרסום
          </button>
        )}
        <IconButton label="מחיקה" onClick={onDelete} className="hover:text-destructive">
          <Icon name="trash" />
        </IconButton>
      </div>
    </article>
  );
}
