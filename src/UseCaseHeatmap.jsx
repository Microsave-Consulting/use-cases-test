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

const geoUrl =
  "https://unpkg.com/world-atlas@2.0.2/countries-110m.json";

export default function UseCaseHeatmap({ items }) {
  const [hoverInfo, setHoverInfo] = useState(null); // { iso2, name, value }
  const [hoverCentroid, setHoverCentroid] = useState(null); // [lon, lat]
  const [tooltipPos, setTooltipPos] = useState(null); // { x, y }

  // 1) Aggregate use cases per ISO2
  const { countsByCode, minValue, maxValue } = useMemo(() => {
    const counts = {};

    items.forEach((row) => {
      const names = splitValues(row.Country || "");
      names.forEach((n) => {
        let name = n.trim();
        if (!name) return;

        const lower = name.toLowerCase();
        if (lower === "uk") name = "United Kingdom";
        if (
          lower === "usa" ||
          lower === "united states" ||
          lower === "u.s." ||
          lower === "u.s.a."
        ) {
          name = "United States of America";
        }

        const iso2 = countries.getAlpha2Code(name, "en");
        if (!iso2) return;

        const code = iso2.toUpperCase();
        counts[code] = (counts[code] || 0) + 1;
      });
    });

    const vals = Object.values(counts);
    return {
      countsByCode: counts,
      minValue: vals.length ? Math.min(...vals) : 0,
      maxValue: vals.length ? Math.max(...vals) : 0,
    };
  }, [items]);

  // 2) Discrete turquoise palette: each unique count → unique, high-contrast color
  const colorScale = useMemo(() => {
    const values = Object.values(countsByCode);
    if (!values.length) {
      // fallback when there is absolutely no data
      return () => "#2a4d7a"; // lighter blue
    }

    const uniqueValues = Array.from(new Set(values)).sort((a, b) => a - b);

    // Strongly distinct turquoise / aqua / teal shades
    const palette = [
      "#c8f7ff", // very light
      "#94ecff", // light
      "#5fe0ff", // bright cyan
      "#29d4ff", // strong cyan
      "#00bfdf", // your key aqua
      "#009fbe", // teal-ish
      "#007c95", // deep teal
      "#005f70", // darkest teal
    ];

    const n = uniqueValues.length;
    const colorMap = {};

    uniqueValues.forEach((v, idx) => {
      if (n === 1) {
        // Only one value → central-ish color
        colorMap[v] = palette[4];
      } else {
        // Spread indices across the palette range
        const paletteIndex = Math.round(
          (idx / (n - 1)) * (palette.length - 1)
        );
        colorMap[v] = palette[paletteIndex];
      }
    });

    return (value) => colorMap[value] || "#2a4d7a"; // lighter fallback
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

  return (
    <div
      style={{
        width: "100%",
        padding: "2rem 0",
        // lighter ocean-ish outer background
        background: "#0f2447",
        position: "relative",
      }}
    >
      <div
        style={{
          width: "95vw",
          maxWidth: "1600px",
          margin: "0 auto",
          // lighter inner card background
          background: "#122b55",
          borderRadius: "12px",
          padding: "1.5rem 1rem",
          boxShadow: "0 12px 30px rgba(0,0,0,0.35)",
          position: "relative",
        }}
      >
        <h2
          style={{
            textAlign: "center",
            color: "white",
            marginBottom: "1.25rem",
            fontSize: "1.6rem",
          }}
        >
          Use-case Heatmap
        </h2>

        <ComposableMap
          projectionConfig={{ scale: 155, center: [-10, 10] }}
          width={1000}
          height={450}
          style={{ width: "100%", height: "auto" }}
        >
          <Geographies geography={geoUrl}>
            {({ geographies }) => {
              // 3) Build centroids per ISO2 (one per country)
              const centroidByIso = {};
              geographies.forEach((geo) => {
                const p = geo.properties || {};
                const name = p.name || p.NAME || p.ADMIN || "Unknown";

                let iso2 =
                  (p.ISO_A2 || p.iso_a2 || p.ISO2 || "").toUpperCase();
                if (!iso2 && name !== "Unknown") {
                  const resolved = countries.getAlpha2Code(name, "en");
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
                  centroidByIso[iso2] = { centroid: c, name };
                }
              });

              return (
                <>
                  {/* 4) Countries with discrete turquoise colors */}
                  {geographies.map((geo) => {
                    const p = geo.properties || {};
                    const name = p.name || p.NAME || p.ADMIN || "Unknown";

                    let iso2 =
                      (p.ISO_A2 || p.iso_a2 || p.ISO2 || "").toUpperCase();
                    if (!iso2 && name !== "Unknown") {
                      const resolved = countries.getAlpha2Code(name, "en");
                      if (resolved) iso2 = resolved.toUpperCase();
                    }

                    const val = iso2 ? countsByCode[iso2] || 0 : 0;
                    const hasData = val > 0;

                    const info =
                      hasData && iso2
                        ? { iso2, name, value: val }
                        : null;

                    return (
                      <Geography
                        key={geo.rsmKey}
                        geography={geo}
                        fill={
                          hasData
                            ? colorScale(val)
                            : "#2a4d7a" // lighter blue for non-use-case countries
                        }
                        stroke="#1f3b73"
                        strokeWidth={0.4}
                        style={{
                          default: { outline: "none" },
                          hover: {
                            outline: "none",
                            cursor: hasData ? "pointer" : "default",
                            opacity: hasData ? 0.9 : 1,
                          },
                        }}
                        onMouseEnter={(e) =>
                          info &&
                          showHover(
                            info,
                            centroidByIso[info.iso2]?.centroid,
                            e
                          )
                        }
                        onMouseMove={(e) =>
                          info &&
                          showHover(
                            info,
                            centroidByIso[info.iso2]?.centroid,
                            e
                          )
                        }
                        onMouseLeave={hideHover}
                      />
                    );
                  })}

                  {/* 5) Hover-only flag pin */}
                  {hoverInfo && hoverCentroid && (
                    <Marker coordinates={hoverCentroid}>
                      <g transform="translate(0, -30)">
                        {/* Pin stem */}
                        <line
                          x1="0"
                          y1="11"
                          x2="0"
                          y2="26"
                          stroke="#facc15"
                          strokeWidth="2"
                        />
                        {/* Pin tip */}
                        <polygon
                          points="-4,26 4,26 0,32"
                          fill="#facc15"
                        />
                        {/* Glow */}
                        <circle
                          r="15"
                          fill="rgba(250,204,21,0.25)"
                        />
                        {/* White circle */}
                        <circle r="12" fill="#ffffff" />

                        {/* Circular flag */}
                        <defs>
                          <clipPath id="flag-clip-hover">
                            <circle r="11" cx="0" cy="0" />
                          </clipPath>
                        </defs>
                        <image
                          href={flagUrlFromIso2(hoverInfo.iso2)}
                          x={-11}
                          y={-11}
                          width={22}
                          height={22}
                          clipPath="url(#flag-clip-hover)"
                          style={{ pointerEvents: "none" }}
                        />

                        {/* Number under pin head */}
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

        {/* 6) Tooltip following the cursor */}
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
            <strong>{hoverInfo.name}</strong> • {hoverInfo.value} use case
            {hoverInfo.value === 1 ? "" : "s"}
          </div>
        )}

        {/* Optional min/max info */}
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
