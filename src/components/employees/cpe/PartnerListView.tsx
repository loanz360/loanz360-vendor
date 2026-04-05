'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Search,
  Filter,
  RefreshCw,
  Eye,
  TrendingUp,
  FileText,
  Calendar,
  DollarSign,
  AlertCircle,
} from 'lucide-react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import { formatCurrency } from '@/lib/utils/cn'

interface Partner {
  id: string
  fullName: string
  mobileNumber: string
  partnerType: string
  partnerTypeDisplay: string
  status: string
  registrationDate: string
  totalBusinessSourced: number
  totalApplicationsSourced: number
  lastActiveAt?: string
  daysSinceRegistration: number
}

interface PartnerProfile {
  basicDetails: {
    id: string
    fullName: string
    mobileNumber: string
    email?: string
    partnerType: string
    status: string
    registrationDate: string
    address?: string
    city?: string
    state?: string
    pincode?: string
  }
  businessMetrics: {
    totalBusinessSourced: number
    totalApplicationsSourced: number
    averageBusinessPerApplication: number
  }
  earnings: {
    totalEarned: number
    totalPaid: number
    totalPending: number
  }
  kycStatus: {
    total: number
    verified: number
    pending: number
    rejected: number
  }
}

interface BusinessData {
  monthly: {
    labels: string[]
    datasets: {
      businessVolume: number[]
      applicationsSourced: number[]
      disbursedAmount: number[]
      commissionEarned: number[]
    }
  }
  summary: {
    totalBusinessVolume: number
    totalApplications: number
    totalDisbursed: number
    totalCommission: number
  }
}

