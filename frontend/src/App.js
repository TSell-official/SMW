import React, { useState, useEffect, useRef } from "react";
import "@/App.css";
import { Send, Sparkles, Plus, X, Copy, Grid3x3, ArrowLeft, ExternalLink, Maximize2 } from "lucide-react";
import axios from "axios";
import { enhanceQuery, generateRelatedQuestions, initializeModel } from './services/mlService';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// Shortcuts configuration
const SHORTCUTS = [
  { 
    id: 'crypto', 
    name: 'Crypto Tracker', 
    url: 'https://crypto-price-tracker-d2p2s1c82vjjq7abps7g.lp.dev/',
    icon: '₿',
    color: '#f7931a',
    hideUrl: true
  },
  { 
    id: 'lane', 
    name: 'Lane', 
    url: 'https://lane-unified-ai-search-assistant-d4816js82vjt9pscmsgg.lp.dev/',
    icon: '🔍',
    color: '#00ff88',
    hideUrl: true
  },
  { 
    id: 'blackops', 
    name: 'BlackOps automation', 
    url: 'https://blackops-automator-d2qcbks82vjhtjudrp9g.lp.dev/',
    icon: '⚙️',
    color: '#ff0066',
    hideUrl: true
  },
  { 
    id: 'calculator', 
    name: 'Calculator', 
    url: 'https://ai-powered-calculator-web-app-d3pk1f482vjikj7jn420.lp.dev/',
    icon: '🧮',
    color: '#4285f4',
    hideUrl: true
  },
  { 
    id: 'gerchcloud', 
    name: 'Gerch Cloud', 
    url: 'https://gerch-cloud-platform-d3rcpvk82vjloo6ffv2g.lp.dev/api-keys',
    icon: '☁️',
    color: '#87ceeb',
    hideUrl: true
  },
  { 
    id: 'lexi', 
    name: 'Lexi', 
    url: 'https://lexiai-autonomous-word-processor-d44ugoc82vjgsfv08jc0.lp.dev/',
    icon: '📄',
    color: '#ff6b9d',
    hideUrl: true
  },
  { 
    id: 'copyrush', 
    name: 'CopyRush', 
    url: 'https://ai-copywriting-agent-d4240q482vjgsfq2afk0.lp.dev/',
    icon: '🖊️',
    color: '#ff9500',
    hideUrl: true
  },
  { 
    id: 'dualcoach', 
    name: 'Dual Coach', 
    url: 'https://ai-dual-coach-platform-d3u44pc82vjkdghq0ag0.lp.dev/',
    icon: '💪',
    color: '#9d4edd',
    hideUrl: true
  },
  { 
    id: 'kentutor', 
    name: 'Ken Tutor', 
    url: 'https://preview--learnique-ai.lovable.app/',
    icon: '🧠',
    color: '#6366f1',
    hideUrl: true
  },
  { 
    id: 'travelmap', 
    name: 'Gerch Travel Maps', 
    url: 'https://proj_d3re44c82vjloo6h283g.lp.dev/',
    icon: '📍',
    color: '#f94144',
    hideUrl: true
  }
];

