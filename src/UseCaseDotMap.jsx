// src/UseCaseDotMap.jsx
import { useMemo, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ComposableMap, Geographies, Geography, Marker } from "react-simple-maps";
import { geoCentroid } from "d3-geo";
import countries from "i18n-iso-countries";
import enLocale from "i18n-iso-countries/langs/en.json";
import "./UseCaseDotMap.css";

countries.registerLocale(enLocale);

const geoUrl = "https://unpkg.com/world-atlas@2.0.2/countries-110m.json";

// Dropdown sentinels
const ALL_SECTORS = "__ALL_SECTORS__";
const NO_COUNTRY = ""; // placeholder "Country"

function splitValues(value) {
  if (!value) return [];
  return String(value)
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
}

function getSectorsFromItem(it) {
  const raw = it?.Sectors ?? it?.sectors ?? it?.Sector ?? it?.sector;
  if (Array.isArray(raw)) return raw.map((s) => String(s).trim()).filter(Boolean);
  return splitValues(raw);
}

function getCountriesFromItem(it) {
  const raw =
    it?.countries ??
    it?.Countries ??
    it?.country ??
    it?.Country ??
    it?.country_covered ??
    it?.countryCovered ??
    it?.country_name;

  if (Array.isArray(raw)) return raw.map((c) => String(c).trim()).filter(Boolean);
  return splitValues(raw);
}

function flagUrlFromIso2(iso2) {
  if (!iso2) return null;
  return `https://flagcdn.com/w40/${iso2.toLowerCase()}.png`;
}

