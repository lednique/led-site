import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AdminPage } from "./pages/Admin";
import { SitePage } from "./pages/Site";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<SitePage />} />
        <Route path="/p/:id" element={<SitePage />} />
        <Route path="/admin" element={<AdminPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
