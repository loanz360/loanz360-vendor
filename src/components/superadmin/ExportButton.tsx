'use client'

import { toast } from 'sonner'

/**
 * EXPORT BUTTON COMPONENT
 * Universal export button with format selection
 */

import React, { useState } from 'react'
import { Download, FileText, FileSpreadsheet, FileJson, Loader2 } from 'lucide-react'

interface ExportButtonProps {
  endpoint: string
  filename?: string
  filters?: Record<string, unknown>
  label?: string
  className?: string
}

export function ExportButton({
  endpoint,
  filename = 'export',
  filters = {},
  label = 'Export',
  className = ''
}: ExportButtonProps) {
  const [isExporting, setIsExporting] = useState(false)
  const [showMenu, setShowMenu] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleExport = async (format: 'csv' | 'excel' | 'json') => {
    try {
      setIsExporting(true)
      setError(null)
      setShowMenu(false)

      // Build query parameters
      const params = new URLSearchParams({
        format,
        ...filters
      })

      // Fetch export data
      const response = await fetch(`${endpoint}?${params}`, {
        credentials: 'include'
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Export failed')
      }

      // Get filename from response headers or use default
      const contentDisposition = response.headers.get('Content-Disposition')
      let downloadFilename = `${filename}_${new Date().toISOString().split('T')[0]}.${format === 'excel' ? 'xlsx' : format}`

      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="(.+)"/)
        if (filenameMatch) {
          downloadFilename = filenameMatch[1]
        }
      }

      // Download file
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = downloadFilename
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)

      // Get export count from headers
      const exportCount = response.headers.get('X-Export-Count')
      if (exportCount) {
        toast.success(`Successfully exported ${exportCount} records as ${format.toUpperCase()}`)
      }

    } catch (err: unknown) {
      console.error('Export error:', err)
      setError((err instanceof Error ? err.message : String(err)) || 'Export failed')
      toast.error(`Export failed: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <div className="relative inline-block">
      <button
        onClick={() => setShowMenu(!showMenu)}
        disabled={isExporting}
        className={`inline-flex items-center px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
      >
        {isExporting ? (
          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
        ) : (
          <Download className="w-4 h-4 mr-2" />
        )}
        {isExporting ? 'Exporting...' : label}
      </button>

      {showMenu && !isExporting && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-10"
            onClick={() => setShowMenu(false)}
          />

          {/* Menu */}
          <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 z-20">
            <div className="py-2">
              <button
                onClick={() => handleExport('csv')}
                className="w-full flex items-center px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                <FileText className="w-4 h-4 mr-3" />
                Export as CSV
              </button>

              <button
                onClick={() => handleExport('excel')}
                className="w-full flex items-center px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                <FileSpreadsheet className="w-4 h-4 mr-3" />
                Export as Excel
              </button>

              <button
                onClick={() => handleExport('json')}
                className="w-full flex items-center px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                <FileJson className="w-4 h-4 mr-3" />
                Export as JSON
              </button>
            </div>

            <div className="border-t border-gray-200 dark:border-gray-700 px-4 py-2">
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Data will be downloaded to your device
              </p>
            </div>
          </div>
        </>
      )}

      {error && (
        <div className="absolute right-0 mt-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-800 dark:text-red-300">
          {error}
        </div>
      )}
    </div>
  )
}

/**
 * Compact export icon button (for toolbars)
 */
export function ExportIconButton({
  endpoint,
  filters = {},
  className = ''
}: Omit<ExportButtonProps, 'label' | 'filename'>) {
  const [isExporting, setIsExporting] = useState(false)

  const handleQuickExport = async () => {
    try {
      setIsExporting(true)

      const params = new URLSearchParams({
        format: 'csv',
        ...filters
      })

      const response = await fetch(`${endpoint}?${params}`, {
        credentials: 'include'
      })

      if (!response.ok) throw new Error('Export failed')

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `export_${new Date().toISOString().split('T')[0]}.csv`
      link.click()
      window.URL.revokeObjectURL(url)

    } catch (err) {
      console.error('Export error:', err)
      toast.error('Export failed')
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <button
      onClick={handleQuickExport}
      disabled={isExporting}
      className={`p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-50 ${className}`}
      title="Export as CSV"
    >
      {isExporting ? (
        <Loader2 className="w-5 h-5 animate-spin" />
      ) : (
        <Download className="w-5 h-5" />
      )}
    </button>
  )
}
