'use client'

interface LineChartProps {
  data: Array<{ label: string; value: number }>
  title?: string
  height?: number
  color?: string
}

export default function LineChart({ data, title, height = 300, color = 'blue' }: LineChartProps) {
  const maxValue = Math.max(...data.map((d) => d.value))
  const minValue = Math.min(...data.map((d) => d.value))
  const range = maxValue - minValue || 1

  const points = data.map((item, index) => {
    const x = (index / (data.length - 1)) * 100
    const y = 100 - ((item.value - minValue) / range) * 80 // 80% of height for padding
    return `${x},${y}`
  }).join(' ')

  const fillPoints = `0,100 ${points} 100,100`

  return (
    <div className="bg-white rounded-lg shadow p-6">
      {title && <h3 className="text-lg font-semibold text-gray-900 mb-4">{title}</h3>}

      <div className="relative" style={{ height: `${height}px` }}>
        <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
          {/* Grid lines */}
          {[0, 25, 50, 75, 100].map((y) => (
            <line
              key={y}
              x1="0"
              y1={y}
              x2="100"
              y2={y}
              stroke="#e5e7eb"
              strokeWidth="0.5"
              vectorEffect="non-scaling-stroke"
            />
          ))}

          {/* Fill area */}
          <polygon
            points={fillPoints}
            fill={color === 'blue' ? '#3b82f6' : color === 'green' ? '#10b981' : '#8b5cf6'}
            opacity="0.1"
          />

          {/* Line */}
          <polyline
            points={points}
            fill="none"
            stroke={color === 'blue' ? '#3b82f6' : color === 'green' ? '#10b981' : '#8b5cf6'}
            strokeWidth="2"
            vectorEffect="non-scaling-stroke"
          />

          {/* Points */}
          {data.map((item, index) => {
            const x = (index / (data.length - 1)) * 100
            const y = 100 - ((item.value - minValue) / range) * 80
            return (
              <circle
                key={index}
                cx={x}
                cy={y}
                r="1.5"
                fill={color === 'blue' ? '#3b82f6' : color === 'green' ? '#10b981' : '#8b5cf6'}
              />
            )
          })}
        </svg>

        {/* Labels */}
        <div className="flex justify-between mt-2">
          {data.map((item, index) => (
            <div
              key={index}
              className="text-xs text-gray-600"
              style={{ width: `${100 / data.length}%`, textAlign: 'center' }}
            >
              {item.label}
            </div>
          ))}
        </div>

        {/* Value labels */}
        <div className="absolute top-0 left-0 text-xs text-gray-600">{maxValue}</div>
        <div className="absolute bottom-0 left-0 text-xs text-gray-600">{minValue}</div>
      </div>
    </div>
  )
}
