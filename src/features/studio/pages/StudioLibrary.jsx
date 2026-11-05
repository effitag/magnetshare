import { useNavigate } from 'react-router-dom';
import DesktopOnlyNote from '@/features/studio/DesktopOnlyNote';
import { useNarrow } from '@/features/studio/useNarrow';
import '@/features/studio/fonts/studio-fonts.css';
import '@/features/studio/fonts/symbols.css';
import LibraryScreen from '@/features/studio/screens/library/LibraryScreen';
import { STUDIO_FONT, useStudioRepo } from '@/features/studio/useStudioRepo';

export default function StudioLibrary() {
  const navigate = useNavigate();
  const repo = useStudioRepo();
  const narrow = useNarrow();
  return (
    <div className={STUDIO_FONT}>
      {narrow && <DesktopOnlyNote />}
      <LibraryScreen repo={repo} onOpen={(id) => navigate(`/admin/frames/${id}`)} />
    </div>
  );
}
