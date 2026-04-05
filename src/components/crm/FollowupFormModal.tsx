'use client'

import { toast } from 'sonner'

import { useState } from 'react'
import { X, Save, Loader2, Calendar, Clock, Repeat } from 'lucide-react'

interface FollowupFormData {
  lead_id: string
  followup_type: string
  scheduled_at: string
  priority: string
  status: string
  notes?: string
  is_recurring: boolean
  recurrence_pattern?: string
  recurrence_end_date?: string
}

interface FollowupFormModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  leadId: string
  leadName?: string
}

export default function FollowupFormModal({
  isOpen,
  onClose,
  onSuccess,
  leadId,
  leadName
}: FollowupFormModalProps) {
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState<FollowupFormData>({
    lead_id: leadId,
    followup_type: 'Call',
    scheduled_at: '',
    priority: 'Medium',
    status: 'Pending',
    is_recurring: false
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const response = await fetch('/api/crm/followups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })

      const data = await response.json()

      if (data.success) {
        toast.success('Follow-up scheduled successfully')
        onSuccess()
        onClose()
      } else {
        toast.error(data.error || 'Failed to schedule follow-up')
      }
    } catch (error) {
      console.error('Error scheduling follow-up:', error)
      toast.error('Error scheduling follow-up')
    } finally {
      setLoading(false)
    }
  }

  const handleChange = (field: keyof FollowupFormData, value: any) => {
    setFormData({ ...formData, [field]: value })
  }

  // Get minimum datetime (current time)
  const getMinDateTime = () => {
    const now = new Date()
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset())
    return now.toISOString().slice(0, 16)
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold font-poppins">Schedule Follow-up</h2>
            {leadName && (
              <p className="text-sm text-gray-600 mt-1">For: {leadName}</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="h-5 w-5 text-gray-600" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6">
          <div className="space-y-6">
            {/* Follow-up Type */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Follow-up Type <span className="text-red-500">*</span>
              </label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {['Call', 'Email', 'Meeting', 'Site Visit'].map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => handleChange('followup_type', type)}
                    className={`px-4 py-3 border rounded-lg text-sm font-medium transition-colors ${
                      formData.followup_type === type
                        ? 'border-orange-500 bg-orange-50 text-orange-700'
                        : 'border-gray-300 hover:border-gray-400 text-gray-700'
                    }`}
                  >
                    {type}
                  </button>
                ))}
              </div>
              <div className="mt-2">
                <input
                  type="text"
                  value={formData.followup_type}
                  onChange={(e) => handleChange('followup_type', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  placeholder="Or enter custom type"
                />
              </div>
            </div>

            {/* Scheduled Date & Time */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Scheduled Date & Time <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  type="datetime-local"
                  required
                  value={formData.scheduled_at}
                  onChange={(e) => handleChange('scheduled_at', e.target.value)}
                  min={getMinDateTime()}
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                />
              </div>
            </div>

            {/* Priority */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Priority <span className="text-red-500">*</span>
              </label>
              <div className="grid grid-cols-4 gap-3">
                {[
                  { value: 'Low', color: 'green' },
                  { value: 'Medium', color: 'yellow' },
                  { value: 'High', color: 'orange' },
                  { value: 'Urgent', color: 'red' }
                ].map((priority) => (
                  <button
                    key={priority.value}
                    type="button"
                    onClick={() => handleChange('priority', priority.value)}
                    className={`px-4 py-2 border rounded-lg text-sm font-medium transition-colors ${
                      formData.priority === priority.value
                        ? `border-${priority.color}-500 bg-${priority.color}-50 text-${priority.color}-700`
                        : 'border-gray-300 hover:border-gray-400 text-gray-700'
                    }`}
                  >
                    {priority.value}
                  </button>
                ))}
              </div>
            </div>

            {/* Status */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
              <select
                value={formData.status}
                onChange={(e) => handleChange('status', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              >
                <option value="Pending">Pending</option>
                <option value="Completed">Completed</option>
                <option value="Cancelled">Cancelled</option>
                <option value="Rescheduled">Rescheduled</option>
              </select>
            </div>

            {/* Recurring */}
            <div className="border border-gray-200 rounded-lg p-4">
              <div className="flex items-center gap-3 mb-4">
                <input
                  type="checkbox"
                  id="is_recurring"
                  checked={formData.is_recurring}
                  onChange={(e) => handleChange('is_recurring', e.target.checked)}
                  className="w-4 h-4 text-orange-600 border-gray-300 rounded focus:ring-orange-500"
                />
                <label htmlFor="is_recurring" className="flex items-center gap-2 text-sm font-medium text-gray-700">
                  <Repeat className="h-4 w-4" />
                  Make this a recurring follow-up
                </label>
              </div>

              {formData.is_recurring && (
                <div className="space-y-4 pl-7">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Recurrence Pattern <span className="text-red-500">*</span>
                    </label>
                    <select
                      required={formData.is_recurring}
                      value={formData.recurrence_pattern || ''}
                      onChange={(e) => handleChange('recurrence_pattern', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    >
                      <option value="">Select Pattern</option>
                      <option value="Daily">Daily</option>
                      <option value="Weekly">Weekly</option>
                      <option value="Biweekly">Biweekly</option>
                      <option value="Monthly">Monthly</option>
                      <option value="Quarterly">Quarterly</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      End Date (Optional)
                    </label>
                    <input
                      type="date"
                      value={formData.recurrence_end_date || ''}
                      onChange={(e) => handleChange('recurrence_end_date', e.target.value)}
                      min={formData.scheduled_at?.split('T')[0]}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Leave empty for indefinite recurrence
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Notes */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Notes / Agenda
              </label>
              <textarea
                value={formData.notes || ''}
                onChange={(e) => handleChange('notes', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                rows={4}
                placeholder="Add notes, agenda items, or reminders for this follow-up..."
              />
            </div>
          </div>

          {/* Footer Actions */}
          <div className="flex justify-end gap-3 pt-6 mt-6 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 flex items-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Scheduling...
                </>
              ) : (
                <>
                  <Calendar className="h-4 w-4" />
                  Schedule Follow-up
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
