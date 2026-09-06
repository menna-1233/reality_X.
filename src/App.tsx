import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Header } from "./components/Header";
import { FeedPage } from "./pages/FeedPage";
import { ReportDetailPage } from "./pages/ReportDetailPage";
import { ReportPage } from "./pages/ReportPage";

function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-slate-50">
        <Header />
        <main>
          <Routes>
            <Route path="/" element={<ReportPage />} />
            <Route path="/feed" element={<FeedPage />} />
            <Route path="/reports/:id" element={<ReportDetailPage />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}

export default App;
