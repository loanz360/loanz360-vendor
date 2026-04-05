'use client'

import { BarChart3, ArrowLeft, Download, FileText, PieChart, TrendingUp, Calendar, Clock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'

export default function VendorReportsPage() {
  const reportTypes = [
    {
      title: 'Earnings Report',
      description: 'Detailed breakdown of your earnings, commissions, and payouts',
      icon: TrendingUp,
      color: 'text-green-400',
      bg: 'bg-green-500/20',
      available: false,
    },
    {
      title: 'Service Report',
      description: 'Summary of all services rendered, completion rates, and SLA metrics',
      icon: FileText,
      color: 'text-gray-400',
      bg: 'bg-gray-500/20',
      available: false,
    },
    {
      title: 'Performance Report',
      description: 'Ratings, response time analytics, and client satisfaction scores',
      icon: PieChart,
      color: 'text-gray-400',
      bg: 'bg-gray-500/20',
      available: false,
    },
    {
      title: 'Contract Report',
      description: 'Active, completed, and expired contract summaries with financials',
      icon: BarChart3,
      color: 'text-[#FF6700]',
      bg: 'bg-[#FF6700]/20',
      available: false,
    },
    {
      title: 'Monthly Summary',
      description: 'Comprehensive monthly overview of all vendor activities',
      icon: Calendar,
      color: 'text-gray-400',
      bg: 'bg-gray-500/20',
      available: false,
    },
    {
      title: 'Tax Report',
      description: 'TDS deductions, GST details, and tax-related financial summaries',
      icon: FileText,
      color: 'text-red-400',
      bg: 'bg-red-500/20',
      available: false,
    },
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
              <h1 className="text-xl font-bold text-white font-poppins">Reports</h1>
              <p className="text-gray-400 text-sm mt-1">Generate and download detailed reports</p>
            </div>
          </div>
        </div>
      </header>

      <div className="p-6 space-y-6">
        {/* Report Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {reportTypes.map((report) => (
            <Card key={report.title} className="bg-brand-ash hover:border-[#FF6700]/30 transition-colors">
              <CardContent className="p-6">
                <div className="flex items-start space-x-4">
                  <div className={`w-12 h-12 ${report.bg} rounded-lg flex items-center justify-center flex-shrink-0`}>
                    <report.icon className={`w-6 h-6 ${report.color}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-white font-semibold text-sm mb-1">{report.title}</h3>
                    <p className="text-gray-400 text-xs mb-4">{report.description}</p>
                    <div className="flex items-center justify-between">
                      <Badge variant="closed">No data</Badge>
                      <Button
                        variant="outline"
                        size="sm"
                        className="border-neutral-700 text-gray-400"
                        disabled
                      >
                        <Download className="w-3 h-3 mr-1" /> Download
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Recent Reports */}
        <Card className="bg-brand-ash">
          <CardHeader>
            <CardTitle className="text-white text-sm">Generated Reports</CardTitle>
            <CardDescription>Previously generated reports available for download</CardDescription>
          </CardHeader>
          <CardContent>
            {/* Table Header */}
            <div className="grid grid-cols-5 gap-4 px-4 py-3 border-b border-neutral-700 text-gray-400 text-xs font-medium">
              <span>Report Name</span>
              <span>Type</span>
              <span>Period</span>
              <span>Generated On</span>
              <span>Action</span>
            </div>

            {/* Empty State */}
            <div className="flex flex-col items-center justify-center py-16">
              <div className="w-16 h-16 bg-[#FF6700]/20 rounded-full flex items-center justify-center mb-4">
                <BarChart3 className="w-8 h-8 text-[#FF6700]" />
              </div>
              <h3 className="text-white font-semibold mb-2">No reports generated</h3>
              <p className="text-gray-400 text-center max-w-sm">
                Reports will be available for download once you have sufficient data from your services and contracts.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
