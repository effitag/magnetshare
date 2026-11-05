// Colour of a single-colour icon: quick swatches (black, red, soft red, dark red…) or any colour.
import { ColorField } from '@/features/studio/ui/fields';
import { useEditor } from '@/features/studio/store/editorStore';
import { ColorSwatches } from '../IconPicker';
import { Section } from './ElementProps';

export default function IconProps({ el }) {
  const setColor = (color) => useEditor.getState().updateElement(el.id, { color }, `${el.id}:color`);
  return (
    <Section title="צבע">
      <ColorSwatches value={el.color} onChange={setColor} />
      <ColorField label="צבע אחר" value={el.color} onChange={setColor} />
    </Section>
  );
}
