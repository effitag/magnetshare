import { lazy, Suspense } from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { AuthProvider } from "@/context/AuthContext";
import { EventsPanel } from "@/features/admin/EventsPanel";
import { AdminEmpty, AdminGate } from "@/features/admin/AdminScreens";
import { HomePage } from "@/features/home/HomePage";
import { LegalPage } from "@/features/home/LegalPage";
import { NotFoundPage } from "@/features/home/NotFoundPage";
import { LoadingScreen } from "@/components/ui/LoadingScreen";

const DevOnlyPreviewBridge = import.meta.env.DEV
  ? lazy(() =>
      import("@/components/PreviewBridge").then((module) => ({
        default: module.PreviewBridge,
      })),
    )
  : null;

const FramesTab = lazy(() => import("@/features/studio/FramesTab"));

export function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        {DevOnlyPreviewBridge ? (
          <Suspense fallback={null}>
            <DevOnlyPreviewBridge />
          </Suspense>
        ) : null}
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/privacy" element={<LegalPage kind="privacy" />} />
          <Route path="/terms" element={<LegalPage kind="terms" />} />
          <Route path="/accessibility" element={<LegalPage kind="accessibility" />} />
          <Route path="/admin" element={<AdminGate />}>
            <Route index element={<EventsPanel />} />
            <Route path="queue" element={<AdminEmpty title="תור הדפסה" />} />
            <Route
              path="frames/*"
              element={
                <Suspense fallback={<LoadingScreen />}>
                  <FramesTab />
                </Suspense>
              }
            />
            <Route path="leads" element={<AdminEmpty title="פניות" />} />
          </Route>
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
