'use client'

import React, { useState, useRef, useEffect, useCallback } from 'react'
import { MessageCircle, X, Send, Loader2, Bot, Minimize2, Maximize2 } from 'lucide-react'

interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

const MAX_MESSAGES = 100

let messageCounter = 0
function generateMessageId(): string {
  return `msg-${Date.now()}-${++messageCounter}`
}

export default function KBChatWidget() {
  const [isOpen, setIsOpen] = useState(false)
  const [isMinimized, setIsMinimized] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: 'Hi! I\'m your Knowledge Base assistant. Ask me anything about loan products, banking terms, document requirements, or sales processes.',
      timestamp: new Date(),
    }
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    if (isOpen && !isMinimized) {
      inputRef.current?.focus()
    }
  }, [isOpen, isMinimized])

  const sendMessageWithText = useCallback(async (text: string) => {
    const trimmed = text.trim()
    if (!trimmed || loading) return

    const userMessage: ChatMessage = {
      id: generateMessageId(),
      role: 'user',
      content: trimmed,
      timestamp: new Date(),
    }

    setMessages(prev => {
      const updated = [...prev, userMessage]
      // Cap messages to prevent unbounded growth
      return updated.length > MAX_MESSAGES ? updated.slice(-MAX_MESSAGES) : updated
    })
    setInput('')
    setLoading(true)

    try {
      const response = await fetch('/api/knowledge-base/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: trimmed,
          context: 'dse_tools',
          history: messages.slice(-6).map(m => ({ role: m.role, content: m.content })),
        }),
      })

      if (!response.ok) throw new Error('Failed to get response')

      const data = await response.json()

      const assistantMessage: ChatMessage = {
        id: generateMessageId(),
        role: 'assistant',
        content: data.answer || data.response || 'I apologize, but I couldn\'t find a specific answer. Please try rephrasing your question or check the Knowledge Base categories directly.',
        timestamp: new Date(),
      }

      setMessages(prev => {
        const updated = [...prev, assistantMessage]
        return updated.length > MAX_MESSAGES ? updated.slice(-MAX_MESSAGES) : updated
      })
    } catch {
      setMessages(prev => [...prev, {
        id: generateMessageId(),
        role: 'assistant',
        content: 'I\'m having trouble connecting right now. Please try again or browse the Knowledge Base directly for answers.',
        timestamp: new Date(),
      }])
    } finally {
      setLoading(false)
    }
  }, [loading, messages])

  const handleSend = useCallback(() => {
    sendMessageWithText(input)
  }, [input, sendMessageWithText])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const quickQuestions = [
    'What documents needed for home loan?',
    'How to calculate eligibility?',
    'What is FOIR?',
    'Home loan tax benefits?',
  ]

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 z-50 bg-gradient-to-r from-orange-500 to-orange-600 text-white p-4 rounded-full shadow-lg shadow-orange-500/30 hover:shadow-xl hover:shadow-orange-500/40 transition-all hover:scale-105"
        aria-label="Open KB Assistant"
      >
        <MessageCircle className="w-6 h-6" />
      </button>
    )
  }

  return (
    <div
      className={`fixed bottom-6 right-6 z-50 bg-[#1A1A1A] border border-white/10 rounded-2xl shadow-2xl flex flex-col transition-all max-w-[calc(100vw-3rem)] ${
        isMinimized ? 'w-80 h-14' : 'w-96 h-[550px]'
      }`}
      role="dialog"
      aria-label="Knowledge Base Chat Assistant"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-orange-500 to-orange-600 rounded-t-2xl cursor-pointer"
        onClick={() => isMinimized && setIsMinimized(false)}
      >
        <div className="flex items-center gap-2">
          <Bot className="w-5 h-5 text-white" />
          <span className="font-semibold text-white text-sm">KB Assistant</span>
          {loading && <Loader2 className="w-4 h-4 text-white animate-spin" />}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={(e) => { e.stopPropagation(); setIsMinimized(!isMinimized) }}
            className="p-1 hover:bg-white/20 rounded"
            aria-label={isMinimized ? 'Maximize' : 'Minimize'}
          >
            {isMinimized ? <Maximize2 className="w-4 h-4 text-white" /> : <Minimize2 className="w-4 h-4 text-white" />}
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); setIsOpen(false) }}
            className="p-1 hover:bg-white/20 rounded"
            aria-label="Close chat"
          >
            <X className="w-4 h-4 text-white" />
          </button>
        </div>
      </div>

      {!isMinimized && (
        <>
          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3" aria-live="polite">
            {messages.map(msg => (
              <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] rounded-xl px-3 py-2 text-sm ${
                  msg.role === 'user'
                    ? 'bg-orange-500 text-white'
                    : 'bg-white/10 text-gray-200'
                }`}>
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-white/10 rounded-xl px-4 py-3">
                  <div className="flex gap-1">
                    <div className="w-2 h-2 bg-orange-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <div className="w-2 h-2 bg-orange-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <div className="w-2 h-2 bg-orange-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />

            {/* Quick Questions (show only at start) */}
            {messages.length <= 1 && (
              <div className="space-y-2 mt-2">
                <p className="text-xs text-gray-500">Quick questions:</p>
                {quickQuestions.map(q => (
                  <button
                    key={q}
                    onClick={() => sendMessageWithText(q)}
                    className="block w-full text-left text-xs px-3 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-gray-300 transition-colors"
                  >
                    {q}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Input */}
          <div className="p-3 border-t border-white/10">
            <div className="flex gap-2">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask about loans, banking terms..."
                className="flex-1 px-3 py-2 bg-black border border-white/20 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500"
                aria-label="Type your question"
              />
              <button
                onClick={handleSend}
                disabled={!input.trim() || loading}
                className="px-3 py-2 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white rounded-lg"
                aria-label="Send message"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
