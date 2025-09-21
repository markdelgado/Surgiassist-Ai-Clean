import { useCallback, useEffect, useState } from "react";
import { getPubMedLinks } from "../api/api";

const PubMedSearch = () => {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [relatedSearches, setRelatedSearches] = useState([]);

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

  const runSearch = async (term) => {
    if (!term.trim()) return;
    setLoading(true);
    const links = await getPubMedLinks(term);
    setResults(links);
    setLoading(false);
  };

  const handleSearch = async (e) => {
    e.preventDefault();
    await runSearch(query);
  };

  const handleSuggestionClick = async (term) => {
    setQuery(term);
    await runSearch(term);
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
          </div>
          <ul className="result-list">
            {results.map((item, idx) => {
              const link = typeof item === "string" ? item : item?.url;
              if (!link) return null;

              const titleSource =
                typeof item === "string" ? undefined : item?.title;
              const formattedTitle = titleSource?.trim() || formatArticleTitle(link);
              const tooltip =
                formattedTitle.length > 120
                  ? `${formattedTitle.slice(0, 118)}…`
                  : formattedTitle;

              return (
                <li key={`${idx}-${link}`}>
                  <a
                    href={link}
                    target="_blank"
                    rel="noreferrer"
                    title={tooltip}
                    className="result-list__link"
                  >
                    <span className="result-list__title">{formattedTitle}</span>
                    <span className="result-list__domain">{extractDomain(link)}</span>
                  </a>
                </li>
              );
            })}
          </ul>
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
