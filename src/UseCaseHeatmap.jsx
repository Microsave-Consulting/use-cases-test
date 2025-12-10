// src/UseCaseHeatmap.jsx
import { useMemo, useState } from "react";
import {
  ComposableMap,
  Geographies,
  Geography,
  Marker,
} from "react-simple-maps";
import { scaleLinear } from "d3-scale";
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
  const [hoverInfo, setHoverInfo] = useState(null);   // {iso2, name, value}
  const [hoverCentroid, setHoverCentroid] = useState(null); // [lon, lat]
  const [tooltipPos, setTooltipPos] = useState(null); // cursor position

  // Aggregate use cases per ISO2
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

  // Orange heat color scale
  const colorScale = useMemo(() => {
    if (!maxValue) return () => "#102957";
    return scaleLinear()
      .domain([minValue, maxValue])
      .range(["#fed7aa", "#f97316"]);
  }, [minValue, maxValue]);

  // Show tooltip + pin when hovering
  const showHover = (info, centroid, evt) => {
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
        background: "#071a34",
        position: "relative",
      }}
    >
      <div
        style={{
          width: "95vw",
          maxWidth: "1600px",
          margin: "0 auto",
          background: "#061326",
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
          projectionConfig={{
            scale: 155,
            center: [-10, 10],
          }}
          width={1000}
          height={450}
          style={{ width: "100%", height: "auto" }}
        >
          <Geographies geography={geoUrl}>
            {({ geographies }) => {
              // Build one centroid per ISO2
              const centroidByIso = {};
              geographies.forEach((geo) => {
                const p = geo.properties || {};
                const name =
                  p.name || p.NAME || p.ADMIN || "Unknown";
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
                  !isNaN(c[0]) &&
                  !isNaN(c[1]) &&
                  !centroidByIso[iso2]
                ) {
                  centroidByIso[iso2] = { centroid: c, name };
                }
              });

              return (
                <>
                  {/* Draw countries */}
                  {geographies.map((geo) => {
                    const p = geo.properties || {};
                    const name =
                      p.name || p.NAME || p.ADMIN || "Unknown";
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
                          hasData ? colorScale(val) : "#102957"
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
                            centroidByIso[iso2]?.centroid,
                            e
                          )
                        }
                        onMouseMove={(e) =>
                          info &&
                          showHover(
                            info,
                            centroidByIso[iso2]?.centroid,
                            e
                          )
                        }
                        onMouseLeave={hideHover}
                      />
                    );
                  })}

                  {/* Draw PIN ONLY WHEN HOVERING */}
                  {hoverInfo && hoverCentroid && (
                    <Marker coordinates={hoverCentroid}>
                      <g transform={`translate(0, -30)`}>
                        {/* Pin stem */}
                        <line
                          x1="0"
                          y1={11}
                          x2="0"
                          y2={30 - 4}
                          stroke="#facc15"
                          strokeWidth="2"
                        />

                        {/* Pin tip */}
                        <polygon
                          points={`-4,${30 - 4} 4,${30 - 4} 0,${
                            30 - 4 + 6
                          }`}
                          fill="#facc15"
                        />

                        {/* Glow */}
                        <circle
                          r={15}
                          fill="rgba(250,204,21,0.2)"
                        />

                        {/* White circle */}
                        <circle
                          r={12}
                          fill="#ffffff"
                        />

                        {/* Flag inside circle */}
                        <defs>
                          <clipPath id="flag-clip-hover">
                            <circle r={11} cx={0} cy={0} />
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

                        {/* Number label under pin head */}
                        <text
                          y={28}
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

        {/* Floating Tooltip */}
        {hoverInfo && tooltipPos && (
          <div
            style={{
              position: "fixed",
              left: tooltipPos.x + 12,
              top: tooltipPos.y + 12,
              background: "rgba(15,23,42,0.92)",
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

      </div>
    </div>
  );
}