export default function PartnerListView() {
  const [partners, setPartners] = useState<Partner[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedPartner, setSelectedPartner] = useState<string | null>(null)
  const [profileData, setProfileData] = useState<PartnerProfile | null>(null)
  const [businessData, setBusinessData] = useState<BusinessData | null>(null)
  const [showProfileModal, setShowProfileModal] = useState(false)
  const [showFilters, setShowFilters] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Filters - separate search input from debounced search value
  const [searchInput, setSearchInput] = useState('')
  const [filters, setFilters] = useState({
    partnerType: '',
    status: '',
    registrationMonth: '',
    businessMin: '',
    businessMax: '',
    search: '',
  })

  // Pagination
  const [pagination, setPagination] = useState({
    currentPage: 1,
    totalPages: 1,
    limit: 20,
  })

  // Debounce timer ref
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null)

  // Debounce search input - only update filters.search after 300ms of no typing
  useEffect(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
    }

    debounceTimerRef.current = setTimeout(() => {
      if (searchInput !== filters.search) {
        setFilters(prev => ({ ...prev, search: searchInput }))
        setPagination(prev => ({ ...prev, currentPage: 1 }))
      }
    }, 300)

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
      }
    }
  }, [searchInput, filters.search])

  // Fetch partners when filters (except search input) or pagination changes
  useEffect(() => {
    fetchPartners()
  }, [filters, pagination.currentPage])

  const fetchPartners = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const params = new URLSearchParams()

      if (filters.partnerType) params.append('partnerType', filters.partnerType)
      if (filters.status) params.append('status', filters.status)
      if (filters.registrationMonth) params.append('registrationMonth', filters.registrationMonth)
      if (filters.businessMin) params.append('businessMin', filters.businessMin)
      if (filters.businessMax) params.append('businessMax', filters.businessMax)
      if (filters.search) params.append('search', filters.search)

      params.append('limit', pagination.limit.toString())
      params.append('offset', ((pagination.currentPage - 1) * pagination.limit).toString())

      const response = await fetch(`/api/cpe/partners/list?${params}`)
      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to fetch partners')
      }

      if (result.success) {
        setPartners(result.data?.partners || [])
        setPagination(prev => ({
          ...prev,
          totalPages: result.data?.pagination?.totalPages || 1,
        }))
      } else {
        throw new Error(result.error || 'Failed to load partners')
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch partners'
      console.error('Error fetching partners:', errorMessage)
      setError(errorMessage)
      setPartners([])
    } finally {
      setLoading(false)
    }
  }, [filters, pagination.currentPage, pagination.limit])

  const fetchPartnerProfile = async (partnerId: string) => {
    try {
      const [profileRes, businessRes] = await Promise.all([
        fetch(`/api/cpe/partners/${partnerId}/profile`),
        fetch(`/api/cpe/partners/${partnerId}/business-data?months=6`),
      ])

      const profileResult = await profileRes.json()
      const businessResult = await businessRes.json()

      if (profileResult.success) setProfileData(profileResult.data)
      if (businessResult.success) setBusinessData(businessResult.data)
    } catch (error) {
      console.error('Error fetching partner profile:', error)
    }
  }

  const handleViewProfile = async (partnerId: string) => {
    setSelectedPartner(partnerId)
    setShowProfileModal(true)
    await fetchPartnerProfile(partnerId)
  }

  const handleCloseModal = () => {
    setShowProfileModal(false)
    setSelectedPartner(null)
    setProfileData(null)
    setBusinessData(null)
  }

  const businessChartData = businessData?.monthly.labels.map((label, index) => ({
    month: label,
    'Business Volume': businessData.monthly.datasets.businessVolume[index] / 100000,
    'Applications': businessData.monthly.datasets.applicationsSourced[index],
    'Disbursed': businessData.monthly.datasets.disbursedAmount[index] / 100000,
  }))

  return (
    <div className="space-y-6 p-4 lg:p-6 bg-black">
      {/* Sub-header with controls - No duplicate title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-gray-800">
        <p className="text-gray-400">
          Manage and monitor your recruited partners
        </p>
        <div className="flex gap-3">
          <Button variant="outline" onClick={() => setShowFilters(!showFilters)} className="border-gray-600 text-gray-300 hover:bg-gray-800">
            <Filter className="w-4 h-4 mr-2" />
            Filters
          </Button>
          <Button variant="outline" onClick={fetchPartners} disabled={loading} className="border-gray-600 text-gray-300 hover:bg-gray-800">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="bg-red-950/50 border border-red-500/30 rounded-lg p-4 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
          <p className="text-red-300 flex-1">{error}</p>
          <Button
            variant="outline"
            size="sm"
            onClick={fetchPartners}
            className="border-red-500/50 text-red-400 hover:bg-red-950"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Retry
          </Button>
        </div>
      )}

      {/* Filters */}
      {showFilters && (
        <Card className="content-card">
          <CardContent className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label className="text-gray-300">Partner Type</Label>
                <select
                  value={filters.partnerType}
                  onChange={(e) => setFilters({ ...filters, partnerType: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                >
                  <option value="">All Types</option>
                  <option value="BUSINESS_ASSOCIATE">Business Associate</option>
                  <option value="BUSINESS_PARTNER">Business Partner</option>
                  <option value="CHANNEL_PARTNER">Channel Partner</option>
                </select>
              </div>

              <div className="space-y-2">
                <Label className="text-gray-300">Status</Label>
                <select
                  value={filters.status}
                  onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                >
                  <option value="">All Status</option>
                  <option value="ACTIVE">Active</option>
                  <option value="INACTIVE">Inactive</option>
                  <option value="SUSPENDED">Suspended</option>
                  <option value="PENDING">Pending</option>
                </select>
              </div>

              <div className="space-y-2">
                <Label className="text-gray-300">Registration Month</Label>
                <Input
                  type="month"
                  value={filters.registrationMonth}
                  onChange={(e) => setFilters({ ...filters, registrationMonth: e.target.value })}
                  className="bg-gray-800 border-gray-600 text-white"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-gray-300">Business Volume (Min)</Label>
                <Input
                  type="number"
                  placeholder="Minimum"
                  value={filters.businessMin}
                  onChange={(e) => setFilters({ ...filters, businessMin: e.target.value })}
                  className="bg-gray-800 border-gray-600 text-white placeholder:text-gray-500"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-gray-300">Business Volume (Max)</Label>
                <Input
                  type="number"
                  placeholder="Maximum"
                  value={filters.businessMax}
                  onChange={(e) => setFilters({ ...filters, businessMax: e.target.value })}
                  className="bg-gray-800 border-gray-600 text-white placeholder:text-gray-500"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-gray-300">Search</Label>
                <Input
                  type="text"
                  placeholder="Name or Mobile"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  className="bg-gray-800 border-gray-600 text-white placeholder:text-gray-500"
                />
              </div>
            </div>

            <div className="flex gap-2 mt-4">
              <Button onClick={fetchPartners} className="bg-orange-500 hover:bg-orange-600 text-white">
                <Search className="w-4 h-4 mr-2" />
                Apply Filters
              </Button>
              <Button
                variant="outline"
                className="border-gray-600 text-gray-300 hover:bg-gray-800"
                onClick={() => {
                  setSearchInput('')
                  setFilters({
                    partnerType: '',
                    status: '',
                    registrationMonth: '',
                    businessMin: '',
                    businessMax: '',
                    search: '',
                  })
                  setPagination(prev => ({ ...prev, currentPage: 1 }))
                }}
              >
                Clear
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Partner Table */}
      <Card className="content-card">
        <CardContent className="p-0">
          <div className="overflow-x-auto scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-gray-900">
            <table className="w-full min-w-[800px]">
              <thead className="bg-gray-800">
                <tr>
                  <th className="text-left p-4 text-sm font-medium text-gray-300 whitespace-nowrap">Name</th>
                  <th className="text-left p-4 text-sm font-medium text-gray-300 whitespace-nowrap">Mobile</th>
                  <th className="text-left p-4 text-sm font-medium text-gray-300 whitespace-nowrap hidden md:table-cell">Category</th>
                  <th className="text-left p-4 text-sm font-medium text-gray-300 whitespace-nowrap hidden lg:table-cell">Date</th>
                  <th className="text-center p-4 text-sm font-medium text-gray-300 whitespace-nowrap">Status</th>
                  <th className="text-right p-4 text-sm font-medium text-gray-300 whitespace-nowrap">Business</th>
                  <th className="text-center p-4 text-sm font-medium text-gray-300 whitespace-nowrap hidden xl:table-cell">Applications</th>
                  <th className="text-center p-4 text-sm font-medium text-gray-300 whitespace-nowrap">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={8} className="text-center py-12">
                      <div className="flex items-center justify-center">
                        <RefreshCw className="w-6 h-6 animate-spin text-orange-500" />
                      </div>
                    </td>
                  </tr>
                ) : partners.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center py-12 text-gray-400">
                      No partners found
                    </td>
                  </tr>
                ) : (
                  partners.map((partner) => (
                    <tr key={partner.id} className="border-b border-gray-700 hover:bg-gray-800/50">
                      <td className="p-4 text-sm font-medium text-white whitespace-nowrap">
                        <div className="max-w-[150px] truncate" title={partner.fullName}>
                          {partner.fullName}
                        </div>
                      </td>
                      <td className="p-4 text-sm text-gray-400 whitespace-nowrap">
                        {partner.mobileNumber}
                      </td>
                      <td className="p-4 text-sm hidden md:table-cell">
                        <Badge variant="outline" className="border-gray-600 text-gray-300 whitespace-nowrap">{partner.partnerTypeDisplay}</Badge>
                      </td>
                      <td className="p-4 text-sm text-gray-300 hidden lg:table-cell whitespace-nowrap">
                        {partner.registrationDate}
                        <div className="text-xs text-gray-500">
                          {partner.daysSinceRegistration} days ago
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="flex justify-center">
                          <Badge
                            variant={
                              partner.status === 'ACTIVE'
                                ? 'success'
                                : partner.status === 'SUSPENDED'
                                ? 'error'
                                : 'default'
                            }
                          >
                            {partner.status}
                          </Badge>
                        </div>
                      </td>
                      <td className="p-4 text-sm text-right font-medium text-white whitespace-nowrap">
                        {formatCurrency(partner.totalBusinessSourced)}
                      </td>
                      <td className="p-4 text-sm text-center text-white hidden xl:table-cell">
                        {partner.totalApplicationsSourced}
                      </td>
                      <td className="p-4">
                        <div className="flex justify-center">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleViewProfile(partner.id)}
                            className="border-orange-500/50 text-orange-400 hover:bg-orange-500/20"
                          >
                            <Eye className="w-4 h-4 md:mr-1" />
                            <span className="hidden md:inline">View</span>
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {!loading && partners.length > 0 && (
            <div className="flex items-center justify-between p-4 border-t border-gray-700">
              <div className="text-sm text-gray-400">
                Page {pagination.currentPage} of {pagination.totalPages}
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pagination.currentPage === 1}
                  onClick={() =>
                    setPagination(prev => ({ ...prev, currentPage: prev.currentPage - 1 }))
                  }
                  className="border-gray-600 text-gray-300 hover:bg-gray-800 disabled:opacity-50"
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pagination.currentPage === pagination.totalPages}
                  onClick={() =>
                    setPagination(prev => ({ ...prev, currentPage: prev.currentPage + 1 }))
                  }
                  className="border-gray-600 text-gray-300 hover:bg-gray-800 disabled:opacity-50"
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Profile Modal */}
      <Dialog open={showProfileModal} onOpenChange={handleCloseModal}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-gray-900 border-gray-700 text-white">
          <DialogHeader>
            <DialogTitle className="text-white">Partner Profile</DialogTitle>
          </DialogHeader>

          {profileData && (
            <div className="space-y-6">
              {/* Basic Details */}
              <Card className="bg-gray-800 border-gray-700">
                <CardHeader>
                  <CardTitle className="text-lg text-white">Basic Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-gray-400">Name</Label>
                      <p className="font-medium text-white">{profileData.basicDetails.fullName}</p>
                    </div>
                    <div>
                      <Label className="text-gray-400">Mobile</Label>
                      <p className="font-medium text-white">{profileData.basicDetails.mobileNumber}</p>
                    </div>
                    <div>
                      <Label className="text-gray-400">Email</Label>
                      <p className="font-medium text-white">{profileData.basicDetails.email || 'N/A'}</p>
                    </div>
                    <div>
                      <Label className="text-gray-400">Partner Type</Label>
                      <p className="font-medium text-white">{profileData.basicDetails.partnerType}</p>
                    </div>
                    <div>
                      <Label className="text-gray-400">Status</Label>
                      <Badge variant="success">{profileData.basicDetails.status}</Badge>
                    </div>
                    <div>
                      <Label className="text-gray-400">Registration Date</Label>
                      <p className="font-medium text-white">{profileData.basicDetails.registrationDate}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Business Metrics */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="bg-gray-800 border-gray-700">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <DollarSign className="w-8 h-8 text-green-400" />
                      <div>
                        <p className="text-sm text-gray-400">Total Business</p>
                        <p className="text-xl font-bold text-white">
                          {formatCurrency(profileData.businessMetrics.totalBusinessSourced)}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card className="bg-gray-800 border-gray-700">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <FileText className="w-8 h-8 text-blue-400" />
                      <div>
                        <p className="text-sm text-gray-400">Applications</p>
                        <p className="text-xl font-bold text-white">
                          {profileData.businessMetrics.totalApplicationsSourced}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card className="bg-gray-800 border-gray-700">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <TrendingUp className="w-8 h-8 text-orange-400" />
                      <div>
                        <p className="text-sm text-gray-400">Avg per App</p>
                        <p className="text-xl font-bold text-white">
                          {formatCurrency(profileData.businessMetrics.averageBusinessPerApplication)}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Earnings */}
              <Card className="bg-gray-800 border-gray-700">
                <CardHeader>
                  <CardTitle className="text-lg text-white">Earnings Summary</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <Label className="text-gray-400">Total Earned</Label>
                      <p className="text-lg font-bold text-green-400">
                        {formatCurrency(profileData.earnings.totalEarned)}
                      </p>
                    </div>
                    <div>
                      <Label className="text-gray-400">Paid</Label>
                      <p className="text-lg font-bold text-white">
                        {formatCurrency(profileData.earnings.totalPaid)}
                      </p>
                    </div>
                    <div>
                      <Label className="text-gray-400">Pending</Label>
                      <p className="text-lg font-bold text-orange-400">
                        {formatCurrency(profileData.earnings.totalPending)}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Business Trends Chart */}
              {businessData && businessChartData && (
                <Card className="bg-gray-800 border-gray-700">
                  <CardHeader>
                    <CardTitle className="text-lg text-white">Business Performance (Last 6 Months)</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={250}>
                      <LineChart data={businessChartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                        <XAxis dataKey="month" stroke="#9CA3AF" />
                        <YAxis yAxisId="left" stroke="#9CA3AF" />
                        <YAxis yAxisId="right" orientation="right" stroke="#9CA3AF" />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: '#1F2937',
                            border: '1px solid #374151',
                            borderRadius: '8px',
                          }}
                          labelStyle={{ color: '#F9FAFB' }}
                        />
                        <Legend />
                        <Line
                          yAxisId="left"
                          type="monotone"
                          dataKey="Business Volume"
                          stroke="#3b82f6"
                          strokeWidth={2}
                        />
                        <Line
                          yAxisId="right"
                          type="monotone"
                          dataKey="Applications"
                          stroke="#10b981"
                          strokeWidth={2}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              )}

              {/* KYC Status */}
              <Card className="bg-gray-800 border-gray-700">
                <CardHeader>
                  <CardTitle className="text-lg text-white">KYC Status</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-4 gap-4">
                    <div>
                      <p className="text-2xl font-bold text-white">{profileData.kycStatus.total}</p>
                      <p className="text-sm text-gray-400">Total Documents</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-green-400">
                        {profileData.kycStatus.verified}
                      </p>
                      <p className="text-sm text-gray-400">Verified</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-orange-400">
                        {profileData.kycStatus.pending}
                      </p>
                      <p className="text-sm text-gray-400">Pending</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-red-400">
                        {profileData.kycStatus.rejected}
                      </p>
                      <p className="text-sm text-gray-400">Rejected</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Loading Skeleton for Modal */}
          {!profileData && (
            <div className="space-y-6">
              {/* Basic Info Skeleton */}
              <Card className="bg-gray-800 border-gray-700">
                <CardHeader>
                  <div className="h-6 w-40 bg-gray-700 rounded animate-pulse" />
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4">
                    {[...Array(6)].map((_, i) => (
                      <div key={i} className="space-y-2">
                        <div className="h-4 w-20 bg-gray-700 rounded animate-pulse" />
                        <div className="h-5 w-32 bg-gray-600 rounded animate-pulse" />
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Metrics Skeleton */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[...Array(3)].map((_, i) => (
                  <Card key={i} className="bg-gray-800 border-gray-700">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-gray-700 rounded animate-pulse" />
                        <div className="space-y-2">
                          <div className="h-4 w-24 bg-gray-700 rounded animate-pulse" />
                          <div className="h-6 w-28 bg-gray-600 rounded animate-pulse" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* Chart Skeleton */}
              <Card className="bg-gray-800 border-gray-700">
                <CardHeader>
                  <div className="h-6 w-56 bg-gray-700 rounded animate-pulse" />
                </CardHeader>
                <CardContent>
                  <div className="h-[250px] bg-gray-700/50 rounded animate-pulse" />
                </CardContent>
              </Card>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
