'use client'

interface BarChartProps {
  data: Array<{ label: string; value: number; color?: string }>
  title?: string
  height?: number
  showValues?: boolean
}

export default function BarChart({ data, title, height = 300, showValues = true }: BarChartProps) {
  const maxValue = Math.max(...data.map((d) => d.value))

  return (
    <div className="bg-white rounded-lg shadow p-6">
      {title && <h3 className="text-lg font-semibold text-gray-900 mb-4">{title}</h3>}

      <div className="space-y-3" style={{ height: `${height}px` }}>
        {data.map((item, index) => {
          const percentage = (item.value / maxValue) * 100
          const color = item.color || 'bg-blue-600'

          return (
            <div key={index} className="flex items-center gap-3">
              <div className="w-24 text-sm text-gray-700 font-medium truncate" title={item.label}>
                {item.label}
              </div>

              <div className="flex-1 bg-gray-100 rounded-full h-8 relative overflow-hidden">
                <div
                  className={`${color} h-full rounded-full transition-all duration-500 ease-out flex items-center justify-end pr-3`}
                  style={{ width: `${percentage}%` }}
                >
                  {showValues && percentage > 15 && (
                    <span className="text-white text-sm font-medium">{item.value}</span>
                  )}
                </div>
              </div>

              {showValues && percentage <= 15 && (
                <div className="w-16 text-sm text-gray-700 font-medium text-right">
                  {item.value}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
