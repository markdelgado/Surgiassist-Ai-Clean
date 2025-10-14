import { useCallback, useEffect, useState } from "react";
import html2pdf from "html2pdf.js";
import { getPubMedLinks, generateEvidenceBundle } from "../api/api";
import useAppContext from "../hooks/useAppContext";

const MAX_BUNDLE_ARTICLES = 5;

const PubMedSearch = () => {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [relatedSearches, setRelatedSearches] = useState([]);
  const [selectedArticles, setSelectedArticles] = useState({});
  const [bundleData, setBundleData] = useState(null);
  const [bundleLoading, setBundleLoading] = useState(false);
  const [bundleError, setBundleError] = useState("");
  const [bundleGeneratedAt, setBundleGeneratedAt] = useState(null);
  const { noteResult, riskResult } = useAppContext();
  const canDownloadBundle =
    bundleData && Array.isArray(bundleData.articles) && bundleData.articles.length > 0;

  const formatArticleTitle = (url) => {
    try {
      const parsed = new URL(url);
      const slug = decodeURIComponent(parsed.pathname.split("/").filter(Boolean).pop() || "");
      if (!slug) return `Open article on ${parsed.hostname}`;
      const cleaned = slug
        .replace(/[-_]+/g, " ")
        .replace(/\s+/g, " ")
        .trim();
      if (!cleaned) return `Open article on ${parsed.hostname}`;
      return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
    } catch {
      return "Open article";
    }
  };

  const extractDomain = (url) => {
    try {
      return new URL(url).hostname.replace(/^www\./, "");
    } catch {
      return "pubmed.ncbi.nlm.nih.gov";
    }
  };

  const buildRelatedSearches = useCallback((value) => {
      if (!value.trim()) return [];

      const normalized = value.trim().replace(/\s+/g, " ");

      const variants = [
        `${normalized} outcomes`,
        `${normalized} complications`,
        `${normalized} postoperative recovery`,
        `${normalized} risk factors`,
        `${normalized} guidelines`,
        `${normalized} best practices`,
      ];

      const unique = [];
      const seen = new Set();

      for (const item of variants) {
        if (!seen.has(item.toLowerCase())) {
          unique.push(item);
          seen.add(item.toLowerCase());
        }
        if (unique.length === 5) break;
      }

      return unique;
    }, []);

  useEffect(() => {
    setRelatedSearches(buildRelatedSearches(query));
  }, [query, buildRelatedSearches]);

  const normalizeArticles = useCallback((items) => {
    if (!Array.isArray(items)) return [];
    return items.map((item, idx) => {
      if (item && typeof item === "object") {
        const pmid = item.pmid ? String(item.pmid) : "";
        const identifier = pmid || item.url || `article-${idx}`;
        return {
          id: String(identifier),
          pmid,
          title: (item.title ?? "").trim(),
          url: item.url ?? (typeof item === "string" ? item : ""),
          summary: (item.summary ?? "").trim(),
        };
      }

      const url = typeof item === "string" ? item : "";
      return {
        id: `article-${idx}`,
        pmid: "",
        title: "",
        url,
        summary: "",
      };
    });
  }, []);

  const runSearch = async (term) => {
    if (!term.trim()) return;
    setLoading(true);
    try {
      const links = await getPubMedLinks(term);
      const normalized = normalizeArticles(links);
      setResults(normalized);
      setSelectedArticles({});
      setBundleData(null);
      setBundleError("");
      setBundleGeneratedAt(null);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async (e) => {
    e.preventDefault();
    await runSearch(query);
  };

  const handleSuggestionClick = async (term) => {
    setQuery(term);
    await runSearch(term);
  };

  const toggleArticleSelection = (article) => {
    setSelectedArticles((prev) => {
      const alreadySelected = Boolean(prev[article.id]);
      if (!alreadySelected && Object.keys(prev).length >= MAX_BUNDLE_ARTICLES) {
        setBundleError(`Select up to ${MAX_BUNDLE_ARTICLES} articles per bundle.`);
        return prev;
      }

      const next = { ...prev };
      if (alreadySelected) {
        delete next[article.id];
        setBundleError("");
      } else {
        next[article.id] = article;
        setBundleError("");
      }

      return next;
    });
  };

  const selectedList = Object.values(selectedArticles);
  const selectedCount = selectedList.length;

  const computeRiskSummaryLines = () => {
    if (!riskResult || typeof riskResult !== "object") return [];

    const lines = [];
    const percentValue = riskResult.risk_percent;
    const numeric =
      typeof percentValue === "number" ? percentValue : Number(percentValue);
    if (Number.isFinite(numeric)) {
      lines.push(`Risk estimate: ${numeric.toFixed(1)}%`);
    } else if (percentValue) {
      lines.push(`Risk estimate: ${percentValue}`);
    }

    if (riskResult.risk_level) {
      lines.push(`Risk level: ${riskResult.risk_level}`);
    }

    const drivers = Array.isArray(riskResult.key_drivers)
      ? riskResult.key_drivers.filter(Boolean)
      : [];
    if (drivers.length) {
      lines.push(`Key drivers: ${drivers.slice(0, 3).join("; ")}`);
    }

    const optimizations = Array.isArray(riskResult.optimization_steps)
      ? riskResult.optimization_steps.filter(Boolean)
      : [];
    if (optimizations.length) {
      lines.push(`Optimization focus: ${optimizations.slice(0, 2).join("; ")}`);
    }

    return lines;
  };

  const riskSummaryLines = computeRiskSummaryLines();

  const buildCaseContext = () => {
    const segments = [];
    if (noteResult && noteResult.trim()) {
      segments.push(`Pre-op note:\n${noteResult.trim()}`);
    }

    if (riskSummaryLines.length) {
      segments.push(`Risk snapshot:\n${riskSummaryLines.join("\n")}`);
    }

    return segments.join("\n\n").trim();
  };

  const handleGenerateBundle = async () => {
    if (!selectedCount || bundleLoading) return;
    setBundleLoading(true);
    setBundleError("");

    try {
      const payload = {
        case_context: buildCaseContext() || null,
        articles: selectedList.map((article) => ({
          pmid: article.pmid,
          title: article.title,
          summary: article.summary,
        })),
      };

      const data = await generateEvidenceBundle(payload);
      if (!data || !Array.isArray(data.articles) || data.articles.length === 0) {
        setBundleError("The evidence bundle did not return any summaries. Adjust your selection and try again.");
        setBundleData(null);
        setBundleGeneratedAt(null);
        return;
      }

      setBundleData(data);
      setBundleGeneratedAt(new Date());
    } catch (err) {
      console.error("Error generating evidence bundle:", err);
      setBundleError("Could not generate evidence bundle. Please try again.");
      setBundleData(null);
      setBundleGeneratedAt(null);
    } finally {
      setBundleLoading(false);
    }
  };

  const exportEvidenceBundlePDF = () => {
    if (!bundleData) return;
    const element = document.getElementById("evidence-bundle-pdf");
    if (!element) return;

    const options = {
      margin: 0.5,
      filename: "evidence-bundle.pdf",
      image: { type: "jpeg", quality: 0.98 },
      html2canvas: {
        scale: 2,
        backgroundColor: "#ffffff",
        scrollY: -window.scrollY,
      },
      jsPDF: { unit: "in", format: "letter", orientation: "portrait" },
    };

    const prevStyles = {
      background: element.style.background,
      color: element.style.color,
      boxShadow: element.style.boxShadow,
      maxHeight: element.style.maxHeight,
      overflow: element.style.overflow,
    };

    element.style.background = "#ffffff";
    element.style.color = "#0f172a";
    element.style.boxShadow = "none";
    element.style.maxHeight = "none";
    element.style.overflow = "visible";

    html2pdf()
      .set(options)
      .from(element)
      .save()
      .catch((error) => {
        console.error("Error exporting evidence bundle PDF", error);
      })
      .finally(() => {
        element.style.background = prevStyles.background;
        element.style.color = prevStyles.color;
        element.style.boxShadow = prevStyles.boxShadow;
        element.style.maxHeight = prevStyles.maxHeight;
        element.style.overflow = prevStyles.overflow;
      });
  };

  return (
    <section className="section-card" aria-labelledby="pubmed-search-title">
      <div className="section-card__header">
        <div className="section-card__icon" aria-hidden>
          🔍
        </div>
        <div>
          <h2 id="pubmed-search-title" className="section-card__title">
            PubMed literature finder
          </h2>
          <p className="section-card__subtitle">
            Surface the latest evidence tailored to your case with one click.
          </p>
        </div>
      </div>

      <form onSubmit={handleSearch} className="search-bar" aria-label="Search PubMed">
        <input
          type="text"
          required
          placeholder="e.g. laparoscopic cholecystectomy complications"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <button type="submit" className="button button--primary" disabled={loading}>
          {loading ? "Searching…" : "Search"}
        </button>
      </form>

      {results.length > 0 && (
        <div className="result-panel result-panel--list" aria-live="polite">
          <div className="result-panel__header">
            <h3 className="result-panel__title">Related articles</h3>
            <span className="result-panel__meta" aria-live="off">
              {selectedCount} selected
            </span>
          </div>

          <div className="bundle-toolbar">
            <div className="bundle-toolbar__info">
              <span>Select articles to assemble an evidence bundle.</span>
              {!noteResult?.trim() && !riskSummaryLines.length && (
                <span className="bundle-toolbar__hint">
                  Add a generated note or risk estimate to enrich the bundle context.
                </span>
              )}
            </div>
            <div className="bundle-toolbar__actions">
              <button
                type="button"
                className="button button--secondary"
                onClick={handleGenerateBundle}
                disabled={!selectedCount || bundleLoading}
              >
                {bundleLoading ? "Generating…" : "Generate bundle"}
              </button>
              <button
                type="button"
                className="button button--ghost"
                onClick={exportEvidenceBundlePDF}
                disabled={!canDownloadBundle}
              >
                Download bundle PDF
              </button>
            </div>
          </div>

          <ul className="result-list">
            {results.map((article) => {
              if (!article.url) return null;

              const formattedTitle =
                article.title?.trim() || formatArticleTitle(article.url);
              const tooltip =
                formattedTitle.length > 120
                  ? `${formattedTitle.slice(0, 118)}…`
                  : formattedTitle;
              const summaryText = article.summary;
              const isSelected = Boolean(selectedArticles[article.id]);

              return (
                <li
                  key={article.id}
                  className={`result-list__item${isSelected ? " result-list__item--selected" : ""}`}
                >
                  <div className="result-list__row">
                    <input
                      type="checkbox"
                      className="result-list__selector"
                      checked={isSelected}
                      onChange={() => toggleArticleSelection(article)}
                      aria-label={`${isSelected ? "Deselect" : "Select"} ${formattedTitle}`}
                    />
                    <a
                      href={article.url}
                      target="_blank"
                      rel="noreferrer"
                      title={tooltip}
                      className="result-list__link"
                    >
                      <span className="result-list__title">{formattedTitle}</span>
                      <span className="result-list__domain">{extractDomain(article.url)}</span>
                      {summaryText && (
                        <span className="result-list__summary">{summaryText}</span>
                      )}
                      {article.pmid && (
                        <span className="result-list__pmid">PMID: {article.pmid}</span>
                      )}
                    </a>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {bundleError && (
        <div className="result-panel" role="alert">
          <div className="result-panel__body">
            <p>{bundleError}</p>
          </div>
        </div>
      )}

      {canDownloadBundle && bundleData && (
        <div className="result-panel" aria-live="polite">
          <div className="result-panel__header">
            <h3 className="result-panel__title">Evidence bundle summary</h3>
            <button onClick={exportEvidenceBundlePDF} className="button button--ghost">
              Download PDF
            </button>
          </div>
          <div id="evidence-bundle-pdf" className="result-panel__body evidence-bundle">
            {noteResult?.trim() && (
              <section className="evidence-bundle__section">
                <h4>Pre-op note</h4>
                <pre>{noteResult}</pre>
              </section>
            )}

            {riskSummaryLines.length > 0 && (
              <section className="evidence-bundle__section">
                <h4>Risk snapshot</h4>
                <ul>
                  {riskSummaryLines.map((line, idx) => (
                    <li key={`risk-line-${idx}`}>{line}</li>
                  ))}
                </ul>
              </section>
            )}

            <section className="evidence-bundle__section">
              <h4>Literature overview</h4>
              {bundleData.overview && <p>{bundleData.overview}</p>}

              <div className="evidence-bundle__articles">
                {bundleData.articles.map((article, idx) => {
                  const key = article.pmid || `${article.title}-${idx}`;
                  const takeaways = Array.isArray(article.key_takeaways)
                    ? article.key_takeaways.filter(Boolean)
                    : [];
                  return (
                    <article key={key} className="evidence-bundle__article">
                      <h5>{article.title || `PMID ${article.pmid || "unknown"}`}</h5>
                      {article.pmid && <p className="evidence-bundle__pmid">PMID: {article.pmid}</p>}
                      {takeaways.length > 0 && (
                        <ul>
                          {takeaways.map((point, pointIdx) => (
                            <li key={`takeaway-${key}-${pointIdx}`}>{point}</li>
                          ))}
                        </ul>
                      )}
                      {article.clinical_application && (
                        <p className="evidence-bundle__application">{article.clinical_application}</p>
                      )}
                    </article>
                  );
                })}
              </div>
            </section>

            {bundleGeneratedAt && (
              <p className="evidence-bundle__timestamp">
                Generated {bundleGeneratedAt.toLocaleString()}
              </p>
            )}
          </div>
        </div>
      )}

      {relatedSearches.length > 0 && (
        <div className="related-searches" aria-label="Suggested related searches">
          <p className="related-searches__title">People also search for</p>
          <div className="chip-group">
            {relatedSearches.map((term) => (
              <button
                type="button"
                key={term}
                className="chip"
                onClick={() => handleSuggestionClick(term)}
                disabled={loading}
              >
                {term}
              </button>
            ))}
          </div>
        </div>
      )}
    </section>
  );
};

export default PubMedSearch;
