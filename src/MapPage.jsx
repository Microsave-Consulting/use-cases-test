// src/MapPage.jsx
import { useEffect, useState } from "react";
import UseCaseHeatmap from "./UseCaseHeatmap";
import UseCaseSectorPie from "./widgets/UseCaseSectorPie";
import SectorMaturityHeatmap from "./widgets/SectorMaturityHeatmap";
import SectorCountryHeatmap from "./widgets/SectorCountryHeatmap";
import "./MapPage.css";

const API_URL = import.meta.env.BASE_URL + "data/use_cases.json";

export default function MapPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        const res = await fetch(API_URL);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        setItems(Array.isArray(data) ? data : []);
      } catch (err) {
        setError(err.message || "Unknown error");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) return <div className="map-page-status">Loading…</div>;
  if (error) return <div className="map-page-status">Error: {error}</div>;

  return (
    <div className="map-page">
      {/* Top map stays full-width */}
      <section className="map-section">
        <UseCaseHeatmap items={items} />
      </section>

      {/* 3x2 grid */}
      <section className="map-grid-3x2">
        {/* Row 1 */}
        <div className="map-cell map-placeholder">
          <div className="map-placeholder-text">Content goes here (1)</div>
        </div>

        <div className="map-cell">
          <SectorCountryHeatmap items={items} topNCountries={10} />
        </div>

        {/* Row 2 */}
        <div className="map-cell">
          <UseCaseSectorPie items={items} />
        </div>

        <div className="map-cell map-placeholder">
          <div className="map-placeholder-text">Content goes here (2)</div>
        </div>

        {/* Row 3 */}
        <div className="map-cell map-placeholder">
          <div className="map-placeholder-text">Content goes here (3)</div>
        </div>

        <div className="map-cell">
          <SectorMaturityHeatmap items={items} />
        </div>
      </section>
    </div>
  );
}
