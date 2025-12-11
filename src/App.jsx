import { BrowserRouter, Routes, Route, Link } from "react-router-dom";
import SharePointTable from "./SharePointTable";
import MapPage from "./MapPage";
import UseCaseLibrary from "./UseCaseLibrary"; // ⬅️ NEW
import "./App.css";


const basename = import.meta.env.BASE_URL; // works well with Vite + GH Pages

function App() {
  return (
    <BrowserRouter basename={basename}>
      <div style={{ fontFamily: "system-ui, sans-serif" }}>
        {/* Top nav */}
        <nav
          style={{
            display: "flex",
            gap: "1rem",
            padding: "0.75rem 1rem",
            borderBottom: "1px solid #ddd",
            marginBottom: "1rem",
          }}
        >
          <Link to="/" style={{ textDecoration: "none" }}>
            📋 Use-case List
          </Link>
          <Link to="/map" style={{ textDecoration: "none" }}>
            🌍 Heatmap View
          </Link>
          <Link to="/library" style={{ textDecoration: "none" }}>
            🧩 Library View
          </Link>
        </nav>

        <Routes>
          <Route path="/" element={<SharePointTable />} />
          <Route path="/map" element={<MapPage />} />
          <Route path="/library" element={<UseCaseLibrary />} /> {/* ⬅️ NEW */}
        </Routes>
      </div>
    </BrowserRouter>
  );
}

export default App;
