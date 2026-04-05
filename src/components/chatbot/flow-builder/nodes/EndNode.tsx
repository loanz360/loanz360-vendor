'use client'

import React, { memo } from 'react'
import { Handle, Position, NodeProps } from 'reactflow'
import { CheckCircle, Send, MessageCircle, ExternalLink } from 'lucide-react'

const EndNode = memo(({ data, selected }: NodeProps) => {
  const endType = data?.type || 'submit_lead'
  const message = data?.message || 'Thank you!'

  const typeConfig: Record<string, { icon: React.ReactNode; label: string; color: string }> = {
    submit_lead: {
      icon: <Send className="w-4 h-4" />,
      label: 'Submit Lead',
      color: 'green'
    },
    message_only: {
      icon: <MessageCircle className="w-4 h-4" />,
      label: 'Message Only',
      color: 'blue'
    },
    redirect: {
      icon: <ExternalLink className="w-4 h-4" />,
      label: 'Redirect',
      color: 'purple'
    }
  }

  const config = typeConfig[endType] || typeConfig.submit_lead

  return (
    <div
      className={`relative bg-gray-800 rounded-xl shadow-lg min-w-[180px] max-w-[250px] transition-all ${
        selected ? 'ring-2 ring-gray-400 ring-offset-2 ring-offset-gray-950' : ''
      }`}
    >
      {/* Input Handle */}
      <Handle
        type="target"
        position={Position.Top}
        className="!w-3 !h-3 !bg-gray-400 !border-2 !border-white"
      />

      {/* Header */}
      <div className={`px-4 py-2 bg-${config.color}-500/20 rounded-t-xl flex items-center space-x-2 border-b border-gray-700`}>
        <CheckCircle className={`w-4 h-4 text-${config.color}-400`} />
        <span className={`text-sm font-medium text-${config.color}-400`}>End Chat</span>
      </div>

      {/* Content */}
      <div className="px-4 py-3">
        <div className="flex items-center space-x-2 mb-2">
          <span className="text-gray-500">{config.icon}</span>
          <span className="text-xs text-gray-400">{config.label}</span>
        </div>
        <p className="text-sm text-gray-300 line-clamp-2">{message}</p>
        {data?.showReference && (
          <div className="mt-2 text-xs text-green-400 flex items-center space-x-1">
            <CheckCircle className="w-3 h-3" />
            <span>Show reference number</span>
          </div>
        )}
      </div>
    </div>
  )
})

EndNode.displayName = 'EndNode'

export default EndNode
