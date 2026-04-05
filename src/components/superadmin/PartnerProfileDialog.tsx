'use client'

import React, { useState, useEffect } from 'react'
import { X, User, Mail, Phone, MapPin, Calendar, TrendingUp, DollarSign, FileText, LogIn, AlertCircle } from 'lucide-react'

interface Partner {
  id: string
  partner_id: string
  full_name: string
  email: string
  mobile_number: string
  partner_type: string
  status: string
  city: string
  state: string
  [key: string]: any
}

interface PartnerProfileDialogProps {
  isOpen: boolean
  onClose: () => void
  partner: Partner
}

interface ProfileData {
  basic_details: {
    id: string
    partner_id: string
    full_name: string
    mobile_number: string
    work_email: string
    personal_email: string
    partner_type: string
    status: string
    present_address: string
    city: string
    state: string
    pincode: string
    address_proof_url: string | null
    address_proof_type: string | null
    joining_date: string
    registration_source: string
  }
  performance_insights: {
    total_logins: number
    last_login_at: string | null
    total_leads: number
    leads_in_progress: number
    leads_sanctioned: number
    leads_dropped: number
    conversion_rate: string
  }
  commission_details: {
    lifetime_earnings: string
    estimated_payout: string
    actual_payout: string
    disbursements: Array<{
      id: string
      disbursement_number: string
      amount: string
      disbursement_date: string
      month: number
      year: number
      payment_status: string
      payment_method: string
      payment_reference: string
    }>
  }
  month_wise_performance: Array<{
    month: string
    total_leads: number
    in_progress: number
    sanctioned: number
    dropped: number
    logins: number
  }>
  recent_activity: {
    recent_logins: Array<{
      login_timestamp: string
      logout_timestamp: string | null
      session_duration_minutes: number | null
      ip_address: string
    }>
    recent_leads: Array<{
      id: string
      lead_number: string
      customer_name: string
      loan_type: string
      loan_amount: string
      status: string
      created_at: string
    }>
  }
}

