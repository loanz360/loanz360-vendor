'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'
import {
  MessageSquare,
  X,
  Send,
  RefreshCw,
  MapPin,
  Upload,
  Star,
  CheckCircle,
  WifiOff,
  AlertCircle
} from 'lucide-react'
import { ChatWidgetErrorBoundary } from './ErrorBoundary'

interface ChatbotConfig {
  id: string
  theme: {
    primaryColor: string
    secondaryColor: string
    backgroundColor: string
    textColor: string
    bubblePosition: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left'
    bubbleSize: 'small' | 'medium' | 'large'
    avatarUrl: string | null
    botName: string
    welcomeMessage: string
    typingIndicatorEnabled: boolean
    typingDelayMs: number
  }
  settings: {
    proactiveEnabled: boolean
    proactiveDelaySeconds: number
    proactiveMessage: string
    showReferenceNumber: boolean
    thankYouMessage: string
    thankYouButtonText: string
    allowRestart: boolean
  }
}

interface Message {
  id: string
  type: 'bot' | 'user'
  content: string
  nodeType?: string
  options?: string[]
  timestamp: Date
  status?: 'sending' | 'sent' | 'error'
}

interface ChatWidgetProps {
  chatbotId: string
}

// Message queue for offline support
interface QueuedMessage {
  id: string
  sessionId: string
  nodeId: string
  answer: string
  collectedData: Record<string, unknown>
  timestamp: number
}

const STORAGE_KEY_QUEUE = 'chatbot_message_queue'
const STORAGE_KEY_SESSION = 'chatbot_session'
const MAX_RETRY_ATTEMPTS = 3
const RETRY_DELAY_MS = 2000

