'use client'

import React from 'react'

interface Column<T> {
  key: string
  header: string
  render: (row: T) => React.ReactNode
  hideOnMobile?: boolean
  width?: string
}

interface ResponsiveTableProps<T> {
  columns: Column<T>[]
  data: T[]
  keyExtractor: (row: T) => string
  emptyMessage?: string
  onRowClick?: (row: T) => void
  mobileCardRender?: (row: T) => React.ReactNode
}

export function ResponsiveTable<T>({ columns, data, keyExtractor, emptyMessage = 'No data found', onRowClick, mobileCardRender }: ResponsiveTableProps<T>) {
  if (data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <div className="w-12 h-12 rounded-full bg-gray-800 flex items-center justify-center mb-3">
          <svg className="w-6 h-6 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" /></svg>
        </div>
        <p className="text-sm text-gray-400">{emptyMessage}</p>
      </div>
    )
  }

  return (
    <>
      {/* Mobile card view */}
      {mobileCardRender && (
        <div className="sm:hidden space-y-3">
          {data.map(row => (
            <div
              key={keyExtractor(row)}
              onClick={() => onRowClick?.(row)}
              className={`bg-gray-800/50 border border-gray-700/50 rounded-xl p-4 ${onRowClick ? 'cursor-pointer hover:bg-gray-700/50' : ''}`}
            >
              {mobileCardRender(row)}
            </div>
          ))}
        </div>
      )}

      {/* Desktop table view */}
      <div className={mobileCardRender ? 'hidden sm:block' : ''}>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-700">
                {columns.filter(c => !c.hideOnMobile || !mobileCardRender).map(col => (
                  <th key={col.key} className={`px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider ${col.hideOnMobile ? 'hidden md:table-cell' : ''}`} style={col.width ? { width: col.width } : undefined}>
                    {col.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700/50">
              {data.map(row => (
                <tr
                  key={keyExtractor(row)}
                  onClick={() => onRowClick?.(row)}
                  className={`hover:bg-gray-800/30 transition-colors ${onRowClick ? 'cursor-pointer' : ''}`}
                >
                  {columns.filter(c => !c.hideOnMobile || !mobileCardRender).map(col => (
                    <td key={col.key} className={`px-4 py-3 text-sm ${col.hideOnMobile ? 'hidden md:table-cell' : ''}`}>
                      {col.render(row)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}
