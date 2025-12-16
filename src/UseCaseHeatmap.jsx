// src/UseCaseHeatmap.jsx
import { useMemo, useState } from "react";
import { ComposableMap, Geographies, Geography, Marker } from "react-simple-maps";
import { geoCentroid } from "d3-geo";
import countries from "i18n-iso-countries";
import enLocale from "i18n-iso-countries/langs/en.json";
import { useNavigate } from "react-router-dom";

countries.registerLocale(enLocale);

function splitValues(value) {
  if (!value) return [];
  return String(value)
    .split(",")
    .map((v) => v.trim())
    .filter((v) => v.length > 0);
}

function flagUrlFromIso2(iso2) {
  if (!iso2) return null;
  return `https://flagcdn.com/w40/${iso2.toLowerCase()}.png`;
}

const geoUrl = "https://unpkg.com/world-atlas@2.0.2/countries-110m.json";

export default function UseCaseHeatmap({ items }) {
  const [hoverInfo, setHoverInfo] = useState(null);
  const [hoverCentroid, setHoverCentroid] = useState(null);
  const [tooltipPos, setTooltipPos] = useState(null);

  const navigate = useNavigate();

  const goToCountry = (info) => {
    if (!info?.label) return;
    navigate(`/library?country=${encodeURIComponent(info.label)}`);
  };

  const { countsByCode, labelByIso, minValue, maxValue } = useMemo(() => {
    const counts = {};
    const labels = {};

    (items || []).forEach((row) => {
      const names = splitValues(row.Country || "");
      names.forEach((n) => {
        const nameFromData = n.trim();
        if (!nameFromData) return;

        const iso2 = countries.getAlpha2Code(nameFromData, "en");
        if (!iso2) return;

        const code = iso2.toUpperCase();
        counts[code] = (counts[code] || 0) + 1;

        if (!labels[code]) labels[code] = nameFromData;
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

  const colorScale = useMemo(() => {
    const values = Object.values(countsByCode);
    if (!values.length) return () => "#facc15";

    const uniqueValues = Array.from(new Set(values)).sort((a, b) => a - b);

    const palette = ["#fff7cc", "#ffef99", "#ffe066", "#ffd033", "#facc15", "#eab308", "#ca8a04", "#a16207"];
    const n = uniqueValues.length;
    const colorMap = {};

    uniqueValues.forEach((v, idx) => {
      if (n === 1) colorMap[v] = palette[4];
      else {
        const paletteIndex = Math.round((idx / (n - 1)) * (palette.length - 1));
        colorMap[v] = palette[paletteIndex];
      }
    });

    return (value) => colorMap[value] || "#facc15";
  }, [countsByCode]);

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

  const MAP_W = 1000;
  const MAP_H = 450;

  return (
    <div style={{ width: "100%", padding: "1rem" }}>
      <div
        style={{
          width: "100%",
          borderRadius: 12,
          padding: "1rem",
          background: "transparent",
          boxShadow: "0 12px 30px rgba(0,0,0,0.18)",
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

          <rect x="0" y="0" width={MAP_W} height={MAP_H} fill="url(#oceanGradient)" />

          <text x={70} y={260} fontSize={28} fontWeight={700} fill="#fff">
            <tspan x={70} dy="0">Digital ID</tspan>
            <tspan x={70} dy="34">Innovations</tspan>
            <tspan x={70} dy="34">Library</tspan>
          </text>

          <Geographies geography={geoUrl}>
            {({ geographies }) => {
              const centroidByIso = {};
              geographies.forEach((geo) => {
                const p = geo.properties || {};
                const geoName = p.name || p.NAME || p.ADMIN || "Unknown";

                let iso2 = (p.ISO_A2 || p.iso_a2 || p.ISO2 || "").toUpperCase();
                if (!iso2 && geoName !== "Unknown") {
                  const resolved = countries.getAlpha2Code(geoName, "en");
                  if (resolved) iso2 = resolved.toUpperCase();
                }
                if (!iso2) return;

                const c = geoCentroid(geo);
                if (Array.isArray(c) && !Number.isNaN(c[0]) && !Number.isNaN(c[1]) && !centroidByIso[iso2]) {
                  centroidByIso[iso2] = { centroid: c, geoName };
                }
              });

              return (
                <>
                  {geographies.map((geo) => {
                    const p = geo.properties || {};
                    const geoName = p.name || p.NAME || p.ADMIN || "Unknown";

                    let iso2 = (p.ISO_A2 || p.iso_a2 || p.ISO2 || "").toUpperCase();
                    if (!iso2 && geoName !== "Unknown") {
                      const resolved = countries.getAlpha2Code(geoName, "en");
                      if (resolved) iso2 = resolved.toUpperCase();
                    }

                    const val = iso2 ? countsByCode[iso2] || 0 : 0;
                    const hasData = val > 0;

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

                    const info = { iso2, label: displayLabel, value: val };

                    return (
                      <Geography
                        key={geo.rsmKey}
                        geography={geo}
                        fill={colorScale(val)}
                        stroke="rgba(0,0,0,0.22)"
                        strokeWidth={0.55}
                        style={{
                          default: { outline: "none" },
                          hover: { outline: "none", cursor: "pointer", opacity: 0.92 },
                          pressed: { outline: "none" },
                        }}
                        onMouseEnter={(e) => showHover(info, centroidInfo.centroid, e)}
                        onMouseMove={(e) => showHover(info, centroidInfo.centroid, e)}
                        onMouseLeave={hideHover}
                        onClick={() => goToCountry(info)}
                      />
                    );
                  })}

                  {/* Flag pins ONLY on hover (your requirement) */}
                  {hoverInfo && hoverCentroid && (
                    <Marker coordinates={hoverCentroid}>
                      <g transform="translate(0, -30)" onClick={() => goToCountry(hoverInfo)} style={{ cursor: "pointer" }}>
                        <line x1="0" y1="11" x2="0" y2="26" stroke="#facc15" strokeWidth="2" />
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
                      </g>
                    </Marker>
                  )}
                </>
              );
            }}
          </Geographies>
        </ComposableMap>

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
            <strong>{hoverInfo.label}</strong> • {hoverInfo.value} use case{hoverInfo.value === 1 ? "" : "s"}
          </div>
        )}

        <div style={{ marginTop: "0.75rem", fontSize: "0.8rem", color: "#64748b", textAlign: "right" }}>
          Min: {minValue || 0} • Max: {maxValue || 0}
        </div>
      </div>
    </div>
  );
}
