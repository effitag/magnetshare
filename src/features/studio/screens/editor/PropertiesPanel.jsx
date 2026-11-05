import Button from '@/features/studio/ui/Button';
import Icon from '@/features/studio/ui/icons';
import { useDoc, useEditor, useSelected } from '@/features/studio/store/editorStore';
import { GeometryProps, ShapeProps, TextProps } from './props/ElementProps';
import { BackgroundProps, TemplateInfo } from './props/FrameProps';
import IconProps from './props/IconProps';
import PhotoProps from './props/PhotoProps';

const TITLES = { photo: 'אזור תמונה', text: 'טקסט', image: 'תמונה', shape: 'צורה', icon: 'אייקון' };

export default function PropertiesPanel() {
  const doc = useDoc();
  const el = useSelected();

  return (
    <aside className="max-h-[42vh] w-full shrink-0 overflow-y-auto border-b border-border bg-background md:h-full md:max-h-none md:w-72 md:border-b-0 md:border-e">
      {!el && <TemplateInfo doc={doc} />}
      {el?.type === 'background' && <BackgroundProps el={el} />}
      {el && el.type !== 'background' && (
        <>
          <div className="flex items-center gap-2 px-4 pt-4">
            <h2 className="flex-1 text-sm font-semibold">{TITLES[el.type] ?? el.name}</h2>
            {el.locked && <span className="text-xs text-muted-foreground">נעול</span>}
          </div>
          {el.type === 'photo' && <PhotoProps el={el} />}
          {el.type === 'icon' && <IconProps el={el} />}
          {el.type === 'text' && <TextProps el={el} />}
          {el.type === 'shape' && <ShapeProps el={el} />}
          <GeometryProps el={el} />
          <div className="px-4 py-4">
            <Button variant="ghost" className="w-full hover:text-destructive" disabled={el.locked} onClick={() => useEditor.getState().removeElement(el.id)}>
              <Icon name="trash" />
              מחיקת האלמנט
            </Button>
          </div>
        </>
      )}
    </aside>
  );
}
