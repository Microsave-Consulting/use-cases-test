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

// Get PNG flag URL from ISO2 code (e.g. "IN" → flagcdn URL)
function flagUrlFromIso2(iso2) {
  if (!iso2) return null;
  const code = iso2.toLowerCase();
  return `https://flagcdn.com/w40/${code}.png`;
}

const geoUrl =
  "https://unpkg.com/world-atlas@2.0.2/countries-110m.json";

export default function UseCaseHeatmap({ items }) {
  const [hoverInfo, setHoverInfo] = useState(null);  // {name, iso2, value}
  const [tooltipPos, setTooltipPos] = useState(null); // {x, y}

  // 1) Aggregate use cases per ISO2 code
  const { countsByCode, minValue, maxValue } = useMemo(() => {
    const counts = {};

    items.forEach((row) => {
      const raw = row.Country; // your "Country" column
      const names = splitValues(raw);

      names.forEach((nameRaw) => {
        let name = nameRaw.trim();
        if (!name) return;

        const lower = name.toLowerCase();
        if (lower === "uk") name = "United Kingdom";
        if (
          lower === "usa" ||
          lower === "u.s." ||
          lower === "u.s.a." ||
          lower === "united states"
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
    const min = vals.length ? Math.min(...vals) : 0;
    const max = vals.length ? Math.max(...vals) : 0;

    return { countsByCode: counts, minValue: min, maxValue: max };
  }, [items]);

  if (!items.length) {
    return <p style={{ padding: "1rem" }}>No data for map.</p>;
  }

  // 2) Color scale: low → high in ORANGE spectrum
  const colorScale = useMemo(() => {
    if (!maxValue) {
      return () => "#102957";
    }
    return scaleLinear()
      .domain([minValue, maxValue])
      .range(["#fed7aa", "#f97316"]); // light orange → vivid orange
  }, [minValue, maxValue]);

  // Helper to set tooltip from country info + mouse event
  const showTooltip = (info, event) => {
    if (!info) {
      setHoverInfo(null);
      setTooltipPos(null);
      return;
    }
    setHoverInfo(info);
    setTooltipPos({
      x: event.clientX,
      y: event.clientY,
    });
  };

  return (
    <div
      style={{
        width: "100%",
        padding: "2rem 0 2rem",
        background: "#071a34", // page background
        position: "relative",
      }}
    >
      <div
        style={{
          width: "95vw",
          maxWidth: "1600px",
          margin: "0 auto",
          background: "#061326", // map card background
          borderRadius: "12px",
          padding: "1.5rem 1rem 1.75rem",
          boxShadow: "0 12px 30px rgba(0,0,0,0.35)",
          position: "relative",
        }}
      >
        <h2
          style={{
            textAlign: "center",
            color: "white",
            marginBottom: "1rem",
            fontSize: "1.6rem",
            letterSpacing: "0.03em",
          }}
        >
          Use-case Heatmap
        </h2>

        <ComposableMap
          projectionConfig={{
            scale: 155,
            center: [-10, 10], // tweak if needed
          }}
          width={1000}
          height={450}
          style={{
            width: "100%",
            height: "auto",
          }}
        >
          <Geographies geography={geoUrl}>
            {({ geographies }) => {
              // Build one centroid per ISO2 (so only one pin per country)
              const centroidByIso = {};
              geographies.forEach((geo) => {
                const props = geo.properties || {};
                const name =
                  props.name ||
                  props.NAME ||
                  props.ADMIN ||
                  "Unknown";

                let iso2 =
                  (props.ISO_A2 ||
                    props.iso_a2 ||
                    props.ISO2 ||
                    "").toUpperCase();

                if (!iso2 && name && name !== "Unknown") {
                  const resolved = countries.getAlpha2Code(name, "en");
                  if (resolved) iso2 = resolved.toUpperCase();
                }

                if (!iso2) return;

                const centroid = geoCentroid(geo);
                if (
                  Array.isArray(centroid) &&
                  !Number.isNaN(centroid[0]) &&
                  !Number.isNaN(centroid[1])
                ) {
                  if (!centroidByIso[iso2]) {
                    centroidByIso[iso2] = { centroid, name };
                  }
                }
              });

              return (
                <>
                  {/* Country shapes with orange heat coloring */}
                  {geographies.map((geo) => {
                    const props = geo.properties || {};
                    const name =
                      props.name ||
                      props.NAME ||
                      props.ADMIN ||
                      "Unknown";

                    let iso2 =
                      (props.ISO_A2 ||
                        props.iso_a2 ||
                        props.ISO2 ||
                        "").toUpperCase();

                    if (!iso2 && name && name !== "Unknown") {
                      const resolved = countries.getAlpha2Code(name, "en");
                      if (resolved) iso2 = resolved.toUpperCase();
                    }

                    const val = iso2 ? countsByCode[iso2] || 0 : 0;
                    const hasData = val > 0;
                    const fill = hasData
                      ? colorScale(val)
                      : "#102957"; // base dark blue

                    const info =
                      hasData && iso2
                        ? { name, iso2, value: val }
                        : null;

                    return (
                      <Geography
                        key={geo.rsmKey}
                        geography={geo}
                        fill={fill}
                        stroke="#1f3b73"
                        strokeWidth={0.45}
                        style={{
                          default: { outline: "none" },
                          hover: {
                            outline: "none",
                            cursor: hasData ? "pointer" : "default",
                            opacity: hasData ? 0.95 : 1,
                          },
                          pressed: { outline: "none" },
                        }}
                        onMouseEnter={(e) => {
                          if (info) showTooltip(info, e);
                        }}
                        onMouseMove={(e) => {
                          if (info) showTooltip(info, e);
                        }}
                        onMouseLeave={() => {
                          setHoverInfo(null);
                          setTooltipPos(null);
                        }}
                      />
                    );
                  })}

                  {/* Single flag-pin per country (constant size) */}
                  {Object.entries(countsByCode).map(([iso2, val]) => {
                    const entry = centroidByIso[iso2];
                    if (!entry) return null;

                    const { centroid, name } = entry;
                    const flagUrl = flagUrlFromIso2(iso2);
                    if (!flagUrl) return null;

                    // CONSTANT pin size
                    const headRadius = 11;
                    const glowRadius = headRadius + 4;
                    const pinHeight = 30; // how high the head floats above centroid
                    const tipOffset = 4; // distance from centroid to top of diamond tip

                    const clipId = `flag-clip-${iso2}`;

                    const info = { name, iso2, value: val };

                    return (
                      <Marker
                        key={iso2}
                        coordinates={centroid}
                        onMouseEnter={(e) => showTooltip(info, e)}
                        onMouseMove={(e) => showTooltip(info, e)}
                        onMouseLeave={() => {
                          setHoverInfo(null);
                          setTooltipPos(null);
                        }}
                        style={{ cursor: "pointer" }}
                      >
                        {/* Shift the whole pin UP so the head floats above the country */}
                        <g transform={`translate(0, -${pinHeight})`}>
                          {/* Pin stem (from bottom of head down toward centroid) */}
                          <line
                            x1="0"
                            y1={headRadius}
                            x2="0"
                            y2={pinHeight - tipOffset}
                            stroke="#facc15"
                            strokeWidth="2"
                          />

                          {/* Diamond-shaped tip pointing to the country */}
                          <polygon
                            points={`-4,${pinHeight - tipOffset} 4,${
                              pinHeight - tipOffset
                            } 0,${pinHeight - tipOffset + 6}`}
                            fill="#facc15"
                          />

                          {/* Soft glow behind the head */}
                          <circle
                            r={glowRadius}
                            fill="rgba(250, 204, 21, 0.22)"
                          />

                          {/* White outer circle for crisp border */}
                          <circle
                            r={headRadius + 1}
                            fill="#ffffff"
                          />

                          {/* Circular clip for the flag */}
                          <defs>
                            <clipPath id={clipId}>
                              <circle r={headRadius} cx={0} cy={0} />
                            </clipPath>
                          </defs>

                          {/* Flag inside the circular head */}
                          <image
                            href={flagUrl}
                            x={-headRadius}
                            y={-headRadius}
                            width={headRadius * 2}
                            height={headRadius * 2}
                            clipPath={`url(#${clipId})`}
                            style={{ pointerEvents: "none" }}
                          />
                        </g>
                      </Marker>
                    );
                  })}
                </>
              );
            }}
          </Geographies>
        </ComposableMap>

        {/* Min/max legend at bottom-right */}
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

        {/* Floating tooltip that follows the cursor */}
        {hoverInfo && tooltipPos && (
          <div
            style={{
              position: "fixed",
              left: tooltipPos.x + 12,
              top: tooltipPos.y + 12,
              background: "rgba(15,23,42,0.95)",
              color: "#e5e7eb",
              padding: "0.4rem 0.6rem",
              borderRadius: "6px",
              fontSize: "0.8rem",
              pointerEvents: "none",
              boxShadow: "0 4px 12px rgba(0,0,0,0.4)",
              zIndex: 9999,
              whiteSpace: "nowrap",
            }}
          >
            <strong>{hoverInfo.name}</strong>
            <span style={{ opacity: 0.9 }}>
              {" "}
              • {hoverInfo.value} use case
              {hoverInfo.value === 1 ? "" : "s"}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
