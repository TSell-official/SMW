import React, { useState } from "react";
import "@/App.css";
import { Search, Sparkles, Loader2 } from "lucide-react";
import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

function App() {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [searchInfo, setSearchInfo] = useState(null);

  // Search function
  const handleSearch = async (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setLoading(true);
    setSearchResults([]);
    setSearched(true);

    try {
      const response = await axios.post(`${API}/search`, {
        query: searchQuery,
        num_results: 10
      });
      setSearchResults(response.data.results);
      setSearchInfo({
        totalResults: response.data.total_results,
        searchTime: response.data.search_time
      });
    } catch (error) {
      console.error('Search error:', error);
      alert('Search failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="App" data-testid="app-container">
      <div className={`search-container ${searched ? 'results-mode' : ''}`}>
        {/* Logo */}
        <div className="logo-section" data-testid="logo-section">
          <h1 className="logo">Gerch</h1>
        </div>

        {/* Search Form */}
        <form onSubmit={handleSearch} className="search-form" data-testid="search-form">
          <div className="search-box">
            <Search className="search-icon" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="search here..."
              className="search-input"
              data-testid="search-input"
            />
            {loading && <Loader2 className="loading-icon" />}
          </div>
          <div className="button-group">
            <button
              type="submit"
              className="search-button"
              disabled={loading}
              data-testid="search-button"
            >
              Gerch Search
            </button>
            <button
              type="button"
              className="lucky-button"
              disabled={loading}
              data-testid="lucky-button"
            >
              <Sparkles size={16} />
              I'm Feeling Lucky
            </button>
          </div>
        </form>

        {/* Search Info */}
        {searched && searchInfo && (
          <div className="search-info" data-testid="search-info">
            About {searchInfo.totalResults} results ({searchInfo.searchTime} seconds)
          </div>
        )}

        {/* Search Results */}
        {searched && !loading && (
          <div className="results-section" data-testid="results-section">
            {searchResults.length === 0 ? (
              <div className="no-results">
                <p>No results found for "{searchQuery}"</p>
              </div>
            ) : (
              searchResults.map((result, index) => (
                <div key={index} className="result-item" data-testid={`result-item-${index}`}>
                  <div className="result-url">
                    {result.displayed_link || new URL(result.link).hostname}
                  </div>
                  <a
                    href={result.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="result-title"
                    data-testid={`result-title-${index}`}
                  >
                    {result.title}
                  </a>
                  <p className="result-snippet" data-testid={`result-snippet-${index}`}>
                    {result.snippet}
                  </p>
                </div>
              ))
            )}
          </div>
        )}

        {/* Footer */}
        {!searched && (
          <div className="footer">
            <p>Powered by AI • Built with Emergent</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;