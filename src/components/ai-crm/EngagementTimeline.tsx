'use client'

import { Phone, FileText, Mic, Bot, Settings, Clock } from 'lucide-react'

interface NoteEntry {
  id: string
  type: string
  content?: string
  timestamp?: string
  created_at: string
  created_by_name?: string
  ai_rating?: number
  sentiment?: string
  interest_level?: string
  call_duration?: number
  coaching_feedback?: string
  key_points?: string[]
  positive_points?: string[]
  improvement_points?: string[]
}

const typeConfig: Record<string, { icon: typeof Phone; color: string; label: string }> = {
  call_log: { icon: Phone, color: 'text-blue-400', label: 'Call' },
  call_recording: { icon: Mic, color: 'text-purple-400', label: 'Recording' },
  manual_note: { icon: FileText, color: 'text-orange-400', label: 'Note' },
  ai_transcript: { icon: Bot, color: 'text-cyan-400', label: 'AI Transcript' },
  system_event: { icon: Settings, color: 'text-gray-400', label: 'System' },
}

const sentimentColors: Record<string, string> = {
  positive: 'bg-green-500/20 text-green-400',
  negative: 'bg-red-500/20 text-red-400',
  neutral: 'bg-gray-500/20 text-gray-400',
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`
}

function formatTimeAgo(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
}

interface EngagementTimelineProps {
  events: NoteEntry[]
}

export default function EngagementTimeline({ events }: EngagementTimelineProps) {
  if (!events || events.length === 0) {
    return (
      <div className="bg-white/5 rounded-xl p-6 border border-white/10 text-center">
        <Clock className="w-8 h-8 text-gray-500 mx-auto mb-2" />
        <p className="text-sm text-gray-400">No engagement history yet</p>
      </div>
    )
  }

  return (
    <div className="bg-white/5 rounded-xl p-5 border border-white/10">
      <h3 className="text-sm font-semibold text-white mb-4">Engagement Timeline</h3>
      <div className="relative space-y-0">
        {/* Timeline line */}
        <div className="absolute left-[15px] top-2 bottom-2 w-px bg-white/10" />

        {events.map((event, idx) => {
          const config = typeConfig[event.type] || typeConfig.system_event
          const Icon = config.icon

          return (
            <div key={event.id || idx} className="relative pl-10 pb-4 last:pb-0">
              {/* Timeline dot */}
              <div className={`absolute left-2 top-1.5 w-[14px] h-[14px] rounded-full border-2 border-gray-800 bg-gray-900 flex items-center justify-center`}>
                <div className={`w-2 h-2 rounded-full ${config.color.replace('text-', 'bg-')}`} />
              </div>

              <div className="bg-white/5 rounded-lg p-3 border border-white/5 hover:border-white/10 transition-colors">
                {/* Header */}
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <Icon className={`w-3.5 h-3.5 ${config.color}`} />
                    <span className="text-xs font-medium text-gray-300">{config.label}</span>
                    {event.sentiment && (
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${sentimentColors[event.sentiment] || sentimentColors.neutral}`}>
                        {event.sentiment}
                      </span>
                    )}
                    {event.ai_rating != null && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-cyan-500/20 text-cyan-400">
                        AI: {event.ai_rating}/10
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] text-gray-500">
                    {formatTimeAgo(event.timestamp || event.created_at)}
                  </span>
                </div>

                {/* Content */}
                {event.content && (
                  <p className="text-sm text-gray-300 mb-2 whitespace-pre-line">{event.content}</p>
                )}

                {/* Call duration */}
                {event.call_duration != null && event.call_duration > 0 && (
                  <p className="text-xs text-gray-500 mb-1.5">
                    Duration: {formatDuration(event.call_duration)}
                  </p>
                )}

                {/* Key points */}
                {event.key_points && event.key_points.length > 0 && (
                  <div className="mt-2">
                    <p className="text-[10px] uppercase tracking-wider text-gray-500 mb-1">Key Points</p>
                    <ul className="space-y-0.5">
                      {event.key_points.map((point, i) => (
                        <li key={i} className="text-xs text-gray-400 flex items-start gap-1.5">
                          <span className="text-orange-400 mt-0.5 shrink-0">-</span>
                          {point}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Coaching feedback */}
                {event.coaching_feedback && (
                  <div className="mt-2 p-2 bg-cyan-500/5 rounded border border-cyan-500/10">
                    <p className="text-[10px] uppercase tracking-wider text-cyan-400 mb-0.5">AI Coaching</p>
                    <p className="text-xs text-gray-300">{event.coaching_feedback}</p>
                  </div>
                )}

                {/* Created by */}
                {event.created_by_name && (
                  <p className="text-[10px] text-gray-600 mt-1.5">by {event.created_by_name}</p>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
