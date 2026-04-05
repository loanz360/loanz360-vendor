'use client'

import React, { useState, useMemo, useCallback } from 'react'
import { ChevronRight, X } from 'lucide-react'

type ChartType = 'bar' | 'horizontal-bar' | 'donut'

interface DataPoint {
  label: string
  value: number
  color?: string
  children?: DataPoint[] // For drill-down
  metadata?: Record<string, string | number>
}

interface InteractiveChartProps {
  data: DataPoint[]
  title: string
  type?: ChartType
  height?: number
  onDrillDown?: (item: DataPoint) => void
  valueFormatter?: (value: number) => string
  showLegend?: boolean
}

const DEFAULT_COLORS = [
  '#FF6700', '#3B82F6', '#10B981', '#F59E0B', '#8B5CF6',
  '#EC4899', '#06B6D4', '#84CC16', '#F43F5E', '#6366F1',
]

export default function InteractiveChart({
  data,
  title,
  type = 'bar',
  height = 200,
  onDrillDown,
  valueFormatter = (v) => v.toLocaleString('en-IN'),
  showLegend = true,
}: InteractiveChartProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)
  const [drillPath, setDrillPath] = useState<DataPoint[]>([])
  const [selectedItem, setSelectedItem] = useState<DataPoint | null>(null)

  const currentData = useMemo(() => {
    if (drillPath.length > 0) {
      const last = drillPath[drillPath.length - 1]
      return last.children || []
    }
    return data
  }, [data, drillPath])

  const maxValue = useMemo(() => Math.max(...currentData.map(d => d.value), 1), [currentData])
  const totalValue = useMemo(() => currentData.reduce((sum, d) => sum + d.value, 0), [currentData])

  const handleClick = useCallback((item: DataPoint) => {
    if (item.children && item.children.length > 0) {
      setDrillPath(prev => [...prev, item])
      setHoveredIndex(null)
    } else {
      setSelectedItem(item)
    }
    onDrillDown?.(item)
  }, [onDrillDown])

  const handleBack = useCallback(() => {
    setDrillPath(prev => prev.slice(0, -1))
    setHoveredIndex(null)
  }, [])

  // Bar Chart
  const renderBarChart = () => (
    <div className="flex items-end gap-2" style={{ height }}>
      {currentData.map((item, idx) => {
        const barHeight = maxValue > 0 ? (item.value / maxValue) * 100 : 0
        const color = item.color || DEFAULT_COLORS[idx % DEFAULT_COLORS.length]
        const isHovered = hoveredIndex === idx
        return (
          <div key={idx} className="flex-1 flex flex-col items-center gap-1 group cursor-pointer" onClick={() => handleClick(item)} onMouseEnter={() => setHoveredIndex(idx)} onMouseLeave={() => setHoveredIndex(null)}>
            {isHovered && (
              <div className="text-[10px] text-white bg-black/80 px-1.5 py-0.5 rounded whitespace-nowrap">
                {valueFormatter(item.value)}
              </div>
            )}
            <div
              className="w-full rounded-t transition-all duration-200"
              style={{
                height: `${barHeight}%`,
                minHeight: item.value > 0 ? 4 : 0,
                backgroundColor: color,
                opacity: isHovered ? 1 : 0.8,
                transform: isHovered ? 'scaleY(1.02)' : 'scaleY(1)',
                transformOrigin: 'bottom',
              }}
            />
            <span className="text-[9px] text-gray-500 truncate max-w-full text-center">{item.label}</span>
          </div>
        )
      })}
    </div>
  )

  // Horizontal Bar Chart
  const renderHorizontalBarChart = () => (
    <div className="space-y-2" style={{ maxHeight: height, overflowY: 'auto' }}>
      {currentData.map((item, idx) => {
        const barWidth = maxValue > 0 ? (item.value / maxValue) * 100 : 0
        const color = item.color || DEFAULT_COLORS[idx % DEFAULT_COLORS.length]
        const isHovered = hoveredIndex === idx
        return (
          <div key={idx} className="flex items-center gap-2 cursor-pointer group" onClick={() => handleClick(item)} onMouseEnter={() => setHoveredIndex(idx)} onMouseLeave={() => setHoveredIndex(null)}>
            <span className="text-xs text-gray-400 w-24 truncate text-right">{item.label}</span>
            <div className="flex-1 h-5 bg-white/5 rounded overflow-hidden">
              <div
                className="h-full rounded transition-all duration-200"
                style={{ width: `${barWidth}%`, backgroundColor: color, opacity: isHovered ? 1 : 0.75 }}
              />
            </div>
            <span className="text-xs text-gray-300 w-16 text-right">{valueFormatter(item.value)}</span>
          </div>
        )
      })}
    </div>
  )

  // Donut Chart (SVG)
  const renderDonutChart = () => {
    const size = Math.min(height, 200)
    const radius = size * 0.35
    const innerRadius = radius * 0.6
    const center = size / 2
    let startAngle = -90

    return (
      <div className="flex items-center gap-6 justify-center">
        <svg width={size} height={size} className="shrink-0">
          {currentData.map((item, idx) => {
            const percentage = totalValue > 0 ? (item.value / totalValue) * 100 : 0
            const angle = (percentage / 100) * 360
            const endAngle = startAngle + angle
            const largeArc = angle > 180 ? 1 : 0
            const color = item.color || DEFAULT_COLORS[idx % DEFAULT_COLORS.length]
            const isHovered = hoveredIndex === idx

            const x1 = center + radius * Math.cos((startAngle * Math.PI) / 180)
            const y1 = center + radius * Math.sin((startAngle * Math.PI) / 180)
            const x2 = center + radius * Math.cos((endAngle * Math.PI) / 180)
            const y2 = center + radius * Math.sin((endAngle * Math.PI) / 180)
            const ix1 = center + innerRadius * Math.cos((endAngle * Math.PI) / 180)
            const iy1 = center + innerRadius * Math.sin((endAngle * Math.PI) / 180)
            const ix2 = center + innerRadius * Math.cos((startAngle * Math.PI) / 180)
            const iy2 = center + innerRadius * Math.sin((startAngle * Math.PI) / 180)

            const path = `M ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2} L ${ix1} ${iy1} A ${innerRadius} ${innerRadius} 0 ${largeArc} 0 ${ix2} ${iy2} Z`

            startAngle = endAngle

            return (
              <path
                key={idx}
                d={path}
                fill={color}
                opacity={isHovered ? 1 : 0.8}
                className="cursor-pointer transition-opacity"
                onClick={() => handleClick(item)}
                onMouseEnter={() => setHoveredIndex(idx)}
                onMouseLeave={() => setHoveredIndex(null)}
              />
            )
          })}
          {/* Center text */}
          <text x={center} y={center - 6} textAnchor="middle" className="text-[10px] fill-gray-500">Total</text>
          <text x={center} y={center + 10} textAnchor="middle" className="text-sm fill-white font-bold">{valueFormatter(totalValue)}</text>
        </svg>

        {showLegend && (
          <div className="space-y-1.5">
            {currentData.map((item, idx) => {
              const color = item.color || DEFAULT_COLORS[idx % DEFAULT_COLORS.length]
              const pct = totalValue > 0 ? ((item.value / totalValue) * 100).toFixed(1) : '0'
              return (
                <div key={idx} className="flex items-center gap-2 cursor-pointer hover:bg-white/5 rounded px-1 py-0.5" onMouseEnter={() => setHoveredIndex(idx)} onMouseLeave={() => setHoveredIndex(null)}>
                  <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: color }} />
                  <span className="text-[10px] text-gray-400">{item.label}</span>
                  <span className="text-[10px] text-gray-500 ml-auto">{pct}%</span>
                </div>
              )
            })}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="bg-white/5 border border-white/10 rounded-xl p-4">
      {/* Title + Breadcrumb */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-1.5">
          {drillPath.length > 0 && (
            <>
              <button onClick={() => setDrillPath([])} className="text-xs text-[#FF6700] hover:underline">{title}</button>
              {drillPath.map((p, idx) => (
                <React.Fragment key={idx}>
                  <ChevronRight className="w-3 h-3 text-gray-600" />
                  <button onClick={() => setDrillPath(prev => prev.slice(0, idx + 1))} className="text-xs text-[#FF6700] hover:underline">{p.label}</button>
                </React.Fragment>
              ))}
            </>
          )}
          {drillPath.length === 0 && <span className="text-sm font-medium text-white">{title}</span>}
        </div>
        {drillPath.length > 0 && (
          <button onClick={handleBack} className="text-xs text-gray-400 hover:text-white flex items-center gap-1">
            <X className="w-3 h-3" /> Back
          </button>
        )}
      </div>

      {/* Chart */}
      {type === 'bar' && renderBarChart()}
      {type === 'horizontal-bar' && renderHorizontalBarChart()}
      {type === 'donut' && renderDonutChart()}

      {/* Detail panel */}
      {selectedItem && (
        <div className="mt-3 p-3 bg-white/5 rounded-lg border border-white/10">
          <div className="flex items-center justify-between">
            <span className="text-sm text-white font-medium">{selectedItem.label}</span>
            <button onClick={() => setSelectedItem(null)} className="text-gray-500 hover:text-gray-300">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <p className="text-lg font-bold text-[#FF6700] mt-1">{valueFormatter(selectedItem.value)}</p>
          {selectedItem.metadata && (
            <div className="flex flex-wrap gap-2 mt-2">
              {Object.entries(selectedItem.metadata).map(([k, v]) => (
                <span key={k} className="px-1.5 py-0.5 bg-white/5 rounded text-[10px] text-gray-400">{k}: <span className="text-gray-300">{v}</span></span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export { DEFAULT_COLORS }
export type { DataPoint, InteractiveChartProps }
