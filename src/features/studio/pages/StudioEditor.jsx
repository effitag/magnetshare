import { useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import DesktopOnlyNote from '@/features/studio/DesktopOnlyNote';
import { useNarrow } from '@/features/studio/useNarrow';
import '@/features/studio/fonts/studio-fonts.css';
import '@/features/studio/fonts/symbols.css';
import EditorScreen from '@/features/studio/screens/editor/EditorScreen';
import { STUDIO_FONT, useStudioRepo } from '@/features/studio/useStudioRepo';

export default function StudioEditor() {
  const { templateId } = useParams();
  const navigate = useNavigate();
  const repo = useStudioRepo();
  const narrow = useNarrow();
  // An event frame goes back to its event; a template to the library.
  const close = useCallback((eventId) => navigate(eventId ? `/admin/events/${eventId}` : '/admin/frames'), [navigate]);
  const open = useCallback((id) => navigate(`/admin/frames/${id}`), [navigate]);

  if (narrow) {
    return (
      <div className={`bg-paper text-ink ${STUDIO_FONT}`} dir="rtl">
        <DesktopOnlyNote onBack={close} />
      </div>
    );
  }

  return (
    <div className={`bg-paper text-ink ${STUDIO_FONT}`} dir="rtl">
      <EditorScreen key={templateId} repo={repo} templateId={templateId} onClose={close} onOpen={open} />
    </div>
  );
}
