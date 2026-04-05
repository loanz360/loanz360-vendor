'use client'

import { useState, useMemo, useCallback, useRef, useEffect } from 'react'
import {
  Mail,
  MessageSquare,
  Bell,
  Phone,
  Smartphone,
  Search,
  Star,
  StarOff,
  Tag,
  MoreHorizontal,
  Send,
  Paperclip,
  Check,
  CheckCheck,
  AlertCircle,
  Clock,
  X,
  ChevronDown,
  User,
  Loader2,
  Inbox,
  Filter,
  Eye,
  EyeOff,
  UserPlus,
  Hash,
  ArrowDownLeft,
  ArrowUpRight,
} from 'lucide-react'

// ─── Types ──────────────────────────────────────────────────────────────────

export interface ConversationMessage {
  id: string
  channel: 'email' | 'sms' | 'push' | 'whatsapp' | 'in_app'
  direction: 'inbound' | 'outbound'
  content: string
  subject?: string
  sender_name: string
  sender_role?: string
  timestamp: string
  status: 'sent' | 'delivered' | 'read' | 'failed'
  attachments?: Array<{ name: string; url: string; type: string }>
}

export interface Conversation {
  id: string
  user_id: string
  user_name: string
  user_email?: string
  user_role: string
  avatar_url?: string
  channel: string
  last_message: string
  last_message_at: string
  unread_count: number
  is_starred: boolean
  tags: string[]
  messages: ConversationMessage[]
}

export interface OmnichannelInboxProps {
  conversations: Conversation[]
  selectedConversationId?: string
  onSelectConversation?: (id: string) => void
  onSendReply?: (conversationId: string, message: string, channel: string) => Promise<void>
  onMarkRead?: (conversationId: string) => void
  onStar?: (conversationId: string) => void
  onAddTag?: (conversationId: string, tag: string) => void
  loading?: boolean
}

// ─── Constants ──────────────────────────────────────────────────────────────

type ChannelKey = 'all' | 'email' | 'sms' | 'push' | 'whatsapp' | 'in_app'

const CHANNEL_TABS: Array<{ key: ChannelKey; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { key: 'all', label: 'All', icon: Inbox },
  { key: 'email', label: 'Email', icon: Mail },
  { key: 'sms', label: 'SMS', icon: MessageSquare },
  { key: 'push', label: 'Push', icon: Bell },
  { key: 'whatsapp', label: 'WhatsApp', icon: Phone },
  { key: 'in_app', label: 'In-App', icon: Smartphone },
]

const CHANNEL_COLORS: Record<string, string> = {
  email: 'text-blue-400',
  sms: 'text-green-400',
  push: 'text-purple-400',
  whatsapp: 'text-emerald-400',
  in_app: 'text-[#FF6700]',
}

