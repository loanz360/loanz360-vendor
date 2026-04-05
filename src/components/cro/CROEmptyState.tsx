'use client'

import React from 'react'
import {
  Users,
  Target,
  Briefcase,
  Calendar,
  Activity,
  Search,
  FileText,
  MessageCircle,
  Phone,
  Inbox,
} from 'lucide-react'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CROEmptyStateProps {
  /** Custom icon node. Overrides preset icon when `type` is also provided. */
  icon?: React.ReactNode
  /** Main heading. Overrides preset title when `type` is also provided. */
  title?: string
  /** Supporting text. Overrides preset description when `type` is also provided. */
  description?: string
  /** Primary CTA button label */
  actionLabel?: string
  /** Primary CTA handler */
  onAction?: () => void
  /** Secondary text-link label */
  secondaryActionLabel?: string
  /** Secondary text-link handler */
  onSecondaryAction?: () => void
  /** Layout variant */
  variant?: 'default' | 'compact' | 'inline'
  /**
   * Preset key -- resolves icon, title, and description from EMPTY_STATES.
   * Explicit icon / title / description props override the preset values.
   */
  type?: keyof typeof EMPTY_STATES_INTERNAL
}

// ---------------------------------------------------------------------------
// Internal preset lookup (used by `type` prop for backward-compat)
// ---------------------------------------------------------------------------

const EMPTY_STATES_INTERNAL: Record<string, { icon: React.ReactNode; title: string; description: string; actionLabel?: string }> = {
  contacts: {
    icon: <Users className="w-6 h-6 text-gray-400" />,
    title: 'No contacts yet',
    description: 'Start by adding contacts to your pipeline',
    actionLabel: 'Add Contact',
  },
  leads: {
    icon: <Target className="w-6 h-6 text-gray-400" />,
    title: 'No leads yet',
    description: 'Convert your positive contacts to leads',
    actionLabel: 'View Contacts',
  },
  deals: {
    icon: <Briefcase className="w-6 h-6 text-gray-400" />,
    title: 'No deals yet',
    description: 'Qualify your leads to create deals',
  },
  followups: {
    icon: <Calendar className="w-6 h-6 text-gray-400" />,
    title: 'No follow-ups scheduled',
    description: 'Schedule follow-ups with your contacts and leads',
    actionLabel: 'New Follow-up',
  },
  activities: {
    icon: <Activity className="w-6 h-6 text-gray-400" />,
    title: 'No recent activity',
    description: 'Your activity feed will appear here as you work',
  },
  search: {
    icon: <Search className="w-6 h-6 text-gray-400" />,
    title: 'No results found',
    description: 'Try adjusting your search or filters',
  },
  documents: {
    icon: <FileText className="w-6 h-6 text-gray-400" />,
    title: 'No documents uploaded',
    description: 'Upload documents for this application',
    actionLabel: 'Upload Document',
  },
  chat: {
    icon: <MessageCircle className="w-6 h-6 text-gray-400" />,
    title: 'No messages yet',
    description: 'Start a conversation with your leads',
  },
  // Legacy presets (from the old component -- kept for backward compatibility)
  calls: {
    icon: <Phone className="w-6 h-6 text-gray-400" />,
    title: 'No call logs',
    description: 'Your call history will appear here once you start making calls.',
  },
  generic: {
    icon: <Inbox className="w-6 h-6 text-gray-400" />,
    title: 'Nothing to show',
    description: 'There is no data to display at the moment.',
  },
}

// ---------------------------------------------------------------------------
// Public preset export (matches specification exactly)
// ---------------------------------------------------------------------------

