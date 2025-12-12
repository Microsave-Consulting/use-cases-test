import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import "./UseCaseDetail.css";

const CASES_URL = import.meta.env.BASE_URL + "data/use_cases.json";

function splitValues(value) {
  if (!value) return [];
  return String(value)
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
}

function getHeroImage(u) {
  // Prefer explicit cover image, otherwise first in Images array
  return u?.CoverImage || (Array.isArray(u?.Images) ? u.Images[0] : null) || null;
}

function toAbsAssetUrl(maybeRelativeUrl) {
  if (!maybeRelativeUrl) return null;
  // If already absolute, keep it
  if (/^https?:\/\//i.test(maybeRelativeUrl)) return maybeRelativeUrl;
  // Ensure it works on GitHub Pages with BASE_URL
  const base = import.meta.env.BASE_URL || "/";
  return base.replace(/\/$/, "") + "/" + String(maybeRelativeUrl).replace(/^\//, "");
}

export default function UseCaseDetail() {
  const { id } = useParams(); // expecting /use-cases/:id
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        const res = await fetch(CASES_URL, { cache: "no-store" });
        const data = await res.json();
        if (alive) setRows(Array.isArray(data) ? data : []);
      } catch {
        if (alive) setRows([]);
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  const useCase = useMemo(() => {
    if (!id) return null;

    // Your JSON has both Id and ID; treat either as valid
    const match =
      rows.find((u) => String(u?.Id) === String(id)) ||
      rows.find((u) => String(u?.ID) === String(id));

    return match || null;
  }, [rows, id]);

  if (loading) {
    return (
      <div className="ucd-page ucd-page-center">
        <div className="ucd-loading">Loading…</div>
      </div>
    );
  }

  if (!useCase) {
    return (
      <div className="ucd-page ucd-page-center">
        <h2 className="ucd-notfound-title">Use case not found</h2>
        <p className="ucd-notfound-subtitle">
          The link may be broken, or the item was removed.
        </p>
        <Link className="ucd-btn" to="/use-case-library">
          Back to Use Case Library
        </Link>
      </div>
    );
  }

  const title = useCase.Title || "Use case";
  const description = useCase.Remarks || "";
  const heroImg = toAbsAssetUrl(getHeroImage(useCase));

  const region = useCase.Region || "—";
  const subregion = useCase.Subregion || "";
  const country = useCase.Country || "—";
  const accessibility = useCase.Accessibility || "—";
  const assurance = useCase.AssuranceLevels || "—";

  const keyTerms = splitValues(useCase.KeyTerms);

  return (
    <div className="ucd-page">
      {/* Breadcrumb */}
      <nav className="ucd-breadcrumb">
        <Link to="/library">Use case library</Link>
        <span className="ucd-crumb-sep">›</span>
        <span className="ucd-crumb-current">{title}</span>
      </nav>

      {/* Hero */}
      <section className="ucd-hero">
        <div className="ucd-hero-card">
          <div className="ucd-hero-media">
            {heroImg ? (
              <img className="ucd-hero-img" src={heroImg} alt="" />
            ) : (
              <div className="ucd-hero-img ucd-hero-fallback" />
            )}
            <div className="ucd-hero-overlay" />
            <h1 className="ucd-hero-title">{title}</h1>
          </div>
        </div>

        {/* Meta strip */}
        <div className="ucd-meta">
          <div className="ucd-meta-row">
            <div className="ucd-meta-item">
              <span className="ucd-meta-label">Region:</span>
              <span className="ucd-meta-value">
                {region}
                {subregion ? `; ${subregion}` : ""}
              </span>
            </div>

            <div className="ucd-meta-divider" />

            <div className="ucd-meta-item">
              <span className="ucd-meta-label">Country:</span>
              <span className="ucd-meta-value">{country}</span>
            </div>

            <div className="ucd-meta-divider" />

            <div className="ucd-meta-item">
              <span className="ucd-meta-label">Accessibility:</span>
              <span className="ucd-meta-value">{accessibility}</span>
            </div>

            <div className="ucd-meta-divider" />

            <div className="ucd-meta-item">
              <span className="ucd-meta-label">Assurance levels:</span>
              <span className="ucd-meta-value">{assurance}</span>
            </div>
          </div>
        </div>
      </section>

      {/* Body */}
      <main className="ucd-body">
        <section className="ucd-section">
          <h2 className="ucd-h2">Description</h2>
          {description ? (
            <div className="ucd-description">
              {String(description)
                .split(/\n\s*\n/)
                .map((p, idx) => (
                  <p key={idx}>{p.trim()}</p>
                ))}
            </div>
          ) : (
            <p className="ucd-muted">No description available.</p>
          )}
        </section>

        <section className="ucd-section">
          <h2 className="ucd-h2">Key terms</h2>
          {keyTerms.length ? (
            <div className="ucd-pill-row">
              {keyTerms.map((t) => (
                <span key={t} className="ucd-pill">
                  {t}
                </span>
              ))}
            </div>
          ) : (
            <p className="ucd-muted">No key terms listed.</p>
          )}
        </section>
      </main>
    </div>
  );
}
