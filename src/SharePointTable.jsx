import { useEffect, useState, useMemo } from "react";

// ⬇️ Your Azure Function URL
const API_URL =
  "https://test-sp122-g0hbb0aad4cpeuba.canadacentral-01.azurewebsites.net/api/get-usecase-data";

// Columns to show in table
const VISIBLE_COLUMNS = [
  "Title",
  "Region",
  "Country",
  "Sectors",
  "Subregion",
  "MaturityLevel",
  "AuthModalities",
  "Accessibility",
  "KeyTerms",
  "AssuranceLevels",
  "FundedBy",
  "Remarks",
];

// Columns that get filters (checkboxes)
const FILTER_COLUMNS = [
  "Region",
  "Country",
  "Sectors",
  "Subregion",
  "MaturityLevel",
  "AuthModalities",
  "Accessibility",
  "KeyTerms",
  "AssuranceLevels",
];

// Helper: split “A, B, C” into ["A","B","C"]
function splitValues(value) {
  if (!value) return [];
  return value
    .split(",")
    .map((v) => v.trim())
    .filter((v) => v.length > 0);
}

export default function SharePointTable() {
  const [items, setItems] = useState([]);
  const [filters, setFilters] = useState({}); // {col: [selectedVals]}
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Load data from API
  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        const res = await fetch(API_URL);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        setItems(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  // Build dynamic checkbox options
  const filterOptions = useMemo(() => {
    const map = {};

    FILTER_COLUMNS.forEach((col) => {
      map[col] = new Set();
    });

    items.forEach((row) => {
      FILTER_COLUMNS.forEach((col) => {
        const raw = row[col];
        const values = splitValues(raw); // <— HERE!
        values.forEach((v) => map[col].add(v));
      });
    });

    // Convert sets → sorted arrays
    const final = {};
    Object.keys(map).forEach((col) => {
      final[col] = Array.from(map[col]).sort();
    });
    return final;
  }, [items]);

  // Toggle checkbox
  const toggleValue = (col, value) => {
    setFilters((prev) => {
      const selected = prev[col] || [];
      const exists = selected.includes(value);
      const next = exists
        ? selected.filter((v) => v !== value)
        : [...selected, value];
      return { ...prev, [col]: next };
    });
  };

  // Apply filtering
  const filteredItems = useMemo(() => {
    return items.filter((row) =>
      FILTER_COLUMNS.every((col) => {
        const selectedValues = filters[col];
        if (!selectedValues || selectedValues.length === 0) return true;

        const rowValues = splitValues(row[col]); // split row data too

        // Keep row if ANY selected value matches ANY row value
        return selectedValues.some((v) => rowValues.includes(v));
      })
    );
  }, [items, filters]);

  if (loading) return <div>Loading…</div>;
  if (error) return <div>Error: {error}</div>;
  if (!items.length) return <div>No data.</div>;

  return (
    <div style={{ padding: "1rem" }}>
      <h2>Use-case Library</h2>

      {/* Checkbox Filters */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(auto-fit, minmax(220px, 1fr))`,
          gap: "1rem",
        }}
      >
        {FILTER_COLUMNS.map((col) => (
          <div
            key={col}
            style={{
              border: "1px solid #ddd",
              padding: "0.5rem",
              borderRadius: "4px",
              maxHeight: "250px",
              overflowY: "auto",
            }}
          >
            <strong style={{ fontSize: "0.9rem" }}>{col}</strong>
            {(filterOptions[col] || []).map((value) => (
              <label
                key={value}
                style={{ display: "block", margin: "3px 0", fontSize: "0.8rem" }}
              >
                <input
                  type="checkbox"
                  checked={filters[col]?.includes(value) || false}
                  onChange={() => toggleValue(col, value)}
                  style={{ marginRight: "0.3rem" }}
                />
                {value}
              </label>
            ))}
          </div>
        ))}
      </div>

      {/* Table */}
      <table
        style={{
          width: "100%",
          marginTop: "1rem",
          borderCollapse: "collapse",
          fontSize: "0.9rem",
        }}
      >
        <thead>
          <tr>
            {VISIBLE_COLUMNS.map((col) => (
              <th
                key={col}
                style={{
                  border: "1px solid #bbb",
                  padding: "0.5rem",
                  background: "#f7f7f7",
                }}
              >
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {filteredItems.map((row, idx) => (
            <tr key={idx}>
              {VISIBLE_COLUMNS.map((col) => (
                <td
                  key={col}
                  style={{ border: "1px solid #eee", padding: "0.5rem" }}
                >
                  {row[col] ?? ""}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      <p style={{ marginTop: "0.5rem", fontSize: "0.8rem" }}>
        Showing {filteredItems.length} / {items.length}
      </p>
    </div>
  );
}
