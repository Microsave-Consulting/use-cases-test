import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

function splitValues(value) {
  if (!value) return [];
  return String(value)
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
}

function lerp(a, b, t) {
  return Math.round(a + (b - a) * t);
}

function colorFor(value, max) {
  if (!max || value <= 0) return "#fff7ed";
  const t = value / max;
  const light = { r: 255, g: 245, b: 235 };
  const dark = { r: 153, g: 0, b: 0 };
  return `rgb(${lerp(light.r, dark.r, t)}, ${lerp(light.g, dark.g, t)}, ${lerp(
    light.b,
    dark.b,
    t
  )})`;
}

function clamp(n, lo, hi) {
  return Math.max(lo, Math.min(hi, n));
}

// Observe container width (no dependencies, no CSS overrides)
function useContainerWidth() {
  const ref = useRef(null);
  const [w, setW] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const ro = new ResizeObserver((entries) => {
      const cw = entries?.[0]?.contentRect?.width || 0;
      setW(cw);
    });

    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return [ref, w];
}

export default function SectorCountryHeatmap({
  items,
  title = "Heatmap: Sector Priorities for Top Countries",
  topNCountries = 10,
}) {
  const navigate = useNavigate();
  const [wrapRef, wrapW] = useContainerWidth();

  const { sectors, countries, matrix, maxValue } = useMemo(() => {
    const sectorSet = new Set();
    const countryCount = new Map();
    const pair = new Map();

    (items || []).forEach((uc) => {
      const secs = splitValues(uc.Sectors);
      const cts = splitValues(uc.Country);
      if (!secs.length || !cts.length) return;

      secs.forEach((s) => {
        sectorSet.add(s);
        if (!pair.has(s)) pair.set(s, new Map());
        const row = pair.get(s);

        cts.forEach((c) => {
          countryCount.set(c, (countryCount.get(c) || 0) + 1);
          row.set(c, (row.get(c) || 0) + 1);
        });
      });
    });

    const topCountries = Array.from(countryCount.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, topNCountries)
      .map(([c]) => c);

    const sectorList = Array.from(sectorSet).sort();

    let max = 0;
    const mat = sectorList.map((s) => {
      const row = pair.get(s) || new Map();
      const values = topCountries.map((c) => {
        const v = row.get(c) || 0;
        max = Math.max(max, v);
        return v;
      });
      return { sector: s, values };
    });

    return { sectors: sectorList, countries: topCountries, matrix: mat, maxValue: max };
  }, [items, topNCountries]);

  // ---------- Responsive sizing ----------
  // Available width (fallback to 900 if not measured yet)
  const containerW = wrapW || 900;

  // Make left label column responsive (shrinks on mobile, bounded)
  const leftLabelW = clamp(Math.round(containerW * 0.42), 140, 260);

  // Give a bit more room to bottom labels on small screens
  const bottomLabelH = containerW < 520 ? 86 : 70;

  const colorbarW = 16;
  const gap = 12;
  const padRight = 26;
  const padTop = 40;

  // Compute cell width so the whole matrix fits without horizontal scroll
  const availableForCells = containerW - leftLabelW - gap - colorbarW - padRight;
  const cols = Math.max(1, countries.length);
  const cellW = clamp(Math.floor(availableForCells / cols), 34, 70);

  // Row height can also shrink slightly
  const cellH = containerW < 520 ? 26 : 28;

  const width = leftLabelW + cols * cellW + gap + colorbarW + padRight;
  const height = padTop + sectors.length * cellH + bottomLabelH;

  const labelFont = containerW < 520 ? 11 : 12;
  const valueFont = cellW <= 42 ? 10 : 12;

  function go(sector, country, val) {
    if (!val) return;
    const p = new URLSearchParams();
    p.set("sector", sector);
    p.set("country", country);
    navigate(`/library?${p.toString()}`);
  }

  return (
    <div ref={wrapRef} style={{ width: "100%" }}>
      <div style={{ width: "100%", margin: "0 auto" }}>
        <div style={{ textAlign: "center", fontWeight: 700, marginBottom: 8 }}>
          {title}
        </div>

        {/* SVG now scales to container width */}
        <svg
          viewBox={`0 0 ${width} ${height}`}
          width="100%"
          style={{ height: "auto", display: "block" }}
          preserveAspectRatio="xMidYMin meet"
        >
          {/* Matrix */}
          {matrix.map((row, i) => {
            const y = 30 + i * cellH;
            return (
              <g key={row.sector}>
                <text
                  x={leftLabelW - 10}
                  y={y + cellH / 2 + 4}
                  textAnchor="end"
                  fontSize={labelFont}
                >
                  {row.sector}
                </text>

                {row.values.map((v, j) => {
                  const x = leftLabelW + j * cellW;
                  return (
                    <g
                      key={`${row.sector}-${j}`}
                      onClick={() => go(row.sector, countries[j], v)}
                      style={{ cursor: v ? "pointer" : "default" }}
                    >
                      <rect
                        x={x}
                        y={y}
                        width={cellW}
                        height={cellH}
                        fill={colorFor(v, maxValue)}
                        stroke="#e5e7eb"
                      />
                      <text
                        x={x + cellW / 2}
                        y={y + cellH / 2 + 4}
                        textAnchor="middle"
                        fontSize={valueFont}
                        fontWeight={600}
                        style={{ pointerEvents: "none" }}
                      >
                        {v}
                      </text>
                    </g>
                  );
                })}
              </g>
            );
          })}

          {/* Country labels (BOTTOM) */}
          {countries.map((c, j) => {
            const x = leftLabelW + j * cellW + cellW / 2;
            const y = 30 + sectors.length * cellH + 10;
            return (
              <text
                key={c}
                x={x}
                y={y}
                textAnchor="end"
                fontSize={containerW < 520 ? 10 : 11}
                transform={`rotate(-45 ${x} ${y})`}
              >
                {c}
              </text>
            );
          })}

          {/* Colorbar */}
          <g transform={`translate(${leftLabelW + cols * cellW + gap}, 30)`}>
            <defs>
              <linearGradient id="sc-heat" x1="0" y1="1" x2="0" y2="0">
                <stop offset="0%" stopColor={colorFor(0, maxValue)} />
                <stop offset="100%" stopColor={colorFor(maxValue, maxValue)} />
              </linearGradient>
            </defs>

            <rect
              width={colorbarW}
              height={sectors.length * cellH}
              fill="url(#sc-heat)"
              stroke="#e5e7eb"
            />
            <text x={colorbarW + 6} y={12} fontSize={labelFont}>
              {maxValue}
            </text>
            <text x={colorbarW + 6} y={sectors.length * cellH} fontSize={labelFont}>
              0
            </text>
          </g>
        </svg>
      </div>
    </div>
  );
}
