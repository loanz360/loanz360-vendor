'use client'

import { useState } from 'react'
import { Send, Calendar, Star, AlertCircle, Users, Globe, User } from 'lucide-react'
import RichTextEditor from './RichTextEditor'
import UserSelector from './UserSelector'
import GeographyFilter, { GeographySelection } from './GeographyFilter'
import ImageUploader from './ImageUploader'
import AttachmentUploader from './AttachmentUploader'
import { toast } from 'sonner'
interface User {
  id: string
  name: string
  email: string
  role: string
  subrole?: string
  geography?: {
    state?: string
    city?: string
    branch?: string
  }
}

interface Attachment {
  name: string
  url: string
  path: string
  size: number
  type: string
  uploaded_at: string
}

interface ComposeNotificationPanelProps {
  userRole: 'SUPER_ADMIN' | 'EMPLOYEE'
  userSubRole?: string
  onSuccess?: () => void
  onCancel?: () => void
}

export default function ComposeNotificationPanel({
  userRole,
  userSubRole,
  onSuccess,
  onCancel
}: ComposeNotificationPanelProps) {
  // Form state
  const [title, setTitle] = useState('')
  const [messageHtml, setMessageHtml] = useState('')
  const [messageText, setMessageText] = useState('')
  const [notificationType, setNotificationType] = useState<string>('general')
  const [priority, setPriority] = useState<'low' | 'normal' | 'high' | 'urgent'>('normal')

  // Targeting
  const [targetType, setTargetType] = useState<'all' | 'category' | 'subrole' | 'individual'>('all')
  const [targetCategory, setTargetCategory] = useState<'employee' | 'partner' | 'customer' | 'all'>('all')
  const [targetSubrole, setTargetSubrole] = useState('')
  const [selectedUsers, setSelectedUsers] = useState<User[]>([])
  const [geographyFilter, setGeographyFilter] = useState<GeographySelection>({
    state_ids: [],
    city_ids: [],
    branch_ids: []
  })

  // Rich content
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [attachments, setAttachments] = useState<Attachment[]>([])

  // Advanced options
  const [validFrom, setValidFrom] = useState('')
  const [validUntil, setValidUntil] = useState('')
  const [scheduledFor, setScheduledFor] = useState('')
  const [allowReplies, setAllowReplies] = useState(false)
  const [sendEmail, setSendEmail] = useState(false)
  const [isPinned, setIsPinned] = useState(false)

  // Action button
  const [actionUrl, setActionUrl] = useState('')
  const [actionLabel, setActionLabel] = useState('')

  // UI state
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [sending, setSending] = useState(false)

  // Permission checks
  const canSendToAll = userRole === 'SUPER_ADMIN'
  const canSendToPartners = userRole === 'SUPER_ADMIN' || userSubRole === 'ACCOUNTS_MANAGER'
  const canSendToCustomers = userRole === 'SUPER_ADMIN'

  // Validation
  const isValid = () => {
    if (!title.trim()) return { valid: false, message: 'Title is required' }
    if (!messageText.trim()) return { valid: false, message: 'Message is required' }
    if (targetType === 'individual' && selectedUsers.length === 0) {
      return { valid: false, message: 'Select at least one user for individual targeting' }
    }
    if (targetType === 'subrole' && !targetSubrole) {
      return { valid: false, message: 'Select a subrole for subrole targeting' }
    }
    return { valid: true }
  }

  const handleSubmit = async () => {
    const validation = isValid()
    if (!validation.valid) {
      toast.error(validation.message || 'Please fill all required fields')
      return
    }

    setSending(true)

    try {
      const payload = {
        title: title.trim(),
        message: messageText.trim(),
        message_html: messageHtml,
        notification_type: notificationType,
        priority,
        target_type: targetType,
        target_category: targetType === 'category' || targetType === 'subrole' ? targetCategory : undefined,
        target_subrole: targetType === 'subrole' ? targetSubrole : undefined,
        target_user_ids: targetType === 'individual' ? selectedUsers.map(u => u.id) : undefined,
        target_geography: geographyFilter.state_ids.length > 0 ? geographyFilter : undefined,
        image_url: imageUrl || undefined,
        attachments: attachments.length > 0 ? attachments : undefined,
        valid_from: validFrom || undefined,
        valid_until: validUntil || undefined,
        scheduled_for: scheduledFor || undefined,
        allow_replies: allowReplies,
        send_email: sendEmail,
        is_pinned: isPinned,
        action_url: actionUrl || undefined,
        action_label: actionLabel || undefined,
        send_in_app: true
      }

      const response = await fetch('/api/notifications/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to send notification')
      }

      toast.success(
        scheduledFor
          ? `Notification scheduled for ${new Date(scheduledFor).toLocaleString()}`
          : `Notification sent to ${data.recipients_count || 0} user(s)!`
      )

      // Reset form
      handleReset()

      if (onSuccess) onSuccess()
    } catch (error: unknown) {
      console.error('Error sending notification:', error)
      toast.error((error instanceof Error ? error.message : String(error)) || 'Failed to send notification')
    } finally {
      setSending(false)
    }
  }

  const handleReset = () => {
    setTitle('')
    setMessageHtml('')
    setMessageText('')
    setNotificationType('general')
    setPriority('normal')
    setTargetType('all')
    setTargetCategory('all')
    setTargetSubrole('')
    setSelectedUsers([])
    setGeographyFilter({ state_ids: [], city_ids: [], branch_ids: [] })
    setImageUrl(null)
    setAttachments([])
    setValidFrom('')
    setValidUntil('')
    setScheduledFor('')
    setAllowReplies(false)
    setSendEmail(false)
    setIsPinned(false)
    setActionUrl('')
    setActionLabel('')
    setShowAdvanced(false)
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold font-poppins">Compose Notification</h2>
          <p className="text-sm text-gray-400 mt-1">
            Send targeted notifications to users across the platform
          </p>
        </div>
      </div>

      {/* Form */}
      <div className="bg-white/5 backdrop-blur-lg border border-white/10 rounded-lg p-6 space-y-6">
        {/* Title */}
        <div>
          <label className="block text-sm font-medium text-white mb-2">
            Title <span className="text-red-400">*</span>
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Enter notification title..."
            className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:border-orange-500 focus:outline-none"
            disabled={sending}
          />
        </div>

        {/* Message */}
        <div>
          <label className="block text-sm font-medium text-white mb-2">
            Message <span className="text-red-400">*</span>
          </label>
          <RichTextEditor
            content={messageHtml}
            onChange={(html, text) => {
              setMessageHtml(html)
              setMessageText(text)
            }}
            disabled={sending}
          />
        </div>

        {/* Type and Priority */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-white mb-2">
              Notification Type
            </label>
            <select
              value={notificationType}
              onChange={(e) => setNotificationType(e.target.value)}
              className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-3 text-white focus:border-orange-500 focus:outline-none"
              disabled={sending}
            >
              <option value="general">General</option>
              <option value="announcement">Announcement</option>
              <option value="alert">Alert</option>
              <option value="update">Update</option>
              <option value="reminder">Reminder</option>
              <option value="promotion">Promotion</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-white mb-2">
              Priority
            </label>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value as any)}
              className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-3 text-white focus:border-orange-500 focus:outline-none"
              disabled={sending}
            >
              <option value="low">Low</option>
              <option value="normal">Normal</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </select>
          </div>
        </div>

        {/* Targeting */}
        <div className="space-y-4 border-t border-white/10 pt-6">
          <h3 className="text-lg font-semibold flex items-center gap-2 font-poppins">
            <Users className="w-5 h-5 text-orange-400" />
            Target Audience
          </h3>

          {/* Target Type */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <button
              type="button"
              onClick={() => setTargetType('all')}
              disabled={sending || !canSendToAll}
              className={`p-4 rounded-lg border-2 transition-all ${
                targetType === 'all'
                  ? 'border-orange-500 bg-orange-500/20'
                  : 'border-white/10 bg-black/30 hover:border-orange-500/50'
              } ${!canSendToAll ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <Globe className="w-6 h-6 mx-auto mb-2 text-orange-400" />
              <p className="text-sm font-medium text-white">All Users</p>
            </button>

            <button
              type="button"
              onClick={() => setTargetType('category')}
              disabled={sending}
              className={`p-4 rounded-lg border-2 transition-all ${
                targetType === 'category'
                  ? 'border-orange-500 bg-orange-500/20'
                  : 'border-white/10 bg-black/30 hover:border-orange-500/50'
              }`}
            >
              <Users className="w-6 h-6 mx-auto mb-2 text-orange-400" />
              <p className="text-sm font-medium text-white">Category</p>
            </button>

            <button
              type="button"
              onClick={() => setTargetType('subrole')}
              disabled={sending}
              className={`p-4 rounded-lg border-2 transition-all ${
                targetType === 'subrole'
                  ? 'border-orange-500 bg-orange-500/20'
                  : 'border-white/10 bg-black/30 hover:border-orange-500/50'
              }`}
            >
              <Star className="w-6 h-6 mx-auto mb-2 text-orange-400" />
              <p className="text-sm font-medium text-white">Subrole</p>
            </button>

            <button
              type="button"
              onClick={() => setTargetType('individual')}
              disabled={sending}
              className={`p-4 rounded-lg border-2 transition-all ${
                targetType === 'individual'
                  ? 'border-orange-500 bg-orange-500/20'
                  : 'border-white/10 bg-black/30 hover:border-orange-500/50'
              }`}
            >
              <User className="w-6 h-6 mx-auto mb-2 text-orange-400" />
              <p className="text-sm font-medium text-white">Individual</p>
            </button>
          </div>

          {/* Category Selection */}
          {(targetType === 'category' || targetType === 'subrole') && (
            <div>
              <label className="block text-sm font-medium text-white mb-2">
                Select Category
              </label>
              <select
                value={targetCategory}
                onChange={(e) => setTargetCategory(e.target.value as any)}
                className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-3 text-white focus:border-orange-500 focus:outline-none"
                disabled={sending}
              >
                {canSendToAll && <option value="all">All Categories</option>}
                <option value="employee">Employees</option>
                {canSendToPartners && <option value="partner">Partners</option>}
                {canSendToCustomers && <option value="customer">Customers</option>}
              </select>
            </div>
          )}

          {/* Subrole Input */}
          {targetType === 'subrole' && (
            <div>
              <label className="block text-sm font-medium text-white mb-2">
                Enter Subrole
              </label>
              <input
                type="text"
                value={targetSubrole}
                onChange={(e) => setTargetSubrole(e.target.value)}
                placeholder="e.g., HR, Sales Manager, etc."
                className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:border-orange-500 focus:outline-none"
                disabled={sending}
              />
            </div>
          )}

          {/* Individual User Selection */}
          {targetType === 'individual' && (
            <UserSelector
              selectedUsers={selectedUsers}
              onChange={setSelectedUsers}
              disabled={sending}
            />
          )}

          {/* Geography Filter */}
          {targetType !== 'individual' && (
            <GeographyFilter
              value={geographyFilter}
              onChange={setGeographyFilter}
              disabled={sending}
            />
          )}
        </div>

        {/* Rich Content */}
        <div className="space-y-4 border-t border-white/10 pt-6">
          <h3 className="text-lg font-semibold font-poppins">Rich Content (Optional)</h3>

          <ImageUploader
            value={imageUrl || undefined}
            onChange={setImageUrl}
            disabled={sending}
          />

          <AttachmentUploader
            value={attachments}
            onChange={setAttachments}
            disabled={sending}
          />
        </div>

        {/* Advanced Options */}
        <div className="border-t border-white/10 pt-6">
          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="flex items-center gap-2 text-orange-400 hover:text-orange-300 transition-colors"
          >
            <AlertCircle className="w-5 h-5" />
            <span className="font-medium">Advanced Options</span>
          </button>

          {showAdvanced && (
            <div className="mt-4 space-y-4">
              {/* Validity Period */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-white mb-2">
                    Valid From
                  </label>
                  <input
                    type="datetime-local"
                    value={validFrom}
                    onChange={(e) => setValidFrom(e.target.value)}
                    className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-3 text-white focus:border-orange-500 focus:outline-none"
                    disabled={sending}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-white mb-2">
                    Valid Until
                  </label>
                  <input
                    type="datetime-local"
                    value={validUntil}
                    onChange={(e) => setValidUntil(e.target.value)}
                    className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-3 text-white focus:border-orange-500 focus:outline-none"
                    disabled={sending}
                  />
                </div>
              </div>

              {/* Schedule */}
              <div>
                <label className="block text-sm font-medium text-white mb-2">
                  Schedule For Later
                </label>
                <input
                  type="datetime-local"
                  value={scheduledFor}
                  onChange={(e) => setScheduledFor(e.target.value)}
                  className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-3 text-white focus:border-orange-500 focus:outline-none"
                  disabled={sending}
                />
              </div>

              {/* Action Button */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-white mb-2">
                    Action Button URL
                  </label>
                  <input
                    type="url"
                    value={actionUrl}
                    onChange={(e) => setActionUrl(e.target.value)}
                    placeholder="https://example.com/action"
                    className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:border-orange-500 focus:outline-none"
                    disabled={sending}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-white mb-2">
                    Action Button Label
                  </label>
                  <input
                    type="text"
                    value={actionLabel}
                    onChange={(e) => setActionLabel(e.target.value)}
                    placeholder="Learn More"
                    className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:border-orange-500 focus:outline-none"
                    disabled={sending}
                  />
                </div>
              </div>

              {/* Toggles */}
              <div className="flex flex-wrap gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={allowReplies}
                    onChange={(e) => setAllowReplies(e.target.checked)}
                    className="w-4 h-4 rounded border-white/20 bg-black/50 text-orange-500 focus:ring-orange-500 focus:ring-offset-0"
                    disabled={sending}
                  />
                  <span className="text-sm text-white">Allow Replies</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={sendEmail}
                    onChange={(e) => setSendEmail(e.target.checked)}
                    className="w-4 h-4 rounded border-white/20 bg-black/50 text-orange-500 focus:ring-orange-500 focus:ring-offset-0"
                    disabled={sending}
                  />
                  <span className="text-sm text-white">Send Email</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isPinned}
                    onChange={(e) => setIsPinned(e.target.checked)}
                    className="w-4 h-4 rounded border-white/20 bg-black/50 text-orange-500 focus:ring-orange-500 focus:ring-offset-0"
                    disabled={sending}
                  />
                  <span className="text-sm text-white">Pin Notification</span>
                </label>
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 border-t border-white/10 pt-6">
          <button
            type="button"
            onClick={onCancel || handleReset}
            disabled={sending}
            className="px-6 py-3 bg-white/5 hover:bg-white/10 border border-white/10 text-white rounded-lg transition-colors disabled:opacity-50"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleSubmit}
            disabled={sending || !isValid().valid}
            className="px-6 py-3 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-medium transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {sending ? (
              <>
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Send className="w-5 h-5" />
                {scheduledFor ? 'Schedule Notification' : 'Send Notification'}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
