// src/UseCaseHeatmap.jsx
import { useMemo, useState } from "react";
import {
  ComposableMap,
  Geographies,
  Geography,
  Marker,
} from "react-simple-maps";
import { geoCentroid } from "d3-geo";
import countries from "i18n-iso-countries";
import enLocale from "i18n-iso-countries/langs/en.json";
import { useNavigate } from "react-router-dom";

countries.registerLocale(enLocale);

// Split "A, B, C" → ["A", "B", "C"]
function splitValues(value) {
  if (!value) return [];
  return String(value)
    .split(",")
    .map((v) => v.trim())
    .filter((v) => v.length > 0);
}

// Convert ISO2 → PNG flag URL
function flagUrlFromIso2(iso2) {
  if (!iso2) return null;
  return `https://flagcdn.com/w40/${iso2.toLowerCase()}.png`;
}

const geoUrl = "https://unpkg.com/world-atlas@2.0.2/countries-110m.json";

export default function UseCaseHeatmap({ items }) {
  const [hoverInfo, setHoverInfo] = useState(null); // { iso2, label, value }
  const [hoverCentroid, setHoverCentroid] = useState(null); // [lon, lat]
  const [tooltipPos, setTooltipPos] = useState(null); // { x, y }

  const navigate = useNavigate();

  // Navigate to the library, pre-filtered by this country (by name)
  const goToCountry = (info) => {
    if (!info?.label) return;
    const label = info.label;
    navigate(`/library?country=${encodeURIComponent(label)}`);
  };

  // 1) Aggregate use cases per ISO2, and remember the data-country label we saw
  const { countsByCode, labelByIso, minValue, maxValue } = useMemo(() => {
    const counts = {};
    const labels = {};

    items.forEach((row) => {
      const names = splitValues(row.Country || "");
      names.forEach((n) => {
        const nameFromData = n.trim();
        if (!nameFromData) return;

        // Try to resolve ISO2 using the data label
        const iso2 = countries.getAlpha2Code(nameFromData, "en");
        if (!iso2) return;

        const code = iso2.toUpperCase();
        counts[code] = (counts[code] || 0) + 1;

        // Remember a canonical label straight from the data
        if (!labels[code]) {
          labels[code] = nameFromData;
        }
      });
    });

    const vals = Object.values(counts);
    return {
      countsByCode: counts,
      labelByIso: labels,
      minValue: vals.length ? Math.min(...vals) : 0,
      maxValue: vals.length ? Math.max(...vals) : 0,
    };
  }, [items]);

  // 2) Discrete yellow palette: each unique count → unique, high-contrast color
  const colorScale = useMemo(() => {
    const values = Object.values(countsByCode);
    if (!values.length) {
      return () => "#facc15";
    }

    const uniqueValues = Array.from(new Set(values)).sort((a, b) => a - b);

    const palette = [
      "#fff7cc",
      "#ffef99",
      "#ffe066",
      "#ffd033",
      "#facc15",
      "#eab308",
      "#ca8a04",
      "#a16207",
    ];

    const n = uniqueValues.length;
    const colorMap = {};

    uniqueValues.forEach((v, idx) => {
      if (n === 1) {
        colorMap[v] = palette[4];
      } else {
        const paletteIndex = Math.round(
          (idx / (n - 1)) * (palette.length - 1)
        );
        colorMap[v] = palette[paletteIndex];
      }
    });

    return (value) => colorMap[value] || "#facc15";
  }, [countsByCode]);

  // Hover helpers
  const showHover = (info, centroid, evt) => {
    if (!info || !centroid) {
      setHoverInfo(null);
      setHoverCentroid(null);
      setTooltipPos(null);
      return;
    }
    setHoverInfo(info);
    setHoverCentroid(centroid);
    setTooltipPos({ x: evt.clientX, y: evt.clientY });
  };

  const hideHover = () => {
    setHoverInfo(null);
    setHoverCentroid(null);
    setTooltipPos(null);
  };

  // Map canvas size used to paint the ocean gradient rect
  const MAP_W = 1000;
  const MAP_H = 450;

  return (
    <div
      style={{
        width: "100%",
        padding: "2rem 0",
        background: "transparent",
        position: "relative",
      }}
    >
      <div
        style={{
          width: "95vw",
          maxWidth: "1600px",
          margin: "0 auto",
          background: "transparent",
          borderRadius: "12px",
          padding: "1.5rem 1rem",
          boxShadow: "0 12px 30px rgba(0,0,0,0.35)",
          position: "relative",
        }}
      >
        

        <div
          style={{
            background: "transparent",
            padding: "0.9rem",
            borderRadius: "12px",
          }}
        >
          <ComposableMap
            projectionConfig={{ scale: 155, center: [-10, 10] }}
            width={MAP_W}
            height={MAP_H}
            style={{
              width: "100%",
              height: "auto",
              borderRadius: "10px",
              overflow: "hidden",
              display: "block",
            }}
          >
            {/* ✅ Ocean gradient background (behind countries) */}
            <defs>
              <linearGradient id="oceanGradient" x1="0" y1="1" x2="1" y2="0">
                <stop offset="0%" stopColor="#4aa8ff" />
                <stop offset="55%" stopColor="#2f6fce" />
                <stop offset="100%" stopColor="#1f4ea6" />
              </linearGradient>

              <clipPath id="flag-clip-hover">
                <circle r="11" cx="0" cy="0" />
              </clipPath>
            </defs>

            <rect
              x="0"
              y="0"
              width={MAP_W}
              height={MAP_H}
              fill="url(#oceanGradient)"
            />
            <text x={70} y={260} fontSize={28} fontWeight={700} fill="#fff">
              <tspan x={70} dy="0">Digital ID</tspan>
              <tspan x={70} dy="34">Innovations</tspan>
              <tspan x={70} dy="34">Library</tspan>
            </text>

            <Geographies geography={geoUrl}>
              {({ geographies }) => {
                // Build centroids per ISO2 (one per country)
                const centroidByIso = {};
                geographies.forEach((geo) => {
                  const p = geo.properties || {};
                  const geoName = p.name || p.NAME || p.ADMIN || "Unknown";

                  let iso2 =
                    (p.ISO_A2 || p.iso_a2 || p.ISO2 || "").toUpperCase();
                  if (!iso2 && geoName !== "Unknown") {
                    const resolved = countries.getAlpha2Code(geoName, "en");
                    if (resolved) iso2 = resolved.toUpperCase();
                  }
                  if (!iso2) return;

                  const c = geoCentroid(geo);
                  if (
                    Array.isArray(c) &&
                    !Number.isNaN(c[0]) &&
                    !Number.isNaN(c[1]) &&
                    !centroidByIso[iso2]
                  ) {
                    centroidByIso[iso2] = { centroid: c, geoName };
                  }
                });

                return (
                  <>
                    {geographies.map((geo) => {
                      const p = geo.properties || {};
                      const geoName = p.name || p.NAME || p.ADMIN || "Unknown";

                      let iso2 =
                        (p.ISO_A2 || p.iso_a2 || p.ISO2 || "").toUpperCase();
                      if (!iso2 && geoName !== "Unknown") {
                        const resolved = countries.getAlpha2Code(geoName, "en");
                        if (resolved) iso2 = resolved.toUpperCase();
                      }

                      const val = iso2 ? countsByCode[iso2] || 0 : 0;
                      const hasData = val > 0;

                      // ✅ Non-specified countries: WHITE
                      if (!hasData) {
                        return (
                          <Geography
                            key={geo.rsmKey}
                            geography={geo}
                            fill="#ffffff"
                            stroke="rgba(0,0,0,0.18)"
                            strokeWidth={0.5}
                            style={{
                              default: { outline: "none" },
                              hover: { outline: "none", cursor: "default" },
                              pressed: { outline: "none" },
                            }}
                            onMouseLeave={hideHover}
                          />
                        );
                      }

                      const centroidInfo = centroidByIso[iso2] || {};
                      const labelFromData = labelByIso[iso2];
                      const displayLabel = labelFromData || geoName;

                      const info = {
                        iso2,
                        label: displayLabel,
                        value: val,
                      };

                      return (
                        <Geography
                          key={geo.rsmKey}
                          geography={geo}
                          fill={colorScale(val)}
                          stroke="rgba(0,0,0,0.22)"
                          strokeWidth={0.55}
                          style={{
                            default: { outline: "none" },
                            hover: {
                              outline: "none",
                              cursor: "pointer",
                              opacity: 0.92,
                            },
                            pressed: { outline: "none" },
                          }}
                          onMouseEnter={(e) =>
                            showHover(info, centroidInfo.centroid, e)
                          }
                          onMouseMove={(e) =>
                            showHover(info, centroidInfo.centroid, e)
                          }
                          onMouseLeave={hideHover}
                          onClick={() => goToCountry(info)}
                        />
                      );
                    })}

                    {/* Hover-only flag pin (also clickable) */}
                    {hoverInfo && hoverCentroid && (
                      <Marker coordinates={hoverCentroid}>
                        <g
                          transform="translate(0, -30)"
                          onClick={() => goToCountry(hoverInfo)}
                          style={{ cursor: "pointer" }}
                        >
                          <line
                            x1="0"
                            y1="11"
                            x2="0"
                            y2="26"
                            stroke="#facc15"
                            strokeWidth="2"
                          />
                          <polygon points="-4,26 4,26 0,32" fill="#facc15" />
                          <circle r="15" fill="rgba(250,204,21,0.25)" />
                          <circle r="12" fill="#ffffff" />

                          <image
                            href={flagUrlFromIso2(hoverInfo.iso2)}
                            x={-11}
                            y={-11}
                            width={22}
                            height={22}
                            clipPath="url(#flag-clip-hover)"
                            style={{ pointerEvents: "none" }}
                          />

                          <text
                            y="28"
                            textAnchor="middle"
                            style={{
                              fill: "#facc15",
                              fontSize: "0.75rem",
                              fontWeight: "bold",
                            }}
                          >
                            {hoverInfo.value}
                          </text>
                        </g>
                      </Marker>
                    )}
                  </>
                );
              }}
            </Geographies>
          </ComposableMap>
        </div>

        {/* Tooltip following the cursor */}
        {hoverInfo && tooltipPos && (
          <div
            style={{
              position: "fixed",
              left: tooltipPos.x + 12,
              top: tooltipPos.y + 12,
              background: "rgba(10,18,28,0.92)",
              color: "#e5e7eb",
              padding: "6px 10px",
              borderRadius: "6px",
              fontSize: "0.8rem",
              pointerEvents: "none",
              boxShadow: "0 4px 12px rgba(0,0,0,0.45)",
              zIndex: 9999,
              whiteSpace: "nowrap",
            }}
          >
            <strong>{hoverInfo.label}</strong> • {hoverInfo.value} use case
            {hoverInfo.value === 1 ? "" : "s"}
          </div>
        )}

        <div
          style={{
            marginTop: "0.75rem",
            fontSize: "0.8rem",
            color: "#cbd5f5",
            textAlign: "right",
            opacity: 0.85,
          }}
        >
          Min: {minValue || 0} • Max: {maxValue || 0}
        </div>
      </div>
    </div>
  );
}