export const EMPTY_STATES = {
  contacts: EMPTY_STATES_INTERNAL.contacts,
  leads: EMPTY_STATES_INTERNAL.leads,
  deals: EMPTY_STATES_INTERNAL.deals,
  followups: EMPTY_STATES_INTERNAL.followups,
  activities: EMPTY_STATES_INTERNAL.activities,
  search: EMPTY_STATES_INTERNAL.search,
  documents: EMPTY_STATES_INTERNAL.documents,
  chat: EMPTY_STATES_INTERNAL.chat,
} as const

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function CROEmptyState({
  icon: iconProp,
  title: titleProp,
  description: descriptionProp,
  actionLabel: actionLabelProp,
  onAction,
  secondaryActionLabel,
  onSecondaryAction,
  variant = 'default',
  type,
}: CROEmptyStateProps) {
  // Resolve preset (if `type` provided), then let explicit props override
  const preset = type ? EMPTY_STATES_INTERNAL[type] : null
  const icon = iconProp ?? preset?.icon
  const title = titleProp ?? preset?.title ?? ''
  const description = descriptionProp ?? preset?.description
  const actionLabel = actionLabelProp ?? (onAction ? preset?.actionLabel : undefined)

  // ---- Inline variant (horizontal layout for table rows) ------------------
  if (variant === 'inline') {
    return (
      <div className="flex items-center gap-3 px-4 py-3">
        {icon && (
          <div className="w-8 h-8 rounded-full bg-gray-800 border border-gray-700 flex items-center justify-center shrink-0">
            <span className="[&_svg]:w-4 [&_svg]:h-4 [&_svg]:text-gray-400">
              {icon}
            </span>
          </div>
        )}
        <div className="flex items-center gap-3">
          <p className="text-sm font-medium text-gray-300">{title}</p>
          {description && (
            <p className="text-xs text-gray-500">{description}</p>
          )}
          {actionLabel && onAction && (
            <button
              onClick={onAction}
              className="text-xs font-medium text-[#FF6700] hover:text-[#ff8533] transition-colors"
            >
              {actionLabel}
            </button>
          )}
        </div>
      </div>
    )
  }

  // ---- Compact variant (for cards / sections) -----------------------------
  if (variant === 'compact') {
    return (
      <div className="flex flex-col items-center justify-center py-8 px-4">
        {icon && (
          <div className="w-10 h-10 rounded-full bg-gray-800 border border-gray-700 flex items-center justify-center mb-3">
            <span className="[&_svg]:w-4 [&_svg]:h-4 [&_svg]:text-gray-400">
              {icon}
            </span>
          </div>
        )}
        <h4 className="text-sm font-semibold text-white mb-0.5">{title}</h4>
        {description && (
          <p className="text-xs text-gray-400 text-center max-w-xs">
            {description}
          </p>
        )}
        {actionLabel && onAction && (
          <button
            onClick={onAction}
            className="mt-3 px-3.5 py-1.5 bg-[#FF6700] hover:bg-[#e65c00] text-white text-xs font-medium rounded-lg transition-colors"
          >
            {actionLabel}
          </button>
        )}
        {secondaryActionLabel && onSecondaryAction && (
          <button
            onClick={onSecondaryAction}
            className="mt-2 text-xs font-medium text-gray-400 hover:text-gray-300 transition-colors"
          >
            {secondaryActionLabel}
          </button>
        )}
      </div>
    )
  }

  // ---- Default variant (full-page centered) -------------------------------
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4">
      {icon && (
        <div className="w-16 h-16 rounded-full bg-gray-800 border border-gray-700 flex items-center justify-center mb-4">
          <span className="[&_svg]:w-6 [&_svg]:h-6 [&_svg]:text-gray-400">
            {icon}
          </span>
        </div>
      )}
      <h3 className="text-lg font-semibold text-white mb-1">{title}</h3>
      {description && (
        <p className="text-sm text-gray-400 text-center max-w-sm">
          {description}
        </p>
      )}
      <div className="flex items-center gap-3 mt-4">
        {actionLabel && onAction && (
          <button
            onClick={onAction}
            className="px-5 py-2.5 bg-[#FF6700] hover:bg-[#e65c00] text-white text-sm font-medium rounded-lg transition-colors"
          >
            {actionLabel}
          </button>
        )}
        {secondaryActionLabel && onSecondaryAction && (
          <button
            onClick={onSecondaryAction}
            className="px-5 py-2.5 text-sm font-medium text-gray-400 hover:text-gray-300 transition-colors"
          >
            {secondaryActionLabel}
          </button>
        )}
      </div>
    </div>
  )
}
