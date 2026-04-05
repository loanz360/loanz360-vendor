'use client'

import { HeadphonesIcon, ArrowLeft, Plus, Search, MessageSquare, Clock, CheckCircle, AlertCircle, BookOpen, Phone, Mail } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { SearchInput } from '@/components/ui/input'
import Link from 'next/link'
import { useState } from 'react'

export default function VendorSupportPage() {
  const [searchTerm, setSearchTerm] = useState('')
  const [activeTab, setActiveTab] = useState<'tickets' | 'faq'>('tickets')

  const stats = [
    { label: 'Open Tickets', value: '0', icon: AlertCircle, color: 'text-[#FF6700]', bg: 'bg-[#FF6700]/20' },
    { label: 'In Progress', value: '0', icon: Clock, color: 'text-gray-400', bg: 'bg-gray-500/20' },
    { label: 'Resolved', value: '0', icon: CheckCircle, color: 'text-green-400', bg: 'bg-green-500/20' },
    { label: 'Avg Response', value: '--', icon: MessageSquare, color: 'text-gray-400', bg: 'bg-gray-500/20' },
  ]

  const contactChannels = [
    { icon: Phone, label: 'Phone Support', value: 'Available 9 AM - 6 PM IST', color: 'text-green-400', bg: 'bg-green-500/20' },
    { icon: Mail, label: 'Email Support', value: 'vendor-support@loanz360.com', color: 'text-[#FF6700]', bg: 'bg-[#FF6700]/20' },
    { icon: MessageSquare, label: 'Live Chat', value: 'Available during business hours', color: 'text-gray-400', bg: 'bg-gray-500/20' },
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
              <h1 className="text-xl font-bold text-white font-poppins">Support</h1>
              <p className="text-gray-400 text-sm mt-1">Get help, raise tickets, and find answers</p>
            </div>
          </div>
          <Button className="bg-[#FF6700] hover:bg-[#FF6700]/90 text-black font-medium">
            <Plus className="w-4 h-4 mr-2" /> New Ticket
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

        {/* Tabs */}
        <div className="flex items-center space-x-1 border-b border-neutral-800">
          <button
            onClick={() => setActiveTab('tickets')}
            className={`px-4 py-2 text-xs font-medium border-b-2 transition-colors ${
              activeTab === 'tickets'
                ? 'border-[#FF6700] text-[#FF6700]'
                : 'border-transparent text-gray-400 hover:text-white'
            }`}
          >
            My Tickets
          </button>
          <button
            onClick={() => setActiveTab('faq')}
            className={`px-4 py-2 text-xs font-medium border-b-2 transition-colors ${
              activeTab === 'faq'
                ? 'border-[#FF6700] text-[#FF6700]'
                : 'border-transparent text-gray-400 hover:text-white'
            }`}
          >
            FAQ & Help
          </button>
        </div>

        {activeTab === 'tickets' && (
          <>
            {/* Search */}
            <SearchInput
              placeholder="Search tickets..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="max-w-md"
            />

            {/* Tickets Table */}
            <Card className="bg-brand-ash">
              <CardContent className="p-0">
                {/* Table Header */}
                <div className="grid grid-cols-6 gap-4 px-6 py-3 border-b border-neutral-700 text-gray-400 text-xs font-medium">
                  <span>Ticket ID</span>
                  <span>Subject</span>
                  <span>Category</span>
                  <span>Created</span>
                  <span>Priority</span>
                  <span>Status</span>
                </div>

                {/* Empty State */}
                <div className="flex flex-col items-center justify-center py-16">
                  <div className="w-16 h-16 bg-[#FF6700]/20 rounded-full flex items-center justify-center mb-4">
                    <HeadphonesIcon className="w-8 h-8 text-[#FF6700]" />
                  </div>
                  <h3 className="text-white font-semibold mb-2">No support tickets</h3>
                  <p className="text-gray-400 text-center max-w-sm mb-4">
                    You have not raised any support tickets yet. If you need assistance, create a new ticket and our team will respond promptly.
                  </p>
                  <Button className="bg-[#FF6700] hover:bg-[#FF6700]/90 text-black font-medium">
                    <Plus className="w-4 h-4 mr-2" /> Create Your First Ticket
                  </Button>
                </div>
              </CardContent>
            </Card>
          </>
        )}

        {activeTab === 'faq' && (
          <div className="space-y-4">
            {/* FAQ Items */}
            <Card className="bg-brand-ash">
              <CardHeader>
                <CardTitle className="text-white text-sm">Frequently Asked Questions</CardTitle>
                <CardDescription>Common questions and answers for vendors</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col items-center justify-center py-12">
                  <div className="w-14 h-14 bg-[#FF6700]/20 rounded-full flex items-center justify-center mb-3">
                    <BookOpen className="w-7 h-7 text-[#FF6700]" />
                  </div>
                  <h3 className="text-white font-semibold mb-1">Knowledge base coming soon</h3>
                  <p className="text-gray-400 text-center text-xs max-w-sm">
                    Our FAQ and knowledge base articles are being prepared. In the meantime, please raise a support ticket for any questions.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Contact Channels */}
        <div>
          <h2 className="text-white font-semibold text-sm mb-4">Contact Us</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {contactChannels.map((channel) => (
              <Card key={channel.label} className="bg-brand-ash">
                <CardContent className="p-5">
                  <div className={`w-10 h-10 ${channel.bg} rounded-lg flex items-center justify-center mb-3`}>
                    <channel.icon className={`w-5 h-5 ${channel.color}`} />
                  </div>
                  <h3 className="text-white font-semibold text-sm mb-1">{channel.label}</h3>
                  <p className="text-gray-400 text-xs">{channel.value}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
