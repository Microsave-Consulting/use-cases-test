// src/MapPage.jsx
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
// import UseCaseHeatmap from "./UseCaseHeatmap"; // keep only if you still use it
import UseCaseDotMap from "./UseCaseDotMap";
import UseCaseSectorPie from "./widgets/UseCaseSectorPie";
import "./MapPage.css";

const API_URL = import.meta.env.BASE_URL + "data/use_cases.json";

function splitValues(value) {
  if (!value) return [];
  return String(value)
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
}

export default function MapPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

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

  const stats = useMemo(() => {
    const sectorSet = new Set();
    const countrySet = new Set();

    for (const it of items) {
      const sectorsRaw = it?.Sectors ?? it?.sectors ?? it?.Sector ?? it?.sector;
      const sectors = Array.isArray(sectorsRaw) ? sectorsRaw : splitValues(sectorsRaw);
      sectors
        .map((s) => String(s).trim())
        .filter(Boolean)
        .forEach((s) => sectorSet.add(s));

      const countryRaw =
        it?.countries ??
        it?.Countries ??
        it?.country ??
        it?.Country ??
        it?.country_covered ??
        it?.countryCovered ??
        it?.country_name;

      const countries = Array.isArray(countryRaw) ? countryRaw : splitValues(countryRaw);
      countries
        .map((c) => String(c).trim())
        .filter(Boolean)
        .forEach((c) => countrySet.add(c));
    }

    return { sectors: sectorSet.size, useCases: items.length, countries: countrySet.size };
  }, [items]);

  const topSectors = useMemo(() => {
    const counts = new Map();

    for (const it of items) {
      const sectorsRaw = it?.Sectors ?? it?.sectors ?? it?.Sector ?? it?.sector;
      const sectors = Array.isArray(sectorsRaw) ? sectorsRaw : splitValues(sectorsRaw);

      // Count each sector once per use case
      const unique = new Set(sectors.map((s) => String(s).trim()).filter(Boolean));
      for (const s of unique) counts.set(s, (counts.get(s) || 0) + 1);
    }

    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([name, useCases]) => ({ name, useCases }));
  }, [items]);

  function goToSector(sectorName) {
    const q = new URLSearchParams();
    q.set("sector", sectorName);
    navigate(`/library?${q.toString()}`);
  }

  if (loading) return <div className="map-page-status">Loading…</div>;
  if (error) return <div className="map-page-status">Error: {error}</div>;

  return (
    <div className="map-page">
      {/* Page header */}
      <section className="map-page-header">
        <h1 className="map-page-title">Global Use Case Library</h1>
        <p className="map-page-subtitle" lang="en">
          Explore a vast collection of Digital ID breakthroughs, sectoral data insights, and
          successful hackathon projects sourced from leading tech ecosystems around the world.
        </p>
      </section>

      {/* Top map stays full-width */}
      <section className="map-section">
        <UseCaseDotMap items={items} />
        {/* If you ever want to switch back:
            <UseCaseHeatmap items={items} />
        */}
      </section>

      {/* Stats ribbon */}
      <section className="map-ribbon" aria-label="Summary statistics">
        <div className="map-ribbon-inner">
          <span>
            <strong>Number of sectors:</strong> {stats.sectors}
          </span>
          <span className="map-ribbon-sep">•</span>
          <span>
            <strong>Total number of use cases:</strong> {stats.useCases}
          </span>
          <span className="map-ribbon-sep">•</span>
          <span>
            <strong>Countries covered:</strong> {stats.countries}
          </span>
        </div>
      </section>

      {/* Row 1 (2 columns) + Top Sectors */}
      <section className="map-grid-3x2">
        {/* Col 1: Intro */}
        <div className="map-cell">
          <div className="map-intro">
            <h1 className="map-intro-title">
              Explore Sectoral Digital ID Use Cases across Countries of the World
            </h1>

            <p className="map-intro-body" lang="en">
              This section directs you to a centralized repository of extensive use cases, providing
              an opportunity to explore and learn about various active and planned use cases built
              on national digital identity systems. This digital library documents and curates
              digital ID applications across geographies and sectors. Its objectives are to provide
              a reliable global public good that expands knowledge of digital ID applications,
              foster evidence-based decision-making, facilitate cross-regional knowledge exchange,
              and scale the adoption of practical digital ID innovations worldwide by systematically
              capturing learnings from hackathons and broader ecosystem initiatives.
            </p>
          </div>
        </div>

        {/* Col 2: Pie chart */}
        <div className="map-cell">
          <UseCaseSectorPie items={items} />
        </div>

        {/* Full-width: Top sectors cards */}
        <div className="map-cell map-top-sectors">
          <div className="map-top-sectors-head">
            <h2 className="map-top-sectors-title">Top Sectors</h2>
          </div>

          <div className="map-top-sectors-grid">
            {topSectors.map((s) => (
              <button
                key={s.name}
                type="button"
                className="sector-card sector-card-button"
                onClick={() => goToSector(s.name)}
                aria-label={`View use cases in ${s.name}`}
              >
                <div className="sector-card-title">{s.name}</div>
                <div className="sector-card-media" aria-hidden="true" />
                <div className="sector-card-meta">
                  <span className="sector-card-meta-label">Use cases:</span>{" "}
                  <span className="sector-card-meta-value">{s.useCases}</span>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Full-width: Explore Hackathons section (below cards) */}
        <div className="map-cell map-hackathons">
          <h2 className="map-hackathons-title">Explore Hackathons</h2>
          <p className="map-hackathons-body" lang="en">
            At the Centre for Responsible Technology team at MSC (MicroSave Consulting), we’re
            passionate about harnessing the power of hackathons to innovate in Digital Public
            Infrastructure (DPI), especially in digital ID. These exciting events are fantastic
            platforms for innovators, students, and key stakeholders to collaborate and create
            meaningful digital ID use cases that truly make a difference, all while strengthening
            local capacities in Low- and Middle-Income Countries (LMICs). We’re eager to explore
            new possibilities beyond the usual sectors like banking and government services,
            bringing together governments, academia, civil society, and the private sector. In this
            section, you’ll find a range of ongoing, completed, and upcoming hackathons. We warmly
            invite you to engage and take part in events that resonate with you, as together we can
            propel growth in your country and elevate the entire Global South!
          </p>
        </div>
      </section>
    </div>
  );
}
