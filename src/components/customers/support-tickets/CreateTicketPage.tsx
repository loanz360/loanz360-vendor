'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, AlertCircle, CheckCircle } from 'lucide-react'
import { InlineLoading } from '@/components/ui/loading-spinner'

interface CreateTicketPageProps {
  customerSubrole: string
  basePath: string
}

const categories = [
  { value: 'loan_application', label: 'Loan Application', description: 'Questions about applying for a loan' },
  { value: 'loan_disbursement', label: 'Loan Disbursement', description: 'Issues with loan disbursement' },
  { value: 'emi_payment', label: 'EMI Payment', description: 'EMI payment related queries' },
  { value: 'account_access', label: 'Account Access', description: 'Login or account access issues' },
  { value: 'document_upload', label: 'Document Upload', description: 'Problems uploading documents' },
  { value: 'loan_status', label: 'Loan Status', description: 'Check status of your loan application' },
  { value: 'interest_rate', label: 'Interest Rate', description: 'Questions about interest rates' },
  { value: 'prepayment', label: 'Prepayment', description: 'Prepayment or part-payment queries' },
  { value: 'foreclosure', label: 'Foreclosure', description: 'Loan foreclosure requests' },
  { value: 'customer_service', label: 'Customer Service', description: 'General customer service' },
  { value: 'technical_issue', label: 'Technical Issue', description: 'Website or app technical problems' },
  { value: 'complaint', label: 'Complaint', description: 'File a complaint' },
  { value: 'general_inquiry', label: 'General Inquiry', description: 'General questions' }
]

