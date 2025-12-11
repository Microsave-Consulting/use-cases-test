// src/UseCaseLibrary.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import populationData from "country-json/src/country-by-population.json";
import countries from "i18n-iso-countries";
import enLocale from "i18n-iso-countries/langs/en.json";

countries.registerLocale(enLocale);

const CASES_URL = import.meta.env.BASE_URL + "data/use_cases.json";
const CONFIG_URL = import.meta.env.BASE_URL + "data/filter_config.json";

// Split "A, B, C" → ["A", "B", "C"]
function splitValues(value) {
  if (!value) return [];
  return String(value)
    .split(",")
    .map((v) => v.trim())
    .filter((v) => v.length > 0);
}

/* =======================
   Population helpers
   ======================= */

// Build a lookup: country name (lowercased) -> population (number)
const POPULATION_MAP = (() => {
  const map = new Map();
  populationData.forEach((row) => {
    if (!row || !row.country) return;
    map.set(String(row.country).toLowerCase(), Number(row.population));
  });
  return map;
})();

// Aliases only for population matching if needed
const COUNTRY_ALIASES = {
  rawanda: "rwanda",
};

function normalizeCountryName(name) {
  if (!name) return null;
  const trimmed = name.trim();
  const key = trimmed.toLowerCase();
  if (COUNTRY_ALIASES[key]) return COUNTRY_ALIASES[key];
  return trimmed;
}

function getPopulationForCountryName(name) {
  const normalized = normalizeCountryName(name);
  if (!normalized) return null;
  const key = normalized.toLowerCase();
  return POPULATION_MAP.get(key) ?? null;
}

function getPopulationForUseCase(uc) {
  const countriesList = splitValues(uc.Country);
  if (countriesList.length === 0) return null;
  // Use the first country for multi-country entries
  return getPopulationForCountryName(countriesList[0]);
}

function formatPopulation(pop) {
  if (typeof pop !== "number" || Number.isNaN(pop)) return null;
  if (pop >= 1_000_000_000) return (pop / 1_000_000_000).toFixed(1) + "B";
  if (pop >= 1_000_000) return (pop / 1_000_000).toFixed(1) + "M";
  if (pop >= 1_000) return (pop / 1_000).toFixed(1) + "k";
  return String(pop);
}

/* =======================
   Normalisation for label matching
   ======================= */

function normalizeCountryLabelForMatch(label) {
  if (!label) return "";
  let s = String(label).trim().toLowerCase();

  // Remove most punctuation
  s = s.replace(/[^a-z0-9\s]/g, " ");

  // Collapse multiple spaces
  s = s.replace(/\s+/g, " ").trim();

  return s;
}

/* =======================
   Filter pill + dropdown
   ======================= */

