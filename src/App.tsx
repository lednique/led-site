import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { I18nProvider } from "./i18n";
import { AdminPage } from "./pages/Admin";
import { SitePage } from "./pages/Site";
import { useBrandAssets, useHydrateSite } from "./store";

export default function App() {
  useHydrateSite();
  useBrandAssets();
  return (
    <I18nProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<SitePage />} />
          <Route path="/p/:id" element={<SitePage />} />
          <Route path="/admin" element={<AdminPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </I18nProvider>
  );
}
