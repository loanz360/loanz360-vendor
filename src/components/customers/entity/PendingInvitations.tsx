'use client'

import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Mail,
  Phone,
  Clock,
  XCircle,
  CheckCircle,
  AlertTriangle,
  Loader2,
  Copy,
  Trash2,
  RefreshCw,
  User,
  Briefcase,
  Send
} from 'lucide-react'
import { toast } from 'sonner'

interface Invitation {
  id: string
  invite_code: string
  email: string | null
  mobile: string | null
  full_name: string
  role_key: string
  role_name: string
  can_sign_documents: boolean
  can_apply_for_loans: boolean
  can_manage_entity: boolean
  shareholding_percentage: number | null
  status: string
  created_at: string
  expires_at: string
  accepted_at: string | null
  personal_message: string | null
  email_sent_at: string | null
  sms_sent_at: string | null
}

interface PendingInvitationsProps {
  entityId: string
  onInviteClick?: () => void
}

export default function PendingInvitations({ entityId, onInviteClick }: PendingInvitationsProps) {
  const [invitations, setInvitations] = useState<Invitation[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [cancellingId, setCancellingId] = useState<string | null>(null)
  const [filter, setFilter] = useState<'all' | 'PENDING' | 'ACCEPTED' | 'EXPIRED'>('all')

  useEffect(() => {
    fetchInvitations()
  }, [entityId])

  const fetchInvitations = async (showRefreshing = false) => {
    try {
      if (showRefreshing) setRefreshing(true)
      else setLoading(true)

      const response = await fetch(`/api/customers/entity/invitations?entityId=${entityId}`, {
        credentials: 'include'
      })
      const data = await response.json()

      if (data.success) {
        setInvitations(data.invitations || [])
      }
    } catch (err) {
      console.error('Error fetching invitations:', err)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  const handleCancelInvitation = async (invitationId: string) => {
    try {
      setCancellingId(invitationId)

      const response = await fetch(
        `/api/customers/entity/invitations?id=${invitationId}&entityId=${entityId}`,
        {
          method: 'DELETE',
          credentials: 'include'
        }
      )

      const data = await response.json()

      if (!response.ok || !data.success) {
        toast.error(data.error || 'Failed to cancel invitation')
        return
      }

      toast.success('Invitation cancelled')
      setInvitations(prev =>
        prev.map(inv =>
          inv.id === invitationId ? { ...inv, status: 'CANCELLED' } : inv
        )
      )
    } catch (err) {
      console.error('Error cancelling invitation:', err)
      toast.error('Failed to cancel invitation')
    } finally {
      setCancellingId(null)
    }
  }

  const copyInviteLink = async (inviteCode: string) => {
    const baseUrl = typeof window !== 'undefined' ? window.location.origin : ''
    const link = `${baseUrl}/customers/invitation/${inviteCode}`
    try {
      await navigator.clipboard.writeText(link)
      toast.success('Invitation link copied!')
    } catch {
      toast.error('Failed to copy link')
    }
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    })
  }

  const getDaysUntilExpiry = (expiresAt: string) => {
    const now = new Date()
    const expiry = new Date(expiresAt)
    const diff = expiry.getTime() - now.getTime()
    return Math.ceil(diff / (1000 * 60 * 60 * 24))
  }

  const getStatusBadge = (status: string, expiresAt: string) => {
    const days = getDaysUntilExpiry(expiresAt)

    switch (status) {
      case 'PENDING':
        if (days <= 0) {
          return (
            <span className="flex items-center gap-1 px-2 py-1 bg-red-500/10 text-red-400 rounded text-xs">
              <AlertTriangle className="w-3 h-3" />
              Expired
            </span>
          )
        }
        return (
          <span className="flex items-center gap-1 px-2 py-1 bg-yellow-500/10 text-yellow-400 rounded text-xs">
            <Clock className="w-3 h-3" />
            Pending ({days}d left)
          </span>
        )
      case 'ACCEPTED':
        return (
          <span className="flex items-center gap-1 px-2 py-1 bg-green-500/10 text-green-400 rounded text-xs">
            <CheckCircle className="w-3 h-3" />
            Accepted
          </span>
        )
      case 'REJECTED':
        return (
          <span className="flex items-center gap-1 px-2 py-1 bg-red-500/10 text-red-400 rounded text-xs">
            <XCircle className="w-3 h-3" />
            Rejected
          </span>
        )
      case 'EXPIRED':
        return (
          <span className="flex items-center gap-1 px-2 py-1 bg-gray-500/10 text-gray-400 rounded text-xs">
            <AlertTriangle className="w-3 h-3" />
            Expired
          </span>
        )
      case 'CANCELLED':
        return (
          <span className="flex items-center gap-1 px-2 py-1 bg-gray-500/10 text-gray-400 rounded text-xs">
            <XCircle className="w-3 h-3" />
            Cancelled
          </span>
        )
      default:
        return null
    }
  }

  const filteredInvitations = invitations.filter(inv => {
    if (filter === 'all') return true
    if (filter === 'EXPIRED') {
      return inv.status === 'EXPIRED' || (inv.status === 'PENDING' && getDaysUntilExpiry(inv.expires_at) <= 0)
    }
    return inv.status === filter
  })

  const pendingCount = invitations.filter(
    inv => inv.status === 'PENDING' && getDaysUntilExpiry(inv.expires_at) > 0
  ).length

  if (loading) {
    return (
      <div className="bg-gray-900/50 rounded-xl border border-gray-800 p-6">
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-8 h-8 text-purple-500 animate-spin" />
        </div>
      </div>
    )
  }

  return (
    <div className="bg-gray-900/50 rounded-xl border border-gray-800 overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-gray-800">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <h3 className="text-lg font-semibold text-white">Member Invitations</h3>
            {pendingCount > 0 && (
              <span className="px-2 py-0.5 bg-yellow-500/10 text-yellow-400 text-xs rounded-full">
                {pendingCount} pending
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => fetchInvitations(true)}
              disabled={refreshing}
              className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
              title="Refresh"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            </button>
            {onInviteClick && (
              <button
                onClick={onInviteClick}
                className="flex items-center gap-2 px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors"
              >
                <Send className="w-4 h-4" />
                Invite Member
              </button>
            )}
          </div>
        </div>

        {/* Filters */}
        <div className="flex gap-2">
          {(['all', 'PENDING', 'ACCEPTED', 'EXPIRED'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                filter === f
                  ? 'bg-purple-500/20 text-purple-400'
                  : 'text-gray-400 hover:bg-gray-800'
              }`}
            >
              {f === 'all' ? 'All' : f.charAt(0) + f.slice(1).toLowerCase()}
            </button>
          ))}
        </div>
      </div>

      {/* Invitations List */}
      <div className="divide-y divide-gray-800">
        <AnimatePresence>
          {filteredInvitations.length === 0 ? (
            <div className="p-8 text-center">
              <Mail className="w-12 h-12 text-gray-600 mx-auto mb-4" />
              <h4 className="text-white font-medium mb-2">No invitations</h4>
              <p className="text-gray-500 text-sm mb-4">
                {filter === 'all'
                  ? "You haven't sent any invitations yet"
                  : `No ${filter.toLowerCase()} invitations`}
              </p>
              {onInviteClick && filter === 'all' && (
                <button
                  onClick={onInviteClick}
                  className="px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors"
                >
                  Send First Invitation
                </button>
              )}
            </div>
          ) : (
            filteredInvitations.map((invitation, index) => (
              <motion.div
                key={invitation.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ delay: index * 0.05 }}
                className="p-4 hover:bg-gray-800/50 transition-colors"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-full bg-purple-500/20 flex items-center justify-center flex-shrink-0">
                      <User className="w-5 h-5 text-purple-400" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-medium text-white">{invitation.full_name}</h4>
                        {getStatusBadge(invitation.status, invitation.expires_at)}
                      </div>
                      <div className="flex items-center gap-3 text-sm text-gray-400">
                        <span className="flex items-center gap-1">
                          <Briefcase className="w-3 h-3" />
                          {invitation.role_name}
                        </span>
                        {invitation.email && (
                          <span className="flex items-center gap-1">
                            <Mail className="w-3 h-3" />
                            {invitation.email}
                          </span>
                        )}
                        {invitation.mobile && (
                          <span className="flex items-center gap-1">
                            <Phone className="w-3 h-3" />
                            {invitation.mobile}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        Sent on {formatDate(invitation.created_at)}
                        {invitation.accepted_at && ` • Accepted on ${formatDate(invitation.accepted_at)}`}
                      </p>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    {invitation.status === 'PENDING' && getDaysUntilExpiry(invitation.expires_at) > 0 && (
                      <>
                        <button
                          onClick={() => copyInviteLink(invitation.invite_code)}
                          className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
                          title="Copy invitation link"
                        >
                          <Copy className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleCancelInvitation(invitation.id)}
                          disabled={cancellingId === invitation.id}
                          className="p-2 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                          title="Cancel invitation"
                        >
                          {cancellingId === invitation.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Trash2 className="w-4 h-4" />
                          )}
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* Permissions Summary */}
                {invitation.status === 'PENDING' && (
                  <div className="mt-3 flex items-center gap-2 text-xs">
                    <span className="text-gray-500">Permissions:</span>
                    {invitation.can_sign_documents && (
                      <span className="px-2 py-0.5 bg-gray-800 text-gray-400 rounded">Sign</span>
                    )}
                    {invitation.can_apply_for_loans && (
                      <span className="px-2 py-0.5 bg-gray-800 text-gray-400 rounded">Loans</span>
                    )}
                    {invitation.can_manage_entity && (
                      <span className="px-2 py-0.5 bg-gray-800 text-gray-400 rounded">Manage</span>
                    )}
                    {invitation.shareholding_percentage && (
                      <span className="px-2 py-0.5 bg-purple-500/10 text-purple-400 rounded">
                        {invitation.shareholding_percentage}% share
                      </span>
                    )}
                  </div>
                )}
              </motion.div>
            ))
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
