'use client'

import React, { useState } from 'react'
import { Download, FileSpreadsheet, Loader2 } from 'lucide-react'

interface TeamMember {
  name: string
  sub_role: string
  today: { picked_up: number; verified: number; rejected: number }
  monthly: { picked_up: number; verified: number; rejected: number }
}

interface BankData {
  bank: string
  pending: number
  verified: number
  rejected: number
  total: number
  approval_rate: number
  total_amount: number
}

interface OverdueApp {
  app_id: string
  customer_name: string
  bank_name: string
  amount: number
  type: string
  age_hours: number
}

interface ExportData {
  teamPerformance: TeamMember[]
  bankAnalytics: BankData[]
  overdueApps: OverdueApp[]
  stats: {
    pending_total: number
    in_progress_total: number
    verified_today_total: number
    monthly: { total_verified: number }
  }
  financial: { total_pending_amount: number }
  approvalMetrics: { current_rate: number; mom_change: number }
  processingTime: { avg_hours: number; median_hours: number }
}

interface Props {
  data: ExportData
}

function escapeCSV(value: string | number): string {
  const str = String(value)
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

function downloadCSV(filename: string, csvContent: string) {
  const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' }) // BOM for Excel
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = filename
  link.click()
  URL.revokeObjectURL(link.href)
}

export default function ExportDashboard({ data }: Props) {
  const [exporting, setExporting] = useState(false)

  const handleExport = (type: 'team' | 'bank' | 'overdue' | 'summary') => {
    setExporting(true)
    const dateStr = new Date().toISOString().split('T')[0]

    try {
      switch (type) {
        case 'team': {
          const headers = ['Name', 'Role', 'Picked Up (Today)', 'Verified (Today)', 'Rejected (Today)', 'Picked Up (Month)', 'Verified (Month)', 'Rejected (Month)']
          const rows = data.teamPerformance.map(m => [
            escapeCSV(m.name),
            m.sub_role === 'ACCOUNTS_MANAGER' ? 'Manager' : 'Executive',
            m.today.picked_up, m.today.verified, m.today.rejected,
            m.monthly.picked_up, m.monthly.verified, m.monthly.rejected,
          ].join(','))
          downloadCSV(`team-performance-${dateStr}.csv`, [headers.join(','), ...rows].join('\n'))
          break
        }
        case 'bank': {
          const headers = ['Bank', 'Pending', 'Verified', 'Rejected', 'Total', 'Approval Rate (%)', 'Pending Amount']
          const rows = data.bankAnalytics.map(b => [
            escapeCSV(b.bank), b.pending, b.verified, b.rejected, b.total, b.approval_rate, b.total_amount,
          ].join(','))
          downloadCSV(`bank-analytics-${dateStr}.csv`, [headers.join(','), ...rows].join('\n'))
          break
        }
        case 'overdue': {
          const headers = ['App ID', 'Customer', 'Bank', 'Type', 'Amount', 'Age (Hours)', 'Age (Days)']
          const rows = data.overdueApps.map(a => [
            escapeCSV(a.app_id), escapeCSV(a.customer_name), escapeCSV(a.bank_name),
            a.type, a.amount, a.age_hours, Math.floor(a.age_hours / 24),
          ].join(','))
          downloadCSV(`overdue-applications-${dateStr}.csv`, [headers.join(','), ...rows].join('\n'))
          break
        }
        case 'summary': {
          const lines = [
            `Accounts Manager Dashboard Summary - ${dateStr}`,
            '',
            'Pipeline Overview',
            `Total Pending,${data.stats.pending_total}`,
            `In Verification,${data.stats.in_progress_total}`,
            `Verified Today,${data.stats.verified_today_total}`,
            `Monthly Verified,${data.stats.monthly.total_verified}`,
            '',
            'Financial',
            `Total Pending Amount,${data.financial.total_pending_amount}`,
            '',
            'Quality Metrics',
            `Approval Rate,${data.approvalMetrics.current_rate}%`,
            `MoM Volume Change,${data.approvalMetrics.mom_change}%`,
            `Avg Processing Time (hours),${data.processingTime.avg_hours}`,
            `Median Processing Time (hours),${data.processingTime.median_hours}`,
            '',
            'Overdue',
            `Total Overdue Applications,${data.overdueApps.length}`,
          ]
          downloadCSV(`dashboard-summary-${dateStr}.csv`, lines.join('\n'))
          break
        }
      }
    } finally {
      setTimeout(() => setExporting(false), 500)
    }
  }

  const exportOptions = [
    { type: 'summary' as const, label: 'Dashboard Summary', icon: FileSpreadsheet },
    { type: 'team' as const, label: 'Team Performance', icon: FileSpreadsheet },
    { type: 'bank' as const, label: 'Bank Analytics', icon: FileSpreadsheet },
    { type: 'overdue' as const, label: 'Overdue Applications', icon: FileSpreadsheet },
  ]

  return (
    <div className="frosted-card p-6 rounded-lg">
      <h2 className="text-lg font-bold mb-4 font-poppins text-white flex items-center gap-2">
        <Download className="w-5 h-5 text-orange-500" />
        Export Reports
      </h2>
      <div className="space-y-2">
        {exportOptions.map((option) => (
          <button
            key={option.type}
            onClick={() => handleExport(option.type)}
            disabled={exporting}
            className="w-full flex items-center gap-3 p-3 rounded-lg bg-gray-800/30 border border-gray-800 hover:bg-gray-800/50 hover:border-gray-700 transition-colors text-left disabled:opacity-50"
          >
            {exporting ? (
              <Loader2 className="w-4 h-4 text-orange-400 animate-spin flex-shrink-0" />
            ) : (
              <option.icon className="w-4 h-4 text-orange-400 flex-shrink-0" />
            )}
            <span className="text-sm text-gray-300">{option.label}</span>
            <span className="text-xs text-gray-600 ml-auto">CSV</span>
          </button>
        ))}
      </div>
    </div>
  )
}
