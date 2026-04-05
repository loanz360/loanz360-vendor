'use client'

import React, { memo } from 'react'
import { Handle, Position, NodeProps } from 'reactflow'
import { HelpCircle } from 'lucide-react'

const QuestionNode = memo(({ data, selected }: NodeProps) => {
  const question = data?.question || 'Enter question...'

  return (
    <div
      className={`relative bg-gray-800 rounded-xl shadow-lg min-w-[200px] max-w-[280px] transition-all ${
        selected ? 'ring-2 ring-purple-400 ring-offset-2 ring-offset-gray-950' : ''
      }`}
    >
      {/* Input Handle */}
      <Handle
        type="target"
        position={Position.Top}
        className="!w-3 !h-3 !bg-purple-400 !border-2 !border-white"
      />

      {/* Header */}
      <div className="px-4 py-2 bg-purple-500/20 rounded-t-xl flex items-center space-x-2 border-b border-gray-700">
        <HelpCircle className="w-4 h-4 text-purple-400" />
        <span className="text-sm font-medium text-purple-400">Question</span>
      </div>

      {/* Content */}
      <div className="px-4 py-3">
        <p className="text-sm text-gray-300 line-clamp-3">{question}</p>
        {data?.options && data.options.length > 0 && (
          <div className="mt-2 space-y-1">
            {data.options.slice(0, 3).map((option: string, index: number) => (
              <div
                key={index}
                className="text-xs px-2 py-1 bg-gray-700 rounded text-gray-400"
              >
                {option}
              </div>
            ))}
            {data.options.length > 3 && (
              <p className="text-xs text-gray-500">+{data.options.length - 3} more</p>
            )}
          </div>
        )}
      </div>

      {/* Output Handle */}
      <Handle
        type="source"
        position={Position.Bottom}
        className="!w-3 !h-3 !bg-purple-400 !border-2 !border-white"
      />
    </div>
  )
})

QuestionNode.displayName = 'QuestionNode'

export default QuestionNode
