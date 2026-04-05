'use client'

import { toast } from 'sonner'

import React, { useState } from 'react'
import { Download, FileSpreadsheet, X } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface ExportButtonProps {
  month: number
  year: number
}

export default function ExportButton({ month, year }: ExportButtonProps) {
  const [showModal, setShowModal] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [includeDaily, setIncludeDaily] = useState(false)
  const [includeBadges, setIncludeBadges] = useState(false)
  const [format, setFormat] = useState<'csv' | 'json'>('csv')

  const handleExport = async () => {
    try {
      setIsExporting(true)

      const response = await fetch('/api/bdm/team-targets/export', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          month,
          year,
          format,
          includeDaily,
          includeBadges,
        }),
      })

      if (format === 'csv') {
        // Handle CSV download
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `team_performance_${month}_${year}.csv`
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)
        document.body.removeChild(a)
      } else {
        // Handle JSON download (for Excel processing)
        const data = await response.json()
        if (data.success) {
          const blob = new Blob([JSON.stringify(data.data, null, 2)], { type: 'application/json' })
          const url = window.URL.createObjectURL(blob)
          const a = document.createElement('a')
          a.href = url
          a.download = `team_performance_${month}_${year}.json`
          document.body.appendChild(a)
          a.click()
          window.URL.revokeObjectURL(url)
          document.body.removeChild(a)
        }
      }

      setShowModal(false)
    } catch (error) {
      console.error('Error exporting data:', error)
      toast.error('Failed to export data. Please try again.')
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <>
      <button
        onClick={() => setShowModal(true)}
        className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 rounded-lg text-white transition-colors"
      >
        <Download className="w-4 h-4" />
        Export Data
      </button>

      {/* Export Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="content-card max-w-md w-full">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-white flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-green-400" />
                Export Team Performance
              </CardTitle>
              <button
                onClick={() => setShowModal(false)}
                className="p-1 hover:bg-gray-800 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Export Period */}
              <div>
                <label className="text-sm text-gray-400 mb-2 block">Export Period</label>
                <div className="text-white font-semibold">
                  {new Date(year, month - 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                </div>
              </div>

              {/* Format Selection */}
              <div>
                <label className="text-sm text-gray-400 mb-2 block">Export Format</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setFormat('csv')}
                    className={`p-3 rounded-lg border transition-colors ${
                      format === 'csv'
                        ? 'bg-green-600 border-green-500 text-white'
                        : 'bg-gray-800 border-gray-700 text-gray-300 hover:bg-gray-700'
                    }`}
                  >
                    <div className="text-sm font-semibold">CSV</div>
                    <div className="text-xs opacity-70">Excel compatible</div>
                  </button>
                  <button
                    onClick={() => setFormat('json')}
                    className={`p-3 rounded-lg border transition-colors ${
                      format === 'json'
                        ? 'bg-green-600 border-green-500 text-white'
                        : 'bg-gray-800 border-gray-700 text-gray-300 hover:bg-gray-700'
                    }`}
                  >
                    <div className="text-sm font-semibold">JSON</div>
                    <div className="text-xs opacity-70">For processing</div>
                  </button>
                </div>
              </div>

              {/* Include Options */}
              <div>
                <label className="text-sm text-gray-400 mb-2 block">Include Additional Data</label>
                <div className="space-y-2">
                  <label className="flex items-center gap-3 p-3 bg-gray-800 rounded-lg cursor-pointer hover:bg-gray-750 transition-colors">
                    <input
                      type="checkbox"
                      checked={includeDaily}
                      onChange={(e) => setIncludeDaily(e.target.checked)}
                      className="w-4 h-4 rounded border-gray-600 text-green-600 focus:ring-green-500"
                    />
                    <div>
                      <div className="text-white text-sm font-medium">Daily Activity Data</div>
                      <div className="text-xs text-gray-400">Day-by-day breakdown for each BDE</div>
                    </div>
                  </label>

                  <label className="flex items-center gap-3 p-3 bg-gray-800 rounded-lg cursor-pointer hover:bg-gray-750 transition-colors">
                    <input
                      type="checkbox"
                      checked={includeBadges}
                      onChange={(e) => setIncludeBadges(e.target.checked)}
                      className="w-4 h-4 rounded border-gray-600 text-green-600 focus:ring-green-500"
                    />
                    <div>
                      <div className="text-white text-sm font-medium">Badges Earned</div>
                      <div className="text-xs text-gray-400">All badges earned this month</div>
                    </div>
                  </label>
                </div>
              </div>

              {/* Export Summary */}
              <div className="p-4 bg-gray-800 rounded-lg">
                <div className="text-sm text-gray-400 mb-2">Export will include:</div>
                <ul className="text-sm text-white space-y-1">
                  <li>• Monthly overview for all team members</li>
                  <li>• Performance metrics and targets</li>
                  {includeDaily && <li>• Daily activity breakdown</li>}
                  {includeBadges && <li>• Badges earned this month</li>}
                </ul>
              </div>

              {/* Actions */}
              <div className="flex gap-3">
                <button
                  onClick={() => setShowModal(false)}
                  className="flex-1 px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleExport}
                  disabled={isExporting}
                  className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 rounded-lg text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isExporting ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                      Exporting...
                    </>
                  ) : (
                    <>
                      <Download className="w-4 h-4" />
                      Export {format.toUpperCase()}
                    </>
                  )}
                </button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </>
  )
}
