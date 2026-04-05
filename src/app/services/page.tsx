'use client'

import { Wrench, ArrowLeft, Plus, Search, Filter, Package, Clock, CheckCircle, XCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { SearchInput } from '@/components/ui/input'
import Link from 'next/link'
import { useState } from 'react'

export default function VendorServicesPage() {
  const [searchTerm, setSearchTerm] = useState('')

  const stats = [
    { label: 'Total Services', value: '0', icon: Package, color: 'text-[#FF6700]', bg: 'bg-[#FF6700]/20' },
    { label: 'Active', value: '0', icon: CheckCircle, color: 'text-green-400', bg: 'bg-green-500/20' },
    { label: 'Pending Review', value: '0', icon: Clock, color: 'text-gray-400', bg: 'bg-gray-500/20' },
    { label: 'Inactive', value: '0', icon: XCircle, color: 'text-gray-400', bg: 'bg-gray-500/20' },
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
              <h1 className="text-xl font-bold text-white font-poppins">Service Catalog</h1>
              <p className="text-gray-400 text-sm mt-1">Manage your service offerings and pricing</p>
            </div>
          </div>
          <Button className="bg-[#FF6700] hover:bg-[#FF6700]/90 text-black font-medium">
            <Plus className="w-4 h-4 mr-2" /> Add Service
          </Button>
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

        {/* Filters & Search */}
        <Card className="bg-brand-ash">
          <CardContent className="p-4">
            <div className="flex items-center justify-between gap-4">
              <SearchInput
                placeholder="Search services..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="flex-1 max-w-md"
              />
              <div className="flex items-center space-x-2">
                <Button variant="outline" size="sm" className="border-neutral-700 text-gray-300">
                  <Filter className="w-4 h-4 mr-2" /> Filter
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Services Table */}
        <Card className="bg-brand-ash">
          <CardHeader>
            <CardTitle className="text-white text-sm">Your Services</CardTitle>
            <CardDescription>All registered service offerings</CardDescription>
          </CardHeader>
          <CardContent>
            {/* Table Header */}
            <div className="grid grid-cols-6 gap-4 px-4 py-3 border-b border-neutral-700 text-gray-400 text-xs font-medium">
              <span>Service Name</span>
              <span>Category</span>
              <span>Price Range</span>
              <span>Status</span>
              <span>Requests</span>
              <span>Actions</span>
            </div>

            {/* Empty State */}
            <div className="flex flex-col items-center justify-center py-16">
              <div className="w-16 h-16 bg-[#FF6700]/20 rounded-full flex items-center justify-center mb-4">
                <Wrench className="w-8 h-8 text-[#FF6700]" />
              </div>
              <h3 className="text-white font-semibold mb-2">No services registered</h3>
              <p className="text-gray-400 text-center max-w-sm mb-4">
                Start by adding your first service to the catalog. Your services will appear here once registered.
              </p>
              <Button className="bg-[#FF6700] hover:bg-[#FF6700]/90 text-black font-medium">
                <Plus className="w-4 h-4 mr-2" /> Add Your First Service
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
