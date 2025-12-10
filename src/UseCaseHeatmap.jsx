import { useMemo } from "react";
import { WorldMap } from "react-svg-worldmap";
import countries from "i18n-iso-countries";
import enLocale from "i18n-iso-countries/langs/en.json";

// Register English names → ISO codes
countries.registerLocale(enLocale);

// Reuse your “A, B, C” → ["A","B","C"] logic
function splitValues(value) {
  if (!value) return [];
  return String(value)
    .split(",")
    .map((v) => v.trim())
    .filter((v) => v.length > 0);
}

export default function UseCaseHeatmap({ items }) {
  // Build [{ country: "in", value: 5 }, ...] from items
  const data = useMemo(() => {
    const countsByCode = {};

    items.forEach((row) => {
      const countriesRaw = row.Country; // uses your "Country" column
      const names = splitValues(countriesRaw);

      names.forEach((nameRaw) => {
        let name = nameRaw.trim();
        if (!name) return;

        const lower = name.toLowerCase();

        // Optional normalisations
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
        if (!iso2) {
          console.warn("No ISO alpha-2 code for country name:", name);
          return;
        }

        const code = iso2.toLowerCase(); // react-svg-worldmap wants lower-case
        countsByCode[code] = (countsByCode[code] || 0) + 1;
      });
    });

    return Object.entries(countsByCode).map(([country, value]) => ({
      country,
      value,
    }));
  }, [items]);

  const stylingFunction = (context) => {
    const { countryValue, minValue, maxValue, color } = context;

    // Countries with no data → light grey
    if (!countryValue) {
      return {
        fill: "#f2f2f2",
        stroke: "#cccccc",
        strokeWidth: 0.5,
      };
    }

    const range = maxValue - minValue || 1;
    const ratio = (countryValue - minValue) / range; // 0–1

    return {
      fill: color,
      fillOpacity: 0.2 + ratio * 0.8, // more cases → darker
      stroke: "#333",
      strokeWidth: 0.3,
      cursor: "pointer",
    };
  };

  // ✅ FIXED: tooltipTextFunction now takes a single context object
  const tooltipTextFunction = (context) => {
    const { countryName, countryValue } = context;
    const count = Number(countryValue) || 0;
    return `${countryName}: ${count} use case${count === 1 ? "" : "s"}`;
  };

  // onClickFunction also receives a single context object
  const onClickFunction = (context) => {
    const { countryName, countryCode, countryValue } = context;
    console.log(
      `Clicked ${countryName} (${countryCode}) – ${countryValue} use cases`
    );
  };

  if (!items.length) return <p style={{ padding: "1rem" }}>No data for map.</p>;

  return (
    <div style={{ padding: "1rem" }}>
      <h2>Use-case Heatmap</h2>
      <div style={{ width: "100%", height: "auto" }}>
        <WorldMap
          data={data}
          size="responsive"
          color="#0066ff"
          title=""
          valueSuffix=" use cases"
          tooltipTextFunction={tooltipTextFunction}
          styleFunction={stylingFunction}
          onClickFunction={onClickFunction}
        />
      </div>
    </div>
  );
}
