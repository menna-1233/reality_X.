import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Header } from "./components/Header";
import { DashboardPage } from "./pages/DashboardPage";
import { FeedPage } from "./pages/FeedPage";
import { ReportDetailPage } from "./pages/ReportDetailPage";
import { ReportPage } from "./pages/ReportPage";

function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen">
        <Header />
        <main>
          <Routes>
            <Route path="/" element={<ReportPage />} />
            <Route path="/feed" element={<FeedPage />} />
            <Route path="/reports/:id" element={<ReportDetailPage />} />
            <Route path="/dashboard" element={<DashboardPage />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}

export default App;
