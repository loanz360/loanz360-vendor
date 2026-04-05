'use client'

interface PieChartProps {
  data: Array<{ label: string; value: number; color: string }>
  title?: string
  size?: number
}

export default function PieChart({ data, title, size = 200 }: PieChartProps) {
  const total = data.reduce((sum, item) => sum + item.value, 0)

  let currentAngle = 0
  const slices = data.map((item) => {
    const percentage = (item.value / total) * 100
    const angle = (item.value / total) * 360
    const startAngle = currentAngle
    const endAngle = currentAngle + angle

    // Calculate arc path
    const startRad = (startAngle * Math.PI) / 180
    const endRad = (endAngle * Math.PI) / 180
    const x1 = 50 + 40 * Math.cos(startRad)
    const y1 = 50 + 40 * Math.sin(startRad)
    const x2 = 50 + 40 * Math.cos(endRad)
    const y2 = 50 + 40 * Math.sin(endRad)
    const largeArc = angle > 180 ? 1 : 0

    currentAngle = endAngle

    return {
      ...item,
      percentage,
      path: `M 50 50 L ${x1} ${y1} A 40 40 0 ${largeArc} 1 ${x2} ${y2} Z`,
    }
  })

  return (
    <div className="bg-white rounded-lg shadow p-6">
      {title && <h3 className="text-lg font-semibold text-gray-900 mb-4">{title}</h3>}

      <div className="flex items-center gap-6">
        <svg width={size} height={size} viewBox="0 0 100 100">
          {slices.map((slice, index) => (
            <path
              key={index}
              d={slice.path}
              fill={slice.color}
              stroke="white"
              strokeWidth="1"
            />
          ))}
        </svg>

        <div className="flex-1 space-y-2">
          {slices.map((slice, index) => (
            <div key={index} className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded-full flex-shrink-0"
                  style={{ backgroundColor: slice.color }}
                />
                <span className="text-sm text-gray-700">{slice.label}</span>
              </div>
              <div className="text-sm font-medium text-gray-900">
                {slice.value} ({slice.percentage.toFixed(1)}%)
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
