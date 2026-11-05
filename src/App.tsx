import { lazy, Suspense } from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { AuthProvider } from "@/context/AuthContext";
import { HomePage } from "@/features/home/HomePage";
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
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
