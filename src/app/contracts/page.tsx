'use client'

import { FileText, ArrowLeft, Search, Filter, Clock, CheckCircle, AlertCircle, XCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { SearchInput } from '@/components/ui/input'
import Link from 'next/link'
import { useState } from 'react'

export default function VendorContractsPage() {
  const [searchTerm, setSearchTerm] = useState('')
  const [activeTab, setActiveTab] = useState<'all' | 'active' | 'pending' | 'completed' | 'expired'>('all')

  const tabs = [
    { key: 'all' as const, label: 'All Contracts', count: 0 },
    { key: 'active' as const, label: 'Active', count: 0 },
    { key: 'pending' as const, label: 'Pending', count: 0 },
    { key: 'completed' as const, label: 'Completed', count: 0 },
    { key: 'expired' as const, label: 'Expired', count: 0 },
  ]

  const stats = [
    { label: 'Total Contracts', value: '0', icon: FileText, color: 'text-[#FF6700]', bg: 'bg-[#FF6700]/20' },
    { label: 'Active', value: '0', icon: CheckCircle, color: 'text-green-400', bg: 'bg-green-500/20' },
    { label: 'Pending Approval', value: '0', icon: Clock, color: 'text-gray-400', bg: 'bg-gray-500/20' },
    { label: 'Expiring Soon', value: '0', icon: AlertCircle, color: 'text-red-400', bg: 'bg-red-500/20' },
  ]

  return (
    <div className="min-h-screen bg-black font-poppins text-xs">
      {/* Header */}
      <header className="bg-black border-b border-neutral-800 p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Link href="/vendors">
              <Button variant="ghost" size="sm" className="text-gray-400 hover:text-white">
                <ArrowLeft className="w-4 h-4 mr-2" /> Back
              </Button>
            </Link>
            <div>
              <h1 className="text-xl font-bold text-white font-poppins">Contracts</h1>
              <p className="text-gray-400 text-sm mt-1">View and manage your service contracts</p>
            </div>
          </div>
        </div>
      </header>

      <div className="p-6 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {stats.map((stat) => (
            <Card key={stat.label} className="bg-brand-ash">
              <CardContent className="p-4 flex items-center space-x-4">
                <div className={`w-10 h-10 ${stat.bg} rounded-lg flex items-center justify-center`}>
                  <stat.icon className={`w-5 h-5 ${stat.color}`} />
                </div>
                <div>
                  <p className="text-gray-400 text-xs">{stat.label}</p>
                  <p className="text-white text-lg font-bold">{stat.value}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex items-center space-x-1 border-b border-neutral-800">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-2 text-xs font-medium border-b-2 transition-colors ${
                activeTab === tab.key
                  ? 'border-[#FF6700] text-[#FF6700]'
                  : 'border-transparent text-gray-400 hover:text-white'
              }`}
            >
              {tab.label} ({tab.count})
            </button>
          ))}
        </div>

        {/* Search & Filter */}
        <div className="flex items-center justify-between gap-4">
          <SearchInput
            placeholder="Search contracts..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="flex-1 max-w-md"
          />
          <Button variant="outline" size="sm" className="border-neutral-700 text-gray-300">
            <Filter className="w-4 h-4 mr-2" /> Filter
          </Button>
        </div>

        {/* Contracts Table */}
        <Card className="bg-brand-ash">
          <CardContent className="p-0">
            {/* Table Header */}
            <div className="grid grid-cols-7 gap-4 px-6 py-3 border-b border-neutral-700 text-gray-400 text-xs font-medium">
              <span>Contract ID</span>
              <span>Service</span>
              <span>Client</span>
              <span>Start Date</span>
              <span>End Date</span>
              <span>Value</span>
              <span>Status</span>
            </div>

            {/* Empty State */}
            <div className="flex flex-col items-center justify-center py-16">
              <div className="w-16 h-16 bg-[#FF6700]/20 rounded-full flex items-center justify-center mb-4">
                <FileText className="w-8 h-8 text-[#FF6700]" />
              </div>
              <h3 className="text-white font-semibold mb-2">No contracts available</h3>
              <p className="text-gray-400 text-center max-w-sm">
                Your contracts will appear here once they are created. Active, pending, and completed contracts will be listed with their details.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
