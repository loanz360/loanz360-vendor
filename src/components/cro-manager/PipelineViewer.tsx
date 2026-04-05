'use client'

import { useState, useEffect, useCallback } from 'react'
import { Users, ListChecks, Briefcase, Search, ChevronLeft, ChevronRight } from 'lucide-react'

interface PipelineViewerProps {
  fetchUrl: string
  title?: string
}

type TabType = 'contacts' | 'leads' | 'deals'

interface PipelineRow {
  id: string
  customer_name: string
  phone: string
  loan_type: string
  status: string
  stage?: string
  cro_name: string
  created_at: string
  amount?: number
}

export default function PipelineViewer({ fetchUrl, title = 'Pipeline' }: PipelineViewerProps) {
  const [activeTab, setActiveTab] = useState<TabType>('contacts')
  const [data, setData] = useState<PipelineRow[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const limit = 20

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        type: activeTab,
        page: String(page),
        limit: String(limit),
      })
      if (search) params.set('search', search)
      if (statusFilter) params.set('status', statusFilter)

      const res = await fetch(`${fetchUrl}?${params}`)
      const json = await res.json()
      if (json.success) {
        setData(json.data || [])
        setTotal(json.meta?.pagination?.total || 0)
      }
    } catch {
      // silently fail
    } finally {
      setLoading(false)
    }
  }, [fetchUrl, activeTab, page, search, statusFilter])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  useEffect(() => {
    setPage(1)
  }, [activeTab, search, statusFilter])

  const totalPages = Math.ceil(total / limit)

  const tabs: { key: TabType; label: string; icon: typeof Users }[] = [
    { key: 'contacts', label: 'Contacts', icon: Users },
    { key: 'leads', label: 'Leads', icon: ListChecks },
    { key: 'deals', label: 'Deals', icon: Briefcase },
  ]

  const statusOptions: Record<TabType, string[]> = {
    contacts: ['new', 'called', 'positive', 'not_interested', 'follow_up'],
    leads: ['active', 'follow_up', 'converted', 'dropped'],
    deals: ['in_progress', 'docs_collected', 'submitted', 'approved', 'disbursed', 'rejected'],
  }

  return (
    <div className="space-y-4">
      {title && <h2 className="text-lg font-semibold text-white">{title}</h2>}

      {/* Tabs */}
      <div className="flex gap-2">
        {tabs.map((tab) => {
          const Icon = tab.icon
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === tab.key
                  ? 'bg-orange-500 text-white'
                  : 'bg-gray-800 text-gray-400 hover:text-white hover:bg-gray-700'
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          )
        })}
      </div>

      {/* Filters */}
      <div className="flex gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text"
            placeholder="Search by name or phone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500 focus:border-orange-500 focus:outline-none"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:border-orange-500 focus:outline-none"
        >
          <option value="">All Statuses</option>
          {statusOptions[activeTab].map((s) => (
            <option key={s} value={s}>
              {s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
            </option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-5 h-5 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
            <span className="ml-3 text-gray-400">Loading...</span>
          </div>
        ) : data.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            No {activeTab} found
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-800 text-left">
                  <th className="px-4 py-3 text-xs font-medium text-gray-400 uppercase">Name</th>
                  <th className="px-4 py-3 text-xs font-medium text-gray-400 uppercase">Phone</th>
                  <th className="px-4 py-3 text-xs font-medium text-gray-400 uppercase">Loan Type</th>
                  <th className="px-4 py-3 text-xs font-medium text-gray-400 uppercase">Status</th>
                  {activeTab !== 'contacts' && (
                    <th className="px-4 py-3 text-xs font-medium text-gray-400 uppercase">Stage</th>
                  )}
                  <th className="px-4 py-3 text-xs font-medium text-gray-400 uppercase">CRO</th>
                  <th className="px-4 py-3 text-xs font-medium text-gray-400 uppercase">Date</th>
                </tr>
              </thead>
              <tbody>
                {data.map((row) => (
                  <tr key={row.id} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                    <td className="px-4 py-3 text-sm text-white">{row.customer_name}</td>
                    <td className="px-4 py-3 text-sm text-gray-300">{row.phone}</td>
                    <td className="px-4 py-3 text-sm text-gray-300">{row.loan_type || '-'}</td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 text-xs rounded-full bg-gray-800 text-gray-300">
                        {row.status?.replace(/_/g, ' ')}
                      </span>
                    </td>
                    {activeTab !== 'contacts' && (
                      <td className="px-4 py-3 text-sm text-gray-300">{row.stage || '-'}</td>
                    )}
                    <td className="px-4 py-3 text-sm text-gray-300">{row.cro_name}</td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {new Date(row.created_at).toLocaleDateString('en-IN')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-800">
            <span className="text-sm text-gray-400">
              Page {page} of {totalPages} ({total} total)
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setPage(Math.max(1, page - 1))}
                disabled={page <= 1}
                className="p-1.5 text-gray-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => setPage(Math.min(totalPages, page + 1))}
                disabled={page >= totalPages}
                className="p-1.5 text-gray-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
