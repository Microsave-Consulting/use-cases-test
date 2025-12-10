import { useEffect, useState } from "react";
import UseCaseHeatmap from "./UseCaseHeatmap";

const API_URL = import.meta.env.BASE_URL + "data/use_cases.json";

export default function MapPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

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

  if (loading) return <div style={{ padding: "1rem" }}>Loading map…</div>;
  if (error) return <div style={{ padding: "1rem" }}>Error: {error}</div>;

  return <UseCaseHeatmap items={items} />;
}
