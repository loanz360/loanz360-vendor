'use client'

import React, { memo } from 'react'
import { Handle, Position, NodeProps } from 'reactflow'
import { MessageSquare } from 'lucide-react'

const MessageNode = memo(({ data, selected }: NodeProps) => {
  const message = data?.message || 'Enter message...'

  return (
    <div
      className={`relative bg-gray-800 rounded-xl shadow-lg min-w-[200px] max-w-[280px] transition-all ${
        selected ? 'ring-2 ring-blue-400 ring-offset-2 ring-offset-gray-950' : ''
      }`}
    >
      {/* Input Handle */}
      <Handle
        type="target"
        position={Position.Top}
        className="!w-3 !h-3 !bg-blue-400 !border-2 !border-white"
      />

      {/* Header */}
      <div className="px-4 py-2 bg-blue-500/20 rounded-t-xl flex items-center space-x-2 border-b border-gray-700">
        <MessageSquare className="w-4 h-4 text-blue-400" />
        <span className="text-sm font-medium text-blue-400">Message</span>
      </div>

      {/* Content */}
      <div className="px-4 py-3">
        <p className="text-sm text-gray-300 line-clamp-3">{message}</p>
      </div>

      {/* Output Handle */}
      <Handle
        type="source"
        position={Position.Bottom}
        className="!w-3 !h-3 !bg-blue-400 !border-2 !border-white"
      />
    </div>
  )
})

MessageNode.displayName = 'MessageNode'

export default MessageNode
