import React, { useState, useRef, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import DOMPurify from 'dompurify';

/**
 * FloatingAIChat - AI-powered chat assistant for the dashboard
 * Features natural language interaction with bot management
 * Uses React Portal to render directly to document.body for proper fixed positioning
 */

// Helper function to format AI message content with markdown-like styling
const formatMessageContent = (content) => {
  if (!content) return content;

  // Split content into parts for formatting
  let formatted = content;

  // Format code blocks (```code```)
  formatted = formatted.replace(/```([\s\S]*?)```/g, (match, code) => {
    return `<pre class="ai-code-block"><code>${escapeHtml(code.trim())}</code></pre>`;
  });

  // Format inline code (`code`)
  formatted = formatted.replace(/`([^`]+)`/g, '<code class="ai-inline-code">$1</code>');

  // Format bold (**text**)
  formatted = formatted.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');

  // Format italic (*text*)
  formatted = formatted.replace(/\*([^*]+)\*/g, '<em>$1</em>');

  // Format bullet points (- item or • item)
  formatted = formatted.replace(/^[•\-]\s+(.+)$/gm, '<div class="ai-bullet-point">• $1</div>');

  // Format numbered lists (1. item)
  formatted = formatted.replace(/^\d+\.\s+(.+)$/gm, (match, text) => {
    return `<div class="ai-numbered-point">${match}</div>`;
  });

  // Format links [text](url) - make them clickable
  formatted = formatted.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" class="ai-link">$1</a>');

  return formatted;
};

const escapeHtml = (text) => {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
};

export default function FloatingAIChat({ guildId, apiBase, onDataChange }) {
  const [isOpen, setIsOpen] = useState(false);
  
  // Load chat history from localStorage on mount
  const [messages, setMessages] = useState(() => {
    const storageKey = `ai-chat-history-${guildId || 'global'}`;
    const saved = localStorage.getItem(storageKey);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      } catch (e) {
        console.warn('Failed to parse saved chat history:', e);
      }
    }
    // Default welcome message
    return [
      {
        role: 'assistant',
        content: '👋 **Hi! I\'m Chocomaid AI Assistant.**\n\nI can help you:\n• Manage your Discord bot\n• Check analytics & statistics\n• Configure auto-responses\n• View XP leaderboards\n• And much more!\n\n*What would you like to know?*',
        timestamp: new Date().toISOString()
      }
    ];
  });
  
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [position, setPosition] = useState(() => {
    const saved = localStorage.getItem('ai-chat-position');
    // Default position: 24px from right, 85px from bottom (above the ~70px footer)
    return saved ? JSON.parse(saved) : { bottom: 85, right: 24 };
  });
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const inputRef = useRef(null);
  const fabRef = useRef(null);

  // Save messages to localStorage whenever they change
  useEffect(() => {
    const storageKey = `ai-chat-history-${guildId || 'global'}`;
    // Only save if there are messages beyond the initial welcome
    if (messages.length > 0) {
      // Limit stored messages to last 50 to prevent localStorage bloat
      const messagesToSave = messages.slice(-50);
      localStorage.setItem(storageKey, JSON.stringify(messagesToSave));
    }
  }, [messages, guildId]);

  // Auto-scroll to bottom when new messages arrive
  const scrollToBottom = () => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
    }
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
      inputRef.current?.focus();
    }
  }, [messages, isOpen]);

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = {
      role: 'user',
      content: input,
      timestamp: new Date().toISOString()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const token = localStorage.getItem('token');
      const url = `${apiBase}/api/ai/chat${guildId ? `?guildId=${guildId}` : ''}`;
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          message: input,
          history: messages.slice(-3) // Reduced from 5 to 3 messages for token efficiency
        })
      });

      if (!response.ok) {
        throw new Error('Failed to get AI response');
      }

      const data = await response.json();

      const assistantMessage = {
        role: 'assistant',
        content: data.response,
        timestamp: data.timestamp,
        functionCalled: data.functionCalled,
        rawData: data.functionResult // Store raw function result if available
      };

      setMessages(prev => [...prev, assistantMessage]);

      // If a CRUD operation was performed, trigger refresh
      if (data.functionCalled && onDataChange) {
        const crudFunctions = [
          // Auto-response functions
          'create_auto_response', 
          'update_auto_response', 
          'delete_auto_response', 
          'toggle_auto_response',
          // Command functions
          'toggle_command',
          'enable_multiple_commands',
          'disable_multiple_commands',
          // Automod functions
          'create_automod_rule',
          'update_automod_rule',
          'delete_automod_rule',
          'toggle_automod_rule',
          // Profanity functions
          'add_profanity_word',
          'update_profanity_word',
          'delete_profanity_word',
          'add_profanity_pattern',
          'update_profanity_pattern',
          'delete_profanity_pattern',
          // Role management functions (slash command roles only)
          'add_slash_command_role',
          'remove_slash_command_role',
          'update_slash_command_role'
        ];
        if (crudFunctions.includes(data.functionCalled)) {
          setTimeout(() => onDataChange(), 500); // Slight delay to ensure backend is updated
        }
      }
    } catch (error) {
      console.error('AI chat error:', error);
      
      const errorMessage = {
        role: 'assistant',
        content: `❌ **Oops! Something went wrong.**\n\n${error.message || 'I encountered an error while processing your request.'}\n\n*Please try again or rephrase your question.*`,
        timestamp: new Date().toISOString(),
        isError: true
      };

      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const toggleChat = () => {
    setIsOpen(!isOpen);
  };

  const clearChat = () => {
    const storageKey = `ai-chat-history-${guildId || 'global'}`;
    localStorage.removeItem(storageKey);
    setMessages([
      {
        role: 'assistant',
        content: '🔄 **Chat cleared!**\n\nHow can I help you today? Try asking me to:\n• `List auto responses`\n• `Show bot status`\n• `Create an auto-response`\n• `Get analytics summary`',
        timestamp: new Date().toISOString()
      }
    ]);
  };

  // Dragging functionality
  const handleMouseDown = (e) => {
    if (e.target.closest('.ai-chat-window')) return; // Don't drag if clicking chat window
    e.preventDefault();
    setIsDragging(true);
    
    const rect = fabRef.current.getBoundingClientRect();
    setDragOffset({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    });
  };

  const handleMouseMove = (e) => {
    if (!isDragging) return;
    
    // Calculate new position based on cursor position
    const fabWidth = 56;
    const fabHeight = 56;
    
    const newLeft = e.clientX - dragOffset.x;
    const newTop = e.clientY - dragOffset.y;
    
    // Convert to right/bottom positioning
    const newRight = window.innerWidth - newLeft - fabWidth;
    const newBottom = window.innerHeight - newTop - fabHeight;
    
    // Constrain to viewport with padding
    const minDistance = 10;
    const maxRight = window.innerWidth - fabWidth - minDistance;
    const maxBottom = window.innerHeight - fabHeight - minDistance;
    
    const constrainedPosition = {
      right: Math.max(minDistance, Math.min(newRight, maxRight)),
      bottom: Math.max(minDistance, Math.min(newBottom, maxBottom))
    };
    
    setPosition(constrainedPosition);
  };

  const handleMouseUp = () => {
    if (isDragging) {
      setIsDragging(false);
      localStorage.setItem('ai-chat-position', JSON.stringify(position));
    }
  };

  // Determine chat window position based on FAB location
  const getChatWindowStyle = useMemo(() => {
    const chatWidth = 380;
    const chatHeight = 600;
    const fabWidth = 56;
    const spacing = 10;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const fabLeftPosition = viewportWidth - position.right - fabWidth;
    
    // Check if FAB is on the left half of the screen
    const isOnLeftSide = fabLeftPosition < viewportWidth / 2;
    
    // Calculate bottom position, ensuring the chat window fits in the viewport
    // The chat window should not extend beyond the top of the viewport
    const maxChatHeight = Math.min(chatHeight, viewportHeight - 40); // 40px total padding (20px top + 20px bottom)
    const minBottom = 20; // Minimum distance from bottom
    const calculatedBottom = Math.max(position.bottom, minBottom);
    
    // Ensure the chat window doesn't overflow the top
    const topEdge = viewportHeight - calculatedBottom - maxChatHeight;
    const adjustedBottom = topEdge < 20 ? viewportHeight - maxChatHeight - 20 : calculatedBottom;
    
    if (isOnLeftSide) {
      // FAB on left, show chat on right of FAB
      return {
        position: 'fixed',
        bottom: `${adjustedBottom}px`,
        left: `${fabLeftPosition + fabWidth + spacing}px`,
        right: 'auto'
      };
    } else {
      // FAB on right, show chat on left of FAB (default)
      return {
        position: 'fixed',
        bottom: `${adjustedBottom}px`,
        right: `${position.right + fabWidth + spacing}px`,
        left: 'auto'
      };
    }
  }, [position.bottom, position.right]);

  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, dragOffset, position]);

  // Render using Portal to ensure fixed positioning works correctly
  // regardless of parent container styles (transform, overflow, etc.)
  return createPortal(
    <>
      {/* Floating Chat Button */}
      <button
        ref={fabRef}
        className={`ai-chat-fab ${isDragging ? 'dragging' : ''}`}
        onClick={toggleChat}
        onMouseDown={handleMouseDown}
        aria-label="Chocomaid AI Assistant"
        title="Chocomaid AI Assistant (Drag to reposition)"
        style={{
          position: 'fixed',
          bottom: `${position.bottom}px`,
          right: `${position.right}px`,
          cursor: isDragging ? 'grabbing' : 'grab',
          zIndex: 9999
        }}
      >
        {isOpen ? (
          <i className="fas fa-times"></i>
        ) : (
          <img src="/logo.svg" alt="Chocomaid" className="ai-chat-fab-logo" />
        )}
      </button>

      {/* Chat Window */}
      {isOpen && (
        <div 
          className="ai-chat-window"
          style={{
            ...getChatWindowStyle,
            zIndex: 9998
          }}
        >
          {/* Header */}
          <div className="ai-chat-header">
            <div className="ai-chat-header-content">
              <img src="/logo.svg" alt="Chocomaid" className="ai-chat-header-logo" />
              <span>Chocomaid AI Assistant</span>
              <span className="ai-status-badge">
                <span className="ai-status-dot"></span>
                Online
              </span>
            </div>
            <div className="ai-chat-header-actions">
              <button
                className="ai-chat-header-btn"
                onClick={clearChat}
                title="Clear chat"
              >
                <i className="fas fa-trash-alt"></i>
              </button>
              <button
                className="ai-chat-header-btn"
                onClick={toggleChat}
                title="Close"
              >
                <i className="fas fa-times"></i>
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="ai-chat-messages" ref={messagesContainerRef}>
            {messages.map((msg, idx) => (
              <div
                key={idx}
                className={`ai-chat-message ${msg.role === 'user' ? 'user' : 'assistant'} ${msg.isError ? 'error' : ''}`}
              >
                <div className="ai-chat-message-avatar">
                  {msg.role === 'user' ? (
                    <i className="fas fa-user"></i>
                  ) : (
                    <img src="/logo.svg" alt="Chocomaid" className="ai-avatar-logo" />
                  )}
                </div>
                <div className="ai-chat-message-content">
                  <div 
                    className="ai-chat-message-text"
                    dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(formatMessageContent(msg.content)) }}
                  />
                  {msg.functionCalled && (
                    <div className="ai-function-badge">
                      <i className="fas fa-code me-1"></i>
                      {msg.functionCalled.replace(/_/g, ' ')}
                    </div>
                  )}
                  <div className="ai-chat-message-time">
                    {new Date(msg.timestamp).toLocaleTimeString()}
                  </div>
                </div>
              </div>
            ))}
            
            {isLoading && (
              <div className="ai-chat-message assistant">
                <div className="ai-chat-message-avatar">
                  <img src="/logo.svg" alt="Chocomaid" className="ai-avatar-logo" />
                </div>
                <div className="ai-chat-message-content">
                  <div className="ai-chat-typing">
                    <span></span>
                    <span></span>
                    <span></span>
                  </div>
                </div>
              </div>
            )}
            
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="ai-chat-input-container">
            <div className="ai-chat-input-wrapper">
              <textarea
                ref={inputRef}
                className="ai-chat-input"
                placeholder="Ask me anything about your bot..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={handleKeyPress}
                rows={1}
                disabled={isLoading}
              />
              <button
                className="ai-chat-send-btn"
                onClick={sendMessage}
                disabled={!input.trim() || isLoading}
                aria-label="Send message"
              >
                <i className="fas fa-paper-plane"></i>
              </button>
            </div>
            <div className="ai-chat-hints">
              Try: "Show bot status" • "List auto responses" • "List guild roles" • "Get role config" • "Add role 123456789 to slash commands"
            </div>
          </div>
        </div>
      )}
    </>,
    document.body
  );
}