export default function PartnerProfileDialog({ isOpen, onClose, partner }: PartnerProfileDialogProps) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [profileData, setProfileData] = useState<ProfileData | null>(null)
  const [selectedMonth, setSelectedMonth] = useState('')

  useEffect(() => {
    if (isOpen && partner) {
      fetchProfileData()
    }
  }, [isOpen, partner])

  const fetchProfileData = async () => {
    try {
      setLoading(true)
      setError(null)

      const response = await fetch(`/api/superadmin/partner-management/partners/${partner.id}`, {
        credentials: 'include'
      })

      if (!response.ok) {
        throw new Error('Failed to fetch partner profile')
      }

      const result = await response.json()
      setProfileData(result.data)
    } catch (err: unknown) {
      setError((err instanceof Error ? err.message : String(err)) || 'Failed to load partner profile')
      console.error('Profile fetch error:', err)
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ACTIVE': return 'bg-green-500/10 text-green-400 border-green-500/20'
      case 'INACTIVE': return 'bg-gray-500/10 text-gray-400 border-gray-500/20'
      case 'PENDING_APPROVAL': return 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20'
      case 'SUSPENDED': return 'bg-red-500/10 text-red-400 border-red-500/20'
      default: return 'bg-gray-500/10 text-gray-400 border-gray-500/20'
    }
  }

  const filteredPerformance = selectedMonth && profileData
    ? profileData.month_wise_performance.filter(p => p.month.startsWith(selectedMonth))
    : profileData?.month_wise_performance || []

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-gradient-to-br from-gray-900 to-black border border-white/10 rounded-lg max-w-6xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="p-6 border-b border-white/10 flex items-center justify-between sticky top-0 bg-gray-900/95 backdrop-blur-sm z-10">
          <div>
            <h2 className="text-2xl font-bold font-poppins">Partner Profile</h2>
            <p className="text-gray-400 text-sm mt-1">Detailed information and performance metrics</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-orange-500"></div>
          </div>
        )}

        {/* Error State */}
        {error && !loading && (
          <div className="p-6">
            <div className="bg-red-500/10 border border-red-500/50 rounded-lg p-4 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-red-400 font-semibold">Error loading profile</p>
                <p className="text-red-300 text-sm">{error}</p>
                <button
                  onClick={fetchProfileData}
                  className="mt-2 text-sm text-red-300 hover:text-red-200 underline"
                >
                  Try again
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Content */}
        {!loading && !error && profileData && (
          <div className="p-6 space-y-6">
            {/* Section 1: Basic Details */}
            <div className="bg-white/5 backdrop-blur-lg rounded-lg p-6 border border-white/10">
              <h3 className="text-xl font-semibold mb-4 flex items-center gap-2 font-poppins">
                <User className="w-5 h-5 text-orange-400" />
                Basic Details
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Left Column */}
                <div className="space-y-4">
                  {/* Profile Photo Placeholder */}
                  <div className="flex items-center gap-4 mb-4">
                    <div className="w-24 h-24 bg-gradient-to-br from-orange-500 to-orange-600 rounded-full flex items-center justify-center">
                      <User className="w-12 h-12 text-white" />
                    </div>
                    <div>
                      <h4 className="text-2xl font-bold font-poppins">{profileData.basic_details.full_name}</h4>
                      <p className="text-orange-400 font-semibold text-lg">{profileData.basic_details.partner_id}</p>
                      <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium border mt-2 ${getStatusColor(profileData.basic_details.status)}`}>
                        {profileData.basic_details.status}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 text-gray-300">
                    <Mail className="w-5 h-5 text-gray-400" />
                    <div>
                      <p className="text-xs text-gray-500">Work Email</p>
                      <p>{profileData.basic_details.work_email}</p>
                    </div>
                  </div>

                  {profileData.basic_details.personal_email && (
                    <div className="flex items-center gap-3 text-gray-300">
                      <Mail className="w-5 h-5 text-gray-400" />
                      <div>
                        <p className="text-xs text-gray-500">Personal Email</p>
                        <p>{profileData.basic_details.personal_email}</p>
                      </div>
                    </div>
                  )}

                  <div className="flex items-center gap-3 text-gray-300">
                    <Phone className="w-5 h-5 text-gray-400" />
                    <div>
                      <p className="text-xs text-gray-500">Mobile Number</p>
                      <p>{profileData.basic_details.mobile_number}</p>
                    </div>
                  </div>
                </div>

                {/* Right Column */}
                <div className="space-y-4">
                  <div className="flex items-start gap-3 text-gray-300">
                    <MapPin className="w-5 h-5 text-gray-400 mt-1" />
                    <div>
                      <p className="text-xs text-gray-500">Present Address</p>
                      <p>{profileData.basic_details.present_address}</p>
                      {profileData.basic_details.city && profileData.basic_details.state && (
                        <p className="text-sm text-gray-400 mt-1">
                          {profileData.basic_details.city}, {profileData.basic_details.state}
                          {profileData.basic_details.pincode && ` - ${profileData.basic_details.pincode}`}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-3 text-gray-300">
                    <Calendar className="w-5 h-5 text-gray-400" />
                    <div>
                      <p className="text-xs text-gray-500">Joining Date</p>
                      <p>{new Date(profileData.basic_details.joining_date).toLocaleDateString()}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 text-gray-300">
                    <FileText className="w-5 h-5 text-gray-400" />
                    <div>
                      <p className="text-xs text-gray-500">Partner Type</p>
                      <p>{profileData.basic_details.partner_type.replace(/_/g, ' ')}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 text-gray-300">
                    <TrendingUp className="w-5 h-5 text-gray-400" />
                    <div>
                      <p className="text-xs text-gray-500">Registration Source</p>
                      <p className="capitalize">{profileData.basic_details.registration_source.replace(/_/g, ' ')}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Section 2: Performance Insights */}
            <div className="bg-white/5 backdrop-blur-lg rounded-lg p-6 border border-white/10">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-semibold flex items-center gap-2 font-poppins">
                  <TrendingUp className="w-5 h-5 text-orange-400" />
                  Performance Insights
                </h3>
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="bg-black/50 border border-white/20 rounded-lg px-4 py-2 text-white text-sm focus:ring-2 focus:ring-orange-500 focus:outline-none"
                >
                  <option value="">All Time</option>
                  <option value="2025-01">January 2025</option>
                  <option value="2024-12">December 2024</option>
                  <option value="2024-11">November 2024</option>
                </select>
              </div>

              {/* Metrics Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div className="bg-black/30 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <LogIn className="w-4 h-4 text-blue-400" />
                    <p className="text-gray-400 text-xs">Total Logins</p>
                  </div>
                  <p className="text-white text-2xl font-bold">{profileData.performance_insights.total_logins}</p>
                  {profileData.performance_insights.last_login_at && (
                    <p className="text-gray-500 text-xs mt-1">
                      Last: {new Date(profileData.performance_insights.last_login_at).toLocaleDateString()}
                    </p>
                  )}
                </div>

                <div className="bg-black/30 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <FileText className="w-4 h-4 text-purple-400" />
                    <p className="text-gray-400 text-xs">Total Leads</p>
                  </div>
                  <p className="text-white text-2xl font-bold">{profileData.performance_insights.total_leads}</p>
                </div>

                <div className="bg-black/30 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <TrendingUp className="w-4 h-4 text-green-400" />
                    <p className="text-gray-400 text-xs">Sanctioned</p>
                  </div>
                  <p className="text-white text-2xl font-bold">{profileData.performance_insights.leads_sanctioned}</p>
                </div>

                <div className="bg-black/30 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <FileText className="w-4 h-4 text-orange-400" />
                    <p className="text-gray-400 text-xs">Conversion Rate</p>
                  </div>
                  <p className="text-white text-2xl font-bold">{profileData.performance_insights.conversion_rate}%</p>
                </div>
              </div>

              {/* Case Status Breakdown */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
                  <p className="text-blue-400 text-sm mb-1">In Progress</p>
                  <p className="text-white text-3xl font-bold">{profileData.performance_insights.leads_in_progress}</p>
                </div>

                <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-4">
                  <p className="text-green-400 text-sm mb-1">Sanctioned</p>
                  <p className="text-white text-3xl font-bold">{profileData.performance_insights.leads_sanctioned}</p>
                </div>

                <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4">
                  <p className="text-red-400 text-sm mb-1">Dropped</p>
                  <p className="text-white text-3xl font-bold">{profileData.performance_insights.leads_dropped}</p>
                </div>
              </div>

              {/* Month-wise Performance Table */}
              {filteredPerformance.length > 0 && (
                <div className="mt-6">
                  <h4 className="text-lg font-semibold mb-3 font-poppins">Month-wise Breakdown</h4>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-white/5 border-b border-white/10">
                        <tr>
                          <th className="px-4 py-3 text-left text-sm font-semibold text-gray-300">Month</th>
                          <th className="px-4 py-3 text-left text-sm font-semibold text-gray-300">Logins</th>
                          <th className="px-4 py-3 text-left text-sm font-semibold text-gray-300">Total Leads</th>
                          <th className="px-4 py-3 text-left text-sm font-semibold text-gray-300">In Progress</th>
                          <th className="px-4 py-3 text-left text-sm font-semibold text-gray-300">Sanctioned</th>
                          <th className="px-4 py-3 text-left text-sm font-semibold text-gray-300">Dropped</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {filteredPerformance.map((perf, idx) => (
                          <tr key={idx} className="hover:bg-white/5">
                            <td className="px-4 py-3 text-white">{new Date(perf.month).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</td>
                            <td className="px-4 py-3 text-gray-300">{perf.logins}</td>
                            <td className="px-4 py-3 text-gray-300">{perf.total_leads}</td>
                            <td className="px-4 py-3 text-blue-400">{perf.in_progress}</td>
                            <td className="px-4 py-3 text-green-400">{perf.sanctioned}</td>
                            <td className="px-4 py-3 text-red-400">{perf.dropped}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            {/* Section 3: Commission Details */}
            <div className="bg-gradient-to-br from-yellow-900/20 to-yellow-950/20 backdrop-blur-lg rounded-lg p-6 border border-yellow-500/20">
              <h3 className="text-xl font-semibold mb-4 flex items-center gap-2 font-poppins">
                <DollarSign className="w-5 h-5 text-yellow-400" />
                Commission Details
              </h3>

              {/* Lifetime Earnings */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div className="bg-black/30 rounded-lg p-4">
                  <p className="text-yellow-400 text-sm mb-1">Lifetime Earnings</p>
                  <p className="text-white text-3xl font-bold">
                    ₹{parseFloat(profileData.commission_details.lifetime_earnings).toLocaleString('en-IN')}
                  </p>
                </div>

                <div className="bg-black/30 rounded-lg p-4">
                  <p className="text-yellow-400 text-sm mb-1">Estimated Payout</p>
                  <p className="text-white text-3xl font-bold">
                    ₹{parseFloat(profileData.commission_details.estimated_payout).toLocaleString('en-IN')}
                  </p>
                </div>

                <div className="bg-black/30 rounded-lg p-4">
                  <p className="text-green-400 text-sm mb-1">Actual Payout</p>
                  <p className="text-white text-3xl font-bold">
                    ₹{parseFloat(profileData.commission_details.actual_payout).toLocaleString('en-IN')}
                  </p>
                </div>
              </div>

              {/* Disbursements Table */}
              {profileData.commission_details.disbursements.length > 0 ? (
                <div>
                  <h4 className="text-lg font-semibold mb-3 font-poppins">Recent Disbursements</h4>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-white/5 border-b border-white/10">
                        <tr>
                          <th className="px-4 py-3 text-left text-sm font-semibold text-gray-300">Disbursement #</th>
                          <th className="px-4 py-3 text-left text-sm font-semibold text-gray-300">Date</th>
                          <th className="px-4 py-3 text-left text-sm font-semibold text-gray-300">Month/Year</th>
                          <th className="px-4 py-3 text-left text-sm font-semibold text-gray-300">Amount</th>
                          <th className="px-4 py-3 text-left text-sm font-semibold text-gray-300">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {profileData.commission_details.disbursements.slice(0, 5).map((disb) => (
                          <tr key={disb.id} className="hover:bg-white/5">
                            <td className="px-4 py-3 text-orange-400 font-medium">{disb.disbursement_number}</td>
                            <td className="px-4 py-3 text-gray-300">{new Date(disb.disbursement_date).toLocaleDateString()}</td>
                            <td className="px-4 py-3 text-gray-300">{disb.month}/{disb.year}</td>
                            <td className="px-4 py-3 text-green-400 font-semibold">₹{parseFloat(disb.amount).toLocaleString('en-IN')}</td>
                            <td className="px-4 py-3">
                              <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                disb.payment_status === 'processed' ? 'bg-green-500/10 text-green-400' : 'bg-yellow-500/10 text-yellow-400'
                              }`}>
                                {disb.payment_status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <DollarSign className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                  <p className="text-gray-400">No commission disbursements yet</p>
                  <p className="text-gray-500 text-sm mt-2">Full commission module integration coming soon</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
