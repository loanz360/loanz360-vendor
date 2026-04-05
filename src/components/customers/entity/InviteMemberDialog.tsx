'use client'

import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  X,
  UserPlus,
  Mail,
  Phone,
  User,
  Briefcase,
  FileSignature,
  CreditCard,
  Settings,
  Percent,
  MessageSquare,
  Loader2,
  CheckCircle,
  Copy,
  Send,
  AlertCircle
} from 'lucide-react'
import { toast } from 'sonner'

interface MemberRole {
  key: string
  name: string
  can_sign: boolean
  can_apply_loan: boolean
  is_default: boolean
}

interface InviteMemberDialogProps {
  isOpen: boolean
  onClose: () => void
  entityId: string
  entityName: string
  availableRoles: MemberRole[]
  onInviteSent?: () => void
}

export default function InviteMemberDialog({
  isOpen,
  onClose,
  entityId,
  entityName,
  availableRoles,
  onInviteSent
}: InviteMemberDialogProps) {
  // Form state
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [mobile, setMobile] = useState('')
  const [selectedRole, setSelectedRole] = useState<MemberRole | null>(null)
  const [canSignDocuments, setCanSignDocuments] = useState(false)
  const [canApplyForLoans, setCanApplyForLoans] = useState(false)
  const [canManageEntity, setCanManageEntity] = useState(false)
  const [shareholdingPercentage, setShareholdingPercentage] = useState('')
  const [personalMessage, setPersonalMessage] = useState('')

  // UI state
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [invitationLink, setInvitationLink] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})

  // Set default role
  useEffect(() => {
    if (availableRoles.length > 0 && !selectedRole) {
      const defaultRole = availableRoles.find(r => r.is_default) || availableRoles[0]
      setSelectedRole(defaultRole)
      setCanSignDocuments(defaultRole.can_sign)
      setCanApplyForLoans(defaultRole.can_apply_loan)
    }
  }, [availableRoles, selectedRole])

  // Reset on close
  useEffect(() => {
    if (!isOpen) {
      setTimeout(() => {
        setFullName('')
        setEmail('')
        setMobile('')
        setSelectedRole(availableRoles.find(r => r.is_default) || availableRoles[0] || null)
        setCanSignDocuments(false)
        setCanApplyForLoans(false)
        setCanManageEntity(false)
        setShareholdingPercentage('')
        setPersonalMessage('')
        setSent(false)
        setInvitationLink('')
        setErrors({})
      }, 300)
    }
  }, [isOpen, availableRoles])

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {}

    if (!fullName.trim()) {
      newErrors.fullName = 'Full name is required'
    }

    if (!email.trim() && !mobile.trim()) {
      newErrors.contact = 'Either email or mobile number is required'
    }

    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      newErrors.email = 'Invalid email address'
    }

    if (mobile && !/^[6-9]\d{9}$/.test(mobile)) {
      newErrors.mobile = 'Invalid mobile number (10 digits starting with 6-9)'
    }

    if (!selectedRole) {
      newErrors.role = 'Please select a role'
    }

    if (shareholdingPercentage) {
      const pct = parseFloat(shareholdingPercentage)
      if (isNaN(pct) || pct < 0 || pct > 100) {
        newErrors.shareholding = 'Shareholding must be between 0 and 100'
      }
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSend = async () => {
    if (!validateForm()) return

    try {
      setSending(true)

      const response = await fetch('/api/customers/entity/invitations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          entityId,
          fullName: fullName.trim(),
          email: email.trim() || undefined,
          mobile: mobile.trim() || undefined,
          roleKey: selectedRole?.key,
          roleName: selectedRole?.name,
          canSignDocuments,
          canApplyForLoans,
          canManageEntity,
          shareholdingPercentage: shareholdingPercentage ? parseFloat(shareholdingPercentage) : undefined,
          personalMessage: personalMessage.trim() || undefined
        })
      })

      const data = await response.json()

      if (!response.ok || !data.success) {
        toast.error(data.error || 'Failed to send invitation')
        return
      }

      setSent(true)
      setInvitationLink(data.invitation?.invitationLink || '')
      toast.success('Invitation sent successfully!')
      onInviteSent?.()
    } catch (err) {
      console.error('Error sending invitation:', err)
      toast.error('Failed to send invitation')
    } finally {
      setSending(false)
    }
  }

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(invitationLink)
      toast.success('Link copied to clipboard!')
    } catch {
      toast.error('Failed to copy link')
    }
  }

  const handleRoleChange = (role: MemberRole) => {
    setSelectedRole(role)
    setCanSignDocuments(role.can_sign)
    setCanApplyForLoans(role.can_apply_loan)
  }

  if (!isOpen) return null

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        />

        {/* Dialog */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="relative w-full max-w-lg mx-4 max-h-[90vh] overflow-hidden bg-gray-900 rounded-2xl border border-gray-800 shadow-xl"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-800">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-purple-500/20 flex items-center justify-center">
                <UserPlus className="w-5 h-5 text-purple-400" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-white">Invite Member</h2>
                <p className="text-sm text-gray-400">Add a new member to {entityName}</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Content */}
          <div className="p-6 overflow-y-auto max-h-[calc(90vh-200px)]">
            {!sent ? (
              <div className="space-y-5">
                {/* Full Name */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    <User className="w-4 h-4 inline mr-2" />
                    Full Name *
                  </label>
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Enter member's full name"
                    className={`w-full px-4 py-3 bg-gray-800 border rounded-xl text-white placeholder-gray-500 focus:outline-none transition-colors ${
                      errors.fullName ? 'border-red-500' : 'border-gray-700 focus:border-purple-500'
                    }`}
                  />
                  {errors.fullName && (
                    <p className="mt-1 text-sm text-red-400">{errors.fullName}</p>
                  )}
                </div>

                {/* Contact (Email / Mobile) */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      <Mail className="w-4 h-4 inline mr-2" />
                      Email
                    </label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="email@example.com"
                      className={`w-full px-4 py-3 bg-gray-800 border rounded-xl text-white placeholder-gray-500 focus:outline-none transition-colors ${
                        errors.email || errors.contact ? 'border-red-500' : 'border-gray-700 focus:border-purple-500'
                      }`}
                    />
                    {errors.email && (
                      <p className="mt-1 text-sm text-red-400">{errors.email}</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      <Phone className="w-4 h-4 inline mr-2" />
                      Mobile
                    </label>
                    <input
                      type="tel"
                      value={mobile}
                      onChange={(e) => setMobile(e.target.value)}
                      placeholder="9876543210"
                      maxLength={10}
                      className={`w-full px-4 py-3 bg-gray-800 border rounded-xl text-white placeholder-gray-500 focus:outline-none transition-colors ${
                        errors.mobile || errors.contact ? 'border-red-500' : 'border-gray-700 focus:border-purple-500'
                      }`}
                    />
                    {errors.mobile && (
                      <p className="mt-1 text-sm text-red-400">{errors.mobile}</p>
                    )}
                  </div>
                </div>
                {errors.contact && (
                  <p className="text-sm text-red-400">{errors.contact}</p>
                )}

                {/* Role Selection */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    <Briefcase className="w-4 h-4 inline mr-2" />
                    Role *
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {availableRoles.map((role) => (
                      <button
                        key={role.key}
                        type="button"
                        onClick={() => handleRoleChange(role)}
                        className={`p-3 rounded-xl border text-left transition-colors ${
                          selectedRole?.key === role.key
                            ? 'border-purple-500 bg-purple-500/10'
                            : 'border-gray-700 bg-gray-800/50 hover:border-gray-600'
                        }`}
                      >
                        <span className={selectedRole?.key === role.key ? 'text-purple-400 font-medium' : 'text-white'}>
                          {role.name}
                        </span>
                      </button>
                    ))}
                  </div>
                  {errors.role && (
                    <p className="mt-1 text-sm text-red-400">{errors.role}</p>
                  )}
                </div>

                {/* Permissions */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-3">
                    Permissions
                  </label>
                  <div className="space-y-3">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={canSignDocuments}
                        onChange={(e) => setCanSignDocuments(e.target.checked)}
                        className="w-5 h-5 rounded border-gray-700 bg-gray-800 text-purple-500 focus:ring-purple-500"
                      />
                      <FileSignature className="w-4 h-4 text-gray-400" />
                      <span className="text-gray-300">Can sign documents</span>
                    </label>
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={canApplyForLoans}
                        onChange={(e) => setCanApplyForLoans(e.target.checked)}
                        className="w-5 h-5 rounded border-gray-700 bg-gray-800 text-purple-500 focus:ring-purple-500"
                      />
                      <CreditCard className="w-4 h-4 text-gray-400" />
                      <span className="text-gray-300">Can apply for loans</span>
                    </label>
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={canManageEntity}
                        onChange={(e) => setCanManageEntity(e.target.checked)}
                        className="w-5 h-5 rounded border-gray-700 bg-gray-800 text-purple-500 focus:ring-purple-500"
                      />
                      <Settings className="w-4 h-4 text-gray-400" />
                      <span className="text-gray-300">Can manage entity (invite members)</span>
                    </label>
                  </div>
                </div>

                {/* Shareholding (Optional) */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    <Percent className="w-4 h-4 inline mr-2" />
                    Shareholding % (Optional)
                  </label>
                  <input
                    type="number"
                    value={shareholdingPercentage}
                    onChange={(e) => setShareholdingPercentage(e.target.value)}
                    placeholder="e.g., 25"
                    min="0"
                    max="100"
                    step="0.01"
                    className={`w-full px-4 py-3 bg-gray-800 border rounded-xl text-white placeholder-gray-500 focus:outline-none transition-colors ${
                      errors.shareholding ? 'border-red-500' : 'border-gray-700 focus:border-purple-500'
                    }`}
                  />
                  {errors.shareholding && (
                    <p className="mt-1 text-sm text-red-400">{errors.shareholding}</p>
                  )}
                </div>

                {/* Personal Message */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    <MessageSquare className="w-4 h-4 inline mr-2" />
                    Personal Message (Optional)
                  </label>
                  <textarea
                    value={personalMessage}
                    onChange={(e) => setPersonalMessage(e.target.value)}
                    placeholder="Add a personal note to the invitation..."
                    rows={3}
                    maxLength={500}
                    className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:border-purple-500 focus:outline-none transition-colors resize-none"
                  />
                  <p className="mt-1 text-xs text-gray-500 text-right">{personalMessage.length}/500</p>
                </div>
              </div>
            ) : (
              /* Success State */
              <div className="text-center py-6">
                <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-4">
                  <CheckCircle className="w-8 h-8 text-green-400" />
                </div>
                <h3 className="text-xl font-semibold text-white mb-2">Invitation Sent!</h3>
                <p className="text-gray-400 mb-6">
                  An invitation has been sent to <span className="text-white font-medium">{fullName}</span>
                </p>

                {invitationLink && (
                  <div className="bg-gray-800 rounded-xl p-4 mb-4">
                    <p className="text-sm text-gray-400 mb-2">Share this link directly:</p>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        readOnly
                        value={invitationLink}
                        className="flex-1 px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-sm text-gray-300 truncate"
                      />
                      <button
                        onClick={handleCopyLink}
                        className="p-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors"
                      >
                        <Copy className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-center gap-2 text-sm text-gray-400">
                  <AlertCircle className="w-4 h-4" />
                  <span>Invitation expires in 7 days</span>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-6 border-t border-gray-800">
            {!sent ? (
              <div className="flex gap-3">
                <button
                  onClick={onClose}
                  className="flex-1 px-6 py-3 bg-gray-800 text-gray-300 rounded-xl hover:bg-gray-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSend}
                  disabled={sending}
                  className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-500 to-purple-600 text-white rounded-xl hover:from-purple-600 hover:to-purple-700 transition-colors disabled:opacity-50"
                >
                  {sending ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <>
                      <Send className="w-5 h-5" />
                      Send Invitation
                    </>
                  )}
                </button>
              </div>
            ) : (
              <button
                onClick={onClose}
                className="w-full px-6 py-3 bg-gray-800 text-white rounded-xl hover:bg-gray-700 transition-colors"
              >
                Done
              </button>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}
