import { HashRouter, Navigate, Route, Routes } from "react-router-dom";
import { ScrollTopButton } from "./components/ScrollTopButton";
import { ActiveSessionProvider } from "./context/ActiveSessionContext";
import { GymsPage } from "./pages/GymsPage";
import { HistoryPage } from "./pages/HistoryPage";
import { HomePage } from "./pages/HomePage";
import { SessionPage } from "./pages/SessionPage";
import { SessionSummaryPage } from "./pages/SessionSummaryPage";

export default function App() {
  return (
    <ActiveSessionProvider>
      <HashRouter>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/gyms" element={<GymsPage />} />
          <Route path="/gyms/:gymId" element={<GymsPage />} />
          <Route path="/boards" element={<GymsPage />} />
          <Route path="/boards/:boardId" element={<GymsPage />} />
          <Route path="/history" element={<HistoryPage />} />
          <Route path="/session/:sessionId" element={<SessionPage />} />
          <Route path="/session/:sessionId/summary" element={<SessionSummaryPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        <ScrollTopButton />
      </HashRouter>
    </ActiveSessionProvider>
  );
}
