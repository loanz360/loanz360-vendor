'use client'

import React, { memo } from 'react'
import { Handle, Position, NodeProps } from 'reactflow'
import { Play } from 'lucide-react'

const StartNode = memo(({ data, selected }: NodeProps) => {
  return (
    <div
      className={`relative bg-gradient-to-br from-green-600 to-green-700 rounded-xl shadow-lg transition-all ${
        selected ? 'ring-2 ring-green-400 ring-offset-2 ring-offset-gray-950' : ''
      }`}
    >
      <div className="px-6 py-4 flex items-center space-x-3">
        <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
          <Play className="w-5 h-5 text-white fill-white" />
        </div>
        <div>
          <p className="font-semibold text-white text-sm">Start</p>
          <p className="text-green-200 text-xs">Conversation begins here</p>
        </div>
      </div>

      {/* Output Handle */}
      <Handle
        type="source"
        position={Position.Bottom}
        className="!w-3 !h-3 !bg-green-400 !border-2 !border-white"
      />
    </div>
  )
})

StartNode.displayName = 'StartNode'

export default StartNode
