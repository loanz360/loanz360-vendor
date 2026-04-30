'use client'

import { toast } from 'sonner'

import { useState, useEffect } from 'react'
import { X, Save, Loader2 } from 'lucide-react'

interface LeadFormData {
  customer_name: string
  customer_mobile: string
  customer_email?: string
  customer_pan?: string
  customer_aadhaar?: string
  customer_dob?: string
  customer_gender?: string
  customer_address?: string
  customer_city?: string
  customer_state?: string
  customer_pincode?: string
  loan_type: string
  loan_amount_required?: number
  loan_purpose?: string
  loan_tenure_months?: number
  property_value?: number
  property_location?: string
  employment_type?: string
  monthly_income?: number
  company_name?: string
  cibil_score?: number
  lead_status: string
  lead_substatus?: string
  priority: string
  source: string
  remarks?: string
  tags?: string[]
}

interface LeadFormModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  leadId?: string
  initialData?: Partial<LeadFormData>
}

export default function LeadFormModal({
  isOpen,
  onClose,
  onSuccess,
  leadId,
  initialData
}: LeadFormModalProps) {
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState<LeadFormData>({
    customer_name: '',
    customer_mobile: '',
    loan_type: 'Home Loan',
    lead_status: 'New',
    priority: 'Medium',
    source: 'Manual Entry',
    ...initialData
  })
  const [tagsInput, setTagsInput] = useState('')

  useEffect(() => {
    if (initialData) {
      setFormData({ ...formData, ...initialData })
      if (initialData.tags) {
        setTagsInput(initialData.tags.join(', '))
      }
    }
  }, [initialData])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      // Convert tags string to array
      const tagsArray = tagsInput
        .split(',')
        .map(tag => tag.trim())
        .filter(tag => tag.length > 0)

      const payload = {
        ...formData,
        tags: tagsArray.length > 0 ? tagsArray : undefined
      }

      const url = leadId ? `/api/crm/leads/${leadId}` : '/api/crm/leads'
      const method = leadId ? 'PATCH' : 'POST'

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      const data = await response.json()

      if (data.success) {
        toast.success(leadId ? 'Lead updated successfully' : 'Lead created successfully')
        onSuccess()
        onClose()
      } else {
        toast.error(data.error || 'Failed to save lead')
      }
    } catch (error) {
      console.error('Error saving lead:', error)
      toast.error('Error saving lead')
    } finally {
      setLoading(false)
    }
  }

  const handleChange = (field: keyof LeadFormData, value: unknown) => {
    setFormData({ ...formData, [field]: value })
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold font-poppins">
            {leadId ? 'Edit Lead' : 'Create New Lead'}
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="h-5 w-5 text-gray-600" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6">
          {/* Customer Information */}
          <div className="mb-8">
            <h3 className="text-lg font-semibold mb-4 font-poppins">Customer Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Customer Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.customer_name}
                  onChange={(e) => handleChange('customer_name', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  placeholder="Enter customer name"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Mobile Number <span className="text-red-500">*</span>
                </label>
                <input
                  type="tel"
                  required
                  value={formData.customer_mobile}
                  onChange={(e) => handleChange('customer_mobile', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  placeholder="10-digit mobile number"
                  pattern="[0-9]{10}"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  value={formData.customer_email || ''}
                  onChange={(e) => handleChange('customer_email', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  placeholder="customer@example.com"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">PAN Number</label>
                <input
                  type="text"
                  value={formData.customer_pan || ''}
                  onChange={(e) => handleChange('customer_pan', e.target.value.toUpperCase())}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  placeholder="ABCDE1234F"
                  pattern="[A-Z]{5}[0-9]{4}[A-Z]{1}"
                  maxLength={10}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Aadhaar Number</label>
                <input
                  type="text"
                  value={formData.customer_aadhaar || ''}
                  onChange={(e) => handleChange('customer_aadhaar', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  placeholder="12-digit Aadhaar"
                  pattern="[0-9]{12}"
                  maxLength={12}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date of Birth</label>
                <input
                  type="date"
                  value={formData.customer_dob || ''}
                  onChange={(e) => handleChange('customer_dob', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Gender</label>
                <select
                  value={formData.customer_gender || ''}
                  onChange={(e) => handleChange('customer_gender', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                >
                  <option value="">Select Gender</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
                <textarea
                  value={formData.customer_address || ''}
                  onChange={(e) => handleChange('customer_address', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  rows={2}
                  placeholder="Enter full address"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
                <input
                  type="text"
                  value={formData.customer_city || ''}
                  onChange={(e) => handleChange('customer_city', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  placeholder="Enter city"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">State</label>
                <input
                  type="text"
                  value={formData.customer_state || ''}
                  onChange={(e) => handleChange('customer_state', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  placeholder="Enter state"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Pincode</label>
                <input
                  type="text"
                  value={formData.customer_pincode || ''}
                  onChange={(e) => handleChange('customer_pincode', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  placeholder="6-digit pincode"
                  pattern="[0-9]{6}"
                  maxLength={6}
                />
              </div>
            </div>
          </div>

          {/* Loan Information */}
          <div className="mb-8">
            <h3 className="text-lg font-semibold mb-4 font-poppins">Loan Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Loan Type <span className="text-red-500">*</span>
                </label>
                <select
                  required
                  value={formData.loan_type}
                  onChange={(e) => handleChange('loan_type', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                >
                  <option value="Home Loan">Home Loan</option>
                  <option value="Loan Against Property">Loan Against Property</option>
                  <option value="Business Loan">Business Loan</option>
                  <option value="Personal Loan">Personal Loan</option>
                  <option value="Car Loan">Car Loan</option>
                  <option value="Education Loan">Education Loan</option>
                  <option value="Gold Loan">Gold Loan</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Loan Amount Required</label>
                <input
                  type="number"
                  value={formData.loan_amount_required || ''}
                  onChange={(e) => handleChange('loan_amount_required', Number(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  placeholder="Amount in ₹"
                  min="0"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Loan Purpose</label>
                <input
                  type="text"
                  value={formData.loan_purpose || ''}
                  onChange={(e) => handleChange('loan_purpose', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  placeholder="Purpose of loan"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Loan Tenure (months)</label>
                <input
                  type="number"
                  value={formData.loan_tenure_months || ''}
                  onChange={(e) => handleChange('loan_tenure_months', Number(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  placeholder="Tenure in months"
                  min="1"
                  max="360"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Property Value</label>
                <input
                  type="number"
                  value={formData.property_value || ''}
                  onChange={(e) => handleChange('property_value', Number(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  placeholder="Property value in ₹"
                  min="0"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Property Location</label>
                <input
                  type="text"
                  value={formData.property_location || ''}
                  onChange={(e) => handleChange('property_location', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  placeholder="Property location"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Employment Type</label>
                <select
                  value={formData.employment_type || ''}
                  onChange={(e) => handleChange('employment_type', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                >
                  <option value="">Select Employment Type</option>
                  <option value="Salaried">Salaried</option>
                  <option value="Self-Employed">Self-Employed</option>
                  <option value="Business">Business</option>
                  <option value="Professional">Professional</option>
                  <option value="Retired">Retired</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Monthly Income</label>
                <input
                  type="number"
                  value={formData.monthly_income || ''}
                  onChange={(e) => handleChange('monthly_income', Number(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  placeholder="Monthly income in ₹"
                  min="0"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Company Name</label>
                <input
                  type="text"
                  value={formData.company_name || ''}
                  onChange={(e) => handleChange('company_name', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  placeholder="Company or business name"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">CIBIL Score</label>
                <input
                  type="number"
                  value={formData.cibil_score || ''}
                  onChange={(e) => handleChange('cibil_score', Number(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  placeholder="CIBIL score (300-900)"
                  min="300"
                  max="900"
                />
              </div>
            </div>
          </div>

          {/* Lead Management */}
          <div className="mb-8">
            <h3 className="text-lg font-semibold mb-4 font-poppins">Lead Management</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Lead Status <span className="text-red-500">*</span>
                </label>
                <select
                  required
                  value={formData.lead_status}
                  onChange={(e) => handleChange('lead_status', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                >
                  <option value="New">New</option>
                  <option value="Contacted">Contacted</option>
                  <option value="Qualified">Qualified</option>
                  <option value="Proposal Sent">Proposal Sent</option>
                  <option value="Negotiation">Negotiation</option>
                  <option value="Converted">Converted</option>
                  <option value="Lost">Lost</option>
                  <option value="On Hold">On Hold</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Sub-status</label>
                <input
                  type="text"
                  value={formData.lead_substatus || ''}
                  onChange={(e) => handleChange('lead_substatus', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  placeholder="Additional status detail"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Priority <span className="text-red-500">*</span>
                </label>
                <select
                  required
                  value={formData.priority}
                  onChange={(e) => handleChange('priority', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                >
                  <option value="Low">Low</option>
                  <option value="Medium">Medium</option>
                  <option value="High">High</option>
                  <option value="Urgent">Urgent</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Source <span className="text-red-500">*</span>
                </label>
                <select
                  required
                  value={formData.source}
                  onChange={(e) => handleChange('source', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                >
                  <option value="Manual Entry">Manual Entry</option>
                  <option value="Website">Website</option>
                  <option value="Phone Call">Phone Call</option>
                  <option value="Email">Email</option>
                  <option value="Referral">Referral</option>
                  <option value="Social Media">Social Media</option>
                  <option value="Walk-in">Walk-in</option>
                  <option value="Campaign">Campaign</option>
                  <option value="Partner">Partner</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Tags (comma-separated)</label>
                <input
                  type="text"
                  value={tagsInput}
                  onChange={(e) => setTagsInput(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  placeholder="e.g., Hot Lead, Follow-up Required, Premium"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Remarks</label>
                <textarea
                  value={formData.remarks || ''}
                  onChange={(e) => handleChange('remarks', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  rows={3}
                  placeholder="Additional notes or remarks"
                />
              </div>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
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
                  {leadId ? 'Update Lead' : 'Create Lead'}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
