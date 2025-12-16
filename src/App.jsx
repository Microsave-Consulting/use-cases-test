// src/App.jsx
import { BrowserRouter, Routes, Route, NavLink, useLocation } from "react-router-dom";
import MapPage from "./MapPage";
import UseCaseLibrary from "./UseCaseLibrary";
import UseCaseDetail from "./UseCaseDetail";
import "./App.css";

const basename = import.meta.env.BASE_URL; // Vite + GH Pages safe

function Shell() {
  const location = useLocation();
  const isHome = location.pathname === "/";

  return (
    <div className="app">
      <header className="app-header">
        <div className="app-container">
          <nav className="app-nav" aria-label="Primary">
            <NavLink to="/" className={({ isActive }) => "app-nav-link" + (isActive ? " is-active" : "")}>
              🏠 <span>Home</span>
            </NavLink>

            <NavLink
              to="/library"
              className={({ isActive }) => "app-nav-link" + (isActive ? " is-active" : "")}
            >
              🧩 <span>Use Case Library</span>
            </NavLink>
          </nav>
        </div>
      </header>

      {/* Home = full-bleed; others = contained */}
      <main className={"app-main " + (isHome ? "app-main-full" : "app-main-contained")}>
        <Routes>
          <Route path="/" element={<MapPage />} />
          <Route path="/library" element={<UseCaseLibrary />} />
          <Route path="/use-cases/:id" element={<UseCaseDetail />} />
        </Routes>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter basename={basename}>
      <Shell />
    </BrowserRouter>
  );
}
