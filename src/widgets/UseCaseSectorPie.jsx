// src/widgets/UseCaseSectorPie.jsx
import { useMemo } from "react";
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { useNavigate } from "react-router-dom";
import "./UseCaseSectorPie.css";

// Split "A, B, C" → ["A", "B", "C"]
function splitValues(value) {
  if (!value) return [];
  return String(value)
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
}

/**
 * Build distribution rows: [{ name, value }]
 * - Counts each sector occurrence (multi-sector use cases contribute to multiple buckets)
 * - Optionally groups long tail into "Other"
 */
function buildSectorDistribution(items, topN = 10) {
  const counts = new Map();

  (items || []).forEach((uc) => {
    splitValues(uc.Sectors).forEach((sector) => {
      counts.set(sector, (counts.get(sector) || 0) + 1);
    });
  });

  const rows = Array.from(counts.entries())
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);

  if (topN && rows.length > topN) {
    const head = rows.slice(0, topN);
    const tail = rows.slice(topN);
    const otherValue = tail.reduce((sum, r) => sum + r.value, 0);
    return [...head, { name: "Other", value: otherValue }];
  }

  return rows;
}

/**
 * Custom label:
 * - Percentage inside slice
 * - Sector name outside slice
 */
function makeDualLabelRenderer({ showLeaderLine = false, minPercentForLabels = 0.04 }) {
  return function renderDualLabel(props) {
    const { cx, cy, midAngle, outerRadius, percent, name } = props;

    if (typeof percent !== "number" || percent < minPercentForLabels) return null;

    const RADIAN = Math.PI / 180;

    const rInside = outerRadius * 0.6;
    const xInside = cx + rInside * Math.cos(-midAngle * RADIAN);
    const yInside = cy + rInside * Math.sin(-midAngle * RADIAN);

    const rOutside = outerRadius * 1.05;
    const xOutside = cx + rOutside * Math.cos(-midAngle * RADIAN);
    const yOutside = cy + rOutside * Math.sin(-midAngle * RADIAN);

    const textAnchor = xOutside > cx ? "start" : "end";

    const rLineStart = outerRadius * 1.02;
    const xLineStart = cx + rLineStart * Math.cos(-midAngle * RADIAN);
    const yLineStart = cy + rLineStart * Math.sin(-midAngle * RADIAN);

    return (
      <g>
        {showLeaderLine ? (
          <line
            x1={xLineStart}
            y1={yLineStart}
            x2={xOutside}
            y2={yOutside}
            stroke="#9ca3af"
            strokeWidth={1}
          />
        ) : null}

        <text
          x={xInside}
          y={yInside}
          textAnchor="middle"
          dominantBaseline="middle"
          fill="#111827"
          fontSize={12}
          fontWeight={600}
        >
          {Math.round(percent * 100)}%
        </text>

        <text
          x={xOutside}
          y={yOutside}
          textAnchor={textAnchor}
          dominantBaseline="middle"
          fill="#374151"
          fontSize={12}
        >
          {name}
        </text>
      </g>
    );
  };
}

const COLORS = [
  "#9ecae1",
  "#fdae6b",
  "#a1d99b",
  "#fc9272",
  "#bcbddc",
  "#c7e9c0",
  "#fdd0a2",
  "#c6dbef",
  "#d9d9d9",
  "#bdbdbd",
  "#ccebc5",
  "#f2b6cf",
];

export default function UseCaseSectorPie({
  items,
  title = "Distribution of Use Cases by Sector",
  topN = 10,
  showLegend = false,
  showLeaderLine = false,
  minPercentForLabels = 0.04,
  // default responsive height (CSS also enforces a sensible min)
  height = 420,
}) {
  const navigate = useNavigate();

  const data = useMemo(() => buildSectorDistribution(items, topN), [items, topN]);
  const total = useMemo(() => data.reduce((s, r) => s + r.value, 0), [data]);

  const renderDualLabel = useMemo(
    () => makeDualLabelRenderer({ showLeaderLine, minPercentForLabels }),
    [showLeaderLine, minPercentForLabels]
  );

  function goToSector(sector) {
    if (!sector) return;
    if (sector === "Other") return;

    const params = new URLSearchParams();
    params.set("sector", sector);
    navigate(`/library?${params.toString()}`);
  }

  function handleSliceClick(d) {
    const sectorName = d?.name || d?.payload?.name;
    goToSector(sectorName);
  }

  return (
    <section className="ucsp">
      {title ? (
        <div className="ucsp-header">
          <h2 className="ucsp-title">{title}</h2>
          <div className="ucsp-subtitle">Total sector-tags counted: {total}</div>
        </div>
      ) : null}

      <div className="ucsp-chart" style={{ height }}>
        <ResponsiveContainer>
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              // Keep radius responsive: tied to chart height, but with bounds
              outerRadius={Math.min(180, Math.max(110, height * 0.33))}
              labelLine={false}
              label={renderDualLabel}
              onClick={handleSliceClick}
            >
              {data.map((entry, idx) => {
                const clickable = entry?.name !== "Other";
                return (
                  <Cell
                    key={entry.name || idx}
                    fill={COLORS[idx % COLORS.length]}
                    className={clickable ? "ucsp-slice is-clickable" : "ucsp-slice"}
                  />
                );
              })}
            </Pie>

            <Tooltip formatter={(val, name) => [val, name]} contentStyle={{ borderRadius: 10 }} />
            {showLegend ? <Legend /> : null}
          </PieChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
