import React, { useState, useEffect, useRef } from "react";
import "@/App.css";
import { Send, Sparkles } from "lucide-react";
import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

function App() {
  const [inputValue, setInputValue] = useState("");
  const [messages, setMessages] = useState([]);
  const [isTyping, setIsTyping] = useState(false);
  const [isSpinning, setIsSpinning] = useState(false);
  const messagesEndRef = useRef(null);
  const [typingText, setTypingText] = useState("");

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, typingText]);

  const countSentences = (text) => {
    if (!text) return 0;
    const sentences = text.match(/[^.!?]+[.!?]+/g);
    return sentences ? sentences.length : 1;
  };

  const typeText = (text, callback) => {
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
    }, 30);
  };

  const formatGerchResponse = (data) => {
    let response = "";
    
    // Add AI overview if available
    if (data.ai_overview) {
      response = data.ai_overview;
    }
    
    // Add calculator result
    if (data.calculator_result && data.calculator_result.success) {
      response = `The answer is ${data.calculator_result.result}.`;
    }
    
    // Add dictionary definition
    if (data.dictionary) {
      const dict = data.dictionary;
      response = `**${dict.word}** ${dict.phonetic ? `(${dict.phonetic})` : ''}\\n\\n`;
      dict.definitions.forEach((def, idx) => {
        response += `*${def.part_of_speech}*: ${def.definition}\\n`;
        if (def.example) response += `Example: "${def.example}"\\n`;
      });
    }
    
    // Add Wikipedia summary
    if (data.wikipedia_summary && !data.ai_overview) {
      response = data.wikipedia_summary;
    }
    
    // Add follow-up question
    const hasImages = data.images && data.images.length > 0;
    const hasLinks = data.web_results && data.web_results.length > 0;
    
    if (hasImages || hasLinks) {
      response += "\\n\\nWould you like me to show you ";
      const options = [];
      if (hasImages) options.push("images");
      if (hasLinks) options.push("relevant articles");
      response += options.join(" or ") + "?";
    }
    
    return { text: response, data };
  };

  const handleSend = async () => {
    if (!inputValue.trim()) return;

    const userMessage = {
      role: "user",
      content: inputValue,
      timestamp: new Date()
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputValue("");
    setIsTyping(true);
    setIsSpinning(true);

    try {
      const response = await axios.post(`${API}/search`, {
        query: inputValue,
        num_results: 10
      });

      const { text, data } = formatGerchResponse(response.data);
      const sentenceCount = countSentences(text);

      if (sentenceCount <= 3) {
        // Typing effect for short responses
        typeText(text, () => {
          const gerchMessage = {
            role: "gerch",
            content: text,
            data: data,
            timestamp: new Date()
          };
          setMessages((prev) => [...prev, gerchMessage]);
          setTypingText("");
          setIsTyping(false);
          setIsSpinning(false);
        });
      } else {
        // Instant display for long responses
        const gerchMessage = {
          role: "gerch",
          content: text,
          data: data,
          timestamp: new Date()
        };
        setMessages((prev) => [...prev, gerchMessage]);
        setIsTyping(false);
        setIsSpinning(false);
      }
    } catch (error) {
      console.error('Search error:', error);
      const errorMessage = {
        role: "gerch",
        content: "I apologize, but I encountered an error. Please try again.",
        timestamp: new Date()
      };
      setMessages((prev) => [...prev, errorMessage]);
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
        timestamp: new Date()
      };
      setMessages((prev) => [...prev, imagesMessage]);
    }
  };

  const showLinks = (data) => {
    if (data.web_results && data.web_results.length > 0) {
      const linksMessage = {
        role: "gerch",
        content: "",
        links: data.web_results,
        timestamp: new Date()
      };
      setMessages((prev) => [...prev, linksMessage]);
    }
  };

  return (
    <div className="App chat-mode" data-testid="app-container">
      {/* Header */}
      <header className="chat-header">
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
            <p>Ask me anything - I can search the web, do calculations, define words, and more!</p>
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
  );
}

export default App;
