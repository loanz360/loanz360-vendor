'use client'

import { toast } from 'sonner'

import { useState } from 'react'
import { X, Save, Loader2, MessageSquare, Phone, FileText } from 'lucide-react'

interface NoteFormData {
  lead_id: string
  is_call_log: boolean
  note_text?: string
  call_duration_seconds?: number
  call_recording_url?: string
  disposition_code?: string
  sentiment?: string
}

interface NoteFormModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  leadId: string
  leadName?: string
  isCallLog?: boolean
}

export default function NoteFormModal({
  isOpen,
  onClose,
  onSuccess,
  leadId,
  leadName,
  isCallLog = false
}: NoteFormModalProps) {
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState<NoteFormData>({
    lead_id: leadId,
    is_call_log: isCallLog
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const response = await fetch('/api/crm/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })

      const data = await response.json()

      if (data.success) {
        toast.success(formData.is_call_log ? 'Call log added successfully' : 'Note added successfully')
        onSuccess()
        onClose()
      } else {
        toast.error(data.error || 'Failed to add note')
      }
    } catch (error) {
      console.error('Error adding note:', error)
      toast.error('Error adding note')
    } finally {
      setLoading(false)
    }
  }

  const handleChange = (field: keyof NoteFormData, value: unknown) => {
    setFormData({ ...formData, [field]: value })
  }

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}m ${secs}s`
  }

  const handleDurationChange = (minutes: number, seconds: number) => {
    const totalSeconds = minutes * 60 + seconds
    handleChange('call_duration_seconds', totalSeconds)
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold flex items-center gap-2 font-poppins">
              {formData.is_call_log ? (
                <>
                  <Phone className="h-5 w-5 text-green-600" />
                  Add Call Log
                </>
              ) : (
                <>
                  <MessageSquare className="h-5 w-5 text-blue-600" />
                  Add Note
                </>
              )}
            </h2>
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
            {/* Note Type Toggle */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Note Type</label>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => handleChange('is_call_log', false)}
                  className={`flex-1 px-4 py-3 border rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
                    !formData.is_call_log
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-gray-300 hover:border-gray-400 text-gray-700'
                  }`}
                >
                  <MessageSquare className="h-4 w-4" />
                  Regular Note
                </button>
                <button
                  type="button"
                  onClick={() => handleChange('is_call_log', true)}
                  className={`flex-1 px-4 py-3 border rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
                    formData.is_call_log
                      ? 'border-green-500 bg-green-50 text-green-700'
                      : 'border-gray-300 hover:border-gray-400 text-gray-700'
                  }`}
                >
                  <Phone className="h-4 w-4" />
                  Call Log
                </button>
              </div>
            </div>

            {/* Note Text */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {formData.is_call_log ? 'Call Summary' : 'Note'} <span className="text-red-500">*</span>
              </label>
              <textarea
                required
                value={formData.note_text || ''}
                onChange={(e) => handleChange('note_text', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                rows={6}
                placeholder={
                  formData.is_call_log
                    ? 'Describe the call conversation, customer response, key points discussed...'
                    : 'Add your note here...'
                }
              />
            </div>

            {/* Call Log Specific Fields */}
            {formData.is_call_log && (
              <>
                {/* Call Duration */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Call Duration
                  </label>
                  <div className="flex items-center gap-3">
                    <div className="flex-1">
                      <label className="block text-xs text-gray-600 mb-1">Minutes</label>
                      <input
                        type="number"
                        min="0"
                        max="999"
                        value={Math.floor((formData.call_duration_seconds || 0) / 60)}
                        onChange={(e) =>
                          handleDurationChange(
                            Number(e.target.value),
                            (formData.call_duration_seconds || 0) % 60
                          )
                        }
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                        placeholder="0"
                      />
                    </div>
                    <div className="flex-1">
                      <label className="block text-xs text-gray-600 mb-1">Seconds</label>
                      <input
                        type="number"
                        min="0"
                        max="59"
                        value={(formData.call_duration_seconds || 0) % 60}
                        onChange={(e) =>
                          handleDurationChange(
                            Math.floor((formData.call_duration_seconds || 0) / 60),
                            Number(e.target.value)
                          )
                        }
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                        placeholder="0"
                      />
                    </div>
                    <div className="flex-1 pt-6">
                      <div className="px-3 py-2 bg-gray-50 rounded-lg text-sm text-gray-700">
                        {formatDuration(formData.call_duration_seconds || 0)}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Disposition Code */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Call Disposition
                  </label>
                  <select
                    value={formData.disposition_code || ''}
                    onChange={(e) => handleChange('disposition_code', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  >
                    <option value="">Select Disposition</option>
                    <option value="Connected">Connected</option>
                    <option value="Not Reachable">Not Reachable</option>
                    <option value="Busy">Busy</option>
                    <option value="Switched Off">Switched Off</option>
                    <option value="Voicemail">Voicemail</option>
                    <option value="Wrong Number">Wrong Number</option>
                    <option value="Not Interested">Not Interested</option>
                    <option value="Call Back Later">Call Back Later</option>
                    <option value="Interested">Interested</option>
                    <option value="Follow-up Scheduled">Follow-up Scheduled</option>
                    <option value="Documentation Pending">Documentation Pending</option>
                    <option value="Application Submitted">Application Submitted</option>
                    <option value="Rejected">Rejected</option>
                  </select>
                </div>

                {/* Sentiment */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Customer Sentiment
                  </label>
                  <div className="grid grid-cols-5 gap-2">
                    {[
                      { value: 'Very Positive', emoji: '😊', color: 'green' },
                      { value: 'Positive', emoji: '🙂', color: 'blue' },
                      { value: 'Neutral', emoji: '😐', color: 'gray' },
                      { value: 'Negative', emoji: '😟', color: 'orange' },
                      { value: 'Very Negative', emoji: '😠', color: 'red' }
                    ].map((sentiment) => (
                      <button
                        key={sentiment.value}
                        type="button"
                        onClick={() => handleChange('sentiment', sentiment.value)}
                        className={`px-3 py-2 border rounded-lg text-sm font-medium transition-colors ${
                          formData.sentiment === sentiment.value
                            ? `border-${sentiment.color}-500 bg-${sentiment.color}-50`
                            : 'border-gray-300 hover:border-gray-400'
                        }`}
                        title={sentiment.value}
                      >
                        <div className="text-2xl">{sentiment.emoji}</div>
                        <div className="text-xs mt-1">{sentiment.value.split(' ')[0]}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Call Recording URL */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Call Recording URL (Optional)
                  </label>
                  <div className="relative">
                    <FileText className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                    <input
                      type="url"
                      value={formData.call_recording_url || ''}
                      onChange={(e) => handleChange('call_recording_url', e.target.value)}
                      className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                      placeholder="https://example.com/recording.mp3"
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    Paste the URL of the call recording if available
                  </p>
                </div>
              </>
            )}
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
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  Save {formData.is_call_log ? 'Call Log' : 'Note'}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
