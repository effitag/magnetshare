import { BrowserRouter, Route, Routes } from "react-router-dom";
import { PreviewBridge } from "@/components/PreviewBridge";
import { AuthProvider } from "@/context/AuthContext";
import { HomePage } from "@/features/home/HomePage";
import { NotFoundPage } from "@/features/home/NotFoundPage";

export function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <PreviewBridge />
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
