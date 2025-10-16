import React, { useState, useEffect, useRef } from "react";
import "@/App.css";
import { Send, Sparkles, Menu, Plus, Copy, Trash2, RefreshCw, Lightbulb } from "lucide-react";
import axios from "axios";
import { enhanceQuery, generateRelatedQuestions, initializeModel } from './services/mlService';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

function App() {
  // State management
  const [inputValue, setInputValue] = useState("");
  const [messages, setMessages] = useState([]);
  const [conversations, setConversations] = useState([]);
  const [currentConversationId, setCurrentConversationId] = useState(null);
  const [conversationHistory, setConversationHistory] = useState([]);
  const [isTyping, setIsTyping] = useState(false);
  const [isSpinning, setIsSpinning] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [typingEffectEnabled, setTypingEffectEnabled] = useState(true);
  const [typingText, setTypingText] = useState("");
  const [relatedQuestions, setRelatedQuestions] = useState([]);
  const [mlReady, setMlReady] = useState(false);
  const messagesEndRef = useRef(null);

  // Initialize ML model on mount (lazy load)
  useEffect(() => {
    const loadModel = async () => {
      try {
        await initializeModel();
        setMlReady(true);
        console.log('🧠 ML capabilities enabled');
      } catch (error) {
        console.log('⚠️ ML not available, using fallback mode');
        setMlReady(false);
      }
    };
    
    // Load model after a short delay to prioritize UI
    setTimeout(loadModel, 1000);
  }, []);

  // Scroll to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, typingText]);

  // Load data from localStorage on mount
  useEffect(() => {
    loadFromLocalStorage();
  }, []);

  // Save to localStorage whenever conversations change
  useEffect(() => {
    saveToLocalStorage();
  }, [conversations, typingEffectEnabled]);

  const loadFromLocalStorage = () => {
    try {
      const savedConversations = localStorage.getItem('gerchConversations');
      const savedTypingEffect = localStorage.getItem('gerchTypingEffect');
      const savedCurrentId = localStorage.getItem('gerchCurrentConversationId');

      if (savedConversations) {
        const parsedConversations = JSON.parse(savedConversations);
        setConversations(parsedConversations);

        if (savedCurrentId) {
          const currentConv = parsedConversations.find(c => c.id === parseInt(savedCurrentId));
          if (currentConv) {
            setCurrentConversationId(currentConv.id);
            setMessages(currentConv.messages);
            setConversationHistory(currentConv.history || []);
          } else {
            createNewConversation();
          }
        } else if (parsedConversations.length > 0) {
          const latestConv = parsedConversations[0];
          setCurrentConversationId(latestConv.id);
          setMessages(latestConv.messages);
          setConversationHistory(latestConv.history || []);
        } else {
          createNewConversation();
        }
      } else {
        createNewConversation();
      }

      if (savedTypingEffect !== null) {
        setTypingEffectEnabled(savedTypingEffect === 'true');
      }
    } catch (error) {
      console.error('Error loading from localStorage:', error);
      createNewConversation();
    }
  };

  const saveToLocalStorage = () => {
    try {
      localStorage.setItem('gerchConversations', JSON.stringify(conversations));
      localStorage.setItem('gerchTypingEffect', typingEffectEnabled.toString());
      if (currentConversationId) {
        localStorage.setItem('gerchCurrentConversationId', currentConversationId.toString());
      }
    } catch (error) {
      console.error('Error saving to localStorage:', error);
    }
  };

  const createNewConversation = () => {
    const newConv = {
      id: Date.now(),
      title: 'New Search',
      messages: [],
      history: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    setConversations(prev => [newConv, ...prev].slice(0, 50));
    setCurrentConversationId(newConv.id);
    setMessages([]);
    setConversationHistory([]);
    setRelatedQuestions([]);
  };

  const loadConversation = (convId) => {
    const conv = conversations.find(c => c.id === convId);
    if (conv) {
      setCurrentConversationId(conv.id);
      setMessages(conv.messages);
      setConversationHistory(conv.history || []);
      setIsSidebarOpen(false);
    }
  };

  const deleteConversation = (convId) => {
    setConversations(prev => prev.filter(c => c.id !== convId));
    
    if (currentConversationId === convId) {
      const remaining = conversations.filter(c => c.id !== convId);
      if (remaining.length > 0) {
        loadConversation(remaining[0].id);
      } else {
        createNewConversation();
      }
    }
  };

  const updateCurrentConversation = (newMessages, newHistory) => {
    setConversations(prev => {
      return prev.map(conv => {
        if (conv.id === currentConversationId) {
          let title = conv.title;
          if (title === 'New Search' && newMessages.length > 0) {
            const firstUserMsg = newMessages.find(m => m.role === 'user');
            if (firstUserMsg) {
              title = firstUserMsg.content.length > 40 
                ? firstUserMsg.content.substring(0, 40) + '...' 
                : firstUserMsg.content;
            }
          }

          return {
            ...conv,
            title,
            messages: newMessages,
            history: newHistory,
            updatedAt: new Date().toISOString()
          };
        }
        return conv;
      });
    });
  };

  const copyMessage = (text) => {
    navigator.clipboard.writeText(text);
  };

  const deleteMessage = (index) => {
    const newMessages = messages.filter((_, i) => i !== index);
    setMessages(newMessages);
    updateCurrentConversation(newMessages, conversationHistory);
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
    if (!inputValue.trim()) return;

    const userQuery = inputValue;
    const userMessage = {
      role: "user",
      content: userQuery,
      timestamp: new Date().toISOString()
    };

    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    
    const historyMessage = { role: "user", content: userQuery };
    const newHistory = [...conversationHistory, historyMessage];
    setConversationHistory(newHistory);
    
    setInputValue("");
    setIsTyping(true);
    setIsSpinning(true);

    try {
      // Enhance query with ML if available
      let queryIntent = null;
      if (mlReady) {
        try {
          queryIntent = await enhanceQuery(userQuery);
          console.log('🎯 Query intent:', queryIntent);
        } catch (error) {
          console.log('ML enhancement failed, using fallback');
        }
      }

      // Call backend API
      const response = await axios.post(`${API}/chat`, {
        message: userQuery,
        conversation_history: conversationHistory
      });

      const text = response.data.response;
      const needsSearch = response.data.needs_search;
      const searchData = response.data.search_data;
      
      // Generate related questions
      if (mlReady) {
        try {
          const related = await generateRelatedQuestions(userQuery, text);
          setRelatedQuestions(related);
        } catch (error) {
          console.log('Failed to generate related questions');
        }
      }

      const sentenceCount = countSentences(text);

      if (sentenceCount <= 3 && typingEffectEnabled) {
        typeText(text, () => {
          const gerchMessage = {
            role: "gerch",
            content: text,
            sources: searchData?.web_results || [],
            timestamp: new Date().toISOString(),
            queryIntent: queryIntent
          };
          const updatedMessages = [...newMessages, gerchMessage];
          setMessages(updatedMessages);
          
          const updatedHistory = [...newHistory, { role: "assistant", content: text }];
          setConversationHistory(updatedHistory);
          
          setTypingText("");
          updateCurrentConversation(updatedMessages, updatedHistory);
          
          if (needsSearch && searchData) {
            const hasImages = searchData.images && searchData.images.length > 0;
            const hasLinks = searchData.web_results && searchData.web_results.length > 0;
            
            if (hasImages || hasLinks) {
              setTimeout(() => {
                let followUp = "Would you like me to show you ";
                const options = [];
                if (hasImages) options.push("images");
                if (hasLinks) options.push("more sources");
                followUp += options.join(" or ") + "?";
                
                const followUpMessage = {
                  role: "gerch",
                  content: followUp,
                  data: searchData,
                  timestamp: new Date().toISOString()
                };
                const finalMessages = [...updatedMessages, followUpMessage];
                setMessages(finalMessages);
                updateCurrentConversation(finalMessages, updatedHistory);
                setIsTyping(false);
                setIsSpinning(false);
              }, 500);
            } else {
              setIsTyping(false);
              setIsSpinning(false);
            }
          } else {
            setIsTyping(false);
            setIsSpinning(false);
          }
        });
      } else {
        const gerchMessage = {
          role: "gerch",
          content: text,
          sources: searchData?.web_results || [],
          timestamp: new Date().toISOString(),
          queryIntent: queryIntent
        };
        const updatedMessages = [...newMessages, gerchMessage];
        setMessages(updatedMessages);
        
        const updatedHistory = [...newHistory, { role: "assistant", content: text }];
        setConversationHistory(updatedHistory);
        
        updateCurrentConversation(updatedMessages, updatedHistory);
        
        if (needsSearch && searchData) {
          const hasImages = searchData.images && searchData.images.length > 0;
          const hasLinks = searchData.web_results && searchData.web_results.length > 0;
          
          if (hasImages || hasLinks) {
            setTimeout(() => {
              let followUp = "Would you like me to show you ";
              const options = [];
              if (hasImages) options.push("images");
              if (hasLinks) options.push("more sources");
              followUp += options.join(" or ") + "?";
              
              const followUpMessage = {
                role: "gerch",
                content: followUp,
                data: searchData,
                timestamp: new Date().toISOString()
              };
              const finalMessages = [...updatedMessages, followUpMessage];
              setMessages(finalMessages);
              updateCurrentConversation(finalMessages, updatedHistory);
              setIsTyping(false);
              setIsSpinning(false);
            }, 500);
          } else {
            setIsTyping(false);
            setIsSpinning(false);
          }
        } else {
          setIsTyping(false);
          setIsSpinning(false);
        }
      }
    } catch (error) {
      console.error('Chat error:', error);
      const errorMessage = {
        role: "gerch",
        content: "I apologize, but I encountered an error. Please try again.",
        timestamp: new Date().toISOString()
      };
      const updatedMessages = [...newMessages, errorMessage];
      setMessages(updatedMessages);
      updateCurrentConversation(updatedMessages, conversationHistory);
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
  };

  const showImages = (data) => {
    if (data.images && data.images.length > 0) {
      const imagesMessage = {
        role: "gerch",
        content: "",
        images: data.images,
        timestamp: new Date().toISOString()
      };
      const updatedMessages = [...messages, imagesMessage];
      setMessages(updatedMessages);
      updateCurrentConversation(updatedMessages, conversationHistory);
    }
  };

  const showLinks = (data) => {
    if (data.web_results && data.web_results.length > 0) {
      const linksMessage = {
        role: "gerch",
        content: "",
        links: data.web_results,
        timestamp: new Date().toISOString()
      };
      const updatedMessages = [...messages, linksMessage];
      setMessages(updatedMessages);
      updateCurrentConversation(updatedMessages, conversationHistory);
    }
  };

  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffInDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));
    
    if (diffInDays === 0) return 'Today';
    if (diffInDays === 1) return 'Yesterday';
    if (diffInDays < 7) return `${diffInDays}d ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className="App perplexity-mode" data-testid="app-container">
      {/* Sidebar */}
      <div className={`sidebar ${isSidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <div className="sidebar-logo">
            <Sparkles size={24} className="logo-icon" />
            <span>Gerch</span>
          </div>
          <button
            className="new-chat-btn"
            onClick={createNewConversation}
            title="New Search"
          >
            <Plus size={18} />
            <span>New Search</span>
          </button>
        </div>

        <div className="sidebar-settings">
          <label className="typing-toggle">
            <input
              type="checkbox"
              checked={typingEffectEnabled}
              onChange={(e) => setTypingEffectEnabled(e.target.checked)}
            />
            <span>Typing Effect</span>
          </label>
          {mlReady && (
            <div className="ml-status">
              <span className="ml-indicator">🧠</span>
              <span>AI Enhanced</span>
            </div>
          )}
        </div>

        <div className="conversations-list">
          <div className="conversations-title">Recent Searches</div>
          {conversations.length === 0 ? (
            <div className="no-conversations">No searches yet</div>
          ) : (
            conversations.map(conv => (
              <div
                key={conv.id}
                className={`conversation-item ${conv.id === currentConversationId ? 'active' : ''}`}
                onClick={() => loadConversation(conv.id)}
              >
                <div className="conversation-content">
                  <div className="conversation-title">{conv.title}</div>
                  <div className="conversation-date">{formatDate(conv.updatedAt)}</div>
                </div>
                <button
                  className="conversation-delete"
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteConversation(conv.id);
                  }}
                  title="Delete search"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="main-content">
        {/* Header */}
        <header className="chat-header perplexity-header">
          <div className="header-left">
            <button
              className="sidebar-toggle"
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              title="Toggle sidebar"
            >
              <Menu size={22} />
            </button>
            <div className="logo-container">
              <Sparkles className="logo-star spinning-always" size={32} />
              <h1 className="logo-title">Gerch</h1>
            </div>
          </div>
          <div className="header-subtitle">AI-Powered Search Engine</div>
        </header>

        {/* Chat Messages */}
        <div className="chat-messages perplexity-messages" data-testid="chat-messages">
          {messages.length === 0 && (
            <div className="welcome-message perplexity-welcome">
              <Sparkles className="welcome-star" size={64} />
              <h2>Search Anything</h2>
              <p>Powered by AI and 10+ integrated data sources including web search, cryptocurrency data, weather, research papers, and more.</p>
              <div className="feature-badges">
                <span className="badge">🖼️ Image Generation</span>
                <span className="badge">📊 Crypto Prices</span>
                <span className="badge">🌤️ Weather</span>
                <span className="badge">📚 Research Papers</span>
                <span className="badge">💻 Code Help</span>
              </div>
            </div>
          )}

          {messages.map((msg, idx) => (
            <div key={idx} className={`message perplexity-message ${msg.role}`} data-testid={`message-${idx}`}>
              {msg.role === "user" && (
                <div className="message-header">
                  <div className="message-avatar user-avatar">
                    <span>You</span>
                  </div>
                </div>
              )}
              
              {msg.role === "gerch" && (
                <div className="message-header">
                  <div className="message-avatar ai-avatar">
                    <Sparkles className={isSpinning && idx === messages.length - 1 ? "spinning" : ""} size={20} />
                  </div>
                </div>
              )}
              
              <div className="message-content perplexity-content">
                {msg.content && (
                  <div className="message-text" dangerouslySetInnerHTML={{ 
                    __html: msg.content
                      .replace(/\n/g, '<br/>')
                      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                      .replace(/\*(.*?)\*/g, '<em>$1</em>')
                      .replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')
                  }} />
                )}
                
                {msg.sources && msg.sources.length > 0 && (
                  <div className="sources-container">
                    <div className="sources-title">Sources:</div>
                    <div className="sources-list">
                      {msg.sources.slice(0, 3).map((source, i) => (
                        <a
                          key={i}
                          href={source.link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="source-link"
                        >
                          <span className="source-number">{i + 1}</span>
                          <span className="source-domain">{new URL(source.link).hostname}</span>
                        </a>
                      ))}
                    </div>
                  </div>
                )}
                
                {msg.images && (
                  <div className="images-grid">
                    {msg.images.map((img, i) => (
                      <div key={i} className="image-item">
                        <img src={img.url} alt="" loading="lazy" />
                      </div>
                    ))}
                  </div>
                )}
                
                {msg.links && (
                  <div className="links-list">
                    {msg.links.slice(0, 5).map((link, i) => (
                      <div key={i} className="link-item perplexity-link">
                        <a href={link.link} target="_blank" rel="noopener noreferrer">
                          <div className="link-header">
                            <div className="link-number">{i + 1}</div>
                            <div className="link-title">{link.title}</div>
                          </div>
                          <div className="link-url">{new URL(link.link).hostname}</div>
                          <div className="link-snippet">{link.snippet}</div>
                        </a>
                      </div>
                    ))}
                  </div>
                )}
                
                {msg.data && (msg.data.images?.length > 0 || msg.data.web_results?.length > 0) && (
                  <div className="action-buttons perplexity-actions">
                    {msg.data.images?.length > 0 && (
                      <button 
                        className="action-btn"
                        onClick={() => showImages(msg.data)}
                      >
                        Show Images
                      </button>
                    )}
                    {msg.data.web_results?.length > 0 && (
                      <button 
                        className="action-btn"
                        onClick={() => showLinks(msg.data)}
                      >
                        Show More Sources
                      </button>
                    )}
                  </div>
                )}
              </div>
              
              {msg.role !== "user" && (
                <div className="message-actions perplexity-actions">
                  <button
                    className="message-action-btn"
                    onClick={() => copyMessage(msg.content)}
                    title="Copy"
                  >
                    <Copy size={14} />
                  </button>
                  <button
                    className="message-action-btn"
                    onClick={() => handleSend()}
                    title="Regenerate"
                  >
                    <RefreshCw size={14} />
                  </button>
                </div>
              )}
            </div>
          ))}

          {isTyping && typingText && (
            <div className="message perplexity-message gerch">
              <div className="message-header">
                <div className="message-avatar ai-avatar">
                  <Sparkles className="spinning" size={20} />
                </div>
              </div>
              <div className="message-content">
                <div className="message-text typing">{typingText}<span className="cursor">|</span></div>
              </div>
            </div>
          )}

          {isTyping && !typingText && (
            <div className="message perplexity-message gerch">
              <div className="message-header">
                <div className="message-avatar ai-avatar">
                  <Sparkles className="spinning" size={20} />
                </div>
              </div>
              <div className="message-content">
                <div className="typing-indicator">
                  <span></span>
                  <span></span>
                  <span></span>
                </div>
              </div>
            </div>
          )}

          {/* Related Questions */}
          {relatedQuestions.length > 0 && !isTyping && (
            <div className="related-questions">
              <div className="related-title">
                <Lightbulb size={16} />
                <span>Related Questions</span>
              </div>
              <div className="related-list">
                {relatedQuestions.map((question, idx) => (
                  <button
                    key={idx}
                    className="related-question"
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

        {/* Input Area */}
        <div className="chat-input-container perplexity-input">
          <div className="chat-input-wrapper">
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Ask anything..."
              className="chat-input"
              data-testid="chat-input"
              disabled={isTyping}
            />
            <button
              onClick={handleSend}
              disabled={!inputValue.trim() || isTyping}
              className="send-button perplexity-send"
              data-testid="send-button"
            >
              <Send size={20} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
