import { lazy, Suspense } from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { PreviewBridge } from "@/components/PreviewBridge";
import { LoadingScreen } from "@/components/ui/LoadingScreen";
import { AuthProvider } from "@/context/AuthContext";
import { ForgotPasswordPage } from "@/features/auth/ForgotPasswordPage";
import { LoginPage } from "@/features/auth/LoginPage";
import { RequireAuth } from "@/features/auth/RequireAuth";
import { SignupPage } from "@/features/auth/SignupPage";
import { GuestSoonPage } from "@/features/guest/GuestSoonPage";
import { HomePage } from "@/features/home/HomePage";
import { NotFoundPage } from "@/features/home/NotFoundPage";

const DashboardPage = lazy(() => import("@/features/dashboard/DashboardPage"));
const WizardPage = lazy(() => import("@/features/events/WizardPage"));
const EventManagePage = lazy(() => import("@/features/events/EventManagePage"));
const PrintQrPage = lazy(() => import("@/features/events/PrintQrPage"));

export function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <PreviewBridge />
        <Suspense fallback={<LoadingScreen />}>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/signup" element={<SignupPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route
              path="/dashboard"
              element={
                <RequireAuth>
                  <DashboardPage />
                </RequireAuth>
              }
            />
            <Route
              path="/events/new"
              element={
                <RequireAuth>
                  <WizardPage />
                </RequireAuth>
              }
            />
            <Route
              path="/events/:eventId"
              element={
                <RequireAuth>
                  <EventManagePage />
                </RequireAuth>
              }
            />
            <Route
              path="/events/:eventId/print"
              element={
                <RequireAuth>
                  <PrintQrPage />
                </RequireAuth>
              }
            />
            <Route path="/e/:slug" element={<GuestSoonPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </AuthProvider>
  );
}
