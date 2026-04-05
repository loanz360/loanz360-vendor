'use client'

import { Briefcase, ArrowLeft, Plus, Grid3X3, List, MapPin, Calendar, ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'
import { useState } from 'react'

export default function VendorPortfolioPage() {
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')

  const categories = ['All', 'Document Verification', 'Property Valuation', 'Legal Services', 'Insurance', 'Technical Audit']

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
              <h1 className="text-xl font-bold text-white font-poppins">Portfolio</h1>
              <p className="text-gray-400 text-sm mt-1">Showcase your past work and service specializations</p>
            </div>
          </div>
          <Button className="bg-[#FF6700] hover:bg-[#FF6700]/90 text-black font-medium">
            <Plus className="w-4 h-4 mr-2" /> Add Project
          </Button>
        </div>
      </header>

      <div className="p-6 space-y-6">
        {/* Filters & View Toggle */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2 overflow-x-auto">
            {categories.map((cat) => (
              <button
                key={cat}
                className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                  cat === 'All'
                    ? 'bg-[#FF6700] text-black'
                    : 'bg-neutral-800 text-gray-400 hover:text-white'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
          <div className="flex items-center space-x-1 bg-neutral-800 rounded-lg p-1">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded ${viewMode === 'grid' ? 'bg-neutral-700 text-white' : 'text-gray-400'}`}
            >
              <Grid3X3 className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-1.5 rounded ${viewMode === 'list' ? 'bg-neutral-700 text-white' : 'text-gray-400'}`}
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Portfolio Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="bg-brand-ash">
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-white">0</p>
              <p className="text-gray-400 text-xs mt-1">Projects Completed</p>
            </CardContent>
          </Card>
          <Card className="bg-brand-ash">
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-white">0</p>
              <p className="text-gray-400 text-xs mt-1">Service Categories</p>
            </CardContent>
          </Card>
          <Card className="bg-brand-ash">
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-white">0</p>
              <p className="text-gray-400 text-xs mt-1">Client Testimonials</p>
            </CardContent>
          </Card>
        </div>

        {/* Portfolio Grid - Empty State */}
        <Card className="bg-brand-ash">
          <CardHeader>
            <CardTitle className="text-white text-sm">Your Portfolio</CardTitle>
            <CardDescription>Projects, case studies, and work samples</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center justify-center py-16">
              <div className="w-16 h-16 bg-[#FF6700]/20 rounded-full flex items-center justify-center mb-4">
                <Briefcase className="w-8 h-8 text-[#FF6700]" />
              </div>
              <h3 className="text-white font-semibold mb-2">No portfolio items yet</h3>
              <p className="text-gray-400 text-center max-w-sm mb-4">
                Add your completed projects, work samples, and case studies to build a strong vendor portfolio. This helps clients understand your capabilities.
              </p>
              <Button className="bg-[#FF6700] hover:bg-[#FF6700]/90 text-black font-medium">
                <Plus className="w-4 h-4 mr-2" /> Add Your First Project
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