export default function CreateTicketPage({ customerSubrole, basePath }: CreateTicketPageProps) {
  const router = useRouter()
  const [formData, setFormData] = useState({
    subject: '',
    description: '',
    category: '',
    priority: 'medium',
    is_confidential: false,
    requires_urgent_attention: false
  })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    // Validation
    if (!formData.subject || formData.subject.length < 5) {
      setError('Subject must be at least 5 characters long')
      return
    }

    if (formData.subject.length > 200) {
      setError('Subject must not exceed 200 characters')
      return
    }

    if (!formData.description || formData.description.length < 20) {
      setError('Description must be at least 20 characters long')
      return
    }

    if (!formData.category) {
      setError('Please select a category')
      return
    }

    setSubmitting(true)
    try {
      const response = await fetch('/api/customer-support/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })

      const data = await response.json()

      if (response.ok) {
        setSuccess(true)
        setTimeout(() => {
          router.push(`${basePath}/support/${data.ticket.id}`)
        }, 1500)
      } else {
        setError(data.error || 'Failed to create ticket. Please try again.')
      }
    } catch (err) {
      setError('An error occurred. Please try again.')
      console.error('Error:', err)
    } finally {
      setSubmitting(false)
    }
  }

  const handleCancel = () => {
    if (window.confirm('Are you sure you want to cancel? All entered information will be lost.')) {
      router.push(`${basePath}/support`)
    }
  }

  if (success) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-2 font-poppins">Ticket Created Successfully!</h2>
          <p className="text-gray-400 mb-4">Redirecting to ticket details...</p>
          <InlineLoading size="sm" />
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-black p-6">
      <div className="max-w-3xl mx-auto">
        <button
          onClick={handleCancel}
          className="flex items-center gap-2 text-gray-400 hover:text-white mb-6 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
          Back to Tickets
        </button>

        <div className="bg-white/5 backdrop-blur-lg border border-white/10 rounded-lg p-8">
          <h1 className="text-3xl font-bold mb-2 font-poppins">Create Support Ticket</h1>
          <p className="text-gray-400 mb-6">
            Fill out the form below and our support team will get back to you as soon as possible.
          </p>

          {error && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 mb-6 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-red-400">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Subject */}
            <div>
              <label className="block text-white font-medium mb-2">
                Subject <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.subject}
                onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                className="w-full bg-black/50 text-white border border-white/20 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-orange-500"
                placeholder="Brief description of your issue"
                maxLength={200}
                disabled={submitting}
              />
              <p className="text-gray-500 text-sm mt-1">{formData.subject.length}/200 characters</p>
            </div>

            {/* Category */}
            <div>
              <label className="block text-white font-medium mb-3">
                Category <span className="text-red-500">*</span>
              </label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {categories.map((cat) => (
                  <button
                    key={cat.value}
                    type="button"
                    onClick={() => setFormData({ ...formData, category: cat.value })}
                    disabled={submitting}
                    className={`text-left p-4 rounded-lg border transition-all ${
                      formData.category === cat.value
                        ? 'bg-orange-500/20 border-orange-500 text-white'
                        : 'bg-black/30 border-white/10 text-gray-300 hover:bg-white/5'
                    }`}
                  >
                    <div className="font-medium mb-1">{cat.label}</div>
                    <div className="text-xs text-gray-400">{cat.description}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Priority */}
            <div>
              <label className="block text-white font-medium mb-2">
                Priority <span className="text-red-500">*</span>
              </label>
              <div className="grid grid-cols-4 gap-3">
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, priority: 'low' })}
                  disabled={submitting}
                  className={`p-3 rounded-lg border text-center transition-all ${
                    formData.priority === 'low'
                      ? 'bg-blue-500/20 border-blue-500 text-white'
                      : 'bg-black/30 border-white/10 text-gray-300 hover:bg-white/5'
                  }`}
                >
                  Low
                </button>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, priority: 'medium' })}
                  disabled={submitting}
                  className={`p-3 rounded-lg border text-center transition-all ${
                    formData.priority === 'medium'
                      ? 'bg-yellow-500/20 border-yellow-500 text-white'
                      : 'bg-black/30 border-white/10 text-gray-300 hover:bg-white/5'
                  }`}
                >
                  Medium
                </button>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, priority: 'high' })}
                  disabled={submitting}
                  className={`p-3 rounded-lg border text-center transition-all ${
                    formData.priority === 'high'
                      ? 'bg-orange-500/20 border-orange-500 text-white'
                      : 'bg-black/30 border-white/10 text-gray-300 hover:bg-white/5'
                  }`}
                >
                  High
                </button>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, priority: 'urgent' })}
                  disabled={submitting}
                  className={`p-3 rounded-lg border text-center transition-all ${
                    formData.priority === 'urgent'
                      ? 'bg-red-500/20 border-red-500 text-white'
                      : 'bg-black/30 border-white/10 text-gray-300 hover:bg-white/5'
                  }`}
                >
                  Urgent
                </button>
              </div>
            </div>

            {/* Description */}
            <div>
              <label className="block text-white font-medium mb-2">
                Description <span className="text-red-500">*</span>
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full bg-black/50 text-white border border-white/20 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-orange-500 resize-none"
                placeholder="Please provide detailed information about your issue. Include any relevant details that will help us assist you better."
                rows={6}
                disabled={submitting}
              />
              <p className="text-gray-500 text-sm mt-1">
                {formData.description.length < 20
                  ? `Minimum 20 characters required (${formData.description.length}/20)`
                  : `${formData.description.length} characters`}
              </p>
            </div>

            {/* Options */}
            <div className="space-y-3">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.is_confidential}
                  onChange={(e) => setFormData({ ...formData, is_confidential: e.target.checked })}
                  className="w-5 h-5 bg-black/50 border border-white/20 rounded focus:ring-2 focus:ring-orange-500"
                  disabled={submitting}
                />
                <div>
                  <span className="text-white font-medium">Mark as Confidential</span>
                  <p className="text-gray-400 text-sm">Limit access to senior support staff only</p>
                </div>
              </label>

              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.requires_urgent_attention}
                  onChange={(e) => setFormData({ ...formData, requires_urgent_attention: e.target.checked })}
                  className="w-5 h-5 bg-black/50 border border-white/20 rounded focus:ring-2 focus:ring-orange-500"
                  disabled={submitting}
                />
                <div>
                  <span className="text-white font-medium">Requires Urgent Attention</span>
                  <p className="text-gray-400 text-sm">Escalate this ticket for immediate review</p>
                </div>
              </label>
            </div>

            {/* Submit Buttons */}
            <div className="flex gap-4 pt-4">
              <button
                type="button"
                onClick={handleCancel}
                disabled={submitting}
                className="flex-1 bg-gray-700 hover:bg-gray-600 text-white px-6 py-3 rounded-lg transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting || !formData.subject || !formData.description || !formData.category}
                className="flex-1 bg-orange-500 hover:bg-orange-600 text-white px-6 py-3 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-semibold"
              >
                {submitting ? 'Creating Ticket...' : 'Create Ticket'}
              </button>
            </div>
          </form>

          {/* Help Text */}
          <div className="mt-6 p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
            <p className="text-blue-300 text-sm">
              <strong>Tip:</strong> For faster resolution, please provide as much detail as possible about your issue,
              including any error messages, screenshots, or relevant loan/account numbers.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
