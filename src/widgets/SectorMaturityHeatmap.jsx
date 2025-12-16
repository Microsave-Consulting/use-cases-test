import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

function splitValues(value) {
  if (!value) return [];
  return String(value)
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
}

function normalizeMaturity(m) {
  const s = (m || "").trim();
  if (!s) return "Unknown";
  return s;
}

function colorFor(value, max) {
  if (!max || value <= 0) return "#f7f7f7";
  const t = value / max;
  const light = { r: 230, g: 242, b: 255 };
  const dark = { r: 23, g: 58, b: 140 };

  const r = Math.round(light.r + (dark.r - light.r) * t);
  const g = Math.round(light.g + (dark.g - light.g) * t);
  const b = Math.round(light.b + (dark.b - light.b) * t);

  return `rgb(${r}, ${g}, ${b})`;
}

function clamp(n, lo, hi) {
  return Math.max(lo, Math.min(hi, n));
}

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

export default function SectorMaturityHeatmap({
  items,
  title = "Heatmap: Use Cases by Sector and Maturity Level",
  maturityOrder = ["Conceptual/Research", "Pilot/Testing", "Production/Scale", "Unknown"],
}) {
  const navigate = useNavigate();
  const [wrapRef, wrapW] = useContainerWidth();

  const { sectors, maturities, matrix, maxValue } = useMemo(() => {
    const sectorSet = new Set();
    const maturitySet = new Set();
    const counts = new Map();

    (items || []).forEach((uc) => {
      const maturity = normalizeMaturity(uc.MaturityLevel);
      if (!uc.MaturityLevel) return;

      const sectorsList = splitValues(uc.Sectors);
      if (!sectorsList.length) return;

      maturitySet.add(maturity);

      sectorsList.forEach((sec) => {
        sectorSet.add(sec);
        if (!counts.has(sec)) counts.set(sec, new Map());
        const row = counts.get(sec);
        row.set(maturity, (row.get(maturity) || 0) + 1);
      });
    });

    const sectorList = Array.from(sectorSet).sort((a, b) => a.localeCompare(b));

    const present = Array.from(maturitySet);
    const ordered = maturityOrder.filter((m) => present.includes(m));
    const extras = present.filter((m) => !maturityOrder.includes(m)).sort();
    const maturityList = [...ordered, ...extras];

    let max = 0;
    const mat = sectorList.map((sec) => {
      const row = counts.get(sec) || new Map();
      const values = maturityList.map((m) => row.get(m) || 0);
      values.forEach((v) => (max = Math.max(max, v)));
      return { sector: sec, values };
    });

    return { sectors: sectorList, maturities: maturityList, matrix: mat, maxValue: max };
  }, [items, maturityOrder]);

  // ---------- Responsive sizing ----------
  const containerW = wrapW || 900;

  const leftLabelW = clamp(Math.round(containerW * 0.42), 140, 260);
  const topLabelH = containerW < 520 ? 58 : 50;
  const colorbarW = 18;
  const gap = 10;
  const padRight = 22;
  const padBottom = 26;

  const cols = Math.max(1, maturities.length);
  const availableForCells = containerW - leftLabelW - gap - colorbarW - padRight;

  const cellW = clamp(Math.floor(availableForCells / cols), 70, 150);
  const cellH = containerW < 520 ? 28 : 32;

  const width = leftLabelW + cols * cellW + gap + colorbarW + padRight;
  const height = topLabelH + sectors.length * cellH + padBottom;

  const labelFont = containerW < 520 ? 11 : 12;
  const valueFont = cellW <= 85 ? 10 : 12;

  function goToFilteredLibrary(sector, maturity, val) {
    if (!sector || !maturity) return;
    if (!val || val <= 0) return;

    const params = new URLSearchParams();
    params.set("sector", sector);
    params.set("maturity", maturity);
    navigate(`/library?${params.toString()}`);
  }

  return (
    <div ref={wrapRef} style={{ width: "100%" }}>
      <div style={{ width: "100%", margin: "0 auto" }}>
        <div style={{ textAlign: "center", fontWeight: 700, marginBottom: 10 }}>
          {title}
        </div>

        <svg
          viewBox={`0 0 ${width} ${height}`}
          width="100%"
          style={{ height: "auto", display: "block", background: "#ffffff" }}
          preserveAspectRatio="xMidYMin meet"
        >
          {/* Column headers */}
          {maturities.map((m, j) => (
            <text
              key={m}
              x={leftLabelW + j * cellW + cellW / 2}
              y={topLabelH - 18}
              textAnchor="middle"
              fontSize={labelFont}
              fill="#111827"
            >
              {m}
            </text>
          ))}

          {/* Axis labels */}
          <text
            x={leftLabelW + (cols * cellW) / 2}
            y={topLabelH - 2}
            textAnchor="middle"
            fontSize={labelFont}
            fill="#374151"
          >
            Maturity Level
          </text>

          <text
            x={18}
            y={topLabelH + (sectors.length * cellH) / 2}
            textAnchor="middle"
            fontSize={labelFont}
            fill="#374151"
            transform={`rotate(-90 18 ${topLabelH + (sectors.length * cellH) / 2})`}
          >
            Sector
          </text>

          {/* Rows */}
          {matrix.map((row, i) => {
            const y = topLabelH + i * cellH;
            return (
              <g key={row.sector}>
                <text
                  x={leftLabelW - 10}
                  y={y + cellH / 2 + 4}
                  textAnchor="end"
                  fontSize={labelFont}
                  fill="#111827"
                >
                  {row.sector}
                </text>

                {row.values.map((val, j) => {
                  const maturity = maturities[j];
                  const x = leftLabelW + j * cellW;
                  const fill = colorFor(val, maxValue);
                  const textColor = val > maxValue * 0.55 ? "#ffffff" : "#111827";
                  const clickable = val > 0;

                  return (
                    <g
                      key={`${row.sector}-${maturity}`}
                      role={clickable ? "button" : undefined}
                      tabIndex={clickable ? 0 : undefined}
                      aria-label={
                        clickable
                          ? `Filter use cases: Sector ${row.sector}, Maturity ${maturity}`
                          : undefined
                      }
                      onClick={clickable ? () => goToFilteredLibrary(row.sector, maturity, val) : undefined}
                      onKeyDown={
                        clickable
                          ? (e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                goToFilteredLibrary(row.sector, maturity, val);
                              }
                            }
                          : undefined
                      }
                      style={{ cursor: clickable ? "pointer" : "default" }}
                    >
                      <rect
                        x={x}
                        y={y}
                        width={cellW}
                        height={cellH}
                        fill={fill}
                        stroke="#e5e7eb"
                      />
                      <text
                        x={x + cellW / 2}
                        y={y + cellH / 2 + 4}
                        textAnchor="middle"
                        fontSize={valueFont}
                        fill={textColor}
                        fontWeight={600}
                        style={{ pointerEvents: "none" }}
                      >
                        {val}
                      </text>
                    </g>
                  );
                })}
              </g>
            );
          })}

          {/* Colorbar */}
          <g transform={`translate(${leftLabelW + cols * cellW + gap}, ${topLabelH})`}>
            <defs>
              <linearGradient id="heatbar" x1="0" y1="1" x2="0" y2="0">
                <stop offset="0%" stopColor={colorFor(0, maxValue)} />
                <stop offset="100%" stopColor={colorFor(maxValue, maxValue)} />
              </linearGradient>
            </defs>

            <rect
              x={0}
              y={0}
              width={colorbarW}
              height={sectors.length * cellH}
              fill="url(#heatbar)"
              stroke="#e5e7eb"
            />

            <text x={colorbarW + 8} y={12} fontSize={labelFont} fill="#111827">
              {maxValue}
            </text>
            <text
              x={colorbarW + 8}
              y={sectors.length * cellH - 2}
              fontSize={labelFont}
              fill="#111827"
            >
              0
            </text>
          </g>
        </svg>
      </div>
    </div>
  );
}
