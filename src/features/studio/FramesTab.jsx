import { useEffect, useState } from 'react';
import { Route, Routes } from 'react-router-dom';
import StudioEditor from '@/features/studio/pages/StudioEditor';
import StudioLibrary from '@/features/studio/pages/StudioLibrary';
import { subscribeNotify } from '@/features/studio/ui/toast';

function ToastHost() {
  const [message, setMessage] = useState(null);
  useEffect(() => subscribeNotify(setMessage), []);
  if (!message) return null;
  return (
    <p role="status" className="fixed inset-x-4 bottom-24 z-30 rounded-2xl border-[3px] border-ink bg-sticker px-4 py-3 text-base text-ink">
      {message}
    </p>
  );
}

export default function FramesTab() {
  return (
    <div className="bg-paper text-ink" dir="rtl">
      <ToastHost />
      <Routes>
        <Route index element={<StudioLibrary />} />
        <Route path=":templateId" element={<StudioEditor />} />
      </Routes>
    </div>
  );
}
