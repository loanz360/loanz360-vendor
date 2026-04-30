'use client'

import React, { useState, useRef, useEffect } from 'react'
import { Download, FileText, FileSpreadsheet, BarChart3, Users, Loader2, ChevronDown } from 'lucide-react'
import {
  exportDashboardPDF,
  exportTeamPerformanceCSV,
  exportFinancialReportCSV,
  exportAnalyticsCSV,
  type DashboardExportData,
  type FinancialExport,
  type AnalyticsPoint,
} from '@/lib/utils/report-export'

interface Props {
  dashboardData: unknown; dateRange?: { start: string; end: string }
}

type ExportType = 'pdf' | 'team' | 'financial' | 'analytics'

const EXPORT_OPTIONS: { type: ExportType; label: string; format: string; icon: typeof FileText }[] = [
  { type: 'pdf', label: 'Dashboard Summary', format: 'PDF', icon: FileText },
  { type: 'team', label: 'Team Performance', format: 'CSV', icon: Users },
  { type: 'financial', label: 'Financial Report', format: 'CSV', icon: FileSpreadsheet },
  { type: 'analytics', label: 'Analytics Data', format: 'CSV', icon: BarChart3 },
]

export default function ReportExportMenu({ dashboardData, dateRange }: Props) {
  const [open, setOpen] = useState(false)
  const [exporting, setExporting] = useState<ExportType | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    if (open) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [open])

  // Close on Escape
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    if (open) {
      document.addEventListener('keydown', handleKey)
      return () => document.removeEventListener('keydown', handleKey)
    }
  }, [open])

  const handleExport = async (type: ExportType) => {
    setExporting(type)
    try {
      switch (type) {
        case 'pdf': {
          const pdfData: DashboardExportData = {
            stats: dashboardData.stats,
            financial: dashboardData.financial,
            teamPerformance: dashboardData.teamPerformance || [],
            approvalMetrics: dashboardData.approvalMetrics || { current_rate: 0, mom_change: 0 },
            processingTime: dashboardData.processingTime || { avg_hours: 0, median_hours: 0 },
          }
          exportDashboardPDF(pdfData, dateRange)
          break
        }
        case 'team': {
          exportTeamPerformanceCSV(dashboardData.teamPerformance || [])
          break
        }
        case 'financial': {
          // Build financial export rows from the dashboard financial data
          const financialRows: FinancialExport[] = [
            {
              partner_type: 'Channel Partner (CP)',
              pending_count: dashboardData.financial?.cp_pending_count || 0,
              pending_amount: dashboardData.financial?.cp_pending_amount || 0,
              verified_this_month: dashboardData.financial?.cp_verified_month || 0,
              avg_processing_time: dashboardData.processingTime?.avg_hours || 0,
            },
            {
              partner_type: 'Business Associate (BA)',
              pending_count: dashboardData.financial?.ba_pending_count || 0,
              pending_amount: dashboardData.financial?.ba_pending_amount || 0,
              verified_this_month: dashboardData.financial?.ba_verified_month || 0,
              avg_processing_time: dashboardData.processingTime?.avg_hours || 0,
            },
            {
              partner_type: 'Business Partner (BP)',
              pending_count: dashboardData.financial?.bp_pending_count || 0,
              pending_amount: dashboardData.financial?.bp_pending_amount || 0,
              verified_this_month: dashboardData.financial?.bp_verified_month || 0,
              avg_processing_time: dashboardData.processingTime?.avg_hours || 0,
            },
          ]
          exportFinancialReportCSV(financialRows)
          break
        }
        case 'analytics': {
          const analyticsData: AnalyticsPoint[] = dashboardData.analytics || dashboardData.dailyTrend || []
          exportAnalyticsCSV(analyticsData)
          break
        }
      }
    } finally {
      // Brief delay so user sees the loading state
      setTimeout(() => {
        setExporting(null)
        setOpen(false)
      }, 500)
    }
  }

  return (
    <div ref={menuRef} className="relative">
      {/* Trigger button */}
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-800/40 border border-gray-700/50 hover:bg-gray-800/60 hover:border-gray-600 transition-colors text-sm text-gray-300 backdrop-blur-sm"
      >
        <Download className="w-4 h-4 text-orange-400" />
        <span className="hidden sm:inline">Export</span>
        <ChevronDown className={`w-3.5 h-3.5 text-gray-500 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown menu */}
      {open && (
        <div className="absolute right-0 mt-2 w-64 rounded-lg bg-gray-900/95 border border-gray-700/60 shadow-xl backdrop-blur-md z-50 overflow-hidden animate-in fade-in slide-in-from-top-1 duration-150">
          <div className="px-3 py-2 border-b border-gray-800">
            <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Export Reports</p>
          </div>
          <div className="py-1">
            {EXPORT_OPTIONS.map((option) => {
              const Icon = option.icon
              const isLoading = exporting === option.type
              return (
                <button
                  key={option.type}
                  onClick={() => handleExport(option.type)}
                  disabled={exporting !== null}
                  className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-gray-800/60 transition-colors text-left disabled:opacity-50"
                >
                  {isLoading ? (
                    <Loader2 className="w-4 h-4 text-orange-400 animate-spin flex-shrink-0" />
                  ) : (
                    <Icon className="w-4 h-4 text-orange-400 flex-shrink-0" />
                  )}
                  <span className="text-sm text-gray-300 flex-1">{option.label}</span>
                  <span className="text-[10px] text-gray-600 font-medium bg-gray-800/80 px-1.5 py-0.5 rounded">
                    {option.format}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
