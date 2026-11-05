import { createContext, useContext } from 'react';

/** { repo, templateId, assets } for the template open in the editor. */
export const EditorContext = createContext(null);

export function useEditorContext() {
  const ctx = useContext(EditorContext);
  if (!ctx) throw new Error('useEditorContext must be used inside the editor');
  return ctx;
}
