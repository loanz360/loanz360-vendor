'use client'

import React, { useState } from 'react'
import { Download, Loader2, AlertCircle, X, CheckCircle } from 'lucide-react'
import { clientLogger } from '@/lib/utils/client-logger'

interface ExportCustomersProps {
  filters?: {
    category?: string | null
    status?: string | null
    kyc_status?: string | null
    search?: string
  }
}

export function ExportCustomers({ filters }: ExportCustomersProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [exportFormat, setExportFormat] = useState<'csv' | 'json'>('csv')
  const [includeDetails, setIncludeDetails] = useState(false)

  const handleExport = async () => {
    setIsExporting(true)
    setError(null)
    setSuccess(null)

    try {
      const params = new URLSearchParams({
        format: exportFormat,
        include_details: includeDetails.toString(),
        ...(filters?.category && filters.category !== 'all' && { category: filters.category }),
        ...(filters?.status && filters.status !== 'all' && { status: filters.status }),
        ...(filters?.kyc_status && filters.kyc_status !== 'all' && { kyc_status: filters.kyc_status }),
        ...(filters?.search && { search: filters.search })
      })

      const response = await fetch(`/api/superadmin/customer-management/customers/export?${params.toString()}`)

      if (!response.ok) {
        throw new Error('Export failed')
      }

      if (exportFormat === 'csv') {
        // Download CSV file
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `customers-export-${new Date().toISOString().split('T')[0]}.csv`
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)
        document.body.removeChild(a)
      } else {
        // Download JSON file
        const data = await response.json()
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `customers-export-${new Date().toISOString().split('T')[0]}.json`
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)
        document.body.removeChild(a)
      }

      setSuccess('Export completed successfully!')
      setTimeout(() => {
        setSuccess(null)
        setIsOpen(false)
      }, 2000)

    } catch (err) {
      console.error('Export error:', err)
      setError('Failed to export customers')
      clientLogger.error('Customer export failed', { error: err, format: exportFormat })
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <div className="relative">
      {/* Export Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center space-x-2 px-4 py-2 bg-white/10 hover:bg-white/20 border border-white/20 text-white rounded-lg transition-colors"
      >
        <Download className="w-4 h-4" />
        <span>Export</span>
      </button>

      {/* Export Modal */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/50 z-40"
            onClick={() => setIsOpen(false)}
          />

          {/* Modal */}
          <div className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-md">
            <div className="bg-gradient-to-br from-gray-900 to-black rounded-xl shadow-2xl border border-white/10 overflow-hidden">
              {/* Header */}
              <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-orange-600 rounded-lg flex items-center justify-center">
                    <Download className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h3 className="text-white font-semibold text-lg">Export Customers</h3>
                    <p className="text-xs text-gray-400">Download customer data</p>
                  </div>
                </div>
                <button
                  onClick={() => setIsOpen(false)}
                  className="text-gray-400 hover:text-white transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Content */}
              <div className="p-6">
                {/* Error Message */}
                {error && (
                  <div className="mb-4 bg-red-500/20 border border-red-500/30 rounded-lg p-3 flex items-start space-x-3">
                    <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-red-400 text-sm">{error}</p>
                    </div>
                    <button onClick={() => setError(null)} className="text-red-400 hover:text-red-300">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}

                {/* Success Message */}
                {success && (
                  <div className="mb-4 bg-green-500/20 border border-green-500/30 rounded-lg p-3 flex items-start space-x-3">
                    <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-green-400 text-sm">{success}</p>
                    </div>
                  </div>
                )}

                {/* Export Format */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Export Format
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => setExportFormat('csv')}
                      className={`px-4 py-3 rounded-lg border transition-colors ${
                        exportFormat === 'csv'
                          ? 'bg-orange-600/20 border-orange-500/30 text-orange-400'
                          : 'bg-white/5 border-white/10 text-gray-300 hover:bg-white/10'
                      }`}
                    >
                      <div className="text-sm font-semibold">CSV</div>
                      <div className="text-xs opacity-75">Excel compatible</div>
                    </button>
                    <button
                      onClick={() => setExportFormat('json')}
                      className={`px-4 py-3 rounded-lg border transition-colors ${
                        exportFormat === 'json'
                          ? 'bg-orange-600/20 border-orange-500/30 text-orange-400'
                          : 'bg-white/5 border-white/10 text-gray-300 hover:bg-white/10'
                      }`}
                    >
                      <div className="text-sm font-semibold">JSON</div>
                      <div className="text-xs opacity-75">Developer friendly</div>
                    </button>
                  </div>
                </div>

                {/* Include Details */}
                <div className="mb-6">
                  <label className="flex items-center space-x-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={includeDetails}
                      onChange={(e) => setIncludeDetails(e.target.checked)}
                      className="w-4 h-4 rounded border-white/20 bg-white/5 text-orange-600 focus:ring-orange-500"
                    />
                    <div>
                      <div className="text-sm font-medium text-white">Include detailed information</div>
                      <div className="text-xs text-gray-400">
                        Address, employment, financial data (larger file size)
                      </div>
                    </div>
                  </label>
                </div>

                {/* Active Filters Info */}
                {(filters?.category || filters?.status || filters?.kyc_status || filters?.search) && (
                  <div className="mb-6 bg-blue-500/10 border border-blue-500/20 rounded-lg p-3">
                    <p className="text-xs text-blue-400 font-medium mb-2">Active Filters:</p>
                    <div className="flex flex-wrap gap-2">
                      {filters.category && filters.category !== 'all' && (
                        <span className="px-2 py-1 bg-blue-500/20 text-blue-300 rounded text-xs">
                          Category: {filters.category}
                        </span>
                      )}
                      {filters.status && filters.status !== 'all' && (
                        <span className="px-2 py-1 bg-blue-500/20 text-blue-300 rounded text-xs">
                          Status: {filters.status}
                        </span>
                      )}
                      {filters.kyc_status && filters.kyc_status !== 'all' && (
                        <span className="px-2 py-1 bg-blue-500/20 text-blue-300 rounded text-xs">
                          KYC: {filters.kyc_status}
                        </span>
                      )}
                      {filters.search && (
                        <span className="px-2 py-1 bg-blue-500/20 text-blue-300 rounded text-xs">
                          Search: {filters.search}
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex space-x-3">
                  <button
                    onClick={() => setIsOpen(false)}
                    disabled={isExporting}
                    className="flex-1 px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 text-white rounded-lg transition-colors disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleExport}
                    disabled={isExporting}
                    className="flex-1 flex items-center justify-center space-x-2 px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg transition-colors disabled:opacity-50"
                  >
                    {isExporting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Exporting...</span>
                      </>
                    ) : (
                      <>
                        <Download className="w-4 h-4" />
                        <span>Export Now</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