const CHANNEL_BG: Record<string, string> = {
  email: 'bg-blue-900/30 border-blue-800/40',
  sms: 'bg-green-900/30 border-green-800/40',
  push: 'bg-purple-900/30 border-purple-800/40',
  whatsapp: 'bg-emerald-900/30 border-emerald-800/40',
  in_app: 'bg-[#FF6700]/10 border-[#FF6700]/20',
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatTimestamp(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  const diff = now.getTime() - d.getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'Now'
  if (mins < 60) return `${mins}m`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h`
  const days = Math.floor(hrs / 24)
  if (days < 7) return `${days}d`
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
}

function formatFullTimestamp(iso: string): string {
  return new Date(iso).toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

function ChannelIcon({ channel, size = 14 }: { channel: string; size?: number }) {
  const cls = CHANNEL_COLORS[channel] || 'text-zinc-400'
  switch (channel) {
    case 'email': return <Mail size={size} className={cls} />
    case 'sms': return <MessageSquare size={size} className={cls} />
    case 'push': return <Bell size={size} className={cls} />
    case 'whatsapp': return <Phone size={size} className={cls} />
    case 'in_app': return <Smartphone size={size} className={cls} />
    default: return <Inbox size={size} className={cls} />
  }
}

function StatusIcon({ status }: { status: ConversationMessage['status'] }) {
  switch (status) {
    case 'sent': return <Check size={12} className="text-zinc-500" />
    case 'delivered': return <CheckCheck size={12} className="text-zinc-500" />
    case 'read': return <CheckCheck size={12} className="text-blue-400" />
    case 'failed': return <AlertCircle size={12} className="text-red-400" />
  }
}

function RoleBadge({ role }: { role: string }) {
  return (
    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-zinc-800 text-zinc-400 border border-zinc-700 uppercase tracking-wider">
      {role}
    </span>
  )
}

// ─── Conversation List Item ─────────────────────────────────────────────────

function ConversationItem({
  conversation,
  isSelected,
  onClick,
}: {
  conversation: Conversation
  isSelected: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-4 py-3 border-b border-zinc-800/60 transition-colors ${
        isSelected
          ? 'bg-[#FF6700]/[0.06] border-l-2 border-l-[#FF6700]'
          : 'hover:bg-zinc-800/40 border-l-2 border-l-transparent'
      }`}
    >
      <div className="flex items-start gap-3">
        {/* Avatar */}
        <div className="relative shrink-0">
          {conversation.avatar_url ? (
            <img
              src={conversation.avatar_url}
              alt=""
              className="w-9 h-9 rounded-full object-cover"
            />
          ) : (
            <div className="w-9 h-9 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center text-xs font-semibold text-zinc-400">
              {getInitials(conversation.user_name)}
            </div>
          )}
          {conversation.unread_count > 0 && (
            <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-[#FF6700] flex items-center justify-center">
              <span className="text-[9px] font-bold text-white">{conversation.unread_count > 9 ? '9+' : conversation.unread_count}</span>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className={`text-sm truncate ${conversation.unread_count > 0 ? 'font-semibold text-white' : 'font-medium text-zinc-300'}`}>
              {conversation.user_name}
            </span>
            <span className="text-[10px] text-zinc-500 shrink-0">{formatTimestamp(conversation.last_message_at)}</span>
          </div>
          <div className="flex items-center gap-1.5 mt-0.5">
            <RoleBadge role={conversation.user_role} />
            <ChannelIcon channel={conversation.channel} size={11} />
          </div>
          <p className={`text-xs mt-1 truncate ${conversation.unread_count > 0 ? 'text-zinc-300' : 'text-zinc-500'}`}>
            {conversation.last_message}
          </p>
        </div>

        {/* Star indicator */}
        {conversation.is_starred && (
          <Star size={12} className="text-yellow-500 fill-yellow-500 shrink-0 mt-1" />
        )}
      </div>

      {/* Tags */}
      {conversation.tags.length > 0 && (
        <div className="flex items-center gap-1 mt-2 ml-12">
          {conversation.tags.slice(0, 3).map((tag) => (
            <span key={tag} className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-medium bg-zinc-800/80 text-zinc-500 border border-zinc-700/50">
              {tag}
            </span>
          ))}
          {conversation.tags.length > 3 && (
            <span className="text-[9px] text-zinc-600">+{conversation.tags.length - 3}</span>
          )}
        </div>
      )}
    </button>
  )
}

// ─── Message Bubble ─────────────────────────────────────────────────────────

function MessageBubble({ message }: { message: ConversationMessage }) {
  const isOutbound = message.direction === 'outbound'
  const channelBg = CHANNEL_BG[message.channel] || 'bg-zinc-800/40 border-zinc-700/40'

  // Email style
  if (message.channel === 'email') {
    return (
      <div className={`max-w-[85%] ${isOutbound ? 'ml-auto' : 'mr-auto'}`}>
        <div className={`rounded-xl border p-4 ${isOutbound ? 'bg-zinc-800/60 border-zinc-700/50' : 'bg-blue-950/20 border-blue-900/30'}`}>
          {message.subject && (
            <div className="flex items-center gap-2 mb-2 pb-2 border-b border-zinc-700/40">
              <Mail size={12} className="text-blue-400 shrink-0" />
              <span className="text-xs font-medium text-zinc-300">{message.subject}</span>
            </div>
          )}
          <div className="text-sm text-zinc-300 whitespace-pre-wrap leading-relaxed">{message.content}</div>
          {message.attachments && message.attachments.length > 0 && (
            <div className="mt-3 pt-2 border-t border-zinc-700/40 space-y-1">
              {message.attachments.map((att, i) => (
                <div key={i} className="flex items-center gap-2 text-xs text-zinc-400 hover:text-zinc-300 cursor-pointer">
                  <Paperclip size={11} />
                  <span className="truncate">{att.name}</span>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className={`flex items-center gap-2 mt-1 px-1 ${isOutbound ? 'justify-end' : ''}`}>
          <span className="text-[10px] text-zinc-600">{formatFullTimestamp(message.timestamp)}</span>
          {isOutbound && <StatusIcon status={message.status} />}
        </div>
      </div>
    )
  }

  // WhatsApp style
  if (message.channel === 'whatsapp') {
    return (
      <div className={`max-w-[75%] ${isOutbound ? 'ml-auto' : 'mr-auto'}`}>
        <div
          className={`rounded-2xl px-4 py-2.5 ${
            isOutbound
              ? 'bg-emerald-900/30 border border-emerald-800/30 rounded-br-md'
              : 'bg-zinc-800/70 border border-zinc-700/40 rounded-bl-md'
          }`}
        >
          <p className="text-sm text-zinc-200 whitespace-pre-wrap">{message.content}</p>
        </div>
        <div className={`flex items-center gap-2 mt-1 px-1 ${isOutbound ? 'justify-end' : ''}`}>
          <span className="text-[10px] text-zinc-600">{formatFullTimestamp(message.timestamp)}</span>
          {isOutbound && <StatusIcon status={message.status} />}
        </div>
      </div>
    )
  }

  // SMS / Push / In-App bubble style
  return (
    <div className={`max-w-[75%] ${isOutbound ? 'ml-auto' : 'mr-auto'}`}>
      <div
        className={`rounded-2xl px-4 py-2.5 ${
          isOutbound
            ? 'bg-[#FF6700]/15 border border-[#FF6700]/20 rounded-br-md'
            : 'bg-zinc-800/70 border border-zinc-700/40 rounded-bl-md'
        }`}
      >
        {message.channel === 'push' && message.subject && (
          <p className="text-xs font-semibold text-zinc-200 mb-1">{message.subject}</p>
        )}
        <p className="text-sm text-zinc-200 whitespace-pre-wrap">{message.content}</p>
      </div>
      <div className={`flex items-center gap-2 mt-1 px-1 ${isOutbound ? 'justify-end' : ''}`}>
        <ChannelIcon channel={message.channel} size={10} />
        <span className="text-[10px] text-zinc-600">{formatFullTimestamp(message.timestamp)}</span>
        {isOutbound && <StatusIcon status={message.status} />}
      </div>
    </div>
  )
}

// ─── Reply Composer ─────────────────────────────────────────────────────────

function ReplyComposer({
  conversationId,
  defaultChannel,
  onSend,
  sending,
}: {
  conversationId: string
  defaultChannel: string
  onSend: (message: string, channel: string) => void
  sending: boolean
}) {
  const [message, setMessage] = useState('')
  const [channel, setChannel] = useState(defaultChannel)
  const [showChannelPicker, setShowChannelPicker] = useState(false)
  const textRef = useRef<HTMLTextAreaElement>(null)

  const handleSend = () => {
    if (!message.trim() || sending) return
    onSend(message.trim(), channel)
    setMessage('')
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="border-t border-zinc-800 p-3 bg-zinc-900/80">
      {/* Channel selector */}
      <div className="flex items-center gap-2 mb-2">
        <span className="text-[10px] text-zinc-500 uppercase tracking-wider">Reply via</span>
        <div className="relative">
          <button
            onClick={() => setShowChannelPicker(!showChannelPicker)}
            className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-zinc-800 border border-zinc-700 text-xs text-zinc-300 hover:bg-zinc-700 transition-colors"
          >
            <ChannelIcon channel={channel} size={12} />
            <span className="capitalize">{channel.replace(/_/g, '-')}</span>
            <ChevronDown size={11} className="text-zinc-500" />
          </button>
          {showChannelPicker && (
            <div className="absolute bottom-full left-0 mb-1 bg-zinc-800 border border-zinc-700 rounded-lg shadow-xl overflow-hidden z-10 min-w-[140px]">
              {(['email', 'sms', 'whatsapp', 'push', 'in_app'] as const).map((ch) => (
                <button
                  key={ch}
                  onClick={() => {
                    setChannel(ch)
                    setShowChannelPicker(false)
                  }}
                  className={`w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-zinc-700 transition-colors ${
                    ch === channel ? 'text-[#FF6700]' : 'text-zinc-300'
                  }`}
                >
                  <ChannelIcon channel={ch} size={12} />
                  <span className="capitalize">{ch.replace(/_/g, '-')}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Input */}
      <div className="flex items-end gap-2">
        <textarea
          ref={textRef}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type a message..."
          rows={1}
          className="flex-1 rounded-lg bg-zinc-800 border border-zinc-700 text-sm text-white placeholder-zinc-600 px-3 py-2.5 focus:outline-none focus:border-[#FF6700]/50 focus:ring-1 focus:ring-[#FF6700]/30 resize-none max-h-24"
        />
        <button
          onClick={handleSend}
          disabled={!message.trim() || sending}
          className="p-2.5 rounded-lg bg-[#FF6700] text-white hover:bg-[#FF6700]/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
        >
          {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
        </button>
      </div>
    </div>
  )
}

// ─── User Info Sidebar ──────────────────────────────────────────────────────

function UserInfoPanel({ conversation }: { conversation: Conversation }) {
  return (
    <div className="w-64 border-l border-zinc-800 bg-zinc-900/60 p-4 hidden xl:block">
      {/* Avatar */}
      <div className="flex flex-col items-center text-center mb-5">
        {conversation.avatar_url ? (
          <img src={conversation.avatar_url} alt="" className="w-16 h-16 rounded-full object-cover mb-3" />
        ) : (
          <div className="w-16 h-16 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center text-lg font-bold text-zinc-400 mb-3">
            {getInitials(conversation.user_name)}
          </div>
        )}
        <h4 className="text-sm font-semibold text-white">{conversation.user_name}</h4>
        <RoleBadge role={conversation.user_role} />
      </div>

      {/* Info rows */}
      <div className="space-y-3">
        {conversation.user_email && (
          <div className="flex items-center gap-2">
            <Mail size={13} className="text-zinc-500 shrink-0" />
            <span className="text-xs text-zinc-400 truncate">{conversation.user_email}</span>
          </div>
        )}
        <div className="flex items-center gap-2">
          <Hash size={13} className="text-zinc-500 shrink-0" />
          <span className="text-xs text-zinc-400 truncate">ID: {conversation.user_id.slice(0, 8)}...</span>
        </div>
        <div className="flex items-center gap-2">
          <Clock size={13} className="text-zinc-500 shrink-0" />
          <span className="text-xs text-zinc-400">Last: {formatFullTimestamp(conversation.last_message_at)}</span>
        </div>
      </div>

      {/* Tags */}
      {conversation.tags.length > 0 && (
        <div className="mt-5 pt-4 border-t border-zinc-800">
          <h5 className="text-[10px] uppercase tracking-wider text-zinc-500 font-medium mb-2">Tags</h5>
          <div className="flex flex-wrap gap-1">
            {conversation.tags.map((tag) => (
              <span key={tag} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] bg-zinc-800 text-zinc-400 border border-zinc-700">
                <Tag size={9} />
                {tag}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Main Component ─────────────────────────────────────────────────────────

export default function OmnichannelInbox({
  conversations,
  selectedConversationId,
  onSelectConversation,
  onSendReply,
  onMarkRead,
  onStar,
  onAddTag,
  loading = false,
}: OmnichannelInboxProps) {
  const [activeTab, setActiveTab] = useState<ChannelKey>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [internalSelectedId, setInternalSelectedId] = useState<string | undefined>(selectedConversationId)
  const [sending, setSending] = useState(false)
  const [showMobileDetail, setShowMobileDetail] = useState(false)
  const [tagInput, setTagInput] = useState('')
  const [showTagInput, setShowTagInput] = useState(false)
  const [showActions, setShowActions] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const selectedId = selectedConversationId ?? internalSelectedId

  const filtered = useMemo(() => {
    let list = conversations
    if (activeTab !== 'all') {
      list = list.filter((c) => c.channel === activeTab)
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      list = list.filter(
        (c) =>
          c.user_name.toLowerCase().includes(q) ||
          c.last_message.toLowerCase().includes(q) ||
          c.user_email?.toLowerCase().includes(q) ||
          c.tags.some((t) => t.toLowerCase().includes(q))
      )
    }
    return [...list].sort((a, b) => new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime())
  }, [conversations, activeTab, searchQuery])

  const selectedConv = useMemo(
    () => conversations.find((c) => c.id === selectedId),
    [conversations, selectedId]
  )

  const tabCounts = useMemo(() => {
    const counts: Record<string, number> = { all: 0 }
    conversations.forEach((c) => {
      if (c.unread_count > 0) {
        counts.all = (counts.all || 0) + 1
        counts[c.channel] = (counts[c.channel] || 0) + 1
      }
    })
    return counts
  }, [conversations])

  const handleSelect = (id: string) => {
    setInternalSelectedId(id)
    onSelectConversation?.(id)
    setShowMobileDetail(true)
  }

  const handleSend = useCallback(
    async (message: string, channel: string) => {
      if (!selectedId || !onSendReply) return
      setSending(true)
      try {
        await onSendReply(selectedId, message, channel)
      } finally {
        setSending(false)
      }
    },
    [selectedId, onSendReply]
  )

  const handleAddTag = () => {
    if (!tagInput.trim() || !selectedId || !onAddTag) return
    onAddTag(selectedId, tagInput.trim())
    setTagInput('')
    setShowTagInput(false)
  }

  // Auto-scroll to bottom on message change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [selectedConv?.messages?.length])

  return (
    <div className="flex flex-col h-[calc(100vh-120px)] min-h-[500px] rounded-xl border border-zinc-800 bg-black overflow-hidden">
      {/* Channel Tabs */}
      <div className="flex items-center gap-1 px-3 py-2 border-b border-zinc-800 bg-zinc-900/60 overflow-x-auto scrollbar-none">
        {CHANNEL_TABS.map((tab) => {
          const Icon = tab.icon
          const count = tabCounts[tab.key] || 0
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                activeTab === tab.key
                  ? 'bg-[#FF6700]/10 text-[#FF6700] border border-[#FF6700]/20'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 border border-transparent'
              }`}
            >
              <Icon size={13} />
              {tab.label}
              {count > 0 && (
                <span className={`ml-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold ${
                  activeTab === tab.key ? 'bg-[#FF6700] text-white' : 'bg-zinc-700 text-zinc-300'
                }`}>
                  {count}
                </span>
              )}
            </button>
          )
        })}
      </div>

      <div className="flex flex-1 min-h-0">
        {/* ─── Left: Conversation List ─── */}
        <div
          className={`w-full sm:w-80 lg:w-96 border-r border-zinc-800 flex flex-col bg-zinc-950/50 shrink-0 ${
            showMobileDetail ? 'hidden sm:flex' : 'flex'
          }`}
        >
          {/* Search */}
          <div className="p-3 border-b border-zinc-800">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search conversations..."
                className="w-full pl-9 pr-3 py-2 rounded-lg bg-zinc-800/60 border border-zinc-700 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-[#FF6700]/50 focus:ring-1 focus:ring-[#FF6700]/30"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded hover:bg-zinc-700 text-zinc-500"
                >
                  <X size={12} />
                </button>
              )}
            </div>
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto scrollbar-thin">
            {loading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 size={20} className="animate-spin text-[#FF6700]" />
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center px-4">
                <Inbox size={28} className="text-zinc-700 mb-3" />
                <p className="text-sm text-zinc-500">No conversations found</p>
                <p className="text-xs text-zinc-600 mt-1">
                  {searchQuery ? 'Try a different search term' : 'Messages will appear here'}
                </p>
              </div>
            ) : (
              filtered.map((conv) => (
                <ConversationItem
                  key={conv.id}
                  conversation={conv}
                  isSelected={conv.id === selectedId}
                  onClick={() => handleSelect(conv.id)}
                />
              ))
            )}
          </div>
        </div>

        {/* ─── Right: Message Detail ─── */}
        {selectedConv ? (
          <div className={`flex-1 flex min-w-0 ${!showMobileDetail ? 'hidden sm:flex' : 'flex'}`}>
            <div className="flex-1 flex flex-col min-w-0">
              {/* Conversation header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800 bg-zinc-900/60">
                <div className="flex items-center gap-3 min-w-0">
                  {/* Back button on mobile */}
                  <button
                    onClick={() => setShowMobileDetail(false)}
                    className="sm:hidden p-1 rounded hover:bg-zinc-800 text-zinc-400"
                  >
                    <X size={18} />
                  </button>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-semibold text-white truncate">{selectedConv.user_name}</h3>
                      <RoleBadge role={selectedConv.user_role} />
                      <ChannelIcon channel={selectedConv.channel} size={13} />
                    </div>
                    {selectedConv.user_email && (
                      <p className="text-[11px] text-zinc-500 truncate">{selectedConv.user_email}</p>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 shrink-0">
                  {onStar && (
                    <button
                      onClick={() => onStar(selectedConv.id)}
                      className="p-2 rounded-lg hover:bg-zinc-800 transition-colors text-zinc-400 hover:text-yellow-400"
                      title={selectedConv.is_starred ? 'Unstar' : 'Star'}
                    >
                      {selectedConv.is_starred ? (
                        <Star size={15} className="text-yellow-500 fill-yellow-500" />
                      ) : (
                        <StarOff size={15} />
                      )}
                    </button>
                  )}
                  {onMarkRead && (
                    <button
                      onClick={() => onMarkRead(selectedConv.id)}
                      className="p-2 rounded-lg hover:bg-zinc-800 transition-colors text-zinc-400 hover:text-white"
                      title="Mark as read"
                    >
                      <Eye size={15} />
                    </button>
                  )}
                  <div className="relative">
                    <button
                      onClick={() => setShowActions(!showActions)}
                      className="p-2 rounded-lg hover:bg-zinc-800 transition-colors text-zinc-400 hover:text-white"
                    >
                      <MoreHorizontal size={15} />
                    </button>
                    {showActions && (
                      <div className="absolute right-0 top-full mt-1 bg-zinc-800 border border-zinc-700 rounded-lg shadow-xl overflow-hidden z-10 min-w-[160px]">
                        {onAddTag && (
                          <button
                            onClick={() => {
                              setShowTagInput(true)
                              setShowActions(false)
                            }}
                            className="w-full flex items-center gap-2 px-3 py-2 text-xs text-zinc-300 hover:bg-zinc-700 transition-colors"
                          >
                            <Tag size={12} />
                            Add Tag
                          </button>
                        )}
                        {onMarkRead && (
                          <button
                            onClick={() => {
                              onMarkRead(selectedConv.id)
                              setShowActions(false)
                            }}
                            className="w-full flex items-center gap-2 px-3 py-2 text-xs text-zinc-300 hover:bg-zinc-700 transition-colors"
                          >
                            <EyeOff size={12} />
                            Mark Unread
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Tag input bar */}
              {showTagInput && (
                <div className="flex items-center gap-2 px-4 py-2 border-b border-zinc-800 bg-zinc-900/40">
                  <Tag size={13} className="text-zinc-500 shrink-0" />
                  <input
                    type="text"
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddTag()}
                    placeholder="Enter tag name..."
                    className="flex-1 bg-transparent text-sm text-white placeholder-zinc-600 focus:outline-none"
                    autoFocus
                  />
                  <button
                    onClick={handleAddTag}
                    disabled={!tagInput.trim()}
                    className="px-2 py-1 text-xs rounded bg-[#FF6700] text-white disabled:opacity-40"
                  >
                    Add
                  </button>
                  <button
                    onClick={() => { setShowTagInput(false); setTagInput('') }}
                    className="p-1 rounded hover:bg-zinc-700 text-zinc-500"
                  >
                    <X size={12} />
                  </button>
                </div>
              )}

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin">
                {selectedConv.messages.map((msg) => (
                  <div key={msg.id}>
                    {/* Direction indicator */}
                    <div className={`flex items-center gap-1.5 mb-1 ${msg.direction === 'outbound' ? 'justify-end' : ''}`}>
                      {msg.direction === 'inbound' ? (
                        <ArrowDownLeft size={10} className="text-zinc-600" />
                      ) : (
                        <ArrowUpRight size={10} className="text-zinc-600" />
                      )}
                      <span className="text-[10px] text-zinc-600 font-medium">{msg.sender_name}</span>
                      {msg.sender_role && (
                        <span className="text-[9px] text-zinc-700">({msg.sender_role})</span>
                      )}
                    </div>
                    <MessageBubble message={msg} />
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>

              {/* Reply composer */}
              {onSendReply && (
                <ReplyComposer
                  conversationId={selectedConv.id}
                  defaultChannel={selectedConv.channel}
                  onSend={handleSend}
                  sending={sending}
                />
              )}
            </div>

            {/* User info sidebar */}
            <UserInfoPanel conversation={selectedConv} />
          </div>
        ) : (
          <div className={`flex-1 flex items-center justify-center ${!showMobileDetail ? 'hidden sm:flex' : 'flex'}`}>
            <div className="text-center">
              <div className="p-4 rounded-2xl bg-zinc-800/30 inline-block mb-4">
                <Inbox size={36} className="text-zinc-700" />
              </div>
              <h3 className="text-sm font-medium text-zinc-500 mb-1">Select a conversation</h3>
              <p className="text-xs text-zinc-600">Choose from the list to view messages</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
