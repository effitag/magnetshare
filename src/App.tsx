import { lazy, Suspense } from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { AuthProvider } from "@/context/AuthContext";
import { HomePage } from "@/features/home/HomePage";
import { AdminEmpty, AdminGate } from "@/features/admin/AdminScreens";
import { LegalPage } from "@/features/home/LegalPage";
import { NotFoundPage } from "@/features/home/NotFoundPage";

const DevOnlyPreviewBridge = import.meta.env.DEV
  ? lazy(() =>
      import("@/components/PreviewBridge").then((module) => ({
        default: module.PreviewBridge,
      })),
    )
  : null;

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
            <Route index element={<AdminEmpty title="אירועים" />} />
            <Route path="queue" element={<AdminEmpty title="תור הדפסה" />} />
            <Route path="frames" element={<AdminEmpty title="מסגרות" />} />
            <Route path="leads" element={<AdminEmpty title="פניות" />} />
          </Route>
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
