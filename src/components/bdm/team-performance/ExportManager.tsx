'use client'

/**
 * ============================================================================
 * EXPORT MANAGER COMPONENT
 * ============================================================================
 *
 * Purpose: Provide export functionality for team performance data
 * Features:
 * - Multi-format export (Excel, PDF, CSV)
 * - Format-specific options
 * - Download progress tracking
 * - Professional UI with format cards
 *
 * Created: December 7, 2025
 * ============================================================================
 */

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Download, FileSpreadsheet, FileText, Table, Loader2, CheckCircle2, AlertCircle } from 'lucide-react'

interface ExportManagerProps {
  month: number
  year: number
  activeTab: string
}

type ExportFormat = 'excel' | 'pdf' | 'csv'
type ExportStatus = 'idle' | 'loading' | 'success' | 'error'

export default function ExportManager({ month, year, activeTab }: ExportManagerProps) {
  const [selectedFormat, setSelectedFormat] = useState<ExportFormat>('excel')
  const [exportStatus, setExportStatus] = useState<ExportStatus>('idle')
  const [errorMessage, setErrorMessage] = useState<string>('')

  const handleExport = async (format: ExportFormat) => {
    try {
      setExportStatus('loading')
      setErrorMessage('')
      setSelectedFormat(format)

      // Build export URL
      const url = `/api/bdm/team-performance/export?format=${format}&month=${month}&year=${year}&tab=${activeTab}`

      // Fetch the file
      const response = await fetch(url)

      if (!response.ok) {
        throw new Error('Export failed')
      }

      // Get filename from Content-Disposition header
      const contentDisposition = response.headers.get('Content-Disposition')
      const filenameMatch = contentDisposition?.match(/filename="(.+)"/)
      const filename = filenameMatch ? filenameMatch[1] : `export.${format}`

      // Create blob and download
      const blob = await response.blob()
      const downloadUrl = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = downloadUrl
      link.download = filename
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(downloadUrl)

      setExportStatus('success')

      // Reset after 3 seconds
      setTimeout(() => {
        setExportStatus('idle')
      }, 3000)
    } catch (error) {
      console.error('Export error:', error)
      setExportStatus('error')
      setErrorMessage(error instanceof Error ? error.message : 'Export failed')

      // Reset after 5 seconds
      setTimeout(() => {
        setExportStatus('idle')
        setErrorMessage('')
      }, 5000)
    }
  }

  const formats = [
    {
      id: 'excel' as ExportFormat,
      name: 'Excel',
      description: 'Multi-sheet workbook with formatting',
      icon: FileSpreadsheet,
      color: 'text-green-600',
      bgColor: 'bg-green-50',
      borderColor: 'border-green-200',
      extension: '.xlsx',
      features: [
        'Multiple worksheets',
        'Professional formatting',
        'Charts and formulas',
        'Conditional formatting',
      ],
    },
    {
      id: 'pdf' as ExportFormat,
      name: 'PDF',
      description: 'Print-ready document',
      icon: FileText,
      color: 'text-red-600',
      bgColor: 'bg-red-50',
      borderColor: 'border-red-200',
      extension: '.pdf',
      features: [
        'Print-ready format',
        'Professional layout',
        'Shareable document',
        'Universal compatibility',
      ],
    },
    {
      id: 'csv' as ExportFormat,
      name: 'CSV',
      description: 'Simple data file for analysis',
      icon: Table,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
      borderColor: 'border-blue-200',
      extension: '.csv',
      features: [
        'Simple format',
        'Easy to import',
        'Compatible with all tools',
        'Lightweight file size',
      ],
    },
  ]

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Download className="h-5 w-5 text-purple-600" />
          Export Performance Data
        </CardTitle>
        <CardDescription>
          Download team performance data in your preferred format
        </CardDescription>
      </CardHeader>
      <CardContent>
        {/* Format Selection Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          {formats.map((format) => {
            const Icon = format.icon
            const isSelected = selectedFormat === format.id
            const isLoading = exportStatus === 'loading' && selectedFormat === format.id

            return (
              <div
                key={format.id}
                className={`relative border-2 rounded-lg p-4 cursor-pointer transition-all ${
                  isSelected
                    ? `${format.borderColor} ${format.bgColor} shadow-md`
                    : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm'
                }`}
                onClick={() => setSelectedFormat(format.id)}
              >
                {/* Format Icon */}
                <div className="flex items-start gap-3 mb-3">
                  <div
                    className={`p-2 rounded-lg ${format.bgColor} ${
                      isSelected ? 'ring-2 ring-offset-2 ring-current' : ''
                    }`}
                  >
                    <Icon className={`h-6 w-6 ${format.color}`} />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-bold text-gray-900">{format.name}</h3>
                    <p className="text-xs text-gray-600">{format.description}</p>
                  </div>
                </div>

                {/* Features */}
                <ul className="space-y-1 mb-4">
                  {format.features.map((feature, index) => (
                    <li key={index} className="flex items-center gap-2 text-xs text-gray-600">
                      <div className="w-1 h-1 rounded-full bg-gray-400" />
                      {feature}
                    </li>
                  ))}
                </ul>

                {/* Export Button */}
                <Button
                  onClick={(e) => {
                    e.stopPropagation()
                    handleExport(format.id)
                  }}
                  disabled={isLoading}
                  className="w-full"
                  variant={isSelected ? 'default' : 'outline'}
                  size="sm"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Exporting...
                    </>
                  ) : (
                    <>
                      <Download className="mr-2 h-4 w-4" />
                      Export {format.extension}
                    </>
                  )}
                </Button>

                {/* Selection Indicator */}
                {isSelected && (
                  <div className="absolute top-2 right-2">
                    <div className={`w-6 h-6 rounded-full ${format.bgColor} flex items-center justify-center`}>
                      <CheckCircle2 className={`h-4 w-4 ${format.color}`} />
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Status Messages */}
        {exportStatus === 'success' && (
          <div className="bg-green-50 border-2 border-green-200 rounded-lg p-4 flex items-center gap-3">
            <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0" />
            <div>
              <p className="font-semibold text-green-900">Export Successful!</p>
              <p className="text-sm text-green-700">Your file has been downloaded successfully.</p>
            </div>
          </div>
        )}

        {exportStatus === 'error' && (
          <div className="bg-red-50 border-2 border-red-200 rounded-lg p-4 flex items-center gap-3">
            <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0" />
            <div>
              <p className="font-semibold text-red-900">Export Failed</p>
              <p className="text-sm text-red-700">{errorMessage || 'An error occurred during export.'}</p>
            </div>
          </div>
        )}

        {/* Export Info */}
        <div className="mt-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
          <h4 className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
            <Download className="h-4 w-4 text-gray-600" />
            Export Information
          </h4>
          <div className="space-y-1 text-sm text-gray-600">
            <p>
              <span className="font-medium">Current Tab:</span>{' '}
              <span className="capitalize">{activeTab.replace('-', ' ')}</span>
            </p>
            <p>
              <span className="font-medium">Period:</span> {getMonthName(month)} {year}
            </p>
            <p>
              <span className="font-medium">Data Included:</span>{' '}
              {activeTab === 'overview'
                ? 'Team summary, BDE performance, and metrics'
                : activeTab === 'bde-details'
                ? 'Detailed daily BDE activity and performance'
                : activeTab === 'leaderboard'
                ? 'Rankings, scores, and comparisons'
                : activeTab === 'historical'
                ? 'Multi-month trends and patterns'
                : 'Projections, risks, and opportunities'}
            </p>
          </div>
        </div>

        {/* Quick Export All */}
        <div className="mt-6 pt-6 border-t">
          <h4 className="font-semibold text-gray-900 mb-3">Quick Actions</h4>
          <div className="flex flex-wrap gap-3">
            <Button
              onClick={() => handleExport('excel')}
              disabled={exportStatus === 'loading'}
              variant="outline"
              size="sm"
            >
              <FileSpreadsheet className="mr-2 h-4 w-4 text-green-600" />
              Quick Excel Export
            </Button>
            <Button
              onClick={() => handleExport('csv')}
              disabled={exportStatus === 'loading'}
              variant="outline"
              size="sm"
            >
              <Table className="mr-2 h-4 w-4 text-blue-600" />
              Quick CSV Export
            </Button>
            <Button
              onClick={() => handleExport('pdf')}
              disabled={exportStatus === 'loading'}
              variant="outline"
              size="sm"
            >
              <FileText className="mr-2 h-4 w-4 text-red-600" />
              Quick PDF Export
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function getMonthName(month: number): string {
  const monthNames = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ]
  return monthNames[month] || 'Unknown'
}
