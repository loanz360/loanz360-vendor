'use client'

import React, { memo } from 'react'
import { Handle, Position, NodeProps } from 'reactflow'
import {
  Type,
  Mail,
  Phone,
  Hash,
  List,
  CheckSquare,
  Calendar,
  Upload,
  Star,
  MapPin
} from 'lucide-react'

// Map node types to their icons and colors
const nodeTypeConfig: Record<string, { icon: React.ReactNode; color: string; label: string }> = {
  text_input: {
    icon: <Type className="w-4 h-4" />,
    color: 'emerald',
    label: 'Text Input'
  },
  email_input: {
    icon: <Mail className="w-4 h-4" />,
    color: 'emerald',
    label: 'Email'
  },
  phone_input: {
    icon: <Phone className="w-4 h-4" />,
    color: 'emerald',
    label: 'Phone'
  },
  number_input: {
    icon: <Hash className="w-4 h-4" />,
    color: 'emerald',
    label: 'Number'
  },
  single_choice: {
    icon: <List className="w-4 h-4" />,
    color: 'violet',
    label: 'Single Choice'
  },
  multiple_choice: {
    icon: <CheckSquare className="w-4 h-4" />,
    color: 'violet',
    label: 'Multiple Choice'
  },
  date_input: {
    icon: <Calendar className="w-4 h-4" />,
    color: 'amber',
    label: 'Date'
  },
  file_upload: {
    icon: <Upload className="w-4 h-4" />,
    color: 'pink',
    label: 'File Upload'
  },
  rating_input: {
    icon: <Star className="w-4 h-4" />,
    color: 'amber',
    label: 'Rating'
  },
  location_input: {
    icon: <MapPin className="w-4 h-4" />,
    color: 'red',
    label: 'Location'
  }
}

const InputNode = memo(({ data, selected, type }: NodeProps) => {
  const nodeType = type || data?.type || 'text_input'
  const config = nodeTypeConfig[nodeType] || nodeTypeConfig.text_input
  const question = data?.question || 'Enter question...'

  // Color classes mapping
  const colorClasses: Record<string, { bg: string; text: string; ring: string }> = {
    emerald: { bg: 'bg-emerald-500/20', text: 'text-emerald-400', ring: 'ring-emerald-400' },
    violet: { bg: 'bg-violet-500/20', text: 'text-violet-400', ring: 'ring-violet-400' },
    amber: { bg: 'bg-amber-500/20', text: 'text-amber-400', ring: 'ring-amber-400' },
    pink: { bg: 'bg-pink-500/20', text: 'text-pink-400', ring: 'ring-pink-400' },
    red: { bg: 'bg-red-500/20', text: 'text-red-400', ring: 'ring-red-400' }
  }

  const colors = colorClasses[config.color] || colorClasses.emerald

  return (
    <div
      className={`relative bg-gray-800 rounded-xl shadow-lg min-w-[200px] max-w-[280px] transition-all ${
        selected ? `ring-2 ${colors.ring} ring-offset-2 ring-offset-gray-950` : ''
      }`}
    >
      {/* Input Handle */}
      <Handle
        type="target"
        position={Position.Top}
        className={`!w-3 !h-3 !border-2 !border-white`}
        style={{ backgroundColor: config.color === 'emerald' ? '#10B981' : config.color === 'violet' ? '#8B5CF6' : config.color === 'amber' ? '#F59E0B' : config.color === 'pink' ? '#EC4899' : '#EF4444' }}
      />

      {/* Header */}
      <div className={`px-4 py-2 ${colors.bg} rounded-t-xl flex items-center space-x-2 border-b border-gray-700`}>
        <span className={colors.text}>{config.icon}</span>
        <span className={`text-sm font-medium ${colors.text}`}>{config.label}</span>
        {data?.required && (
          <span className="text-red-400 text-xs">*</span>
        )}
      </div>

      {/* Content */}
      <div className="px-4 py-3">
        <p className="text-sm text-gray-300 line-clamp-2">{question}</p>

        {/* Options preview for choice nodes */}
        {(nodeType === 'single_choice' || nodeType === 'multiple_choice') && data?.options && (
          <div className="mt-2 space-y-1">
            {(data.options as string[]).slice(0, 3).map((option: string, index: number) => (
              <div
                key={index}
                className="text-xs px-2 py-1 bg-gray-700 rounded text-gray-400 flex items-center space-x-2"
              >
                {nodeType === 'single_choice' ? (
                  <div className="w-3 h-3 rounded-full border border-gray-500" />
                ) : (
                  <div className="w-3 h-3 rounded border border-gray-500" />
                )}
                <span>{option}</span>
              </div>
            ))}
            {data.options.length > 3 && (
              <p className="text-xs text-gray-500">+{data.options.length - 3} more</p>
            )}
          </div>
        )}

        {/* Rating preview */}
        {nodeType === 'rating_input' && (
          <div className="mt-2 flex space-x-1">
            {Array.from({ length: data?.maxRating || 5 }).map((_, i) => (
              <Star key={i} className="w-4 h-4 text-amber-500/50" />
            ))}
          </div>
        )}

        {/* Variable name */}
        {data?.variableName && (
          <div className="mt-2 text-xs text-gray-500">
            → <span className="font-mono text-gray-400">{data.variableName}</span>
          </div>
        )}
      </div>

      {/* Output Handle */}
      <Handle
        type="source"
        position={Position.Bottom}
        className={`!w-3 !h-3 !border-2 !border-white`}
        style={{ backgroundColor: config.color === 'emerald' ? '#10B981' : config.color === 'violet' ? '#8B5CF6' : config.color === 'amber' ? '#F59E0B' : config.color === 'pink' ? '#EC4899' : '#EF4444' }}
      />
    </div>
  )
})

InputNode.displayName = 'InputNode'

export default InputNode