function App() {
  // State management
  const [tabs, setTabs] = useState([{ id: 1, title: 'New Search', messages: [], history: [], active: true, browserUrl: null }]);
  const [activeTabId, setActiveTabId] = useState(1);
  const [inputValue, setInputValue] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [isSpinning, setIsSpinning] = useState(false);
  const [typingEffectEnabled, setTypingEffectEnabled] = useState(true);
  const [typingText, setTypingText] = useState("");
  const [relatedQuestions, setRelatedQuestions] = useState([]);
  const [mlReady, setMlReady] = useState(false);
  const [nextTabId, setNextTabId] = useState(2);
  const [showShortcutsMenu, setShowShortcutsMenu] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(true);
  const [currentTheme, setCurrentTheme] = useState('dark');
  const [gridPosition, setGridPosition] = useState({ x: 0, y: 220 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  // Get active tab
  const activeTab = tabs.find(t => t.id === activeTabId) || tabs[0];
  const messages = activeTab?.messages || [];
  const conversationHistory = activeTab?.history || [];
  const browserUrl = activeTab?.browserUrl || null;

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
      const savedTheme = localStorage.getItem('spheremountTheme');

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
      
      if (savedTheme) {
        setCurrentTheme(savedTheme);
        document.documentElement.setAttribute('data-theme', savedTheme);
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

  // Hide shortcuts when messages exist
  useEffect(() => {
    setShowShortcuts(messages.length === 0 && !browserUrl);
  }, [messages.length, browserUrl]);

  // Create new tab
  const createNewTab = () => {
    const newTab = {
      id: nextTabId,
      title: 'New Search',
      messages: [],
      history: [],
      active: true,
      browserUrl: null
    };
    setTabs(prev => prev.map(t => ({ ...t, active: false })).concat(newTab));
    setActiveTabId(nextTabId);
    setNextTabId(nextTabId + 1);
    setRelatedQuestions([]);
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

  // Open shortcut
  const openShortcut = (shortcut) => {
    updateTab(activeTabId, { 
      browserUrl: shortcut.url,
      title: shortcut.name,
      hideUrl: shortcut.hideUrl
    });
    setShowShortcutsMenu(false);
  };

  // Change theme
  const changeTheme = (theme) => {
    setCurrentTheme(theme);
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('spheremountTheme', theme);
  };


  // Drag handlers for grid button
  const handleDragStart = (e) => {
    setIsDragging(true);
    const clientX = e.type.includes('touch') ? e.touches[0].clientX : e.clientX;
    const clientY = e.type.includes('touch') ? e.touches[0].clientY : e.clientY;
    setDragStart({ x: clientX - gridPosition.x, y: clientY - gridPosition.y });
  };

  const handleDrag = (e) => {
    if (!isDragging) return;
    e.preventDefault();
    const clientX = e.type.includes('touch') ? e.touches[0].clientX : e.clientX;
    const clientY = e.type.includes('touch') ? e.touches[0].clientY : e.clientY;
    setGridPosition({
      x: clientX - dragStart.x,
      y: clientY - dragStart.y
    });
  };

  const handleDragEnd = () => {
    setIsDragging(false);
    localStorage.setItem('spheremountGridPosition', JSON.stringify(gridPosition));
  };

  // Load grid position from localStorage
  useEffect(() => {
    const savedPosition = localStorage.getItem('spheremountGridPosition');
    if (savedPosition) {
      setGridPosition(JSON.parse(savedPosition));
    }
  }, []);

  // Add event listeners for dragging
  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleDrag);
      window.addEventListener('mouseup', handleDragEnd);
      window.addEventListener('touchmove', handleDrag);
      window.addEventListener('touchend', handleDragEnd);
      
      return () => {
        window.removeEventListener('mousemove', handleDrag);
        window.removeEventListener('mouseup', handleDragEnd);
        window.removeEventListener('touchmove', handleDrag);
        window.removeEventListener('touchend', handleDragEnd);
      };
    }
  }, [isDragging, gridPosition, dragStart]);



  // Close browser
  const closeBrowser = () => {
    updateTab(activeTabId, { 
      browserUrl: null,
      title: messages.length > 0 ? activeTab.title : 'New Search'
    });
  };

  // Open in new tab
  const openInNewTab = (url) => {
    window.open(url, '_blank');
  };

  // Detect "Open X" commands
  const detectOpenCommand = (query) => {
    const lowerQuery = query.toLowerCase();
    
    for (const shortcut of SHORTCUTS) {
      const triggers = [
        `open ${shortcut.name.toLowerCase()}`,
        `launch ${shortcut.name.toLowerCase()}`,
        `go to ${shortcut.name.toLowerCase()}`,
        `show ${shortcut.name.toLowerCase()}`
      ];
      
      if (triggers.some(trigger => lowerQuery.includes(trigger))) {
        return shortcut;
      }
    }
    
    return null;
  };


  // Detect app task commands and build URL with parameters
  const detectAppTask = (query) => {
    const lowerQuery = query.toLowerCase();
    
    // Calculator tasks
    if (lowerQuery.includes('calculate') || lowerQuery.includes('compute')) {
      const mathExpression = query.replace(/calculate|compute|on calculator|in calculator/gi, '').trim();
      if (mathExpression) {
        const calculator = SHORTCUTS.find(s => s.id === 'calculator');
        return {
          app: calculator,
          url: `${calculator.url}?expression=${encodeURIComponent(mathExpression)}`,
          task: `Calculate: ${mathExpression}`
        };
      }
    }
    
    // Lane search tasks
    if (lowerQuery.includes('search for') || lowerQuery.includes('find')) {
      const searchQuery = query.replace(/search for|find|on lane|in lane|using lane/gi, '').trim();
      if (searchQuery && (lowerQuery.includes('lane') || lowerQuery.includes('search'))) {
        const lane = SHORTCUTS.find(s => s.id === 'lane');
        return {
          app: lane,
          url: `${lane.url}?q=${encodeURIComponent(searchQuery)}`,
          task: `Search on Lane: ${searchQuery}`
        };
      }
    }
    
    // Lexi document tasks
    if (lowerQuery.includes('create document') || lowerQuery.includes('new document')) {
      const docTitle = query.replace(/create document|new document|on lexi|in lexi|using lexi/gi, '').trim();
      const lexi = SHORTCUTS.find(s => s.id === 'lexi');
      return {
        app: lexi,
        url: docTitle ? `${lexi.url}?action=new&title=${encodeURIComponent(docTitle)}` : `${lexi.url}?action=new`,
        task: docTitle ? `Create document: ${docTitle}` : 'Create new document'
      };
    }
    
    // CopyRush copywriting tasks
    if (lowerQuery.includes('write copy') || lowerQuery.includes('generate copy')) {
      const copyPrompt = query.replace(/write copy|generate copy|on copyrush|in copyrush|using copyrush/gi, '').trim();
      const copyrush = SHORTCUTS.find(s => s.id === 'copyrush');
      return {
        app: copyrush,
        url: copyPrompt ? `${copyrush.url}?prompt=${encodeURIComponent(copyPrompt)}` : copyrush.url,
        task: copyPrompt ? `Generate copy: ${copyPrompt}` : 'Open CopyRush'
      };
    }
    
    // Ken Tutor learning tasks
    if (lowerQuery.includes('learn') || lowerQuery.includes('teach me')) {
      const topic = query.replace(/learn|teach me|on ken tutor|in ken tutor|using ken tutor/gi, '').trim();
      const kentutor = SHORTCUTS.find(s => s.id === 'kentutor');
      return {
        app: kentutor,
        url: topic ? `${kentutor.url}?topic=${encodeURIComponent(topic)}` : kentutor.url,
        task: topic ? `Learn: ${topic}` : 'Open Ken Tutor'
      };
    }
    
    return null;
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
    
    // Check for app task commands first
    const appTask = detectAppTask(userQuery);
    if (appTask) {
      updateTab(activeTabId, { 
        browserUrl: appTask.url,
        title: appTask.app.name,
        hideUrl: appTask.app.hideUrl
      });
      
      // Add message to chat showing what task was performed
      const taskMessage = {
        role: "gerch",
        content: `Opening ${appTask.app.name} to perform: ${appTask.task}`,
        timestamp: new Date().toISOString()
      };
      
      updateTab(activeTabId, { 
        messages: [...messages, 
          { role: "user", content: userQuery, timestamp: new Date().toISOString() },
          taskMessage
        ]
      });
      
      setInputValue("");
      return;
    }
    
    // Check for "Open X" command
    const shortcutCommand = detectOpenCommand(userQuery);
    if (shortcutCommand) {
      openShortcut(shortcutCommand);
      setInputValue("");
      return;
    }

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
      const audioUrl = response.data.audio_url;
      
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
          audioUrl: audioUrl,
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
    <div className="App browser-mode" data-testid="app-container">
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

      {/* 3x3 Shortcuts Menu Button - Fixed position */}
      <button 
        className="shortcuts-menu-btn"
        onClick={() => setShowShortcutsMenu(!showShortcutsMenu)}
        title="Shortcuts"
      >
        <Grid3x3 size={20} />
      </button>

      {/* Shortcuts Dropdown Menu */}
      {showShortcutsMenu && (
        <>
          <div className="shortcuts-overlay" onClick={() => setShowShortcutsMenu(false)} />
          <div className="shortcuts-dropdown">
            <div className="theme-selector">
              <div className="theme-selector-label">Theme</div>
              <div className="theme-grid">
                {['dark', 'light', 'ocean', 'forest', 'sunset', 'purple', 'midnight', 'coffee', 'rose', 'mint'].map(theme => (
                  <button
                    key={theme}
                    className={`theme-option ${currentTheme === theme ? 'active' : ''}`}
                    onClick={() => changeTheme(theme)}
                    title={theme.charAt(0).toUpperCase() + theme.slice(1)}
                  >
                    <div className={`theme-preview theme-${theme}`}></div>
                  </button>
                ))}
              </div>
            </div>
            <div className="shortcuts-dropdown-grid">
              {SHORTCUTS.map(shortcut => (
                <button
                  key={shortcut.id}
                  className="shortcut-dropdown-item"
                  onClick={() => openShortcut(shortcut)}
                  style={{ borderColor: shortcut.color }}
                >
                  <span className="shortcut-icon" style={{ color: shortcut.color }}>
                    {shortcut.icon}
                  </span>
                  <span className="shortcut-name">{shortcut.name}</span>
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Main Content */}
      <div className="main-content browser-layout">
        {/* Browser View */}
        {browserUrl ? (
          <div className="browser-container">
            <div className="browser-toolbar">
              <button className="browser-btn" onClick={closeBrowser} title="Back">
                <ArrowLeft size={18} />
              </button>
              {!activeTab.hideUrl && (
                <div className="browser-url-bar">
                  <span className="url-text">{browserUrl}</span>
                  <button 
                    className="browser-btn-icon" 
                    onClick={() => openInNewTab(browserUrl)}
                    title="Open in new window"
                  >
                    <ExternalLink size={16} />
                  </button>
                </div>
              )}
              {activeTab.hideUrl && (
                <div className="browser-title">
                  <Sparkles size={18} className="spinning" />
                  <span>{activeTab.title}</span>
                </div>
              )}
            </div>
            <iframe
              src={browserUrl}
              className="browser-iframe"
              title={activeTab.title}
              sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
            />
          </div>
        ) : (
          <>
            {/* Google-style Logo */}
            <div className={`google-header ${messages.length > 0 ? 'compact' : ''}`}>
              <div className="google-logo">
                <span className="logo-text">SphereMount Workspace</span>
              </div>
            </div>

            {/* Shortcuts removed from homepage - now only in 3x3 grid menu */}

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
                        
                        {msg.audioUrl && (
                          <div className="response-audio">
                            <audio controls className="audio-player">
                              <source src={msg.audioUrl} type="audio/mpeg" />
                              Your browser does not support the audio element.
                            </audio>
                          </div>
                        )}
                        
                        {msg.images && msg.images.length > 0 && (
                          <div className="response-images">
                            {msg.images.map((img, i) => (
                              <div key={i} className="image-result">
                                <img src={img.url} alt="" loading="lazy" />
                              </div>
                            ))}
                          </div>
                        )}
                        
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
          </>
        )}
      </div>
    </div>
  );
}

export default App;
