// src/App.jsx
import { HashRouter, Routes, Route, NavLink, useLocation } from "react-router-dom";
import MapPage from "./MapPage";
import UseCaseLibrary from "./UseCaseLibrary";
import UseCaseDetail from "./UseCaseDetail";
import logo from "./assets/msc-logo.svg"; // ✅ added
import "./App.css";

/**
 * Shell handles layout + nav.
 * HashRouter removes GH Pages refresh issues entirely.
 */
function Shell() {
  const location = useLocation();
  const isHome = location.pathname === "/";

  return (
    <div className="app">
      <header className="app-header">
        <div className="app-container">
          <nav className="app-nav" aria-label="Primary">
            {/* LEFT: Logo */}
            <NavLink to="/" className="app-brand" aria-label="MSC Home">
              <img src={logo} alt="MSC" className="app-logo" />
            </NavLink>

            {/* CENTER: Links */}
            <div className="app-nav-center">
              <NavLink
                to="/"
                className={({ isActive }) =>
                  "app-nav-link" + (isActive ? " is-active" : "")
                }
              >
                Home
              </NavLink>

              {/* Hackathons dropdown */}
              <div className="app-nav-dropdown">
                <button
                  className="app-nav-link app-nav-dropdown-toggle"
                  aria-haspopup="true"
                  aria-expanded="false"
                  type="button"
                >
                  Hackathons
                  <span className="app-nav-caret" aria-hidden="true">
                    ▾
                  </span>
                </button>

                <div className="app-nav-dropdown-menu">
                  <a
                    href="https://www.africa.engineering.cmu.edu/research/upanzi/id-hackathon.html"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="app-nav-dropdown-item"
                  >
                    Digital ID Hackathon Africa
                  </a>

                  <a
                    href="https://digitalidinnovations.com/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="app-nav-dropdown-item"
                  >
                    PNG National Digital ID Hackathon
                  </a>
                </div>
              </div>

              <NavLink
                to="/library"
                className={({ isActive }) =>
                  "app-nav-link" + (isActive ? " is-active" : "")
                }
              >
                Use Case Library
              </NavLink>
            </div>

            {/* RIGHT: Blank space (intentionally empty) */}
            <div className="app-nav-right" aria-hidden="true" />
          </nav>
        </div>
      </header>

      {/* Home = full-bleed; others = contained */}
      <main
        className={
          "app-main " + (isHome ? "app-main-full" : "app-main-contained")
        }
      >
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
    <HashRouter>
      <Shell />
    </HashRouter>
  );
}
