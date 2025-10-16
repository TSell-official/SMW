import React, { useState, useEffect, useRef } from "react";
import "@/App.css";
import { Send, Sparkles, Plus, X, Copy, RotateCw } from "lucide-react";
import axios from "axios";
import { enhanceQuery, generateRelatedQuestions, initializeModel } from './services/mlService';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

function App() {
  // State management
  const [tabs, setTabs] = useState([{ id: 1, title: 'New Search', messages: [], history: [], active: true }]);
  const [activeTabId, setActiveTabId] = useState(1);
  const [inputValue, setInputValue] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [isSpinning, setIsSpinning] = useState(false);
  const [typingEffectEnabled, setTypingEffectEnabled] = useState(true);
  const [typingText, setTypingText] = useState("");
  const [relatedQuestions, setRelatedQuestions] = useState([]);
  const [mlReady, setMlReady] = useState(false);
  const [nextTabId, setNextTabId] = useState(2);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  // Get active tab
  const activeTab = tabs.find(t => t.id === activeTabId) || tabs[0];
  const messages = activeTab?.messages || [];
  const conversationHistory = activeTab?.history || [];

  // Initialize ML model
  useEffect(() => {
    const loadModel = async () => {
      try {
        await initializeModel();
        setMlReady(true);
        console.log('🧠 ML ready');
      } catch (error) {
        console.log('⚠️ ML not available');
        setMlReady(false);
      }
    };
    setTimeout(loadModel, 1000);
  }, []);

  // Scroll to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, typingText, activeTabId]);

  // Load from localStorage
  useEffect(() => {
    try {
      const savedTabs = localStorage.getItem('gerchTabs');
      const savedTypingEffect = localStorage.getItem('gerchTypingEffect');
      const savedActiveId = localStorage.getItem('gerchActiveTabId');

      if (savedTabs) {
        const parsedTabs = JSON.parse(savedTabs);
        setTabs(parsedTabs);
        if (savedActiveId) {
          setActiveTabId(parseInt(savedActiveId));
        }
        const maxId = Math.max(...parsedTabs.map(t => t.id));
        setNextTabId(maxId + 1);
      }

      if (savedTypingEffect !== null) {
        setTypingEffectEnabled(savedTypingEffect === 'true');
      }
    } catch (error) {
      console.error('Error loading:', error);
    }
  }, []);

  // Save to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('gerchTabs', JSON.stringify(tabs));
      localStorage.setItem('gerchTypingEffect', typingEffectEnabled.toString());
      localStorage.setItem('gerchActiveTabId', activeTabId.toString());
    } catch (error) {
      console.error('Error saving:', error);
    }
  }, [tabs, typingEffectEnabled, activeTabId]);

  // Create new tab
  const createNewTab = () => {
    const newTab = {
      id: nextTabId,
      title: 'New Search',
      messages: [],
      history: [],
      active: true
    };
    setTabs(prev => prev.map(t => ({ ...t, active: false })).concat(newTab));
    setActiveTabId(nextTabId);
    setNextTabId(nextTabId + 1);
    setRelatedQuestions([]);
    // Focus input after creating new tab
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  // Switch tab
  const switchTab = (tabId) => {
    setActiveTabId(tabId);
    setTabs(prev => prev.map(t => ({ ...t, active: t.id === tabId })));
  };

  // Close tab
  const closeTab = (tabId, e) => {
    e.stopPropagation();
    const filteredTabs = tabs.filter(t => t.id !== tabId);
    
    if (filteredTabs.length === 0) {
      createNewTab();
      return;
    }

    if (tabId === activeTabId) {
      const currentIndex = tabs.findIndex(t => t.id === tabId);
      const newActiveTab = filteredTabs[Math.max(0, currentIndex - 1)];
      setActiveTabId(newActiveTab.id);
    }

    setTabs(filteredTabs);
  };

  // Update tab
  const updateTab = (tabId, updates) => {
    setTabs(prev => prev.map(t => t.id === tabId ? { ...t, ...updates } : t));
  };

  const countSentences = (text) => {
    if (!text) return 0;
    const sentences = text.match(/[^.!?]+[.!?]+/g);
    return sentences ? sentences.length : 1;
  };

  const typeText = (text, callback) => {
    if (!typingEffectEnabled) {
      callback();
      return;
    }

    let index = 0;
    setTypingText("");
    const interval = setInterval(() => {
      if (index < text.length) {
        setTypingText((prev) => prev + text[index]);
        index++;
      } else {
        clearInterval(interval);
        callback();
      }
    }, 15);
  };

  const handleSend = async () => {
    if (!inputValue.trim() || isTyping) return;

    const userQuery = inputValue;
    const userMessage = {
      role: "user",
      content: userQuery,
      timestamp: new Date().toISOString()
    };

    const newMessages = [...messages, userMessage];
    const newHistory = [...conversationHistory, { role: "user", content: userQuery }];
    
    updateTab(activeTabId, { 
      messages: newMessages, 
      history: newHistory,
      title: messages.length === 0 ? (userQuery.length > 30 ? userQuery.substring(0, 30) + '...' : userQuery) : activeTab.title
    });
    
    setInputValue("");
    setIsTyping(true);
    setIsSpinning(true);

    try {
      // Enhance query with ML
      let queryIntent = null;
      if (mlReady) {
        try {
          queryIntent = await enhanceQuery(userQuery);
        } catch (error) {
          console.log('ML enhancement failed');
        }
      }

      // Call backend
      const response = await axios.post(`${API}/chat`, {
        message: userQuery,
        conversation_history: conversationHistory
      });

      const text = response.data.response;
      const needsSearch = response.data.needs_search;
      const searchData = response.data.search_data;
      
      // Generate related questions
      if (mlReady && !userQuery.toLowerCase().includes('generate image')) {
        try {
          const related = await generateRelatedQuestions(userQuery, text);
          setRelatedQuestions(related);
        } catch (error) {
          setRelatedQuestions([]);
        }
      } else {
        setRelatedQuestions([]);
      }

      const sentenceCount = countSentences(text);

      const processResponse = () => {
        const gerchMessage = {
          role: "gerch",
          content: text,
          articles: searchData?.web_results || [],
          images: searchData?.images || [],
          timestamp: new Date().toISOString(),
          queryIntent: queryIntent
        };
        
        const updatedMessages = [...newMessages, gerchMessage];
        const updatedHistory = [...newHistory, { role: "assistant", content: text }];
        
        updateTab(activeTabId, { 
          messages: updatedMessages, 
          history: updatedHistory 
        });
        
        setTypingText("");
        setIsTyping(false);
        setIsSpinning(false);
      };

      if (sentenceCount <= 3 && typingEffectEnabled) {
        typeText(text, processResponse);
      } else {
        processResponse();
      }
    } catch (error) {
      console.error('Error:', error);
      const errorMessage = {
        role: "gerch",
        content: "I apologize, but I encountered an error. Please try again.",
        timestamp: new Date().toISOString()
      };
      updateTab(activeTabId, { 
        messages: [...newMessages, errorMessage],
        history: newHistory
      });
      setIsTyping(false);
      setIsSpinning(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleRelatedQuestion = (question) => {
    setInputValue(question);
    inputRef.current?.focus();
  };

  const copyMessage = (text) => {
    navigator.clipboard.writeText(text);
  };

  return (
    <div className="App google-mode" data-testid="app-container">
      {/* Browser-style tabs */}
      <div className="browser-tabs">
        <div className="tabs-list">
          {tabs.map(tab => (
            <div
              key={tab.id}
              className={`tab ${tab.id === activeTabId ? 'active' : ''}`}
              onClick={() => switchTab(tab.id)}
            >
              <span className="tab-title">{tab.title}</span>
              {tabs.length > 1 && (
                <button
                  className="tab-close"
                  onClick={(e) => closeTab(tab.id, e)}
                  title="Close tab"
                >
                  <X size={14} />
                </button>
              )}
            </div>
          ))}
          <button className="tab-new" onClick={createNewTab} title="New search">
            <Plus size={18} />
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="main-content google-layout">
        {/* Google-style Logo */}
        <div className={`google-header ${messages.length > 0 ? 'compact' : ''}`}>
          <div className="google-logo">
            <span className="logo-text">Gerc</span>
            <Sparkles className="logo-star-inline spinning-always" size={messages.length > 0 ? 24 : 32} />
            <span className="logo-text">h</span>
          </div>
        </div>

        {/* Search Input */}
        <div className={`google-search ${messages.length > 0 ? 'compact' : ''}`}>
          <div className="search-box">
            <input
              ref={inputRef}
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Search or ask anything..."
              className="search-input"
              disabled={isTyping}
              autoFocus
            />
            <button
              onClick={handleSend}
              disabled={!inputValue.trim() || isTyping}
              className="search-button"
            >
              <Send size={20} />
            </button>
          </div>
        </div>

        {/* Messages/Results */}
        {messages.length > 0 && (
          <div className="search-results" data-testid="search-results">
            {messages.map((msg, idx) => (
              <div key={idx} className={`result-item ${msg.role}`}>
                {msg.role === "user" && (
                  <div className="user-query">
                    <span className="query-label">You searched:</span>
                    <span className="query-text">{msg.content}</span>
                  </div>
                )}
                
                {msg.role === "gerch" && (
                  <div className="gerch-response">
                    <div className="response-header">
                      <Sparkles className={isSpinning && idx === messages.length - 1 ? "spinning" : ""} size={20} />
                      <span className="response-label">Gerch</span>
                    </div>
                    
                    {msg.content && (
                      <div className="response-content">
                        <div 
                          className="response-text" 
                          dangerouslySetInnerHTML={{ 
                            __html: msg.content
                              .replace(/\n/g, '<br/>')
                              .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                              .replace(/\*(.*?)\*/g, '<em>$1</em>')
                          }} 
                        />
                        
                        <div className="response-actions">
                          <button
                            className="response-action"
                            onClick={() => copyMessage(msg.content)}
                            title="Copy"
                          >
                            <Copy size={14} />
                            <span>Copy</span>
                          </button>
                        </div>
                      </div>
                    )}
                    
                    {/* Display Images */}
                    {msg.images && msg.images.length > 0 && (
                      <div className="response-images">
                        {msg.images.map((img, i) => (
                          <div key={i} className="image-result">
                            <img src={img.url} alt="" loading="lazy" />
                          </div>
                        ))}
                      </div>
                    )}
                    
                    {/* Display Articles at Bottom */}
                    {msg.articles && msg.articles.length > 0 && (
                      <div className="response-articles">
                        <div className="articles-header">Related Articles</div>
                        {msg.articles.slice(0, 5).map((article, i) => (
                          <a
                            key={i}
                            href={article.link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="article-card"
                          >
                            <div className="article-number">{i + 1}</div>
                            <div className="article-content">
                              <div className="article-title">{article.title}</div>
                              <div className="article-url">{new URL(article.link).hostname}</div>
                              <div className="article-snippet">{article.snippet}</div>
                            </div>
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}

            {/* Typing Indicator */}
            {isTyping && typingText && (
              <div className="result-item gerch">
                <div className="gerch-response">
                  <div className="response-header">
                    <Sparkles className="spinning" size={20} />
                    <span className="response-label">Gerch</span>
                  </div>
                  <div className="response-content">
                    <div className="response-text typing">{typingText}<span className="cursor">|</span></div>
                  </div>
                </div>
              </div>
            )}

            {isTyping && !typingText && (
              <div className="result-item gerch">
                <div className="gerch-response">
                  <div className="response-header">
                    <Sparkles className="spinning" size={20} />
                    <span className="response-label">Gerch</span>
                  </div>
                  <div className="response-content">
                    <div className="typing-indicator">
                      <span></span>
                      <span></span>
                      <span></span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Related Questions */}
            {relatedQuestions.length > 0 && !isTyping && (
              <div className="related-searches">
                <div className="related-title">People also ask:</div>
                <div className="related-list">
                  {relatedQuestions.map((question, idx) => (
                    <button
                      key={idx}
                      className="related-item"
                      onClick={() => handleRelatedQuestion(question)}
                    >
                      {question}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