export default function UseCaseDotMap({ items }) {
  const navigate = useNavigate();

  const [selectedSector, setSelectedSector] = useState(ALL_SECTORS); // "All Sectors"
  const [selectedCountry, setSelectedCountry] = useState(NO_COUNTRY); // "Country"

  const [hoverInfo, setHoverInfo] = useState(null);
  const [tooltipPos, setTooltipPos] = useState(null);

  const MAP_W = 1000;
  const MAP_H = 450;

  const PROJECTION = "geoEquirectangular";
  const PROJ_CFG = { scale: 155, center: [0, 10] };

  const isSectorSelected = selectedSector !== ALL_SECTORS;

  const clearSelection = () => {
    setSelectedCountry(NO_COUNTRY);
    setSelectedSector(ALL_SECTORS);
    setHoverInfo(null);
    setTooltipPos(null);
  };

  const goToUseCaseLibrary = () => {
    if (!selectedCountry) return;
    const params = new URLSearchParams();
    params.set("country", selectedCountry);
    if (isSectorSelected) params.set("sector", selectedSector);
    navigate(`/library?${params.toString()}`);
  };

  // Country dropdown options (all items)
  const countryOptions = useMemo(() => {
    const set = new Set();
    (items || []).forEach((it) => getCountriesFromItem(it).forEach((c) => set.add(c)));
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [items]);

  // Items filtered by selectedCountry (used for sector narrowing + "sectors count")
  const countryFilteredItems = useMemo(() => {
    if (!items?.length) return [];
    if (!selectedCountry) return items;
    return items.filter((it) => getCountriesFromItem(it).includes(selectedCountry));
  }, [items, selectedCountry]);

  // Sector options depend on selected country
  const sectorOptions = useMemo(() => {
    const set = new Set();
    (countryFilteredItems || []).forEach((it) => getSectorsFromItem(it).forEach((s) => set.add(s)));
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [countryFilteredItems]);

  // If country changes and current sector becomes invalid, reset to All Sectors
  useEffect(() => {
    if (selectedSector === ALL_SECTORS) return;
    if (!sectorOptions.includes(selectedSector)) setSelectedSector(ALL_SECTORS);
  }, [sectorOptions, selectedSector]);

  // Apply sector filter on top of country filter
  const filteredItems = useMemo(() => {
    if (!countryFilteredItems?.length) return [];
    if (!isSectorSelected) return countryFilteredItems;
    return countryFilteredItems.filter((it) => getSectorsFromItem(it).includes(selectedSector));
  }, [countryFilteredItems, selectedSector, isSectorSelected]);

  // Build counts/labels for dots + ISO resolution by label
  const { countsByIso2, labelByIso2, iso2ByLabel } = useMemo(() => {
    const counts = {};
    const labels = {};
    const isoByLbl = {};

    (filteredItems || []).forEach((row) => {
      const names = getCountriesFromItem(row);
      names.forEach((name) => {
        const iso2 = countries.getAlpha2Code(name, "en");
        if (!iso2) return;

        const code = iso2.toUpperCase();
        counts[code] = (counts[code] || 0) + 1;

        if (!labels[code]) labels[code] = name;
        isoByLbl[labels[code]] = code;
      });
    });

    return { countsByIso2: counts, labelByIso2: labels, iso2ByLabel: isoByLbl };
  }, [filteredItems]);

  const selectedIso2 = selectedCountry ? iso2ByLabel[selectedCountry] : null;
  const isCountrySelected = Boolean(selectedCountry && selectedIso2);

  // Stats for the right card
  const selectedCountryStats = useMemo(() => {
    if (!isCountrySelected) return null;

    // Use cases shown respect current sector filter (filteredItems includes country + optional sector)
    const useCasesCount = filteredItems.length;

    // Sectors count should reflect selected country overall (countryFilteredItems),
    // but the row is hidden when a sector is selected.
    const sectorSet = new Set();
    (countryFilteredItems || []).forEach((it) =>
      getSectorsFromItem(it).forEach((s) => sectorSet.add(s))
    );

    return {
      country: selectedCountry,
      iso2: selectedIso2,
      useCases: useCasesCount,
      sectors: sectorSet.size,
    };
  }, [isCountrySelected, selectedCountry, selectedIso2, filteredItems, countryFilteredItems]);

  // Clear hover when selecting a country (dots disappear)
  useEffect(() => {
    if (isCountrySelected) {
      setHoverInfo(null);
      setTooltipPos(null);
    }
  }, [isCountrySelected]);

  const showHover = (info, evt) => {
    setHoverInfo(info);
    setTooltipPos({ x: evt.clientX, y: evt.clientY });
  };

  const hideHover = () => {
    setHoverInfo(null);
    setTooltipPos(null);
  };

  // UX polish: fade transitions + subtle glow on selected country
  const baseGeoStyle = {
    default: {
      outline: "none",
      transition: "fill 180ms ease, filter 180ms ease, opacity 180ms ease",
    },
    hover: { outline: "none" },
    pressed: { outline: "none" },
  };
  const selectedCountryGlow = "drop-shadow(0 0 6px rgba(34,197,94,0.55))";

  return (
    <div className="ucdm-wrap">
      <div className={`ucdm-layout ${isCountrySelected ? "ucdm-layout--selected" : ""}`}>
        {/* LEFT: Map card */}
        <div className="ucdm-card ucdm-card--map">
          <ComposableMap
            projection={PROJECTION}
            projectionConfig={PROJ_CFG}
            width={MAP_W}
            height={MAP_H}
            className="ucdm-map"
          >
            <Geographies geography={geoUrl}>
              {({ geographies }) => {
                // Centroids only when no country is selected (dots visible)
                const wanted = new Set(Object.keys(countsByIso2));
                const centroidsByIso2 = {};

                if (!isCountrySelected) {
                  geographies.forEach((geo) => {
                    const p = geo.properties || {};
                    const geoName = p.name || p.NAME || p.ADMIN || "Unknown";

                    let iso2 = (p.ISO_A2 || p.iso_a2 || p.ISO2 || "").toUpperCase();
                    if (!iso2 && geoName !== "Unknown") {
                      const resolved = countries.getAlpha2Code(geoName, "en");
                      if (resolved) iso2 = resolved.toUpperCase();
                    }
                    if (!iso2) return;
                    if (!wanted.has(iso2)) return;

                    const c = geoCentroid(geo);
                    if (Array.isArray(c) && !Number.isNaN(c[0]) && !Number.isNaN(c[1])) {
                      centroidsByIso2[iso2] = c;
                    }
                  });
                }

                return (
                  <>
                    {/* Base map / Selected-country highlight */}
                    {geographies.map((geo) => {
                      const p = geo.properties || {};
                      const geoName = p.name || p.NAME || p.ADMIN || "Unknown";

                      let iso2 = (p.ISO_A2 || p.iso_a2 || p.ISO2 || "").toUpperCase();
                      if (!iso2 && geoName !== "Unknown") {
                        const resolved = countries.getAlpha2Code(geoName, "en");
                        if (resolved) iso2 = resolved.toUpperCase();
                      }

                      const isSelected = selectedIso2 && iso2 && iso2 === selectedIso2;

                      return (
                        <Geography
                          key={geo.rsmKey}
                          geography={geo}
                          fill={isSelected ? "#22c55e" : "#e5e7eb"}
                          stroke={isSelected ? "rgba(255,255,255,0.95)" : "#ffffff"}
                          strokeWidth={isSelected ? 1.3 : 1}
                          style={baseGeoStyle}
                          // eslint-disable-next-line react/no-unknown-property
                          filter={isSelected ? selectedCountryGlow : "none"}
                          opacity={isCountrySelected && !isSelected ? 0.75 : 1}
                        />
                      );
                    })}

                    {/* Dots ONLY when no country is selected */}
                    {!isCountrySelected &&
                      Object.keys(countsByIso2).map((iso2) => {
                        const coords = centroidsByIso2[iso2];
                        if (!coords) return null;

                        const value = countsByIso2[iso2] || 0;
                        const label = labelByIso2[iso2] || iso2;
                        const info = { iso2, label, value };

                        return (
                          <Marker
                            key={iso2}
                            coordinates={coords}
                            onMouseEnter={(e) => showHover(info, e)}
                            onMouseMove={(e) => showHover(info, e)}
                            onMouseLeave={hideHover}
                            onClick={() => setSelectedCountry(label)}
                          >
                            <circle
                              className="ucdm-dot"
                              r={3.2}
                              fill="#22c55e"
                              stroke="#ffffff"
                              strokeWidth={1}
                            />
                          </Marker>
                        );
                      })}
                  </>
                );
              }}
            </Geographies>
          </ComposableMap>

          {/* Filters */}
          <div className="ucdm-filters">
            <div className="ucdm-select-wrap">
              <select
                className="ucdm-select"
                value={selectedSector}
                onChange={(e) => setSelectedSector(e.target.value)}
                aria-label="Filter by sector"
              >
                <option value={ALL_SECTORS}>All Sectors</option>
                {sectorOptions.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>

            <div className="ucdm-select-wrap">
              <select
                className="ucdm-select"
                value={selectedCountry}
                onChange={(e) => setSelectedCountry(e.target.value)}
                aria-label="Filter by country"
              >
                <option value={NO_COUNTRY}>Country</option>
                {countryOptions.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Tooltip only when dots exist */}
          {!isCountrySelected && hoverInfo && tooltipPos && (
            <div className="ucdm-tooltip" style={{ left: tooltipPos.x + 12, top: tooltipPos.y + 12 }}>
              <strong>{hoverInfo.label}</strong> • {hoverInfo.value} use case
              {hoverInfo.value === 1 ? "" : "s"}
            </div>
          )}
        </div>

        {/* RIGHT: Country card (centered vertically) */}
        {isCountrySelected && selectedCountryStats && (
          <aside className="ucdm-side" aria-label="Selected country details">
            <div className="ucdm-side-card">
              <button
                type="button"
                className="ucdm-clear"
                onClick={clearSelection}
                aria-label="Clear selection"
                title="Clear selection"
              >
                ×
              </button>

              <div className="ucdm-side-header">
                <img
                  className="ucdm-flag"
                  src={flagUrlFromIso2(selectedCountryStats.iso2)}
                  alt=""
                  aria-hidden="true"
                />
                <div className="ucdm-country-name">{selectedCountryStats.country}</div>
              </div>

              <div className="ucdm-metrics">
                <div className="ucdm-metric">
                  <div className="ucdm-metric-label">
                    {isSectorSelected
                      ? "Use cases (filtered by selected sector)"
                      : "No. of use cases"}
                  </div>
                  <div className="ucdm-metric-value">{selectedCountryStats.useCases}</div>
                </div>

                {!isSectorSelected && (
                  <div className="ucdm-metric">
                    <div className="ucdm-metric-label">No. of sectors</div>
                    <div className="ucdm-metric-value">{selectedCountryStats.sectors}</div>
                  </div>
                )}
              </div>

              <button
                type="button"
                className="ucdm-view-btn"
                onClick={goToUseCaseLibrary}
                aria-label="View use cases with selected filters"
              >
                View use cases
              </button>
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}
