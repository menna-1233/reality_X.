import { MotionConfig } from "motion/react";
import { BrowserRouter, Route, Routes } from "react-router-dom";
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
          <Route path="/" element={<ReportPage />} />
          <Route path="/feed" element={<FeedPage />} />
          <Route path="/reports/:id" element={<ReportDetailPage />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/findings" element={<FindingsPage />} />
        </Routes>
      </BrowserRouter>
    </MotionConfig>
  );
}

export default App;
