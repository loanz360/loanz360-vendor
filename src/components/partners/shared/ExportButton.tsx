'use client'

import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Download,
  FileSpreadsheet,
  FileJson,
  ChevronDown,
  Loader2,
  Check,
  X
} from 'lucide-react'
import { Button } from '@/components/ui/button'

interface ExportButtonProps {
  partnerType: 'BA' | 'BP' | 'CP'
  exportTypes?: ('grid' | 'analytics' | 'rates_by_bank')[]
}

export default function ExportButton({ partnerType, exportTypes = ['grid'] }: ExportButtonProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [exportStatus, setExportStatus] = useState<'idle' | 'success' | 'error'>('idle')

  const handleExport = async (type: string, format: 'csv' | 'json') => {
    setIsExporting(true)
    setExportStatus('idle')

    try {
      const response = await fetch(`/api/commissions/export?type=${type}&format=${format}`)

      if (!response.ok) {
        throw new Error('Export failed')
      }

      if (format === 'json') {
        const data = await response.json()
        // Download as JSON file
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `${type}_${partnerType}_${new Date().toISOString().split('T')[0]}.json`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
      } else {
        // Download CSV
        const blob = await response.blob()
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `${type}_${partnerType}_${new Date().toISOString().split('T')[0]}.csv`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
      }

      setExportStatus('success')
      setTimeout(() => {
        setExportStatus('idle')
        setIsOpen(false)
      }, 1500)
    } catch (error) {
      console.error('Export error:', error)
      setExportStatus('error')
      setTimeout(() => setExportStatus('idle'), 2000)
    } finally {
      setIsExporting(false)
    }
  }

  const exportTypeLabels: Record<string, string> = {
    'grid': 'Payout Grid',
    'analytics': 'Analytics Summary',
    'rates_by_bank': 'Rates by Bank'
  }

  return (
    <div className="relative">
      <Button
        onClick={() => setIsOpen(!isOpen)}
        variant="outline"
        className="border-white/10 text-gray-300 hover:text-white hover:bg-white/5"
      >
        <Download className="w-4 h-4 mr-2" />
        Export
        <ChevronDown className={`w-4 h-4 ml-2 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </Button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            className="absolute right-0 mt-2 w-64 bg-gray-900 rounded-lg border border-white/10 shadow-xl z-50 overflow-hidden"
          >
            {/* Header */}
            <div className="px-4 py-3 border-b border-white/10">
              <h4 className="text-sm font-medium text-white">Export Options</h4>
              <p className="text-xs text-gray-500 mt-0.5">Choose format and data type</p>
            </div>

            {/* Export Options */}
            <div className="p-2">
              {exportTypes.map((type) => (
                <div key={type} className="mb-2 last:mb-0">
                  <p className="px-2 py-1 text-xs text-gray-500 uppercase">{exportTypeLabels[type]}</p>
                  <div className="flex gap-1">
                    <button
                      onClick={() => handleExport(type, 'csv')}
                      disabled={isExporting}
                      className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-md
                                 bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white
                                 transition-colors text-sm disabled:opacity-50"
                    >
                      {isExporting ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : exportStatus === 'success' ? (
                        <Check className="w-4 h-4 text-green-400" />
                      ) : exportStatus === 'error' ? (
                        <X className="w-4 h-4 text-red-400" />
                      ) : (
                        <FileSpreadsheet className="w-4 h-4" />
                      )}
                      <span>CSV</span>
                    </button>
                    <button
                      onClick={() => handleExport(type, 'json')}
                      disabled={isExporting}
                      className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-md
                                 bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white
                                 transition-colors text-sm disabled:opacity-50"
                    >
                      {isExporting ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <FileJson className="w-4 h-4" />
                      )}
                      <span>JSON</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Footer */}
            <div className="px-4 py-2 border-t border-white/10 bg-white/5">
              <p className="text-[10px] text-gray-500">
                Export includes current commission rates only
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Backdrop to close dropdown */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setIsOpen(false)}
        />
      )}
    </div>
  )
}
