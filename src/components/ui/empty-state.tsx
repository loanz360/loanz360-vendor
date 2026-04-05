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
  CreditCard,
  BarChart3,
  Bell,
  Settings,
  Shield,
  Ticket,
  Wallet,
  TrendingUp,
  Package,
  type LucideIcon,
} from 'lucide-react'

interface EmptyStateProps {
  icon?: React.ReactNode
  title?: string
  description?: string
  actionLabel?: string
  onAction?: () => void
  secondaryActionLabel?: string
  onSecondaryAction?: () => void
  variant?: 'default' | 'compact' | 'inline'
  type?: keyof typeof EMPTY_STATE_PRESETS
}

const EMPTY_STATE_PRESETS: Record<string, { icon: LucideIcon; title: string; description: string; actionLabel?: string }> = {
  contacts: { icon: Users, title: 'No contacts yet', description: 'Start by adding contacts to your pipeline', actionLabel: 'Add Contact' },
  leads: { icon: Target, title: 'No leads yet', description: 'Convert your positive contacts to leads', actionLabel: 'View Contacts' },
  deals: { icon: Briefcase, title: 'No deals yet', description: 'Qualify your leads to create deals' },
  followups: { icon: Calendar, title: 'No follow-ups scheduled', description: 'Schedule follow-ups with your contacts and leads', actionLabel: 'New Follow-up' },
  activities: { icon: Activity, title: 'No recent activity', description: 'Your activity feed will appear here as you work' },
  search: { icon: Search, title: 'No results found', description: 'Try adjusting your search or filters' },
  documents: { icon: FileText, title: 'No documents uploaded', description: 'Upload documents to get started', actionLabel: 'Upload Document' },
  chat: { icon: MessageCircle, title: 'No messages yet', description: 'Start a conversation' },
  calls: { icon: Phone, title: 'No call logs', description: 'Your call history will appear here once you start making calls' },
  loans: { icon: CreditCard, title: 'No loans found', description: 'Loan applications will appear here once submitted' },
  analytics: { icon: BarChart3, title: 'No data available', description: 'Analytics will populate as data flows in' },
  notifications: { icon: Bell, title: 'No notifications', description: 'You are all caught up' },
  settings: { icon: Settings, title: 'No settings configured', description: 'Configure your preferences to get started' },
  permissions: { icon: Shield, title: 'No permissions set', description: 'Set up permissions to control access' },
  tickets: { icon: Ticket, title: 'No support tickets', description: 'Create a ticket if you need help', actionLabel: 'Create Ticket' },
  payments: { icon: Wallet, title: 'No payments found', description: 'Payment history will appear here' },
  performance: { icon: TrendingUp, title: 'No performance data', description: 'Performance metrics will appear as you work' },
  services: { icon: Package, title: 'No services listed', description: 'Add your services to get started', actionLabel: 'Add Service' },
  generic: { icon: Inbox, title: 'Nothing to show', description: 'There is no data to display at the moment' },
}

export default function EmptyState({
  icon: iconProp,
  title: titleProp,
  description: descriptionProp,
  actionLabel: actionLabelProp,
  onAction,
  secondaryActionLabel,
  onSecondaryAction,
  variant = 'default',
  type,
}: EmptyStateProps) {
  const preset = type ? EMPTY_STATE_PRESETS[type] : null
  const IconComponent = preset?.icon
  const icon = iconProp ?? (IconComponent ? <IconComponent className="w-6 h-6 text-gray-400" /> : null)
  const title = titleProp ?? preset?.title ?? ''
  const description = descriptionProp ?? preset?.description
  const actionLabel = actionLabelProp ?? (onAction ? preset?.actionLabel : undefined)

  if (variant === 'inline') {
    return (
      <div className="flex items-center gap-3 px-4 py-3">
        {icon && (
          <div className="w-8 h-8 rounded-full bg-gray-800 border border-gray-700 flex items-center justify-center shrink-0">
            <span className="[&_svg]:w-4 [&_svg]:h-4 [&_svg]:text-gray-400">{icon}</span>
          </div>
        )}
        <div className="flex items-center gap-3">
          <p className="text-sm font-medium text-gray-300">{title}</p>
          {description && <p className="text-xs text-gray-500">{description}</p>}
          {actionLabel && onAction && (
            <button onClick={onAction} className="text-xs font-medium text-[#FF6700] hover:text-[#ff8533] transition-colors">
              {actionLabel}
            </button>
          )}
        </div>
      </div>
    )
  }

  if (variant === 'compact') {
    return (
      <div className="flex flex-col items-center justify-center py-8 px-4">
        {icon && (
          <div className="w-10 h-10 rounded-full bg-gray-800 border border-gray-700 flex items-center justify-center mb-3">
            <span className="[&_svg]:w-4 [&_svg]:h-4 [&_svg]:text-gray-400">{icon}</span>
          </div>
        )}
        <h4 className="text-sm font-semibold text-white mb-0.5">{title}</h4>
        {description && <p className="text-xs text-gray-400 text-center max-w-xs">{description}</p>}
        {actionLabel && onAction && (
          <button onClick={onAction} className="mt-3 px-3.5 py-1.5 bg-[#FF6700] hover:bg-[#e65c00] text-white text-xs font-medium rounded-lg transition-colors">
            {actionLabel}
          </button>
        )}
        {secondaryActionLabel && onSecondaryAction && (
          <button onClick={onSecondaryAction} className="mt-2 text-xs font-medium text-gray-400 hover:text-gray-300 transition-colors">
            {secondaryActionLabel}
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center justify-center py-16 px-4">
      {icon && (
        <div className="w-16 h-16 rounded-full bg-gray-800 border border-gray-700 flex items-center justify-center mb-4">
          <span className="[&_svg]:w-6 [&_svg]:h-6 [&_svg]:text-gray-400">{icon}</span>
        </div>
      )}
      <h3 className="text-lg font-semibold text-white mb-1">{title}</h3>
      {description && <p className="text-sm text-gray-400 text-center max-w-sm">{description}</p>}
      <div className="flex items-center gap-3 mt-4">
        {actionLabel && onAction && (
          <button onClick={onAction} className="px-5 py-2.5 bg-[#FF6700] hover:bg-[#e65c00] text-white text-sm font-medium rounded-lg transition-colors">
            {actionLabel}
          </button>
        )}
        {secondaryActionLabel && onSecondaryAction && (
          <button onClick={onSecondaryAction} className="px-5 py-2.5 text-sm font-medium text-gray-400 hover:text-gray-300 transition-colors">
            {secondaryActionLabel}
          </button>
        )}
      </div>
    </div>
  )
}

export { EMPTY_STATE_PRESETS }
