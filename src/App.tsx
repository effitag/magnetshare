import { lazy, Suspense } from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { AuthProvider } from "@/context/AuthContext";
import { EventsPanel } from "@/features/admin/EventsPanel";
import { AdminEmpty, AdminGate } from "@/features/admin/AdminScreens";
import { HomePage } from "@/features/home/HomePage";
import { LegalPage } from "@/features/home/LegalPage";
import { NotFoundPage } from "@/features/home/NotFoundPage";
import { LoadingScreen } from "@/components/ui/LoadingScreen";

const FramesTab = lazy(() => import("@/features/studio/FramesTab"));
const EventEditorPage = lazy(() =>
  import("@/features/admin/events/EventEditorPage").then((module) => ({ default: module.EventEditorPage })),
);
const TeamPanel = lazy(() => import("@/features/admin/TeamPanel").then((module) => ({ default: module.TeamPanel })));
const TableCardPage = lazy(() =>
  import("@/features/admin/events/TableCardPage").then((module) => ({ default: module.TableCardPage })),
);
const GuestPage = lazy(() => import("@/features/guest/GuestPage").then((module) => ({ default: module.GuestPage })));
const CameraPage = lazy(() =>
  import("@/features/guest/camera/CameraPage").then((module) => ({ default: module.CameraPage })),
);

export function App() {
  return (
    <AuthProvider>
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/privacy" element={<LegalPage kind="privacy" />} />
          <Route path="/terms" element={<LegalPage kind="terms" />} />
          <Route path="/accessibility" element={<LegalPage kind="accessibility" />} />
          <Route
            path="/e/:slug"
            element={
              <Suspense fallback={<LoadingScreen />}>
                <GuestPage />
              </Suspense>
            }
          />
          <Route
            path="/e/:slug/camera"
            element={
              <Suspense fallback={<LoadingScreen />}>
                <CameraPage />
              </Suspense>
            }
          />
          <Route path="/admin" element={<AdminGate />}>
            <Route index element={<EventsPanel />} />
            <Route
              path="events/new"
              element={
                <Suspense fallback={<LoadingScreen />}>
                  <EventEditorPage />
                </Suspense>
              }
            />
            <Route
              path="events/:eventId/card"
              element={
                <Suspense fallback={<LoadingScreen />}>
                  <TableCardPage />
                </Suspense>
              }
            />
            <Route
              path="events/:eventId"
              element={
                <Suspense fallback={<LoadingScreen />}>
                  <EventEditorPage />
                </Suspense>
              }
            />
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
            <Route
              path="team"
              element={
                <Suspense fallback={<LoadingScreen />}>
                  <TeamPanel />
                </Suspense>
              }
            />
          </Route>
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