function ChatWidgetInner({ chatbotId }: ChatWidgetProps) {
  const [config, setConfig] = useState<ChatbotConfig | null>(null)
  const [isOpen, setIsOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [messages, setMessages] = useState<Message[]>([])
  const [inputValue, setInputValue] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const [currentNode, setCurrentNode] = useState<Record<string, unknown> | null>(null)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [collectedData, setCollectedData] = useState<Record<string, unknown>>({})
  const [isCompleted, setIsCompleted] = useState(false)
  const [referenceNumber, setReferenceNumber] = useState<string | null>(null)
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true)
  const [pendingMessages, setPendingMessages] = useState<QueuedMessage[]>([])
  const [showOfflineWarning, setShowOfflineWarning] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const chatWindowRef = useRef<HTMLDivElement>(null)

  // Online/Offline detection
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true)
      setShowOfflineWarning(false)
      // Process queued messages
      processQueuedMessages()
    }

    const handleOffline = () => {
      setIsOnline(false)
      setShowOfflineWarning(true)
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  // Load queued messages from storage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(`${STORAGE_KEY_QUEUE}_${chatbotId}`)
      if (stored) {
        const queue = JSON.parse(stored) as QueuedMessage[]
        setPendingMessages(queue)
      }
    } catch {
      // Ignore storage errors
    }
  }, [chatbotId])

  // Process queued messages when online
  const processQueuedMessages = useCallback(async () => {
    const stored = localStorage.getItem(`${STORAGE_KEY_QUEUE}_${chatbotId}`)
    if (!stored) return

    try {
      const queue = JSON.parse(stored) as QueuedMessage[]
      if (queue.length === 0) return

      for (const msg of queue) {
        try {
          await fetch('/api/public/chatbot/message', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              session_id: msg.sessionId,
              node_id: msg.nodeId,
              answer: msg.answer,
              collected_data: msg.collectedData
            })
          })
        } catch {
          // Keep in queue if failed
          continue
        }
      }

      // Clear queue after processing
      localStorage.removeItem(`${STORAGE_KEY_QUEUE}_${chatbotId}`)
      setPendingMessages([])
    } catch {
      // Ignore errors
    }
  }, [chatbotId])

  // Queue message for later
  const queueMessage = useCallback((message: QueuedMessage) => {
    const newQueue = [...pendingMessages, message]
    setPendingMessages(newQueue)
    try {
      localStorage.setItem(`${STORAGE_KEY_QUEUE}_${chatbotId}`, JSON.stringify(newQueue))
    } catch {
      // Ignore storage errors
    }
  }, [chatbotId, pendingMessages])

  // Fetch chatbot config
  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const response = await fetch(`/api/public/chatbot/${chatbotId}/config`)
        const data = await response.json()

        if (data.success) {
          setConfig(data.data)
        }
      } catch (error) {
        console.error('Failed to load chatbot config:', error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchConfig()
  }, [chatbotId])

  // Handle proactive message
  useEffect(() => {
    if (!config || !config.settings.proactiveEnabled || isOpen) return

    const timer = setTimeout(() => {
      if (!isOpen) {
        setIsOpen(true)
      }
    }, config.settings.proactiveDelaySeconds * 1000)

    return () => clearTimeout(timer)
  }, [config, isOpen])

  // Start chat session with retry logic
  const startSession = useCallback(async (attempt = 1): Promise<void> => {
    if (!config) return

    try {
      const response = await fetch('/api/public/chatbot/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chatbot_id: chatbotId,
          visitor_data: {
            userAgent: navigator.userAgent,
            language: navigator.language,
            referrer: document.referrer,
            url: window.location.href
          }
        })
      })

      const data = await response.json()

      if (data.success) {
        setSessionId(data.data.session_id)
        addBotMessage(config.theme.welcomeMessage)
        fetchNextNode(data.data.session_id, 'start-1')
      }
    } catch (error) {
      console.error('Failed to start session:', error)
      if (attempt < MAX_RETRY_ATTEMPTS && isOnline) {
        setTimeout(() => startSession(attempt + 1), RETRY_DELAY_MS * attempt)
      } else if (!isOnline) {
        addBotMessage('You appear to be offline. The chat will resume when you reconnect.')
      }
    }
  }, [config, chatbotId, isOnline])

  // Open chat
  const handleOpen = () => {
    setIsOpen(true)
    if (!sessionId && config) {
      startSession()
    }
  }

  // Close chat
  const handleClose = () => {
    setIsOpen(false)
  }

  // Add bot message
  const addBotMessage = (content: string, nodeType?: string, options?: string[]) => {
    setMessages(prev => [...prev, {
      id: `msg-${Date.now()}`,
      type: 'bot',
      content,
      nodeType,
      options,
      timestamp: new Date(),
      status: 'sent'
    }])
  }

  // Add user message
  const addUserMessage = (content: string, status: 'sending' | 'sent' | 'error' = 'sent') => {
    const msgId = `msg-${Date.now()}`
    setMessages(prev => [...prev, {
      id: msgId,
      type: 'user',
      content,
      timestamp: new Date(),
      status
    }])
    return msgId
  }

  // Update message status
  const updateMessageStatus = (msgId: string, status: 'sending' | 'sent' | 'error') => {
    setMessages(prev => prev.map(msg =>
      msg.id === msgId ? { ...msg, status } : msg
    ))
  }

  // Fetch next node with retry logic
  const fetchNextNode = async (sid: string, nodeId: string, answer?: string, attempt = 1) => {
    if (!config) return

    setIsTyping(true)

    try {
      const response = await fetch('/api/public/chatbot/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sid,
          node_id: nodeId,
          answer
        })
      })

      const data = await response.json()

      // Simulate typing delay
      await new Promise(resolve => setTimeout(resolve, config.theme.typingDelayMs))

      setIsTyping(false)

      if (data.success && data.data.node) {
        const node = data.data.node
        setCurrentNode(node)

        // Add bot message based on node type
        if (node.type === 'message') {
          addBotMessage(node.data.message, node.type)
          if (data.data.next_node_id) {
            setTimeout(() => fetchNextNode(sid, data.data.next_node_id), 500)
          }
        } else if (node.type === 'end') {
          addBotMessage(node.data.message, node.type)
          if (node.data.type === 'submit_lead') {
            setReferenceNumber(data.data.reference_number)
          }
          setIsCompleted(true)
        } else {
          addBotMessage(node.data.question, node.type, node.data.options)
        }
      }
    } catch (error) {
      console.error('Failed to fetch next node:', error)
      setIsTyping(false)

      if (attempt < MAX_RETRY_ATTEMPTS && isOnline) {
        setTimeout(() => fetchNextNode(sid, nodeId, answer, attempt + 1), RETRY_DELAY_MS * attempt)
      } else if (!isOnline) {
        setShowOfflineWarning(true)
      }
    }
  }

  // Handle user input submission
  const handleSubmit = async (value?: string) => {
    const answer = value || inputValue.trim()
    if (!answer || !currentNode || !sessionId) return

    const msgId = addUserMessage(answer, isOnline ? 'sending' : 'sent')
    setInputValue('')

    // Store collected data
    if ((currentNode as Record<string, unknown>).data) {
      const nodeData = (currentNode as Record<string, { variableName?: string }>).data
      if (nodeData?.variableName) {
        setCollectedData(prev => ({
          ...prev,
          [nodeData.variableName as string]: answer
        }))
      }
    }

    // Handle offline case
    if (!isOnline) {
      queueMessage({
        id: msgId,
        sessionId,
        nodeId: (currentNode as Record<string, string>).id,
        answer,
        collectedData: {
          ...collectedData,
          ...(((currentNode as Record<string, { variableName?: string }>).data?.variableName)
            ? { [(currentNode as Record<string, { variableName?: string }>).data?.variableName as string]: answer }
            : {})
        },
        timestamp: Date.now()
      })
      return
    }

    try {
      const response = await fetch('/api/public/chatbot/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId,
          node_id: (currentNode as Record<string, string>).id,
          answer,
          collected_data: {
            ...collectedData,
            ...(((currentNode as Record<string, { variableName?: string }>).data?.variableName)
              ? { [(currentNode as Record<string, { variableName?: string }>).data?.variableName as string]: answer }
              : {})
          }
        })
      })

      const data = await response.json()
      updateMessageStatus(msgId, 'sent')

      if (data.success && data.data.next_node_id) {
        fetchNextNode(sessionId, data.data.next_node_id)
      }
    } catch (error) {
      console.error('Failed to submit answer:', error)
      updateMessageStatus(msgId, 'error')
    }
  }

  // Handle option selection
  const handleOptionSelect = (option: string) => {
    handleSubmit(option)
  }

  // Handle restart
  const handleRestart = () => {
    setMessages([])
    setCollectedData({})
    setCurrentNode(null)
    setIsCompleted(false)
    setReferenceNumber(null)
    setSessionId(null)
    startSession()
  }

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      handleClose()
    }
  }

  // Scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Focus input on open
  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus()
    }
  }, [isOpen])

  // Announce new messages to screen readers
  useEffect(() => {
    if (messages.length > 0) {
      const lastMessage = messages[messages.length - 1]
      if (lastMessage.type === 'bot') {
        // Create an aria-live region announcement
        const announcement = document.createElement('div')
        announcement.setAttribute('role', 'status')
        announcement.setAttribute('aria-live', 'polite')
        announcement.setAttribute('aria-atomic', 'true')
        announcement.className = 'sr-only'
        announcement.textContent = `${config?.theme.botName || 'Bot'}: ${lastMessage.content}`
        document.body.appendChild(announcement)
        setTimeout(() => announcement.remove(), 1000)
      }
    }
  }, [messages, config?.theme.botName])

  if (isLoading || !config) {
    return null
  }

  const bubbleSizes = {
    small: 'w-12 h-12',
    medium: 'w-14 h-14',
    large: 'w-16 h-16'
  }

  const positionClasses = {
    'bottom-right': 'bottom-4 right-4',
    'bottom-left': 'bottom-4 left-4',
    'top-right': 'top-4 right-4',
    'top-left': 'top-4 left-4'
  }

  const currentNodeData = currentNode as Record<string, Record<string, unknown>> | null

  return (
    <>
      {/* Skip Link for Accessibility */}
      <a
        href="#chat-input"
        className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:p-2 focus:bg-white focus:text-black"
      >
        Skip to chat input
      </a>

      {/* Chat Bubble */}
      {!isOpen && (
        <button
          onClick={handleOpen}
          aria-label={`Open chat with ${config.theme.botName}`}
          aria-expanded={isOpen}
          className={`fixed ${positionClasses[config.theme.bubblePosition]} ${bubbleSizes[config.theme.bubbleSize]} rounded-full shadow-lg flex items-center justify-center transition-transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500 z-50`}
          style={{ backgroundColor: config.theme.primaryColor }}
        >
          <MessageSquare className="w-6 h-6 text-white" aria-hidden="true" />
          {pendingMessages.length > 0 && (
            <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full text-xs text-white flex items-center justify-center">
              {pendingMessages.length}
            </span>
          )}
        </button>
      )}

      {/* Chat Window */}
      {isOpen && (
        <div
          ref={chatWindowRef}
          role="dialog"
          aria-modal="true"
          aria-label={`Chat with ${config.theme.botName}`}
          onKeyDown={handleKeyDown}
          className={`fixed ${positionClasses[config.theme.bubblePosition]} w-96 h-[600px] max-h-[80vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden z-50`}
          style={{ backgroundColor: config.theme.backgroundColor }}
        >
          {/* Header */}
          <div
            className="px-4 py-3 flex items-center justify-between"
            style={{ backgroundColor: config.theme.primaryColor }}
          >
            <div className="flex items-center space-x-3">
              {config.theme.avatarUrl ? (
                <img
                  src={config.theme.avatarUrl}
                  alt=""
                  aria-hidden="true"
                  className="w-10 h-10 rounded-full object-cover border-2 border-white/20"
                />
              ) : (
                <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center" aria-hidden="true">
                  <MessageSquare className="w-5 h-5 text-white" />
                </div>
              )}
              <div>
                <p className="font-semibold text-white">{config.theme.botName}</p>
                <p className="text-xs text-white/70" aria-live="polite">
                  {isOnline ? 'Online' : 'Offline'}
                </p>
              </div>
            </div>
            <button
              onClick={handleClose}
              aria-label="Close chat"
              className="p-2 rounded-full hover:bg-white/10 text-white transition-colors focus:outline-none focus:ring-2 focus:ring-white"
            >
              <X className="w-5 h-5" aria-hidden="true" />
            </button>
          </div>

          {/* Offline Warning */}
          {showOfflineWarning && (
            <div
              role="alert"
              className="px-4 py-2 bg-yellow-500/10 border-b border-yellow-500/20 flex items-center space-x-2"
            >
              <WifiOff className="w-4 h-4 text-yellow-500" aria-hidden="true" />
              <span className="text-xs text-yellow-500">
                You&apos;re offline. Messages will be sent when you reconnect.
              </span>
            </div>
          )}

          {/* Messages */}
          <div
            role="log"
            aria-live="polite"
            aria-atomic="false"
            className="flex-1 p-4 overflow-y-auto space-y-4"
            style={{ backgroundColor: config.theme.secondaryColor }}
          >
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] rounded-2xl px-4 py-2 ${
                    message.type === 'user'
                      ? 'rounded-br-md'
                      : 'rounded-bl-md'
                  }`}
                  style={{
                    backgroundColor: message.type === 'user' ? config.theme.primaryColor : config.theme.backgroundColor,
                    color: message.type === 'user' ? '#FFFFFF' : config.theme.textColor
                  }}
                >
                  <p className="text-sm whitespace-pre-wrap">{message.content}</p>

                  {/* Message Status */}
                  {message.type === 'user' && message.status && (
                    <div className="flex justify-end mt-1">
                      {message.status === 'sending' && (
                        <span className="text-xs text-white/50">Sending...</span>
                      )}
                      {message.status === 'error' && (
                        <span className="text-xs text-red-300 flex items-center">
                          <AlertCircle className="w-3 h-3 mr-1" aria-hidden="true" />
                          Failed to send
                        </span>
                      )}
                    </div>
                  )}

                  {/* Options buttons */}
                  {message.type === 'bot' && message.options && (
                    <div className="mt-3 space-y-2" role="group" aria-label="Response options">
                      {message.options.map((option, index) => (
                        <button
                          key={index}
                          onClick={() => handleOptionSelect(option)}
                          className="block w-full text-left px-3 py-2 rounded-lg text-sm transition-colors border focus:outline-none focus:ring-2 focus:ring-offset-1"
                          style={{
                            borderColor: config.theme.primaryColor,
                            color: config.theme.primaryColor
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = config.theme.primaryColor
                            e.currentTarget.style.color = '#FFFFFF'
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = 'transparent'
                            e.currentTarget.style.color = config.theme.primaryColor
                          }}
                          onFocus={(e) => {
                            e.currentTarget.style.backgroundColor = config.theme.primaryColor
                            e.currentTarget.style.color = '#FFFFFF'
                          }}
                          onBlur={(e) => {
                            e.currentTarget.style.backgroundColor = 'transparent'
                            e.currentTarget.style.color = config.theme.primaryColor
                          }}
                        >
                          {option}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}

            {/* Typing indicator */}
            {isTyping && config.theme.typingIndicatorEnabled && (
              <div className="flex justify-start" role="status" aria-label={`${config.theme.botName} is typing`}>
                <div
                  className="px-4 py-3 rounded-2xl rounded-bl-md"
                  style={{ backgroundColor: config.theme.backgroundColor }}
                >
                  <div className="flex space-x-1">
                    <div className="w-2 h-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                    <div className="w-2 h-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                    <div className="w-2 h-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            )}

            {/* Completion state */}
            {isCompleted && (
              <div className="text-center py-4">
                {referenceNumber && config.settings.showReferenceNumber && (
                  <div
                    className="inline-flex items-center space-x-2 px-4 py-2 rounded-lg mb-4"
                    style={{ backgroundColor: config.theme.primaryColor + '20' }}
                    role="status"
                  >
                    <CheckCircle className="w-5 h-5" style={{ color: config.theme.primaryColor }} aria-hidden="true" />
                    <span className="text-sm font-medium" style={{ color: config.theme.primaryColor }}>
                      Reference: {referenceNumber}
                    </span>
                  </div>
                )}
                {config.settings.allowRestart && (
                  <button
                    onClick={handleRestart}
                    className="inline-flex items-center space-x-2 px-4 py-2 rounded-lg text-white transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2"
                    style={{ backgroundColor: config.theme.primaryColor }}
                  >
                    <RefreshCw className="w-4 h-4" aria-hidden="true" />
                    <span>{config.settings.thankYouButtonText}</span>
                  </button>
                )}
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          {!isCompleted && currentNode && !['message', 'end', 'single_choice', 'multiple_choice'].includes((currentNode as Record<string, string>).type) && (
            <div
              className="p-4 border-t"
              style={{ borderColor: config.theme.secondaryColor }}
            >
              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  handleSubmit()
                }}
                className="flex items-center space-x-2"
              >
                <label htmlFor="chat-input" className="sr-only">
                  Type your message
                </label>
                <input
                  id="chat-input"
                  ref={inputRef}
                  type={
                    (currentNode as Record<string, string>).type === 'email_input' ? 'email' :
                    (currentNode as Record<string, string>).type === 'phone_input' ? 'tel' :
                    (currentNode as Record<string, string>).type === 'number_input' ? 'number' :
                    'text'
                  }
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  placeholder={currentNodeData?.data?.placeholder as string || 'Type your answer...'}
                  aria-describedby={!isOnline ? 'offline-notice' : undefined}
                  className="flex-1 px-4 py-2 rounded-lg border focus:outline-none focus:ring-2"
                  style={{
                    borderColor: config.theme.secondaryColor,
                    color: config.theme.textColor
                  }}
                />
                <button
                  type="submit"
                  disabled={!inputValue.trim()}
                  aria-label="Send message"
                  className="p-2 rounded-lg text-white transition-colors disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-offset-2"
                  style={{ backgroundColor: config.theme.primaryColor }}
                >
                  <Send className="w-5 h-5" aria-hidden="true" />
                </button>
              </form>
              {!isOnline && (
                <p id="offline-notice" className="mt-1 text-xs text-yellow-500">
                  Messages will be queued until you&apos;re back online
                </p>
              )}
            </div>
          )}

          {/* Powered by */}
          <div className="px-4 py-2 text-center border-t" style={{ borderColor: config.theme.secondaryColor }}>
            <p className="text-xs text-gray-400">
              Powered by <a href="https://loans360.com" target="_blank" rel="noopener noreferrer" className="text-orange-500 hover:underline focus:outline-none focus:underline">Loans360</a>
            </p>
          </div>
        </div>
      )}

      {/* Screen reader only styles */}
      <style jsx global>{`
        .sr-only {
          position: absolute;
          width: 1px;
          height: 1px;
          padding: 0;
          margin: -1px;
          overflow: hidden;
          clip: rect(0, 0, 0, 0);
          white-space: nowrap;
          border: 0;
        }
        .focus\\:not-sr-only:focus {
          position: static;
          width: auto;
          height: auto;
          padding: 0;
          margin: 0;
          overflow: visible;
          clip: auto;
          white-space: normal;
        }
      `}</style>
    </>
  )
}

// Export wrapped in error boundary
export default function ChatWidget(props: ChatWidgetProps) {
  return (
    <ChatWidgetErrorBoundary
      onError={(error, errorInfo) => {
        // Log to analytics/error tracking service
        console.error('ChatWidget Error:', error, errorInfo)
      }}
    >
      <ChatWidgetInner {...props} />
    </ChatWidgetErrorBoundary>
  )
}
