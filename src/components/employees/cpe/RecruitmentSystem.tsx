'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/hooks/useToast'
import Toast from '@/components/ui/Toast'
import { formatDate } from '@/lib/utils/timezone'
import {
  Send,
  RefreshCw,
  Clock,
  CheckCircle,
  XCircle,
  Eye,
  FileText,
  MessageCircle,
  AlertCircle,
} from 'lucide-react'

interface InviteData {
  id: string
  recipientName?: string
  mobileNumber: string
  partnerType: string
  status: string
  shortLink: string
  createdAt: string
  clickedAt?: string
  openedAt?: string
  filledAt?: string
  completedAt?: string
  daysSinceCreated: number
  daysUntilExpiry: number
  isExpired: boolean
}

interface FunnelMetrics {
  sent: number
  clicked: number
  opened: number
  filled: number
  completed: number
}

export default function RecruitmentSystem() {
  const { toasts, success, error: showError, warning, removeToast } = useToast()
  const [formData, setFormData] = useState({
    mobile: '',
    partnerType: 'BUSINESS_ASSOCIATE',
    name: '',
    email: '',
  })
  const [loading, setLoading] = useState(false)
  const [invites, setInvites] = useState<InviteData[]>([])
  const [funnelMetrics, setFunnelMetrics] = useState<FunnelMetrics | null>(null)
  const [generatedLink, setGeneratedLink] = useState<string | null>(null)
  const [whatsappUrl, setWhatsappUrl] = useState<string | null>(null)
  const [filterStatus, setFilterStatus] = useState<string | null>(null)
  const [fetchError, setFetchError] = useState<string | null>(null)

  useEffect(() => {
    fetchTrackingData()
  }, [filterStatus])

  const fetchTrackingData = async () => {
    try {
      setFetchError(null)
      const params = new URLSearchParams()
      if (filterStatus) params.append('status', filterStatus)

      const response = await fetch(`/api/cpe/recruitment/tracking?${params}`)
      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to fetch tracking data')
      }

      if (result.success) {
        setInvites(result.data.invites)
        setFunnelMetrics(result.data.funnelMetrics)
      } else {
        throw new Error(result.error || 'Failed to fetch data')
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to load recruitment data'
      console.error('Error fetching tracking data:', errorMessage)
      setFetchError(errorMessage)
      showError(errorMessage)
    }
  }

  const checkDuplicate = async () => {
    if (!formData.mobile) return true

    try {
      const response = await fetch('/api/cpe/recruitment/check-duplicate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mobile: formData.mobile }),
      })

      const result = await response.json()

      if (result.success && result.data.isDuplicate) {
        warning(result.data.reason)
        return false
      }

      return true
    } catch (error) {
      console.error('Error checking duplicate:', error)
      return true
    }
  }

  const handleGenerateLink = async (e: React.FormEvent) => {
    e.preventDefault()

    // Check for duplicates first
    const canProceed = await checkDuplicate()
    if (!canProceed) return

    setLoading(true)
    try {
      const response = await fetch('/api/cpe/recruitment/generate-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to generate link')
      }

      if (result.success) {
        setGeneratedLink(result.data.shortLink)
        setWhatsappUrl(result.data.whatsappUrl)
        success('Recruitment link generated successfully!')

        // Reset form
        setFormData({
          mobile: '',
          partnerType: 'BUSINESS_ASSOCIATE',
          name: '',
          email: '',
        })

        // Refresh tracking data
        fetchTrackingData()
      } else {
        throw new Error(result.error || 'Failed to generate link')
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to generate link'
      console.error('Error generating link:', errorMessage)
      showError(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  const handleSendReminder = async (inviteId: string) => {
    try {
      const response = await fetch('/api/cpe/recruitment/send-reminder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inviteId }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to send reminder')
      }

      if (result.success && result.data.whatsappUrl) {
        window.open(result.data.whatsappUrl, '_blank')
        success('Reminder sent via WhatsApp')
        fetchTrackingData()
      } else {
        throw new Error(result.error || 'Failed to send reminder')
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to send reminder'
      console.error('Error sending reminder:', errorMessage)
      showError(errorMessage)
    }
  }

  const handleShareWhatsApp = () => {
    if (whatsappUrl) {
      window.open(whatsappUrl, '_blank')
      setGeneratedLink(null)
      setWhatsappUrl(null)
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'SENT':
        return <Clock className="w-4 h-4 text-gray-500" />
      case 'CLICKED':
        return <Eye className="w-4 h-4 text-blue-500" />
      case 'OPENED':
        return <FileText className="w-4 h-4 text-yellow-500" />
      case 'FILLED':
        return <CheckCircle className="w-4 h-4 text-orange-500" />
      case 'COMPLETED':
        return <CheckCircle className="w-4 h-4 text-green-500" />
      case 'EXPIRED':
        return <XCircle className="w-4 h-4 text-red-500" />
      default:
        return <Clock className="w-4 h-4" />
    }
  }

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return 'success'
      case 'EXPIRED':
        return 'error'
      case 'FILLED':
        return 'warning'
      default:
        return 'default'
    }
  }

  return (
    <div className="space-y-6 p-4 lg:p-6 bg-black">
      {/* Toast Container */}
      <div className="fixed top-4 right-4 z-50 space-y-2">
        {toasts.map((toast) => (
          <Toast
            key={toast.id}
            message={toast.message}
            type={toast.type}
            onClose={() => removeToast(toast.id)}
          />
        ))}
      </div>

      {/* Sub-header - No duplicate title */}
      <div className="pb-2 border-b border-gray-800">
        <p className="text-gray-400">
          Generate recruitment links and track registration progress
        </p>
      </div>

      {/* Error Banner */}
      {fetchError && (
        <div className="bg-red-950/50 border border-red-500/30 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-red-400" />
              <div>
                <p className="text-red-400 font-medium">Failed to load data</p>
                <p className="text-red-300/70 text-sm">{fetchError}</p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={fetchTrackingData}
              className="border-red-500/50 text-red-400 hover:bg-red-950"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Retry
            </Button>
          </div>
        </div>
      )}

      {/* Funnel Metrics */}
      {funnelMetrics && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Card className="content-card">
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-orange-500">{funnelMetrics.sent}</p>
              <p className="text-sm text-gray-400">Sent</p>
            </CardContent>
          </Card>
          <Card className="content-card">
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-blue-400">{funnelMetrics.clicked}</p>
              <p className="text-sm text-gray-400">Clicked</p>
            </CardContent>
          </Card>
          <Card className="content-card">
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-yellow-400">{funnelMetrics.opened}</p>
              <p className="text-sm text-gray-400">Opened</p>
            </CardContent>
          </Card>
          <Card className="content-card">
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-orange-400">{funnelMetrics.filled}</p>
              <p className="text-sm text-gray-400">Filled</p>
            </CardContent>
          </Card>
          <Card className="content-card">
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-green-400">{funnelMetrics.completed}</p>
              <p className="text-sm text-gray-400">Completed</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Link Generation Form */}
      <Card className="content-card">
        <CardHeader>
          <CardTitle className="text-white">Generate Recruitment Link</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleGenerateLink} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="mobile" className="text-gray-300">Mobile Number *</Label>
                <Input
                  id="mobile"
                  type="tel"
                  placeholder="+91 9876543210"
                  value={formData.mobile}
                  onChange={(e) => setFormData({ ...formData, mobile: e.target.value })}
                  required
                  className="bg-gray-800 border-gray-600 text-white placeholder:text-gray-500"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="partnerType" className="text-gray-300">Partner Type *</Label>
                <select
                  id="partnerType"
                  value={formData.partnerType}
                  onChange={(e) => setFormData({ ...formData, partnerType: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-600 bg-gray-800 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                  required
                >
                  <option value="BUSINESS_ASSOCIATE">Business Associate</option>
                  <option value="BUSINESS_PARTNER">Business Partner</option>
                  <option value="CHANNEL_PARTNER">Channel Partner</option>
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="name" className="text-gray-300">Name (Optional)</Label>
                <Input
                  id="name"
                  type="text"
                  placeholder="Partner Name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="bg-gray-800 border-gray-600 text-white placeholder:text-gray-500"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email" className="text-gray-300">Email (Optional)</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="partner@example.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="bg-gray-800 border-gray-600 text-white placeholder:text-gray-500"
                />
              </div>
            </div>

            <Button type="submit" disabled={loading} className="bg-orange-500 hover:bg-orange-600 text-white">
              <Send className="w-4 h-4 mr-2" />
              {loading ? 'Generating...' : 'Generate Link'}
            </Button>
          </form>

          {/* Generated Link Display */}
          {generatedLink && whatsappUrl && (
            <div className="mt-6 p-4 bg-green-950/30 border border-green-500/30 rounded-lg">
              <p className="text-sm font-medium mb-2 text-green-400">Link Generated Successfully!</p>
              <div className="flex gap-2">
                <Input value={generatedLink} readOnly className="flex-1 bg-gray-800 border-gray-600 text-white" />
                <Button onClick={handleShareWhatsApp} className="bg-green-600 hover:bg-green-700 text-white">
                  <MessageCircle className="w-4 h-4 mr-2" />
                  Share via WhatsApp
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recruitment Tracking Table */}
      <Card className="content-card">
        <CardHeader>
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <CardTitle className="text-white">Recruitment Tracking</CardTitle>
            <div className="flex flex-wrap gap-2">
              {['All', 'SENT', 'CLICKED', 'OPENED', 'FILLED', 'COMPLETED', 'EXPIRED'].map((status) => (
                <Button
                  key={status}
                  variant={filterStatus === (status === 'All' ? null : status) ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setFilterStatus(status === 'All' ? null : status)}
                  className={filterStatus === (status === 'All' ? null : status)
                    ? 'bg-orange-500 hover:bg-orange-600 text-white'
                    : 'border-gray-600 text-gray-300 hover:bg-gray-800'
                  }
                >
                  {status}
                </Button>
              ))}
              <Button variant="outline" size="sm" onClick={fetchTrackingData} className="border-gray-600 text-gray-300 hover:bg-gray-800">
                <RefreshCw className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[600px]">
              <thead>
                <tr className="border-b border-gray-700">
                  <th className="text-left p-3 text-sm font-medium text-gray-300">Mobile</th>
                  <th className="text-left p-3 text-sm font-medium text-gray-300">Partner Type</th>
                  <th className="text-left p-3 text-sm font-medium text-gray-300">Date</th>
                  <th className="text-center p-3 text-sm font-medium text-gray-300">Status</th>
                  <th className="text-center p-3 text-sm font-medium text-gray-300">Actions</th>
                </tr>
              </thead>
              <tbody>
                {invites.map((invite) => (
                  <tr key={invite.id} className="border-b border-gray-800 hover:bg-gray-800/50">
                    <td className="p-3 text-sm">
                      {invite.recipientName && (
                        <div className="font-medium text-white">{invite.recipientName}</div>
                      )}
                      <div className="text-gray-400">{invite.mobileNumber}</div>
                    </td>
                    <td className="p-3 text-sm text-gray-300">
                      {invite.partnerType.replace(/_/g, ' ')}
                    </td>
                    <td className="p-3 text-sm text-gray-300">
                      {formatDate(invite.createdAt, 'MEDIUM_DATE')}
                      <div className="text-xs text-gray-500">
                        {invite.daysSinceCreated === 0 ? 'Today' : invite.daysSinceCreated === 1 ? 'Yesterday' : `${invite.daysSinceCreated} days ago`}
                      </div>
                    </td>
                    <td className="p-3">
                      <div className="flex items-center justify-center gap-2">
                        {getStatusIcon(invite.status)}
                        <Badge variant={getStatusBadgeVariant(invite.status)}>
                          {invite.status}
                        </Badge>
                      </div>
                      {!invite.isExpired && invite.daysUntilExpiry <= 7 && (
                        <div className="text-xs text-yellow-400 text-center mt-1">
                          Expires in {invite.daysUntilExpiry} days
                        </div>
                      )}
                    </td>
                    <td className="p-3">
                      <div className="flex items-center justify-center gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => window.open(invite.shortLink, '_blank')}
                          className="border-gray-600 text-gray-300 hover:bg-gray-800"
                        >
                          View Link
                        </Button>
                        {invite.status !== 'COMPLETED' && !invite.isExpired && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleSendReminder(invite.id)}
                            className="border-gray-600 text-gray-300 hover:bg-gray-800"
                          >
                            <MessageCircle className="w-4 h-4 mr-1" />
                            Remind
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {invites.length === 0 && !fetchError && (
              <div className="text-center py-12 text-gray-500">
                No recruitment invites found
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
