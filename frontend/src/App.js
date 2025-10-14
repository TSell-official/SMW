import React, { useState, useEffect, useRef } from "react";
import "@/App.css";
import { Search, MessageSquare, Sparkles, Loader2, Book, Send } from "lucide-react";
import axios from "axios";
import * as tf from '@tensorflow/tfjs';
import * as use from '@tensorflow-models/universal-sentence-encoder';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

function App() {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [selectedArticle, setSelectedArticle] = useState(null);
  const [loading, setLoading] = useState(false);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [tfModel, setTfModel] = useState(null);
  const [classifications, setClassifications] = useState([]);
  const chatEndRef = useRef(null);

  // Load TensorFlow.js model on mount
  useEffect(() => {
    const loadModel = async () => {
      try {
        console.log('Loading TensorFlow.js model...');
        const model = await use.load();
        setTfModel(model);
        console.log('TensorFlow.js model loaded successfully');
      } catch (error) {
        console.error('Error loading TensorFlow.js model:', error);
      }
    };
    loadModel();
  }, []);

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  // Search Wikipedia articles
  const handleSearch = async (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setLoading(true);
    setSearchResults([]);
    setSelectedArticle(null);

    try {
      const response = await axios.post(`${API}/search`, {
        query: searchQuery
      });
      setSearchResults(response.data);
    } catch (error) {
      console.error('Search error:', error);
      alert('Search failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Get article details
  const handleArticleClick = async (title) => {
    setLoading(true);
    setSelectedArticle(null);
    setShowChat(false);
    setChatMessages([]);

    try {
      const response = await axios.get(`${API}/article/${encodeURIComponent(title)}`);
      setSelectedArticle(response.data);

      // Classify content using backend
      try {
        const classifyResponse = await axios.post(`${API}/classify`, {
          text: response.data.summary
        });
        setClassifications(classifyResponse.data.categories);
      } catch (error) {
        console.error('Classification error:', error);
      }

      // Perform client-side embedding with TensorFlow.js
      if (tfModel && response.data.summary) {
        try {
          const embeddings = await tfModel.embed([response.data.summary]);
          const embeddingArray = await embeddings.array();
          console.log('Article embeddings generated:', embeddingArray[0].slice(0, 5), '...');
        } catch (error) {
          console.error('Embedding error:', error);
        }
      }

    } catch (error) {
      console.error('Article fetch error:', error);
      alert('Failed to load article. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Send chat message
  const handleChatSubmit = async (e) => {
    e.preventDefault();
    if (!chatInput.trim() || !selectedArticle) return;

    const userMessage = chatInput;
    setChatInput("");
    setChatMessages(prev => [...prev, { role: "user", content: userMessage }]);
    setChatLoading(true);

    try {
      const response = await axios.post(`${API}/ask`, {
        question: userMessage,
        context: selectedArticle.content.substring(0, 3000)
      });

      setChatMessages(prev => [...prev, {
        role: "assistant",
        content: response.data.answer
      }]);
    } catch (error) {
      console.error('Chat error:', error);
      setChatMessages(prev => [...prev, {
        role: "assistant",
        content: "Sorry, I encountered an error. Please try again."
      }]);
    } finally {
      setChatLoading(false);
    }
  };

  return (
    <div className="App" data-testid="app-container">
      {/* Header */}
      <header className="header" data-testid="app-header">
        <div className="header-content">
          <div className="logo">
            <Book className="logo-icon" />
            <h1>WikiAI</h1>
            <span className="beta-badge">POWERED BY CEREBRAS</span>
          </div>
          <p className="tagline">AI-Powered Knowledge Discovery</p>
        </div>
      </header>

      <div className="main-container">
        {/* Search Section */}
        <div className="search-section" data-testid="search-section">
          <form onSubmit={handleSearch} className="search-form">
            <div className="search-input-wrapper">
              <Search className="search-icon" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Ask anything or search Wikipedia..."
                className="search-input"
                data-testid="search-input"
              />
              <button
                type="submit"
                className="search-button"
                disabled={loading}
                data-testid="search-button"
              >
                {loading ? (
                  <Loader2 className="spinner" />
                ) : (
                  <Sparkles className="sparkle-icon" />
                )}
              </button>
            </div>
          </form>

          {/* Search Results */}
          {searchResults.length > 0 && (
            <div className="search-results" data-testid="search-results">
              <h3>Search Results</h3>
              <div className="results-grid">
                {searchResults.map((result, index) => (
                  <div
                    key={index}
                    className="result-card"
                    onClick={() => handleArticleClick(result.title)}
                    data-testid={`result-card-${index}`}
                  >
                    <h4>{result.title}</h4>
                    <p>{result.summary}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Article View */}
        {selectedArticle && (
          <div className="article-view" data-testid="article-view">
            <div className="article-header">
              <h2>{selectedArticle.title}</h2>
              <a
                href={selectedArticle.url}
                target="_blank"
                rel="noopener noreferrer"
                className="wiki-link"
                data-testid="wiki-link"
              >
                View on Wikipedia →
              </a>
            </div>

            {/* AI Summary */}
            <div className="ai-summary" data-testid="ai-summary">
              <div className="summary-header">
                <Sparkles className="summary-icon" />
                <span>AI Summary</span>
              </div>
              <p>{selectedArticle.summary}</p>
            </div>

            {/* Classifications */}
            {classifications.length > 0 && (
              <div className="classifications" data-testid="classifications">
                <h4>Categories</h4>
                <div className="category-tags">
                  {classifications.map((cat, idx) => (
                    <span key={idx} className="category-tag" data-testid={`category-${idx}`}>
                      {cat}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Article Content */}
            <div className="article-content" data-testid="article-content">
              {selectedArticle.content.split('\n\n').map((paragraph, idx) => (
                paragraph.trim() && <p key={idx}>{paragraph}</p>
              ))}
            </div>

            {/* Chat Toggle Button */}
            <button
              className="chat-toggle-button"
              onClick={() => setShowChat(!showChat)}
              data-testid="chat-toggle-button"
            >
              <MessageSquare />
              {showChat ? 'Hide' : 'Ask Questions'}
            </button>
          </div>
        )}

        {/* Chat Interface */}
        {showChat && selectedArticle && (
          <div className="chat-interface" data-testid="chat-interface">
            <div className="chat-header">
              <MessageSquare />
              <span>Ask About This Article</span>
            </div>

            <div className="chat-messages" data-testid="chat-messages">
              {chatMessages.length === 0 && (
                <div className="chat-empty">
                  <p>Ask me anything about this article!</p>
                </div>
              )}
              {chatMessages.map((msg, idx) => (
                <div
                  key={idx}
                  className={`chat-message ${msg.role}`}
                  data-testid={`chat-message-${idx}`}
                >
                  <div className="message-content">{msg.content}</div>
                </div>
              ))}
              {chatLoading && (
                <div className="chat-message assistant" data-testid="chat-loading">
                  <div className="message-content">
                    <Loader2 className="spinner" /> Thinking...
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            <form onSubmit={handleChatSubmit} className="chat-input-form">
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="Ask a question..."
                className="chat-input"
                disabled={chatLoading}
                data-testid="chat-input"
              />
              <button
                type="submit"
                className="chat-send-button"
                disabled={chatLoading || !chatInput.trim()}
                data-testid="chat-send-button"
              >
                <Send />
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;