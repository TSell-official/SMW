import React, { useState, useEffect, useRef } from "react";
import "@/App.css";
import { Send, Sparkles, Menu, Plus, Copy, Trash2 } from "lucide-react";
import axios from "axios";

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
  const messagesEndRef = useRef(null);

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

        // Load the current conversation
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
      title: 'New Chat',
      messages: [],
      history: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    setConversations(prev => [newConv, ...prev].slice(0, 50)); // Keep only 50 conversations
    setCurrentConversationId(newConv.id);
    setMessages([]);
    setConversationHistory([]);
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
          // Update title if it's still "New Chat"
          let title = conv.title;
          if (title === 'New Chat' && newMessages.length > 0) {
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
    // You could add a toast notification here
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
    }, 20);
  };

  const handleSend = async () => {
    if (!inputValue.trim()) return;

    const userMessage = {
      role: "user",
      content: inputValue,
      timestamp: new Date().toISOString()
    };

    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    
    // Add to conversation history for context
    const historyMessage = { role: "user", content: inputValue };
    const newHistory = [...conversationHistory, historyMessage];
    setConversationHistory(newHistory);
    
    setInputValue("");
    setIsTyping(true);
    setIsSpinning(true);

    try {
      // Use the chat endpoint
      const response = await axios.post(`${API}/chat`, {
        message: inputValue,
        conversation_history: conversationHistory
      });

      const text = response.data.response;
      const needsSearch = response.data.needs_search;
      const searchData = response.data.search_data;
      
      const sentenceCount = countSentences(text);

      if (sentenceCount <= 3 && typingEffectEnabled) {
        // Typing effect for short responses
        typeText(text, () => {
          const gerchMessage = {
            role: "gerch",
            content: text,
            timestamp: new Date().toISOString()
          };
          const updatedMessages = [...newMessages, gerchMessage];
          setMessages(updatedMessages);
          
          // Add to conversation history
          const updatedHistory = [...newHistory, { role: "assistant", content: text }];
          setConversationHistory(updatedHistory);
          
          setTypingText("");
          
          // Update conversation
          updateCurrentConversation(updatedMessages, updatedHistory);
          
          // Add follow-up question if search data is available
          if (needsSearch && searchData) {
            const hasImages = searchData.images && searchData.images.length > 0;
            const hasLinks = searchData.web_results && searchData.web_results.length > 0;
            
            if (hasImages || hasLinks) {
              setTimeout(() => {
                let followUp = "Would you like me to show you ";
                const options = [];
                if (hasImages) options.push("images");
                if (hasLinks) options.push("relevant articles");
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
        // Instant display for long responses or if typing effect is disabled
        const gerchMessage = {
          role: "gerch",
          content: text,
          timestamp: new Date().toISOString()
        };
        const updatedMessages = [...newMessages, gerchMessage];
        setMessages(updatedMessages);
        
        // Add to conversation history
        const updatedHistory = [...newHistory, { role: "assistant", content: text }];
        setConversationHistory(updatedHistory);
        
        // Update conversation
        updateCurrentConversation(updatedMessages, updatedHistory);
        
        // Add follow-up question if search data is available
        if (needsSearch && searchData) {
          const hasImages = searchData.images && searchData.images.length > 0;
          const hasLinks = searchData.web_results && searchData.web_results.length > 0;
          
          if (hasImages || hasLinks) {
            setTimeout(() => {
              let followUp = "Would you like me to show you ";
              const options = [];
              if (hasImages) options.push("images");
              if (hasLinks) options.push("relevant articles");
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
    if (diffInDays < 7) return `${diffInDays} days ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className="App chat-mode" data-testid="app-container">
      {/* Sidebar */}
      <div className={`sidebar ${isSidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <h2 className="sidebar-title">Gerch</h2>
          <button
            className="new-chat-btn"
            onClick={createNewConversation}
            title="New Chat"
          >
            <Plus size={20} />
            <span>New Chat</span>
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
        </div>

        <div className="conversations-list">
          <div className="conversations-title">Recent Conversations</div>
          {conversations.length === 0 ? (
            <div className="no-conversations">No conversations yet</div>
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
                  title="Delete conversation"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="main-content">
        {/* Header */}
        <header className="chat-header">
          <button
            className="sidebar-toggle"
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            title="Toggle sidebar"
          >
            <Menu size={24} />
          </button>
          <h1 className="logo-title">
            Gerch
            <Sparkles className="logo-star" size={28} />
          </h1>
        </header>

        {/* Chat Messages */}
        <div className="chat-messages" data-testid="chat-messages">
          {messages.length === 0 && (
            <div className="welcome-message">
              <Sparkles className="welcome-star" size={48} />
              <h2>Hello! I'm Gerch</h2>
              <p>Ask me anything - I can search the web, generate images, get crypto prices, show research papers, and much more!</p>
            </div>
          )}

          {messages.map((msg, idx) => (
            <div key={idx} className={`message ${msg.role}`} data-testid={`message-${idx}`}>
              {msg.role === "gerch" && (
                <div className="message-avatar">
                  <Sparkles className={isSpinning && idx === messages.length - 1 ? "spinning" : ""} size={24} />
                </div>
              )}
              <div className="message-content">
                {msg.content && (
                  <div className="message-text" dangerouslySetInnerHTML={{ 
                    __html: msg.content.replace(/\n/g, '<br/>').replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\*(.*?)\*/g, '<em>$1</em>')
                  }} />
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
                      <div key={i} className="link-item">
                        <a href={link.link} target="_blank" rel="noopener noreferrer">
                          <div className="link-title">{link.title}</div>
                          <div className="link-url">{new URL(link.link).hostname}</div>
                          <div className="link-snippet">{link.snippet}</div>
                        </a>
                      </div>
                    ))}
                  </div>
                )}
                
                {msg.data && (msg.data.images?.length > 0 || msg.data.web_results?.length > 0) && (
                  <div className="action-buttons">
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
                        Show Articles
                      </button>
                    )}
                  </div>
                )}
              </div>
              
              {/* Message actions */}
              <div className="message-actions">
                <button
                  className="message-action-btn"
                  onClick={() => copyMessage(msg.content)}
                  title="Copy message"
                >
                  <Copy size={16} />
                </button>
                <button
                  className="message-action-btn delete"
                  onClick={() => deleteMessage(idx)}
                  title="Delete message"
                >
                  <Trash2 size={16} />
                </button>
              </div>
              
              {msg.role === "user" && <div className="message-avatar user-avatar">You</div>}
            </div>
          ))}

          {isTyping && typingText && (
            <div className="message gerch">
              <div className="message-avatar">
                <Sparkles className="spinning" size={24} />
              </div>
              <div className="message-content">
                <div className="message-text typing">{typingText}<span className="cursor">|</span></div>
              </div>
            </div>
          )}

          {isTyping && !typingText && (
            <div className="message gerch">
              <div className="message-avatar">
                <Sparkles className="spinning" size={24} />
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

          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="chat-input-container">
          <div className="chat-input-wrapper">
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Ask Gerch anything..."
              className="chat-input"
              data-testid="chat-input"
              disabled={isTyping}
            />
            <button
              onClick={handleSend}
              disabled={!inputValue.trim() || isTyping}
              className="send-button"
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
