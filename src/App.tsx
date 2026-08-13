import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { I18nProvider } from "./i18n";
import { AdminPage } from "./pages/Admin";
import { SitePage } from "./pages/Site";
import { useBrandAssets, useHydrateSite, useThemeColor } from "./store";

export default function App() {
  useHydrateSite();
  useBrandAssets();
  useThemeColor();
  return (
    <I18nProvider>
      {/* Подложка под системным статус-баром: видна только в установленном
          PWA на iOS (там бар прозрачный и контент уходит под него).
          Цвет берётся из панели управления через переменную --status-bar. */}
      <div className="status-bar-fill" aria-hidden="true" />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<SitePage />} />
          <Route path="/p/:id" element={<SitePage />} />
          <Route path="/m/:page" element={<SitePage />} />
          <Route path="/admin" element={<AdminPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </I18nProvider>
  );
}
