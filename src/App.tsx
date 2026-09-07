import { MotionConfig } from "motion/react";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { RequireAdmin } from "./components/RequireAdmin";
import { AdminLoginPage } from "./pages/AdminLoginPage";
import { DashboardPage } from "./pages/DashboardPage";
import { FeedPage } from "./pages/FeedPage";
import { FindingsPage } from "./pages/FindingsPage";
import { ReportDetailPage } from "./pages/ReportDetailPage";
import { ReportPage } from "./pages/ReportPage";

function App() {
  return (
    <MotionConfig reducedMotion="user">
      <BrowserRouter>
        <Routes>
          {/* Public — no login needed to report or browse the feed */}
          <Route path="/" element={<ReportPage />} />
          <Route path="/feed" element={<FeedPage />} />
          <Route path="/reports/:id" element={<ReportDetailPage />} />

          {/* Admin-only */}
          <Route path="/admin/login" element={<AdminLoginPage />} />
          <Route
            path="/dashboard"
            element={
              <RequireAdmin>
                <DashboardPage />
              </RequireAdmin>
            }
          />
          <Route
            path="/findings"
            element={
              <RequireAdmin>
                <FindingsPage />
              </RequireAdmin>
            }
          />
        </Routes>
      </BrowserRouter>
    </MotionConfig>
  );
}

export default App;
