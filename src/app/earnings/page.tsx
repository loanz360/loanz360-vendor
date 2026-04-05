'use client'

import { IndianRupee, ArrowLeft, Download, TrendingUp, Wallet, CreditCard, Clock, ArrowUpRight, ArrowDownRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'
import { useState } from 'react'

export default function VendorEarningsPage() {
  const [period, setPeriod] = useState<'week' | 'month' | 'quarter' | 'year'>('month')

  const stats = [
    { label: 'Total Earnings', value: '₹0', icon: IndianRupee, color: 'text-[#FF6700]', bg: 'bg-[#FF6700]/20', change: null },
    { label: 'This Month', value: '₹0', icon: TrendingUp, color: 'text-green-400', bg: 'bg-green-500/20', change: null },
    { label: 'Pending Payout', value: '₹0', icon: Wallet, color: 'text-gray-400', bg: 'bg-gray-500/20', change: null },
    { label: 'Last Payout', value: '₹0', icon: CreditCard, color: 'text-gray-400', bg: 'bg-gray-500/20', change: null },
  ]

  const periods = [
    { key: 'week' as const, label: 'This Week' },
    { key: 'month' as const, label: 'This Month' },
    { key: 'quarter' as const, label: 'This Quarter' },
    { key: 'year' as const, label: 'This Year' },
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
              <h1 className="text-xl font-bold text-white font-poppins">Earnings</h1>
              <p className="text-gray-400 text-sm mt-1">Track your earnings, payouts, and payment history</p>
            </div>
          </div>
          <Button variant="outline" className="border-neutral-700 text-gray-300">
            <Download className="w-4 h-4 mr-2" /> Export Statement
          </Button>
        </div>
      </header>

      <div className="p-6 space-y-6">
        {/* Period Selector */}
        <div className="flex items-center space-x-2">
          {periods.map((p) => (
            <button
              key={p.key}
              onClick={() => setPeriod(p.key)}
              className={`px-4 py-2 rounded-lg text-xs font-medium transition-colors ${
                period === p.key
                  ? 'bg-[#FF6700] text-black'
                  : 'bg-neutral-800 text-gray-400 hover:text-white'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

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

        {/* Earnings Chart Placeholder */}
        <Card className="bg-brand-ash">
          <CardHeader>
            <CardTitle className="text-white text-sm">Earnings Overview</CardTitle>
            <CardDescription>Monthly earnings trend</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-64 flex items-center justify-center border border-dashed border-neutral-700 rounded-lg">
              <div className="text-center">
                <TrendingUp className="w-10 h-10 text-neutral-600 mx-auto mb-2" />
                <p className="text-gray-400">Earnings chart will appear here once you have transaction data</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Transaction History */}
        <Card className="bg-brand-ash">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-white text-sm">Transaction History</CardTitle>
                <CardDescription>All earnings and payout transactions</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {/* Table Header */}
            <div className="grid grid-cols-6 gap-4 px-4 py-3 border-b border-neutral-700 text-gray-400 text-xs font-medium">
              <span>Transaction ID</span>
              <span>Description</span>
              <span>Date</span>
              <span>Amount</span>
              <span>Type</span>
              <span>Status</span>
            </div>

            {/* Empty State */}
            <div className="flex flex-col items-center justify-center py-16">
              <div className="w-16 h-16 bg-[#FF6700]/20 rounded-full flex items-center justify-center mb-4">
                <IndianRupee className="w-8 h-8 text-[#FF6700]" />
              </div>
              <h3 className="text-white font-semibold mb-2">No transactions yet</h3>
              <p className="text-gray-400 text-center max-w-sm">
                Your earning and payout transactions will appear here once you start receiving payments for your services.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
