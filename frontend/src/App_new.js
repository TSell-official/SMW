import React, { useState } from "react";
import "@/App.css";
import { Search, Sparkles, Loader2, Calculator, BookOpen, ImageIcon, Brain } from "lucide-react";
import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

function App() {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchData, setSearchData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setLoading(true);
    setSearchData(null);
    setSearched(true);

    try {
      const response = await axios.post(`${API}/search`, {
        query: searchQuery,
        num_results: 10
      });
      setSearchData(response.data);
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

        {/* Search Results */}
        {searched && !loading && searchData && (
          <div className="results-container" data-testid="results-container">
            {/* Search Info */}
            {searchData.total_results && (
              <div className="search-info" data-testid="search-info">
                About {searchData.total_results} results ({searchData.search_time} seconds)
              </div>
            )}

            {/* AI Overview */}
            {searchData.ai_overview && (
              <div className="ai-overview-card" data-testid="ai-overview">
                <div className="card-header">
                  <Brain size={20} />
                  <span>AI Overview</span>
                </div>
                <p>{searchData.ai_overview}</p>
              </div>
            )}

            {/* Calculator Result */}
            {searchData.calculator_result && searchData.calculator_result.success && (
              <div className="calculator-card" data-testid="calculator-result">
                <div className="card-header">
                  <Calculator size={20} />
                  <span>Calculator</span>
                </div>
                <div className="calculator-result">
                  <span className="expression">{searchData.calculator_result.expression}</span>
                  <span className="equals">=</span>
                  <span className="result">{searchData.calculator_result.result}</span>
                </div>
              </div>
            )}

            {/* Dictionary */}
            {searchData.dictionary && (
              <div className="dictionary-card" data-testid="dictionary">
                <div className="card-header">
                  <BookOpen size={20} />
                  <span>Dictionary</span>
                </div>
                <h3>{searchData.dictionary.word}</h3>
                {searchData.dictionary.phonetic && (
                  <p className="phonetic">{searchData.dictionary.phonetic}</p>
                )}
                <div className="definitions">
                  {searchData.dictionary.definitions.map((def, idx) => (
                    <div key={idx} className="definition-item">
                      <span className="part-of-speech">{def.part_of_speech}</span>
                      <p>{def.definition}</p>
                      {def.example && <p className="example">"{def.example}"</p>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Wikipedia Summary */}
            {searchData.wikipedia_summary && (
              <div className="wikipedia-card" data-testid="wikipedia">
                <div className="card-header">
                  <span>Wikipedia</span>
                </div>
                <p>{searchData.wikipedia_summary}</p>
              </div>
            )}

            {/* Images */}
            {searchData.images && searchData.images.length > 0 && (
              <div className="images-section" data-testid="images-section">
                <div className="section-header">
                  <ImageIcon size={20} />
                  <span>Images</span>
                </div>
                <div className="images-grid">
                  {searchData.images.map((img, idx) => (
                    <div key={idx} className="image-item" data-testid={`image-${idx}`}>
                      <img src={img.url} alt="" loading="lazy" />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Web Results */}
            <div className="web-results-section" data-testid="web-results">
              {searchData.web_results.length === 0 ? (
                <div className="no-results">
                  <p>No results found for "{searchQuery}"</p>
                </div>
              ) : (
                searchData.web_results.map((result, index) => (
                  <div key={index} className="result-item" data-testid={`result-item-${index}`}>
                    <div className="result-url">
                      {new URL(result.link).hostname}
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
