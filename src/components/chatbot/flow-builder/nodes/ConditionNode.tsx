'use client'

import React, { memo } from 'react'
import { Handle, Position, NodeProps } from 'reactflow'
import { GitBranch } from 'lucide-react'

const ConditionNode = memo(({ data, selected }: NodeProps) => {
  const variable = data?.variable || 'variable'
  const operator = data?.operator || 'equals'
  const value = data?.value || 'value'

  const operatorLabels: Record<string, string> = {
    equals: '=',
    not_equals: '≠',
    contains: '∈',
    greater_than: '>',
    less_than: '<',
    is_empty: '∅',
    is_not_empty: '!∅'
  }

  return (
    <div
      className={`relative bg-gray-800 rounded-xl shadow-lg min-w-[180px] transition-all ${
        selected ? 'ring-2 ring-orange-400 ring-offset-2 ring-offset-gray-950' : ''
      }`}
    >
      {/* Input Handle */}
      <Handle
        type="target"
        position={Position.Top}
        className="!w-3 !h-3 !bg-orange-400 !border-2 !border-white"
      />

      {/* Header */}
      <div className="px-4 py-2 bg-orange-500/20 rounded-t-xl flex items-center space-x-2 border-b border-gray-700">
        <GitBranch className="w-4 h-4 text-orange-400" />
        <span className="text-sm font-medium text-orange-400">Condition</span>
      </div>

      {/* Content */}
      <div className="px-4 py-3">
        <div className="flex items-center justify-center space-x-2 text-sm">
          <span className="text-gray-400">{variable}</span>
          <span className="text-orange-400 font-mono">{operatorLabels[operator] || operator}</span>
          <span className="text-gray-400">{value || '?'}</span>
        </div>
      </div>

      {/* Output Handles */}
      <div className="flex justify-between px-4 pb-2">
        <div className="flex flex-col items-center">
          <span className="text-xs text-green-400 mb-1">True</span>
          <Handle
            type="source"
            position={Position.Bottom}
            id="true"
            className="!relative !transform-none !w-3 !h-3 !bg-green-400 !border-2 !border-white"
          />
        </div>
        <div className="flex flex-col items-center">
          <span className="text-xs text-red-400 mb-1">False</span>
          <Handle
            type="source"
            position={Position.Bottom}
            id="false"
            className="!relative !transform-none !w-3 !h-3 !bg-red-400 !border-2 !border-white"
          />
        </div>
      </div>
    </div>
  )
})

ConditionNode.displayName = 'ConditionNode'

export default ConditionNode