function FilterBubble({
  id,
  label,
  options,
  selectedValues,
  onChange,
  primary,
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  // click–outside to close
  useEffect(() => {
    function handleClickOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const hasSelection = selectedValues && selectedValues.length > 0;

  const summary = useMemo(() => {
    if (!hasSelection) return "All";
    if (selectedValues.length === 1) return selectedValues[0];
    if (selectedValues.length === 2) {
      return `${selectedValues[0]}, ${selectedValues[1]}`;
    }
    return `${selectedValues[0]}, ${selectedValues[1]} +${
      selectedValues.length - 2
    }`;
  }, [selectedValues, hasSelection]);

  const toggleValue = (value) => {
    if (!value) return;
    const arr = selectedValues || [];
    if (arr.includes(value)) {
      onChange(arr.filter((v) => v !== value));
    } else {
      onChange([...arr, value]);
    }
  };

  return (
    <div className="ucl-filter-bubble-wrapper" ref={ref}>
      <button
        type="button"
        className={
          "ucl-filter-bubble " +
          (primary ? "ucl-filter-bubble-primary" : "ucl-filter-bubble-secondary")
        }
        onClick={() => setOpen((o) => !o)}
      >
        <span className="ucl-filter-label">{label}</span>
        <span className="ucl-filter-summary">{summary}</span>
        <span className="ucl-filter-chevron">{open ? "▼" : "▼"}</span>
      </button>

      {open && (
        <div className="ucl-filter-dropdown">
          {(!options || options.length === 0) && (
            <div className="ucl-filter-empty">No options</div>
          )}
          {(options || []).map((value) => {
            const active = selectedValues?.includes(value);
            return (
              <div
                key={value}
                className={
                  "ucl-filter-option " +
                  (active ? "ucl-filter-option-active" : "")
                }
                onClick={() => toggleValue(value)}
              >
                <span className="ucl-filter-checkbox">
                  {active ? "✓" : ""}
                </span>
                <span className="ucl-filter-option-label">{value}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* =======================
   Card component
   ======================= */

function UseCaseCard({ uc }) {
  const sectors = splitValues(uc.Sectors);
  const accessibility = splitValues(uc.Accessibility);
  const authModalities = splitValues(uc.AuthModalities);
  const assurance = splitValues(uc.AssuranceLevels);

  const primarySector = sectors[0] || "—";

  const regionText = uc.Region
    ? uc.Subregion
      ? `${uc.Region} — ${uc.Subregion}`
      : uc.Region
    : uc.Subregion || "—";

  const description =
    (uc.Remarks && uc.Remarks.trim().length > 0 && uc.Remarks) ||
    (uc.KeyTerms && uc.KeyTerms.trim().length > 0 && uc.KeyTerms) ||
    "";

  const countriesList = splitValues(uc.Country);
  const primaryCountry = countriesList[0] || uc.Country || "Unknown country";

  const population = getPopulationForUseCase(uc);
  const populationText = population
    ? `Population (approx): ${formatPopulation(population)}`
    : null;

  return (
    <div className="ucl-card">
      <div className="ucl-card-header">
        <div className="ucl-card-title">{uc.Title || "Untitled use case"}</div>

        <div className="ucl-card-meta">
          <span>{primaryCountry}</span>
          <span>•</span>
          <span>{primarySector}</span>
          <span>•</span>
          <span>{uc.MaturityLevel || "Unknown maturity"}</span>
        </div>

        <div className="ucl-card-meta-sub">Region: {regionText}</div>

        {populationText && (
          <div className="ucl-card-meta-sub">{populationText}</div>
        )}
      </div>

      {description && (
        <div className="ucl-card-body">
          {description.length > 260
            ? description.slice(0, 260) + "…"
            : description}
        </div>
      )}

      <div className="ucl-card-tags">
        {accessibility.map((tag) => (
          <span key={`acc-${tag}`} className="ucl-tag-pill">
            {tag}
          </span>
        ))}
        {authModalities.map((tag) => (
          <span key={`auth-${tag}`} className="ucl-tag-pill">
            {tag}
          </span>
        ))}
        {assurance.map((tag) => (
          <span key={`ass-${tag}`} className="ucl-tag-pill">
            {tag}
          </span>
        ))}
      </div>
    </div>
  );
}

/* =======================
   Main page component
   ======================= */

export default function UseCaseLibrary() {
  const [rawItems, setRawItems] = useState([]);
  const [filterConfig, setFilterConfig] = useState([]);
  const [filters, setFilters] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");

  const [searchParams] = useSearchParams();

  // Load JSON data + filter config
  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        setError(null);

        const [casesRes, configRes] = await Promise.all([
          fetch(CASES_URL),
          fetch(CONFIG_URL),
        ]);

        if (!casesRes.ok) throw new Error(`Cases HTTP ${casesRes.status}`);
        if (!configRes.ok) throw new Error(`Config HTTP ${configRes.status}`);

        const casesData = await casesRes.json();
        const cfgData = await configRes.json();

        const safeCases = Array.isArray(casesData) ? casesData : [];
        const safeCfg = Array.isArray(cfgData) ? cfgData : [];

        setRawItems(safeCases);
        setFilterConfig(safeCfg);

        // Initialise filters from config
        const initialFilters = {};
        safeCfg.forEach((f) => {
          if (f && f.id) initialFilters[f.id] = [];
        });
        setFilters(initialFilters);
      } catch (e) {
        setError(e.message || "Unknown error");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const useCases = useMemo(() => rawItems || [], [rawItems]);

  // Build filter options from data + config
  const filterOptions = useMemo(() => {
    if (!filterConfig.length) return {};

    const map = {};
    filterConfig.forEach((f) => {
      map[f.id] = new Set();
    });

    useCases.forEach((uc) => {
      filterConfig.forEach((f) => {
        if (!f || !f.id) return;

        if (f.usesSubregion) {
          const r = uc.Region || "";
          const s = uc.Subregion || "";
          const combined = r && s ? `${r} — ${s}` : r || s;
          if (combined) map[f.id].add(combined);
          return;
        }

        const raw = uc[f.field];
        if (!raw) return;

        if (f.multiValue) {
          splitValues(raw).forEach((v) => map[f.id].add(v));
        } else {
          map[f.id].add(raw);
        }
      });
    });

    const final = {};
    Object.keys(map).forEach((id) => {
      final[id] = Array.from(map[id]).sort((a, b) =>
        String(a).localeCompare(String(b))
      );
    });
    return final;
  }, [useCases, filterConfig]);

  // 🔑 Apply / re-apply country filter whenever ?country=<name> changes
  useEffect(() => {
    if (!filterConfig.length) return;

    const countryParam = searchParams.get("country");
    if (!countryParam) {
      // No country in URL – do not force anything
      return;
    }

    // Find the Country filter config
    const countryFilter = filterConfig.find((f) => f.field === "Country");
    if (!countryFilter) return;

    const optionsForCountry = filterOptions[countryFilter.id] || [];
    if (!optionsForCountry.length) {
      // Options not ready yet – wait for filterOptions to populate
      return;
    }

    const targetNorm = normalizeCountryLabelForMatch(countryParam);

    const match =
      optionsForCountry.find(
        (opt) => normalizeCountryLabelForMatch(opt) === targetNorm
      ) || null;

    if (!match) return;

    // Only update state if the selection is actually changing
    setFilters((prev) => {
      const current = prev[countryFilter.id] || [];
      if (current.length === 1 && current[0] === match) {
        return prev; // no change, avoid extra re-renders
      }
      return {
        ...prev,
        [countryFilter.id]: [match],
      };
    });
  }, [filterConfig, filterOptions, searchParams]);

  const updateFilter = (id, values) => {
    setFilters((prev) => ({
      ...prev,
      [id]: values,
    }));
  };

  const clearAll = () => {
    const cleared = {};
    filterConfig.forEach((f) => {
      if (f && f.id) cleared[f.id] = [];
    });
    setFilters(cleared);
    setSearch("");
  };

  // Apply search + filters
  const filtered = useMemo(() => {
    if (!filterConfig.length) return useCases;

    return useCases.filter((uc) => {
      // text search
      if (search.trim()) {
        const haystack = [
          uc.Title,
          uc.Country,
          uc.Sectors,
          uc.KeyTerms,
          uc.Remarks,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        if (!haystack.includes(search.toLowerCase())) {
          return false;
        }
      }

      // filters: AND across filters, OR within each
      return filterConfig.every((f) => {
        if (!f || !f.id) return true;

        const selected = filters[f.id];
        if (!selected || selected.length === 0) return true;

        if (f.usesSubregion) {
          const r = uc.Region || "";
          const s = uc.Subregion || "";
          const combined = r && s ? `${r} — ${s}` : r || s;
          if (!combined) return false;
          return selected.includes(combined);
        }

        const raw = uc[f.field];
        if (!raw) return false;

        const values = f.multiValue ? splitValues(raw) : [raw];
        return selected.some((v) => values.includes(v));
      });
    });
  }, [useCases, search, filters, filterConfig]);

  if (loading) {
    return <div className="ucl-page ucl-page-center">Loading use cases…</div>;
  }

  if (error) {
    return (
      <div className="ucl-page ucl-page-center">
        <p>Failed to load use cases: {error}</p>
        <button className="ucl-btn" onClick={() => window.location.reload()}>
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="ucl-page">
      <header className="ucl-header">
        <div>
          <h1 className="ucl-title">Explore Digital ID use cases</h1>
          <p className="ucl-subtitle">
            Search, filter, and browse real-world digital ID use cases.
          </p>
        </div>
      </header>

      {/* Search + filters */}
      <section className="ucl-filter-bar">
        <div className="ucl-search-wrapper">
          <div className="ucl-search-bar">
            <span className="ucl-search-icon" aria-hidden="true">
              🔍
            </span>
            <input
              className="ucl-search-input"
              type="text"
              placeholder="Search use cases"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <button
              type="button"
              className="ucl-search-submit"
              aria-label="Search"
            >
              ➜
            </button>
          </div>
        </div>

        {filterConfig.length > 0 && (
          <div className="ucl-filters-wrapper">
            {filterConfig.map((f, index) => (
              <FilterBubble
                key={f.id}
                id={f.id}
                label={f.label}
                options={filterOptions[f.id] || []}
                selectedValues={filters[f.id] || []}
                onChange={(vals) => updateFilter(f.id, vals)}
                primary={index < 3} // first three as primary style
              />
            ))}
            <button
              type="button"
              className="ucl-clear-filters"
              onClick={clearAll}
            >
              Clear all
            </button>
          </div>
        )}
      </section>

      <div className="ucl-results-summary">
        Showing {filtered.length} of {useCases.length} use cases
      </div>

      {filtered.length === 0 ? (
        <div className="ucl-empty-state">
          <p>No use cases match your search and filters.</p>
          <button className="ucl-btn" onClick={clearAll}>
            Clear filters
          </button>
        </div>
      ) : (
        <section className="ucl-cards-grid">
          {filtered.map((uc, idx) => (
            <UseCaseCard key={uc.ID ?? uc.Id ?? idx} uc={uc} />
          ))}
        </section>
      )}
    </div>
  );
}
