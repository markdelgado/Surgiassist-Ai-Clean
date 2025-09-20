import { useState } from "react";
import { getPubMedLinks } from "../api/api";

const PubMedSearch = () => {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);

  const handleSearch = async (e) => {
    e.preventDefault();
    setLoading(true);
    const links = await getPubMedLinks(query);
    setResults(links);
    setLoading(false);
  };

  return (
    <div className="max-w-xl mx-auto p-4 mt-16">
      <h2 className="text-2xl font-semibold mb-4">🔍 PubMed Literature Finder</h2>
      <form onSubmit={handleSearch} className="flex space-x-2">
        <input
          type="text"
          required
          placeholder="e.g. laparoscopic cholecystectomy complications"
          className="w-full border rounded p-2"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <button
          type="submit"
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
          disabled={loading}
        >
          {loading ? "Searching..." : "Search"}
        </button>
      </form>

      {results.length > 0 && (
        <div className="mt-6">
          <h3 className="text-xl font-semibold mb-2">🧬 Related Articles:</h3>
          <ul className="space-y-2 list-disc list-inside">
            {results.map((url, idx) => (
              <li key={idx}>
                <a href={url} target="_blank" rel="noreferrer" className="text-blue-700 underline">
                  {url}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default PubMedSearch;